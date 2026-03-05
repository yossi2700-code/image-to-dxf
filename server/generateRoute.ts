import { Router } from "express";
import { storagePut } from "./storage";
import { nanoid } from "nanoid";
import { logUsageEvent, anonymizeIp } from "./usageDb";
import { getAppUserFromCookie } from "./appAuth";
import { recordUserAction } from "./userActionsDb";
import { deductTokens, addTokens, TOKEN_COSTS, TokenAction } from "./tokenService";
import { createJob, getJob, updateJob, cancelJob } from "./jobStore";
import OpenAI from "openai";
import { svgToDxf } from "./svgToDxf";
import potrace from "potrace";
import sharp from "sharp";

const router = Router();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY ?? "" });

/**
 * Three distinct style variations for the same subject.
 */
const STYLE_VARIATIONS = [
  {
    label: "simple",
    style:
      "VARIATION 1 — ARTISTIC CLEAN OUTLINE: Draw a professional, elegant line art illustration. " +
      "Bold confident outer contour with 5-8 key structural lines that define the form. " +
      "The style should look like a skilled artist's clean sketch — NOT a child's coloring book. " +
      "Think of a high-end brand logo or a professional product illustration. " +
      "Minimal but sophisticated. NO texture, NO hatching, NO shading, NO fill. " +
      "PRESERVE the exact shape and proportions. Pure black lines on white background only. " +
      "CRITICAL FRAMING: The object must occupy NO MORE than 65% of the image width AND height. " +
      "Leave at least 17% white margin on EVERY side (left, right, top, bottom). " +
      "The object must be FULLY VISIBLE — nothing cut off, nothing touching or near the border.",
  },
  {
    label: "detailed",
    style:
      "VARIATION 2 — SHARP PRECISE MODERATE: Draw the complete object with all main structural features " +
      "and key details, but keep the line count moderate — not too sparse, not too dense. " +
      "Bold outer contour with clean inner lines showing the main components and surfaces. " +
      "Like a professional product catalog illustration. " +
      "NO texture, NO hatching, NO shading, NO fill. PRESERVE the exact shape. Clean sharp lines only. " +
      "CRITICAL FRAMING: The object must occupy NO MORE than 65% of the image width AND height. " +
      "Leave at least 17% white margin on EVERY side (left, right, top, bottom). " +
      "The object must be FULLY VISIBLE — nothing cut off, nothing touching or near the border.",
  },
  {
    label: "complex",
    style:
      "VARIATION 3 — MODERATELY COMPLEX DETAILED: Draw the complete object with slightly more detail " +
      "than variation 2 — add secondary features and subtle structural elements. " +
      "A bit richer and more elaborate, but still clean and controlled — not overwhelming. " +
      "Like a detailed technical product illustration with extra refinement. " +
      "NO hatching, NO shading, NO fill, NO crosshatching, NO texture fills. PRESERVE the exact shape. All lines clean and precise. " +
      "CRITICAL FRAMING: The object must occupy NO MORE than 65% of the image width AND height. " +
      "Leave at least 17% white margin on EVERY side (left, right, top, bottom). " +
      "The object must be FULLY VISIBLE — nothing cut off, nothing touching or near the border.",
  },
];

const LANDSCAPE_STYLE_VARIATIONS = [
  {
    label: "simple",
    style:
      "Simple clean landscape outline. Bold horizon line, clear silhouettes of all elements (buildings, trees, mountains, sky). " +
      "Capture the full panoramic scene — foreground, midground, background. " +
      "NO texture, NO hatching, NO shading, NO fill. Clean minimal lines only. " +
      "CRITICAL FRAMING: The entire scene must fit within 75% of the image. Leave at least 10% white margin on every edge.",
  },
  {
    label: "detailed",
    style:
      "Detailed landscape line art. Clear horizon with rich detail in all layers: sky elements (clouds, sun), " +
      "background (mountains, distant buildings), midground (trees, structures), foreground (ground, plants, paths). " +
      "Every visible element drawn with clean distinct lines. NO texture, NO hatching, NO shading, NO fill. " +
      "CRITICAL FRAMING: The entire scene must fit within 75% of the image. Leave at least 10% white margin on every edge.",
  },
  {
    label: "decorative",
    style:
      "Elegant decorative landscape line art. Flowing artistic lines capturing the full scenic view. " +
      "Detailed silhouettes of all scene elements with decorative inner line work. " +
      "NO texture, NO hatching, NO shading, NO fill. " +
      "CRITICAL FRAMING: The entire scene must fit within 75% of the image. Leave at least 10% white margin on every edge.",
  },
];

function buildLandscapePrompt(userPrompt: string, variationIndex: number): string {
  const variation = LANDSCAPE_STYLE_VARIATIONS[variationIndex % LANDSCAPE_STYLE_VARIATIONS.length];
  return (
    // Lead with the absolute no-text rule
    "ABSOLUTE RULE \u2014 NO TEXT, NO LETTERS, NO WORDS, NO NUMBERS, NO LABELS, NO CAPTIONS, NO WATERMARKS ANYWHERE IN THE IMAGE. " +
    "The user's description is WHAT TO DRAW, not what to write. Do NOT render any part of the description as text. " +
    `Clean black and white line art of a landscape scene: ${userPrompt}. ` +
    "Pure white background (#FFFFFF). " +
    "Bold thick black outlines (3-5px stroke width), no fill, no shading, no gradients. " +
    "High contrast: only pure black (#000000) lines on white. " +
    "IMPORTANT: Draw the ENTIRE scene \u2014 all elements visible in the landscape (sky, horizon, buildings, trees, mountains, water, foreground). " +
    "Do NOT focus on a single object \u2014 capture the full panoramic view. " +
    `${variation.style} ` +
    "CRITICAL FRAMING: The entire scene MUST fit completely inside the square frame. " +
    "Scale the scene so it occupies at most 80% of the canvas. " +
    "Leave at least 10% white margin on EVERY edge (top, bottom, left, right). " +
    "NOTHING must touch or go beyond the image border. All elements fully visible, nothing cropped. " +
    "FINAL REMINDER: Zero text, zero letters, zero numbers anywhere. Pure illustration only."
  );
}

/**
 * Detect if the user prompt contains a scene/context keyword alongside an object.
 * e.g. "bluey landscape", "cat in forest", "dog on beach"
 */
function detectObjectAndScene(userPrompt: string): { hasScene: boolean; sceneKeywords: string } {
  const scenePatterns = /\b(landscape|nof|nof teva|nature|forest|beach|mountain|city|jungle|garden|park|ocean|sea|desert|space|sky|field|meadow|river|lake|snow|winter|summer|sunset|sunrise|night|rain|storm|countryside|village|street|urban|indoor|outdoor|background|scene|environment|setting|נוף|יער|חוף|הר|עיר|גן|פארק|ים|מדבר|חלל|שמים|שדה|נהר|אגם|שלג|חורף|קיץ|שקיעה|זריחה|לילה|גשם|כפר|רחוב)\b/i;
  const match = userPrompt.match(scenePatterns);
  return { hasScene: !!match, sceneKeywords: match ? match[0] : "" };
}

function buildLineArtPrompt(userPrompt: string, variationIndex: number): string {
  const variation = STYLE_VARIATIONS[variationIndex % STYLE_VARIATIONS.length];
  const { hasScene } = detectObjectAndScene(userPrompt);

  // If user prompt contains both an object AND a scene (e.g. "bluey landscape"),
  // use the landscape-style prompt to render the object within the scene
  if (hasScene) {
    return (
      "ABSOLUTE RULE \u2014 NO TEXT, NO LETTERS, NO WORDS, NO NUMBERS, NO LABELS, NO CAPTIONS, NO WATERMARKS ANYWHERE IN THE IMAGE. " +
      "The user's description is WHAT TO DRAW, not what to write. Do NOT render any part of the description as text. " +
      `Professional black and white line art illustration: ${userPrompt}. ` +
      "IMPORTANT: If the prompt mentions a specific character, creature, or object (e.g. Bluey, a cat, a dog), " +
      "that character/object MUST be the MAIN FOCUS of the illustration, prominently placed in the scene. " +
      "Draw the character/object INSIDE the described scene/environment. " +
      "Pure white background (#FFFFFF). Bold thick black outlines, no fill, no shading, no gradients. " +
      "High contrast: only pure black (#000000) lines on white. " +
      `${variation.style} ` +
      "CRITICAL FRAMING: The entire scene with the character must fit completely inside the frame. " +
      "Leave at least 10% white margin on every edge. Nothing cropped. " +
      "FINAL REMINDER: Zero text, zero letters, zero numbers anywhere. Pure illustration only."
    );
  }

  return (
    // Lead with the absolute no-text rule so the model cannot ignore it
    "ABSOLUTE RULE \u2014 NO TEXT, NO LETTERS, NO WORDS, NO NUMBERS, NO LABELS, NO CAPTIONS, NO WATERMARKS ANYWHERE IN THE IMAGE. " +
    "The user's description is WHAT TO DRAW, not what to write. Do NOT render any part of the description as text. " +
    `Professional black and white line art illustration of ${userPrompt}. ` +
    "Pure white background (#FFFFFF). " +
    "Bold thick black outlines (3-5px stroke width), no fill, no shading, no gradients. " +
    "High contrast: only pure black (#000000) lines on white. " +
    "CRITICAL FRAMING RULE: The object MUST be scaled small enough to fit entirely within the CENTER of the image. " +
    "The object must occupy NO MORE than 65% of the image width AND height. " +
    "There MUST be at least 17% white empty space on EVERY side (top, bottom, left, right). " +
    "The object must be FULLY VISIBLE \u2014 nothing cut off, nothing touching or near the border. " +
    "Show depth and structure with clear internal lines. " +
    `${variation.style} ` +
    "FINAL REMINDER: Zero text, zero letters, zero numbers anywhere. Pure illustration only."
  );
}

function promptToFilename(prompt: string): string {
  const words = prompt
    .trim()
    .replace(/[^\u0590-\u05FF\w\s]/g, "")
    .split(/\s+/)
    .filter(Boolean);
  let name = "";
  for (const w of words) {
    const next = name ? `${name}_${w}` : w;
    if (next.length > 20) break;
    name = next;
  }
  return (name || "design").slice(0, 20);
}

function pngToSvg(pngBuffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    potrace.trace(pngBuffer, {
      threshold: 180,
      turdSize: 8,
      alphaMax: 1,
      optCurve: true,
      optTolerance: 0.2,
    }, (err: Error | null, svg: string) => {
      if (err) reject(err);
      else resolve(svg);
    });
  });
}

/**
 * Core processing function — runs in background after job is created.
 */
async function runGenerateJob(
  jobId: string,
  prompt: string,
  modifications: string | undefined,
  landscapeMode: boolean,
  appUserId: number,
  ipAnon: string,
  hairline = false,
  lineweightMm?: number,
  minGapMm = 0
) {
  try {
    updateJob(jobId, { status: "processing" });

    const jobCheck = getJob(jobId);
    if (!jobCheck || jobCheck.status === "cancelled") return;

    const fullPrompt = modifications ? `${prompt}. Modifications: ${modifications}` : prompt;
    const baseFilename = promptToFilename(prompt);

    const generationPromises = Array.from({ length: 3 }, async (_, idx) => {
      const imagePrompt = landscapeMode
        ? buildLandscapePrompt(fullPrompt, idx)
        : buildLineArtPrompt(fullPrompt, idx);

      const response = await openai.images.generate({
        model: "gpt-image-1",
        prompt: imagePrompt,
        n: 1,
        size: "1024x1024",
        quality: "medium",
      });

      const imageData = response.data?.[0];
      if (!imageData) throw new Error("לא הצלחנו לייצר תמונה");

      let rawBuffer: Buffer;
      if (imageData.b64_json) {
        rawBuffer = Buffer.from(imageData.b64_json, "base64");
      } else if (imageData.url) {
        const imgResponse = await fetch(imageData.url);
        if (!imgResponse.ok) throw new Error("שגיאה בהורדת התמונה שנוצרה");
        rawBuffer = Buffer.from(await imgResponse.arrayBuffer());
      } else {
        throw new Error("לא התקבלה תמונה מה-AI");
      }

      const paddedBuffer = await sharp(rawBuffer)
        .extend({
          top: 140,
          bottom: 140,
          left: 100,
          right: 100,
          background: { r: 255, g: 255, b: 255, alpha: 1 },
        })
        .resize(1024, 1024, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
        .grayscale()
        .threshold(200)
        .png()
        .toBuffer();

      const rawSvg = await pngToSvg(paddedBuffer);
      const svgContent = rawSvg
        .replace(/fill="[^"]*"/g, 'fill="none"')
        .replace(/fill:[^;"']*(;|(?="))/g, 'fill:none$1')
        .replace(/<path /g, '<path stroke="black" stroke-width="1.5" fill="none" ');
      const cleanSvg = svgContent.replace(/stroke="black" stroke-width="1.5" fill="none" ([^>]*?)fill="none"/g, 'stroke="black" stroke-width="1.5" fill="none" $1');

      const { dxf, segmentCount, width, height, realWidth, realHeight } = svgToDxf(rawSvg, hairline, lineweightMm, minGapMm);

      const imgKey = `ai-generated/${nanoid()}.png`;
      const { url: imageUrl } = await storagePut(imgKey, rawBuffer, "image/png");

      const variation = STYLE_VARIATIONS[idx % STYLE_VARIATIONS.length];
      const dxfFilename = `${baseFilename}_${variation.label}.dxf`;
      const dxfKey = `dxf-ai/${nanoid()}-${dxfFilename}`;
      const { url: dxfUrl } = await storagePut(dxfKey, Buffer.from(dxf, "utf-8"), "application/dxf");

      return { imageUrl, svgPreview: cleanSvg, dxfUrl, dxfFilename, segmentCount, width, height, realWidth, realHeight };
    });

    // Check cancelled after each image
    const images: Array<{ imageUrl: string; svgPreview: string; dxfUrl: string; dxfFilename: string; segmentCount: number; width: number; height: number; realWidth: number; realHeight: number }> = [];
    for (let i = 0; i < 3; i++) {
      const jobMid = getJob(jobId);
      if (!jobMid || jobMid.status === "cancelled") return;
      images.push(await generationPromises[i]);
    }

    const jobAfterGen = getJob(jobId);
    if (!jobAfterGen || jobAfterGen.status === "cancelled") return;

    // Log usage
    const totalSegments = images.reduce((s, img) => s + img.segmentCount, 0);
    void logUsageEvent({
      type: "ai_generate",
      segmentCount: Math.round(totalSegments / images.length),
      ipAnon: anonymizeIp(ipAnon ?? undefined),
    });

    // Record user actions
    const groupId = nanoid(12);
    const variationLabels = landscapeMode
      ? ["simple", "detailed", "decorative"]
      : ["simple", "detailed", "complex"];
    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      void recordUserAction({
        appUserId,
        actionType: "ai_generate",
        description: fullPrompt.slice(0, 200),
        segmentCount: img.segmentCount,
        dxfUrl: img.dxfUrl,
        imageUrl: img.imageUrl,
        svgPreview: img.svgPreview,
        groupId,
        variationLabel: variationLabels[i] ?? `v${i + 1}`,
      });
    }

    updateJob(jobId, { status: "done", result: { success: true, images } });

  } catch (err: unknown) {
    console.error("[generateRoute] Job error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    updateJob(jobId, { status: "error", error: message });
  }
}

// ─── POST /api/generate-images ────────────────────────────────────────────────
router.post("/api/generate-images", async (req, res) => {
  try {
    const { prompt, modifications, landscapeMode, hairline, lineweightMm: lwMmGen, minGapMm: minGapMmRaw } = req.body as {
      prompt?: string;
      modifications?: string;
      landscapeMode?: boolean;
      hairline?: boolean;
      lineweightMm?: number;
      minGapMm?: number;
    };
    const lineweightMmGen = typeof lwMmGen === "number" ? Math.min(2.0, Math.max(0, lwMmGen)) : undefined;
    const minGapMmGen = typeof minGapMmRaw === "number" ? Math.min(3.0, Math.max(0, minGapMmRaw)) : 0;

    if (!prompt || prompt.trim().length < 2) {
      return res.status(400).json({ error: "נא להזין תיאור של התמונה הרצויה" });
    }

    const rawIp = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
    const ipAnon = anonymizeIp(rawIp);
    const appUser = getAppUserFromCookie(req.cookies);

    if (!appUser?.userId) {
      return res.status(401).json({ error: "REGISTRATION_REQUIRED", message: "נדרשת הרשמה כדי ליצור עיצובי AI" });
    }

    const { getDb } = await import("./db");
    const { appUsers } = await import("../drizzle/schema");
    const { eq } = await import("drizzle-orm");
    const dbConn = await getDb();
    if (dbConn) {
      const [userRow] = await dbConn.select({ isBlocked: appUsers.isBlocked }).from(appUsers).where(eq(appUsers.id, appUser.userId)).limit(1);
      if (userRow?.isBlocked) {
        return res.status(403).json({
          error: "USER_BLOCKED",
          message: "חשבונך חסום. לפרטים פנה לרובוטיקה וטכנולוגיה.",
          messageEn: "Your account has been blocked. Please contact Robotics & Technology.",
        });
      }
    }

    const tokenResult = await deductTokens(appUser.userId, "ai_generate", prompt);
    if (!tokenResult.success) {
      return res.status(402).json({
        error: "INSUFFICIENT_TOKENS",
        balance: tokenResult.balance,
        message: "נגמרו לך האסימונים. ליצירת קשר ורכישת אסימונים נוספים פנה לרובוטיקה וטכנולוגיה.",
        messageEn: "You have run out of tokens. To purchase more tokens, contact Robotics & Technology.",
      });
    }

    const jobId = nanoid(12);
    createJob(jobId, appUser.userId, "ai_generate");

    runGenerateJob(jobId, prompt.trim(), modifications, !!landscapeMode, appUser.userId, ipAnon ?? "", !!hairline, lineweightMmGen, minGapMmGen)
      .catch((err) => console.error("[generateRoute] Unhandled job error:", err));

    return res.json({ jobId });

  } catch (err: unknown) {
    console.error("[generate-images]", err);
    const errMsg = err instanceof Error ? err.message : String(err);
    if (errMsg.toLowerCase().includes("quota") || errMsg.toLowerCase().includes("billing")) {
      return res.status(503).json({ error: "SERVICE_UNAVAILABLE", message: "שירות ה-AI אינו זמין כרגע." });
    }
    return res.status(500).json({ error: errMsg });
  }
});

// ─── GET /api/generate-images/job/:jobId ──────────────────────────────────────
router.get("/api/generate-images/job/:jobId", (req, res) => {
  const appUser = getAppUserFromCookie(req.cookies);
  if (!appUser) return res.status(401).json({ error: "UNAUTHORIZED" });

  const job = getJob(req.params.jobId);
  if (!job) return res.status(404).json({ error: "JOB_NOT_FOUND" });
  if (job.userId !== appUser.userId) return res.status(403).json({ error: "FORBIDDEN" });

  if (job.status === "done") {
    return res.json({ status: "done", result: job.result });
  } else if (job.status === "error") {
    return res.json({ status: "error", error: job.error, message: `שגיאה: ${job.error}` });
  } else if (job.status === "cancelled") {
    return res.json({ status: "cancelled" });
  } else {
    return res.json({ status: job.status });
  }
});

// ─── POST /api/generate-images/cancel/:jobId ──────────────────────────────────
router.post("/api/generate-images/cancel/:jobId", async (req, res) => {
  const appUser = getAppUserFromCookie(req.cookies);
  if (!appUser) return res.status(401).json({ error: "UNAUTHORIZED" });

  const job = getJob(req.params.jobId);
  if (!job) return res.status(404).json({ error: "JOB_NOT_FOUND" });
  if (job.userId !== appUser.userId) return res.status(403).json({ error: "FORBIDDEN" });

  if (job.status === "done") {
    return res.json({ cancelled: false, reason: "Job already completed" });
  }

  const wasCancelled = cancelJob(req.params.jobId);
  if (wasCancelled) {
    try {
      await addTokens(appUser.userId, TOKEN_COSTS[(job.tokenAction as TokenAction) || "ai_generate"], "refund", "Job cancelled — tokens refunded");
    } catch (refundErr) {
      console.error("[generateRoute] Refund error:", refundErr);
    }
    return res.json({ cancelled: true });
  }

  return res.json({ cancelled: false, reason: "Job already finished" });
});

export default router;

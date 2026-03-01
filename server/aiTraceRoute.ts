/**
 * AI Trace Route — Two-step pipeline (same quality as AI Generate tab):
 *
 * STEP 1 — POST /api/ai-trace
 *   User uploads photo
 *   → GPT-4o vision analyzes the image and extracts a detailed object description
 *   → gpt-image-1 draws 3 clean B&W line art variations FROM SCRATCH (same as generateRoute)
 *   Returns: { images: Array<{ imageUrl, svgPreview, dxfUrl, ... }> }
 *
 * STEP 2 — POST /api/ai-trace/convert  (kept for backward compat, now just re-converts a PNG)
 *   Accepts a PNG URL and runs potrace → svgToDxf (same as generateRoute)
 *   Returns: { svgPreview, dxfUrl, segmentCount, realWidth, realHeight, filename }
 */

import { Router } from "express";
import multer from "multer";
import sharp from "sharp";
import { storagePut } from "./storage";
import { nanoid } from "nanoid";
import { logUsageEvent, anonymizeIp } from "./usageDb";
import { getAppUserFromCookie } from "./appAuth";
import { recordUserAction } from "./userActionsDb";
import { checkUsageLimit } from "./usageLimits";
import { deductTokens, addTokens, TOKEN_COSTS, TokenAction } from "./tokenService";
import { invokeLLM } from "./_core/llm";
import { createJob, getJob, updateJob, cancelJob } from "./jobStore";
import { svgToDxf } from "./svgToDxf";
import OpenAI from "openai";
import potrace from "potrace";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 16 * 1024 * 1024 } });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY ?? "" });

/** Convert description to safe filename — capped at 15 chars for clean download names */
function buildFilename(description: string): string {
  const words = description
    .replace(/[^\u0590-\u05FFa-zA-Z0-9\s]/g, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  let name = "";
  for (const w of words) {
    const next = name ? `${name}_${w}` : w;
    if (next.length > 15) break;
    name = next;
  }
  return (name || "ai_trace").slice(0, 15);
}

/**
 * Three distinct style variations — same as generateRoute.
 */
const STYLE_VARIATIONS = [
  {
    label: "simple",
    style:
      "Clean professional line art with bold outer contour and key structural lines. " +
      "Show depth and form with 3-5 internal lines indicating main surfaces and edges. " +
      "Technical illustration style — like a product blueprint or engineering drawing. " +
      "NO texture, NO hatching, NO shading, NO fill. Pure black lines on white.",
  },
  {
    label: "detailed",
    style:
      "Highly detailed professional line art. Bold outer contour with rich internal line work " +
      "showing all structural features, surfaces, depth cues, and fine details. " +
      "Like a professional technical illustration or detailed product drawing. " +
      "NO texture, NO hatching, NO shading, NO fill. Clean distinct lines only.",
  },
  {
    label: "decorative",
    style:
      "Elegant decorative line art with artistic flair. Bold outer contour with flowing " +
      "decorative inner lines. Ornamental, architectural, or art nouveau style. " +
      "Rich detail suitable for laser engraving on wood or metal. " +
      "NO texture, NO hatching, NO shading, NO fill. All lines clean and precise.",
  },
];

function buildFullImagePrompt(sceneDescription: string, variationIndex: number): string {
  const variation = STYLE_VARIATIONS[variationIndex % STYLE_VARIATIONS.length];
  return (
    `Professional black and white line art of the following scene: ${sceneDescription}. ` +
    "Pure white background (#FFFFFF). " +
    "Bold thick black outlines, no fill, no shading, no gradients. " +
    "High contrast: only pure black (#000000) lines on white. " +
    "CRITICAL: Draw ALL elements visible in the image EXACTLY as described — every object, decoration, symbol, and detail in their correct positions and proportions. " +
    "Do NOT substitute or replace any element with a generic version. Draw the SPECIFIC items described. " +
    `${variation.style} ` +
    "The entire composition MUST fit completely inside the square frame with white margin on all sides. " +
    "Leave at least 5% white margin on every edge. All elements fully visible, nothing cropped. " +
    "DO NOT include any text, letters, words, numbers, labels, or captions anywhere in the image. " +
    "No watermarks, no grey tones."
  );
}

/**
 * Generate 5 contextual improvement suggestions based on the identified object.
 * Suggestions are in the user's UI language (he/en).
 * Also includes suggestions for other objects detected in the image.
 */
async function generateImprovementSuggestions(
  objectDescription: string,
  imageBase64: string,
  lang: "he" | "en"
): Promise<string[]> {
  try {
    const isHebrew = lang === "he";
    const systemPrompt = isHebrew
      ? "אתה עוזר יצירתי שמסייע למשתמשים לשפר עיצובי קו לחריטת CNC/לייזר. " +
        "בהינתן תיאור של אובייקט ותמונה מקורית, צור 5 הצעות שיפור קצרות וספציפיות. " +
        "3 הצעות יתייחסו לאובייקט הראשי (שינוי סגנון, הוספת פרטים, גרסה שונה). " +
        "2 הצעות יתייחסו לאובייקטים/פרטים נוספים שרואים בתמונה (למשל: 'רק הנדנדה', 'הוסף את הכיסא'). " +
        "כל הצעה: 2-5 מילים בעברית. " +
        "פלט JSON בלבד: {\"suggestions\": [\"...\", ...]}"
      : "You are a creative assistant helping users refine line art designs for CNC/laser engraving. " +
        "Given an object description and the original image, generate 5 short specific improvement suggestions. " +
        "3 suggestions should modify the main object (style change, add details, different version). " +
        "2 suggestions should reference other objects/elements visible in the image (e.g. 'only the swing', 'add the chair'). " +
        "Each suggestion: 2-5 words in English. " +
        "Output JSON only: {\"suggestions\": [\"...\", ...]}";

    const userPrompt = isHebrew
      ? `צור 5 הצעות שיפור לאובייקט הזה: ${objectDescription}`
      : `Generate 5 improvement suggestions for this object: ${objectDescription}`;

    const response = await invokeLLM({
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: `data:image/jpeg;base64,${imageBase64}`, detail: "low" },
            },
            { type: "text", text: userPrompt },
          ],
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "suggestions",
          strict: true,
          schema: {
            type: "object",
            properties: {
              suggestions: { type: "array", items: { type: "string" } },
            },
            required: ["suggestions"],
            additionalProperties: false,
          },
        },
      },
    });
    const content = (response as { choices?: Array<{ message?: { content?: string } }> })
      ?.choices?.[0]?.message?.content;
    if (content) {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed.suggestions)) {
        return parsed.suggestions.slice(0, 5);
      }
    }
  } catch (e) {
    console.warn("[aiTrace] Failed to generate suggestions:", e);
  }
  return [];
}

function buildLineArtPrompt(objectDescription: string, variationIndex: number): string {
  const variation = STYLE_VARIATIONS[variationIndex % STYLE_VARIATIONS.length];
  return (
    `Professional black and white line art illustration of ${objectDescription}. ` +
    "CRITICAL: Reproduce the EXACT pose, facing direction, and orientation described above — do NOT mirror, rotate, or change the direction of any figure or object. " +
    "Pure white background (#FFFFFF). " +
    "Bold thick black outlines (3-5px stroke width), no fill, no shading, no gradients. " +
    "High contrast: only pure black (#000000) lines on white. " +
    "CRITICAL FRAMING RULE: The object MUST be scaled small enough to fit entirely within the CENTER of the image. " +
    "The object must occupy NO MORE than 65% of the image width AND height. " +
    "There MUST be at least 17% white empty space on EVERY side (top, bottom, left, right). " +
    "The object must be FULLY VISIBLE — nothing cut off, nothing touching or near the border. " +
    "Show depth and structure with clear internal lines. " +
    `${variation.style} ` +
    "Single centered object, complete, fully inside the frame, with generous white margin around it. " +
    "DO NOT include any text, letters, words, numbers, labels, or captions anywhere in the image. " +
    "No watermarks, no grey tones, no background elements."
  );
}

/**
 * Convert a PNG buffer to SVG using potrace.
 * Same function as in generateRoute.
 */
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

// ─── Background job runner for AI Trace ──────────────────────────────────────
async function runTraceJob(
  jobId: string,
  imageBuffer: Buffer,
  imageBase64: string,
  userDesc: string,
  focusText: string,
  landscapeMode: boolean,
  lang: "he" | "en",
  appUserId: number,
  ipAnon: string
) {
  try {
    updateJob(jobId, { status: "processing" });
    const jobCheck = getJob(jobId);
    if (!jobCheck || jobCheck.status === "cancelled") return;

    // Step A: LLM analyzes image
    let analysisInstruction: string;
    if (landscapeMode) {
      analysisInstruction = focusText
        ? `Describe this landscape scene for line art generation, focusing on: "${focusText}". Include ALL visible elements: sky, horizon, background, midground, foreground. Describe the full panoramic composition. Output ONLY the description (3-5 sentences), no preamble.`
        : "Describe this landscape/scene for line art generation. Include ALL visible elements: sky, horizon, background (mountains/buildings), midground (trees/structures), foreground (ground/plants). Describe the full panoramic composition. Output ONLY the description (3-5 sentences), no preamble.";
    } else if (focusText) {
      analysisInstruction = `The user wants to draw: "${focusText}". Describe ONLY that specific element from the image in detail for line art generation. Focus on its shape, structure, key features, style, and proportions. Output ONLY the description (2-4 sentences), no preamble.`;
    } else {
      analysisInstruction = userDesc
        ? `Describe the main object for line art generation. Additional context: ${userDesc}`
        : "Describe the main/dominant object in this image for line art generation.";
    }

    const llmResponse = await invokeLLM({
      messages: [
        {
          role: "system",
          content:
            "You are an expert at describing objects and figures for line art generation. " +
            "Analyze the image and provide a precise description for generating clean line art that EXACTLY matches the original. " +
            "CRITICAL — you MUST describe: " +
            "(1) The exact facing direction of any person/animal/figure (facing left, facing right, facing forward, facing backward, profile view, 3/4 view, etc.). " +
            "(2) The exact body pose and position (standing, sitting, crouching, arms raised, arms at sides, walking, etc.). " +
            "(3) The exact orientation of all objects (which way they face, tilt angle, perspective). " +
            "(4) Key structural features, proportions, and distinctive details. " +
            "Output ONLY the description (3-5 sentences), no preamble. Be specific about directions.",
        },
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}`, detail: "high" } },
            { type: "text", text: analysisInstruction },
          ],
        },
      ],
    });

    const jobAfterLlm = getJob(jobId);
    if (!jobAfterLlm || jobAfterLlm.status === "cancelled") return;

    const objectDescription =
      (llmResponse as { choices?: Array<{ message?: { content?: string } }> })
        ?.choices?.[0]?.message?.content?.trim() ||
      userDesc ||
      "the object in the image";

    const baseFilename = buildFilename(userDesc || objectDescription);

    // Step B: Generate 3 line art variations using gpt-image-1
    const generationPromises = Array.from({ length: 3 }, async (_, idx) => {
      const imagePrompt = landscapeMode
        ? buildFullImagePrompt(objectDescription, idx)
        : buildLineArtPrompt(objectDescription, idx);

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

      // Add white padding around the AI-generated image, then resize to max 1400px
      // while PRESERVING the aspect ratio (fit: inside) so nothing gets cropped.
      const processedBuffer = await sharp(rawBuffer)
        .extend({ top: 120, bottom: 120, left: 80, right: 80, background: { r: 255, g: 255, b: 255, alpha: 1 } })
        .resize(1400, 1400, { fit: "inside", background: { r: 255, g: 255, b: 255, alpha: 1 } })
        .grayscale()
        .threshold(200)
        .png()
        .toBuffer();

      const rawSvg = await pngToSvg(processedBuffer);
      const svgContent = rawSvg
        .replace(/fill="[^"]*"/g, 'fill="none"')
        .replace(/fill:[^;"']*(;|(?="))/g, 'fill:none$1')
        .replace(/<path /g, '<path stroke="black" stroke-width="1.5" fill="none" ');
      const cleanSvg = svgContent.replace(
        /stroke="black" stroke-width="1.5" fill="none" ([^>]*?)fill="none"/g,
        'stroke="black" stroke-width="1.5" fill="none" $1'
      );

      const { dxf, segmentCount, width, height, realWidth, realHeight } = svgToDxf(rawSvg);
      const imgKey = `ai-trace-generated/${nanoid()}.png`;
      const { url: imageUrl } = await storagePut(imgKey, rawBuffer, "image/png");
      const variation = STYLE_VARIATIONS[idx % STYLE_VARIATIONS.length];
      const dxfFilename = `${baseFilename}_${variation.label}.dxf`;
      const dxfKey = `ai-trace-dxf/${nanoid()}-${dxfFilename}`;
      const { url: dxfUrl } = await storagePut(dxfKey, Buffer.from(dxf, "utf-8"), "application/dxf");

      return { imageUrl, svgPreview: cleanSvg, dxfUrl, dxfFilename, segmentCount, width, height, realWidth, realHeight };
    });

    // Check cancelled before image gen
    const jobBeforeGen = getJob(jobId);
    if (!jobBeforeGen || jobBeforeGen.status === "cancelled") return;

    const [images, suggestions] = await Promise.all([
      Promise.all(generationPromises),
      generateImprovementSuggestions(objectDescription, imageBase64, lang),
    ]);

    const jobAfterGen = getJob(jobId);
    if (!jobAfterGen || jobAfterGen.status === "cancelled") return;

    // Log usage
    const totalSegments = images.reduce((s, img) => s + img.segmentCount, 0);
    void logUsageEvent({
      type: "ai_generate",
      segmentCount: Math.round(totalSegments / images.length),
      ipAnon: anonymizeIp(ipAnon),
    });

    // Record user actions
    const groupId = nanoid(12);
    const variationLabels = landscapeMode ? ["simple", "detailed", "decorative"] : ["simple", "detailed", "decorative"];
    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      void recordUserAction({
        appUserId,
        actionType: "ai_generate",
        description: objectDescription.slice(0, 200),
        segmentCount: img.segmentCount,
        dxfUrl: img.dxfUrl,
        imageUrl: img.imageUrl,
        svgPreview: img.svgPreview,
        groupId,
        variationLabel: variationLabels[i] ?? `v${i + 1}`,
      });
    }

    updateJob(jobId, { status: "done", result: { success: true, images, objectDescription, suggestions } });

  } catch (err: unknown) {
    console.error("[aiTraceRoute] Job error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    updateJob(jobId, { status: "error", error: message });
  }
}

// ─── STEP 1: Analyze image with LLM → draw from scratch with gpt-image-1 ──────

router.post(
  "/api/ai-trace",
  upload.single("image"),
  async (req, res) => {
    try {
      // ── Auth check ────────────────────────────────────────────────────────────
      const appUser = getAppUserFromCookie(req.cookies);
      if (!appUser) {
        return res.status(401).json({
          error: "UNAUTHORIZED",
          message: "יש להתחבר כדי להשתמש ב-AI Trace",
          messageEn: "Please log in to use AI Trace",
        });
      }

      // ── Block check ───────────────────────────────────────────────────────────
      const { getDb } = await import("./db");
      const { appUsers } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (db) {
        const [userRow] = await db.select({ isBlocked: appUsers.isBlocked }).from(appUsers).where(eq(appUsers.id, appUser.userId)).limit(1);
        if (userRow?.isBlocked) {
          return res.status(403).json({
            error: "USER_BLOCKED",
            message: "חשבונך חסום. לפרטים פנה לרובוטיקה וטכנולוגיה.",
            messageEn: "Your account has been blocked. Please contact Robotics & Technology.",
          });
        }
      }

      // ── Token check & deduction ───────────────────────────────────────────────
      const tokenResult = await deductTokens(appUser.userId, "ai_trace");
      if (!tokenResult.success) {
        return res.status(402).json({
          error: "INSUFFICIENT_TOKENS",
          balance: tokenResult.balance,
          message: "נגמרו לך האסימונים. ליצירת קשר ורכישת אסימונים נוספים פנה לרובוטיקה וטכנולוגיה.",
          messageEn: "You have run out of tokens. To purchase more tokens, contact Robotics & Technology.",
        });
      }

      // ── Get image buffer ──────────────────────────────────────────────────────
      let imageBuffer: Buffer;
      if (req.file) {
        imageBuffer = req.file.buffer;
      } else if (req.body?.imageUrl) {
        const response = await fetch(req.body.imageUrl);
        imageBuffer = Buffer.from(await response.arrayBuffer());
      } else {
        return res.status(400).json({ error: "NO_IMAGE", message: "לא סופקה תמונה" });
      }

      // Resize for LLM analysis
      const resized = await sharp(imageBuffer)
        .resize(512, 512, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer();
      const imageBase64 = resized.toString("base64");

      const userDesc = (req.body?.description || "").trim();
      const focusText = (req.body?.focusText || "").trim();
      const landscapeMode = req.body?.landscapeMode === "true" || req.body?.landscapeMode === true;
      const lang = ((req.body?.lang as string) || "en") === "he" ? "he" : "en";
      const rawIp = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
      const ipAnon = anonymizeIp(rawIp);

      // Create job and start background processing
      const jobId = nanoid(12);
      createJob(jobId, appUser.userId, "ai_trace");

      runTraceJob(jobId, imageBuffer, imageBase64, userDesc, focusText, landscapeMode, lang, appUser.userId, ipAnon ?? "")
        .catch((err) => console.error("[aiTraceRoute] Unhandled job error:", err));

      return res.json({ jobId });

    } catch (err: unknown) {
      console.error("[aiTraceRoute] Step 1 Error:", err);
      const message = err instanceof Error ? err.message : "Unknown error";
      if (message.includes("429") || message.includes("quota") || message.includes("billing")) {
        return res.status(429).json({
          error: "OPENAI_QUOTA",
          message: "שגיאת מכסה ב-AI. נסה שוב מאוחר יותר.",
          messageEn: "AI quota error. Please try again later.",
        });
      }
      return res.status(500).json({
        error: "INTERNAL_ERROR",
        message: `שגיאה פנימית: ${message}`,
        messageEn: `Internal error: ${message}`,
      });
    }
  }
);

// ─── GET /api/ai-trace/job/:jobId ─────────────────────────────────────────────
router.get("/api/ai-trace/job/:jobId", (req, res) => {
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

// ─── POST /api/ai-trace/cancel/:jobId ─────────────────────────────────────────
router.post("/api/ai-trace/cancel/:jobId", async (req, res) => {
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
      await addTokens(appUser.userId, TOKEN_COSTS[(job.tokenAction as TokenAction) || "ai_trace"], "refund", "Job cancelled — tokens refunded");
    } catch (refundErr) {
      console.error("[aiTraceRoute] Refund error:", refundErr);
    }
    return res.json({ cancelled: true });
  }

  return res.json({ cancelled: false, reason: "Job already finished" });
});

// ─── STEP 2 (legacy): Re-convert a PNG to DXF using potrace ───────────────────
// Kept for backward compatibility. Now uses potrace → svgToDxf (same as generateRoute).

router.post(
  "/api/ai-trace/convert",
  async (req, res) => {
    try {
      const appUser = getAppUserFromCookie(req.cookies);
      if (!appUser) {
        return res.status(401).json({ error: "UNAUTHORIZED", message: "יש להתחבר" });
      }

      const { previewPngUrl, previewPngBase64, description, imageUrl } = req.body;

      let pngBuffer: Buffer;
      if (previewPngBase64) {
        const base64Data = previewPngBase64.includes(",")
          ? previewPngBase64.split(",")[1]
          : previewPngBase64;
        pngBuffer = Buffer.from(base64Data, "base64");
      } else if (previewPngUrl) {
        const response = await fetch(previewPngUrl);
        pngBuffer = Buffer.from(await response.arrayBuffer());
      } else {
        return res.status(400).json({ error: "NO_PNG", message: "לא סופק PNG לעיבוד" });
      }

      // Pre-process and run potrace (same as generateRoute)
      const processedBuffer = await sharp(pngBuffer)
        .grayscale()
        .threshold(200)
        .png()
        .toBuffer();

      const rawSvg = await pngToSvg(processedBuffer);
      const svgContent = rawSvg
        .replace(/fill="[^"]*"/g, 'fill="none"')
        .replace(/fill:[^;"']*(;|(?="))/g, 'fill:none$1')
        .replace(/<path /g, '<path stroke="black" stroke-width="1.5" fill="none" ');
      const svgPreview = svgContent.replace(
        /stroke="black" stroke-width="1.5" fill="none" ([^>]*?)fill="none"/g,
        'stroke="black" stroke-width="1.5" fill="none" $1'
      );

      const { dxf, segmentCount, realWidth, realHeight } = svgToDxf(rawSvg);

      const desc = description || "ai_trace";
      const filename = buildFilename(desc);
      const dxfKey = `ai-trace-dxf/${nanoid()}.dxf`;
      const { url: dxfUrl } = await storagePut(dxfKey, Buffer.from(dxf, "utf-8"), "application/dxf");

      await recordUserAction({
        appUserId: appUser.userId,
        actionType: "ai_generate",
        description: desc,
        segmentCount,
        dxfUrl,
        imageUrl: imageUrl || previewPngUrl,
        svgPreview,
      });

      return res.json({
        svgPreview,
        dxfUrl,
        segmentCount,
        realWidth,
        realHeight,
        filename: `${filename}.dxf`,
      });
    } catch (err: unknown) {
      console.error("[aiTraceRoute] Step 2 Error:", err);
      const message = err instanceof Error ? err.message : "Unknown error";
      return res.status(500).json({
        error: "INTERNAL_ERROR",
        message: `שגיאת המרה: ${message}`,
        messageEn: `Conversion error: ${message}`,
      });
    }
  }
);

export default router;

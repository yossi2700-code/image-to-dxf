/**
 * faceDetectRoute.ts — Portrait generation pipeline.
 *
 * POST /api/face-detect/start  — Start a portrait job (returns { jobId })
 * GET  /api/face-detect/job/:jobId — Poll job status
 * POST /api/face-detect/cancel/:jobId — Cancel a running job
 *
 * Pipeline:
 *   A. Resize source image for gpt-image-1 edit API
 *   B. Generate 3 portrait variations in parallel (chosen style + 2 adjacent)
 *   C. For each: potrace → SVG → DXF
 *   D. Generate AI suggestions for refinement
 */
import { Router } from "express";
import multer from "multer";
import sharp from "sharp";
import { storagePut } from "./storage";
import { nanoid } from "nanoid";
import { logUsageEvent, anonymizeIp } from "./usageDb";
import { getAppUserFromCookie } from "./appAuth";
import { recordUserAction } from "./userActionsDb";
import { deductTokens, addTokens, TOKEN_COSTS, TokenAction } from "./tokenService";
import { createJob, getJob, updateJob, cancelJob, heartbeatJob } from "./jobStore";
import { svgToDxf } from "./svgToDxf";
import { cleanSvgForPreview } from "./svgClean";
import { invokeLLM } from "./_core/llm";
import OpenAI from "openai";
import potrace from "potrace";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 16 * 1024 * 1024 } });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY ?? "" });

// ─── Portrait styles ──────────────────────────────────────────────────────────
export type PortraitStyle = "simple" | "detailed";

const PORTRAIT_STYLE_PROMPTS: Record<PortraitStyle, string> = {
  simple:
    "You are a forensic portrait artist. Your task is to trace this exact person's face as a clean line art drawing. " +
    "IDENTITY PRESERVATION IS THE #1 PRIORITY: You must faithfully reproduce THIS specific person's unique facial features — " +
    "their exact jawline shape, brow ridge height and shape, eye shape and spacing, nose bridge width and tip shape, " +
    "lip thickness and shape, cheekbone prominence, forehead height, ear shape, and any beard/stubble pattern. " +
    "Do NOT draw a generic face — draw THIS person. The result must be recognizable as the same individual. " +
    "Technique: Clean bold black outlines on pure white (#FFFFFF) background. " +
    "No fill, no shading, no grey tones, no gradients — only pure black (#000000) lines. " +
    "Draw ONLY the face and head — crop out all clothing and background. " +
    "Include: outer face contour, hairline and hair silhouette, eyes with pupils and lashes, " +
    "eyebrows matching the person's exact shape, nose, lips, ears, neck. " +
    "If the person has a beard or stubble, draw it accurately with short lines matching the growth pattern. " +
    "Lines should be smooth and confident. Hair as clean outline with minimal interior lines. " +
    "Face must occupy 65-75% of image. Entire head fully visible, nothing cropped. " +
    "DO NOT include any text, labels, watermarks, or decorative elements.",

  detailed:
    "You are a master forensic portrait artist. Your task is to trace this exact person's face as a detailed line art drawing. " +
    "IDENTITY PRESERVATION IS THE #1 PRIORITY: You must faithfully reproduce THIS specific person's unique facial features — " +
    "their exact jawline shape, brow ridge height and shape, eye shape and spacing, nose bridge width and tip shape, " +
    "lip thickness and shape, cheekbone prominence, forehead height, ear shape, and any beard/stubble pattern. " +
    "Do NOT draw a generic face — draw THIS person. The result must be recognizable as the same individual. " +
    "Technique: Precise black lines on pure white (#FFFFFF) background. " +
    "No fill, no shading, no grey tones — only pure black (#000000) lines. " +
    "Draw ONLY the face and head — crop out all clothing and background. " +
    "Include: precise outer face contour, detailed hair with strand lines, " +
    "eyes with iris detail, pupils, lashes, eyelid folds and under-eye lines, " +
    "eyebrows with individual hair strokes matching the person's exact brow shape, " +
    "detailed nose with bridge, nostrils, and tip shape, " +
    "lips with cupid's bow and philtrum, ears with inner structure, neck with muscle lines. " +
    "If the person has a beard or stubble, draw it accurately with detailed short lines following the growth direction. " +
    "Add subtle lines for cheekbone definition, jaw structure, nasolabial folds if present. " +
    "Face must occupy 65-75% of image. Entire head fully visible, nothing cropped. " +
    "DO NOT include any text, labels, watermarks, or decorative elements.",
};

const STYLE_ORDER: PortraitStyle[] = ["simple", "detailed"];

const STYLE_LABELS: Record<PortraitStyle, { he: string; en: string }> = {
  simple: { he: "פשוט", en: "Simple" },
  detailed: { he: "מפורט", en: "Detailed" },
};

// ─── Potrace helper ───────────────────────────────────────────────────────────
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

// ─── Generate one portrait variation ─────────────────────────────────────────
type PortraitResult = {
  imageUrl: string;
  svgPreview: string;
  dxfUrl: string;
  dxfFilename: string;
  segmentCount: number;
  width: number;
  height: number;
  realWidth: number;
  realHeight: number;
  style: PortraitStyle;
  styleLabel: string;
  styleLabelEn: string;
};

async function generatePortraitVariation(
  editSourceBuffer: Buffer,
  style: PortraitStyle,
  hairline: boolean,
  lineweightMm: number | undefined,
  minGapMm: number
): Promise<PortraitResult> {
  const { toFile } = await import("openai");
  const editFile = await toFile(editSourceBuffer, "face.png", { type: "image/png" });
  const editPrompt = PORTRAIT_STYLE_PROMPTS[style];

  const response = await openai.images.edit({
    model: "gpt-image-1",
    image: editFile,
    prompt: editPrompt,
    n: 1,
    size: "1024x1024",
    quality: "medium",
  });

  const imageData = response.data?.[0];
  if (!imageData) throw new Error("Failed to generate image for style: " + style);

  let rawBuffer: Buffer;
  if (imageData.b64_json) {
    rawBuffer = Buffer.from(imageData.b64_json, "base64");
  } else if (imageData.url) {
    const imgResponse = await fetch(imageData.url);
    if (!imgResponse.ok) throw new Error("Failed to download generated image");
    rawBuffer = Buffer.from(await imgResponse.arrayBuffer());
  } else {
    throw new Error("No image returned from AI");
  }

  // Potrace → SVG → DXF
  const processedBuffer = await sharp(rawBuffer)
    .extend({ top: 60, bottom: 60, left: 60, right: 60, background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .resize(1024, 1024, { fit: "inside", background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .grayscale()
    .threshold(200)
    .png()
    .toBuffer();

  const rawSvg = await pngToSvg(processedBuffer);
  const cleanSvg = cleanSvgForPreview(rawSvg);

  const { dxf, segmentCount, width, height, realWidth, realHeight } = svgToDxf(rawSvg, hairline, lineweightMm, minGapMm);

  const imgKey = `face-detect-generated/${nanoid()}.png`;
  const { url: imageUrl } = await storagePut(imgKey, rawBuffer, "image/png");
  const dxfFilename = `face_portrait_${style}.dxf`;
  const dxfKey = `face-detect-dxf/${nanoid()}-${dxfFilename}`;
  const { url: dxfUrl } = await storagePut(dxfKey, Buffer.from(dxf, "utf-8"), "application/dxf");

  return {
    imageUrl,
    svgPreview: cleanSvg,
    dxfUrl,
    dxfFilename,
    segmentCount,
    width,
    height,
    realWidth,
    realHeight,
    style,
    styleLabel: STYLE_LABELS[style].he,
    styleLabelEn: STYLE_LABELS[style].en,
  };
}

// ─── Generate AI suggestions ──────────────────────────────────────────────────
async function generateAiSuggestions(style: PortraitStyle, lang: "he" | "en"): Promise<string[]> {
  const isHe = lang === "he";
  try {
    const systemPrompt = isHe
      ? "אתה עוזר לשיפור תמונות קו לחריטת לייזר/CNC. הצע 3 שיפורים קצרים וספציפיים לפורטרט שנוצר. כל הצעה עד 6 מילים. החזר JSON בלבד: {\"suggestions\": [\"...\", \"...\", \"...\"]}"
      : "You help improve line art portraits for laser/CNC engraving. Suggest 3 short specific improvements for the generated portrait. Each suggestion max 6 words. Return JSON only: {\"suggestions\": [\"...\", \"...\", \"...\"]}";
    const styleName = STYLE_LABELS[style][isHe ? "he" : "en"];
    const userMsg = isHe
      ? `הפורטרט נוצר בסגנון: ${styleName}. הצע 3 שיפורים ספציפיים לחריטת CNC/לייזר.`
      : `Portrait was generated in style: ${styleName}. Suggest 3 specific improvements for CNC/laser engraving.`;

    const response = await invokeLLM({
      messages: [
        { role: "system" as const, content: systemPrompt },
        { role: "user" as const, content: userMsg },
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

    const rawContent = response.choices?.[0]?.message?.content;
    const content = typeof rawContent === "string" ? rawContent : null;
    if (!content) return [];
    const parsed = JSON.parse(content) as { suggestions: string[] };
    return parsed.suggestions?.slice(0, 3) ?? [];
  } catch {
    return isHe
      ? ["עבה קווים", "הוסף פרטים לעיניים", "חדד קווי מתאר"]
      : ["Thicken lines", "Add eye detail", "Sharpen outlines"];
  }
}

// ─── Background job runner ────────────────────────────────────────────────────
async function runFaceDetectJob(
  jobId: string,
  imageBuffer: Buffer,
  lang: "he" | "en",
  appUserId: number,
  ipAnon: string,
  style: PortraitStyle = "simple",
  sourceImageUrl?: string,
  hairline = false,
  lineweightMm?: number,
  minGapMm = 0
) {
  const isHe = lang === "he";
  let heartbeatInterval: ReturnType<typeof setInterval> | undefined;
  try {
    updateJob(jobId, {
      status: "processing",
      step: isHe ? "מצייר פורטרט..." : "Drawing portrait...",
      stepEn: "Drawing portrait...",
      partialImages: [],
    });

    const jobCheck = getJob(jobId);
    if (!jobCheck || jobCheck.status === "cancelled") return;

    // ── Step A: Prepare source image ──────────────────────────────────────────
    const editSourceBuffer = await sharp(imageBuffer)
      .resize(512, 512, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .png({ compressionLevel: 6 })
      .toBuffer();

    // ── Step B: Generate 1 portrait for the chosen style ────────────────────
    heartbeatInterval = setInterval(() => heartbeatJob(jobId), 30_000);

    const portraitResult = await generatePortraitVariation(editSourceBuffer, style, hairline, lineweightMm, minGapMm);

    if (heartbeatInterval) { clearInterval(heartbeatInterval); heartbeatInterval = undefined; }

    const jobAfterGen = getJob(jobId);
    if (!jobAfterGen || jobAfterGen.status === "cancelled") return;

    const images = [portraitResult];

    // ── Step C: AI suggestions ────────────────────────────────────────────────
    updateJob(jobId, {
      step: isHe ? "מייצר הצעות שיפור..." : "Generating suggestions...",
      stepEn: "Generating suggestions...",
    });

    const suggestions = await generateAiSuggestions(style, lang);

    // ── Step D: Log & finish ──────────────────────────────────────────────────
    void logUsageEvent({
      type: "ai_generate",
      segmentCount: images[0]?.segmentCount ?? 0,
      ipAnon: anonymizeIp(ipAnon),
    });

    const groupId = nanoid(12);
    for (const img of images) {
      void recordUserAction({
        appUserId,
        actionType: "ai_generate",
        description: `face_detect: ${img.style} portrait line art`,
        segmentCount: img.segmentCount,
        dxfUrl: img.dxfUrl,
        imageUrl: img.imageUrl,
        svgPreview: img.svgPreview,
        groupId,
        variationLabel: `portrait_${img.style}`,
        sourceImageUrl: sourceImageUrl ?? undefined,
        feature: "portrait",
      });
    }

    updateJob(jobId, {
      status: "done",
      result: { success: true, images, suggestions },
    });
  } catch (err: unknown) {
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    console.error("[faceDetectRoute] Job error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    updateJob(jobId, { status: "error", error: message });
  }
}

// ─── POST /api/face-detect/start ─────────────────────────────────────────────
router.post(
  "/api/face-detect/start",
  upload.single("image"),
  async (req, res) => {
    try {
      const appUser = getAppUserFromCookie(req.cookies);
      if (!appUser) {
        return res.status(401).json({
          error: "UNAUTHORIZED",
          message: "יש להתחבר כדי להשתמש בזיהוי פנים",
          messageEn: "Please log in to use face detection",
        });
      }

      // Block check
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
            messageEn: "Your account has been blocked.",
          });
        }
      }

      // Token check & deduction
      const tokenResult = await deductTokens(appUser.userId, "face_detect");
      if (!tokenResult.success) {
        return res.status(402).json({
          error: "INSUFFICIENT_TOKENS",
          balance: tokenResult.balance,
          message: "נגמרו לך האסימונים. ליצירת קשר ורכישת אסימונים נוספים פנה לרובוטיקה וטכנולוגיה.",
          messageEn: "You have run out of tokens. Contact Robotics & Technology to purchase more.",
        });
      }

      // Get image buffer
      let imageBuffer: Buffer;
      if (req.file) {
        imageBuffer = req.file.buffer;
      } else if (req.body?.imageUrl) {
        const response = await fetch(req.body.imageUrl);
        imageBuffer = Buffer.from(await response.arrayBuffer());
      } else {
        return res.status(400).json({ error: "NO_IMAGE", message: "לא סופקה תמונה" });
      }

      // Auto-correct EXIF orientation
      imageBuffer = await sharp(imageBuffer).rotate().toBuffer();

      const lang = ((req.body?.lang as string) || "he") === "he" ? "he" : "en";
      const hairline = req.body?.hairline === "true" || req.body?.hairline === true;
      const lineweightMmRaw = parseFloat((req.body?.lineweightMm as string) ?? "");
      const lineweightMm = isNaN(lineweightMmRaw) ? undefined : Math.min(2.0, Math.max(0, lineweightMmRaw));
      const minGapMmRaw = parseFloat((req.body?.minGapMm as string) ?? "");
      const minGapMm = isNaN(minGapMmRaw) ? 0 : Math.min(3.0, Math.max(0, minGapMmRaw));
      const styleRaw = (req.body?.style as string) ?? "simple";
      const style: PortraitStyle = (["simple", "detailed"] as const).includes(styleRaw as PortraitStyle)
        ? (styleRaw as PortraitStyle)
        : "simple";

      const rawIp = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
      const ipAnon = anonymizeIp(rawIp);

      // Upload original image to S3
      let uploadedSourceImageUrl: string | undefined;
      try {
        const srcKey = `face-detect-source/${appUser.userId}-${nanoid(8)}.jpg`;
        const jpegBuf = await sharp(imageBuffer)
          .resize(800, 800, { fit: "inside", withoutEnlargement: true })
          .jpeg({ quality: 85 })
          .toBuffer();
        const { url } = await storagePut(srcKey, jpegBuf, "image/jpeg");
        uploadedSourceImageUrl = url;
      } catch (e) {
        console.warn("[faceDetectRoute] Failed to upload source image:", e);
      }

      // Create job and start background processing
      const jobId = nanoid(12);
      createJob(jobId, appUser.userId, "face_detect");
      runFaceDetectJob(jobId, imageBuffer, lang, appUser.userId, ipAnon ?? "", style, uploadedSourceImageUrl, hairline, lineweightMm, minGapMm)
        .catch((err) => console.error("[faceDetectRoute] Unhandled job error:", err));

      return res.json({ jobId });
    } catch (err: unknown) {
      console.error("[faceDetectRoute] Start error:", err);
      const message = err instanceof Error ? err.message : "Unknown error";
      return res.status(500).json({
        error: "INTERNAL_ERROR",
        message: `שגיאה פנימית: ${message}`,
        messageEn: `Internal error: ${message}`,
      });
    }
  }
);

// ─── GET /api/face-detect/job/:jobId ─────────────────────────────────────────
router.get("/api/face-detect/job/:jobId", (req, res) => {
  const appUser = getAppUserFromCookie(req.cookies);
  if (!appUser) return res.status(401).json({ error: "UNAUTHORIZED" });
  const job = getJob(req.params.jobId);
  if (!job) return res.status(404).json({ error: "JOB_NOT_FOUND" });
  if (job.userId !== appUser.userId) return res.status(403).json({ error: "FORBIDDEN" });
  if (job.status === "done") {
    return res.json({ status: "done", result: job.result });
  } else if (job.status === "error") {
    return res.json({ status: "error", error: job.error, message: job.error });
  } else if (job.status === "cancelled") {
    return res.json({ status: "cancelled" });
  } else {
    return res.json({
      status: job.status,
      step: job.step,
      stepEn: job.stepEn,
      partialImages: job.partialImages ?? [],
    });
  }
});

// ─── POST /api/face-detect/cancel/:jobId ─────────────────────────────────────
router.post("/api/face-detect/cancel/:jobId", async (req, res) => {
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
      await addTokens(appUser.userId, TOKEN_COSTS[(job.tokenAction as TokenAction) || "face_detect"], "refund", "Job cancelled — tokens refunded");
    } catch (refundErr) {
      console.error("[faceDetectRoute] Refund error:", refundErr);
    }
    return res.json({ cancelled: true });
  }
  return res.json({ cancelled: false, reason: "Job already finished" });
});

export default router;

/**
 * faceDetectRoute.ts — Face Detection to DXF
 *
 * Pipeline:
 *   1. User uploads a photo containing faces
 *   2. GPT-4o Vision detects and describes the face(s) in detail
 *   3. gpt-image-1 draws a clean B&W portrait line art of the face(s)
 *   4. potrace → svgToDxf → DXF ready for laser engraving / CNC
 *
 * Endpoints:
 *   POST /api/face-detect/start  — start async job, returns { jobId }
 *   GET  /api/face-detect/job/:jobId — poll job status
 *   POST /api/face-detect/cancel/:jobId — cancel job and refund tokens
 *   POST /api/face-detect/convert — convert a preview PNG to DXF (step 2)
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
import { invokeLLM } from "./_core/llm";
import { createJob, getJob, updateJob, cancelJob, heartbeatJob } from "./jobStore";
import { svgToDxf } from "./svgToDxf";
import OpenAI from "openai";
import potrace from "potrace";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 16 * 1024 * 1024 } });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY ?? "" });

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

// ─── Style variations for face portrait line art ──────────────────────────────
const FACE_STYLE_VARIATIONS = [
  {
    label: "portrait",
    style:
      "PORTRAIT STYLE: Clean professional portrait line art. " +
      "Bold outer contour of the face shape, hairline, and neck. " +
      "Clear lines for eyes (with pupils and lashes), eyebrows, nose bridge and nostrils, lips, ears. " +
      "Subtle lines for cheekbones, jaw definition, and forehead. " +
      "Like a professional portrait sketch or engraving. " +
      "NO shading, NO hatching, NO fill. Pure black lines on white only.",
  },
  {
    label: "detailed",
    style:
      "DETAILED PORTRAIT: Highly detailed face line art for laser engraving. " +
      "Every facial feature rendered with precision: eyes with detailed iris lines, " +
      "nose with full 3D definition, lips with natural curves, hair with flowing strands. " +
      "Skin texture suggested with minimal contour lines only. " +
      "Professional engraving quality — rich detail but all clean distinct lines. " +
      "NO shading, NO hatching, NO fill. Black lines on white only.",
  },
  {
    label: "artistic",
    style:
      "ARTISTIC PORTRAIT: Elegant artistic portrait with decorative flair. " +
      "Bold expressive lines capturing the essence of the face. " +
      "Hair rendered as flowing decorative lines. " +
      "Facial features stylized but recognizable — like a fine art portrait etching. " +
      "Suitable for artistic laser engraving on wood or metal. " +
      "NO shading, NO hatching, NO fill. Clean artistic lines only.",
  },
];

// ─── Build the full image generation prompt ───────────────────────────────────
function buildFacePrompt(faceDescription: string, variationIndex: number): string {
  const variation = FACE_STYLE_VARIATIONS[variationIndex % FACE_STYLE_VARIATIONS.length];
  return (
    `Professional black and white portrait line art of: ${faceDescription}. ` +
    "Pure white background (#FFFFFF). " +
    "Bold thick black outlines, no fill, no shading, no gradients, no grey tones. " +
    "High contrast: only pure black (#000000) lines on white. " +
    "CRITICAL: Draw ONLY the face and head — no body, no background elements, no text. " +
    "The face must be centered, front-facing or at the exact angle described. " +
    `${variation.style} ` +
    "=== MANDATORY FRAMING RULES === " +
    "The face must occupy 60-75% of the image. Leave at least 12% white margin on every edge. " +
    "The entire head must be fully visible — nothing cropped. " +
    "=== END FRAMING RULES === " +
    "DO NOT include any text, labels, watermarks, or background patterns."
  );
}

// ─── Background job runner ────────────────────────────────────────────────────
async function runFaceDetectJob(
  jobId: string,
  imageBuffer: Buffer,
  imageBase64: string,
  lang: "he" | "en",
  appUserId: number,
  ipAnon: string,
  sourceImageUrl?: string,
  hairline = false,
  lineweightMm?: number
) {
  const isHe = lang === "he";
  let heartbeatInterval: ReturnType<typeof setInterval> | undefined;
  try {
    updateJob(jobId, {
      status: "processing",
      step: isHe ? "מזהה פנים בתמונה..." : "Detecting faces in image...",
      stepEn: "Detecting faces in image...",
    });

    const jobCheck = getJob(jobId);
    if (!jobCheck || jobCheck.status === "cancelled") return;

    // ── Step A: GPT-4o Vision analyzes the face(s) ─────────────────────────
    const llmResponse = await invokeLLM({
      messages: [
        {
          role: "system",
          content:
            "You are an expert at analyzing human faces for portrait line art generation. " +
            "Your description will be used to generate a precise portrait line art. " +
            "Describe the face with maximum accuracy for portrait drawing:\n" +
            "(1) FACE SHAPE: oval, round, square, heart, diamond, oblong — be specific.\n" +
            "(2) CAMERA ANGLE: front view, 3/4 left, 3/4 right, profile left, profile right.\n" +
            "(3) FACIAL FEATURES: eye shape and size, eyebrow shape, nose shape, lip shape and fullness, ear visibility.\n" +
            "(4) HAIR: length, style (straight/wavy/curly), parting direction, distinctive features.\n" +
            "(5) AGE RANGE: approximate age (child/teen/young adult/adult/senior).\n" +
            "(6) EXPRESSION: neutral, smiling, serious, etc.\n" +
            "(7) DISTINCTIVE FEATURES: beard, mustache, glasses, freckles, prominent features.\n" +
            "If NO human face is detected, respond with exactly: 'NO_FACE_DETECTED'\n" +
            "Output ONLY the description (4-6 sentences), no preamble, no labels.",
        },
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}`, detail: "high" } },
            { type: "text", text: "Analyze the human face(s) in this image for portrait line art generation. If no human face is visible, respond with 'NO_FACE_DETECTED'." },
          ],
        },
      ],
    });

    const jobAfterLlm = getJob(jobId);
    if (!jobAfterLlm || jobAfterLlm.status === "cancelled") return;

    const faceDescription =
      (llmResponse as { choices?: Array<{ message?: { content?: string } }> })
        ?.choices?.[0]?.message?.content?.trim() || "";

    // Check if no face was detected
    if (!faceDescription || faceDescription.includes("NO_FACE_DETECTED")) {
      updateJob(jobId, {
        status: "error",
        error: isHe
          ? "לא זוהו פנים בתמונה. נסה תמונה עם פנים ברורות יותר."
          : "No faces detected in the image. Please try a photo with clearer faces.",
      });
      return;
    }

    updateJob(jobId, {
      step: isHe ? `מצייר פורטרט: "${faceDescription.slice(0, 50)}..."` : `Drawing portrait: "${faceDescription.slice(0, 50)}..."`,
      stepEn: `Drawing portrait: "${faceDescription.slice(0, 50)}..."`,
    });

    // ── Step B: gpt-image-1 draws the face as line art ─────────────────────
    heartbeatInterval = setInterval(() => heartbeatJob(jobId), 30_000);

    // Prepare source image for edit API
    const editSourceBuffer = await sharp(imageBuffer)
      .resize(512, 512, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .png({ compressionLevel: 6 })
      .toBuffer();

    updateJob(jobId, { partialImages: [] });

    // Generate all 3 variations in parallel
    const generationPromises = [0, 1, 2].map(async (idx) => {
      const variation = FACE_STYLE_VARIATIONS[idx];
      const editPrompt = buildFacePrompt(faceDescription, idx);

      const editFile = await (async () => {
        const { toFile } = await import("openai");
        return toFile(editSourceBuffer, "face.png", { type: "image/png" });
      })();

      const response = await openai.images.edit({
        model: "gpt-image-1",
        image: editFile,
        prompt: editPrompt,
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

      // Process: add padding, resize, threshold, potrace
      const processedBuffer = await sharp(rawBuffer)
        .extend({ top: 60, bottom: 60, left: 60, right: 60, background: { r: 255, g: 255, b: 255, alpha: 1 } })
        .resize(1024, 1024, { fit: "inside", background: { r: 255, g: 255, b: 255, alpha: 1 } })
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

      const { dxf, segmentCount, width, height, realWidth, realHeight } = svgToDxf(rawSvg, hairline, lineweightMm);

      const imgKey = `face-detect-generated/${nanoid()}.png`;
      const { url: imageUrl } = await storagePut(imgKey, rawBuffer, "image/png");

      const dxfFilename = `face_${variation.label}.dxf`;
      const dxfKey = `face-detect-dxf/${nanoid()}-${dxfFilename}`;
      const { url: dxfUrl } = await storagePut(dxfKey, Buffer.from(dxf, "utf-8"), "application/dxf");

      const imageResult = { imageUrl, svgPreview: cleanSvg, dxfUrl, dxfFilename, segmentCount, width, height, realWidth, realHeight };

      // Stream partial result
      const currentJob = getJob(jobId);
      if (currentJob && currentJob.status !== "cancelled") {
        const partialImages = (currentJob.partialImages as typeof imageResult[] | undefined) ?? [];
        updateJob(jobId, {
          partialImages: [...partialImages, imageResult],
          step: isHe ? "ממיר ל-DXF..." : "Converting to DXF...",
          stepEn: "Converting to DXF...",
        });
      }

      return imageResult;
    });

    const jobBeforeGen = getJob(jobId);
    if (!jobBeforeGen || jobBeforeGen.status === "cancelled") return;

    clearInterval(heartbeatInterval);
    heartbeatInterval = undefined;

    const images = await Promise.all(generationPromises);

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
    const variationLabels = ["portrait", "detailed", "artistic"];
    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      void recordUserAction({
        appUserId,
        actionType: "ai_generate",
        description: `face_detect: ${faceDescription.slice(0, 150)}`,
        segmentCount: img.segmentCount,
        dxfUrl: img.dxfUrl,
        imageUrl: img.imageUrl,
        svgPreview: img.svgPreview,
        groupId,
        variationLabel: variationLabels[i] ?? `v${i + 1}`,
        sourceImageUrl: sourceImageUrl ?? undefined,
      });
    }

    updateJob(jobId, {
      status: "done",
      result: { success: true, images, faceDescription },
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

      // Resize for LLM analysis (high detail for face recognition)
      const resized = await sharp(imageBuffer)
        .resize(768, 768, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 90 })
        .toBuffer();
      const imageBase64 = resized.toString("base64");

      const lang = ((req.body?.lang as string) || "he") === "he" ? "he" : "en";
      const hairline = req.body?.hairline === "true" || req.body?.hairline === true;
      const lineweightMmRaw = parseFloat((req.body?.lineweightMm as string) ?? "");
      const lineweightMm = isNaN(lineweightMmRaw) ? undefined : Math.min(2.0, Math.max(0, lineweightMmRaw));

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
      runFaceDetectJob(jobId, imageBuffer, imageBase64, lang, appUser.userId, ipAnon ?? "", uploadedSourceImageUrl, hairline, lineweightMm)
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

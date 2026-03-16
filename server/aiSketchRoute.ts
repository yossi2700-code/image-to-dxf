/**
 * AI Sketch Route — Fast single clean outline generation pipeline:
 *
 * POST /api/ai-sketch
 *   User uploads photo
 *   → sharp preprocesses image (remove bg, high contrast, threshold)
 *   → potrace traces the outline with optimized settings for single outline
 *   → svgToDxf converts to DXF
 *   Total time: ~3-8 seconds (no AI image generation step)
 *   Returns: { jobId }
 *
 * GET /api/ai-sketch/job/:jobId
 * POST /api/ai-sketch/cancel/:jobId
 */

import { Router } from "express";
import multer from "multer";
import sharp from "sharp";
import { fal } from "@fal-ai/client";
import { storagePut } from "./storage";
import { nanoid } from "nanoid";
import { anonymizeIp } from "./usageDb";
import { getAppUserFromCookie } from "./appAuth";
import { recordUserAction } from "./userActionsDb";
import { deductTokens, addTokens, TOKEN_COSTS, TokenAction } from "./tokenService";
import { createJob, getJob, updateJob, cancelJob, heartbeatJob } from "./jobStore";
import { svgToDxf } from "./svgToDxf";
import { cleanSvgForPreview } from "./svgClean";
import { potraceToSingleLine } from "./potraceToSingleLine";
import potrace from "potrace";

// Configure fal.ai client with API key
fal.config({ credentials: process.env.FAL_KEY ?? "" });

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 16 * 1024 * 1024 } });

function buildFilename(description: string): string {
  const NOISE = new Set(["camera","angle","front","view","facing","direction","the","a","an","in","of","to","from","and","is","this","with"]);
  const words = description
    .replace(/[^\u0590-\u05FFa-zA-Z0-9\s]/g, "")
    .trim()
    .split(/\s+/)
    .filter(w => w.length > 1 && !NOISE.has(w.toLowerCase()));
  let name = "";
  for (const w of words) {
    const next = name ? `${name}_${w}` : w;
    if (next.length > 20) break;
    name = next;
  }
  return (name || "ai_sketch").slice(0, 20).replace(/_+$/, "");
}

/**
 * Preprocess image for clean single-outline potrace using fal.ai lineart API:
 * 1. Resize to max 1024px and upload to S3 for fal.ai access
 * 2. Call fal.ai lineart preprocessor (ControlNet-style line detection)
 * 3. Download the lineart PNG
 * 4. Invert colors (fal.ai returns white lines on black, potrace needs black on white)
 * 5. Add padding
 * Falls back to sharp-only preprocessing if fal.ai fails
 */
async function preprocessForSketch(imageBuffer: Buffer): Promise<{ processed: Buffer; preview: Buffer }> {
  // Auto-rotate based on EXIF
  const rotated = await sharp(imageBuffer).rotate().toBuffer();

  // Step 1: Resize to 1024px for fal.ai input (optimal for lineart model)
  const meta = await sharp(rotated).metadata();
  const w = meta.width ?? 800;
  const h = meta.height ?? 800;
  const falMaxDim = 1024;
  const falScale = Math.min(1, falMaxDim / Math.max(w, h));
  const falW = Math.round(w * falScale);
  const falH = Math.round(h * falScale);

  const resizedForFal = await sharp(rotated)
    .resize(falW, falH, { fit: "inside", background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .jpeg({ quality: 92 })
    .toBuffer();

  try {
    // Step 2: Upload to S3 so fal.ai can access it via URL
    const uploadKey = `ai-sketch-input/${nanoid()}.jpg`;
    const { url: inputUrl } = await storagePut(uploadKey, resizedForFal, "image/jpeg");

    // Step 3: Call fal.ai lineart preprocessor
    const falResult = await fal.subscribe("fal-ai/image-preprocessors/lineart", {
      input: { image_url: inputUrl },
    }) as { data: { image: { url: string } } };

    const lineartUrl = falResult.data?.image?.url;
    if (!lineartUrl) throw new Error("fal.ai returned no image URL");

    // Step 4: Download the lineart image
    const response = await fetch(lineartUrl);
    if (!response.ok) throw new Error(`Failed to download lineart: ${response.status}`);
    const lineartRaw = Buffer.from(await response.arrayBuffer());

    // Step 5: fal.ai lineart returns WHITE lines on BLACK background
    // Invert to get BLACK lines on WHITE (required for potrace)
    // Do NOT upscale — it causes artifacts with thin lines
    const processed = await sharp(lineartRaw)
      .negate()                           // invert: white lines → black lines on white
      .grayscale()
      .extend({ top: 40, bottom: 40, left: 40, right: 40, background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .threshold(100)                     // low threshold: keep thin lines (music notes, staff lines)
      .png({ compressionLevel: 3 })
      .toBuffer();

    // Preview = white background with black lines (same as processed but without threshold)
    const preview = await sharp(lineartRaw)
      .negate()                           // white lines on black → black lines on white
      .grayscale()
      .extend({ top: 40, bottom: 40, left: 40, right: 40, background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .png({ compressionLevel: 6 })
      .toBuffer();

    return { processed, preview };
  } catch (falError) {
    // Fallback: use sharp-only preprocessing if fal.ai fails
    console.error("[AI Sketch] fal.ai lineart failed, falling back to sharp:", falError);

    // Use higher resolution for fallback too (2048px)
    const fbMaxDim = 2048;
    const fbScale = Math.min(1, fbMaxDim / Math.max(w, h));
    const fbW = Math.round(w * fbScale);
    const fbH = Math.round(h * fbScale);

    const resizedFallback = await sharp(rotated)
      .resize(fbW, fbH, { fit: "inside", background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .jpeg({ quality: 90 })
      .toBuffer();

    const { channels } = await sharp(resizedFallback).grayscale().toBuffer().then(buf => sharp(buf).stats());
    const meanBrightness = channels[0].mean;
    const thresholdValue = meanBrightness < 100 ? 100 : meanBrightness < 160 ? 130 : 150;

    const processed = await sharp(resizedFallback)
      .extend({ top: 80, bottom: 80, left: 80, right: 80, background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .grayscale()
      .linear(2.8, -(meanBrightness * 0.9))
      .blur(0.8)
      .threshold(thresholdValue)
      .png({ compressionLevel: 3 })
      .toBuffer();

    const preview = await sharp(processed).png({ compressionLevel: 6 }).toBuffer();
    return { processed, preview };
  }
}

// ─── Background job runner ────────────────────────────────────────────────────
async function runSketchJob(
  jobId: string,
  imageBuffer: Buffer,
  userDesc: string,
  lang: "he" | "en",
  appUserId: number,
  ipAnon: string,
  sourceImageUrl?: string,
) {
  const isHe = lang === "he";
  const jobStartTime = Date.now();

  try {
    updateJob(jobId, {
      status: "processing",
      step: isHe ? "מעבד תמונה..." : "Processing image...",
      stepEn: "Processing image...",
    });

    const jobCheck = getJob(jobId);
    if (!jobCheck || jobCheck.status === "cancelled") return;

    const baseFilename = buildFilename(userDesc || "sketch");

    // ── Step A: Preprocess image ──────────────────────────────────────────────
    updateJob(jobId, {
      step: isHe ? "מחלץ קווים..." : "Extracting outlines...",
      stepEn: "Extracting outlines...",
    });

    const { processed: processedBuffer, preview: previewBuffer } = await preprocessForSketch(imageBuffer);

    const jobAfterPrep = getJob(jobId);
    if (!jobAfterPrep || jobAfterPrep.status === "cancelled") return;

    // ── Step B: potrace → centerline tracing (eliminates double lines) ────────
    updateJob(jobId, {
      step: isHe ? "ממיר לוקטור..." : "Converting to vector...",
      stepEn: "Converting to vector...",
    });

    const rawSvg = await new Promise<string>((resolve, reject) => {
      potrace.trace(processedBuffer, {
        threshold: 128,
        turdSize: 2,          // very low: keep fine details like music notes, staff lines
        alphaMax: 0.5,        // smoother curves
        optCurve: true,
        optTolerance: 0.1,    // tighter tolerance for accurate lines
      }, (err: Error | null, svg: string) => {
        if (err) reject(err); else resolve(svg);
      });
    });

    // Use potraceToSingleLine to extract CENTERLINE — eliminates double lines
    // This converts each filled outline path into a single center stroke
    const singleLineResult = potraceToSingleLine(rawSvg, 1.0, 200);
    const cleanSvg = singleLineResult.svgPreview;
    const { dxf, segmentCount, width, height, realWidth, realHeight } = {
      dxf: singleLineResult.dxf,
      segmentCount: singleLineResult.segmentCount,
      width: singleLineResult.width,
      height: singleLineResult.height,
      realWidth: singleLineResult.realWidth,
      realHeight: singleLineResult.realHeight,
    };

    const jobAfterTrace = getJob(jobId);
    if (!jobAfterTrace || jobAfterTrace.status === "cancelled") return;

    // ── Step C: Upload results ────────────────────────────────────────────────
    updateJob(jobId, {
      step: isHe ? "שומר תוצאות..." : "Saving results...",
      stepEn: "Saving results...",
    });

    // Save the preprocessed B&W image as the "sketch" preview
    const imgKey = `ai-sketch-generated/${nanoid()}.png`;
    const { url: imageUrl } = await storagePut(imgKey, previewBuffer, "image/png");
    const dxfFilename = `${baseFilename}_sketch.dxf`;
    const dxfKey = `ai-sketch-dxf/${nanoid()}-${dxfFilename}`;
    const { url: dxfUrl } = await storagePut(dxfKey, Buffer.from(dxf, "utf-8"), "application/dxf");

    const imageResult = { imageUrl, svgPreview: cleanSvg, dxfUrl, dxfFilename, segmentCount, width, height, realWidth, realHeight };

    // Deduct tokens after successful completion
    await deductTokens(appUserId, "ai_trace" as TokenAction);

    // Record user action
    await recordUserAction({
      appUserId,
      actionType: "ai_generate",
      description: (userDesc || "sketch").slice(0, 200),
      segmentCount,
      dxfUrl,
      imageUrl,
      svgPreview: cleanSvg,
      groupId: nanoid(12),
      variationLabel: "sketch",
      sourceImageUrl: sourceImageUrl ?? undefined,
      feature: "ai_sketch",
      durationMs: Date.now() - jobStartTime,
      ipAnon: ipAnon ?? undefined,
    });

    updateJob(jobId, {
      status: "done",
      result: {
        success: true,
        images: [imageResult],
        objectDescription: userDesc || "",
        suggestions: [],
      },
    });

  } catch (err: unknown) {
    console.error("[aiSketchRoute] Job error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    updateJob(jobId, { status: "error", error: message });
    try {
      const { recordFailedJob } = await import("./failedJobsDb");
      await recordFailedJob({
        appUserId,
        feature: "ai_sketch",
        durationMs: Date.now() - jobStartTime,
        errorMessage: message,
        sourceImageUrl: sourceImageUrl ?? undefined,
      });
    } catch (_) { /* ignore */ }
  // Refund tokens on error
    try {
      await addTokens(appUserId, TOKEN_COSTS["ai_trace" as TokenAction] ?? 5, "refund_on_error", "error refund");
    } catch (_) { /* ignore */ }
  }
}

// ─── POST /api/ai-sketch ──────────────────────────────────────────────────────
router.post(
  "/api/ai-sketch",
  upload.single("image"),
  async (req, res) => {
    try {
      const appUser = getAppUserFromCookie(req.cookies);
      if (!appUser) {
        return res.status(401).json({
          error: "UNAUTHORIZED",
          message: "יש להתחבר כדי להשתמש ב-AI Sketch",
          messageEn: "Please log in to use AI Sketch",
        });
      }

      if (!req.file) {
        return res.status(400).json({
          error: "NO_IMAGE",
          message: "לא נשלחה תמונה",
          messageEn: "No image provided",
        });
      }

      // Check tokens before starting
      const tokenCheck = await deductTokens(appUser.userId, "ai_trace" as TokenAction, { checkOnly: true });
      if (!tokenCheck.success) {
        return res.status(402).json({
          error: "INSUFFICIENT_TOKENS",
          message: "אין מספיק אסימונים",
          messageEn: "Insufficient tokens",
          balance: (tokenCheck as { balance?: number }).balance ?? 0,
        });
      }

      const imageBuffer = req.file.buffer;
      const userDesc = (req.body.description as string | undefined)?.trim() ?? "";
      const lang = ((req.body.lang as string | undefined) === "he" ? "he" : "en") as "he" | "en";
      const ipAnon = anonymizeIp(req.ip ?? "") ?? "";

      // Upload source image for history
      let sourceImageUrl: string | undefined;
      try {
        const srcKey = `ai-sketch-source/${nanoid()}.jpg`;
        const srcBuf = await sharp(imageBuffer).rotate().resize(800, 800, { fit: "inside" }).jpeg({ quality: 80 }).toBuffer();
        const { url } = await storagePut(srcKey, srcBuf, "image/jpeg");
        sourceImageUrl = url;
      } catch (_) { /* ignore */ }

      const jobId = nanoid(16);
      createJob(jobId, appUser.userId, "ai_trace");

      res.json({ jobId });

      // Run job in background (no await)
      runSketchJob(jobId, imageBuffer, userDesc, lang, appUser.userId, ipAnon, sourceImageUrl).catch(() => {});

    } catch (err) {
      console.error("[aiSketchRoute] POST error:", err);
      res.status(500).json({ error: "INTERNAL_ERROR", message: "שגיאה פנימית" });
    }
  }
);

// ─── GET /api/ai-sketch/job/:jobId ───────────────────────────────────────────
router.get("/api/ai-sketch/job/:jobId", (req, res) => {
  const appUser = getAppUserFromCookie(req.cookies);
  if (!appUser) return res.status(401).json({ error: "UNAUTHORIZED" });

  const job = getJob(req.params.jobId);
  if (!job) return res.status(404).json({ error: "JOB_NOT_FOUND" });

  return res.json(job);
});

// ─── POST /api/ai-sketch/cancel/:jobId ───────────────────────────────────────
router.post("/api/ai-sketch/cancel/:jobId", async (req, res) => {
  const appUser = getAppUserFromCookie(req.cookies);
  if (!appUser) return res.status(401).json({ error: "UNAUTHORIZED" });

  const job = getJob(req.params.jobId);
  if (!job) return res.status(404).json({ error: "JOB_NOT_FOUND" });

  cancelJob(req.params.jobId);

  // Refund tokens
  try {
    await addTokens(appUser.userId, TOKEN_COSTS["ai_trace" as TokenAction] ?? 5, "cancel_refund", "cancel refund");
  } catch (_) { /* ignore */ }

  return res.json({ cancelled: true });
});

// History is served via tRPC userActions.list in routers.ts (feature: 'ai_sketch')

export default router;

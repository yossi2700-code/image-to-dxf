/**
 * AI Sketch Route — Clean line art generation pipeline:
 *
 * POST /api/ai-sketch
 *   User uploads photo
 *   → gpt-image-1 redraws as clean black-on-white line art
 *     (each letter/character treated as a pure graphic shape, not text)
 *   → sharp: grayscale → contrast → threshold → high-res
 *   → potrace centerline tracing → DXF/SVG
 *   Total time: ~15-30 seconds
 *   Returns: { jobId }
 *
 * GET /api/ai-sketch/job/:jobId
 * POST /api/ai-sketch/cancel/:jobId
 */

import { Router } from "express";
import multer from "multer";
import sharp from "sharp";
import OpenAI from "openai";
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

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY ?? "" });

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
 * The AI Sketch prompt:
 * Treats every element (including letters, characters, musical notes) as a
 * pure graphic/visual shape — not as readable text. Redraws as clean black
 * lines on white background, suitable for vector tracing.
 */
const SKETCH_PROMPT =
  `Redraw this image as a clean, precise black-and-white line drawing. ` +
  `CRITICAL RULE: Treat EVERY element in the image — including any letters, characters, numbers, ` +
  `musical notes, symbols, or writing — purely as GRAPHIC SHAPES and VISUAL FORMS. ` +
  `Do NOT read or interpret any text. Do NOT replace, translate, or omit any character. ` +
  `Each letter, note, or symbol must be redrawn as a clean outlined shape — ` +
  `exactly as it visually appears, preserving its exact form and position. ` +
  `Output rules: ` +
  `- Pure black (#000000) lines on pure white (#FFFFFF) background only. ` +
  `- No grey tones, no shading, no gradients, no fill inside shapes. ` +
  `- Each shape/character drawn with a single clean outline stroke. ` +
  `- Lines must be sharp, crisp, and clearly visible — not thin or faint. ` +
  `- Preserve the exact layout, proportions, and spatial arrangement of all elements. ` +
  `- No background elements, no decorative additions, no texture.`;

/**
 * Use gpt-image-1 to redraw the image as clean line art,
 * then process with sharp for potrace input.
 */
async function preprocessForSketch(imageBuffer: Buffer): Promise<{ processed: Buffer; preview: Buffer }> {
  // Auto-rotate based on EXIF
  const rotated = await sharp(imageBuffer).rotate().toBuffer();

  // Detect orientation for optimal gpt-image-1 output size
  const meta = await sharp(rotated).metadata();
  const srcW = meta.width ?? 1;
  const srcH = meta.height ?? 1;
  const isLandscape = srcW >= srcH;
  // gpt-image-1 supported sizes: 1024x1024, 1536x1024 (landscape), 1024x1536 (portrait)
  const aiOutputSize = isLandscape ? "1536x1024" : "1024x1536";
  const aiResizeW = isLandscape ? 1536 : 1024;
  const aiResizeH = isLandscape ? 1024 : 1536;

  // Prepare PNG for gpt-image-1 edit API — normalize dark images
  const rawResized = await sharp(rotated)
    .resize(aiResizeW, aiResizeH, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .toBuffer();

  const { channels } = await sharp(rawResized).stats();
  const avgBrightness = (channels[0].mean + channels[1].mean + channels[2].mean) / 3;

  const editSourceBuffer = avgBrightness < 80
    ? await sharp(rawResized)
        .normalise()
        .modulate({ brightness: 1.2 })
        .png({ compressionLevel: 6 })
        .toBuffer()
    : await sharp(rawResized)
        .png({ compressionLevel: 6 })
        .toBuffer();

  // Call gpt-image-1 edit API to generate clean line art
  const imageEditResponse = await openai.images.edit({
    model: "gpt-image-1",
    image: new File([editSourceBuffer as unknown as BlobPart], "source.png", { type: "image/png" }),
    prompt: SKETCH_PROMPT,
    n: 1,
    size: aiOutputSize as "1024x1024" | "1536x1024" | "1024x1536",
  } as Parameters<typeof openai.images.edit>[0]);

  const b64 = (imageEditResponse as { data?: Array<{ b64_json?: string }> }).data?.[0]?.b64_json;
  if (!b64) throw new Error("gpt-image-1 did not return image data");
  const rawBuffer = Buffer.from(b64, "base64");

  // Preview: clean white background with black lines (no threshold — keep grey tones for display)
  const preview = await sharp(rawBuffer)
    .grayscale()
    .extend({ top: 40, bottom: 40, left: 40, right: 40, background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .png({ compressionLevel: 6 })
    .toBuffer();

  // Processed: high-contrast binary image for potrace
  // Pipeline: grayscale → contrast boost → sharpen → high-res → threshold
  const processed = await sharp(rawBuffer)
    .grayscale()
    .linear(2.0, -60)              // boost contrast: push grey lines to black, bg to white
    .extend({ top: 40, bottom: 40, left: 40, right: 40, background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .resize(3072, 3072, { fit: "inside", background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .sharpen({ sigma: 1.5, m1: 1.0, m2: 0.5, x1: 2, y2: 10, y3: 20 }) // crisp edges before binarization
    .threshold(160)                // binarize: black lines on white
    .png({ compressionLevel: 3 })
    .toBuffer();

  return { processed, preview };
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
  let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

  try {
    updateJob(jobId, {
      status: "processing",
      step: isHe ? "מעבד תמונה..." : "Processing image...",
      stepEn: "Processing image...",
    });

    const jobCheck = getJob(jobId);
    if (!jobCheck || jobCheck.status === "cancelled") return;

    const baseFilename = buildFilename(userDesc || "sketch");

    // ── Step A: gpt-image-1 → clean line art ─────────────────────────────────
    updateJob(jobId, {
      step: isHe ? "מצייר קווים נקיים..." : "Drawing clean lines...",
      stepEn: "Drawing clean lines...",
    });

    // Heartbeat every 30s during AI generation to prevent stale-job timeout
    heartbeatInterval = setInterval(() => heartbeatJob(jobId), 30_000);

    const { processed: processedBuffer, preview: previewBuffer } = await preprocessForSketch(imageBuffer);

    if (heartbeatInterval) { clearInterval(heartbeatInterval); heartbeatInterval = null; }

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
        turdSize: 4,           // keep fine details like music notes, staff lines
        alphaMax: 0.5,         // smoother curves
        optCurve: true,
        optTolerance: 0.2,     // tight tolerance for accurate lines
      }, (err: Error | null, svg: string) => {
        if (err) reject(err); else resolve(svg);
      });
    });

    // Use potraceToSingleLine to extract CENTERLINE — eliminates double lines
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
    if (heartbeatInterval) { clearInterval(heartbeatInterval); heartbeatInterval = null; }
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

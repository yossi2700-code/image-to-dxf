/**
 * AI Sketch Route — Single clean outline generation pipeline:
 *
 * POST /api/ai-sketch
 *   User uploads photo
 *   → GPT-4o vision analyzes the image and extracts a detailed object description
 *   → gpt-image-1 draws a CLEAN SINGLE OUTLINE sketch (no fills, no double lines)
 *   → potrace traces the outline with high turdSize (removes inner noise)
 *   → potraceToSingleLine extracts the centerline (no double contours)
 *   Returns: { jobId }
 *
 * GET /api/ai-sketch/job/:jobId
 * POST /api/ai-sketch/cancel/:jobId
 */

import { Router } from "express";
import multer from "multer";
import sharp from "sharp";
import { storagePut } from "./storage";
import { nanoid } from "nanoid";
import { anonymizeIp } from "./usageDb";
import { getAppUserFromCookie } from "./appAuth";
import { recordUserAction } from "./userActionsDb";
import { deductTokens, addTokens, TOKEN_COSTS, TokenAction } from "./tokenService";
import { invokeLLM } from "./_core/llm";
import { createJob, getJob, updateJob, cancelJob, heartbeatJob } from "./jobStore";
import { svgToDxf } from "./svgToDxf";
import { cleanSvgForPreview } from "./svgClean";
import OpenAI from "openai";
import potrace from "potrace";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 16 * 1024 * 1024 } });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY ?? "" });

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

function pngToSvg(pngBuffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    potrace.trace(pngBuffer, {
      threshold: 128,
      turdSize: 200,      // very aggressive — removes ALL inner noise/specks
      alphaMax: 1.0,
      optCurve: true,
      optTolerance: 0.5,
    }, (err: Error | null, svg: string) => {
      if (err) reject(err);
      else resolve(svg);
    });
  });
}

// ─── Background job runner ────────────────────────────────────────────────────
async function runSketchJob(
  jobId: string,
  imageBuffer: Buffer,
  imageBase64: string,
  userDesc: string,
  focusText: string,
  lang: "he" | "en",
  appUserId: number,
  ipAnon: string,
  sourceImageUrl?: string,
) {
  const isHe = lang === "he";
  let heartbeatInterval: ReturnType<typeof setInterval> | undefined;
  const jobStartTime = Date.now();

  try {
    updateJob(jobId, {
      status: "processing",
      step: isHe ? "מנתח תמונה עם AI..." : "Analyzing image with AI...",
      stepEn: "Analyzing image with AI...",
    });

    const jobCheck = getJob(jobId);
    if (!jobCheck || jobCheck.status === "cancelled") return;

    // ── Step A: LLM analyzes image ────────────────────────────────────────────
    const analysisInstruction = focusText
      ? `The user wants to sketch: "${focusText}". Describe ONLY that specific element from the image in detail for single-outline sketch generation. Focus on: exact camera angle/view, facing direction, body pose, shape, structure, key features, proportions. Output ONLY the description (2-4 sentences), no preamble.`
      : userDesc
      ? `Describe the main object for single-outline sketch generation. Additional context: ${userDesc}. CRITICAL: Describe ONLY the physical object itself — its shape, structure, camera angle, proportions. DO NOT mention people holding it or musical notation.`
      : "Identify and describe the MAIN PHYSICAL OBJECT in this image for single-outline sketch generation. " +
        "CRITICAL RULES: " +
        "(1) ALWAYS describe the COMPLETE PHYSICAL OBJECT as a whole — the bottle, shoe, bag, instrument, toy, etc. " +
        "(2) If the object has a label/sticker/print on it, describe the WHOLE OBJECT including the label as part of it. " +
        "(3) If the most prominent element is a LETTER, NUMBER, SYMBOL, LOGO, or ENGRAVED/CARVED SHAPE — describe THAT EXACT SHAPE as the subject. " +
        "(4) DO NOT mention background objects, secondary items, or musical notation. " +
        "Focus on: exact camera angle/view, facing direction, shape, structure, key features, proportions.";

    const llmResponse = await invokeLLM({
      messages: [
        {
          role: "system",
          content:
            "You are an expert at analyzing images for precise single-outline sketch generation. " +
            "Your analysis will be used to generate a SINGLE CLEAN OUTLINE that traces the OUTER CONTOUR of the object. " +
            "Describe the COMPLETE PHYSICAL OBJECT in the image — its shape, structure, camera angle, proportions. " +
            "NEVER describe: (a) people holding/using the object unless they ARE the main subject, " +
            "(b) musical notes, staff lines, or musical notation, " +
            "(c) background objects or secondary items. " +
            "Format: Start with 'Camera angle: [exact angle].' then describe the rest in 2-4 sentences. No preamble.",
        },
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}`, detail: "low" } },
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

    updateJob(jobId, {
      step: isHe ? `מצייר סקיצה: "${objectDescription.slice(0, 50)}..."` : `Drawing sketch: "${objectDescription.slice(0, 50)}..."`,
      stepEn: `Drawing sketch: "${objectDescription.slice(0, 50)}..."`,
    });

    // ── Step B: Generate single-outline sketch with gpt-image-1 ──────────────
    heartbeatInterval = setInterval(() => heartbeatJob(jobId), 30_000);

    const sourceMeta = await sharp(imageBuffer).metadata();
    const srcW = sourceMeta.width ?? 1;
    const srcH = sourceMeta.height ?? 1;
    const isLandscapeImg = srcW >= srcH;
    const aiOutputSize = isLandscapeImg ? "1536x1024" : "1024x1536";
    const aiResizeW = isLandscapeImg ? 1536 : 1024;
    const aiResizeH = isLandscapeImg ? 1024 : 1536;

    const rawResized = await sharp(imageBuffer)
      .resize(aiResizeW, aiResizeH, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
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

    // Sketch prompt — single clean outline, no fills, no double lines
    const sketchPrompt =
      `Convert this image to a SINGLE CLEAN OUTLINE sketch suitable for laser cutting or CNC engraving. ` +
      `CRITICAL RULES: ` +
      `(1) Draw ONLY ONE continuous outline that traces the OUTER CONTOUR of the main subject. ` +
      `(2) NO fills, NO shading, NO grey tones, NO gradients. ` +
      `(3) NO double lines — each edge should be a SINGLE line, not two parallel lines. ` +
      `(4) For holes or interior features (eyes, windows, wheels), draw ONE closed outline per feature. ` +
      `(5) NO concentric circles or nested outlines — each shape boundary = exactly one line. ` +
      `(6) Pure white background (#FFFFFF). Pure black (#000000) lines only. ` +
      `(7) The result should look like a SIMPLE COLORING BOOK OUTLINE — clean, minimal, single strokes. ` +
      `(8) Remove the background completely. ` +
      `(9) NO text, NO letters, NO numbers, NO logos, NO watermarks. ` +
      `Subject: ${objectDescription}`;

    updateJob(jobId, { partialImages: [] });

    const imageEditResponse = await openai.images.edit({
      model: "gpt-image-1",
      image: new File([editSourceBuffer as unknown as BlobPart], "source.png", { type: "image/png" }),
      prompt: sketchPrompt,
      n: 1,
      size: aiOutputSize as "1024x1024" | "1536x1024" | "1024x1536",
    } as Parameters<typeof openai.images.edit>[0]);

    const b64 = (imageEditResponse as { data?: Array<{ b64_json?: string }> }).data?.[0]?.b64_json;
    if (!b64) throw new Error("gpt-image-1 did not return image data");
    const rawBuffer = Buffer.from(b64, "base64");

    // ── Step C: Process image for potrace ─────────────────────────────────────
    // High contrast + aggressive threshold to get clean binary image
    // Then potrace with very high turdSize to remove inner noise
    const processedBuffer = await sharp(rawBuffer)
      .extend({ top: 80, bottom: 80, left: 80, right: 80, background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .resize(2048, 2048, { fit: "inside", background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .grayscale()
      .linear(3.0, -100)      // aggressive contrast: push grey lines to black
      .blur(1.5)              // slight blur to merge thin double lines into one
      .threshold(140)
      .png()
      .toBuffer();

    // potrace with high turdSize to eliminate inner speckles and small noise
    const rawSvg = await new Promise<string>((resolve, reject) => {
      potrace.trace(processedBuffer, {
        threshold: 128,
        turdSize: 300,        // very high — removes ALL small inner shapes
        alphaMax: 1.0,
        optCurve: true,
        optTolerance: 0.5,
      }, (err: Error | null, svg: string) => {
        if (err) reject(err); else resolve(svg);
      });
    });

    const cleanSvg = cleanSvgForPreview(rawSvg);

    // Use standard svgToDxf (not single-line) — the sketch is already a clean outline
    // isDetailedMode=false keeps paths as closed contours (correct for single outline)
    const { dxf, segmentCount, width, height, realWidth, realHeight } = svgToDxf(rawSvg, false, undefined, 0, false);

    const imgKey = `ai-sketch-generated/${nanoid()}.png`;
    const { url: imageUrl } = await storagePut(imgKey, rawBuffer, "image/png");
    const dxfFilename = `${baseFilename}_sketch.dxf`;
    const dxfKey = `ai-sketch-dxf/${nanoid()}-${dxfFilename}`;
    const { url: dxfUrl } = await storagePut(dxfKey, Buffer.from(dxf, "utf-8"), "application/dxf");

    const imageResult = { imageUrl, svgPreview: cleanSvg, dxfUrl, dxfFilename, segmentCount, width, height, realWidth, realHeight };

    clearInterval(heartbeatInterval);

    const jobAfterGen = getJob(jobId);
    if (!jobAfterGen || jobAfterGen.status === "cancelled") return;

    // Deduct tokens after successful completion
    await deductTokens(appUserId, "ai_trace");

    // Record user action
    await recordUserAction({
      appUserId,
      actionType: "ai_generate",
      description: objectDescription.slice(0, 200),
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
        objectDescription,
        suggestions: [],
      },
    });

  } catch (err: unknown) {
    clearInterval(heartbeatInterval);
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
    const isBillingError = message.toLowerCase().includes("quota") ||
      message.toLowerCase().includes("billing") ||
      message.toLowerCase().includes("insufficient_quota") ||
      message.toLowerCase().includes("429") ||
      message.toLowerCase().includes("402");
    if (isBillingError) {
      try {
        const { notifyOwner } = await import("./_core/notification");
        await notifyOwner({
          title: "🔴 שגיאת חיוב OpenAI — AI Sketch",
          content: `שגיאת billing ב-AI Sketch:\n${message}`,
        });
      } catch (_) { /* ignore */ }
    }
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

      const { getDb } = await import("./db");
      const { appUsers } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (db) {
        const [userRow] = await db.select({ isBlocked: appUsers.isBlocked }).from(appUsers).where(eq(appUsers.id, appUser.userId)).limit(1);
        if (userRow?.isBlocked) {
          return res.status(403).json({
            error: "USER_BLOCKED",
            message: "חשבונך חסום. לפרטים פנה לתמיכה.",
            messageEn: "Your account has been blocked. Please contact support.",
          });
        }
      }

      const tokenResult = await deductTokens(appUser.userId, "ai_trace", { checkOnly: true });
      if (!tokenResult.success) {
        return res.status(402).json({
          error: "INSUFFICIENT_TOKENS",
          balance: tokenResult.balance,
          message: "נגמרו לך האסימונים. יש לטעון אסימונים להמשך שימוש.",
          messageEn: "You have run out of tokens. Please purchase more tokens to continue.",
        });
      }

      let imageBuffer: Buffer;
      if (req.file) {
        imageBuffer = req.file.buffer;
      } else if (req.body?.imageUrl) {
        const response = await fetch(req.body.imageUrl);
        imageBuffer = Buffer.from(await response.arrayBuffer());
      } else {
        return res.status(400).json({ error: "NO_IMAGE", message: "לא סופקה תמונה" });
      }
      imageBuffer = await sharp(imageBuffer).rotate().toBuffer();

      const resized = await sharp(imageBuffer)
        .resize(512, 512, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer();
      const imageBase64 = resized.toString("base64");

      const userDesc = (req.body?.description || "").trim();
      const focusText = (req.body?.focusText || "").trim();
      const lang = ((req.body?.lang as string) || "en") === "he" ? "he" : "en";
      const rawIp = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
      const ipAnon = anonymizeIp(rawIp);

      let uploadedSourceImageUrl: string | undefined;
      try {
        const srcKey = `source-images/${appUser.userId}-${nanoid(8)}.jpg`;
        const jpegBuf = await sharp(imageBuffer)
          .resize(800, 800, { fit: "inside", withoutEnlargement: true })
          .jpeg({ quality: 85 })
          .toBuffer();
        const { url } = await storagePut(srcKey, jpegBuf, "image/jpeg");
        uploadedSourceImageUrl = url;
      } catch (e) {
        console.warn("[aiSketchRoute] Failed to upload source image:", e);
      }

      const jobId = nanoid(12);
      createJob(jobId, appUser.userId, "ai_trace");

      runSketchJob(jobId, imageBuffer, imageBase64, userDesc, focusText, lang, appUser.userId, ipAnon ?? "", uploadedSourceImageUrl)
        .catch((err) => console.error("[aiSketchRoute] Unhandled job error:", err));

      return res.json({ jobId });

    } catch (err: unknown) {
      console.error("[aiSketchRoute] Error:", err);
      const message = err instanceof Error ? err.message : "Unknown error";
      return res.status(500).json({
        error: "INTERNAL_ERROR",
        message: `שגיאה פנימית: ${message}`,
        messageEn: `Internal error: ${message}`,
      });
    }
  }
);

// ─── GET /api/ai-sketch/job/:jobId ───────────────────────────────────────────
router.get("/api/ai-sketch/job/:jobId", (req, res) => {
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
    return res.json({
      status: job.status,
      step: job.step,
      stepEn: job.stepEn,
      partialImages: job.partialImages ?? [],
    });
  }
});

// ─── POST /api/ai-sketch/cancel/:jobId ───────────────────────────────────────
router.post("/api/ai-sketch/cancel/:jobId", async (req, res) => {
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
      console.error("[aiSketchRoute] Refund error:", refundErr);
    }
    return res.json({ cancelled: true });
  }

  return res.json({ cancelled: false, reason: "Job already finished" });
});

export default router;

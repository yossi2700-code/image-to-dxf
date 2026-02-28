/**
 * AI Trace Route — Two-step pipeline:
 *
 * STEP 1 — POST /api/ai-trace
 *   User uploads photo → generateImage() sees original image → generates a B&W PNG line drawing
 *   Returns: { previewPngUrl, previewPngBase64 }
 *
 * STEP 2 — POST /api/ai-trace/convert
 *   User approves the PNG preview → potrace pipeline → DXF
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
import { convertImageToDxf } from "./imageProcessor";
import { generateImage } from "./_core/imageGeneration";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 16 * 1024 * 1024 } });

/** Convert prompt text to safe filename */
function buildFilename(description: string): string {
  const safe = description
    .replace(/[^\u0590-\u05FFa-zA-Z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .slice(0, 40);
  return safe || "ai_trace";
}

// ─── STEP 1: AI generates B&W PNG drawing ────────────────────────────────────

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

      // ── Usage limit check ─────────────────────────────────────────────────────
      const limitCheck = await checkUsageLimit(appUser.userId);
      if (!limitCheck.allowed) {
        const isExpired = limitCheck.reason === "expired";
        const isDaily = limitCheck.reason === "daily";
        return res.status(429).json({
          error: "QUOTA_EXCEEDED",
          message: isExpired
            ? "תקופת הניסיון החינמית הסתיימה. לפרטים נוספים פנה למפתח התוכנה — רובוטיקה וטכנולוגיה."
            : isDaily
            ? `הגעת למכסה היומית (${limitCheck.max} עיצובים ליום). נסה שוב מחר.`
            : "הגעת למגבלת השימוש. לפרטים נוספים פנה למפתח התוכנה — רובוטיקה וטכנולוגיה.",
          messageEn: isExpired
            ? "Your free trial has ended. Contact the developer for more info — Robotics & Technology."
            : isDaily
            ? `Daily limit reached (${limitCheck.max} designs/day). Try again tomorrow.`
            : "Usage limit reached. Contact the developer for more info.",
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

      // ── Resize image for image generation API (max 1024px) ───────────────────
      const resized = await sharp(imageBuffer)
        .resize(1024, 1024, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 90 })
        .toBuffer();

      // ── Upload original to S3 for reference ──────────────────────────────────
      const imageKey = `ai-trace-original/${nanoid()}.jpg`;
      const { url: imageUrl } = await storagePut(imageKey, resized, "image/jpeg");

      // ── STEP 1: Use generateImage to create a B&W line drawing ───────────────
      // We pass the original image and ask for a clean black-on-white line drawing
      const userDesc = (req.body?.description || "").trim();
      const prompt = [
        "Create a bold black-and-white line drawing of the object in this image.",
        "Style: pure white background (#FFFFFF), thick solid black lines (stroke width 4-6px minimum).",
        "Use BOLD, THICK strokes — not thin hairlines. Every line must be clearly visible and at least 4px wide.",
        "No shading, no fills, no gradients, no gray tones — only solid black outlines on pure white.",
        "Draw the exact outer silhouette plus all internal details: logos, patterns, stitching, hardware, text.",
        "Like a bold woodcut print or stencil art — thick clean outlines suitable for laser cutting and CNC engraving.",
        "The lines must be thick enough to be traced by a vectorizer (potrace).",
        userDesc ? `The object is: ${userDesc}.` : "",
      ]
        .filter(Boolean)
        .join(" ");

      console.log("[aiTrace] Calling generateImage with prompt:", prompt.substring(0, 100));

      const generated = await generateImage({
        prompt,
        originalImages: [{ url: imageUrl, mimeType: "image/jpeg" }],
      });

      if (!generated.url) {
        throw new Error("Image generation returned no URL");
      }

      console.log("[aiTrace] Generated image URL:", generated.url);

      // ── Download the generated image — it's already a clean B&W line drawing ──
      const genResponse = await fetch(generated.url);
      const genBuffer = Buffer.from(await genResponse.arrayBuffer());

      // Pre-process for potrace: upscale + slight blur + threshold to get clean crisp lines
      // 1. Upscale to 2048px for better detail capture (lanczos3 = best quality)
      // 2. Grayscale
      // 3. Slight Gaussian blur to smooth anti-aliased edges
      // 4. Threshold at 210 (keep lines dark, make background pure white)
      //    Higher threshold = more white background, cleaner lines
      const enhancedBuffer = await sharp(genBuffer)
        .resize(2048, 2048, { fit: "inside", withoutEnlargement: false, kernel: "lanczos3" })
        .grayscale()
        .blur(0.5)          // Very slight blur to smooth anti-aliased edges before threshold
        .threshold(210)     // Lines are dark (<210), background is white (>210)
        .png()
        .toBuffer();

      // ── Upload enhanced preview PNG to S3 ────────────────────────────────────
      const pngKey = `ai-trace-preview/${nanoid()}.png`;
      const { url: previewPngUrl } = await storagePut(pngKey, enhancedBuffer, "image/png");

      const previewPngBase64 = `data:image/png;base64,${enhancedBuffer.toString("base64")}`;

      // ── Log usage ─────────────────────────────────────────────────────────────
      const ip = req.headers["x-forwarded-for"]?.toString() || req.socket.remoteAddress || "";
      await logUsageEvent({
        type: "ai_generate",
        segmentCount: 0,
        ipAnon: anonymizeIp(ip),
        imageUrl,
      });

      return res.json({
        previewPngUrl,
        previewPngBase64,
        imageUrl,
        description: userDesc || "ai_trace",
      });
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

// ─── STEP 2: Convert approved PNG to DXF ─────────────────────────────────────

router.post(
  "/api/ai-trace/convert",
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

      // ── Get PNG from request ──────────────────────────────────────────────────
      const { previewPngUrl, previewPngBase64, description, imageUrl } = req.body;

      let pngBuffer: Buffer;
      if (previewPngBase64) {
        // Strip data URL prefix if present
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

      // ── Run potrace pipeline (same as regular upload) ─────────────────────────
      const result = await convertImageToDxf(pngBuffer, {
        threshold: 128,
        simplifyTolerance: 0.8,   // Lower = more detail preserved, smoother curves
        minSegmentLength: 1.5,    // Keep smaller segments for fine details
      });

      // ── Upload DXF to S3 ──────────────────────────────────────────────────────
      const desc = description || "ai_trace";
      const filename = buildFilename(desc);
      const dxfKey = `ai-trace-dxf/${nanoid()}.dxf`;
      const { url: dxfUrl } = await storagePut(dxfKey, result.dxf, "application/dxf");

      // ── Record user action ────────────────────────────────────────────────────
      await recordUserAction({
        appUserId: appUser.userId,
        actionType: "ai_generate",
        description: desc,
        segmentCount: result.segmentCount,
        dxfUrl,
        imageUrl: imageUrl || previewPngUrl,
        svgPreview: result.svgPreview,
      });

      return res.json({
        svgPreview: result.svgPreview,
        dxfUrl,
        segmentCount: result.segmentCount,
        realWidth: result.realWidth,
        realHeight: result.realHeight,
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

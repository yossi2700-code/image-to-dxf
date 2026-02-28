/**
 * AI Trace Route — Two-step pipeline:
 *
 * STEP 1 — POST /api/ai-trace
 *   User uploads photo → generateImage() sees original image → generates a B&W PNG line drawing
 *   Returns: { previewPngUrl, previewPngBase64 }
 *
 * STEP 2 — POST /api/ai-trace/convert
 *   User approves the PNG preview → potrace pipeline (same as generateRoute) → DXF
 *   Returns: { svgPreview, dxfUrl, segmentCount, realWidth, realHeight, filename }
 *
 * KEY: Step 2 uses the SAME pipeline as generateRoute (potrace → SVG → DXF),
 *      NOT the Sobel edge-detection pipeline from imageProcessor.ts.
 *      This produces smooth Bezier curves instead of jagged line segments.
 */

import { Router } from "express";
import multer from "multer";
import sharp from "sharp";
import potrace from "potrace";
import { storagePut } from "./storage";
import { nanoid } from "nanoid";
import { logUsageEvent, anonymizeIp } from "./usageDb";
import { getAppUserFromCookie } from "./appAuth";
import { recordUserAction } from "./userActionsDb";
import { checkUsageLimit } from "./usageLimits";
import { generateImage } from "./_core/imageGeneration";
import { svgToDxf } from "./svgToDxf";

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

/**
 * Convert a PNG buffer to SVG using potrace.
 * Same function as in generateRoute — traces bitmap contours into smooth Bezier curves.
 */
function pngToSvg(pngBuffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    potrace.trace(pngBuffer, {
      threshold: 180,       // pixels darker than this become foreground
      turdSize: 4,          // ignore speckles smaller than this (noise removal)
      alphaMax: 1,          // corner smoothness (0=sharp, 1.33=smooth)
      optCurve: true,       // optimize curves for smooth output
      optTolerance: 0.2,    // curve optimization tolerance
    }, (err: Error | null, svg: string) => {
      if (err) reject(err);
      else resolve(svg);
    });
  });
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

      // ── Build prompt: request clean B&W line drawing ──────────────────────────
      const userDesc = (req.body?.description || "").trim();
      const prompt = [
        "Create a clean black-and-white line art drawing of the object in this image.",
        "Pure white background (#FFFFFF). Bold thick black outlines (3-5px stroke width).",
        "No fill, no shading, no gradients — only pure black (#000000) lines on white.",
        "High contrast: every line must be clearly visible. Like a coloring book or technical illustration.",
        "Single centered object, complete, not cropped. Suitable for laser cutting and CNC engraving.",
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

      // ── Download the generated image ──────────────────────────────────────────
      const genResponse = await fetch(generated.url);
      const genBuffer = Buffer.from(await genResponse.arrayBuffer());

      // ── Pre-process for potrace: grayscale + threshold (same as generateRoute) ─
      // This converts the AI-generated image to a clean binary B&W image
      // threshold(200): pixels brighter than 200 → white, rest → black
      const enhancedBuffer = await sharp(genBuffer)
        .grayscale()
        .threshold(200)
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

// ─── STEP 2: Convert approved PNG to DXF using potrace (same as generateRoute) ─

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

      // ── Step 1: potrace → SVG with smooth Bezier curves ──────────────────────
      // This is the SAME pipeline as generateRoute — produces smooth curves, not jagged lines
      const rawSvg = await pngToSvg(pngBuffer);

      // Convert potrace fill-based SVG to stroke-only for visual preview
      const svgContent = rawSvg
        .replace(/fill="[^"]*"/g, 'fill="none"')
        .replace(/fill:[^;"']*(;|(?="))/g, 'fill:none$1')
        .replace(/<path /g, '<path stroke="black" stroke-width="1.5" fill="none" ');
      const svgPreview = svgContent.replace(
        /stroke="black" stroke-width="1.5" fill="none" ([^>]*?)fill="none"/g,
        'stroke="black" stroke-width="1.5" fill="none" $1'
      );

      // ── Step 2: SVG → DXF ────────────────────────────────────────────────────
      const { dxf, segmentCount, realWidth, realHeight } = svgToDxf(rawSvg);

      // ── Upload DXF to S3 ──────────────────────────────────────────────────────
      const desc = description || "ai_trace";
      const filename = buildFilename(desc);
      const dxfKey = `ai-trace-dxf/${nanoid()}.dxf`;
      const { url: dxfUrl } = await storagePut(dxfKey, Buffer.from(dxf, "utf-8"), "application/dxf");

      // ── Record user action ────────────────────────────────────────────────────
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

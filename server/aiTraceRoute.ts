/**
 * AI Trace Route — Two-step pipeline:
 *
 * STEP 1 — POST /api/ai-trace
 *   User uploads photo → AI (GPT-4o) sees original image → generates a B&W PNG line drawing
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
import { invokeLLM } from "./_core/llm";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 16 * 1024 * 1024 } });

/**
 * Build the GPT-4o Vision prompt for generating a B&W line drawing.
 * We ask the model to produce a clean black-on-white pixel drawing (PNG),
 * not SVG — just like a technical illustration.
 */
function buildTracePrompt(): string {
  return `You are a professional technical illustrator creating laser engraving files.

Look at this image carefully. Your task is to create a clean black-and-white LINE DRAWING of exactly what you see.

INSTRUCTIONS:
1. Identify the object: what is it? (brand, model, type, key features)
2. Draw it as a clean technical outline illustration:
   - Black lines on pure white background
   - Trace the EXACT shape you see — outer silhouette + major internal details
   - Include logos, patterns, hardware, stitching, text if visible
   - Clean, smooth lines — no shading, no fills, no gradients
   - Like a technical product drawing or coloring book page

OUTPUT FORMAT:
- Return ONLY a base64-encoded PNG image
- Format: data:image/png;base64,<base64data>
- The PNG should be 1024x1024 pixels, white background, black lines
- NO text explanation, NO markdown, ONLY the data URL

Generate the line drawing now:`;
}

/**
 * Extract base64 PNG data URL from AI response.
 * The model should return: data:image/png;base64,<data>
 */
function extractPngDataUrl(raw: string): string {
  // Handle array content (Gemini thinking blocks)
  let text = raw;

  // Look for data URL pattern
  const match = text.match(/data:image\/png;base64,[A-Za-z0-9+/=]+/);
  if (match) {
    return match[0];
  }

  // Also try jpeg
  const jpegMatch = text.match(/data:image\/jpeg;base64,[A-Za-z0-9+/=]+/);
  if (jpegMatch) {
    return jpegMatch[0];
  }

  throw new Error("No valid image data URL found in AI response");
}

/** Convert buffer to base64 data URL for Vision API */
function bufferToDataUrl(buffer: Buffer, mimeType: string): string {
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

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

      // ── Resize image for Vision API (max 1024px) ──────────────────────────────
      const resized = await sharp(imageBuffer)
        .resize(1024, 1024, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 92 })
        .toBuffer();

      const originalDataUrl = bufferToDataUrl(resized, "image/jpeg");

      // ── STEP 1: GPT-4o Vision sees original image and generates PNG drawing ───
      const completion = await invokeLLM({
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: originalDataUrl, detail: "high" },
              },
              {
                type: "text",
                text: buildTracePrompt(),
              },
            ],
          },
        ],
      });

      // Extract text from response (handle Gemini thinking blocks array)
      const rawContent = completion.choices[0]?.message?.content;
      let rawResponse: string;
      if (typeof rawContent === "string") {
        rawResponse = rawContent;
      } else if (Array.isArray(rawContent)) {
        rawResponse = (rawContent as Array<{ type: string; text?: string }>)
          .filter((block) => block.type === "text")
          .map((block) => block.text ?? "")
          .join("");
      } else {
        rawResponse = "";
      }

      if (!rawResponse) {
        throw new Error("Empty response from AI");
      }

      console.log("[aiTrace] Raw response length:", rawResponse.length);
      console.log("[aiTrace] Has data:image:", rawResponse.includes("data:image"));
      console.log("[aiTrace] Preview:", rawResponse.substring(0, 200));

      // ── Try to extract PNG data URL from response ─────────────────────────────
      // If the model didn't return a data URL, we fall back to generating a
      // B&W version of the original image using sharp (edge detection)
      let previewPngBase64: string;
      let previewMimeType = "image/png";

      try {
        const dataUrl = extractPngDataUrl(rawResponse);
        // Strip the data URL prefix to get just the base64
        previewPngBase64 = dataUrl.split(",")[1];
        previewMimeType = dataUrl.startsWith("data:image/jpeg") ? "image/jpeg" : "image/png";
      } catch {
        // Fallback: the model returned SVG or text — generate B&W edge map from original
        console.log("[aiTrace] No PNG data URL found, generating B&W fallback from original image");
        const bwBuffer = await sharp(resized)
          .grayscale()
          .normalise()
          .linear(1.5, -40)
          .png()
          .toBuffer();
        previewPngBase64 = bwBuffer.toString("base64");
        previewMimeType = "image/png";
      }

      // ── Upload preview PNG to S3 ──────────────────────────────────────────────
      const pngBuffer = Buffer.from(previewPngBase64, "base64");
      const pngKey = `ai-trace-preview/${nanoid()}.png`;
      const { url: previewPngUrl } = await storagePut(pngKey, pngBuffer, previewMimeType);

      // ── Upload original photo to S3 (for reference) ───────────────────────────
      const imageKey = `ai-trace-original/${nanoid()}.jpg`;
      const { url: imageUrl } = await storagePut(imageKey, resized, "image/jpeg");

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
        previewPngBase64: `data:${previewMimeType};base64,${previewPngBase64}`,
        imageUrl,
        description: req.body?.description || "ai_trace",
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
        threshold: 160,
        simplifyTolerance: 2,
        minSegmentLength: 3,
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

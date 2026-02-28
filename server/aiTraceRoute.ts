/**
 * aiTraceRoute.ts
 *
 * AI Trace feature:
 *   1. User uploads a photo
 *   2. GPT-4o Vision analyzes it and draws a clean SVG outline (black lines on white)
 *   3. The SVG is rendered to a high-res PNG using sharp (rsvg)
 *   4. The PNG is processed through the same edge-detection + potrace pipeline
 *      as regular image uploads → clean, accurate DXF vector lines
 *
 * POST /api/ai-trace
 *   Body: multipart/form-data with field "image" (file) or "imageUrl" (string)
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
 * Build the GPT-4o Vision prompt.
 * We ask for a clean black-on-white SVG — it will be rendered to PNG and
 * then processed by the same edge-detection pipeline as regular uploads.
 */
function buildTracePrompt(): string {
  return `You are an expert vector illustrator specializing in laser engraving and CNC cutting files.

STEP 1 — IDENTIFY the object in the image with maximum specificity:
- What exact object is this? (brand, model, specific variant if visible)
- What are its most distinctive visual features? (logos, patterns, hardware, text, stitching, emblems)
- What is the overall shape and proportions?

STEP 2 — DRAW a faithful SVG outline that captures those specific details:

SVG REQUIREMENTS:
1. Output ONLY raw SVG XML — start with <svg and end with </svg>, nothing else
2. NO markdown fences, NO explanations, NO text before or after the SVG
3. White background: add <rect width="100%" height="100%" fill="white"/>
4. viewBox must match the object's actual proportions (e.g. "0 0 600 400" for landscape)
5. ALL stroke elements must have: stroke="black" stroke-width="2" fill="none"
6. NO colored fills — only black strokes on white background
7. Structure: outer silhouette first → major interior divisions → distinctive details
8. Include brand-specific elements: logos, monograms, patterns, hardware, text outlines
9. Use bezier curves (C/c commands) for smooth organic shapes
10. Use 20 to 60 path elements — enough detail to be recognizable, not cluttered
11. Every line must be purposeful — represent a real edge, seam, or feature of the object
12. Result must look like a clean coloring-book line drawing of the specific object

IMPORTANT: Do NOT draw a generic silhouette. Capture the SPECIFIC object with its unique identifying features.

Output the SVG now:`;
}

/** Convert buffer to base64 data URL for Vision API */
function bufferToDataUrl(buffer: Buffer, mimeType: string): string {
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

/** Sanitize SVG from GPT response — strip markdown fences if present */
function extractSvg(raw: string): string {
  let svg = raw.replace(/```(?:svg|xml)?\s*/gi, "").replace(/```\s*/g, "").trim();
  const start = svg.indexOf("<svg");
  const end = svg.lastIndexOf("</svg>");
  if (start === -1 || end === -1) {
    throw new Error("No valid SVG found in AI response");
  }
  svg = svg.slice(start, end + 6);
  return svg;
}

/**
 * Render an SVG string to a PNG buffer using sharp (libvips + librsvg).
 * We render at 1024px wide to give the edge-detection pipeline enough resolution.
 */
async function svgToPng(svgContent: string, targetSize = 1024): Promise<Buffer> {
  const svgBuffer = Buffer.from(svgContent, "utf-8");
  const png = await sharp(svgBuffer)
    .resize(targetSize, targetSize, { fit: "inside", background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .png()
    .toBuffer();
  return png;
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

router.post(
  "/api/ai-trace",
  upload.single("image"),
  async (req, res) => {
    try {
      // ── Auth check ──────────────────────────────────────────────────────────
      const appUser = getAppUserFromCookie(req.cookies);
      if (!appUser) {
        return res.status(401).json({
          error: "UNAUTHORIZED",
          message: "יש להתחבר כדי להשתמש ב-AI Trace",
          messageEn: "Please log in to use AI Trace",
        });
      }

      // ── Usage limit check ───────────────────────────────────────────────────
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

      // ── Get image buffer ─────────────────────────────────────────────────────
      let imageBuffer: Buffer;
      let mimeType = "image/jpeg";

      if (req.file) {
        imageBuffer = req.file.buffer;
        mimeType = req.file.mimetype || "image/jpeg";
      } else if (req.body?.imageUrl) {
        const response = await fetch(req.body.imageUrl);
        imageBuffer = Buffer.from(await response.arrayBuffer());
        mimeType = response.headers.get("content-type") || "image/jpeg";
      } else {
        return res.status(400).json({ error: "No image provided" });
      }

      // ── Resize photo for Vision API (max 1024px) ─────────────────────────────
      const resized = await sharp(imageBuffer)
        .resize(1024, 1024, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer();

      const dataUrl = bufferToDataUrl(resized, "image/jpeg");

      // ── STEP 1: Call GPT-4o Vision → get SVG outline ─────────────────────────
      const completion = await invokeLLM({
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: dataUrl, detail: "high" },
              },
              {
                type: "text",
                text: buildTracePrompt(),
              },
            ],
          },
        ],
      });

      const rawResponse = (completion.choices[0]?.message?.content as string) ?? "";
      if (!rawResponse) {
        throw new Error("Empty response from AI");
      }

      // ── Extract SVG from response ────────────────────────────────────────────
      const svgContent = extractSvg(rawResponse);

      // ── STEP 2: Render SVG → PNG ─────────────────────────────────────────────
      // This gives us a clean black-on-white raster image that the edge-detection
      // pipeline can process just like a regular uploaded image.
      const pngBuffer = await svgToPng(svgContent, 1024);

      // ── STEP 3: Run edge-detection + potrace pipeline (same as upload tab) ───
      // threshold=180 (high, since SVG lines are crisp black on white)
      // simplifyTolerance=2 (smooth curves)
      // minSegmentLength=3 (filter tiny noise)
      const result = await convertImageToDxf(pngBuffer, {
        threshold: 180,
        simplifyTolerance: 2,
        minSegmentLength: 3,
      });

      // ── Upload DXF to S3 ─────────────────────────────────────────────────────
      const description = req.body?.description || "ai_trace";
      const filename = buildFilename(description);
      const dxfKey = `ai-trace-dxf/${nanoid()}.dxf`;
      const { url: dxfUrl } = await storagePut(dxfKey, result.dxf, "application/dxf");

      // ── Upload original photo to S3 (for reference only) ─────────────────────
      const imageKey = `ai-trace/${nanoid()}.jpg`;
      const { url: imageUrl } = await storagePut(imageKey, resized, "image/jpeg");

      // ── Log usage ────────────────────────────────────────────────────────────
      const ip = req.headers["x-forwarded-for"]?.toString() || req.socket.remoteAddress || "";
      await logUsageEvent({
        type: "ai_generate",
        segmentCount: result.segmentCount,
        ipAnon: anonymizeIp(ip),
        imageUrl,
      });

      await recordUserAction({
        appUserId: appUser.userId,
        actionType: "ai_generate",
        description: description,
        segmentCount: result.segmentCount,
        dxfUrl,
        imageUrl,
        svgPreview: result.svgPreview,
      });

      return res.json({
        svgPreview: result.svgPreview,
        dxfUrl,
        imageUrl,
        segmentCount: result.segmentCount,
        realWidth: result.realWidth,
        realHeight: result.realHeight,
        filename: `${filename}.dxf`,
      });
    } catch (err: unknown) {
      console.error("[aiTraceRoute] Error:", err);
      const message = err instanceof Error ? err.message : "Unknown error";

      if (message.includes("429") || message.includes("quota") || message.includes("billing")) {
        return res.status(429).json({
          error: "OPENAI_QUOTA",
          message: "שגיאת מכסה ב-OpenAI. נסה שוב מאוחר יותר.",
          messageEn: "OpenAI quota error. Please try again later.",
        });
      }

      if (message.includes("No valid SVG")) {
        return res.status(422).json({
          error: "SVG_PARSE_ERROR",
          message: "ה-AI לא הצליח לייצר outline תקין. נסה תמונה אחרת.",
          messageEn: "AI could not generate a valid outline. Try a different image.",
        });
      }

      return res.status(500).json({
        error: "INTERNAL_ERROR",
        message: "שגיאה פנימית. נסה שוב.",
        messageEn: "Internal error. Please try again.",
      });
    }
  }
);

export default router;

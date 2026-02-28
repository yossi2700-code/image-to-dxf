/**
 * aiTraceRoute.ts
 *
 * AI Trace feature pipeline:
 *   1. User uploads a photo
 *   2. Server converts it to high-contrast B&W (grayscale + normalise + boost)
 *   3. GPT-4o Vision sees the clean B&W image and traces it as SVG line art
 *   4. The SVG is rendered to PNG using sharp
 *   5. The PNG goes through the same edge-detection + potrace pipeline as regular uploads
 *   6. Clean DXF is returned
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
 * The image sent is already B&W, so we ask GPT-4o to:
 *   - Recognize what the object is (silently)
 *   - Trace exactly what it sees as clean SVG line art
 */
function buildTracePrompt(): string {
  return `You are a professional vector illustrator creating laser engraving files.

The image you see has been converted to black and white. Look carefully at it.

PHASE 1 — RECOGNIZE (think silently, do not output this):
- What is this object exactly? (brand, model, type)
- What specific visual details are visible? (logos, patterns, stitching, hardware, text, emblems)
- What are the proportions and main shapes?

PHASE 2 — TRACE (output only this):
Draw an SVG that traces exactly what you see in the image. Do not draw from memory — look at the actual shapes, curves, and details visible and reproduce them as line art.

SVG RULES:
1. Output ONLY raw SVG XML — start with <svg and end with </svg>, nothing else
2. NO markdown fences, NO explanations, NO text before or after the SVG
3. First element: <rect width="100%" height="100%" fill="white"/>
4. viewBox must match the object's actual proportions as seen in the image
5. ALL elements: stroke="black" stroke-width="2" fill="none"
6. NO colored fills — only black strokes on white background
7. Draw in layers: outer silhouette → major edges and divisions → fine details (logos, patterns, hardware, stitching)
8. Smooth bezier curves (C/c) for organic shapes; straight lines (L/l) for straight edges
9. 40 to 100 path elements — capture all visible details faithfully
10. Every path must trace a real visible edge or feature from the image
11. The result must look like a precise coloring-book tracing of this specific image

Output the SVG tracing now:`;
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
 * Rendered at 1024px to give the edge-detection pipeline enough resolution.
 */
async function svgToPng(svgContent: string, targetSize = 1024): Promise<Buffer> {
  const svgBuffer = Buffer.from(svgContent, "utf-8");
  return sharp(svgBuffer)
    .resize(targetSize, targetSize, { fit: "inside", background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .png()
    .toBuffer();
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
        return res.status(400).json({ error: "No image provided" });
      }

      // ── Resize to max 1024px ──────────────────────────────────────────────────
      const resized = await sharp(imageBuffer)
        .resize(1024, 1024, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer();

      // ── Convert to high-contrast B&W before sending to GPT-4o ────────────────
      // Grayscale + normalise + linear boost helps GPT-4o see edges clearly
      // without being distracted by colors, gradients, or backgrounds.
      const bwImage = await sharp(resized)
        .grayscale()
        .normalise()        // auto-stretch contrast to full 0-255 range
        .linear(1.4, -30)   // further boost contrast: multiply + shift
        .jpeg({ quality: 90 })
        .toBuffer();

      const dataUrl = bufferToDataUrl(bwImage, "image/jpeg");

      // ── STEP 1: GPT-4o Vision traces the B&W image as SVG ────────────────────
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

      // ── Extract SVG from response ─────────────────────────────────────────────
      const svgContent = extractSvg(rawResponse);

      // ── STEP 2: Render SVG → PNG ──────────────────────────────────────────────
      const pngBuffer = await svgToPng(svgContent, 1024);

      // ── STEP 3: Edge-detection + potrace pipeline (same as upload tab) ────────
      const result = await convertImageToDxf(pngBuffer, {
        threshold: 180,
        simplifyTolerance: 2,
        minSegmentLength: 3,
      });

      // ── Upload DXF to S3 ──────────────────────────────────────────────────────
      const description = req.body?.description || "ai_trace";
      const filename = buildFilename(description);
      const dxfKey = `ai-trace-dxf/${nanoid()}.dxf`;
      const { url: dxfUrl } = await storagePut(dxfKey, result.dxf, "application/dxf");

      // ── Upload original photo to S3 (for reference) ───────────────────────────
      const imageKey = `ai-trace/${nanoid()}.jpg`;
      const { url: imageUrl } = await storagePut(imageKey, resized, "image/jpeg");

      // ── Log usage ─────────────────────────────────────────────────────────────
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

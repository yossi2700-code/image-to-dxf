/**
 * aiTraceRoute.ts
 *
 * AI Trace feature: user uploads a photo → GPT-4o Vision analyzes it and
 * generates a clean SVG outline suitable for laser engraving / CNC cutting.
 * The SVG is then converted to DXF using the existing svgToDxf utility.
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
import { svgToDxf } from "./svgToDxf";
import OpenAI from "openai";

const router = Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY ?? "" });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 16 * 1024 * 1024 } });

/**
 * Build the GPT-4o Vision prompt for generating a clean engraving outline.
 * We ask for a minimal SVG with only path/polyline elements — no fills, no colors.
 */
function buildTracePrompt(): string {
  return `You are an expert SVG illustrator and product designer specializing in laser engraving and CNC cutting files.

Your task has TWO steps:

STEP 1 — IDENTIFY: Look carefully at the image. Identify the EXACT object — its specific brand, model, shape, distinctive features, logos, patterns, stitching lines, hardware details, proportions. Be as specific as possible (e.g. "Louis Vuitton Neverfull tote bag with LV monogram pattern, leather handles, brass hardware").

STEP 2 — REDRAW FAITHFULLY: Create a detailed SVG outline that captures the SPECIFIC object as accurately as possible — not a generic version. Include:
- Exact silhouette and proportions from the image
- All distinctive structural details (seams, handles, hardware, clasps, straps)
- Brand-specific patterns or logos if visible (as outline paths)
- Interior lines that define the object's character
- Fine details that make this object recognizable

STRICT OUTPUT RULES:
1. Output ONLY valid SVG XML — no markdown, no code blocks, no explanation, no comments
2. SVG must start with <svg and end with </svg>
3. Use viewBox that matches the object's actual proportions (e.g. viewBox="0 0 400 500" for a tall object)
4. ALL elements must have: stroke="black" stroke-width="1.5" fill="none"
5. NO fills, NO colors, NO gradients, NO background rectangle
6. Use <path> elements with smooth curves (bezier) for organic shapes
7. Use multiple detail paths — not just a single outline
8. The result should be immediately recognizable as THIS SPECIFIC object
9. Aim for 20-60 path elements to capture sufficient detail
10. Suitable for laser engraving — clean lines, no overlapping strokes

Redraw this specific object as a faithful detailed SVG outline now:`;
}

/** Convert buffer to base64 data URL for OpenAI Vision */
function bufferToDataUrl(buffer: Buffer, mimeType: string): string {
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

/** Sanitize SVG from GPT response — strip markdown fences if present */
function extractSvg(raw: string): string {
  // Remove markdown code fences
  let svg = raw.replace(/```(?:svg|xml)?\s*/gi, "").replace(/```\s*/g, "").trim();
  // Find the SVG element
  const start = svg.indexOf("<svg");
  const end = svg.lastIndexOf("</svg>");
  if (start === -1 || end === -1) {
    throw new Error("No valid SVG found in AI response");
  }
  svg = svg.slice(start, end + 6);
  // Ensure all paths have fill=none
  svg = svg.replace(/fill="(?!none)[^"]*"/g, 'fill="none"');
  // Add fill=none to paths that don't have it
  svg = svg.replace(/<path(?![^>]*fill=)/g, '<path fill="none"');
  svg = svg.replace(/<polyline(?![^>]*fill=)/g, '<polyline fill="none"');
  return svg;
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
        // Uploaded file
        imageBuffer = req.file.buffer;
        mimeType = req.file.mimetype || "image/jpeg";
      } else if (req.body?.imageUrl) {
        // URL provided
        const response = await fetch(req.body.imageUrl);
        imageBuffer = Buffer.from(await response.arrayBuffer());
        mimeType = response.headers.get("content-type") || "image/jpeg";
      } else {
        return res.status(400).json({ error: "No image provided" });
      }

      // ── Resize image for Vision API (max 1024px, keep aspect ratio) ──────────
      const resized = await sharp(imageBuffer)
        .resize(1024, 1024, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer();

      const dataUrl = bufferToDataUrl(resized, "image/jpeg");

      // ── Call GPT-4o Vision ───────────────────────────────────────────────────
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        max_tokens: 4096,
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

      const rawResponse = completion.choices[0]?.message?.content ?? "";
      if (!rawResponse) {
        throw new Error("Empty response from AI");
      }

      // ── Extract and validate SVG ─────────────────────────────────────────────
      const svgContent = extractSvg(rawResponse);

      // ── Convert SVG → DXF ────────────────────────────────────────────────────
      const dxfResult = svgToDxf(svgContent);

      // ── Upload original image to S3 ──────────────────────────────────────────
      const imageKey = `ai-trace/${nanoid()}.jpg`;
      const { url: imageUrl } = await storagePut(imageKey, resized, "image/jpeg");

      // ── Upload DXF to S3 ─────────────────────────────────────────────────────
      const description = req.body?.description || "ai_trace";
      const filename = buildFilename(description);
      const dxfKey = `ai-trace-dxf/${nanoid()}.dxf`;
      const { url: dxfUrl } = await storagePut(dxfKey, dxfResult.dxf, "application/dxf");

      // ── Log usage ────────────────────────────────────────────────────────────
      const ip = req.headers["x-forwarded-for"]?.toString() || req.socket.remoteAddress || "";
      await logUsageEvent({
        type: "ai_generate",
        segmentCount: dxfResult.segmentCount,
        ipAnon: anonymizeIp(ip),
        imageUrl,
      });

      await recordUserAction({
        appUserId: appUser.userId,
        actionType: "ai_generate",
        description: description,
        segmentCount: dxfResult.segmentCount,
        dxfUrl,
        imageUrl,
        svgPreview: svgContent,
      });

      return res.json({
        svgPreview: svgContent,
        dxfUrl,
        imageUrl,
        segmentCount: dxfResult.segmentCount,
        realWidth: dxfResult.realWidth,
        realHeight: dxfResult.realHeight,
        filename: `${filename}.dxf`,
      });
    } catch (err: unknown) {
      console.error("[aiTraceRoute] Error:", err);
      const message = err instanceof Error ? err.message : "Unknown error";

      // OpenAI quota / billing errors
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

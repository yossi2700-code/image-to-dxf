/**
 * AI Trace Route — Two-step pipeline (same quality as AI Generate tab):
 *
 * STEP 1 — POST /api/ai-trace
 *   User uploads photo
 *   → GPT-4o vision analyzes the image and extracts a detailed object description
 *   → gpt-image-1 draws 3 clean B&W line art variations FROM SCRATCH (same as generateRoute)
 *   Returns: { images: Array<{ imageUrl, svgPreview, dxfUrl, ... }> }
 *
 * STEP 2 — POST /api/ai-trace/convert  (kept for backward compat, now just re-converts a PNG)
 *   Accepts a PNG URL and runs potrace → svgToDxf (same as generateRoute)
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
import { invokeLLM } from "./_core/llm";
import OpenAI from "openai";
import { svgToDxf } from "./svgToDxf";
import potrace from "potrace";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 16 * 1024 * 1024 } });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY ?? "" });

/** Convert description to safe filename */
function buildFilename(description: string): string {
  const safe = description
    .replace(/[^\u0590-\u05FFa-zA-Z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .slice(0, 40);
  return safe || "ai_trace";
}

/**
 * Three distinct style variations — same as generateRoute.
 */
const STYLE_VARIATIONS = [
  {
    label: "simple",
    style:
      "Simple clean outline only. Bold outer contour lines, minimal internal lines. " +
      "Icon/sticker style. NO texture, NO hatching, NO shading, NO fill. " +
      "Only 2-4 main structural lines inside the shape.",
  },
  {
    label: "detailed",
    style:
      "Clean outline with moderate internal details. Bold outer contour plus clear structural " +
      "inner lines showing main features. NO texture, NO hatching, NO shading, NO fill. " +
      "Like a coloring book page — clear distinct lines only.",
  },
  {
    label: "decorative",
    style:
      "Decorative artistic outline style. Bold outer contour with elegant decorative inner lines. " +
      "Art nouveau or mandala-inspired clean line work. NO texture, NO hatching, NO shading, NO fill. " +
      "All lines must be clean, distinct, and suitable for laser cutting.",
  },
];

/**
 * Generate 4-5 contextual improvement suggestions based on the identified object.
 * These are shown as clickable chips in the UI so the user can quickly refine.
 */
async function generateImprovementSuggestions(objectDescription: string): Promise<string[]> {
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content:
            "You are a creative assistant helping users refine line art designs for CNC/laser engraving. " +
            "Given a description of an object, generate 5 short, specific, creative improvement suggestions. " +
            "Each suggestion should be a brief action phrase (3-6 words max) that modifies the design. " +
            "Make them relevant and specific to THIS object — not generic. " +
            "Examples for a dog: 'add fur texture', 'make it angry', 'add a collar', 'smaller cuter version', 'cartoon style'. " +
            "Examples for a dragon: 'add wings', 'breathing fire', 'more scales detail', 'baby dragon version', 'fierce expression'. " +
            "Output ONLY a JSON array of 5 strings, no explanation. Example: [\"add wings\", \"breathing fire\", \"more scales\", \"baby version\", \"fierce expression\"]",
        },
        {
          role: "user",
          content: `Generate 5 improvement suggestions for this object: ${objectDescription}`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "suggestions",
          strict: true,
          schema: {
            type: "object",
            properties: {
              suggestions: {
                type: "array",
                items: { type: "string" },
              },
            },
            required: ["suggestions"],
            additionalProperties: false,
          },
        },
      },
    });
    const content = (response as { choices?: Array<{ message?: { content?: string } }> })
      ?.choices?.[0]?.message?.content;
    if (content) {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed.suggestions)) {
        return parsed.suggestions.slice(0, 5);
      }
    }
  } catch (e) {
    console.warn("[aiTrace] Failed to generate suggestions:", e);
  }
  return [];
}

function buildLineArtPrompt(objectDescription: string, variationIndex: number): string {
  const variation = STYLE_VARIATIONS[variationIndex % STYLE_VARIATIONS.length];
  return (
    `Clean black and white line art of ${objectDescription}. ` +
    "Pure white background (#FFFFFF). " +
    "Bold thick black outlines (3-5px stroke width), no fill, no shading, no gradients. " +
    "High contrast: only pure black (#000000) lines on white. " +
    `${variation.style} ` +
    "Single centered object, complete, not cropped. " +
    "No text, no watermarks, no grey tones."
  );
}

/**
 * Convert a PNG buffer to SVG using potrace.
 * Same function as in generateRoute.
 */
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

// ─── STEP 1: Analyze image with LLM → draw from scratch with gpt-image-1 ──────

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

      // ── Resize for LLM analysis ───────────────────────────────────────────────
      const resized = await sharp(imageBuffer)
        .resize(1024, 1024, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 90 })
        .toBuffer();

      const imageBase64 = resized.toString("base64");
      const userDesc = (req.body?.description || "").trim();
      const focusText = (req.body?.focusText || "").trim();

      // ── Step A: LLM analyzes image → extracts detailed object description ─────
      // We use GPT-4o vision to understand what's in the image and describe it
      // in a way that gpt-image-1 can draw from scratch (same as AI Generate tab).
      console.log("[aiTrace] Analyzing image with LLM...");

      // Build the user instruction based on focusText
      let analysisInstruction: string;
      if (focusText) {
        analysisInstruction = `The user wants to draw: "${focusText}". Describe ONLY that specific element from the image in detail for line art generation. Focus on its shape, structure, key features, style, and proportions. Output ONLY the description (2-4 sentences), no preamble.`;
      } else {
        analysisInstruction = userDesc
          ? `Describe the main object for line art generation. Additional context: ${userDesc}`
          : "Describe the main/dominant object in this image for line art generation.";
      }

      const llmResponse = await invokeLLM({
        messages: [
          {
            role: "system",
            content:
              "You are an expert at describing objects for line art generation. " +
              "Analyze the image and provide a concise, detailed description suitable for generating clean line art. " +
              "Focus on: shape, structure, key features, style, proportions. " +
              "Output ONLY the description (2-4 sentences), no preamble.",
          },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${imageBase64}`,
                  detail: "high",
                },
              },
              {
                type: "text",
                text: analysisInstruction,
              },
            ],
          },
        ],
      });

      const objectDescription =
        (llmResponse as { choices?: Array<{ message?: { content?: string } }> })
          ?.choices?.[0]?.message?.content?.trim() ||
        userDesc ||
        "the object in the image";

      console.log("[aiTrace] Object description:", objectDescription.substring(0, 120));

      const baseFilename = buildFilename(userDesc || objectDescription);

      // ── Step B: Generate 3 line art variations with gpt-image-1 ──────────────
      // Exactly the same pipeline as generateRoute — draw from scratch, no image reference.
      // This guarantees the same clean output quality as the AI Generate tab.
      const generationPromises = Array.from({ length: 3 }, async (_, idx) => {
        const imagePrompt = buildLineArtPrompt(objectDescription, idx);

        const response = await openai.images.generate({
          model: "gpt-image-1",
          prompt: imagePrompt,
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

        // Pre-process: grayscale + threshold for potrace (same as generateRoute)
        const processedBuffer = await sharp(rawBuffer)
          .grayscale()
          .threshold(200)
          .png()
          .toBuffer();

        // Vectorize with potrace → smooth SVG Bezier curves
        const rawSvg = await pngToSvg(processedBuffer);

        // Convert filled paths to stroke-only for SVG preview
        const svgContent = rawSvg
          .replace(/fill="[^"]*"/g, 'fill="none"')
          .replace(/fill:[^;"']*(;|(?="))/g, 'fill:none$1')
          .replace(/<path /g, '<path stroke="black" stroke-width="1.5" fill="none" ');
        const cleanSvg = svgContent.replace(
          /stroke="black" stroke-width="1.5" fill="none" ([^>]*?)fill="none"/g,
          'stroke="black" stroke-width="1.5" fill="none" $1'
        );

        // Convert SVG to DXF
        const { dxf, segmentCount, width, height, realWidth, realHeight } = svgToDxf(rawSvg);

        // Upload original PNG to S3
        const imgKey = `ai-trace-generated/${nanoid()}.png`;
        const { url: imageUrl } = await storagePut(imgKey, rawBuffer, "image/png");

        // Upload DXF to S3
        const variation = STYLE_VARIATIONS[idx % STYLE_VARIATIONS.length];
        const dxfFilename = `${baseFilename}_${variation.label}.dxf`;
        const dxfKey = `ai-trace-dxf/${nanoid()}-${dxfFilename}`;
        const { url: dxfUrl } = await storagePut(
          dxfKey,
          Buffer.from(dxf, "utf-8"),
          "application/dxf"
        );

        return { imageUrl, svgPreview: cleanSvg, dxfUrl, dxfFilename, segmentCount, width, height, realWidth, realHeight };
      });

      // Run suggestions generation in parallel with image generation
      const [images, suggestions] = await Promise.all([
        Promise.all(generationPromises),
        generateImprovementSuggestions(objectDescription),
      ]);

      // ── Log usage ─────────────────────────────────────────────────────────────
      const ip = req.headers["x-forwarded-for"]?.toString() || req.socket.remoteAddress || "";
      const totalSegments = images.reduce((s, img) => s + img.segmentCount, 0);
      await logUsageEvent({
        type: "ai_generate",
        segmentCount: Math.round(totalSegments / images.length),
        ipAnon: anonymizeIp(ip),
      });

      // Record user actions
      for (const img of images) {
        void recordUserAction({
          appUserId: appUser.userId,
          actionType: "ai_generate",
          description: objectDescription.slice(0, 200),
          segmentCount: img.segmentCount,
          dxfUrl: img.dxfUrl,
          imageUrl: img.imageUrl,
          svgPreview: img.svgPreview,
        });
      }

      return res.json({
        success: true,
        images,
        objectDescription,
        suggestions,
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

// ─── STEP 2 (legacy): Re-convert a PNG to DXF using potrace ───────────────────
// Kept for backward compatibility. Now uses potrace → svgToDxf (same as generateRoute).

router.post(
  "/api/ai-trace/convert",
  async (req, res) => {
    try {
      const appUser = getAppUserFromCookie(req.cookies);
      if (!appUser) {
        return res.status(401).json({ error: "UNAUTHORIZED", message: "יש להתחבר" });
      }

      const { previewPngUrl, previewPngBase64, description, imageUrl } = req.body;

      let pngBuffer: Buffer;
      if (previewPngBase64) {
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

      // Pre-process and run potrace (same as generateRoute)
      const processedBuffer = await sharp(pngBuffer)
        .grayscale()
        .threshold(200)
        .png()
        .toBuffer();

      const rawSvg = await pngToSvg(processedBuffer);
      const svgContent = rawSvg
        .replace(/fill="[^"]*"/g, 'fill="none"')
        .replace(/fill:[^;"']*(;|(?="))/g, 'fill:none$1')
        .replace(/<path /g, '<path stroke="black" stroke-width="1.5" fill="none" ');
      const svgPreview = svgContent.replace(
        /stroke="black" stroke-width="1.5" fill="none" ([^>]*?)fill="none"/g,
        'stroke="black" stroke-width="1.5" fill="none" $1'
      );

      const { dxf, segmentCount, realWidth, realHeight } = svgToDxf(rawSvg);

      const desc = description || "ai_trace";
      const filename = buildFilename(desc);
      const dxfKey = `ai-trace-dxf/${nanoid()}.dxf`;
      const { url: dxfUrl } = await storagePut(dxfKey, Buffer.from(dxf, "utf-8"), "application/dxf");

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

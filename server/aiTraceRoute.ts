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
import { deductTokens } from "./tokenService";
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
      "Clean professional line art with bold outer contour and key structural lines. " +
      "Show depth and form with 3-5 internal lines indicating main surfaces and edges. " +
      "Technical illustration style — like a product blueprint or engineering drawing. " +
      "NO texture, NO hatching, NO shading, NO fill. Pure black lines on white.",
  },
  {
    label: "detailed",
    style:
      "Highly detailed professional line art. Bold outer contour with rich internal line work " +
      "showing all structural features, surfaces, depth cues, and fine details. " +
      "Like a professional technical illustration or detailed product drawing. " +
      "NO texture, NO hatching, NO shading, NO fill. Clean distinct lines only.",
  },
  {
    label: "decorative",
    style:
      "Elegant decorative line art with artistic flair. Bold outer contour with flowing " +
      "decorative inner lines. Ornamental, architectural, or art nouveau style. " +
      "Rich detail suitable for laser engraving on wood or metal. " +
      "NO texture, NO hatching, NO shading, NO fill. All lines clean and precise.",
  },
];

/**
 * Three distinct style variations for LANDSCAPE mode.
 * Designed to capture the full scene: sky, horizon, foreground, buildings, nature.
 */
const LANDSCAPE_STYLE_VARIATIONS = [
  {
    label: "simple",
    style:
      "Simple clean landscape outline. Bold horizon line, clear silhouettes of all elements (buildings, trees, mountains, sky). " +
      "Capture the full panoramic scene — foreground, midground, background. " +
      "NO texture, NO hatching, NO shading, NO fill. Clean minimal lines only.",
  },
  {
    label: "detailed",
    style:
      "Detailed landscape line art. Clear horizon with rich detail in all layers: sky elements (clouds, sun), " +
      "background (mountains, distant buildings), midground (trees, structures), foreground (ground, plants, paths). " +
      "Every visible element drawn with clean distinct lines. NO texture, NO hatching, NO shading, NO fill. " +
      "Like a detailed panoramic illustration or travel sketch.",
  },
  {
    label: "decorative",
    style:
      "Elegant decorative landscape line art. Flowing artistic lines capturing the full scenic view. " +
      "Detailed silhouettes of all scene elements with decorative inner line work. " +
      "NO texture, NO hatching, NO shading, NO fill. " +
      "Like a fine art engraving of a landscape — beautiful and suitable for laser cutting.",
  },
];

function buildLandscapePrompt(sceneDescription: string, variationIndex: number): string {
  const variation = LANDSCAPE_STYLE_VARIATIONS[variationIndex % LANDSCAPE_STYLE_VARIATIONS.length];
  return (
    `Clean black and white line art of a landscape scene: ${sceneDescription}. ` +
    "Pure white background (#FFFFFF). " +
    "Bold thick black outlines (3-5px stroke width), no fill, no shading, no gradients. " +
    "High contrast: only pure black (#000000) lines on white. " +
    "IMPORTANT: Draw the ENTIRE scene — all elements visible in the landscape (sky, horizon, buildings, trees, mountains, water, foreground). " +
    "Do NOT focus on a single object — capture the full panoramic view. " +
    `${variation.style} ` +
    "Wide panoramic composition, complete, not cropped. " +
    "No text, no watermarks, no grey tones."
  );
}

/**
 * Generate 5 contextual improvement suggestions based on the identified object.
 * Suggestions are in the user's UI language (he/en).
 * Also includes suggestions for other objects detected in the image.
 */
async function generateImprovementSuggestions(
  objectDescription: string,
  imageBase64: string,
  lang: "he" | "en"
): Promise<string[]> {
  try {
    const isHebrew = lang === "he";
    const systemPrompt = isHebrew
      ? "אתה עוזר יצירתי שמסייע למשתמשים לשפר עיצובי קו לחריטת CNC/לייזר. " +
        "בהינתן תיאור של אובייקט ותמונה מקורית, צור 5 הצעות שיפור קצרות וספציפיות. " +
        "3 הצעות יתייחסו לאובייקט הראשי (שינוי סגנון, הוספת פרטים, גרסה שונה). " +
        "2 הצעות יתייחסו לאובייקטים/פרטים נוספים שרואים בתמונה (למשל: 'רק הנדנדה', 'הוסף את הכיסא'). " +
        "כל הצעה: 2-5 מילים בעברית. " +
        "פלט JSON בלבד: {\"suggestions\": [\"...\", ...]}"
      : "You are a creative assistant helping users refine line art designs for CNC/laser engraving. " +
        "Given an object description and the original image, generate 5 short specific improvement suggestions. " +
        "3 suggestions should modify the main object (style change, add details, different version). " +
        "2 suggestions should reference other objects/elements visible in the image (e.g. 'only the swing', 'add the chair'). " +
        "Each suggestion: 2-5 words in English. " +
        "Output JSON only: {\"suggestions\": [\"...\", ...]}";

    const userPrompt = isHebrew
      ? `צור 5 הצעות שיפור לאובייקט הזה: ${objectDescription}`
      : `Generate 5 improvement suggestions for this object: ${objectDescription}`;

    const response = await invokeLLM({
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: `data:image/jpeg;base64,${imageBase64}`, detail: "low" },
            },
            { type: "text", text: userPrompt },
          ],
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
              suggestions: { type: "array", items: { type: "string" } },
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
    `Professional black and white line art illustration of ${objectDescription}. ` +
    "Pure white background (#FFFFFF). " +
    "Bold thick black outlines (3-5px stroke width), no fill, no shading, no gradients. " +
    "High contrast: only pure black (#000000) lines on white. " +
    "Draw the object with clear three-dimensional perspective — show depth, volume, and structure. " +
    "Include visible surface details, edges, and characteristic features that make it recognizable. " +
    `${variation.style} ` +
    "Single centered object, complete, not cropped, viewed from a 3/4 angle showing depth. " +
    "No text, no watermarks, no grey tones, no background elements."
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

      // ── Block check ───────────────────────────────────────────────────────────
      const { getDb } = await import("./db");
      const { appUsers } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (db) {
        const [userRow] = await db.select({ isBlocked: appUsers.isBlocked }).from(appUsers).where(eq(appUsers.id, appUser.userId)).limit(1);
        if (userRow?.isBlocked) {
          return res.status(403).json({
            error: "USER_BLOCKED",
            message: "חשבונך חסום. לפרטים פנה לרובוטיקה וטכנולוגיה.",
            messageEn: "Your account has been blocked. Please contact Robotics & Technology.",
          });
        }
      }

      // ── Token check & deduction ───────────────────────────────────────────────
      const tokenResult = await deductTokens(appUser.userId, "ai_trace");
      if (!tokenResult.success) {
        return res.status(402).json({
          error: "INSUFFICIENT_TOKENS",
          balance: tokenResult.balance,
          message: "נגמרו לך האסימונים. ליצירת קשר ורכישת אסימונים נוספים פנה לרובוטיקה וטכנולוגיה.",
          messageEn: "You have run out of tokens. To purchase more tokens, contact Robotics & Technology.",
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

      // ── Resize for LLM analysis (512px = fewer Vision tokens = lower cost) ──────
      const resized = await sharp(imageBuffer)
        .resize(512, 512, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer();

      const imageBase64 = resized.toString("base64");
      const userDesc = (req.body?.description || "").trim();
      const focusText = (req.body?.focusText || "").trim();
      const landscapeMode = req.body?.landscapeMode === "true" || req.body?.landscapeMode === true;

      // ── Step A: LLM analyzes image → extracts detailed object description ─────
      // We use GPT-4o vision to understand what's in the image and describe it
      // in a way that gpt-image-1 can draw from scratch (same as AI Generate tab).
      console.log("[aiTrace] Analyzing image with LLM...");

      // Build the user instruction based on landscapeMode / focusText
      let analysisInstruction: string;
      if (landscapeMode) {
        analysisInstruction = focusText
          ? `Describe this landscape scene for line art generation, focusing on: "${focusText}". Include ALL visible elements: sky, horizon, background, midground, foreground. Describe the full panoramic composition. Output ONLY the description (3-5 sentences), no preamble.`
          : "Describe this landscape/scene for line art generation. Include ALL visible elements: sky, horizon, background (mountains/buildings), midground (trees/structures), foreground (ground/plants). Describe the full panoramic composition. Output ONLY the description (3-5 sentences), no preamble.";
      } else if (focusText) {
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
                  detail: "low",
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
        const imagePrompt = landscapeMode
          ? buildLandscapePrompt(objectDescription, idx)
          : buildLineArtPrompt(objectDescription, idx);

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
      const lang = ((req.body?.lang as string) || "en") === "he" ? "he" : "en";
      const [images, suggestions] = await Promise.all([
        Promise.all(generationPromises),
        generateImprovementSuggestions(objectDescription, imageBase64, lang),
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

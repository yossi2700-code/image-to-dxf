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
import { deductTokens, addTokens, TOKEN_COSTS, TokenAction, getTokenCostForAction } from "./tokenService";
import { invokeLLM } from "./_core/llm";
import { createJob, getJob, updateJob, cancelJob, heartbeatJob } from "./jobStore";
import { svgToDxf } from "./svgToDxf";
import { cleanSvgForPreview } from "./svgClean";
import OpenAI from "openai";
import potrace from "potrace";
import { spawn } from "child_process";
import fs from "fs/promises";
import os from "os";
import path from "path";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 16 * 1024 * 1024 } });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY ?? "" });

/** Convert description to safe filename — ASCII only, capped at 20 chars for clean download names */
// Words that come from AI analysis descriptions — not useful as filenames
const AI_NOISE_WORDS = new Set([
  "camera", "angle", "front", "view", "facing", "direction", "body", "pose",
  "position", "static", "sym", "the", "central", "flower", "faces", "directly",
  "forward", "with", "decorative", "swirls", "extending", "symmetrically",
  "left", "right", "and", "this", "is", "a", "an", "in", "of", "to", "from",
  "side", "profile", "rear", "top", "down", "low", "high", "style", "notes",
  "key", "structural", "features", "description",
]);

/** Simple Hebrew → Latin transliteration map for common words */
const HE_TO_EN: Record<string, string> = {
  "עכבר": "mouse", "מחשב": "computer", "כלב": "dog", "חתול": "cat",
  "ציפור": "bird", "דג": "fish", "פרח": "flower", "עץ": "tree",
  "בית": "house", "מכונית": "car", "אופנוע": "motorcycle", "אופניים": "bicycle",
  "לב": "heart", "כוכב": "star", "ירח": "moon", "שמש": "sun",
  "אריה": "lion", "נמר": "tiger", "דוב": "bear", "סוס": "horse",
  "פיל": "elephant", "פרפר": "butterfly", "נחש": "snake", "צב": "turtle",
  "תפוח": "apple", "בננה": "banana", "תות": "strawberry",
  "ספר": "book", "עיפרון": "pencil", "מפתח": "key", "כוס": "cup",
  "שעון": "clock", "טלפון": "phone", "מצלמה": "camera",
  "לוגו": "logo", "סמל": "symbol", "עיצוב": "design",
};

function buildFilename(description: string): string {
  // First try to extract English words (ASCII letters/digits only)
  const englishWords = description
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(w => w.length > 1 && !AI_NOISE_WORDS.has(w.toLowerCase()));

  if (englishWords.length > 0) {
    let name = "";
    for (const w of englishWords) {
      const next = name ? `${name}_${w}` : w;
      if (next.length > 20) break;
      name = next;
    }
    return (name || "ai_trace").slice(0, 20).replace(/_+$/, "");
  }

  // If description is Hebrew, try transliteration map
  const hebrewWords = description
    .replace(/[^\u0590-\u05FF\s]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(w => w.length > 0);

  const transliterated: string[] = [];
  for (const w of hebrewWords) {
    const en = HE_TO_EN[w];
    if (en) transliterated.push(en);
  }

  if (transliterated.length > 0) {
    let name = "";
    for (const w of transliterated) {
      const next = name ? `${name}_${w}` : w;
      if (next.length > 20) break;
      name = next;
    }
    return (name || "ai_trace").slice(0, 20).replace(/_+$/, "");
  }

  return "ai_trace";
}

/**
 * Three distinct style variations — same as generateRoute.
 */
const STYLE_VARIATIONS = [
  {
    label: "simple",
    style:
      "This output will be converted to a vector file for laser engraving or CNC cutting. " +
      "Draw ONLY clean continuous pen strokes — like drawing with a fine-tip pen on paper. " +
      "Draw outer silhouette and 10-15 key structural interior lines. " +
      "Every line must be a single continuous stroke with no breaks, no gaps, no rough edges. " +
      "ABSOLUTELY NO: sketchy texture, hatching, cross-hatching, shading, shadows, gradients, grey tones, stippling, texture fills, dark areas, filled regions. " +
      "Every enclosed area must be 100% pure white. Zero grey pixels allowed. " +
      "Lines must be SMOOTH, CONTINUOUS, and FLOWING — suitable for a laser to follow as a single path. " +
      "Style: clean coloring-book outline drawing with smooth continuous ink strokes.",
  },
  {
    label: "detailed",
    style:
      "This output will be converted to a vector file for laser engraving or CNC cutting. " +
      "Draw ONLY clean continuous pen strokes — like drawing with a fine-tip pen on paper. " +
      "Draw the outer silhouette PLUS all visible interior structural lines: panel edges, component boundaries, mechanical parts, joints, openings, slots, buttons, seams, and surface divisions. " +
      "Include 25-40 interior lines that define the object's structure and form. " +
      "Every line must be a single continuous stroke with no breaks, no gaps, no rough edges. " +
      "ABSOLUTELY NO: sketchy texture, hatching, cross-hatching, shading, shadows, gradients, grey tones, stippling, filled regions, or any decorative marks. " +
      "Every enclosed area must be 100% pure white. Zero grey pixels allowed. " +
      "Lines must be SMOOTH, CONTINUOUS, and FLOWING — suitable for a laser to follow as a single path. " +
      "Style: clean detailed technical line drawing — like a precise engineering illustration, outlines only, no fills.",
  },
  {
    label: "decorative",
    style:
      "This output will be converted to a vector file for laser engraving or CNC cutting. " +
      "Draw ONLY clean continuous pen strokes — like drawing with a fine-tip pen on paper. " +
      "Draw bold outer contour with flowing decorative inner lines. " +
      "Every line must be a single continuous stroke with no breaks, no gaps, no rough edges. " +
      "ABSOLUTELY NO: sketchy texture, hatching, cross-hatching, shading, shadows, gradients, grey tones, stippling, texture fills, dark areas, filled regions. " +
      "Every enclosed area must be 100% pure white. Zero grey pixels allowed. " +
      "Lines must be SMOOTH, CONTINUOUS, and FLOWING — suitable for a laser to follow as a single path. " +
      "Style: ornamental line art with smooth flowing continuous lines, suitable for laser engraving.",
  },
];

const SINGLE_LINE_STYLE =
  "STRICT LINE ART ONLY: pure black (#000000) thin single lines on pure white (#FFFFFF) background. " +
  "Draw only one line per edge — do not draw outlines with two parallel lines. " +
  "Use the thinnest possible strokes. No fill, no shading, no gradients, no grey tones. " +
  "Style: minimal wire-frame line drawing, every stroke is a single thin line.";

// ─── Image Classification Types ─────────────────────────────────────────────
export type ImageType =
  | "landscape"    // outdoor scene, cityscape, harbor, nature, wide view
  | "portrait"     // human face / close-up person
  | "object"       // single product, vehicle, animal, everyday item
  | "mandala"      // mandala, geometric pattern, decorative symmetry
  | "drawing"      // existing line art, sketch, diagram, blueprint
  | "unknown";     // fallback

export interface ImageClassification {
  type: ImageType;
  subject: string;   // short English description of main subject
  complexity: "simple" | "medium" | "complex";
}

/**
 * Classify the uploaded image using LLM vision.
 * Returns the image type and a short subject description.
 * Runs in parallel with image preparation — adds ~2-3s but improves prompt quality.
 */
async function classifyImage(imageBase64: string): Promise<ImageClassification> {
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content:
            "You are an image classifier for a laser engraving/CNC vectorization tool. " +
            "Analyze the image and return JSON only — no extra text. " +
            "Fields: " +
            "type (one of: landscape, portrait, object, mandala, drawing), " +
            "subject (5-10 word English description of main subject), " +
            "complexity (simple|medium|complex — how many distinct lines/details the image has).",
        },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: `data:image/jpeg;base64,${imageBase64}`, detail: "low" },
            },
            { type: "text", text: "Classify this image. Return JSON only." },
          ],
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "image_classification",
          strict: true,
          schema: {
            type: "object",
            properties: {
              type: { type: "string", enum: ["landscape", "portrait", "object", "mandala", "drawing"] },
              subject: { type: "string" },
              complexity: { type: "string", enum: ["simple", "medium", "complex"] },
            },
            required: ["type", "subject", "complexity"],
            additionalProperties: false,
          },
        },
      },
    });
    const content = response?.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(typeof content === "string" ? content : JSON.stringify(content)) as ImageClassification;
    return parsed;
  } catch (e) {
    console.warn("[aiTraceRoute] classifyImage failed, using fallback:", e);
    return { type: "unknown", subject: "the image", complexity: "medium" };
  }
}

/**
 * Build a type-specific direct-trace prompt based on image classification.
 * Each type gets tailored instructions for best laser engraving output.
 */
function buildClassifiedPrompt(classification: ImageClassification, variationStyle: string): string {
  const base =
    `This image will be converted to a vector file for laser engraving or CNC cutting. ` +
    `Convert it to clean black and white line art by following the shapes visible in this image. ` +
    `DO NOT redraw from memory or imagination — trace what you actually see. ` +
    `Pure white (#FFFFFF) background. Pure black (#000000) lines only. ` +
    `No shading, no grey tones, no gradients, no fills. ` +
    `Every line must be a single continuous stroke with no breaks, no gaps, no rough edges. ` +
    `Draw ONLY clean continuous pen strokes — use BOLD THICK strokes, minimum 3px line width. ` +
    `No text, no letters, no numbers, no logos, no watermarks anywhere. `;

  switch (classification.type) {
    case "landscape":
      return (
        base +
        `LANDSCAPE/SCENE MODE: This is a scene with many elements. ` +
        `Draw ONLY the 5-8 most dominant structural elements (horizon line, main buildings, large trees, prominent objects). ` +
        `COMPLETELY IGNORE: sky details, water ripples, distant background objects, small figures, foliage texture, window details, cables, ropes, masts unless they are the main subject. ` +
        `Simplify every complex area into 1-3 clean lines. Merge nearby parallel lines into one. ` +
        `The result should look like a simple architectural sketch — minimal, clean, readable. ` +
        variationStyle
      );

    case "portrait":
      return (
        base +
        `PORTRAIT MODE: This is a human face or person. ` +
        `Draw the face outline, main facial features (eyes, nose, mouth, eyebrows), hair silhouette, and neck/shoulder contour. ` +
        `Focus on the most expressive lines that define the person's likeness. ` +
        `IGNORE: skin texture, fine hair strands, background details, clothing patterns. ` +
        `Keep lines smooth and flowing — portrait-style line art. ` +
        variationStyle
      );

    case "mandala":
      return (
        base +
        `MANDALA/PATTERN MODE: This is a decorative pattern or mandala. ` +
        `Preserve ALL decorative lines, geometric shapes, and symmetrical elements. ` +
        `Draw every petal, curve, circle, and ornamental detail visible. ` +
        `Maintain perfect symmetry. Keep all fine decorative lines — they are the main content. ` +
        `Do NOT simplify or omit any decorative elements. ` +
        variationStyle
      );

    case "drawing":
      return (
        base +
        `EXISTING DRAWING MODE: This is already a line drawing, sketch, or diagram. ` +
        `Follow the existing lines EXACTLY as drawn. Preserve every stroke, curve, and detail. ` +
        `Clean up any rough edges or pencil texture — make lines smooth and crisp. ` +
        `Do NOT add or remove any elements — just clean up what is already there. ` +
        variationStyle
      );

    case "object":
    default:
      return (
        base +
        `OBJECT MODE: This is a single subject (${classification.subject}). ` +
        `Draw the outer silhouette and the most important structural interior lines. ` +
        `${classification.complexity === "complex" ? "Include 20-30 interior lines for the main structural details." : "Include 10-15 key structural lines."}` +
        `IGNORE: background, shadows, fine textures, small decorative details. ` +
        variationStyle
      );
  }
}

function buildFullImagePrompt(sceneDescription: string, variationIndex: number, singleLine = false): string {
  const variation = STYLE_VARIATIONS[variationIndex % STYLE_VARIATIONS.length];
  const styleBlock = singleLine ? SINGLE_LINE_STYLE : variation.style;
  return (
    `Professional black and white line art of the following scene: ${sceneDescription}. ` +
    "Pure white background (#FFFFFF). " +
    "Bold thick black outlines, no fill, no shading, no gradients. " +
    "High contrast: only pure black (#000000) lines on white. " +
    "CRITICAL: Draw ALL elements visible in the image EXACTLY as described — every object, decoration, symbol, and detail in their correct positions and proportions. " +
    "Do NOT substitute or replace any element with a generic version. Draw the SPECIFIC items described. " +
    `${styleBlock} ` +
    "=== MANDATORY FRAMING RULES === " +
    "The entire composition MUST fit completely inside the frame. Leave AT LEAST 15% white margin on every edge. All elements fully visible, NOTHING cropped or touching the border. " +
    "=== END FRAMING RULES === " +
    "DO NOT include any text, letters, words, numbers, labels, or captions anywhere in the image. " +
    "No watermarks, no grey tones."
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

function buildLineArtPrompt(objectDescription: string, variationIndex: number, singleLine = false): string {
  const variation = STYLE_VARIATIONS[variationIndex % STYLE_VARIATIONS.length];
  const styleBlock = singleLine ? SINGLE_LINE_STYLE : variation.style;
  return (
    `Professional black and white line art illustration. ` +
    `EXACT SUBJECT TO DRAW: ${objectDescription} ` +
    "\n=== CAMERA ANGLE — ABSOLUTE RULE (MOST IMPORTANT) === " +
    "You MUST reproduce the EXACT camera angle and view described in the subject description above. " +
    "- If description says 'pure side profile' or 'side view' or 'profile view': draw FLAT 90-DEGREE SIDE VIEW. The viewer sees ONLY one side. Do NOT add any 3D perspective or 3/4 angle. " +
    "- If description says 'front view' or 'facing viewer': draw the subject facing DIRECTLY toward the viewer, both sides symmetrical. " +
    "- If description says '3/4 angle': draw with slight diagonal perspective as described. " +
    "- If description says 'facing left': the subject's head/front points to the LEFT side of the image. " +
    "- If description says 'facing right': the subject's head/front points to the RIGHT side of the image. " +
    "DO NOT change, rotate, mirror, or reinterpret the camera angle. Draw EXACTLY what the description says. " +
    "=== END CAMERA ANGLE RULE === " +
    "\n=== STYLE === " +
    "Pure white background (#FFFFFF). " +
    "Bold thick black outlines, no fill, no shading, no gradients, no grey tones. " +
    "High contrast: only pure black (#000000) lines on white. " +
    `${styleBlock} ` +
    "\n=== FRAMING RULES (NEVER VIOLATE) === " +
    "The ENTIRE object MUST be 100% visible inside the frame with generous white margins. " +
    "Leave AT LEAST 20% white empty space on EVERY side. " +
    "Object must occupy NO MORE than 60% of image width AND 60% of image height. " +
    "=== END FRAMING RULES === " +
    "Single centered object, complete, fully inside the frame. " +
    "DO NOT include any text, letters, words, numbers, labels, or captions. " +
    "No watermarks, no background elements."
  );
}

/**
 * Convert a PNG buffer to SVG using potrace.
 * Same function as in generateRoute.
 */
function pngToSvg(pngBuffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    potrace.trace(pngBuffer, {
      threshold: 128,
      turdSize: 40,       // aggressively remove small noise/specks
      alphaMax: 1.0,      // smoother corners
      optCurve: true,
      optTolerance: 0.4,  // balanced smoothness
    }, (err: Error | null, svg: string) => {
      if (err) reject(err);
      else resolve(svg);
    });
  });
}

// ─── Background job runner for AI Trace ──────────────────────────────────────
async function runTraceJob(
  jobId: string,
  imageBuffer: Buffer,
  imageBase64: string,
  userDesc: string,
  focusText: string,
  landscapeMode: boolean,
  lang: "he" | "en",
  appUserId: number,
  ipAnon: string,
  sourceImageUrl?: string,
  variationIndex: number = 1,
  hairline = false,
  lineweightMm?: number,
  singleLine = false,
  closePaths = false
) {
  const isHe = lang === "he";
  let heartbeatInterval: ReturnType<typeof setInterval> | undefined;
  const jobStartTime = Date.now();
  // AbortController for cancelling in-flight OpenAI requests when timeout fires
  const abortController = new AbortController();
  // Hard 5-minute internal timeout: abort OpenAI calls and mark job as error
  const JOB_TIMEOUT_MS = 5 * 60 * 1000;
  const internalTimeoutId = setTimeout(() => {
    abortController.abort();
    clearInterval(heartbeatInterval);
    const job = getJob(jobId);
    if (job && job.status !== "done" && job.status !== "cancelled") {
      updateJob(jobId, {
        status: "error",
        error: isHe
          ? "העיבוד ארך יותר מ-5 דקות. נסה שוב עם תמונה פשוטה יותר."
          : "Processing timed out after 5 minutes. Try a simpler image.",
      });
    }
  }, JOB_TIMEOUT_MS);
  try {
    updateJob(jobId, {
      status: "processing",
      step: isHe ? "ממיר תמונה לקווי עט נקיים..." : "Converting image to clean pen strokes...",
      stepEn: "Converting image to clean pen strokes...",
    });
    const jobCheck = getJob(jobId);
    if (!jobCheck || jobCheck.status === "cancelled") return;

    // Skip GPT-4o text analysis — send image directly to gpt-image-1 for better accuracy
    const effectiveLandscapeMode = landscapeMode;
    const objectDescription = userDesc || "the image";
    const baseFilename = buildFilename(userDesc || "image");

    // Step B: Generate ONE line art variation using gpt-image-1 image editing
    // We pass the ORIGINAL image as reference so the AI preserves the exact shape/angle.
    // Heartbeat every 30s during image generation to prevent stale-job timeout
    heartbeatInterval = setInterval(() => heartbeatJob(jobId), 30_000);

    // Prepare a clean PNG version of the source image for the edit API.
    // Use 1536px to preserve fine details (wheel spokes, engine parts, etc.)
    // Detect image orientation to pick the best output size for gpt-image-1
    const sourceMeta = await sharp(imageBuffer).metadata();
    const srcW = sourceMeta.width ?? 1;
    const srcH = sourceMeta.height ?? 1;
    const isLandscapeImg = srcW >= srcH;
    // gpt-image-1 supported sizes: 1024x1024, 1536x1024 (landscape), 1024x1536 (portrait)
    const aiOutputSize = isLandscapeImg ? "1536x1024" : "1024x1536";
    const aiResizeW = isLandscapeImg ? 1536 : 1024;
    const aiResizeH = isLandscapeImg ? 1024 : 1536;

    // Normalize dark/underexposed images before sending to gpt-image-1
    // Detect average brightness: if image is very dark, apply auto-levels to improve quality
    const rawResized = await sharp(imageBuffer)
      .resize(aiResizeW, aiResizeH, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .toBuffer();
    const { channels } = await sharp(rawResized).stats();
    const avgBrightness = (channels[0].mean + channels[1].mean + channels[2].mean) / 3;
    // Detect if image is monochrome/B&W: check if all channels have very similar means
    // and low saturation (difference between max and min channel mean < 15)
    const channelDiff = Math.max(
      Math.abs(channels[0].mean - channels[1].mean),
      Math.abs(channels[1].mean - channels[2].mean),
      Math.abs(channels[0].mean - channels[2].mean)
    );
    const isMonochrome = channelDiff < 15; // very low color difference = B&W or near-B&W
    console.log(`[aiTraceRoute] Job ${jobId}: avgBrightness=${avgBrightness.toFixed(1)}, channelDiff=${channelDiff.toFixed(1)}, isMonochrome=${isMonochrome}`);
    // If average brightness < 80 (out of 255), image is dark — apply normalization
    const editSourceBuffer = avgBrightness < 80
      ? await sharp(rawResized)
          .normalise()           // auto-levels: stretches histogram to full 0-255 range
          .modulate({ brightness: 1.2 })  // slight brightness boost
          .png({ compressionLevel: 6 })
          .toBuffer()
      : await sharp(rawResized)
          .png({ compressionLevel: 6 })
          .toBuffer();

    // Classify the image in parallel with image preparation (adds ~2-3s, improves prompt quality)
    // Use a 10s timeout so classification never blocks the main pipeline
    const classificationPromise = Promise.race([
      classifyImage(imageBase64),
      new Promise<ImageClassification>((resolve) =>
        setTimeout(() => resolve({ type: "unknown", subject: "the image", complexity: "medium" }), 10_000)
      ),
    ]);

    // Initialize partialImages array for streaming results to client as each image completes
    updateJob(jobId, { partialImages: [] });

    // Wait for classification result (it runs in parallel with image prep above)
    const imageClassification = await classificationPromise;
    console.log(`[aiTraceRoute] Job ${jobId}: classified as type=${imageClassification.type}, complexity=${imageClassification.complexity}, subject="${imageClassification.subject}"`);

    // Update job step to show what was detected
    if (imageClassification.type !== "unknown") {
      const typeLabel: Record<string, string> = {
        landscape: isHe ? "נוף/סצנה" : "landscape/scene",
        portrait: isHe ? "פורטרט" : "portrait",
        object: isHe ? "אובייקט" : "object",
        mandala: isHe ? "מנדלה/תבנית" : "mandala/pattern",
        drawing: isHe ? "ציור/שרטוט" : "drawing/sketch",
      };
      updateJob(jobId, {
        step: isHe
          ? `זוהה: ${typeLabel[imageClassification.type] ?? imageClassification.type} — ממיר לקווים...`
          : `Detected: ${typeLabel[imageClassification.type] ?? imageClassification.type} — converting to lines...`,
        stepEn: `Detected: ${imageClassification.type} — converting to lines...`,
      });
    }

    // Generate only the selected variation (variationIndex: 0=simple, 1=detailed, 2=decorative)
    const generationPromises = [variationIndex].map(async (idx) => {
      const variation = STYLE_VARIATIONS[idx % STYLE_VARIATIONS.length];

      // Build prompt based on image classification
      const editPrompt = singleLine
        ? buildLineArtPrompt(objectDescription, idx, true)
        : effectiveLandscapeMode
        ? buildFullImagePrompt(objectDescription, idx)
        : buildClassifiedPrompt(imageClassification, variation.style);

      // Use Forge ImageService for high-quality line art generation
      // This produces cleaner results than OpenAI images.edit via proxy
      if (singleLine) console.log(`[aiTraceRoute] Single-line job ${jobId}: sending prompt to Forge ImageService, length=${editPrompt.length}`);
      const forgeApiUrl = process.env.BUILT_IN_FORGE_API_URL;
      const forgeApiKey = process.env.BUILT_IN_FORGE_API_KEY;
      if (!forgeApiUrl || !forgeApiKey) throw new Error("Forge API not configured");
      const forgeBaseUrl = forgeApiUrl.endsWith("/") ? forgeApiUrl : `${forgeApiUrl}/`;
      const forgeEndpoint = new URL("images.v1.ImageService/GenerateImage", forgeBaseUrl).toString();
      const b64Input = editSourceBuffer.toString("base64");
      const forgeResponse = await fetch(forgeEndpoint, {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          "connect-protocol-version": "1",
          authorization: `Bearer ${forgeApiKey}`,
        },
        body: JSON.stringify({
          prompt: editPrompt,
          original_images: [{ b64Json: b64Input, mimeType: "image/png" }],
        }),
        signal: abortController.signal,
      });
      if (!forgeResponse.ok) {
        const detail = await forgeResponse.text().catch(() => "");
        throw new Error(`Forge ImageService failed (${forgeResponse.status}): ${detail}`);
      }
      const forgeResult = await forgeResponse.json() as { image: { b64Json: string; mimeType: string } };
      const b64 = forgeResult.image?.b64Json;
      if (!b64) throw new Error("Forge ImageService did not return image data");
      let rawBuffer = Buffer.from(b64, "base64");

      // Add white padding around the AI-generated image, then process at 3072px resolution
      // Higher resolution = more pixels for potrace → smoother curves, less jagged edges
      // Simple mode (idx=0): light blur, higher threshold → clean outlines, removes fine noise
      // Detailed mode (idx=1): contrast boost first to make grey lines black, then moderate blur
      const isDetailedMode = idx === 1;

      let processedBuffer: Buffer;
      if (isDetailedMode) {
        // Detailed mode: AI often generates thin/grey lines.
        // Pipeline: grayscale → contrast boost → resize (high res) → sharpen → threshold
        // NO blur before threshold — blur softens edges and makes potrace produce jagged curves.
        // Sharpen BEFORE threshold ensures crisp, hard edges → potrace traces smooth clean paths.
        processedBuffer = await sharp(rawBuffer)
          .grayscale()
          .linear(2.5, -80)           // aggressive contrast: push grey lines to black, bg to white
          .extend({ top: 160, bottom: 160, left: 120, right: 120, background: { r: 255, g: 255, b: 255, alpha: 1 } })
          .resize(3072, 3072, { fit: "inside", background: { r: 255, g: 255, b: 255, alpha: 1 } })
          .sharpen({ sigma: 2.0, m1: 1.5, m2: 0.5, x1: 2, y2: 10, y3: 20 }) // crisp edges before binarization
          .threshold(170)             // slightly lower threshold — catches more of the sharpened dark pixels
          .png()
          .toBuffer();
      } else {
        // Simple mode: minimal blur to preserve fine details (leaves, small shapes)
        // blur(1.0) instead of 3.0 — just enough to remove single-pixel noise without merging nearby lines
        // contrast boost first to make light grey lines visible before threshold
        processedBuffer = await sharp(rawBuffer)
          .extend({ top: 160, bottom: 160, left: 120, right: 120, background: { r: 255, g: 255, b: 255, alpha: 1 } })
          .resize(3072, 3072, { fit: "inside", background: { r: 255, g: 255, b: 255, alpha: 1 } })
          .grayscale()
          .linear(1.8, -30)            // mild contrast boost: darken lines without blowing out background
          .blur(1.0)                   // minimal blur — removes single-pixel noise, preserves fine details
          .threshold(155)              // slightly lower to catch more of the boosted dark pixels
          .png()
          .toBuffer();
      }

      // Centerline / single-line mode: run Zhang-Suen skeletonization on the processed image
      // before potrace so every stroke is exactly 1 pixel wide → potrace traces single-line paths.
      // This is much more faithful to the original image than asking the AI to draw single lines.
      if (singleLine) {
        const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "skeleton-"));
        const inPath = path.join(tmpDir, "in.png");
        const outPath = path.join(tmpDir, "out.png");
        try {
          await fs.writeFile(inPath, processedBuffer);
          await new Promise<void>((resolve, reject) => {
            const scriptPath = path.join(__dirname, "skeletonize.py");
            const proc = spawn("python3", [scriptPath, inPath, outPath]);
            proc.on("close", (code) => {
              if (code === 0) resolve();
              else reject(new Error(`skeletonize.py exited with code ${code}`));
            });
            proc.on("error", reject);
          });
          processedBuffer = await fs.readFile(outPath);
          console.log(`[aiTraceRoute] Skeletonized image for job ${jobId}`);
        } catch (skelErr) {
          console.warn(`[aiTraceRoute] Skeletonization failed, using original:`, skelErr);
        } finally {
          await fs.rm(tmpDir, { recursive: true, force: true });
        }
      }

      // Simple: large turdSize removes small details; Detailed: small turdSize keeps texture/detail lines
      // turdSize scaled up for 3072px (4x area = ~4x turdSize)
      // Detailed: higher optTolerance (0.6) = smoother curves; lower alphaMax = rounder corners
      const potraceOptions = isDetailedMode
        // Detailed: turdSize 8 keeps very fine details; alphaMax 1.0 = smooth corners;
        // optTolerance 1.0 = maximum curve joining → connects broken lines in complex images
        ? { threshold: 128, turdSize: 8, alphaMax: 1.0, optCurve: true, optTolerance: 1.0 }
        : { threshold: 128, turdSize: 24, alphaMax: 1.0, optCurve: true, optTolerance: 0.6 }; // reduced turdSize → preserves small details like individual leaves

      const rawSvg = await new Promise<string>((resolve, reject) => {
        potrace.trace(processedBuffer, potraceOptions, (err: Error | null, svg: string) => {
          if (err) reject(err); else resolve(svg);
        });
      });
      const cleanSvg = cleanSvgForPreview(rawSvg);

      // All paths closed — CorelDRAW/Flexi need closed LWPOLYLINE for fill/cut operations.
      const { dxf, segmentCount, width, height, realWidth, realHeight } = svgToDxf(rawSvg, hairline, lineweightMm, 0, false, singleLine && closePaths);
      const imgKey = `ai-trace-generated/${nanoid()}.png`;
      const { url: imageUrl } = await storagePut(imgKey, rawBuffer, "image/png");
      const dxfFilename = `${baseFilename}_${variation.label}.dxf`;
      const dxfKey = `ai-trace-dxf/${nanoid()}-${dxfFilename}`;
      const { url: dxfUrl } = await storagePut(dxfKey, Buffer.from(dxf, "utf-8"), "application/dxf");

      const imageResult = { imageUrl, svgPreview: cleanSvg, dxfUrl, dxfFilename, segmentCount, width, height, realWidth, realHeight };

      // Stream partial result to client immediately
      const currentJob = getJob(jobId);
      if (currentJob && currentJob.status !== "cancelled") {
        const partialImages = (currentJob.partialImages as typeof imageResult[] | undefined) ?? [];
        updateJob(jobId, {
          partialImages: [...partialImages, imageResult],
          step: isHe ? "ממיר ל-DXF..." : "Converting to DXF...",
          stepEn: "Converting to DXF...",
        });
      }

      return imageResult;
    });

    // Check cancelled before image gen
    const jobBeforeGen = getJob(jobId);
    if (!jobBeforeGen || jobBeforeGen.status === "cancelled") return;

    clearInterval(heartbeatInterval);
    // Suggestions get a 30-second timeout so they never block job completion.
    const suggestionsWithTimeout = Promise.race([
      generateImprovementSuggestions(objectDescription, imageBase64, lang),
      new Promise<string[]>((resolve) => setTimeout(() => resolve([]), 30_000)),
    ]);
    const [images, suggestions] = await Promise.all([
      Promise.all(generationPromises),
      suggestionsWithTimeout,
    ]);

    const jobAfterGen = getJob(jobId);
    if (!jobAfterGen || jobAfterGen.status === "cancelled") return;

    // Log usage
    const totalSegments = images.reduce((s, img) => s + img.segmentCount, 0);
    const totalFileSizeKb = Math.round(
      images.reduce((sum, img) => sum + Buffer.byteLength(img.svgPreview ?? "", "utf-8"), 0) / 1024
    );
    void logUsageEvent({
      type: "ai_generate",
      segmentCount: Math.round(totalSegments / images.length),
      ipAnon: anonymizeIp(ipAnon),
      durationMs: Date.now() - jobStartTime,
      fileSizeKb: totalFileSizeKb,
    });

    // Deduct tokens NOW — only after successful job completion
    await deductTokens(appUserId, "ai_trace");
    updateJob(jobId, { tokenDeducted: true });

    // Record user actions
    const groupId = nanoid(12);
    const allVariationLabels = ["simple", "detailed", "decorative"];
    const variationLabels = [allVariationLabels[variationIndex] ?? `v${variationIndex + 1}`];
    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      await recordUserAction({
        appUserId,
        actionType: "ai_generate",
        description: objectDescription.slice(0, 200),
        segmentCount: img.segmentCount,
        dxfUrl: img.dxfUrl,
        imageUrl: img.imageUrl,
        svgPreview: img.svgPreview,
        groupId,
        variationLabel: variationLabels[i] ?? `v${i + 1}`,
        sourceImageUrl: sourceImageUrl ?? undefined,
        feature: "ai_trace",
        durationMs: Date.now() - jobStartTime,
        ipAnon: ipAnon ?? undefined,
      });
    }

    clearTimeout(internalTimeoutId);
    updateJob(jobId, { status: "done", result: { success: true, images, objectDescription, suggestions } });

  } catch (err: unknown) {
    clearTimeout(internalTimeoutId);
    clearInterval(heartbeatInterval);
    console.error("[aiTraceRoute] Job error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    // Don't overwrite a timeout error already set by internalTimeoutId
    const currentJob = getJob(jobId);
    if (currentJob && currentJob.status !== "error") {
      // Detect content policy / safety filter rejections and set a friendly errorCode
      const msgLower = message.toLowerCase();
      const isContentPolicy = msgLower.includes("safety") || msgLower.includes("content_policy") ||
        msgLower.includes("content policy") || msgLower.includes("rejected") ||
        msgLower.includes("moderation") || msgLower.includes("inappropriate") ||
        msgLower.includes("violat");
      updateJob(jobId, {
        status: "error",
        error: message,
        errorCode: isContentPolicy ? "CONTENT_POLICY" : undefined,
      });
    }
    // No token refund needed — tokens are only deducted after success
    // Record failed action in user history
    void recordUserAction({
      appUserId,
      actionType: "ai_generate",
      description: "ai_trace — נכשל",
      feature: "ai_trace",
      durationMs: Date.now() - jobStartTime,
      status: "failed",
      errorMessage: message.slice(0, 500),
      sourceImageUrl: sourceImageUrl ?? undefined,
    });
    // Log the failed job for admin debugging
    try {
      const { recordFailedJob } = await import("./failedJobsDb");
      await recordFailedJob({
        appUserId,
        feature: "ai_trace",
        durationMs: Date.now() - jobStartTime,
        errorMessage: message,
        sourceImageUrl: sourceImageUrl ?? undefined,
      });
    } catch (_) { /* ignore logging errors */ }
    // Alert admin if billing/quota issue
    const isBillingError = message.toLowerCase().includes("quota") ||
      message.toLowerCase().includes("billing") ||
      message.toLowerCase().includes("insufficient_quota") ||
      message.toLowerCase().includes("429") ||
      message.toLowerCase().includes("402");
    if (isBillingError) {
      try {
        const { notifyOwner } = await import("./_core/notification");
        await notifyOwner({
          title: "🔴 שגיאת חיוב OpenAI — נדרש טעינת כרטיס",
          content: `שגיאת billing ב-תמונה לקווים:\n${message}\n\nנא להיכנס ל-OpenAI ולטעון את הכרטיס: https://platform.openai.com/settings/organization/billing`,
        });
      } catch (_) { /* ignore notification errors */ }
    }
  }
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
            message: "חשבונך חסום. לפרטים פנה לתמיכה.",
            messageEn: "Your account has been blocked. Please contact support.",
          });
        }
      }

      // ── Token check (balance only — deduction happens after successful job) ────
      const tokenResult = await deductTokens(appUser.userId, "ai_trace", { checkOnly: true });
      if (!tokenResult.success) {
        return res.status(402).json({
          error: "INSUFFICIENT_TOKENS",
          balance: tokenResult.balance,
          message: "נגמרו לך האסימונים. יש לטעון אסימונים להמשך שימוש.",
          messageEn: "You have run out of tokens. Please purchase more tokens to continue.",
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
      // Auto-correct EXIF orientation (iPhone photos often arrive with orientation=6 = 90° rotated).
      // sharp().rotate() with no args reads the EXIF Orientation tag and rotates accordingly,
      // then strips the EXIF so downstream processing sees a correctly-oriented image.
      imageBuffer = await sharp(imageBuffer).rotate().toBuffer();

      // Resize for LLM analysis
      const resized = await sharp(imageBuffer)
        .resize(512, 512, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer();
      const imageBase64 = resized.toString("base64");

      const userDesc = (req.body?.description || "").trim();
      const focusText = (req.body?.focusText || "").trim();
      const landscapeMode = req.body?.landscapeMode === "true" || req.body?.landscapeMode === true;
      const lang = ((req.body?.lang as string) || "en") === "he" ? "he" : "en";
      const variationIndex = Math.min(2, Math.max(0, parseInt((req.body?.variationIndex as string) ?? "0", 10)));
      const hairline = req.body?.hairline === "true" || req.body?.hairline === true;
      const singleLine = req.body?.singleLine === "true" || req.body?.singleLine === true;
      const closePaths = req.body?.closePaths === "true" || req.body?.closePaths === true;
      const lineweightMmRaw = parseFloat((req.body?.lineweightMm as string) ?? "");
      const lineweightMm = isNaN(lineweightMmRaw) ? undefined : Math.min(2.0, Math.max(0, lineweightMmRaw));
      const rawIp = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
      const ipAnon = anonymizeIp(rawIp);

      // Upload original image to S3 for history display
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
        console.warn("[aiTraceRoute] Failed to upload source image:", e);
      }

      // Create job and start background processing
      // Token deduction happens INSIDE the job after successful completion.
      const jobId = nanoid(12);
      createJob(jobId, appUser.userId, "ai_trace");

      // 5-minute hard timeout — if job takes longer, mark as error and stop
      const MAX_JOB_MS = 5 * 60 * 1000;
      const timeoutPromise = new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error("Job timed out after 5 minutes")), MAX_JOB_MS)
      );
      Promise.race([
        runTraceJob(jobId, imageBuffer, imageBase64, userDesc, focusText, landscapeMode, lang, appUser.userId, ipAnon ?? "", uploadedSourceImageUrl, variationIndex, hairline, lineweightMm, singleLine, closePaths),
        timeoutPromise,
      ]).catch((err) => {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[aiTraceRoute] Job error/timeout:", msg);
        const job = getJob(jobId);
        if (job && job.status !== "done" && job.status !== "cancelled") {
          updateJob(jobId, {
            status: "error",
            error: msg.includes("timed out")
              ? "העיבוד ארך יותר מדי. נסה שוב או נסה תמונה פשוטה יותר."
              : msg,
          });
        }
      });

      return res.json({ jobId });

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

// ─── GET /api/ai-trace/job/:jobId ─────────────────────────────────────────────
router.get("/api/ai-trace/job/:jobId", (req, res) => {
  const appUser = getAppUserFromCookie(req.cookies);
  if (!appUser) return res.status(401).json({ error: "UNAUTHORIZED" });

  const job = getJob(req.params.jobId);
  if (!job) return res.status(404).json({ error: "JOB_NOT_FOUND" });
  if (job.userId !== appUser.userId) return res.status(403).json({ error: "FORBIDDEN" });

  if (job.status === "done") {
    return res.json({ status: "done", result: job.result });
  } else if (job.status === "error") {
    const rawError = job.error ?? "";
    let friendlyMessage: string;
    if (job.errorCode === "CONTENT_POLICY") {
      friendlyMessage = "הבקשה נדחתה על ידי מסנן התוכן של AI. נסה תמונה אחרת — הימנע מתוכן פוגעני, דמויות מוגנות בזכויות יוצרים, או תוכן לא הולם.";
    } else if (rawError.toLowerCase().includes("timed out") || rawError.toLowerCase().includes("timeout")) {
      friendlyMessage = "העיבוד לקח יותר מדי זמן. נסה שוב עם תמונה פשוטה יותר.";
    } else if (rawError.toLowerCase().includes("quota") || rawError.toLowerCase().includes("billing")) {
      friendlyMessage = "שירות ה-AI אינו זמין כרגע. נסה שוב מאוחר יותר.";
    } else {
      friendlyMessage = `שגיאה: ${rawError}`;
    }
    return res.json({ status: "error", error: job.error, errorCode: job.errorCode, message: friendlyMessage });
  } else if (job.status === "cancelled") {
    return res.json({ status: "cancelled" });
  } else {
    // Include partialImages so client can show streaming results as each image completes
    return res.json({
      status: job.status,
      step: job.step,
      stepEn: job.stepEn,
      partialImages: job.partialImages ?? [],
    });
  }
});

// ─── POST /api/ai-trace/cancel/:jobId ─────────────────────────────────────────
router.post("/api/ai-trace/cancel/:jobId", async (req, res) => {
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
    // Only refund if tokens were actually deducted (prevents phantom refunds)
    if (job.tokenDeducted) {
      try {
        const refundCost = await getTokenCostForAction((job.tokenAction as string) || "ai_trace");
        await addTokens(appUser.userId, refundCost, "refund", "Job cancelled — tokens refunded");
      } catch (refundErr) {
        console.error("[aiTraceRoute] Refund error:", refundErr);
      }
    }
    // Record cancelled action in user history
    void recordUserAction({
      appUserId: appUser.userId,
      actionType: "ai_generate",
      description: "ai_trace — בוטל",
      feature: "ai_trace",
      status: "cancelled",
    });
    return res.json({ cancelled: true });
  }

  return res.json({ cancelled: false, reason: "Job already finished" });
});

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

      const { previewPngUrl, previewPngBase64, description, imageUrl, hairline: hairlineParam, lineweightMm: lwMmParam } = req.body;
      const rawIp2 = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
      const ipAnon = anonymizeIp(rawIp2);
      const hairline = hairlineParam === true || hairlineParam === "true";
      const lineweightMmRaw2 = parseFloat((lwMmParam as string) ?? "");
      const lineweightMm2 = isNaN(lineweightMmRaw2) ? undefined : Math.min(2.0, Math.max(0, lineweightMmRaw2));

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

      // Pre-process and run potrace — blur merges thick lines to reduce double contours
      const processedBuffer = await sharp(pngBuffer)
        .grayscale()
        .blur(1.5)
        .threshold(160)
        .png()
        .toBuffer();

      const rawSvg = await pngToSvg(processedBuffer);
      const svgPreview = cleanSvgForPreview(rawSvg);

      const { dxf, segmentCount, realWidth, realHeight } = svgToDxf(rawSvg, hairline, lineweightMm2);

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
        feature: "ai_trace",
        ipAnon: ipAnon ?? undefined,
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

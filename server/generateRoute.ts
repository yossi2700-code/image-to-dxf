import { Router } from "express";
import { storagePut } from "./storage";
import { nanoid } from "nanoid";
import { logUsageEvent, anonymizeIp } from "./usageDb";
import { getAppUserFromCookie } from "./appAuth";
import { recordUserAction } from "./userActionsDb";
import { deductTokens } from "./tokenService";
import { createJob, getJob, updateJob, cancelJob } from "./jobStore";
import { svgToDxf } from "./svgToDxf";
import { cleanSvgForPreview } from "./svgClean";
import potrace from "potrace";
import sharp from "sharp";
import { notifyOwner } from "./_core/notification";
import { ENV } from "./_core/env";
const router = Router();

/**
 * Call Manus Forge ImageService to generate an image from a text prompt.
 * Returns raw image buffer (base64 decoded).
 */
async function forgeGenerateImage(prompt: string, signal?: AbortSignal): Promise<Buffer> {
  const baseUrl = ENV.forgeApiUrl?.endsWith("/") ? ENV.forgeApiUrl : `${ENV.forgeApiUrl}/`;
  const fullUrl = new URL("images.v1.ImageService/GenerateImage", baseUrl).toString();
  const response = await fetch(fullUrl, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "connect-protocol-version": "1",
      authorization: `Bearer ${ENV.forgeApiKey}`,
    },
    body: JSON.stringify({ prompt, original_images: [] }),
    signal,
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Forge ImageService error (${response.status}): ${detail}`);
  }
  const result = (await response.json()) as { image: { b64Json: string; mimeType: string } };
  return Buffer.from(result.image.b64Json, "base64");
};

/**
 * Three distinct style variations for the same subject.
 */
const STYLE_VARIATIONS = [
  {
    label: "simple",
    style:
      "VARIATION 1 — ARTISTIC CLEAN OUTLINE: Draw a professional, elegant line art illustration. " +
      "Bold confident outer contour with 5-8 key structural lines that define the form. " +
      "The style should look like a skilled artist's clean sketch — NOT a child's coloring book. " +
      "Think of a high-end brand logo or a professional product illustration. " +
      "Minimal but sophisticated. " +
      "CRITICAL VECTOR RULES: Each line MUST be a SINGLE STROKE — absolutely NO double lines, NO parallel line pairs, NO outlined strokes. " +
      "Every line is one pixel wide at its core. NO texture, NO hatching, NO crosshatching, NO shading, NO fill, NO gray areas. " +
      "ONLY pure black (#000000) single-stroke lines on pure white (#FFFFFF) background. " +
      "TEXT/LETTERS RULE — CRITICAL: Any text or letters in the image MUST be drawn as a SINGLE THIN LINE tracing the shape of each letter stroke — like a centerline skeleton. " +
      "NEVER draw a double outline around letters. NEVER draw two parallel lines to form a letter stroke. " +
      "Each letter stroke = exactly ONE thin line following the centerline of the stroke. No fill, no outline, no double contour. " +
      "PRESERVE the exact shape and proportions. " +
      "CRITICAL FRAMING: The object must occupy NO MORE than 65% of the image width AND height. " +
      "Leave at least 17% white margin on EVERY side (left, right, top, bottom). " +
      "The object must be FULLY VISIBLE — nothing cut off, nothing touching or near the border.",
  },
  {
    label: "detailed",
    style:
      "VARIATION 2 — SHARP PRECISE MODERATE: Draw the complete object with all main structural features " +
      "and key details, but keep the line count moderate — not too sparse, not too dense. " +
      "Bold outer contour with clean inner lines showing the main components and surfaces. " +
      "Like a professional product catalog illustration. " +
      "CRITICAL VECTOR RULES: Each line MUST be a SINGLE STROKE — absolutely NO double lines, NO parallel line pairs, NO outlined strokes. " +
      "Every line is one pixel wide at its core. NO texture, NO hatching, NO crosshatching, NO shading, NO fill, NO gray areas. " +
      "ONLY pure black (#000000) single-stroke lines on pure white (#FFFFFF) background. PRESERVE the exact shape. " +
      "TEXT/LETTERS RULE — CRITICAL: Any text or letters in the image MUST be drawn as a SINGLE THIN LINE tracing the shape of each letter stroke — like a centerline skeleton. " +
      "NEVER draw a double outline around letters. NEVER draw two parallel lines to form a letter stroke. " +
      "Each letter stroke = exactly ONE thin line following the centerline of the stroke. No fill, no outline, no double contour. " +
      "CRITICAL FRAMING: The object must occupy NO MORE than 65% of the image width AND height. " +
      "Leave at least 17% white margin on EVERY side (left, right, top, bottom). " +
      "The object must be FULLY VISIBLE — nothing cut off, nothing touching or near the border.",
  },
  {
    label: "complex",
    style:
      "VARIATION 3 — MODERATELY COMPLEX DETAILED: Draw the complete object with slightly more detail " +
      "than variation 2 — add secondary features and subtle structural elements. " +
      "A bit richer and more elaborate, but still clean and controlled — not overwhelming. " +
      "Like a detailed technical product illustration with extra refinement. " +
      "CRITICAL VECTOR RULES: Each line MUST be a SINGLE STROKE — absolutely NO double lines, NO parallel line pairs, NO outlined strokes. " +
      "Every line is one pixel wide at its core. NO hatching, NO crosshatching, NO shading, NO fill, NO gray areas, NO texture fills. " +
      "ONLY pure black (#000000) single-stroke lines on pure white (#FFFFFF) background. PRESERVE the exact shape. All lines clean and precise. " +
      "TEXT/LETTERS RULE — CRITICAL: Any text or letters in the image MUST be drawn as a SINGLE THIN LINE tracing the shape of each letter stroke — like a centerline skeleton. " +
      "NEVER draw a double outline around letters. NEVER draw two parallel lines to form a letter stroke. " +
      "Each letter stroke = exactly ONE thin line following the centerline of the stroke. No fill, no outline, no double contour. " +
      "CRITICAL FRAMING: The object must occupy NO MORE than 65% of the image width AND height. " +
      "Leave at least 17% white margin on EVERY side (left, right, top, bottom). " +
      "The object must be FULLY VISIBLE — nothing cut off, nothing touching or near the border.",
  },
];

const LANDSCAPE_STYLE_VARIATIONS = [
  {
    label: "simple",
    style:
      "Simple clean landscape outline. Bold horizon line, clear silhouettes of all elements (buildings, trees, mountains, sky). " +
      "Capture the full panoramic scene — foreground, midground, background. " +
      "NO texture, NO hatching, NO shading, NO fill. Clean minimal lines only. " +
      "CRITICAL FRAMING: The entire scene must fit within 75% of the image. Leave at least 10% white margin on every edge.",
  },
  {
    label: "detailed",
    style:
      "Detailed landscape line art. Clear horizon with rich detail in all layers: sky elements (clouds, sun), " +
      "background (mountains, distant buildings), midground (trees, structures), foreground (ground, plants, paths). " +
      "Every visible element drawn with clean distinct lines. NO texture, NO hatching, NO shading, NO fill. " +
      "CRITICAL FRAMING: The entire scene must fit within 75% of the image. Leave at least 10% white margin on every edge.",
  },
  {
    label: "decorative",
    style:
      "Elegant decorative landscape line art. Flowing artistic lines capturing the full scenic view. " +
      "Detailed silhouettes of all scene elements with decorative inner line work. " +
      "NO texture, NO hatching, NO shading, NO fill. " +
      "CRITICAL FRAMING: The entire scene must fit within 75% of the image. Leave at least 10% white margin on every edge.",
  },
];

function buildLandscapePrompt(userPrompt: string, variationIndex: number): string {
  const variation = LANDSCAPE_STYLE_VARIATIONS[variationIndex % LANDSCAPE_STYLE_VARIATIONS.length];
  return (
    // Lead with the absolute no-text rule
    "ABSOLUTE RULE #1 \u2014 NO TEXT ANYWHERE: Do NOT include any text, letters, words, numbers, labels, captions, watermarks, signatures, or typography of ANY kind anywhere in the image. " +
    "This is a VISUAL ILLUSTRATION ONLY. The user's description is WHAT TO DRAW as a picture, not what to write as text. " +
    "Do NOT render any part of the description as text, letters, or words. " +
    "If the description mentions a brand name, product name, or word \u2014 draw the OBJECT or CONCEPT visually, do NOT write the name. " +
    `Clean black and white line art of a landscape scene: ${userPrompt}. ` +
    "Pure white background (#FFFFFF). " +
    "Bold thick black outlines (3-5px stroke width), no fill, no shading, no gradients. " +
    "High contrast: only pure black (#000000) lines on white. " +
    "IMPORTANT: Draw the ENTIRE scene \u2014 all elements visible in the landscape (sky, horizon, buildings, trees, mountains, water, foreground). " +
    "Do NOT focus on a single object \u2014 capture the full panoramic view. " +
    `${variation.style} ` +
    "CRITICAL FRAMING: The entire scene MUST fit completely inside the square frame. " +
    "Scale the scene so it occupies at most 80% of the canvas. " +
    "Leave at least 10% white margin on EVERY edge (top, bottom, left, right). " +
    "NOTHING must touch or go beyond the image border. All elements fully visible, nothing cropped. " +
    "FINAL REMINDER: Zero text, zero letters, zero numbers anywhere. Pure visual illustration only. " +
    "FINAL CHECK: scan the entire image \u2014 if ANY letter, digit, or text character appears anywhere, the output is REJECTED."
  );
}

/**
 * Detect if the user prompt contains quoted text or explicit text-to-render instructions.
 * e.g. 'logo with text "Hello"', 'כתוב: שלום', 'with the words ABC'
 * Returns the exact text strings that should appear in the image.
 */
function detectExactTextInPrompt(userPrompt: string): string[] {
  const results: string[] = [];
  // Match quoted strings: "...", '...', «...», or Hebrew-style quotes
  let m: RegExpExecArray | null;
  const quoteRe = /["'«»“”‘’]([^"'«»“”‘’]{1,80})["'«»“”‘’]/g;
  while ((m = quoteRe.exec(userPrompt)) !== null) results.push(m[1].trim());
  // Match explicit text instructions: "כתוב:", "הכיתוב:", "with text:", "text:", "the words:"
  const labelMatch = userPrompt.match(/(?:כתוב|הכיתוב|הטקסט|with text|text:|the words?|label)[:\s]+([\u0590-\u05FF\w][^,\.\n]{1,80})/i);
  if (labelMatch) results.push(labelMatch[1].trim());
  // Deduplicate
  const seen = new Set<string>();
  return results.filter(t => { if (seen.has(t) || !t) return false; seen.add(t); return true; });
}

/**
 * Detect if the user prompt contains a scene/context keyword alongside an object.
 * e.g. "bluey landscape", "cat in forest", "dog on beach"
 */
function detectObjectAndScene(userPrompt: string): { hasScene: boolean; sceneKeywords: string } {
  const scenePatterns = /\b(landscape|nof|nof teva|nature|forest|beach|mountain|city|jungle|garden|park|ocean|sea|desert|space|sky|field|meadow|river|lake|snow|winter|summer|sunset|sunrise|night|rain|storm|countryside|village|street|urban|indoor|outdoor|background|scene|environment|setting|נוף|יער|חוף|הר|עיר|גן|פארק|ים|מדבר|חלל|שמים|שדה|נהר|אגם|שלג|חורף|קיץ|שקיעה|זריחה|לילה|גשם|כפר|רחוב)\b/i;
  const match = userPrompt.match(scenePatterns);
  return { hasScene: !!match, sceneKeywords: match ? match[0] : "" };
}

function buildLineArtPrompt(userPrompt: string, variationIndex: number): string {
  const variation = STYLE_VARIATIONS[variationIndex % STYLE_VARIATIONS.length];
  const { hasScene } = detectObjectAndScene(userPrompt);
  const exactTexts = detectExactTextInPrompt(userPrompt);
  const hasExactText = exactTexts.length > 0;

  // Build text instruction: if user specified exact text, enforce it precisely
  const TEXT_SINGLE_LINE_RULE =
    "TEXT/LETTERS DRAWING RULE — ABSOLUTE: Any text or letters MUST be drawn as a SINGLE THIN LINE tracing the centerline of each letter stroke — like a wire skeleton. " +
    "NEVER draw a double outline around letters. NEVER draw two parallel lines to form a letter stroke. " +
    "Each letter stroke = exactly ONE thin line following the center of the stroke. No fill, no outline, no double contour. ";
  const textRule = hasExactText
    ? `CRITICAL TEXT RULE — The illustration MUST include the following text written EXACTLY, letter by letter, with NO spelling errors, NO missing letters, NO added letters: ${exactTexts.map(t => `"${t}"`).join(', ')}. ` +
      `Render this text clearly and legibly in the image. The text must match EXACTLY what is specified above. ` +
      TEXT_SINGLE_LINE_RULE
    : `ABSOLUTE RULE #1 — NO TEXT ANYWHERE: Do NOT include any text, letters, words, numbers, labels, captions, watermarks, signatures, or typography of ANY kind anywhere in the image. ` +
      `This is a VISUAL ILLUSTRATION ONLY. The user's description is WHAT TO DRAW as a picture, not what to write as text. ` +
      `Do NOT render any part of the description as text, letters, or words. ` +
      `If the description mentions a brand name, product name, or word — draw the OBJECT or CONCEPT visually, do NOT write the name. ` +
      `FINAL CHECK: scan the entire image — if ANY letter, digit, or text character appears anywhere, the output is REJECTED.`;

  // If user prompt contains both an object AND a scene (e.g. "bluey landscape"),
  // use the landscape-style prompt to render the object within the scene
  if (hasScene) {
    return (
      `${textRule} ` +
      `Professional black and white line art illustration: ${userPrompt}. ` +
      "IMPORTANT: If the prompt mentions a specific character, creature, or object (e.g. Bluey, a cat, a dog), " +
      "that character/object MUST be the MAIN FOCUS of the illustration, prominently placed in the scene. " +
      "Draw the character/object INSIDE the described scene/environment. " +
      "Pure white background (#FFFFFF). Bold thick black outlines, no fill, no shading, no gradients. " +
      "High contrast: only pure black (#000000) lines on white. " +
      `${variation.style} ` +
      "CRITICAL FRAMING: The entire scene with the character must fit completely inside the frame. " +
      "Leave at least 10% white margin on every edge. Nothing cropped."
    );
  }

  return (
    `${textRule} ` +
    `Professional black and white line art illustration of ${userPrompt}. ` +
    "Pure white background (#FFFFFF). " +
    "Bold thick black outlines (3-5px stroke width), no fill, no shading, no gradients. " +
    "High contrast: only pure black (#000000) lines on white. " +
    "CRITICAL FRAMING RULE: The object MUST be scaled small enough to fit entirely within the CENTER of the image. " +
    "The object must occupy NO MORE than 65% of the image width AND height. " +
    "There MUST be at least 17% white empty space on EVERY side (top, bottom, left, right). " +
    "The object must be FULLY VISIBLE \u2014 nothing cut off, nothing touching or near the border. " +
    "Show depth and structure with clear internal lines. " +
    `${variation.style}`
  );
}

/** Simple Hebrew → Latin transliteration map for common words */
const HE_TO_EN_GEN: Record<string, string> = {
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

/**
 * Three professional AutoCAD-style variations for architectural drawings.
 * Each variation includes English room labels, dimension lines, and CAD conventions.
 */
const ARCH_STYLE_VARIATIONS = [
  {
    label: "schematic",
    style:
      "VARIATION 1 — SCHEMATIC WITH LABELS: Draw a clean AutoCAD-style floor plan schematic. " +
      "WALLS: Outer walls as thick double parallel lines (30cm gap). Interior partition walls as thinner double lines (15cm gap). " +
      "DOORS: Show door swing arcs (quarter-circle arc with a straight door line). " +
      "WINDOWS: Show as three parallel lines in wall openings. " +
      "ROOM LABELS: Write the room name in ALL CAPS English inside each room (e.g. BEDROOM, LIVING ROOM, KITCHEN, BATHROOM, CORRIDOR, BALCONY, STORAGE). " +
      "Use a clean sans-serif CAD font. Labels centered in each room space. " +
      "No furniture, no dimension lines, no hatching, no fill, no shading. " +
      "Pure white background (#FFFFFF), pure black (#000000) lines and text only.",
  },
  {
    label: "standard",
    style:
      "VARIATION 2 — STANDARD PLAN WITH DIMENSIONS: Draw a professional AutoCAD-style floor plan. " +
      "WALLS: Outer walls as thick double parallel lines (30cm gap). Interior walls as thinner double lines (15cm gap). " +
      "DOORS: Door swing arcs showing opening direction. " +
      "WINDOWS: Three parallel lines in wall openings. " +
      "ROOM LABELS: Write room names in ALL CAPS English inside each room (BEDROOM, LIVING ROOM, KITCHEN, BATHROOM, etc.). " +
      "DIMENSIONS: Add dimension lines along the outer perimeter of the building. " +
      "Dimension lines use the standard AutoCAD style: a thin line with tick marks or arrows at each end, " +
      "and the measurement number written above the line in English (e.g. '5.00 m', '3.50 m'). " +
      "Show at least 4 overall dimensions (width and length of each side). " +
      "No furniture, no hatching, no fill, no shading. " +
      "Pure white background (#FFFFFF), pure black (#000000) lines and text only.",
  },
  {
    label: "furnished",
    style:
      "VARIATION 3 — FURNISHED PLAN WITH LABELS AND DIMENSIONS: Draw a complete AutoCAD-style floor plan. " +
      "WALLS: Outer walls as thick double parallel lines (30cm gap). Interior walls as thinner double lines (15cm gap). " +
      "DOORS: Door swing arcs. WINDOWS: Three parallel lines in wall openings. " +
      "ROOM LABELS: Write room names in ALL CAPS English inside each room (BEDROOM, LIVING ROOM, KITCHEN, BATHROOM, etc.). " +
      "DIMENSIONS: Add dimension lines along the outer perimeter with measurements in English (e.g. '5.00 m'). " +
      "FURNITURE: Add simple furniture outlines as thin single lines: " +
      "rectangles for beds/sofas/tables, circles for chairs/stools, " +
      "L-shape counter for kitchen, toilet + sink symbols in bathrooms. " +
      "All furniture as thin single-line outlines only — no fill, no shading, no hatching. " +
      "Pure white background (#FFFFFF), pure black (#000000) lines and text only.",
  },
];

/**
 * Build an architectural-specific prompt for AutoCAD-quality drawings.
 * Generates professional floor plans with English room labels, dimension lines,
 * and proper CAD drafting conventions.
 */
function buildArchitecturalDrawingPrompt(userPrompt: string, variationIndex: number): string {
  const variation = ARCH_STYLE_VARIATIONS[variationIndex % ARCH_STYLE_VARIATIONS.length];
  return (
    // Core drawing type instruction
    "Professional AutoCAD architectural drawing. " +
    "This image must look exactly like a technical drawing exported from AutoCAD or similar CAD software. " +
    // Critical CAD style rules
    "CRITICAL CAD STYLE RULES: " +
    "(1) ALL wall lines must be DOUBLE PARALLEL lines (two lines with a gap = wall thickness). " +
    "(2) NO single-line walls — every wall must show both faces as two parallel lines. " +
    "(3) NO fill, NO shading, NO gradients, NO gray areas, NO hatching patterns. " +
    "(4) Pure white background (#FFFFFF) with pure black (#000000) lines only. " +
    "(5) Clean sharp 90-degree corners where walls meet — walls must connect properly. " +
    "(6) Line weights: outer walls = thicker lines, interior walls = medium lines, furniture = thin lines. " +
    "(7) All text must be in English, clean sans-serif CAD font (like AutoCAD's standard font). " +
    // User's architectural parameters
    `Drawing specification: ${userPrompt}. ` +
    // Variation-specific style
    `${variation.style} ` +
    // Framing
    "CRITICAL FRAMING: The entire drawing must fit within 75% of the image canvas. " +
    "Leave at least 12% white margin on every edge (top, bottom, left, right) for dimension lines. " +
    "Nothing must touch or exceed the image border. All elements fully visible."
  );
}

function promptToFilename(prompt: string): string {
  // First try English/ASCII words
  const englishWords = prompt
    .trim()
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 1);

  if (englishWords.length > 0) {
    let name = "";
    for (const w of englishWords) {
      const next = name ? `${name}_${w}` : w;
      if (next.length > 20) break;
      name = next;
    }
    return (name || "design").slice(0, 20).replace(/_+$/, "");
  }

  // Try Hebrew transliteration
  const hebrewWords = prompt
    .replace(/[^\u0590-\u05FF\s]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(w => w.length > 0);

  const transliterated: string[] = [];
  for (const w of hebrewWords) {
    const en = HE_TO_EN_GEN[w];
    if (en) transliterated.push(en);
  }

  if (transliterated.length > 0) {
    let name = "";
    for (const w of transliterated) {
      const next = name ? `${name}_${w}` : w;
      if (next.length > 20) break;
      name = next;
    }
    return (name || "design").slice(0, 20).replace(/_+$/, "");
  }

  return "design";
}

function pngToSvg(pngBuffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    potrace.trace(pngBuffer, {
      threshold: 128,
      turdSize: 80,       // increased from 40 → removes more noise/hatching remnants
      alphaMax: 1.0,      // smoother corners
      optCurve: true,
      optTolerance: 0.4,  // balanced smoothness
    }, (err: Error | null, svg: string) => {
      if (err) reject(err);
      else resolve(svg);
    });
  });
}

/**
 * Architectural-specific potrace: higher turdSize removes hatching remnants,
 * lower optTolerance keeps straight wall lines sharp and angular.
 */
function pngToSvgArchitectural(pngBuffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    potrace.trace(pngBuffer, {
      threshold: 128,
      turdSize: 120,      // remove hatching dots/remnants (much larger than default 40)
      alphaMax: 0.2,      // sharp corners for walls (architectural lines are straight)
      optCurve: true,
      optTolerance: 0.2,  // tight tolerance: straight walls stay straight
    }, (err: Error | null, svg: string) => {
      if (err) reject(err);
      else resolve(svg);
    });
  });
}

/**
 * Core processing function — runs in background after job is created.
 */
async function runGenerateJob(
  jobId: string,
  prompt: string,
  modifications: string | undefined,
  landscapeMode: boolean,
  appUserId: number,
  ipAnon: string,
  hairline = false,
  lineweightMm?: number,
  minGapMm = 0,
  preGroupId?: string,
  isArchitectural = false
) {
  const jobStartTime = Date.now();
  // AbortController for cancelling in-flight OpenAI requests when timeout fires
  const abortController = new AbortController();
  // Hard 5-minute internal timeout
  const JOB_TIMEOUT_MS = 5 * 60 * 1000;
  const internalTimeoutId = setTimeout(() => {
    abortController.abort();
    const job = getJob(jobId);
    if (job && job.status !== "done" && job.status !== "cancelled") {
      updateJob(jobId, {
        status: "error",
        error: "Processing timed out after 5 minutes. Try a simpler prompt.",
      });
    }
  }, JOB_TIMEOUT_MS);
  try {
    updateJob(jobId, { status: "processing" });

    const jobCheck = getJob(jobId);
    if (!jobCheck || jobCheck.status === "cancelled") return;

    const fullPrompt = modifications ? `${prompt}. Modifications: ${modifications}` : prompt;
    const baseFilename = promptToFilename(prompt);

    const generationPromises = Array.from({ length: 3 }, async (_, idx) => {
      const imagePrompt = isArchitectural
        ? buildArchitecturalDrawingPrompt(fullPrompt, idx)
        : landscapeMode
        ? buildLandscapePrompt(fullPrompt, idx)
        : buildLineArtPrompt(fullPrompt, idx);

      const rawBuffer = await forgeGenerateImage(imagePrompt, abortController.signal);

      // blur(1.5) merges thick AI lines → eliminates double contours in potrace output
      // For architectural: aggressive cleanup — remove hatching, thin walls, keep structural lines only
      let sharpPipeline = sharp(rawBuffer)
        .extend({
          top: 140,
          bottom: 140,
          left: 100,
          right: 100,
          background: { r: 255, g: 255, b: 255, alpha: 1 },
        })
        .resize(1024, 1024, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
        .grayscale();

      if (isArchitectural) {
        // Architectural floor plan pipeline:
        // STEP 1: Upscale to 2048x2048 BEFORE threshold — more pixels = thinner, sharper lines in potrace
        // STEP 2: High threshold → only very dark structural lines survive (hatching is lighter gray)
        // STEP 3: Blur to merge double-wall lines into single lines
        // STEP 4: Second threshold pass to sharpen merged lines
        sharpPipeline = sharpPipeline
          .resize(2048, 2048, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 }, kernel: "lanczos3" })
          .threshold(210)   // very high: only darkest structural lines (hatching ≈ gray, filtered out)
          .blur(1.5)        // merge adjacent double-wall pixels into single line (scaled up, so slightly more blur)
          .threshold(185)   // second pass: sharpen merged lines
          .blur(0.5);       // final smooth to remove jagged potrace artifacts
      } else {
        // STEP 1: Upscale to 2048x2048 — more pixels = small details (letters, fine lines) survive blur
        // STEP 2: blur(1.5) — merges thick outline stroke edges into single centerline WITHOUT destroying small details
        // STEP 3: threshold(200) — removes gray, keeps only merged dark lines
        // STEP 4: blur(0.4) + threshold(185) — final sharpening pass for clean single strokes
        sharpPipeline = sharpPipeline
          .resize(2048, 2048, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 }, kernel: "lanczos3" })
          .blur(1.5)
          .threshold(200)
          .blur(0.4)
          .threshold(185);
      }

      const paddedBuffer = await sharpPipeline.png().toBuffer();

      const rawSvg = isArchitectural
        ? await pngToSvgArchitectural(paddedBuffer)
        : await pngToSvg(paddedBuffer);
      const cleanSvg = cleanSvgForPreview(rawSvg);

      const { dxf, segmentCount, width, height, realWidth, realHeight } = svgToDxf(rawSvg, hairline, lineweightMm, minGapMm);

      const imgKey = `ai-generated/${nanoid()}.png`;
      const { url: imageUrl } = await storagePut(imgKey, rawBuffer, "image/png");

      const variation = STYLE_VARIATIONS[idx % STYLE_VARIATIONS.length];
      const dxfFilename = `${baseFilename}_${variation.label}.dxf`;
      const dxfKey = `dxf-ai/${nanoid()}-${dxfFilename}`;
      const { url: dxfUrl } = await storagePut(dxfKey, Buffer.from(dxf, "utf-8"), "application/dxf");
      const svgFilename = `${baseFilename}_${variation.label}.svg`;
      const svgKey = `svg-ai/${nanoid()}-${svgFilename}`;
      const { url: svgUrl } = await storagePut(svgKey, Buffer.from(rawSvg, "utf-8"), "image/svg+xml");

      return { imageUrl, svgPreview: cleanSvg, dxfUrl, svgUrl, dxfFilename, segmentCount, width, height, realWidth, realHeight };
    });

    // Check cancelled after each image
    const images: Array<{ imageUrl: string; svgPreview: string; dxfUrl: string; svgUrl: string; dxfFilename: string; segmentCount: number; width: number; height: number; realWidth: number; realHeight: number }> = [];
    for (let i = 0; i < 3; i++) {
      const jobMid = getJob(jobId);
      if (!jobMid || jobMid.status === "cancelled") return;
      images.push(await generationPromises[i]);
    }

    const jobAfterGen = getJob(jobId);
    if (!jobAfterGen || jobAfterGen.status === "cancelled") return;

    // Deduct tokens NOW — only after all 3 images generated successfully
    await deductTokens(appUserId, "ai_generate");
    updateJob(jobId, { tokenDeducted: true });

    // Log usage
    const totalSegments = images.reduce((s, img) => s + img.segmentCount, 0);
    const totalFileSizeKb = Math.round(
      images.reduce((sum, img) => sum + Buffer.byteLength(img.svgPreview ?? "", "utf-8"), 0) / 1024
    );
    void logUsageEvent({
      type: "ai_generate",
      segmentCount: Math.round(totalSegments / images.length),
      ipAnon: anonymizeIp(ipAnon ?? undefined),
      durationMs: Date.now() - jobStartTime,
      fileSizeKb: totalFileSizeKb,
    });

    // Record user actions — use pre-generated groupId so all 3 variations share the same group
    const groupId = preGroupId ?? nanoid(12);
    const variationLabels = isArchitectural
      ? ["schematic", "standard", "furnished"]
      : landscapeMode
      ? ["simple", "detailed", "decorative"]
      : ["simple", "detailed", "complex"];
    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      void recordUserAction({
        appUserId,
        actionType: "ai_generate",
        description: fullPrompt.slice(0, 200),
        segmentCount: img.segmentCount,
        dxfUrl: img.dxfUrl,
        svgUrl: img.svgUrl,
        imageUrl: img.imageUrl,
        svgPreview: img.svgPreview,
        groupId,
        variationLabel: variationLabels[i] ?? `v${i + 1}`,
        feature: "ai_generate",
        durationMs: Date.now() - jobStartTime,
        ipAnon: ipAnon ?? undefined,
      });
    }

    clearTimeout(internalTimeoutId);
    updateJob(jobId, { status: "done", result: { success: true, images } });

  } catch (err: unknown) {
    clearTimeout(internalTimeoutId);
    console.error("[generateRoute] Job error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    // Don't overwrite a timeout error already set by internalTimeoutId
    const currentJob = getJob(jobId);
    if (currentJob && currentJob.status !== "error") {
      updateJob(jobId, { status: "error", error: message });
    }
    // No refund needed — tokens were not deducted yet (deduction happens only on success)
    // Record failed action in user history
    void recordUserAction({
      appUserId,
      actionType: "ai_generate",
      description: "ai_generate — נכשל",
      feature: "ai_generate",
      durationMs: Date.now() - jobStartTime,
      status: "failed",
      errorMessage: message.slice(0, 500),
    });
    // Alert admin if billing/quota issue
    const isBillingError = message.toLowerCase().includes("quota") ||
      message.toLowerCase().includes("billing") ||
      message.toLowerCase().includes("insufficient_quota") ||
      message.toLowerCase().includes("429") ||
      message.toLowerCase().includes("402");
    if (isBillingError) {
      try {
        await notifyOwner({
          title: "🔴 שגיאת חיוב Forge — בדוק הגדרות API",
          content: `שגיאת billing ב-AI Create:\n${message}\n\nבדוק את הגדרות BUILT_IN_FORGE_API_KEY`,
        });
      } catch (_) { /* ignore notification errors */ }
    }
  }
}

// ─── POST /api/generate-images ────────────────────────────────────────────────
router.post("/api/generate-images", async (req, res) => {
  try {
    const { prompt, modifications, landscapeMode, hairline, lineweightMm: lwMmGen, minGapMm: minGapMmRaw } = req.body as {
      prompt?: string;
      modifications?: string;
      landscapeMode?: boolean;
      hairline?: boolean;
      lineweightMm?: number;
      minGapMm?: number;
    };
    const lineweightMmGen = typeof lwMmGen === "number" ? Math.min(2.0, Math.max(0, lwMmGen)) : undefined;
    const minGapMmGen = typeof minGapMmRaw === "number" ? Math.min(3.0, Math.max(0, minGapMmRaw)) : 0;

    if (!prompt || prompt.trim().length < 2) {
      return res.status(400).json({ error: "נא להזין תיאור של התמונה הרצויה" });
    }

    // Block trademarked brand names — OpenAI refuses these and causes silent timeouts
    const BLOCKED_BRANDS = [
      // English brand names
      "disney", "mickey mouse", "minnie mouse", "donald duck", "goofy", "pluto",
      "marvel", "spider-man", "spiderman", "batman", "superman", "iron man", "ironman",
      "dc comics", "avengers", "pokemon", "pikachu", "nintendo", "mario", "luigi",
      "hello kitty", "sanrio", "looney tunes", "bugs bunny", "tom and jerry",
      "nike", "adidas", "apple", "google", "facebook", "meta", "microsoft",
      "coca-cola", "pepsi", "mcdonalds", "mcdonald's", "starbucks", "amazon",
      "ferrari", "lamborghini", "porsche", "bmw", "mercedes", "tesla",
      "louis vuitton", "gucci", "chanel", "prada", "versace", "rolex",
      "star wars", "harry potter", "lord of the rings",
      "youtube", "instagram", "twitter", "tiktok", "snapchat", "whatsapp",
      // Hebrew brand names
      "דיסני", "מיקי מאוס", "מארוול", "ספיידרמן", "באטמן", "סופרמן",
      "פוקימון", "פיקאצ'ו", "נינטנדו", "מריו",
      "נייקי", "אדידס", "אפל", "גוגל", "פייסבוק", "מטא", "מיקרוסופט",
      "קוקה קולה", "פפסי", "מקדונלד", "סטארבקס", "אמזון",
      "פרארי", "למבורגיני", "פורשה", "מרצדס", "טסלה",
      "לואי ויטון", "גוצ'י", "שאנל", "פראדה", "ורסאצ'ה", "רולקס",
      "מלחמת הכוכבים", "הארי פוטר",
      "יוטיוב", "אינסטגרם", "טוויטר", "טיקטוק", "סנאפצ'ט", "וואטסאפ",
    ];
    const promptLower = prompt.trim().toLowerCase();
    const promptOriginal = prompt.trim(); // Hebrew chars are not affected by toLowerCase
    const matchedBrand = BLOCKED_BRANDS.find(brand => promptLower.includes(brand) || promptOriginal.includes(brand));
    if (matchedBrand) {
      return res.status(422).json({
        error: "BRAND_BLOCKED",
        brand: matchedBrand,
        message: `לא ניתן ליצור לוגואים של מותגים רשומים ("${matchedBrand}"). נסה תיאור כללי, למשל: "לוגו עם טירה ועכבר" במקום "לוגו דיסני".`,
        messageEn: `Cannot generate logos of trademarked brands ("${matchedBrand}"). Try a generic description instead, e.g. "castle with mouse logo" instead of "Disney logo".`,
      });
    }

    const rawIp = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
    const ipAnon = anonymizeIp(rawIp);
    const appUser = getAppUserFromCookie(req.cookies);

    if (!appUser?.userId) {
      return res.status(401).json({ error: "REGISTRATION_REQUIRED", message: "נדרשת הרשמה כדי ליצור עיצובי AI" });
    }

    const { getDb } = await import("./db");
    const { appUsers } = await import("../drizzle/schema");
    const { eq } = await import("drizzle-orm");
    const dbConn = await getDb();
    if (dbConn) {
      const [userRow] = await dbConn.select({ isBlocked: appUsers.isBlocked }).from(appUsers).where(eq(appUsers.id, appUser.userId)).limit(1);
      if (userRow?.isBlocked) {
        return res.status(403).json({
          error: "USER_BLOCKED",
          message: "חשבונך חסום. לפרטים פנה לתמיכה.",
          messageEn: "Your account has been blocked. Please contact support.",
        });
      }
    }

    // Token check only — deduction happens after successful job completion
    const tokenResult = await deductTokens(appUser.userId, "ai_generate", { checkOnly: true });
    if (!tokenResult.success) {
      return res.status(402).json({
        error: "INSUFFICIENT_TOKENS",
        balance: tokenResult.balance,
        message: "נגמרו לך האסימונים. יש לטעון אסימונים להמשך שימוש.",
        messageEn: "You have run out of tokens. Please purchase more tokens to continue.",
      });
    }

    const jobId = nanoid(12);
    const jobGroupId = nanoid(12); // pre-generate groupId so all 3 variations share it
    createJob(jobId, appUser.userId, "ai_generate");

    // 5-minute hard timeout
    const MAX_GEN_JOB_MS = 5 * 60 * 1000;
    const genTimeoutPromise = new Promise<void>((_, reject) =>
      setTimeout(() => reject(new Error("Job timed out after 5 minutes")), MAX_GEN_JOB_MS)
    );
    const isArchitecturalReq = !!(req.body as { isArchitectural?: boolean }).isArchitectural;
    Promise.race([
      runGenerateJob(jobId, prompt.trim(), modifications, !!landscapeMode, appUser.userId, ipAnon ?? "", !!hairline, lineweightMmGen, minGapMmGen, jobGroupId, isArchitecturalReq),
      genTimeoutPromise,
    ]).catch((err) => {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error("[generateRoute] Job error/timeout:", msg);
      updateJob(jobId, { status: "error", error: msg });
    });

    return res.json({ jobId });

  } catch (err: unknown) {
    console.error("[generate-images]", err);
    const errMsg = err instanceof Error ? err.message : String(err);
    if (errMsg.toLowerCase().includes("quota") || errMsg.toLowerCase().includes("billing")) {
      return res.status(503).json({ error: "SERVICE_UNAVAILABLE", message: "שירות ה-AI אינו זמין כרגע." });
    }
    return res.status(500).json({ error: errMsg });
  }
});

// ─── GET /api/generate-images/job/:jobId ──────────────────────────────────────
router.get("/api/generate-images/job/:jobId", (req, res) => {
  const appUser = getAppUserFromCookie(req.cookies);
  if (!appUser) return res.status(401).json({ error: "UNAUTHORIZED" });

  const job = getJob(req.params.jobId);
  if (!job) return res.status(404).json({ error: "JOB_NOT_FOUND" });
  if (job.userId !== appUser.userId) return res.status(403).json({ error: "FORBIDDEN" });

  if (job.status === "done") {
    return res.json({ status: "done", result: job.result });
  } else if (job.status === "error") {
    const rawError = job.error ?? "";
    // Translate raw OpenAI safety/content errors into friendly messages
    let friendlyMessage: string;
    if (rawError.toLowerCase().includes("safety") || rawError.toLowerCase().includes("rejected") || rawError.toLowerCase().includes("content_policy") || rawError.toLowerCase().includes("content policy")) {
      friendlyMessage = "הבקשה נדחתה על ידי מסנן התוכן של AI. נסה תיאור אחר — הימנע ממותגים רשומים, תוכן פוגעני, או דמויות מוגנות בזכויות יוצרים.";
    } else if (rawError.toLowerCase().includes("timed out") || rawError.toLowerCase().includes("timeout")) {
      friendlyMessage = "העיבוד לקח יותר מדי זמן. נסה שוב עם תיאור פשוט יותר.";
    } else if (rawError.toLowerCase().includes("quota") || rawError.toLowerCase().includes("billing")) {
      friendlyMessage = "שירות ה-AI אינו זמין כרגע. נסה שוב מאוחר יותר.";
    } else {
      friendlyMessage = "שגיאה ביצירת התמונה. נסה שוב עם תיאור שונה.";
    }
    return res.json({ status: "error", error: job.error, message: friendlyMessage });
  } else if (job.status === "cancelled") {
    return res.json({ status: "cancelled" });
  } else {
    return res.json({ status: job.status });
  }
});

// ─── POST /api/generate-images/cancel/:jobId ──────────────────────────────────
router.post("/api/generate-images/cancel/:jobId", async (req, res) => {
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
    // No refund needed — tokens are only deducted after successful completion
    // Record cancelled action in user history
    void recordUserAction({
      appUserId: appUser.userId,
      actionType: "ai_generate",
      description: "ai_generate — בוטל",
      feature: "ai_generate",
      status: "cancelled",
    });
    return res.json({ cancelled: true });
  }

  return res.json({ cancelled: false, reason: "Job already finished" });
});

export default router;

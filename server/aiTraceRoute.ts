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

/** Convert description to safe filename — capped at 15 chars for clean download names */
// Words that come from AI analysis descriptions — not useful as filenames
const AI_NOISE_WORDS = new Set([
  "camera", "angle", "front", "view", "facing", "direction", "body", "pose",
  "position", "static", "sym", "the", "central", "flower", "faces", "directly",
  "forward", "with", "decorative", "swirls", "extending", "symmetrically",
  "left", "right", "and", "this", "is", "a", "an", "in", "of", "to", "from",
  "side", "profile", "rear", "top", "down", "low", "high", "style", "notes",
  "key", "structural", "features", "description",
]);
function buildFilename(description: string): string {
  const words = description
    .replace(/[^\u0590-\u05FFa-zA-Z0-9\s]/g, "")
    .trim()
    .split(/\s+/)
    .filter(w => w.length > 1 && !AI_NOISE_WORDS.has(w.toLowerCase()));
  let name = "";
  for (const w of words) {
    const next = name ? `${name}_${w}` : w;
    if (next.length > 20) break;
    name = next;
  }
  return (name || "ai_trace").slice(0, 20).replace(/_+$/, "");
}

/**
 * Three distinct style variations — same as generateRoute.
 */
const STYLE_VARIATIONS = [
  {
    label: "simple",
    style:
      "STRICT LINE ART ONLY: pure black (#000000) lines on pure white (#FFFFFF) background. " +
      "Draw outer silhouette and 10-15 key structural interior lines. " +
      "ABSOLUTELY NO: shading, shadows, gradients, grey tones, hatching, cross-hatching, stippling, texture fills, dark areas, filled regions. " +
      "Every enclosed area must be 100% pure white. Zero grey pixels allowed. " +
      "Lines must be SMOOTH, CONTINUOUS, and FLOWING — no jagged edges, no broken lines, no rough strokes. " +
      "Style: clean coloring-book outline drawing with smooth ink strokes.",
  },
  {
    label: "detailed",
    style:
      "STRICT LINE ART ONLY: pure black (#000000) lines on pure white (#FFFFFF) background. " +
      "Draw the outer silhouette PLUS all visible interior structural lines: panel edges, component boundaries, mechanical parts, joints, openings, slots, buttons, seams, and surface divisions. " +
      "Include 25-40 interior lines that define the object's structure and form. " +
      "ABSOLUTELY NO: texture, hatching, cross-hatching, shading, shadows, gradients, grey tones, stippling, filled regions, or any decorative marks. " +
      "Every enclosed area must be 100% pure white. Zero grey pixels allowed. " +
      "Lines must be SMOOTH, CONTINUOUS, and FLOWING — no jagged edges, no broken lines, no rough strokes. " +
      "Style: clean detailed technical line drawing — like a precise engineering illustration, outlines only, no fills.",
  },
  {
    label: "decorative",
    style:
      "STRICT LINE ART ONLY: pure black (#000000) lines on pure white (#FFFFFF) background. " +
      "Draw bold outer contour with flowing decorative inner lines. " +
      "ABSOLUTELY NO: shading, shadows, gradients, grey tones, hatching, cross-hatching, stippling, texture fills, dark areas, filled regions. " +
      "Every enclosed area must be 100% pure white. Zero grey pixels allowed. " +
      "Lines must be SMOOTH, CONTINUOUS, and FLOWING — no jagged edges, no broken lines, no rough strokes. " +
      "Style: ornamental line art with smooth flowing lines, suitable for laser engraving.",
  },
];

const SINGLE_LINE_STYLE =
  "STRICT LINE ART ONLY: pure black (#000000) thin single lines on pure white (#FFFFFF) background. " +
  "Draw only one line per edge — do not draw outlines with two parallel lines. " +
  "Use the thinnest possible strokes. No fill, no shading, no gradients, no grey tones. " +
  "Style: minimal wire-frame line drawing, every stroke is a single thin line.";

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
      step: isHe ? "מנתח תמונה עם AI..." : "Analyzing image with AI...",
      stepEn: "Analyzing image with AI...",
    });
    const jobCheck = getJob(jobId);
    if (!jobCheck || jobCheck.status === "cancelled") return;

    // Step A: LLM analyzes image with maximum accuracy
    let analysisInstruction: string;
    if (landscapeMode) {
      analysisInstruction = focusText
        ? `Describe this landscape scene for line art generation, focusing on: "${focusText}". ` +
          "Include ALL visible elements: sky, horizon, background, midground, foreground. " +
          "Describe the full panoramic composition with exact positions of each element. " +
          "Output ONLY the description (3-5 sentences), no preamble."
        : "Describe this landscape/scene for line art generation. " +
          "Include ALL visible elements: sky, horizon, background (mountains/buildings), midground (trees/structures), foreground (ground/plants). " +
          "Describe the full panoramic composition with exact positions. Output ONLY the description (3-5 sentences), no preamble.";
    } else if (focusText) {
      const isCroppedSelection = focusText === "CROPPED_SELECTION";
      analysisInstruction = isCroppedSelection
        ? "This image has already been cropped to show a specific object selected by the user. " +
          "Describe the MAIN OBJECT visible in this cropped image for line art generation. " +
          "CRITICAL: Describe ONLY what is in this cropped image — ignore nothing, add nothing. " +
          "Focus on: exact camera angle/view, facing direction, shape, structure, key features, proportions. " +
          "Output ONLY the description (2-4 sentences), no preamble."
        : `The user wants to draw: "${focusText}". ` +
          "Describe ONLY that specific element from the image in detail for line art generation. " +
          "Focus on: exact camera angle/view, facing direction, body pose, shape, structure, key features, proportions. " +
          "Output ONLY the description (2-4 sentences), no preamble.";
    } else {
      analysisInstruction = userDesc
        ? `Describe the main object for line art generation. Additional context from user: ${userDesc}. ` +
          "CRITICAL: Describe ONLY the physical object itself — its shape, structure, camera angle, proportions. " +
          "DO NOT mention people holding it, playing it, or interacting with it unless the user specifically asked to include a person. " +
          "DO NOT mention musical notes, decorative backgrounds, or contextual elements unless they are physically part of the object."
        : "Identify and describe the MAIN PHYSICAL OBJECT in this image for line art generation. " +
          "CRITICAL RULES: " +
          "(1) ALWAYS describe the COMPLETE PHYSICAL OBJECT as a whole — the bottle, shoe, bag, instrument, toy, etc. " +
          "(2) If the object has a label/sticker/print on it (e.g. a baby face on a bottle label), describe the WHOLE OBJECT including the label as part of it. Do NOT zoom in on the label character and ignore the object. " +
          "(3) If the most prominent element is a LETTER, NUMBER, SYMBOL, LOGO, or ENGRAVED/CARVED SHAPE on any surface — describe THAT EXACT SHAPE as the subject. Do NOT invent a character or figure around it. " +
          "(4) If the image shows an engraved, carved, stamped, or embossed letter/symbol on metal/wood/stone — describe the letter/symbol itself (e.g. 'The letter V in bold serif style, viewed from front'). " +
          "(5) If the image shows a PERSON or FACE as the main subject (not printed on a product), describe THAT PERSON. " +
          "(6) DO NOT mention background objects, secondary items, or anything behind the main subject. " +
          "(7) DO NOT mention musical notes, staff lines, or any musical notation. " +
          "(8) Focus on the SINGLE most visually dominant PHYSICAL OBJECT. " +
          "Focus on: exact camera angle/view, facing direction, shape, structure, key features, proportions.";
    }

    // For non-landscape mode, do a quick scene-type detection pass.
    // If it's a scene/landscape, return SCENE_DETECTED so the frontend can ask the user.
    const effectiveLandscapeMode = landscapeMode;
    if (!landscapeMode && !focusText) {
      try {
        const sceneCheckResp = await invokeLLM({
          messages: [
            {
              role: "system",
              content:
                "You are an image classifier. Look at the image and respond with EXACTLY one word: " +
                "'SCENE' if the image is a landscape, cityscape, street, nature scene, environment, room interior, architecture, or any image where NO single isolated object dominates the frame. " +
                "'OBJECT' if the image shows a single clear isolated object, person, animal, or product as the main subject. " +
                "Respond ONLY with SCENE or OBJECT, nothing else.",
            },
            {
              role: "user",
              content: [
                { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}`, detail: "low" } },
                { type: "text", text: "Is this a scene/landscape/environment or a single isolated object?" },
              ],
            },
          ],
        });
        const sceneCheckResult = ((sceneCheckResp as { choices?: Array<{ message?: { content?: string } }> })
          ?.choices?.[0]?.message?.content?.trim() || "").toUpperCase();
        if (sceneCheckResult.startsWith("SCENE")) {
          console.log(`[aiTraceRoute] Detected SCENE for job ${jobId} — asking user to confirm landscape mode`);
          updateJob(jobId, {
            status: "error",
            errorCode: "SCENE_DETECTED",
            error: isHe
              ? "זיהינו שזו תמונת נוף או סצנה. האם להמשיך במצב נוף (ציור כל הנוף)?"
              : "We detected this is a landscape or scene image. Continue in landscape mode (draw the full scene)?",
          });
          return;
        }
      } catch (e) {
        console.warn("[aiTraceRoute] Scene detection failed, continuing with object mode:", e);
      }
    }

    const llmResponse = await invokeLLM({
      messages: [
        {
          role: "system",
          content: effectiveLandscapeMode
            ? "You are a world-class expert at analyzing images for precise line art / engraving generation. " +
              "GOLDEN RULE: Describe ONLY what is LITERALLY VISIBLE in the image. " +
              "Your task is to describe the FULL SCENE/LANDSCAPE for line art generation. " +
              "Include ALL layers: sky, background, midground, foreground. Describe every visible element, its position, and its relative size. " +
              "Output ONLY the description (3-5 sentences), no preamble." +
              (isHe ? "\n\nIMPORTANT: Respond in HEBREW (עברית). All descriptions must be written in Hebrew." : "")
            :
            "You are a world-class expert at analyzing images for precise line art / engraving generation. " +
            "GOLDEN RULE: Describe ONLY what is LITERALLY VISIBLE in the image. DO NOT interpret, invent, imagine, or add anything that is not clearly shown. " +
            "If the image is ambiguous, blurry, abstract, or you cannot clearly identify the main subject, respond with EXACTLY: UNCLEAR_IMAGE " +
            "Your analysis will be used to generate line art that EXACTLY reproduces the OBJECT in the image. " +
            "CRITICAL CONSTRAINT: Identify and describe the MOST VISUALLY PROMINENT SUBJECT in the image. " +
            "The subject is the COMPLETE PHYSICAL OBJECT in the image — a bottle, shoe, bag, instrument, toy, person, animal, etc. " +
            "PACKAGING/LABEL RULE: If the object is a bottle, box, can, or container with a character/face printed on the label — describe the WHOLE OBJECT (e.g. 'A cylindrical baby cream bottle with a baby face illustration on the label, front view'). Do NOT describe only the label character and ignore the container. " +
            "LETTER/SYMBOL RULE: If the most prominent element is a LETTER, NUMBER, SYMBOL, LOGO, or ENGRAVED/CARVED/STAMPED SHAPE on any surface (metal, wood, stone, paper) — describe THAT EXACT LETTER OR SHAPE as the subject. Example: 'The letter V in bold serif style, front view, centered'. Do NOT invent a character, figure, or creature around a letter or symbol. " +
            "NEVER describe: (a) people holding/using the object unless they ARE the main subject, " +
            "(b) musical notes, staff lines, or musical notation, " +
            "(c) background objects or secondary items. " +
            "Focus on the SINGLE most visually dominant PHYSICAL OBJECT as a whole. " +
            "Accuracy is critical — any mistake in your description will cause the generated art to look wrong. " +
            "\n\nYou MUST describe ALL of the following with maximum precision:\n" +
            "(1) CAMERA ANGLE / VIEW TYPE — THE MOST CRITICAL DETAIL. State it first and be extremely specific:\n" +
            "    - PURE SIDE PROFILE: object is viewed from exactly 90 degrees to the side (like a coin profile). The viewer sees only one side.\n" +
            "    - FRONT VIEW: object faces directly toward the viewer, both eyes/sides visible symmetrically.\n" +
            "    - REAR VIEW: viewer sees the back of the object.\n" +
            "    - 3/4 FRONT-LEFT: viewer sees front + left side (object faces slightly right).\n" +
            "    - 3/4 FRONT-RIGHT: viewer sees front + right side (object faces slightly left).\n" +
            "    - TOP-DOWN: viewed from directly above.\n" +
            "    - LOW ANGLE: viewed from below looking up.\n" +
            "(2) FACING DIRECTION: which direction is the subject facing? (facing left, facing right, facing viewer, facing away).\n" +
            "(3) BODY POSE / POSITION: exact pose (standing upright, sitting, crouching, running, lying down, arms raised, etc.).\n" +
            "(4) KEY STRUCTURAL FEATURES: main body parts, proportions, distinctive features, decorative elements.\n" +
            "(5) STYLE NOTES: is it realistic, cartoon, stylized, ornamental, etc.?\n" +
              `Format: Start with 'Camera angle: [exact angle].' then describe the rest in 3-5 sentences. No preamble. If confused, respond ONLY with: UNCLEAR_IMAGE` +
            (isHe ? "\n\nIMPORTANT: Respond in HEBREW (עברית). All descriptions must be written in Hebrew." : ""),
        },
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}`, detail: "low" } },
            { type: "text", text: analysisInstruction },
          ],
        },
      ],
    });

    const jobAfterLlm = getJob(jobId);
    if (!jobAfterLlm || jobAfterLlm.status === "cancelled") return;

    const rawDescription =
      (llmResponse as { choices?: Array<{ message?: { content?: string } }> })
        ?.choices?.[0]?.message?.content?.trim() ||
      userDesc ||
      "the object in the image";

    // If AI couldn't identify the image, return an error asking for clarification
    // Skip this check if focusText is provided (user already chose crop/describe — bypass UNCLEAR_IMAGE)
    if (!focusText && (rawDescription === "UNCLEAR_IMAGE" || rawDescription.startsWith("UNCLEAR_IMAGE"))) {
      updateJob(jobId, {
        status: "error",
        errorCode: "UNCLEAR_IMAGE",
        error: isHe
          ? "התמונה לא ברורה מספיק או שהאובייקט לא זוהה. אנא הסבר בכתב מה בדיוק לצייר או נסה תמונה בהירה יותר."
          : "The image is unclear or the subject cannot be identified. Please describe in text what to draw, or try a clearer image.",
      });
      return;
    }

    const objectDescription = rawDescription;
    const baseFilename = buildFilename(userDesc || objectDescription);

    // Update step: generating image
    updateJob(jobId, {
      step: isHe ? `מייצר עיצוב מהתיאור: "${objectDescription.slice(0, 60)}..."` : `Generating design from: "${objectDescription.slice(0, 60)}..."`,
      stepEn: `Generating design from: "${objectDescription.slice(0, 60)}..."`,
    });

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

    // Initialize partialImages array for streaming results to client as each image completes
    updateJob(jobId, { partialImages: [] });

    // Generate only the selected variation (variationIndex: 0=simple, 1=detailed, 2=decorative)
    const generationPromises = [variationIndex].map(async (idx) => {
      const variation = STYLE_VARIATIONS[idx % STYLE_VARIATIONS.length];

      // Build a focused edit prompt: keep the shape, convert to line art
      // Detect if this is a portrait/face image from the LLM description
      // IMPORTANT: exclude animals, engravings, and non-human subjects from portrait mode
      const isAnimal = /\b(cat|dog|bird|fish|horse|lion|tiger|bear|rabbit|fox|wolf|deer|elephant|monkey|snake|turtle|frog|pig|cow|sheep|goat|chicken|duck|owl|eagle|parrot|hamster|mouse|rat|squirrel|animal|pet|kitten|puppy|paw|fur|feather|beak|tail|claw|mane|whisker|feline|canine|feline|bovine|equine|wildlife|zoo)\b/i.test(objectDescription);
      const isEngraving = /\b(engraving|engraved|gravestone|tombstone|memorial|stone|marble|granite|inscription|carved|carving|plaque|monument|headstone|matzeva|grave)\b/i.test(objectDescription);
      const isPortrait = !isAnimal && !isEngraving && /\b(face|portrait|person|man|woman|boy|girl|human|selfie|head|hair|eyes|nose|mouth|beard|cheek|forehead|chin|neck|ear)\b/i.test(objectDescription);
      // Detect if this is a toy, cartoon figure, or character figurine
      const isToyOrFigurine = /\b(toy|figurine|figure|doll|plush|stuffed|cartoon|character|action figure|miniature|statue|sculpture|puppet|mascot|anime|manga|bluey|lego|funko|pokemon|pikachu|sonic|mario|disney|pixar|robot|alien|monster|creature|animal figure)\b/i.test(objectDescription);
      const editPrompt = singleLine
        ? buildLineArtPrompt(objectDescription, idx, true)
        : effectiveLandscapeMode
        ? buildFullImagePrompt(objectDescription, idx)
        : (isPortrait && !isToyOrFigurine)
        ? (
            // Portrait prompt — preserve facial likeness
            `Convert this portrait photo to clean black and white line art suitable for laser engraving. ` +
            `Preserve the EXACT facial likeness: face shape, eye shape, nose, mouth, jawline, hair style. ` +
            `Keep the same pose, angle, and proportions. ` +
            `Use only pure black lines on pure white background. No shading, no grey tones, no gradients. ` +
            `${singleLine ? SINGLE_LINE_STYLE : variation.style} ` +
            `No text, no letters, no numbers anywhere.`
          )
        : isToyOrFigurine
        ? (
            // Toy/figurine prompt
            `Convert this toy/figurine/cartoon character to clean black and white line art suitable for laser engraving. ` +
            `Preserve the EXACT toy appearance: cartoon eyes, toy proportions, stylized features. ` +
            `Do NOT humanize — keep it looking like a toy/cartoon, not a real person. ` +
            `Use only pure black lines on pure white background. No shading, no grey tones. ` +
            `${singleLine ? SINGLE_LINE_STYLE : variation.style} ` +
            `No text, no letters, no numbers anywhere.`
          )
        : isAnimal
        ? (
            // Animal prompt — CRITICAL: preserve real animal proportions, NOT cartoon style
            `Convert this animal photo to clean black and white line art suitable for laser engraving. ` +
            `CRITICAL: Preserve the EXACT real appearance of this specific animal: ` +
            `the actual face shape, real eye shape and size, true nose/muzzle proportions, real fur texture direction, exact body pose. ` +
            `DO NOT simplify, stylize, cartoonify, or make it look like a children's drawing. ` +
            `DO NOT make the eyes large and round like a cartoon — keep the real eye shape from the photo. ` +
            `This must look like a realistic illustration of THIS specific animal, not a generic cute cartoon animal. ` +
            `Use only pure black (#000000) lines on pure white (#FFFFFF) background. No shading, no grey tones, no gradients. ` +
            `${singleLine ? SINGLE_LINE_STYLE : variation.style} ` +
            `No text, no letters, no numbers, no logos anywhere.`
          )
        : isMonochrome
        ? (
            // Monochrome/B&W source — strict tracing: preserve every line exactly as-is
            `This image is already a black and white line drawing. ` +
            `CRITICAL: Trace and reproduce the EXACT lines from this drawing — do NOT add, remove, or change any detail. ` +
            `Keep every branch, leaf, stroke, and shape EXACTLY as shown in the original. ` +
            `Convert to clean pure black (#000000) lines on pure white (#FFFFFF) background. ` +
            `Remove any grey tones — make all lines fully black. Remove the background completely. ` +
            `${singleLine ? SINGLE_LINE_STYLE : variation.style} ` +
            `No text, no letters, no numbers, no logos, no watermarks anywhere.`
          )
        : (
            // General object prompt — gpt-image-1 edit
            `Convert this image to clean black and white line art suitable for CNC engraving or laser cutting. ` +
            `Draw ONLY the main subject on a pure white background — remove the background completely. ` +
            `Use only pure black (#000000) lines on pure white (#FFFFFF). No shading, no grey tones, no gradients. ` +
            `Preserve the exact proportions and shape of the original object. ` +
            `${singleLine ? SINGLE_LINE_STYLE : variation.style} ` +
            `No text, no letters, no numbers, no logos, no watermarks anywhere.`
          );

      // Use gpt-image-1 edit API for high-quality line art generation
      // Pass signal so the request is aborted immediately when the 5-min timeout fires
      if (singleLine) console.log(`[aiTraceRoute] Single-line job ${jobId}: sending prompt to gpt-image-1, length=${editPrompt.length}`);
      const imageEditResponse = await openai.images.edit({
        model: "gpt-image-1",
        image: new File([editSourceBuffer as unknown as BlobPart], "source.png", { type: "image/png" }),
        prompt: editPrompt,
        n: 1,
        size: aiOutputSize as "1024x1024" | "1536x1024" | "1024x1536",
      } as Parameters<typeof openai.images.edit>[0], { signal: abortController.signal });

      const b64 = (imageEditResponse as { data?: Array<{ b64_json?: string }> }).data?.[0]?.b64_json;
      if (!b64) throw new Error("gpt-image-1 did not return image data");
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
        // Simple mode: standard pipeline
        processedBuffer = await sharp(rawBuffer)
          .extend({ top: 160, bottom: 160, left: 120, right: 120, background: { r: 255, g: 255, b: 255, alpha: 1 } })
          .resize(3072, 3072, { fit: "inside", background: { r: 255, g: 255, b: 255, alpha: 1 } })
          .grayscale()
          .blur(3.0)
          .threshold(160)
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
        // Detailed: lower turdSize keeps fine details; alphaMax 0.7 = rounder corners;
        // optTolerance 0.8 = more curve smoothing → smoother output lines
        ? { threshold: 128, turdSize: 32, alphaMax: 0.7, optCurve: true, optTolerance: 0.8 }
        : { threshold: 128, turdSize: 160, alphaMax: 1.0, optCurve: true, optTolerance: 0.4 };

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
          content: `שגיאת billing ב-AI Outline:\n${message}\n\nנא להיכנס ל-OpenAI ולטעון את הכרטיס: https://platform.openai.com/settings/organization/billing`,
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

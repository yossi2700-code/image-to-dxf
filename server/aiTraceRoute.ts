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
import { deductTokens, addTokens, TOKEN_COSTS, TokenAction } from "./tokenService";
import { invokeLLM } from "./_core/llm";
import { createJob, getJob, updateJob, cancelJob, heartbeatJob } from "./jobStore";
import { svgToDxf } from "./svgToDxf";
import { cleanSvgForPreview } from "./svgClean";
import OpenAI from "openai";
import potrace from "potrace";

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
      "Minimalist coloring-book style line art. Draw ONLY the outer silhouette and the most essential major shapes. " +
      "ALL lines MUST be smooth, continuous, and uniformly thick throughout the entire drawing. " +
      "STRICTLY FORBIDDEN: stray lines, broken segments, isolated short strokes, disconnected marks, or lines that do not connect to the main outline. " +
      "Ignore fine details, textures, interior decorations, grilles, small features, and complex inner structures. " +
      "Every line must start and end connected to another line — no floating or orphan strokes. " +
      "Result must look like a clean, simple coloring page for children. " +
      "NO texture, NO hatching, NO shading, NO fill. Pure uniform black lines on white.",
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

function buildFullImagePrompt(sceneDescription: string, variationIndex: number): string {
  const variation = STYLE_VARIATIONS[variationIndex % STYLE_VARIATIONS.length];
  return (
    `Professional black and white line art of the following scene: ${sceneDescription}. ` +
    "Pure white background (#FFFFFF). " +
    "Bold thick black outlines, no fill, no shading, no gradients. " +
    "High contrast: only pure black (#000000) lines on white. " +
    "CRITICAL: Draw ALL elements visible in the image EXACTLY as described — every object, decoration, symbol, and detail in their correct positions and proportions. " +
    "Do NOT substitute or replace any element with a generic version. Draw the SPECIFIC items described. " +
    `${variation.style} ` +
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

function buildLineArtPrompt(objectDescription: string, variationIndex: number): string {
  const variation = STYLE_VARIATIONS[variationIndex % STYLE_VARIATIONS.length];
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
    `${variation.style} ` +
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
  lineweightMm?: number
) {
  const isHe = lang === "he";
  let heartbeatInterval: ReturnType<typeof setInterval> | undefined;
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
      analysisInstruction =
        `The user wants to draw: "${focusText}". ` +
        "Describe ONLY that specific element from the image in detail for line art generation. " +
        "Focus on: exact camera angle/view, facing direction, body pose, shape, structure, key features, proportions. " +
        "Output ONLY the description (2-4 sentences), no preamble.";
    } else {
      analysisInstruction = userDesc
        ? `Describe the main object for line art generation. Additional context from user: ${userDesc}. ` +
          "Focus on: exact camera angle/view, facing direction, body pose, shape, structure, key features, proportions."
        : "Describe the main/dominant object in this image for line art generation. " +
          "Focus on: exact camera angle/view, facing direction, body pose, shape, structure, key features, proportions.";
    }

    const llmResponse = await invokeLLM({
      messages: [
        {
          role: "system",
          content:
            "You are a world-class expert at analyzing images for precise line art / engraving generation. " +
            "Your analysis will be used to generate line art that EXACTLY reproduces what is in the image. " +
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
            "\nFormat: Start with 'Camera angle: [exact angle].' then describe the rest in 3-5 sentences. No preamble.",
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

    const objectDescription =
      (llmResponse as { choices?: Array<{ message?: { content?: string } }> })
        ?.choices?.[0]?.message?.content?.trim() ||
      userDesc ||
      "the object in the image";

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
    // 512px is sufficient for gpt-image-1 edit — smaller = faster upload & processing.
    const editSourceBuffer = await sharp(imageBuffer)
      .resize(512, 512, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
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
      const editPrompt = landscapeMode
        ? buildFullImagePrompt(objectDescription, idx)
        : (isPortrait && !isToyOrFigurine)
        ? (
            "ABSOLUTE RULE #1: NO TEXT, NO LETTERS, NO WORDS, NO NUMBERS, NO LABELS, NO CAPTIONS, NO WATERMARKS — EVER. " +
            "ABSOLUTE RULE #2: THIS IS A PORTRAIT. You MUST preserve the EXACT facial likeness of the person in the photo. " +
            "ABSOLUTE RULE #3: PRESERVE THE EXACT SHAPE, SILHOUETTE, AND STRUCTURE OF THE ORIGINAL IMAGE. " +
            `Convert this portrait photo into a professional black and white line art illustration. ` +
            `FACIAL LIKENESS IS CRITICAL: You MUST reproduce the EXACT facial features of this specific person: ` +
            `face shape, eye shape and spacing, nose shape, mouth shape, jawline, hairline, hair style, beard/stubble if present, ears. ` +
            `This must look like THIS SPECIFIC PERSON, not a generic face. ` +
            `You MUST keep the EXACT same: (a) overall shape and silhouette, (b) camera angle and viewpoint, ` +
            `(c) proportions and dimensions, (d) all visible structural details including clothing, accessories. ` +
            `Do NOT simplify, generalize, or change ANY facial feature. ` +
            `Do NOT change the viewpoint, orientation, rotation, or scale. ` +
            "Pure white background (#FFFFFF). Clean black outlines only, no fill, no shading, no gradients, no grey. " +
            `${variation.style} ` +
            "The entire person must be fully visible with 15% white margin on every side. " +
            "FINAL REMINDER: Zero text, zero letters, zero numbers anywhere in the image."
          )
        : isToyOrFigurine
        ? (
            "⚠️ CRITICAL RULE #0 — MOST IMPORTANT: THIS IS A TOY / FIGURINE / CARTOON CHARACTER. " +
            "DO NOT DRAW REALISTIC HUMAN FACES. DO NOT ADD HUMAN SKIN, HUMAN EYES, HUMAN NOSE, OR HUMAN MOUTH. " +
            "The face/features MUST look like the ORIGINAL TOY — cartoon eyes, toy proportions, plastic/stylized appearance. " +
            "PRESERVE THE EXACT TOY APPEARANCE: cartoon eyes, exaggerated proportions, toy-like features exactly as they appear in the photo. " +
            "DO NOT HUMANIZE the character in any way. Keep it looking like a toy/figurine/cartoon, NOT a real person. " +
            "ABSOLUTE RULE #1: NO TEXT, NO LETTERS, NO WORDS, NO NUMBERS, NO LABELS, NO CAPTIONS, NO WATERMARKS — EVER. " +
            "ABSOLUTE RULE #2: PRESERVE THE EXACT SHAPE, SILHOUETTE, AND STRUCTURE OF THE ORIGINAL TOY. " +
            `Convert this toy/figurine photo into a professional black and white line art illustration. ` +
            `You MUST keep the EXACT same: (a) overall toy shape and silhouette, (b) camera angle and viewpoint, ` +
            `(c) proportions and dimensions, (d) all visible details including cartoon eyes, colors boundaries, accessories. ` +
            `Do NOT simplify, generalize, or change ANY structural element. ` +
            `Do NOT change the viewpoint, orientation, rotation, or scale. ` +
            `Do NOT add any context, scene, environment, or additional objects not present in the original. ` +
            "Draw EVERY visible detail from the original toy: seams, paint lines, accessories, logos, textures. " +
            "Pure white background (#FFFFFF). Clean black outlines only, no fill, no shading, no gradients, no grey. " +
            `${variation.style} ` +
            "The entire toy must be fully visible with 15% white margin on every side. " +
            "⚠️ FINAL REMINDER: This is a TOY. Keep cartoon/toy face features. NO realistic human faces. Zero text, zero numbers."
          )
        : (
            "⚠️ CRITICAL RULE #0 — THIS IS THE MOST IMPORTANT RULE: " +
            "DO NOT ADD ANY PEOPLE, HUMANS, HANDS, ARMS, LEGS, BODY PARTS, FACES, OR HUMAN FIGURES. " +
            "If the original photo contains NO people, the output MUST contain NO people. " +
            "Draw ONLY the object(s) physically present in the original image — nothing else. " +
            "ABSOLUTE RULE #1: NO TEXT, NO LETTERS, NO WORDS, NO NUMBERS, NO LABELS, NO CAPTIONS, NO WATERMARKS — EVER. " +
            "ABSOLUTE RULE #2: PRESERVE THE EXACT SHAPE, SILHOUETTE, AND STRUCTURE OF THE ORIGINAL IMAGE. " +
            "ABSOLUTE RULE #3: DO NOT ADD ANY PEOPLE, HUMANS, HANDS, ARMS, BODY PARTS, OR FIGURES THAT ARE NOT PRESENT IN THE ORIGINAL PHOTO. " +
            "If the original image shows only an object (bag, flower, toy, product, item, logo, animal, etc.), draw ONLY that object floating on white background. " +
            "NEVER add a person holding, wearing, or interacting with the object unless a person was already clearly visible in the original photo. " +
            `Convert this image into a professional black and white line art illustration. ` +
            `You MUST keep the EXACT same: (a) overall shape and silhouette, (b) camera angle and viewpoint, ` +
            `(c) proportions and dimensions, (d) all visible structural details, patterns, logos, and decorative elements. ` +
            `Do NOT simplify, generalize, or change ANY structural element. ` +
            `Do NOT change the viewpoint, orientation, rotation, or scale. ` +
            `Do NOT add any context, scene, environment, or additional objects not present in the original. ` +
            "Draw EVERY visible detail from the original: seams, handles, straps, patterns, hardware, logos, textures. " +
            "Pure white background (#FFFFFF). Clean black outlines only, no fill, no shading, no gradients, no grey. " +
            `${variation.style} ` +
            "The entire object must be fully visible with 15% white margin on every side. " +
            "⚠️ FINAL REMINDER: Zero text, zero letters, zero numbers. ONLY the exact object/subject from the original — NO people, NO hands, NO body parts added. Nothing extra."
          );

      // Use images.edit with the original image as reference for maximum shape fidelity
      const editFile = await (async () => {
        const { toFile } = await import("openai");
        return toFile(editSourceBuffer, "source.png", { type: "image/png" });
      })();

      const response = await openai.images.edit({
        model: "gpt-image-1",
        image: editFile,
        prompt: editPrompt,
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

      // Add white padding around the AI-generated image, then resize to max 1024px
      // (reduced from 1400 — potrace is O(n²) so smaller = much faster tracing)
      const processedBuffer = await sharp(rawBuffer)
        .extend({ top: 80, bottom: 80, left: 60, right: 60, background: { r: 255, g: 255, b: 255, alpha: 1 } })
        .resize(1024, 1024, { fit: "inside", background: { r: 255, g: 255, b: 255, alpha: 1 } })
        .grayscale()
        .threshold(200)
        .png()
        .toBuffer();

      const rawSvg = await pngToSvg(processedBuffer);
      const cleanSvg = cleanSvgForPreview(rawSvg);

      const { dxf, segmentCount, width, height, realWidth, realHeight } = svgToDxf(rawSvg, hairline, lineweightMm);
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
    const [images, suggestions] = await Promise.all([
      Promise.all(generationPromises),
      generateImprovementSuggestions(objectDescription, imageBase64, lang),
    ]);

    const jobAfterGen = getJob(jobId);
    if (!jobAfterGen || jobAfterGen.status === "cancelled") return;

    // Log usage
    const totalSegments = images.reduce((s, img) => s + img.segmentCount, 0);
    void logUsageEvent({
      type: "ai_generate",
      segmentCount: Math.round(totalSegments / images.length),
      ipAnon: anonymizeIp(ipAnon),
    });

    // Record user actions
    const groupId = nanoid(12);
    const allVariationLabels = ["simple", "detailed", "decorative"];
    const variationLabels = [allVariationLabels[variationIndex] ?? `v${variationIndex + 1}`];
    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      void recordUserAction({
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
      });
    }

    updateJob(jobId, { status: "done", result: { success: true, images, objectDescription, suggestions } });

  } catch (err: unknown) {
    clearInterval(heartbeatInterval);
    console.error("[aiTraceRoute] Job error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    updateJob(jobId, { status: "error", error: message });
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
      const variationIndex = Math.min(2, Math.max(0, parseInt((req.body?.variationIndex as string) ?? "1", 10) || 1));
      const hairline = req.body?.hairline === "true" || req.body?.hairline === true;
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
      const jobId = nanoid(12);
      createJob(jobId, appUser.userId, "ai_trace");

      runTraceJob(jobId, imageBuffer, imageBase64, userDesc, focusText, landscapeMode, lang, appUser.userId, ipAnon ?? "", uploadedSourceImageUrl, variationIndex, hairline, lineweightMm)
        .catch((err) => console.error("[aiTraceRoute] Unhandled job error:", err));

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
    return res.json({ status: "error", error: job.error, message: `שגיאה: ${job.error}` });
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
    try {
      await addTokens(appUser.userId, TOKEN_COSTS[(job.tokenAction as TokenAction) || "ai_trace"], "refund", "Job cancelled — tokens refunded");
    } catch (refundErr) {
      console.error("[aiTraceRoute] Refund error:", refundErr);
    }
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

      // Pre-process and run potrace (same as generateRoute)
      const processedBuffer = await sharp(pngBuffer)
        .grayscale()
        .threshold(200)
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

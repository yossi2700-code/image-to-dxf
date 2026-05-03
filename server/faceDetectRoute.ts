/**
 * faceDetectRoute.ts — Portrait generation pipeline.
 *
 * POST /api/face-detect/start  — Start a portrait job (returns { jobId })
 * GET  /api/face-detect/job/:jobId — Poll job status
 * POST /api/face-detect/cancel/:jobId — Cancel a running job
 *
 * Pipeline:
 *   A. Detect faces using LLM vision
 *   B. Generate 3 portrait variations in parallel (chosen style + 2 adjacent)
 *   C. For each: potrace → SVG → DXF
 *   D. Generate AI suggestions for refinement
 */
import { Router } from "express";
import multer from "multer";
import sharp from "sharp";
import { storagePut } from "./storage";
import { nanoid } from "nanoid";
import { logUsageEvent, anonymizeIp } from "./usageDb";
import { getAppUserFromCookie } from "./appAuth";
import { recordUserAction } from "./userActionsDb";
import { deductTokens, addTokens, TOKEN_COSTS, TokenAction, getTokenCostForAction } from "./tokenService";
import { createJob, getJob, updateJob, cancelJob, heartbeatJob } from "./jobStore";
import { svgToDxf } from "./svgToDxf";
import { potraceToSingleLine } from "./potraceToSingleLine";
import { cleanSvgForPreview } from "./svgClean";
import { invokeLLM } from "./_core/llm";
import { generateImage } from "./_core/imageGeneration";
import potrace from "potrace";
import { aiTracePipeline } from "./imageProcessor";
import { execFile } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
const execFileAsync = promisify(execFile);

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 16 * 1024 * 1024 } });
// Using Manus Forge built-in image generation (no OpenAI key needed)

// ─── Portrait styles ──────────────────────────────────────────────────────────
export type PortraitStyle = "simple" | "detailed";

const PORTRAIT_STYLE_PROMPTS: Record<PortraitStyle, string> = {
  simple:
    "Convert this portrait photo into a clean black-and-white line art illustration suitable for laser engraving or CNC cutting. " +
    "CRITICAL — MAXIMUM LIKENESS: The result MUST be unmistakably recognizable as the same person in the photo. " +
    "Faithfully reproduce: exact face shape, eye shape and spacing, nose shape, lip shape, hair style and hairline, beard/facial hair if present, ear shape. " +
    "FACE ANGLE: Preserve the exact head angle and pose from the photo. Do NOT change the pose. " +
    "LINE WEIGHT RULE (very important): " +
    "  - THICK bold lines for: outer face contour, jaw, hairline boundary, neck outline, shoulder outline. " +
    "  - MEDIUM lines for: eyebrows, eyelids, nose bridge, lip contour, ear outline. " +
    "  - THIN flowing lines for: hair strands (draw 8-15 flowing curved lines following the hair direction), eyelashes, nostril detail, lip crease. " +
    "HAIR: Draw the hair as a series of flowing curved lines following the natural hair direction. Do NOT fill hair solid black. Draw individual strand groups. " +
    "EYES: Draw both eyes with upper and lower eyelids, iris circle, pupil dot, and 5-8 eyelash lines per eye. " +
    "BACKGROUND: Pure white (#FFFFFF). No shading, no grey tones, no fills, no hatching. Only black lines on white. " +
    "Do NOT fill any area solid black. All enclosed areas must remain white. " +
    "COMPOSITION: Head + neck + shoulders fill 80-90% of canvas. Generous white margins on all sides. No cropping. " +
    "No text, no watermarks, no signatures.",

  detailed:
    "Convert this portrait photo into a highly detailed black-and-white line art illustration suitable for laser engraving or CNC cutting. " +
    "CRITICAL — MAXIMUM LIKENESS: The result MUST be unmistakably recognizable as the same person in the photo. " +
    "Faithfully reproduce every distinctive feature: exact face shape, eye shape and spacing, nose shape, lip shape, hair style and hairline, beard/facial hair if present, ear shape, distinctive marks. " +
    "FACE ANGLE: Preserve the exact head angle and pose from the photo. Do NOT change the pose. " +
    "LINE WEIGHT RULE (very important): " +
    "  - THICK bold lines for: outer face contour, jaw, hairline boundary, neck outline, shoulder outline. " +
    "  - MEDIUM lines for: eyebrows (draw individual hairs), eyelids, nose bridge, lip contour, ear outline, chin detail. " +
    "  - THIN precise lines for: hair strands (draw 15-25 flowing curved lines following hair direction), eyelashes (individual), iris texture lines, nostril shape, lip crease, philtrum, neck muscle lines. " +
    "HAIR: Draw the hair as many flowing curved lines following the natural hair direction and volume. Do NOT fill hair solid black. Show hair texture with individual strand groups. " +
    "EYES: Draw both eyes in detail: upper and lower eyelids with thickness, iris with 4-6 radial lines, pupil, and 8-12 individual eyelash lines per eye. " +
    "BEARD/FACIAL HAIR: If present, draw with short curved lines following the growth direction. " +
    "BACKGROUND: Pure white (#FFFFFF). No shading, no grey tones, no fills, no hatching. Only black lines on white. " +
    "Do NOT fill any area solid black. All enclosed areas must remain white. " +
    "COMPOSITION: Head + neck + shoulders fill 80-90% of canvas. Generous white margins on all sides. No cropping. " +
    "No text, no watermarks, no signatures.",
};

const STYLE_ORDER: PortraitStyle[] = ["simple", "detailed"];

const STYLE_LABELS: Record<PortraitStyle, { he: string; en: string }> = {
  simple: { he: "פשוט", en: "Simple" },
  detailed: { he: "מפורט", en: "Detailed" },
};

// ─── Potrace helper ───────────────────────────────────────────────────────────
function pngToSvg(pngBuffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    potrace.trace(pngBuffer, {
      threshold: 128,   // standard midpoint — captures bold black lines faithfully
      turdSize: 4,      // remove tiny noise specks but keep all real lines
      alphaMax: 1.0,    // allow smooth curves for natural portrait lines
      optCurve: true,
      optTolerance: 0.2, // standard smoothing — preserves natural line flow
    }, (err: Error | null, svg: string) => {
      if (err) reject(err);
      else resolve(svg);
    });
  });
}

// ─── Generate one portrait variation ─────────────────────────────────────────
type PortraitResult = {
  imageUrl: string;
  svgPreview: string;
  dxfUrl: string;
  svgUrl: string;
  dxfFilename: string;
  segmentCount: number;
  width: number;
  height: number;
  realWidth: number;
  realHeight: number;
  style: PortraitStyle;
  styleLabel: string;
  styleLabelEn: string;
};

async function generatePortraitVariation(
  editSourceBuffer: Buffer,
  style: PortraitStyle,
  hairline: boolean,
  lineweightMm: number | undefined,
  minGapMm: number
): Promise<PortraitResult> {
  const editPrompt = PORTRAIT_STYLE_PROMPTS[style];

  // Upload buffer to S3 so Forge can access it via URL
  const tempKey = `face-detect-temp/${nanoid()}.png`;
  const { url: tempUrl } = await storagePut(tempKey, editSourceBuffer, "image/png");

  // Use Manus Forge built-in image generation with the original image as reference
  const { url: generatedUrl } = await generateImage({
    prompt: editPrompt,
    originalImages: [{ url: tempUrl, mimeType: "image/png" }],
  });

  if (!generatedUrl) throw new Error("Failed to generate image for style: " + style);

  const imgResponse = await fetch(generatedUrl);
  if (!imgResponse.ok) throw new Error("Failed to download generated image");
  let rawBuffer = Buffer.from(await imgResponse.arrayBuffer());

  // Use potrace outline mode to preserve the bold thick lines from the AI-generated image.
  // The skeleton approach was thinning lines too much. Potrace keeps the original line weight.
  const pngForSvg = await sharp(rawBuffer)
    .extend({ top: 60, bottom: 60, left: 60, right: 60, background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .resize(1024, 1024, { fit: "inside", background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .png()
    .toBuffer();
  const rawSvg = await pngToSvg(pngForSvg);
  const result = svgToDxf(rawSvg, true, lineweightMm);
  const segmentCount = result.segmentCount;
  const width = result.width;
  const height = result.height;
  const realWidth = result.realWidth;
  const realHeight = result.realHeight;
  const dxfContent = result.dxf;
  const svgPreviewContent = cleanSvgForPreview(rawSvg);

  const imgKey = `face-detect-generated/${nanoid()}.png`;
  const { url: imageUrl } = await storagePut(imgKey, rawBuffer, "image/png");
  const dxfFilename = `face_portrait_${style}.dxf`;
  const dxfKey = `face-detect-dxf/${nanoid()}-${dxfFilename}`;
  const { url: dxfUrl } = await storagePut(dxfKey, Buffer.from(dxfContent, "utf-8"), "application/dxf");
  const svgKey = `face-detect-svg/${nanoid()}-face_portrait_${style}.svg`;
  const { url: svgUrl } = await storagePut(svgKey, Buffer.from(svgPreviewContent, "utf-8"), "image/svg+xml");

  return {
    imageUrl,
    svgPreview: svgPreviewContent,
    dxfUrl,
    svgUrl,
    dxfFilename,
    segmentCount,
    width,
    height,
    realWidth,
    realHeight,
    style,
    styleLabel: STYLE_LABELS[style].he,
    styleLabelEn: STYLE_LABELS[style].en,
  };
}

// ─── Generate AI suggestions ──────────────────────────────────────────────────
async function generateAiSuggestions(style: PortraitStyle, lang: "he" | "en"): Promise<string[]> {
  const isHe = lang === "he";
  try {
    const systemPrompt = isHe
      ? "אתה עוזר לשיפור תמונות קו לחריטת לייזר/CNC. הצע 3 שיפורים קצרים וספציפיים לפורטרט שנוצר. כל הצעה עד 6 מילים. החזר JSON בלבד: {\"suggestions\": [\"...\", \"...\", \"...\"]}"
      : "You help improve line art portraits for laser/CNC engraving. Suggest 3 short specific improvements for the generated portrait. Each suggestion max 6 words. Return JSON only: {\"suggestions\": [\"...\", \"...\", \"...\"]}";
    const styleName = STYLE_LABELS[style][isHe ? "he" : "en"];
    const userMsg = isHe
      ? `הפורטרט נוצר בסגנון: ${styleName}. הצע 3 שיפורים ספציפיים לחריטת CNC/לייזר.`
      : `Portrait was generated in style: ${styleName}. Suggest 3 specific improvements for CNC/laser engraving.`;

    const response = await invokeLLM({
      messages: [
        { role: "system" as const, content: systemPrompt },
        { role: "user" as const, content: userMsg },
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

    const rawContent = response.choices?.[0]?.message?.content;
    const rawStr = typeof rawContent === "string" ? rawContent : null;
    if (!rawStr) return [];
    // Strip markdown code blocks if present
    const content = rawStr.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
    const parsed = JSON.parse(content) as { suggestions: string[] };
    return parsed.suggestions?.slice(0, 3) ?? [];
  } catch {
    return isHe
      ? ["עבה קווים", "הוסף פרטים לעיניים", "חדד קווי מתאר"]
      : ["Thicken lines", "Add eye detail", "Sharpen outlines"];
  }
}

// ─── Background job runner ────────────────────────────────────────────────────
async function runFaceDetectJob(
  jobId: string,
  imageBuffer: Buffer,
  lang: "he" | "en",
  appUserId: number,
  ipAnon: string,
  style: PortraitStyle = "simple",
  sourceImageUrl?: string,
  hairline = false,
  lineweightMm?: number,
  minGapMm = 0
) {
  const isHe = lang === "he";
  let heartbeatInterval: ReturnType<typeof setInterval> | undefined;
  const jobStartTime = Date.now();
  try {
    updateJob(jobId, {
      status: "processing",
      step: isHe ? "מצייר פורטרט..." : "Drawing portrait...",
      stepEn: "Drawing portrait...",
      partialImages: [],
    });

    const jobCheck = getJob(jobId);
    if (!jobCheck || jobCheck.status === "cancelled") return;

    // ── Step A: Validate face is present using LLM vision ─────────────────────────
    updateJob(jobId, {
      step: isHe ? "מזהה פנים בתמונה..." : "Detecting face in image...",
      stepEn: "Detecting face in image...",
    });
    // Resize image for face detection — 1024px max, JPEG for smaller payload
    const faceDetectBuffer = await sharp(imageBuffer)
      .resize(1024, 1024, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 90 })
      .toBuffer();
    const imageBase64 = faceDetectBuffer.toString("base64");
    // Detect faces with bounding boxes (normalized 0-1 coordinates)
    const faceCheckResponse = await invokeLLM({
      messages: [
        {
          role: "system",
          content: "You are a precise face detection system. Count ONLY complete human faces that are clearly visible with eyes, nose, and mouth distinguishable. A face must have: visible eyes, a nose, and a mouth. Do NOT count: reflections, shadows, blurry background faces, partial faces missing key features, or body parts that are not faces. Each face box must cover the full head including hair, with 10% padding. Return normalized bounding box coordinates (0.0 to 1.0). x_min/y_min is top-left, x_max/y_max is bottom-right. Respond with JSON only.",
        },
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}`, detail: "high" } },
            { type: "text", text: 'Count the CLEARLY VISIBLE human faces in this image. Only include faces where you can clearly see BOTH eyes, a nose, and a mouth. Do NOT include: partial faces, blurry background people, reflections, or shadows. Return JSON: {"faces": [{"x_min": 0.1, "y_min": 0.05, "x_max": 0.45, "y_max": 0.6}, ...]}. Use normalized 0-1 coordinates. Each box should cover the full head + hair + 10% padding.' },
          ],
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "face_detection",
          strict: true,
          schema: {
            type: "object",
            properties: {
              faces: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    x_min: { type: "number" },
                    y_min: { type: "number" },
                    x_max: { type: "number" },
                    y_max: { type: "number" },
                  },
                  required: ["x_min", "y_min", "x_max", "y_max"],
                  additionalProperties: false,
                },
              },
            },
            required: ["faces"],
            additionalProperties: false,
          },
        },
      },
    });
    const rawFaceCheckContent = (faceCheckResponse as { choices?: Array<{ message?: { content?: string } }> })
      ?.choices?.[0]?.message?.content ?? "{}";
    // Strip markdown code blocks if present (e.g. ```json\n{...}\n```)
    const faceCheckContent = rawFaceCheckContent.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
    
    type FaceBox = { x_min: number; y_min: number; x_max: number; y_max: number };
    let detectedFaces: FaceBox[] = [];
    try {
      const parsed = JSON.parse(faceCheckContent) as { faces?: FaceBox[] };
      const rawFaces = Array.isArray(parsed.faces) ? parsed.faces.slice(0, 4) : [];
      // Filter out false positives:
      // 1. Face must be at least 8% of image width AND 8% of image height (eliminates tiny background faces)
      // 2. Face area must be at least 0.5% of total image area
      // 3. If multiple faces detected, remove any face whose area is less than 20% of the largest face
      //    (eliminates small false positives when there's a dominant face)
      const withSize = rawFaces.map(f => ({
        ...f,
        w: f.x_max - f.x_min,
        h: f.y_max - f.y_min,
        area: (f.x_max - f.x_min) * (f.y_max - f.y_min),
      }));
      const minW = 0.08, minH = 0.08, minArea = 0.005;
      const sizeFiltered = withSize.filter(f => f.w >= minW && f.h >= minH && f.area >= minArea);
      if (sizeFiltered.length > 1) {
        const maxArea = Math.max(...sizeFiltered.map(f => f.area));
        detectedFaces = sizeFiltered.filter(f => f.area >= maxArea * 0.20).map(({ w: _w, h: _h, area: _a, ...f }) => f);
      } else {
        detectedFaces = sizeFiltered.map(({ w: _w, h: _h, area: _a, ...f }) => f);
      }
      console.log(`[faceDetectRoute] Job ${jobId}: raw=${rawFaces.length} faces, after size filter=${detectedFaces.length}`);
    } catch { detectedFaces = []; }
    
    const faceCount = detectedFaces.length;
    
    if (faceCount === 0) {
      // Only refund if tokens were already deducted — tokens are deducted AFTER success (Step D),
      // so in normal flow no refund is needed here. Guard prevents phantom refunds.
      const jobForRefundCheck = getJob(jobId);
      if (jobForRefundCheck?.tokenDeducted && !jobForRefundCheck?.noFaceRefundSent) {
        updateJob(jobId, { noFaceRefundSent: true });
        try {
          const noFaceRefundCost = await getTokenCostForAction("face_detect");
          await addTokens(appUserId, noFaceRefundCost, "refund", "No face detected — tokens refunded");
        } catch { /* ignore */ }
      }
      const errorMsg = isHe
        ? "לא זוהו פנים בתמונה זו. אנא העלה תמונה ברורה עם פנים אחד או יותר."
        : "No face detected in this image. Please upload a clear photo with at least one visible face.";
      updateJob(jobId, { status: "error", error: errorMsg });
      return;
    }

    // Limit portrait mode to max 2 faces
    if (faceCount > 2) {
      const errorMsg = isHe
        ? `זוהו ${faceCount} פנים בתמונה. מצב פורטרט תומך עד 2 אנשים בלבד.`
        : `Detected ${faceCount} faces in the image. Portrait mode supports up to 2 people only.`;
      updateJob(jobId, { status: "error", error: errorMsg, errorCode: "TOO_MANY_FACES", faceCount });
      return;
    }

    const jobAfterFaceCheck = getJob(jobId);
    if (!jobAfterFaceCheck || jobAfterFaceCheck.status === "cancelled") return;

    // ── Step B: Get original image dimensions for cropping ────────────────────────────────────────────────
    const origMeta = await sharp(imageBuffer).metadata();
    const origW = origMeta.width ?? 512;
    const origH = origMeta.height ?? 512;

    // Helper: crop a face from the original image using normalized bbox
    const cropFace = async (box: { x_min: number; y_min: number; x_max: number; y_max: number }): Promise<Buffer> => {
      // Add 20% padding around the detected face box
      const pad = 0.20;
      const bw = box.x_max - box.x_min;
      const bh = box.y_max - box.y_min;
      const x0 = Math.max(0, box.x_min - bw * pad);
      const y0 = Math.max(0, box.y_min - bh * pad);
      const x1 = Math.min(1, box.x_max + bw * pad);
      const y1 = Math.min(1, box.y_max + bh * pad);
      const left = Math.round(x0 * origW);
      const top = Math.round(y0 * origH);
      const cropW = Math.max(64, Math.round((x1 - x0) * origW));
      const cropH = Math.max(64, Math.round((y1 - y0) * origH));
      return sharp(imageBuffer)
        .extract({ left, top, width: Math.min(cropW, origW - left), height: Math.min(cropH, origH - top) })
        .resize(512, 512, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
        .png({ compressionLevel: 1 })  // faster compression
        .toBuffer();
    };

    // Helper: generate portrait from a cropped face buffer
    const generatePortraitFromCrop = async (cropBuffer: Buffer, faceLabel: string, customPrompt?: string): Promise<PortraitResult> => {
      // Upload buffer to S3 so Forge can access it via URL
      const tempKey = `face-detect-temp/${nanoid()}.png`;
      const { url: tempUrl } = await storagePut(tempKey, cropBuffer, "image/png");

      // Use Manus Forge built-in image generation with the original image as reference
      const { url: generatedUrl } = await generateImage({
        prompt: customPrompt ?? PORTRAIT_STYLE_PROMPTS[style],
        originalImages: [{ url: tempUrl, mimeType: "image/png" }],
      });

      if (!generatedUrl) throw new Error("Failed to generate portrait");
      const imgRes = await fetch(generatedUrl);
      if (!imgRes.ok) throw new Error("Failed to download generated image");
      const rawAb = await imgRes.arrayBuffer();
      let rawBuffer: Buffer = Buffer.from(rawAb);

      // ── Glow / halo effect ──────────────────────────────────────────────────
      // Add a soft white radial glow around the subject on the dark background.
      // Technique:
      //   1. Convert to grayscale, invert so subject = white on black
      //   2. Blur heavily to create a "bloom" layer
      //   3. Composite the bloom behind the original (lighten blend)
      //   4. Re-invert back to original polarity (dark subject on white)
      // This gives a halo/glow around hair and face edges.
      try {
        const { data: rawData, info } = await sharp(rawBuffer)
          .grayscale()
          .raw()
          .toBuffer({ resolveWithObject: true });
        const w = info.width;
        const h = info.height;
        const total = w * h;

        // Determine polarity: if avg brightness < 128, subject is dark on light bg
        // We need subject = white on black for bloom generation
        const avg = rawData.reduce((s: number, v: number) => s + v, 0) / total;
        const needsInvert = avg > 128; // bright background → invert to get white subject

        // Create "subject mask" (white subject on black)
        const maskPixels = new Uint8Array(total);
        for (let i = 0; i < total; i++) {
          maskPixels[i] = needsInvert ? 255 - rawData[i] : rawData[i];
        }
        const maskBuffer = Buffer.from(maskPixels);

        // Blur the mask to create bloom
        const bloomBuffer = await sharp(maskBuffer, { raw: { width: w, height: h, channels: 1 } })
          .blur(18)  // large blur radius for soft glow
          .raw()
          .toBuffer();

        // Combine: lighten original mask with bloom (max of both)
        const glowMask = new Uint8Array(total);
        for (let i = 0; i < total; i++) {
          glowMask[i] = Math.max(maskPixels[i], Math.min(255, bloomBuffer[i] * 1.4));
        }

        // Convert back to original polarity
        const finalGlow = new Uint8Array(total);
        for (let i = 0; i < total; i++) {
          finalGlow[i] = needsInvert ? 255 - glowMask[i] : glowMask[i];
        }

        // Rebuild PNG from glow-enhanced pixels
        const glowNodeBuf = Buffer.allocUnsafe(total);
        for (let i = 0; i < total; i++) glowNodeBuf[i] = finalGlow[i];
        rawBuffer = await sharp(glowNodeBuf, { raw: { width: w, height: h, channels: 1 } })
          .png()
          .toBuffer();
      } catch (glowErr) {
        // Non-fatal: if glow fails, continue with original rawBuffer
        console.warn("[faceDetect] glow effect failed (non-fatal):", glowErr);
      }
      // ── End glow effect ─────────────────────────────────────────────────────

      // potrace outline tracing — produces clean line art from AI-generated B&W portrait
      // Higher resolution (2048) + contrast boost ensures thick bold lines are preserved
      const paddedBuffer = await sharp(rawBuffer)
        .grayscale()
        .linear(2.0, -40)              // boost contrast: darken lines, whiten background
        .extend({ top: 80, bottom: 80, left: 80, right: 80, background: { r: 255, g: 255, b: 255, alpha: 1 } })
        .resize(2048, 2048, { fit: "inside", background: { r: 255, g: 255, b: 255, alpha: 1 } })
        .threshold(160)               // lower threshold = thicker lines captured
        .png()
        .toBuffer();
      const rawSvg = await pngToSvg(paddedBuffer);
      const cleanSvg = cleanSvgForPreview(rawSvg);
      const { dxf, segmentCount, width, height, realWidth, realHeight } = svgToDxf(rawSvg, hairline, lineweightMm);
      const imgKey = `face-detect-generated/${nanoid()}.png`;
      const { url: imageUrl } = await storagePut(imgKey, rawBuffer, "image/png");
      const dxfFilename = `face_portrait_${style}${faceLabel ? `_${faceLabel}` : ""}.dxf`;
      const dxfKey = `face-detect-dxf/${nanoid()}-${dxfFilename}`;
      const { url: dxfUrl } = await storagePut(dxfKey, Buffer.from(dxf, "utf-8"), "application/dxf");
      const svgKeyLocal = `face-detect-svg/${nanoid()}-${dxfFilename.replace('.dxf', '.svg')}`;
      const { url: svgUrl } = await storagePut(svgKeyLocal, Buffer.from(cleanSvg, "utf-8"), "image/svg+xml");
      return {
        imageUrl, svgPreview: cleanSvg, svgUrl, dxfUrl, dxfFilename, segmentCount, width, height, realWidth, realHeight,
        style,
        styleLabel: STYLE_LABELS[style].he + (faceLabel ? ` (${faceLabel})` : ""),
        styleLabelEn: STYLE_LABELS[style].en + (faceLabel ? ` (${faceLabel})` : ""),
      };
    };

    // ── Step C: Generate portrait(s) ─────────────────────────────────────────
    heartbeatInterval = setInterval(() => heartbeatJob(jobId), 30_000);

    const isMultiFace = faceCount >= 2;

    if (isMultiFace) {
      updateJob(jobId, {
        step: isHe ? `זוהו ${faceCount} פנים — מצייר פורטרט...` : `Detected ${faceCount} faces — drawing portrait...`,
        stepEn: `Detected ${faceCount} faces — drawing portrait...`,
      });
    }

    let portraitResults: PortraitResult[];
    let suggestions: string[];

    if (isMultiFace) {
      // For multi-face: process EACH face separately so every person gets their own portrait
      // This is more reliable than asking AI to draw multiple faces in one image
      updateJob(jobId, {
        step: isHe ? `זוהו ${faceCount} פנים — מצייר כל פנים בנפרד...` : `Detected ${faceCount} faces — drawing each face separately...`,
        stepEn: `Detected ${faceCount} faces — drawing each face separately...`,
      });
      const sortedFaces = [...detectedFaces].sort((a, b) => a.x_min - b.x_min);
      const cropBuffers = await Promise.all(sortedFaces.map(box => cropFace(box)));
      const faceLabels = isHe
        ? faceCount === 2 ? ["פנים 1", "פנים 2"] : sortedFaces.map((_, i) => `פנים ${i + 1}`)
        : faceCount === 2 ? ["Face 1", "Face 2"] : sortedFaces.map((_, i) => `Face ${i + 1}`);
      [portraitResults, suggestions] = await Promise.all([
        Promise.all(cropBuffers.map((cropBuffer, i) => generatePortraitFromCrop(cropBuffer, faceLabels[i]))),
        generateAiSuggestions(style, lang),
      ]);
    } else {
      // Single face: crop and generate
      const sortedFaces = [...detectedFaces].sort((a, b) => a.x_min - b.x_min);
      const cropBuffers = await Promise.all(sortedFaces.map(box => cropFace(box)));
      [portraitResults, suggestions] = await Promise.all([
        Promise.all(cropBuffers.map((cropBuffer) => generatePortraitFromCrop(cropBuffer, ""))),
        generateAiSuggestions(style, lang),
      ]);
    }

    if (heartbeatInterval) { clearInterval(heartbeatInterval); heartbeatInterval = undefined; }

    const jobAfterGen = getJob(jobId);
    if (!jobAfterGen || jobAfterGen.status === "cancelled") return;

    const images = portraitResults;

    // ── Step D: Log & finish ──────────────────────────────────────────────────
    void logUsageEvent({
      type: "ai_generate",
      segmentCount: images[0]?.segmentCount ?? 0,
      ipAnon: anonymizeIp(ipAnon),
      durationMs: Date.now() - jobStartTime,
    });

    // Deduct tokens NOW — only after successful job completion
    await deductTokens(appUserId, "face_detect");
    updateJob(jobId, { tokenDeducted: true });

    const groupId = nanoid(12);
    for (const img of images) {
      void recordUserAction({
        appUserId,
        actionType: "ai_generate",
        description: `face_detect: ${img.style} portrait line art`,
        segmentCount: img.segmentCount,
        dxfUrl: img.dxfUrl,
        svgUrl: img.svgUrl,
        imageUrl: img.imageUrl,
        svgPreview: img.svgPreview,
        groupId,
        variationLabel: `portrait_${img.style}`,
        sourceImageUrl: sourceImageUrl ?? undefined,
        feature: "portrait",
        durationMs: Date.now() - jobStartTime,
        ipAnon: ipAnon ?? undefined,
      });
    }

    updateJob(jobId, {
      status: "done",
      result: { success: true, images, suggestions, numFaces: faceCount },
    });
  } catch (err: unknown) {
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    console.error("[faceDetectRoute] Job error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    updateJob(jobId, { status: "error", error: message });
    // No refund needed — tokens are only deducted after success
    // Record failed action in user history
    void recordUserAction({
      appUserId,
      actionType: "ai_generate",
      description: "portrait — נכשל",
      feature: "portrait",
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
        feature: "portrait",
        durationMs: Date.now() - jobStartTime,
        errorMessage: message,
        sourceImageUrl: sourceImageUrl ?? undefined,
      });
    } catch (_) { /* ignore logging errors */ }
  }
}

// ─── POST /api/face-detect/start ─────────────────────────────────────────────
router.post(
  "/api/face-detect/start",
  upload.single("image"),
  async (req, res) => {
    try {
      const appUser = getAppUserFromCookie(req.cookies);
      if (!appUser) {
        return res.status(401).json({
          error: "UNAUTHORIZED",
          message: "יש להתחבר כדי להשתמש בזיהוי פנים",
          messageEn: "Please log in to use face detection",
        });
      }

      // Block check
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
            messageEn: "Your account has been blocked.",
          });
        }
      }

      // Token check only — deduction happens after successful job
      const tokenResult = await deductTokens(appUser.userId, "face_detect", { checkOnly: true });
      if (!tokenResult.success) {
        return res.status(402).json({
          error: "INSUFFICIENT_TOKENS",
          balance: tokenResult.balance,
          message: "נגמרו לך האסימונים. יש לטעון אסימונים להמשך שימוש.",
          messageEn: "You have run out of tokens. Please purchase more tokens to continue.",
        });
      }

      // Get image buffer
      let imageBuffer: Buffer;
      if (req.file) {
        imageBuffer = req.file.buffer;
      } else if (req.body?.imageUrl) {
        const response = await fetch(req.body.imageUrl);
        imageBuffer = Buffer.from(await response.arrayBuffer());
      } else {
        return res.status(400).json({ error: "NO_IMAGE", message: "לא סופקה תמונה" });
      }

      // Auto-correct EXIF orientation
      imageBuffer = await sharp(imageBuffer).rotate().toBuffer();

      const lang = ((req.body?.lang as string) || "he") === "he" ? "he" : "en";
      const hairline = req.body?.hairline === "true" || req.body?.hairline === true;
      const lineweightMmRaw = parseFloat((req.body?.lineweightMm as string) ?? "");
      const lineweightMm = isNaN(lineweightMmRaw) ? undefined : Math.min(2.0, Math.max(0, lineweightMmRaw));
      const minGapMmRaw = parseFloat((req.body?.minGapMm as string) ?? "");
      const minGapMm = isNaN(minGapMmRaw) ? 0 : Math.min(3.0, Math.max(0, minGapMmRaw));
      const styleRaw = (req.body?.style as string) ?? "simple";
      const style: PortraitStyle = (["simple", "detailed"] as const).includes(styleRaw as PortraitStyle)
        ? (styleRaw as PortraitStyle)
        : "simple";

      const rawIp = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
      const ipAnon = anonymizeIp(rawIp);

      // Upload original image to S3
      let uploadedSourceImageUrl: string | undefined;
      try {
        const srcKey = `face-detect-source/${appUser.userId}-${nanoid(8)}.jpg`;
        const jpegBuf = await sharp(imageBuffer)
          .resize(800, 800, { fit: "inside", withoutEnlargement: true })
          .jpeg({ quality: 85 })
          .toBuffer();
        const { url } = await storagePut(srcKey, jpegBuf, "image/jpeg");
        uploadedSourceImageUrl = url;
      } catch (e) {
        console.warn("[faceDetectRoute] Failed to upload source image:", e);
      }

      // Create job and start background processing
      // Token deduction happens INSIDE the job after successful completion.
      const jobId = nanoid(12);
      createJob(jobId, appUser.userId, "face_detect");
      // 5-minute hard timeout
      const MAX_FACE_JOB_MS = 5 * 60 * 1000;
      const faceTimeoutPromise = new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error("Job timed out after 5 minutes")), MAX_FACE_JOB_MS)
      );
      Promise.race([
        runFaceDetectJob(jobId, imageBuffer, lang, appUser.userId, ipAnon ?? "", style, uploadedSourceImageUrl, hairline, lineweightMm, minGapMm),
        faceTimeoutPromise,
      ]).catch((err) => {
        const msg = err instanceof Error ? err.message : "Unknown error";
        console.error("[faceDetectRoute] Job error/timeout:", msg);
        updateJob(jobId, { status: "error", error: msg });
      });

      return res.json({ jobId });
    } catch (err: unknown) {
      console.error("[faceDetectRoute] Start error:", err);
      const message = err instanceof Error ? err.message : "Unknown error";
      return res.status(500).json({
        error: "INTERNAL_ERROR",
        message: `שגיאה פנימית: ${message}`,
        messageEn: `Internal error: ${message}`,
      });
    }
  }
);

// ─── GET /api/face-detect/job/:jobId ─────────────────────────────────────────
router.get("/api/face-detect/job/:jobId", (req, res) => {
  const appUser = getAppUserFromCookie(req.cookies);
  if (!appUser) return res.status(401).json({ error: "UNAUTHORIZED" });
  const job = getJob(req.params.jobId);
  if (!job) return res.status(404).json({ error: "JOB_NOT_FOUND" });
  if (job.userId !== appUser.userId) return res.status(403).json({ error: "FORBIDDEN" });
  if (job.status === "done") {
    return res.json({ status: "done", result: job.result });
  } else if (job.status === "error") {
    return res.json({ status: "error", error: job.error, message: job.error, errorCode: job.errorCode, faceCount: job.faceCount });
  } else if (job.status === "cancelled") {
    return res.json({ status: "cancelled" });
  } else {
    return res.json({
      status: job.status,
      step: job.step,
      stepEn: job.stepEn,
      partialImages: job.partialImages ?? [],
    });
  }
});

// ─── POST /api/face-detect/cancel/:jobId ─────────────────────────────────────
router.post("/api/face-detect/cancel/:jobId", async (req, res) => {
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
        const cancelRefundCost = await getTokenCostForAction((job.tokenAction as string) || "face_detect");
        await addTokens(appUser.userId, cancelRefundCost, "refund", "Job cancelled — tokens refunded");
      } catch (refundErr) {
        console.error("[faceDetectRoute] Refund error:", refundErr);
      }
    }
    // Record cancelled action in user history
    void recordUserAction({
      appUserId: appUser.userId,
      actionType: "ai_generate",
      description: "portrait — בוטל",
      feature: "portrait",
      status: "cancelled",
    });
    return res.json({ cancelled: true });
  }
  return res.json({ cancelled: false, reason: "Job already finished" });
});

// ─── POST /api/face-detect/quick-check ──────────────────────────────────────
// Lightweight face detection — no token cost, used by AiTraceTab to suggest portrait mode
router.post(
  "/api/face-detect/quick-check",
  upload.single("image"),
  async (req, res) => {
    try {
      // quick-check is public — no auth required (lightweight LLM call, no token cost)
      let imageBuffer: Buffer;
      if (req.file) {
        imageBuffer = req.file.buffer;
      } else if (req.body?.imageDataUrl) {
        // Accept base64 data URL from client
        const dataUrl = req.body.imageDataUrl as string;
        const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, "");
        imageBuffer = Buffer.from(base64, "base64");
      } else {
        return res.status(400).json({ error: "NO_IMAGE" });
      }

      // Send image directly to LLM (skip sharp resize to avoid JPEG corruption issues)
      // If the input is already a data URL, use it directly; otherwise convert buffer to base64
      let imageDataUrl: string;
      if (req.body?.imageDataUrl) {
        imageDataUrl = req.body.imageDataUrl as string;
      } else {
        // Try sharp first, fall back to raw buffer if it fails
        try {
          const resizedBuffer = await sharp(imageBuffer)
            .resize(256, 256, { fit: "inside", withoutEnlargement: true })
            .jpeg({ quality: 75 })
            .toBuffer();
          imageDataUrl = `data:image/jpeg;base64,${resizedBuffer.toString("base64")}`;
        } catch {
          imageDataUrl = `data:image/jpeg;base64,${imageBuffer.toString("base64")}`;
        }
      }

      // 5-second timeout — if LLM is slow, skip face check and let user proceed
      const faceCheckResponse = await Promise.race([
        invokeLLM({
        messages: [
          {
            role: "system",
            content: 'You are a face detection system. Detect if there are any human faces in the image. You MUST respond with valid JSON only, no other text. Example: {"hasFaces": true, "faceCount": 2}',
          },
          {
            role: "user",
            content: [
              { type: "image_url", image_url: { url: imageDataUrl, detail: "auto" } },
              { type: "text", text: 'Does this image contain any human faces (adults, babies, children, elderly, side profiles)? Respond with JSON only: {"hasFaces": true/false, "faceCount": number}' },
            ],
          },
        ],
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("TIMEOUT")), 5000)
        ),
      ]);

      console.log("[quick-check] Full LLM response:", JSON.stringify(faceCheckResponse).substring(0, 500));
      const rawContent = (faceCheckResponse as { choices?: Array<{ message?: { content?: string } }> })
        ?.choices?.[0]?.message?.content ?? "{}";
      console.log("[quick-check] LLM response content:", rawContent);
      // Strip markdown code blocks if present (e.g. ```json\n{...}\n```)
      const content = rawContent.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
      let hasFaces = false;
      let faceCount = 0;
      try {
        const parsed = JSON.parse(content) as { hasFaces?: boolean; faceCount?: number };
        hasFaces = parsed.hasFaces ?? false;
        faceCount = parsed.faceCount ?? 0;
        console.log("[quick-check] Parsed result:", { hasFaces, faceCount });
      } catch (e) { console.log("[quick-check] Parse error:", e, "content:", content); }

      return res.json({ hasFaces, faceCount });
    } catch (err) {
      console.error("[faceDetectRoute] Quick check error:", err);
      // On error, return false so the UI doesn't block the user
      return res.json({ hasFaces: false, faceCount: 0 });
    }
  }
);

export default router;

/**
 * faceDetectRoute.ts — Portrait generation pipeline.
 *
 * POST /api/face-detect/start  — Start a portrait job (returns { jobId })
 * GET  /api/face-detect/job/:jobId — Poll job status
 * POST /api/face-detect/cancel/:jobId — Cancel a running job
 *
 * Pipeline:
 *   A. Resize source image for gpt-image-1 edit API
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
import { cleanSvgForPreview } from "./svgClean";
import { invokeLLM } from "./_core/llm";
import OpenAI from "openai";
import potrace from "potrace";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 16 * 1024 * 1024 } });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY ?? "" });

// ─── Portrait styles ──────────────────────────────────────────────────────────
export type PortraitStyle = "simple" | "detailed";

const PORTRAIT_STYLE_PROMPTS: Record<PortraitStyle, string> = {
  simple:
    "Convert this face photo into a clean black-and-white line art portrait for laser engraving. " +
    "CRITICAL IDENTITY REQUIREMENT: This must be a recognizable likeness of the SPECIFIC person in the photo. " +
    "FACIAL ACCURACY IS THE TOP PRIORITY — study the photo carefully before drawing: " +
    "(1) FACE SHAPE: measure and replicate the exact outline — oval/round/square/heart/diamond. Draw the precise jawline curve, chin width, and cheekbone width. " +
    "(2) NOSE: this is the most identity-defining feature. Replicate the exact nose shape — bridge width, tip shape (round/pointed/flat/upturned), nostril size and flare, nose length relative to face. " +
    "(3) EYES: exact eye shape (almond/round/hooded/deep-set), precise spacing between eyes, eyelid fold style, brow arch height and thickness. " +
    "(4) MOUTH: lip thickness ratio (thin/full), cupid's bow shape, corner position, philtrum depth. " +
    "(5) EXPRESSION: preserve the exact expression from the photo — neutral/smile/serious/relaxed. " +
    "(6) PROPORTIONS: maintain exact distances — eye-to-nose, nose-to-mouth, mouth-to-chin. " +
    "The result must look like THIS specific person, not a generic face. " +
    "Style: clean minimal lines, no shading, no grey tones, pure black strokes on white background. " +
    "Composition: head and face only, no clothing or background. Face fills 65-75% of canvas. Full head visible. " +
    "Include: face contour, hairline, eyes with lashes, eyebrows, nose with nostrils, lips, ears, neck. Beard/stubble if present. " +
    "No text, no watermarks, no decorative elements.",

  detailed:
    "Convert this face photo into a detailed black-and-white line art portrait for laser engraving. " +
    "CRITICAL IDENTITY REQUIREMENT: This must be an unmistakably recognizable likeness of the SPECIFIC person in the photo. " +
    "MAXIMUM FACIAL ACCURACY — analyze every feature before drawing: " +
    "(1) FACE SHAPE: precise outer contour — exact jawline curve, chin shape (pointed/round/square/cleft), cheekbone prominence, temple width, forehead height. " +
    "(2) NOSE — THE MOST IDENTITY-CRITICAL FEATURE: replicate with maximum precision — nose bridge width and straightness/curve, tip shape and size, nostril shape (circular/oval/flared/narrow), columella angle, nose length and projection from face. " +
    "(3) EYES: exact iris size, precise eyelid shape (single/double fold, hooded, deep-set), lash line curve, inner/outer corner angles, exact brow shape with individual hair direction. " +
    "(4) MOUTH: exact lip shape — upper lip cupid's bow depth, lower lip fullness, lip corner position, philtrum ridges, vermillion border. " +
    "(5) EXPRESSION: capture the exact emotional expression — every subtle muscle tension around eyes, mouth corners, brow position. " +
    "(6) PROPORTIONS: exact measurements — eye width, inter-pupillary distance, nose width vs mouth width ratio, all facial thirds. " +
    "(7) SKIN STRUCTURE: fine lines for cheekbone shadows, nasolabial folds if present, forehead lines, under-eye area. " +
    "Style: detailed line art, no shading or grey — only black lines on white. " +
    "Composition: head and face only, no clothing or background. Face fills 65-75% of canvas. Full head visible. " +
    "Include: detailed hair strands, eyes with iris/lashes/eyelid folds, brow hairs, nose bridge/nostrils/tip, lips with philtrum, ears with inner cartilage detail, neck, beard/stubble with growth direction if present. " +
    "No text, no watermarks.",
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

// ─── Generate one portrait variation ─────────────────────────────────────────
type PortraitResult = {
  imageUrl: string;
  svgPreview: string;
  dxfUrl: string;
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
  const { toFile } = await import("openai");
  const editFile = await toFile(editSourceBuffer, "face.png", { type: "image/png" });
  const editPrompt = PORTRAIT_STYLE_PROMPTS[style];

  // gpt-image-1 with quality:medium gives better face likeness (identity preservation)
  const response = await openai.images.edit({
    model: "gpt-image-1",
    image: editFile,
    prompt: editPrompt,
    n: 1,
    size: "1024x1024",
    quality: "medium",
  });

  const imageData = response.data?.[0];
  if (!imageData) throw new Error("Failed to generate image for style: " + style);

  let rawBuffer: Buffer;
  if (imageData.b64_json) {
    rawBuffer = Buffer.from(imageData.b64_json, "base64");
  } else if (imageData.url) {
    const imgResponse = await fetch(imageData.url);
    if (!imgResponse.ok) throw new Error("Failed to download generated image");
    rawBuffer = Buffer.from(await imgResponse.arrayBuffer());
  } else {
    throw new Error("No image returned from AI");
  }

  // Potrace → SVG → DXF
  const processedBuffer = await sharp(rawBuffer)
    .extend({ top: 60, bottom: 60, left: 60, right: 60, background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .resize(1024, 1024, { fit: "inside", background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .grayscale()
    .threshold(200)
    .png()
    .toBuffer();

  const rawSvg = await pngToSvg(processedBuffer);
  const cleanSvg = cleanSvgForPreview(rawSvg);

  const { dxf, segmentCount, width, height, realWidth, realHeight } = svgToDxf(rawSvg, hairline, lineweightMm, minGapMm);

  const imgKey = `face-detect-generated/${nanoid()}.png`;
  const { url: imageUrl } = await storagePut(imgKey, rawBuffer, "image/png");
  const dxfFilename = `face_portrait_${style}.dxf`;
  const dxfKey = `face-detect-dxf/${nanoid()}-${dxfFilename}`;
  const { url: dxfUrl } = await storagePut(dxfKey, Buffer.from(dxf, "utf-8"), "application/dxf");

  return {
    imageUrl,
    svgPreview: cleanSvg,
    dxfUrl,
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
    const content = typeof rawContent === "string" ? rawContent : null;
    if (!content) return [];
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
    const imageBase64 = imageBuffer.toString("base64");
    const faceCheckResponse = await invokeLLM({
      messages: [
        {
          role: "system",
          content: "You are a precise face detection system. Analyze the image and count the number of clearly visible human faces. Respond with JSON only.",
        },
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}`, detail: "high" } },
            { type: "text", text: "Count the number of clearly visible human faces in this image. Respond with JSON only: {\"faceCount\": <number 0-10>, \"confidence\": \"high\"/\"medium\"/\"low\"}" },
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
              faceCount: { type: "number" },
              confidence: { type: "string", enum: ["high", "medium", "low"] },
            },
            required: ["faceCount", "confidence"],
            additionalProperties: false,
          },
        },
      },
    });
    const faceCheckContent = (faceCheckResponse as { choices?: Array<{ message?: { content?: string } }> })
      ?.choices?.[0]?.message?.content ?? "{}";
    let faceCount = 1;
    try {
      const parsed = JSON.parse(faceCheckContent);
      faceCount = typeof parsed.faceCount === "number" ? Math.max(0, Math.round(parsed.faceCount)) : 1;
    } catch { faceCount = 1; } // default to 1 on parse error
    
    if (faceCount === 0) {
      // Refund tokens — no face found
      try {
        const noFaceRefundCost = await getTokenCostForAction("face_detect");
        await addTokens(appUserId, noFaceRefundCost, "refund", "No face detected — tokens refunded");
      } catch { /* ignore */ }
      const errorMsg = isHe
        ? "לא זויינו פנים בתמונה זו. אנא העלה תמונה ברורה של פנים אחד או יותר."
        : "No face detected in this image. Please upload a clear photo with at least one visible face.";
      updateJob(jobId, { status: "error", error: errorMsg });
      return;
    }

    const jobAfterFaceCheck = getJob(jobId);
    if (!jobAfterFaceCheck || jobAfterFaceCheck.status === "cancelled") return;

    // ── Step B: Prepare source image ────────────────────────────────────────────────
    // Use 512px for better face accuracy
    const editSourceBuffer = await sharp(imageBuffer)
      .resize(512, 512, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .png({ compressionLevel: 3 })
      .toBuffer();

    // ── Step C: Generate portrait(s) + AI suggestions in parallel ───────────────
    heartbeatInterval = setInterval(() => heartbeatJob(jobId), 30_000);

    // If multiple faces detected (up to 2), generate a portrait for each
    const numPortraits = Math.min(faceCount, 2);
    
    if (numPortraits > 1) {
      updateJob(jobId, {
        step: isHe ? `זוהו ${numPortraits} פנים — מצייר ${numPortraits} פורטרטים...` : `Detected ${numPortraits} faces — drawing ${numPortraits} portraits...`,
        stepEn: `Detected ${numPortraits} faces — drawing ${numPortraits} portraits...`,
      });
    }

    // Build prompts for multi-face: focus on each face separately
    const buildMultiFacePrompt = (faceIndex: number, totalFaces: number, basePrompt: string): string => {
      if (totalFaces <= 1) return basePrompt;
      return basePrompt + ` IMPORTANT: This image contains ${totalFaces} faces. Draw ONLY the ${faceIndex === 0 ? "first/left" : "second/right"} face (person ${faceIndex + 1}). Focus exclusively on that individual's face. Ignore the other person(s).`;
    };

    // Override generatePortraitVariation for multi-face with custom prompt
    const generateWithCustomPrompt = async (faceIdx: number): Promise<PortraitResult> => {
      if (numPortraits <= 1) return generatePortraitVariation(editSourceBuffer, style, hairline, lineweightMm, minGapMm);
      const { toFile } = await import("openai");
      const editFile = await toFile(editSourceBuffer, "face.png", { type: "image/png" });
      const basePrompt = PORTRAIT_STYLE_PROMPTS[style];
      const editPrompt = buildMultiFacePrompt(faceIdx, numPortraits, basePrompt);
      const response = await openai.images.edit({
        model: "gpt-image-1",
        image: editFile,
        prompt: editPrompt,
        n: 1,
        size: "1024x1024",
        quality: "medium",
      });
      const imageData = response.data?.[0];
      if (!imageData) throw new Error("Failed to generate portrait for face " + (faceIdx + 1));
      let rawBuffer: Buffer;
      if (imageData.b64_json) {
        rawBuffer = Buffer.from(imageData.b64_json, "base64");
      } else if (imageData.url) {
        const imgRes = await fetch(imageData.url);
        if (!imgRes.ok) throw new Error("Failed to download generated image");
        rawBuffer = Buffer.from(await imgRes.arrayBuffer());
      } else throw new Error("No image returned from AI");
      const processedBuffer = await sharp(rawBuffer)
        .extend({ top: 60, bottom: 60, left: 60, right: 60, background: { r: 255, g: 255, b: 255, alpha: 1 } })
        .resize(1024, 1024, { fit: "inside", background: { r: 255, g: 255, b: 255, alpha: 1 } })
        .grayscale().threshold(200).png().toBuffer();
      const rawSvg = await pngToSvg(processedBuffer);
      const cleanSvg = cleanSvgForPreview(rawSvg);
      const { dxf, segmentCount, width, height, realWidth, realHeight } = svgToDxf(rawSvg, hairline, lineweightMm, minGapMm);
      const imgKey = `face-detect-generated/${nanoid()}.png`;
      const { url: imageUrl } = await storagePut(imgKey, rawBuffer, "image/png");
      const dxfFilename = `face_portrait_${style}_face${faceIdx + 1}.dxf`;
      const dxfKey = `face-detect-dxf/${nanoid()}-${dxfFilename}`;
      const { url: dxfUrl } = await storagePut(dxfKey, Buffer.from(dxf, "utf-8"), "application/dxf");
      const faceLabel = numPortraits > 1 ? (isHe ? ` (פנים ${faceIdx + 1})` : ` (Face ${faceIdx + 1})`) : "";
      return {
        imageUrl, svgPreview: cleanSvg, dxfUrl, dxfFilename, segmentCount, width, height, realWidth, realHeight,
        style,
        styleLabel: STYLE_LABELS[style].he + faceLabel,
        styleLabelEn: STYLE_LABELS[style].en + (numPortraits > 1 ? ` (Face ${faceIdx + 1})` : ""),
      };
    };

    // Generate all portraits + suggestions in parallel
    const portraitPromises = Array.from({ length: numPortraits }, (_, i) => generateWithCustomPrompt(i));
    const [portraitResults, suggestions] = await Promise.all([
      Promise.all(portraitPromises),
      generateAiSuggestions(style, lang),
    ]);

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
      result: { success: true, images, suggestions },
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
      runFaceDetectJob(jobId, imageBuffer, lang, appUser.userId, ipAnon ?? "", style, uploadedSourceImageUrl, hairline, lineweightMm, minGapMm)
        .catch((err) => console.error("[faceDetectRoute] Unhandled job error:", err));

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
    return res.json({ status: "error", error: job.error, message: job.error });
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

export default router;

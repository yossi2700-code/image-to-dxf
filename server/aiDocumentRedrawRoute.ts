/**
 * AI Document Redraw Route — Redraws a photo/document/sketch as clean laser-engraving lines.
 *
 * POST /api/ai-document-redraw
 *   Returns immediately with { jobId } — processing continues in background.
 *
 * GET /api/ai-document-redraw/job/:jobId
 *   Poll for job status: { status, result?, error? }
 *
 * POST /api/ai-document-redraw/cancel/:jobId
 *   Cancel a pending/processing job → refunds tokens.
 *
 * POST /api/ai-document-redraw/refine
 *   Takes an existing generated image + correction instruction → redraws with the correction.
 */
import { Router } from "express";
import multer from "multer";
import sharp from "sharp";
import { storagePut } from "./storage";
import { nanoid } from "nanoid";
import { logUsageEvent, anonymizeIp } from "./usageDb";
import { getAppUserFromCookie } from "./appAuth";
import { recordUserAction } from "./userActionsDb";
import { deductTokens, addTokens, TOKEN_COSTS, TokenAction } from "./tokenService";
import { svgToDxf } from "./svgToDxf";
import { cleanSvgForPreview } from "./svgClean";
import { invokeLLM } from "./_core/llm";
import potrace from "potrace";
import { createJob, getJob, updateJob, cancelJob, heartbeatJob } from "./jobStore";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY ?? "" });

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 16 * 1024 * 1024 } });

/** Convert description to safe filename — capped at 15 chars for clean download names */
function buildFilename(description: string): string {
  const words = description
    .replace(/[^\u0590-\u05FFa-zA-Z0-9\s]/g, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  let name = "";
  for (const w of words) {
    const next = name ? `${name}_${w}` : w;
    if (next.length > 15) break;
    name = next;
  }
  return (name || "doc_redraw").slice(0, 15).replace(/_+$/, "");
}

/** Convert a PNG buffer to SVG using potrace. */
function pngToSvg(pngBuffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    potrace.trace(
      pngBuffer,
      {
        threshold: 128,  // strict mid-point: only pure black pixels become lines, grey is ignored
        turdSize: 4,     // remove tiny noise specks
        alphaMax: 0.5,   // tighter corner detection → sharper angles
        optCurve: true,
        optTolerance: 0.1, // less smoothing → more faithful to original shape
      },
      (err: Error | null, svg: string) => {
        if (err) reject(err);
        else resolve(svg);
      }
    );
  });
}

/**
 * Build a line art prompt for document/sketch redraw.
 * Focuses on engraving-style detail suitable for CNC laser.
 */
function buildDocumentLineArtPrompt(objectDescription: string): string {
  return (
    `Professional black and white engraving-style line art of: ${objectDescription}. ` +
    "=== CAMERA ANGLE / VIEW — MOST CRITICAL RULE === " +
    "Draw the object from the EXACT same camera angle and view described above. " +
    "If the description says 'pure side view' or 'profile view' — draw it as a FLAT 90-DEGREE SIDE VIEW, NOT a 3/4 angle. " +
    "If the description says 'front view' — draw it facing directly toward the viewer. " +
    "DO NOT change the camera angle. DO NOT mirror or flip the object. " +
    "=== END CAMERA ANGLE RULE === " +
    "STYLE: Fine art engraving — like a master woodcut or steel engraving. Lines vary in weight: thicker for main outlines, thinner for interior details and textures. " +
    "Decorative elements (flowers, leaves, scrollwork, ornaments) should have intricate, detailed linework with visible internal structure. " +
    "Pure white background (#FFFFFF). Only pure black (#000000) lines on white. NO fills, NO shading, NO gradients. " +
    "=== MANDATORY FRAMING RULES (NEVER VIOLATE) === " +
    "The ENTIRE object MUST be 100% visible — NOTHING cut off, NOTHING touching the edge. " +
    "Leave AT LEAST 15% white empty space on EVERY side (top, bottom, left, right). " +
    "=== END FRAMING RULES === " +
    "Include ALL decorative details visible in the original — do not simplify or omit fine ornamental elements. " +
    "NO TEXT: Remove ALL text, letters, words, numbers, and inscriptions. Draw ONLY the graphic/decorative elements. " +
    "Professional engraving-style line art suitable for laser engraving on stone or metal."
  );
}

/**
 * Process a raw PNG buffer through potrace → SVG → DXF pipeline.
 * Preserves original aspect ratio instead of forcing square output.
 */
async function processImageToDxf(rawBuffer: Buffer, baseFilename: string, prefix: string, originalAspect?: number) {
  // Determine target dimensions preserving aspect ratio
  const targetW = 1024;
  const targetH = originalAspect ? Math.round(1024 / originalAspect) : 1024;

  // Pre-process: add generous white padding to prevent edge cropping
  // Use fit:inside to preserve aspect ratio — never crop or distort the image.
  const processedBuffer = await sharp(rawBuffer)
    .extend({
      top: 120,
      bottom: 120,
      left: 100,
      right: 100,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    })
    .resize(1400, 1400, { fit: "inside", background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .grayscale()
    .linear(1.8, -(1.8 * 128) + 128) // boost contrast: amplify difference between lines and background
    .threshold(160) // strict threshold: only near-black pixels become lines
    .png()
    .toBuffer();

  // Vectorize with potrace → smooth SVG Bezier curves
  const rawSvg = await pngToSvg(processedBuffer);

  // Convert filled paths to stroke-only for SVG preview
  const cleanSvg = cleanSvgForPreview(rawSvg);

  // Convert SVG to DXF
  const { dxf, segmentCount, width, height, realWidth, realHeight } = svgToDxf(rawSvg);

  // Upload original PNG to S3
  const imgKey = `${prefix}-generated/${nanoid()}.png`;
  const { url: imageUrl } = await storagePut(imgKey, rawBuffer, "image/png");

  // Upload DXF to S3
  const dxfFilename = `${baseFilename}.dxf`;
  const dxfKey = `${prefix}-dxf/${nanoid()}-${dxfFilename}`;
  const { url: dxfUrl } = await storagePut(dxfKey, Buffer.from(dxf, "utf-8"), "application/dxf");

  return { imageUrl, svgPreview: cleanSvg, dxfUrl, dxfFilename, segmentCount, width, height, realWidth, realHeight };
}

/**
 * Core processing function — runs in background after job is created.
 * Updates job status as it progresses.
 */
async function runDocumentRedrawJob(
  jobId: string,
  imageBuffer: Buffer,
  userDesc: string,
  appUserId: number,
  ipAnon: string,
  originalAspect: number
) {
  let heartbeatInterval: ReturnType<typeof setInterval> | undefined;
  try {
    updateJob(jobId, { status: "processing" });

    // Check if cancelled before heavy work
    const jobCheck = getJob(jobId);
    if (!jobCheck || jobCheck.status === "cancelled") return;

    console.log("[aiDocumentRedraw] Analyzing image with LLM...");
    const baseFilename = buildFilename(userDesc || "document");

    // Prepare image as base64 for LLM analysis
    const analysisBuffer = await sharp(imageBuffer)
      .resize(1024, 1024, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
    const imageBase64 = analysisBuffer.toString("base64");

    // Step A: LLM analyzes the image
    const llmResponse = await invokeLLM({
      messages: [
        {
          role: "system",
          content:
            "You are an expert at describing images for line art / engraving generation. " +
            "Analyze the image and provide a precise description for generating clean engraving-style line art that EXACTLY matches the original. " +
            "CRITICAL — you MUST describe ALL of the following: " +
            "(1) CAMERA ANGLE / VIEW TYPE — this is the most important: Is it a PURE SIDE VIEW (90 degrees, profile)? A FRONT VIEW (facing camera)? A REAR VIEW? A 3/4 ANGLE VIEW (diagonal)? A TOP-DOWN VIEW? Be extremely specific. " +
            "(2) The exact facing direction of any person/animal/figure/vehicle (facing left, facing right, facing forward, etc.). " +
            "(3) The exact body pose and position (standing, sitting, crouching, arms raised, walking, etc.). " +
            "(4) Key structural features, proportions, decorative elements, and distinctive details. " +
            "(5) Any text or inscriptions present (describe their position but note they should be removed from the line art). " +
            "Start your description with the camera angle/view type. Output ONLY the description (3-6 sentences), no preamble.",
        },
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}`, detail: "low" } },
            { type: "text", text: userDesc
              ? `Describe this image for engraving line art generation. User note: ${userDesc}`
              : "Describe this image for engraving line art generation. Include all decorative elements, figures, and their exact positions/orientations." },
          ],
        },
      ],
    });

    const objectDescription =
      (llmResponse as { choices?: Array<{ message?: { content?: string } }> })
        ?.choices?.[0]?.message?.content?.trim() ||
      userDesc ||
      "decorative engraving design";

    // Check if cancelled before generation
    const jobBeforeGen = getJob(jobId);
    if (!jobBeforeGen || jobBeforeGen.status === "cancelled") return;

    // Step B: Generate with openai.images.generate (same as AI Outline — reliable, no timeout)
    const imagePrompt = buildDocumentLineArtPrompt(objectDescription + (userDesc ? `. User note: ${userDesc}` : ""));

    // Heartbeat every 30s to prevent stale-job timeout during image generation
    heartbeatInterval = setInterval(() => heartbeatJob(jobId), 30_000);

    const genResponse = await openai.images.generate({
      model: "gpt-image-1",
      prompt: imagePrompt,
      n: 1,
      size: "1024x1024",
      quality: "medium",
    });

    const imageData = genResponse.data?.[0];
    if (!imageData) throw new Error("לא הצלחנו לייצר תמונה");

    let rawBuffer: Buffer;
    if (imageData.b64_json) {
      rawBuffer = Buffer.from(imageData.b64_json, "base64");
    } else if (imageData.url) {
      const imgResp = await fetch(imageData.url);
      if (!imgResp.ok) throw new Error("שגיאה בהורדת התמונה שנוצרה");
      rawBuffer = Buffer.from(await imgResp.arrayBuffer());
    } else {
      throw new Error("לא התקבלה תמונה מה-AI");
    }

    clearInterval(heartbeatInterval);
    // Check if cancelled after image generation
    const jobAfterGen = getJob(jobId);
    if (!jobAfterGen || jobAfterGen.status === "cancelled") return;

    // ── Step C: Vectorize ─────────────────────────────────────────────────────
    const result = await processImageToDxf(rawBuffer, baseFilename, "ai-document-redraw", originalAspect);

    // ── Log usage ─────────────────────────────────────────────────────────────
    await logUsageEvent({
      type: "ai_generate",
      segmentCount: result.segmentCount,
      ipAnon,
      appUserId,
    });

    const groupId = `doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    await recordUserAction({
      appUserId,
      actionType: "ai_generate",
      description: objectDescription.slice(0, 200),
      segmentCount: result.segmentCount,
      dxfUrl: result.dxfUrl,
      imageUrl: result.imageUrl,
      svgPreview: result.svgPreview,
      groupId,
      variationLabel: "document-redraw",
      feature: "document_redraw",
    });

    updateJob(jobId, {
      status: "done",
      result: { success: true, image: result, objectDescription },
    });

  } catch (err: unknown) {
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    console.error("[aiDocumentRedraw] Job error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    updateJob(jobId, { status: "error", error: message });
    // Refund tokens on error
    try { await addTokens(appUserId, TOKEN_COSTS["ai_trace"], "refund", "Job error — tokens refunded"); } catch (_) { /* ignore */ }
  }
}

// ─── POST /api/ai-document-redraw ─────────────────────────────────────────────
// Returns immediately with { jobId } — processing continues in background
router.post(
  "/api/ai-document-redraw",
  upload.single("image"),
  async (req, res) => {
    try {
      // ── Auth check ────────────────────────────────────────────────────────────
      const appUser = getAppUserFromCookie(req.cookies);
      if (!appUser) {
        return res.status(401).json({
          error: "UNAUTHORIZED",
          message: "יש להתחבר כדי להשתמש בעריכת AI מצילום",
          messageEn: "Please log in to use AI Document Redraw",
        });
      }

      // ── Block check ───────────────────────────────────────────────────────────
      const { getDb } = await import("./db");
      const { appUsers } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (db) {
        const [userRow] = await db
          .select({ isBlocked: appUsers.isBlocked })
          .from(appUsers)
          .where(eq(appUsers.id, appUser.userId))
          .limit(1);
        if (userRow?.isBlocked) {
          return res.status(403).json({
            error: "USER_BLOCKED",
            message: "חשבונך חסום. לפרטים פנה לתמיכה.",
          });
        }
      }

      // ── Token check & deduction ───────────────────────────────────────────────
      const tokenResult = await deductTokens(appUser.userId, "ai_trace");
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

      // ── Detect original aspect ratio ──────────────────────────────────────────
      let originalAspect = 1;
      try {
        const meta = await sharp(imageBuffer).metadata();
        if (meta.width && meta.height) {
          originalAspect = meta.width / meta.height;
        }
      } catch (_) { /* use default 1:1 */ }

      const userDesc = (req.body?.description || "").trim();
      const ipAnon = anonymizeIp(
        ((req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
        req.socket.remoteAddress ||
        "") as string
      );

      // ── Create job and start background processing ────────────────────────────
      const jobId = nanoid(12);
      createJob(jobId, appUser.userId, "ai_trace");

      // Fire-and-forget — does NOT await
      runDocumentRedrawJob(jobId, imageBuffer, userDesc, appUser.userId, ipAnon ?? "", originalAspect)
        .catch((err) => console.error("[aiDocumentRedraw] Unhandled job error:", err));

      // Return job ID immediately
      return res.json({ jobId });

    } catch (err: unknown) {
      console.error("[aiDocumentRedraw] Error:", err);
      const message = err instanceof Error ? err.message : "Unknown error";
      return res.status(500).json({ error: "INTERNAL_ERROR", message });
    }
  }
);

// ─── GET /api/ai-document-redraw/job/:jobId ───────────────────────────────────
router.get("/api/ai-document-redraw/job/:jobId", (req, res) => {
  const appUser = getAppUserFromCookie(req.cookies);
  if (!appUser) return res.status(401).json({ error: "UNAUTHORIZED" });

  const job = getJob(req.params.jobId);
  if (!job) return res.status(404).json({ error: "JOB_NOT_FOUND" });
  if (job.userId !== appUser.userId) return res.status(403).json({ error: "FORBIDDEN" });

  if (job.status === "done") {
    return res.json({ status: "done", result: job.result });
  } else if (job.status === "error") {
    const isNoIllustrations = job.error === "NO_ILLUSTRATIONS_FOUND";
    return res.json({
      status: "error",
      error: job.error,
      message: isNoIllustrations
        ? "לא נמצאו איורים או עיטורים בתמונה. נסה תמונה עם פרחים, סמלים, עיטורים או ציורים."
        : `שגיאה: ${job.error}`,
    });
  } else if (job.status === "cancelled") {
    return res.json({ status: "cancelled" });
  } else {
    return res.json({ status: job.status });
  }
});

// ─── POST /api/ai-document-redraw/cancel/:jobId ───────────────────────────────
router.post("/api/ai-document-redraw/cancel/:jobId", async (req, res) => {
  const appUser = getAppUserFromCookie(req.cookies);
  if (!appUser) return res.status(401).json({ error: "UNAUTHORIZED" });

  const job = getJob(req.params.jobId);
  if (!job) return res.status(404).json({ error: "JOB_NOT_FOUND" });
  if (job.userId !== appUser.userId) return res.status(403).json({ error: "FORBIDDEN" });

  if (job.status === "done") {
    return res.json({ cancelled: false, reason: "Job already completed — no refund needed" });
  }

  const wasCancelled = cancelJob(req.params.jobId);
  if (wasCancelled) {
    try {
      await addTokens(appUser.userId, TOKEN_COSTS[(job.tokenAction as TokenAction) || "ai_trace"], "refund", "Job cancelled — tokens refunded");
    } catch (refundErr) {
      console.error("[aiDocumentRedraw] Refund error:", refundErr);
    }
    return res.json({ cancelled: true });
  }

  return res.json({ cancelled: false, reason: "Job already finished" });
});

// ─── POST /api/ai-document-redraw/refine ──────────────────────────────────────
router.post(
  "/api/ai-document-redraw/refine",
  async (req, res) => {
    try {
      const appUser = getAppUserFromCookie(req.cookies);
      if (!appUser) {
        return res.status(401).json({
          error: "UNAUTHORIZED",
          message: "יש להתחבר כדי להשתמש בתיקון AI",
          messageEn: "Please log in to use AI refinement",
        });
      }

      const { imageUrl, instruction, objectDescription: origDesc } = req.body as {
        imageUrl?: string;
        instruction?: string;
        objectDescription?: string;
      };

      if (!imageUrl || !imageUrl.startsWith("http")) {
        return res.status(400).json({ error: "NO_IMAGE_URL", message: "לא סופק קישור תמונה" });
      }
      if (!instruction || instruction.trim().length < 3) {
        return res.status(400).json({ error: "NO_INSTRUCTION", message: "נא לתאר את התיקון הרצוי" });
      }

      // ── Block check ───────────────────────────────────────────────────────────
      const { getDb } = await import("./db");
      const { appUsers } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (db) {
        const [userRow] = await db
          .select({ isBlocked: appUsers.isBlocked })
          .from(appUsers)
          .where(eq(appUsers.id, appUser.userId))
          .limit(1);
        if (userRow?.isBlocked) {
          return res.status(403).json({
            error: "USER_BLOCKED",
            message: "חשבונך חסום. לפרטים פנה לתמיכה.",
          });
        }
      }

      // ── Token check & deduction ───────────────────────────────────────────────
      const tokenResult = await deductTokens(appUser.userId, "ai_refine", instruction);
      if (!tokenResult.success) {
        return res.status(402).json({
          error: "INSUFFICIENT_TOKENS",
          balance: tokenResult.balance,
          message: "נגמרו לך האסימונים. יש לטעון אסימונים להמשך שימוש.",
        });
      }

      // ── Download source image ─────────────────────────────────────────────────
      const imgResponse = await fetch(imageUrl);
      if (!imgResponse.ok) throw new Error("שגיאה בהורדת התמונה");
      const sourceBuffer = Buffer.from(await imgResponse.arrayBuffer());

      // Prepare as PNG for Forge API
      const pngBuffer = await sharp(sourceBuffer)
        .resize(1024, 1024, { fit: "inside", withoutEnlargement: true })
        .png()
        .toBuffer();
      const sourceB64 = pngBuffer.toString("base64");

      // ── Refine with openai.images.generate ───────────────────────────────────
      const refinePrompt =
        `Professional black and white engraving-style line art. ` +
        (origDesc ? `Original design: ${origDesc}. ` : "") +
        `Apply this correction: ${instruction.trim()}. ` +
        "Keep all other elements exactly as they are — same angles, same positions, same proportions, same orientation. " +
        "Maintain the same clean black-and-white line art style. " +
        "Pure black lines on white background. No grey tones, no gradients, no fills. " +
        "The complete design must fit inside the frame with 15% margin on all sides.";

      const genResp = await openai.images.generate({
        model: "gpt-image-1",
        prompt: refinePrompt,
        n: 1,
        size: "1024x1024",
        quality: "medium",
      });

      const refineImageData = genResp.data?.[0];
      if (!refineImageData) throw new Error("לא הצלחנו לייצר תמונה");

      let rawBuffer: Buffer;
      if (refineImageData.b64_json) {
        rawBuffer = Buffer.from(refineImageData.b64_json, "base64");
      } else if (refineImageData.url) {
        const imgR = await fetch(refineImageData.url);
        if (!imgR.ok) throw new Error("שגיאה בהורדת התמונה שנוצרה");
        rawBuffer = Buffer.from(await imgR.arrayBuffer());
      } else {
        throw new Error("לא התקבלה תמונה מה-AI");
      }

      const baseFilename = buildFilename(origDesc || instruction);
      const result = await processImageToDxf(rawBuffer, baseFilename, "ai-document-refine");

      return res.json({ success: true, image: result });
    } catch (err: unknown) {
      console.error("[aiDocumentRedraw/refine] Error:", err);
      const message = err instanceof Error ? err.message : "Unknown error";
      return res.status(500).json({ error: "INTERNAL_ERROR", message });
    }
  }
);

export default router;

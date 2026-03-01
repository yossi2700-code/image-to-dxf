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
import { invokeLLM } from "./_core/llm";
import OpenAI from "openai";
import { svgToDxf } from "./svgToDxf";
import potrace from "potrace";
import { createJob, getJob, updateJob, cancelJob } from "./jobStore";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 16 * 1024 * 1024 } });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY ?? "" });

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
  return (name || "doc_redraw").slice(0, 15);
}

/** Convert a PNG buffer to SVG using potrace. */
function pngToSvg(pngBuffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    potrace.trace(
      pngBuffer,
      {
        threshold: 180,
        turdSize: 8,
        alphaMax: 1,
        optCurve: true,
        optTolerance: 0.2,
      },
      (err: Error | null, svg: string) => {
        if (err) reject(err);
        else resolve(svg);
      }
    );
  });
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
  const processedBuffer = await sharp(rawBuffer)
    .extend({
      top: 120,
      bottom: 120,
      left: 100,
      right: 100,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    })
    .resize(targetW, targetH, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .grayscale()
    .threshold(200)
    .png()
    .toBuffer();

  // Vectorize with potrace → smooth SVG Bezier curves
  const rawSvg = await pngToSvg(processedBuffer);

  // Convert filled paths to stroke-only for SVG preview
  const svgContent = rawSvg
    .replace(/fill="[^"]*"/g, 'fill="none"')
    .replace(/fill:[^;"']*(;|(?="))/g, "fill:none$1")
    .replace(/<path /g, '<path stroke="black" stroke-width="1.5" fill="none" ');
  const cleanSvg = svgContent.replace(
    /stroke="black" stroke-width="1.5" fill="none" ([^>]*?)fill="none"/g,
    'stroke="black" stroke-width="1.5" fill="none" $1'
  );

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
  try {
    updateJob(jobId, { status: "processing" });

    // Check if cancelled before heavy work
    const jobCheck = getJob(jobId);
    if (!jobCheck || jobCheck.status === "cancelled") return;

    // ── Step A: LLM analyzes image → finds ONLY illustrations/decorations (no text, no background) ──
    console.log("[aiDocumentRedraw] Analyzing image for ALL decorative elements...");
    const resized = await sharp(imageBuffer)
      .resize(768, 768, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 90 })
      .toBuffer();
    const imageBase64 = resized.toString("base64");

    const llmResponse = await invokeLLM({
      messages: [
        {
          role: "system",
          content:
            "You are a precise graphic analyst for laser engraving reproduction. " +
            "Your ONLY job: describe ALL non-text decorative graphic elements in the image so they can be redrawn EXACTLY as they appear — same angles, same proportions, same positions, same sizes relative to each other. " +
            "\n\nCRITICAL RULES:\n" +
            "1. SCAN THE ENTIRE IMAGE — top, bottom, left, right, center, corners. Do NOT miss any element.\n" +
            "2. Describe EVERY decorative element: flowers, leaves, vines, birds, geometric ornaments, corner decorations, border patterns, symbols, portraits, animals, scrollwork, etc.\n" +
            "3. For EACH element specify: exact position (top-left corner, center, surrounding border, etc.), shape, size relative to others, orientation/angle, and style.\n" +
            "4. If there are MULTIPLE FLOWERS or repeated motifs, describe ALL of them with their exact arrangement.\n" +
            "5. If there is a BORDER or FRAME, describe the complete border pattern including corners.\n" +
            "6. NEVER describe text, letters, numbers, or plain background material.\n" +
            "7. If there are NO illustrations at all (only text and plain background), respond with exactly: NO_ILLUSTRATIONS\n" +
            "8. Output a structured description: start with 'COMPOSITION OVERVIEW:' then list each element with its position and proportions.",
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
              text: userDesc
                ? `Scan the ENTIRE image and describe ALL decorative graphic elements with their exact positions, angles, and proportions. Do NOT miss any element. Do NOT describe text or background. Additional context: ${userDesc}`
                : "Scan the ENTIRE image carefully. Describe ALL decorative graphic elements — check every corner, every edge. List each element with its exact position, angle, and size relative to the overall composition. If there are multiple flowers or ornaments, describe ALL of them. Do NOT describe text, letters, or background.",
            },
          ],
        },
      ],
    });

    // Check if cancelled after LLM step
    const jobAfterLlm = getJob(jobId);
    if (!jobAfterLlm || jobAfterLlm.status === "cancelled") return;

    const llmRaw =
      (llmResponse as { choices?: Array<{ message?: { content?: string } }> })
        ?.choices?.[0]?.message?.content?.trim() || "";

    if (!llmRaw || llmRaw.toUpperCase().includes("NO_ILLUSTRATIONS")) {
      updateJob(jobId, {
        status: "error",
        error: "NO_ILLUSTRATIONS_FOUND",
      });
      // Refund tokens since no useful work was done
      await addTokens(appUserId, TOKEN_COSTS["ai_trace"], "refund", "Job cancelled — tokens refunded");
      return;
    }

    const objectDescription = llmRaw;
    console.log("[aiDocumentRedraw] Illustrations found:", objectDescription.substring(0, 200));
    const baseFilename = buildFilename(userDesc || objectDescription);

    // ── Step B: Draw ONLY the extracted illustrations with gpt-image-1 ──────────
    // Determine aspect ratio string for the prompt
    const aspectDesc = originalAspect > 1.2
      ? "wider than tall (landscape orientation)"
      : originalAspect < 0.8
      ? "taller than wide (portrait orientation)"
      : "approximately square";

    const imagePrompt =
      `Professional laser engraving line art. Reproduce EXACTLY this complete composition as it appears in the original: ${objectDescription}. ` +
      "\n\nCRITICAL REQUIREMENTS:\n" +
      "1. REPRODUCE THE COMPLETE COMPOSITION FAITHFULLY — draw EVERY element described, in its exact described position. If there are 4 corner ornaments, draw all 4. If there is a surrounding border, draw the full border.\n" +
      "2. MAINTAIN EXACT ANGLES AND PROPORTIONS — reproduce each element at the same angle and size as in the original. Do NOT rotate, resize, or reposition elements.\n" +
      `3. MAINTAIN ORIGINAL ORIENTATION — the composition is ${aspectDesc}. Respect this orientation.\n` +
      "4. NO text, NO letters, NO words, NO numbers — only the graphic/decorative elements.\n" +
      "5. Pure white background (#FFFFFF). Only pure black (#000000) lines. NO grey tones, NO fills, NO gradients, NO shading.\n" +
      "6. Clean, precise, thin lines suitable for laser engraving.\n" +
      "7. The complete composition MUST fit entirely inside the frame with 12% white margin on every edge — nothing cropped.\n" +
      "8. Style: professional engraving quality line art — clean outlines with precise inner detail lines.\n" +
      "9. Maximum fidelity to the original — this will be used for laser engraving and must match the original design exactly.";

    const response = await openai.images.generate({
      model: "gpt-image-1",
      prompt: imagePrompt,
      n: 1,
      size: "1024x1024",
      quality: "high",
    });

    // Check if cancelled after image generation
    const jobAfterGen = getJob(jobId);
    if (!jobAfterGen || jobAfterGen.status === "cancelled") return;

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
    });

    updateJob(jobId, {
      status: "done",
      result: { success: true, image: result, objectDescription },
    });

  } catch (err: unknown) {
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
            message: "חשבונך חסום. לפרטים פנה לרובוטיקה וטכנולוגיה.",
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
            message: "חשבונך חסום. לפרטים פנה לרובוטיקה וטכנולוגיה.",
          });
        }
      }

      // ── Token check & deduction ───────────────────────────────────────────────
      const tokenResult = await deductTokens(appUser.userId, "ai_refine", instruction);
      if (!tokenResult.success) {
        return res.status(402).json({
          error: "INSUFFICIENT_TOKENS",
          balance: tokenResult.balance,
          message: "נגמרו לך האסימונים. ליצירת קשר ורכישת אסימונים נוספים פנה לרובוטיקה וטכנולוגיה.",
        });
      }

      // ── Download source image ─────────────────────────────────────────────────
      const imgResponse = await fetch(imageUrl);
      if (!imgResponse.ok) throw new Error("שגיאה בהורדת התמונה");
      const sourceBuffer = Buffer.from(await imgResponse.arrayBuffer());

      // ── Refine with gpt-image-1 ───────────────────────────────────────────────
      const refinePrompt =
        `Apply this correction to the line art: ${instruction.trim()}. ` +
        (origDesc ? `Original design: ${origDesc}. ` : "") +
        "Keep all other elements exactly as they are — same angles, same positions, same proportions. " +
        "Maintain the same clean black-and-white line art style. " +
        "Pure black lines on white background. No grey tones, no gradients. " +
        "The complete design must fit inside the frame with 12% margin.";

      const response = await openai.images.edit({
        model: "gpt-image-1",
        image: new File([sourceBuffer], "source.png", { type: "image/png" }),
        prompt: refinePrompt,
        n: 1,
        size: "1024x1024",
      });

      const imageData = response.data?.[0];
      if (!imageData) throw new Error("לא הצלחנו לייצר תמונה");

      let rawBuffer: Buffer;
      if (imageData.b64_json) {
        rawBuffer = Buffer.from(imageData.b64_json, "base64");
      } else if (imageData.url) {
        const dlResponse = await fetch(imageData.url);
        if (!dlResponse.ok) throw new Error("שגיאה בהורדת התמונה שנוצרה");
        rawBuffer = Buffer.from(await dlResponse.arrayBuffer());
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

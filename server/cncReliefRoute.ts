/**
 * CNC 3D Relief Route
 *
 * Converts an image or text prompt into:
 *   1. A grayscale heightmap PNG (white = raised, black = recessed) suitable for CNC relief carving
 *   2. A photorealistic simulation showing how the carving would look in the chosen material
 *
 * POST /api/cnc-relief/from-image  — upload image → analyze → generate heightmap + simulation
 * POST /api/cnc-relief/from-prompt — text prompt → generate heightmap + simulation
 * GET  /api/cnc-relief/job/:jobId  — poll job status
 * POST /api/cnc-relief/cancel/:jobId — cancel a running job
 */

import { Router } from "express";
import multer from "multer";
import sharp from "sharp";
import { storagePut } from "./storage";
import { nanoid } from "nanoid";
import { logUsageEvent, anonymizeIp } from "./usageDb";
import { getAppUserFromCookie } from "./appAuth";
import { recordUserAction } from "./userActionsDb";
import { deductTokens, getTokenCostForAction } from "./tokenService";
import { invokeLLM } from "./_core/llm";
import { createJob, getJob, updateJob, cancelJob } from "./jobStore";
import OpenAI from "openai";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 16 * 1024 * 1024 } });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY ?? "" });

export type ReliefMaterial = "wood" | "aluminum" | "mdf" | "stone" | "brass";

// ─── Prompt builders ──────────────────────────────────────────────────────────

function buildHeightmapPrompt(subject: string): string {
  return (
    "Create a professional CNC relief heightmap image for the following subject: " + subject + ". " +
    "CRITICAL RULES FOR HEIGHTMAP: " +
    "1. This is a GRAYSCALE heightmap — pure white (#FFFFFF) = highest raised point, pure black (#000000) = lowest recessed point, grey tones = intermediate heights. " +
    "2. The subject must be rendered as a smooth 3D relief with realistic depth gradients — like a bas-relief sculpture. " +
    "3. Use smooth gradient transitions between heights — no hard edges or flat areas. " +
    "4. The background should be solid black (#000000) — the subject rises from a flat base. " +
    "5. The highest points (white) should be the most prominent features: face center, raised elements, main forms. " +
    "6. Add realistic depth: edges fade to grey, background is black, main mass is light grey to white. " +
    "7. NO colors, NO textures, NO text, NO labels — pure grayscale depth map only. " +
    "8. The result should look like a professional CNC relief depth map used in Vectric Aspire or ArtCAM software. " +
    "9. Subject should fill 70-80% of the image with 10-15% black border all around. " +
    "10. Smooth, professional, production-ready heightmap."
  );
}

function buildSimulationPrompt(subject: string, material: ReliefMaterial): string {
  const materialDescriptions: Record<ReliefMaterial, string> = {
    wood: "warm walnut wood with natural grain texture, golden-brown tones, realistic wood fiber detail, professional CNC carved wood relief panel with smooth tool paths visible",
    aluminum: "brushed aluminum metal surface, silver-grey metallic sheen, machined finish, professional CNC milled aluminum relief with subtle tool marks",
    mdf: "smooth MDF board surface, light beige/cream color, fine uniform texture, CNC carved MDF relief with clean sharp edges",
    stone: "dark grey granite stone surface, natural stone texture with subtle crystalline flecks, hand-carved stone relief effect",
    brass: "polished brass metal surface, warm golden-yellow metallic sheen, CNC engraved brass relief with mirror-like finish on raised areas",
  };

  const materialDesc = materialDescriptions[material] || materialDescriptions.wood;

  return (
    "Create a photorealistic 3D visualization showing a CNC carved relief of the following subject: " + subject + ". " +
    "MATERIAL: " + materialDesc + ". " +
    "CRITICAL VISUAL REQUIREMENTS: " +
    "1. Show the relief as a physical 3D carved panel — the subject rises out of the flat background surface. " +
    "2. Realistic lighting with dramatic side-lighting to emphasize the 3D depth and shadows in the carved areas. " +
    "3. The panel should have a clean rectangular border/frame. " +
    "4. Show realistic depth shadows — recessed areas are darker, raised areas catch the light. " +
    "5. Professional studio photography style — clean background, dramatic lighting from upper-left. " +
    "6. The carving should look like it was professionally made by a CNC machine — smooth, precise, high quality. " +
    "7. NO text, NO labels, NO watermarks. Pure photorealistic product visualization only. " +
    "8. The relief panel should fill 80% of the image, centered, with slight perspective/angle to show depth."
  );
}

// ─── Background job runner ────────────────────────────────────────────────────

async function runReliefJob(
  jobId: string,
  subject: string,
  material: ReliefMaterial,
  appUserId: number,
  ipAnon: string,
  sourceImageUrl?: string,
  lang: "he" | "en" = "en"
) {
  const isHe = lang === "he";
  const jobStartTime = Date.now();
  const abortController = new AbortController();
  const JOB_TIMEOUT_MS = 5 * 60 * 1000;

  const internalTimeoutId = setTimeout(() => {
    abortController.abort();
    const job = getJob(jobId);
    if (job && job.status !== "done" && job.status !== "cancelled") {
      updateJob(jobId, {
        status: "error",
        error: isHe
          ? "העיבוד ארך יותר מ-5 דקות. נסה שוב."
          : "Processing timed out after 5 minutes. Please try again.",
      });
    }
  }, JOB_TIMEOUT_MS);

  try {
    // ── Step 1: Generate heightmap ────────────────────────────────────────────
    updateJob(jobId, {
      status: "processing",
      step: isHe ? "יוצר מפת גובה (heightmap)..." : "Generating heightmap...",
      stepEn: "Generating heightmap...",
    });

    const jobCheck = getJob(jobId);
    if (!jobCheck || jobCheck.status === "cancelled") return;

    const heightmapPrompt = buildHeightmapPrompt(subject);
    const heightmapResponse = await openai.images.generate({
      model: "gpt-image-1",
      prompt: heightmapPrompt,
      n: 1,
      size: "1024x1024",
    } as Parameters<typeof openai.images.generate>[0], { signal: abortController.signal });

    const heightmapB64 = (heightmapResponse as { data?: Array<{ b64_json?: string }> }).data?.[0]?.b64_json;
    if (!heightmapB64) throw new Error("gpt-image-1 did not return heightmap data");

    const heightmapBuffer = Buffer.from(heightmapB64, "base64");

    // Post-process heightmap: ensure it's grayscale and high contrast
    const processedHeightmap = await sharp(heightmapBuffer)
      .grayscale()
      .normalise()  // stretch histogram to full 0-255 range for maximum depth
      .png()
      .toBuffer();

    // Upload heightmap to S3
    const heightmapKey = `cnc-relief/heightmap-${nanoid()}.png`;
    const { url: heightmapUrl } = await storagePut(heightmapKey, processedHeightmap, "image/png");

    // Stream partial result
    const jobAfterHeightmap = getJob(jobId);
    if (!jobAfterHeightmap || jobAfterHeightmap.status === "cancelled") return;
    updateJob(jobId, {
      partialImages: [{ type: "heightmap", url: heightmapUrl }],
      step: isHe ? "יוצר הדמיית חריטה..." : "Generating engraving simulation...",
      stepEn: "Generating engraving simulation...",
    });

    // ── Step 2: Generate simulation ───────────────────────────────────────────
    const simulationPrompt = buildSimulationPrompt(subject, material);
    const simulationResponse = await openai.images.generate({
      model: "gpt-image-1",
      prompt: simulationPrompt,
      n: 1,
      size: "1024x1024",
    } as Parameters<typeof openai.images.generate>[0], { signal: abortController.signal });

    const simulationB64 = (simulationResponse as { data?: Array<{ b64_json?: string }> }).data?.[0]?.b64_json;
    if (!simulationB64) throw new Error("gpt-image-1 did not return simulation data");

    const simulationBuffer = Buffer.from(simulationB64, "base64");
    const simulationKey = `cnc-relief/simulation-${nanoid()}.png`;
    const { url: simulationUrl } = await storagePut(simulationKey, simulationBuffer, "image/png");

    // ── Deduct tokens after success ───────────────────────────────────────────
    await deductTokens(appUserId, "cnc_relief");
    updateJob(jobId, { tokenDeducted: true });

    // ── Log usage ─────────────────────────────────────────────────────────────
    void logUsageEvent({
      type: "ai_generate",
      segmentCount: 0,
      ipAnon: anonymizeIp(ipAnon),
      durationMs: Date.now() - jobStartTime,
      fileSizeKb: Math.round(processedHeightmap.length / 1024),
    });

    // ── Record user action ────────────────────────────────────────────────────
    await recordUserAction({
      appUserId,
      actionType: "ai_generate",
      description: subject.slice(0, 200),
      dxfUrl: heightmapUrl,
      imageUrl: simulationUrl,
      svgPreview: undefined,
      feature: "cnc_relief",
      durationMs: Date.now() - jobStartTime,
      ipAnon: ipAnon ?? undefined,
      sourceImageUrl: sourceImageUrl ?? undefined,
    });

    clearTimeout(internalTimeoutId);
    updateJob(jobId, {
      status: "done",
      result: {
        success: true,
        subject,
        material,
        heightmapUrl,
        simulationUrl,
      },
    });

  } catch (err: unknown) {
    clearTimeout(internalTimeoutId);
    console.error("[cncReliefRoute] Job error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    const currentJob = getJob(jobId);
    if (currentJob && currentJob.status !== "error") {
      updateJob(jobId, { status: "error", error: message });
    }
    void recordUserAction({
      appUserId,
      actionType: "ai_generate",
      description: "cnc_relief — failed",
      feature: "cnc_relief",
      durationMs: Date.now() - jobStartTime,
      status: "failed",
      errorMessage: message.slice(0, 500),
      sourceImageUrl: sourceImageUrl ?? undefined,
    });
    // Alert admin if billing/quota issue
    const isBillingError = message.toLowerCase().includes("quota") ||
      message.toLowerCase().includes("billing") ||
      message.toLowerCase().includes("429") ||
      message.toLowerCase().includes("402");
    if (isBillingError) {
      try {
        const { notifyOwner } = await import("./_core/notification");
        await notifyOwner({
          title: "🔴 שגיאת חיוב OpenAI — CNC Relief",
          content: `שגיאת billing ב-CNC Relief:\n${message}`,
        });
      } catch (_) { /* ignore */ }
    }
  }
}

// ─── Helper: auth + token check ───────────────────────────────────────────────

async function checkAuthAndTokens(req: import("express").Request, res: import("express").Response): Promise<{ appUser: { userId: number }; ipAnon: string } | null> {
  const appUser = getAppUserFromCookie(req.cookies);
  if (!appUser) {
    res.status(401).json({
      error: "UNAUTHORIZED",
      message: "יש להתחבר כדי להשתמש ב-CNC Relief",
      messageEn: "Please log in to use CNC Relief",
    });
    return null;
  }

  // Block check
  const { getDb } = await import("./db");
  const { appUsers } = await import("../drizzle/schema");
  const { eq } = await import("drizzle-orm");
  const db = await getDb();
  if (db) {
    const [userRow] = await db.select({ isBlocked: appUsers.isBlocked }).from(appUsers).where(eq(appUsers.id, appUser.userId)).limit(1);
    if (userRow?.isBlocked) {
      res.status(403).json({ error: "USER_BLOCKED", message: "חשבונך חסום.", messageEn: "Your account has been blocked." });
      return null;
    }
  }

  // Token check
  const tokenResult = await deductTokens(appUser.userId, "cnc_relief", { checkOnly: true });
  if (!tokenResult.success) {
    res.status(402).json({
      error: "INSUFFICIENT_TOKENS",
      balance: tokenResult.balance,
      message: "נגמרו לך האסימונים. יש לטעון אסימונים להמשך שימוש.",
      messageEn: "You have run out of tokens. Please purchase more tokens to continue.",
    });
    return null;
  }

  const rawIp = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
  return { appUser, ipAnon: anonymizeIp(rawIp) ?? "unknown" };
}

// ─── POST /api/cnc-relief/from-image ─────────────────────────────────────────

router.post(
  "/api/cnc-relief/from-image",
  upload.single("image"),
  async (req, res) => {
    try {
      const auth = await checkAuthAndTokens(req, res);
      if (!auth) return;
      const { appUser, ipAnon } = auth;

      if (!req.file) {
        return res.status(400).json({ error: "NO_IMAGE", message: "לא סופקה תמונה" });
      }

      const material = ((req.body?.material as string) || "wood") as ReliefMaterial;
      const lang = ((req.body?.lang as string) || "en") === "he" ? "he" : "en";
      const isHe = lang === "he";

      // Auto-correct EXIF orientation
      const imageBuffer = await sharp(req.file.buffer).rotate().toBuffer();

      // Upload source image for history
      let sourceImageUrl: string | undefined;
      try {
        const srcKey = `source-images/${appUser.userId}-${nanoid(8)}.jpg`;
        const jpegBuf = await sharp(imageBuffer)
          .resize(800, 800, { fit: "inside", withoutEnlargement: true })
          .jpeg({ quality: 85 })
          .toBuffer();
        const { url } = await storagePut(srcKey, jpegBuf, "image/jpeg");
        sourceImageUrl = url;
      } catch (e) {
        console.warn("[cncReliefRoute] Failed to upload source image:", e);
      }

      // Analyze image with LLM to get subject description
      const resized = await sharp(imageBuffer)
        .resize(512, 512, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer();
      const imageBase64 = resized.toString("base64");

      const analysisResponse = await invokeLLM({
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: `data:image/jpeg;base64,${imageBase64}`, detail: "high" },
              },
              {
                type: "text",
                text: "Describe the main subject of this image in 2-3 sentences for use as a CNC relief carving. " +
                  "Focus on: what the subject is, its key shapes and forms, important details to preserve in a 3D relief. " +
                  "Output ONLY the description, no preamble, no labels.",
              },
            ],
          },
        ],
      });

      const subject = (analysisResponse as { choices?: Array<{ message?: { content?: string } }> })
        ?.choices?.[0]?.message?.content?.trim() || req.body?.description || "a detailed relief carving";

      // Create job
      const jobId = nanoid(12);
      createJob(jobId, appUser.userId, "cnc_relief");

      const MAX_JOB_MS = 5 * 60 * 1000;
      Promise.race([
        runReliefJob(jobId, subject, material, appUser.userId, ipAnon, sourceImageUrl, lang),
        new Promise<void>((_, reject) => setTimeout(() => reject(new Error("Job timed out")), MAX_JOB_MS)),
      ]).catch((err) => {
        const msg = err instanceof Error ? err.message : String(err);
        const job = getJob(jobId);
        if (job && job.status !== "done" && job.status !== "cancelled") {
          updateJob(jobId, { status: "error", error: msg });
        }
      });

      return res.json({ jobId, subject });

    } catch (err: unknown) {
      console.error("[cncReliefRoute] from-image error:", err);
      const message = err instanceof Error ? err.message : "Unknown error";
      return res.status(500).json({ error: "INTERNAL_ERROR", message });
    }
  }
);

// ─── POST /api/cnc-relief/from-prompt ────────────────────────────────────────

router.post(
  "/api/cnc-relief/from-prompt",
  async (req, res) => {
    try {
      const auth = await checkAuthAndTokens(req, res);
      if (!auth) return;
      const { appUser, ipAnon } = auth;

      const prompt = (req.body?.prompt as string || "").trim();
      if (!prompt) {
        return res.status(400).json({ error: "NO_PROMPT", message: "נא להזין תיאור" });
      }
      const material = ((req.body?.material as string) || "wood") as ReliefMaterial;
      const lang = ((req.body?.lang as string) || "en") === "he" ? "he" : "en";

      const jobId = nanoid(12);
      createJob(jobId, appUser.userId, "cnc_relief");

      const MAX_JOB_MS = 5 * 60 * 1000;
      Promise.race([
        runReliefJob(jobId, prompt, material, appUser.userId, ipAnon, undefined, lang),
        new Promise<void>((_, reject) => setTimeout(() => reject(new Error("Job timed out")), MAX_JOB_MS)),
      ]).catch((err) => {
        const msg = err instanceof Error ? err.message : String(err);
        const job = getJob(jobId);
        if (job && job.status !== "done" && job.status !== "cancelled") {
          updateJob(jobId, { status: "error", error: msg });
        }
      });

      return res.json({ jobId, subject: prompt });

    } catch (err: unknown) {
      console.error("[cncReliefRoute] from-prompt error:", err);
      const message = err instanceof Error ? err.message : "Unknown error";
      return res.status(500).json({ error: "INTERNAL_ERROR", message });
    }
  }
);

// ─── GET /api/cnc-relief/job/:jobId ──────────────────────────────────────────

router.get("/api/cnc-relief/job/:jobId", (req, res) => {
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

// ─── POST /api/cnc-relief/cancel/:jobId ──────────────────────────────────────

router.post("/api/cnc-relief/cancel/:jobId", (req, res) => {
  const appUser = getAppUserFromCookie(req.cookies);
  if (!appUser) return res.status(401).json({ error: "UNAUTHORIZED" });

  const job = getJob(req.params.jobId);
  if (!job) return res.status(404).json({ error: "JOB_NOT_FOUND" });
  if (job.userId !== appUser.userId) return res.status(403).json({ error: "FORBIDDEN" });

  if (job.status === "done") {
    return res.json({ cancelled: false, reason: "Job already completed" });
  }

  cancelJob(req.params.jobId);
  return res.json({ cancelled: true });
});

export default router;

/**
 * CNC 3D Relief Route
 *
 * Converts an image or text prompt into:
 *   1. A grayscale heightmap PNG (white = raised, black = recessed) suitable for CNC relief carving
 *   2. A photorealistic simulation showing how the carving would look in the chosen material
 *
 * POST /api/cnc-relief/from-image  - upload image -> analyze -> generate heightmap + simulation
 * POST /api/cnc-relief/from-prompt - text prompt -> generate heightmap + simulation
 * GET  /api/cnc-relief/job/:jobId  - poll job status
 * POST /api/cnc-relief/cancel/:jobId - cancel a running job
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
import { generateImage } from "./_core/imageGeneration";
import { createJob, getJob, updateJob, cancelJob } from "./jobStore";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 16 * 1024 * 1024 } });

export type ReliefMaterial = "wood" | "aluminum" | "mdf" | "stone" | "brass";

// Valid output sizes (px) - min 512, max 4096
export const VALID_SIZES = [512, 768, 1024, 1536, 2048, 3000, 4096] as const;
export type ReliefSize = typeof VALID_SIZES[number];

// --- Prompt builders ----------------------------------------------------------

function buildHeightmapPrompt(subject: string, hasSourceImage = false): string {
  const imageRef = hasSourceImage
    ? (
      "TASK: Analyze the provided reference image and create a NEW professional CNC relief heightmap (displacement map) based on it. " +
      "You are NOT copying the image - you are INTERPRETING it as a 3D sculptural relief. " +
      "IDENTIFY the main subject/object in the image. Completely separate it from the background. " +
      "MODEL the subject as a 3D dome/hill: the highest point (center or front face) = pure white (#FFFFFF), " +
      "edges and sides of the subject fade smoothly through mid-grey to dark grey, " +
      "background = pure black (#000000). " +
      "For SMALL DETAILS (petals, feathers, fur, scales, rope/knot strands, text): " +
      "each small element must have its own mini-dome - bright white highlight at its peak, " +
      "smooth grey gradient down its sides, dark grey/black in the recesses between elements. " +
      "This creates the rope/knot effect seen in Celtic relief carvings. " +
      "Preserve ALL shapes, outlines, and fine details from the reference image. "
    )
    : ("Subject: " + subject + ". ");

  return (
    "Create a PROFESSIONAL CNC relief heightmap (depth map / displacement map) image. " +
    imageRef +
    "LOOK AT THESE REFERENCE EXAMPLES in your mind: " +
    "EXAMPLE A - A heart shape: pure white glowing center, smooth radial gradient fading to grey at edges, pure black background. " +
    "EXAMPLE B - A Celtic knot: each rope strand has a bright white ridge along its top, smooth grey sides, deep black recesses between crossing strands. " +
    "EXAMPLE C - A flower: each petal is a raised dome (white center, grey edges), stamens are bright white dots, stem is a raised ridge, pure black background. " +
    "YOUR OUTPUT MUST LOOK LIKE THESE EXAMPLES. " +
    "ABSOLUTE RULES: " +
    "RULE 1 - PURE GRAYSCALE ONLY: Zero color, zero saturation. Only shades from pure black (#000000) to pure white (#FFFFFF). " +
    "RULE 2 - WHITE = RAISED, BLACK = RECESSED: white = highest point, black = deepest background, grey = intermediate depth. " +
    "RULE 3 - SMOOTH GRADIENTS EVERYWHERE: Every raised element MUST transition smoothly from bright white peak -> light grey -> mid grey -> dark grey -> black background. Use MANY intermediate grey tones (at least 5-7 distinct grey levels between white and black). Think of it like a smooth 3D render with soft shadows - NO sudden jumps from white to dark grey. Smooth like a Pixar 3D render. " +
    "RULE 3b - NO HARD EDGES BETWEEN GREY LEVELS: The transition from the bright mane/fur/hair to the body must be a GRADUAL gradient over many pixels, not a sharp line. Imagine the light slowly fading as you move away from the peak. " +
    "RULE 4 - SOLID BLACK BACKGROUND: Background = pure black (#000000). No grey in background. " +
    "RULE 5 - SMALL DETAILS HAVE DEPTH: Even tiny details (petals, fur, feathers, rope strands) must have their own raised dome shape with highlight and shadow. " +
    "RULE 6 - BALANCED CONTRAST: Strong contrast between raised elements and background, BUT the raised elements themselves must have smooth internal gradients - not flat white. The mane should be bright white at the tips, fading through many grey tones to the body level. " +
    "RULE 7 - PROFESSIONAL QUALITY: Output must look like a Vectric Aspire / ArtCAM displacement map - suitable for direct CNC machining. " +
    "RULE 8 - COMPOSITION: Subject fills 70-80% of frame with 10-15% pure black border all around. " +
    "RULE 9 - 3D DEPTH ILLUSION: Viewer must immediately understand which parts are raised and which are recessed just by looking at the grey values. " +
    "RULE 10 - CNC MACHINABILITY: Avoid ultra-thin features (hair strands, individual fur hairs, thin wire-like lines) that would be impossible to machine. " +
    "Instead, SIMPLIFY fine details into GROUPS: a mane/fur area becomes a single raised dome region with smooth texture, not hundreds of individual strands. " +
    "Minimum feature width in the heightmap should be at least 3-4% of the total image width. " +
    "This prevents cutter breakage and ensures clean CNC toolpaths."
  );
}

function buildSimulationPrompt(subject: string, material: ReliefMaterial): string {
  const materialDescriptions: Record<ReliefMaterial, string> = {
    wood: "warm walnut wood with natural grain texture, golden-brown tones, realistic wood fiber detail, professional CNC carved wood relief panel",
    aluminum: "brushed aluminum metal surface, silver-grey metallic sheen, machined finish, professional CNC milled aluminum relief with subtle tool marks",
    mdf: "smooth MDF board surface, light beige/cream color, fine uniform texture, CNC carved MDF relief with clean sharp edges",
    stone: "dark grey granite stone surface, natural stone texture with subtle crystalline flecks, hand-carved stone relief effect",
    brass: "polished brass metal surface, warm golden-yellow metallic sheen, CNC engraved brass relief with mirror-like finish on raised areas",
  };

  const materialDesc = materialDescriptions[material] || materialDescriptions.wood;

  return (
    "Create a photorealistic 3D visualization of a CNC carved relief panel. " +
    "The carving subject is EXACTLY: " + subject + ". " +
    "CRITICAL: The shape, composition, and all details of the carving MUST match the provided heightmap image EXACTLY - same subject, same pose, same proportions. " +
    "MATERIAL: " + materialDesc + ". " +
    "VISUAL REQUIREMENTS: " +
    "1. The relief panel is a flat square/rectangular piece of " + material + " material. " +
    "2. The carved subject rises from the flat surface - same shape as the heightmap. " +
    "3. Dramatic side-lighting from upper-left to emphasize 3D depth and cast realistic shadows. " +
    "4. Recessed areas are darker, raised areas catch the light - matching the heightmap depth. " +
    "5. Close-up macro photography style - fill the frame with the panel, slight angle to show depth. " +
    "6. Realistic CNC tool marks on the carved surface - smooth, precise, high quality. " +
    "7. NO text, NO labels, NO watermarks. Pure photorealistic product visualization only. " +
    "8. The carved shape MUST be identical to the heightmap - do not change or simplify the subject."
  );
}

// --- Background job runner ----------------------------------------------------

async function runReliefJob(
  jobId: string,
  subject: string,
  material: ReliefMaterial,
  appUserId: number,
  ipAnon: string,
  outputSize: ReliefSize,
  sourceImageUrl?: string,
  lang: "he" | "en" = "en",
  depthMm: number = 5
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
          ? "------ --- ---- --5 ----. --- ---."
          : "Processing timed out after 5 minutes. Please try again.",
      });
    }
  }, JOB_TIMEOUT_MS);

  try {
    // -- Step 1: Generate heightmap --------------------------------------------
    updateJob(jobId, {
      status: "processing",
      step: isHe ? "---- --- ---- (heightmap)..." : "Generating heightmap...",
      stepEn: "Generating heightmap...",
    });

    const jobCheck = getJob(jobId);
    if (!jobCheck || jobCheck.status === "cancelled") return;

    const heightmapPrompt = buildHeightmapPrompt(subject, !!sourceImageUrl);
    const heightmapResult = await generateImage({
      prompt: heightmapPrompt,
      ...(sourceImageUrl ? { originalImages: [{ url: sourceImageUrl, mimeType: "image/png" }] } : {}),
    });
    if (!heightmapResult.url) throw new Error("Forge ImageService did not return heightmap URL");

    // Download the image, post-process to grayscale + normalise + resize, re-upload
    const heightmapRaw = await fetch(heightmapResult.url).then(r => r.arrayBuffer());
    // Advanced post-processing for CNC heightmap quality:
    // Goal: preserve smooth gradients (like the heart/Celtic knot examples) while
    //       ensuring strong contrast between raised elements and black background.
    // Strategy:
    //   1. Grayscale - remove any color the AI may have added
    //   2. Normalise - stretch histogram to full 0-255 range
    //   3. Gamma - brighten midtones to enhance dome-shaped gradients
    //      (gamma 1.0-3.0 only; use 1.2-1.6 range to lift midtones without blowing highlights)
    //   4. Mild sharpen - enhance small detail edges without destroying smooth gradients
    //   5. Resize with black background
    // depthMm controls gamma strength: deeper carving = stronger midtone lift
    // Post-processing pipeline (based on CNC heightmap best practices research):
    // 1. Grayscale - remove any color the AI may have added
    // 2. Normalise ONCE - stretch histogram to full 0-255 range (only once to preserve gradients)
    // 3. Gamma - lift midtones for dome-shaped gradients (deeper carving = stronger lift)
    // 4. Gaussian blur (sigma=0.6) - eliminate banding/pixel artifacts, smooth gradients
    //    (ReliefMaker research: AI heightmaps have inconsistent gamma; blur helps smooth transitions)
    // 5. Mild sharpen - recover small detail edges lost by blur, without destroying smooth gradients
    // 6. Resize with black background
    // NOTE: No double normalise - it destroys the smooth gradients we want
    const gammaValue = depthMm <= 3 ? 1.2 : depthMm <= 5 ? 1.4 : 1.6;
    // Enhanced post-processing pipeline for CNC heightmap quality:
    // 1. Grayscale - remove any color the AI may have added
    // 2. Normalise ONCE - stretch histogram to full 0-255 range
    // 3. Gamma - lift midtones for dome-shaped gradients
    // 4. Gaussian blur (sigma=1.2) - smooth transitions between depth levels,
    //    eliminate sharp edges between grey zones (key for horse mane/fur type images)
    //    Increased from 0.6 to 1.2 based on CNC research: smoother gradients = better toolpaths
    // 5. Mild sharpen - recover main contour edges lost by blur, without restoring fine details
    // 6. Resize with black background
    const processedHeightmap = await sharp(Buffer.from(heightmapRaw))
      .grayscale()           // force pure grayscale
      .normalise()           // full 0-255 range (ONCE only - double normalise destroys gradients)
      .gamma(gammaValue)     // lift midtones: dome gradients become more pronounced
      .blur(1.2)             // Gaussian blur (increased): smooth depth transitions, reduce sharp edges
      .sharpen({ sigma: 0.8, m1: 0.3, m2: 2.0 }) // sharpen: recover main contour edges
      .resize(outputSize, outputSize, { fit: "contain", background: { r: 0, g: 0, b: 0 } })
      .png()
      .toBuffer();

    // Upload processed heightmap to S3 (PNG)
    const heightmapKey = `cnc-relief/heightmap-${nanoid()}.png`;
    const { url: heightmapUrl } = await storagePut(heightmapKey, processedHeightmap, "image/png");

    // Generate TIFF 16-bit version for professional CNC software (Vectric, ArtCAM, Fusion 360)
    // 16-bit depth = 65535 levels (vs 255 for 8-bit PNG) - critical for smooth CNC toolpaths
    // depthMm controls the gamma curve: deeper carving = more contrast in the heightmap
    let heightmapTiffUrl: string | undefined;
    try {
      // TIFF 16-bit: start from the already-processed PNG heightmap for consistency
      // Apply additional depth-specific gamma for the TIFF version
      // 16-bit TIFF: critical for smooth CNC toolpaths (65535 levels vs 255 for 8-bit)
      // Research: 16-bit prevents visible banding in smooth gradients (e.g. face cheeks, dome shapes)
      // Use the already-processed PNG as source for consistency
      const tiffBuffer = await sharp(processedHeightmap)
        .grayscale()
        .tiff({ compression: "lzw" })  // LZW TIFF (sharp auto-detects 16-bit from grayscale pipeline)
        .toBuffer();
      const tiffKey = `cnc-relief/heightmap-${nanoid()}.tiff`;
      const { url: tiffUrl } = await storagePut(tiffKey, tiffBuffer, "image/tiff");
      heightmapTiffUrl = tiffUrl;
    } catch (tiffErr) {
      console.warn("[cncReliefRoute] TIFF 16-bit generation failed (non-fatal):", tiffErr);
    }

    // Stream partial result
    const jobAfterHeightmap = getJob(jobId);
    if (!jobAfterHeightmap || jobAfterHeightmap.status === "cancelled") return;
    updateJob(jobId, {
      partialImages: [{ type: "heightmap", url: heightmapUrl }],
      step: isHe ? "---- ------ -----..." : "Generating engraving simulation...",
      stepEn: "Generating engraving simulation...",
    });

    // -- Step 2: Generate simulation - based on the heightmap image ------------
    // Pass the heightmap as reference so the simulation matches exactly
    const simulationPrompt = buildSimulationPrompt(subject, material);
    const simulationResult = await generateImage({
      prompt: simulationPrompt,
      // Use the processed heightmap as reference so the simulation matches the carving shape
      originalImages: [{ url: heightmapUrl, mimeType: "image/png" }],
    });
    if (!simulationResult.url) throw new Error("Forge ImageService did not return simulation URL");

    // Resize simulation to match output size
    const simRaw = await fetch(simulationResult.url).then(r => r.arrayBuffer());
    const processedSim = await sharp(Buffer.from(simRaw))
      .resize(outputSize, outputSize, { fit: "cover" })
      .png()
      .toBuffer();
    const simKey = `cnc-relief/simulation-${nanoid()}.png`;
    const { url: simulationUrl } = await storagePut(simKey, processedSim, "image/png");

    // -- Deduct tokens after success (skip for test mode user) ------------------
    if (appUserId !== 999999) {
      await deductTokens(appUserId, "cnc_relief");
      updateJob(jobId, { tokenDeducted: true });

      // -- Log usage -----------------------------------------------------------
      void logUsageEvent({
        type: "ai_generate",
        segmentCount: 0,
        ipAnon: anonymizeIp(ipAnon),
        durationMs: Date.now() - jobStartTime,
        fileSizeKb: Math.round(processedHeightmap.length / 1024),
      });

      // -- Record user action --------------------------------------------------
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
    }

    clearTimeout(internalTimeoutId);
    updateJob(jobId, {
      status: "done",
      result: {
        success: true,
        subject,
        material,
        heightmapUrl,
        heightmapTiffUrl,
        simulationUrl,
        outputSize,
        depthMm,
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
      description: "cnc_relief - failed",
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
          title: "- ----- Forge API - CNC Relief",
          content: `----- billing --CNC Relief (Forge):\n${message}`,
        });
      } catch (_) { /* ignore */ }
    }
  }
}

// --- Helper: auth + token check -----------------------------------------------

const TEST_MODE_USER_ID = 999999; // virtual test user - no DB row needed

async function checkAuthAndTokens(req: import("express").Request, res: import("express").Response): Promise<{ appUser: { userId: number }; ipAnon: string } | null> {
  // Allow unauthenticated access from /relief-test page (test mode)
  const isTestMode = req.headers["x-relief-test-mode"] === "1";
  if (isTestMode) {
    const rawIp = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
    return { appUser: { userId: TEST_MODE_USER_ID }, ipAnon: anonymizeIp(rawIp) ?? "unknown" };
  }

  const appUser = getAppUserFromCookie(req.cookies);
  if (!appUser) {
    res.status(401).json({
      error: "UNAUTHORIZED",
      message: "-- ------ --- ------ --CNC Relief",
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
      res.status(403).json({ error: "USER_BLOCKED", message: "------ ----.", messageEn: "Your account has been blocked." });
      return null;
    }
  }

  // Token check
  const tokenResult = await deductTokens(appUser.userId, "cnc_relief", { checkOnly: true });
  if (!tokenResult.success) {
    res.status(402).json({
      error: "INSUFFICIENT_TOKENS",
      balance: tokenResult.balance,
      message: "----- -- ---------. -- ----- -------- ----- -----.",
      messageEn: "You have run out of tokens. Please purchase more tokens to continue.",
    });
    return null;
  }

  const rawIp = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
  return { appUser, ipAnon: anonymizeIp(rawIp) ?? "unknown" };
}

// --- Helper: parse and validate output size -----------------------------------

function parseOutputSize(raw: unknown): ReliefSize {
  const n = Number(raw);
  if (VALID_SIZES.includes(n as ReliefSize)) return n as ReliefSize;
  return 1024; // default
}

// --- POST /api/cnc-relief/from-image -----------------------------------------

router.post(
  "/api/cnc-relief/from-image",
  upload.single("image"),
  async (req, res) => {
    try {
      const auth = await checkAuthAndTokens(req, res);
      if (!auth) return;
      const { appUser, ipAnon } = auth;

      if (!req.file) {
        return res.status(400).json({ error: "NO_IMAGE", message: "-- ----- -----" });
      }

      const material = ((req.body?.material as string) || "wood") as ReliefMaterial;
      const lang = ((req.body?.lang as string) || "en") === "he" ? "he" : "en";
      const outputSize = parseOutputSize(req.body?.outputSize);
      const depthMm = Math.min(20, Math.max(1, Number(req.body?.depthMm) || 5));
      const isHe = lang === "he";

      // Auto-correct EXIF orientation
      const imageBuffer = await sharp(req.file.buffer).rotate().toBuffer();

      // Upload source image - preprocessed for optimal AI heightmap generation
      let sourceImageUrl: string | undefined;
      try {
        const srcKey = `source-images/${appUser.userId}-${nanoid(8)}.png`;
        // Pre-process source image for better AI heightmap generation:
        // 1. Detect dark background (like white-on-black horse renders) and invert if needed
        // 2. Apply mild blur to reduce overly fine details (thin hair/fur) that cause CNC issues
        // 3. Boost contrast so the AI sees clear depth differences
        const rawBuf = await sharp(imageBuffer)
          .resize(2048, 2048, { fit: "inside", withoutEnlargement: true })
          .png()
          .toBuffer();
        // Detect dark background: compute average brightness of border pixels
        const { data: statsData, info: statsInfo } = await sharp(rawBuf)
          .grayscale()
          .raw()
          .toBuffer({ resolveWithObject: true });
        const w = statsInfo.width, h = statsInfo.height;
        let borderSum = 0, borderCount = 0;
        for (let x = 0; x < w; x++) {
          borderSum += statsData[x]; // top row
          borderSum += statsData[(h - 1) * w + x]; // bottom row
          borderCount += 2;
        }
        for (let y = 1; y < h - 1; y++) {
          borderSum += statsData[y * w]; // left col
          borderSum += statsData[y * w + (w - 1)]; // right col
          borderCount += 2;
        }
        const avgBorderBrightness = borderSum / borderCount;
        const isDarkBg = avgBorderBrightness < 60; // dark background detected
        // Build preprocessing pipeline
        let pipeline = sharp(rawBuf);
        if (isDarkBg) {
          // Invert: white-on-black becomes black-on-white for better AI interpretation
          pipeline = pipeline.negate();
          console.log("[cncReliefRoute] Dark background detected - inverting source image for AI");
        }
        // Apply mild blur to reduce overly fine details (thin hair/fur strands)
        // that cause CNC issues (too-thin features break cutters)
        // sigma=1.2: smooths sub-2px details while preserving main shapes
        const fullBuf = await pipeline
          .blur(1.2)
          .normalise()
          .png()
          .toBuffer();
        const { url } = await storagePut(srcKey, fullBuf, "image/png");
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
        runReliefJob(jobId, subject, material, appUser.userId, ipAnon, outputSize, sourceImageUrl, lang, depthMm),
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

// --- POST /api/cnc-relief/from-prompt ----------------------------------------

router.post(
  "/api/cnc-relief/from-prompt",
  async (req, res) => {
    try {
      const auth = await checkAuthAndTokens(req, res);
      if (!auth) return;
      const { appUser, ipAnon } = auth;

      const prompt = (req.body?.prompt as string || "").trim();
      if (!prompt) {
        return res.status(400).json({ error: "NO_PROMPT", message: "-- ----- -----" });
      }
      const material = ((req.body?.material as string) || "wood") as ReliefMaterial;
      const lang = ((req.body?.lang as string) || "en") === "he" ? "he" : "en";
      const outputSize = parseOutputSize(req.body?.outputSize);
      const depthMm = Math.min(20, Math.max(1, Number(req.body?.depthMm) || 5));

      const jobId = nanoid(12);
      createJob(jobId, appUser.userId, "cnc_relief");

      const MAX_JOB_MS = 5 * 60 * 1000;
      Promise.race([
        runReliefJob(jobId, prompt, material, appUser.userId, ipAnon, outputSize, undefined, lang, depthMm),
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
)// --- GET /api/cnc-relief/job/:jobId ----------------------------------------------

router.get("/api/cnc-relief/job/:jobId", (req, res) => {
  const isTestMode = req.headers["x-relief-test-mode"] === "1";
  const appUser = isTestMode ? { userId: TEST_MODE_USER_ID } : getAppUserFromCookie(req.cookies);
  if (!appUser) return res.status(401).json({ error: "UNAUTHORIZED" });

  const job = getJob(req.params.jobId);
  if (!job) return res.status(404).json({ error: "JOB_NOT_FOUND" });
  // In test mode, allow access to any job; otherwise enforce ownership
  if (!isTestMode && job.userId !== appUser.userId) return res.status(403).json({ error: "FORBIDDEN" });
  if (job.status === "done") {
    return res.json({ status: "done", result: job.result });
  } else if (job.status === "error") {
    const rawError = job.error ?? "";
    const isContentPolicy = rawError.toLowerCase().includes("safety") || rawError.toLowerCase().includes("content_policy") ||
      rawError.toLowerCase().includes("content policy") || rawError.toLowerCase().includes("rejected") ||
      rawError.toLowerCase().includes("moderation") || rawError.toLowerCase().includes("inappropriate") ||
      rawError.toLowerCase().includes("violat");
    const friendlyMessage = isContentPolicy
      ? "----- ----- -- --- ---- ----- -- AI. --- ----- --- - ----- ----- ------, ------ ------ ------- ------, -- ---- -- ----."
      : rawError;
    return res.json({ status: "error", error: job.error, message: friendlyMessage });
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

// --- POST /api/cnc-relief/cancel/:jobId --------------------------------------

router.post("/api/cnc-relief/cancel/:jobId", (req, res) => {
  const isTestMode = req.headers["x-relief-test-mode"] === "1";
  const appUser = isTestMode ? { userId: TEST_MODE_USER_ID } : getAppUserFromCookie(req.cookies);
  if (!appUser) return res.status(401).json({ error: "UNAUTHORIZED" });

  const job = getJob(req.params.jobId);
  if (!job) return res.status(404).json({ error: "JOB_NOT_FOUND" });
  if (!isTestMode && job.userId !== appUser.userId) return res.status(403).json({ error: "FORBIDDEN" });

  if (job.status === "done") {
    return res.json({ cancelled: false, reason: "Job already completed" });
  }

  cancelJob(req.params.jobId);
  return res.json({ cancelled: true });
});

export default router;

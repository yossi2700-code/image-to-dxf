import express from "express";
import multer from "multer";
import sharp from "sharp";
import { storagePut } from "./storage";
import { generateImage } from "./_core/imageGeneration";
import { getAppUserFromRequest } from "./appAuth";
import { deductTokens } from "./tokenService";
import { recordUserAction } from "./userActionsDb";
import { processForGraniteEngraving } from "./engravingProcessor";

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
});

/**
 * POST /api/needle-engraving/process
 * Accepts: multipart/form-data with fields:
 *   - image: file (JPG/PNG)
 *   - widthCm: string (optional)
 *   - heightCm: string (optional)
 *   - dpi: string (optional, default 180)
 *   - isPortrait: "true" | "false" (optional)
 */
router.post("/process", upload.single("image"), async (req, res) => {
  const id = `engraving-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No image uploaded" });
    }

    // Auth + token check
    const appUser = await getAppUserFromRequest(req, res);
    if (!appUser) {
      return res.status(401).json({ error: "UNAUTHORIZED" });
    }
    const tokenCheck = await deductTokens(appUser.userId, "needle_engraving" as any, { checkOnly: true });
    if (!tokenCheck.success) {
      return res.status(402).json({ error: "INSUFFICIENT_TOKENS", balance: tokenCheck.balance });
    }

    const { widthCm, heightCm, dpi = "180", isPortrait = "false" } = req.body as {
      widthCm?: string;
      heightCm?: string;
      dpi?: string;
      isPortrait?: string;
    };

    let processBuffer = req.file.buffer;

    // Step 1: If color image → convert to grayscale via AI
    const isColor = await checkIfColorImage(req.file.buffer);
    if (isColor) {
      const promptText =
        isPortrait === "true"
          ? "Transform this portrait photo into a professional grayscale portrait optimized for diamond needle engraving on black granite. Pure grayscale only, no color. High contrast, sharp details, smooth gradients. Background must be pure black (0,0,0). Output: grayscale PNG."
          : "Convert this image into a professional grayscale image optimized for diamond needle engraving on black granite. Pure grayscale only, no color. High contrast, sharp details, smooth gradients. Background must be pure black (0,0,0). Output: grayscale PNG.";

      // Upload original to S3 for AI processing
      const originalKey = `engraving-temp/${id}-original.png`;
      const { url: originalUrl } = await storagePut(originalKey, req.file.buffer, "image/png");

      const { url: aiGrayscaleUrl } = await generateImage({
        prompt: promptText,
        originalImages: [{ url: originalUrl, mimeType: "image/png" }],
      });

      if (!aiGrayscaleUrl) throw new Error("AI grayscale conversion failed");
      const aiResponse = await fetch(aiGrayscaleUrl);
      processBuffer = Buffer.from(await aiResponse.arrayBuffer());
    }

    // Step 2: Process for granite engraving using Node.js/sharp (no Python needed)
    const result = await processForGraniteEngraving(processBuffer, {
      widthCm: widthCm ? parseFloat(widthCm) : undefined,
      heightCm: heightCm ? parseFloat(heightCm) : undefined,
      dpi: parseInt(dpi, 10) || 180,
      isPortrait: isPortrait === "true",
    });

    // Step 3: Upload BMP to S3
    const bmpKey = `engraving-output/${id}.bmp`;
    const { url: bmpUrl } = await storagePut(bmpKey, result.bmpBuffer, "image/bmp");

    // Step 4: Create PNG preview for browser display
    const previewBuffer = await sharp(processBuffer).grayscale().png().toBuffer();
    const previewKey = `engraving-preview/${id}.png`;
    const { url: previewUrl } = await storagePut(previewKey, previewBuffer, "image/png");

    // Deduct tokens after success
    await deductTokens(appUser.userId, "needle_engraving" as any);
    await recordUserAction({
      appUserId: appUser.userId,
      actionType: "convert",
      description: `needle_engraving w=${widthCm}cm h=${heightCm}cm dpi=${dpi}`,
    });

    return res.json({
      success: true,
      bmpUrl,
      previewUrl,
      width: result.width,
      height: result.height,
      bitDepth: result.bitDepth,
      fileSizeKB: result.fileSizeKB,
      wasColorConverted: isColor,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[needle-engraving] Error:", message);
    return res.status(500).json({ error: message });
  }
});

/**
 * POST /api/needle-engraving/generate-and-process
 * AI text-to-image mode: generate image from prompt, then process for engraving
 * Body: JSON { prompt, widthCm?, heightCm?, dpi?, isPortrait? }
 */
router.post("/generate-and-process", express.json(), async (req, res) => {
  const id = `engraving-gen-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  try {
    const appUser = await getAppUserFromRequest(req, res);
    if (!appUser) {
      return res.status(401).json({ error: "UNAUTHORIZED" });
    }
    const tokenCheck = await deductTokens(appUser.userId, "needle_engraving" as any, { checkOnly: true });
    if (!tokenCheck.success) {
      return res.status(402).json({ error: "INSUFFICIENT_TOKENS", balance: tokenCheck.balance });
    }

    const { prompt, widthCm, heightCm, dpi = "180", isPortrait = "false" } = req.body as {
      prompt: string;
      widthCm?: string;
      heightCm?: string;
      dpi?: string;
      isPortrait?: string;
    };

    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    // Step 1: Generate image with AI (grayscale, optimized for engraving)
    const engravingPrompt = isPortrait === "true"
      ? `Professional portrait: ${prompt}. Grayscale only, no color. High contrast, sharp facial details, smooth gradients. Black background. Optimized for diamond needle engraving on black granite.`
      : `${prompt}. Grayscale only, no color. High contrast, sharp details, clean composition. Black background. Optimized for diamond needle engraving on black granite.`;

    const { url: generatedUrl } = await generateImage({ prompt: engravingPrompt });
    if (!generatedUrl) throw new Error("AI image generation failed");

    // Step 2: Download generated image
    const genResponse = await fetch(generatedUrl);
    const genBuffer = Buffer.from(await genResponse.arrayBuffer());

    // Step 3: Upload generated image preview to S3 (before processing)
    const genPreviewKey = `engraving-gen-preview/${id}-generated.png`;
    const { url: generatedPreviewUrl } = await storagePut(genPreviewKey, genBuffer, "image/png");

    // Step 4: Process for granite engraving using Node.js/sharp (no Python needed)
    const result = await processForGraniteEngraving(genBuffer, {
      widthCm: widthCm ? parseFloat(widthCm) : undefined,
      heightCm: heightCm ? parseFloat(heightCm) : undefined,
      dpi: parseInt(dpi, 10) || 180,
      isPortrait: isPortrait === "true",
    });

    // Step 5: Upload BMP to S3
    const bmpKey = `engraving-output/${id}.bmp`;
    const { url: bmpUrl } = await storagePut(bmpKey, result.bmpBuffer, "image/bmp");

    // Deduct tokens after success
    await deductTokens(appUser.userId, "needle_engraving" as any);
    await recordUserAction({
      appUserId: appUser.userId,
      actionType: "convert",
      description: `needle_engraving_ai prompt="${prompt.slice(0, 60)}" dpi=${dpi}`,
    });

    return res.json({
      success: true,
      bmpUrl,
      previewUrl: generatedPreviewUrl,
      width: result.width,
      height: result.height,
      bitDepth: result.bitDepth,
      fileSizeKB: result.fileSizeKB,
      wasColorConverted: false,
      generatedImageUrl: generatedPreviewUrl,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[needle-engraving/generate] Error:", message);
    return res.status(500).json({ error: message });
  }
});

/**
 * Check if an image buffer has meaningful color (not grayscale).
 * Uses sharp — pure Node.js, no Python required.
 */
async function checkIfColorImage(buffer: Buffer): Promise<boolean> {
  try {
    const { channels } = await sharp(buffer).stats();
    if (!channels || channels.length < 3) return false;
    // Compare mean values of R, G, B channels
    const [r, g, b] = channels;
    const diffRG = Math.abs(r.mean - g.mean);
    const diffRB = Math.abs(r.mean - b.mean);
    const diffGB = Math.abs(g.mean - b.mean);
    return Math.max(diffRG, diffRB, diffGB) > 10;
  } catch {
    return false;
  }
}

export default router;

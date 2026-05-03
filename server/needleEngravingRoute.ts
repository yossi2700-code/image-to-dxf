import express from "express";
import multer from "multer";
import sharp from "sharp";
import heicConvert from "heic-convert";
import OpenAI from "openai";
import { storagePut } from "./storage";
import { generateImage } from "./_core/imageGeneration";
import { getAppUserFromRequest } from "./appAuth";
import { deductTokens } from "./tokenService";
import { recordUserAction } from "./userActionsDb";
import { processForGraniteEngraving } from "./engravingProcessor";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY ?? "" });

// Portrait prompt — explains the physics of black granite engraving
const PORTRAIT_ENGRAVING_PROMPT = `Convert this portrait to a FINE ART GRAYSCALE ENGRAVING IMAGE for diamond needle engraving on black granite.

PHYSICS: The granite is BLACK. The needle creates WHITE dots — more dots = lighter. Think: white chalk on black paper.

ARTISTIC STYLE REQUIREMENTS (CRITICAL):
- Produce a SMOOTH, PAINTERLY grayscale image — like a master mezzotint or photogravure engraving
- Rich, continuous tonal gradients — NO harsh edges, NO pixelation, NO noise
- Skin: luminous, smooth gradients from bright highlights (220-255) to mid-tones (120-180) — like fine art photography
- Hair: flowing, silky gradients (60-160) with bright specular highlights
- Eyes: deep, realistic — iris in gray tones (80-150), bright catchlights (200-255)
- Shadows: soft, gradual — never pure black except the empty background
- Beard/stubble: soft feathered gray (50-120), smooth texture
- Dark clothing: visible medium gray (70-130) — NEVER leave it black
- Background: pure black (0,0,0) ONLY — clean, no texture

QUALITY: Photorealistic fine art portrait. Maximum tonal range. Silky smooth gradients. Preserve EXACT facial likeness.
Output: pure grayscale, 256 levels, black background, no color, no text, no borders.`;

const GENERAL_ENGRAVING_PROMPT = `Convert this image to a FINE ART GRAYSCALE ENGRAVING IMAGE for diamond needle engraving on black granite.

PHYSICS: The granite is BLACK. The needle creates WHITE dots — more dots = lighter. Think: white chalk on black paper.

ARTISTIC STYLE REQUIREMENTS (CRITICAL):
- Produce a SMOOTH, RICH grayscale image — like a master mezzotint, photogravure, or fine art engraving print
- Continuous, painterly tonal gradients — NO harsh edges, NO noise, NO pixelation
- Bright highlights: 200-255 (metal reflections, light sources, bright surfaces)
- Mid-tones: 80-180 (main subjects, textures, details)
- Dark areas: 30-80 (shadows, depth) — NEVER pure black except the empty background
- Background: pure black (0,0,0) ONLY — completely clean
- Dark objects (black car, dark clothing, dark fur): render as visible medium gray (60-130)
- All subjects must have rich tonal variation — avoid flat gray areas
- Preserve all fine details: textures, edges, reflections

QUALITY: Fine art print quality. Maximum tonal range. Silky smooth gradients. High detail preservation.
Output: pure grayscale, 256 levels, black background, no color, no text, no borders.`;

/**
 * Use OpenAI gpt-image-1 images.edit to convert image to engraving-ready grayscale.
 * This is the same approach as the Python reference implementation.
 */
async function convertToEngravingGrayscaleWithOpenAI(
  imageBuffer: Buffer,
  isPortrait: boolean
): Promise<Buffer> {
  const prompt = isPortrait ? PORTRAIT_ENGRAVING_PROMPT : GENERAL_ENGRAVING_PROMPT;
  const imageFile = new File([new Uint8Array(imageBuffer)], "source.png", { type: "image/png" });
  const response = await openai.images.edit({
    model: "gpt-image-1",
    image: imageFile,
    prompt,
    n: 1,
    size: "1024x1024",
    quality: "high",
  });
  const imageData = response.data?.[0];
  if (!imageData) throw new Error("AI did not return an image");
  let rawBuffer: Buffer;
  if (imageData.b64_json) {
    rawBuffer = Buffer.from(imageData.b64_json, "base64");
  } else if (imageData.url) {
    const dlResponse = await fetch(imageData.url);
    if (!dlResponse.ok) throw new Error(`Failed to fetch AI result: ${dlResponse.status}`);
    rawBuffer = Buffer.from(await dlResponse.arrayBuffer() as ArrayBuffer);
  } else {
    throw new Error("AI returned no image data");
  }
  // Convert to PNG for downstream processing
  return await sharp(rawBuffer).rotate().png().toBuffer();
}

/**
 * Normalize any image buffer to a format sharp can process.
 * Handles HEIC/HEIF (iPhone), AVIF, and unusual JPEG variants.
 * Always returns a JPEG or PNG buffer that sharp can read.
 */
async function normalizeImageBuffer(input: Buffer): Promise<Buffer> {
  // Detect HEIC/HEIF by magic bytes: starts with ftyp box containing 'heic', 'heis', 'hevc', 'mif1', 'msf1', 'avif'
  const isHeic = (
    (input[4] === 0x66 && input[5] === 0x74 && input[6] === 0x79 && input[7] === 0x70) && // 'ftyp' at offset 4
    (
      (input[8] === 0x68 && input[9] === 0x65) || // 'he...' (heic, heis, hevc)
      (input[8] === 0x6d && input[9] === 0x69) || // 'mi...' (mif1)
      (input[8] === 0x6d && input[9] === 0x73) || // 'ms...' (msf1)
      (input[8] === 0x61 && input[9] === 0x76)    // 'av...' (avif)
    )
  );
  if (isHeic) {
    console.log('[needle-engraving] HEIC/HEIF detected, converting to JPEG...');
    const jpegBuffer = await heicConvert({ buffer: input.buffer as ArrayBuffer, format: 'JPEG', quality: 0.95 });
    return Buffer.from(jpegBuffer);
  }
  // Always convert to PNG — ensures sharp can read it in all downstream steps
  try {
    return await sharp(input).rotate().png().toBuffer();
  } catch {
    // Fallback: force PNG conversion ignoring errors
    try {
      return await sharp(input, { failOn: 'none' }).rotate().png().toBuffer();
    } catch {
      return await sharp(input, { failOn: 'none' }).png().toBuffer();
    }
  }
}

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
});

// Diagnostic endpoint to check sharp capabilities in production
router.get("/diag", async (_req, res) => {
  try {
    const versions = (sharp as any).versions || {};
    // Test: create a small PNG, convert to grayscale, convert to BMP-like raw
    const testPng = await sharp({ create: { width: 10, height: 10, channels: 3, background: { r: 128, g: 64, b: 32 } } }).png().toBuffer();
    const grayscale = await sharp(testPng).grayscale().raw().toBuffer({ resolveWithObject: true });
    res.json({
      ok: true,
      sharpVersion: versions.sharp,
      vipsVersion: versions.vips,
      webpVersion: versions.webp,
      testPngSize: testPng.length,
      grayscaleSize: grayscale.data.length,
      grayscaleDims: `${grayscale.info.width}x${grayscale.info.height}`,
      platform: process.platform,
      arch: process.arch,
    });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
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

    // Normalize image: handles HEIC/HEIF from iPhone, AVIF, unusual JPEG variants
    let processBuffer: Buffer;
    try {
      processBuffer = await normalizeImageBuffer(req.file.buffer);
    } catch (normErr) {
      console.error('[needle-engraving] normalizeImageBuffer failed:', normErr);
      throw new Error('Unsupported image format. Please upload a JPEG, PNG, or HEIC file.');
    }
    // Step 1: Use OpenAI gpt-image-1 images.edit to convert to engraving-ready grayscale
    // This matches the Python reference implementation exactly
    const isColor = await checkIfColorImage(processBuffer);
    // Always run AI conversion for portraits; for non-portrait, only if color
    if (isPortrait === "true" || isColor) {
      console.log(`[needle-engraving] Running AI conversion (isPortrait=${isPortrait}, isColor=${isColor})`);
      try {
        processBuffer = await convertToEngravingGrayscaleWithOpenAI(
          processBuffer,
          isPortrait === "true"
        );
        console.log('[needle-engraving] AI conversion done, buffer size:', processBuffer.length);
      } catch (aiErr) {
        console.error('[needle-engraving] AI conversion failed, continuing with original:', aiErr);
        // Continue with original buffer if AI fails
      }
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

    // Step 4: Create PNG preview for browser display (also used as JPEG/TIFF source)
    const previewBuffer = await sharp(result.rawPixels, { raw: { width: result.width, height: result.height, channels: 1 } }).png().toBuffer();
    const previewKey = `engraving-preview/${id}.png`;
    const { url: previewUrl } = await storagePut(previewKey, previewBuffer, "image/png");

    // Step 5: Create JPEG export
    const jpegBuffer = await sharp(result.rawPixels, { raw: { width: result.width, height: result.height, channels: 1 } }).jpeg({ quality: 95 }).toBuffer();
    const jpegKey = `engraving-output/${id}.jpg`;
    const { url: jpegUrl } = await storagePut(jpegKey, jpegBuffer, "image/jpeg");

    // Step 6: Create TIFF export
    const tiffBuffer = await sharp(result.rawPixels, { raw: { width: result.width, height: result.height, channels: 1 } }).tiff({ compression: 'lzw' }).toBuffer();
    const tiffKey = `engraving-output/${id}.tif`;
    const { url: tiffUrl } = await storagePut(tiffKey, tiffBuffer, "image/tiff");

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
      jpegUrl,
      tiffUrl,
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

    // Step 1: Generate image with AI using Forge API (text-to-image)
    const engravingPrompt = isPortrait === "true"
      ? `Professional portrait: ${prompt}. Grayscale only, no color. High contrast, sharp facial details, smooth gradients. Black background. Optimized for diamond needle engraving on black granite.`
      : `${prompt}. Grayscale only, no color. High contrast, sharp details, clean composition. Black background. Optimized for diamond needle engraving on black granite.`;

    const { url: generatedUrl, buffer: generatedBuffer } = await generateImage({ prompt: engravingPrompt });
    if (!generatedUrl) throw new Error("AI image generation failed");

    // Step 2: Use buffer directly from generateImage (already PNG)
    let genBuffer: Buffer;
    if (generatedBuffer) {
      genBuffer = generatedBuffer;
      console.log('[needle-engraving/generate] Using buffer directly from generateImage, size:', genBuffer.length);
    } else {
      const genResponse = await fetch(generatedUrl);
      if (!genResponse.ok) throw new Error(`Failed to fetch generated image: ${genResponse.status}`);
      const rawGenBuffer = Buffer.from(await genResponse.arrayBuffer());
      try {
        genBuffer = await normalizeImageBuffer(rawGenBuffer);
      } catch {
        genBuffer = rawGenBuffer;
      }
    }

    // Step 2b: Apply OpenAI gpt-image-1 engraving refinement (same as upload path)
    // This converts the generated image to proper engraving style
    try {
      genBuffer = await convertToEngravingGrayscaleWithOpenAI(genBuffer, isPortrait === "true");
      console.log('[needle-engraving/generate] AI engraving refinement done, size:', genBuffer.length);
    } catch (aiErr) {
      console.error('[needle-engraving/generate] AI refinement failed, using raw generated:', aiErr);
    }

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

    // Step 6: Create JPEG export
    const jpegBuffer = await sharp(result.rawPixels, { raw: { width: result.width, height: result.height, channels: 1 } }).jpeg({ quality: 95 }).toBuffer();
    const jpegKey = `engraving-output/${id}.jpg`;
    const { url: jpegUrl } = await storagePut(jpegKey, jpegBuffer, "image/jpeg");

    // Step 7: Create TIFF export
    const tiffBuffer = await sharp(result.rawPixels, { raw: { width: result.width, height: result.height, channels: 1 } }).tiff({ compression: 'lzw' }).toBuffer();
    const tiffKey = `engraving-output/${id}.tif`;
    const { url: tiffUrl } = await storagePut(tiffKey, tiffBuffer, "image/tiff");

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
      jpegUrl,
      tiffUrl,
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

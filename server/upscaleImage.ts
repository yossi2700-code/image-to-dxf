/**
 * AI Upscale helper — uses FAL.ai Real-ESRGAN x4 to upscale images before vectorization.
 * Produces sharper lines and more detail for potrace → DXF conversion.
 */
import { fal } from "@fal-ai/client";
import sharp from "sharp";

// Configure FAL client with API key
const FAL_KEY = process.env.FAL_KEY ?? "";

/**
 * Upscale a PNG buffer 4x using Real-ESRGAN via FAL.ai.
 * Falls back to sharp Lanczos upscale if FAL is unavailable or fails.
 *
 * @param inputBuffer - PNG image buffer to upscale
 * @returns Upscaled PNG buffer (4x resolution)
 */
export async function upscaleImageAI(inputBuffer: Buffer): Promise<Buffer> {
  if (!FAL_KEY) {
    console.warn("[upscale] FAL_KEY not set — falling back to Lanczos upscale");
    return lanczosUpscale(inputBuffer);
  }

  try {
    // Configure FAL client
    fal.config({ credentials: FAL_KEY });

    // Convert buffer to base64 data URI
    const b64 = inputBuffer.toString("base64");
    const dataUri = `data:image/png;base64,${b64}`;

    console.log("[upscale] Starting Real-ESRGAN x4 upscale via FAL.ai...");
    const startTime = Date.now();

    // Run Real-ESRGAN upscale
    const result = await fal.run("fal-ai/esrgan", {
      input: {
        image_url: dataUri,
        scale: 4,
      },
    }) as { image?: { url?: string; content_type?: string } };

    const imageUrl = result?.image?.url;
    if (!imageUrl) {
      throw new Error("FAL.ai did not return an image URL");
    }

    // Download the upscaled image
    const response = await fetch(imageUrl, { signal: AbortSignal.timeout(60_000) });
    if (!response.ok) {
      throw new Error(`Failed to download upscaled image: ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const upscaledBuffer = Buffer.from(arrayBuffer);

    const elapsed = Date.now() - startTime;
    const meta = await sharp(upscaledBuffer).metadata();
    console.log(`[upscale] Done in ${elapsed}ms — output: ${meta.width}x${meta.height}px`);

    return upscaledBuffer;
  } catch (err) {
    console.error("[upscale] FAL.ai upscale failed, falling back to Lanczos:", err);
    return lanczosUpscale(inputBuffer);
  }
}

/**
 * Fallback: simple Lanczos upscale x2 using sharp (no AI, just interpolation)
 */
async function lanczosUpscale(inputBuffer: Buffer): Promise<Buffer> {
  const meta = await sharp(inputBuffer).metadata();
  const w = (meta.width ?? 1024) * 2;
  const h = (meta.height ?? 1024) * 2;
  return sharp(inputBuffer)
    .resize(w, h, { kernel: "lanczos3" })
    .sharpen({ sigma: 1.5, m1: 1.5, m2: 0.5 })
    .png()
    .toBuffer();
}

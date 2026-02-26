import { Router } from "express";
import { convertImageToDxf } from "./imageProcessor";
import { storagePut } from "./storage";
import { nanoid } from "nanoid";
import { logUsageEvent, anonymizeIp } from "./usageDb";
import OpenAI from "openai";
import sharp from "sharp";

const router = Router();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Build a DALL-E 3 prompt for CNC engraving line art.
 * We ask for a bold, high-contrast illustration — then we extract edges from it.
 * This works better than asking for thin lines (DALL-E ignores that).
 */
function buildLineArtPrompt(userPrompt: string): string {
  return (
    `Bold black and white illustration of ${userPrompt}. ` +
    "Single centered object on pure white background. " +
    "High contrast, bold black shapes, no color, no grey, no gradients. " +
    "Simple clean design. Do not repeat. Do not crop."
  );
}

/**
 * Pre-process a DALL-E image to make it ideal for edge detection:
 * 1. Convert to grayscale
 * 2. Apply strong contrast boost (levels: darken blacks, whiten whites)
 * 3. Threshold at 180 to get pure black/white binary image
 *
 * This ensures that even filled/shaded DALL-E images produce clean
 * outline-only DXF results via Sobel edge detection.
 */
async function preprocessForEdgeDetection(buffer: Buffer): Promise<Buffer> {
  return await sharp(buffer)
    .grayscale()
    // Normalize to full range, then apply linear stretch to increase contrast
    .normalise()
    // Threshold: pixels darker than 128 become black, rest become white
    .threshold(128)
    .png()
    .toBuffer();
}

/**
 * POST /api/generate-images
 * Body: { prompt: string, modifications?: string }
 * Returns: { images: Array<{ imageUrl, svgPreview, dxfUrl, segmentCount, width, height }> }
 */
router.post("/api/generate-images", async (req, res) => {
  try {
    const { prompt, modifications } = req.body as {
      prompt?: string;
      modifications?: string;
    };

    if (!prompt || prompt.trim().length < 2) {
      return res.status(400).json({ error: "נא להזין תיאור של התמונה הרצויה" });
    }

    const fullPrompt = modifications
      ? `${prompt}. Modifications: ${modifications}`
      : prompt;

    const dallePrompt = buildLineArtPrompt(fullPrompt);

    // Generate 3 images in parallel using DALL-E 3
    const generationPromises = Array.from({ length: 3 }, async () => {
      const response = await openai.images.generate({
        model: "dall-e-3",
        prompt: dallePrompt,
        n: 1,
        size: "1024x1024",
        quality: "standard",
        style: "natural",
      });

      const imageUrl = response.data?.[0]?.url;
      if (!imageUrl) {
        throw new Error("לא הצלחנו לייצר תמונה");
      }

      // Fetch the generated image
      const imgResponse = await fetch(imageUrl);
      if (!imgResponse.ok) {
        throw new Error("שגיאה בהורדת התמונה שנוצרה");
      }
      const rawBuffer = Buffer.from(await imgResponse.arrayBuffer());

      // Pre-process: normalize contrast + threshold to pure black/white
      // This converts any filled/shaded DALL-E image into a clean binary image
      // so that Sobel edge detection extracts only the outline strokes.
      const processedBuffer = await preprocessForEdgeDetection(rawBuffer);

      const { dxf, svgPreview, segmentCount, width, height } =
        await convertImageToDxf(processedBuffer, {
          threshold: 128,        // Standard threshold on already-binary image
          simplifyTolerance: 2,  // Moderate simplification for clean paths
          doubleLineOffset: 0,
        });

      // Upload DXF to S3
      const dxfKey = `dxf-ai/${nanoid()}.dxf`;
      const { url: dxfUrl } = await storagePut(
        dxfKey,
        Buffer.from(dxf, "utf-8"),
        "application/dxf"
      );

      return { imageUrl, svgPreview, dxfUrl, segmentCount, width, height };
    });

    const images = await Promise.all(generationPromises);

    // Log one ai_generate event
    const rawIp =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      req.socket.remoteAddress;
    const totalSegments = images.reduce((s, img) => s + img.segmentCount, 0);
    void logUsageEvent({
      type: "ai_generate",
      segmentCount: Math.round(totalSegments / images.length),
      ipAnon: anonymizeIp(rawIp),
    });

    return res.json({ success: true, images });
  } catch (err: unknown) {
    console.error("[generate-images]", err);
    const message =
      err instanceof Error ? err.message : "שגיאה ביצירת התמונות";
    return res.status(500).json({ error: message });
  }
});

export default router;

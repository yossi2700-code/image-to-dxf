import { Router } from "express";
import { convertImageToDxf } from "./imageProcessor";
import { storagePut } from "./storage";
import { nanoid } from "nanoid";
import { logUsageEvent, anonymizeIp } from "./usageDb";
import OpenAI from "openai";

const router = Router();

// Initialize OpenAI client with the user's API key
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Build a DALL-E 3 prompt optimized for clean outline-only line art suitable for DXF/CNC conversion.
 *
 * The key insight: DALL-E tends to fill shapes. We must be very explicit:
 * - OUTLINE ONLY — like a coloring book page
 * - Pure white inside all shapes (no fill, no grey, no texture)
 * - Single thin black stroke on the outline
 * - Absolutely no hatching, cross-hatching, stippling, or texture fills
 */
function buildLineArtPrompt(userPrompt: string): string {
  return (
    `${userPrompt}. ` +
    "Coloring book style line art. " +
    "Pure white background. " +
    "Only thin black outline strokes, like a coloring book page for children. " +
    "All interior areas must be completely white with zero fill. " +
    "No shading, no hatching, no cross-hatching, no stippling, no texture, no grey tones, no gradients. " +
    "No black fill anywhere inside the shapes. " +
    "Simple clean outlines only. " +
    "High contrast: pure black lines on pure white. " +
    "Suitable for laser cutting and CNC engraving. " +
    "No text, no watermarks, no background patterns."
  );
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
        style: "natural", // "natural" gives cleaner line art vs "vivid"
      });

      const imageUrl = response.data?.[0]?.url;
      if (!imageUrl) {
        throw new Error("לא הצלחנו לייצר תמונה");
      }

      // Fetch the generated image and convert to DXF
      const imgResponse = await fetch(imageUrl);
      if (!imgResponse.ok) {
        throw new Error("שגיאה בהורדת התמונה שנוצרה");
      }
      const imgBuffer = Buffer.from(await imgResponse.arrayBuffer());

      const { dxf, svgPreview, segmentCount, width, height } =
        await convertImageToDxf(imgBuffer, {
          threshold: 180,         // High threshold: capture thin dark outlines only
          simplifyTolerance: 1.5, // Light simplification to preserve thin line details
          doubleLineOffset: 0,    // No double-line for AI images
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

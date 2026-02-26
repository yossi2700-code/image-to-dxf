import { Router } from "express";
import { convertImageToDxf } from "./imageProcessor";
import { storagePut } from "./storage";
import { nanoid } from "nanoid";
import { logUsageEvent, anonymizeIp } from "./usageDb";
import OpenAI from "openai";

const router = Router();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Build a DALL-E 3 prompt for CNC engraving line art.
 * Goal: one single illustration, closed black outlines on white, no fill, no shading.
 */
function buildLineArtPrompt(userPrompt: string): string {
  return (
    `Black and white line art illustration for CNC engraving: ${userPrompt}. ` +
    "ONE single illustration centered on a pure white background. " +
    "Closed black outlines only, thin clean lines, white fill inside all shapes. " +
    "No shading, no gradients, no hatching, no texture, no grey. " +
    "Simple clean design suitable for CNC router or laser engraving."
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
        style: "natural", // "natural" gives cleaner outlines vs "vivid"
      });

      const imageUrl = response.data?.[0]?.url;
      if (!imageUrl) {
        throw new Error("לא הצלחנו לייצר תמונה");
      }

      // Fetch the generated image and convert to DXF
      // Use high threshold (200+) to capture ONLY the dark outline strokes,
      // ignoring any light grey areas that DALL-E might add
      const imgResponse = await fetch(imageUrl);
      if (!imgResponse.ok) {
        throw new Error("שגיאה בהורדת התמונה שנוצרה");
      }
      const imgBuffer = Buffer.from(await imgResponse.arrayBuffer());

      const { dxf, svgPreview, segmentCount, width, height } =
        await convertImageToDxf(imgBuffer, {
          threshold: 200,         // Very high: only capture dark black outlines
          simplifyTolerance: 2,   // Moderate simplification for clean paths
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

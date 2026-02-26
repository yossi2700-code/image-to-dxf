import { Router } from "express";
import { convertImageToDxf } from "./imageProcessor";
import { storagePut } from "./storage";
import { nanoid } from "nanoid";
import { logUsageEvent, anonymizeIp } from "./usageDb";
import OpenAI from "openai";

const router = Router();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Build a prompt for gpt-image-1 for CNC engraving line art.
 * gpt-image-1 follows prompts much more precisely than DALL-E 3,
 * so we can directly ask for thin outline-only drawings.
 */
function buildLineArtPrompt(userPrompt: string): string {
  return (
    `Black and white line drawing of ${userPrompt}. ` +
    "Pure white background. " +
    "Thin black outlines only, no fill, no shading, no gradients, no color. " +
    "Style: clean pen sketch, coloring book illustration. " +
    "Single centered object, complete and not cropped."
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

    const imagePrompt = buildLineArtPrompt(fullPrompt);

    // Generate 3 images in parallel using gpt-image-1
    const generationPromises = Array.from({ length: 3 }, async () => {
      const response = await openai.images.generate({
        model: "gpt-image-1",
        prompt: imagePrompt,
        n: 1,
        size: "1024x1024",
        quality: "medium",
      });

      // gpt-image-1 returns base64 by default
      const imageData = response.data?.[0];
      if (!imageData) {
        throw new Error("לא הצלחנו לייצר תמונה");
      }

      let rawBuffer: Buffer;

      if (imageData.b64_json) {
        // Base64 response
        rawBuffer = Buffer.from(imageData.b64_json, "base64");
      } else if (imageData.url) {
        // URL response (fallback)
        const imgResponse = await fetch(imageData.url);
        if (!imgResponse.ok) {
          throw new Error("שגיאה בהורדת התמונה שנוצרה");
        }
        rawBuffer = Buffer.from(await imgResponse.arrayBuffer());
      } else {
        throw new Error("לא התקבלה תמונה מה-AI");
      }

      // Upload original image to S3 for preview
      const imgKey = `ai-generated/${nanoid()}.png`;
      const { url: imageUrl } = await storagePut(
        imgKey,
        rawBuffer,
        "image/png"
      );

      // Convert to DXF — gpt-image-1 already produces clean line art.
      // Higher threshold = only dark lines pass.
      // Higher simplifyTolerance = smoother, fewer segments.
      const { dxf, svgPreview, segmentCount, width, height } =
        await convertImageToDxf(rawBuffer, {
          threshold: 160,          // Good balance: removes grey noise, keeps outlines
          simplifyTolerance: 4,      // Smooth lines, good detail
          doubleLineOffset: 0,
          minSegmentLength: 3,       // Filter tiny noise segments (< 3px)
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

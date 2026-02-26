import { Router } from "express";
import { generateImage } from "./_core/imageGeneration";
import { convertImageToDxf } from "./imageProcessor";
import { storagePut } from "./storage";
import { nanoid } from "nanoid";

const router = Router();

/**
 * Build a prompt optimized for B&W line-art suitable for laser engraving/CNC
 */
function buildLineArtPrompt(userPrompt: string, variant: number): string {
  const styles = [
    "clean minimal line art, single continuous outlines, no fill, no shading, no background, pure black lines on white",
    "detailed technical illustration style, thin precise black outlines on white background, no fill, no gradients, suitable for laser engraving",
    "bold graphic design style, strong black contour lines on white, simplified shapes, no shading, high contrast",
  ];
  const style = styles[variant % styles.length];
  return `${userPrompt}. Style: ${style}. Black and white only. Vector-style illustration. No text. No watermarks.`;
}

/**
 * POST /api/generate-images
 * Body: { prompt: string, modifications?: string }
 * Returns: { images: Array<{ url, svgPreview, dxfUrl, segmentCount, width, height }> }
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
      ? `${prompt}. Changes: ${modifications}`
      : prompt;

    // Generate 3 variants in parallel
    const generationPromises = [0, 1, 2].map(async (variant) => {
      const aiPrompt = buildLineArtPrompt(fullPrompt, variant);
      const { url: imageUrl } = await generateImage({ prompt: aiPrompt });

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
          threshold: 180, // Higher threshold for AI-generated line art (mostly white bg)
          simplifyTolerance: 2,
        });

      // Upload DXF to S3
      const dxfKey = `dxf-ai/${nanoid()}.dxf`;
      const { url: dxfUrl } = await storagePut(
        dxfKey,
        Buffer.from(dxf, "utf-8"),
        "application/dxf"
      );

      return {
        imageUrl,
        svgPreview,
        dxfUrl,
        segmentCount,
        width,
        height,
      };
    });

    const images = await Promise.all(generationPromises);

    return res.json({ success: true, images });
  } catch (err: unknown) {
    console.error("[generate-images]", err);
    const message =
      err instanceof Error ? err.message : "שגיאה ביצירת התמונות";
    return res.status(500).json({ error: message });
  }
});

export default router;

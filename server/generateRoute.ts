import { Router } from "express";
import { generateImage } from "./_core/imageGeneration";
import { convertImageToDxf } from "./imageProcessor";
import { storagePut } from "./storage";
import { nanoid } from "nanoid";
import { logUsageEvent, anonymizeIp } from "./usageDb";

const router = Router();

/**
 * Build a prompt optimized for CNC engraving / laser cutting.
 *
 * Key requirements for good CNC conversion:
 * - Pure black outlines on white background (no grey, no fill)
 * - Bold, clear, single-stroke or double-stroke contour lines
 * - No gradients, no textures, no shading
 * - Simple shapes with clear edges (Sobel edge detection works best on these)
 * - High contrast so threshold detection is clean
 *
 * Each variant uses a slightly different style emphasis to give 3 distinct options.
 */
function buildCncLineArtPrompt(userPrompt: string, variant: number): string {
  const baseStyle =
    "Black ink on pure white background. Bold clean outlines only, no fill, no shading, no gradients, no textures, no grey tones. High contrast. Suitable for CNC engraving and laser cutting.";

  const variantStyles = [
    // Variant 0: clean minimal silhouette / stencil style
    "Minimalist stencil-style illustration. Single bold black outline, thick strokes (3-5px), simplified shapes, no internal details. Like a rubber stamp or vinyl cut design.",

    // Variant 1: technical line art / woodcut style
    "Technical line art / woodcut style. Bold black outlines with simple internal line details. All lines are closed paths. No cross-hatching, no gradients. Like a vintage woodcut print.",

    // Variant 2: geometric / graphic design style
    "Geometric graphic design style. Clean geometric shapes with bold black outlines. Symmetrical composition. No fill, no shading. Like a modern logo or icon.",
  ];

  const style = variantStyles[variant % variantStyles.length];
  return `${userPrompt}. ${style} ${baseStyle} No text. No watermarks. No background patterns.`;
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

    // Generate 3 CNC-optimised variants in parallel
    const generationPromises = [0, 1, 2].map(async (variant) => {
      const aiPrompt = buildCncLineArtPrompt(fullPrompt, variant);
      const { url: imageUrl } = await generateImage({ prompt: aiPrompt });

      if (!imageUrl) {
        throw new Error("לא הצלחנו לייצר תמונה");
      }

      // Fetch the generated image and convert to DXF
      // We use a relatively high threshold (160) because AI images tend to have
      // mostly white backgrounds with dark outlines — we want to capture only
      // the dark edges, not noise.
      const imgResponse = await fetch(imageUrl);
      if (!imgResponse.ok) {
        throw new Error("שגיאה בהורדת התמונה שנוצרה");
      }
      const imgBuffer = Buffer.from(await imgResponse.arrayBuffer());

      const { dxf, svgPreview, segmentCount, width, height } =
        await convertImageToDxf(imgBuffer, {
          threshold: 160,          // High threshold: capture bold outlines only
          simplifyTolerance: 2,    // Moderate simplification for clean paths
          doubleLineOffset: 0,     // No double-line for AI images by default
                                   // (user can apply it in the upload tab if needed)
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

    // Log one ai_generate event (covers all 3 variants)
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

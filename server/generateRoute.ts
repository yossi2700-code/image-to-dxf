import { Router } from "express";
import { generateImage } from "./_core/imageGeneration";
import { convertImageToDxf } from "./imageProcessor";
import { storagePut } from "./storage";
import { nanoid } from "nanoid";
import { logUsageEvent, anonymizeIp } from "./usageDb";

const router = Router();

/**
 * Build a prompt optimized for CNC engraving:
 * - Double closed contour lines (2mm gap between inner and outer line)
 * - No fill, no shading, pure black on white
 * - All paths must be closed loops
 */
function buildCncLineArtPrompt(userPrompt: string, variant: number): string {
  const styles = [
    // Variant 0: clean minimal double-outline
    "clean minimal double-outline contour drawing. Every shape has TWO parallel black lines forming a closed loop with a 2mm gap between them, like a CNC routing path. Pure white background, no fill, no shading, no gradients. Suitable for CNC engraving where the tool travels between the two lines.",
    // Variant 1: detailed technical double-contour
    "precise technical double-contour illustration. Each element is drawn with two parallel closed black outlines separated by a 2mm channel, creating a routing groove for CNC machines. White background, no fill, no cross-hatching, no text. All contours are closed paths.",
    // Variant 2: bold graphic double-stroke
    "bold graphic double-stroke design. Every outline consists of two parallel black lines forming closed shapes with a uniform 2mm gap between them — the channel where a CNC engraving tool will cut. High contrast, white background, no fill, no shading, simplified clean shapes.",
  ];
  const style = styles[variant % styles.length];
  return `${userPrompt}. ${style} Black and white only. No text. No watermarks. No background elements.`;
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
      ? `${prompt}. Modifications: ${modifications}`
      : prompt;

    // Generate 3 CNC-optimised variants in parallel
    const generationPromises = [0, 1, 2].map(async (variant) => {
      const aiPrompt = buildCncLineArtPrompt(fullPrompt, variant);
      const { url: imageUrl } = await generateImage({ prompt: aiPrompt });

      if (!imageUrl) {
        throw new Error("לא הצלחנו לייצר תמונה");
      }

      // Fetch the generated image and convert to DXF with double-line mode
      const imgResponse = await fetch(imageUrl);
      if (!imgResponse.ok) {
        throw new Error("שגיאה בהורדת התמונה שנוצרה");
      }
      const imgBuffer = Buffer.from(await imgResponse.arrayBuffer());

      const { dxf, svgPreview, segmentCount, width, height } =
        await convertImageToDxf(imgBuffer, {
          threshold: 180,       // High threshold: AI images are mostly white
          simplifyTolerance: 2,
          doubleLineOffset: 4,  // ~2mm at typical 2px/mm resolution
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

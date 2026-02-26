import { Router } from "express";
import { storagePut } from "./storage";
import { nanoid } from "nanoid";
import { logUsageEvent, anonymizeIp } from "./usageDb";
import OpenAI from "openai";
import { svgToDxf } from "./svgToDxf";
import potrace from "potrace";
import sharp from "sharp";

const router = Router();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Build a prompt that produces a clean, high-contrast PNG ideal for potrace vectorization.
 * Key: thick black strokes on pure white — no grey, no gradients, no fills.
 */
function buildLineArtPrompt(userPrompt: string): string {
  return (
    `Clean black and white line art of ${userPrompt}. ` +
    "Pure white background (#FFFFFF). " +
    "Bold thick black outlines (3-5px stroke width), no fill, no shading, no gradients. " +
    "High contrast: only pure black (#000000) lines on white. " +
    "Style: bold coloring book illustration, technical drawing. " +
    "Single centered object, complete, not cropped. " +
    "No text, no watermarks, no grey tones."
  );
}

/**
 * Convert a PNG buffer to SVG using potrace.
 * potrace traces the bitmap contours into smooth Bezier curves.
 */
function pngToSvg(pngBuffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    potrace.trace(pngBuffer, {
      threshold: 180,       // pixels darker than this become foreground
      turdSize: 8,          // ignore speckles smaller than this (noise removal)
      alphaMax: 1,          // corner smoothness (0=sharp, 1.33=smooth)
      optCurve: true,       // optimize curves
      optTolerance: 0.2,    // curve optimization tolerance
    }, (err: Error | null, svg: string) => {
      if (err) reject(err);
      else resolve(svg);
    });
  });
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
      // Step 1: Generate PNG with AI
      const response = await openai.images.generate({
        model: "gpt-image-1",
        prompt: imagePrompt,
        n: 1,
        size: "1024x1024",
        quality: "medium",
      });

      const imageData = response.data?.[0];
      if (!imageData) throw new Error("לא הצלחנו לייצר תמונה");

      let rawBuffer: Buffer;
      if (imageData.b64_json) {
        rawBuffer = Buffer.from(imageData.b64_json, "base64");
      } else if (imageData.url) {
        const imgResponse = await fetch(imageData.url);
        if (!imgResponse.ok) throw new Error("שגיאה בהורדת התמונה שנוצרה");
        rawBuffer = Buffer.from(await imgResponse.arrayBuffer());
      } else {
        throw new Error("לא התקבלה תמונה מה-AI");
      }

      // Step 2: Pre-process — convert to high-contrast grayscale for better potrace results
      const processedBuffer = await sharp(rawBuffer)
        .grayscale()
        .threshold(200)   // hard threshold: pixels > 200 → white, rest → black
        .png()
        .toBuffer();

      // Step 3: Vectorize with potrace (bitmap → smooth SVG Bezier curves)
      const svgContent = await pngToSvg(processedBuffer);

      // Step 4: Convert SVG to DXF
      const { dxf, segmentCount, width, height } = svgToDxf(svgContent);

      // Upload original PNG to S3 for preview thumbnail
      const imgKey = `ai-generated/${nanoid()}.png`;
      const { url: imageUrl } = await storagePut(imgKey, rawBuffer, "image/png");

      // Upload DXF to S3
      const dxfKey = `dxf-ai/${nanoid()}.dxf`;
      const { url: dxfUrl } = await storagePut(
        dxfKey,
        Buffer.from(dxf, "utf-8"),
        "application/dxf"
      );

      return { imageUrl, svgPreview: svgContent, dxfUrl, segmentCount, width, height };
    });

    const images = await Promise.all(generationPromises);

    // Log usage
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
    const message = err instanceof Error ? err.message : "שגיאה ביצירת התמונות";
    return res.status(500).json({ error: message });
  }
});

export default router;

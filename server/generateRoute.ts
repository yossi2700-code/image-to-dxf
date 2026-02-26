import { Router } from "express";
import { storagePut } from "./storage";
import { nanoid } from "nanoid";
import { logUsageEvent, anonymizeIp } from "./usageDb";
import OpenAI from "openai";
import { svgToDxf } from "./svgToDxf";

const router = Router();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Ask GPT-4o to generate a clean SVG line drawing suitable for CNC engraving.
 * Returns raw SVG string with simple paths/polylines, no fills, no gradients.
 */
async function generateSvgLineArt(userPrompt: string): Promise<string> {
  const systemPrompt = `You are an SVG line art generator for CNC engraving and laser cutting.
Generate a clean, minimal SVG of the requested subject.

STRICT RULES:
- Output ONLY valid SVG code, nothing else — no markdown, no explanation
- Use only <path>, <line>, <polyline>, <circle>, <ellipse>, <rect> elements
- stroke="#000000" stroke-width="1" fill="none" on ALL elements
- viewBox="0 0 500 500" width="500" height="500"
- Simple, clean outlines only — like a coloring book
- Single centered object, complete, not cropped
- 20-80 path elements maximum — keep it clean and simple
- NO text, NO gradients, NO fills, NO images, NO groups with transforms`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Draw: ${userPrompt}` },
    ],
    max_tokens: 4000,
    temperature: 0.7,
  });

  const content = response.choices[0]?.message?.content ?? "";

  // Extract SVG from response (in case there's any extra text)
  const svgMatch = content.match(/<svg[\s\S]*<\/svg>/i);
  if (!svgMatch) {
    throw new Error("GPT-4o did not return valid SVG");
  }

  return svgMatch[0];
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

    // Generate 3 SVG variations in parallel
    const generationPromises = Array.from({ length: 3 }, async () => {
      const svgContent = await generateSvgLineArt(fullPrompt);

      // Convert SVG to DXF
      const { dxf, segmentCount, width, height } = svgToDxf(svgContent);

      // Upload SVG to S3 (used as "imageUrl" for display)
      const svgKey = `ai-generated/${nanoid()}.svg`;
      const { url: imageUrl } = await storagePut(
        svgKey,
        Buffer.from(svgContent, "utf-8"),
        "image/svg+xml"
      );

      // Upload DXF to S3
      const dxfKey = `dxf-ai/${nanoid()}.dxf`;
      const { url: dxfUrl } = await storagePut(
        dxfKey,
        Buffer.from(dxf, "utf-8"),
        "application/dxf"
      );

      return {
        imageUrl,
        svgPreview: svgContent,
        dxfUrl,
        segmentCount,
        width,
        height,
      };
    });

    const images = await Promise.all(generationPromises);

    // Log usage event
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

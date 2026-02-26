import { Router } from "express";
import { storagePut } from "./storage";
import { nanoid } from "nanoid";
import { logUsageEvent, anonymizeIp } from "./usageDb";
import { getAppUserFromCookie } from "./appAuth";
import { recordUserAction } from "./userActionsDb";
import { checkUsageLimit } from "./usageLimits";
import OpenAI from "openai";
import { svgToDxf } from "./svgToDxf";
import potrace from "potrace";
import sharp from "sharp";

const router = Router();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Three distinct style variations for the same subject.
 * Each produces visually different line art for potrace vectorization.
 */
const STYLE_VARIATIONS = [
  {
    label: "minimal",
    style:
      "Minimalist clean line art, simple bold outlines only, very few lines, " +
      "no internal details, icon-like silhouette style.",
  },
  {
    label: "detailed",
    style:
      "Detailed technical illustration, rich internal lines and cross-hatching details, " +
      "architectural drawing style, many fine lines showing texture and depth.",
  },
  {
    label: "geometric",
    style:
      "Geometric abstract interpretation, composed of straight lines and simple shapes, " +
      "low-poly / faceted look, no curves.",
  },
];

function buildLineArtPrompt(userPrompt: string, variationIndex: number): string {
  const variation = STYLE_VARIATIONS[variationIndex % STYLE_VARIATIONS.length];
  return (
    `Clean black and white line art of ${userPrompt}. ` +
    "Pure white background (#FFFFFF). " +
    "Bold thick black outlines (3-5px stroke width), no fill, no shading, no gradients. " +
    "High contrast: only pure black (#000000) lines on white. " +
    `${variation.style} ` +
    "Single centered object, complete, not cropped. " +
    "No text, no watermarks, no grey tones."
  );
}

/** Convert a user prompt to a safe filename (Hebrew + ASCII supported) */
function promptToFilename(prompt: string): string {
  // Keep Hebrew, Latin letters, digits, spaces; replace spaces with underscore; trim to 40 chars
  const safe = prompt
    .trim()
    .replace(/[^\u0590-\u05FF\w\s]/g, "")
    .replace(/\s+/g, "_")
    .slice(0, 40);
  return safe || "design";
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

    const rawIp = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
    const ipAnon = anonymizeIp(rawIp);
    const appUser = getAppUserFromCookie(req.cookies);

    // Only registered users may generate
    if (!appUser?.userId) {
      return res.status(401).json({ error: "REGISTRATION_REQUIRED", message: "נדרשת הרשמה כדי ליצור עיצובי AI" });
    }

    // Check usage limit
    const limitCheck = await checkUsageLimit(appUser.userId);
    if (!limitCheck.allowed) {
      return res.status(403).json({
        error: "QUOTA_EXCEEDED",
        message: `עברת את מכסת הפעולות (${limitCheck.used}/${limitCheck.max}). צור קשר עם המפתח לפתיחה מחדש.`,
        used: limitCheck.used,
        max: limitCheck.max,
      });
    }

    const fullPrompt = modifications
      ? `${prompt}. Modifications: ${modifications}`
      : prompt;

    const baseFilename = promptToFilename(prompt);

    // Generate 3 images in parallel using gpt-image-1 — each with a different style variation
    const generationPromises = Array.from({ length: 3 }, async (_, idx) => {
      const imagePrompt = buildLineArtPrompt(fullPrompt, idx);
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
      const rawSvg = await pngToSvg(processedBuffer);
      // potrace fills paths with black by default — convert to stroke-only for preview
      const svgContent = rawSvg
        .replace(/fill="[^"]*"/g, 'fill="none"')
        .replace(/fill:[^;"']*(;|(?="))/g, 'fill:none$1')
        .replace(/<path /g, '<path stroke="black" stroke-width="1.5" fill="none" ');
      // Remove duplicate fill/stroke attrs that might appear after replacement
      const cleanSvg = svgContent.replace(/stroke="black" stroke-width="1.5" fill="none" ([^>]*?)fill="none"/g, 'stroke="black" stroke-width="1.5" fill="none" $1');

      // Step 4: Convert SVG to DXF (use raw SVG for DXF — fill doesn't matter there)
      const { dxf, segmentCount, width, height } = svgToDxf(rawSvg);

      // Upload original PNG to S3 for preview thumbnail
      const imgKey = `ai-generated/${nanoid()}.png`;
      const { url: imageUrl } = await storagePut(imgKey, rawBuffer, "image/png");

      // Upload DXF to S3 — use prompt-based filename
      const variation = STYLE_VARIATIONS[idx % STYLE_VARIATIONS.length];
      const dxfFilename = `${baseFilename}_${variation.label}.dxf`;
      const dxfKey = `dxf-ai/${nanoid()}-${dxfFilename}`;
      const { url: dxfUrl } = await storagePut(
        dxfKey,
        Buffer.from(dxf, "utf-8"),
        "application/dxf"
      );

      // Use cleanSvg (stroke-only) for visual preview
      return { imageUrl, svgPreview: cleanSvg, dxfUrl, dxfFilename, segmentCount, width, height };
    });

    const images = await Promise.all(generationPromises);

    // Log usage
    const totalSegments = images.reduce((s, img) => s + img.segmentCount, 0);
    void logUsageEvent({
      type: "ai_generate",
      segmentCount: Math.round(totalSegments / images.length),
      ipAnon: anonymizeIp(ipAnon ?? undefined),
    });

    // Record user action (user is guaranteed logged in at this point)
    for (const img of images) {
      void recordUserAction({
        appUserId: appUser.userId,
        actionType: "ai_generate",
        description: fullPrompt.slice(0, 200),
        segmentCount: img.segmentCount,
        dxfUrl: img.dxfUrl,
        imageUrl: img.imageUrl,
        svgPreview: img.svgPreview,
      });
    }

    return res.json({ success: true, images });
  } catch (err: unknown) {
    console.error("[generate-images]", err);
    const message = err instanceof Error ? err.message : "שגיאה ביצירת התמונות";
    return res.status(500).json({ error: message });
  }
});

export default router;

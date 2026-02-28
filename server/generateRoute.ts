import { Router } from "express";
import { storagePut } from "./storage";
import { nanoid } from "nanoid";
import { logUsageEvent, anonymizeIp } from "./usageDb";
import { getAppUserFromCookie } from "./appAuth";
import { recordUserAction } from "./userActionsDb";
import { checkUsageLimit } from "./usageLimits";
import { deductTokens } from "./tokenService";
import OpenAI from "openai";
import { svgToDxf } from "./svgToDxf";
import potrace from "potrace";
import sharp from "sharp";

const router = Router();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY ?? "" });

/**
 * Three distinct style variations for the same subject.
 * Each produces visually different line art for potrace vectorization.
 */
const STYLE_VARIATIONS = [
  {
    label: "simple",
    style:
      "Clean architectural/technical line drawing style. Clear outer contour with essential structural details. " +
      "Every major visible element must be drawn with clean precise lines. " +
      "NO texture, NO hatching, NO shading, NO fill, NO noise. " +
      "Lines must be smooth, confident, and well-proportioned — like a professional technical illustration.",
  },
  {
    label: "detailed",
    style:
      "Highly detailed technical illustration style. Precise outer contour with rich internal line work " +
      "capturing all visible structural elements, surfaces, and features. " +
      "Every part of the scene should be recognizable and well-drawn. " +
      "NO texture, NO hatching, NO shading, NO fill. " +
      "Like a professional architectural or engineering drawing — clean, accurate, and complete.",
  },
  {
    label: "decorative",
    style:
      "Elegant artistic line illustration style. Detailed outer contour with refined artistic inner lines. " +
      "All elements drawn with flowing, precise strokes — like a high-quality engraving or fine art print. " +
      "NO texture, NO hatching, NO shading, NO fill. " +
      "Every visible element beautifully rendered with clean distinct lines suitable for laser cutting.",
  },
];

function buildLineArtPrompt(userPrompt: string, variationIndex: number): string {
  const variation = STYLE_VARIATIONS[variationIndex % STYLE_VARIATIONS.length];
  return (
    `Professional black and white line art illustration of ${userPrompt}. ` +
    "Pure white background (#FFFFFF). " +
    "Clean precise black lines only, no fill, no shading, no gradients, no grey tones. " +
    "High contrast: only pure black (#000000) lines on pure white. " +
    "ALL elements must be drawn — do not simplify or omit any visible parts. " +
    "Vary line weight: thicker lines for main outlines, thinner lines for internal details. " +
    `${variation.style} ` +
    "Complete composition, not cropped, centered. " +
    "No text, no watermarks, no noise, no texture fills."
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
      threshold: 128,       // midpoint threshold (image already pre-thresholded)
      turdSize: 4,          // smaller: preserve more fine detail lines
      alphaMax: 0.8,        // slightly sharper corners for technical drawings
      optCurve: true,       // optimize curves for smooth Bezier paths
      optTolerance: 0.15,   // tighter tolerance = more accurate curves
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

    // Block check
    const { getDb } = await import("./db");
    const { appUsers } = await import("../drizzle/schema");
    const { eq } = await import("drizzle-orm");
    const dbConn = await getDb();
    if (dbConn) {
      const [userRow] = await dbConn.select({ isBlocked: appUsers.isBlocked }).from(appUsers).where(eq(appUsers.id, appUser.userId)).limit(1);
      if (userRow?.isBlocked) {
        return res.status(403).json({
          error: "USER_BLOCKED",
          message: "חשבונך חסום. לפרטים פנה לרובוטיקה וטכנולוגיה.",
          messageEn: "Your account has been blocked. Please contact Robotics & Technology.",
        });
      }
    }

    // Token check & deduction
    const tokenResult = await deductTokens(appUser.userId, "ai_generate", prompt);
    if (!tokenResult.success) {
      return res.status(402).json({
        error: "INSUFFICIENT_TOKENS",
        balance: tokenResult.balance,
        message: "נגמרו לך האסימונים. ליצירת קשר ורכישת אסימונים נוספים פנה לרובוטיקה וטכנולוגיה.",
        messageEn: "You have run out of tokens. To purchase more tokens, contact Robotics & Technology.",
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

      // Step 2: Pre-process — enhance contrast then threshold for cleaner potrace results
      // 1. Convert to grayscale
      // 2. Normalize (stretch contrast to full range)
      // 3. Sharpen edges slightly to make lines crisper
      // 4. Hard threshold: pure black/white for clean vectorization
      const processedBuffer = await sharp(rawBuffer)
        .grayscale()
        .normalize()       // stretch histogram to full 0-255 range
        .sharpen({ sigma: 1.5, m1: 1.5, m2: 0.5 })  // crisp edges
        .threshold(160)    // slightly lower threshold to preserve thin detail lines
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
      const { dxf, segmentCount, width, height, realWidth, realHeight } = svgToDxf(rawSvg);

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
      return { imageUrl, svgPreview: cleanSvg, dxfUrl, dxfFilename, segmentCount, width, height, realWidth, realHeight };
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

    // Handle OpenAI-specific errors with friendly Hebrew messages
    if (err && typeof err === "object" && "status" in err) {
      const apiErr = err as { status: number; message?: string; code?: string };
      if (apiErr.status === 429) {
        return res.status(503).json({
          error: "SERVICE_UNAVAILABLE",
          message: "שירות ה-AI עמוס כרגע. אנא נסה שוב בעוד מספר דקות.",
        });
      }
      if (apiErr.status === 402 || apiErr.code === "insufficient_quota") {
        return res.status(503).json({
          error: "SERVICE_UNAVAILABLE",
          message: "שירות ה-AI אינו זמין כרגע. אנא נסה שוב מאוחר יותר.",
        });
      }
      if (apiErr.status === 400) {
        return res.status(400).json({
          error: "INVALID_PROMPT",
          message: "הפרומפט אינו תקין. נסה תיאור אחר.",
        });
      }
    }

    // Check error message for quota/billing keywords
    const errMsg = err instanceof Error ? err.message : String(err);
    if (errMsg.toLowerCase().includes("quota") || errMsg.toLowerCase().includes("billing") || errMsg.toLowerCase().includes("insufficient")) {
      return res.status(503).json({
        error: "SERVICE_UNAVAILABLE",
        message: "שירות ה-AI אינו זמין כרגע. אנא נסה שוב מאוחר יותר.",
      });
    }

    const message = err instanceof Error ? err.message : "שגיאה ביצירת התמונות";
    return res.status(500).json({ error: message });
  }
});

export default router;

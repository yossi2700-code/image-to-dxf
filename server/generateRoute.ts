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
      "Clean professional line art with bold outer contour and key structural lines. " +
      "Show depth and form with 3-5 internal lines indicating main surfaces and edges. " +
      "Technical illustration style — like a product blueprint or engineering drawing. " +
      "NO texture, NO hatching, NO shading, NO fill. Pure black lines on white.",
  },
  {
    label: "detailed",
    style:
      "Highly detailed professional line art. Bold outer contour with rich internal line work " +
      "showing all structural features, surfaces, depth cues, and fine details. " +
      "Like a professional technical illustration or detailed product drawing. " +
      "NO texture, NO hatching, NO shading, NO fill. Clean distinct lines only.",
  },
  {
    label: "decorative",
    style:
      "Elegant decorative line art with artistic flair. Bold outer contour with flowing " +
      "decorative inner lines. Ornamental, architectural, or art nouveau style. " +
      "Rich detail suitable for laser engraving on wood or metal. " +
      "NO texture, NO hatching, NO shading, NO fill. All lines clean and precise.",
  },
];

/**
 * Three distinct style variations for LANDSCAPE mode.
 * Designed to capture the full scene: sky, horizon, foreground, buildings, nature.
 */
const LANDSCAPE_STYLE_VARIATIONS = [
  {
    label: "simple",
    style:
      "Simple clean landscape outline. Bold horizon line, clear silhouettes of all elements (buildings, trees, mountains, sky). " +
      "Capture the full panoramic scene — foreground, midground, background. " +
      "NO texture, NO hatching, NO shading, NO fill. Clean minimal lines only.",
  },
  {
    label: "detailed",
    style:
      "Detailed landscape line art. Clear horizon with rich detail in all layers: sky elements (clouds, sun), " +
      "background (mountains, distant buildings), midground (trees, structures), foreground (ground, plants, paths). " +
      "Every visible element drawn with clean distinct lines. NO texture, NO hatching, NO shading, NO fill. " +
      "Like a detailed panoramic illustration or travel sketch.",
  },
  {
    label: "decorative",
    style:
      "Elegant decorative landscape line art. Flowing artistic lines capturing the full scenic view. " +
      "Detailed silhouettes of all scene elements with decorative inner line work. " +
      "NO texture, NO hatching, NO shading, NO fill. " +
      "Like a fine art engraving of a landscape — beautiful and suitable for laser cutting.",
  },
];

function buildLandscapePrompt(userPrompt: string, variationIndex: number): string {
  const variation = LANDSCAPE_STYLE_VARIATIONS[variationIndex % LANDSCAPE_STYLE_VARIATIONS.length];
  return (
    `Clean black and white line art of a landscape scene: ${userPrompt}. ` +
    "Pure white background (#FFFFFF). " +
    "Bold thick black outlines (3-5px stroke width), no fill, no shading, no gradients. " +
    "High contrast: only pure black (#000000) lines on white. " +
    "IMPORTANT: Draw the ENTIRE scene — all elements visible in the landscape (sky, horizon, buildings, trees, mountains, water, foreground). " +
    "Do NOT focus on a single object — capture the full panoramic view. " +
    `${variation.style} ` +
    "CRITICAL: The entire scene MUST fit completely inside the square frame with white margin on all sides. " +
    "Do NOT let any element touch or go beyond the image border. Leave at least 5% white margin on every edge. " +
    "Square composition, all elements fully visible, nothing cropped. " +
    "No text, no watermarks, no grey tones."
  );
}

function buildLineArtPrompt(userPrompt: string, variationIndex: number): string {
  const variation = STYLE_VARIATIONS[variationIndex % STYLE_VARIATIONS.length];
  return (
    `Professional black and white line art illustration of ${userPrompt}. ` +
    "Pure white background (#FFFFFF). " +
    "Bold thick black outlines (3-5px stroke width), no fill, no shading, no gradients. " +
    "High contrast: only pure black (#000000) lines on white. " +
    "Draw the complete object centered in the frame, fully visible, not cropped. " +
    "Show depth and structure with clear internal lines. " +
    `${variation.style} ` +
    "Single centered object, complete, fully inside the frame, with generous white margin around it. " +
    "No text, no watermarks, no grey tones, no background elements."
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
    const { prompt, modifications, landscapeMode } = req.body as {
      prompt?: string;
      modifications?: string;
      landscapeMode?: boolean;
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
      const imagePrompt = landscapeMode
        ? buildLandscapePrompt(fullPrompt, idx)
        : buildLineArtPrompt(fullPrompt, idx);
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

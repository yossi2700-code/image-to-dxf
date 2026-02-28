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
 * Convert a PNG buffer to SVG using potrace.
 */
function pngToSvg(pngBuffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    potrace.trace(pngBuffer, {
      threshold: 180,
      turdSize: 8,
      alphaMax: 1,
      optCurve: true,
      optTolerance: 0.2,
    }, (err: Error | null, svg: string) => {
      if (err) reject(err);
      else resolve(svg);
    });
  });
}

/**
 * POST /api/ai-refine
 * Body: { imageUrl: string, instruction: string, originalPrompt?: string }
 * Returns: { imageUrl, svgPreview, dxfUrl, segmentCount, width, height, realWidth, realHeight }
 *
 * Takes an existing generated image and applies AI-powered refinements based on
 * natural language instructions (e.g. "make the stem thinner and add more leaves").
 */
router.post("/api/ai-refine", async (req, res) => {
  try {
    const { imageUrl, instruction, originalPrompt } = req.body as {
      imageUrl?: string;
      instruction?: string;
      originalPrompt?: string;
    };

    if (!imageUrl || !imageUrl.startsWith("http")) {
      return res.status(400).json({ error: "נא לספק קישור תמונה תקין" });
    }
    if (!instruction || instruction.trim().length < 3) {
      return res.status(400).json({ error: "נא לתאר את התיקון הרצוי" });
    }

    const rawIp =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      req.socket.remoteAddress ||
      "unknown";
    const ipAnon = anonymizeIp(rawIp);
    const appUser = getAppUserFromCookie(req.cookies);

    // Only registered users may use AI refine
    if (!appUser?.userId) {
      return res.status(401).json({
        error: "REGISTRATION_REQUIRED",
        message: "נדרשת הרשמה כדי להשתמש בתיקון AI",
      });
    }

    // Token check & deduction (ai_refine = 2 tokens)
    const tokenResult = await deductTokens(appUser.userId, "ai_refine", instruction);
    if (!tokenResult.success) {
      return res.status(402).json({
        error: "INSUFFICIENT_TOKENS",
        balance: tokenResult.balance,
        message: "נגמרו לך האסימונים. ליצירת קשר ורכישת אסימונים נוספים פנה לרובוטיקה וטכנולוגיה.",
        messageEn: "You have run out of tokens. To purchase more tokens, contact Robotics & Technology.",
      });
    }

    // Download the source image
    const imgResponse = await fetch(imageUrl);
    if (!imgResponse.ok) {
      return res.status(400).json({ error: "לא הצלחנו לטעון את התמונה המקורית" });
    }
    const sourceBuffer = Buffer.from(await imgResponse.arrayBuffer() as ArrayBuffer);

    // Convert source to PNG if needed (ensure it's a proper PNG for the API)
    const sourcePng = await sharp(sourceBuffer).png().toBuffer();

    // Build the refinement prompt
    const baseDescription = originalPrompt
      ? `This is a black and white line art of: ${originalPrompt}.`
      : "This is a black and white line art design.";

    const refinePrompt =
      `${baseDescription} ` +
      `Apply the following specific changes: ${instruction}. ` +
      "Keep the same overall style: clean black and white line art, bold outlines, no fill, no shading, no gradients. " +
      "Pure white background. Only black lines on white. " +
      "Maintain the same general composition but apply the requested modifications precisely. " +
      "The result must be suitable for laser cutting or CNC engraving.";

    // Use GPT-image-1 with image editing (inpainting/variation with instruction)
    // We upload the source image and ask for modifications
    const imageFile = new File([new Uint8Array(sourcePng)], "source.png", { type: "image/png" });

    const response = await openai.images.edit({
      model: "gpt-image-1",
      image: imageFile,
      prompt: refinePrompt,
      n: 1,
      size: "1024x1024",
      quality: "low",
    });

    const imageData = response.data?.[0];
    if (!imageData) {
      return res.status(500).json({ error: "לא הצלחנו לייצר תמונה מתוקנת" });
    }

    let rawBuffer: Buffer;
    if (imageData.b64_json) {
      rawBuffer = Buffer.from(imageData.b64_json, "base64");
    } else if (imageData.url) {
      const dlResponse = await fetch(imageData.url);
      if (!dlResponse.ok) throw new Error("שגיאה בהורדת התמונה המתוקנת");
      rawBuffer = Buffer.from(await dlResponse.arrayBuffer() as ArrayBuffer);
    } else {
      return res.status(500).json({ error: "לא התקבלה תמונה מה-AI" });
    }

    // Pre-process for potrace
    const processedBuffer = await sharp(rawBuffer)
      .grayscale()
      .threshold(200)
      .png()
      .toBuffer();

    // Vectorize with potrace
    const rawSvg = await pngToSvg(processedBuffer);

    // Convert to stroke-only for preview
    const svgContent = rawSvg
      .replace(/fill="[^"]*"/g, 'fill="none"')
      .replace(/fill:[^;"']*(;|(?="))/g, 'fill:none$1')
      .replace(/<path /g, '<path stroke="black" stroke-width="1.5" fill="none" ');
    const cleanSvg = svgContent.replace(
      /stroke="black" stroke-width="1.5" fill="none" ([^>]*?)fill="none"/g,
      'stroke="black" stroke-width="1.5" fill="none" $1'
    );

    // Convert SVG to DXF
    const { dxf, segmentCount, width, height, realWidth, realHeight } = svgToDxf(rawSvg);

    // Upload refined PNG to S3
    const imgKey = `ai-refined/${nanoid()}.png`;
    const { url: refinedImageUrl } = await storagePut(imgKey, rawBuffer, "image/png");

    // Upload DXF to S3
    const safeInstruction = instruction
      .trim()
      .replace(/[^\u0590-\u05FF\w\s]/g, "")
      .replace(/\s+/g, "_")
      .slice(0, 30);
    const dxfFilename = `refined_${safeInstruction || "design"}.dxf`;
    const dxfKey = `dxf-refined/${nanoid()}-${dxfFilename}`;
    const { url: dxfUrl } = await storagePut(
      dxfKey,
      Buffer.from(dxf, "utf-8"),
      "application/dxf"
    );

    // Record usage
    await recordUserAction({
      appUserId: appUser.userId,
      actionType: "ai_generate",
      dxfUrl,
      segmentCount,
      imageUrl: refinedImageUrl,
      description: instruction.slice(0, 100),
    });

    await logUsageEvent({
      type: "ai_generate",
      ipAnon,
      appUserId: appUser.userId,
    });

    return res.json({
      imageUrl: refinedImageUrl,
      svgPreview: cleanSvg,
      dxfUrl,
      dxfFilename,
      segmentCount,
      width,
      height,
      realWidth,
      realHeight,
    });
  } catch (err: unknown) {
    console.error("[AI Refine] Error:", err);
    const message = err instanceof Error ? err.message : "שגיאה לא ידועה";
    return res.status(500).json({ error: "שגיאה בתיקון AI", details: message });
  }
});

export default router;

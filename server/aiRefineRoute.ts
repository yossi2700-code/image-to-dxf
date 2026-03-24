import { Router } from "express";
import { storagePut } from "./storage";
import { nanoid } from "nanoid";
import { logUsageEvent, anonymizeIp } from "./usageDb";
import { getAppUserFromCookie } from "./appAuth";
import { recordUserAction } from "./userActionsDb";
import { checkUsageLimit } from "./usageLimits";
import { deductTokens } from "./tokenService";
import OpenAI from "openai";
import { invokeLLM } from "./_core/llm";
import { svgToDxf } from "./svgToDxf";
import { cleanSvgForPreview } from "./svgClean";
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
          message: "חשבונך חסום. לפרטים פנה לתמיכה.",
          messageEn: "Your account has been blocked. Please contact support.",
        });
      }
    }

    // ── Pre-flight: validate instruction is a modification, not a new creation ──
    // Use a fast LLM call to detect if the user is trying to generate a completely
    // different object instead of refining the existing one. No tokens deducted here.
    if (originalPrompt) {
      try {
        const validationResp = await invokeLLM({
          messages: [
            {
              role: "system",
              content:
                "You are a strict validator. Answer ONLY with YES or NO. " +
                "YES = the instruction is a valid modification/refinement of the existing design (e.g. make it thinner, add details, change style, simplify, add shadow, rotate, resize, etc.). " +
                "NO = the instruction asks to draw/create a completely different object or subject that has nothing to do with the original (e.g. original is a table, instruction says 'draw a bicycle'). " +
                "If in doubt, answer YES.",
            },
            {
              role: "user",
              content: `Original design: "${originalPrompt}". Instruction: "${instruction}". Is this a valid modification of the original design?`,
            },
          ],
        });
        const validationResult = (
          (validationResp as { choices?: Array<{ message?: { content?: string } }> })
            ?.choices?.[0]?.message?.content?.trim() || "YES"
        ).toUpperCase();
        if (validationResult.startsWith("NO")) {
          return res.status(400).json({
            error: "INVALID_REFINE_INSTRUCTION",
            message: `התיקון חייב להתייחס לעיצוב הנוכחי (${originalPrompt}). לא ניתן ליצור אובייקט חדש לגמרי בתיקון — יש להשתמש ב"צור חדש" במקום.`,
            messageEn: `The refinement must relate to the current design (${originalPrompt}). You cannot create a completely new object via refinement — please use "Create new" instead.`,
          });
        }
      } catch (validationErr) {
        // If validation fails, allow the request to proceed (fail open)
        console.warn("[aiRefineRoute] Instruction validation failed, proceeding:", validationErr);
      }
    }

    // Token check only — deduction happens after successful AI processing
    const tokenResult = await deductTokens(appUser.userId, "ai_refine", { checkOnly: true });
    if (!tokenResult.success) {
      return res.status(402).json({
        error: "INSUFFICIENT_TOKENS",
        balance: tokenResult.balance,
        message: "נגמרו לך האסימונים. יש לטעון אסימונים להמשך שימוש.",
        messageEn: "You have run out of tokens. Please purchase more tokens to continue.",
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
      "CRITICAL RULE: You MUST keep the SAME MAIN SUBJECT/OBJECT from the original image. " +
      "Do NOT replace, swap, or remove the main subject. Only apply modifications TO the existing subject. " +
      "If the instruction asks to draw a completely different object (e.g. 'draw a bicycle' when the original is a table), " +
      "IGNORE that and instead apply the instruction as a style/detail modification to the existing subject. " +
      `Apply the following specific changes to the existing design: ${instruction}. ` +
      "Keep the same overall style: clean black and white line art, bold outlines, no fill, no shading, no gradients. " +
      "Pure white background. Only black lines on white. " +
      "Maintain the same general composition and main subject but apply the requested modifications precisely. " +
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
      quality: "medium",
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
    const cleanSvg = cleanSvgForPreview(rawSvg);

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

    // Deduct tokens NOW — only after successful AI processing and DXF generation
    await deductTokens(appUser.userId, "ai_refine", instruction);

    // Record usage
    await recordUserAction({
      appUserId: appUser.userId,
      actionType: "ai_generate",
      dxfUrl,
      segmentCount,
      imageUrl: refinedImageUrl,
      description: instruction.slice(0, 100),
      feature: "ai_refine",
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
    const msgLower = message.toLowerCase();
    const isContentPolicy = msgLower.includes("safety") || msgLower.includes("content_policy") ||
      msgLower.includes("content policy") || msgLower.includes("rejected") ||
      msgLower.includes("moderation") || msgLower.includes("inappropriate") ||
      msgLower.includes("violat");
    if (isContentPolicy) {
      return res.status(422).json({
        error: "CONTENT_POLICY",
        message: "הבקשה נדחתה על ידי מסנן התוכן של AI. נסה תיאור אחר — הימנע מתוכן פוגעני, דמויות מוגנות בזכויות יוצרים, או תוכן לא הולם.",
        messageEn: "Request rejected by AI content filter. Try a different description — avoid offensive content, copyrighted characters, or inappropriate content.",
      });
    }
    return res.status(500).json({ error: "שגיאה בתיקון AI", details: message });
  }
});

/**
 * POST /api/ai-suggestions
 * Generate dynamic, context-aware improvement suggestions based on the original prompt.
 * Body: { originalPrompt: string, lang: 'he' | 'en' }
 * Returns: { suggestions: string[] }
 * No auth required — lightweight, no token cost.
 */
router.post("/api/ai-suggestions", async (req, res) => {
  const { originalPrompt, lang } = req.body as { originalPrompt?: string; lang?: string };
  const isHe = lang === "he";

  if (!originalPrompt || originalPrompt.trim().length < 2) {
    return res.json({ suggestions: [] });
  }

  try {
    const systemPrompt = isHe
      ? "אתה עוזר יצירתי שמסייע למשתמשים לשפר עיצובי קו לחריטת CNC/לייזר. " +
        "בהינתן תיאור של העיצוב, צור 3 הצעות שיפור קצרות וספציפיות לאותו עיצוב בדיוק. " +
        "כל הצעה: 2-5 מילים בעברית, ספציפית לנושא שהוזן. " +
        "פלט JSON בלבד: {\"suggestions\": [\"...\", \"...\", \"...\"]}"
      : "You are a creative assistant helping users refine line art designs for CNC/laser engraving. " +
        "Given the design description, generate 3 short specific improvement suggestions for that exact design. " +
        "Each suggestion: 2-5 words in English, specific to the subject entered. " +
        "Output JSON only: {\"suggestions\": [\"...\", \"...\", \"...\"]}"

    const userPrompt = isHe
      ? `צור 3 הצעות שיפור לעיצוב: "${originalPrompt.trim()}"`
      : `Generate 3 improvement suggestions for this design: "${originalPrompt.trim()}"`;

    const response = await invokeLLM({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "suggestions",
          strict: true,
          schema: {
            type: "object",
            properties: {
              suggestions: { type: "array", items: { type: "string" } },
            },
            required: ["suggestions"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = (response as { choices?: Array<{ message?: { content?: string } }> })
      ?.choices?.[0]?.message?.content;
    if (content) {
      const parsed = JSON.parse(content) as { suggestions: string[] };
      if (Array.isArray(parsed.suggestions)) {
        return res.json({ suggestions: parsed.suggestions.slice(0, 3) });
      }
    }
  } catch (e) {
    console.warn("[ai-suggestions] Failed:", e);
  }

  return res.json({ suggestions: [] });
});

export default router;

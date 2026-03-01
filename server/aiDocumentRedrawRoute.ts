/**
 * AI Document Redraw Route — Redraws a photo/document/sketch as clean laser-engraving lines.
 *
 * POST /api/ai-document-redraw
 *   User uploads a photo (sketch, document, sign, memorial stone, etc.)
 *   → GPT-4o vision analyzes the image and extracts a faithful detailed description
 *   → gpt-image-1 redraws it as clean B&W line art, maximally faithful to the original
 *   Returns: { image: { imageUrl, svgPreview, dxfUrl, ... }, objectDescription }
 *
 * POST /api/ai-document-redraw/refine
 *   User requests a correction on the generated result
 *   → gpt-image-1 edits the image based on the correction instruction
 *   Returns: { image: { imageUrl, svgPreview, dxfUrl, ... } }
 */
import { Router } from "express";
import multer from "multer";
import sharp from "sharp";
import { storagePut } from "./storage";
import { nanoid } from "nanoid";
import { logUsageEvent, anonymizeIp } from "./usageDb";
import { getAppUserFromCookie } from "./appAuth";
import { recordUserAction } from "./userActionsDb";
import { deductTokens } from "./tokenService";
import { invokeLLM } from "./_core/llm";
import OpenAI from "openai";
import { svgToDxf } from "./svgToDxf";
import potrace from "potrace";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 16 * 1024 * 1024 } });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY ?? "" });

/** Convert description to safe filename — capped at 15 chars for clean download names */
function buildFilename(description: string): string {
  const words = description
    .replace(/[^\u0590-\u05FFa-zA-Z0-9\s]/g, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  let name = "";
  for (const w of words) {
    const next = name ? `${name}_${w}` : w;
    if (next.length > 15) break;
    name = next;
  }
  return (name || "doc_redraw").slice(0, 15);
}

/** Convert a PNG buffer to SVG using potrace. */
function pngToSvg(pngBuffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    potrace.trace(
      pngBuffer,
      {
        threshold: 180,
        turdSize: 8,
        alphaMax: 1,
        optCurve: true,
        optTolerance: 0.2,
      },
      (err: Error | null, svg: string) => {
        if (err) reject(err);
        else resolve(svg);
      }
    );
  });
}

/**
 * Process a raw PNG buffer through potrace → SVG → DXF pipeline.
 */
async function processImageToDxf(rawBuffer: Buffer, baseFilename: string, prefix: string) {
  // Pre-process: grayscale + threshold for potrace
  const processedBuffer = await sharp(rawBuffer)
    .grayscale()
    .threshold(200)
    .png()
    .toBuffer();

  // Vectorize with potrace → smooth SVG Bezier curves
  const rawSvg = await pngToSvg(processedBuffer);

  // Convert filled paths to stroke-only for SVG preview
  const svgContent = rawSvg
    .replace(/fill="[^"]*"/g, 'fill="none"')
    .replace(/fill:[^;"']*(;|(?="))/g, "fill:none$1")
    .replace(/<path /g, '<path stroke="black" stroke-width="1.5" fill="none" ');
  const cleanSvg = svgContent.replace(
    /stroke="black" stroke-width="1.5" fill="none" ([^>]*?)fill="none"/g,
    'stroke="black" stroke-width="1.5" fill="none" $1'
  );

  // Convert SVG to DXF
  const { dxf, segmentCount, width, height, realWidth, realHeight } = svgToDxf(rawSvg);

  // Upload original PNG to S3
  const imgKey = `${prefix}-generated/${nanoid()}.png`;
  const { url: imageUrl } = await storagePut(imgKey, rawBuffer, "image/png");

  // Upload DXF to S3
  const dxfFilename = `${baseFilename}.dxf`;
  const dxfKey = `${prefix}-dxf/${nanoid()}-${dxfFilename}`;
  const { url: dxfUrl } = await storagePut(dxfKey, Buffer.from(dxf, "utf-8"), "application/dxf");

  return { imageUrl, svgPreview: cleanSvg, dxfUrl, dxfFilename, segmentCount, width, height, realWidth, realHeight };
}

// ─── POST /api/ai-document-redraw ─────────────────────────────────────────────
router.post(
  "/api/ai-document-redraw",
  upload.single("image"),
  async (req, res) => {
    try {
      // ── Auth check ────────────────────────────────────────────────────────────
      const appUser = getAppUserFromCookie(req.cookies);
      if (!appUser) {
        return res.status(401).json({
          error: "UNAUTHORIZED",
          message: "יש להתחבר כדי להשתמש בעריכת AI מצילום",
          messageEn: "Please log in to use AI Document Redraw",
        });
      }

      // ── Block check ───────────────────────────────────────────────────────────
      const { getDb } = await import("./db");
      const { appUsers } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (db) {
        const [userRow] = await db
          .select({ isBlocked: appUsers.isBlocked })
          .from(appUsers)
          .where(eq(appUsers.id, appUser.userId))
          .limit(1);
        if (userRow?.isBlocked) {
          return res.status(403).json({
            error: "USER_BLOCKED",
            message: "חשבונך חסום. לפרטים פנה לרובוטיקה וטכנולוגיה.",
            messageEn: "Your account has been blocked. Please contact Robotics & Technology.",
          });
        }
      }

      // ── Token check & deduction (same cost as ai_trace = 5 tokens) ────────────
      const tokenResult = await deductTokens(appUser.userId, "ai_trace");
      if (!tokenResult.success) {
        return res.status(402).json({
          error: "INSUFFICIENT_TOKENS",
          balance: tokenResult.balance,
          message: "נגמרו לך האסימונים. ליצירת קשר ורכישת אסימונים נוספים פנה לרובוטיקה וטכנולוגיה.",
          messageEn: "You have run out of tokens. To purchase more tokens, contact Robotics & Technology.",
        });
      }

      // ── Get image buffer ──────────────────────────────────────────────────────
      let imageBuffer: Buffer;
      if (req.file) {
        imageBuffer = req.file.buffer;
      } else if (req.body?.imageUrl) {
        const response = await fetch(req.body.imageUrl);
        imageBuffer = Buffer.from(await response.arrayBuffer());
      } else {
        return res.status(400).json({ error: "NO_IMAGE", message: "לא סופקה תמונה" });
      }

      // ── Resize for LLM analysis (high detail for faithful redraw) ─────────────
      const resized = await sharp(imageBuffer)
        .resize(768, 768, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 90 })
        .toBuffer();
      const imageBase64 = resized.toString("base64");
      const userDesc = (req.body?.description || "").trim();

      // ── Step A: LLM analyzes image → finds ONLY illustrations/decorations (no text, no background) ──
      console.log("[aiDocumentRedraw] Analyzing image for ALL decorative elements...");
      const llmResponse = await invokeLLM({
        messages: [
          {
            role: "system",
            content:
              "You are a precise graphic analyst for laser engraving reproduction. " +
              "Your ONLY job: describe ALL non-text decorative graphic elements in the image so they can be redrawn exactly. " +
              "\n\nCRITICAL RULES:\n" +
              "1. SCAN THE ENTIRE IMAGE — top, bottom, left, right, center, corners. Do NOT miss any element.\n" +
              "2. Describe EVERY decorative element you see: flowers, leaves, vines, birds, geometric ornaments, corner decorations, border patterns, symbols, portraits, animals, scrollwork, etc.\n" +
              "3. For EACH element specify: its position in the composition (top-left corner, center, surrounding border, etc.), its shape, size relative to others, and style.\n" +
              "4. If there are MULTIPLE FLOWERS or repeated motifs, describe ALL of them and their arrangement (e.g., '4 roses in the corners, 2 tulips on the sides, central sunflower').\n" +
              "5. If there is a BORDER or FRAME with decorative patterns, describe the complete border pattern.\n" +
              "6. NEVER describe text, letters, numbers, or plain background material.\n" +
              "7. If there are NO illustrations at all (only text and plain background), respond with exactly: NO_ILLUSTRATIONS\n" +
              "8. Output a structured description: start with 'COMPOSITION OVERVIEW:' then list each element with its position.",
          },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${imageBase64}`,
                  detail: "high",
                },
              },
              {
                type: "text",
                text: userDesc
                  ? `Scan the ENTIRE image and describe ALL decorative graphic elements (flowers, ornaments, borders, symbols, etc.) with their exact positions and arrangement. Do NOT miss any element — check every corner and edge. Do NOT describe text or background. Additional context from user: ${userDesc}`
                  : "Scan the ENTIRE image carefully. Describe ALL decorative graphic elements — check every corner, every edge, every part of the image. List each element with its position (e.g., 'top-left corner: rose with 5 petals and 3 leaves', 'surrounding border: vine pattern with small flowers', 'center: Star of David'). If there are multiple flowers or ornaments, describe ALL of them. Do NOT describe text, letters, or background.",
              },
            ],
          },
        ],
      });
      const llmRaw =
        (llmResponse as { choices?: Array<{ message?: { content?: string } }> })
          ?.choices?.[0]?.message?.content?.trim() || "";

      // If no illustrations found, return a clear error to the user
      if (!llmRaw || llmRaw.toUpperCase().includes("NO_ILLUSTRATIONS")) {
        return res.status(422).json({
          error: "NO_ILLUSTRATIONS_FOUND",
          message: "לא נמצאו איורים או עיטורים בתמונה. נסה תמונה עם פרחים, סמלים, עיטורים או ציורים.",
          messageEn: "No illustrations or decorations were found in the image. Try a photo with flowers, symbols, ornaments, or artwork.",
        });
      }

      const objectDescription = llmRaw;
      console.log("[aiDocumentRedraw] Illustrations found:", objectDescription.substring(0, 200));
      const baseFilename = buildFilename(userDesc || objectDescription);

      // ── Step B: Draw ONLY the extracted illustrations with gpt-image-1 ──────────────────────────
      const imagePrompt =
        `Professional laser engraving line art. Reproduce EXACTLY this complete composition: ${objectDescription}. ` +
        "\n\nCRITICAL REQUIREMENTS:\n" +
        "1. REPRODUCE THE COMPLETE COMPOSITION — draw EVERY element described, in its described position. If there are 4 corner ornaments, draw all 4. If there is a surrounding border, draw the full border. If there are multiple flowers, draw all of them.\n" +
        "2. MAINTAIN SPATIAL ARRANGEMENT — place each element exactly where described (corners, center, borders, sides).\n" +
        "3. NO text, NO letters, NO words, NO numbers — only the graphic/decorative elements.\n" +
        "4. Pure white background (#FFFFFF). Only pure black (#000000) lines. NO grey tones, NO fills, NO gradients, NO shading.\n" +
        "5. Clean, precise, thin lines suitable for laser engraving.\n" +
        "6. The complete composition MUST fit entirely inside the frame with 10% white margin on every edge — nothing cropped.\n" +
        "7. Style: professional engraving quality line art — clean outlines with precise inner detail lines.\n" +
        "8. Scale: make the composition fill the available space proportionally — not too small, not too large.";

      const response = await openai.images.generate({
        model: "gpt-image-1",
        prompt: imagePrompt,
        n: 1,
        size: "1024x1024",
        quality: "high",
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

      // ── Step C: Vectorize ─────────────────────────────────────────────────────
      const result = await processImageToDxf(rawBuffer, baseFilename, "ai-document-redraw");

      // ── Log usage ─────────────────────────────────────────────────────────────
      const rawIp =
        (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
        req.socket.remoteAddress ||
        "";
      const ipAnon = anonymizeIp(rawIp);
      await logUsageEvent({
        type: "ai_generate",
        segmentCount: result.segmentCount,
        ipAnon: ipAnon,
        appUserId: appUser.userId,
      });

      const groupId = `doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      await recordUserAction({
        appUserId: appUser.userId,
        actionType: "ai_generate",
        description: objectDescription.slice(0, 200),
        segmentCount: result.segmentCount,
        dxfUrl: result.dxfUrl,
        imageUrl: result.imageUrl,
        svgPreview: result.svgPreview,
        groupId,
        variationLabel: "document-redraw",
      });

      return res.json({
        success: true,
        image: result,
        objectDescription,
      });
    } catch (err: unknown) {
      console.error("[aiDocumentRedraw] Error:", err);
      const message = err instanceof Error ? err.message : "Unknown error";
      if (message.includes("429") || message.includes("quota") || message.includes("billing")) {
        return res.status(429).json({
          error: "OPENAI_QUOTA",
          message: "שגיאת מכסה ב-AI. נסה שוב מאוחר יותר.",
          messageEn: "AI quota error. Please try again later.",
        });
      }
      return res.status(500).json({
        error: "INTERNAL_ERROR",
        message: `שגיאה פנימית: ${message}`,
        messageEn: `Internal error: ${message}`,
      });
    }
  }
);

// ─── POST /api/ai-document-redraw/refine ──────────────────────────────────────
// Takes an existing generated image + correction instruction → redraws with the correction
router.post(
  "/api/ai-document-redraw/refine",
  async (req, res) => {
    try {
      const appUser = getAppUserFromCookie(req.cookies);
      if (!appUser) {
        return res.status(401).json({
          error: "UNAUTHORIZED",
          message: "יש להתחבר כדי להשתמש בתיקון AI",
          messageEn: "Please log in to use AI refinement",
        });
      }

      const { imageUrl, instruction, objectDescription: origDesc } = req.body as {
        imageUrl?: string;
        instruction?: string;
        objectDescription?: string;
      };

      if (!imageUrl || !imageUrl.startsWith("http")) {
        return res.status(400).json({ error: "NO_IMAGE_URL", message: "לא סופק קישור תמונה" });
      }
      if (!instruction || instruction.trim().length < 3) {
        return res.status(400).json({ error: "NO_INSTRUCTION", message: "נא לתאר את התיקון הרצוי" });
      }

      // ── Block check ───────────────────────────────────────────────────────────
      const { getDb } = await import("./db");
      const { appUsers } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (db) {
        const [userRow] = await db
          .select({ isBlocked: appUsers.isBlocked })
          .from(appUsers)
          .where(eq(appUsers.id, appUser.userId))
          .limit(1);
        if (userRow?.isBlocked) {
          return res.status(403).json({
            error: "USER_BLOCKED",
            message: "חשבונך חסום. לפרטים פנה לרובוטיקה וטכנולוגיה.",
          });
        }
      }

      // ── Token check & deduction (ai_refine = 2 tokens) ───────────────────────
      const tokenResult = await deductTokens(appUser.userId, "ai_refine", instruction);
      if (!tokenResult.success) {
        return res.status(402).json({
          error: "INSUFFICIENT_TOKENS",
          balance: tokenResult.balance,
          message: "נגמרו לך האסימונים. ליצירת קשר ורכישת אסימונים נוספים פנה לרובוטיקה וטכנולוגיה.",
        });
      }

      // ── Download source image ─────────────────────────────────────────────────
      const imgResponse = await fetch(imageUrl);
      if (!imgResponse.ok) throw new Error("שגיאה בהורדת התמונה");
      const sourceBuffer = Buffer.from(await imgResponse.arrayBuffer());

      // ── Refine with gpt-image-1 (image editing) ───────────────────────────────
      const refinePrompt =
        `Apply this correction to the line art: ${instruction.trim()}. ` +
        (origDesc ? `Original design: ${origDesc}. ` : "") +
        "Keep all other elements exactly as they are. " +
        "Maintain the same clean black-and-white line art style. " +
        "Pure black lines on white background. No grey tones, no gradients. " +
        "The complete design must fit inside the frame with 5% margin.";

      const response = await openai.images.edit({
        model: "gpt-image-1",
        image: new File([sourceBuffer], "source.png", { type: "image/png" }),
        prompt: refinePrompt,
        n: 1,
        size: "1024x1024",
      });

      const imageData = response.data?.[0];
      if (!imageData) throw new Error("לא הצלחנו לייצר תמונה");

      let rawBuffer: Buffer;
      if (imageData.b64_json) {
        rawBuffer = Buffer.from(imageData.b64_json, "base64");
      } else if (imageData.url) {
        const dlResponse = await fetch(imageData.url);
        if (!dlResponse.ok) throw new Error("שגיאה בהורדת התמונה שנוצרה");
        rawBuffer = Buffer.from(await dlResponse.arrayBuffer());
      } else {
        throw new Error("לא התקבלה תמונה מה-AI");
      }

      // ── Vectorize ─────────────────────────────────────────────────────────────
      const baseFilename = buildFilename(origDesc || instruction);
      const result = await processImageToDxf(rawBuffer, baseFilename, "ai-document-refine");

      // ── Log usage ─────────────────────────────────────────────────────────────
      const rawIp =
        (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
        req.socket.remoteAddress ||
        "";
      const ipAnon = anonymizeIp(rawIp);
      await logUsageEvent({
        type: "ai_generate",
        segmentCount: result.segmentCount,
        ipAnon: ipAnon,
        appUserId: appUser.userId,
      });

      await recordUserAction({
        appUserId: appUser.userId,
        actionType: "ai_generate",
        description: `תיקון: ${instruction.slice(0, 100)}`,
        segmentCount: result.segmentCount,
        dxfUrl: result.dxfUrl,
        imageUrl: result.imageUrl,
        svgPreview: result.svgPreview,
      });

      return res.json({ success: true, image: result });
    } catch (err: unknown) {
      console.error("[aiDocumentRedraw/refine] Error:", err);
      const message = err instanceof Error ? err.message : "Unknown error";
      return res.status(500).json({
        error: "INTERNAL_ERROR",
        message: `שגיאת תיקון: ${message}`,
        messageEn: `Refinement error: ${message}`,
      });
    }
  }
);

export default router;

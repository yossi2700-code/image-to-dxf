import { Router } from "express";
import { storagePut } from "./storage";
import { nanoid } from "nanoid";
import { logUsageEvent, anonymizeIp } from "./usageDb";
import { getAppUserFromCookie } from "./appAuth";
import { recordUserAction } from "./userActionsDb";
import { deductTokens } from "./tokenService";
import { createJob, getJob, updateJob, cancelJob } from "./jobStore";
import OpenAI from "openai";
import { svgToDxf } from "./svgToDxf";
import { cleanSvgForPreview } from "./svgClean";
import potrace from "potrace";
import sharp from "sharp";
import { notifyOwner } from "./_core/notification";

const router = Router();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY ?? "" });

/**
 * Three distinct style variations for the same subject.
 */
const STYLE_VARIATIONS = [
  {
    label: "simple",
    style:
      "VARIATION 1 — ARTISTIC CLEAN OUTLINE: Draw a professional, elegant line art illustration. " +
      "Bold confident outer contour with 5-8 key structural lines that define the form. " +
      "The style should look like a skilled artist's clean sketch — NOT a child's coloring book. " +
      "Think of a high-end brand logo or a professional product illustration. " +
      "Minimal but sophisticated. NO texture, NO hatching, NO shading, NO fill. " +
      "PRESERVE the exact shape and proportions. Pure black lines on white background only. " +
      "CRITICAL FRAMING: The object must occupy NO MORE than 65% of the image width AND height. " +
      "Leave at least 17% white margin on EVERY side (left, right, top, bottom). " +
      "The object must be FULLY VISIBLE — nothing cut off, nothing touching or near the border.",
  },
  {
    label: "detailed",
    style:
      "VARIATION 2 — SHARP PRECISE MODERATE: Draw the complete object with all main structural features " +
      "and key details, but keep the line count moderate — not too sparse, not too dense. " +
      "Bold outer contour with clean inner lines showing the main components and surfaces. " +
      "Like a professional product catalog illustration. " +
      "NO texture, NO hatching, NO shading, NO fill. PRESERVE the exact shape. Clean sharp lines only. " +
      "CRITICAL FRAMING: The object must occupy NO MORE than 65% of the image width AND height. " +
      "Leave at least 17% white margin on EVERY side (left, right, top, bottom). " +
      "The object must be FULLY VISIBLE — nothing cut off, nothing touching or near the border.",
  },
  {
    label: "complex",
    style:
      "VARIATION 3 — MODERATELY COMPLEX DETAILED: Draw the complete object with slightly more detail " +
      "than variation 2 — add secondary features and subtle structural elements. " +
      "A bit richer and more elaborate, but still clean and controlled — not overwhelming. " +
      "Like a detailed technical product illustration with extra refinement. " +
      "NO hatching, NO shading, NO fill, NO crosshatching, NO texture fills. PRESERVE the exact shape. All lines clean and precise. " +
      "CRITICAL FRAMING: The object must occupy NO MORE than 65% of the image width AND height. " +
      "Leave at least 17% white margin on EVERY side (left, right, top, bottom). " +
      "The object must be FULLY VISIBLE — nothing cut off, nothing touching or near the border.",
  },
];

const LANDSCAPE_STYLE_VARIATIONS = [
  {
    label: "simple",
    style:
      "Simple clean landscape outline. Bold horizon line, clear silhouettes of all elements (buildings, trees, mountains, sky). " +
      "Capture the full panoramic scene — foreground, midground, background. " +
      "NO texture, NO hatching, NO shading, NO fill. Clean minimal lines only. " +
      "CRITICAL FRAMING: The entire scene must fit within 75% of the image. Leave at least 10% white margin on every edge.",
  },
  {
    label: "detailed",
    style:
      "Detailed landscape line art. Clear horizon with rich detail in all layers: sky elements (clouds, sun), " +
      "background (mountains, distant buildings), midground (trees, structures), foreground (ground, plants, paths). " +
      "Every visible element drawn with clean distinct lines. NO texture, NO hatching, NO shading, NO fill. " +
      "CRITICAL FRAMING: The entire scene must fit within 75% of the image. Leave at least 10% white margin on every edge.",
  },
  {
    label: "decorative",
    style:
      "Elegant decorative landscape line art. Flowing artistic lines capturing the full scenic view. " +
      "Detailed silhouettes of all scene elements with decorative inner line work. " +
      "NO texture, NO hatching, NO shading, NO fill. " +
      "CRITICAL FRAMING: The entire scene must fit within 75% of the image. Leave at least 10% white margin on every edge.",
  },
];

function buildLandscapePrompt(userPrompt: string, variationIndex: number): string {
  const variation = LANDSCAPE_STYLE_VARIATIONS[variationIndex % LANDSCAPE_STYLE_VARIATIONS.length];
  return (
    // Lead with the absolute no-text rule
    "ABSOLUTE RULE \u2014 NO TEXT, NO LETTERS, NO WORDS, NO NUMBERS, NO LABELS, NO CAPTIONS, NO WATERMARKS ANYWHERE IN THE IMAGE. " +
    "The user's description is WHAT TO DRAW, not what to write. Do NOT render any part of the description as text. " +
    `Clean black and white line art of a landscape scene: ${userPrompt}. ` +
    "Pure white background (#FFFFFF). " +
    "Bold thick black outlines (3-5px stroke width), no fill, no shading, no gradients. " +
    "High contrast: only pure black (#000000) lines on white. " +
    "IMPORTANT: Draw the ENTIRE scene \u2014 all elements visible in the landscape (sky, horizon, buildings, trees, mountains, water, foreground). " +
    "Do NOT focus on a single object \u2014 capture the full panoramic view. " +
    `${variation.style} ` +
    "CRITICAL FRAMING: The entire scene MUST fit completely inside the square frame. " +
    "Scale the scene so it occupies at most 80% of the canvas. " +
    "Leave at least 10% white margin on EVERY edge (top, bottom, left, right). " +
    "NOTHING must touch or go beyond the image border. All elements fully visible, nothing cropped. " +
    "FINAL REMINDER: Zero text, zero letters, zero numbers anywhere. Pure illustration only."
  );
}

/**
 * Detect if the user prompt contains quoted text or explicit text-to-render instructions.
 * e.g. 'logo with text "Hello"', 'כתוב: שלום', 'with the words ABC'
 * Returns the exact text strings that should appear in the image.
 */
function detectExactTextInPrompt(userPrompt: string): string[] {
  const results: string[] = [];
  // Match quoted strings: "...", '...', «...», or Hebrew-style quotes
  let m: RegExpExecArray | null;
  const quoteRe = /["'«»“”‘’]([^"'«»“”‘’]{1,80})["'«»“”‘’]/g;
  while ((m = quoteRe.exec(userPrompt)) !== null) results.push(m[1].trim());
  // Match explicit text instructions: "כתוב:", "הכיתוב:", "with text:", "text:", "the words:"
  const labelMatch = userPrompt.match(/(?:כתוב|הכיתוב|הטקסט|with text|text:|the words?|label)[:\s]+([\u0590-\u05FF\w][^,\.\n]{1,80})/i);
  if (labelMatch) results.push(labelMatch[1].trim());
  // Deduplicate
  const seen = new Set<string>();
  return results.filter(t => { if (seen.has(t) || !t) return false; seen.add(t); return true; });
}

/**
 * Detect if the user prompt contains a scene/context keyword alongside an object.
 * e.g. "bluey landscape", "cat in forest", "dog on beach"
 */
function detectObjectAndScene(userPrompt: string): { hasScene: boolean; sceneKeywords: string } {
  const scenePatterns = /\b(landscape|nof|nof teva|nature|forest|beach|mountain|city|jungle|garden|park|ocean|sea|desert|space|sky|field|meadow|river|lake|snow|winter|summer|sunset|sunrise|night|rain|storm|countryside|village|street|urban|indoor|outdoor|background|scene|environment|setting|נוף|יער|חוף|הר|עיר|גן|פארק|ים|מדבר|חלל|שמים|שדה|נהר|אגם|שלג|חורף|קיץ|שקיעה|זריחה|לילה|גשם|כפר|רחוב)\b/i;
  const match = userPrompt.match(scenePatterns);
  return { hasScene: !!match, sceneKeywords: match ? match[0] : "" };
}

function buildLineArtPrompt(userPrompt: string, variationIndex: number): string {
  const variation = STYLE_VARIATIONS[variationIndex % STYLE_VARIATIONS.length];
  const { hasScene } = detectObjectAndScene(userPrompt);
  const exactTexts = detectExactTextInPrompt(userPrompt);
  const hasExactText = exactTexts.length > 0;

  // Build text instruction: if user specified exact text, enforce it precisely
  const textRule = hasExactText
    ? `CRITICAL TEXT RULE — The illustration MUST include the following text written EXACTLY, letter by letter, with NO spelling errors, NO missing letters, NO added letters: ${exactTexts.map(t => `"${t}"`).join(', ')}. ` +
      `Render this text clearly and legibly in the image. The text must match EXACTLY what is specified above.`
    : `ABSOLUTE RULE — NO TEXT, NO LETTERS, NO WORDS, NO NUMBERS, NO LABELS, NO CAPTIONS, NO WATERMARKS ANYWHERE IN THE IMAGE. ` +
      `The user's description is WHAT TO DRAW, not what to write. Do NOT render any part of the description as text.`;

  // If user prompt contains both an object AND a scene (e.g. "bluey landscape"),
  // use the landscape-style prompt to render the object within the scene
  if (hasScene) {
    return (
      `${textRule} ` +
      `Professional black and white line art illustration: ${userPrompt}. ` +
      "IMPORTANT: If the prompt mentions a specific character, creature, or object (e.g. Bluey, a cat, a dog), " +
      "that character/object MUST be the MAIN FOCUS of the illustration, prominently placed in the scene. " +
      "Draw the character/object INSIDE the described scene/environment. " +
      "Pure white background (#FFFFFF). Bold thick black outlines, no fill, no shading, no gradients. " +
      "High contrast: only pure black (#000000) lines on white. " +
      `${variation.style} ` +
      "CRITICAL FRAMING: The entire scene with the character must fit completely inside the frame. " +
      "Leave at least 10% white margin on every edge. Nothing cropped."
    );
  }

  return (
    `${textRule} ` +
    `Professional black and white line art illustration of ${userPrompt}. ` +
    "Pure white background (#FFFFFF). " +
    "Bold thick black outlines (3-5px stroke width), no fill, no shading, no gradients. " +
    "High contrast: only pure black (#000000) lines on white. " +
    "CRITICAL FRAMING RULE: The object MUST be scaled small enough to fit entirely within the CENTER of the image. " +
    "The object must occupy NO MORE than 65% of the image width AND height. " +
    "There MUST be at least 17% white empty space on EVERY side (top, bottom, left, right). " +
    "The object must be FULLY VISIBLE \u2014 nothing cut off, nothing touching or near the border. " +
    "Show depth and structure with clear internal lines. " +
    `${variation.style}`
  );
}

/** Simple Hebrew → Latin transliteration map for common words */
const HE_TO_EN_GEN: Record<string, string> = {
  "עכבר": "mouse", "מחשב": "computer", "כלב": "dog", "חתול": "cat",
  "ציפור": "bird", "דג": "fish", "פרח": "flower", "עץ": "tree",
  "בית": "house", "מכונית": "car", "אופנוע": "motorcycle", "אופניים": "bicycle",
  "לב": "heart", "כוכב": "star", "ירח": "moon", "שמש": "sun",
  "אריה": "lion", "נמר": "tiger", "דוב": "bear", "סוס": "horse",
  "פיל": "elephant", "פרפר": "butterfly", "נחש": "snake", "צב": "turtle",
  "תפוח": "apple", "בננה": "banana", "תות": "strawberry",
  "ספר": "book", "עיפרון": "pencil", "מפתח": "key", "כוס": "cup",
  "שעון": "clock", "טלפון": "phone", "מצלמה": "camera",
  "לוגו": "logo", "סמל": "symbol", "עיצוב": "design",
};

function promptToFilename(prompt: string): string {
  // First try English/ASCII words
  const englishWords = prompt
    .trim()
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 1);

  if (englishWords.length > 0) {
    let name = "";
    for (const w of englishWords) {
      const next = name ? `${name}_${w}` : w;
      if (next.length > 20) break;
      name = next;
    }
    return (name || "design").slice(0, 20).replace(/_+$/, "");
  }

  // Try Hebrew transliteration
  const hebrewWords = prompt
    .replace(/[^\u0590-\u05FF\s]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(w => w.length > 0);

  const transliterated: string[] = [];
  for (const w of hebrewWords) {
    const en = HE_TO_EN_GEN[w];
    if (en) transliterated.push(en);
  }

  if (transliterated.length > 0) {
    let name = "";
    for (const w of transliterated) {
      const next = name ? `${name}_${w}` : w;
      if (next.length > 20) break;
      name = next;
    }
    return (name || "design").slice(0, 20).replace(/_+$/, "");
  }

  return "design";
}

function pngToSvg(pngBuffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    potrace.trace(pngBuffer, {
      threshold: 128,
      turdSize: 40,       // aggressively remove small noise/specks
      alphaMax: 1.0,      // smoother corners
      optCurve: true,
      optTolerance: 0.4,  // balanced smoothness
    }, (err: Error | null, svg: string) => {
      if (err) reject(err);
      else resolve(svg);
    });
  });
}

/**
 * Core processing function — runs in background after job is created.
 */
async function runGenerateJob(
  jobId: string,
  prompt: string,
  modifications: string | undefined,
  landscapeMode: boolean,
  appUserId: number,
  ipAnon: string,
  hairline = false,
  lineweightMm?: number,
  minGapMm = 0,
  preGroupId?: string
) {
  const jobStartTime = Date.now();
  // AbortController for cancelling in-flight OpenAI requests when timeout fires
  const abortController = new AbortController();
  // Hard 5-minute internal timeout
  const JOB_TIMEOUT_MS = 5 * 60 * 1000;
  const internalTimeoutId = setTimeout(() => {
    abortController.abort();
    const job = getJob(jobId);
    if (job && job.status !== "done" && job.status !== "cancelled") {
      updateJob(jobId, {
        status: "error",
        error: "Processing timed out after 5 minutes. Try a simpler prompt.",
      });
    }
  }, JOB_TIMEOUT_MS);
  try {
    updateJob(jobId, { status: "processing" });

    const jobCheck = getJob(jobId);
    if (!jobCheck || jobCheck.status === "cancelled") return;

    const fullPrompt = modifications ? `${prompt}. Modifications: ${modifications}` : prompt;
    const baseFilename = promptToFilename(prompt);

    const generationPromises = Array.from({ length: 3 }, async (_, idx) => {
      const imagePrompt = landscapeMode
        ? buildLandscapePrompt(fullPrompt, idx)
        : buildLineArtPrompt(fullPrompt, idx);

      // Use Forge ImageService for text-to-image generation (same API as aiTraceRoute)
      const forgeApiUrl = process.env.BUILT_IN_FORGE_API_URL;
      const forgeApiKey = process.env.BUILT_IN_FORGE_API_KEY;
      if (!forgeApiUrl || !forgeApiKey) throw new Error("Forge API not configured");
      const forgeBaseUrl = forgeApiUrl.endsWith("/") ? forgeApiUrl : `${forgeApiUrl}/`;
      const forgeEndpoint = new URL("images.v1.ImageService/GenerateImage", forgeBaseUrl).toString();
      const forgeResponse = await fetch(forgeEndpoint, {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          "connect-protocol-version": "1",
          authorization: `Bearer ${forgeApiKey}`,
        },
        body: JSON.stringify({ prompt: imagePrompt }),
        signal: abortController.signal,
      });
      if (!forgeResponse.ok) {
        const detail = await forgeResponse.text().catch(() => "");
        throw new Error(`Forge ImageService failed (${forgeResponse.status}): ${detail}`);
      }
      const forgeResult = await forgeResponse.json() as { image: { b64Json: string; mimeType: string } };
      const b64 = forgeResult.image?.b64Json;
      if (!b64) throw new Error("Forge ImageService did not return image data");
      let rawBuffer = Buffer.from(b64, "base64");

      // blur(1.5) merges thick AI lines → eliminates double contours in potrace output
      const paddedBuffer = await sharp(rawBuffer)
        .extend({
          top: 140,
          bottom: 140,
          left: 100,
          right: 100,
          background: { r: 255, g: 255, b: 255, alpha: 1 },
        })
        .resize(1024, 1024, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
        .grayscale()
        .blur(1.5)
        .threshold(160)
        .png()
        .toBuffer();

      const rawSvg = await pngToSvg(paddedBuffer);
      const cleanSvg = cleanSvgForPreview(rawSvg);

      const { dxf, segmentCount, width, height, realWidth, realHeight } = svgToDxf(rawSvg, hairline, lineweightMm, minGapMm);

      const imgKey = `ai-generated/${nanoid()}.png`;
      const { url: imageUrl } = await storagePut(imgKey, rawBuffer, "image/png");

      const variation = STYLE_VARIATIONS[idx % STYLE_VARIATIONS.length];
      const dxfFilename = `${baseFilename}_${variation.label}.dxf`;
      const dxfKey = `dxf-ai/${nanoid()}-${dxfFilename}`;
      const { url: dxfUrl } = await storagePut(dxfKey, Buffer.from(dxf, "utf-8"), "application/dxf");

      return { imageUrl, svgPreview: cleanSvg, dxfUrl, dxfFilename, segmentCount, width, height, realWidth, realHeight };
    });

    // Check cancelled after each image
    const images: Array<{ imageUrl: string; svgPreview: string; dxfUrl: string; dxfFilename: string; segmentCount: number; width: number; height: number; realWidth: number; realHeight: number }> = [];
    for (let i = 0; i < 3; i++) {
      const jobMid = getJob(jobId);
      if (!jobMid || jobMid.status === "cancelled") return;
      images.push(await generationPromises[i]);
    }

    const jobAfterGen = getJob(jobId);
    if (!jobAfterGen || jobAfterGen.status === "cancelled") return;

    // Deduct tokens NOW — only after all 3 images generated successfully
    await deductTokens(appUserId, "ai_generate");
    updateJob(jobId, { tokenDeducted: true });

    // Log usage
    const totalSegments = images.reduce((s, img) => s + img.segmentCount, 0);
    const totalFileSizeKb = Math.round(
      images.reduce((sum, img) => sum + Buffer.byteLength(img.svgPreview ?? "", "utf-8"), 0) / 1024
    );
    void logUsageEvent({
      type: "ai_generate",
      segmentCount: Math.round(totalSegments / images.length),
      ipAnon: anonymizeIp(ipAnon ?? undefined),
      durationMs: Date.now() - jobStartTime,
      fileSizeKb: totalFileSizeKb,
    });

    // Record user actions — use pre-generated groupId so all 3 variations share the same group
    const groupId = preGroupId ?? nanoid(12);
    const variationLabels = landscapeMode
      ? ["simple", "detailed", "decorative"]
      : ["simple", "detailed", "complex"];
    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      void recordUserAction({
        appUserId,
        actionType: "ai_generate",
        description: fullPrompt.slice(0, 200),
        segmentCount: img.segmentCount,
        dxfUrl: img.dxfUrl,
        imageUrl: img.imageUrl,
        svgPreview: img.svgPreview,
        groupId,
        variationLabel: variationLabels[i] ?? `v${i + 1}`,
        feature: "ai_generate",
        durationMs: Date.now() - jobStartTime,
        ipAnon: ipAnon ?? undefined,
      });
    }

    clearTimeout(internalTimeoutId);
    updateJob(jobId, { status: "done", result: { success: true, images } });

  } catch (err: unknown) {
    clearTimeout(internalTimeoutId);
    console.error("[generateRoute] Job error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    // Don't overwrite a timeout error already set by internalTimeoutId
    const currentJob = getJob(jobId);
    if (currentJob && currentJob.status !== "error") {
      updateJob(jobId, { status: "error", error: message });
    }
    // No refund needed — tokens were not deducted yet (deduction happens only on success)
    // Record failed action in user history
    void recordUserAction({
      appUserId,
      actionType: "ai_generate",
      description: "ai_generate — נכשל",
      feature: "ai_generate",
      durationMs: Date.now() - jobStartTime,
      status: "failed",
      errorMessage: message.slice(0, 500),
    });
    // Alert admin if billing/quota issue
    const isBillingError = message.toLowerCase().includes("quota") ||
      message.toLowerCase().includes("billing") ||
      message.toLowerCase().includes("insufficient_quota") ||
      message.toLowerCase().includes("429") ||
      message.toLowerCase().includes("402");
    if (isBillingError) {
      try {
        await notifyOwner({
          title: "🔴 שגיאת חיוב OpenAI — נדרש טעינת כרטיס",
          content: `שגיאת billing ב-AI Create:\n${message}\n\nנא להיכנס ל-OpenAI ולטעון את הכרטיס: https://platform.openai.com/settings/organization/billing`,
        });
      } catch (_) { /* ignore notification errors */ }
    }
  }
}

// ─── POST /api/generate-images ────────────────────────────────────────────────
router.post("/api/generate-images", async (req, res) => {
  try {
    const { prompt, modifications, landscapeMode, hairline, lineweightMm: lwMmGen, minGapMm: minGapMmRaw } = req.body as {
      prompt?: string;
      modifications?: string;
      landscapeMode?: boolean;
      hairline?: boolean;
      lineweightMm?: number;
      minGapMm?: number;
    };
    const lineweightMmGen = typeof lwMmGen === "number" ? Math.min(2.0, Math.max(0, lwMmGen)) : undefined;
    const minGapMmGen = typeof minGapMmRaw === "number" ? Math.min(3.0, Math.max(0, minGapMmRaw)) : 0;

    if (!prompt || prompt.trim().length < 2) {
      return res.status(400).json({ error: "נא להזין תיאור של התמונה הרצויה" });
    }

    // Block trademarked brand names — OpenAI refuses these and causes silent timeouts
    const BLOCKED_BRANDS = [
      // English brand names
      "disney", "mickey mouse", "minnie mouse", "donald duck", "goofy", "pluto",
      "marvel", "spider-man", "spiderman", "batman", "superman", "iron man", "ironman",
      "dc comics", "avengers", "pokemon", "pikachu", "nintendo", "mario", "luigi",
      "hello kitty", "sanrio", "looney tunes", "bugs bunny", "tom and jerry",
      "nike", "adidas", "apple", "google", "facebook", "meta", "microsoft",
      "coca-cola", "pepsi", "mcdonalds", "mcdonald's", "starbucks", "amazon",
      "ferrari", "lamborghini", "porsche", "bmw", "mercedes", "tesla",
      "louis vuitton", "gucci", "chanel", "prada", "versace", "rolex",
      "star wars", "harry potter", "lord of the rings",
      "youtube", "instagram", "twitter", "tiktok", "snapchat", "whatsapp",
      // Hebrew brand names
      "דיסני", "מיקי מאוס", "מארוול", "ספיידרמן", "באטמן", "סופרמן",
      "פוקימון", "פיקאצ'ו", "נינטנדו", "מריו",
      "נייקי", "אדידס", "אפל", "גוגל", "פייסבוק", "מטא", "מיקרוסופט",
      "קוקה קולה", "פפסי", "מקדונלד", "סטארבקס", "אמזון",
      "פרארי", "למבורגיני", "פורשה", "מרצדס", "טסלה",
      "לואי ויטון", "גוצ'י", "שאנל", "פראדה", "ורסאצ'ה", "רולקס",
      "מלחמת הכוכבים", "הארי פוטר",
      "יוטיוב", "אינסטגרם", "טוויטר", "טיקטוק", "סנאפצ'ט", "וואטסאפ",
    ];
    const promptLower = prompt.trim().toLowerCase();
    const promptOriginal = prompt.trim(); // Hebrew chars are not affected by toLowerCase
    const matchedBrand = BLOCKED_BRANDS.find(brand => promptLower.includes(brand) || promptOriginal.includes(brand));
    if (matchedBrand) {
      return res.status(422).json({
        error: "BRAND_BLOCKED",
        brand: matchedBrand,
        message: `לא ניתן ליצור לוגואים של מותגים רשומים ("${matchedBrand}"). נסה תיאור כללי, למשל: "לוגו עם טירה ועכבר" במקום "לוגו דיסני".`,
        messageEn: `Cannot generate logos of trademarked brands ("${matchedBrand}"). Try a generic description instead, e.g. "castle with mouse logo" instead of "Disney logo".`,
      });
    }

    const rawIp = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
    const ipAnon = anonymizeIp(rawIp);
    const appUser = getAppUserFromCookie(req.cookies);

    if (!appUser?.userId) {
      return res.status(401).json({ error: "REGISTRATION_REQUIRED", message: "נדרשת הרשמה כדי ליצור עיצובי AI" });
    }

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

    // Token check only — deduction happens after successful job completion
    const tokenResult = await deductTokens(appUser.userId, "ai_generate", { checkOnly: true });
    if (!tokenResult.success) {
      return res.status(402).json({
        error: "INSUFFICIENT_TOKENS",
        balance: tokenResult.balance,
        message: "נגמרו לך האסימונים. יש לטעון אסימונים להמשך שימוש.",
        messageEn: "You have run out of tokens. Please purchase more tokens to continue.",
      });
    }

    const jobId = nanoid(12);
    const jobGroupId = nanoid(12); // pre-generate groupId so all 3 variations share it
    createJob(jobId, appUser.userId, "ai_generate");

    // 5-minute hard timeout
    const MAX_GEN_JOB_MS = 5 * 60 * 1000;
    const genTimeoutPromise = new Promise<void>((_, reject) =>
      setTimeout(() => reject(new Error("Job timed out after 5 minutes")), MAX_GEN_JOB_MS)
    );
    Promise.race([
      runGenerateJob(jobId, prompt.trim(), modifications, !!landscapeMode, appUser.userId, ipAnon ?? "", !!hairline, lineweightMmGen, minGapMmGen, jobGroupId),
      genTimeoutPromise,
    ]).catch((err) => {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error("[generateRoute] Job error/timeout:", msg);
      updateJob(jobId, { status: "error", error: msg });
    });

    return res.json({ jobId });

  } catch (err: unknown) {
    console.error("[generate-images]", err);
    const errMsg = err instanceof Error ? err.message : String(err);
    if (errMsg.toLowerCase().includes("quota") || errMsg.toLowerCase().includes("billing")) {
      return res.status(503).json({ error: "SERVICE_UNAVAILABLE", message: "שירות ה-AI אינו זמין כרגע." });
    }
    return res.status(500).json({ error: errMsg });
  }
});

// ─── GET /api/generate-images/job/:jobId ──────────────────────────────────────
router.get("/api/generate-images/job/:jobId", (req, res) => {
  const appUser = getAppUserFromCookie(req.cookies);
  if (!appUser) return res.status(401).json({ error: "UNAUTHORIZED" });

  const job = getJob(req.params.jobId);
  if (!job) return res.status(404).json({ error: "JOB_NOT_FOUND" });
  if (job.userId !== appUser.userId) return res.status(403).json({ error: "FORBIDDEN" });

  if (job.status === "done") {
    return res.json({ status: "done", result: job.result });
  } else if (job.status === "error") {
    const rawError = job.error ?? "";
    // Translate raw OpenAI safety/content errors into friendly messages
    let friendlyMessage: string;
    if (rawError.toLowerCase().includes("safety") || rawError.toLowerCase().includes("rejected") || rawError.toLowerCase().includes("content_policy") || rawError.toLowerCase().includes("content policy")) {
      friendlyMessage = "הבקשה נדחתה על ידי מסנן התוכן של AI. נסה תיאור אחר — הימנע ממותגים רשומים, תוכן פוגעני, או דמויות מוגנות בזכויות יוצרים.";
    } else if (rawError.toLowerCase().includes("timed out") || rawError.toLowerCase().includes("timeout")) {
      friendlyMessage = "העיבוד לקח יותר מדי זמן. נסה שוב עם תיאור פשוט יותר.";
    } else if (rawError.toLowerCase().includes("quota") || rawError.toLowerCase().includes("billing")) {
      friendlyMessage = "שירות ה-AI אינו זמין כרגע. נסה שוב מאוחר יותר.";
    } else {
      friendlyMessage = "שגיאה ביצירת התמונה. נסה שוב עם תיאור שונה.";
    }
    return res.json({ status: "error", error: job.error, message: friendlyMessage });
  } else if (job.status === "cancelled") {
    return res.json({ status: "cancelled" });
  } else {
    return res.json({ status: job.status });
  }
});

// ─── POST /api/generate-images/cancel/:jobId ──────────────────────────────────
router.post("/api/generate-images/cancel/:jobId", async (req, res) => {
  const appUser = getAppUserFromCookie(req.cookies);
  if (!appUser) return res.status(401).json({ error: "UNAUTHORIZED" });

  const job = getJob(req.params.jobId);
  if (!job) return res.status(404).json({ error: "JOB_NOT_FOUND" });
  if (job.userId !== appUser.userId) return res.status(403).json({ error: "FORBIDDEN" });

  if (job.status === "done") {
    return res.json({ cancelled: false, reason: "Job already completed" });
  }

  const wasCancelled = cancelJob(req.params.jobId);
  if (wasCancelled) {
    // No refund needed — tokens are only deducted after successful completion
    // Record cancelled action in user history
    void recordUserAction({
      appUserId: appUser.userId,
      actionType: "ai_generate",
      description: "ai_generate — בוטל",
      feature: "ai_generate",
      status: "cancelled",
    });
    return res.json({ cancelled: true });
  }

  return res.json({ cancelled: false, reason: "Job already finished" });
});

export default router;

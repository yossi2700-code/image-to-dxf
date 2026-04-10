/**
 * architecturalSketchRoute.ts
 *
 * Converts architectural hand-drawn sketches (floor plans, sections, elevations)
 * to clean DXF files with optional real-world scale calibration.
 *
 * POST /api/architectural-sketch
 *   Returns immediately with { jobId } — processing continues in background.
 *
 * GET /api/architectural-sketch/job/:jobId
 *   Poll for job status: { status, result?, error? }
 *
 * POST /api/architectural-sketch/cancel/:jobId
 *   Cancel a pending/processing job.
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
import { svgToDxf } from "./svgToDxf";
import { cleanSvgForPreview } from "./svgClean";
import { invokeLLM } from "./_core/llm";
import potrace from "potrace";
import { createJob, getJob, updateJob, cancelJob, heartbeatJob } from "./jobStore";
import { getDb } from "./db";
import { appUsers } from "../drizzle/schema";
import { eq } from "drizzle-orm";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 16 * 1024 * 1024 } });

// ─── Potrace helper ───────────────────────────────────────────────────────────
function pngToSvg(pngBuffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    potrace.trace(
      pngBuffer,
      {
        threshold: 128,
        turdSize: 8,        // remove small noise spots
        alphaMax: 0.0,      // sharp corners (architectural lines)
        optCurve: false,    // keep straight lines straight
        optTolerance: 0.2,
        // turnPolicy not supported in this version
      },
      (err: Error | null, svg: string) => {
        if (err) reject(err);
        else resolve(svg);
      }
    );
  });
}

/**
 * Straighten nearly-straight lines in SVG paths.
 * Replaces Bezier curves that deviate less than `thresholdDeg` degrees
 * from a straight line with actual straight line segments.
 * Also snaps angles close to 0°, 45°, 90°, 135°, 180° to exact values.
 */
function straightenSvgLines(svg: string, thresholdDeg = 3): string {
  // Replace bezier curves (C/c/S/s commands) with line segments when nearly straight
  // We do this by converting the SVG path data
  return svg.replace(/\bd="([^"]*)"/gi, (match, pathData: string) => {
    const straightened = straightenPathData(pathData, thresholdDeg);
    return `d="${straightened}"`;
  });
}

function straightenPathData(d: string, thresholdDeg: number): string {
  // Tokenize path
  const tokens = d.match(/[MmLlHhVvCcSsQqTtAaZz]|[-+]?[0-9]*\.?[0-9]+(?:[eE][-+]?[0-9]+)?/g);
  if (!tokens) return d;

  const result: string[] = [];
  let i = 0;
  let currentX = 0, currentY = 0;
  let startX = 0, startY = 0;

  while (i < tokens.length) {
    const cmd = tokens[i];
    if (!/^[MmLlHhVvCcSsQqTtAaZz]$/.test(cmd)) { i++; continue; }
    i++;

    switch (cmd) {
      case 'M': case 'm': {
        const x = parseFloat(tokens[i] ?? "0");
        const y = parseFloat(tokens[i + 1] ?? "0");
        i += 2;
        if (cmd === 'M') { currentX = x; currentY = y; }
        else { currentX += x; currentY += y; }
        startX = currentX; startY = currentY;
        result.push(`${cmd}${currentX},${currentY}`);
        break;
      }
      case 'L': case 'l': {
        const x = parseFloat(tokens[i] ?? "0");
        const y = parseFloat(tokens[i + 1] ?? "0");
        i += 2;
        if (cmd === 'L') { currentX = x; currentY = y; }
        else { currentX += x; currentY += y; }
        // Snap angle to nearest 45°
        const [sx, sy] = snapToGrid(currentX, currentY, result);
        result.push(`L${sx},${sy}`);
        currentX = sx; currentY = sy;
        break;
      }
      case 'C': case 'c': {
        // Cubic bezier: 6 params (x1,y1 x2,y2 x,y)
        const x1 = parseFloat(tokens[i] ?? "0");
        const y1 = parseFloat(tokens[i + 1] ?? "0");
        const x2 = parseFloat(tokens[i + 2] ?? "0");
        const y2 = parseFloat(tokens[i + 3] ?? "0");
        const x = parseFloat(tokens[i + 4] ?? "0");
        const y = parseFloat(tokens[i + 5] ?? "0");
        i += 6;

        let endX = x, endY = y;
        if (cmd === 'c') { endX = currentX + x; endY = currentY + y; }

        // Check if bezier is nearly straight
        const dx = endX - currentX;
        const dy = endY - currentY;
        const len = Math.sqrt(dx * dx + dy * dy);

        if (len < 0.001) {
          result.push(`L${endX},${endY}`);
        } else {
          // Check control point deviation
          const cx1 = cmd === 'c' ? currentX + x1 : x1;
          const cy1 = cmd === 'c' ? currentY + y1 : y1;
          const cx2 = cmd === 'c' ? currentX + x2 : x2;
          const cy2 = cmd === 'c' ? currentY + y2 : y2;

          const dev1 = pointToLineDistance(cx1, cy1, currentX, currentY, endX, endY);
          const dev2 = pointToLineDistance(cx2, cy2, currentX, currentY, endX, endY);
          const maxDev = Math.max(dev1, dev2);
          const deviationRatio = maxDev / len;
          const deviationDeg = Math.atan(deviationRatio) * (180 / Math.PI);

          if (deviationDeg < thresholdDeg) {
            // Nearly straight — replace with line
            result.push(`L${endX},${endY}`);
          } else {
            result.push(`${cmd}${x1},${y1} ${x2},${y2} ${x},${y}`);
          }
        }
        currentX = endX; currentY = endY;
        break;
      }
      case 'Z': case 'z': {
        result.push('Z');
        currentX = startX; currentY = startY;
        break;
      }
      default: {
        // Pass through other commands unchanged
        result.push(cmd);
        // Skip params (heuristic: read until next command)
        while (i < tokens.length && !/^[MmLlHhVvCcSsQqTtAaZz]$/.test(tokens[i])) {
          result.push(tokens[i]);
          i++;
        }
      }
    }
  }

  return result.join(' ');
}

/** Distance from point (px,py) to line segment (x1,y1)-(x2,y2) */
function pointToLineDistance(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1, dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
  return Math.sqrt((px - (x1 + t * dx)) ** 2 + (py - (y1 + t * dy)) ** 2);
}

/** Snap endpoint to nearest 45° angle from last point (if within 3°) */
function snapToGrid(x: number, y: number, result: string[]): [number, number] {
  // Find last M or L command to get previous point
  for (let i = result.length - 1; i >= 0; i--) {
    const m = result[i].match(/^[ML]([-\d.]+),([-\d.]+)$/);
    if (m) {
      const prevX = parseFloat(m[1]);
      const prevY = parseFloat(m[2]);
      const dx = x - prevX;
      const dy = y - prevY;
      const angle = Math.atan2(dy, dx) * (180 / Math.PI);
      const len = Math.sqrt(dx * dx + dy * dy);

      // Snap to nearest 45°
      const snapAngles = [0, 45, 90, 135, 180, -135, -90, -45];
      let minDiff = Infinity;
      let snapAngle = angle;
      for (const sa of snapAngles) {
        const diff = Math.abs(((angle - sa + 540) % 360) - 180);
        if (diff < minDiff) { minDiff = diff; snapAngle = sa; }
      }

      if (minDiff < 3) {
        // Snap to this angle
        const rad = snapAngle * (Math.PI / 180);
        return [
          Math.round((prevX + len * Math.cos(rad)) * 100) / 100,
          Math.round((prevY + len * Math.sin(rad)) * 100) / 100,
        ];
      }
      break;
    }
  }
  return [x, y];
}

/**
 * Apply real-world scale to DXF content.
 * knownLengthMm: the real-world length in mm of a reference line
 * knownLengthPx: the pixel length of that same line in the image
 * imageWidthPx: total image width in pixels
 * dxfWidthMm: current DXF width in mm (from svgToDxf output)
 */
function applyScaleToDxf(dxf: string, scaleFactor: number): string {
  // Replace all coordinate values in LWPOLYLINE entities
  // DXF coordinates are on lines starting with 10 (X) and 20 (Y)
  const lines = dxf.split('\n');
  const result: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const code = lines[i].trim();
    const value = lines[i + 1]?.trim();
    if ((code === '10' || code === '20') && value !== undefined) {
      const num = parseFloat(value);
      if (!isNaN(num)) {
        result.push(lines[i]);
        result.push((num * scaleFactor).toFixed(6));
        i += 2;
        continue;
      }
    }
    // Also scale EXTMAX header values
    if (code === '9' && value === '$EXTMAX') {
      result.push(lines[i]);
      result.push(lines[i + 1] ?? '');
      i += 2;
      // Next 6 lines: 10, val, 20, val, 30, val
      for (let j = 0; j < 3; j++) {
        const axisCode = lines[i]?.trim();
        const axisVal = lines[i + 1]?.trim();
        if (axisCode && axisVal !== undefined) {
          const num = parseFloat(axisVal);
          result.push(lines[i]);
          result.push(isNaN(num) ? axisVal : (num * scaleFactor).toFixed(6));
          i += 2;
        }
      }
      continue;
    }
    result.push(lines[i]);
    i++;
  }
  return result.join('\n');
}

// ─── AI clarity check ───────────────────────────────────────────────────────
async function checkImageClarity(imageBase64: string): Promise<{
  isClear: boolean;
  reason?: string;
  reasonHe?: string;
}> {
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content:
            "You are an expert at evaluating architectural drawing quality for CAD conversion. " +
            "Analyze the image and determine if it is clear enough to convert to DXF. " +
            "A drawing is NOT clear enough if: " +
            "1. It is too blurry or out of focus to read lines " +
            "2. The contrast is too low (lines barely visible) " +
            "3. The image is too dark or overexposed " +
            "4. Lines are too faint or broken to trace " +
            "5. The image is not a drawing at all (photo of a building, etc.) " +
            "A drawing IS clear enough if lines are visible, even if the paper is yellowed or there are minor stains. " +
            "Respond ONLY with valid JSON: " +
            '{"isClear": true/false, "reason": "brief English reason if not clear", "reasonHe": "brief Hebrew reason if not clear"}',
        },
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}`, detail: "low" } },
            { type: "text", text: "Is this architectural drawing clear enough to convert to DXF?" },
          ],
        },
      ],
    });

    const content = (response as { choices?: Array<{ message?: { content?: string } }> })
      ?.choices?.[0]?.message?.content?.trim() ?? "";

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.warn("[architecturalSketch] Clarity check failed:", e);
  }
  // Default: assume clear if check fails
  return { isClear: true };
}

// ─── AI scale detection ───────────────────────────────────────────────────────
async function detectScaleFromImage(imageBase64: string, lang: "he" | "en"): Promise<{
  hasScale: boolean;
  scaleBarMm?: number;
  scaleBarPxFraction?: number; // fraction of image width
  scaleRatio?: string; // e.g. "1:100"
  description?: string;
}> {
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content:
            "You are an expert at reading architectural drawings and scale bars. " +
            "Analyze the image and look for: " +
            "1. A scale bar (a horizontal bar with measurements like '0 1 2 3m' or '0 50 100cm') " +
            "2. A scale ratio (like '1:100', '1:50', '1:200') " +
            "3. Any dimension annotations " +
            "Respond ONLY with valid JSON in this exact format: " +
            '{"hasScale": true/false, "scaleBarMm": number_or_null, "scaleBarPxFraction": number_or_null, "scaleRatio": "string_or_null", "description": "brief description"} ' +
            "scaleBarMm = the real-world length in mm that the scale bar represents. " +
            "scaleBarPxFraction = approximate fraction of the image width that the scale bar occupies (0.0 to 1.0). " +
            "If no scale info found, return {\"hasScale\": false}.",
        },
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}`, detail: "low" } },
            { type: "text", text: "Does this architectural drawing have a scale bar or scale ratio? Extract scale information." },
          ],
        },
      ],
    });

    const content = (response as { choices?: Array<{ message?: { content?: string } }> })
      ?.choices?.[0]?.message?.content?.trim() ?? "";

    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.warn("[architecturalSketch] Scale detection failed:", e);
  }
  return { hasScale: false };
}

// ─── Main job runner ──────────────────────────────────────────────────────────
async function runArchitecturalSketchJob(
  jobId: string,
  imageBuffer: Buffer,
  appUserId: number,
  ipAnon: string,
  lang: "he" | "en",
  knownLengthMm: number | null,  // user-provided reference length in mm
  knownLengthLabel: string | undefined, // user-provided label e.g. "5 meters"
  sourceImageUrl?: string
) {
  const isHe = lang === "he";
  let heartbeatInterval: ReturnType<typeof setInterval> | undefined;
  const jobStartTime = Date.now();

  try {
    updateJob(jobId, { status: "processing", step: isHe ? "מנתח שרטוט..." : "Analyzing sketch..." });

    const jobCheck = getJob(jobId);
    if (!jobCheck || jobCheck.status === "cancelled") return;

    // Step 1: Prepare image for analysis
    const analysisBuffer = await sharp(imageBuffer)
      .resize(1024, 1024, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
    const imageBase64 = analysisBuffer.toString("base64");

    // Step 1b: Clarity check
    updateJob(jobId, { step: isHe ? "בודק בהירות התמונה..." : "Checking image clarity..." });
    const clarityResult = await checkImageClarity(imageBase64);
    if (!clarityResult.isClear) {
      const errMsg = isHe
        ? `התמונה אינה ברורה מספיק להמרה. ${clarityResult.reasonHe ?? "אנא צלם מחדש בתאורה טובה יותר."}`
        : `Image is not clear enough to convert. ${clarityResult.reason ?? "Please take a new photo with better lighting and focus."}`;
      updateJob(jobId, { status: "error", error: errMsg, errorCode: "IMAGE_NOT_CLEAR" });
      return;
    }

    // Step 2: Detect scale from image (if user didn't provide one)
    let autoScaleInfo: { hasScale: boolean; scaleBarMm?: number; scaleBarPxFraction?: number; scaleRatio?: string } = { hasScale: false };
    if (!knownLengthMm) {
      updateJob(jobId, { step: isHe ? "מזהה קנה מידה..." : "Detecting scale..." });
      autoScaleInfo = await detectScaleFromImage(imageBase64, lang);
    }

    // Step 3: OCR — extract dimensions and text from drawing
    updateJob(jobId, { step: isHe ? "קורא מידות מהשרטוט..." : "Reading dimensions from sketch..." });

    let ocrText = "";
    try {
      const ocrResponse = await invokeLLM({
        messages: [
          {
            role: "system",
            content:
              "You are an expert at reading architectural drawings. " +
              "Extract ALL text, numbers, dimensions, and annotations from this drawing. " +
              "List every number, measurement, room name, and label you can see. " +
              "Format: one item per line. Include units if visible (m, cm, mm). " +
              "Also note any scale ratio (like 1:100) if present.",
          },
          {
            role: "user",
            content: [
              { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}`, detail: "high" } },
              { type: "text", text: "List all text, numbers, dimensions and room names visible in this architectural drawing." },
            ],
          },
        ],
      });
      ocrText = (ocrResponse as { choices?: Array<{ message?: { content?: string } }> })
        ?.choices?.[0]?.message?.content?.trim() ?? "";
    } catch (e) {
      console.warn("[architecturalSketch] OCR failed:", e);
    }

    // Step 4: Clean the image using Sharp only (no AI generation — preserves original lines)
    updateJob(jobId, { step: isHe ? "מנקה שרטוט..." : "Cleaning sketch..." });

    heartbeatInterval = setInterval(() => heartbeatJob(jobId), 30_000);

    // Use Sharp for image cleaning — preserves original lines exactly
    const cleanedBuffer = await sharp(imageBuffer)
      .resize(2048, 2048, { fit: "inside", withoutEnlargement: true })
      .grayscale()
      // Normalize to full range first
      .normalise()
      // Strong contrast boost to make lines pop
      .linear(2.5, -(2.5 * 128) + 128)
      // Sharpen to crisp lines
      .sharpen({ sigma: 1.5, m1: 1.5, m2: 0.5 })
      // Threshold for clean B&W
      .threshold(160)
      .png()
      .toBuffer();

    clearInterval(heartbeatInterval);
    heartbeatInterval = undefined;

    // Step 5: Vectorize with Potrace — single-line mode
    updateJob(jobId, { step: isHe ? "ממיר לוקטור..." : "Vectorizing..." });

    const jobAfterGen = getJob(jobId);
    if (!jobAfterGen || jobAfterGen.status === "cancelled") return;

    // Vectorize with single-line optimized settings
    const rawSvg = await pngToSvg(cleanedBuffer);

    // Step 5: Straighten lines
    updateJob(jobId, { step: isHe ? "מיישר קווים..." : "Straightening lines..." });
    const straightSvg = straightenSvgLines(rawSvg, 3);

    // Step 6: Convert to DXF
    const cleanSvg = cleanSvgForPreview(straightSvg);
    const { dxf: rawDxf, segmentCount, width: dxfWidthPx, height: dxfHeightPx } = svgToDxf(straightSvg);

    // Step 7: Apply scale if available
    let finalDxf = rawDxf;
    let scaleApplied = false;
    let scaleDescription = "";

    if (knownLengthMm && knownLengthMm > 0) {
      // User provided: we need to ask them for a reference pixel length
      // For now, use the full image width as reference (user can specify later)
      // The DXF is already in mm (MAX_DXF_MM = 200mm default)
      // We scale so that the drawing fits the user's specified real-world size
      // Assume the user's knownLengthMm refers to the full drawing width
      const scaleFactor = knownLengthMm / 200; // 200mm is the default DXF width
      finalDxf = applyScaleToDxf(rawDxf, scaleFactor);
      scaleApplied = true;
      scaleDescription = isHe
        ? `קנה מידה: ${knownLengthLabel ?? `${knownLengthMm}מ"מ`} לרוחב השרטוט`
        : `Scale: ${knownLengthLabel ?? `${knownLengthMm}mm`} for drawing width`;
    } else if (autoScaleInfo.hasScale && autoScaleInfo.scaleBarMm && autoScaleInfo.scaleBarPxFraction) {
      // Auto-detected scale bar
      // scaleBarPxFraction = fraction of image width that the scale bar occupies
      // scaleBarMm = real-world mm that scale bar represents
      // DXF default width = 200mm
      // Scale bar in DXF = 200mm * scaleBarPxFraction
      const scaleBarInDxf = 200 * autoScaleInfo.scaleBarPxFraction;
      const scaleFactor = autoScaleInfo.scaleBarMm / scaleBarInDxf;
      finalDxf = applyScaleToDxf(rawDxf, scaleFactor);
      scaleApplied = true;
      scaleDescription = isHe
        ? `קנה מידה זוהה אוטומטית: ${autoScaleInfo.scaleRatio ?? `${autoScaleInfo.scaleBarMm}מ"מ`}`
        : `Auto-detected scale: ${autoScaleInfo.scaleRatio ?? `${autoScaleInfo.scaleBarMm}mm`}`;
    }

    // Step 8: Upload files
    const baseFilename = "architectural_sketch";
    const dxfFilename = `${baseFilename}.dxf`;

    const imgKey = `arch-sketch-generated/${nanoid()}.png`;
    const { url: imageUrl } = await storagePut(imgKey, cleanedBuffer, "image/png");

    const dxfKey = `arch-sketch-dxf/${nanoid()}-${dxfFilename}`;
    const { url: dxfUrl } = await storagePut(dxfKey, Buffer.from(finalDxf, "utf-8"), "application/dxf");

    // Step 9: Log and deduct tokens
    await logUsageEvent({ type: "ai_generate", segmentCount, ipAnon, appUserId });
    await deductTokens(appUserId, "ai_trace" as any);
    updateJob(jobId, { tokenDeducted: true });

    await recordUserAction({
      appUserId,
      actionType: "ai_generate",
      description: `architectural sketch${scaleApplied ? ` (${scaleDescription})` : ""}`,
      segmentCount,
      dxfUrl,
      imageUrl,
      svgPreview: cleanSvg,
      groupId: `arch-${Date.now()}`,
      variationLabel: "architectural-sketch",
      feature: "architectural_sketch",
      ipAnon: ipAnon ?? undefined,
      sourceImageUrl: sourceImageUrl ?? undefined,
    });

    updateJob(jobId, {
      status: "done",
      result: {
        success: true,
        image: {
          imageUrl,
          svgPreview: cleanSvg,
          dxfUrl,
          dxfFilename,
          segmentCount,
          width: dxfWidthPx,
          height: dxfHeightPx,
          scaleApplied,
          scaleDescription,
          ocrText: ocrText || undefined,
        },
      },
    });

  } catch (err: unknown) {
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    console.error("[architecturalSketch] Job error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    updateJob(jobId, { status: "error", error: message });

    void recordUserAction({
      appUserId,
      actionType: "ai_generate",
      description: "architectural_sketch — נכשל",
      feature: "architectural_sketch",
      durationMs: Date.now() - jobStartTime,
      status: "failed",
      errorMessage: message.slice(0, 500),
      sourceImageUrl: sourceImageUrl ?? undefined,
    });

    try {
      const { recordFailedJob } = await import("./failedJobsDb");
      await recordFailedJob({
        appUserId,
        feature: "architectural_sketch",
        durationMs: Date.now() - jobStartTime,
        errorMessage: message,
        sourceImageUrl: sourceImageUrl ?? undefined,
      });
    } catch (_) { /* ignore */ }
  }
}

// ─── POST /api/architectural-sketch ──────────────────────────────────────────
router.post(
  "/api/architectural-sketch",
  upload.single("image"),
  async (req, res) => {
    try {
      // ⚠️ AUTH TEMPORARILY DISABLED FOR TESTING — re-enable before production
      const appUser = getAppUserFromCookie(req.cookies);
      // Use a test userId of 0 when not logged in
      const testUserId = appUser?.userId ?? 0;

      // Image check
      if (!req.file) {
        return res.status(400).json({ error: "NO_IMAGE", message: "לא הועלתה תמונה" });
      }

      // Parse optional scale parameters
      const knownLengthMm = req.body?.knownLengthMm ? parseFloat(req.body.knownLengthMm) : null;
      const knownLengthLabel: string | undefined = req.body?.knownLengthLabel ?? undefined;
      const lang = (req.body?.lang === "he" ? "he" : "en") as "he" | "en";

      // Upload source image
      let uploadedSourceImageUrl: string | undefined;
      try {
        const sourceKey = `arch-sketch-source/${nanoid()}.${req.file.mimetype.includes("png") ? "png" : "jpg"}`;
        const { url } = await storagePut(sourceKey, req.file.buffer, req.file.mimetype);
        uploadedSourceImageUrl = url;
      } catch (e) {
        console.warn("[architecturalSketch] Failed to upload source image:", e);
      }

      const rawIp: string = ((req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim()) ?? ((req.socket as { remoteAddress?: string } | undefined)?.remoteAddress) ?? "";
      const ipAnon: string = anonymizeIp(rawIp) ?? "";

      // Create job
      const jobId = nanoid(12);
      createJob(jobId, testUserId, "ai_trace");

      const MAX_JOB_MS = 4 * 60 * 1000; // 4 minutes
      const timeoutPromise = new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error("Job timed out after 4 minutes")), MAX_JOB_MS)
      );

      Promise.race([
        runArchitecturalSketchJob(
          jobId,
          req.file.buffer,
          testUserId,
          ipAnon,
          lang,
          knownLengthMm,
          knownLengthLabel,
          uploadedSourceImageUrl
        ),
        timeoutPromise,
      ]).catch((err) => {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[architecturalSketch] Job error/timeout:", msg);
        const job = getJob(jobId);
        if (job && job.status !== "done" && job.status !== "cancelled") {
          updateJob(jobId, { status: "error", error: msg });
        }
      });

      return res.json({ jobId });
    } catch (err) {
      console.error("[architecturalSketch] Route error:", err);
      return res.status(500).json({ error: "SERVER_ERROR", message: "שגיאת שרת" });
    }
  }
);

// ─── GET /api/architectural-sketch/job/:jobId ─────────────────────────────────
router.get("/api/architectural-sketch/job/:jobId", (req, res) => {
  const job = getJob(req.params.jobId);
  if (!job) return res.status(404).json({ error: "JOB_NOT_FOUND" });

  // ⚠️ AUTH TEMPORARILY DISABLED FOR TESTING
  // const appUser = getAppUserFromCookie(req.cookies);
  // if (!appUser || job.userId !== appUser.userId) return res.status(403).json({ error: "FORBIDDEN" });

  return res.json({
    status: job.status,
    progress: job.step,
    result: job.result,
    error: job.error,
  });
});

// ─── POST /api/architectural-sketch/cancel/:jobId ────────────────────────────
router.post("/api/architectural-sketch/cancel/:jobId", (req, res) => {
  const job = getJob(req.params.jobId);
  if (!job) return res.status(404).json({ error: "JOB_NOT_FOUND" });

  // ⚠️ AUTH TEMPORARILY DISABLED FOR TESTING
  // const appUser = getAppUserFromCookie(req.cookies);
  // if (!appUser || job.userId !== appUser.userId) return res.status(403).json({ error: "FORBIDDEN" });

  cancelJob(req.params.jobId);
  return res.json({ success: true });
});

export default router;

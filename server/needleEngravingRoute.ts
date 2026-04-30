import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import os from "os";
import { execFile } from "child_process";
import { promisify } from "util";
import { storagePut } from "./storage";
import { invokeLLM } from "./_core/llm";
import { generateImage } from "./_core/imageGeneration";
import { getAppUserFromRequest } from "./appAuth";
import { deductTokens } from "./tokenService";
import { recordUserAction } from "./userActionsDb";

const execFileAsync = promisify(execFile);
const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
});

/**
 * POST /api/needle-engraving/process
 * Accepts: multipart/form-data with fields:
 *   - image: file (JPG/PNG)
 *   - widthCm: string (optional)
 *   - heightCm: string (optional)
 *   - dpi: string (optional, default 180)
 *   - isPortrait: "true" | "false" (optional)
 */
router.post("/process", upload.single("image"), async (req, res) => {
  const tmpDir = os.tmpdir();
  const id = `engraving-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const inputPath = path.join(tmpDir, `${id}-input.png`);
  const outputBmpPath = path.join(tmpDir, `${id}-output.bmp`);
  const previewPath = path.join(tmpDir, `${id}-preview.png`);

  try {
    if (!req.file) {
      return res.status(400).json({ error: "No image uploaded" });
    }

    // Auth + token check (supports both app_user_session and Manus OAuth)
    const appUser = await getAppUserFromRequest(req, res);
    if (!appUser) {
      return res.status(401).json({ error: "UNAUTHORIZED" });
    }
    const tokenCheck = await deductTokens(appUser.userId, "needle_engraving" as any, { checkOnly: true });
    if (!tokenCheck.success) {
      return res.status(402).json({ error: "INSUFFICIENT_TOKENS", balance: tokenCheck.balance });
    }

    const { widthCm, heightCm, dpi = "180", isPortrait = "false" } = req.body as {
      widthCm?: string;
      heightCm?: string;
      dpi?: string;
      isPortrait?: string;
    };

    // Save uploaded file to temp
    fs.writeFileSync(inputPath, req.file.buffer);

    // Step 1: If color image → convert to grayscale via AI
    let processInputPath = inputPath;
    const isColor = await checkIfColorImage(inputPath);

    if (isColor) {
      const promptText =
        isPortrait === "true"
          ? "Transform this portrait photo into a professional grayscale portrait optimized for diamond needle engraving on black granite. Pure grayscale only, no color. High contrast, sharp details, smooth gradients. Background must be pure black (0,0,0). Output: grayscale PNG."
          : "Convert this image into a professional grayscale image optimized for diamond needle engraving on black granite. Pure grayscale only, no color. High contrast, sharp details, smooth gradients. Background must be pure black (0,0,0). Output: grayscale PNG.";

      // Upload original to S3 for AI processing
      const originalKey = `engraving-temp/${id}-original.png`;
      const { url: originalUrl } = await storagePut(originalKey, req.file.buffer, "image/png");

      const { url: aiGrayscaleUrl } = await generateImage({
        prompt: promptText,
        originalImages: [{ url: originalUrl, mimeType: "image/png" }],
      });

      // Download AI result
      if (!aiGrayscaleUrl) throw new Error("AI grayscale conversion failed");
      const aiResponse = await fetch(aiGrayscaleUrl);
      const aiBuffer = Buffer.from(await aiResponse.arrayBuffer());
      const aiInputPath = path.join(tmpDir, `${id}-ai-gray.png`);
      fs.writeFileSync(aiInputPath, aiBuffer);
      processInputPath = aiInputPath;
    }

    // Step 2: Run Python processing script
    const scriptPath = path.join(__dirname, "process_engraving.py");
    const args = [
      scriptPath,
      processInputPath,
      outputBmpPath,
      widthCm || "null",
      heightCm || "null",
      dpi,
    ];

    const { stdout, stderr } = await execFileAsync("python3", args, { timeout: 60000 });

    if (stderr && !stdout) {
      throw new Error(`Python error: ${stderr}`);
    }

    const result = JSON.parse(stdout.trim());
    if (result.error) {
      throw new Error(result.error);
    }

    // Step 3: Upload BMP to S3
    const bmpBuffer = fs.readFileSync(outputBmpPath);
    const bmpKey = `engraving-output/${id}.bmp`;
    const { url: bmpUrl } = await storagePut(bmpKey, bmpBuffer, "image/bmp");

    // Step 4: Create PNG preview (grayscale PNG for browser display)
    // Use the processed grayscale image as preview
    const previewBuffer = fs.readFileSync(processInputPath);
    const previewKey = `engraving-preview/${id}.png`;
    const { url: previewUrl } = await storagePut(previewKey, previewBuffer, "image/png");

    // Cleanup temp files
    [inputPath, outputBmpPath, processInputPath, previewPath].forEach((f) => {
      try { fs.unlinkSync(f); } catch {}
    });

    // Deduct tokens after success
    await deductTokens(appUser.userId, "needle_engraving" as any);
    await recordUserAction({
      appUserId: appUser.userId,
      actionType: "convert",
      description: `needle_engraving w=${widthCm}cm h=${heightCm}cm dpi=${dpi}`,
    });

    return res.json({
      success: true,
      bmpUrl,
      previewUrl,
      width: result.width,
      height: result.height,
      bitDepth: result.bitDepth,
      fileSizeKB: result.fileSizeKB,
      wasColorConverted: isColor,
    });
  } catch (err: unknown) {
    // Cleanup on error
    [inputPath, outputBmpPath, previewPath].forEach((f) => {
      try { fs.unlinkSync(f); } catch {}
    });
    const message = err instanceof Error ? err.message : String(err);
    console.error("[needle-engraving] Error:", message);
    return res.status(500).json({ error: message });
  }
});

/**
 * POST /api/needle-engraving/generate-and-process
 * AI text-to-image mode: generate image from prompt, then process for engraving
 * Body: JSON { prompt, widthCm?, heightCm?, dpi?, isPortrait? }
 */
router.post("/generate-and-process", express.json(), async (req, res) => {
  const tmpDir = os.tmpdir();
  const id = `engraving-gen-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const outputBmpPath = path.join(tmpDir, `${id}-output.bmp`);

  try {
    const appUser = await getAppUserFromRequest(req, res);
    if (!appUser) {
      return res.status(401).json({ error: "UNAUTHORIZED" });
    }
    const tokenCheck = await deductTokens(appUser.userId, "needle_engraving" as any, { checkOnly: true });
    if (!tokenCheck.success) {
      return res.status(402).json({ error: "INSUFFICIENT_TOKENS", balance: tokenCheck.balance });
    }

    const { prompt, widthCm, heightCm, dpi = "180", isPortrait = "false" } = req.body as {
      prompt: string;
      widthCm?: string;
      heightCm?: string;
      dpi?: string;
      isPortrait?: string;
    };

    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    // Step 1: Generate image with AI (grayscale, optimized for engraving)
    const engravingPrompt = isPortrait === "true"
      ? `Professional portrait: ${prompt}. Grayscale only, no color. High contrast, sharp facial details, smooth gradients. Black background. Optimized for diamond needle engraving on black granite.`
      : `${prompt}. Grayscale only, no color. High contrast, sharp details, clean composition. Black background. Optimized for diamond needle engraving on black granite.`;

    const { url: generatedUrl } = await generateImage({ prompt: engravingPrompt });
    if (!generatedUrl) throw new Error("AI image generation failed");

    // Step 2: Download generated image
    const genResponse = await fetch(generatedUrl);
    const genBuffer = Buffer.from(await genResponse.arrayBuffer());
    const genInputPath = path.join(tmpDir, `${id}-generated.png`);
    fs.writeFileSync(genInputPath, genBuffer);

    // Step 3: Upload generated image preview to S3 (before processing)
    const genPreviewKey = `engraving-gen-preview/${id}-generated.png`;
    const { url: generatedPreviewUrl } = await storagePut(genPreviewKey, genBuffer, "image/png");

    // Step 4: Run Python processing script
    const scriptPath = path.join(__dirname, "process_engraving.py");
    const args = [
      scriptPath,
      genInputPath,
      outputBmpPath,
      widthCm || "null",
      heightCm || "null",
      dpi,
    ];

    const { stdout, stderr } = await execFileAsync("python3", args, { timeout: 60000 });

    if (stderr && !stdout) {
      throw new Error(`Python error: ${stderr}`);
    }

    const result = JSON.parse(stdout.trim());
    if (result.error) {
      throw new Error(result.error);
    }

    // Step 5: Upload BMP to S3
    const bmpBuffer = fs.readFileSync(outputBmpPath);
    const bmpKey = `engraving-output/${id}.bmp`;
    const { url: bmpUrl } = await storagePut(bmpKey, bmpBuffer, "image/bmp");

    // Cleanup
    [genInputPath, outputBmpPath].forEach((f) => {
      try { fs.unlinkSync(f); } catch {}
    });

    // Deduct tokens after success
    await deductTokens(appUser.userId, "needle_engraving" as any);
    await recordUserAction({
      appUserId: appUser.userId,
      actionType: "convert",
      description: `needle_engraving_ai prompt="${prompt.slice(0, 60)}" dpi=${dpi}`,
    });

    return res.json({
      success: true,
      bmpUrl,
      previewUrl: generatedPreviewUrl,
      width: result.width,
      height: result.height,
      bitDepth: result.bitDepth,
      fileSizeKB: result.fileSizeKB,
      wasColorConverted: false,
      generatedImageUrl: generatedPreviewUrl,
    });
  } catch (err: unknown) {
    [outputBmpPath].forEach((f) => {
      try { fs.unlinkSync(f); } catch {}
    });
    const message = err instanceof Error ? err.message : String(err);
    console.error("[needle-engraving/generate] Error:", message);
    return res.status(500).json({ error: message });
  }
});

/**
 * Check if an image has meaningful color (not grayscale)
 */
async function checkIfColorImage(imagePath: string): Promise<boolean> {
  try {
    const { execFile: ef } = await import("child_process");
    const { promisify: prom } = await import("util");
    const efAsync = prom(ef);
    const script = `
import cv2
import numpy as np
import sys
img = cv2.imread(sys.argv[1])
if img is None:
    print("false")
    sys.exit(0)
b, g, r = cv2.split(img)
diff_rg = np.mean(np.abs(r.astype(int) - g.astype(int)))
diff_rb = np.mean(np.abs(r.astype(int) - b.astype(int)))
diff_gb = np.mean(np.abs(g.astype(int) - b.astype(int)))
is_color = max(diff_rg, diff_rb, diff_gb) > 10
print("true" if is_color else "false")
`;
    const { stdout } = await efAsync("python3", ["-c", script, imagePath], { timeout: 10000 });
    return stdout.trim() === "true";
  } catch {
    return false;
  }
}

export default router;

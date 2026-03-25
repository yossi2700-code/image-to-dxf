import { Router } from "express";
import multer from "multer";
import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import os from "os";
import sharp from "sharp";

const execFileAsync = promisify(execFile);
const router = Router();

// Accept any file — we validate it's a PDF by content, not MIME type
// iOS sometimes sends PDFs with wrong MIME types (e.g., application/octet-stream)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

/**
 * POST /api/pdf-to-image
 * Accepts a PDF file, converts the first page to a PNG image, returns it as base64.
 */
router.post("/pdf-to-image", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No PDF file provided" });
  }

  // Validate PDF magic bytes (%PDF-)
  const buf = req.file.buffer;
  const magic = buf.slice(0, 5).toString("ascii");
  if (magic !== "%PDF-") {
    return res.status(400).json({ error: "File is not a valid PDF" });
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pdf-convert-"));
  const pdfPath = path.join(tmpDir, "input.pdf");
  const outputPrefix = path.join(tmpDir, "page");

  try {
    // Write PDF buffer to temp file
    fs.writeFileSync(pdfPath, buf);

    // Convert first page to PNG using pdftoppm (poppler-utils, pre-installed)
    // -r 150: 150 DPI (good quality, reasonable size)
    // -f 1 -l 1: only first page
    // -png: output as PNG
    // -cropbox: use crop box for better rendering
    await execFileAsync("pdftoppm", [
      "-r", "150",
      "-f", "1",
      "-l", "1",
      "-png",
      "-cropbox",
      pdfPath,
      outputPrefix,
    ], { timeout: 30000 });

    // pdftoppm outputs files like page-1.png or page-01.png
    const files = fs.readdirSync(tmpDir).filter(f => f.startsWith("page") && f.endsWith(".png"));
    if (files.length === 0) {
      throw new Error("PDF conversion produced no output");
    }

    // Sort to get the first page file
    files.sort();
    const pngPath = path.join(tmpDir, files[0]);

    // Resize to max 2000px wide to keep file size reasonable
    const resized = await sharp(pngPath)
      .resize({ width: 2000, withoutEnlargement: true })
      .png({ compressionLevel: 6 })
      .toBuffer();

    const base64 = resized.toString("base64");
    const dataUrl = `data:image/png;base64,${base64}`;

    res.json({ success: true, dataUrl, mimeType: "image/png" });
  } catch (err: any) {
    console.error("[pdf-to-image] Error:", err?.message || err);
    res.status(500).json({ error: "Failed to convert PDF to image", details: err?.message });
  } finally {
    // Cleanup temp files
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  }
});

export default router;

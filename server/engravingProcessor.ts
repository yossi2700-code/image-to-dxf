/**
 * Diamond Needle Engraving Processor — Pure Node.js/sharp implementation.
 * Replaces process_engraving.py to avoid Python dependency in production.
 *
 * Pipeline:
 *  1. Convert to grayscale
 *  2. Resize if width/height specified
 *  3. Bilateral-like blur for noise reduction (median blur via sharp)
 *  4. CLAHE-like contrast enhancement (normalize + linear)
 *  5. Unsharp mask for sharpening
 *  6. Gamma correction for granite (darks preserved)
 *  7. Output as 8-bit BMP
 */

import sharp from "sharp";
import fs from "fs";
import path from "path";

/**
 * Convert any image buffer (HEIC, WebP, AVIF, JPEG, PNG, etc.) to PNG.
 * This ensures sharp can always read it downstream.
 */
async function normalizeToPNG(input: Buffer): Promise<Buffer> {
  // Check for HEIC magic bytes: ftyp box at offset 4
  const isHeic =
    input.length > 12 &&
    input[4] === 0x66 && input[5] === 0x74 && input[6] === 0x79 && input[7] === 0x70;

  if (isHeic) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const heicConvert = require("heic-convert");
      const outputBuffer = await heicConvert({
        buffer: input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength) as ArrayBuffer,
        format: "PNG",
      });
      return Buffer.from(outputBuffer);
    } catch {
      // fall through to sharp
    }
  }

  try {
    return await sharp(input).rotate().png().toBuffer();
  } catch {
    try {
      return await sharp(input, { failOn: "none" }).rotate().png().toBuffer();
    } catch {
      // Return as-is and let the caller handle the error
      return input;
    }
  }
}

export interface EngravingOptions {
  widthCm?: number;
  heightCm?: number;
  dpi?: number;
  isPortrait?: boolean;
}

export interface EngravingResult {
  width: number;
  height: number;
  bitDepth: number;
  fileSizeKB: number;
  bmpBuffer: Buffer;
  /** Raw 8-bit grayscale pixel data (width*height bytes) for creating JPEG/TIFF/PNG without re-parsing BMP */
  rawPixels: Buffer;
}

/**
 * Process an image buffer for granite diamond needle engraving.
 * Returns an 8-bit grayscale BMP buffer.
 */
export async function processForGraniteEngraving(
  inputBuffer: Buffer,
  options: EngravingOptions = {}
): Promise<EngravingResult> {
  const { widthCm, heightCm, dpi = 180 } = options;

  // ── 0. Normalize input to PNG (handles HEIC, WebP, AVIF, JPEG, etc.) ────────
  const normalizedBuffer = await normalizeToPNG(inputBuffer);

  // ── 1. Load & convert to grayscale ──────────────────────────────────────────
  let pipeline = sharp(normalizedBuffer).grayscale();

  // ── 2. Resize if dimensions specified ────────────────────────────────────────
  if (widthCm && heightCm) {
    const widthPx = Math.round((widthCm / 2.54) * dpi);
    const heightPx = Math.round((heightCm / 2.54) * dpi);
    pipeline = pipeline.resize(widthPx, heightPx, {
      fit: "fill",
      kernel: sharp.kernel.lanczos3,
    });
  } else if (widthCm) {
    const widthPx = Math.round((widthCm / 2.54) * dpi);
    pipeline = pipeline.resize(widthPx, null, {
      fit: "inside",
      kernel: sharp.kernel.lanczos3,
    });
  } else if (heightCm) {
    const heightPx = Math.round((heightCm / 2.54) * dpi);
    pipeline = pipeline.resize(null, heightPx, {
      fit: "inside",
      kernel: sharp.kernel.lanczos3,
    });
  }

  // ── 3. Get raw pixel data for processing ─────────────────────────────────────
  const { data: rawData, info } = await pipeline
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = new Uint8Array(rawData);
  const width = info.width;
  const height = info.height;
  const total = width * height;

  // ── 4. CLAHE-like contrast enhancement ───────────────────────────────────────
  // Compute histogram
  const hist = new Array(256).fill(0);
  for (let i = 0; i < total; i++) hist[pixels[i]]++;

  // Compute CDF
  const cdf = new Array(256).fill(0);
  cdf[0] = hist[0];
  for (let i = 1; i < 256; i++) cdf[i] = cdf[i - 1] + hist[i];

  // Find min non-zero CDF value
  let cdfMin = 0;
  for (let i = 0; i < 256; i++) {
    if (cdf[i] > 0) { cdfMin = cdf[i]; break; }
  }

  // Histogram equalization (CLAHE approximation)
  const lut = new Uint8Array(256);
  for (let i = 0; i < 256; i++) {
    lut[i] = Math.round(((cdf[i] - cdfMin) / (total - cdfMin)) * 255);
  }

  // Apply LUT
  const enhanced = new Uint8Array(total);
  for (let i = 0; i < total; i++) {
    enhanced[i] = lut[pixels[i]];
  }

  // ── 5. Unsharp mask (manual implementation) ───────────────────────────────────
  // Create blurred version using sharp
  const blurredBuf = await sharp(Buffer.from(enhanced), {
    raw: { width, height, channels: 1 },
  })
    .blur(2)
    .raw()
    .toBuffer();

  const blurred = new Uint8Array(blurredBuf);
  const sharpened = new Uint8Array(total);
  const unsharpAmount = 1.5; // strength of sharpening

  for (let i = 0; i < total; i++) {
    const diff = enhanced[i] - blurred[i];
    const val = Math.round(enhanced[i] + unsharpAmount * diff);
    sharpened[i] = Math.max(0, Math.min(255, val));
  }

  // ── 6. Gamma correction for granite (preserve darks) ─────────────────────────
  // Gamma < 1 brightens midtones, gamma > 1 darkens them
  // For granite engraving: use gamma ~0.85 to preserve shadow detail
  const gamma = 0.85;
  const gammaLut = new Uint8Array(256);
  for (let i = 0; i < 256; i++) {
    gammaLut[i] = Math.round(Math.pow(i / 255, gamma) * 255);
  }

  const gammaApplied = new Uint8Array(total);
  for (let i = 0; i < total; i++) {
    gammaApplied[i] = gammaLut[sharpened[i]];
  }

  // ── 7. Black point: ensure very dark pixels stay dark (granite background) ────
  const blackPoint = 8;
  const finalPixels = new Uint8Array(total);
  for (let i = 0; i < total; i++) {
    const v = gammaApplied[i];
    finalPixels[i] = v < blackPoint ? 0 : v;
  }

  // ── 8. Smart invert: granite machines engrave white on black.
  //        If the image has a dark background (avg < 110), invert.
  //        After invert, brighten midtones so the subject has visible grey detail
  //        (not just pure black/white) — this makes the horse look lighter.
  const avgBrightness = finalPixels.reduce((s, v) => s + v, 0) / total;
  const outputPixels = new Uint8Array(total);
  if (avgBrightness < 110) {
    // Dark background → invert so the subject becomes dark on white
    // Then apply a brightness lift: push midtones up by ~30 so details are visible
    const brightnessLift = 30;
    for (let i = 0; i < total; i++) {
      const inverted = 255 - finalPixels[i];
      // Lift: darks stay dark, midtones get brighter, whites stay white
      const lifted = inverted < 200 ? Math.min(255, inverted + Math.round(brightnessLift * (1 - inverted / 255))) : inverted;
      outputPixels[i] = lifted;
    }
  } else {
    outputPixels.set(finalPixels);
  }

  // ── 9. Output as 8-bit BMP (manual BMP header construction) ─────────────────
  // sharp doesn't support BMP output, so we build the BMP file manually
  const bmpBuffer = buildBmp8bit(outputPixels, width, height);

  return {
    width,
    height,
    bitDepth: 8,
    fileSizeKB: Math.round(bmpBuffer.length / 1024),
    bmpBuffer,
    rawPixels: Buffer.from(outputPixels),
  };
}

/**
 * Build a valid 8-bit grayscale BMP file from raw pixel data.
 * BMP format: BITMAPFILEHEADER (14 bytes) + BITMAPINFOHEADER (40 bytes) + palette (1024 bytes) + pixel data
 */
function buildBmp8bit(pixels: Uint8Array, width: number, height: number): Buffer {
  const rowSize = Math.ceil(width / 4) * 4; // rows padded to 4-byte boundary
  const pixelDataSize = rowSize * height;
  const paletteSize = 256 * 4; // 256 colors × 4 bytes (RGBQUAD)
  const headerSize = 14 + 40; // BITMAPFILEHEADER + BITMAPINFOHEADER
  const fileSize = headerSize + paletteSize + pixelDataSize;

  const buf = Buffer.alloc(fileSize, 0);
  let offset = 0;

  // ── BITMAPFILEHEADER ─────────────────────────────────────────────────────────
  buf.write("BM", offset); offset += 2;                          // bfType
  buf.writeUInt32LE(fileSize, offset); offset += 4;              // bfSize
  buf.writeUInt16LE(0, offset); offset += 2;                     // bfReserved1
  buf.writeUInt16LE(0, offset); offset += 2;                     // bfReserved2
  buf.writeUInt32LE(headerSize + paletteSize, offset); offset += 4; // bfOffBits

  // ── BITMAPINFOHEADER ─────────────────────────────────────────────────────────
  buf.writeUInt32LE(40, offset); offset += 4;                    // biSize
  buf.writeInt32LE(width, offset); offset += 4;                  // biWidth
  buf.writeInt32LE(-height, offset); offset += 4;                // biHeight (negative = top-down)
  buf.writeUInt16LE(1, offset); offset += 2;                     // biPlanes
  buf.writeUInt16LE(8, offset); offset += 2;                     // biBitCount (8-bit)
  buf.writeUInt32LE(0, offset); offset += 4;                     // biCompression (BI_RGB)
  buf.writeUInt32LE(pixelDataSize, offset); offset += 4;         // biSizeImage
  buf.writeInt32LE(2835, offset); offset += 4;                   // biXPelsPerMeter (~72 dpi)
  buf.writeInt32LE(2835, offset); offset += 4;                   // biYPelsPerMeter
  buf.writeUInt32LE(256, offset); offset += 4;                   // biClrUsed
  buf.writeUInt32LE(256, offset); offset += 4;                   // biClrImportant

  // ── Grayscale palette (256 entries) ─────────────────────────────────────────
  for (let i = 0; i < 256; i++) {
    buf[offset++] = i; // Blue
    buf[offset++] = i; // Green
    buf[offset++] = i; // Red
    buf[offset++] = 0; // Reserved
  }

  // ── Pixel data (bottom-up rows, padded) ─────────────────────────────────────
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      buf[offset + x] = pixels[y * width + x];
    }
    offset += rowSize;
  }

  return buf;
}

/**
 * Diamond Needle Engraving Processor — Pure Node.js/sharp implementation.
 * Based on technical spec: process_for_granite_engraving()
 *
 * Pipeline (per spec):
 *  0. Normalize input to PNG
 *  1. Convert to grayscale
 *  2. Resize if width/height specified
 *  3. CLAHE-like contrast enhancement (clipLimit=1.2, tileGridSize=16×16)
 *  4. Unsharp mask (amount=1.25, sigma=0.8) — gentle
 *  5. Black threshold: pixels < 15 → 0 (absolute black background)
 *  6. Output as 8-bit grayscale BMP
 */

import sharp from "sharp";

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
 * CLAHE (Contrast Limited Adaptive Histogram Equalization) approximation.
 * Divides image into tiles and equalizes each tile independently.
 * clipLimit controls contrast amplification (1.2 per spec).
 * tileSize: number of tiles per dimension (16 per spec).
 */
function applyCLAHE(
  pixels: Uint8Array,
  width: number,
  height: number,
  clipLimit: number = 1.2,
  tileCount: number = 16
): Uint8Array {
  const result = new Uint8Array(pixels.length);
  const tileW = Math.ceil(width / tileCount);
  const tileH = Math.ceil(height / tileCount);

  for (let ty = 0; ty < tileCount; ty++) {
    for (let tx = 0; tx < tileCount; tx++) {
      const x0 = tx * tileW;
      const y0 = ty * tileH;
      const x1 = Math.min(x0 + tileW, width);
      const y1 = Math.min(y0 + tileH, height);
      const tilePixels = (x1 - x0) * (y1 - y0);

      // Build histogram for this tile
      const hist = new Array(256).fill(0);
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          hist[pixels[y * width + x]]++;
        }
      }

      // Clip histogram at clipLimit * average
      const avgCount = tilePixels / 256;
      const clipThreshold = Math.round(clipLimit * avgCount);
      let excess = 0;
      for (let i = 0; i < 256; i++) {
        if (hist[i] > clipThreshold) {
          excess += hist[i] - clipThreshold;
          hist[i] = clipThreshold;
        }
      }
      // Redistribute excess uniformly
      const redistPerBin = Math.floor(excess / 256);
      const remainder = excess % 256;
      for (let i = 0; i < 256; i++) {
        hist[i] += redistPerBin;
      }
      for (let i = 0; i < remainder; i++) {
        hist[i]++;
      }

      // Build CDF and LUT
      const cdf = new Array(256).fill(0);
      cdf[0] = hist[0];
      for (let i = 1; i < 256; i++) cdf[i] = cdf[i - 1] + hist[i];

      let cdfMin = 0;
      for (let i = 0; i < 256; i++) {
        if (cdf[i] > 0) { cdfMin = cdf[i]; break; }
      }

      const lut = new Uint8Array(256);
      const denom = tilePixels - cdfMin;
      for (let i = 0; i < 256; i++) {
        lut[i] = denom > 0 ? Math.round(((cdf[i] - cdfMin) / denom) * 255) : 0;
      }

      // Apply LUT to tile pixels
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          result[y * width + x] = lut[pixels[y * width + x]];
        }
      }
    }
  }

  return result;
}

/**
 * Process an image buffer for granite diamond needle engraving.
 * Per technical spec:
 * - CLAHE clipLimit=1.2, tileGridSize=16×16
 * - Unsharp mask: amount=1.25, sigma=0.8
 * - Black threshold: 15
 * - Output: 8-bit grayscale BMP
 */
export async function processForGraniteEngraving(
  inputBuffer: Buffer,
  options: EngravingOptions = {}
): Promise<EngravingResult> {
  const { widthCm, heightCm, dpi = 180 } = options;

  // ── 0. Normalize input to PNG ────────────────────────────────────────────────
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

  // ── 3. Get raw pixel data ─────────────────────────────────────────────────────
  const { data: rawData, info } = await pipeline
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = new Uint8Array(rawData);
  const width = info.width;
  const height = info.height;
  const total = width * height;

  // ── 4. CLAHE (clipLimit=1.2, tileGridSize=16×16) per spec ────────────────────
  const claheResult = applyCLAHE(pixels, width, height, 1.2, 16);

  // ── 5. Unsharp mask: amount=1.25, sigma=0.8 (gentle, per spec) ───────────────
  // Blur with sigma=0.8 using sharp
  const blurredBuf = await sharp(Buffer.from(claheResult), {
    raw: { width, height, channels: 1 },
  })
    .blur(0.8)
    .raw()
    .toBuffer();

  const blurred = new Uint8Array(blurredBuf);
  const sharpened = new Uint8Array(total);
  const unsharpAmount = 1.25; // per spec: gray = addWeighted(gray, 1.25, blurred, -0.25, 0)

  for (let i = 0; i < total; i++) {
    // cv2.addWeighted(gray, 1.25, blurred, -0.25, 0) = gray*1.25 + blurred*(-0.25) + 0
    const val = Math.round(claheResult[i] * 1.25 + blurred[i] * (-0.25));
    sharpened[i] = Math.max(0, Math.min(255, val));
  }

  // ── 6. Black threshold: pixels < 15 → 0 (absolute black background, per spec) ─
  const outputPixels = new Uint8Array(total);
  for (let i = 0; i < total; i++) {
    outputPixels[i] = sharpened[i] < 15 ? 0 : sharpened[i];
  }

  // ── 7. Output as 8-bit BMP ───────────────────────────────────────────────────
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
  buf.writeInt32LE(height, offset); offset += 4;                 // biHeight (positive = bottom-up, standard BMP)
  buf.writeUInt16LE(1, offset); offset += 2;                     // biPlanes
  buf.writeUInt16LE(8, offset); offset += 2;                     // biBitCount (8-bit)
  buf.writeUInt32LE(0, offset); offset += 4;                     // biCompression (BI_RGB)
  buf.writeUInt32LE(pixelDataSize, offset); offset += 4;         // biSizeImage
  buf.writeInt32LE(Math.round(dpiToPixelsPerMeter(180)), offset); offset += 4; // biXPelsPerMeter
  buf.writeInt32LE(Math.round(dpiToPixelsPerMeter(180)), offset); offset += 4; // biYPelsPerMeter
  buf.writeUInt32LE(256, offset); offset += 4;                   // biClrUsed
  buf.writeUInt32LE(256, offset); offset += 4;                   // biClrImportant

  // ── Grayscale palette (256 entries) ─────────────────────────────────────────
  for (let i = 0; i < 256; i++) {
    buf[offset++] = i; // Blue
    buf[offset++] = i; // Green
    buf[offset++] = i; // Red
    buf[offset++] = 0; // Reserved
  }

  // ── Pixel data (bottom-up rows: last row first, padded to 4-byte boundary) ───
  for (let y = height - 1; y >= 0; y--) {
    for (let x = 0; x < width; x++) {
      buf[offset + x] = pixels[y * width + x];
    }
    offset += rowSize;
  }

  return buf;
}

function dpiToPixelsPerMeter(dpi: number): number {
  return Math.round(dpi / 0.0254);
}

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
 * CLAHE (Contrast Limited Adaptive Histogram Equalization) with bilinear interpolation.
 * Matches OpenCV's CLAHE behavior: builds per-tile LUTs then interpolates between
 * neighboring tile centers to eliminate hard block boundaries (the "square" artifact).
 * clipLimit=1.2, tileCount=8 (8×8 tiles per spec, interpolated).
 */
function buildTileLUT(
  pixels: Uint8Array,
  width: number,
  x0: number, y0: number, x1: number, y1: number,
  clipLimit: number
): Uint8Array {
  const tilePixels = (x1 - x0) * (y1 - y0);
  const hist = new Array(256).fill(0);
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      hist[pixels[y * width + x]]++;
    }
  }
  const avgCount = tilePixels / 256;
  const clipThreshold = Math.max(1, Math.round(clipLimit * avgCount));
  let excess = 0;
  for (let i = 0; i < 256; i++) {
    if (hist[i] > clipThreshold) { excess += hist[i] - clipThreshold; hist[i] = clipThreshold; }
  }
  const redistPerBin = Math.floor(excess / 256);
  const remainder = excess % 256;
  for (let i = 0; i < 256; i++) hist[i] += redistPerBin;
  for (let i = 0; i < remainder; i++) hist[i]++;

  const cdf = new Array(256).fill(0);
  cdf[0] = hist[0];
  for (let i = 1; i < 256; i++) cdf[i] = cdf[i - 1] + hist[i];
  let cdfMin = 0;
  for (let i = 0; i < 256; i++) { if (cdf[i] > 0) { cdfMin = cdf[i]; break; } }
  const lut = new Uint8Array(256);
  const denom = tilePixels - cdfMin;
  for (let i = 0; i < 256; i++) {
    lut[i] = denom > 0 ? Math.min(255, Math.round(((cdf[i] - cdfMin) / denom) * 255)) : 0;
  }
  return lut;
}

function applyCLAHE(
  pixels: Uint8Array,
  width: number,
  height: number,
  clipLimit: number = 1.2,
  tileCount: number = 8
): Uint8Array {
  // Build LUT for each tile
  const luts: Uint8Array[][] = [];
  const tileW = Math.ceil(width / tileCount);
  const tileH = Math.ceil(height / tileCount);

  // Tile center coordinates
  const tileCX: number[] = [];
  const tileCY: number[] = [];
  for (let t = 0; t < tileCount; t++) {
    tileCX.push(Math.min(t * tileW + tileW / 2, width - 1));
    tileCY.push(Math.min(t * tileH + tileH / 2, height - 1));
  }

  for (let ty = 0; ty < tileCount; ty++) {
    luts.push([]);
    for (let tx = 0; tx < tileCount; tx++) {
      const x0 = tx * tileW;
      const y0 = ty * tileH;
      const x1 = Math.min(x0 + tileW, width);
      const y1 = Math.min(y0 + tileH, height);
      luts[ty].push(buildTileLUT(pixels, width, x0, y0, x1, y1, clipLimit));
    }
  }

  // Apply with bilinear interpolation between tile LUTs
  const result = new Uint8Array(pixels.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const v = pixels[y * width + x];

      // Find which tile region we're in (by center proximity)
      let tx1 = 0;
      for (let t = 0; t < tileCount - 1; t++) {
        if (x >= tileCX[t]) tx1 = t; else break;
      }
      if (x >= tileCX[tileCount - 1]) tx1 = tileCount - 1;
      let tx2 = Math.min(tx1 + 1, tileCount - 1);
      // Recalculate properly
      tx1 = 0;
      for (let t = 0; t < tileCount; t++) {
        if (tileCX[t] <= x) tx1 = t;
      }
      tx2 = Math.min(tx1 + 1, tileCount - 1);

      let ty1 = 0;
      for (let t = 0; t < tileCount; t++) {
        if (tileCY[t] <= y) ty1 = t;
      }
      const ty2 = Math.min(ty1 + 1, tileCount - 1);

      // Bilinear weights
      const xSpan = tileCX[tx2] - tileCX[tx1];
      const ySpan = tileCY[ty2] - tileCY[ty1];
      const wx = xSpan > 0 ? (x - tileCX[tx1]) / xSpan : 0;
      const wy = ySpan > 0 ? (y - tileCY[ty1]) / ySpan : 0;

      const v00 = luts[ty1][tx1][v];
      const v10 = luts[ty1][tx2][v];
      const v01 = luts[ty2][tx1][v];
      const v11 = luts[ty2][tx2][v];

      const interpolated = v00 * (1 - wx) * (1 - wy)
        + v10 * wx * (1 - wy)
        + v01 * (1 - wx) * wy
        + v11 * wx * wy;

      result[y * width + x] = Math.min(255, Math.round(interpolated));
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

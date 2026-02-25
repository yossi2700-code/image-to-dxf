import sharp from "sharp";

export interface ProcessingOptions {
  threshold: number; // 0-255, default 128
  simplifyTolerance: number; // 0-10, default 1
}

export interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * Convert an image buffer to grayscale pixel data
 */
export async function imageToGrayscale(
  buffer: Buffer,
  maxSize = 2000
): Promise<{ pixels: Uint8Array; width: number; height: number }> {
  const img = sharp(buffer).grayscale();
  const meta = await img.metadata();

  let width = meta.width ?? 800;
  let height = meta.height ?? 600;

  // Scale down if too large
  if (width > maxSize || height > maxSize) {
    const scale = maxSize / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const { data } = await sharp(buffer)
    .grayscale()
    .resize(width, height)
    .raw()
    .toBuffer({ resolveWithObject: true });

  return { pixels: new Uint8Array(data), width, height };
}

/**
 * Apply threshold to produce binary image (0 = black, 255 = white)
 */
export function applyThreshold(
  pixels: Uint8Array,
  threshold: number
): Uint8Array {
  const binary = new Uint8Array(pixels.length);
  for (let i = 0; i < pixels.length; i++) {
    binary[i] = pixels[i] < threshold ? 0 : 255;
  }
  return binary;
}

/**
 * Sobel edge detection on binary image
 * Returns edge map where 255 = edge pixel
 */
export function sobelEdgeDetection(
  pixels: Uint8Array,
  width: number,
  height: number
): Uint8Array {
  const edges = new Uint8Array(width * height);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;

      const tl = pixels[(y - 1) * width + (x - 1)];
      const tm = pixels[(y - 1) * width + x];
      const tr = pixels[(y - 1) * width + (x + 1)];
      const ml = pixels[y * width + (x - 1)];
      const mr = pixels[y * width + (x + 1)];
      const bl = pixels[(y + 1) * width + (x - 1)];
      const bm = pixels[(y + 1) * width + x];
      const br = pixels[(y + 1) * width + (x + 1)];

      const gx = -tl - 2 * ml - bl + tr + 2 * mr + br;
      const gy = -tl - 2 * tm - tr + bl + 2 * bm + br;

      const magnitude = Math.sqrt(gx * gx + gy * gy);
      edges[idx] = magnitude > 50 ? 255 : 0;
    }
  }

  return edges;
}

/**
 * Convert edge pixels to horizontal and vertical line segments
 * Groups consecutive edge pixels in rows and columns into segments
 */
export function edgesToSegments(
  edges: Uint8Array,
  width: number,
  height: number,
  options: ProcessingOptions
): Segment[] {
  const segments: Segment[] = [];
  const { simplifyTolerance } = options;
  const minLen = Math.max(1, simplifyTolerance);

  // Horizontal runs
  for (let y = 0; y < height; y++) {
    let runStart = -1;
    for (let x = 0; x <= width; x++) {
      const isEdge = x < width && edges[y * width + x] === 255;
      if (isEdge && runStart === -1) {
        runStart = x;
      } else if (!isEdge && runStart !== -1) {
        const len = x - runStart;
        if (len >= minLen) {
          segments.push({ x1: runStart, y1: y, x2: x - 1, y2: y });
        }
        runStart = -1;
      }
    }
  }

  // Vertical runs
  for (let x = 0; x < width; x++) {
    let runStart = -1;
    for (let y = 0; y <= height; y++) {
      const isEdge = y < height && edges[y * width + x] === 255;
      if (isEdge && runStart === -1) {
        runStart = y;
      } else if (!isEdge && runStart !== -1) {
        const len = y - runStart;
        if (len >= minLen) {
          segments.push({ x1: x, y1: runStart, x2: x, y2: y - 1 });
        }
        runStart = -1;
      }
    }
  }

  return segments;
}

/**
 * Generate DXF file content from line segments
 * Produces a valid DXF R12 file
 */
export function segmentsToDxf(
  segments: Segment[],
  width: number,
  height: number
): string {
  const lines: string[] = [];

  // DXF Header
  lines.push("0\nSECTION");
  lines.push("2\nHEADER");
  lines.push("9\n$ACADVER");
  lines.push("1\nAC1009");
  lines.push("9\n$EXTMIN");
  lines.push("10\n0.0");
  lines.push("20\n0.0");
  lines.push("30\n0.0");
  lines.push("9\n$EXTMAX");
  lines.push(`10\n${width}.0`);
  lines.push(`20\n${height}.0`);
  lines.push("30\n0.0");
  lines.push("0\nENDSEC");

  // Tables section
  lines.push("0\nSECTION");
  lines.push("2\nTABLES");
  lines.push("0\nTABLE");
  lines.push("2\nLAYER");
  lines.push("70\n1");
  lines.push("0\nLAYER");
  lines.push("2\n0");
  lines.push("70\n0");
  lines.push("62\n7");
  lines.push("6\nCONTINUOUS");
  lines.push("0\nENDTAB");
  lines.push("0\nENDSEC");

  // Entities section
  lines.push("0\nSECTION");
  lines.push("2\nENTITIES");

  for (const seg of segments) {
    // Flip Y axis so image top = DXF top
    const y1 = height - seg.y1;
    const y2 = height - seg.y2;

    lines.push("0\nLINE");
    lines.push("8\n0"); // Layer 0
    lines.push(`10\n${seg.x1}`);
    lines.push(`20\n${y1}`);
    lines.push("30\n0.0");
    lines.push(`11\n${seg.x2}`);
    lines.push(`21\n${y2}`);
    lines.push("31\n0.0");
  }

  lines.push("0\nENDSEC");
  lines.push("0\nEOF");

  return lines.join("\n");
}

/**
 * Full pipeline: image buffer → DXF string
 */
export async function convertImageToDxf(
  buffer: Buffer,
  options: ProcessingOptions
): Promise<{ dxf: string; segmentCount: number; width: number; height: number }> {
  const { pixels, width, height } = await imageToGrayscale(buffer);
  const binary = applyThreshold(pixels, options.threshold);
  const edges = sobelEdgeDetection(binary, width, height);
  const segments = edgesToSegments(edges, width, height, options);
  const dxf = segmentsToDxf(segments, width, height);

  return { dxf, segmentCount: segments.length, width, height };
}

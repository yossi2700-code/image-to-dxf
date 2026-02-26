import sharp from "sharp";

export interface ProcessingOptions {
  threshold: number;          // 0-255, default 128
  simplifyTolerance: number;  // 0-10, default 1
  doubleLineOffset?: number;  // pixels to offset for double-line CNC mode (0 = disabled)
  minSegmentLength?: number;  // minimum segment length in pixels; shorter segments are filtered as noise
}

export interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** A polyline is an ordered list of [x, y] points */
export type Polyline = Array<[number, number]>;

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
 * Convert edge pixels to horizontal and vertical line segments.
 * Groups consecutive edge pixels in rows and columns into segments.
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
 * Chain individual segments into continuous polylines by connecting
 * segments whose endpoints are within `snapDist` pixels of each other.
 *
 * This is the key step that enables clean parallel-offset double lines:
 * instead of offsetting each short segment independently (which creates
 * a "ladder" of cross-connecting lines), we first build long continuous
 * paths and then offset the entire path.
 */
export function chainSegmentsToPolylines(
  segments: Segment[],
  snapDist = 2
): Polyline[] {
  if (segments.length === 0) return [];

  // Build adjacency: for each endpoint, store which segment indices touch it
  // We use a grid-based lookup for performance
  type EndpointKey = string;
  const endpointMap = new Map<EndpointKey, number[]>();

  const key = (x: number, y: number): EndpointKey =>
    `${Math.round(x)},${Math.round(y)}`;

  const addEndpoint = (x: number, y: number, idx: number) => {
    const k = key(x, y);
    const list = endpointMap.get(k);
    if (list) list.push(idx);
    else endpointMap.set(k, [idx]);
  };

  segments.forEach((seg, idx) => {
    addEndpoint(seg.x1, seg.y1, idx);
    addEndpoint(seg.x2, seg.y2, idx);
  });

  const used = new Uint8Array(segments.length);
  const polylines: Polyline[] = [];

  // Find neighbours of a point within snapDist
  const findNeighbours = (x: number, y: number, excludeIdx: number): number[] => {
    const result: number[] = [];
    // Check a small grid around the point
    for (let dy = -snapDist; dy <= snapDist; dy++) {
      for (let dx = -snapDist; dx <= snapDist; dx++) {
        const k = key(x + dx, y + dy);
        const list = endpointMap.get(k);
        if (list) {
          for (const idx of list) {
            if (idx !== excludeIdx && !used[idx]) {
              result.push(idx);
            }
          }
        }
      }
    }
    return result;
  };

  for (let startIdx = 0; startIdx < segments.length; startIdx++) {
    if (used[startIdx]) continue;

    // Start a new polyline from this segment
    used[startIdx] = 1;
    const seg = segments[startIdx];
    const polyline: Polyline = [[seg.x1, seg.y1], [seg.x2, seg.y2]];

    // Extend forward from the tail
    let extended = true;
    while (extended) {
      extended = false;
      const [tx, ty] = polyline[polyline.length - 1];
      const neighbours = findNeighbours(tx, ty, -1);
      for (const nIdx of neighbours) {
        if (used[nIdx]) continue;
        const ns = segments[nIdx];
        // Determine which end of ns connects to (tx, ty)
        const d1 = Math.abs(ns.x1 - tx) + Math.abs(ns.y1 - ty);
        const d2 = Math.abs(ns.x2 - tx) + Math.abs(ns.y2 - ty);
        if (d1 <= snapDist * 2) {
          used[nIdx] = 1;
          polyline.push([ns.x2, ns.y2]);
          extended = true;
          break;
        } else if (d2 <= snapDist * 2) {
          used[nIdx] = 1;
          polyline.push([ns.x1, ns.y1]);
          extended = true;
          break;
        }
      }
    }

    // Extend backward from the head
    extended = true;
    while (extended) {
      extended = false;
      const [hx, hy] = polyline[0];
      const neighbours = findNeighbours(hx, hy, -1);
      for (const nIdx of neighbours) {
        if (used[nIdx]) continue;
        const ns = segments[nIdx];
        const d1 = Math.abs(ns.x1 - hx) + Math.abs(ns.y1 - hy);
        const d2 = Math.abs(ns.x2 - hx) + Math.abs(ns.y2 - hy);
        if (d1 <= snapDist * 2) {
          used[nIdx] = 1;
          polyline.unshift([ns.x2, ns.y2]);
          extended = true;
          break;
        } else if (d2 <= snapDist * 2) {
          used[nIdx] = 1;
          polyline.unshift([ns.x1, ns.y1]);
          extended = true;
          break;
        }
      }
    }

    if (polyline.length >= 2) {
      polylines.push(polyline);
    }
  }

  return polylines;
}

/**
 * Compute the parallel offset of a polyline.
 * For each vertex, the offset direction is the average of the normals
 * of the adjacent edges (miter join), clamped to avoid extreme spikes.
 *
 * Returns the offset polyline (same number of points).
 */
export function offsetPolyline(polyline: Polyline, offset: number): Polyline {
  const n = polyline.length;
  if (n < 2) return polyline;

  const result: Polyline = [];

  for (let i = 0; i < n; i++) {
    const [x, y] = polyline[i];

    // Edge vectors adjacent to this vertex
    let nx = 0;
    let ny = 0;
    let count = 0;

    if (i > 0) {
      // Vector from prev to current
      const dx = x - polyline[i - 1][0];
      const dy = y - polyline[i - 1][1];
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > 0.001) {
        // Right-hand normal: (dy, -dx) — offset to the right of travel direction
        nx += dy / len;
        ny += -dx / len;
        count++;
      }
    }

    if (i < n - 1) {
      // Vector from current to next
      const dx = polyline[i + 1][0] - x;
      const dy = polyline[i + 1][1] - y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > 0.001) {
        nx += dy / len;
        ny += -dx / len;
        count++;
      }
    }

    if (count === 0) {
      result.push([x, y]);
      continue;
    }

    // Average normal
    nx /= count;
    ny /= count;

    // Normalise the miter vector and scale by offset
    const miterLen = Math.sqrt(nx * nx + ny * ny);
    if (miterLen < 0.001) {
      result.push([x, y]);
      continue;
    }

    // Scale the normalised miter vector by `offset`.
    // We clamp the magnitude to avoid extreme spikes at sharp corners,
    // but preserve the sign so negative offsets work correctly.
    const absMiter = miterLen;
    const absOffset = Math.abs(offset);
    const clampedMag = Math.min(absOffset / absMiter, absOffset * 3);
    const scale = Math.sign(offset) * clampedMag;
    result.push([x + nx * scale, y + ny * scale]);
  }

  return result;
}

/**
 * Convert polylines back to Segment[] for DXF/SVG output.
 */
export function polylinesToSegments(polylines: Polyline[]): Segment[] {
  const segments: Segment[] = [];
  for (const poly of polylines) {
    for (let i = 0; i < poly.length - 1; i++) {
      segments.push({
        x1: poly[i][0],
        y1: poly[i][1],
        x2: poly[i + 1][0],
        y2: poly[i + 1][1],
      });
    }
  }
  return segments;
}

/**
 * Apply double-line CNC offset to a set of polylines.
 *
 * For each polyline we generate TWO parallel offset paths:
 *   - one shifted +offset/2 to the left
 *   - one shifted -offset/2 to the right
 *
 * This gives two clean, continuous parallel lines with the specified gap
 * between them — exactly what a CNC milling bit needs to carve between.
 *
 * No end-caps, no cross-connecting segments.
 */
export function doubleLinePolylines(
  polylines: Polyline[],
  offset: number
): Polyline[] {
  if (offset <= 0) return polylines;

  const result: Polyline[] = [];
  const halfOffset = offset / 2;

  for (const poly of polylines) {
    const left = offsetPolyline(poly, halfOffset);
    const right = offsetPolyline(poly, -halfOffset);
    result.push(left);
    result.push(right);
  }

  return result;
}

/**
 * Legacy function kept for backward compatibility and simple cases.
 * For the full pipeline, use doubleLinePolylines instead.
 */
export function doubleLineSegments(
  segments: Segment[],
  offset: number
): Segment[] {
  if (offset <= 0) return segments;

  const result: Segment[] = [...segments];

  for (const seg of segments) {
    const isHorizontal = seg.y1 === seg.y2;
    const isVertical = seg.x1 === seg.x2;

    if (isHorizontal) {
      result.push({ x1: seg.x1, y1: seg.y1 - offset, x2: seg.x2, y2: seg.y2 - offset });
    } else if (isVertical) {
      result.push({ x1: seg.x1 + offset, y1: seg.y1, x2: seg.x2 + offset, y2: seg.y2 });
    } else {
      const dx = seg.x2 - seg.x1;
      const dy = seg.y2 - seg.y1;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len < 0.001) continue;
      const nx = (-dy / len) * offset;
      const ny = (dx / len) * offset;

      result.push({
        x1: Math.round(seg.x1 + nx),
        y1: Math.round(seg.y1 + ny),
        x2: Math.round(seg.x2 + nx),
        y2: Math.round(seg.y2 + ny),
      });
    }
  }

  return result;
}

/**
 * Generate DXF file content from line segments (DXF R12)
 */
export function segmentsToDxf(
  segments: Segment[],
  width: number,
  height: number
): string {
  const lines: string[] = [];

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

  lines.push("0\nSECTION");
  lines.push("2\nENTITIES");

  for (const seg of segments) {
    const y1 = height - seg.y1;
    const y2 = height - seg.y2;

    lines.push("0\nLINE");
    lines.push("8\n0");
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
 * Generate SVG preview from line segments
 */
export function segmentsToSvg(
  segments: Segment[],
  width: number,
  height: number
): string {
  const lines: string[] = [];
  lines.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" style="background:#fff">`
  );
  for (const seg of segments) {
    lines.push(
      `<line x1="${seg.x1}" y1="${seg.y1}" x2="${seg.x2}" y2="${seg.y2}" stroke="#1a1a2e" stroke-width="0.8" stroke-linecap="round"/>`
    );
  }
  lines.push("</svg>");
  return lines.join("\n");
}

/**
 * Generate SVG preview from polylines — uses <polyline> elements for smooth continuous lines
 */
export function polylinesToSvg(
  polylines: Polyline[],
  width: number,
  height: number
): string {
  const lines: string[] = [];
  lines.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" style="background:#fff">`
  );
  for (const poly of polylines) {
    if (poly.length < 2) continue;
    const pts = poly.map(([x, y]) => `${x},${y}`).join(" ");
    lines.push(
      `<polyline points="${pts}" fill="none" stroke="#1a1a2e" stroke-width="0.8" stroke-linecap="round" stroke-linejoin="round"/>`
    );
  }
  lines.push("</svg>");
  return lines.join("\n");
}

/**
 * Full pipeline: image buffer → DXF string
 *
 * Double-line mode (doubleLineOffset > 0):
 *   1. Detect edges → raw segments
 *   2. Chain segments into continuous polylines (snap nearby endpoints)
 *   3. Apply ±offset/2 parallel offset to each polyline → two clean parallel paths
 *   4. Convert back to segments for DXF/SVG output
 *
 * This produces two smooth, continuous parallel lines with no "ladder"
 * cross-connecting artefacts — exactly what a CNC milling bit needs.
 */
export async function convertImageToDxf(
  buffer: Buffer,
  options: ProcessingOptions
): Promise<{
  dxf: string;
  svgPreview: string;
  segmentCount: number;
  width: number;
  height: number;
}> {
  const { pixels, width, height } = await imageToGrayscale(buffer);
  const binary = applyThreshold(pixels, options.threshold);
  const edges = sobelEdgeDetection(binary, width, height);
  const rawSegments = edgesToSegments(edges, width, height, options);

  // Filter out very short segments (noise/artifacts) before further processing
  const minLen = options.minSegmentLength ?? 0;
  const filteredSegments = minLen > 0
    ? rawSegments.filter((s) => {
        const dx = s.x2 - s.x1;
        const dy = s.y2 - s.y1;
        return Math.sqrt(dx * dx + dy * dy) >= minLen;
      })
    : rawSegments;

  // Always chain segments into continuous polylines for smooth output.
  // This eliminates the "dashed line" effect caused by many short disconnected segments.
  const polylines = chainSegmentsToPolylines(filteredSegments, 2);

  let outputPolylines: Polyline[];

  if (options.doubleLineOffset && options.doubleLineOffset > 0) {
    outputPolylines = doubleLinePolylines(polylines, options.doubleLineOffset);
  } else {
    outputPolylines = polylines;
  }

  const segments = polylinesToSegments(outputPolylines);

  const dxf = segmentsToDxf(segments, width, height);
  const svgPreview = polylinesToSvg(outputPolylines, width, height);

  return { dxf, svgPreview, segmentCount: segments.length, width, height };
}

import sharp from "sharp";

export interface ProcessingOptions {
  threshold: number;          // 0-255, default 128
  simplifyTolerance: number;  // 0-10, default 1
  doubleLineOffset?: number;  // pixels to offset for double-line CNC mode (0 = disabled)
  minSegmentLength?: number;  // minimum segment length in pixels; shorter segments are filtered as noise
  hairline?: boolean;         // if true, DXF uses R2000 format with lineweight=0 (hairline)
  lineweightMm?: number;      // explicit lineweight in mm (e.g. 0.2); overrides hairline when set
  minGapMm?: number;          // minimum gap between lines in mm; auto-scales DXF if lines are too close (default: 0 = disabled)
  dpi?: number;               // image DPI for mm calculations (default: 300)
  outputWidthMm?: number;     // target output width in mm; scales DXF proportionally (default: 100mm)
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
 * Zhang-Suen thinning algorithm — reduces thick edges to single-pixel-wide skeleton.
 * This eliminates the "double line" effect caused by Sobel detecting both sides of a stroke.
 *
 * Input: edge map (255 = edge pixel, 0 = background)
 * Output: thinned edge map (same format)
 */
export function thinEdges(
  edges: Uint8Array,
  width: number,
  height: number
): Uint8Array {
  // Work on a copy; 1 = foreground (edge), 0 = background
  const img = new Uint8Array(edges.length);
  for (let i = 0; i < edges.length; i++) img[i] = edges[i] === 255 ? 1 : 0;

  const idx = (x: number, y: number) => y * width + x;

  let changed = true;
  while (changed) {
    changed = false;

    for (let pass = 0; pass < 2; pass++) {
      const toDelete: number[] = [];

      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          if (img[idx(x, y)] !== 1) continue;

          // 8-neighbours in order: P2..P9 (clockwise from top)
          const p2 = img[idx(x,     y - 1)];
          const p3 = img[idx(x + 1, y - 1)];
          const p4 = img[idx(x + 1, y    )];
          const p5 = img[idx(x + 1, y + 1)];
          const p6 = img[idx(x,     y + 1)];
          const p7 = img[idx(x - 1, y + 1)];
          const p8 = img[idx(x - 1, y    )];
          const p9 = img[idx(x - 1, y - 1)];

          const B = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9; // neighbour count
          if (B < 2 || B > 6) continue;

          // Count 0→1 transitions in the ordered sequence
          const seq = [p2, p3, p4, p5, p6, p7, p8, p9, p2];
          let A = 0;
          for (let k = 0; k < 8; k++) if (seq[k] === 0 && seq[k + 1] === 1) A++;
          if (A !== 1) continue;

          if (pass === 0) {
            if (p2 * p4 * p6 !== 0) continue;
            if (p4 * p6 * p8 !== 0) continue;
          } else {
            if (p2 * p4 * p8 !== 0) continue;
            if (p2 * p6 * p8 !== 0) continue;
          }

          toDelete.push(idx(x, y));
        }
      }

      if (toDelete.length > 0) {
        changed = true;
        for (const i of toDelete) img[i] = 0;
      }
    }
  }

  // Convert back to 0/255 format
  const result = new Uint8Array(edges.length);
  for (let i = 0; i < img.length; i++) result[i] = img[i] === 1 ? 255 : 0;
  return result;
}

/**
 * Douglas-Peucker polyline simplification.
 * Reduces the number of points while preserving shape.
 * epsilon = max allowed deviation in pixels.
 */
export function douglasPeucker(
  points: Polyline,
  epsilon: number
): Polyline {
  if (points.length <= 2) return points;

  // Find the point with max distance from the line between first and last
  let maxDist = 0;
  let maxIdx = 0;
  const [x1, y1] = points[0];
  const [x2, y2] = points[points.length - 1];
  const lineLen = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);

  for (let i = 1; i < points.length - 1; i++) {
    const [px, py] = points[i];
    let dist: number;
    if (lineLen < 0.001) {
      dist = Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
    } else {
      // Perpendicular distance from point to line
      dist = Math.abs((y2 - y1) * px - (x2 - x1) * py + x2 * y1 - y2 * x1) / lineLen;
    }
    if (dist > maxDist) {
      maxDist = dist;
      maxIdx = i;
    }
  }

  if (maxDist > epsilon) {
    const left = douglasPeucker(points.slice(0, maxIdx + 1), epsilon);
    const right = douglasPeucker(points.slice(maxIdx), epsilon);
    return [...left.slice(0, -1), ...right];
  } else {
    return [points[0], points[points.length - 1]];
  }
}

/**
 * 8-connectivity centerline tracing.
 * Traces thinned edge pixels following 8-connected neighbours (including diagonals).
 * Returns polylines — each is an ordered list of pixel coordinates.
 *
 * This produces smooth diagonal lines instead of the staircase effect
 * from the horizontal/vertical-only edgesToSegments approach.
 */
export function traceCenterlines(
  edges: Uint8Array,
  width: number,
  height: number,
  simplifyEpsilon = 1.5
): Polyline[] {
  const visited = new Uint8Array(edges.length);
  const polylines: Polyline[] = [];

  // 8-connected neighbours in order
  const DIRS = [
    [-1, -1], [0, -1], [1, -1],
    [-1,  0],          [1,  0],
    [-1,  1], [0,  1], [1,  1],
  ];

  const idx = (x: number, y: number) => y * width + x;
  const isEdge = (x: number, y: number) =>
    x >= 0 && x < width && y >= 0 && y < height && edges[idx(x, y)] === 255;

  // Count neighbours for a pixel
  const countNeighbours = (x: number, y: number): number => {
    let count = 0;
    for (const [dx, dy] of DIRS) {
      if (isEdge(x + dx, y + dy) && !visited[idx(x + dx, y + dy)]) count++;
    }
    return count;
  };

  // Trace a single polyline starting from (startX, startY)
  const traceFrom = (startX: number, startY: number): Polyline => {
    const poly: Polyline = [[startX, startY]];
    visited[idx(startX, startY)] = 1;
    let cx = startX, cy = startY;

    while (true) {
      let bestX = -1, bestY = -1;
      let bestScore = -1;

      for (const [dx, dy] of DIRS) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (!isEdge(nx, ny) || visited[idx(nx, ny)]) continue;
        // Prefer continuing in the same direction (momentum)
        const lastPt = poly.length >= 2 ? poly[poly.length - 2] : null;
        const momentum = lastPt
          ? (dx === (cx - lastPt[0]) && dy === (cy - lastPt[1]) ? 2 : 1)
          : 1;
        const score = momentum;
        if (score > bestScore) {
          bestScore = score;
          bestX = nx;
          bestY = ny;
        }
      }

      if (bestX === -1) break;
      visited[idx(bestX, bestY)] = 1;
      poly.push([bestX, bestY]);
      cx = bestX;
      cy = bestY;
    }

    return poly;
  };

  // Find all endpoint pixels (degree 1) first — start traces from endpoints
  // Then handle loops (degree 2+ with no unvisited endpoints)
  const endpoints: Array<[number, number]> = [];
  const junctions: Array<[number, number]> = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (edges[idx(x, y)] !== 255) continue;
      const n = countNeighbours(x, y);
      if (n <= 1) endpoints.push([x, y]);
      else if (n >= 3) junctions.push([x, y]);
    }
  }

  // Trace from endpoints first
  for (const [ex, ey] of endpoints) {
    if (visited[idx(ex, ey)]) continue;
    const poly = traceFrom(ex, ey);
    if (poly.length >= 2) {
      polylines.push(simplifyEpsilon > 0 ? douglasPeucker(poly, simplifyEpsilon) : poly);
    }
  }

  // Trace remaining unvisited pixels (loops and isolated segments)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (edges[idx(x, y)] !== 255 || visited[idx(x, y)]) continue;
      const poly = traceFrom(x, y);
      if (poly.length >= 2) {
        polylines.push(simplifyEpsilon > 0 ? douglasPeucker(poly, simplifyEpsilon) : poly);
      }
    }
  }

  return polylines;
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
 * Generate DXF file content from polylines (DXF R2000 LWPOLYLINE).
 * Each polyline becomes a single LWPOLYLINE entity — connected, not fragmented.
 */
// DXF R2000 lineweight codes (group 370): standard values in hundredths of mm
const DXF_LW_CODES = [0, 5, 9, 13, 15, 18, 20, 25, 30, 35, 40, 50, 53, 60, 70, 80, 90, 100, 106, 120, 140, 158, 200, 211];

/** Convert mm value to nearest DXF lineweight code (hundredths of mm) */
function mmToLwCode(mm: number): number {
  const hundredths = Math.round(mm * 100);
  let best = DXF_LW_CODES[0];
  let bestDiff = Math.abs(hundredths - best);
  for (const code of DXF_LW_CODES) {
    const diff = Math.abs(hundredths - code);
    if (diff < bestDiff) { best = code; bestDiff = diff; }
  }
  return best;
}

/**
 * Write polylines as DXF LWPOLYLINE entities (R2000).
 * Each polyline = one connected object in CAD software.
 */
export function polylinesToDxf(
  polylines: Polyline[],
  width: number,
  height: number,
  hairline = false,
  lineweightMm?: number
): string {
  const lwCode = lineweightMm != null
    ? mmToLwCode(lineweightMm)
    : hairline ? 0 : null;
  const useLw = lwCode !== null;

  const lines: string[] = [];

  lines.push("0\nSECTION");
  lines.push("2\nHEADER");
  lines.push("9\n$ACADVER\n1\nAC1015"); // R2000 required for LWPOLYLINE
  lines.push(`9\n$EXTMIN\n10\n0.0\n20\n0.0\n30\n0.0`);
  lines.push(`9\n$EXTMAX\n10\n${width}\n20\n${height}\n30\n0.0`);
  lines.push("0\nENDSEC");

  lines.push("0\nSECTION\n2\nTABLES");
  lines.push("0\nTABLE\n2\nLAYER\n70\n1");
  lines.push(useLw
    ? `0\nLAYER\n2\n0\n70\n0\n62\n7\n6\nCONTINUOUS\n370\n${lwCode}`
    : "0\nLAYER\n2\n0\n70\n0\n62\n7\n6\nCONTINUOUS");
  lines.push("0\nENDTAB\n0\nENDSEC");

  lines.push("0\nSECTION\n2\nENTITIES");

  for (const poly of polylines) {
    if (poly.length < 2) continue;
    lines.push("0\nLWPOLYLINE");
    lines.push("8\n0");                        // layer
    if (useLw) lines.push(`370\n${lwCode}`);
    lines.push("90\n" + poly.length);           // vertex count
    lines.push("70\n0");                        // open polyline
    lines.push("43\n0.0");                      // constant width = 0
    for (const [px, py] of poly) {
      const dxfY = height - py;                 // flip Y
      lines.push(`10\n${px.toFixed(3)}`);
      lines.push(`20\n${dxfY.toFixed(3)}`);
    }
  }

  lines.push("0\nENDSEC\n0\nEOF");
  return lines.join("\n");
}

/** @deprecated Use polylinesToDxf instead — kept for backward compatibility */
export function segmentsToDxf(
  segments: Segment[],
  width: number,
  height: number,
  hairline = false,
  lineweightMm?: number
): string {
  // Convert segments to polylines by chaining them, then use polylinesToDxf
  const polylines = chainSegmentsToPolylines(segments, 2);
  return polylinesToDxf(polylines, width, height, hairline, lineweightMm);
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
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" style="background:#fff">`
  );
  for (const seg of segments) {
    lines.push(
      `<line x1="${seg.x1}" y1="${seg.y1}" x2="${seg.x2}" y2="${seg.y2}" stroke="#1a1a2e" stroke-width="0.4" stroke-linecap="round"/>`
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
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" style="background:#fff">`
  );
  for (const poly of polylines) {
    if (poly.length < 2) continue;
    const pts = poly.map(([x, y]) => `${x},${y}`).join(" ");
    lines.push(
      `<polyline points="${pts}" fill="none" stroke="#1a1a2e" stroke-width="0.4" stroke-linecap="round" stroke-linejoin="round"/>`
    );
  }
  lines.push("</svg>");
  return lines.join("\n");
}

/**
 * Morphological erosion on a binary image (0=foreground/black, 255=background/white).
 * Shrinks foreground pixels by removing those that have any background neighbor.
 * Used to pre-thin thick scanned strokes before Zhang-Suen thinning.
 * Each call reduces stroke width by ~1 pixel on each side.
 */
export function erodeBinary(
  binary: Uint8Array,
  width: number,
  height: number,
  iterations = 1
): Uint8Array {
  let current = binary;
  for (let iter = 0; iter < iterations; iter++) {
    const next = new Uint8Array(current.length).fill(255); // start as all background
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const i = y * width + x;
        if (current[i] !== 0) continue; // not foreground
        // Keep foreground only if all 8 neighbors are also foreground
        const allFg =
          current[(y-1)*width+(x-1)] === 0 &&
          current[(y-1)*width+x    ] === 0 &&
          current[(y-1)*width+(x+1)] === 0 &&
          current[y    *width+(x-1)] === 0 &&
          current[y    *width+(x+1)] === 0 &&
          current[(y+1)*width+(x-1)] === 0 &&
          current[(y+1)*width+x    ] === 0 &&
          current[(y+1)*width+(x+1)] === 0;
        if (allFg) next[i] = 0; // keep as foreground
      }
    }
    current = next;
  }
  return current;
}

/**
 * Thin a binary image (0=black/foreground, 255=white/background) using Zhang-Suen.
 * Unlike thinEdges (which works on Sobel output), this works directly on the
 * black pixels of a line drawing — producing the TRUE skeleton/centerline.
 *
 * Input: binary image where 0 = black (line), 255 = white (background)
 * Output: thinned image in same format
 */
export function thinBinary(
  binary: Uint8Array,
  width: number,
  height: number,
  maxIterations = 120
): Uint8Array {
  // Convert: 0 (black) → 1 (foreground), 255 (white) → 0 (background)
  const img = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) img[i] = binary[i] === 0 ? 1 : 0;

  const idx = (x: number, y: number) => y * width + x;

  let changed = true;
  let iterations = 0;
  while (changed && iterations < maxIterations) {
    changed = false;
    iterations++;
    for (let pass = 0; pass < 2; pass++) {
      const toDelete: number[] = [];
      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          if (img[idx(x, y)] !== 1) continue;
          const p2 = img[idx(x,     y - 1)];
          const p3 = img[idx(x + 1, y - 1)];
          const p4 = img[idx(x + 1, y    )];
          const p5 = img[idx(x + 1, y + 1)];
          const p6 = img[idx(x,     y + 1)];
          const p7 = img[idx(x - 1, y + 1)];
          const p8 = img[idx(x - 1, y    )];
          const p9 = img[idx(x - 1, y - 1)];
          const B = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
          if (B < 2 || B > 6) continue;
          const seq = [p2, p3, p4, p5, p6, p7, p8, p9, p2];
          let A = 0;
          for (let k = 0; k < 8; k++) if (seq[k] === 0 && seq[k + 1] === 1) A++;
          if (A !== 1) continue;
          if (pass === 0) {
            if (p2 * p4 * p6 !== 0) continue;
            if (p4 * p6 * p8 !== 0) continue;
          } else {
            if (p2 * p4 * p8 !== 0) continue;
            if (p2 * p6 * p8 !== 0) continue;
          }
          toDelete.push(idx(x, y));
        }
      }
      if (toDelete.length > 0) {
        changed = true;
        for (const i of toDelete) img[i] = 0;
      }
    }
  }

  // Convert back: 1 → 255 (edge pixel), 0 → 0 (background)
  const result = new Uint8Array(binary.length);
  for (let i = 0; i < img.length; i++) result[i] = img[i] === 1 ? 255 : 0;
  return result;
}

/**
 * AI Trace pipeline: image buffer → DXF string
 *
 * Optimised for AI-generated line drawings (black lines on white background).
 * Skips Sobel edge detection (which creates double lines) and instead:
 *   1. Grayscale + threshold → binary (black pixels = lines)
 *   2. Zhang-Suen thinning DIRECTLY on binary → single-pixel skeleton
 *   3. 8-connectivity tracing + Douglas-Peucker → smooth polylines
 *   4. DXF + SVG output
 */
export async function aiTracePipeline(
  buffer: Buffer,
  options: ProcessingOptions
): Promise<{
  dxf: string;
  svgPreview: string;
  segmentCount: number;
  width: number;
  height: number;
  realWidth: number;
  realHeight: number;
}> {
  // Get image dimensions first
  const { width, height } = await imageToGrayscale(buffer);

  // Apply Gaussian blur before threshold to smooth anti-aliased edges
  // This prevents jagged "staircase" artifacts from anti-aliasing
  const blurred = await sharp(buffer)
    .grayscale()
    .resize(width, height)
    .blur(1.5)  // gentle Gaussian blur to merge anti-aliased pixels
    .raw()
    .toBuffer();
  const blurredPixels = new Uint8Array(blurred);

  // High threshold (220) to keep only clearly dark pixels
  const binary = applyThreshold(blurredPixels, options.threshold ?? 220);

  // Zhang-Suen thinning directly on binary (not on Sobel edges)
  const thinned = thinBinary(binary, width, height);

  // 8-connectivity tracing with Douglas-Peucker smoothing
  const epsilon = Math.max(0.5, options.simplifyTolerance ?? 1.5);
  const polylines = traceCenterlines(thinned, width, height, epsilon);

  const dxf = polylinesToDxf(polylines, width, height, options.hairline ?? false, options.lineweightMm);
  const svgPreview = polylinesToSvg(polylines, width, height);

  // Count total segment count for reporting
  let segmentCount = 0;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const poly of polylines) {
    segmentCount += Math.max(0, poly.length - 1);
    for (const [px, py] of poly) {
      minX = Math.min(minX, px);
      minY = Math.min(minY, py);
      maxX = Math.max(maxX, px);
      maxY = Math.max(maxY, py);
    }
  }
  const realWidth  = polylines.length > 0 ? (maxX - minX) : width;
  const realHeight = polylines.length > 0 ? (maxY - minY) : height;

  return { dxf, svgPreview, segmentCount, width, height, realWidth, realHeight };
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
  realWidth: number;
  realHeight: number;
}> {
  // Use the same centerline pipeline as aiTracePipeline:
  // 1. Blur to merge anti-aliased pixels
  // 2. Threshold to binary
  // 3. Zhang-Suen thinning directly on black pixels → single-pixel centerline
  // This eliminates the double-line artifact caused by Sobel detecting both edges of thick strokes.
  // Cap at 1200px for scan tab — Zhang-Suen is O(n²) and 2000px images can take 60-90s.
  const { width, height } = await imageToGrayscale(buffer, 1200);

  // Use stronger blur (2.5) for scanned images to merge thick strokes before thinning.
  // This prevents double-line artifacts from wide pen strokes in scanned artwork.
  const blurred = await sharp(buffer)
    .grayscale()
    .resize(width, height)
    .blur(2.5)
    .raw()
    .toBuffer();
  const blurredPixels = new Uint8Array(blurred);

  const binary = applyThreshold(blurredPixels, options.threshold);

  // Morphological erosion: shrink thick strokes before thinning.
  // Each iteration removes ~1px from each side of a stroke.
  // For scanned images with 3-5px thick lines, 2 erosion passes reduce them to 1-3px
  // before Zhang-Suen, significantly reducing double-line artifacts.
  const eroded = erodeBinary(binary, width, height, 2);

  // thinBinary returns 255 for foreground (line) pixels, 0 for background
  const thinned = thinBinary(eroded, width, height);

  // thinned already has 255=line, 0=background — pass directly to traceCenterlines
  // 8-connectivity centerline tracing with Douglas-Peucker smoothing
  const epsilon = Math.max(0.5, options.simplifyTolerance ?? 1.5);
  const polylines = traceCenterlines(thinned, width, height, epsilon);

  let outputPolylines: Polyline[];

  if (options.doubleLineOffset && options.doubleLineOffset > 0) {
    outputPolylines = doubleLinePolylines(polylines, options.doubleLineOffset);
  } else {
    outputPolylines = polylines;
  }

  let scaledPolylines = outputPolylines;
  let dxfWidth = width;
  let dxfHeight = height;

  // ── Min-gap auto-scale ──────────────────────────────────────────────────────
  // If minGapMm is set, compute the minimum distance between parallel polyline
  // segments and scale up the entire drawing so the smallest gap >= minGapMm.
  const minGapMm = options.minGapMm ?? 0;
  const dpi = options.dpi ?? 300;
  if (minGapMm > 0 && outputPolylines.length > 1) {
    // Convert minGapMm to pixels at the given DPI
    const minGapPx = (minGapMm / 25.4) * dpi;

    // Sample the minimum distance between any two polyline centerlines.
    // Strategy: for each polyline, sample points every ~5px and find the
    // nearest point on any OTHER polyline. Take the global minimum.
    const sampleStep = 5;
    let globalMinDist = Infinity;

    // Build a flat array of all sample points with their polyline index
    const samples: Array<{ x: number; y: number; pIdx: number }> = [];
    for (let pIdx = 0; pIdx < outputPolylines.length; pIdx++) {
      const pl = outputPolylines[pIdx];
      for (let i = 0; i < pl.length - 1; i++) {
        const [x1, y1] = pl[i];
        const [x2, y2] = pl[i + 1];
        const segLen = Math.hypot(x2 - x1, y2 - y1);
        const steps = Math.max(1, Math.floor(segLen / sampleStep));
        for (let s = 0; s <= steps; s++) {
          const t = s / steps;
          samples.push({ x: x1 + t * (x2 - x1), y: y1 + t * (y2 - y1), pIdx });
        }
      }
    }

    // For performance, limit to 2000 sample points
    const maxSamples = 2000;
    const step = samples.length > maxSamples ? Math.floor(samples.length / maxSamples) : 1;
    for (let i = 0; i < samples.length; i += step) {
      const { x: ax, y: ay, pIdx: aIdx } = samples[i];
      for (let j = i + step; j < samples.length; j += step) {
        const { x: bx, y: by, pIdx: bIdx } = samples[j];
        if (aIdx === bIdx) continue; // same polyline
        const d = Math.hypot(bx - ax, by - ay);
        if (d < globalMinDist) globalMinDist = d;
        if (globalMinDist < 0.5) break; // can't get smaller
      }
      if (globalMinDist < 0.5) break;
    }

    if (globalMinDist < minGapPx && globalMinDist > 0) {
      const scale = minGapPx / globalMinDist;
      // Scale all polyline coordinates
      scaledPolylines = outputPolylines.map(pl =>
        pl.map(([x, y]) => [x * scale, y * scale] as [number, number])
      );
      dxfWidth = Math.round(width * scale);
      dxfHeight = Math.round(height * scale);
    }
  }
  // ────────────────────────────────────────────────────────────────────────────

  // ── Output size scaling ──────────────────────────────────────────────────────
  // Scale the entire drawing so the output width equals outputWidthMm (default 100mm).
  // DXF units are in "drawing units" — we treat 1 unit = 1mm after scaling.
  // Scale factor = targetWidthMm / currentWidthPx
  const targetWidthMm = options.outputWidthMm ?? 100;
  const outputScale = dxfWidth > 0 ? targetWidthMm / dxfWidth : 1;
  if (Math.abs(outputScale - 1) > 0.001) {
    scaledPolylines = scaledPolylines.map(pl =>
      pl.map(([x, y]) => [x * outputScale, y * outputScale] as [number, number])
    );
    dxfWidth  = Math.round(dxfWidth  * outputScale);
    dxfHeight = Math.round(dxfHeight * outputScale);
  }
  // ────────────────────────────────────────────────────────────────────────────

  const dxf = polylinesToDxf(scaledPolylines, dxfWidth, dxfHeight, options.hairline ?? false, options.lineweightMm);
  const svgPreview = polylinesToSvg(outputPolylines, width, height); // preview always uses original scale

  // Count total segment count and compute tight bounding box (in mm after scaling)
  let segmentCount = 0;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const poly of scaledPolylines) {
    segmentCount += Math.max(0, poly.length - 1);
    for (const [px, py] of poly) {
      minX = Math.min(minX, px);
      minY = Math.min(minY, py);
      maxX = Math.max(maxX, px);
      maxY = Math.max(maxY, py);
    }
  }
  const realWidth  = scaledPolylines.length > 0 ? Math.round(maxX - minX) : dxfWidth;
  const realHeight = scaledPolylines.length > 0 ? Math.round(maxY - minY) : dxfHeight;

  return { dxf, svgPreview, segmentCount, width: dxfWidth, height: dxfHeight, realWidth, realHeight };
}

/**
 * potraceToSingleLine.ts
 *
 * Converts potrace SVG output (filled closed paths = double outlines) into
 * single-line DXF by extracting the CENTERLINE of each closed path.
 *
 * How potrace paths work:
 *   - potrace traces the OUTLINE of each black shape as a closed path.
 *   - For a line of width W, the path is a long thin rectangle:
 *       start(mid) → corner1 → side1 → corner2 → side2 → back to start
 *   - The path starts at a midpoint of one of the short ends.
 *   - We sample N points along the full path, then find the two "turn" points
 *     (the corners at the ends of the line) by finding points where the direction
 *     changes most sharply. This splits the path into two parallel sides.
 *   - We average corresponding points from both sides → centerline.
 *   - Douglas-Peucker smoothing is applied.
 *
 * Alternative approach used here (simpler and more robust):
 *   - Sample N points along the full closed path.
 *   - For each sample point on the "first half" (0..N/2), find the closest
 *     point on the "second half" (N/2..N, reversed).
 *   - Average them → centerline.
 *   This works because the two sides of the outline are always roughly parallel.
 */

import { getTotalLength, getPointAtLength } from "svg-path-commander";

export interface DxfResult {
  dxf: string;
  svgPreview: string;
  segmentCount: number;
  width: number;
  height: number;
  realWidth: number;
  realHeight: number;
}

type Point = [number, number];
type Polyline = Point[];

// ─── Douglas-Peucker simplification ──────────────────────────────────────────

function douglasPeucker(points: Polyline, epsilon: number): Polyline {
  if (points.length <= 2) return points;
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
      dist = Math.abs((y2 - y1) * px - (x2 - x1) * py + x2 * y1 - y2 * x1) / lineLen;
    }
    if (dist > maxDist) { maxDist = dist; maxIdx = i; }
  }
  if (maxDist > epsilon) {
    const left = douglasPeucker(points.slice(0, maxIdx + 1), epsilon);
    const right = douglasPeucker(points.slice(maxIdx), epsilon);
    return [...left.slice(0, -1), ...right];
  }
  return [points[0], points[points.length - 1]];
}

function dist2(a: Point, b: Point): number {
  return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;
}

// ─── Find the two "end" corners of a potrace closed path ─────────────────────

/**
 * A potrace path for a line shape looks like:
 *   start → [side A going forward] → corner1 → [side B going backward] → start
 *
 * We find the two points where the path "turns around" (maximum curvature).
 * These are the two ends of the line.
 *
 * Strategy: sample many points, compute direction changes, find the two
 * locations of maximum direction reversal.
 */
function findTurnPoints(points: Point[]): [number, number] {
  const n = points.length;
  if (n < 6) return [Math.floor(n / 4), Math.floor(3 * n / 4)];

  // Compute curvature at each point (direction change)
  const curvatures: number[] = new Array(n).fill(0);
  const window = Math.max(3, Math.floor(n / 20));

  for (let i = window; i < n - window; i++) {
    const prev = points[i - window];
    const curr = points[i];
    const next = points[i + window];
    // Direction from prev→curr and curr→next
    const d1x = curr[0] - prev[0], d1y = curr[1] - prev[1];
    const d2x = next[0] - curr[0], d2y = next[1] - curr[1];
    const len1 = Math.sqrt(d1x * d1x + d1y * d1y) + 0.001;
    const len2 = Math.sqrt(d2x * d2x + d2y * d2y) + 0.001;
    // Dot product of normalized directions (1 = same, -1 = reversed)
    const dot = (d1x / len1) * (d2x / len2) + (d1y / len1) * (d2y / len2);
    curvatures[i] = 1 - dot; // 0 = straight, 2 = U-turn
  }

  // Find the two highest curvature peaks (the two ends of the line)
  // First peak
  let peak1Idx = 0, peak1Val = -Infinity;
  for (let i = window; i < n - window; i++) {
    if (curvatures[i] > peak1Val) { peak1Val = curvatures[i]; peak1Idx = i; }
  }

  // Second peak: must be far from first peak (at least n/4 away)
  const minSep = Math.floor(n / 4);
  let peak2Idx = 0, peak2Val = -Infinity;
  for (let i = window; i < n - window; i++) {
    if (Math.abs(i - peak1Idx) < minSep) continue;
    if (curvatures[i] > peak2Val) { peak2Val = curvatures[i]; peak2Idx = i; }
  }

  // Ensure peak1 < peak2
  if (peak1Idx > peak2Idx) [peak1Idx, peak2Idx] = [peak2Idx, peak1Idx];
  return [peak1Idx, peak2Idx];
}

// ─── Extract centerline from a single closed SVG path ────────────────────────

function extractCenterline(d: string, numSamples = 120, epsilon = 1.5): Polyline {
  let totalLen: number;
  try {
    totalLen = getTotalLength(d);
  } catch {
    return [];
  }
  if (totalLen < 2) return [];

  // Sample points along the full closed path
  const allPoints: Point[] = [];
  for (let i = 0; i < numSamples; i++) {
    const t = (i / numSamples) * totalLen;
    try {
      const pt = getPointAtLength(d, t);
      allPoints.push([pt.x, pt.y]);
    } catch {
      // skip
    }
  }

  if (allPoints.length < 6) return [];

  // Find the two turn points (ends of the line)
  const [t1, t2] = findTurnPoints(allPoints);

  // Side A: from t1 to t2 (going forward)
  const sideA = allPoints.slice(t1, t2 + 1);
  // Side B: from t2 to end + from start to t1 (going backward = reversed)
  const sideB = [...allPoints.slice(t2), ...allPoints.slice(0, t1 + 1)].reverse();

  if (sideA.length < 2 || sideB.length < 2) return [];

  // Resample both sides to the same number of points
  const n = Math.min(sideA.length, sideB.length, 60);
  const resample = (pts: Point[], count: number): Point[] => {
    if (pts.length === count) return pts;
    const result: Point[] = [];
    for (let i = 0; i < count; i++) {
      const t = (i / (count - 1)) * (pts.length - 1);
      const lo = Math.floor(t);
      const hi = Math.min(lo + 1, pts.length - 1);
      const frac = t - lo;
      result.push([
        pts[lo][0] * (1 - frac) + pts[hi][0] * frac,
        pts[lo][1] * (1 - frac) + pts[hi][1] * frac,
      ]);
    }
    return result;
  };

  const rA = resample(sideA, n);
  const rB = resample(sideB, n);

  // Average corresponding points → centerline
  const centerline: Polyline = rA.map((a, i) => [
    (a[0] + rB[i][0]) / 2,
    (a[1] + rB[i][1]) / 2,
  ]);

  if (centerline.length < 2) return centerline;
  return douglasPeucker(centerline, epsilon);
}

// ─── Parse SVG path "d" attributes from potrace SVG ──────────────────────────

function extractPaths(svgContent: string): string[] {
  const paths: string[] = [];
  const re = /<path[^>]+d="([^"]+)"[^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(svgContent)) !== null) {
    paths.push(m[1]);
  }
  return paths;
}

function extractViewBox(svgContent: string): { width: number; height: number } {
  const vbMatch = svgContent.match(/viewBox="([^"]*)"/i);
  let width = 500, height = 500;
  if (vbMatch) {
    const parts = vbMatch[1].split(/[\s,]+/).map(Number);
    if (parts.length >= 4) { width = parts[2]; height = parts[3]; }
  } else {
    const wm = svgContent.match(/width="([0-9.]+)"/i);
    const hm = svgContent.match(/height="([0-9.]+)"/i);
    if (wm) width = parseFloat(wm[1]);
    if (hm) height = parseFloat(hm[1]);
  }
  return { width, height };
}

// ─── Build DXF from polylines ─────────────────────────────────────────────────

function polylinesToDxf(polylines: Polyline[], width: number, height: number): string {
  const lines: string[] = [];
  lines.push("0\nSECTION");
  lines.push("2\nHEADER");
  lines.push("9\n$ACADVER\n1\nAC1009");
  lines.push(`9\n$EXTMIN\n10\n0.0\n20\n0.0\n30\n0.0`);
  lines.push(`9\n$EXTMAX\n10\n${width}\n20\n${height}\n30\n0.0`);
  lines.push("0\nENDSEC");
  lines.push("0\nSECTION\n2\nTABLES");
  lines.push("0\nTABLE\n2\nLAYER\n70\n1");
  lines.push("0\nLAYER\n2\n0\n70\n0\n62\n7\n6\nCONTINUOUS");
  lines.push("0\nENDTAB\n0\nENDSEC");
  lines.push("0\nSECTION\n2\nENTITIES");

  for (const poly of polylines) {
    for (let i = 0; i + 1 < poly.length; i++) {
      const [x1, y1] = poly[i];
      const [x2, y2] = poly[i + 1];
      const dy1 = height - y1;
      const dy2 = height - y2;
      lines.push("0\nLINE\n8\n0");
      lines.push(`10\n${x1.toFixed(3)}\n20\n${dy1.toFixed(3)}\n30\n0.0`);
      lines.push(`11\n${x2.toFixed(3)}\n21\n${dy2.toFixed(3)}\n31\n0.0`);
    }
  }

  lines.push("0\nENDSEC\n0\nEOF");
  return lines.join("\n");
}

function polylinesToSvgPreview(polylines: Polyline[], width: number, height: number): string {
  const pathData = polylines
    .filter((p) => p.length >= 2)
    .map((p) => {
      const pts = p.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" L ");
      return `M ${pts}`;
    })
    .join(" ");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <path d="${pathData}" fill="none" stroke="black" stroke-width="0.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function potraceToSingleLine(
  svgContent: string,
  epsilon = 1.5,
  numSamples = 120
): DxfResult {
  const { width, height } = extractViewBox(svgContent);
  const pathDs = extractPaths(svgContent);

  const polylines: Polyline[] = [];
  for (const d of pathDs) {
    const centerline = extractCenterline(d, numSamples, epsilon);
    if (centerline.length >= 2) {
      polylines.push(centerline);
    }
  }

  const dxf = polylinesToDxf(polylines, width, height);
  const svgPreview = polylinesToSvgPreview(polylines, width, height);

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const poly of polylines) {
    for (const [x, y] of poly) {
      minX = Math.min(minX, x); minY = Math.min(minY, y);
      maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
    }
  }
  const realWidth  = polylines.length > 0 && isFinite(maxX) ? (maxX - minX) : width;
  const realHeight = polylines.length > 0 && isFinite(maxY) ? (maxY - minY) : height;
  const segmentCount = polylines.reduce((sum, p) => sum + Math.max(0, p.length - 1), 0);

  return { dxf, svgPreview, segmentCount, width, height, realWidth, realHeight };
}

/**
 * svgToDxf.ts
 *
 * Converts an SVG string (with path/line/polyline/circle/rect/ellipse elements)
 * to a DXF R12 file. Each SVG element becomes one or more DXF LINE entities.
 *
 * This is used for the AI generation flow where GPT-4o produces clean SVG
 * directly — no image processing or edge detection needed.
 */

export interface DxfResult {
  dxf: string;
  segmentCount: number;
  width: number;
  height: number;
  /** Tight bounding box of actual drawn segments (px). May differ from viewBox. */
  realWidth: number;
  realHeight: number;
}

// ─── Simple SVG attribute parser ─────────────────────────────────────────────

function attr(element: string, name: string): string {
  const re = new RegExp(`${name}="([^"]*)"`, "i");
  const m = element.match(re);
  return m ? m[1] : "";
}

function numAttr(element: string, name: string, fallback = 0): number {
  const v = parseFloat(attr(element, name));
  return isNaN(v) ? fallback : v;
}

// ─── Path "d" tokenizer ───────────────────────────────────────────────────────

function tokenizePath(d: string): Array<string | number> {
  const tokens: Array<string | number> = [];
  const re = /([MmLlHhVvCcSsQqTtAaZz])|(-?[0-9]*\.?[0-9]+(?:[eE][+-]?[0-9]+)?)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(d)) !== null) {
    if (m[1]) tokens.push(m[1]);
    else tokens.push(parseFloat(m[2]));
  }
  return tokens;
}

/** Sample a cubic bezier at t ∈ [0,1] */
function cubicBezier(
  p0: [number, number],
  p1: [number, number],
  p2: [number, number],
  p3: [number, number],
  t: number
): [number, number] {
  const u = 1 - t;
  return [
    u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
    u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
  ];
}

/** Sample a quadratic bezier at t ∈ [0,1] */
function quadBezier(
  p0: [number, number],
  p1: [number, number],
  p2: [number, number],
  t: number
): [number, number] {
  const u = 1 - t;
  return [
    u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0],
    u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1],
  ];
}

type Point = [number, number];
type LineSegment = { x1: number; y1: number; x2: number; y2: number };

/** Convert SVG path "d" attribute to a list of line segments */
function pathToSegments(d: string): LineSegment[] {
  const tokens = tokenizePath(d);
  const segments: LineSegment[] = [];

  let cx = 0, cy = 0;          // current point
  let startX = 0, startY = 0;  // start of current subpath
  let lastCtrl: Point | null = null; // last control point for S/T commands
  let lastCmd = "";

  let i = 0;
  const nextNum = (): number => {
    while (i < tokens.length && typeof tokens[i] === "string") i++;
    return typeof tokens[i] === "number" ? (tokens[i++] as number) : 0;
  };

  const STEPS = 12; // segments per curve

  while (i < tokens.length) {
    const token = tokens[i];
    if (typeof token !== "string") { i++; continue; }
    const cmd = token;
    i++;
    lastCmd = cmd;

    const isRel = cmd === cmd.toLowerCase() && cmd !== "Z" && cmd !== "z";

    const rel = (dx: number, dy: number): Point => [
      isRel ? cx + dx : dx,
      isRel ? cy + dy : dy,
    ];

    switch (cmd.toUpperCase()) {
      case "M": {
        const [nx, ny] = rel(nextNum(), nextNum());
        cx = nx; cy = ny;
        startX = cx; startY = cy;
        lastCtrl = null;
        // Subsequent coordinate pairs are implicit L
        while (i < tokens.length && typeof tokens[i] === "number") {
          const [lx, ly] = rel(nextNum(), nextNum());
          segments.push({ x1: cx, y1: cy, x2: lx, y2: ly });
          cx = lx; cy = ly;
        }
        break;
      }
      case "L": {
        while (i < tokens.length && typeof tokens[i] === "number") {
          const [lx, ly] = rel(nextNum(), nextNum());
          segments.push({ x1: cx, y1: cy, x2: lx, y2: ly });
          cx = lx; cy = ly;
        }
        lastCtrl = null;
        break;
      }
      case "H": {
        while (i < tokens.length && typeof tokens[i] === "number") {
          const nx = isRel ? cx + nextNum() : nextNum();
          segments.push({ x1: cx, y1: cy, x2: nx, y2: cy });
          cx = nx;
        }
        lastCtrl = null;
        break;
      }
      case "V": {
        while (i < tokens.length && typeof tokens[i] === "number") {
          const ny = isRel ? cy + nextNum() : nextNum();
          segments.push({ x1: cx, y1: cy, x2: cx, y2: ny });
          cy = ny;
        }
        lastCtrl = null;
        break;
      }
      case "C": {
        while (i < tokens.length && typeof tokens[i] === "number") {
          const [x1, y1] = rel(nextNum(), nextNum());
          const [x2, y2] = rel(nextNum(), nextNum());
          const [ex, ey] = rel(nextNum(), nextNum());
          const p0: Point = [cx, cy];
          const p1: Point = [x1, y1];
          const p2: Point = [x2, y2];
          const p3: Point = [ex, ey];
          for (let s = 0; s < STEPS; s++) {
            const [ax, ay] = cubicBezier(p0, p1, p2, p3, s / STEPS);
            const [bx, by] = cubicBezier(p0, p1, p2, p3, (s + 1) / STEPS);
            segments.push({ x1: ax, y1: ay, x2: bx, y2: by });
          }
          lastCtrl = p2;
          cx = ex; cy = ey;
        }
        break;
      }
      case "S": {
        while (i < tokens.length && typeof tokens[i] === "number") {
          const ctrl1: Point = lastCtrl && lastCmd.toUpperCase() === "C" || lastCmd.toUpperCase() === "S"
            ? [2 * cx - lastCtrl![0], 2 * cy - lastCtrl![1]]
            : [cx, cy];
          const [x2, y2] = rel(nextNum(), nextNum());
          const [ex, ey] = rel(nextNum(), nextNum());
          const p0: Point = [cx, cy];
          const p2: Point = [x2, y2];
          const p3: Point = [ex, ey];
          for (let s = 0; s < STEPS; s++) {
            const [ax, ay] = cubicBezier(p0, ctrl1, p2, p3, s / STEPS);
            const [bx, by] = cubicBezier(p0, ctrl1, p2, p3, (s + 1) / STEPS);
            segments.push({ x1: ax, y1: ay, x2: bx, y2: by });
          }
          lastCtrl = p2;
          cx = ex; cy = ey;
        }
        break;
      }
      case "Q": {
        while (i < tokens.length && typeof tokens[i] === "number") {
          const [x1, y1] = rel(nextNum(), nextNum());
          const [ex, ey] = rel(nextNum(), nextNum());
          const p0: Point = [cx, cy];
          const p1: Point = [x1, y1];
          const p2: Point = [ex, ey];
          for (let s = 0; s < STEPS; s++) {
            const [ax, ay] = quadBezier(p0, p1, p2, s / STEPS);
            const [bx, by] = quadBezier(p0, p1, p2, (s + 1) / STEPS);
            segments.push({ x1: ax, y1: ay, x2: bx, y2: by });
          }
          lastCtrl = p1;
          cx = ex; cy = ey;
        }
        break;
      }
      case "T": {
        while (i < tokens.length && typeof tokens[i] === "number") {
          const ctrl1: Point = lastCtrl && (lastCmd.toUpperCase() === "Q" || lastCmd.toUpperCase() === "T")
            ? [2 * cx - lastCtrl![0], 2 * cy - lastCtrl![1]]
            : [cx, cy];
          const [ex, ey] = rel(nextNum(), nextNum());
          const p0: Point = [cx, cy];
          const p2: Point = [ex, ey];
          for (let s = 0; s < STEPS; s++) {
            const [ax, ay] = quadBezier(p0, ctrl1, p2, s / STEPS);
            const [bx, by] = quadBezier(p0, ctrl1, p2, (s + 1) / STEPS);
            segments.push({ x1: ax, y1: ay, x2: bx, y2: by });
          }
          lastCtrl = ctrl1;
          cx = ex; cy = ey;
        }
        break;
      }
      case "Z": {
        if (cx !== startX || cy !== startY) {
          segments.push({ x1: cx, y1: cy, x2: startX, y2: startY });
        }
        cx = startX; cy = startY;
        lastCtrl = null;
        break;
      }
      default:
        // Skip unknown commands
        break;
    }
  }

  return segments;
}

// ─── Element parsers ──────────────────────────────────────────────────────────

function parseLineElement(el: string): LineSegment[] {
  return [{
    x1: numAttr(el, "x1"),
    y1: numAttr(el, "y1"),
    x2: numAttr(el, "x2"),
    y2: numAttr(el, "y2"),
  }];
}

function parsePolylineElement(el: string): LineSegment[] {
  const pts = attr(el, "points").trim().split(/[\s,]+/).map(Number).filter((n) => !isNaN(n));
  const segs: LineSegment[] = [];
  for (let i = 0; i + 3 < pts.length; i += 2) {
    segs.push({ x1: pts[i], y1: pts[i + 1], x2: pts[i + 2], y2: pts[i + 3] });
  }
  return segs;
}

function parsePolygonElement(el: string): LineSegment[] {
  const pts = attr(el, "points").trim().split(/[\s,]+/).map(Number).filter((n) => !isNaN(n));
  const segs: LineSegment[] = [];
  for (let i = 0; i + 3 < pts.length; i += 2) {
    segs.push({ x1: pts[i], y1: pts[i + 1], x2: pts[i + 2], y2: pts[i + 3] });
  }
  // Close polygon
  if (pts.length >= 4) {
    segs.push({ x1: pts[pts.length - 2], y1: pts[pts.length - 1], x2: pts[0], y2: pts[1] });
  }
  return segs;
}

function parseCircleElement(el: string): LineSegment[] {
  const cx = numAttr(el, "cx", 250);
  const cy = numAttr(el, "cy", 250);
  const r = numAttr(el, "r", 10);
  const STEPS = 36;
  const segs: LineSegment[] = [];
  for (let i = 0; i < STEPS; i++) {
    const a1 = (i / STEPS) * 2 * Math.PI;
    const a2 = ((i + 1) / STEPS) * 2 * Math.PI;
    segs.push({
      x1: cx + r * Math.cos(a1), y1: cy + r * Math.sin(a1),
      x2: cx + r * Math.cos(a2), y2: cy + r * Math.sin(a2),
    });
  }
  return segs;
}

function parseEllipseElement(el: string): LineSegment[] {
  const cx = numAttr(el, "cx", 250);
  const cy = numAttr(el, "cy", 250);
  const rx = numAttr(el, "rx", 10);
  const ry = numAttr(el, "ry", 10);
  const STEPS = 36;
  const segs: LineSegment[] = [];
  for (let i = 0; i < STEPS; i++) {
    const a1 = (i / STEPS) * 2 * Math.PI;
    const a2 = ((i + 1) / STEPS) * 2 * Math.PI;
    segs.push({
      x1: cx + rx * Math.cos(a1), y1: cy + ry * Math.sin(a1),
      x2: cx + rx * Math.cos(a2), y2: cy + ry * Math.sin(a2),
    });
  }
  return segs;
}

function parseRectElement(el: string): LineSegment[] {
  const x = numAttr(el, "x");
  const y = numAttr(el, "y");
  const w = numAttr(el, "width");
  const h = numAttr(el, "height");
  return [
    { x1: x,     y1: y,     x2: x + w, y2: y     },
    { x1: x + w, y1: y,     x2: x + w, y2: y + h },
    { x1: x + w, y1: y + h, x2: x,     y2: y + h },
    { x1: x,     y1: y + h, x2: x,     y2: y     },
  ];
}

// ─── SVG → DXF main function ──────────────────────────────────────────────────

export function svgToDxf(svgContent: string, hairline = false): DxfResult {
  // Extract viewBox dimensions
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

  const allSegments: LineSegment[] = [];

  // Extract all elements (self-closing and paired tags)
  const elementRe = /<(path|line|polyline|polygon|circle|ellipse|rect)(\s[^>]*)?\/?>/gi;
  let m: RegExpExecArray | null;

  while ((m = elementRe.exec(svgContent)) !== null) {
    const tag = m[1].toLowerCase();
    const el = m[0];

    let segs: LineSegment[] = [];
    switch (tag) {
      case "path":     segs = pathToSegments(attr(el, "d")); break;
      case "line":     segs = parseLineElement(el); break;
      case "polyline": segs = parsePolylineElement(el); break;
      case "polygon":  segs = parsePolygonElement(el); break;
      case "circle":   segs = parseCircleElement(el); break;
      case "ellipse":  segs = parseEllipseElement(el); break;
      case "rect":     segs = parseRectElement(el); break;
    }

    // Use for-loop instead of spread to avoid "Maximum call stack size exceeded"
    // when segs is very large (complex images with 100k+ path segments)
    for (let si = 0; si < segs.length; si++) allSegments.push(segs[si]);
  }

  // Compute tight bounding box of all drawn segments
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const seg of allSegments) {
    minX = Math.min(minX, seg.x1, seg.x2);
    minY = Math.min(minY, seg.y1, seg.y2);
    maxX = Math.max(maxX, seg.x1, seg.x2);
    maxY = Math.max(maxY, seg.y1, seg.y2);
  }
  const realWidth  = allSegments.length > 0 ? (maxX - minX) : width;
  const realHeight = allSegments.length > 0 ? (maxY - minY) : height;

  // Build DXF (R12 or R2000 for hairline)
  const lines: string[] = [];
  lines.push("0\nSECTION");
  lines.push("2\nHEADER");
  // AC1009 = R12 (no lineweight), AC1015 = R2000 (supports lineweight=0 hairline)
  lines.push(hairline ? "9\n$ACADVER\n1\nAC1015" : "9\n$ACADVER\n1\nAC1009");
  lines.push(`9\n$EXTMIN\n10\n0.0\n20\n0.0\n30\n0.0`);
  lines.push(`9\n$EXTMAX\n10\n${width}\n20\n${height}\n30\n0.0`);
  lines.push("0\nENDSEC");

  lines.push("0\nSECTION\n2\nTABLES");
  lines.push("0\nTABLE\n2\nLAYER\n70\n1");
  lines.push(hairline
    ? "0\nLAYER\n2\n0\n70\n0\n62\n7\n6\nCONTINUOUS\n370\n0"
    : "0\nLAYER\n2\n0\n70\n0\n62\n7\n6\nCONTINUOUS");
  lines.push("0\nENDTAB\n0\nENDSEC");

  lines.push("0\nSECTION\n2\nENTITIES");

  for (const seg of allSegments) {
    const y1 = height - seg.y1; // flip Y for DXF coordinate system
    const y2 = height - seg.y2;
    lines.push(hairline ? "0\nLINE\n8\n0\n370\n0" : "0\nLINE\n8\n0");
    lines.push(`10\n${seg.x1.toFixed(3)}\n20\n${y1.toFixed(3)}\n30\n0.0`);
    lines.push(`11\n${seg.x2.toFixed(3)}\n21\n${y2.toFixed(3)}\n31\n0.0`);
  }

  lines.push("0\nENDSEC\n0\nEOF");

  return {
    dxf: lines.join("\n"),
    segmentCount: allSegments.length,
    width,
    height,
    realWidth,
    realHeight,
  };
}

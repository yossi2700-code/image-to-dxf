/**
 * svgToDxf.ts
 *
 * Converts an SVG string (with path/line/polyline/circle/rect/ellipse elements)
 * to a DXF R2000 file. Each SVG element becomes one DXF LWPOLYLINE entity
 * (a connected polyline), dramatically reducing object count and producing
 * clean, connected output for CNC/laser use.
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

/**
 * A polyline is an ordered list of points, plus a flag indicating whether
 * the path was closed (Z command). Closed polylines become closed LWPOLYLINE.
 */
interface SvgPolyline {
  points: Point[];
  closed: boolean;
}

// ─── Path "d" → list of polylines ────────────────────────────────────────────

/**
 * Convert SVG path "d" attribute to a list of polylines.
 * Each M command starts a new polyline. Z closes it.
 * Curves are approximated with STEPS line segments.
 */
function pathToPolylines(d: string): SvgPolyline[] {
  const tokens = tokenizePath(d);
  const polylines: SvgPolyline[] = [];

  let cx = 0, cy = 0;
  let startX = 0, startY = 0;
  let lastCtrl: Point | null = null;
  let lastCmd = "";
  let currentPoly: Point[] = [];
  let currentClosed = false;

  const STEPS = 12;

  let i = 0;
  const nextNum = (): number => {
    while (i < tokens.length && typeof tokens[i] === "string") i++;
    return typeof tokens[i] === "number" ? (tokens[i++] as number) : 0;
  };

  const finishPoly = () => {
    if (currentPoly.length >= 2) {
      polylines.push({ points: currentPoly, closed: currentClosed });
    }
    currentPoly = [];
    currentClosed = false;
  };

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
        // Start a new subpath — finish previous if any
        finishPoly();
        const [nx, ny] = rel(nextNum(), nextNum());
        cx = nx; cy = ny;
        startX = cx; startY = cy;
        lastCtrl = null;
        currentPoly = [[cx, cy]];
        // Subsequent coordinate pairs are implicit L
        while (i < tokens.length && typeof tokens[i] === "number") {
          const [lx, ly] = rel(nextNum(), nextNum());
          currentPoly.push([lx, ly]);
          cx = lx; cy = ly;
        }
        break;
      }
      case "L": {
        while (i < tokens.length && typeof tokens[i] === "number") {
          const [lx, ly] = rel(nextNum(), nextNum());
          currentPoly.push([lx, ly]);
          cx = lx; cy = ly;
        }
        lastCtrl = null;
        break;
      }
      case "H": {
        while (i < tokens.length && typeof tokens[i] === "number") {
          const nx = isRel ? cx + nextNum() : nextNum();
          currentPoly.push([nx, cy]);
          cx = nx;
        }
        lastCtrl = null;
        break;
      }
      case "V": {
        while (i < tokens.length && typeof tokens[i] === "number") {
          const ny = isRel ? cy + nextNum() : nextNum();
          currentPoly.push([cx, ny]);
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
          for (let s = 1; s <= STEPS; s++) {
            currentPoly.push(cubicBezier(p0, p1, p2, p3, s / STEPS));
          }
          lastCtrl = p2;
          cx = ex; cy = ey;
        }
        break;
      }
      case "S": {
        while (i < tokens.length && typeof tokens[i] === "number") {
          const ctrl1: Point = lastCtrl && (lastCmd.toUpperCase() === "C" || lastCmd.toUpperCase() === "S")
            ? [2 * cx - lastCtrl![0], 2 * cy - lastCtrl![1]]
            : [cx, cy];
          const [x2, y2] = rel(nextNum(), nextNum());
          const [ex, ey] = rel(nextNum(), nextNum());
          const p0: Point = [cx, cy];
          const p2: Point = [x2, y2];
          const p3: Point = [ex, ey];
          for (let s = 1; s <= STEPS; s++) {
            currentPoly.push(cubicBezier(p0, ctrl1, p2, p3, s / STEPS));
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
          for (let s = 1; s <= STEPS; s++) {
            currentPoly.push(quadBezier(p0, p1, p2, s / STEPS));
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
          for (let s = 1; s <= STEPS; s++) {
            currentPoly.push(quadBezier(p0, ctrl1, p2, s / STEPS));
          }
          lastCtrl = ctrl1;
          cx = ex; cy = ey;
        }
        break;
      }
      case "Z": {
        currentClosed = true;
        cx = startX; cy = startY;
        lastCtrl = null;
        finishPoly();
        break;
      }
      default:
        break;
    }
  }

  // Finish any remaining open subpath
  finishPoly();

  return polylines;
}

// ─── Element parsers → polylines ─────────────────────────────────────────────

function parseLineElementAsPoly(el: string): SvgPolyline[] {
  const x1 = numAttr(el, "x1"), y1 = numAttr(el, "y1");
  const x2 = numAttr(el, "x2"), y2 = numAttr(el, "y2");
  return [{ points: [[x1, y1], [x2, y2]], closed: false }];
}

function parsePolylineElementAsPoly(el: string): SvgPolyline[] {
  const pts = attr(el, "points").trim().split(/[\s,]+/).map(Number).filter((n) => !isNaN(n));
  const points: Point[] = [];
  for (let i = 0; i + 1 < pts.length; i += 2) {
    points.push([pts[i], pts[i + 1]]);
  }
  if (points.length < 2) return [];
  return [{ points, closed: false }];
}

function parsePolygonElementAsPoly(el: string): SvgPolyline[] {
  const pts = attr(el, "points").trim().split(/[\s,]+/).map(Number).filter((n) => !isNaN(n));
  const points: Point[] = [];
  for (let i = 0; i + 1 < pts.length; i += 2) {
    points.push([pts[i], pts[i + 1]]);
  }
  if (points.length < 2) return [];
  return [{ points, closed: true }];
}

function parseCircleElementAsPoly(el: string): SvgPolyline[] {
  const cx = numAttr(el, "cx", 250);
  const cy = numAttr(el, "cy", 250);
  const r = numAttr(el, "r", 10);
  const STEPS = 36;
  const points: Point[] = [];
  for (let i = 0; i <= STEPS; i++) {
    const a = (i / STEPS) * 2 * Math.PI;
    points.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return [{ points, closed: true }];
}

function parseEllipseElementAsPoly(el: string): SvgPolyline[] {
  const cx = numAttr(el, "cx", 250);
  const cy = numAttr(el, "cy", 250);
  const rx = numAttr(el, "rx", 10);
  const ry = numAttr(el, "ry", 10);
  const STEPS = 36;
  const points: Point[] = [];
  for (let i = 0; i <= STEPS; i++) {
    const a = (i / STEPS) * 2 * Math.PI;
    points.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]);
  }
  return [{ points, closed: true }];
}

function parseRectElementAsPoly(el: string): SvgPolyline[] {
  const x = numAttr(el, "x");
  const y = numAttr(el, "y");
  const w = numAttr(el, "width");
  const h = numAttr(el, "height");
  return [{
    points: [
      [x, y],
      [x + w, y],
      [x + w, y + h],
      [x, y + h],
    ],
    closed: true,
  }];
}

// ─── DXF LWPOLYLINE writer ────────────────────────────────────────────────────

// DXF R2000 lineweight codes (hundredths of mm)
const SVG_DXF_LW_CODES = [0, 5, 9, 13, 15, 18, 20, 25, 30, 35, 40, 50, 53, 60, 70, 80, 90, 100, 106, 120, 140, 158, 200, 211];
function svgMmToLwCode(mm: number): number {
  const h = Math.round(mm * 100);
  let best = SVG_DXF_LW_CODES[0], bestDiff = Math.abs(h - best);
  for (const c of SVG_DXF_LW_CODES) { const d = Math.abs(h - c); if (d < bestDiff) { best = c; bestDiff = d; } }
  return best;
}

/**
 * Write a single LWPOLYLINE entity to the DXF lines array.
 * LWPOLYLINE is an R2000 entity that stores all vertices in one object —
 * this is what CAD software (AutoCAD, CorelDRAW, etc.) shows as a single
 * connected polyline instead of hundreds of separate LINE objects.
 */
let _entityHandle = 0x100; // start entity handles at 256 (0x100), well above table handles
function nextHandle(): string {
  return (_entityHandle++).toString(16).toUpperCase();
}
function resetHandles() { _entityHandle = 0x100; }

function writeLwPolyline(
  lines: string[],
  points: Point[],
  closed: boolean,
  outputHeight: number,
  lwCode: number | null
): void {
  if (points.length < 2) return;

  const flags = closed ? 1 : 0;
  lines.push("0\nLWPOLYLINE");
  lines.push(`5\n${nextHandle()}`);             // unique entity handle (required by CorelDRAW)
  lines.push("330\n1F");                        // owner = *Model_Space block record handle
  lines.push("100\nAcDbEntity");                // subclass marker 1 (required)
  lines.push("8\n0");                           // layer
  lines.push("100\nAcDbPolyline");              // subclass marker 2 (required for LWPOLYLINE)
  lines.push("90\n" + points.length);           // number of vertices
  lines.push("70\n" + flags);                   // 1 = closed, 0 = open
  lines.push("43\n0.0");                        // constant width = 0
  if (lwCode !== null) lines.push(`370\n${lwCode}`);

  for (const [px, py] of points) {
    const dxfY = outputHeight - py;             // flip Y for DXF coordinate system
    lines.push(`10\n${px.toFixed(3)}`);
    lines.push(`20\n${dxfY.toFixed(3)}`);
  }
}

// ─── SVG → DXF main function ──────────────────────────────────────────────────

export function svgToDxf(svgContent: string, hairline = false, lineweightMm?: number, minGapMm = 0, forceOpenPaths = false, forceClosePaths = false): DxfResult {
  resetHandles(); // reset entity handle counter for each DXF export
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

  const allPolylines: SvgPolyline[] = [];

  // Extract all elements (self-closing and paired tags)
  const elementRe = /<(path|line|polyline|polygon|circle|ellipse|rect)(\s[^>]*)?\/?>/gi;
  let m: RegExpExecArray | null;

  while ((m = elementRe.exec(svgContent)) !== null) {
    const tag = m[1].toLowerCase();
    const el = m[0];

    let polys: SvgPolyline[] = [];
    switch (tag) {
      case "path":     polys = pathToPolylines(attr(el, "d")); break;
      case "line":     polys = parseLineElementAsPoly(el); break;
      case "polyline": polys = parsePolylineElementAsPoly(el); break;
      case "polygon":  polys = parsePolygonElementAsPoly(el); break;
      case "circle":   polys = parseCircleElementAsPoly(el); break;
      case "ellipse":  polys = parseEllipseElementAsPoly(el); break;
      case "rect":     polys = parseRectElementAsPoly(el); break;
    }

    for (const poly of polys) allPolylines.push(poly);
  }

  // Count total segment count for reporting
  let segmentCount = 0;
  for (const poly of allPolylines) {
    segmentCount += Math.max(0, poly.points.length - 1);
  }

  // Compute tight bounding box of all drawn points
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const poly of allPolylines) {
    for (const [px, py] of poly.points) {
      minX = Math.min(minX, px);
      minY = Math.min(minY, py);
      maxX = Math.max(maxX, px);
      maxY = Math.max(maxY, py);
    }
  }
  const realWidth  = allPolylines.length > 0 ? (maxX - minX) : width;
  const realHeight = allPolylines.length > 0 ? (maxY - minY) : height;

  // ── Min-gap scaling ──────────────────────────────────────────────────────────
  let outputPolylines = allPolylines;
  let outputWidth = width;
  let outputHeight = height;

  if (minGapMm > 0 && allPolylines.length > 1) {
    const DPI = 96;
    const minGapPx = (minGapMm / 25.4) * DPI;
    // Sample midpoints from all polylines (cap at 1500 for performance)
    const midpoints: Point[] = [];
    for (const poly of allPolylines) {
      for (let pi = 0; pi < poly.points.length - 1; pi++) {
        midpoints.push([
          (poly.points[pi][0] + poly.points[pi + 1][0]) / 2,
          (poly.points[pi][1] + poly.points[pi + 1][1]) / 2,
        ]);
      }
    }
    const maxSamples = 1500;
    const step = midpoints.length > maxSamples ? Math.floor(midpoints.length / maxSamples) : 1;
    let globalMinDist = Infinity;
    outer: for (let pi = 0; pi < midpoints.length; pi += step) {
      for (let pj = pi + step; pj < midpoints.length; pj += step) {
        const d = Math.hypot(midpoints[pj][0] - midpoints[pi][0], midpoints[pj][1] - midpoints[pi][1]);
        if (d < globalMinDist) globalMinDist = d;
        if (globalMinDist < 0.5) break outer;
      }
    }
    if (globalMinDist < minGapPx && globalMinDist > 0) {
      const scale = minGapPx / globalMinDist;
      outputPolylines = allPolylines.map(poly => ({
        points: poly.points.map(([px, py]) => [px * scale, py * scale] as Point),
        closed: poly.closed,
      }));
      outputWidth = Math.round(width * scale);
      outputHeight = Math.round(height * scale);
    }
  }

  // ── Scale to fit within 2000×2000 mm (200×200 cm) ─────────────────────────────
  // SVG pixel coordinates are raw (0–3072). We scale them so the longest side
  // equals at most 2000 mm, preserving aspect ratio. This makes the DXF open at
  // a sensible real-world size in CorelDRAW / LightBurn / AutoCAD without any
  // manual rescaling by the user.
  const MAX_DXF_MM = 2000; // 200 cm
  const mmScale = MAX_DXF_MM / Math.max(outputWidth, outputHeight, 1);
  outputPolylines = outputPolylines.map(poly => ({
    points: poly.points.map(([px, py]) => [px * mmScale, py * mmScale] as Point),
    closed: poly.closed,
  }));
  outputWidth  = outputWidth  * mmScale;
  outputHeight = outputHeight * mmScale;

  // Determine lineweight code
  const lwCode = lineweightMm != null
    ? svgMmToLwCode(lineweightMm)
    : hairline ? 0 : null;

  // Build DXF R2000 (AC1015) — fully CorelDRAW-compatible structure
  // Includes: HEADER, CLASSES, TABLES (LTYPE+LAYER+APPID), BLOCKS, ENTITIES
  const lines: string[] = [];

  // ─── HEADER ────────────────────────────────────────────────────────────────────────────
  lines.push("0\nSECTION\n2\nHEADER");
  lines.push("9\n$ACADVER\n1\nAC1015");   // R2000 — required for LWPOLYLINE
  lines.push("9\n$INSBASE\n10\n0.0\n20\n0.0\n30\n0.0");
  lines.push(`9\n$EXTMIN\n10\n0.0\n20\n0.0\n30\n0.0`);
  lines.push(`9\n$EXTMAX\n10\n${outputWidth}\n20\n${outputHeight}\n30\n0.0`);
  lines.push("9\n$LTSCALE\n40\n1.0");
  lines.push("9\n$INSUNITS\n70\n4");       // 4 = millimetres
  lines.push("0\nENDSEC");

  // ─── CLASSES (required by R2000 spec, CorelDRAW expects it) ───────────────────────────────
  lines.push("0\nSECTION\n2\nCLASSES\n0\nENDSEC");

  // ─── TABLES ──────────────────────────────────────────────────────────────────────────────
  lines.push("0\nSECTION\n2\nTABLES");

  // VPORT table (required by many CAD readers)
  lines.push("0\nTABLE\n2\nVPORT\n5\n8\n100\nAcDbSymbolTable\n70\n0\n0\nENDTAB");

  // LTYPE table (linetype — CONTINUOUS required)
  lines.push("0\nTABLE\n2\nLTYPE\n5\n5\n100\nAcDbSymbolTable\n70\n1");
  lines.push("0\nLTYPE\n5\n14\n100\nAcDbSymbolTableRecord\n100\nAcDbLinetypeTableRecord\n2\nCONTINUOUS\n70\n0\n3\nSolid line\n72\n65\n73\n0\n40\n0.0");
  lines.push("0\nENDTAB");

  // LAYER table
  lines.push("0\nTABLE\n2\nLAYER\n5\n2\n100\nAcDbSymbolTable\n70\n1");
  lines.push(lwCode !== null
    ? `0\nLAYER\n5\n10\n100\nAcDbSymbolTableRecord\n100\nAcDbLayerTableRecord\n2\n0\n70\n0\n62\n7\n6\nCONTINUOUS\n370\n${lwCode}`
    : "0\nLAYER\n5\n10\n100\nAcDbSymbolTableRecord\n100\nAcDbLayerTableRecord\n2\n0\n70\n0\n62\n7\n6\nCONTINUOUS");
  lines.push("0\nENDTAB");

  // STYLE table (text style — required)
  lines.push("0\nTABLE\n2\nSTYLE\n5\n3\n100\nAcDbSymbolTable\n70\n0\n0\nENDTAB");

  // VIEW table
  lines.push("0\nTABLE\n2\nVIEW\n5\n6\n100\nAcDbSymbolTable\n70\n0\n0\nENDTAB");

  // UCS table
  lines.push("0\nTABLE\n2\nUCS\n5\n7\n100\nAcDbSymbolTable\n70\n0\n0\nENDTAB");

  // APPID table (application IDs — ACAD required)
  lines.push("0\nTABLE\n2\nAPPID\n5\n9\n100\nAcDbSymbolTable\n70\n1");
  lines.push("0\nAPPID\n5\n12\n100\nAcDbSymbolTableRecord\n100\nAcDbRegAppTableRecord\n2\nACAD\n70\n0");
  lines.push("0\nENDTAB");

  // DIMSTYLE table
  lines.push("0\nTABLE\n2\nDIMSTYLE\n5\nA\n100\nAcDbSymbolTable\n70\n0\n0\nENDTAB");

  // BLOCK_RECORD table (required for R2000)
  lines.push("0\nTABLE\n2\nBLOCK_RECORD\n5\n1\n100\nAcDbSymbolTable\n70\n0");
  lines.push("0\nBLOCK_RECORD\n5\n1F\n100\nAcDbSymbolTableRecord\n100\nAcDbBlockTableRecord\n2\n*Model_Space");
  lines.push("0\nBLOCK_RECORD\n5\n1B\n100\nAcDbSymbolTableRecord\n100\nAcDbBlockTableRecord\n2\n*Paper_Space");
  lines.push("0\nENDTAB");

  lines.push("0\nENDSEC");

  // ─── BLOCKS (required by R2000 spec) ────────────────────────────────────────────────────────────────
  lines.push("0\nSECTION\n2\nBLOCKS");
  lines.push("0\nBLOCK\n5\n20\n100\nAcDbEntity\n8\n0\n100\nAcDbBlockBegin\n2\n*Model_Space\n70\n0\n10\n0.0\n20\n0.0\n30\n0.0\n3\n*Model_Space\n1\n");
  lines.push("0\nENDBLK\n5\n21\n100\nAcDbEntity\n8\n0\n100\nAcDbBlockEnd");
  lines.push("0\nBLOCK\n5\n1C\n100\nAcDbEntity\n8\n0\n100\nAcDbBlockBegin\n2\n*Paper_Space\n70\n0\n10\n0.0\n20\n0.0\n30\n0.0\n3\n*Paper_Space\n1\n");
  lines.push("0\nENDBLK\n5\n1D\n100\nAcDbEntity\n8\n0\n100\nAcDbBlockEnd");
  lines.push("0\nENDSEC");

  // ─── ENTITIES ───────────────────────────────────────────────────────────────────────────────
  lines.push("0\nSECTION\n2\nENTITIES");

  for (const poly of outputPolylines) {
    // forceOpenPaths: treat all paths as open (no closed loops) — used for detailed mode
    // forceClosePaths: close all paths (connect end point back to start) — used for single-line CNC routing
    const isClosed = forceClosePaths ? true : (forceOpenPaths ? false : poly.closed);
    writeLwPolyline(lines, poly.points, isClosed, outputHeight, lwCode);
  }

  lines.push("0\nENDSEC\n0\nEOF");

  return {
    dxf: lines.join("\n"),
    segmentCount,
    width,
    height,
    realWidth,
    realHeight,
  };
}

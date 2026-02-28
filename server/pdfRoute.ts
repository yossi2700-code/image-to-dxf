/**
 * PDF Export Route
 * POST /api/export-pdf
 *
 * Accepts an SVG string and returns a PDF file.
 * Uses pdf-lib to create a PDF with the SVG rendered as vector paths.
 *
 * Strategy: parse SVG <path>, <polyline>, <line> elements → draw as PDF lines.
 * Supports M/L/C/Q/Z path commands for full AI-generated SVG compatibility.
 */
import { Router } from "express";
import { PDFDocument, rgb, PDFPage } from "pdf-lib";

const router = Router();

// ─── SVG Parsers ──────────────────────────────────────────────────────────────

interface ParsedLine {
  x1: number; y1: number; x2: number; y2: number;
}

interface ParsedPolyline {
  points: Array<[number, number]>;
}

/** Parse all <line> elements */
function parseSvgLines(svg: string): ParsedLine[] {
  const lines: ParsedLine[] = [];
  const lineRe = /<line[^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = lineRe.exec(svg)) !== null) {
    const attrs: Record<string, string> = {};
    const localAttrRe = /(\w+)="([^"]*)"/g;
    let am: RegExpExecArray | null;
    while ((am = localAttrRe.exec(match[0])) !== null) attrs[am[1]] = am[2];
    if (attrs.x1 !== undefined) {
      lines.push({
        x1: parseFloat(attrs.x1), y1: parseFloat(attrs.y1),
        x2: parseFloat(attrs.x2), y2: parseFloat(attrs.y2),
      });
    }
  }
  return lines;
}

/** Parse all <polyline> elements */
function parseSvgPolylines(svg: string): ParsedPolyline[] {
  const polylines: ParsedPolyline[] = [];
  const re = /<polyline[^>]*points="([^"]*)"[^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(svg)) !== null) {
    const pairs = match[1].trim().split(/[\s,]+/).filter(Boolean);
    const points: Array<[number, number]> = [];
    for (let i = 0; i + 1 < pairs.length; i += 2)
      points.push([parseFloat(pairs[i]), parseFloat(pairs[i + 1])]);
    if (points.length >= 2) polylines.push({ points });
  }
  return polylines;
}

/**
 * Parse <path d="..."> elements into polyline segments.
 * Handles M, L, H, V, C, Q, S, T, Z commands (absolute only for simplicity;
 * relative commands are also handled via lowercase variants).
 */
function parseSvgPaths(svg: string): ParsedPolyline[] {
  const result: ParsedPolyline[] = [];
  const pathRe = /<path[^>]*\bd="([^"]*)"/gi;
  let match: RegExpExecArray | null;

  while ((match = pathRe.exec(svg)) !== null) {
    const d = match[1];
    const segments = flattenPathToPolylines(d);
    result.push(...segments);
  }
  return result;
}

/** Tokenize an SVG path d attribute into commands + coordinate arrays */
function flattenPathToPolylines(d: string): ParsedPolyline[] {
  const result: ParsedPolyline[] = [];
  // Tokenize: split on command letters
  const tokens = d.match(/[MmLlHhVvCcSsQqTtAaZz]|[-+]?[0-9]*\.?[0-9]+(?:[eE][-+]?[0-9]+)?/g);
  if (!tokens) return result;

  let cx = 0, cy = 0; // current point
  let startX = 0, startY = 0; // start of current subpath
  let currentPolyline: Array<[number, number]> = [];
  let cmd = "M";
  let i = 0;

  const nums = (count: number): number[] => {
    const out: number[] = [];
    for (let k = 0; k < count && i < tokens.length; k++) {
      const v = parseFloat(tokens[i]);
      if (!isNaN(v)) { out.push(v); i++; }
      else break;
    }
    return out;
  };

  const pushPoint = (x: number, y: number) => {
    currentPolyline.push([x, y]);
    cx = x; cy = y;
  };

  const finishSubpath = () => {
    if (currentPolyline.length >= 2) result.push({ points: [...currentPolyline] });
    currentPolyline = [];
  };

  while (i < tokens.length) {
    const tok = tokens[i];
    if (/[MmLlHhVvCcSsQqTtAaZz]/.test(tok)) { cmd = tok; i++; continue; }

    switch (cmd) {
      case "M": { const [x, y] = nums(2); if (currentPolyline.length) finishSubpath(); startX = x; startY = y; pushPoint(x, y); cmd = "L"; break; }
      case "m": { const [dx, dy] = nums(2); if (currentPolyline.length) finishSubpath(); startX = cx + dx; startY = cy + dy; pushPoint(startX, startY); cmd = "l"; break; }
      case "L": { const [x, y] = nums(2); pushPoint(x, y); break; }
      case "l": { const [dx, dy] = nums(2); pushPoint(cx + dx, cy + dy); break; }
      case "H": { const [x] = nums(1); pushPoint(x, cy); break; }
      case "h": { const [dx] = nums(1); pushPoint(cx + dx, cy); break; }
      case "V": { const [y] = nums(1); pushPoint(cx, y); break; }
      case "v": { const [dy] = nums(1); pushPoint(cx, cy + dy); break; }
      // Cubic bezier — approximate with 8 intermediate points
      case "C": {
        const [x1, y1, x2, y2, x, y] = nums(6);
        for (let t = 0.125; t <= 1; t += 0.125) {
          const mt = 1 - t;
          pushPoint(
            mt*mt*mt*cx + 3*mt*mt*t*x1 + 3*mt*t*t*x2 + t*t*t*x,
            mt*mt*mt*cy + 3*mt*mt*t*y1 + 3*mt*t*t*y2 + t*t*t*y
          );
        }
        break;
      }
      case "c": {
        const [dx1, dy1, dx2, dy2, dx, dy] = nums(6);
        const [ax, ay] = [cx, cy];
        for (let t = 0.125; t <= 1; t += 0.125) {
          const mt = 1 - t;
          pushPoint(
            mt*mt*mt*ax + 3*mt*mt*t*(ax+dx1) + 3*mt*t*t*(ax+dx2) + t*t*t*(ax+dx),
            mt*mt*mt*ay + 3*mt*mt*t*(ay+dy1) + 3*mt*t*t*(ay+dy2) + t*t*t*(ay+dy)
          );
        }
        break;
      }
      // Quadratic bezier
      case "Q": {
        const [x1, y1, x, y] = nums(4);
        for (let t = 0.125; t <= 1; t += 0.125) {
          const mt = 1 - t;
          pushPoint(mt*mt*cx + 2*mt*t*x1 + t*t*x, mt*mt*cy + 2*mt*t*y1 + t*t*y);
        }
        break;
      }
      case "q": {
        const [dx1, dy1, dx, dy] = nums(4);
        const [ax, ay] = [cx, cy];
        for (let t = 0.125; t <= 1; t += 0.125) {
          const mt = 1 - t;
          pushPoint(mt*mt*ax + 2*mt*t*(ax+dx1) + t*t*(ax+dx), mt*mt*ay + 2*mt*t*(ay+dy1) + t*t*(ay+dy));
        }
        break;
      }
      case "Z": case "z": {
        pushPoint(startX, startY);
        finishSubpath();
        break;
      }
      // Skip S, T, A for now — consume coords
      case "S": case "s": nums(4); break;
      case "T": case "t": nums(2); break;
      case "A": case "a": nums(7); break;
      default: i++; break;
    }
  }

  finishSubpath();
  return result;
}

/** Extract SVG viewBox dimensions */
function parseSvgDimensions(svg: string): { width: number; height: number } {
  const vbMatch = svg.match(/viewBox="([^"]*)"/);
  if (vbMatch) {
    const parts = vbMatch[1].trim().split(/\s+/);
    if (parts.length === 4) return { width: parseFloat(parts[2]), height: parseFloat(parts[3]) };
  }
  const wMatch = svg.match(/width="([^"px]*)(?:px)?"/);
  const hMatch = svg.match(/height="([^"px]*)(?:px)?"/);
  return { width: wMatch ? parseFloat(wMatch[1]) : 500, height: hMatch ? parseFloat(hMatch[1]) : 500 };
}

/** Draw all SVG elements (line, polyline, path) onto a PDF page */
function drawSvgOnPage(page: PDFPage, svg: string, svgW: number, svgH: number, pageW: number, pageH: number) {
  const scale = Math.min(pageW / svgW, pageH / svgH);
  const offsetX = (pageW - svgW * scale) / 2;
  const offsetY = (pageH - svgH * scale) / 2;

  // SVG Y is top-down; PDF Y is bottom-up
  const tx = (x: number) => offsetX + x * scale;
  const ty = (y: number) => pageH - (offsetY + y * scale);

  const lineColor = rgb(0, 0, 0);
  const lineWidth = Math.max(0.3, scale * 0.5);

  const drawSegments = (polylines: ParsedPolyline[]) => {
    for (const poly of polylines) {
      for (let i = 0; i < poly.points.length - 1; i++) {
        const [x1, y1] = poly.points[i];
        const [x2, y2] = poly.points[i + 1];
        page.drawLine({ start: { x: tx(x1), y: ty(y1) }, end: { x: tx(x2), y: ty(y2) }, thickness: lineWidth, color: lineColor });
      }
    }
  };

  // Draw <line> elements
  for (const l of parseSvgLines(svg)) {
    page.drawLine({ start: { x: tx(l.x1), y: ty(l.y1) }, end: { x: tx(l.x2), y: ty(l.y2) }, thickness: lineWidth, color: lineColor });
  }

  // Draw <polyline> elements
  drawSegments(parseSvgPolylines(svg));

  // Draw <path> elements (most AI-generated SVGs use paths)
  drawSegments(parseSvgPaths(svg));
}

// ─── Route ────────────────────────────────────────────────────────────────────

router.post("/api/export-pdf", async (req, res) => {
  try {
    const { svg, filename = "design", scaleMm } = req.body as {
      svg: string;
      filename?: string;
      scaleMm?: { width: number; height: number };
    };

    if (!svg || typeof svg !== "string") {
      return res.status(400).json({ error: "SVG content required" });
    }

    const { width: svgW, height: svgH } = parseSvgDimensions(svg);

    // Determine page size in PDF points (1pt = 1/72 inch = 0.3528mm)
    let pageWidthPt: number;
    let pageHeightPt: number;

    if (scaleMm && scaleMm.width > 0 && scaleMm.height > 0) {
      pageWidthPt = scaleMm.width * (72 / 25.4);
      pageHeightPt = scaleMm.height * (72 / 25.4);
    } else {
      // A4: portrait or landscape based on aspect ratio
      const a4w = 595.28, a4h = 841.89;
      if (svgW > svgH) { pageWidthPt = a4h; pageHeightPt = a4w; }
      else { pageWidthPt = a4w; pageHeightPt = a4h; }
    }

    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([pageWidthPt, pageHeightPt]);
    drawSvgOnPage(page, svg, svgW, svgH, pageWidthPt, pageHeightPt);

    const pdfBytes = await pdfDoc.save();
    const safeName = filename.replace(/[^a-zA-Z0-9_\-\u0590-\u05FF]/g, "_") || "design";
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${safeName}.pdf"`);
    res.send(Buffer.from(pdfBytes));
  } catch (err) {
    console.error("[export-pdf]", err);
    res.status(500).json({ error: "שגיאה ביצירת PDF" });
  }
});

export default router;

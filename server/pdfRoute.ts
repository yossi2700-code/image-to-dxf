/**
 * PDF Export Route
 * POST /api/export-pdf
 *
 * Accepts an SVG string and returns a PDF file.
 * Uses pdf-lib to create a PDF with the SVG rendered as vector paths.
 *
 * Strategy: parse SVG polylines/lines → draw them as PDF line paths.
 * This keeps the output as true vector (not rasterized).
 */
import { Router } from "express";
import { PDFDocument, rgb, PDFPage } from "pdf-lib";

const router = Router();

interface ParsedLine {
  x1: number; y1: number; x2: number; y2: number;
}

interface ParsedPolyline {
  points: Array<[number, number]>;
}

/** Parse all <line> elements from SVG */
function parseSvgLines(svg: string): ParsedLine[] {
  const lines: ParsedLine[] = [];
  const lineRe = /<line[^>]*>/gi;
  const attrRe = /(\w+)="([^"]*)"/g;
  let match: RegExpExecArray | null;
  while ((match = lineRe.exec(svg)) !== null) {
    const attrs: Record<string, string> = {};
    let am: RegExpExecArray | null;
    const attrStr = match[0];
    const localAttrRe = /(\w+)="([^"]*)"/g;
    while ((am = localAttrRe.exec(attrStr)) !== null) {
      attrs[am[1]] = am[2];
    }
    if (attrs.x1 !== undefined) {
      lines.push({
        x1: parseFloat(attrs.x1),
        y1: parseFloat(attrs.y1),
        x2: parseFloat(attrs.x2),
        y2: parseFloat(attrs.y2),
      });
    }
  }
  void attrRe; // suppress unused warning
  return lines;
}

/** Parse all <polyline> elements from SVG */
function parseSvgPolylines(svg: string): ParsedPolyline[] {
  const polylines: ParsedPolyline[] = [];
  const re = /<polyline[^>]*points="([^"]*)"[^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(svg)) !== null) {
    const pointsStr = match[1].trim();
    const pairs = pointsStr.split(/\s+|,\s*/).filter(Boolean);
    const points: Array<[number, number]> = [];
    for (let i = 0; i + 1 < pairs.length; i += 2) {
      points.push([parseFloat(pairs[i]), parseFloat(pairs[i + 1])]);
    }
    if (points.length >= 2) polylines.push({ points });
  }
  return polylines;
}

/** Extract SVG viewBox dimensions */
function parseSvgDimensions(svg: string): { width: number; height: number } {
  const vbMatch = svg.match(/viewBox="([^"]*)"/);
  if (vbMatch) {
    const parts = vbMatch[1].trim().split(/\s+/);
    if (parts.length === 4) {
      return { width: parseFloat(parts[2]), height: parseFloat(parts[3]) };
    }
  }
  const wMatch = svg.match(/width="([^"px]*)(?:px)?"/);
  const hMatch = svg.match(/height="([^"px]*)(?:px)?"/);
  return {
    width: wMatch ? parseFloat(wMatch[1]) : 500,
    height: hMatch ? parseFloat(hMatch[1]) : 500,
  };
}

/** Draw SVG lines and polylines onto a PDF page */
function drawSvgOnPage(page: PDFPage, svg: string, svgW: number, svgH: number, pageW: number, pageH: number) {
  const scaleX = pageW / svgW;
  const scaleY = pageH / svgH;
  const scale = Math.min(scaleX, scaleY);

  // Center the drawing
  const offsetX = (pageW - svgW * scale) / 2;
  const offsetY = (pageH - svgH * scale) / 2;

  // SVG Y is top-down; PDF Y is bottom-up
  const tx = (x: number) => offsetX + x * scale;
  const ty = (y: number) => pageH - (offsetY + y * scale);

  const lineColor = rgb(0, 0, 0);
  const lineWidth = Math.max(0.3, scale * 0.5);

  // Draw <line> elements
  const lines = parseSvgLines(svg);
  for (const l of lines) {
    page.drawLine({
      start: { x: tx(l.x1), y: ty(l.y1) },
      end: { x: tx(l.x2), y: ty(l.y2) },
      thickness: lineWidth,
      color: lineColor,
    });
  }

  // Draw <polyline> elements
  const polylines = parseSvgPolylines(svg);
  for (const poly of polylines) {
    for (let i = 0; i < poly.points.length - 1; i++) {
      const [x1, y1] = poly.points[i];
      const [x2, y2] = poly.points[i + 1];
      page.drawLine({
        start: { x: tx(x1), y: ty(y1) },
        end: { x: tx(x2), y: ty(y2) },
        thickness: lineWidth,
        color: lineColor,
      });
    }
  }
}

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
    // If scaleMm provided, use that; otherwise fit to A4
    let pageWidthPt: number;
    let pageHeightPt: number;

    if (scaleMm && scaleMm.width > 0 && scaleMm.height > 0) {
      // Convert mm → points
      pageWidthPt = scaleMm.width * (72 / 25.4);
      pageHeightPt = scaleMm.height * (72 / 25.4);
    } else {
      // A4 landscape if wider than tall, portrait otherwise
      const a4w = 595.28; // A4 width in points
      const a4h = 841.89; // A4 height in points
      if (svgW > svgH) {
        pageWidthPt = a4h;
        pageHeightPt = a4w;
      } else {
        pageWidthPt = a4w;
        pageHeightPt = a4h;
      }
    }

    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([pageWidthPt, pageHeightPt]);

    drawSvgOnPage(page, svg, svgW, svgH, pageWidthPt, pageHeightPt);

    const pdfBytes = await pdfDoc.save();

    const safeName = (filename.replace(/[^a-zA-Z0-9_\-\u0590-\u05FF]/g, "_") || "design");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${safeName}.pdf"`);
    res.send(Buffer.from(pdfBytes));
  } catch (err) {
    console.error("[export-pdf]", err);
    res.status(500).json({ error: "שגיאה ביצירת PDF" });
  }
});

export default router;

/**
 * svgToPngRoute.ts — Server-side SVG → PNG conversion endpoint.
 *
 * POST /api/svg-to-png
 * Body: { svgContent: string, widthPx: number, heightPx: number }
 * Returns: PNG image bytes
 *
 * Used by the PDF export flow on iOS/Safari where Canvg (OffscreenCanvas) is not supported.
 * Sharp handles SVG rasterization reliably on the server.
 *
 * Fix: potrace SVGs often have viewBox but no explicit width/height attributes.
 * We extract viewBox dimensions and inject them so sharp renders correctly.
 */

import express from "express";
import sharp from "sharp";
const router = express.Router();

router.post("/api/svg-to-png", async (req, res) => {
  // No auth required — this is a stateless SVG→PNG conversion used for PDF export.
  // The SVG content is sent by the client (already in their browser), so there is no
  // server-side data exposure risk.

  const { svgContent, widthPx, heightPx, scale } = req.body as {
    svgContent?: string;
    widthPx?: number;
    heightPx?: number;
    scale?: number;
  };

  if (!svgContent || typeof svgContent !== "string") {
    return res.status(400).json({ error: "svgContent is required" });
  }

  const w = Math.min(Math.max(Math.round(widthPx ?? 1024), 100), 4000);
  const h = Math.min(Math.max(Math.round(heightPx ?? 1024), 100), 4000);
  const outputScale = Math.min(Math.max(scale ?? 1, 1), 4);

  try {
    // ── SVG sanitization to fix corrupt header errors ──────────────────────────
    // Remove null bytes and control characters that break XML parsers
    let svg = svgContent
      .replace(/\x00/g, "")
      .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

    // Trim leading whitespace/BOM before the SVG tag
    const svgStart = svg.indexOf("<svg");
    if (svgStart > 0) svg = svg.slice(svgStart);

    // Remove XML declaration if present (sharp doesn't need it)
    svg = svg.replace(/<\?xml[^?]*\?>/gi, "").trim();

    // Ensure xmlns attribute is present
    if (!svg.includes("xmlns")) {
      svg = svg.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
    }

    // Ensure the SVG has explicit width/height so sharp knows the output size.
    // potrace SVGs often have only viewBox="0 0 W H" without width/height attributes.

    // Extract viewBox dimensions if present — use them as the natural SVG size
    const vbMatch = svg.match(/viewBox=["']([^"']+)["']/);
    let naturalW = w;
    let naturalH = h;
    if (vbMatch) {
      const parts = vbMatch[1].trim().split(/[\s,]+/);
      if (parts.length === 4) {
        const pw = parseFloat(parts[2]);
        const ph = parseFloat(parts[3]);
        if (pw > 0 && ph > 0) {
          naturalW = pw;
          naturalH = ph;
        }
      }
    }

    // Force explicit width/height on the SVG element using natural dimensions
    if (!/<svg[^>]*\swidth=/.test(svg)) {
      svg = svg.replace(/<svg/, `<svg width="${naturalW}" height="${naturalH}"`);
    } else {
      svg = svg.replace(/<svg([^>]*)\swidth="[^"]*"/, `<svg$1 width="${naturalW}"`);
    }
    if (!/<svg[^>]*\sheight=/.test(svg)) {
      svg = svg.replace(/<svg/, `<svg height="${naturalH}"`);
    } else {
      svg = svg.replace(/<svg([^>]*)\sheight="[^"]*"/, `<svg$1 height="${naturalH}"`);
    }

    // Ensure white background for paths (potrace uses fill="black" on paths)
    // Add white background rect if not present
    if (!svg.includes('rect') && !svg.includes('background')) {
      svg = svg.replace(/<svg([^>]*)>/, `<svg$1><rect width="100%" height="100%" fill="white"/>`);
    }

    const pngBuffer = await sharp(Buffer.from(svg))
      .resize(w, h, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .png()
      .toBuffer();

    res.set("Content-Type", "image/png");
    res.set("Cache-Control", "no-store");
    res.send(pngBuffer);
  } catch (err) {
    console.error("[svg-to-png] Error:", err);
    res.status(500).json({ error: "SVG_TO_PNG_FAILED", message: String(err) });
  }
});

export default router;

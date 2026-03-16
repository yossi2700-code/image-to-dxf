/**
 * svgToPngRoute.ts — Server-side SVG → PNG conversion endpoint.
 *
 * POST /api/svg-to-png
 * Body: { svgContent: string, widthPx: number, heightPx: number }
 * Returns: PNG image bytes
 *
 * Used by the PDF export flow on iOS/Safari where Canvg (OffscreenCanvas) is not supported.
 * Sharp handles SVG rasterization reliably on the server.
 */

import express from "express";
import sharp from "sharp";
import { optimize } from "svgo";

const router = express.Router();

/**
 * Sanitize SVG string to fix common XML issues that cause sharp to fail.
 * Uses svgo for proper XML parsing + manual fixes for edge cases.
 */
function sanitizeSvg(raw: string): string {
  // 1. Remove null bytes and control characters
  let svg = raw
    .replace(/\x00/g, "")
    .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

  // 2. Trim leading whitespace/BOM before the SVG tag
  const svgStart = svg.indexOf("<svg");
  if (svgStart > 0) svg = svg.slice(svgStart);
  if (svgStart < 0) throw new Error("No <svg> tag found in content");

  // 3. Remove XML declaration (sharp doesn't need it)
  svg = svg.replace(/<\?xml[^?]*\?>/gi, "").trim();

  // 4. Fix unclosed self-closing tags: <path ... > → <path ... />
  //    This is the most common cause of "Couldn't find end of Start Tag" errors.
  //    We fix <path>, <circle>, <rect>, <ellipse>, <line>, <polyline>, <polygon>
  //    that end with > but not /> and have no separate closing tag.
  const voidElements = ["path", "circle", "rect", "ellipse", "line", "polyline", "polygon", "use", "image"];
  for (const tag of voidElements) {
    // Match opening tags that don't end with /> and don't have a closing tag immediately
    // Replace <tag ...> with <tag ... />
    svg = svg.replace(
      new RegExp(`<(${tag})(\\s[^>]*[^/])>`, "g"),
      "<$1$2/>"
    );
    // Also fix <tag> (no attributes, no self-close)
    svg = svg.replace(
      new RegExp(`<(${tag})>`, "g"),
      "<$1/>"
    );
  }

  // 5. Ensure xmlns attribute is present
  if (!svg.includes("xmlns")) {
    svg = svg.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
  }

  // 6. Try svgo optimization to further clean up the SVG XML
  try {
    const result = optimize(svg, {
      plugins: [
        // Only run safe plugins that don't change visual output
        "removeDoctype",
        "removeXMLProcInst",
        "removeComments",
        "removeMetadata",
        "removeEditorsNSData",
        "cleanupAttrs",
        "mergeStyles",
        "inlineStyles",
        "minifyStyles",
        "cleanupIds",
        "removeUselessDefs",
        "cleanupNumericValues",
        "convertColors",
        "removeUnknownsAndDefaults",
        "removeNonInheritableGroupAttrs",
        "removeUselessStrokeAndFill",
        "cleanupEnableBackground",
        "removeHiddenElems",
        "removeEmptyText",
        "convertShapeToPath",
        "convertEllipseToCircle",
        "moveElemsAttrsToGroup",
        "moveGroupAttrsToElems",
        "collapseGroups",
        "convertPathData",
        "convertTransform",
        "removeEmptyAttrs",
        "removeEmptyContainers",
        "mergePaths",
        "removeUnusedNS",
        "sortDefsChildren",
        "removeTitle",
        "removeDesc",
      ],
    });
    svg = result.data;
  } catch (svgoErr) {
    // svgo failed — continue with manually sanitized SVG
    console.warn("[svg-to-png] svgo optimization failed, using manual sanitization:", svgoErr);
  }

  // 7. Extract viewBox dimensions for natural sizing
  const vbMatch = svg.match(/viewBox=["']([^"']+)["']/);
  let naturalW = 1024;
  let naturalH = 1024;
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

  // 8. Force explicit width/height on the SVG element
  if (!/<svg[^>]*\swidth=/.test(svg)) {
    svg = svg.replace(/<svg/, `<svg width="${naturalW}" height="${naturalH}"`);
  }
  if (!/<svg[^>]*\sheight=/.test(svg)) {
    svg = svg.replace(/<svg/, `<svg height="${naturalH}"`);
  }

  // 9. Add white background rect if not present
  if (!svg.includes("<rect") && !svg.includes("background")) {
    svg = svg.replace(/<svg([^>]*)>/, `<svg$1><rect width="100%" height="100%" fill="white"/>`);
  }

  return svg;
}

router.post("/api/svg-to-png", async (req, res) => {
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

  try {
    const svg = sanitizeSvg(svgContent);

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

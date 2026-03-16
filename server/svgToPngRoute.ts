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
 * SVG sanitization strategy:
 *   1. Strip null bytes / control chars
 *   2. Slice to start at <svg
 *   3. Remove <?xml ...?> and <!DOCTYPE ...> declarations
 *   4. Use a state-machine parser to fix unclosed void elements
 *      (e.g. <path d="..."> → <path d="..."/>)
 *      This correctly handles attribute values containing > characters.
 *   5. Ensure xmlns, width, height
 *   6. Add white background rect
 */

import express from "express";
import sharp from "sharp";

const router = express.Router();

const VOID_ELEMENTS = new Set([
  "path", "circle", "rect", "ellipse", "line",
  "polyline", "polygon", "use", "image", "stop",
  "animate", "set", "animateTransform", "animateMotion",
]);

/**
 * Fix unclosed SVG void elements using a state-machine parser.
 * This correctly handles attributes containing > characters (e.g. d="M0>5").
 * Converts <path d="..."> → <path d="..."/>
 */
function fixUnclosedVoidElements(svg: string): string {
  const result: string[] = [];
  let i = 0;
  const len = svg.length;

  while (i < len) {
    // Check for start of an opening tag (not a closing tag </...)
    if (svg[i] === "<" && i + 1 < len && svg[i + 1] !== "/") {
      const tagStart = i;
      i++; // skip <

      // Read tag name
      let tagName = "";
      while (i < len && /[a-zA-Z0-9:_-]/.test(svg[i])) {
        tagName += svg[i];
        i++;
      }

      if (!VOID_ELEMENTS.has(tagName.toLowerCase())) {
        // Not a void element — push what we've read and continue
        result.push(svg.slice(tagStart, i));
        continue;
      }

      // It's a void element — read until end of tag, tracking quotes
      // so we don't mistake > inside an attribute for the closing >
      let tagContent = svg.slice(tagStart, i); // <tagName
      let inQuote = "";

      while (i < len) {
        const ch = svg[i];
        if (inQuote) {
          tagContent += ch;
          if (ch === inQuote) inQuote = "";
          i++;
        } else if (ch === '"' || ch === "'") {
          inQuote = ch;
          tagContent += ch;
          i++;
        } else if (ch === "/" && i + 1 < len && svg[i + 1] === ">") {
          // Already self-closing — keep as-is
          tagContent += "/>";
          i += 2;
          break;
        } else if (ch === ">") {
          // Closing > without / — add self-close
          tagContent += "/>";
          i++;
          break;
        } else {
          tagContent += ch;
          i++;
        }
      }

      result.push(tagContent);
    } else {
      result.push(svg[i]);
      i++;
    }
  }

  return result.join("");
}

/**
 * Sanitize SVG string to fix common XML issues that cause sharp to fail.
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

  // 3. Remove XML declaration and DOCTYPE (not needed by sharp)
  svg = svg.replace(/<\?xml[^?]*\?>/gi, "").trim();
  svg = svg.replace(/<!DOCTYPE[^>]*>/gi, "").trim();

  // 4. Ensure xmlns attribute is present
  if (!svg.includes("xmlns")) {
    svg = svg.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
  }

  // 5. Fix unclosed void elements using state-machine parser
  //    This is the root cause of "Couldn't find end of Start Tag path" errors
  svg = fixUnclosedVoidElements(svg);
  // 6. Extract viewBox dimensions for natural sizing
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

  // 7. Force explicit width/height on the SVG element (strip pt units)
  svg = svg.replace(/(<svg[^>]*)\swidth="[^"]*pt"/, `$1 width="${naturalW}"`);
  svg = svg.replace(/(<svg[^>]*)\sheight="[^"]*pt"/, `$1 height="${naturalH}"`);
  if (!/<svg[^>]*\swidth=/.test(svg)) {
    svg = svg.replace(/<svg/, `<svg width="${naturalW}" height="${naturalH}"`);
  }
  if (!/<svg[^>]*\sheight=/.test(svg)) {
    svg = svg.replace(/<svg/, `<svg height="${naturalH}"`);
  }

  // 8. Add white background rect if not present
  if (!svg.includes("<rect") && !svg.includes("background")) {
    svg = svg.replace(/<svg([^>]*)>/, `<svg$1><rect width="100%" height="100%" fill="white"/>`);
  }

  return svg;
}

router.post("/api/svg-to-png", async (req, res) => {
  const { svgContent, widthPx, heightPx } = req.body as {
    svgContent?: string;
    widthPx?: number;
    heightPx?: number;
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

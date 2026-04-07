/**
 * svgPreviewGenerator.ts — Generate PNG preview images from SVG content.
 * 
 * Used by the FreeDXF shared files system to create reliable preview thumbnails.
 * Converts SVG → PNG via Sharp, then uploads to S3.
 */

import sharp from "sharp";
import { storagePut } from "./storage";

const VOID_ELEMENTS = new Set([
  "path", "circle", "rect", "ellipse", "line",
  "polyline", "polygon", "use", "image", "stop",
  "animate", "set", "animateTransform", "animateMotion",
]);

/**
 * Fix unclosed SVG void elements using a state-machine parser.
 * Converts <path d="..."> → <path d="..."/>
 */
function fixUnclosedVoidElements(svg: string): string {
  const result: string[] = [];
  let i = 0;
  const len = svg.length;

  while (i < len) {
    if (svg[i] === "<" && i + 1 < len && svg[i + 1] !== "/") {
      const tagStart = i;
      i++;
      let tagName = "";
      while (i < len && /[a-zA-Z0-9:_-]/.test(svg[i])) {
        tagName += svg[i];
        i++;
      }

      if (!VOID_ELEMENTS.has(tagName.toLowerCase())) {
        result.push(svg.slice(tagStart, i));
        continue;
      }

      let tagContent = svg.slice(tagStart, i);
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
          tagContent += "/>";
          i += 2;
          break;
        } else if (ch === ">") {
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
 * Sanitize SVG string to fix common XML issues that cause Sharp to fail.
 */
function sanitizeSvg(raw: string): string {
  let svg = raw
    .replace(/\x00/g, "")
    .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

  const svgStart = svg.indexOf("<svg");
  if (svgStart > 0) svg = svg.slice(svgStart);
  if (svgStart < 0) throw new Error("No <svg> tag found in content");

  svg = svg.replace(/<\?xml[^?]*\?>/gi, "").trim();
  svg = svg.replace(/<!DOCTYPE[^>]*>/gi, "").trim();

  if (!svg.includes("xmlns")) {
    svg = svg.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
  }

  svg = fixUnclosedVoidElements(svg);

  // Extract viewBox dimensions
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

  // Force explicit width/height
  svg = svg.replace(/(<svg[^>]*)\swidth="[^"]*pt"/, `$1 width="${naturalW}"`);
  svg = svg.replace(/(<svg[^>]*)\sheight="[^"]*pt"/, `$1 height="${naturalH}"`);
  if (!/<svg[^>]*\swidth=/.test(svg)) {
    svg = svg.replace(/<svg/, `<svg width="${naturalW}" height="${naturalH}"`);
  }
  if (!/<svg[^>]*\sheight=/.test(svg)) {
    svg = svg.replace(/<svg/, `<svg height="${naturalH}"`);
  }

  // Add white background
  if (!svg.includes("<rect") && !svg.includes("background")) {
    svg = svg.replace(/<svg([^>]*)>/, `<svg$1><rect width="100%" height="100%" fill="white"/>`);
  }

  return svg;
}

/**
 * Generate a PNG preview image from SVG content and upload to S3.
 * Returns the public URL of the uploaded PNG, or null if generation fails.
 */
export async function generatePreviewFromSvg(
  svgContent: string,
  fileId?: string
): Promise<string | null> {
  try {
    if (!svgContent || svgContent.length < 50) return null;
    
    // Fix truncated SVGs by adding missing closing tags
    let fixedContent = svgContent;
    if (!fixedContent.includes("</svg>")) {
      // Close any open path/element tags and the SVG
      fixedContent += '"/></svg>';
    }
    
    const svg = sanitizeSvg(fixedContent);
    const pngBuffer = await sharp(Buffer.from(svg))
      .resize(600, 600, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .png()
      .toBuffer();

    const id = fileId || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const key = `freedxf-previews/${id}.png`;
    const { url } = await storagePut(key, pngBuffer, "image/png");
    return url;
  } catch (err) {
    console.error("[svgPreviewGenerator] Failed to generate preview:", err);
    return null;
  }
}

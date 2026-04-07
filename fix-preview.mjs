// Fix the existing shared file by generating a preview from its (truncated) SVG
import sharp from "sharp";

const VOID_ELEMENTS = new Set([
  "path", "circle", "rect", "ellipse", "line",
  "polyline", "polygon", "use", "image", "stop",
]);

function fixUnclosedVoidElements(svg) {
  const result = [];
  let i = 0;
  const len = svg.length;
  while (i < len) {
    if (svg[i] === "<" && i + 1 < len && svg[i + 1] !== "/") {
      const tagStart = i;
      i++;
      let tagName = "";
      while (i < len && /[a-zA-Z0-9:_-]/.test(svg[i])) { tagName += svg[i]; i++; }
      if (!VOID_ELEMENTS.has(tagName.toLowerCase())) { result.push(svg.slice(tagStart, i)); continue; }
      let tagContent = svg.slice(tagStart, i);
      let inQuote = "";
      while (i < len) {
        const ch = svg[i];
        if (inQuote) { tagContent += ch; if (ch === inQuote) inQuote = ""; i++; }
        else if (ch === '"' || ch === "'") { inQuote = ch; tagContent += ch; i++; }
        else if (ch === "/" && i + 1 < len && svg[i + 1] === ">") { tagContent += "/>"; i += 2; break; }
        else if (ch === ">") { tagContent += "/>"; i++; break; }
        else { tagContent += ch; i++; }
      }
      result.push(tagContent);
    } else { result.push(svg[i]); i++; }
  }
  return result.join("");
}

// Fetch the SVG from the API
const resp = await fetch("http://localhost:3000/api/freedxf/files/1");
const data = await resp.json();
const svgRaw = data.file?.svgPreview;

if (!svgRaw) { console.log("No SVG data found"); process.exit(1); }

console.log("SVG length:", svgRaw.length);
console.log("Has </svg>:", svgRaw.includes("</svg>"));

// Fix truncated SVG
let svg = svgRaw;
if (!svg.includes("</svg>")) {
  svg += '"/></svg>';
}

// Ensure xmlns
if (!svg.includes("xmlns")) {
  svg = svg.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
}

// Fix void elements
svg = fixUnclosedVoidElements(svg);

// Extract viewBox
const vbMatch = svg.match(/viewBox=["']([^"']+)["']/);
let w = 1024, h = 1024;
if (vbMatch) {
  const parts = vbMatch[1].trim().split(/[\s,]+/);
  if (parts.length === 4) { w = parseFloat(parts[2]); h = parseFloat(parts[3]); }
}

// Add width/height
if (!/<svg[^>]*\swidth=/.test(svg)) svg = svg.replace(/<svg/, `<svg width="${w}" height="${h}"`);
if (!/<svg[^>]*\sheight=/.test(svg)) svg = svg.replace(/<svg/, `<svg height="${h}"`);

// Add white background
svg = svg.replace(/<svg([^>]*)>/, `<svg$1><rect width="100%" height="100%" fill="white"/>`);

console.log("Fixed SVG length:", svg.length);
console.log("Last 50 chars:", svg.substring(svg.length - 50));

try {
  const pngBuffer = await sharp(Buffer.from(svg))
    .resize(600, 600, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .png()
    .toBuffer();
  
  // Save locally to verify
  const fs = await import("fs");
  fs.writeFileSync("/tmp/lion-preview.png", pngBuffer);
  console.log("PNG generated successfully! Size:", pngBuffer.length, "bytes");
  console.log("Saved to /tmp/lion-preview.png");
} catch (err) {
  console.error("Sharp error:", err.message);
}

/**
 * Cleans an SVG string for preview display:
 * - Removes all fill attributes/styles (sets to none)
 * - Removes any existing stroke/stroke-width attributes to prevent duplicates
 * - Adds clean stroke="black" stroke-width="0.5" fill="none" to all <path> elements
 * - Removes all <text> elements (watermarks, labels, etc.)
 * - Removes all <defs> sections that may contain unwanted elements
 * - Removes pixel width/height from <svg> element (keeps only viewBox) so the SVG
 *   renders as a true scalable vector — not a rasterized bitmap — at all zoom levels.
 * - Trims the viewBox to tightly fit the actual drawn content (no empty whitespace).
 *
 * This fixes the "Attribute stroke redefined" error that occurs when potrace
 * or other SVG sources already have stroke attributes on paths.
 *
 * WHY remove width/height from <svg>?
 * When an <svg> has explicit pixel dimensions (e.g. width="800" height="600"),
 * browsers rasterize it at that fixed resolution and then scale the bitmap.
 * Removing width/height (keeping only viewBox) forces the browser to render
 * the SVG as a vector at whatever size the container provides — so zooming
 * stays perfectly crisp at any scale factor.
 */

/**
 * Parse a single SVG path "d" attribute and return an approximate bounding box.
 * We only handle M, L, H, V, C, S, Q, T, A commands (absolute + relative).
 * This is intentionally approximate — good enough for viewBox trimming.
 */
function pathBBox(d: string): { minX: number; minY: number; maxX: number; maxY: number } | null {
  const coords: Array<{ x: number; y: number }> = [];
  let cx = 0, cy = 0;

  // Tokenise the path data into commands + argument lists
  const tokens = d.match(/[MmLlHhVvCcSsQqTtAaZz]|[-+]?[0-9]*\.?[0-9]+(?:[eE][-+]?[0-9]+)?/g);
  if (!tokens) return null;

  let i = 0;
  let cmd = 'M';
  while (i < tokens.length) {
    const t = tokens[i];
    if (/[MmLlHhVvCcSsQqTtAaZz]/.test(t)) {
      cmd = t;
      i++;
      continue;
    }
    const nums = () => {
      const n = parseFloat(tokens[i] ?? '0');
      i++;
      return n;
    };
    switch (cmd) {
      case 'M': cx = nums(); cy = nums(); coords.push({ x: cx, y: cy }); cmd = 'L'; break;
      case 'm': cx += nums(); cy += nums(); coords.push({ x: cx, y: cy }); cmd = 'l'; break;
      case 'L': cx = nums(); cy = nums(); coords.push({ x: cx, y: cy }); break;
      case 'l': cx += nums(); cy += nums(); coords.push({ x: cx, y: cy }); break;
      case 'H': cx = nums(); coords.push({ x: cx, y: cy }); break;
      case 'h': cx += nums(); coords.push({ x: cx, y: cy }); break;
      case 'V': cy = nums(); coords.push({ x: cx, y: cy }); break;
      case 'v': cy += nums(); coords.push({ x: cx, y: cy }); break;
      case 'C': { const x1=nums(),y1=nums(),x2=nums(),y2=nums(),x=nums(),y=nums(); coords.push({x:x1,y:y1},{x:x2,y:y2},{x,y}); cx=x; cy=y; break; }
      case 'c': { const x1=nums(),y1=nums(),x2=nums(),y2=nums(),x=nums(),y=nums(); coords.push({x:cx+x1,y:cy+y1},{x:cx+x2,y:cy+y2},{x:cx+x,y:cy+y}); cx+=x; cy+=y; break; }
      case 'S': { const x2=nums(),y2=nums(),x=nums(),y=nums(); coords.push({x:x2,y:y2},{x,y}); cx=x; cy=y; break; }
      case 's': { const x2=nums(),y2=nums(),x=nums(),y=nums(); coords.push({x:cx+x2,y:cy+y2},{x:cx+x,y:cy+y}); cx+=x; cy+=y; break; }
      case 'Q': { const x1=nums(),y1=nums(),x=nums(),y=nums(); coords.push({x:x1,y:y1},{x,y}); cx=x; cy=y; break; }
      case 'q': { const x1=nums(),y1=nums(),x=nums(),y=nums(); coords.push({x:cx+x1,y:cy+y1},{x:cx+x,y:cy+y}); cx+=x; cy+=y; break; }
      case 'T': { const x=nums(),y=nums(); coords.push({x,y}); cx=x; cy=y; break; }
      case 't': { const x=nums(),y=nums(); coords.push({x:cx+x,y:cy+y}); cx+=x; cy+=y; break; }
      case 'A': { nums();nums();nums();nums();nums(); cx=nums(); cy=nums(); coords.push({x:cx,y:cy}); break; }
      case 'a': { nums();nums();nums();nums();nums(); cx+=nums(); cy+=nums(); coords.push({x:cx,y:cy}); break; }
      case 'Z': case 'z': break;
      default: i++; break;
    }
  }

  if (coords.length === 0) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const { x, y } of coords) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY };
}

/**
 * Compute the tight bounding box of all <path d="..."> elements in an SVG string.
 * Returns null if no paths found or bounding box is degenerate.
 */
function computeSvgContentBBox(svg: string): { minX: number; minY: number; maxX: number; maxY: number } | null {
  const pathRe = /\bd="([^"]+)"/g;
  let m: RegExpExecArray | null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let found = false;

  while ((m = pathRe.exec(svg)) !== null) {
    const bb = pathBBox(m[1]);
    if (!bb) continue;
    found = true;
    if (bb.minX < minX) minX = bb.minX;
    if (bb.minY < minY) minY = bb.minY;
    if (bb.maxX > maxX) maxX = bb.maxX;
    if (bb.maxY > maxY) maxY = bb.maxY;
  }

  if (!found || maxX <= minX || maxY <= minY) return null;
  return { minX, minY, maxX, maxY };
}

/**
 * Trim the SVG viewBox to tightly fit the actual drawn content.
 * Adds a small padding (2% of the larger dimension) so strokes aren't clipped.
 */
function trimViewBox(svg: string): string {
  const bb = computeSvgContentBBox(svg);
  if (!bb) return svg;

  const pad = Math.max(bb.maxX - bb.minX, bb.maxY - bb.minY) * 0.02;
  const x = (bb.minX - pad).toFixed(2);
  const y = (bb.minY - pad).toFixed(2);
  const w = (bb.maxX - bb.minX + pad * 2).toFixed(2);
  const h = (bb.maxY - bb.minY + pad * 2).toFixed(2);

  const newVb = `viewBox="${x} ${y} ${w} ${h}"`;
  if (/viewBox=/i.test(svg)) {
    return svg.replace(/viewBox="[^"]*"/i, newVb);
  }
  return svg.replace(/<svg/i, `<svg ${newVb}`);
}

export function cleanSvgForPreview(rawSvg: string): string {
  const cleaned = rawSvg
    // Remove all <text>...</text> elements (watermarks like "dxfai.net")
    .replace(/<text[^>]*>[\s\S]*?<\/text>/gi, '')
    // Remove all <tspan>...</tspan> elements
    .replace(/<tspan[^>]*>[\s\S]*?<\/tspan>/gi, '')
    // Remove pixel width/height from <svg> element so it scales as true vector.
    // Keep viewBox intact — that's what defines the coordinate system.
    .replace(/(<svg[^>]*)\s+width="[0-9.]+(?:px|pt|mm|cm|in)?"/gi, '$1')
    .replace(/(<svg[^>]*)\s+height="[0-9.]+(?:px|pt|mm|cm|in)?"/gi, '$1')
    // Remove fill attributes (attribute form)
    .replace(/\s+fill="[^"]*"/g, '')
    // Remove fill in style attributes
    .replace(/fill:[^;"'\s]*(;|(?=["'\s]))/g, 'fill:none$1')
    // Remove existing stroke attributes (to prevent duplicates)
    .replace(/\s+stroke="[^"]*"/g, '')
    // Remove existing stroke-width attributes
    .replace(/\s+stroke-width="[^"]*"/g, '')
    // Remove existing stroke-linecap attributes
    .replace(/\s+stroke-linecap="[^"]*"/g, '')
    // Remove existing stroke-linejoin attributes
    .replace(/\s+stroke-linejoin="[^"]*"/g, '')
    // Remove stroke in style attributes
    .replace(/stroke:[^;"'\s]*(;|(?=["'\s]))/g, '')
    // Remove stroke-width in style attributes
    .replace(/stroke-width:[^;"'\s]*(;|(?=["'\s]))/g, '')
    // Now add clean stroke attributes to all path elements
    .replace(/<path /g, '<path stroke="black" stroke-width="0.5" fill="none" ');

  // Trim viewBox to tightly fit actual content — removes empty whitespace around drawing
  return trimViewBox(cleaned);
}

/**
 * Cleans an SVG string for preview display:
 * - Removes all fill attributes/styles (sets to none)
 * - Removes any existing stroke/stroke-width attributes to prevent duplicates
 * - Adds clean stroke="black" stroke-width="0.5" fill="none" to all <path> elements
 * - Removes all <text> elements (watermarks, labels, etc.)
 * - Removes all <defs> sections that may contain unwanted elements
 * - Removes pixel width/height from <svg> element (keeps only viewBox) so the SVG
 *   renders as a true scalable vector — not a rasterized bitmap — at all zoom levels.
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
export function cleanSvgForPreview(rawSvg: string): string {
  return rawSvg
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
}

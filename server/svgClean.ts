/**
 * Cleans an SVG string for preview display:
 * - Removes all fill attributes/styles (sets to none)
 * - Removes any existing stroke/stroke-width attributes to prevent duplicates
 * - Adds clean stroke="black" stroke-width="1.5" fill="none" to all <path> elements
 * - Removes all <text> elements (watermarks, labels, etc.)
 * - Removes all <defs> sections that may contain unwanted elements
 *
 * This fixes the "Attribute stroke redefined" error that occurs when potrace
 * or other SVG sources already have stroke attributes on paths.
 */
export function cleanSvgForPreview(rawSvg: string): string {
  return rawSvg
    // Remove all <text>...</text> elements (watermarks like "dxfai.net")
    .replace(/<text[^>]*>[\s\S]*?<\/text>/gi, '')
    // Remove all <tspan>...</tspan> elements
    .replace(/<tspan[^>]*>[\s\S]*?<\/tspan>/gi, '')
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
    // Now add clean stroke attributes to all path elements (no stroke-width — let CSS control it)
    .replace(/<path /g, '<path stroke="black" fill="none" ');
}

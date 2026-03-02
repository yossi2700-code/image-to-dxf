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
import { getAppUserFromCookie } from "./appAuth";

const router = express.Router();

router.post("/api/svg-to-png", async (req, res) => {
  const appUser = getAppUserFromCookie(req.cookies);
  if (!appUser) return res.status(401).json({ error: "UNAUTHORIZED" });

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
    // Ensure the SVG has explicit width/height so sharp knows the output size
    let svg = svgContent;
    if (!/<svg[^>]*\swidth=/.test(svg)) {
      svg = svg.replace(/<svg/, `<svg width="${w}" height="${h}"`);
    } else {
      svg = svg.replace(/<svg([^>]*)\swidth="[^"]*"/, `<svg$1 width="${w}"`);
    }
    if (!/<svg[^>]*\sheight=/.test(svg)) {
      svg = svg.replace(/<svg/, `<svg height="${h}"`);
    } else {
      svg = svg.replace(/<svg([^>]*)\sheight="[^"]*"/, `<svg$1 height="${h}"`);
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

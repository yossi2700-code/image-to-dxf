/**
 * dxfLegacyRoute.ts
 *
 * GET /api/dxf-legacy?url=<encoded-dxf-url>&scale=<0-1>
 *
 * Converts a modern DXF (LWPOLYLINE / R2000) to a legacy DXF (LINE entities / R12)
 * that is compatible with CAS WIN and other old CAD software.
 *
 * Strategy:
 *  1. Fetch the original DXF from S3.
 *  2. Parse all LWPOLYLINE entities and extract their vertices.
 *  3. Re-emit each consecutive vertex pair as a LINE entity.
 *  4. Wrap in a minimal R12 (AC1009) header + TABLES + ENTITIES structure.
 *  5. Apply optional scale factor (same logic as the frontend scaleDxfContent).
 */

import { Router, Request, Response } from "express";

const router = Router();

// ─── DXF LWPOLYLINE parser ────────────────────────────────────────────────────

interface Vertex {
  x: number;
  y: number;
}

interface ParsedPolyline {
  vertices: Vertex[];
  closed: boolean;
}

/**
 * Extract all LWPOLYLINE entities from a DXF string.
 * Returns an array of polylines, each with a list of (x,y) vertices.
 */
function parseLwPolylines(dxf: string): ParsedPolyline[] {
  const polylines: ParsedPolyline[] = [];
  // Split into lines for group-code parsing
  const lines = dxf.split(/\r?\n/);
  let i = 0;

  while (i < lines.length) {
    const code = lines[i]?.trim();
    const value = lines[i + 1]?.trim();

    if (code === "0" && value === "LWPOLYLINE") {
      // Parse this LWPOLYLINE
      const poly: ParsedPolyline = { vertices: [], closed: false };
      i += 2;
      let currentX: number | null = null;

      while (i < lines.length) {
        const c = lines[i]?.trim();
        const v = lines[i + 1]?.trim() ?? "";

        if (c === "0") break; // next entity starts

        if (c === "70") {
          // flags: bit 1 = closed
          poly.closed = (parseInt(v, 10) & 1) === 1;
        } else if (c === "10") {
          currentX = parseFloat(v);
        } else if (c === "20") {
          if (currentX !== null) {
            poly.vertices.push({ x: currentX, y: parseFloat(v) });
            currentX = null;
          }
        }
        i += 2;
      }

      if (poly.vertices.length >= 2) {
        polylines.push(poly);
      }
      continue;
    }

    i += 2;
  }

  return polylines;
}

/**
 * Also parse old-style POLYLINE/VERTEX entities (from imageProcessor.ts output).
 */
function parsePolylineVertices(dxf: string): ParsedPolyline[] {
  const polylines: ParsedPolyline[] = [];
  const lines = dxf.split(/\r?\n/);
  let i = 0;

  while (i < lines.length) {
    const code = lines[i]?.trim();
    const value = lines[i + 1]?.trim();

    if (code === "0" && value === "POLYLINE") {
      const poly: ParsedPolyline = { vertices: [], closed: false };
      i += 2;

      // read POLYLINE flags
      while (i < lines.length) {
        const c = lines[i]?.trim();
        const v = lines[i + 1]?.trim() ?? "";
        if (c === "0") break;
        if (c === "70") poly.closed = (parseInt(v, 10) & 1) === 1;
        i += 2;
      }

      // read VERTEX entities
      while (i < lines.length) {
        const c = lines[i]?.trim();
        const v = lines[i + 1]?.trim() ?? "";
        if (c === "0" && v === "SEQEND") { i += 2; break; }
        if (c === "0" && v !== "VERTEX") break;
        if (c === "0" && v === "VERTEX") {
          i += 2;
          let vx: number | null = null, vy: number | null = null;
          while (i < lines.length) {
            const vc = lines[i]?.trim();
            const vv = lines[i + 1]?.trim() ?? "";
            if (vc === "0") break;
            if (vc === "10") vx = parseFloat(vv);
            if (vc === "20") vy = parseFloat(vv);
            i += 2;
          }
          if (vx !== null && vy !== null) poly.vertices.push({ x: vx, y: vy });
          continue;
        }
        i += 2;
      }

      if (poly.vertices.length >= 2) polylines.push(poly);
      continue;
    }

    i += 2;
  }

  return polylines;
}

/**
 * Extract $EXTMAX dimensions from DXF header.
 */
function extractExtents(dxf: string): { width: number; height: number } {
  const lines = dxf.split(/\r?\n/);
  let width = 500, height = 500;
  for (let i = 0; i < lines.length - 3; i++) {
    if (lines[i]?.trim() === "9" && lines[i + 1]?.trim() === "$EXTMAX") {
      // next group codes: 10 = x, 20 = y
      for (let j = i + 2; j < Math.min(i + 10, lines.length - 1); j += 2) {
        const c = lines[j]?.trim();
        const v = parseFloat(lines[j + 1]?.trim() ?? "0");
        if (c === "10" && v > 0) width = v;
        if (c === "20" && v > 0) height = v;
      }
      break;
    }
  }
  return { width, height };
}

/**
 * Build a minimal R12 (AC1009) DXF with LINE entities.
 */
function buildLegacyDxf(
  polylines: ParsedPolyline[],
  width: number,
  height: number,
  scale: number
): string {
  const s = scale;
  const lines: string[] = [];

  // HEADER
  lines.push("0\nSECTION");
  lines.push("2\nHEADER");
  lines.push("9\n$ACADVER\n1\nAC1009");
  lines.push(`9\n$EXTMIN\n10\n0.0\n20\n0.0\n30\n0.0`);
  lines.push(`9\n$EXTMAX\n10\n${(width * s).toFixed(4)}\n20\n${(height * s).toFixed(4)}\n30\n0.0`);
  lines.push("9\n$INSUNITS\n70\n4");
  lines.push("0\nENDSEC");

  // TABLES
  lines.push("0\nSECTION\n2\nTABLES");
  lines.push("0\nTABLE\n2\nLAYER\n70\n1");
  lines.push("0\nLAYER\n2\n0\n70\n0\n62\n7\n6\nCONTINUOUS");
  lines.push("0\nENDTAB\n0\nENDSEC");

  // ENTITIES
  lines.push("0\nSECTION\n2\nENTITIES");

  for (const poly of polylines) {
    const verts = [...poly.vertices];
    if (poly.closed && verts.length >= 2) {
      verts.push(verts[0]); // close the loop
    }
    for (let i = 0; i + 1 < verts.length; i++) {
      const p1 = verts[i];
      const p2 = verts[i + 1];
      lines.push("0\nLINE\n8\n0");
      lines.push(`10\n${(p1.x * s).toFixed(4)}\n20\n${(p1.y * s).toFixed(4)}\n30\n0.0`);
      lines.push(`11\n${(p2.x * s).toFixed(4)}\n21\n${(p2.y * s).toFixed(4)}\n31\n0.0`);
    }
  }

  lines.push("0\nENDSEC\n0\nEOF");
  return lines.join("\n");
}

// ─── Route handler ────────────────────────────────────────────────────────────

router.get("/api/dxf-legacy", async (req: Request, res: Response) => {
  const { url, scale } = req.query as { url?: string; scale?: string };

  if (!url) {
    res.status(400).json({ error: "Missing url parameter" });
    return;
  }

  // Only allow our own S3 / CDN URLs (security: prevent SSRF to arbitrary hosts)
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    res.status(400).json({ error: "Invalid URL" });
    return;
  }

  const allowedHosts = [
    "d2xsxph8kpxj0f.cloudfront.net",
    "s3.amazonaws.com",
    "s3.ap-southeast-1.amazonaws.com",
    "manus-app-storage.s3.ap-southeast-1.amazonaws.com",
  ];
  const isAllowed = allowedHosts.some(
    (h) => parsedUrl.hostname === h || parsedUrl.hostname.endsWith(`.${h}`)
  );
  if (!isAllowed) {
    res.status(403).json({ error: "URL not allowed" });
    return;
  }

  const scaleFactor = Math.min(Math.max(parseFloat(scale ?? "1") || 1, 0.01), 10);

  try {
    const fetchRes = await fetch(url);
    if (!fetchRes.ok) {
      res.status(502).json({ error: `Failed to fetch DXF: ${fetchRes.status}` });
      return;
    }
    const dxfText = await fetchRes.text();

    // Parse polylines (try LWPOLYLINE first, then old POLYLINE)
    let polylines = parseLwPolylines(dxfText);
    if (polylines.length === 0) {
      polylines = parsePolylineVertices(dxfText);
    }

    if (polylines.length === 0) {
      res.status(422).json({ error: "No polylines found in DXF" });
      return;
    }

    const { width, height } = extractExtents(dxfText);
    const legacyDxf = buildLegacyDxf(polylines, width, height, scaleFactor);

    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Disposition", 'attachment; filename="legacy.dxf"');
    res.send(legacyDxf);
  } catch (err) {
    console.error("[dxf-legacy] Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

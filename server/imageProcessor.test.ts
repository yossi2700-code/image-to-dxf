import { describe, it, expect } from "vitest";
import {
  applyThreshold,
  sobelEdgeDetection,
  edgesToSegments,
  segmentsToDxf,
  segmentsToSvg,
  doubleLineSegments,
  chainSegmentsToPolylines,
  offsetPolyline,
  doubleLinePolylines,
  polylinesToSegments,
  thinBinary,
} from "./imageProcessor";

describe("applyThreshold", () => {
  it("should convert pixels below threshold to 0 (black)", () => {
    const pixels = new Uint8Array([50, 100, 150, 200]);
    const result = applyThreshold(pixels, 128);
    expect(result[0]).toBe(0);   // 50 < 128 → black
    expect(result[1]).toBe(0);   // 100 < 128 → black
    expect(result[2]).toBe(255); // 150 >= 128 → white
    expect(result[3]).toBe(255); // 200 >= 128 → white
  });

  it("should return all black for threshold 255", () => {
    const pixels = new Uint8Array([0, 100, 200, 254]);
    const result = applyThreshold(pixels, 255);
    expect(Array.from(result)).toEqual([0, 0, 0, 0]);
  });

  it("should return all white for threshold 0", () => {
    const pixels = new Uint8Array([0, 100, 200, 255]);
    const result = applyThreshold(pixels, 0);
    expect(Array.from(result)).toEqual([255, 255, 255, 255]);
  });
});

describe("sobelEdgeDetection", () => {
  it("should detect no edges in a uniform image", () => {
    // 5x5 all-white image
    const width = 5;
    const height = 5;
    const pixels = new Uint8Array(width * height).fill(255);
    const edges = sobelEdgeDetection(pixels, width, height);
    // All interior pixels should be 0 (no edges)
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        expect(edges[y * width + x]).toBe(0);
      }
    }
  });

  it("should detect edges at black/white boundary", () => {
    // 5x5 image: left half black, right half white
    const width = 5;
    const height = 5;
    const pixels = new Uint8Array(width * height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        pixels[y * width + x] = x < 3 ? 0 : 255;
      }
    }
    const edges = sobelEdgeDetection(pixels, width, height);
    // There should be at least one edge pixel
    const hasEdge = Array.from(edges).some((v) => v === 255);
    expect(hasEdge).toBe(true);
  });
});

describe("edgesToSegments", () => {
  it("should return empty array for no edges", () => {
    const width = 5;
    const height = 5;
    const edges = new Uint8Array(width * height).fill(0);
    const segs = edgesToSegments(edges, width, height, { threshold: 128, simplifyTolerance: 1 });
    expect(segs).toHaveLength(0);
  });

  it("should detect a horizontal segment", () => {
    const width = 10;
    const height = 5;
    const edges = new Uint8Array(width * height).fill(0);
    // Draw a horizontal line at y=2, x=2..7
    for (let x = 2; x <= 7; x++) {
      edges[2 * width + x] = 255;
    }
    const segs = edgesToSegments(edges, width, height, { threshold: 128, simplifyTolerance: 1 });
    const hSeg = segs.find((s) => s.y1 === s.y2 && s.y1 === 2);
    expect(hSeg).toBeDefined();
    expect(hSeg!.x1).toBe(2);
    expect(hSeg!.x2).toBe(7);
  });
});

describe("segmentsToDxf", () => {
  it("should produce valid DXF with header and EOF", () => {
    const segments = [
      { x1: 0, y1: 0, x2: 10, y2: 0 },
      { x1: 0, y1: 0, x2: 0, y2: 10 },
    ];
    const dxf = segmentsToDxf(segments, 100, 100);
    expect(dxf).toContain("SECTION");
    expect(dxf).toContain("ENTITIES");
    // segmentsToDxf chains segments into LWPOLYLINE entities (not LINE)
    expect(dxf).toContain("LWPOLYLINE");
    expect(dxf).toContain("EOF");
  });

  it("should produce LWPOLYLINE entities (not separate LINE entities)", () => {
    // segmentsToDxf chains collinear segments into polylines
    const segments = Array.from({ length: 5 }, (_, i) => ({
      x1: i, y1: 0, x2: i + 1, y2: 0,
    }));
    const dxf = segmentsToDxf(segments, 100, 100);
    // All collinear segments chain into 1 LWPOLYLINE
    expect(dxf).toContain("LWPOLYLINE");
    // No separate LINE entities
    expect(dxf).not.toContain("\n0\nLINE\n");
  });

  it("should flip Y axis correctly", () => {
    const segments = [{ x1: 0, y1: 10, x2: 5, y2: 10 }];
    const dxf = segmentsToDxf(segments, 100, 100);
    // y1 should be height - 10 = 90
    expect(dxf).toContain("20\n90");
  });
});

describe("segmentsToSvg", () => {
  it("should produce valid SVG with correct viewBox", () => {
    const segments = [{ x1: 0, y1: 0, x2: 10, y2: 0 }];
    const svg = segmentsToSvg(segments, 100, 80);
    expect(svg).toContain('<svg');
    expect(svg).toContain('viewBox="0 0 100 80"');
    expect(svg).toContain('</svg>');
  });

  it("should include correct number of line elements", () => {
    const segments = [
      { x1: 0, y1: 0, x2: 10, y2: 0 },
      { x1: 5, y1: 5, x2: 5, y2: 20 },
      { x1: 10, y1: 10, x2: 50, y2: 10 },
    ];
    const svg = segmentsToSvg(segments, 100, 100);
    const lineCount = (svg.match(/<line /g) ?? []).length;
    expect(lineCount).toBe(3);
  });

  it("should use correct coordinates in line elements", () => {
    const segments = [{ x1: 5, y1: 10, x2: 50, y2: 10 }];
    const svg = segmentsToSvg(segments, 100, 100);
    expect(svg).toContain('x1="5"');
    expect(svg).toContain('y1="10"');
    expect(svg).toContain('x2="50"');
    expect(svg).toContain('y2="10"');
  });

  it("should return empty SVG with no lines for empty segments", () => {
    const svg = segmentsToSvg([], 100, 100);
    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
    const lineCount = (svg.match(/<line /g) ?? []).length;
    expect(lineCount).toBe(0);
  });
});

describe("doubleLineSegments (legacy)", () => {
  it("should return original segments when offset is 0", () => {
    const segs = [{ x1: 0, y1: 5, x2: 10, y2: 5 }];
    const result = doubleLineSegments(segs, 0);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(segs[0]);
  });

  it("should produce 2 segments for a horizontal line (original + parallel offset)", () => {
    const segs = [{ x1: 0, y1: 5, x2: 10, y2: 5 }];
    const result = doubleLineSegments(segs, 4);
    // original + parallel only (no caps) = 2
    expect(result).toHaveLength(2);
  });

  it("should produce 2 segments for a vertical line (original + parallel offset)", () => {
    const segs = [{ x1: 5, y1: 0, x2: 5, y2: 10 }];
    const result = doubleLineSegments(segs, 4);
    // original + parallel only (no caps) = 2
    expect(result).toHaveLength(2);
  });

  it("should offset horizontal line by correct Y amount", () => {
    const segs = [{ x1: 0, y1: 10, x2: 20, y2: 10 }];
    const result = doubleLineSegments(segs, 4);
    // The offset line should be at y = 10 - 4 = 6
    const offsetLine = result.find(s => s.y1 === 6 && s.y2 === 6);
    expect(offsetLine).toBeDefined();
  });

  it("should offset vertical line by correct X amount", () => {
    const segs = [{ x1: 10, y1: 0, x2: 10, y2: 20 }];
    const result = doubleLineSegments(segs, 4);
    // The offset line should be at x = 10 + 4 = 14
    const offsetLine = result.find(s => s.x1 === 14 && s.x2 === 14);
    expect(offsetLine).toBeDefined();
  });

  it("should handle multiple segments", () => {
    const segs = [
      { x1: 0, y1: 5, x2: 10, y2: 5 },
      { x1: 5, y1: 0, x2: 5, y2: 10 },
    ];
    const result = doubleLineSegments(segs, 3);
    // Each segment produces 2 lines (original + parallel, no caps) → 2 × 2 = 4
    expect(result).toHaveLength(4);
  });
});

// ─── New polyline-based double-line tests ────────────────────────────────────

describe("chainSegmentsToPolylines", () => {
  it("should return empty array for no segments", () => {
    const result = chainSegmentsToPolylines([]);
    expect(result).toHaveLength(0);
  });

  it("should chain two connected segments into one polyline", () => {
    // seg1: (0,0)→(5,0), seg2: (5,0)→(10,0) — share endpoint (5,0)
    const segs = [
      { x1: 0, y1: 0, x2: 5, y2: 0 },
      { x1: 5, y1: 0, x2: 10, y2: 0 },
    ];
    const polylines = chainSegmentsToPolylines(segs, 1);
    // Should produce 1 polyline with 3 points
    expect(polylines).toHaveLength(1);
    expect(polylines[0]).toHaveLength(3);
  });

  it("should keep disconnected segments as separate polylines", () => {
    // Two segments far apart
    const segs = [
      { x1: 0, y1: 0, x2: 5, y2: 0 },
      { x1: 50, y1: 50, x2: 60, y2: 50 },
    ];
    const polylines = chainSegmentsToPolylines(segs, 1);
    expect(polylines).toHaveLength(2);
  });

  it("should chain a chain of 3 segments into one polyline", () => {
    const segs = [
      { x1: 0, y1: 0, x2: 10, y2: 0 },
      { x1: 10, y1: 0, x2: 10, y2: 10 },
      { x1: 10, y1: 10, x2: 20, y2: 10 },
    ];
    const polylines = chainSegmentsToPolylines(segs, 1);
    expect(polylines).toHaveLength(1);
    expect(polylines[0]).toHaveLength(4);
  });
});

describe("offsetPolyline", () => {
  it("should return same length polyline", () => {
    const poly: [number, number][] = [[0, 0], [10, 0], [10, 10]];
    const result = offsetPolyline(poly, 3);
    expect(result).toHaveLength(3);
  });

  it("should offset a horizontal line perpendicular by the given amount", () => {
    // Horizontal line going right (y=10): right-hand normal points downward (y decreases)
    // offset +4 → y=6 (y=10-4), offset -4 → y=14 (y=10+4)
    const poly: [number, number][] = [[0, 10], [20, 10]];
    const resultPos = offsetPolyline(poly, 4);
    const resultNeg = offsetPolyline(poly, -4);
    // The two offset lines should be 2*offset pixels apart
    const gap = Math.abs(resultPos[0][1] - resultNeg[0][1]);
    expect(gap).toBeCloseTo(8, 0);
    // Each point should be offset by exactly 4 from the original
    expect(Math.abs(resultPos[0][1] - 10)).toBeCloseTo(4, 0);
    expect(Math.abs(resultNeg[0][1] - 10)).toBeCloseTo(4, 0);
  });

  it("should offset a vertical line perpendicular by the given amount", () => {
    // Vertical line going down (x=10): right-hand normal points to the right (x increases)
    // offset +5 → x=15 (x=10+5), offset -5 → x=5 (x=10-5)
    const poly: [number, number][] = [[10, 0], [10, 20]];
    const resultPos = offsetPolyline(poly, 5);
    const resultNeg = offsetPolyline(poly, -5);
    // The two offset lines should be 2*offset pixels apart
    const gap = Math.abs(resultPos[0][0] - resultNeg[0][0]);
    expect(gap).toBeCloseTo(10, 0);
    // Each point should be offset by exactly 5 from the original
    expect(Math.abs(resultPos[0][0] - 10)).toBeCloseTo(5, 0);
    expect(Math.abs(resultNeg[0][0] - 10)).toBeCloseTo(5, 0);
  });

  it("should handle single-point polyline gracefully", () => {
    const poly: [number, number][] = [[5, 5]];
    const result = offsetPolyline(poly, 3);
    expect(result).toHaveLength(1);
  });
});

describe("doubleLinePolylines", () => {
  it("should return original polylines when offset is 0", () => {
    const polys: [number, number][][] = [[[0, 0], [10, 0]]];
    const result = doubleLinePolylines(polys, 0);
    expect(result).toHaveLength(1);
  });

  it("should produce 2 polylines for each input polyline", () => {
    const polys: [number, number][][] = [
      [[0, 0], [10, 0]],
      [[0, 5], [10, 5]],
    ];
    const result = doubleLinePolylines(polys, 4);
    // 2 input polylines × 2 = 4 output polylines
    expect(result).toHaveLength(4);
  });

  it("should produce parallel lines with correct total gap", () => {
    // Horizontal polyline at y=10, doubleLinePolylines with offset=4
    // halfOffset=2: line1 at y=8 (10-2), line2 at y=12 (10+2) → gap = 4
    const polys: [number, number][][] = [[[0, 10], [20, 10]]];
    const result = doubleLinePolylines(polys, 4);
    expect(result).toHaveLength(2);
    // The two lines should be exactly `offset` pixels apart total
    const y0 = result[0][0][1];
    const y1 = result[1][0][1];
    expect(Math.abs(y0 - y1)).toBeCloseTo(4, 0);
    // Each line should be offset/2 = 2 pixels from the original (y=10)
    expect(Math.abs(y0 - 10)).toBeCloseTo(2, 0);
    expect(Math.abs(y1 - 10)).toBeCloseTo(2, 0);
  });
});

describe("polylinesToSegments", () => {
  it("should convert a 3-point polyline to 2 segments", () => {
    const polys: [number, number][][] = [[[0, 0], [5, 0], [10, 0]]];
    const segs = polylinesToSegments(polys);
    expect(segs).toHaveLength(2);
  });

  it("should return empty array for empty polylines", () => {
    const segs = polylinesToSegments([]);
    expect(segs).toHaveLength(0);
  });

  it("should correctly map polyline points to segment endpoints", () => {
    const polys: [number, number][][] = [[[1, 2], [3, 4]]];
    const segs = polylinesToSegments(polys);
    expect(segs[0]).toEqual({ x1: 1, y1: 2, x2: 3, y2: 4 });
  });
});

import { douglasPeucker, traceCenterlines } from "./imageProcessor";

describe("douglasPeucker", () => {
  it("should return unchanged polyline with 2 points", () => {
    const pts: [number, number][] = [[0, 0], [10, 10]];
    expect(douglasPeucker(pts, 1)).toEqual(pts);
  });

  it("should remove collinear middle points", () => {
    // Straight line with extra collinear points
    const pts: [number, number][] = [[0, 0], [5, 0], [10, 0], [15, 0]];
    const result = douglasPeucker(pts, 0.5);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual([0, 0]);
    expect(result[result.length - 1]).toEqual([15, 0]);
  });

  it("should keep corner points that deviate more than epsilon", () => {
    // L-shaped path: corner at (10, 0) deviates from straight line (0,0)→(10,10)
    const pts: [number, number][] = [[0, 0], [10, 0], [10, 10]];
    const result = douglasPeucker(pts, 0.5);
    // Corner should be preserved
    expect(result).toHaveLength(3);
  });

  it("should reduce many collinear points to 2", () => {
    const pts: [number, number][] = Array.from({ length: 20 }, (_, i) => [i, 0] as [number, number]);
    const result = douglasPeucker(pts, 0.1);
    expect(result).toHaveLength(2);
  });
});

describe("traceCenterlines", () => {
  it("should return empty array for blank image", () => {
    const edges = new Uint8Array(100).fill(0);
    const result = traceCenterlines(edges, 10, 10, 0.5);
    expect(result).toHaveLength(0);
  });

  it("should trace a horizontal line as a single polyline", () => {
    // 10x5 image with a horizontal line of edge pixels in the middle row
    const width = 10;
    const height = 5;
    const edges = new Uint8Array(width * height).fill(0);
    // Row 2: all pixels are edge
    for (let x = 1; x < 9; x++) edges[2 * width + x] = 255;
    const result = traceCenterlines(edges, width, height, 0.5);
    expect(result.length).toBeGreaterThanOrEqual(1);
    // All points should be on row 2
    for (const poly of result) {
      for (const [, y] of poly) {
        expect(y).toBe(2);
      }
    }
  });

  it("should produce single-pixel-wide output (no duplicate y for horizontal line)", () => {
    const width = 20;
    const height = 10;
    const edges = new Uint8Array(width * height).fill(0);
    // Draw a 1px horizontal line
    for (let x = 2; x < 18; x++) edges[5 * width + x] = 255;
    const result = traceCenterlines(edges, width, height, 0);
    // Should be a single polyline
    expect(result.length).toBe(1);
    // All y-values should be 5 (single row)
    for (const [, y] of result[0]) {
      expect(y).toBe(5);
    }
  });
});

describe("thinBinary", () => {
  it("should thin a thick horizontal black line to single-pixel width", () => {
    const width = 20, height = 10;
    // binary: 0=black (foreground), 255=white (background)
    const binary = new Uint8Array(width * height).fill(255);
    // Draw a 3px thick horizontal black line at rows 3-5
    for (let y = 3; y <= 5; y++) {
      for (let x = 2; x < 18; x++) {
        binary[y * width + x] = 0;
      }
    }
    const thinned = thinBinary(binary, width, height);
    // Count foreground pixels per column — should be at most 1 per column
    for (let x = 4; x < 16; x++) {
      let count = 0;
      for (let y = 0; y < height; y++) {
        if (thinned[y * width + x] === 255) count++;
      }
      expect(count).toBeLessThanOrEqual(1);
    }
  });

  it("should preserve connectivity of a 1px line", () => {
    const width = 20, height = 10;
    const binary = new Uint8Array(width * height).fill(255);
    // Draw a 1px horizontal black line at row 5
    for (let x = 2; x < 18; x++) binary[5 * width + x] = 0;
    const thinned = thinBinary(binary, width, height);
    // The line should still have pixels present
    let count = 0;
    for (let x = 2; x < 18; x++) {
      if (thinned[5 * width + x] === 255) count++;
    }
    expect(count).toBeGreaterThan(8);
  });

  it("should return all background for all-white input", () => {
    const width = 10, height = 10;
    const binary = new Uint8Array(width * height).fill(255);
    const thinned = thinBinary(binary, width, height);
    const hasEdge = Array.from(thinned).some((v) => v === 255);
    expect(hasEdge).toBe(false);
  });
});

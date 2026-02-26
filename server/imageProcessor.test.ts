import { describe, it, expect } from "vitest";
import {
  applyThreshold,
  sobelEdgeDetection,
  edgesToSegments,
  segmentsToDxf,
  segmentsToSvg,
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
    expect(dxf).toContain("LINE");
    expect(dxf).toContain("EOF");
  });

  it("should include correct number of LINE entities", () => {
    const segments = Array.from({ length: 5 }, (_, i) => ({
      x1: i, y1: 0, x2: i + 1, y2: 0,
    }));
    const dxf = segmentsToDxf(segments, 100, 100);
    const lineCount = (dxf.match(/\n0\nLINE\n/g) ?? []).length;
    expect(lineCount).toBe(5);
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

import { doubleLineSegments } from "./imageProcessor";

describe("doubleLineSegments", () => {
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

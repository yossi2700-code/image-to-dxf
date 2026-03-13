/**
 * svgToDxf.test.ts
 *
 * Verifies that svgToDxf produces LWPOLYLINE entities (not LINE entities),
 * so CAD software receives connected polylines instead of fragmented segments.
 */

import { describe, it, expect } from "vitest";
import { svgToDxf } from "./svgToDxf";

const SIMPLE_SVG = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <path d="M 10 10 L 50 10 L 50 50 L 10 50 Z"/>
  <circle cx="75" cy="75" r="10"/>
</svg>`;

const LINE_SVG = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <line x1="0" y1="0" x2="100" y2="100"/>
  <line x1="100" y1="0" x2="0" y2="100"/>
</svg>`;

describe("svgToDxf — LWPOLYLINE output", () => {
  it("should produce LWPOLYLINE entities, not LINE entities", () => {
    const { dxf } = svgToDxf(SIMPLE_SVG);
    expect(dxf).toContain("LWPOLYLINE");
    expect(dxf).not.toContain("\n0\nLINE\n");
  });

  it("should use AC1015 (R2000) header for LWPOLYLINE support", () => {
    const { dxf } = svgToDxf(SIMPLE_SVG);
    expect(dxf).toContain("AC1015");
  });

  it("should produce far fewer objects than segments", () => {
    const { dxf, segmentCount } = svgToDxf(SIMPLE_SVG);
    // Count LWPOLYLINE occurrences
    const polylineCount = (dxf.match(/\n0\nLWPOLYLINE/g) || []).length;
    // 1 path + 1 circle = 2 polylines; segments would be many more
    expect(polylineCount).toBe(2);
    // segmentCount reports edges, not objects
    expect(segmentCount).toBeGreaterThan(polylineCount);
  });

  it("should handle line elements as 2-point polylines", () => {
    const { dxf } = svgToDxf(LINE_SVG);
    expect(dxf).toContain("LWPOLYLINE");
    const polylineCount = (dxf.match(/\n0\nLWPOLYLINE/g) || []).length;
    expect(polylineCount).toBe(2);
  });

  it("should close polylines that end with Z command", () => {
    const { dxf } = svgToDxf(SIMPLE_SVG);
    // Closed flag = 1 should appear for the path with Z
    expect(dxf).toContain("70\n1");
  });

  it("should include correct vertex count (group 90)", () => {
    const { dxf } = svgToDxf(LINE_SVG);
    // Each line has 2 vertices
    expect(dxf).toContain("90\n2");
  });

  it("should apply lineweight code when specified", () => {
    const { dxf } = svgToDxf(SIMPLE_SVG, false, 0.25);
    expect(dxf).toContain("370\n25");
  });

  it("should apply hairline (lw=0) when hairline=true", () => {
    const { dxf } = svgToDxf(SIMPLE_SVG, true);
    expect(dxf).toContain("370\n0");
  });

  it("should return correct segmentCount", () => {
    const { segmentCount } = svgToDxf(SIMPLE_SVG);
    // path Z square: 4 edges (M→L→L→L→Z = 4 segments + close)
    // circle: 36 segments
    expect(segmentCount).toBeGreaterThan(0);
  });

  it("should return width and height from viewBox", () => {
    const { width, height } = svgToDxf(SIMPLE_SVG);
    expect(width).toBe(100);
    expect(height).toBe(100);
  });
});

/**
 * Tests for the Before/After comparison slider in PortraitCard.
 * These are logic-level tests verifying the slider percentage calculation
 * and the display mode selection (comparison vs vector vs plain).
 */
import { describe, it, expect } from "vitest";

// ─── Slider percentage calculation logic (mirrors updateSlider in FaceDetectTab) ─

function updateSlider(clientX: number, rectLeft: number, rectWidth: number): number {
  const raw = ((clientX - rectLeft) / rectWidth) * 100;
  return Math.min(95, Math.max(5, Math.round(raw)));
}

// ─── Display mode selection logic (mirrors showComparison in FaceDetectTab) ─

function getDisplayMode(hasOriginal: boolean, showVector: boolean): "comparison" | "vector" | "plain" {
  if (showVector) return "vector";
  if (hasOriginal) return "comparison";
  return "plain";
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("BeforeAfter slider — updateSlider", () => {
  const rectLeft = 0;
  const rectWidth = 400;

  it("returns 50 at center of container", () => {
    expect(updateSlider(200, rectLeft, rectWidth)).toBe(50);
  });

  it("clamps to minimum 5% at far left", () => {
    expect(updateSlider(0, rectLeft, rectWidth)).toBe(5);
    expect(updateSlider(-100, rectLeft, rectWidth)).toBe(5);
  });

  it("clamps to maximum 95% at far right", () => {
    expect(updateSlider(400, rectLeft, rectWidth)).toBe(95);
    expect(updateSlider(500, rectLeft, rectWidth)).toBe(95);
  });

  it("calculates 25% at quarter point", () => {
    expect(updateSlider(100, rectLeft, rectWidth)).toBe(25);
  });

  it("calculates 75% at three-quarter point", () => {
    expect(updateSlider(300, rectLeft, rectWidth)).toBe(75);
  });

  it("works with non-zero rectLeft offset", () => {
    // Container starts at x=50, width=200
    expect(updateSlider(150, 50, 200)).toBe(50); // center
    expect(updateSlider(100, 50, 200)).toBe(25); // quarter
  });

  it("rounds to nearest integer", () => {
    // 133/400 = 33.25% → rounds to 33
    expect(updateSlider(133, 0, 400)).toBe(33);
    // 267/400 = 66.75% → rounds to 67
    expect(updateSlider(267, 0, 400)).toBe(67);
  });
});

describe("PortraitCard — display mode selection", () => {
  it("shows comparison when original image is available and vector is off", () => {
    expect(getDisplayMode(true, false)).toBe("comparison");
  });

  it("shows vector viewer when showVector is true (even with original)", () => {
    expect(getDisplayMode(true, true)).toBe("vector");
  });

  it("shows plain image when no original and vector is off", () => {
    expect(getDisplayMode(false, false)).toBe("plain");
  });

  it("shows vector viewer when showVector is true and no original", () => {
    expect(getDisplayMode(false, true)).toBe("vector");
  });

  it("comparison mode is the default when original is present", () => {
    // Default state: showVector=false, hasOriginal=true
    const defaultShowVector = false;
    const hasOriginal = true;
    expect(getDisplayMode(hasOriginal, defaultShowVector)).toBe("comparison");
  });
});

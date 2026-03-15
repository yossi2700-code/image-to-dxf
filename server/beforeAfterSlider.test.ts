/**
 * Tests for the Before/After side-by-side panel in PortraitCard.
 * These are logic-level tests verifying the display mode selection
 * (side-by-side comparison vs vector viewer vs plain image).
 * The layout is now a static grid (no draggable slider), matching AiTraceTab.
 */
import { describe, it, expect } from "vitest";

// ─── Display mode selection logic (mirrors PortraitCard in FaceDetectTab) ───

function getDisplayMode(hasOriginal: boolean, showVector: boolean): "comparison" | "vector" | "plain" {
  if (showVector) return "vector";
  if (hasOriginal) return "comparison";
  return "plain";
}

// ─── Tests ───────────────────────────────────────────────────────────────────────────────

describe("PortraitCard — display mode selection", () => {
  it("shows side-by-side comparison when original image is available and vector is off", () => {
    expect(getDisplayMode(true, false)).toBe("comparison");
  });

  it("shows vector SVG viewer when showVector is true (even with original)", () => {
    expect(getDisplayMode(true, true)).toBe("vector");
  });

  it("shows plain vector image when no original and vector is off", () => {
    expect(getDisplayMode(false, false)).toBe("plain");
  });

  it("shows vector SVG viewer when showVector is true and no original", () => {
    expect(getDisplayMode(false, true)).toBe("vector");
  });

  it("side-by-side comparison is the default when original is present", () => {
    const defaultShowVector = false;
    const hasOriginal = true;
    expect(getDisplayMode(hasOriginal, defaultShowVector)).toBe("comparison");
  });

  it("plain mode is the fallback when no original and vector is off", () => {
    expect(getDisplayMode(false, false)).toBe("plain");
  });

  it("vector mode takes priority over comparison when both conditions met", () => {
    // showVector=true always wins regardless of hasOriginal
    expect(getDisplayMode(true, true)).toBe("vector");
    expect(getDisplayMode(false, true)).toBe("vector");
  });

  it("comparison mode requires hasOriginal=true AND showVector=false", () => {
    expect(getDisplayMode(true, false)).toBe("comparison");
    expect(getDisplayMode(false, false)).not.toBe("comparison"); // no original
    expect(getDisplayMode(true, true)).not.toBe("comparison");  // vector shown
  });
});

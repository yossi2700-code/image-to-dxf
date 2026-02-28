/**
 * Tests for landscape mode prompt building logic.
 * Verifies that landscape prompts correctly request full-scene drawing
 * while normal prompts focus on single objects.
 */

import { describe, it, expect } from "vitest";

// ── Replicate the prompt-building logic from the routes ──────────────────────

const STYLE_VARIATIONS = [
  {
    label: "simple",
    style:
      "Simple clean outline only. Bold outer contour lines, minimal internal lines. " +
      "Icon/sticker style. NO texture, NO hatching, NO shading, NO fill. " +
      "Only 2-4 main structural lines inside the shape.",
  },
  {
    label: "detailed",
    style:
      "Clean outline with moderate internal details. Bold outer contour plus clear structural " +
      "inner lines showing main features. NO texture, NO hatching, NO shading, NO fill. " +
      "Like a coloring book page — clear distinct lines only.",
  },
  {
    label: "decorative",
    style:
      "Decorative artistic outline style. Bold outer contour with elegant decorative inner lines. " +
      "Art nouveau or mandala-inspired clean line work. NO texture, NO hatching, NO shading, NO fill. " +
      "All lines must be clean, distinct, and suitable for laser cutting.",
  },
];

const LANDSCAPE_STYLE_VARIATIONS = [
  {
    label: "simple",
    style:
      "Simple clean landscape outline. Bold horizon line, clear silhouettes of all elements (buildings, trees, mountains, sky). " +
      "Capture the full panoramic scene — foreground, midground, background. " +
      "NO texture, NO hatching, NO shading, NO fill. Clean minimal lines only.",
  },
  {
    label: "detailed",
    style:
      "Detailed landscape line art. Clear horizon with rich detail in all layers: sky elements (clouds, sun), " +
      "background (mountains, distant buildings), midground (trees, structures), foreground (ground, plants, paths). " +
      "Every visible element drawn with clean distinct lines. NO texture, NO hatching, NO shading, NO fill. " +
      "Like a detailed panoramic illustration or travel sketch.",
  },
  {
    label: "decorative",
    style:
      "Elegant decorative landscape line art. Flowing artistic lines capturing the full scenic view. " +
      "Detailed silhouettes of all scene elements with decorative inner line work. " +
      "NO texture, NO hatching, NO shading, NO fill. " +
      "Like a fine art engraving of a landscape — beautiful and suitable for laser cutting.",
  },
];

function buildLineArtPrompt(subject: string, variationIndex: number): string {
  const variation = STYLE_VARIATIONS[variationIndex % STYLE_VARIATIONS.length];
  return (
    `Clean black and white line art of ${subject}. ` +
    "Pure white background (#FFFFFF). " +
    "Bold thick black outlines (3-5px stroke width), no fill, no shading, no gradients. " +
    "High contrast: only pure black (#000000) lines on white. " +
    `${variation.style} ` +
    "Single centered object, complete, not cropped. " +
    "No text, no watermarks, no grey tones."
  );
}

function buildLandscapePrompt(sceneDescription: string, variationIndex: number): string {
  const variation = LANDSCAPE_STYLE_VARIATIONS[variationIndex % LANDSCAPE_STYLE_VARIATIONS.length];
  return (
    `Clean black and white line art of a landscape scene: ${sceneDescription}. ` +
    "Pure white background (#FFFFFF). " +
    "Bold thick black outlines (3-5px stroke width), no fill, no shading, no gradients. " +
    "High contrast: only pure black (#000000) lines on white. " +
    "IMPORTANT: Draw the ENTIRE scene — all elements visible in the landscape (sky, horizon, buildings, trees, mountains, water, foreground). " +
    "Do NOT focus on a single object — capture the full panoramic view. " +
    `${variation.style} ` +
    "Wide panoramic composition, complete, not cropped. " +
    "No text, no watermarks, no grey tones."
  );
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("buildLineArtPrompt (normal mode)", () => {
  it("includes the subject in the prompt", () => {
    const prompt = buildLineArtPrompt("a dog", 0);
    expect(prompt).toContain("a dog");
  });

  it("requests single centered object", () => {
    const prompt = buildLineArtPrompt("a cat", 0);
    expect(prompt).toContain("Single centered object");
  });

  it("does NOT mention panoramic or landscape", () => {
    const prompt = buildLineArtPrompt("a tree", 0);
    expect(prompt).not.toContain("panoramic");
    expect(prompt).not.toContain("landscape");
  });

  it("uses simple style for index 0", () => {
    const prompt = buildLineArtPrompt("flower", 0);
    expect(prompt).toContain("Icon/sticker style");
  });

  it("uses detailed style for index 1", () => {
    const prompt = buildLineArtPrompt("flower", 1);
    expect(prompt).toContain("coloring book page");
  });

  it("uses decorative style for index 2", () => {
    const prompt = buildLineArtPrompt("flower", 2);
    expect(prompt).toContain("Art nouveau");
  });

  it("wraps around styles for index 3 (same as 0)", () => {
    const p0 = buildLineArtPrompt("flower", 0);
    const p3 = buildLineArtPrompt("flower", 3);
    expect(p0).toEqual(p3);
  });
});

describe("buildLandscapePrompt (landscape mode)", () => {
  it("includes the scene description", () => {
    const prompt = buildLandscapePrompt("Eiffel Tower with park and river", 0);
    expect(prompt).toContain("Eiffel Tower with park and river");
  });

  it("explicitly requests the ENTIRE scene", () => {
    const prompt = buildLandscapePrompt("city skyline", 0);
    expect(prompt).toContain("ENTIRE scene");
  });

  it("mentions sky, horizon, buildings, trees in the prompt", () => {
    const prompt = buildLandscapePrompt("mountain valley", 0);
    expect(prompt).toContain("sky");
    expect(prompt).toContain("horizon");
    expect(prompt).toContain("buildings");
    expect(prompt).toContain("trees");
  });

  it("requests wide panoramic composition", () => {
    const prompt = buildLandscapePrompt("beach sunset", 0);
    expect(prompt).toContain("Wide panoramic composition");
  });

  it("does NOT request single centered object", () => {
    const prompt = buildLandscapePrompt("forest", 0);
    expect(prompt).not.toContain("Single centered object");
  });

  it("instructs NOT to focus on a single object", () => {
    const prompt = buildLandscapePrompt("village", 0);
    expect(prompt).toContain("Do NOT focus on a single object");
  });

  it("uses simple landscape style for index 0", () => {
    const prompt = buildLandscapePrompt("countryside", 0);
    expect(prompt).toContain("Bold horizon line");
  });

  it("uses detailed landscape style for index 1", () => {
    const prompt = buildLandscapePrompt("city", 1);
    expect(prompt).toContain("travel sketch");
  });

  it("uses decorative landscape style for index 2", () => {
    const prompt = buildLandscapePrompt("river", 2);
    expect(prompt).toContain("fine art engraving");
  });

  it("wraps around landscape styles for index 3 (same as 0)", () => {
    const p0 = buildLandscapePrompt("lake", 0);
    const p3 = buildLandscapePrompt("lake", 3);
    expect(p0).toEqual(p3);
  });
});

describe("mode selection logic", () => {
  it("normal mode prompt differs from landscape mode prompt for same subject", () => {
    const normal = buildLineArtPrompt("Eiffel Tower", 0);
    const landscape = buildLandscapePrompt("Eiffel Tower", 0);
    expect(normal).not.toEqual(landscape);
  });

  it("landscape prompt is longer (more detailed instructions)", () => {
    const normal = buildLineArtPrompt("Paris", 0);
    const landscape = buildLandscapePrompt("Paris", 0);
    expect(landscape.length).toBeGreaterThan(normal.length);
  });
});

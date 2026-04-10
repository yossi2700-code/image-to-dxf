import { describe, it, expect } from "vitest";

// ─── Unit tests for Architectural AI Tab logic ────────────────────────────────
// These tests validate the parameter-to-prompt building logic and validation rules
// that mirror what ArchitecturalAiTab.tsx does on the frontend.

// ── Helper: build architectural prompt (mirrors frontend logic) ────────────────
function buildArchitecturalPrompt(params: {
  drawingType: string;
  drawingTypeLabel: string;
  scale: string;
  unit: string;
  unitLabel: string;
  widthVal: string;
  lengthVal: string;
  heightVal?: string;
  isElevationOrSection?: boolean;
  wallThickness?: string;
  wallLabel?: string;
  style: string;
  styleLabel: string;
  prompt?: string;
  modifications?: string;
  isModify?: boolean;
  isRtl?: boolean;
}) {
  const {
    drawingTypeLabel,
    scale,
    unitLabel,
    widthVal,
    lengthVal,
    heightVal,
    isElevationOrSection,
    wallThickness,
    wallLabel,
    styleLabel,
    prompt,
    modifications,
    isModify,
    isRtl,
  } = params;

  let dims = `${widthVal}×${lengthVal} ${unitLabel}`;
  if (isElevationOrSection && heightVal) {
    dims += isRtl
      ? ` × גובה ${heightVal} ${unitLabel}`
      : ` × height ${heightVal} ${unitLabel}`;
  }

  let archPrompt = isRtl
    ? `${drawingTypeLabel} אדריכלי מקצועי, קנה מידה ${scale}, מידות: ${dims}, סגנון: ${styleLabel}`
    : `Professional architectural ${drawingTypeLabel}, scale ${scale}, dimensions: ${dims}, style: ${styleLabel}`;

  if (wallThickness && wallLabel) {
    archPrompt += isRtl ? `, עובי קירות: ${wallLabel}` : `, wall thickness: ${wallLabel}`;
  }

  if (prompt?.trim()) {
    archPrompt += isRtl
      ? `\nפרטים נוספים: ${prompt.trim()}`
      : `\nAdditional details: ${prompt.trim()}`;
  }

  if (isModify && modifications?.trim()) {
    archPrompt += isRtl
      ? `\nשינויים מבוקשים: ${modifications.trim()}`
      : `\nRequested changes: ${modifications.trim()}`;
  }

  return archPrompt;
}

// ── Helper: validation (mirrors frontend isValid()) ───────────────────────────
function isValid(params: {
  drawingType: string;
  scale: string;
  customScale?: string;
  unit: string;
  widthVal: string;
  lengthVal: string;
  heightVal?: string;
  isElevationOrSection?: boolean;
}) {
  const effectiveScale = params.scale === "custom" ? (params.customScale ?? "") : params.scale;
  if (!params.drawingType) return false;
  if (!effectiveScale.trim()) return false;
  if (!params.unit) return false;
  if (!params.widthVal.trim() || isNaN(parseFloat(params.widthVal))) return false;
  if (!params.lengthVal.trim() || isNaN(parseFloat(params.lengthVal))) return false;
  if (params.isElevationOrSection) {
    if (!params.heightVal?.trim() || isNaN(parseFloat(params.heightVal))) return false;
  }
  return true;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("ArchitecturalAiTab — prompt builder", () => {
  it("builds a basic floor plan prompt in English", () => {
    const result = buildArchitecturalPrompt({
      drawingType: "floor_plan",
      drawingTypeLabel: "Floor Plan",
      scale: "1:100",
      unit: "m",
      unitLabel: "m",
      widthVal: "10",
      lengthVal: "8",
      style: "clean",
      styleLabel: "Clean — Lines only",
    });
    expect(result).toContain("Professional architectural Floor Plan");
    expect(result).toContain("scale 1:100");
    expect(result).toContain("10×8 m");
    expect(result).toContain("Clean — Lines only");
  });

  it("includes height for elevation drawing type", () => {
    const result = buildArchitecturalPrompt({
      drawingType: "elevation",
      drawingTypeLabel: "Elevation",
      scale: "1:50",
      unit: "cm",
      unitLabel: "cm",
      widthVal: "500",
      lengthVal: "300",
      heightVal: "280",
      isElevationOrSection: true,
      style: "with_dimensions",
      styleLabel: "With dimensions & symbols",
    });
    expect(result).toContain("500×300 cm");
    expect(result).toContain("height 280 cm");
  });

  it("appends wall thickness when provided", () => {
    const result = buildArchitecturalPrompt({
      drawingType: "floor_plan",
      drawingTypeLabel: "Floor Plan",
      scale: "1:100",
      unit: "m",
      unitLabel: "m",
      widthVal: "12",
      lengthVal: "9",
      style: "clean",
      styleLabel: "Clean",
      wallThickness: "standard",
      wallLabel: "Standard — 20 cm (Exterior wall)",
    });
    expect(result).toContain("wall thickness: Standard — 20 cm");
  });

  it("appends additional description when provided", () => {
    const result = buildArchitecturalPrompt({
      drawingType: "floor_plan",
      drawingTypeLabel: "Floor Plan",
      scale: "1:100",
      unit: "m",
      unitLabel: "m",
      widthVal: "10",
      lengthVal: "8",
      style: "clean",
      styleLabel: "Clean",
      prompt: "3 bedrooms, open kitchen",
    });
    expect(result).toContain("Additional details: 3 bedrooms, open kitchen");
  });

  it("appends modifications in modify mode", () => {
    const result = buildArchitecturalPrompt({
      drawingType: "floor_plan",
      drawingTypeLabel: "Floor Plan",
      scale: "1:100",
      unit: "m",
      unitLabel: "m",
      widthVal: "10",
      lengthVal: "8",
      style: "clean",
      styleLabel: "Clean",
      modifications: "Add balcony on north side",
      isModify: true,
    });
    expect(result).toContain("Requested changes: Add balcony on north side");
  });

  it("builds Hebrew prompt correctly", () => {
    const result = buildArchitecturalPrompt({
      drawingType: "floor_plan",
      drawingTypeLabel: "תוכנית קומה",
      scale: "1:100",
      unit: "m",
      unitLabel: "מטר",
      widthVal: "10",
      lengthVal: "8",
      style: "clean",
      styleLabel: "נקי — קווים בלבד",
      isRtl: true,
    });
    expect(result).toContain("תוכנית קומה אדריכלי מקצועי");
    expect(result).toContain("קנה מידה 1:100");
    expect(result).toContain("10×8 מטר");
  });
});

describe("ArchitecturalAiTab — validation", () => {
  it("returns false when drawing type is missing", () => {
    expect(isValid({ drawingType: "", scale: "1:100", unit: "m", widthVal: "10", lengthVal: "8" })).toBe(false);
  });

  it("returns false when width is missing", () => {
    expect(isValid({ drawingType: "floor_plan", scale: "1:100", unit: "m", widthVal: "", lengthVal: "8" })).toBe(false);
  });

  it("returns false when width is not a number", () => {
    expect(isValid({ drawingType: "floor_plan", scale: "1:100", unit: "m", widthVal: "abc", lengthVal: "8" })).toBe(false);
  });

  it("returns false when elevation is missing height", () => {
    expect(isValid({
      drawingType: "elevation",
      scale: "1:50",
      unit: "m",
      widthVal: "10",
      lengthVal: "8",
      isElevationOrSection: true,
      heightVal: "",
    })).toBe(false);
  });

  it("returns true for valid floor plan params", () => {
    expect(isValid({ drawingType: "floor_plan", scale: "1:100", unit: "m", widthVal: "10", lengthVal: "8" })).toBe(true);
  });

  it("returns true for valid elevation with height", () => {
    expect(isValid({
      drawingType: "elevation",
      scale: "1:50",
      unit: "m",
      widthVal: "10",
      lengthVal: "8",
      isElevationOrSection: true,
      heightVal: "3",
    })).toBe(true);
  });

  it("returns false for custom scale with empty value", () => {
    expect(isValid({
      drawingType: "floor_plan",
      scale: "custom",
      customScale: "",
      unit: "m",
      widthVal: "10",
      lengthVal: "8",
    })).toBe(false);
  });

  it("returns true for custom scale with valid value", () => {
    expect(isValid({
      drawingType: "floor_plan",
      scale: "custom",
      customScale: "1:75",
      unit: "m",
      widthVal: "10",
      lengthVal: "8",
    })).toBe(true);
  });
});

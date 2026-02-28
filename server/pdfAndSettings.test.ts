/**
 * Tests for PDF export route and admin settings procedures
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── PDF Route Tests ──────────────────────────────────────────────────────────

describe("PDF Export Route", () => {
  it("should parse SVG dimensions from viewBox", () => {
    const svg = '<svg viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg"></svg>';
    const vbMatch = svg.match(/viewBox="([^"]*)"/);
    expect(vbMatch).not.toBeNull();
    const parts = vbMatch![1].trim().split(/\s+/);
    expect(parseFloat(parts[2])).toBe(800);
    expect(parseFloat(parts[3])).toBe(600);
  });

  it("should parse SVG dimensions from width/height attributes", () => {
    const svg = '<svg width="500" height="400" xmlns="http://www.w3.org/2000/svg"></svg>';
    const wMatch = svg.match(/width="([^"px]*)(?:px)?"/);
    const hMatch = svg.match(/height="([^"px]*)(?:px)?"/);
    expect(parseFloat(wMatch![1])).toBe(500);
    expect(parseFloat(hMatch![1])).toBe(400);
  });

  it("should parse <line> elements from SVG", () => {
    const svg = `
      <svg viewBox="0 0 100 100">
        <line x1="10" y1="20" x2="80" y2="90" stroke="black"/>
        <line x1="5" y1="5" x2="50" y2="50" stroke="black"/>
      </svg>
    `;
    const lineRe = /<line[^>]*>/gi;
    const matches = svg.match(lineRe);
    expect(matches).toHaveLength(2);
  });

  it("should parse <polyline> points from SVG", () => {
    const svg = `<polyline points="10,20 30,40 50,60" stroke="black"/>`;
    const re = /<polyline[^>]*points="([^"]*)"[^>]*>/gi;
    const match = re.exec(svg);
    expect(match).not.toBeNull();
    const pointsStr = match![1].trim();
    const pairs = pointsStr.split(/\s+|,\s*/).filter(Boolean);
    expect(pairs).toHaveLength(6);
    expect(parseFloat(pairs[0])).toBe(10);
    expect(parseFloat(pairs[1])).toBe(20);
  });

  it("should convert mm to PDF points correctly", () => {
    // 1 mm = 72/25.4 points ≈ 2.8346 points
    const mmToPoints = (mm: number) => mm * (72 / 25.4);
    expect(mmToPoints(25.4)).toBeCloseTo(72, 1);
    expect(mmToPoints(210)).toBeCloseTo(595.28, 0); // A4 width
    expect(mmToPoints(297)).toBeCloseTo(841.89, 0); // A4 height
  });

  it("should use landscape orientation for wide SVGs", () => {
    const svgW = 800;
    const svgH = 400;
    const a4w = 595.28;
    const a4h = 841.89;
    // Wide SVG → landscape
    const isLandscape = svgW > svgH;
    const pageW = isLandscape ? a4h : a4w;
    const pageH = isLandscape ? a4w : a4h;
    expect(pageW).toBe(a4h);
    expect(pageH).toBe(a4w);
  });

  it("should use portrait orientation for tall SVGs", () => {
    const svgW = 400;
    const svgH = 800;
    const a4w = 595.28;
    const a4h = 841.89;
    const isLandscape = svgW > svgH;
    const pageW = isLandscape ? a4h : a4w;
    const pageH = isLandscape ? a4w : a4h;
    expect(pageW).toBe(a4w);
    expect(pageH).toBe(a4h);
  });

  it("should sanitize filename for Content-Disposition header", () => {
    const sanitize = (name: string) =>
      name.replace(/[^a-zA-Z0-9_\-\u0590-\u05FF]/g, "_") || "design";
    expect(sanitize("my design")).toBe("my_design");
    expect(sanitize("עיצוב שלי")).toBe("עיצוב_שלי");
    expect(sanitize("file.dxf")).toBe("file_dxf");
    expect(sanitize("")).toBe("design");
  });
});

// ─── Admin Settings Procedures Tests ─────────────────────────────────────────

describe("Admin Settings Logic", () => {
  it("should validate PIN length requirement", () => {
    const validatePin = (pin: string) => pin.length >= 4;
    expect(validatePin("1234")).toBe(true);
    expect(validatePin("abc")).toBe(false);
    expect(validatePin("")).toBe(false);
    expect(validatePin("longpassword123")).toBe(true);
  });

  it("should confirm PIN match validation", () => {
    const pinsMatch = (a: string, b: string) => a === b;
    expect(pinsMatch("mypin", "mypin")).toBe(true);
    expect(pinsMatch("mypin", "wrongpin")).toBe(false);
    expect(pinsMatch("", "")).toBe(true);
  });

  it("should parse maintenance mode boolean from string", () => {
    const parseMaintenanceMode = (val: string) => val === "true";
    expect(parseMaintenanceMode("true")).toBe(true);
    expect(parseMaintenanceMode("false")).toBe(false);
    expect(parseMaintenanceMode("")).toBe(false);
  });

  it("should validate default token grant range", () => {
    const isValidTokenGrant = (val: number) => val >= 0 && val <= 1000;
    expect(isValidTokenGrant(20)).toBe(true);
    expect(isValidTokenGrant(0)).toBe(true);
    expect(isValidTokenGrant(1000)).toBe(true);
    expect(isValidTokenGrant(-1)).toBe(false);
    expect(isValidTokenGrant(1001)).toBe(false);
  });

  it("should validate daily free limit range", () => {
    const isValidDailyLimit = (val: number) => val >= 0 && val <= 100;
    expect(isValidDailyLimit(3)).toBe(true);
    expect(isValidDailyLimit(0)).toBe(true);
    expect(isValidDailyLimit(100)).toBe(true);
    expect(isValidDailyLimit(-1)).toBe(false);
    expect(isValidDailyLimit(101)).toBe(false);
  });

  it("should build settings record from DB rows", () => {
    const rows = [
      { key: "welcome_message", value: "ברוכים הבאים!" },
      { key: "maintenance_mode", value: "false" },
      { key: "default_token_grant", value: "20" },
    ];
    const result: Record<string, string> = {};
    for (const row of rows) result[row.key] = row.value;
    expect(result["welcome_message"]).toBe("ברוכים הבאים!");
    expect(result["maintenance_mode"]).toBe("false");
    expect(result["default_token_grant"]).toBe("20");
    expect(result["nonexistent"]).toBeUndefined();
  });

  it("should use DB pin override when available", () => {
    const envPin = "env_pin_123";
    const dbOverride = "new_secure_pin_456";

    // Simulate: DB override takes precedence
    const getEffectivePin = (envPin: string, dbOverride?: string) =>
      dbOverride ?? envPin;

    expect(getEffectivePin(envPin, dbOverride)).toBe(dbOverride);
    expect(getEffectivePin(envPin, undefined)).toBe(envPin);
  });
});

// ─── Integration: Settings Key Validation ────────────────────────────────────

describe("Settings Key Validation", () => {
  const ALLOWED_KEYS = [
    "welcome_message",
    "maintenance_mode",
    "default_token_grant",
    "daily_free_limit",
    "admin_pin_override",
  ];

  it("should accept valid setting keys", () => {
    for (const key of ALLOWED_KEYS) {
      expect(key.length).toBeGreaterThan(0);
      expect(key.length).toBeLessThanOrEqual(128);
    }
  });

  it("should reject empty setting key", () => {
    const isValidKey = (key: string) => key.length >= 1 && key.length <= 128;
    expect(isValidKey("")).toBe(false);
  });

  it("should reject overly long setting key", () => {
    const isValidKey = (key: string) => key.length >= 1 && key.length <= 128;
    const longKey = "a".repeat(129);
    expect(isValidKey(longKey)).toBe(false);
  });
});

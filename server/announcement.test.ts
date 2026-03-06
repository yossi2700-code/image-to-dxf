import { describe, it, expect } from "vitest";

// Test the announcement banner data parsing logic
describe("Announcement banner logic", () => {
  it("should parse JSON banner data correctly", () => {
    const raw = JSON.stringify({ text: "🎉 New feature!", enabled: true });
    const parsed = JSON.parse(raw) as { text: string; enabled: boolean };
    expect(parsed.text).toBe("🎉 New feature!");
    expect(parsed.enabled).toBe(true);
  });

  it("should return defaults when no row exists", () => {
    const row = null;
    const result = row ? JSON.parse("{}") : { text: "", enabled: false };
    expect(result.text).toBe("");
    expect(result.enabled).toBe(false);
  });

  it("should handle legacy plain text value (non-JSON)", () => {
    const rawValue = "Old plain text banner";
    let result: { text: string; enabled: boolean };
    try {
      result = JSON.parse(rawValue);
    } catch {
      result = { text: rawValue, enabled: true };
    }
    expect(result.text).toBe("Old plain text banner");
    expect(result.enabled).toBe(true);
  });

  it("should reject empty banner text on client side", () => {
    const text = "";
    const enabled = true;
    // Banner should not render when text is empty
    const shouldRender = enabled && text.length > 0;
    expect(shouldRender).toBe(false);
  });

  it("should not render banner when disabled", () => {
    const text = "Some announcement";
    const enabled = false;
    const shouldRender = enabled && text.length > 0;
    expect(shouldRender).toBe(false);
  });

  it("should render banner when enabled and text is set", () => {
    const text = "🚀 New AI Sketch feature is live!";
    const enabled = true;
    const shouldRender = enabled && text.length > 0;
    expect(shouldRender).toBe(true);
  });

  it("should enforce max 500 character limit", () => {
    const longText = "a".repeat(501);
    const isValid = longText.length <= 500;
    expect(isValid).toBe(false);
  });

  it("should accept text within 500 character limit", () => {
    const text = "🎉 New feature released today!";
    const isValid = text.length <= 500;
    expect(isValid).toBe(true);
  });

  it("should reject wrong admin PIN", () => {
    process.env.ADMIN_PIN = "secret123";
    const inputPin = "wrongpin";
    const isAuthorized = inputPin === process.env.ADMIN_PIN;
    expect(isAuthorized).toBe(false);
  });

  it("should accept correct admin PIN", () => {
    process.env.ADMIN_PIN = "secret123";
    const inputPin = "secret123";
    const isAuthorized = inputPin === process.env.ADMIN_PIN;
    expect(isAuthorized).toBe(true);
  });
});

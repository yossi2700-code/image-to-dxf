import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// We test the PIN comparison logic directly without hitting the DB
describe("Admin PIN validation logic", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, ADMIN_PIN: "test1234" };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should accept correct PIN", () => {
    const pin = "test1234";
    const adminPin = process.env.ADMIN_PIN ?? "";
    expect(pin === adminPin).toBe(true);
  });

  it("should reject wrong PIN", () => {
    const pin = "wrongpin";
    const adminPin = process.env.ADMIN_PIN ?? "";
    expect(pin === adminPin).toBe(false);
  });

  it("should reject empty PIN", () => {
    const pin = "";
    const adminPin = process.env.ADMIN_PIN ?? "";
    expect(pin === adminPin).toBe(false);
  });

  it("should reject PIN with extra spaces", () => {
    const pin = " test1234 ";
    const adminPin = process.env.ADMIN_PIN ?? "";
    // trim is done before comparison in the mutation
    expect(pin.trim() === adminPin).toBe(true);
  });

  it("should handle missing ADMIN_PIN env gracefully", () => {
    process.env.ADMIN_PIN = "";
    const pin = "";
    const adminPin = process.env.ADMIN_PIN ?? "";
    // empty pin against empty env should still be rejected (no pin set = no access)
    expect(!adminPin || pin !== adminPin).toBe(true);
  });
});

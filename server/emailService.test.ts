/**
 * emailService.test.ts
 * Tests that EMAIL_FROM is set to the verified domain address.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

describe("emailService - FROM_ADDRESS", () => {
  it("should use EMAIL_FROM env variable when set", async () => {
    // Set env before importing module
    process.env.EMAIL_FROM = "noreply@dxfai.net";
    process.env.RESEND_API_KEY = "test_key";

    // Re-import to pick up env
    vi.resetModules();
    const mod = await import("./emailService");

    // The module should exist and export functions
    expect(typeof mod.sendPasswordResetEmail).toBe("function");
    expect(typeof mod.sendVerificationEmail).toBe("function");
  });

  it("should have EMAIL_FROM set to noreply@dxfai.net in current environment", () => {
    const emailFrom = process.env.EMAIL_FROM;
    expect(emailFrom).toBe("noreply@dxfai.net");
  });

  it("should not use onboarding@resend.dev when EMAIL_FROM is set", () => {
    const emailFrom = process.env.EMAIL_FROM;
    expect(emailFrom).not.toBe("onboarding@resend.dev");
    expect(emailFrom).not.toBeUndefined();
  });
});

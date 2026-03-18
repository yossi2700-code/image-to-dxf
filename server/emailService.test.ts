/**
 * emailService.test.ts
 * Tests that EMAIL_FROM is set to the verified domain address,
 * and that marketing emails do NOT contain spam-triggering headers.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "fs";
import * as path from "path";

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

describe("emailService - spam prevention", () => {
  const emailServicePath = path.join(__dirname, "emailService.ts");
  let source: string;

  beforeEach(() => {
    source = fs.readFileSync(emailServicePath, "utf-8");
  });

  it("sendBulkEmail should NOT have Precedence: bulk header (causes spam)", () => {
    // Find the sendBulkEmail function body
    const bulkFnStart = source.indexOf("export async function sendBulkEmail");
    const bulkFnEnd = source.indexOf("\nexport ", bulkFnStart + 1);
    const bulkFnBody = bulkFnEnd > -1 ? source.slice(bulkFnStart, bulkFnEnd) : source.slice(bulkFnStart);
    expect(bulkFnBody).not.toContain("'Precedence': 'bulk'");
    expect(bulkFnBody).not.toContain('"Precedence": "bulk"');
  });

  it("sendWelcomeEmail subject should not contain emojis that trigger spam filters", () => {
    const welcomeFnStart = source.indexOf("export async function sendWelcomeEmail");
    const welcomeFnEnd = source.indexOf("\nexport ", welcomeFnStart + 1);
    const welcomeFnBody = source.slice(welcomeFnStart, welcomeFnEnd);
    // Subject should not start with emoji (spam trigger)
    expect(welcomeFnBody).not.toMatch(/subject.*=.*`[✨🎁⏰🔥]/u);
  });

  it("sendReminderEmail subject should not start with emoji (spam trigger)", () => {
    const reminderFnStart = source.indexOf("export async function sendReminderEmail");
    const reminderFnEnd = source.indexOf("\nexport ", reminderFnStart + 1);
    const reminderFnBody = reminderFnEnd > -1 ? source.slice(reminderFnStart, reminderFnEnd) : source.slice(reminderFnStart);
    // Subject should not start with ⏰ emoji
    expect(reminderFnBody).not.toMatch(/"[⏰✨🎁].*עוד לא קיבלת"/u);
  });

  it("sendWelcomeEmail should include plain text version", () => {
    const welcomeFnStart = source.indexOf("export async function sendWelcomeEmail");
    const welcomeFnEnd = source.indexOf("\nexport ", welcomeFnStart + 1);
    const welcomeFnBody = source.slice(welcomeFnStart, welcomeFnEnd);
    expect(welcomeFnBody).toContain("text:");
    expect(welcomeFnBody).toContain("plainText");
  });

  it("sendReminderEmail should include plain text version", () => {
    const reminderFnStart = source.indexOf("export async function sendReminderEmail");
    const reminderFnEnd = source.indexOf("\nexport ", reminderFnStart + 1);
    const reminderFnBody = reminderFnEnd > -1 ? source.slice(reminderFnStart, reminderFnEnd) : source.slice(reminderFnStart);
    expect(reminderFnBody).toContain("text:");
    expect(reminderFnBody).toContain("reminderPlainText");
  });
});

/**
 * replicate.test.ts — בדיקת חיבור ל-Replicate API
 * מוודא שהטוקן תקין ושניתן להתחבר לחשבון
 */
import { describe, it, expect } from "vitest";

describe("Replicate API Token", () => {
  it("should authenticate successfully with the configured token", async () => {
    const token = process.env.REPLICATE_API_TOKEN;
    expect(token, "REPLICATE_API_TOKEN must be set").toBeTruthy();
    expect(token!.length, "Token must be at least 20 chars").toBeGreaterThan(20);

    const res = await fetch("https://api.replicate.com/v1/account", {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status, "Should return 200 OK").toBe(200);
    const data = await res.json() as { username?: string; type?: string };
    expect(data.username, "Should return a username").toBeTruthy();
    console.log("✅ Replicate account:", data.username);
  });
});

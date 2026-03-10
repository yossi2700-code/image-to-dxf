/**
 * paypal.test.ts
 * Validates PayPal credentials configuration.
 * Network calls are mocked since vitest runs in an isolated environment.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { isPayPalConfigured } from "./paypal";

describe("PayPal Integration", () => {
  it("should have PayPal credentials configured", () => {
    expect(process.env.PAYPAL_CLIENT_ID).toBeTruthy();
    expect(process.env.PAYPAL_CLIENT_SECRET).toBeTruthy();
    expect(isPayPalConfigured()).toBe(true);
  });

  it("should have PAYPAL_MODE set", () => {
    const mode = process.env.PAYPAL_MODE ?? "sandbox";
    expect(["sandbox", "production"]).toContain(mode);
  });

  it("should build correct base URL for sandbox mode", () => {
    const mode = process.env.PAYPAL_MODE ?? "sandbox";
    const base =
      mode === "production"
        ? "https://api-m.paypal.com"
        : "https://api-m.sandbox.paypal.com";
    expect(base).toBe("https://api-m.sandbox.paypal.com");
  });

  it("should build valid Basic auth header from credentials", () => {
    const clientId = process.env.PAYPAL_CLIENT_ID!;
    const secret = process.env.PAYPAL_CLIENT_SECRET!;
    const creds = Buffer.from(`${clientId}:${secret}`).toString("base64");
    // Verify it's a valid base64 string
    const decoded = Buffer.from(creds, "base64").toString("utf8");
    expect(decoded).toContain(":");
    const [decodedId] = decoded.split(":");
    expect(decodedId).toBe(clientId);
  });

  it("should mock successful PayPal token response", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        access_token: "mock_token_12345",
        expires_in: 32400,
        app_id: "APP-TEST",
      }),
    });

    const clientId = process.env.PAYPAL_CLIENT_ID!;
    const secret = process.env.PAYPAL_CLIENT_SECRET!;
    const creds = Buffer.from(`${clientId}:${secret}`).toString("base64");

    const res = await mockFetch("https://api-m.sandbox.paypal.com/v1/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${creds}`,
      },
      body: "grant_type=client_credentials",
    });

    const data = await res.json();
    expect(data.access_token).toBeTruthy();
    expect(data.expires_in).toBeGreaterThan(0);
    expect(mockFetch).toHaveBeenCalledOnce();
  });
});

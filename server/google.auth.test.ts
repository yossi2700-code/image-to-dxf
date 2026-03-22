import { describe, it, expect } from "vitest";

describe("Google OAuth route", () => {
  it("should reject requests without a credential", async () => {
    const res = await fetch("http://localhost:3000/api/app-auth/google", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data).toHaveProperty("error");
  });

  it("should reject requests with an invalid credential", async () => {
    const res = await fetch("http://localhost:3000/api/app-auth/google", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credential: "invalid_token" }),
    });
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data).toHaveProperty("error");
  });
});

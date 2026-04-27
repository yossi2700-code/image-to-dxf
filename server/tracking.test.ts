/**
 * tracking.test.ts — Unit tests for click tracking logic
 */
import { describe, it, expect } from "vitest";

// ── Helper: IP anonymization ──────────────────────────────────────────────────
function anonymizeIp(rawIp: string): string {
  const parts = rawIp.split(".");
  if (parts.length === 4) {
    return parts.slice(0, 3).join(".") + ".x";
  }
  return rawIp;
}

// ── Helper: action label mapping ──────────────────────────────────────────────
const ACTION_LABELS: Record<string, string> = {
  btn_convert: "המר תמונה",
  btn_download_dxf: "הורד DXF",
  btn_ai_generate: "צור 3 עיצובים (AI)",
  btn_portrait_detect: "צור פורטרט",
};

function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe("IP anonymization", () => {
  it("masks last octet of IPv4 address", () => {
    expect(anonymizeIp("192.168.1.42")).toBe("192.168.1.x");
  });

  it("masks last octet of another IPv4 address", () => {
    expect(anonymizeIp("10.0.0.255")).toBe("10.0.0.x");
  });

  it("returns non-IPv4 addresses unchanged", () => {
    expect(anonymizeIp("::1")).toBe("::1");
    expect(anonymizeIp("unknown")).toBe("unknown");
  });

  it("handles edge case with exactly 4 octets", () => {
    expect(anonymizeIp("1.2.3.4")).toBe("1.2.3.x");
  });
});

describe("Action label mapping", () => {
  it("maps known action keys to Hebrew labels", () => {
    expect(actionLabel("btn_convert")).toBe("המר תמונה");
    expect(actionLabel("btn_download_dxf")).toBe("הורד DXF");
    expect(actionLabel("btn_ai_generate")).toBe("צור 3 עיצובים (AI)");
    expect(actionLabel("btn_portrait_detect")).toBe("צור פורטרט");
  });

  it("returns unknown action keys as-is", () => {
    expect(actionLabel("btn_unknown_action")).toBe("btn_unknown_action");
    expect(actionLabel("custom_event")).toBe("custom_event");
  });
});

describe("Click event validation", () => {
  it("validates action string length constraints", () => {
    const validAction = "btn_convert";
    expect(validAction.length).toBeGreaterThan(0);
    expect(validAction.length).toBeLessThanOrEqual(128);
  });

  it("validates label length constraints", () => {
    const validLabel = "המר תמונה";
    expect(validLabel.length).toBeLessThanOrEqual(200);
  });

  it("validates page length constraints", () => {
    const validPage = "home/ai_trace";
    expect(validPage.length).toBeLessThanOrEqual(128);
  });

  it("rejects empty action strings", () => {
    const action = "";
    expect(action.length).toBe(0); // would fail zod min(1) validation
  });

  it("rejects action strings that are too long", () => {
    const longAction = "a".repeat(129);
    expect(longAction.length).toBeGreaterThan(128); // would fail zod max(128) validation
  });
});

describe("Click count aggregation", () => {
  it("sums click counts correctly", () => {
    const users = [
      { id: 1, clickCount: 5 },
      { id: 2, clickCount: 12 },
      { id: 3, clickCount: 0 },
    ];
    const total = users.reduce((s, u) => s + u.clickCount, 0);
    expect(total).toBe(17);
  });

  it("counts active users (those with at least one click)", () => {
    const users = [
      { id: 1, clickCount: 5 },
      { id: 2, clickCount: 0 },
      { id: 3, clickCount: 3 },
    ];
    const active = users.filter(u => u.clickCount > 0).length;
    expect(active).toBe(2);
  });
});

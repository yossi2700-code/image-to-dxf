/**
 * Tests for "deduct tokens only after success" behavior.
 * Verifies that deductTokens is called with checkOnly=true before processing,
 * and the actual deduction happens only after successful completion.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import cookieParser from "cookie-parser";

// ─── Shared mocks ─────────────────────────────────────────────────────────────

vi.mock("./appAuth", () => ({
  getAppUserFromCookie: vi.fn(),
}));

vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue(null), // null = skip block check
}));

vi.mock("./tokenService", () => ({
  deductTokens: vi.fn().mockResolvedValue({ success: true, balanceAfter: 15 }),
  addTokens: vi.fn().mockResolvedValue(20),
  TOKEN_COSTS: { ai_generate: 3, ai_refine: 2, ai_trace: 5, face_detect: 4, convert: 0 },
}));

vi.mock("./usageDb", () => ({
  logUsageEvent: vi.fn().mockResolvedValue(undefined),
  anonymizeIp: vi.fn().mockReturnValue("1.2.3.x"),
}));

vi.mock("./userActionsDb", () => ({
  recordUserAction: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./storage", () => ({
  storagePut: vi.fn().mockResolvedValue({ url: "https://s3.example.com/test.png", key: "test.png" }),
}));

vi.mock("./jobStore", () => ({
  createJob: vi.fn(),
  getJob: vi.fn().mockReturnValue({ status: "pending", userId: 1 }),
  updateJob: vi.fn(),
  cancelJob: vi.fn().mockReturnValue(true),
  heartbeatJob: vi.fn(),
}));

vi.mock("sharp", () => {
  const sharpMock = vi.fn().mockReturnValue({
    extend: vi.fn().mockReturnThis(),
    resize: vi.fn().mockReturnThis(),
    grayscale: vi.fn().mockReturnThis(),
    blur: vi.fn().mockReturnThis(),
    threshold: vi.fn().mockReturnThis(),
    png: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue(Buffer.from("fake-image")),
    metadata: vi.fn().mockResolvedValue({ width: 100, height: 100 }),
  });
  return { default: sharpMock };
});

vi.mock("potrace", () => ({
  default: {
    trace: vi.fn((buf: Buffer, opts: unknown, cb: (err: null, svg: string) => void) => {
      cb(null, '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><path d="M0 0L100 100"/></svg>');
    }),
  },
}));

vi.mock("./svgToDxf", () => ({
  svgToDxf: vi.fn().mockReturnValue({
    dxf: "DXF_CONTENT",
    segmentCount: 5,
    width: 100,
    height: 100,
    realWidth: 100,
    realHeight: 100,
  }),
}));

vi.mock("./svgClean", () => ({
  cleanSvgForPreview: vi.fn().mockReturnValue('<svg><path d="M0 0"/></svg>'),
}));

vi.mock("./_core/notification", () => ({
  notifyOwner: vi.fn().mockResolvedValue(true),
}));

vi.mock("openai", () => ({
  default: vi.fn().mockImplementation(() => ({
    images: {
      generate: vi.fn().mockResolvedValue({
        data: [{ b64_json: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" }],
      }),
      edit: vi.fn().mockResolvedValue({
        data: [{ b64_json: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" }],
      }),
    },
  })),
}));

import { getAppUserFromCookie } from "./appAuth";
import { deductTokens } from "./tokenService";

// ─── generateRoute tests ──────────────────────────────────────────────────────

describe("generateRoute — deduct after success", () => {
  let app: express.Express;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.mocked(getAppUserFromCookie).mockReturnValue({ userId: 1, username: "testuser" });
    vi.mocked(deductTokens).mockResolvedValue({ success: true, balanceAfter: 15 });

    const generateRoute = (await import("./generateRoute")).default;
    app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use(generateRoute);
  });

  it("returns 402 when checkOnly balance check fails — no job started", async () => {
    vi.mocked(deductTokens).mockResolvedValue({ success: false, balance: 0 });

    const res = await request(app)
      .post("/api/generate-images")
      .send({ prompt: "a cat" });

    expect(res.status).toBe(402);
    expect(res.body.error).toBe("INSUFFICIENT_TOKENS");

    // deductTokens should have been called with checkOnly=true
    expect(deductTokens).toHaveBeenCalledWith(1, "ai_generate", { checkOnly: true });
  });

  it("uses checkOnly=true for the pre-flight balance check", async () => {
    const res = await request(app)
      .post("/api/generate-images")
      .send({ prompt: "a cat" });

    // Should return jobId (job started)
    expect(res.status).toBe(200);
    expect(res.body.jobId).toBeDefined();

    // The initial call must be checkOnly — actual deduction happens in background job
    const firstCall = vi.mocked(deductTokens).mock.calls[0];
    expect(firstCall[2]).toEqual({ checkOnly: true });
  });

  it("does not deduct tokens when prompt is missing", async () => {
    const res = await request(app)
      .post("/api/generate-images")
      .send({ prompt: "" });

    expect(res.status).toBe(400);
    expect(deductTokens).not.toHaveBeenCalled();
  });

  it("does not deduct tokens when user is not authenticated", async () => {
    vi.mocked(getAppUserFromCookie).mockReturnValue(null);

    const res = await request(app)
      .post("/api/generate-images")
      .send({ prompt: "a cat" });

    expect(res.status).toBe(401);
    expect(deductTokens).not.toHaveBeenCalled();
  });
});

// ─── aiRefineRoute tests ──────────────────────────────────────────────────────

describe("aiRefineRoute — deduct after success", () => {
  let app: express.Express;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.mocked(getAppUserFromCookie).mockReturnValue({ userId: 1, username: "testuser" });
    vi.mocked(deductTokens).mockResolvedValue({ success: true, balanceAfter: 15 });

    // Mock fetch for image download
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
    } as unknown as Response);

    const aiRefineRoute = (await import("./aiRefineRoute")).default;
    app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use(aiRefineRoute);
  });

  it("returns 402 when checkOnly balance check fails — no AI call made", async () => {
    vi.mocked(deductTokens).mockResolvedValue({ success: false, balance: 1 });

    const res = await request(app)
      .post("/api/ai-refine")
      .send({ imageUrl: "https://example.com/img.png", instruction: "make it thinner" });

    expect(res.status).toBe(402);
    expect(res.body.error).toBe("INSUFFICIENT_TOKENS");

    // Only one call — the checkOnly pre-flight
    expect(deductTokens).toHaveBeenCalledTimes(1);
    expect(deductTokens).toHaveBeenCalledWith(1, "ai_refine", { checkOnly: true });
  });

  it("uses checkOnly=true for the pre-flight balance check", async () => {
    const res = await request(app)
      .post("/api/ai-refine")
      .send({ imageUrl: "https://example.com/img.png", instruction: "make it thinner" });

    // Should succeed
    expect(res.status).toBe(200);

    // First call must be checkOnly
    const firstCall = vi.mocked(deductTokens).mock.calls[0];
    expect(firstCall[2]).toEqual({ checkOnly: true });

    // Second call is the actual deduction (after success)
    expect(deductTokens).toHaveBeenCalledTimes(2);
    const secondCall = vi.mocked(deductTokens).mock.calls[1];
    expect(secondCall[0]).toBe(1);
    expect(secondCall[1]).toBe("ai_refine");
    // Second call should NOT be checkOnly
    expect(secondCall[2]).not.toEqual({ checkOnly: true });
  });

  it("does not deduct tokens when user is not authenticated", async () => {
    vi.mocked(getAppUserFromCookie).mockReturnValue(null);

    const res = await request(app)
      .post("/api/ai-refine")
      .send({ imageUrl: "https://example.com/img.png", instruction: "make it thinner" });

    expect(res.status).toBe(401);
    expect(deductTokens).not.toHaveBeenCalled();
  });

  it("does not deduct tokens when instruction is too short", async () => {
    const res = await request(app)
      .post("/api/ai-refine")
      .send({ imageUrl: "https://example.com/img.png", instruction: "ab" });

    expect(res.status).toBe(400);
    expect(deductTokens).not.toHaveBeenCalled();
  });
});

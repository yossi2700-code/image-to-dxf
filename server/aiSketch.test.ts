/**
 * Tests for AI Sketch route
 * Tests the /api/ai-sketch endpoint
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import cookieParser from "cookie-parser";

// Mock dependencies before importing the route
vi.mock("sharp", () => ({
  default: vi.fn().mockReturnValue({
    rotate: vi.fn().mockReturnThis(),
    resize: vi.fn().mockReturnThis(),
    jpeg: vi.fn().mockReturnThis(),
    grayscale: vi.fn().mockReturnThis(),
    threshold: vi.fn().mockReturnThis(),
    png: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue(Buffer.from("fake-image-data")),
    metadata: vi.fn().mockResolvedValue({ width: 100, height: 100 }),
  }),
}));

vi.mock("./appAuth", () => ({
  getAppUserFromCookie: vi.fn(),
}));

vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue(null),
}));

vi.mock("./tokenService", () => ({
  deductTokens: vi.fn().mockResolvedValue({ success: true, balanceAfter: 15 }),
  addTokens: vi.fn().mockResolvedValue(undefined),
  TOKEN_COSTS: { ai_trace: 5, ai_generate: 5 },
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

vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{ message: { content: "A clean outline of a bicycle with two wheels." } }],
  }),
}));

vi.mock("openai", () => {
  return {
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
  };
});

vi.mock("potrace", () => ({
  default: {
    trace: vi.fn().mockImplementation((_buf: Buffer, _opts: object, cb: (err: null, svg: string) => void) => {
      cb(null, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M0 0 L100 100" fill="black"/></svg>');
    }),
  },
}));

vi.mock("./svgToDxf", () => ({
  svgToDxf: vi.fn().mockReturnValue({
    dxf: "0\nSECTION\n2\nENTITIES\n0\nENDSEC\n0\nEOF",
    segmentCount: 10,
    width: 512,
    height: 512,
    realWidth: 512,
    realHeight: 512,
  }),
}));

vi.mock("nanoid", () => ({
  nanoid: vi.fn().mockReturnValue("test-sketch-id"),
}));

vi.mock("./failedJobsDb", () => ({
  recordFailedJob: vi.fn().mockResolvedValue(undefined),
}));

import { getAppUserFromCookie } from "./appAuth";
import { deductTokens } from "./tokenService";
import aiSketchRoute from "./aiSketchRoute";

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(aiSketchRoute);

describe("POST /api/ai-sketch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAppUserFromCookie).mockReturnValue({ userId: 1, username: "testuser" });
    vi.mocked(deductTokens).mockResolvedValue({ success: true, balanceAfter: 15 });
  });

  it("returns 401 when user is not authenticated", async () => {
    vi.mocked(getAppUserFromCookie).mockReturnValue(null);

    const res = await request(app)
      .post("/api/ai-sketch")
      .attach("image", Buffer.from("fake-image"), { filename: "test.jpg", contentType: "image/jpeg" });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("UNAUTHORIZED");
  });

  it("returns 400 when no image is provided", async () => {
    const res = await request(app)
      .post("/api/ai-sketch")
      .set("Content-Type", "application/json")
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("NO_IMAGE");
  });

  it("returns 402 when user has insufficient tokens", async () => {
    vi.mocked(deductTokens).mockResolvedValue({ success: false, balance: 0 });

    const res = await request(app)
      .post("/api/ai-sketch")
      .attach("image", Buffer.from("fake-image"), { filename: "test.jpg", contentType: "image/jpeg" });

    expect(res.status).toBe(402);
    expect(res.body.error).toBe("INSUFFICIENT_TOKENS");
  });

  it("returns 200 with jobId on success (async job-based processing)", async () => {
    const res = await request(app)
      .post("/api/ai-sketch")
      .attach("image", Buffer.from("fake-image"), { filename: "test.jpg", contentType: "image/jpeg" });

    expect(res.status).toBe(200);
    expect(res.body.jobId).toBeTruthy();
    expect(typeof res.body.jobId).toBe("string");
  });

  it("accepts optional description and focusText fields", async () => {
    const res = await request(app)
      .post("/api/ai-sketch")
      .field("description", "bicycle")
      .field("focusText", "wheels")
      .attach("image", Buffer.from("fake-image"), { filename: "test.jpg", contentType: "image/jpeg" });

    expect(res.status).toBe(200);
    expect(res.body.jobId).toBeTruthy();
  });
});

describe("GET /api/ai-sketch/job/:jobId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAppUserFromCookie).mockReturnValue({ userId: 1, username: "testuser" });
  });

  it("returns 401 when user is not authenticated", async () => {
    vi.mocked(getAppUserFromCookie).mockReturnValue(null);

    const res = await request(app).get("/api/ai-sketch/job/nonexistent");

    expect(res.status).toBe(401);
  });

  it("returns 404 for unknown job", async () => {
    const res = await request(app).get("/api/ai-sketch/job/nonexistent-job-id");

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("JOB_NOT_FOUND");
  });
});

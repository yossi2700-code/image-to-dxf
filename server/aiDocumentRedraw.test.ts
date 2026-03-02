/**
 * Tests for AI Document Redraw route
 * Tests the /api/ai-document-redraw and /api/ai-document-redraw/refine endpoints
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import cookieParser from "cookie-parser";

// Mock dependencies before importing the route
vi.mock("./appAuth", () => ({
  getAppUserFromCookie: vi.fn(),
}));

vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue(null), // null = no DB, skip block check
}));

vi.mock("./tokenService", () => ({
  deductTokens: vi.fn().mockResolvedValue({ success: true, balanceAfter: 15 }),
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
    choices: [{ message: { content: "A hand-drawn memorial stone with Hebrew text 'שלום' and decorative border." } }],
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

vi.mock("sharp", () => ({
  default: vi.fn().mockReturnValue({
    resize: vi.fn().mockReturnThis(),
    jpeg: vi.fn().mockReturnThis(),
    grayscale: vi.fn().mockReturnThis(),
    threshold: vi.fn().mockReturnThis(),
    png: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue(Buffer.from("fake-image-data")),
  }),
}));

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
    segmentCount: 42,
    width: 1024,
    height: 1024,
    realWidth: 1024,
    realHeight: 1024,
  }),
}));

vi.mock("nanoid", () => ({
  nanoid: vi.fn().mockReturnValue("test-nano-id"),
}));

import { getAppUserFromCookie } from "./appAuth";
import { deductTokens } from "./tokenService";
import aiDocumentRedrawRoute from "./aiDocumentRedrawRoute";

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(aiDocumentRedrawRoute);

describe("POST /api/ai-document-redraw", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: mock storage always succeeds
    vi.mocked(getAppUserFromCookie).mockReturnValue({ userId: 1, username: "testuser" });
    vi.mocked(deductTokens).mockResolvedValue({ success: true, balanceAfter: 15 });
  });

  it("returns 401 when user is not authenticated", async () => {
    vi.mocked(getAppUserFromCookie).mockReturnValue(null);

    const res = await request(app)
      .post("/api/ai-document-redraw")
      .attach("image", Buffer.from("fake-image"), { filename: "test.jpg", contentType: "image/jpeg" });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("UNAUTHORIZED");
  });

  it("returns 400 when no image is provided", async () => {
    const res = await request(app)
      .post("/api/ai-document-redraw")
      .set("Content-Type", "application/json")
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("NO_IMAGE");
  });

  it("returns 402 when user has insufficient tokens", async () => {
    vi.mocked(deductTokens).mockResolvedValue({ success: false, balance: 0 });

    const res = await request(app)
      .post("/api/ai-document-redraw")
      .attach("image", Buffer.from("fake-image"), { filename: "test.jpg", contentType: "image/jpeg" });

    expect(res.status).toBe(402);
    expect(res.body.error).toBe("INSUFFICIENT_TOKENS");
  });

  it("returns 200 with jobId on success (job-based async processing)", async () => {
    const res = await request(app)
      .post("/api/ai-document-redraw")
      .attach("image", Buffer.from("fake-image"), { filename: "test.jpg", contentType: "image/jpeg" });

    expect(res.status).toBe(200);
    // Route returns jobId immediately — processing happens in background
    expect(res.body.jobId).toBeTruthy();
    expect(typeof res.body.jobId).toBe("string");
  });

  it("includes description in request when provided", async () => {
    const res = await request(app)
      .post("/api/ai-document-redraw")
      .field("description", "מצבה עם שם ותאריך")
      .attach("image", Buffer.from("fake-image"), { filename: "test.jpg", contentType: "image/jpeg" });

    expect(res.status).toBe(200);
    // Route returns jobId immediately — LLM is called in background
    expect(res.body.jobId).toBeTruthy();
  });
});

describe("POST /api/ai-document-redraw/refine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAppUserFromCookie).mockReturnValue({ userId: 1, username: "testuser" });
    vi.mocked(deductTokens).mockResolvedValue({ success: true, balanceAfter: 13 });
  });

  it("returns 401 when user is not authenticated", async () => {
    vi.mocked(getAppUserFromCookie).mockReturnValue(null);

    const res = await request(app)
      .post("/api/ai-document-redraw/refine")
      .send({ imageUrl: "https://s3.example.com/test.png", instruction: "הגדל את הכתב" });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("UNAUTHORIZED");
  });

  it("returns 400 when imageUrl is missing", async () => {
    const res = await request(app)
      .post("/api/ai-document-redraw/refine")
      .send({ instruction: "הגדל את הכתב" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("NO_IMAGE_URL");
  });

  it("returns 400 when instruction is too short", async () => {
    const res = await request(app)
      .post("/api/ai-document-redraw/refine")
      .send({ imageUrl: "https://s3.example.com/test.png", instruction: "ab" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("NO_INSTRUCTION");
  });

  it("returns 402 when user has insufficient tokens", async () => {
    vi.mocked(deductTokens).mockResolvedValue({ success: false, balance: 1 });

    const res = await request(app)
      .post("/api/ai-document-redraw/refine")
      .send({ imageUrl: "https://s3.example.com/test.png", instruction: "הגדל את הכתב" });

    expect(res.status).toBe(402);
    expect(res.body.error).toBe("INSUFFICIENT_TOKENS");
  });
});

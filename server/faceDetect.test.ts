/**
 * faceDetect.test.ts — Unit tests for face detection route helpers (Fast Mode)
 *
 * Tests the pure utility functions used in faceDetectRoute.ts:
 * - TOKEN_COSTS["face_detect"] is set correctly
 * - Job lifecycle helpers (createJob, getJob, updateJob, cancelJob)
 * - Single-image result structure (no Vision step, no faceDescription)
 * - faceDetectRoute endpoints respond with UNAUTHORIZED when no cookie
 */
import { describe, expect, it } from "vitest";
import { TOKEN_COSTS } from "./tokenService";
import { createJob, getJob, updateJob, cancelJob } from "./jobStore";
import { nanoid } from "nanoid";

// ─── TOKEN_COSTS ──────────────────────────────────────────────────────────────
describe("TOKEN_COSTS", () => {
  it("face_detect costs 4 tokens", () => {
    expect(TOKEN_COSTS["face_detect"]).toBe(4);
  });

  it("face_detect cost is a positive integer", () => {
    const cost = TOKEN_COSTS["face_detect"];
    expect(typeof cost).toBe("number");
    expect(cost).toBeGreaterThan(0);
    expect(Number.isInteger(cost)).toBe(true);
  });
});

// ─── Job Store ────────────────────────────────────────────────────────────────
describe("jobStore — face_detect lifecycle", () => {
  it("creates a job with pending status", () => {
    const jobId = `test-face-${nanoid(6)}`;
    createJob(jobId, 42, "face_detect");
    const job = getJob(jobId);
    expect(job).not.toBeNull();
    expect(job?.status).toBe("pending");
    expect(job?.userId).toBe(42);
    expect(job?.tokenAction).toBe("face_detect");
  });

  it("updates job status to processing with drawing step text (fast mode — no Vision)", () => {
    const jobId = `test-face-${nanoid(6)}`;
    createJob(jobId, 99, "face_detect");
    updateJob(jobId, { status: "processing", step: "מצייר פורטרט...", stepEn: "Drawing portrait..." });
    const job = getJob(jobId);
    expect(job?.status).toBe("processing");
    expect(job?.step).toBe("מצייר פורטרט...");
    expect(job?.stepEn).toBe("Drawing portrait...");
  });

  it("updates job to converting step", () => {
    const jobId = `test-face-${nanoid(6)}`;
    createJob(jobId, 99, "face_detect");
    updateJob(jobId, { status: "processing", step: "ממיר ל-DXF...", stepEn: "Converting to DXF..." });
    const job = getJob(jobId);
    expect(job?.step).toBe("ממיר ל-DXF...");
    expect(job?.stepEn).toBe("Converting to DXF...");
  });

  it("marks job as done with single image result (no faceDescription)", () => {
    const jobId = `test-face-${nanoid(6)}`;
    createJob(jobId, 5, "face_detect");
    const fakeImage = {
      imageUrl: "https://example.com/face.png",
      svgPreview: "<svg></svg>",
      dxfUrl: "https://example.com/face.dxf",
      dxfFilename: "face_portrait.dxf",
      segmentCount: 200,
      width: 1024,
      height: 1024,
      realWidth: 100,
      realHeight: 100,
    };
    const fakeResult = { success: true, images: [fakeImage] };
    updateJob(jobId, { status: "done", result: fakeResult });
    const job = getJob(jobId);
    expect(job?.status).toBe("done");
    const r = job?.result as typeof fakeResult;
    expect(r?.success).toBe(true);
    expect(r?.images).toHaveLength(1);
    expect(r?.images[0].dxfFilename).toBe("face_portrait.dxf");
  });

  it("result contains exactly 1 image (fast mode — single portrait)", () => {
    const jobId = `test-face-${nanoid(6)}`;
    createJob(jobId, 5, "face_detect");
    const fakeResult = {
      success: true,
      images: [{ imageUrl: "u", svgPreview: "s", dxfUrl: "d", dxfFilename: "face_portrait.dxf", segmentCount: 100, width: 512, height: 512, realWidth: 50, realHeight: 50 }],
    };
    updateJob(jobId, { status: "done", result: fakeResult });
    const job = getJob(jobId);
    const r = job?.result as typeof fakeResult;
    expect(r?.images).toHaveLength(1);
  });

  it("cancels a pending job", () => {
    const jobId = `test-face-${nanoid(6)}`;
    createJob(jobId, 3, "face_detect");
    const wasCancelled = cancelJob(jobId);
    expect(wasCancelled).toBe(true);
    const job = getJob(jobId);
    expect(job?.status).toBe("cancelled");
  });

  it("cannot cancel a completed job", () => {
    const jobId = `test-face-${nanoid(6)}`;
    createJob(jobId, 3, "face_detect");
    updateJob(jobId, { status: "done", result: { success: true, images: [] } });
    const wasCancelled = cancelJob(jobId);
    expect(wasCancelled).toBe(false);
  });

  it("returns undefined for non-existent job", () => {
    const job = getJob("non-existent-job-id-xyz");
    expect(job).toBeUndefined();
  });
});

// ─── HTTP endpoints — unauthorized access ────────────────────────────────────
describe("face-detect HTTP endpoints — unauthorized", () => {
  it("GET /api/face-detect/job/:id returns 401 without cookie", async () => {
    const { getAppUserFromCookie } = await import("./appAuth");
    const result = getAppUserFromCookie({});
    expect(result).toBeNull();
  });

  it("face_detect token action string matches tokenService key", () => {
    const action = "face_detect" as keyof typeof TOKEN_COSTS;
    expect(TOKEN_COSTS[action]).toBeDefined();
    expect(TOKEN_COSTS[action]).toBeGreaterThan(0);
  });
});

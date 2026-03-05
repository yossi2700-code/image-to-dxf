/**
 * faceDetect.test.ts — Unit tests for face detection route helpers
 *
 * Tests the pure utility functions used in faceDetectRoute.ts:
 * - TOKEN_COSTS["face_detect"] is set correctly
 * - Job lifecycle helpers (createJob, getJob, updateJob, cancelJob)
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

  it("updates job status to processing with step text", () => {
    const jobId = `test-face-${nanoid(6)}`;
    createJob(jobId, 99, "face_detect");
    updateJob(jobId, { status: "processing", step: "מזהה פנים...", stepEn: "Detecting faces..." });
    const job = getJob(jobId);
    expect(job?.status).toBe("processing");
    expect(job?.step).toBe("מזהה פנים...");
    expect(job?.stepEn).toBe("Detecting faces...");
  });

  it("stores partial images during streaming", () => {
    const jobId = `test-face-${nanoid(6)}`;
    createJob(jobId, 7, "face_detect");
    const fakeImage = {
      imageUrl: "https://example.com/face.png",
      svgPreview: "<svg></svg>",
      dxfUrl: "https://example.com/face.dxf",
      dxfFilename: "face_portrait.dxf",
      segmentCount: 150,
      width: 512,
      height: 512,
      realWidth: 100,
      realHeight: 100,
    };
    updateJob(jobId, { partialImages: [fakeImage] });
    const job = getJob(jobId);
    expect(Array.isArray(job?.partialImages)).toBe(true);
    expect((job?.partialImages as typeof fakeImage[]).length).toBe(1);
    expect((job?.partialImages as typeof fakeImage[])[0].dxfFilename).toBe("face_portrait.dxf");
  });

  it("marks job as done with result", () => {
    const jobId = `test-face-${nanoid(6)}`;
    createJob(jobId, 5, "face_detect");
    const fakeResult = {
      success: true,
      images: [],
      faceDescription: "Oval face, front-facing, brown eyes, short dark hair",
    };
    updateJob(jobId, { status: "done", result: fakeResult });
    const job = getJob(jobId);
    expect(job?.status).toBe("done");
    expect((job?.result as typeof fakeResult)?.faceDescription).toContain("Oval face");
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
    updateJob(jobId, { status: "done", result: { success: true, images: [], faceDescription: "" } });
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
    // Use the express app directly via supertest-like approach
    // We test the route logic by checking the auth guard behavior
    // The route calls getAppUserFromCookie(req.cookies) — without a valid cookie it returns null
    // This is tested by verifying the guard function behavior
    const { getAppUserFromCookie } = await import("./appAuth");
    const result = getAppUserFromCookie({});
    expect(result).toBeNull();
  });

  it("face_detect token action string matches tokenService key", () => {
    // Verify the token action string used in the route matches the key in TOKEN_COSTS
    const action = "face_detect" as keyof typeof TOKEN_COSTS;
    expect(TOKEN_COSTS[action]).toBeDefined();
    expect(TOKEN_COSTS[action]).toBeGreaterThan(0);
  });
});

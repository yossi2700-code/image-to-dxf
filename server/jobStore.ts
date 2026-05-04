/**
 * jobStore.ts — DB-backed job store for background AI processing.
 *
 * Jobs are persisted to MySQL so they survive Cloud Run instance restarts.
 * An in-memory cache is kept for fast reads during active processing.
 * Clients poll GET /api/jobs/:jobId to check status.
 * Cancel endpoint refunds tokens if job is still pending/processing.
 */

import { getDb } from "./db";
import { persistentJobs } from "../drizzle/schema";
import { eq, lt, and, or, inArray } from "drizzle-orm";

export type JobStatus = "pending" | "processing" | "done" | "error" | "cancelled";

export interface Job {
  id: string;
  userId: number;
  status: JobStatus;
  createdAt: number;
  updatedAt: number;
  result?: unknown;
  error?: string;
  errorCode?: string;  // e.g. "UNCLEAR_IMAGE" for special UI handling
  faceCount?: number;   // number of faces detected (used for TOO_MANY_FACES error)
  tokenAction?: string; // e.g. "ai_trace" — used for refund on cancel
  tokenDeducted?: boolean; // true once tokens have been deducted — prevents phantom refunds
  noFaceRefundSent?: boolean; // true once no-face refund was issued — prevents double refund
  step?: string;        // Human-readable current step message (he/en)
  stepEn?: string;      // English step message
  partialImages?: unknown[]; // Partial results streamed as each image completes
}

// In-memory cache — fast reads during active processing on the same instance
const cache = new Map<string, Job>();

function rowToJob(row: typeof persistentJobs.$inferSelect): Job {
  return {
    id: row.id,
    userId: row.userId,
    status: row.status as JobStatus,
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
    result: row.result ? JSON.parse(row.result) : undefined,
    error: row.error ?? undefined,
    errorCode: row.errorCode ?? undefined,
    faceCount: row.faceCount ?? undefined,
    tokenAction: row.tokenAction ?? undefined,
    tokenDeducted: row.tokenDeducted === 1,
    noFaceRefundSent: row.noFaceRefundSent === 1,
    step: row.step ?? undefined,
    stepEn: row.stepEn ?? undefined,
    partialImages: row.partialImages ? JSON.parse(row.partialImages) : undefined,
  };
}

// Auto-clean jobs older than 2 hours from DB; mark stale processing jobs as error after 10 min
setInterval(async () => {
  try {
    const db = await getDb();
    if (!db) return;
    const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const staleCutoff = new Date(Date.now() - 10 * 60 * 1000);
    // Delete old completed/cancelled/error jobs
    await db.delete(persistentJobs).where(
      and(
        lt(persistentJobs.createdAt, cutoff),
        inArray(persistentJobs.status, ["done", "error", "cancelled"])
      )
    );
    // Mark stale processing/pending jobs as error
    await db.update(persistentJobs)
      .set({ status: "error", error: "Processing timed out after 10 minutes" })
      .where(
        and(
          lt(persistentJobs.updatedAt, staleCutoff),
          or(
            eq(persistentJobs.status, "processing"),
            eq(persistentJobs.status, "pending")
          )
        )
      );
    // Clean in-memory cache of old entries
    const cacheCutoff = Date.now() - 2 * 60 * 60 * 1000;
    for (const [id, job] of Array.from(cache.entries())) {
      if (job.createdAt < cacheCutoff) cache.delete(id);
    }
  } catch (e: unknown) {
    console.warn("[jobStore] cleanup error:", e);
  }
}, 60 * 1000);

export function createJob(id: string, userId: number, tokenAction: string): Job {
  const now = Date.now();
  const job: Job = {
    id,
    userId,
    status: "pending",
    createdAt: now,
    updatedAt: now,
    tokenAction,
  };
  cache.set(id, job);
  // Fire-and-forget DB write — don't block the caller
  getDb().then(db => {
    if (!db) return;
    return db.insert(persistentJobs).values({
      id,
      userId,
      status: "pending",
      tokenAction,
      tokenDeducted: 0,
      noFaceRefundSent: 0,
    });
  }).catch((e: unknown) => console.error("[jobStore] createJob DB error:", e));
  return job;
}

export function getJob(id: string): Job | undefined {
  return cache.get(id);
}

/**
 * Fetch job from DB — used when the job is not in the in-memory cache
 * (e.g. after a Cloud Run instance restart). Returns undefined if not found.
 */
export async function getJobFromDB(id: string): Promise<Job | undefined> {
  const cached = cache.get(id);
  if (cached) return cached;
  try {
    const db = await getDb();
    if (!db) return undefined;
    const rows = await db.select().from(persistentJobs).where(eq(persistentJobs.id, id)).limit(1);
    if (rows.length === 0) return undefined;
    const job = rowToJob(rows[0]);
    cache.set(id, job);
    return job;
  } catch (e: unknown) {
    console.error("[jobStore] getJobFromDB error:", e);
    return undefined;
  }
}

export function updateJob(id: string, update: Partial<Job>): void {
  const job = cache.get(id);
  if (job) {
    Object.assign(job, update, { updatedAt: Date.now() });
  }
  // Build DB update object
  const dbUpdate: Record<string, unknown> = {};
  if (update.status !== undefined) dbUpdate.status = update.status;
  if (update.error !== undefined) dbUpdate.error = update.error;
  if (update.errorCode !== undefined) dbUpdate.errorCode = update.errorCode;
  if (update.faceCount !== undefined) dbUpdate.faceCount = update.faceCount;
  if (update.step !== undefined) dbUpdate.step = update.step;
  if (update.stepEn !== undefined) dbUpdate.stepEn = update.stepEn;
  if (update.tokenDeducted !== undefined) dbUpdate.tokenDeducted = update.tokenDeducted ? 1 : 0;
  if (update.noFaceRefundSent !== undefined) dbUpdate.noFaceRefundSent = update.noFaceRefundSent ? 1 : 0;
  if (update.result !== undefined) dbUpdate.result = JSON.stringify(update.result);
  if (update.partialImages !== undefined) dbUpdate.partialImages = JSON.stringify(update.partialImages);
  if (Object.keys(dbUpdate).length > 0) {
    getDb().then(db => {
      if (!db) return;
      return db.update(persistentJobs).set(dbUpdate).where(eq(persistentJobs.id, id));
    }).catch((e: unknown) => console.error("[jobStore] updateJob DB error:", e));
  }
}

/**
 * Touch a job's updatedAt timestamp without changing any other field.
 * Call this periodically during long-running operations (e.g. image generation)
 * to prevent the stale-job watchdog from marking the job as timed out.
 */
export function heartbeatJob(id: string): void {
  const job = cache.get(id);
  if (job && (job.status === "processing" || job.status === "pending")) {
    job.updatedAt = Date.now();
    // Lightweight DB touch — just update status to trigger ON UPDATE CURRENT_TIMESTAMP
    getDb().then(db => {
      if (!db) return;
      return db.update(persistentJobs)
        .set({ status: job.status })
        .where(eq(persistentJobs.id, id));
    }).catch((e: unknown) => console.warn("[jobStore] heartbeat DB error:", e));
  }
}

export function cancelJob(id: string): boolean {
  const job = cache.get(id);
  if (!job) return false;
  if (job.status === "done" || job.status === "error" || job.status === "cancelled") return false;
  job.status = "cancelled";
  job.updatedAt = Date.now();
  getDb().then(db => {
    if (!db) return;
    return db.update(persistentJobs).set({ status: "cancelled" }).where(eq(persistentJobs.id, id));
  }).catch((e: unknown) => console.error("[jobStore] cancelJob DB error:", e));
  return true;
}

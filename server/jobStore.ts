/**
 * jobStore.ts — In-memory job store for background AI processing.
 *
 * Jobs survive client disconnects — the server keeps processing.
 * Clients poll GET /api/jobs/:jobId to check status.
 * Cancel endpoint refunds tokens if job is still pending/processing.
 */

export type JobStatus = "pending" | "processing" | "done" | "error" | "cancelled";

export interface Job {
  id: string;
  userId: number;
  status: JobStatus;
  createdAt: number;
  updatedAt: number;
  result?: unknown;
  error?: string;
  tokenAction?: string; // e.g. "ai_trace" — used for refund on cancel
  step?: string;        // Human-readable current step message (he/en)
  stepEn?: string;      // English step message
  partialImages?: unknown[]; // Partial results streamed as each image completes
}

const jobs = new Map<string, Job>();

// Auto-clean jobs older than 2 hours; also mark stale "processing" jobs as error after 15 min
// (AI Outline + AI Sketch can take 3-8 minutes, so 15 min is a safe ceiling)
setInterval(() => {
  const cutoff = Date.now() - 2 * 60 * 60 * 1000;
  const staleCutoff = Date.now() - 15 * 60 * 1000; // 15 minutes
  for (const [id, job] of Array.from(jobs.entries())) {
    if (job.createdAt < cutoff) {
      jobs.delete(id);
    } else if (
      (job.status === "processing" || job.status === "pending") &&
      job.updatedAt < staleCutoff
    ) {
      // Job has been stuck for 15+ minutes — mark as error so client stops polling
      job.status = "error";
      job.error = "Processing timed out after 15 minutes";
      job.updatedAt = Date.now();
    }
  }
}, 60 * 1000); // check every minute

export function createJob(id: string, userId: number, tokenAction: string): Job {
  const job: Job = {
    id,
    userId,
    status: "pending",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    tokenAction,
  };
  jobs.set(id, job);
  return job;
}

export function getJob(id: string): Job | undefined {
  return jobs.get(id);
}

export function updateJob(id: string, update: Partial<Job>): void {
  const job = jobs.get(id);
  if (job) {
    Object.assign(job, update, { updatedAt: Date.now() });
  }
}

/**
 * Touch a job's updatedAt timestamp without changing any other field.
 * Call this periodically during long-running operations (e.g. image generation)
 * to prevent the stale-job watchdog from marking the job as timed out.
 */
export function heartbeatJob(id: string): void {
  const job = jobs.get(id);
  if (job && (job.status === "processing" || job.status === "pending")) {
    job.updatedAt = Date.now();
  }
}

export function cancelJob(id: string): boolean {
  const job = jobs.get(id);
  if (!job) return false;
  if (job.status === "done" || job.status === "error" || job.status === "cancelled") return false;
  job.status = "cancelled";
  job.updatedAt = Date.now();
  return true;
}

/**
 * failedJobsDb.ts — helpers for recording and querying failed background jobs.
 * Used by admin dashboard to debug failures (who, how long, why, source image).
 */

import { getDb } from "./db";
import { failedJobs, appUsers } from "../drizzle/schema";
import { eq, desc } from "drizzle-orm";

export interface RecordFailedJobParams {
  appUserId?: number;
  feature: string;
  durationMs: number;
  errorMessage?: string;
  sourceImageUrl?: string;
}

/**
 * Record a failed job in the database.
 * Call this from the catch block of any background job.
 */
export async function recordFailedJob(params: RecordFailedJobParams): Promise<void> {
  const db = await getDb();
  if (!db) return;
  try {
    await db.insert(failedJobs).values({
      appUserId: params.appUserId ?? null,
      feature: params.feature,
      durationMs: params.durationMs,
      errorMessage: params.errorMessage?.slice(0, 2000),
      sourceImageUrl: params.sourceImageUrl,
    });
  } catch (err) {
    console.error("[failedJobsDb] Failed to record failed job:", err);
  }
}

/**
 * Get recent failed jobs for admin dashboard.
 * Joins with app_users to include user email.
 */
export async function getRecentFailedJobs(limit = 50) {
  const db = await getDb();
  if (!db) return [];
  try {
    const rows = await db
      .select({
        id: failedJobs.id,
        feature: failedJobs.feature,
        durationMs: failedJobs.durationMs,
        errorMessage: failedJobs.errorMessage,
        sourceImageUrl: failedJobs.sourceImageUrl,
        createdAt: failedJobs.createdAt,
        userEmail: appUsers.email,
        userName: appUsers.name,
        userId: failedJobs.appUserId,
      })
      .from(failedJobs)
      .leftJoin(appUsers, eq(failedJobs.appUserId, appUsers.id))
      .orderBy(desc(failedJobs.createdAt))
      .limit(limit);
    return rows;
  } catch (err) {
    console.error("[failedJobsDb] Failed to get failed jobs:", err);
    return [];
  }
}

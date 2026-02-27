import { eq, count, and, gte } from "drizzle-orm";
import { getDb } from "./db";
import { appUsers, userActions } from "../drizzle/schema";

export const DEFAULT_MAX_ACTIONS = 10;

/** Daily limit per user (free tier) */
export const DAILY_LIMIT = 3;
/** Number of free days before user is blocked */
export const FREE_DAYS = 5;

/**
 * Check if a user has reached their daily or total action limit.
 *
 * Logic:
 * - If user.maxActions is null → unlimited (admin/premium)
 * - Otherwise apply free-tier rules:
 *   - 3 actions per day for up to 5 days (15 total)
 *   - After 5 days (account age > 5 days), user is blocked entirely
 *   - Within the 5-day window, check daily count ≤ 3
 */
export async function checkUsageLimit(appUserId: number): Promise<
  | { allowed: true; used: number; max: number | null; dailyUsed?: number; dailyMax?: number }
  | { allowed: false; used: number; max: number; reason: "daily" | "total" | "expired" }
> {
  const db = await getDb();
  if (!db) return { allowed: true, used: 0, max: null };

  // Get user's maxActions setting and creation date
  const [user] = await db
    .select({ maxActions: appUsers.maxActions, createdAt: appUsers.createdAt })
    .from(appUsers)
    .where(eq(appUsers.id, appUserId))
    .limit(1);

  if (!user) return { allowed: false, used: 0, max: 0, reason: "total" };

  // null = unlimited (premium/admin)
  if (user.maxActions === null) return { allowed: true, used: 0, max: null };

  // Count total actions
  const [totalResult] = await db
    .select({ total: count() })
    .from(userActions)
    .where(eq(userActions.appUserId, appUserId));

  const used = totalResult?.total ?? 0;

  // Check if account is older than FREE_DAYS
  const accountAgeMs = Date.now() - new Date(user.createdAt).getTime();
  const accountAgeDays = accountAgeMs / (1000 * 60 * 60 * 24);

  if (accountAgeDays > FREE_DAYS) {
    // Account expired free tier — blocked
    return { allowed: false, used, max: DAILY_LIMIT * FREE_DAYS, reason: "expired" };
  }

  // Within free days — check daily limit
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [dailyResult] = await db
    .select({ total: count() })
    .from(userActions)
    .where(
      and(
        eq(userActions.appUserId, appUserId),
        gte(userActions.createdAt, todayStart)
      )
    );

  const dailyUsed = dailyResult?.total ?? 0;

  if (dailyUsed >= DAILY_LIMIT) {
    return { allowed: false, used, max: DAILY_LIMIT, reason: "daily" };
  }

  return { allowed: true, used, max: DAILY_LIMIT * FREE_DAYS, dailyUsed, dailyMax: DAILY_LIMIT };
}

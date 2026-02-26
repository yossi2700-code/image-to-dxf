import { eq, count } from "drizzle-orm";
import { getDb } from "./db";
import { appUsers, userActions } from "../drizzle/schema";

export const DEFAULT_MAX_ACTIONS = 10;

/**
 * Check if a user has reached their action limit.
 * Returns { allowed: true } or { allowed: false, used, max }
 */
export async function checkUsageLimit(appUserId: number): Promise<
  | { allowed: true; used: number; max: number | null }
  | { allowed: false; used: number; max: number }
> {
  const db = await getDb();
  if (!db) return { allowed: true, used: 0, max: null };

  // Get user's maxActions setting
  const [user] = await db
    .select({ maxActions: appUsers.maxActions })
    .from(appUsers)
    .where(eq(appUsers.id, appUserId))
    .limit(1);

  if (!user) return { allowed: false, used: 0, max: 0 };

  // null = unlimited
  if (user.maxActions === null) return { allowed: true, used: 0, max: null };

  // Count actual actions (convert + ai_generate only, not download)
  const [result] = await db
    .select({ total: count() })
    .from(userActions)
    .where(eq(userActions.appUserId, appUserId));

  const used = result?.total ?? 0;
  const max = user.maxActions;

  if (used >= max) {
    return { allowed: false, used, max };
  }
  return { allowed: true, used, max };
}

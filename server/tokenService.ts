/**
 * Token (credit) service.
 * Handles deduction, addition, and balance queries for app users.
 *
 * Token costs per action:
 *   ai_trace   = 5 tokens  (3 images + Vision analysis)
 *   ai_generate = 3 tokens  (3 images from text)
 *   ai_refine  = 2 tokens  (1 image edit)
 *   convert    = 0 tokens  (local processing, free)
 *
 * New users receive 20 tokens on signup (set as DB default).
 */

import { getDb } from "./db";
import { appUsers, tokenTransactions, tokenCosts } from "../drizzle/schema";
import { eq, sql } from "drizzle-orm";

/** Default fallback costs (used if DB is unavailable) */
export const TOKEN_COSTS_DEFAULT = {
  ai_trace: 5,
  ai_generate: 3,
  ai_refine: 2,
  face_detect: 4,
  convert: 0,
} as const;

/** Static export for backward compatibility (used in type checks) */
export const TOKEN_COSTS = TOKEN_COSTS_DEFAULT;

export type TokenAction = keyof typeof TOKEN_COSTS_DEFAULT;

/** Cache for DB-loaded token costs (refreshed every 60 seconds) */
let _costsCache: Record<string, number> | null = null;
let _costsCacheTime = 0;
const CACHE_TTL_MS = 60_000;

/** Load token costs from DB (with in-memory cache) */
async function getTokenCostsFromDb(): Promise<Record<string, number>> {
  const now = Date.now();
  if (_costsCache && now - _costsCacheTime < CACHE_TTL_MS) return _costsCache;
  const db = await getDb();
  if (!db) return { ...TOKEN_COSTS_DEFAULT };
  try {
    const rows = await db.select().from(tokenCosts);
    const map: Record<string, number> = { ...TOKEN_COSTS_DEFAULT };
    for (const row of rows) {
      map[row.action] = row.cost;
    }
    _costsCache = map;
    _costsCacheTime = now;
    return map;
  } catch {
    return { ...TOKEN_COSTS_DEFAULT };
  }
}

/** Invalidate the costs cache (call after admin updates) */
export function invalidateTokenCostsCache() {
  _costsCache = null;
  _costsCacheTime = 0;
}

/**
 * Get the current token cost for an action from DB (respects admin overrides).
 * Falls back to TOKEN_COSTS_DEFAULT if DB is unavailable.
 */
export async function getTokenCostForAction(action: string): Promise<number> {
  const costs = await getTokenCostsFromDb();
  return costs[action] ?? TOKEN_COSTS_DEFAULT[action as TokenAction] ?? 0;
}

/**
 * Get current token balance for a user.
 * Returns 0 if user not found.
 */
export async function getTokenBalance(appUserId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const [user] = await db
    .select({ tokenBalance: appUsers.tokenBalance })
    .from(appUsers)
    .where(eq(appUsers.id, appUserId))
    .limit(1);
  return user?.tokenBalance ?? 0;
}

/**
 * Check if a user has enough tokens for an action (without deducting).
 * Returns { success: true } if balance is sufficient, { success: false, balance } if not.
 */
export async function checkTokenBalance(
  appUserId: number,
  action: TokenAction
): Promise<{ success: true; balance: number } | { success: false; balance: number }> {
  const costs = await getTokenCostsFromDb();
  const cost = costs[action] ?? TOKEN_COSTS_DEFAULT[action] ?? 0;
  const balance = await getTokenBalance(appUserId);
  if (balance >= cost) return { success: true, balance };
  return { success: false, balance };
}

/**
 * Deduct tokens for an action.
 * Returns { success: true, balanceAfter } on success.
 * Returns { success: false, balance } when insufficient tokens.
 */
export async function deductTokens(
  appUserId: number,
  action: TokenAction,
  descriptionOrOptions?: string | { checkOnly?: boolean }
): Promise<{ success: true; balanceAfter: number } | { success: false; balance: number }> {
  // Support checkOnly option for pre-flight balance check without deduction
  if (descriptionOrOptions && typeof descriptionOrOptions === 'object' && descriptionOrOptions.checkOnly) {
    return checkTokenBalance(appUserId, action) as Promise<{ success: true; balanceAfter: number } | { success: false; balance: number }>;
  }
  const description = typeof descriptionOrOptions === 'string' ? descriptionOrOptions : undefined;
  const costs = await getTokenCostsFromDb();
  const cost = costs[action] ?? TOKEN_COSTS_DEFAULT[action] ?? 0;
  if (cost === 0) return { success: true, balanceAfter: await getTokenBalance(appUserId) };

  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Atomic update: only deduct if balance >= cost
  const result = await db
    .update(appUsers)
    .set({ tokenBalance: sql`GREATEST(tokenBalance - ${cost}, 0)` })
    .where(sql`id = ${appUserId} AND tokenBalance >= ${cost}`);

  // Check if update happened (affectedRows > 0)
  const rows = result as unknown as [{ affectedRows: number }];
  const affectedRows = rows[0]?.affectedRows ?? 0;

  if (affectedRows === 0) {
    // Insufficient balance
    const balance = await getTokenBalance(appUserId);
    return { success: false, balance };
  }

  const balanceAfter = await getTokenBalance(appUserId);

  // Record transaction
  await db.insert(tokenTransactions).values({
    appUserId,
    amount: -cost,
    reason: action,
    description: description?.slice(0, 200),
    balanceAfter,
  });

  return { success: true, balanceAfter };
}

/**
 * Add tokens to a user's balance (admin action or bonus).
 */
export async function addTokens(
  appUserId: number,
  amount: number,
  reason: string,
  description?: string
): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(appUsers)
    .set({ tokenBalance: sql`tokenBalance + ${amount}` })
    .where(eq(appUsers.id, appUserId));

  const balanceAfter = await getTokenBalance(appUserId);

  await db.insert(tokenTransactions).values({
    appUserId,
    amount,
    reason,
    description: description?.slice(0, 200),
    balanceAfter,
  });

  return balanceAfter;
}

/**
 * Get recent token transactions for a user (for admin panel).
 */
export async function getTokenTransactions(appUserId: number, limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(tokenTransactions)
    .where(eq(tokenTransactions.appUserId, appUserId))
    .orderBy(sql`createdAt DESC`)
    .limit(limit);
}

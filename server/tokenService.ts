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
import { appUsers, tokenTransactions } from "../drizzle/schema";
import { eq, sql } from "drizzle-orm";

export const TOKEN_COSTS = {
  ai_trace: 5,
  ai_generate: 3,
  ai_refine: 2,
  face_detect: 4,
  convert: 0,
} as const;

export type TokenAction = keyof typeof TOKEN_COSTS;

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
 * Deduct tokens for an action.
 * Returns { success: true, balanceAfter } on success.
 * Returns { success: false, balance } when insufficient tokens.
 */
export async function deductTokens(
  appUserId: number,
  action: TokenAction,
  description?: string
): Promise<{ success: true; balanceAfter: number } | { success: false; balance: number }> {
  const cost = TOKEN_COSTS[action];
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

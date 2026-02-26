/**
 * userActionsDb.ts
 * Helper functions to record user actions in the user_actions table.
 * Called from uploadRoute and generateRoute when a registered user performs an action.
 */

import { getDb } from "./db";
import { userActions } from "../drizzle/schema";

export interface RecordActionParams {
  appUserId: number;
  actionType: "convert" | "ai_generate" | "download";
  description?: string;
  segmentCount?: number;
  dxfUrl?: string;
  imageUrl?: string;
  svgPreview?: string;
}

export async function recordUserAction(params: RecordActionParams): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    await db.insert(userActions).values({
      appUserId: params.appUserId,
      actionType: params.actionType,
      description: params.description ?? null,
      segmentCount: params.segmentCount ?? 0,
      dxfUrl: params.dxfUrl ?? null,
      imageUrl: params.imageUrl ?? null,
      svgPreview: params.svgPreview ?? null,
    });
  } catch (err) {
    // Non-critical — don't fail the request if logging fails
    console.error("[userActionsDb] Failed to record action:", err);
  }
}

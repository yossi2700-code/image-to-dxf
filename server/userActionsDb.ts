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
  /** Groups related variations from the same generation request */
  groupId?: string;
  /** Variation label within the group (e.g. 'simple', 'detailed', 'complex') */
  variationLabel?: string;
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
      groupId: params.groupId ?? null,
      variationLabel: params.variationLabel ?? null,
    });
  } catch (err) {
    // Non-critical — don't fail the request if logging fails
    console.error("[userActionsDb] Failed to record action:", err);
  }
}

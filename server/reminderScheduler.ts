/**
 * Reminder Scheduler
 * Runs every hour and sends a 48-hour reminder email to users who:
 * 1. Registered with email (not OAuth only — passwordHash is not null)
 * 2. Have not claimed their welcome bonus yet
 * 3. Registered between 48h and 72h ago (send once in that window)
 */
import { getDb } from "./db";
import { appUsers, campaignRedemptions } from "../drizzle/schema";
import { eq, and, isNull, isNotNull, sql } from "drizzle-orm";
import { sendReminderEmail } from "./emailService";

export function startReminderScheduler() {
  // Run immediately on startup, then every hour
  runReminderCheck();
  setInterval(runReminderCheck, 60 * 60 * 1000);
}

async function runReminderCheck() {
  try {
    const db = await getDb();
    if (!db) return;

    const now = Date.now();
    const h48ago = new Date(now - 48 * 60 * 60 * 1000);
    const h72ago = new Date(now - 72 * 60 * 60 * 1000);

    // Find users who:
    // - registered with email (passwordHash is not null)
    // - registered between 48h and 72h ago
    // - have not been sent the reminder yet (reminderSentAt is null)
    const users = await db
      .select({
        id: appUsers.id,
        email: appUsers.email,
        name: appUsers.name,
        language: appUsers.language,
      })
      .from(appUsers)
      .where(
        and(
          isNotNull(appUsers.passwordHash),
          isNull(appUsers.reminderSentAt),
          sql`${appUsers.createdAt} < ${h48ago}`,
          sql`${appUsers.createdAt} > ${h72ago}`
        )
      );

    if (users.length === 0) return;

    console.log(`[ReminderScheduler] Found ${users.length} users to remind`);

    for (const user of users) {
      try {
        // Check if they already claimed the welcome bonus
        const redemptions = await db
          .select({ id: campaignRedemptions.id })
          .from(campaignRedemptions)
          .where(
            and(
              eq(campaignRedemptions.appUserId, user.id),
              eq(campaignRedemptions.campaignCode, "welcome_bonus_2026")
            )
          );

        // Mark as sent regardless (so we don't keep checking)
        await db
          .update(appUsers)
          .set({ reminderSentAt: now })
          .where(eq(appUsers.id, user.id));

        if (redemptions.length > 0) {
          // Already claimed — skip sending
          continue;
        }

        // Send reminder email
        const siteUrl = process.env.SITE_URL || "https://dxfai.ai";
        await sendReminderEmail({
          to: user.email,
          name: user.name,
          siteUrl,
          language: (user.language as "he" | "en") ?? "he",
        });

        console.log(`[ReminderScheduler] Sent reminder to ${user.email}`);
      } catch (err) {
        console.error(`[ReminderScheduler] Failed for ${user.email}:`, err);
      }
    }
  } catch (err) {
    console.error("[ReminderScheduler] Error:", err);
  }
}

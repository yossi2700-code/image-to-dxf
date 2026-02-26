import { desc, gte, sql, count, sum } from "drizzle-orm";
import { getDb } from "./db";
import { usageEvents, InsertUsageEvent } from "../drizzle/schema";

/** Anonymize IP: keep first 3 octets only (e.g. 1.2.3.x) */
export function anonymizeIp(ip: string | undefined): string | null {
  if (!ip) return null;
  // Handle IPv4
  const parts = ip.split(".");
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.${parts[2]}.x`;
  }
  // Handle IPv6 - just keep first 3 groups
  const v6parts = ip.split(":");
  if (v6parts.length > 3) {
    return `${v6parts[0]}:${v6parts[1]}:${v6parts[2]}:x`;
  }
  return null;
}

/** Log a usage event (fire-and-forget, never throws) */
export async function logUsageEvent(
  event: Omit<InsertUsageEvent, "id" | "createdAt">
): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    await db.insert(usageEvents).values(event);
  } catch (err) {
    console.warn("[usage] Failed to log event:", err);
  }
}

/** Get overall stats */
export async function getUsageStats() {
  const db = await getDb();
  if (!db) return null;

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 6);
  const monthStart = new Date(todayStart);
  monthStart.setDate(monthStart.getDate() - 29);

  const [totals] = await db
    .select({
      total: count(),
      totalConvert: sql<number>`SUM(CASE WHEN ${usageEvents.type} = 'convert' THEN 1 ELSE 0 END)`,
      totalAi: sql<number>`SUM(CASE WHEN ${usageEvents.type} = 'ai_generate' THEN 1 ELSE 0 END)`,
      totalSegments: sum(usageEvents.segmentCount),
    })
    .from(usageEvents);

  const [today] = await db
    .select({ count: count() })
    .from(usageEvents)
    .where(gte(usageEvents.createdAt, todayStart));

  const [thisWeek] = await db
    .select({ count: count() })
    .from(usageEvents)
    .where(gte(usageEvents.createdAt, weekStart));

  const [thisMonth] = await db
    .select({ count: count() })
    .from(usageEvents)
    .where(gte(usageEvents.createdAt, monthStart));

  return {
    total: Number(totals.total ?? 0),
    totalConvert: Number(totals.totalConvert ?? 0),
    totalAi: Number(totals.totalAi ?? 0),
    totalSegments: Number(totals.totalSegments ?? 0),
    today: Number(today.count ?? 0),
    thisWeek: Number(thisWeek.count ?? 0),
    thisMonth: Number(thisMonth.count ?? 0),
  };
}

/** Get daily activity for the last N days */
export async function getDailyActivity(days = 30) {
  const db = await getDb();
  if (!db) return [];

  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  since.setHours(0, 0, 0, 0);

  const rows = await db
    .select({
      date: sql<string>`DATE(${usageEvents.createdAt})`,
      total: count(),
      converts: sql<number>`SUM(CASE WHEN ${usageEvents.type} = 'convert' THEN 1 ELSE 0 END)`,
      aiGenerations: sql<number>`SUM(CASE WHEN ${usageEvents.type} = 'ai_generate' THEN 1 ELSE 0 END)`,
    })
    .from(usageEvents)
    .where(gte(usageEvents.createdAt, since))
    .groupBy(sql`DATE(${usageEvents.createdAt})`)
    .orderBy(sql`DATE(${usageEvents.createdAt})`);

  return rows.map((r) => ({
    date: r.date,
    total: Number(r.total),
    converts: Number(r.converts),
    aiGenerations: Number(r.aiGenerations),
  }));
}

/** Get recent events */
export async function getRecentEvents(limit = 20) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(usageEvents)
    .orderBy(desc(usageEvents.createdAt))
    .limit(limit);
}

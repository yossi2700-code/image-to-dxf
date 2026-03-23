import { z } from "zod";
import { notifyOwner } from "./notification";
import { adminProcedure, publicProcedure, router } from "./trpc";
import { getDb } from "../db";
import { sql } from "drizzle-orm";

export const systemRouter = router({
  health: publicProcedure
    .input(
      z.object({
        timestamp: z.number().min(0, "timestamp cannot be negative"),
      })
    )
    .query(() => ({
      ok: true,
    })),

  /** Public: check if maintenance mode is active */
  maintenanceMode: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { enabled: false };
    // Use raw SQL to avoid TiDB reserved word issue with `key` and `value` column names
    const rows = await db.execute(sql`SELECT \`id\`, \`key\`, \`value\` FROM \`system_settings\` WHERE \`key\` = 'maintenance_mode' LIMIT 1`);
    const row = (rows as unknown as Array<{ key: string; value: string }>)[0];
    return { enabled: row?.value === "1" };
  }),

  notifyOwner: adminProcedure
    .input(
      z.object({
        title: z.string().min(1, "title is required"),
        content: z.string().min(1, "content is required"),
      })
    )
    .mutation(async ({ input }) => {
      const delivered = await notifyOwner(input);
      return {
        success: delivered,
      } as const;
    }),
});

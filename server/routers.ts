import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { ENV } from "./_core/env";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { getDailyActivity, getRecentEvents, getUsageStats } from "./usageDb";
import { getDb } from "./db";
import { appUsers, userActions } from "../drizzle/schema";
import { desc, eq, and } from "drizzle-orm";
import { getAppUserFromCookie } from "./appAuth";

const ADMIN_COOKIE = "admin_session";

/** Check if the request has a valid admin session cookie */
function isAdminAuthenticated(req: { headers: Record<string, string | string[] | undefined>; cookies?: Record<string, string> }): boolean {
  // Express populates req.cookies when cookie-parser is used
  const cookies = (req as { cookies?: Record<string, string> }).cookies ?? {};
  return cookies[ADMIN_COOKIE] === "authenticated";
}

/** Procedure that only an admin-cookie holder can call */
const adminProcedure = publicProcedure.use(({ ctx, next }) => {
  if (!isAdminAuthenticated(ctx.req as Parameters<typeof isAdminAuthenticated>[0])) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "נדרשת כניסה כמנהל" });
  }
  return next({ ctx });
});

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  admin: router({
    /** Login with PIN — sets an admin session cookie */
    login: publicProcedure
      .input(z.object({ pin: z.string().min(1) }))
      .mutation(({ ctx, input }) => {
        if (!ENV.adminPin || input.pin !== ENV.adminPin) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "קוד גישה שגוי" });
        }
        // Set a simple session cookie (httpOnly, 7 days)
        ctx.res.cookie(ADMIN_COOKIE, "authenticated", {
          httpOnly: true,
          secure: ENV.isProduction,
          sameSite: ENV.isProduction ? "none" : "lax",
          maxAge: 7 * 24 * 60 * 60 * 1000,
          path: "/",
        });
        return { success: true } as const;
      }),

    /** Logout — clears admin cookie */
    logout: publicProcedure.mutation(({ ctx }) => {
      ctx.res.clearCookie(ADMIN_COOKIE, { path: "/" });
      return { success: true } as const;
    }),

    /** Check if currently authenticated */
    check: publicProcedure.query(({ ctx }) => {
      return { authenticated: isAdminAuthenticated(ctx.req as Parameters<typeof isAdminAuthenticated>[0]) };
    }),

    /** Overall usage statistics */
    stats: adminProcedure.query(async () => {
      const stats = await getUsageStats();
      if (!stats) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "לא ניתן לטעון סטטיסטיקות" });
      return stats;
    }),

    /** Daily activity for the last 30 days */
    dailyActivity: adminProcedure.query(async () => {
      return getDailyActivity(30);
    }),

    /** Recent events list */
    recentEvents: adminProcedure.query(async () => {
      return getRecentEvents(50);
    }),

    /** Registered app users list */
    users: adminProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db
        .select({
          id: appUsers.id,
          name: appUsers.name,
          email: appUsers.email,
          createdAt: appUsers.createdAt,
          lastLoginAt: appUsers.lastLoginAt,
        })
        .from(appUsers)
        .orderBy(desc(appUsers.createdAt))
        .limit(200);
    }),

    /** All user actions (for admin view) */
    userActions: adminProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db
        .select({
          id: userActions.id,
          appUserId: userActions.appUserId,
          actionType: userActions.actionType,
          description: userActions.description,
          segmentCount: userActions.segmentCount,
          dxfUrl: userActions.dxfUrl,
          imageUrl: userActions.imageUrl,
          createdAt: userActions.createdAt,
          userName: appUsers.name,
          userEmail: appUsers.email,
        })
        .from(userActions)
        .leftJoin(appUsers, eq(userActions.appUserId, appUsers.id))
        .orderBy(desc(userActions.createdAt))
        .limit(500);
    }),

    /** Actions for a specific user */
    userActionsByUser: adminProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        return db
          .select()
          .from(userActions)
          .where(eq(userActions.appUserId, input.userId))
          .orderBy(desc(userActions.createdAt))
          .limit(100);
      }),

    /** Update a user's action limit (null = unlimited) */
    setUserLimit: adminProcedure
      .input(z.object({ userId: z.number(), maxActions: z.number().nullable() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db
          .update(appUsers)
          .set({ maxActions: input.maxActions })
          .where(eq(appUsers.id, input.userId));
        return { success: true };
      }),
  }),

  /** History — returns the logged-in app user's own actions */
  history: router({
    list: publicProcedure.query(async ({ ctx }) => {
      const appUser = getAppUserFromCookie(
        (ctx.req as { cookies?: Record<string, string> }).cookies ?? {}
      );
      if (!appUser) return [];
      const db = await getDb();
      if (!db) return [];
      return db
        .select({
          id: userActions.id,
          actionType: userActions.actionType,
          description: userActions.description,
          segmentCount: userActions.segmentCount,
          dxfUrl: userActions.dxfUrl,
          imageUrl: userActions.imageUrl,
          svgPreview: userActions.svgPreview,
          shareToken: userActions.shareToken,
          createdAt: userActions.createdAt,
        })
        .from(userActions)
        .where(eq(userActions.appUserId, appUser.userId))
        .orderBy(desc(userActions.createdAt))
        .limit(100);
    }),

    /** Create a share link for a specific action */
    createShare: publicProcedure
      .input(z.object({ actionId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const appUser = getAppUserFromCookie(
          (ctx.req as { cookies?: Record<string, string> }).cookies ?? {}
        );
        if (!appUser) throw new TRPCError({ code: "UNAUTHORIZED", message: "נדרשת התחברות" });
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        // Verify ownership
        const [action] = await db
          .select()
          .from(userActions)
          .where(eq(userActions.id, input.actionId))
          .limit(1);
        if (!action || action.appUserId !== appUser.userId) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        // Reuse existing token or create new one
        if (action.shareToken) return { shareToken: action.shareToken };
        const token = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
        await db
          .update(userActions)
          .set({ shareToken: token, shareTitle: action.description ?? undefined })
          .where(eq(userActions.id, input.actionId));
        return { shareToken: token };
      }),

    /** Delete a user's own action */
    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const appUser = getAppUserFromCookie(
          (ctx.req as { cookies?: Record<string, string> }).cookies ?? {}
        );
        if (!appUser) throw new TRPCError({ code: "UNAUTHORIZED", message: "נדרשת התחברות" });
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        // Only delete own records
        await db
          .delete(userActions)
          .where(and(eq(userActions.id, input.id), eq(userActions.appUserId, appUser.userId)));
        return { success: true };
      }),

    /** Get a shared design by token (public) */
    getByShareToken: publicProcedure
      .input(z.object({ token: z.string() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return null;
        const [action] = await db
          .select({
            id: userActions.id,
            actionType: userActions.actionType,
            description: userActions.description,
            segmentCount: userActions.segmentCount,
            dxfUrl: userActions.dxfUrl,
            imageUrl: userActions.imageUrl,
            svgPreview: userActions.svgPreview,
            shareTitle: userActions.shareTitle,
            createdAt: userActions.createdAt,
          })
          .from(userActions)
          .where(eq(userActions.shareToken, input.token))
          .limit(1);
        return action ?? null;
      }),
  }),
});

export type AppRouter = typeof appRouter;

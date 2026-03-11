import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { ENV } from "./_core/env";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { getDailyActivity, getRecentEvents, getUsageStats } from "./usageDb";
import { getDb } from "./db";
import { appUsers, userActions, tokenTransactions, systemSettings, passwordResets, consentRecords, paypalOrders, packagePrices, tokenCosts } from "../drizzle/schema";
import { randomBytes } from "crypto";
import { sendPasswordResetEmail } from "./emailService";
import { desc, eq, and, sql } from "drizzle-orm";
import { getAppUserFromCookie } from "./appAuth";
import { getTokenBalance, addTokens, getTokenTransactions, invalidateTokenCostsCache } from "./tokenService";

const ADMIN_COOKIE = "admin_session";

// ── Rate limiting for admin login ─────────────────────────────────────────────
// Simple in-memory store: IP → { attempts, blockedUntil }
const MAX_ATTEMPTS = 5;
const BLOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes

interface RateLimitEntry {
  attempts: number;
  blockedUntil: number | null;
}

const loginAttempts = new Map<string, RateLimitEntry>();

function getClientIp(req: { headers: Record<string, string | string[] | undefined>; socket?: { remoteAddress?: string } }): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    const ip = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(",")[0];
    return ip.trim();
  }
  return (req as { socket?: { remoteAddress?: string } }).socket?.remoteAddress ?? "unknown";
}

function checkRateLimit(ip: string): void {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (entry?.blockedUntil && now < entry.blockedUntil) {
    const minutesLeft = Math.ceil((entry.blockedUntil - now) / 60000);
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: `יותר מדי ניסיונות כושלים. נסה שוב בעוד ${minutesLeft} דקות.`,
    });
  }
}

function recordFailedAttempt(ip: string): void {
  const now = Date.now();
  const entry = loginAttempts.get(ip) ?? { attempts: 0, blockedUntil: null };
  // Reset if previous block has expired
  if (entry.blockedUntil && now >= entry.blockedUntil) {
    entry.attempts = 0;
    entry.blockedUntil = null;
  }
  entry.attempts += 1;
  if (entry.attempts >= MAX_ATTEMPTS) {
    entry.blockedUntil = now + BLOCK_DURATION_MS;
  }
  loginAttempts.set(ip, entry);
}

function clearRateLimit(ip: string): void {
  loginAttempts.delete(ip);
}

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
        const ip = getClientIp(ctx.req as Parameters<typeof getClientIp>[0]);
        // Check if IP is currently blocked
        checkRateLimit(ip);

        if (!ENV.adminPin || input.pin !== ENV.adminPin) {
          recordFailedAttempt(ip);
          const entry = loginAttempts.get(ip);
          const remaining = MAX_ATTEMPTS - (entry?.attempts ?? 0);
          const blocked = entry?.blockedUntil && Date.now() < entry.blockedUntil;
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: blocked
              ? `חסמנו את הגישה ל-15 דקות לאחר ${MAX_ATTEMPTS} ניסיונות כושלים.`
              : `קוד גישה שגוי. נותרו ${remaining} ניסיונות.`,
          });
        }

        // Successful login — clear rate limit counter
        clearRateLimit(ip);

        // Set a simple session cookie (httpOnly, 7 days)
        // Note: sameSite "lax" works on Safari/iPhone; "none" requires secure but breaks Safari ITP
        ctx.res.cookie(ADMIN_COOKIE, "authenticated", {
          httpOnly: true,
          secure: ENV.isProduction,
          sameSite: "lax",
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

    /** Registered users with token balance, last action and last purchase */
    usersWithTokens: adminProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db
        .select({
          id: appUsers.id,
          name: appUsers.name,
          email: appUsers.email,
          tokenBalance: appUsers.tokenBalance,
          isBlocked: appUsers.isBlocked,
          createdAt: appUsers.createdAt,
          lastLoginAt: appUsers.lastLoginAt,
        })
        .from(appUsers)
        .orderBy(desc(appUsers.createdAt))
        .limit(200);
      if (rows.length === 0) return [];
      const userIds = rows.map(r => r.id);
      const idList = userIds.join(",");
      // Last action per user
      const allActions = await db
        .select({
          appUserId: userActions.appUserId,
          actionType: userActions.actionType,
          description: userActions.description,
          dxfUrl: userActions.dxfUrl,
          imageUrl: userActions.imageUrl,
          feature: userActions.feature,
          createdAt: userActions.createdAt,
        })
        .from(userActions)
        .where(sql`${userActions.appUserId} IN (${sql.raw(idList)})`)
        .orderBy(desc(userActions.createdAt))
        .limit(500);
      // Last purchase per user
      const allPurchases = await db
        .select({
          appUserId: paypalOrders.appUserId,
          packageId: paypalOrders.packageId,
          tokenAmount: paypalOrders.tokenAmount,
          priceAmount: paypalOrders.priceAmount,
          currency: paypalOrders.currency,
          completedAt: paypalOrders.completedAt,
        })
        .from(paypalOrders)
        .where(and(sql`${paypalOrders.appUserId} IN (${sql.raw(idList)})`, eq(paypalOrders.status, "completed")))
        .orderBy(desc(paypalOrders.completedAt))
        .limit(500);
      const lastActionMap = new Map<number, typeof allActions[0]>();
      for (const a of allActions) {
        if (!lastActionMap.has(a.appUserId)) lastActionMap.set(a.appUserId, a);
      }
      const lastPurchaseMap = new Map<number, typeof allPurchases[0]>();
      for (const p of allPurchases) {
        if (!lastPurchaseMap.has(p.appUserId)) lastPurchaseMap.set(p.appUserId, p);
      }
      return rows.map(r => ({
        ...r,
        lastAction: lastActionMap.get(r.id) ?? null,
        lastPurchase: lastPurchaseMap.get(r.id) ?? null,
      }));
    }),

    /** Token transactions for a specific user */
    userTokenHistory: adminProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ input }) => {
        return getTokenTransactions(input.userId, 50);
      }),

    /** Add tokens to a user (admin action) */
    addTokens: adminProcedure
      .input(z.object({ userId: z.number(), amount: z.number().min(1).max(10000), note: z.string().optional() }))
      .mutation(async ({ input }) => {
        const balanceAfter = await addTokens(
          input.userId,
          input.amount,
          "admin_add",
          input.note ?? `Admin added ${input.amount} tokens`
        );
        return { success: true, balanceAfter };
      }),

    /** Block a user — prevents them from using AI features */
    blockUser: adminProcedure
      .input(z.object({ userId: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db.update(appUsers).set({ isBlocked: 1 }).where(eq(appUsers.id, input.userId));
        return { success: true };
      }),

    /** Unblock a user */
    unblockUser: adminProcedure
      .input(z.object({ userId: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db.update(appUsers).set({ isBlocked: 0 }).where(eq(appUsers.id, input.userId));
        return { success: true };
      }),

    /** Get maintenance mode status */
    getMaintenanceMode: adminProcedure.query(async () => {
      const db = await getDb();
      if (!db) return { enabled: false };
      const [row] = await db.select().from(systemSettings).where(eq(systemSettings.key, "maintenance_mode")).limit(1);
      return { enabled: row?.value === "1" };
    }),

    /** Toggle maintenance mode on/off */
    setMaintenanceMode: adminProcedure
      .input(z.object({ enabled: z.boolean() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db
          .insert(systemSettings)
          .values({ key: "maintenance_mode", value: input.enabled ? "1" : "0" })
          .onDuplicateKeyUpdate({ set: { value: input.enabled ? "1" : "0" } });
        return { success: true, enabled: input.enabled };
      }),

    /** List consent records (admin view) */
    consentRecords: adminProcedure
      .input(z.object({ limit: z.number().min(1).max(200).default(100) }).optional())
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const rows = await db
          .select()
          .from(consentRecords)
          .orderBy(desc(consentRecords.consentAt))
          .limit(input?.limit ?? 100);
        return rows;
      }),

    /** Send password reset email to a user (admin action) */
    sendPasswordReset: adminProcedure
      .input(z.object({ userId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const [user] = await db
          .select({ id: appUsers.id, email: appUsers.email, name: appUsers.name })
          .from(appUsers).where(eq(appUsers.id, input.userId)).limit(1);
        if (!user?.email) throw new TRPCError({ code: "NOT_FOUND", message: "משתמש לא נמצא" });
        const resetToken = randomBytes(48).toString("hex");
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
        await db.insert(passwordResets).values({ appUserId: user.id, token: resetToken, expiresAt });
        const req = ctx.req as { headers: Record<string, string | string[] | undefined> };
        const proto = Array.isArray(req.headers["x-forwarded-proto"]) ? req.headers["x-forwarded-proto"][0] : (req.headers["x-forwarded-proto"] ?? "https");
        const host = Array.isArray(req.headers["x-forwarded-host"]) ? req.headers["x-forwarded-host"][0] : (req.headers["x-forwarded-host"] ?? req.headers["host"] ?? "localhost");
        const origin = `${proto}://${host}`;
        const resetUrl = `${origin}/reset-password?token=${resetToken}`;
        await sendPasswordResetEmail({ to: user.email, name: user.name, resetUrl });
        return { success: true };
      }),

    /** All PayPal orders (for admin view) */
    paypalOrders: adminProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db
        .select({
          id: paypalOrders.id,
          paypalOrderId: paypalOrders.paypalOrderId,
          packageId: paypalOrders.packageId,
          tokenAmount: paypalOrders.tokenAmount,
          priceAmount: paypalOrders.priceAmount,
          currency: paypalOrders.currency,
          status: paypalOrders.status,
          tokensCredited: paypalOrders.tokensCredited,
          ipAnon: paypalOrders.ipAnon,
          createdAt: paypalOrders.createdAt,
          completedAt: paypalOrders.completedAt,
          userEmail: appUsers.email,
          userName: appUsers.name,
        })
        .from(paypalOrders)
        .leftJoin(appUsers, eq(paypalOrders.appUserId, appUsers.id))
        .orderBy(desc(paypalOrders.createdAt))
        .limit(500);
      return rows;
    }),

    /** Get all package prices */
    getPackagePrices: adminProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(packagePrices).orderBy(packagePrices.tokenAmount);
    }),

    /** Get all token costs (action costs) */
    getTokenCosts: adminProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(tokenCosts).orderBy(tokenCosts.action);
    }),

    /** Update a token cost */
    updateTokenCost: adminProcedure
      .input(
        z.object({
          action: z.string(),
          cost: z.number().int().min(0).max(100),
          label: z.string().optional(),
          isEnabled: z.number().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db
          .update(tokenCosts)
          .set({
            cost: input.cost,
            ...(input.label !== undefined ? { label: input.label } : {}),
            ...(input.isEnabled !== undefined ? { isEnabled: input.isEnabled } : {}),
          })
          .where(eq(tokenCosts.action, input.action));
        invalidateTokenCostsCache();
        return { success: true };
      }),

    /** Add a new package */
    addPackage: adminProcedure
      .input(z.object({
        packageId: z.string().min(1).max(32),
        label: z.string().min(1).max(64),
        tokenAmount: z.number().int().min(1),
        priceUSD: z.string(),
        priceEUR: z.string(),
        priceILS: z.string(),
        priceGBP: z.string(),
        priceAUD: z.string(),
        priceCAD: z.string(),
        priceJPY: z.string(),
        enabledCurrencies: z.string().nullable().optional(),
        discountPercent: z.number().int().min(0).max(100).optional(),
        badge: z.enum(["recommended", "best_value", "sale", "trial"]).nullable().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db.insert(packagePrices).values({
          packageId: input.packageId,
          label: input.label,
          tokenAmount: input.tokenAmount,
          priceUSD: input.priceUSD,
          priceEUR: input.priceEUR,
          priceILS: input.priceILS,
          priceGBP: input.priceGBP,
          priceAUD: input.priceAUD,
          priceCAD: input.priceCAD,
          priceJPY: input.priceJPY,
          isActive: 1,
          enabledCurrencies: input.enabledCurrencies ?? null,
          discountPercent: input.discountPercent ?? 0,
          badge: input.badge ?? null,
        });
        return { success: true };
      }),

    /** Delete a package */
    deletePackage: adminProcedure
      .input(z.object({ packageId: z.string() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db.delete(packagePrices).where(eq(packagePrices.packageId, input.packageId));
        return { success: true };
      }),

    /** Get contact settings (support email + WhatsApp) */
    getContactSettings: adminProcedure.query(async () => {
      const db = await getDb();
      if (!db) return { supportEmail: "", whatsappNumber: "" };
      const rows = await db.select().from(systemSettings)
        .where(sql`${systemSettings.key} IN ('support_email', 'whatsapp_number')`);
      const map = Object.fromEntries(rows.map(r => [r.key, r.value]));
      return { supportEmail: map["support_email"] ?? "", whatsappNumber: map["whatsapp_number"] ?? "" };
    }),

    /** Update contact settings */
    updateContactSettings: adminProcedure
      .input(z.object({ supportEmail: z.string(), whatsappNumber: z.string() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db.insert(systemSettings).values({ key: "support_email", value: input.supportEmail })
          .onDuplicateKeyUpdate({ set: { value: input.supportEmail } });
        await db.insert(systemSettings).values({ key: "whatsapp_number", value: input.whatsappNumber })
          .onDuplicateKeyUpdate({ set: { value: input.whatsappNumber } });
        return { success: true };
      }),

    /** Update a package price */
    updatePackagePrice: adminProcedure
      .input(
        z.object({
          packageId: z.string(),
          priceUSD: z.string(),
          priceEUR: z.string(),
          priceILS: z.string(),
          priceGBP: z.string(),
          priceAUD: z.string(),
          priceCAD: z.string(),
          priceJPY: z.string(),
          label: z.string().optional(),
          isActive: z.number().optional(),
          enabledCurrencies: z.string().nullable().optional(),
          discountPercent: z.number().int().min(0).max(100).optional(),
          badge: z.enum(["recommended", "best_value", "sale", "trial"]).nullable().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db
          .update(packagePrices)
          .set({
            priceUSD: input.priceUSD,
            priceEUR: input.priceEUR,
            priceILS: input.priceILS,
            priceGBP: input.priceGBP,
            priceAUD: input.priceAUD,
            priceCAD: input.priceCAD,
            priceJPY: input.priceJPY,
            ...(input.label !== undefined ? { label: input.label } : {}),
            ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
            ...(input.enabledCurrencies !== undefined ? { enabledCurrencies: input.enabledCurrencies } : {}),
            ...(input.discountPercent !== undefined ? { discountPercent: input.discountPercent } : {}),
            ...(input.badge !== undefined ? { badge: input.badge } : {}),
          })
          .where(eq(packagePrices.packageId, input.packageId));
        return { success: true };
      }),
  }),

  /** Public token costs — available to all users (for display purposes) */
  tokenCosts: router({
    list: publicProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(tokenCosts).orderBy(tokenCosts.action);
    }),
  }),

  /** Public contact info — support email and WhatsApp */
  contact: router({
    info: publicProcedure.query(async () => {
      const db = await getDb();
      if (!db) return { supportEmail: "", whatsappNumber: "" };
      const rows = await db.select().from(systemSettings)
        .where(sql`${systemSettings.key} IN ('support_email', 'whatsapp_number')`);
      const map = Object.fromEntries(rows.map(r => [r.key, r.value]));
      return { supportEmail: map["support_email"] ?? "", whatsappNumber: map["whatsapp_number"] ?? "" };
    }),
  }),

  /** Public package prices — available to all users */
  packages: router({
    prices: publicProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db
        .select()
        .from(packagePrices)
        .where(eq(packagePrices.isActive, 1))
        .orderBy(packagePrices.tokenAmount);
    }),
  }),

  /** Token balance for the logged-in user */
  tokens: router({
    balance: publicProcedure.query(async ({ ctx }) => {
      const appUser = getAppUserFromCookie(
        (ctx.req as { cookies?: Record<string, string> }).cookies ?? {}
      );
      if (!appUser) return { balance: 0, loggedIn: false };
      const balance = await getTokenBalance(appUser.userId);
      return { balance, loggedIn: true };
    }),

    /** Transaction history for the logged-in user */
    history: publicProcedure.query(async ({ ctx }) => {
      const appUser = getAppUserFromCookie(
        (ctx.req as { cookies?: Record<string, string> }).cookies ?? {}
      );
      if (!appUser) return [];
      return getTokenTransactions(appUser.userId, 50);
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
          groupId: userActions.groupId,
          variationLabel: userActions.variationLabel,
          sourceImageUrl: userActions.sourceImageUrl,
          feature: userActions.feature,
          createdAt: userActions.createdAt,
        })
        .from(userActions)
        .where(eq(userActions.appUserId, appUser.userId))
        .orderBy(desc(userActions.createdAt))
        .limit(200);
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

  // ── Announcement banner (What's New) ─────────────────────────────────────
  announcement: router({
    /** Get the current announcement banner (public) */
    get: publicProcedure.query(async () => {
      const db = await getDb();
      if (!db) return { text: "", enabled: false };
      const [row] = await db
        .select()
        .from(systemSettings)
        .where(eq(systemSettings.key, "announcement_banner"))
        .limit(1);
      if (!row) return { text: "", enabled: false };
      try {
        return JSON.parse(row.value) as { text: string; enabled: boolean };
      } catch {
        return { text: row.value, enabled: true };
      }
    }),
    /** Update the announcement banner (admin only) */
    set: publicProcedure
      .input(z.object({
        text: z.string().max(500),
        enabled: z.boolean(),
        adminPin: z.string(),
      }))
      .mutation(async ({ input }) => {
        if (input.adminPin !== process.env.ADMIN_PIN) {
          throw new TRPCError({ code: "FORBIDDEN", message: "PIN שגוי" });
        }
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const value = JSON.stringify({ text: input.text, enabled: input.enabled });
        await db
          .insert(systemSettings)
          .values({ key: "announcement_banner", value })
          .onDuplicateKeyUpdate({ set: { value } });
        return { success: true };
      }),
  }),

});
export type AppRouter = typeof appRouter;

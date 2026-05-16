import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import jwt from "jsonwebtoken";
import { getSessionCookieOptions } from "./_core/cookies";
import { ENV } from "./_core/env";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { getDailyActivity, getRecentEvents, getUsageStats, TimeRange } from "./usageDb";
import { getDb } from "./db";
import { appUsers, userActions, tokenTransactions, systemSettings, passwordResets, consentRecords, paypalOrders, packagePrices, tokenCosts, campaignRedemptions, subscriptionPlans, userSubscriptions, dailyUsage, bugReports, newsItems, adminTasks, emailVerifications, failedJobs, visitorEvents, contactMessages, issueReports, sharedFiles, freedxfDownloads, userClickEvents } from "../drizzle/schema";
import { randomBytes } from "crypto";
import { sendPasswordResetEmail } from "./emailService";
import { desc, eq, and, sql, gte, like, inArray, isNotNull, ne } from "drizzle-orm";
import { getAppUserFromCookie } from "./appAuth";
import { COUNTRY_NAMES_HE, countryCodeToFlag, getHebrewCountryDisplay } from "./countryNames";
import { getTokenBalance, addTokens, getTokenTransactions, invalidateTokenCostsCache } from "./tokenService";
import { createPayPalOrder, capturePayPalOrder, createPayPalOrderForCardFields } from "./paypal";
import { getPackageById, getPriceForCurrency } from "./products";
import { diagnoseStorageProxy, storagePut } from "./storage";
import { sendPurchaseConfirmationEmail, sendBulkEmail, sendShareApprovedEmail } from "./emailService";
import { notifyOwner } from "./_core/notification";
import { generatePreviewFromSvg } from "./svgPreviewGenerator";

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

/** Check if the request has a valid admin session cookie (JWT-signed) */
function isAdminAuthenticated(req: { headers: Record<string, string | string[] | undefined>; cookies?: Record<string, string> }): boolean {
  const cookies = (req as { cookies?: Record<string, string> }).cookies ?? {};
  const token = cookies[ADMIN_COOKIE];
  if (!token) return false;
  // Legacy plain-text cookie support (transition period)
  if (token === "authenticated") return false; // reject old insecure cookies
  try {
    const secret = ENV.cookieSecret || "fallback-secret";
    const payload = jwt.verify(token, secret) as { role?: string };
    return payload?.role === "admin";
  } catch {
    return false;
  }
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

        // Set a JWT-signed session cookie (httpOnly, 7 days)
        // JWT prevents cookie forgery — only the server with JWT_SECRET can issue valid tokens
        const jwtSecret = ENV.cookieSecret || "fallback-secret";
        const adminToken = jwt.sign(
          { role: "admin", iat: Math.floor(Date.now() / 1000) },
          jwtSecret,
          { expiresIn: "7d" }
        );
        ctx.res.cookie(ADMIN_COOKIE, adminToken, {
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

    /** Recent events list with optional time range filter */
    recentEvents: adminProcedure
      .input(z.object({ timeRange: z.enum(["day", "week", "month", "all"]).default("day") }).optional())
      .query(async ({ input }) => {
        const timeRange: TimeRange = input?.timeRange ?? "day";
        const limit = timeRange === "all" ? 500 : timeRange === "month" ? 500 : 200;
        return getRecentEvents(limit, timeRange);
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
          googleId: appUsers.googleId,
        })
        .from(appUsers)
        .orderBy(desc(appUsers.createdAt))
        .limit(200);
    }),

    /** All user actions (for admin view) */
    userActions: adminProcedure
      .input(z.object({ timeRange: z.enum(["day", "week", "month", "all"]).default("day") }).optional())
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        const timeRange = input?.timeRange ?? "day";
        let cutoff: Date | null = null;
        if (timeRange !== "all") {
          cutoff = new Date();
          if (timeRange === "day") cutoff.setDate(cutoff.getDate() - 1);
          else if (timeRange === "week") cutoff.setDate(cutoff.getDate() - 7);
          else if (timeRange === "month") cutoff.setMonth(cutoff.getMonth() - 1);
        }
        const query = db
          .select({
            id: userActions.id,
            appUserId: userActions.appUserId,
            actionType: userActions.actionType,
            description: userActions.description,
            segmentCount: userActions.segmentCount,
            dxfUrl: userActions.dxfUrl,
            imageUrl: userActions.imageUrl,
            sourceImageUrl: userActions.sourceImageUrl,
            feature: userActions.feature,
            ipAnon: userActions.ipAnon,
            createdAt: userActions.createdAt,
            durationMs: userActions.durationMs,
            status: userActions.status,
            errorMessage: userActions.errorMessage,
            userName: appUsers.name,
            userEmail: appUsers.email,
          })
          .from(userActions)
          .leftJoin(appUsers, eq(userActions.appUserId, appUsers.id));
        const limit = timeRange === "all" ? 500 : timeRange === "month" ? 500 : 200;
        if (cutoff) {
          return query
            .where(gte(userActions.createdAt, cutoff))
            .orderBy(desc(userActions.createdAt))
            .limit(limit);
        }
        return query
          .orderBy(desc(userActions.createdAt))
          .limit(limit);
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
          googleId: appUsers.googleId,
        })
        .from(appUsers)
        .orderBy(desc(appUsers.createdAt))
        .limit(200);
      if (rows.length === 0) return [];
      const userIds = rows.map(r => r.id);
      const idList = userIds.join(",");
      // Last action per user + download/error counts
      const allActions = await db
        .select({
          appUserId: userActions.appUserId,
          actionType: userActions.actionType,
          description: userActions.description,
          dxfUrl: userActions.dxfUrl,
          imageUrl: userActions.imageUrl,
          feature: userActions.feature,
          createdAt: userActions.createdAt,
          status: userActions.status,
          errorMessage: userActions.errorMessage,
        })
        .from(userActions)
        .where(sql`${userActions.appUserId} IN (${sql.raw(idList)})`)
        .orderBy(desc(userActions.createdAt))
        .limit(1000);
      // Count downloads and errors per user
      const downloadCountMap = new Map<number, number>();
      const errorCountMap = new Map<number, number>();
      for (const a of allActions) {
        if (a.actionType === 'download') downloadCountMap.set(a.appUserId, (downloadCountMap.get(a.appUserId) ?? 0) + 1);
        if (a.status === 'failed') errorCountMap.set(a.appUserId, (errorCountMap.get(a.appUserId) ?? 0) + 1);
      }
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
        downloadCount: downloadCountMap.get(r.id) ?? 0,
        errorCount: errorCountMap.get(r.id) ?? 0,
      }));
    }),

    /** Token transactions for a specific user */
    userTokenHistory: adminProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ input }) => {
        return getTokenTransactions(input.userId, 50);
      }),

    /** All download events across all users */
    allDownloads: adminProcedure
      .input(z.object({ limit: z.number().min(1).max(500).default(200) }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const rows = await db
          .select({
            id: userActions.id,
            appUserId: userActions.appUserId,
            description: userActions.description,
            dxfUrl: userActions.dxfUrl,
            imageUrl: userActions.imageUrl,
            feature: userActions.feature,
            createdAt: userActions.createdAt,
            status: userActions.status,
            errorMessage: userActions.errorMessage,
            userName: appUsers.name,
            userEmail: appUsers.email,
          })
          .from(userActions)
          .leftJoin(appUsers, eq(appUsers.id, userActions.appUserId))
          .where(eq(userActions.actionType, 'download'))
          .orderBy(desc(userActions.createdAt))
          .limit(input.limit);
        return rows;
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
      const rows = await db.execute(sql`SELECT \`id\`, \`key\`, \`value\` FROM \`system_settings\` WHERE \`key\` = 'maintenance_mode' LIMIT 1`);
      const row = (rows as unknown as Array<{ key: string; value: string }>)[0];
      return { enabled: row?.value === "1" };
    }),

    /** Toggle maintenance mode on/off */
    setMaintenanceMode: adminProcedure
      .input(z.object({ enabled: z.boolean() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const val = input.enabled ? "1" : "0";
        await db.execute(sql`INSERT INTO \`system_settings\` (\`key\`, \`value\`) VALUES ('maintenance_mode', ${val}) ON DUPLICATE KEY UPDATE \`value\` = ${val}`);
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
          labelHe: z.string().max(64).optional(),
          labelEn: z.string().max(64).optional(),
          descriptionHe: z.string().max(200).optional(),
          descriptionEn: z.string().max(200).optional(),
          sortOrder: z.number().int().optional(),
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
            ...(input.labelHe !== undefined ? { labelHe: input.labelHe } : {}),
            ...(input.labelEn !== undefined ? { labelEn: input.labelEn } : {}),
            ...(input.descriptionHe !== undefined ? { descriptionHe: input.descriptionHe } : {}),
            ...(input.descriptionEn !== undefined ? { descriptionEn: input.descriptionEn } : {}),
            ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
            ...(input.isEnabled !== undefined ? { isEnabled: input.isEnabled } : {}),
          })
          .where(eq(tokenCosts.action, input.action));
        invalidateTokenCostsCache();
        return { success: true };
      }),

    /** Delete a token cost action */
    deleteTokenCost: adminProcedure
      .input(z.object({ action: z.string() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db.delete(tokenCosts).where(eq(tokenCosts.action, input.action));
        invalidateTokenCostsCache();
        return { success: true };
      }),

    /** Add a new token cost action */
    addTokenCost: adminProcedure
      .input(z.object({
        action: z.string().min(1).max(32),
        cost: z.number().int().min(0).max(100),
        labelHe: z.string().max(64).optional(),
        labelEn: z.string().max(64).optional(),
        descriptionHe: z.string().max(200).optional(),
        descriptionEn: z.string().max(200).optional(),
        sortOrder: z.number().int().optional(),
        isEnabled: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db.insert(tokenCosts).values({
          action: input.action,
          cost: input.cost,
          labelHe: input.labelHe ?? null,
          labelEn: input.labelEn ?? null,
          descriptionHe: input.descriptionHe ?? null,
          descriptionEn: input.descriptionEn ?? null,
          sortOrder: input.sortOrder ?? 0,
          isEnabled: input.isEnabled ?? 1,
        });
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
        imageUrl: z.string().url().nullable().optional(),
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
          imageUrl: input.imageUrl ?? null,
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

    /** Get contact settings (support email + WhatsApp + phone) */
    getContactSettings: adminProcedure.query(async () => {
      const db = await getDb();
      if (!db) return { supportEmail: "", whatsappNumber: "", contactPhone: "" };
      const result = await db.execute(sql`SELECT \`key\`, \`value\` FROM \`system_settings\` WHERE \`key\` IN ('support_email', 'whatsapp_number', 'contact_phone')`);
      const actualRows = (Array.isArray(result) && Array.isArray(result[0])) ? result[0] : result;
      const map = Object.fromEntries((actualRows as unknown as Array<{ key: string; value: string }>).map(r => [r.key, r.value]));
      return { supportEmail: map["support_email"] ?? "", whatsappNumber: map["whatsapp_number"] ?? "", contactPhone: map["contact_phone"] ?? "" };
    }),

    /** Update contact settings */
    updateContactSettings: adminProcedure
      .input(z.object({ supportEmail: z.string(), whatsappNumber: z.string(), contactPhone: z.string().optional() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db.execute(sql`INSERT INTO \`system_settings\` (\`key\`, \`value\`) VALUES ('support_email', ${input.supportEmail}) ON DUPLICATE KEY UPDATE \`value\` = ${input.supportEmail}`);
        await db.execute(sql`INSERT INTO \`system_settings\` (\`key\`, \`value\`) VALUES ('whatsapp_number', ${input.whatsappNumber}) ON DUPLICATE KEY UPDATE \`value\` = ${input.whatsappNumber}`);
        await db.execute(sql`INSERT INTO \`system_settings\` (\`key\`, \`value\`) VALUES ('contact_phone', ${input.contactPhone ?? ""}) ON DUPLICATE KEY UPDATE \`value\` = ${input.contactPhone ?? ""}`);
        return { success: true };
      }),

    /** Get campaign redemption report — who clicked the email link and claimed bonus */
    getCampaignRedemptions: adminProcedure
      .input(z.object({ campaignCode: z.string().optional() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const rows = await db
          .select({
            id: campaignRedemptions.id,
            campaignCode: campaignRedemptions.campaignCode,
            tokensAwarded: campaignRedemptions.tokensAwarded,
            redeemedAt: campaignRedemptions.redeemedAt,
            userName: appUsers.name,
            userEmail: appUsers.email,
          })
          .from(campaignRedemptions)
          .leftJoin(appUsers, eq(campaignRedemptions.appUserId, appUsers.id))
          .where(input.campaignCode ? eq(campaignRedemptions.campaignCode, input.campaignCode) : sql`1=1`)
          .orderBy(desc(campaignRedemptions.redeemedAt))
          .limit(200);
        return rows;
      }),
    /** Send a bulk email to all registered users with a verified email */
    sendBulkEmail: adminProcedure
      .input(z.object({
        subject: z.string().min(1).max(200),
        htmlBody: z.string().min(1).max(50000),
        plainText: z.string().max(10000).optional(),
        testOnly: z.boolean().optional(), // if true, send only to first user (preview)
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        // Get all users with a verified email
        const users = await db
          .select({ id: appUsers.id, email: appUsers.email, name: appUsers.name })
          .from(appUsers)
          .where(sql`${appUsers.email} IS NOT NULL AND ${appUsers.email} != ''`);
        const targets = input.testOnly ? users.slice(0, 1) : users;
        let sent = 0;
        let failed = 0;
        for (const user of targets) {
          if (!user.email) continue;
          try {
            await sendBulkEmail({
              to: user.email,
              name: user.name,
              subject: input.subject,
              htmlBody: input.htmlBody,
              plainText: input.plainText,
            });
            sent++;
            // Small delay to avoid rate limiting
            await new Promise(r => setTimeout(r, 120));
          } catch (e) {
            console.error(`[bulkEmail] Failed to send to ${user.email}:`, e);
            failed++;
          }
        }
        return { sent, failed, total: targets.length };
      }),

    // ── Subscription plan management (admin) ───────────────────────────────────
    getSubscriptionPlans: adminProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(subscriptionPlans).orderBy(subscriptionPlans.sortOrder);
    }),

    upsertSubscriptionPlan: adminProcedure
      .input(z.object({
        planId: z.string().min(1).max(32),
        name: z.string().min(1).max(64),
        dailyConversions: z.number().int().min(1),
        priceILS: z.string(),
        priceUSD: z.string(),
        discountPercent: z.number().int().min(0).max(100).optional(),
        badge: z.enum(["recommended", "best_value", "sale"]).nullable().optional(),
        isActive: z.number().int().min(0).max(1).optional(),
        sortOrder: z.number().int().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db
          .insert(subscriptionPlans)
          .values({
            planId: input.planId,
            name: input.name,
            dailyConversions: input.dailyConversions,
            priceILS: input.priceILS,
            priceUSD: input.priceUSD,
            discountPercent: input.discountPercent ?? 0,
            badge: input.badge ?? null,
            isActive: input.isActive ?? 1,
            sortOrder: input.sortOrder ?? 0,
          })
          .onDuplicateKeyUpdate({
            set: {
              name: input.name,
              dailyConversions: input.dailyConversions,
              priceILS: input.priceILS,
              priceUSD: input.priceUSD,
              discountPercent: input.discountPercent ?? 0,
              badge: input.badge ?? null,
              isActive: input.isActive ?? 1,
              sortOrder: input.sortOrder ?? 0,
            },
          });
        return { success: true };
      }),

    deleteSubscriptionPlan: adminProcedure
      .input(z.object({ planId: z.string() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db.delete(subscriptionPlans).where(eq(subscriptionPlans.planId, input.planId));
        return { success: true };
      }),

    /** All active user subscriptions */
    getUserSubscriptions: adminProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db
        .select({
          id: userSubscriptions.id,
          appUserId: userSubscriptions.appUserId,
          planId: userSubscriptions.planId,
          status: userSubscriptions.status,
          periodStart: userSubscriptions.periodStart,
          periodEnd: userSubscriptions.periodEnd,
          adminNote: userSubscriptions.adminNote,
          createdAt: userSubscriptions.createdAt,
          userName: appUsers.name,
          userEmail: appUsers.email,
        })
        .from(userSubscriptions)
        .leftJoin(appUsers, eq(userSubscriptions.appUserId, appUsers.id))
        .orderBy(desc(userSubscriptions.createdAt))
        .limit(200);
    }),

    /** Manually assign a subscription to a user */
    assignSubscription: adminProcedure
      .input(z.object({
        userId: z.number(),
        planId: z.string(),
        months: z.number().int().min(1).max(24).default(1),
        adminNote: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const now = new Date();
        const periodEnd = new Date(now);
        periodEnd.setMonth(periodEnd.getMonth() + input.months);
        // Cancel any existing active subscription
        await db
          .update(userSubscriptions)
          .set({ status: "cancelled" })
          .where(
            and(
              eq(userSubscriptions.appUserId, input.userId),
              eq(userSubscriptions.status, "active")
            )
          );
        await db.insert(userSubscriptions).values({
          appUserId: input.userId,
          planId: input.planId,
          status: "active",
          periodStart: now,
          periodEnd,
          adminNote: input.adminNote ?? `Admin assigned ${input.months} month(s)`,
        });
        return { success: true };
      }),

    /** Cancel a user's subscription */
    cancelSubscription: adminProcedure
      .input(z.object({ subscriptionId: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db
          .update(userSubscriptions)
          .set({ status: "cancelled" })
          .where(eq(userSubscriptions.id, input.subscriptionId));
        return { success: true };
      }),

    // ── Bug reports (admin) ───────────────────────────────────────────────────
    getBugReports: adminProcedure
      .input(z.object({ status: z.string().optional() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        return db
          .select({
            id: bugReports.id,
            appUserId: bugReports.appUserId,
            errorType: bugReports.errorType,
            errorMessage: bugReports.errorMessage,
            feature: bugReports.feature,
            imageUrl: bugReports.imageUrl,
            status: bugReports.status,
            adminNote: bugReports.adminNote,
            ipAnon: bugReports.ipAnon,
            createdAt: bugReports.createdAt,
            userName: appUsers.name,
            userEmail: appUsers.email,
          })
          .from(bugReports)
          .leftJoin(appUsers, eq(bugReports.appUserId, appUsers.id))
          .where(input.status ? eq(bugReports.status, input.status) : sql`1=1`)
          .orderBy(desc(bugReports.createdAt))
          .limit(200);
      }),

    updateBugStatus: adminProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(["new", "investigating", "resolved", "ignored"]),
        adminNote: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db
          .update(bugReports)
          .set({
            status: input.status,
            ...(input.adminNote !== undefined ? { adminNote: input.adminNote } : {}),
          })
          .where(eq(bugReports.id, input.id));
        return { success: true };
      }),

    // ── News items management (admin) ────────────────────────────────────────────
    getNewsItems: adminProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db
        .select()
        .from(newsItems)
        .orderBy(desc(newsItems.sortOrder), desc(newsItems.createdAt));
    }),

    upsertNewsItem: adminProcedure
      .input(z.object({
        id: z.number().optional(),
        title: z.string().min(1).max(200),
        content: z.string().min(1),
        emoji: z.string().max(8).optional(),
        isPublished: z.number().int().min(0).max(1).optional(),
        sortOrder: z.number().int().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        if (input.id) {
          await db
            .update(newsItems)
            .set({
              title: input.title,
              content: input.content,
              emoji: input.emoji ?? null,
              isPublished: input.isPublished ?? 1,
              sortOrder: input.sortOrder ?? 0,
            })
            .where(eq(newsItems.id, input.id));
        } else {
          await db.insert(newsItems).values({
            title: input.title,
            content: input.content,
            emoji: input.emoji ?? null,
            isPublished: input.isPublished ?? 1,
            sortOrder: input.sortOrder ?? 0,
          });
        }
        return { success: true };
      }),

    deleteNewsItem: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db.delete(newsItems).where(eq(newsItems.id, input.id));
        return { success: true };
      }),

    // ── Enhanced user list with subscription info ──────────────────────────────────
    usersEnhanced: adminProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db
        .select({
          id: appUsers.id,
          name: appUsers.name,
          email: appUsers.email,
          tokenBalance: appUsers.tokenBalance,
          isBlocked: appUsers.isBlocked,
          emailVerified: appUsers.emailVerified,
          createdAt: appUsers.createdAt,
          lastLoginAt: appUsers.lastLoginAt,
          googleId: appUsers.googleId,
          registrationSource: appUsers.registrationSource,
          language: appUsers.language,
        })
        .from(appUsers)
        .orderBy(desc(appUsers.createdAt))
        .limit(500);
      if (rows.length === 0) return [];
      const userIds = rows.map(r => r.id);
      const idList = userIds.join(",");
      // Last action per user
      const allActions = await db
        .select({
          appUserId: userActions.appUserId,
          actionType: userActions.actionType,
          feature: userActions.feature,
          createdAt: userActions.createdAt,
        })
        .from(userActions)
        .where(sql`${userActions.appUserId} IN (${sql.raw(idList)})`)
        .orderBy(desc(userActions.createdAt))
        .limit(1000);
      // Active subscriptions
      const now = new Date();
      const activeSubs = await db
        .select({
          appUserId: userSubscriptions.appUserId,
          planId: userSubscriptions.planId,
          periodEnd: userSubscriptions.periodEnd,
        })
        .from(userSubscriptions)
        .where(
          and(
            sql`${userSubscriptions.appUserId} IN (${sql.raw(idList)})`,
            eq(userSubscriptions.status, "active"),
            sql`${userSubscriptions.periodEnd} > ${now}`
          )
        );
      const lastActionMap = new Map<number, typeof allActions[0]>();
      for (const a of allActions) {
        if (!lastActionMap.has(a.appUserId)) lastActionMap.set(a.appUserId, a);
      }
      const subMap = new Map<number, typeof activeSubs[0]>();
      for (const s of activeSubs) {
        subMap.set(s.appUserId, s);
      }
      return rows.map(r => ({
        ...r,
        registrationSource: r.registrationSource ?? 'direct',
        lastAction: lastActionMap.get(r.id) ?? null,
        subscription: subMap.get(r.id) ?? null,
      }));
    }),

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
          imageUrl: z.string().nullable().optional(),
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
            ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl } : {}),
          })
          .where(eq(packagePrices.packageId, input.packageId));
        return { success: true };
      }),

    // ── Admin Tasks (todo list) ───────────────────────────────────────────────────────────────
    getTasks: adminProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db
        .select()
        .from(adminTasks)
        .orderBy(adminTasks.sortOrder, adminTasks.createdAt);
    }),

    addTask: adminProcedure
      .input(z.object({
        text: z.string().min(1).max(500),
        priority: z.number().int().min(0).max(2).default(0),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const [result] = await db.insert(adminTasks).values({
          text: input.text.trim(),
          priority: input.priority,
          isDone: 0,
          sortOrder: 0,
        });
        return { id: (result as { insertId: number }).insertId };
      }),

    updateTask: adminProcedure
      .input(z.object({
        id: z.number(),
        text: z.string().min(1).max(500).optional(),
        priority: z.number().int().min(0).max(2).optional(),
        sortOrder: z.number().int().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const updates: Record<string, unknown> = {};
        if (input.text !== undefined) updates.text = input.text.trim();
        if (input.priority !== undefined) updates.priority = input.priority;
        if (input.sortOrder !== undefined) updates.sortOrder = input.sortOrder;
        if (Object.keys(updates).length > 0) {
          await db.update(adminTasks).set(updates).where(eq(adminTasks.id, input.id));
        }
        return { success: true };
      }),

    toggleTask: adminProcedure
      .input(z.object({ id: z.number(), isDone: z.boolean() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db.update(adminTasks)
          .set({ isDone: input.isDone ? 1 : 0 })
          .where(eq(adminTasks.id, input.id));
        return { success: true };
      }),

    deleteTask: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db.delete(adminTasks).where(eq(adminTasks.id, input.id));
        return { success: true };
      }),

    /** Admin-only storage proxy diagnostic for conversion upload/download failures */
    storageDiagnostics: adminProcedure
      .input(z.object({ timeoutMs: z.number().min(1000).max(30000).default(8000) }).optional())
      .mutation(async ({ input }) => {
        return diagnoseStorageProxy(input?.timeoutMs ?? 8000);
      }),

    /** Get recent failed jobs for debugging */
    getFailedJobs: adminProcedure.query(async () => {
      const { getRecentFailedJobs } = await import("./failedJobsDb");
      return getRecentFailedJobs(100);
    }),

    /** Get recent failed/cancelled user actions for the bugs tab */
    getFailedActions: adminProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db
        .select({
          id: userActions.id,
          appUserId: userActions.appUserId,
          actionType: userActions.actionType,
          feature: userActions.feature,
          description: userActions.description,
          durationMs: userActions.durationMs,
          errorMessage: userActions.errorMessage,
          status: userActions.status,
          sourceImageUrl: userActions.sourceImageUrl,
          createdAt: userActions.createdAt,
          userName: appUsers.name,
          userEmail: appUsers.email,
        })
        .from(userActions)
        .leftJoin(appUsers, eq(userActions.appUserId, appUsers.id))
        .where(sql`${userActions.status} IN ('failed', 'cancelled')`)
        .orderBy(desc(userActions.createdAt))
        .limit(100);
      return rows;
    }),

    /** Permanently delete a user and all their data */
    deleteUser: adminProcedure
      .input(z.object({ userId: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const { userId } = input;
        // Delete in dependency order
        await db.delete(tokenTransactions).where(eq(tokenTransactions.appUserId, userId));
        await db.delete(userActions).where(eq(userActions.appUserId, userId));
        await db.delete(emailVerifications).where(eq(emailVerifications.appUserId, userId));
        await db.delete(passwordResets).where(eq(passwordResets.appUserId, userId));
        await db.delete(campaignRedemptions).where(eq(campaignRedemptions.appUserId, userId));
        await db.delete(consentRecords).where(eq(consentRecords.appUserId, userId));
        await db.delete(paypalOrders).where(eq(paypalOrders.appUserId, userId));
        await db.delete(appUsers).where(eq(appUsers.id, userId));
        return { success: true };
      }),
    // Contact messages
    getContactMessages: adminProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(contactMessages).orderBy(desc(contactMessages.createdAt));
    }),
    markContactMessageRead: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) return { success: false };
        await db.update(contactMessages).set({ isRead: 1 }).where(eq(contactMessages.id, input.id));
        return { success: true };
      }),
    deleteContactMessage: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) return { success: false };
        await db.delete(contactMessages).where(eq(contactMessages.id, input.id));
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
      if (!db) return { supportEmail: "", whatsappNumber: "", contactPhone: "" };
      const result = await db.execute(sql`SELECT \`key\`, \`value\` FROM \`system_settings\` WHERE \`key\` IN ('support_email', 'whatsapp_number', 'contact_phone')`);
      const actualRows = (Array.isArray(result) && Array.isArray(result[0])) ? result[0] : result;
      const map = Object.fromEntries((actualRows as unknown as Array<{ key: string; value: string }>).map(r => [r.key, r.value]));
      return { supportEmail: map["support_email"] ?? "", whatsappNumber: map["whatsapp_number"] ?? "", contactPhone: map["contact_phone"] ?? "" };
    }),
    sendMessage: publicProcedure
      .input(z.object({
        name: z.string().min(1).max(100),
        message: z.string().min(1).max(1000),
        email: z.string().email().optional(),
        phone: z.string().max(30).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        // Save to DB
        if (db) {
          const ip = getClientIp(ctx.req);
          const ipAnon = ip.split('.').slice(0, 3).join('.') + '.x';
          await db.insert(contactMessages).values({
            name: input.name,
            email: input.email ?? null,
            message: input.message,
            isRead: 0,
            ipAnon,
          });
        }
        // Also notify owner
        const content = [
          `👤 שם: ${input.name}`,
          input.email ? `📧 מייל: ${input.email}` : null,
          input.phone ? `📱 טלפון: ${input.phone}` : null,
          `💬 הודעה: ${input.message}`,
        ].filter(Boolean).join('\n');
        await notifyOwner({ title: `📩 הודעה חדשה מ-${input.name}`, content });
        return { success: true };
      }),
    // Admin: list all messages
    listMessages: publicProcedure
      .input(z.object({ adminPin: z.string() }))
      .query(async ({ input }) => {
        if (input.adminPin !== ENV.adminPin) throw new TRPCError({ code: 'FORBIDDEN' });
        const db = await getDb();
        if (!db) return [];
        return db.select().from(contactMessages).orderBy(desc(contactMessages.createdAt));
      }),
    // Admin: mark message as read
    markRead: publicProcedure
      .input(z.object({ adminPin: z.string(), id: z.number() }))
      .mutation(async ({ input }) => {
        if (input.adminPin !== ENV.adminPin) throw new TRPCError({ code: 'FORBIDDEN' });
        const db = await getDb();
        if (!db) return { success: false };
        await db.update(contactMessages).set({ isRead: 1 }).where(eq(contactMessages.id, input.id));
        return { success: true };
      }),
    // Admin: delete message
    deleteMessage: publicProcedure
      .input(z.object({ adminPin: z.string(), id: z.number() }))
      .mutation(async ({ input }) => {
        if (input.adminPin !== ENV.adminPin) throw new TRPCError({ code: 'FORBIDDEN' });
        const db = await getDb();
        if (!db) return { success: false };
        await db.delete(contactMessages).where(eq(contactMessages.id, input.id));
        return { success: true };
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
      const WELCOME_CAMPAIGN = "welcome_bonus_2026";
      // Helper: check if user has already claimed the welcome bonus
      async function hasClaimedWelcome(userId: number): Promise<boolean> {
        const db = await getDb();
        if (!db) return true; // assume claimed if DB unavailable
        const [row] = await db
          .select({ id: campaignRedemptions.id })
          .from(campaignRedemptions)
          .where(and(eq(campaignRedemptions.appUserId, userId), eq(campaignRedemptions.campaignCode, WELCOME_CAMPAIGN)))
          .limit(1);
        return !!row;
      }
      // Helper: check if user registered with email (not Google OAuth)
      // Only email-registered users receive the welcome email with the bonus link
      async function registeredWithEmail(userId: number): Promise<boolean> {
        const db = await getDb();
        if (!db) return false;
        const [row] = await db
          .select({ passwordHash: appUsers.passwordHash })
          .from(appUsers)
          .where(eq(appUsers.id, userId))
          .limit(1);
        return !!row?.passwordHash; // has password = registered via email form
      }
      // Try app_user_session cookie first
      const appUser = getAppUserFromCookie(
        (ctx.req as { cookies?: Record<string, string> }).cookies ?? {}
      );
      // Helper: count how many actions the user has performed (capped at 3 for efficiency)
      async function getActionCount(userId: number): Promise<number> {
        const db = await getDb();
        if (!db) return 0;
        const rows = await db
          .select({ id: userActions.id })
          .from(userActions)
          .where(eq(userActions.appUserId, userId))
          .limit(3);
        return rows.length;
      }
      if (appUser) {
        const balance = await getTokenBalance(appUser.userId);
        const [claimed, isEmailUser, actionCount] = await Promise.all([
          hasClaimedWelcome(appUser.userId),
          registeredWithEmail(appUser.userId),
          getActionCount(appUser.userId),
        ]);
        // Only show pending bonus if: registered with email AND not yet claimed
        return { balance, loggedIn: true, hasPendingWelcomeBonus: isEmailUser && !claimed, hasAnyAction: actionCount > 0, actionCount };
      }
      // Fallback: Manus OAuth user (no welcome email sent)
      if (ctx.user?.email) {
        const db = await getDb();
        if (!db) return { balance: 0, loggedIn: false, hasPendingWelcomeBonus: false, hasAnyAction: false, actionCount: 0 };
        const [existingAppUser] = await db
          .select({ id: appUsers.id })
          .from(appUsers)
          .where(eq(appUsers.email, ctx.user.email));
        if (!existingAppUser) return { balance: 0, loggedIn: true, hasPendingWelcomeBonus: false, hasAnyAction: false, actionCount: 0 };
        const [balance, actionCount] = await Promise.all([
          getTokenBalance(existingAppUser.id),
          getActionCount(existingAppUser.id),
        ]);
        // Manus OAuth users don't get the welcome email, so no pending bonus
        return { balance, loggedIn: true, hasPendingWelcomeBonus: false, hasAnyAction: actionCount > 0, actionCount };
      }
      return { balance: 0, loggedIn: false, hasPendingWelcomeBonus: false, hasAnyAction: false, actionCount: 0 };
    }),
    /** Transaction history for the logged-in user */
    history: publicProcedure.query(async ({ ctx }) => {
      const appUser = getAppUserFromCookie(
        (ctx.req as { cookies?: Record<string, string> }).cookies ?? {}
      );
      if (appUser) return getTokenTransactions(appUser.userId, 50);
      // Fallback: Manus OAuth user
      if (ctx.user?.email) {
        const db = await getDb();
        if (!db) return [];
        const [existingAppUser] = await db
          .select({ id: appUsers.id })
          .from(appUsers)
          .where(eq(appUsers.email, ctx.user.email));
        if (!existingAppUser) return [];
        return getTokenTransactions(existingAppUser.id, 50);
      }
      return [];
    }),
  }),

  /** PayPal payment procedures — work with both Manus OAuth and app_user_session */
  paypal: router({
    createOrder: publicProcedure
      .input(z.object({
        packageId: z.string(),
        currency: z.string().default("USD"),
        termsAccepted: z.boolean(),
        origin: z.string().optional(),
        useCard: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!input.termsAccepted) throw new TRPCError({ code: "BAD_REQUEST", message: "יש לאשר את תנאי הרכישה" });
        // Resolve appUser from Manus OAuth ctx.user or cookie
        let appUserId: number;
        let appUserEmail: string;
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "שגיאת מסד נתונים" });
        if (ctx.user?.email) {
          // Manus OAuth user — find or create appUser by email
          let [existingAppUser] = await db
            .select({ id: appUsers.id, email: appUsers.email })
            .from(appUsers)
            .where(eq(appUsers.email, ctx.user.email));
          if (!existingAppUser) {
            await db.insert(appUsers).values({
              email: ctx.user.email,
              name: ctx.user.name ?? null,
              tokenBalance: 20,
              emailVerified: 1,
            });
            [existingAppUser] = await db
              .select({ id: appUsers.id, email: appUsers.email })
              .from(appUsers)
              .where(eq(appUsers.email, ctx.user.email!));
          }
          if (!existingAppUser) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "שגיאה ביצירת משתמש" });
          appUserId = existingAppUser.id;
          appUserEmail = existingAppUser.email;
        } else {
          const cookieUser = getAppUserFromCookie((ctx.req as { cookies?: Record<string, string> }).cookies ?? {});
          if (!cookieUser) throw new TRPCError({ code: "UNAUTHORIZED", message: "התחבר כדי לרכוש אסימונים" });
          appUserId = cookieUser.userId;
          appUserEmail = cookieUser.email;
        }
        // Resolve package price
        let resolvedAmount: string;
        let resolvedCurrency: string;
        let resolvedTokens: number;
        const [dbPkg] = await db.select().from(packagePrices).where(eq(packagePrices.packageId, input.packageId));
        if (dbPkg) {
          resolvedTokens = dbPkg.tokenAmount;
          const currencyMap: Record<string, string> = {
            USD: dbPkg.priceUSD, EUR: dbPkg.priceEUR, ILS: dbPkg.priceILS,
            GBP: dbPkg.priceGBP, AUD: dbPkg.priceAUD, CAD: dbPkg.priceCAD, JPY: dbPkg.priceJPY,
          };
          resolvedAmount = currencyMap[input.currency] ?? dbPkg.priceUSD;
          resolvedCurrency = currencyMap[input.currency] ? input.currency : "USD";
        } else {
          const pkg = getPackageById(input.packageId);
          if (!pkg) throw new TRPCError({ code: "BAD_REQUEST", message: "חבילה לא קיימת" });
          const price = getPriceForCurrency(pkg, input.currency);
          resolvedAmount = price.amount;
          resolvedCurrency = price.currency;
          resolvedTokens = pkg.tokens;
        }
        const safeOrigin = input.origin ?? "https://dxfai.ai";
        const paypalOrder = await createPayPalOrder({
          packageId: input.packageId,
          tokens: resolvedTokens,
          amount: resolvedAmount,
          currency: resolvedCurrency,
          userId: appUserId,
          returnUrl: `${safeOrigin}/buy/success`,
          cancelUrl: `${safeOrigin}/buy?cancelled=1`,
          useCard: input.useCard ?? false,
        });
        const amountCentsValue = Math.round(parseFloat(resolvedAmount) * 100);
        await db.insert(paypalOrders).values({
          appUserId,
          paypalOrderId: paypalOrder.id,
          packageId: input.packageId,
          tokenAmount: resolvedTokens,
          priceAmount: resolvedAmount,
          amountCents: amountCentsValue,
          currency: resolvedCurrency,
          status: "pending",
          tokensCredited: 0,
          termsAccepted: 1,
          ipAnon: "",
        });
        const approvalLink = paypalOrder.links.find((l) => l.rel === "approve" || l.rel === "payer-action");
        return { orderId: paypalOrder.id, approvalUrl: approvalLink?.href };
      }),

    /** Create order specifically for JS SDK Card Fields (no payment_source) */
    createOrderForCardFields: publicProcedure
      .input(z.object({
        packageId: z.string(),
        currency: z.string().default("USD"),
        termsAccepted: z.boolean(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!input.termsAccepted) throw new TRPCError({ code: "BAD_REQUEST", message: "יש לאשר את תנאי הרכישה" });
        let appUserId: number;
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "שגיאת מסד נתונים" });
        if (ctx.user?.email) {
          let [existingAppUser] = await db.select({ id: appUsers.id }).from(appUsers).where(eq(appUsers.email, ctx.user.email));
          if (!existingAppUser) {
            await db.insert(appUsers).values({ email: ctx.user.email, name: ctx.user.name ?? null, tokenBalance: 20, emailVerified: 1 });
            [existingAppUser] = await db.select({ id: appUsers.id }).from(appUsers).where(eq(appUsers.email, ctx.user.email!));
          }
          if (!existingAppUser) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
          appUserId = existingAppUser.id;
        } else {
          const cookieUser = getAppUserFromCookie((ctx.req as { cookies?: Record<string, string> }).cookies ?? {});
          if (!cookieUser) throw new TRPCError({ code: "UNAUTHORIZED", message: "התחבר כדי לרכוש אסימונים" });
          appUserId = cookieUser.userId;
        }
        // Resolve package price
        let resolvedAmount: string;
        let resolvedCurrency: string;
        let resolvedTokens: number;
        const [dbPkg] = await db.select().from(packagePrices).where(eq(packagePrices.packageId, input.packageId));
        if (dbPkg) {
          resolvedTokens = dbPkg.tokenAmount;
          const currencyMap: Record<string, string> = { USD: dbPkg.priceUSD, EUR: dbPkg.priceEUR, ILS: dbPkg.priceILS, GBP: dbPkg.priceGBP, AUD: dbPkg.priceAUD, CAD: dbPkg.priceCAD, JPY: dbPkg.priceJPY };
          resolvedAmount = currencyMap[input.currency] ?? dbPkg.priceUSD;
          resolvedCurrency = currencyMap[input.currency] ? input.currency : "USD";
        } else {
          const pkg = getPackageById(input.packageId);
          if (!pkg) throw new TRPCError({ code: "BAD_REQUEST", message: "חבילה לא קיימת" });
          const price = getPriceForCurrency(pkg, input.currency);
          resolvedAmount = price.amount;
          resolvedCurrency = price.currency;
          resolvedTokens = pkg.tokens;
        }
        const paypalOrder = await createPayPalOrderForCardFields({
          packageId: input.packageId,
          tokens: resolvedTokens,
          amount: resolvedAmount,
          currency: resolvedCurrency,
          userId: appUserId,
        });
        const amountCentsValueCard = Math.round(parseFloat(resolvedAmount) * 100);
        await db.insert(paypalOrders).values({
          appUserId,
          paypalOrderId: paypalOrder.id,
          packageId: input.packageId,
          tokenAmount: resolvedTokens,
          priceAmount: resolvedAmount,
          amountCents: amountCentsValueCard,
          currency: resolvedCurrency,
          status: "pending",
          tokensCredited: 0,
          termsAccepted: 1,
          ipAnon: "",
        });
        return { orderId: paypalOrder.id };
      }),

    captureOrder: publicProcedure
      .input(z.object({ orderId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        let appUserId: number;
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        if (ctx.user?.email) {
          const [existingAppUser] = await db
            .select({ id: appUsers.id, email: appUsers.email })
            .from(appUsers)
            .where(eq(appUsers.email, ctx.user.email));
          if (!existingAppUser) throw new TRPCError({ code: "UNAUTHORIZED", message: "לא מחובר" });
          appUserId = existingAppUser.id;
        } else {
          const cookieUser = getAppUserFromCookie((ctx.req as { cookies?: Record<string, string> }).cookies ?? {});
          if (!cookieUser) throw new TRPCError({ code: "UNAUTHORIZED", message: "לא מחובר" });
          appUserId = cookieUser.userId;
        }
        const [dbOrder] = await db.select().from(paypalOrders).where(eq(paypalOrders.paypalOrderId, input.orderId));
        if (!dbOrder) throw new TRPCError({ code: "NOT_FOUND", message: "הזמנה לא נמצאה" });
        if (dbOrder.appUserId !== appUserId) throw new TRPCError({ code: "FORBIDDEN", message: "אין הרשאה" });
        if (dbOrder.status === "completed") {
          return { success: true, alreadyCaptured: true, tokens: dbOrder.tokenAmount, orderId: input.orderId, packageId: dbOrder.packageId, amount: dbOrder.priceAmount, currency: dbOrder.currency, newBalance: await getTokenBalance(appUserId) };
        }
        const capture = await capturePayPalOrder(input.orderId);
        if (capture.status !== "COMPLETED") {
          await db.update(paypalOrders).set({ status: "failed" }).where(eq(paypalOrders.paypalOrderId, input.orderId));
          throw new TRPCError({ code: "BAD_REQUEST", message: `תשלום נכשל: ${capture.status}` });
        }
        if (!dbOrder.tokensCredited) {
          await addTokens(appUserId, dbOrder.tokenAmount, "paypal_purchase", `PayPal order ${input.orderId}`);
        }
        await db.update(paypalOrders).set({ status: "completed", tokensCredited: 1, completedAt: new Date() }).where(eq(paypalOrders.paypalOrderId, input.orderId));
        try {
          const [userRow] = await db.select({ name: appUsers.name, email: appUsers.email }).from(appUsers).where(eq(appUsers.id, appUserId));
          if (userRow?.email) {
            void sendPurchaseConfirmationEmail({ to: userRow.email, name: userRow.name ?? null, tokens: dbOrder.tokenAmount, amount: dbOrder.priceAmount, currency: dbOrder.currency, orderId: input.orderId, siteUrl: "https://dxfai.ai", language: "he" });
          }
        } catch { /* ignore email errors */ }
        void notifyOwner({ title: `💰 רכישה חדשה — ${dbOrder.tokenAmount} אסימונים`, content: `לקוח רכש ${dbOrder.tokenAmount} אסימונים תמורת ${dbOrder.priceAmount} ${dbOrder.currency}.` }).catch(() => {});
        const newBalance = await getTokenBalance(appUserId);
        return { success: true, tokens: dbOrder.tokenAmount, orderId: input.orderId, packageId: dbOrder.packageId, amount: dbOrder.priceAmount, currency: dbOrder.currency, newBalance };
      }),
  }),

  /** Purchase history for the logged-in user */
  purchases: router({
    list: publicProcedure.query(async ({ ctx }) => {
      const appUser = getAppUserFromCookie(
        (ctx.req as { cookies?: Record<string, string> }).cookies ?? {}
      );
      if (!appUser) return [];
      const db = await getDb();
      if (!db) return [];
      return db
        .select({
          id: paypalOrders.id,
          paypalOrderId: paypalOrders.paypalOrderId,
          packageId: paypalOrders.packageId,
          tokenAmount: paypalOrders.tokenAmount,
          priceAmount: paypalOrders.priceAmount,
          currency: paypalOrders.currency,
          status: paypalOrders.status,
          createdAt: paypalOrders.createdAt,
          completedAt: paypalOrders.completedAt,
        })
        .from(paypalOrders)
        .where(and(eq(paypalOrders.appUserId, appUser.userId), eq(paypalOrders.status, "completed")))
        .orderBy(desc(paypalOrders.createdAt))
        .limit(50);
    }),
  }),

  /** History — returns the logged-in app user's own actions */
  history: router({
    list: publicProcedure
      .input(z.object({
        period: z.enum(["day", "week", "month", "all"]).default("week"),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(50).default(20),
      }).optional())
      .query(async ({ ctx, input }) => {
      const appUser = getAppUserFromCookie(
        (ctx.req as { cookies?: Record<string, string> }).cookies ?? {}
      );
      if (!appUser) return { items: [], total: 0, page: 1, pageSize: 20, hasMore: false };
      const db = await getDb();
      if (!db) return { items: [], total: 0, page: 1, pageSize: 20, hasMore: false };
      const period = input?.period ?? "week";
      const page = input?.page ?? 1;
      const pageSize = input?.pageSize ?? 20;
      const offset = (page - 1) * pageSize;
      const now = Date.now();
      const periodMs: Record<string, number> = {
        day: 24 * 60 * 60 * 1000,
        week: 7 * 24 * 60 * 60 * 1000,
        month: 30 * 24 * 60 * 60 * 1000,
      };
      // Only show completed items (status=success) that have actual results
      const completedFilter = and(
        ne(userActions.status, "failed"),
        ne(userActions.status, "cancelled"),
        sql`(${userActions.svgPreview} IS NOT NULL OR ${userActions.imageUrl} IS NOT NULL OR ${userActions.dxfUrl} IS NOT NULL)`
      );
      const whereConditions = period === "all"
        ? and(eq(userActions.appUserId, appUser.userId), completedFilter)
        : and(
            eq(userActions.appUserId, appUser.userId),
            gte(userActions.createdAt, new Date(now - periodMs[period])),
            completedFilter
          );
      const [{ count: totalCount }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(userActions)
        .where(whereConditions);
      const total = Number(totalCount);
      const items = await db
        .select({
          id: userActions.id,
          actionType: userActions.actionType,
          description: userActions.description,
          segmentCount: userActions.segmentCount,
          dxfUrl: userActions.dxfUrl,
          svgUrl: userActions.svgUrl,
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
        .where(whereConditions)
        .orderBy(desc(userActions.createdAt))
        .limit(pageSize)
        .offset(offset);
      return { items, total, page, pageSize, hasMore: offset + items.length < total };
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

  // ── Bug reporting (public — frontend logs errors automatically) ─────────────────
  bugs: router({
    report: publicProcedure
      .input(z.object({
        errorType: z.enum(["convert_failed", "ai_failed", "download_failed", "other"]),
        errorMessage: z.string().max(2000).optional(),
        feature: z.string().max(32).optional(),
        imageUrl: z.string().max(1000).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) return { success: false };
        const appUser = getAppUserFromCookie(
          (ctx.req as { cookies?: Record<string, string> }).cookies ?? {}
        );
        const req = ctx.req as { headers: Record<string, string | string[] | undefined>; socket?: { remoteAddress?: string } };
        const rawIp: string = (req.headers["cf-connecting-ip"] as string) ||
          (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
          req.socket?.remoteAddress ||
          "";
        // Anonymize: keep first 3 octets only
        const ipAnon = rawIp.replace(/(\d+\.\d+\.\d+)\.\d+/, "$1.x");
        await db.insert(bugReports).values({
          appUserId: appUser?.userId ?? null,
          errorType: input.errorType,
          errorMessage: input.errorMessage ?? null,
          feature: input.feature ?? null,
          imageUrl: input.imageUrl ?? null,
          ipAnon,
          status: "new",
        });
        return { success: true };
      }),
  }),

  // ── Subscription plans (public) ──────────────────────────────────────────
  subscriptions: router({
    /** Get all active subscription plans (public) */
    plans: publicProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db
        .select()
        .from(subscriptionPlans)
        .where(eq(subscriptionPlans.isActive, 1))
        .orderBy(subscriptionPlans.sortOrder);
    }),

    /** Get the current user's active subscription */
    mySubscription: publicProcedure.query(async ({ ctx }) => {
      const appUser = getAppUserFromCookie(
        (ctx.req as { cookies?: Record<string, string> }).cookies ?? {}
      );
      if (!appUser) return null;
      const db = await getDb();
      if (!db) return null;
      const now = new Date();
      const [sub] = await db
        .select()
        .from(userSubscriptions)
        .where(
          and(
            eq(userSubscriptions.appUserId, appUser.userId),
            eq(userSubscriptions.status, "active"),
            sql`${userSubscriptions.periodEnd} > ${now}`
          )
        )
        .orderBy(desc(userSubscriptions.periodEnd))
        .limit(1);
      if (!sub) return null;
      // Get today's usage
      const today = new Date().toISOString().slice(0, 10);
      const [usage] = await db
        .select()
        .from(dailyUsage)
        .where(
          and(
            eq(dailyUsage.appUserId, appUser.userId),
            eq(dailyUsage.usageDate, today)
          )
        )
        .limit(1);
      // Get plan details
      const [plan] = await db
        .select()
        .from(subscriptionPlans)
        .where(eq(subscriptionPlans.planId, sub.planId))
        .limit(1);
      return {
        ...sub,
        plan: plan ?? null,
        todayUsed: usage?.conversionsUsed ?? 0,
        todayLimit: plan?.dailyConversions ?? 0,
      };
    }),
  }),

  // ── News items (What's New widget) ──────────────────────────────────────────
  news: router({
    /** Get published news items (public) */
    list: publicProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db
        .select()
        .from(newsItems)
        .where(eq(newsItems.isPublished, 1))
        .orderBy(desc(newsItems.sortOrder), desc(newsItems.createdAt))
        .limit(10);
    }),
  }),

  // ── Announcement banner (What's New) ─────────────────────────────────────
  announcement: router({
    /** Get the current announcement banner (public) */
    get: publicProcedure.query(async () => {
      const db = await getDb();
      if (!db) return { text: "", enabled: false };
      const rows = await db.execute(sql`SELECT \`key\`, \`value\` FROM \`system_settings\` WHERE \`key\` = 'announcement_banner' LIMIT 1`);
      const row = (rows as unknown as Array<{ key: string; value: string }>)[0];
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
        await db.execute(sql`INSERT INTO \`system_settings\` (\`key\`, \`value\`) VALUES ('announcement_banner', ${value}) ON DUPLICATE KEY UPDATE \`value\` = ${value}`);
        return { success: true };
      }),
  }),

  /** Track a file download — called from the frontend when user downloads DXF/PDF */
  trackDownload: publicProcedure
    .input(z.object({
      /** The user action ID this download relates to (optional) */
      userActionId: z.number().optional(),
      /** Feature that produced the file: convert | ai_trace | ai_generate | portrait | document_redraw */
      feature: z.string().max(32).optional(),
      /** File format: dxf | dxf-legacy | pdf */
      fileFormat: z.string().max(16).optional(),
      /** DXF file URL */
      dxfUrl: z.string().max(2048).optional(),
      /** Source image URL */
      imageUrl: z.string().max(2048).optional(),
      /** Description / filename */
      description: z.string().max(200).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const user = getAppUserFromCookie((ctx.req as {cookies?: Record<string, string>}).cookies);
        if (!user) return { success: false }; // only log for authenticated users
        const db = await getDb();
        if (!db) return { success: false };
        await db.insert(userActions).values({
          appUserId: user.userId,
          actionType: 'download',
          description: input.description ?? input.fileFormat ?? 'download',
          feature: input.feature ?? null,
          dxfUrl: input.dxfUrl ?? null,
          imageUrl: input.imageUrl ?? null,
          status: 'success',
          ipAnon: (() => {
            const forwarded = ctx.req.headers['x-forwarded-for'];
            const raw = Array.isArray(forwarded) ? forwarded[0] : (forwarded ?? (ctx.req as {socket?: {remoteAddress?: string}}).socket?.remoteAddress ?? '');
            const ip = raw.split(',')[0].trim();
            const parts = ip.split('.');
            if (parts.length === 4) { parts[3] = '0'; return parts.join('.'); }
            return ip.slice(0, ip.lastIndexOf(':') + 1) + '0';
          })(),
        });
        return { success: true };
      } catch {
        return { success: false };
      }
    }),

  /** Visitor analytics */
  visitors: router({
    /** Track a page visit or behavior event (public, fire-and-forget) */
    track: publicProcedure
      .input(z.object({
        sessionId: z.string().max(64),
        page: z.string().max(256).default("/"),
        referrer: z.string().max(512).optional(),
        userAgent: z.string().max(256).optional(),
        utmSource: z.string().max(128).optional(),
        utmMedium: z.string().max(128).optional(),
        utmCampaign: z.string().max(128).optional(),
        device: z.string().max(16).optional(),
        browser: z.string().max(32).optional(),
        eventType: z.string().max(32).default("pageview"),
        element: z.string().max(64).optional(),
        timeOnPageSec: z.number().int().optional(),
        bounced: z.number().int().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          const db = await getDb();
          if (!db) return { ok: true };
          const appUserCookie = getAppUserFromCookie((ctx.req as { cookies?: Record<string, string> }).cookies);
          const rawIp = getClientIp(ctx.req as Parameters<typeof getClientIp>[0]);
          const ipParts = rawIp.split(".");
          const ipAnon = ipParts.length >= 3 ? ipParts.slice(0, 3).join(".") : rawIp.substring(0, 15);
          let country: string | null = null;
          try {
            const cfCountry = (ctx.req.headers as Record<string, string | string[] | undefined>)["cf-ipcountry"];
            if (cfCountry && typeof cfCountry === "string" && cfCountry.length === 2 && cfCountry !== "XX") {
              country = cfCountry.toUpperCase();
            } else if (rawIp && rawIp !== "unknown" && !rawIp.startsWith("127.") && !rawIp.startsWith("::1") && !rawIp.startsWith("10.") && !rawIp.startsWith("192.168.")) {
              const geoRes = await fetch(`http://ip-api.com/json/${encodeURIComponent(rawIp)}?fields=countryCode`, {
                signal: AbortSignal.timeout(3000),
              });
              if (geoRes.ok) {
                const geoData = await geoRes.json() as { countryCode?: string };
                if (geoData.countryCode && geoData.countryCode.length === 2) {
                  country = geoData.countryCode.toUpperCase();
                }
              }
            }
          } catch { /* ignore */ }
          await db.insert(visitorEvents).values({
            sessionId: input.sessionId,
            appUserId: appUserCookie?.userId ?? null,
            page: input.page,
            country,
            ipAnon,
            referrer: input.referrer ?? null,
            userAgent: input.userAgent?.substring(0, 256) ?? null,
            utmSource: input.utmSource ?? null,
            utmMedium: input.utmMedium ?? null,
            utmCampaign: input.utmCampaign ?? null,
            device: input.device ?? null,
            browser: input.browser ?? null,
            eventType: input.eventType,
            element: input.element ?? null,
            timeOnPageSec: input.timeOnPageSec ?? null,
            bounced: input.bounced ?? 0,
          });
        } catch { /* fire-and-forget, never throw */ }
        return { ok: true };
      }),
    /** Get visitor analytics (admin only) */
    stats: adminProcedure
      .input(z.object({ days: z.number().int().min(1).max(90).default(7) }).optional())
      .query(async ({ input }) => {
        const db = await getDb();
        const days = input?.days ?? 7;
        const emptyResult = { total: 0, today: 0, byCountry: [] as {country:string,count:number}[], byPage: [] as {page:string,count:number}[], recentSessions: 0, bySource: [] as {source:string,count:number}[], byDevice: [] as {device:string,count:number}[], byBrowser: [] as {browser:string,count:number}[], bounceRate: 0, avgTimeOnPage: 0, funnelData: [] as {step:string,count:number}[], dailyVisits: [] as {date:string,sessions:number,pageviews:number}[], recentSessionsList: [] as {sessionId:string,country:string,device:string|null,browser:string|null,referrer:string|null,utmSource:string|null,page:string,timeOnPageSec:number|null,bounced:number|null,appUserId:number|null,createdAt:string}[] };
        if (!db) return emptyResult;
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const rangeStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
        try {

        // Total pageviews
        const [totalRow] = await db.select({ count: sql<number>`COUNT(*)` }).from(visitorEvents);
        const [todayRow] = await db.select({ count: sql<number>`COUNT(*)` }).from(visitorEvents)
          .where(sql`${visitorEvents.createdAt} >= ${todayStart}`);

        // Unique sessions in range
        const [uniqueSessionsRow] = await db.select({ count: sql<number>`COUNT(DISTINCT ${visitorEvents.sessionId})` })
          .from(visitorEvents).where(sql`${visitorEvents.createdAt} >= ${rangeStart}`);

        // By country
        const byCountry = await db.select({
          country: visitorEvents.country,
          count: sql<number>`COUNT(DISTINCT ${visitorEvents.sessionId})`,
        }).from(visitorEvents)
          .where(sql`${visitorEvents.createdAt} >= ${rangeStart}`)
          .groupBy(visitorEvents.country)
          .orderBy(sql`COUNT(DISTINCT ${visitorEvents.sessionId}) DESC`).limit(20);

        // By page
        const byPage = await db.select({
          page: visitorEvents.page,
          count: sql<number>`COUNT(DISTINCT ${visitorEvents.sessionId})`,
        }).from(visitorEvents)
          .where(sql`${visitorEvents.createdAt} >= ${rangeStart} AND ${visitorEvents.eventType} = 'pageview'`)
          .groupBy(visitorEvents.page)
          .orderBy(sql`COUNT(DISTINCT ${visitorEvents.sessionId}) DESC`).limit(20);

        // By traffic source (referrer/UTM)
        // Fetch raw source data and aggregate in JS to avoid MySQL GROUP BY CASE limitations
        const rawSourceRows = await db.select({
          utmSource: visitorEvents.utmSource,
          referrer: visitorEvents.referrer,
          sessionId: visitorEvents.sessionId,
        }).from(visitorEvents)
          .where(sql`${visitorEvents.createdAt} >= ${rangeStart}`);

        const getSource = (utmSource: string | null, referrer: string | null): string => {
          if (utmSource && utmSource.trim() !== '') return utmSource;
          if (!referrer || referrer.trim() === '') return 'ישיר';
          if (referrer.includes('google')) return 'Google';
          if (referrer.includes('facebook') || referrer.includes('fb.com')) return 'Facebook';
          if (referrer.includes('instagram')) return 'Instagram';
          if (referrer.includes('whatsapp')) return 'WhatsApp';
          if (referrer.includes('twitter') || referrer.includes('t.co')) return 'Twitter/X';
          if (referrer.includes('linkedin')) return 'LinkedIn';
          if (referrer.includes('youtube')) return 'YouTube';
          return 'אחר';
        };

        const sourceMap = new Map<string, Set<string>>();
        for (const row of rawSourceRows) {
          const src = getSource(row.utmSource, row.referrer);
          if (!sourceMap.has(src)) sourceMap.set(src, new Set());
          if (row.sessionId) sourceMap.get(src)!.add(row.sessionId);
        }
        const bySource = Array.from(sourceMap.entries())
          .map(([source, sessions]) => ({ source, count: sessions.size }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 15);

        // By device
        const byDevice = await db.select({
          device: visitorEvents.device,
          count: sql<number>`COUNT(DISTINCT ${visitorEvents.sessionId})`,
        }).from(visitorEvents)
          .where(sql`${visitorEvents.createdAt} >= ${rangeStart}`)
          .groupBy(visitorEvents.device)
          .orderBy(sql`COUNT(DISTINCT ${visitorEvents.sessionId}) DESC`);

        // By browser
        const byBrowser = await db.select({
          browser: visitorEvents.browser,
          count: sql<number>`COUNT(DISTINCT ${visitorEvents.sessionId})`,
        }).from(visitorEvents)
          .where(sql`${visitorEvents.createdAt} >= ${rangeStart}`)
          .groupBy(visitorEvents.browser)
          .orderBy(sql`COUNT(DISTINCT ${visitorEvents.sessionId}) DESC`).limit(10);

        // Bounce rate (sessions with bounced=1)
        const [bouncedRow] = await db.select({ count: sql<number>`COUNT(DISTINCT ${visitorEvents.sessionId})` })
          .from(visitorEvents)
          .where(sql`${visitorEvents.createdAt} >= ${rangeStart} AND ${visitorEvents.bounced} = 1`);
        const bounceRate = uniqueSessionsRow?.count > 0
          ? Math.round((Number(bouncedRow?.count ?? 0) / Number(uniqueSessionsRow.count)) * 100)
          : 0;

        // Avg time on page (only non-null, non-zero)
        const [avgTimeRow] = await db.select({ avg: sql<number>`AVG(${visitorEvents.timeOnPageSec})` })
          .from(visitorEvents)
          .where(sql`${visitorEvents.createdAt} >= ${rangeStart} AND ${visitorEvents.timeOnPageSec} IS NOT NULL AND ${visitorEvents.timeOnPageSec} > 0`);

        // Funnel: count unique sessions that reached each step
        const funnelSteps = ['pageview', 'upload', 'convert', 'download', 'buy_click', 'register'];
        const funnelData = await Promise.all(funnelSteps.map(async (step) => {
          const [row] = await db.select({ count: sql<number>`COUNT(DISTINCT ${visitorEvents.sessionId})` })
            .from(visitorEvents)
            .where(sql`${visitorEvents.createdAt} >= ${rangeStart} AND ${visitorEvents.eventType} = ${step}`);
          return { step, count: Number(row?.count ?? 0) };
        }));

        // Daily visits (last N days)
        // Use DATE_FORMAT to return a string (not a Date object) to avoid serialization issues
        const dailyVisits = await db.select({
          date: sql<string>`DATE_FORMAT(${visitorEvents.createdAt}, '%Y-%m-%d')`,
          sessions: sql<number>`COUNT(DISTINCT ${visitorEvents.sessionId})`,
          pageviews: sql<number>`COUNT(*)`,
        }).from(visitorEvents)
          .where(sql`${visitorEvents.createdAt} >= ${rangeStart} AND ${visitorEvents.eventType} = 'pageview'`)
          .groupBy(sql`DATE_FORMAT(${visitorEvents.createdAt}, '%Y-%m-%d')`)
          .orderBy(sql`DATE_FORMAT(${visitorEvents.createdAt}, '%Y-%m-%d') ASC`);

        // Recent sessions list (last 50)
        const recentSessionsList = await db.select({
          sessionId: visitorEvents.sessionId,
          country: visitorEvents.country,
          device: visitorEvents.device,
          browser: visitorEvents.browser,
          referrer: visitorEvents.referrer,
          utmSource: visitorEvents.utmSource,
          page: visitorEvents.page,
          timeOnPageSec: visitorEvents.timeOnPageSec,
          bounced: visitorEvents.bounced,
          appUserId: visitorEvents.appUserId,
          createdAt: visitorEvents.createdAt,
        }).from(visitorEvents)
          .where(sql`${visitorEvents.createdAt} >= ${rangeStart} AND ${visitorEvents.eventType} = 'pageview'`)
          .orderBy(desc(visitorEvents.createdAt))
          .limit(50);

        const result = {
          total: Number(totalRow?.count ?? 0),
          today: Number(todayRow?.count ?? 0),
          recentSessions: Number(uniqueSessionsRow?.count ?? 0),
          bounceRate,
          avgTimeOnPage: Math.round(Number(avgTimeRow?.avg ?? 0)),
          byCountry: byCountry.map(r => {
            const raw = r.country ?? null;
            if (!raw) return { country: 'לא ידוע', count: Number(r.count) };
            if (raw.length === 2) return { country: getHebrewCountryDisplay(raw), count: Number(r.count) };
            if (raw.includes('|')) { const [, code] = raw.split('|'); return { country: code ? getHebrewCountryDisplay(code) : raw, count: Number(r.count) }; }
            return { country: raw, count: Number(r.count) };
          }),
          byPage: byPage.map(r => ({ page: r.page, count: Number(r.count) })),
          bySource: bySource.map(r => ({ source: r.source ?? 'ישיר', count: Number(r.count) })),
          byDevice: byDevice.map(r => ({ device: r.device ?? 'לא ידוע', count: Number(r.count) })),
          byBrowser: byBrowser.map(r => ({ browser: r.browser ?? 'לא ידוע', count: Number(r.count) })),
          funnelData,
          dailyVisits: dailyVisits.map(r => ({ date: r.date, sessions: Number(r.sessions), pageviews: Number(r.pageviews) })),
          recentSessionsList: recentSessionsList.map(r => ({
            ...r,
            country: r.country ? (r.country.length === 2 ? getHebrewCountryDisplay(r.country) : r.country) : 'לא ידוע',
            createdAt: r.createdAt.toISOString(),
          })),
        };
        return result;
        } catch (err: unknown) {
          // Extract the root cause message, not the full DrizzleQueryError with SQL
          let msg = err instanceof Error ? err.message : String(err);
          // If it's a DrizzleQueryError, try to get the cause message
          if (err instanceof Error && (err as {cause?: Error}).cause instanceof Error) {
            msg = (err as {cause: Error}).cause.message;
          }
          console.error('[visitors.stats] query error:', msg);
          throw new Error(msg);
        }
      }),

    /** Pricing page visits — who visited /pricing, when, and how long they stayed */
    pricingVisits: adminProcedure
      .input(z.object({ days: z.number().int().min(1).max(365).default(30) }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        const rangeStart = new Date(Date.now() - input.days * 24 * 60 * 60 * 1000);
        const rows = await db
          .select({
            id: visitorEvents.id,
            sessionId: visitorEvents.sessionId,
            appUserId: visitorEvents.appUserId,
            country: visitorEvents.country,
            device: visitorEvents.device,
            browser: visitorEvents.browser,
            referrer: visitorEvents.referrer,
            utmSource: visitorEvents.utmSource,
            timeOnPageSec: visitorEvents.timeOnPageSec,
            bounced: visitorEvents.bounced,
            createdAt: visitorEvents.createdAt,
            userName: appUsers.name,
            userEmail: appUsers.email,
          })
          .from(visitorEvents)
          .leftJoin(appUsers, eq(visitorEvents.appUserId, appUsers.id))
          .where(
            sql`${visitorEvents.page} = '/pricing'
              AND ${visitorEvents.eventType} = 'pageview'
              AND ${visitorEvents.createdAt} >= ${rangeStart}`
          )
          .orderBy(desc(visitorEvents.createdAt))
          .limit(500);
        return rows.map(r => ({
          id: r.id,
          sessionId: r.sessionId,
          appUserId: r.appUserId ?? null,
          userName: r.userName ?? null,
          userEmail: r.userEmail ?? null,
          country: r.country ? (r.country.length === 2 ? getHebrewCountryDisplay(r.country) : r.country) : null,
          device: r.device ?? null,
          browser: r.browser ?? null,
          referrer: r.referrer ?? null,
          utmSource: r.utmSource ?? null,
          timeOnPageSec: r.timeOnPageSec ?? null,
          bounced: r.bounced ?? 0,
          createdAt: r.createdAt.toISOString(),
        }));
      }),
  }),

  // ── Issue Reports ─────────────────────────────────────────────────────────────
  issueReports: router({
    /** Upload a source image to S3 for issue reports */
    uploadSourceImage: publicProcedure
      .input(z.object({
        base64: z.string(), // data:image/...;base64,...
      }))
      .mutation(async ({ input, ctx }) => {
        const appUser = getAppUserFromCookie(
          (ctx.req as { cookies?: Record<string, string> }).cookies ?? {}
        );
        if (!appUser) throw new TRPCError({ code: "UNAUTHORIZED" });
        // Strip data URL prefix
        const matches = input.base64.match(/^data:([a-zA-Z0-9/+]+);base64,(.+)$/);
        if (!matches) throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid base64" });
        const mimeType = matches[1];
        const buffer = Buffer.from(matches[2], "base64");
        const ext = mimeType.includes("png") ? "png" : "jpg";
        const key = `issue-reports/${appUser.userId}-${Date.now()}.${ext}`;
        const { url } = await storagePut(key, buffer, mimeType);
        return { url };
      }),
    /** Submit a new issue report (authenticated users only) */
    submit: publicProcedure
      .input(z.object({
        sourceImageUrl: z.string().optional(),
        resultImageUrl: z.string().optional(),
        feature: z.string().optional(),
        description: z.string().min(5, "נא לתאר את הבעיה"),
        userActionId: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const appUser = getAppUserFromCookie(
          (ctx.req as { cookies?: Record<string, string> }).cookies ?? {}
        );
        if (!appUser) throw new TRPCError({ code: "UNAUTHORIZED", message: "יש להתחבר כדי לדווח על בעיה" });
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db.insert(issueReports).values({
          appUserId: appUser.userId,
          userActionId: input.userActionId ?? null,
          sourceImageUrl: input.sourceImageUrl ?? null,
          resultImageUrl: input.resultImageUrl ?? null,
          feature: input.feature ?? null,
          description: input.description,
          status: "pending",
        });
        // Notify owner
        await notifyOwner({
          title: "דיווח בעיה חדש",
          content: `משתמש ${appUser.email} דיווח על בעיה ב-${input.feature ?? "לא ידוע"}: ${input.description.slice(0, 200)}`,
        }).catch(() => {});
        return { success: true };
      }),

    /** Get all issue reports (admin only) */
    list: publicProcedure
      .input(z.object({
        status: z.enum(["pending", "approved", "rejected", "all"]).default("all"),
      }))
      .query(async ({ input, ctx }) => {
        if (!isAdminAuthenticated(ctx.req)) throw new TRPCError({ code: "UNAUTHORIZED" });
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const rows = await db
          .select({
            id: issueReports.id,
            appUserId: issueReports.appUserId,
            userActionId: issueReports.userActionId,
            sourceImageUrl: issueReports.sourceImageUrl,
            resultImageUrl: issueReports.resultImageUrl,
            feature: issueReports.feature,
            description: issueReports.description,
            status: issueReports.status,
            tokensRefunded: issueReports.tokensRefunded,
            adminNote: issueReports.adminNote,
            reviewedAt: issueReports.reviewedAt,
            createdAt: issueReports.createdAt,
            userEmail: appUsers.email,
            userName: appUsers.name,
          })
          .from(issueReports)
          .leftJoin(appUsers, eq(issueReports.appUserId, appUsers.id))
          .where(input.status !== "all" ? eq(issueReports.status, input.status as "pending" | "approved" | "rejected") : undefined)
          .orderBy(desc(issueReports.createdAt))
          .limit(200);
        return rows;
      }),

    /** Approve a report and refund tokens (admin only) */
    approve: publicProcedure
      .input(z.object({
        id: z.number(),
        tokensToRefund: z.number().min(1).max(50),
        adminNote: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (!isAdminAuthenticated(ctx.req)) throw new TRPCError({ code: "UNAUTHORIZED" });
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        // Get the report
        const [report] = await db.select().from(issueReports).where(eq(issueReports.id, input.id)).limit(1);
        if (!report) throw new TRPCError({ code: "NOT_FOUND", message: "דיווח לא נמצא" });
        if (report.status !== "pending") throw new TRPCError({ code: "BAD_REQUEST", message: "הדיווח כבר טופל" });
        // Refund tokens
        await addTokens(report.appUserId, input.tokensToRefund, "issue_refund", `זיכוי על בעיה: ${report.description?.slice(0, 100)}`);
        // Update report status
        await db.update(issueReports)
          .set({
            status: "approved",
            tokensRefunded: input.tokensToRefund,
            adminNote: input.adminNote ?? null,
            reviewedAt: new Date(),
          })
          .where(eq(issueReports.id, input.id));
        return { success: true };
      }),

    /** Reject a report (admin only) */
    reject: publicProcedure
      .input(z.object({
        id: z.number(),
        adminNote: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (!isAdminAuthenticated(ctx.req)) throw new TRPCError({ code: "UNAUTHORIZED" });
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const [report] = await db.select().from(issueReports).where(eq(issueReports.id, input.id)).limit(1);
        if (!report) throw new TRPCError({ code: "NOT_FOUND", message: "דיווח לא נמצא" });
        if (report.status !== "pending") throw new TRPCError({ code: "BAD_REQUEST", message: "הדיווח כבר טופל" });
        await db.update(issueReports)
          .set({
            status: "rejected",
            adminNote: input.adminNote ?? null,
            reviewedAt: new Date(),
          })
          .where(eq(issueReports.id, input.id));
        return { success: true };
      }),

    /** Get issue report count by status (admin only) */
    counts: publicProcedure.query(async ({ ctx }) => {
      if (!isAdminAuthenticated(ctx.req)) throw new TRPCError({ code: "UNAUTHORIZED" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const rows = await db
        .select({ status: issueReports.status, count: sql<number>`COUNT(*)` })
        .from(issueReports)
        .groupBy(issueReports.status);
      const result = { pending: 0, approved: 0, rejected: 0, total: 0 };
      for (const r of rows) {
        const n = Number(r.count);
        result[r.status as keyof typeof result] = n;
        result.total += n;
      }
      return result;
    }),
  }),

  // ═══════════════════════════════════════════════════════════════════════════
  // Shared Files (FreeDXF Community)
  // ═══════════════════════════════════════════════════════════════════════════
  sharedFiles: router({
    /** Submit a file for sharing (authenticated user) — by userActionId */
    submit: publicProcedure
      .input(z.object({
        userActionId: z.number(),
        creatorName: z.string().max(200).optional(),
        description: z.string().max(1000).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const appUser = getAppUserFromCookie((ctx.req as any).cookies);
        if (!appUser) throw new TRPCError({ code: "UNAUTHORIZED", message: "יש להתחבר כדי לשתף" });
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        const [action] = await db
          .select()
          .from(userActions)
          .where(and(eq(userActions.id, input.userActionId), eq(userActions.appUserId, appUser.userId)))
          .limit(1);
        if (!action) throw new TRPCError({ code: "NOT_FOUND", message: "פעולה לא נמצאה" });
        if (!action.dxfUrl) throw new TRPCError({ code: "BAD_REQUEST", message: "אין קובץ DXF לשיתוף" });

        const [existing] = await db
          .select({ id: sharedFiles.id })
          .from(sharedFiles)
          .where(eq(sharedFiles.userActionId, input.userActionId))
          .limit(1);
        if (existing) throw new TRPCError({ code: "CONFLICT", message: "הקובץ כבר נשלח לשיתוף" });

        // Generate a PNG preview from SVG if no preview image exists
        let previewImageUrl = action.imageUrl ?? null;
        if (!previewImageUrl && action.svgPreview) {
          const generatedUrl = await generatePreviewFromSvg(
            action.svgPreview,
            `action-${input.userActionId}`
          );
          if (generatedUrl) previewImageUrl = generatedUrl;
        }

        await db.insert(sharedFiles).values({
          appUserId: appUser.userId,
          userActionId: input.userActionId,
          feature: action.feature ?? "convert",
          dxfUrl: action.dxfUrl,
          previewImageUrl,
          svgPreview: action.svgPreview ?? null,
          sourceImageUrl: action.sourceImageUrl ?? null,
          lineCount: action.segmentCount ?? 0,
          creatorName: input.creatorName ?? null,
          descriptionHe: input.description ?? null,
        });

        return { success: true };
      }),

    /** Submit a file for sharing directly (from DxfDownloadDialog) */
    submitDirect: publicProcedure
      .input(z.object({
        dxfUrl: z.string(),
        svgPreview: z.string().optional(),
        previewImageUrl: z.string().optional(),
        feature: z.string().optional(),
        lineCount: z.number().optional(),
        filename: z.string().optional(),
        creatorName: z.string().max(200).optional(),
        description: z.string().max(1000).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const appUser = getAppUserFromCookie((ctx.req as any).cookies);
        if (!appUser) throw new TRPCError({ code: "UNAUTHORIZED", message: "יש להתחבר כדי לשתף" });
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        // Check if this DXF URL was already shared by this user
        const [existing] = await db
          .select({ id: sharedFiles.id })
          .from(sharedFiles)
          .where(and(eq(sharedFiles.dxfUrl, input.dxfUrl), eq(sharedFiles.appUserId, appUser.userId)))
          .limit(1);
        if (existing) throw new TRPCError({ code: "CONFLICT", message: "הקובץ כבר נשלח לשיתוף" });

        // Generate a PNG preview from SVG if no preview image URL provided
        let previewImageUrl = input.previewImageUrl ?? null;
        if (!previewImageUrl && input.svgPreview) {
          const generatedUrl = await generatePreviewFromSvg(
            input.svgPreview,
            `direct-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
          );
          if (generatedUrl) previewImageUrl = generatedUrl;
        }

        await db.insert(sharedFiles).values({
          appUserId: appUser.userId,
          feature: input.feature ?? "convert",
          dxfUrl: input.dxfUrl,
          previewImageUrl,
          svgPreview: input.svgPreview ?? null,
          lineCount: input.lineCount ?? 0,
          title: input.filename ?? null,
          creatorName: input.creatorName ?? null,
          descriptionHe: input.description ?? null,
        });

        return { success: true };
      }),

    /** Public: list approved shared files (for FreeDXF) */
    list: publicProcedure
      .input(z.object({
        category: z.string().optional(),
        search: z.string().optional(),
        limit: z.number().min(1).max(100).default(24),
        offset: z.number().min(0).default(0),
      }).optional())
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return { files: [], total: 0, categories: [] };
        const { category, search, limit = 24, offset = 0 } = input ?? {};

        // Build conditions
        const conditions = [eq(sharedFiles.status, "approved")];
        if (category) conditions.push(eq(sharedFiles.category, category));
        if (search) {
          const s = `%${search}%`;
          conditions.push(
            sql`(${sharedFiles.title} LIKE ${s} OR ${sharedFiles.titleHe} LIKE ${s} OR ${sharedFiles.tags} LIKE ${s} OR ${sharedFiles.creatorName} LIKE ${s} OR ${sharedFiles.description} LIKE ${s} OR ${sharedFiles.descriptionHe} LIKE ${s})`
          );
        }

        const whereClause = conditions.length === 1 ? conditions[0] : and(...conditions);

        // Get total count
        const [countRow] = await db
          .select({ count: sql<number>`COUNT(*)` })
          .from(sharedFiles)
          .where(whereClause!);
        const total = Number(countRow?.count ?? 0);

        // Get files
        const files = await db
          .select({
            id: sharedFiles.id,
            title: sharedFiles.title,
            titleHe: sharedFiles.titleHe,
            description: sharedFiles.description,
            descriptionHe: sharedFiles.descriptionHe,
            category: sharedFiles.category,
            tags: sharedFiles.tags,
            feature: sharedFiles.feature,
            previewImageUrl: sharedFiles.previewImageUrl,
            lineCount: sharedFiles.lineCount,
            downloadCount: sharedFiles.downloadCount,
            createdAt: sharedFiles.createdAt,
            userName: appUsers.name,
            creatorName: sharedFiles.creatorName,
            svgPreview: sharedFiles.svgPreview,
          })
          .from(sharedFiles)
          .leftJoin(appUsers, eq(sharedFiles.appUserId, appUsers.id))
          .where(whereClause!)
          .orderBy(desc(sharedFiles.createdAt))
          .limit(limit)
          .offset(offset);

        // Get all categories
        const catRows = await db
          .select({ category: sharedFiles.category, count: sql<number>`COUNT(*)` })
          .from(sharedFiles)
          .where(eq(sharedFiles.status, "approved"))
          .groupBy(sharedFiles.category);
        const categories = catRows
          .filter(r => r.category)
          .map(r => ({ name: r.category!, count: Number(r.count) }));

        return { files, total, categories };
      }),

    /** Public: get single file details (for FreeDXF file page) */
    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const [file] = await db
          .select({
            id: sharedFiles.id,
            title: sharedFiles.title,
            titleHe: sharedFiles.titleHe,
            description: sharedFiles.description,
            descriptionHe: sharedFiles.descriptionHe,
            category: sharedFiles.category,
            tags: sharedFiles.tags,
            feature: sharedFiles.feature,
            dxfUrl: sharedFiles.dxfUrl,
            previewImageUrl: sharedFiles.previewImageUrl,
            svgPreview: sharedFiles.svgPreview,
            lineCount: sharedFiles.lineCount,
            downloadCount: sharedFiles.downloadCount,
            createdAt: sharedFiles.createdAt,
            userName: appUsers.name,
          })
          .from(sharedFiles)
          .leftJoin(appUsers, eq(sharedFiles.appUserId, appUsers.id))
          .where(and(eq(sharedFiles.id, input.id), eq(sharedFiles.status, "approved")))
          .limit(1);
        if (!file) throw new TRPCError({ code: "NOT_FOUND", message: "File not found" });
        return file;
      }),

    /** Public: increment download count */
    recordDownload: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) return { success: false };
        await db
          .update(sharedFiles)
          .set({ downloadCount: sql`${sharedFiles.downloadCount} + 1` })
          .where(eq(sharedFiles.id, input.id));
        return { success: true };
      }),

    /** Admin: list all shared files (pending, approved, rejected) */
    adminList: adminProcedure
      .input(z.object({
        status: z.enum(["pending", "approved", "rejected", "all"]).default("pending"),
      }).optional())
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        const statusFilter = input?.status ?? "pending";
        const conditions = statusFilter !== "all"
          ? [eq(sharedFiles.status, statusFilter as "pending" | "approved" | "rejected")]
          : [];

        const query = db
          .select({
            id: sharedFiles.id,
            appUserId: sharedFiles.appUserId,
            userActionId: sharedFiles.userActionId,
            title: sharedFiles.title,
            titleHe: sharedFiles.titleHe,
            description: sharedFiles.description,
            descriptionHe: sharedFiles.descriptionHe,
            category: sharedFiles.category,
            tags: sharedFiles.tags,
            feature: sharedFiles.feature,
            dxfUrl: sharedFiles.dxfUrl,
            previewImageUrl: sharedFiles.previewImageUrl,
            lineCount: sharedFiles.lineCount,
            downloadCount: sharedFiles.downloadCount,
            status: sharedFiles.status,
            adminNote: sharedFiles.adminNote,
            creatorName: sharedFiles.creatorName,
            createdAt: sharedFiles.createdAt,
            userName: appUsers.name,
            userEmail: appUsers.email,
          })
          .from(sharedFiles)
          .leftJoin(appUsers, eq(sharedFiles.appUserId, appUsers.id));

        if (conditions.length > 0) {
          return query.where(conditions[0]).orderBy(desc(sharedFiles.createdAt)).limit(200);
        }
        return query.orderBy(desc(sharedFiles.createdAt)).limit(200);
      }),

    /** Admin: approve a shared file (set title, category, tags) */
    approve: adminProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().optional(),
        titleHe: z.string().optional(),
        description: z.string().optional(),
        descriptionHe: z.string().optional(),
        category: z.string().optional(),
        tags: z.string().optional(),
        creatorName: z.string().max(200).optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        // Fetch file + user info for email notification
        const [file] = await db
          .select({
            previewImageUrl: sharedFiles.previewImageUrl,
            svgPreview: sharedFiles.svgPreview,
            title: sharedFiles.title,
            appUserId: sharedFiles.appUserId,
            status: sharedFiles.status,
          })
          .from(sharedFiles)
          .where(eq(sharedFiles.id, input.id))
          .limit(1);

        // Fetch user email for approval notification (only if not already approved)
        let userEmail: string | null = null;
        let userName: string | null = null;
        let userLang: string = "he";
        if (file && file.status !== "approved") {
          const [userRow] = await db
            .select({ email: appUsers.email, name: appUsers.name, language: appUsers.language })
            .from(appUsers)
            .where(eq(appUsers.id, file.appUserId))
            .limit(1);
          userEmail = userRow?.email ?? null;
          userName = userRow?.name ?? null;
          userLang = (userRow?.language ?? "he") as string;
        }

        const updateSet: Record<string, unknown> = {
          status: "approved",
          title: input.title ?? file?.title ?? `קובץ #${input.id}`,
          titleHe: input.titleHe ?? null,
          description: input.description ?? null,
          descriptionHe: input.descriptionHe ?? null,
          category: input.category ?? "Other",
          tags: input.tags ?? null,
          creatorName: input.creatorName ?? null,
          reviewedAt: new Date(),
        };

        // Generate preview image if missing
        if (file && !file.previewImageUrl && file.svgPreview) {
          const generatedUrl = await generatePreviewFromSvg(file.svgPreview, `shared-${input.id}`);
          if (generatedUrl) updateSet.previewImageUrl = generatedUrl;
        }

        await db
          .update(sharedFiles)
          .set(updateSet)
          .where(eq(sharedFiles.id, input.id));

        // Send approval email to the user (fire-and-forget, don't block the response)
        if (userEmail) {
          const approvedTitle = (input.title ?? file?.title ?? `קובץ #${input.id}`) as string;
          const filePageUrl = `https://dxfai.ai/free?file=${input.id}`;
          void sendShareApprovedEmail({
            to: userEmail,
            name: userName,
            fileTitle: approvedTitle,
            fileUrl: filePageUrl,
            language: userLang as "he" | "en" | "ru" | "ar" | "zh" | "es" | "fr",
          }).catch((e: unknown) => console.error("[share approve] Failed to send email:", e));
        }

        return { success: true };
      }),

    /** Admin: reject a shared file */
    reject: adminProcedure
      .input(z.object({
        id: z.number(),
        adminNote: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db
          .update(sharedFiles)
          .set({
            status: "rejected",
            adminNote: input.adminNote ?? null,
            reviewedAt: new Date(),
          })
          .where(eq(sharedFiles.id, input.id));
        return { success: true };
      }),

    /** Admin: update an already approved file */
    adminUpdate: adminProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().optional(),
        titleHe: z.string().optional(),
        description: z.string().optional(),
        descriptionHe: z.string().optional(),
        category: z.string().optional(),
        tags: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const { id, ...updates } = input;
        const setObj: Record<string, unknown> = {};
        if (updates.title !== undefined) setObj.title = updates.title;
        if (updates.titleHe !== undefined) setObj.titleHe = updates.titleHe;
        if (updates.description !== undefined) setObj.description = updates.description;
        if (updates.descriptionHe !== undefined) setObj.descriptionHe = updates.descriptionHe;
        if (updates.category !== undefined) setObj.category = updates.category;
        if (updates.tags !== undefined) setObj.tags = updates.tags;
        if (Object.keys(setObj).length === 0) return { success: true };
        await db.update(sharedFiles).set(setObj).where(eq(sharedFiles.id, id));
        return { success: true };
      }),

    /** Admin: regenerate preview image for a shared file from its SVG data */
    regeneratePreview: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const [file] = await db
          .select({ svgPreview: sharedFiles.svgPreview, previewImageUrl: sharedFiles.previewImageUrl })
          .from(sharedFiles)
          .where(eq(sharedFiles.id, input.id))
          .limit(1);
        if (!file) throw new TRPCError({ code: "NOT_FOUND" });
        if (!file.svgPreview) throw new TRPCError({ code: "BAD_REQUEST", message: "No SVG data available" });
        const url = await generatePreviewFromSvg(file.svgPreview, `regen-${input.id}-${Date.now()}`);
        if (!url) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to generate preview" });
        await db.update(sharedFiles).set({ previewImageUrl: url }).where(eq(sharedFiles.id, input.id));
        return { success: true, previewImageUrl: url };
      }),

    /** Admin: get pending count */
    /** Admin: permanently delete a shared file */
    adminDelete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db.delete(sharedFiles).where(eq(sharedFiles.id, input.id));
        return { success: true };
      }),

    /** Admin: list all FreeDXF downloads (who downloaded what) */
    adminDownloadLog: adminProcedure
      .input(z.object({ limit: z.number().min(1).max(200).default(100) }).optional())
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        const limit = input?.limit ?? 100;
        return db
          .select({
            id: freedxfDownloads.id,
            sharedFileId: freedxfDownloads.sharedFileId,
            fileTitle: freedxfDownloads.fileTitle,
            fileCategory: freedxfDownloads.fileCategory,
            createdAt: freedxfDownloads.createdAt,
            userName: appUsers.name,
            userEmail: appUsers.email,
            currentTitle: sharedFiles.title,
            currentTitleHe: sharedFiles.titleHe,
          })
          .from(freedxfDownloads)
          .leftJoin(appUsers, eq(freedxfDownloads.appUserId, appUsers.id))
          .leftJoin(sharedFiles, eq(freedxfDownloads.sharedFileId, sharedFiles.id))
          .orderBy(desc(freedxfDownloads.createdAt))
          .limit(limit);
      }),

    pendingCount: adminProcedure.query(async () => {
      const db = await getDb();
      if (!db) return { count: 0 };
      const [row] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(sharedFiles)
        .where(eq(sharedFiles.status, "pending"));
      return { count: Number(row?.count ?? 0) };
    }),

    /** Protected: record a user download of a FreeDXF file (for history) */
    recordUserDownload: protectedProcedure
      .input(z.object({
        sharedFileId: z.number(),
        fileTitle: z.string().optional(),
        fileCategory: z.string().optional(),
        previewImageUrl: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) return { success: false };
        const appUser = getAppUserFromCookie(
          (ctx.req as { cookies?: Record<string, string> }).cookies ?? {}
        );
        if (!appUser) return { success: false };
        await db
          .update(sharedFiles)
          .set({ downloadCount: sql`${sharedFiles.downloadCount} + 1` })
          .where(eq(sharedFiles.id, input.sharedFileId));
        await db.insert(freedxfDownloads).values({
          appUserId: appUser.userId,
          sharedFileId: input.sharedFileId,
          fileTitle: input.fileTitle ?? null,
          fileCategory: input.fileCategory ?? null,
          previewImageUrl: input.previewImageUrl ?? null,
        });
        return { success: true };
      }),

    /** Protected: get current user's FreeDXF download history */
    myDownloads: protectedProcedure
      .input(z.object({ limit: z.number().min(1).max(50).default(20) }).optional())
      .query(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) return [];
        const appUser = getAppUserFromCookie(
          (ctx.req as { cookies?: Record<string, string> }).cookies ?? {}
        );
        if (!appUser) return [];
        const limit = input?.limit ?? 20;
        return db
          .select({
            id: freedxfDownloads.id,
            sharedFileId: freedxfDownloads.sharedFileId,
            fileTitle: freedxfDownloads.fileTitle,
            fileCategory: freedxfDownloads.fileCategory,
            previewImageUrl: freedxfDownloads.previewImageUrl,
            createdAt: freedxfDownloads.createdAt,
            currentTitle: sharedFiles.title,
            currentTitleHe: sharedFiles.titleHe,
            currentPreview: sharedFiles.previewImageUrl,
          })
          .from(freedxfDownloads)
          .leftJoin(sharedFiles, eq(freedxfDownloads.sharedFileId, sharedFiles.id))
          .where(eq(freedxfDownloads.appUserId, appUser.userId))
          .orderBy(desc(freedxfDownloads.createdAt))
          .limit(limit);
      }),
  }),

  // ── Click tracking ──────────────────────────────────────────────────────────
  tracking: router({
    /** Log a button click — public (works for anonymous too, but prefers logged-in user) */
    logClick: publicProcedure
      .input(z.object({
        action: z.string().min(1).max(128),
        label: z.string().max(200).optional(),
        page: z.string().max(128).optional(),
        metadata: z.string().max(1000).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) return { success: false };
        const appUser = getAppUserFromCookie(
          (ctx.req as { cookies?: Record<string, string> }).cookies ?? {}
        );
        const req = ctx.req as { headers: Record<string, string | string[] | undefined>; socket?: { remoteAddress?: string } };
        const rawIp = getClientIp(req);
        const parts = rawIp.split(".");
        const ipAnon = parts.length === 4 ? parts.slice(0, 3).join(".") + ".x" : rawIp;
        // Fetch user name from DB if we have a userId
        let userName: string | null = null;
        if (appUser?.userId) {
          const userRow = await db.select({ name: appUsers.name }).from(appUsers).where(eq(appUsers.id, appUser.userId)).limit(1);
          userName = userRow[0]?.name ?? null;
        }
        await db.insert(userClickEvents).values({
          appUserId: appUser?.userId ?? null,
          userEmail: appUser?.email ?? null,
          userName,
          action: input.action,
          label: input.label ?? null,
          page: input.page ?? null,
          metadata: input.metadata ?? null,
          ipAnon,
        });
        return { success: true };
      }),

    /** Admin: get all users with their click counts */
    adminUsers: adminProcedure
      .input(z.object({ limit: z.number().min(1).max(10000).default(5000) }).optional())
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        const limit = input?.limit ?? 5000;
        // Get all app users with their last click time and total click count
        const rows = await db
          .select({
            id: appUsers.id,
            name: appUsers.name,
            email: appUsers.email,
            googleId: appUsers.googleId,
            tokenBalance: appUsers.tokenBalance,
            createdAt: appUsers.createdAt,
            lastLoginAt: appUsers.lastLoginAt,
            clickCount: sql<number>`COUNT(${userClickEvents.id})`,
            lastClickAt: sql<Date | null>`MAX(${userClickEvents.createdAt})`,
          })
          .from(appUsers)
          .leftJoin(userClickEvents, eq(userClickEvents.appUserId, appUsers.id))
          .groupBy(appUsers.id)
          .orderBy(desc(sql`MAX(${userClickEvents.createdAt})`), desc(appUsers.lastLoginAt))
          .limit(limit);
        return rows;
      }),

    /** Admin: get click events for a specific user */
    adminUserClicks: adminProcedure
      .input(z.object({
        userId: z.number(),
        limit: z.number().min(1).max(1000).default(200),
      }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        return db
          .select()
          .from(userClickEvents)
          .where(eq(userClickEvents.appUserId, input.userId))
          .orderBy(desc(userClickEvents.createdAt))
          .limit(input.limit);
      }),

    /** Admin: get ALL click events (latest first, across all users) */
    testModel: adminProcedure
      .input(z.object({
        model: z.enum(["gpt-image-1-mini", "gpt-image-1", "gpt-image-1.5", "gpt-image-2", "gpt-image-2-2026-04-21"]),
        imageBase64: z.string(), // base64 PNG/JPEG
        prompt: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { model, imageBase64, prompt } = input;
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "OPENAI_API_KEY not set" });

        const defaultPrompt =
          "Professional black and white line art. Pure white background (#FFFFFF). " +
          "Pure black (#000000) lines only. No fills, no shading, no gradients, no grey tones. " +
          "Clean coloring-book outline drawing with smooth continuous ink strokes. " +
          "Trace the exact shapes from the reference image.";

        const FormDataNode = (await import("form-data")).default;
        const form = new FormDataNode();
        form.append("model", model);
        form.append("prompt", prompt ?? defaultPrompt);
        const imgBuffer = Buffer.from(imageBase64, "base64");
        form.append("image", imgBuffer, { filename: "image.png", contentType: "image/png" });
        form.append("n", "1");
        form.append("size", "1024x1024");
        form.append("response_format", "b64_json");

        const formBuffer = form.getBuffer();
        const formUint8 = new Uint8Array(formBuffer.buffer, formBuffer.byteOffset, formBuffer.byteLength);

        const startMs = Date.now();
        const openaiBaseRouters = (process.env.OPENAI_BASE_URL || "https://api.openai.com").replace(/\/v1\/?$/, "");
        const response = await fetch(`${openaiBaseRouters}/v1/images/edits`, {
          method: "POST",
          headers: { authorization: `Bearer ${apiKey}`, ...form.getHeaders() },
          body: formUint8 as any,
          signal: AbortSignal.timeout(3 * 60 * 1000),
        });
        const durationMs = Date.now() - startMs;

        if (!response.ok) {
          const detail = await response.text().catch(() => "");
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `OpenAI error (${response.status}): ${detail}` });
        }
        const result = await response.json() as { data?: Array<{ b64_json?: string }> };
        const b64 = result.data?.[0]?.b64_json;
        if (!b64) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "No image returned" });
        return { imageBase64: b64, durationMs, model };
      }),

    adminAllClicks: adminProcedure
      .input(z.object({
        limit: z.number().min(1).max(1000).default(300),
        action: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        const limit = input?.limit ?? 300;
        const baseQuery = db
          .select({
            id: userClickEvents.id,
            appUserId: userClickEvents.appUserId,
            userEmail: userClickEvents.userEmail,
            userName: userClickEvents.userName,
            action: userClickEvents.action,
            label: userClickEvents.label,
            page: userClickEvents.page,
            metadata: userClickEvents.metadata,
            createdAt: userClickEvents.createdAt,
          })
          .from(userClickEvents)
          .orderBy(desc(userClickEvents.createdAt))
          .limit(limit);
        if (input?.action) {
          return baseQuery.where(eq(userClickEvents.action, input.action));
        }
        return baseQuery;
      }),
  }),
});
export type AppRouter = typeof appRouter;

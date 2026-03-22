import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import jwt from "jsonwebtoken";
import { getSessionCookieOptions } from "./_core/cookies";
import { ENV } from "./_core/env";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { getDailyActivity, getRecentEvents, getUsageStats } from "./usageDb";
import { getDb } from "./db";
import { appUsers, userActions, tokenTransactions, systemSettings, passwordResets, consentRecords, paypalOrders, packagePrices, tokenCosts, campaignRedemptions, subscriptionPlans, userSubscriptions, dailyUsage, bugReports, newsItems, adminTasks, emailVerifications, failedJobs, visitorEvents, contactMessages } from "../drizzle/schema";
import { randomBytes } from "crypto";
import { sendPasswordResetEmail } from "./emailService";
import { desc, eq, and, sql } from "drizzle-orm";
import { getAppUserFromCookie } from "./appAuth";
import { COUNTRY_NAMES_HE, countryCodeToFlag, getHebrewCountryDisplay } from "./countryNames";
import { getTokenBalance, addTokens, getTokenTransactions, invalidateTokenCostsCache } from "./tokenService";
import { createPayPalOrder, capturePayPalOrder, createPayPalOrderForCardFields } from "./paypal";
import { getPackageById, getPriceForCurrency } from "./products";
import { sendPurchaseConfirmationEmail, sendBulkEmail } from "./emailService";
import { notifyOwner } from "./_core/notification";

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

    /** Recent events list */
    recentEvents: adminProcedure.query(async () => {
      return getRecentEvents(500);
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
          feature: userActions.feature,
          ipAnon: userActions.ipAnon,
          createdAt: userActions.createdAt,
          durationMs: userActions.durationMs,
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
      if (!db) return { supportEmail: "", whatsappNumber: "" };
      const rows = await db.select().from(systemSettings)
        .where(sql`${systemSettings.key} IN ('support_email', 'whatsapp_number')`);
      const map = Object.fromEntries(rows.map(r => [r.key, r.value]));
      return { supportEmail: map["support_email"] ?? "", whatsappNumber: map["whatsapp_number"] ?? "" };
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
      if (appUser) {
        const balance = await getTokenBalance(appUser.userId);
        const [claimed, isEmailUser] = await Promise.all([
          hasClaimedWelcome(appUser.userId),
          registeredWithEmail(appUser.userId),
        ]);
        // Only show pending bonus if: registered with email AND not yet claimed
        return { balance, loggedIn: true, hasPendingWelcomeBonus: isEmailUser && !claimed };
      }
      // Fallback: Manus OAuth user (no welcome email sent)
      if (ctx.user?.email) {
        const db = await getDb();
        if (!db) return { balance: 0, loggedIn: false, hasPendingWelcomeBonus: false };
        const [existingAppUser] = await db
          .select({ id: appUsers.id })
          .from(appUsers)
          .where(eq(appUsers.email, ctx.user.email));
        if (!existingAppUser) return { balance: 0, loggedIn: true, hasPendingWelcomeBonus: false };
        const balance = await getTokenBalance(existingAppUser.id);
        // Manus OAuth users don't get the welcome email, so no pending bonus
        return { balance, loggedIn: true, hasPendingWelcomeBonus: false };
      }
      return { balance: 0, loggedIn: false, hasPendingWelcomeBonus: false };
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
        const safeOrigin = input.origin ?? "https://dxfai.net";
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
        await db.insert(paypalOrders).values({
          appUserId,
          paypalOrderId: paypalOrder.id,
          packageId: input.packageId,
          tokenAmount: resolvedTokens,
          priceAmount: resolvedAmount,
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
        await db.insert(paypalOrders).values({
          appUserId,
          paypalOrderId: paypalOrder.id,
          packageId: input.packageId,
          tokenAmount: resolvedTokens,
          priceAmount: resolvedAmount,
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
            void sendPurchaseConfirmationEmail({ to: userRow.email, name: userRow.name ?? null, tokens: dbOrder.tokenAmount, amount: dbOrder.priceAmount, currency: dbOrder.currency, orderId: input.orderId, siteUrl: "https://dxfai.net", language: "he" });
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

  /** Visitor analytics */
  visitors: router({
    /** Track a page visit (public, fire-and-forget) */
    track: publicProcedure
      .input(z.object({
        sessionId: z.string().max(64),
        page: z.string().max(256).default("/"),
        referrer: z.string().max(512).optional(),
        userAgent: z.string().max(256).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          const db = await getDb();
          if (!db) return { ok: true };
          // Get app user if logged in
          const appUserCookie = getAppUserFromCookie((ctx.req as { cookies?: Record<string, string> }).cookies);
          // Anonymize IP (keep first 3 octets)
          const rawIp = getClientIp(ctx.req as Parameters<typeof getClientIp>[0]);
          const ipParts = rawIp.split(".");
          const ipAnon = ipParts.length >= 3 ? ipParts.slice(0, 3).join(".") : rawIp.substring(0, 15);
          // Detect country from IP — store 2-letter ISO code, display in Hebrew on read
          let country: string | null = null;
          try {
            const cfCountry = (ctx.req.headers as Record<string, string | string[] | undefined>)["cf-ipcountry"];
            if (cfCountry && typeof cfCountry === "string" && cfCountry.length === 2 && cfCountry !== "XX") {
              country = cfCountry.toUpperCase();
            } else if (rawIp && rawIp !== "unknown" && !rawIp.startsWith("127.") && !rawIp.startsWith("::1") && !rawIp.startsWith("10.") && !rawIp.startsWith("192.168.")) {
              // Use ip-api.com free tier (45 req/min, no key needed) — only fetch countryCode
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
          } catch { /* ignore — geolocation is best-effort */ }
          await db.insert(visitorEvents).values({
            sessionId: input.sessionId,
            appUserId: appUserCookie?.userId ?? null,
            page: input.page,
            country,
            ipAnon,
            referrer: input.referrer ?? null,
            userAgent: input.userAgent?.substring(0, 256) ?? null,
          });
        } catch { /* fire-and-forget, never throw */ }
        return { ok: true };
      }),
    /** Get visitor analytics (admin only) */
    stats: adminProcedure.query(async () => {
      const db = await getDb();
      if (!db) return { total: 0, today: 0, byCountry: [], byPage: [], recentSessions: 0 };
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const [totalRow] = await db.select({ count: sql<number>`COUNT(*)` }).from(visitorEvents);
      const [todayRow] = await db.select({ count: sql<number>`COUNT(*)` }).from(visitorEvents)
        .where(sql`${visitorEvents.createdAt} >= ${todayStart}`);
      const byCountry = await db.select({
        country: visitorEvents.country,
        count: sql<number>`COUNT(*)`,
      }).from(visitorEvents)
        .where(sql`${visitorEvents.createdAt} >= ${weekStart}`)
        .groupBy(visitorEvents.country)
        .orderBy(sql`COUNT(*) DESC`)
        .limit(20);
      const byPage = await db.select({
        page: visitorEvents.page,
        count: sql<number>`COUNT(*)`,
      }).from(visitorEvents)
        .where(sql`${visitorEvents.createdAt} >= ${weekStart}`)
        .groupBy(visitorEvents.page)
        .orderBy(sql`COUNT(*) DESC`)
        .limit(20);
      const [uniqueSessionsRow] = await db.select({ count: sql<number>`COUNT(DISTINCT ${visitorEvents.sessionId})` })
        .from(visitorEvents)
        .where(sql`${visitorEvents.createdAt} >= ${weekStart}`);
      return {
        total: Number(totalRow?.count ?? 0),
        today: Number(todayRow?.count ?? 0),
        byCountry: byCountry.map(r => {
          const raw = r.country ?? null;
          if (!raw) return { country: "לא ידוע", count: Number(r.count) };
          // 2-letter ISO code — convert to Hebrew name + flag emoji
          if (raw.length === 2) {
            return { country: getHebrewCountryDisplay(raw), count: Number(r.count) };
          }
          // Legacy "HE_NAME|CODE" format from previous version
          if (raw.includes("|")) {
            const [, code] = raw.split("|");
            return { country: code ? getHebrewCountryDisplay(code) : raw, count: Number(r.count) };
          }
          return { country: raw, count: Number(r.count) };
        }),
        byPage: byPage.map(r => ({ page: r.page, count: Number(r.count) })),
        recentSessions: Number(uniqueSessionsRow?.count ?? 0),
      };
    }),
  }),
});
export type AppRouter = typeof appRouter;

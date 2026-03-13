import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { eq, and, gte, count, sql } from "drizzle-orm";
import { getDb } from "./db";
import { appUsers, usageEvents, emailVerifications, passwordResets, consentRecords, users, campaignRedemptions } from "../drizzle/schema";
import { sendVerificationEmail, sendPasswordResetEmail, sendWelcomeEmail } from "./emailService";
import { randomBytes } from "crypto";
import { ENV } from "./_core/env";
import { sdk } from "./_core/sdk";
import { addTokens } from "./tokenService";

/**
 * Award campaign bonus tokens to a user if they haven't already claimed this campaign.
 * Returns true if tokens were awarded, false if already claimed.
 */
async function awardCampaignBonus(appUserId: number, campaignCode: string, tokens = 20): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  try {
    const [existing] = await db
      .select({ id: campaignRedemptions.id })
      .from(campaignRedemptions)
      .where(and(eq(campaignRedemptions.appUserId, appUserId), eq(campaignRedemptions.campaignCode, campaignCode)))
      .limit(1);
    if (existing) return false; // Already claimed
    await db.insert(campaignRedemptions).values({ appUserId, campaignCode, tokensAwarded: tokens });
    await addTokens(appUserId, tokens, "campaign_bonus", `בונוס קמפיין: ${campaignCode}`);
    return true;
  } catch (err) {
    console.error("[campaign] Failed to award bonus:", err);
    return false;
  }
}

const router = Router();

const JWT_SECRET = ENV.cookieSecret || "fallback-secret-change-me";
const APP_USER_COOKIE = "app_user_session";
const ANON_DAILY_LIMIT = 3;
const USER_DAILY_LIMIT = 10;

/** Sign a JWT for an app user */
function signToken(userId: number, email: string): string {
  return jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: "30d" });
}

/** Parse app user from cookie */
export function getAppUserFromCookie(cookies: Record<string, string> | undefined): { userId: number; email: string } | null {
  if (!cookies) return null;
  const token = cookies[APP_USER_COOKIE];
  if (!token) return null;
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: number; email: string };
    return payload;
  } catch {
    return null;
  }
}

/** Set app user session cookie.
 * @param rememberMe - true = persistent 30-day cookie; false = session cookie (clears on browser close)
 */
function setSessionCookie(res: import("express").Response, token: string, rememberMe = true) {
  res.cookie(APP_USER_COOKIE, token, {
    httpOnly: true,
    secure: ENV.isProduction,
    sameSite: ENV.isProduction ? "none" : "lax",
    ...(rememberMe ? { maxAge: 30 * 24 * 60 * 60 * 1000 } : {}), // 30 days or session cookie
    path: "/",
  });
}

/** Check daily conversion count for anonymous IP */
export async function getAnonDailyCount(ipAnon: string): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const [row] = await db
    .select({ cnt: count() })
    .from(usageEvents)
    .where(
      and(
        eq(usageEvents.type, "convert"),
        eq(usageEvents.ipAnon, ipAnon),
        gte(usageEvents.createdAt, todayStart),
        sql`${usageEvents.appUserId} IS NULL`
      )
    );
  return Number(row?.cnt ?? 0);
}

/** Check daily conversion count for registered user */
export async function getUserDailyCount(appUserId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const [row] = await db
    .select({ cnt: count() })
    .from(usageEvents)
    .where(
      and(
        eq(usageEvents.type, "convert"),
        eq(usageEvents.appUserId, appUserId),
        gte(usageEvents.createdAt, todayStart)
      )
    );
  return Number(row?.cnt ?? 0);
}

// ─── Register with email + password ─────────────────────────────────────────

router.post("/api/app-auth/register", async (req, res) => {
  try {
    const { name, email, password, termsAccepted, termsVersion, privacyVersion } = req.body as {
      name?: string;
      email?: string;
      password?: string;
      termsAccepted?: boolean;
      termsVersion?: string;
      privacyVersion?: string;
    };
    if (!termsAccepted) return res.status(400).json({ error: "יש לאשר את תנאי השימוש ומדיניות הפרטיות" });
    if (!email || !password) return res.status(400).json({ error: "אימייל וסיסמה נדרשים" });
    if (password.length < 6) return res.status(400).json({ error: "הסיסמה חייבת להכיל לפחות 6 תווים" });

    const db = await getDb();
    if (!db) return res.status(500).json({ error: "שגיאת מסד נתונים" });

    // Check if email already exists
    const [existing] = await db.select({ id: appUsers.id }).from(appUsers).where(eq(appUsers.email, email.toLowerCase()));
    if (existing) return res.status(409).json({ error: "אימייל זה כבר רשום" });

    const passwordHash = await bcrypt.hash(password, 10);
    const [result] = await db.insert(appUsers).values({
      name: name?.trim() || null,
      email: email.toLowerCase(),
      passwordHash,
    });

    const userId = (result as { insertId: number }).insertId;

    // Send email verification (fire-and-forget)
    try {
      const verifyToken = randomBytes(48).toString("hex");
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      await db.insert(emailVerifications).values({ appUserId: userId, token: verifyToken, expiresAt });
      const verifyUrl = `https://dxfai.net/verify-email?token=${verifyToken}`;
      void sendVerificationEmail({ to: email.toLowerCase(), name: name?.trim() || null, verifyUrl });
    } catch (e) {
      console.warn("[register] Failed to send verification email:", e);
    }

    // Save consent record
    try {
      const rawIp = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "";
      const parts = rawIp.split(".");
      const ipAnon = parts.length === 4 ? `${parts[0]}.${parts[1]}.${parts[2]}.0` : rawIp.substring(0, 16);
      await db.insert(consentRecords).values({
        appUserId: userId,
        email: email.toLowerCase(),
        termsVersion: termsVersion ?? "2026-03-10",
        privacyVersion: privacyVersion ?? "2026-03-10",
        ipAnon,
        userAgent: (req.headers["user-agent"] ?? "").substring(0, 500),
      });
    } catch (e) {
      console.warn("[register] Failed to save consent record:", e);
    }

    // Send welcome email (fire-and-forget)
    try {
      // Always use the production domain for email links
      const frontendOrigin = "https://dxfai.net";
      const lang = (req.headers["accept-language"] ?? "").startsWith("he") ? "he" : "en";
      void sendWelcomeEmail({
        to: email.toLowerCase(),
        name: name?.trim() || null,
        tokens: 10,
        siteUrl: frontendOrigin,
        language: lang,
      });
    } catch (e) {
      console.warn("[register] Failed to send welcome email:", e);
    }

    const token = signToken(userId, email.toLowerCase());
    setSessionCookie(res, token);

    // Award campaign bonus if campaign code is present
    const { campaignCode: regCampaignCode } = req.body as { campaignCode?: string };
    let regCampaignBonusAwarded = false;
    if (regCampaignCode) {
      regCampaignBonusAwarded = await awardCampaignBonus(userId, regCampaignCode);
    }

    return res.json({ success: true, user: { id: userId, email: email.toLowerCase(), name: name?.trim() || null }, campaignBonusAwarded: regCampaignBonusAwarded, campaignTokens: regCampaignBonusAwarded ? 20 : 0 });
  } catch (err) {
    console.error("[app-auth/register]", err);
    return res.status(500).json({ error: "שגיאה בהרשמה" });
  }
});

// ─── Login with email + password ─────────────────────────────────────────────

router.post("/api/app-auth/login", async (req, res) => {
  try {
    const { email, password, rememberMe } = req.body as { email?: string; password?: string; rememberMe?: boolean };
    if (!email || !password) return res.status(400).json({ error: "אימייל וסיסמה נדרשים" });

    const db = await getDb();
    if (!db) return res.status(500).json({ error: "שגיאת מסד נתונים" });

    const [user] = await db.select().from(appUsers).where(eq(appUsers.email, email.toLowerCase()));
    if (!user || !user.passwordHash) return res.status(401).json({ error: "אימייל או סיסמה שגויים" });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: "אימייל או סיסמה שגויים" });

    // Update last login
    await db.update(appUsers).set({ lastLoginAt: new Date() }).where(eq(appUsers.id, user.id));

    // Award campaign bonus if campaign code is present
    const campaignCode = req.body.campaignCode as string | undefined;
    let campaignBonusAwarded = false;
    if (campaignCode) {
      campaignBonusAwarded = await awardCampaignBonus(user.id, campaignCode);
    }

    const token = signToken(user.id, user.email);
    setSessionCookie(res, token, rememberMe !== false); // default true for backwards compat

    return res.json({ success: true, user: { id: user.id, email: user.email, name: user.name }, campaignBonusAwarded, campaignTokens: campaignBonusAwarded ? 20 : 0 });
  } catch (err) {
    console.error("[app-auth/login]", err);
    return res.status(500).json({ error: "שגיאה בכניסה" });
  }
});

// ─── Get current user ─────────────────────────────────────────────────────────

router.get("/api/app-auth/me", async (req: import("express").Request, res: import("express").Response) => {
  // First try app_user_session cookie (email/password users)
  const appUser = getAppUserFromCookie(req.cookies);
  if (appUser) {
    const db = await getDb();
    if (!db) return res.json({ user: null });
    const [user] = await db.select({ id: appUsers.id, email: appUsers.email, name: appUsers.name, tokenBalance: appUsers.tokenBalance }).from(appUsers).where(eq(appUsers.id, appUser.userId));
    return res.json({ user: user ?? null });
  }

  // Fallback: try Manus OAuth session
  try {
    const manusUser = await sdk.authenticateRequest(req as any);
    if (!manusUser || !manusUser.email) return res.json({ user: null });

    const db = await getDb();
    if (!db) return res.json({ user: null });

    // Find or create app_users record linked to this Manus OAuth user
    let [existingAppUser] = await db
      .select({ id: appUsers.id, email: appUsers.email, name: appUsers.name, tokenBalance: appUsers.tokenBalance })
      .from(appUsers)
      .where(eq(appUsers.email, manusUser.email));

    if (!existingAppUser) {
      // Create a new app_users record for this Manus OAuth user
      await db.insert(appUsers).values({
        email: manusUser.email,
        name: manusUser.name ?? null,
        tokenBalance: 20,
        emailVerified: 1,
      });
      const [newUser] = await db
        .select({ id: appUsers.id, email: appUsers.email, name: appUsers.name, tokenBalance: appUsers.tokenBalance })
        .from(appUsers)
        .where(eq(appUsers.email, manusUser.email));
      existingAppUser = newUser;
    }

    if (!existingAppUser) return res.json({ user: null });

    // Auto-set app_user_session cookie so subsequent requests work
    const token = signToken(existingAppUser.id, existingAppUser.email);
    setSessionCookie(res, token);

    return res.json({ user: existingAppUser });
  } catch {
    return res.json({ user: null });
  }
});

// ─── Verify email ────────────────────────────────────────────────────────────

router.get("/api/app-auth/verify-email", async (req, res) => {
  try {
    const { token } = req.query as { token?: string };
    if (!token) return res.status(400).json({ error: "טוקן חסר" });

    const db = await getDb();
    if (!db) return res.status(500).json({ error: "שגיאת מסד נתונים" });

    const [row] = await db.select().from(emailVerifications).where(eq(emailVerifications.token, token));
    if (!row) return res.status(400).json({ error: "קישור לא תקין" });
    if (row.usedAt) return res.status(400).json({ error: "קישור זה כבר שומש" });
    if (new Date() > row.expiresAt) return res.status(400).json({ error: "הקישור פג תוקף" });

    await db.update(emailVerifications).set({ usedAt: new Date() }).where(eq(emailVerifications.id, row.id));
    await db.update(appUsers).set({ emailVerified: 1 }).where(eq(appUsers.id, row.appUserId));

    return res.json({ success: true });
  } catch (err) {
    console.error("[verify-email]", err);
    return res.status(500).json({ error: "שגיאה באימות" });
  }
});

// ─── Forgot password ──────────────────────────────────────────────────────────

router.post("/api/app-auth/forgot-password", async (req, res) => {
  try {
    const { email, origin } = req.body as { email?: string; origin?: string };
    if (!email) return res.status(400).json({ error: "אימייל נדרש" });

    const db = await getDb();
    if (!db) return res.status(500).json({ error: "שגיאת מסד נתונים" });

    const [user] = await db.select({ id: appUsers.id, name: appUsers.name, email: appUsers.email })
      .from(appUsers).where(eq(appUsers.email, email.toLowerCase()));

    // Always return success to avoid email enumeration
    if (user && user.email) {
      try {
        const resetToken = randomBytes(48).toString("hex");
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
        await db.insert(passwordResets).values({ appUserId: user.id, token: resetToken, expiresAt });
        // Use origin from client (window.location.origin) so the link works in production
        const safeOrigin = origin ?? (req.headers["x-forwarded-proto"] ? `${req.headers["x-forwarded-proto"]}://${req.headers["x-forwarded-host"]}` : `${req.protocol}://${req.get("host")}`);
        const resetUrl = `${safeOrigin}/reset-password?token=${resetToken}`;
        void sendPasswordResetEmail({ to: user.email, name: user.name, resetUrl });
      } catch (e) {
        console.warn("[forgot-password] Failed to send email:", e);
      }
    }

    return res.json({ success: true });
  } catch (err) {
    console.error("[forgot-password]", err);
    return res.status(500).json({ error: "שגיאה" });
  }
});

// ─── Reset password ───────────────────────────────────────────────────────────

router.post("/api/app-auth/reset-password", async (req, res) => {
  try {
    const { token, password: pw1, newPassword: pw2 } = req.body as { token?: string; password?: string; newPassword?: string };
    const password = pw1 ?? pw2;
    if (!token || !password) return res.status(400).json({ error: "טוקן וסיסמה נדרשים" });
    if (password.length < 6) return res.status(400).json({ error: "הסיסמה חייבת להכיל לפחות 6 תווים" });

    const db = await getDb();
    if (!db) return res.status(500).json({ error: "שגיאת מסד נתונים" });

    const [row] = await db.select().from(passwordResets).where(eq(passwordResets.token, token));
    if (!row) return res.status(400).json({ error: "קישור לא תקין" });
    if (row.usedAt) return res.status(400).json({ error: "קישור זה כבר שומש" });
    if (new Date() > row.expiresAt) return res.status(400).json({ error: "הקישור פג תוקף" });

    const passwordHash = await bcrypt.hash(password, 10);
    await db.update(appUsers).set({ passwordHash }).where(eq(appUsers.id, row.appUserId));
    await db.update(passwordResets).set({ usedAt: new Date() }).where(eq(passwordResets.id, row.id));

    return res.json({ success: true });
  } catch (err) {
    console.error("[reset-password]", err);
    return res.status(500).json({ error: "שגיאה באיפוס סיסמה" });
  }
});

// ─── Change Password ────────────────────────────────────────────────────────────

router.post("/api/app-auth/change-password", async (req, res) => {
  try {
    const appUser = getAppUserFromCookie(req.cookies);
    if (!appUser) return res.status(401).json({ error: "UNAUTHORIZED" });
    const { currentPassword, newPassword } = req.body as { currentPassword?: string; newPassword?: string };
    if (!currentPassword || !newPassword) return res.status(400).json({ error: "שדות חסרים" });
    if (newPassword.length < 6) return res.status(400).json({ error: "הסיסמה החדשה חייבת להכיל לפחות 6 תווים" });
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "DB_UNAVAILABLE" });
    const [user] = await db.select().from(appUsers).where(eq(appUsers.id, appUser.userId));
    if (!user) return res.status(404).json({ error: "משתמש לא נמצא" });
    if (!user.passwordHash) return res.status(400).json({ error: "אין סיסמה מוגדרת לחשבון זה" });
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) return res.status(400).json({ error: "הסיסמה הנוכחית שגויה" });
    const newHash = await bcrypt.hash(newPassword, 12);
    await db.update(appUsers).set({ passwordHash: newHash }).where(eq(appUsers.id, appUser.userId));
    return res.json({ success: true });
  } catch (err) {
    console.error("[change-password]", err);
    return res.status(500).json({ error: "שגיאה בשינוי סיסמה" });
  }
});

// ─── Update Profile ───────────────────────────────────────────────────────────

router.post("/api/app-auth/update-profile", async (req, res) => {
  try {
    const appUser = getAppUserFromCookie(req.cookies);
    if (!appUser) return res.status(401).json({ error: "UNAUTHORIZED" });
    const { name } = req.body as { name?: string };
    if (!name || name.trim().length < 1) return res.status(400).json({ error: "שם לא יכול להיות ריק" });
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "DB_UNAVAILABLE" });
    await db.update(appUsers).set({ name: name.trim() }).where(eq(appUsers.id, appUser.userId));
    return res.json({ success: true });
  } catch (err) {
    console.error("[update-profile]", err);
    return res.status(500).json({ error: "שגיאה בעדכון פרופיל" });
  }
});

/// ─── Claim Campaign Bonus (for already-logged-in users) ─────────────────────
router.post("/api/app-auth/claim-campaign", async (req, res) => {
  try {
    const { campaignCode } = req.body as { campaignCode?: string };
    if (!campaignCode) return res.status(400).json({ error: "קוד קמפיין חסר" });

    // Get user from cookie or Manus OAuth
    const appUser = getAppUserFromCookie(req.cookies);
    let userId: number | null = null;

    if (appUser) {
      userId = appUser.userId;
    } else {
      // Try Manus OAuth
      try {
        const manusUser = await sdk.authenticateRequest(req as any);
        if (manusUser?.email) {
          const db = await getDb();
          if (db) {
            const [u] = await db.select({ id: appUsers.id }).from(appUsers).where(eq(appUsers.email, manusUser.email));
            if (u) userId = u.id;
          }
        }
      } catch { /* ignore */ }
    }

    if (!userId) return res.status(401).json({ error: "לא מחובר" });

    const awarded = await awardCampaignBonus(userId, campaignCode);
    return res.json({ success: true, awarded, tokens: awarded ? 20 : 0 });
  } catch (err) {
    console.error("[claim-campaign]", err);
    return res.status(500).json({ error: "שגיאה" });
  }
});

// ─── Logout ───────────────────────────────────────────────────────────────────
router.post("/api/app-auth/logout", (_req, res) => {
  res.clearCookie(APP_USER_COOKIE, { path: "/" });
  return res.json({ success: true });
});

// ─── Get user from request (cookie or Manus OAuth) ────────────────────────────────────────

/** Get app user from request — checks cookie first, then Manus OAuth */
export async function getAppUserFromRequest(
  req: import("express").Request,
  res?: import("express").Response
): Promise<{ userId: number; email: string } | null> {
  // First try app_user_session cookie
  const fromCookie = getAppUserFromCookie(req.cookies);
  if (fromCookie) return fromCookie;
  // Fallback: try Manus OAuth session
  try {
    const manusUser = await sdk.authenticateRequest(req as any);
    if (!manusUser || !manusUser.email) return null;
    const db = await getDb();
    if (!db) return null;
    let [existingAppUser] = await db
      .select({ id: appUsers.id, email: appUsers.email })
      .from(appUsers)
      .where(eq(appUsers.email, manusUser.email));
    if (!existingAppUser) {
      await db.insert(appUsers).values({
        email: manusUser.email,
        name: manusUser.name ?? null,
        tokenBalance: 20,
        emailVerified: 1,
      });
      const [newUser] = await db
        .select({ id: appUsers.id, email: appUsers.email })
        .from(appUsers)
        .where(eq(appUsers.email, manusUser.email));
      existingAppUser = newUser;
    }
    if (!existingAppUser) return null;
    // Auto-set cookie for subsequent requests
    if (res) {
      const token = jwt.sign(
        { userId: existingAppUser.id, email: existingAppUser.email },
        JWT_SECRET,
        { expiresIn: "30d" }
      );
      res.cookie(APP_USER_COOKIE, token, {
        httpOnly: true,
        secure: ENV.isProduction,
        sameSite: ENV.isProduction ? "none" : "lax",
        maxAge: 30 * 24 * 60 * 60 * 1000,
        path: "/",
      });
    }
    return { userId: existingAppUser.id, email: existingAppUser.email };
  } catch {
    return null;
  }
}

// ─── Constants ────────────────────────────────────────────────────────────────────────────────────

export { ANON_DAILY_LIMIT, USER_DAILY_LIMIT, APP_USER_COOKIE };
export default router;
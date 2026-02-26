import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { eq, and, gte, count, sql } from "drizzle-orm";
import { getDb } from "./db";
import { appUsers, usageEvents } from "../drizzle/schema";
import { ENV } from "./_core/env";

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

/** Set app user session cookie */
function setSessionCookie(res: import("express").Response, token: string) {
  res.cookie(APP_USER_COOKIE, token, {
    httpOnly: true,
    secure: ENV.isProduction,
    sameSite: ENV.isProduction ? "none" : "lax",
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
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
    const { name, email, password } = req.body as { name?: string; email?: string; password?: string };
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
    const token = signToken(userId, email.toLowerCase());
    setSessionCookie(res, token);

    return res.json({ success: true, user: { id: userId, email: email.toLowerCase(), name: name?.trim() || null } });
  } catch (err) {
    console.error("[app-auth/register]", err);
    return res.status(500).json({ error: "שגיאה בהרשמה" });
  }
});

// ─── Login with email + password ─────────────────────────────────────────────

router.post("/api/app-auth/login", async (req, res) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) return res.status(400).json({ error: "אימייל וסיסמה נדרשים" });

    const db = await getDb();
    if (!db) return res.status(500).json({ error: "שגיאת מסד נתונים" });

    const [user] = await db.select().from(appUsers).where(eq(appUsers.email, email.toLowerCase()));
    if (!user || !user.passwordHash) return res.status(401).json({ error: "אימייל או סיסמה שגויים" });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: "אימייל או סיסמה שגויים" });

    // Update last login
    await db.update(appUsers).set({ lastLoginAt: new Date() }).where(eq(appUsers.id, user.id));

    const token = signToken(user.id, user.email);
    setSessionCookie(res, token);

    return res.json({ success: true, user: { id: user.id, email: user.email, name: user.name } });
  } catch (err) {
    console.error("[app-auth/login]", err);
    return res.status(500).json({ error: "שגיאה בכניסה" });
  }
});

// ─── Get current user ─────────────────────────────────────────────────────────

router.get("/api/app-auth/me", async (req, res) => {
  const appUser = getAppUserFromCookie(req.cookies);
  if (!appUser) return res.json({ user: null });

  const db = await getDb();
  if (!db) return res.json({ user: null });

  const [user] = await db.select({ id: appUsers.id, email: appUsers.email, name: appUsers.name }).from(appUsers).where(eq(appUsers.id, appUser.userId));
  return res.json({ user: user ?? null });
});

// ─── Logout ───────────────────────────────────────────────────────────────────

router.post("/api/app-auth/logout", (_req, res) => {
  res.clearCookie(APP_USER_COOKIE, { path: "/" });
  return res.json({ success: true });
});

// ─── Constants ────────────────────────────────────────────────────────────────

export { ANON_DAILY_LIMIT, USER_DAILY_LIMIT, APP_USER_COOKIE };
export default router;

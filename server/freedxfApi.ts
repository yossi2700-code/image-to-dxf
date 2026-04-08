/**
 * FreeDXF REST API — cross-domain endpoints consumed by the FreeDXF website.
 * 
 * Endpoints:
 *   GET  /api/freedxf/files          — list approved shared files (public)
 *   GET  /api/freedxf/files/:id      — get single file details (public, no DXF URL unless authenticated)
 *   GET  /api/freedxf/files/:id/download — get DXF download URL (authenticated only)
 *   GET  /api/freedxf/categories     — list all categories with counts
 *   POST /api/freedxf/register       — register a new user (creates dxfai.ai account with FreeDXF source)
 *   POST /api/freedxf/login          — login with email/password
 *   POST /api/freedxf/google-login   — login with Google credential
 *   GET  /api/freedxf/me             — get current user info
 *   POST /api/freedxf/logout         — logout
 */

import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { eq, and, sql, desc, like } from "drizzle-orm";
import { getDb } from "./db";
import { appUsers, sharedFiles, consentRecords, emailVerifications } from "../drizzle/schema";
import { getAppUserFromCookie } from "./appAuth";
import { ENV } from "./_core/env";
import { addTokens } from "./tokenService";
import { sendWelcomeEmail } from "./emailService";
import { randomBytes } from "crypto";

const router = Router();

const JWT_SECRET = ENV.cookieSecret || "fallback-secret-change-me";
const FREEDXF_COOKIE = "freedxf_session";

/** Sign a JWT for a FreeDXF user */
function signFreeDXFToken(userId: number, email: string): string {
  return jwt.sign({ userId, email, source: "freedxf" }, JWT_SECRET, { expiresIn: "30d" });
}

/** Parse FreeDXF user from cookie or Authorization header */
function getFreeDXFUser(req: import("express").Request): { userId: number; email: string } | null {
  // Try cookie first
  const token = req.cookies?.[FREEDXF_COOKIE];
  if (token) {
    try {
      return jwt.verify(token, JWT_SECRET) as { userId: number; email: string };
    } catch { /* invalid */ }
  }
  // Try Authorization header (Bearer token)
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    try {
      return jwt.verify(authHeader.slice(7), JWT_SECRET) as { userId: number; email: string };
    } catch { /* invalid */ }
  }
  return null;
}

/** Set FreeDXF session cookie */
function setFreeDXFCookie(res: import("express").Response, token: string) {
  res.cookie(FREEDXF_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "none", // cross-domain
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    path: "/",
  });
}

// ─── List approved shared files ──────────────────────────────────────────────
router.get("/api/freedxf/files", async (req, res) => {
  try {
    const db = await getDb();
    if (!db) return res.json({ files: [], total: 0 });

    const category = req.query.category as string | undefined;
    const search = req.query.search as string | undefined;
    const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 24, 1), 100);
    const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);

    const conditions: any[] = [eq(sharedFiles.status, "approved")];
    if (category) conditions.push(eq(sharedFiles.category, category));
    if (search) {
      conditions.push(
        sql`(${sharedFiles.title} LIKE ${"%" + search + "%"} OR ${sharedFiles.titleHe} LIKE ${"%" + search + "%"} OR ${sharedFiles.tags} LIKE ${"%" + search + "%"})`
      );
    }

    const whereClause = conditions.length === 1 ? conditions[0] : and(...conditions);

    const [countRow] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(sharedFiles)
      .where(whereClause);
    const total = Number(countRow?.count ?? 0);

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
        svgPreview: sharedFiles.svgPreview,
        lineCount: sharedFiles.lineCount,
        downloadCount: sharedFiles.downloadCount,
        createdAt: sharedFiles.createdAt,
      })
      .from(sharedFiles)
      .where(whereClause)
      .orderBy(desc(sharedFiles.createdAt))
      .limit(limit)
      .offset(offset);

    return res.json({ files, total });
  } catch (err) {
    console.error("[freedxf/files]", err);
    return res.status(500).json({ error: "Internal error" });
  }
});

// ─── Get categories ──────────────────────────────────────────────────────────
router.get("/api/freedxf/categories", async (_req, res) => {
  try {
    const db = await getDb();
    if (!db) return res.json({ categories: [] });

    const rows = await db
      .select({ category: sharedFiles.category, count: sql<number>`COUNT(*)` })
      .from(sharedFiles)
      .where(eq(sharedFiles.status, "approved"))
      .groupBy(sharedFiles.category);

    const categories = rows
      .filter(r => r.category)
      .map(r => ({ name: r.category!, count: Number(r.count) }));

    return res.json({ categories });
  } catch (err) {
    console.error("[freedxf/categories]", err);
    return res.status(500).json({ error: "Internal error" });
  }
});

// ─── Get single file details ─────────────────────────────────────────────────
router.get("/api/freedxf/files/:id", async (req, res) => {
  try {
    const db = await getDb();
    if (!db) return res.status(500).json({ error: "DB unavailable" });

    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });

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
        previewImageUrl: sharedFiles.previewImageUrl,
        svgPreview: sharedFiles.svgPreview,
        lineCount: sharedFiles.lineCount,
        downloadCount: sharedFiles.downloadCount,
        creatorName: sharedFiles.creatorName,
        createdAt: sharedFiles.createdAt,
      })
      .from(sharedFiles)
      .where(and(eq(sharedFiles.id, id), eq(sharedFiles.status, "approved")))
      .limit(1);

    if (!file) return res.status(404).json({ error: "File not found" });

    return res.json({ file });
  } catch (err) {
    console.error("[freedxf/files/:id]", err);
    return res.status(500).json({ error: "Internal error" });
  }
});

// ─── Download file (authenticated only) ──────────────────────────────────────
// Accept both GET and POST (client uses POST, legacy GET also supported)
async function handleFreeDxfDownload(req: import("express").Request, res: import("express").Response) {
  try {
    // Accept either FreeDXF session cookie OR main app session cookie
    const freedxfUser = getFreeDXFUser(req);
    const appUser = getAppUserFromCookie(req.cookies);
    if (!freedxfUser && !appUser) return res.status(401).json({ error: "Authentication required", code: "AUTH_REQUIRED" });

    const db = await getDb();
    if (!db) return res.status(500).json({ error: "DB unavailable" });

    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });

    const [file] = await db
      .select({ id: sharedFiles.id, dxfUrl: sharedFiles.dxfUrl, title: sharedFiles.title })
      .from(sharedFiles)
      .where(and(eq(sharedFiles.id, id), eq(sharedFiles.status, "approved")))
      .limit(1);

    if (!file) return res.status(404).json({ error: "File not found" });

    // Increment download count
    await db
      .update(sharedFiles)
      .set({ downloadCount: sql`${sharedFiles.downloadCount} + 1` })
      .where(eq(sharedFiles.id, id));

    return res.json({ dxfUrl: file.dxfUrl, title: file.title });
  } catch (err) {
    console.error("[freedxf/download]", err);
    return res.status(500).json({ error: "Internal error" });
  }
}
router.get("/api/freedxf/files/:id/download", handleFreeDxfDownload);
router.post("/api/freedxf/files/:id/download", handleFreeDxfDownload);

// ─── Proxy download — streams DXF file with Content-Disposition: attachment ────
// This ensures a save dialog on all devices (iOS, Android, desktop)
router.get("/api/freedxf/files/:id/download-file", async (req, res) => {
  try {
    const freedxfUser = getFreeDXFUser(req);
    const appUser = getAppUserFromCookie(req.cookies);
    if (!freedxfUser && !appUser) return res.status(401).json({ error: "Authentication required", code: "AUTH_REQUIRED" });
    const db = await getDb();
    if (!db) return res.status(500).json({ error: "DB unavailable" });
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
    const [file] = await db
      .select({ id: sharedFiles.id, dxfUrl: sharedFiles.dxfUrl, title: sharedFiles.title })
      .from(sharedFiles)
      .where(and(eq(sharedFiles.id, id), eq(sharedFiles.status, "approved")))
      .limit(1);
    if (!file || !file.dxfUrl) return res.status(404).json({ error: "File not found" });
    // Increment download count
    await db.update(sharedFiles).set({ downloadCount: sql`${sharedFiles.downloadCount} + 1` }).where(eq(sharedFiles.id, id));
    // Proxy the file with proper download headers
    const upstream = await fetch(file.dxfUrl);
    if (!upstream.ok) return res.status(502).json({ error: "Failed to fetch file" });
    const filename = encodeURIComponent((file.title || `freedxf-${id}`) + ".dxf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"; filename*=UTF-8''${filename}`);
    res.setHeader("Content-Type", "application/dxf");
    const contentLength = upstream.headers.get("content-length");
    if (contentLength) res.setHeader("Content-Length", contentLength);
    const body = upstream.body as unknown as import("stream").Readable;
    if (body && typeof body.pipe === "function") {
      body.pipe(res);
    } else {
      const buf = Buffer.from(await upstream.arrayBuffer());
      res.send(buf);
    }
  } catch (err) {
    console.error("[freedxf/download-file]", err);
    return res.status(500).json({ error: "Internal error" });
  }
});

// ─── Register (creates dxfai.ai account with FreeDXF source) ────────────────
router.post("/api/freedxf/register", async (req, res) => {
  try {
    const { name, email, password, language } = req.body as {
      name?: string;
      email?: string;
      password?: string;
      language?: string;
    };
    if (!email || !password) return res.status(400).json({ error: "Email and password required" });
    if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });

    const db = await getDb();
    if (!db) return res.status(500).json({ error: "Database error" });

    // Check if email already exists
    const [existing] = await db.select({ id: appUsers.id }).from(appUsers).where(eq(appUsers.email, email.toLowerCase()));
    if (existing) return res.status(409).json({ error: "Email already registered" });

    const passwordHash = await bcrypt.hash(password, 10);
    const [result] = await db.insert(appUsers).values({
      name: name?.trim() || null,
      email: email.toLowerCase(),
      passwordHash,
      tokenBalance: 10,
      registrationSource: "freedxf",
      language: language === "he" ? "he" : "en",
    });

    const userId = (result as { insertId: number }).insertId;

    // Record consent
    try {
      const rawIp = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "";
      const parts = rawIp.split(".");
      const ipAnon = parts.length === 4 ? `${parts[0]}.${parts[1]}.${parts[2]}.0` : rawIp.substring(0, 16);
      await db.insert(consentRecords).values({
        appUserId: userId,
        email: email.toLowerCase(),
        termsVersion: "2026-03-10",
        privacyVersion: "2026-03-10",
        ipAnon,
        userAgent: (req.headers["user-agent"] ?? "").substring(0, 500),
      });
    } catch (e) {
      console.warn("[freedxf/register] Failed to save consent:", e);
    }

    // Send welcome email
    void sendWelcomeEmail({
      to: email.toLowerCase(),
      name: name?.trim() || null,
      tokens: 10,
      siteUrl: "https://dxfai.ai",
      language: language === "he" ? "he" : "en",
    });

    const token = signFreeDXFToken(userId, email.toLowerCase());
    setFreeDXFCookie(res, token);

    return res.json({
      success: true,
      token, // Also return token for localStorage fallback
      user: { id: userId, email: email.toLowerCase(), name: name?.trim() || null, tokenBalance: 10 },
    });
  } catch (err) {
    console.error("[freedxf/register]", err);
    return res.status(500).json({ error: "Registration error" });
  }
});

// ─── Login ───────────────────────────────────────────────────────────────────
router.post("/api/freedxf/login", async (req, res) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) return res.status(400).json({ error: "Email and password required" });

    const db = await getDb();
    if (!db) return res.status(500).json({ error: "Database error" });

    const [user] = await db.select().from(appUsers).where(eq(appUsers.email, email.toLowerCase()));
    if (!user || !user.passwordHash) return res.status(401).json({ error: "Invalid email or password" });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: "Invalid email or password" });

    await db.update(appUsers).set({ lastLoginAt: new Date() }).where(eq(appUsers.id, user.id));

    const token = signFreeDXFToken(user.id, user.email);
    setFreeDXFCookie(res, token);

    return res.json({
      success: true,
      token,
      user: { id: user.id, email: user.email, name: user.name, tokenBalance: user.tokenBalance },
    });
  } catch (err) {
    console.error("[freedxf/login]", err);
    return res.status(500).json({ error: "Login error" });
  }
});

// ─── Google Login ────────────────────────────────────────────────────────────
router.post("/api/freedxf/google-login", async (req, res) => {
  try {
    const { credential, language } = req.body as { credential?: string; language?: string };
    if (!credential) return res.status(400).json({ error: "Google credential missing" });

    const { OAuth2Client } = await import("google-auth-library");
    const client = new OAuth2Client(ENV.googleClientId);

    let payload: import("google-auth-library").TokenPayload;
    try {
      const ticket = await client.verifyIdToken({
        idToken: credential,
        audience: ENV.googleClientId,
      });
      const p = ticket.getPayload();
      if (!p) throw new Error("No payload");
      payload = p;
    } catch (e) {
      console.error("[freedxf/google] Token verification failed:", e);
      return res.status(401).json({ error: "Google authentication failed" });
    }

    const email = payload.email?.toLowerCase();
    const name = payload.name ?? payload.given_name ?? null;
    const googleSub = payload.sub;
    if (!email) return res.status(400).json({ error: "Cannot get email from Google" });

    const db = await getDb();
    if (!db) return res.status(500).json({ error: "Database error" });

    let [user] = await db
      .select({ id: appUsers.id, email: appUsers.email, name: appUsers.name, tokenBalance: appUsers.tokenBalance })
      .from(appUsers)
      .where(eq(appUsers.email, email));

    let isNewUser = false;
    if (!user) {
      isNewUser = true;
      const [result] = await db.insert(appUsers).values({
        email,
        name: name ?? null,
        emailVerified: 1,
        tokenBalance: 10,
        googleId: googleSub,
        registrationSource: "freedxf",
        language: language === "he" ? "he" : "en",
      });
      const insertId = (result as { insertId: number }).insertId;
      const [newUser] = await db
        .select({ id: appUsers.id, email: appUsers.email, name: appUsers.name, tokenBalance: appUsers.tokenBalance })
        .from(appUsers)
        .where(eq(appUsers.id, insertId));
      user = newUser;

      void sendWelcomeEmail({
        to: email,
        name: name ?? null,
        tokens: 10,
        siteUrl: "https://dxfai.ai",
        language: language === "he" ? "he" : "en",
      });
    } else {
      await db.update(appUsers)
        .set({ lastLoginAt: new Date(), googleId: googleSub })
        .where(eq(appUsers.id, user.id));
    }

    if (!user) return res.status(500).json({ error: "User creation error" });

    const token = signFreeDXFToken(user.id, user.email);
    setFreeDXFCookie(res, token);

    return res.json({
      success: true,
      token,
      user: { id: user.id, email: user.email, name: user.name, tokenBalance: user.tokenBalance },
      isNewUser,
    });
  } catch (err) {
    console.error("[freedxf/google-login]", err);
    return res.status(500).json({ error: "Google login error" });
  }
});

// ─── Get current user ────────────────────────────────────────────────────────
router.get("/api/freedxf/me", async (req, res) => {
  try {
    const userData = getFreeDXFUser(req);
    if (!userData) return res.json({ user: null });

    const db = await getDb();
    if (!db) return res.json({ user: null });

    const [user] = await db
      .select({ id: appUsers.id, email: appUsers.email, name: appUsers.name, tokenBalance: appUsers.tokenBalance })
      .from(appUsers)
      .where(eq(appUsers.id, userData.userId));

    return res.json({ user: user ?? null });
  } catch (err) {
    console.error("[freedxf/me]", err);
    return res.json({ user: null });
  }
});

/// ─── Logout ──────────────────────────────────────────────────────────────────
router.post("/api/freedxf/logout", (_req, res) => {
  res.clearCookie(FREEDXF_COOKIE, { path: "/", sameSite: "none", secure: true });
  return res.json({ success: true });
});

// ─── Image proxy (for CloudFront preview images) ─────────────────────────────
// Proxies preview images through the server to avoid browser CORS/network issues
router.get("/api/freedxf/image-proxy", async (req, res) => {
  const url = req.query.url as string;
  if (!url) return res.status(400).json({ error: "Missing url" });
  // Only allow our CloudFront domain
  if (!url.startsWith("https://d2xsxph8kpxj0f.cloudfront.net/")) {
    return res.status(403).json({ error: "Forbidden" });
  }
  try {
    const response = await fetch(url);
    if (!response.ok) return res.status(response.status).end();
    const contentType = response.headers.get("content-type") || "image/png";
    const buffer = await response.arrayBuffer();
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=86400");
    return res.send(Buffer.from(buffer));
  } catch (err) {
    console.error("[image-proxy]", err);
    return res.status(500).end();
  }
});

export default router;

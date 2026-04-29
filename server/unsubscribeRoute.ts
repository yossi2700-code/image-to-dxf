/**
 * unsubscribeRoute.ts
 * Handles one-click email unsubscribe.
 * GET /api/unsubscribe?token=<jwt>
 * The token is a signed JWT containing { userId, purpose: "unsubscribe" }.
 */

import { Router } from "express";
import jwt from "jsonwebtoken";
import { getDb } from "./db";
import { appUsers } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { ENV } from "./_core/env";

const JWT_SECRET = process.env.JWT_SECRET ?? ENV.cookieSecret;

const router = Router();

/** Generate an unsubscribe token for a user (call from emailService) */
export function generateUnsubscribeToken(userId: number): string {
  return jwt.sign(
    { userId, purpose: "unsubscribe" },
    JWT_SECRET,
    { expiresIn: "365d" }
  );
}

router.get("/api/unsubscribe", async (req, res) => {
  const token = req.query.token as string | undefined;

  if (!token) {
    return res.status(400).send(unsubscribePage("שגיאה", "קישור לא תקין.", false));
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: number; purpose: string };

    if (payload.purpose !== "unsubscribe") {
      return res.status(400).send(unsubscribePage("שגיאה", "קישור לא תקין.", false));
    }

    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    await db
      .update(appUsers)
      .set({ emailOptOut: 1 })
      .where(eq(appUsers.id, payload.userId));

    return res.send(unsubscribePage(
      "הוסרת בהצלחה",
      "הוסרת מרשימת הדיוור. לא תקבל עוד מיילים שיווקיים מ-DXF AI.",
      true
    ));
  } catch {
    return res.status(400).send(unsubscribePage("שגיאה", "הקישור פג תוקף או אינו תקין.", false));
  }
});

function unsubscribePage(title: string, message: string, success: boolean): string {
  const color = success ? "#22c55e" : "#ef4444";
  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${title} — DXF AI</title>
  <style>
    body { margin:0; padding:0; background:#0f0f0f; font-family:Arial,sans-serif; display:flex; align-items:center; justify-content:center; min-height:100vh; }
    .card { background:#1a1a1a; border:1px solid #2a2a2a; border-radius:16px; padding:48px 40px; max-width:420px; text-align:center; }
    .icon { font-size:48px; margin-bottom:16px; }
    h1 { color:${color}; font-size:22px; margin:0 0 12px; }
    p { color:#71717a; font-size:14px; line-height:1.7; margin:0 0 24px; }
    a { color:#6366f1; font-size:13px; text-decoration:none; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${success ? "✅" : "❌"}</div>
    <h1>${title}</h1>
    <p>${message}</p>
    <a href="https://dxfai.ai">חזרה לאתר ←</a>
  </div>
</body>
</html>`;
}

export default router;

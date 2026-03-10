/**
 * paypalRoute.ts — PayPal payment routes
 * POST /api/paypal/create-order  — create PayPal order
 * POST /api/paypal/capture-order — capture + credit tokens
 * GET  /api/paypal/status        — check if PayPal is configured
 * GET  /api/paypal/order/:id     — get order details
 */
import express from "express";
import { getDb } from "./db";
import { paypalOrders } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { getAppUserFromCookie } from "./appAuth";
import { addTokens } from "./tokenService";
import { createPayPalOrder, capturePayPalOrder, isPayPalConfigured, getPayPalMode, getPayPalClientId } from "./paypal";
import { getPackageById } from "./products";
import { packagePrices as packagePricesTable } from "../drizzle/schema";
import { sendPurchaseConfirmationEmail } from "./emailService";
import { appUsers } from "../drizzle/schema";
import { eq as eqDrizzle } from "drizzle-orm";

const router = express.Router();

function anonymizeIp(ip: string): string {
  if (!ip) return "";
  if (ip.includes(":")) return ip.split(":").slice(0, 4).join(":") + ":xxxx";
  const parts = ip.split(".");
  if (parts.length === 4) return `${parts[0]}.${parts[1]}.${parts[2]}.x`;
  return ip;
}

function getClientIp(req: express.Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0].trim();
  return req.socket?.remoteAddress ?? "";
}

router.get("/api/paypal/status", (_req, res) => {
  res.json({ configured: isPayPalConfigured(), mode: getPayPalMode(), clientId: getPayPalClientId() });
});

router.post("/api/paypal/create-order", async (req, res) => {
  try {
    const authUser = getAppUserFromCookie(req.cookies);
    if (!authUser) return res.status(401).json({ error: "התחבר כדי לרכוש אסימונים" });
    const user = { id: authUser.userId, email: authUser.email };

    const { packageId, currency = "USD", termsAccepted, origin } = req.body as {
      packageId?: string;
      currency?: string;
      termsAccepted?: boolean;
      origin?: string;
    };

    if (!packageId) return res.status(400).json({ error: "packageId נדרש" });
    if (!termsAccepted) return res.status(400).json({ error: "יש לאשר את תנאי הרכישה" });

    // Load price from DB (admin-editable) first, fall back to products.ts
    const db = await getDb();
    if (!db) return res.status(500).json({ error: "שגיאת מסד נתונים" });

    const [dbPkg] = await db
      .select()
      .from(packagePricesTable)
      .where(eq(packagePricesTable.packageId, packageId));

    // Resolve price: prefer DB, fall back to products.ts
    let resolvedAmount: string;
    let resolvedCurrency: string;
    let resolvedTokens: number;

    if (dbPkg) {
      resolvedTokens = dbPkg.tokenAmount;
      const currencyMap: Record<string, string> = {
        USD: dbPkg.priceUSD, EUR: dbPkg.priceEUR, ILS: dbPkg.priceILS,
        GBP: dbPkg.priceGBP, AUD: dbPkg.priceAUD, CAD: dbPkg.priceCAD, JPY: dbPkg.priceJPY,
      };
      resolvedAmount = currencyMap[currency] ?? dbPkg.priceUSD;
      resolvedCurrency = currencyMap[currency] ? currency : "USD";
    } else {
      const pkg = getPackageById(packageId);
      if (!pkg) return res.status(400).json({ error: "חבילה לא קיימת" });
      const price = pkg.prices[currency] ?? pkg.prices["DEFAULT"];
      resolvedAmount = price.amount;
      resolvedCurrency = price.currency;
      resolvedTokens = pkg.tokens;
    }

    const safeOrigin = origin ?? `${req.protocol}://${req.get("host")}`;

    const paypalOrder = await createPayPalOrder({
      packageId,
      tokens: resolvedTokens,
      amount: resolvedAmount,
      currency: resolvedCurrency,
      userId: user.id,
      returnUrl: `${safeOrigin}/buy/success`,
      cancelUrl: `${safeOrigin}/buy?cancelled=1`,
    });

    await db.insert(paypalOrders).values({
      appUserId: user.id,
      paypalOrderId: paypalOrder.id,
      packageId,
      tokenAmount: resolvedTokens,
      priceAmount: resolvedAmount,
      currency: resolvedCurrency,
      status: "pending",
      tokensCredited: 0,
      termsAccepted: 1,
      ipAnon: anonymizeIp(getClientIp(req)),
    });

    const approvalLink = paypalOrder.links.find((l) => l.rel === "approve");
    return res.json({ orderId: paypalOrder.id, approvalUrl: approvalLink?.href });
  } catch (err) {
    console.error("[paypal/create-order]", err);
    return res.status(500).json({ error: "שגיאה ביצירת הזמנה" });
  }
});

router.post("/api/paypal/capture-order", async (req, res) => {
  try {
    const authUser = getAppUserFromCookie(req.cookies);
    if (!authUser) return res.status(401).json({ error: "לא מחובר" });
    const user = { id: authUser.userId, email: authUser.email };

    const { orderId } = req.body as { orderId?: string };
    if (!orderId) return res.status(400).json({ error: "orderId נדרש" });

    const db = await getDb();
    if (!db) return res.status(500).json({ error: "שגיאת מסד נתונים" });

    const [dbOrder] = await db
      .select()
      .from(paypalOrders)
      .where(eq(paypalOrders.paypalOrderId, orderId));

    if (!dbOrder) return res.status(404).json({ error: "הזמנה לא נמצאה" });
    if (dbOrder.appUserId !== user.id) return res.status(403).json({ error: "אין הרשאה" });
    if (dbOrder.status === "completed") {
      return res.json({ success: true, alreadyCaptured: true, tokens: dbOrder.tokenAmount });
    }

    const capture = await capturePayPalOrder(orderId);

    if (capture.status !== "COMPLETED") {
      await db
        .update(paypalOrders)
        .set({ status: "failed" })
        .where(eq(paypalOrders.paypalOrderId, orderId));
      return res.status(400).json({ error: `תשלום נכשל: ${capture.status}` });
    }

    if (!dbOrder.tokensCredited) {
      await addTokens(
        user.id,
        dbOrder.tokenAmount,
        "paypal_purchase",
        `PayPal order ${orderId} — ${dbOrder.tokenAmount} tokens`
      );
    }

    await db
      .update(paypalOrders)
      .set({ status: "completed", tokensCredited: 1, completedAt: new Date() })
      .where(eq(paypalOrders.paypalOrderId, orderId));

    // Send purchase confirmation email (fire-and-forget)
    try {
      const [userRow] = await db
        .select({ name: appUsers.name, email: appUsers.email })
        .from(appUsers)
        .where(eqDrizzle(appUsers.id, user.id));
      if (userRow?.email) {
        const origin = (req.headers["x-forwarded-proto"]
          ? `${req.headers["x-forwarded-proto"]}://${req.headers["x-forwarded-host"]}`
          : `${req.protocol}://${req.get("host")}`);
        const lang = (req.headers["accept-language"] ?? "").startsWith("he") ? "he" : "en";
        void sendPurchaseConfirmationEmail({
          to: userRow.email,
          name: userRow.name ?? null,
          tokens: dbOrder.tokenAmount,
          amount: dbOrder.priceAmount,
          currency: dbOrder.currency,
          orderId,
          siteUrl: origin,
          language: lang,
        });
      }
    } catch (e) {
      console.warn("[paypal/capture-order] Failed to send confirmation email:", e);
    }

    return res.json({
      success: true,
      tokens: dbOrder.tokenAmount,
      orderId,
      packageId: dbOrder.packageId,
      amount: dbOrder.priceAmount,
      currency: dbOrder.currency,
    });
  } catch (err) {
    console.error("[paypal/capture-order]", err);
    return res.status(500).json({ error: "שגיאה באישור התשלום" });
  }
});

router.get("/api/paypal/order/:orderId", async (req, res) => {
  try {
    const authUser = getAppUserFromCookie(req.cookies);
    if (!authUser) return res.status(401).json({ error: "לא מחובר" });
    const user = { id: authUser.userId, email: authUser.email };

    const { orderId } = req.params;
    const db = await getDb();
    if (!db) return res.status(500).json({ error: "שגיאת מסד נתונים" });

    const [dbOrder] = await db
      .select()
      .from(paypalOrders)
      .where(eq(paypalOrders.paypalOrderId, orderId));

    if (!dbOrder || dbOrder.appUserId !== user.id) {
      return res.status(404).json({ error: "הזמנה לא נמצאה" });
    }

    return res.json(dbOrder);
  } catch (err) {
    console.error("[paypal/order]", err);
    return res.status(500).json({ error: "שגיאה" });
  }
});

export default router;

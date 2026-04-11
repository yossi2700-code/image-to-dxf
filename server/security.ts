/**
 * security.ts — Centralized security middleware for the DXF AI platform.
 *
 * Layers applied:
 *  1. Helmet — sets secure HTTP headers (CSP, HSTS, X-Frame-Options, etc.)
 *  2. Global rate limiter — prevents brute-force / DDoS on all API routes
 *  3. Auth rate limiter — stricter limit on login/register endpoints
 *  4. Upload rate limiter — prevents abuse of the paid conversion pipeline
 *  5. Input sanitizer — strips null bytes and oversized strings from req.body
 *  6. IP extractor — consistent helper used everywhere
 */

import helmet from "helmet";
import rateLimit from "express-rate-limit";
import type { Request, Response, NextFunction } from "express";

// ── 1. Helmet ─────────────────────────────────────────────────────────────────
export const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'",   // Vite HMR in dev; tighten in prod if possible
        "'unsafe-eval'",     // Required by some bundled libs
        "https://www.paypal.com",
        "https://www.sandbox.paypal.com",
        "https://www.paypalobjects.com",
        "https://*.paypal.com",
        "https://*.paypalobjects.com",
        "https://js.stripe.com",
        "https://fonts.googleapis.com",
      ],
      styleSrc: [
        "'self'",
        "'unsafe-inline'",
        "https://fonts.googleapis.com",
      ],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      imgSrc: ["'self'", "data:", "blob:", "https:", "http:"],
      connectSrc: [
        "'self'",
        "https://api.paypal.com",
        "https://api-m.paypal.com",
        "https://www.paypal.com",
        "https://www.sandbox.paypal.com",
        "https://api-m.sandbox.paypal.com",
        "https://*.paypal.com",
        "https://*.paypalobjects.com",
        "https://api.resend.com",
        "https://*.manus.computer",
        "https://*.manus.space",
        "wss:",
        "ws:",
      ],
      frameSrc: [
        "'self'",
        "https://www.paypal.com",
        "https://www.sandbox.paypal.com",
        "https://*.paypal.com",
        "https://*.paypalobjects.com",
      ],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  },
  // HSTS: enforce HTTPS for 1 year (only in production)
  strictTransportSecurity: process.env.NODE_ENV === "production"
    ? { maxAge: 31536000, includeSubDomains: true }
    : false,
  // Prevent clickjacking
  frameguard: { action: "sameorigin" },
  // Hide X-Powered-By
  hidePoweredBy: true,
  // Prevent MIME sniffing
  noSniff: true,
  // XSS filter (legacy browsers)
  xssFilter: true,
  // Referrer policy
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  // Permissions policy — disable unused browser features
  permittedCrossDomainPolicies: false,
  // Cross-Origin policies
  crossOriginEmbedderPolicy: false, // Allow embedding external resources (images, CDN)
  crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" }, // Allow OAuth popups
  crossOriginResourcePolicy: { policy: "cross-origin" }, // Allow CDN resources
});

// ── Permissions-Policy middleware (not in helmet by default) ──────────────────
export function permissionsPolicyMiddleware(req: Request, res: Response, next: NextFunction): void {
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(self), usb=(), fullscreen=(self)"
  );
  next();
}

// ── 2. Global API rate limiter ────────────────────────────────────────────────
// 300 requests per 5 minutes per IP — generous for normal use, blocks scrapers
export const globalApiLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 300,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req) => getClientIp(req),
  message: { error: "יותר מדי בקשות. נסה שוב בעוד מספר דקות." },
  skip: (req) => {
    // Skip static assets
    const url = req.url ?? "";
    return url.startsWith("/assets/") || url.endsWith(".js") || url.endsWith(".css");
  },
});

// ── 3. Auth rate limiter ──────────────────────────────────────────────────────
// 20 requests per 15 minutes per IP — prevents credential stuffing
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req) => getClientIp(req),
  message: { error: "יותר מדי ניסיונות כניסה. נסה שוב בעוד 15 דקות." },
});

// ── 4. Upload / conversion rate limiter ──────────────────────────────────────
// 100 conversions per 10 minutes per IP — prevents token farming via automation
export const uploadLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 100,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req) => getClientIp(req),
  message: { error: "הגעת למגבלת ההמרות לדקות אלו. נסה שוב בעוד מעט." },
});

// ── 5. Input sanitizer middleware ─────────────────────────────────────────────
// Strips null bytes (\x00) and truncates oversized string fields to 10 000 chars.
// Runs before route handlers so malicious payloads never reach business logic.
const MAX_STRING_LENGTH = 10_000;

function sanitizeValue(value: unknown, depth = 0): unknown {
  if (depth > 5) return value; // prevent deeply nested object abuse
  if (typeof value === "string") {
    // Remove null bytes (SQL injection / log injection vector)
    let sanitized = value.replace(/\x00/g, "");
    // Truncate oversized strings
    if (sanitized.length > MAX_STRING_LENGTH) {
      sanitized = sanitized.slice(0, MAX_STRING_LENGTH);
    }
    return sanitized;
  }
  if (Array.isArray(value)) {
    return value.slice(0, 500).map((v) => sanitizeValue(v, depth + 1));
  }
  if (value !== null && typeof value === "object") {
    const sanitized: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      // Limit object key length
      const safeKey = k.slice(0, 128);
      sanitized[safeKey] = sanitizeValue(v, depth + 1);
    }
    return sanitized;
  }
  return value;
}

export function inputSanitizer(req: Request, _res: Response, next: NextFunction): void {
  // Exempt SVG-to-PNG route — SVG content can be 100k–500k chars and must not be truncated
  if (req.path === "/api/svg-to-png") {
    return next();
  }
  // Exempt tRPC routes — they have their own zod validation, and SVG preview data
  // in shared files can exceed 10k chars and must not be truncated
  if (req.path.startsWith("/api/trpc")) {
    return next();
  }
  if (req.body && typeof req.body === "object") {
    req.body = sanitizeValue(req.body) as Record<string, unknown>;
  }
  next();
}

// ── 6. IP extractor ───────────────────────────────────────────────────────────
// Consistent IP extraction used across rate limiters and logging.
// Handles Cloudflare (CF-Connecting-IP), load balancers (X-Forwarded-For), direct.
export function getClientIp(req: Request | { headers: Record<string, string | string[] | undefined>; socket?: { remoteAddress?: string } }): string {
  const h = (req as Request).headers;

  // Cloudflare sets this header — most reliable when behind CF
  const cfIp = h["cf-connecting-ip"];
  if (cfIp && typeof cfIp === "string") return cfIp.trim();

  // Standard proxy header
  const forwarded = h["x-forwarded-for"];
  if (forwarded) {
    const ip = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(",")[0];
    return ip.trim();
  }

  return (req as { socket?: { remoteAddress?: string } }).socket?.remoteAddress ?? "unknown";
}

// ── 7. Anonymize IP (last octet → 'x') ───────────────────────────────────────
export function anonymizeIp(ip: string): string {
  // IPv4: 1.2.3.4 → 1.2.3.x
  const v4 = ip.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3})\.\d{1,3}$/);
  if (v4) return `${v4[1]}.x`;
  // IPv6: truncate to /48 prefix
  if (ip.includes(":")) {
    const parts = ip.split(":");
    return parts.slice(0, 3).join(":") + "::x";
  }
  return ip;
}

// ── 8. Admin session validator ────────────────────────────────────────────────
// Validates admin cookie AND checks for a timing-safe comparison.
const ADMIN_COOKIE = "admin_session";

export function isAdminRequest(req: Request): boolean {
  const cookies = (req as { cookies?: Record<string, string> }).cookies ?? {};
  const sessionValue = cookies[ADMIN_COOKIE];
  if (!sessionValue) return false;
  // Constant-time comparison to prevent timing attacks
  const expected = "authenticated";
  if (sessionValue.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= sessionValue.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

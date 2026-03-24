import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import uploadRoute from "../uploadRoute";
import generateRoute from "../generateRoute";
import appAuthRoute from "../appAuth";
import aiTraceRoute from "../aiTraceRoute";
import aiRefineRoute from "../aiRefineRoute";
import aiDocumentRedrawRoute from "../aiDocumentRedrawRoute";
import svgToPngRoute from "../svgToPngRoute";
import faceDetectRoute from "../faceDetectRoute";
import paypalRoute from "../paypalRoute";
import cncReliefRoute from "../cncReliefRoute";
import dxfLegacyRoute from "../dxfLegacyRoute";
import {
  helmetMiddleware,
  permissionsPolicyMiddleware,
  globalApiLimiter,
  authLimiter,
  uploadLimiter,
  inputSanitizer,
} from "../security";
import { startReminderScheduler } from "../reminderScheduler";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  // ── Security: Helmet (HTTP headers) ─────────────────────────────────────────────────────
  app.use(helmetMiddleware);
  app.use(permissionsPolicyMiddleware);

  // ── Force HTTPS in production ────────────────────────────────────────────────
  app.use((req, res, next) => {
    const proto = req.headers["x-forwarded-proto"];
    const isHttps = proto === "https" || (Array.isArray(proto) && proto[0] === "https");
    if (process.env.NODE_ENV === "production" && !isHttps) {
      return res.redirect(301, `https://${req.headers.host}${req.originalUrl}`);
    }
    return next();
  });

  // ── Primary domain redirect (dxfai.ai) ────────────────────────────────────────
  // All other domains redirect to dxfai.ai
  // Using 302 (temporary) instead of 301 (permanent) to prevent browsers from caching
  // the redirect and breaking cookie-based sessions (cookies are domain-specific)
  const PRIMARY_DOMAIN = "dxfai.ai";
  const REDIRECT_DOMAINS = new Set([
    "dxfai.net", "www.dxfai.net",
    "dxfai.org", "www.dxfai.org",
    "www.dxfai.ai",
    "dxfai.ai",
  ]);
  app.use((req, res, next) => {
    if (process.env.NODE_ENV !== "production") return next();
    const host = (req.headers.host || "").split(":")[0].toLowerCase();
    if (REDIRECT_DOMAINS.has(host)) {
      // 302 = temporary redirect, not cached by browsers
      // This ensures cookies set on dxfai.ai are always sent on subsequent requests
      return res.redirect(302, `https://${PRIMARY_DOMAIN}${req.originalUrl}`);
    }
    return next();
  });

  // ── Body parsers ─────────────────────────────────────────────────────────────
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // ── Cookie parser ────────────────────────────────────────────────────────────
  app.use(cookieParser());

  // ── Input sanitizer (null bytes, oversized strings) ──────────────────────────
  app.use(inputSanitizer);

  // ── Rate limiting ────────────────────────────────────────────────────────────
  // Global: 300 req / 5 min per IP on all /api routes
  app.use("/api", globalApiLimiter);
  // Auth: 20 req / 15 min per IP — prevents credential stuffing
  app.use("/api/app-auth/login", authLimiter);
  app.use("/api/app-auth/register", authLimiter);
  app.use("/api/app-auth/forgot-password", authLimiter);
  app.use("/api/app-auth/reset-password", authLimiter);
  // Conversion: 30 req / 10 min per IP — prevents token farming
  app.use("/api/upload", uploadLimiter);
  app.use("/api/generate", uploadLimiter);
  app.use("/api/ai-trace", uploadLimiter);
  app.use("/api/ai-refine", uploadLimiter);
  app.use("/api/face-detect", uploadLimiter);
  app.use("/api/ai-document-redraw", uploadLimiter);

  // ── Routes ───────────────────────────────────────────────────────────────────
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // App user auth routes (register, login, logout, me)
  app.use(appAuthRoute);
  // Image upload & conversion route
  app.use(uploadRoute);
  // AI image generation route
  app.use(generateRoute);
  // AI Trace route (image → GPT-4o Vision → SVG → DXF)
  app.use(aiTraceRoute);
  // AI Refine route (existing image + instruction → refined image → DXF)
  app.use(aiRefineRoute);
  // AI Document Redraw route (photo/document → faithful line art → DXF)
  app.use(aiDocumentRedrawRoute);
  // SVG → PNG conversion route (used by PDF export on iOS/Safari)
  app.use(svgToPngRoute);
  // Face Detection route (photo → GPT-4o Vision → portrait line art → DXF)
  app.use(faceDetectRoute);
  // PayPal payment routes
  app.use(paypalRoute);
  // CNC Relief route (image/prompt → heightmap + simulation)
  app.use(cncReliefRoute);
  app.use("/api/cnc-relief", uploadLimiter);
  // DXF Legacy conversion route (LWPOLYLINE → LINE entities for CAS WIN / old CAD)
  app.use(dxfLegacyRoute);

  // ── tRPC API ─────────────────────────────────────────────────────────────────
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  // ── Frontend ─────────────────────────────────────────────────────────────────
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
    // Start the 48h bonus reminder scheduler
    startReminderScheduler();
  });
}

startServer().catch(console.error);

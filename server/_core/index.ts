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
  // Force HTTPS redirect in production (handles Cloudflare and direct HTTP)
  app.use((req, res, next) => {
    const proto = req.headers["x-forwarded-proto"];
    const isHttps = proto === "https" || (Array.isArray(proto) && proto[0] === "https");
    if (process.env.NODE_ENV === "production" && !isHttps) {
      return res.redirect(301, `https://${req.headers.host}${req.originalUrl}`);
    }
    return next();
  });
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // Parse cookies so req.cookies is populated for admin auth
  app.use(cookieParser());
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
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
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
  });
}

startServer().catch(console.error);

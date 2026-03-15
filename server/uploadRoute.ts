import { Router } from "express";
import multer from "multer";
import { convertImageToDxf } from "./imageProcessor";
import { storagePut } from "./storage";
import { nanoid } from "nanoid";
import { logUsageEvent, anonymizeIp } from "./usageDb";
import { getAppUserFromCookie } from "./appAuth";
import { recordUserAction } from "./userActionsDb";
import { checkUsageLimit } from "./usageLimits";

const router = Router();

// Store files in memory (max 20 MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/png", "image/jpeg", "image/bmp", "image/webp"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("סוג קובץ לא נתמך. אנא העלה PNG, JPG או BMP."));
    }
  },
});

router.post("/api/convert", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "לא הועלתה תמונה" });
    }

    const rawIp = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
    const ipAnon = anonymizeIp(rawIp);
    const appUser = getAppUserFromCookie(req.cookies);

    // Only registered users may convert
    if (!appUser?.userId) {
      return res.status(401).json({ error: "REGISTRATION_REQUIRED", message: "נדרשת הרשמה כדי לבצע המרה" });
    }

    // Check usage limit
    const limitCheck = await checkUsageLimit(appUser.userId);
    if (!limitCheck.allowed) {
      let quotaMessage: string;
      if (limitCheck.reason === "daily") {
        quotaMessage = `הגעת למכסה החינמית של ${limitCheck.max} עיצובים ליום. יש לטעון אסימונים להמשך שימוש.`;
      } else if (limitCheck.reason === "expired") {
        quotaMessage = `תקופת הניסיון החינמית הסתיימה. יש לטעון אסימונים להמשך שימוש.`;
      } else {
        quotaMessage = `הגעת למכסה החינמית. לפרטים נוספים ולשדרוג, פנה למפתח התוכנה — רובוטיקה וטכנולוגיה.`;
      }
      return res.status(403).json({
        error: "QUOTA_EXCEEDED",
        message: quotaMessage,
        used: limitCheck.used,
        max: limitCheck.max,
      });
    }

    const threshold = parseInt((req.body.threshold as string) ?? "128", 10);
    const simplifyTolerance = parseFloat((req.body.simplifyTolerance as string) ?? "2");
    const doubleLineOffset = parseFloat((req.body.doubleLineOffset as string) ?? "0");
    const hairline = (req.body.hairline as string) === "true";
    const lineweightMmRaw = parseFloat((req.body.lineweightMm as string) ?? "");
    const lineweightMm = isNaN(lineweightMmRaw) ? undefined : Math.min(2.0, Math.max(0, lineweightMmRaw));
    const minGapMmRaw = parseFloat((req.body.minGapMm as string) ?? "0");
    const minGapMm = isNaN(minGapMmRaw) ? 0 : Math.min(5.0, Math.max(0, minGapMmRaw));
    const outputWidthMmRaw = parseFloat((req.body.outputWidthMm as string) ?? "100");
    const outputWidthMm = isNaN(outputWidthMmRaw) ? 100 : Math.min(2000, Math.max(10, outputWidthMmRaw));
    const dpiRaw = parseInt((req.body.dpi as string) ?? "300", 10);
    const dpi = isNaN(dpiRaw) ? 300 : Math.min(1200, Math.max(72, dpiRaw));

    const CONVERT_TIMEOUT_MS = 45_000; // 45 seconds
    const convertPromise = convertImageToDxf(
      req.file.buffer,
      {
        threshold: Math.min(255, Math.max(0, threshold)),
        simplifyTolerance,
        doubleLineOffset: Math.min(20, Math.max(0, doubleLineOffset)),
        hairline,
        lineweightMm,
        minGapMm,
        outputWidthMm,
        dpi,
      }
    );
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("CONVERT_TIMEOUT")), CONVERT_TIMEOUT_MS)
    );
    const { dxf, svgPreview, segmentCount, width, height, realWidth, realHeight } =
      await Promise.race([convertPromise, timeoutPromise]);

    if (segmentCount === 0) {
      return res.status(422).json({
        error: "לא נמצאו קווים בתמונה. נסה להתאים את ערך הסף.",
      });
    }

    // Upload DXF to S3
    const key = `dxf-output/${nanoid()}.dxf`;
    const { url } = await storagePut(key, Buffer.from(dxf, "utf-8"), "application/dxf");

    // Upload original image thumbnail to S3 (fire-and-forget)
    let imageUrl: string | undefined;
    try {
      const imgKey = `thumbnails/${nanoid()}.${req.file.mimetype.split("/")[1] ?? "jpg"}`;
      const imgResult = await storagePut(imgKey, req.file.buffer, req.file.mimetype);
      imageUrl = imgResult.url;
    } catch (e) {
      console.warn("[convert] Failed to upload thumbnail:", e);
    }

    // Log usage event (fire-and-forget)
    void logUsageEvent({ type: "convert", segmentCount, ipAnon, imageUrl, appUserId: appUser?.userId ?? undefined });

    // Record user action if logged in
    if (appUser?.userId) {
      void recordUserAction({
        appUserId: appUser.userId,
        actionType: "convert",
        description: req.file.originalname,
        segmentCount,
        dxfUrl: url,
        imageUrl,
        svgPreview,
        feature: "convert",
        ipAnon: ipAnon ?? undefined,
      });
    }

    return res.json({
      success: true,
      dxfUrl: url,
      svgPreview,
      segmentCount,
      width,
      height,
      realWidth,
      realHeight,
    });
  } catch (err: unknown) {
    console.error("[convert]", err);
    if (err instanceof Error && err.message === "CONVERT_TIMEOUT") {
      return res.status(408).json({
        error: "העיבוד לקח יותר מדי זמן. נסה תמונה פשוטה יותר, או הפחת את רזולוציית התמונה לפני ההעלאה.",
      });
    }
    const message = err instanceof Error ? err.message : "שגיאה בעיבוד התמונה";
    return res.status(500).json({ error: message });
  }
});

export default router;

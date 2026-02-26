import { Router } from "express";
import multer from "multer";
import { convertImageToDxf } from "./imageProcessor";
import { storagePut } from "./storage";
import { nanoid } from "nanoid";
import { logUsageEvent, anonymizeIp } from "./usageDb";
import { getAppUserFromCookie } from "./appAuth";

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

    const threshold = parseInt((req.body.threshold as string) ?? "128", 10);
    const simplifyTolerance = parseFloat((req.body.simplifyTolerance as string) ?? "2");
    const doubleLineOffset = parseFloat((req.body.doubleLineOffset as string) ?? "0");

    const { dxf, svgPreview, segmentCount, width, height } = await convertImageToDxf(
      req.file.buffer,
      {
        threshold: Math.min(255, Math.max(0, threshold)),
        simplifyTolerance,
        doubleLineOffset: Math.min(20, Math.max(0, doubleLineOffset)),
      }
    );

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

    return res.json({
      success: true,
      dxfUrl: url,
      svgPreview,
      segmentCount,
      width,
      height,
    });
  } catch (err: unknown) {
    console.error("[convert]", err);
    const message = err instanceof Error ? err.message : "שגיאה בעיבוד התמונה";
    return res.status(500).json({ error: message });
  }
});

export default router;

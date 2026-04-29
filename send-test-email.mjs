// Test script: send a sample welcome email with new light design + header image
// Run with: node send-test-email.mjs
import { Resend } from "resend";
import * as dotenv from "dotenv";
import jwt from "jsonwebtoken";

try { dotenv.config(); } catch {}

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_ADDRESS = process.env.EMAIL_FROM ?? "hello@dxfai.ai";
const JWT_SECRET = process.env.JWT_SECRET ?? "test-secret";

const opts = {
  to: "yossi2700@gmail.com",
  name: "יוסף",
  tokens: 10,
  siteUrl: "https://dxfai.ai",
  language: "he",
  userId: 999,
};

const displayName = opts.name || "";
const greeting = `ברוך הבא ${displayName}`;
const subject = `ברוך הבא ל-DXF AI`;

const unsubToken = jwt.sign({ userId: opts.userId, purpose: "unsubscribe" }, JWT_SECRET, { expiresIn: "365d" });
const unsubscribeUrl = `${opts.siteUrl}/api/unsubscribe?token=${unsubToken}`;

const HEADER_IMG = "https://d2xsxph8kpxj0f.cloudfront.net/310519663365044246/hnDFdLkzVGYJYdws9hbnLw/email-opt-c-adpMBYVwkfcAXqKrwGmkwB.png";

const html = `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>@import url('https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;600;700;800&display=swap');</style>
</head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:'Heebo',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f2f5;padding:32px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 32px rgba(0,0,0,0.10);">

  <!-- Hero image -->
  <tr><td style="padding:0;">
    <img src="${HEADER_IMG}" width="600" alt="DXF AI" style="display:block;width:100%;max-width:600px;height:auto;"/>
  </td></tr>

  <!-- Brand bar -->
  <tr><td style="background:#4f46e5;padding:14px 40px;">
    <div style="font-size:18px;font-weight:700;color:#ffffff;letter-spacing:1px;">DXF AI</div>
    <div style="font-size:12px;color:#c7d2fe;margin-top:2px;">ממיר תמונות לקבצי DXF בשניות</div>
  </td></tr>

  <!-- Greeting -->
  <tr><td style="padding:36px 40px 20px;">
    <div style="font-size:24px;font-weight:700;color:#1e1b4b;line-height:1.3;">${greeting}! 🎉</div>
    <div style="font-size:15px;color:#6b7280;margin-top:8px;">החשבון שלך מוכן — הנה מה שחשוב לדעת לפני שמתחילים.</div>
  </td></tr>

  <!-- Credits box -->
  <tr><td style="padding:0 40px 28px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#eef2ff 0%,#e0e7ff 100%);border-radius:14px;border:1px solid #c7d2fe;">
      <tr><td style="padding:22px 28px;">
        <div style="font-size:11px;font-weight:700;color:#4f46e5;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:6px;">יתרת קרדיטים</div>
        <div style="font-size:44px;font-weight:800;color:#4f46e5;line-height:1;">${opts.tokens}</div>
        <div style="font-size:13px;color:#6366f1;margin-top:4px;">קרדיטים חינם זמינים לשימוש מיידי</div>
      </td></tr>
    </table>
  </td></tr>

  <!-- PWA install section -->
  <tr><td style="padding:0 40px 20px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border-radius:14px;border:1px solid #bbf7d0;">
      <tr><td style="padding:20px 24px;">
        <div style="font-size:14px;font-weight:700;color:#15803d;margin-bottom:8px;">📲 הוסף לדף הבית — כמו אפליקציה</div>
        <div style="font-size:13px;color:#374151;line-height:1.9;">
          אפשר להשתמש ב-DXF AI ישירות מהדפדפן, בלי להוריד כלום.<br/>
          <strong>ב-iPhone/iPad:</strong> לחץ על כפתור השיתוף &#9650; ← "הוסף למסך הבית"<br/>
          <strong>ב-Android / מחשב:</strong> לחץ על הסמל &#8853; בשורת הכתובת ← "התקן"<br/>
          <span style="color:#6b7280;font-size:12px;">האפליקציה תיפתח כמו כל אפליקציה רגילה — מהירה ונוחה.</span>
        </div>
      </td></tr>
    </table>
  </td></tr>

  <!-- CTA -->
  <tr><td style="padding:0 40px 28px;text-align:center;">
    <a href="${opts.siteUrl}" style="display:inline-block;background:#4f46e5;color:#ffffff;font-size:15px;font-weight:700;padding:16px 52px;border-radius:12px;text-decoration:none;letter-spacing:0.3px;box-shadow:0 4px 16px rgba(79,70,229,0.35);">התחל ליצור עכשיו →</a>
    <div style="font-size:11px;color:#9ca3af;margin-top:12px;">dxfai.ai</div>
  </td></tr>

  <!-- Reply invitation -->
  <tr><td style="padding:0 40px 24px;">
    <div style="font-size:13px;color:#6b7280;line-height:1.9;border-top:1px solid #e5e7eb;padding-top:20px;">
      יש שאלות? רוצה לשתף משהו? פשוט <strong>השב על המייל הזה</strong> — נשמח לשמוע ממך 😊<br/>
      <span style="font-size:12px;color:#9ca3af;">אנחנו קוראים כל מייל ועונים אישית.</span>
    </div>
  </td></tr>

  <!-- Footer -->
  <tr><td style="padding:16px 40px;background:#f9fafb;border-top:1px solid #e5e7eb;">
    <div style="font-size:11px;color:#d1d5db;line-height:1.8;">
      קיבלת מייל זה כיוון שנרשמת ל-DXF AI.
      <a href="${unsubscribeUrl}" style="color:#9ca3af;text-decoration:underline;margin-right:8px;">הסר אותי מרשימת הדיוור</a>
    </div>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`;

const result = await resend.emails.send({
  from: FROM_ADDRESS,
  to: opts.to,
  subject,
  html,
  text: `${greeting}!\n\nיש לך ${opts.tokens} קרדיטים חינם.\n\nטיפ 1: כתוב תיאור מלא ב-AI — למשל: "כלב לברדור ישוב בפרופיל, קווים עבים, רקע לבן"\nטיפ 2: לתמונה לקווים — הנח חפץ על דף A4 לבן וצלם מלמעלה.\n\ndxfai.ai`,
});

console.log("✅ Email sent!", result.data?.id ?? result.error);

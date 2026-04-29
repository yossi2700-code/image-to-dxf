// Test script: send a sample welcome email with new dark design + unsubscribe
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
  userId: 999, // test user ID
};

const isHe = opts.language === "he";
const displayName = opts.name || "";
const greeting = isHe
  ? `שלום${displayName ? ` ${displayName}` : ""}`
  : `Hi${displayName ? ` ${displayName}` : ""}`;
const subject = isHe ? `ברוך הבא ל-DXF AI` : `Welcome to DXF AI`;

// Generate unsubscribe token
const unsubToken = jwt.sign({ userId: opts.userId, purpose: "unsubscribe" }, JWT_SECRET, { expiresIn: "365d" });
const unsubscribeUrl = `${opts.siteUrl}/api/unsubscribe?token=${unsubToken}`;

const html = isHe
  ? `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>@import url('https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;600;700&display=swap');</style>
</head>
<body style="margin:0;padding:0;background:#0f0f0f;font-family:'Heebo',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f0f;padding:40px 0;">
<tr><td align="center">
<table width="580" cellpadding="0" cellspacing="0" style="background:#1a1a1a;border-radius:16px;overflow:hidden;border:1px solid #2a2a2a;">

  <!-- Header -->
  <tr><td style="padding:40px 48px 32px;border-bottom:1px solid #2a2a2a;">
    <div style="font-size:13px;font-weight:600;color:#6366f1;letter-spacing:2px;text-transform:uppercase;margin-bottom:16px;">DXF AI</div>
    <div style="font-size:26px;font-weight:700;color:#ffffff;line-height:1.3;">${greeting},</div>
    <div style="font-size:15px;color:#71717a;margin-top:8px;font-weight:300;">החשבון שלך מוכן. הנה מה שצריך לדעת.</div>
  </td></tr>

  <!-- Credits -->
  <tr><td style="padding:32px 48px;border-bottom:1px solid #2a2a2a;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#18181b;border:1px solid #27272a;border-radius:12px;">
      <tr><td style="padding:24px 28px;">
        <div style="font-size:11px;font-weight:600;color:#6366f1;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:10px;">יתרת קרדיטים</div>
        <div style="font-size:42px;font-weight:700;color:#ffffff;line-height:1;">${opts.tokens}</div>
        <div style="font-size:13px;color:#52525b;margin-top:6px;">קרדיטים זמינים לשימוש מיידי</div>
      </td></tr>
    </table>
  </td></tr>

  <!-- Tips section -->
  <tr><td style="padding:32px 48px;border-bottom:1px solid #2a2a2a;">
    <div style="font-size:11px;font-weight:600;color:#a1a1aa;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:20px;">טיפים לתוצאה מדויקת</div>

    <!-- Tip 1: AI generation -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
      <tr>
        <td width="36" valign="top" style="padding-top:2px;">
          <div style="width:28px;height:28px;background:#6366f1;border-radius:6px;text-align:center;line-height:28px;font-size:14px;color:#fff;">✦</div>
        </td>
        <td style="padding-right:14px;">
          <div style="font-size:13px;font-weight:600;color:#e4e4e7;margin-bottom:5px;">יצירת AI — תיאור ספציפי = תוצאה מדויקת</div>
          <div style="font-size:12px;color:#71717a;line-height:1.8;">
            במקום לכתוב <span style="color:#a1a1aa;font-style:italic;">"ארי"</span> — נסה:<br/>
            <span style="color:#a78bfa;font-style:italic;">"ראש ארי בפרופיל, קווים עבים, רקע לבן, סגנון חיתוך לייזר"</span><br/>
            ככל שהתיאור ספציפי יותר — כך הקובץ המתקבל מדויק יותר.
          </div>
        </td>
      </tr>
    </table>

    <!-- Tip 2: Photo to lines -->
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td width="36" valign="top" style="padding-top:2px;">
          <div style="width:28px;height:28px;background:#18181b;border:1px solid #3f3f46;border-radius:6px;text-align:center;line-height:26px;font-size:14px;">📷</div>
        </td>
        <td style="padding-right:14px;">
          <div style="font-size:13px;font-weight:600;color:#e4e4e7;margin-bottom:5px;">תמונה לקווים — צלם על רקע לבן</div>
          <div style="font-size:12px;color:#71717a;line-height:1.8;">
            רוצים להמיר חפץ או אובייקט? הניחו אותו על <span style="color:#a1a1aa;">דף לבן</span> וצלמו מלמעלה.<br/>
            ניגודיות גבוהה בין החפץ לרקע = קווי DXF נקיים ומדויקים.
          </div>
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- CTA -->
  <tr><td style="padding:32px 48px;border-bottom:1px solid #2a2a2a;text-align:center;">
    <a href="${opts.siteUrl}" style="display:inline-block;background:#6366f1;color:#ffffff;font-size:14px;font-weight:600;padding:14px 44px;border-radius:8px;text-decoration:none;letter-spacing:0.3px;">פתח את DXF AI ←</a>
    <div style="font-size:11px;color:#52525b;margin-top:12px;">dxfai.ai</div>
  </td></tr>

  <!-- Support -->
  <tr><td style="padding:24px 48px;">
    <div style="font-size:12px;color:#52525b;line-height:1.8;">
      שאלות? <a href="mailto:support@dxfai.ai" style="color:#6366f1;text-decoration:none;">support@dxfai.ai</a> — מענה תוך 24 שעות.
    </div>
  </td></tr>

  <!-- Footer -->
  <tr><td style="padding:20px 48px;border-top:1px solid #2a2a2a;">
    <div style="font-size:11px;color:#3f3f46;line-height:1.8;">
      קיבלת מייל זה כיוון שנרשמת ל-DXF AI.<br/>
      <a href="${unsubscribeUrl}" style="color:#52525b;text-decoration:underline;">הסר אותי מרשימת הדיוור</a>
    </div>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`
  : `<!DOCTYPE html>
<html lang="en" dir="ltr">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&display=swap');</style>
</head>
<body style="margin:0;padding:0;background:#0f0f0f;font-family:'Inter',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f0f;padding:40px 0;">
<tr><td align="center">
<table width="580" cellpadding="0" cellspacing="0" style="background:#1a1a1a;border-radius:16px;overflow:hidden;border:1px solid #2a2a2a;">
  <tr><td style="padding:40px 48px 32px;border-bottom:1px solid #2a2a2a;">
    <div style="font-size:13px;font-weight:600;color:#6366f1;letter-spacing:2px;text-transform:uppercase;margin-bottom:16px;">DXF AI</div>
    <div style="font-size:26px;font-weight:700;color:#ffffff;line-height:1.3;">${greeting},</div>
    <div style="font-size:15px;color:#71717a;margin-top:8px;font-weight:300;">Your account is ready. Here's what you need to know.</div>
  </td></tr>
  <tr><td style="padding:32px 48px;border-bottom:1px solid #2a2a2a;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#18181b;border:1px solid #27272a;border-radius:12px;">
      <tr><td style="padding:24px 28px;">
        <div style="font-size:11px;font-weight:600;color:#6366f1;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:10px;">Credits Balance</div>
        <div style="font-size:42px;font-weight:700;color:#ffffff;line-height:1;">${opts.tokens}</div>
        <div style="font-size:13px;color:#52525b;margin-top:6px;">credits available to use right now</div>
      </td></tr>
    </table>
  </td></tr>
  <tr><td style="padding:32px 48px;border-bottom:1px solid #2a2a2a;">
    <div style="font-size:11px;font-weight:600;color:#a1a1aa;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:20px;">Tips for best results</div>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
      <tr>
        <td width="36" valign="top" style="padding-top:2px;">
          <div style="width:28px;height:28px;background:#6366f1;border-radius:6px;text-align:center;line-height:28px;font-size:14px;color:#fff;">✦</div>
        </td>
        <td style="padding-left:14px;">
          <div style="font-size:13px;font-weight:600;color:#e4e4e7;margin-bottom:5px;">AI Generation — specific prompt = accurate result</div>
          <div style="font-size:12px;color:#71717a;line-height:1.8;">
            Instead of typing <span style="color:#a1a1aa;font-style:italic;">"lion"</span> — try:<br/>
            <span style="color:#a78bfa;font-style:italic;">"lion head in profile, thick bold outlines, white background, laser cut style"</span><br/>
            The more specific your description, the cleaner your DXF output.
          </div>
        </td>
      </tr>
    </table>
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td width="36" valign="top" style="padding-top:2px;">
          <div style="width:28px;height:28px;background:#18181b;border:1px solid #3f3f46;border-radius:6px;text-align:center;line-height:26px;font-size:14px;">📷</div>
        </td>
        <td style="padding-left:14px;">
          <div style="font-size:13px;font-weight:600;color:#e4e4e7;margin-bottom:5px;">Photo to lines — shoot on a white background</div>
          <div style="font-size:12px;color:#71717a;line-height:1.8;">
            Converting a physical object? Place it on a <span style="color:#a1a1aa;">white sheet of paper</span> and photograph from above.<br/>
            High contrast between object and background = clean, accurate DXF lines.
          </div>
        </td>
      </tr>
    </table>
  </td></tr>
  <tr><td style="padding:32px 48px;border-bottom:1px solid #2a2a2a;text-align:center;">
    <a href="${opts.siteUrl}" style="display:inline-block;background:#6366f1;color:#ffffff;font-size:14px;font-weight:600;padding:14px 44px;border-radius:8px;text-decoration:none;letter-spacing:0.3px;">Open DXF AI →</a>
    <div style="font-size:11px;color:#52525b;margin-top:12px;">dxfai.ai</div>
  </td></tr>
  <tr><td style="padding:24px 48px;">
    <div style="font-size:12px;color:#52525b;line-height:1.8;">
      Questions? <a href="mailto:support@dxfai.ai" style="color:#6366f1;text-decoration:none;">support@dxfai.ai</a> — we reply within 24 hours.
    </div>
  </td></tr>
  <tr><td style="padding:20px 48px;border-top:1px solid #2a2a2a;">
    <div style="font-size:11px;color:#3f3f46;line-height:1.8;">
      You received this email because you registered at DXF AI.<br/>
      <a href="${unsubscribeUrl}" style="color:#52525b;text-decoration:underline;">Unsubscribe from emails</a>
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
});

console.log("✅ Email sent!", result.data?.id ?? result.error);

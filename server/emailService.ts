/**
 * emailService.ts
 * Email sending via Resend API.
 * Requires RESEND_API_KEY environment variable.
 */

import { Resend } from "resend";

// Only initialize Resend if API key is provided
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// The "from" address — must be a verified domain in Resend.
// For testing, Resend allows sending from onboarding@resend.dev to your own email.
const FROM_ADDRESS = process.env.EMAIL_FROM ?? "onboarding@resend.dev";
const APP_NAME = "ממיר תמונה ל-DXF";

export async function sendVerificationEmail(opts: {
  to: string;
  name: string | null;
  verifyUrl: string;
}): Promise<void> {
  if (!resend) { console.warn("[emailService] RESEND_API_KEY not set, skipping email"); return; }
  await resend.emails.send({
    from: FROM_ADDRESS,
    to: opts.to,
    subject: `אמת את כתובת המייל שלך — ${APP_NAME}`,
    html: `
      <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #f8fafc; border-radius: 12px;">
        <h2 style="color: #1e40af; margin-bottom: 8px;">אימות כתובת מייל</h2>
        <p style="color: #374151; margin-bottom: 20px;">
          שלום ${opts.name ?? ""}!<br/>
          לחץ על הכפתור למטה כדי לאמת את כתובת המייל שלך.
        </p>
        <a href="${opts.verifyUrl}"
           style="display: inline-block; background: #2563eb; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">
          אמת מייל
        </a>
        <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">
          הקישור תקף ל-24 שעות. אם לא נרשמת, התעלם מהמייל הזה.
        </p>
      </div>
    `,
  });
}

export async function sendPasswordResetEmail(opts: {
  to: string;
  name: string | null;
  resetUrl: string;
}): Promise<void> {
  if (!resend) { console.warn("[emailService] RESEND_API_KEY not set, skipping email"); return; }
  await resend.emails.send({
    from: FROM_ADDRESS,
    to: opts.to,
    subject: `איפוס סיסמה — ${APP_NAME}`,
    html: `
      <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #f8fafc; border-radius: 12px;">
        <h2 style="color: #1e40af; margin-bottom: 8px;">איפוס סיסמה</h2>
        <p style="color: #374151; margin-bottom: 20px;">
          שלום ${opts.name ?? ""}!<br/>
          קיבלנו בקשה לאיפוס הסיסמה שלך. לחץ על הכפתור למטה להמשך.
        </p>
        <a href="${opts.resetUrl}"
           style="display: inline-block; background: #2563eb; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">
          אפס סיסמה
        </a>
        <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">
          הקישור תקף לשעה אחת. אם לא ביקשת איפוס סיסמה, התעלם מהמייל הזה.
        </p>
      </div>
    `,
  });
}

export async function sendWelcomeEmail(opts: {
  to: string;
  name: string | null;
  tokens: number;
  siteUrl: string;
  language?: "he" | "en";
}): Promise<void> {
  if (!resend) { console.warn("[emailService] RESEND_API_KEY not set, skipping welcome email"); return; }
  const isHe = (opts.language ?? "he") === "he";
  const displayName = opts.name ?? (isHe ? "משתמש יקר" : "there");
  const subject = isHe
    ? `ברוכים הבאים ל-DXF AI — ${opts.tokens} אסימונים זמינים בחשבונך`
    : `Welcome to DXF AI — Your ${opts.tokens} tokens are ready to use`;

  const bonusUrl = `${opts.siteUrl}/?campaign=welcome_bonus_2026`;

  const heHtml = `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>ברוכים הבאים ל-AI DXF</title>
</head>
<body style="margin:0;padding:0;background:#f4f6fb;font-family:Arial,Helvetica,sans-serif;direction:rtl;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fb;padding:32px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

  <!-- Header -->
  <tr><td style="background:#4338ca;border-radius:20px 20px 0 0;padding:36px 40px 28px;text-align:center;">
    <div style="display:inline-block;background:rgba(255,255,255,0.18);border:1px solid rgba(255,255,255,0.3);border-radius:50px;padding:7px 18px;margin-bottom:18px;">
      <span style="color:#ffffff;font-size:13px;font-weight:700;">✦ AI DXF — dxfai.net</span>
    </div>
    <h1 style="color:#ffffff;font-size:26px;font-weight:900;margin:0 0 10px;line-height:1.3;">ברוכים הבאים!<br/>עכשיו אתה <span style="color:#fde68a;">מקצוען בווקטורים</span></h1>
    <p style="color:#e0e7ff;font-size:14px;margin:0;line-height:1.6;">הכלי המתקדם ביותר להמרת תמונות לקבצי DXF<br/>מוכנים לחריטה, כרסום ולייזר</p>
  </td></tr>

  <!-- Token Banner -->
  <tr><td style="background:#ffffff;border:2px solid #e0e7ff;padding:24px 40px;text-align:center;">
    <p style="color:#1e1b4b;font-size:14px;font-weight:700;margin:0 0 16px;">🎯 יתרת האסימונים שלך:</p>
    <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
      <tr>
        <td style="text-align:center;padding:0 16px;">
          <div style="color:#1e1b4b;font-size:36px;font-weight:900;line-height:1;">${opts.tokens}</div>
          <div style="color:#6b7280;font-size:12px;font-weight:600;margin-top:5px;">אסימונים בחשבון</div>
        </td>
        <td style="color:#d1d5db;font-size:28px;padding:0 8px;">+</td>
        <td style="text-align:center;padding:0 16px;background:#fef9c3;border:2px solid #fbbf24;border-radius:12px;">
          <div style="color:#92400e;font-size:36px;font-weight:900;line-height:1;">20</div>
          <div style="color:#92400e;font-size:12px;font-weight:700;margin-top:5px;">בונוס במייל</div>
        </td>
        <td style="color:#d1d5db;font-size:28px;padding:0 8px;">=</td>
        <td style="text-align:center;padding:0 16px;">
          <div style="color:#4338ca;font-size:36px;font-weight:900;line-height:1;">${opts.tokens + 20}</div>
          <div style="color:#6b7280;font-size:12px;font-weight:600;margin-top:5px;">סה"כ אסימונים</div>
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- Body -->
  <tr><td style="background:#ffffff;padding:36px 40px;">

    <p style="color:#374151;font-size:15px;margin:0 0 20px;line-height:1.7;">שלום ${displayName},</p>

    <!-- Features Title -->
    <p style="color:#1e1b4b;font-size:17px;font-weight:700;margin:0 0 16px;padding-bottom:10px;border-bottom:2px solid #e0e7ff;">🚀 מה תוכל לעשות עם AI DXF?</p>

    <!-- Features Grid (table-based for email) -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
      <tr>
        <td width="48%" style="background:#f8f9ff;border:1px solid #e0e7ff;border-radius:12px;padding:16px;vertical-align:top;">
          <div style="font-size:24px;margin-bottom:8px;">🎨</div>
          <div style="font-size:13px;font-weight:700;color:#312e81;margin-bottom:5px;">AI Create — יצירה מטקסט</div>
          <div style="font-size:12px;color:#6b7280;line-height:1.5;">כתוב תיאור בעברית — ה-AI יצור עיצוב וקטורי מוכן כ-DXF</div>
        </td>
        <td width="4%"></td>
        <td width="48%" style="background:#f8f9ff;border:1px solid #e0e7ff;border-radius:12px;padding:16px;vertical-align:top;">
          <div style="font-size:24px;margin-bottom:8px;">📸</div>
          <div style="font-size:13px;font-weight:700;color:#312e81;margin-bottom:5px;">AI Outline — המרת תמונה</div>
          <div style="font-size:12px;color:#6b7280;line-height:1.5;">העלה תמונה — ה-AI יחלץ קווים ויצור DXF מדויק ללייזר ו-CNC</div>
        </td>
      </tr>
      <tr><td colspan="3" style="padding:8px 0;"></td></tr>
      <tr>
        <td width="48%" style="background:#f8f9ff;border:1px solid #e0e7ff;border-radius:12px;padding:16px;vertical-align:top;">
          <div style="font-size:24px;margin-bottom:8px;">📄</div>
          <div style="font-size:13px;font-weight:700;color:#312e81;margin-bottom:5px;">AI Sketch — מסמכים</div>
          <div style="font-size:12px;color:#6b7280;line-height:1.5;">חלץ ציורים וסקיצות ממסמכים סרוקים ו-PDF</div>
        </td>
        <td width="4%"></td>
        <td width="48%" style="background:#f8f9ff;border:1px solid #e0e7ff;border-radius:12px;padding:16px;vertical-align:top;">
          <div style="font-size:24px;margin-bottom:8px;">🖼️</div>
          <div style="font-size:13px;font-weight:700;color:#312e81;margin-bottom:5px;">AI Portrait — פורטרטים</div>
          <div style="font-size:12px;color:#6b7280;line-height:1.5;">המר פורטרט לקווי חריטה — מושלם לחריטה על עץ ומתכת</div>
        </td>
      </tr>
    </table>

    <!-- Benefits -->
    <p style="color:#1e1b4b;font-size:17px;font-weight:700;margin:0 0 16px;padding-bottom:10px;border-bottom:2px solid #e0e7ff;">✅ למה AI DXF?</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
      <tr><td style="padding:10px 0;border-bottom:1px solid #f3f4f6;">
        <table cellpadding="0" cellspacing="0"><tr>
          <td style="width:36px;height:36px;background:#eef2ff;border-radius:10px;text-align:center;vertical-align:middle;font-size:16px;">⚡</td>
          <td style="padding-right:12px;"><strong style="display:block;font-size:13px;color:#1f2937;">תוצאה תוך שניות</strong><span style="font-size:12px;color:#6b7280;">אין צורך בתוכנות מורכבות — תמונה נכנסת, DXF יוצא</span></td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:10px 0;border-bottom:1px solid #f3f4f6;">
        <table cellpadding="0" cellspacing="0"><tr>
          <td style="width:36px;height:36px;background:#eef2ff;border-radius:10px;text-align:center;vertical-align:middle;font-size:16px;">🔗</td>
          <td style="padding-right:12px;"><strong style="display:block;font-size:13px;color:#1f2937;">קבצים מחוברים ורציפים</strong><span style="font-size:12px;color:#6b7280;">קווי DXF מחוברים כ-Polylines — תואם לכל תוכנת CAD ומכונת CNC</span></td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:10px 0;border-bottom:1px solid #f3f4f6;">
        <table cellpadding="0" cellspacing="0"><tr>
          <td style="width:36px;height:36px;background:#eef2ff;border-radius:10px;text-align:center;vertical-align:middle;font-size:16px;">📐</td>
          <td style="padding-right:12px;"><strong style="display:block;font-size:13px;color:#1f2937;">גדלים מדויקים</strong><span style="font-size:12px;color:#6b7280;">הגדר גודל פלט במ"מ — הקובץ יגיע בדיוק בגודל שצריך</span></td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:10px 0;">
        <table cellpadding="0" cellspacing="0"><tr>
          <td style="width:36px;height:36px;background:#eef2ff;border-radius:10px;text-align:center;vertical-align:middle;font-size:16px;">💾</td>
          <td style="padding-right:12px;"><strong style="display:block;font-size:13px;color:#1f2937;">ייצוא בפורמטים מרובים</strong><span style="font-size:12px;color:#6b7280;">DXF, SVG, PDF — כל הפורמטים לחריטה, לייזר ו-CNC</span></td>
        </tr></table>
      </td></tr>
    </table>

    <!-- CTA Box -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#fef3c7,#fde68a);border:1px solid #fbbf24;border-radius:16px;margin-bottom:24px;">
      <tr><td style="padding:24px;text-align:center;">
        <h3 style="color:#92400e;font-size:16px;font-weight:700;margin:0 0 8px;">🎁 20 אסימונים בונוס מחכים לך!</h3>
        <p style="color:#78350f;font-size:13px;line-height:1.6;margin:0 0 16px;">לחץ על הכפתור כדי לקבל 20 אסימונים נוספים שיתווספו אוטומטית לחשבונך.</p>
        <a href="${bonusUrl}" style="display:inline-block;background:linear-gradient(135deg,#4338ca,#7c3aed);color:#ffffff;font-size:14px;font-weight:700;padding:13px 32px;border-radius:50px;text-decoration:none;">לחץ כאן לקבלת 20 האסימונים »</a>
        <p style="color:#92400e;font-size:11px;margin:10px 0 0;">האסימונים יתווספו אוטומטית לאחר לחיצה</p>
      </td></tr>
    </table>

    <!-- Spam Notice -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;margin-bottom:8px;">
      <tr><td style="padding:14px 18px;">
        <table cellpadding="0" cellspacing="0"><tr>
          <td style="font-size:18px;padding-left:12px;vertical-align:top;">📬</td>
          <td style="font-size:12px;color:#166534;line-height:1.6;"><strong style="color:#14532d;">אם המייל הגיע לתיקיית הספאם</strong> — סמן אותו כ"דואר רצוי" (Not Spam) כדי שעדכונים ובונוסים יגיעו ישיר לתיבה הראשית.</td>
        </tr></table>
      </td></tr>
    </table>

  </td></tr>

  <!-- Footer -->
  <tr><td style="background:#f8f9ff;border-radius:0 0 20px 20px;padding:24px 40px;text-align:center;border-top:1px solid #e0e7ff;">
    <p style="font-size:13px;font-weight:700;color:#4338ca;margin:0 0 6px;">AI DXF — dxfai.net</p>
    <p style="font-size:11px;color:#9ca3af;line-height:1.7;margin:0;">
      קיבלת מייל זה כיוון שנרשמת לאתר AI DXF.<br/>
      <a href="${opts.siteUrl}" style="color:#6366f1;text-decoration:none;">dxfai.net</a> &nbsp;|&nbsp;
      <a href="mailto:support@dxfai.net" style="color:#6366f1;text-decoration:none;">support@dxfai.net</a>
    </p>
  </td></tr>

</table>
</td></tr></table>
</body></html>`;

  const enHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
      <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 36px 32px; text-align: center;">
        <div style="display: inline-block; background: rgba(255,255,255,0.15); border-radius: 12px; padding: 8px 16px; margin-bottom: 16px;">
          <span style="color: white; font-size: 20px; font-weight: 900;">Ai<span style="color: #c4b5fd;">DXF</span></span>
        </div>
        <h1 style="color: white; font-size: 26px; font-weight: 900; margin: 0 0 8px;">Welcome aboard! 🎉</h1>
        <p style="color: rgba(255,255,255,0.85); font-size: 15px; margin: 0;">The leading platform for image-to-DXF conversion</p>
      </div>
      <div style="background: #f0fdf4; border-bottom: 1px solid #bbf7d0; padding: 20px 32px; text-align: center;">
        <div style="display: inline-block; background: linear-gradient(135deg, #059669, #10b981); color: white; border-radius: 50px; padding: 10px 28px; font-size: 18px; font-weight: 900;">
          🎁 ${opts.tokens} free tokens are ready!
        </div>
        <p style="color: #065f46; font-size: 13px; margin: 10px 0 0;">Already in your account — no action needed</p>
      </div>
      <div style="padding: 32px;">
        <p style="color: #374151; font-size: 16px; margin: 0 0 16px;">Hi ${displayName},</p>
        <p style="color: #374151; font-size: 15px; line-height: 1.7; margin: 0 0 24px;">
          We're thrilled to have you! Use your <strong>${opts.tokens} free tokens</strong> to start converting images to DXF files — ready for laser cutting &amp; CNC.
        </p>
        <div style="background: #f8fafc; border-radius: 12px; padding: 20px 24px; margin-bottom: 28px; border: 1px solid #e2e8f0;">
          <p style="color: #1e293b; font-weight: 700; font-size: 14px; margin: 0 0 14px;">What you can do with tokens:</p>
          <table style="width: 100%; border-collapse: collapse;">
            <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 8px 0; color: #374151; font-size: 14px;">🖼️ AI Outline — image to vector</td><td style="padding: 8px 0; color: #6366f1; font-weight: 700; font-size: 14px;">5 tokens</td></tr>
            <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 8px 0; color: #374151; font-size: 14px;">✨ AI Create — text to DXF</td><td style="padding: 8px 0; color: #6366f1; font-weight: 700; font-size: 14px;">3 tokens</td></tr>
            <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 8px 0; color: #374151; font-size: 14px;">👤 Portrait — portrait DXF</td><td style="padding: 8px 0; color: #6366f1; font-weight: 700; font-size: 14px;">4 tokens</td></tr>
            <tr><td style="padding: 8px 0; color: #374151; font-size: 14px;">🔄 AI Refine — smart editing</td><td style="padding: 8px 0; color: #6366f1; font-weight: 700; font-size: 14px;">2 tokens</td></tr>
          </table>
        </div>
        <div style="text-align: center; margin-bottom: 28px;">
          <a href="${opts.siteUrl}" style="display: inline-block; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; padding: 14px 36px; border-radius: 50px; text-decoration: none; font-weight: 900; font-size: 16px; box-shadow: 0 4px 16px rgba(99,102,241,0.4);">🚀 Start converting now</a>
        </div>
        <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">Need help? Contact us anytime • <a href="${opts.siteUrl}" style="color: #6366f1; text-decoration: none;">dxfai.net</a></p>
      </div>
    </div>
  `;

  const plainText = isHe
    ? `שלום ${displayName},\n\nברוכים הבאים ל-DXF AI!\n${opts.tokens} אסימונים זמינים בחשבונך.\n\nכניסה לאתר: ${opts.siteUrl}\n\nצוות DXF AI`
    : `Hi ${displayName},\n\nWelcome to DXF AI!\nYour ${opts.tokens} tokens are ready to use.\n\nGet started: ${opts.siteUrl}\n\nDXF AI Team`;

  await resend.emails.send({
    from: FROM_ADDRESS,
    to: opts.to,
    subject,
    html: isHe ? heHtml : enHtml,
    text: plainText,
  });
}

export async function sendPurchaseConfirmationEmail(opts: {
  to: string;
  name: string | null;
  tokens: number;
  amount: string;
  currency: string;
  orderId: string;
  siteUrl: string;
  language?: "he" | "en";
}): Promise<void> {
  if (!resend) { console.warn("[emailService] RESEND_API_KEY not set, skipping purchase email"); return; }
  const isHe = (opts.language ?? "he") === "he";
  const displayName = opts.name ?? (isHe ? "משתמש יקר" : "there");

  // Format amount with currency symbol
  const currencySymbol = opts.currency === "ILS" ? "₪" : opts.currency === "EUR" ? "€" : "$";
  const amountDisplay = `${currencySymbol}${opts.amount}`;

  const subject = isHe
    ? `✅ אישור רכישה — ${opts.tokens} אסימונים נוספו לחשבונך`
    : `✅ Purchase confirmed — ${opts.tokens} tokens added to your account`;

  const heHtml = `
    <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #059669 0%, #10b981 100%); padding: 36px 32px; text-align: center;">
        <div style="display: inline-block; background: rgba(255,255,255,0.15); border-radius: 12px; padding: 8px 16px; margin-bottom: 16px;">
          <span style="color: white; font-size: 20px; font-weight: 900; letter-spacing: -0.5px;">Ai<span style="color: #a7f3d0;">DXF</span></span>
        </div>
        <div style="width: 56px; height: 56px; background: rgba(255,255,255,0.2); border-radius: 50%; margin: 0 auto 12px; display: flex; align-items: center; justify-content: center; font-size: 28px;">✅</div>
        <h1 style="color: white; font-size: 24px; font-weight: 900; margin: 0 0 8px;">הרכישה הושלמה בהצלחה!</h1>
        <p style="color: rgba(255,255,255,0.85); font-size: 15px; margin: 0;">האסימונים נוספו לחשבונך מיידית</p>
      </div>

      <!-- Token badge -->
      <div style="background: #f0fdf4; border-bottom: 1px solid #bbf7d0; padding: 24px 32px; text-align: center;">
        <div style="display: inline-block; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; border-radius: 50px; padding: 12px 32px; font-size: 22px; font-weight: 900; box-shadow: 0 4px 16px rgba(99,102,241,0.35);">
          ✨ +<span style="background: linear-gradient(to bottom, #fde68a, #f59e0b, #d97706); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; font-size: 28px; font-weight: 900;">${opts.tokens}</span> אסימונים
        </div>
        <p style="color: #065f46; font-size: 13px; margin: 10px 0 0;">זמינים עכשיו בחשבונך</p>
      </div>

      <!-- Order details -->
      <div style="padding: 32px;">
        <p style="color: #374151; font-size: 16px; margin: 0 0 20px;">שלום ${displayName},</p>
        <p style="color: #374151; font-size: 15px; line-height: 1.7; margin: 0 0 24px;">
          תודה על רכישתך! <strong>${opts.tokens} אסימונים</strong> נוספו לחשבונך ומוכנים לשימוש.
        </p>

        <!-- Receipt box -->
        <div style="background: #f8fafc; border-radius: 12px; padding: 20px 24px; margin-bottom: 28px; border: 1px solid #e2e8f0;">
          <p style="color: #1e293b; font-weight: 700; font-size: 14px; margin: 0 0 14px;">פרטי הרכישה:</p>
          <table style="width: 100%; border-collapse: collapse;">
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">אסימונים שנרכשו</td>
              <td style="padding: 8px 0; color: #1e293b; font-weight: 700; font-size: 14px; text-align: left;">${opts.tokens} אסימונים</td>
            </tr>
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">סכום ששולם</td>
              <td style="padding: 8px 0; color: #059669; font-weight: 700; font-size: 14px; text-align: left;">${amountDisplay}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">שיטת תשלום</td>
              <td style="padding: 8px 0; color: #1e293b; font-size: 14px; text-align: left;">PayPal</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">מספר הזמנה</td>
              <td style="padding: 8px 0; color: #9ca3af; font-size: 12px; text-align: left; font-family: monospace;">${opts.orderId.substring(0, 16)}...</td>
            </tr>
          </table>
        </div>

        <!-- CTA -->
        <div style="text-align: center; margin-bottom: 12px;">
          <a href="${opts.siteUrl}/personal"
             style="display: inline-block; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; padding: 14px 36px; border-radius: 50px; text-decoration: none; font-weight: 900; font-size: 16px; box-shadow: 0 4px 16px rgba(99,102,241,0.4);">
            🚀 עבור לאזור האישי
          </a>
        </div>
        <div style="text-align: center; margin-bottom: 28px;">
          <a href="${opts.siteUrl}"
             style="display: inline-block; color: #6366f1; padding: 8px 20px; text-decoration: none; font-size: 14px; font-weight: 600;">
            🎨 התחל להמיר עכשיו
          </a>
        </div>

        <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
          צריך עזרה? פנה אלינו בכל עת • <a href="${opts.siteUrl}" style="color: #6366f1; text-decoration: none;">dxfai.net</a>
        </p>
      </div>
    </div>
  `;

  const enHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
      <div style="background: linear-gradient(135deg, #059669 0%, #10b981 100%); padding: 36px 32px; text-align: center;">
        <div style="display: inline-block; background: rgba(255,255,255,0.15); border-radius: 12px; padding: 8px 16px; margin-bottom: 16px;">
          <span style="color: white; font-size: 20px; font-weight: 900;">Ai<span style="color: #a7f3d0;">DXF</span></span>
        </div>
        <div style="font-size: 40px; margin-bottom: 12px;">✅</div>
        <h1 style="color: white; font-size: 24px; font-weight: 900; margin: 0 0 8px;">Purchase confirmed!</h1>
        <p style="color: rgba(255,255,255,0.85); font-size: 15px; margin: 0;">Tokens added to your account instantly</p>
      </div>
      <div style="background: #f0fdf4; border-bottom: 1px solid #bbf7d0; padding: 24px 32px; text-align: center;">
        <div style="display: inline-block; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; border-radius: 50px; padding: 12px 32px; font-size: 22px; font-weight: 900; box-shadow: 0 4px 16px rgba(99,102,241,0.35);">
          ✨ +<span style="background: linear-gradient(to bottom, #fde68a, #f59e0b, #d97706); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; font-size: 28px; font-weight: 900;">${opts.tokens}</span> tokens
        </div>
        <p style="color: #065f46; font-size: 13px; margin: 10px 0 0;">Available now in your account</p>
      </div>
      <div style="padding: 32px;">
        <p style="color: #374151; font-size: 16px; margin: 0 0 20px;">Hi ${displayName},</p>
        <p style="color: #374151; font-size: 15px; line-height: 1.7; margin: 0 0 24px;">
          Thank you for your purchase! <strong>${opts.tokens} tokens</strong> have been added to your account and are ready to use.
        </p>
        <div style="background: #f8fafc; border-radius: 12px; padding: 20px 24px; margin-bottom: 28px; border: 1px solid #e2e8f0;">
          <p style="color: #1e293b; font-weight: 700; font-size: 14px; margin: 0 0 14px;">Order details:</p>
          <table style="width: 100%; border-collapse: collapse;">
            <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Tokens purchased</td><td style="padding: 8px 0; color: #1e293b; font-weight: 700; font-size: 14px;">${opts.tokens} tokens</td></tr>
            <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Amount paid</td><td style="padding: 8px 0; color: #059669; font-weight: 700; font-size: 14px;">${amountDisplay}</td></tr>
            <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Payment method</td><td style="padding: 8px 0; color: #1e293b; font-size: 14px;">PayPal</td></tr>
            <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Order ID</td><td style="padding: 8px 0; color: #9ca3af; font-size: 12px; font-family: monospace;">${opts.orderId.substring(0, 16)}...</td></tr>
          </table>
        </div>
        <div style="text-align: center; margin-bottom: 12px;">
          <a href="${opts.siteUrl}/personal" style="display: inline-block; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; padding: 14px 36px; border-radius: 50px; text-decoration: none; font-weight: 900; font-size: 16px; box-shadow: 0 4px 16px rgba(99,102,241,0.4);">🚀 Go to Personal Area</a>
        </div>
        <div style="text-align: center; margin-bottom: 28px;">
          <a href="${opts.siteUrl}" style="display: inline-block; color: #6366f1; padding: 8px 20px; text-decoration: none; font-size: 14px; font-weight: 600;">🎨 Start converting now</a>
        </div>
        <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">Need help? Contact us anytime • <a href="${opts.siteUrl}" style="color: #6366f1; text-decoration: none;">dxfai.net</a></p>
      </div>
    </div>
  `;

  await resend.emails.send({
    from: FROM_ADDRESS,
    to: opts.to,
    subject,
    html: isHe ? heHtml : enHtml,
    headers: {
      'List-Unsubscribe': `<mailto:noreply@dxfai.net?subject=unsubscribe>`,
      'X-Entity-Ref-ID': opts.orderId,
    },
  });
}

/**
 * Send a custom bulk email to a single recipient (called in a loop for all users).
 * Admin provides subject and htmlBody. Use {{name}} in htmlBody to personalize.
 * Uses clean, spam-filter-friendly HTML with plain text fallback.
 */
export async function sendBulkEmail(opts: {
  to: string;
  name: string | null;
  subject: string;
  htmlBody: string;
  plainText?: string;
}): Promise<void> {
  if (!resend) { console.warn("[emailService] RESEND_API_KEY not set, skipping bulk email"); return; }
  const displayName = opts.name?.split(" ")[0] || opts.name || "";
  const personalizedHtml = opts.htmlBody.replace(/\{\{name\}\}/g, displayName);
  const personalizedText = (opts.plainText || "").replace(/\{\{name\}\}/g, displayName);

  // Clean, spam-filter-friendly wrapper — no gradients, no box-shadows, no complex CSS
  const wrappedHtml = `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0; padding:0; background:#f4f4f4; font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f4f4; padding:20px 0;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff; max-width:560px;">
  <tr>
    <td align="center" style="background:#1e1b4b; padding:20px 32px;">
      <p style="margin:0; font-size:22px; font-weight:bold; color:#ffffff; font-family:Arial,sans-serif;">AI DXF</p>
      <p style="margin:4px 0 0; font-size:12px; color:#a5b4fc; font-family:Arial,sans-serif;">dxfai.net</p>
    </td>
  </tr>
  <tr>
    <td style="padding:24px 32px; direction:rtl; text-align:right; font-family:Arial,sans-serif;">
      ${personalizedHtml}
    </td>
  </tr>
  <tr>
    <td style="background:#f9fafb; padding:14px 32px; text-align:center; border-top:1px solid #e5e7eb; direction:rtl;">
      <p style="margin:0 0 4px; font-size:12px; color:#9ca3af; font-family:Arial,sans-serif;">
        AI DXF &bull; <a href="https://dxfai.net" style="color:#4f46e5; text-decoration:none;">dxfai.net</a>
      </p>
      <p style="margin:0; font-size:11px; color:#d1d5db; font-family:Arial,sans-serif;">
        קיבלת מייל זה כי נרשמת לאתר AI DXF. <a href="mailto:noreply@dxfai.net?subject=unsubscribe" style="color:#d1d5db;">הסרה מרשימת תפוצה</a>
      </p>
    </td>
  </tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  // Build plain text version (important for spam filters)
  const textVersion = personalizedText ||
    `AI DXF - dxfai.net\n\n` +
    `שלום ${displayName},\n\n` +
    `לכניסה לאתר: https://dxfai.net\n\n` +
    `להסרה מרשימת תפוצה: noreply@dxfai.net`;

  await resend.emails.send({
    from: FROM_ADDRESS,
    to: opts.to,
    subject: opts.subject,
    html: wrappedHtml,
    text: textVersion,
    headers: {
      'List-Unsubscribe': `<mailto:noreply@dxfai.net?subject=unsubscribe>, <https://dxfai.net/unsubscribe>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  });
}


/**
 * 48-hour reminder email for users who haven't claimed their welcome bonus yet.
 */
export async function sendReminderEmail(opts: {
  to: string;
  name: string | null;
  siteUrl: string;
  language?: "he" | "en";
}): Promise<void> {
  if (!resend) { console.warn("[emailService] RESEND_API_KEY not set, skipping reminder email"); return; }
  const isHe = (opts.language ?? "he") === "he";
  const displayName = opts.name ?? (isHe ? "משתמש יקר" : "there");
  const bonusUrl = `${opts.siteUrl}/?campaign=welcome_bonus_2026`;

  const subject = isHe
    ? "תזכורת: 20 אסימונים מחכים לך ב-DXF AI"
    : "Reminder: Your 20 bonus tokens at DXF AI";

  const heHtml = `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>האסימונים שלך מחכים</title>
</head>
<body style="margin:0;padding:0;background:#f4f6fb;font-family:Arial,Helvetica,sans-serif;direction:rtl;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fb;padding:32px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

  <!-- Header -->
  <tr><td style="background:#7c3aed;border-radius:20px 20px 0 0;padding:36px 40px 28px;text-align:center;">
    <div style="display:inline-block;background:rgba(255,255,255,0.18);border:1px solid rgba(255,255,255,0.3);border-radius:50px;padding:7px 18px;margin-bottom:18px;">
      <span style="color:#ffffff;font-size:13px;font-weight:700;">✦ AI DXF — dxfai.net</span>
    </div>
    <div style="font-size:48px;margin-bottom:12px;">⏰</div>
    <h1 style="color:#ffffff;font-size:24px;font-weight:900;margin:0 0 10px;line-height:1.3;">שלום ${displayName},<br/>האסימונים שלך עוד מחכים!</h1>
    <p style="color:#e9d5ff;font-size:14px;margin:0;line-height:1.6;">נרשמת לפני יומיים אבל עוד לא קיבלת את 20 האסימונים הבונוס שלך</p>
  </td></tr>

  <!-- Body -->
  <tr><td style="background:#ffffff;padding:36px 40px;">
    <p style="color:#374151;font-size:15px;margin:0 0 20px;line-height:1.7;">שלחנו לך מייל עם קישור לקבלת 20 אסימונים בונוס — אבל נראה שעוד לא לחצת עליו.</p>

    <!-- Bonus Box -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#fef3c7,#fde68a);border:2px solid #fbbf24;border-radius:16px;margin-bottom:28px;">
      <tr><td style="padding:28px;text-align:center;">
        <div style="font-size:36px;font-weight:900;color:#92400e;margin-bottom:8px;">🎁 20 אסימונים</div>
        <p style="color:#78350f;font-size:14px;line-height:1.6;margin:0 0 20px;">לחץ על הכפתור כדי לקבל אותם עכשיו — הם יתווספו אוטומטית לחשבונך.</p>
        <a href="${bonusUrl}" style="display:inline-block;background:#4338ca;color:#ffffff;font-size:15px;font-weight:700;padding:14px 36px;border-radius:50px;text-decoration:none;">קבל את 20 האסימונים שלי »</a>
        <p style="color:#92400e;font-size:11px;margin:12px 0 0;">האסימונים יתווספו אוטומטית לאחר לחיצה</p>
      </td></tr>
    </table>

    <p style="color:#6b7280;font-size:13px;line-height:1.6;margin:0 0 8px;">לא מצאת את המייל המקורי? בדוק בתיקיית הספאם — אם הוא שם, סמן אותו כ"דואר רצוי".</p>
  </td></tr>

  <!-- Footer -->
  <tr><td style="background:#f8f9ff;border-radius:0 0 20px 20px;padding:24px 40px;text-align:center;border-top:1px solid #e0e7ff;">
    <p style="font-size:13px;font-weight:700;color:#4338ca;margin:0 0 6px;">AI DXF — dxfai.net</p>
    <p style="font-size:11px;color:#9ca3af;line-height:1.7;margin:0;">
      קיבלת מייל זה כיוון שנרשמת לאתר AI DXF.<br/>
      <a href="${opts.siteUrl}" style="color:#6366f1;text-decoration:none;">dxfai.net</a> &nbsp;|&nbsp;
      <a href="mailto:support@dxfai.net" style="color:#6366f1;text-decoration:none;">support@dxfai.net</a>
    </p>
  </td></tr>

</table>
</td></tr></table>
</body></html>`;

  const enHtml = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><title>Your tokens are waiting</title></head>
<body style="margin:0;padding:0;background:#f4f6fb;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fb;padding:32px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
  <tr><td style="background:#7c3aed;border-radius:20px 20px 0 0;padding:36px 40px 28px;text-align:center;">
    <div style="font-size:48px;margin-bottom:12px;">⏰</div>
    <h1 style="color:#ffffff;font-size:24px;font-weight:900;margin:0 0 10px;">Hi ${displayName},<br/>Your bonus tokens are still waiting!</h1>
    <p style="color:#e9d5ff;font-size:14px;margin:0;">You signed up 2 days ago but haven't claimed your 20 bonus tokens yet</p>
  </td></tr>
  <tr><td style="background:#ffffff;padding:36px 40px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#fef3c7,#fde68a);border:2px solid #fbbf24;border-radius:16px;margin-bottom:28px;">
      <tr><td style="padding:28px;text-align:center;">
        <div style="font-size:36px;font-weight:900;color:#92400e;margin-bottom:8px;">🎁 20 Bonus Tokens</div>
        <p style="color:#78350f;font-size:14px;margin:0 0 20px;">Click the button to claim them — they'll be added to your account instantly.</p>
        <a href="${bonusUrl}" style="display:inline-block;background:#4338ca;color:#ffffff;font-size:15px;font-weight:700;padding:14px 36px;border-radius:50px;text-decoration:none;">Claim My 20 Tokens »</a>
      </td></tr>
    </table>
  </td></tr>
  <tr><td style="background:#f8f9ff;border-radius:0 0 20px 20px;padding:24px 40px;text-align:center;border-top:1px solid #e0e7ff;">
    <p style="font-size:11px;color:#9ca3af;">You received this because you registered at DXF AI. <a href="${opts.siteUrl}" style="color:#6366f1;">dxfai.net</a></p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;

  const reminderPlainText = isHe
    ? `שלום ${displayName},\n\nנרשמת ל-DXF AI אבל עוד לא קיבלת את 20 האסימונים הבונוס שלך.\n\nלחץ כאן לקבלתם: ${bonusUrl}\n\nצוות DXF AI\ndxfai.net\n\nלהסרה: noreply@dxfai.net`
    : `Hi ${displayName},\n\nYou signed up for DXF AI but haven't claimed your 20 bonus tokens yet.\n\nClaim them here: ${bonusUrl}\n\nDXF AI Team\ndxfai.net\n\nUnsubscribe: noreply@dxfai.net`;

  await resend.emails.send({
    from: FROM_ADDRESS,
    to: opts.to,
    subject,
    html: isHe ? heHtml : enHtml,
    text: reminderPlainText,
    headers: {
      'List-Unsubscribe': `<mailto:noreply@dxfai.net?subject=unsubscribe>, <https://dxfai.net/unsubscribe>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  });
}

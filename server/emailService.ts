/**
 * emailService.ts
 * Email sending via Resend API.
 * Requires RESEND_API_KEY environment variable.
 */

import { Resend } from "resend";
import { generateUnsubscribeToken } from "./unsubscribeRoute";

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
  language?: "he" | "en" | "ru";
}): Promise<void> {
  if (!resend) { console.warn("[emailService] RESEND_API_KEY not set, skipping email"); return; }
  const isHe = (opts.language ?? "he") === "he";
  const isRu = opts.language === "ru";
  const displayName = opts.name ?? (isHe ? "" : isRu ? "" : "");

  const subject = isHe
    ? `איפוס סיסמא — DXF AI`
    : isRu
    ? `Сброс пароля — DXF AI`
    : `Password Reset — DXF AI`;

  const html = isHe ? `
    <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #f8fafc; border-radius: 12px;">
      <h2 style="color: #1e40af; margin-bottom: 8px;">איפוס סיסמא</h2>
      <p style="color: #374151; margin-bottom: 20px;">
        שלום ${displayName}!<br/>
        קיבלנו בקשה לאיפוס הסיסמא שלך. לחץ על הכפתור למטה להמשך.
      </p>
      <a href="${opts.resetUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">
        אפס סיסמא
      </a>
      <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">
        הקישור תקף לשעה אחת. אם לא ביקשת איפוס סיסמא, התעלם מהמייל הזה.
      </p>
    </div>
  ` : isRu ? `
    <div dir="ltr" style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #f8fafc; border-radius: 12px;">
      <h2 style="color: #1e40af; margin-bottom: 8px;">Сброс пароля</h2>
      <p style="color: #374151; margin-bottom: 20px;">
        Здравствуйте${displayName ? `, ${displayName}` : ""}!<br/>
        Мы получили запрос на сброс пароля. Нажмите кнопку ниже, чтобы продолжить.
      </p>
      <a href="${opts.resetUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">
        Сбросить пароль
      </a>
      <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">
        Ссылка действительна один час. Если вы не запрашивали сброс пароля, просто игнорируйте это письмо.
      </p>
    </div>
  ` : `
    <div dir="ltr" style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #f8fafc; border-radius: 12px;">
      <h2 style="color: #1e40af; margin-bottom: 8px;">Password Reset</h2>
      <p style="color: #374151; margin-bottom: 20px;">
        Hi${displayName ? ` ${displayName}` : ""}!<br/>
        We received a request to reset your password. Click the button below to continue.
      </p>
      <a href="${opts.resetUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">
        Reset Password
      </a>
      <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">
        This link is valid for 1 hour. If you didn't request a password reset, you can safely ignore this email.
      </p>
    </div>
  `;

  await resend.emails.send({
    from: FROM_ADDRESS,
    to: opts.to,
    subject,
    html,
  });
}

export async function sendWelcomeEmail(opts: {
  to: string;
  name: string | null;
  tokens: number;
  siteUrl: string;
  language?: "he" | "en";
  userId?: number;
}): Promise<void> {
  if (!resend) { console.warn("[emailService] RESEND_API_KEY not set, skipping welcome email"); return; }
  const isHe = (opts.language ?? "he") === "he";
  const displayName = opts.name?.trim() || "";
  const greeting = isHe
    ? `ברוך הבא${displayName ? ` ${displayName}` : ""}`
    : `Welcome${displayName ? ` ${displayName}` : ""}`;
  const subject = isHe ? `ברוך הבא ל-DXF AI` : `Welcome to DXF AI`;
  const unsubscribeUrl = opts.userId
    ? `${opts.siteUrl}/api/unsubscribe?token=${generateUnsubscribeToken(opts.userId)}`
    : null;

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
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;">
      <tr>
        <td width="36" valign="top" style="padding-top:2px;">
          <div style="width:28px;height:28px;background:#6366f1;border-radius:6px;text-align:center;line-height:28px;font-size:13px;">✦</div>
        </td>
        <td style="padding-right:12px;">
          <div style="font-size:13px;font-weight:600;color:#e4e4e7;margin-bottom:4px;">יצירת AI — תיאור מדויק = תוצאה מדויקת</div>
          <div style="font-size:12px;color:#71717a;line-height:1.7;">
            במקום לכתוב <span style="color:#a1a1aa;font-style:italic;">"אריה"</span> — כתוב:<br/>
            <span style="color:#a78bfa;font-style:italic;">"ראש אריה בפרופיל, קווי מתאר עבים, רקע לבן, סגנון חיתוך לייזר"</span><br/>
            ככל שהתיאור ספציפי יותר — כך הקובץ המתקבל מדויק יותר.
          </div>
        </td>
      </tr>
    </table>

    <!-- Tip 2: Photo to lines -->
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td width="36" valign="top" style="padding-top:2px;">
          <div style="width:28px;height:28px;background:#18181b;border:1px solid #3f3f46;border-radius:6px;text-align:center;line-height:26px;font-size:13px;">📷</div>
        </td>
        <td style="padding-right:12px;">
          <div style="font-size:13px;font-weight:600;color:#e4e4e7;margin-bottom:4px;">תמונה לקווים — צלם על רקע לבן</div>
          <div style="font-size:12px;color:#71717a;line-height:1.7;">
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
      קיבלת מייל זה כיוון שנרשמת ל-DXF AI.
      ${unsubscribeUrl ? `<br/><a href="${unsubscribeUrl}" style="color:#52525b;text-decoration:underline;">הסר אותי מרשימת הדיוור</a>` : ""}
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

  <!-- Header -->
  <tr><td style="padding:40px 48px 32px;border-bottom:1px solid #2a2a2a;">
    <div style="font-size:13px;font-weight:600;color:#6366f1;letter-spacing:2px;text-transform:uppercase;margin-bottom:16px;">DXF AI</div>
    <div style="font-size:26px;font-weight:700;color:#ffffff;line-height:1.3;">${greeting},</div>
    <div style="font-size:15px;color:#71717a;margin-top:8px;font-weight:300;">Your account is ready. Here's what you need to know.</div>
  </td></tr>

  <!-- Credits -->
  <tr><td style="padding:32px 48px;border-bottom:1px solid #2a2a2a;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#18181b;border:1px solid #27272a;border-radius:12px;">
      <tr><td style="padding:24px 28px;">
        <div style="font-size:11px;font-weight:600;color:#6366f1;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:10px;">Credits Balance</div>
        <div style="font-size:42px;font-weight:700;color:#ffffff;line-height:1;">${opts.tokens}</div>
        <div style="font-size:13px;color:#52525b;margin-top:6px;">credits available to use right now</div>
      </td></tr>
    </table>
  </td></tr>

  <!-- Tips section -->
  <tr><td style="padding:32px 48px;border-bottom:1px solid #2a2a2a;">
    <div style="font-size:11px;font-weight:600;color:#a1a1aa;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:20px;">Tips for best results</div>

    <!-- Tip 1: AI generation -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;">
      <tr>
        <td width="36" valign="top" style="padding-top:2px;">
          <div style="width:28px;height:28px;background:#6366f1;border-radius:6px;text-align:center;line-height:28px;font-size:13px;">✦</div>
        </td>
        <td style="padding-left:12px;">
          <div style="font-size:13px;font-weight:600;color:#e4e4e7;margin-bottom:4px;">AI Generation — specific prompt = accurate result</div>
          <div style="font-size:12px;color:#71717a;line-height:1.7;">
            Instead of typing <span style="color:#a1a1aa;font-style:italic;">"lion"</span> — try:<br/>
            <span style="color:#a78bfa;font-style:italic;">"lion head in profile, thick bold outlines, white background, laser cut style"</span><br/>
            The more specific your description, the cleaner your DXF output.
          </div>
        </td>
      </tr>
    </table>

    <!-- Tip 2: Photo to lines -->
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td width="36" valign="top" style="padding-top:2px;">
          <div style="width:28px;height:28px;background:#18181b;border:1px solid #3f3f46;border-radius:6px;text-align:center;line-height:26px;font-size:13px;">📷</div>
        </td>
        <td style="padding-left:12px;">
          <div style="font-size:13px;font-weight:600;color:#e4e4e7;margin-bottom:4px;">Photo to lines — shoot on a white background</div>
          <div style="font-size:12px;color:#71717a;line-height:1.7;">
            Converting a physical object? Place it on a <span style="color:#a1a1aa;">white sheet of paper</span> and photograph from above.<br/>
            High contrast between object and background = clean, accurate DXF lines.
          </div>
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- CTA -->
  <tr><td style="padding:32px 48px;border-bottom:1px solid #2a2a2a;text-align:center;">
    <a href="${opts.siteUrl}" style="display:inline-block;background:#6366f1;color:#ffffff;font-size:14px;font-weight:600;padding:14px 44px;border-radius:8px;text-decoration:none;letter-spacing:0.3px;">Open DXF AI →</a>
    <div style="font-size:11px;color:#52525b;margin-top:12px;">dxfai.ai</div>
  </td></tr>

  <!-- Support -->
  <tr><td style="padding:24px 48px;">
    <div style="font-size:12px;color:#52525b;line-height:1.8;">
      Questions? <a href="mailto:support@dxfai.ai" style="color:#6366f1;text-decoration:none;">support@dxfai.ai</a> — we reply within 24 hours.
    </div>
  </td></tr>

  <!-- Footer -->
  <tr><td style="padding:20px 48px;border-top:1px solid #2a2a2a;">
    <div style="font-size:11px;color:#3f3f46;line-height:1.8;">
      You received this email because you registered at DXF AI.
      ${unsubscribeUrl ? `<br/><a href="${unsubscribeUrl}" style="color:#52525b;text-decoration:underline;">Unsubscribe from emails</a>` : ""}
    </div>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`;

  const plainText = isHe
    ? `${greeting}\n\nנרשמת בהצלחה ל-DXF AI.\nיש לך ${opts.tokens} אסימונים חינם בחשבונך.\n\nכניסה לאתר: ${opts.siteUrl}\nשם משתמש: ${opts.to}\n\nצוות DXF AI\ndxfai.ai`
    : `${greeting}\n\nYou have successfully registered at DXF AI.\nYou have ${opts.tokens} free tokens in your account.\n\nWebsite: ${opts.siteUrl}\nEmail: ${opts.to}\n\nDXF AI Team\ndxfai.ai`;

  await resend.emails.send({
    from: FROM_ADDRESS,
    to: opts.to,
    subject,
    html,
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
          צריך עזרה? פנה אלינו בכל עת • <a href="${opts.siteUrl}" style="color: #6366f1; text-decoration: none;">dxfai.ai</a>
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
        <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">Need help? Contact us anytime • <a href="${opts.siteUrl}" style="color: #6366f1; text-decoration: none;">dxfai.ai</a></p>
      </div>
    </div>
  `;

  await resend.emails.send({
    from: FROM_ADDRESS,
    to: opts.to,
    subject,
    html: isHe ? heHtml : enHtml,
    headers: {
      'List-Unsubscribe': `<mailto:noreply@dxfai.ai?subject=unsubscribe>`,
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
      <p style="margin:4px 0 0; font-size:12px; color:#a5b4fc; font-family:Arial,sans-serif;">dxfai.ai</p>
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
        AI DXF &bull; <a href="https://dxfai.ai" style="color:#4f46e5; text-decoration:none;">dxfai.ai</a>
      </p>
      <p style="margin:0; font-size:11px; color:#d1d5db; font-family:Arial,sans-serif;">
        קיבלת מייל זה כי נרשמת לאתר AI DXF. <a href="mailto:noreply@dxfai.ai?subject=unsubscribe" style="color:#d1d5db;">הסרה מרשימת תפוצה</a>
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
    `AI DXF - dxfai.ai\n\n` +
    `שלום ${displayName},\n\n` +
    `לכניסה לאתר: https://dxfai.ai\n\n` +
    `להסרה מרשימת תפוצה: noreply@dxfai.ai`;

  await resend.emails.send({
    from: FROM_ADDRESS,
    to: opts.to,
    subject: opts.subject,
    html: wrappedHtml,
    text: textVersion,
    headers: {
      'List-Unsubscribe': `<mailto:noreply@dxfai.ai?subject=unsubscribe>, <https://dxfai.ai/unsubscribe>`,
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
      <span style="color:#ffffff;font-size:13px;font-weight:700;">✦ AI DXF — dxfai.ai</span>
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
    <p style="font-size:13px;font-weight:700;color:#4338ca;margin:0 0 6px;">AI DXF — dxfai.ai</p>
    <p style="font-size:11px;color:#9ca3af;line-height:1.7;margin:0;">
      קיבלת מייל זה כיוון שנרשמת לאתר AI DXF.<br/>
      <a href="${opts.siteUrl}" style="color:#6366f1;text-decoration:none;">dxfai.ai</a> &nbsp;|&nbsp;
      <a href="mailto:support@dxfai.ai" style="color:#6366f1;text-decoration:none;">support@dxfai.ai</a>
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
    <p style="font-size:11px;color:#9ca3af;">You received this because you registered at DXF AI. <a href="${opts.siteUrl}" style="color:#6366f1;">dxfai.ai</a></p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;

  const reminderPlainText = isHe
    ? `שלום ${displayName},\n\nנרשמת ל-DXF AI אבל עוד לא קיבלת את 20 האסימונים הבונוס שלך.\n\nלחץ כאן לקבלתם: ${bonusUrl}\n\nצוות DXF AI\ndxfai.ai\n\nלהסרה: noreply@dxfai.ai`
    : `Hi ${displayName},\n\nYou signed up for DXF AI but haven't claimed your 20 bonus tokens yet.\n\nClaim them here: ${bonusUrl}\n\nDXF AI Team\ndxfai.ai\n\nUnsubscribe: noreply@dxfai.ai`;

  await resend.emails.send({
    from: FROM_ADDRESS,
    to: opts.to,
    subject,
    html: isHe ? heHtml : enHtml,
    text: reminderPlainText,
    headers: {
      'List-Unsubscribe': `<mailto:noreply@dxfai.ai?subject=unsubscribe>, <https://dxfai.ai/unsubscribe>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  });
}

/**
 * Send an email to a user when their shared DXF file has been approved by the admin.
 * The email includes a link to view the file on the free DXF library page.
 */
export async function sendShareApprovedEmail(opts: {
  to: string;
  name: string | null;
  fileTitle: string;
  fileUrl: string; // full URL to the file page on the free DXF site
  language?: "he" | "en" | "ru" | "es" | "fr" | "ar" | "zh";
}): Promise<void> {
  if (!resend) { console.warn("[emailService] RESEND_API_KEY not set, skipping share approved email"); return; }
  const lang = opts.language ?? "he";
  const isHe = lang === "he";
  const displayName = opts.name?.trim() || "";

  const subjectMap: Record<string, string> = {
    he: `✅ הקובץ שלך אושר ופורסם בספריית DXF החינמית`,
    en: `✅ Your file has been approved and published in the free DXF library`,
    ru: `✅ Ваш файл одобрен и опубликован в бесплатной библиотеке DXF`,
    es: `✅ Tu archivo ha sido aprobado y publicado en la biblioteca DXF gratuita`,
    fr: `✅ Votre fichier a été approuvé et publié dans la bibliothèque DXF gratuite`,
    ar: `✅ تمت الموافقة على ملفك ونشره في مكتبة DXF المجانية`,
    zh: `✅ 您的文件已获批准并发布在免费DXF库中`,
  };
  const subject = subjectMap[lang] ?? subjectMap.en;

  const heHtml = `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>הקובץ שלך אושר</title>
</head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:32px 0;">
  <tr><td align="center">
    <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.07);">
      <!-- Header -->
      <tr><td style="background:linear-gradient(135deg,#059669 0%,#10b981 100%);padding:28px 32px;text-align:right;">
        <p style="margin:0;color:#ffffff;font-size:13px;font-weight:600;letter-spacing:0.5px;">DXF AI</p>
        <h1 style="margin:8px 0 0;color:#ffffff;font-size:22px;font-weight:700;">הקובץ שלך אושר! 🎉</h1>
      </td></tr>
      <!-- Body -->
      <tr><td style="padding:32px;direction:rtl;">
        <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 16px;">
          שלום${displayName ? ` ${displayName}` : ""}!
        </p>
        <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 16px;">
          הקובץ שהגשת לשיתוף — <strong>${opts.fileTitle}</strong> — אושר ופורסם בספריית הקבצים החינמית שלנו.
        </p>
        <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 24px;">
          כעת כל משתמשי האתר יכולים לצפות בו ולהוריד אותו בחינם.
        </p>
        <p style="margin:0 0 32px;text-align:right;">
          <a href="${opts.fileUrl}"
             style="display:inline-block;background:#059669;color:#ffffff;font-size:15px;font-weight:600;padding:13px 28px;border-radius:8px;text-decoration:none;">
            צפה בקובץ שלך &rarr;
          </a>
        </p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 20px;"/>
        <p style="color:#9ca3af;font-size:12px;line-height:1.6;margin:0;">
          תודה על שיתוף היצירה שלך עם הקהילה!<br/>
          צוות DXF AI &bull; <a href="https://dxfai.ai" style="color:#6b7280;text-decoration:none;">dxfai.ai</a>
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;

  const enHtml = `<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Your file has been approved</title>
</head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:32px 0;">
  <tr><td align="center">
    <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.07);">
      <!-- Header -->
      <tr><td style="background:linear-gradient(135deg,#059669 0%,#10b981 100%);padding:28px 32px;">
        <p style="margin:0;color:#ffffff;font-size:13px;font-weight:600;letter-spacing:0.5px;">DXF AI</p>
        <h1 style="margin:8px 0 0;color:#ffffff;font-size:22px;font-weight:700;">Your file has been approved! 🎉</h1>
      </td></tr>
      <!-- Body -->
      <tr><td style="padding:32px;">
        <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 16px;">
          Hi${displayName ? ` ${displayName}` : ""}!
        </p>
        <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 16px;">
          The file you submitted for sharing — <strong>${opts.fileTitle}</strong> — has been approved and published in our free DXF library.
        </p>
        <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 24px;">
          All users can now view and download it for free.
        </p>
        <p style="margin:0 0 32px;">
          <a href="${opts.fileUrl}"
             style="display:inline-block;background:#059669;color:#ffffff;font-size:15px;font-weight:600;padding:13px 28px;border-radius:8px;text-decoration:none;">
            View your file &rarr;
          </a>
        </p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 20px;"/>
        <p style="color:#9ca3af;font-size:12px;line-height:1.6;margin:0;">
          Thank you for sharing your creation with the community!<br/>
          DXF AI Team &bull; <a href="https://dxfai.ai" style="color:#6b7280;text-decoration:none;">dxfai.ai</a>
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;

  // Build plain text and HTML for non-he/en languages
  const greetingMap: Record<string, string> = {
    ru: `Здравствуйте${displayName ? ` ${displayName}` : ""}!`,
    es: `¡Hola${displayName ? ` ${displayName}` : ""}!`,
    fr: `Bonjour${displayName ? ` ${displayName}` : ""}!`,
    ar: `مرحباً${displayName ? ` ${displayName}` : ""}!`,
    zh: `您好${displayName ? ` ${displayName}` : ""}！`,
  };
  const bodyMap: Record<string, string> = {
    ru: `Файл, который вы отправили для публикации — <strong>${opts.fileTitle}</strong> — одобрен и опубликован в нашей бесплатной библиотеке DXF.`,
    es: `El archivo que enviaste para compartir — <strong>${opts.fileTitle}</strong> — ha sido aprobado y publicado en nuestra biblioteca DXF gratuita.`,
    fr: `Le fichier que vous avez soumis — <strong>${opts.fileTitle}</strong> — a été approuvé et publié dans notre bibliothèque DXF gratuite.`,
    ar: `الملف الذي أرسلته للمشاركة — <strong>${opts.fileTitle}</strong> — تمت الموافقة عليه ونشره في مكتبة DXF المجانية.`,
    zh: `您提交分享的文件 — <strong>${opts.fileTitle}</strong> — 已获批准并发布在我们的免费DXF库中。`,
  };
  const btnMap: Record<string, string> = {
    ru: "Посмотреть файл",
    es: "Ver tu archivo",
    fr: "Voir votre fichier",
    ar: "عرض ملفك",
    zh: "查看您的文件",
  };
  const thanksMap: Record<string, string> = {
    ru: "Спасибо за вклад в сообщество!",
    es: "¡Gracias por compartir tu creación con la comunidad!",
    fr: "Merci de partager votre création avec la communauté!",
    ar: "شكراً لمشاركة إبداعك مع المجتمع!",
    zh: "感谢您与社区分享您的作品！",
  };

  let finalHtml: string;
  let finalText: string;
  if (isHe) {
    finalHtml = heHtml;
    finalText = `שלום${displayName ? ` ${displayName}` : ""}!\n\nהקובץ שלך "${opts.fileTitle}" אושר ופורסם בספריית DXF החינמית.\n\nצפה בקובץ: ${opts.fileUrl}\n\nתודה על השיתוף!\nצוות DXF AI\ndxfai.ai`;
  } else if (lang === "en") {
    finalHtml = enHtml;
    finalText = `Hi${displayName ? ` ${displayName}` : ""}!\n\nYour file "${opts.fileTitle}" has been approved and published in the free DXF library.\n\nView your file: ${opts.fileUrl}\n\nThank you for sharing!\nDXF AI Team\ndxfai.ai`;
  } else {
    const dir = lang === "ar" ? "rtl" : "ltr";
    const greeting = greetingMap[lang] ?? `Hi${displayName ? ` ${displayName}` : ""}!`;
    const bodyText = bodyMap[lang] ?? `Your file <strong>${opts.fileTitle}</strong> has been approved.`;
    const btnText = btnMap[lang] ?? "View file";
    const thanksText = thanksMap[lang] ?? "Thank you for sharing!";
    finalHtml = `<!DOCTYPE html><html lang="${lang}" dir="${dir}"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head><body style="margin:0;padding:0;background:#f9fafb;font-family:Arial,Helvetica,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:32px 0;"><tr><td align="center"><table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.07);"><tr><td style="background:linear-gradient(135deg,#059669 0%,#10b981 100%);padding:28px 32px;"><p style="margin:0;color:#ffffff;font-size:13px;font-weight:600;">DXF AI</p><h1 style="margin:8px 0 0;color:#ffffff;font-size:22px;font-weight:700;">🎉</h1></td></tr><tr><td style="padding:32px;direction:${dir};"><p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 16px;">${greeting}</p><p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 24px;">${bodyText}</p><p style="margin:0 0 32px;"><a href="${opts.fileUrl}" style="display:inline-block;background:#059669;color:#ffffff;font-size:15px;font-weight:600;padding:13px 28px;border-radius:8px;text-decoration:none;">${btnText} &rarr;</a></p><hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 20px;"/><p style="color:#9ca3af;font-size:12px;line-height:1.6;margin:0;">${thanksText}<br/>DXF AI &bull; <a href="https://dxfai.ai" style="color:#6b7280;text-decoration:none;">dxfai.ai</a></p></td></tr></table></td></tr></table></body></html>`;
    finalText = `${greeting.replace(/<[^>]+>/g, "")}\n\n${opts.fileTitle}\n\n${opts.fileUrl}\n\n${thanksText}\nDXF AI\ndxfai.ai`;
  }

  await resend.emails.send({
    from: FROM_ADDRESS,
    to: opts.to,
    subject,
    html: finalHtml,
    text: finalText,
  });
}

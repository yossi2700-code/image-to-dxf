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

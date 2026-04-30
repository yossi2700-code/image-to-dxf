import dotenv from "dotenv";
dotenv.config();
import mysql from "mysql2/promise";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_ADDRESS = process.env.EMAIL_FROM ?? "onboarding@resend.dev";
const SITE_URL = "https://dxfai.ai";
const HEADER_IMG = "https://d2xsxph8kpxj0f.cloudfront.net/310519663365044246/hnDFdLkzVGYJYdws9hbnLw/email-opt-a-Da65nhEFrXDrzAwvUjp6VL.png";

// Hebrew name detection — if name contains Hebrew chars, user is likely Israeli
function isHebrewName(name) {
  if (!name) return false;
  return /[\u05D0-\u05EA]/.test(name);
}

// Israeli email domains
const ISRAELI_DOMAINS = ["walla.com", "013net.net", "bezeqint.net", "netvision.net.il", "zahav.net.il", "hot.net.il"];

function isLikelyHebrew(user) {
  const emailDomain = (user.email ?? "").split("@")[1]?.toLowerCase() ?? "";
  if (ISRAELI_DOMAINS.some(d => emailDomain.endsWith(d))) return true;
  if (isHebrewName(user.name)) return true;
  return false;
}

function buildEnglishReminderEmail({ name = null, unsubscribeToken = "DEMO" }) {
  const displayName = name ?? "";
  const greeting = displayName ? `Hi ${displayName},` : "Hi there,";

  const html = `<!DOCTYPE html>
<html dir="ltr" lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0f172a;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:32px 16px;">
  <tr><td align="center">
    <table width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%;background:#1e293b;border-radius:20px;overflow:hidden;border:1px solid #334155;">
      <tr><td style="padding:0;">
        <img src="${HEADER_IMG}" alt="DXF AI" width="580" style="width:100%;display:block;border-radius:20px 20px 0 0;object-fit:cover;max-height:220px;" />
      </td></tr>
      <tr><td style="background:linear-gradient(90deg,#4f46e5,#7c3aed);padding:12px 32px;text-align:center;">
        <span style="color:white;font-size:20px;font-weight:900;letter-spacing:1px;font-family:Arial,sans-serif;">DXF <span style="color:#c4b5fd;font-weight:400;">AI</span></span>
      </td></tr>
      <tr><td style="padding:40px 40px 32px;font-family:Arial,sans-serif;direction:ltr;">
        <p style="color:#94a3b8;font-size:15px;margin:0 0 6px;">${greeting}</p>
        <h1 style="color:#f1f5f9;font-size:26px;font-weight:900;margin:0 0 12px;line-height:1.3;">Created anything amazing lately?</h1>
        <p style="color:#94a3b8;font-size:15px;line-height:1.8;margin:0 0 32px;">Thousands of designers and makers use DXF AI every day to turn ideas into laser-cut and CNC-ready files. Here is what you can do right now:</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
          <tr><td style="background:#0f172a;border-radius:12px;padding:18px 20px;border-left:3px solid #6366f1;">
            <p style="margin:0 0 4px;color:#e2e8f0;font-weight:700;font-size:14px;">Describe in text — get a DXF file</p>
            <p style="margin:0;color:#64748b;font-size:13px;line-height:1.6;">Type what you want, AI draws it, you download it instantly</p>
          </td></tr>
          <tr><td style="height:8px;"></td></tr>
          <tr><td style="background:#0f172a;border-radius:12px;padding:18px 20px;border-left:3px solid #0d9488;">
            <p style="margin:0 0 4px;color:#e2e8f0;font-weight:700;font-size:14px;">Photograph an object — get clean lines</p>
            <p style="margin:0;color:#64748b;font-size:13px;line-height:1.6;">Shoot on a white background, the site converts to SVG/DXF in seconds</p>
          </td></tr>
          <tr><td style="height:8px;"></td></tr>
          <tr><td style="background:#0f172a;border-radius:12px;padding:18px 20px;border-left:3px solid #8b5cf6;">
            <p style="margin:0 0 4px;color:#e2e8f0;font-weight:700;font-size:14px;">Free DXF files — no credits needed</p>
            <p style="margin:0;color:#64748b;font-size:13px;line-height:1.6;">Hundreds of ready-made designs — flowers, geometry, logos, portraits</p>
          </td></tr>
          <tr><td style="height:8px;"></td></tr>
        </table>
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
          <tr><td style="background:linear-gradient(135deg,#022c22,#064e3b);border-radius:14px;padding:24px;border:1px solid #059669;text-align:center;">
            <p style="margin:0 0 6px;color:#6ee7b7;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Completely free</p>
            <p style="margin:0 0 16px;color:#f1f5f9;font-size:18px;font-weight:900;line-height:1.4;">Hundreds of DXF files ready to download</p>
            <a href="${SITE_URL}/free" style="display:inline-block;background:linear-gradient(135deg,#059669,#0d9488);color:white;padding:13px 32px;border-radius:50px;text-decoration:none;font-weight:900;font-size:14px;box-shadow:0 4px 16px rgba(5,150,105,0.5);">Download free files</a>
          </td></tr>
        </table>
        <div style="text-align:center;margin-bottom:32px;">
          <a href="${SITE_URL}" style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:white;padding:16px 44px;border-radius:50px;text-decoration:none;font-weight:900;font-size:16px;box-shadow:0 6px 24px rgba(99,102,241,0.45);">Start creating now</a>
        </div>
        <div style="border-top:1px solid #334155;padding-top:24px;text-align:center;">
          <p style="color:#64748b;font-size:13px;line-height:1.8;margin:0;">Made something you are proud of? Share it with us — just reply to this email. We would love to see what you created.</p>
        </div>
      </td></tr>
      <tr><td style="background:#0f172a;padding:20px 40px;border-top:1px solid #1e293b;text-align:center;font-family:Arial,sans-serif;">
        <p style="margin:0 0 8px;color:#475569;font-size:12px;">&copy; 2025 DXF AI &middot; <a href="${SITE_URL}" style="color:#6366f1;text-decoration:none;">dxfai.ai</a></p>
        <p style="margin:0;color:#334155;font-size:11px;"><a href="${SITE_URL}/unsubscribe?token=${unsubscribeToken}" style="color:#334155;text-decoration:underline;">Unsubscribe</a></p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;

  return {
    subject: "Created anything amazing lately?",
    html,
  };
}

const db = await mysql.createConnection(process.env.DATABASE_URL);

// Get all users who are NOT likely Hebrew speakers
const [allUsers] = await db.execute(`
  SELECT id, email, name, language
  FROM app_users
  WHERE email IS NOT NULL
    AND email != ''
    AND (emailOptOut IS NULL OR emailOptOut = 0)
  ORDER BY createdAt ASC
`);

await db.end();

// Filter to international users only (not Hebrew)
const internationalUsers = allUsers.filter(u => !isLikelyHebrew(u));

// Also update their language in DB
const db2 = await mysql.createConnection(process.env.DATABASE_URL);
for (const user of internationalUsers) {
  await db2.execute(`UPDATE app_users SET language = 'en' WHERE id = ?`, [user.id]);
}
await db2.end();

console.log(`📋 International users identified: ${internationalUsers.length} (out of ${allUsers.length} total)`);
console.log(`   Language updated to 'en' in DB for all ${internationalUsers.length} users`);

let sent = 0;
let failed = 0;

for (const user of internationalUsers) {
  const { subject, html } = buildEnglishReminderEmail({
    name: user.name,
    unsubscribeToken: Buffer.from(`${user.id}:campaign1`).toString("base64"),
  });

  try {
    await resend.emails.send({
      from: FROM_ADDRESS,
      to: user.email,
      subject,
      html,
      text: `Hi! Start creating at DXF AI: ${SITE_URL} — Free files: ${SITE_URL}/free`,
      replyTo: "support@dxfai.ai",
    });

    sent++;
    console.log(`✅ [${sent}/${internationalUsers.length}] ${user.email}`);
    await new Promise(r => setTimeout(r, 200));
  } catch (err) {
    failed++;
    console.error(`❌ Failed: ${user.email} — ${err.message}`);
  }
}

console.log(`\n📊 English Campaign Complete`);
console.log(`   Sent:   ${sent}`);
console.log(`   Failed: ${failed}`);
console.log(`   Total:  ${internationalUsers.length}`);

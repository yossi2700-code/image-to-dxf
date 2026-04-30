import dotenv from "dotenv";
dotenv.config();
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_ADDRESS = process.env.EMAIL_FROM ?? "onboarding@resend.dev";
const SITE_URL = "https://dxfai.ai";
const HEADER_IMG = "https://d2xsxph8kpxj0f.cloudfront.net/310519663365044246/hnDFdLkzVGYJYdws9hbnLw/email-opt-a-Da65nhEFrXDrzAwvUjp6VL.png";

function buildReminderEmail({ language = "he", name = null, unsubscribeToken = "DEMO" }) {
  const isHe = language === "he";
  const dir = isHe ? "rtl" : "ltr";
  const lang = isHe ? "he" : "en";
  const displayName = name ?? (isHe ? "" : "");

  const subject = isHe
    ? "יצרת משהו מדהים לאחרונה?"
    : "Created anything amazing lately?";

  const greeting = isHe
    ? (displayName ? `שלום ${displayName},` : "שלום,")
    : (displayName ? `Hi ${displayName},` : "Hi there,");

  const headline = isHe
    ? "יצרת משהו מדהים לאחרונה?"
    : "Created anything amazing lately?";

  const subheadline = isHe
    ? "אלפי מעצבים ויוצרים משתמשים ב-DXF AI כל יום כדי להפוך רעיונות לקבצים מוכנים לחיתוך לייזר ו-CNC. הנה מה שאפשר לעשות עכשיו:"
    : "Thousands of designers and makers use DXF AI every day to turn ideas into laser-cut and CNC-ready files. Here is what you can do right now:";

  const features = isHe ? [
    { color: "#6366f1", title: "תאר בטקסט — קבל קובץ DXF", desc: "\"מנדלה עגולה עם 8 עלים\" — AI מצייר, אתה מוריד" },
    { color: "#0d9488", title: "צלם חפץ — קבל קווים מדויקים", desc: "צלם על רקע לבן, האתר ממיר לקובץ SVG/DXF תוך שניות" },
    { color: "#8b5cf6", title: "קבצי DXF חינם — ללא קרדיטים", desc: "מאות עיצובים מוכנים — פרחים, גיאומטריה, לוגואים, פורטרטים" },
  ] : [
    { color: "#6366f1", title: "Describe in text — get a DXF file", desc: "\"Round mandala with 8 petals\" — AI draws it, you download it" },
    { color: "#0d9488", title: "Photograph an object — get clean lines", desc: "Shoot on a white background, the site converts to SVG/DXF in seconds" },
    { color: "#8b5cf6", title: "Free DXF files — no credits needed", desc: "Hundreds of ready-made designs — flowers, geometry, logos, portraits" },
  ];

  const freeLabel = isHe ? "חינם לחלוטין" : "Completely free";
  const freeTitle = isHe ? "מאות קבצי DXF מוכנים להורדה" : "Hundreds of DXF files ready to download";
  const freeCta = isHe ? "הורד קבצים חינם" : "Download free files";
  const mainCta = isHe ? "כנס ויצרו עכשיו" : "Start creating now";
  const replyText = isHe
    ? "יצרת משהו שאתה גאה בו? שתף אותנו — פשוט השב על המייל הזה. נשמח לראות מה יצרת."
    : "Made something you are proud of? Share it with us — just reply to this email. We would love to see what you created.";
  const unsubText = isHe ? "הסר אותי מרשימת הדיוור" : "Unsubscribe";

  const featureRows = features.map(f => `
    <tr>
      <td style="background:#0f172a;border-radius:12px;padding:18px 20px;border-${isHe ? "right" : "left"}:3px solid ${f.color};">
        <p style="margin:0 0 4px;color:#e2e8f0;font-weight:700;font-size:14px;">${f.title}</p>
        <p style="margin:0;color:#64748b;font-size:13px;line-height:1.6;">${f.desc}</p>
      </td>
    </tr>
    <tr><td style="height:8px;"></td></tr>
  `).join("");

  const html = `<!DOCTYPE html>
<html dir="${dir}" lang="${lang}">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0f172a;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:32px 16px;">
  <tr><td align="center">
    <table width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%;background:#1e293b;border-radius:20px;overflow:hidden;border:1px solid #334155;">

      <tr>
        <td style="padding:0;">
          <img src="${HEADER_IMG}" alt="DXF AI" width="580" style="width:100%;display:block;border-radius:20px 20px 0 0;object-fit:cover;max-height:220px;" />
        </td>
      </tr>

      <tr>
        <td style="background:linear-gradient(90deg,#4f46e5,#7c3aed);padding:12px 32px;text-align:center;">
          <span style="color:white;font-size:20px;font-weight:900;letter-spacing:1px;font-family:Arial,sans-serif;">DXF <span style="color:#c4b5fd;font-weight:400;">AI</span></span>
        </td>
      </tr>

      <tr>
        <td style="padding:40px 40px 32px;font-family:Arial,sans-serif;direction:${dir};">

          <p style="color:#94a3b8;font-size:15px;margin:0 0 6px;">${greeting}</p>
          <h1 style="color:#f1f5f9;font-size:26px;font-weight:900;margin:0 0 12px;line-height:1.3;">${headline}</h1>
          <p style="color:#94a3b8;font-size:15px;line-height:1.8;margin:0 0 32px;">${subheadline}</p>

          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
            ${featureRows}
          </table>

          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
            <tr>
              <td style="background:linear-gradient(135deg,#022c22,#064e3b);border-radius:14px;padding:24px;border:1px solid #059669;text-align:center;">
                <p style="margin:0 0 6px;color:#6ee7b7;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">${freeLabel}</p>
                <p style="margin:0 0 16px;color:#f1f5f9;font-size:18px;font-weight:900;line-height:1.4;">${freeTitle}</p>
                <a href="${SITE_URL}/free"
                   style="display:inline-block;background:linear-gradient(135deg,#059669,#0d9488);color:white;padding:13px 32px;border-radius:50px;text-decoration:none;font-weight:900;font-size:14px;box-shadow:0 4px 16px rgba(5,150,105,0.5);">
                  ${freeCta}
                </a>
              </td>
            </tr>
          </table>

          <div style="text-align:center;margin-bottom:32px;">
            <a href="${SITE_URL}"
               style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:white;padding:16px 44px;border-radius:50px;text-decoration:none;font-weight:900;font-size:16px;box-shadow:0 6px 24px rgba(99,102,241,0.45);">
              ${mainCta}
            </a>
          </div>

          <div style="border-top:1px solid #334155;padding-top:24px;text-align:center;">
            <p style="color:#64748b;font-size:13px;line-height:1.8;margin:0;">${replyText}</p>
          </div>

        </td>
      </tr>

      <tr>
        <td style="background:#0f172a;padding:20px 40px;border-top:1px solid #1e293b;text-align:center;font-family:Arial,sans-serif;">
          <p style="margin:0 0 8px;color:#475569;font-size:12px;">
            &copy; 2025 DXF AI &middot; <a href="${SITE_URL}" style="color:#6366f1;text-decoration:none;">dxfai.ai</a>
          </p>
          <p style="margin:0;color:#334155;font-size:11px;">
            <a href="${SITE_URL}/unsubscribe?token=${unsubscribeToken}" style="color:#334155;text-decoration:underline;">${unsubText}</a>
          </p>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;

  return { subject, html };
}

// Send English version as test
const { subject, html } = buildReminderEmail({ language: "en", name: "Yossi" });

const result = await resend.emails.send({
  from: FROM_ADDRESS,
  to: "yossi2700@gmail.com",
  subject,
  html,
  text: "Thousands of designers use DXF AI every day. Start creating: https://dxfai.ai — Free DXF files: https://dxfai.ai/free-dxf",
  replyTo: "support@dxfai.ai",
});

console.log("✅ English reminder email sent!", result.data?.id ?? result.error);

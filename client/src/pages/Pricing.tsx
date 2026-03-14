import { useState } from "react";
import { useLocation } from "wouter";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { Check, Sparkles, Zap, Star, ArrowLeft, ArrowRight, ShoppingCart, Gift } from "lucide-react";

// ─── Currency detection ───────────────────────────────────────────────────────
const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$", EUR: "€", GBP: "£", ILS: "₪", CAD: "CA$", AUD: "A$",
};

const TZ_CURRENCY: Record<string, string> = {
  "Asia/Jerusalem": "ILS", "Asia/Tel_Aviv": "ILS",
  "Europe/London": "GBP",
  "America/Toronto": "CAD", "America/Vancouver": "CAD",
  "Australia/Sydney": "AUD", "Australia/Melbourne": "AUD",
  "Europe/Berlin": "EUR", "Europe/Paris": "EUR", "Europe/Madrid": "EUR",
};

function detectCurrency(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (TZ_CURRENCY[tz]) return TZ_CURRENCY[tz];
    const locale = navigator.language || "en-US";
    if (locale.startsWith("he")) return "ILS";
    if (locale.startsWith("en-GB")) return "GBP";
    if (locale.startsWith("en-CA")) return "CAD";
    if (locale.startsWith("en-AU")) return "AUD";
    if (locale.startsWith("de") || locale.startsWith("fr") || locale.startsWith("es")) return "EUR";
  } catch { /* ignore */ }
  return "USD";
}

const FALLBACK_PACKAGES = [
  {
    id: "tokens_50",
    tokens: 50,
    popular: false,
    prices: { USD: "29.00", EUR: "27.00", GBP: "23.00", ILS: "109.00", CAD: "40.00", AUD: "45.00" } as Record<string, string>,
  },
  {
    id: "tokens_100",
    tokens: 100,
    popular: true,
    prices: { USD: "49.00", EUR: "45.00", GBP: "39.00", ILS: "185.00", CAD: "67.00", AUD: "75.00" } as Record<string, string>,
  },
];

// ─── Feature list per package ─────────────────────────────────────────────────
const FEATURES_HE = [
  "המרת תמונה ל-DXF",
  "יצירת עיצוב עם AI",
  "AI Trace — עקיבה חכמה",
  "פורטרט — זיהוי פנים",
  "היסטוריית עיצובים",
  "הורדת DXF + SVG",
  "ללא תפוגה לאסימונים",
  "תמיכה בעברית",
];

const FEATURES_EN = [
  "Image to DXF conversion",
  "AI design generation",
  "AI Trace — smart tracing",
  "Portrait — face detection",
  "Design history",
  "DXF + SVG download",
  "Tokens never expire",
  "Hebrew & English support",
];

// ─── FAQ ──────────────────────────────────────────────────────────────────────
const FAQ_HE = [
  {
    q: "מה זה אסימון?",
    a: "כל פעולה (המרת תמונה, יצירת AI, עקיבה) עולה אסימון אחד. אסימונים לא פגים ונשארים בחשבון שלך לתמיד.",
  },
  {
    q: "האם האסימונים פגים?",
    a: "לא. אסימונים שרכשת נשארים בחשבונך ללא הגבלת זמן.",
  },
  {
    q: "האם יש החזר כספי?",
    a: "כל הרכישות סופיות. אם הייתה שגיאה מצדנו — האסימון יוחזר אוטומטית תוך 24 שעות.",
  },
  {
    q: "איזה פורמטים נתמכים?",
    a: "ניתן להעלות JPG, PNG, WEBP. הפלט הוא קובץ DXF תואם לכל תוכנת CAD, CNC ולייזר.",
  },
  {
    q: "האם אני שומר על זכויות הקובץ?",
    a: "כן. כל קבצי ה-DXF שנוצרו מתמונותיך הם שלך לחלוטין — לשימוש אישי ומסחרי.",
  },
];

const FAQ_EN = [
  {
    q: "What is a token?",
    a: "Each action (image conversion, AI generation, tracing) costs one token. Tokens never expire.",
  },
  {
    q: "Do tokens expire?",
    a: "No. Purchased tokens remain in your account indefinitely.",
  },
  {
    q: "Is there a refund policy?",
    a: "All purchases are final. If a job fails due to a server error on our side, the token is automatically refunded within 24 hours.",
  },
  {
    q: "What file formats are supported?",
    a: "Upload JPG, PNG, or WEBP. Output is a DXF file compatible with all CAD, CNC, and laser software.",
  },
  {
    q: "Do I own the output files?",
    a: "Yes. All DXF files generated from your images are fully yours — for personal and commercial use.",
  },
];

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Pricing() {
  const { isRtl } = useLanguage();
  const [, navigate] = useLocation();
  const [currency, setCurrency] = useState(() => detectCurrency());
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const { data: dbPrices } = trpc.packages.prices.useQuery();

  const packages = dbPrices && dbPrices.length > 0
    ? dbPrices.map((p) => ({
        id: p.packageId,
        tokens: p.tokenAmount,
        popular: p.packageId === "tokens_100",
        label: p.label,
        badge: p.badge ?? null,
        prices: {
          USD: p.priceUSD, EUR: p.priceEUR, ILS: p.priceILS,
          GBP: p.priceGBP, AUD: p.priceAUD, CAD: p.priceCAD,
        } as Record<string, string>,
      }))
    : FALLBACK_PACKAGES;

  const features = isRtl ? FEATURES_HE : FEATURES_EN;
  const faq = isRtl ? FAQ_HE : FAQ_EN;
  const symbol = CURRENCY_SYMBOLS[currency] ?? "$";

  const currencies = ["ILS", "USD", "EUR", "GBP", "CAD", "AUD"];

  return (
    <div
      dir={isRtl ? "rtl" : "ltr"}
      style={{ minHeight: "100vh", background: "linear-gradient(160deg, #f8f7ff 0%, #eef2ff 50%, #f0fdf4 100%)", fontFamily: "Inter, sans-serif" }}
    >
      {/* ── Header ── */}
      <header style={{ background: "#fff", borderBottom: "1px solid #e8eaf0", boxShadow: "0 1px 8px rgba(0,0,0,0.06)", position: "sticky", top: 0, zIndex: 20 }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "12px 20px", display: "flex", alignItems: "center", gap: 12 }}>
          {/* Back button */}
          <button
            onClick={() => navigate("/")}
            style={{ display: "flex", alignItems: "center", gap: 6, color: "#6366f1", fontWeight: 600, fontSize: 14, background: "none", border: "none", cursor: "pointer", padding: "6px 10px", borderRadius: 8, transition: "background 0.15s" }}
            onMouseEnter={e => (e.currentTarget.style.background = "#eef2ff")}
            onMouseLeave={e => (e.currentTarget.style.background = "none")}
          >
            {isRtl ? <ArrowRight size={16} /> : <ArrowLeft size={16} />}
            {isRtl ? "חזרה לאתר" : "Back to site"}
          </button>

          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginInlineStart: "auto" }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg, #6366f1, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="15" height="15" viewBox="0 0 20 20" fill="none">
                <path d="M4 16 Q7 7 10 10 Q13 13 16 4" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none" />
                <circle cx="4" cy="16" r="1.8" fill="#06b6d4" />
                <circle cx="10" cy="10" r="1.8" fill="white" />
                <circle cx="16" cy="4" r="1.8" fill="#06b6d4" />
              </svg>
            </div>
            <span style={{ fontWeight: 900, fontSize: 16, color: "#6366f1", letterSpacing: "-0.02em" }}>Ai</span>
            <span style={{ fontWeight: 900, fontSize: 16, color: "#111827", letterSpacing: "-0.02em" }}>DXF</span>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section style={{ textAlign: "center", padding: "60px 20px 40px" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#eef2ff", border: "1px solid #c7d2fe", borderRadius: 100, padding: "6px 16px", marginBottom: 20 }}>
          <Sparkles size={14} color="#6366f1" />
          <span style={{ fontSize: 13, fontWeight: 600, color: "#4338ca" }}>
            {isRtl ? "ללא מנוי חודשי — שלם רק על מה שאתה משתמש" : "No monthly subscription — pay only for what you use"}
          </span>
        </div>
        <h1 style={{ fontSize: "clamp(28px, 5vw, 48px)", fontWeight: 900, color: "#111827", margin: "0 0 16px", lineHeight: 1.15 }}>
          {isRtl ? "בחר חבילת אסימונים" : "Choose your token package"}
        </h1>
        <p style={{ fontSize: 18, color: "#6b7280", maxWidth: 520, margin: "0 auto 32px" }}>
          {isRtl
            ? "המר תמונות ל-DXF, צור עיצובים עם AI, ועקוב אחרי קווים — הכל עם אסימון אחד לפעולה"
            : "Convert images to DXF, generate AI designs, and trace outlines — all for one token per action"}
        </p>

        {/* Currency selector */}
        <div style={{ display: "flex", justifyContent: "center", gap: 6, flexWrap: "wrap" }}>
          {currencies.map((c) => (
            <button
              key={c}
              onClick={() => setCurrency(c)}
              style={{
                padding: "6px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "all 0.15s",
                background: currency === c ? "#6366f1" : "#fff",
                color: currency === c ? "#fff" : "#6b7280",
                border: currency === c ? "1px solid #6366f1" : "1px solid #e5e7eb",
              }}
            >
              {CURRENCY_SYMBOLS[c]} {c}
            </button>
          ))}
        </div>
      </section>

      {/* ── Packages ── */}
      <section style={{ maxWidth: 900, margin: "0 auto", padding: "0 20px 60px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24 }}>
        {packages.map((pkg) => {
          const price = pkg.prices[currency] ?? pkg.prices["USD"] ?? "—";
          const perToken = price !== "—" ? (parseFloat(price) / pkg.tokens).toFixed(2) : "—";

          return (
            <div
              key={pkg.id}
              style={{
                background: pkg.popular ? "linear-gradient(160deg, #6366f1 0%, #8b5cf6 100%)" : "#fff",
                borderRadius: 20,
                padding: 32,
                boxShadow: pkg.popular ? "0 20px 60px rgba(99,102,241,0.35)" : "0 4px 24px rgba(0,0,0,0.08)",
                border: pkg.popular ? "none" : "1px solid #e5e7eb",
                position: "relative",
                transform: pkg.popular ? "scale(1.03)" : "none",
                transition: "transform 0.2s",
              }}
            >
              {/* Popular badge */}
              {pkg.popular && (
                <div style={{
                  position: "absolute", top: -14, left: "50%", transform: "translateX(-50%)",
                  background: "linear-gradient(135deg, #f59e0b, #f97316)", color: "#fff",
                  fontSize: 12, fontWeight: 700, padding: "5px 16px", borderRadius: 100,
                  boxShadow: "0 4px 12px rgba(245,158,11,0.4)", whiteSpace: "nowrap",
                  display: "flex", alignItems: "center", gap: 4,
                }}>
                  <Star size={11} fill="white" />
                  {isRtl ? "הכי פופולרי" : "Most popular"}
                </div>
              )}

              {/* Token count */}
              <div style={{ marginBottom: 8 }}>
                <span style={{ fontSize: 48, fontWeight: 900, color: pkg.popular ? "#fff" : "#111827", lineHeight: 1 }}>
                  {pkg.tokens}
                </span>
                <span style={{ fontSize: 18, fontWeight: 600, color: pkg.popular ? "rgba(255,255,255,0.75)" : "#6b7280", marginInlineStart: 6 }}>
                  {isRtl ? "אסימונים" : "tokens"}
                </span>
              </div>

              {/* Price */}
              <div style={{ marginBottom: 6 }}>
                <span style={{ fontSize: 36, fontWeight: 900, color: pkg.popular ? "#fff" : "#111827" }}>
                  {symbol}{price}
                </span>
              </div>

              {/* Per token */}
              <p style={{ fontSize: 13, color: pkg.popular ? "rgba(255,255,255,0.65)" : "#9ca3af", marginBottom: 28 }}>
                {symbol}{perToken} {isRtl ? "לאסימון" : "per token"}
              </p>

              {/* CTA button */}
              <button
                onClick={() => navigate(`/buy?package=${pkg.id}&currency=${currency}`)}
                style={{
                  width: "100%", padding: "14px 0", borderRadius: 12, fontWeight: 700, fontSize: 15, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "all 0.15s",
                  background: pkg.popular ? "#fff" : "linear-gradient(135deg, #6366f1, #8b5cf6)",
                  color: pkg.popular ? "#6366f1" : "#fff",
                  border: "none",
                  boxShadow: pkg.popular ? "0 4px 16px rgba(255,255,255,0.25)" : "0 4px 16px rgba(99,102,241,0.35)",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.9"; (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; (e.currentTarget as HTMLButtonElement).style.transform = "none"; }}
              >
                <ShoppingCart size={16} />
                {isRtl ? "רכוש עכשיו" : "Buy now"}
              </button>

              {/* Divider */}
              <div style={{ height: 1, background: pkg.popular ? "rgba(255,255,255,0.15)" : "#f3f4f6", margin: "24px 0" }} />

              {/* Features */}
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                {features.map((f, i) => (
                  <li key={i} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: pkg.popular ? "rgba(255,255,255,0.9)" : "#374151" }}>
                    <div style={{
                      width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
                      background: pkg.popular ? "rgba(255,255,255,0.2)" : "#eef2ff",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <Check size={11} color={pkg.popular ? "#fff" : "#6366f1"} strokeWidth={3} />
                    </div>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </section>

      {/* ── Welcome bonus banner ── */}
      <section style={{ maxWidth: 860, margin: "0 auto 60px", padding: "0 20px" }}>
        <div style={{
          background: "linear-gradient(135deg, #fef3c7, #fde68a)",
          border: "1px solid #fcd34d",
          borderRadius: 16,
          padding: "24px 32px",
          display: "flex",
          alignItems: "center",
          gap: 20,
          flexWrap: "wrap",
        }}>
          <div style={{ fontSize: 36 }}>🎁</div>
          <div style={{ flex: 1 }}>
            <p style={{ fontWeight: 700, fontSize: 16, color: "#92400e", margin: "0 0 4px" }}>
              {isRtl ? "הירשם וקבל 10 אסימונים חינם" : "Sign up and get 10 free tokens"}
            </p>
            <p style={{ fontSize: 13, color: "#a16207", margin: 0 }}>
              {isRtl
                ? "משתמשים חדשים מקבלים 10 אסימונים מיד + 20 נוספים בלינק שנשלח למייל"
                : "New users get 10 tokens immediately + 20 more via email link"}
            </p>
          </div>
          <button
            onClick={() => navigate("/")}
            style={{
              background: "#f59e0b", color: "#fff", border: "none", borderRadius: 10,
              padding: "10px 22px", fontWeight: 700, fontSize: 14, cursor: "pointer",
              boxShadow: "0 4px 12px rgba(245,158,11,0.4)", whiteSpace: "nowrap",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "#d97706"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "#f59e0b"; }}
          >
            {isRtl ? "התחל בחינם" : "Start free"}
          </button>
        </div>
      </section>

      {/* ── What can you do with tokens ── */}
      <section style={{ maxWidth: 860, margin: "0 auto 60px", padding: "0 20px" }}>
        <h2 style={{ textAlign: "center", fontSize: 28, fontWeight: 800, color: "#111827", marginBottom: 32 }}>
          {isRtl ? "מה אפשר לעשות עם אסימון אחד?" : "What can you do with one token?"}
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
          {[
            { icon: "🖼️", he: "המרת תמונה ל-DXF", en: "Image to DXF" },
            { icon: "✨", he: "יצירת עיצוב AI", en: "AI design generation" },
            { icon: "🔍", he: "AI Trace — עקיבה", en: "AI Trace" },
            { icon: "👤", he: "פורטרט — זיהוי פנים", en: "Portrait detection" },
          ].map((item, i) => (
            <div key={i} style={{
              background: "#fff", borderRadius: 14, padding: "20px 16px", textAlign: "center",
              border: "1px solid #e5e7eb", boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
            }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>{item.icon}</div>
              <p style={{ fontSize: 14, fontWeight: 600, color: "#374151", margin: 0 }}>
                {isRtl ? item.he : item.en}
              </p>
              <p style={{ fontSize: 12, color: "#9ca3af", margin: "4px 0 0", fontWeight: 600 }}>
                {isRtl ? "= אסימון אחד" : "= 1 token"}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FAQ ── */}
      <section style={{ maxWidth: 700, margin: "0 auto 80px", padding: "0 20px" }}>
        <h2 style={{ textAlign: "center", fontSize: 28, fontWeight: 800, color: "#111827", marginBottom: 32 }}>
          {isRtl ? "שאלות נפוצות" : "Frequently asked questions"}
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {faq.map((item, i) => (
            <div
              key={i}
              style={{
                background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb",
                overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
              }}
            >
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                style={{
                  width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "16px 20px", background: "none", border: "none", cursor: "pointer",
                  textAlign: isRtl ? "right" : "left",
                }}
              >
                <span style={{ fontWeight: 700, fontSize: 15, color: "#111827" }}>{item.q}</span>
                <span style={{ fontSize: 20, color: "#6366f1", fontWeight: 300, transform: openFaq === i ? "rotate(45deg)" : "none", transition: "transform 0.2s" }}>+</span>
              </button>
              {openFaq === i && (
                <div style={{ padding: "0 20px 16px", fontSize: 14, color: "#6b7280", lineHeight: 1.6 }}>
                  {item.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── Footer CTA ── */}
      <section style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)", padding: "60px 20px", textAlign: "center" }}>
        <Zap size={36} color="rgba(255,255,255,0.7)" style={{ marginBottom: 16 }} />
        <h2 style={{ fontSize: 32, fontWeight: 900, color: "#fff", margin: "0 0 12px" }}>
          {isRtl ? "מוכן להתחיל?" : "Ready to start?"}
        </h2>
        <p style={{ fontSize: 16, color: "rgba(255,255,255,0.75)", marginBottom: 32, maxWidth: 400, margin: "0 auto 32px" }}>
          {isRtl ? "הירשם חינם וקבל 10 אסימונים — ללא כרטיס אשראי" : "Sign up free and get 10 tokens — no credit card required"}
        </p>
        <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
          <button
            onClick={() => navigate("/")}
            style={{
              background: "#fff", color: "#6366f1", border: "none", borderRadius: 12,
              padding: "14px 32px", fontWeight: 800, fontSize: 16, cursor: "pointer",
              boxShadow: "0 8px 24px rgba(0,0,0,0.2)", display: "flex", alignItems: "center", gap: 8,
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-2px)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = "none"; }}
          >
            <Gift size={18} />
            {isRtl ? "התחל חינם" : "Start free"}
          </button>
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            style={{
              background: "rgba(255,255,255,0.15)", color: "#fff", border: "1px solid rgba(255,255,255,0.3)",
              borderRadius: 12, padding: "14px 32px", fontWeight: 700, fontSize: 16, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 8,
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.25)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.15)"; }}
          >
            <ShoppingCart size={18} />
            {isRtl ? "רכוש אסימונים" : "Buy tokens"}
          </button>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ background: "#111827", padding: "24px 20px", textAlign: "center" }}>
        <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>
          © 2026 DXF.AI ·{" "}
          <a href="/terms" style={{ color: "#9ca3af", textDecoration: "none" }}>{isRtl ? "תנאי שימוש" : "Terms"}</a>
          {" · "}
          <a href="/privacy" style={{ color: "#9ca3af", textDecoration: "none" }}>{isRtl ? "פרטיות" : "Privacy"}</a>
          {" · "}
          <a href="mailto:support@dxfai.net" style={{ color: "#9ca3af", textDecoration: "none" }}>support@dxfai.net</a>
        </p>
      </footer>
    </div>
  );
}

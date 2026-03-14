import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import {
  Check, X, Sparkles, Zap, Star, ArrowLeft, ArrowRight,
  ShoppingCart, Gift, Users, TrendingUp, Shield, Clock,
  ChevronDown, ChevronUp, Layers
} from "lucide-react";

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

// ─── Testimonials ─────────────────────────────────────────────────────────────
const TESTIMONIALS_HE = [
  {
    name: "אבי כהן",
    role: "בעל מכונת לייזר",
    avatar: "א",
    color: "#6366f1",
    text: "חסך לי שעות של עבודה. מעלה תמונה ותוך שניות יש לי קובץ DXF מוכן לחיתוך. שווה כל שקל.",
    stars: 5,
  },
  {
    name: "מיכל לוי",
    role: "מעצבת תכשיטים",
    avatar: "מ",
    color: "#8b5cf6",
    text: "השתמשתי בכלים אחרים אבל האיכות כאן הרבה יותר טובה. הקווים נקיים והקובץ עובד ישר ב-Lightburn.",
    stars: 5,
  },
  {
    name: "דני שמיר",
    role: "מפעיל CNC",
    avatar: "ד",
    color: "#06b6d4",
    text: "פיצ'ר ה-AI Trace מדהים — מעלה תמונה של לוגו ומקבל קובץ וקטורי מדויק. ממליץ בחום.",
    stars: 5,
  },
  {
    name: "רחל גולן",
    role: "אמנית עץ",
    avatar: "ר",
    color: "#10b981",
    text: "הפורטרט עובד מעולה לחריטה. שלחתי תמונה של הנכד ויצא פורטרט מדהים לחריטה על עץ.",
    stars: 5,
  },
];

const TESTIMONIALS_EN = [
  {
    name: "Avi Cohen",
    role: "Laser machine owner",
    avatar: "A",
    color: "#6366f1",
    text: "Saved me hours of work. Upload an image and within seconds I have a DXF file ready for cutting. Worth every penny.",
    stars: 5,
  },
  {
    name: "Michal Levi",
    role: "Jewelry designer",
    avatar: "M",
    color: "#8b5cf6",
    text: "I've used other tools but the quality here is much better. Lines are clean and the file works directly in Lightburn.",
    stars: 5,
  },
  {
    name: "Danny Shamir",
    role: "CNC operator",
    avatar: "D",
    color: "#06b6d4",
    text: "The AI Trace feature is amazing — upload a logo image and get a precise vector file. Highly recommended.",
    stars: 5,
  },
  {
    name: "Rachel Golan",
    role: "Wood artist",
    avatar: "R",
    color: "#10b981",
    text: "Portrait works great for engraving. Sent a photo of my grandchild and got an amazing portrait for wood engraving.",
    stars: 5,
  },
];

// ─── Comparison table data ────────────────────────────────────────────────────
const COMPARISON_HE = [
  { feature: "המרת תמונה ל-DXF", free: "3 ביום", paid: "ללא הגבלה" },
  { feature: "יצירת עיצוב AI", free: "3 ביום", paid: "ללא הגבלה" },
  { feature: "AI Trace", free: "3 ביום", paid: "ללא הגבלה" },
  { feature: "פורטרט AI", free: "3 ביום", paid: "ללא הגבלה" },
  { feature: "היסטוריית עיצובים", free: true, paid: true },
  { feature: "הורדת DXF + SVG", free: true, paid: true },
  { feature: "תמיכה בעברית", free: true, paid: true },
  { feature: "אסימונים לא פגים", free: false, paid: true },
  { feature: "עדיפות בתמיכה", free: false, paid: true },
];

const COMPARISON_EN = [
  { feature: "Image to DXF", free: "3/day", paid: "Unlimited" },
  { feature: "AI design generation", free: "3/day", paid: "Unlimited" },
  { feature: "AI Trace", free: "3/day", paid: "Unlimited" },
  { feature: "Portrait AI", free: "3/day", paid: "Unlimited" },
  { feature: "Design history", free: true, paid: true },
  { feature: "DXF + SVG download", free: true, paid: true },
  { feature: "Hebrew & English UI", free: true, paid: true },
  { feature: "Tokens never expire", free: false, paid: true },
  { feature: "Priority support", free: false, paid: true },
];

// ─── FAQ ──────────────────────────────────────────────────────────────────────
const FAQ_HE = [
  { q: "מה זה אסימון?", a: "כל פעולה (המרת תמונה, יצירת AI, עקיבה, פורטרט) עולה אסימון אחד. אסימונים לא פגים ונשארים בחשבון שלך לתמיד." },
  { q: "האם האסימונים פגים?", a: "לא. אסימונים שרכשת נשארים בחשבונך ללא הגבלת זמן — גם אחרי שנה." },
  { q: "האם יש החזר כספי?", a: "כל הרכישות סופיות. אם הייתה שגיאה מצדנו — האסימון יוחזר אוטומטית תוך 24 שעות." },
  { q: "איזה פורמטים נתמכים?", a: "ניתן להעלות JPG, PNG, WEBP. הפלט הוא קובץ DXF תואם לכל תוכנת CAD, CNC ולייזר (Lightburn, AutoCAD, Fusion 360 ועוד)." },
  { q: "האם אני שומר על זכויות הקובץ?", a: "כן. כל קבצי ה-DXF שנוצרו מתמונותיך הם שלך לחלוטין — לשימוש אישי ומסחרי." },
  { q: "מה ההבדל בין AI Create ל-AI Trace?", a: "AI Create מייצר עיצוב חדש לפי תיאור טקסטואלי. AI Trace עוקב אחרי תמונה קיימת שמעלים ומייצר ממנה קובץ וקטורי." },
];

const FAQ_EN = [
  { q: "What is a token?", a: "Each action (image conversion, AI generation, tracing, portrait) costs one token. Tokens never expire." },
  { q: "Do tokens expire?", a: "No. Purchased tokens remain in your account indefinitely — even after a year." },
  { q: "Is there a refund policy?", a: "All purchases are final. If a job fails due to a server error on our side, the token is automatically refunded within 24 hours." },
  { q: "What file formats are supported?", a: "Upload JPG, PNG, or WEBP. Output is a DXF file compatible with all CAD, CNC, and laser software (Lightburn, AutoCAD, Fusion 360, etc.)." },
  { q: "Do I own the output files?", a: "Yes. All DXF files generated from your images are fully yours — for personal and commercial use." },
  { q: "What's the difference between AI Create and AI Trace?", a: "AI Create generates a new design from a text description. AI Trace traces an existing image you upload and produces a vector file from it." },
];

// ─── Stat counter animation ───────────────────────────────────────────────────
function AnimatedNumber({ target, suffix = "" }: { target: number; suffix?: string }) {
  const [current, setCurrent] = useState(0);
  useEffect(() => {
    const duration = 1500;
    const steps = 40;
    const increment = target / steps;
    let step = 0;
    const timer = setInterval(() => {
      step++;
      setCurrent(Math.min(Math.round(increment * step), target));
      if (step >= steps) clearInterval(timer);
    }, duration / steps);
    return () => clearInterval(timer);
  }, [target]);
  return <>{current.toLocaleString()}{suffix}</>;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Pricing() {
  const { isRtl } = useLanguage();
  const [, navigate] = useLocation();
  const [currency, setCurrency] = useState(() => detectCurrency());
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [statsVisible, setStatsVisible] = useState(false);

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

  const testimonials = isRtl ? TESTIMONIALS_HE : TESTIMONIALS_EN;
  const comparison = isRtl ? COMPARISON_HE : COMPARISON_EN;
  const faq = isRtl ? FAQ_HE : FAQ_EN;
  const symbol = CURRENCY_SYMBOLS[currency] ?? "$";
  const currencies = ["ILS", "USD", "EUR", "GBP", "CAD", "AUD"];

  // Trigger stats animation on scroll
  useEffect(() => {
    const timer = setTimeout(() => setStatsVisible(true), 300);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      dir={isRtl ? "rtl" : "ltr"}
      style={{ minHeight: "100vh", background: "#fafafa", fontFamily: "'Inter', 'Segoe UI', sans-serif", overflowX: "hidden" }}
    >
      {/* ── Header ── */}
      <header style={{ background: "#fff", borderBottom: "1px solid #e8eaf0", boxShadow: "0 1px 8px rgba(0,0,0,0.06)", position: "sticky", top: 0, zIndex: 20 }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "12px 20px", display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={() => navigate("/")}
            style={{ display: "flex", alignItems: "center", gap: 6, color: "#6366f1", fontWeight: 600, fontSize: 14, background: "none", border: "none", cursor: "pointer", padding: "6px 10px", borderRadius: 8, transition: "background 0.15s" }}
            onMouseEnter={e => (e.currentTarget.style.background = "#eef2ff")}
            onMouseLeave={e => (e.currentTarget.style.background = "none")}
          >
            {isRtl ? <ArrowRight size={16} /> : <ArrowLeft size={16} />}
            {isRtl ? "חזרה לאתר" : "Back to site"}
          </button>
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
      <section style={{
        background: "linear-gradient(160deg, #1e1b4b 0%, #312e81 40%, #4c1d95 100%)",
        padding: "72px 20px 80px",
        textAlign: "center",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* Background decoration */}
        <div style={{ position: "absolute", top: -60, left: "10%", width: 300, height: 300, borderRadius: "50%", background: "rgba(99,102,241,0.15)", filter: "blur(60px)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: -40, right: "10%", width: 250, height: 250, borderRadius: "50%", background: "rgba(139,92,246,0.15)", filter: "blur(50px)", pointerEvents: "none" }} />

        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 100, padding: "6px 16px", marginBottom: 24 }}>
            <Sparkles size={14} color="#a5b4fc" />
            <span style={{ fontSize: 13, fontWeight: 600, color: "#c7d2fe" }}>
              {isRtl ? "ללא מנוי חודשי — שלם רק על מה שאתה משתמש" : "No monthly subscription — pay only for what you use"}
            </span>
          </div>

          <h1 style={{ fontSize: "clamp(32px, 5vw, 56px)", fontWeight: 900, color: "#fff", margin: "0 0 16px", lineHeight: 1.1, letterSpacing: "-0.02em" }}>
            {isRtl ? "בחר את החבילה שלך" : "Choose your package"}
          </h1>
          <p style={{ fontSize: "clamp(16px, 2vw, 20px)", color: "rgba(199,210,254,0.85)", maxWidth: 560, margin: "0 auto 40px", lineHeight: 1.6 }}>
            {isRtl
              ? "המר תמונות ל-DXF, צור עיצובים עם AI, ועקוב אחרי קווים — הכל עם אסימון אחד לפעולה"
              : "Convert images to DXF, generate AI designs, and trace outlines — all for one token per action"}
          </p>

          {/* Currency selector */}
          <div style={{ display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap" }}>
            {currencies.map((c) => (
              <button
                key={c}
                onClick={() => setCurrency(c)}
                style={{
                  padding: "7px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "all 0.15s",
                  background: currency === c ? "#fff" : "rgba(255,255,255,0.08)",
                  color: currency === c ? "#6366f1" : "rgba(255,255,255,0.7)",
                  border: currency === c ? "1px solid #fff" : "1px solid rgba(255,255,255,0.15)",
                }}
              >
                {CURRENCY_SYMBOLS[c]} {c}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── Packages ── */}
      <section style={{ maxWidth: 900, margin: "-40px auto 0", padding: "0 20px 60px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24, position: "relative", zIndex: 2 }}>
        {packages.map((pkg) => {
          const price = pkg.prices[currency] ?? pkg.prices["USD"] ?? "—";
          const perToken = price !== "—" ? (parseFloat(price) / pkg.tokens).toFixed(2) : "—";

          return (
            <div
              key={pkg.id}
              style={{
                background: pkg.popular ? "linear-gradient(160deg, #6366f1 0%, #8b5cf6 100%)" : "#fff",
                borderRadius: 24,
                padding: "36px 32px",
                boxShadow: pkg.popular
                  ? "0 24px 64px rgba(99,102,241,0.4), 0 0 0 1px rgba(99,102,241,0.2)"
                  : "0 8px 32px rgba(0,0,0,0.08), 0 0 0 1px #e5e7eb",
                position: "relative",
                transform: pkg.popular ? "scale(1.02)" : "none",
              }}
            >
              {pkg.popular && (
                <div style={{
                  position: "absolute", top: -16, left: "50%", transform: "translateX(-50%)",
                  background: "linear-gradient(135deg, #f59e0b, #f97316)", color: "#fff",
                  fontSize: 12, fontWeight: 800, padding: "6px 20px", borderRadius: 100,
                  boxShadow: "0 4px 16px rgba(245,158,11,0.5)", whiteSpace: "nowrap",
                  display: "flex", alignItems: "center", gap: 5, letterSpacing: "0.02em",
                }}>
                  <Star size={11} fill="white" />
                  {isRtl ? "הכי פופולרי" : "Most popular"}
                </div>
              )}

              <div style={{ marginBottom: 4 }}>
                <span style={{ fontSize: 56, fontWeight: 900, color: pkg.popular ? "#fff" : "#111827", lineHeight: 1 }}>
                  {pkg.tokens}
                </span>
                <span style={{ fontSize: 18, fontWeight: 600, color: pkg.popular ? "rgba(255,255,255,0.65)" : "#9ca3af", marginInlineStart: 8 }}>
                  {isRtl ? "אסימונים" : "tokens"}
                </span>
              </div>

              <div style={{ marginBottom: 4 }}>
                <span style={{ fontSize: 40, fontWeight: 900, color: pkg.popular ? "#fff" : "#111827" }}>
                  {symbol}{price}
                </span>
              </div>

              <p style={{ fontSize: 13, color: pkg.popular ? "rgba(255,255,255,0.55)" : "#9ca3af", marginBottom: 28 }}>
                {symbol}{perToken} {isRtl ? "לאסימון" : "per token"}
              </p>

              <button
                onClick={() => navigate(`/buy?package=${pkg.id}&currency=${currency}`)}
                style={{
                  width: "100%", padding: "15px 0", borderRadius: 14, fontWeight: 800, fontSize: 16, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "all 0.2s",
                  background: pkg.popular ? "#fff" : "linear-gradient(135deg, #6366f1, #8b5cf6)",
                  color: pkg.popular ? "#6366f1" : "#fff",
                  border: "none",
                  boxShadow: pkg.popular ? "0 4px 20px rgba(255,255,255,0.3)" : "0 4px 20px rgba(99,102,241,0.4)",
                  letterSpacing: "-0.01em",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLButtonElement).style.boxShadow = pkg.popular ? "0 8px 28px rgba(255,255,255,0.4)" : "0 8px 28px rgba(99,102,241,0.5)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = "none"; (e.currentTarget as HTMLButtonElement).style.boxShadow = pkg.popular ? "0 4px 20px rgba(255,255,255,0.3)" : "0 4px 20px rgba(99,102,241,0.4)"; }}
              >
                <ShoppingCart size={17} />
                {isRtl ? "רכוש עכשיו" : "Buy now"}
              </button>

              <div style={{ height: 1, background: pkg.popular ? "rgba(255,255,255,0.15)" : "#f3f4f6", margin: "24px 0" }} />

              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 11 }}>
                {(isRtl
                  ? ["המרת תמונה ל-DXF", "יצירת עיצוב AI", "AI Trace — עקיבה חכמה", "פורטרט — זיהוי פנים", "היסטוריית עיצובים", "DXF + SVG", "אסימונים לא פגים", "תמיכה בעברית"]
                  : ["Image to DXF conversion", "AI design generation", "AI Trace — smart tracing", "Portrait — face detection", "Design history", "DXF + SVG download", "Tokens never expire", "Hebrew & English support"]
                ).map((f, i) => (
                  <li key={i} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: pkg.popular ? "rgba(255,255,255,0.9)" : "#374151" }}>
                    <div style={{
                      width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                      background: pkg.popular ? "rgba(255,255,255,0.18)" : "#eef2ff",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <Check size={12} color={pkg.popular ? "#fff" : "#6366f1"} strokeWidth={3} />
                    </div>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </section>

      {/* ── Social proof stats ── */}
      <section style={{ background: "linear-gradient(135deg, #f0f9ff, #eef2ff)", padding: "60px 20px", borderTop: "1px solid #e0e7ff", borderBottom: "1px solid #e0e7ff" }}>
        <div style={{ maxWidth: 860, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 32, textAlign: "center" }}>
          {[
            { icon: <Users size={28} color="#6366f1" />, value: 1200, suffix: "+", labelHe: "משתמשים רשומים", labelEn: "Registered users" },
            { icon: <TrendingUp size={28} color="#8b5cf6" />, value: 15000, suffix: "+", labelHe: "קבצי DXF נוצרו", labelEn: "DXF files created" },
            { icon: <Shield size={28} color="#06b6d4" />, value: 99, suffix: "%", labelHe: "שביעות רצון", labelEn: "Satisfaction rate" },
            { icon: <Clock size={28} color="#10b981" />, value: 5, suffix: "s", labelHe: "זמן המרה ממוצע", labelEn: "Avg. conversion time" },
          ].map((stat, i) => (
            <div key={i}>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>{stat.icon}</div>
              <div style={{ fontSize: 40, fontWeight: 900, color: "#111827", lineHeight: 1, marginBottom: 6 }}>
                {statsVisible ? <AnimatedNumber target={stat.value} suffix={stat.suffix} /> : `0${stat.suffix}`}
              </div>
              <p style={{ fontSize: 14, color: "#6b7280", margin: 0, fontWeight: 500 }}>
                {isRtl ? stat.labelHe : stat.labelEn}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── What can you do with one token ── */}
      <section style={{ maxWidth: 900, margin: "0 auto", padding: "72px 20px 60px" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <h2 style={{ fontSize: "clamp(24px, 4vw, 36px)", fontWeight: 900, color: "#111827", margin: "0 0 12px", letterSpacing: "-0.02em" }}>
            {isRtl ? "מה אפשר לעשות עם אסימון אחד?" : "What can you do with one token?"}
          </h2>
          <p style={{ fontSize: 16, color: "#6b7280", margin: 0 }}>
            {isRtl ? "כל הפיצ'רים — אותו מחיר" : "All features — same price"}
          </p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 20 }}>
          {[
            { icon: "🖼️", he: "המרת תמונה ל-DXF", en: "Image to DXF", desc_he: "JPG/PNG → קובץ וקטורי", desc_en: "JPG/PNG → vector file", color: "#eef2ff", border: "#c7d2fe" },
            { icon: "✨", he: "יצירת עיצוב AI", en: "AI Design", desc_he: "תיאור טקסטואלי → עיצוב", desc_en: "Text description → design", color: "#f5f3ff", border: "#ddd6fe" },
            { icon: "🔍", he: "AI Trace", en: "AI Trace", desc_he: "תמונה → קווים נקיים", desc_en: "Image → clean lines", color: "#ecfeff", border: "#a5f3fc" },
            { icon: "👤", he: "פורטרט AI", en: "Portrait AI", desc_he: "פנים → חריטה", desc_en: "Face → engraving", color: "#f0fdf4", border: "#bbf7d0" },
          ].map((item, i) => (
            <div key={i} style={{
              background: item.color, borderRadius: 16, padding: "24px 20px", textAlign: "center",
              border: `1px solid ${item.border}`, transition: "transform 0.2s, box-shadow 0.2s",
            }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = "translateY(-4px)"; (e.currentTarget as HTMLDivElement).style.boxShadow = "0 12px 32px rgba(0,0,0,0.1)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = "none"; (e.currentTarget as HTMLDivElement).style.boxShadow = "none"; }}
            >
              <div style={{ fontSize: 36, marginBottom: 12 }}>{item.icon}</div>
              <p style={{ fontSize: 15, fontWeight: 700, color: "#111827", margin: "0 0 4px" }}>
                {isRtl ? item.he : item.en}
              </p>
              <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 10px" }}>
                {isRtl ? item.desc_he : item.desc_en}
              </p>
              <div style={{ display: "inline-block", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: "3px 12px", fontSize: 12, fontWeight: 700, color: "#6366f1" }}>
                = 1 {isRtl ? "אסימון" : "token"}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Welcome bonus ── */}
      <section style={{ maxWidth: 860, margin: "0 auto 60px", padding: "0 20px" }}>
        <div style={{
          background: "linear-gradient(135deg, #fffbeb, #fef3c7)",
          border: "1px solid #fcd34d",
          borderRadius: 20,
          padding: "28px 36px",
          display: "flex",
          alignItems: "center",
          gap: 24,
          flexWrap: "wrap",
          boxShadow: "0 4px 20px rgba(245,158,11,0.15)",
        }}>
          <div style={{ fontSize: 44 }}>🎁</div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <p style={{ fontWeight: 800, fontSize: 18, color: "#92400e", margin: "0 0 6px" }}>
              {isRtl ? "הירשם וקבל 10 אסימונים חינם" : "Sign up and get 10 free tokens"}
            </p>
            <p style={{ fontSize: 14, color: "#a16207", margin: 0, lineHeight: 1.5 }}>
              {isRtl
                ? "משתמשים חדשים מקבלים 10 אסימונים מיד + 20 נוספים בלינק שנשלח למייל — סה\"כ 30 אסימונים בחינם"
                : "New users get 10 tokens immediately + 20 more via email link — 30 free tokens total"}
            </p>
          </div>
          <button
            onClick={() => navigate("/")}
            style={{
              background: "linear-gradient(135deg, #f59e0b, #f97316)", color: "#fff", border: "none", borderRadius: 12,
              padding: "12px 28px", fontWeight: 800, fontSize: 15, cursor: "pointer",
              boxShadow: "0 4px 16px rgba(245,158,11,0.4)", whiteSpace: "nowrap", transition: "all 0.2s",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-2px)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = "none"; }}
          >
            {isRtl ? "התחל חינם →" : "Start free →"}
          </button>
        </div>
      </section>

      {/* ── Comparison table ── */}
      <section style={{ maxWidth: 860, margin: "0 auto 72px", padding: "0 20px" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <h2 style={{ fontSize: "clamp(24px, 4vw, 36px)", fontWeight: 900, color: "#111827", margin: "0 0 12px", letterSpacing: "-0.02em" }}>
            {isRtl ? "מה ההבדל?" : "What's the difference?"}
          </h2>
          <p style={{ fontSize: 16, color: "#6b7280", margin: 0 }}>
            {isRtl ? "חינמי מול חבילת אסימונים" : "Free vs. token package"}
          </p>
        </div>
        <div style={{ background: "#fff", borderRadius: 20, overflow: "hidden", boxShadow: "0 4px 24px rgba(0,0,0,0.08)", border: "1px solid #e5e7eb" }}>
          {/* Table header */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", padding: "16px 24px" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.7)" }}>{isRtl ? "תכונה" : "Feature"}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.7)", textAlign: "center" }}>{isRtl ? "חינמי" : "Free"}</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: "#fff", textAlign: "center" }}>{isRtl ? "עם אסימונים" : "With tokens"}</div>
          </div>
          {/* Table rows */}
          {comparison.map((row, i) => (
            <div
              key={i}
              style={{
                display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
                padding: "14px 24px",
                background: i % 2 === 0 ? "#fff" : "#fafafa",
                borderBottom: i < comparison.length - 1 ? "1px solid #f3f4f6" : "none",
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 500, color: "#374151" }}>{row.feature}</div>
              <div style={{ textAlign: "center" }}>
                {typeof row.free === "boolean" ? (
                  row.free
                    ? <Check size={18} color="#10b981" strokeWidth={3} style={{ display: "inline" }} />
                    : <X size={18} color="#d1d5db" strokeWidth={3} style={{ display: "inline" }} />
                ) : (
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#6b7280" }}>{row.free}</span>
                )}
              </div>
              <div style={{ textAlign: "center" }}>
                {typeof row.paid === "boolean" ? (
                  row.paid
                    ? <Check size={18} color="#6366f1" strokeWidth={3} style={{ display: "inline" }} />
                    : <X size={18} color="#d1d5db" strokeWidth={3} style={{ display: "inline" }} />
                ) : (
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#6366f1" }}>{row.paid}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section style={{ background: "linear-gradient(160deg, #f5f3ff, #ede9fe)", padding: "72px 20px", borderTop: "1px solid #ddd6fe" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <h2 style={{ fontSize: "clamp(24px, 4vw, 36px)", fontWeight: 900, color: "#111827", margin: "0 0 12px", letterSpacing: "-0.02em" }}>
              {isRtl ? "מה אומרים המשתמשים?" : "What users say"}
            </h2>
            <div style={{ display: "flex", justifyContent: "center", gap: 4 }}>
              {[1,2,3,4,5].map(s => <Star key={s} size={20} fill="#f59e0b" color="#f59e0b" />)}
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 20 }}>
            {testimonials.map((t, i) => (
              <div key={i} style={{
                background: "#fff", borderRadius: 18, padding: "24px", boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
                border: "1px solid #ede9fe", transition: "transform 0.2s, box-shadow 0.2s",
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = "translateY(-4px)"; (e.currentTarget as HTMLDivElement).style.boxShadow = "0 12px 32px rgba(99,102,241,0.15)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = "none"; (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 20px rgba(0,0,0,0.06)"; }}
              >
                {/* Stars */}
                <div style={{ display: "flex", gap: 3, marginBottom: 14 }}>
                  {[1,2,3,4,5].map(s => <Star key={s} size={14} fill="#f59e0b" color="#f59e0b" />)}
                </div>
                {/* Quote */}
                <p style={{ fontSize: 14, color: "#374151", lineHeight: 1.65, margin: "0 0 18px", fontStyle: "italic" }}>
                  "{t.text}"
                </p>
                {/* Author */}
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: "50%", background: t.color,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 15, fontWeight: 800, color: "#fff", flexShrink: 0,
                  }}>
                    {t.avatar}
                  </div>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 700, color: "#111827", margin: 0 }}>{t.name}</p>
                    <p style={{ fontSize: 12, color: "#9ca3af", margin: 0 }}>{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section style={{ maxWidth: 700, margin: "0 auto", padding: "72px 20px 60px" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <h2 style={{ fontSize: "clamp(24px, 4vw, 36px)", fontWeight: 900, color: "#111827", margin: "0 0 12px", letterSpacing: "-0.02em" }}>
            {isRtl ? "שאלות נפוצות" : "Frequently asked questions"}
          </h2>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {faq.map((item, i) => (
            <div
              key={i}
              style={{
                background: "#fff", borderRadius: 14, border: openFaq === i ? "1px solid #c7d2fe" : "1px solid #e5e7eb",
                overflow: "hidden", boxShadow: openFaq === i ? "0 4px 20px rgba(99,102,241,0.1)" : "0 2px 8px rgba(0,0,0,0.04)",
                transition: "all 0.2s",
              }}
            >
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                style={{
                  width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "18px 22px", background: "none", border: "none", cursor: "pointer",
                  textAlign: isRtl ? "right" : "left",
                }}
              >
                <span style={{ fontWeight: 700, fontSize: 15, color: "#111827" }}>{item.q}</span>
                {openFaq === i
                  ? <ChevronUp size={18} color="#6366f1" />
                  : <ChevronDown size={18} color="#9ca3af" />
                }
              </button>
              {openFaq === i && (
                <div style={{ padding: "0 22px 18px", fontSize: 14, color: "#6b7280", lineHeight: 1.7 }}>
                  {item.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── Footer CTA ── */}
      <section style={{ background: "linear-gradient(135deg, #1e1b4b, #312e81)", padding: "72px 20px", textAlign: "center" }}>
        <div style={{ maxWidth: 600, margin: "0 auto" }}>
          <div style={{ fontSize: 48, marginBottom: 20 }}>🚀</div>
          <h2 style={{ fontSize: "clamp(26px, 4vw, 40px)", fontWeight: 900, color: "#fff", margin: "0 0 14px", letterSpacing: "-0.02em" }}>
            {isRtl ? "מוכן להתחיל?" : "Ready to start?"}
          </h2>
          <p style={{ fontSize: 17, color: "rgba(199,210,254,0.8)", marginBottom: 36, lineHeight: 1.6 }}>
            {isRtl ? "הירשם חינם וקבל 10 אסימונים — ללא כרטיס אשראי" : "Sign up free and get 10 tokens — no credit card required"}
          </p>
          <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
            <button
              onClick={() => navigate("/")}
              style={{
                background: "#fff", color: "#6366f1", border: "none", borderRadius: 14,
                padding: "16px 36px", fontWeight: 800, fontSize: 16, cursor: "pointer",
                boxShadow: "0 8px 28px rgba(0,0,0,0.25)", display: "flex", alignItems: "center", gap: 8, transition: "all 0.2s",
                letterSpacing: "-0.01em",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-3px)"; (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 14px 36px rgba(0,0,0,0.3)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = "none"; (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 8px 28px rgba(0,0,0,0.25)"; }}
            >
              <Gift size={18} />
              {isRtl ? "התחל חינם" : "Start free"}
            </button>
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              style={{
                background: "rgba(255,255,255,0.1)", color: "#fff", border: "1px solid rgba(255,255,255,0.25)",
                borderRadius: 14, padding: "16px 36px", fontWeight: 700, fontSize: 16, cursor: "pointer",
                display: "flex", alignItems: "center", gap: 8, transition: "all 0.2s",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.2)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.1)"; }}
            >
              <Layers size={18} />
              {isRtl ? "ראה חבילות" : "View packages"}
            </button>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ background: "#0f172a", padding: "28px 20px", textAlign: "center" }}>
        <p style={{ fontSize: 13, color: "#4b5563", margin: 0 }}>
          © 2026 DXF.AI ·{" "}
          <a href="/terms" style={{ color: "#6b7280", textDecoration: "none" }}>{isRtl ? "תנאי שימוש" : "Terms"}</a>
          {" · "}
          <a href="/privacy" style={{ color: "#6b7280", textDecoration: "none" }}>{isRtl ? "פרטיות" : "Privacy"}</a>
          {" · "}
          <a href="/purchase-terms" style={{ color: "#6b7280", textDecoration: "none" }}>{isRtl ? "תנאי רכישה" : "Purchase terms"}</a>
          {" · "}
          <a href="mailto:support@dxfai.net" style={{ color: "#6b7280", textDecoration: "none" }}>support@dxfai.net</a>
        </p>
      </footer>
    </div>
  );
}

import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import {
  Check, X, Sparkles, Zap, Star, ArrowLeft, ArrowRight,
  ShoppingCart, Gift, Users, TrendingUp, Shield, Clock,
  ChevronDown, ChevronUp, Layers, Coins, ImageIcon, Scan, User, Wand2, FileCode2
} from "lucide-react";

// ─── Currency helpers ────────────────────────────────────────────────────────
const CURRENCY_SYMBOLS: Record<string, string> = { ILS: "₪", USD: "$", EUR: "€", GBP: "£" };

const FALLBACK_PACKAGES = [
  {
    id: "tokens_3",
    tokens: 30,
    popular: false,
    badge: "trial",
    prices: { ILS: "29", USD: "7.99" } as Record<string, string>,
  },
  {
    id: "tokens_1",
    tokens: 100,
    popular: true,
    badge: "recommended",
    prices: { ILS: "59", USD: "15.99" } as Record<string, string>,
  },
  {
    id: "tokens_300",
    tokens: 300,
    popular: false,
    badge: "sale",
    prices: { ILS: "129", USD: "33.99" } as Record<string, string>,
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
  { feature: "תמיכה במגוון שפות", free: true, paid: true },
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
  { feature: "Multi-language support", free: true, paid: true },
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
  const { isRtl, language } = useLanguage();
  const [, navigate] = useLocation();
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [statsVisible, setStatsVisible] = useState(false);

  const { data: dbPrices } = trpc.packages.prices.useQuery();
  const { data: tokenCosts } = trpc.tokenCosts.list.useQuery();

  // Currency: ILS for Hebrew, USD for everything else
  const currency = language === "he" ? "ILS" : "USD";
  const symbol = CURRENCY_SYMBOLS[currency] ?? "$";

  const packages = dbPrices && dbPrices.length > 0
    ? dbPrices.map((p) => ({
        id: p.packageId,
        tokens: p.tokenAmount,
        popular: p.packageId === "tokens_1",
        label: p.label,
        badge: p.badge ?? null,
        discountPercent: p.discountPercent ?? 0,
        prices: { ILS: p.priceILS, USD: p.priceUSD } as Record<string, string>,
      }))
    : FALLBACK_PACKAGES;

  const testimonials = isRtl ? TESTIMONIALS_HE : TESTIMONIALS_EN;
  const comparison = isRtl ? COMPARISON_HE : COMPARISON_EN;
  const faq = isRtl ? FAQ_HE : FAQ_EN;

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
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginInlineStart: "auto" }}>
            <LanguageSwitcher />
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
              {isRtl ? "שלם לפי שימוש או בחר מנוי עסקי" : "Pay per use or choose a business subscription"}
            </span>
          </div>

          <h1 style={{ fontSize: "clamp(32px, 5vw, 56px)", fontWeight: 900, color: "#fff", margin: "0 0 16px", lineHeight: 1.1, letterSpacing: "-0.02em" }}>
            {isRtl ? "בחר את החבילה שלך" : "Choose your package"}
          </h1>


          {/* Currency badge */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 100, padding: "6px 16px" }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{currency === "ILS" ? "₪ מחירים בשקל ישראלי" : "$ Prices in USD"}</span>
          </div>
        </div>
      </section>

      {/* ── Packages ── */}
      <section style={{ maxWidth: 900, margin: "-40px auto 0", padding: "0 20px 60px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24, position: "relative", zIndex: 2 }}>
        {packages.map((pkg) => {
          const price = pkg.prices[currency] ?? pkg.prices["ILS"] ?? "—";
          const perToken = price !== "—" ? (parseFloat(price) / pkg.tokens).toFixed(2) : "—";
          const discount = (pkg as { discountPercent?: number }).discountPercent ?? 0;
          const badge = (pkg as { badge?: string | null }).badge ?? null;
          const discountedPrice = discount > 0 && price !== "—" ? (parseFloat(price) * (1 - discount / 100)).toFixed(2) : null;
          const badgeCfg: Record<string, { text: string; bg: string; shadow: string }> = {
            recommended: { text: isRtl ? "★ מומלץ" : "★ Recommended", bg: "linear-gradient(135deg, #3b82f6, #2563eb)", shadow: "0 4px 16px rgba(59,130,246,0.5)" },
            best_value: { text: isRtl ? "💰 הכי משתלם" : "💰 Best value", bg: "linear-gradient(135deg, #10b981, #059669)", shadow: "0 4px 16px rgba(16,185,129,0.5)" },
            sale: { text: isRtl ? "🔥 במבצע" : "🔥 Sale", bg: "linear-gradient(135deg, #ef4444, #ec4899)", shadow: "0 4px 16px rgba(239,68,68,0.5)" },
            trial: { text: isRtl ? "🌟 התנסות" : "🌟 Trial", bg: "linear-gradient(135deg, #8b5cf6, #7c3aed)", shadow: "0 4px 16px rgba(139,92,246,0.5)" },
          };

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
              {/* Badge from admin (centered top) */}
              {badge && badgeCfg[badge] && (
                <div style={{
                  position: "absolute", top: -16, left: "50%", transform: "translateX(-50%)",
                  background: badgeCfg[badge].bg, color: "#fff",
                  fontSize: 12, fontWeight: 800, padding: "6px 20px", borderRadius: 100,
                  boxShadow: badgeCfg[badge].shadow, whiteSpace: "nowrap",
                  display: "flex", alignItems: "center", gap: 5, letterSpacing: "0.02em",
                }}>
                  {badgeCfg[badge].text}
                </div>
              )}
              {/* Fallback popular badge when no badge set */}
              {!badge && pkg.popular && (
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
              {/* Discount pill (right side) */}
              {discount > 0 && (
                <div style={{
                  position: "absolute", top: -16, right: 16,
                  background: "linear-gradient(135deg, #ef4444, #ec4899)", color: "#fff",
                  fontSize: 11, fontWeight: 800, padding: "5px 12px", borderRadius: 100,
                  boxShadow: "0 4px 12px rgba(239,68,68,0.5)", whiteSpace: "nowrap",
                }}>
                  -{discount}% {isRtl ? "הנחה!" : "OFF!"}
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
                {discountedPrice ? (
                  <>
                    <span style={{ fontSize: 24, fontWeight: 700, color: pkg.popular ? "rgba(255,255,255,0.5)" : "#9ca3af", textDecoration: "line-through", marginInlineEnd: 8 }}>
                      {symbol}{price}
                    </span>
                    <span style={{ fontSize: 40, fontWeight: 900, color: pkg.popular ? "#fff" : "#111827" }}>
                      {symbol}{discountedPrice}
                    </span>
                  </>
                ) : (
                  <span style={{ fontSize: 40, fontWeight: 900, color: pkg.popular ? "#fff" : "#111827" }}>
                    {symbol}{price}
                  </span>
                )}
              </div>

              <div style={{ marginBottom: 28 }} />

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
                  ? ["המרת תמונה ל-DXF", "יצירת עיצוב AI", "AI Trace — עקיבה חכמה", "פורטרט — זיהוי פנים", "היסטוריית עיצובים", "DXF + SVG", "אסימונים לא פגים", "חשבונית מס", "תמיכה במגוון שפות"]
                  : ["Image to DXF conversion", "AI design generation", "AI Trace — smart tracing", "Portrait — face detection", "Design history", "DXF + SVG download", "Tokens never expire", "Tax invoice", "Multi-language support"]
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
                ? "משתמשים חדשים מקבלים 10 אסימונים מיד לאחר הרשמה"
                : "New users get 10 tokens immediately after registration"}
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

      {/* ── Token Cost Table ── */}
      <section style={{ maxWidth: 860, margin: "0 auto 72px", padding: "0 20px" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <h2 style={{ fontSize: "clamp(24px, 4vw, 36px)", fontWeight: 900, color: "#111827", margin: "0 0 12px", letterSpacing: "-0.02em" }}>
            {isRtl ? "כמה עולה כל פעולה?" : "How many tokens per action?"}
          </h2>
          <p style={{ fontSize: 16, color: "#6b7280", margin: 0 }}>
            {isRtl ? "מחיר האסימונים מנוהל ועשוי להשתנות" : "Token costs are admin-managed and may change"}
          </p>
        </div>
        <div style={{ background: "#fff", borderRadius: 20, overflow: "hidden", boxShadow: "0 4px 24px rgba(0,0,0,0.08)", border: "1px solid #e5e7eb" }}>
          {/* Table header */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", background: "linear-gradient(135deg, #0f766e, #0d9488)", padding: "16px 24px" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.8)" }}>{isRtl ? "פעולה" : "Action"}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", textAlign: "center", minWidth: 100 }}>{isRtl ? "עלות" : "Cost"}</div>
          </div>
          {/* Table rows */}
          {tokenCosts && tokenCosts.length > 0 ? (
            [...tokenCosts].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)).map((item, i) => {
              const label = isRtl ? (item.labelHe || item.label || item.action) : (item.labelEn || item.label || item.action);
              const description = isRtl ? item.descriptionHe : item.descriptionEn;
              const iconMap: Record<string, React.ReactNode> = {
                convert: <FileCode2 size={18} color="#0d9488" />,
                ai_generate: <Zap size={18} color="#8b5cf6" />,
                ai_trace: <Scan size={18} color="#3b82f6" />,
                face_detect: <User size={18} color="#ec4899" />,
                ai_refine: <Wand2 size={18} color="#f59e0b" />,
              };
              const icon = iconMap[item.action] ?? <Coins size={18} color="#6b7280" />;
              return (
                <div
                  key={item.action}
                  style={{
                    display: "grid", gridTemplateColumns: "1fr auto",
                    padding: "16px 24px",
                    background: i % 2 === 0 ? "#fff" : "#f9fafb",
                    borderBottom: i < tokenCosts.length - 1 ? "1px solid #f3f4f6" : "none",
                    alignItems: "center",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {icon}
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>{label}</div>
                      {description && <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>{description}</div>}
                    </div>
                  </div>
                  <div style={{ textAlign: "center", minWidth: 100 }}>
                    {item.cost === 0 ? (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#d1fae5", color: "#065f46", borderRadius: 100, padding: "4px 12px", fontSize: 13, fontWeight: 700, border: "1px solid #a7f3d0" }}>
                        {isRtl ? "חינם" : "Free"}
                      </span>
                    ) : (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "#fef3c7", color: "#92400e", borderRadius: 100, padding: "4px 14px", fontSize: 14, fontWeight: 800, border: "1px solid #fde68a" }}>
                        <Coins size={14} />
                        {item.cost}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            // Fallback static table if DB not loaded
            [
              { action: "convert", labelHe: "המרת תמונה ל-DXF", labelEn: "Image to DXF", cost: 5, icon: <FileCode2 size={18} color="#0d9488" /> },
              { action: "ai_generate", labelHe: "יצירת עיצוב AI", labelEn: "AI Design Create", cost: 5, icon: <Zap size={18} color="#8b5cf6" /> },
              { action: "ai_trace", labelHe: "AI Trace — ציור מחדש", labelEn: "AI Trace — Redraw", cost: 5, icon: <Scan size={18} color="#3b82f6" /> },
              { action: "face_detect", labelHe: "פורטרט AI", labelEn: "AI Portrait", cost: 4, icon: <User size={18} color="#ec4899" /> },
              { action: "ai_refine", labelHe: "שיפור AI", labelEn: "AI Refine", cost: 2, icon: <Wand2 size={18} color="#f59e0b" /> },
            ].map((item, i) => (
              <div
                key={item.action}
                style={{
                  display: "grid", gridTemplateColumns: "1fr auto",
                  padding: "16px 24px",
                  background: i % 2 === 0 ? "#fff" : "#f9fafb",
                  borderBottom: i < 4 ? "1px solid #f3f4f6" : "none",
                  alignItems: "center",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {item.icon}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>{isRtl ? item.labelHe : item.labelEn}</div>
                </div>
                <div style={{ textAlign: "center", minWidth: 100 }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "#fef3c7", color: "#92400e", borderRadius: 100, padding: "4px 14px", fontSize: 14, fontWeight: 800, border: "1px solid #fde68a" }}>
                    <Coins size={14} />
                    {item.cost}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </section>



      {/* ── Business Plan Teaser ── */}
      <section style={{ maxWidth: 860, margin: "0 auto 60px", padding: "0 20px" }}>
        <div style={{
          background: "linear-gradient(135deg, #0f172a, #1e1b4b)",
          borderRadius: 24,
          padding: "40px 40px",
          display: "flex",
          alignItems: "center",
          gap: 28,
          flexWrap: "wrap",
          boxShadow: "0 8px 40px rgba(99,102,241,0.25)",
          border: "1px solid rgba(99,102,241,0.3)",
          position: "relative",
          overflow: "hidden",
        }}>
          {/* Glow */}
          <div style={{ position: "absolute", top: -40, right: -40, width: 200, height: 200, borderRadius: "50%", background: "rgba(99,102,241,0.15)", filter: "blur(50px)", pointerEvents: "none" }} />
          <div style={{ fontSize: 52, position: "relative", zIndex: 1 }}>🏢</div>
          <div style={{ flex: 1, minWidth: 220, position: "relative", zIndex: 1 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(99,102,241,0.2)", border: "1px solid rgba(99,102,241,0.4)", borderRadius: 100, padding: "3px 12px", marginBottom: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#a5b4fc", letterSpacing: "0.05em" }}>{isRtl ? "בקרוב" : "Coming Soon"}</span>
            </div>
            <p style={{ fontWeight: 900, fontSize: 22, color: "#fff", margin: "0 0 8px", letterSpacing: "-0.02em" }}>
              {isRtl ? "מנוי עסקי" : "Business Subscription"}
            </p>
            <p style={{ fontSize: 14, color: "rgba(199,210,254,0.75)", margin: "0 0 16px", lineHeight: 1.6 }}>
              {isRtl
                ? "מנוי חודשי לעסקים עם אסימונים ללא הגבלה, ניהול צוות, ו-API גישה. מתאים לסטודיות, מפעלים ומעצבים מקצועיים."
                : "Monthly subscription for businesses with unlimited tokens, team management, and API access."}
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {[
                isRtl ? "אסימונים ללא הגבלה" : "Unlimited tokens",
                isRtl ? "ניהול צוות" : "Team management",
                isRtl ? "גישת API" : "API access",
                isRtl ? "חשבונית מס" : "Tax invoice",
              ].map((f, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(255,255,255,0.06)", borderRadius: 8, padding: "5px 12px" }}>
                  <Check size={12} color="#6366f1" strokeWidth={3} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.8)" }}>{f}</span>
                </div>
              ))}
            </div>
          </div>
          <button
            onClick={() => { window.location.href = "mailto:support@dxfai.ai?subject=מנוי עסקי"; }}
            style={{
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", border: "none", borderRadius: 14,
              padding: "14px 28px", fontWeight: 800, fontSize: 15, cursor: "pointer",
              boxShadow: "0 4px 20px rgba(99,102,241,0.5)", whiteSpace: "nowrap", transition: "all 0.2s",
              position: "relative", zIndex: 1,
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-2px)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = "none"; }}
          >
            {isRtl ? "השאר פרטים →" : "Get notified →"}
          </button>
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
      <footer style={{ background: "#0f172a", padding: "36px 20px", textAlign: "center" }}>
        <p style={{ fontSize: 12, color: "#6b7280", margin: "0 auto 16px", maxWidth: 680, lineHeight: 1.7 }}>
          {isRtl
            ? "החברה שומרת לעצמה את הזכות לסגור את השירות בכל עת. במקרה שיסגר השירות, ייעשה מאמץ סביר להחזיר אסימונים שלא נוצלו או לתת זיכוי כספי יחסי על האסימונים הנותרים."
            : "The company reserves the right to close the service at any time. In such a case, a reasonable effort will be made to refund unused tokens or provide a proportional monetary credit for remaining tokens."}
        </p>
        <p style={{ fontSize: 13, color: "#4b5563", margin: 0 }}>
          © 2026 DXF.AI ·{" "}
          <a href="/terms" style={{ color: "#6b7280", textDecoration: "none" }}>{isRtl ? "תנאי שימוש" : "Terms"}</a>
          {" · "}
          <a href="/privacy" style={{ color: "#6b7280", textDecoration: "none" }}>{isRtl ? "פרטיות" : "Privacy"}</a>
          {" · "}
          <a href="/purchase-terms" style={{ color: "#6b7280", textDecoration: "none" }}>{isRtl ? "תנאי רכישה" : "Purchase terms"}</a>
          {" · "}
          <a href="mailto:support@dxfai.ai" style={{ color: "#6b7280", textDecoration: "none" }}>support@dxfai.ai</a>
        </p>
      </footer>
    </div>
  );
}

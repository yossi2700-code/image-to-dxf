import { useState } from "react";
import { useLocation } from "wouter";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import {
  Zap, Shield, Clock, Download, Star,
  ChevronLeft, ChevronRight, Check, Sparkles, Cpu, FileDown,
  Lock, MessageCircle, Mail, Phone
} from "lucide-react";

// ─── CDN base ────────────────────────────────────────────────────────────────
const CDN = "https://d2xsxph8kpxj0f.cloudfront.net/310519663365044246/hnDFdLkzVGYJYdws9hbnLw";

// ─── Image data ───────────────────────────────────────────────────────────────
const BEFORE_AFTER = [
  {
    label_he: "מצלמה",
    label_en: "Camera",
    desc_he: "מצלמת SLR קלאסית — פרטים עדינים, עדשה, כפתורים",
    desc_en: "Classic SLR camera — fine details, lens, buttons",
    before: `${CDN}/before-camera_e8ff1c90.jpg`,
    after: `${CDN}/after-camera_de9f1f99.png`,
  },
  {
    label_he: "אופניים",
    label_en: "Bicycle",
    desc_he: "אופניים — שלדה, גלגלים, שרשרת",
    desc_en: "Bicycle — frame, wheels, chain",
    before: `${CDN}/before-bicycle_dbe6f82f.jpg`,
    after: `${CDN}/after-bicycle_10ff03f6.png`,
  },
  {
    label_he: "אריה",
    label_en: "Lion",
    desc_he: "ראש אריה — רעמה, פנים, ביטוי",
    desc_en: "Lion head — mane, face, expression",
    before: `${CDN}/before-lion_06430793.jpg`,
    after: `${CDN}/after-lion_51a7de96.png`,
  },
  {
    label_he: "מפתח ברגים",
    label_en: "Wrench",
    desc_he: "מפתח ברגים — כלי עבודה מתכתי",
    desc_en: "Wrench — metal workshop tool",
    before: `${CDN}/before-wrench_c1f95777.jpg`,
    after: `${CDN}/after-wrench_07e4cc11.png`,
  },
  {
    label_he: "מקדחה",
    label_en: "Drill",
    desc_he: "מקדחה חשמלית — גוף, ידית, מקדח",
    desc_en: "Power drill — body, handle, bit",
    before: `${CDN}/before-drill_64d49d0c.jpg`,
    after: `${CDN}/after-drill_fe1af063.png`,
  },
  {
    label_he: "חתול",
    label_en: "Cat",
    desc_he: "חתול יושב — פרווה, עיניים, זנב",
    desc_en: "Sitting cat — fur, eyes, tail",
    before: `${CDN}/before-cat_dcacb10f.jpg`,
    after: `${CDN}/after-cat_b2225f8d.png`,
  },
  {
    label_he: "אופנוע",
    label_en: "Motorcycle",
    desc_he: "אופנוע קלאסי — מנוע, גלגלים, מסגרת",
    desc_en: "Classic motorcycle — engine, wheels, frame",
    before: `${CDN}/before-motorcycle_45e267a0.jpg`,
    after: `${CDN}/after-motorcycle_75dff73c.png`,
  },
  {
    label_he: "טוקן",
    label_en: "Toucan",
    desc_he: "ציפור טוקי — מקור גדול, נוצות, ענף",
    desc_en: "Toucan bird — large beak, feathers, branch",
    before: `${CDN}/before-toucan_5f8de07e.jpg`,
    after: `${CDN}/after-toucan_c73d6aac.png`,
  },
];

const AI_EXAMPLES = [
  {
    label_he: "זאב גיאומטרי",
    label_en: "Geometric Wolf",
    prompt_he: "זאב גיאומטרי מודרני",
    prompt_en: "Modern geometric wolf",
    img: `${CDN}/ai-geometric-wolf_98d1980b.png`,
  },
  {
    label_he: "מנדלה",
    label_en: "Mandala",
    prompt_he: "מנדלה גיאומטרית סימטרית",
    prompt_en: "Geometric symmetric mandala",
    img: `${CDN}/ai-mandala-v2_614c147f.png`,
  },
  {
    label_he: "מזלג",
    label_en: "Fork",
    prompt_he: "מזלג עם ידית מעוטרת",
    prompt_en: "Fork with ornate handle",
    img: `${CDN}/ai-fork_c40aff55.png`,
  },
  {
    label_he: "גיטרה",
    label_en: "Guitar",
    prompt_he: "גיטרה אקוסטית קלאסית",
    prompt_en: "Classic acoustic guitar",
    img: `${CDN}/ai-guitar_c2583706.png`,
  },
  {
    label_he: "פרפר",
    label_en: "Butterfly",
    prompt_he: "פרפר עם כנפיים מפורטות",
    prompt_en: "Butterfly with detailed wings",
    img: `${CDN}/ai-butterfly_4f4f3fba.png`,
  },
  {
    label_he: "בית",
    label_en: "House",
    prompt_he: "בית קוטג' עם גינה",
    prompt_en: "Cottage house with garden",
    img: `${CDN}/ai-house_261c8791.png`,
  },
  {
    label_he: "אופניים",
    label_en: "Bicycle",
    prompt_he: "אופניים קלאסיים",
    prompt_en: "Classic bicycle",
    img: `${CDN}/ai-bicycle-clean_8a1a189e.png`,
  },
  {
    label_he: "סקייטבורד",
    label_en: "Skateboard",
    prompt_he: "סקייטבורד מקצועי",
    prompt_en: "Professional skateboard",
    img: `${CDN}/ai-skateboard_664b0f3a.png`,
  },
  {
    label_he: "נעל",
    label_en: "Sneaker",
    prompt_he: "נעל סניקרס קלאסית",
    prompt_en: "Classic sneaker shoe",
    img: `${CDN}/ai-sneaker_18d964e4.png`,
  },
  {
    label_he: "אוזניות",
    label_en: "Headphones",
    prompt_he: "אוזניות over-ear",
    prompt_en: "Over-ear headphones",
    img: `${CDN}/ai-headphones-v2_186a9ebd.png`,
  },
  {
    label_he: "מצלמה",
    label_en: "Camera",
    prompt_he: "מצלמת SLR וינטאג'",
    prompt_en: "Vintage SLR camera",
    img: `${CDN}/ai-camera-art_5db350a3.png`,
  },
  {
    label_he: "מכונית",
    label_en: "Car",
    prompt_he: "מכונית ספורט קלאסית",
    prompt_en: "Classic sports car",
    img: `${CDN}/ai-car_c6c9e6ef.png`,
  },
  {
    label_he: "כלב",
    label_en: "Dog",
    prompt_he: "כלב יושב",
    prompt_en: "Sitting dog",
    img: `${CDN}/ai-dog_a52e996b.png`,
  },
  {
    label_he: "עוגן",
    label_en: "Anchor",
    prompt_he: "עוגן ימי קלאסי",
    prompt_en: "Classic nautical anchor",
    img: `${CDN}/ai-anchor_5b6ebb85.png`,
  },
  {
    label_he: "רקטה",
    label_en: "Rocket",
    prompt_he: "רקטה חלל מודרנית",
    prompt_en: "Modern space rocket",
    img: `${CDN}/ai-rocket_d39317d5.png`,
  },
  {
    label_he: "מספריים מקצועיות",
    label_en: "Professional Scissors",
    prompt_he: "מספריים מקצועיות",
    prompt_en: "Professional scissors",
    img: `${CDN}/ai-create-scissors-QopeAzD8GtJKXM92QkvmRD.webp`,
  },
];


// ─── Portrait Examples ───────────────────────────────────────────────────────
const PORTRAIT_EXAMPLES = [
  {
    label_he: "אישה",
    label_en: "Woman",
    desc_he: "פורטרט אישה — קווי פנים עדינים, שיער",
    desc_en: "Woman portrait — delicate facial lines, hair",
    img: `${CDN}/demo-portrait-woman_e956deb2.png`,
  },
  {
    label_he: "גבר",
    label_en: "Man",
    desc_he: "פורטרט גבר — זקן, ביטוי, מבנה פנים",
    desc_en: "Man portrait — beard, expression, face structure",
    img: `${CDN}/demo-portrait-man_1c4399d3.png`,
  },
  {
    label_he: "ילד",
    label_en: "Child",
    desc_he: "פורטרט ילד — קווים נקיים, ביטוי תמים",
    desc_en: "Child portrait — clean lines, innocent expression",
    img: `${CDN}/demo-portrait-child_d468e82c.png`,
  },
  {
    label_he: "קשיש",
    label_en: "Elder",
    desc_he: "פורטרט קשיש עם משקפיים — קמטים, אופי",
    desc_en: "Elder with glasses — wrinkles, character, depth",
    img: `${CDN}/demo-portrait-elder-man-iYXPcDc7tcx49xVqpBFbyP.webp`,
  },
];

// ─── Portrait Card ────────────────────────────────────────────────────────────
function PortraitCard({ item, isRtl }: { item: typeof PORTRAIT_EXAMPLES[0]; isRtl: boolean }) {
  return (
    <div style={{
      borderRadius: 16, overflow: "hidden", background: "#fff",
      boxShadow: "0 4px 20px rgba(124,58,237,0.12)", border: "1px solid #ede9fe",
      transition: "transform 0.2s, box-shadow 0.2s",
    }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = "translateY(-4px)"; (e.currentTarget as HTMLDivElement).style.boxShadow = "0 10px 32px rgba(124,58,237,0.22)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = "none"; (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 20px rgba(124,58,237,0.12)"; }}
    >
      <div style={{ position: "relative", width: "100%", paddingBottom: "100%", background: "#f8f6ff" }}>
        <img
          src={item.img}
          alt={isRtl ? item.label_he : item.label_en}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
        />
        {/* DXF badge */}
        <div style={{
          position: "absolute", top: 10, right: 10,
          background: "linear-gradient(135deg,#7c3aed,#a855f7)",
          color: "#fff", borderRadius: 8, padding: "3px 10px", fontSize: 11, fontWeight: 800,
          boxShadow: "0 2px 8px rgba(124,58,237,0.4)",
        }}>DXF</div>
        {/* Portrait badge */}
        <div style={{
          position: "absolute", bottom: 10, left: "50%", transform: "translateX(-50%)",
          background: "rgba(124,58,237,0.88)",
          color: "#fff", borderRadius: 20, padding: "4px 14px", fontSize: 12, fontWeight: 700,
          backdropFilter: "blur(4px)", whiteSpace: "nowrap",
        }}>
          {isRtl ? "✦ פורטרט AI" : "✦ AI Portrait"}
        </div>
      </div>
      <div style={{ padding: "12px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: "#1e1b4b" }}>{isRtl ? item.label_he : item.label_en}</span>
          <span style={{ fontSize: 11, color: "#7c3aed", fontWeight: 600, background: "#f5f3ff", borderRadius: 6, padding: "2px 7px" }}>Portrait</span>
        </div>
        <div style={{ fontSize: 11, color: "#6b7280", lineHeight: 1.4 }}>
          {isRtl ? item.desc_he : item.desc_en}
        </div>
      </div>
    </div>
  );
}

// ─── Before/After Card ────────────────────────────────────────────────────────
function BeforeAfterCard({ item, isRtl }: { item: typeof BEFORE_AFTER[0]; isRtl: boolean }) {
  const [showAfter, setShowAfter] = useState(false);
  return (
    <div
      style={{
        borderRadius: 16, overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.10)",
        cursor: "pointer", position: "relative", background: "#fff",
        transition: "transform 0.2s, box-shadow 0.2s",
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = "translateY(-4px)"; (e.currentTarget as HTMLDivElement).style.boxShadow = "0 8px 32px rgba(99,102,241,0.18)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = "none"; (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 20px rgba(0,0,0,0.10)"; }}
      onClick={() => setShowAfter(v => !v)}
    >
      <div style={{ position: "relative", width: "100%", paddingBottom: "100%", background: "#f8f8f8" }}>
        <img
          src={showAfter ? item.after : item.before}
          alt={isRtl ? item.label_he : item.label_en}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", transition: "opacity 0.3s" }}
        />
        <div style={{
          position: "absolute", bottom: 10, left: "50%", transform: "translateX(-50%)",
          background: showAfter
            ? "linear-gradient(135deg,rgba(99,102,241,0.95),rgba(139,92,246,0.95))"
            : "linear-gradient(135deg,rgba(16,185,129,0.92),rgba(5,150,105,0.92))",
          color: "#fff", borderRadius: 20, padding: "6px 16px", fontSize: 12, fontWeight: 700,
          backdropFilter: "blur(4px)", whiteSpace: "nowrap",
          boxShadow: showAfter ? "0 3px 12px rgba(99,102,241,0.5)" : "0 3px 12px rgba(16,185,129,0.5)",
          letterSpacing: "0.01em",
        }}>
          {showAfter ? (isRtl ? "← לחץ לחזור למקור" : "← Back to original") : (isRtl ? "👁 הצג DXF" : "👁 Show DXF")}
        </div>
      </div>
      <div style={{ padding: "10px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: "#1e1b4b" }}>{isRtl ? item.label_he : item.label_en}</span>
          <span style={{ fontSize: 11, color: showAfter ? "#6366f1" : "#9ca3af", fontWeight: 600 }}>
            {showAfter ? "DXF" : (isRtl ? "מקור" : "Original")}
          </span>
        </div>
        {'desc_he' in item && (
          <div style={{ fontSize: 11, color: "#6b7280", lineHeight: 1.4 }}>
            {isRtl ? (item as any).desc_he : (item as any).desc_en}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── AI Example Card ──────────────────────────────────────────────────────────
function AiExampleCard({ item, isRtl }: { item: typeof AI_EXAMPLES[0]; isRtl: boolean }) {
  return (
    <div style={{
      borderRadius: 14, overflow: "hidden", background: "#fff",
      boxShadow: "0 2px 16px rgba(99,102,241,0.10)", border: "1px solid #ede9fe",
      transition: "transform 0.2s, box-shadow 0.2s",
    }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = "translateY(-3px)"; (e.currentTarget as HTMLDivElement).style.boxShadow = "0 8px 28px rgba(99,102,241,0.22)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = "none"; (e.currentTarget as HTMLDivElement).style.boxShadow = "0 2px 16px rgba(99,102,241,0.10)"; }}
    >
      <div style={{ position: "relative", width: "100%", paddingBottom: "100%", background: "#f8f6ff" }}>
        <img
          src={item.img}
          alt={isRtl ? item.label_he : item.label_en}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
        />
        <div style={{
          position: "absolute", top: 8, right: 8,
          background: "rgba(99,102,241,0.85)", color: "#fff",
          borderRadius: 8, padding: "2px 8px", fontSize: 11, fontWeight: 700,
        }}>
          DXF
        </div>
      </div>
      <div style={{ padding: "10px 12px", borderTop: "1px solid #f0eeff" }}>
        <div style={{ fontSize: 11, color: "#7c3aed", fontWeight: 600, marginBottom: 3 }}>
          {isRtl ? "נכתב:" : "Prompt:"}
        </div>
        <div style={{ fontSize: 12, color: "#374151", fontStyle: "italic", lineHeight: 1.4 }}>
          "{isRtl ? item.prompt_he : item.prompt_en}"
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Landing() {
  const { isRtl, language, setLanguage } = useLanguage();
  const [, navigate] = useLocation();

  const { data: contactInfo } = trpc.contact.info.useQuery();

  const whatsappNumber = contactInfo?.whatsappNumber || "";
  const supportEmail = contactInfo?.supportEmail || "info@dxfai.net";

  const whatsappUrl = whatsappNumber
    ? `https://wa.me/${whatsappNumber.replace(/\D/g, "")}?text=${encodeURIComponent(isRtl ? "שלום, אני מעוניין בשירות AiDXF" : "Hello, I'm interested in AiDXF")}`
    : "";

  const dir = isRtl ? "rtl" : "ltr";
  const t = isRtl ? he : en;

  return (
    <div dir={dir} style={{ minHeight: "100vh", background: "#fff", fontFamily: "'Inter','Segoe UI',sans-serif", overflowX: "hidden" }}>

      {/* ── Sticky nav ── */}
      <header style={{ position: "sticky", top: 0, zIndex: 30, background: "rgba(255,255,255,0.95)", backdropFilter: "blur(8px)", borderBottom: "1px solid #e8eaf0", boxShadow: "0 1px 6px rgba(0,0,0,0.06)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }} onClick={() => navigate("/")}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="17" height="17" viewBox="0 0 20 20" fill="none">
                <path d="M4 16 Q7 7 10 10 Q13 13 16 4" stroke="white" strokeWidth="2.2" strokeLinecap="round" fill="none" />
                <circle cx="4" cy="16" r="1.8" fill="#06b6d4" />
                <circle cx="10" cy="10" r="1.8" fill="white" />
                <circle cx="16" cy="4" r="1.8" fill="#06b6d4" />
              </svg>
            </div>
            <span style={{ fontWeight: 900, fontSize: 18, color: "#6366f1", letterSpacing: "-0.02em" }}>Ai</span>
            <span style={{ fontWeight: 900, fontSize: 18, color: "#111827", letterSpacing: "-0.02em" }}>DXF</span>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {/* Language toggle He / En */}
            <div style={{ display: "flex", alignItems: "center", background: "#f3f4f6", borderRadius: 10, padding: 3, gap: 2 }}>
              <button
                onClick={() => setLanguage("he")}
                style={{
                  padding: "5px 12px", borderRadius: 8, border: "none", fontWeight: 700, fontSize: 13, cursor: "pointer",
                  background: language === "he" ? "linear-gradient(135deg,#6366f1,#8b5cf6)" : "transparent",
                  color: language === "he" ? "#fff" : "#6b7280",
                  transition: "all 0.18s",
                  boxShadow: language === "he" ? "0 2px 8px rgba(99,102,241,0.3)" : "none",
                }}
              >
                עב
              </button>
              <button
                onClick={() => setLanguage("en")}
                style={{
                  padding: "5px 12px", borderRadius: 8, border: "none", fontWeight: 700, fontSize: 13, cursor: "pointer",
                  background: language === "en" ? "linear-gradient(135deg,#6366f1,#8b5cf6)" : "transparent",
                  color: language === "en" ? "#fff" : "#6b7280",
                  transition: "all 0.18s",
                  boxShadow: language === "en" ? "0 2px 8px rgba(99,102,241,0.3)" : "none",
                }}
              >
                EN
              </button>
            </div>
            {whatsappUrl && (
              <a href={whatsappUrl} target="_blank" rel="noopener noreferrer"
                style={{ display: "flex", alignItems: "center", gap: 6, background: "#25d366", color: "#fff", border: "none", borderRadius: 10, padding: "8px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer", textDecoration: "none" }}>
                <MessageCircle size={15} />
                {isRtl ? "WhatsApp" : "WhatsApp"}
              </a>
            )}
            <button
              onClick={() => navigate("/")}
              style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff", border: "none", borderRadius: 10, padding: "9px 22px", fontWeight: 700, fontSize: 14, cursor: "pointer", boxShadow: "0 2px 10px rgba(99,102,241,0.3)" }}
            >
              {t.navCta}
            </button>
          </div>
        </div>
      </header>

      {/* ── HERO ── */}
      <section style={{
        background: "linear-gradient(160deg,#1e1b4b 0%,#312e81 45%,#4c1d95 100%)",
        padding: "80px 24px 90px", textAlign: "center", position: "relative", overflow: "hidden",
      }}>
        <div style={{ position: "absolute", top: -80, left: "5%", width: 400, height: 400, borderRadius: "50%", background: "rgba(99,102,241,0.12)", filter: "blur(70px)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: -60, right: "5%", width: 350, height: 350, borderRadius: "50%", background: "rgba(139,92,246,0.12)", filter: "blur(60px)", pointerEvents: "none" }} />
        <div style={{ position: "relative", maxWidth: 760, margin: "0 auto" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(99,102,241,0.25)", border: "1px solid rgba(99,102,241,0.4)", borderRadius: 20, padding: "5px 14px", marginBottom: 24 }}>
            <Sparkles size={13} color="#a5b4fc" />
            <span style={{ color: "#a5b4fc", fontSize: 13, fontWeight: 600 }}>{t.heroBadge}</span>
          </div>
          <h1 style={{ color: "#fff", fontSize: "clamp(2rem,5vw,3.2rem)", fontWeight: 900, lineHeight: 1.15, marginBottom: 20, letterSpacing: "-0.03em" }}>
            {t.heroTitle}
          </h1>
          <p style={{ color: "#c4b5fd", fontSize: "clamp(1rem,2.5vw,1.2rem)", lineHeight: 1.7, marginBottom: 36, maxWidth: 580, margin: "0 auto 36px" }}>
            {t.heroSubtitle}
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button
              onClick={() => navigate("/")}
              style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff", border: "none", borderRadius: 12, padding: "14px 32px", fontWeight: 800, fontSize: 16, cursor: "pointer", boxShadow: "0 4px 20px rgba(99,102,241,0.4)", transition: "transform 0.15s" }}
              onMouseEnter={e => (e.currentTarget.style.transform = "scale(1.04)")}
              onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")}
            >
              {t.heroCta1}
            </button>

          </div>
          <p style={{ color: "#7c6fcd", fontSize: 13, marginTop: 20 }}>{t.heroTrust}</p>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section style={{ padding: "72px 24px", background: "#fafafa" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", textAlign: "center" }}>
          <h2 style={{ fontSize: "clamp(1.5rem,3vw,2.2rem)", fontWeight: 800, color: "#1e1b4b", marginBottom: 12 }}>{t.howTitle}</h2>
          <p style={{ color: "#6b7280", fontSize: 16, marginBottom: 52 }}>{t.howSubtitle}</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 32 }}>
            {t.steps.map((step, i) => (
              <div key={i} style={{ textAlign: "center" }}>
                <div style={{ width: 64, height: 64, borderRadius: 18, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", boxShadow: "0 4px 16px rgba(99,102,241,0.25)" }}>
                  {[<Cpu size={28} color="white" />, <Zap size={28} color="white" />, <FileDown size={28} color="white" />][i]}
                </div>
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#e0e7ff", color: "#6366f1", fontWeight: 800, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", margin: "-8px auto 12px" }}>{i + 1}</div>
                <h3 style={{ fontWeight: 700, fontSize: 16, color: "#1e1b4b", marginBottom: 8 }}>{step.title}</h3>
                <p style={{ color: "#6b7280", fontSize: 14, lineHeight: 1.6 }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── BEFORE / AFTER GALLERY ── */}
      <section style={{ padding: "72px 24px", background: "#fff" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <h2 style={{ fontSize: "clamp(1.5rem,3vw,2.2rem)", fontWeight: 800, color: "#1e1b4b", marginBottom: 12 }}>{t.galleryTitle}</h2>
            <p style={{ color: "#6b7280", fontSize: 16 }}>{t.gallerySubtitle}</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 20 }}>
            {BEFORE_AFTER.map((item, i) => (
              <BeforeAfterCard key={i} item={item} isRtl={isRtl} />
            ))}
          </div>
          <p style={{ textAlign: "center", color: "#9ca3af", fontSize: 13, marginTop: 16 }}>{t.galleryHint}</p>
        </div>
      </section>

      {/* ── PORTRAIT EXAMPLES ── */}
      <section style={{ padding: "72px 24px", background: "linear-gradient(160deg,#faf5ff 0%,#f3e8ff 100%)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(124,58,237,0.12)", border: "1px solid rgba(124,58,237,0.25)", borderRadius: 20, padding: "5px 14px", marginBottom: 16 }}>
              <span style={{ fontSize: 14 }}>🎨</span>
              <span style={{ color: "#7c3aed", fontSize: 13, fontWeight: 600 }}>{isRtl ? "AI Portrait — פורטרט מתמונה" : "AI Portrait — from photo"}</span>
            </div>
            <h2 style={{ fontSize: "clamp(1.5rem,3vw,2.2rem)", fontWeight: 800, color: "#1e1b4b", marginBottom: 12 }}>
              {isRtl ? "הפוך תמונה לפורטרט DXF מדהים" : "Turn any photo into a stunning DXF portrait"}
            </h2>
            <p style={{ color: "#6b7280", fontSize: 16, maxWidth: 580, margin: "0 auto" }}>
              {isRtl
                ? "ה-AI מזהה פנים ומצייר 3 גרסאות לינארט — מוכנות לחריטה על עץ, מתכת, זכוכית ועוד"
                : "AI detects faces and draws 3 line art variations — ready for engraving on wood, metal, glass and more"}
            </p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 24 }}>
            {PORTRAIT_EXAMPLES.map((item, i) => (
              <PortraitCard key={i} item={item} isRtl={isRtl} />
            ))}
          </div>
          <div style={{ textAlign: "center", marginTop: 36 }}>
            <button
              onClick={() => navigate("/")}
              style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)", color: "#fff", border: "none", borderRadius: 12, padding: "13px 32px", fontWeight: 700, fontSize: 15, cursor: "pointer", boxShadow: "0 4px 16px rgba(124,58,237,0.35)" }}
              onMouseEnter={e => (e.currentTarget.style.transform = "scale(1.04)")}
              onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")}
            >
              {isRtl ? "נסה AI Portrait עכשיו" : "Try AI Portrait Now"}
            </button>
          </div>
        </div>
      </section>

      {/* ── AI CREATE EXAMPLES ── */}
      <section style={{ padding: "72px 24px", background: "linear-gradient(160deg,#f5f3ff 0%,#ede9fe 100%)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.25)", borderRadius: 20, padding: "5px 14px", marginBottom: 16 }}>
              <Sparkles size={13} color="#7c3aed" />
              <span style={{ color: "#7c3aed", fontSize: 13, fontWeight: 600 }}>{t.aiCreateBadge}</span>
            </div>
            <h2 style={{ fontSize: "clamp(1.5rem,3vw,2.2rem)", fontWeight: 800, color: "#1e1b4b", marginBottom: 12 }}>{t.aiCreateTitle}</h2>
            <p style={{ color: "#6b7280", fontSize: 16 }}>{t.aiCreateSubtitle}</p>
          </div>
          {/* Grid of all 15 examples */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: 16 }}>
            {AI_EXAMPLES.map((item, i) => (
              <AiExampleCard key={i} item={item} isRtl={isRtl} />
            ))}
          </div>
          <div style={{ textAlign: "center", marginTop: 36 }}>
            <button
              onClick={() => navigate("/")}
              style={{ background: "linear-gradient(135deg,#7c3aed,#6366f1)", color: "#fff", border: "none", borderRadius: 12, padding: "13px 32px", fontWeight: 700, fontSize: 15, cursor: "pointer", boxShadow: "0 4px 16px rgba(124,58,237,0.3)" }}
              onMouseEnter={e => (e.currentTarget.style.transform = "scale(1.04)")}
              onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")}
            >
              {t.aiCreateCta}
            </button>
          </div>
        </div>
      </section>

      {/* ── BENEFITS ── */}
      <section style={{ padding: "72px 24px", background: "#fff" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 52 }}>
            <h2 style={{ fontSize: "clamp(1.5rem,3vw,2.2rem)", fontWeight: 800, color: "#1e1b4b", marginBottom: 12 }}>{t.benefitsTitle}</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 28 }}>
            {t.benefits.map((b, i) => (
              <div key={i} style={{ background: "#fafafa", borderRadius: 16, padding: "28px 24px", border: "1px solid #f0f0f5", transition: "box-shadow 0.2s, transform 0.2s" }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = "0 6px 24px rgba(99,102,241,0.12)"; (e.currentTarget as HTMLDivElement).style.transform = "translateY(-3px)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = "none"; (e.currentTarget as HTMLDivElement).style.transform = "none"; }}
              >
                <div style={{ width: 48, height: 48, borderRadius: 14, background: "linear-gradient(135deg,#ede9fe,#ddd6fe)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                  {[<Shield size={22} color="#6366f1" />, <Clock size={22} color="#6366f1" />, <Zap size={22} color="#6366f1" />, <Download size={22} color="#6366f1" />, <Star size={22} color="#6366f1" />][i]}
                </div>
                <h3 style={{ fontWeight: 700, fontSize: 16, color: "#1e1b4b", marginBottom: 8 }}>{b.title}</h3>
                <p style={{ color: "#6b7280", fontSize: 14, lineHeight: 1.65 }}>{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section style={{ padding: "72px 24px", background: "#fafafa" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <h2 style={{ fontSize: "clamp(1.5rem,3vw,2.2rem)", fontWeight: 800, color: "#1e1b4b", marginBottom: 12 }}>{t.testimonialsTitle}</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 24 }}>
            {t.testimonials.map((r, i) => (
              <div key={i} style={{ background: "#fff", borderRadius: 16, padding: "28px 24px", boxShadow: "0 2px 16px rgba(0,0,0,0.06)", border: "1px solid #f0f0f5" }}>
                <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
                  {Array.from({ length: 5 }).map((_, s) => <Star key={s} size={14} fill="#f59e0b" color="#f59e0b" />)}
                </div>
                <p style={{ color: "#374151", fontSize: 14, lineHeight: 1.7, marginBottom: 20, fontStyle: "italic" }}>"{r.text}"</p>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: "50%", background: r.color, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 16 }}>{r.avatar}</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "#1e1b4b" }}>{r.name}</div>
                    <div style={{ fontSize: 12, color: "#9ca3af" }}>{r.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CONTACT CTA ── */}
      <section style={{ padding: "72px 24px", background: "#f8f7ff" }}>
        <div style={{ maxWidth: 700, margin: "0 auto", textAlign: "center" }}>
          <h2 style={{ fontSize: "clamp(1.4rem,3vw,2rem)", fontWeight: 800, color: "#1e1b4b", marginBottom: 12 }}>{t.contactTitle}</h2>
          <p style={{ color: "#6b7280", fontSize: 16, marginBottom: 36, lineHeight: 1.7 }}>{t.contactSubtitle}</p>
          <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
            {/* Leave details / email */}
            <a
              href={`mailto:${supportEmail}?subject=${encodeURIComponent(isRtl ? "פנייה מהאתר" : "Contact from website")}`}
              style={{ display: "flex", alignItems: "center", gap: 8, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff", border: "none", borderRadius: 12, padding: "14px 28px", fontWeight: 700, fontSize: 15, cursor: "pointer", textDecoration: "none", boxShadow: "0 4px 16px rgba(99,102,241,0.3)" }}
            >
              <Mail size={18} />
              {t.contactEmail}
            </a>
            {/* WhatsApp */}
            {whatsappUrl ? (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: "flex", alignItems: "center", gap: 8, background: "#25d366", color: "#fff", border: "none", borderRadius: 12, padding: "14px 28px", fontWeight: 700, fontSize: 15, cursor: "pointer", textDecoration: "none", boxShadow: "0 4px 16px rgba(37,211,102,0.3)" }}
              >
                <MessageCircle size={18} />
                {t.contactWhatsApp}
              </a>
            ) : (
              <a
                href={`https://wa.me/?text=${encodeURIComponent(isRtl ? "שלום, אני מעוניין בשירות AiDXF" : "Hello, I'm interested in AiDXF")}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: "flex", alignItems: "center", gap: 8, background: "#25d366", color: "#fff", border: "none", borderRadius: 12, padding: "14px 28px", fontWeight: 700, fontSize: 15, cursor: "pointer", textDecoration: "none", boxShadow: "0 4px 16px rgba(37,211,102,0.3)" }}
              >
                <MessageCircle size={18} />
                {t.contactWhatsApp}
              </a>
            )}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section style={{ padding: "80px 24px", background: "linear-gradient(160deg,#1e1b4b 0%,#312e81 100%)", textAlign: "center" }}>
        <div style={{ maxWidth: 600, margin: "0 auto" }}>
          <h2 style={{ color: "#fff", fontSize: "clamp(1.6rem,3.5vw,2.4rem)", fontWeight: 900, marginBottom: 16, letterSpacing: "-0.02em" }}>{t.finalCtaTitle}</h2>
          <p style={{ color: "#c4b5fd", fontSize: 16, marginBottom: 36, lineHeight: 1.7 }}>{t.finalCtaSubtitle}</p>
          <button
            onClick={() => navigate("/")}
            style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff", border: "none", borderRadius: 14, padding: "16px 40px", fontWeight: 800, fontSize: 18, cursor: "pointer", boxShadow: "0 4px 24px rgba(99,102,241,0.4)", transition: "transform 0.15s" }}
            onMouseEnter={e => (e.currentTarget.style.transform = "scale(1.04)")}
            onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")}
          >
            {t.finalCtaBtn}
          </button>
          <p style={{ color: "#7c6fcd", fontSize: 13, marginTop: 16 }}>{t.finalCtaTrust}</p>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ background: "#111827", padding: "32px 24px", textAlign: "center" }}>
        <div style={{ color: "#6b7280", fontSize: 13, lineHeight: 1.8, maxWidth: 700, margin: "0 auto" }}>
          <p style={{ marginBottom: 8 }}>
            {isRtl ? "© 2025 AiDXF — כל הזכויות שמורות" : "© 2025 AiDXF — All rights reserved"}
            {" · "}
            <span style={{ cursor: "pointer", color: "#9ca3af" }} onClick={() => navigate("/terms")}>{isRtl ? "תנאי שימוש" : "Terms"}</span>
            {" · "}
            <span style={{ cursor: "pointer", color: "#9ca3af" }} onClick={() => navigate("/privacy")}>{isRtl ? "פרטיות" : "Privacy"}</span>
          </p>
        </div>
      </footer>
    </div>
  );
}

// ─── Translations ─────────────────────────────────────────────────────────────
const he = {
  navCta: "נסה חינם",
  heroBadge: "טכנולוגיית AI מתקדמת",
  heroTitle: "מתמונה לקובץ DXF\nמוכן לחיתוך — תוך שניות",
  heroSubtitle: "פשוט מעלים תמונה, ה-AI מזהה את הקווים ומייצר קובץ DXF מדויק לכל מכונת CNC, לייזר או נתב.",
  heroCta1: "התחל חינם — 10 אסימונים מתנה",
  heroCta2: "ראה מחירים",
  heroTrust: "ללא כרטיס אשראי · רכישה מאובטחת PayPal",
  howTitle: "איך זה עובד?",
  howSubtitle: "3 שלבים פשוטים מתמונה לקובץ מוכן לייצור",
  steps: [
    { title: "מעלים תמונה", desc: "JPG, PNG או WEBP — כל תמונה עם קווים ברורים מתאימה" },
    { title: "AI מעבד", desc: "הבינה המלאכותית מזהה קווי מתאר ומייצרת נתיבים וקטוריים מדויקים" },
    { title: "מורידים DXF", desc: "קובץ DXF מוכן לייבוא ב-Lightburn, AutoCAD, Fusion 360 ועוד" },
  ],
  galleryTitle: "דוגמאות לפני ואחרי",
  gallerySubtitle: "לחץ על תמונה כדי לראות את קובץ ה-DXF שנוצר",
  galleryHint: "לחץ על כל תמונה כדי לעבור בין המקור לקובץ DXF",
  aiCreateBadge: "AI Create — יצירה מטקסט",
  aiCreateTitle: "צור עיצובים חדשים מתיאור טקסטואלי",
  aiCreateSubtitle: "פשוט תאר מה אתה רוצה — ה-AI מייצר עיצוב DXF מוכן לחיתוך",
  aiCreateCta: "נסה AI Create עכשיו",
  benefitsTitle: "למה לבחור ב-AiDXF?",
  benefits: [
    { title: "עיבוד מקצועי ומדויק", desc: "אלגוריתם AI מתקדם מייצר קווים נקיים ומדויקים — ללא צורך להגדיר זמן עיבוד." },
    { title: "תואם לכל תוכנה", desc: "DXF תקני — עובד ב-Lightburn, AutoCAD, Fusion 360, Inkscape ועוד." },
    { title: "פשוט ומהיר", desc: "עלה תמונה, קבל DXF בשניות — ללא התקנות, ללא סופטוור וללא ידע קודם." },
    { title: "תמיכה בעברית", desc: "ממשק מלא בעברית, תמיכה בעברית, ומחירים בשקלים." },
    { title: "רכישה מאובטחת", desc: "תשלום מאובטח דרך PayPal — ללא שמירת פרטי כרטיס אשראי." },
  ],
  testimonialsTitle: "מה אומרים המשתמשים",
  testimonials: [
    { name: "אבי כהן", role: "בעל מכונת לייזר", avatar: "א", color: "#6366f1", text: "חסך לי שעות של עבודה. מעלה תמונה ותוך שניות יש לי קובץ DXF מוכן לחיתוך. שווה כל שקל." },
    { name: "מיכל לוי", role: "מעצבת תכשיטים", avatar: "מ", color: "#8b5cf6", text: "השתמשתי בכלים אחרים אבל האיכות כאן הרבה יותר טובה. הקווים נקיים והקובץ עובד ישר ב-Lightburn." },
    { name: "דני שמיר", role: "מפעיל CNC", avatar: "ד", color: "#06b6d4", text: "פיצ'ר ה-AI Trace מדהים — מעלה תמונה של לוגו ומקבל קובץ וקטורי מדויק. ממליץ בחום." },
    { name: "רחל גולן", role: "אמנית עץ", avatar: "ר", color: "#10b981", text: "שלחתי תמונה של הנכד ויצא פורטרט מדהים לחריטה על עץ. מדויק ומהיר." },
  ],
  pricingTitle: "מחירים פשוטים ושקופים",
  pricingSubtitle: "שיטת תמחור גמישה — לפי המרה בודדת או מנוי חודשי. מנוי חודשי ללא הגבלה — בקרוב.",
  pricingPayPerUse: "לפי שימוש — קנה אסימונים",
  pricingSubscription: "מנוי חודשי — בקרוב",
  pricingTokens: "אסימונים",
  pricingPerAction: "לפעולה",
  pricingPopular: "⭐ הנפוץ ביותר",
  pricingBuy: "קנה עכשיו",
  packageFeatures: ["כל פעולה = אסימון אחד", "חשבונית מס", "רכישה מאובטחת PayPal"],
  comingSoon: "בקרוב",
  subTitle: "מנוי עסקי חודשי",
  subDesc: "אסימונים ללא הגבלה, ניהול צוות, גישת API וחשבונית מס חודשית. מתאים לסטודיות, מפעלים ומעצבים מקצועיים.",
  subFeatures: ["אסימונים ללא הגבלה", "ניהול צוות", "גישת API", "חשבונית מס"],
  subCta: "השאר פרטים",
  paypalTrust: "רכישה מאובטחת באמצעות",
  legalNote: "החברה שומרת לעצמה את הזכות לסגור את השירות בהודעה מוקדמת. במקרה כזה ייעשה מאמץ סביר להחזיר אסימונים שלא נוצלו או לתת זיכוי כספי יחסי.",
  contactTitle: "יש שאלות? אנחנו כאן",
  contactSubtitle: "צרו קשר בכל שאלה — נשמח לעזור בבחירת החבילה המתאימה, בעניינים טכניים, או בכל נושא אחר.",
  contactEmail: "השאר פרטים",
  contactWhatsApp: "WhatsApp",
  finalCtaTitle: "מוכן להתחיל?",
  finalCtaSubtitle: "הירשם חינם וקבל 10 אסימונים מתנה — מספיק ל-10 המרות ראשונות.",
  finalCtaBtn: "התחל חינם עכשיו",
  finalCtaTrust: "ללא כרטיס אשראי · רכישה מאובטחת PayPal",
};

const en = {
  navCta: "Try Free",
  heroBadge: "Advanced AI Technology",
  heroTitle: "From image to DXF file\nready for cutting — in seconds",
  heroSubtitle: "Simply upload an image, the AI detects the lines and generates a precise DXF file for any CNC, laser, or router machine.",
  heroCta1: "Start Free — 10 Tokens Gift",
  heroCta2: "See Pricing",
  heroTrust: "No credit card · Secure PayPal checkout",
  howTitle: "How does it work?",
  howSubtitle: "3 simple steps from image to production-ready file",
  steps: [
    { title: "Upload image", desc: "JPG, PNG or WEBP — any image with clear lines works" },
    { title: "AI processes", desc: "The AI detects contour lines and generates precise vector paths" },
    { title: "Download DXF", desc: "DXF file ready to import in Lightburn, AutoCAD, Fusion 360 and more" },
  ],
  galleryTitle: "Before & After Examples",
  gallerySubtitle: "Click an image to see the generated DXF file",
  galleryHint: "Click each image to toggle between original and DXF",
  aiCreateBadge: "AI Create — from text",
  aiCreateTitle: "Create new designs from text description",
  aiCreateSubtitle: "Simply describe what you want — AI generates a DXF design ready for cutting",
  aiCreateCta: "Try AI Create Now",
  benefitsTitle: "Why choose AiDXF?",
  benefits: [
    { title: "Professional processing & accuracy", desc: "Advanced AI algorithm generates clean, precise lines — no need to define processing time." },
    { title: "Compatible with all software", desc: "Standard DXF — works in Lightburn, AutoCAD, Fusion 360, Inkscape and more." },
    { title: "Fast & simple", desc: "Upload an image, get a DXF in seconds — no setup, no software, no prior knowledge." },
    { title: "Hebrew & English UI", desc: "Full Hebrew interface, Hebrew support, and prices in ILS." },
    { title: "Secure payment", desc: "Secure payment via PayPal — no credit card details stored." },
  ],
  testimonialsTitle: "What users say",
  testimonials: [
    { name: "Avi Cohen", role: "Laser machine owner", avatar: "A", color: "#6366f1", text: "Saved me hours of work. Upload an image and within seconds I have a DXF file ready for cutting. Worth every penny." },
    { name: "Michal Levi", role: "Jewelry designer", avatar: "M", color: "#8b5cf6", text: "I've used other tools but the quality here is much better. Lines are clean and the file works directly in Lightburn." },
    { name: "Danny Shamir", role: "CNC operator", avatar: "D", color: "#06b6d4", text: "The AI Trace feature is amazing — upload a logo image and get a precise vector file. Highly recommended." },
    { name: "Rachel Golan", role: "Wood artist", avatar: "R", color: "#10b981", text: "Sent a photo of my grandchild and got an amazing portrait for wood engraving. Accurate and fast." },
  ],
  pricingTitle: "Simple, transparent pricing",
  pricingSubtitle: "Flexible pricing — pay per conversion or monthly subscription. Monthly unlimited — coming soon.",
  pricingPayPerUse: "Pay per use — buy tokens",
  pricingSubscription: "Monthly subscription — coming soon",
  pricingTokens: "tokens",
  pricingPerAction: "per action",
  pricingPopular: "⭐ Most popular",
  pricingBuy: "Buy now",
  packageFeatures: ["Every action = 1 token", "Tax invoice", "Secure PayPal checkout"],
  comingSoon: "Coming soon",
  subTitle: "Business monthly subscription",
  subDesc: "Unlimited tokens, team management, API access and monthly tax invoice. Ideal for studios, factories and professional designers.",
  subFeatures: ["Unlimited tokens", "Team management", "API access", "Tax invoice"],
  subCta: "Leave details",
  paypalTrust: "Secure checkout via",
  legalNote: "The company reserves the right to discontinue the service with prior notice. In such case, reasonable effort will be made to refund unused tokens or provide proportional credit.",
  contactTitle: "Questions? We're here",
  contactSubtitle: "Contact us for any question — we're happy to help with package selection, technical issues, or anything else.",
  contactEmail: "Leave details",
  contactWhatsApp: "WhatsApp",
  finalCtaTitle: "Ready to start?",
  finalCtaSubtitle: "Sign up free and get 10 tokens as a gift — enough for your first 10 conversions.",
  finalCtaBtn: "Start Free Now",
  finalCtaTrust: "No credit card · Secure PayPal checkout",
};

import { useState } from "react";
import { useLocation } from "wouter";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import {
  Zap, Shield, Clock, Download, Star, ArrowLeft, ArrowRight,
  ChevronLeft, ChevronRight, Check, Sparkles, Cpu, FileDown,
  Lock
} from "lucide-react";

// ─── Image data ───────────────────────────────────────────────────────────────
const BEFORE_AFTER = [
  {
    label_he: "מצלמה",
    label_en: "Camera",
    before: "https://d2xsxph8kpxj0f.cloudfront.net/310519663365044246/hnDFdLkzVGYJYdws9hbnLw/before-camera_e8ff1c90.jpg",
    after: "https://d2xsxph8kpxj0f.cloudfront.net/310519663365044246/hnDFdLkzVGYJYdws9hbnLw/after-camera_de9f1f99.png",
  },
  {
    label_he: "אופניים",
    label_en: "Bicycle",
    before: "https://d2xsxph8kpxj0f.cloudfront.net/310519663365044246/hnDFdLkzVGYJYdws9hbnLw/before-bicycle_dbe6f82f.jpg",
    after: "https://d2xsxph8kpxj0f.cloudfront.net/310519663365044246/hnDFdLkzVGYJYdws9hbnLw/after-bicycle_10ff03f6.png",
  },
  {
    label_he: "אריה",
    label_en: "Lion",
    before: "https://d2xsxph8kpxj0f.cloudfront.net/310519663365044246/hnDFdLkzVGYJYdws9hbnLw/before-lion_06430793.jpg",
    after: "https://d2xsxph8kpxj0f.cloudfront.net/310519663365044246/hnDFdLkzVGYJYdws9hbnLw/after-lion_51a7de96.png",
  },
  {
    label_he: "מפתח ברגים",
    label_en: "Wrench",
    before: "https://d2xsxph8kpxj0f.cloudfront.net/310519663365044246/hnDFdLkzVGYJYdws9hbnLw/before-wrench_c1f95777.jpg",
    after: "https://d2xsxph8kpxj0f.cloudfront.net/310519663365044246/hnDFdLkzVGYJYdws9hbnLw/after-wrench_07e4cc11.png",
  },
  {
    label_he: "מקדחה",
    label_en: "Drill",
    before: "https://d2xsxph8kpxj0f.cloudfront.net/310519663365044246/hnDFdLkzVGYJYdws9hbnLw/before-drill_64d49d0c.jpg",
    after: "https://d2xsxph8kpxj0f.cloudfront.net/310519663365044246/hnDFdLkzVGYJYdws9hbnLw/after-drill_fe1af063.png",
  },
];

const AI_EXAMPLES = [
  {
    label_he: "קורטינה",
    label_en: "Curtain",
    prompt_he: "קורטינה מפוארת עם ציצים",
    prompt_en: "Ornate curtain with tassels",
    img: "https://d2xsxph8kpxj0f.cloudfront.net/310519663365044246/hnDFdLkzVGYJYdws9hbnLw/ai-curtain_b7a74988.png",
  },
  {
    label_he: "מנדלה",
    label_en: "Mandala",
    prompt_he: "מנדלה גיאומטרית סימטרית",
    prompt_en: "Geometric symmetric mandala",
    img: "https://d2xsxph8kpxj0f.cloudfront.net/310519663365044246/hnDFdLkzVGYJYdws9hbnLw/ai-mandala_51de496a.png",
  },
  {
    label_he: "נשר",
    label_en: "Eagle",
    prompt_he: "נשר עם כנפיים פרושות",
    prompt_en: "Eagle with spread wings",
    img: "https://d2xsxph8kpxj0f.cloudfront.net/310519663365044246/hnDFdLkzVGYJYdws9hbnLw/ai-eagle_fa4bc91a.png",
  },
];

const FALLBACK_PACKAGES = [
  { id: "tokens_3", tokens: 30, popular: false, prices: { ILS: "29" } },
  { id: "tokens_1", tokens: 100, popular: true, prices: { ILS: "59" } },
  { id: "tokens_300", tokens: 300, popular: false, prices: { ILS: "129" } },
];

// ─── Before/After slider ──────────────────────────────────────────────────────
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
        {/* Toggle badge */}
        <div style={{
          position: "absolute", bottom: 10, left: "50%", transform: "translateX(-50%)",
          background: showAfter ? "rgba(99,102,241,0.92)" : "rgba(0,0,0,0.55)",
          color: "#fff", borderRadius: 20, padding: "4px 14px", fontSize: 12, fontWeight: 600,
          backdropFilter: "blur(4px)", whiteSpace: "nowrap",
        }}>
          {showAfter ? (isRtl ? "אחרי ← לפני" : "After ← Before") : (isRtl ? "לחץ לראות DXF" : "Click to see DXF")}
        </div>
      </div>
      <div style={{ padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontWeight: 700, fontSize: 14, color: "#1e1b4b" }}>{isRtl ? item.label_he : item.label_en}</span>
        <span style={{ fontSize: 11, color: showAfter ? "#6366f1" : "#9ca3af", fontWeight: 600 }}>
          {showAfter ? "DXF" : (isRtl ? "מקור" : "Original")}
        </span>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Landing() {
  const { isRtl } = useLanguage();
  const [, navigate] = useLocation();
  const [aiIdx, setAiIdx] = useState(0);

  const { data: dbPrices } = trpc.packages.prices.useQuery();
  const packages = dbPrices && dbPrices.length > 0
    ? dbPrices.map((p) => ({
        id: p.packageId, tokens: p.tokenAmount, popular: p.packageId === "tokens_1",
        prices: { ILS: p.priceILS },
      }))
    : FALLBACK_PACKAGES;

  const dir = isRtl ? "rtl" : "ltr";
  const t = isRtl ? he : en;

  return (
    <div dir={dir} style={{ minHeight: "100vh", background: "#fff", fontFamily: "'Inter','Segoe UI',sans-serif", overflowX: "hidden" }}>

      {/* ── Sticky nav ── */}
      <header style={{ position: "sticky", top: 0, zIndex: 30, background: "rgba(255,255,255,0.95)", backdropFilter: "blur(8px)", borderBottom: "1px solid #e8eaf0", boxShadow: "0 1px 6px rgba(0,0,0,0.06)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {/* Logo */}
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
          {/* CTA */}
          <button
            onClick={() => navigate("/")}
            style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff", border: "none", borderRadius: 10, padding: "9px 22px", fontWeight: 700, fontSize: 14, cursor: "pointer", boxShadow: "0 2px 10px rgba(99,102,241,0.3)" }}
          >
            {t.navCta}
          </button>
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
            <button
              onClick={() => document.getElementById("pricing-section")?.scrollIntoView({ behavior: "smooth" })}
              style={{ background: "rgba(255,255,255,0.1)", color: "#e0e7ff", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 12, padding: "14px 28px", fontWeight: 700, fontSize: 15, cursor: "pointer", backdropFilter: "blur(4px)" }}
            >
              {t.heroCta2}
            </button>
          </div>
          {/* Trust line */}
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

      {/* ── AI CREATE EXAMPLES ── */}
      <section style={{ padding: "72px 24px", background: "linear-gradient(160deg,#f5f3ff 0%,#ede9fe 100%)" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.25)", borderRadius: 20, padding: "5px 14px", marginBottom: 16 }}>
              <Sparkles size={13} color="#7c3aed" />
              <span style={{ color: "#7c3aed", fontSize: 13, fontWeight: 600 }}>{t.aiCreateBadge}</span>
            </div>
            <h2 style={{ fontSize: "clamp(1.5rem,3vw,2.2rem)", fontWeight: 800, color: "#1e1b4b", marginBottom: 12 }}>{t.aiCreateTitle}</h2>
            <p style={{ color: "#6b7280", fontSize: 16 }}>{t.aiCreateSubtitle}</p>
          </div>
          {/* Carousel */}
          <div style={{ position: "relative", maxWidth: 480, margin: "0 auto" }}>
            <div style={{ borderRadius: 20, overflow: "hidden", boxShadow: "0 8px 40px rgba(99,102,241,0.18)", background: "#fff" }}>
              <img
                src={AI_EXAMPLES[aiIdx].img}
                alt={isRtl ? AI_EXAMPLES[aiIdx].label_he : AI_EXAMPLES[aiIdx].label_en}
                style={{ width: "100%", display: "block" }}
              />
              <div style={{ padding: "16px 20px", borderTop: "1px solid #f0f0f5" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ background: "#ede9fe", borderRadius: 8, padding: "4px 10px", fontSize: 12, color: "#7c3aed", fontWeight: 600 }}>
                    {isRtl ? "פרומפט:" : "Prompt:"}
                  </div>
                  <span style={{ fontSize: 14, color: "#374151", fontStyle: "italic" }}>
                    "{isRtl ? AI_EXAMPLES[aiIdx].prompt_he : AI_EXAMPLES[aiIdx].prompt_en}"
                  </span>
                </div>
              </div>
            </div>
            {/* Nav buttons */}
            <button
              onClick={() => setAiIdx(v => (v - 1 + AI_EXAMPLES.length) % AI_EXAMPLES.length)}
              style={{ position: "absolute", top: "50%", [isRtl ? "right" : "left"]: -20, transform: "translateY(-50%)", width: 40, height: 40, borderRadius: "50%", background: "#fff", border: "1px solid #e0e7ff", boxShadow: "0 2px 10px rgba(0,0,0,0.1)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              {isRtl ? <ChevronRight size={18} color="#6366f1" /> : <ChevronLeft size={18} color="#6366f1" />}
            </button>
            <button
              onClick={() => setAiIdx(v => (v + 1) % AI_EXAMPLES.length)}
              style={{ position: "absolute", top: "50%", [isRtl ? "left" : "right"]: -20, transform: "translateY(-50%)", width: 40, height: 40, borderRadius: "50%", background: "#fff", border: "1px solid #e0e7ff", boxShadow: "0 2px 10px rgba(0,0,0,0.1)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              {isRtl ? <ChevronLeft size={18} color="#6366f1" /> : <ChevronRight size={18} color="#6366f1" />}
            </button>
            {/* Dots */}
            <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 20 }}>
              {AI_EXAMPLES.map((_, i) => (
                <div key={i} onClick={() => setAiIdx(i)} style={{ width: i === aiIdx ? 20 : 8, height: 8, borderRadius: 4, background: i === aiIdx ? "#6366f1" : "#d1d5db", cursor: "pointer", transition: "all 0.2s" }} />
              ))}
            </div>
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
                  {[<Zap size={22} color="#6366f1" />, <Clock size={22} color="#6366f1" />, <Shield size={22} color="#6366f1" />, <Download size={22} color="#6366f1" />, <Star size={22} color="#6366f1" />][i]}
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

      {/* ── PRICING ── */}
      <section id="pricing-section" style={{ padding: "80px 24px", background: "#fff" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 52 }}>
            <h2 style={{ fontSize: "clamp(1.5rem,3vw,2.2rem)", fontWeight: 800, color: "#1e1b4b", marginBottom: 12 }}>{t.pricingTitle}</h2>
            <p style={{ color: "#6b7280", fontSize: 16 }}>{t.pricingSubtitle}</p>
          </div>

          {/* Pay-per-use packages */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24 }}>
              <div style={{ flex: 1, height: 1, background: "#e5e7eb" }} />
              <span style={{ color: "#6b7280", fontSize: 14, fontWeight: 600, whiteSpace: "nowrap" }}>{t.pricingPayPerUse}</span>
              <div style={{ flex: 1, height: 1, background: "#e5e7eb" }} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 20 }}>
              {packages.map((pkg) => (
                <div
                  key={pkg.id}
                  style={{
                    borderRadius: 16, padding: "28px 24px", textAlign: "center", position: "relative",
                    border: pkg.popular ? "2px solid #6366f1" : "1px solid #e5e7eb",
                    background: pkg.popular ? "linear-gradient(160deg,#f5f3ff,#ede9fe)" : "#fafafa",
                    boxShadow: pkg.popular ? "0 4px 24px rgba(99,102,241,0.15)" : "none",
                  }}
                >
                  {pkg.popular && (
                    <div style={{ position: "absolute", top: -13, left: "50%", transform: "translateX(-50%)", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff", borderRadius: 20, padding: "3px 14px", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>
                      {t.pricingPopular}
                    </div>
                  )}
                  <div style={{ fontSize: 28, fontWeight: 900, color: "#1e1b4b", marginBottom: 4 }}>
                    {pkg.tokens} <span style={{ fontSize: 16, fontWeight: 600, color: "#6b7280" }}>{t.pricingTokens}</span>
                  </div>
                  <div style={{ fontSize: 32, fontWeight: 900, color: "#6366f1", marginBottom: 4 }}>
                    ₪{pkg.prices.ILS}
                  </div>
                  <div style={{ fontSize: 13, color: "#9ca3af", marginBottom: 20 }}>
                    ≈ ₪{(parseFloat(pkg.prices.ILS) / pkg.tokens).toFixed(2)} {t.pricingPerAction}
                  </div>
                  <ul style={{ listStyle: "none", padding: 0, margin: "0 0 24px", textAlign: isRtl ? "right" : "left" }}>
                    {t.packageFeatures.map((f, fi) => (
                      <li key={fi} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#374151", marginBottom: 8 }}>
                        <Check size={14} color="#6366f1" style={{ flexShrink: 0 }} />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => navigate("/buy")}
                    style={{
                      width: "100%", borderRadius: 10, padding: "11px 0", fontWeight: 700, fontSize: 14, cursor: "pointer", border: "none",
                      background: pkg.popular ? "linear-gradient(135deg,#6366f1,#8b5cf6)" : "#f3f4f6",
                      color: pkg.popular ? "#fff" : "#374151",
                      boxShadow: pkg.popular ? "0 3px 12px rgba(99,102,241,0.3)" : "none",
                    }}
                  >
                    {t.pricingBuy}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Subscription teaser */}
          <div style={{ marginTop: 32 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
              <div style={{ flex: 1, height: 1, background: "#e5e7eb" }} />
              <span style={{ color: "#6b7280", fontSize: 14, fontWeight: 600, whiteSpace: "nowrap" }}>{t.pricingSubscription}</span>
              <div style={{ flex: 1, height: 1, background: "#e5e7eb" }} />
            </div>
            <div style={{ background: "linear-gradient(135deg,#1e1b4b,#312e81)", borderRadius: 16, padding: "32px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 20 }}>
              <div>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.12)", borderRadius: 20, padding: "4px 12px", marginBottom: 12 }}>
                  <span style={{ color: "#a5b4fc", fontSize: 12, fontWeight: 700 }}>{t.comingSoon}</span>
                </div>
                <h3 style={{ color: "#fff", fontWeight: 800, fontSize: 20, marginBottom: 8 }}>{t.subTitle}</h3>
                <p style={{ color: "#c4b5fd", fontSize: 14, lineHeight: 1.6, maxWidth: 420 }}>{t.subDesc}</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 16 }}>
                  {t.subFeatures.map((f, i) => (
                    <span key={i} style={{ background: "rgba(99,102,241,0.25)", color: "#e0e7ff", borderRadius: 20, padding: "4px 12px", fontSize: 12, fontWeight: 600 }}>✓ {f}</span>
                  ))}
                </div>
              </div>
              <button
                onClick={() => { window.location.href = `mailto:info@dxfai.net?subject=${encodeURIComponent(isRtl ? "עניין במנוי עסקי" : "Business subscription interest")}`; }}
                style={{ background: "rgba(255,255,255,0.12)", color: "#e0e7ff", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 12, padding: "12px 24px", fontWeight: 700, fontSize: 14, cursor: "pointer", whiteSpace: "nowrap" }}
              >
                {t.subCta}
              </button>
            </div>
          </div>

          {/* PayPal trust badge */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 28, color: "#6b7280", fontSize: 13 }}>
            <Lock size={14} color="#6b7280" />
            <span>{t.paypalTrust}</span>
            <svg height="20" viewBox="0 0 101 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12.237 2.8C11.6 2.8 11.067 3.267 10.967 3.9L8.1 22.1c-.067.467.3.9.767.9h4.333c.567 0 1.1-.467 1.2-1.033l.8-5.067c.1-.567.633-1.033 1.2-1.033h2.767c3.933 0 6.2-1.9 6.8-5.667.267-1.633.033-2.933-.667-3.833-.767-.967-2.133-1.467-3.933-1.467H12.237z" fill="#009cde"/>
              <path d="M38.337 2.8c-.567 0-1.1.467-1.2 1.033l-2.867 18.2c-.067.467.3.9.767.9h4.133c.567 0 1.1-.467 1.2-1.033l2.867-18.2c.067-.467-.3-.9-.767-.9h-4.133z" fill="#003087"/>
              <path d="M53.037 9.867c-.567 0-1.1.467-1.2 1.033l-.167 1.067-.267-.367c-.833-1.2-2.667-1.6-4.5-1.6-4.2 0-7.8 3.167-8.5 7.6-.367 2.2.133 4.3 1.367 5.767 1.133 1.333 2.733 1.9 4.633 1.9 3.367 0 5.233-2.167 5.233-2.167l-.167 1.067c-.067.467.3.9.767.9h3.733c.567 0 1.1-.467 1.2-1.033l2.233-14.167c.067-.467-.3-.9-.767-.9h-3.6zm-2.033 7.333c-.367 2.1-2.067 3.5-4.2 3.5-1.067 0-1.933-.333-2.467-1-.533-.667-.733-1.6-.567-2.633.333-2.067 2.067-3.533 4.167-3.533 1.033 0 1.9.333 2.467 1 .533.7.733 1.633.6 2.666z" fill="#009cde"/>
            </svg>
          </div>

          {/* Legal note */}
          <p style={{ textAlign: "center", color: "#9ca3af", fontSize: 12, marginTop: 16, lineHeight: 1.6 }}>
            {t.legalNote}
          </p>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section style={{ padding: "80px 24px", background: "linear-gradient(160deg,#1e1b4b 0%,#312e81 100%)", textAlign: "center" }}>
        <div style={{ maxWidth: 600, margin: "0 auto" }}>
          <h2 style={{ color: "#fff", fontSize: "clamp(1.6rem,3.5vw,2.4rem)", fontWeight: 900, marginBottom: 16, letterSpacing: "-0.02em" }}>{t.finalCtaTitle}</h2>
          <p style={{ color: "#c4b5fd", fontSize: 16, marginBottom: 36, lineHeight: 1.7 }}>{t.finalCtaSubtitle}</p>
          <button
            onClick={() => navigate("/")}
            style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff", border: "none", borderRadius: 14, padding: "16px 40px", fontWeight: 800, fontSize: 18, cursor: "pointer", boxShadow: "0 4px 24px rgba(99,102,241,0.4)" }}
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
          <p style={{ color: "#4b5563", fontSize: 12 }}>{t.legalNote}</p>
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
  heroTrust: "ללא כרטיס אשראי · אסימונים לא פגים · רכישה מאובטחת PayPal",
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
  benefitsTitle: "למה לבחור ב-AiDXF?",
  benefits: [
    { title: "מהיר כברק", desc: "המרה תוך 5-10 שניות. לא צריך להמתין — קובץ מוכן מיידית." },
    { title: "אסימונים לא פגים", desc: "אסימונים שרכשת נשארים לתמיד. אין מנוי, אין לחץ." },
    { title: "קווים נקיים ומדויקים", desc: "אלגוריתם AI מתקדם מייצר קווים חלקים המתאימים לחיתוך CNC ולייזר." },
    { title: "תואם לכל תוכנה", desc: "DXF תקני — עובד ב-Lightburn, AutoCAD, Fusion 360, Inkscape ועוד." },
    { title: "תמיכה בעברית", desc: "ממשק מלא בעברית, תמיכה בעברית, ומחירים בשקלים." },
  ],
  testimonialsTitle: "מה אומרים המשתמשים",
  testimonials: [
    { name: "אבי כהן", role: "בעל מכונת לייזר", avatar: "א", color: "#6366f1", text: "חסך לי שעות של עבודה. מעלה תמונה ותוך שניות יש לי קובץ DXF מוכן לחיתוך. שווה כל שקל." },
    { name: "מיכל לוי", role: "מעצבת תכשיטים", avatar: "מ", color: "#8b5cf6", text: "השתמשתי בכלים אחרים אבל האיכות כאן הרבה יותר טובה. הקווים נקיים והקובץ עובד ישר ב-Lightburn." },
    { name: "דני שמיר", role: "מפעיל CNC", avatar: "ד", color: "#06b6d4", text: "פיצ'ר ה-AI Trace מדהים — מעלה תמונה של לוגו ומקבל קובץ וקטורי מדויק. ממליץ בחום." },
    { name: "רחל גולן", role: "אמנית עץ", avatar: "ר", color: "#10b981", text: "שלחתי תמונה של הנכד ויצא פורטרט מדהים לחריטה על עץ. מדויק ומהיר." },
  ],
  pricingTitle: "מחירים פשוטים ושקופים",
  pricingSubtitle: "שלם לפי שימוש — קנה אסימונים כשצריך. מנוי חודשי ללא הגבלה — בקרוב.",
  pricingPayPerUse: "לפי שימוש — קנה אסימונים",
  pricingSubscription: "מנוי חודשי — בקרוב",
  pricingTokens: "אסימונים",
  pricingPerAction: "לפעולה",
  pricingPopular: "⭐ הנפוץ ביותר",
  pricingBuy: "קנה עכשיו",
  packageFeatures: ["כל פעולה = אסימון אחד", "אסימונים לא פגים לעולם", "חשבונית מס", "רכישה מאובטחת PayPal"],
  comingSoon: "בקרוב",
  subTitle: "מנוי עסקי חודשי",
  subDesc: "אסימונים ללא הגבלה, ניהול צוות, גישת API וחשבונית מס חודשית. מתאים לסטודיות, מפעלים ומעצבים מקצועיים.",
  subFeatures: ["אסימונים ללא הגבלה", "ניהול צוות", "גישת API", "חשבונית מס"],
  subCta: "השאר פרטים",
  paypalTrust: "רכישה מאובטחת באמצעות",
  legalNote: "החברה שומרת לעצמה את הזכות לסגור את השירות בהודעה מוקדמת. במקרה כזה ייעשה מאמץ סביר להחזיר אסימונים שלא נוצלו או לתת זיכוי כספי יחסי.",
  finalCtaTitle: "מוכן להתחיל?",
  finalCtaSubtitle: "הירשם חינם וקבל 10 אסימונים מתנה — מספיק ל-10 המרות ראשונות.",
  finalCtaBtn: "התחל חינם עכשיו",
  finalCtaTrust: "ללא כרטיס אשראי · אסימונים לא פגים",
};

const en = {
  navCta: "Try Free",
  heroBadge: "Advanced AI Technology",
  heroTitle: "From image to DXF file\nready for cutting — in seconds",
  heroSubtitle: "Simply upload an image, the AI detects the lines and generates a precise DXF file for any CNC, laser, or router machine.",
  heroCta1: "Start Free — 10 Tokens Gift",
  heroCta2: "See Pricing",
  heroTrust: "No credit card · Tokens never expire · Secure PayPal checkout",
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
  benefitsTitle: "Why choose AiDXF?",
  benefits: [
    { title: "Lightning fast", desc: "Conversion in 5-10 seconds. No waiting — file ready instantly." },
    { title: "Tokens never expire", desc: "Purchased tokens stay forever. No subscription, no pressure." },
    { title: "Clean, precise lines", desc: "Advanced AI algorithm generates smooth lines suitable for CNC and laser cutting." },
    { title: "Compatible with all software", desc: "Standard DXF — works in Lightburn, AutoCAD, Fusion 360, Inkscape and more." },
    { title: "Hebrew & English UI", desc: "Full Hebrew interface, Hebrew support, and prices in ILS." },
  ],
  testimonialsTitle: "What users say",
  testimonials: [
    { name: "Avi Cohen", role: "Laser machine owner", avatar: "A", color: "#6366f1", text: "Saved me hours of work. Upload an image and within seconds I have a DXF file ready for cutting. Worth every penny." },
    { name: "Michal Levi", role: "Jewelry designer", avatar: "M", color: "#8b5cf6", text: "I've used other tools but the quality here is much better. Lines are clean and the file works directly in Lightburn." },
    { name: "Danny Shamir", role: "CNC operator", avatar: "D", color: "#06b6d4", text: "The AI Trace feature is amazing — upload a logo image and get a precise vector file. Highly recommended." },
    { name: "Rachel Golan", role: "Wood artist", avatar: "R", color: "#10b981", text: "Sent a photo of my grandchild and got an amazing portrait for wood engraving. Accurate and fast." },
  ],
  pricingTitle: "Simple, transparent pricing",
  pricingSubtitle: "Pay as you go — buy tokens when needed. Monthly unlimited subscription — coming soon.",
  pricingPayPerUse: "Pay per use — buy tokens",
  pricingSubscription: "Monthly subscription — coming soon",
  pricingTokens: "tokens",
  pricingPerAction: "per action",
  pricingPopular: "⭐ Most popular",
  pricingBuy: "Buy now",
  packageFeatures: ["Every action = 1 token", "Tokens never expire", "Tax invoice", "Secure PayPal checkout"],
  comingSoon: "Coming soon",
  subTitle: "Business monthly subscription",
  subDesc: "Unlimited tokens, team management, API access and monthly tax invoice. Ideal for studios, factories and professional designers.",
  subFeatures: ["Unlimited tokens", "Team management", "API access", "Tax invoice"],
  subCta: "Leave details",
  paypalTrust: "Secure checkout via",
  legalNote: "The company reserves the right to close the service with prior notice. In such case, a reasonable effort will be made to refund unused tokens or provide a proportional credit.",
  finalCtaTitle: "Ready to start?",
  finalCtaSubtitle: "Sign up free and get 10 gift tokens — enough for your first 10 conversions.",
  finalCtaBtn: "Start Free Now",
  finalCtaTrust: "No credit card · Tokens never expire",
};

import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { AuthDialog } from "@/components/AuthDialog";
import {
  Zap, Shield, Clock, Download, Star,
  ChevronLeft, ChevronRight, Check, Sparkles, Cpu, FileDown,
  Lock, MessageCircle, Mail, Phone, Camera, Keyboard, Scissors, Wand2, Upload
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
    before: `${CDN}/before-camera_e61c19ce.webp`,
    after: `${CDN}/after-camera_62da43b0.webp`,
  },
  {
    label_he: "אופניים",
    label_en: "Bicycle",
    desc_he: "אופניים — שלדה, גלגלים, שרשרת",
    desc_en: "Bicycle — frame, wheels, chain",
    before: `${CDN}/before-bicycle_ccd30311.webp`,
    after: `${CDN}/after-bicycle_f9116dba.webp`,
  },
  {
    label_he: "אריה",
    label_en: "Lion",
    desc_he: "ראש אריה — רעמה, פנים, ביטוי",
    desc_en: "Lion head — mane, face, expression",
    before: `${CDN}/before-lion_3fc83f14.webp`,
    after: `${CDN}/after-lion_9061a0f9.webp`,
  },
  {
    label_he: "מפתח ברגים",
    label_en: "Wrench",
    desc_he: "מפתח ברגים — כלי עבודה מתכתי",
    desc_en: "Wrench — metal workshop tool",
    before: `${CDN}/before-wrench_2707cb1c.webp`,
    after: `${CDN}/after-wrench_8e8d740a.webp`,
  },
  {
    label_he: "מקדחה",
    label_en: "Drill",
    desc_he: "מקדחה חשמלית — גוף, ידית, מקדח",
    desc_en: "Power drill — body, handle, bit",
    before: `${CDN}/before-drill_82980991.webp`,
    after: `${CDN}/after-drill_f1ef38e9.webp`,
  },
  {
    label_he: "חתול",
    label_en: "Cat",
    desc_he: "חתול יושב — פרווה, עיניים, זנב",
    desc_en: "Sitting cat — fur, eyes, tail",
    before: `${CDN}/before-cat_d5e4497a.webp`,
    after: `${CDN}/after-cat_552cb407.webp`,
  },
  {
    label_he: "אופנוע",
    label_en: "Motorcycle",
    desc_he: "אופנוע קלאסי — מנוע, גלגלים, מסגרת",
    desc_en: "Classic motorcycle — engine, wheels, frame",
    before: `${CDN}/before-motorcycle_fb24e4de.webp`,
    after: `${CDN}/after-motorcycle_5d9f2f8b.webp`,
  },
  {
    label_he: "טוקן",
    label_en: "Toucan",
    desc_he: "ציפור טוקי — מקור גדול, נוצות, ענף",
    desc_en: "Toucan bird — large beak, feathers, branch",
    before: `${CDN}/before-toucan_7aa9198f.webp`,
    after: `${CDN}/after-toucan_61617d63.webp`,
  },
  {
    label_he: "רחפן",
    label_en: "Drone",
    desc_he: "רחפן DJI — גוף, זרועות, מנועים, מצלמה",
    desc_en: "DJI drone — body, arms, motors, camera",
    before: `${CDN}/drone-hq_b3634d9d.webp`,
    after: `${CDN}/drone-vector-hq_5618a96c.webp`,
  },
  {
    label_he: "חמניות",
    label_en: "Sunflowers",
    desc_he: "שדה חמניות עם שקיעה — פרחים, עלים, קרני שמש",
    desc_en: "Sunflower field at sunset — flowers, leaves, sun rays",
    before: `${CDN}/sunflower-hq_ac53a133.webp`,
    after: `${CDN}/sunflower-vector-v3_82858490.webp`,
  },
];

const AI_EXAMPLES = [
  {
    label_he: "זאב גיאומטרי",
    label_en: "Geometric Wolf",
    prompt_he: "זאב גיאומטרי מודרני",
    prompt_en: "Modern geometric wolf",
    img: `${CDN}/ai-geometric-wolf_11ff1166.webp`,
  },
  {
    label_he: "מנדלה",
    label_en: "Mandala",
    prompt_he: "מנדלה גיאומטרית סימטרית",
    prompt_en: "Geometric symmetric mandala",
    img: `${CDN}/ai-mandala-v2_12f65a94.webp`,
  },
  {
    label_he: "מזלג",
    label_en: "Fork",
    prompt_he: "מזלג עם ידית מעוטרת",
    prompt_en: "Fork with ornate handle",
    img: `${CDN}/ai-fork_b54da0cd.webp`,
  },
  {
    label_he: "גיטרה",
    label_en: "Guitar",
    prompt_he: "גיטרה אקוסטית קלאסית",
    prompt_en: "Classic acoustic guitar",
    img: `${CDN}/ai-guitar_9e84fdc5.webp`,
  },
  {
    label_he: "פרפר",
    label_en: "Butterfly",
    prompt_he: "פרפר עם כנפיים מפורטות",
    prompt_en: "Butterfly with detailed wings",
    img: `${CDN}/ai-butterfly_d8bd12e4.webp`,
  },
  {
    label_he: "בית",
    label_en: "House",
    prompt_he: "בית קוטג' עם גינה",
    prompt_en: "Cottage house with garden",
    img: `${CDN}/ai-house_892017a9.webp`,
  },
  {
    label_he: "אופניים",
    label_en: "Bicycle",
    prompt_he: "אופניים קלאסיים",
    prompt_en: "Classic bicycle",
    img: `${CDN}/ai-bicycle-clean_05166615.webp`,
  },
  {
    label_he: "סקייטבורד",
    label_en: "Skateboard",
    prompt_he: "סקייטבורד מקצועי",
    prompt_en: "Professional skateboard",
    img: `${CDN}/ai-skateboard_56ec679e.webp`,
  },
  {
    label_he: "נעל",
    label_en: "Sneaker",
    prompt_he: "נעל סניקרס קלאסית",
    prompt_en: "Classic sneaker shoe",
    img: `${CDN}/ai-sneaker_d3ad2ab7.webp`,
  },
  {
    label_he: "אוזניות",
    label_en: "Headphones",
    prompt_he: "אוזניות over-ear",
    prompt_en: "Over-ear headphones",
    img: `${CDN}/ai-headphones-v2_45622dbf.webp`,
  },
  {
    label_he: "מצלמה",
    label_en: "Camera",
    prompt_he: "מצלמת SLR וינטאג'",
    prompt_en: "Vintage SLR camera",
    img: `${CDN}/ai-camera-art_2efadfd5.webp`,
  },
  {
    label_he: "מכונית",
    label_en: "Car",
    prompt_he: "מכונית ספורט קלאסית",
    prompt_en: "Classic sports car",
    img: `${CDN}/ai-car_1eda266f.webp`,
  },
  {
    label_he: "כלב",
    label_en: "Dog",
    prompt_he: "כלב יושב",
    prompt_en: "Sitting dog",
    img: `${CDN}/ai-dog_8c903238.webp`,
  },
  {
    label_he: "עוגן",
    label_en: "Anchor",
    prompt_he: "עוגן ימי קלאסי",
    prompt_en: "Classic nautical anchor",
    img: `${CDN}/ai-anchor_b3d2ed73.webp`,
  },
  {
    label_he: "רקטה",
    label_en: "Rocket",
    prompt_he: "רקטה חלל מודרנית",
    prompt_en: "Modern space rocket",
    img: `${CDN}/ai-rocket_237c4ae0.webp`,
  },
  {
    label_he: "מספריים מקצועיות",
    label_en: "Professional Scissors",
    prompt_he: "מספריים מקצועיות",
    prompt_en: "Professional scissors",
    img: `${CDN}/ai-create-scissors-QopeAzD8GtJKXM92QkvmRD.webp`,
  },
  {
    label_he: "סקייטבורד",
    label_en: "Skateboard",
    prompt_he: "סקייטבורד מקצועי עם גלגלים",
    prompt_en: "Professional skateboard with wheels",
    img: `${CDN}/ai-skateboard-dxf-HSkbD3L5Ksf9jFSsx67SLy.png`,
  },
  {
    label_he: "נעל ספורט",
    label_en: "Sneaker",
    prompt_he: "נעל ספורט גבוהה קלאסית",
    prompt_en: "Classic high-top sneaker",
    img: `${CDN}/ai-sneaker-dxf_a01cf887.png`,
  },
];


// ─── Portrait Examples ───────────────────────────────────────────────────────
const PORTRAIT_EXAMPLES = [
  {
    label_he: "נערה",
    label_en: "Teen Girl",
    desc_he: "פורטרט נערה — שיער מתולתל, קווים עדינים",
    desc_en: "Teen girl portrait — curly hair, delicate lines",
    before: "https://d2xsxph8kpxj0f.cloudfront.net/310519663365044246/hnDFdLkzVGYJYdws9hbnLw/portrait2-teen_bb1048a7.webp",
    after: "https://d2xsxph8kpxj0f.cloudfront.net/310519663365044246/hnDFdLkzVGYJYdws9hbnLw/portrait-dxf-teen-v4-PXoePry5PzKQwr84US3zye.png",
  },
  {
    label_he: "אישה",
    label_en: "Woman",
    desc_he: "פורטרט אישה — שיער קצר, ביטחון",
    desc_en: "Woman portrait — short hair, confidence",
    before: "https://d2xsxph8kpxj0f.cloudfront.net/310519663365044246/hnDFdLkzVGYJYdws9hbnLw/portrait2-midwoman_0639eabc.webp",
    after: "https://d2xsxph8kpxj0f.cloudfront.net/310519663365044246/hnDFdLkzVGYJYdws9hbnLw/portrait-dxf-woman-v4-mfy3rkFb6YewV7z5whRfFN.png",
  },
  {
    label_he: "גבר",
    label_en: "Man",
    desc_he: "פורטרט גבר — זקן, מבנה פנים חזק",
    desc_en: "Man portrait — beard, strong face structure",
    before: "https://d2xsxph8kpxj0f.cloudfront.net/310519663365044246/hnDFdLkzVGYJYdws9hbnLw/portrait2-beardman_8845c11b.webp",
    after: "https://d2xsxph8kpxj0f.cloudfront.net/310519663365044246/hnDFdLkzVGYJYdws9hbnLw/portrait-dxf-man-v4-WKVfnHTho32roe24MBhsh8.png",
  },
  {
    label_he: "קשישה",
    label_en: "Elder Woman",
    desc_he: "פורטרט קשישה — קמטים, אופי, עומק",
    desc_en: "Elder woman — wrinkles, character, depth",
    before: "https://d2xsxph8kpxj0f.cloudfront.net/310519663365044246/hnDFdLkzVGYJYdws9hbnLw/portrait2-eldwoman_63c4142b.webp",
    after: "https://d2xsxph8kpxj0f.cloudfront.net/310519663365044246/hnDFdLkzVGYJYdws9hbnLw/portrait-dxf-elder-v4-UaPqSPFfVh3J3GmiFEBbF3.png",
  },
];

// ─── Portrait Card (before/after toggle) ─────────────────────────────────────
function PortraitCard({ item, isRtl }: { item: typeof PORTRAIT_EXAMPLES[0]; isRtl: boolean }) {
  const [showAfter, setShowAfter] = useState(false);
  return (
    <div
      style={{
        borderRadius: 16, overflow: "hidden", boxShadow: "0 4px 20px rgba(124,58,237,0.12)",
        cursor: "pointer", position: "relative", background: "#fff",
        transition: "transform 0.2s, box-shadow 0.2s",
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = "translateY(-4px)"; (e.currentTarget as HTMLDivElement).style.boxShadow = "0 10px 32px rgba(124,58,237,0.22)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = "none"; (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 20px rgba(124,58,237,0.12)"; }}
      onClick={() => setShowAfter(v => !v)}
    >
      <div style={{ position: "relative", width: "100%", paddingBottom: "100%", background: "#f8f8f8" }}>
        <img
          src={showAfter ? item.after : item.before}
          alt={isRtl ? item.label_he : item.label_en}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", background: "#f8f8f8", transition: "opacity 0.3s" }}
        />
        {/* Toggle button */}
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
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", background: "#f8f8f8", transition: "opacity 0.3s" }}
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
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", background: "#f8f6ff" }}
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

// ─── Demo Video Section ─────────────────────────────────────────────────────
function DemoVideoSection({ isRtl }: { isRtl: boolean }) {
  const [muted, setMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !muted;
      if (!muted === false) {
        videoRef.current.play();
      }
      setMuted(!muted);
    }
  };

  return (
    <section style={{
      padding: "80px 0",
      background: "linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Background glow orbs */}
      <div style={{ position: "absolute", top: -80, left: "20%", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(99,102,241,0.25) 0%, transparent 70%)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: -60, right: "15%", width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle, rgba(167,139,250,0.20) 0%, transparent 70%)", pointerEvents: "none" }} />

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 24px", textAlign: "center", position: "relative", zIndex: 1 }}>
        {/* Badge */}
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.18)", borderRadius: 24, padding: "6px 16px", marginBottom: 20, backdropFilter: "blur(8px)" }}>
          <span style={{ fontSize: 16 }}>🎬</span>
          <span style={{ color: "#c4b5fd", fontSize: 13, fontWeight: 600, letterSpacing: 0.5 }}>
            {isRtl ? "צפה בדמו — כל הפיצ'רים" : "Watch Demo — All Features"}
          </span>
        </div>

        {/* Title */}
        <h2 style={{ fontSize: "clamp(1.6rem,3.5vw,2.4rem)", fontWeight: 900, color: "#fff", marginBottom: 8, lineHeight: 1.2 }}>
          {isRtl ? "ראה איך זה עובד בפועל" : "See it in action"}
        </h2>
        <p style={{ color: "rgba(196,181,253,0.85)", fontSize: 16, marginBottom: 36, maxWidth: 500, margin: "0 auto 36px" }}>
          {isRtl ? "AI Outline, AI Portrait, AI Create — הכל בסרטון אחד" : "AI Outline, AI Portrait, AI Create — all in one demo"}
        </p>

        {/* Video wrapper */}
        <div style={{ position: "relative", borderRadius: 24, overflow: "hidden", boxShadow: "0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.08)", background: "#000", maxWidth: "100%" }}>
          {/* Top bar chrome */}
          <div style={{ background: "rgba(255,255,255,0.06)", padding: "10px 16px", display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#ff5f57" }} />
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#febc2e" }} />
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#28c840" }} />
            <span style={{ marginLeft: 8, color: "rgba(255,255,255,0.4)", fontSize: 12, fontFamily: "monospace" }}>dxfai.ai — Live Demo</span>
          </div>

          <video
            ref={videoRef}
            src="https://d2xsxph8kpxj0f.cloudfront.net/310519663365044246/hnDFdLkzVGYJYdws9hbnLw/demo-video-v5-final_2f98db64.mp4"
            autoPlay
            muted
            loop
            playsInline
            style={{ width: "100%", display: "block", maxHeight: 520 }}
          />

          {/* Mute/Unmute button overlay */}
          <button
            onClick={toggleMute}
            style={{
              position: "absolute",
              bottom: 16,
              right: 16,
              background: muted ? "rgba(0,0,0,0.65)" : "rgba(99,102,241,0.85)",
              border: "1px solid rgba(255,255,255,0.25)",
              borderRadius: 12,
              padding: "8px 14px",
              color: "#fff",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              backdropFilter: "blur(8px)",
              transition: "all 0.2s",
            }}
          >
            <span style={{ fontSize: 16 }}>{muted ? "🔇" : "🔊"}</span>
            <span>{muted ? (isRtl ? "הפעל שמע" : "Unmute") : (isRtl ? "השתק" : "Mute")}</span>
          </button>
        </div>

        {/* CTA below video */}
        <p style={{ color: "rgba(196,181,253,0.6)", fontSize: 13, marginTop: 20 }}>
          {isRtl ? "לחץ על 🔇 להפעלת השמע" : "Tap 🔇 to enable audio"}
        </p>
      </div>
    </section>
  );
}

// ─── CNC Relief Data ──────────────────────────────────────────────
const CDN2 = "https://d2xsxph8kpxj0f.cloudfront.net/310519663365044246/hnDFdLkzVGYJYdws9hbnLw";
const RELIEF_EXAMPLES = [
  { label_he: "אופנוע", label_en: "Motorcycle", material_he: "עץ אגוז", material_en: "Walnut Wood", before: `${CDN2}/orig-motorcycle_e4c4f289.webp`, after: `${CDN2}/cnc-motorcycle-walnut_ec7213ae.webp` },
  { label_he: "מכונית ספורט", label_en: "Sports Car", material_he: "אלומיניום", material_en: "Aluminum", before: `${CDN2}/orig-sports-car_9f17f872.webp`, after: `${CDN2}/cnc-sports-car-aluminum_ec7d9f80.webp` },
  { label_he: "גיטרה", label_en: "Guitar", material_he: "עץ אורן", material_en: "Pine Wood", before: `${CDN2}/orig-guitar_eabb9155.webp`, after: `${CDN2}/cnc-guitar-pine_4ec8f124.webp` },
  { label_he: "ורדים", label_en: "Roses", material_he: "שיש", material_en: "Marble", before: `${CDN2}/orig-rose-bouquet_1c69bf7c.webp`, after: `${CDN2}/cnc-roses-marble_c15f9585.webp` },
  { label_he: "פנים", label_en: "Face", material_he: "עץ אלון", material_en: "Oak Wood", before: `${CDN2}/orig-woman-face_a39b6b07.webp`, after: `${CDN2}/cnc-face-oak_c69cf858.webp` },
  { label_he: "זאב", label_en: "Wolf", material_he: "נחושת", material_en: "Copper", before: `${CDN2}/orig-wolf_8e9f6a50.webp`, after: `${CDN2}/cnc-wolf-copper_83d08b9a.webp` },
  { label_he: "גולגולת", label_en: "Skull", material_he: "פלדה", material_en: "Steel", before: `${CDN2}/orig-skull_1a339ac1.webp`, after: `${CDN2}/cnc-skull-steel_2fc5d69a.webp` },
  { label_he: "חמניות", label_en: "Sunflowers", material_he: "עץ דובדבן", material_en: "Cherry Wood", before: `${CDN2}/orig-sunflower-field_cd6a538b.webp`, after: `${CDN2}/cnc-sunflowers-cherry_977f3c9e.webp` },
  { label_he: "נוף הרים", label_en: "Mountains", material_he: "גרניט", material_en: "Granite", before: `${CDN2}/orig-mountain-landscape_803fac5a.webp`, after: `${CDN2}/cnc-mountains-granite_c7ef39dd.webp` },
  { label_he: "עיטורים", label_en: "Ornament", material_he: "גרניט", material_en: "Granite", before: `${CDN2}/orig-ornament-color_829ed617.webp`, after: `${CDN2}/cnc-ornament-granite_6037aeb3.webp` },
  { label_he: "מנדלה", label_en: "Mandala", material_he: "עץ אגוז", material_en: "Walnut Wood", before: `${CDN2}/before-mandala_bb9b4278.webp`, after: `${CDN2}/cnc-mandala-walnut_47f8d152.webp` },
];

function ReliefCard({ item, isRtl }: { item: typeof RELIEF_EXAMPLES[0]; isRtl: boolean }) {
  const [showAfter, setShowAfter] = useState(false);
  return (
    <div
      style={{ borderRadius: 16, overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.12)", cursor: "pointer", background: "#1a1a1a", transition: "transform 0.2s, box-shadow 0.2s" }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = "translateY(-4px)"; (e.currentTarget as HTMLDivElement).style.boxShadow = "0 12px 36px rgba(0,0,0,0.28)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = "none"; (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 20px rgba(0,0,0,0.12)"; }}
      onClick={() => setShowAfter(v => !v)}
    >
      <div style={{ position: "relative", width: "100%", paddingBottom: "100%", background: "#111" }}>
        <img
          src={showAfter ? item.after : item.before}
          alt={isRtl ? item.label_he : item.label_en}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", background: showAfter ? "#1a1a1a" : "#f8f8f8", transition: "opacity 0.35s" }}
        />
        <div style={{
          position: "absolute", bottom: 10, left: "50%", transform: "translateX(-50%)",
          background: showAfter ? "rgba(0,0,0,0.75)" : "rgba(255,255,255,0.9)",
          color: showAfter ? "#e5e7eb" : "#1f2937",
          borderRadius: 20, padding: "5px 14px", fontSize: 11, fontWeight: 700,
          backdropFilter: "blur(6px)", whiteSpace: "nowrap",
        }}>
          {showAfter ? (isRtl ? "← חזור למקור" : "← Back to original") : (isRtl ? "👁 הצג תבליט" : "👁 Show Relief")}
        </div>
        {showAfter && (
          <div style={{ position: "absolute", top: 8, right: 8, background: "rgba(0,0,0,0.6)", color: "#d1d5db", borderRadius: 8, padding: "2px 8px", fontSize: 10, fontWeight: 600 }}>
            {isRtl ? item.material_he : item.material_en}
          </div>
        )}
      </div>
      <div style={{ padding: "10px 14px", background: "#1a1a1a" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontWeight: 700, fontSize: 13, color: "#f9fafb" }}>{isRtl ? item.label_he : item.label_en}</span>
          <span style={{ fontSize: 10, color: showAfter ? "#9ca3af" : "#6b7280", fontWeight: 600 }}>
            {showAfter ? (isRtl ? item.material_he : item.material_en) : (isRtl ? "מקור" : "Original")}
          </span>
        </div>
      </div>
    </div>
  );
}

function ReliefSection({ isRtl, onCta }: { isRtl: boolean; onCta: () => void }) {
  const PROCESS_STEPS = isRtl ? [
    { icon: "📷", title: "מעלים תמונה", desc: "מעלים כל תמונה או מתארים בטקסט מה רוצים לגלפ" },
    { icon: "🤖", title: "AI מעבד את התמונה", desc: "ה-AI מזהה עומקים, צללים ופרטים ליצירת מפת גובה (Heightmap) מדויק" },
    { icon: "📁", title: "הורדת קובץ איכותי", desc: "מקבלים PNG 16bit ברזולוציה 3000-4000px — מוכן ל-ArtCAM, Aspire, Fusion 360" },
    { icon: "⚙️", title: "גליפה במכונה", desc: "מכניסים לתוכנת CAM, מגדירים עומק וכלי, והמכונה גולפת תבליט תלת-ממדי" },
  ] : [
    { icon: "📷", title: "Upload Image", desc: "Upload any photo or describe in text what you want to carve" },
    { icon: "🤖", title: "AI Processes", desc: "AI identifies depths, shadows and details to create a precise Heightmap" },
    { icon: "📁", title: "Download HQ File", desc: "Get PNG 16bit at 3000-4000px resolution — ready for ArtCAM, Aspire, Fusion 360" },
    { icon: "⚙️", title: "Machine Carves", desc: "Import to CAM software, set depth and tool, and the machine carves a 3D relief" },
  ];
  return (
    <section style={{ padding: "80px 24px", background: "linear-gradient(160deg,#0f0c29 0%,#1a1a2e 60%,#16213e 100%)", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: -100, left: "10%", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 70%)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: -80, right: "5%", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)", pointerEvents: "none" }} />
      <div style={{ maxWidth: 1100, margin: "0 auto", position: "relative", zIndex: 1 }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 52 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(139,92,246,0.2)", border: "1px solid rgba(139,92,246,0.4)", borderRadius: 20, padding: "6px 16px", marginBottom: 20 }}>
            <span style={{ fontSize: 14 }}>⚙️</span>
            <span style={{ color: "#c4b5fd", fontSize: 13, fontWeight: 600 }}>{isRtl ? "תבליט CNC — Relief Machining" : "CNC Relief — Relief Machining"}</span>
          </div>
          <h2 style={{ fontSize: "clamp(1.5rem,3vw,2.2rem)", fontWeight: 900, color: "#f9fafb", marginBottom: 16, letterSpacing: "-0.02em" }}>
            {isRtl ? "מתמונה לתבליט תלת-ממדי" : "From Image to 3D Relief"}
          </h2>
          <p style={{ color: "#9ca3af", fontSize: "clamp(0.95rem,2vw,1.1rem)", lineHeight: 1.8, maxWidth: 640, margin: "0 auto" }}>
            {isRtl
              ? "ה-AI שלנו ממיר כל תמונה למפת גובה (Heightmap) מדויק ב-16bit — מוכן ישירות לכל תוכנת CAM לגליפת תבליט תלת-ממדי על עץ, אבן, מתכת ועוד"
              : "Our AI converts any image into a precise 16-bit Heightmap — ready for any CAM software to carve a 3D relief on wood, stone, metal and more"}
          </p>
        </div>
        {/* Process steps */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 20, marginBottom: 56 }}>
          {PROCESS_STEPS.map((step, i) => (
            <div key={i} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: "24px 20px", textAlign: "center", backdropFilter: "blur(8px)" }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>{step.icon}</div>
              <div style={{ width: 24, height: 24, borderRadius: "50%", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff", fontWeight: 800, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", margin: "-4px auto 10px" }}>{i + 1}</div>
              <h3 style={{ fontWeight: 700, fontSize: 14, color: "#f9fafb", marginBottom: 8 }}>{step.title}</h3>
              <p style={{ color: "#9ca3af", fontSize: 12, lineHeight: 1.6 }}>{step.desc}</p>
            </div>
          ))}
        </div>
        {/* Gallery */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 16, marginBottom: 40 }}>
          {RELIEF_EXAMPLES.map((item, i) => (
            <ReliefCard key={i} item={item} isRtl={isRtl} />
          ))}
        </div>
        {/* CTA */}
        <div style={{ textAlign: "center" }}>
          <p style={{ color: "#9ca3af", fontSize: 13, marginBottom: 20 }}>
            {isRtl ? "👁 לחץ על כל תמונה לראות את התבליט" : "👁 Click any image to see the relief"}
          </p>
          <button
            onClick={onCta}
            style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff", border: "none", borderRadius: 12, padding: "14px 36px", fontWeight: 800, fontSize: 16, cursor: "pointer", boxShadow: "0 4px 20px rgba(99,102,241,0.4)", transition: "transform 0.15s" }}
            onMouseEnter={e => (e.currentTarget.style.transform = "scale(1.04)")}
            onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")}
          >
            {isRtl ? "צור תבליט עכשיו" : "Create Relief Now"}
          </button>
        </div>
      </div>
    </section>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Landing() {
  const { isRtl, language, setLanguage } = useLanguage();
  const [, navigate] = useLocation();
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("register");
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // If user is already logged in, redirect to workspace
  useEffect(() => {
    fetch("/api/app-auth/me", { credentials: "include" })
      .then(r => r.json())
      .then(d => {
        if (d.user) {
          setIsLoggedIn(true);
          window.location.replace("/");
        }
      })
      .catch(() => {});
  }, []);

  const handleOpenAuth = (mode: "login" | "register" = "register") => {
    setAuthMode(mode);
    setAuthOpen(true);
  };

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
            <img
              src="https://d2xsxph8kpxj0f.cloudfront.net/310519663365044246/hnDFdLkzVGYJYdws9hbnLw/logo-dxfai_99079d72.webp"
              alt="dxfai logo"
              style={{ width: 36, height: 36, borderRadius: 9, objectFit: "cover" }}
            />
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
            <button
              onClick={() => handleOpenAuth("login")}
              style={{ background: "transparent", color: "#6366f1", border: "1.5px solid #6366f1", borderRadius: 10, padding: "7px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
            >
              {isRtl ? "התחבר" : "Log in"}
            </button>
            <button
              onClick={() => handleOpenAuth("register")}
              style={{ display: "flex", alignItems: "center", gap: 8, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff", border: "none", borderRadius: 10, padding: "8px 18px", fontWeight: 700, fontSize: 13, cursor: "pointer", boxShadow: "0 2px 8px rgba(99,102,241,0.35)" }}
            >
              {isRtl ? "הרשמה" : "Sign Up"}
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
          <h1 style={{ color: "#fff", fontSize: "clamp(1.8rem,4.5vw,3rem)", fontWeight: 900, lineHeight: 1.2, marginBottom: 20, letterSpacing: "-0.03em" }}>
            {t.heroTitle}
          </h1>
          {/* Input method icons */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 20, marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.1)", borderRadius: 12, padding: "8px 16px", border: "1px solid rgba(255,255,255,0.15)" }}>
              <Camera size={18} color="#a5b4fc" />
              <span style={{ color: "#c4b5fd", fontSize: 13, fontWeight: 600 }}>{isRtl ? "העלאת תמונה" : "Upload image"}</span>
            </div>
            <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 18, fontWeight: 300 }}>+</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.1)", borderRadius: 12, padding: "8px 16px", border: "1px solid rgba(255,255,255,0.15)" }}>
              <Keyboard size={18} color="#a5b4fc" />
              <span style={{ color: "#c4b5fd", fontSize: 13, fontWeight: 600 }}>{isRtl ? "תיאור בטקסט" : "Text description"}</span>
            </div>
          </div>
          <p style={{ color: "#c4b5fd", fontSize: "clamp(1rem,2.5vw,1.15rem)", lineHeight: 1.7, marginBottom: 36, maxWidth: 580, margin: "0 auto 36px" }}>
            {t.heroSubtitle}
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button
              onClick={() => handleOpenAuth("register")}
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

      {/* ── WAVE DIVIDER: dark → white ── */}
      <div style={{ background: "linear-gradient(160deg,#1e1b4b 0%,#312e81 45%,#4c1d95 100%)", marginBottom: -2 }}>
        <svg viewBox="0 0 1440 80" preserveAspectRatio="none" style={{ display: "block", width: "100%", height: 80 }}>
          <path d="M0,80 C360,0 1080,0 1440,80 L1440,80 L0,80 Z" fill="#fff" />
        </svg>
      </div>

      {/* ── AI CUTTING PATHS SECTION ── */}
      <section style={{ padding: "64px 24px", background: "#fff" }}>
        <div style={{ maxWidth: 860, margin: "0 auto", textAlign: "center" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 20, padding: "6px 16px", marginBottom: 20 }}>
            <Scissors size={14} color="#6366f1" />
            <span style={{ color: "#6366f1", fontSize: 13, fontWeight: 600 }}>{isRtl ? "טכנולוגיית חיתוך מתקדמת" : "Advanced Cutting Technology"}</span>
          </div>
          <h2 style={{ fontSize: "clamp(1.4rem,3vw,2rem)", fontWeight: 800, color: "#1e1b4b", marginBottom: 16, lineHeight: 1.3 }}>
            {isRtl ? "ה-AI שלנו מייצר נתיבי חיתוך אופטימליים וחלקים" : "Our AI generates optimal and smooth cutting paths"}
          </h2>
          <p style={{ color: "#6b7280", fontSize: "clamp(0.95rem,2vw,1.1rem)", lineHeight: 1.8, maxWidth: 680, margin: "0 auto 40px" }}>
            {isRtl
              ? "טכנולוגיית AI ייעודית הלומדת ומפענחת צורות מורכבות כדי לייצר נתיבי חיתוך חלקים, ללא 'רעשים' וקווים מיותרים."
              : "Dedicated AI technology that learns and deciphers complex shapes to generate smooth cutting paths, without 'noise' or unnecessary lines."}
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 24 }}>
            {[
              { icon: <Wand2 size={22} color="#6366f1" />, title: isRtl ? "קווים חלקים" : "Smooth Lines", desc: isRtl ? "האלגוריתם מחליק ומנקה כל קו לתוצאה מושלמת" : "Algorithm smooths and cleans every line for perfect results" },
              { icon: <Scissors size={22} color="#8b5cf6" />, title: isRtl ? "נתיבים רציפים" : "Continuous Paths", desc: isRtl ? "סגירת מסלולים אוטומטית למניעת עצירות בחיתוך" : "Auto path closure to prevent cutting stops" },
              { icon: <Zap size={22} color="#06b6d4" />, title: isRtl ? "ללא רעשים" : "Zero Noise", desc: isRtl ? "מסנן נקודות ופיקסלים מיותרים שמפריעים לחיתוך" : "Filters unnecessary points and pixels that disrupt cutting" },
            ].map((item, i) => (
              <div key={i} style={{ background: "#f8faff", borderRadius: 16, padding: "24px 20px", border: "1px solid #e0e7ff" }}>
                <div style={{ width: 48, height: 48, borderRadius: 14, background: "#ede9fe", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>{item.icon}</div>
                <h3 style={{ fontWeight: 700, fontSize: 15, color: "#1e1b4b", marginBottom: 8 }}>{item.title}</h3>
                <p style={{ color: "#6b7280", fontSize: 13, lineHeight: 1.6 }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TEXT CREATION SECTION ── */}
      <section style={{ padding: "64px 24px", background: "linear-gradient(160deg,#f5f3ff 0%,#ede9fe 100%)" }}>
        <div style={{ maxWidth: 860, margin: "0 auto", textAlign: "center" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.25)", borderRadius: 20, padding: "6px 16px", marginBottom: 20 }}>
            <Keyboard size={14} color="#7c3aed" />
            <span style={{ color: "#7c3aed", fontSize: 13, fontWeight: 600 }}>{isRtl ? "יצירה מטקסט" : "Create from text"}</span>
          </div>
          <h2 style={{ fontSize: "clamp(1.4rem,3vw,2rem)", fontWeight: 800, color: "#1e1b4b", marginBottom: 16, lineHeight: 1.3 }}>
            {isRtl ? "פשוט תארו במילים את מה שברצונכם לייצר" : "Simply describe in words what you want to produce"}
          </h2>
          <p style={{ color: "#6b7280", fontSize: "clamp(0.95rem,2vw,1.1rem)", lineHeight: 1.8, maxWidth: 680, margin: "0 auto 32px" }}>
            {isRtl
              ? "העלו קובץ תמונה או תארו בטקסט חופשי. ה-AI שלנו יצור עבורכם נתיבי חיתוך חלקים ואופטימליים לכל מכונת CNC, לייזר, פלזמה וכל סוג נתב."
              : "Upload an image file or describe in free text. Our AI will create smooth and optimal cutting paths for any CNC machine, laser, plasma, and any type of router."}
          </p>
          <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap", marginBottom: 32 }}>
            {[
              { text: isRtl ? '"מכונית ספורט קלאסית עם כל הפרטים"' : '"Classic sports car with full detail"' },
              { text: isRtl ? '"רחפן עם זרועות, מנועים ומצלמה"' : '"Drone with arms, motors and camera"' },
              { text: isRtl ? '"פנים אריה מפורט עם רעמה"' : '"Detailed lion face with mane"' },
              { text: isRtl ? '"מנוע V8 עם צינורות ובלוקים"' : '"V8 engine with pipes and blocks"' },
            ].map((ex, i) => (
              <div key={i} style={{ background: "white", borderRadius: 10, padding: "10px 18px", border: "1px solid #ddd6fe", color: "#6b7280", fontSize: 13, fontStyle: "italic" }}>
                {ex.text}
              </div>
            ))}
          </div>
          <button
            onClick={() => handleOpenAuth("register")}
            style={{ background: "linear-gradient(135deg,#7c3aed,#6366f1)", color: "#fff", border: "none", borderRadius: 12, padding: "13px 30px", fontWeight: 700, fontSize: 15, cursor: "pointer", boxShadow: "0 4px 16px rgba(124,58,237,0.3)" }}
          >
            {isRtl ? "נסה עכשיו" : "Try now"}
          </button>
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

      {/* ── WHY DXFAI ── */}
      <section style={{ padding: "80px 24px", background: "#fff" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 20, padding: "6px 16px", marginBottom: 20 }}>
              <Sparkles size={13} color="#a5b4fc" />
              <span style={{ color: "#6366f1", fontSize: 13, fontWeight: 600 }}>{isRtl ? "הבחירה של המקצוענים" : "The Professional's Choice"}</span>
            </div>
            <h2 style={{ fontSize: "clamp(1.6rem,3.5vw,2.4rem)", fontWeight: 900, color: "#1e1b4b", marginBottom: 14, letterSpacing: "-0.02em" }}>
              {isRtl ? "למה לבחור ב-DXFai?" : "Why choose DXFai?"}
            </h2>
            <p style={{ color: "#6b7280", fontSize: 16, maxWidth: 560, margin: "0 auto" }}>
              {isRtl ? "5 הכללים שהופכים אותנו לבחירה של המקצוענים" : "5 rules that make us the choice of professionals"}
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {[
              {
                num: "01",
                title: isRtl ? "דיוק גיאומטרי חכם (AI-Native)" : "Smart Geometric Accuracy (AI-Native)",
                desc: isRtl
                  ? "בניגוד לממירים רגילים, ה-AI שלנו מבין צורות. הוא מייצר קשתות חלקות ונתיבים רציפים, מה שמונע \"קפיצות\" של ראש הלייזר ושומר על המכונה שלך."
                  : "Unlike regular converters, our AI understands shapes. It generates smooth arcs and continuous paths, preventing laser head \"jumps\" and protecting your machine.",
                color: "#6366f1",
              },
              {
                num: "02",
                title: isRtl ? "מהדמיון למכונה (Text-to-DXF)" : "From Imagination to Machine (Text-to-DXF)",
                desc: isRtl
                  ? "הכלי היחידי שמאפשר לך ליצור שרטוט מורכב פשוט על ידי תיאור מילולי. אין לך תמונה? פשוט תכתוב מה אתה צריך, וה-AI ישרטוט עבורך."
                  : "The only tool that lets you create a complex drawing simply by describing it in words. No image? Just write what you need, and the AI will draw it for you.",
                color: "#8b5cf6",
              },
              {
                num: "03",
                title: isRtl ? "אופטימיזציה של נתיבי חיתוך" : "Cutting Path Optimization",
                desc: isRtl
                  ? "הקבצים שלנו עוברים \"ניקוי\" אוטומטי מנקודות מיותרות (Nodes) ומרעשים ויזואליים, כך שאתה מקבל קובץ DXF \"רזה\" ומהיר לעיבוד."
                  : "Our files undergo automatic \"cleaning\" from unnecessary nodes and visual noise, so you get a \"lean\" and fast-to-process DXF file.",
                color: "#06b6d4",
              },
              {
                num: "04",
                title: isRtl ? "חיסכון אדיר בזמן עריכה" : "Massive Time Savings on Editing",
                desc: isRtl
                  ? "תשכח משעות של עבודה סיזיפית ב-AutoCAD או Illustrator כדי לסגור מסלולים. עם DXFai, הקובץ מגיע מוכן לעבודה (Ready-to-Cut)."
                  : "Forget hours of tedious work in AutoCAD or Illustrator to close paths. With DXFai, the file arrives ready to work (Ready-to-Cut).",
                color: "#f59e0b",
              },
              {
                num: "05",
                title: isRtl ? "נגישות מכל מקום" : "Access from Anywhere",
                desc: isRtl
                  ? "ללא התקנות כבדות וללא צורך בחומרה חזקה. מעלים תמונה מהסמארטפון בשטח או מהמחשב במשרד, ומורידים קובץ תוך שניות."
                  : "No heavy installations and no need for powerful hardware. Upload an image from your smartphone in the field or from your office computer, and download a file within seconds.",
                color: "#10b981",
              },
            ].map((item, i) => (
              <div key={i} style={{ display: "flex", gap: 24, alignItems: "flex-start", background: "#f9fafb", borderRadius: 16, padding: "24px 28px", border: "1px solid #e5e7eb", transition: "border-color 0.2s" }}>
                <div style={{ flexShrink: 0, width: 48, height: 48, borderRadius: 14, background: `${item.color}22`, border: `1px solid ${item.color}44`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ color: item.color, fontWeight: 900, fontSize: 15, fontFamily: "monospace" }}>{item.num}</span>
                </div>
                <div style={{ flex: 1, textAlign: isRtl ? "right" : "left" }}>
                  <h3 style={{ color: "#111827", fontWeight: 700, fontSize: 16, marginBottom: 8 }}>{item.title}</h3>
                  <p style={{ color: "#6b7280", fontSize: 14, lineHeight: 1.7, margin: 0 }}>{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── COMPATIBLE WITH ── */}
      <section style={{ padding: "52px 24px", background: "#f3f4f6", borderTop: "1px solid #e5e7eb" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", textAlign: "center" }}>
          <p style={{ color: "#6b7280", fontSize: 13, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 32 }}>
            {isRtl ? "תאימות מלאה לכל תוכנות הסטנדרט" : "Compatible With All Standard Software"}
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 40, justifyContent: "center", alignItems: "center" }}>
            {[
              { name: "AutoCAD", svg: `<svg viewBox="0 0 120 40" fill="none" xmlns="http://www.w3.org/2000/svg"><text x="0" y="30" font-family="Arial Black,Arial" font-weight="900" font-size="28" fill="#1f2937">AutoCAD</text></svg>` },
              { name: "LightBurn", svg: `<svg viewBox="0 0 130 40" fill="none" xmlns="http://www.w3.org/2000/svg"><text x="0" y="30" font-family="Arial Black,Arial" font-weight="900" font-size="26" fill="#1f2937">LightBurn</text></svg>` },
              { name: "RDWorks", svg: `<svg viewBox="0 0 120 40" fill="none" xmlns="http://www.w3.org/2000/svg"><text x="0" y="30" font-family="Arial Black,Arial" font-weight="900" font-size="26" fill="#1f2937">RDWorks</text></svg>` },
              { name: "Fusion 360", svg: `<svg viewBox="0 0 140 40" fill="none" xmlns="http://www.w3.org/2000/svg"><text x="0" y="30" font-family="Arial Black,Arial" font-weight="900" font-size="24" fill="#1f2937">Fusion 360</text></svg>` },
              { name: "SolidWorks", svg: `<svg viewBox="0 0 145 40" fill="none" xmlns="http://www.w3.org/2000/svg"><text x="0" y="30" font-family="Arial Black,Arial" font-weight="900" font-size="24" fill="#1f2937">SolidWorks</text></svg>` },
            ].map((sw, i) => (
              <div key={i} style={{ opacity: 0.85, transition: "opacity 0.2s" }}
                onMouseEnter={e => (e.currentTarget.style.opacity = "1")}
                onMouseLeave={e => (e.currentTarget.style.opacity = "0.85")}>
                <span style={{ color: "#1f2937", fontWeight: 800, fontSize: 18, fontFamily: "Arial Black, Arial, sans-serif", letterSpacing: "-0.02em", whiteSpace: "nowrap" }}>{sw.name}</span>
              </div>
            ))}
          </div>
          <p style={{ color: "#4b5563", fontSize: 12, marginTop: 28 }}>
            {isRtl
              ? "שמות התוכנות הם סימני מסחר רשומים של בעליהן. DXFai אינה קשורה לחברות אלו ואינה מוסמכת על ידיהן."
              : "Software names are registered trademarks of their respective owners. DXFai is not affiliated with or endorsed by these companies."}
          </p>
        </div>
      </section>

      {/* ── DEMO VIDEO ── */}
      <DemoVideoSection isRtl={isRtl} />
      {/* ── BEFORE / AFTER GALLERY ── */}
      <section style={{ padding: "72px 24px", background: "#fff" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <h2 style={{ fontSize: "clamp(1.5rem,3vw,2.2rem)", fontWeight: 800, color: "#1e1b4b", marginBottom: 12 }}>{t.galleryTitle}</h2>
            <p style={{ color: "#6b7280", fontSize: 16 }}>{t.gallerySubtitle}</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 20 }}>
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
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 20, maxWidth: 700, margin: "0 auto" }}>
            {PORTRAIT_EXAMPLES.map((item, i) => (
              <PortraitCard key={i} item={item} isRtl={isRtl} />
            ))}
          </div>
          <div style={{ textAlign: "center", marginTop: 36 }}>
            <button
              onClick={() => handleOpenAuth("register")}
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
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 16 }}>
            {AI_EXAMPLES.map((item, i) => (
              <AiExampleCard key={i} item={item} isRtl={isRtl} />
            ))}
          </div>
          <div style={{ textAlign: "center", marginTop: 36 }}>
            <button
              onClick={() => handleOpenAuth("register")}
              style={{ background: "linear-gradient(135deg,#7c3aed,#6366f1)", color: "#fff", border: "none", borderRadius: 12, padding: "13px 32px", fontWeight: 700, fontSize: 15, cursor: "pointer", boxShadow: "0 4px 16px rgba(124,58,237,0.3)" }}
              onMouseEnter={e => (e.currentTarget.style.transform = "scale(1.04)")}
              onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")}
            >
              {t.aiCreateCta}
            </button>
          </div>
        </div>
      </section>

      {/* ── CNC RELIEF SECTION ── */}
      <ReliefSection isRtl={isRtl} onCta={() => handleOpenAuth("register")} />

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
      <section style={{ padding: "100px 24px", background: "linear-gradient(160deg,#1e1b4b 0%,#312e81 100%)", textAlign: "center" }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <h2 style={{ color: "#fff", fontSize: "clamp(2rem,4.5vw,3rem)", fontWeight: 900, marginBottom: 28, letterSpacing: "-0.02em", lineHeight: 1.2 }}>{t.finalCtaTitle}</h2>
          <p style={{ color: "#c4b5fd", fontSize: 18, marginBottom: 48, lineHeight: 1.8 }}>{t.finalCtaSubtitle}</p>
          <button
            onClick={() => handleOpenAuth("register")}
            style={{ background: "linear-gradient(135deg,#7c6fcd,#a78bfa)", color: "#fff", border: "none", borderRadius: 16, padding: "22px 80px", fontWeight: 800, fontSize: 22, cursor: "pointer", boxShadow: "0 8px 32px rgba(124,111,205,0.45)", transition: "transform 0.15s, box-shadow 0.15s", display: "block", margin: "0 auto", minWidth: 280 }}
            onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.04)"; e.currentTarget.style.boxShadow = "0 12px 40px rgba(124,111,205,0.6)"; }}
            onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "0 8px 32px rgba(124,111,205,0.45)"; }}
          >
            {t.finalCtaBtn}
          </button>
          <div style={{ marginTop: 24, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            {/* Shield checkmark icon */}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7L12 2z" fill="rgba(96,165,250,0.2)" stroke="#60a5fa" strokeWidth="1.5"/>
              <path d="M9 12l2 2 4-4" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span style={{ color: "rgba(255,255,255,0.65)", fontSize: 13, fontWeight: 500 }}>רכישה מאובטחת</span>
            {/* PayPal wordmark — clean SVG text */}
            <span style={{ fontFamily: "Arial, sans-serif", fontWeight: 800, fontSize: 15, letterSpacing: "-0.5px" }}>
              <span style={{ color: "#ffffff", fontWeight: 900 }}>Pay</span><span style={{ color: "rgba(255,255,255,0.75)" }}>Pal</span>
            </span>
          </div>
        </div>
      </section>

      {/* ── Auth Dialog ── */}
      <AuthDialog
        open={authOpen}
        onOpenChange={setAuthOpen}
        authReason="unregistered"
        initialMode={authMode}
        onSuccess={() => {
          window.location.replace("/");
        }}
      />

      {/* ── FOOTER ── */}
      <footer style={{ background: "#111827", padding: "32px 24px", textAlign: "center" }}>
        <div style={{ color: "#6b7280", fontSize: 13, lineHeight: 1.8, maxWidth: 700, margin: "0 auto" }}>
          <p style={{ marginBottom: 8 }}>
            {isRtl ? "© 2026 dxfai — כל הזכויות שמורות" : "© 2026 dxfai — All rights reserved"}
            {" · "}
            <a href="/terms" style={{ color: "#9ca3af", textDecoration: "underline" }}>{isRtl ? "תנאי שימוש" : "Terms"}</a>
            {" · "}
            <a href="/privacy" style={{ color: "#9ca3af", textDecoration: "underline" }}>{isRtl ? "פרטיות" : "Privacy"}</a>
          </p>
        </div>
      </footer>
    </div>
  );
}

// ─── Translations ─────────────────────────────────────────────────────────────
const he = {
  navCta: "הרשמה",
  heroBadge: "טכנולוגיית AI מתקדמת",
  heroTitle: "מתמונה או תיאור לקובץ DXF מדויק ומוכן לייצור",
  heroSubtitle: "מעלים תמונה קיימת או מתארים במילים — ה-AI מייצר נתיבי חיתוך אופטימליים לכל מכונת CNC, לייזר, פלזמה או נתב.",
  heroCta1: "צור DXF ראשון",
  heroCta2: "ראה מחירים",
  heroTrust: "רכישה מאובטחת PayPal",
  howTitle: "איך זה עובד?",
  howSubtitle: "3 שלבים פשוטים מהרעיון שלך ועד לחיתוך במכונה",
  steps: [
    { title: "בוחרים איך להתחיל", desc: "מעלים תמונה קיימת (לוגו, סקיצה או צילום) או פשוט כותבים בטקסט חופשי מה תרצו לייצר — למשל: \"מגן דוד עם עיטורי פרחים\" או \"שלט לדלת עם שם משפחה\"." },
    { title: "ה-AI יוצר ומבצע אופטימיזציה", desc: "האלגוריתם המתקדם בונה את הווקטור מאפס או מנקה את התמונה הקיימת. הוא מחליק קווים, סוגר מסלולים ומבטיח נתיבי חיתוך רציפים ואופטימליים ללא \"רעשים\"." },
    { title: "מורידים קובץ DXF מוכן", desc: "מקבלים קובץ תקני, נקי ומדויק שמתאים ב-100% לכל תוכנות ה-CNC, הלייזר והפלזמה — RDWorks, LightBurn, AutoCAD ועוד." },
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
    { title: "תמיכה במגוון שפות", desc: "ממשק בעברית, אנגלית, רוסית ועוד מגוון שפות." },
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
  finalCtaTitle: "צור את הקובץ הראשון שלך",
  finalCtaSubtitle: "צור את הקובץ DXF הראשון שלך",
  finalCtaBtn: "הרשמה",
  finalCtaTrust: "ללא כרטיס אשראי · רכישה מאובטחת PayPal",
};

const en = {
  navCta: "Sign Up",
  heroBadge: "Advanced AI Technology",
  heroTitle: "From image or description to precise DXF ready for production",
  heroSubtitle: "Upload an existing image or describe in words — AI generates optimal cutting paths for any CNC, laser, plasma, or router machine.",
  heroCta1: "Create Your First DXF",
  heroCta2: "See Pricing",
  heroTrust: "Secure PayPal checkout",
  howTitle: "How does it work?",
  howSubtitle: "3 simple steps from your idea to machine cutting",
  steps: [
    { title: "Choose how to start", desc: "Upload an existing image (logo, sketch or photo) or simply write in free text what you want to produce — e.g. \"Star of David with floral ornaments\" or \"Door sign with family name\"." },
    { title: "AI creates & optimizes", desc: "Our advanced algorithm builds the vector from scratch or cleans the existing image. It smooths lines, closes paths and ensures continuous, optimal cutting paths without \"noise\"." },
    { title: "Download ready DXF file", desc: "Get a standard, clean and precise file that is 100% compatible with all CNC, laser and plasma software — RDWorks, LightBurn, AutoCAD and more." },
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
    { title: "Multi-language support", desc: "Interface available in Hebrew, English, Russian and more languages." },
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
  finalCtaTitle: "Create Your First File",
  finalCtaSubtitle: "Create your first DXF file",
  finalCtaBtn: "Sign Up",
  finalCtaTrust: "No credit card · Secure PayPal checkout",
};

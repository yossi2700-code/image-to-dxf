import { Link } from "wouter";

const MANDALA_GIF = "https://d2xsxph8kpxj0f.cloudfront.net/310519663365044246/hnDFdLkzVGYJYdws9hbnLw/mandala-before-after_6f1d5e8d.gif";
const LION_GIF    = "https://d2xsxph8kpxj0f.cloudfront.net/310519663365044246/hnDFdLkzVGYJYdws9hbnLw/lion-before-after_6ca2fe6a.gif";
const SITE_URL    = "https://dxfai.ai";

export default function Promo() {
  return (
    <div
      dir="rtl"
      style={{
        minHeight: "100vh",
        background: "linear-gradient(160deg, #0d0d1a 0%, #1a0a2e 40%, #0d1a2e 100%)",
        fontFamily: "'Segoe UI', Arial, Helvetica, sans-serif",
        color: "#fff",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "0 16px 60px",
      }}
    >
      {/* Top badge */}
      <div style={{ width: "100%", maxWidth: 640, paddingTop: 36, textAlign: "center" }}>
        <div
          style={{
            display: "inline-block",
            background: "rgba(124,58,237,0.2)",
            border: "1px solid rgba(167,139,250,0.45)",
            borderRadius: 50,
            padding: "7px 22px",
            marginBottom: 22,
            fontSize: 13,
            color: "#c4b5fd",
            letterSpacing: 1,
          }}
        >
          ✦ &nbsp;AI DXF — dxfai.ai
        </div>

        {/* Hero headline */}
        <h1
          style={{
            fontSize: "clamp(28px, 7vw, 46px)",
            fontWeight: 900,
            margin: "0 0 14px",
            lineHeight: 1.2,
            background: "linear-gradient(90deg, #a78bfa 0%, #60a5fa 60%, #34d399 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          הפכו כל תמונה לקובץ DXF
          <br />
          תוך שניות — עם AI
        </h1>

        <p style={{ fontSize: 16, color: "#94a3b8", margin: "0 0 8px", lineHeight: 1.7 }}>
          מושלם לחיתוך לייזר · CNC · עיבוד מתכת
        </p>
        <p style={{ fontSize: 14, color: "#7c3aed", margin: "0 0 36px", fontWeight: 700 }}>
          ↓ ראו את הקסם בפעולה ↓
        </p>
      </div>

      {/* GIF 1 — Mandala */}
      <GifCard
        gif={MANDALA_GIF}
        label="מנדלה — לחיתוך לייזר"
        caption="עיצוב מנדלה צבעוני → קובץ DXF מוכן לחיתוך"
        accentColor="#a78bfa"
      />

      {/* GIF 2 — Lion */}
      <GifCard
        gif={LION_GIF}
        label="פורטרט אריה — חריטה"
        caption="תמונת אריה מציאותית → קווי חריטה מדויקים"
        accentColor="#fb923c"
      />

      {/* Feature pills */}
      <div
        style={{
          width: "100%",
          maxWidth: 640,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
          margin: "8px 0 36px",
        }}
      >
        {[
          { icon: "⚡", title: "30 שניות", desc: "מהתמונה לקובץ DXF" },
          { icon: "🎯", title: "קווים נקיים", desc: "מדויק לייצור" },
          { icon: "🔧", title: "תואם לכל תוכנה", desc: "AutoCAD, LightBurn ועוד" },
          { icon: "🤖", title: "AI חכם", desc: "מזהה צורות אוטומטית" },
        ].map((f) => (
          <div
            key={f.title}
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(167,139,250,0.18)",
              borderRadius: 16,
              padding: "16px 14px",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 26, marginBottom: 6 }}>{f.icon}</div>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 3 }}>{f.title}</div>
            <div style={{ fontSize: 12, color: "#64748b" }}>{f.desc}</div>
          </div>
        ))}
      </div>

      {/* CTA Button */}
      <div style={{ width: "100%", maxWidth: 640, textAlign: "center", marginBottom: 28 }}>
        <a
          href={SITE_URL}
          style={{
            display: "block",
            background: "linear-gradient(135deg, #7c3aed 0%, #4338ca 100%)",
            color: "#fff",
            fontWeight: 800,
            fontSize: 19,
            padding: "20px 32px",
            borderRadius: 50,
            textDecoration: "none",
            boxShadow: "0 8px 40px rgba(124,58,237,0.55)",
            marginBottom: 10,
          }}
        >
          נסה עכשיו — 10 אסימונים חינם »
        </a>
        <p style={{ fontSize: 12, color: "#475569" }}>
          ללא כרטיס אשראי · מיידי · dxfai.ai
        </p>
      </div>

      {/* Testimonial */}
      <div
        style={{
          width: "100%",
          maxWidth: 640,
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(167,139,250,0.15)",
          borderRadius: 20,
          padding: "22px 26px",
          textAlign: "center",
          marginBottom: 32,
        }}
      >
        <div style={{ fontSize: 20, marginBottom: 10 }}>⭐⭐⭐⭐⭐</div>
        <p style={{ fontSize: 14, color: "#cbd5e1", lineHeight: 1.75, margin: "0 0 10px" }}>
          "שלחתי תמונה של לוגו ותוך 20 שניות קיבלתי קובץ DXF מושלם לחיתוך לייזר.
          חסך לי שעות עבודה!"
        </p>
        <p style={{ fontSize: 12, color: "#475569", margin: 0 }}>— גל ז., מפעיל CNC</p>
      </div>

      {/* Back link */}
      <Link href="/" style={{ color: "#6366f1", fontSize: 13, textDecoration: "none" }}>
        ← חזרה לאתר הראשי
      </Link>
    </div>
  );
}

// ─── GIF Card Component ───────────────────────────────────────────────────────

function GifCard({
  gif,
  label,
  caption,
  accentColor,
}: {
  gif: string;
  label: string;
  caption: string;
  accentColor: string;
}) {
  return (
    <div
      style={{
        width: "100%",
        maxWidth: 640,
        marginBottom: 28,
      }}
    >
      {/* Label above */}
      <div
        style={{
          display: "inline-block",
          background: `${accentColor}22`,
          border: `1px solid ${accentColor}66`,
          borderRadius: 50,
          padding: "5px 16px",
          fontSize: 13,
          color: accentColor,
          fontWeight: 700,
          marginBottom: 10,
        }}
      >
        {label}
      </div>

      {/* GIF container */}
      <div
        style={{
          borderRadius: 20,
          overflow: "hidden",
          boxShadow: `0 0 50px ${accentColor}44, 0 16px 50px rgba(0,0,0,0.5)`,
          border: `2px solid ${accentColor}44`,
          position: "relative",
        }}
      >
        <img
          src={gif}
          alt={label}
          style={{ width: "100%", display: "block" }}
          loading="lazy"
        />
        {/* Bottom overlay */}
        <div
          style={{
            position: "absolute",
            bottom: 14,
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(0,0,0,0.65)",
            backdropFilter: "blur(6px)",
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: 50,
            padding: "5px 16px",
            fontSize: 12,
            color: "#e2e8f0",
            whiteSpace: "nowrap",
          }}
        >
          ← גרור לראות לפני / אחרי
        </div>
      </div>

      <p style={{ fontSize: 12, color: "#475569", textAlign: "center", marginTop: 8 }}>
        {caption}
      </p>
    </div>
  );
}

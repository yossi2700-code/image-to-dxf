import { useEffect, useState } from "react";

const BUTTERFLY_IMG = "https://d2xsxph8kpxj0f.cloudfront.net/310519663365044246/hnDFdLkzVGYJYdws9hbnLw/before-after-butterfly-JGTRb3W3JyRGncTEJNbZNn.webp";
const PARROT_IMG = "https://d2xsxph8kpxj0f.cloudfront.net/310519663365044246/hnDFdLkzVGYJYdws9hbnLw/before-after-parrot-V2SyKT5B8gKcum3rQXnaVo.webp";
const BOTTLE_IMG = "https://d2xsxph8kpxj0f.cloudfront.net/310519663365044246/hnDFdLkzVGYJYdws9hbnLw/before-after-bottle-W6htTBxD25Xx45PEobDDAU.webp";
const FLOWER_IMG = "https://d2xsxph8kpxj0f.cloudfront.net/310519663365044246/hnDFdLkzVGYJYdws9hbnLw/before-after-flower-jEbBiuCtPGgAmLQLPA24WN.webp";
const BIKE_IMG = "https://d2xsxph8kpxj0f.cloudfront.net/310519663365044246/hnDFdLkzVGYJYdws9hbnLw/before-after-bike-Zo6kmezpPh3J6smmgb3hYT.webp";

const SITE_URL = "https://dxfai.net";

export default function Marketing() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      dir="rtl"
      style={{
        fontFamily: "'Segoe UI', 'Arial Hebrew', Arial, sans-serif",
        background: "linear-gradient(135deg, #0a0f1e 0%, #0d1b3e 50%, #0a0f1e 100%)",
        minHeight: "100vh",
        color: "#fff",
        overflowX: "hidden",
      }}
    >
      {/* Hero Section */}
      <div
        style={{
          textAlign: "center",
          padding: "80px 24px 60px",
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0)" : "translateY(30px)",
          transition: "all 0.8s ease",
        }}
      >
        {/* Logo / Brand */}
        <div style={{ marginBottom: 24 }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              background: "rgba(6, 182, 212, 0.12)",
              border: "1px solid rgba(6, 182, 212, 0.3)",
              borderRadius: 50,
              padding: "8px 20px",
              fontSize: 14,
              color: "#06b6d4",
              letterSpacing: 1,
              fontWeight: 600,
            }}
          >
            ✦ כלי AI חדשני לעיצוב וחיתוך לייזר
          </span>
        </div>

        <h1
          style={{
            fontSize: "clamp(2.2rem, 6vw, 4rem)",
            fontWeight: 900,
            lineHeight: 1.15,
            marginBottom: 20,
            background: "linear-gradient(135deg, #ffffff 0%, #06b6d4 60%, #3b82f6 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          הפוך כל תמונה לקובץ DXF
          <br />
          בשניות — עם AI
        </h1>

        <p
          style={{
            fontSize: "clamp(1rem, 2.5vw, 1.25rem)",
            color: "rgba(255,255,255,0.7)",
            maxWidth: 600,
            margin: "0 auto 40px",
            lineHeight: 1.7,
          }}
        >
          מושלם לחיתוך לייזר, CNC וגרביר. העלה תמונה — קבל קובץ וקטורי מדויק.
          ללא תוכנה, ללא ידע טכני.
        </p>

        <a
          href={SITE_URL}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-block",
            background: "linear-gradient(135deg, #06b6d4, #3b82f6)",
            color: "#fff",
            padding: "16px 48px",
            borderRadius: 50,
            fontSize: "1.1rem",
            fontWeight: 700,
            textDecoration: "none",
            boxShadow: "0 8px 32px rgba(6, 182, 212, 0.4)",
            transition: "transform 0.2s, box-shadow 0.2s",
            letterSpacing: 0.5,
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLAnchorElement).style.transform = "translateY(-2px)";
            (e.currentTarget as HTMLAnchorElement).style.boxShadow = "0 12px 40px rgba(6, 182, 212, 0.6)";
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLAnchorElement).style.transform = "translateY(0)";
            (e.currentTarget as HTMLAnchorElement).style.boxShadow = "0 8px 32px rgba(6, 182, 212, 0.4)";
          }}
        >
          נסה בחינם עכשיו ←
        </a>

        <p style={{ marginTop: 14, fontSize: 13, color: "rgba(255,255,255,0.4)" }}>
          20 אסימונים חינם בהרשמה · ללא כרטיס אשראי
        </p>
      </div>

      {/* Before/After Gallery */}
      <div style={{ padding: "0 24px 80px", maxWidth: 1100, margin: "0 auto" }}>
        <h2
          style={{
            textAlign: "center",
            fontSize: "clamp(1.4rem, 3vw, 2rem)",
            fontWeight: 800,
            marginBottom: 12,
            color: "#fff",
          }}
        >
          ראה את הקסם בעצמך
        </h2>
        <p style={{ textAlign: "center", color: "rgba(255,255,255,0.5)", marginBottom: 40, fontSize: 15 }}>
          תמונה רגילה → קובץ DXF מוכן לחיתוך
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: 24,
          }}
        >
          {[
            { img: BUTTERFLY_IMG, label: "פרפר — דפוסי כנפיים" },
            { img: PARROT_IMG, label: "תוכי — פרטי נוצות" },
            { img: BOTTLE_IMG, label: "בקבוק — עיצוב תעשייתי" },
            { img: FLOWER_IMG, label: "פרח — קווים עדינים" },
            { img: BIKE_IMG, label: "אופניים — מבנה מדויק" },
          ].map((item, i) => (
            <div
              key={i}
              style={{
                borderRadius: 16,
                overflow: "hidden",
                border: "1px solid rgba(6, 182, 212, 0.2)",
                boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
                opacity: visible ? 1 : 0,
                transform: visible ? "translateY(0)" : "translateY(40px)",
                transition: `all 0.8s ease ${0.2 + i * 0.15}s`,
              }}
            >
              <img
                src={item.img}
                alt={item.label}
                style={{ width: "100%", display: "block" }}
                loading="lazy"
              />
              <div
                style={{
                  background: "rgba(6, 182, 212, 0.08)",
                  padding: "12px 16px",
                  fontSize: 14,
                  color: "rgba(255,255,255,0.7)",
                  textAlign: "center",
                  borderTop: "1px solid rgba(6, 182, 212, 0.15)",
                }}
              >
                {item.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Features */}
      <div
        style={{
          background: "rgba(255,255,255,0.03)",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          padding: "60px 24px",
        }}
      >
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <h2
            style={{
              textAlign: "center",
              fontSize: "clamp(1.4rem, 3vw, 2rem)",
              fontWeight: 800,
              marginBottom: 48,
              color: "#fff",
            }}
          >
            למה לבחור ב-AI DXF?
          </h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 24,
            }}
          >
            {[
              { icon: "⚡", title: "מהיר", desc: "תוצאה תוך שניות, לא שעות" },
              { icon: "🎯", title: "מדויק", desc: "קווים נקיים מוכנים לחיתוך לייזר" },
              { icon: "🌐", title: "מכל מקום", desc: "עובד ישירות בדפדפן, ללא התקנה" },
              { icon: "🔒", title: "מאובטח", desc: "הקבצים שלך פרטיים ומוגנים" },
            ].map((f, i) => (
              <div
                key={i}
                style={{
                  background: "rgba(6, 182, 212, 0.06)",
                  border: "1px solid rgba(6, 182, 212, 0.15)",
                  borderRadius: 16,
                  padding: "28px 24px",
                  textAlign: "center",
                  opacity: visible ? 1 : 0,
                  transform: visible ? "translateY(0)" : "translateY(20px)",
                  transition: `all 0.7s ease ${0.4 + i * 0.1}s`,
                }}
              >
                <div style={{ fontSize: 36, marginBottom: 12 }}>{f.icon}</div>
                <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 8, color: "#06b6d4" }}>{f.title}</div>
                <div style={{ fontSize: 14, color: "rgba(255,255,255,0.6)", lineHeight: 1.6 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Steps */}
      <div style={{ padding: "60px 24px", maxWidth: 800, margin: "0 auto" }}>
        <h2
          style={{
            textAlign: "center",
            fontSize: "clamp(1.4rem, 3vw, 2rem)",
            fontWeight: 800,
            marginBottom: 48,
            color: "#fff",
          }}
        >
          3 צעדים פשוטים
        </h2>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {[
            { step: "1", title: "העלה תמונה", desc: "JPG, PNG, WEBP — כל פורמט נתמך" },
            { step: "2", title: "AI מעבד", desc: "המערכת מזהה קווים ומייצרת וקטור מדויק" },
            { step: "3", title: "הורד DXF", desc: "קובץ מוכן לחיתוך לייזר, CNC או גרביר" },
          ].map((s, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 20,
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 16,
                padding: "24px 28px",
                opacity: visible ? 1 : 0,
                transform: visible ? "translateX(0)" : "translateX(30px)",
                transition: `all 0.7s ease ${0.5 + i * 0.15}s`,
              }}
            >
              <div
                style={{
                  minWidth: 48,
                  height: 48,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #06b6d4, #3b82f6)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 20,
                  fontWeight: 900,
                  flexShrink: 0,
                }}
              >
                {s.step}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 4, color: "#fff" }}>{s.title}</div>
                <div style={{ fontSize: 14, color: "rgba(255,255,255,0.55)", lineHeight: 1.6 }}>{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA Bottom */}
      <div
        style={{
          textAlign: "center",
          padding: "60px 24px 80px",
          background: "linear-gradient(180deg, transparent, rgba(6, 182, 212, 0.06))",
        }}
      >
        <h2
          style={{
            fontSize: "clamp(1.6rem, 4vw, 2.5rem)",
            fontWeight: 900,
            marginBottom: 16,
            color: "#fff",
          }}
        >
          מוכן להתחיל?
        </h2>
        <p style={{ color: "rgba(255,255,255,0.6)", marginBottom: 32, fontSize: 16 }}>
          הצטרף לאלפי מעצבים שכבר משתמשים ב-AI DXF
        </p>
        <a
          href={SITE_URL}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-block",
            background: "linear-gradient(135deg, #06b6d4, #3b82f6)",
            color: "#fff",
            padding: "18px 56px",
            borderRadius: 50,
            fontSize: "1.15rem",
            fontWeight: 700,
            textDecoration: "none",
            boxShadow: "0 8px 32px rgba(6, 182, 212, 0.4)",
            letterSpacing: 0.5,
          }}
        >
          כנס לאתר — dxfai.net ←
        </a>
      </div>

      {/* Footer */}
      <div
        style={{
          textAlign: "center",
          padding: "20px 24px",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          fontSize: 13,
          color: "rgba(255,255,255,0.3)",
        }}
      >
        © 2025 AI DXF · <a href={SITE_URL} style={{ color: "rgba(6, 182, 212, 0.6)", textDecoration: "none" }}>dxfai.net</a>
      </div>
    </div>
  );
}

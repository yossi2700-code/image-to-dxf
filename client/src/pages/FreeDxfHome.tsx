/**
 * FreeDXF Home — community free DXF files page at /free
 * Teal/Emerald color scheme — distinct from main site purple but same brand style
 */
import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Search, ArrowRight, Download, Layers, Sparkles, ArrowLeft, Eye, Gift, Zap } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface SharedFile {
  id: number;
  title: string | null;
  titleHe: string | null;
  description: string | null;
  descriptionHe: string | null;
  category: string | null;
  tags: string | null;
  feature: string | null;
  previewImageUrl: string | null;
  svgPreview?: string | null;
  lineCount: number | null;
  downloadCount: number | null;
  createdAt: string;
}

interface Category {
  name: string;
  count: number;
}

/* Category icon mapping */
const CATEGORY_ICONS: Record<string, string> = {
  "Decorative": "🎨",
  "Signs": "🪧",
  "Logos": "✨",
  "Mechanical": "⚙️",
  "Animals": "🦁",
  "Nature": "🌿",
  "Geometric": "🔷",
  "Text & Letters": "🔤",
  "CNC Relief": "🏔️",
  "Jewish & Holiday": "✡️",
  "Architecture": "🏛️",
  "Automotive": "🚗",
  "Other": "📁",
};

/* ── Color Palette (Teal/Emerald) ── */
const C = {
  // Hero gradient
  heroFrom: "#042f2e",     // teal-950
  heroMid: "#134e4a",      // teal-900
  heroTo: "#0d9488",       // teal-600
  // Accents
  accent: "#0d9488",       // teal-600
  accentLight: "#14b8a6",  // teal-500
  accentDark: "#0f766e",   // teal-700
  accentBg: "#f0fdfa",     // teal-50
  accentBg2: "#ccfbf1",    // teal-100
  accentBorder: "#99f6e4",  // teal-200
  accentText: "#115e59",   // teal-800
  // Glow
  glow1: "rgba(20,184,166,0.3)",
  glow2: "rgba(13,148,136,0.25)",
  // Shadows
  shadow: "rgba(13,148,136,0.25)",
  shadowDeep: "rgba(13,148,136,0.3)",
  // Hover overlay
  overlay: "rgba(13,148,136,0.06)",
  // CTA gradient
  ctaFrom: "#f0fdfa",
  ctaMid: "#ccfbf1",
  ctaTo: "#e0f2fe",
  // Button gradient
  btnFrom: "#0d9488",
  btnTo: "#0891b2",        // cyan-600
};

export default function FreeDxfHome() {
  const { language, t } = useLanguage();
  const isRtl = language === "he";
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [files, setFiles] = useState<SharedFile[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalFiles, setTotalFiles] = useState(0);

  useEffect(() => {
    async function load() {
      try {
        const [filesRes, catsRes] = await Promise.all([
          fetch("/api/freedxf/files?limit=12").then(r => r.json()),
          fetch("/api/freedxf/categories").then(r => r.json()),
        ]);
        setFiles(filesRes.files || []);
        setTotalFiles(filesRes.total || 0);
        setCategories(catsRes.categories || []);
      } catch (err) {
        console.error("Failed to load:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (search.trim()) {
      navigate(`/free/browse?search=${encodeURIComponent(search.trim())}`);
    }
  };

  const getTitle = (file: SharedFile) =>
    (language === "he" && file.titleHe) ? file.titleHe : (file.title || "Untitled");

  return (
    <div className="min-h-screen bg-white" dir={isRtl ? "rtl" : "ltr"}>
      {/* ── Top Bar ── */}
      <div style={{ background: "#fff", borderBottom: "1px solid #f0f0f5" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "10px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", color: "#6b7280", fontSize: 13, fontWeight: 500 }}>
            <ArrowLeft style={{ width: 16, height: 16 }} />
            {isRtl ? "חזרה לכלי העיצוב" : "Back to Design Tools"}
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 24, height: 24, borderRadius: 6, background: `linear-gradient(135deg, ${C.accent}, ${C.btnTo})`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: "#fff", fontWeight: 800, fontSize: 8 }}>DXF</span>
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.heroFrom }}>FreeDXF</span>
          </div>
        </div>
      </div>

      {/* ── Hero Section ── */}
      <section style={{
        background: `linear-gradient(160deg, ${C.heroFrom} 0%, ${C.heroMid} 30%, ${C.accentDark} 60%, ${C.heroTo} 100%)`,
        position: "relative",
        overflow: "hidden",
      }}>
        {/* Decorative elements */}
        <div style={{ position: "absolute", inset: 0, opacity: 0.07 }}>
          <div style={{ position: "absolute", top: 40, left: "10%", width: 200, height: 200, border: "1px solid #fff", borderRadius: "50%" }} />
          <div style={{ position: "absolute", bottom: 20, right: "15%", width: 300, height: 300, border: "1px solid #fff", borderRadius: "50%" }} />
          <div style={{ position: "absolute", top: "50%", left: "60%", width: 120, height: 120, border: "1px solid #fff", transform: "rotate(45deg)" }} />
          <div style={{ position: "absolute", top: "20%", right: "5%", width: 80, height: 80, border: "1px solid #fff", borderRadius: "50%" }} />
        </div>

        {/* Glowing orbs */}
        <div style={{ position: "absolute", top: -80, left: "20%", width: 250, height: 250, borderRadius: "50%", background: `radial-gradient(circle, ${C.glow1} 0%, transparent 70%)` }} />
        <div style={{ position: "absolute", bottom: -60, right: "10%", width: 200, height: 200, borderRadius: "50%", background: `radial-gradient(circle, ${C.glow2} 0%, transparent 70%)` }} />

        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "60px 20px 70px", position: "relative" }}>
          <div style={{ textAlign: "center", maxWidth: 700, margin: "0 auto" }}>
            {/* Badge */}
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.1)", backdropFilter: "blur(10px)", borderRadius: 20, padding: "6px 16px", marginBottom: 20, border: "1px solid rgba(255,255,255,0.15)" }}>
              <Gift style={{ width: 14, height: 14, color: C.accentBorder }} />
              <span style={{ color: C.accentBorder, fontWeight: 600, fontSize: 12, letterSpacing: "0.02em" }}>
                {isRtl ? "100% חינם — ללא הגבלה" : "100% Free — No Limits"}
              </span>
            </div>

            <h1 style={{
              fontSize: "clamp(2rem, 5vw, 3.5rem)",
              fontWeight: 900,
              color: "#fff",
              marginBottom: 12,
              letterSpacing: "-0.03em",
              lineHeight: 1.1,
            }}>
              {isRtl ? "קבצי DXF בחינם" : "Free DXF Files"}
            </h1>
            <h2 style={{
              fontSize: "clamp(1.1rem, 2.5vw, 1.5rem)",
              fontWeight: 400,
              color: "rgba(255,255,255,0.75)",
              marginBottom: 10,
              lineHeight: 1.4,
            }}>
              {isRtl ? "לחיתוך CNC, לייזר ופלזמה" : "For CNC, Laser & Plasma Cutting"}
            </h2>
            <p style={{
              fontSize: 15,
              color: "rgba(255,255,255,0.55)",
              marginBottom: 32,
              maxWidth: 500,
              margin: "0 auto 32px",
              lineHeight: 1.6,
            }}>
              {isRtl
                ? "הורידו קבצי DXF מוכנים לחיתוך — עיצובים, לוגואים, דקורציה ועוד. הכל נוצר עם AI ב-dxfai.ai."
                : "Download ready-to-cut DXF files — designs, logos, decorations and more. All created with AI at dxfai.ai."}
            </p>

            {/* Search bar */}
            <form onSubmit={handleSearch} style={{ maxWidth: 520, margin: "0 auto" }}>
              <div style={{ position: "relative" }}>
                <Search style={{ position: "absolute", [isRtl ? "right" : "left"]: 16, top: "50%", transform: "translateY(-50%)", width: 18, height: 18, color: "#9ca3af" }} />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={isRtl ? "חפשו עיצובים, לוגואים, דקורציה..." : "Search designs, logos, decorations..."}
                  style={{
                    width: "100%",
                    padding: isRtl ? "16px 48px 16px 120px" : "16px 120px 16px 48px",
                    borderRadius: 16,
                    background: "#fff",
                    color: "#1f2937",
                    fontSize: 15,
                    border: "none",
                    outline: "none",
                    boxShadow: `0 8px 32px rgba(0,0,0,0.15), 0 0 0 1px rgba(255,255,255,0.1)`,
                    direction: isRtl ? "rtl" : "ltr",
                  }}
                />
                <button
                  type="submit"
                  style={{
                    position: "absolute",
                    [isRtl ? "left" : "right"]: 6,
                    top: "50%",
                    transform: "translateY(-50%)",
                    padding: "10px 20px",
                    borderRadius: 12,
                    background: `linear-gradient(135deg, ${C.btnFrom}, ${C.btnTo})`,
                    color: "#fff",
                    fontSize: 13,
                    fontWeight: 600,
                    border: "none",
                    cursor: "pointer",
                    boxShadow: `0 2px 8px ${C.shadow}`,
                  }}
                >
                  {isRtl ? "חיפוש" : "Search"}
                </button>
              </div>
            </form>

            {/* Stats */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 24, marginTop: 28, flexWrap: "wrap" }}>
              {[
                { icon: <Download style={{ width: 15, height: 15 }} />, text: `${totalFiles} ${isRtl ? "קבצים" : "files"}` },
                { icon: <Layers style={{ width: 15, height: 15 }} />, text: `${categories.length} ${isRtl ? "קטגוריות" : "categories"}` },
                { icon: <Sparkles style={{ width: 15, height: 15 }} />, text: `100% ${isRtl ? "חינם" : "free"}` },
              ].map((stat, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, color: "rgba(255,255,255,0.55)", fontSize: 13 }}>
                  {stat.icon}
                  <span>{stat.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Categories Grid ── */}
      {categories.length > 0 && (
        <section style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 20px 20px" }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: C.heroFrom, marginBottom: 16 }}>
            {isRtl ? "קטגוריות" : "Categories"}
          </h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <Link
              href="/free/browse"
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "8px 18px", borderRadius: 20,
                background: `linear-gradient(135deg, ${C.btnFrom}, ${C.btnTo})`, color: "#fff",
                fontSize: 13, fontWeight: 600, textDecoration: "none",
                boxShadow: `0 2px 8px ${C.shadow}`,
                transition: "all 0.15s",
              }}
            >
              {isRtl ? "הכל" : "All"} ({totalFiles})
            </Link>
            {categories.map((cat) => (
              <Link
                key={cat.name}
                href={`/free/browse?category=${encodeURIComponent(cat.name)}`}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "8px 16px", borderRadius: 20,
                  background: "#f9fafb", color: "#4b5563",
                  fontSize: 13, fontWeight: 500, textDecoration: "none",
                  border: "1px solid #e5e7eb",
                  transition: "all 0.15s",
                }}
                onMouseEnter={e => { e.currentTarget.style.background = C.accentBg; e.currentTarget.style.color = C.accent; e.currentTarget.style.borderColor = C.accentBorder; }}
                onMouseLeave={e => { e.currentTarget.style.background = "#f9fafb"; e.currentTarget.style.color = "#4b5563"; e.currentTarget.style.borderColor = "#e5e7eb"; }}
              >
                <span>{CATEGORY_ICONS[cat.name] || "📁"}</span>
                {cat.name} ({cat.count})
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── Latest Files Grid ── */}
      <section style={{ maxWidth: 1200, margin: "0 auto", padding: "20px 20px 60px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: C.heroFrom }}>
            {isRtl ? "קבצים אחרונים" : "Latest Files"}
          </h2>
          <Link
            href="/free/browse"
            style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, fontWeight: 600, color: C.accent, textDecoration: "none" }}
          >
            {isRtl ? "לכל הקבצים" : "Browse All"}
            <ArrowRight style={{ width: 14, height: 14 }} />
          </Link>
        </div>

        {loading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} style={{ background: "#f3f4f6", borderRadius: 16, aspectRatio: "1", animation: "pulse 1.5s ease-in-out infinite" }} />
            ))}
          </div>
        ) : files.length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
            {files.map((file) => (
              <FileCard key={file.id} file={file} getTitle={getTitle} isRtl={isRtl} />
            ))}
          </div>
        ) : (
          /* Empty state */
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <div style={{
              width: 80, height: 80, borderRadius: 20,
              background: `linear-gradient(135deg, ${C.accentBg}, ${C.accentBg2})`,
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 20px",
            }}>
              <Layers style={{ width: 36, height: 36, color: C.accentBorder }} />
            </div>
            <h3 style={{ fontSize: 20, fontWeight: 700, color: C.heroFrom, marginBottom: 8 }}>
              {isRtl ? "אין קבצים עדיין" : "No files yet"}
            </h3>
            <p style={{ fontSize: 14, color: "#9ca3af", marginBottom: 24, maxWidth: 400, margin: "0 auto 24px", lineHeight: 1.6 }}>
              {isRtl
                ? "היו הראשונים לשתף קובץ DXF! צרו עיצוב עם הכלים שלנו ושתפו אותו עם הקהילה."
                : "Be the first to share a DXF file! Create a design with our tools and share it with the community."}
            </p>
            <Link
              href="/"
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "12px 28px", borderRadius: 12,
                background: `linear-gradient(135deg, ${C.btnFrom}, ${C.btnTo})`, color: "#fff",
                fontSize: 14, fontWeight: 600, textDecoration: "none",
                boxShadow: `0 4px 16px ${C.shadow}`,
              }}
            >
              <Zap style={{ width: 16, height: 16 }} />
              {isRtl ? "צרו DXF עכשיו" : "Create DXF Now"}
            </Link>
          </div>
        )}
      </section>

      {/* ── CTA Banner ── */}
      <section style={{
        background: `linear-gradient(135deg, ${C.ctaFrom} 0%, ${C.ctaMid} 40%, ${C.ctaTo} 100%)`,
        padding: "60px 20px",
        textAlign: "center",
      }}>
        <div style={{ maxWidth: 600, margin: "0 auto" }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14,
            background: `linear-gradient(135deg, ${C.btnFrom}, ${C.btnTo})`,
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 20px",
            boxShadow: `0 4px 16px ${C.shadow}`,
          }}>
            <Zap style={{ width: 24, height: 24, color: "#fff" }} />
          </div>
          <h2 style={{ fontSize: "clamp(1.3rem, 3vw, 2rem)", fontWeight: 800, color: C.heroFrom, marginBottom: 10, letterSpacing: "-0.02em" }}>
            {isRtl ? "צרו קבצי DXF משלכם" : "Create Your Own DXF Files"}
          </h2>
          <p style={{ fontSize: 15, color: "#6b7280", marginBottom: 24, lineHeight: 1.7, maxWidth: 450, margin: "0 auto 24px" }}>
            {isRtl
              ? "השתמשו בכלי AI להמרת תמונות, יצירת עיצובים ויצירת קבצי DXF מקצועיים ל-CNC וחיתוך לייזר."
              : "Use AI-powered tools to convert images, generate designs, and create professional DXF files for CNC and laser cutting."}
          </p>
          <Link
            href="/"
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "14px 32px", borderRadius: 12,
              background: `linear-gradient(135deg, ${C.btnFrom}, ${C.btnTo})`, color: "#fff",
              fontSize: 15, fontWeight: 700, textDecoration: "none",
              boxShadow: `0 4px 20px ${C.shadowDeep}`,
              transition: "transform 0.15s, box-shadow 0.15s",
            }}
          >
            {isRtl ? "נסו את dxfai.ai בחינם" : "Try dxfai.ai Free"}
          </Link>
          <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 12 }}>
            {isRtl ? "10 אסימונים חינם בהרשמה" : "10 free tokens on signup"}
          </p>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ background: "#111827", padding: "24px 20px", textAlign: "center" }}>
        <p style={{ color: "#6b7280", fontSize: 12 }}>
          {isRtl ? "© 2026 dxfai.ai — קבצי DXF בחינם לקהילה" : "© 2026 dxfai.ai — Free DXF Files for the Community"}
        </p>
      </footer>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}

/* ── File Card Component ── */
function FileCard({ file, getTitle, isRtl }: {
  file: SharedFile;
  getTitle: (f: SharedFile) => string;
  isRtl: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const title = getTitle(file);

  return (
    <Link
      href={`/free/file/${file.id}`}
      style={{
        display: "block",
        background: "#fff",
        borderRadius: 14,
        border: "1px solid #e5e7eb",
        overflow: "hidden",
        textDecoration: "none",
        transition: "all 0.2s ease",
        transform: hovered ? "translateY(-3px)" : "none",
        boxShadow: hovered ? "0 12px 32px rgba(0,0,0,0.1)" : "0 1px 3px rgba(0,0,0,0.04)",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Preview */}
      <div style={{ position: "relative", aspectRatio: "1", background: "#f9fafb", overflow: "hidden" }}>
        {file.previewImageUrl ? (
          <img
            src={file.previewImageUrl}
            alt={title}
            style={{
              width: "100%", height: "100%", objectFit: "contain", padding: 16,
              transition: "transform 0.3s ease",
              transform: hovered ? "scale(1.05)" : "scale(1)",
            }}
            loading="lazy"
          />
        ) : (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Layers style={{ width: 48, height: 48, color: "#e5e7eb" }} />
          </div>
        )}

        {/* Free badge */}
        <div style={{ position: "absolute", top: 10, [isRtl ? "right" : "left"]: 10 }}>
          <span style={{
            padding: "3px 8px", borderRadius: 6,
            fontSize: 10, fontWeight: 700, color: "#fff",
            background: `linear-gradient(135deg, ${C.accent}, ${C.accentLight})`,
            boxShadow: `0 2px 6px ${C.shadow}`,
          }}>
            {isRtl ? "חינם" : "FREE"}
          </span>
        </div>

        {/* Hover overlay */}
        <div style={{
          position: "absolute", inset: 0,
          background: C.overlay,
          display: "flex", alignItems: "center", justifyContent: "center",
          opacity: hovered ? 1 : 0,
          transition: "opacity 0.2s ease",
        }}>
          <span style={{
            padding: "8px 16px", borderRadius: 10,
            background: "rgba(255,255,255,0.95)", color: C.accent,
            fontSize: 12, fontWeight: 600,
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
            display: "flex", alignItems: "center", gap: 4,
          }}>
            <Eye style={{ width: 14, height: 14 }} />
            {isRtl ? "תצוגה מקדימה" : "Preview"}
          </span>
        </div>
      </div>

      {/* Info */}
      <div style={{ padding: 12 }}>
        <h3 style={{
          fontSize: 13, fontWeight: 600, color: hovered ? C.accent : "#1f2937",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          transition: "color 0.15s",
        }}>
          {title}
        </h3>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 11, color: "#9ca3af" }}>
            {file.lineCount != null && file.lineCount > 0 && (
              <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                <Layers style={{ width: 11, height: 11 }} />
                {file.lineCount.toLocaleString()}
              </span>
            )}
            {file.downloadCount != null && file.downloadCount > 0 && (
              <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                <Download style={{ width: 11, height: 11 }} />
                {file.downloadCount}
              </span>
            )}
          </div>
          {file.category && (
            <span style={{
              fontSize: 10, padding: "2px 6px", borderRadius: 4,
              background: C.accentBg, color: C.accent, fontWeight: 500,
            }}>
              {file.category}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

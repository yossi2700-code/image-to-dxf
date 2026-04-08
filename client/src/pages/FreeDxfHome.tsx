/**
 * FreeDXF Home — community free DXF files page at /free
 * Clean, simple, fast design
 */
import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { Search, Download, Layers, Zap, LogOut, User, X, ChevronRight } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { AuthDialog } from "@/components/AuthDialog";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

interface SharedFile {
  id: number;
  title: string | null;
  titleHe: string | null;
  category: string | null;
  previewImageUrl: string | null;
  svgPreview?: string | null;
  downloadCount: number | null;
  createdAt: string;
}

interface Category {
  name: string;
  count: number;
}

const CATEGORY_HE: Record<string, string> = {
  "Animals": "בעלי חיים", "Nature": "טבע", "Geometric": "גיאומטרי",
  "Text & Letters": "טקסט ואותיות", "Vehicles": "כלי רכב", "Buildings": "מבנים",
  "People": "אנשים", "Art & Decor": "אמנות ועיצוב", "Tools": "כלים",
  "Holiday": "חגים", "Mandala": "מנדלה", "Music": "מוזיקה",
  "Sports": "ספורט", "Food": "אוכל", "Technology": "טכנולוגיה",
  "CNC Relief": "תבליט CNC", "Other": "אחר"
};

export default function FreeDxfHome() {
  const { language } = useLanguage();
  const isRtl = language === "he";
  const [, navigate] = useLocation();
  const [appUser, setAppUser] = useState<{ id: number; email: string; name?: string } | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [files, setFiles] = useState<SharedFile[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalFiles, setTotalFiles] = useState(0);
  const [activeCategory, setActiveCategory] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  // Check app auth status
  useEffect(() => {
    fetch("/api/app-auth/me", { credentials: "include" })
      .then(r => r.json())
      .then(d => setAppUser(d.user ?? null))
      .catch(() => setAppUser(null));
  }, []);

  const handleAuthSuccess = () => {
    setAuthOpen(false);
    fetch("/api/app-auth/me", { credentials: "include" })
      .then(r => r.json())
      .then(d => setAppUser(d.user ?? null))
      .catch(() => {});
  };

  const handleLogout = async () => {
    await fetch("/api/app-auth/logout", { method: "POST", credentials: "include" });
    setAppUser(null);
    window.location.reload();
  };

  // Load files + categories
  useEffect(() => {
    async function load() {
      try {
        const sp = new URLSearchParams({ limit: "24" });
        if (activeCategory) sp.set("category", activeCategory);
        const [filesRes, catsRes] = await Promise.all([
          fetch(`/api/freedxf/files?${sp}`).then(r => r.json()),
          fetch("/api/freedxf/categories").then(r => r.json()),
        ]);
        setFiles(filesRes.files || []);
        setTotalFiles(filesRes.total || 0);
        setCategories(catsRes.categories || []);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [activeCategory]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (search.trim()) navigate(`/free/browse?search=${encodeURIComponent(search.trim())}`);
  };

  const getTitle = (file: SharedFile) =>
    (language === "he" && file.titleHe) ? file.titleHe : (file.title || (isRtl ? "ללא שם" : "Untitled"));

  return (
    <div className="min-h-screen bg-gray-50" dir={isRtl ? "rtl" : "ltr"} style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}>

      {/* ── Header ── */}
      <header style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 12px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, overflow: "hidden" }}>

          {/* Logo */}
          <Link href="/free" style={{ display: "flex", alignItems: "center", gap: 6, textDecoration: "none", flexShrink: 0 }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, background: "linear-gradient(135deg, #0d9488, #0891b2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: "#fff", fontWeight: 900, fontSize: 8, letterSpacing: "-0.5px" }}>DXF</span>
            </div>
            <span style={{ fontSize: 15, fontWeight: 800, color: "#042f2e", letterSpacing: "-0.02em" }}>FreeDXF</span>
          </Link>

          {/* Right actions */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            <LanguageSwitcher />
            {/* dxfai logo button */}
            <a
              href="/"
              style={{ display: "flex", alignItems: "center", gap: 4, textDecoration: "none", flexShrink: 0 }}
              title={isRtl ? "צור DXF עם AI" : "Create DXF with AI"}
            >
              <img
                src="https://d2xsxph8kpxj0f.cloudfront.net/310519663365044246/hnDFdLkzVGYJYdws9hbnLw/logo-dxfai_99079d72.webp"
                alt="dxfai"
                style={{ width: 28, height: 28, borderRadius: 7, objectFit: "cover", flexShrink: 0 }}
              />
              <span style={{ fontSize: 12, fontWeight: 700, color: "#4f46e5", letterSpacing: "-0.02em", whiteSpace: "nowrap" }}>dxfai</span>
            </a>
            <Link
              href="/"
              style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                padding: "7px 14px", borderRadius: 8,
                background: "linear-gradient(135deg, #0d9488, #0891b2)", color: "#fff",
                fontSize: 13, fontWeight: 600, textDecoration: "none",
                whiteSpace: "nowrap",
              }}
            >
              <Zap style={{ width: 13, height: 13 }} />
              {isRtl ? "צרו DXF" : "Create DXF"}
            </Link>

            {appUser ? (
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 8, background: "#f9fafb", border: "1px solid #e5e7eb" }}>
                <User style={{ width: 13, height: 13, color: "#6b7280" }} />
                <span style={{ fontSize: 12, color: "#374151", fontWeight: 500, maxWidth: 80, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {appUser.name || appUser.email}
                </span>
                <button
                  onClick={handleLogout}
                  title={isRtl ? "התנתק" : "Logout"}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: "#9ca3af", display: "flex" }}
                >
                  <LogOut style={{ width: 13, height: 13 }} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setAuthOpen(true)}
                style={{
                  display: "flex", alignItems: "center", gap: 5,
                  padding: "7px 12px", borderRadius: 8,
                  background: "#fff", border: "1.5px solid #e5e7eb",
                  color: "#374151", fontSize: 13, fontWeight: 600, cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                <User style={{ width: 13, height: 13 }} />
                {isRtl ? "כניסה" : "Sign In"}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ── Hero Banner ── */}
      <div style={{
        background: "linear-gradient(135deg, #042f2e 0%, #0f766e 60%, #0891b2 100%)",
        padding: "40px 20px",
        textAlign: "center",
      }}>
        <div style={{ maxWidth: 600, margin: "0 auto" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.12)", borderRadius: 20, padding: "4px 14px", marginBottom: 16, border: "1px solid rgba(255,255,255,0.15)" }}>
            <span style={{ color: "#99f6e4", fontWeight: 600, fontSize: 12 }}>
              {isRtl ? "100% חינם · ללא הגבלה" : "100% Free · No Limits"}
            </span>
          </div>
          <h1 style={{ fontSize: "clamp(1.8rem, 4vw, 2.8rem)", fontWeight: 900, color: "#fff", margin: "0 0 8px", letterSpacing: "-0.03em", lineHeight: 1.1 }}>
            {isRtl ? "קבצי DXF בחינם" : "Free DXF Files"}
          </h1>
          <p style={{ fontSize: 16, color: "rgba(255,255,255,0.7)", margin: "0 0 24px", lineHeight: 1.5 }}>
            {isRtl ? "לחיתוך CNC, לייזר ופלזמה — נוצרו עם AI" : "For CNC, Laser & Plasma Cutting — Created with AI"}
          </p>

          {/* Hero search (mobile-friendly) */}
          <form onSubmit={handleSearch} style={{ maxWidth: 480, margin: "0 auto" }}>
            <div style={{ position: "relative" }}>
              <Search style={{ position: "absolute", [isRtl ? "right" : "left"]: 16, top: "50%", transform: "translateY(-50%)", width: 18, height: 18, color: "#9ca3af" }} />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={isRtl ? "חפשו עיצובים, לוגואים, דקורציה..." : "Search designs, logos, decorations..."}
                style={{
                  width: "100%",
                  padding: isRtl ? "14px 48px 14px 100px" : "14px 100px 14px 48px",
                  borderRadius: 14,
                  background: "#fff",
                  color: "#1f2937",
                  fontSize: 15,
                  border: "none",
                  outline: "none",
                  boxSizing: "border-box",
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
                  padding: "9px 18px",
                  borderRadius: 10,
                  background: "linear-gradient(135deg, #0d9488, #0891b2)",
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 600,
                  border: "none",
                  cursor: "pointer",
                }}
              >
                {isRtl ? "חפש" : "Search"}
              </button>
            </div>
          </form>

          {/* Stats row */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 20, marginTop: 20, flexWrap: "wrap" }}>
            {[
              { n: totalFiles, label: isRtl ? "קבצים" : "files" },
              { n: categories.length, label: isRtl ? "קטגוריות" : "categories" },
            ].map((s, i) => (
              <span key={i} style={{ color: "rgba(255,255,255,0.6)", fontSize: 13 }}>
                <strong style={{ color: "#99f6e4" }}>{s.n}</strong> {s.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Category Pills ── */}
      {categories.length > 0 && (
        <div style={{ background: "#fff", borderBottom: "1px solid #e5e7eb" }}>
          <div style={{ maxWidth: 1100, margin: "0 auto", padding: "12px 20px", display: "flex", gap: 8, overflowX: "auto", scrollbarWidth: "none" }}>
            <button
              onClick={() => setActiveCategory("")}
              style={{
                flexShrink: 0,
                padding: "6px 16px",
                borderRadius: 20,
                fontSize: 13,
                fontWeight: 600,
                border: "none",
                cursor: "pointer",
                background: !activeCategory ? "linear-gradient(135deg, #0d9488, #0891b2)" : "#f3f4f6",
                color: !activeCategory ? "#fff" : "#6b7280",
                transition: "all 0.15s",
              }}
            >
              {isRtl ? "הכל" : "All"} ({totalFiles})
            </button>
            {categories.map(cat => (
              <button
                key={cat.name}
                onClick={() => setActiveCategory(activeCategory === cat.name ? "" : cat.name)}
                style={{
                  flexShrink: 0,
                  padding: "6px 14px",
                  borderRadius: 20,
                  fontSize: 13,
                  fontWeight: 500,
                  border: "none",
                  cursor: "pointer",
                  background: activeCategory === cat.name ? "linear-gradient(135deg, #0d9488, #0891b2)" : "#f3f4f6",
                  color: activeCategory === cat.name ? "#fff" : "#6b7280",
                  transition: "all 0.15s",
                  whiteSpace: "nowrap",
                }}
              >
                {isRtl ? (CATEGORY_HE[cat.name] || cat.name) : cat.name} ({cat.count})
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Files Grid ── */}
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 20px 60px" }}>
        {/* Section header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "#111827", margin: 0 }}>
            {activeCategory
              ? (isRtl ? `קטגוריה: ${activeCategory}` : `Category: ${activeCategory}`)
              : (isRtl ? "קבצים אחרונים" : "Latest Files")}
          </h2>
          <Link
            href="/free/browse"
            style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, fontWeight: 600, color: "#0d9488", textDecoration: "none" }}
          >
            {isRtl ? "כל הקבצים" : "Browse All"}
            <ChevronRight style={{ width: 14, height: 14 }} />
          </Link>
        </div>

        {loading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14 }}>
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} style={{ background: "#e5e7eb", borderRadius: 12, aspectRatio: "1", animation: "pulse 1.5s ease-in-out infinite" }} />
            ))}
          </div>
        ) : files.length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14 }}>
            {files.map(file => (
              <FileCard key={file.id} file={file} title={getTitle(file)} isRtl={isRtl} />
            ))}
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <Layers style={{ width: 48, height: 48, color: "#d1d5db", margin: "0 auto 16px" }} />
            <h3 style={{ fontSize: 18, fontWeight: 700, color: "#374151", marginBottom: 8 }}>
              {isRtl ? "אין קבצים עדיין" : "No files yet"}
            </h3>
            <p style={{ fontSize: 14, color: "#9ca3af", marginBottom: 20 }}>
              {isRtl ? "היו הראשונים לשתף קובץ DXF!" : "Be the first to share a DXF file!"}
            </p>
            <Link
              href="/"
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "10px 24px", borderRadius: 10,
                background: "linear-gradient(135deg, #0d9488, #0891b2)", color: "#fff",
                fontSize: 14, fontWeight: 600, textDecoration: "none",
              }}
            >
              <Zap style={{ width: 15, height: 15 }} />
              {isRtl ? "צרו DXF עכשיו" : "Create DXF Now"}
            </Link>
          </div>
        )}

        {/* Load more link */}
        {!loading && files.length > 0 && files.length < totalFiles && (
          <div style={{ textAlign: "center", marginTop: 32 }}>
            <Link
              href={activeCategory ? `/free/browse?category=${encodeURIComponent(activeCategory)}` : "/free/browse"}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "10px 28px", borderRadius: 10,
                background: "#fff", border: "1.5px solid #e5e7eb",
                color: "#374151", fontSize: 14, fontWeight: 600, textDecoration: "none",
              }}
            >
              {isRtl ? `עוד ${totalFiles - files.length} קבצים` : `${totalFiles - files.length} more files`}
              <ChevronRight style={{ width: 15, height: 15 }} />
            </Link>
          </div>
        )}
      </main>

      {/* ── CTA Banner ── */}
      <div style={{ background: "#fff", borderTop: "1px solid #e5e7eb", padding: "40px 20px", textAlign: "center" }}>
        <div style={{ maxWidth: 500, margin: "0 auto" }}>
          <h2 style={{ fontSize: "clamp(1.2rem, 2.5vw, 1.6rem)", fontWeight: 800, color: "#042f2e", marginBottom: 8, letterSpacing: "-0.02em" }}>
            {isRtl ? "צרו קבצי DXF משלכם" : "Create Your Own DXF Files"}
          </h2>
          <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 20, lineHeight: 1.6 }}>
            {isRtl
              ? "השתמשו ב-AI להמרת תמונות ויצירת עיצובים מקצועיים לחיתוך CNC ולייזר."
              : "Use AI to convert images and create professional designs for CNC and laser cutting."}
          </p>
          {appUser ? (
            <Link
              href="/"
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "12px 28px", borderRadius: 12,
                background: "linear-gradient(135deg, #0d9488, #0891b2)", color: "#fff",
                fontSize: 14, fontWeight: 700, textDecoration: "none",
              }}
            >
              <Zap style={{ width: 16, height: 16 }} />
              {isRtl ? "צרו DXF עכשיו" : "Create DXF Now"}
            </Link>
          ) : (
            <button
              onClick={() => setAuthOpen(true)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "12px 28px", borderRadius: 12,
                background: "linear-gradient(135deg, #0d9488, #0891b2)", color: "#fff",
                fontSize: 14, fontWeight: 700, border: "none", cursor: "pointer",
              }}
            >
              <Zap style={{ width: 16, height: 16 }} />
              {isRtl ? "הרשמה חינם" : "Sign Up Free"}
            </button>
          )}
        </div>
      </div>

      {/* ── Footer ── */}
      <footer style={{ background: "#111827", padding: "20px", textAlign: "center" }}>
        <p style={{ color: "#6b7280", fontSize: 12, margin: 0 }}>
          © 2026 <a href="https://dxfai.ai" style={{ color: "#6b7280", textDecoration: "none" }}>dxfai.ai</a>
          {" — "}{isRtl ? "קבצי DXF בחינם לקהילה" : "Free DXF Files for the Community"}
        </p>
      </footer>

      {/* ── Auth Dialog ── */}
      <AuthDialog
        open={authOpen}
        onOpenChange={setAuthOpen}
        authReason="unregistered"
        initialMode="register"
        onSuccess={handleAuthSuccess}
      />

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        ::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}

/* ── File Card ── */
function FileCard({ file, title, isRtl }: {
  file: SharedFile;
  title: string;
  isRtl: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const [imgError, setImgError] = useState(false);

  // Prefer SVG inline over image proxy for better visual quality with fill
  const proxyUrl = file.previewImageUrl
    ? `/api/freedxf/image-proxy?url=${encodeURIComponent(file.previewImageUrl)}`
    : null;
  // Always prefer SVG if available; fall back to image only if no SVG
  const inlineSvg = file.svgPreview
    ? file.svgPreview
        .replace(/stroke-width="[^"]*"/g, 'stroke-width="1.5"')
        .replace(/stroke="[^"]*"/g, 'stroke="#1a1a1a"')
        .replace(/fill="none"/g, 'fill="#2d2d2d"')
        .replace(/<svg([^>]*)>/, '<svg$1 width="100%" height="100%" preserveAspectRatio="xMidYMid meet">')
    : null;
  const preview = !inlineSvg && !imgError && proxyUrl ? proxyUrl : null;

  return (
    <Link
      href={`/free/file/${file.id}`}
      style={{
        display: "block",
        background: "#fff",
        borderRadius: 12,
        border: hovered ? "1.5px solid #0d9488" : "1.5px solid #e5e7eb",
        overflow: "hidden",
        textDecoration: "none",
        transition: "all 0.18s ease",
        transform: hovered ? "translateY(-2px)" : "none",
        boxShadow: hovered ? "0 8px 24px rgba(13,148,136,0.12)" : "0 1px 3px rgba(0,0,0,0.04)",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Preview area */}
      <div style={{ position: "relative", aspectRatio: "1", background: inlineSvg ? "#e6faf8" : "#f9fafb", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {preview ? (
          <img
            src={preview}
            alt={title}
            onError={() => setImgError(true)}
            style={{ width: "100%", height: "100%", objectFit: "contain", padding: 12, transition: "transform 0.2s", transform: hovered ? "scale(1.04)" : "scale(1)" }}
            loading="lazy"
          />
        ) : inlineSvg ? (
          <div
            dangerouslySetInnerHTML={{ __html: inlineSvg }}
            style={{ width: "calc(100% - 24px)", height: "calc(100% - 24px)", display: "flex", alignItems: "center", justifyContent: "center", transition: "transform 0.2s", transform: hovered ? "scale(1.04)" : "scale(1)" }}
          />
        ) : (
          <Layers style={{ width: 40, height: 40, color: "#d1d5db" }} />
        )}

        {/* Download count badge */}
        {file.downloadCount != null && file.downloadCount > 0 && (
          <div style={{ position: "absolute", bottom: 6, [isRtl ? "right" : "left"]: 6, display: "flex", alignItems: "center", gap: 3, background: "rgba(0,0,0,0.55)", borderRadius: 6, padding: "2px 7px" }}>
            <Download style={{ width: 10, height: 10, color: "#fff" }} />
            <span style={{ fontSize: 10, color: "#fff", fontWeight: 600 }}>{file.downloadCount}</span>
          </div>
        )}
      </div>

      {/* Title + category */}
      <div style={{ padding: "10px 12px 12px" }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: hovered ? "#0d9488" : "#111827", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", transition: "color 0.15s" }}>
          {title}
        </p>
        {file.category && (
          <p style={{ fontSize: 11, color: "#9ca3af", margin: "3px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {file.category}
          </p>
        )}
      </div>
    </Link>
  );
}

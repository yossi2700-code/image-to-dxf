/**
 * FreeDXF Browse — browse/search community DXF files at /free/browse
 * Premium design with filters, search, and responsive grid
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { Search, Layers, X, ArrowLeft, Download, Eye, SlidersHorizontal } from "lucide-react";
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

const PAGE_SIZE = 24;

const CATEGORY_ICONS: Record<string, string> = {
  "Decorative": "\ud83c\udfa8", "Signs": "\ud83e\udea7", "Logos": "\u2728", "Mechanical": "\u2699\ufe0f",
  "Animals": "\ud83e\udd81", "Nature": "\ud83c\udf3f", "Geometric": "\ud83d\udd37", "Text & Letters": "\ud83d\udd24",
  "CNC Relief": "\ud83c\udfd4\ufe0f", "Jewish & Holiday": "\u2721\ufe0f", "Architecture": "\ud83c\udfdb\ufe0f",
  "Automotive": "\ud83d\ude97", "Other": "\ud83d\udcc1",
};

export default function FreeDxfBrowse() {
  const { language } = useLanguage();
  const isRtl = language === "he";
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const params = useMemo(() => new URLSearchParams(searchString), [searchString]);
  const categoryParam = params.get("category") || "";
  const searchParam = params.get("search") || "";

  const [files, setFiles] = useState<SharedFile[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState(searchParam);
  const [activeCategory, setActiveCategory] = useState(categoryParam);

  const loadFiles = useCallback(async (reset = true, cat?: string, q?: string) => {
    if (reset) setLoading(true);
    else setLoadingMore(true);

    try {
      const offset = reset ? 0 : files.length;
      const category = cat ?? activeCategory;
      const query = q ?? search;
      const sp = new URLSearchParams();
      if (category) sp.set("category", category);
      if (query.trim()) sp.set("search", query.trim());
      sp.set("limit", String(PAGE_SIZE));
      sp.set("offset", String(offset));

      const res = await fetch(`/api/freedxf/files?${sp.toString()}`).then(r => r.json());
      setFiles(prev => reset ? (res.files || []) : [...prev, ...(res.files || [])]);
      setTotal(res.total || 0);
    } catch (err) {
      console.error("Failed to load files:", err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [activeCategory, search, files.length]);

  useEffect(() => {
    fetch("/api/freedxf/categories").then(r => r.json()).then(res => setCategories(res.categories || [])).catch(console.error);
  }, []);

  useEffect(() => {
    loadFiles(true);
  }, [activeCategory]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const sp = new URLSearchParams();
    if (search.trim()) sp.set("search", search.trim());
    if (activeCategory) sp.set("category", activeCategory);
    navigate(`/free/browse?${sp.toString()}`);
    loadFiles(true);
  };

  const handleCategoryClick = (cat: string) => {
    const newCat = cat === activeCategory ? "" : cat;
    setActiveCategory(newCat);
    const sp = new URLSearchParams();
    if (search.trim()) sp.set("search", search.trim());
    if (newCat) sp.set("category", newCat);
    navigate(`/free/browse?${sp.toString()}`);
  };

  const clearFilters = () => {
    setSearch("");
    setActiveCategory("");
    navigate("/free/browse");
    loadFiles(true, "", "");
  };

  const hasMore = files.length < total;
  const hasFilters = !!activeCategory || !!search.trim();

  const getTitle = (file: SharedFile) =>
    (language === "he" && file.titleHe) ? file.titleHe : (file.title || "Untitled");

  return (
    <div className="min-h-screen" style={{ background: "#fafafa" }} dir={isRtl ? "rtl" : "ltr"}>
      {/* ── Header ── */}
      <div style={{
        background: "linear-gradient(160deg, #042f2e 0%, #134e4a 50%, #0f766e 100%)",
        padding: "0 0 32px",
      }}>
        {/* Top bar */}
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "12px 20px", display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/free" style={{ display: "flex", alignItems: "center", gap: 6, color: "rgba(255,255,255,0.6)", fontSize: 13, textDecoration: "none" }}>
            <ArrowLeft style={{ width: 16, height: 16 }} />
            {isRtl ? "חזרה" : "Back"}
          </Link>
        </div>

        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "8px 20px 0" }}>
          <h1 style={{ fontSize: "clamp(1.5rem, 3vw, 2rem)", fontWeight: 800, color: "#fff", marginBottom: 6, letterSpacing: "-0.02em" }}>
            {isRtl ? "עיון בקבצי DXF" : "Browse DXF Files"}
          </h1>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.55)", marginBottom: 20 }}>
            {isRtl
              ? `${total} קבצים זמינים להורדה בחינם`
              : `${total} files available for free download`}
          </p>

          {/* Search */}
          <form onSubmit={handleSearch} style={{ display: "flex", gap: 8, maxWidth: 520 }}>
            <div style={{ position: "relative", flex: 1 }}>
              <Search style={{ position: "absolute", [isRtl ? "right" : "left"]: 12, top: "50%", transform: "translateY(-50%)", width: 16, height: 16, color: "#9ca3af" }} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={isRtl ? "חפשו עיצובים..." : "Search designs..."}
                style={{
                  width: "100%",
                  [isRtl ? "paddingRight" : "paddingLeft"]: 38,
                  ...(isRtl ? { paddingRight: 38, paddingLeft: 14 } : { paddingLeft: 38, paddingRight: 14 }),
                  paddingTop: 10, paddingBottom: 10,
                  borderRadius: 10, background: "rgba(255,255,255,0.1)",
                  backdropFilter: "blur(8px)",
                  color: "#fff", fontSize: 13,
                  border: "1px solid rgba(255,255,255,0.15)",
                  outline: "none",
                  direction: isRtl ? "rtl" : "ltr",
                }}
              />
            </div>
            <button
              type="submit"
              style={{
                padding: "10px 20px", borderRadius: 10,
                background: "rgba(255,255,255,0.15)", color: "#fff",
                fontSize: 13, fontWeight: 600, border: "1px solid rgba(255,255,255,0.2)",
                cursor: "pointer", backdropFilter: "blur(8px)",
              }}
            >
              {isRtl ? "חיפוש" : "Search"}
            </button>
          </form>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 20px 60px" }}>
        {/* ── Categories ── */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 20 }}>
          <button
            onClick={() => handleCategoryClick("")}
            style={{
              padding: "6px 14px", borderRadius: 16,
              fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer",
              background: !activeCategory ? "linear-gradient(135deg, #0d9488, #0891b2)" : "#fff",
              color: !activeCategory ? "#fff" : "#4b5563",
              boxShadow: !activeCategory ? "0 2px 8px rgba(13,148,136,0.2)" : "0 1px 3px rgba(0,0,0,0.06)",
              transition: "all 0.15s",
            }}
          >
            {isRtl ? "הכל" : "All"}
          </button>
          {categories.map((cat) => (
            <button
              key={cat.name}
              onClick={() => handleCategoryClick(cat.name)}
              style={{
                padding: "6px 14px", borderRadius: 16,
                fontSize: 12, fontWeight: 500, border: "none", cursor: "pointer",
                background: activeCategory === cat.name ? "linear-gradient(135deg, #0d9488, #0891b2)" : "#fff",
                color: activeCategory === cat.name ? "#fff" : "#4b5563",
                boxShadow: activeCategory === cat.name ? "0 2px 8px rgba(13,148,136,0.2)" : "0 1px 3px rgba(0,0,0,0.06)",
                transition: "all 0.15s",
              }}
            >
              {CATEGORY_ICONS[cat.name] || "📁"} {cat.name} ({cat.count})
            </button>
          ))}
        </div>

        {/* ── Active filters & count ── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <p style={{ fontSize: 13, color: "#9ca3af" }}>
            {isRtl
              ? `מציג ${files.length} מתוך ${total} קבצים`
              : `Showing ${files.length} of ${total} files`}
          </p>
          {hasFilters && (
            <button
              onClick={clearFilters}
              style={{
                display: "flex", alignItems: "center", gap: 4,
                        color: "#0d9488", background: "#f0fdfa",
                border: "1px solid #99f6e4", borderRadius: 8,
                padding: "4px 10px", cursor: "pointer",
              }}
            >
              <X style={{ width: 12, height: 12 }} />
              {isRtl ? "נקה סינון" : "Clear filters"}
            </button>
          )}
        </div>

        {/* ── Files grid ── */}
        {loading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 14 }}>
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} style={{ background: "#f3f4f6", borderRadius: 14, aspectRatio: "1", animation: "pulse 1.5s ease-in-out infinite" }} />
            ))}
          </div>
        ) : files.length > 0 ? (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 14 }}>
              {files.map((file) => (
                <BrowseCard key={file.id} file={file} getTitle={getTitle} isRtl={isRtl} />
              ))}
            </div>

            {hasMore && (
              <div style={{ textAlign: "center", marginTop: 32 }}>
                <button
                  onClick={() => loadFiles(false)}
                  disabled={loadingMore}
                  style={{
                    padding: "12px 32px", borderRadius: 12,
                    fontSize: 13, fontWeight: 600,
                    color: "#0d9488", background: "#fff",
                    border: "1.5px solid #99f6e4", cursor: "pointer",
                    boxShadow: "0 2px 8px rgba(13,148,136,0.08)",
                    opacity: loadingMore ? 0.5 : 1,
                  }}
                >
                  {loadingMore ? "..." : (isRtl ? "טען עוד" : "Load More")}
                </button>
              </div>
            )}
          </>
        ) : (
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <div style={{
              width: 72, height: 72, borderRadius: 18,
              background: "linear-gradient(135deg, #f0fdfa, #ccfbf1)",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 16px",
            }}>
              <SlidersHorizontal style={{ width: 32, height: 32, color: "#99f6e4" }} />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: "#042f2e", marginBottom: 6 }}>
              {isRtl ? "לא נמצאו תוצאות" : "No results found"}
            </h3>
            <p style={{ fontSize: 13, color: "#9ca3af", marginBottom: 20 }}>
              {isRtl ? "נסו לשנות את מילות החיפוש או הסינון" : "Try changing your search terms or filters"}
            </p>
            {hasFilters && (
              <button
                onClick={clearFilters}
                style={{
                  padding: "10px 24px", borderRadius: 10,
                  fontSize: 13, fontWeight: 600,
                  color: "#fff", background: "linear-gradient(135deg, #0d9488, #0891b2)",
                  border: "none", cursor: "pointer",
                  boxShadow: "0 2px 8px rgba(13,148,136,0.2)",
                }}
              >
                {isRtl ? "נקה הכל" : "Clear All"}
              </button>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}

/* ── Browse Card Component ── */
function BrowseCard({ file, getTitle, isRtl }: {
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
        borderRadius: 12,
        overflow: "hidden",
        textDecoration: "none",
        transition: "all 0.2s ease",
        transform: hovered ? "translateY(-2px)" : "none",
        boxShadow: hovered ? "0 8px 24px rgba(0,0,0,0.1)" : "0 1px 3px rgba(0,0,0,0.04)",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{ position: "relative", aspectRatio: "1", background: "#f9fafb", overflow: "hidden" }}>
        {file.previewImageUrl ? (
          <img
            src={`/api/freedxf/image-proxy?url=${encodeURIComponent(file.previewImageUrl)}`}
            alt={title}
            style={{
              width: "100%", height: "100%", objectFit: "contain", padding: 14,
              transition: "transform 0.3s ease",
              transform: hovered ? "scale(1.05)" : "scale(1)",
            }}
            loading="lazy"
          />
        ) : file.svgPreview ? (
          <div
            dangerouslySetInnerHTML={{ __html:
              (file.svgPreview.includes('</svg>') ? file.svgPreview : file.svgPreview + '</svg>')
                .replace(/stroke-width="[^"]*"/g, 'stroke-width="1.5"')
                .replace(/<svg([^>]*)>/, '<svg$1 width="100%" height="100%" preserveAspectRatio="xMidYMid meet">')
            }}
            style={{ width: "calc(100% - 28px)", height: "calc(100% - 28px)", margin: 14, transition: "transform 0.3s ease", transform: hovered ? "scale(1.05)" : "scale(1)" }}
          />
        ) : (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Layers style={{ width: 40, height: 40, color: "#e5e7eb" }} />
          </div>
        )}
        <div style={{ position: "absolute", top: 8, [isRtl ? "right" : "left"]: 8 }}>
          <span style={{
            padding: "2px 6px", borderRadius: 5,
            fontSize: 9, fontWeight: 700, color: "#fff",
            background: "linear-gradient(135deg, #0d9488, #14b8a6)",
          }}>
            {isRtl ? "חינם" : "FREE"}
          </span>
        </div>
        <div style={{
          position: "absolute", inset: 0,
          background: "rgba(13,148,136,0.05)",
          display: "flex", alignItems: "center", justifyContent: "center",
          opacity: hovered ? 1 : 0,
          transition: "opacity 0.2s",
        }}>
          <span style={{
            padding: "6px 12px", borderRadius: 8,
            background: "rgba(255,255,255,0.95)", color: "#0d9488",
            fontSize: 11, fontWeight: 600,
            display: "flex", alignItems: "center", gap: 4,
          }}>
            <Eye style={{ width: 12, height: 12 }} />
            {isRtl ? "צפייה" : "View"}
          </span>
        </div>
      </div>
      <div style={{ padding: 10 }}>
        <h3 style={{
          fontSize: 12, fontWeight: 600, color: hovered ? "#0d9488" : "#1f2937",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          transition: "color 0.15s",
        }}>
          {title}
        </h3>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 10, color: "#9ca3af" }}>
            {file.lineCount != null && file.lineCount > 0 && (
              <span style={{ display: "flex", alignItems: "center", gap: 2 }}>
                <Layers style={{ width: 10, height: 10 }} />
                {file.lineCount.toLocaleString()}
              </span>
            )}
            {file.downloadCount != null && file.downloadCount > 0 && (
              <span style={{ display: "flex", alignItems: "center", gap: 2 }}>
                <Download style={{ width: 10, height: 10 }} />
                {file.downloadCount}
              </span>
            )}
          </div>
          {file.category && (
            <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 3, background: "#f0fdfa", color: "#0d9488", fontWeight: 500 }}>
              {file.category}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

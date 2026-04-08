/**
 * FreeDXF File Detail — view and download a shared DXF file at /free/file/:id
 * Uses DxfDownloadDialog for a full-featured download experience.
 */
import { useState, useEffect, useRef } from "react";
import { Link, useParams, useLocation } from "wouter";
import { ArrowLeft, Layers, Tag, Calendar, Download, Share2, Zap } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { AuthDialog } from "@/components/AuthDialog";
import { DxfDownloadDialog } from "@/components/DxfDownloadDialog";

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
  dxfUrl: string | null;
  lineCount: number | null;
  downloadCount: number | null;
  creatorName: string | null;
  createdAt: string;
}

// ─── Apply fill styling to SVG ────────────────────────────────────────────────
function applyFillToSvg(svg: string): string {
  let s = svg.trim();
  if (!s.endsWith("</svg>")) s += "\n</svg>";
  return s
    .replace(/stroke-width="[^"]*"/g, 'stroke-width="1.5"')
    .replace(/stroke="[^"]*"/g, 'stroke="#1a1a1a"')
    .replace(/fill="none"/g, 'fill="#2d2d2d"')
    .replace(/<svg([^>]*)>/, '<svg$1 width="100%" height="100%" preserveAspectRatio="xMidYMid meet">');
}

export default function FreeDxfFileDetail() {
  const { id } = useParams<{ id: string }>();
  const { language } = useLanguage();
  const isRtl = language === "he";
  const [, navigate] = useLocation();
  const [file, setFile] = useState<SharedFile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [appUser, setAppUser] = useState<{ id: number; email: string } | null>(null);
  const appUserRef = useRef<{ id: number; email: string } | null>(null);
  const [authOpen, setAuthOpen] = useState(false);

  // Download dialog state
  const [dlOpen, setDlOpen] = useState(false);
  const [dlDxfUrl, setDlDxfUrl] = useState<string>("");
  const [dlFetching, setDlFetching] = useState(false);

  useEffect(() => {
    fetch("/api/app-auth/me", { credentials: "include" })
      .then(r => r.json())
      .then(d => { if (d.user) { appUserRef.current = d.user; setAppUser(d.user); } })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetch(`/api/freedxf/files/${id}`)
      .then(r => { if (!r.ok) throw new Error("File not found"); return r.json(); })
      .then(res => setFile(res.file))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  const getTitle = () => {
    if (!file) return "";
    return (language === "he" && file.titleHe) ? file.titleHe : (file.title || "Untitled");
  };

  const getCleanFilename = () => {
    const title = getTitle() || `freedxf-${id}`;
    return title.replace(/[^\w\s\u0590-\u05FF._-]/g, "_").replace(/\s+/g, "_").slice(0, 40);
  };

  const handleDownloadClick = async (overrideUser?: { id: number; email: string }) => {
    if (!file) return;
    const currentUser = overrideUser ?? appUserRef.current ?? appUser;
    if (!currentUser) {
      setAuthOpen(true);
      return;
    }
    setDlFetching(true);
    try {
      const resp = await fetch(`/api/freedxf/files/${id}/download`, {
        method: "POST",
        credentials: "include",
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({})) as Record<string, unknown>;
        if (resp.status === 401) { setAuthOpen(true); return; }
        throw new Error((data.error as string) || "Download failed");
      }
      const data = await resp.json() as { dxfUrl: string };
      setDlDxfUrl(data.dxfUrl);
      setDlOpen(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setDlFetching(false);
    }
  };

  const handleShare = () => {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({ title: file ? getTitle() : "FreeDXF", url });
    } else {
      navigator.clipboard.writeText(url);
      alert(isRtl ? "הקישור הועתק!" : "Link copied!");
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#fafafa" }}>
        <div style={{ width: 40, height: 40, border: "3px solid #e5e7eb", borderTopColor: "#0d9488", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error || !file) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, background: "#fafafa" }}>
        <div style={{ width: 72, height: 72, borderRadius: 18, background: "linear-gradient(135deg, #f0fdfa, #ccfbf1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Layers style={{ width: 36, height: 36, color: "#0d9488" }} />
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: "#042f2e" }}>{isRtl ? "הקובץ לא נמצא" : "File not found"}</h2>
        <button onClick={() => navigate("/free")} style={{ padding: "10px 24px", borderRadius: 12, background: "#0d9488", color: "#fff", border: "none", cursor: "pointer", fontWeight: 600 }}>
          {isRtl ? "חזרה לגלריה" : "Back to gallery"}
        </button>
      </div>
    );
  }

  const title = getTitle();
  const description = (language === "he" && file.descriptionHe) ? file.descriptionHe : file.description;
  const tags = file.tags?.split(",").map(t => t.trim()).filter(Boolean) || [];
  const date = new Date(file.createdAt).toLocaleDateString(language === "he" ? "he-IL" : "en-US", { year: "numeric", month: "short", day: "numeric" });

  // Prefer SVG preview with fill over previewImageUrl
  const hasSvg = !!(file.svgPreview && file.svgPreview.length > 20);
  const styledSvg = hasSvg ? applyFillToSvg(file.svgPreview!) : null;

  return (
    <div style={{ minHeight: "100vh", background: "#fafafa" }} dir={isRtl ? "rtl" : "ltr"}>
      {/* ── Breadcrumb / Back bar ── */}
      <div style={{ background: "#fff", borderBottom: "1px solid #f0f0f5" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 16px", display: "flex", alignItems: "stretch" }}>
          <button
            onClick={() => navigate("/free")}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              minHeight: 52, padding: "0 20px 0 8px",
              color: "#374151", background: "none",
              fontSize: 14, fontWeight: 600, cursor: "pointer",
              border: "none",
              borderRight: isRtl ? "none" : "1px solid #f0f0f5",
              borderLeft: isRtl ? "1px solid #f0f0f5" : "none",
              flexShrink: 0,
            }}
          >
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <ArrowLeft style={{ width: 18, height: 18 }} />
            </div>
            {isRtl ? "חזרה" : "Back"}
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 16px", fontSize: 13, color: "#9ca3af", overflow: "hidden", flex: 1 }}>
            {file.category && (
              <>
                <Link href={`/free/browse?category=${encodeURIComponent(file.category)}`} style={{ color: "#9ca3af", textDecoration: "none", whiteSpace: "nowrap" }}>{file.category}</Link>
                <span style={{ color: "#d1d5db" }}>/</span>
              </>
            )}
            <span style={{ color: "#4b5563", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</span>
          </div>
        </div>
      </div>

      {/* ── Main Content ── */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 20px 60px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 400px), 1fr))", gap: 32 }}>

          {/* ── Preview ── */}
          <div style={{ background: "#fff", borderRadius: 20, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.04)", border: "1px solid #f0f0f5" }}>
            <div style={{ aspectRatio: "1", background: "linear-gradient(135deg, #f0fdfa, #e6faf8)", display: "flex", alignItems: "center", justifyContent: "center", padding: 32, position: "relative" }}>
              {styledSvg ? (
                <div
                  style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}
                  dangerouslySetInnerHTML={{ __html: styledSvg }}
                />
              ) : file.previewImageUrl ? (
                <img
                  src={`/api/freedxf/image-proxy?url=${encodeURIComponent(file.previewImageUrl)}`}
                  alt={title}
                  style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
                />
              ) : (
                <Layers style={{ width: 80, height: 80, color: "#e5e7eb" }} />
              )}
              <div style={{ position: "absolute", top: 16, [isRtl ? "right" : "left"]: 16 }}>
                <span style={{ padding: "4px 12px", borderRadius: 8, fontSize: 11, fontWeight: 700, color: "#fff", background: "linear-gradient(135deg, #0d9488, #14b8a6)", boxShadow: "0 2px 8px rgba(13,148,136,0.3)" }}>
                  {isRtl ? "חינם" : "FREE"}
                </span>
              </div>
            </div>
          </div>

          {/* ── Details ── */}
          <div>
            <h1 style={{ fontSize: "clamp(1.5rem, 3vw, 2rem)", fontWeight: 800, color: "#042f2e", marginBottom: 12, letterSpacing: "-0.02em", lineHeight: 1.2 }}>
              {title}
            </h1>

            {description && (
              <p style={{ fontSize: 15, color: "#6b7280", marginBottom: 20, lineHeight: 1.7 }}>{description}</p>
            )}

            {/* Meta chips */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
              {file.category && (
                <Link href={`/free/browse?category=${encodeURIComponent(file.category)}`} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, background: "#f0fdfa", color: "#0d9488", fontSize: 12, fontWeight: 600, textDecoration: "none", border: "1px solid #ccfbf1" }}>
                  <Tag style={{ width: 12, height: 12 }} />{file.category}
                </Link>
              )}
              {file.lineCount != null && file.lineCount > 0 && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, background: "#f9fafb", color: "#6b7280", fontSize: 12, fontWeight: 500, border: "1px solid #f0f0f5" }}>
                  <Layers style={{ width: 12, height: 12 }} />{file.lineCount.toLocaleString()} {isRtl ? "קווים" : "lines"}
                </span>
              )}
              {file.downloadCount != null && file.downloadCount > 0 && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, background: "#f9fafb", color: "#6b7280", fontSize: 12, fontWeight: 500, border: "1px solid #f0f0f5" }}>
                  <Download style={{ width: 12, height: 12 }} />{file.downloadCount} {isRtl ? "הורדות" : "downloads"}
                </span>
              )}
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, background: "#f9fafb", color: "#6b7280", fontSize: 12, fontWeight: 500, border: "1px solid #f0f0f5" }}>
                <Calendar style={{ width: 12, height: 12 }} />{date}
              </span>
            </div>

            {/* Creator credit — gold premium highlight */}
            {file.creatorName && (
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, padding: "13px 16px", borderRadius: 14, background: "linear-gradient(135deg, #b45309, #d97706, #f59e0b)", boxShadow: "0 4px 16px rgba(180,83,9,0.35)", position: "relative", overflow: "hidden" }}>
                {/* shimmer overlay */}
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.15) 50%, transparent 60%)", pointerEvents: "none" }} />
                {/* avatar */}
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(255,255,255,0.25)", border: "2px solid rgba(255,255,255,0.6)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }}>
                  <span style={{ color: "#fff", fontSize: 16, fontWeight: 900, textShadow: "0 1px 3px rgba(0,0,0,0.3)" }}>{file.creatorName.charAt(0).toUpperCase()}</span>
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 10, color: "rgba(255,255,255,0.85)", margin: 0, letterSpacing: "0.08em", fontWeight: 600, textTransform: "uppercase" }}>{isRtl ? "✦ עוצב על ידי" : "✦ Designed by"}</p>
                  <p style={{ fontSize: 16, fontWeight: 900, color: "#fff", margin: 0, letterSpacing: "-0.02em", textShadow: "0 1px 4px rgba(0,0,0,0.2)" }}>{file.creatorName}</p>
                </div>
                <span style={{ fontSize: 20, opacity: 0.9 }}>⭐</span>
              </div>
            )}

            {/* Tags */}
            {tags.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 24 }}>
                {tags.map(tag => (
                  <Link key={tag} href={`/free/browse?search=${encodeURIComponent(tag)}`} style={{ padding: "4px 10px", borderRadius: 12, fontSize: 11, fontWeight: 500, background: "#f9fafb", color: "#6b7280", textDecoration: "none", border: "1px solid #e5e7eb" }}>
                    #{tag}
                  </Link>
                ))}
              </div>
            )}

            {/* ── Download section ── */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {/* Main download button — opens DxfDownloadDialog */}
              <button
                onClick={() => handleDownloadClick()}
                disabled={dlFetching}
                style={{
                  width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                  padding: "16px 20px",
                  fontSize: 15, fontWeight: 700, color: "#fff",
                  background: "linear-gradient(135deg, #0d9488, #0891b2)",
                  border: "none", cursor: dlFetching ? "wait" : "pointer",
                  borderRadius: 14,
                  opacity: dlFetching ? 0.7 : 1,
                  boxShadow: "0 4px 20px rgba(13,148,136,0.3)",
                  transition: "opacity 0.15s",
                }}
              >
                {dlFetching ? (
                  <>
                    <div style={{ width: 18, height: 18, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                    {isRtl ? "טוען..." : "Loading..."}
                  </>
                ) : appUser ? (
                  <>
                    <Download style={{ width: 18, height: 18 }} />
                    {isRtl ? "הורד קובץ DXF" : "Download DXF File"}
                  </>
                ) : (
                  <>
                    <Download style={{ width: 18, height: 18 }} />
                    {isRtl ? "התחבר להורדה" : "Login to Download"}
                  </>
                )}
              </button>

              {/* Share button */}
              <button
                onClick={handleShare}
                style={{
                  width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  padding: "12px 24px", borderRadius: 12,
                  fontSize: 13, fontWeight: 600, color: "#6b7280",
                  background: "#fff", border: "1.5px solid #e5e7eb",
                  cursor: "pointer", transition: "all 0.15s",
                }}
              >
                <Share2 style={{ width: 16, height: 16 }} />
                {isRtl ? "שתף" : "Share"}
              </button>

              {!appUser && (
                <p style={{ fontSize: 12, color: "#9ca3af", textAlign: "center" }}>
                  {isRtl ? "נדרשת הרשמה חינמית להורדת קבצים" : "Free registration required to download files"}
                </p>
              )}
            </div>

            {/* Created with dxfai.ai */}
            <div style={{ marginTop: 28, padding: 16, borderRadius: 14, background: "linear-gradient(135deg, #f0fdfa, #ccfbf1)", border: "1px solid #99f6e4" }}>
              <p style={{ fontSize: 12, color: "#0d9488", fontWeight: 600, marginBottom: 8 }}>
                {isRtl ? "נוצר עם" : "Created with"}
              </p>
              <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 700, color: "#042f2e", textDecoration: "none" }}>
                <div style={{ width: 28, height: 28, borderRadius: 7, background: "linear-gradient(135deg, #0d9488, #0891b2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Zap style={{ width: 14, height: 14, color: "#fff" }} />
                </div>
                dxfai.ai — AI-Powered DXF Creation
              </Link>
              <p style={{ fontSize: 12, color: "#6b7280", marginTop: 8, lineHeight: 1.5 }}>
                {isRtl ? "צרו קבצי DXF משלכם עם AI. המרת תמונות, יצירת עיצובים ועוד." : "Create your own DXF files with AI. Convert images, generate designs, and more."}
              </p>
            </div>
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* ── Auth Dialog ── */}
      <AuthDialog
        open={authOpen}
        onOpenChange={(open) => { setAuthOpen(open); }}
        authReason="unregistered"
        initialMode="register"
        onSuccess={(user) => {
          const u = { id: user.id, email: user.email };
          appUserRef.current = u;
          setAppUser(u);
          setAuthOpen(false);
          // Pass user directly to avoid stale closure
          setTimeout(() => handleDownloadClick(u), 400);
        }}
      />

      {/* ── DXF Download Dialog ── */}
      {dlOpen && dlDxfUrl && file?.svgPreview && (
        <DxfDownloadDialog
          open={dlOpen}
          onClose={() => setDlOpen(false)}
          svgContent={file.svgPreview}
          dxfUrl={dlDxfUrl}
          defaultFilename={getCleanFilename()}
          segmentCount={file.lineCount ?? 0}
          hideCommunityShare={true}
        />
      )}
    </div>
  );
}

/**
 * FreeDXF File Detail — view and download a shared DXF file at /free/file/:id
 * Premium design with large preview, metadata, and download CTA
 */
import { useState, useEffect } from "react";
import { Link, useParams, useLocation } from "wouter";
import { Download, ArrowLeft, Layers, Lock, Tag, Calendar, Zap, Eye, Share2 } from "lucide-react";
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
  dxfUrl: string | null;
  lineCount: number | null;
  downloadCount: number | null;
  createdAt: string;
}

export default function FreeDxfFileDetail() {
  const { id } = useParams<{ id: string }>();
  const { language } = useLanguage();
  const isRtl = language === "he";
  const [, navigate] = useLocation();
  const [file, setFile] = useState<SharedFile | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appUser, setAppUser] = useState<{ id: number; email: string } | null>(null);

  useEffect(() => {
    fetch("/api/app-auth/me", { credentials: "include" })
      .then(r => r.json())
      .then(d => { if (d.user) setAppUser(d.user); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetch(`/api/freedxf/files/${id}`)
      .then(r => {
        if (!r.ok) throw new Error("File not found");
        return r.json();
      })
      .then(res => setFile(res.file))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  const handleDownload = async () => {
    if (!file) return;
    if (!appUser) {
      navigate(`/?login=1&redirect=/free/file/${file.id}`);
      return;
    }

    setDownloading(true);
    try {
      const res = await fetch(`/api/freedxf/files/${file.id}/download`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json();
        if (data.error === "AUTH_REQUIRED") {
          navigate(`/?login=1&redirect=/free/file/${file.id}`);
          return;
        }
        throw new Error(data.message || "Download failed");
      }
      const data = await res.json();
      const a = document.createElement("a");
      a.href = data.dxfUrl;
      a.download = (data.title || `freedxf-${file.id}`) + ".dxf";
      a.target = "_blank";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      alert(isRtl ? "ההורדה נכשלה" : "Download failed");
    } finally {
      setDownloading(false);
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

  const getTitle = () => {
    if (!file) return "";
    return (language === "he" && file.titleHe) ? file.titleHe : (file.title || "Untitled");
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
        <div style={{
          width: 72, height: 72, borderRadius: 18,
          background: "linear-gradient(135deg, #f0fdfa, #ccfbf1)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Layers style={{ width: 32, height: 32, color: "#99f6e4" }} />
        </div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#042f2e" }}>{error || "File not found"}</h2>
        <Link
          href="/free/browse"
          style={{
            padding: "10px 24px", borderRadius: 10,
            background: "linear-gradient(135deg, #0d9488, #0891b2)", color: "#fff",
            fontSize: 13, fontWeight: 600, textDecoration: "none",
          }}
        >
          {isRtl ? "לכל הקבצים" : "Browse All Files"}
        </Link>
      </div>
    );
  }

  const title = getTitle();
  const description = (language === "he" && file.descriptionHe) ? file.descriptionHe : file.description;
  const tags = file.tags?.split(",").map(t => t.trim()).filter(Boolean) || [];
  const date = new Date(file.createdAt).toLocaleDateString(language === "he" ? "he-IL" : "en-US", {
    year: "numeric", month: "short", day: "numeric",
  });

  return (
    <div style={{ minHeight: "100vh", background: "#fafafa" }} dir={isRtl ? "rtl" : "ltr"}>
      {/* ── Breadcrumb ── */}
      <div style={{ background: "#fff", borderBottom: "1px solid #f0f0f5" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "10px 20px", display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#9ca3af" }}>
          <Link href="/free/browse" style={{ display: "flex", alignItems: "center", gap: 4, color: "#9ca3af", textDecoration: "none" }}>
            <ArrowLeft style={{ width: 14, height: 14 }} />
            {isRtl ? "חזרה" : "Back"}
          </Link>
          <span style={{ color: "#d1d5db" }}>/</span>
          {file.category && (
            <>
              <Link
                href={`/free/browse?category=${encodeURIComponent(file.category)}`}
                style={{ color: "#9ca3af", textDecoration: "none" }}
              >
                {file.category}
              </Link>
              <span style={{ color: "#d1d5db" }}>/</span>
            </>
          )}
          <span style={{ color: "#4b5563", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</span>
        </div>
      </div>

      {/* ── Main Content ── */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 20px 60px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 32 }}>
          {/* For larger screens, use side-by-side layout */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 400px), 1fr))", gap: 32 }}>
            {/* ── Preview ── */}
            <div style={{
              background: "#fff",
              borderRadius: 20,
              overflow: "hidden",
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
              border: "1px solid #f0f0f5",
            }}>
              <div style={{
                aspectRatio: "1",
                background: "linear-gradient(135deg, #fafafa, #f3f4f6)",
                display: "flex", alignItems: "center", justifyContent: "center",
                padding: 32,
                position: "relative",
              }}>
                {file.svgPreview ? (
                  <div
                    style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}
                    dangerouslySetInnerHTML={{ __html: file.svgPreview }}
                  />
                ) : file.previewImageUrl ? (
                  <img
                    src={file.previewImageUrl}
                    alt={title}
                    style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
                  />
                ) : (
                  <Layers style={{ width: 80, height: 80, color: "#e5e7eb" }} />
                )}

                {/* Free badge */}
                <div style={{ position: "absolute", top: 16, [isRtl ? "right" : "left"]: 16 }}>
                  <span style={{
                    padding: "4px 12px", borderRadius: 8,
                    fontSize: 11, fontWeight: 700, color: "#fff",
                    background: "linear-gradient(135deg, #0d9488, #14b8a6)",
                    boxShadow: "0 2px 8px rgba(13,148,136,0.3)",
                  }}>
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
                <p style={{ fontSize: 15, color: "#6b7280", marginBottom: 20, lineHeight: 1.7 }}>
                  {description}
                </p>
              )}

              {/* Meta info cards */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
                {file.category && (
                  <Link
                    href={`/free/browse?category=${encodeURIComponent(file.category)}`}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      padding: "6px 12px", borderRadius: 8,
                      background: "#f0fdfa", color: "#0d9488",
                      fontSize: 12, fontWeight: 600, textDecoration: "none",
                      border: "1px solid #ccfbf1",
                    }}
                  >
                    <Tag style={{ width: 12, height: 12 }} />
                    {file.category}
                  </Link>
                )}
                {file.lineCount != null && file.lineCount > 0 && (
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "6px 12px", borderRadius: 8,
                    background: "#f9fafb", color: "#6b7280",
                    fontSize: 12, fontWeight: 500,
                    border: "1px solid #f0f0f5",
                  }}>
                    <Layers style={{ width: 12, height: 12 }} />
                    {file.lineCount.toLocaleString()} {isRtl ? "קווים" : "lines"}
                  </span>
                )}
                {file.downloadCount != null && file.downloadCount > 0 && (
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "6px 12px", borderRadius: 8,
                    background: "#f9fafb", color: "#6b7280",
                    fontSize: 12, fontWeight: 500,
                    border: "1px solid #f0f0f5",
                  }}>
                    <Download style={{ width: 12, height: 12 }} />
                    {file.downloadCount} {isRtl ? "הורדות" : "downloads"}
                  </span>
                )}
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "6px 12px", borderRadius: 8,
                  background: "#f9fafb", color: "#6b7280",
                  fontSize: 12, fontWeight: 500,
                  border: "1px solid #f0f0f5",
                }}>
                  <Calendar style={{ width: 12, height: 12 }} />
                  {date}
                </span>
              </div>

              {/* Tags */}
              {tags.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 24 }}>
                  {tags.map((tag) => (
                    <Link
                      key={tag}
                      href={`/free/browse?search=${encodeURIComponent(tag)}`}
                      style={{
                        padding: "4px 10px", borderRadius: 12,
                        fontSize: 11, fontWeight: 500,
                        background: "#f9fafb", color: "#6b7280",
                        textDecoration: "none",
                        border: "1px solid #e5e7eb",
                        transition: "all 0.15s",
                      }}
                    >
                      #{tag}
                    </Link>
                  ))}
                </div>
              )}

              {/* Download button */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <button
                  onClick={handleDownload}
                  disabled={downloading}
                  style={{
                    width: "100%",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                    padding: "16px 24px", borderRadius: 14,
                    fontSize: 16, fontWeight: 700, color: "#fff",
                    background: "linear-gradient(135deg, #0d9488, #0891b2)",
                    border: "none", cursor: "pointer",
                    boxShadow: "0 4px 20px rgba(13,148,136,0.3)",
                    opacity: downloading ? 0.6 : 1,
                    transition: "all 0.15s",
                  }}
                >
                  {downloading ? (
                    <>
                      <div style={{ width: 20, height: 20, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                      {isRtl ? "מוריד..." : "Downloading..."}
                    </>
                  ) : appUser ? (
                    <>
                      <Download style={{ width: 20, height: 20 }} />
                      {isRtl ? "הורד קובץ DXF" : "Download DXF File"}
                    </>
                  ) : (
                    <>
                      <Lock style={{ width: 20, height: 20 }} />
                      {isRtl ? "התחבר כדי להוריד" : "Login to Download"}
                    </>
                  )}
                </button>

                <button
                  onClick={handleShare}
                  style={{
                    width: "100%",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
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
              <div style={{
                marginTop: 28, padding: 16, borderRadius: 14,
                background: "linear-gradient(135deg, #f0fdfa, #ccfbf1)",
                border: "1px solid #99f6e4",
              }}>
                <p style={{ fontSize: 12, color: "#0d9488", fontWeight: 600, marginBottom: 8 }}>
                  {isRtl ? "נוצר עם" : "Created with"}
                </p>
                <Link
                  href="/"
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 8,
                    fontSize: 14, fontWeight: 700, color: "#042f2e",
                    textDecoration: "none",
                  }}
                >
                  <div style={{
                    width: 28, height: 28, borderRadius: 7,
                    background: "linear-gradient(135deg, #0d9488, #0891b2)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <Zap style={{ width: 14, height: 14, color: "#fff" }} />
                  </div>
                  dxfai.ai — AI-Powered DXF Creation
                </Link>
                <p style={{ fontSize: 12, color: "#6b7280", marginTop: 8, lineHeight: 1.5 }}>
                  {isRtl
                    ? "צרו קבצי DXF משלכם עם AI. המרת תמונות, יצירת עיצובים ועוד."
                    : "Create your own DXF files with AI. Convert images, generate designs, and more."}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

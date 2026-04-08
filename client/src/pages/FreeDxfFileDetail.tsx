/**
 * FreeDXF File Detail — view and download a shared DXF file at /free/file/:id
 * Download formats: DXF, PDF, SVG
 */
import { useState, useEffect, useRef } from "react";
import { Link, useParams, useLocation } from "wouter";
import { Download, ArrowLeft, Layers, Lock, Tag, Calendar, Zap, Share2, ChevronDown, FileCode2, FileText, Code2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { AuthDialog } from "@/components/AuthDialog";
import { saveFileAs } from "@/lib/saveFileAs";

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

type DownloadFormat = "dxf" | "pdf" | "svg";

// ─── PDF generation (client-side via jsPDF + server svg-to-png) ──────────────
async function generatePdfBlob(svgContent: string): Promise<ArrayBuffer> {
  const { jsPDF } = await import("jspdf");
  const vbMatch = svgContent.match(/viewBox=["']([^"']+)["']/);
  let svgAspect = 1;
  if (vbMatch) {
    const parts = vbMatch[1].trim().split(/[\s,]+/);
    if (parts.length === 4) {
      const vbW = parseFloat(parts[2]);
      const vbH = parseFloat(parts[3]);
      if (vbW > 0 && vbH > 0) svgAspect = vbH / vbW;
    }
  }
  const A4_W = 210, A4_H = 297;
  let pdfW = A4_W, pdfH = pdfW * svgAspect;
  if (pdfH > A4_H) { pdfH = A4_H; pdfW = pdfH / svgAspect; }
  if (pdfW < 10) pdfW = 10;
  if (pdfH < 10) pdfH = 10;
  const PX_PER_MM = 96 / 25.4;
  const widthPx = Math.min(Math.round(pdfW * PX_PER_MM * 2), 3000);
  const heightPx = Math.min(Math.round(pdfH * PX_PER_MM * 2), 3000);
  let sanitized = svgContent
    .replace(/<path([^>]*[^/])>/g, '<path$1/>')
    .replace(/<path>/g, '<path/>')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<foreignObject[^>]*>[\s\S]*?<\/foreignObject>/gi, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  const svgStart = sanitized.search(/<(?:\?xml|svg)/i);
  if (svgStart > 0) sanitized = sanitized.slice(svgStart);
  if (!sanitized.includes('xmlns=')) sanitized = sanitized.replace(/<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
  const pngRes = await fetch("/api/svg-to-png", {
    method: "POST", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ svgContent: sanitized, widthPx, heightPx }),
  });
  if (!pngRes.ok) throw new Error(`SVG-to-PNG failed: ${pngRes.status}`);
  const pngBlob = await pngRes.blob();
  const imgData = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(pngBlob);
  });
  const pdf = new jsPDF({ orientation: pdfW >= pdfH ? "landscape" : "portrait", unit: "mm", format: [pdfW, pdfH] });
  pdf.addImage(imgData, "PNG", 0, 0, pdfW, pdfH);
  return pdf.output("arraybuffer") as ArrayBuffer;
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
  const [authOpen, setAuthOpen] = useState(false);
  const [formatMenuOpen, setFormatMenuOpen] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<DownloadFormat>("dxf");
  const pendingDownload = useRef<DownloadFormat | null>(null);
  const formatMenuRef = useRef<HTMLDivElement>(null);

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
      .then(r => { if (!r.ok) throw new Error("File not found"); return r.json(); })
      .then(res => setFile(res.file))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  // Close format menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (formatMenuRef.current && !formatMenuRef.current.contains(e.target as Node)) {
        setFormatMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const getTitle = () => {
    if (!file) return "";
    return (language === "he" && file.titleHe) ? file.titleHe : (file.title || "Untitled");
  };

  const getCleanFilename = () => {
    const title = getTitle() || `freedxf-${id}`;
    return title.replace(/[^\w\s\u0590-\u05FF._-]/g, "_").replace(/\s+/g, "_").slice(0, 40);
  };

  const getSvgContent = async (): Promise<string> => {
    // Use cached svgPreview if available and complete
    if (file?.svgPreview) {
      let svg = file.svgPreview;
      if (!svg.trim().endsWith('</svg>')) svg += '\n</svg>';
      return svg;
    }
    // Fetch from API
    const resp = await fetch(`/api/freedxf/files/${id}`);
    if (!resp.ok) throw new Error("Failed to fetch file");
    const data = await resp.json();
    const svg = data.file?.svgPreview;
    if (!svg) throw new Error(isRtl ? "אין תצוגת SVG לקובץ זה" : "No SVG preview available");
    return svg.trim().endsWith('</svg>') ? svg : svg + '\n</svg>';
  };

  const triggerDownload = async (fmt: DownloadFormat) => {
    if (!file) throw new Error("No file");
    const baseName = getCleanFilename();

    if (fmt === "dxf") {
      const resp = await fetch(`/api/freedxf/files/${file.id}/download-file`, { credentials: "include" });
      if (!resp.ok) throw new Error("Download failed");
      const blob = await resp.blob();
      await saveFileAs({ blob, filename: `${baseName}.dxf`, mimeType: "application/octet-stream" });
      return;
    }

    const svgContent = await getSvgContent();

    if (fmt === "svg") {
      let cleanSvg = svgContent;
      if (!cleanSvg.includes('xmlns=')) cleanSvg = cleanSvg.replace(/<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
      const blob = new Blob([cleanSvg], { type: "image/svg+xml" });
      await saveFileAs({ blob, filename: `${baseName}.svg`, mimeType: "application/octet-stream" });
      return;
    }

    if (fmt === "pdf") {
      const pdfBytes = await generatePdfBlob(svgContent);
      const blob = new Blob([pdfBytes], { type: "application/pdf" });
      await saveFileAs({ blob, filename: `${baseName}.pdf`, mimeType: "application/pdf" });
      return;
    }
  };

  const handleDownload = async (fmt: DownloadFormat = selectedFormat) => {
    if (!file) return;
    if (!appUser) {
      pendingDownload.current = fmt;
      setAuthOpen(true);
      return;
    }
    setDownloading(true);
    setFormatMenuOpen(false);
    try {
      await triggerDownload(fmt);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      const msg = err instanceof Error ? err.message : String(err);
      alert(msg || (isRtl ? "ההורדה נכשלה" : "Download failed"));
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

  const formats: { id: DownloadFormat; label: string; icon: React.ReactNode; desc: string }[] = [
    { id: "dxf", label: "DXF", icon: <FileCode2 style={{ width: 15, height: 15 }} />, desc: isRtl ? "קובץ וקטורי לתוכנות CAD" : "Vector file for CAD software" },
    { id: "pdf", label: "PDF", icon: <FileText style={{ width: 15, height: 15 }} />, desc: isRtl ? "מסמך להדפסה ושיתוף" : "Document for printing & sharing" },
    { id: "svg", label: "SVG", icon: <Code2 style={{ width: 15, height: 15 }} />, desc: isRtl ? "גרפיקה וקטורית לאינטרנט" : "Vector graphic for web & design" },
  ];

  const selectedFmt = formats.find(f => f.id === selectedFormat)!;

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
          <Layers style={{ width: 32, height: 32, color: "#99f6e4" }} />
        </div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#042f2e" }}>{error || "File not found"}</h2>
        <Link href="/free" style={{ padding: "10px 24px", borderRadius: 10, background: "linear-gradient(135deg, #0d9488, #0891b2)", color: "#fff", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
          {isRtl ? "לכל הקבצים" : "Browse All Files"}
        </Link>
      </div>
    );
  }

  const title = getTitle();
  const description = (language === "he" && file.descriptionHe) ? file.descriptionHe : file.description;
  const tags = file.tags?.split(",").map(t => t.trim()).filter(Boolean) || [];
  const date = new Date(file.createdAt).toLocaleDateString(language === "he" ? "he-IL" : "en-US", { year: "numeric", month: "short", day: "numeric" });

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
            <div style={{ aspectRatio: "1", background: "linear-gradient(135deg, #fafafa, #f3f4f6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 32, position: "relative" }}>
              {file.previewImageUrl ? (
                <img
                  src={`/api/freedxf/image-proxy?url=${encodeURIComponent(file.previewImageUrl)}`}
                  alt={title}
                  style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
                />
              ) : file.svgPreview ? (
                <div
                  style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}
                  dangerouslySetInnerHTML={{ __html:
                    (file.svgPreview.includes('</svg>') ? file.svgPreview : file.svgPreview + '</svg>')
                      .replace(/stroke-width="[^"]*"/g, 'stroke-width="1.5"')
                      .replace(/stroke="[^"]*"/g, 'stroke="#0f766e"')
                      .replace(/fill="none"/g, 'fill="#ccfbf1"')
                      .replace(/<svg([^>]*)>/, '<svg$1 width="100%" height="100%" preserveAspectRatio="xMidYMid meet">')
                  }}
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

            {/* Creator credit */}
            {file.creatorName && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, padding: "10px 14px", borderRadius: 10, background: "#f0fdfa", border: "1px solid #ccfbf1" }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg, #0d9488, #0891b2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ color: "#fff", fontSize: 12, fontWeight: 800 }}>{file.creatorName.charAt(0).toUpperCase()}</span>
                </div>
                <div>
                  <p style={{ fontSize: 11, color: "#6b7280", margin: 0 }}>{isRtl ? "עוצב על ידי" : "Designed by"}</p>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "#042f2e", margin: 0 }}>{file.creatorName}</p>
                </div>
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
              {/* Combined download button + format picker */}
              <div style={{ display: "flex", gap: 0, borderRadius: 14, overflow: "visible", position: "relative" }}>
                {/* Main download button */}
                <button
                  onClick={() => handleDownload(selectedFormat)}
                  disabled={downloading}
                  style={{
                    flex: 1,
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                    padding: "16px 20px",
                    fontSize: 15, fontWeight: 700, color: "#fff",
                    background: "linear-gradient(135deg, #0d9488, #0891b2)",
                    border: "none", cursor: downloading ? "wait" : "pointer",
                    borderRadius: isRtl ? "0 14px 14px 0" : "14px 0 0 14px",
                    opacity: downloading ? 0.7 : 1,
                    boxShadow: "0 4px 20px rgba(13,148,136,0.3)",
                    transition: "opacity 0.15s",
                  }}
                >
                  {downloading ? (
                    <>
                      <div style={{ width: 18, height: 18, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                      {isRtl ? "מוריד..." : "Downloading..."}
                    </>
                  ) : appUser ? (
                    <>
                      {selectedFmt.icon}
                      {isRtl ? `הורד ${selectedFmt.label}` : `Download ${selectedFmt.label}`}
                    </>
                  ) : (
                    <>
                      <Lock style={{ width: 18, height: 18 }} />
                      {isRtl ? "התחבר להורדה" : "Login to Download"}
                    </>
                  )}
                </button>

                {/* Format picker dropdown */}
                <div ref={formatMenuRef} style={{ position: "relative", flexShrink: 0 }}>
                  <button
                    onClick={() => setFormatMenuOpen(v => !v)}
                    disabled={downloading}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "center",
                      padding: "16px 14px",
                      background: "linear-gradient(135deg, #0b7a70, #0779a0)",
                      border: "none",
                      borderLeft: isRtl ? "none" : "1px solid rgba(255,255,255,0.2)",
                      borderRight: isRtl ? "1px solid rgba(255,255,255,0.2)" : "none",
                      borderRadius: isRtl ? "14px 0 0 14px" : "0 14px 14px 0",
                      color: "#fff", cursor: "pointer",
                      boxShadow: "0 4px 20px rgba(13,148,136,0.3)",
                      transition: "background 0.15s",
                    }}
                    title={isRtl ? "בחר פורמט" : "Choose format"}
                  >
                    <ChevronDown style={{ width: 16, height: 16, transform: formatMenuOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
                  </button>

                  {/* Dropdown menu */}
                  {formatMenuOpen && (
                    <div style={{
                      position: "absolute",
                      top: "calc(100% + 8px)",
                      right: isRtl ? "auto" : 0,
                      left: isRtl ? 0 : "auto",
                      background: "#fff", borderRadius: 14,
                      boxShadow: "0 8px 32px rgba(0,0,0,0.14)",
                      border: "1px solid #f0f0f5",
                      overflow: "hidden", zIndex: 200,
                      minWidth: 230,
                    }}>
                      <div style={{ padding: "8px 12px 6px", fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        {isRtl ? "בחר פורמט הורדה" : "Choose download format"}
                      </div>
                      {formats.map(fmt => (
                        <button
                          key={fmt.id}
                          onClick={() => { setSelectedFormat(fmt.id); setFormatMenuOpen(false); handleDownload(fmt.id); }}
                          style={{
                            width: "100%", display: "flex", alignItems: "center", gap: 12,
                            padding: "10px 14px",
                            background: selectedFormat === fmt.id ? "#f0fdfa" : "#fff",
                            border: "none", cursor: "pointer",
                            textAlign: isRtl ? "right" : "left",
                            transition: "background 0.1s",
                            borderTop: "1px solid #f9fafb",
                          }}
                        >
                          <div style={{
                            width: 34, height: 34, borderRadius: 9,
                            background: selectedFormat === fmt.id ? "linear-gradient(135deg, #0d9488, #0891b2)" : "#f3f4f6",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            color: selectedFormat === fmt.id ? "#fff" : "#6b7280",
                            flexShrink: 0,
                          }}>
                            {fmt.icon}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{fmt.label}</div>
                            <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 1 }}>{fmt.desc}</div>
                          </div>
                          {selectedFormat === fmt.id && (
                            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#0d9488", flexShrink: 0 }} />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

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
        onOpenChange={(open) => {
          setAuthOpen(open);
          if (!open) pendingDownload.current = null;
        }}
        authReason="unregistered"
        initialMode="register"
        onSuccess={(user) => {
          setAppUser({ id: user.id, email: user.email });
          setAuthOpen(false);
          const fmt = pendingDownload.current;
          if (fmt && file) {
            pendingDownload.current = null;
            setTimeout(() => {
              setDownloading(true);
              triggerDownload(fmt)
                .catch(err => {
                  if (err instanceof Error && err.name !== "AbortError") {
                    alert(err.message || (isRtl ? "ההורדה נכשלה" : "Download failed"));
                  }
                })
                .finally(() => setDownloading(false));
            }, 400);
          }
        }}
      />
    </div>
  );
}

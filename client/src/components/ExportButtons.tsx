/**
 * ExportButtons — unified export row used by ALL 4 feature tabs:
 *   [DXF]  [PDF]  [הצג וקטור / חזר לתמונה]  [אפשרויות נוספות]
 *
 * Props:
 *   svgContent      — SVG string for PDF generation and vector preview
 *   dxfUrl          — URL to download raw DXF
 *   dxfFilename     — suggested filename (without extension)
 *   svgWidthPx      — SVG width in pixels (used for PDF aspect ratio)
 *   svgHeightPx     — SVG height in pixels
 *   dpiOverride     — if the px values are at a non-96 DPI, pass the DPI here
 *   showVector      — controlled: whether vector preview is visible
 *   onToggleVector  — called when the vector toggle button is clicked
 *   onMoreOptions   — called when "אפשרויות נוספות" is clicked (opens DxfDownloadDialog)
 *   isRtl           — language direction
 *   layout          — "row" (default, 3-col grid) | "inline" (flex row, compact)
 */
import { useState } from "react";
import { Download, FileText, Eye, Loader2, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { saveFileAs } from "@/lib/saveFileAs";
import { useLanguage } from "@/contexts/LanguageContext";

export interface ExportButtonsProps {
  svgContent: string;
  dxfUrl: string;
  dxfFilename: string;
  svgWidthPx?: number;
  svgHeightPx?: number;
  /** Pass actual DPI if SVG dimensions were measured at non-96 DPI (e.g. scan tab uses 300 DPI) */
  dpiOverride?: number;
  showVector: boolean;
  onToggleVector: () => void;
  onMoreOptions: () => void;
  isRtl: boolean;
  layout?: "row" | "inline";
}

// ─── Filename helper ────────────────────────────────────────────────────────
/** Truncate a filename base to max 30 chars, stripping any extension first */
export function truncateFilename(name: string, maxLen = 30): string {
  let base = name
    .replace(/https?:\/\/[^\s]*/gi, "")     // strip full URLs
    .replace(/\b[\w-]+\.(com|net|org|ai|io|co|app|dev|pdf|dxf|png|jpg|svg)\b/gi, "") // strip domain-like tokens
    .replace(/\.dxf$/i, "")                  // strip .dxf extension
    .replace(/[^\w\s\u0590-\u05FF._-]/g, " ") // keep only safe chars
    .replace(/\s+/g, "_")                    // spaces → underscores
    .replace(/_{2,}/g, "_")                  // collapse multiple underscores
    .replace(/^[_.-]+|[_.-]+$/g, "")          // trim leading/trailing punctuation
    .trim();
  if (!base) base = "design";
  if (base.length <= maxLen) return base;
  return base.slice(0, maxLen).replace(/[_.-]+$/, "");
}

// ─── Shared download helper ─────────────────────────────────────────────────
async function downloadBlob(blob: Blob, filename: string): Promise<void> {
  const ext = filename.split(".").pop()?.toLowerCase();
  const mimeType = ext === "pdf" ? "application/pdf" : "application/octet-stream";
  await saveFileAs({ blob, filename, mimeType });
}

// ─── SVG sanitizer ──────────────────────────────────────────────────────────
function sanitizeSvg(svgContent: string): string {
  let s = svgContent;
  s = s.replace(/<path([^>]*[^/])>/g, '<path$1/>');
  s = s.replace(/<path>/g, '<path/>');
  s = s.replace(/<circle([^>]*[^/])>/g, '<circle$1/>');
  s = s.replace(/<rect([^>]*[^/])>/g, '<rect$1/>');
  s = s.replace(/<ellipse([^>]*[^/])>/g, '<ellipse$1/>');
  s = s.replace(/<line([^>]*[^/])>/g, '<line$1/>');
  s = s.replace(/<polygon([^>]*[^/])>/g, '<polygon$1/>');
  s = s.replace(/<polyline([^>]*[^/])>/g, '<polyline$1/>');
  s = s.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  s = s.replace(/<foreignObject[^>]*>[\s\S]*?<\/foreignObject>/gi, '');
  s = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  const svgIdx = s.search(/<(?:\?xml|svg)/i);
  if (svgIdx > 0) s = s.slice(svgIdx);
  if (!s.includes('xmlns=')) {
    s = s.replace(/<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
  }
  return s;
}

// ─── PDF generation helper — TRUE VECTOR PDF using svg2pdf.js ───────────────
export async function generateAndDownloadPdf(
  svgContent: string,
  widthPx: number,
  heightPx: number,
  dpi: number,
  filename: string,
  isRtl: boolean
): Promise<void> {
  // Extract actual SVG aspect ratio from viewBox (most reliable)
  const vbMatch = svgContent.match(/viewBox=["']([^"']+)["']/);
  let svgAspect = heightPx > 0 && widthPx > 0 ? heightPx / widthPx : 1;
  let vbW = 0, vbH = 0;
  if (vbMatch) {
    const parts = vbMatch[1].trim().split(/[\s,]+/);
    if (parts.length === 4) {
      vbW = parseFloat(parts[2]);
      vbH = parseFloat(parts[3]);
      if (vbW > 0 && vbH > 0) svgAspect = vbH / vbW;
    }
  }

  // Cap to A4 (210×297 mm) preserving aspect ratio
  const A4_W = 210, A4_H = 297;
  const pxToMm = 25.4 / dpi;
  let rawW = widthPx * pxToMm;
  if (rawW <= 0 || !isFinite(rawW)) rawW = A4_W;
  let pdfW = Math.min(rawW, A4_W);
  let pdfH = pdfW * svgAspect;
  if (pdfH > A4_H) { pdfH = A4_H; pdfW = pdfH / svgAspect; }
  if (pdfW < 10) pdfW = 10;
  if (pdfH < 10) pdfH = 10;

  let sanitizedSvg = sanitizeSvg(svgContent);

  // Set explicit mm dimensions so svg2pdf renders at correct size
  if (vbW > 0 && vbH > 0) {
    sanitizedSvg = sanitizedSvg
      .replace(/(<svg[^>]*)\swidth="[^"]*"/g, '$1')
      .replace(/(<svg[^>]*)\sheight="[^"]*"/g, '$1')
      .replace(/<svg/, `<svg width="${pdfW}mm" height="${pdfH}mm"`);
  }

  const baseName = truncateFilename(filename.replace(/\.dxf$/i, ""));

  try {
    // ── TRUE VECTOR path: svg2pdf.js renders SVG paths directly into PDF ──
    const { jsPDF } = await import("jspdf");
    const { svg2pdf } = await import("svg2pdf.js");
    const pdf = new jsPDF({
      orientation: pdfW >= pdfH ? "landscape" : "portrait",
      unit: "mm",
      format: [pdfW, pdfH],
    });
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(sanitizedSvg, "image/svg+xml");
    const svgEl = svgDoc.documentElement as unknown as SVGSVGElement;
    await svg2pdf(svgEl, pdf, { x: 0, y: 0, width: pdfW, height: pdfH });
    const pdfBytes = pdf.output("arraybuffer") as ArrayBuffer;
    const pdfBlob = new Blob([pdfBytes], { type: "application/pdf" });
    await downloadBlob(pdfBlob, `${baseName}.pdf`);
  } catch (vectorErr) {
    // ── FALLBACK: rasterized PNG-in-PDF if svg2pdf fails ──
    console.warn("[PDF] svg2pdf failed, falling back to raster:", vectorErr);
    const PX_PER_MM = 96 / 25.4;
    const renderW = Math.min(Math.round(pdfW * PX_PER_MM * 2), 3000);
    const renderH = Math.min(Math.round(pdfH * PX_PER_MM * 2), 3000);
    const pngRes = await fetch("/api/svg-to-png", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ svgContent: sanitizedSvg, widthPx: renderW, heightPx: renderH }),
    });
    if (!pngRes.ok) throw new Error(`SVG-to-PNG failed: ${pngRes.status}`);
    const pngBlob = await pngRes.blob();
    const imgData = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(pngBlob);
    });
    const { jsPDF } = await import("jspdf");
    const pdf = new jsPDF({
      orientation: pdfW >= pdfH ? "landscape" : "portrait",
      unit: "mm",
      format: [pdfW, pdfH],
    });
    pdf.addImage(imgData, "PNG", 0, 0, pdfW, pdfH);
    const pdfBytes = pdf.output("arraybuffer") as ArrayBuffer;
    const pdfBlob2 = new Blob([pdfBytes], { type: "application/pdf" });
    await downloadBlob(pdfBlob2, `${baseName}.pdf`);
  }
}

// ─── Component ────────────────────────────────────────────────────────────────
export function ExportButtons({
  svgContent,
  dxfUrl,
  dxfFilename,
  svgWidthPx = 500,
  svgHeightPx = 500,
  dpiOverride = 96,
  showVector,
  onToggleVector,
  onMoreOptions,
  isRtl,
  layout = "row",
}: ExportButtonsProps) {
  const [isDxfLoading, setIsDxfLoading] = useState(false);
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const { t } = useLanguage();
  const handleDxf = async () => {
    if (isDxfLoading) return;
    setIsDxfLoading(true);
    try {
      const resp = await fetch(dxfUrl);
      if (!resp.ok) throw new Error("שגיאה בהורדת DXF");
      const text = await resp.text();
      const blob = new Blob([text], { type: "application/dxf" });
      const baseName = truncateFilename(dxfFilename);
      await saveFileAs({ blob, filename: `${baseName}.dxf`, mimeType: "application/dxf" });
    } catch {
      // Fallback: direct link
      const a = document.createElement("a");
      a.href = dxfUrl;
      a.download = truncateFilename(dxfFilename) + ".dxf";
      a.click();
    } finally {
      setIsDxfLoading(false);
    }
  };
  const handlePdf = async () => {
    if (isPdfLoading || !svgContent) return;
    setIsPdfLoading(true);
    try {
      await generateAndDownloadPdf(
        svgContent,
        svgWidthPx,
        svgHeightPx,
        dpiOverride,
        dxfFilename,
        isRtl
      );
    } catch (err) {
      console.error("PDF error:", err);
      toast.error(isRtl ? "שגיאה בייצוא PDF" : "PDF export error");
    } finally {
      setIsPdfLoading(false);
    }
  };
  if (layout === "inline") {
    // Compact horizontal layout for portrait cards
    return (
      <div className="flex gap-1.5">
        <button
          onClick={onMoreOptions}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all hover:opacity-90"
          style={{ background: 'linear-gradient(135deg, #059669, #10b981)', color: "white", border: "none", boxShadow: '0 2px 8px rgba(5,150,105,0.3)' }}
        >
          <Download className="w-3.5 h-3.5" />
          {t("downloadFileBtn")}
        </button>
        <button
          onClick={onToggleVector}
          className="flex items-center justify-center gap-1.5 px-2.5 py-2.5 rounded-xl text-xs font-semibold transition-all hover:opacity-90"
          style={showVector
            ? { background: 'linear-gradient(135deg, #7c3aed, #8b5cf6)', color: 'white', border: 'none', boxShadow: '0 2px 8px rgba(124,58,237,0.3)' }
            : { background: '#f5f3ff', color: '#7c3aed', border: '1px solid #ddd6fe' }}
        >
          <Eye className="w-3.5 h-3.5" />
          {showVector ? t("photoBtn") : t("vectorBtn")}
        </button>
      </div>
    );
  }
  // Default layout: Download button + Vector toggle (used by AI Trace, AI Redraw, AI Generate)
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2">
        {/* Download file — opens DxfDownloadDialog */}
        <button
          id="tour-download"
          onClick={onMoreOptions}
          data-track="download"
          className="flex flex-col items-center justify-center gap-1.5 py-3.5 rounded-2xl font-bold text-sm transition-all hover:opacity-90 hover:scale-[1.02] active:scale-[0.98]"
          style={{ background: 'linear-gradient(135deg, #059669, #10b981)', color: "white", border: "none", boxShadow: "0 4px 14px rgba(5,150,105,0.35)" }}
        >
          <Download className="w-5 h-5" />
          <span className="text-xs font-black tracking-wide">{t("downloadFileBtn")}</span>
        </button>
        {/* Vector toggle */}
        <button
          onClick={onToggleVector}
          className="flex flex-col items-center justify-center gap-1.5 py-3.5 rounded-2xl font-bold text-sm transition-all hover:opacity-90 hover:scale-[1.02] active:scale-[0.98]"
          style={showVector
            ? { background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: "white", border: "none", boxShadow: "0 4px 14px rgba(99,102,241,0.35)" }
            : { background: "#f5f3ff", border: "1.5px solid #c4b5fd", color: "#6366f1" }}
        >
          <Eye className="w-5 h-5" />
          <span className="text-xs font-black tracking-wide">{showVector ? t("photoBtn") : t("vectorBtn")}</span>
        </button>
      </div>
    </div>
  );
}

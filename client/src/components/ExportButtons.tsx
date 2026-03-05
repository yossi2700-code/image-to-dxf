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
  const base = name.replace(/\.[^.]+$/, "").trim(); // strip extension
  if (base.length <= maxLen) return base;
  return base.slice(0, maxLen).trimEnd();
}

// ─── PDF generation helper (shared logic) ────────────────────────────────────
export async function generateAndDownloadPdf(
  svgContent: string,
  widthPx: number,
  heightPx: number,
  dpi: number,
  filename: string,
  isRtl: boolean
): Promise<void> {
  // Convert px at given DPI to mm
  const pxToMm = 25.4 / dpi;

  // Extract actual SVG aspect ratio from viewBox (most reliable)
  const vbMatch = svgContent.match(/viewBox=["']([^"']+)["']/);
  let svgAspect = heightPx > 0 && widthPx > 0 ? heightPx / widthPx : 1;
  if (vbMatch) {
    const parts = vbMatch[1].trim().split(/[\s,]+/);
    if (parts.length === 4) {
      const vbW = parseFloat(parts[2]);
      const vbH = parseFloat(parts[3]);
      if (vbW > 0 && vbH > 0) svgAspect = vbH / vbW;
    }
  }

  // Cap to A4 (210×297 mm) preserving aspect ratio
  const A4_W = 210, A4_H = 297;
  let rawW = widthPx * pxToMm;
  if (rawW <= 0 || !isFinite(rawW)) rawW = A4_W;
  let pdfW = Math.min(rawW, A4_W);
  let pdfH = pdfW * svgAspect;
  if (pdfH > A4_H) { pdfH = A4_H; pdfW = pdfH / svgAspect; }
  if (pdfW < 10) pdfW = 10;
  if (pdfH < 10) pdfH = 10;

  const PX_PER_MM = 96 / 25.4;
  const renderW = Math.min(Math.round(pdfW * PX_PER_MM * 2), 3000);
  const renderH = Math.min(Math.round(pdfH * PX_PER_MM * 2), 3000);

  const pngRes = await fetch("/api/svg-to-png", {
    method: "POST", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ svgContent, widthPx: renderW, heightPx: renderH }),
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
  const pdfBlob = new Blob([pdfBytes], { type: "application/pdf" });
  const baseName = truncateFilename(filename.replace(/\.dxf$/i, ""));
  const pdfFile = new File([pdfBlob], `${baseName}.pdf`, { type: "application/pdf" });

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  if (isIOS && navigator.share && navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
    try { await navigator.share({ files: [pdfFile], title: baseName }); return; }
    catch (e: unknown) { if (e instanceof Error && e.name === "AbortError") return; }
  }
  const url = URL.createObjectURL(pdfBlob);
  const a = document.createElement("a");
  a.href = url; a.download = `${baseName}.pdf`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
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

  const handleDxf = async () => {
    if (isDxfLoading) return;
    setIsDxfLoading(true);
    try {
      const resp = await fetch(dxfUrl);
      if (!resp.ok) throw new Error("שגיאה בהורדת DXF");
      const text = await resp.text();
      const blob = new Blob([text], { type: "application/dxf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = truncateFilename(dxfFilename) + ".dxf";
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
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
          onClick={handleDxf}
          disabled={isDxfLoading}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all"
          style={{ background: "#059669", color: "white", border: "none", opacity: isDxfLoading ? 0.7 : 1 }}
        >
          {isDxfLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
          DXF
        </button>
        <button
          onClick={handlePdf}
          disabled={isPdfLoading}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all"
          style={{ background: "#2563eb", color: "white", border: "none", opacity: isPdfLoading ? 0.7 : 1 }}
        >
          {isPdfLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
          PDF
        </button>
        <button
          onClick={onToggleVector}
          className="flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-semibold transition-all"
          style={showVector
            ? { background: "#f3e8ff", color: "#7c3aed", border: "1px solid #d8b4fe" }
            : { background: "#f1f5f9", color: "#6b7280", border: "1px solid #e2e8f0" }}
        >
          <Eye className="w-3.5 h-3.5" />
          {showVector ? (isRtl ? "תמונה" : "Photo") : (isRtl ? "וקטור" : "Vector")}
        </button>
        <button
          onClick={onMoreOptions}
          className="flex items-center justify-center gap-1 py-2 px-2.5 rounded-lg text-xs font-medium transition-all"
          style={{ background: "#f3f4f6", color: "#374151", border: "1px solid #e5e7eb" }}
          title={isRtl ? "אפשרויות נוספות" : "More options"}
        >
          <Settings2 className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  // Default: 3-col grid + more options row (used by AI Trace, AI Redraw, AI Generate)
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-3 gap-2">
        {/* DXF */}
        <button
          onClick={handleDxf}
          disabled={isDxfLoading}
          className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-lg font-semibold text-xs transition-all"
          style={{ background: "#059669", color: "white", border: "none", boxShadow: "0 1px 4px rgba(5,150,105,0.2)", opacity: isDxfLoading ? 0.7 : 1 }}
        >
          {isDxfLoading
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <Download className="w-4 h-4" />}
          DXF
        </button>
        {/* PDF */}
        <button
          onClick={handlePdf}
          disabled={isPdfLoading}
          className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-lg font-semibold text-xs transition-all"
          style={{ background: "#2563eb", color: "white", border: "none", boxShadow: "0 1px 4px rgba(37,99,235,0.2)", opacity: isPdfLoading ? 0.7 : 1 }}
        >
          {isPdfLoading
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <FileText className="w-4 h-4" />}
          PDF
        </button>
        {/* Vector toggle */}
        <button
          onClick={onToggleVector}
          className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-lg font-semibold text-xs transition-all"
          style={showVector
            ? { background: "#7c3aed", color: "white", border: "none", boxShadow: "0 1px 4px rgba(124,58,237,0.2)" }
            : { background: "#f5f3ff", border: "1px solid #ddd6fe", color: "#7c3aed" }}
        >
          <Eye className="w-4 h-4" />
          {showVector ? (isRtl ? "הסתר" : "Hide") : (isRtl ? "וקטור" : "Vector")}
        </button>
      </div>
      {/* More options */}
      <button
        className="w-full py-2 font-medium text-xs rounded-lg flex items-center justify-center gap-1.5 transition-all"
        style={{ background: "#f8fafc", border: "1px solid #e2e8f0", color: "#64748b" }}
        onClick={onMoreOptions}
      >
        <Settings2 className="w-3.5 h-3.5" />
        {isRtl ? "אפשרויות נוספות (שם קובץ, גודל)" : "More options (filename, size)"}
      </button>
    </div>
  );
}

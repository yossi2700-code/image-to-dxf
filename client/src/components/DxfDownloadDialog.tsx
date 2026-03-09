/**
 * DxfDownloadDialog — unified download dialog for ALL features:
 * - Custom filename input
 * - Scale 10%–100% (mm only)
 * - DXF download / share
 * - PDF export / share
 * - SVG mini preview
 *
 * On iOS/Android: all download buttons trigger the native Share Sheet
 * (allows saving to Files, WhatsApp, AirDrop, Mail, etc.)
 * On desktop: standard file download behavior.
 *
 * Used by: Upload tab, AI Generate tab, AI Trace tab, History page
 */
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Download, X, FileCode2, FileText, Loader2, Share2 } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DxfDownloadDialogProps {
  open: boolean;
  onClose: () => void;
  svgContent: string;
  dxfUrl: string;
  defaultFilename: string;
  segmentCount: number;
  /** Original SVG width in px (from potrace/AI output) */
  svgWidth?: number;
  /** Original SVG height in px */
  svgHeight?: number;
}

// ─── Scale DXF content ────────────────────────────────────────────────────────

function scaleDxfContent(dxfText: string, scaleFactor: number): string {
  if (Math.abs(scaleFactor - 1) < 0.0001) return dxfText;
  return dxfText.replace(
    /^(10|11|20|21|30|31)\n(-?[0-9]+\.?[0-9]*(?:[eE][+-]?[0-9]+)?)/gm,
    (_match, group, value) => {
      const scaled = parseFloat(value) * scaleFactor;
      return `${group}\n${scaled.toFixed(4)}`;
    }
  );
}

// ─── PDF Export via jsPDF ─────────────────────────────────────────────────────

async function generatePdfBlob(
  svgContent: string,
  widthMm: number,
  heightMm: number
): Promise<ArrayBuffer> {
  const { jsPDF } = await import("jspdf");

  const vbMatch = svgContent.match(/viewBox=["']([^"']+)["']/);
  let svgAspect = widthMm > 0 && heightMm > 0 ? heightMm / widthMm : 1;
  if (vbMatch) {
    const parts = vbMatch[1].trim().split(/[\s,]+/);
    if (parts.length === 4) {
      const vbW = parseFloat(parts[2]);
      const vbH = parseFloat(parts[3]);
      if (vbW > 0 && vbH > 0) svgAspect = vbH / vbW;
    }
  }

  const A4_W = 210;
  const A4_H = 297;
  let pdfW = Math.min(widthMm, A4_W);
  let pdfH = pdfW * svgAspect;
  if (pdfH > A4_H) {
    pdfH = A4_H;
    pdfW = pdfH / svgAspect;
  }
  if (pdfW < 10) pdfW = 10;
  if (pdfH < 10) pdfH = 10;

  const PX_PER_MM = 96 / 25.4;
  const widthPx = Math.min(Math.round(pdfW * PX_PER_MM * 2), 3000);
  const heightPx = Math.min(Math.round(pdfH * PX_PER_MM * 2), 3000);

  const pngRes = await fetch("/api/svg-to-png", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ svgContent, widthPx, heightPx }),
  });
  if (!pngRes.ok) {
    const err = await pngRes.json().catch(() => ({})) as Record<string, unknown>;
    throw new Error((err.message as string) || `SVG-to-PNG failed: ${pngRes.status}`);
  }

  const pngBlob = await pngRes.blob();
  const imgData = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(pngBlob);
  });

  const pdf = new jsPDF({
    orientation: pdfW >= pdfH ? "landscape" : "portrait",
    unit: "mm",
    format: [pdfW, pdfH],
  });
  pdf.addImage(imgData, "PNG", 0, 0, pdfW, pdfH);
  return pdf.output("arraybuffer") as ArrayBuffer;
}

// ─── Device detection ─────────────────────────────────────────────────────────

function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

function canShareFiles(): boolean {
  return typeof navigator !== "undefined" && !!navigator.share && !!navigator.canShare;
}

// ─── SVG Mini Preview ─────────────────────────────────────────────────────────

function SvgMiniPreview({ svg }: { svg: string }) {
  const styledSvg = svg.replace(
    /<svg /,
    '<svg style="max-width:100%;max-height:100%;width:auto;height:auto;" '
  );
  return (
    <div
      className="border-2 border-border rounded-xl bg-white overflow-hidden flex items-center justify-center p-3"
      style={{ height: 160 }}
    >
      <div
        className="w-full h-full flex items-center justify-center"
        dangerouslySetInnerHTML={{ __html: styledSvg }}
      />
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatMm(mm: number) {
  return `${mm.toFixed(0)} מ"מ`;
}

// ─── Main Dialog ──────────────────────────────────────────────────────────────

const PX_TO_MM = 25.4 / 96;

export function DxfDownloadDialog({
  open,
  onClose,
  svgContent,
  dxfUrl,
  defaultFilename,
  segmentCount,
  svgWidth = 500,
  svgHeight = 500,
}: DxfDownloadDialogProps) {
  const [filename, setFilename] = useState(defaultFilename.replace(/\.dxf$/i, "").slice(0, 30).trimEnd());
  const [scalePercent, setScalePercent] = useState(100);
  const [isDxfLoading, setIsDxfLoading] = useState(false);
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isMobile = isMobileDevice();
  const supportsShare = canShareFiles();
  // On mobile with share support → use share sheet. On desktop → direct download.
  const useShareSheet = isMobile && supportsShare;

  useEffect(() => {
    if (open) {
      setFilename(defaultFilename.replace(/\.dxf$/i, "").slice(0, 30).trimEnd());
      setScalePercent(100);
      setError(null);
    }
  }, [open, defaultFilename]);

  const realWidthMm = svgWidth * PX_TO_MM;
  const realHeightMm = svgHeight * PX_TO_MM;
  const scaleFactor = PX_TO_MM * (scalePercent / 100);
  const outputWidthMm = svgWidth * scaleFactor;
  const outputHeightMm = svgHeight * scaleFactor;
  const cleanFilename = (filename.trim() || "design").slice(0, 30).trimEnd();

  // ── DXF: Share Sheet on mobile, direct download on desktop ───────────────

  const handleDxfAction = async () => {
    setIsDxfLoading(true);
    setError(null);
    try {
      const resp = await fetch(dxfUrl);
      if (!resp.ok) throw new Error("שגיאה בהורדת הקובץ");
      const originalDxf = await resp.text();
      const scaledDxf = scaleDxfContent(originalDxf, scaleFactor);
      const blob = new Blob([scaledDxf], { type: "application/octet-stream" });
      const file = new File([blob], `${cleanFilename}.dxf`, { type: "application/octet-stream" });

      if (useShareSheet && navigator.canShare && navigator.canShare({ files: [file] })) {
        // Mobile: open native Share Sheet
        await navigator.share({ files: [file], title: cleanFilename });
        onClose();
        return;
      }

      // Desktop: direct download
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${cleanFilename}.dxf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      onClose();
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return; // user cancelled share
      console.error("DXF action error:", err);
      // Fallback: direct link
      const a = document.createElement("a");
      a.href = dxfUrl;
      a.download = `${cleanFilename}.dxf`;
      a.click();
      onClose();
    } finally {
      setIsDxfLoading(false);
    }
  };

  // ── PDF: Share Sheet on mobile, direct download on desktop ───────────────

  const handlePdfAction = async () => {
    if (!svgContent) return;
    setIsPdfLoading(true);
    setError(null);
    try {
      const pdfBytes = await generatePdfBlob(svgContent, outputWidthMm, outputHeightMm);
      const blob = new Blob([pdfBytes], { type: "application/pdf" });
      const file = new File([blob], `${cleanFilename}.pdf`, { type: "application/pdf" });

      if (useShareSheet && navigator.canShare && navigator.canShare({ files: [file] })) {
        // Mobile: open native Share Sheet
        await navigator.share({ files: [file], title: cleanFilename });
        onClose();
        return;
      }

      // Desktop: direct download
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${cleanFilename}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      onClose();
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return; // user cancelled share
      console.error("PDF action error:", err);
      const msg = err instanceof Error ? err.message : String(err);
      setError(`שגיאה בייצוא PDF: ${msg}`);
    } finally {
      setIsPdfLoading(false);
    }
  };

  const isLoading = isDxfLoading || isPdfLoading;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !isLoading && onClose()}>
      <DialogContent className="max-w-sm w-full" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-right">
            <FileCode2 className="w-5 h-5 text-primary" />
            הורדת קובץ
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* SVG Preview */}
          {svgContent && <SvgMiniPreview svg={svgContent} />}

          {/* Stats row */}
          <div className="flex items-center justify-between bg-muted/40 rounded-lg px-3 py-2 text-sm">
            <span className="text-muted-foreground">{segmentCount.toLocaleString()} קווים</span>
            <span className="font-semibold text-primary">
              {formatMm(outputWidthMm)} × {formatMm(outputHeightMm)}
            </span>
          </div>

          {/* Filename */}
          <div>
            <label className="text-sm font-semibold block mb-1.5">שם הקובץ</label>
            <div className="flex items-center gap-1.5">
              <Input
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                placeholder="שם הקובץ..."
                className="text-right flex-1 text-sm"
                dir="rtl"
              />
              <span className="text-xs text-muted-foreground shrink-0 font-mono bg-muted px-1.5 py-1 rounded">.dxf / .pdf</span>
            </div>
          </div>

          {/* Scale slider */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold">גודל הפלט</label>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-primary tabular-nums">{scalePercent}%</span>
                <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                  {formatMm(outputWidthMm)} × {formatMm(outputHeightMm)}
                </span>
              </div>
            </div>
            <Slider
              min={10}
              max={100}
              step={5}
              value={[scalePercent]}
              onValueChange={([v]) => setScalePercent(v)}
              className="mb-2"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>10% ({formatMm(realWidthMm * 0.1)})</span>
              <button
                className="text-primary font-semibold underline underline-offset-2 cursor-pointer"
                onClick={() => setScalePercent(100)}
              >
                גודל אמיתי (100%)
              </button>
              <span>100% ({formatMm(realWidthMm)})</span>
            </div>
          </div>

          {/* Mobile share hint */}
          {useShareSheet && (
            <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-700">
              <Share2 className="w-4 h-4 shrink-0" />
              <span>הקובץ יישלח דרך תפריט השיתוף — שמור לקבצים, WhatsApp, AirDrop ועוד</span>
            </div>
          )}

          {/* Error */}
          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          {/* Action buttons */}
          <div className="flex flex-col gap-2 pt-1">
            {/* DXF button */}
            <Button
              size="lg"
              className="w-full font-bold text-base h-12 text-white hover:opacity-90 transition-all"
              style={{ background: 'linear-gradient(135deg, #059669, #10b981)', border: 'none', boxShadow: '0 3px 10px rgba(5,150,105,0.3)' } as React.CSSProperties}
              onClick={handleDxfAction}
              disabled={isLoading}
            >
              {isDxfLoading ? (
                <Loader2 className="w-5 h-5 ml-2 animate-spin" />
              ) : useShareSheet ? (
                <Share2 className="w-5 h-5 ml-2" />
              ) : (
                <Download className="w-5 h-5 ml-2" />
              )}
              {isDxfLoading ? "מכין..." : useShareSheet ? "שתף / שמור DXF" : "הורד DXF"}
            </Button>

            {/* PDF button */}
            {svgContent && (
              <Button
                size="lg"
                className="w-full font-bold text-base h-12 text-white hover:opacity-90 transition-all"
                style={{ background: 'linear-gradient(135deg, #2563eb, #3b82f6)', border: 'none', boxShadow: '0 3px 10px rgba(37,99,235,0.3)' } as React.CSSProperties}
                onClick={handlePdfAction}
                disabled={isLoading}
              >
                {isPdfLoading ? (
                  <Loader2 className="w-5 h-5 ml-2 animate-spin" />
                ) : useShareSheet ? (
                  <Share2 className="w-5 h-5 ml-2" />
                ) : (
                  <FileText className="w-5 h-5 ml-2" />
                )}
                {isPdfLoading ? "מייצא PDF..." : useShareSheet ? "שתף / שמור PDF" : "הורד PDF"}
              </Button>
            )}

            {/* Cancel */}
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              disabled={isLoading}
              className="w-full text-muted-foreground"
            >
              <X className="w-4 h-4 ml-1" />
              ביטול
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

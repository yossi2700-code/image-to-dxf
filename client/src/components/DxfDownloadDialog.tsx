/**
 * DxfDownloadDialog — unified download dialog for ALL features:
 * - Custom filename input
 * - Scale 10%–100% (mm only)
 * - DXF download with scaling
 * - PDF export via jspdf + svg2pdf (actual file, not browser print)
 * - SVG mini preview
 *
 * Used by: Upload tab, AI Generate tab, AI Trace tab, History page
 */
import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Download, X, FileCode2, FileText, Loader2 } from "lucide-react";

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

// ─── PDF Export via jspdf + svg2pdf ──────────────────────────────────────────

async function exportToPdf(
  svgContent: string,
  widthMm: number,
  heightMm: number,
  filename: string
): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const { svg2pdf } = await import("svg2pdf.js");

  // Parse SVG into DOM element
  const parser = new DOMParser();
  const svgDoc = parser.parseFromString(svgContent, "image/svg+xml");
  const svgEl = svgDoc.querySelector("svg");
  if (!svgEl) throw new Error("Invalid SVG");

  // Set explicit dimensions on the SVG element
  svgEl.setAttribute("width", `${widthMm}mm`);
  svgEl.setAttribute("height", `${heightMm}mm`);

  // Append temporarily to DOM (svg2pdf needs it in the document)
  svgEl.style.position = "absolute";
  svgEl.style.top = "-9999px";
  svgEl.style.left = "-9999px";
  document.body.appendChild(svgEl);

  try {
    const orientation = widthMm >= heightMm ? "landscape" : "portrait";
    const pdf = new jsPDF({
      orientation,
      unit: "mm",
      format: [widthMm, heightMm],
    });

    await svg2pdf(svgEl, pdf, {
      x: 0,
      y: 0,
      width: widthMm,
      height: heightMm,
    });

    pdf.save(`${filename}.pdf`);
  } finally {
    document.body.removeChild(svgEl);
  }
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
  const [filename, setFilename] = useState(defaultFilename.replace(/\.dxf$/i, ""));
  const [scalePercent, setScalePercent] = useState(100);
  const [isDxfLoading, setIsDxfLoading] = useState(false);
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setFilename(defaultFilename.replace(/\.dxf$/i, ""));
      setScalePercent(100);
      setError(null);
    }
  }, [open, defaultFilename]);

  // Physical size at 100%
  const realWidthMm = svgWidth * PX_TO_MM;
  const realHeightMm = svgHeight * PX_TO_MM;

  // Scale factor: px→mm AND user percentage
  const scaleFactor = PX_TO_MM * (scalePercent / 100);
  const outputWidthMm = svgWidth * scaleFactor;
  const outputHeightMm = svgHeight * scaleFactor;

  const cleanFilename = filename.trim() || "design";

  // ── DXF Download ──────────────────────────────────────────────────────────

  const handleDxfDownload = async () => {
    setIsDxfLoading(true);
    setError(null);
    try {
      const resp = await fetch(dxfUrl);
      if (!resp.ok) throw new Error("שגיאה בהורדת הקובץ");
      const originalDxf = await resp.text();
      const scaledDxf = scaleDxfContent(originalDxf, scaleFactor);
      const blob = new Blob([scaledDxf], { type: "application/dxf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${cleanFilename}.dxf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      onClose();
    } catch (err) {
      console.error("DXF download error:", err);
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

  // ── PDF Export ────────────────────────────────────────────────────────────

  const handlePdfExport = async () => {
    if (!svgContent) return;
    setIsPdfLoading(true);
    setError(null);
    try {
      await exportToPdf(svgContent, outputWidthMm, outputHeightMm, cleanFilename);
    } catch (err) {
      console.error("PDF export error:", err);
      setError("שגיאה בייצוא PDF. נסה שוב.");
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

          {/* Error */}
          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          {/* Action buttons */}
          <div className="flex flex-col gap-2 pt-1">
            {/* DXF Download */}
            <Button
              size="lg"
              className="w-full bg-green-600 hover:bg-green-700 font-bold text-base h-12"
              onClick={handleDxfDownload}
              disabled={isLoading}
            >
              {isDxfLoading ? (
                <Loader2 className="w-5 h-5 ml-2 animate-spin" />
              ) : (
                <Download className="w-5 h-5 ml-2" />
              )}
              {isDxfLoading ? "מוריד..." : "הורד DXF"}
            </Button>

            {/* PDF Export */}
            {svgContent && (
              <Button
                size="lg"
                className="w-full bg-blue-600 hover:bg-blue-700 font-bold text-base h-12 text-white"
                onClick={handlePdfExport}
                disabled={isLoading}
              >
                {isPdfLoading ? (
                  <Loader2 className="w-5 h-5 ml-2 animate-spin" />
                ) : (
                  <FileText className="w-5 h-5 ml-2" />
                )}
                {isPdfLoading ? "מייצא PDF..." : "ייצא PDF"}
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

/**
 * DxfDownloadDialog — dialog for downloading DXF / PDF with:
 * - Custom filename input
 * - Real physical size (based on SVG dimensions at 96 DPI → mm)
 * - Proportional percentage scaling (10% – 100%)
 * - SVG preview
 * - PDF export option
 */
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Download, X, FileCode2, FileText } from "lucide-react";

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

// ─── SVG Mini Preview ─────────────────────────────────────────────────────────

function SvgMiniPreview({ svg }: { svg: string }) {
  const styledSvg = svg.replace(
    /<svg /,
    '<svg style="max-width:100%;max-height:100%;width:auto;height:auto;" '
  );
  return (
    <div className="border-2 border-border rounded-xl bg-white overflow-hidden flex items-center justify-center p-3" style={{ height: 180 }}>
      <div
        className="w-full h-full flex items-center justify-center"
        dangerouslySetInnerHTML={{ __html: styledSvg }}
      />
    </div>
  );
}

// ─── PDF Export ───────────────────────────────────────────────────────────────

async function exportSvgToPdf(svgContent: string, widthMm: number, heightMm: number, filename: string) {
  // Convert SVG to a data URL and print via hidden iframe
  const styledSvg = svgContent.replace(
    /<svg /,
    `<svg style="width:${widthMm}mm;height:${heightMm}mm;" `
  );
  const svgBlob = new Blob([styledSvg], { type: "image/svg+xml" });
  const svgUrl = URL.createObjectURL(svgBlob);

  // Use canvas approach: draw SVG on canvas, export as PDF via print
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.top = "-9999px";
  iframe.style.left = "-9999px";
  iframe.style.width = `${widthMm}mm`;
  iframe.style.height = `${heightMm}mm`;
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!iframeDoc) { URL.revokeObjectURL(svgUrl); document.body.removeChild(iframe); return; }

  iframeDoc.open();
  iframeDoc.write(`<!DOCTYPE html>
<html>
<head>
<style>
  @page { size: ${widthMm}mm ${heightMm}mm; margin: 0; }
  body { margin: 0; padding: 0; background: white; }
  img { width: 100%; height: 100%; display: block; }
</style>
</head>
<body>
  <img src="${svgUrl}" />
</body>
</html>`);
  iframeDoc.close();

  // Wait for image to load then print
  await new Promise<void>((resolve) => {
    const img = iframeDoc.querySelector("img");
    if (img) {
      img.onload = () => resolve();
      setTimeout(resolve, 1500); // fallback
    } else {
      setTimeout(resolve, 500);
    }
  });

  iframe.contentWindow?.focus();
  iframe.contentWindow?.print();

  setTimeout(() => {
    document.body.removeChild(iframe);
    URL.revokeObjectURL(svgUrl);
  }, 2000);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Format mm only */
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
  const [isDownloading, setIsDownloading] = useState(false);
  const [isPdfExporting, setIsPdfExporting] = useState(false);

  useEffect(() => {
    if (open) {
      setFilename(defaultFilename.replace(/\.dxf$/i, ""));
      setScalePercent(100);
    }
  }, [open, defaultFilename]);

  const realWidthMm = svgWidth * PX_TO_MM;
  const realHeightMm = svgHeight * PX_TO_MM;

  // Scale: px→mm AND user percentage
  const scaleFactor = PX_TO_MM * (scalePercent / 100);
  const outputWidthMm = svgWidth * scaleFactor;
  const outputHeightMm = svgHeight * scaleFactor;

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const resp = await fetch(dxfUrl);
      if (!resp.ok) throw new Error("שגיאה בהורדת הקובץ");
      const originalDxf = await resp.text();
      const scaledDxf = scaleDxfContent(originalDxf, scaleFactor);
      const blob = new Blob([scaledDxf], { type: "application/dxf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${filename.trim() || "design"}.dxf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      onClose();
    } catch (err) {
      console.error("Download error:", err);
      const a = document.createElement("a");
      a.href = dxfUrl;
      a.download = `${filename.trim() || "design"}.dxf`;
      a.click();
      onClose();
    } finally {
      setIsDownloading(false);
    }
  };

  const handlePdfExport = async () => {
    setIsPdfExporting(true);
    try {
      await exportSvgToPdf(svgContent, outputWidthMm, outputHeightMm, filename.trim() || "design");
    } finally {
      setIsPdfExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
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
              <span className="text-sm text-muted-foreground shrink-0 font-mono">.dxf</span>
            </div>
          </div>

          {/* Scale */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold">גודל הפלט</label>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-primary tabular-nums">{scalePercent}%</span>
                <span className="text-xs text-muted-foreground">
                  ({formatMm(outputWidthMm)} × {formatMm(outputHeightMm)})
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
              <span>קטן (10%)</span>
              <button
                className="text-primary font-semibold underline underline-offset-2 cursor-pointer"
                onClick={() => setScalePercent(100)}
              >
                גודל אמיתי (100%)
              </button>
              <span>{formatMm(realWidthMm)} × {formatMm(realHeightMm)}</span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-2 pt-1">
            {/* DXF Download */}
            <Button
              size="lg"
              className="w-full bg-green-600 hover:bg-green-700 font-bold text-base h-12"
              onClick={handleDownload}
              disabled={isDownloading || isPdfExporting}
            >
              <Download className="w-5 h-5 ml-2" />
              {isDownloading ? "מוריד..." : "הורד DXF"}
            </Button>

            {/* PDF Export */}
            {svgContent && (
              <Button
                size="lg"
                variant="outline"
                className="w-full border-2 border-blue-500 text-blue-600 hover:bg-blue-50 font-bold text-base h-12"
                onClick={handlePdfExport}
                disabled={isDownloading || isPdfExporting}
              >
                <FileText className="w-5 h-5 ml-2" />
                {isPdfExporting ? "מייצא PDF..." : "ייצא PDF"}
              </Button>
            )}

            {/* Cancel */}
            <Button variant="ghost" size="sm" onClick={onClose} className="w-full text-muted-foreground">
              <X className="w-4 h-4 ml-1" />
              ביטול
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

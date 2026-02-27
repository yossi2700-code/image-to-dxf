/**
 * DxfDownloadDialog — dialog for downloading DXF with:
 * - Custom filename input
 * - Real physical size (based on SVG dimensions at 96 DPI → mm)
 * - Proportional percentage scaling
 * - SVG preview
 *
 * Size logic:
 *   potrace / GPT-4o SVG outputs at 96 DPI.
 *   1 px = 25.4 / 96 ≈ 0.2646 mm
 *   So a 500px design → ~132mm at 100%.
 *   The DXF coordinates are currently in px units; we scale them to mm.
 *   At 100% the output is the real physical size at 96 DPI.
 *   The user can scale up/down with the slider.
 */
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Download, X, FileCode2 } from "lucide-react";

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

/**
 * Re-scale all LINE coordinates in a DXF R12 string by a given factor.
 * Also updates $EXTMIN / $EXTMAX header values.
 */
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
    <div className="border rounded-lg bg-white overflow-hidden flex items-center justify-center p-3" style={{ height: 200 }}>
      <div
        className="w-full h-full flex items-center justify-center"
        dangerouslySetInnerHTML={{ __html: styledSvg }}
      />
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Format mm: if ≥ 10mm show as cm too */
function formatSize(mm: number) {
  if (mm >= 10) {
    return `${mm.toFixed(0)} מ"מ (${(mm / 10).toFixed(1)} ס"מ)`;
  }
  return `${mm.toFixed(1)} מ"מ`;
}

// ─── Main Dialog ──────────────────────────────────────────────────────────────

/**
 * Pixel → mm conversion at 96 DPI (standard screen resolution).
 * 1 px = 25.4 / 96 ≈ 0.2646 mm
 */
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

  // Reset when dialog opens
  useEffect(() => {
    if (open) {
      setFilename(defaultFilename.replace(/\.dxf$/i, ""));
      setScalePercent(100);
    }
  }, [open, defaultFilename]);

  // Real physical size at 100%:
  // DXF coords are in px units → convert to mm at 96 DPI
  const realWidthMm = svgWidth * PX_TO_MM;
  const realHeightMm = svgHeight * PX_TO_MM;

  // At 100% the output equals the real physical size.
  // scaleFactor = (scalePercent / 100) * PX_TO_MM
  // (we need to convert px→mm AND apply user scale)
  const scaleFactor = PX_TO_MM * (scalePercent / 100);

  const outputWidthMm = svgWidth * scaleFactor;
  const outputHeightMm = svgHeight * scaleFactor;

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const resp = await fetch(dxfUrl);
      if (!resp.ok) throw new Error("שגיאה בהורדת הקובץ");
      const originalDxf = await resp.text();

      // Scale: convert px→mm and apply user percentage
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
      // Fallback: direct download without scaling
      const a = document.createElement("a");
      a.href = dxfUrl;
      a.download = `${filename.trim() || "design"}.dxf`;
      a.click();
      onClose();
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md w-full" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-right">
            <FileCode2 className="w-4 h-4 text-primary" />
            הורדת קובץ DXF
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* SVG Preview */}
          {svgContent && <SvgMiniPreview svg={svgContent} />}

          {/* Stats */}
          <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
            <span>{segmentCount.toLocaleString()} קווים</span>
            <span>
              גודל פלט: <strong>{outputWidthMm.toFixed(0)} × {outputHeightMm.toFixed(0)} מ"מ</strong>
            </span>
          </div>

          {/* Filename */}
          <div>
            <label className="text-sm font-medium block mb-1.5">שם הקובץ</label>
            <div className="flex items-center gap-1">
              <Input
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                placeholder="שם הקובץ..."
                className="text-right flex-1"
                dir="rtl"
              />
              <span className="text-sm text-muted-foreground shrink-0">.dxf</span>
            </div>
          </div>

          {/* Scale */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium">גודל הפלט</label>
              <span className="text-sm font-mono bg-muted px-2 py-0.5 rounded text-primary font-semibold">
                {scalePercent}%
              </span>
            </div>
            <Slider
              min={10}
              max={500}
              step={5}
              value={[scalePercent]}
              onValueChange={([v]) => setScalePercent(v)}
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>קטן (10%)</span>
              <button
                className="text-primary font-medium underline underline-offset-2 cursor-pointer"
                onClick={() => setScalePercent(100)}
              >
                גודל אמיתי (100%)
              </button>
              <span>גדול (500%)</span>
            </div>

            {/* Size info table */}
            <div className="mt-2 rounded-md bg-muted/50 p-2 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">גודל מקורי (100%):</span>
                <span className="font-medium">
                  {formatSize(realWidthMm)} × {formatSize(realHeightMm)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">גודל סופי ({scalePercent}%):</span>
                <span className="font-semibold text-primary">
                  {formatSize(outputWidthMm)} × {formatSize(outputHeightMm)}
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <Button
              size="lg"
              className="flex-1 bg-green-600 hover:bg-green-700 font-semibold"
              onClick={handleDownload}
              disabled={isDownloading}
            >
              <Download className="w-4 h-4 ml-2" />
              {isDownloading ? "מוריד..." : "הורד DXF"}
            </Button>
            <Button variant="outline" size="lg" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

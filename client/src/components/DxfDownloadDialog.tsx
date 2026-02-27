/**
 * DxfDownloadDialog — dialog for downloading DXF with:
 * - Custom filename input
 * - Default size 500x500mm (50x50cm) with proportional percentage scaling
 * - SVG preview
 */
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Download, X, Eye, FileCode2 } from "lucide-react";

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
  if (Math.abs(scaleFactor - 1) < 0.001) return dxfText;

  // Scale numeric coordinate values (groups 10/11/20/21/30/31)
  // and EXTMAX values
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
    <div className="border rounded-lg bg-white overflow-hidden flex items-center justify-center p-3" style={{ height: 220 }}>
      <div
        className="w-full h-full flex items-center justify-center"
        dangerouslySetInnerHTML={{ __html: styledSvg }}
      />
    </div>
  );
}

// ─── Main Dialog ──────────────────────────────────────────────────────────────

/**
 * Default output size: 500mm × 500mm (50cm × 50cm).
 * The DXF coordinates from potrace are in pixels (96 DPI).
 * We scale so the design fits within 500mm.
 *
 * Pixel → mm: 1px = 25.4/96 ≈ 0.2646 mm
 * So 1024px ≈ 271mm. We scale to 500mm by default.
 */
const DEFAULT_SIZE_MM = 500; // 50cm

export function DxfDownloadDialog({
  open,
  onClose,
  svgContent,
  dxfUrl,
  defaultFilename,
  segmentCount,
  svgWidth = 1024,
  svgHeight = 1024,
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

  // Calculate actual output size in mm
  // Base: potrace outputs at ~96 DPI; 1px = 25.4/96 mm
  // We normalize so the larger dimension = DEFAULT_SIZE_MM at 100%
  const pxToMm = 25.4 / 96;
  const maxDim = Math.max(svgWidth, svgHeight);
  const baseScaleFactor = maxDim > 0 ? (DEFAULT_SIZE_MM / (maxDim * pxToMm)) : 1;
  const finalScaleFactor = baseScaleFactor * (scalePercent / 100);

  const outputWidthMm = svgWidth * pxToMm * finalScaleFactor;
  const outputHeightMm = svgHeight * pxToMm * finalScaleFactor;

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      // Fetch original DXF
      const resp = await fetch(dxfUrl);
      if (!resp.ok) throw new Error("שגיאה בהורדת הקובץ");
      const originalDxf = await resp.text();

      // Scale the DXF
      const scaledDxf = scaleDxfContent(originalDxf, finalScaleFactor);

      // Create blob and trigger download
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
              {outputWidthMm.toFixed(0)} × {outputHeightMm.toFixed(0)} מ"מ
              ({(outputWidthMm / 10).toFixed(1)} × {(outputHeightMm / 10).toFixed(1)} ס"מ)
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
              max={300}
              step={5}
              value={[scalePercent]}
              onValueChange={([v]) => setScalePercent(v)}
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>קטן (10%)</span>
              <span className="text-center text-primary font-medium">
                ברירת מחדל: 50×50 ס"מ (100%)
              </span>
              <span>גדול (300%)</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1.5 text-center">
              גודל סופי: <strong>{outputWidthMm.toFixed(0)} × {outputHeightMm.toFixed(0)} מ"מ</strong>
            </p>
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

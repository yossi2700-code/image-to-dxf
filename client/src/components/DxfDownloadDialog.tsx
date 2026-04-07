/**
 * DxfDownloadDialog — unified download dialog for ALL features.
 *
 * Layout:
 *  ┌─────────────────────────────────┐
 *  │  SVG mini-preview               │
 *  │  Filename input                 │
 *  │  Scale slider (mm)              │
 *  │  ┌──────────────────────────┐   │
 *  │  │ [DXF] [DXF-CAS] [PDF]   │   │  ← format selector cards
 *  │  └──────────────────────────┘   │
 *  │  [ Download / Share button ]    │
 *  └─────────────────────────────────┘
 *
 * Used by: Upload tab, AI Generate tab, AI Trace tab, History page, CNC Relief, etc.
 */
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Download, X, FileCode2, FileText, Loader2, Share2, Settings2, Heart } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { saveFileAs } from "@/lib/saveFileAs";
import { trpc } from "@/lib/trpc";

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

type FileFormat = "dxf" | "dxf-legacy" | "pdf";

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

  let sanitizedSvg = svgContent;
  sanitizedSvg = sanitizedSvg.replace(/<path([^>]*[^/])>/g, '<path$1/>');
  sanitizedSvg = sanitizedSvg.replace(/<path>/g, '<path/>');
  sanitizedSvg = sanitizedSvg.replace(/<circle([^>]*[^/])>/g, '<circle$1/>');
  sanitizedSvg = sanitizedSvg.replace(/<rect([^>]*[^/])>/g, '<rect$1/>');
  sanitizedSvg = sanitizedSvg.replace(/<ellipse([^>]*[^/])>/g, '<ellipse$1/>');
  sanitizedSvg = sanitizedSvg.replace(/<line([^>]*[^/])>/g, '<line$1/>');
  sanitizedSvg = sanitizedSvg.replace(/<polygon([^>]*[^/])>/g, '<polygon$1/>');
  sanitizedSvg = sanitizedSvg.replace(/<polyline([^>]*[^/])>/g, '<polyline$1/>');
  sanitizedSvg = sanitizedSvg.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  sanitizedSvg = sanitizedSvg.replace(/<foreignObject[^>]*>[\s\S]*?<\/foreignObject>/gi, '');
  sanitizedSvg = sanitizedSvg.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  const svgStart = sanitizedSvg.search(/<(?:\?xml|svg)/i);
  if (svgStart > 0) sanitizedSvg = sanitizedSvg.slice(svgStart);
  if (!sanitizedSvg.includes('xmlns=')) {
    sanitizedSvg = sanitizedSvg.replace(/<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
  }

  const pngRes = await fetch("/api/svg-to-png", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ svgContent: sanitizedSvg, widthPx, heightPx }),
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
  // cleanSvgForPreview removes pixel width/height and keeps only viewBox.
  // Without explicit dimensions the browser can't size the SVG correctly.
  // We strip any leftover width/height then add width="100%" height="100%"
  // so the SVG fills the fixed-height container properly.
  const styledSvg = svg
    .replace(/<svg([^>]*)\s+width="[^"]*"/i, '<svg$1')
    .replace(/<svg([^>]*)\s+height="[^"]*"/i, '<svg$1')
    .replace(/<svg/, '<svg width="100%" height="100%" style="display:block;" ');
  return (
    <div
      className="border-2 border-border rounded-xl bg-white overflow-hidden"
      style={{ height: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px' }}
    >
      <div
        style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
        dangerouslySetInnerHTML={{ __html: styledSvg }}
      />
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatMm(mm: number, isRtl?: boolean) {
  return `${mm.toFixed(0)} ${isRtl ? 'מ"מ' : 'mm'}`;
}

// ─── Format Card ──────────────────────────────────────────────────────────────

interface FormatCardProps {
  selected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
  color: string; // tailwind bg class for selected state
  borderColor: string;
}

function FormatCard({ selected, onClick, icon, title, description, color, borderColor }: FormatCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        flex-1 flex flex-col items-center gap-1.5 rounded-xl border-2 px-2 py-3 text-center transition-all cursor-pointer
        ${selected
          ? `${color} ${borderColor} shadow-sm`
          : "border-border bg-muted/30 hover:bg-muted/60"
        }
      `}
    >
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${selected ? "bg-white/60" : "bg-muted"}`}>
        {icon}
      </div>
      <span className={`text-xs font-bold leading-tight ${selected ? "text-foreground" : "text-muted-foreground"}`}>
        {title}
      </span>
      <span className={`text-[10px] leading-tight ${selected ? "text-foreground/70" : "text-muted-foreground/70"}`}>
        {description}
      </span>
    </button>
  );
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
  const [selectedFormat, setSelectedFormat] = useState<FileFormat>("dxf");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [hasShared, setHasShared] = useState(false);

  const shareMutation = trpc.sharedFiles.submitDirect.useMutation({
    onSuccess: () => {
      setHasShared(true);
      toast.success(t("shareSubmitted"));
    },
    onError: (err) => {
      if (err.message.includes("כבר נשלח") || err.message.includes("already")) {
        setHasShared(true);
        toast.info(t("shareAlreadyShared"));
      } else if (err.message.includes("להתחבר") || err.message.includes("UNAUTHORIZED")) {
        toast.error(t("shareLoginRequired"));
      } else {
        toast.error(err.message);
      }
    },
  });

  // handleShareToCommunity is defined below after cleanFilename

  const isMobile = isMobileDevice();
  const supportsShare = canShareFiles();
  const useShareSheet = isMobile && supportsShare;

  useEffect(() => {
    if (open) {
      setFilename(defaultFilename.replace(/\.dxf$/i, "").slice(0, 30).trimEnd());
      setScalePercent(100);
      setError(null);
      setSelectedFormat("dxf");
    }
  }, [open, defaultFilename]);

  const realWidthMm = svgWidth * PX_TO_MM;
  const realHeightMm = svgHeight * PX_TO_MM;
  const scaleFactor = PX_TO_MM * (scalePercent / 100);
  const outputWidthMm = svgWidth * scaleFactor;
  const outputHeightMm = svgHeight * scaleFactor;
  const cleanFilename = (() => {
    let base = (filename.trim() || "design")
      .replace(/https?:\/\/[^\s]*/gi, "")
      .replace(/\b[\w-]+\.(com|net|org|ai|io|co|app|dev|pdf|dxf|png|jpg|svg)\b/gi, "")
      .replace(/\.dxf$/i, "")
      .replace(/[^\w\s\u0590-\u05FF._-]/g, " ")
      .replace(/\s+/g, "_")
      .replace(/_{2,}/g, "_")
      .replace(/^[_.-]+|[_.-]+$/g, "")
      .trim();
    return (base || "design").slice(0, 30).replace(/[_.-]+$/, "");
  })();

  const { t, isRtl } = useLanguage();
  const trackDownloadMutation = trpc.trackDownload.useMutation();

  const handleShareToCommunity = async () => {
    setIsSharing(true);
    try {
      await shareMutation.mutateAsync({
        dxfUrl,
        svgPreview: svgContent || undefined,
        feature: "convert",
        lineCount: segmentCount,
        filename: cleanFilename || defaultFilename,
      });
    } finally {
      setIsSharing(false);
    }
  };

  // ── Download handler ─────────────────────────────────────────────────────────────

  const handleDownload = async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (selectedFormat === "dxf") {
        // Standard DXF (LWPOLYLINE / R2000)
        const resp = await fetch(dxfUrl);
        if (!resp.ok) throw new Error("Download error");
        const originalDxf = await resp.text();
        const scaledDxf = scaleDxfContent(originalDxf, scaleFactor);
        const blob = new Blob([scaledDxf], { type: "application/octet-stream" });
         await saveFileAs({ blob, filename: `${cleanFilename}.dxf`, mimeType: "application/octet-stream" });
        void trackDownloadMutation.mutateAsync({ fileFormat: 'dxf', dxfUrl, description: cleanFilename });
        onClose();
      } else if (selectedFormat === "dxf-legacy") {
        // Legacy DXF (LINE entities / R12 — CAS WIN compatible)
        const legacyUrl = `/api/dxf-legacy?url=${encodeURIComponent(dxfUrl)}&scale=${scaleFactor}`;
        const resp = await fetch(legacyUrl);
        if (!resp.ok) {
          const err = await resp.json().catch(() => ({})) as Record<string, unknown>;
          throw new Error((err.error as string) || `Error ${resp.status}`);
        }
        const blob = await resp.blob();
         await saveFileAs({ blob, filename: `${cleanFilename}_caswin.dxf`, mimeType: "application/octet-stream" });
        void trackDownloadMutation.mutateAsync({ fileFormat: 'dxf-legacy', dxfUrl, description: cleanFilename });
        onClose();
      } else if (selectedFormat === "pdf") {
        // PDF export
        if (!svgContent) return;
        const pdfBytes = await generatePdfBlob(svgContent, outputWidthMm, outputHeightMm);
        const blob = new Blob([pdfBytes], { type: "application/pdf" });
        await saveFileAs({ blob, filename: `${cleanFilename}.pdf`, mimeType: "application/pdf" });
        void trackDownloadMutation.mutateAsync({ fileFormat: 'pdf', dxfUrl, description: cleanFilename });
        onClose();
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      console.error("Download error:", err);
      if (selectedFormat === "pdf") {
        const msg = err instanceof Error ? err.message : String(err);
        setError(`PDF export error: ${msg}`);
      } else {
        // DXF fallback
        const a = document.createElement("a");
        a.href = dxfUrl;
        a.download = `${cleanFilename}.dxf`;
        a.click();
        onClose();
      }
    } finally {
      setIsLoading(false);
    }
  };

  // ── Button label ─────────────────────────────────────────────────────────

  const getButtonLabel = () => {
    if (isLoading) {
      if (selectedFormat === "pdf") return t("exportingPdf");
      if (selectedFormat === "dxf-legacy") return t("preparingLegacyDxf");
      return t("preparingDxf");
    }
    if (useShareSheet) {
      if (selectedFormat === "pdf") return t("shareOrSavePdf");
      return t("shareOrSaveDxf");
    }
    if (selectedFormat === "pdf") return t("downloadPdfBtn");
    if (selectedFormat === "dxf-legacy") return t("downloadLegacyDxfBtn");
    return t("downloadDxfBtn");
  };

  const getButtonStyle = (): React.CSSProperties => {
    if (selectedFormat === "pdf") {
      return { background: "linear-gradient(135deg, #2563eb, #3b82f6)", border: "none", boxShadow: "0 3px 10px rgba(37,99,235,0.3)" };
    }
    if (selectedFormat === "dxf-legacy") {
      return { background: "linear-gradient(135deg, #7c3aed, #a855f7)", border: "none", boxShadow: "0 3px 10px rgba(124,58,237,0.3)" };
    }
    return { background: "linear-gradient(135deg, #059669, #10b981)", border: "none", boxShadow: "0 3px 10px rgba(5,150,105,0.3)" };
  };

  const hasPdf = !!svgContent;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !isLoading && onClose()}>
      <DialogContent className="max-w-sm w-full" dir={isRtl ? "rtl" : "ltr"}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-right">
            <FileCode2 className="w-5 h-5 text-primary" />
            {t("downloadDxfTitle")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* SVG Preview */}
          {svgContent && <SvgMiniPreview svg={svgContent} />}

          {/* Stats row */}
          <div className="flex items-center justify-between bg-muted/40 rounded-lg px-3 py-2 text-sm">
            <span className="text-muted-foreground">{segmentCount.toLocaleString()} {t("linesCount")}</span>
            <span className="font-semibold text-primary">
              {formatMm(outputWidthMm, isRtl)} × {formatMm(outputHeightMm, isRtl)}
            </span>
          </div>

          {/* Filename */}
          <div>
            <label className="text-sm font-semibold block mb-1.5">{t("fileNameLabel")}</label>
            <div className="flex items-center gap-1.5">
              <Input
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                placeholder={t("fileNamePlaceholder")}
                className="text-right flex-1 text-sm"
                dir="rtl"
              />
              <span className="text-xs text-muted-foreground shrink-0 font-mono bg-muted px-1.5 py-1 rounded">
                {selectedFormat === "pdf" ? ".pdf" : ".dxf"}
              </span>
            </div>
          </div>

          {/* Scale slider */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold">{t("outputSizeLabel")}</label>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-primary tabular-nums">{scalePercent}%</span>
                <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                  {formatMm(outputWidthMm, isRtl)} × {formatMm(outputHeightMm, isRtl)}
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
              <span>10% ({formatMm(realWidthMm * 0.1, isRtl)})</span>
              <button
                className="text-primary font-semibold underline underline-offset-2 cursor-pointer"
                onClick={() => setScalePercent(100)}
              >
                {t("realSize100")}
              </button>
              <span>100% ({formatMm(realWidthMm, isRtl)})</span>
            </div>
          </div>

          {/* Format selector */}
          <div>
            <label className="text-sm font-semibold block mb-2 flex items-center gap-1.5">
              <Settings2 className="w-4 h-4" />
              {t("chooseFileFormat")}
            </label>
            <div className="flex gap-2">
              {/* DXF standard */}
              <FormatCard
                selected={selectedFormat === "dxf"}
                onClick={() => setSelectedFormat("dxf")}
                icon={<FileCode2 className={`w-4 h-4 ${selectedFormat === "dxf" ? "text-emerald-700" : "text-muted-foreground"}`} />}
                title="DXF"
                description={isRtl ? "CorelDRAW, AutoCAD, Inkscape" : "CorelDRAW, AutoCAD"}
                color="bg-emerald-50"
                borderColor="border-emerald-500"
              />
              {/* DXF legacy */}
              <FormatCard
                selected={selectedFormat === "dxf-legacy"}
                onClick={() => setSelectedFormat("dxf-legacy")}
                icon={<FileCode2 className={`w-4 h-4 ${selectedFormat === "dxf-legacy" ? "text-purple-700" : "text-muted-foreground"}`} />}
                title="DXF R12"
                description={isRtl ? "CAS WIN, AutoCAD ישן" : "CAS WIN, old AutoCAD"}
                color="bg-purple-50"
                borderColor="border-purple-500"
              />
              {/* PDF */}
              {hasPdf && (
                <FormatCard
                  selected={selectedFormat === "pdf"}
                  onClick={() => setSelectedFormat("pdf")}
                  icon={<FileText className={`w-4 h-4 ${selectedFormat === "pdf" ? "text-blue-700" : "text-muted-foreground"}`} />}
                  title="PDF"
                  description={t("pdfPrintShare")}
                  color="bg-blue-50"
                  borderColor="border-blue-500"
                />
              )}
            </div>
          </div>

          {/* Mobile share hint */}
          {useShareSheet && (
            <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-700">
              <Share2 className="w-4 h-4 shrink-0" />
              <span>{t("shareHint")}</span>
            </div>
          )}

          {/* Error */}
          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          {/* Action buttons */}
          <div className="flex flex-col gap-2 pt-1">
            <Button
              size="lg"
              className="w-full font-bold text-base h-12 text-white hover:opacity-90 transition-all"
              style={getButtonStyle()}
              onClick={handleDownload}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 ml-2 animate-spin" />
              ) : useShareSheet ? (
                <Share2 className="w-5 h-5 ml-2" />
              ) : (
                <Download className="w-5 h-5 ml-2" />
              )}
              {getButtonLabel()}
            </Button>

            {/* Share to Community */}
            <button
              onClick={handleShareToCommunity}
              disabled={isSharing || hasShared}
              className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                hasShared
                  ? "bg-pink-50 text-pink-400 border border-pink-200 cursor-default"
                  : "bg-pink-50 hover:bg-pink-100 text-pink-600 border border-pink-200 hover:border-pink-300 cursor-pointer"
              }`}
            >
              {isSharing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Heart className={`w-4 h-4 ${hasShared ? "fill-pink-400" : ""}`} />
              )}
              {hasShared ? (isRtl ? "נשלח לשיתוף ❤" : "Shared ❤") : t("shareToCommunity")}
            </button>

            {/* Cancel */}
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              disabled={isLoading}
              className="w-full text-muted-foreground"
            >
              <X className="w-4 h-4 ml-1" />
              {t("cancel")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

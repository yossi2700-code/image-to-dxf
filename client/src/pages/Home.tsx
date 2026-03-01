import { useState, useRef, useCallback, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { AuthDialog } from "@/components/AuthDialog";
import { DxfDownloadDialog } from "@/components/DxfDownloadDialog";
import { AiRefinePanel, type RefineResult } from "@/components/AiRefinePanel";
import { AiTraceTab } from "@/components/AiTraceTab";
import { AiDocumentRedrawTab } from "@/components/AiDocumentRedrawTab";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Upload,
  Download,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ImageIcon,
  Sliders,
  FileCode2,
  Layers,
  Sparkles,
  RefreshCw,
  Eye,
  ChevronLeft,
  Wand2,
  LogIn,
  LogOut,
  UserCircle,
  History,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Scan,
  FileEdit,
  X,
} from "lucide-react";

type Status = "idle" | "loading" | "success" | "error";

interface ConvertResult {
  dxfUrl: string;
  svgPreview: string;
  segmentCount: number;
  width: number;
  height: number;
  realWidth?: number;
  realHeight?: number;
}

interface AiImage {
  imageUrl: string;
  svgPreview: string;
  dxfUrl: string;
  dxfFilename?: string;
  segmentCount: number;
  width: number;
  height: number;
  realWidth?: number;
  realHeight?: number;
}

// ─── Image Zoom Modal ────────────────────────────────────────────────────────
function ImageZoomModal({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const lastPinchDist = useRef<number | null>(null);

  const clamp = (s: number) => Math.min(8, Math.max(0.5, s));
  const reset = () => { setScale(1); setOffset({ x: 0, y: 0 }); };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setScale((s) => clamp(+(s * (e.deltaY < 0 ? 1.15 : 1 / 1.15)).toFixed(3)));
  };
  const onMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsPanning(true);
    panStart.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!isPanning || !panStart.current) return;
    setOffset({ x: panStart.current.ox + e.clientX - panStart.current.x, y: panStart.current.oy + e.clientY - panStart.current.y });
  };
  const onMouseUp = () => { setIsPanning(false); panStart.current = null; };
  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastPinchDist.current = Math.hypot(dx, dy);
    } else if (e.touches.length === 1) {
      panStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, ox: offset.x, oy: offset.y };
    }
  };
  const onTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 2 && lastPinchDist.current !== null) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      setScale((s) => clamp(+(s * dist / lastPinchDist.current!).toFixed(3)));
      lastPinchDist.current = dist;
    } else if (e.touches.length === 1 && panStart.current) {
      setOffset({ x: panStart.current.ox + e.touches[0].clientX - panStart.current.x, y: panStart.current.oy + e.touches[0].clientY - panStart.current.y });
    }
  };
  const onTouchEnd = () => { lastPinchDist.current = null; panStart.current = null; };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex flex-col"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 bg-black/60 text-white shrink-0">
        <span className="text-xs flex-1 truncate opacity-70">{alt}</span>
        <span className="text-xs opacity-60">{Math.round(scale * 100)}%</span>
        <button onClick={() => setScale((s) => clamp(+(s / 1.3).toFixed(2)))} className="p-1.5 rounded hover:bg-white/10"><ZoomOut className="w-4 h-4" /></button>
        <button onClick={() => setScale((s) => clamp(+(s * 1.3).toFixed(2)))} className="p-1.5 rounded hover:bg-white/10"><ZoomIn className="w-4 h-4" /></button>
        <button onClick={reset} className="p-1.5 rounded hover:bg-white/10"><Maximize2 className="w-4 h-4" /></button>
        <button onClick={onClose} className="p-1.5 rounded hover:bg-white/10 ml-2 text-lg font-bold">✕</button>
      </div>
      {/* Image area */}
      <div
        className="flex-1 overflow-hidden relative select-none"
        style={{ cursor: isPanning ? "grabbing" : "grab" }}
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <img
          src={src}
          alt={alt}
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px)) scale(${scale})`,
            transformOrigin: "center center",
            maxWidth: "90vw",
            maxHeight: "80vh",
            objectFit: "contain",
            userSelect: "none",
            pointerEvents: "none",
          }}
        />
      </div>
      <p className="text-center text-xs text-white/40 py-2 shrink-0">גרור להזזה • גלגלת/פינצ׳ לזום • לחץ מחוץ לתמונה לסגירה</p>
    </div>
  );
}

// ─── SVG Zoom Viewer ──────────────────────────────────────────────────────────
interface SvgZoomViewerProps {
  svgContent: string;
  label?: string;
  maxHeight?: number;
}

function SvgZoomViewer({ svgContent, label = "Preview", maxHeight = 450 }: SvgZoomViewerProps) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const panStart = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastPinchDist = useRef<number | null>(null);

  const clampScale = (s: number) => Math.min(10, Math.max(0.3, s));
  const zoomIn = (e: React.MouseEvent) => { e.stopPropagation(); setScale((s) => clampScale(parseFloat((s * 1.4).toFixed(2)))); };
  const zoomOut = (e: React.MouseEvent) => { e.stopPropagation(); setScale((s) => clampScale(parseFloat((s / 1.4).toFixed(2)))); };
  const resetView = (e: React.MouseEvent) => { e.stopPropagation(); setScale(1); setOffset({ x: 0, y: 0 }); };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    setScale((s) => clampScale(parseFloat((s * factor).toFixed(3))));
  };
  const onMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    setIsPanning(true);
    panStart.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!isPanning || !panStart.current) return;
    setOffset({
      x: panStart.current.ox + e.clientX - panStart.current.x,
      y: panStart.current.oy + e.clientY - panStart.current.y,
    });
  };
  const onMouseUp = () => { setIsPanning(false); panStart.current = null; };
  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastPinchDist.current = Math.hypot(dx, dy);
    } else if (e.touches.length === 1) {
      panStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, ox: offset.x, oy: offset.y };
    }
  };
  const onTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 2 && lastPinchDist.current !== null) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const factor = dist / lastPinchDist.current;
      lastPinchDist.current = dist;
      setScale((s) => clampScale(parseFloat((s * factor).toFixed(3))));
    } else if (e.touches.length === 1 && panStart.current) {
      setOffset({
        x: panStart.current.ox + e.touches[0].clientX - panStart.current.x,
        y: panStart.current.oy + e.touches[0].clientY - panStart.current.y,
      });
    }
  };
  const onTouchEnd = () => { lastPinchDist.current = null; panStart.current = null; };

  // Prepare SVG: ensure it has explicit width/height for proper rendering
  const styledSvg = svgContent
    .replace(/<svg([^>]*)>/, (match, attrs) => {
      const hasWidthHeight = /width=/.test(attrs) && /height=/.test(attrs);
      if (hasWidthHeight) return `<svg${attrs} style="display:block;max-width:100%;max-height:100%;">`;
      return `<svg${attrs} style="display:block;width:100%;height:100%;">`;
    });

  const ViewerContent = ({ height }: { height: number | string }) => (
    <div
      ref={containerRef}
      className="relative overflow-hidden bg-white select-none"
      style={{ height, cursor: isPanning ? "grabbing" : "grab" }}
      onWheel={onWheel}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px)) scale(${scale})`,
          transformOrigin: "center center",
          width: "90%",
          height: "90%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
        }}
        dangerouslySetInnerHTML={{ __html: styledSvg }}
      />
    </div>
  );

  const Toolbar = ({ onClose }: { onClose?: (e: React.MouseEvent) => void }) => (
    <div className="flex items-center gap-1 px-3 border-b bg-muted/30" style={{ minHeight: 44 }}>
      <Eye className="w-4 h-4 text-muted-foreground shrink-0" />
      <span className="text-xs text-muted-foreground font-medium flex-1 truncate">{label}</span>
      <span className="text-xs text-muted-foreground/60 w-10 text-center">{Math.round(scale * 100)}%</span>
      <button
        onClick={zoomOut}
        className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-muted active:bg-muted/80 transition-colors"
        title="Zoom out"
      >
        <ZoomOut className="w-5 h-5 text-foreground" />
      </button>
      <button
        onClick={zoomIn}
        className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-muted active:bg-muted/80 transition-colors"
        title="Zoom in"
      >
        <ZoomIn className="w-5 h-5 text-foreground" />
      </button>
      <button
        onClick={resetView}
        className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-muted active:bg-muted/80 transition-colors"
        title="Reset view"
      >
        <Maximize2 className="w-5 h-5 text-foreground" />
      </button>
      {onClose ? (
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-muted active:bg-muted/80 transition-colors text-lg font-bold"
        >✕</button>
      ) : (
        <button
          onClick={(e) => { e.stopPropagation(); setFullscreen(true); setScale(1); setOffset({ x: 0, y: 0 }); }}
          className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-muted active:bg-muted/80 transition-colors"
          title="Fullscreen"
        >
          <Maximize2 className="w-5 h-5 text-primary" />
        </button>
      )}
    </div>
  );

  return (
    <>
      {fullscreen && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col">
          <Toolbar onClose={(e) => { e.stopPropagation(); setFullscreen(false); setScale(1); setOffset({ x: 0, y: 0 }); }} />
          <div className="flex-1 overflow-hidden">
            <ViewerContent height="100%" />
          </div>
        </div>
      )}
      <div className="border rounded-lg overflow-hidden bg-white">
        <Toolbar />
        <ViewerContent height={maxHeight} />
      </div>
    </>
  );
}

// ─── Upload Tab ─────────────────────────────────────────────────────────────
interface UploadTabProps {
  onOpenAuth: () => void;
}

function UploadTab({ onOpenAuth }: UploadTabProps) {
  const { t, isRtl } = useLanguage();
  const [dragOver, setDragOver] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [threshold, setThreshold] = useState(128);
  const [simplify, setSimplify] = useState(2);
  const [dpi] = useState(300);
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<ConvertResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [showSvgPreview, setShowSvgPreview] = useState(false);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    const allowed = ["image/png", "image/jpeg", "image/bmp", "image/webp"];
    if (!allowed.includes(file.type)) {
      toast.error(t("unsupportedFormat"));
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error(isRtl ? "הקובץ גדול מדי. מקסימום 20 MB." : "File too large. Maximum 20 MB.");
      return;
    }
    setImageFile(file);
    setResult(null);
    setStatus("idle");
    setShowSvgPreview(false);
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);
  }, [t, isRtl]);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleConvert = async () => {
    if (!imageFile) return;
    setStatus("loading");
    setResult(null);
    setErrorMsg("");
    setShowSvgPreview(false);
    try {
      const formData = new FormData();
      formData.append("image", imageFile);
      formData.append("threshold", String(threshold));
      formData.append("simplifyTolerance", String(simplify));
      formData.append("doubleLineOffset", "0");
      const res = await fetch("/api/convert", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok || !data.success) {
        if (data.error === "REGISTRATION_REQUIRED") {
          onOpenAuth();
          setStatus("idle");
          return;
        }
        throw new Error(data.message ?? data.error ?? t("unknownError"));
      }
      setResult(data as ConvertResult);
      setStatus("success");
      setShowSvgPreview(false);
      toast.success(`${t("conversionSuccess")} (${data.segmentCount.toLocaleString()} ${t("lines")})`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t("imageProcessingError");
      setErrorMsg(msg);
      setStatus("error");
      toast.error(msg);
    }
  };

  const reset = () => {
    setImageFile(null);
    setImagePreview(null);
    setResult(null);
    setStatus("idle");
    setShowSvgPreview(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <>
    {result && downloadOpen && (
      <DxfDownloadDialog
        open={downloadOpen}
        onClose={() => setDownloadOpen(false)}
        svgContent={result.svgPreview}
        dxfUrl={result.dxfUrl}
        defaultFilename={`${imageFile?.name.replace(/\.[^.]+$/, "") ?? "output"}.dxf`}
        segmentCount={result.segmentCount}
        svgWidth={result.realWidth ?? result.width}
        svgHeight={result.realHeight ?? result.height}
      />
    )}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* Left: Upload + Controls */}
      <div className="flex flex-col gap-4">
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />

            {imagePreview ? (
              /* Image selected */
              <div
                className="relative border-2 border-dashed rounded-xl transition-all cursor-pointer min-h-[200px] flex flex-col items-center justify-center gap-3 p-5 border-primary/30 bg-primary/5"
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="w-full flex flex-col items-center gap-2">
                  <img src={imagePreview} alt="preview" className="max-h-44 max-w-full object-contain rounded-lg shadow" />
                  <p className="text-sm text-muted-foreground">{imageFile?.name}</p>
                  <p className="text-xs text-primary font-medium">{isRtl ? "לחץ להחלפת התמונה" : "Tap to change image"}</p>
                </div>
              </div>
            ) : (
              /* No image — prominent button for mobile */
              <div
                className={`relative border-2 border-dashed rounded-xl transition-all min-h-[180px] flex flex-col items-center justify-center gap-3 p-5
                  ${dragOver ? "border-primary bg-primary/5" : "border-border"}`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
              >
                {/* Big tap target for mobile */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center gap-3 w-full py-4 rounded-xl hover:bg-muted/30 active:bg-muted/50 transition-colors"
                >
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <ImageIcon className="w-7 h-7 text-primary" />
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-base">{isRtl ? "בחר תמונה" : "Choose Image"}</p>
                    <p className="text-sm text-muted-foreground mt-1">{isRtl ? "מהגלריה, המצלמה או גרור לכאן" : "From gallery, camera, or drag & drop"}</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">{t("supportedFormats")}</p>
                  </div>
                </button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Sliders className="w-4 h-4 text-primary" />
              <h2 className="font-semibold text-sm">{t("conversionSettings")}</h2>
            </div>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-sm font-medium">{isRtl ? "סף זיהוי" : "Detection Threshold"}</label>
                  <span className="text-sm font-mono bg-muted px-2 py-0.5 rounded text-primary font-semibold">{threshold}</span>
                </div>
                <Slider min={10} max={245} step={5} value={[threshold]} onValueChange={([v]) => setThreshold(v)} />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>{isRtl ? "כהה יותר" : "Darker"}</span>
                  <span>{isRtl ? "בהיר יותר" : "Lighter"}</span>
                </div>
              </div>
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-sm font-medium">{t("lineSimplification")}</label>
                  <span className="text-sm font-mono bg-muted px-2 py-0.5 rounded text-primary font-semibold">{simplify}</span>
                </div>
                <Slider min={1} max={10} step={1} value={[simplify]} onValueChange={([v]) => setSimplify(v)} />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>{isRtl ? "פרטים מרביים" : "Max detail"}</span>
                  <span>{isRtl ? "קווים פשוטים" : "Simple lines"}</span>
                </div>
              </div>
              {(threshold !== 128 || simplify !== 2) && (
                <button
                  type="button"
                  onClick={() => { setThreshold(128); setSimplify(2); }}
                  className="text-xs text-primary hover:underline flex items-center gap-1 mt-1"
                >
                  ↺ {isRtl ? "אפס לברירת מחדל" : "Reset to default"}
                </button>
              )}
            </div>
          </CardContent>
        </Card>

        <Button size="lg" className="w-full h-11 font-semibold" disabled={!imageFile || status === "loading"} onClick={handleConvert}>
          {status === "loading"
            ? <><Loader2 className="w-4 h-4 ml-2 animate-spin" />{t("processing")}</>
            : <><Upload className="w-4 h-4 ml-2" />{t("convertToDxf")}</>}
        </Button>
      </div>

      {/* Right: Status + SVG Preview */}
      <div className="flex flex-col gap-4">
        <Card className="flex-1">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <Layers className="w-4 h-4 text-primary" />
              <h2 className="font-semibold text-sm">{isRtl ? "תוצאה" : "Result"}</h2>
            </div>
            {status === "idle" && (
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                  <FileCode2 className="w-6 h-6 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground text-sm">
                  {imageFile ? t("clickConvertButton") : t("uploadImageToStart")}
                </p>
              </div>
            )}
            {status === "loading" && (
              <div className="flex flex-col items-center gap-4 py-10 text-center">
                <div className="w-14 h-14 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                <p className="font-medium">{t("processingImage")}</p>
                <p className="text-sm text-muted-foreground">{t("detectingEdges")}</p>
              </div>
            )}
            {status === "success" && result && (
              <div className="flex flex-col gap-4">
                {result.svgPreview && (
                  <div>
                    <button
                      onClick={() => setShowSvgPreview((v) => !v)}
                      className={`w-full flex items-center justify-center gap-2.5 py-3.5 px-4 mb-3 rounded-xl border-2 transition-all font-bold text-base shadow-md active:scale-[0.98]
                        ${showSvgPreview
                          ? "border-primary bg-primary text-white hover:bg-primary/90"
                          : "border-primary bg-gradient-to-r from-primary/20 to-blue-500/20 text-primary hover:from-primary/30 hover:to-blue-500/30"}`}
                    >
                      <Eye className="w-5 h-5" />
                      {showSvgPreview ? (isRtl ? "הסתר וקטור ⬆" : "⬆ Hide Vector") : (isRtl ? "הצג וקטור DXF ⬇" : "⬇ Show DXF Vector")}
                    </button>
                    {showSvgPreview && (
                      <SvgZoomViewer
                        svgContent={result.svgPreview}
                        label={isRtl ? "תצוגה מקדימה של הוקטור" : "Vector Preview"}
                        maxHeight={350}
                      />
                    )}
                  </div>
                )}
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-muted rounded-lg p-2.5 text-center">
                    <p className="text-lg font-bold text-primary">{result.segmentCount.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">{t("lines")}</p>
                  </div>
                  <div className="bg-muted rounded-lg p-2.5 text-center">
                    <p className="text-lg font-bold text-primary">{((result.width / dpi) * 25.4).toFixed(1)}</p>
                    <p className="text-xs text-muted-foreground">{t("widthMm")}</p>
                  </div>
                  <div className="bg-muted rounded-lg p-2.5 text-center">
                    <p className="text-lg font-bold text-primary">{((result.height / dpi) * 25.4).toFixed(1)}</p>
                    <p className="text-xs text-muted-foreground">{t("heightMm")}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg border border-green-100">
                  <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                  <p className="text-sm font-medium text-green-700">{t("conversionSuccess")}</p>
                </div>
                <Button size="lg" className="w-full bg-green-600 hover:bg-green-700 font-bold text-base h-12" onClick={() => setDownloadOpen(true)}>
                  <Download className="w-5 h-5 ml-2" />{isRtl ? "הורד DXF / PDF" : "Download DXF / PDF"}
                </Button>
                <Button variant="outline" size="sm" className="w-full" onClick={reset}>
                  {isRtl ? "המר תמונה חדשה" : "Convert New Image"}
                </Button>
              </div>
            )}
            {status === "error" && (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <AlertCircle className="w-10 h-10 text-red-400" />
                <p className="font-semibold text-red-600">{t("processingError")}</p>
                <p className="text-sm text-muted-foreground">{errorMsg}</p>
                <Button variant="outline" size="sm" onClick={reset}>{isRtl ? "נסה שוב" : "Try Again"}</Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
    </>
  );
}

// ─── AI Generator Tab ────────────────────────────────────────────────────────
function AiGeneratorTab() {
  const { t, isRtl, language } = useLanguage();
  const { refetch: refetchTokens } = trpc.tokens.balance.useQuery(undefined, { enabled: false });
  const [prompt, setPrompt] = useState("");
  const [modifications, setModifications] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [images, setImages] = useState<AiImage[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [showModify, setShowModify] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [downloadImg, setDownloadImg] = useState<AiImage | null>(null);
  const [zoomImg, setZoomImg] = useState<{ src: string; alt: string } | null>(null);
  const [showVector, setShowVector] = useState(false);
  const [landscapeMode, setLandscapeMode] = useState(false);
  const [jobId, setJobId] = useState<string | null>(() => localStorage.getItem("ai_generate_jobId"));
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const setJobIdPersisted = useCallback((id: string | null) => {
    if (id) localStorage.setItem("ai_generate_jobId", id);
    else localStorage.removeItem("ai_generate_jobId");
    setJobId(id);
  }, []);

  // Poll job status every 3 seconds
  const startPolling = useCallback((id: string) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/generate-images/job/${id}`, { credentials: "include" });
        const data = await res.json();
        if (data.status === "done") {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          const result = data.result as { success: boolean; images: AiImage[] };
          setImages(result.images);
          setSelectedIdx(null);
          setStatus("success");
          setShowModify(false);
          setModifications("");
          setJobIdPersisted(null);
          refetchTokens();
          toast.success(t("aiSuccess"));
        } else if (data.status === "error") {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          const msg = data.message || t("aiError");
          setErrorMsg(msg);
          setStatus("error");
          setJobIdPersisted(null);
          toast.error(msg);
        } else if (data.status === "cancelled") {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          setStatus("idle");
          setJobIdPersisted(null);
        }
      } catch (_) { /* network error, keep trying */ }
    }, 3000);
  }, [t, refetchTokens, setJobIdPersisted]);

  // On mount: resume polling if a jobId was saved (survived tab switch)
  useEffect(() => {
    const savedId = localStorage.getItem("ai_generate_jobId");
    if (savedId) {
      setStatus("loading");
      startPolling(savedId);
    }
    return () => { if (pollIntervalRef.current) clearInterval(pollIntervalRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCancel = useCallback(async () => {
    if (!jobId) return;
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    try {
      const res = await fetch(`/api/generate-images/cancel/${jobId}`, { method: "POST", credentials: "include" });
      const data = await res.json();
      if (data.cancelled) {
        toast.success(isRtl ? "העיבוד בוטל והאסימונים הוחזרו" : "Processing cancelled — tokens refunded");
        refetchTokens();
      }
    } catch (_) { /* ignore */ }
    setStatus("idle");
    setJobIdPersisted(null);
  }, [jobId, isRtl, refetchTokens, setJobIdPersisted]);

  // Handle "Edit Again" from History page — restore previous design
  useEffect(() => {
    const stored = sessionStorage.getItem("editAgainItem");
    if (stored) {
      sessionStorage.removeItem("editAgainItem");
      try {
        const item = JSON.parse(stored) as {
          svgPreview: string; dxfUrl: string; imageUrl?: string;
          segmentCount?: number; description?: string;
        };
        if (item.svgPreview && item.dxfUrl) {
          const restored: AiImage = {
            imageUrl: item.imageUrl ?? "",
            svgPreview: item.svgPreview,
            dxfUrl: item.dxfUrl,
            segmentCount: item.segmentCount ?? 0,
            width: 1024, height: 1024,
          };
          setImages([restored]);
          setSelectedIdx(0);
          setStatus("success");
          if (item.description) setPrompt(item.description);
          toast.success(isRtl ? "עיצוב נטען מחדש לעריכה" : "Design loaded for editing");
        }
      } catch { /* ignore */ }
    }
  }, [isRtl]);

  const generate = async (isModify = false) => {
    if (!prompt.trim()) {
      toast.error(t("enterDescription"));
      return;
    }
    setStatus("loading");
    setImages([]);
    setSelectedIdx(null);
    setErrorMsg("");
    try {
      const res = await fetch("/api/generate-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          prompt: prompt.trim(),
          modifications: isModify ? modifications.trim() : undefined,
          landscapeMode,
        }),
      });
      const data = await res.json();
      if (data.error === "REGISTRATION_REQUIRED" || data.error === "UNAUTHORIZED") {
        setStatus("idle");
        return;
      }
      if (data.error === "INSUFFICIENT_TOKENS") {
        const msg = language === "he" ? data.message : data.messageEn;
        setErrorMsg(msg);
        setStatus("error");
        refetchTokens();
        toast.error(msg, {
          action: { label: language === "he" ? "רכוש אסימונים" : "Buy Tokens", onClick: () => { window.location.href = "/tokens"; } },
          duration: 6000,
        });
        return;
      }
      if (!res.ok) throw new Error(data.message ?? data.error ?? t("aiError"));
      // Server returns jobId — start polling (background processing)
      if (data.jobId) {
        setJobIdPersisted(data.jobId);
        startPolling(data.jobId);
      } else {
        // Legacy direct response
        setImages(data.images as AiImage[]);
        setStatus("success");
        setShowModify(false);
        setModifications("");
        refetchTokens();
        toast.success(t("aiSuccess"));
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t("aiError");
      setErrorMsg(msg);
      setStatus("error");
      toast.error(msg);
    }
  };

  const handleDownload = (img: AiImage) => {
    setDownloadImg(img);
    setDownloadOpen(true);
  };

  const selected = selectedIdx !== null ? images[selectedIdx] : null;

  return (
    <>
    {zoomImg && (
      <ImageZoomModal src={zoomImg.src} alt={zoomImg.alt} onClose={() => setZoomImg(null)} />
    )}
    {downloadImg && downloadOpen && (
      <DxfDownloadDialog
        open={downloadOpen}
        onClose={() => setDownloadOpen(false)}
        svgContent={downloadImg.svgPreview}
        dxfUrl={downloadImg.dxfUrl}
        defaultFilename={downloadImg.dxfFilename ?? `ai-design-${Date.now()}.dxf`}
        segmentCount={downloadImg.segmentCount}
        svgWidth={downloadImg.realWidth ?? downloadImg.width}
        svgHeight={downloadImg.realHeight ?? downloadImg.height}
      />
    )}
    <div className="flex flex-col gap-5">
      {/* Prompt Input */}
      <div
        className="rounded-xl p-5"
        style={{ background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}
      >
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{background: '#eef2ff'}}>
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
            </div>
            <h2 className="font-semibold text-sm text-gray-700">{t("describeDesign")}</h2>
          </div>
          <Textarea
            placeholder={t("aiPromptPlaceholder")}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="resize-none text-base min-h-[90px] text-gray-800 bg-gray-50 border-gray-200"
            style={{ textAlign: isRtl ? "right" : "left" }}
            dir={isRtl ? "rtl" : "ltr"}
            disabled={status === "loading"}
          />
          {/* Landscape mode toggle */}
          <div className="mt-3 mb-1">
            <div
              className="flex rounded-lg overflow-hidden"
              style={{background: '#f1f5f9', border: '1px solid #e2e8f0'}}
            >
              <button
                type="button"
                onClick={() => setLandscapeMode(false)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium transition-all"
                style={!landscapeMode ? {
                  background: '#4f46e5',
                  color: 'white',
                  borderRadius: '0.375rem',
                  margin: '2px',
                } : {color: '#6b7280'}}
              >
                <span className="text-base">📷</span>
                <span>{isRtl ? "אובייקט" : "Object"}</span>
              </button>
              <button
                type="button"
                onClick={() => setLandscapeMode(true)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium transition-all"
                style={landscapeMode ? {
                  background: '#059669',
                  color: 'white',
                  borderRadius: '0.375rem',
                  margin: '2px',
                } : {color: '#6b7280'}}
              >
                <span className="text-base">🌄</span>
                <span>{isRtl ? "נוף" : "Landscape"}</span>
              </button>
            </div>
            <p className="text-xs mt-1 px-1 text-gray-400">
              {landscapeMode
                ? (isRtl ? "מצייר את כל הסצנה: שמיים, רקע, עצים, בניינים, קדמת תמונה" : "Draws the entire scene: sky, background, trees, buildings, foreground")
                : (isRtl ? "מתמקד באובייקט הראשי בתמונה" : "Focuses on the main object in the image")}
            </p>
          </div>
          <p className="text-xs mt-2 text-gray-400">{t("aiTabSubtitle")}</p>
          <button
            className="w-full mt-3 h-11 font-semibold rounded-lg flex items-center justify-center gap-2 transition-all"
            style={{
              background: status === "loading" || !prompt.trim() ? '#c7d2fe' : '#4f46e5',
              color: 'white',
              border: 'none',
              boxShadow: status === "loading" || !prompt.trim() ? 'none' : '0 2px 8px rgba(79,70,229,0.30)',
              cursor: status === "loading" || !prompt.trim() ? 'not-allowed' : 'pointer',
            }}
            onClick={() => generate(false)}
            disabled={status === "loading" || !prompt.trim()}
          >
            {status === "loading"
              ? <><Loader2 className="w-4 h-4 animate-spin" />{t("creating")}</>
              : <><Wand2 className="w-4 h-4" />{t("create3Designs")}</>}
          </button>
      </div>

      {/* Loading */}
      {status === "loading" && (
        <div
          className="rounded-xl p-8"
          style={{ background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}
        >
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="relative">
                <div className="w-16 h-16 rounded-full" style={{border: '3px solid #e0e7ff', borderTopColor: '#4f46e5', animation: 'spin 1s linear infinite'}} />
                <Sparkles className="w-6 h-6 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-indigo-500" />
              </div>
              <div>
                <p className="font-semibold text-base text-gray-700">{t("aiCreating")}</p>
                <p className="text-sm mt-1 text-gray-400">{t("aiCreatingSubtitle")}</p>
              </div>
              <div className="flex gap-1.5 mt-1">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="w-2 h-2 rounded-full bg-indigo-400" style={{animation: `bounce 1s infinite ${i * 0.15}s`}} />
                ))}
              </div>
              {jobId && (
                <p className="text-xs text-gray-400">
                  {isRtl ? "תוכל לעבור לטאב אחר — ה-AI ימשיך לעבד ברקע" : "You can switch tabs — AI keeps processing in background"}
                </p>
              )}
              {jobId && (
                <button
                  onClick={handleCancel}
                  className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-lg transition-all"
                  style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)' }}
                >
                  <X className="w-4 h-4" />
                  {isRtl ? "בטל והחזר אסימונים" : "Cancel & Refund Tokens"}
                </button>
              )}
            </div>
        </div>
      )}

      {/* Error */}
      {status === "error" && (
        <div
          className="rounded-xl p-6 flex flex-col items-center gap-3 text-center"
          style={{ background: '#fff5f5', border: '1px solid #fecaca' }}
        >
            <AlertCircle className="w-10 h-10 text-red-400" />
            <p className="font-semibold text-red-600">{t("aiError")}</p>
            <p className="text-sm text-gray-500">{errorMsg}</p>
            <div className="flex gap-2 flex-wrap justify-center">
              <button
                className="text-sm px-4 py-2 rounded-lg font-medium transition-all bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200"
                onClick={() => setStatus("idle")}
              >{isRtl ? "נסה שוב" : "Try Again"}</button>
              {errorMsg && (errorMsg.includes("אסימונים") || errorMsg.toLowerCase().includes("token")) && (
                <button
                  className="text-sm px-4 py-2 rounded-lg font-semibold transition-all"
                  style={{background: '#4f46e5', color: 'white', border: 'none'}}
                  onClick={() => window.location.href = "/tokens"}
                >
                  {isRtl ? "רכוש אסימונים" : "Buy Tokens"}
                </button>
              )}
            </div>
        </div>
      )}

      {/* Gallery */}
      {status === "success" && images.length > 0 && (
        <>
          <div>
            <p className="text-sm font-semibold mb-3 text-gray-600">{t("selectDesign")}</p>
            <div className="flex flex-col gap-3">
              {images.map((img, idx) => (
                <div
                  key={idx}
                  className="relative rounded-xl cursor-pointer transition-all overflow-hidden"
                  style={{
                    background: '#ffffff',
                    border: selectedIdx === idx ? '2px solid #4f46e5' : '1px solid #e2e8f0',
                    boxShadow: selectedIdx === idx ? '0 0 0 3px rgba(79,70,229,0.12)' : '0 1px 4px rgba(0,0,0,0.05)',
                  }}
                  onClick={() => setSelectedIdx(idx)}
                >
                <div
                  className="flex items-center justify-center p-3 relative overflow-hidden bg-gray-50"
                  style={{ minHeight: 220 }}
                >
                  <img
                    src={img.imageUrl}
                    alt={`${t("design")} ${idx + 1}`}
                    className="w-full h-auto object-contain rounded-lg"
                    style={{ maxHeight: 280 }}
                  />
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setZoomImg({ src: img.imageUrl, alt: `${t("design")} ${idx + 1}` }); }}
                    className="absolute bottom-2 left-2 w-8 h-8 rounded-full flex items-center justify-center transition-colors bg-white/80 hover:bg-white border border-gray-200"
                    title="תצוגה מקדימית"
                  >
                    <ZoomIn className="w-4 h-4 text-gray-600" />
                  </button>
                </div>
                  <div className="px-3 py-2 flex items-center justify-between border-t border-gray-100">
                    <span className="text-xs font-medium text-gray-500">{t("variation")} {idx + 1}</span>
                    <span className="text-xs text-gray-400">{img.segmentCount.toLocaleString()} {t("lines")}</span>
                  </div>
                  {selectedIdx === idx && (
                    <div className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center shadow-sm" style={{background: '#4f46e5'}}>
                      <CheckCircle2 className="w-5 h-5 text-white" />
                    </div>
                  )}
                  {selectedIdx !== idx && (
                    <div className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center bg-white border-2 border-gray-200">
                      <div className="w-3 h-3 rounded-full" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Selected detail */}
          {selected && (
            <div
              className="rounded-xl p-5"
              style={{ background: '#ffffff', border: '1px solid #e0e7ff', boxShadow: '0 1px 4px rgba(79,70,229,0.08)' }}
            >
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle2 className="w-4 h-4 text-indigo-500" />
                  <span className="font-semibold text-sm text-gray-700">{t("variation")} {selectedIdx! + 1} {t("selected")}</span>
                </div>
                {/* AI Image preview (always shown) */}
                <div
                  className="border rounded-xl overflow-hidden bg-white mb-3 flex items-center justify-center relative group cursor-zoom-in"
                  style={{ minHeight: 200 }}
                  onClick={() => setZoomImg({ src: selected.imageUrl, alt: `${t("design")} ${selectedIdx! + 1}` })}
                >
                  <img src={selected.imageUrl} alt={`${t("design")} ${selectedIdx! + 1}`} className="max-w-full object-contain" style={{ maxHeight: 320 }} />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                    <ZoomIn className="w-6 h-6 text-white opacity-0 group-hover:opacity-80 transition-opacity drop-shadow" />
                  </div>
                </div>
                {selected.svgPreview && (
                  <div className="mb-3">
                    <button
                      onClick={() => setShowVector((v) => !v)}
                      className={`w-full flex items-center justify-center gap-2.5 py-3.5 px-4 mb-3 rounded-xl border-2 transition-all font-bold text-base shadow-md active:scale-[0.98]
                        ${showVector
                          ? "border-primary bg-primary text-white hover:bg-primary/90"
                          : "border-primary bg-gradient-to-r from-primary/20 to-blue-500/20 text-primary hover:from-primary/30 hover:to-blue-500/30"}`}
                    >
                      <Eye className="w-5 h-5" />
                      {showVector ? (isRtl ? "הסתר וקטור ⬆" : "⬆ Hide Vector") : (isRtl ? "הצג וקטור DXF ⬇" : "⬇ Show DXF Vector")}
                    </button>
                    {showVector && (
                      <SvgZoomViewer
                        svgContent={selected.svgPreview}
                        label={isRtl ? "תצוגת קווי וקטור (DXF)" : "Vector Lines Preview (DXF)"}
                        maxHeight={380}
                      />
                    )}
                  </div>
                )}
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {[{v: selected.segmentCount.toLocaleString(), l: t("lines")}, {v: ((selected.width / 96) * 25.4).toFixed(1), l: t("widthMm")}, {v: ((selected.height / 96) * 25.4).toFixed(1), l: t("heightMm")}].map(({v, l}, i) => (
                    <div key={i} className="rounded-xl p-2 text-center" style={{background: '#f8f9ff', border: '1px solid #e0e7ff'}}>
                      <p className="text-base font-bold text-indigo-600">{v}</p>
                      <p className="text-xs text-gray-500">{l}</p>
                    </div>
                  ))}
                </div>
                <button
                  className="w-full h-12 font-bold text-base rounded-xl flex items-center justify-center gap-2 mb-2 transition-all"
                  style={{
                    background: 'linear-gradient(135deg, #059669, #10b981)',
                    color: 'white',
                    border: 'none',
                    boxShadow: '0 4px 15px rgba(16,185,129,0.30)',
                  }}
                  onClick={() => handleDownload(selected)}
                >
                  <Download className="w-5 h-5" />{isRtl ? "הורד DXF / PDF" : "Download DXF / PDF"}
                </button>
                {/* AI Refine Panel */}
                <AiRefinePanel
                  imageUrl={selected.imageUrl}
                  originalPrompt={prompt}
                  onRefined={(refined: RefineResult) => {
                    const refinedImg: AiImage = {
                      imageUrl: refined.imageUrl,
                      svgPreview: refined.svgPreview,
                      dxfUrl: refined.dxfUrl,
                      dxfFilename: refined.dxfFilename,
                      segmentCount: refined.segmentCount,
                      width: refined.width,
                      height: refined.height,
                      realWidth: refined.realWidth,
                      realHeight: refined.realHeight,
                    };
                    setImages((prev) => {
                      const next = [...prev];
                      next[selectedIdx!] = refinedImg;
                      return next;
                    });
                  }}
                />
                <div className="flex gap-2 mt-2">
                  <button
                    className="flex-1 flex items-center justify-center gap-1.5 text-sm py-2 rounded-xl transition-all"
                    style={{background: '#f1f5f9', border: '1px solid #e2e8f0', color: '#374151'}}
                    onClick={() => setShowModify(!showModify)}
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    {t("requestChanges")}
                  </button>
                  <button
                    className="flex-1 flex items-center justify-center gap-1.5 text-sm py-2 rounded-xl transition-all"
                    style={{background: '#f1f5f9', border: '1px solid #e2e8f0', color: '#374151'}}
                    onClick={() => { setImages([]); setSelectedIdx(null); setStatus("idle"); }}
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    {isRtl ? "עיצוב חדש" : "New Design"}
                  </button>
                </div>
                {showModify && (
                  <div
                    className="mt-3 p-3 rounded-xl"
                    style={{background: '#f8f9ff', border: '1px solid #e0e7ff'}}
                  >
                    <p className="text-xs font-medium mb-2 text-gray-600">
                      {isRtl ? "תאר את השינויים הרצויים:" : "Describe the desired changes:"}
                    </p>
                    <Textarea
                      placeholder={t("changesPlaceholder")}
                      value={modifications}
                      onChange={(e) => setModifications(e.target.value)}
                      className="resize-none text-sm min-h-[70px] mb-2 bg-white border-gray-200 text-gray-800"
                      style={{ textAlign: isRtl ? "right" : "left" }}
                      dir={isRtl ? "rtl" : "ltr"}
                    />
                    <button
                      className="w-full py-2 text-sm font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-all"
                      style={{
                        background: modifications.trim() ? '#4f46e5' : '#e0e7ff',
                        color: modifications.trim() ? 'white' : '#a5b4fc',
                        border: 'none',
                        cursor: modifications.trim() ? 'pointer' : 'not-allowed',
                      }}
                      onClick={() => generate(true)}
                      disabled={!modifications.trim()}
                    >
                      <Wand2 className="w-3.5 h-3.5" />
                      {isRtl ? "צור 3 עיצובים מעודכנים" : "Create 3 Updated Designs"}
                    </button>
                  </div>
                )}
            </div>
          )}
        </>
      )}

      {/* Tips */}
      <div
        className="rounded-xl p-4"
        style={{
          background: '#f8f9ff',
          border: '1px solid #e0e7ff',
        }}
      >
          <h3 className="font-semibold text-sm mb-2 text-indigo-700">{t("tipsTitle")}</h3>
          <ul className="space-y-1.5 text-sm text-gray-600">
            <li className="flex gap-2"><span className="shrink-0 text-indigo-400">•</span><span>{t("tip1")}</span></li>
            <li className="flex gap-2"><span className="shrink-0 text-indigo-400">•</span><span>{t("tip2")}</span></li>
            <li className="flex gap-2"><span className="shrink-0 text-indigo-400">•</span><span>{t("tip3")}</span></li>
            <li className="flex gap-2"><span className="shrink-0">💡</span><span>{t("tip4")}</span></li>
          </ul>
      </div>
    </div>
    </>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function Home() {
  const { t, isRtl, language } = useLanguage();
  const [appUser, setAppUser] = useState<{ id: number; email: string; name: string | null } | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [limitReached, setLimitReached] = useState(false);
  const { data: tokenData, refetch: refetchTokens } = trpc.tokens.balance.useQuery(undefined, { enabled: !!appUser, refetchInterval: 30000 });
  const tokenBalance = tokenData?.balance ?? 0;

  useEffect(() => {
    fetch("/api/app-auth/me")
      .then((r) => r.json())
      .then((d) => { if (d.user) setAppUser(d.user); })
      .catch(() => {});
  }, []);

  const handleLogout = async () => {
    await fetch("/api/app-auth/logout", { method: "POST" });
    setAppUser(null);
    toast.success(t("loggedOutSuccess"));
  };

  return (
    <div
      className="min-h-screen"
      style={{ background: '#f8f9fb' }}
      dir={isRtl ? "rtl" : "ltr"}
    >
      {/* Header */}
      <header
        className="sticky top-0 z-20"
        style={{
          background: '#ffffff',
          borderBottom: '1px solid #e2e8f0',
          boxShadow: '0 1px 6px rgba(0,0,0,0.06)',
        }}
      >
        <div className="container py-3 flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, #eef2ff, #e0e7ff)',
              border: '1px solid #c7d2fe',
            }}
          >
            <img
              src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663365044246/SslVmktvndMoFSwH.png"
              alt={t("logoAlt")}
              className="w-7 h-7 object-contain"
            />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold leading-tight text-gray-800">{t("appTitle")}</h1>
            <p className="text-xs truncate text-gray-500">{t("appSubtitle")}</p>
          </div>
          <LanguageSwitcher />
        </div>
      </header>

      <AuthDialog
        open={authOpen}
        onOpenChange={setAuthOpen}
        limitReached={limitReached}
        onSuccess={(user) => {
          setAppUser(user);
          setLimitReached(false);
        }}
      />

      <main className="container py-5">
        {/* Center content on desktop */}
        <div className="mx-auto" style={{ maxWidth: '780px' }}>
        {/* Auth bar */}
        <div className="flex justify-end mb-4">
          {appUser ? (
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
              style={{ background: '#f1f5f9', border: '1px solid #e2e8f0' }}
            >
              <UserCircle className="w-3.5 h-3.5 text-gray-500" />
              <span className="text-xs text-gray-600">{appUser.name ?? appUser.email}</span>
              <div
                className="flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full mx-1"
                style={{ background: '#eef2ff', border: '1px solid #c7d2fe', color: '#4338ca' }}
              >
                <Sparkles className="w-3 h-3" />
                <span>{tokenBalance}</span>
              </div>
              <button
                onClick={() => window.location.href = "/tokens"}
                className="text-xs px-2 py-0.5 rounded-full transition-colors text-indigo-600 hover:text-indigo-800"
              >
                {isRtl ? "אסימונים" : "Tokens"}
              </button>
              <button
                onClick={() => window.location.href = "/history"}
                className="text-xs px-2 py-0.5 rounded-full transition-colors flex items-center gap-1 text-gray-500 hover:text-gray-700"
              >
                <History className="w-3 h-3" />
                {t("history")}
              </button>
              <button
                onClick={handleLogout}
                className="text-xs px-2 py-0.5 rounded-full transition-colors flex items-center gap-1 text-gray-400 hover:text-gray-600"
              >
                <LogOut className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => { setLimitReached(false); setAuthOpen(true); }}
              className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-full font-semibold transition-all"
              style={{ background: '#4f46e5', color: 'white', border: 'none', boxShadow: '0 2px 8px rgba(79,70,229,0.25)' }}
            >
              <LogIn className="w-3.5 h-3.5" />
              {t("loginRegister")}
            </button>
          )}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="ai" dir={isRtl ? "rtl" : "ltr"}>
          <TabsList
            className="w-full mb-5 h-13 gap-1 p-1.5"
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '0.875rem',
              boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
            }}
          >
            <TabsTrigger
              value="ai"
              className="flex-1 gap-1.5 text-sm font-semibold transition-all rounded-xl text-gray-500 data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-sm"
            >
              <Sparkles className="w-4 h-4" />
              <span>{isRtl ? "✨ AI יצירה" : "✨ AI Create"}</span>
            </TabsTrigger>
            <TabsTrigger
              value="trace"
              className="flex-1 gap-1.5 text-sm font-semibold transition-all rounded-xl text-gray-500 data-[state=active]:bg-teal-600 data-[state=active]:text-white data-[state=active]:shadow-sm"
            >
              <Scan className="w-4 h-4" />
              <span>{isRtl ? "📷 AI מתמונה" : "📷 AI Trace"}</span>
            </TabsTrigger>
            <TabsTrigger
              value="redraw"
              className="flex-1 gap-1.5 text-sm font-semibold transition-all rounded-xl text-gray-500 data-[state=active]:bg-amber-500 data-[state=active]:text-white data-[state=active]:shadow-sm"
            >
              <FileEdit className="w-4 h-4" />
              <span>{isRtl ? "✏️ AI מסמך" : "✏️ AI Doc"}</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ai">
            {/* Demo gallery — AI Create */}
            <div
              className="mb-4 rounded-xl overflow-hidden p-3"
              style={{ background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{background: '#eef2ff'}}>
                  <Sparkles className="w-3 h-3 text-indigo-500" />
                </div>
                <span className="text-xs font-semibold text-indigo-600">
                  {isRtl ? "דוגמאות — תאר עיצוב בטקסט, ה-AI יצייר קווים לחריטה" : "Examples — describe a design in text, AI draws engraving lines"}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <img
                  src="https://d2xsxph8kpxj0f.cloudfront.net/310519663365044246/hnDFdLkzVGYJYdws9hbnLw/tab-ai-generate-example-ET9bJiJNTYLq53nXmxgioT.webp"
                  alt="AI Generate Example - Lion"
                  className="w-full aspect-square object-contain rounded-lg bg-gray-50 border border-gray-100"
                />
                <img
                  src="https://d2xsxph8kpxj0f.cloudfront.net/310519663365044246/hnDFdLkzVGYJYdws9hbnLw/ai-demo-menorah-WZDfWuRCGmoZS2mgqWHnUG.webp"
                  alt="AI Generate Example - Menorah"
                  className="w-full aspect-square object-contain rounded-lg bg-gray-50 border border-gray-100"
                />
                <img
                  src="https://d2xsxph8kpxj0f.cloudfront.net/310519663365044246/hnDFdLkzVGYJYdws9hbnLw/ai-demo-star-4dTVhBTtptWohs8XBhQsBE.webp"
                  alt="AI Generate Example - Star of David"
                  className="w-full aspect-square object-contain rounded-lg bg-gray-50 border border-gray-100"
                />
              </div>
            </div>
            <AiGeneratorTab />
          </TabsContent>

          <TabsContent value="trace">
            {/* Demo banner — AI Trace */}
            <div
              className="mb-4 rounded-xl overflow-hidden p-3"
              style={{ background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{background: '#f0fdf9'}}>
                  <Scan className="w-3 h-3 text-teal-600" />
                </div>
                <span className="text-xs font-semibold text-teal-700">
                  {isRtl ? "דוגמה — העלה תמונה, ה-AI יהפוך אותה לקווים נקיים לחריטה" : "Example — upload a photo, AI converts it to clean engraving lines"}
                </span>
              </div>
              <img
                src="https://d2xsxph8kpxj0f.cloudfront.net/310519663365044246/hnDFdLkzVGYJYdws9hbnLw/tab-ai-trace-lv-example-v2-hM6RghsZyzvy3mooS3ymTh.webp"
                alt="AI Trace Example"
                className="w-full max-h-44 object-contain rounded-lg bg-gray-50"
              />
            </div>
            <AiTraceTab onOpenAuth={() => { setLimitReached(true); setAuthOpen(true); }} />
          </TabsContent>

          <TabsContent value="redraw">
            {/* Demo gallery — AI Document */}
            <div
              className="mb-4 rounded-xl overflow-hidden p-3"
              style={{ background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{background: '#fffbeb'}}>
                  <FileEdit className="w-3 h-3 text-amber-600" />
                </div>
                <span className="text-xs font-semibold text-amber-700">
                  {isRtl ? "דוגמאות — צלם מסמך/ציור, ה-AI יחלץ רק את האיורים" : "Examples — photo a document/drawing, AI extracts only the illustrations"}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-xs text-gray-400 mb-1 text-center">{isRtl ? "מסמך כללי" : "General document"}</p>
                  <img
                    src="https://d2xsxph8kpxj0f.cloudfront.net/310519663365044246/hnDFdLkzVGYJYdws9hbnLw/tab-ai-doc-demo-v2-ERRyD4Xbd5DBFP9YDBozrf.webp"
                    alt="AI Document Redraw Example"
                    className="w-full max-h-40 object-contain rounded-lg bg-gray-50 border border-gray-100"
                  />
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1 text-center">{isRtl ? "פרח ממסמך" : "Flower from document"}</p>
                  <img
                    src="https://d2xsxph8kpxj0f.cloudfront.net/310519663365044246/hnDFdLkzVGYJYdws9hbnLw/doc-flower-demo-EiYtgsExnwrmQ7LDpoGJ8F.webp"
                    alt="Flower extracted from document"
                    className="w-full max-h-40 object-contain rounded-lg bg-gray-50 border border-gray-100"
                  />
                </div>
              </div>
            </div>
            <AiDocumentRedrawTab onOpenAuth={() => { setLimitReached(true); setAuthOpen(true); }} />
          </TabsContent>
        </Tabs>
        </div>{/* end centering wrapper */}
      </main>

      <footer
        className="mt-8"
        style={{ borderTop: '1px solid #e2e8f0', background: '#ffffff' }}
      >
        <div className="container py-4 text-center space-y-1.5">
          <div className="text-xs text-gray-400">{t("appFooter")}</div>
          <div className="flex items-center justify-center gap-3 text-xs text-gray-400">
            <a href="/terms" className="hover:text-gray-600 hover:underline transition-colors">
              {isRtl ? "תנאי שימוש" : "Terms of Service"}
            </a>
            <span>·</span>
            <a href="/privacy" className="hover:text-gray-600 hover:underline transition-colors">
              {isRtl ? "מדיניות פרטיות" : "Privacy Policy"}
            </a>
            <span>·</span>
            <span>© 2026 Image to DXF</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

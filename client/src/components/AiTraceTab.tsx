/**
 * AiTraceTab.tsx — Redesigned to match AI Generate tab quality:
 *  User uploads photo → LLM analyzes → gpt-image-1 draws 3 clean B&W variations from scratch
 *  → potrace → DXF ready (same pipeline as generateRoute)
 *  No two-step process needed — results arrive in one shot.
 */

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { DxfDownloadDialog } from "@/components/DxfDownloadDialog";
import {
  Download,
  AlertCircle,
  ImageIcon,
  Scan,
  Eye,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Wand2,
  CheckCircle2,
} from "lucide-react";

interface GeneratedImage {
  imageUrl: string;
  svgPreview: string;
  dxfUrl: string;
  dxfFilename: string;
  segmentCount: number;
  width: number;
  height: number;
  realWidth: number;
  realHeight: number;
}

interface TraceResult {
  images: GeneratedImage[];
  objectDescription: string;
  suggestions: string[];
}

type Status = "idle" | "loading" | "success" | "error";

const VARIATION_LABELS = ["פשוט", "מפורט", "דקורטיבי"];
const VARIATION_LABELS_EN = ["Simple", "Detailed", "Decorative"];

function SvgViewer({ svgContent }: { svgContent: string }) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const panStart = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const lastPinchDist = useRef<number | null>(null);

  const clamp = (s: number) => Math.min(10, Math.max(0.3, s));
  const zoomIn = (e: React.MouseEvent) => { e.stopPropagation(); setScale((s) => clamp(parseFloat((s * 1.4).toFixed(2)))); };
  const zoomOut = (e: React.MouseEvent) => { e.stopPropagation(); setScale((s) => clamp(parseFloat((s / 1.4).toFixed(2)))); };
  const resetView = (e: React.MouseEvent) => { e.stopPropagation(); setScale(1); setOffset({ x: 0, y: 0 }); };

  const onWheel = (e: React.WheelEvent) => { e.preventDefault(); const f = e.deltaY < 0 ? 1.12 : 1/1.12; setScale((s) => clamp(parseFloat((s*f).toFixed(3)))); };
  const onMouseDown = (e: React.MouseEvent) => { if (e.button !== 0) return; e.preventDefault(); setIsPanning(true); panStart.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y }; };
  const onMouseMove = (e: React.MouseEvent) => { if (!isPanning || !panStart.current) return; setOffset({ x: panStart.current.ox + e.clientX - panStart.current.x, y: panStart.current.oy + e.clientY - panStart.current.y }); };
  const onMouseUp = () => { setIsPanning(false); panStart.current = null; };
  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) { const dx = e.touches[0].clientX - e.touches[1].clientX; const dy = e.touches[0].clientY - e.touches[1].clientY; lastPinchDist.current = Math.hypot(dx, dy); }
    else if (e.touches.length === 1) { panStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, ox: offset.x, oy: offset.y }; }
  };
  const onTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 2 && lastPinchDist.current !== null) { const dx = e.touches[0].clientX - e.touches[1].clientX; const dy = e.touches[0].clientY - e.touches[1].clientY; const dist = Math.hypot(dx, dy); setScale((s) => clamp(parseFloat((s * dist / lastPinchDist.current!).toFixed(3)))); lastPinchDist.current = dist; }
    else if (e.touches.length === 1 && panStart.current) { setOffset({ x: panStart.current.ox + e.touches[0].clientX - panStart.current.x, y: panStart.current.oy + e.touches[0].clientY - panStart.current.y }); }
  };
  const onTouchEnd = () => { lastPinchDist.current = null; panStart.current = null; };

  const styledSvg = svgContent.replace(/<svg([^>]*)>/, (_m, attrs) =>
    /width=/.test(attrs) && /height=/.test(attrs)
      ? `<svg${attrs} style="display:block;max-width:100%;max-height:100%;">`
      : `<svg${attrs} style="display:block;width:100%;height:100%;">`
  );

  const Viewer = ({ height }: { height: number | string }) => (
    <div className="relative overflow-hidden bg-white select-none" style={{ height, cursor: isPanning ? "grabbing" : "grab" }}
      onWheel={onWheel} onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
      onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      <div style={{ position: "absolute", top: "50%", left: "50%", transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px)) scale(${scale})`, transformOrigin: "center center", width: "90%", height: "90%", display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}
        dangerouslySetInnerHTML={{ __html: styledSvg }} />
    </div>
  );

  const Toolbar = ({ onClose }: { onClose?: (e: React.MouseEvent) => void }) => (
    <div className="flex items-center gap-1 px-3 border-b bg-muted/30" style={{ minHeight: 44 }}>
      <Eye className="w-4 h-4 text-muted-foreground shrink-0" />
      <span className="text-xs text-muted-foreground font-medium flex-1">Vector Preview</span>
      <span className="text-xs text-muted-foreground/60 w-10 text-center">{Math.round(scale * 100)}%</span>
      <button onClick={zoomOut} className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-muted active:bg-muted/80"><ZoomOut className="w-5 h-5 text-foreground" /></button>
      <button onClick={zoomIn} className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-muted active:bg-muted/80"><ZoomIn className="w-5 h-5 text-foreground" /></button>
      <button onClick={onClose ?? ((e) => { e.stopPropagation(); setFullscreen(true); setScale(1); setOffset({ x: 0, y: 0 }); })} className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-muted active:bg-muted/80">
        {onClose ? <span className="text-lg font-bold">✕</span> : <Maximize2 className="w-5 h-5 text-primary" />}
      </button>
      {!onClose && <button onClick={resetView} className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-muted active:bg-muted/80"><Maximize2 className="w-4 h-4 text-muted-foreground" /></button>}
    </div>
  );

  return (
    <>
      {fullscreen && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col">
          <Toolbar onClose={(e) => { e.stopPropagation(); setFullscreen(false); setScale(1); setOffset({ x: 0, y: 0 }); }} />
          <div className="flex-1 overflow-hidden"><Viewer height="100%" /></div>
        </div>
      )}
      <div className="border rounded-lg overflow-hidden bg-white">
        <Toolbar />
        <Viewer height={450} />
      </div>
    </>
  );
}

interface ImageCardProps {
  image: GeneratedImage;
  index: number;
  isRtl: boolean;
  onDownload: (image: GeneratedImage) => void;
  onZoom: (src: string, alt: string) => void;
}

function ImageCard({ image, index, isRtl, onDownload, onZoom }: ImageCardProps) {
  const [showVector, setShowVector] = useState(false);
  const label = isRtl ? VARIATION_LABELS[index] : VARIATION_LABELS_EN[index];

  return (
    <Card className="border-primary/20">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">{label}</span>
          <span className="text-xs text-muted-foreground">{image.segmentCount.toLocaleString()} {isRtl ? "קווים" : "lines"}</span>
        </div>

        {/* AI Drawing preview */}
        <div
          className="border rounded-lg overflow-hidden bg-white mb-3 relative group cursor-zoom-in"
          onClick={() => onZoom(image.imageUrl, label)}
        >
          <img src={image.imageUrl} alt={`Variation ${index + 1}`} className="w-full h-auto block" />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
            <ZoomIn className="w-7 h-7 text-white opacity-0 group-hover:opacity-80 transition-opacity drop-shadow" />
          </div>
        </div>

        {/* Toggle vector preview */}
        <button
          onClick={() => setShowVector(!showVector)}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 mb-3 rounded-xl border-2 border-primary bg-primary/10 hover:bg-primary/20 active:bg-primary/30 transition-colors font-bold text-base text-primary shadow-sm"
        >
          <Eye className="w-5 h-5" />
          {showVector ? (isRtl ? "⬆ הסתר וקטור" : "⬆ Hide Vector") : (isRtl ? "⬇ הצג וקטור" : "⬇ Show Vector")}
        </button>

        {showVector && (
          <div className="mb-3">
            <SvgViewer svgContent={image.svgPreview} />
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 mb-3 text-center">
          <div className="bg-muted/30 rounded p-1.5">
            <p className="text-xs font-semibold">{image.realWidth ? (image.realWidth / 3.7795).toFixed(0) : "—"} mm</p>
            <p className="text-xs text-muted-foreground">{isRtl ? "רוחב" : "Width"}</p>
          </div>
          <div className="bg-muted/30 rounded p-1.5">
            <p className="text-xs font-semibold">{image.realHeight ? (image.realHeight / 3.7795).toFixed(0) : "—"} mm</p>
            <p className="text-xs text-muted-foreground">{isRtl ? "גובה" : "Height"}</p>
          </div>
        </div>

        <Button size="sm" className="w-full bg-green-600 hover:bg-green-700 font-semibold" onClick={() => onDownload(image)}>
          <Download className="w-3.5 h-3.5 ml-1.5" />
          {isRtl ? "הורד DXF" : "Download DXF"}
        </Button>
      </CardContent>
    </Card>
  );
}

interface AiTraceTabProps { onOpenAuth: () => void; }

export function AiTraceTab({ onOpenAuth }: AiTraceTabProps) {
  const { t, isRtl, language } = useLanguage();
  const { refetch: refetchTokens } = trpc.tokens.balance.useQuery(undefined, { enabled: false });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [focusText, setFocusText] = useState("");
  const [customImprovement, setCustomImprovement] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<TraceResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [downloadTarget, setDownloadTarget] = useState<GeneratedImage | null>(null);
  const [zoomImg, setZoomImg] = useState<{ src: string; alt: string } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    const allowed = ["image/png", "image/jpeg", "image/bmp", "image/webp", "image/gif"];
    if (!allowed.includes(file.type)) { toast.error(isRtl ? "פורמט לא נתמך." : "Unsupported format."); return; }
    if (file.size > 16 * 1024 * 1024) { toast.error(isRtl ? "הקובץ גדול מדי. מקסימום 16 MB." : "File too large. Max 16 MB."); return; }
    setImageFile(file);
    setResult(null);
    setStatus("idle");
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);
  }, [isRtl]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0]; if (file) handleFile(file);
  }, [handleFile]);

  const handleTrace = async () => {
    if (!imageFile) return;
    setStatus("loading"); setResult(null); setErrorMsg("");
    try {
      const formData = new FormData();
      formData.append("image", imageFile);
      if (description.trim()) formData.append("description", description.trim());
      if (focusText.trim()) formData.append("focusText", focusText.trim());
      formData.append("lang", isRtl ? "he" : "en");
      const res = await fetch("/api/ai-trace", { method: "POST", body: formData, credentials: "include" });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === "UNAUTHORIZED") { onOpenAuth(); setStatus("idle"); return; }
        if (data.error === "QUOTA_EXCEEDED" || data.error === "INSUFFICIENT_TOKENS") {
          const msg = language === "he" ? (data.message || t("quotaExceeded")) : (data.messageEn || data.message || t("quotaExceeded"));
          toast.error(msg); setErrorMsg(msg); setStatus("error"); refetchTokens(); return;
        }
        throw new Error(isRtl ? (data.message || data.error) : (data.messageEn || data.error || "Error"));
      }
      setResult(data as TraceResult);
      setStatus("success");
      refetchTokens();
      toast.success(isRtl ? `3 עיצובים מוכנים! בחר את המועדף ולחץ הורד DXF` : `3 designs ready! Choose your favorite and download DXF`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (isRtl ? "שגיאה בעיבוד" : "Processing error");
      setErrorMsg(msg); setStatus("error"); toast.error(msg);
    }
  };

  const reset = () => {
    setImageFile(null); setImagePreview(null); setResult(null);
    setStatus("idle"); setErrorMsg(""); setFocusText(""); setCustomImprovement("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <>
      {zoomImg && (
        <div
          className="fixed inset-0 z-50 bg-black/85 flex flex-col"
          onClick={() => setZoomImg(null)}
        >
          {/* Big close button top-right */}
          <button
            onClick={() => setZoomImg(null)}
            className="absolute top-4 right-4 z-10 w-12 h-12 rounded-full bg-white/20 hover:bg-white/40 active:bg-white/60 flex items-center justify-center text-white text-2xl font-bold shadow-lg"
            aria-label="Close"
          >
            ✕
          </button>
          <div className="flex-1 flex items-center justify-center overflow-hidden p-6 pt-16">
            <img
              src={zoomImg.src}
              alt={zoomImg.alt}
              style={{ maxWidth: "92vw", maxHeight: "82vh", objectFit: "contain" }}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          <p className="text-center text-sm text-white/50 pb-4 shrink-0">
            {isRtl ? "לחץ בכל מקום לסגירה" : "Tap anywhere to close"}
          </p>
        </div>
      )}
      {downloadTarget && (
        <DxfDownloadDialog
          open={!!downloadTarget} onClose={() => setDownloadTarget(null)}
          svgContent={downloadTarget.svgPreview} dxfUrl={downloadTarget.dxfUrl}
          defaultFilename={downloadTarget.dxfFilename ?? `ai-trace-${Date.now()}.dxf`}
          segmentCount={downloadTarget.segmentCount}
          svgWidth={downloadTarget.realWidth ?? 500}
          svgHeight={downloadTarget.realHeight ?? 500}
        />
      )}

      <div className="flex flex-col gap-5">
        {/* Upload area */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <Scan className="w-4 h-4 text-primary" />
              <h2 className="font-semibold text-sm">{t("aiTraceTitle")}</h2>
            </div>

            <div
              className={`border-2 border-dashed rounded-xl transition-colors cursor-pointer mb-3 ${dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/20 hover:border-primary/50"} ${imagePreview ? "p-2" : "p-8"}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              {imagePreview ? (
                <div className="flex items-center gap-3">
                  <img src={imagePreview} alt="Preview" className="w-16 h-16 object-cover rounded-lg border" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{imageFile?.name}</p>
                    <p className="text-xs text-muted-foreground">{isRtl ? "לחץ להחלפה" : "Click to change"}</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 text-center">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <ImageIcon className="w-6 h-6 text-primary" />
                  </div>
                  <p className="font-medium text-sm">{t("aiTraceDrop")}</p>
                  <p className="text-xs text-muted-foreground">{t("aiTraceFormats")}</p>
                </div>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/bmp,image/webp,image/gif" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />

            {/* Focus text — what to draw */}
            <div className="mb-3">
              <label className="block text-xs font-semibold text-muted-foreground mb-1">
                {isRtl ? "מה לצייר? (ברירת מחדל: האובייקט הדומיננטי)" : "What to draw? (default: dominant object)"}
              </label>
              <input
                type="text"
                value={focusText}
                onChange={(e) => setFocusText(e.target.value)}
                placeholder={isRtl ? "לדוגמה: רק הכיסאות, רק העציץ, הכלב בלבד..." : "e.g. only the chairs, only the plant, just the dog..."}
                className="w-full text-sm border rounded-lg px-3 py-2 bg-background placeholder:text-muted-foreground/50"
                style={{ textAlign: isRtl ? "right" : "left" }}
                dir={isRtl ? "rtl" : "ltr"}
              />
            </div>
            <input type="hidden" value={description} onChange={(e) => setDescription(e.target.value)} />

            <Button size="lg" className="w-full font-semibold"
              disabled={!imageFile || status === "loading"}
              onClick={handleTrace}>
              {status === "loading" ? (
                <><div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin ml-2" />{isRtl ? "ה-AI מנתח ומצייר..." : "AI is analyzing and drawing..."}</>
              ) : (
                <><Wand2 className="w-4 h-4 ml-2" />{isRtl ? "צור outline בAI" : "Create AI Outline"}</>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Loading */}
        {status === "loading" && (
          <Card>
            <CardContent className="p-8 flex flex-col items-center gap-3 text-center">
              <div className="relative w-16 h-16">
                <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
                <div className="absolute inset-0 rounded-full border-4 border-t-primary animate-spin" />
                <Wand2 className="absolute inset-0 m-auto w-6 h-6 text-primary" />
              </div>
              <p className="font-semibold text-sm">{isRtl ? "ה-AI מנתח את התמונה ומצייר 3 עיצובים..." : "AI is analyzing your image and drawing 3 designs..."}</p>
              <p className="text-xs text-muted-foreground">{isRtl ? "זה עשוי לקחת 30-60 שניות" : "This may take 30-60 seconds"}</p>
              <div className="flex gap-1.5">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error */}
        {status === "error" && (
          <Card>
            <CardContent className="p-6 flex flex-col items-center gap-3 text-center">
              <AlertCircle className="w-10 h-10 text-red-400" />
              <p className="font-semibold text-red-600">{isRtl ? "שגיאה בעיבוד" : "Processing Error"}</p>
              <p className="text-sm text-muted-foreground">{errorMsg}</p>
              <Button variant="outline" size="sm" onClick={reset}>{isRtl ? "נסה שוב" : "Try Again"}</Button>
            </CardContent>
          </Card>
        )}

        {/* Results — 3 variations */}
        {status === "success" && result && (
          <>
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                  <span className="font-semibold text-sm">
                    {isRtl ? "3 עיצובים מוכנים — בחר את המועדף" : "3 designs ready — choose your favorite"}
                  </span>
                </div>
                {result.objectDescription && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    <span className="font-medium">{isRtl ? "תיאור AI: " : "AI description: "}</span>
                    {result.objectDescription}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* AI Suggestions + custom improvement */}
            {result.suggestions && result.suggestions.length > 0 && (
              <Card className="border-blue-200 bg-blue-50">
                <CardContent className="p-4">
                  {/* Header */}
                  <div className="flex items-center gap-2 mb-3">
                    <Wand2 className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-semibold text-blue-700">
                      {isRtl ? "שפר את העיצוב" : "Improve the design"}
                    </span>
                  </div>

                  {/* Style variation chips */}
                  <p className="text-xs text-blue-600 font-medium mb-1.5">
                    {isRtl ? "שנה סגנון:" : "Change style:"}
                  </p>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {(isRtl ? VARIATION_LABELS : VARIATION_LABELS_EN).map((label, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setFocusText(label);
                          handleTrace();
                        }}
                        className="text-xs px-3 py-1.5 rounded-full border border-indigo-300 bg-indigo-50 hover:bg-indigo-100 active:bg-indigo-200 text-indigo-700 font-medium transition-colors shadow-sm"
                      >
                        🎨 {label}
                      </button>
                    ))}
                  </div>

                  {/* AI suggestions */}
                  <p className="text-xs text-blue-600 font-medium mb-1.5">
                    {isRtl ? "הצעות ה-AI:" : "AI suggestions:"}
                  </p>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {result.suggestions.map((suggestion, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setFocusText(suggestion);
                          handleTrace();
                        }}
                        className="text-xs px-3 py-1.5 rounded-full border border-blue-300 bg-white hover:bg-blue-100 active:bg-blue-200 text-blue-700 font-medium transition-colors shadow-sm"
                      >
                        ✨ {suggestion}
                      </button>
                    ))}
                  </div>

                  {/* Free-text custom improvement */}
                  <p className="text-xs text-blue-600 font-medium mb-1.5">
                    {isRtl ? "או הקלד בקשה משלהך:" : "Or type your own request:"}
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={customImprovement}
                      onChange={(e) => setCustomImprovement(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && customImprovement.trim()) {
                          setFocusText(customImprovement.trim());
                          setCustomImprovement("");
                          handleTrace();
                        }
                      }}
                      placeholder={isRtl ? "לדוגמה: הוסף פרטים, שנה סגנון, עשה יותר קטן..." : "e.g. add more detail, make it cuter, cartoon style..."}
                      className="flex-1 text-sm border border-blue-300 rounded-lg px-3 py-2 bg-white placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-blue-400"
                      dir={isRtl ? "rtl" : "ltr"}
                    />
                    <button
                      onClick={() => {
                        if (customImprovement.trim()) {
                          setFocusText(customImprovement.trim());
                          setCustomImprovement("");
                          handleTrace();
                        }
                      }}
                      disabled={!customImprovement.trim()}
                      className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-semibold transition-colors"
                    >
                      {isRtl ? "החל" : "Go"}
                    </button>
                  </div>
                </CardContent>
              </Card>
            )}

            {result.images.map((image, idx) => (
              <ImageCard
                key={idx}
                image={image}
                index={idx}
                isRtl={isRtl}
                onDownload={setDownloadTarget}
                onZoom={(src, alt) => setZoomImg({ src, alt })}
              />
            ))}

            <Button variant="outline" size="sm" className="w-full" onClick={reset}>
              {t("aiTraceNewImage")}
            </Button>
          </>
        )}

        {/* Tips */}
        <Card className="bg-blue-50 border-blue-100">
          <CardContent className="p-4">
            <h3 className="font-semibold text-sm text-blue-800 mb-2">{t("tipsTitle")}</h3>
            <ul className="space-y-1.5 text-sm text-blue-700">
              <li className="flex gap-2"><span className="shrink-0">•</span><span>{t("aiTraceTip1")}</span></li>
              <li className="flex gap-2"><span className="shrink-0">•</span><span>{t("aiTraceTip2")}</span></li>
              <li className="flex gap-2"><span className="shrink-0">•</span><span>{isRtl ? "ה-AI מנתח את התמונה ומצייר מחדש — 3 סגנונות שונים לבחירה" : "AI analyzes your image and redraws it — 3 different styles to choose from"}</span></li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

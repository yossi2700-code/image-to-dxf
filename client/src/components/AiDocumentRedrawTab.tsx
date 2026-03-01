/**
 * AiDocumentRedrawTab.tsx
 * 
 * Feature: "עריכת AI מצילום/מסמך"
 * 
 * User uploads a photo of a drawing, document, sign, or memorial stone.
 * → GPT-4o Vision analyzes and faithfully describes every element
 * → gpt-image-1 redraws it as clean B&W line art (maximally faithful to original)
 * → potrace vectorizes → DXF ready for laser engraving
 * 
 * One result + option to request correction.
 */
import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { DxfDownloadDialog } from "@/components/DxfDownloadDialog";
import {
  Download,
  AlertCircle,
  ImageIcon,
  Eye,
  EyeOff,
  Loader2,
  Wand2,
  Sparkles,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  FileCode2,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface RedrawImage {
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

interface RedrawResult {
  success: boolean;
  image: RedrawImage;
  objectDescription: string;
}

type Status = "idle" | "loading" | "success" | "error";

// ─── SVG Viewer (inline, touch-friendly) ─────────────────────────────────────
function SvgViewer({ svgContent }: { svgContent: string }) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const panStart = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const lastTouchDist = useRef<number | null>(null);

  const styledSvg = svgContent
    .replace(/fill="black"/g, 'fill="#1a1a2e"')
    .replace(/stroke="black"/g, 'stroke="#1a1a2e"');

  const svgMatch = svgContent.match(/viewBox="[^"]*"/);
  const viewBoxVals = svgMatch?.[0]?.match(/[\d.]+/g);
  const svgAspect = viewBoxVals && viewBoxVals.length >= 4
    ? parseFloat(viewBoxVals[3]) / parseFloat(viewBoxVals[2])
    : 1;

  const zoomIn = () => setScale((s) => Math.min(s * 1.3, 8));
  const zoomOut = () => setScale((s) => Math.max(s / 1.3, 0.2));
  const resetView = () => { setScale(1); setOffset({ x: 0, y: 0 }); };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setScale((s) => Math.min(Math.max(s * (e.deltaY < 0 ? 1.15 : 0.87), 0.2), 8));
  };
  const onMouseDown = (e: React.MouseEvent) => {
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
      lastTouchDist.current = Math.sqrt(dx * dx + dy * dy);
    } else if (e.touches.length === 1) {
      panStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, ox: offset.x, oy: offset.y };
    }
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && lastTouchDist.current !== null) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      setScale((s) => Math.min(Math.max(s * (dist / lastTouchDist.current!), 0.2), 8));
      lastTouchDist.current = dist;
    } else if (e.touches.length === 1 && panStart.current) {
      setOffset({ x: panStart.current.ox + e.touches[0].clientX - panStart.current.x, y: panStart.current.oy + e.touches[0].clientY - panStart.current.y });
    }
  };
  const onTouchEnd = () => { lastTouchDist.current = null; panStart.current = null; };

  const Viewer = ({ height = "100%" }: { height?: string }) => (
    <div
      style={{ width: "100%", height, position: "relative", overflow: "hidden", background: "#fff" }}
      onWheel={onWheel}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      className="select-none"
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
    <div className="flex items-center gap-1 p-1.5 bg-muted/50 border-b justify-end">
      <button onClick={zoomOut} className="w-8 h-8 rounded flex items-center justify-center hover:bg-muted"><ZoomOut className="w-4 h-4" /></button>
      <button onClick={zoomIn} className="w-8 h-8 rounded flex items-center justify-center hover:bg-muted"><ZoomIn className="w-4 h-4" /></button>
      <button onClick={onClose ?? (() => { setFullscreen(true); setScale(1); setOffset({ x: 0, y: 0 }); })} className="w-8 h-8 rounded flex items-center justify-center hover:bg-muted">
        {onClose ? <span className="text-base font-bold">✕</span> : <Maximize2 className="w-4 h-4 text-primary" />}
      </button>
      {!onClose && <button onClick={resetView} className="w-8 h-8 rounded flex items-center justify-center hover:bg-muted"><RefreshCw className="w-3.5 h-3.5 text-muted-foreground" /></button>}
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
        <div
          ref={(el) => {
            if (el) {
              const w = el.getBoundingClientRect().width;
              el.style.height = Math.min(Math.max(w * svgAspect, 180), 480) + "px";
            }
          }}
          className="relative overflow-hidden bg-white"
        >
          <Viewer />
        </div>
      </div>
    </>
  );
}

// ─── Correction Panel ─────────────────────────────────────────────────────────
interface CorrectionPanelProps {
  imageUrl: string;
  objectDescription: string;
  onRefined: (image: RedrawImage) => void;
  isRtl: boolean;
}
function CorrectionPanel({ imageUrl, objectDescription, onRefined, isRtl }: CorrectionPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { refetch: refetchTokens } = trpc.tokens.balance.useQuery(undefined, { enabled: false });

  const examples = isRtl
    ? ["הוסף מסגרת מסביב", "הפוך את הכתב לגדול יותר", "הסר את הרקע", "הוסף פרטים לציור"]
    : ["Add a border around", "Make the text larger", "Remove background elements", "Add more detail"];

  const handleRefine = async () => {
    if (!instruction.trim() || instruction.trim().length < 3) {
      toast.error(isRtl ? "נא לתאר את התיקון הרצוי" : "Please describe the desired correction");
      return;
    }
    setIsLoading(true);
    try {
      const response = await fetch("/api/ai-document-redraw/refine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ imageUrl, instruction: instruction.trim(), objectDescription }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (data.error === "INSUFFICIENT_TOKENS") {
          toast.error(isRtl ? (data.message || "נגמרו האסימונים") : (data.messageEn || "Out of tokens"), {
            action: { label: isRtl ? "רכוש אסימונים" : "Buy Tokens", onClick: () => { window.location.href = "/tokens"; } },
            duration: 6000,
          });
        } else {
          toast.error(data.message || (isRtl ? "שגיאה בתיקון" : "Refinement error"));
        }
        return;
      }
      toast.success(isRtl ? "התיקון הוחל בהצלחה!" : "Correction applied successfully!");
      setInstruction("");
      setIsOpen(false);
      refetchTokens();
      onRefined(data.image as RedrawImage);
    } catch {
      toast.error(isRtl ? "שגיאה בתיקון" : "Refinement error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mt-3 rounded-xl border border-amber-400/30 bg-amber-50/30 dark:bg-amber-950/20 overflow-hidden" dir={isRtl ? "rtl" : "ltr"}>
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 text-sm font-semibold text-amber-700 dark:text-amber-400 hover:bg-amber-50/50 transition-colors"
      >
        <Wand2 className="w-4 h-4 shrink-0" />
        <span className="flex-1 text-start">{isRtl ? "בקש תיקון מה-AI" : "Request AI Correction"}</span>
        {isOpen ? <ChevronUp className="w-4 h-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 shrink-0 text-muted-foreground" />}
      </button>
      {isOpen && (
        <div className="px-4 pb-4 space-y-3">
          <p className="text-xs text-muted-foreground">
            {isRtl
              ? "תאר מה לשנות בציור — ה-AI יחיל את התיקון ויצור גרסה חדשה"
              : "Describe what to change — AI will apply the correction and create a new version"}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {examples.map((ex) => (
              <button
                key={ex}
                onClick={() => setInstruction(ex)}
                className="text-xs px-2.5 py-1 rounded-full bg-background border border-border hover:border-amber-400/50 hover:bg-amber-50/30 transition-colors text-muted-foreground hover:text-foreground"
              >
                {ex}
              </button>
            ))}
          </div>
          <Textarea
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder={isRtl ? "לדוגמה: הגדל את הכתב, הוסף מסגרת, הסר פרטים מיותרים..." : "e.g. make the text larger, add a frame, remove unnecessary details..."}
            className="min-h-[80px] text-sm resize-none"
            disabled={isLoading}
            dir={isRtl ? "rtl" : "ltr"}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleRefine(); }}
          />
          <Button
            onClick={handleRefine}
            disabled={isLoading || !instruction.trim()}
            className="w-full bg-amber-600 hover:bg-amber-700 text-white h-10 text-sm gap-2"
          >
            {isLoading ? (
              <><Loader2 className="w-4 h-4 animate-spin" />{isRtl ? "מחיל תיקון..." : "Applying correction..."}</>
            ) : (
              <><Wand2 className="w-4 h-4" />{isRtl ? "החל תיקון" : "Apply Correction"}</>
            )}
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            {isRtl ? "טיפ: ככל שהתיאור מדויק יותר, כך התוצאה טובה יותר" : "Tip: The more specific the description, the better the result"}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Result Card ──────────────────────────────────────────────────────────────
interface ResultCardProps {
  image: RedrawImage;
  objectDescription: string;
  isRtl: boolean;
  onDownload: () => void;
  onZoom: (src: string) => void;
  onRefined: (image: RedrawImage) => void;
  originalPreview?: string | null;
}
function ResultCard({ image, objectDescription, isRtl, onDownload, onZoom, onRefined, originalPreview }: ResultCardProps) {
  const [showVector, setShowVector] = useState(false);
  const [showComparison, setShowComparison] = useState(false);

  return (
    <Card className="border-primary/20 shadow-md">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-primary bg-primary/10 px-2.5 py-1 rounded-full flex items-center gap-1.5">
            <Sparkles className="w-3 h-3" />
            {isRtl ? "ציור מחדש AI" : "AI Redraw"}
          </span>
          <span className="text-xs text-muted-foreground">
            {image.segmentCount.toLocaleString()} {isRtl ? "קווים" : "lines"}
          </span>
        </div>

        {/* Before/After toggle button */}
        {originalPreview && (
          <button
            onClick={() => setShowComparison(!showComparison)}
            className={`w-full flex items-center justify-center gap-2 py-2 px-3 mb-3 rounded-lg border text-xs font-semibold transition-all ${
              showComparison
                ? "border-amber-500 bg-amber-500 text-white"
                : "border-amber-400 bg-amber-50 text-amber-700 hover:bg-amber-100"
            }`}
          >
            <span>{showComparison ? "🔄" : "👁"}</span>
            {showComparison
              ? (isRtl ? "הצג תוצאה בלבד" : "Show result only")
              : (isRtl ? "השווה לפני / אחרי" : "Compare Before / After")}
          </button>
        )}

        {/* Before/After comparison OR single preview */}
        {showComparison && originalPreview ? (
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="flex flex-col items-center gap-1">
              <span className="text-xs font-bold text-muted-foreground bg-muted/40 px-2 py-0.5 rounded-full">
                {isRtl ? "לפני" : "Before"}
              </span>
              <div
                className="border rounded-lg overflow-hidden bg-gray-100 w-full cursor-zoom-in"
                onClick={() => onZoom(originalPreview)}
              >
                <img src={originalPreview} alt="original" className="w-full object-contain" style={{ maxHeight: 200 }} />
              </div>
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                {isRtl ? "אחרי" : "After"}
              </span>
              <div
                className="border rounded-lg overflow-hidden bg-white w-full cursor-zoom-in"
                onClick={() => onZoom(image.imageUrl)}
              >
                <img src={image.imageUrl} alt="redraw" className="w-full object-contain" style={{ maxHeight: 200 }} />
              </div>
            </div>
          </div>
        ) : (
          /* Normal single AI Drawing preview */
          <div
            className="border rounded-lg overflow-hidden bg-white mb-3 relative group cursor-zoom-in"
            onClick={() => onZoom(image.imageUrl)}
          >
            <img
              src={image.imageUrl}
              alt={isRtl ? "ציור מחדש AI" : "AI Redraw"}
              className="w-full block"
              style={{ maxHeight: 360, objectFit: "contain" }}
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
              <ZoomIn className="w-7 h-7 text-white opacity-0 group-hover:opacity-80 transition-opacity drop-shadow" />
            </div>
          </div>
        )}

        {/* Toggle vector preview */}
        <button
          onClick={() => setShowVector(!showVector)}
          className={`w-full flex items-center justify-center gap-2.5 py-3 px-4 mb-3 rounded-xl border-2 transition-all font-semibold text-sm shadow-sm active:scale-[0.98]
            ${showVector
              ? "border-primary bg-primary text-white hover:bg-primary/90"
              : "border-primary bg-gradient-to-r from-primary/10 to-blue-500/10 text-primary hover:from-primary/20 hover:to-blue-500/20"}`}
        >
          {showVector ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          <FileCode2 className="w-4 h-4" />
          {showVector ? (isRtl ? "הסתר וקטור ⬆" : "⬆ Hide Vector") : (isRtl ? "הצג וקטור DXF ⬇" : "⬇ Show DXF Vector")}
        </button>

        {showVector && (
          <div className="mb-3">
            <SvgViewer svgContent={image.svgPreview} />
          </div>
        )}

        {/* Dimensions */}
        {(image.realWidth || image.realHeight) && (
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
        )}

        {/* Download button */}
        <Button
          size="lg"
          className="w-full bg-green-600 hover:bg-green-700 font-bold text-base h-12"
          onClick={onDownload}
        >
          <Download className="w-5 h-5 ml-2" />
          {isRtl ? "הורד DXF / PDF" : "Download DXF / PDF"}
        </Button>

        {/* Correction panel */}
        <CorrectionPanel
          imageUrl={image.imageUrl}
          objectDescription={objectDescription}
          onRefined={onRefined}
          isRtl={isRtl}
        />
      </CardContent>
    </Card>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
interface AiDocumentRedrawTabProps {
  onOpenAuth: () => void;
}

export function AiDocumentRedrawTab({ onOpenAuth }: AiDocumentRedrawTabProps) {
  const { isRtl } = useLanguage();
  const { refetch: refetchTokens } = trpc.tokens.balance.useQuery(undefined, { enabled: false });

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<RedrawResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [downloadTarget, setDownloadTarget] = useState<RedrawImage | null>(null);
  const [zoomImg, setZoomImg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    const allowed = ["image/png", "image/jpeg", "image/bmp", "image/webp", "image/gif", "image/heic", "image/heif"];
    if (!allowed.includes(file.type) && !file.name.match(/\.(jpg|jpeg|png|bmp|webp|gif|heic|heif)$/i)) {
      toast.error(isRtl ? "פורמט לא נתמך. השתמש ב-JPG, PNG, BMP, WebP." : "Unsupported format. Use JPG, PNG, BMP, WebP.");
      return;
    }
    if (file.size > 16 * 1024 * 1024) {
      toast.error(isRtl ? "הקובץ גדול מדי. מקסימום 16 MB." : "File too large. Max 16 MB.");
      return;
    }
    setImageFile(file);
    setResult(null);
    setStatus("idle");
    setErrorMsg("");
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);
  }, [isRtl]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleRedraw = async () => {
    if (!imageFile) return;
    setStatus("loading");
    setResult(null);
    setErrorMsg("");
    try {
      const formData = new FormData();
      formData.append("image", imageFile);
      if (description.trim()) formData.append("description", description.trim());

      const res = await fetch("/api/ai-document-redraw", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.error === "UNAUTHORIZED") {
          onOpenAuth();
          setStatus("idle");
          return;
        }
        if (data.error === "INSUFFICIENT_TOKENS") {
          const msg = isRtl ? (data.message || "נגמרו האסימונים") : (data.messageEn || "Out of tokens");
          toast.error(msg, {
            action: { label: isRtl ? "רכוש אסימונים" : "Buy Tokens", onClick: () => { window.location.href = "/tokens"; } },
            duration: 6000,
          });
          setErrorMsg(msg);
          setStatus("error");
          refetchTokens();
          return;
        }
        throw new Error(isRtl ? (data.message || data.error) : (data.messageEn || data.error || "Error"));
      }

      setResult(data as RedrawResult);
      setStatus("success");
      refetchTokens();
      toast.success(isRtl ? "הציור מחדש הושלם בהצלחה!" : "Redraw completed successfully!");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (isRtl ? "שגיאה בעיבוד" : "Processing error");
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
    setErrorMsg("");
    setDescription("");
  };

  return (
    <div className="space-y-4" dir={isRtl ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="text-center space-y-1 pb-1">
        <h2 className="text-lg font-bold flex items-center justify-center gap-2">
          <Wand2 className="w-5 h-5 text-amber-600" />
          {isRtl ? "עריכת AI מצילום/מסמך" : "AI Document Redraw"}
        </h2>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {isRtl
            ? "צלם ציור, מסמך, שלט — ה-AI יצייר מחדש כקווים נקיים לחריטה"
            : "Photo a drawing, document, sign, or stone — AI redraws as clean lines for engraving"}
        </p>
      </div>

      {/* Upload area */}
      <div className="relative">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
        />

        {imagePreview ? (
          /* Image preview */
          <div className="mb-3">
            <div className="relative rounded-xl overflow-hidden border-2 border-primary/20 bg-muted/10">
              <img
                src={imagePreview}
                alt={isRtl ? "תמונה שנבחרה" : "Selected image"}
                className="w-full max-h-56 object-contain block"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
              <div className="absolute bottom-2 right-2 left-2 flex items-center justify-between">
                <span className="text-xs text-white/90 bg-black/40 px-2 py-0.5 rounded-full truncate max-w-[60%]">
                  {imageFile?.name}
                </span>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs text-white bg-black/50 hover:bg-black/70 px-2.5 py-1 rounded-full transition-colors"
                >
                  {isRtl ? "החלף" : "Change"}
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Upload button */
          <div className="mb-3 space-y-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-3 py-6 rounded-xl border-2 border-dashed border-amber-400/50 bg-amber-50/20 hover:bg-amber-50/40 active:bg-amber-50/60 transition-colors"
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
            >
              <div className="w-12 h-12 rounded-full bg-amber-100/60 flex items-center justify-center shrink-0">
                <ImageIcon className="w-6 h-6 text-amber-600" />
              </div>
              <div className="text-start">
                <p className="font-semibold text-sm text-amber-700">
                  {isRtl ? "צלם או בחר תמונה" : "Take or Choose Photo"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isRtl ? "ציור, מסמך, שלט..." : "Drawing, document, sign..."}
                </p>
              </div>
            </button>
            <p className="hidden sm:block text-xs text-center text-muted-foreground">
              {isRtl ? "או גרור תמונה לכאן" : "or drag & drop an image here"}
            </p>
          </div>
        )}

        {/* Drag overlay */}
        {dragOver && !imagePreview && (
          <div className="absolute inset-0 rounded-xl bg-amber-400/20 border-2 border-amber-500 pointer-events-none" />
        )}
      </div>

      {/* Optional description */}
      <div>
        <label className="block text-xs font-semibold text-muted-foreground mb-1">
          {isRtl ? "הערות / הסבר (אופציונלי)" : "Notes / Context (optional)"}
        </label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={isRtl ? "לדוגמה: לוגו חברה, ציור עם פרחים, שלט עם עיטור..." : "e.g. company logo, drawing with flowers, sign with ornament..."}
          className="w-full text-sm border rounded-lg px-3 py-2 bg-background placeholder:text-muted-foreground/50"
          style={{ textAlign: isRtl ? "right" : "left" }}
          dir={isRtl ? "rtl" : "ltr"}
        />
      </div>

      {/* Submit button */}
      <Button
        size="lg"
        className="w-full font-bold text-base h-12 bg-amber-600 hover:bg-amber-700 text-white gap-2"
        disabled={!imageFile || status === "loading"}
        onClick={handleRedraw}
      >
        {status === "loading" ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            {isRtl ? "ה-AI מצייר מחדש..." : "AI is redrawing..."}
          </>
        ) : (
          <>
            <Wand2 className="w-5 h-5" />
            {isRtl ? "צייר מחדש עם AI" : "Redraw with AI"}
          </>
        )}
      </Button>

      {/* Processing state */}
      {status === "loading" && (
        <div className="text-center py-6 space-y-3">
          <div className="relative w-16 h-16 mx-auto">
            <div className="absolute inset-0 rounded-full border-4 border-amber-200 animate-pulse" />
            <div className="absolute inset-2 rounded-full border-4 border-amber-500 border-t-transparent animate-spin" />
            <Wand2 className="absolute inset-0 m-auto w-6 h-6 text-amber-600" />
          </div>
          <div>
            <p className="font-semibold text-sm">{isRtl ? "ה-AI מנתח ומצייר מחדש..." : "AI analyzing and redrawing..."}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {isRtl ? "מזהה כל אלמנט ומצייר קווים נקיים לחריטה" : "Identifying every element and drawing clean engraving lines"}
            </p>
          </div>
          <div className="flex justify-center gap-1.5 mt-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="w-2 h-2 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        </div>
      )}

      {/* Error state */}
      {status === "error" && errorMsg && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">{isRtl ? "שגיאה" : "Error"}</p>
            <p className="text-xs mt-0.5 opacity-80">{errorMsg}</p>
          </div>
        </div>
      )}

      {/* Result */}
      {status === "success" && result && (
        <div className="space-y-3">
          {/* AI description */}
          {result.objectDescription && (
            <div className="p-3 rounded-lg bg-muted/30 border border-muted">
              <p className="text-xs font-semibold text-muted-foreground mb-1">
                {isRtl ? "ה-AI זיהה:" : "AI identified:"}
              </p>
              <p className="text-xs leading-relaxed line-clamp-3">{result.objectDescription}</p>
            </div>
          )}

          <ResultCard
            image={result.image}
            objectDescription={result.objectDescription}
            isRtl={isRtl}
            onDownload={() => setDownloadTarget(result.image)}
            onZoom={(src) => setZoomImg(src)}
            originalPreview={imagePreview}
            onRefined={(newImage) => {
              setResult((prev) => prev ? { ...prev, image: newImage } : null);
              toast.success(isRtl ? "גרסה מתוקנת מוכנה!" : "Corrected version ready!");
            }}
          />

          {/* New image button */}
          <Button variant="outline" className="w-full gap-2" onClick={reset}>
            <RefreshCw className="w-4 h-4" />
            {isRtl ? "תמונה חדשה" : "New Image"}
          </Button>
        </div>
      )}

      {/* Download dialog */}
      {downloadTarget && (
        <DxfDownloadDialog
          open={!!downloadTarget}
          onClose={() => setDownloadTarget(null)}
          dxfUrl={downloadTarget.dxfUrl}
          defaultFilename={downloadTarget.dxfFilename || "document_redraw.dxf"}
          svgContent={downloadTarget.svgPreview}
          segmentCount={downloadTarget.segmentCount}
          svgWidth={downloadTarget.width}
          svgHeight={downloadTarget.height}
        />
      )}

      {/* Zoom lightbox */}
      {zoomImg && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setZoomImg(null)}
        >
          <button
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white text-xl font-bold"
            onClick={() => setZoomImg(null)}
          >
            ✕
          </button>
          <img
            src={zoomImg}
            alt="zoom"
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

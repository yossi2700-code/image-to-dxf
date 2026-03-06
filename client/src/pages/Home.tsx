import { useState, useRef, useCallback, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { AuthDialog, type AuthReason } from "@/components/AuthDialog";
import { DxfDownloadDialog } from "@/components/DxfDownloadDialog";
import { AiRefinePanel, type RefineResult } from "@/components/AiRefinePanel";
import { ExportButtons } from "@/components/ExportButtons";
import { AiTraceTab } from "@/components/AiTraceTab";
import { AiDocumentRedrawTab } from "@/components/AiDocumentRedrawTab";
import { FaceDetectTab } from "@/components/FaceDetectTab";
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
  ChevronRight,
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
// ─── Hero Before/After Animated Carousel ─────────────────────────────────────
// ─── Demo Image Slider ──────────────────────────────────────────────────────
function DemoSlider({ images, accentColor }: { images: { src: string; alt: string }[]; accentColor: string }) {
  const [idx, setIdx] = useState(0);
  const prev = () => setIdx(i => (i - 1 + images.length) % images.length);
  const next = () => setIdx(i => (i + 1) % images.length);
  const item = images[idx];
  return (
    <div className="relative w-full rounded-xl overflow-hidden" style={{ background: '#f8f9ff' }}>
      {/* Main image */}
      <div className="w-full" style={{ aspectRatio: '16/7' }}>
        <img
          key={idx}
          src={item.src}
          alt={item.alt}
          className="w-full h-full object-contain"
          style={{ display: 'block' }}
        />
      </div>
      {/* Nav arrows */}
      {images.length > 1 && (
        <>
          <button
            onClick={prev}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center transition-all hover:scale-110"
            style={{ background: accentColor, color: 'white', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={next}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center transition-all hover:scale-110"
            style={{ background: accentColor, color: 'white', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          {/* Dots */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => setIdx(i)}
                className="w-2 h-2 rounded-full transition-all"
                style={{ background: i === idx ? accentColor : 'rgba(255,255,255,0.7)', transform: i === idx ? 'scale(1.3)' : 'scale(1)' }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

const HERO_SLIDES = [
  {
    src: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663365044246/hnDFdLkzVGYJYdws9hbnLw/demo-v4-helmet-sm_294f43aa.png',
    alt: 'Helmet photo to DXF vector',
  },
  {
    src: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663365044246/hnDFdLkzVGYJYdws9hbnLw/hero-ba-guitar-MpriRjCxu5oPxg7QHX7wKa.webp',
    alt: 'Guitar photo to DXF vector',
  },
  {
    src: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663365044246/hnDFdLkzVGYJYdws9hbnLw/hero-ba-car-nFQArnrk3NUVMjA3PkA24F.webp',
    alt: 'Classic car photo to DXF vector',
  },
  {
    src: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663365044246/hnDFdLkzVGYJYdws9hbnLw/hero-ba-flower-ZLjxVZyJdERmSc2JgRNbGV.webp',
    alt: 'Rose flower photo to DXF vector',
  },
];

function HeroBeforeAfterCarousel() {
  const [current, setCurrent] = useState(0);
  const [visible, setVisible] = useState(0);
  const [fading, setFading] = useState(false);
  const { isRtl } = useLanguage();

  useEffect(() => {
    const interval = setInterval(() => {
      setFading(true);
      setTimeout(() => {
        setCurrent((c) => {
          const next = (c + 1) % HERO_SLIDES.length;
          setVisible(next);
          return next;
        });
        setFading(false);
      }, 500);
    }, 3200);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full">
      {/* Label above */}
      <div className="flex items-center justify-center gap-2 mb-2">
        <span className="text-xs font-semibold text-gray-400">
          {isRtl ? 'תמונה מקורית' : 'Original photo'}
        </span>
        <span style={{ color: '#6366f1', fontSize: 16 }}>→</span>
        <span
          className="text-xs font-bold"
          style={{ background: 'linear-gradient(135deg, #6366f1, #06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
        >
          {isRtl ? 'וקטור DXF' : 'DXF Vector'}
        </span>
      </div>
      {/* Carousel container */}
      <div
        className="relative rounded-2xl overflow-hidden w-full"
        style={{
          boxShadow: '0 8px 40px rgba(99,102,241,0.18)',
          background: '#f8f9ff',
          aspectRatio: '4/3',
        }}
      >
        {HERO_SLIDES.map((slide, i) => (
          <img
            key={slide.src}
            src={slide.src}
            alt={slide.alt}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              opacity: i === visible ? (fading ? 0 : 1) : 0,
              transition: 'opacity 0.5s ease-in-out',
              display: 'block',
            }}
          />
        ))}
        {/* Dot indicators */}
        <div
          className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5"
          style={{ zIndex: 2 }}
        >
          {HERO_SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => { setFading(true); setTimeout(() => { setVisible(i); setCurrent(i); setFading(false); }, 400); }}
              style={{
                width: i === current ? 18 : 6,
                height: 6,
                borderRadius: 3,
                background: i === current ? '#6366f1' : 'rgba(99,102,241,0.3)',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                padding: 0,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Announcement Banner ─────────────────────────────────────────────────────
function AnnouncementBanner() {
  const { isRtl } = useLanguage();
  const [dismissed, setDismissed] = useState(false);
  const { data } = trpc.announcement.get.useQuery(undefined, {
    staleTime: 5 * 60 * 1000, // cache for 5 minutes
  });

  if (dismissed || !data?.enabled || !data?.text) return null;

  return (
    <div
      className="mb-4 rounded-xl px-4 py-2.5 flex items-center gap-3"
      style={{
        background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #06b6d4 100%)',
        boxShadow: '0 2px 12px rgba(99,102,241,0.25)',
      }}
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      {/* Icon */}
      <span className="shrink-0 text-lg">🎉</span>
      {/* Text */}
      <p className="flex-1 text-sm font-medium text-white leading-snug">
        {data.text}
      </p>
      {/* Dismiss button */}
      <button
        onClick={() => setDismissed(true)}
        className="shrink-0 text-white/70 hover:text-white transition-colors p-0.5 rounded"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

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
  const [lineweightMm, setLineweightMm] = useState<string>(""); // empty = default (no override)
  const [minGapMm, setMinGapMm] = useState<string>("1.5"); // default 1.5mm min gap (recommended for CNC V-bit)
  const [outputWidthMm, setOutputWidthMm] = useState<string>("100"); // default 100mm output width
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

  /** Resize image client-side to max 1200px before upload to reduce server load */
  const resizeImageForUpload = (file: File, maxPx = 1200): Promise<Blob> => {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob((blob) => resolve(blob ?? file), "image/png", 0.95);
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
      img.src = url;
    });
  };

  const handleConvert = async () => {
    if (!imageFile) return;
    setStatus("loading");
    setResult(null);
    setErrorMsg("");
    setShowSvgPreview(false);
    try {
      // Resize client-side to max 1200px — reduces upload from ~20MB to ~300KB
      const uploadBlob = await resizeImageForUpload(imageFile, 1200);
      const formData = new FormData();
      formData.append("image", uploadBlob, imageFile.name.replace(/\.[^.]+$/, ".png"));
      formData.append("threshold", String(threshold));
      formData.append("simplifyTolerance", String(simplify));
      formData.append("doubleLineOffset", "0");
      const lwVal = parseFloat(lineweightMm);
      if (!isNaN(lwVal) && lwVal > 0) formData.append("lineweightMm", String(lwVal));
      const gapVal = parseFloat(minGapMm);
      if (!isNaN(gapVal) && gapVal > 0) formData.append("minGapMm", String(gapVal));
      const owVal = parseFloat(outputWidthMm);
      if (!isNaN(owVal) && owVal > 0) formData.append("outputWidthMm", String(owVal));
      formData.append("dpi", String(dpi));
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
              {/* Lineweight option */}
              <div className="flex items-center gap-2 pt-1 flex-wrap">
                <label className="text-sm font-medium shrink-0">
                  {isRtl ? "עובי קו ב-DXF (מ'מ):" : "DXF lineweight (mm):"}
                </label>
                <input
                  type="number"
                  min="0"
                  max="2"
                  step="0.05"
                  placeholder={isRtl ? "ברירת מחדל" : "default"}
                  value={lineweightMm}
                  onChange={e => setLineweightMm(e.target.value)}
                  className="w-24 border border-border rounded px-2 py-1 text-sm text-center"
                />
                <span className="text-xs text-muted-foreground">{isRtl ? "(0 = הדק ביותר, ריק = ברירת מחדל)" : "(0 = hairline, empty = default)"}</span>
              </div>
              {/* Min gap option */}
              <div className="flex items-center gap-2 pt-1 flex-wrap">
                <label className="text-sm font-medium shrink-0">
                  {isRtl ? "מרווח מינימלי בין קווים (מ'מ):" : "Min gap between lines (mm):"}
                </label>
                <input
                  type="number"
                  min="0.2"
                  max="3"
                  step="0.1"
                  placeholder="1.5"
                  value={minGapMm}
                  onChange={e => setMinGapMm(e.target.value)}
                  className="w-24 border border-border rounded px-2 py-1 text-sm text-center"
                />
                <span className="text-xs text-muted-foreground">{isRtl ? "(מומלץ 1.5 לקרסום V-bit 0.8 זווית 45°)" : "(recommended 1.5 for V-bit 0.8 45° engraving)"}</span>
              </div>
              {/* Output width option */}
              <div className="flex items-center gap-2 pt-1 flex-wrap">
                <label className="text-sm font-medium shrink-0">
                  {isRtl ? "רוחב פלט (מ'מ):" : "Output width (mm):"}
                </label>
                <input
                  type="number"
                  min="10"
                  max="2000"
                  step="10"
                  placeholder="100"
                  value={outputWidthMm}
                  onChange={e => setOutputWidthMm(e.target.value)}
                  className="w-24 border border-border rounded px-2 py-1 text-sm text-center"
                />
                <span className="text-xs text-muted-foreground">{isRtl ? "(סקל אוטומטי לפי הרוחב הנבחר)" : "(auto-scales to fit width)"}</span>
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
                {result.svgPreview && showSvgPreview && (
                  <div className="mb-3">
                    <SvgZoomViewer
                      svgContent={result.svgPreview}
                      label={isRtl ? "תצוגה מקדימה של הוקטור" : "Vector Preview"}
                      maxHeight={350}
                    />
                  </div>
                )}
                <div className="grid grid-cols-3 gap-2 mb-3">
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
                <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg border border-green-100 mb-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                  <p className="text-sm font-medium text-green-700">{t("conversionSuccess")}</p>
                </div>
                <div className="mb-2">
                  <ExportButtons
                    svgContent={result.svgPreview}
                    dxfUrl={result.dxfUrl}
                    dxfFilename={`${imageFile?.name.replace(/\.[^.]+$/, "") ?? "output"}.dxf`}
                    svgWidthPx={result.realWidth ?? result.width}
                    svgHeightPx={result.realHeight ?? result.height}
                    showVector={showSvgPreview}
                    onToggleVector={() => setShowSvgPreview((v) => !v)}
                    onMoreOptions={() => setDownloadOpen(true)}
                    isRtl={isRtl}
                  />
                </div>
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

// ─── Clear cached resul// ─── Clear cached results on fresh page load (new browser session) ──────────
// sessionStorage is cleared when the browser tab/window is closed.
// On a fresh load (no sessionStorage flag), clear all old results from localStorage
// UNLESS there is an active background job that should survive.
if (!sessionStorage.getItem("page_session_active")) {
  sessionStorage.setItem("page_session_active", "1");
  const hasActiveJob =
    !!localStorage.getItem("ai_generate_jobId") ||
    !!localStorage.getItem("ai_trace_jobId") ||
    !!localStorage.getItem("doc_redraw_jobId") ||
    !!localStorage.getItem("face_detect_jobId");
  if (!hasActiveJob) {
    // Fresh load with no pending jobs — clear all results so user sees clean state
    localStorage.removeItem("ai_generate_result");
    localStorage.removeItem("ai_generate_prompt");
    localStorage.removeItem("ai_trace_result");
    localStorage.removeItem("ai_trace_imagePreview");
    localStorage.removeItem("doc_redraw_result");
    localStorage.removeItem("doc_redraw_imagePreview");
    localStorage.removeItem("face_detect_result");
    localStorage.removeItem("face_detect_imagePreview");
    localStorage.removeItem("active_tab");
  }
}

// ─── AI Generator Tab ────────────────────────────────────────────────────────
function AiGeneratorTab({ onOpenAuth }: { onOpenAuth?: () => void }) {
  const { t, isRtl, language } = useLanguage();
  const { refetch: refetchTokens } = trpc.tokens.balance.useQuery(undefined, { enabled: false });
  const [prompt, setPrompt] = useState(() => localStorage.getItem("ai_generate_prompt") ?? "");

  const setPromptPersisted = useCallback((v: string) => {
    localStorage.setItem("ai_generate_prompt", v);
    setPrompt(v);
  }, []);
  const [modifications, setModifications] = useState("");
  const [status, setStatus] = useState<Status>(() => {
    if (localStorage.getItem("ai_generate_jobId")) return "idle";
    if (localStorage.getItem("ai_generate_result")) return "success";
    return "idle";
  });
  const [images, setImages] = useState<AiImage[]>(() => {
    if (!localStorage.getItem("ai_generate_jobId")) {
      try {
        const cached = localStorage.getItem("ai_generate_result");
        if (cached) return JSON.parse(cached) as AiImage[];
      } catch (_) { /* ignore */ }
    }
    return [];
  });
  const [selectedIdx, setSelectedIdx] = useState<number | null>(() => {
    if (!localStorage.getItem("ai_generate_jobId") && localStorage.getItem("ai_generate_result")) return 0;
    return null;
  });
  const [showModify, setShowModify] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [downloadImg, setDownloadImg] = useState<AiImage | null>(null);
  const [zoomImg, setZoomImg] = useState<{ src: string; alt: string } | null>(null);
  const [showVector, setShowVector] = useState(false);
  const [landscapeMode, setLandscapeMode] = useState(false);
  const [genMinGapMm, setGenMinGapMm] = useState<string>("1.5"); // default 1.5mm min gap (recommended for CNC V-bit)
  const [jobId, setJobId] = useState<string | null>(() => localStorage.getItem("ai_generate_jobId"));
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [progressStep, setProgressStep] = useState(0);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Progress steps for AI Creation loading
  const progressSteps = isRtl
    ? [
        { label: "מנתח את התיאור שלך...", duration: 8000 },
        { label: "מייצר 3 עיצובים...", duration: 25000 },
        { label: "מעבד קווים לחריטה...", duration: 20000 },
        { label: "מסיים ומייעל...", duration: 15000 },
      ]
    : [
        { label: "Analyzing your description...", duration: 8000 },
        { label: "Generating 3 designs...", duration: 25000 },
        { label: "Processing lines for engraving...", duration: 20000 },
        { label: "Finalizing and optimizing...", duration: 15000 },
      ];

  const startProgressSteps = useCallback(() => {
    setProgressStep(0);
    let step = 0;
    const advance = () => {
      step++;
      if (step < progressSteps.length) {
        setProgressStep(step);
        progressTimerRef.current = setTimeout(advance, progressSteps[step].duration);
      }
    };
    progressTimerRef.current = setTimeout(advance, progressSteps[0].duration);
  }, [isRtl]);

  const stopProgressSteps = useCallback(() => {
    if (progressTimerRef.current) clearTimeout(progressTimerRef.current);
    setProgressStep(0);
  }, []);

  const setJobIdPersisted = useCallback((id: string | null) => {
    if (id) localStorage.setItem("ai_generate_jobId", id);
    else localStorage.removeItem("ai_generate_jobId");
    setJobId(id);
  }, []);

  // Show the prompt text when returning to tab mid-processing (prompt is already persisted via setPromptPersisted)

  // Poll job status every 3 seconds
  const startPolling = useCallback((id: string) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/generate-images/job/${id}`, { credentials: "include" });
        const data = await res.json();
        if (data.status === "done") {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          stopProgressSteps();
          const result = data.result as { success: boolean; images: AiImage[] };
          setImages(result.images);
          // Cache result so it survives page reload
          try { localStorage.setItem("ai_generate_result", JSON.stringify(result.images)); } catch (_) { /* quota */ }
          setSelectedIdx(0);
          setStatus("success");
          setShowModify(false);
          setModifications("");
          setJobIdPersisted(null);
          refetchTokens();
          const successMsg = t("aiSuccess");
          toast.success(successMsg);
          // Push notification when page is hidden
          if (document.hidden && "Notification" in window && Notification.permission === "granted") {
            new Notification(isRtl ? "✅ AI יצירה הושלמה!" : "✅ AI Creation Complete!", {
              body: successMsg,
              icon: "/favicon.ico",
            });
          }
        } else if (data.status === "error") {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          stopProgressSteps();
          const msg = data.message || t("aiError");
          setErrorMsg(msg);
          setStatus("error");
          setJobIdPersisted(null);
          toast.error(msg);
        } else if (data.status === "cancelled") {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          stopProgressSteps();
          setStatus("idle");
          setJobIdPersisted(null);
        }
      } catch (_) { /* network error, keep trying */ }
    }, 3000);
  }, [t, refetchTokens, setJobIdPersisted, stopProgressSteps]);

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
    startProgressSteps();
    try {
      const res = await fetch("/api/generate-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          prompt: prompt.trim(),
          modifications: isModify ? modifications.trim() : undefined,
          landscapeMode,
          minGapMm: parseFloat(genMinGapMm) || 1.5,
        }),
      });
      const data = await res.json();
      if (data.error === "REGISTRATION_REQUIRED" || data.error === "UNAUTHORIZED") {
        setStatus("idle");
        stopProgressSteps();
        if (onOpenAuth) onOpenAuth();
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
        // Request push notification permission so we can notify when done
        if ("Notification" in window && Notification.permission === "default") {
          Notification.requestPermission();
        }
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
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
      {/* LEFT COLUMN: Prompt Input + Controls */}
      <div className="flex flex-col gap-4">
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
            onChange={(e) => setPromptPersisted(e.target.value)}
            className="resize-none text-base min-h-[90px] text-gray-800 bg-gray-50 border-gray-200"
            style={{ textAlign: isRtl ? "right" : "left" }}
            dir={isRtl ? "rtl" : "ltr"}
            disabled={status === "loading"}
          />
          {/* Landscape mode toggle */}
          <div className="mt-3 mb-1">
            <div
              className="flex rounded-xl overflow-hidden p-1 gap-1"
              style={{background: '#f1f5f9', border: '1px solid #e2e8f0'}}
            >
              <button
                type="button"
                onClick={() => setLandscapeMode(false)}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold rounded-lg transition-all"
                style={!landscapeMode ? {
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  color: 'white',
                  boxShadow: '0 2px 8px rgba(99,102,241,0.35)',
                } : {color: '#6b7280', background: 'transparent'}}
              >
                <span className="text-base">📷</span>
                <span>{isRtl ? "אובייקט" : "Object"}</span>
              </button>
              <button
                type="button"
                onClick={() => setLandscapeMode(true)}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold rounded-lg transition-all"
                style={landscapeMode ? {
                  background: 'linear-gradient(135deg, #059669, #10b981)',
                  color: 'white',
                  boxShadow: '0 2px 8px rgba(5,150,105,0.35)',
                } : {color: '#6b7280', background: 'transparent'}}
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
          {/* Min gap between lines — CNC V-bit setting */}
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <label className="text-xs font-medium text-gray-600 shrink-0">
              {isRtl ? "מרווח בין קווים (מ\"מ):" : "Line gap (mm):"}
            </label>
            <input
              type="number"
              min="0.2"
              max="3"
              step="0.1"
              value={genMinGapMm}
              onChange={e => setGenMinGapMm(e.target.value)}
              className="w-20 border border-gray-200 rounded-lg px-2 py-1 text-sm text-center bg-gray-50"
              disabled={status === "loading"}
            />
            <span className="text-xs text-gray-400">{isRtl ? "(ברירת מחדל 1.5 — מומלץ לקרסום V-bit)" : "(default 1.5 — recommended for V-bit)"}</span>
          </div>
          <p className="text-xs mt-2 text-gray-400">{t("aiTabSubtitle")}</p>
          <button
            className="w-full mt-3 h-13 font-bold text-base rounded-xl flex items-center justify-center gap-2 transition-all hover:opacity-90"
            style={{
              background: status === "loading" || !prompt.trim() ? 'linear-gradient(135deg, #c4b5fd, #a5b4fc)' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              color: 'white',
              border: 'none',
              boxShadow: status === "loading" || !prompt.trim() ? 'none' : '0 4px 14px rgba(99,102,241,0.4)',
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

      </div>{/* end left column */}

      {/* RIGHT COLUMN: Result image / loading / gallery */}
      <div className="flex flex-col gap-4">
      {/* Loading */}
      {status === "loading" && (
        <div
          className="rounded-xl p-6"
          style={{ background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}
        >
          <div className="flex flex-col items-center gap-5 text-center">
            {/* Spinner */}
            <div className="relative">
              <div className="w-16 h-16 rounded-full" style={{border: '3px solid #e0e7ff', borderTopColor: '#4f46e5', animation: 'spin 1s linear infinite'}} />
              <Sparkles className="w-6 h-6 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-indigo-500" />
            </div>

            {/* Current step label */}
            <div>
              <p className="font-semibold text-base text-gray-700">
                {progressSteps[progressStep]?.label || (isRtl ? "מעבד..." : "Processing...")}
              </p>
              <p className="text-xs mt-1 text-gray-400">
                {isRtl ? "זה עשוי לקחת 30-90 שניות" : "This may take 30-90 seconds"}
              </p>
            </div>

            {/* Progress steps timeline */}
            <div className="w-full flex flex-col gap-2 text-sm">
              {progressSteps.map((step, i) => (
                <div key={i} className="flex items-center gap-3" style={{direction: isRtl ? 'rtl' : 'ltr'}}>
                  <div
                    className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-500"
                    style={{
                      background: i < progressStep ? '#4f46e5' : i === progressStep ? '#818cf8' : '#e0e7ff',
                      color: i <= progressStep ? 'white' : '#a5b4fc',
                      boxShadow: i === progressStep ? '0 0 0 3px rgba(99,102,241,0.2)' : 'none',
                    }}
                  >
                    {i < progressStep ? '✓' : i + 1}
                  </div>
                  <span
                    className="transition-all duration-500"
                    style={{
                      color: i < progressStep ? '#6b7280' : i === progressStep ? '#1f2937' : '#9ca3af',
                      fontWeight: i === progressStep ? 600 : 400,
                    }}
                  >
                    {step.label}
                  </span>
                  {i === progressStep && (
                    <div className="flex gap-0.5 ml-auto">
                      {[0,1,2].map(j => (
                        <div key={j} className="w-1.5 h-1.5 rounded-full bg-indigo-400" style={{animation: `bounce 1s infinite ${j*0.15}s`}} />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Background hint + cancel */}
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
                {selected.svgPreview && showVector && (
                  <div className="mb-3">
                    <SvgZoomViewer
                      svgContent={selected.svgPreview}
                      label={isRtl ? "תצוגת קווי וקטור (DXF)" : "Vector Lines Preview (DXF)"}
                      maxHeight={380}
                    />
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
                <div className="mb-2">
                  <ExportButtons
                    svgContent={selected.svgPreview}
                    dxfUrl={selected.dxfUrl}
                    dxfFilename={selected.dxfFilename || 'ai_design.dxf'}
                    svgWidthPx={selected.realWidth ?? selected.width}
                    svgHeightPx={selected.realHeight ?? selected.height}
                    showVector={showVector}
                    onToggleVector={() => setShowVector((v) => !v)}
                    onMoreOptions={() => handleDownload(selected)}
                    isRtl={isRtl}
                  />
                </div>
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

      {/* Empty state placeholder for right column when idle */}
      {status === "idle" && images.length === 0 && (
        <div
          className="rounded-xl flex flex-col items-center justify-center gap-4 text-center"
          style={{
            background: 'linear-gradient(135deg, #f8f9ff 0%, #eef2ff 100%)',
            border: '2px dashed #c7d2fe',
            minHeight: 320,
            padding: '2rem',
          }}
        >
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{background: 'linear-gradient(135deg, #6366f1, #8b5cf6)'}}>
            <Wand2 className="w-8 h-8 text-white" />
          </div>
          <div>
            <p className="font-bold text-gray-700 text-base mb-1">
              {isRtl ? 'תיאור → עיצוב DXF' : 'Description → DXF Design'}
            </p>
            <p className="text-sm text-gray-400">
              {isRtl ? 'תאר עיצוב בצד שמאל וה-AI יצייר אותו כאן' : 'Describe a design on the left and AI will draw it here'}
            </p>
          </div>
          {/* Tips */}
          <div className="w-full text-start rounded-xl p-4" style={{background: '#ffffff', border: '1px solid #e0e7ff'}}>
            <h3 className="font-semibold text-xs mb-2 text-indigo-700">{t("tipsTitle")}</h3>
            <ul className="space-y-1.5 text-xs text-gray-600">
              <li className="flex gap-2"><span className="shrink-0 text-indigo-400">•</span><span>{t("tip1")}</span></li>
              <li className="flex gap-2"><span className="shrink-0 text-indigo-400">•</span><span>{t("tip2")}</span></li>
              <li className="flex gap-2"><span className="shrink-0 text-indigo-400">•</span><span>{t("tip3")}</span></li>
              <li className="flex gap-2"><span className="shrink-0">💡</span><span>{t("tip4")}</span></li>
            </ul>
          </div>
        </div>
      )}
      </div>{/* end right column */}
    </div>
    </>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function Home() {
  const { t, isRtl, language } = useLanguage();
  const [appUser, setAppUser] = useState<{ id: number; email: string; name: string | null } | null>(null);

  // Track active background jobs across all AI tabs
  const [activeJobs, setActiveJobs] = useState<{ generate: boolean; trace: boolean; doc: boolean; face: boolean }>(() => ({
    generate: !!localStorage.getItem("ai_generate_jobId"),
    trace: !!localStorage.getItem("ai_trace_jobId"),
    doc: !!localStorage.getItem("doc_redraw_jobId"),
    face: !!localStorage.getItem("face_detect_jobId"),
  }));

  // Remember active tab — auto-switch to tab with active job on page return
  const [activeTab, setActiveTab] = useState<string>(() => {
    // If there's an active job, go to that tab automatically
    if (localStorage.getItem("ai_trace_jobId")) return "trace";
    if (localStorage.getItem("doc_redraw_jobId")) return "redraw";
    if (localStorage.getItem("ai_generate_jobId")) return "ai";
    if (localStorage.getItem("face_detect_jobId")) return "face";
    // Otherwise restore last visited tab
    return localStorage.getItem("active_tab") ?? "ai";
  });

  // Poll localStorage every 2s to detect job changes (even from child components)
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveJobs({
        generate: !!localStorage.getItem("ai_generate_jobId"),
        trace: !!localStorage.getItem("ai_trace_jobId"),
        doc: !!localStorage.getItem("doc_redraw_jobId"),
        face: !!localStorage.getItem("face_detect_jobId"),
      });
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // Auto-refresh on page re-entry when no active jobs
  useEffect(() => {
    const handleVisibility = () => {
      if (!document.hidden) {
        const hasActiveJob =
          !!localStorage.getItem("ai_generate_jobId") ||
          !!localStorage.getItem("ai_trace_jobId") ||
          !!localStorage.getItem("doc_redraw_jobId") ||
          !!localStorage.getItem("face_detect_jobId");
        if (!hasActiveJob) {
          localStorage.removeItem("active_tab");
          window.location.reload();
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  const [authOpen, setAuthOpen] = useState(false);
  const [limitReached, setLimitReached] = useState(false);
  const [authReason, setAuthReason] = useState<AuthReason>("generic");

  const openAuthAs = (reason: AuthReason) => {
    setAuthReason(reason);
    setLimitReached(reason === "limit");
    setAuthOpen(true);
  };
  const { data: tokenData, refetch: refetchTokens } = trpc.tokens.balance.useQuery(undefined, { enabled: !!appUser, refetchInterval: 30000 });
  const tokenBalance = tokenData?.balance ?? 0;

  useEffect(() => {
    fetch("/api/app-auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (d.user) {
          localStorage.setItem("app_user_logged_in", "1");
          setAppUser(d.user);
        } else {
          // Not logged in — clear flag and cached results
          localStorage.removeItem("app_user_logged_in");
          localStorage.removeItem("ai_generate_result");
          localStorage.removeItem("ai_generate_prompt");
          localStorage.removeItem("ai_generate_jobId");
          localStorage.removeItem("ai_trace_jobId");
          localStorage.removeItem("doc_redraw_jobId");
          localStorage.removeItem("active_tab");
        }
      })
      .catch(() => {});
  }, []);

  const handleLogout = async () => {
    await fetch("/api/app-auth/logout", { method: "POST" });
    localStorage.removeItem("app_user_logged_in");
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
          borderBottom: '1px solid #e8eaf0',
          boxShadow: '0 1px 8px rgba(0,0,0,0.06)',
        }}
      >
        <div className="container py-2.5 flex items-center gap-3">
          {/* AiDXF Logo */}
          <div className="flex items-center gap-2 shrink-0">
            <div
              className="w-8 h-8 rounded-xl shrink-0 flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', boxShadow: '0 2px 8px rgba(99,102,241,0.3)' }}
            >
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                <path d="M4 16 Q7 7 10 10 Q13 13 16 4" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none"/>
                <circle cx="4" cy="16" r="1.8" fill="#06b6d4"/>
                <circle cx="10" cy="10" r="1.8" fill="white"/>
                <circle cx="16" cy="4" r="1.8" fill="#06b6d4"/>
              </svg>
            </div>
            <span className="text-lg font-black tracking-tight" style={{ color: '#6366f1', fontFamily: 'Inter, sans-serif', letterSpacing: '-0.02em' }}>Ai</span><span className="text-lg font-black tracking-tight" style={{ color: '#111827', fontFamily: 'Inter, sans-serif', letterSpacing: '-0.02em' }}>DXF</span>
          </div>
          <div className="flex-1 min-w-0" />
          {/* Auth in header */}
          {appUser ? (
            <div className="flex items-center gap-1.5">
              <div
                className="flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full shrink-0"
                style={{ background: '#eef2ff', border: '1px solid #c7d2fe', color: '#4338ca' }}
              >
                <Sparkles className="w-3 h-3" />
                <span>{tokenBalance}</span>
              </div>
              <button
                onClick={() => window.location.href = "/tokens"}
                className="text-xs px-2 py-1 rounded-full font-medium transition-colors text-indigo-600 hover:bg-indigo-50 hidden sm:block shrink-0"
              >
                {isRtl ? "אסימונים" : "Tokens"}
              </button>
              <button
                onClick={() => window.location.href = "/history"}
                className="text-xs px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 font-semibold shrink-0 hover:opacity-90 active:scale-95"
                style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white', boxShadow: '0 2px 8px rgba(99,102,241,0.3)' }}
              >
                <History className="w-3.5 h-3.5" />
                <span>{isRtl ? 'היסטוריה' : 'History'}</span>
              </button>
              <button
                onClick={() => window.location.href = '/account'}
                className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl font-bold shrink-0 transition-all hover:opacity-90 active:scale-95"
                style={{ background: 'linear-gradient(135deg, #7c3aed, #6366f1)', color: 'white', boxShadow: '0 2px 8px rgba(99,102,241,0.35)' }}
              >
                <UserCircle className="w-3.5 h-3.5" />
                <span>{isRtl ? 'האזור האישי' : 'My Account'}</span>
              </button>
              <button
                onClick={handleLogout}
                className="text-xs p-1.5 rounded-full transition-colors flex items-center gap-1 text-gray-400 hover:text-red-500 shrink-0"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => { setLimitReached(false); setAuthOpen(true); }}
              className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl font-semibold transition-all hover:opacity-90 shrink-0"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white', border: 'none', boxShadow: '0 3px 10px rgba(99,102,241,0.35)' }}
            >
              <LogIn className="w-3.5 h-3.5" />
              {t("loginRegister")}
            </button>
          )}
          <LanguageSwitcher />
        </div>
      </header>

      <AuthDialog
        open={authOpen}
        onOpenChange={setAuthOpen}
        limitReached={limitReached}
        authReason={authReason}
        onSuccess={(user) => {
          localStorage.setItem("app_user_logged_in", "1");
          setAppUser(user);
          setLimitReached(false);
          setAuthReason("generic");
        }}
      />

      <main className="py-5" style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px 24px' }}>
        {/* Responsive layout */}
        <div className="mx-auto" style={{ maxWidth: '100%' }}>

        {/* ── Announcement Banner ── */}
        <AnnouncementBanner />

        {/* ── Hero Section ── */}
        <div className="mb-6 rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(135deg, #f0f0ff 0%, #faf5ff 50%, #f0f9ff 100%)', border: '1px solid #e8eaf0' }}>
          <div className="px-5 pt-5 pb-4">
            {/* Desktop: side by side. Mobile: stacked */}
            <div className={`flex flex-col gap-4 items-center ${isRtl ? 'lg:flex-row-reverse' : 'lg:flex-row'}`}>
              {/* Mobile: carousel first (order-first on mobile, order-last on desktop) */}
              <div className="flex-1 w-full lg:max-w-[480px]" style={{ order: 1 }}>
                <HeroBeforeAfterCarousel />
              </div>

              {/* Left (LTR) / Right (RTL): text + feature buttons */}
              <div className="flex-1 w-full" style={{ order: 2 }}>
            {/* Badge pill */}
            <div className={`flex justify-center ${isRtl ? 'lg:justify-end' : 'lg:justify-start'} mb-3`}>
              <span
                className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full"
                style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white', letterSpacing: '0.04em' }}
              >
                <Sparkles className="w-3 h-3" />
                {isRtl ? 'המרת וקטור מבוססת AI' : 'AI-POWERED VECTOR CONVERSION'}
              </span>
            </div>

            {/* Headline */}
            <div className="text-center lg:text-start mb-4">
              <h1 className="font-black leading-tight mb-1" style={{ fontSize: 'clamp(1.8rem, 4vw, 3rem)', color: '#111827', letterSpacing: '-0.02em' }}>
                {isRtl ? 'הפוך כל תמונה לוקטור.' : 'From photo to vector.'}
              </h1>
              <h1 className="font-black leading-tight" style={{ fontSize: 'clamp(1.8rem, 4vw, 3rem)', background: 'linear-gradient(135deg, #6366f1, #06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '-0.02em' }}>
                {isRtl ? 'מיידית.' : 'Instantly.'}
              </h1>
              <p className="text-sm text-gray-500 mt-2 max-w-sm">
                {isRtl ? 'בינה מלאכותית ממירה תמונות לקבצי DXF לחיתוך לייזר ו-CNC' : 'AI converts images to DXF files for laser cutting & CNC'}
              </p>
            </div>

            {/* Feature shortcut buttons — click to switch tab */}
            <div className="grid grid-cols-2 gap-2">
              {[
                { tab: 'ai', label: isRtl ? 'AI יצירה' : 'AI Create', color: '#6366f1', bg: 'linear-gradient(135deg, #6366f1, #8b5cf6)', img: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663365044246/hnDFdLkzVGYJYdws9hbnLw/demo-v3-sneaker_9fe887cf.png' },
                { tab: 'trace', label: isRtl ? 'AI Outline' : 'AI Outline', color: '#0d9488', bg: 'linear-gradient(135deg, #0d9488, #06b6d4)', img: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663365044246/hnDFdLkzVGYJYdws9hbnLw/demo-v3-bicycle_c5150be7.png' },
                { tab: 'sketch', label: isRtl ? 'AI סקיצה' : 'AI Sketch', color: '#d97706', bg: 'linear-gradient(135deg, #d97706, #f59e0b)', img: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663365044246/hnDFdLkzVGYJYdws9hbnLw/demo-v4-helmet_44398853.png' },
                { tab: 'face', label: isRtl ? 'פורטרט' : 'Portrait', color: '#7c3aed', bg: 'linear-gradient(135deg, #7c3aed, #a855f7)', img: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663365044246/hnDFdLkzVGYJYdws9hbnLw/demo-portrait-woman_e956deb2.png' },
              ].map((f, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setActiveTab(f.tab);
                    localStorage.setItem('active_tab', f.tab);
                    document.getElementById('main-tabs')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                  className="flex flex-col items-center gap-0 rounded-2xl overflow-hidden transition-all hover:scale-105 active:scale-95 relative"
                  style={{ border: 'none', padding: 0, background: 'white', boxShadow: '0 4px 16px rgba(0,0,0,0.10)' }}
                >
                  {/* Image area: white bg, object-contain so nothing is cropped */}
                  <div className="w-full relative" style={{ background: '#f8f9ff', paddingBottom: '62%' }}>
                    <img
                      src={f.img}
                      alt={f.label}
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'center', padding: '6px' }}
                    />
                  </div>
                  {/* Label bar */}
                  <span
                    className="w-full text-xs font-bold text-center py-2"
                    style={{ background: f.bg, color: 'white', letterSpacing: '0.02em' }}
                  >{f.label}</span>
                </button>
              ))}
            </div>
              </div>{/* end left column */}
            </div>{/* end flex row */}
          </div>
        </div>

        {/* Tabs */}
        <div id="main-tabs" />
        <Tabs
          value={activeTab}
          onValueChange={(v) => {
            setActiveTab(v);
            localStorage.setItem("active_tab", v);
          }}
          dir={isRtl ? "rtl" : "ltr"}
        >
          <TabsList
            className="w-full mb-6 gap-1 p-1.5"
            style={{
              background: '#ffffff',
              border: '1px solid #e8eaf0',
              borderRadius: '1rem',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              height: 'auto',
            }}
          >
            <TabsTrigger
              value="ai"
              className="flex-1 flex-col gap-0.5 py-2.5 text-xs font-semibold transition-all rounded-xl text-gray-400 data-[state=active]:text-white data-[state=active]:shadow-md relative px-1"
              style={{
                background: activeTab === 'ai' ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'transparent',
              }}
            >
              <Sparkles className="w-4 h-4 shrink-0" />
              <span className="truncate text-[11px]">{isRtl ? "AI יצירה" : "AI Create"}</span>
              {activeJobs.generate && (
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500" />
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="trace"
              className="flex-1 flex-col gap-0.5 py-2.5 text-xs font-semibold transition-all rounded-xl text-gray-400 data-[state=active]:text-white data-[state=active]:shadow-md relative px-1"
              style={{
                background: activeTab === 'trace' ? 'linear-gradient(135deg, #0d9488, #06b6d4)' : 'transparent',
              }}
            >
              <Scan className="w-4 h-4 shrink-0" />
              <span className="truncate text-[11px]">AI Outline</span>
              {activeJobs.trace && (
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500" />
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="redraw"
              disabled
              className="flex-1 flex-col gap-0.5 py-2.5 text-xs font-semibold transition-all rounded-xl text-gray-300 opacity-50 cursor-not-allowed relative px-1"
            >
              <FileEdit className="w-4 h-4 shrink-0" />
              <span className="truncate text-[11px]">{isRtl ? "AI סקיצה" : "AI Sketch"}</span>
              <span className="absolute -top-1.5 -right-1 text-[9px] font-bold bg-orange-400 text-white px-1 rounded-full leading-4">
                {isRtl ? "תחזוק" : "maint"}
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="face"
              className="flex-1 flex-col gap-0.5 py-2.5 text-xs font-semibold transition-all rounded-xl text-gray-400 data-[state=active]:text-white data-[state=active]:shadow-md relative px-1"
              style={{
                background: activeTab === 'face' ? 'linear-gradient(135deg, #7c3aed, #a855f7)' : 'transparent',
              }}
            >
              <UserCircle className="w-4 h-4 shrink-0" />
              <span className="truncate text-[11px]">{isRtl ? "פורטרט" : "Portrait"}</span>
              {activeJobs.face && (
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500" />
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ai">
            {/* Demo gallery — AI Create */}
            <div
              className="mb-5 rounded-2xl overflow-hidden p-4"
              style={{ background: '#ffffff', border: '1px solid #e8eaf0', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{background: 'linear-gradient(135deg, #6366f1, #8b5cf6)'}}>
                  <Sparkles className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="text-sm font-bold text-gray-800">
                  {isRtl ? "דוגמאות — תאר עיצוב בטקסט, ה-AI יצייר קווים לחריטה" : "Examples — describe a design in text, AI draws engraving lines"}
                </span>
              </div>
              <DemoSlider
                accentColor="#6366f1"
                images={[
                  { src: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663365044246/hnDFdLkzVGYJYdws9hbnLw/demo-gen-typewriter_a3336bbc.png', alt: 'AI Generate - Typewriter' },
                  { src: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663365044246/hnDFdLkzVGYJYdws9hbnLw/demo-gen-motorcycle_9b48b7de.png', alt: 'AI Generate - Motorcycle' },
                  { src: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663365044246/hnDFdLkzVGYJYdws9hbnLw/demo-gen-sunglasses_e7cbfe74.png', alt: 'AI Generate - Sunglasses' },
                ]}
              />
            </div>
            <AiGeneratorTab onOpenAuth={() => openAuthAs("unregistered")} />
          </TabsContent>

          <TabsContent value="trace">
            {/* Demo banner — AI Trace */}
            <div
              className="mb-5 rounded-2xl overflow-hidden p-4"
              style={{ background: '#ffffff', border: '1px solid #e8eaf0', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{background: 'linear-gradient(135deg, #0d9488, #06b6d4)'}}>
                  <Scan className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="text-sm font-bold text-gray-800">
                  {isRtl ? "דוגמאות — העלה תמונה, ה-AI יהפוך אותה לקווים נקיים" : "Examples — upload a photo, AI converts it to clean vector lines"}
                </span>
              </div>
              <DemoSlider
                accentColor="#0d9488"
                images={[
                  { src: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663365044246/hnDFdLkzVGYJYdws9hbnLw/demo-v3-bicycle_c5150be7.png', alt: 'AI Outline - Bicycle' },
                  { src: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663365044246/hnDFdLkzVGYJYdws9hbnLw/demo-v3-sneaker_9fe887cf.png', alt: 'AI Outline - Sneaker' },
                  { src: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663365044246/hnDFdLkzVGYJYdws9hbnLw/demo-v3-tools_9ff33dc7.png', alt: 'AI Outline - Tools' },
                ]}
              />
            </div>
            <AiTraceTab onOpenAuth={() => openAuthAs("unregistered")} />
          </TabsContent>

          <TabsContent value="redraw">
            {/* Maintenance notice */}
            <div className="mb-4 rounded-xl p-4 flex items-start gap-3" style={{ background: '#fff7ed', border: '1.5px solid #fed7aa' }}>
              <span className="text-2xl mt-0.5">🛠️</span>
              <div>
                <p className="font-bold text-orange-700 text-sm mb-1">
                  {isRtl ? "מצב תחזוקה זמני" : "Temporary Maintenance"}
                </p>
                <p className="text-orange-600 text-xs leading-relaxed">
                  {isRtl
                    ? "הפיצרות AI סקיצה זמנית אינה זמינה. אנו עובדים על שיפורים ונחזור בקרוב. בינתיים ניתן להשתמש ב-AI Outline ו-AI יצירה."
                    : "AI Sketch is temporarily unavailable. We are working on improvements and will be back soon. In the meantime, use AI Outline or AI Create."}
                </p>
              </div>
            </div>
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
            <AiDocumentRedrawTab onOpenAuth={() => openAuthAs("unregistered")} />
          </TabsContent>

          <TabsContent value="face">
            {/* Demo banner — Face Detection */}
            <div
              className="mb-5 rounded-2xl overflow-hidden p-4"
              style={{ background: '#ffffff', border: '1px solid #e8eaf0', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{background: 'linear-gradient(135deg, #7c3aed, #a855f7)'}}>
                  <UserCircle className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="text-sm font-bold text-gray-800">
                  {isRtl ? "פורטרט — העלה תמונה עם פנים, ה-AI יצייר 3 פורטרטים בסגנונות שונים" : "Portrait — upload a photo with faces, AI draws 3 portrait variations"}
                </span>
              </div>
              <DemoSlider
                accentColor="#7c3aed"
                images={[
                  { src: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663365044246/hnDFdLkzVGYJYdws9hbnLw/demo-portrait-woman_e956deb2.png', alt: 'Portrait - Woman' },
                  { src: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663365044246/hnDFdLkzVGYJYdws9hbnLw/demo-portrait-man_1c4399d3.png', alt: 'Portrait - Man' },
                  { src: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663365044246/hnDFdLkzVGYJYdws9hbnLw/demo-portrait-child_d468e82c.png', alt: 'Portrait - Child' },
                ]}
              />
            </div>
            <FaceDetectTab onOpenAuth={() => openAuthAs("unregistered")} />
          </TabsContent>
        </Tabs>
        </div>{/* end centering wrapper */}
      </main>

      {/* ── Dark CTA Section ── */}
      <section
        className="mt-10 py-10 px-5 text-center"
        style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #1e1b4b 100%)' }}
      >
        <div className="mx-auto" style={{ maxWidth: '560px' }}>
          <div
            className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full mb-4"
            style={{ background: 'rgba(255,255,255,0.12)', color: '#a5b4fc', border: '1px solid rgba(165,180,252,0.3)' }}
          >
            <Sparkles className="w-3 h-3" />
            {isRtl ? 'AI חינמי להתחלה' : 'Free AI to start'}
          </div>
          <h2 className="font-black text-white mb-2" style={{ fontSize: 'clamp(1.3rem, 4vw, 1.9rem)', letterSpacing: '-0.02em' }}>
            {isRtl ? 'התחל להמיר בחינם היום.' : 'Start converting for free today.'}
          </h2>
          <p className="text-sm mb-6" style={{ color: '#a5b4fc' }}>
            {isRtl ? 'לייזר, CNC ועיצוב וקטורי באיכות מקצועית בעזרת AI' : 'Professional vector files for laser, CNC, and design — powered by AI'}
          </p>
          <button
            onClick={() => { window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            className="inline-flex items-center gap-2 font-bold px-7 py-3 rounded-xl transition-all hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white', boxShadow: '0 4px 16px rgba(99,102,241,0.4)', fontSize: '0.95rem' }}
          >
            <Sparkles className="w-4 h-4" />
            {isRtl ? 'התחל עכשיו' : 'Get started now'}
          </button>
          <div className="flex items-center justify-center gap-5 mt-5">
            {[
              { label: isRtl ? 'בינה מלאכותית' : 'AI Powered', icon: '✨' },
              { label: isRtl ? 'לייזר ו-CNC' : 'Laser & CNC', icon: '⚡' },
              { label: isRtl ? 'קבצי DXF' : 'DXF Files', icon: '📄' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-1.5 text-xs" style={{ color: '#c7d2fe' }}>
                <span>{item.icon}</span>
                <span className="font-medium">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer
        className=""
        style={{ borderTop: '1px solid #e8eaf0', background: '#ffffff' }}
      >
        <div className="container py-5">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-base font-black tracking-tight" style={{ color: '#6366f1' }}>Ai</span><span className="text-base font-black tracking-tight text-gray-800">DXF</span>
              <span className="text-xs text-gray-400 hidden sm:block">— {isRtl ? "ממיר תמונות לוקטור בעזרת AI" : "AI-Powered Vector Converter"}</span>
            </div>
            <div className="flex items-center gap-4 text-xs text-gray-400">
              <a href="/terms" className="hover:text-gray-600 transition-colors">
                {isRtl ? "תנאי שימוש" : "Terms"}
              </a>
              <a href="/privacy" className="hover:text-gray-600 transition-colors">
                {isRtl ? "פרטיות" : "Privacy"}
              </a>
              <span>© 2026 AiDXF</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

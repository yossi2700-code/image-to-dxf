/**
 * AiTraceTab.tsx — Redesigned to match AI Generate tab quality:
 *  User uploads photo → LLM analyzes → gpt-image-1 draws 3 clean B&W variations from scratch
 *  → potrace → DXF ready (same pipeline as generateRoute)
 *  No two-step process needed — results arrive in one shot.
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { DxfDownloadDialog } from "@/components/DxfDownloadDialog";
import { ExportButtons } from "@/components/ExportButtons";
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
  X,
  FileText,
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

  // Extract viewBox to compute aspect ratio for proper height
  const viewBoxMatch = svgContent.match(/viewBox=["']([^"']+)["']/);
  const svgAspect = (() => {
    if (viewBoxMatch) {
      const parts = viewBoxMatch[1].trim().split(/[\s,]+/);
      if (parts.length === 4) {
        const w = parseFloat(parts[2]);
        const h = parseFloat(parts[3]);
        if (w > 0 && h > 0) return h / w;
      }
    }
    return 1;
  })();

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
        <div ref={(el) => {
          if (el) {
            const w = el.getBoundingClientRect().width;
            el.style.height = Math.min(Math.max(w * svgAspect, 180), 500) + 'px';
          }
        }} className="relative overflow-hidden bg-white select-none" style={{ cursor: isPanning ? 'grabbing' : 'grab' }}
          onWheel={onWheel} onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
          onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px)) scale(${scale})`, transformOrigin: 'center center', width: '90%', height: '90%', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}
            dangerouslySetInnerHTML={{ __html: styledSvg }} />
        </div>
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
    <div
      className="rounded-xl p-4"
      style={{ background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}
    >
        <div className="flex items-center justify-between mb-3">
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200"
          >{label}</span>
          <span className="text-xs text-gray-400">{image.segmentCount.toLocaleString()} {isRtl ? "קווים" : "lines"}</span>
        </div>

        {/* AI Drawing preview */}
        <div
          className="rounded-lg overflow-hidden mb-3 relative group cursor-zoom-in bg-gray-50 border border-gray-100"
          onClick={() => onZoom(image.imageUrl, label)}
        >
          <img src={image.imageUrl} alt={`Variation ${index + 1}`} className="w-full block" style={{ aspectRatio: '1', objectFit: 'contain', background: '#f8fafc' }} />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
            <ZoomIn className="w-7 h-7 text-white opacity-0 group-hover:opacity-80 transition-opacity drop-shadow" />
          </div>
        </div>

        {/* Export buttons */}
        <div className="mb-3">
          <ExportButtons
            svgContent={image.svgPreview}
            dxfUrl={image.dxfUrl}
            dxfFilename={image.dxfFilename || `design-${index + 1}.dxf`}
            svgWidthPx={image.realWidth ?? 500}
            svgHeightPx={image.realHeight ?? 500}
            showVector={showVector}
            onToggleVector={() => setShowVector(!showVector)}
            onMoreOptions={() => onDownload(image)}
            isRtl={isRtl}
          />
        </div>

        {showVector && (
          <div className="mb-3">
            <SvgViewer svgContent={image.svgPreview} />
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 mb-3 text-center">
          {[{v: image.realWidth ? (image.realWidth / 3.7795).toFixed(0) + ' mm' : '—', l: isRtl ? 'רוחב' : 'Width'}, {v: image.realHeight ? (image.realHeight / 3.7795).toFixed(0) + ' mm' : '—', l: isRtl ? 'גובה' : 'Height'}].map(({v, l}, i) => (
            <div key={i} className="rounded-lg p-1.5 bg-gray-50 border border-gray-100">
              <p className="text-xs font-semibold text-indigo-600">{v}</p>
              <p className="text-xs text-gray-400">{l}</p>
            </div>
          ))}
        </div>
    </div>
  );
}

interface AiTraceTabProps { onOpenAuth: () => void; }

export function AiTraceTab({ onOpenAuth }: AiTraceTabProps) {
  const { t, isRtl, language } = useLanguage();
  const { refetch: refetchTokens } = trpc.tokens.balance.useQuery(undefined, { enabled: false });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(() => localStorage.getItem("ai_trace_imagePreview"));
  const [description, setDescription] = useState("");
  const [focusText, setFocusText] = useState("");
  const [customImprovement, setCustomImprovement] = useState("");
  const [status, setStatus] = useState<Status>(() => {
    if (localStorage.getItem("ai_trace_jobId")) return "idle";
    if (localStorage.getItem("ai_trace_result")) return "success";
    return "idle";
  });
  const [result, setResult] = useState<TraceResult | null>(() => {
    // Restore cached result if no active job
    if (!localStorage.getItem("ai_trace_jobId")) {
      try {
        const cached = localStorage.getItem("ai_trace_result");
        if (cached) return JSON.parse(cached) as TraceResult;
      } catch (_) { /* ignore */ }
    }
    return null;
  });
  const [errorMsg, setErrorMsg] = useState("");
  const [downloadTarget, setDownloadTarget] = useState<GeneratedImage | null>(null);
  const [zoomImg, setZoomImg] = useState<{ src: string; alt: string } | null>(null);
  const [selectedVariation, setSelectedVariation] = useState<1 | 2 | 3>(2);
  const [lineweightMm, setLineweightMm] = useState<string>(""); // empty = default
  const [dragOver, setDragOver] = useState(false);
  const [fullImageMode, setFullImageMode] = useState(false);
  const [jobId, setJobId] = useState<string | null>(() => localStorage.getItem("ai_trace_jobId"));
  const [tryAgainUrl, setTryAgainUrl] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<string>("");
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // previewRef holds the latest preview URL without causing re-renders when read inside handleTrace
  const previewRef = useRef<string | null>(localStorage.getItem("ai_trace_imagePreview"));

  const setJobIdPersisted = useCallback((id: string | null) => {
    if (id) localStorage.setItem("ai_trace_jobId", id);
    else { localStorage.removeItem("ai_trace_jobId"); localStorage.removeItem("ai_trace_imagePreview"); }
    setJobId(id);
  }, []);

  // Cache result in localStorage so it survives page reload
  const saveResultToCache = useCallback((r: TraceResult) => {
    try {
      localStorage.setItem("ai_trace_result", JSON.stringify(r));
    } catch (_) { /* quota exceeded — ignore */ }
  }, []);

  const clearResultCache = useCallback(() => {
    localStorage.removeItem("ai_trace_result");
  }, []);

  const setImagePreviewPersisted = useCallback((preview: string | null) => {
    if (preview) localStorage.setItem("ai_trace_imagePreview", preview);
    else localStorage.removeItem("ai_trace_imagePreview");
    previewRef.current = preview;  // keep ref in sync
    setImagePreview(preview);
  }, []);

  // Poll job status every 3 seconds
  const startPolling = useCallback((id: string) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/ai-trace/job/${id}`, { credentials: "include" });
        const data = await res.json();
        if (data.status === "done") {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          const traceResult = data.result as TraceResult;
          setResult(traceResult);
          saveResultToCache(traceResult);
          setStatus("success");
          setCurrentStep("");
          setJobIdPersisted(null);
          refetchTokens();
          const successMsg = isRtl ? `העיצוב מוכן! לחץ הורד DXF` : `Design ready! Click Download DXF`;
          toast.success(successMsg);
          // Push notification when page is hidden (user left the browser)
          if (document.hidden && "Notification" in window && Notification.permission === "granted") {
            new Notification(isRtl ? "✅ AI Outline הושלם!" : "✅ AI Outline Complete!", {
              body: successMsg,
              icon: "/favicon.ico",
            });
          }
        } else if (
          data.status === "processing" &&
          Array.isArray(data.partialImages) &&
          data.partialImages.length > 0
        ) {
          // Streaming: show images as they complete, keep polling for more
          const partial = data.partialImages as GeneratedImage[];
          setResult((prev) => {
            // Only update if we have more images than before
            if (prev && prev.images.length >= partial.length) return prev;
            return {
              images: partial,
              suggestions: prev?.suggestions ?? [],
              objectDescription: prev?.objectDescription ?? "",
            };
          });
          setStatus("success"); // Show result panel immediately with partial images
          const stepMsg = isRtl ? (data.step || data.stepEn) : (data.stepEn || data.step);
          if (stepMsg) setCurrentStep(stepMsg);
        } else if (data.status === "error") {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          const msg = data.message || (isRtl ? "שגיאה בעיבוד" : "Processing error");
          setErrorMsg(msg);
          setStatus("error");
          setCurrentStep("");
          setJobIdPersisted(null);
          toast.error(msg);
        } else if (data.status === "cancelled") {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          setStatus("idle");
          setCurrentStep("");
          setJobIdPersisted(null);
        } else if (data.step || data.stepEn) {
          // Update current step message
          const stepMsg = isRtl ? (data.step || data.stepEn) : (data.stepEn || data.step);
          if (stepMsg) setCurrentStep(stepMsg);
        }
      } catch (_) { /* network error, keep trying */ }
    }, 3000);
  }, [isRtl, refetchTokens, setJobIdPersisted]);

  // On mount: resume polling if a jobId was saved (survived tab switch)
  useEffect(() => {
    const savedId = localStorage.getItem("ai_trace_jobId");
    if (savedId) {
      setStatus("loading");
      startPolling(savedId);
    }
    // Handle "Try Again" from history — load source image URL and auto-submit
    const tryAgainRaw = sessionStorage.getItem("tryAgainItem");
    if (tryAgainRaw) {
      sessionStorage.removeItem("tryAgainItem");
      try {
        const tryAgainData = JSON.parse(tryAgainRaw) as { sourceImageUrl: string; description?: string | null };
        if (tryAgainData.sourceImageUrl) {
          // Set preview from the source URL
          setImagePreviewPersisted(tryAgainData.sourceImageUrl);
          if (tryAgainData.description) setDescription(tryAgainData.description);
          // Store the URL so handleTraceFromUrl can use it
          setTryAgainUrl(tryAgainData.sourceImageUrl);
        }
      } catch (_) { /* ignore */ }
    }
    return () => { if (pollIntervalRef.current) clearInterval(pollIntervalRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCancel = useCallback(async () => {
    if (!jobId) return;
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    try {
      const res = await fetch(`/api/ai-trace/cancel/${jobId}`, { method: "POST", credentials: "include" });
      const data = await res.json();
      if (data.cancelled) {
        toast.success(isRtl ? "העיבוד בוטל והאסימונים הוחזרו" : "Processing cancelled — tokens refunded");
        refetchTokens();
      }
    } catch (_) { /* ignore */ }
    setStatus("idle");
    setJobIdPersisted(null);
  }, [jobId, isRtl, refetchTokens, setJobIdPersisted]);

  const handleFile = useCallback((file: File) => {
    const allowed = ["image/png", "image/jpeg", "image/bmp", "image/webp", "image/gif"];
    if (!allowed.includes(file.type)) { toast.error(isRtl ? "פורמט לא נתמך." : "Unsupported format."); return; }
    if (file.size > 16 * 1024 * 1024) { toast.error(isRtl ? "הקובץ גדול מדי. מקסימום 16 MB." : "File too large. Max 16 MB."); return; }
    // Reset all state when a new file is chosen (handles "change image" flow)
    setImageFile(file);
    setResult(null);
    setStatus("idle");
    setErrorMsg("");
    setFocusText("");
    setCustomImprovement("");
    setCurrentStep("");
    setJobIdPersisted(null);
    setTryAgainUrl(null);
    // Reset file input so the same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = "";
    // Compress image before storing as preview (improves speed + Safari iOS reliability)
    const canvas = document.createElement("canvas");
    const img = new Image();
    img.onload = () => {
      const MAX = 1024;
      let w = img.width, h = img.height;
      if (w > MAX || h > MAX) {
        if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
        else { w = Math.round(w * MAX / h); h = MAX; }
      }
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, w, h);
      const compressed = canvas.toDataURL("image/jpeg", 0.85);
      setImagePreviewPersisted(compressed);
    };
    img.onerror = () => {
      // Fallback to FileReader if canvas fails
      const reader = new FileReader();
      reader.onload = (e) => setImagePreviewPersisted(e.target?.result as string);
      reader.readAsDataURL(file);
    };
    const objectUrl = URL.createObjectURL(file);
    const origOnload = img.onload;
    img.onload = (ev) => {
      URL.revokeObjectURL(objectUrl);
      if (origOnload) (origOnload as EventListener).call(img, ev);
    };
    img.src = objectUrl;
  }, [isRtl, setImagePreviewPersisted, setJobIdPersisted]);
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0]; if (file) handleFile(file);
  }, [handleFile]);

  const handleTrace = async () => {
    if (!imageFile && !previewRef.current) return;

    // Use previewRef (not imagePreview state) to read the current preview URL.
    // Reading from state inside an async function can cause stale closures and
    // calling setImagePreviewPersisted here would trigger re-renders causing loops.
    let previewUrl = previewRef.current;
    if (imageFile && !previewUrl) {
      // FileReader is async — wait for it before proceeding
      previewUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const result = e.target?.result as string;
          previewRef.current = result;  // update ref only, NOT state (avoids re-render loop)
          resolve(result);
        };
        reader.readAsDataURL(imageFile);
      });
    }

    setStatus("loading"); setResult(null); setErrorMsg(""); setCurrentStep("");
    try {
      const formData = new FormData();
      if (imageFile) {
        formData.append("image", imageFile);
      } else if (previewUrl) {
        // Convert base64/URL preview to blob
        const resp = await fetch(previewUrl);
        const blob = await resp.blob();
        formData.append("image", blob, "image.jpg");
      }
      if (description.trim()) formData.append("description", description.trim());
      if (focusText.trim()) formData.append("focusText", focusText.trim());
      formData.append("lang", isRtl ? "he" : "en");
      formData.append("landscapeMode", fullImageMode ? "true" : "false");
      formData.append("variationIndex", String(selectedVariation - 1));
      const lwVal = parseFloat(lineweightMm);
      if (!isNaN(lwVal) && lwVal >= 0) formData.append("lineweightMm", String(lwVal));
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
        setResult(data as TraceResult);
        setStatus("success");
        refetchTokens();
        toast.success(isRtl ? `העיצוב מוכן! לחץ הורד DXF` : `Design ready! Click Download DXF`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (isRtl ? "שגיאה בעיבוד" : "Processing error");
      setErrorMsg(msg); setStatus("error"); toast.error(msg);
    }
  };

  // Handle Try Again from history — fetch source image URL and re-submit
  const handleTraceFromUrl = async (sourceUrl: string) => {
    setStatus("loading"); setResult(null); setErrorMsg("");
    try {
      // Fetch the image as a blob from S3
      const resp = await fetch(sourceUrl);
      if (!resp.ok) throw new Error("Failed to fetch source image");
      const blob = await resp.blob();
      const file = new File([blob], "source.jpg", { type: blob.type || "image/jpeg" });
      setImageFile(file);
      const formData = new FormData();
      formData.append("image", file);
      if (description.trim()) formData.append("description", description.trim());
      if (focusText.trim()) formData.append("focusText", focusText.trim());
      formData.append("lang", isRtl ? "he" : "en");
      formData.append("landscapeMode", fullImageMode ? "true" : "false");
      formData.append("variationIndex", String(selectedVariation - 1));
      const lwVal = parseFloat(lineweightMm);
      if (!isNaN(lwVal) && lwVal >= 0) formData.append("lineweightMm", String(lwVal));
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
      if (data.jobId) {
        setJobIdPersisted(data.jobId);
        startPolling(data.jobId);
      } else {
        setResult(data as TraceResult);
        setStatus("success");
        refetchTokens();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (isRtl ? "שגיאה בעיבוד" : "Processing error");
      setErrorMsg(msg); setStatus("error"); toast.error(msg);
    }
  };

  const reset = () => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    setImageFile(null); setImagePreviewPersisted(null); setResult(null);
    setStatus("idle"); setErrorMsg(""); setFocusText(""); setCustomImprovement("");
    setJobIdPersisted(null); setTryAgainUrl(null);
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
        {/* Upload area — hidden during loading */}
        <div
          className="rounded-xl p-5 relative"
          style={{ background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', display: status === 'loading' ? 'none' : undefined }}
        >
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{background: '#f0fdf9'}}>
                <Scan className="w-3.5 h-3.5 text-teal-600" />
              </div>
              <h2 className="font-semibold text-sm text-gray-700">{t("aiTraceTitle")}</h2>
            </div>

            {/* Hidden file input — use id for label-based trigger (Safari iOS compatible) */}
            <input
              ref={fileInputRef}
              id="ai-trace-file-input"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />

            {imagePreview ? (
              <div
                className="flex items-center gap-3 mb-3 p-3 rounded-xl"
                style={{background: '#f0fdf9', border: '1px solid #99f6e4'}}
              >
                <img src={imagePreview} alt="Preview" className="w-16 h-16 object-contain rounded-lg shrink-0 border border-gray-200 bg-white" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate text-gray-700">{imageFile?.name}</p>
                  <p className="text-xs mb-2 text-gray-400">{isRtl ? "תמונה נבחרה" : "Image selected"}</p>
                  <label
                    htmlFor="ai-trace-file-input"
                    className="text-xs font-medium text-teal-600 hover:text-teal-800 cursor-pointer"
                  >
                    {isRtl ? "החלף תמונה" : "Change image"}
                  </label>
                </div>
              </div>
            ) : (
              <div className="mb-3 space-y-2">
                <label
                  htmlFor="ai-trace-file-input"
                  className="w-full flex items-center justify-center gap-3 py-5 rounded-xl transition-colors hover:bg-teal-50 cursor-pointer"
                  style={{border: '2px dashed #99f6e4', background: '#f0fdf9'}}
                >
                  <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-teal-100">
                    <ImageIcon className="w-5 h-5 text-teal-600" />
                  </div>
                  <div className="text-start">
                    <p className="font-semibold text-sm text-teal-700">{isRtl ? "בחר תמונה" : "Choose Photo"}</p>
                    <p className="text-xs text-gray-400">{isRtl ? "מהגלריה או הצלם חדש" : "From gallery or take new photo"}</p>
                  </div>
                </label>
                <p className="hidden sm:block text-xs text-center text-gray-400">
                  {isRtl ? "או גרור תמונה לכאן" : "or drag & drop an image here"}
                </p>
              </div>
            )}

            {/* Drag overlay — desktop only */}
            {!imagePreview && (
              <div
                className={`hidden sm:block absolute inset-0 rounded-xl transition-colors pointer-events-none ${
                  dragOver ? "bg-teal-100/30 border-2 border-teal-500" : ""
                }`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
              />
            )}

            {/* Mode toggle: Object vs Full Image */}
            <div className="mb-3">
              <div
                className="flex rounded-xl overflow-hidden p-1 gap-1"
                style={{background: '#f1f5f9', border: '1px solid #e2e8f0'}}
              >
                <button
                  type="button"
                  onClick={() => setFullImageMode(false)}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold rounded-lg transition-all"
                  style={!fullImageMode ? {
                    background: 'linear-gradient(135deg, #0d9488, #06b6d4)',
                    color: 'white',
                    boxShadow: '0 2px 8px rgba(13,148,136,0.35)',
                  } : {color: '#6b7280', background: 'transparent'}}
                >
                  <span className="text-base">📷</span>
                  <span>{isRtl ? "אובייקט" : "Object"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFullImageMode(true)}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold rounded-lg transition-all"
                  style={fullImageMode ? {
                    background: 'linear-gradient(135deg, #059669, #10b981)',
                    color: 'white',
                    boxShadow: '0 2px 8px rgba(5,150,105,0.35)',
                  } : {color: '#6b7280', background: 'transparent'}}
                >
                  <span className="text-base">🖼️</span>
                  <span>{isRtl ? "כל הפריטים" : "Full Image"}</span>
                </button>
              </div>
              <p className="text-xs mt-1 px-1 text-gray-400">
                {fullImageMode
                  ? (isRtl ? "מצייר את כל הפריטים שרואים בתמונה בדיוק כפי שהם" : "Draws all elements visible in the image exactly as they appear")
                  : (isRtl ? "מתמקד באובייקט הראשי בתמונה" : "Focuses on the main object in the image")}
              </p>
            </div>

            {/* Focus text — what to draw */}
            <div className="mb-3">
              <label className="block text-xs font-semibold mb-1 text-gray-500">
                {isRtl ? "מה לצייר? (ברירת מחדל: האובייקט הדומיננטי)" : "What to draw? (default: dominant object)"}
              </label>
              <input
                type="text"
                value={focusText}
                onChange={(e) => setFocusText(e.target.value)}
                placeholder={isRtl ? "לדוגמה: רק הכיסאות, רק העציץ, הכלב בלבד..." : "e.g. only the chairs, only the plant, just the dog..."}
                className="w-full text-sm rounded-lg px-3 py-2 bg-gray-50 border border-gray-200 text-gray-800"
                style={{ textAlign: isRtl ? "right" : "left" }}
                dir={isRtl ? "rtl" : "ltr"}
              />
            </div>
            <input type="hidden" value={description} onChange={(e) => setDescription(e.target.value)} />

            {/* Variation selector */}
            <div className="mb-3">
              <label className="block text-xs font-semibold mb-1.5 text-gray-500">
                {isRtl ? "בחר סגנון" : "Choose Style"}
              </label>
              <div className="grid grid-cols-3 gap-2">
                {([1, 2, 3] as const).map((v) => {
                  const labels = isRtl
                    ? ["פשוט", "מפורט", "דקורטיבי"]
                    : ["Simple", "Detailed", "Decorative"];
                  const descs = isRtl
                    ? ["קווים בסיסיים, נקי", "עשיר בפרטים", "אמנותי, מעוטר"]
                    : ["Basic lines, clean", "Rich in details", "Artistic, ornate"];
                  const gradients = [
                    'linear-gradient(135deg, #6366f1, #818cf8)',
                    'linear-gradient(135deg, #0d9488, #06b6d4)',
                    'linear-gradient(135deg, #7c3aed, #a855f7)',
                  ];
                  const shadows = [
                    '0 3px 10px rgba(99,102,241,0.4)',
                    '0 3px 10px rgba(13,148,136,0.4)',
                    '0 3px 10px rgba(124,58,237,0.4)',
                  ];
                  const isSelected = selectedVariation === v;
                  const isRecommended = v === 2;
                  return (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setSelectedVariation(v)}
                      className="relative flex flex-col items-center justify-center gap-0.5 py-3 px-1 rounded-xl text-xs font-medium transition-all hover:scale-105 active:scale-95"
                      style={isSelected
                        ? { background: gradients[v-1], color: 'white', border: '2px solid transparent', boxShadow: shadows[v-1], transform: 'scale(1.04)' }
                        : { background: '#f8fafc', color: '#374151', border: '2px solid #e2e8f0' }
                      }
                    >
                      {isRecommended && (
                        <span
                          className="absolute -top-2 left-1/2 -translate-x-1/2 text-xs font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap"
                          style={{ background: 'linear-gradient(135deg, #f59e0b, #f97316)', color: 'white', fontSize: '9px', lineHeight: '1.2', boxShadow: '0 1px 4px rgba(245,158,11,0.4)' }}
                        >
                          {isRtl ? "מומלץ" : "Best"}
                        </span>
                      )}
                      <span className="font-bold text-base">{v}</span>
                      <span className="font-bold" style={{ fontSize: '11px' }}>{labels[v - 1]}</span>
                      <span style={{ fontSize: '9px', opacity: isSelected ? 0.9 : 0.6, textAlign: 'center' }}>{descs[v - 1]}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Lineweight option */}
            <div className="flex items-center gap-2 pt-1 pb-1 flex-wrap">
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
              <span className="text-xs text-gray-400">{isRtl ? "(0 = הדק ביותר, ריק = ברירת מחדל)" : "(0 = hairline, empty = default)"}</span>
            </div>
            <div className="flex gap-2">
              <button
                className="flex-1 font-bold text-base h-13 rounded-xl flex items-center justify-center gap-2 transition-all hover:opacity-90"
                style={{
                  background: ((!imageFile && !imagePreview) || status === "loading") ? 'linear-gradient(135deg, #c4b5fd, #a5b4fc)' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  color: 'white',
                  border: 'none',
                  boxShadow: ((!imageFile && !imagePreview) || status === "loading") ? 'none' : '0 4px 14px rgba(99,102,241,0.4)',
                  cursor: ((!imageFile && !imagePreview) || status === "loading") ? 'not-allowed' : 'pointer',
                }}
                disabled={(!imageFile && !imagePreview) || status === "loading"}
                onClick={handleTrace}
              >
                {status === "loading" ? (
                  <><div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />{isRtl ? "ה-AI מנתח ומצייר..." : "AI is analyzing and drawing..."}</>
                ) : (
                  <><Wand2 className="w-4 h-4" />{isRtl ? "צור AI Outline" : "Create AI Outline"}</>
                )}
              </button>
              {tryAgainUrl && status !== "loading" && (
                <button
                  className="h-13 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-1.5 transition-all hover:opacity-90"
                  style={{ background: 'linear-gradient(135deg, #0f766e, #0d9488)', color: 'white', border: 'none', boxShadow: '0 4px 12px rgba(13,148,136,0.3)' }}
                  onClick={() => handleTraceFromUrl(tryAgainUrl)}
                  title={isRtl ? "נסה שוב עם אותה תמונה" : "Try again with same image"}
                >
                  <Scan className="w-4 h-4" />
                  {isRtl ? "נסה שוב" : "Try Again"}
                </button>
              )}
            </div>
        </div>

        {/* Loading */}
        {status === "loading" && (
          <div
            className="rounded-xl overflow-hidden"
            style={{ background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}
          >
            {/* Image preview with scanning animation */}
            {imagePreview && (
              <div className="relative overflow-hidden" style={{ maxHeight: 280 }}>
                <img
                  src={imagePreview}
                  alt="Processing"
                  className="w-full object-contain block"
                  style={{ maxHeight: 280, filter: 'brightness(0.85)' }}
                />
                {/* Scanning line */}
                <div
                  className="absolute left-0 right-0 pointer-events-none"
                  style={{
                    top: 0,
                    height: '3px',
                    background: 'linear-gradient(90deg, transparent, #0d9488, #5eead4, #0d9488, transparent)',
                    boxShadow: '0 0 12px 4px rgba(13,148,136,0.6)',
                    animation: 'scanLine 2s ease-in-out infinite',
                  }}
                />
                {/* Scanning glow overlay */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background: 'linear-gradient(180deg, rgba(13,148,136,0.08) 0%, transparent 40%, transparent 60%, rgba(13,148,136,0.08) 100%)',
                    animation: 'scanGlow 2s ease-in-out infinite',
                  }}
                />
                {/* AI badge overlay */}
                <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold" style={{background: 'rgba(13,148,136,0.9)', color: 'white'}}>
                  <div className="w-3 h-3 rounded-full border-2 border-white/40 border-t-white" style={{animation: 'spin 0.8s linear infinite'}} />
                  {isRtl ? 'AI מנתח...' : 'AI analyzing...'}
                </div>
              </div>
            )}
            <div className="p-5 flex flex-col items-center gap-3 text-center">
              {!imagePreview && (
                <div className="relative w-14 h-14">
                  <div className="absolute inset-0 rounded-full" style={{border: '3px solid #ccfbf1', borderTopColor: '#0d9488', animation: 'spin 1s linear infinite'}} />
                  <Wand2 className="absolute inset-0 m-auto w-5 h-5 text-teal-600" />
                </div>
              )}
              {/* Step progress indicator */}
              <div className="w-full max-w-xs">
                {/* Step labels */}
                <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                  <span style={{color: '#0d9488', fontWeight: 600}}>
                    {isRtl ? 'שלב 1: ניתוח' : 'Step 1: Analyze'}
                  </span>
                  <span style={{
                    color: (currentStep.includes('יצר') || currentStep.includes('Generat') || currentStep.includes('ממיר') || currentStep.includes('Convert')) ? '#0d9488' : '#d1d5db',
                    fontWeight: (currentStep.includes('יצר') || currentStep.includes('Generat') || currentStep.includes('ממיר') || currentStep.includes('Convert')) ? 600 : 400,
                  }}>
                    {isRtl ? 'שלב 2: יצירה' : 'Step 2: Generate'}
                  </span>
                  <span style={{
                    color: (currentStep.includes('ממיר') || currentStep.includes('Convert')) ? '#0d9488' : '#d1d5db',
                    fontWeight: (currentStep.includes('ממיר') || currentStep.includes('Convert')) ? 600 : 400,
                  }}>
                    {isRtl ? 'שלב 3: וקטור' : 'Step 3: Vector'}
                  </span>
                </div>
                {/* Progress bar */}
                <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden mb-2">
                  <div
                    className="h-full rounded-full"
                    style={{
                      background: 'linear-gradient(90deg, #0d9488, #5eead4)',
                      width: (currentStep.includes('ממיר') || currentStep.includes('Convert')) ? '90%'
                        : (currentStep.includes('יצר') || currentStep.includes('Generat')) ? '60%'
                        : '25%',
                      transition: 'width 1s ease-in-out',
                    }}
                  />
                </div>
                {/* Current step text */}
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-teal-400 shrink-0" style={{animation: 'pulse 1.5s ease-in-out infinite'}} />
                  <p className="font-semibold text-sm text-gray-700 text-start">
                    {currentStep || (isRtl ? "מנתח תמונה עם AI..." : "Analyzing image with AI...")}
                  </p>
                </div>
              </div>
              <p className="text-xs text-gray-400">{isRtl ? "זה עשוי לקחת 30-90 שניות" : "This may take 30-90 seconds"}</p>
              <div className="flex gap-1.5">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="w-1.5 h-1.5 rounded-full bg-teal-400" style={{animation: `bounce 1s infinite ${i * 0.15}s`}} />
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
              <p className="font-semibold text-red-600">{isRtl ? "שגיאה בעיבוד" : "Processing Error"}</p>
              <p className="text-sm text-gray-500">
                {errorMsg && (errorMsg.toLowerCase().includes("timeout") || errorMsg.includes("זמן"))
                  ? (isRtl ? "העיבוד לקח יותר מדי זמן. נסה שוב — בדרך כלל לוקח 2-4 דקות." : "Processing took too long. Please try again — usually takes 2-4 minutes.")
                  : errorMsg
                }
              </p>
              <div className="flex gap-2 flex-wrap justify-center">
                <button
                  className="text-sm px-4 py-2 rounded-lg font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200"
                  onClick={reset}
                >{isRtl ? "נסה שוב" : "Try Again"}</button>
                {errorMsg && (errorMsg.includes("אסימונים") || errorMsg.toLowerCase().includes("token")) && (
                  <button
                    className="text-sm px-4 py-2 rounded-lg font-semibold"
                    style={{background: '#0d9488', color: 'white', border: 'none'}}
                    onClick={() => window.location.href = "/tokens"}
                  >
                    {isRtl ? "רכוש אסימונים" : "Buy Tokens"}
                  </button>
                )}
              </div>
          </div>
        )}

        {/* Results — 3 variations */}
        {status === "success" && result && (
          <>
            <div
              className="rounded-xl p-4"
              style={{ background: '#f0fdf9', border: '1px solid #99f6e4' }}
            >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-teal-600" />
                    <span className="font-semibold text-sm text-gray-700">
                      {isRtl ? "3 עיצובים מוכנים — בחר את המועדף" : "3 designs ready — choose your favorite"}
                    </span>
                  </div>
                  {/* Change image button — uses label for Safari iOS compatibility */}
                  {/* NOTE: No onClick here — resetting state in onClick breaks Safari iOS file picker */}
                  {/* All state reset is handled inside handleFile when a new file is chosen */}
                  <label
                    htmlFor="ai-trace-file-input"
                    className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all shrink-0 cursor-pointer"
                    style={{ background: '#0d9488', color: 'white', border: 'none' }}
                  >
                    <ImageIcon className="w-3.5 h-3.5" />
                    {isRtl ? "החלף תמונה" : "Change Image"}
                  </label>
                </div>
                {result.objectDescription && (
                  <p className="text-xs mt-1 line-clamp-2 text-gray-500">
                    <span className="font-medium text-teal-700">{isRtl ? "תיאור AI: " : "AI description: "}</span>
                    {result.objectDescription}
                  </p>
                )}
            </div>

            {/* AI Suggestions + custom improvement */}
            {result.suggestions && result.suggestions.length > 0 && (
              <div
                className="rounded-xl p-4"
                style={{ background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}
              >
                  <div className="flex items-center gap-2 mb-3">
                    <Wand2 className="w-4 h-4 text-teal-600" />
                    <span className="text-sm font-semibold text-gray-700">
                      {isRtl ? "שפר את העיצוב" : "Improve the design"}
                    </span>
                  </div>

                  <p className="text-xs font-medium mb-1.5 text-teal-700">
                    {isRtl ? "שנה סגנון:" : "Change style:"}
                  </p>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {(isRtl ? VARIATION_LABELS : VARIATION_LABELS_EN).map((label, idx) => (
                      <button
                        key={idx}
                        onClick={() => { setFocusText(label); handleTrace(); }}
                        className="text-xs px-3 py-1.5 rounded-full font-medium transition-all bg-teal-50 border border-teal-200 text-teal-700 hover:bg-teal-100"
                      >
                        🎨 {label}
                      </button>
                    ))}
                  </div>

                  <p className="text-xs font-medium mb-1.5 text-teal-700">
                    {isRtl ? "הצעות ה-AI:" : "AI suggestions:"}
                  </p>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {result.suggestions.map((suggestion, idx) => (
                      <button
                        key={idx}
                        onClick={() => { setFocusText(suggestion); handleTrace(); }}
                        className="text-xs px-3 py-1.5 rounded-full font-medium transition-all bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100"
                      >
                        ✨ {suggestion}
                      </button>
                    ))}
                  </div>

                  <p className="text-xs font-medium mb-1.5 text-teal-700">
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
                      placeholder={isRtl ? "לדוגמה: הוסף פרטים, שנה סגנון..." : "e.g. add more detail, cartoon style..."}
                      className="flex-1 text-sm rounded-lg px-3 py-2 bg-gray-50 border border-gray-200 text-gray-800"
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
                      className="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
                      style={{
                        background: customImprovement.trim() ? '#0d9488' : '#ccfbf1',
                        color: customImprovement.trim() ? 'white' : '#5eead4',
                        border: 'none',
                        cursor: customImprovement.trim() ? 'pointer' : 'not-allowed',
                      }}
                    >
                      {isRtl ? "החל" : "Go"}
                    </button>
                  </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
            </div>

            <button
              className="w-full py-2.5 text-sm font-medium rounded-lg transition-all bg-gray-100 hover:bg-gray-200 text-gray-600 border border-gray-200"
              onClick={reset}
            >
              {t("aiTraceNewImage")}
            </button>
          </>
        )}

        {/* Tips */}
        <div
          className="rounded-xl p-4"
          style={{ background: '#f0fdf9', border: '1px solid #ccfbf1' }}
        >
            <h3 className="font-semibold text-sm mb-2 text-teal-700">{t("tipsTitle")}</h3>
            <ul className="space-y-1.5 text-sm text-gray-600">
              <li className="flex gap-2"><span className="shrink-0 text-teal-500">•</span><span>{t("aiTraceTip1")}</span></li>
              <li className="flex gap-2"><span className="shrink-0 text-teal-500">•</span><span>{t("aiTraceTip2")}</span></li>
              <li className="flex gap-2"><span className="shrink-0 text-teal-500">•</span><span>{isRtl ? "ה-AI מנתח את התמונה ומצייר מחדש — 3 סגנונות שונים לבחירה" : "AI analyzes your image and redraws it — 3 different styles to choose from"}</span></li>
            </ul>
        </div>
      </div>
    </>
  );
}

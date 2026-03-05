/**
 * FaceDetectTab.tsx — Face Detection to DXF
 *
 * User uploads a photo with faces → GPT-4o Vision detects and describes the face(s)
 * → gpt-image-1 draws 3 portrait line art variations → potrace → DXF ready for engraving.
 */
import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { DxfDownloadDialog } from "@/components/DxfDownloadDialog";
import {
  Download,
  AlertCircle,
  ImageIcon,
  Eye,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Wand2,
  X,
  UserCircle,
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

interface FaceResult {
  images: GeneratedImage[];
  faceDescription: string;
}

type Status = "idle" | "loading" | "success" | "error";

const VARIATION_LABELS_HE = ["פורטרט", "מפורט", "אמנותי"];
const VARIATION_LABELS_EN = ["Portrait", "Detailed", "Artistic"];

// ─── SVG Viewer ───────────────────────────────────────────────────────────────
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
  const onWheel = (e: React.WheelEvent) => { e.preventDefault(); const f = e.deltaY < 0 ? 1.12 : 1 / 1.12; setScale((s) => clamp(parseFloat((s * f).toFixed(3)))); };
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

  // Parse SVG aspect ratio
  const svgAspect = (() => {
    const vb = svgContent.match(/viewBox="([^"]+)"/)?.[1]?.split(/\s+/);
    if (vb && vb.length === 4) { const w = parseFloat(vb[2]); const h = parseFloat(vb[3]); if (w && h) return h / w; }
    return 1;
  })();

  const styledSvg = svgContent
    .replace(/fill="[^"]*"/g, 'fill="none"')
    .replace(/fill:[^;"']*(;|(?="))/g, 'fill:none$1')
    .replace(/<path /g, '<path stroke="black" stroke-width="1.5" fill="none" ');

  const Viewer = ({ height = "100%" }: { height?: string }) => (
    <div style={{ width: "100%", height, overflow: "hidden", background: "white", display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}
      dangerouslySetInnerHTML={{ __html: styledSvg }} />
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
          if (el) { const w = el.getBoundingClientRect().width; el.style.height = Math.min(Math.max(w * svgAspect, 180), 500) + 'px'; }
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

// ─── Image Card ───────────────────────────────────────────────────────────────
interface ImageCardProps {
  image: GeneratedImage;
  index: number;
  isRtl: boolean;
  onDownload: (image: GeneratedImage) => void;
  onZoom: (src: string, alt: string) => void;
}
function ImageCard({ image, index, isRtl, onDownload, onZoom }: ImageCardProps) {
  const [showVector, setShowVector] = useState(false);
  const label = isRtl ? VARIATION_LABELS_HE[index] : VARIATION_LABELS_EN[index];

  const handleQuickDxf = async () => {
    try {
      const resp = await fetch(image.dxfUrl);
      if (!resp.ok) throw new Error();
      const text = await resp.text();
      const blob = new Blob([text], { type: 'application/dxf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = image.dxfFilename || `face-${index + 1}.dxf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch { onDownload(image); }
  };

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #e2e8f0', background: '#ffffff' }}>
      {/* Label */}
      <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: '1px solid #f1f5f9' }}>
        <span className="text-xs font-bold text-purple-700">{index + 1}. {label}</span>
        {index === 1 && (
          <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: '#f59e0b', color: 'white', fontSize: '9px' }}>
            {isRtl ? "מומלץ" : "Recommended"}
          </span>
        )}
      </div>
      {/* Image / Vector toggle */}
      {showVector ? (
        <SvgViewer svgContent={image.svgPreview} />
      ) : (
        <div className="relative bg-gray-50 cursor-pointer" style={{ aspectRatio: '1/1' }} onClick={() => onZoom(image.imageUrl, label)}>
          <img src={image.imageUrl} alt={label} className="w-full h-full object-contain" />
          <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/10">
            <ZoomIn className="w-8 h-8 text-white drop-shadow-lg" />
          </div>
        </div>
      )}
      {/* Toggle + info */}
      <div className="flex items-center justify-between px-3 py-1.5" style={{ borderTop: '1px solid #f1f5f9' }}>
        <button
          onClick={() => setShowVector(!showVector)}
          className="text-xs font-medium flex items-center gap-1 transition-colors"
          style={{ color: showVector ? '#7c3aed' : '#6b7280' }}
        >
          <Eye className="w-3 h-3" />
          {showVector ? (isRtl ? "תמונה" : "Photo") : (isRtl ? "וקטור" : "Vector")}
        </button>
        <span className="text-xs text-gray-400">{image.segmentCount} {isRtl ? "קטעים" : "segments"}</span>
      </div>
      {/* Download buttons */}
      <div className="flex gap-1.5 px-3 pb-3">
        <button
          onClick={handleQuickDxf}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all"
          style={{ background: '#7c3aed', color: 'white', border: 'none' }}
        >
          <Download className="w-3.5 h-3.5" />
          DXF
        </button>
        <button
          onClick={() => onDownload(image)}
          className="flex items-center justify-center gap-1 py-2 px-3 rounded-lg text-xs font-medium transition-all"
          style={{ background: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb' }}
          title={isRtl ? "אפשרויות נוספות" : "More options"}
        >
          <Download className="w-3.5 h-3.5" />
          {isRtl ? "עוד" : "More"}
        </button>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
interface FaceDetectTabProps {
  onOpenAuth?: () => void;
}

export function FaceDetectTab({ onOpenAuth }: FaceDetectTabProps) {
  const { language } = useLanguage();
  const isRtl = language === "he";

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(() => localStorage.getItem("face_detect_imagePreview"));
  const [status, setStatus] = useState<Status>(() => {
    const saved = localStorage.getItem("face_detect_jobId");
    return saved ? "loading" : "idle";
  });
  const [result, setResult] = useState<FaceResult | null>(() => {
    const saved = localStorage.getItem("face_detect_result");
    if (saved) { try { return JSON.parse(saved) as FaceResult; } catch { return null; } }
    return null;
  });
  const [errorMsg, setErrorMsg] = useState("");
  const [downloadTarget, setDownloadTarget] = useState<GeneratedImage | null>(null);
  const [zoomImg, setZoomImg] = useState<{ src: string; alt: string } | null>(null);
  const [lineweightMm, setLineweightMm] = useState<string>("");
  const [dragOver, setDragOver] = useState(false);
  const [jobId, setJobId] = useState<string | null>(() => localStorage.getItem("face_detect_jobId"));
  const [currentStep, setCurrentStep] = useState<string>("");
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<string | null>(localStorage.getItem("face_detect_imagePreview"));

  const { refetch: refetchTokens } = trpc.auth.me.useQuery(undefined, { enabled: false });

  const setImagePreviewPersisted = useCallback((val: string | null) => {
    setImagePreview(val);
    previewRef.current = val;
    if (val) localStorage.setItem("face_detect_imagePreview", val);
    else localStorage.removeItem("face_detect_imagePreview");
  }, []);

  const setJobIdPersisted = useCallback((val: string | null) => {
    setJobId(val);
    if (val) localStorage.setItem("face_detect_jobId", val);
    else localStorage.removeItem("face_detect_jobId");
  }, []);

  const reset = useCallback(() => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    setImageFile(null);
    setImagePreviewPersisted(null);
    setStatus("idle");
    setResult(null);
    setErrorMsg("");
    setCurrentStep("");
    setJobIdPersisted(null);
    localStorage.removeItem("face_detect_result");
  }, [setImagePreviewPersisted, setJobIdPersisted]);

  const startPolling = useCallback((jId: string) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/face-detect/job/${jId}`, { credentials: "include" });
        if (!res.ok) return;
        const data = await res.json() as {
          status: string;
          result?: FaceResult & { success?: boolean };
          error?: string;
          message?: string;
          step?: string;
          stepEn?: string;
          partialImages?: GeneratedImage[];
        };
        if (data.status === "done" && data.result?.images) {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          const faceResult: FaceResult = {
            images: data.result.images,
            faceDescription: data.result.faceDescription ?? "",
          };
          setResult(faceResult);
          localStorage.setItem("face_detect_result", JSON.stringify(faceResult));
          setStatus("success");
          setCurrentStep("");
          setJobIdPersisted(null);
          refetchTokens();
          toast.success(isRtl ? "הפורטרט מוכן! לחץ הורד DXF" : "Portrait ready! Click Download DXF");
          if ("Notification" in window && Notification.permission === "granted") {
            new Notification(isRtl ? "✅ זיהוי פנים הושלם!" : "✅ Face Detection Complete!", {
              body: isRtl ? "הפורטרט שלך מוכן להורדה" : "Your portrait is ready for download",
              icon: "/favicon.ico",
            });
          }
        } else if (data.status === "processing" && Array.isArray(data.partialImages) && data.partialImages.length > 0) {
          const partial = data.partialImages as GeneratedImage[];
          setResult((prev) => {
            if (prev && prev.images.length >= partial.length) return prev;
            return { images: partial, faceDescription: prev?.faceDescription ?? "" };
          });
          setStatus("success");
          const stepMsg = isRtl ? (data.step || data.stepEn) : (data.stepEn || data.step);
          if (stepMsg) setCurrentStep(stepMsg);
        } else if (data.status === "error") {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          const msg = data.message || data.error || (isRtl ? "שגיאה בעיבוד" : "Processing error");
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
          const stepMsg = isRtl ? (data.step || data.stepEn) : (data.stepEn || data.step);
          if (stepMsg) setCurrentStep(stepMsg);
        }
      } catch { /* network error, keep trying */ }
    }, 3000);
  }, [isRtl, refetchTokens, setJobIdPersisted]);

  useEffect(() => {
    const savedId = localStorage.getItem("face_detect_jobId");
    if (savedId) { setStatus("loading"); startPolling(savedId); }
    return () => { if (pollIntervalRef.current) clearInterval(pollIntervalRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCancel = useCallback(async () => {
    if (!jobId) return;
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    try {
      const res = await fetch(`/api/face-detect/cancel/${jobId}`, { method: "POST", credentials: "include" });
      const data = await res.json();
      if (data.cancelled) {
        toast.success(isRtl ? "העיבוד בוטל והאסימונים הוחזרו" : "Processing cancelled — tokens refunded");
        refetchTokens();
      }
    } catch { /* ignore */ }
    setStatus("idle");
    setJobIdPersisted(null);
  }, [jobId, isRtl, refetchTokens, setJobIdPersisted]);

  const handleFile = useCallback((file: File) => {
    const allowed = ["image/png", "image/jpeg", "image/bmp", "image/webp", "image/gif"];
    if (!allowed.includes(file.type)) { toast.error(isRtl ? "פורמט לא נתמך." : "Unsupported format."); return; }
    if (file.size > 16 * 1024 * 1024) { toast.error(isRtl ? "הקובץ גדול מדי. מקסימום 16 MB." : "File too large. Max 16 MB."); return; }
    setImageFile(file);
    setResult(null);
    setStatus("idle");
    setErrorMsg("");
    setCurrentStep("");
    setJobIdPersisted(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    const canvas = document.createElement("canvas");
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 1024;
      let w = img.width, h = img.height;
      if (w > MAX || h > MAX) { if (w > h) { h = Math.round(h * MAX / w); w = MAX; } else { w = Math.round(w * MAX / h); h = MAX; } }
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (ctx) { ctx.drawImage(img, 0, 0, w, h); }
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      setImagePreviewPersisted(dataUrl);
      URL.revokeObjectURL(objectUrl);
    };
    img.src = objectUrl;
  }, [isRtl, setImagePreviewPersisted, setJobIdPersisted]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0]; if (file) handleFile(file);
  }, [handleFile]);

  const handleDetect = async () => {
    if (!imageFile && !previewRef.current) return;
    let previewUrl = previewRef.current;
    if (imageFile && !previewUrl) {
      previewUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => { const result = e.target?.result as string; previewRef.current = result; resolve(result); };
        reader.readAsDataURL(imageFile);
      });
    }
    setStatus("loading"); setResult(null); setErrorMsg(""); setCurrentStep("");
    try {
      const formData = new FormData();
      if (imageFile) {
        formData.append("image", imageFile);
      } else if (previewUrl) {
        const resp = await fetch(previewUrl);
        const blob = await resp.blob();
        formData.append("image", blob, "image.jpg");
      }
      formData.append("lang", isRtl ? "he" : "en");
      const lwVal = parseFloat(lineweightMm);
      if (!isNaN(lwVal) && lwVal >= 0) formData.append("lineweightMm", String(lwVal));
      const res = await fetch("/api/face-detect/start", { method: "POST", body: formData, credentials: "include" });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === "UNAUTHORIZED") { if (onOpenAuth) onOpenAuth(); setStatus("idle"); return; }
        if (data.error === "INSUFFICIENT_TOKENS") {
          const msg = isRtl ? (data.message || "נגמרו האסימונים") : (data.messageEn || data.message || "Out of tokens");
          toast.error(msg); setErrorMsg(msg); setStatus("error"); refetchTokens(); return;
        }
        throw new Error(isRtl ? (data.message || data.error) : (data.messageEn || data.error || "Error"));
      }
      if (data.jobId) {
        setJobIdPersisted(data.jobId);
        startPolling(data.jobId);
        if ("Notification" in window && Notification.permission === "default") {
          Notification.requestPermission();
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (isRtl ? "שגיאה בעיבוד" : "Processing error");
      setErrorMsg(msg); setStatus("error"); toast.error(msg);
    }
  };

  const canSubmit = !!(imageFile || imagePreview) && status !== "loading";

  return (
    <div className="space-y-4" dir={isRtl ? "rtl" : "ltr"}>
      {/* Upload area */}
      {(status === "idle" || status === "error") && !result && (
        <div
          className="rounded-xl overflow-hidden"
          style={{ border: '1px solid #e2e8f0', background: '#ffffff' }}
        >
          <div className="p-4">
            {/* Header */}
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: '#f3e8ff' }}>
                <UserCircle className="w-4 h-4 text-purple-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-800">
                  {isRtl ? "זיהוי פנים ל-DXF" : "Face Detection to DXF"}
                </h3>
                <p className="text-xs text-gray-500">
                  {isRtl ? "העלה תמונה עם פנים — ה-AI יצייר 3 וריאציות פורטרט" : "Upload a photo with faces — AI draws 3 portrait variations"}
                </p>
              </div>
            </div>

            {/* Drop zone */}
            <div
              className="relative rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all mb-3"
              style={{
                border: dragOver ? '2px dashed #7c3aed' : '2px dashed #d8b4fe',
                background: dragOver ? '#faf5ff' : '#fefbff',
                minHeight: imagePreview ? 'auto' : 140,
                padding: imagePreview ? 0 : '2rem 1rem',
              }}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              {imagePreview ? (
                <div className="relative w-full">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-full rounded-xl object-contain"
                    style={{ maxHeight: 280 }}
                  />
                  <button
                    className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center"
                    style={{ background: 'rgba(0,0,0,0.5)', color: 'white' }}
                    onClick={(e) => { e.stopPropagation(); setImagePreviewPersisted(null); setImageFile(null); setResult(null); setStatus("idle"); setErrorMsg(""); setJobIdPersisted(null); }}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <>
                  <div className="w-12 h-12 rounded-full flex items-center justify-center mb-2" style={{ background: '#f3e8ff' }}>
                    <UserCircle className="w-7 h-7 text-purple-500" />
                  </div>
                  <p className="text-sm font-semibold text-purple-700 mb-1">
                    {isRtl ? "גרור תמונה לכאן או לחץ לבחירה" : "Drag a photo here or click to choose"}
                  </p>
                  <p className="text-xs text-gray-400">
                    {isRtl ? "PNG, JPG, WEBP — עד 16 MB" : "PNG, JPG, WEBP — up to 16 MB"}
                  </p>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/bmp,image/webp,image/gif"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />
            </div>

            {/* Tips */}
            <div className="rounded-lg p-3 mb-3" style={{ background: '#faf5ff', border: '1px solid #e9d5ff' }}>
              <p className="text-xs font-semibold text-purple-700 mb-1">
                {isRtl ? "טיפים לתוצאה הטובה ביותר:" : "Tips for best results:"}
              </p>
              <ul className="space-y-0.5 text-xs text-gray-600">
                <li className="flex gap-1.5"><span className="text-purple-400 shrink-0">•</span>{isRtl ? "תמונה ברורה עם פנים גלויות" : "Clear photo with visible face(s)"}</li>
                <li className="flex gap-1.5"><span className="text-purple-400 shrink-0">•</span>{isRtl ? "תאורה טובה, ללא חסימות" : "Good lighting, no obstructions"}</li>
                <li className="flex gap-1.5"><span className="text-purple-400 shrink-0">•</span>{isRtl ? "פנים צד, חצי פנים, או מלפנים" : "Side profile, 3/4 view, or front-facing"}</li>
                <li className="flex gap-1.5"><span className="text-purple-400 shrink-0">•</span>{isRtl ? "מייצר 3 וריאציות פורטרט לחריטה" : "Generates 3 portrait variations for engraving"}</li>
              </ul>
            </div>

            {/* Lineweight */}
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <label className="text-xs font-medium text-gray-600 shrink-0">
                {isRtl ? "עובי קו ב-DXF (מ'מ):" : "DXF lineweight (mm):"}
              </label>
              <input
                type="number" min="0" max="2" step="0.05"
                placeholder={isRtl ? "ברירת מחדל" : "default"}
                value={lineweightMm}
                onChange={e => setLineweightMm(e.target.value)}
                className="w-24 border border-border rounded px-2 py-1 text-sm text-center"
              />
              <span className="text-xs text-gray-400">{isRtl ? "(0 = הדק ביותר)" : "(0 = hairline)"}</span>
            </div>

            {/* Submit button */}
            <button
              className="w-full font-bold text-base h-12 rounded-lg flex items-center justify-center gap-2 transition-all"
              style={{
                background: canSubmit ? '#7c3aed' : '#ddd6fe',
                color: 'white',
                border: 'none',
                boxShadow: canSubmit ? '0 2px 8px rgba(124,58,237,0.3)' : 'none',
                cursor: canSubmit ? 'pointer' : 'not-allowed',
              }}
              disabled={!canSubmit}
              onClick={handleDetect}
            >
              <UserCircle className="w-4 h-4" />
              {isRtl ? "זהה פנים וצור DXF (4 אסימונים)" : "Detect Face & Create DXF (4 tokens)"}
            </button>
          </div>
        </div>
      )}

      {/* Loading state */}
      {status === "loading" && !result && (
        <div
          className="rounded-xl p-6 flex flex-col items-center gap-4 text-center"
          style={{ background: '#faf5ff', border: '1px solid #e9d5ff' }}
        >
          <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: '#f3e8ff' }}>
            <UserCircle className="w-8 h-8 text-purple-500" style={{ animation: 'pulse 1.5s ease-in-out infinite' }} />
          </div>
          <div className="w-full">
            {/* Steps */}
            <div className="flex justify-center gap-4 mb-2 text-xs font-medium">
              <span style={{ color: currentStep.includes('מזהה') || currentStep.includes('Detect') ? '#7c3aed' : '#d1d5db', fontWeight: (currentStep.includes('מזהה') || currentStep.includes('Detect')) ? 600 : 400 }}>
                {isRtl ? 'שלב 1: זיהוי' : 'Step 1: Detect'}
              </span>
              <span style={{ color: (currentStep.includes('מצייר') || currentStep.includes('Drawing')) ? '#7c3aed' : '#d1d5db', fontWeight: (currentStep.includes('מצייר') || currentStep.includes('Drawing')) ? 600 : 400 }}>
                {isRtl ? 'שלב 2: ציור' : 'Step 2: Draw'}
              </span>
              <span style={{ color: (currentStep.includes('ממיר') || currentStep.includes('Convert')) ? '#7c3aed' : '#d1d5db', fontWeight: (currentStep.includes('ממיר') || currentStep.includes('Convert')) ? 600 : 400 }}>
                {isRtl ? 'שלב 3: וקטור' : 'Step 3: Vector'}
              </span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden mb-2">
              <div
                className="h-full rounded-full"
                style={{
                  background: 'linear-gradient(90deg, #7c3aed, #c084fc)',
                  width: (currentStep.includes('ממיר') || currentStep.includes('Convert')) ? '90%'
                    : (currentStep.includes('מצייר') || currentStep.includes('Drawing')) ? '60%'
                    : '25%',
                  transition: 'width 1s ease-in-out',
                }}
              />
            </div>
            <div className="flex items-center justify-center gap-2">
              <div className="w-2 h-2 rounded-full bg-purple-400 shrink-0" style={{ animation: 'pulse 1.5s ease-in-out infinite' }} />
              <p className="font-semibold text-sm text-gray-700">
                {currentStep || (isRtl ? "מזהה פנים בתמונה..." : "Detecting faces in image...")}
              </p>
            </div>
          </div>
          <p className="text-xs text-gray-400">{isRtl ? "זה עשוי לקחת 30-90 שניות" : "This may take 30-90 seconds"}</p>
          <div className="flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="w-1.5 h-1.5 rounded-full bg-purple-400" style={{ animation: `bounce 1s infinite ${i * 0.15}s` }} />
            ))}
          </div>
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
      )}

      {/* Error state */}
      {status === "error" && !result && (
        <div className="rounded-xl p-6 flex flex-col items-center gap-3 text-center" style={{ background: '#fff5f5', border: '1px solid #fecaca' }}>
          <AlertCircle className="w-10 h-10 text-red-400" />
          <p className="font-semibold text-red-600">{isRtl ? "שגיאה בעיבוד" : "Processing Error"}</p>
          <p className="text-sm text-gray-500">{errorMsg}</p>
          <button
            className="text-sm px-4 py-2 rounded-lg font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200"
            onClick={() => { setStatus("idle"); setErrorMsg(""); }}
          >
            {isRtl ? "נסה שוב" : "Try Again"}
          </button>
        </div>
      )}

      {/* Results */}
      {result && result.images.length > 0 && (
        <>
          {/* Face description */}
          {result.faceDescription && (
            <div className="rounded-xl p-3" style={{ background: '#faf5ff', border: '1px solid #e9d5ff' }}>
              <div className="flex items-start gap-2">
                <UserCircle className="w-4 h-4 text-purple-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-purple-700 mb-0.5">
                    {isRtl ? "תיאור הפנים שזוהו:" : "Detected face description:"}
                  </p>
                  <p className="text-xs text-gray-600 leading-relaxed">{result.faceDescription}</p>
                </div>
              </div>
            </div>
          )}

          {/* Still loading more */}
          {status === "loading" && (
            <div className="flex items-center justify-center gap-2 py-2">
              <div className="w-4 h-4 rounded-full border-2 border-purple-300 border-t-purple-600 animate-spin" />
              <p className="text-sm text-gray-500">{currentStep || (isRtl ? "מייצר וריאציות נוספות..." : "Generating more variations...")}</p>
            </div>
          )}

          {/* Image grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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

          {/* New image button */}
          <button
            className="w-full py-2.5 text-sm font-medium rounded-lg transition-all bg-gray-100 hover:bg-gray-200 text-gray-600 border border-gray-200"
            onClick={reset}
          >
            {isRtl ? "העלה תמונה חדשה" : "Upload New Photo"}
          </button>
        </>
      )}

      {/* DXF Download Dialog */}
      {downloadTarget && (
        <DxfDownloadDialog
          open={!!downloadTarget}
          onClose={() => setDownloadTarget(null)}
          dxfUrl={downloadTarget.dxfUrl}
          svgContent={downloadTarget.svgPreview}
          defaultFilename={downloadTarget.dxfFilename || "face_portrait.dxf"}
          segmentCount={downloadTarget.segmentCount}
          svgWidth={downloadTarget.width}
          svgHeight={downloadTarget.height}
        />
      )}

      {/* Zoom overlay */}
      {zoomImg && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={() => setZoomImg(null)}
        >
          <img src={zoomImg.src} alt={zoomImg.alt} className="max-w-[90vw] max-h-[90vh] object-contain rounded-xl" />
          <button
            className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 text-white"
            onClick={() => setZoomImg(null)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * FaceDetectTab.tsx — Face Detection to DXF
 *
 * User uploads a photo with faces → gpt-image-1 draws a portrait line art
 * (style: clean / artistic / detailed) → potrace → DXF ready for engraving.
 */
import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { AiProcessingAnimation } from "@/components/AiProcessingAnimation";
import { DxfDownloadDialog } from "@/components/DxfDownloadDialog";
import { ExportButtons } from "@/components/ExportButtons";
import { useBugReport } from "@/hooks/useBugReport";
import {
  Download,
  AlertCircle,
  Eye,
  ZoomIn,
  X,
  UserCircle,
  Scan,
  FileText,
  Loader2,
  Share2,
} from "lucide-react";
import { SvgPanZoomViewer } from "@/components/SvgPanZoomViewer";

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
  style?: PortraitStyle;
  styleLabel?: string;
  styleLabelEn?: string;
}

interface FaceResult {
  images: GeneratedImage[];
  faceDescription?: string;
  suggestions?: string[];
}

type Status = "idle" | "loading" | "success" | "error";
type PortraitStyle = "simple" | "detailed";

// ─── SVG Viewer ───────────────────────────────────────────────────────────────
function SvgViewer({ svgContent }: { svgContent: string }) {
  return <SvgPanZoomViewer svgContent={svgContent} isRtl={true} />;
}

// ─── Portrait Result Card (matches AiTraceTab ImageCard style) ────────────────
interface PortraitCardProps {
  image: GeneratedImage;
  index: number;
  isRtl: boolean;
  onDownload: (image: GeneratedImage) => void;
  onZoom: (src: string, alt: string) => void;
}
function PortraitCard({ image, index, isRtl, onDownload, onZoom }: PortraitCardProps) {
  const [showVector, setShowVector] = useState(false);

  const LABELS_HE = ["פשוט", "מפורט", "אמנותי"];
  const LABELS_EN = ["Simple", "Detailed", "Artistic"];
  const label = isRtl ? (LABELS_HE[index] ?? LABELS_HE[0]) : (LABELS_EN[index] ?? LABELS_EN[0]);
  const isRecommended = index === 0;

  return (
    <div
      className="rounded-xl p-4"
      style={{
        background: '#ffffff',
        border: isRecommended ? '2px solid #7c3aed' : '1px solid #e2e8f0',
        boxShadow: isRecommended ? '0 2px 12px rgba(124,58,237,0.15)' : '0 1px 4px rgba(0,0,0,0.05)',
        animation: `fadeSlideIn 0.4s ease both`,
        animationDelay: `${index * 120}ms`,
      }}
    >
      {/* Header row: label + recommended badge + line count */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: '#f3e8ff', color: '#7c3aed', border: '1px solid #e9d5ff' }}>
            {label}
          </span>
          {isRecommended && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: '#f59e0b', color: 'white' }}>
              {isRtl ? 'מומלץ' : 'Recommended'}
            </span>
          )}
        </div>
        <span className="text-xs text-gray-400">{image.segmentCount.toLocaleString()} {isRtl ? 'קווים' : 'lines'}</span>
      </div>

      {/* Vector image preview */}
      <div
        className="rounded-lg overflow-hidden mb-3 relative group cursor-zoom-in bg-gray-50 border border-gray-100"
        onClick={() => onZoom(image.imageUrl, label)}
      >
        <img
          src={image.imageUrl}
          alt={`Portrait ${index + 1}`}
          className="w-full block"
          style={{ aspectRatio: '1', objectFit: 'contain', background: '#f8fafc' }}
        />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
          <ZoomIn className="w-7 h-7 text-white opacity-0 group-hover:opacity-80 transition-opacity drop-shadow" />
        </div>
      </div>

      {/* Export buttons */}
      <div className="mb-3">
        <ExportButtons
          svgContent={image.svgPreview}
          dxfUrl={image.dxfUrl}
          dxfFilename={image.dxfFilename || `portrait-${index + 1}.dxf`}
          svgWidthPx={image.realWidth ?? 500}
          svgHeightPx={image.realHeight ?? 500}
          showVector={showVector}
          onToggleVector={() => setShowVector(!showVector)}
          onMoreOptions={() => onDownload(image)}
          isRtl={isRtl}
        />
      </div>

      {/* Inline SVG viewer — opens below when "Vector" is toggled */}
      {showVector && (
        <div className="mb-3">
          <SvgViewer svgContent={image.svgPreview} />
        </div>
      )}

      {/* Dimensions */}
      <div className="grid grid-cols-2 gap-2 text-center">
        {[
          { v: image.realWidth ? (image.realWidth / 3.7795).toFixed(0) + ' mm' : '—', l: isRtl ? 'רוחב' : 'Width' },
          { v: image.realHeight ? (image.realHeight / 3.7795).toFixed(0) + ' mm' : '—', l: isRtl ? 'גובה' : 'Height' },
        ].map(({ v, l }, i) => (
          <div key={i} className="rounded-lg p-1.5 bg-gray-50 border border-gray-100">
            <p className="text-xs font-semibold text-purple-600">{v}</p>
            <p className="text-xs text-gray-400">{l}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
interface FaceDetectTabProps {
  onOpenAuth?: () => void;
  onInsufficientTokens?: () => void;
}

const STYLE_OPTIONS: { value: PortraitStyle; labelHe: string; labelEn: string; descHe: string; descEn: string }[] = [
  { value: "simple",   labelHe: "פשוט",   labelEn: "Simple",   descHe: "קו נקי, דומה מקסימלית לפנים", descEn: "Clean line, maximally faithful to face" },
  { value: "detailed", labelHe: "מפורט",  labelEn: "Detailed", descHe: "פרטים עשירים, דומה לפנים",   descEn: "Rich detail, faithful to face" },
];

export function FaceDetectTab({ onOpenAuth, onInsufficientTokens }: FaceDetectTabProps) {
  const { language } = useLanguage();
  const isRtl = language === "he";
  const { reportBug } = useBugReport();

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
  const [minGapMm, setMinGapMm] = useState<string>("1.5");
  const [portraitStyle, setPortraitStyle] = useState<PortraitStyle>("simple");
  const [dragOver, setDragOver] = useState(false);
  const [jobId, setJobId] = useState<string | null>(() => localStorage.getItem("face_detect_jobId"));
  const [currentStep, setCurrentStep] = useState<string>("");
  const [progressPct, setProgressPct] = useState(5);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
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
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    setImageFile(null);
    setImagePreviewPersisted(null);
    setStatus("idle");
    setResult(null);
    setErrorMsg("");
    setCurrentStep("");
    setProgressPct(5);
    setElapsedSeconds(0);
    setJobIdPersisted(null);
    localStorage.removeItem("face_detect_result");
  }, [setImagePreviewPersisted, setJobIdPersisted]);

  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startProgressTimer = useCallback(() => {
    // Smoothly advance progress bar from 5% to 85% over ~60 seconds
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    const startTime = Date.now();
    const TOTAL_MS = 60_000; // expected ~60s
    setElapsedSeconds(0);
    progressTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(85, 5 + (elapsed / TOTAL_MS) * 80);
      setProgressPct(Math.round(pct));
    }, 1000);
    // Separate elapsed seconds counter — independent of percentage
    elapsedTimerRef.current = setInterval(() => {
      setElapsedSeconds(s => s + 1);
    }, 1000);
  }, []);

  const startPolling = useCallback((jId: string) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    startProgressTimer();
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
          if (progressTimerRef.current) clearInterval(progressTimerRef.current);
          if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
          const faceResult: FaceResult = {
            images: data.result.images,
            faceDescription: data.result.faceDescription ?? "",
          };
          setResult(faceResult);
          localStorage.setItem("face_detect_result", JSON.stringify(faceResult));
          setStatus("success");
          setCurrentStep("");
          setProgressPct(100);
          setJobIdPersisted(null);
          refetchTokens();
          toast.success(isRtl ? "הפורטרט מוכן! לחץ הורד DXF" : "Portrait ready! Click Download DXF");
          if ("Notification" in window && Notification.permission === "granted") {
            new Notification(isRtl ? "✅ זיהוי פנים הושלם!" : "✅ Face Detection Complete!", {
              body: isRtl ? "הפורטרט שלך מוכן להורדה" : "Your portrait is ready for download",
              icon: "/favicon.ico",
            });
          }
        } else if (data.status === "error") {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          if (progressTimerRef.current) clearInterval(progressTimerRef.current);
          if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
          const isTokenError = data.error === "INSUFFICIENT_TOKENS" || data.error === "QUOTA_EXCEEDED";
          const msg = data.message || data.error || (isRtl ? "שגיאה בעיבוד" : "Processing error");
          setErrorMsg(msg);
          setStatus("error");
          setCurrentStep("");
          setJobIdPersisted(null);
          toast.error(msg);
          if (!isTokenError) reportBug({ errorType: "ai_failed", errorMessage: msg, feature: "face_detect" });
        } else if (data.status === "cancelled") {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          if (progressTimerRef.current) clearInterval(progressTimerRef.current);
          if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
          setStatus("idle");
          setCurrentStep("");
          setProgressPct(5);
          setElapsedSeconds(0);
          setJobIdPersisted(null);
        } else {
          // Update step label from server
          const stepMsg = isRtl ? (data.step || data.stepEn) : (data.stepEn || data.step);
          if (stepMsg) setCurrentStep(stepMsg);
          // Progress is handled by smooth timer above
        }
      } catch { /* network error, keep trying */ }
    }, 3000);
  }, [isRtl, refetchTokens, setJobIdPersisted, startProgressTimer]);

  useEffect(() => {
    const savedId = localStorage.getItem("face_detect_jobId");
    if (savedId) { setStatus("loading"); startPolling(savedId); }
    return () => { if (pollIntervalRef.current) clearInterval(pollIntervalRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCancel = useCallback(async () => {
    if (!jobId) return;
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    try {
      const res = await fetch(`/api/face-detect/cancel/${jobId}`, { method: "POST", credentials: "include" });
      const data = await res.json();
      if (data.cancelled) {
        toast.success(isRtl ? "העיבוד בוטל והאסימונים הוחזרו" : "Processing cancelled — tokens refunded");
        refetchTokens();
      }
    } catch { /* ignore */ }
    setStatus("idle");
    setProgressPct(5);
    setElapsedSeconds(0);
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
    setProgressPct(5);
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
        reader.onload = (e) => { const r = e.target?.result as string; previewRef.current = r; resolve(r); };
        reader.readAsDataURL(imageFile);
      });
    }
    setStatus("loading"); setResult(null); setErrorMsg(""); setCurrentStep(""); setProgressPct(5);
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
      formData.append("style", portraitStyle);
      const lwVal = parseFloat(lineweightMm);
      if (!isNaN(lwVal) && lwVal >= 0) formData.append("lineweightMm", String(lwVal));
      const gapVal = parseFloat(minGapMm);
      if (!isNaN(gapVal) && gapVal > 0) formData.append("minGapMm", String(gapVal));
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
      reportBug({ errorType: "ai_failed", errorMessage: msg, feature: "face_detect" });
    }
  };

  const canSubmit = !!(imageFile || imagePreview) && status !== "loading";

  return (
    <div className="space-y-4" dir={isRtl ? "rtl" : "ltr"}>
      {/* Upload area */}
      {(status === "idle" || status === "error") && !result && (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #e2e8f0', background: '#ffffff' }}>
          <div className="p-4">
            {/* Header */}
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: '#f3e8ff' }}>
                <UserCircle className="w-4 h-4 text-purple-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-800">
                  {isRtl ? "פורטרט ל-DXF" : "Portrait to DXF"}
                </h3>
                <p className="text-xs text-gray-500">
                  {isRtl ? "העלה תמונה עם פנים — ה-AI יצייר 3 פורטרטים לינארט" : "Upload a photo with faces — AI draws 3 portrait variations"}
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
                  <img src={imagePreview} alt="Preview" className="w-full rounded-xl object-contain" style={{ maxHeight: 280 }} />
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

            {/* Style selector */}
            <div className="mb-3">
              <p className="text-xs font-semibold text-gray-600 mb-2">
                {isRtl ? "בחר סגנון פורטרט:" : "Choose portrait style:"}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {STYLE_OPTIONS.map((opt, idx) => {
                  const isSelected = portraitStyle === opt.value;
                  const gradients = [
                    'linear-gradient(135deg, #7c3aed, #a855f7)',
                    'linear-gradient(135deg, #0d9488, #06b6d4)',
                    'linear-gradient(135deg, #6366f1, #818cf8)',
                    'linear-gradient(135deg, #d97706, #f59e0b)',
                  ];
                  const shadows = [
                    '0 3px 10px rgba(124,58,237,0.35)',
                    '0 3px 10px rgba(13,148,136,0.35)',
                    '0 3px 10px rgba(99,102,241,0.35)',
                    '0 3px 10px rgba(217,119,6,0.35)',
                  ];
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setPortraitStyle(opt.value)}
                      className="rounded-xl p-2.5 text-center transition-all hover:scale-105 active:scale-95"
                      style={isSelected ? {
                        background: gradients[idx % gradients.length],
                        color: 'white',
                        border: '2px solid transparent',
                        boxShadow: shadows[idx % shadows.length],
                        transform: 'scale(1.03)',
                      } : {
                        background: '#f8fafc',
                        color: '#374151',
                        border: '2px solid #e2e8f0',
                      }}
                    >
                      <p className="text-xs font-bold">
                        {isRtl ? opt.labelHe : opt.labelEn}
                      </p>
                      <p className="text-xs mt-0.5 leading-tight" style={{ opacity: isSelected ? 0.9 : 0.55 }}>
                        {isRtl ? opt.descHe : opt.descEn}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Advanced options */}
            <details className="mb-3">
              <summary className="text-xs font-medium text-gray-500 cursor-pointer select-none hover:text-gray-700">
                {isRtl ? "הגדרות מתקדמות" : "Advanced settings"}
              </summary>
              <div className="mt-2 space-y-2 pl-2">
                {/* Min gap */}
                <div className="flex items-center gap-2 flex-wrap">
                  <label className="text-xs font-medium text-gray-600 shrink-0">
                    {isRtl ? "מרווח בין קווים (מ'מ):" : "Line gap (mm):"}
                  </label>
                  <input
                    type="number" min="0.2" max="3" step="0.1"
                    placeholder="1.5"
                    value={minGapMm}
                    onChange={e => setMinGapMm(e.target.value)}
                    className="w-20 border border-border rounded px-2 py-1 text-xs text-center"
                  />
                  <span className="text-xs text-gray-400">{isRtl ? "(מומלץ 1.5 לקרסום V-bit)" : "(1.5 recommended for V-bit)"}</span>
                </div>
                {/* Lineweight */}
                <div className="flex items-center gap-2 flex-wrap">
                  <label className="text-xs font-medium text-gray-600 shrink-0">
                    {isRtl ? "עובי קו ב-DXF (מ'מ):" : "DXF lineweight (mm):"}
                  </label>
                  <input
                    type="number" min="0" max="2" step="0.05"
                    placeholder={isRtl ? "ברירת מחדל" : "default"}
                    value={lineweightMm}
                    onChange={e => setLineweightMm(e.target.value)}
                    className="w-20 border border-border rounded px-2 py-1 text-xs text-center"
                  />
                  <span className="text-xs text-gray-400">{isRtl ? "(0 = הדק ביותר)" : "(0 = hairline)"}</span>
                </div>
              </div>
            </details>

            {/* Tips */}
            <div className="rounded-lg p-3 mb-3" style={{ background: '#faf5ff', border: '1px solid #e9d5ff' }}>
              <p className="text-xs font-semibold text-purple-700 mb-1">
                {isRtl ? "טיפים לתוצאה הטובה ביותר:" : "Tips for best results:"}
              </p>
              <ul className="space-y-0.5 text-xs text-gray-600">
                <li className="flex gap-1.5"><span className="text-purple-400 shrink-0">•</span>{isRtl ? "תמונה ברורה עם פנים גלויות" : "Clear photo with visible face(s)"}</li>
                <li className="flex gap-1.5"><span className="text-purple-400 shrink-0">•</span>{isRtl ? "תאורה טובה, ללא חסימות" : "Good lighting, no obstructions"}</li>
                <li className="flex gap-1.5"><span className="text-purple-400 shrink-0">•</span>{isRtl ? "פנים צד, חצי פנים, או מלפנים" : "Side profile, 3/4 view, or front-facing"}</li>
              </ul>
            </div>

            {/* Submit button */}
            <button
              className="w-full font-bold text-base h-13 rounded-xl flex items-center justify-center gap-2 transition-all hover:opacity-90"
              style={{
                background: canSubmit ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'linear-gradient(135deg, #c4b5fd, #a5b4fc)',
                color: 'white',
                border: 'none',
                boxShadow: canSubmit ? '0 4px 14px rgba(99,102,241,0.4)' : 'none',
                cursor: canSubmit ? 'pointer' : 'not-allowed',
              }}
              disabled={!canSubmit}
              onClick={handleDetect}
              data-face-submit
            >
              <Scan className="w-4 h-4" />
              {isRtl ? "צור פורטרט DXF (4 אסימונים)" : "Create Portrait DXF (4 tokens)"}
            </button>
          </div>
        </div>
      )}

      {/* Loading state — simple scanning animation */}
      {status === "loading" && !result && (
        <AiProcessingAnimation
          elapsedSeconds={elapsedSeconds}
          currentStep={currentStep}
          imagePreview={imagePreview}
          jobId={jobId}
          onCancel={handleCancel}
          isRtl={isRtl}
          accentColor="#7c3aed"
          accentGradient="linear-gradient(135deg, #7c3aed, #c084fc)"
          featureLabel={isRtl ? "AI פורטרט" : "AI Portrait"}
        />
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
          {/* Header */}
          <div
            className="rounded-xl p-4"
            style={{ background: '#f5f3ff', border: '1px solid #e9d5ff' }}
          >
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-700">
                  {isRtl ? 'פורטרט מוכן — בחר סגנון' : 'Portrait ready — choose style'}
                </span>
              </div>
              <button
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg shrink-0"
                style={{ background: '#7c3aed', color: 'white', border: 'none' }}
                onClick={reset}
              >
                <UserCircle className="w-3.5 h-3.5" />
                {isRtl ? 'תמונה חדשה' : 'New photo'}
              </button>
            </div>
            {result.faceDescription && (
              <p className="text-xs mt-1 line-clamp-2 text-gray-500">
                <span className="font-medium text-purple-700">{isRtl ? 'תיאור AI: ' : 'AI description: '}</span>
                {result.faceDescription}
              </p>
            )}
          </div>

          {/* Before / After comparison panel */}
          {imagePreview && result.images.length > 0 && (
            <div
              className="rounded-xl overflow-hidden"
              style={{ border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}
            >
              <div className="flex items-center gap-2 px-4 py-2.5" style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <Eye className="w-3.5 h-3.5 text-gray-500" />
                <span className="text-xs font-semibold text-gray-600">{isRtl ? 'לפני ואחרי' : 'Before & After'}</span>
              </div>
              <div className="grid grid-cols-2 gap-0">
                <div className="relative" style={{ borderRight: '1px solid #e2e8f0' }}>
                  <div className="absolute top-2 left-2 z-10 text-xs font-bold px-2 py-0.5 rounded"
                    style={{ background: 'rgba(0,0,0,0.55)', color: 'white' }}>
                    {isRtl ? 'מקור' : 'Original'}
                  </div>
                  <img
                    src={imagePreview}
                    alt="original"
                    className="w-full block cursor-zoom-in"
                    style={{ aspectRatio: '1', objectFit: 'contain', background: '#f8fafc' }}
                    onClick={() => setZoomImg({ src: imagePreview, alt: isRtl ? 'תמונה מקורית' : 'Original' })}
                  />
                </div>
                <div className="relative">
                  <div className="absolute top-2 left-2 z-10 text-xs font-bold px-2 py-0.5 rounded"
                    style={{ background: 'rgba(124,58,237,0.85)', color: 'white' }}>
                    {isRtl ? 'וקטור' : 'Vector'}
                  </div>
                  <img
                    src={result.images[0].imageUrl}
                    alt="vector"
                    className="w-full block cursor-zoom-in"
                    style={{ aspectRatio: '1', objectFit: 'contain', background: '#ffffff' }}
                    onClick={() => setZoomImg({ src: result.images[0].imageUrl, alt: isRtl ? 'וקטור' : 'Vector' })}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Variation cards — grid like AiTraceTab */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {result.images.map((img, idx) => (
              <PortraitCard
                key={idx}
                image={img}
                index={idx}
                isRtl={isRtl}
                onDownload={setDownloadTarget}
                onZoom={(src, alt) => setZoomImg({ src, alt })}
              />
            ))}
          </div>

          {/* AI Refinement Panel */}
          <div className="rounded-xl p-4" style={{ background: '#faf5ff', border: '1px solid #e9d5ff' }}>
            <p className="text-xs font-bold text-purple-700 mb-3 flex items-center gap-1.5">
              <span>✨</span>
              {isRtl ? 'צייר מחדש עם AI' : 'Redraw with AI'}
            </p>
            {/* Quick style buttons */}
            <div className="flex gap-2 mb-3">
              {STYLE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => {
                    setPortraitStyle(opt.value);
                    setResult(null);
                    setStatus('idle');
                    setTimeout(() => {
                      const btn = document.querySelector('[data-face-submit]') as HTMLButtonElement;
                      if (btn) btn.click();
                    }, 100);
                  }}
                  className="flex-1 py-2 text-xs font-bold rounded-lg transition-all"
                  style={{
                    background: portraitStyle === opt.value ? '#7c3aed' : '#f3e8ff',
                    color: portraitStyle === opt.value ? 'white' : '#7c3aed',
                    border: 'none',
                  }}
                >
                  {isRtl ? opt.labelHe : opt.labelEn}
                  <span className="block text-xs font-normal opacity-75">{isRtl ? opt.descHe : opt.descEn}</span>
                </button>
              ))}
            </div>
            {/* Free text refinement */}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder={isRtl ? 'בקשה חופשית, למשל: יותר פרטים בשיער...' : 'Custom request, e.g.: more hair detail...'}
                className="flex-1 text-xs px-3 py-2 rounded-lg outline-none"
                style={{ background: 'white', border: '1px solid #e9d5ff', color: '#374151' }}
                id="portrait-custom-request"
                dir={isRtl ? 'rtl' : 'ltr'}
              />
              <button
                onClick={() => {
                  const input = document.getElementById('portrait-custom-request') as HTMLInputElement;
                  const customText = input?.value?.trim();
                  if (!customText) return;
                  // Store custom request and re-submit
                  sessionStorage.setItem('portrait_custom_request', customText);
                  setResult(null);
                  setStatus('idle');
                  setTimeout(() => {
                    const btn = document.querySelector('[data-face-submit]') as HTMLButtonElement;
                    if (btn) btn.click();
                  }, 100);
                }}
                className="px-3 py-2 text-xs font-bold rounded-lg transition-all"
                style={{ background: '#7c3aed', color: 'white', border: 'none', whiteSpace: 'nowrap' }}
              >
                {isRtl ? 'צייר' : 'Draw'}
              </button>
            </div>
          </div>

          {/* More variations + New image buttons */}
          <div className="flex gap-2">
            <button
              className="flex-1 py-2.5 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-1.5"
              style={{ background: '#7c3aed', color: 'white', border: 'none' }}
              onClick={() => {
                // Advance to next style and re-submit
                const currentStyle = result.images[0]?.style as PortraitStyle || portraitStyle;
                const styleValues = STYLE_OPTIONS.map(s => s.value as PortraitStyle);
                const nextStyle = styleValues[(styleValues.indexOf(currentStyle) + 1) % styleValues.length];
                setPortraitStyle(nextStyle);
                setResult(null);
                setStatus("idle");
                // Small delay to let state update, then auto-submit
                setTimeout(() => {
                  const btn = document.querySelector('[data-face-submit]') as HTMLButtonElement;
                  if (btn) btn.click();
                }, 100);
              }}
            >
              <Scan className="w-3.5 h-3.5" />
              {isRtl ? "צייר עוד" : "Draw More"}
            </button>
            <button
              className="flex-1 py-2.5 text-sm font-medium rounded-lg transition-all bg-gray-100 hover:bg-gray-200 text-gray-600 border border-gray-200"
              onClick={reset}
            >
              {isRtl ? "תמונה חדשה" : "New Photo"}
            </button>
          </div>
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

      {/* Scan line animation keyframe */}
      <style>{`
        @keyframes scanLine {
          0% { top: 10%; opacity: 0; }
          20% { opacity: 1; }
          80% { opacity: 1; }
          100% { top: 90%; opacity: 0; }
        }
      `}</style>
    </div>
  );
}

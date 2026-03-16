/**
 * AiSketchTab.tsx — Single clean outline sketch from photo
 * Generates ONE clean outer-contour sketch (no double lines, no fills)
 * Suitable for laser cutting, CNC engraving, coloring pages
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { useBugReport } from "@/hooks/useBugReport";
import { DxfDownloadDialog } from "@/components/DxfDownloadDialog";
import { ExportButtons } from "@/components/ExportButtons";
import {
  AlertCircle,
  ImageIcon,
  Wand2,
  CheckCircle2,
  Eye,
  ZoomIn,
  PenLine,
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
}

interface SketchResult {
  images: GeneratedImage[];
  objectDescription: string;
  suggestions: string[];
}

type Status = "idle" | "loading" | "success" | "error";

function SvgViewer({ svgContent }: { svgContent: string }) {
  return <SvgPanZoomViewer svgContent={svgContent} isRtl={true} />;
}

interface ImageCardProps {
  image: GeneratedImage;
  isRtl: boolean;
  onDownload: (image: GeneratedImage) => void;
  onZoom: (src: string, alt: string) => void;
  processingTime?: number | null;
}

function ImageCard({ image, isRtl, onDownload, onZoom, processingTime }: ImageCardProps) {
  const [showVector, setShowVector] = useState(false);
  const { t } = useLanguage();

  return (
    <div
      className="rounded-xl p-4"
      style={{ background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
          {isRtl ? "סקיצה נקייה" : "Clean Sketch"}
        </span>
        <span className="text-xs text-gray-400">{image.segmentCount.toLocaleString()} {t("linesUnit")}</span>
      </div>

      {/* AI Drawing preview */}
      <div
        className="rounded-lg overflow-hidden mb-3 relative group cursor-zoom-in bg-gray-50 border border-gray-100"
        onClick={() => onZoom(image.imageUrl, isRtl ? "סקיצה" : "Sketch")}
      >
        <img
          src={image.imageUrl}
          alt="Sketch"
          className="w-full block"
          style={{ aspectRatio: '1', objectFit: 'contain', background: '#f8fafc' }}
        />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
          <ZoomIn className="w-7 h-7 text-white opacity-0 group-hover:opacity-80 transition-opacity drop-shadow" />
        </div>
        {processingTime != null && (
          <span
            className="absolute bottom-1.5 left-1.5 text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(0,0,0,0.55)', color: '#fff', backdropFilter: 'blur(4px)', fontSize: '10px' }}
          >
            {Math.floor(processingTime / 60) > 0
              ? `${Math.floor(processingTime / 60)}:${String(processingTime % 60).padStart(2,'0')} ${isRtl ? 'דק\'' : 'min'}`
              : `${processingTime}${isRtl ? 'ש\'' : 's'}`}
          </span>
        )}
      </div>

      {/* Export buttons */}
      <div className="mb-3">
        <ExportButtons
          svgContent={image.svgPreview}
          dxfUrl={image.dxfUrl}
          dxfFilename={image.dxfFilename || `sketch.dxf`}
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
        {[
          { v: image.realWidth ? (image.realWidth / 3.7795).toFixed(0) + ' mm' : '—', l: isRtl ? 'רוחב' : 'Width' },
          { v: image.realHeight ? (image.realHeight / 3.7795).toFixed(0) + ' mm' : '—', l: isRtl ? 'גובה' : 'Height' },
        ].map(({ v, l }, i) => (
          <div key={i} className="rounded-lg p-1.5 bg-gray-50 border border-gray-100">
            <p className="text-xs font-semibold text-amber-600">{v}</p>
            <p className="text-xs text-gray-400">{l}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

interface AiSketchTabProps { onOpenAuth: () => void; onInsufficientTokens?: () => void; }

export function AiSketchTab({ onOpenAuth, onInsufficientTokens }: AiSketchTabProps) {
  const { t, isRtl, language } = useLanguage();
  const { refetch: refetchTokens } = trpc.tokens.balance.useQuery(undefined, { enabled: false });
  const { reportBug } = useBugReport();
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(() => localStorage.getItem("ai_sketch_imagePreview"));
  const [description, setDescription] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [status, setStatus] = useState<Status>(() => {
    if (localStorage.getItem("ai_sketch_jobId")) return "idle";
    if (localStorage.getItem("ai_sketch_result")) return "success";
    return "idle";
  });
  const [result, setResult] = useState<SketchResult | null>(() => {
    if (!localStorage.getItem("ai_sketch_jobId")) {
      try {
        const cached = localStorage.getItem("ai_sketch_result");
        if (cached) return JSON.parse(cached) as SketchResult;
      } catch (_) { /* ignore */ }
    }
    return null;
  });
  const [errorMsg, setErrorMsg] = useState("");
  const [downloadTarget, setDownloadTarget] = useState<GeneratedImage | null>(null);
  const [zoomImg, setZoomImg] = useState<{ src: string; alt: string } | null>(null);
  const [jobId, setJobId] = useState<string | null>(() => localStorage.getItem("ai_sketch_jobId"));
  const [tryAgainUrl, setTryAgainUrl] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<string>("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [processingTime, setProcessingTime] = useState<number | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<string | null>(localStorage.getItem("ai_sketch_imagePreview"));

  const setJobIdPersisted = useCallback((id: string | null) => {
    if (id) localStorage.setItem("ai_sketch_jobId", id);
    else localStorage.removeItem("ai_sketch_jobId");
    setJobId(id);
  }, []);

  const saveResultToCache = useCallback((r: SketchResult) => {
    try { localStorage.setItem("ai_sketch_result", JSON.stringify(r)); } catch (_) { /* ignore */ }
  }, []);

  const clearResultCache = useCallback(() => {
    localStorage.removeItem("ai_sketch_result");
  }, []);

  const setImagePreviewPersisted = useCallback((preview: string | null) => {
    if (preview) localStorage.setItem("ai_sketch_imagePreview", preview);
    else localStorage.removeItem("ai_sketch_imagePreview");
    previewRef.current = preview;
    setImagePreview(preview);
  }, []);

  const startPolling = useCallback((id: string) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/ai-sketch/job/${id}`, { credentials: "include" });
        const data = await res.json();
        if (data.status === "done") {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
          const sketchResult = data.result as SketchResult;
          setResult(sketchResult);
          saveResultToCache(sketchResult);
          setStatus("success");
          setCurrentStep("");
          setProcessingTime(elapsedSeconds > 0 ? elapsedSeconds : null);
          setElapsedSeconds(0);
          setJobIdPersisted(null);
          refetchTokens();
          const successMsg = isRtl ? `הסקיצה מוכנה! לחץ הורד DXF` : `Sketch ready! Click Download DXF`;
          toast.success(successMsg);
          if (document.hidden && "Notification" in window && Notification.permission === "granted") {
            new Notification(isRtl ? "AI סקיצה מוכנה" : "AI Sketch Ready", {
              body: successMsg,
              icon: "/favicon.ico",
            });
          }
        } else if (data.status === "error") {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          const isTokenError = data.error === "INSUFFICIENT_TOKENS" || data.error === "QUOTA_EXCEEDED";
          const msg = isTokenError
            ? (data.message || t("processingError"))
            : t("jobErrorRetry");
          setErrorMsg(msg);
          setStatus("error");
          setCurrentStep("");
          setElapsedSeconds(0);
          if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
          setJobIdPersisted(null);
          if (!isTokenError) refetchTokens();
          toast.error(msg);
          if (!isTokenError) reportBug({ errorType: "ai_failed", errorMessage: msg, feature: "ai_sketch" });
        } else if (data.status === "cancelled") {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
          setStatus("idle");
          setCurrentStep("");
          setElapsedSeconds(0);
          setJobIdPersisted(null);
        } else if (data.step || data.stepEn) {
          const stepMsg = isRtl ? (data.step || data.stepEn) : (data.stepEn || data.step);
          if (stepMsg) setCurrentStep(stepMsg);
        }
      } catch (_) { /* network error, keep trying */ }
    }, 3000);
  }, [isRtl, refetchTokens, setJobIdPersisted, elapsedSeconds, saveResultToCache, t, reportBug]);

  useEffect(() => {
    const savedId = localStorage.getItem("ai_sketch_jobId");
    if (savedId) {
      setStatus("loading");
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => setElapsedSeconds(s => s + 1), 1000);
      startPolling(savedId);
    }
    // Handle "Try Again" from history
    const tryAgainRaw = sessionStorage.getItem("tryAgainSketchItem");
    if (tryAgainRaw) {
      sessionStorage.removeItem("tryAgainSketchItem");
      try {
        const tryAgainData = JSON.parse(tryAgainRaw) as { sourceImageUrl: string; description?: string | null };
        if (tryAgainData.sourceImageUrl) {
          setImagePreviewPersisted(tryAgainData.sourceImageUrl);
          if (tryAgainData.description) setDescription(tryAgainData.description);
          setTryAgainUrl(tryAgainData.sourceImageUrl);
        }
      } catch (_) { /* ignore */ }
    }
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCancel = useCallback(async () => {
    if (!jobId) return;
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setElapsedSeconds(0);
    try {
      const res = await fetch(`/api/ai-sketch/cancel/${jobId}`, { method: "POST", credentials: "include" });
      const data = await res.json();
      if (data.cancelled) { toast.success(t("processingCancelled")); refetchTokens(); }
    } catch (_) { /* ignore */ }
    setStatus("idle");
    setJobIdPersisted(null);
  }, [jobId, refetchTokens, setJobIdPersisted, t]);

  const handleFile = useCallback((file: File) => {
    const allowed = ["image/png", "image/jpeg", "image/bmp", "image/webp", "image/gif"];
    if (!allowed.includes(file.type)) { toast.error(t("unsupportedFormat")); return; }
    if (file.size > 16 * 1024 * 1024) { toast.error(t("fileTooLarge16")); return; }
    setImageFile(file);
    setResult(null);
    clearResultCache();
    setStatus("idle");
    setErrorMsg("");
    setCurrentStep("");
    setJobIdPersisted(null);
    setTryAgainUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
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
  }, [t, setImagePreviewPersisted, setJobIdPersisted, clearResultCache]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0]; if (file) handleFile(file);
  }, [handleFile]);

  const handleSketch = async () => {
    if (!imageFile && !previewRef.current) return;

    let previewUrl = previewRef.current;
    if (imageFile && !previewUrl) {
      previewUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const result = e.target?.result as string;
          previewRef.current = result;
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
        const resp = await fetch(previewUrl);
        const blob = await resp.blob();
        formData.append("image", blob, "image.jpg");
      }
      if (description.trim()) formData.append("description", description.trim());
      formData.append("lang", language);

      const res = await fetch("/api/ai-sketch", { method: "POST", body: formData, credentials: "include" });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === "UNAUTHORIZED") { onOpenAuth(); setStatus("idle"); return; }
        if (data.error === "QUOTA_EXCEEDED" || data.error === "INSUFFICIENT_TOKENS") {
          const msg = language === "he" ? (data.message || t("quotaExceeded")) : (data.messageEn || data.message || t("quotaExceeded"));
          toast.error(msg); setErrorMsg(msg); setStatus("error"); refetchTokens();
          if (onInsufficientTokens) onInsufficientTokens();
          return;
        }
        throw new Error(isRtl ? (data.message || data.error) : (data.messageEn || data.error || "Error"));
      }
      if (data.jobId) {
        setJobIdPersisted(data.jobId);
        setElapsedSeconds(0);
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => setElapsedSeconds(s => s + 1), 1000);
        startPolling(data.jobId);
        if ("Notification" in window && Notification.permission === "default") {
          setTimeout(() => Notification.requestPermission(), 3000);
        }
      } else {
        setResult(data as SketchResult);
        setStatus("success");
        refetchTokens();
        toast.success(isRtl ? `הסקיצה מוכנה!` : `Sketch ready!`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (t("processingError"));
      setErrorMsg(msg); setStatus("error"); toast.error(msg);
      reportBug({ errorType: "ai_failed", errorMessage: msg, feature: "ai_sketch" });
    }
  };

  const reset = () => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    setImageFile(null); setImagePreviewPersisted(null); setResult(null);
    clearResultCache();
    setStatus("idle"); setErrorMsg(""); setDescription("");
    setJobIdPersisted(null); setTryAgainUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Amber color scheme for sketch
  const accentColor = "#d97706";
  const accentGrad = "linear-gradient(135deg, #d97706, #f59e0b)";
  const accentLight = "#fffbeb";
  const accentBorder = "#fde68a";

  return (
    <>
      {zoomImg && (
        <div
          className="fixed inset-0 z-50 bg-black/85 flex flex-col"
          onClick={() => setZoomImg(null)}
        >
          <button
            onClick={() => setZoomImg(null)}
            className="absolute top-4 right-4 z-10 w-12 h-12 rounded-full bg-white/20 hover:bg-white/40 active:bg-white/60 flex items-center justify-center text-white text-2xl font-bold shadow-lg"
            aria-label="Close"
          >✕</button>
          <div className="flex-1 flex items-center justify-center overflow-hidden p-6 pt-16">
            <img
              src={zoomImg.src}
              alt={zoomImg.alt}
              style={{ maxWidth: "92vw", maxHeight: "82vh", objectFit: "contain" }}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          <p className="text-center text-sm text-white/50 pb-4 shrink-0">{t("tapToClose")}</p>
        </div>
      )}
      {downloadTarget && (
        <DxfDownloadDialog
          open={!!downloadTarget} onClose={() => setDownloadTarget(null)}
          svgContent={downloadTarget.svgPreview} dxfUrl={downloadTarget.dxfUrl}
          defaultFilename={downloadTarget.dxfFilename ?? `ai-sketch-${Date.now()}.dxf`}
          segmentCount={downloadTarget.segmentCount}
          svgWidth={downloadTarget.realWidth ?? 500}
          svgHeight={downloadTarget.realHeight ?? 500}
        />
      )}

      <div className="flex flex-col gap-5">
        {/* Upload area */}
        <div
          className="rounded-xl p-5 relative"
          style={{ background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', display: status === 'loading' ? 'none' : undefined }}
        >
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: accentLight }}>
              <PenLine className="w-3.5 h-3.5" style={{ color: accentColor }} />
            </div>
            <h2 className="font-semibold text-sm text-gray-700">
              {isRtl ? "AI סקיצה — קו חיצוני נקי" : "AI Sketch — Clean Single Outline"}
            </h2>
          </div>

          <input
            ref={fileInputRef}
            id="ai-sketch-file-input"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />

          {imagePreview ? (
            <div
              className="flex items-center gap-3 mb-3 p-3 rounded-xl"
              style={{ background: accentLight, border: `1px solid ${accentBorder}` }}
            >
              <img src={imagePreview} alt="Preview" className="w-16 h-16 object-contain rounded-lg shrink-0 border border-gray-200 bg-white" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate text-gray-700">{imageFile?.name}</p>
                <p className="text-xs mb-2 text-gray-400">{t("imageSelectedLabel")}</p>
                <label
                  htmlFor="ai-sketch-file-input"
                  className="text-xs font-medium cursor-pointer"
                  style={{ color: accentColor }}
                >
                  {t("imageSelected")}
                </label>
              </div>
            </div>
          ) : (
            <div className="mb-3 space-y-2">
              <label
                htmlFor="ai-sketch-file-input"
                className="w-full flex items-center justify-center gap-3 py-5 rounded-xl transition-colors cursor-pointer"
                style={{ border: `2px dashed ${accentBorder}`, background: accentLight }}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
              >
                <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: '#fef3c7' }}>
                  <ImageIcon className="w-5 h-5" style={{ color: accentColor }} />
                </div>
                <div className="text-start">
                  <p className="font-semibold text-sm text-gray-700">
                    {isRtl ? "העלה תמונה" : "Upload Image"}
                  </p>
                  <p className="text-xs text-gray-400">
                    {isRtl ? "PNG, JPG, WEBP עד 16MB" : "PNG, JPG, WEBP up to 16MB"}
                  </p>
                </div>
              </label>
            </div>
          )}

          {/* Optional description */}
          <div className="mb-3">
            <label className="text-xs font-medium text-gray-500 mb-1 block">
              {isRtl ? "תיאור (אופציונלי) — מה תרצה לסקצ'?" : "Description (optional) — what to sketch?"}
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={isRtl ? "לדוגמה: רק הגוף של האריה, ללא הרקע" : "e.g. only the lion body, no background"}
              className="w-full text-sm rounded-lg px-3 py-2 bg-gray-50 border border-gray-200 text-gray-800"
              dir={isRtl ? "rtl" : "ltr"}
            />
          </div>

          <button
            className="w-full font-bold text-base h-13 rounded-xl flex items-center justify-center gap-2 transition-all hover:opacity-90"
            style={{
              background: ((!imageFile && !imagePreview) || status === "loading") ? '#fde68a' : accentGrad,
              color: ((!imageFile && !imagePreview) || status === "loading") ? '#92400e' : 'white',
              border: 'none',
              boxShadow: ((!imageFile && !imagePreview) || status === "loading") ? 'none' : '0 4px 14px rgba(217,119,6,0.4)',
              cursor: ((!imageFile && !imagePreview) || status === "loading") ? 'not-allowed' : 'pointer',
            }}
            disabled={(!imageFile && !imagePreview) || status === "loading"}
            onClick={handleSketch}
          >
            {status === "loading" ? (
              <><div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />{t("aiAnalyzing")}</>
            ) : (
              <><PenLine className="w-4 h-4" />{isRtl ? "צור סקיצה נקייה" : "Create Clean Sketch"}</>
            )}
          </button>
        </div>

        {/* Loading */}
        {status === "loading" && (
          <div
            className="rounded-xl overflow-hidden"
            style={{ background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}
          >
            {imagePreview && (
              <div className="relative overflow-hidden" style={{ maxHeight: 280 }}>
                <img
                  src={imagePreview}
                  alt="Processing"
                  className="w-full object-contain block"
                  style={{ maxHeight: 280, filter: 'brightness(0.85)' }}
                />
                <div
                  className="absolute left-0 right-0 pointer-events-none"
                  style={{
                    top: 0,
                    height: '3px',
                    background: `linear-gradient(90deg, transparent, ${accentColor}, #fbbf24, ${accentColor}, transparent)`,
                    boxShadow: `0 0 12px 4px rgba(217,119,6,0.6)`,
                    animation: 'scanLine 2s ease-in-out infinite',
                  }}
                />
                <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold" style={{ background: `rgba(217,119,6,0.9)`, color: 'white' }}>
                  <div className="w-3 h-3 rounded-full border-2 border-white/40 border-t-white" style={{ animation: 'spin 0.8s linear infinite' }} />
                  {isRtl ? 'AI מצייר סקיצה...' : 'AI sketching...'}
                </div>
              </div>
            )}
            <div className="p-5 flex flex-col items-center gap-3 text-center">
              {!imagePreview && (
                <div className="relative w-14 h-14">
                  <div className="absolute inset-0 rounded-full" style={{ border: `3px solid ${accentBorder}`, borderTopColor: accentColor, animation: 'spin 1s linear infinite' }} />
                  <PenLine className="absolute inset-0 m-auto w-5 h-5" style={{ color: accentColor }} />
                </div>
              )}
              <div className="w-full max-w-xs">
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: accentBorder }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      background: accentGrad,
                      width: `${Math.min(95, (elapsedSeconds / 60) * 100)}%`,
                      transition: 'width 1s linear',
                    }}
                  />
                </div>
              </div>
              <p className="font-semibold text-sm" style={{ color: accentColor }}>
                {currentStep || (isRtl ? "מנתח תמונה ומצייר סקיצה..." : "Analyzing image and drawing sketch...")}
              </p>
              <p className="text-xs text-gray-400">
                {isRtl ? `${elapsedSeconds}ש׳ — בדרך כלל 30-60 שניות` : `${elapsedSeconds}s — usually 30-60 seconds`}
              </p>
              <button
                className="text-xs px-4 py-2 rounded-lg font-medium bg-gray-100 hover:bg-gray-200 text-gray-600 border border-gray-200"
                onClick={handleCancel}
              >
                {isRtl ? "ביטול" : "Cancel"}
              </button>
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
            <p className="font-semibold text-red-600">{t("processingError")}</p>
            <p className="text-sm text-gray-500">{errorMsg}</p>
            {!errorMsg?.includes("אסימונים") && !errorMsg?.toLowerCase().includes("token") && !errorMsg?.toLowerCase().includes("quota") && (
              <p className="text-xs font-medium text-green-600 bg-green-50 px-3 py-1 rounded-full">
                ✓ {t("tokensRefunded")}
              </p>
            )}
            <div className="flex gap-2 flex-wrap justify-center">
              <button
                className="text-sm px-4 py-2 rounded-lg font-medium bg-gray-100 hover:bg-gray-200 text-gray-600 border border-gray-200"
                onClick={reset}
              >{t("tryAgain")}</button>
              {errorMsg && (errorMsg.includes("אסימונים") || errorMsg.toLowerCase().includes("token")) && (
                <button
                  className="text-sm px-4 py-2 rounded-lg font-semibold text-white"
                  style={{ background: accentColor, border: 'none' }}
                  onClick={() => window.location.href = "/tokens"}
                >
                  {t("buyTokens")}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Result */}
        {status === "success" && result && (
          <>
            <div
              className="rounded-xl p-4"
              style={{ background: accentLight, border: `1px solid ${accentBorder}` }}
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" style={{ color: accentColor }} />
                  <span className="font-semibold text-sm text-gray-700">
                    {isRtl ? "הסקיצה מוכנה!" : "Sketch ready!"}
                  </span>
                </div>
                <label
                  htmlFor="ai-sketch-file-input"
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all shrink-0 cursor-pointer text-white"
                  style={{ background: accentColor, border: 'none' }}
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  {t("changeImage")}
                </label>
              </div>
              {result.objectDescription && (
                <p className="text-xs mt-1 line-clamp-2 text-gray-500">
                  <span className="font-medium" style={{ color: accentColor }}>{t("aiDescriptionLabel")}</span>
                  {result.objectDescription}
                </p>
              )}
            </div>

            {/* Before / After */}
            {(imagePreview || tryAgainUrl) && result.images.length > 0 && (
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
                    <div className="absolute top-2 left-2 z-10 text-xs font-bold px-2 py-0.5 rounded" style={{ background: 'rgba(0,0,0,0.55)', color: 'white' }}>
                      {isRtl ? 'מקור' : 'Original'}
                    </div>
                    <img
                      src={imagePreview || tryAgainUrl || ''}
                      alt="original"
                      className="w-full block cursor-zoom-in"
                      style={{ aspectRatio: '1', objectFit: 'contain', background: '#f8fafc' }}
                      onClick={() => setZoomImg({ src: imagePreview || tryAgainUrl || '', alt: isRtl ? 'תמונה מקורית' : 'Original' })}
                    />
                  </div>
                  <div className="relative">
                    <div className="absolute top-2 left-2 z-10 text-xs font-bold px-2 py-0.5 rounded text-white" style={{ background: `rgba(217,119,6,0.85)` }}>
                      {isRtl ? 'סקיצה' : 'Sketch'}
                    </div>
                    <img
                      src={result.images[0].imageUrl}
                      alt="sketch"
                      className="w-full block cursor-zoom-in"
                      style={{ aspectRatio: '1', objectFit: 'contain', background: '#f8fafc' }}
                      onClick={() => setZoomImg({ src: result.images[0].imageUrl, alt: isRtl ? 'סקיצה' : 'Sketch' })}
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4">
              {result.images.map((image, idx) => (
                <ImageCard
                  key={idx}
                  image={image}
                  isRtl={isRtl}
                  onDownload={setDownloadTarget}
                  onZoom={(src, alt) => setZoomImg({ src, alt })}
                  processingTime={processingTime}
                />
              ))}
            </div>

            <button
              className="w-full py-2.5 text-sm font-medium rounded-lg transition-all bg-gray-100 hover:bg-gray-200 text-gray-600 border border-gray-200"
              onClick={reset}
            >
              {isRtl ? "סקיצה חדשה" : "New Sketch"}
            </button>
          </>
        )}

        {/* Tips */}
        <div
          className="rounded-xl p-4"
          style={{ background: accentLight, border: `1px solid ${accentBorder}` }}
        >
          <h3 className="font-semibold text-sm mb-2" style={{ color: accentColor }}>
            {isRtl ? "טיפים לסקיצה מוצלחת" : "Tips for best sketch results"}
          </h3>
          <ul className="space-y-1.5 text-sm text-gray-600">
            <li className="flex gap-2"><span className="shrink-0" style={{ color: accentColor }}>•</span><span>{isRtl ? "תמונה ברקע לבן/בהיר תיתן תוצאה הכי נקייה" : "White/light background gives the cleanest result"}</span></li>
            <li className="flex gap-2"><span className="shrink-0" style={{ color: accentColor }}>•</span><span>{isRtl ? "מתאים לאובייקטים פשוטים: לוגו, חיה, כלי, מוצר" : "Best for simple objects: logo, animal, tool, product"}</span></li>
            <li className="flex gap-2"><span className="shrink-0" style={{ color: accentColor }}>•</span><span>{isRtl ? "מייצר קו חיצוני אחד בלבד — מושלם לחריטת לייזר" : "Generates one single outline — perfect for laser engraving"}</span></li>
          </ul>
        </div>
      </div>
    </>
  );
}

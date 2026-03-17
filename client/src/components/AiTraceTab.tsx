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
import { useBugReport } from "@/hooks/useBugReport";
import { DxfDownloadDialog } from "@/components/DxfDownloadDialog";
import { ExportButtons } from "@/components/ExportButtons";
import { AiProcessingAnimation } from "@/components/AiProcessingAnimation";
import { SuccessOverlay } from "@/components/SuccessConfetti";
import {
  Download,
  AlertCircle,
  ImageIcon,
  Scan,
  Eye,
  ZoomIn,
  Wand2,
  CheckCircle2,
  X,
  FileText,
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

interface TraceResult {
  images: GeneratedImage[];
  objectDescription: string;
  suggestions: string[];
}

type Status = "idle" | "loading" | "success" | "error";

const VARIATION_LABELS = ["פשוט", "מפורט", "דקורטיבי"];
const VARIATION_LABELS_EN = ["Simple", "Detailed", "Decorative"];

function SvgViewer({ svgContent }: { svgContent: string }) {
  return <SvgPanZoomViewer svgContent={svgContent} isRtl={true} />;
}

interface ImageCardProps {
  image: GeneratedImage;
  index: number;
  isRtl: boolean;
  onDownload: (image: GeneratedImage) => void;
  onZoom: (src: string, alt: string) => void;
  processingTime?: number | null;
}

function ImageCard({ image, index, isRtl, onDownload, onZoom, processingTime }: ImageCardProps) {
  const [showVector, setShowVector] = useState(false);
  const { t } = useLanguage();
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
          <span className="text-xs text-gray-400">{image.segmentCount.toLocaleString()} {t("linesUnit")}</span>
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

interface AiTraceTabProps { onOpenAuth: () => void; onInsufficientTokens?: () => void; }

export function AiTraceTab({ onOpenAuth, onInsufficientTokens }: AiTraceTabProps) {
  const { t, isRtl, language } = useLanguage();
  const { refetch: refetchTokens } = trpc.tokens.balance.useQuery(undefined, { enabled: false });
  const { reportBug } = useBugReport();
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
  const [isUnclearImage, setIsUnclearImage] = useState(false);
  const [unclearDescription, setUnclearDescription] = useState("");
  const [downloadTarget, setDownloadTarget] = useState<GeneratedImage | null>(null);
  const [zoomImg, setZoomImg] = useState<{ src: string; alt: string } | null>(null);
  // Detail level: 0 = simple (default), 1 = detailed
  const [detailLevel, setDetailLevel] = useState<0 | 1>(0);
  const [lineweightMm, setLineweightMm] = useState<string>(""); // empty = default
  const [dragOver, setDragOver] = useState(false);
  const [fullImageMode, setFullImageMode] = useState(false);
  const [jobId, setJobId] = useState<string | null>(() => localStorage.getItem("ai_trace_jobId"));
  const [tryAgainUrl, setTryAgainUrl] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<string>("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [processingTime, setProcessingTime] = useState<number | null>(null); // seconds taken for last job
  const [showSuccessOverlay, setShowSuccessOverlay] = useState(false);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // previewRef holds the latest preview URL without causing re-renders when read inside handleTrace
  const previewRef = useRef<string | null>(localStorage.getItem("ai_trace_imagePreview"));

  const setJobIdPersisted = useCallback((id: string | null) => {
    if (id) {
      localStorage.setItem("ai_trace_jobId", id);
      // Save job start time so elapsed counter is accurate after browser close/reopen
      if (!localStorage.getItem("ai_trace_jobStartMs")) {
        localStorage.setItem("ai_trace_jobStartMs", String(Date.now()));
      }
    } else {
      localStorage.removeItem("ai_trace_jobId");
      localStorage.removeItem("ai_trace_jobStartMs");
    }
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
          if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
          const traceResult = data.result as TraceResult;
          setResult(traceResult);
          saveResultToCache(traceResult);
          setStatus("success");
          setShowSuccessOverlay(true);
          setCurrentStep("");
          setProcessingTime(elapsedSeconds > 0 ? elapsedSeconds : null);
          setElapsedSeconds(0);
          setJobIdPersisted(null);
          refetchTokens();
          const successMsg = isRtl ? `העיצוב מוכן! לחץ הורד DXF` : `Design ready! Click Download DXF`;
          toast.success(successMsg);
          // Push notification when page is hidden (user left the browser)
          if (document.hidden && "Notification" in window && Notification.permission === "granted") {
            new Notification(t("aiOutlineComplete"), {
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
          const isTokenError = data.error === "INSUFFICIENT_TOKENS" || data.error === "QUOTA_EXCEEDED";
          const isUnclear = data.errorCode === "UNCLEAR_IMAGE";
          const msg = isTokenError
            ? (data.message || t("processingError"))
            : isUnclear
              ? (data.error || (isRtl ? "התמונה לא ברורה" : "Image unclear"))
              : t("jobErrorRetry");
          setErrorMsg(msg);
          setIsUnclearImage(isUnclear);
          setStatus("error");
          setCurrentStep("");
          setElapsedSeconds(0);
          if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
          setJobIdPersisted(null);
          if (!isTokenError) refetchTokens(); // Refresh balance to show refunded tokens
          if (!isUnclear) toast.error(msg);
          if (!isTokenError && !isUnclear) reportBug({ errorType: "ai_failed", errorMessage: msg, feature: "ai_trace" });
        } else if (data.status === "cancelled") {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
          setStatus("idle");
          setCurrentStep("");
          setElapsedSeconds(0);
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
      // Restore elapsed seconds from saved start time (survives browser close/reopen)
      const savedStartMs = parseInt(localStorage.getItem("ai_trace_jobStartMs") ?? "0", 10);
      const alreadyElapsed = savedStartMs > 0 ? Math.floor((Date.now() - savedStartMs) / 1000) : 0;
      setElapsedSeconds(alreadyElapsed);
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => setElapsedSeconds(s => s + 1), 1000);
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
      const res = await fetch(`/api/ai-trace/cancel/${jobId}`, { method: "POST", credentials: "include" });
      const data = await res.json();
      if (data.cancelled) {
        toast.success(t("processingCancelled"));
        refetchTokens();
      }
    } catch (_) { /* ignore */ }
    setStatus("idle");
    setJobIdPersisted(null);
  }, [jobId, isRtl, refetchTokens, setJobIdPersisted]);

  const handleFile = useCallback((file: File) => {
    const allowed = ["image/png", "image/jpeg", "image/bmp", "image/webp", "image/gif"];
    if (!allowed.includes(file.type)) { toast.error(t("unsupportedFormat")); return; }
    if (file.size > 16 * 1024 * 1024) { toast.error(t("fileTooLarge16")); return; }
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

  const handleTrace = async (overrideFocusText?: string) => {
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
      const effectiveFocusText = overrideFocusText !== undefined ? overrideFocusText : focusText;
      if (effectiveFocusText.trim()) formData.append("focusText", effectiveFocusText.trim());
      formData.append("lang", language);
      formData.append("landscapeMode", fullImageMode ? "true" : "false");
      formData.append("variationIndex", String(detailLevel));
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
        // Reset start time for new job before calling setJobIdPersisted
        localStorage.removeItem("ai_trace_jobStartMs");
        setJobIdPersisted(data.jobId);
        setElapsedSeconds(0);
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => setElapsedSeconds(s => s + 1), 1000);
        startPolling(data.jobId);
        // Request push notification permission so we can notify when done
        if ("Notification" in window && Notification.permission === "default") {
          setTimeout(() => Notification.requestPermission(), 3000);
        }
      } else {
        // Legacy direct response
        setResult(data as TraceResult);
        setStatus("success");
        refetchTokens();
        toast.success(isRtl ? `העיצוב מוכן! לחץ הורד DXF` : `Design ready! Click Download DXF`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (t("processingError"));
      setErrorMsg(msg); setStatus("error"); toast.error(msg);
      reportBug({ errorType: "ai_failed", errorMessage: msg, feature: "ai_trace" });
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
      formData.append("lang", language);
      formData.append("landscapeMode", fullImageMode ? "true" : "false");
      formData.append("variationIndex", String(detailLevel));
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
      const msg = err instanceof Error ? err.message : (t("processingError"));
      setErrorMsg(msg); setStatus("error"); toast.error(msg);
      reportBug({ errorType: "ai_failed", errorMessage: msg, feature: "ai_trace" });
    }
  };

  const reset = () => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    setImageFile(null); setImagePreviewPersisted(null); setResult(null);
    setStatus("idle"); setErrorMsg(""); setFocusText(""); setCustomImprovement("");
    setIsUnclearImage(false); setUnclearDescription("");
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
            {t("tapToClose")}
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
                  <p className="text-xs mb-2 text-gray-400">{t("imageSelectedLabel")}</p>
                  <label
                    htmlFor="ai-trace-file-input"
                    className="text-xs font-medium text-teal-600 hover:text-teal-800 cursor-pointer"
                  >
                    {t("imageSelected")}
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
                    <p className="font-semibold text-sm text-teal-700">{t("choosePhoto")}</p>
                    <p className="text-xs text-gray-400">{t("fromGalleryOrNew")}</p>
                  </div>
                </label>
                <p className="hidden sm:block text-xs text-center text-gray-400">
                  {t("orDragDrop")}
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
                  <span>{t("objectMode")}</span>
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
                  <span>{t("fullImageMode")}</span>
                </button>
              </div>
              <p className="text-xs mt-1 px-1 text-gray-400">
                {fullImageMode
                  ? (t("fullImageDesc"))
                  : (t("objectDesc"))}
              </p>
            </div>

            {/* Focus text — what to draw */}
            <div className="mb-3">
              <label className="block text-xs font-semibold mb-1 text-gray-500">
                {t("whatToDraw")}
              </label>
              <input
                type="text"
                value={focusText}
                onChange={(e) => setFocusText(e.target.value)}
                placeholder={t("whatToDrawPlaceholder")}
                className="w-full text-sm rounded-lg px-3 py-2 bg-gray-50 border border-gray-200 text-gray-800"
                style={{ textAlign: isRtl ? "right" : "left" }}
                dir={isRtl ? "rtl" : "ltr"}
              />
            </div>
            <input type="hidden" value={description} onChange={(e) => setDescription(e.target.value)} />

            {/* Detail level selector: Simple + Detailed */}
            <div className="flex gap-2 w-full">
              {([0, 1] as const).map((v) => {
                const labels = isRtl ? ["פשוט", "מפורט"] : ["Simple", "Detailed"];
                const descs = isRtl
                  ? ["קווי מתאר נקיים ומהירים", "עשיר בפרטים, מדויק יותר"]
                  : ["Clean outlines, faster", "Rich detail, more precise"];
                const demoImages = [
                  "https://d2xsxph8kpxj0f.cloudfront.net/310519663365044246/hnDFdLkzVGYJYdws9hbnLw/demo-simple-drill_1b894e4d.png",
                  "https://d2xsxph8kpxj0f.cloudfront.net/310519663365044246/hnDFdLkzVGYJYdws9hbnLw/demo-detailed-drill_9db37b01.png",
                ];
                const borderColors = ["#6366f1", "#0d9488"];
                const gradients = [
                  "linear-gradient(135deg, #6366f1, #818cf8)",
                  "linear-gradient(135deg, #0d9488, #06b6d4)",
                ];
                const shadows = [
                  "0 3px 12px rgba(99,102,241,0.35)",
                  "0 3px 12px rgba(13,148,136,0.35)",
                ];
                const isSelected = detailLevel === v;
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setDetailLevel(v)}
                    className="relative flex-1 flex flex-col items-start rounded-xl text-xs font-medium transition-all hover:scale-[1.02] active:scale-95 overflow-hidden"
                    style={isSelected
                      ? { border: `2px solid ${borderColors[v]}`, boxShadow: shadows[v], background: "#fff" }
                      : { border: "2px solid #e2e8f0", background: "#f8fafc" }
                    }
                  >
                    {/* Demo image */}
                    <div className="relative w-full" style={{ height: "120px", background: '#fff', padding: '8px' }}>
                      <img
                        src={demoImages[v]}
                        alt={labels[v]}
                        className="w-full h-full"
                        style={{ borderRadius: 0, objectFit: 'contain', objectPosition: 'center' }}
                      />
                      {v === 0 && (
                        <span
                          className="absolute top-1 right-1 text-xs font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap"
                          style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)", color: "white", fontSize: "8px", lineHeight: "1.4", boxShadow: "0 1px 4px rgba(245,158,11,0.4)" }}
                        >
                          {isRtl ? "מומלץ" : "Recommended"}
                        </span>
                      )}
                    </div>
                    {/* Label */}
                    <div className="w-full px-2 py-1.5 flex flex-col gap-0.5"
                      style={{ color: isSelected ? borderColors[v] : "#374151" }}
                    >
                      <span className="font-bold text-xs">{labels[v]}</span>
                      <span style={{ fontSize: "9px", opacity: 0.7 }}>{descs[v]}</span>
                    </div>
                    {isSelected && (
                      <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-4 h-1 rounded-full" style={{ background: gradients[v] }} />
                    )}
                  </button>
                );
              })}
            </div>
            {(false as boolean) && ([1, 2] as const).map((v) => {
                  const labels = isRtl
                    ? ["נקי ופשוט", "מפורט"]
                    : ["Clean & Simple", "Detailed"];
                  const descs = isRtl
                    ? ["קווי מתאר בסיסיים, נקיים", "עשיר בפרטים, מדויק"]
                    : ["Basic clean outlines", "Rich detail, precise"];
                  // before = original photo, after = DXF result
                  const previewImages = [
                    {
                      before: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663365044246/hnDFdLkzVGYJYdws9hbnLw/demo-v3-bicycle_c5150be7.png',
                      after: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663365044246/hnDFdLkzVGYJYdws9hbnLw/demo-gen-sunglasses_e7cbfe74.png',
                    },
                    {
                      before: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663365044246/hnDFdLkzVGYJYdws9hbnLw/demo-v3-sneaker_9fe887cf.png',
                      after: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663365044246/hnDFdLkzVGYJYdws9hbnLw/demo-gen-motorcycle_9b48b7de.png',
                    },
                  ];
                  const gradients = [
                    'linear-gradient(135deg, #6366f1, #818cf8)',
                    'linear-gradient(135deg, #0d9488, #06b6d4)',
                  ];
                  const borderColors = ['#6366f1', '#0d9488'];
                  const shadows = [
                    '0 3px 12px rgba(99,102,241,0.35)',
                    '0 3px 12px rgba(13,148,136,0.35)',
                  ];
                  const isSelected = v === 1; // always first
                  const isRecommended = v === 1;
                  const preview = previewImages[v - 1];
                  return (
                    <button
                      key={v}
                      type="button"
                      onClick={() => { /* no-op */ }}
                      className="relative flex flex-col items-start rounded-xl text-xs font-medium transition-all hover:scale-[1.02] active:scale-95 overflow-hidden"
                      style={isSelected
                        ? { border: `2px solid ${borderColors[v-1]}`, boxShadow: shadows[v-1], background: '#fff' }
                        : { border: '2px solid #e2e8f0', background: '#f8fafc' }
                      }
                    >
                      {/* Preview image strip: before → after */}
                      <div className="relative w-full flex" style={{ height: '72px' }}>
                        <img
                          src={preview.before}
                          alt="before"
                          className="w-1/2 h-full object-cover"
                          style={{ borderRadius: 0 }}
                        />
                        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 flex items-center justify-center rounded-full w-5 h-5 text-white text-xs font-bold"
                          style={{ background: isSelected ? gradients[v-1] : '#9ca3af', boxShadow: '0 1px 4px rgba(0,0,0,0.3)' }}
                        >→</div>
                        <img
                          src={preview.after}
                          alt="after"
                          className="w-1/2 h-full object-cover"
                          style={{ borderRadius: 0, filter: 'grayscale(1) contrast(1.4)' }}
                        />
                        {isRecommended && (
                          <span
                            className="absolute top-1 right-1 text-xs font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap"
                            style={{ background: 'linear-gradient(135deg, #f59e0b, #f97316)', color: 'white', fontSize: '8px', lineHeight: '1.4', boxShadow: '0 1px 4px rgba(245,158,11,0.4)' }}
                          >
                            {t("recommended")}
                          </span>
                        )}
                      </div>
                      {/* Label row */}
                      <div className="w-full px-2 py-1.5 flex flex-col gap-0.5"
                        style={{ color: isSelected ? borderColors[v-1] : '#374151' }}
                      >
                        <span className="font-bold text-xs">{labels[v - 1]}</span>
                        <span style={{ fontSize: '9px', opacity: 0.7 }}>{descs[v - 1]}</span>
                      </div>
                      {/* Selected indicator */}
                      {isSelected && (
                        <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-4 h-1 rounded-full" style={{ background: gradients[v-1] }} />
                      )}
                    </button>
                  );
                })}
            {/* Lineweight option */}
            <div className="flex items-center gap-2 pt-1 pb-1 flex-wrap">
              <label className="text-sm font-medium shrink-0">
                {t("dxfLineweight")}
              </label>
              <input
                type="number"
                min="0"
                max="2"
                step="0.05"
                placeholder={t("defaultPlaceholder")}
                value={lineweightMm}
                onChange={e => setLineweightMm(e.target.value)}
                className="w-24 border border-border rounded px-2 py-1 text-sm text-center"
              />
              <span className="text-xs text-gray-400">{t("lineweightHint")}</span>
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
                onClick={() => handleTrace()}
              >
                {status === "loading" ? (
                  <><div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />{t("aiAnalyzing")}</>
                ) : (
                  <><Wand2 className="w-4 h-4" />{t("createAiOutline")}</>
                )}
              </button>
              {tryAgainUrl && status !== "loading" && (
                <button
                  className="h-13 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-1.5 transition-all hover:opacity-90"
                  style={{ background: 'linear-gradient(135deg, #0f766e, #0d9488)', color: 'white', border: 'none', boxShadow: '0 4px 12px rgba(13,148,136,0.3)' }}
                  onClick={() => handleTraceFromUrl(tryAgainUrl)}
                  title={t("tryAgainSameImage")}
                >
                  <Scan className="w-4 h-4" />
                  {t("tryAgain")}
                </button>
              )}
            </div>
        </div>

        {/* Loading */}
        {status === "loading" && (
          <AiProcessingAnimation
            elapsedSeconds={elapsedSeconds}
            currentStep={currentStep}
            imagePreview={imagePreview}
            jobId={jobId}
            onCancel={handleCancel}
            isRtl={isRtl}
            accentColor="#0d9488"
            accentGradient="linear-gradient(135deg, #0d9488, #5eead4)"
            featureLabel="AI Trace"
          />
        )}
        {/* Success overlay — brief celebration when job completes */}
        {showSuccessOverlay && (
          <div className="relative rounded-2xl overflow-hidden" style={{ minHeight: 200 }}>
            <SuccessOverlay
              accentColor="#0d9488"
              label={isRtl ? "העיצוב מוכן! 🎉" : "Design Ready! 🎉"}
              onDone={() => setShowSuccessOverlay(false)}
            />
          </div>
        )}

        {/* UNCLEAR_IMAGE — special dialog with text input */}
        {status === "error" && isUnclearImage && (
          <div
            className="rounded-xl overflow-hidden"
            style={{ border: '1px solid #fbbf24', boxShadow: '0 4px 24px rgba(251,191,36,0.15)' }}
          >
            {/* Header */}
            <div className="px-5 py-4" style={{ background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)' }}>
              <div className="flex items-center gap-3 mb-1">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-2xl" style={{ background: '#fde68a' }}>
                  ?
                </div>
                <div>
                  <p className="font-bold text-amber-800 text-base">{isRtl ? "התמונה לא ברורה לי" : "I couldn't identify the image"}</p>
                  <p className="text-xs text-amber-600">{isRtl ? "צייר רק מה שרואים, לא מפרש" : "I draw only what I see, not interpret"}</p>
                </div>
              </div>
            </div>
            {/* Body */}
            <div className="px-5 py-4 bg-white">
              <p className="text-sm text-gray-600 mb-3">
                {isRtl
                  ? "בבקשה רשום בכתב מה בדיוק לצייר (למשל: כלב יושב מצד, מנורה עגולה פשוטה):"
                  : "Please describe what to draw (e.g. a sitting dog, a simple round lamp):"}
              </p>
              <textarea
                className="w-full rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-gray-800 resize-none focus:outline-none focus:ring-2 focus:ring-amber-300"
                rows={3}
                placeholder={isRtl ? "למשל: כלב לבן יושב מצד, מנורה עגולה עם שלשה רגליים..." : "e.g. a white dog sitting sideways, a round lamp with three legs..."}
                value={unclearDescription}
                onChange={(e) => setUnclearDescription(e.target.value)}
                dir={isRtl ? "rtl" : "ltr"}
                autoFocus
              />
              <div className="flex gap-2 mt-3 flex-wrap">
                <button
                  className="flex-1 text-sm px-4 py-2.5 rounded-lg font-semibold text-white transition-all"
                  style={{ background: unclearDescription.trim() ? '#0d9488' : '#9ca3af', cursor: unclearDescription.trim() ? 'pointer' : 'not-allowed' }}
                  disabled={!unclearDescription.trim()}
                  onClick={() => {
                    const desc = unclearDescription.trim();
                    if (!desc) return;
                    setIsUnclearImage(false);
                    setDescription(desc);
                    setStatus("idle");
                    setTimeout(() => handleTrace(desc), 50);
                  }}
                >
                  {isRtl ? "צייר עכשיו" : "Draw now"} &rarr;
                </button>
                <button
                  className="text-sm px-4 py-2.5 rounded-lg font-medium bg-gray-100 hover:bg-gray-200 text-gray-600 border border-gray-200"
                  onClick={reset}
                >
                  {isRtl ? "בחר תמונה אחרת" : "Choose another image"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Regular Error */}
        {status === "error" && !isUnclearImage && (
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
                  className="text-sm px-4 py-2 rounded-lg font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200"
                  onClick={reset}
                >{t("tryAgain")}</button>
                {errorMsg && (errorMsg.includes("אסימונים") || errorMsg.toLowerCase().includes("token")) && (
                  <button
                    className="text-sm px-4 py-2 rounded-lg font-semibold"
                    style={{background: '#0d9488', color: 'white', border: 'none'}}
                    onClick={() => window.location.href = "/tokens"}
                  >
                    {t("buyTokens")}
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
                      {t("designReadyChooseStyle")}
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
                    {t("changeImage")}
                  </label>
                </div>
                {result.objectDescription && (
                  <p className="text-xs mt-1 line-clamp-2 text-gray-500">
                    <span className="font-medium text-teal-700">{t("aiDescriptionLabel")}</span>
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
                      {t("improveDesign")}
                    </span>
                  </div>

                  <p className="text-xs font-medium mb-1.5 text-teal-700">
                    {t("changeStyle")}
                  </p>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {(isRtl ? VARIATION_LABELS : VARIATION_LABELS_EN).map((label, idx) => (
                      <button
                        key={idx}
                        onClick={() => { setFocusText(label); handleTrace(label); }}
                        className="text-xs px-3 py-1.5 rounded-full font-medium transition-all bg-teal-50 border border-teal-200 text-teal-700 hover:bg-teal-100"
                      >
                        🎨 {label}
                      </button>
                    ))}
                  </div>

                  <p className="text-xs font-medium mb-1.5 text-teal-700">
                    {t("aiSuggestions")}
                  </p>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {result.suggestions.map((suggestion, idx) => (
                      <button
                        key={idx}
                        onClick={() => { setFocusText(suggestion); handleTrace(suggestion); }}
                        className="text-xs px-3 py-1.5 rounded-full font-medium transition-all bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100"
                      >
                        ✨ {suggestion}
                      </button>
                    ))}
                  </div>

                  <p className="text-xs font-medium mb-1.5 text-teal-700">
                    {t("orTypeRequest")}
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={customImprovement}
                      onChange={(e) => setCustomImprovement(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && customImprovement.trim()) {
                          const txt = customImprovement.trim();
                          setFocusText(txt);
                          setCustomImprovement("");
                          handleTrace(txt);
                        }
                      }}
                      placeholder={t("addDetailPlaceholder")}
                      className="flex-1 text-sm rounded-lg px-3 py-2 bg-gray-50 border border-gray-200 text-gray-800"
                      dir={isRtl ? "rtl" : "ltr"}
                    />
                    <button
                      onClick={() => {
                        if (customImprovement.trim()) {
                          const txt = customImprovement.trim();
                          setFocusText(txt);
                          setCustomImprovement("");
                          handleTrace(txt);
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
                      {t("apply")}
                    </button>
                  </div>
              </div>
            )}

            {/* Before / After comparison panel */}
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
                    <div className="absolute top-2 left-2 z-10 text-xs font-bold px-2 py-0.5 rounded" style={{ background: 'rgba(13,148,136,0.85)', color: 'white' }}>
                      {isRtl ? 'וקטור' : 'Vector'}
                    </div>
                    <img
                      src={result.images[0].imageUrl}
                      alt="vector"
                      className="w-full block cursor-zoom-in"
                      style={{ aspectRatio: '1', objectFit: 'contain', background: '#f8fafc' }}
                      onClick={() => setZoomImg({ src: result.images[0].imageUrl, alt: isRtl ? 'וקטור' : 'Vector' })}
                    />
                  </div>
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
                  processingTime={processingTime}
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
              <li className="flex gap-2"><span className="shrink-0 text-teal-500">•</span><span>{t("aiAnalyzesAndRedraws")}</span></li>
            </ul>
        </div>
      </div>
    </>
  );
}

/**
 * ArchitecturalSketchTab.tsx
 *
 * Feature: "שרטוט אדריכלי → DXF"
 *
 * User uploads a photo/scan of an architectural hand-drawn sketch.
 * → AI checks image clarity
 * → AI auto-detects scale bar (1:100, 1:50, etc.)
 * → If no scale found → asks user for a reference dimension
 * → AI cleans the sketch (removes paper texture, sharpens lines)
 * → Potrace vectorizes → straighten lines → DXF with real-world units
 */
import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { DxfDownloadDialog } from "@/components/DxfDownloadDialog";
import { AiProcessingAnimation } from "@/components/AiProcessingAnimation";
import { SuccessOverlay } from "@/components/SuccessConfetti";
import { ExportButtons } from "@/components/ExportButtons";
import { useBugReport } from "@/hooks/useBugReport";
import {
  ImageIcon,
  Loader2,
  Ruler,
  Building2,
  Sparkles,
  ZoomIn,
  Coins,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  X,
} from "lucide-react";
import { SvgPanZoomViewer } from "@/components/SvgPanZoomViewer";
import { convertPdfToImage, isPdf } from "@/lib/pdfToImage";
import { useTokenCost } from "@/hooks/useTokenCost";

// ─── Types ────────────────────────────────────────────────────────────────────
interface SketchImage {
  imageUrl: string;
  svgPreview: string;
  dxfUrl: string;
  dxfFilename?: string;
  segmentCount: number;
  width: number;
  height: number;
  scaleApplied: boolean;
  scaleDescription?: string;
  ocrText?: string;
}

interface SketchResult {
  success: boolean;
  image: SketchImage;
}

type Status = "idle" | "loading" | "awaiting_scale" | "success" | "error";

const LS_KEY = "arch_sketch_job";
const LS_KEY_IMG = "arch_sketch_img";
const LS_KEY_RESULT = "arch_sketch_result";

// ─── Scale Dialog ─────────────────────────────────────────────────────────────
interface ScaleDialogProps {
  isRtl: boolean;
  onConfirm: (mm: number, label: string) => void;
  onSkip: () => void;
}
function ScaleDialog({ isRtl, onConfirm, onSkip }: ScaleDialogProps) {
  const [value, setValue] = useState("");
  const [unit, setUnit] = useState<"m" | "cm" | "mm">("m");

  const handleConfirm = () => {
    const num = parseFloat(value);
    if (isNaN(num) || num <= 0) return;
    const mm = unit === "m" ? num * 1000 : unit === "cm" ? num * 10 : num;
    const label = `${num} ${unit === "m" ? "מטר" : unit === "cm" ? "ס\"מ" : "מ\"מ"}`;
    onConfirm(mm, label);
  };

  const presets = isRtl
    ? [
        { label: "דלת 90 ס\"מ", mm: 900, text: "דלת 90 ס\"מ" },
        { label: "קיר 5 מ'", mm: 5000, text: "קיר 5 מ'" },
        { label: "חדר 4 מ'", mm: 4000, text: "חדר 4 מ'" },
      ]
    : [
        { label: "Door 90cm", mm: 900, text: "Door 90cm" },
        { label: "Wall 5m", mm: 5000, text: "Wall 5m" },
        { label: "Room 4m", mm: 4000, text: "Room 4m" },
      ];

  return (
    <div
      className="rounded-2xl p-5 space-y-4"
      style={{ background: "#fffbeb", border: "1px solid rgba(251,191,36,0.3)" }}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 mt-0.5"
          style={{ background: "rgba(251,191,36,0.2)" }}
        >
          <HelpCircle className="w-5 h-5" style={{ color: "#f59e0b" }} />
        </div>
        <div>
          <p className="font-semibold text-sm text-gray-800">
            {isRtl ? "לא זוהה קנה מידה בשרטוט" : "No scale detected in drawing"}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            {isRtl
              ? "הזן מידה ידועה אחת כדי לקבל DXF עם מידות אמיתיות, או דלג לקבל DXF ללא מידות."
              : "Enter one known dimension to get DXF with real-world units, or skip to get DXF without scale."}
          </p>
        </div>
      </div>

      {/* Presets */}
      <div className="flex flex-wrap gap-2">
        {presets.map((p) => (
          <button
            key={p.label}
            onClick={() => onConfirm(p.mm, p.text)}
            className="text-xs px-3 py-1.5 rounded-full font-medium transition-colors"
            style={{
              background: "rgba(251,191,36,0.15)",
              border: "1px solid rgba(251,191,36,0.3)",
              color: "#92400e",
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Custom input */}
      <div className="flex gap-2">
        <input
          type="number"
          min="0.01"
          step="0.01"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={isRtl ? "הזן מידה..." : "Enter value..."}
          className="flex-1 h-9 px-3 text-sm rounded-xl border outline-none"
          style={{ borderColor: "rgba(251,191,36,0.4)", background: "white", color: "#1f2937" }}
          onKeyDown={(e) => { if (e.key === "Enter") handleConfirm(); }}
          dir="ltr"
        />
        <select
          value={unit}
          onChange={(e) => setUnit(e.target.value as "m" | "cm" | "mm")}
          className="h-9 px-2 text-sm rounded-xl border outline-none"
          style={{ borderColor: "rgba(251,191,36,0.4)", background: "white", color: "#1f2937" }}
        >
          <option value="m">{isRtl ? "מטר" : "m"}</option>
          <option value="cm">{isRtl ? "ס\"מ" : "cm"}</option>
          <option value="mm">{isRtl ? "מ\"מ" : "mm"}</option>
        </select>
        <button
          onClick={handleConfirm}
          disabled={!value || parseFloat(value) <= 0}
          className="h-9 px-4 text-sm rounded-xl font-semibold transition-all"
          style={{
            background:
              !value || parseFloat(value) <= 0
                ? "rgba(251,191,36,0.2)"
                : "linear-gradient(135deg, #d97706, #f59e0b)",
            color: !value || parseFloat(value) <= 0 ? "rgba(251,191,36,0.4)" : "white",
            border: "none",
          }}
        >
          {isRtl ? "אשר" : "Confirm"}
        </button>
      </div>

      <button
        onClick={onSkip}
        className="w-full text-xs text-gray-400 hover:text-gray-600 transition-colors py-1"
      >
        {isRtl ? "דלג — המר ללא מידות אמיתיות" : "Skip — convert without real-world scale"}
      </button>
    </div>
  );
}

// ─── Result Card ──────────────────────────────────────────────────────────────
interface ResultCardProps {
  image: SketchImage;
  isRtl: boolean;
  onDownload: () => void;
  onZoom: (src: string) => void;
  originalPreview?: string | null;
}
function ResultCard({ image, isRtl, onDownload, onZoom, originalPreview }: ResultCardProps) {
  const [showVector, setShowVector] = useState(false);
  const [showComparison, setShowComparison] = useState(false);

  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: "#ffffff", border: "1px solid #e2e8f0", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}
    >
      <div className="flex items-center justify-between mb-3">
        <span
          className="text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1.5"
          style={{ background: "rgba(251,191,36,0.15)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.25)" }}
        >
          <Sparkles className="w-3 h-3" />
          {isRtl ? "שרטוט אדריכלי" : "Architectural Sketch"}
        </span>
        <div className="flex items-center gap-2">
          {image.scaleApplied && (
            <span
              className="text-xs px-2 py-0.5 rounded-full flex items-center gap-1"
              style={{ background: "rgba(34,197,94,0.1)", color: "#16a34a", border: "1px solid rgba(34,197,94,0.2)" }}
            >
              <CheckCircle2 className="w-3 h-3" />
              {isRtl ? "עם מידות" : "Scaled"}
            </span>
          )}
          <span className="text-xs text-gray-400">
            {image.segmentCount.toLocaleString()} {isRtl ? "קווים" : "lines"}
          </span>
        </div>
      </div>

      {/* Scale info */}
      {image.scaleApplied && image.scaleDescription && (
        <div
          className="flex items-center gap-2 mb-3 px-3 py-2 rounded-xl text-xs"
          style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.15)", color: "#15803d" }}
        >
          <Ruler className="w-3.5 h-3.5 shrink-0" />
          <span>{image.scaleDescription}</span>
        </div>
      )}

      {/* OCR text extracted from drawing */}
      {image.ocrText && (
        <details className="mb-3">
          <summary
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs cursor-pointer select-none"
            style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.15)", color: "#6366f1" }}
          >
            <ZoomIn className="w-3.5 h-3.5 shrink-0" />
            <span className="font-semibold">{isRtl ? "טקסט ומידות שזוהו מהשרטוט" : "Text & dimensions detected from drawing"}</span>
          </summary>
          <div
            className="mt-1 px-3 py-2 rounded-xl text-xs whitespace-pre-wrap"
            style={{ background: "rgba(99,102,241,0.04)", border: "1px solid rgba(99,102,241,0.1)", color: "#4f46e5", direction: "ltr" }}
          >
            {image.ocrText}
          </div>
        </details>
      )}

      {/* Before/After toggle */}
      {originalPreview && (
        <button
          onClick={() => setShowComparison(!showComparison)}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 mb-3 rounded-xl text-xs font-semibold transition-all"
          style={
            showComparison
              ? { background: "linear-gradient(135deg, #d97706, #f59e0b)", color: "white", border: "none" }
              : { background: "rgba(251,191,36,0.10)", border: "1px solid rgba(251,191,36,0.25)", color: "#fbbf24" }
          }
        >
          <span>{showComparison ? "🔄" : "👁"}</span>
          {showComparison
            ? isRtl ? "הצג תוצאה בלבד" : "Show result only"
            : isRtl ? "השווה לפני / אחרי" : "Compare Before / After"}
        </button>
      )}

      {/* Preview */}
      {showComparison && originalPreview ? (
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="flex flex-col items-center gap-1">
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
              {isRtl ? "לפני" : "Before"}
            </span>
            <div className="w-full rounded-xl overflow-hidden bg-gray-50 border border-gray-200">
              <img src={originalPreview} alt="before" className="w-full h-32 object-contain" />
            </div>
          </div>
          <div className="flex flex-col items-center gap-1">
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">
              {isRtl ? "אחרי" : "After"}
            </span>
            <div className="w-full rounded-xl overflow-hidden bg-white border border-amber-200">
              <img src={image.imageUrl} alt="after" className="w-full h-32 object-contain" />
            </div>
          </div>
        </div>
      ) : (
        <div className="relative mb-3 rounded-xl overflow-hidden bg-gray-50 border border-gray-100">
          {showVector ? (
            <div className="h-52">
              <SvgPanZoomViewer svgContent={image.svgPreview} isRtl={true} />
            </div>
          ) : (
            <div className="relative">
              <img
                src={image.imageUrl}
                alt={isRtl ? "שרטוט מנוקה" : "Cleaned sketch"}
                className="w-full max-h-52 object-contain cursor-zoom-in"
                onClick={() => onZoom(image.imageUrl)}
              />
              <button
                onClick={() => onZoom(image.imageUrl)}
                className="absolute top-2 right-2 p-1.5 rounded-full bg-black/40 hover:bg-black/60 transition-colors"
              >
                <ZoomIn className="w-3.5 h-3.5 text-white" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Toggle vector/image */}
      <button
        onClick={() => setShowVector(!showVector)}
        className="w-full flex items-center justify-center gap-2 py-2 mb-3 rounded-xl text-xs font-medium transition-all"
        style={{
          background: showVector ? "rgba(251,191,36,0.1)" : "rgba(0,0,0,0.04)",
          border: "1px solid rgba(0,0,0,0.08)",
          color: "#6b7280",
        }}
      >
        {showVector
          ? isRtl ? "הצג תמונה מנוקה" : "Show cleaned image"
          : isRtl ? "הצג וקטור DXF" : "Show DXF vector"}
      </button>

      {/* Download */}
      <button
        onClick={onDownload}
        className="w-full h-11 rounded-xl flex items-center justify-center gap-2 font-semibold text-sm transition-all"
        style={{ background: "linear-gradient(135deg, #d97706, #f59e0b)", color: "white", border: "none" }}
      >
        <Building2 className="w-4 h-4" />
        {isRtl ? "הורד DXF לCAD" : "Download DXF for CAD"}
      </button>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
interface ArchitecturalSketchTabProps {
  onOpenAuth: () => void;
  onInsufficientTokens?: () => void;
}

export function ArchitecturalSketchTab({ onOpenAuth, onInsufficientTokens }: ArchitecturalSketchTabProps) {
  const { isRtl } = useLanguage();
  const { data: tokenData, refetch: refetchTokens } = trpc.tokens.balance.useQuery(undefined, { retry: false });
  const { getCost } = useTokenCost();
  const cost = getCost("ai_trace");
  const { reportBug } = useBugReport();

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(() => localStorage.getItem(LS_KEY_IMG));
  const [status, setStatus] = useState<Status>(() => {
    if (localStorage.getItem(LS_KEY)) return "idle";
    if (localStorage.getItem(LS_KEY_RESULT)) return "success";
    return "idle";
  });
  const [result, setResult] = useState<SketchResult | null>(() => {
    if (!localStorage.getItem(LS_KEY)) {
      try {
        const cached = localStorage.getItem(LS_KEY_RESULT);
        if (cached) return JSON.parse(cached) as SketchResult;
      } catch (_) { /* ignore */ }
    }
    return null;
  });
  const [errorMsg, setErrorMsg] = useState("");
  const [errorCode, setErrorCode] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [downloadTarget, setDownloadTarget] = useState<SketchImage | null>(null);
  const [zoomImg, setZoomImg] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(() => localStorage.getItem(LS_KEY));
  const [currentStep, setCurrentStep] = useState<string>("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [showSuccessOverlay, setShowSuccessOverlay] = useState(false);
  // Pending job data waiting for scale input
  const pendingJobRef = useRef<{ buffer: ArrayBuffer; mimeType: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scanAnimRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [scanLine, setScanLine] = useState(0);

  const startScanAnimation = useCallback(() => {
    setScanLine(0);
    let pos = 0, dir = 1;
    scanAnimRef.current = setInterval(() => {
      pos += dir * 1.5;
      if (pos >= 100) { pos = 100; dir = -1; }
      if (pos <= 0) { pos = 0; dir = 1; }
      setScanLine(pos);
    }, 20);
  }, []);

  const stopScanAnimation = useCallback(() => {
    if (scanAnimRef.current) { clearInterval(scanAnimRef.current); scanAnimRef.current = null; }
    setScanLine(0);
  }, []);

  const setJobIdPersisted = useCallback((id: string | null) => {
    if (id) localStorage.setItem(LS_KEY, id);
    else { localStorage.removeItem(LS_KEY); localStorage.removeItem(LS_KEY_IMG); }
    setJobId(id);
  }, []);

  const setImagePreviewPersisted = useCallback((preview: string | null) => {
    if (preview) localStorage.setItem(LS_KEY_IMG, preview);
    else localStorage.removeItem(LS_KEY_IMG);
    setImagePreview(preview);
  }, []);

  // Poll job status
  const startPolling = useCallback((id: string) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/architectural-sketch/job/${id}`, { credentials: "include" });
        const data = await res.json();
        if (data.step) setCurrentStep(data.step);

        if (data.status === "done") {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
          stopScanAnimation();
          const sketchResult = data.result as SketchResult;
          setResult(sketchResult);
          try { localStorage.setItem(LS_KEY_RESULT, JSON.stringify(sketchResult)); } catch (_) { /* quota */ }
          setStatus("success");
          setShowSuccessOverlay(true);
          setCurrentStep("");
          setJobIdPersisted(null);
          refetchTokens();
          toast.success(isRtl ? "השרטוט הומר בהצלחה!" : "Sketch converted successfully!");
        } else if (data.status === "error") {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          stopScanAnimation();
          const msg = data.error || (isRtl ? "שגיאה בעיבוד" : "Processing error");
          const code = data.errorCode || "";
          setErrorMsg(msg);
          setErrorCode(code);
          setStatus("error");
          setJobIdPersisted(null);
          refetchTokens();
          if (code !== "IMAGE_NOT_CLEAR") {
            reportBug({ errorType: "ai_failed", errorMessage: msg, feature: "architectural_sketch" });
          }
          if (data.error === "INSUFFICIENT_TOKENS" && onInsufficientTokens) onInsufficientTokens();
        } else if (data.status === "cancelled") {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          stopScanAnimation();
          setStatus("idle");
          setJobIdPersisted(null);
        }
      } catch (_) { /* network error, keep trying */ }
    }, 3000);
  }, [isRtl, refetchTokens, stopScanAnimation, setJobIdPersisted, reportBug, onInsufficientTokens]);

  // On mount: resume polling if saved job
  useEffect(() => {
    const savedId = localStorage.getItem(LS_KEY);
    if (savedId) {
      setStatus("loading");
      startScanAnimation();
      startPolling(savedId);
    }
    return () => { if (pollIntervalRef.current) clearInterval(pollIntervalRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFile = useCallback(async (file: File) => {
    if (isPdf(file)) {
      toast.info(isRtl ? "ממיר PDF לתמונה..." : "Converting PDF to image...");
      try { file = await convertPdfToImage(file); } catch (_) {
        toast.error(isRtl ? "שגיאה בהמרת PDF" : "PDF conversion failed");
        return;
      }
    }
    setImageFile(file);
    // Store buffer for later submission (after scale dialog)
    const buf = await file.arrayBuffer();
    pendingJobRef.current = { buffer: buf, mimeType: file.type };
    const reader = new FileReader();
    reader.onload = (e) => {
      const preview = e.target?.result as string;
      setImagePreviewPersisted(preview);
    };
    reader.readAsDataURL(file);
  }, [isRtl, setImagePreviewPersisted]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  // Submit job to server
  const submitJob = async (knownLengthMm: number | null, knownLengthLabel: string | undefined) => {
    if (!imageFile && !imagePreview) return;
    setShowSuccessOverlay(false);
    setStatus("loading");
    setResult(null);
    setErrorMsg("");
    setErrorCode("");
    startScanAnimation();

    try {
      const formData = new FormData();
      if (imageFile) {
        formData.append("image", imageFile);
      } else if (imagePreview) {
        const res = await fetch(imagePreview);
        const blob = await res.blob();
        formData.append("image", blob, "sketch.jpg");
      }
      if (knownLengthMm) formData.append("knownLengthMm", String(knownLengthMm));
      if (knownLengthLabel) formData.append("knownLengthLabel", knownLengthLabel);
      formData.append("lang", isRtl ? "he" : "en");

      const res = await fetch("/api/architectural-sketch", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      const data = await res.json();

      if (!res.ok) {
        stopScanAnimation();
        if (data.error === "UNAUTHORIZED") { onOpenAuth(); setStatus("idle"); return; }
        if (data.error === "INSUFFICIENT_TOKENS") {
          const msg = isRtl ? (data.message || "נגמרו האסימונים") : (data.messageEn || "Out of tokens");
          setErrorMsg(msg);
          setStatus("error");
          refetchTokens();
          if (onInsufficientTokens) onInsufficientTokens();
          return;
        }
        throw new Error(isRtl ? (data.message || data.error) : (data.messageEn || data.error || "Error"));
      }

      if (data.jobId) {
        setJobIdPersisted(data.jobId);
        setElapsedSeconds(0);
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
        startPolling(data.jobId);
      }
    } catch (err: unknown) {
      stopScanAnimation();
      const msg = err instanceof Error ? err.message : (isRtl ? "שגיאה בעיבוד" : "Processing error");
      setErrorMsg(msg);
      setStatus("error");
      toast.error(msg);
    }
  };

  const handleConvert = () => submitJob(null, undefined);

  const handleScaleConfirm = (mm: number, label: string) => submitJob(mm, label);

  const handleScaleSkip = () => submitJob(null, undefined);

  const handleCancel = async () => {
    if (!jobId) return;
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    stopScanAnimation();
    try {
      await fetch(`/api/architectural-sketch/cancel/${jobId}`, { method: "POST", credentials: "include" });
      toast.success(isRtl ? "העיבוד בוטל" : "Processing cancelled");
      refetchTokens();
    } catch (_) { /* ignore */ }
    setStatus("idle");
    setJobIdPersisted(null);
  };

  const reset = () => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    stopScanAnimation();
    setImageFile(null);
    setImagePreviewPersisted(null);
    setResult(null);
    setStatus("idle");
    setErrorMsg("");
    setErrorCode("");
    setJobIdPersisted(null);
    setShowSuccessOverlay(false);
    localStorage.removeItem(LS_KEY_RESULT);
  };

  return (
    <div className="space-y-4" dir={isRtl ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="text-center space-y-1 pb-1">
        <h2 className="text-lg font-bold flex items-center justify-center gap-2 text-gray-800">
          <Building2 className="w-5 h-5" style={{ color: "#fbbf24" }} />
          {isRtl ? "שרטוט אדריכלי → DXF" : "Architectural Sketch → DXF"}
        </h2>
        <p className="text-xs leading-relaxed text-gray-500">
          {isRtl
            ? "צלם תוכנית קומה, חתך, או שרטוט ביד — ה-AI ינקה ויהפוך ל-DXF עם מידות אמיתיות"
            : "Photo a floor plan, section, or hand-drawn sketch — AI cleans and converts to DXF with real-world dimensions"}
        </p>
      </div>

      {/* Upload area */}
      {status !== "loading" && status !== "awaiting_scale" && (
        <div className="relative">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
          />

          {imagePreview ? (
            <div className="mb-3">
              <div className="relative rounded-xl overflow-hidden border-2 border-primary/20 bg-muted/10">
                <img
                  src={imagePreview}
                  alt={isRtl ? "שרטוט שנבחר" : "Selected sketch"}
                  className="w-full max-h-56 object-contain block"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent pointer-events-none" />
                <div className="absolute bottom-2 right-2 left-2 flex items-center justify-between">
                  <span className="text-xs text-white/90 bg-black/40 px-2 py-0.5 rounded-full truncate max-w-[60%]">
                    {imageFile?.name ?? (isRtl ? "שרטוט" : "sketch")}
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
            <div className="mb-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-3 py-6 rounded-xl transition-colors"
                style={{ border: "2px dashed rgba(251,191,36,0.30)", background: "rgba(251,191,36,0.05)" }}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
              >
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: "rgba(251,191,36,0.15)" }}
                >
                  <Building2 className="w-6 h-6" style={{ color: "#fbbf24" }} />
                </div>
                <div className="text-start">
                  <p className="font-semibold text-sm" style={{ color: "#fbbf24" }}>
                    {isRtl ? "צלם או בחר שרטוט" : "Take or Choose Sketch"}
                  </p>
                  <p className="text-xs text-gray-400">
                    {isRtl ? "תוכנית קומה, חתך, שרטוט ביד..." : "Floor plan, section, hand-drawn sketch..."}
                  </p>
                </div>
              </button>
              <p className="hidden sm:block text-xs text-center text-gray-400 mt-2">
                {isRtl ? "או גרור תמונה לכאן" : "or drag & drop here"}
              </p>
            </div>
          )}

          {dragOver && !imagePreview && (
            <div className="absolute inset-0 rounded-xl bg-amber-400/20 border-2 border-amber-500 pointer-events-none" />
          )}
        </div>
      )}

      {/* Scale dialog — shown after image selected, before submit */}
      {status === "awaiting_scale" && (
        <ScaleDialog isRtl={isRtl} onConfirm={handleScaleConfirm} onSkip={handleScaleSkip} />
      )}

      {/* Convert button */}
      {status === "idle" && imagePreview && (
        <button
          onClick={handleConvert}
          className="w-full h-12 rounded-xl flex items-center justify-center gap-2 font-semibold text-sm transition-all"
          style={{ background: "linear-gradient(135deg, #d97706, #f59e0b)", color: "white", border: "none" }}
        >
          <Ruler className="w-4 h-4" />
          {isRtl ? "המר לDXF" : "Convert to DXF"}
          {cost > 0 && (
            <span style={{ fontSize: "0.72em", opacity: 0.8, marginInlineStart: 4, display: "inline-flex", alignItems: "center", gap: 2 }}>
              <Coins className="w-3 h-3" />{cost}
            </span>
          )}
        </button>
      )}

      {/* Loading state */}
      {status === "loading" && (
        <div className="space-y-3">
          {imagePreview && (
            <div className="relative rounded-xl overflow-hidden border-2 border-amber-200 bg-muted/10">
              <img
                src={imagePreview}
                alt={isRtl ? "מעבד..." : "Processing..."}
                className="w-full max-h-56 object-contain block opacity-60"
              />
              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div className="absolute inset-0 bg-black/20" />
                <div
                  className="absolute left-0 right-0 h-0.5"
                  style={{
                    top: `${scanLine}%`,
                    background: "linear-gradient(90deg, transparent, #fbbf24, #f59e0b, #fbbf24, transparent)",
                    boxShadow: "0 0 8px 2px rgba(251,191,36,0.8)",
                    transition: "top 20ms linear",
                  }}
                />
                <div className="absolute top-2 left-2 w-5 h-5 border-t-2 border-l-2 border-amber-400" />
                <div className="absolute top-2 right-2 w-5 h-5 border-t-2 border-r-2 border-amber-400" />
                <div className="absolute bottom-2 left-2 w-5 h-5 border-b-2 border-l-2 border-amber-400" />
                <div className="absolute bottom-2 right-2 w-5 h-5 border-b-2 border-r-2 border-amber-400" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                  <div className="bg-black/60 text-amber-400 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                    {isRtl ? "מנתח שרטוט..." : "Analyzing sketch..."}
                  </div>
                </div>
              </div>
            </div>
          )}
          <AiProcessingAnimation
            currentStep={currentStep || (isRtl ? "מעבד שרטוט..." : "Processing sketch...")}
            elapsedSeconds={elapsedSeconds}
            isRtl={isRtl}
            featureLabel="redraw"
          />
          <button
            onClick={handleCancel}
            className="w-full h-9 rounded-xl text-xs font-medium transition-colors"
            style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444" }}
          >
            {isRtl ? "בטל עיבוד" : "Cancel processing"}
          </button>
        </div>
      )}

      {/* Error state */}
      {status === "error" && (
        <div
          className="rounded-2xl p-4 space-y-3"
          style={{
            background: errorCode === "IMAGE_NOT_CLEAR" ? "#fffbeb" : "rgba(239,68,68,0.05)",
            border: `1px solid ${errorCode === "IMAGE_NOT_CLEAR" ? "rgba(251,191,36,0.3)" : "rgba(239,68,68,0.2)"}`,
          }}
        >
          <div className="flex items-start gap-3">
            <AlertTriangle
              className="w-5 h-5 shrink-0 mt-0.5"
              style={{ color: errorCode === "IMAGE_NOT_CLEAR" ? "#f59e0b" : "#ef4444" }}
            />
            <div>
              <p className="font-semibold text-sm text-gray-800">
                {errorCode === "IMAGE_NOT_CLEAR"
                  ? isRtl ? "התמונה אינה ברורה מספיק" : "Image not clear enough"
                  : isRtl ? "שגיאה בעיבוד" : "Processing error"}
              </p>
              <p className="text-xs text-gray-500 mt-1">{errorMsg}</p>
              {errorCode === "IMAGE_NOT_CLEAR" && (
                <ul className="text-xs text-gray-500 mt-2 space-y-0.5 list-disc list-inside">
                  {isRtl ? (
                    <>
                      <li>צלם בתאורה טובה יותר</li>
                      <li>ודא שהשרטוט ממוקד וחד</li>
                      <li>הגדל את הניגודיות לפני הצילום</li>
                    </>
                  ) : (
                    <>
                      <li>Take photo in better lighting</li>
                      <li>Make sure the drawing is in focus</li>
                      <li>Increase contrast before photographing</li>
                    </>
                  )}
                </ul>
              )}
            </div>
          </div>
          <button
            onClick={reset}
            className="w-full h-9 rounded-xl text-xs font-semibold transition-all"
            style={{ background: "linear-gradient(135deg, #d97706, #f59e0b)", color: "white", border: "none" }}
          >
            {isRtl ? "נסה שוב" : "Try again"}
          </button>
        </div>
      )}

      {/* Success state */}
      {status === "success" && result && (
        <>
          {showSuccessOverlay && <SuccessOverlay onDone={() => setShowSuccessOverlay(false)} />}
          <ResultCard
            image={result.image}
            isRtl={isRtl}
            onDownload={() => setDownloadTarget(result.image)}
            onZoom={setZoomImg}
            originalPreview={imagePreview}
          />
          <ExportButtons
            svgContent={result.image.svgPreview}
            dxfUrl={result.image.dxfUrl}
            dxfFilename={result.image.dxfFilename ?? "architectural_sketch.dxf"}
            isRtl={isRtl}
            showVector={false}
            onToggleVector={() => {}}
            onMoreOptions={() => setDownloadTarget(result.image)}
          />
          <button
            onClick={reset}
            className="w-full h-9 rounded-xl text-xs font-medium transition-colors"
            style={{ background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.08)", color: "#6b7280" }}
          >
            {isRtl ? "המר שרטוט חדש" : "Convert new sketch"}
          </button>
        </>
      )}

      {/* DXF Download Dialog */}
      {downloadTarget && (
        <DxfDownloadDialog
          open={true}
          dxfUrl={downloadTarget.dxfUrl}
          defaultFilename={downloadTarget.dxfFilename ?? "architectural_sketch.dxf"}
          svgContent={result?.image.svgPreview ?? ""}
          segmentCount={downloadTarget.segmentCount}
          svgWidth={downloadTarget.width}
          svgHeight={downloadTarget.height}
          onClose={() => setDownloadTarget(null)}
        />
      )}

      {/* Zoom overlay */}
      {zoomImg && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setZoomImg(null)}
        >
          <button
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            onClick={() => setZoomImg(null)}
          >
            <X className="w-5 h-5 text-white" />
          </button>
          <img
            src={zoomImg}
            alt="zoom"
            className="max-w-full max-h-full rounded-xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

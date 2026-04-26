/**
 * ArchitecturalAiTab.tsx
 *
 * Feature: "שרטוט אדריכלי AI → DXF"
 *
 * User fills in mandatory architectural parameters (drawing type, scale, units, dimensions)
 * + optional parameters (wall thickness, style) + text description
 * → AI generates 3 professional architectural drawings → potrace → DXF
 *
 * Cloned from AiGeneratorTab with:
 *  - Teal/slate color scheme instead of indigo/purple
 *  - Mandatory parameters table (drawing type, scale, units, dimensions)
 *  - Optional parameters (wall thickness, style)
 *  - Architectural-specific prompting
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { useBugReport } from "@/hooks/useBugReport";
import { DxfDownloadDialog } from "@/components/DxfDownloadDialog";
import { ExportButtons } from "@/components/ExportButtons";
import { AiProcessingAnimation } from "@/components/AiProcessingAnimation";
import { AiRefinePanel, type RefineResult } from "@/components/AiRefinePanel";
import { SvgPanZoomViewer as SvgZoomViewer } from "@/components/SvgPanZoomViewer";
import { ReportIssueButton } from "@/components/ReportIssueButton";
import { useTokenCost } from "@/hooks/useTokenCost";
import {
  Wand2,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ZoomIn,
  RefreshCw,
  ChevronLeft,
  Building2,
  Ruler,
  ChevronDown,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
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

type Status = "idle" | "loading" | "success" | "error";

const LS_KEY_JOB = "arch_ai_jobId";
const LS_KEY_RESULT = "arch_ai_result";
const LS_KEY_PROMPT = "arch_ai_prompt";

// ─── Drawing types ─────────────────────────────────────────────────────────────
const DRAWING_TYPES_HE = [
  { value: "floor_plan", label: "תוכנית קומה" },
  { value: "elevation", label: "חזית" },
  { value: "section", label: "חתך" },
  { value: "site_plan", label: "תוכנית מגרש" },
  { value: "detail", label: "פרט בינוי" },
  { value: "perspective", label: "פרספקטיבה" },
];
const DRAWING_TYPES_EN = [
  { value: "floor_plan", label: "Floor Plan" },
  { value: "elevation", label: "Elevation" },
  { value: "section", label: "Section" },
  { value: "site_plan", label: "Site Plan" },
  { value: "detail", label: "Construction Detail" },
  { value: "perspective", label: "Perspective" },
];

const SCALES = [
  { value: "1:50", label: "1:50" },
  { value: "1:100", label: "1:100" },
  { value: "1:200", label: "1:200" },
  { value: "1:500", label: "1:500" },
  { value: "1:1000", label: "1:1000" },
  { value: "custom", label: "מותאם אישית / Custom" },
];

const UNITS_HE = [
  { value: "mm", label: "מ\"מ (מילימטר)" },
  { value: "cm", label: "ס\"מ (סנטימטר)" },
  { value: "m", label: "מטר" },
];
const UNITS_EN = [
  { value: "mm", label: "mm (Millimeter)" },
  { value: "cm", label: "cm (Centimeter)" },
  { value: "m", label: "m (Meter)" },
];

const WALL_THICKNESS_HE = [
  { value: "", label: "לא רלוונטי" },
  { value: "thin", label: "דק — 10 ס\"מ (קיר פנימי)" },
  { value: "standard", label: "רגיל — 20 ס\"מ (קיר חיצוני)" },
  { value: "thick", label: "עבה — 30 ס\"מ (קיר נושא)" },
];
const WALL_THICKNESS_EN = [
  { value: "", label: "Not relevant" },
  { value: "thin", label: "Thin — 10 cm (Interior wall)" },
  { value: "standard", label: "Standard — 20 cm (Exterior wall)" },
  { value: "thick", label: "Thick — 30 cm (Load-bearing wall)" },
];

const ROOM_COUNT_OPTIONS = [
  { value: "", label: "---" },
  { value: "1", label: "1" },
  { value: "2", label: "2" },
  { value: "3", label: "3" },
  { value: "4", label: "4" },
  { value: "5", label: "5" },
  { value: "6+", label: "6+" },
];

const STYLE_OPTIONS_HE = [
  { value: "clean", label: "נקי — קווים בלבד" },
  { value: "with_dimensions", label: "עם מידות וסימנים" },
  { value: "with_furniture", label: "עם ריהוט" },
  { value: "detailed", label: "מפורט — חומרים ומרקטים" },
];
const STYLE_OPTIONS_EN = [
  { value: "clean", label: "Clean — Lines only" },
  { value: "with_dimensions", label: "With dimensions & symbols" },
  { value: "with_furniture", label: "With furniture" },
  { value: "detailed", label: "Detailed — Materials & textures" },
];

// ─── Image Zoom Modal ─────────────────────────────────────────────────────────
function ImageZoomModal({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
    >
      <img
        src={src}
        alt={alt}
        className="max-w-full max-h-full rounded-xl object-contain"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

// ─── Param Row ────────────────────────────────────────────────────────────────
function ParamRow({
  label,
  required,
  children,
  isRtl,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  isRtl: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-gray-600 flex items-center gap-1">
        {label}
        {required && <span style={{ color: "#0d9488" }}>*</span>}
      </label>
      {children}
    </div>
  );
}

// ─── Select Field ─────────────────────────────────────────────────────────────
function SelectField({
  value,
  onChange,
  options,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full appearance-none rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 pr-8 focus:outline-none focus:ring-2 focus:border-teal-400 disabled:opacity-50"
        style={{ direction: "inherit" }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute top-1/2 -translate-y-1/2 right-2.5 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
interface ArchitecturalAiTabProps {
  onOpenAuth?: () => void;
  onInsufficientTokens?: () => void;
}

export function ArchitecturalAiTab({ onOpenAuth, onInsufficientTokens }: ArchitecturalAiTabProps) {
  const { isRtl, language } = useLanguage();
  const { refetch: refetchTokens } = trpc.tokens.balance.useQuery(undefined, { enabled: false });
  const { reportBug } = useBugReport();
  const { getCost } = useTokenCost();
  const cost = getCost("ai_generate");

  // ── Mandatory parameters ───────────────────────────────────────────────────
  const drawingTypes = isRtl ? DRAWING_TYPES_HE : DRAWING_TYPES_EN;
  const units = isRtl ? UNITS_HE : UNITS_EN;
  const wallThicknessOpts = isRtl ? WALL_THICKNESS_HE : WALL_THICKNESS_EN;
  const styleOpts = isRtl ? STYLE_OPTIONS_HE : STYLE_OPTIONS_EN;

  const [drawingType, setDrawingType] = useState("floor_plan");
  const [scale, setScale] = useState("1:100");
  const [customScale, setCustomScale] = useState("");
  const [unit, setUnit] = useState("m");
  const [widthVal, setWidthVal] = useState("");
  const [lengthVal, setLengthVal] = useState("");
  const [heightVal, setHeightVal] = useState(""); // for elevation/section
  const [roomCount, setRoomCount] = useState(""); // for floor plans only
  // Optional
  const [wallThickness, setWallThickness] = useState("");
  const [style, setStyle] = useState("clean");
  const [showOptional, setShowOptional] = useState(false);

  // ── Prompt & generation state ──────────────────────────────────────────────
  const [prompt, setPrompt] = useState(() => localStorage.getItem(LS_KEY_PROMPT) ?? "");
  const setPromptPersisted = useCallback((v: string) => {
    localStorage.setItem(LS_KEY_PROMPT, v);
    setPrompt(v);
  }, []);

  const [modifications, setModifications] = useState("");
  const [status, setStatus] = useState<Status>(() => {
    if (localStorage.getItem(LS_KEY_JOB)) return "idle";
    if (localStorage.getItem(LS_KEY_RESULT)) return "success";
    return "idle";
  });
  const [images, setImages] = useState<AiImage[]>(() => {
    if (!localStorage.getItem(LS_KEY_JOB)) {
      try {
        const cached = localStorage.getItem(LS_KEY_RESULT);
        if (cached) return JSON.parse(cached) as AiImage[];
      } catch (_) { /* ignore */ }
    }
    return [];
  });
  const [selectedIdx, setSelectedIdx] = useState<number | null>(() => {
    if (!localStorage.getItem(LS_KEY_JOB) && localStorage.getItem(LS_KEY_RESULT)) return 0;
    return null;
  });
  const [showModify, setShowModify] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [downloadImg, setDownloadImg] = useState<AiImage | null>(null);
  const [zoomImg, setZoomImg] = useState<{ src: string; alt: string } | null>(null);
  const [showVector, setShowVector] = useState(false);
  const [imgLoaded, setImgLoaded] = useState<Record<number, boolean>>({});
  const [jobId, setJobId] = useState<string | null>(() => localStorage.getItem(LS_KEY_JOB));
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [progressStep, setProgressStep] = useState(0);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedStartRef = useRef<number>(0);

  const progressSteps = isRtl
    ? [
        { label: "מנתח פרמטרים אדריכליים...", duration: 6000 },
        { label: "מייצר 3 שרטוטים...", duration: 28000 },
        { label: "מעבד קווים ל-DXF...", duration: 20000 },
        { label: "מסיים ומייעל...", duration: 15000 },
      ]
    : [
        { label: "Analyzing architectural parameters...", duration: 6000 },
        { label: "Generating 3 drawings...", duration: 28000 },
        { label: "Processing lines to DXF...", duration: 20000 },
        { label: "Finalizing and optimizing...", duration: 15000 },
      ];

  const startElapsedTimer = useCallback(() => {
    setElapsedSeconds(0);
    elapsedStartRef.current = Date.now();
    if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    elapsedTimerRef.current = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - elapsedStartRef.current) / 1000));
    }, 1000);
  }, []);

  const stopElapsedTimer = useCallback(() => {
    if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    setElapsedSeconds(0);
  }, []);

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRtl]);

  const stopProgressSteps = useCallback(() => {
    if (progressTimerRef.current) clearTimeout(progressTimerRef.current);
    setProgressStep(0);
    stopElapsedTimer();
  }, [stopElapsedTimer]);

  const setJobIdPersisted = useCallback((id: string | null) => {
    if (id) localStorage.setItem(LS_KEY_JOB, id);
    else localStorage.removeItem(LS_KEY_JOB);
    setJobId(id);
  }, []);

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
          try { localStorage.setItem(LS_KEY_RESULT, JSON.stringify(result.images)); } catch (_) { /* quota */ }
          setSelectedIdx(0);
          setStatus("success");
          setShowModify(false);
          setModifications("");
          setJobIdPersisted(null);
          refetchTokens();
          toast.success(isRtl ? "השרטוט מוכן! לחץ הורד DXF" : "Drawing ready! Click Download DXF");
        } else if (data.status === "error") {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          stopProgressSteps();
          const msg = data.message || (isRtl ? "שגיאה ביצירה" : "Generation error");
          setErrorMsg(msg);
          setStatus("error");
          setJobIdPersisted(null);
          toast.error(msg);
          reportBug({ errorType: "ai_failed", errorMessage: msg, feature: "arch_ai" });
        } else if (data.status === "cancelled") {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          stopProgressSteps();
          setStatus("idle");
          setJobIdPersisted(null);
        }
      } catch (_) { /* network error, keep trying */ }
    }, 3000);
  }, [isRtl, refetchTokens, setJobIdPersisted, stopProgressSteps, reportBug]);

  useEffect(() => {
    const savedId = localStorage.getItem(LS_KEY_JOB);
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
        toast.success(isRtl ? "העיבוד בוטל" : "Processing cancelled");
        refetchTokens();
      }
    } catch (_) { /* ignore */ }
    setStatus("idle");
    setJobIdPersisted(null);
    stopProgressSteps();
  }, [jobId, isRtl, refetchTokens, setJobIdPersisted, stopProgressSteps]);

  // ── Validation ─────────────────────────────────────────────────────────────
  const isElevationOrSection = drawingType === "elevation" || drawingType === "section";
  const isFloorPlan = drawingType === "floor_plan" || drawingType === "site_plan";
  const effectiveScale = scale === "custom" ? customScale : scale;

  const isValid = () => {
    if (!drawingType) return false;
    if (!effectiveScale.trim()) return false;
    if (!unit) return false;
    if (!widthVal.trim() || isNaN(parseFloat(widthVal))) return false;
    if (!lengthVal.trim() || isNaN(parseFloat(lengthVal))) return false;
    if (isElevationOrSection && (!heightVal.trim() || isNaN(parseFloat(heightVal)))) return false;
    return true;
  };

  // ── Build architectural prompt ─────────────────────────────────────────────
  const buildArchitecturalPrompt = (isModify = false) => {
    const drawingTypeLabel = drawingTypes.find((d) => d.value === drawingType)?.label ?? drawingType;
    const unitLabel = units.find((u) => u.value === unit)?.label?.split(" ")[0] ?? unit;
    const styleLabel = styleOpts.find((s) => s.value === style)?.label ?? style;
    const wallLabel = wallThicknessOpts.find((w) => w.value === wallThickness)?.label ?? "";

    let dims = `${widthVal}×${lengthVal} ${unitLabel}`;
    if (isElevationOrSection && heightVal) dims += ` × גובה ${heightVal} ${unitLabel}`;

    let archPrompt = isRtl
      ? `${drawingTypeLabel} אדריכלי מקצועי, קנה מידה ${effectiveScale}, מידות: ${dims}, סגנון: ${styleLabel}`
      : `Professional architectural ${drawingTypeLabel}, scale ${effectiveScale}, dimensions: ${dims}, style: ${styleLabel}`;

    if (wallThickness && wallLabel) {
      archPrompt += isRtl ? `, עובי קירות: ${wallLabel}` : `, wall thickness: ${wallLabel}`;
    }

    // Add room count for floor plans
    if (isFloorPlan && roomCount) {
      archPrompt += isRtl
        ? `, מספר חדרי שינה: ${roomCount}`
        : `, number of bedrooms: ${roomCount}`;
    }

    if (prompt.trim()) {
      archPrompt += isRtl ? `\nפרטים נוספים: ${prompt.trim()}` : `\nAdditional details: ${prompt.trim()}`;
    }

    if (isModify && modifications.trim()) {
      archPrompt += isRtl ? `\nשינויים מבוקשים: ${modifications.trim()}` : `\nRequested changes: ${modifications.trim()}`;
    }

    return archPrompt;
  };

  // ── Generate ───────────────────────────────────────────────────────────────
  const generate = async (isModify = false) => {
    if (!isValid()) {
      toast.error(isRtl ? "יש למלא את כל השדות החובה (מסומנים ב-*)" : "Please fill all required fields (marked with *)");
      return;
    }

    const fullPrompt = buildArchitecturalPrompt(isModify);
    setStatus("loading");
    setImages([]);
    setSelectedIdx(null);
    setErrorMsg("");
    startProgressSteps();
    startElapsedTimer();

    try {
      const res = await fetch("/api/generate-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          prompt: fullPrompt,
          modifications: isModify ? modifications.trim() : undefined,
          landscapeMode: false,
          minGapMm: 0.5,
          isArchitectural: true,
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
        if (onInsufficientTokens) onInsufficientTokens();
        toast.error(msg, {
          action: { label: language === "he" ? "רכוש קרדיטים" : "Buy Credits", onClick: () => { window.location.href = "/buy"; } },
          duration: 6000,
        });
        return;
      }
      if (!res.ok) throw new Error(data.message ?? data.error ?? (isRtl ? "שגיאה ביצירה" : "Generation error"));

      if (data.jobId) {
        setJobIdPersisted(data.jobId);
        startPolling(data.jobId);
        if ("Notification" in window && Notification.permission === "default") {
          Notification.requestPermission();
        }
      } else {
        setImages(data.images as AiImage[]);
        setStatus("success");
        setShowModify(false);
        setModifications("");
        refetchTokens();
        toast.success(isRtl ? "השרטוט מוכן!" : "Drawing ready!");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (isRtl ? "שגיאה ביצירה" : "Generation error");
      setErrorMsg(msg);
      setStatus("error");
      toast.error(msg);
      reportBug({ errorType: "ai_failed", errorMessage: msg, feature: "arch_ai" });
    }
  };

  const handleDownload = (img: AiImage) => {
    setDownloadImg(img);
    setDownloadOpen(true);
  };

  const selected = selectedIdx !== null ? images[selectedIdx] : null;

  // ── Teal accent colors ─────────────────────────────────────────────────────
  const TEAL_GRADIENT = "linear-gradient(135deg, #0d9488, #0891b2)";
  const TEAL_LIGHT = "#f0fdfa";
  const TEAL_BORDER = "#99f6e4";
  const TEAL_ACCENT = "#0d9488";

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
          defaultFilename={downloadImg.dxfFilename ?? `arch-drawing-${Date.now()}.dxf`}
          segmentCount={downloadImg.segmentCount}
          svgWidth={downloadImg.realWidth ?? downloadImg.width}
          svgHeight={downloadImg.realHeight ?? downloadImg.height}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        {/* ── LEFT COLUMN: Parameters + Prompt ─────────────────────────────── */}
        <div className="flex flex-col gap-4">

          {/* ── Mandatory Parameters Table ─────────────────────────────────── */}
          <div
            className="rounded-xl p-5"
            style={{ background: "#ffffff", border: `1px solid ${TEAL_BORDER}`, boxShadow: "0 1px 4px rgba(13,148,136,0.08)" }}
          >
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: TEAL_LIGHT }}>
                <Ruler className="w-3.5 h-3.5" style={{ color: TEAL_ACCENT }} />
              </div>
              <h2 className="font-semibold text-sm text-gray-700">
                {isRtl ? "פרמטרים חובה לשרטוט מקצועי" : "Required Drawing Parameters"}
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {/* Row 1: Drawing type */}
              <ParamRow label={isRtl ? "סוג שרטוט" : "Drawing Type"} required isRtl={isRtl}>
                <SelectField
                  value={drawingType}
                  onChange={setDrawingType}
                  options={drawingTypes}
                  disabled={status === "loading"}
                />
              </ParamRow>

              {/* Row 2: Scale + Units in one row */}
              <div className="grid grid-cols-2 gap-3">
                <ParamRow label={isRtl ? "קנה מידה" : "Scale"} required isRtl={isRtl}>
                  <SelectField
                    value={scale}
                    onChange={setScale}
                    options={SCALES}
                    disabled={status === "loading"}
                  />
                </ParamRow>
                <ParamRow label={isRtl ? "יחידות מידה" : "Units"} required isRtl={isRtl}>
                  <SelectField
                    value={unit}
                    onChange={setUnit}
                    options={units}
                    disabled={status === "loading"}
                  />
                </ParamRow>
              </div>

              {/* Custom scale input */}
              {scale === "custom" && (
                <div>
                  <input
                    type="text"
                    placeholder={isRtl ? "למשל: 1:75" : "e.g. 1:75"}
                    value={customScale}
                    onChange={(e) => setCustomScale(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2"
                    style={{ direction: "ltr" }}
                    disabled={status === "loading"}
                  />
                </div>
              )}

              {/* Row 3: Room count — floor plans only */}
              {isFloorPlan && (
                <ParamRow label={isRtl ? "מספר חדרי שינה" : "Number of Bedrooms"} isRtl={isRtl}>
                  <SelectField
                    value={roomCount}
                    onChange={setRoomCount}
                    options={ROOM_COUNT_OPTIONS}
                    disabled={status === "loading"}
                  />
                </ParamRow>
              )}

              {/* Row 4: Dimensions */}
              <ParamRow
                label={
                  isRtl
                    ? `מידות החלל (${units.find((u2) => u2.value === unit)?.label?.split(" ")[0] ?? unit})`
                    : `Space Dimensions (${units.find((u2) => u2.value === unit)?.label?.split(" ")[0] ?? unit})`
                }
                required
                isRtl={isRtl}
              >
                <div className={`grid gap-2 ${isElevationOrSection ? "grid-cols-3" : "grid-cols-2"}`}>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      placeholder={isRtl ? "רוחב" : "Width"}
                      value={widthVal}
                      onChange={(e) => setWidthVal(e.target.value)}
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 text-center"
                      disabled={status === "loading"}
                    />
                    <span className="absolute -bottom-4 left-0 right-0 text-center text-[10px] text-gray-400">
                      {isRtl ? "רוחב" : "Width"}
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      placeholder={isRtl ? "אורך" : "Length"}
                      value={lengthVal}
                      onChange={(e) => setLengthVal(e.target.value)}
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 text-center"
                      disabled={status === "loading"}
                    />
                    <span className="absolute -bottom-4 left-0 right-0 text-center text-[10px] text-gray-400">
                      {isRtl ? "אורך" : "Length"}
                    </span>
                  </div>
                  {isElevationOrSection && (
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        placeholder={isRtl ? "גובה" : "Height"}
                        value={heightVal}
                        onChange={(e) => setHeightVal(e.target.value)}
                        className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 text-center"
                        disabled={status === "loading"}
                      />
                      <span className="absolute -bottom-4 left-0 right-0 text-center text-[10px] text-gray-400">
                        {isRtl ? "גובה" : "Height"}
                      </span>
                    </div>
                  )}
                </div>
                <div className="mt-5" />
              </ParamRow>
            </div>

            {/* ── Optional Parameters Toggle ──────────────────────────────── */}
            <button
              type="button"
              onClick={() => setShowOptional((v) => !v)}
              className="mt-4 w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all"
              style={{
                background: showOptional ? TEAL_LIGHT : "#f8fafc",
                border: `1px solid ${showOptional ? TEAL_BORDER : "#e2e8f0"}`,
                color: showOptional ? TEAL_ACCENT : "#6b7280",
              }}
            >
              <span className="flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" />
                {isRtl ? "פרמטרים נוספים (אופציונלי)" : "Additional Parameters (optional)"}
              </span>
              <ChevronDown
                className="w-3.5 h-3.5 transition-transform"
                style={{ transform: showOptional ? "rotate(180deg)" : "rotate(0deg)" }}
              />
            </button>

            {showOptional && (
              <div className="mt-3 grid grid-cols-1 gap-3">
                <ParamRow label={isRtl ? "עובי קירות" : "Wall Thickness"} isRtl={isRtl}>
                  <SelectField
                    value={wallThickness}
                    onChange={setWallThickness}
                    options={wallThicknessOpts}
                    disabled={status === "loading"}
                  />
                </ParamRow>
                <ParamRow label={isRtl ? "סגנון שרטוט" : "Drawing Style"} isRtl={isRtl}>
                  <SelectField
                    value={style}
                    onChange={setStyle}
                    options={styleOpts}
                    disabled={status === "loading"}
                  />
                </ParamRow>
              </div>
            )}
          </div>

          {/* ── Description (optional free text) ─────────────────────────── */}
          <div
            className="rounded-xl p-5"
            style={{ background: "#ffffff", border: "1px solid #e2e8f0", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}
          >
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: TEAL_LIGHT }}>
                <Wand2 className="w-3.5 h-3.5" style={{ color: TEAL_ACCENT }} />
              </div>
              <h2 className="font-semibold text-sm text-gray-700">
                {isRtl ? "תיאור נוסף (אופציונלי)" : "Additional Description (optional)"}
              </h2>
            </div>
            <Textarea
              placeholder={
                isRtl
                  ? "תאר פרטים נוספים: חדרים, פתחים, חלונות, מרפסות, חומרים מיוחדים..."
                  : "Describe additional details: rooms, openings, windows, balconies, special materials..."
              }
              value={prompt}
              onChange={(e) => setPromptPersisted(e.target.value)}
              className="resize-none text-sm min-h-[80px] text-gray-800 bg-gray-50 border-gray-200"
              style={{ textAlign: isRtl ? "right" : "left" }}
              dir={isRtl ? "rtl" : "ltr"}
              disabled={status === "loading"}
            />

            {/* Generate button */}
            <button
              className="w-full mt-3 h-13 font-bold text-base rounded-xl flex items-center justify-center gap-2 transition-all hover:opacity-90"
              style={{
                background:
                  status === "loading" || !isValid()
                    ? "linear-gradient(135deg, #99f6e4, #a5f3fc)"
                    : TEAL_GRADIENT,
                color: "white",
                border: "none",
                boxShadow:
                  status === "loading" || !isValid()
                    ? "none"
                    : "0 4px 14px rgba(13,148,136,0.4)",
                cursor: status === "loading" || !isValid() ? "not-allowed" : "pointer",
              }}
              onClick={() => generate(false)}
              disabled={status === "loading" || !isValid()}
            >
              {status === "loading" ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {isRtl ? "מייצר שרטוט..." : "Generating drawing..."}
                </>
              ) : (
                <>
                  <Building2 className="w-4 h-4" />
                  {isRtl ? "צור 3 שרטוטים" : "Generate 3 Drawings"}
                  {cost > 0 && (
                    <span style={{ fontSize: "0.72em", opacity: 0.8, marginInlineStart: 6 }}>
                      ({cost} {isRtl ? "קרדיטים" : "credits"})
                    </span>
                  )}
                </>
              )}
            </button>
          </div>
        </div>

        {/* ── RIGHT COLUMN: Results ─────────────────────────────────────────── */}
        <div className="flex flex-col gap-4">
          {/* Loading */}
          {status === "loading" && (
            <AiProcessingAnimation
              elapsedSeconds={elapsedSeconds}
              currentStep={progressSteps[progressStep]?.label}
              jobId={jobId}
              onCancel={handleCancel}
              isRtl={isRtl}
              accentColor={TEAL_ACCENT}
              accentGradient={TEAL_GRADIENT}
              featureLabel={isRtl ? "שרטוט אדריכלי" : "Architectural Drawing"}
            />
          )}

          {/* Error */}
          {status === "error" && (
            <div
              className="rounded-xl p-6 flex flex-col items-center gap-3 text-center"
              style={{ background: "#fff5f5", border: "1px solid #fecaca" }}
            >
              <AlertCircle className="w-10 h-10 text-red-400" />
              <p className="font-semibold text-red-600">{isRtl ? "שגיאה ביצירה" : "Generation error"}</p>
              <p className="text-sm text-gray-500">{errorMsg}</p>
              <div className="flex gap-2 flex-wrap justify-center">
                <button
                  className="text-sm px-4 py-2 rounded-lg font-medium transition-all bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200"
                  onClick={() => setStatus("idle")}
                >
                  {isRtl ? "נסה שוב" : "Try again"}
                </button>
                {errorMsg && (errorMsg.includes("אסימונים") || errorMsg.toLowerCase().includes("token")) && (
                  <button
                    className="text-sm px-4 py-2 rounded-lg font-semibold transition-all"
                    style={{ background: TEAL_ACCENT, color: "white", border: "none" }}
                    onClick={() => (window.location.href = "/buy")}
                  >
                    {isRtl ? "קנה קרדיטים" : "Buy Credits"}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Gallery */}
          {status === "success" && images.length > 0 && (
            <>
              <div>
                <p className="text-sm font-semibold mb-3 text-gray-600">
                  {isRtl ? "בחר שרטוט" : "Select Drawing"}
                </p>
                <div className="flex flex-col gap-3">
                  {images.map((img, idx) => (
                    <div
                      key={idx}
                      className="relative rounded-xl cursor-pointer transition-all overflow-hidden"
                      style={{
                        background: "#ffffff",
                        border: selectedIdx === idx ? `2px solid ${TEAL_ACCENT}` : "1px solid #e2e8f0",
                        boxShadow:
                          selectedIdx === idx
                            ? `0 0 0 3px rgba(13,148,136,0.12)`
                            : "0 1px 4px rgba(0,0,0,0.05)",
                      }}
                      onClick={() => setSelectedIdx(idx)}
                    >
                      <div
                        className="flex items-center justify-center p-3 relative overflow-hidden bg-gray-50"
                        style={{ minHeight: imgLoaded[idx] ? "auto" : 220 }}
                      >
                        {!imgLoaded[idx] && (
                          <div className="absolute inset-0 rounded-lg overflow-hidden">
                            <div
                              className="w-full h-full animate-pulse"
                              style={{
                                background:
                                  "linear-gradient(90deg, #f0fdfa 0%, #ccfbf1 50%, #f0fdfa 100%)",
                                backgroundSize: "200% 100%",
                              }}
                            />
                          </div>
                        )}
                        <img
                          src={img.imageUrl}
                          alt={`${isRtl ? "שרטוט" : "Drawing"} ${idx + 1}`}
                          className="w-full h-auto object-contain rounded-lg transition-opacity duration-500"
                          style={{ maxHeight: 280, opacity: imgLoaded[idx] ? 1 : 0 }}
                          onLoad={() => setImgLoaded((prev) => ({ ...prev, [idx]: true }))}
                        />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setZoomImg({ src: img.imageUrl, alt: `${isRtl ? "שרטוט" : "Drawing"} ${idx + 1}` });
                          }}
                          className="absolute bottom-2 left-2 w-8 h-8 rounded-full flex items-center justify-center transition-colors bg-white/80 hover:bg-white border border-gray-200"
                        >
                          <ZoomIn className="w-4 h-4 text-gray-600" />
                        </button>
                      </div>
                      <div className="px-3 py-2 flex items-center justify-between border-t border-gray-100">
                        <span className="text-xs font-medium text-gray-500">
                          {isRtl ? "וריאציה" : "Variation"} {idx + 1}
                        </span>
                        <span className="text-xs text-gray-400">
                          {img.segmentCount.toLocaleString()} {isRtl ? "קווים" : "lines"}
                        </span>
                      </div>
                      {selectedIdx === idx && (
                        <div
                          className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center shadow-sm"
                          style={{ background: TEAL_ACCENT }}
                        >
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
                  style={{
                    background: "#ffffff",
                    border: `1px solid ${TEAL_BORDER}`,
                    boxShadow: `0 1px 4px rgba(13,148,136,0.08)`,
                  }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle2 className="w-4 h-4" style={{ color: TEAL_ACCENT }} />
                    <span className="font-semibold text-sm text-gray-700">
                      {isRtl ? "וריאציה" : "Variation"} {selectedIdx! + 1}{" "}
                      {isRtl ? "נבחרה" : "selected"}
                    </span>
                  </div>

                  {/* AI Image preview */}
                  <div
                    className="border rounded-xl overflow-hidden bg-white mb-3 flex items-center justify-center relative group cursor-zoom-in"
                    style={{ minHeight: 200 }}
                    onClick={() =>
                      setZoomImg({ src: selected.imageUrl, alt: `${isRtl ? "שרטוט" : "Drawing"} ${selectedIdx! + 1}` })
                    }
                  >
                    <img
                      src={selected.imageUrl}
                      alt={`${isRtl ? "שרטוט" : "Drawing"} ${selectedIdx! + 1}`}
                      className="max-w-full object-contain"
                      style={{ maxHeight: 320 }}
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                      <ZoomIn className="w-6 h-6 text-white opacity-0 group-hover:opacity-80 transition-opacity drop-shadow" />
                    </div>
                  </div>

                  {selected.svgPreview && showVector && (
                    <div className="mb-3">
                      <SvgZoomViewer
                        svgContent={selected.svgPreview}
                        isRtl={isRtl}
                      />
                    </div>
                  )}

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {[
                      { v: selected.segmentCount.toLocaleString(), l: isRtl ? "קווים" : "Lines" },
                      {
                        v: ((selected.realWidth ?? selected.width) / 96 * 25.4).toFixed(1),
                        l: isRtl ? "רוחב מ\"מ" : "Width mm",
                      },
                      {
                        v: ((selected.realHeight ?? selected.height) / 96 * 25.4).toFixed(1),
                        l: isRtl ? "גובה מ\"מ" : "Height mm",
                      },
                    ].map(({ v, l }, i) => (
                      <div
                        key={i}
                        className="rounded-xl p-2 text-center"
                        style={{ background: TEAL_LIGHT, border: `1px solid ${TEAL_BORDER}` }}
                      >
                        <p className="text-base font-bold" style={{ color: TEAL_ACCENT }}>
                          {v}
                        </p>
                        <p className="text-xs text-gray-500">{l}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mb-2">
                    <ExportButtons
                      svgContent={selected.svgPreview}
                      dxfUrl={selected.dxfUrl}
                      dxfFilename={selected.dxfFilename || "arch_drawing.dxf"}
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
                    originalPrompt={buildArchitecturalPrompt()}
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
                    onInsufficientTokens={onInsufficientTokens}
                  />

                  <div className="flex gap-2 mt-2">
                    <button
                      className="flex-1 flex items-center justify-center gap-1.5 text-sm py-2 rounded-xl transition-all"
                      style={{ background: "#f1f5f9", border: "1px solid #e2e8f0", color: "#374151" }}
                      onClick={() => setShowModify(!showModify)}
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      {isRtl ? "בקש שינויים" : "Request changes"}
                    </button>
                    <button
                      className="flex-1 flex items-center justify-center gap-1.5 text-sm py-2 rounded-xl transition-all"
                      style={{ background: "#f1f5f9", border: "1px solid #e2e8f0", color: "#374151" }}
                      onClick={() => { setImages([]); setSelectedIdx(null); setStatus("idle"); }}
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      {isRtl ? "שרטוט חדש" : "New drawing"}
                    </button>
                  </div>

                  {/* Report issue */}
                  <div className="flex justify-end mt-1">
                    <ReportIssueButton resultImageUrl={selected.imageUrl} feature="arch_ai" />
                  </div>

                  {/* Modify panel */}
                  {showModify && (
                    <div
                      className="mt-3 p-3 rounded-xl"
                      style={{ background: TEAL_LIGHT, border: `1px solid ${TEAL_BORDER}` }}
                    >
                      <p className="text-xs font-medium mb-2 text-gray-600">
                        {isRtl ? "תאר את השינויים הרצויים:" : "Describe the changes you want:"}
                      </p>
                      <Textarea
                        placeholder={isRtl ? "למשל: הוסף חלון בקיר הצפוני, הגדל את המטבח..." : "e.g. Add window on north wall, enlarge kitchen..."}
                        value={modifications}
                        onChange={(e) => setModifications(e.target.value)}
                        className="resize-none text-sm min-h-[70px] mb-2 bg-white border-gray-200 text-gray-800"
                        style={{ textAlign: isRtl ? "right" : "left" }}
                        dir={isRtl ? "rtl" : "ltr"}
                      />
                      <button
                        className="w-full py-2 text-sm font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-all"
                        style={{
                          background: modifications.trim() ? TEAL_GRADIENT : "#ccfbf1",
                          color: modifications.trim() ? "white" : "#99f6e4",
                          border: "none",
                          cursor: modifications.trim() ? "pointer" : "not-allowed",
                        }}
                        onClick={() => generate(true)}
                        disabled={!modifications.trim()}
                      >
                        <Wand2 className="w-3.5 h-3.5" />
                        {isRtl ? "צור 3 שרטוטים מעודכנים" : "Generate 3 updated drawings"}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* Empty state */}
          {status === "idle" && images.length === 0 && (
            <div
              className="rounded-xl flex flex-col items-center justify-center gap-4 text-center"
              style={{
                background: `linear-gradient(135deg, ${TEAL_LIGHT} 0%, #ecfdf5 100%)`,
                border: `2px dashed ${TEAL_BORDER}`,
                minHeight: 320,
                padding: "2rem",
              }}
            >
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{ background: TEAL_GRADIENT }}
              >
                <Building2 className="w-8 h-8 text-white" />
              </div>
              <div>
                <p className="font-bold text-gray-700 text-base mb-1">
                  {isRtl ? "פרמטרים → שרטוט DXF" : "Parameters → DXF Drawing"}
                </p>
                <p className="text-sm text-gray-400">
                  {isRtl
                    ? "מלא את הפרמטרים בצד שמאל וה-AI יצייר שרטוט אדריכלי מקצועי"
                    : "Fill parameters on the left and AI will generate a professional architectural drawing"}
                </p>
              </div>
              {/* Tips */}
              <div
                className="w-full text-start rounded-xl p-4"
                style={{ background: "#ffffff", border: `1px solid ${TEAL_BORDER}` }}
              >
                <h3 className="font-semibold text-xs mb-2" style={{ color: TEAL_ACCENT }}>
                  {isRtl ? "💡 טיפים לשרטוט מקצועי" : "💡 Tips for professional drawings"}
                </h3>
                <ul className="space-y-1.5 text-xs text-gray-600">
                  <li className="flex gap-2">
                    <span className="shrink-0" style={{ color: TEAL_ACCENT }}>•</span>
                    <span>{isRtl ? "קנה מידה 1:100 מתאים לתוכניות קומה רגילות" : "Scale 1:100 is standard for floor plans"}</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="shrink-0" style={{ color: TEAL_ACCENT }}>•</span>
                    <span>{isRtl ? "ציין מידות בס\"מ לדיוק מרבי" : "Specify dimensions in cm for best accuracy"}</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="shrink-0" style={{ color: TEAL_ACCENT }}>•</span>
                    <span>{isRtl ? "הוסף תיאור מפורט לתוצאות טובות יותר" : "Add detailed description for better results"}</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="shrink-0">💡</span>
                    <span>{isRtl ? "ניתן לשפר כל שרטוט עם פאנל השיפור" : "You can refine any drawing with the refine panel"}</span>
                  </li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

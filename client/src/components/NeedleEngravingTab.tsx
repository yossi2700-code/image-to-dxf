/**
 * NeedleEngravingTab.tsx
 * Diamond needle engraving feature — inline tab version matching AiTraceTab style.
 * Two modes:
 *   1. Upload image → process for engraving
 *   2. AI generate → create image from prompt → process for engraving
 *
 * v2: AiProcessingAnimation with elapsed timer, step labels, server warm-up message.
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTokenCost } from "@/hooks/useTokenCost";
import { trpc } from "@/lib/trpc";
import { AiProcessingAnimation } from "@/components/AiProcessingAnimation";
import {
  Upload,
  Download,
  ImageIcon,
  CheckCircle2,
  X,
  Sparkles,
  Wand2,
  Info,
} from "lucide-react";

interface ProcessResult {
  bmpUrl: string;
  previewUrl: string;
  width: number;
  height: number;
  bitDepth: number;
  fileSizeKB: number;
  wasColorConverted: boolean;
  generatedImageUrl?: string;
}

type Mode = "upload" | "ai";
type Status = "idle" | "loading" | "success" | "error";

interface NeedleEngravingTabProps {
  onOpenAuth: () => void;
  onInsufficientTokens?: () => void;
}

export function NeedleEngravingTab({ onOpenAuth, onInsufficientTokens }: NeedleEngravingTabProps) {
  const { isRtl } = useLanguage();
  const { getCost } = useTokenCost();
  const cost = getCost("needle_engraving");
  const { refetch: refetchTokens } = trpc.tokens.balance.useQuery(undefined, { enabled: false });

  const [mode, setMode] = useState<Mode>("upload");
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  // Upload mode state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // AI generate mode state
  const [prompt, setPrompt] = useState("");

  // Shared settings
  const [isPortrait, setIsPortrait] = useState(false);
  const [widthCm, setWidthCm] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [dpi, setDpi] = useState(180);
  const [showSettings, setShowSettings] = useState(false);

  // Processing animation state
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [currentStep, setCurrentStep] = useState("");
  const [progressPct, setProgressPct] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Steps for the processing animation
  const uploadSteps = isRtl
    ? ["מנתח תמונה...", "מאזן חשיפה (CLAHE)...", "מחדד פרטים...", "יוצר קובץ BMP..."]
    : ["Analyzing image...", "Balancing exposure (CLAHE)...", "Sharpening details...", "Creating BMP file..."];

  const aiSteps = isRtl
    ? ["יוצר תמונה עם AI...", "ממיר לגווני אפור...", "מאזן חשיפה...", "יוצר קובץ BMP..."]
    : ["Generating image with AI...", "Converting to grayscale...", "Balancing exposure...", "Creating BMP file..."];

  // Start/stop the elapsed timer
  const startTimer = useCallback(() => {
    setElapsedSeconds(0);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setElapsedSeconds(s => s + 1);
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  // Update current step label and progress based on elapsed time
  useEffect(() => {
    if (status !== "loading") return;
    const steps = mode === "ai" ? aiSteps : uploadSteps;
    const maxDuration = mode === "ai" ? 70 : 35;
    const stepDuration = maxDuration / steps.length;
    const idx = Math.min(Math.floor(elapsedSeconds / stepDuration), steps.length - 1);
    setCurrentStep(steps[idx]);
    // Progress: grows to 95% over maxDuration, then stalls until done
    const raw = Math.min((elapsedSeconds / maxDuration) * 95, 95);
    setProgressPct(Math.round(raw));
  }, [elapsedSeconds, status, mode]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTimer();
      if (abortRef.current) abortRef.current.abort();
    };
  }, [stopTimer]);

  const t = {
    title: isRtl ? "חריטה על גרניט" : "Granite Engraving",
    uploadMode: isRtl ? "העלאת תמונה" : "Upload Image",
    aiMode: isRtl ? "יצירה עם AI" : "AI Generate",
    uploadHint: isRtl ? "JPG או PNG, עד 20MB" : "JPG or PNG, up to 20MB",
    dragHint: isRtl ? "גרור תמונה לכאן או לחץ לבחירה" : "Drag image here or click to select",
    promptLabel: isRtl ? "תאר את התמונה שתרצה לחרוט" : "Describe the image to engrave",
    promptPlaceholder: isRtl ? "לדוגמה: רכב אספנות קלאסי, מוסטנג 1969" : "e.g. Classic 1969 Ford Mustang muscle car",
    portraitMode: isRtl ? "מצב פורטרט (פנים)" : "Portrait mode (faces)",
    processBtn: isRtl ? "עבד לחריטה" : "Process for Engraving",
    generateBtn: isRtl ? "צור וחרוט" : "Generate & Engrave",
    resultTitle: isRtl ? "קובץ BMP מוכן לחריטה" : "BMP File Ready for Engraving",
    downloadBmp: isRtl ? "הורד BMP לחריטה" : "Download BMP for Engraving",
    colorConverted: isRtl ? "תמונה צבעונית הומרה לגווני אפור על ידי AI" : "Color image converted to grayscale by AI",
    bwDirect: isRtl ? "תמונה שחור-לבן — עובדה ישירות" : "B&W image — processed directly",
    aiGenerated: isRtl ? "תמונה נוצרה על ידי AI" : "Image generated by AI",
    settings: isRtl ? "הגדרות מתקדמות" : "Advanced Settings",
    widthLabel: isRtl ? 'רוחב (ס"מ)' : "Width (cm)",
    heightLabel: isRtl ? 'גובה (ס"מ)' : "Height (cm)",
    dpiLabel: isRtl ? "רזולוציה (DPI)" : "Resolution (DPI)",
    dpiHint: isRtl ? "180 DPI מומלץ לחריטה" : "180 DPI recommended for engraving",
    tryAgain: isRtl ? "נסה שוב" : "Try Again",
    noFile: isRtl ? "נא לבחור תמונה" : "Please select an image",
    noPrompt: isRtl ? "נא להזין תיאור" : "Please enter a description",
    imageSelected: isRtl ? "החלף תמונה" : "Change image",
    costLabel: isRtl ? `עלות: ${cost} קרדיטים` : `Cost: ${cost} credits`,
    infoText: isRtl
      ? "ממיר תמונה לקובץ BMP 8-bit מוכן למכונות חריטה על גרניט שחור. כולל איזון חשיפה (CLAHE), חידוד פרטים ותיקון גמא."
      : "Converts image to BMP 8-bit file ready for diamond needle engraving on black granite. Includes CLAHE, detail sharpening and gamma correction.",
    featureLabel: isRtl ? "חריטה על גרניט" : "Granite Engraving",
  };

  const handleFile = useCallback((file: File) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error(isRtl ? "פורמט לא נתמך — JPG/PNG בלבד" : "Unsupported format — JPG/PNG only");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error(isRtl ? "קובץ גדול מדי — מקסימום 20MB" : "File too large — max 20MB");
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

  const handleCancel = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    stopTimer();
    setStatus("idle");
    setElapsedSeconds(0);
    setCurrentStep("");
  }, [stopTimer]);

  const handleProcess = async () => {
    if (mode === "upload") {
      if (!imageFile) { toast.error(t.noFile); return; }
    } else {
      if (!prompt.trim()) { toast.error(t.noPrompt); return; }
    }

    setStatus("loading");
    setResult(null);
    setErrorMsg("");
    startTimer();

    // Create abort controller for cancellation
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      if (mode === "upload") {
        const formData = new FormData();
        formData.append("image", imageFile!);
        if (widthCm) formData.append("widthCm", widthCm);
        if (heightCm) formData.append("heightCm", heightCm);
        formData.append("dpi", String(dpi));
        formData.append("isPortrait", String(isPortrait));

        const res = await fetch("/api/needle-engraving/process", {
          method: "POST",
          body: formData,
          credentials: "include",
          signal: controller.signal,
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Unknown error" }));
          if (err.error === "UNAUTHORIZED") { onOpenAuth(); stopTimer(); setStatus("idle"); return; }
          if (err.error === "INSUFFICIENT_TOKENS") {
            stopTimer();
            setErrorMsg(isRtl ? "אין מספיק קרדיטים" : "Insufficient credits");
            setStatus("error");
            if (onInsufficientTokens) onInsufficientTokens();
            return;
          }
          throw new Error(err.error || `Server error ${res.status}`);
        }

        const data = await res.json();
        stopTimer();
        setResult(data);
        setStatus("success");
        setElapsedSeconds(0);
        refetchTokens();
        toast.success(isRtl ? "הקובץ מוכן לחריטה!" : "File ready for engraving!");
      } else {
        // AI generate mode
        const res = await fetch("/api/needle-engraving/generate-and-process", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          signal: controller.signal,
          body: JSON.stringify({
            prompt: prompt.trim(),
            widthCm: widthCm || undefined,
            heightCm: heightCm || undefined,
            dpi: String(dpi),
            isPortrait: String(isPortrait),
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Unknown error" }));
          if (err.error === "UNAUTHORIZED") { onOpenAuth(); stopTimer(); setStatus("idle"); return; }
          if (err.error === "INSUFFICIENT_TOKENS") {
            stopTimer();
            setErrorMsg(isRtl ? "אין מספיק קרדיטים" : "Insufficient credits");
            setStatus("error");
            if (onInsufficientTokens) onInsufficientTokens();
            return;
          }
          throw new Error(err.error || `Server error ${res.status}`);
        }

        const data = await res.json();
        stopTimer();
        setResult(data);
        setStatus("success");
        setElapsedSeconds(0);
        refetchTokens();
        toast.success(isRtl ? "התמונה נוצרה ומוכנה לחריטה!" : "Image generated and ready for engraving!");
      }
    } catch (err: unknown) {
      stopTimer();
      if (err instanceof Error && err.name === "AbortError") {
        // User cancelled — already handled in handleCancel
        return;
      }
      const message = err instanceof Error ? err.message : String(err);
      setErrorMsg(message);
      setStatus("error");
      toast.error(message);
    }
  };

  const handleDownload = () => {
    if (!result) return;
    const a = document.createElement("a");
    a.href = result.bmpUrl;
    a.download = (imageFile ? imageFile.name.replace(/\.[^.]+$/, "") : (prompt.slice(0, 30) || "engraving")) + "_engraving.bmp";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleReset = () => {
    stopTimer();
    setStatus("idle");
    setResult(null);
    setErrorMsg("");
    setImageFile(null);
    setImagePreview(null);
    setElapsedSeconds(0);
    setCurrentStep("");
  };

  return (
    <div className="flex flex-col gap-5" dir={isRtl ? "rtl" : "ltr"}>

      {/* Upload area / Mode selector — hidden during loading */}
      {status !== "loading" && (
        <div
          className="rounded-xl p-5 relative"
          style={{ background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}
        >
          {/* Header */}
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #1e3a5f, #0f4c75)' }}>
              <ImageIcon className="w-3.5 h-3.5 text-white" />
            </div>
            <h2 className="font-semibold text-sm text-gray-700">{t.title}</h2>
            <span className="ms-auto text-xs text-gray-400">{t.costLabel}</span>
          </div>

          {/* Mode toggle */}
          <div
            className="flex rounded-xl overflow-hidden p-1 gap-1 mb-4"
            style={{ background: '#f1f5f9', border: '1px solid #e2e8f0' }}
          >
            <button
              type="button"
              onClick={() => { setMode("upload"); setResult(null); setStatus("idle"); setErrorMsg(""); }}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold rounded-lg transition-all"
              style={mode === "upload" ? {
                background: 'linear-gradient(135deg, #1e3a5f, #0f4c75)',
                color: 'white',
                boxShadow: '0 2px 8px rgba(15,76,117,0.35)',
              } : { color: '#6b7280', background: 'transparent' }}
            >
              <Upload className="w-4 h-4" />
              <span>{t.uploadMode}</span>
            </button>
            <button
              type="button"
              onClick={() => { setMode("ai"); setResult(null); setStatus("idle"); setErrorMsg(""); }}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold rounded-lg transition-all"
              style={mode === "ai" ? {
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                color: 'white',
                boxShadow: '0 2px 8px rgba(99,102,241,0.35)',
              } : { color: '#6b7280', background: 'transparent' }}
            >
              <Sparkles className="w-4 h-4" />
              <span>{t.aiMode}</span>
            </button>
          </div>

          {/* Upload mode */}
          {mode === "upload" && (
            <>
              <input
                ref={fileInputRef}
                id="needle-engraving-file-input"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />

              {imagePreview ? (
                <div className="mb-3">
                  <div
                    className="flex items-center gap-3 p-3 rounded-xl relative"
                    style={{ background: '#f0f4ff', border: '1px solid #c7d2fe' }}
                  >
                    <img src={imagePreview} alt="Preview" className="w-16 h-16 object-contain rounded-lg shrink-0 border border-gray-200 bg-white" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate text-gray-700">{imageFile?.name}</p>
                      <p className="text-xs text-gray-400">{isRtl ? "תמונה נבחרה" : "Image selected"}</p>
                    </div>
                    <button
                      onClick={handleReset}
                      className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-red-100 transition-colors shrink-0"
                      style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}
                      title={isRtl ? 'נקה תמונה' : 'Clear image'}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex justify-end mt-1 px-1">
                    <label htmlFor="needle-engraving-file-input" className="text-xs text-indigo-600 hover:text-indigo-800 cursor-pointer font-medium">
                      {t.imageSelected}
                    </label>
                  </div>
                </div>
              ) : (
                <div
                  className={`mb-3 border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${dragOver ? "border-indigo-400 bg-indigo-50" : "border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/30"}`}
                  onDrop={onDrop}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-2" style={{ background: '#f0f4ff' }}>
                    <Upload className="w-5 h-5 text-indigo-500" />
                  </div>
                  <p className="font-semibold text-sm text-gray-700">{t.dragHint}</p>
                  <p className="text-xs text-gray-400 mt-1">{t.uploadHint}</p>
                </div>
              )}
            </>
          )}

          {/* AI generate mode */}
          {mode === "ai" && (
            <div className="mb-3">
              <label className="block text-xs font-semibold mb-1.5 text-gray-500">{t.promptLabel}</label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={t.promptPlaceholder}
                rows={3}
                className="w-full text-sm rounded-xl px-3 py-2.5 bg-gray-50 border border-gray-200 text-gray-800 resize-none focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200"
                style={{ textAlign: isRtl ? "right" : "left", direction: isRtl ? "rtl" : "ltr" }}
              />
              <p className="text-xs text-gray-400 mt-1">
                {isRtl
                  ? "AI יצור תמונה בגווני אפור מותאמת לחריטה, ואז יעבד אותה לקובץ BMP"
                  : "AI will create a grayscale image optimized for engraving, then process it to BMP"}
              </p>
            </div>
          )}

          {/* Portrait toggle */}
          <div className="flex items-center gap-3 p-3 rounded-xl mb-3" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
            <button
              type="button"
              onClick={() => setIsPortrait(!isPortrait)}
              className={`w-10 h-6 rounded-full transition-colors shrink-0 ${isPortrait ? "bg-indigo-500" : "bg-gray-300"}`}
            >
              <span
                className={`block w-4 h-4 bg-white rounded-full mx-1 transition-transform shadow-sm ${isPortrait ? (isRtl ? "-translate-x-4" : "translate-x-4") : ""}`}
              />
            </button>
            <div>
              <p className="text-sm font-medium text-gray-700">{t.portraitMode}</p>
              <p className="text-xs text-gray-400">{isRtl ? "מותאם לחריטת פנים ופורטרטים" : "Optimized for face & portrait engraving"}</p>
            </div>
          </div>

          {/* Advanced settings toggle */}
          <button
            type="button"
            onClick={() => setShowSettings(v => !v)}
            className="w-full flex items-center justify-between text-xs font-semibold text-gray-500 hover:text-gray-700 mb-2 transition-colors"
          >
            <span>{t.settings}</span>
            <span className="text-gray-400">{showSettings ? "▲" : "▼"}</span>
          </button>

          {showSettings && (
            <div className="rounded-xl p-3 mb-3 space-y-3" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">{t.widthLabel}</label>
                  <input
                    type="number" min="1" max="200" placeholder="30"
                    value={widthCm}
                    onChange={(e) => setWidthCm(e.target.value)}
                    className="w-full text-sm rounded-lg px-3 py-2 bg-white border border-gray-200 text-gray-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">{t.heightLabel}</label>
                  <input
                    type="number" min="1" max="200" placeholder="30"
                    value={heightCm}
                    onChange={(e) => setHeightCm(e.target.value)}
                    className="w-full text-sm rounded-lg px-3 py-2 bg-white border border-gray-200 text-gray-800"
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-medium text-gray-500">{t.dpiLabel}</label>
                  <span className="text-indigo-600 font-mono text-xs font-bold">{dpi} DPI</span>
                </div>
                <input
                  type="range" min={72} max={360} step={10}
                  value={dpi}
                  onChange={(e) => setDpi(Number(e.target.value))}
                  className="w-full accent-indigo-600"
                />
                <p className="text-xs text-gray-400 mt-0.5">{t.dpiHint}</p>
              </div>
            </div>
          )}

          {/* Info box */}
          <div className="flex gap-2 p-3 rounded-xl mb-4" style={{ background: '#f0f4ff', border: '1px solid #c7d2fe' }}>
            <Info className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
            <p className="text-xs text-indigo-700 leading-relaxed">{t.infoText}</p>
          </div>

          {/* Process button */}
          <button
            onClick={handleProcess}
            disabled={(status as string) === "loading" || (mode === "upload" && !imageFile) || (mode === "ai" && !prompt.trim())}
            className="w-full h-12 rounded-xl text-white text-sm font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: mode === "ai"
                ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
                : 'linear-gradient(135deg, #1e3a5f, #0f4c75)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            }}
          >
            {mode === "ai" ? <Sparkles className="w-4 h-4" /> : <Wand2 className="w-4 h-4" />}
            {mode === "ai" ? t.generateBtn : t.processBtn}
            {cost > 0 && <span style={{ fontSize: '0.72em', opacity: 0.8, marginInlineStart: 6 }}>({cost} {isRtl ? 'קרדיטים' : 'credits'})</span>}
          </button>
        </div>
      )}

      {/* Loading state — AiProcessingAnimation with elapsed timer */}
      {status === "loading" && (
        <>
          <AiProcessingAnimation
            elapsedSeconds={elapsedSeconds}
            progressPct={progressPct}
            currentStep={currentStep}
            imagePreview={imagePreview}
            onCancel={handleCancel}
            isRtl={isRtl}
            accentColor="#1e3a5f"
            accentGradient="linear-gradient(135deg, #1e3a5f, #0f4c75)"
            featureLabel={t.featureLabel}
          />
          {/* Server warm-up message after 15s */}
          {elapsedSeconds >= 15 && elapsedSeconds < 30 && (
            <div className="rounded-xl px-4 py-3 text-center text-xs" style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e' }}>
              {isRtl ? "⚡ השרת מתחמם — עוד רגע..." : "⚡ Server warming up — almost ready..."}
            </div>
          )}
          {elapsedSeconds >= 30 && (
            <div className="rounded-xl px-4 py-3 text-center text-xs" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534' }}>
              {isRtl ? "🔄 מעבד תמונה מורכבת — AI עובד קשה..." : "🔄 Processing complex image — AI is working hard..."}
            </div>
          )}
        </>
      )}

      {/* Error state */}
      {status === "error" && (
        <div
          className="rounded-xl p-5 flex flex-col items-center gap-3 text-center"
          style={{ background: '#fff1f2', border: '1px solid #fecdd3' }}
        >
          <p className="text-sm font-semibold text-red-700">{isRtl ? "שגיאה בעיבוד" : "Processing error"}</p>
          <p className="text-xs text-red-600">{errorMsg}</p>
          <p className="text-xs font-medium text-green-600 bg-green-50 px-3 py-1 rounded-full">
            ✓ {isRtl ? "האסימונים הוחזרו" : "Tokens refunded"}
          </p>
          <button
            onClick={handleReset}
            className="text-sm px-4 py-2 rounded-lg font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200"
          >
            {t.tryAgain}
          </button>
        </div>
      )}

      {/* Result */}
      {status === "success" && result && (
        <div
          className="rounded-xl p-5"
          style={{ background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}
        >
          {/* Success header */}
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            <span className="font-semibold text-gray-800 text-sm">{t.resultTitle}</span>
          </div>

          {/* Side by side: original + processed */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            {/* Original / Generated */}
            <div>
              <p className="text-xs text-gray-400 mb-1 text-center">
                {mode === "ai"
                  ? (isRtl ? "תמונה שנוצרה" : "Generated image")
                  : (isRtl ? "תמונה מקורית" : "Original image")}
              </p>
              <div className="rounded-lg overflow-hidden bg-gray-100 border border-gray-200" style={{ aspectRatio: '1' }}>
                <img
                  src={mode === "ai" ? result.generatedImageUrl || result.previewUrl : imagePreview || result.previewUrl}
                  alt="original"
                  className="w-full h-full object-contain"
                />
              </div>
            </div>
            {/* Processed preview */}
            <div>
              <p className="text-xs text-gray-400 mb-1 text-center">{isRtl ? "לאחר עיבוד" : "After processing"}</p>
              <div className="rounded-lg overflow-hidden bg-black border border-gray-700" style={{ aspectRatio: '1' }}>
                <img
                  src={result.previewUrl}
                  alt="engraving preview"
                  className="w-full h-full object-contain"
                />
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="rounded-lg p-2 text-center" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <p className="text-gray-400 text-xs mb-0.5">{isRtl ? "גודל" : "Size"}</p>
              <p className="text-gray-800 text-xs font-mono font-bold">{result.width}×{result.height}</p>
            </div>
            <div className="rounded-lg p-2 text-center" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <p className="text-gray-400 text-xs mb-0.5">Bit depth</p>
              <p className="text-gray-800 text-xs font-mono font-bold">{result.bitDepth}-bit</p>
            </div>
            <div className="rounded-lg p-2 text-center" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <p className="text-gray-400 text-xs mb-0.5">{isRtl ? "גודל קובץ" : "File size"}</p>
              <p className="text-gray-800 text-xs font-mono font-bold">{result.fileSizeKB} KB</p>
            </div>
          </div>

          {/* Conversion note */}
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-lg mb-4 text-xs"
            style={result.wasColorConverted || mode === "ai"
              ? { background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8' }
              : { background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d' }}
          >
            <span>{mode === "ai" ? t.aiGenerated : result.wasColorConverted ? t.colorConverted : t.bwDirect}</span>
          </div>

          {/* Download button */}
          <button
            onClick={handleDownload}
            className="w-full h-11 rounded-xl text-white text-sm font-bold flex items-center justify-center gap-2 transition-all"
            style={{ background: 'linear-gradient(135deg, #059669, #10b981)', boxShadow: '0 2px 8px rgba(5,150,105,0.3)' }}
          >
            <Download className="w-4 h-4" />
            {t.downloadBmp}
          </button>

          {/* Try again */}
          <button
            onClick={handleReset}
            className="w-full mt-2 text-xs text-gray-400 hover:text-gray-600 py-1.5 transition-colors"
          >
            {isRtl ? "עבד תמונה אחרת" : "Process another image"}
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * CncReliefTab.tsx
 *
 * Two modes:
 *   1. From Image — upload a photo → AI analyzes → generates heightmap + engraving simulation
 *   2. From Prompt — type a description → AI generates heightmap + engraving simulation
 *
 * Material selector: Wood / Aluminum / MDF / Stone / Brass
 * Results: Heightmap PNG (for CNC software) + Simulation PNG (realistic preview)
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { AiProcessingAnimation } from "@/components/AiProcessingAnimation";
import {
  Download,
  AlertCircle,
  ImageIcon,
  Wand2,
  ZoomIn,
  Upload,
  RefreshCw,
  TreePine,
  Layers,
  Mountain,
  Cpu,
} from "lucide-react";
import { ReportIssueButton } from "@/components/ReportIssueButton";

type ReliefMaterial = "wood" | "aluminum" | "mdf" | "stone" | "brass";
type Mode = "image" | "prompt";
type Status = "idle" | "loading" | "success" | "error";

interface ReliefResult {
  heightmapUrl: string;
  simulationUrl: string;
  subject: string;
  material: ReliefMaterial;
}

interface MaterialOption {
  value: ReliefMaterial;
  labelKey: string;
  icon: React.ReactNode;
  color: string;
}

const MATERIAL_OPTIONS: MaterialOption[] = [
  { value: "wood", labelKey: "cncReliefMaterialWood", icon: <TreePine className="w-4 h-4" />, color: "#8B5E3C" },
  { value: "aluminum", labelKey: "cncReliefMaterialAluminum", icon: <Layers className="w-4 h-4" />, color: "#9CA3AF" },
  { value: "mdf", labelKey: "cncReliefMaterialMdf", icon: <Layers className="w-4 h-4" />, color: "#D4A96A" },
  { value: "stone", labelKey: "cncReliefMaterialStone", icon: <Mountain className="w-4 h-4" />, color: "#6B7280" },
  { value: "brass", labelKey: "cncReliefMaterialBrass", icon: <Cpu className="w-4 h-4" />, color: "#B8860B" },
];

const POLL_INTERVAL_MS = 2500;

function ImageZoomModal({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <img
        src={src}
        alt={alt}
        className="max-w-full max-h-full rounded-xl shadow-2xl object-contain"
        style={{ maxWidth: "90vw", maxHeight: "90vh" }}
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

export function CncReliefTab() {
  const { t, language, isRtl } = useLanguage();
  const [mode, setMode] = useState<Mode>("image");
  const [material, setMaterial] = useState<ReliefMaterial>("wood");
  const [prompt, setPrompt] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [step, setStep] = useState<string>("");
  const [result, setResult] = useState<ReliefResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [zoomSrc, setZoomSrc] = useState<string | null>(null);
  const [zoomAlt, setZoomAlt] = useState<string>("");
  const [partialHeightmap, setPartialHeightmap] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const jobIdRef = useRef<string | null>(null);

  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: _tokenData } = trpc.tokens.balance.useQuery(undefined, { refetchInterval: 30000 });
  const reliefCost = 5; // default cost

  // Start/stop elapsed timer
  const startTimer = useCallback(() => {
    setElapsedSeconds(0);
    elapsedRef.current = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
  }, []);
  const stopTimer = useCallback(() => {
    if (elapsedRef.current) { clearInterval(elapsedRef.current); elapsedRef.current = null; }
  }, []);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const pollJob = useCallback(async (jobId: string) => {
    try {
      const res = await fetch(`/api/cnc-relief/job/${jobId}`, { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();

      if (data.status === "processing" || data.status === "pending") {
        const stepText = data.step || data.stepEn || t("cncReliefProcessingHeightmap");
        setStep(stepText);
        // Show partial heightmap if available
        const hm = data.partialImages?.find((p: { type: string; url: string }) => p.type === "heightmap");
        if (hm) setPartialHeightmap(hm.url);
        return;
      }

    stopPolling();
    stopTimer();

    if (data.status === "done" && data.result) {
        setResult({
          heightmapUrl: data.result.heightmapUrl,
          simulationUrl: data.result.simulationUrl,
          subject: data.result.subject,
          material: data.result.material,
        });
        setStatus("success");
        toast.success(t("cncReliefSuccess"));
      } else if (data.status === "error") {
        setStatus("error");
        setErrorMsg(data.error || data.message || t("cncReliefError"));
        toast.error(t("cncReliefError"));
      } else if (data.status === "cancelled") {
        setStatus("idle");
      }
    } catch (e) {
      console.error("[CncReliefTab] poll error:", e);
    }
  }, [stopPolling, t]);

  const startPolling = useCallback((jobId: string) => {
    jobIdRef.current = jobId;
    pollRef.current = setInterval(() => pollJob(jobId), POLL_INTERVAL_MS);
  }, [pollJob]);

  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  const handleFileChange = useCallback((file: File) => {
    setImageFile(file);
    const url = URL.createObjectURL(file);
    setImagePreview(url);
    setResult(null);
    setStatus("idle");
    setPartialHeightmap(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) handleFileChange(file);
  }, [handleFileChange]);

  const handleGenerate = async () => {
    if (mode === "image" && !imageFile) {
      toast.error(t("cncReliefNoInput"));
      return;
    }
    if (mode === "prompt" && !prompt.trim()) {
      toast.error(t("cncReliefNoInput"));
      return;
    }

    setStatus("loading");
    setStep(t("cncReliefProcessingHeightmap"));
    setResult(null);
    setPartialHeightmap(null);
    setErrorMsg("");
    startTimer();

    try {
      let jobId: string;

      if (mode === "image" && imageFile) {
        const formData = new FormData();
        formData.append("image", imageFile);
        formData.append("material", material);
        formData.append("lang", language);

        const res = await fetch("/api/cnc-relief/from-image", {
          method: "POST",
          body: formData,
          credentials: "include",
        });

        const data = await res.json();

        if (!res.ok) {
          if (data.error === "INSUFFICIENT_TOKENS") {
            toast.error(t("insufficientTokensMsg"));
            setStatus("idle");
            return;
          }
          if (data.error === "UNAUTHORIZED") {
            toast.error(t("loginRegister"));
            setStatus("idle");
            return;
          }
          throw new Error(data.message || data.error || "Server error");
        }

        jobId = data.jobId;
      } else {
        const res = await fetch("/api/cnc-relief/from-prompt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: prompt.trim(), material, lang: language }),
          credentials: "include",
        });

        const data = await res.json();

        if (!res.ok) {
          if (data.error === "INSUFFICIENT_TOKENS") {
            toast.error(t("insufficientTokensMsg"));
            setStatus("idle");
            return;
          }
          if (data.error === "UNAUTHORIZED") {
            toast.error(t("loginRegister"));
            setStatus("idle");
            return;
          }
          throw new Error(data.message || data.error || "Server error");
        }

        jobId = data.jobId;
      }

      startPolling(jobId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setStatus("error");
      setErrorMsg(msg);
      toast.error(t("cncReliefError"));
    }
  };

  const handleCancel = async () => {
    if (!jobIdRef.current) return;
    stopPolling();
    stopTimer();
    try {
      await fetch(`/api/cnc-relief/cancel/${jobIdRef.current}`, {
        method: "POST",
        credentials: "include",
      });
    } catch (_) { /* ignore */ }
    setStatus("idle");
    setStep("");
  };

  const handleDownload = (url: string, filename: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
  };

  const handleReset = () => {
    setStatus("idle");
    setResult(null);
    setPartialHeightmap(null);
    setStep("");
    setErrorMsg("");
    setImageFile(null);
    setImagePreview(null);
    setPrompt("");
  };

  const materialLabel = (mat: ReliefMaterial) => {
    const opt = MATERIAL_OPTIONS.find((m) => m.value === mat);
    return opt ? t(opt.labelKey as Parameters<typeof t>[0]) : mat;
  };

  return (
    <div className="w-full max-w-2xl mx-auto px-2 py-4" dir={isRtl ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="mb-5 text-center">
        <h2 className="text-xl font-bold text-gray-900 mb-1">{t("cncReliefTitle")}</h2>
        <p className="text-sm text-gray-500">{t("cncReliefSubtitle")}</p>
      </div>

      {/* Mode Toggle */}
      <div className="flex rounded-xl overflow-hidden border border-gray-200 mb-5 bg-gray-50">
        <button
          className={`flex-1 py-2.5 text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
            mode === "image"
              ? "bg-white text-teal-700 shadow-sm border-b-2 border-teal-500"
              : "text-gray-500 hover:text-gray-700"
          }`}
          onClick={() => { setMode("image"); setStatus("idle"); setResult(null); }}
        >
          <ImageIcon className="w-4 h-4" />
          {t("cncReliefModeImage")}
        </button>
        <button
          className={`flex-1 py-2.5 text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
            mode === "prompt"
              ? "bg-white text-teal-700 shadow-sm border-b-2 border-teal-500"
              : "text-gray-500 hover:text-gray-700"
          }`}
          onClick={() => { setMode("prompt"); setStatus("idle"); setResult(null); }}
        >
          <Wand2 className="w-4 h-4" />
          {t("cncReliefModePrompt")}
        </button>
      </div>

      {/* Material Selector */}
      <div className="mb-5">
        <label className="block text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">
          {t("cncReliefMaterialLabel")}
        </label>
        <div className="flex flex-wrap gap-2">
          {MATERIAL_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setMaterial(opt.value)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-all ${
                material === opt.value
                  ? "border-teal-500 bg-teal-50 text-teal-700 shadow-sm"
                  : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50"
              }`}
            >
              <span style={{ color: material === opt.value ? opt.color : undefined }}>{opt.icon}</span>
              {t(opt.labelKey as Parameters<typeof t>[0])}
            </button>
          ))}
        </div>
      </div>

      {/* Input Area */}
      {status === "idle" || status === "error" ? (
        <div className="mb-5">
          {mode === "image" ? (
            <div
              className={`relative rounded-xl border-2 border-dashed transition-all cursor-pointer ${
                imagePreview
                  ? "border-teal-300 bg-teal-50/30"
                  : "border-gray-200 bg-gray-50 hover:border-teal-300 hover:bg-teal-50/20"
              }`}
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFileChange(f);
                }}
              />
              {imagePreview ? (
                <div className="relative p-3">
                  <img
                    src={imagePreview}
                    alt="Source"
                    className="w-full rounded-lg object-contain max-h-48"
                  />
                  <div className="absolute inset-3 rounded-lg bg-black/0 hover:bg-black/20 transition-colors flex items-center justify-center">
                    <span className="opacity-0 hover:opacity-100 text-white text-sm font-medium bg-black/50 px-3 py-1 rounded-full">
                      {t("cncReliefDropImage")}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 gap-2">
                  <Upload className="w-8 h-8 text-gray-300" />
                  <p className="text-sm font-medium text-gray-500">{t("cncReliefDropImage")}</p>
                  <p className="text-xs text-gray-400">{t("cncReliefDropSub")}</p>
                </div>
              )}
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">
                {t("cncReliefPromptLabel")}
              </label>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={t("cncReliefPromptPlaceholder")}
                className="resize-none h-24 text-sm"
                maxLength={500}
              />
              <p className="text-xs text-gray-400 mt-1 text-right">{prompt.length}/500</p>
            </div>
          )}

          {/* Error display */}
          {status === "error" && errorMsg && (
            <div className="mt-3 flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
              <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-700">{errorMsg}</p>
            </div>
          )}

          {/* Generate Button */}
          <Button
            className="w-full mt-4 bg-teal-600 hover:bg-teal-700 text-white font-semibold py-3 rounded-xl"
            onClick={handleGenerate}
            disabled={
              (mode === "image" && !imageFile) ||
              (mode === "prompt" && !prompt.trim())
            }
          >
            <Wand2 className="w-4 h-4 mr-2" />
            {t("cncReliefGenerateBtn")}
            {reliefCost > 0 && (
              <span className="ml-2 text-xs opacity-75">({reliefCost} {t("buyTokensLabel")})</span>
            )}
          </Button>
        </div>
      ) : null}

      {/* Processing State */}
      {status === "loading" && (
        <div className="mb-5">
          <AiProcessingAnimation
            elapsedSeconds={elapsedSeconds}
            currentStep={step}
            onCancel={handleCancel}
            featureLabel="CNC Relief"
          />
          {/* Partial heightmap preview */}
          {partialHeightmap && (
            <div className="mt-4 rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
              <p className="text-xs text-gray-500 px-3 py-2 font-medium">{t("cncReliefHeightmapLabel")}</p>
              <img src={partialHeightmap} alt="Heightmap preview" className="w-full" />
            </div>
          )}
        </div>
      )}

      {/* Results */}
      {status === "success" && result && (
        <div className="mb-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            {/* Heightmap */}
            <div className="rounded-xl border border-gray-200 overflow-hidden bg-white shadow-sm">
              <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-700">{t("cncReliefHeightmapLabel")}</span>
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">PNG</span>
              </div>
              <div
                className="relative cursor-zoom-in group bg-gray-900"
                onClick={() => { setZoomSrc(result.heightmapUrl); setZoomAlt(t("cncReliefHeightmapLabel")); }}
              >
                <img
                  src={result.heightmapUrl}
                  alt="Heightmap"
                  className="w-full block"
                  style={{ aspectRatio: "1", objectFit: "contain" }}
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                  <ZoomIn className="w-6 h-6 text-white opacity-0 group-hover:opacity-80 transition-opacity" />
                </div>
              </div>
              <div className="p-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full text-xs"
                  onClick={() => handleDownload(result.heightmapUrl, `heightmap-${result.material}.png`)}
                >
                  <Download className="w-3.5 h-3.5 mr-1.5" />
                  {t("cncReliefDownloadHeightmap")}
                </Button>
              </div>
            </div>

            {/* Simulation */}
            <div className="rounded-xl border border-gray-200 overflow-hidden bg-white shadow-sm">
              <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-700">{t("cncReliefSimulationLabel")}</span>
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{
                    background: MATERIAL_OPTIONS.find((m) => m.value === result.material)?.color + "22",
                    color: MATERIAL_OPTIONS.find((m) => m.value === result.material)?.color,
                  }}
                >
                  {materialLabel(result.material)}
                </span>
              </div>
              <div
                className="relative cursor-zoom-in group"
                onClick={() => { setZoomSrc(result.simulationUrl); setZoomAlt(t("cncReliefSimulationLabel")); }}
              >
                <img
                  src={result.simulationUrl}
                  alt="Simulation"
                  className="w-full block"
                  style={{ aspectRatio: "1", objectFit: "cover" }}
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                  <ZoomIn className="w-6 h-6 text-white opacity-0 group-hover:opacity-80 transition-opacity" />
                </div>
              </div>
              <div className="p-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full text-xs"
                  onClick={() => handleDownload(result.simulationUrl, `simulation-${result.material}.png`)}
                >
                  <Download className="w-3.5 h-3.5 mr-1.5" />
                  {t("cncReliefDownloadSimulation")}
                </Button>
              </div>
            </div>
          </div>

          {/* Report issue button */}
          <div className="flex justify-end">
            <ReportIssueButton
              sourceImageUrl={imagePreview || undefined}
              resultImageUrl={result?.simulationUrl}
              feature="cnc_relief"
            />
          </div>

          {/* New Design button */}
          <Button
            variant="outline"
            className="w-full"
            onClick={handleReset}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            {t("cncReliefNewDesign")}
          </Button>
        </div>
      )}

      {/* Tips */}
      {status === "idle" && (
        <div className="rounded-xl bg-gray-50 border border-gray-100 p-4 space-y-2">
          {[t("cncReliefTip1"), t("cncReliefTip2"), t("cncReliefTip3")].map((tip, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="w-5 h-5 rounded-full bg-teal-100 text-teal-600 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                {i + 1}
              </span>
              <p className="text-xs text-gray-600">{tip}</p>
            </div>
          ))}
        </div>
      )}

      {/* Zoom Modal */}
      {zoomSrc && (
        <ImageZoomModal
          src={zoomSrc}
          alt={zoomAlt}
          onClose={() => setZoomSrc(null)}
        />
      )}
    </div>
  );
}

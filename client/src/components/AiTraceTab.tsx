/**
 * AiTraceTab.tsx
 *
 * Third tab: user uploads a photo → AI analyzes it and draws a clean
 * outline suitable for laser engraving / CNC cutting → auto-converts to DXF.
 */

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { DxfDownloadDialog } from "@/components/DxfDownloadDialog";
import { AiRefinePanel, type RefineResult } from "@/components/AiRefinePanel";
import {
  Upload,
  Download,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ImageIcon,
  Scan,
  Eye,
  ZoomIn,
  ZoomOut,
  Maximize2,
} from "lucide-react";

interface TraceResult {
  svgPreview: string;
  dxfUrl: string;
  imageUrl: string;
  segmentCount: number;
  realWidth?: number;
  realHeight?: number;
  filename?: string;
}

type Status = "idle" | "loading" | "success" | "error";

// ─── Minimal SVG Viewer ───────────────────────────────────────────────────────
function SvgViewer({ svgContent }: { svgContent: string }) {
  const [scale, setScale] = useState(1);
  const clamp = (s: number) => Math.min(8, Math.max(0.5, s));
  const styledSvg = svgContent.replace(/<svg /, '<svg style="width:100%;height:100%;" ');

  return (
    <div className="border rounded-lg overflow-hidden bg-white">
      <div className="flex items-center gap-1 px-3 py-1.5 border-b bg-muted/30">
        <Eye className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-xs text-muted-foreground font-medium flex-1">Vector Preview</span>
        <span className="text-xs text-muted-foreground/60">{Math.round(scale * 100)}%</span>
        <button onClick={() => setScale((s) => clamp(+(s / 1.3).toFixed(2)))} className="w-6 h-6 rounded flex items-center justify-center hover:bg-muted">
          <ZoomOut className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
        <button onClick={() => setScale((s) => clamp(+(s * 1.3).toFixed(2)))} className="w-6 h-6 rounded flex items-center justify-center hover:bg-muted">
          <ZoomIn className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
        <button onClick={() => setScale(1)} className="w-6 h-6 rounded flex items-center justify-center hover:bg-muted">
          <Maximize2 className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      </div>
      <div className="relative overflow-hidden bg-white" style={{ height: 280 }}>
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: `translate(-50%, -50%) scale(${scale})`,
            transformOrigin: "center center",
            width: "90%",
            height: "90%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          dangerouslySetInnerHTML={{ __html: styledSvg }}
        />
      </div>
    </div>
  );
}

// ─── AI Trace Tab ─────────────────────────────────────────────────────────────
interface AiTraceTabProps {
  onOpenAuth: () => void;
}

export function AiTraceTab({ onOpenAuth }: AiTraceTabProps) {
  const { t, isRtl } = useLanguage();
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<TraceResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    const allowed = ["image/png", "image/jpeg", "image/bmp", "image/webp", "image/gif"];
    if (!allowed.includes(file.type)) {
      toast.error(isRtl ? "פורמט לא נתמך. השתמש ב-PNG, JPG, BMP או WebP." : "Unsupported format. Use PNG, JPG, BMP or WebP.");
      return;
    }
    if (file.size > 16 * 1024 * 1024) {
      toast.error(isRtl ? "הקובץ גדול מדי. מקסימום 16 MB." : "File too large. Maximum 16 MB.");
      return;
    }
    setImageFile(file);
    setResult(null);
    setStatus("idle");
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

  const handleTrace = async () => {
    if (!imageFile) return;
    setStatus("loading");
    setResult(null);
    setErrorMsg("");

    try {
      const formData = new FormData();
      formData.append("image", imageFile);
      if (description.trim()) {
        formData.append("description", description.trim());
      }

      const res = await fetch("/api/ai-trace", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) {
        if (data.error === "UNAUTHORIZED") {
          onOpenAuth();
          setStatus("idle");
          return;
        }
        if (data.error === "QUOTA_EXCEEDED") {
          const msg = isRtl ? (data.message || t("quotaExceeded")) : (data.messageEn || t("quotaExceeded"));
          toast.error(msg);
          setErrorMsg(msg);
          setStatus("error");
          return;
        }
        throw new Error(isRtl ? (data.message || data.error) : (data.messageEn || data.error || "Error"));
      }

      setResult(data as TraceResult);
      setStatus("success");
      toast.success(isRtl ? `AI Trace הושלם! ${data.segmentCount.toLocaleString()} קווים` : `AI Trace complete! ${data.segmentCount.toLocaleString()} lines`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (isRtl ? "שגיאה בעיבוד" : "Processing error");
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
    setErrorMsg("");
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
          defaultFilename={result.filename ?? `ai-trace-${Date.now()}.dxf`}
          segmentCount={result.segmentCount}
          svgWidth={result.realWidth ?? 500}
          svgHeight={result.realHeight ?? 500}
        />
      )}

      <div className="flex flex-col gap-5">
        {/* Upload area */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <Scan className="w-4 h-4 text-primary" />
              <h2 className="font-semibold text-sm">{t("aiTraceTitle")}</h2>
            </div>
            <p className="text-xs text-muted-foreground mb-4">{t("aiTraceSubtitle")}</p>

            {/* Drop zone */}
            <div
              className={`relative border-2 border-dashed rounded-xl transition-all cursor-pointer
                ${dragOver ? "border-primary bg-primary/5 scale-[1.01]" : "border-border hover:border-primary/50 hover:bg-muted/30"}
                ${imagePreview ? "border-solid border-primary/30" : ""}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/bmp,image/webp"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />
              {imagePreview ? (
                <div className="relative">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-full max-h-56 object-contain rounded-xl p-2"
                  />
                  <div className="absolute inset-0 bg-black/0 hover:bg-black/10 transition-colors rounded-xl flex items-center justify-center opacity-0 hover:opacity-100">
                    <span className="text-white text-xs font-medium bg-black/50 px-3 py-1 rounded-full">
                      {isRtl ? "לחץ להחלפה" : "Click to change"}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 py-10 text-center px-4">
                  <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                    <ImageIcon className="w-7 h-7 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{t("aiTraceDrop")}</p>
                    <p className="text-xs text-muted-foreground mt-1">{t("aiTraceFormats")}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Optional description */}
            {imagePreview && (
              <div className="mt-3">
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                  {isRtl ? "תיאור אופציונלי (לשם הקובץ):" : "Optional description (for filename):"}
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={isRtl ? "למשל: חתול, פרח, לוגו..." : "e.g. cat, flower, logo..."}
                  className="w-full text-sm border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                  dir={isRtl ? "rtl" : "ltr"}
                />
              </div>
            )}

            <Button
              size="lg"
              className="w-full mt-4 h-11 font-semibold"
              disabled={!imageFile || status === "loading"}
              onClick={handleTrace}
            >
              {status === "loading"
                ? <><Loader2 className="w-4 h-4 ml-2 animate-spin" />{t("aiTraceProcessing")}</>
                : <><Scan className="w-4 h-4 ml-2" />{t("aiTraceButton")}</>}
            </Button>
          </CardContent>
        </Card>

        {/* Loading */}
        {status === "loading" && (
          <Card>
            <CardContent className="p-8">
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="relative">
                  <div className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                  <Scan className="w-6 h-6 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                </div>
                <div>
                  <p className="font-semibold text-base">{t("aiTraceProcessing")}</p>
                  <p className="text-sm text-muted-foreground mt-1">{t("aiTraceProcessingSubtitle")}</p>
                </div>
                <div className="flex gap-1.5 mt-1">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="w-2 h-2 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error */}
        {status === "error" && (
          <Card>
            <CardContent className="p-6 flex flex-col items-center gap-3 text-center">
              <AlertCircle className="w-10 h-10 text-red-400" />
              <p className="font-semibold text-red-600">{isRtl ? "שגיאה בעיבוד" : "Processing Error"}</p>
              <p className="text-sm text-muted-foreground">{errorMsg}</p>
              <Button variant="outline" size="sm" onClick={reset}>{isRtl ? "נסה שוב" : "Try Again"}</Button>
            </CardContent>
          </Card>
        )}

        {/* Result */}
        {status === "success" && result && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="w-4 h-4 text-primary" />
                <span className="font-semibold text-sm">{t("aiTraceSuccess")}</span>
              </div>

              {/* Side by side: original + vector */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5 font-medium text-center">
                    {isRtl ? "תמונה מקורית" : "Original"}
                  </p>
                  <div className="border rounded-lg overflow-hidden bg-white aspect-square flex items-center justify-center p-2">
                    <img src={result.imageUrl} alt="Original" className="max-w-full max-h-full object-contain" />
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5 font-medium text-center">
                    {isRtl ? "וקטור לחריטה" : "Engraving Vector"}
                  </p>
                  <div className="border rounded-lg overflow-hidden bg-white aspect-square flex items-center justify-center p-2">
                    <div
                      className="w-full h-full flex items-center justify-center"
                      dangerouslySetInnerHTML={{
                        __html: result.svgPreview.replace(
                          /<svg /,
                          '<svg style="max-width:100%;max-height:100%;width:auto;height:auto;" '
                        ),
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Full SVG viewer */}
              <div className="mb-4">
                <SvgViewer svgContent={result.svgPreview} />
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="bg-white rounded-lg p-2 text-center border">
                  <p className="text-base font-bold text-primary">{result.segmentCount.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">{t("lines")}</p>
                </div>
                <div className="bg-white rounded-lg p-2 text-center border">
                  <p className="text-base font-bold text-primary">
                    {result.realWidth ? (result.realWidth / 3.7795).toFixed(1) : "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">{t("widthMm")}</p>
                </div>
                <div className="bg-white rounded-lg p-2 text-center border">
                  <p className="text-base font-bold text-primary">
                    {result.realHeight ? (result.realHeight / 3.7795).toFixed(1) : "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">{t("heightMm")}</p>
                </div>
              </div>

              <Button
                size="lg"
                className="w-full bg-green-600 hover:bg-green-700 font-semibold mb-3"
                onClick={() => setDownloadOpen(true)}
              >
                <Download className="w-4 h-4 ml-2" />{t("downloadDxf")}
              </Button>

              {/* AI Refine Panel */}
              <AiRefinePanel
                imageUrl={result.imageUrl}
                onRefined={(refined: RefineResult) => {
                  setResult({
                    svgPreview: refined.svgPreview,
                    dxfUrl: refined.dxfUrl,
                    imageUrl: refined.imageUrl,
                    segmentCount: refined.segmentCount,
                    realWidth: refined.realWidth,
                    realHeight: refined.realHeight,
                    filename: refined.dxfFilename,
                  });
                  toast.success(isRtl ? "העיצוב עודכן!" : "Design refined!");
                }}
              />

              <Button variant="outline" size="sm" className="w-full mt-3" onClick={reset}>
                {t("aiTraceNewImage")}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Tips */}
        <Card className="bg-blue-50 border-blue-100">
          <CardContent className="p-4">
            <h3 className="font-semibold text-sm text-blue-800 mb-2">{t("tipsTitle")}</h3>
            <ul className="space-y-1.5 text-sm text-blue-700">
              <li className="flex gap-2"><span className="shrink-0">•</span><span>{t("aiTraceTip1")}</span></li>
              <li className="flex gap-2"><span className="shrink-0">•</span><span>{t("aiTraceTip2")}</span></li>
              <li className="flex gap-2"><span className="shrink-0">•</span><span>{t("aiTraceTip3")}</span></li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

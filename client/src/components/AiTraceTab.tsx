/**
 * AiTraceTab.tsx — Two-step AI Trace flow:
 *  STEP 1: User uploads photo → AI draws a B&W PNG line drawing → preview shown
 *  STEP 2: User approves → clicks "Convert to DXF" → potrace pipeline → DXF ready
 */

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { DxfDownloadDialog } from "@/components/DxfDownloadDialog";
import { AiRefinePanel, type RefineResult } from "@/components/AiRefinePanel";
import {
  Download,
  CheckCircle2,
  AlertCircle,
  ImageIcon,
  Scan,
  Eye,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Wand2,
  ArrowRight,
} from "lucide-react";

interface PreviewResult {
  previewPngUrl: string;
  previewPngBase64: string;
  imageUrl: string;
  description: string;
}

interface DxfResult {
  svgPreview: string;
  dxfUrl: string;
  imageUrl: string;
  segmentCount: number;
  realWidth?: number;
  realHeight?: number;
  filename?: string;
}

type Status = "idle" | "loading-ai" | "preview" | "loading-dxf" | "success" | "error";

function SvgViewer({ svgContent }: { svgContent: string }) {
  const [scale, setScale] = useState(1);
  const clamp = (s: number) => Math.min(8, Math.max(0.5, s));
  const styledSvg = svgContent.replace(/<svg /, '<svg style="width:100%;height:100%;" ');
  return (
    <div className="border rounded-lg overflow-hidden bg-white">
      <div className="flex items-center gap-1 px-3 py-1.5 border-b bg-muted/30">
        <Eye className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-xs text-muted-foreground flex-1">Vector Preview</span>
        <button onClick={() => setScale(clamp(scale - 0.25))} className="p-1 hover:bg-muted rounded"><ZoomOut className="w-3.5 h-3.5" /></button>
        <span className="text-xs w-10 text-center">{Math.round(scale * 100)}%</span>
        <button onClick={() => setScale(clamp(scale + 0.25))} className="p-1 hover:bg-muted rounded"><ZoomIn className="w-3.5 h-3.5" /></button>
        <button onClick={() => setScale(1)} className="p-1 hover:bg-muted rounded"><Maximize2 className="w-3.5 h-3.5" /></button>
      </div>
      <div className="overflow-auto" style={{ maxHeight: 320 }}>
        <div style={{ transform: `scale(${scale})`, transformOrigin: "top left", width: `${100 / scale}%` }}
          dangerouslySetInnerHTML={{ __html: styledSvg }} />
      </div>
    </div>
  );
}

interface AiTraceTabProps { onOpenAuth: () => void; }

export function AiTraceTab({ onOpenAuth }: AiTraceTabProps) {
  const { t, isRtl } = useLanguage();
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null);
  const [dxfResult, setDxfResult] = useState<DxfResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    const allowed = ["image/png", "image/jpeg", "image/bmp", "image/webp", "image/gif"];
    if (!allowed.includes(file.type)) { toast.error(isRtl ? "פורמט לא נתמך." : "Unsupported format."); return; }
    if (file.size > 16 * 1024 * 1024) { toast.error(isRtl ? "הקובץ גדול מדי. מקסימום 16 MB." : "File too large. Max 16 MB."); return; }
    setImageFile(file);
    setPreviewResult(null);
    setDxfResult(null);
    setStatus("idle");
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);
  }, [isRtl]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0]; if (file) handleFile(file);
  }, [handleFile]);

  const handleTrace = async () => {
    if (!imageFile) return;
    setStatus("loading-ai"); setPreviewResult(null); setDxfResult(null); setErrorMsg("");
    try {
      const formData = new FormData();
      formData.append("image", imageFile);
      if (description.trim()) formData.append("description", description.trim());
      const res = await fetch("/api/ai-trace", { method: "POST", body: formData, credentials: "include" });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === "UNAUTHORIZED") { onOpenAuth(); setStatus("idle"); return; }
        if (data.error === "QUOTA_EXCEEDED") {
          const msg = isRtl ? (data.message || t("quotaExceeded")) : (data.messageEn || t("quotaExceeded"));
          toast.error(msg); setErrorMsg(msg); setStatus("error"); return;
        }
        throw new Error(isRtl ? (data.message || data.error) : (data.messageEn || data.error || "Error"));
      }
      setPreviewResult(data as PreviewResult);
      setStatus("preview");
      toast.success(isRtl ? "ה-AI סיים לצייר! בדוק ולחץ המר ל-DXF" : "AI drawing ready! Review and convert to DXF");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (isRtl ? "שגיאה בעיבוד" : "Processing error");
      setErrorMsg(msg); setStatus("error"); toast.error(msg);
    }
  };

  const handleConvertToDxf = async () => {
    if (!previewResult) return;
    setStatus("loading-dxf"); setErrorMsg("");
    try {
      const res = await fetch("/api/ai-trace/convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          previewPngBase64: previewResult.previewPngBase64,
          previewPngUrl: previewResult.previewPngUrl,
          description: previewResult.description,
          imageUrl: previewResult.imageUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(isRtl ? (data.message || data.error) : (data.messageEn || data.error || "Error"));
      setDxfResult({ ...data, imageUrl: previewResult.imageUrl });
      setStatus("success");
      toast.success(isRtl ? `DXF מוכן! ${data.segmentCount.toLocaleString()} קווים` : `DXF ready! ${data.segmentCount.toLocaleString()} lines`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (isRtl ? "שגיאת המרה" : "Conversion error");
      setErrorMsg(msg); setStatus("error"); toast.error(msg);
    }
  };

  const reset = () => {
    setImageFile(null); setImagePreview(null); setPreviewResult(null); setDxfResult(null);
    setStatus("idle"); setErrorMsg("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <>
      {dxfResult && downloadOpen && (
        <DxfDownloadDialog
          open={downloadOpen} onClose={() => setDownloadOpen(false)}
          svgContent={dxfResult.svgPreview} dxfUrl={dxfResult.dxfUrl}
          defaultFilename={dxfResult.filename ?? `ai-trace-${Date.now()}.dxf`}
          segmentCount={dxfResult.segmentCount} svgWidth={dxfResult.realWidth ?? 500} svgHeight={dxfResult.realHeight ?? 500}
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

            <div
              className={`border-2 border-dashed rounded-xl transition-colors cursor-pointer mb-3 ${dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/20 hover:border-primary/50"} ${imagePreview ? "p-2" : "p-8"}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              {imagePreview ? (
                <div className="flex items-center gap-3">
                  <img src={imagePreview} alt="Preview" className="w-16 h-16 object-cover rounded-lg border" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{imageFile?.name}</p>
                    <p className="text-xs text-muted-foreground">{isRtl ? "לחץ להחלפה" : "Click to change"}</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 text-center">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <ImageIcon className="w-6 h-6 text-primary" />
                  </div>
                  <p className="font-medium text-sm">{t("aiTraceDrop")}</p>
                  <p className="text-xs text-muted-foreground">{t("aiTraceFormats")}</p>
                </div>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/bmp,image/webp,image/gif" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />

            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder={isRtl ? "תיאור אופציונלי (לשם הקובץ):" : "Optional description (for filename):"}
              className="w-full text-sm border rounded-lg px-3 py-2 bg-background mb-3 placeholder:text-muted-foreground/50" />

            <Button size="lg" className="w-full font-semibold"
              disabled={!imageFile || status === "loading-ai" || status === "loading-dxf"}
              onClick={handleTrace}>
              {status === "loading-ai" ? (
                <><div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin ml-2" />{isRtl ? "ה-AI מצייר..." : "AI is drawing..."}</>
              ) : (
                <><Wand2 className="w-4 h-4 ml-2" />{isRtl ? "צור outline בAI" : "Create AI Outline"}</>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* STEP 1 Loading */}
        {status === "loading-ai" && (
          <Card>
            <CardContent className="p-8 flex flex-col items-center gap-3 text-center">
              <div className="relative w-16 h-16">
                <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
                <div className="absolute inset-0 rounded-full border-4 border-t-primary animate-spin" />
                <Wand2 className="absolute inset-0 m-auto w-6 h-6 text-primary" />
              </div>
              <p className="font-semibold text-sm">{isRtl ? "ה-AI מנתח ומצייר..." : "AI is analyzing and drawing..."}</p>
              <p className="text-xs text-muted-foreground">{isRtl ? "זה עשוי לקחת 20-40 שניות" : "This may take 20-40 seconds"}</p>
              <div className="flex gap-1.5">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* STEP 2 Loading */}
        {status === "loading-dxf" && (
          <Card>
            <CardContent className="p-8 flex flex-col items-center gap-3 text-center">
              <div className="relative w-16 h-16">
                <div className="absolute inset-0 rounded-full border-4 border-green-200" />
                <div className="absolute inset-0 rounded-full border-4 border-t-green-500 animate-spin" />
                <ArrowRight className="absolute inset-0 m-auto w-6 h-6 text-green-600" />
              </div>
              <p className="font-semibold text-sm">{isRtl ? "ממיר לקווי DXF..." : "Converting to DXF lines..."}</p>
              <p className="text-xs text-muted-foreground">{isRtl ? "מריץ potrace על הציור..." : "Running potrace on the drawing..."}</p>
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

        {/* PNG Preview (Step 1 result) */}
        {status === "preview" && previewResult && (
          <Card className="border-blue-200 bg-blue-50/50">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="w-4 h-4 text-blue-600" />
                <span className="font-semibold text-sm text-blue-800">
                  {isRtl ? "ה-AI סיים לצייר — בדוק את התוצאה" : "AI drawing ready — review below"}
                </span>
              </div>

              <div className="flex flex-col gap-3 mb-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5 font-medium text-center">{isRtl ? "ציור AI (שחור-לבן)" : "AI Drawing (B&W)"}</p>
                  <div className="border rounded-lg overflow-hidden bg-white flex items-center justify-center p-2" style={{ minHeight: 340 }}>
                    <img src={previewResult.previewPngBase64} alt="AI Drawing" className="max-w-full object-contain" style={{ maxHeight: 500 }} />
                  </div>
                </div>
                <details>
                  <summary className="text-xs text-muted-foreground cursor-pointer text-center py-1">{isRtl ? "הצג תמונה מקורית" : "Show original photo"}</summary>
                  <div className="border rounded-lg overflow-hidden bg-white flex items-center justify-center p-2 mt-2" style={{ minHeight: 200 }}>
                    <img src={imagePreview!} alt="Original" className="max-w-full object-contain" style={{ maxHeight: 300 }} />
                  </div>
                </details>
              </div>

              <p className="text-xs text-muted-foreground text-center mb-4">
                {isRtl ? "אם הציור נראה טוב — לחץ 'המר ל-DXF'. אם לא — לחץ 'נסה שוב'." : "If the drawing looks good — click 'Convert to DXF'. Otherwise — click 'Try Again'."}
              </p>

              <div className="flex gap-2">
                <Button size="lg" className="flex-1 bg-green-600 hover:bg-green-700 font-semibold" onClick={handleConvertToDxf}>
                  <ArrowRight className="w-4 h-4 ml-2" />{isRtl ? "המר ל-DXF" : "Convert to DXF"}
                </Button>
                <Button variant="outline" size="lg" onClick={reset}>{isRtl ? "נסה שוב" : "Try Again"}</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* DXF Result (Step 2 result) */}
        {status === "success" && dxfResult && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="w-4 h-4 text-primary" />
                <span className="font-semibold text-sm">{t("aiTraceSuccess")}</span>
              </div>

              <div className="flex flex-col gap-3 mb-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5 font-medium text-center">{isRtl ? "ציור AI" : "AI Drawing"}</p>
                  <div className="border rounded-lg overflow-hidden bg-white flex items-center justify-center p-2" style={{ minHeight: 200 }}>
                    <img src={previewResult?.previewPngBase64} alt="AI Drawing" className="max-w-full object-contain" style={{ maxHeight: 300 }} />
                  </div>
                </div>
              </div>

              <div className="mb-4"><SvgViewer svgContent={dxfResult.svgPreview} /></div>

              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="bg-white rounded-lg p-2 text-center border">
                  <p className="text-base font-bold text-primary">{dxfResult.segmentCount.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">{t("lines")}</p>
                </div>
                <div className="bg-white rounded-lg p-2 text-center border">
                  <p className="text-base font-bold text-primary">{dxfResult.realWidth ? (dxfResult.realWidth / 3.7795).toFixed(1) : "—"}</p>
                  <p className="text-xs text-muted-foreground">{t("widthMm")}</p>
                </div>
                <div className="bg-white rounded-lg p-2 text-center border">
                  <p className="text-base font-bold text-primary">{dxfResult.realHeight ? (dxfResult.realHeight / 3.7795).toFixed(1) : "—"}</p>
                  <p className="text-xs text-muted-foreground">{t("heightMm")}</p>
                </div>
              </div>

              <Button size="lg" className="w-full bg-green-600 hover:bg-green-700 font-semibold mb-3" onClick={() => setDownloadOpen(true)}>
                <Download className="w-4 h-4 ml-2" />{t("downloadDxf")}
              </Button>

              <AiRefinePanel imageUrl={dxfResult.imageUrl}
                onRefined={(refined: RefineResult) => {
                  setDxfResult({ svgPreview: refined.svgPreview, dxfUrl: refined.dxfUrl, imageUrl: refined.imageUrl, segmentCount: refined.segmentCount, realWidth: refined.realWidth, realHeight: refined.realHeight, filename: refined.dxfFilename });
                  toast.success(isRtl ? "העיצוב עודכן!" : "Design refined!");
                }} />

              <Button variant="outline" size="sm" className="w-full mt-3" onClick={reset}>{t("aiTraceNewImage")}</Button>
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
              <li className="flex gap-2"><span className="shrink-0">•</span><span>{isRtl ? "בדוק את ציור ה-AI לפני ההמרה — אם לא מדויק, לחץ 'נסה שוב'" : "Review the AI drawing before converting — if not accurate, click 'Try Again'"}</span></li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

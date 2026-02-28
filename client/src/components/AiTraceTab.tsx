/**
 * AiTraceTab.tsx — Redesigned to match AI Generate tab quality:
 *  User uploads photo → LLM analyzes → gpt-image-1 draws 3 clean B&W variations from scratch
 *  → potrace → DXF ready (same pipeline as generateRoute)
 *  No two-step process needed — results arrive in one shot.
 */

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { DxfDownloadDialog } from "@/components/DxfDownloadDialog";
import {
  Download,
  AlertCircle,
  ImageIcon,
  Scan,
  Eye,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Wand2,
  CheckCircle2,
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

interface TraceResult {
  images: GeneratedImage[];
  objectDescription: string;
}

type Status = "idle" | "loading" | "success" | "error";

const VARIATION_LABELS = ["פשוט", "מפורט", "דקורטיבי"];
const VARIATION_LABELS_EN = ["Simple", "Detailed", "Decorative"];

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

interface ImageCardProps {
  image: GeneratedImage;
  index: number;
  isRtl: boolean;
  onDownload: (image: GeneratedImage) => void;
}

function ImageCard({ image, index, isRtl, onDownload }: ImageCardProps) {
  const [showVector, setShowVector] = useState(false);
  const label = isRtl ? VARIATION_LABELS[index] : VARIATION_LABELS_EN[index];

  return (
    <Card className="border-primary/20">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">{label}</span>
          <span className="text-xs text-muted-foreground">{image.segmentCount.toLocaleString()} {isRtl ? "קווים" : "lines"}</span>
        </div>

        {/* AI Drawing preview */}
        <div className="border rounded-lg overflow-hidden bg-white mb-3 flex items-center justify-center" style={{ minHeight: 200 }}>
          <img src={image.imageUrl} alt={`Variation ${index + 1}`} className="max-w-full object-contain" style={{ maxHeight: 280 }} />
        </div>

        {/* Toggle vector preview */}
        <button
          onClick={() => setShowVector(!showVector)}
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mb-2 w-full justify-center"
        >
          <Eye className="w-3 h-3" />
          {showVector ? (isRtl ? "הסתר וקטור" : "Hide vector") : (isRtl ? "הצג וקטור DXF" : "Show DXF vector")}
        </button>

        {showVector && (
          <div className="mb-3">
            <SvgViewer svgContent={image.svgPreview} />
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 mb-3 text-center">
          <div className="bg-muted/30 rounded p-1.5">
            <p className="text-xs font-semibold">{image.realWidth ? (image.realWidth / 3.7795).toFixed(0) : "—"} mm</p>
            <p className="text-xs text-muted-foreground">{isRtl ? "רוחב" : "Width"}</p>
          </div>
          <div className="bg-muted/30 rounded p-1.5">
            <p className="text-xs font-semibold">{image.realHeight ? (image.realHeight / 3.7795).toFixed(0) : "—"} mm</p>
            <p className="text-xs text-muted-foreground">{isRtl ? "גובה" : "Height"}</p>
          </div>
        </div>

        <Button size="sm" className="w-full bg-green-600 hover:bg-green-700 font-semibold" onClick={() => onDownload(image)}>
          <Download className="w-3.5 h-3.5 ml-1.5" />
          {isRtl ? "הורד DXF" : "Download DXF"}
        </Button>
      </CardContent>
    </Card>
  );
}

interface AiTraceTabProps { onOpenAuth: () => void; }

export function AiTraceTab({ onOpenAuth }: AiTraceTabProps) {
  const { t, isRtl } = useLanguage();
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<TraceResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [downloadTarget, setDownloadTarget] = useState<GeneratedImage | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    const allowed = ["image/png", "image/jpeg", "image/bmp", "image/webp", "image/gif"];
    if (!allowed.includes(file.type)) { toast.error(isRtl ? "פורמט לא נתמך." : "Unsupported format."); return; }
    if (file.size > 16 * 1024 * 1024) { toast.error(isRtl ? "הקובץ גדול מדי. מקסימום 16 MB." : "File too large. Max 16 MB."); return; }
    setImageFile(file);
    setResult(null);
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
    setStatus("loading"); setResult(null); setErrorMsg("");
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
      setResult(data as TraceResult);
      setStatus("success");
      toast.success(isRtl ? `3 עיצובים מוכנים! בחר את המועדף ולחץ הורד DXF` : `3 designs ready! Choose your favorite and download DXF`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (isRtl ? "שגיאה בעיבוד" : "Processing error");
      setErrorMsg(msg); setStatus("error"); toast.error(msg);
    }
  };

  const reset = () => {
    setImageFile(null); setImagePreview(null); setResult(null);
    setStatus("idle"); setErrorMsg("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <>
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
              disabled={!imageFile || status === "loading"}
              onClick={handleTrace}>
              {status === "loading" ? (
                <><div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin ml-2" />{isRtl ? "ה-AI מנתח ומצייר..." : "AI is analyzing and drawing..."}</>
              ) : (
                <><Wand2 className="w-4 h-4 ml-2" />{isRtl ? "צור outline בAI" : "Create AI Outline"}</>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Loading */}
        {status === "loading" && (
          <Card>
            <CardContent className="p-8 flex flex-col items-center gap-3 text-center">
              <div className="relative w-16 h-16">
                <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
                <div className="absolute inset-0 rounded-full border-4 border-t-primary animate-spin" />
                <Wand2 className="absolute inset-0 m-auto w-6 h-6 text-primary" />
              </div>
              <p className="font-semibold text-sm">{isRtl ? "ה-AI מנתח את התמונה ומצייר 3 עיצובים..." : "AI is analyzing your image and drawing 3 designs..."}</p>
              <p className="text-xs text-muted-foreground">{isRtl ? "זה עשוי לקחת 30-60 שניות" : "This may take 30-60 seconds"}</p>
              <div className="flex gap-1.5">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
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

        {/* Results — 3 variations */}
        {status === "success" && result && (
          <>
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                  <span className="font-semibold text-sm">
                    {isRtl ? "3 עיצובים מוכנים — בחר את המועדף" : "3 designs ready — choose your favorite"}
                  </span>
                </div>
                {result.objectDescription && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    <span className="font-medium">{isRtl ? "תיאור AI: " : "AI description: "}</span>
                    {result.objectDescription}
                  </p>
                )}
              </CardContent>
            </Card>

            {result.images.map((image, idx) => (
              <ImageCard
                key={idx}
                image={image}
                index={idx}
                isRtl={isRtl}
                onDownload={setDownloadTarget}
              />
            ))}

            <Button variant="outline" size="sm" className="w-full" onClick={reset}>
              {t("aiTraceNewImage")}
            </Button>
          </>
        )}

        {/* Tips */}
        <Card className="bg-blue-50 border-blue-100">
          <CardContent className="p-4">
            <h3 className="font-semibold text-sm text-blue-800 mb-2">{t("tipsTitle")}</h3>
            <ul className="space-y-1.5 text-sm text-blue-700">
              <li className="flex gap-2"><span className="shrink-0">•</span><span>{t("aiTraceTip1")}</span></li>
              <li className="flex gap-2"><span className="shrink-0">•</span><span>{t("aiTraceTip2")}</span></li>
              <li className="flex gap-2"><span className="shrink-0">•</span><span>{isRtl ? "ה-AI מנתח את התמונה ומצייר מחדש — 3 סגנונות שונים לבחירה" : "AI analyzes your image and redraws it — 3 different styles to choose from"}</span></li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

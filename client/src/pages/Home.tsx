import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { AuthDialog } from "@/components/AuthDialog";
import {
  Upload,
  Download,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ImageIcon,
  Sliders,
  FileCode2,
  Layers,
  Sparkles,
  RefreshCw,
  Eye,
  ChevronLeft,
  Wand2,
  LogIn,
  LogOut,
  UserCircle,
} from "lucide-react";

type Status = "idle" | "loading" | "success" | "error";

interface ConvertResult {
  dxfUrl: string;
  svgPreview: string;
  segmentCount: number;
  width: number;
  height: number;
}

interface AiImage {
  imageUrl: string;
  svgPreview: string;
  dxfUrl: string;
  segmentCount: number;
  width: number;
  height: number;
}

// ─── Upload Tab ─────────────────────────────────────────────────────────────

interface UploadTabProps {
  onOpenAuth: () => void;
}

function UploadTab({ onOpenAuth }: UploadTabProps) {
  const [dragOver, setDragOver] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [threshold, setThreshold] = useState(128);
  const [simplify, setSimplify] = useState(2);
  const [doubleLineOffset, setDoubleLineOffset] = useState(0); // in mm (0 = off)
  const [dpi, setDpi] = useState(300); // default 300 DPI
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<ConvertResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [showSvgPreview, setShowSvgPreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    const allowed = ["image/png", "image/jpeg", "image/bmp", "image/webp"];
    if (!allowed.includes(file.type)) {
      toast.error("סוג קובץ לא נתמך. אנא העלה PNG, JPG, BMP או WebP.");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error("הקובץ גדול מדי. מקסימום 20 MB.");
      return;
    }
    setImageFile(file);
    setResult(null);
    setStatus("idle");
    setShowSvgPreview(false);
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleConvert = async () => {
    if (!imageFile) return;
    setStatus("loading");
    setResult(null);
    setErrorMsg("");
    setShowSvgPreview(false);

    try {
      const formData = new FormData();
      formData.append("image", imageFile);
      formData.append("threshold", String(threshold));
      formData.append("simplifyTolerance", String(simplify));
      // Convert mm to pixels based on DPI
      const doubleLineOffsetPx = doubleLineOffset === 0 ? 0 : Math.max(1, Math.round((doubleLineOffset / 25.4) * dpi));
      formData.append("doubleLineOffset", String(doubleLineOffsetPx));

      const res = await fetch("/api/convert", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok || !data.success) throw new Error(data.error ?? "שגיאה לא ידועה");

      setResult(data as ConvertResult);
      setStatus("success");
      setShowSvgPreview(true);
      toast.success(`הומרו ${data.segmentCount.toLocaleString()} קווים בהצלחה!`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "שגיאה בעיבוד התמונה";
      setErrorMsg(msg);
      setStatus("error");
      toast.error(msg);
    }
  };

  const handleDownload = () => {
    if (!result?.dxfUrl) return;
    const a = document.createElement("a");
    a.href = result.dxfUrl;
    a.download = `${imageFile?.name.replace(/\.[^.]+$/, "") ?? "output"}.dxf`;
    a.click();
  };

  const reset = () => {
    setImageFile(null);
    setImagePreview(null);
    setResult(null);
    setStatus("idle");
    setShowSvgPreview(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* Left: Upload + Controls */}
      <div className="flex flex-col gap-4">
        {/* Drop Zone */}
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div
              className={`relative border-2 border-dashed rounded-xl transition-all cursor-pointer min-h-[200px] flex flex-col items-center justify-center gap-3 p-5
                ${dragOver ? "border-primary bg-primary/5 scale-[1.01]" : "border-border hover:border-primary/50 hover:bg-muted/30"}`}
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
                <div className="w-full flex flex-col items-center gap-2">
                  <img src={imagePreview} alt="תצוגה מקדימה" className="max-h-44 max-w-full object-contain rounded-lg shadow" />
                  <p className="text-sm text-muted-foreground">{imageFile?.name}</p>
                </div>
              ) : (
                <>
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <ImageIcon className="w-6 h-6 text-primary" />
                  </div>
                  <div className="text-center">
                    <p className="font-semibold">גרור תמונה לכאן</p>
                    <p className="text-sm text-muted-foreground mt-1">או לחץ לבחירת קובץ</p>
                  </div>
                  <div className="flex gap-2 flex-wrap justify-center">
                    {["PNG", "JPG", "BMP", "WebP"].map((f) => (
                      <span key={f} className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">{f}</span>
                    ))}
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Controls */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Sliders className="w-4 h-4 text-primary" />
              <h2 className="font-semibold text-sm">הגדרות המרה</h2>
            </div>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-sm font-medium">ערך סף (Threshold)</label>
                  <span className="text-sm font-mono bg-muted px-2 py-0.5 rounded text-primary font-semibold">{threshold}</span>
                </div>
                <Slider min={10} max={245} step={5} value={[threshold]} onValueChange={([v]) => setThreshold(v)} />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>כהה יותר</span><span>בהיר יותר</span>
                </div>
              </div>
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-sm font-medium">פישוט קווים</label>
                  <span className="text-sm font-mono bg-muted px-2 py-0.5 rounded text-primary font-semibold">{simplify}</span>
                </div>
                <Slider min={1} max={10} step={1} value={[simplify]} onValueChange={([v]) => setSimplify(v)} />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>פרטים מרביים</span><span>קווים פשוטים</span>
                </div>
              </div>
              {/* Double-line CNC mode */}
              <div className="border-t pt-3">
                <div className="flex justify-between items-center mb-1">
                  <label className="text-sm font-medium flex items-center gap-1.5">
                    <span className="inline-block w-2 h-2 rounded-full bg-orange-500"></span>
                    מצב קו כפול CNC
                  </label>
                  <span className="text-sm font-mono bg-muted px-2 py-0.5 rounded text-primary font-semibold">
                    {doubleLineOffset === 0 ? "כבוי" : `${doubleLineOffset} מ"מ`}
                  </span>
                </div>
                <Slider min={0} max={5} step={0.1} value={[doubleLineOffset]} onValueChange={([v]) => setDoubleLineOffset(parseFloat(v.toFixed(1)))} />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>כבוי</span><span>5 מ"מ</span>
                </div>

                {/* DPI field */}
                {doubleLineOffset > 0 && (
                  <div className="mt-2 flex items-center gap-2">
                    <label className="text-xs text-muted-foreground whitespace-nowrap">רזולוציית תמונה (DPI):</label>
                    <select
                      className="text-xs border rounded px-2 py-1 bg-background"
                      value={dpi}
                      onChange={(e) => setDpi(Number(e.target.value))}
                    >
                      <option value={72}>72 DPI (מסך)</option>
                      <option value={150}>150 DPI</option>
                      <option value={300}>300 DPI (ברירת מחדל)</option>
                      <option value={600}>600 DPI (סריקה)</option>
                    </select>
                  </div>
                )}

                {/* Live preview */}
                {doubleLineOffset > 0 && (
                  <div className="mt-3">
                    <p className="text-xs text-muted-foreground mb-1.5">תצוגה מקדימה של הקו הכפול:</p>
                    <svg width="100%" height="60" viewBox="0 0 200 60" className="border rounded bg-white">
                      {/* Single line reference */}
                      <line x1="10" y1="20" x2="190" y2="20" stroke="#94a3b8" strokeWidth="1" strokeDasharray="4,3" />
                      <text x="10" y="14" fontSize="7" fill="#94a3b8">קו מקורי</text>
                      {/* Double lines */}
                      {(() => {
                        const offsetPx = Math.max(1, Math.round((doubleLineOffset / 25.4) * dpi));
                        const scale = 80 / Math.max(1, Math.round((5 / 25.4) * dpi)); // scale to fit preview
                        const visualOffset = Math.max(2, Math.min(20, offsetPx * scale));
                        return (
                          <>
                            <line x1="10" y1={40 - visualOffset / 2} x2="190" y2={40 - visualOffset / 2} stroke="#1d4ed8" strokeWidth="1.5" />
                            <line x1="10" y1={40 + visualOffset / 2} x2="190" y2={40 + visualOffset / 2} stroke="#1d4ed8" strokeWidth="1.5" />
                            <text x="10" y="58" fontSize="7" fill="#1d4ed8">קו כפול ({doubleLineOffset} מ"מ = {Math.max(1, Math.round((doubleLineOffset / 25.4) * dpi))}px)</text>
                          </>
                        );
                      })()}
                    </svg>
                  </div>
                )}

                {doubleLineOffset > 0 && (
                  <p className="text-xs text-orange-600 mt-1.5 bg-orange-50 rounded px-2 py-1">
                    ✓ כל קו יוכפל עם רווח של {doubleLineOffset} מ"מ ({Math.max(1, Math.round((doubleLineOffset / 25.4) * dpi))}px) — מתאים לחריטת CNC
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Button size="lg" className="w-full h-11 font-semibold" disabled={!imageFile || status === "loading"} onClick={handleConvert}>
          {status === "loading" ? <><Loader2 className="w-4 h-4 ml-2 animate-spin" />מעבד...</> : <><Upload className="w-4 h-4 ml-2" />המר ל-DXF</>}
        </Button>
      </div>

      {/* Right: Status + SVG Preview */}
      <div className="flex flex-col gap-4">
        <Card className="flex-1">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <Layers className="w-4 h-4 text-primary" />
              <h2 className="font-semibold text-sm">תוצאה</h2>
            </div>

            {status === "idle" && (
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                  <FileCode2 className="w-6 h-6 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground text-sm">{imageFile ? "לחץ על 'המר ל-DXF'" : "העלה תמונה כדי להתחיל"}</p>
              </div>
            )}

            {status === "loading" && (
              <div className="flex flex-col items-center gap-4 py-10 text-center">
                <div className="w-14 h-14 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                <p className="font-medium">מעבד תמונה...</p>
                <p className="text-sm text-muted-foreground">מזהה קצוות ומייצר קווים וקטוריים</p>
              </div>
            )}

            {status === "success" && result && (
              <div className="flex flex-col gap-4">
                {/* SVG Preview */}
                {showSvgPreview && result.svgPreview && (
                  <div className="border rounded-lg overflow-hidden bg-white">
                    <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/30">
                      <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground font-medium">תצוגה מקדימה של הוקטור</span>
                    </div>
                    <div
                      className="w-full flex items-center justify-center p-2 bg-white"
                      style={{ maxHeight: 260, overflow: "hidden" }}
                      dangerouslySetInnerHTML={{ __html: result.svgPreview.replace(/<svg /, '<svg style="max-width:100%;max-height:240px;width:auto;height:auto;" ') }}
                    />
                  </div>
                )}

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-muted rounded-lg p-2.5 text-center">
                    <p className="text-lg font-bold text-primary">{result.segmentCount.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">קווים</p>
                  </div>
                  <div className="bg-muted rounded-lg p-2.5 text-center">
                    <p className="text-lg font-bold text-primary">{result.width}</p>
                    <p className="text-xs text-muted-foreground">רוחב px</p>
                  </div>
                  <div className="bg-muted rounded-lg p-2.5 text-center">
                    <p className="text-lg font-bold text-primary">{result.height}</p>
                    <p className="text-xs text-muted-foreground">גובה px</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg border border-green-100">
                  <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                  <p className="text-sm font-medium text-green-700">ההמרה הושלמה בהצלחה!</p>
                </div>

                <Button size="lg" className="w-full bg-green-600 hover:bg-green-700 font-semibold" onClick={handleDownload}>
                  <Download className="w-4 h-4 ml-2" />הורד קובץ DXF
                </Button>
                <Button variant="outline" size="sm" className="w-full" onClick={reset}>
                  המר תמונה חדשה
                </Button>
              </div>
            )}

            {status === "error" && (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-red-500" />
                </div>
                <p className="font-semibold text-red-600">שגיאה בעיבוד</p>
                <p className="text-sm text-muted-foreground max-w-xs">{errorMsg}</p>
                <Button variant="outline" size="sm" onClick={() => setStatus("idle")}>נסה שוב</Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── AI Generator Tab ────────────────────────────────────────────────────────

function AiGeneratorTab() {
  const [prompt, setPrompt] = useState("");
  const [modifications, setModifications] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [images, setImages] = useState<AiImage[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [showModify, setShowModify] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const generate = async (isModify = false) => {
    if (!prompt.trim()) {
      toast.error("נא להזין תיאור של התמונה הרצויה");
      return;
    }
    setStatus("loading");
    setImages([]);
    setSelectedIdx(null);
    setErrorMsg("");

    try {
      const res = await fetch("/api/generate-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt.trim(),
          modifications: isModify ? modifications.trim() : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error ?? "שגיאה ביצירת התמונות");

      setImages(data.images as AiImage[]);
      setStatus("success");
      setShowModify(false);
      setModifications("");
      toast.success("3 עיצובים נוצרו בהצלחה!");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "שגיאה ביצירת התמונות";
      setErrorMsg(msg);
      setStatus("error");
      toast.error(msg);
    }
  };

  const handleDownload = (img: AiImage) => {
    const a = document.createElement("a");
    a.href = img.dxfUrl;
    a.download = `ai-design-${Date.now()}.dxf`;
    a.click();
  };

  const selected = selectedIdx !== null ? images[selectedIdx] : null;

  return (
    <div className="flex flex-col gap-5">
      {/* Prompt Input */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-sm">תאר את העיצוב הרצוי</h2>
          </div>
          <Textarea
            placeholder="לדוגמה: פרח שושן, מנדלה עגולה, דג קוי, עץ זית, לוגו פשוט של כוכב..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="resize-none text-base min-h-[90px] text-right"
            dir="rtl"
            disabled={status === "loading"}
          />
          <p className="text-xs text-muted-foreground mt-2">
            ה-AI ייצור 3 וריאציות של הציור בקווים שחור-לבן, מוכנות לחריטה ו-CNC
          </p>
          <Button
            className="w-full mt-3 h-11 font-semibold"
            onClick={() => generate(false)}
            disabled={status === "loading" || !prompt.trim()}
          >
            {status === "loading" ? (
              <><Loader2 className="w-4 h-4 ml-2 animate-spin" />יוצר עיצובים...</>
            ) : (
              <><Wand2 className="w-4 h-4 ml-2" />צור 3 עיצובים</>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Loading State */}
      {status === "loading" && (
        <Card>
          <CardContent className="p-8">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                <Sparkles className="w-6 h-6 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
              </div>
              <div>
                <p className="font-semibold text-base">ה-AI יוצר עיצובים...</p>
                <p className="text-sm text-muted-foreground mt-1">מייצר 3 וריאציות שחור-לבן בקווים דקים</p>
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
            <p className="font-semibold text-red-600">שגיאה ביצירת התמונות</p>
            <p className="text-sm text-muted-foreground">{errorMsg}</p>
            <Button variant="outline" size="sm" onClick={() => setStatus("idle")}>נסה שוב</Button>
          </CardContent>
        </Card>
      )}

      {/* Gallery */}
      {status === "success" && images.length > 0 && (
        <>
          <div>
            <p className="text-sm font-semibold mb-3 text-muted-foreground">בחר את העיצוב המועדף עליך:</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {images.map((img, idx) => (
                <div
                  key={idx}
                  className={`relative rounded-xl border-2 cursor-pointer transition-all overflow-hidden bg-white
                    ${selectedIdx === idx ? "border-primary shadow-lg scale-[1.02]" : "border-border hover:border-primary/50 hover:shadow-md"}`}
                  onClick={() => setSelectedIdx(idx)}
                >
                  {/* AI-generated image preview */}
                  <div className="aspect-square overflow-hidden bg-white flex items-center justify-center p-1">
                    <img
                      src={img.imageUrl}
                      alt={`עיצוב ${idx + 1}`}
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div className="px-2 py-1.5 border-t bg-muted/30 flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">וריאציה {idx + 1}</span>
                    <span className="text-xs text-muted-foreground">{img.segmentCount.toLocaleString()} קווים</span>
                  </div>
                  {selectedIdx === idx && (
                    <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                      <CheckCircle2 className="w-4 h-4 text-white" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Selected image detail */}
          {selected && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                  <span className="font-semibold text-sm">וריאציה {selectedIdx! + 1} נבחרה</span>
                </div>

                {/* SVG Vector Preview */}
                {selected.svgPreview && (
                  <div className="border rounded-lg overflow-hidden bg-white mb-3">
                    <div className="flex items-center gap-2 px-3 py-1.5 border-b bg-muted/30">
                      <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground font-medium">תצוגת קווי וקטור (DXF)</span>
                    </div>
                    <div
                      className="w-full flex items-center justify-center p-2 bg-white"
                      style={{ maxHeight: 220 }}
                      dangerouslySetInnerHTML={{
                        __html: selected.svgPreview.replace(
                          /<svg /,
                          '<svg style="max-width:100%;max-height:200px;width:auto;height:auto;" '
                        ),
                      }}
                    />
                  </div>
                )}

                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div className="bg-white rounded-lg p-2 text-center border">
                    <p className="text-base font-bold text-primary">{selected.segmentCount.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">קווים</p>
                  </div>
                  <div className="bg-white rounded-lg p-2 text-center border">
                    <p className="text-base font-bold text-primary">{selected.width}</p>
                    <p className="text-xs text-muted-foreground">רוחב px</p>
                  </div>
                  <div className="bg-white rounded-lg p-2 text-center border">
                    <p className="text-base font-bold text-primary">{selected.height}</p>
                    <p className="text-xs text-muted-foreground">גובה px</p>
                  </div>
                </div>

                <Button
                  size="lg"
                  className="w-full bg-green-600 hover:bg-green-700 font-semibold mb-2"
                  onClick={() => handleDownload(selected)}
                >
                  <Download className="w-4 h-4 ml-2" />הורד קובץ DXF
                </Button>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => { setShowModify(!showModify); }}
                  >
                    <RefreshCw className="w-3.5 h-3.5 ml-1.5" />
                    בקש שינויים
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => { setImages([]); setSelectedIdx(null); setStatus("idle"); }}
                  >
                    <ChevronLeft className="w-3.5 h-3.5 ml-1.5" />
                    עיצוב חדש
                  </Button>
                </div>

                {/* Modification Input */}
                {showModify && (
                  <div className="mt-3 p-3 bg-white rounded-lg border">
                    <p className="text-xs font-medium mb-2 text-muted-foreground">תאר את השינויים הרצויים:</p>
                    <Textarea
                      placeholder="לדוגמה: הוסף עלים, עשה את הקווים עבים יותר, הוסף פרטים..."
                      value={modifications}
                      onChange={(e) => setModifications(e.target.value)}
                      className="resize-none text-sm min-h-[70px] text-right mb-2"
                      dir="rtl"
                    />
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={() => generate(true)}
                      disabled={!modifications.trim()}
                    >
                      <Wand2 className="w-3.5 h-3.5 ml-1.5" />
                      צור 3 עיצובים מעודכנים
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Tips */}
      <Card className="bg-purple-50 border-purple-100">
        <CardContent className="p-4">
          <h3 className="font-semibold text-sm text-purple-800 mb-2">✨ טיפים לתיאור טוב</h3>
          <ul className="space-y-1.5 text-sm text-purple-700">
            <li className="flex gap-2"><span className="shrink-0">•</span><span>ציין סגנון: "בסגנון מינימליסטי", "עם פרטים דקים", "גיאומטרי"</span></li>
            <li className="flex gap-2"><span className="shrink-0">•</span><span>הוסף הקשר: "לחריטה על עץ", "לחיתוך לייזר", "לחותמת"</span></li>
            <li className="flex gap-2"><span className="shrink-0">•</span><span>דוגמאות: "פרח לוטוס", "מנדלה עם 8 עלים", "דרקון יפני", "מפת ישראל"</span></li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function Home() {
  const [appUser, setAppUser] = useState<{ id: number; email: string; name: string | null } | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [limitReached, setLimitReached] = useState(false);

  // Load current user on mount
  useEffect(() => {
    fetch("/api/app-auth/me")
      .then((r) => r.json())
      .then((d) => { if (d.user) setAppUser(d.user); })
      .catch(() => {});
  }, []);

  const handleLogout = async () => {
    await fetch("/api/app-auth/logout", { method: "POST" });
    setAppUser(null);
    toast.success("התנתקתא בהצלחה");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container py-3 flex items-center gap-3">
          <img
            src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663365044246/SslVmktvndMoFSwH.png"
            alt="לוגו"
            className="w-10 h-10 rounded-lg object-contain shrink-0"
          />
          <div className="flex-1">
            <h1 className="text-base font-bold leading-tight">ממיר תמונה ל-DXF</h1>
            <p className="text-xs text-muted-foreground">המרה לקבצי וקטור לחיתוך לייזר ו-CNC</p>
          </div>
          {/* Auth buttons */}
          {appUser ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <UserCircle className="w-4 h-4" />
                <span className="hidden sm:inline">{appUser.name ?? appUser.email}</span>
              </div>
              <Button variant="ghost" size="sm" onClick={handleLogout} className="text-xs">
                <LogOut className="w-3.5 h-3.5 ml-1" />
                יציאה
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="outline" onClick={() => { setLimitReached(false); setAuthOpen(true); }} className="text-xs gap-1.5">
              <LogIn className="w-3.5 h-3.5" />
              התחבר/הירשם
            </Button>
          )}
        </div>
      </header>

      <AuthDialog
        open={authOpen}
        onOpenChange={setAuthOpen}
        limitReached={limitReached}
        onSuccess={(user) => {
          setAppUser(user);
          setLimitReached(false);
        }}
      />

      <main className="container py-6">
        <Tabs defaultValue="upload" dir="rtl">
          <TabsList className="w-full mb-5 h-11">
            <TabsTrigger value="upload" className="flex-1 gap-2 text-sm">
              <Upload className="w-4 h-4" />
              העלאת תמונה
            </TabsTrigger>
            <TabsTrigger value="ai" className="flex-1 gap-2 text-sm">
              <Sparkles className="w-4 h-4" />
              יצירת AI
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload">
            <UploadTab onOpenAuth={() => { setLimitReached(true); setAuthOpen(true); }} />
          </TabsContent>

          <TabsContent value="ai">
            <AiGeneratorTab />
          </TabsContent>
        </Tabs>
      </main>

      <footer className="border-t bg-white/50 mt-6">
        <div className="container py-3 text-center text-xs text-muted-foreground">
          ממיר תמונה ל-DXF — לשימוש ב-CNC, חיתוך לייזר ועיצוב CAD
        </div>
      </footer>
    </div>
  );
}

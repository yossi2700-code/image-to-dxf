import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Upload, Download, Loader2, ImageIcon, CheckCircle2, Info } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface ProcessResult {
  bmpUrl: string;
  previewUrl: string;
  width: number;
  height: number;
  bitDepth: number;
  fileSizeKB: number;
  wasColorConverted: boolean;
}

export default function NeedleEngraving() {
  const { language } = useLanguage();
  const isHe = language === "he";

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isPortrait, setIsPortrait] = useState(false);
  const [widthCm, setWidthCm] = useState<string>("");
  const [heightCm, setHeightCm] = useState<string>("");
  const [dpi, setDpi] = useState<number>(180);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ProcessResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const t = {
    title: isHe ? "חריטה עם מחט יהלום" : "Diamond Needle Engraving",
    subtitle: isHe
      ? "המרת תמונה לקובץ BMP 8-bit מוכן לחריטה על גרניט שחור"
      : "Convert image to BMP 8-bit ready for black granite engraving",
    uploadTitle: isHe ? "העלה תמונה" : "Upload Image",
    uploadHint: isHe ? "JPG או PNG, עד 20MB" : "JPG or PNG, up to 20MB",
    dragHint: isHe ? "גרור תמונה לכאן או לחץ לבחירה" : "Drag image here or click to select",
    portraitMode: isHe ? "מצב פורטרט (פנים)" : "Portrait mode (faces)",
    portraitHint: isHe ? "מותאם לחריטת פנים ופורטרטים" : "Optimized for face & portrait engraving",
    sizeTitle: isHe ? "גודל פלט (אופציונלי)" : "Output Size (optional)",
    widthLabel: isHe ? "רוחב (ס\"מ)" : "Width (cm)",
    heightLabel: isHe ? "גובה (ס\"מ)" : "Height (cm)",
    dpiLabel: isHe ? "רזולוציה (DPI)" : "Resolution (DPI)",
    dpiHint: isHe ? "180 DPI מומלץ לחריטה" : "180 DPI recommended for engraving",
    processBtn: isHe ? "עבד תמונה" : "Process Image",
    processing: isHe ? "מעבד..." : "Processing...",
    resultTitle: isHe ? "תוצאה מוכנה" : "Result Ready",
    downloadBmp: isHe ? "הורד BMP לחריטה" : "Download BMP for Engraving",
    colorConverted: isHe ? "תמונה צבעונית הומרה לגווני אפור על ידי AI" : "Color image converted to grayscale by AI",
    bwDirect: isHe ? "תמונה שחור-לבן — עובדה ישירות" : "B&W image — processed directly",
    infoTitle: isHe ? "איך זה עובד" : "How it works",
    info1: isHe ? "תמונה צבעונית → AI ממיר לגווני אפור מקצועי" : "Color image → AI converts to professional grayscale",
    info2: isHe ? "תמונה שחור-לבן → עיבוד ישיר ללא AI" : "B&W image → direct processing without AI",
    info3: isHe ? "CLAHE לאיזון חשיפה + Unsharp mask לחידוד פרטים" : "CLAHE exposure balance + Unsharp mask for detail sharpening",
    info4: isHe ? "פלט: BMP 8-bit בלבד (לא 24-bit — המכונה לא קוראת 24-bit)" : "Output: BMP 8-bit only (not 24-bit — machine won't read 24-bit)",
    specTitle: isHe ? "מפרט טכני" : "Technical Specs",
    spec1: isHe ? "פורמט: BMP 8-bit בלבד" : "Format: BMP 8-bit only",
    spec2: isHe ? "עומק צבע: 256 גווני אפור" : "Color depth: 256 grayscale levels",
    spec3: isHe ? "רקע: שחור מוחלט (0,0,0)" : "Background: absolute black (0,0,0)",
    spec4: isHe ? "DPI ברירת מחדל: 180" : "Default DPI: 180",
    noFile: isHe ? "נא לבחור תמונה" : "Please select an image",
    errorProcessing: isHe ? "שגיאה בעיבוד התמונה" : "Error processing image",
  };

  const handleFileChange = useCallback((f: File | null) => {
    if (!f) return;
    setFile(f);
    setResult(null);
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(f);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f && (f.type === "image/jpeg" || f.type === "image/png")) {
      handleFileChange(f);
    }
  }, [handleFileChange]);

  const handleProcess = async () => {
    if (!file) {
      toast.error(t.noFile);
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append("image", file);
      if (widthCm) formData.append("widthCm", widthCm);
      if (heightCm) formData.append("heightCm", heightCm);
      formData.append("dpi", String(dpi));
      formData.append("isPortrait", String(isPortrait));

      const res = await fetch("/api/needle-engraving/process", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.error || "Server error");
      }
      const data = await res.json();
      setResult(data);
      toast.success(isHe ? "הקובץ מוכן!" : "File ready!", {
        description: isHe
          ? `${data.width}×${data.height} פיקסלים, ${data.fileSizeKB} KB`
          : `${data.width}×${data.height} pixels, ${data.fileSizeKB} KB`,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(t.errorProcessing, { description: message });
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!result) return;
    const a = document.createElement("a");
    a.href = result.bmpUrl;
    a.download = file ? file.name.replace(/\.[^.]+$/, "") + "_engraving.bmp" : "engraving.bmp";
    a.click();
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-white" dir={isHe ? "rtl" : "ltr"}>
      <div className="max-w-5xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/30 rounded-full px-4 py-1.5 mb-4">
            <span className="text-indigo-400 text-sm font-medium">
              {isHe ? "חדש" : "New"}
            </span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">{t.title}</h1>
          <p className="text-slate-400 text-lg">{t.subtitle}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Upload + Settings */}
          <div className="lg:col-span-2 space-y-5">
            {/* Upload Zone */}
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader className="pb-3">
                <CardTitle className="text-white text-base flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-indigo-400" />
                  {t.uploadTitle}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className="border-2 border-dashed border-slate-600 rounded-xl p-8 text-center cursor-pointer hover:border-indigo-500 transition-colors"
                  onDrop={handleDrop}
                  onDragOver={(e) => e.preventDefault()}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {preview ? (
                    <div className="space-y-3">
                      <img
                        src={preview}
                        alt="preview"
                        className="max-h-48 mx-auto rounded-lg object-contain"
                      />
                      <p className="text-slate-400 text-sm">{file?.name}</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <Upload className="w-10 h-10 text-slate-500 mx-auto" />
                      <p className="text-slate-300">{t.dragHint}</p>
                      <p className="text-slate-500 text-sm">{t.uploadHint}</p>
                    </div>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png"
                  className="hidden"
                  onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
                />

                {/* Portrait toggle */}
                <div className="mt-4 flex items-center gap-3 p-3 bg-slate-700/40 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setIsPortrait(!isPortrait)}
                    className={`w-10 h-6 rounded-full transition-colors ${isPortrait ? "bg-indigo-500" : "bg-slate-600"}`}
                  >
                    <span
                      className={`block w-4 h-4 bg-white rounded-full mx-1 transition-transform ${isPortrait ? "translate-x-4" : ""}`}
                    />
                  </button>
                  <div>
                    <p className="text-white text-sm font-medium">{t.portraitMode}</p>
                    <p className="text-slate-400 text-xs">{t.portraitHint}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Size Settings */}
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader className="pb-3">
                <CardTitle className="text-white text-base">{t.sizeTitle}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-slate-300 text-sm mb-1.5 block">{t.widthLabel}</Label>
                    <Input
                      type="number"
                      min="1"
                      max="200"
                      placeholder="30"
                      value={widthCm}
                      onChange={(e) => setWidthCm(e.target.value)}
                      className="bg-slate-700 border-slate-600 text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-slate-300 text-sm mb-1.5 block">{t.heightLabel}</Label>
                    <Input
                      type="number"
                      min="1"
                      max="200"
                      placeholder="30"
                      value={heightCm}
                      onChange={(e) => setHeightCm(e.target.value)}
                      className="bg-slate-700 border-slate-600 text-white"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <Label className="text-slate-300 text-sm">{t.dpiLabel}</Label>
                    <span className="text-indigo-400 font-mono text-sm">{dpi} DPI</span>
                  </div>
                  <Slider
                    min={72}
                    max={360}
                    step={10}
                    value={[dpi]}
                    onValueChange={(v) => setDpi(v[0])}
                    className="[&>span]:bg-indigo-500"
                  />
                  <p className="text-slate-500 text-xs mt-1">{t.dpiHint}</p>
                </div>
              </CardContent>
            </Card>

            {/* Process Button */}
            <Button
              onClick={handleProcess}
              disabled={!file || loading}
              className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white text-base font-semibold"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  {t.processing}
                </>
              ) : (
                t.processBtn
              )}
            </Button>

            {/* Result */}
            {result && (
              <Card className="bg-emerald-900/20 border-emerald-500/40">
                <CardContent className="pt-5 space-y-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    <span className="text-emerald-300 font-semibold">{t.resultTitle}</span>
                  </div>

                  {/* Preview */}
                  <img
                    src={result.previewUrl}
                    alt="engraving preview"
                    className="w-full max-h-64 object-contain rounded-lg bg-black"
                  />

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="bg-slate-800/60 rounded-lg p-2">
                      <p className="text-slate-400 text-xs">{isHe ? "גודל" : "Size"}</p>
                      <p className="text-white text-sm font-mono">{result.width}×{result.height}</p>
                    </div>
                    <div className="bg-slate-800/60 rounded-lg p-2">
                      <p className="text-slate-400 text-xs">Bit depth</p>
                      <p className="text-white text-sm font-mono">{result.bitDepth}-bit</p>
                    </div>
                    <div className="bg-slate-800/60 rounded-lg p-2">
                      <p className="text-slate-400 text-xs">{isHe ? "גודל קובץ" : "File size"}</p>
                      <p className="text-white text-sm font-mono">{result.fileSizeKB} KB</p>
                    </div>
                  </div>

                  {/* Color conversion note */}
                  <Badge
                    variant="outline"
                    className={result.wasColorConverted
                      ? "border-blue-500/40 text-blue-300 bg-blue-500/10"
                      : "border-slate-500/40 text-slate-300 bg-slate-500/10"}
                  >
                    {result.wasColorConverted ? t.colorConverted : t.bwDirect}
                  </Badge>

                  <Button
                    onClick={handleDownload}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    {t.downloadBmp}
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right: Info Panel */}
          <div className="space-y-5">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader className="pb-3">
                <CardTitle className="text-white text-sm flex items-center gap-2">
                  <Info className="w-4 h-4 text-blue-400" />
                  {t.infoTitle}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[t.info1, t.info2, t.info3, t.info4].map((info, i) => (
                  <div key={i} className="flex gap-2 text-sm">
                    <span className="text-indigo-400 font-bold shrink-0">{i + 1}.</span>
                    <span className="text-slate-300">{info}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader className="pb-3">
                <CardTitle className="text-white text-sm">{t.specTitle}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {[t.spec1, t.spec2, t.spec3, t.spec4].map((spec, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-emerald-400 shrink-0">✓</span>
                    <span className="text-slate-300">{spec}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* DPI table */}
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader className="pb-3">
                <CardTitle className="text-white text-sm">
                  {isHe ? "טבלת גדלים (ס\"מ × DPI = פיקסלים)" : "Size table (cm × DPI = pixels)"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <table className="w-full text-xs text-slate-300">
                  <thead>
                    <tr className="text-slate-500 border-b border-slate-700">
                      <th className="text-start pb-1">{isHe ? "גודל" : "Size"}</th>
                      <th className="text-start pb-1">DPI</th>
                      <th className="text-start pb-1">{isHe ? "פיקסלים" : "Pixels"}</th>
                    </tr>
                  </thead>
                  <tbody className="space-y-1">
                    {[
                      { cm: "30×30", dpi: 180, px: "2126×2126" },
                      { cm: "25×25", dpi: 180, px: "1772×1772" },
                      { cm: "30×30", dpi: 100, px: "1181×1181" },
                      { cm: "25×25", dpi: 100, px: "984×984" },
                    ].map((row, i) => (
                      <tr key={i} className="border-b border-slate-700/50">
                        <td className="py-1">{row.cm} ס"מ</td>
                        <td className="py-1">{row.dpi}</td>
                        <td className="py-1 font-mono">{row.px}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

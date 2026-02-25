import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
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
} from "lucide-react";

type Status = "idle" | "loading" | "success" | "error";

interface ConvertResult {
  dxfUrl: string;
  segmentCount: number;
  width: number;
  height: number;
}

export default function Home() {
  const [dragOver, setDragOver] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [threshold, setThreshold] = useState(128);
  const [simplify, setSimplify] = useState(2);
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<ConvertResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
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

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleConvert = async () => {
    if (!imageFile) return;
    setStatus("loading");
    setResult(null);
    setErrorMsg("");

    try {
      const formData = new FormData();
      formData.append("image", imageFile);
      formData.append("threshold", String(threshold));
      formData.append("simplifyTolerance", String(simplify));

      const res = await fetch("/api/convert", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error ?? "שגיאה לא ידועה");
      }

      setResult(data as ConvertResult);
      setStatus("success");
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
    const baseName = imageFile?.name.replace(/\.[^.]+$/, "") ?? "output";
    a.download = `${baseName}.dxf`;
    a.click();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container py-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
            <FileCode2 className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-bold leading-tight">ממיר תמונה ל-DXF</h1>
            <p className="text-xs text-muted-foreground">המרת תמונות שחור-לבן לקבצי וקטור לחיתוך לייזר ו-CNC</p>
          </div>
        </div>
      </header>

      <main className="container py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left column: Upload + Controls */}
          <div className="flex flex-col gap-5">
            {/* Upload Zone */}
            <Card className="overflow-hidden">
              <CardContent className="p-0">
                <div
                  className={`relative border-2 border-dashed rounded-xl transition-all cursor-pointer min-h-[220px] flex flex-col items-center justify-center gap-3 p-6
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
                    onChange={onFileChange}
                  />
                  {imagePreview ? (
                    <div className="w-full flex flex-col items-center gap-2">
                      <img
                        src={imagePreview}
                        alt="תצוגה מקדימה"
                        className="max-h-48 max-w-full object-contain rounded-lg shadow"
                      />
                      <p className="text-sm text-muted-foreground">{imageFile?.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {imageFile ? (imageFile.size / 1024).toFixed(1) + " KB" : ""}
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                        <ImageIcon className="w-7 h-7 text-primary" />
                      </div>
                      <div className="text-center">
                        <p className="font-semibold text-base">גרור תמונה לכאן</p>
                        <p className="text-sm text-muted-foreground mt-1">או לחץ לבחירת קובץ</p>
                      </div>
                      <div className="flex gap-2 flex-wrap justify-center">
                        {["PNG", "JPG", "BMP", "WebP"].map((f) => (
                          <span key={f} className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                            {f}
                          </span>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">מקסימום 20 MB</p>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Controls */}
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Sliders className="w-4 h-4 text-primary" />
                  <h2 className="font-semibold text-sm">הגדרות המרה</h2>
                </div>

                <div className="space-y-5">
                  {/* Threshold */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-sm font-medium">ערך סף (Threshold)</label>
                      <span className="text-sm font-mono bg-muted px-2 py-0.5 rounded text-primary font-semibold">
                        {threshold}
                      </span>
                    </div>
                    <Slider
                      min={10}
                      max={245}
                      step={5}
                      value={[threshold]}
                      onValueChange={([v]) => setThreshold(v)}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>כהה יותר</span>
                      <span>בהיר יותר</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      ערך נמוך מזהה קווים כהים בלבד; ערך גבוה מזהה גם קווים בהירים.
                    </p>
                  </div>

                  {/* Simplify */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-sm font-medium">פישוט קווים</label>
                      <span className="text-sm font-mono bg-muted px-2 py-0.5 rounded text-primary font-semibold">
                        {simplify}
                      </span>
                    </div>
                    <Slider
                      min={1}
                      max={10}
                      step={1}
                      value={[simplify]}
                      onValueChange={([v]) => setSimplify(v)}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>פרטים מרביים</span>
                      <span>קווים פשוטים</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      ערך גבוה מסנן קווים קצרים ומפחית את גודל הקובץ.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Convert Button */}
            <Button
              size="lg"
              className="w-full h-12 text-base font-semibold"
              disabled={!imageFile || status === "loading"}
              onClick={handleConvert}
            >
              {status === "loading" ? (
                <>
                  <Loader2 className="w-5 h-5 ml-2 animate-spin" />
                  מעבד תמונה...
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5 ml-2" />
                  המר ל-DXF
                </>
              )}
            </Button>
          </div>

          {/* Right column: Status + Result */}
          <div className="flex flex-col gap-5">
            {/* Status Card */}
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Layers className="w-4 h-4 text-primary" />
                  <h2 className="font-semibold text-sm">סטטוס עיבוד</h2>
                </div>

                {status === "idle" && (
                  <div className="flex flex-col items-center gap-3 py-8 text-center">
                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                      <FileCode2 className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground text-sm">
                      {imageFile ? "לחץ על 'המר ל-DXF' להתחלת העיבוד" : "העלה תמונה כדי להתחיל"}
                    </p>
                  </div>
                )}

                {status === "loading" && (
                  <div className="flex flex-col items-center gap-4 py-8 text-center">
                    <div className="relative">
                      <div className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                    </div>
                    <div>
                      <p className="font-medium">מעבד תמונה...</p>
                      <p className="text-sm text-muted-foreground mt-1">מזהה קצוות ומייצר קווים וקטוריים</p>
                    </div>
                    <div className="w-full space-y-1.5">
                      {["טוען תמונה", "מזהה קצוות", "מייצר DXF"].map((step, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-primary shrink-0" />
                          <span className="text-muted-foreground">{step}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {status === "success" && result && (
                  <div className="flex flex-col items-center gap-4 py-6 text-center">
                    <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
                      <CheckCircle2 className="w-8 h-8 text-green-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-green-700">ההמרה הושלמה בהצלחה!</p>
                      <p className="text-sm text-muted-foreground mt-1">הקובץ מוכן להורדה</p>
                    </div>

                    {/* Stats */}
                    <div className="w-full grid grid-cols-3 gap-3 mt-2">
                      <div className="bg-muted rounded-lg p-3 text-center">
                        <p className="text-xl font-bold text-primary">
                          {result.segmentCount.toLocaleString()}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">קווים</p>
                      </div>
                      <div className="bg-muted rounded-lg p-3 text-center">
                        <p className="text-xl font-bold text-primary">{result.width}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">רוחב (px)</p>
                      </div>
                      <div className="bg-muted rounded-lg p-3 text-center">
                        <p className="text-xl font-bold text-primary">{result.height}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">גובה (px)</p>
                      </div>
                    </div>

                    <Button
                      size="lg"
                      className="w-full mt-2 h-12 text-base font-semibold bg-green-600 hover:bg-green-700"
                      onClick={handleDownload}
                    >
                      <Download className="w-5 h-5 ml-2" />
                      הורד קובץ DXF
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        setImageFile(null);
                        setImagePreview(null);
                        setResult(null);
                        setStatus("idle");
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                    >
                      המר תמונה חדשה
                    </Button>
                  </div>
                )}

                {status === "error" && (
                  <div className="flex flex-col items-center gap-3 py-8 text-center">
                    <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center">
                      <AlertCircle className="w-8 h-8 text-red-500" />
                    </div>
                    <div>
                      <p className="font-semibold text-red-600">שגיאה בעיבוד</p>
                      <p className="text-sm text-muted-foreground mt-1 max-w-xs">{errorMsg}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setStatus("idle")}
                    >
                      נסה שוב
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Tips Card */}
            <Card className="bg-blue-50 border-blue-100">
              <CardContent className="p-5">
                <h3 className="font-semibold text-sm text-blue-800 mb-3">💡 טיפים לתוצאות טובות</h3>
                <ul className="space-y-2 text-sm text-blue-700">
                  <li className="flex gap-2">
                    <span className="shrink-0 mt-0.5">•</span>
                    <span>השתמש בתמונות עם ניגודיות גבוהה בין שחור ולבן</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="shrink-0 mt-0.5">•</span>
                    <span>הגדל את ערך הסף אם הקווים דקים מדי, הקטן אם עבים מדי</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="shrink-0 mt-0.5">•</span>
                    <span>פישוט גבוה מתאים לחיתוך לייזר, נמוך לחריטה מדויקת</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="shrink-0 mt-0.5">•</span>
                    <span>קובץ DXF תואם AutoCAD, Fusion 360, LightBurn ועוד</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t bg-white/50 mt-8">
        <div className="container py-4 text-center text-xs text-muted-foreground">
          ממיר תמונה ל-DXF — לשימוש ב-CNC, חיתוך לייזר ועיצוב CAD
        </div>
      </footer>
    </div>
  );
}

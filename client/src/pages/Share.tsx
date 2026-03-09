import { useEffect, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Download,
  Sparkles,
  Upload,
  ArrowRight,
  Share2,
  FileCode2,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

// ─── SVG Zoom Viewer ──────────────────────────────────────────────────────────

function SvgViewer({ svg }: { svg: string }) {
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  return (
    <div
      className="relative w-full h-full overflow-hidden bg-white rounded-xl border"
      onWheel={(e) => {
        e.preventDefault();
        setScale((s) => Math.min(10, Math.max(0.1, s * (e.deltaY > 0 ? 0.85 : 1.15))));
      }}
      onMouseDown={(e) => {
        setDragging(true);
        setDragStart({ x: e.clientX - translate.x, y: e.clientY - translate.y });
      }}
      onMouseMove={(e) => {
        if (!dragging) return;
        setTranslate({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
      }}
      onMouseUp={() => setDragging(false)}
      onMouseLeave={() => setDragging(false)}
      style={{ cursor: dragging ? "grabbing" : "grab" }}
    >
      <div
        style={{ transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`, transformOrigin: "center", width: "100%", height: "100%" }}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      {/* Controls */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-white/90 backdrop-blur border rounded-full px-2 py-1 shadow text-xs">
        <button onClick={() => setScale((s) => Math.min(10, s * 1.2))} className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-muted font-bold">+</button>
        <span className="w-10 text-center">{Math.round(scale * 100)}%</span>
        <button onClick={() => setScale((s) => Math.max(0.1, s * 0.8))} className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-muted font-bold">−</button>
        <button onClick={() => { setScale(1); setTranslate({ x: 0, y: 0 }); }} className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-muted text-xs">⊙</button>
      </div>
    </div>
  );
}

// ─── Share Page ───────────────────────────────────────────────────────────────

export default function SharePage() {
  const [, params] = useRoute("/share/:token");
  const [, navigate] = useLocation();
  const { t, isRtl } = useLanguage();
  const token = params?.token ?? "";

  const { data: design, isLoading } = trpc.history.getByShareToken.useQuery(
    { token },
    { enabled: !!token }
  );

  // Update page meta for WhatsApp Open Graph preview
  useEffect(() => {
    if (!design) return;
    const title = design.shareTitle ?? design.description ?? t("shareDxfDesign");
    document.title = `${title} — ImageToDXF`;

    const setMeta = (property: string, content: string) => {
      let el = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute("property", property);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    };

    setMeta("og:title", title);
    setMeta("og:description", `${design.segmentCount?.toLocaleString() ?? "?"} ${t("shareVectorLines")}`);
    setMeta("og:type", "website");
    setMeta("og:url", window.location.href);
    if (design.imageUrl) setMeta("og:image", design.imageUrl);
  }, [design]);

  const handleDownload = () => {
    if (!design?.dxfUrl) return;
    const a = document.createElement("a");
    a.href = design.dxfUrl;
    a.download = `${design.shareTitle ?? design.description ?? "design"}.dxf`;
    a.click();
  };

  const handleWhatsApp = () => {
    const text = encodeURIComponent(`🎨 ${design?.shareTitle ?? design?.description ?? t("shareDxfDesign")}\n${window.location.href}`);
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">{t("shareLoadingDesign")}</p>
        </div>
      </div>
    );
  }

  if (!design) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50" dir={isRtl ? "rtl" : "ltr"}>
        <Card className="max-w-sm w-full mx-4">
          <CardContent className="p-8 text-center space-y-4">
            <div className="text-5xl">🔗</div>
            <h2 className="text-xl font-bold">{t("shareLinkNotFound")}</h2>
            <p className="text-muted-foreground text-sm">{t("shareLinkInvalid")}</p>
            <Button className="w-full" onClick={() => navigate("/")}>
              <ArrowRight className="w-4 h-4 ml-2" />
              {t("shareBackToHome")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isAi = design.actionType === "ai_generate";
  const title = design.shareTitle ?? design.description ?? (isAi ? t("shareAiDesign") : t("shareImageConversion"));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50" dir={isRtl ? "rtl" : "ltr"}>
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <button onClick={() => navigate("/")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowRight className="w-4 h-4" />
            ImageToDXF
          </button>
          <div className="flex items-center gap-2">
            <Badge variant={isAi ? "default" : "secondary"} className="gap-1">
              {isAi ? <Sparkles className="w-3 h-3" /> : <Upload className="w-3 h-3" />}
              {isAi ? t("shareAiDesign") : t("shareImageConversion")}
            </Badge>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Title */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-foreground">{title}</h1>
          {design.segmentCount != null && design.segmentCount > 0 && (
            <p className="text-muted-foreground text-sm">
              {design.segmentCount.toLocaleString()} {t("shareVectorLines")}
            </p>
          )}
        </div>

        {/* SVG Preview */}
        {design.svgPreview ? (
          <div className="h-80 rounded-xl overflow-hidden shadow-sm border">
            <SvgViewer svg={design.svgPreview} />
          </div>
        ) : design.imageUrl ? (
          <div className="rounded-xl overflow-hidden shadow-sm border bg-white">
            <img src={design.imageUrl} alt={title} className="w-full object-contain max-h-80" />
          </div>
        ) : null}

        {/* Action Buttons */}
        <div className="flex flex-col gap-3">
          {design.dxfUrl && (
            <Button size="lg" className="w-full bg-green-600 hover:bg-green-700 font-semibold h-12" onClick={handleDownload}>
              <Download className="w-4 h-4 ml-2" />
              {t("shareDownloadDxf")}
            </Button>
          )}
          <Button size="lg" variant="outline" className="w-full h-12 border-green-500 text-green-700 hover:bg-green-50 font-semibold" onClick={handleWhatsApp}>
            <Share2 className="w-4 h-4 ml-2" />
            {t("shareWhatsApp")}
          </Button>
          <Button size="lg" variant="outline" className="w-full h-12" onClick={() => navigate("/")}>
            <FileCode2 className="w-4 h-4 ml-2" />
            {t("shareCreateNew")}
          </Button>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground pt-4">
          <span className="font-semibold text-primary">ImageToDXF</span> — {t("shareFooter")}
        </p>
      </main>
    </div>
  );
}

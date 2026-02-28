import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { DxfDownloadDialog } from "@/components/DxfDownloadDialog";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowRight,
  ArrowLeft,
  Download,
  Sparkles,
  Upload,
  Clock,
  FileCode2,
  ImageIcon,
  Trash2,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type HistoryItem = {
  id: number;
  actionType: "convert" | "ai_generate" | "download";
  description: string | null;
  segmentCount: number | null;
  dxfUrl: string | null;
  imageUrl: string | null;
  svgPreview: string | null;
  createdAt: Date;
};

// ─── SVG Zoom Viewer ─────────────────────────────────────────────────────────

function SvgViewer({ svg }: { svg: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, tx: 0, ty: 0 });
  const lastPinchDistRef = useRef<number | null>(null);

  useEffect(() => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  }, [svg]);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.85 : 1.15;
    setScale((s) => Math.min(10, Math.max(0.2, s * delta)));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY, tx: translate.x, ty: translate.y };
  };
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setTranslate({ x: dragStartRef.current.tx + dx, y: dragStartRef.current.ty + dy });
  }, [dragging]);
  const handleMouseUp = () => setDragging(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastPinchDistRef.current = Math.hypot(dx, dy);
    } else if (e.touches.length === 1) {
      dragStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, tx: translate.x, ty: translate.y };
      setDragging(true);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 2 && lastPinchDistRef.current !== null) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const ratio = dist / lastPinchDistRef.current;
      lastPinchDistRef.current = dist;
      setScale((s) => Math.min(10, Math.max(0.2, s * ratio)));
    } else if (e.touches.length === 1 && dragging) {
      const dx = e.touches[0].clientX - dragStartRef.current.x;
      const dy = e.touches[0].clientY - dragStartRef.current.y;
      setTranslate({ x: dragStartRef.current.tx + dx, y: dragStartRef.current.ty + dy });
    }
  };

  const handleTouchEnd = () => {
    setDragging(false);
    lastPinchDistRef.current = null;
  };

  const resetView = () => { setScale(1); setTranslate({ x: 0, y: 0 }); };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden bg-white border rounded-lg select-none"
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ cursor: dragging ? "grabbing" : "grab", touchAction: "none" }}
    >
      <div
        style={{
          transform: `translate(calc(-50% + ${translate.x}px), calc(-50% + ${translate.y}px)) scale(${scale})`,
          transformOrigin: "center center",
          position: "absolute",
          top: "50%",
          left: "50%",
          width: "90%",
          height: "90%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-white/95 rounded-lg shadow-md px-2 py-1 text-xs border">
        <button onClick={() => setScale((s) => Math.min(10, s * 1.25))} className="w-7 h-7 flex items-center justify-center rounded hover:bg-muted font-bold text-base">+</button>
        <span className="w-12 text-center font-mono">{Math.round(scale * 100)}%</span>
        <button onClick={() => setScale((s) => Math.max(0.2, s * 0.8))} className="w-7 h-7 flex items-center justify-center rounded hover:bg-muted font-bold text-base">−</button>
        <button onClick={resetView} className="w-7 h-7 flex items-center justify-center rounded hover:bg-muted text-sm">⊙</button>
      </div>
    </div>
  );
}

// ─── History Item Card ─────────────────────────────────────────────────────────

function HistoryCard({
  item,
  onView,
  onDelete,
}: {
  item: HistoryItem;
  onView: (item: HistoryItem) => void;
  onDelete: (item: HistoryItem) => void;
}) {
  const { t, isRtl, language } = useLanguage();
  const [downloadOpen, setDownloadOpen] = useState(false);
  const isAi = item.actionType === "ai_generate";
  const date = new Date(item.createdAt).toLocaleString(language === "he" ? "he-IL" : "en-US", {
    dateStyle: "short",
    timeStyle: "short",
  });

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow group">
      <div className="relative h-40 bg-muted/30 flex items-center justify-center overflow-hidden">
        {item.svgPreview ? (
          <div
            className="w-full h-full p-2 flex items-center justify-center bg-white"
            dangerouslySetInnerHTML={{
              __html: item.svgPreview.replace(
                /<svg /,
                '<svg style="max-width:100%;max-height:100%;width:auto;height:auto;display:block;" '
              ),
            }}
          />
        ) : (
          <ImageIcon className="w-10 h-10 text-muted-foreground" />
        )}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          <Button size="sm" variant="secondary" onClick={() => onView(item)}>
            {isRtl ? "הצג" : "View"}
          </Button>
          <Button size="sm" variant="destructive" onClick={(e) => { e.stopPropagation(); onDelete(item); }}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
        <div className="absolute top-2 right-2">
          <Badge variant={isAi ? "default" : "secondary"} className="text-xs gap-1">
            {isAi ? <Sparkles className="w-3 h-3" /> : <Upload className="w-3 h-3" />}
            {isAi ? "AI" : (isRtl ? "המרה" : "Convert")}
          </Badge>
        </div>
      </div>

      <CardContent className="p-3 space-y-1.5" dir={isRtl ? "rtl" : "ltr"}>
        <p className="text-sm font-medium truncate text-foreground">
          {item.description ?? (isAi ? t("aiDesign") : t("imageConversion"))}
        </p>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {date}
          </span>
          {item.segmentCount != null && item.segmentCount > 0 && (
            <span>{item.segmentCount.toLocaleString()} {t("lines")}</span>
          )}
        </div>
        {item.dxfUrl && (
          <button
            onClick={(e) => { e.stopPropagation(); setDownloadOpen(true); }}
            className="flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <FileCode2 className="w-3 h-3" />
            {isRtl ? "שמור קובץ" : "Save File"}
          </button>
        )}
        {item.dxfUrl && downloadOpen && (
          <DxfDownloadDialog
            open={downloadOpen}
            onClose={() => setDownloadOpen(false)}
            svgContent={item.svgPreview ?? ""}
            dxfUrl={item.dxfUrl}
            defaultFilename={`${item.description ?? "design"}.dxf`}
            segmentCount={item.segmentCount ?? 0}
          />
        )}
      </CardContent>
    </Card>
  );
}

// ─── Detail Dialog ─────────────────────────────────────────────────────────────

function DetailDialog({
  item,
  onClose,
  onDelete,
}: {
  item: HistoryItem | null;
  onClose: () => void;
  onDelete: (item: HistoryItem) => void;
}) {
  const { t, isRtl, language } = useLanguage();
  const [dxfDownloadOpen, setDxfDownloadOpen] = useState(false);
  if (!item) return null;
  const isAi = item.actionType === "ai_generate";
  const date = new Date(item.createdAt).toLocaleString(language === "he" ? "he-IL" : "en-US", {
    dateStyle: "long",
    timeStyle: "short",
  });

  return (
    <Dialog open={!!item} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl w-full" dir={isRtl ? "rtl" : "ltr"}>
        <DialogHeader>
          <DialogTitle className={`flex items-center gap-2 ${isRtl ? "text-right" : "text-left"}`}>
            {isAi ? <Sparkles className="w-4 h-4 text-purple-600" /> : <Upload className="w-4 h-4 text-blue-600" />}
            {item.description ?? (isAi ? t("aiDesign") : t("imageConversion"))}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {item.svgPreview && (
            <div className="h-72 rounded-lg overflow-hidden border bg-white">
              <SvgViewer svg={item.svgPreview} />
            </div>
          )}

          <div className={`flex gap-3 items-start`} dir={isRtl ? "rtl" : "ltr"}>
            <div className={`text-sm space-y-1 ${isRtl ? "text-right" : "text-left"}`}>
              <p className="text-muted-foreground">{date}</p>
              {item.segmentCount != null && item.segmentCount > 0 && (
                <p className="text-muted-foreground">{item.segmentCount.toLocaleString()} {isRtl ? "קווי וקטור" : "vector lines"}</p>
              )}
            </div>
          </div>

          <div className="flex gap-2 justify-between flex-wrap">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50"
              onClick={() => { onClose(); onDelete(item); }}
            >
              <Trash2 className="w-4 h-4" />
              {t("delete")}
            </Button>
            <div className="flex gap-2 flex-wrap">
              {item.dxfUrl && (
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setDxfDownloadOpen(true)}>
                  <Download className="w-4 h-4" />
                  {isRtl ? "הורד DXF" : "Download DXF"}
                </Button>
              )}
            </div>
          </div>

          {item.dxfUrl && dxfDownloadOpen && (
            <DxfDownloadDialog
              open={dxfDownloadOpen}
              onClose={() => setDxfDownloadOpen(false)}
              svgContent={item.svgPreview ?? ""}
              dxfUrl={item.dxfUrl}
              defaultFilename={`${item.description ?? "design"}.dxf`}
              segmentCount={item.segmentCount ?? 0}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function History() {
  const { t, isRtl } = useLanguage();
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const { data: items, isLoading } = trpc.history.list.useQuery();
  const [selectedItem, setSelectedItem] = useState<HistoryItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<HistoryItem | null>(null);

  const deleteMutation = trpc.history.delete.useMutation({
    onSuccess: () => {
      void utils.history.list.invalidate();
      setDeleteTarget(null);
    },
  });

  const handleDeleteConfirm = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate({ id: deleteTarget.id });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50" dir={isRtl ? "rtl" : "ltr"}>
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container py-3 flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/")}
            className="gap-1.5 text-muted-foreground"
          >
            {isRtl ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
            {t("back")}
          </Button>
          <div className="flex-1">
            <h1 className="text-base font-bold leading-tight">{t("historyTitle")}</h1>
            <p className="text-xs text-muted-foreground">{t("historySubtitle")}</p>
          </div>
          <LanguageSwitcher />
        </div>
      </header>

      <main className="container py-6">
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <Card key={i}>
                <div className="h-40 bg-muted animate-pulse" />
                <CardContent className="p-3 space-y-2">
                  <div className="h-4 bg-muted animate-pulse rounded" />
                  <div className="h-3 bg-muted animate-pulse rounded w-2/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : !items || items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <Clock className="w-8 h-8 text-muted-foreground" />
            </div>
            <div>
              <p className="text-lg font-semibold">{t("noDesigns")}</p>
              <p className="text-sm text-muted-foreground mt-1">{t("noDesignsSubtitle")}</p>
            </div>
            <Button onClick={() => navigate("/")} className="gap-1.5">
              <Sparkles className="w-4 h-4" />
              {isRtl ? "צור עיצוב ראשון" : "Create First Design"}
            </Button>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground mb-4">
              {items.length} {t("designs")}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {items.map((item) => (
                <HistoryCard
                  key={item.id}
                  item={item as HistoryItem}
                  onView={setSelectedItem}
                  onDelete={setDeleteTarget}
                />
              ))}
            </div>
          </>
        )}
      </main>

      <DetailDialog
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
        onDelete={(item) => {
          setSelectedItem(null);
          setDeleteTarget(item);
        }}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent dir={isRtl ? "rtl" : "ltr"}>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteDesign")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteConfirm")} "{(() => {
                const desc = deleteTarget?.description ?? "";
                if (!desc) return isRtl ? "העיצוב" : "this design";
                // Take only first sentence or first 40 chars
                const firstSentence = desc.split(/[.!?]/)[0].trim();
                return firstSentence.length > 40 ? firstSentence.slice(0, 40) + "…" : firstSentence;
              })()}"? {t("deleteWarning")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className={isRtl ? "flex-row-reverse gap-2" : "gap-2"}>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? t("deleting") : t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

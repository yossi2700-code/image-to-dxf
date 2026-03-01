import { useState, useRef, useEffect } from "react";
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
  Wand2,
  X,
  ZoomIn,
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

  const styledSvg = svg.replace(
    /<svg /,
    '<svg style="width:100%;height:100%;display:block;" '
  );

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.85 : 1.15;
    setScale((s) => Math.min(10, Math.max(0.3, s * delta)));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY, tx: translate.x, ty: translate.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return;
    setTranslate({
      x: dragStartRef.current.tx + (e.clientX - dragStartRef.current.x),
      y: dragStartRef.current.ty + (e.clientY - dragStartRef.current.y),
    });
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      const t = e.touches[0];
      setDragging(true);
      dragStartRef.current = { x: t.clientX, y: t.clientY, tx: translate.x, ty: translate.y };
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastPinchDistRef.current = Math.sqrt(dx * dx + dy * dy);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && dragging) {
      const t = e.touches[0];
      setTranslate({
        x: dragStartRef.current.tx + (t.clientX - dragStartRef.current.x),
        y: dragStartRef.current.ty + (t.clientY - dragStartRef.current.y),
      });
    } else if (e.touches.length === 2 && lastPinchDistRef.current !== null) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const ratio = dist / lastPinchDistRef.current;
      setScale((s) => Math.min(10, Math.max(0.3, s * ratio)));
      lastPinchDistRef.current = dist;
    }
  };

  return (
    <div
      ref={containerRef}
      className="w-full h-full overflow-hidden cursor-grab active:cursor-grabbing select-none"
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={() => setDragging(false)}
      onMouseLeave={() => setDragging(false)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={() => { setDragging(false); lastPinchDistRef.current = null; }}
    >
      <div
        style={{
          transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
          transformOrigin: "center center",
          width: "100%",
          height: "100%",
        }}
        dangerouslySetInnerHTML={{ __html: styledSvg }}
      />
    </div>
  );
}

// ─── History Card ─────────────────────────────────────────────────────────────

function HistoryCard({
  item,
  onView,
  onDelete,
  onEditAgain,
}: {
  item: HistoryItem;
  onView: (item: HistoryItem) => void;
  onDelete: (item: HistoryItem) => void;
  onEditAgain: (item: HistoryItem) => void;
}) {
  const { t, isRtl, language } = useLanguage();
  const isAi = item.actionType === "ai_generate";
  const date = new Date(item.createdAt).toLocaleDateString(language === "he" ? "he-IL" : "en-US", {
    month: "short",
    day: "numeric",
  });

  return (
    <Card
      className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow group"
      onClick={() => onView(item)}
    >
      <div className="relative h-40 bg-white flex items-center justify-center overflow-hidden">
        {item.svgPreview ? (
          <div
            className="w-full h-full p-2"
            dangerouslySetInnerHTML={{
              __html: item.svgPreview.replace(
                /<svg /,
                '<svg style="width:100%;height:100%;object-fit:contain;" '
              ),
            }}
          />
        ) : item.imageUrl ? (
          <img src={item.imageUrl} alt="" className="w-full h-full object-contain" />
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <ImageIcon className="w-8 h-8" />
          </div>
        )}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors flex items-center justify-center">
          <ZoomIn className="w-6 h-6 text-white opacity-0 group-hover:opacity-60 transition-opacity drop-shadow" />
        </div>
        <div className="absolute top-2 right-2">
          <Badge variant={isAi ? "default" : "secondary"} className="text-xs px-1.5 py-0.5">
            {isAi ? <Sparkles className="w-3 h-3" /> : <Upload className="w-3 h-3" />}
          </Badge>
        </div>
      </div>
      <CardContent className="p-3 space-y-1.5">
        <p className="text-sm font-medium leading-tight line-clamp-2 text-right">
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
      </CardContent>
    </Card>
  );
}

// ─── Detail Dialog ─────────────────────────────────────────────────────────────

function DetailDialog({
  item,
  onClose,
  onDelete,
  onEditAgain,
  onDownload,
}: {
  item: HistoryItem | null;
  onClose: () => void;
  onDelete: (item: HistoryItem) => void;
  onEditAgain: (item: HistoryItem) => void;
  onDownload: (item: HistoryItem) => void;
}) {
  const { t, isRtl, language } = useLanguage();
  if (!item) return null;
  const isAi = item.actionType === "ai_generate";
  const date = new Date(item.createdAt).toLocaleString(language === "he" ? "he-IL" : "en-US", {
    dateStyle: "long",
    timeStyle: "short",
  });

  return (
    <Dialog open={!!item} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl w-full" dir={isRtl ? "rtl" : "ltr"}>
        {/* Large custom close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-50 w-10 h-10 rounded-full bg-muted hover:bg-muted/80 border border-border flex items-center justify-center transition-colors shadow-sm"
          aria-label="Close"
        >
          <X className="w-5 h-5 text-foreground" />
        </button>

        <DialogHeader>
          <DialogTitle className={`flex items-center gap-2 ${isRtl ? "text-right" : "text-left"} pr-12`}>
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
              {/* Edit Again */}
              {isAi && item.svgPreview && (
                <Button
                  size="sm"
                  className="gap-1.5 bg-purple-600 hover:bg-purple-700"
                  onClick={() => { onClose(); onEditAgain(item); }}
                >
                  <Wand2 className="w-4 h-4" />
                  {isRtl ? "ערוך מחדש" : "Edit Again"}
                </Button>
              )}
              {/* Download DXF / PDF — opens top-level DxfDownloadDialog */}
              {item.dxfUrl && (
                <Button
                  size="sm"
                  className="gap-1.5 bg-green-600 hover:bg-green-700 font-semibold"
                  onClick={() => { onClose(); onDownload(item); }}
                >
                  <Download className="w-4 h-4" />
                  {isRtl ? "הורד DXF / PDF" : "Download DXF / PDF"}
                </Button>
              )}
            </div>
          </div>
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

  // Download dialog state — lifted to top level so it's never nested inside another dialog
  const [downloadTarget, setDownloadTarget] = useState<HistoryItem | null>(null);
  const [downloadOpen, setDownloadOpen] = useState(false);

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

  const handleDownload = (item: HistoryItem) => {
    setDownloadTarget(item);
    setDownloadOpen(true);
  };

  const handleEditAgain = (item: HistoryItem) => {
    if (item.svgPreview && item.dxfUrl) {
      sessionStorage.setItem("editAgainItem", JSON.stringify({
        svgPreview: item.svgPreview,
        dxfUrl: item.dxfUrl,
        imageUrl: item.imageUrl,
        segmentCount: item.segmentCount,
        description: item.description,
      }));
    }
    navigate("/");
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
                  onEditAgain={handleEditAgain}
                />
              ))}
            </div>
          </>
        )}
      </main>

      {/* Detail Dialog */}
      <DetailDialog
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
        onDelete={(item) => {
          setSelectedItem(null);
          setDeleteTarget(item);
        }}
        onEditAgain={handleEditAgain}
        onDownload={(item) => {
          setSelectedItem(null);
          // Small delay so detail dialog closes before download dialog opens
          setTimeout(() => handleDownload(item), 150);
        }}
      />

      {/* DXF / PDF Download Dialog — top level, never nested */}
      {downloadTarget && downloadTarget.dxfUrl && (
        <DxfDownloadDialog
          open={downloadOpen}
          onClose={() => { setDownloadOpen(false); setDownloadTarget(null); }}
          svgContent={downloadTarget.svgPreview ?? ""}
          dxfUrl={downloadTarget.dxfUrl}
          defaultFilename={`${downloadTarget.description ?? "design"}.dxf`}
          segmentCount={downloadTarget.segmentCount ?? 0}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent dir={isRtl ? "rtl" : "ltr"}>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteDesign")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteConfirm")} "{(() => {
                const desc = deleteTarget?.description ?? "";
                if (!desc) return isRtl ? "העיצוב" : "this design";
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

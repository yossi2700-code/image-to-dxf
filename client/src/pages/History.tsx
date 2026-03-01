import { useState, useRef, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  Clock,
  FileCode2,
  ImageIcon,
  Trash2,
  Wand2,
  X,
  ZoomIn,
  Search,
  ChevronLeft,
  ChevronRight,
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
  shareToken: string | null;
  groupId: string | null;
  variationLabel: string | null;
  sourceImageUrl: string | null;
  createdAt: Date;
};

type HistoryGroup = {
  groupId: string | null;
  items: HistoryItem[];
  createdAt: Date;
  description: string | null;
  actionType: "convert" | "ai_generate" | "download";
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

  const styledSvg = svg.replace(/<svg /, '<svg style="width:100%;height:100%;display:block;" ');

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
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastPinchDistRef.current = Math.sqrt(dx * dx + dy * dy);
    } else if (e.touches.length === 1) {
      setDragging(true);
      dragStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, tx: translate.x, ty: translate.y };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && lastPinchDistRef.current !== null) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      setScale((s) => Math.min(10, Math.max(0.3, s * (dist / lastPinchDistRef.current!))));
      lastPinchDistRef.current = dist;
    } else if (e.touches.length === 1 && dragging) {
      setTranslate({
        x: dragStartRef.current.tx + (e.touches[0].clientX - dragStartRef.current.x),
        y: dragStartRef.current.ty + (e.touches[0].clientY - dragStartRef.current.y),
      });
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
        style={{ transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`, transformOrigin: "center center", width: "100%", height: "100%" }}
        dangerouslySetInnerHTML={{ __html: styledSvg }}
      />
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function varLabel(label: string | null, isRtl: boolean): string {
  if (!label) return "";
  const map: Record<string, { he: string; en: string }> = {
    simple: { he: "פשוט", en: "Simple" },
    detailed: { he: "מפורט", en: "Detailed" },
    complex: { he: "מורכב", en: "Complex" },
    decorative: { he: "דקורטיבי", en: "Decorative" },
  };
  return isRtl ? (map[label]?.he ?? label) : (map[label]?.en ?? label);
}

function cleanDesc(desc: string | null, fallback: string): string {
  if (!desc) return fallback;
  const clean = desc.replace(/^(Professional black and white line art illustration of |Clean black and white line art of a landscape scene: )/i, "");
  return clean.length > 55 ? clean.slice(0, 55) + "…" : clean;
}

// ─── Group Card ───────────────────────────────────────────────────────────────
function GroupCard({
  group, onViewVariation, onDelete, onEditAgain, onDownload, onTryAgain,
}: {
  group: HistoryGroup;
  onViewVariation: (item: HistoryItem) => void;
  onDelete: (group: HistoryGroup) => void;
  onEditAgain: (item: HistoryItem) => void;
  onDownload: (item: HistoryItem) => void;
  onTryAgain: (item: HistoryItem) => void;
}) {
  const { isRtl, language } = useLanguage();
  const [activeIdx, setActiveIdx] = useState(0);
  const [showSource, setShowSource] = useState(false);
  const isAi = group.actionType === "ai_generate";
  const isGroup = group.items.length > 1;
  const activeItem = group.items[activeIdx];
  const hasSource = !!activeItem?.sourceImageUrl;

  const date = new Date(group.createdAt).toLocaleString(language === "he" ? "he-IL" : "en-US", {
    dateStyle: "medium", timeStyle: "short",
  });

  const shortDesc = cleanDesc(group.description, isRtl ? "עיצוב" : "Design");

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      {/* Preview */}
      <div className="relative bg-white aspect-square overflow-hidden">
        {showSource && hasSource ? (
          <img src={activeItem.sourceImageUrl!} alt="original" className="w-full h-full object-contain cursor-pointer" onClick={() => setShowSource(false)} />
        ) : activeItem?.svgPreview ? (
          <div className="w-full h-full cursor-pointer" onClick={() => onViewVariation(activeItem)}>
            <div className="w-full h-full" dangerouslySetInnerHTML={{ __html: activeItem.svgPreview.replace(/<svg /, '<svg style="width:100%;height:100%;display:block;" ') }} />
          </div>
        ) : activeItem?.imageUrl ? (
          <img src={activeItem.imageUrl} alt={shortDesc} className="w-full h-full object-contain cursor-pointer" onClick={() => onViewVariation(activeItem)} />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-muted">
            <ImageIcon className="w-10 h-10 text-muted-foreground" />
          </div>
        )}
        <button onClick={() => onViewVariation(activeItem)} className="absolute bottom-2 left-2 w-7 h-7 rounded-full bg-black/30 hover:bg-black/50 flex items-center justify-center transition-colors">
          <ZoomIn className="w-3.5 h-3.5 text-white" />
        </button>
        {hasSource && (
          <button
            onClick={(e) => { e.stopPropagation(); setShowSource((v) => !v); }}
            className={`absolute bottom-2 right-2 text-xs px-2 py-0.5 rounded-full font-semibold transition-colors ${
              showSource ? "bg-purple-600 text-white" : "bg-black/30 hover:bg-black/50 text-white"
            }`}
          >
            {showSource ? (isRtl ? "וקטור" : "Vector") : (isRtl ? "מקור" : "Source")}
          </button>
        )}
        {isGroup && (
          <div className="absolute top-2 right-2 flex items-center gap-1">
            <button onClick={(e) => { e.stopPropagation(); setActiveIdx((i) => Math.max(0, i - 1)); }} disabled={activeIdx === 0} className="w-6 h-6 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center disabled:opacity-30 transition-colors">
              <ChevronRight className="w-3.5 h-3.5 text-white" />
            </button>
            <span className="text-white text-xs font-bold bg-black/40 rounded-full px-1.5 py-0.5">{activeIdx + 1}/{group.items.length}</span>
            <button onClick={(e) => { e.stopPropagation(); setActiveIdx((i) => Math.min(group.items.length - 1, i + 1)); }} disabled={activeIdx === group.items.length - 1} className="w-6 h-6 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center disabled:opacity-30 transition-colors">
              <ChevronLeft className="w-3.5 h-3.5 text-white" />
            </button>
          </div>
        )}
      </div>

      <CardContent className="p-3 space-y-2">
        <div className="flex items-start gap-1.5">
          {isAi ? <Sparkles className="w-3.5 h-3.5 text-purple-500 mt-0.5 shrink-0" /> : <FileCode2 className="w-3.5 h-3.5 text-blue-500 mt-0.5 shrink-0" />}
          <p className="text-xs font-medium leading-snug flex-1 min-w-0 break-words">{shortDesc}</p>
        </div>

        {isGroup && (
          <div className="flex gap-1 flex-wrap">
            {group.items.map((item, i) => (
              <button key={item.id} onClick={() => setActiveIdx(i)}
                className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${i === activeIdx ? "bg-purple-600 text-white border-purple-600" : "bg-muted text-muted-foreground border-border hover:border-purple-400"}`}>
                {varLabel(item.variationLabel, isRtl)}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{date}</span>
          {activeItem?.segmentCount != null && activeItem.segmentCount > 0 && (
            <span>{activeItem.segmentCount.toLocaleString()} {isRtl ? "קווים" : "lines"}</span>
          )}
        </div>

        <div className="flex gap-1.5 flex-wrap pt-0.5">
          {isAi && activeItem?.svgPreview && (
            <button onClick={() => onEditAgain(activeItem)} className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold transition-colors">
              <Wand2 className="w-3.5 h-3.5" />
              {isRtl ? "ערוך מחדש" : "Re-edit"}
            </button>
          )}
          {isAi && hasSource && (
            <button onClick={() => onTryAgain(activeItem)} className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold transition-colors">
              <Sparkles className="w-3.5 h-3.5" />
              {isRtl ? "נסה שוב" : "Try Again"}
            </button>
          )}
          {activeItem?.dxfUrl && (
            <button onClick={() => onDownload(activeItem)} className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md bg-green-600 hover:bg-green-700 text-white text-xs font-semibold transition-colors">
              <Download className="w-3.5 h-3.5" />
              {isRtl ? "הורד DXF" : "Download DXF"}
            </button>
          )}
          <button onClick={() => onDelete(group)} className="w-8 h-8 flex items-center justify-center rounded-md border border-red-200 text-red-500 hover:bg-red-50 transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Detail Dialog ─────────────────────────────────────────────────────────────
function DetailDialog({
  item, onClose, onDelete, onEditAgain, onDownload,
}: {
  item: HistoryItem | null;
  onClose: () => void;
  onDelete: (item: HistoryItem) => void;
  onEditAgain: (item: HistoryItem) => void;
  onDownload: (item: HistoryItem) => void;
}) {
  const { isRtl, language } = useLanguage();
  if (!item) return null;
  const isAi = item.actionType === "ai_generate";
  const date = new Date(item.createdAt).toLocaleString(language === "he" ? "he-IL" : "en-US", { dateStyle: "long", timeStyle: "short" });
  const displayDesc = cleanDesc(item.description, isRtl ? "עיצוב AI" : "AI Design");

  return (
    <Dialog open={!!item} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl w-full" dir={isRtl ? "rtl" : "ltr"}>
        <button onClick={onClose} className="absolute top-3 right-3 z-50 w-10 h-10 rounded-full bg-muted hover:bg-muted/80 border border-border flex items-center justify-center transition-colors shadow-sm" aria-label="Close">
          <X className="w-5 h-5 text-foreground" />
        </button>
        <DialogHeader>
          <DialogTitle className={`flex items-center gap-2 ${isRtl ? "text-right" : "text-left"} pr-12`}>
            {isAi ? <Sparkles className="w-4 h-4 text-purple-600" /> : <FileCode2 className="w-4 h-4 text-blue-600" />}
            {displayDesc}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {item.svgPreview && (
            <div className="h-72 rounded-lg overflow-hidden border bg-white">
              <SvgViewer svg={item.svgPreview} />
            </div>
          )}
          {!item.svgPreview && item.imageUrl && (
            <div className="h-72 rounded-lg overflow-hidden border bg-white flex items-center justify-center">
              <img src={item.imageUrl} alt="" className="max-h-full max-w-full object-contain" />
            </div>
          )}
          <div className={`text-sm space-y-1.5 ${isRtl ? "text-right" : "text-left"}`}>
            <p className="text-muted-foreground">{date}</p>
            {item.segmentCount != null && item.segmentCount > 0 && (
              <p className="text-muted-foreground">{item.segmentCount.toLocaleString()} {isRtl ? "קווי וקטור" : "vector lines"}</p>
            )}
            {item.variationLabel && (
              <Badge variant="secondary" className="text-xs">{varLabel(item.variationLabel, isRtl)}</Badge>
            )}
          </div>
          <div className="flex gap-2 justify-between flex-wrap">
            <Button variant="outline" size="sm" className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50" onClick={() => { onClose(); onDelete(item); }}>
              <Trash2 className="w-4 h-4" />
              {isRtl ? "מחק" : "Delete"}
            </Button>
            <div className="flex gap-2 flex-wrap">
              {isAi && item.svgPreview && (
                <Button size="sm" className="gap-1.5 bg-purple-600 hover:bg-purple-700" onClick={() => { onClose(); onEditAgain(item); }}>
                  <Wand2 className="w-4 h-4" />
                  {isRtl ? "ערוך מחדש" : "Re-edit"}
                </Button>
              )}
              {item.dxfUrl && (
                <Button size="sm" className="gap-1.5 bg-green-600 hover:bg-green-700 font-semibold" onClick={() => { onClose(); onDownload(item); }}>
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
  const [deleteTarget, setDeleteTarget] = useState<HistoryGroup | null>(null);
  const [downloadTarget, setDownloadTarget] = useState<HistoryItem | null>(null);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Group items by groupId
  const groups = useMemo<HistoryGroup[]>(() => {
    if (!items) return [];
    const groupMap = new Map<string, HistoryItem[]>();
    const ungrouped: HistoryItem[] = [];

    for (const item of items as HistoryItem[]) {
      if (item.groupId) {
        const existing = groupMap.get(item.groupId) ?? [];
        existing.push(item);
        groupMap.set(item.groupId, existing);
      } else {
        ungrouped.push(item);
      }
    }

    const result: HistoryGroup[] = [];
    const varOrder = ["simple", "detailed", "complex", "decorative"];

    for (const [gid, gItems] of Array.from(groupMap.entries())) {
      gItems.sort((a: HistoryItem, b: HistoryItem) => {
        const ai = varOrder.indexOf(a.variationLabel ?? "");
        const bi = varOrder.indexOf(b.variationLabel ?? "");
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      });
      result.push({ groupId: gid, items: gItems, createdAt: gItems[0].createdAt, description: gItems[0].description, actionType: gItems[0].actionType });
    }

    for (const item of ungrouped) {
      result.push({ groupId: null, items: [item], createdAt: item.createdAt, description: item.description, actionType: item.actionType });
    }

    result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return result;
  }, [items]);

  // Search filter
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return groups;
    const q = searchQuery.toLowerCase();
    return groups.filter((g) => (g.description ?? "").toLowerCase().includes(q));
  }, [groups, searchQuery]);

  // Delete group (all items)
  const deleteMutation = trpc.history.delete.useMutation({
    onSuccess: () => void utils.history.list.invalidate(),
  });

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    for (const item of deleteTarget.items) {
      await deleteMutation.mutateAsync({ id: item.id });
    }
    setDeleteTarget(null);
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

  const handleDownload = (item: HistoryItem) => {
    setDownloadTarget(item);
    setTimeout(() => setDownloadOpen(true), 100);
  };

  const handleTryAgain = (item: HistoryItem) => {
    if (item.sourceImageUrl) {
      sessionStorage.setItem("tryAgainItem", JSON.stringify({
        sourceImageUrl: item.sourceImageUrl,
        description: item.description,
      }));
    }
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50" dir={isRtl ? "rtl" : "ltr"}>
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container py-3 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="gap-1.5 text-muted-foreground">
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

      <main className="container py-6 space-y-4">
        {!isLoading && groups.length > 0 && (
          <div className="relative max-w-sm">
            <Search className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground ${isRtl ? "right-3" : "left-3"}`} />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isRtl ? "חיפוש לפי תיאור..." : "Search by description..."}
              className={isRtl ? "pr-9 text-right" : "pl-9"}
              dir={isRtl ? "rtl" : "ltr"}
            />
          </div>
        )}

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
        ) : groups.length === 0 ? (
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
        ) : filteredGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
            <Search className="w-10 h-10 text-muted-foreground" />
            <p className="text-base font-semibold">{isRtl ? "לא נמצאו תוצאות" : "No results found"}</p>
            <p className="text-sm text-muted-foreground">{isRtl ? `אין עיצובים עם "${searchQuery}"` : `No designs matching "${searchQuery}"`}</p>
            <Button variant="outline" size="sm" onClick={() => setSearchQuery("")}>{isRtl ? "נקה חיפוש" : "Clear search"}</Button>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {filteredGroups.length} {isRtl ? "בקשות" : "requests"}
              {searchQuery && ` (${isRtl ? "מסונן" : "filtered"})`}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredGroups.map((group) => (
                <GroupCard
                  key={group.groupId ?? group.items[0].id}
                  group={group}
                  onViewVariation={setSelectedItem}
                  onDelete={setDeleteTarget}
                  onEditAgain={handleEditAgain}
                  onDownload={handleDownload}
                  onTryAgain={handleTryAgain}
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
          const group = groups.find((g) => g.items.some((i) => i.id === item.id));
          if (group) setDeleteTarget(group);
        }}
        onEditAgain={handleEditAgain}
        onDownload={(item) => {
          setDownloadTarget(item);
          setSelectedItem(null);
          setTimeout(() => setDownloadOpen(true), 200);
        }}
      />

      <DxfDownloadDialog
        open={downloadOpen && !!downloadTarget?.dxfUrl}
        onClose={() => { setDownloadOpen(false); setTimeout(() => setDownloadTarget(null), 300); }}
        svgContent={downloadTarget?.svgPreview ?? ""}
        dxfUrl={downloadTarget?.dxfUrl ?? ""}
        defaultFilename={`${downloadTarget?.description ?? "design"}.dxf`}
        segmentCount={downloadTarget?.segmentCount ?? 0}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent dir={isRtl ? "rtl" : "ltr"}>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteTarget && deleteTarget.items.length > 1
                ? isRtl ? `מחק ${deleteTarget.items.length} וריאציות?` : `Delete ${deleteTarget.items.length} variations?`
                : isRtl ? "מחק עיצוב?" : "Delete design?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isRtl
                ? `פעולה זו תמחק את כל הוריאציות של "${cleanDesc(deleteTarget?.description ?? null, "העיצוב")}". לא ניתן לשחזר.`
                : `This will permanently delete all variations of "${cleanDesc(deleteTarget?.description ?? null, "this design")}". Cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className={isRtl ? "flex-row-reverse gap-2" : "gap-2"}>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleDeleteConfirm()} className="bg-red-600 hover:bg-red-700" disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? t("deleting") : t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

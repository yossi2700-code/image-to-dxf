import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight,
  Download,
  RefreshCw,
  Sparkles,
  Upload,
  Clock,
  FileCode2,
  ImageIcon,
  Share2,
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

// ─── SVG Zoom Viewer (inline) ─────────────────────────────────────────────────

function SvgViewer({ svg }: { svg: string }) {
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.85 : 1.15;
    setScale((s) => Math.min(10, Math.max(0.1, s * delta)));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setDragging(true);
    setDragStart({ x: e.clientX - translate.x, y: e.clientY - translate.y });
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return;
    setTranslate({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };
  const handleMouseUp = () => setDragging(false);

  return (
    <div
      className="relative w-full h-full overflow-hidden bg-white border rounded-lg"
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{ cursor: dragging ? "grabbing" : "grab" }}
    >
      <div
        style={{
          transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
          transformOrigin: "center center",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      {/* Zoom controls */}
      <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-white/90 rounded-lg shadow px-2 py-1 text-xs">
        <button onClick={() => setScale((s) => Math.min(10, s * 1.2))} className="w-6 h-6 flex items-center justify-center rounded hover:bg-muted font-bold">+</button>
        <span className="w-10 text-center">{Math.round(scale * 100)}%</span>
        <button onClick={() => setScale((s) => Math.max(0.1, s * 0.8))} className="w-6 h-6 flex items-center justify-center rounded hover:bg-muted font-bold">−</button>
        <button onClick={() => { setScale(1); setTranslate({ x: 0, y: 0 }); }} className="w-6 h-6 flex items-center justify-center rounded hover:bg-muted text-xs">⊙</button>
      </div>
    </div>
  );
}

// ─── History Item Card ─────────────────────────────────────────────────────────

function HistoryCard({
  item,
  onView,
}: {
  item: HistoryItem;
  onView: (item: HistoryItem) => void;
}) {
  const isAi = item.actionType === "ai_generate";
  const date = new Date(item.createdAt).toLocaleString("he-IL", {
    dateStyle: "short",
    timeStyle: "short",
  });

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow group">
      {/* Thumbnail */}
      <div className="relative h-40 bg-muted/30 flex items-center justify-center overflow-hidden">
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={item.description ?? "תמונה"}
            className="w-full h-full object-cover"
          />
        ) : item.svgPreview ? (
          <div
            className="w-full h-full p-2 flex items-center justify-center"
            dangerouslySetInnerHTML={{ __html: item.svgPreview }}
          />
        ) : (
          <ImageIcon className="w-10 h-10 text-muted-foreground" />
        )}
        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          <Button size="sm" variant="secondary" onClick={() => onView(item)}>
            הצג
          </Button>
        </div>
        {/* Badge */}
        <div className="absolute top-2 right-2">
          <Badge variant={isAi ? "default" : "secondary"} className="text-xs gap-1">
            {isAi ? <Sparkles className="w-3 h-3" /> : <Upload className="w-3 h-3" />}
            {isAi ? "AI" : "המרה"}
          </Badge>
        </div>
      </div>

      <CardContent className="p-3 space-y-1.5" dir="rtl">
        <p className="text-sm font-medium truncate text-foreground">
          {item.description ?? (isAi ? "עיצוב AI" : "המרת תמונה")}
        </p>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {date}
          </span>
          {item.segmentCount != null && item.segmentCount > 0 && (
            <span>{item.segmentCount.toLocaleString()} קווים</span>
          )}
        </div>
        {item.dxfUrl && (
          <a
            href={item.dxfUrl}
            download
            className="flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <FileCode2 className="w-3 h-3" />
            הורד DXF
          </a>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Detail Dialog ─────────────────────────────────────────────────────────────

function DetailDialog({
  item,
  onClose,
  onReconvert,
}: {
  item: HistoryItem | null;
  onClose: () => void;
  onReconvert: (item: HistoryItem) => void;
}) {
  if (!item) return null;
  const isAi = item.actionType === "ai_generate";
  const date = new Date(item.createdAt).toLocaleString("he-IL", {
    dateStyle: "long",
    timeStyle: "short",
  });

  return (
    <Dialog open={!!item} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl w-full" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right flex items-center gap-2">
            {isAi ? <Sparkles className="w-4 h-4 text-purple-600" /> : <Upload className="w-4 h-4 text-blue-600" />}
            {item.description ?? (isAi ? "עיצוב AI" : "המרת תמונה")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* SVG preview */}
          {item.svgPreview && (
            <div className="h-64 rounded-lg overflow-hidden border">
              <SvgViewer svg={item.svgPreview} />
            </div>
          )}

          {/* Original image */}
          {item.imageUrl && (
            <div className="flex gap-3 items-start">
              <img
                src={item.imageUrl}
                alt="תמונה מקורית"
                className="w-24 h-24 object-cover rounded-lg border shrink-0"
              />
              <div className="text-sm space-y-1 text-right">
                <p className="text-muted-foreground">{date}</p>
                {item.segmentCount != null && item.segmentCount > 0 && (
                  <p className="text-muted-foreground">{item.segmentCount.toLocaleString()} קווי וקטור</p>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 justify-end flex-wrap">
            {item.dxfUrl && (
              <Button asChild variant="outline" size="sm" className="gap-1.5">
                <a href={item.dxfUrl} download>
                  <Download className="w-4 h-4" />
                  הורד DXF
                </a>
              </Button>
            )}
            {/* Share via WhatsApp */}
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-green-700 border-green-300 hover:bg-green-50"
              onClick={() => {
                const shareUrl = `${window.location.origin}/share/${item.id}`;
                const text = encodeURIComponent(`עיצוב DXF: ${item.description ?? "עיצוב וקטורי"} ${shareUrl}`);
                window.open(`https://wa.me/?text=${text}`, "_blank");
              }}
            >
              <Share2 className="w-4 h-4" />
              שתף בוואטסאפ
            </Button>
            {isAi && item.description && (
              <Button
                size="sm"
                className="gap-1.5"
                onClick={() => onReconvert(item)}
              >
                <RefreshCw className="w-4 h-4" />
                צור שוב עם אותו prompt
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function History() {
  const [, navigate] = useLocation();
  const { data: items, isLoading } = trpc.history.list.useQuery();
  const [selectedItem, setSelectedItem] = useState<HistoryItem | null>(null);

  const handleReconvert = (item: HistoryItem) => {
    // Navigate to home with the prompt pre-filled via URL param
    const prompt = encodeURIComponent(item.description ?? "");
    navigate(`/?prompt=${prompt}&tab=ai`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50" dir="rtl">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container py-3 flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/")}
            className="gap-1.5 text-muted-foreground"
          >
            <ArrowRight className="w-4 h-4" />
            חזרה
          </Button>
          <div>
            <h1 className="text-base font-bold leading-tight">היסטוריית עיצובים</h1>
            <p className="text-xs text-muted-foreground">כל ההמרות והעיצובים שלך</p>
          </div>
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
              <p className="text-lg font-semibold">אין עיצובים עדיין</p>
              <p className="text-sm text-muted-foreground mt-1">
                כל המרה ועיצוב AI שתבצע יופיע כאן
              </p>
            </div>
            <Button onClick={() => navigate("/")} className="gap-1.5">
              <Sparkles className="w-4 h-4" />
              צור עיצוב ראשון
            </Button>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground mb-4">
              {items.length} עיצובים
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {items.map((item) => (
                <HistoryCard
                  key={item.id}
                  item={item as HistoryItem}
                  onView={setSelectedItem}
                />
              ))}
            </div>
          </>
        )}
      </main>

      <DetailDialog
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
        onReconvert={(item) => {
          setSelectedItem(null);
          handleReconvert(item);
        }}
      />
    </div>
  );
}

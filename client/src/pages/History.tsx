import { useState, useRef, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DxfDownloadDialog } from "@/components/DxfDownloadDialog";
import { generateAndDownloadPdf } from "@/components/ExportButtons";
import { SvgPanZoomViewer } from "@/components/SvgPanZoomViewer";
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
  Search,
  ChevronLeft,
  ChevronRight,
  ScanFace,
  FileText,
  Layers,
  ZoomIn,
  Share2,
  Building2,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
type HistoryItem = {
  id: number;
  actionType: "convert" | "ai_generate" | "download";
  feature: string | null;
  description: string | null;
  segmentCount: number | null;
  dxfUrl: string | null;
  svgUrl: string | null;
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
  feature: string | null;
};

// ─── Feature category config ──────────────────────────────────────────────────
type FeatureTab = {
  id: string;
  labelHe: string;
  labelEn: string;
  features: string[];
  icon: React.ReactNode;
  color: string;
};

const FEATURE_TABS: FeatureTab[] = [
  {
    id: "all",
    labelHe: "הכל",
    labelEn: "All",
    features: [],
    icon: <Layers className="w-3.5 h-3.5" />,
    color: "text-slate-600",
  },
  {
    id: "convert",
    labelHe: "המרה",
    labelEn: "Convert",
    features: ["convert"],
    icon: <FileCode2 className="w-3.5 h-3.5" />,
    color: "text-blue-600",
  },
  {
    id: "ai_trace",
    labelHe: "AI קווים",
    labelEn: "Image to Lines",
    features: ["ai_trace"],
    icon: <Wand2 className="w-3.5 h-3.5" />,
    color: "text-purple-600",
  },
  {
    id: "ai_generate",
    labelHe: "AI יצירה",
    labelEn: "AI Generate",
    features: ["ai_generate"],
    icon: <Sparkles className="w-3.5 h-3.5" />,
    color: "text-amber-600",
  },
  {
    id: "portrait",
    labelHe: "פורטרט",
    labelEn: "Portrait",
    features: ["portrait"],
    icon: <ScanFace className="w-3.5 h-3.5" />,
    color: "text-rose-600",
  },
  {
    id: "document_redraw",
    labelHe: "מסמך",
    labelEn: "Document",
    features: ["document_redraw"],
    icon: <FileText className="w-3.5 h-3.5" />,
    color: "text-teal-600",
  },
  {
    id: "arch_ai",
    labelHe: "שרטוט אדריכלי",
    labelEn: "Architectural",
    features: ["arch_ai"],
    icon: <Building2 className="w-3.5 h-3.5" />,
    color: "text-cyan-600",
  },
];

// ─── SVG Zoom Viewer ─────────────────────────────────────────────────────────
function SvgViewer({ svg }: { svg: string }) {
  return (
    <div className="flex flex-col h-full">
      <SvgPanZoomViewer svgContent={svg} isRtl={true} />
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

function cleanDesc(desc: string | null, fallback: string, maxLen = 120): string {
  if (!desc) return fallback;
  const clean = desc.replace(/^(Professional black and white line art illustration of |Clean black and white line art of a landscape scene: )/i, "");
  return clean.length > maxLen ? clean.slice(0, maxLen) + "…" : clean;
}
function fullDesc(desc: string | null, fallback: string): string {
  if (!desc) return fallback;
  return desc.replace(/^(Professional black and white line art illustration of |Clean black and white line art of a landscape scene: )/i, "");
}

function getFeatureLabel(feature: string | null, actionType: string, isRtl: boolean): string {
  switch (feature) {
    case "convert": return isRtl ? "המרה" : "Convert";
    case "ai_trace": return "תמונה לקווים";
    case "ai_generate": return isRtl ? "AI יצירה" : "AI Create";
    case "portrait": return isRtl ? "פורטרט" : "Portrait";
    case "document_redraw": return isRtl ? "מסמך" : "Document";
    case "arch_ai": return isRtl ? "שרטוט אדריכלי" : "Architectural";
    default: return actionType === "ai_generate" ? (isRtl ? "AI יצירה" : "AI Create") : (isRtl ? "המרה" : "Convert");
  }
}

function getFeatureBadgeClass(feature: string | null, actionType: string): string {
  switch (feature) {
    case "convert": return "bg-blue-100 text-blue-700 border-blue-200";
    case "ai_trace": return "bg-purple-100 text-purple-700 border-purple-200";
    case "ai_generate": return "bg-amber-100 text-amber-700 border-amber-200";
    case "portrait": return "bg-rose-100 text-rose-700 border-rose-200";
    case "document_redraw": return "bg-teal-100 text-teal-700 border-teal-200";
    case "arch_ai": return "bg-cyan-100 text-cyan-700 border-cyan-200";
    default: return actionType === "ai_generate" ? "bg-amber-100 text-amber-700 border-amber-200" : "bg-blue-100 text-blue-700 border-blue-200";
  }
}

function getFeatureIcon(feature: string | null, actionType: string): React.ReactNode {
  switch (feature) {
    case "convert": return <FileCode2 className="w-3.5 h-3.5 text-blue-500" />;
    case "ai_trace": return <Wand2 className="w-3.5 h-3.5 text-purple-500" />;
    case "ai_generate": return <Sparkles className="w-3.5 h-3.5 text-amber-500" />;
    case "portrait": return <ScanFace className="w-3.5 h-3.5 text-rose-500" />;
    case "document_redraw": return <FileText className="w-3.5 h-3.5 text-teal-500" />;
    case "arch_ai": return <Building2 className="w-3.5 h-3.5 text-cyan-500" />;
    default:
      return actionType === "ai_generate"
        ? <Sparkles className="w-3.5 h-3.5 text-purple-500" />
        : <FileCode2 className="w-3.5 h-3.5 text-blue-500" />;
  }
}

// ─── Group Card ───────────────────────────────────────────────────────────────
function GroupCard({
  group, onViewVariation, onDelete, onEditAgain, onDownload, onTryAgain, onPdf, onShare,
}: {
  group: HistoryGroup;
  onViewVariation: (item: HistoryItem) => void;
  onDelete: (group: HistoryGroup) => void;
  onEditAgain: (item: HistoryItem) => void;
  onDownload: (item: HistoryItem) => void;
  onTryAgain: (item: HistoryItem) => void;
  onPdf: (item: HistoryItem) => void;
  onShare?: (item: HistoryItem) => void;
}) {
  const { isRtl, language } = useLanguage();
  const [activeIdx, setActiveIdx] = useState(0);
  const [showSource, setShowSource] = useState(false);
  const isAi = group.actionType === "ai_generate" || group.feature === "ai_trace" || group.feature === "ai_generate" || group.feature === "portrait" || group.feature === "document_redraw";
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
          <div className="w-full h-full cursor-pointer svg-viewer-fill" onClick={() => onViewVariation(activeItem)}>
            <div className="w-full h-full" dangerouslySetInnerHTML={{ __html: activeItem.svgPreview.replace(/<svg /, '<svg style="width:100%;height:100%;display:block;" ') }} />
          </div>
        ) : activeItem?.imageUrl ? (
          <img src={activeItem.imageUrl} alt={shortDesc} className="w-full h-full object-contain cursor-pointer" onClick={() => onViewVariation(activeItem)} />
        ) : activeItem?.sourceImageUrl ? (
          // Show source image as fallback when no result (failed job)
          <div className="relative w-full h-full cursor-pointer" onClick={() => onViewVariation(activeItem)}>
            <img src={activeItem.sourceImageUrl} alt={shortDesc} className="w-full h-full object-contain opacity-40" />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
              <ImageIcon className="w-8 h-8 text-muted-foreground" />
              <span className="text-xs text-muted-foreground font-medium">{isRtl ? 'לא הושלם' : 'Incomplete'}</span>
            </div>
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-1 bg-muted cursor-pointer" onClick={() => onViewVariation(activeItem)}>
            <ImageIcon className="w-8 h-8 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">{isRtl ? 'לא הושלם' : 'Incomplete'}</span>
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
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`inline-flex items-center gap-1 text-xs font-semibold px-1.5 py-0.5 rounded border ${getFeatureBadgeClass(group.feature, group.actionType)}`}>
            {getFeatureIcon(group.feature, group.actionType)}
            {getFeatureLabel(group.feature, group.actionType, isRtl)}
          </span>
        </div>
        <p className="text-xs font-medium leading-snug break-words" title={fullDesc(group.description, isRtl ? "עיצוב" : "Design")}>{shortDesc}</p>

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

        {/* Row 1: Download + Delete */}
        <div className="flex gap-1.5 pt-0.5">
          {(activeItem?.dxfUrl || activeItem?.svgPreview) && (
            <button onClick={() => onDownload(activeItem)} className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md bg-slate-700 hover:bg-slate-800 text-white text-xs font-semibold transition-colors">
              <Download className="w-3.5 h-3.5" />
              {isRtl ? "הורד קובץ" : "Download"}
            </button>
          )}
          <button onClick={() => onDelete(group)} className="w-8 h-8 flex items-center justify-center rounded-md border border-red-200 text-red-500 hover:bg-red-50 transition-colors flex-shrink-0">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
        {/* Row 2: Share to Community — full width */}
        {onShare && (activeItem?.dxfUrl || activeItem?.svgPreview) && (
          <button
            onClick={() => onShare(activeItem)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md text-white text-xs font-bold transition-all hover:opacity-90 active:scale-[0.98] mt-1"
            style={{ background: 'linear-gradient(135deg, #0d9488 0%, #0891b2 100%)', boxShadow: '0 2px 6px rgba(13,148,136,0.35)' }}
          >
            <Share2 className="w-3.5 h-3.5" />
            {isRtl ? "שתף לקהילת FreeDXF ♥" : "Share to FreeDXF Community ♥"}
          </button>
        )}
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
  const isAi = item.actionType === "ai_generate" || item.feature === "ai_trace" || item.feature === "portrait" || item.feature === "document_redraw";
  const date = new Date(item.createdAt).toLocaleString(language === "he" ? "he-IL" : "en-US", { dateStyle: "long", timeStyle: "short" });
  const displayDesc = fullDesc(item.description, isRtl ? "עיצוב AI" : "AI Design");

  return (
    <Dialog open={!!item} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl w-full" dir={isRtl ? "rtl" : "ltr"}>
        <button onClick={onClose} className="absolute top-3 right-3 z-50 w-10 h-10 rounded-full bg-muted hover:bg-muted/80 border border-border flex items-center justify-center transition-colors shadow-sm" aria-label="Close">
          <X className="w-5 h-5 text-foreground" />
        </button>
        <DialogHeader>
          <DialogTitle className={`flex items-center gap-2 ${isRtl ? "text-right" : "text-left"} pr-12`}>
            {getFeatureIcon(item.feature, item.actionType)}
            {displayDesc}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {item.svgPreview && (
            <div className="h-80 rounded-lg overflow-hidden border bg-white">
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
              {(item.dxfUrl || item.svgPreview) && (
                <Button size="sm" className="gap-1.5 bg-green-600 hover:bg-green-700 font-semibold" onClick={() => { onClose(); onDownload(item); }}>
                  <Download className="w-4 h-4" />
                  {isRtl ? "הורד קובץ" : "Download File"}
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Grid of groups ────────────────────────────────────────────────────────────
function GroupGrid({
  groups,
  onViewVariation,
  onDelete,
  onEditAgain,
  onDownload,
  onTryAgain,
  onPdf,
  onShare,
  isRtl,
  emptyLabel,
}: {
  groups: HistoryGroup[];
  onViewVariation: (item: HistoryItem) => void;
  onDelete: (group: HistoryGroup) => void;
  onEditAgain: (item: HistoryItem) => void;
  onDownload: (item: HistoryItem) => void;
  onTryAgain: (item: HistoryItem) => void;
  onPdf: (item: HistoryItem) => void;
  onShare?: (item: HistoryItem) => void;
  isRtl: boolean;
  emptyLabel: string;
}) {
  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
        <Clock className="w-10 h-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {groups.map((group) => (
        <GroupCard
          key={group.groupId ?? group.items[0].id}
          group={group}
          onViewVariation={onViewVariation}
          onDelete={onDelete}
          onEditAgain={onEditAgain}
          onDownload={onDownload}
          onTryAgain={onTryAgain}
          onPdf={onPdf}
          onShare={onShare}
        />
      ))}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function History() {
  const { t, isRtl } = useLanguage();
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const [period, setPeriod] = useState<"day" | "week" | "month" | "all">("day");
  const [page, setPage] = useState(1);
  const { data: historyData, isLoading } = trpc.history.list.useQuery({ period, page, pageSize: 20 });
  const items = historyData?.items ?? [];
  const totalItems = historyData?.total ?? 0;
  const hasMore = historyData?.hasMore ?? false;
  const [selectedItem, setSelectedItem] = useState<HistoryItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<HistoryGroup | null>(null);
  const [downloadTarget, setDownloadTarget] = useState<HistoryItem | null>(null);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [shareTarget, setShareTarget] = useState<HistoryItem | null>(null);
  const [shareCreatorName, setShareCreatorName] = useState("");
  const [shareSubmitted, setShareSubmitted] = useState(false);
  const submitShareMutation = trpc.sharedFiles.submit.useMutation({
    onSuccess: () => { setShareSubmitted(true); },
    onError: (e) => { alert(e.message || (isRtl ? "שגיאה בשיתוף" : "Share failed")); },
  });

  // Reset page when period changes
  const handlePeriodChange = (p: "day" | "week" | "month" | "all") => {
    setPeriod(p);
    setPage(1);
  };

  // Group items by groupId
  const groups = useMemo<HistoryGroup[]>(() => {
    if (!items) return [];
    const groupMap = new Map<string, HistoryItem[]>();
    const ungrouped: HistoryItem[] = [];

    for (const item of (items as HistoryItem[])) {
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
      result.push({ groupId: gid, items: gItems, createdAt: gItems[0].createdAt, description: gItems[0].description, actionType: gItems[0].actionType, feature: gItems[0].feature });
    }

    for (const item of ungrouped) {
      result.push({ groupId: null, items: [item], createdAt: item.createdAt, description: item.description, actionType: item.actionType, feature: item.feature });
    }

    result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return result;
  }, [items]);

  // Filter by search query
  const searchFiltered = useMemo(() => {
    if (!searchQuery.trim()) return groups;
    const q = searchQuery.toLowerCase();
    return groups.filter((g) => (g.description ?? "").toLowerCase().includes(q));
  }, [groups, searchQuery]);

  // Filter by feature tab
  const tabFiltered = useMemo(() => {
    if (activeTab === "all") return searchFiltered;
    const tab = FEATURE_TABS.find((t) => t.id === activeTab);
    if (!tab || tab.features.length === 0) return searchFiltered;
    return searchFiltered.filter((g) => tab.features.includes(g.feature ?? ""));
  }, [searchFiltered, activeTab]);

  // Count per tab
  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = { all: searchFiltered.length };
    for (const tab of FEATURE_TABS) {
      if (tab.id === "all") continue;
      counts[tab.id] = searchFiltered.filter((g) => tab.features.includes(g.feature ?? "")).length;
    }
    return counts;
  }, [searchFiltered]);

  // Delete group (all items)
  const deleteMutation = trpc.history.delete.useMutation({
    onSuccess: () => { void utils.history.list.invalidate(); setPage(1); },
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

  const handleShare = (item: HistoryItem) => {
    setShareTarget(item);
    setShareCreatorName("");
    setShareSubmitted(false);
  };

  const handlePdf = async (item: HistoryItem) => {
    if (!item.svgPreview) return;
    try {
      await generateAndDownloadPdf(
        item.svgPreview,
        500, // default width px
        500, // default height px
        96,  // default DPI
        item.description ?? "design",
        isRtl
      );
    } catch (e) {
      console.error("PDF export error:", e);
    }
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
        {/* Period filter */}
        <div className="flex items-center gap-2 flex-wrap">
          {(["day", "week", "month", "all"] as const).map((p) => (
            <button
              key={p}
              onClick={() => handlePeriodChange(p)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                period === p
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-border hover:border-primary/50"
              }`}
            >
              {p === "day" ? (isRtl ? "יום אחרון" : "Last day") :
               p === "week" ? (isRtl ? "שבוע אחרון" : "Last week") :
               p === "month" ? (isRtl ? "חודש אחרון" : "Last month") :
               (isRtl ? "הכל" : "All")}
            </button>
          ))}
          {totalItems > 0 && (
            <span className="text-xs text-muted-foreground ms-auto">
              {totalItems} {isRtl ? "עיצובים" : "designs"}
            </span>
          )}
        </div>

        {/* Search */}
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
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} dir={isRtl ? "rtl" : "ltr"}>
            {/* Tab list - scrollable on mobile */}
            <div className="overflow-x-auto pb-1">
              <TabsList className="h-auto p-1 gap-1 flex-nowrap w-max min-w-full sm:w-auto">
                {FEATURE_TABS.map((tab) => {
                  const count = tabCounts[tab.id] ?? 0;
                  if (tab.id !== "all" && count === 0) return null;
                  return (
                    <TabsTrigger
                      key={tab.id}
                      value={tab.id}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 whitespace-nowrap"
                    >
                      <span className={activeTab === tab.id ? "" : tab.color}>{tab.icon}</span>
                      <span>{isRtl ? tab.labelHe : tab.labelEn}</span>
                      <span className={`text-xs rounded-full px-1.5 py-0.5 font-mono ${
                        activeTab === tab.id
                          ? "bg-background/50 text-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}>
                        {count}
                      </span>
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </div>

            {/* Tab content */}
            {FEATURE_TABS.map((tab) => (
              <TabsContent key={tab.id} value={tab.id} className="mt-4">
                {tabFiltered.length === 0 && searchQuery ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                    <Search className="w-10 h-10 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      {isRtl ? `אין עיצובים עם "${searchQuery}"` : `No designs matching "${searchQuery}"`}
                    </p>
                    <Button variant="outline" size="sm" onClick={() => setSearchQuery("")}>
                      {isRtl ? "נקה חיפוש" : "Clear search"}
                    </Button>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground mb-3">
                      {tabFiltered.length} {isRtl ? "בקשות" : "requests"}
                      {searchQuery && ` (${isRtl ? "מסונן" : "filtered"})`}
                    </p>
                    <GroupGrid
                      groups={tabFiltered}
                      onViewVariation={setSelectedItem}
                      onDelete={setDeleteTarget}
                      onEditAgain={handleEditAgain}
                      onDownload={handleDownload}
                      onTryAgain={handleTryAgain}
                      onPdf={handlePdf}
                      onShare={handleShare}
                      isRtl={isRtl}
                      emptyLabel={isRtl ? "אין עיצובים בקטגוריה זו" : "No designs in this category"}
                    />
                    {/* Pagination */}
                    {(page > 1 || hasMore) && (
                      <div className="flex items-center justify-center gap-3 mt-6">
                        <button
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                          disabled={page === 1}
                          className="px-4 py-2 rounded-lg border text-sm font-medium disabled:opacity-40 hover:bg-muted transition-colors"
                        >
                          {isRtl ? "הקודם" : "Previous"}
                        </button>
                        <span className="text-sm text-muted-foreground">
                          {isRtl ? `עמוד ${page}` : `Page ${page}`}
                        </span>
                        <button
                          onClick={() => setPage((p) => p + 1)}
                          disabled={!hasMore}
                          className="px-4 py-2 rounded-lg border text-sm font-medium disabled:opacity-40 hover:bg-muted transition-colors"
                        >
                          {isRtl ? "הבא" : "Next"}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </TabsContent>
            ))}
          </Tabs>
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
        open={downloadOpen && !!(downloadTarget?.dxfUrl || downloadTarget?.svgPreview)}
        onClose={() => { setDownloadOpen(false); setTimeout(() => setDownloadTarget(null), 300); }}
        svgContent={downloadTarget?.svgPreview ?? ""}
        dxfUrl={downloadTarget?.dxfUrl ?? ""}
        svgUrl={downloadTarget?.svgUrl ?? undefined}
        defaultFilename={`${downloadTarget?.description ?? "design"}.dxf`}
        segmentCount={downloadTarget?.segmentCount ?? 0}
      />

      {/* Share to Community Dialog */}
      <Dialog open={!!shareTarget} onOpenChange={(open) => { if (!open) { setShareTarget(null); setShareSubmitted(false); } }}>
        <DialogContent dir={isRtl ? "rtl" : "ltr"} className="max-w-md p-0 overflow-hidden">
          {shareSubmitted ? (
            /* ── Success State ── */
            <div className="flex flex-col items-center justify-center py-12 px-8 text-center gap-4" style={{ background: 'linear-gradient(135deg, #042f2e 0%, #0f766e 60%, #0891b2 100%)' }}>
              <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center" style={{ animation: 'pulse 1.5s ease-in-out infinite' }}>
                <span style={{ fontSize: 40 }}>🎉</span>
              </div>
              <div className="space-y-1">
                <p className="text-2xl font-black text-white">{isRtl ? "נשלח בהצלחה!" : "Submitted!"}</p>
                <p className="text-sm text-teal-100">{isRtl ? "הקובץ יפורסם לאחר אישור מנהל" : "Your file will be published after admin review"}</p>
                {shareCreatorName && <p className="text-xs text-teal-200 mt-2">{isRtl ? `קרדיט: ${shareCreatorName}` : `Credit: ${shareCreatorName}`}</p>}
              </div>
              <Button
                onClick={() => { setShareTarget(null); setShareSubmitted(false); }}
                className="mt-2 bg-white text-teal-700 hover:bg-teal-50 font-bold px-8"
              >
                {isRtl ? "סגור" : "Close"}
              </Button>
            </div>
          ) : (
            <>
              {/* ── Gradient Header ── */}
              <div style={{ background: 'linear-gradient(135deg, #042f2e 0%, #0f766e 60%, #0891b2 100%)', padding: '20px 24px 16px' }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                    <Share2 className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-white font-black text-base leading-tight">{isRtl ? "שתף לקהילת FreeDXF" : "Share to FreeDXF Community"}</p>
                    <p className="text-teal-200 text-xs">{isRtl ? "100% חינם · ללא הגבלה" : "100% Free · No Limits"}</p>
                  </div>
                </div>
              </div>

              {/* ── SVG Preview ── */}
              {shareTarget?.svgPreview && (
                <div className="mx-4 mt-4 rounded-xl overflow-hidden border border-teal-100 bg-gradient-to-br from-teal-50 to-cyan-50" style={{ height: 160 }}>
                  <div
                    className="w-full h-full flex items-center justify-center p-2"
                    dangerouslySetInnerHTML={{
                      __html: shareTarget.svgPreview
                        .replace(/<svg /, '<svg style="width:100%;height:100%;display:block;" ')
                        .replace(/stroke="[^"]*"/g, 'stroke="#0f766e"')
                        .replace(/fill="none"/g, 'fill="#ccfbf1"')
                    }}
                  />
                </div>
              )}

              {/* ── Form ── */}
              <div className="px-4 pb-4 pt-3 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-slate-700">
                    {isRtl ? "✍️ למי לתת קרדיט?" : "✍️ Who gets the credit?"}
                  </label>
                  <Input
                    value={shareCreatorName}
                    onChange={(e) => setShareCreatorName(e.target.value)}
                    placeholder={isRtl ? "שם, כינוי, או השאר ריק לאנונימי" : "Name, nickname, or leave blank for anonymous"}
                    dir={isRtl ? "rtl" : "ltr"}
                    maxLength={100}
                    className="border-teal-200 focus:border-teal-400 text-base"
                    autoFocus
                  />
                  <p className="text-xs text-muted-foreground">{isRtl ? "השם יוצג על הקובץ בספריית FreeDXF" : "Your name will appear on the file in FreeDXF library"}</p>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setShareTarget(null)}>
                    {isRtl ? "ביטול" : "Cancel"}
                  </Button>
                  <Button
                    className="flex-1 font-bold gap-2"
                    style={{ background: 'linear-gradient(135deg, #0d9488, #0891b2)', color: 'white' }}
                    disabled={submitShareMutation.isPending || !shareTarget?.id}
                    onClick={() => {
                      if (!shareTarget?.id) return;
                      submitShareMutation.mutate({
                        userActionId: shareTarget.id,
                        creatorName: shareCreatorName.trim() || undefined,
                      });
                    }}
                  >
                    <Share2 className="w-4 h-4" />
                    {submitShareMutation.isPending
                      ? (isRtl ? "שולח..." : "Sending...")
                      : (isRtl ? "שתף עכשיו" : "Share Now")}
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

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

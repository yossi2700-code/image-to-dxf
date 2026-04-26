/**
 * TokenPricingModal — shows token costs for all features.
 * Data is fetched from the public tokenCosts API (admin-managed).
 * Can be opened from the header balance area.
 */
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { X, Coins, Zap, ImageIcon, Scan, User, Wand2, RefreshCw } from "lucide-react";

interface TokenPricingModalProps {
  open: boolean;
  onClose: () => void;
}

const ACTION_ICONS: Record<string, React.ReactNode> = {
  convert: <ImageIcon className="w-5 h-5" />,
  ai_generate: <Zap className="w-5 h-5" />,
  ai_trace: <Scan className="w-5 h-5" />,
  face_detect: <User className="w-5 h-5" />,
  ai_refine: <Wand2 className="w-5 h-5" />,
};

const ACTION_COLORS: Record<string, string> = {
  convert: "bg-emerald-50 text-emerald-700 border-emerald-200",
  ai_generate: "bg-violet-50 text-violet-700 border-violet-200",
  ai_trace: "bg-blue-50 text-blue-700 border-blue-200",
  face_detect: "bg-pink-50 text-pink-700 border-pink-200",
  ai_refine: "bg-amber-50 text-amber-700 border-amber-200",
};

export function TokenPricingModal({ open, onClose }: TokenPricingModalProps) {
  const { isRtl } = useLanguage();
  const { data: costs, isLoading } = trpc.tokenCosts.list.useQuery(undefined, {
    enabled: open,
    staleTime: 60_000,
  });

  if (!open) return null;

  const sorted = costs
    ? [...costs].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    : [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="bg-background rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        dir={isRtl ? "rtl" : "ltr"}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b bg-gradient-to-r from-violet-50 to-blue-50">
          <div className="flex items-center gap-2">
            <Coins className="w-5 h-5 text-violet-600" />
            <h2 className="font-bold text-lg text-foreground">
              {isRtl ? "מחירון קרדיטים" : "Credit Pricing"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted transition-colors"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5">
          {isLoading ? (
            <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span className="text-sm">{isRtl ? "טוען..." : "Loading..."}</span>
            </div>
          ) : sorted.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-6">
              {isRtl ? "אין נתוני מחירון" : "No pricing data available"}
            </p>
          ) : (
            <div className="space-y-3">
              {sorted.map((item) => {
                const label = isRtl
                  ? (item.labelHe || item.label || item.action)
                  : (item.labelEn || item.label || item.action);
                const description = isRtl
                  ? item.descriptionHe
                  : item.descriptionEn;
                const colorClass = ACTION_COLORS[item.action] ?? "bg-gray-50 text-gray-700 border-gray-200";
                const icon = ACTION_ICONS[item.action] ?? <Coins className="w-5 h-5" />;

                return (
                  <div
                    key={item.action}
                    className={`flex items-center gap-3 p-3 rounded-xl border ${colorClass}`}
                  >
                    {/* Icon */}
                    <div className="shrink-0 opacity-80">{icon}</div>

                    {/* Text */}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm leading-tight">{label}</p>
                      {description && (
                        <p className="text-xs opacity-70 mt-0.5 leading-snug">{description}</p>
                      )}
                    </div>

                    {/* Cost badge */}
                    <div className="shrink-0 flex items-center gap-1 font-bold text-sm">
                      {item.cost === 0 ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold border border-emerald-200">
                          {isRtl ? "חינם" : "Free"}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/70 border border-current/20 text-xs font-bold">
                          <Coins className="w-3 h-3" />
                          {item.cost}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Footer note */}
          <p className="text-xs text-muted-foreground text-center mt-4 leading-relaxed">
            {isRtl
              ? "המחירים עשויים להשתנות. ניתן לרכוש קרדיטים נוספים בכל עת."
              : "Prices may change. You can purchase more tokens at any time."}
          </p>
        </div>
      </div>
    </div>
  );
}

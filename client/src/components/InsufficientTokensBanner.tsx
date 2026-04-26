/**
 * NoCreditsModal
 * Shown when the user has run out of credits during any conversion attempt.
 * Clean, beautiful, unified modal — no email mentions, no cross-feature suggestions.
 */
import { ShoppingCart, X, Zap } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface InsufficientTokensBannerProps {
  onDismiss?: () => void;
  hasPendingWelcomeBonus?: boolean;
}

export function InsufficientTokensBanner({ onDismiss }: InsufficientTokensBannerProps) {
  const { isRtl } = useLanguage();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onDismiss?.(); }}
      dir={isRtl ? "rtl" : "ltr"}
    >
      <div
        className="relative w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl"
        style={{ background: "#fff" }}
      >
        <button
          onClick={onDismiss}
          className="absolute top-3 right-3 z-10 p-1.5 rounded-full transition-colors hover:bg-white/20"
          style={{ color: "white", background: "none", border: "none", cursor: "pointer" }}
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <div
          className="px-6 pt-10 pb-8 flex flex-col items-center text-center"
          style={{ background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a78bfa 100%)" }}
        >
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center mb-5"
            style={{ background: "rgba(255,255,255,0.18)", boxShadow: "0 0 0 8px rgba(255,255,255,0.08)" }}
          >
            <Zap className="w-10 h-10 text-white" fill="white" />
          </div>
          <h2 className="text-2xl font-black text-white mb-2 leading-tight">
            {isRtl ? "נגמרו הקרדיטים" : "Out of Credits"}
          </h2>
          <p className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.8)" }}>
            {isRtl ? "כדי להמשיך צריך לטעון קרדיטים" : "Top up credits to continue"}
          </p>
        </div>

        <div className="px-6 py-6 flex flex-col gap-3">
          <a href="/buy" className="block w-full" style={{ textDecoration: "none" }}>
            <button
              className="w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl text-base font-black transition-all hover:opacity-90 active:scale-95"
              style={{
                background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                color: "white",
                boxShadow: "0 6px 20px rgba(99,102,241,0.45)",
                border: "none",
                cursor: "pointer",
              }}
            >
              <ShoppingCart className="w-5 h-5" />
              <span>{isRtl ? "טעינת קרדיטים עכשיו" : "Buy Credits Now"}</span>
            </button>
          </a>
          <button
            onClick={onDismiss}
            className="w-full text-center text-sm py-1.5 transition-colors"
            style={{ color: "#9ca3af", background: "none", border: "none", cursor: "pointer" }}
          >
            {isRtl ? "אולי מאוחר יותר" : "Maybe later"}
          </button>
        </div>
      </div>
    </div>
  );
}

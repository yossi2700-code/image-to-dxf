/**
 * InsufficientTokensModal
 * Shown when the user has run out of tokens during a conversion attempt.
 * Displays a beautiful centered modal with a prominent link to the /buy page.
 */
import { ShoppingCart, X, Zap, Sparkles } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface InsufficientTokensBannerProps {
  /** Called when the user dismisses the modal */
  onDismiss?: () => void;
  /** Whether the user has a pending welcome bonus in their email (not yet claimed) */
  hasPendingWelcomeBonus?: boolean;
}

export function InsufficientTokensBanner({ onDismiss, hasPendingWelcomeBonus }: InsufficientTokensBannerProps) {
  const { isRtl } = useLanguage();

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onDismiss?.(); }}
      dir={isRtl ? "rtl" : "ltr"}
    >
      {/* Modal card */}
      <div
        className="relative w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: "#fff" }}
      >
        {/* Top gradient banner */}
        <div
          className="px-6 pt-8 pb-6 flex flex-col items-center text-center"
          style={{
            background: "linear-gradient(135deg, #7c3aed 0%, #a855f7 50%, #c084fc 100%)",
          }}
        >
          {/* Icon circle */}
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
            style={{ background: "rgba(255,255,255,0.2)" }}
          >
            <Zap className="w-8 h-8 text-white" fill="white" />
          </div>
          <h2 className="text-xl font-bold text-white mb-1">
            {isRtl ? "נגמרו האסימונים" : "Out of Tokens"}
          </h2>
          <p className="text-sm text-purple-100">
            {isRtl
              ? "יש לטעון אסימונים להמשך שימוש"
              : "Add tokens to continue using the service"}
          </p>
        </div>

        {/* Body */}
        <div className="px-6 py-5 flex flex-col gap-3">
          {/* Pending welcome bonus reminder */}
          {hasPendingWelcomeBonus && (
            <div
              className="rounded-xl px-4 py-3 flex items-start gap-3"
              style={{ background: "#fef9c3", border: "1px solid #fde047" }}
            >
              <Sparkles className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "#ca8a04" }} />
              <p className="text-xs leading-snug" style={{ color: "#854d0e" }}>
                {isRtl
                  ? "מחכים לך 20 בונוס אסימונים במייל — אם לא קיבלת, בדוק בספאם"
                  : "20 bonus tokens waiting in your email — if not received, check spam"}
              </p>
            </div>
          )}

          {/* Buy button */}
          <a
            href="/buy"
            className="block w-full"
            style={{ textDecoration: "none" }}
          >
            <button
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-base font-bold transition-all hover:opacity-90 active:scale-95"
              style={{
                background: "linear-gradient(135deg, #7c3aed, #a855f7)",
                color: "white",
                boxShadow: "0 4px 16px rgba(124,58,237,0.4)",
                border: "none",
                cursor: "pointer",
              }}
            >
              <ShoppingCart className="w-5 h-5" />
              <span>{isRtl ? "רכוש אסימונים עכשיו" : "Buy Tokens Now"}</span>
            </button>
          </a>

          {/* Dismiss link */}
          <button
            onClick={onDismiss}
            className="w-full text-center text-sm py-1 transition-colors"
            style={{ color: "#9ca3af", background: "none", border: "none", cursor: "pointer" }}
          >
            {isRtl ? "אולי מאוחר יותר" : "Maybe later"}
          </button>
        </div>

        {/* Close X button */}
        <button
          onClick={onDismiss}
          className="absolute top-3 right-3 p-1.5 rounded-full transition-colors hover:bg-white/20"
          style={{ color: "white", background: "none", border: "none", cursor: "pointer" }}
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

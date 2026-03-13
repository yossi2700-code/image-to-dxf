/**
 * InsufficientTokensBanner
 * Shown when the user has run out of tokens during a conversion attempt.
 * Displays a prominent banner with a link to the /buy page.
 * Optionally shows a reminder about pending welcome bonus tokens in email.
 */
import { useState } from "react";
import { ShoppingCart, X, Coins } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface InsufficientTokensBannerProps {
  /** Called when the user dismisses the banner */
  onDismiss?: () => void;
  /** Whether the user has a pending welcome bonus in their email (not yet claimed) */
  hasPendingWelcomeBonus?: boolean;
}

export function InsufficientTokensBanner({ onDismiss, hasPendingWelcomeBonus }: InsufficientTokensBannerProps) {
  const { t, isRtl } = useLanguage();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  return (
    <div
      className="mb-4 rounded-xl overflow-hidden"
      style={{
        background: "linear-gradient(135deg, #fff7ed 0%, #fef3c7 100%)",
        border: "1.5px solid #f59e0b",
        boxShadow: "0 2px 12px rgba(245,158,11,0.18)",
      }}
      dir={isRtl ? "rtl" : "ltr"}
    >
      <div className="px-4 py-3 flex items-center gap-3">
        {/* Icon */}
        <div
          className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center"
          style={{ background: "rgba(245,158,11,0.15)" }}
        >
          <Coins className="w-5 h-5" style={{ color: "#d97706" }} />
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm" style={{ color: "#92400e" }}>
            {t("insufficientTokensTitle")}
          </p>
          <p className="text-xs mt-0.5 leading-snug" style={{ color: "#b45309" }}>
            {t("insufficientTokensMsg")}
          </p>
          {/* Pending welcome bonus reminder */}
          {hasPendingWelcomeBonus && (
            <p className="text-xs mt-1 font-semibold flex items-center gap-1" style={{ color: "#78350f" }}>
              <span>📧</span>
              <span>
                {isRtl
                  ? 'מחכים לך 20 בונוס אסימונים במייל — בדוק ספאם!'
                  : '20 bonus tokens waiting in your email — check spam!'}
              </span>
            </p>
          )}
        </div>

        {/* Buy button */}
        <a
          href="/buy"
          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold transition-all hover:opacity-90 active:scale-95"
          style={{
            background: "linear-gradient(135deg, #f59e0b, #d97706)",
            color: "white",
            textDecoration: "none",
            boxShadow: "0 2px 8px rgba(245,158,11,0.35)",
            whiteSpace: "nowrap",
          }}
        >
          <ShoppingCart className="w-3.5 h-3.5" />
          <span>{t("insufficientTokensBuy")}</span>
        </a>

        {/* Dismiss button */}
        <button
          onClick={handleDismiss}
          className="shrink-0 p-1 rounded-full transition-colors hover:bg-amber-100"
          style={{ color: "#b45309" }}
          aria-label={t("insufficientTokensDismiss")}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

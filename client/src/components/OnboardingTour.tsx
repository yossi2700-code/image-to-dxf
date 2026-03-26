/**
 * OnboardingTour — Side panel guided tour for new users.
 *
 * Steps:
 *  1. Welcome (no target)
 *  2. AI Create card
 *  3. AI Outline card
 *  4. Portrait card
 *  5. Download button
 *
 * Storage: localStorage key "onboarding_tour_done_v2" = "1" when dismissed.
 * Shows to all users who haven't completed it yet (per browser).
 * forceShow=true resets and re-shows the tour.
 */
import { useState, useEffect, useCallback } from "react";
import { X, ChevronRight, ChevronLeft, Sparkles, ArrowDown } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import type { TranslationKey } from "@/lib/translations";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TourStep {
  targetId?: string;
  titleKey: string;
  descKey: string;
  /** If true, the user menu dropdown should be opened to reveal this element */
  openUserMenu?: boolean;
}

const TOUR_STEPS: TourStep[] = [
  {
    titleKey: "tour1Title",
    descKey: "tour1Desc",
  },
  {
    targetId: "tour-ai-create",
    titleKey: "tour2Title",
    descKey: "tour2Desc",
  },
  {
    targetId: "tour-ai-outline",
    titleKey: "tour3Title",
    descKey: "tour3Desc",
  },
  {
    targetId: "tour-portrait",
    titleKey: "tour4Title",
    descKey: "tour4Desc",
  },
  {
    targetId: "tour-download",
    titleKey: "tour5Title",
    descKey: "tour5Desc",
  },
  {
    targetId: "tour-user-menu",
    titleKey: "tour6Title",
    descKey: "tour6Desc",
    openUserMenu: true,
  },
  {
    targetId: "tour-history",
    titleKey: "tour7Title",
    descKey: "tour7Desc",
    openUserMenu: true,
  },
  {
    targetId: "tour-tokens",
    titleKey: "tour8Title",
    descKey: "tour8Desc",
  },
  {
    targetId: "tour-pricing",
    titleKey: "tour9Title",
    descKey: "tour9Desc",
  },
];

const STORAGE_KEY = "onboarding_tour_done_v2";

// ─── Pulse ring injected via CSS ──────────────────────────────────────────────

const PULSE_CLASS = "tour-pulse-highlight";

function addPulse(id: string) {
  removePulse();
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add(PULSE_CLASS);
  // Scroll into view
  const rect = el.getBoundingClientRect();
  const inView = rect.top >= 80 && rect.bottom <= window.innerHeight - 80;
  if (!inView) {
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

function removePulse() {
  document.querySelectorAll(`.${PULSE_CLASS}`).forEach((el) => {
    el.classList.remove(PULSE_CLASS);
  });
}

// ─── Main Component ───────────────────────────────────────────────────────────

export interface OnboardingTourProps {
  /** Force show the tour, even if it was already completed */
  forceShow?: boolean;
  /** Number of conversions the user has done (server-side). Tour hides after 2. */
  actionCount?: number;
}

export function OnboardingTour({ forceShow, actionCount = 0 }: OnboardingTourProps) {
  const { t, isRtl } = useLanguage();
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);

  const currentStep = TOUR_STEPS[step];
  const totalSteps = TOUR_STEPS.length;

  // ── Init ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (forceShow) {
      // Reset and force show
      localStorage.removeItem(STORAGE_KEY);
      setStep(0);
      setActive(true);
      setTimeout(() => setVisible(true), 50);
      return;
    }
    const done = localStorage.getItem(STORAGE_KEY);
    // Hide permanently once user has 2+ conversions (server-side)
    if (actionCount >= 2) {
      localStorage.setItem(STORAGE_KEY, "1");
      setActive(false);
      return;
    }
    if (!done) {
      const timer = setTimeout(() => {
        setActive(true);
        setTimeout(() => setVisible(true), 50);
      }, 900);
      return () => clearTimeout(timer);
    }
  }, [forceShow, actionCount]);

  // Listen for tour reset event from other components
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === 'tour_force_show' && e.newValue === '1') {
        localStorage.removeItem('tour_force_show');
        localStorage.removeItem(STORAGE_KEY);
        setStep(0);
        setActive(true);
        setTimeout(() => setVisible(true), 50);
      }
    };
    // Also listen for custom event (same-tab)
    const customHandler = () => {
      localStorage.removeItem(STORAGE_KEY);
      setStep(0);
      setActive(true);
      setVisible(false);
      setTimeout(() => setVisible(true), 50);
    };
    window.addEventListener('storage', handler);
    window.addEventListener('tour:reset', customHandler);
    return () => {
      window.removeEventListener('storage', handler);
      window.removeEventListener('tour:reset', customHandler);
    };
  }, []);

  // ── Pulse on step change ──────────────────────────────────────────────────

  useEffect(() => {
    if (!active) return;
    if (currentStep.targetId) {
      // If step requires user menu to be open, dispatch event to open it
      if (currentStep.openUserMenu) {
        window.dispatchEvent(new CustomEvent('tour:open-user-menu'));
      }
      // Small delay to allow scroll and menu open to complete
      const t = setTimeout(() => addPulse(currentStep.targetId!), 500);
      return () => { clearTimeout(t); removePulse(); };
    } else {
      // Close user menu when not needed
      window.dispatchEvent(new CustomEvent('tour:close-user-menu'));
      removePulse();
    }
  }, [active, step, currentStep.targetId, currentStep.openUserMenu]);

  // Cleanup on unmount
  useEffect(() => () => removePulse(), []);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const dismiss = useCallback(() => {
    setVisible(false);
    removePulse();
    window.dispatchEvent(new CustomEvent('tour:close-user-menu'));
    setTimeout(() => {
      setActive(false);
      localStorage.setItem(STORAGE_KEY, "1");
    }, 300);
  }, []);

  const goNext = useCallback(() => {
    if (step < totalSteps - 1) {
      setStep((s) => s + 1);
    } else {
      dismiss();
    }
  }, [step, totalSteps, dismiss]);

  const goPrev = useCallback(() => {
    if (step > 0) setStep((s) => s - 1);
  }, [step]);

  // Keyboard navigation
  useEffect(() => {
    if (!active) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
      if (e.key === "ArrowRight" || e.key === "Enter") goNext();
      if (e.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [active, dismiss, goNext, goPrev]);

  if (!active) return null;

  const isLast = step === totalSteps - 1;
  const isFirst = step === 0;
  const stepLabel = t("tourStep")
    .replace("{step}", String(step + 1))
    .replace("{total}", String(totalSteps));

  // Step icons
  const stepIcons = ["👋", "✨", "🖼️", "🎨", "⬇️", "👤", "📋", "✨", "💎"];

  return (
    <>
      {/* Inject pulse CSS */}
      <style>{`
        .${PULSE_CLASS} {
          position: relative;
          z-index: 10;
          animation: tour-pulse-scale 1.2s ease-in-out infinite;
          outline: 5px solid #00ff88 !important;
          outline-offset: 6px;
          border-radius: 12px;
          box-shadow: 0 0 0 0 rgba(0,255,136,0.9), 0 0 28px rgba(0,255,136,0.7);
        }
        @keyframes tour-pulse-scale {
          0%   { outline-color: #00ff88; box-shadow: 0 0 0 0 rgba(0,255,136,0.9), 0 0 28px rgba(0,255,136,0.7); }
          50%  { outline-color: #00e5ff; box-shadow: 0 0 0 16px rgba(0,255,136,0), 0 0 48px rgba(0,229,255,0.8); }
          100% { outline-color: #00ff88; box-shadow: 0 0 0 0 rgba(0,255,136,0), 0 0 28px rgba(0,255,136,0.7); }
        }
      `}</style>

      {/* Side panel — fixed bottom-right (or bottom-left for RTL) */}
      <div
        className="fixed bottom-6 z-[9999] transition-all duration-400"
        style={{
          [isRtl ? "left" : "right"]: "16px",
          width: "min(320px, calc(100vw - 32px))",
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0)" : "translateY(20px)",
          pointerEvents: "auto",
        }}
        dir={isRtl ? "rtl" : "ltr"}
      >
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: "#ffffff",
            border: "1px solid rgba(139,92,246,0.25)",
            boxShadow: "0 8px 40px rgba(0,0,0,0.14), 0 0 0 1px rgba(139,92,246,0.08)",
          }}
        >
          {/* Colored top bar */}
          <div
            className="h-1.5 w-full"
            style={{ background: "linear-gradient(90deg, #7c3aed, #a855f7, #ec4899)" }}
          />

          {/* Header */}
          <div className="flex items-center justify-between px-4 pt-3 pb-1">
            <div className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-sm"
                style={{ background: "linear-gradient(135deg, #7c3aed22, #a855f722)" }}
              >
                {stepIcons[step]}
              </div>
              <span className="text-xs font-semibold" style={{ color: '#059669' }}>{stepLabel}</span>
            </div>
            <button
              onClick={dismiss}
              className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-100"
              aria-label={t("tourSkip")}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Progress bar */}
          <div className="mx-4 mb-3 h-1 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${((step + 1) / totalSteps) * 100}%`,
                background: "linear-gradient(90deg, #059669, #00cc6a)",
              }}
            />
          </div>

          {/* Content */}
          <div className="px-4 pb-4">
            <h3 className="text-gray-900 font-bold text-sm mb-1 leading-tight">
              {t(currentStep.titleKey as TranslationKey)}
            </h3>
            <p className="text-gray-500 text-xs leading-relaxed mb-4">
              {t(currentStep.descKey as TranslationKey)}
            </p>

            {/* Arrow hint when element is targeted */}
            {currentStep.targetId && (
              <div className="flex items-center gap-1.5 text-xs mb-3" style={{ color: '#059669' }}>
                <ArrowDown className="w-3 h-3 animate-bounce" />
                <span>{isRtl ? "מהבהב בדף" : "Highlighted on page"}</span>
              </div>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between gap-2">
              {/* Skip */}
              <button
                onClick={dismiss}
                className="text-xs text-gray-400 hover:text-gray-600 transition-colors underline underline-offset-2"
              >
                {t("tourSkip")}
              </button>

              <div className="flex items-center gap-2">
                {/* Prev */}
                {!isFirst && (
                  <button
                    onClick={goPrev}
                    className="h-8 w-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
                  >
                    {isRtl ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                  </button>
                )}

                {/* Next / Done */}
                <button
                  onClick={goNext}
                  className="h-8 px-4 rounded-lg font-bold text-white text-xs flex items-center gap-1 transition-all hover:opacity-90"
                  style={{
                    background: "linear-gradient(135deg, #059669, #00cc6a)",
                    boxShadow: "0 4px 14px rgba(0,204,106,0.45)",
                    color: "#fff",
                  }}
                >
                  {isLast ? (
                    <>
                      <Sparkles className="w-3 h-3" />
                      {t("tourDone")}
                    </>
                  ) : (
                    <>
                      {t("tourNext")}
                      {isRtl ? <ChevronLeft className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/** Reset the tour so it shows again on next page load */
export function resetOnboardingTour() {
  localStorage.removeItem(STORAGE_KEY);
}

/** Check if the tour has been completed */
export function isTourDone(): boolean {
  return localStorage.getItem(STORAGE_KEY) === "1";
}

// Default export for lazy loading
export default OnboardingTour;

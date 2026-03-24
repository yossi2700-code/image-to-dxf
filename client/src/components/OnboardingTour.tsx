/**
 * OnboardingTour — Spotlight-based guided tour for new users.
 *
 * Steps:
 *  1. Welcome overlay (full screen)
 *  2. AI Create card
 *  3. AI Outline card
 *  4. Portrait card
 *  5. Download button (shown after first result)
 *
 * Storage: localStorage key "onboarding_tour_done" = "1" when dismissed.
 * Currently shows to ALL users (for testing). Later: only new users.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { X, ChevronRight, ChevronLeft, Sparkles } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import type { TranslationKey } from "@/lib/translations";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TourStep {
  targetId?: string;       // DOM element id to spotlight (optional — if missing, full-screen)
  titleKey: string;
  descKey: string;
  placement?: "top" | "bottom" | "left" | "right" | "center";
}

const TOUR_STEPS: TourStep[] = [
  {
    titleKey: "tour1Title",
    descKey: "tour1Desc",
    placement: "center",
  },
  {
    targetId: "tour-ai-create",
    titleKey: "tour2Title",
    descKey: "tour2Desc",
    placement: "bottom",
  },
  {
    targetId: "tour-ai-outline",
    titleKey: "tour3Title",
    descKey: "tour3Desc",
    placement: "bottom",
  },
  {
    targetId: "tour-portrait",
    titleKey: "tour4Title",
    descKey: "tour4Desc",
    placement: "bottom",
  },
  {
    targetId: "tour-download",
    titleKey: "tour5Title",
    descKey: "tour5Desc",
    placement: "top",
  },
];

const STORAGE_KEY = "onboarding_tour_done";

// ─── Spotlight rect ───────────────────────────────────────────────────────────

interface SpotRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function getElementRect(id: string): SpotRect | null {
  const el = document.getElementById(id);
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  return {
    top: rect.top + window.scrollY,
    left: rect.left + window.scrollX,
    width: rect.width,
    height: rect.height,
  };
}

// ─── Tooltip position ─────────────────────────────────────────────────────────

interface TooltipPos {
  top?: number | string;
  left?: number | string;
  right?: number | string;
  bottom?: number | string;
  transform?: string;
}

function calcTooltipPos(
  rect: SpotRect | null,
  placement: TourStep["placement"],
  tooltipW = 300,
  tooltipH = 160
): TooltipPos {
  if (!rect || placement === "center") {
    return {
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
    };
  }

  const PAD = 16;
  const vw = window.innerWidth;
  const scrollY = window.scrollY;

  if (placement === "bottom") {
    let left = rect.left + rect.width / 2 - tooltipW / 2;
    left = Math.max(PAD, Math.min(left, vw - tooltipW - PAD));
    return {
      top: rect.top + rect.height + PAD,
      left,
    };
  }
  if (placement === "top") {
    let left = rect.left + rect.width / 2 - tooltipW / 2;
    left = Math.max(PAD, Math.min(left, vw - tooltipW - PAD));
    return {
      top: rect.top - tooltipH - PAD,
      left,
    };
  }
  // fallback center
  return {
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
  };
}

// ─── SVG Overlay ──────────────────────────────────────────────────────────────

function SvgOverlay({ rect, step }: { rect: SpotRect | null; step: number }) {
  const PAD = 12;
  const R = 14; // corner radius

  if (!rect || step === 0) {
    // Full dark overlay for welcome step
    return (
      <div
        className="fixed inset-0 z-[9998]"
        style={{ background: "rgba(10,10,30,0.45)", backdropFilter: "blur(1px)" }}
      />
    );
  }

  const x = rect.left - PAD;
  const y = rect.top - PAD;
  const w = rect.width + PAD * 2;
  const h = rect.height + PAD * 2;

  // Full page dimensions
  const pw = document.documentElement.scrollWidth;
  const ph = document.documentElement.scrollHeight;

  const clipPath = `
    M 0 0
    L ${pw} 0
    L ${pw} ${ph}
    L 0 ${ph}
    Z
    M ${x + R} ${y}
    L ${x + w - R} ${y}
    Q ${x + w} ${y} ${x + w} ${y + R}
    L ${x + w} ${y + h - R}
    Q ${x + w} ${y + h} ${x + w - R} ${y + h}
    L ${x + R} ${y + h}
    Q ${x} ${y + h} ${x} ${y + h - R}
    L ${x} ${y + R}
    Q ${x} ${y} ${x + R} ${y}
    Z
  `;

  return (
    <svg
      className="fixed inset-0 z-[9998] pointer-events-none"
      style={{ width: "100vw", height: "100vh", overflow: "visible" }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <filter id="tour-glow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>
      {/* Dark overlay with cutout */}
      <path
        d={clipPath}
        fill="rgba(10,10,30,0.45)"
        fillRule="evenodd"
        style={{ backdropFilter: "blur(2px)" }}
      />
      {/* Glow border around spotlight */}
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={R}
        fill="none"
        stroke="rgba(139,92,246,0.9)"
        strokeWidth="2.5"
        filter="url(#tour-glow)"
      />
      {/* Animated pulse ring */}
      <rect
        x={x - 4}
        y={y - 4}
        width={w + 8}
        height={h + 8}
        rx={R + 4}
        fill="none"
        stroke="rgba(139,92,246,0.4)"
        strokeWidth="2"
      >
        <animate attributeName="opacity" values="0.6;0;0.6" dur="2s" repeatCount="indefinite" />
        <animate attributeName="stroke-width" values="2;6;2" dur="2s" repeatCount="indefinite" />
      </rect>
    </svg>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export interface OnboardingTourProps {
  /** Force show (for testing). Default: auto from localStorage. */
  forceShow?: boolean;
}

export function OnboardingTour({ forceShow }: OnboardingTourProps) {
  const { t, isRtl } = useLanguage();
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);
  const [spotRect, setSpotRect] = useState<SpotRect | null>(null);
  const [tooltipPos, setTooltipPos] = useState<TooltipPos>({ top: "50%", left: "50%", transform: "translate(-50%,-50%)" });
  const [visible, setVisible] = useState(false);
  const rafRef = useRef<number>(0);

  const currentStep = TOUR_STEPS[step];
  const totalSteps = TOUR_STEPS.length;

  // ── Init ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    const done = localStorage.getItem(STORAGE_KEY);
    if (forceShow || !done) {
      // Small delay so page renders first
      const t = setTimeout(() => {
        setActive(true);
        setTimeout(() => setVisible(true), 50);
      }, 800);
      return () => clearTimeout(t);
    }
  }, [forceShow]);

  // ── Update spotlight position ─────────────────────────────────────────────

  const updatePos = useCallback(() => {
    if (!active) return;
    const step_data = TOUR_STEPS[step];
    if (!step_data.targetId) {
      setSpotRect(null);
      setTooltipPos({ top: "50%", left: "50%", transform: "translate(-50%,-50%)" });
      return;
    }
    const rect = getElementRect(step_data.targetId);
    if (rect) {
      // Scroll element into view if needed
      const el = document.getElementById(step_data.targetId);
      if (el) {
        const elRect = el.getBoundingClientRect();
        const inView = elRect.top >= 0 && elRect.bottom <= window.innerHeight;
        if (!inView) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          // Re-measure after scroll
          setTimeout(() => {
            const r2 = getElementRect(step_data.targetId!);
            if (r2) {
              setSpotRect(r2);
              setTooltipPos(calcTooltipPos(r2, step_data.placement));
            }
          }, 400);
          return;
        }
      }
      setSpotRect(rect);
      setTooltipPos(calcTooltipPos(rect, step_data.placement));
    } else {
      // Element not found — show centered
      setSpotRect(null);
      setTooltipPos({ top: "50%", left: "50%", transform: "translate(-50%,-50%)" });
    }
  }, [active, step]);

  useEffect(() => {
    updatePos();
    const handleResize = () => updatePos();
    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", updatePos, { passive: true });
    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", updatePos);
      cancelAnimationFrame(rafRef.current);
    };
  }, [updatePos]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const dismiss = useCallback(() => {
    setVisible(false);
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

  // Tooltip width
  const TOOLTIP_W = 300;

  return (
    <>
      {/* Overlay */}
      <div
        className="transition-opacity duration-300"
        style={{ opacity: visible ? 1 : 0 }}
      >
        <SvgOverlay rect={spotRect} step={step} />
      </div>

      {/* Tooltip card */}
      <div
        className="fixed z-[9999] transition-all duration-300"
        style={{
          ...tooltipPos,
          width: TOOLTIP_W,
          opacity: visible ? 1 : 0,
          transform: tooltipPos.transform ?? (visible ? "translateY(0)" : "translateY(8px)"),
          pointerEvents: "auto",
        }}
        dir={isRtl ? "rtl" : "ltr"}
      >
        <div
          className="rounded-2xl shadow-2xl overflow-hidden"
          style={{
            background: "linear-gradient(135deg, rgba(30,27,75,0.72) 0%, rgba(49,46,129,0.72) 50%, rgba(76,29,149,0.72) 100%)",
            border: "1px solid rgba(139,92,246,0.5)",
            boxShadow: "0 20px 60px rgba(0,0,0,0.3), 0 0 30px rgba(139,92,246,0.15)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-300" />
              <span className="text-xs text-purple-300 font-semibold">{stepLabel}</span>
            </div>
            <button
              onClick={dismiss}
              className="text-purple-300 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10"
              aria-label={t("tourSkip")}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Progress bar */}
          <div className="mx-4 mb-3 h-1 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${((step + 1) / totalSteps) * 100}%`,
                background: "linear-gradient(90deg, #8b5cf6, #a855f7)",
              }}
            />
          </div>

          {/* Content */}
          <div className="px-4 pb-4">
            <h3 className="text-white font-bold text-base mb-1.5 leading-tight">
              {t(currentStep.titleKey as TranslationKey)}
            </h3>
            <p className="text-purple-200 text-sm leading-relaxed mb-4">
              {t(currentStep.descKey as TranslationKey)}
            </p>

            {/* Navigation */}
            <div className="flex items-center justify-between gap-2">
              {/* Skip */}
              <button
                onClick={dismiss}
                className="text-xs text-purple-400 hover:text-purple-200 transition-colors underline underline-offset-2"
              >
                {t("tourSkip")}
              </button>

              <div className="flex items-center gap-2">
                {/* Prev */}
                {!isFirst && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={goPrev}
                    className="h-8 px-2 text-purple-300 hover:text-white hover:bg-white/10"
                  >
                    {isRtl ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                  </Button>
                )}

                {/* Next / Done */}
                <Button
                  size="sm"
                  onClick={goNext}
                  className="h-8 px-4 font-bold text-white"
                  style={{
                    background: "linear-gradient(135deg, #7c3aed, #a855f7)",
                    border: "none",
                    boxShadow: "0 4px 12px rgba(124,58,237,0.4)",
                  }}
                >
                  {isLast ? t("tourDone") : t("tourNext")}
                  {!isLast && (
                    isRtl
                      ? <ChevronLeft className="w-4 h-4 mr-1" />
                      : <ChevronRight className="w-4 h-4 ml-1" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Arrow pointer (only when spotlighting an element) */}
        {spotRect && currentStep.placement === "bottom" && (
          <div
            className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 rotate-45"
            style={{
              background: "linear-gradient(135deg, #1e1b4b, #312e81)",
              border: "1px solid rgba(139,92,246,0.5)",
              borderRight: "none",
              borderBottom: "none",
            }}
          />
        )}
        {spotRect && currentStep.placement === "top" && (
          <div
            className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 rotate-45"
            style={{
              background: "linear-gradient(135deg, #312e81, #4c1d95)",
              border: "1px solid rgba(139,92,246,0.5)",
              borderLeft: "none",
              borderTop: "none",
            }}
          />
        )}
      </div>
    </>
  );
}

/** Hook to reset the tour (for testing) */
export function resetOnboardingTour() {
  localStorage.removeItem(STORAGE_KEY);
}

// Default export for lazy loading
export default OnboardingTour;

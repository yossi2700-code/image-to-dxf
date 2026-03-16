/**
 * AiProcessingAnimation — beautiful animated processing screen for all AI features.
 * Shows animated SVG drawing effect, step messages, elapsed timer, and cancel button.
 *
 * Props:
 *   elapsedSeconds  — seconds since job started
 *   currentStep     — current step message from server
 *   imagePreview    — optional image preview to show while processing
 *   jobId           — job ID (for cancel button)
 *   onCancel        — called when cancel button is clicked
 *   isRtl           — language direction
 *   accentColor     — theme color (default: teal for AI Trace, amber for AI Redraw)
 *   featureLabel    — short label shown in header (e.g. "AI Trace", "AI Redraw")
 */
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

interface AiProcessingAnimationProps {
  elapsedSeconds: number;
  currentStep?: string;
  imagePreview?: string | null;
  jobId?: string | null;
  onCancel?: () => void;
  isRtl?: boolean;
  accentColor?: string;  // CSS color string
  accentGradient?: string; // CSS gradient string
  featureLabel?: string;
}

// ─── Animated SVG path drawing ───────────────────────────────────────────────
// A stylized vector outline that "draws itself" in a loop
const DEMO_PATHS = [
  "M 20 80 C 40 20, 80 20, 100 80 S 160 140, 180 80",
  "M 30 60 L 60 30 L 90 60 L 120 30 L 150 60 L 180 30",
  "M 20 100 Q 60 20 100 100 Q 140 180 180 100",
  "M 100 20 L 140 80 L 80 80 Z M 100 80 L 140 140 L 60 140 Z",
];

function AnimatedSvgPath({ color, elapsed }: { color: string; elapsed: number }) {
  const pathRef = useRef<SVGPathElement>(null);
  const [pathIndex, setPathIndex] = useState(0);
  const [pathLength, setPathLength] = useState(0);

  // Rotate through paths every 4 seconds
  useEffect(() => {
    const idx = Math.floor(elapsed / 4) % DEMO_PATHS.length;
    setPathIndex(idx);
  }, [elapsed]);

  useEffect(() => {
    if (pathRef.current) {
      setPathLength(pathRef.current.getTotalLength());
    }
  }, [pathIndex]);

  const progress = ((elapsed % 4) / 4); // 0..1 within each 4s cycle
  const drawn = pathLength * Math.min(progress * 1.2, 1);

  return (
    <svg viewBox="0 0 200 160" className="w-full h-full" style={{ overflow: "visible" }}>
      {/* Grid background */}
      <defs>
        <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(0,0,0,0.04)" strokeWidth="0.5"/>
        </pattern>
        <filter id="glow">
          <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
          <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <rect width="200" height="160" fill="url(#grid)" rx="8"/>

      {/* Ghost path (full, faint) */}
      <path
        d={DEMO_PATHS[pathIndex]}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeOpacity="0.12"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Animated drawing path */}
      <path
        ref={pathRef}
        d={DEMO_PATHS[pathIndex]}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter="url(#glow)"
        style={{
          strokeDasharray: pathLength,
          strokeDashoffset: pathLength - drawn,
          transition: "stroke-dashoffset 0.3s linear",
        }}
      />

      {/* Moving dot at the drawing tip */}
      {pathLength > 0 && progress < 1 && (
        <circle r="4" fill={color} filter="url(#glow)" style={{ opacity: 0.9 }}>
          <animateMotion
            dur="4s"
            repeatCount="indefinite"
            path={DEMO_PATHS[pathIndex]}
          />
        </circle>
      )}
    </svg>
  );
}

// ─── Floating particles ───────────────────────────────────────────────────────
function Particles({ color }: { color: string }) {
  const particles = Array.from({ length: 12 }, (_, i) => ({
    id: i,
    x: 10 + Math.random() * 80,
    y: 10 + Math.random() * 80,
    size: 2 + Math.random() * 3,
    delay: Math.random() * 3,
    dur: 2 + Math.random() * 2,
  }));

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-full"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            background: color,
            opacity: 0,
            animation: `particleFade ${p.dur}s ease-in-out infinite`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

// ─── Step messages ────────────────────────────────────────────────────────────
const STEPS_HE = [
  { until: 8,  icon: "🧠", text: "AI מנתח את התמונה..." },
  { until: 20, icon: "🔍", text: "מזהה קווים ואובייקטים..." },
  { until: 40, icon: "✏️", text: "מצייר קווים וקטוריים..." },
  { until: 70, icon: "⚡", text: "ממטב נתיבים..." },
  { until: 100, icon: "✨", text: "משפר פרטים דקים..." },
  { until: Infinity, icon: "💫", text: "כמעט מוכן..." },
];
const STEPS_EN = [
  { until: 8,  icon: "🧠", text: "AI analyzing image..." },
  { until: 20, icon: "🔍", text: "Detecting lines & shapes..." },
  { until: 40, icon: "✏️", text: "Drawing vector paths..." },
  { until: 70, icon: "⚡", text: "Optimizing paths..." },
  { until: 100, icon: "✨", text: "Refining fine details..." },
  { until: Infinity, icon: "💫", text: "Almost ready..." },
];

// ─── Main component ───────────────────────────────────────────────────────────
export function AiProcessingAnimation({
  elapsedSeconds,
  currentStep,
  imagePreview,
  jobId,
  onCancel,
  isRtl = false,
  accentColor = "#0d9488",
  accentGradient = "linear-gradient(135deg, #0d9488, #5eead4)",
  featureLabel = "AI",
}: AiProcessingAnimationProps) {
  // Auto-step message based on elapsed time
  const steps = isRtl ? STEPS_HE : STEPS_EN;
  const autoStep = steps.find((s) => elapsedSeconds < s.until) ?? steps[steps.length - 1];
  const displayStep = currentStep || `${autoStep.icon} ${autoStep.text}`;

  // Progress: fills to 95% over 5 minutes (300s)
  const progress = Math.min(95, Math.round((elapsedSeconds / 300) * 95));

  // Format elapsed time
  const mm = Math.floor(elapsedSeconds / 60).toString().padStart(2, "0");
  const ss = (elapsedSeconds % 60).toString().padStart(2, "0");

  return (
    <div
      className="rounded-2xl overflow-hidden relative"
      style={{
        background: "#fff",
        border: `1px solid ${accentColor}22`,
        boxShadow: `0 4px 24px ${accentColor}18`,
      }}
    >
      {/* Particles */}
      <Particles color={accentColor} />

      {/* Header bar */}
      <div
        className="flex items-center justify-between px-4 py-2.5"
        style={{ background: `${accentColor}0f`, borderBottom: `1px solid ${accentColor}18` }}
      >
        <div className="flex items-center gap-2">
          {/* Pulsing dot */}
          <span
            className="w-2.5 h-2.5 rounded-full inline-block"
            style={{ background: accentColor, animation: "pulse 1.5s ease-in-out infinite" }}
          />
          <span className="text-xs font-bold" style={{ color: accentColor }}>
            {featureLabel}
          </span>
        </div>
        <span className="text-xs font-mono font-semibold text-gray-400">{mm}:{ss}</span>
      </div>

      {/* Main content */}
      <div className="p-4 flex flex-col gap-3">
        {/* Image preview with scanning overlay OR animated SVG */}
        <div className="relative rounded-xl overflow-hidden" style={{ height: 160 }}>
          {imagePreview ? (
            <>
              <img
                src={imagePreview}
                alt="processing"
                className="w-full h-full object-contain"
                style={{ opacity: 0.45 }}
              />
              {/* Scanning line */}
              <div
                className="absolute left-0 right-0 h-0.5 pointer-events-none"
                style={{
                  background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)`,
                  animation: "scanLine 2s ease-in-out infinite",
                  boxShadow: `0 0 8px ${accentColor}`,
                }}
              />
              {/* Overlay grid */}
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage: `linear-gradient(${accentColor}18 1px, transparent 1px), linear-gradient(90deg, ${accentColor}18 1px, transparent 1px)`,
                  backgroundSize: "20px 20px",
                }}
              />
              {/* Corner brackets */}
              {([
                { top: 8, left: 8, deg: 0 },
                { top: 8, right: 8, deg: 90 },
                { bottom: 8, right: 8, deg: 180 },
                { bottom: 8, left: 8, deg: 270 },
              ] as Array<{ top?: number; bottom?: number; left?: number; right?: number; deg: number }>).map((pos, i) => (
                <div
                  key={i}
                  className="absolute w-5 h-5 pointer-events-none"
                  style={{
                    top: pos.top,
                    bottom: pos.bottom,
                    left: pos.left,
                    right: pos.right,
                    borderTop: `2px solid ${accentColor}`,
                    borderLeft: `2px solid ${accentColor}`,
                    transform: `rotate(${pos.deg}deg)`,
                    borderRadius: 2,
                  }}
                />
              ))}
            </>
          ) : (
            <div
              className="w-full h-full flex items-center justify-center rounded-xl"
              style={{ background: `${accentColor}08` }}
            >
              <div className="w-32 h-24">
                <AnimatedSvgPath color={accentColor} elapsed={elapsedSeconds} />
              </div>
            </div>
          )}
        </div>

        {/* Step text */}
        <div className="flex items-start gap-2">
          <div
            className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
            style={{ background: accentColor, animation: "pulse 1.5s ease-in-out infinite" }}
          />
          <p className="text-sm font-semibold text-gray-700 leading-snug">{displayStep}</p>
        </div>

        {/* Progress bar */}
        <div className="w-full rounded-full overflow-hidden relative" style={{ height: 10, background: `${accentColor}15` }}>
          {/* Shimmer */}
          <div
            className="absolute inset-0"
            style={{
              background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.45) 50%, transparent 100%)",
              backgroundSize: "200% 100%",
              animation: "shimmer 1.8s ease-in-out infinite",
            }}
          />
          {/* Fill */}
          <div
            className="h-full rounded-full"
            style={{
              background: accentGradient,
              width: `${progress}%`,
              transition: "width 1s cubic-bezier(0.4, 0, 0.2, 1)",
            }}
          />
        </div>

        {/* Wave dots */}
        <div className="flex items-center justify-center gap-1.5">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="rounded-full"
              style={{
                width: 7,
                height: 7,
                background: accentColor,
                opacity: 0.7,
                animation: `wave 1.4s ease-in-out infinite`,
                animationDelay: `${i * 0.12}s`,
              }}
            />
          ))}
        </div>

        {/* Cancel button */}
        {jobId && onCancel && (
          <button
            onClick={onCancel}
            className="w-full py-2 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-all hover:bg-red-50"
            style={{ background: "#fff5f5", border: "1px solid #fecaca", color: "#f87171" }}
          >
            <X className="w-3.5 h-3.5" />
            {isRtl ? "בטל עיבוד" : "Cancel processing"}
          </button>
        )}
      </div>

      {/* CSS keyframes injected once */}
      <style>{`
        @keyframes scanLine {
          0% { top: 0%; }
          50% { top: 100%; }
          100% { top: 0%; }
        }
        @keyframes particleFade {
          0%, 100% { opacity: 0; transform: translateY(0); }
          50% { opacity: 0.6; transform: translateY(-8px); }
        }
      `}</style>
    </div>
  );
}

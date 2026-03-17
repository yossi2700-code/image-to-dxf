/**
 * AiProcessingAnimation — Clean light-theme AI processing screen.
 *
 * Design: white/light-gray background, accent color per feature,
 * scan beam over image preview, elegant multi-ring spinner,
 * 4 progress steps, cancel+refund button, pleasant tones (off by default).
 */

import { useEffect, useRef, useState, useCallback } from "react";

// ── Props ────────────────────────────────────────────────────────────────────

interface AiProcessingAnimationProps {
  elapsedSeconds: number;
  currentStep?: string;
  imagePreview?: string | null;
  jobId?: string | null;
  onCancel?: () => void;
  isRtl?: boolean;
  accentColor?: string;
  accentGradient?: string;
  featureLabel?: string;
}

// ── 4 Progress steps ──────────────────────────────────────────────────────────

const STEPS_HE = [
  { until: 10,       icon: "🔍", label: "ניתוח תמונה",      desc: "AI סורק ומנתח את התמונה" },
  { until: 22,       icon: "✏️", label: "זיהוי קווים",      desc: "מזהה קווים, צורות ואובייקטים" },
  { until: 34,       icon: "⚡", label: "יצירת וקטור",      desc: "ממיר לנתיבים וקטוריים חדים" },
  { until: Infinity, icon: "🎯", label: "ייצוא DXF",        desc: "מכין את הקובץ להורדה" },
];
const STEPS_EN = [
  { until: 10,       icon: "🔍", label: "Analyzing",        desc: "AI scanning the image" },
  { until: 22,       icon: "✏️", label: "Detecting",        desc: "Finding lines, shapes & objects" },
  { until: 34,       icon: "⚡", label: "Vectorizing",      desc: "Converting to crisp vector paths" },
  { until: Infinity, icon: "🎯", label: "Exporting DXF",    desc: "Preparing your file for download" },
];

const TOTAL_SECONDS = 41;

// ── Pleasant ambient tones (Web Audio API) ────────────────────────────────────

function startAmbientTones(accentHex: string): () => void {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    const master = ctx.createGain();
    master.gain.setValueAtTime(0, ctx.currentTime);
    master.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 1.5);
    master.connect(ctx.destination);

    // Derive a pleasant base note from accent color
    const r = parseInt(accentHex.slice(1, 3), 16);
    const noteFreqs = [261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88]; // C4–B4
    const baseFreq = noteFreqs[r % noteFreqs.length];

    const oscs: OscillatorNode[] = [];

    // Soft pad: root + major third + fifth
    [1, 1.25, 1.5].forEach((ratio, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = baseFreq * ratio;
      g.gain.value = 0.04;
      // Slow vibrato
      const lfo = ctx.createOscillator();
      const lfoG = ctx.createGain();
      lfo.frequency.value = 0.2 + i * 0.05;
      lfoG.gain.value = baseFreq * ratio * 0.002;
      lfo.connect(lfoG);
      lfoG.connect(osc.frequency);
      lfo.start();
      osc.connect(g);
      g.connect(master);
      osc.start();
      oscs.push(osc, lfo);
    });

    // Gentle bell-like ping every 6 s
    const pingTimer = setInterval(() => {
      if (ctx.state === "closed") return;
      const p = ctx.createOscillator();
      const pg = ctx.createGain();
      p.type = "sine";
      p.frequency.value = baseFreq * 2;
      pg.gain.setValueAtTime(0, ctx.currentTime);
      pg.gain.linearRampToValueAtTime(0.045, ctx.currentTime + 0.02);
      pg.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.6);
      p.connect(pg);
      pg.connect(master);
      p.start();
      p.stop(ctx.currentTime + 1.6);
    }, 6000);

    return () => {
      clearInterval(pingTimer);
      master.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.8);
      setTimeout(() => {
        oscs.forEach(o => { try { o.stop(); } catch (_) {} });
        try { ctx.close(); } catch (_) {}
      }, 1000);
    };
  } catch (_) {
    return () => {};
  }
}

// ── Elegant multi-ring spinner ────────────────────────────────────────────────

function ElegantSpinner({ accent, size = 120 }: { accent: string; size?: number }) {
  const c = size / 2;
  const r1 = c - 8;   // outer ring
  const r2 = c - 20;  // middle ring
  const r3 = c - 32;  // inner ring

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id="sg1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={accent} stopOpacity="0.9"/>
          <stop offset="100%" stopColor={accent} stopOpacity="0.1"/>
        </linearGradient>
        <linearGradient id="sg2" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={accent} stopOpacity="0.6"/>
          <stop offset="100%" stopColor={accent} stopOpacity="0.05"/>
        </linearGradient>
        <filter id="sf">
          <feGaussianBlur stdDeviation="1.5" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>

      {/* Track rings */}
      <circle cx={c} cy={c} r={r1} fill="none" stroke={accent} strokeWidth="2" strokeOpacity="0.08"/>
      <circle cx={c} cy={c} r={r2} fill="none" stroke={accent} strokeWidth="1.5" strokeOpacity="0.06"/>
      <circle cx={c} cy={c} r={r3} fill="none" stroke={accent} strokeWidth="1" strokeOpacity="0.06"/>

      {/* Spinning arc 1 — outer, fast */}
      <circle
        cx={c} cy={c} r={r1}
        fill="none"
        stroke="url(#sg1)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={`${r1 * 1.4} ${r1 * 5}`}
        filter="url(#sf)"
        style={{ animation: "spinCW 1.6s linear infinite", transformOrigin: `${c}px ${c}px` }}
      />

      {/* Spinning arc 2 — middle, medium, reverse */}
      <circle
        cx={c} cy={c} r={r2}
        fill="none"
        stroke="url(#sg2)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray={`${r2 * 1.0} ${r2 * 5}`}
        filter="url(#sf)"
        style={{ animation: "spinCCW 2.4s linear infinite", transformOrigin: `${c}px ${c}px` }}
      />

      {/* Spinning arc 3 — inner, slow */}
      <circle
        cx={c} cy={c} r={r3}
        fill="none"
        stroke={accent}
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray={`${r3 * 0.7} ${r3 * 5}`}
        strokeOpacity="0.5"
        style={{ animation: "spinCW 3.6s linear infinite", transformOrigin: `${c}px ${c}px` }}
      />

      {/* Center dot */}
      <circle cx={c} cy={c} r="5" fill={accent} opacity="0.85"
        style={{ animation: "pulseDot 2s ease-in-out infinite", transformOrigin: `${c}px ${c}px` }}
      />
      <circle cx={c} cy={c} r="10" fill={accent} opacity="0.12"
        style={{ animation: "pulseDot 2s ease-in-out infinite 0.3s", transformOrigin: `${c}px ${c}px` }}
      />
    </svg>
  );
}

// ── Scan beam over image ──────────────────────────────────────────────────────

function ImageWithScan({ src, accent }: { src: string; accent: string }) {
  return (
    <div
      className="relative rounded-xl overflow-hidden"
      style={{
        width: 88, height: 88,
        border: `2px solid ${accent}30`,
        boxShadow: `0 4px 20px ${accent}20`,
        background: "#f8f9fa",
      }}
    >
      <img src={src} alt="" className="w-full h-full object-cover" style={{ opacity: 0.85 }}/>
      {/* Scan beam */}
      <div
        className="absolute left-0 right-0 pointer-events-none"
        style={{
          height: 3,
          background: `linear-gradient(90deg, transparent 0%, ${accent}cc 40%, ${accent} 50%, ${accent}cc 60%, transparent 100%)`,
          boxShadow: `0 0 8px ${accent}80, 0 0 16px ${accent}40`,
          animation: "scanBeam 1.8s ease-in-out infinite",
        }}
      />
      {/* Corner brackets */}
      {[
        { top: 4, left: 4, borderTop: `2px solid ${accent}`, borderLeft: `2px solid ${accent}` },
        { top: 4, right: 4, borderTop: `2px solid ${accent}`, borderRight: `2px solid ${accent}` },
        { bottom: 4, left: 4, borderBottom: `2px solid ${accent}`, borderLeft: `2px solid ${accent}` },
        { bottom: 4, right: 4, borderBottom: `2px solid ${accent}`, borderRight: `2px solid ${accent}` },
      ].map((s, i) => (
        <div key={i} className="absolute" style={{ ...s, width: 10, height: 10 }}/>
      ))}
    </div>
  );
}

// ── Music bars ────────────────────────────────────────────────────────────────

function MusicBars({ color }: { color: string }) {
  return (
    <span className="flex items-end gap-0.5" style={{ height: 12 }}>
      {[1, 2, 3, 4].map((i) => (
        <span key={i} style={{
          display: "inline-block", width: 3,
          background: color, borderRadius: 2,
          transformOrigin: "bottom",
          animation: `musicBar ${0.38 + i * 0.09}s ease-in-out infinite`,
          animationDelay: `${i * 0.07}s`,
          height: "100%",
        }}/>
      ))}
    </span>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

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

  const steps = isRtl ? STEPS_HE : STEPS_EN;
  const stepIndex = steps.findIndex(s => elapsedSeconds < s.until);
  const activeStep = stepIndex === -1 ? steps.length - 1 : stepIndex;

  // Progress: 0–95% over TOTAL_SECONDS
  const progress = Math.min(95, Math.round((elapsedSeconds / TOTAL_SECONDS) * 95));
  const mm = Math.floor(elapsedSeconds / 60).toString().padStart(2, "0");
  const ss = (elapsedSeconds % 60).toString().padStart(2, "0");

  // Music
  const stopMusicRef = useRef<(() => void) | null>(null);
  const [musicOn, setMusicOn] = useState(false);

  const toggleMusic = useCallback(() => {
    if (musicOn) {
      stopMusicRef.current?.();
      stopMusicRef.current = null;
      setMusicOn(false);
    } else {
      stopMusicRef.current = startAmbientTones(accentColor);
      setMusicOn(true);
    }
  }, [musicOn, accentColor]);

  useEffect(() => () => { stopMusicRef.current?.(); }, []);

  return (
    <div
      className="relative overflow-hidden rounded-2xl flex flex-col"
      style={{
        background: "linear-gradient(145deg, #ffffff 0%, #f8faff 50%, #f0f4ff 100%)",
        minHeight: 340,
        border: `1.5px solid ${accentColor}22`,
        boxShadow: `0 8px 40px ${accentColor}12, 0 2px 8px rgba(0,0,0,0.06)`,
      }}
    >
      {/* Subtle background accent glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse 60% 40% at 50% 0%, ${accentColor}08 0%, transparent 70%)`,
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center px-6 pt-7 pb-6 gap-5">

        {/* Feature badge */}
        <div
          className="text-xs font-bold tracking-widest uppercase px-3.5 py-1 rounded-full"
          style={{
            color: accentColor,
            background: `${accentColor}12`,
            border: `1px solid ${accentColor}30`,
            letterSpacing: "0.12em",
          }}
        >
          ✦ {featureLabel} ✦
        </div>

        {/* Central visual: spinner + image preview */}
        <div className="relative flex items-center justify-center" style={{ width: 120, height: 120 }}>
          <ElegantSpinner accent={accentColor} size={120}/>
          {imagePreview && (
            <div className="absolute" style={{ width: 56, height: 56 }}>
              <ImageWithScan src={imagePreview} accent={accentColor}/>
            </div>
          )}
        </div>

        {/* Current step label */}
        <div className="text-center">
          <p
            className="text-base font-bold"
            style={{ color: accentColor }}
          >
            {currentStep || `${steps[activeStep].icon} ${steps[activeStep].label}`}
          </p>
          <p className="text-xs mt-0.5" style={{ color: "#6b7280" }}>
            {steps[activeStep].desc}
          </p>
        </div>

        {/* 4-step progress track */}
        <div className="w-full" style={{ maxWidth: 340 }}>
          <div className="flex items-center gap-0">
            {steps.map((step, i) => {
              const isDone = i < activeStep;
              const isActive = i === activeStep;
              return (
                <div key={i} className="flex items-center" style={{ flex: i < steps.length - 1 ? 1 : "none" }}>
                  {/* Step node */}
                  <div className="flex flex-col items-center" style={{ minWidth: 44 }}>
                    <div
                      className="flex items-center justify-center rounded-full transition-all duration-500"
                      style={{
                        width: isActive ? 36 : 28,
                        height: isActive ? 36 : 28,
                        background: isDone
                          ? accentColor
                          : isActive
                            ? `${accentColor}18`
                            : "#f3f4f6",
                        border: isActive
                          ? `2px solid ${accentColor}`
                          : isDone
                            ? "none"
                            : "2px solid #e5e7eb",
                        boxShadow: isActive ? `0 0 14px ${accentColor}40` : "none",
                        fontSize: isActive ? 16 : 13,
                      }}
                    >
                      {isDone ? (
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                          <path d="M2.5 7L5.5 10L11.5 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      ) : (
                        <span style={{ fontSize: isActive ? 16 : 12 }}>{step.icon}</span>
                      )}
                    </div>
                    <span
                      className="text-xs mt-1 text-center font-medium transition-all duration-500"
                      style={{
                        color: isActive ? accentColor : isDone ? "#9ca3af" : "#d1d5db",
                        fontSize: 10,
                        maxWidth: 48,
                        lineHeight: 1.2,
                      }}
                    >
                      {step.label}
                    </span>
                  </div>
                  {/* Connector line */}
                  {i < steps.length - 1 && (
                    <div
                      className="flex-1 transition-all duration-700"
                      style={{
                        height: 2,
                        marginBottom: 18,
                        background: isDone ? accentColor : "#e5e7eb",
                        borderRadius: 1,
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Progress bar + timer */}
        <div className="w-full" style={{ maxWidth: 340 }}>
          <div
            className="w-full rounded-full overflow-hidden"
            style={{ height: 6, background: "#e5e7eb" }}
          >
            <div
              className="h-full rounded-full relative overflow-hidden transition-all duration-1000 ease-out"
              style={{
                width: `${progress}%`,
                background: accentGradient,
                boxShadow: `0 0 8px ${accentColor}50`,
              }}
            >
              {/* Shimmer */}
              <div
                className="absolute inset-0"
                style={{
                  background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.5) 50%, transparent 100%)",
                  backgroundSize: "200% 100%",
                  animation: "shimmer 1.6s ease-in-out infinite",
                }}
              />
            </div>
          </div>
          <div className="flex justify-between mt-1.5">
            <span className="text-xs font-medium" style={{ color: accentColor }}>{progress}%</span>
            <span className="text-xs tabular-nums font-mono" style={{ color: "#9ca3af" }}>{mm}:{ss}</span>
          </div>
        </div>

        {/* Bottom row: music + cancel */}
        <div className="flex items-center gap-2.5">
          {/* Music toggle */}
          <button
            onClick={toggleMusic}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all"
            style={{
              background: musicOn ? `${accentColor}15` : "#f3f4f6",
              border: `1px solid ${musicOn ? accentColor + "40" : "#e5e7eb"}`,
              color: musicOn ? accentColor : "#9ca3af",
            }}
          >
            {musicOn ? (
              <><span>🔊</span><MusicBars color={accentColor}/></>
            ) : (
              <><span>🎵</span><span>{isRtl ? "מוזיקה" : "Music"}</span></>
            )}
          </button>

          {/* Cancel + refund */}
          {jobId && onCancel && (
            <button
              onClick={onCancel}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium transition-all"
              style={{
                background: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#ef4444",
              }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.background = "#fee2e2";
                el.style.borderColor = "#f87171";
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.background = "#fef2f2";
                el.style.borderColor = "#fecaca";
              }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M9 3L3 9M3 3l6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <span>{isRtl ? "בטל והחזר אסימונים" : "Cancel & refund"}</span>
            </button>
          )}
        </div>
      </div>

      {/* CSS keyframes */}
      <style>{`
        @keyframes spinCW  { from { transform: rotate(0deg); }   to { transform: rotate(360deg); } }
        @keyframes spinCCW { from { transform: rotate(0deg); }   to { transform: rotate(-360deg); } }
        @keyframes pulseDot {
          0%, 100% { transform: scale(1);   opacity: 0.85; }
          50%       { transform: scale(1.3); opacity: 1;    }
        }
        @keyframes scanBeam {
          0%   { top: -3px;   opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { top: calc(100% + 3px); opacity: 0; }
        }
        @keyframes shimmer {
          0%   { background-position: -200% 0; }
          100% { background-position:  200% 0; }
        }
        @keyframes musicBar {
          0%, 100% { transform: scaleY(0.25); }
          50%       { transform: scaleY(1);    }
        }
      `}</style>
    </div>
  );
}

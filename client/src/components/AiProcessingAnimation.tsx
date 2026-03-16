/**
 * AiProcessingAnimation — Stunning animated processing screen.
 *
 * Features:
 * - Dark background with animated glowing particles (canvas)
 * - SVG path that draws itself progressively
 * - Timed progress bar scaled to ~41 seconds
 * - Step list that updates in real time (7 steps)
 * - Subtle ambient music via Web Audio API (no external files)
 * - Per-feature color themes: teal (trace), amber (redraw), purple (portrait)
 * - Cancel button
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

// ── Theme helpers ─────────────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

// ── Step messages ─────────────────────────────────────────────────────────────

const STEPS_HE = [
  { until: 6,   icon: "🧠", text: "AI מנתח את התמונה..." },
  { until: 12,  icon: "🔍", text: "מזהה קווים ואובייקטים..." },
  { until: 20,  icon: "✏️", text: "מצייר קווים וקטוריים..." },
  { until: 28,  icon: "⚡", text: "ממטב נתיבים..." },
  { until: 35,  icon: "✨", text: "משפר פרטים דקים..." },
  { until: 41,  icon: "🎯", text: "ממיר ל-DXF..." },
  { until: Infinity, icon: "💫", text: "כמעט מוכן..." },
];
const STEPS_EN = [
  { until: 6,   icon: "🧠", text: "AI analyzing image..." },
  { until: 12,  icon: "🔍", text: "Detecting lines & shapes..." },
  { until: 20,  icon: "✏️", text: "Drawing vector paths..." },
  { until: 28,  icon: "⚡", text: "Optimizing paths..." },
  { until: 35,  icon: "✨", text: "Refining fine details..." },
  { until: 41,  icon: "🎯", text: "Converting to DXF..." },
  { until: Infinity, icon: "💫", text: "Almost ready..." },
];

// Total expected seconds for progress bar scale
const TOTAL_SECONDS = 41;

// ── Ambient music via Web Audio API ──────────────────────────────────────────

function startAmbientMusic(primaryHex: string): () => void {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    const master = ctx.createGain();
    master.gain.setValueAtTime(0, ctx.currentTime);
    master.gain.linearRampToValueAtTime(0.07, ctx.currentTime + 2);
    master.connect(ctx.destination);

    // Choose base frequency from color
    const [r] = hexToRgb(primaryHex);
    const baseFreq = 180 + (r % 80); // 180–260 Hz

    const oscs: OscillatorNode[] = [];

    // Soft pad: 4 harmonics
    [1, 1.25, 1.5, 2].forEach((ratio, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = i % 2 === 0 ? "sine" : "triangle";
      osc.frequency.value = baseFreq * ratio;
      g.gain.value = 0.12 / 4;
      // Gentle vibrato
      const lfo = ctx.createOscillator();
      const lfoG = ctx.createGain();
      lfo.frequency.value = 0.25 + i * 0.07;
      lfoG.gain.value = baseFreq * ratio * 0.003;
      lfo.connect(lfoG);
      lfoG.connect(osc.frequency);
      lfo.start();
      osc.connect(g);
      g.connect(master);
      osc.start();
      oscs.push(osc, lfo);
    });

    // Slow rhythmic pulse every 4 s
    const pulseTimer = setInterval(() => {
      if (ctx.state === "closed") return;
      const p = ctx.createOscillator();
      const pg = ctx.createGain();
      p.type = "sine";
      p.frequency.value = baseFreq * 0.5;
      pg.gain.setValueAtTime(0, ctx.currentTime);
      pg.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 0.4);
      pg.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.8);
      p.connect(pg);
      pg.connect(master);
      p.start();
      p.stop(ctx.currentTime + 1.8);
    }, 4000);

    return () => {
      clearInterval(pulseTimer);
      master.gain.linearRampToValueAtTime(0, ctx.currentTime + 1);
      setTimeout(() => {
        oscs.forEach(o => { try { o.stop(); } catch (_) {} });
        try { ctx.close(); } catch (_) {}
      }, 1200);
    };
  } catch (_) {
    return () => {};
  }
}

// ── Canvas particle system ────────────────────────────────────────────────────

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  r: number; alpha: number;
  color: string;
  life: number; maxLife: number;
}

function mkParticle(w: number, h: number, color: string): Particle {
  return {
    x: Math.random() * w,
    y: Math.random() * h,
    vx: (Math.random() - 0.5) * 0.5,
    vy: -(Math.random() * 0.6 + 0.15),
    r: Math.random() * 2.5 + 0.5,
    alpha: Math.random() * 0.55 + 0.15,
    color,
    life: 0,
    maxLife: Math.random() * 180 + 80,
  };
}

function useParticleCanvas(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  primaryColor: string,
  secondaryColor: string
) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let running = true;
    let frame = 0;
    const particles: Particle[] = [];

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = canvas.offsetWidth * dpr;
      canvas.height = canvas.offsetHeight * dpr;
      ctx.scale(dpr, dpr);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // Seed initial particles
    for (let i = 0; i < 35; i++) {
      particles.push(mkParticle(canvas.offsetWidth, canvas.offsetHeight, primaryColor));
    }

    const tick = () => {
      if (!running) return;
      frame++;
      const W = canvas.offsetWidth, H = canvas.offsetHeight;
      ctx.clearRect(0, 0, W, H);

      // Spawn
      if (frame % 7 === 0) particles.push(mkParticle(W, H, primaryColor));
      if (frame % 21 === 0) particles.push(mkParticle(W, H, secondaryColor));

      // Update & draw
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx; p.y += p.vy; p.life++;
        if (p.life >= p.maxLife) { particles.splice(i, 1); continue; }
        const fade = 1 - p.life / p.maxLife;
        const a = Math.round(p.alpha * fade * 255).toString(16).padStart(2, "0");
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.color + a;
        ctx.fill();
        if (p.r > 1.5) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r * 3, 0, Math.PI * 2);
          const ga = Math.round(p.alpha * fade * 0.25 * 255).toString(16).padStart(2, "0");
          ctx.fillStyle = p.color + ga;
          ctx.fill();
        }
      }

      // Scanning line
      const scanY = ((frame * 1.3) % (H + 60)) - 30;
      const sg = ctx.createLinearGradient(0, scanY - 10, 0, scanY + 10);
      sg.addColorStop(0, "transparent");
      sg.addColorStop(0.5, primaryColor + "35");
      sg.addColorStop(1, "transparent");
      ctx.fillStyle = sg;
      ctx.fillRect(0, scanY - 10, W, 20);

      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);

    return () => {
      running = false;
      ro.disconnect();
    };
  }, [canvasRef, primaryColor, secondaryColor]);
}

// ── SVG demo paths ────────────────────────────────────────────────────────────

const DEMO_PATHS = [
  "M 20 80 C 40 20, 80 20, 100 80 S 160 140, 180 80",
  "M 30 60 L 60 30 L 90 60 L 120 30 L 150 60 L 180 30",
  "M 20 100 Q 60 20 100 100 Q 140 180 180 100",
  "M 100 20 L 140 80 L 80 80 Z M 100 80 L 140 140 L 60 140 Z",
];

function AnimatedSvgPath({ color, elapsed }: { color: string; elapsed: number }) {
  const pathRef = useRef<SVGPathElement>(null);
  const [pathIndex, setPathIndex] = useState(0);
  const [pathLength, setPathLength] = useState(300);

  useEffect(() => {
    setPathIndex(Math.floor(elapsed / 5) % DEMO_PATHS.length);
  }, [elapsed]);

  useEffect(() => {
    if (pathRef.current) setPathLength(pathRef.current.getTotalLength() || 300);
  }, [pathIndex]);

  const progress = Math.min(1, ((elapsed % 5) / 5) * 1.1);
  const drawn = pathLength * progress;

  return (
    <svg viewBox="0 0 200 160" className="w-full h-full" style={{ overflow: "visible" }}>
      <defs>
        <filter id="glow-path">
          <feGaussianBlur stdDeviation="2.5" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      {/* Ghost */}
      <path d={DEMO_PATHS[pathIndex]} fill="none" stroke={color} strokeWidth="1.5" strokeOpacity="0.1" strokeLinecap="round"/>
      {/* Drawing */}
      <path
        ref={pathRef}
        d={DEMO_PATHS[pathIndex]}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter="url(#glow-path)"
        style={{
          strokeDasharray: pathLength,
          strokeDashoffset: pathLength - drawn,
          transition: "stroke-dashoffset 0.25s linear",
        }}
      />
      {/* Moving dot */}
      {progress < 0.98 && (
        <circle r="5" fill={color} filter="url(#glow-path)" opacity="0.9">
          <animateMotion dur="5s" repeatCount="indefinite" path={DEMO_PATHS[pathIndex]}/>
        </circle>
      )}
    </svg>
  );
}

// ── Music bars indicator ──────────────────────────────────────────────────────

function MusicBars({ color }: { color: string }) {
  return (
    <span className="flex items-end gap-0.5" style={{ height: 12 }}>
      {[1, 2, 3, 4].map((i) => (
        <span
          key={i}
          style={{
            display: "inline-block",
            width: 3,
            background: color,
            borderRadius: 2,
            transformOrigin: "bottom",
            animation: `musicBar ${0.38 + i * 0.09}s ease-in-out infinite`,
            animationDelay: `${i * 0.07}s`,
            height: "100%",
          }}
        />
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
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Derive secondary color from gradient (take last color or lighten)
  const secondaryColor = accentGradient.includes(",")
    ? accentGradient.split(",").pop()?.trim().replace(")", "").trim() ?? accentColor
    : accentColor;

  useParticleCanvas(canvasRef, accentColor, secondaryColor);

  // Steps
  const steps = isRtl ? STEPS_HE : STEPS_EN;
  const autoStep = steps.find((s) => elapsedSeconds < s.until) ?? steps[steps.length - 1];
  const displayStep = currentStep || `${autoStep.icon} ${autoStep.text}`;
  const stepIndex = steps.indexOf(autoStep);

  // Progress: 0–95% over TOTAL_SECONDS, then stays at 95%
  const progress = Math.min(95, Math.round((elapsedSeconds / TOTAL_SECONDS) * 95));

  // Timer
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
      stopMusicRef.current = startAmbientMusic(accentColor);
      setMusicOn(true);
    }
  }, [musicOn, accentColor]);

  useEffect(() => () => { stopMusicRef.current?.(); }, []);

  // Derive dark bg from accent
  const [r, g, b] = hexToRgb(accentColor);
  const bg1 = `rgb(${Math.round(r * 0.06)}, ${Math.round(g * 0.06)}, ${Math.round(b * 0.06)})`;
  const bg2 = `rgb(${Math.round(r * 0.04)}, ${Math.round(g * 0.08)}, ${Math.round(b * 0.04)})`;

  return (
    <div
      className="relative overflow-hidden rounded-2xl flex flex-col"
      style={{
        background: `linear-gradient(135deg, ${bg1} 0%, ${bg2} 100%)`,
        minHeight: 320,
        border: `1px solid ${accentColor}30`,
        boxShadow: `0 0 40px ${accentColor}22, inset 0 0 60px rgba(0,0,0,0.5)`,
      }}
    >
      {/* Particle canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ opacity: 0.65 }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center px-5 pt-6 pb-5 gap-4">

        {/* Feature badge */}
        <div
          className="text-xs font-bold tracking-widest uppercase px-3 py-1 rounded-full"
          style={{
            color: accentColor,
            background: accentColor + "20",
            border: `1px solid ${accentColor}40`,
            letterSpacing: "0.14em",
          }}
        >
          ✦ {featureLabel} ✦
        </div>

        {/* Central visual */}
        <div className="relative flex items-center justify-center" style={{ width: 130, height: 130 }}>
          {/* Outer spinning dashed ring */}
          <svg
            width="130" height="130"
            className="absolute inset-0"
            style={{ animation: "spinCW 4s linear infinite" }}
          >
            <circle cx="65" cy="65" r="60" fill="none" stroke={accentColor} strokeWidth="1.5"
              strokeDasharray="18 9" opacity="0.35"/>
          </svg>
          {/* Inner counter-spinning ring */}
          <svg
            width="108" height="108"
            className="absolute"
            style={{ animation: "spinCCW 6s linear infinite" }}
          >
            <circle cx="54" cy="54" r="48" fill="none" stroke={secondaryColor} strokeWidth="1"
              strokeDasharray="7 14" opacity="0.25"/>
          </svg>
          {/* Glow pulse */}
          <div
            className="absolute rounded-full"
            style={{
              width: 80, height: 80,
              background: `radial-gradient(circle, ${accentColor}20 0%, transparent 70%)`,
              animation: "glowPulse 2.2s ease-in-out infinite",
            }}
          />
          {/* Image preview or animated SVG */}
          {imagePreview ? (
            <div className="relative w-16 h-16 rounded-xl overflow-hidden" style={{ border: `1.5px solid ${accentColor}50` }}>
              <img src={imagePreview} alt="" className="w-full h-full object-cover" style={{ opacity: 0.5 }}/>
              {/* Scan overlay */}
              <div
                className="absolute left-0 right-0 h-0.5 pointer-events-none"
                style={{
                  background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)`,
                  animation: "scanLine 1.8s ease-in-out infinite",
                  boxShadow: `0 0 6px ${accentColor}`,
                }}
              />
            </div>
          ) : (
            <div className="w-20 h-16 relative z-10">
              <AnimatedSvgPath color={accentColor} elapsed={elapsedSeconds}/>
            </div>
          )}
        </div>

        {/* Step message */}
        <p
          className="text-sm font-semibold text-center"
          style={{
            color: accentColor,
            textShadow: `0 0 14px ${accentColor}70`,
            minHeight: 22,
          }}
        >
          {displayStep}
        </p>

        {/* Step dots */}
        <div className="flex items-center gap-1.5">
          {steps.map((_, i) => (
            <div
              key={i}
              className="rounded-full transition-all duration-500"
              style={{
                width: i === stepIndex ? 18 : 5,
                height: 5,
                background: i <= stepIndex ? accentColor : accentColor + "28",
                boxShadow: i === stepIndex ? `0 0 7px ${accentColor}` : "none",
              }}
            />
          ))}
        </div>

        {/* Progress bar */}
        <div className="w-full" style={{ maxWidth: 340 }}>
          <div
            className="w-full rounded-full overflow-hidden"
            style={{ height: 7, background: accentColor + "18" }}
          >
            <div
              className="h-full rounded-full transition-all duration-1000 ease-out relative overflow-hidden"
              style={{
                width: `${progress}%`,
                background: accentGradient,
                boxShadow: `0 0 10px ${accentColor}80`,
              }}
            >
              {/* Shimmer */}
              <div
                className="absolute inset-0"
                style={{
                  background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.35) 50%, transparent 100%)",
                  backgroundSize: "200% 100%",
                  animation: "shimmer 1.8s ease-in-out infinite",
                }}
              />
            </div>
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-xs" style={{ color: accentColor + "70" }}>{progress}%</span>
            <span className="text-xs tabular-nums font-mono" style={{ color: accentColor + "70" }}>{mm}:{ss}</span>
          </div>
        </div>

        {/* Bottom row: music + cancel */}
        <div className="flex items-center gap-2.5 mt-0.5">
          <button
            onClick={toggleMusic}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all"
            style={{
              background: musicOn ? accentColor + "22" : "rgba(255,255,255,0.05)",
              border: `1px solid ${musicOn ? accentColor + "55" : "rgba(255,255,255,0.1)"}`,
              color: musicOn ? accentColor : "rgba(255,255,255,0.35)",
            }}
          >
            {musicOn ? (
              <><span>🔊</span><MusicBars color={accentColor}/></>
            ) : (
              <><span>🎵</span><span>{isRtl ? "מוזיקה" : "Music"}</span></>
            )}
          </button>

          {jobId && onCancel && (
            <button
              onClick={onCancel}
              className="px-4 py-1.5 rounded-full text-xs font-medium transition-all"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "rgba(255,255,255,0.38)",
              }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.background = "rgba(239,68,68,0.15)";
                el.style.color = "#f87171";
                el.style.borderColor = "rgba(239,68,68,0.3)";
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.background = "rgba(255,255,255,0.04)";
                el.style.color = "rgba(255,255,255,0.38)";
                el.style.borderColor = "rgba(255,255,255,0.1)";
              }}
            >
              {isRtl ? "ביטול" : "Cancel"}
            </button>
          )}
        </div>
      </div>

      {/* CSS keyframes */}
      <style>{`
        @keyframes spinCW  { from { transform: rotate(0deg); }   to { transform: rotate(360deg); } }
        @keyframes spinCCW { from { transform: rotate(0deg); }   to { transform: rotate(-360deg); } }
        @keyframes glowPulse {
          0%, 100% { transform: scale(1);    opacity: 0.7; }
          50%       { transform: scale(1.12); opacity: 1;   }
        }
        @keyframes scanLine {
          0%   { top: 0%;   }
          50%  { top: 100%; }
          100% { top: 0%;   }
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

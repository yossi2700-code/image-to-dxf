/**
 * SuccessConfetti — lightweight canvas-based confetti burst + success overlay.
 * No external dependencies. Fires once on mount, cleans up automatically.
 */

import { useEffect, useRef, useState } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  rotation: number;
  rotationSpeed: number;
  shape: "rect" | "circle" | "star";
  opacity: number;
  life: number;
}

function randomBetween(a: number, b: number) {
  return a + Math.random() * (b - a);
}

function createParticles(
  cx: number,
  cy: number,
  count: number,
  colors: string[]
): Particle[] {
  return Array.from({ length: count }, () => {
    const angle = randomBetween(0, Math.PI * 2);
    const speed = randomBetween(3, 11);
    return {
      x: cx,
      y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - randomBetween(2, 5),
      color: colors[Math.floor(Math.random() * colors.length)],
      size: randomBetween(5, 12),
      rotation: randomBetween(0, Math.PI * 2),
      rotationSpeed: randomBetween(-0.15, 0.15),
      shape: (["rect", "circle", "star"] as const)[Math.floor(Math.random() * 3)],
      opacity: 1,
      life: randomBetween(0.7, 1),
    };
  });
}

function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  const pts = 5;
  ctx.beginPath();
  for (let i = 0; i < pts * 2; i++) {
    const radius = i % 2 === 0 ? r : r * 0.45;
    const a = (i * Math.PI) / pts - Math.PI / 2;
    i === 0 ? ctx.moveTo(x + radius * Math.cos(a), y + radius * Math.sin(a))
             : ctx.lineTo(x + radius * Math.cos(a), y + radius * Math.sin(a));
  }
  ctx.closePath();
  ctx.fill();
}

interface SuccessConfettiProps {
  accentColor?: string;
  /** Called after the animation fades out (~2.5s) */
  onDone?: () => void;
}

export function SuccessConfetti({ accentColor = "#0d9488", onDone }: SuccessConfettiProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.offsetWidth;
    const H = canvas.offsetHeight;
    canvas.width = W;
    canvas.height = H;

    // Accent + festive palette
    const colors = [
      accentColor,
      "#f59e0b",
      "#ef4444",
      "#8b5cf6",
      "#3b82f6",
      "#10b981",
      "#f97316",
      "#ec4899",
      "#fbbf24",
    ];

    // Burst from center-top
    let particles: Particle[] = [
      ...createParticles(W * 0.5, H * 0.35, 80, colors),
      ...createParticles(W * 0.25, H * 0.5, 30, colors),
      ...createParticles(W * 0.75, H * 0.5, 30, colors),
    ];

    let animId: number;
    let startTime: number | null = null;
    const DURATION = 2400;

    function animate(ts: number) {
      if (!startTime) startTime = ts;
      const elapsed = ts - startTime;
      const t = Math.min(elapsed / DURATION, 1);

      ctx!.clearRect(0, 0, W, H);

      particles = particles.filter(p => p.opacity > 0.01);

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.28; // gravity
        p.vx *= 0.99; // air resistance
        p.rotation += p.rotationSpeed;
        p.opacity = Math.max(0, p.life - t * 1.4);

        ctx!.save();
        ctx!.globalAlpha = p.opacity;
        ctx!.fillStyle = p.color;
        ctx!.translate(p.x, p.y);
        ctx!.rotate(p.rotation);

        if (p.shape === "rect") {
          ctx!.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        } else if (p.shape === "circle") {
          ctx!.beginPath();
          ctx!.arc(0, 0, p.size / 2.5, 0, Math.PI * 2);
          ctx!.fill();
        } else {
          drawStar(ctx!, 0, 0, p.size / 2);
        }
        ctx!.restore();
      }

      if (t < 1) {
        animId = requestAnimationFrame(animate);
      } else {
        setVisible(false);
        onDone?.();
      }
    }

    animId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animId);
  }, [accentColor, onDone]);

  if (!visible) return null;

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 50 }}
    />
  );
}

// ── Success overlay — shown briefly when job completes ────────────────────────

interface SuccessOverlayProps {
  accentColor?: string;
  label?: string;
  onDone?: () => void;
}

export function SuccessOverlay({ accentColor = "#0d9488", label, onDone }: SuccessOverlayProps) {
  const [phase, setPhase] = useState<"in" | "hold" | "out">("in");

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("hold"), 50);
    const t2 = setTimeout(() => setPhase("out"), 1800);
    const t3 = setTimeout(() => onDone?.(), 2300);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onDone]);

  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl overflow-hidden"
      style={{
        zIndex: 40,
        background: `linear-gradient(135deg, ${accentColor}ee 0%, ${accentColor}cc 100%)`,
        opacity: phase === "in" ? 0 : phase === "hold" ? 1 : 0,
        transform: phase === "in" ? "scale(0.92)" : phase === "hold" ? "scale(1)" : "scale(1.04)",
        transition: phase === "in"
          ? "opacity 0.35s ease, transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)"
          : "opacity 0.5s ease, transform 0.5s ease",
        backdropFilter: "blur(2px)",
      }}
    >
      <SuccessConfetti accentColor="#ffffff"/>
      {/* Checkmark circle */}
      <div
        className="flex items-center justify-center rounded-full mb-4"
        style={{
          width: 72, height: 72,
          background: "rgba(255,255,255,0.25)",
          border: "3px solid rgba(255,255,255,0.6)",
          boxShadow: "0 0 30px rgba(255,255,255,0.3)",
          animation: "successPop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.1s both",
        }}
      >
        <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
          <path
            d="M8 18L15 25L28 11"
            stroke="white"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ animation: "drawCheck 0.4s ease 0.3s both" }}
          />
        </svg>
      </div>
      <p className="text-white font-bold text-lg" style={{ textShadow: "0 1px 4px rgba(0,0,0,0.2)" }}>
        {label ?? "הושלם!"}
      </p>
      <style>{`
        @keyframes successPop {
          from { transform: scale(0); opacity: 0; }
          to   { transform: scale(1); opacity: 1; }
        }
        @keyframes drawCheck {
          from { stroke-dasharray: 0 60; }
          to   { stroke-dasharray: 60 0; }
        }
      `}</style>
    </div>
  );
}

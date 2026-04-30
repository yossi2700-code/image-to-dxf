/**
 * WelcomeBannerNew.tsx
 * Full-screen welcome modal with confetti animation for new registrants.
 * Shows once per registration, asks "What would you like to create?"
 * with feature buttons that navigate to the relevant tab.
 * Supports Hebrew (RTL) and English (LTR).
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { X, Sparkles, ImageIcon, User, Mountain, Scan } from "lucide-react";

interface WelcomeBannerNewProps {
  userName?: string;
  onDismiss: () => void;
  onSelectFeature: (tab: string) => void;
}

// ── Confetti particle ──────────────────────────────────────────────────────────
interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
  color: string;
  shape: "rect" | "circle" | "star";
  size: number;
  opacity: number;
}

const COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f59e0b",
  "#10b981", "#3b82f6", "#f97316", "#14b8a6",
  "#a855f7", "#ef4444", "#84cc16", "#06b6d4",
];

function createParticle(id: number): Particle {
  return {
    id,
    x: Math.random() * 100,
    y: -5 - Math.random() * 20,
    vx: (Math.random() - 0.5) * 1.5,
    vy: 1.5 + Math.random() * 2.5,
    rotation: Math.random() * 360,
    rotationSpeed: (Math.random() - 0.5) * 8,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    shape: (["rect", "circle", "star"] as const)[Math.floor(Math.random() * 3)],
    size: 6 + Math.random() * 10,
    opacity: 0.85 + Math.random() * 0.15,
  };
}

function ConfettiCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const frameRef = useRef<number>(0);
  const countRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    // Spawn burst of particles
    for (let i = 0; i < 120; i++) {
      particlesRef.current.push(createParticle(countRef.current++));
    }

    // Spawn more over time
    let spawnCount = 0;
    const spawnInterval = setInterval(() => {
      spawnCount++;
      for (let i = 0; i < 15; i++) {
        particlesRef.current.push(createParticle(countRef.current++));
      }
      if (spawnCount >= 6) clearInterval(spawnInterval);
    }, 300);

    const drawStar = (ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) => {
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
        const x = cx + r * Math.cos(angle);
        const y = cy + r * Math.sin(angle);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.closePath();
    };

    const animate = () => {
      if (!canvas || !ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particlesRef.current = particlesRef.current.filter((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.04; // gravity
        p.vx *= 0.995; // air resistance
        p.rotation += p.rotationSpeed;
        p.opacity -= 0.003;

        if (p.y > 110 || p.opacity <= 0) return false;

        const px = (p.x / 100) * canvas.width;
        const py = (p.y / 100) * canvas.height;

        ctx.save();
        ctx.globalAlpha = Math.max(0, p.opacity);
        ctx.fillStyle = p.color;
        ctx.translate(px, py);
        ctx.rotate((p.rotation * Math.PI) / 180);

        if (p.shape === "rect") {
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        } else if (p.shape === "circle") {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          drawStar(ctx, 0, 0, p.size / 2);
          ctx.fill();
        }
        ctx.restore();
        return true;
      });

      frameRef.current = requestAnimationFrame(animate);
    };

    frameRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(frameRef.current);
      clearInterval(spawnInterval);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
}

// ── Feature button ─────────────────────────────────────────────────────────────
interface FeatureBtn {
  tab: string;
  icon: React.ReactNode;
  labelHe: string;
  labelEn: string;
  gradient: string;
  emoji: string;
}

const FEATURES: FeatureBtn[] = [
  {
    tab: "ai",
    icon: <Sparkles className="w-5 h-5" />,
    labelHe: "יצירת AI",
    labelEn: "AI Create",
    gradient: "linear-gradient(135deg, #6366f1, #8b5cf6)",
    emoji: "✨",
  },
  {
    tab: "trace",
    icon: <Scan className="w-5 h-5" />,
    labelHe: "תמונה לקווים",
    labelEn: "Image to Lines",
    gradient: "linear-gradient(135deg, #0d9488, #06b6d4)",
    emoji: "🖼️",
  },
  {
    tab: "face",
    icon: <User className="w-5 h-5" />,
    labelHe: "פורטרט",
    labelEn: "Portrait",
    gradient: "linear-gradient(135deg, #7c3aed, #a855f7)",
    emoji: "🎨",
  },
  {
    tab: "needle-engraving",
    icon: <ImageIcon className="w-5 h-5" />,
    labelHe: "חריטת תמונה",
    labelEn: "Photo Engrave",
    gradient: "linear-gradient(135deg, #1e3a5f, #0f4c75)",
    emoji: "💎",
  },
];

// ── Main component ─────────────────────────────────────────────────────────────
export function WelcomeBannerNew({ userName, onDismiss, onSelectFeature }: WelcomeBannerNewProps) {
  const { isRtl, language } = useLanguage();
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [selectedTab, setSelectedTab] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  const handleDismiss = useCallback(() => {
    setExiting(true);
    setTimeout(onDismiss, 380);
  }, [onDismiss]);

  const handleFeature = useCallback((tab: string) => {
    setSelectedTab(tab);
    setTimeout(() => {
      onSelectFeature(tab);
      handleDismiss();
    }, 200);
  }, [onSelectFeature, handleDismiss]);

  const firstName = userName?.split(" ")[0] || "";

  const t = {
    greeting: isRtl
      ? `ברוך הבא${firstName ? `, ${firstName}` : ""}! 🎉`
      : `Welcome${firstName ? `, ${firstName}` : ""}! 🎉`,
    subtitle: isRtl
      ? "אתה עכשיו חלק ממשפחת dxfai — מקצוענים בווקטורים ו-DXF"
      : "You're now part of the dxfai family — vector & DXF professionals",
    question: isRtl ? "מה בא לך לייצר?" : "What would you like to create?",
    credits: isRtl ? "קיבלת 10 קרדיטים להתחיל!" : "You got 10 credits to start!",
    bonusHint: isRtl
      ? "ועוד 20 קרדיטים בונוס מחכים לך במייל שלך 📧"
      : "Plus 20 bonus credits waiting in your email 📧",
    skip: isRtl ? "אחר כך" : "Maybe later",
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{
          background: "rgba(0,0,0,0.65)",
          backdropFilter: "blur(4px)",
          opacity: visible && !exiting ? 1 : 0,
          transition: "opacity 0.35s ease",
        }}
        onClick={handleDismiss}
      >
        {/* Modal */}
        <div
          className="relative w-full max-w-md rounded-3xl overflow-hidden"
          style={{
            background: "linear-gradient(160deg, #1e1b4b 0%, #312e81 45%, #4c1d95 100%)",
            border: "1px solid rgba(165,180,252,0.3)",
            boxShadow: "0 24px 64px rgba(99,102,241,0.5), 0 0 0 1px rgba(165,180,252,0.15)",
            transform: visible && !exiting ? "scale(1) translateY(0)" : "scale(0.92) translateY(24px)",
            transition: "transform 0.4s cubic-bezier(0.34,1.56,0.64,1), opacity 0.35s ease",
            opacity: visible && !exiting ? 1 : 0,
            maxHeight: "90vh",
            overflowY: "auto",
          }}
          onClick={(e) => e.stopPropagation()}
          dir={isRtl ? "rtl" : "ltr"}
        >
          {/* Confetti canvas */}
          <ConfettiCanvas />

          {/* Shimmer top bar */}
          <div
            style={{
              height: "4px",
              background: "linear-gradient(90deg, #818cf8, #a78bfa, #f472b6, #fbbf24, #34d399, #818cf8)",
              backgroundSize: "300% 100%",
              animation: "shimmerWelcome 2.5s linear infinite",
              position: "relative",
              zIndex: 1,
            }}
          />

          <style>{`
            @keyframes shimmerWelcome {
              0% { background-position: 300% 0 }
              100% { background-position: -300% 0 }
            }
            @keyframes bounceInWelcome {
              0% { transform: scale(0.4) rotate(-15deg); opacity: 0 }
              60% { transform: scale(1.2) rotate(5deg) }
              80% { transform: scale(0.95) rotate(-2deg) }
              100% { transform: scale(1) rotate(0deg); opacity: 1 }
            }
            @keyframes floatWelcome {
              0%,100% { transform: translateY(0) rotate(0deg) }
              50% { transform: translateY(-6px) rotate(3deg) }
            }
            @keyframes pulseGlow {
              0%,100% { box-shadow: 0 0 0 0 rgba(165,180,252,0.4) }
              50% { box-shadow: 0 0 0 8px rgba(165,180,252,0) }
            }
          `}</style>

          {/* Close button */}
          <button
            onClick={handleDismiss}
            className="absolute top-4 end-4 z-10 w-8 h-8 rounded-full flex items-center justify-center text-indigo-300 hover:text-white hover:bg-white/15 transition-all"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Content */}
          <div className="relative z-1 px-6 pt-6 pb-7" style={{ zIndex: 1 }}>
            {/* Big emoji */}
            <div
              className="text-5xl text-center mb-4"
              style={{
                animation: visible ? "bounceInWelcome 0.7s cubic-bezier(0.34,1.56,0.64,1) 0.15s both, floatWelcome 3s ease-in-out 1s infinite" : "none",
                display: "block",
              }}
            >
              🎉
            </div>

            {/* Greeting */}
            <h2 className="text-white font-extrabold text-xl text-center leading-tight mb-1">
              {t.greeting}
            </h2>
            <p className="text-indigo-200 text-sm text-center leading-relaxed mb-4">
              {t.subtitle}
            </p>

            {/* Credits badge */}
            <div
              className="flex items-center justify-center gap-2 mb-5"
            >
              <div
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold"
                style={{
                  background: "linear-gradient(135deg, rgba(251,191,36,0.2), rgba(245,158,11,0.15))",
                  border: "1px solid rgba(251,191,36,0.4)",
                  color: "#fde68a",
                  animation: "pulseGlow 2s ease-in-out infinite",
                }}
              >
                <span>🪙</span>
                <span>{t.credits}</span>
              </div>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px" style={{ background: "rgba(165,180,252,0.2)" }} />
              <p className="text-white font-bold text-base shrink-0">{t.question}</p>
              <div className="flex-1 h-px" style={{ background: "rgba(165,180,252,0.2)" }} />
            </div>

            {/* Feature buttons */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              {FEATURES.map((f) => (
                <button
                  key={f.tab}
                  onClick={() => handleFeature(f.tab)}
                  className="flex flex-col items-center gap-2 p-4 rounded-2xl text-white font-bold text-sm transition-all hover:scale-105 active:scale-95 relative overflow-hidden"
                  style={{
                    background: selectedTab === f.tab
                      ? f.gradient
                      : "rgba(255,255,255,0.08)",
                    border: selectedTab === f.tab
                      ? "2px solid rgba(255,255,255,0.4)"
                      : "1.5px solid rgba(165,180,252,0.2)",
                    boxShadow: selectedTab === f.tab
                      ? "0 4px 16px rgba(0,0,0,0.3)"
                      : "none",
                    transition: "all 0.2s cubic-bezier(0.34,1.56,0.64,1)",
                  }}
                >
                  {/* Gradient overlay on hover */}
                  <div
                    className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity rounded-2xl"
                    style={{ background: f.gradient }}
                  />
                  <span className="text-2xl relative z-10">{f.emoji}</span>
                  <span className="relative z-10 text-xs font-bold text-center leading-tight">
                    {isRtl ? f.labelHe : f.labelEn}
                  </span>
                </button>
              ))}
            </div>

            {/* Bonus hint */}
            <div
              className="rounded-xl px-4 py-3 flex items-start gap-2 mb-4"
              style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(165,180,252,0.15)" }}
            >
              <span className="text-base shrink-0">📧</span>
              <p className="text-indigo-200 text-xs leading-relaxed">{t.bonusHint}</p>
            </div>

            {/* Skip */}
            <button
              onClick={handleDismiss}
              className="w-full text-indigo-300 hover:text-white text-xs py-1.5 transition-colors"
            >
              {t.skip}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

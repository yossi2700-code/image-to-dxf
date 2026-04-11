/**
 * BuyDesignPreview — shows 3 design options for the Buy page
 * Route: /buy-design-preview (temporary, for user selection only)
 */
import { useState } from "react";
import { Check, Zap, Star, Shield, Clock, ArrowRight, Sparkles, Layers, ChevronRight } from "lucide-react";

// ─── Shared data ──────────────────────────────────────────────────────────────
const packages = [
  { id: 1, tokens: 50, price: 4.9, pricePerToken: "0.098", label: "מתחיל", color: "#6366f1" },
  { id: 2, tokens: 150, price: 9.9, pricePerToken: "0.066", label: "פופולרי", popular: true, color: "#8b5cf6" },
  { id: 3, tokens: 400, price: 19.9, pricePerToken: "0.050", label: "מקצועי", color: "#7c3aed" },
];

// ─── Design 1: Dark Gradient Premium ─────────────────────────────────────────
function Design1({ selected, onSelect }: { selected: boolean; onSelect: () => void }) {
  const [pkg, setPkg] = useState(2);
  return (
    <div
      className="rounded-2xl overflow-hidden cursor-pointer transition-all"
      style={{
        border: selected ? "3px solid #6366f1" : "3px solid transparent",
        boxShadow: selected ? "0 0 0 4px rgba(99,102,241,0.2)" : "0 4px 24px rgba(0,0,0,0.12)",
        transform: selected ? "scale(1.01)" : "scale(1)",
      }}
      onClick={onSelect}
    >
      {/* Design label */}
      <div className="flex items-center justify-between px-4 py-2.5" style={{ background: "#1e1b4b" }}>
        <span className="text-white font-bold text-sm">עיצוב 1 — כהה פרימיום</span>
        {selected && <div className="w-5 h-5 rounded-full bg-indigo-400 flex items-center justify-center"><Check className="w-3 h-3 text-white" /></div>}
      </div>

      {/* Page mockup */}
      <div style={{ background: "linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)", padding: "20px 16px" }}>
        {/* Header */}
        <div className="text-center mb-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full mb-2" style={{ background: "rgba(99,102,241,0.2)", border: "1px solid rgba(99,102,241,0.4)" }}>
            <Sparkles className="w-3 h-3 text-indigo-300" />
            <span className="text-indigo-300 text-xs font-medium">אסימוני DXF AI</span>
          </div>
          <h2 className="text-white font-bold text-lg mb-1">בחר חבילת אסימונים</h2>
          <p className="text-gray-400 text-xs">כל אסימון = המרה אחת מלאה</p>
        </div>

        {/* Package cards */}
        <div className="space-y-2 mb-4">
          {packages.map((p) => (
            <div
              key={p.id}
              onClick={(e) => { e.stopPropagation(); setPkg(p.id); }}
              className="rounded-xl p-3 flex items-center justify-between transition-all"
              style={{
                background: pkg === p.id ? "rgba(99,102,241,0.15)" : "rgba(255,255,255,0.04)",
                border: pkg === p.id ? "1.5px solid #6366f1" : "1.5px solid rgba(255,255,255,0.08)",
                cursor: "pointer",
              }}
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold" style={{ background: pkg === p.id ? "#6366f1" : "rgba(255,255,255,0.08)", color: pkg === p.id ? "white" : "#9ca3af" }}>
                  {p.tokens}
                </div>
                <div>
                  <div className="text-white text-xs font-semibold">{p.tokens} אסימונים</div>
                  <div className="text-gray-500 text-xs">${p.pricePerToken} לאסימון</div>
                </div>
              </div>
              <div className="text-right">
                {p.popular && <div className="text-xs font-bold mb-0.5" style={{ color: "#a78bfa" }}>⭐ הכי פופולרי</div>}
                <div className="text-white font-bold text-sm">${p.price}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Pay button */}
        <button className="w-full py-3 rounded-xl font-bold text-white text-sm flex items-center justify-center gap-2" style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)", boxShadow: "0 4px 20px rgba(99,102,241,0.5)" }}>
          <span>שלם עם PayPal</span>
          <ArrowRight className="w-4 h-4" />
        </button>

        {/* Trust badges */}
        <div className="flex justify-center gap-4 mt-3">
          {[["🔒", "מאובטח"], ["⚡", "מיידי"], ["♾️", "ללא תפוגה"]].map(([icon, label]) => (
            <div key={label} className="flex items-center gap-1">
              <span className="text-xs">{icon}</span>
              <span className="text-gray-500 text-xs">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Design 2: Clean White Minimal ───────────────────────────────────────────
function Design2({ selected, onSelect }: { selected: boolean; onSelect: () => void }) {
  const [pkg, setPkg] = useState(2);
  return (
    <div
      className="rounded-2xl overflow-hidden cursor-pointer transition-all"
      style={{
        border: selected ? "3px solid #6366f1" : "3px solid transparent",
        boxShadow: selected ? "0 0 0 4px rgba(99,102,241,0.2)" : "0 4px 24px rgba(0,0,0,0.12)",
        transform: selected ? "scale(1.01)" : "scale(1)",
      }}
      onClick={onSelect}
    >
      {/* Design label */}
      <div className="flex items-center justify-between px-4 py-2.5" style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
        <span className="text-gray-800 font-bold text-sm">עיצוב 2 — לבן מינימליסטי</span>
        {selected && <div className="w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center"><Check className="w-3 h-3 text-white" /></div>}
      </div>

      {/* Page mockup */}
      <div style={{ background: "#ffffff", padding: "20px 16px" }}>
        {/* Header with icon */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-gray-900 font-bold text-base">רכישת אסימונים</h2>
            <p className="text-gray-400 text-xs">בחר חבילה מתאימה</p>
          </div>
        </div>

        {/* Package grid */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {packages.map((p) => (
            <div
              key={p.id}
              onClick={(e) => { e.stopPropagation(); setPkg(p.id); }}
              className="rounded-xl p-2.5 text-center transition-all relative"
              style={{
                background: pkg === p.id ? "#f5f3ff" : "#f8fafc",
                border: pkg === p.id ? "2px solid #6366f1" : "2px solid #e2e8f0",
                cursor: "pointer",
              }}
            >
              {p.popular && (
                <div className="absolute -top-2 left-1/2 -translate-x-1/2 text-xs font-bold px-1.5 py-0.5 rounded-full" style={{ background: "#6366f1", color: "white", fontSize: "9px" }}>
                  פופולרי
                </div>
              )}
              <div className="text-lg font-black" style={{ color: pkg === p.id ? "#6366f1" : "#374151" }}>{p.tokens}</div>
              <div className="text-gray-400 text-xs">אסימונים</div>
              <div className="font-bold text-sm mt-1" style={{ color: "#111827" }}>${p.price}</div>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="rounded-xl p-3 mb-3" style={{ background: "#f5f3ff", border: "1px solid #e0e7ff" }}>
          <div className="flex justify-between items-center">
            <span className="text-gray-600 text-xs">סה"כ לתשלום</span>
            <span className="font-bold text-gray-900">${packages.find(p => p.id === pkg)?.price}</span>
          </div>
        </div>

        {/* Pay button */}
        <button className="w-full py-2.5 rounded-xl font-bold text-white text-sm" style={{ background: "#0070ba" }}>
          שלם עם PayPal
        </button>

        {/* Features */}
        <div className="mt-3 space-y-1.5">
          {["אסימונים לא פגים", "תמיכה בכל הפיצ'רים", "תשלום מאובטח"].map(f => (
            <div key={f} className="flex items-center gap-2">
              <Check className="w-3 h-3 text-green-500 shrink-0" />
              <span className="text-gray-500 text-xs">{f}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Design 3: Vibrant Card Pricing ──────────────────────────────────────────
function Design3({ selected, onSelect }: { selected: boolean; onSelect: () => void }) {
  const [pkg, setPkg] = useState(2);
  return (
    <div
      className="rounded-2xl overflow-hidden cursor-pointer transition-all"
      style={{
        border: selected ? "3px solid #6366f1" : "3px solid transparent",
        boxShadow: selected ? "0 0 0 4px rgba(99,102,241,0.2)" : "0 4px 24px rgba(0,0,0,0.12)",
        transform: selected ? "scale(1.01)" : "scale(1)",
      }}
      onClick={onSelect}
    >
      {/* Design label */}
      <div className="flex items-center justify-between px-4 py-2.5" style={{ background: "#1a1a2e", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <span className="text-white font-bold text-sm">עיצוב 3 — כרטיסים צבעוניים</span>
        {selected && <div className="w-5 h-5 rounded-full bg-indigo-400 flex items-center justify-center"><Check className="w-3 h-3 text-white" /></div>}
      </div>

      {/* Page mockup */}
      <div style={{ background: "#0f0f1a", padding: "20px 16px" }}>
        {/* Header */}
        <div className="text-center mb-4">
          <h2 className="font-black text-lg mb-1" style={{ background: "linear-gradient(135deg, #a78bfa, #60a5fa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            בחר את החבילה שלך
          </h2>
          <p className="text-gray-500 text-xs">כל אסימון = המרה אחת</p>
        </div>

        {/* Package cards — horizontal scroll style */}
        <div className="space-y-2 mb-4">
          {packages.map((p, i) => {
            const gradients = [
              "linear-gradient(135deg, #1e3a5f, #1e40af)",
              "linear-gradient(135deg, #3b0764, #6d28d9)",
              "linear-gradient(135deg, #064e3b, #065f46)",
            ];
            const borders = ["#3b82f6", "#7c3aed", "#10b981"];
            return (
              <div
                key={p.id}
                onClick={(e) => { e.stopPropagation(); setPkg(p.id); }}
                className="rounded-xl p-3 flex items-center justify-between transition-all"
                style={{
                  background: pkg === p.id ? gradients[i] : "rgba(255,255,255,0.03)",
                  border: `1.5px solid ${pkg === p.id ? borders[i] : "rgba(255,255,255,0.06)"}`,
                  cursor: "pointer",
                }}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: pkg === p.id ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.05)" }}>
                    <Layers className="w-4 h-4" style={{ color: pkg === p.id ? "white" : "#6b7280" }} />
                  </div>
                  <div>
                    <div className="font-bold text-xs" style={{ color: pkg === p.id ? "white" : "#9ca3af" }}>{p.tokens} אסימונים</div>
                    <div className="text-xs" style={{ color: pkg === p.id ? "rgba(255,255,255,0.6)" : "#4b5563" }}>${p.pricePerToken} / אסימון</div>
                  </div>
                </div>
                <div className="text-right">
                  {p.popular && <div className="text-xs font-bold mb-0.5" style={{ color: "#c084fc" }}>✦ מומלץ</div>}
                  <div className="font-black text-sm" style={{ color: pkg === p.id ? "white" : "#6b7280" }}>${p.price}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Glowing pay button */}
        <button
          className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2"
          style={{
            background: "linear-gradient(135deg, #4f46e5, #7c3aed, #2563eb)",
            color: "white",
            boxShadow: "0 0 30px rgba(99,102,241,0.5), 0 4px 15px rgba(99,102,241,0.3)",
          }}
        >
          <span>שלם עם PayPal</span>
          <ChevronRight className="w-4 h-4" />
        </button>

        {/* Minimal badges */}
        <div className="flex justify-center gap-3 mt-3">
          {[["🔐", "SSL"], ["⚡", "מיידי"], ["∞", "ללא תפוגה"]].map(([icon, label]) => (
            <div key={label} className="flex items-center gap-1 px-2 py-1 rounded-lg" style={{ background: "rgba(255,255,255,0.04)" }}>
              <span className="text-xs">{icon}</span>
              <span className="text-gray-500 text-xs">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main Preview Page ────────────────────────────────────────────────────────
export default function BuyDesignPreview() {
  const [selected, setSelected] = useState<1 | 2 | 3 | null>(null);

  return (
    <div className="min-h-screen" style={{ background: "#f1f5f9" }}>
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-black text-gray-900 mb-2">בחר עיצוב לדף הרכישות</h1>
          <p className="text-gray-500 text-sm">לחץ על עיצוב לבחור אותו, לאחר מכן ספר לי מה בחרת</p>
        </div>

        {/* 3 designs */}
        <div className="space-y-6">
          <Design1 selected={selected === 1} onSelect={() => setSelected(1)} />
          <Design2 selected={selected === 2} onSelect={() => setSelected(2)} />
          <Design3 selected={selected === 3} onSelect={() => setSelected(3)} />
        </div>

        {/* Selection indicator */}
        {selected && (
          <div className="mt-6 p-4 rounded-2xl text-center" style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "white" }}>
            <div className="font-bold text-lg">✅ בחרת עיצוב {selected}</div>
            <div className="text-sm opacity-80 mt-1">ספר לי ואיישם אותו על הדף האמיתי</div>
          </div>
        )}
      </div>
    </div>
  );
}

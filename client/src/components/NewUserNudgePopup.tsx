/**
 * NewUserNudgePopup — auto-shows after 8 seconds for logged-in users
 * who still have their full 10 token balance (never converted anything).
 *
 * Dismissed via localStorage key "nudge_popup_dismissed_v1".
 * Clicking a CTA scrolls to the relevant feature tab and activates it.
 */
import { useState, useEffect } from "react";
import { X, Sparkles, Upload, User } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const STORAGE_KEY = "nudge_popup_dismissed_v1";
const DELAY_MS = 6000;

interface NewUserNudgePopupProps {
  hasAnyAction: boolean;
  onSelectTab: (tab: string) => void;
}

export function NewUserNudgePopup({ hasAnyAction, onSelectTab }: NewUserNudgePopupProps) {
  const { isRtl } = useLanguage();
  const [visible, setVisible] = useState(false);
  const [animIn, setAnimIn] = useState(false);

  useEffect(() => {
    // Only show if user has never performed any action and hasn't dismissed before
    if (hasAnyAction) return;
    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (dismissed) return;

    const timer = setTimeout(() => {
      setVisible(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setAnimIn(true));
      });
    }, DELAY_MS);

    return () => clearTimeout(timer);
  }, [hasAnyAction]);

  function dismiss() {
    setAnimIn(false);
    setTimeout(() => setVisible(false), 350);
    localStorage.setItem(STORAGE_KEY, "1");
  }

  function handleCta(tab: string) {
    dismiss();
    onSelectTab(tab);
    setTimeout(() => {
      document.getElementById("main-tabs")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  }

  if (!visible) return null;

  const isHe = isRtl;

  return (
    <div
      dir={isHe ? "rtl" : "ltr"}
      style={{
        position: "fixed",
        bottom: 24,
        ...(isHe ? { right: 16 } : { left: 16 }),
        zIndex: 9999,
        maxWidth: 340,
        width: "calc(100vw - 32px)",
        background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 60%, #4c1d95 100%)",
        borderRadius: 20,
        boxShadow: "0 8px 40px rgba(99,102,241,0.45), 0 2px 12px rgba(0,0,0,0.3)",
        padding: "20px 18px 18px",
        color: "white",
        transition: "opacity 0.35s ease, transform 0.35s cubic-bezier(0.34,1.56,0.64,1)",
        opacity: animIn ? 1 : 0,
        transform: animIn ? "translateY(0) scale(1)" : "translateY(30px) scale(0.95)",
        pointerEvents: animIn ? "auto" : "none",
      }}
    >
      {/* Close button */}
      <button
        onClick={dismiss}
        style={{
          position: "absolute",
          top: 10,
          ...(isHe ? { left: 10 } : { right: 10 }),
          background: "rgba(255,255,255,0.12)",
          border: "none",
          borderRadius: "50%",
          width: 26,
          height: 26,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          color: "rgba(255,255,255,0.7)",
          transition: "background 0.2s",
        }}
        onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.22)")}
        onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.12)")}
        aria-label="Close"
      >
        <X size={14} />
      </button>

      {/* Token badge */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <div style={{
          background: "linear-gradient(135deg, #fbbf24, #f59e0b)",
          borderRadius: 10,
          padding: "4px 10px",
          fontSize: 12,
          fontWeight: 800,
          color: "#1e1b4b",
          display: "flex",
          alignItems: "center",
          gap: 4,
        }}>
          <Sparkles size={12} />
          {isHe ? "10 אסימונים חינם" : "10 free tokens"}
        </div>
      </div>

      {/* Headline */}
      <p style={{ fontSize: 16, fontWeight: 800, margin: "0 0 6px", lineHeight: 1.3, color: "white" }}>
        {isHe ? "יש לך 10 אסימונים — נסה עכשיו!" : "You have 10 tokens — try now!"}
      </p>
      <p style={{ fontSize: 12, color: "rgba(196,181,253,0.9)", margin: "0 0 14px", lineHeight: 1.5 }}>
        {isHe ? "בחר מה לנסות:" : "Choose what to try:"}
      </p>

      {/* CTA buttons */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {/* AI Create */}
        <button
          onClick={() => handleCta("ai")}
          style={{
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            border: "none",
            borderRadius: 12,
            padding: "10px 14px",
            color: "white",
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
            transition: "filter 0.2s, transform 0.15s",
            textAlign: isHe ? "right" : "left",
          }}
          onMouseEnter={e => { e.currentTarget.style.filter = "brightness(1.12)"; e.currentTarget.style.transform = "scale(1.02)"; }}
          onMouseLeave={e => { e.currentTarget.style.filter = "brightness(1)"; e.currentTarget.style.transform = "scale(1)"; }}
        >
          <Sparkles size={15} style={{ flexShrink: 0 }} />
          <div>
            <div>{isHe ? "AI יצירה — כתוב תיאור" : "AI Create — type a description"}</div>
            <div style={{ fontSize: 10, fontWeight: 400, opacity: 0.8 }}>
              {isHe ? "ה-AI יצייר עיצוב לחריטה" : "AI draws a design for engraving"}
            </div>
          </div>
        </button>

        {/* AI Outline */}
        <button
          onClick={() => handleCta("trace")}
          style={{
            background: "linear-gradient(135deg, #0d9488, #06b6d4)",
            border: "none",
            borderRadius: 12,
            padding: "10px 14px",
            color: "white",
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
            transition: "filter 0.2s, transform 0.15s",
            textAlign: isHe ? "right" : "left",
          }}
          onMouseEnter={e => { e.currentTarget.style.filter = "brightness(1.12)"; e.currentTarget.style.transform = "scale(1.02)"; }}
          onMouseLeave={e => { e.currentTarget.style.filter = "brightness(1)"; e.currentTarget.style.transform = "scale(1)"; }}
        >
          <Upload size={15} style={{ flexShrink: 0 }} />
          <div>
            <div>{isHe ? "AI Outline — העלה תמונה" : "AI Outline — upload a photo"}</div>
            <div style={{ fontSize: 10, fontWeight: 400, opacity: 0.8 }}>
              {isHe ? "ה-AI יהפוך אותה לקווי וקטור" : "AI converts it to vector lines"}
            </div>
          </div>
        </button>

        {/* Portrait */}
        <button
          onClick={() => handleCta("face")}
          style={{
            background: "linear-gradient(135deg, #7c3aed, #a855f7)",
            border: "none",
            borderRadius: 12,
            padding: "10px 14px",
            color: "white",
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
            transition: "filter 0.2s, transform 0.15s",
            textAlign: isHe ? "right" : "left",
          }}
          onMouseEnter={e => { e.currentTarget.style.filter = "brightness(1.12)"; e.currentTarget.style.transform = "scale(1.02)"; }}
          onMouseLeave={e => { e.currentTarget.style.filter = "brightness(1)"; e.currentTarget.style.transform = "scale(1)"; }}
        >
          <User size={15} style={{ flexShrink: 0 }} />
          <div>
            <div>{isHe ? "Portrait — העלה תמונת פנים" : "Portrait — upload a face photo"}</div>
            <div style={{ fontSize: 10, fontWeight: 400, opacity: 0.8 }}>
              {isHe ? "3 פורטרטים בסגנונות שונים" : "3 portrait styles"}
            </div>
          </div>
        </button>
      </div>

      {/* Footer note */}
      <p style={{ fontSize: 10, color: "rgba(196,181,253,0.6)", margin: "12px 0 0", textAlign: "center" }}>
        {isHe ? "האסימונים לא פגים — השתמש בהם מתי שתרצה" : "Tokens never expire — use them whenever you want"}
      </p>
    </div>
  );
}

export default NewUserNudgePopup;

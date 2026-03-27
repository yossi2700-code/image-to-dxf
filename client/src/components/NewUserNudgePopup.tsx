/**
 * NewUserNudgePopup — auto-shows after 6 seconds for logged-in users
 * who have never performed any action (server-side hasAnyAction check).
 *
 * Shows on EVERY login session until user performs 1 action.
 * No localStorage — controlled entirely by server-side hasAnyAction.
 *
 * Mobile: centered on screen, smaller size.
 * Desktop: bottom corner.
 *
 * FIX: Uses a ref to ensure the 6-second timer fires only ONCE per session,
 * regardless of how many times tokenData is re-fetched (every 30s).
 */
import { useState, useEffect, useRef } from "react";
import { X, Sparkles, Upload, User } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const DELAY_MS = 2000;

interface NewUserNudgePopupProps {
  hasAnyAction: boolean;
  hasPendingWelcomeBonus?: boolean;
  onSelectTab: (tab: string) => void;
}

export function NewUserNudgePopup({ hasAnyAction, hasPendingWelcomeBonus, onSelectTab }: NewUserNudgePopupProps) {
  const { isRtl } = useLanguage();
  const [visible, setVisible] = useState(false);
  const [animIn, setAnimIn] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  // Track whether the timer has already been scheduled this session
  const timerScheduled = useRef(false);
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 640px)").matches : false
  );

  // Track mobile breakpoint changes
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Schedule the popup timer ONCE when we first learn the user has no actions.
  // The `tokenData` query refetches every 30s — without the ref guard, every
  // refetch would re-run this effect and re-schedule the timer, causing the
  // popup to reappear after being dismissed.
  useEffect(() => {
    // If user already did an action, or was dismissed, or timer already scheduled — skip
    if (hasAnyAction || dismissed || timerScheduled.current) return;

    // Mark as scheduled so subsequent refetches don't re-trigger
    timerScheduled.current = true;

    const timer = setTimeout(() => {
      // Double-check: user may have acted during the 6-second wait
      setVisible(prev => {
        if (dismissed) return prev;
        return true;
      });
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setAnimIn(true));
      });
    }, DELAY_MS);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasAnyAction]); // only depends on hasAnyAction — not dismissed, so refetches don't re-fire

  // Hide immediately if user performs an action mid-session
  useEffect(() => {
    if (hasAnyAction && visible) {
      setAnimIn(false);
      setTimeout(() => setVisible(false), 350);
    }
  }, [hasAnyAction, visible]);

  function dismiss() {
    setAnimIn(false);
    setTimeout(() => setVisible(false), 350);
    setDismissed(true); // session-only dismiss
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

  // Mobile: centered vertically & horizontally, smaller
  // Desktop: bottom corner (RTL: right, LTR: left)
  const mobileStyle = {
    bottom: "50%",
    left: "50%",
    transform: animIn
      ? "translate(-50%, 50%) scale(1)"
      : "translate(-50%, 50%) scale(0.9)",
    maxWidth: 290,
    width: "calc(100vw - 40px)",
    padding: "14px 12px 12px",
  };

  const desktopStyle = {
    bottom: 24,
    ...(isHe ? { right: 16 } : { left: 16 }),
    transform: animIn ? "translateY(0) scale(1)" : "translateY(30px) scale(0.95)",
    maxWidth: 340,
    width: "calc(100vw - 32px)",
    padding: "20px 18px 18px",
  };

  const posStyle = isMobile ? mobileStyle : desktopStyle;

  return (
    <div
      dir={isHe ? "rtl" : "ltr"}
      style={{
        position: "fixed",
        zIndex: 9999,
        ...posStyle,
        background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 60%, #4c1d95 100%)",
        borderRadius: 20,
        boxShadow: "0 8px 40px rgba(99,102,241,0.45), 0 2px 12px rgba(0,0,0,0.3)",
        color: "white",
        transition: "opacity 0.35s ease, transform 0.35s cubic-bezier(0.34,1.56,0.64,1)",
        opacity: animIn ? 1 : 0,
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
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <div style={{
          background: "linear-gradient(135deg, #fbbf24, #f59e0b)",
          borderRadius: 10,
          padding: "3px 9px",
          fontSize: 11,
          fontWeight: 800,
          color: "#1e1b4b",
          display: "flex",
          alignItems: "center",
          gap: 4,
        }}>
          <Sparkles size={11} />
          {isHe ? "אסימונים חינם" : "Free tokens"}
        </div>
      </div>

      {/* Headline */}
      <p style={{ fontSize: isMobile ? 14 : 16, fontWeight: 800, margin: "0 0 4px", lineHeight: 1.3, color: "white" }}>
        {isHe ? "יש לך אסימונים — נסה עכשיו!" : "You have tokens — try now!"}
      </p>
      <p style={{ fontSize: 11, color: "rgba(196,181,253,0.9)", margin: "0 0 10px", lineHeight: 1.5 }}>
        {isHe ? "בחר מה לנסות:" : "Choose what to try:"}
      </p>

      {/* CTA buttons */}
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {/* AI Create */}
        <button
          onClick={() => handleCta("ai")}
          style={{
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            border: "none",
            borderRadius: 11,
            padding: isMobile ? "8px 12px" : "10px 14px",
            color: "white",
            fontSize: isMobile ? 12 : 13,
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
          <Sparkles size={14} style={{ flexShrink: 0 }} />
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
            borderRadius: 11,
            padding: isMobile ? "8px 12px" : "10px 14px",
            color: "white",
            fontSize: isMobile ? 12 : 13,
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
          <Upload size={14} style={{ flexShrink: 0 }} />
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
            borderRadius: 11,
            padding: isMobile ? "8px 12px" : "10px 14px",
            color: "white",
            fontSize: isMobile ? 12 : 13,
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
          <User size={14} style={{ flexShrink: 0 }} />
          <div>
            <div>{isHe ? "Portrait — העלה תמונת פנים" : "Portrait — upload a face photo"}</div>
            <div style={{ fontSize: 10, fontWeight: 400, opacity: 0.8 }}>
              {isHe ? "3 פורטרטים בסגנונות שונים" : "3 portrait styles"}
            </div>
          </div>
        </button>
      </div>

      {/* Email bonus hint */}
      {hasPendingWelcomeBonus && (
        <p style={{ fontSize: 10, color: "rgba(251,191,36,0.85)", margin: "8px 0 0", textAlign: "center", lineHeight: 1.4 }}>
          📧 {isHe ? "בדוק במייל — מחכים לך עוד 20 אסימונים" : "Check your email — 20 more tokens waiting"}
        </p>
      )}
      {/* Footer note */}
      <p style={{ fontSize: 10, color: "rgba(196,181,253,0.6)", margin: "5px 0 0", textAlign: "center" }}>
        {isHe ? "האסימונים לא פגים — השתמש בהם מתי שתרצה" : "Tokens never expire — use them whenever you want"}
      </p>
    </div>
  );
}

export default NewUserNudgePopup;

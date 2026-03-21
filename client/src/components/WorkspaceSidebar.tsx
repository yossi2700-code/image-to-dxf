import React from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Sparkles,
  Scan,
  FileEdit,
  UserCircle,
  Mountain,
  History,
  CreditCard,
  LogOut,
  User,
  ChevronDown,
  X,
} from "lucide-react";

export type WorkspaceTab = "ai" | "trace" | "redraw" | "face" | "cnc-relief";

interface NavItem {
  id: WorkspaceTab;
  labelKey: string;
  labelFallback: string;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  disabled?: boolean;
  comingSoon?: boolean;
  hasJob?: boolean;
}

interface WorkspaceSidebarProps {
  activeTab: WorkspaceTab;
  onTabChange: (tab: WorkspaceTab) => void;
  appUser: { name?: string; email: string } | null;
  tokenBalance: number | null;
  hasPendingWelcomeBonus?: boolean;
  onOpenPricing: () => void;
  onOpenTokenHistory: () => void;
  onLogout: () => void;
  onOpenAuth: () => void;
  activeJobs?: { generate?: boolean; trace?: boolean; face?: boolean };
  children: React.ReactNode;
}

export function WorkspaceSidebar({
  activeTab,
  onTabChange,
  appUser,
  tokenBalance,
  hasPendingWelcomeBonus,
  onOpenPricing,
  onOpenTokenHistory,
  onLogout,
  onOpenAuth,
  activeJobs = {},
  children,
}: WorkspaceSidebarProps) {
  const { t, isRtl } = useLanguage();

  const navItems: NavItem[] = [
    {
      id: "ai",
      labelKey: "aiCreate",
      labelFallback: "AI Create",
      icon: <Sparkles className="w-4 h-4" />,
      iconBg: "#ede9fe",
      iconColor: "#6366f1",
      hasJob: activeJobs.generate,
    },
    {
      id: "trace",
      labelKey: "aiOutline",
      labelFallback: "AI Outline",
      icon: <Scan className="w-4 h-4" />,
      iconBg: "#ccfbf1",
      iconColor: "#0d9488",
      hasJob: activeJobs.trace,
    },
    {
      id: "redraw",
      labelKey: "aiSketch",
      labelFallback: "AI Sketch",
      icon: <FileEdit className="w-4 h-4" />,
      iconBg: "#fef3c7",
      iconColor: "#d97706",
      disabled: true,
      comingSoon: true,
    },
    {
      id: "face",
      labelKey: "portrait",
      labelFallback: "Portrait",
      icon: <UserCircle className="w-4 h-4" />,
      iconBg: "#f3e8ff",
      iconColor: "#7c3aed",
      hasJob: activeJobs.face,
    },
    {
      id: "cnc-relief",
      labelKey: "cncReliefTabLabel",
      labelFallback: "CNC Relief",
      icon: <Mountain className="w-4 h-4" />,
      iconBg: "#fef3c7",
      iconColor: "#b45309",
      disabled: true,
      comingSoon: true,
    },
  ];

  const userInitial = appUser
    ? (appUser.name || appUser.email || "?").charAt(0).toUpperCase()
    : "?";
  const userName = appUser
    ? appUser.name || appUser.email.split("@")[0]
    : "";

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "#f8faff" }}
      dir={isRtl ? "rtl" : "ltr"}
    >
      {/* ── DESKTOP LAYOUT: flex row ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ══ SIDEBAR (hidden on mobile) ══ */}
        <aside
          className="hidden md:flex flex-col shrink-0"
          style={{
            width: 240,
            background: "white",
            borderRight: isRtl ? "none" : "1.5px solid #e2e8f0",
            borderLeft: isRtl ? "1.5px solid #e2e8f0" : "none",
            minHeight: "100vh",
            position: "sticky",
            top: 0,
            height: "100vh",
            overflowY: "auto",
          }}
        >
          {/* Logo */}
          <div
            style={{
              padding: "18px 16px 14px",
              borderBottom: "1.5px solid #f1f5f9",
            }}
          >
            <a
              href="/landing"
              style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 10 }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 4px 12px rgba(99,102,241,0.3)",
                  flexShrink: 0,
                }}
              >
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                  <path d="M4 16 Q7 7 10 10 Q13 13 16 4" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none"/>
                  <circle cx="4" cy="16" r="1.8" fill="#06b6d4"/>
                  <circle cx="10" cy="10" r="1.8" fill="white"/>
                  <circle cx="16" cy="4" r="1.8" fill="#06b6d4"/>
                </svg>
              </div>
              <div>
                <div style={{ fontSize: "1.05rem", fontWeight: 800, color: "#1e293b", letterSpacing: "-0.02em", lineHeight: 1.2 }}>
                  <span style={{ color: "#6366f1" }}>Ai</span>DXF
                </div>
                <div style={{ fontSize: "0.65rem", color: "#94a3b8", fontWeight: 500, marginTop: 1 }}>
                  {isRtl ? "סטודיו וקטורי AI" : "AI Vector Studio"}
                </div>
              </div>
            </a>
          </div>

          {/* Nav items */}
          <nav style={{ flex: 1, padding: "12px 10px" }}>
            <div
              style={{
                fontSize: "0.62rem",
                fontWeight: 700,
                color: "#94a3b8",
                letterSpacing: "0.12em",
                padding: "0 8px",
                marginBottom: 8,
              }}
            >
              {isRtl ? "כלים" : "TOOLS"}
            </div>

            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    if (!item.disabled) {
                      onTabChange(item.id);
                      localStorage.setItem("active_tab", item.id);
                    }
                  }}
                  disabled={item.disabled}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    width: "100%",
                    padding: "9px 10px",
                    borderRadius: 10,
                    border: isActive ? `1.5px solid ${item.iconColor}22` : "1.5px solid transparent",
                    background: isActive ? `${item.iconColor}12` : "transparent",
                    color: isActive ? item.iconColor : item.disabled ? "#cbd5e1" : "#64748b",
                    fontWeight: isActive ? 700 : 500,
                    fontSize: "0.83rem",
                    cursor: item.disabled ? "not-allowed" : "pointer",
                    marginBottom: 3,
                    textAlign: isRtl ? "right" : "left",
                    opacity: item.disabled ? 0.6 : 1,
                    transition: "all 0.15s",
                    position: "relative",
                  }}
                  onMouseEnter={(e) => {
                    if (!item.disabled && !isActive) {
                      (e.currentTarget as HTMLButtonElement).style.background = "#f8faff";
                      (e.currentTarget as HTMLButtonElement).style.color = "#334155";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!item.disabled && !isActive) {
                      (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                      (e.currentTarget as HTMLButtonElement).style.color = "#64748b";
                    }
                  }}
                >
                  {/* Icon box */}
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: isActive ? item.iconBg : "#f1f5f9",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: isActive ? item.iconColor : "#94a3b8",
                      flexShrink: 0,
                      transition: "all 0.15s",
                    }}
                  >
                    {item.icon}
                  </div>

                  <span style={{ flex: 1 }}>
                    {t(item.labelKey as Parameters<typeof t>[0]) || item.labelFallback}
                  </span>

                  {/* Coming soon badge */}
                  {item.comingSoon && (
                    <span
                      style={{
                        fontSize: "0.6rem",
                        fontWeight: 700,
                        padding: "2px 6px",
                        borderRadius: 8,
                        background: "#fef3c7",
                        color: "#92400e",
                        border: "1px solid #fde68a",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {isRtl ? "בקרוב" : "Soon"}
                    </span>
                  )}

                  {/* Active job dot */}
                  {item.hasJob && (
                    <span style={{ display: "flex", width: 8, height: 8, flexShrink: 0 }}>
                      <span
                        style={{
                          display: "inline-flex",
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: "#f59e0b",
                          animation: "ping 1s cubic-bezier(0,0,0.2,1) infinite",
                        }}
                      />
                    </span>
                  )}
                </button>
              );
            })}

            {/* Divider */}
            <div style={{ height: 1, background: "#f1f5f9", margin: "10px 8px" }} />

            {/* Account links */}
            <div
              style={{
                fontSize: "0.62rem",
                fontWeight: 700,
                color: "#94a3b8",
                letterSpacing: "0.12em",
                padding: "0 8px",
                marginBottom: 8,
              }}
            >
              {isRtl ? "חשבון" : "ACCOUNT"}
            </div>

            <button
              onClick={() => { window.location.href = "/history"; }}
              style={{
                display: "flex", alignItems: "center", gap: 10, width: "100%",
                padding: "9px 10px", borderRadius: 10, border: "1.5px solid transparent",
                background: "transparent", color: "#64748b", fontWeight: 500,
                fontSize: "0.83rem", cursor: "pointer", marginBottom: 3,
                textAlign: isRtl ? "right" : "left",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#f8faff"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
            >
              <div style={{ width: 32, height: 32, borderRadius: 8, background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", flexShrink: 0 }}>
                <History className="w-4 h-4" />
              </div>
              <span>{isRtl ? "היסטוריה" : "History"}</span>
            </button>

            <button
              onClick={onOpenPricing}
              style={{
                display: "flex", alignItems: "center", gap: 10, width: "100%",
                padding: "9px 10px", borderRadius: 10, border: "1.5px solid transparent",
                background: "transparent", color: "#64748b", fontWeight: 500,
                fontSize: "0.83rem", cursor: "pointer", marginBottom: 3,
                textAlign: isRtl ? "right" : "left",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#f8faff"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
            >
              <div style={{ width: 32, height: 32, borderRadius: 8, background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", flexShrink: 0 }}>
                <CreditCard className="w-4 h-4" />
              </div>
              <span>{isRtl ? "מחירון" : "Pricing"}</span>
            </button>
          </nav>

          {/* Token card + user at bottom */}
          <div style={{ padding: "12px 10px", borderTop: "1.5px solid #f1f5f9" }}>
            {/* Token card */}
            {appUser && (
              <button
                onClick={onOpenTokenHistory}
                style={{
                  width: "100%",
                  background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                  borderRadius: 10,
                  padding: "10px 14px",
                  marginBottom: 10,
                  border: "none",
                  cursor: "pointer",
                  textAlign: isRtl ? "right" : "left",
                  display: "block",
                }}
              >
                <div style={{ fontSize: "0.65rem", fontWeight: 600, color: "rgba(255,255,255,0.7)", marginBottom: 2 }}>
                  {isRtl ? "יתרת אסימונים" : "TOKEN BALANCE"}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: "1.3rem", fontWeight: 800, color: "white" }}>
                    {tokenBalance ?? "—"}
                  </span>
                  <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.8)", fontWeight: 600 }}>⚡</span>
                  {hasPendingWelcomeBonus && (
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#fbbf24", display: "inline-block", animation: "pulse 2s infinite" }} />
                  )}
                </div>
                <div style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.6)", marginTop: 2 }}>
                  {isRtl ? "לחץ לרכישה →" : "Click to buy more →"}
                </div>
              </button>
            )}

            {/* User row */}
            {appUser ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 9,
                  padding: "8px 10px",
                  borderRadius: 10,
                  background: "#f8faff",
                  border: "1.5px solid #e2e8f0",
                }}
              >
                <div
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "white",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {userInitial}
                </div>
                <div style={{ flex: 1, overflow: "hidden" }}>
                  <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "#334155", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {userName}
                  </div>
                </div>
                <button
                  onClick={onLogout}
                  title={isRtl ? "התנתק" : "Sign out"}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 7,
                    border: "none",
                    background: "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#94a3b8",
                    cursor: "pointer",
                    flexShrink: 0,
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#ef4444"; (e.currentTarget as HTMLButtonElement).style.background = "#fee2e2"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#94a3b8"; (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={onOpenAuth}
                style={{
                  width: "100%",
                  padding: "10px",
                  borderRadius: 10,
                  border: "none",
                  background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                  color: "white",
                  fontWeight: 700,
                  fontSize: "0.85rem",
                  cursor: "pointer",
                  boxShadow: "0 4px 14px rgba(99,102,241,0.3)",
                }}
              >
                {isRtl ? "התחבר / הרשם" : "Sign In / Register"}
              </button>
            )}
          </div>
        </aside>

        {/* ══ MAIN CONTENT ══ */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top bar (mobile: logo + user; desktop: breadcrumb + actions) */}
          <header
            style={{
              background: "rgba(255,255,255,0.97)",
              backdropFilter: "blur(8px)",
              borderBottom: "1.5px solid #e2e8f0",
              position: "sticky",
              top: 0,
              zIndex: 20,
            }}
          >
            {/* Mobile header */}
            <div
              className="flex md:hidden items-center justify-between"
              style={{ padding: "10px 14px" }}
            >
              <a href="/landing" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 8 }}>
                <div
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <svg width="15" height="15" viewBox="0 0 20 20" fill="none">
                    <path d="M4 16 Q7 7 10 10 Q13 13 16 4" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none"/>
                    <circle cx="4" cy="16" r="1.8" fill="#06b6d4"/>
                    <circle cx="10" cy="10" r="1.8" fill="white"/>
                    <circle cx="16" cy="4" r="1.8" fill="#06b6d4"/>
                  </svg>
                </div>
                <span style={{ fontSize: "1rem", fontWeight: 800, color: "#1e293b", letterSpacing: "-0.02em" }}>
                  <span style={{ color: "#6366f1" }}>Ai</span>DXF
                </span>
              </a>

              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {appUser ? (
                  <>
                    <button
                      onClick={onOpenTokenHistory}
                      style={{
                        display: "flex", alignItems: "center", gap: 5,
                        padding: "5px 10px", borderRadius: 20,
                        background: "#eef2ff", border: "1px solid #c7d2fe",
                        color: "#4338ca", fontSize: "0.75rem", fontWeight: 700, cursor: "pointer",
                      }}
                    >
                      ⚡ {tokenBalance ?? "—"}
                      {hasPendingWelcomeBonus && (
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#f59e0b", display: "inline-block" }} />
                      )}
                    </button>
                    <div
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: "50%",
                        background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "white",
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                      onClick={onLogout}
                      title={isRtl ? "התנתק" : "Sign out"}
                    >
                      {userInitial}
                    </div>
                  </>
                ) : (
                  <button
                    onClick={onOpenAuth}
                    style={{
                      padding: "6px 14px", borderRadius: 20, border: "none",
                      background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                      color: "white", fontWeight: 700, fontSize: "0.78rem", cursor: "pointer",
                    }}
                  >
                    {isRtl ? "התחבר" : "Sign In"}
                  </button>
                )}
              </div>
            </div>

            {/* Desktop header */}
            <div
              className="hidden md:flex items-center justify-between"
              style={{ padding: "10px 20px" }}
            >
              {/* Breadcrumb */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.78rem", color: "#94a3b8" }}>
                <span>{isRtl ? "סביבת עבודה" : "Workspace"}</span>
                <span>/</span>
                <span style={{ color: "#1e293b", fontWeight: 700 }}>
                  {navItems.find((n) => n.id === activeTab)?.labelFallback ?? activeTab}
                </span>
              </div>

              {/* Right: pricing + user */}
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button
                  onClick={onOpenPricing}
                  style={{
                    padding: "5px 12px", borderRadius: 8, border: "1px solid #c7d2fe",
                    background: "#eef2ff", color: "#6366f1", fontWeight: 600,
                    fontSize: "0.75rem", cursor: "pointer",
                  }}
                >
                  {isRtl ? "💎 מחירון" : "💎 Pricing"}
                </button>

                {appUser ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button
                      onClick={onOpenTokenHistory}
                      style={{
                        display: "flex", alignItems: "center", gap: 5,
                        padding: "5px 12px", borderRadius: 20,
                        background: "#eef2ff", border: "1px solid #c7d2fe",
                        color: "#4338ca", fontSize: "0.78rem", fontWeight: 700, cursor: "pointer",
                      }}
                    >
                      ⚡ {tokenBalance ?? "—"}
                      {hasPendingWelcomeBonus && (
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#f59e0b", display: "inline-block" }} />
                      )}
                    </button>
                    <div
                      style={{
                        display: "flex", alignItems: "center", gap: 8,
                        padding: "5px 12px 5px 5px",
                        background: "#f8faff", border: "1.5px solid #e2e8f0",
                        borderRadius: 20, cursor: "pointer",
                      }}
                      onClick={onLogout}
                      title={isRtl ? "התנתק" : "Sign out"}
                    >
                      <div
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: "50%",
                          background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "white",
                          fontSize: "0.72rem",
                          fontWeight: 700,
                        }}
                      >
                        {userInitial}
                      </div>
                      <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "#334155" }}>
                        {userName}
                      </span>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={onOpenAuth}
                    style={{
                      padding: "7px 16px", borderRadius: 20, border: "none",
                      background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                      color: "white", fontWeight: 700, fontSize: "0.82rem", cursor: "pointer",
                      boxShadow: "0 3px 10px rgba(99,102,241,0.35)",
                    }}
                  >
                    {isRtl ? "התחבר / הרשם" : "Sign In / Register"}
                  </button>
                )}
              </div>
            </div>
          </header>

          {/* Page content */}
          <main style={{ flex: 1, padding: "20px 20px 80px", maxWidth: 900, width: "100%", margin: "0 auto" }}>
            {children}
          </main>
        </div>
      </div>

      {/* ══ MOBILE BOTTOM TAB BAR ══ */}
      <nav
        className="flex md:hidden"
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          background: "white",
          borderTop: "1.5px solid #e2e8f0",
          zIndex: 30,
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        {navItems
          .filter((item) => !item.comingSoon) // show only active tools in tab bar
          .concat(navItems.filter((item) => item.comingSoon).slice(0, 1)) // + 1 coming soon as hint
          .slice(0, 4) // max 4 tabs
          .map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  if (!item.disabled) {
                    onTabChange(item.id);
                    localStorage.setItem("active_tab", item.id);
                  }
                }}
                disabled={item.disabled}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 3,
                  padding: "8px 4px 10px",
                  border: "none",
                  background: "transparent",
                  cursor: item.disabled ? "not-allowed" : "pointer",
                  opacity: item.disabled ? 0.5 : 1,
                  position: "relative",
                }}
              >
                {/* Active indicator line at top */}
                {isActive && (
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      left: "20%",
                      right: "20%",
                      height: 2.5,
                      borderRadius: "0 0 3px 3px",
                      background: item.iconColor,
                    }}
                  />
                )}

                {/* Icon */}
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 9,
                    background: isActive ? item.iconBg : "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: isActive ? item.iconColor : "#94a3b8",
                    transition: "all 0.15s",
                    position: "relative",
                  }}
                >
                  {item.icon}
                  {item.hasJob && (
                    <span
                      style={{
                        position: "absolute",
                        top: 2,
                        right: 2,
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: "#f59e0b",
                        border: "1.5px solid white",
                      }}
                    />
                  )}
                </div>

                {/* Label */}
                <span
                  style={{
                    fontSize: "0.6rem",
                    fontWeight: isActive ? 700 : 500,
                    color: isActive ? item.iconColor : "#94a3b8",
                    lineHeight: 1,
                  }}
                >
                  {item.comingSoon
                    ? (isRtl ? "בקרוב" : "Soon")
                    : (t(item.labelKey as Parameters<typeof t>[0]) || item.labelFallback)}
                </span>
              </button>
            );
          })}

        {/* History tab */}
        <button
          onClick={() => { window.location.href = "/history"; }}
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 3,
            padding: "8px 4px 10px",
            border: "none",
            background: "transparent",
            cursor: "pointer",
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 9,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#94a3b8",
            }}
          >
            <History className="w-4 h-4" />
          </div>
          <span style={{ fontSize: "0.6rem", fontWeight: 500, color: "#94a3b8", lineHeight: 1 }}>
            {isRtl ? "היסטוריה" : "History"}
          </span>
        </button>
      </nav>
    </div>
  );
}

/**
 * WorkspacePage — /app
 * CAD-style workspace for authenticated users only.
 * Guests are redirected to / automatically.
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { AuthDialog, type AuthReason } from "@/components/AuthDialog";
import { TokenPricingModal } from "@/components/TokenPricingModal";
import { AiTraceTab } from "@/components/AiTraceTab";
import { AiDocumentRedrawTab } from "@/components/AiDocumentRedrawTab";
import { FaceDetectTab } from "@/components/FaceDetectTab";
import { CncReliefTab } from "@/components/CncReliefTab";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { InsufficientTokensBanner } from "@/components/InsufficientTokensBanner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Sparkles, Scan, FileEdit, UserCircle, Mountain,
  LogOut, History, CreditCard, ChevronDown, X,
} from "lucide-react";

// ─── AiGeneratorTab (inline from Home.tsx) ──────────────────────────────────
// We re-export the same component that Home uses — import it from its own file
import AiGeneratorTabInline from "@/components/AiGeneratorTab";

// ─── CAD Grid background style ───────────────────────────────────────────────
const CAD_GRID_STYLE: React.CSSProperties = {
  background: `
    linear-gradient(rgba(99,102,241,0.06) 1px, transparent 1px),
    linear-gradient(90deg, rgba(99,102,241,0.06) 1px, transparent 1px),
    linear-gradient(rgba(99,102,241,0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(99,102,241,0.03) 1px, transparent 1px),
    #ffffff
  `,
  backgroundSize: '100px 100px, 100px 100px, 20px 20px, 20px 20px',
};

// ─── Token History Popup ─────────────────────────────────────────────────────
function TokenHistoryPopup({ onClose, onBuy, isRtl }: { onClose: () => void; onBuy: () => void; isRtl: boolean }) {
  const { data: history } = trpc.tokens.history.useQuery();
  return (
    <div
      style={{
        position: 'absolute',
        top: '110%',
        right: isRtl ? 'auto' : 0,
        left: isRtl ? 0 : 'auto',
        width: 280,
        background: '#1a1a2e',
        border: '1px solid rgba(99,102,241,0.3)',
        borderRadius: 14,
        boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
        zIndex: 100,
        overflow: 'hidden',
      }}
    >
      <div style={{ padding: '12px 16px 8px', borderBottom: '1px solid rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ color: '#a5b4fc', fontWeight: 700, fontSize: 13 }}>{isRtl ? 'היסטוריית אסימונים' : 'Token History'}</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: 2 }}>
          <X style={{ width: 14, height: 14 }} />
        </button>
      </div>
      <div style={{ maxHeight: 200, overflowY: 'auto', padding: '8px 0' }}>
        {(!history || history.length === 0) ? (
          <p style={{ color: '#6b7280', fontSize: 12, textAlign: 'center', padding: '12px 16px' }}>
            {isRtl ? 'אין היסטוריה עדיין' : 'No history yet'}
          </p>
        ) : history.map((tx: { id: number; reason: string; amount: number; balanceAfter: number; createdAt: Date }) => (
          <div key={tx.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 16px', fontSize: 11 }}>
            <span style={{ color: tx.amount > 0 ? '#34d399' : '#f87171', fontWeight: 700, minWidth: 28, textAlign: 'right' }}>
              {tx.amount > 0 ? '+' : ''}{tx.amount}
            </span>
            <span style={{ color: '#9ca3af', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.reason}</span>
            <span style={{ color: '#6b7280', minWidth: 30, textAlign: 'right' }}>{tx.balanceAfter}</span>
          </div>
        ))}
      </div>
      <div style={{ padding: '8px 16px 12px', borderTop: '1px solid rgba(99,102,241,0.12)', textAlign: 'center' }}>
        <button
          onClick={onBuy}
          style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: 'white', border: 'none', borderRadius: 20, padding: '7px 20px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
        >
          {isRtl ? '✨ קנה אסימונים' : '✨ Buy Tokens'}
        </button>
      </div>
    </div>
  );
}

// ─── Main WorkspacePage ───────────────────────────────────────────────────────
export default function WorkspacePage() {
  const { t, isRtl } = useLanguage();
  const [, navigate] = useLocation();

  // Auth state
  const [appUser, setAppUser] = useState<{ id: number; email: string; name: string | null } | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authReason, setAuthReason] = useState<AuthReason>("generic");
  const [authInitialMode, setAuthInitialMode] = useState<"login" | "register">("register");

  // UI state
  const [pricingModalOpen, setPricingModalOpen] = useState(false);
  const [showTokensBanner, setShowTokensBanner] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [tokenHistoryOpen, setTokenHistoryOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const tokenHistoryRef = useRef<HTMLDivElement>(null);

  // Manus OAuth user
  const manusAuthData = trpc.auth.me.useQuery();
  const manusUser = manusAuthData.data;

  // Token balance
  const { data: tokenData, refetch: refetchTokens } = trpc.tokens.balance.useQuery(
    undefined,
    { enabled: !!appUser || !!manusUser, refetchInterval: 30000 }
  );
  const tokenBalance = tokenData?.balance ?? 0;
  const hasPendingWelcomeBonus = tokenData?.hasPendingWelcomeBonus ?? false;

  // Portrait state
  const [portraitInitialImage, setPortraitInitialImage] = useState<string | null>(null);
  const [portraitImageKey, setPortraitImageKey] = useState(0);

  // Active tab
  const [activeTab, setActiveTab] = useState<string>(() => {
    if (localStorage.getItem("ai_trace_jobId")) return "trace";
    if (localStorage.getItem("doc_redraw_jobId")) return "redraw";
    if (localStorage.getItem("ai_generate_jobId")) return "ai";
    if (localStorage.getItem("face_detect_jobId")) return "face";
    return localStorage.getItem("active_tab") ?? "ai";
  });

  // Active background jobs
  const [activeJobs, setActiveJobs] = useState<{ generate: boolean; trace: boolean; doc: boolean; face: boolean }>(() => ({
    generate: !!localStorage.getItem("ai_generate_jobId"),
    trace: !!localStorage.getItem("ai_trace_jobId"),
    doc: !!localStorage.getItem("doc_redraw_jobId"),
    face: !!localStorage.getItem("face_detect_jobId"),
  }));

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveJobs({
        generate: !!localStorage.getItem("ai_generate_jobId"),
        trace: !!localStorage.getItem("ai_trace_jobId"),
        doc: !!localStorage.getItem("doc_redraw_jobId"),
        face: !!localStorage.getItem("face_detect_jobId"),
      });
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // Auth check on mount — redirect guests to /
  useEffect(() => {
    const campaignCode = new URLSearchParams(window.location.search).get("campaign");
    if (campaignCode) localStorage.setItem("pending_campaign", campaignCode);

    fetch("/api/app-auth/me", { credentials: "include" })
      .then(r => r.json())
      .then(d => {
        if (d.user) {
          localStorage.setItem("app_user_logged_in", "1");
          setAppUser(d.user);
          const pendingCampaign = campaignCode || localStorage.getItem("pending_campaign");
          if (pendingCampaign) {
            fetch("/api/app-auth/claim-campaign", {
              method: "POST", credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ campaignCode: pendingCampaign }),
            }).then(r => r.json()).then(res => {
              if (res.awarded && res.tokens > 0) refetchTokens();
              localStorage.removeItem("pending_campaign");
            }).catch(() => {});
          }
        } else {
          // Not authenticated → redirect to landing
          navigate("/");
        }
        setAuthChecked(true);
      })
      .catch(() => { navigate("/"); setAuthChecked(true); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close menus on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setUserMenuOpen(false);
      if (tokenHistoryRef.current && !tokenHistoryRef.current.contains(e.target as Node)) setTokenHistoryOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const openAuthAs = useCallback((reason: AuthReason) => {
    setAuthReason(reason);
    setAuthOpen(true);
  }, []);

  const clearAllResultCaches = () => {
    localStorage.removeItem("app_user_logged_in");
    localStorage.removeItem("ai_generate_result");
    localStorage.removeItem("ai_generate_prompt");
    localStorage.removeItem("ai_generate_jobId");
    localStorage.removeItem("ai_trace_result");
    localStorage.removeItem("ai_trace_imagePreview");
    localStorage.removeItem("ai_trace_jobId");
    localStorage.removeItem("doc_redraw_result");
    localStorage.removeItem("doc_redraw_imagePreview");
    localStorage.removeItem("doc_redraw_jobId");
    localStorage.removeItem("face_detect_result");
    localStorage.removeItem("face_detect_imagePreview");
    localStorage.removeItem("face_detect_jobId");
    localStorage.removeItem("active_tab");
  };

  const handleLogout = async () => {
    await fetch("/api/app-auth/logout", { method: "POST", credentials: "include" });
    clearAllResultCaches();
    setAppUser(null);
    toast.success(t("loggedOutSuccess"));
    navigate("/");
  };

  // Show loading while checking auth
  if (!authChecked) {
    return (
      <div style={{ ...CAD_GRID_STYLE, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="22" height="22" viewBox="0 0 20 20" fill="none">
              <path d="M4 16 Q7 7 10 10 Q13 13 16 4" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none"/>
              <circle cx="4" cy="16" r="1.8" fill="#06b6d4"/>
              <circle cx="10" cy="10" r="1.8" fill="white"/>
              <circle cx="16" cy="4" r="1.8" fill="#06b6d4"/>
            </svg>
          </div>
          <div style={{ width: 24, height: 24, border: '3px solid #e0e7ff', borderTop: '3px solid #6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const displayUser = appUser || (manusUser ? { id: manusUser.id, email: manusUser.email, name: manusUser.name ?? null } : null);

  return (
    <div style={{ ...CAD_GRID_STYLE, minHeight: '100vh' }} dir={isRtl ? "rtl" : "ltr"}>

      {/* ── Header ── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 30,
        background: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1.5px solid rgba(99,102,241,0.15)',
        boxShadow: '0 1px 0 rgba(99,102,241,0.08)',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 16px', height: 52, display: 'flex', alignItems: 'center', gap: 12 }}>

          {/* Logo */}
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', flexShrink: 0 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(99,102,241,0.3)' }}>
              <svg width="17" height="17" viewBox="0 0 20 20" fill="none">
                <path d="M4 16 Q7 7 10 10 Q13 13 16 4" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none"/>
                <circle cx="4" cy="16" r="1.8" fill="#06b6d4"/>
                <circle cx="10" cy="10" r="1.8" fill="white"/>
                <circle cx="16" cy="4" r="1.8" fill="#06b6d4"/>
              </svg>
            </div>
            <span style={{ fontWeight: 900, fontSize: 15, letterSpacing: '-0.02em', color: '#6366f1', fontFamily: 'Inter,sans-serif' }}>Ai</span>
            <span style={{ fontWeight: 900, fontSize: 15, letterSpacing: '-0.02em', color: '#111827', fontFamily: 'Inter,sans-serif', marginLeft: -4 }}>DXF</span>
            {/* CAD-style workspace badge */}
            <span style={{ fontSize: 9, fontWeight: 700, color: '#6366f1', background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: 4, padding: '1px 5px', letterSpacing: '0.06em', marginLeft: 2 }}>
              WORKSPACE
            </span>
          </a>

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* Right side controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>

            {/* Pricing */}
            <button
              onClick={() => setPricingModalOpen(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, padding: '5px 10px', borderRadius: 8, color: '#6366f1', background: '#eef2ff', border: '1px solid #c7d2fe', cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              💎 {isRtl ? 'מחירון' : 'Pricing'}
            </button>

            {/* Token balance */}
            {displayUser && (
              <div style={{ position: 'relative' }} ref={tokenHistoryRef}>
                <button
                  onClick={() => setTokenHistoryOpen(v => !v)}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, fontWeight: 700, padding: '5px 10px', borderRadius: 8, background: hasPendingWelcomeBonus ? 'linear-gradient(135deg,#4f46e5,#7c3aed)' : '#eef2ff', border: hasPendingWelcomeBonus ? 'none' : '1px solid #c7d2fe', color: hasPendingWelcomeBonus ? 'white' : '#4338ca', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  <span>⚡</span>
                  <span>{tokenBalance}</span>
                  {hasPendingWelcomeBonus && <span style={{ fontSize: 9, background: '#fbbf24', color: '#1c1917', borderRadius: 10, padding: '1px 4px', fontWeight: 800 }}>+20</span>}
                </button>
                {tokenHistoryOpen && (
                  <TokenHistoryPopup
                    onClose={() => setTokenHistoryOpen(false)}
                    onBuy={() => { setTokenHistoryOpen(false); window.location.href = '/buy'; }}
                    isRtl={isRtl}
                  />
                )}
              </div>
            )}

            {/* User menu */}
            {displayUser && (
              <div style={{ position: 'relative' }} ref={userMenuRef}>
                <button
                  onClick={() => setUserMenuOpen(v => !v)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 8, background: '#f9fafb', border: '1px solid #e5e7eb', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#374151' }}
                >
                  <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ color: 'white', fontSize: 10, fontWeight: 700 }}>
                      {(displayUser.name || displayUser.email || '?')[0]?.toUpperCase() ?? '?'}
                    </span>
                  </div>
                  <span className="hidden sm:inline" style={{ maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {displayUser.name || (displayUser.email ?? '').split('@')[0]}
                  </span>
                  <ChevronDown style={{ width: 12, height: 12, color: '#9ca3af' }} />
                </button>
                {userMenuOpen && (
                  <div style={{ position: 'absolute', top: '110%', right: isRtl ? 'auto' : 0, left: isRtl ? 0 : 'auto', width: 200, background: '#1a1a2e', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.3)', zIndex: 100, overflow: 'hidden' }}>
                    <div style={{ padding: '10px 14px 8px', borderBottom: '1px solid rgba(99,102,241,0.15)' }}>
                      <p style={{ color: '#e0e7ff', fontWeight: 700, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {displayUser.name || (displayUser.email ?? '').split('@')[0]}
                      </p>
                      <p style={{ color: '#6b7280', fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayUser.email ?? ''}</p>
                    </div>
                    <div style={{ padding: '6px 8px' }}>
                      <button onClick={() => { setUserMenuOpen(false); window.location.href = '/history'; }}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', width: '100%', color: '#a5b4fc', fontSize: 12, fontWeight: 600 }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.15)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <History style={{ width: 14, height: 14 }} />
                        {isRtl ? 'היסטוריה' : 'History'}
                      </button>
                      <button onClick={() => { setUserMenuOpen(false); window.location.href = '/buy'; }}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', width: '100%', color: '#6ee7b7', fontSize: 12, fontWeight: 600 }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(16,185,129,0.12)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <CreditCard style={{ width: 14, height: 14 }} />
                        {isRtl ? '✨ קנה אסימונים' : '✨ Buy Tokens'}
                      </button>
                    </div>
                    <div style={{ padding: '4px 8px 8px', borderTop: '1px solid rgba(239,68,68,0.12)' }}>
                      <button onClick={() => { setUserMenuOpen(false); handleLogout(); }}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', width: '100%', color: '#f87171', fontSize: 12, fontWeight: 600 }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.1)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <LogOut style={{ width: 14, height: 14 }} />
                        {isRtl ? 'התנתק' : 'Sign out'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Language switcher */}
            <LanguageSwitcher />
          </div>
        </div>
      </header>

      {/* ── Auth Dialog ── */}
      <AuthDialog
        open={authOpen}
        onOpenChange={setAuthOpen}
        authReason={authReason}
        initialMode={authInitialMode}
        onSuccess={(user, isNewRegistration) => {
          localStorage.setItem("app_user_logged_in", "1");
          setAppUser(user);
          setAuthReason("generic");
          setAuthInitialMode("register");
          if (isNewRegistration) {
            toast.success(isRtl ? 'ברוך הבא! 🎉' : 'Welcome! 🎉');
          }
        }}
      />

      {/* ── Insufficient Tokens Banner ── */}
      {showTokensBanner && (
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '8px 16px 0' }}>
          <InsufficientTokensBanner onDismiss={() => setShowTokensBanner(false)} hasPendingWelcomeBonus={hasPendingWelcomeBonus} />
        </div>
      )}

      {/* ── Main Content ── */}
      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '20px 16px 40px' }}>

        {/* ── Workspace Tabs ── */}
        <Tabs
          value={activeTab}
          onValueChange={v => { setActiveTab(v); localStorage.setItem("active_tab", v); }}
          dir={isRtl ? "rtl" : "ltr"}
        >
          {/* Tab bar — horizontally scrollable for mobile + future features */}
          <div style={{ overflowX: 'auto', overflowY: 'visible', WebkitOverflowScrolling: 'touch', marginBottom: 0, paddingBottom: 0 }}>
            <TabsList
              style={{
                display: 'flex',
                gap: 4,
                padding: '5px 6px',
                background: '#ffffff',
                border: '1px solid #e5e7eb',
                borderBottom: '2px solid #e5e7eb',
                borderRadius: '12px 12px 0 0',
                boxShadow: '0 -1px 0 0 #e5e7eb inset',
                width: 'max-content',
                minWidth: '100%',
                height: 'auto',
              }}
            >
              {/* AI Create */}
              <TabsTrigger
                value="ai"
                style={{ position: 'relative', flex: '1 1 auto', minWidth: 80 }}
                className="flex-col gap-1 py-3 px-3 text-xs font-semibold transition-all rounded-xl text-gray-400 data-[state=active]:text-white data-[state=active]:shadow-md"
                data-active-bg="linear-gradient(135deg,#6366f1,#8b5cf6)"
              >
                <div style={{ background: activeTab === 'ai' ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : 'transparent', position: 'absolute', inset: 0, borderRadius: 10, transition: 'all 0.2s' }} />
                <span style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  {/* AI Create SVG icon */}
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                    <path d="M3 20 Q8 8 12 12 Q16 16 21 4" stroke={activeTab === 'ai' ? 'white' : '#6366f1'} strokeWidth="2" strokeLinecap="round" fill="none"/>
                    <circle cx="3" cy="20" r="2" fill={activeTab === 'ai' ? '#06b6d4' : '#a5b4fc'}/>
                    <circle cx="12" cy="12" r="2" fill={activeTab === 'ai' ? 'white' : '#6366f1'}/>
                    <circle cx="21" cy="4" r="2" fill={activeTab === 'ai' ? '#06b6d4' : '#a5b4fc'}/>
                    <path d="M17 2 L18.5 5.5 L22 7 L18.5 8.5 L17 12 L15.5 8.5 L12 7 L15.5 5.5 Z" fill={activeTab === 'ai' ? '#fbbf24' : '#f59e0b'} opacity="0.9"/>
                  </svg>
                  <span style={{ fontSize: 10, fontWeight: 700, color: activeTab === 'ai' ? 'white' : '#374151', whiteSpace: 'nowrap' }}>{isRtl ? 'AI יצירה' : 'AI Create'}</span>
                </span>
                {activeJobs.generate && (
                  <span style={{ position: 'absolute', top: -4, right: -4, width: 10, height: 10, borderRadius: '50%', background: '#f59e0b', boxShadow: '0 0 0 2px white', zIndex: 2 }} />
                )}
              </TabsTrigger>

              {/* AI Outline */}
              <TabsTrigger
                value="trace"
                style={{ position: 'relative', flex: '1 1 auto', minWidth: 80 }}
                className="flex-col gap-1 py-3 px-3 text-xs font-semibold transition-all rounded-xl text-gray-400 data-[state=active]:text-white data-[state=active]:shadow-md"
              >
                <div style={{ background: activeTab === 'trace' ? 'linear-gradient(135deg,#0d9488,#06b6d4)' : 'transparent', position: 'absolute', inset: 0, borderRadius: 10, transition: 'all 0.2s' }} />
                <span style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  {/* AI Outline SVG: photo → vector */}
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                    <rect x="2" y="4" width="8" height="8" rx="1.5" fill={activeTab === 'trace' ? 'rgba(255,255,255,0.3)' : '#d1fae5'} stroke={activeTab === 'trace' ? 'white' : '#0d9488'} strokeWidth="1.5"/>
                    <circle cx="5" cy="7" r="1.2" fill={activeTab === 'trace' ? 'white' : '#0d9488'}/>
                    <path d="M2 10 L5 7.5 L7 9 L10 6" stroke={activeTab === 'trace' ? 'white' : '#0d9488'} strokeWidth="1.2" strokeLinecap="round" fill="none"/>
                    <path d="M13 8 L15 8" stroke={activeTab === 'trace' ? 'white' : '#6b7280'} strokeWidth="1.5" strokeLinecap="round"/>
                    <path d="M14.5 7 L16 8 L14.5 9" stroke={activeTab === 'trace' ? 'white' : '#6b7280'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                    <path d="M17 5 Q19 8 17 11 Q19 9 22 11" stroke={activeTab === 'trace' ? '#06b6d4' : '#0d9488'} strokeWidth="1.8" strokeLinecap="round" fill="none"/>
                    <path d="M17 5 Q20 6 22 4" stroke={activeTab === 'trace' ? 'white' : '#0d9488'} strokeWidth="1.5" strokeLinecap="round" fill="none"/>
                  </svg>
                  <span style={{ fontSize: 10, fontWeight: 700, color: activeTab === 'trace' ? 'white' : '#374151', whiteSpace: 'nowrap' }}>AI Outline</span>
                </span>
                {activeJobs.trace && (
                  <span style={{ position: 'absolute', top: -4, right: -4, width: 10, height: 10, borderRadius: '50%', background: '#f59e0b', boxShadow: '0 0 0 2px white', zIndex: 2 }} />
                )}
              </TabsTrigger>

              {/* AI Sketch — Coming Soon */}
              <TabsTrigger
                value="redraw"
                disabled
                style={{ position: 'relative', flex: '1 1 auto', minWidth: 80, opacity: 0.5, cursor: 'not-allowed' }}
                className="flex-col gap-1 py-3 px-3 text-xs font-semibold rounded-xl text-gray-300"
              >
                <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  {/* Sketch SVG icon */}
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                    <path d="M4 20 Q6 14 9 16 Q12 18 15 10 Q17 5 20 7" stroke="#9ca3af" strokeWidth="1.8" strokeLinecap="round" fill="none" strokeDasharray="3 2"/>
                    <path d="M18 4 L20 6 L14 12 L12 12 L12 10 Z" fill="#d1d5db" stroke="#9ca3af" strokeWidth="1.2"/>
                  </svg>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', whiteSpace: 'nowrap' }}>{isRtl ? 'AI סקיצה' : 'AI Sketch'}</span>
                </span>
                <span style={{ position: 'absolute', top: -6, right: isRtl ? 'auto' : -4, left: isRtl ? -4 : 'auto', fontSize: 8, fontWeight: 800, background: '#f59e0b', color: 'white', padding: '1px 4px', borderRadius: 8, whiteSpace: 'nowrap', zIndex: 2 }}>
                  {t("comingSoon")}
                </span>
              </TabsTrigger>

              {/* Portrait */}
              <TabsTrigger
                value="face"
                style={{ position: 'relative', flex: '1 1 auto', minWidth: 80 }}
                className="flex-col gap-1 py-3 px-3 text-xs font-semibold transition-all rounded-xl text-gray-400 data-[state=active]:text-white data-[state=active]:shadow-md"
              >
                <div style={{ background: activeTab === 'face' ? 'linear-gradient(135deg,#7c3aed,#a855f7)' : 'transparent', position: 'absolute', inset: 0, borderRadius: 10, transition: 'all 0.2s' }} />
                <span style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  {/* Portrait SVG icon */}
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                    <circle cx="12" cy="8" r="4" stroke={activeTab === 'face' ? 'white' : '#7c3aed'} strokeWidth="1.8" fill={activeTab === 'face' ? 'rgba(255,255,255,0.2)' : '#f5f3ff'}/>
                    <path d="M4 20 Q4 15 12 15 Q20 15 20 20" stroke={activeTab === 'face' ? 'white' : '#7c3aed'} strokeWidth="1.8" strokeLinecap="round" fill="none"/>
                    <path d="M9 8 Q12 10 15 8" stroke={activeTab === 'face' ? '#e9d5ff' : '#a855f7'} strokeWidth="1.2" strokeLinecap="round" fill="none"/>
                    <circle cx="10" cy="7" r="0.8" fill={activeTab === 'face' ? 'white' : '#7c3aed'}/>
                    <circle cx="14" cy="7" r="0.8" fill={activeTab === 'face' ? 'white' : '#7c3aed'}/>
                  </svg>
                  <span style={{ fontSize: 10, fontWeight: 700, color: activeTab === 'face' ? 'white' : '#374151', whiteSpace: 'nowrap' }}>{isRtl ? 'פורטרט' : 'Portrait'}</span>
                </span>
                {activeJobs.face && (
                  <span style={{ position: 'absolute', top: -4, right: -4, width: 10, height: 10, borderRadius: '50%', background: '#f59e0b', boxShadow: '0 0 0 2px white', zIndex: 2 }} />
                )}
              </TabsTrigger>

              {/* CNC Relief — Coming Soon */}
              <TabsTrigger
                value="cnc-relief"
                disabled
                style={{ position: 'relative', flex: '1 1 auto', minWidth: 80, opacity: 0.5, cursor: 'not-allowed' }}
                className="flex-col gap-1 py-3 px-3 text-xs font-semibold rounded-xl text-gray-300"
              >
                <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  {/* CNC Relief SVG icon */}
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                    <path d="M2 18 L7 10 L12 14 L17 6 L22 10" stroke="#9ca3af" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                    <path d="M2 18 L7 10 L12 14 L17 6 L22 10 L22 20 L2 20 Z" fill="#f3f4f6" opacity="0.6"/>
                    <path d="M2 20 L22 20" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', whiteSpace: 'nowrap' }}>{isRtl ? 'CNC תבליט' : 'CNC Relief'}</span>
                </span>
                <span style={{ position: 'absolute', top: -6, right: isRtl ? 'auto' : -4, left: isRtl ? -4 : 'auto', fontSize: 8, fontWeight: 800, background: '#f59e0b', color: 'white', padding: '1px 4px', borderRadius: 8, whiteSpace: 'nowrap', zIndex: 2 }}>
                  {t("comingSoon")}
                </span>
              </TabsTrigger>

              {/* Placeholder for future features */}
              <div style={{ flex: '1 1 auto', minWidth: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.3 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '8px 12px' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="9" stroke="#9ca3af" strokeWidth="1.5" strokeDasharray="3 3"/>
                    <path d="M12 8 L12 16 M8 12 L16 12" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  <span style={{ fontSize: 9, color: '#9ca3af', fontWeight: 600, whiteSpace: 'nowrap' }}>{isRtl ? 'בקרוב...' : 'More...'}</span>
                </div>
              </div>
            </TabsList>
          </div>

          {/* ── Tab Contents ── */}
          {/* CAD-style content panel — connects flush to tab bar */}
          <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderTop: 'none', borderRadius: '0 0 12px 12px', padding: '20px 16px 24px', boxShadow: '0 4px 20px rgba(0,0,0,0.04)', marginBottom: 24 }}>
          <TabsContent value="ai">
            <AiGeneratorTabInline
              onOpenAuth={() => openAuthAs("unregistered")}
              onInsufficientTokens={() => setShowTokensBanner(true)}
            />
          </TabsContent>

          <TabsContent value="trace">
            <AiTraceTab
              onOpenAuth={() => openAuthAs("unregistered")}
              onInsufficientTokens={() => setShowTokensBanner(true)}
              onSwitchToPortrait={(imageDataUrl) => {
                setPortraitInitialImage(imageDataUrl);
                setPortraitImageKey(k => k + 1);
                setActiveTab("face");
                localStorage.setItem("active_tab", "face");
              }}
            />
          </TabsContent>

          <TabsContent value="redraw">
            <div style={{ padding: 24, textAlign: 'center', background: 'rgba(255,255,255,0.8)', borderRadius: 16, border: '1.5px solid #fed7aa' }}>
              <span style={{ fontSize: 32 }}>🛠️</span>
              <p style={{ color: '#92400e', fontWeight: 700, marginTop: 8 }}>{isRtl ? 'בקרוב — AI סקיצה' : 'Coming Soon — AI Sketch'}</p>
            </div>
          </TabsContent>

          <TabsContent value="face">
            <FaceDetectTab
              key={portraitImageKey}
              onOpenAuth={() => openAuthAs("unregistered")}
              onInsufficientTokens={() => setShowTokensBanner(true)}
              initialImageDataUrl={portraitInitialImage}
            />
          </TabsContent>

          <TabsContent value="cnc-relief">
            <div style={{ padding: 24, textAlign: 'center', background: 'rgba(255,255,255,0.8)', borderRadius: 16, border: '1.5px solid #fed7aa' }}>
              <span style={{ fontSize: 32 }}>🏔️</span>
              <p style={{ color: '#92400e', fontWeight: 700, marginTop: 8 }}>{isRtl ? 'בקרוב — CNC תבליט' : 'Coming Soon — CNC Relief'}</p>
            </div>
          </TabsContent>
          </div>{/* end CAD panel */}
        </Tabs>
      </main>

      {/* ── Footer ── */}
      <footer style={{ borderTop: '1.5px solid rgba(99,102,241,0.1)', background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(8px)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontWeight: 900, fontSize: 13, color: '#6366f1' }}>Ai</span>
            <span style={{ fontWeight: 900, fontSize: 13, color: '#111827' }}>DXF</span>
            <span style={{ fontSize: 10, color: '#9ca3af' }}>— {isRtl ? 'ממיר AI מקצועי' : 'Professional AI Converter'}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 11, color: '#9ca3af' }}>
            <a href="/terms" style={{ color: '#9ca3af', textDecoration: 'none' }}>{t("terms")}</a>
            <a href="/privacy" style={{ color: '#9ca3af', textDecoration: 'none' }}>{t("privacy")}</a>
            <span>© 2026 AiDXF</span>
          </div>
        </div>
      </footer>

      {/* ── Token Pricing Modal ── */}
      <TokenPricingModal open={pricingModalOpen} onClose={() => setPricingModalOpen(false)} />
    </div>
  );
}

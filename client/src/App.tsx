import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { LanguageProvider } from "./contexts/LanguageContext";
import { lazy, Suspense } from "react";
import { trpc } from "./lib/trpc";
import { useEffect, useRef } from "react";

// Eagerly loaded — critical path (first paint)
import NotFound from "@/pages/NotFound";

// Lazily loaded — large pages split to reduce initial bundle
const Home = lazy(() => import("./pages/Home"));
const Landing = lazy(() => import("./pages/Landing"));

// Lazily loaded — only when user navigates to these routes
const Admin = lazy(() => import("./pages/Admin"));
const AdminAnnouncement = lazy(() => import("./pages/AdminAnnouncement"));
const AdminTracking = lazy(() => import("./pages/AdminTracking"));
const History = lazy(() => import("./pages/History"));
const Tokens = lazy(() => import("./pages/Tokens"));
const Share = lazy(() => import("./pages/Share"));
const Terms = lazy(() => import("./pages/Terms"));
const Privacy = lazy(() => import("./pages/Privacy"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Account = lazy(() => import("./pages/Account"));
const Buy = lazy(() => import("./pages/Buy"));
const BuySuccess = lazy(() => import("./pages/BuySuccess"));
const Marketing = lazy(() => import("./pages/Marketing"));
const PurchaseTerms = lazy(() => import("./pages/PurchaseTerms"));
const MaintenancePage = lazy(() => import("./pages/Maintenance"));
const VerifyEmail = lazy(() => import("./pages/VerifyEmail"));
const Pricing = lazy(() => import("./pages/Pricing"));
const Promo = lazy(() => import("./pages/Promo"));
const FeatureAiCreate = lazy(() => import("./pages/FeatureAiCreate"));
const FeatureAiOutline = lazy(() => import("./pages/FeatureAiOutline"));
const FeaturePortrait = lazy(() => import("./pages/FeaturePortrait"));
const FeatureCncRelief = lazy(() => import("./pages/FeatureCncRelief"));
const FeatureDocRedraw = lazy(() => import("./pages/FeatureDocRedraw"));
const FreeDxfHome = lazy(() => import("./pages/FreeDxfHome"));
const FreeDxfBrowse = lazy(() => import("./pages/FreeDxfBrowse"));
const FreeDxfFileDetail = lazy(() => import("./pages/FreeDxfFileDetail"));
const SketchTest = lazy(() => import("./pages/SketchTest"));
const ReliefTest = lazy(() => import("./pages/ReliefTest"));
const BuyDesignPreview = lazy(() => import("./pages/BuyDesignPreview"));
const NeedleEngraving = lazy(() => import("./pages/NeedleEngraving"));
const TestLab = lazy(() => import("./pages/TestLab"));

/** Generates or retrieves a persistent session ID from localStorage */
function getOrCreateSessionId(): string {
  const key = "_vsid";
  let id = localStorage.getItem(key);
  if (!id) {
    id = Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem(key, id);
  }
  return id;
}

/** Detect device type from userAgent */
function detectDevice(): string {
  const ua = navigator.userAgent.toLowerCase();
  if (/tablet|ipad|playbook|silk/.test(ua)) return 'tablet';
  if (/mobile|iphone|ipod|android|blackberry|opera mini|windows phone/.test(ua)) return 'mobile';
  return 'desktop';
}

/** Detect browser name */
function detectBrowser(): string {
  const ua = navigator.userAgent;
  if (/Edg\//.test(ua)) return 'Edge';
  if (/OPR\/|Opera/.test(ua)) return 'Opera';
  if (/Chrome\//.test(ua) && !/Chromium/.test(ua)) return 'Chrome';
  if (/Firefox\//.test(ua)) return 'Firefox';
  if (/Safari\//.test(ua) && !/Chrome/.test(ua)) return 'Safari';
  return 'Other';
}

/** Parse UTM params from URL */
function getUtmParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    utmSource: params.get('utm_source') ?? undefined,
    utmMedium: params.get('utm_medium') ?? undefined,
    utmCampaign: params.get('utm_campaign') ?? undefined,
  };
}

/** Tracks page visits for analytics — renders nothing */
function VisitorTracker() {
  const [location] = useLocation();
  const trackMutation = trpc.visitors.track.useMutation();
  const logClickMutation = trpc.tracking.logClick.useMutation();
  const lastTracked = useRef("");
  const pageEntryTime = useRef<number>(Date.now());
  const hasInteracted = useRef(false);

  // Track clicks on key elements
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      hasInteracted.current = true;
      const target = e.target as HTMLElement;
      const btn = target.closest('[data-track]') as HTMLElement | null;
      if (!btn) return;
      const element = btn.getAttribute('data-track');
      if (!element) return;
      const sessionId = getOrCreateSessionId();
      trackMutation.mutate({
        sessionId,
        page: window.location.pathname,
        eventType: 'click',
        element,
        ...getUtmParams(),
        device: detectDevice(),
        browser: detectBrowser(),
      });
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Don't track admin pages
    if (location.startsWith("/admin")) return;
    // Debounce: don't track same page twice in a row
    if (lastTracked.current === location) return;

    // Record time-on-page for previous page before tracking new one
    if (lastTracked.current) {
      const timeOnPage = Math.round((Date.now() - pageEntryTime.current) / 1000);
      const bounced = !hasInteracted.current ? 1 : 0;
      const sessionId = getOrCreateSessionId();
      trackMutation.mutate({
        sessionId,
        page: lastTracked.current,
        eventType: 'bounce',
        timeOnPageSec: timeOnPage,
        bounced,
        device: detectDevice(),
        browser: detectBrowser(),
      });
    }

    lastTracked.current = location;
    pageEntryTime.current = Date.now();

    const sessionId = getOrCreateSessionId();
    trackMutation.mutate({
      sessionId,
      page: location,
      eventType: 'pageview',
      referrer: document.referrer ? document.referrer.substring(0, 512) : undefined,
      userAgent: navigator.userAgent.substring(0, 256),
      device: detectDevice(),
      browser: detectBrowser(),
      ...getUtmParams(),
    });
    // Also log to user_click_events so we can see per-user page views
    const pageLabels: Record<string, string> = {
      '/': 'דף בית',
      '/buy': 'דף רכישה',
      '/history': 'דף היסטוריה',
      '/account': 'אזור אישי',
      '/free': 'דף חינם',
      '/community': 'קהילה',
    };
    const pageLabel = pageLabels[location] || location;
    logClickMutation.mutate({ action: 'page_view', label: pageLabel, page: location });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  // Track time-on-page when user leaves the site
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (location.startsWith("/admin")) return;
      const timeOnPage = Math.round((Date.now() - pageEntryTime.current) / 1000);
      const bounced = !hasInteracted.current ? 1 : 0;
      const sessionId = getOrCreateSessionId();
      // Use sendBeacon for reliability on page unload
      const payload = JSON.stringify({
        sessionId,
        page: location,
        eventType: 'bounce',
        timeOnPageSec: timeOnPage,
        bounced,
        device: detectDevice(),
        browser: detectBrowser(),
      });
      // Fire-and-forget via trpc mutation (best effort)
      trackMutation.mutate(JSON.parse(payload));
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  return null;
}

/** Wraps all routes — shows maintenance page when enabled, except for /admin routes */
function MaintenanceGuard({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { data: maintenanceData } = trpc.system.maintenanceMode.useQuery(undefined, {
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
  const { data: adminCheck } = trpc.admin.check.useQuery();

  // Always let admins through, and always allow /admin routes
  const isAdminRoute = location.startsWith("/admin");
  const isAdminAuthenticated = adminCheck?.authenticated === true;

  if (maintenanceData?.enabled && !isAdminRoute && !isAdminAuthenticated) {
    return <MaintenancePage />;
  }
  return <>{children}</>;
}

function Router() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#fff" }} />}>
      <MaintenanceGuard>
        <VisitorTracker />
        <Switch>
        <Route path={"/"} component={Home} />
        <Route path={"/admin"} component={Admin} />
        <Route path={"/admin/announcement"} component={AdminAnnouncement} />
        <Route path={"/admin/tracking"} component={AdminTracking} />
        <Route path={"/account"} component={Account} />
        <Route path={"/history"} component={History} />
        <Route path={"/tokens"} component={Tokens} />
        <Route path={"/share/:token"} component={Share} />
        <Route path={"/reset-password"} component={ResetPassword} />
        <Route path={"/terms"} component={Terms} />
        <Route path={"/privacy"} component={Privacy} />
        <Route path={"/buy"} component={Buy} />
        <Route path={"/buy/success"} component={BuySuccess} />
        <Route path={"/purchase-terms"} component={PurchaseTerms} />
        <Route path={"/welcome"} component={Marketing} />
        <Route path={"/verify-email"} component={VerifyEmail} />
        <Route path={"/pricing"} component={Pricing} />
        <Route path={"/landing"} component={Landing} />
        <Route path={"/promo"} component={Promo} />
        <Route path={"/feature/ai-create"} component={FeatureAiCreate} />
        <Route path={"/feature/ai-outline"} component={FeatureAiOutline} />
        <Route path={"/feature/portrait"} component={FeaturePortrait} />
        <Route path={"/feature/cnc-relief"} component={FeatureCncRelief} />
        <Route path={"/feature/document-redraw"} component={FeatureDocRedraw} />
        <Route path={"/free"} component={FreeDxfHome} />
        <Route path={"/free/browse"} component={FreeDxfBrowse} />
        <Route path={"/free/file/:id"} component={FreeDxfFileDetail} />
        <Route path={"/sketch-test"} component={SketchTest} />
        <Route path={"/relief-test"} component={ReliefTest} />
        <Route path={"/buy-design-preview"} component={BuyDesignPreview} />
        <Route path={"/needle-engraving"} component={NeedleEngraving} />
        <Route path={"/test-lab"} component={TestLab} />
        <Route path={"/404"} component={NotFound} />
        {/* Final fallback route */}
        <Route component={NotFound} />
        </Switch>
      </MaintenanceGuard>
    </Suspense>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <LanguageProvider>
        <ThemeProvider defaultTheme="light">
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </ThemeProvider>
      </LanguageProvider>
    </ErrorBoundary>
  );
}

export default App;

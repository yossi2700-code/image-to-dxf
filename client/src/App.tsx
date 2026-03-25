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

/** Tracks page visits for analytics — renders nothing */
function VisitorTracker() {
  const [location] = useLocation();
  const trackMutation = trpc.visitors.track.useMutation();
  const lastTracked = useRef("");

  useEffect(() => {
    // Don't track admin pages
    if (location.startsWith("/admin")) return;
    // Debounce: don't track same page twice in a row
    if (lastTracked.current === location) return;
    lastTracked.current = location;
    const sessionId = getOrCreateSessionId();
    trackMutation.mutate({
      sessionId,
      page: location,
      referrer: document.referrer ? document.referrer.substring(0, 512) : undefined,
      userAgent: navigator.userAgent.substring(0, 256),
    });
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

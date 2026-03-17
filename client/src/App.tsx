import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { LanguageProvider } from "./contexts/LanguageContext";
import Home from "./pages/Home";
import Admin from "./pages/Admin";
import History from "./pages/History";
import Tokens from "./pages/Tokens";
import Share from "./pages/Share";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import ResetPassword from "./pages/ResetPassword";
import AdminAnnouncement from "./pages/AdminAnnouncement";
import Account from "./pages/Account";
import Buy from "./pages/Buy";
import BuySuccess from "./pages/BuySuccess";
import Marketing from "./pages/Marketing";
import PurchaseTerms from "./pages/PurchaseTerms";
import MaintenancePage from "./pages/Maintenance";
import VerifyEmail from "./pages/VerifyEmail";
import Pricing from "./pages/Pricing";
import Landing from "./pages/Landing";
import { trpc } from "./lib/trpc";
import { useEffect, useRef } from "react";

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
        <Route path={"/404"} component={NotFound} />
        {/* Final fallback route */}
        <Route component={NotFound} />
      </Switch>
    </MaintenanceGuard>
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

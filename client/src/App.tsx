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
import PurchaseTerms from "./pages/PurchaseTerms";
import MaintenancePage from "./pages/Maintenance";
import { trpc } from "./lib/trpc";

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

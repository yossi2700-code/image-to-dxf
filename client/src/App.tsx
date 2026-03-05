import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
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

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/admin"} component={Admin} />
      <Route path={"/history"} component={History} />
      <Route path={"/tokens"} component={Tokens} />
      <Route path={"/share/:token"} component={Share} />
      <Route path={"/reset-password"} component={ResetPassword} />
      <Route path={"/terms"} component={Terms} />
      <Route path={"/privacy"} component={Privacy} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
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

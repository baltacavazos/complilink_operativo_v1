import { useAuth } from "@/_core/hooks/useAuth";
import { shouldRedirectDemoUserFromCeo } from "@/lib/viewMode";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import Access from "@/pages/Access";
import Auditar from "@/pages/Auditar";
import CeoDashboard from "@/pages/CeoDashboard";
import { useEffect } from "react";
import NotFound from "./pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import { LegalPrivacyPage, LegalTermsPage } from "./pages/LegalDocuments";

function DemoViewGuard() {
  const auth = useAuth();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    if (auth.loading) return;
    if (!shouldRedirectDemoUserFromCeo(location, auth.realUser, auth.viewMode)) {
      return;
    }
    setLocation("/auditar");
  }, [auth.loading, auth.realUser, auth.viewMode, location, setLocation]);

  return null;
}

function Router() {
  return (
    <>
      <DemoViewGuard />
      <Switch>
        <Route path={"/"} component={Home} />
        <Route path={"/acceso"} component={Access} />
        <Route path={"/auditar"} component={Auditar} />
        <Route path={"/ceo"} component={CeoDashboard} />
        <Route path={"/ceo/bridge"} component={CeoDashboard} />
        <Route path={"/ceo/alertas"} component={CeoDashboard} />
        <Route path={"/ceo/accesos"} component={CeoDashboard} />
        <Route path={"/ceo/documentos"} component={CeoDashboard} />
        <Route path={"/legal/privacidad"} component={LegalPrivacyPage} />
        <Route path={"/legal/terminos"} component={LegalTermsPage} />
        <Route path={"/404"} component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;

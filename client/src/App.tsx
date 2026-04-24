import { useAuth } from "@/_core/hooks/useAuth";
import { shouldRedirectDemoUserFromCeo } from "@/lib/viewMode";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { lazy, Suspense, useEffect } from "react";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";

const Home = lazy(() => import("./pages/Home"));
const Access = lazy(() => import("@/pages/Access"));
const Auditar = lazy(() => import("@/pages/Auditar"));
const CeoDashboard = lazy(() => import("@/pages/CeoDashboard"));
const NotFound = lazy(() => import("./pages/NotFound"));
const LegalPrivacyPage = lazy(() =>
  import("./pages/LegalDocuments").then((module) => ({
    default: module.LegalPrivacyPage,
  })),
);
const LegalTermsPage = lazy(() =>
  import("./pages/LegalDocuments").then((module) => ({
    default: module.LegalTermsPage,
  })),
);

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

function RouteLoadingFallback() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl items-center justify-center px-6 py-10">
        <div className="rounded-[1.75rem] border border-slate-200 bg-white px-6 py-5 text-sm font-medium text-slate-600 shadow-sm">
          Cargando vista…
        </div>
      </div>
    </main>
  );
}

function Router() {
  return (
    <>
      <DemoViewGuard />
      <Suspense fallback={<RouteLoadingFallback />}>
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
      </Suspense>
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

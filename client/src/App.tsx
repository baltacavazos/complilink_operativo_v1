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

function QuickExitButton() {
  return (
    <a
      href="https://news.google.com/"
      className="fixed bottom-3 right-3 z-50 inline-flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/92 px-3 py-2 text-[0.78rem] font-semibold text-white shadow-[0_18px_50px_-24px_rgba(2,6,23,0.95)] transition hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-400 sm:bottom-4 sm:right-4 sm:px-4 sm:py-3 sm:text-sm"
      aria-label="Salida rápida"
      title="Salida rápida"
    >
      <span className="sm:hidden">Salir</span>
      <span className="hidden sm:inline">Salida rápida</span>
    </a>
  );
}

function Router() {
  return (
    <>
      <DemoViewGuard />
      <QuickExitButton />
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
      <ThemeProvider defaultTheme="dark" switchable>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;

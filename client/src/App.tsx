import { useAuth } from "@/_core/hooks/useAuth";
import AppUrlListener from "@/components/AppUrlListener";
import { AuditaPatronLogoIcon, AuditaPatronLogoWordmark } from "@/components/AuditaPatronLogo";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { shouldRedirectDemoUserFromCeo } from "@/lib/viewMode";
import { lazy, Suspense, useEffect } from "react";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";

const Home = lazy(() => import("./pages/Home"));
const Access = lazy(() => import("@/pages/Access"));
const Auditar = lazy(() => import("@/pages/Auditar"));
const Payments = lazy(() => import("@/pages/Payments"));
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
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(20,184,166,0.12),_transparent_30%),linear-gradient(180deg,#f8fbfc_0%,#eef4f5_100%)] text-slate-950">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl items-center justify-center px-6 py-10">
        <div className="w-full max-w-sm rounded-[2rem] border border-slate-200 bg-white/95 px-6 py-7 text-center shadow-[0_28px_80px_-42px_rgba(15,23,42,0.34)]">
          <div className="flex justify-center">
            <AuditaPatronLogoIcon imageClassName="h-12 w-12 rounded-2xl border border-slate-200 bg-white object-contain p-2 shadow-sm" />
          </div>
          <AuditaPatronLogoWordmark className="mt-4 justify-center" imageClassName="max-w-[210px]" subtitleClassName="text-[11px] uppercase tracking-[0.16em] text-slate-500" />
          <p className="mt-5 text-sm font-medium leading-6 text-slate-600">
            Está cargando, puede tardar unos segundos.
          </p>
        </div>
      </div>
    </main>
  );
}

function Router() {
  return (
    <>
      <AppUrlListener />
      <DemoViewGuard />
      <Suspense fallback={<RouteLoadingFallback />}>
        <Switch>
          <Route path={"/"} component={Home} />
          <Route path={"/acceso"} component={Access} />
          <Route path={"/auditar"} component={Auditar} />
          <Route path={"/pagos"} component={Payments} />
          <Route path={"/ceo"} component={CeoDashboard} />
          <Route path={"/ceo/bridge"} component={CeoDashboard} />
          <Route path={"/ceo/alertas"} component={CeoDashboard} />
          <Route path={"/ceo/accesos"} component={CeoDashboard} />
          <Route path={"/ceo/documentos"} component={CeoDashboard} />
          <Route path={"/aviso-de-privacidad"} component={LegalPrivacyPage} />
          <Route path={"/privacidad"} component={LegalPrivacyPage} />
          <Route path={"/legal/privacidad"} component={LegalPrivacyPage} />
          <Route path={"/legal/terminos"} component={LegalTermsPage} />
          <Route path={"/404"} component={NotFound} />
          <Route component={NotFound} />
        </Switch>
      </Suspense>
    </>
  );
}

function MobileQuickExit() {
  const [location] = useLocation();

  if (location === "/" || location === "/acceso") {
    return null;
  }

  return (
    <a
      href="/"
      className="fixed bottom-3 right-3 z-50 rounded-full bg-slate-950 px-3.5 py-2 text-sm font-semibold text-white shadow-[0_18px_34px_-24px_rgba(15,23,42,0.42)] transition hover:bg-slate-900 sm:hidden">Salir</a>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark" switchable>
        <TooltipProvider>
          <Toaster />
          <Router />
          <MobileQuickExit />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;

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
const Access = lazy(() => import("@/pages/AccessGate"));
const Auditar = lazy(() => import("@/pages/Auditar"));
const Payments = lazy(() => import("@/pages/Payments"));
const CeoDashboard = lazy(() => import("@/pages/CeoDashboard"));
const NotFound = lazy(() => import("./pages/NotFound"));
const PapersPlaceholder = lazy(() => import("./pages/PapersPlaceholder"));
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
    <main className="audita-access min-h-screen bg-[radial-gradient(circle_at_top,_rgba(20,184,166,0.12),_transparent_30%),linear-gradient(180deg,#f8fbfc_0%,#eef4f5_100%)] text-slate-950">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl items-center justify-center px-6 py-16">
        <div className="ap-access-surface w-full max-w-sm px-6 py-7 text-center">
          <div className="ap-access-mark flex justify-center">
            <AuditaPatronLogoIcon imageClassName="h-12 w-12 object-contain" />
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
          <Route path={"/historial"} component={PapersPlaceholder} />
          <Route path={"/expediente"} component={PapersPlaceholder} />
          <Route path={"/404"} component={NotFound} />
          <Route component={NotFound} />
        </Switch>
      </Suspense>
    </>
  );
}

function MobileQuickExit() {
  const [location] = useLocation();
  const path = location.split("?")[0];

  if (
    path === "/" ||
    path === "/acceso" ||
    path === "/auditar" ||
    path === "/historial" ||
    path === "/expediente" ||
    path === "/pagos" ||
    path === "/404" ||
    path.startsWith("/ceo") ||
    path.startsWith("/aviso-de-privacidad") ||
    path.startsWith("/privacidad") ||
    path.startsWith("/legal")
  ) {
    return null;
  }

  return (
    <div className="sm:hidden border-b border-slate-200 bg-white px-3 py-2">
      <a
        href="/"
        aria-label="Volver al inicio"
        title="Volver al inicio"
        className="inline-flex items-center rounded-full bg-slate-950 px-3.5 py-2 text-sm font-semibold text-white"
      >
        Volver
      </a>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark" switchable>
        <TooltipProvider>
          <Toaster />
          <MobileQuickExit />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;

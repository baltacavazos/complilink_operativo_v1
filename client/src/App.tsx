import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Auditar from "./pages/Auditar";
import CeoDashboard from "./pages/CeoDashboard";
import Home from "./pages/Home";
import { LegalPrivacyPage, LegalTermsPage } from "./pages/LegalDocuments";
import Access from "./pages/Access";

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
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
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

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

import { AuditaPatronLogoIcon, AuditaPatronLogoWordmark } from "@/components/AuditaPatronLogo";
import { ArrowLeft, Loader2 } from "lucide-react";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import LocalPasswordForm from "./LocalPasswordForm";

const AccessLegacy = lazy(() => import("./Access"));

type AccessMode = "signup" | "signin";

function getAccessModeFromSearch(): AccessMode {
  if (typeof window === "undefined") return "signin";
  const params = new URLSearchParams(window.location.search);
  const mode = (params.get("mode") || params.get("type") || "").toLowerCase();
  if (mode === "signup" || mode === "register") return "signup";
  return "signin";
}

function getReturnTo(): string {
  if (typeof window === "undefined") return "/auditar";
  const params = new URLSearchParams(window.location.search);
  const raw = params.get("returnTo") || params.get("return") || "/auditar";
  return raw.startsWith("/") ? raw : "/auditar";
}

export default function AccessGate() {
  const [location] = useLocation();
  const [localPasswordEnabled, setLocalPasswordEnabled] = useState<boolean | null>(null);
  const accessMode = useMemo(() => getAccessModeFromSearch(), [location]);
  const returnTo = useMemo(() => getReturnTo(), [location]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/local/status")
      .then((r) => r.json())
      .then((data: { enabled?: boolean }) => {
        if (!cancelled) setLocalPasswordEnabled(Boolean(data?.enabled));
      })
      .catch(() => {
        if (!cancelled) setLocalPasswordEnabled(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (localPasswordEnabled === null) {
    return (
      <main className="audita-access min-h-screen bg-[radial-gradient(circle_at_top,_rgba(20,184,166,0.12),_transparent_30%),linear-gradient(180deg,#f8fbfc_0%,#eef4f5_100%)] text-slate-950">
        <div className="mx-auto flex min-h-screen w-full max-w-md items-center justify-center px-6 py-16">
          <div className="ap-access-surface w-full px-2 py-6 text-center">
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-teal-700" />
            <p className="mt-4 text-sm text-slate-600">Preparando el acceso…</p>
          </div>
        </div>
      </main>
    );
  }

  if (localPasswordEnabled === false) {
    return (
      <Suspense
        fallback={
          <main className="audita-access min-h-screen bg-[radial-gradient(circle_at_top,_rgba(20,184,166,0.12),_transparent_30%),linear-gradient(180deg,#f8fbfc_0%,#eef4f5_100%)] text-slate-950">
            <div className="mx-auto flex min-h-screen items-center justify-center px-6">
              <Loader2 className="h-6 w-6 animate-spin text-teal-700" />
            </div>
          </main>
        }
      >
        <AccessLegacy />
      </Suspense>
    );
  }

  return (
    <main className="audita-access min-h-screen bg-[radial-gradient(circle_at_top,_rgba(20,184,166,0.12),_transparent_30%),linear-gradient(180deg,#f8fbfc_0%,#eef4f5_100%)] text-slate-950">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-5 py-12 sm:px-6 sm:py-16">
        <div className="ap-access-surface px-1 py-4">
          <a
            href="/"
            data-testid="mobile-header-back"
            className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-800 sm:hidden"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={1.8} />
            Volver
          </a>
          <div className="ap-access-mark flex justify-center">
            <AuditaPatronLogoIcon imageClassName="h-12 w-12 object-contain" />
          </div>
          <AuditaPatronLogoWordmark
            className="mt-5 justify-center"
            imageClassName="max-w-[210px]"
            subtitleClassName="text-[11px] tracking-tight text-slate-500"
          />
          <LocalPasswordForm returnPath={returnTo} accessMode={accessMode} />
          <div className="mt-8 hidden justify-center sm:flex">
            <a href="/" className="text-sm font-medium text-slate-600 hover:text-slate-900">
              Volver al inicio
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}

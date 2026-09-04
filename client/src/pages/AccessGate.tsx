import { AuditaPatronLogoIcon, AuditaPatronLogoWordmark } from "@/components/AuditaPatronLogo";
import { Loader2 } from "lucide-react";
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
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(20,184,166,0.12),_transparent_30%),linear-gradient(180deg,#f8fbfc_0%,#eef4f5_100%)] text-slate-950">
        <div className="mx-auto flex min-h-screen w-full max-w-lg items-center justify-center px-6 py-10">
          <div className="w-full rounded-[2rem] border border-slate-200 bg-white/95 px-6 py-8 text-center shadow-[0_28px_80px_-42px_rgba(15,23,42,0.34)]">
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
          <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(20,184,166,0.12),_transparent_30%),linear-gradient(180deg,#f8fbfc_0%,#eef4f5_100%)] text-slate-950">
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
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(20,184,166,0.12),_transparent_30%),linear-gradient(180deg,#f8fbfc_0%,#eef4f5_100%)] text-slate-950">
      <div className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center px-6 py-10">
        <div className="rounded-[2rem] border border-slate-200 bg-white/95 px-6 py-8 shadow-[0_28px_80px_-42px_rgba(15,23,42,0.34)]">
          <div className="flex justify-center">
            <AuditaPatronLogoIcon imageClassName="h-12 w-12 rounded-2xl border border-slate-200 bg-white object-contain p-2 shadow-sm" />
          </div>
          <AuditaPatronLogoWordmark
            className="mt-4 justify-center"
            imageClassName="max-w-[210px]"
            subtitleClassName="text-[11px] uppercase tracking-[0.16em] text-slate-500"
          />
          <h1 className="mt-6 text-center text-2xl font-semibold tracking-tight text-slate-950">
            {accessMode === "signup" ? "Crea tu cuenta" : "Entra a tu cuenta"}
          </h1>
          <p className="mt-2 text-center text-sm leading-6 text-slate-600">
            Copia temporal para pruebas. La revisión pública por RFC sigue disponible sin cuenta.
          </p>
          <LocalPasswordForm returnPath={returnTo} accessMode={accessMode} />
          <div className="mt-6 flex justify-center">
            <a href="/" className="text-sm font-medium text-slate-600 hover:text-slate-900">
              Volver al inicio
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}

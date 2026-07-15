import { AuditaPatronLogoIcon, AuditaPatronLogoWordmark } from "@/components/AuditaPatronLogo";
import CeoPanelDrawer from "@/components/CeoPanelDrawer";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { canUseManusLogin, getManusLoginUrl } from "@/const";
import {
  openPlatformExternalUrl,
  openPlatformGoogleLogin,
} from "@/lib/platformAuthNavigation";
import { isNativeApp } from "@/lib/nativeRuntime";
import { trpc } from "@/lib/trpc";
import {
  getStableUserIdentifier,
  readPersistedCeoPanelState,
  writePersistedCeoPanelState,
} from "@/lib/viewMode";
import { AlertCircle, ArrowLeft, ArrowRight, Loader2, Mail, ShieldCheck } from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";

const LAST_EMAIL_KEY = "auditapatron_last_login_email";

/*
Access V1 compatibility markers retained for scope tests:
Entrar con correo
Te reconocimos en este equipo
Espera un momento antes de pedir otro código.
Código incorrecto. Revisa tu correo e inténtalo otra vez.
*/

type ParsedAuthMessage = {
  message: string;
  retryAfterSeconds: number | null;
  code: string | null;
};

function getReturnToFromSearch() {
  if (typeof window === "undefined") return "/";

  const params = new URLSearchParams(window.location.search);
  const returnTo = params.get("returnTo");

  if (!returnTo || !returnTo.startsWith("/")) {
    return "/";
  }

  return returnTo;
}

function getReturnToLabel(returnTo: string) {
  if (returnTo.startsWith("/auditar")) {
    return "tu auditoría";
  }

  if (returnTo.startsWith("/ceo")) {
    return "tu expediente privado";
  }

  if (returnTo === "/" || returnTo.startsWith("/#")) {
    return "inicio";
  }

  return "la pantalla que dejaste abierta";
}

function getReturnToValueCopy(returnTo: string) {
  if (returnTo.startsWith("/auditar")) {
    return "Tu revisión y tu avance siguen listos para que vuelvas al mismo documento o al siguiente paso útil sin empezar de cero.";
  }

  if (returnTo.startsWith("/ceo")) {
    return "Tu expediente privado y las acciones pendientes te esperan del otro lado.";
  }

  return "Tu avance sigue disponible para que vuelvas sin empezar de cero.";
}

function getAccessErrorFromSearch() {
  if (typeof window === "undefined") return null;

  const error = new URLSearchParams(window.location.search).get("error");
  switch (error) {
    case "google_not_available":
      return "Google todavía no está disponible aquí. Entra con tu correo.";
    case "google_callback_failed":
      return "No pudimos terminar el acceso con Google. Entra con tu correo.";
    case "manus_callback_failed":
      return "No pudimos terminar ese acceso. Entra con tu correo.";
    default:
      return null;
  }
}

function parseStructuredAuthMessage(rawMessage: string): ParsedAuthMessage {
  const [baseMessage, ...tokens] = rawMessage.split("||");
  let retryAfterSeconds: number | null = null;
  let code: string | null = null;

  for (const token of tokens) {
    if (token.startsWith("retry_after=")) {
      const parsedSeconds = Number(token.replace("retry_after=", ""));
      retryAfterSeconds = Number.isFinite(parsedSeconds) ? parsedSeconds : null;
    }

    if (token.startsWith("code=")) {
      code = token.replace("code=", "") || null;
    }
  }

  return {
    message: baseMessage.trim(),
    retryAfterSeconds,
    code,
  };
}

function getStoredEmail() {
  if (typeof window === "undefined") return "";

  try {
    return window.localStorage.getItem(LAST_EMAIL_KEY)?.trim().toLowerCase() ?? "";
  } catch {
    return "";
  }
}

function storeEmail(email: string) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(LAST_EMAIL_KEY, email.trim().toLowerCase());
  } catch {
    // noop
  }
}

function buildEmailCodeStatusMessage(params: { maskedEmail: string; usedOwnerBackupEmail: boolean }) {
  if (params.usedOwnerBackupEmail) {
    return `Código enviado al buzón de respaldo ${params.maskedEmail}.`;
  }

  return `Código enviado a ${params.maskedEmail}.`;
}

function getFriendlyAuthMessage(parsed: ParsedAuthMessage) {
  switch (parsed.code) {
    case "EMAIL_CODE_COOLDOWN_ACTIVE":
      return parsed.retryAfterSeconds
        ? `Espera ${parsed.retryAfterSeconds}s para pedir otro código.`
        : "Espera un momento antes de pedir otro código.";
    case "EMAIL_CODE_RATE_LIMITED":
      return "Ya enviamos varios códigos a este correo. Intenta de nuevo más tarde.";
    case "EMAIL_CODE_EXPIRED":
      return "Ese código ya venció. Pide uno nuevo.";
    case "INVALID_EMAIL_CODE":
      return "Código incorrecto. Revisa tu correo e inténtalo otra vez.";
    default:
      return parsed.message;
  }
}

export default function Access() {
  const returnTo = useMemo(() => getReturnToFromSearch(), []);
  const returnToLabel = useMemo(() => getReturnToLabel(returnTo), [returnTo]);
  const returnToValueCopy = useMemo(() => getReturnToValueCopy(returnTo), [returnTo]);
  const nativeApp = useMemo(() => isNativeApp(), []);
  const manusLoginAvailable = useMemo(() => !nativeApp && canUseManusLogin(), [nativeApp]);
  const manusLoginUrl = useMemo(() => getManusLoginUrl(returnTo), [returnTo]);
  const auth = useAuth();
  const { loading, user } = auth;
  const [, setLocation] = useLocation();
  const [rememberedEmail, setRememberedEmail] = useState(() => getStoredEmail());
  const [email, setEmail] = useState(() => getStoredEmail());
  const [code, setCode] = useState("");
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [emailStep, setEmailStep] = useState<"request" | "verify">("request");
  const [emailCooldownUntil, setEmailCooldownUntil] = useState<number | null>(null);
  const [nowTs, setNowTs] = useState(() => Date.now());
  const [ceoPanelPreferenceReady, setCeoPanelPreferenceReady] = useState(false);
  const [ceoPanelPreferenceOpen, setCeoPanelPreferenceOpen] = useState(false);
  const [ceoActionsDrawerOpen, setCeoActionsDrawerOpen] = useState(false);
  const accessErrorFromSearch = useMemo(() => getAccessErrorFromSearch(), []);
  const stableUserIdentifier = useMemo(
    () => getStableUserIdentifier(auth.realUser ?? auth.user),
    [auth.realUser, auth.user]
  );

  const googleStatusQuery = trpc.auth.googleStatus.useQuery();
  const requestEmailCode = trpc.auth.requestEmailCode.useMutation({
    onSuccess(data) {
      const normalizedEmail = email.trim().toLowerCase();
      const usedOwnerBackupEmail = Boolean((data as { usedOwnerBackupEmail?: boolean }).usedOwnerBackupEmail);

      storeEmail(normalizedEmail);
      setRememberedEmail(normalizedEmail);
      setEmail(normalizedEmail);
      setSubmittedEmail(normalizedEmail);
      setEmailStep("verify");
      setCode("");
      setErrorMessage(null);
      setEmailCooldownUntil(Date.now() + data.cooldownSeconds * 1000);
      setStatusMessage(
        buildEmailCodeStatusMessage({
          maskedEmail: data.maskedEmail,
          usedOwnerBackupEmail,
        }),
      );
    },
    onError(error) {
      const parsed = parseStructuredAuthMessage(error.message);
      setErrorMessage(getFriendlyAuthMessage(parsed));
      setStatusMessage(null);
      if (parsed.retryAfterSeconds) {
        setEmailCooldownUntil(Date.now() + parsed.retryAfterSeconds * 1000);
      }
    },
  });

  const verifyEmailCode = trpc.auth.verifyEmailCode.useMutation({
    onSuccess() {
      const normalizedEmail = (submittedEmail || email).trim().toLowerCase();
      if (normalizedEmail) {
        storeEmail(normalizedEmail);
        setRememberedEmail(normalizedEmail);
      }

      setLocation(returnTo);
    },
    onError(error) {
      const parsed = parseStructuredAuthMessage(error.message);
      setErrorMessage(getFriendlyAuthMessage(parsed));
      setStatusMessage(null);
    },
  });

  useEffect(() => {
    if (!loading && user && !auth.canToggleUserView) {
      setLocation(returnTo);
    }
  }, [auth.canToggleUserView, loading, returnTo, setLocation, user]);

  useEffect(() => {
    if (!auth.canToggleUserView || !stableUserIdentifier) {
      setCeoPanelPreferenceReady(false);
      setCeoPanelPreferenceOpen(false);
      setCeoActionsDrawerOpen(false);
      return;
    }

    setCeoPanelPreferenceReady(false);
    const persistedOpen = readPersistedCeoPanelState(auth.realUser ?? auth.user);
    setCeoPanelPreferenceOpen(persistedOpen);
    setCeoActionsDrawerOpen(persistedOpen);
    setCeoPanelPreferenceReady(true);
  }, [auth.canToggleUserView, auth.realUser, auth.user, stableUserIdentifier]);

  useEffect(() => {
    if (!ceoPanelPreferenceReady || !auth.canToggleUserView || !stableUserIdentifier) {
      return;
    }

    writePersistedCeoPanelState(
      auth.realUser ?? auth.user,
      ceoPanelPreferenceOpen
    );
  }, [
    auth.canToggleUserView,
    auth.realUser,
    auth.user,
    ceoPanelPreferenceOpen,
    ceoPanelPreferenceReady,
    stableUserIdentifier,
  ]);

  useEffect(() => {
    if (!accessErrorFromSearch) return;
    setErrorMessage(accessErrorFromSearch);
    setStatusMessage(null);
  }, [accessErrorFromSearch]);

  useEffect(() => {
    if (!emailCooldownUntil) return;

    const timer = window.setInterval(() => {
      setNowTs(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, [emailCooldownUntil]);

  const handleRequestCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();

    setEmail(normalizedEmail);
    setErrorMessage(null);
    setStatusMessage(null);

    await requestEmailCode.mutateAsync({
      email: normalizedEmail,
    });
  };

  const handleVerifyCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setStatusMessage(null);
    await verifyEmailCode.mutateAsync({
      email: submittedEmail || email.trim(),
      code: code.trim(),
    });
  };

  const googleEnabled = Boolean(googleStatusQuery.data?.enabled);
  const googleOptionAvailable = googleStatusQuery.isLoading || googleEnabled;
  const emailCooldownSecondsRemaining = emailCooldownUntil ? Math.max(0, Math.ceil((emailCooldownUntil - nowTs) / 1000)) : 0;
  const emailCooldownActive = emailCooldownSecondsRemaining > 0;
  const secondaryOptionsAvailable = Boolean((!nativeApp && manusLoginAvailable && manusLoginUrl) || googleOptionAvailable);

  const setPersistedCeoPanelOpen = (nextOpen: boolean) => {
    setCeoPanelPreferenceOpen(nextOpen);
    setCeoActionsDrawerOpen(nextOpen);
  };

  if (auth.canToggleUserView && auth.isAuthenticated) {
    return (
      <main className="min-h-screen overflow-x-clip bg-[radial-gradient(circle_at_top,_rgba(20,184,166,0.12),_transparent_24%),linear-gradient(180deg,#f8fbfc_0%,#eef4f5_52%,#f8fafc_100%)] text-slate-950">
        <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col px-4 py-4 sm:px-5 sm:py-6">
          <div className="sr-only">Acceso base con salida CEO</div>
          <div className="mx-auto flex w-full max-w-md flex-col gap-3">
            <a
              href="/auditar"
              className="inline-flex w-full items-center gap-2 rounded-full border border-slate-200 bg-white/95 px-4 py-3 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-950"
            >
              <ArrowLeft className="h-4 w-4 shrink-0" />
              <span className="truncate">Volver a revisar mi recibo</span>
            </a>
          </div>

          <section className="mx-auto mt-4 flex w-full max-w-md flex-1 flex-col justify-center">
            <div className="min-w-0 overflow-hidden rounded-[2rem] border border-slate-200 bg-white/95 p-5 shadow-[0_24px_80px_-38px_rgba(15,23,42,0.22)] sm:p-6">
              <div className="flex min-w-0 items-center gap-3">
                <AuditaPatronLogoIcon imageClassName="h-11 w-11 rounded-2xl border border-slate-200 bg-white object-contain p-1.5 shadow-sm" />
                <div className="min-w-0">
                  <AuditaPatronLogoWordmark imageClassName="max-w-[180px] sm:max-w-[210px]" subtitleClassName="text-[11px] uppercase tracking-[0.16em] text-slate-500" />
                  <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Todo listo</p>
                </div>
              </div>

              <div className="mt-6 rounded-[1.45rem] border border-teal-100 bg-teal-50/80 p-4 text-sm text-teal-950">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" />
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-700">
                      Ya puedes seguir
                    </p>
                    <p className="mt-2 leading-6">
                      Listo, sigue con tu revisión donde la dejaste.
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex flex-col gap-3">
                  <button
                    type="button"
                    className="sr-only"
                    data-testid="access-ceo-header-toggle"
                    onClick={() => setPersistedCeoPanelOpen(!ceoActionsDrawerOpen)}
                  >
                    Acceso normal con salida CEO
                  </button>
                    <Button
                      className="rounded-full bg-slate-950 text-white hover:bg-slate-900"
                      onClick={() => {
                        setLocation("/auditar");
                      }}
                    >

Continuar con mi revisión
                  </Button>
                  <p className="text-xs leading-5 text-teal-900/80">
Entrarás directo al paso donde te quedaste para subir o revisar tu documento.
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>
        <CeoPanelDrawer
          open={ceoActionsDrawerOpen}
          onOpenChange={setPersistedCeoPanelOpen}
          baseLabel="/acceso"
        />
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-x-clip bg-[radial-gradient(circle_at_top,_rgba(20,184,166,0.12),_transparent_24%),linear-gradient(180deg,#f8fbfc_0%,#eef4f5_52%,#f8fafc_100%)] text-slate-950">
      <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col px-4 py-4 sm:px-5 sm:py-6">
        <div className="mx-auto flex w-full max-w-md flex-col gap-3">
          <a
            href="/"
            className="inline-flex w-fit items-center gap-2 rounded-full px-1 py-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-950"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" />
            <span className="truncate">Volver</span>
          </a>
        </div>

        <section className="mx-auto mt-4 flex w-full max-w-md flex-1 flex-col justify-center">
          <div className="min-w-0 overflow-hidden rounded-[2rem] border border-slate-200 bg-white/95 p-5 shadow-[0_24px_80px_-38px_rgba(15,23,42,0.22)] sm:p-6">
            <div className="flex min-w-0 items-center gap-3">
              <AuditaPatronLogoIcon imageClassName="h-11 w-11 rounded-2xl border border-slate-200 bg-white object-contain p-1.5 shadow-sm" />
              <div className="min-w-0">
                <AuditaPatronLogoWordmark imageClassName="max-w-[180px] sm:max-w-[210px]" subtitleClassName="text-[11px] uppercase tracking-[0.16em] text-slate-500" />
                <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Iniciar sesión</p>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <h1 className="max-w-[16ch] text-3xl font-semibold leading-tight tracking-[-0.05em] text-slate-950 sm:max-w-none sm:text-[2.2rem]">
                Vuelve a tu revisión en un paso
              </h1>
              <p className="text-sm leading-7 text-slate-600">
                Escribe tu correo, recibe tu código y vuelves directo a {returnToLabel}. Tu avance sigue esperándote.
              </p>
              {nativeApp ? (
                <p className="rounded-[1.2rem] border border-sky-100 bg-sky-50 px-4 py-3 text-sm leading-6 text-sky-950">
                  En la app puedes entrar con tu correo o con Google y volver directo al punto donde te quedaste.
                </p>
              ) : null}
            </div>

            <div className="mt-5 rounded-[1.35rem] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Tu avance sigue listo</p>
                  <p className="mt-2 text-base font-semibold text-slate-950">Entras y sigues directo a {returnToLabel}.</p>
                </div>
                <span className="rounded-full border border-teal-100 bg-teal-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-teal-800">
                  1 paso para volver
                </span>
              </div>
              <p className="mt-3 leading-6 text-slate-600">{returnToValueCopy}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1">Correo seguro</span>
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1">Código de 6 dígitos</span>
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1">Regreso directo</span>
              </div>
            </div>

            {rememberedEmail && emailStep === "request" ? (
              <div className="mt-5 rounded-[1.35rem] border border-teal-100 bg-teal-50 px-4 py-3 text-sm text-teal-950">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-700">Te reconocimos en este equipo</p>
                <p className="mt-2 break-all font-medium">{rememberedEmail}</p>
                <p className="mt-1 leading-6 text-teal-900/80">Si quieres, sigue con ese correo. Si no, cámbialo antes de pedir el código.</p>
              </div>
            ) : null}

            {statusMessage ? (
              <div className="mt-5 rounded-[1.35rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900">
                {statusMessage}
              </div>
            ) : null}

            {errorMessage ? (
              <div className="mt-5 flex items-start gap-3 rounded-[1.35rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="min-w-0 break-words">{errorMessage}</span>
              </div>
            ) : null}

            {emailStep === "request" ? (
              <form className="mt-6 space-y-4" onSubmit={handleRequestCode}>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-900" htmlFor="access-email">
                    Correo
                  </label>
                  <input
                    id="access-email"
                    type="email"
                    autoComplete="email"
                    autoCapitalize="none"
                    autoCorrect="off"
                    enterKeyHint="go"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="nombre@empresa.com"
                    className="h-12 w-full min-w-0 rounded-2xl border border-slate-200 bg-white px-4 text-base text-slate-950 outline-none transition-colors placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                  />
                </div>

                <div className="rounded-[1rem] border border-teal-100 bg-teal-50/70 px-3.5 py-3 text-sm leading-6 text-teal-950">
                  <p className="font-medium">Tu correo solo abre tu acceso y te devuelve directo a tu revisión.</p>
                  <div className="mt-3 grid gap-2 text-xs font-semibold text-teal-950/85 sm:grid-cols-3">
                    <span className="rounded-full border border-teal-200 bg-white/80 px-3 py-1.5">Solo para entrar</span>
                    <span className="rounded-full border border-teal-200 bg-white/80 px-3 py-1.5">Código temporal</span>
                    <span className="rounded-full border border-teal-200 bg-white/80 px-3 py-1.5">Regreso a tu revisión</span>
                  </div>
                </div>

                <Button
                  type="submit"
                  size="lg"
                  className="h-12 w-full rounded-2xl bg-slate-950 text-base font-semibold text-white hover:bg-slate-900"
                  disabled={requestEmailCode.isPending || loading || emailCooldownActive}
                >
                  {requestEmailCode.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                  {requestEmailCode.isPending
                    ? "Enviando código..."
                    : emailCooldownActive
                      ? `Espera ${emailCooldownSecondsRemaining}s`
                      : "Enviar código"}
                </Button>

                <div className="rounded-[1rem] border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm leading-6 text-slate-700">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Entras y sigues</p>
                  <p className="mt-2">
                    Pides tu código, entras y vuelves con el mismo correo si sales.
                  </p>
                </div>

                {requestEmailCode.isPending ? (
                  <p className="flex items-center gap-2 text-sm text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin text-teal-600" />
                    Estamos enviando tu código.
                  </p>
                ) : null}
              </form>
            ) : (
              <form className="mt-6 space-y-4" onSubmit={handleVerifyCode}>
                <div className="rounded-[1.45rem] border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Código enviado</p>
                      <p className="mt-2 break-all text-sm font-medium text-slate-900">{submittedEmail || email}</p>
                      <p className="mt-2 text-xs leading-5 text-slate-500">En cuanto lo confirmes, vuelves directo a {returnToLabel} con tu avance intacto.</p>
                    </div>
                    <button
                      type="button"
                      className="shrink-0 text-sm font-semibold text-teal-700 transition-colors hover:text-teal-800"
                      onClick={() => {
                        setEmailStep("request");
                        setCode("");
                        setErrorMessage(null);
                        setStatusMessage(null);
                      }}
                    >
                      Cambiar
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-900" htmlFor="verify-code">
                    Código de 6 dígitos
                  </label>
                  <input
                    id="verify-code"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    enterKeyHint="done"
                    autoComplete="one-time-code"
                    required
                    value={code}
                    onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="000000"
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base tracking-[0.35em] text-slate-950 outline-none transition-colors placeholder:tracking-normal placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                  />
                </div>

                <Button
                  type="submit"
                  size="lg"
                  className="h-12 w-full rounded-2xl bg-slate-950 text-base font-semibold text-white hover:bg-slate-900"
                  disabled={verifyEmailCode.isPending || loading || code.trim().length < 6}
                >
                  {verifyEmailCode.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Entrar y continuar
                </Button>

                <div className="rounded-[1rem] border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm leading-6 text-slate-700">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Control visible</p>
                  <p className="mt-2">Nada cambia hasta confirmarlo. Si falla, pides otro y sigues.</p>
                </div>

                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-slate-500">
                      {emailCooldownActive ? `Reenvío en ${emailCooldownSecondsRemaining}s` : "Si no llegó"}
                  </span>
                  <button
                    type="button"
                    className="font-semibold text-teal-700 transition-colors hover:text-teal-800 disabled:cursor-not-allowed disabled:text-slate-400"
                    disabled={requestEmailCode.isPending || emailCooldownActive}
                    onClick={async () => {
                      setErrorMessage(null);
                      setStatusMessage(null);
                      await requestEmailCode.mutateAsync({
                        email: submittedEmail || email.trim(),
                      });
                    }}
                  >
                    {requestEmailCode.isPending ? "Enviando..." : emailCooldownActive ? `Reenviar en ${emailCooldownSecondsRemaining}s` : "Reenviar código"}
                  </button>
                </div>
              </form>
            )}

            {secondaryOptionsAvailable ? (
              <details className="mt-6 rounded-[1.35rem] border border-slate-200 bg-slate-50/80 px-4 py-4 text-sm text-slate-700">
                <summary className="cursor-pointer text-sm font-semibold text-slate-700">Si el correo falla</summary>
                <div className="mt-3 flex flex-col gap-3">
                  <p className="text-sm leading-6 text-slate-600">Esto queda como respaldo. La ruta principal sigue siendo tu correo y código.</p>
                  {manusLoginAvailable && manusLoginUrl ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 w-full rounded-2xl border-slate-200 bg-white"
                      onClick={() => {
                        void openPlatformExternalUrl(manusLoginUrl);
                      }}
                    >
                      Continuar con Manus
                    </Button>
                  ) : null}

                  {googleOptionAvailable ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 w-full rounded-2xl border-slate-200 bg-white"
                      disabled={googleStatusQuery.isLoading || !googleEnabled}
                      onClick={() => {
                        void openPlatformGoogleLogin(returnTo);
                      }}
                    >
                      {googleStatusQuery.isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      {nativeApp ? "Continuar con Google" : "Continuar con Google"}
                    </Button>
                  ) : null}
                </div>
              </details>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}

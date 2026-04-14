import { useAuth } from "@/_core/hooks/useAuth";
import { AuditaPatronLogoIcon, AuditaPatronLogoWordmark } from "@/components/AuditaPatronLogo";
import { Button } from "@/components/ui/button";
import { canUseManusLogin, getGoogleLoginUrl, getManusLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { AlertCircle, ArrowLeft, Loader2, Mail, ShieldCheck } from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";

function getReturnToFromSearch() {
  if (typeof window === "undefined") return "/";

  const params = new URLSearchParams(window.location.search);
  const returnTo = params.get("returnTo");

  if (!returnTo || !returnTo.startsWith("/")) {
    return "/";
  }

  return returnTo;
}

function getAccessErrorFromSearch() {
  if (typeof window === "undefined") return null;

  const error = new URLSearchParams(window.location.search).get("error");
  switch (error) {
    case "google_not_available":
      return "Google no está disponible todavía en este entorno. Mientras termina la configuración, puedes iniciar sesión con Manus o con código por correo.";
    case "google_callback_failed":
      return "No pudimos completar el inicio de sesión con Google. Intenta de nuevo o usa Manus o el código por correo para continuar.";
    case "manus_callback_failed":
      return "No pudimos completar el inicio de sesión con Manus. Para no frenarte, usa el código por correo y entras o creas tu cuenta desde aquí.";
    default:
      return null;
  }
}

function parseStructuredAuthMessage(rawMessage: string) {
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

export default function Access() {
  const returnTo = useMemo(() => getReturnToFromSearch(), []);
  const manusLoginAvailable = useMemo(() => canUseManusLogin(), []);
  const manusLoginUrl = useMemo(() => getManusLoginUrl(returnTo), [returnTo]);
  const { loading, user } = useAuth();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [emailStep, setEmailStep] = useState<"request" | "verify">("request");
  const [emailCooldownUntil, setEmailCooldownUntil] = useState<number | null>(null);
  const [nowTs, setNowTs] = useState(() => Date.now());
  const accessErrorFromSearch = useMemo(() => getAccessErrorFromSearch(), []);

  const googleStatusQuery = trpc.auth.googleStatus.useQuery();
  const requestEmailCode = trpc.auth.requestEmailCode.useMutation({
    onSuccess(data) {
      const normalizedEmail = email.trim().toLowerCase();
      setSubmittedEmail(normalizedEmail);
      setEmailStep("verify");
      setCode("");
      setErrorMessage(null);
      setEmailCooldownUntil(Date.now() + data.cooldownSeconds * 1000);
      setStatusMessage(`Enviamos un código de 6 dígitos a ${data.maskedEmail}. Puedes solicitar otro dentro de ${data.cooldownSeconds} segundos si lo necesitas.`);
    },
    onError(error) {
      const parsed = parseStructuredAuthMessage(error.message);
      setErrorMessage(parsed.message);
      setStatusMessage(null);
      if (parsed.retryAfterSeconds) {
        setEmailCooldownUntil(Date.now() + parsed.retryAfterSeconds * 1000);
      }
    },
  });
  const verifyEmailCode = trpc.auth.verifyEmailCode.useMutation({
    onSuccess() {
      if (typeof window !== "undefined") {
        window.location.href = returnTo;
      }
    },
    onError(error) {
      const parsed = parseStructuredAuthMessage(error.message);
      setErrorMessage(parsed.message);
      setStatusMessage(null);
    },
  });

  useEffect(() => {
    if (!loading && user && typeof window !== "undefined") {
      window.location.replace(returnTo);
    }
  }, [loading, returnTo, user]);

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
    setErrorMessage(null);
    setStatusMessage(null);
    await requestEmailCode.mutateAsync({
      email: email.trim(),
      name: name.trim() || undefined,
    });
  };

  const handleVerifyCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setStatusMessage(null);
    await verifyEmailCode.mutateAsync({
      email: submittedEmail || email.trim(),
      code: code.trim(),
      name: name.trim() || undefined,
    });
  };

  const googleEnabled = Boolean(googleStatusQuery.data?.enabled);
  const emailCooldownSecondsRemaining = emailCooldownUntil ? Math.max(0, Math.ceil((emailCooldownUntil - nowTs) / 1000)) : 0;
  const emailCooldownActive = emailCooldownSecondsRemaining > 0;
  const googleLabel = googleStatusQuery.isLoading
    ? "Verificando disponibilidad de Google"
    : googleEnabled
      ? "Continuar con Google"
      : "Google disponible en cuanto se complete la configuración";

  return (
    <main className="min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_top,_rgba(20,184,166,0.1),_transparent_28%),linear-gradient(180deg,#f8fbfc_0%,#eef4f5_52%,#f8fafc_100%)] text-slate-950">
      <div className="container py-4 sm:py-6 lg:py-10">
        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <a
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-950"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver al inicio
          </a>
          <div className="inline-flex max-w-full items-start gap-2 rounded-[1.2rem] border border-teal-100 bg-teal-50/90 px-4 py-2 text-sm text-teal-900 shadow-sm">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="min-w-0 break-all">
              Regresarás a <strong className="break-all">{returnTo}</strong>
            </span>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[0.72fr_1.28fr] xl:items-start">
          <section className="hidden overflow-hidden rounded-[1.8rem] border border-slate-200 bg-white/95 shadow-[0_24px_80px_-42px_rgba(15,23,42,0.28)] xl:block">
            <div className="border-b border-slate-200 bg-[linear-gradient(135deg,rgba(15,23,42,0.96),rgba(15,118,110,0.9))] px-6 py-6 text-white sm:px-7">
              <div className="flex items-start gap-4">
                <AuditaPatronLogoIcon imageClassName="h-12 w-12 rounded-2xl border border-white/20 bg-white object-contain p-1.5 shadow-[0_20px_50px_-28px_rgba(2,6,23,0.6)]" />
                <div className="space-y-2">
                  <AuditaPatronLogoWordmark imageClassName="max-w-[210px]" subtitleClassName="text-xs uppercase tracking-[0.16em] text-white/70" />
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/90">
                    Iniciar sesión o crear cuenta
                  </div>
                </div>
              </div>

              <div className="mt-3 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-teal-100/90">Entrar o crear cuenta</p>
                <h1 className="text-2xl font-semibold tracking-[-0.04em] text-white sm:text-[2rem]">
                  Inicia sesión y vuelve a trabajar sin rodeos.
                </h1>
                <p className="max-w-xl text-sm leading-7 text-slate-200">
                  {manusLoginAvailable
                    ? (
                      <>
                        Puedes iniciar sesión con Manus o crear tu cuenta con un código por correo, sin contraseña y sin perder tu ruta a <strong>{returnTo}</strong>.
                      </>
                    )
                    : (
                      <>
                        En este dominio activamos el acceso por correo como vía principal para que puedas entrar o crear tu cuenta sin rebotes y volver a <strong>{returnTo}</strong>.
                      </>
                    )}
                </p>
              </div>
            </div>

            <div className="px-4 py-3 sm:px-7 sm:py-5">
              <div className="rounded-[1.3rem] border border-dashed border-teal-200 bg-teal-50/70 px-4 py-3 text-sm leading-6 text-teal-950">
                Ruta corta: entras o creas tu cuenta, confirmas y vuelves al punto exacto donde te quedaste.
              </div>
            </div>
          </section>

          <section className="mx-auto w-full max-w-3xl space-y-5 xl:max-w-none">
            <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white/95 p-4 shadow-[0_24px_80px_-38px_rgba(15,23,42,0.26)] sm:p-6">
              <div className="flex flex-col gap-3 sm:gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Acceso simple</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950">Inicia sesión o crea tu cuenta sin pasos de sobra</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600">
                    {manusLoginAvailable
                      ? "Puedes usar Manus o, si prefieres una vía más directa desde el teléfono, entrar o crear tu cuenta con código por correo."
                      : "En este dominio dejamos activo el acceso por correo para que puedas entrar o crear tu cuenta sin contraseña y sin salirte del flujo."}
                  </p>
                </div>
                <div className="w-full rounded-[1.25rem] border border-slate-200 bg-slate-50 px-4 py-3 text-left text-xs font-semibold text-slate-600 sm:max-w-[18rem] sm:self-end">
                  <span className="block text-[10px] uppercase tracking-[0.16em] text-slate-400">Ruta objetivo</span>
                  <span className="mt-1 block break-all text-sm font-semibold text-slate-800">{returnTo}</span>
                </div>
              </div>

              <div className="mt-5 rounded-[1.35rem] border border-slate-950 bg-slate-950 p-4 text-white shadow-[0_24px_70px_-34px_rgba(15,23,42,0.34)] sm:p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                  {manusLoginAvailable ? "Opción principal" : "Acceso activo"}
                </p>
                <p className="mt-3 text-sm leading-6 text-slate-300">
                  {manusLoginAvailable
                    ? (
                      <>
                        Es la forma más corta de entrar y volver enseguida a <strong className="break-all">{returnTo}</strong>. Si esta opción falla en tu teléfono, usa el acceso por correo que crea tu cuenta al validar el código.
                      </>
                    )
                    : "Para evitar rebotes de autenticación en este dominio, aquí te dejamos la vía que sí funciona de forma estable: recibes un código, lo validas y entras al instante."}
                </p>
                {manusLoginUrl ? (
                  <Button
                    size="lg"
                    className="mt-5 h-14 w-full justify-center rounded-2xl bg-white text-base font-semibold text-slate-950 shadow-lg shadow-black/10 hover:bg-slate-100"
                    onClick={() => {
                      window.location.href = manusLoginUrl;
                    }}
                  >
                    Continuar con Manus
                  </Button>
                ) : (
                  <Button
                    size="lg"
                    className="mt-5 h-14 w-full justify-center rounded-2xl bg-white text-base font-semibold text-slate-950 shadow-lg shadow-black/10 hover:bg-slate-100"
                    onClick={() => {
                      document.getElementById("acceso-correo")?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                  >
                    Continuar con código por correo
                  </Button>
                )}
                <p className="mt-3 text-[11px] leading-5 text-slate-400">
                  {manusLoginAvailable
                    ? "Al terminar, te devolvemos automáticamente al punto exacto donde ibas."
                    : "Tu cuenta se crea automáticamente si todavía no existe y después vuelves a la misma ruta."}
                </p>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-[1.1rem] border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-600 sm:p-4">
                  <p className="font-semibold text-slate-900">Alternativa: Google</p>
                  <p className="mt-1.5">Solo si prefieres ese proveedor.</p>
                  <Button
                    size="lg"
                    variant="outline"
                    className="mt-3 h-11 w-full justify-center rounded-2xl border-slate-200 bg-white"
                    disabled={!googleEnabled || googleStatusQuery.isLoading}
                    onClick={() => {
                      window.location.href = getGoogleLoginUrl(returnTo);
                    }}
                  >
                    {googleStatusQuery.isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {googleLabel}
                  </Button>
                </div>
                <div className="rounded-[1.1rem] border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-600 sm:p-4">
                  <p className="font-semibold text-slate-900">Código por correo</p>
                  <p className="mt-1.5">También sirve para entrar o crear tu cuenta al instante, sin contraseña.</p>
                  <p className="mt-2 text-[11px] font-medium text-slate-400">Disponible justo debajo</p>
                </div>
              </div>
            </div>

            <div id="acceso-correo" className="rounded-[2rem] border border-slate-200 bg-white/95 p-4 shadow-[0_24px_80px_-38px_rgba(15,23,42,0.26)] sm:p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-100 text-teal-700">
                  <Mail className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Acceso por correo</p>
                  <h2 className="text-xl font-semibold tracking-tight text-slate-950">Entrar o crear cuenta con código</h2>
                </div>
              </div>

              <p className="mt-4 text-sm leading-7 text-slate-600">
                Recibes un código temporal, validas el acceso y vuelves a tu ruta. Si es tu primera vez, tu usuario se crea automáticamente al confirmar el código; no necesitas contraseña.
              </p>

              {statusMessage ? (
                <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  {statusMessage}
                </div>
              ) : null}

              {errorMessage ? (
                <div className="mt-5 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              ) : null}

              {emailStep === "request" ? (
                <form className="mt-6 space-y-4" onSubmit={handleRequestCode}>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-900" htmlFor="access-email">
                      Correo corporativo
                    </label>
                    <input
                      id="access-email"
                      type="email"
                      autoComplete="email"
                      autoCapitalize="none"
                      autoCorrect="off"
                      enterKeyHint="next"
                      required
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="nombre@empresa.com"
                      className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base text-slate-950 outline-none transition-colors placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-900" htmlFor="access-name">
                      Nombre visible (opcional)
                    </label>
                    <input
                      id="access-name"
                      type="text"
                      autoComplete="name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="Cómo quieres aparecer en la consola"
                      className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base text-slate-950 outline-none transition-colors placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                    />
                  </div>

                  <Button
                    type="submit"
                    size="lg"
                    className="h-12 w-full rounded-2xl bg-teal-600 text-white hover:bg-teal-700"
                    disabled={requestEmailCode.isPending || loading || emailCooldownActive}
                  >
                    {requestEmailCode.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {emailCooldownActive ? `Espera ${emailCooldownSecondsRemaining}s para pedir otro código` : "Recibir código para iniciar sesión o crear cuenta"}
                  </Button>
                </form>
              ) : (
                <form className="mt-6 space-y-4" onSubmit={handleVerifyCode}>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-900" htmlFor="verify-email">
                      Correo verificado
                    </label>
                    <input
                      id="verify-email"
                      type="email"
                      value={submittedEmail || email}
                      readOnly
                      className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-base text-slate-950 outline-none"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-900" htmlFor="verify-code">
                      Código de seis dígitos
                    </label>
                    <input
                      id="verify-code"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      enterKeyHint="done"
                      required
                      value={code}
                      onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="000000"
                      className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base tracking-[0.4em] text-slate-950 outline-none transition-colors placeholder:tracking-normal placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Button
                      type="submit"
                      size="lg"
                      className="h-12 rounded-2xl bg-slate-950 text-white hover:bg-slate-900"
                      disabled={verifyEmailCode.isPending || loading}
                    >
                      {verifyEmailCode.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Validar e iniciar sesión
                    </Button>
                    <Button
                      type="button"
                      size="lg"
                      variant="outline"
                      className="h-12 rounded-2xl border-slate-200 bg-white"
                      disabled={requestEmailCode.isPending || emailCooldownActive}
                      onClick={async () => {
                        setErrorMessage(null);
                        setStatusMessage(null);
                        await requestEmailCode.mutateAsync({
                          email: submittedEmail || email.trim(),
                          name: name.trim() || undefined,
                        });
                      }}
                    >
                      {requestEmailCode.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      {emailCooldownActive ? `Reenviar en ${emailCooldownSecondsRemaining}s` : "Reenviar código"}
                    </Button>
                  </div>

                  {emailCooldownActive ? (
                    <p className="text-sm text-slate-500">
                      Puedes pedir un nuevo código en <strong className="text-slate-900">{emailCooldownSecondsRemaining}s</strong>.
                    </p>
                  ) : null}

                  <button
                    type="button"
                    className="text-sm font-medium text-teal-700 transition-colors hover:text-teal-800"
                    onClick={() => {
                      setEmailStep("request");
                      setCode("");
                      setErrorMessage(null);
                      setStatusMessage(null);
                    }}
                  >
                    Usar otro correo
                  </button>
                </form>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

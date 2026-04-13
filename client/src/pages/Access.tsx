import { useAuth } from "@/_core/hooks/useAuth";
import { AuditaPatronLogoIcon, AuditaPatronLogoWordmark } from "@/components/AuditaPatronLogo";
import { Button } from "@/components/ui/button";
import { getGoogleLoginUrl, getManusLoginUrl } from "@/const";
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
      return "Google no está disponible todavía en este entorno. Mientras termina la configuración, puedes entrar con Manus o con código por correo.";
    case "google_callback_failed":
      return "No pudimos completar el acceso con Google. Intenta de nuevo o usa Manus o el código por correo para continuar.";
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
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(20,184,166,0.1),_transparent_28%),linear-gradient(180deg,#f8fbfc_0%,#eef4f5_52%,#f8fafc_100%)] text-slate-950">
      <div className="container py-6 lg:py-10">
        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <a
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-950"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver al inicio
          </a>
          <div className="inline-flex items-center gap-2 rounded-full border border-teal-100 bg-teal-50/90 px-4 py-2 text-sm text-teal-900 shadow-sm">
            <ShieldCheck className="h-4 w-4" />
            Regresarás a <strong>{returnTo}</strong>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[0.72fr_1.28fr] xl:items-start">
          <section className="overflow-hidden rounded-[1.8rem] border border-slate-200 bg-white/95 shadow-[0_24px_80px_-42px_rgba(15,23,42,0.28)]">
            <div className="border-b border-slate-200 bg-[linear-gradient(135deg,rgba(15,23,42,0.96),rgba(15,118,110,0.9))] px-6 py-6 text-white sm:px-7">
              <div className="flex items-start gap-4">
                <AuditaPatronLogoIcon imageClassName="h-12 w-12 rounded-2xl border border-white/20 bg-white object-contain p-1.5 shadow-[0_20px_50px_-28px_rgba(2,6,23,0.6)]" />
                <div className="space-y-2">
                  <AuditaPatronLogoWordmark imageClassName="max-w-[210px]" subtitleClassName="text-xs uppercase tracking-[0.16em] text-white/70" />
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/90">
                    Acceso operativo
                  </div>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-teal-100/90">Entrar y continuar</p>
                <h1 className="text-2xl font-semibold tracking-[-0.04em] text-white sm:text-[2rem]">
                  Accede, recupera tu sesión y vuelve a trabajar sin rodeos.
                </h1>
                <p className="max-w-xl text-sm leading-7 text-slate-200">
                  Aquí sólo resolvemos una cosa: autenticarte y devolverte a <strong>{returnTo}</strong>. La ruta principal va primero; las demás quedan como respaldo.
                </p>
              </div>
            </div>

            <div className="space-y-4 px-6 py-5 sm:px-7">
              <article className="rounded-[1.3rem] border border-slate-200 bg-slate-50/85 p-4">
                <p className="text-sm font-semibold text-slate-950">Flujo rápido</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-[1rem] border border-white bg-white px-3 py-3 text-sm text-slate-700 shadow-sm">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">1</p>
                    <p className="mt-1 font-semibold text-slate-950">Elige Manus</p>
                  </div>
                  <div className="rounded-[1rem] border border-white bg-white px-3 py-3 text-sm text-slate-700 shadow-sm">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">2</p>
                    <p className="mt-1 font-semibold text-slate-950">Confirma tu sesión</p>
                  </div>
                  <div className="rounded-[1rem] border border-white bg-white px-3 py-3 text-sm text-slate-700 shadow-sm">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">3</p>
                    <p className="mt-1 font-semibold text-slate-950">Vuelve a tu ruta</p>
                  </div>
                </div>
              </article>
              <div className="rounded-[1.3rem] border border-dashed border-teal-200 bg-teal-50/70 p-4 text-sm leading-6 text-teal-950">
                Cuando completes el acceso, el sistema te devolverá al punto exacto donde querías continuar, sin volver a empezar el flujo.
              </div>
            </div>
          </section>

          <section className="space-y-5">
            <div className="rounded-[2rem] border border-slate-200 bg-white/95 p-6 shadow-[0_24px_80px_-38px_rgba(15,23,42,0.26)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Ruta recomendada</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950">Empieza con Manus si solo quieres entrar rápido</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600">
                    Dejamos una vía principal arriba y los respaldos abajo para que la decisión sea inequívoca. Lo más común es autenticarte una vez y volver de inmediato a tu trabajo.
                  </p>
                </div>
                <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                  Ruta objetivo: {returnTo}
                </div>
              </div>

              <div className="mt-5 rounded-[1.35rem] border border-slate-950 bg-slate-950 p-4 text-white shadow-[0_24px_70px_-34px_rgba(15,23,42,0.34)] sm:p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">Opción principal</p>
                <h3 className="mt-2 text-lg font-semibold">Continúa con Manus y regresa a tu ruta</h3>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  Recomendado cuando ya vienes con sesión institucional o quieres resolver el acceso en el menor número de pasos.
                </p>
                <Button
                  size="lg"
                  className="mt-4 h-12 w-full justify-center rounded-2xl bg-white text-slate-950 shadow-lg shadow-black/10 hover:bg-slate-100"
                  onClick={() => {
                    window.location.href = getManusLoginUrl(returnTo);
                  }}
                >
                  Continuar con Manus
                </Button>
                <p className="mt-3 text-xs leading-5 text-slate-300">Al terminar, vuelves automáticamente a <strong>{returnTo}</strong>.</p>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-[1.1rem] border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                  <p className="font-semibold text-slate-900">Alternativa: Google</p>
                  <p className="mt-2">Úsala si prefieres ese proveedor o si ya vienes autenticado ahí.</p>
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
                <div className="rounded-[1.1rem] border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                  <p className="font-semibold text-slate-900">Alternativa: código por correo</p>
                  <p className="mt-2">Déjalo como respaldo cuando no quieras depender de otro proveedor o necesites continuidad inmediata.</p>
                  <p className="mt-3 text-xs font-medium uppercase tracking-[0.16em] text-slate-500">Disponible justo debajo</p>
                </div>
              </div>
            </div>

            <div className="rounded-[2rem] border border-slate-200 bg-white/95 p-6 shadow-[0_24px_80px_-38px_rgba(15,23,42,0.26)]">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-100 text-teal-700">
                  <Mail className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Respaldo operativo</p>
                  <h2 className="text-xl font-semibold tracking-tight text-slate-950">Entrar con código por correo</h2>
                </div>
              </div>

              <p className="mt-4 text-sm leading-7 text-slate-600">
                Usa este flujo solo si no pudiste entrar con Manus o Google. Recibes un código temporal, validas el acceso y regresas a tu ruta protegida sin crear una contraseña nueva.
              </p>

              <div className="mt-4 rounded-[1.2rem] border border-dashed border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-600">
                El reenvío del código muestra un temporizador visible y limita solicitudes repetidas dentro de la misma ventana para proteger el acceso.
              </div>

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
                    {emailCooldownActive ? `Espera ${emailCooldownSecondsRemaining}s para pedir otro código` : "Enviar código de acceso"}
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
                      Validar e ingresar
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

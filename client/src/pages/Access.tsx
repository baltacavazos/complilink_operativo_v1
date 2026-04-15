import { AuditaPatronLogoIcon, AuditaPatronLogoWordmark } from "@/components/AuditaPatronLogo";
import { useAuth } from "@/_core/hooks/useAuth";
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
      return "Google todavía no está disponible en este entorno. Mientras tanto, entra con tu código por correo.";
    case "google_callback_failed":
      return "No pudimos completar el acceso con Google. Para no frenarte, usa tu código por correo.";
    case "manus_callback_failed":
      return "No pudimos completar el acceso con Manus. Para no frenarte, usa tu código por correo.";
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

function buildEmailCodeStatusMessage(params: {
  maskedEmail: string;
  usedOwnerBackupEmail: boolean;
  cooldownSeconds: number;
}) {
  const timestamp = new Intl.DateTimeFormat("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());

  if (params.usedOwnerBackupEmail) {
    return `Enviamos tu código al buzón de respaldo registrado (${params.maskedEmail}) a las ${timestamp}. Revisa esa bandeja para continuar. Puedes pedir otro dentro de ${params.cooldownSeconds} segundos.`;
  }

  return `Enviamos un código de 6 dígitos a ${params.maskedEmail} a las ${timestamp}. Puedes pedir otro dentro de ${params.cooldownSeconds} segundos.`;
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
      const usedOwnerBackupEmail = Boolean((data as { usedOwnerBackupEmail?: boolean }).usedOwnerBackupEmail);
      setSubmittedEmail(normalizedEmail);
      setEmailStep("verify");
      setCode("");
      setErrorMessage(null);
      setEmailCooldownUntil(Date.now() + data.cooldownSeconds * 1000);
      setStatusMessage(
        buildEmailCodeStatusMessage({
          maskedEmail: data.maskedEmail,
          usedOwnerBackupEmail,
          cooldownSeconds: data.cooldownSeconds,
        }),
      );
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
    ? "Verificando Google"
    : googleEnabled
      ? "Continuar con Google"
      : "Google disponible en cuanto termine la configuración";

  return (
    <main className="min-h-screen overflow-x-clip bg-[radial-gradient(circle_at_top,_rgba(20,184,166,0.1),_transparent_24%),linear-gradient(180deg,#f8fbfc_0%,#eef4f5_52%,#f8fafc_100%)] text-slate-950">
      <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col px-4 py-4 sm:px-5 sm:py-6">
        <div className="mx-auto flex w-full max-w-xl flex-col gap-3">
          <a
            href="/"
            className="inline-flex w-full items-center gap-2 rounded-full border border-slate-200 bg-white/95 px-4 py-3 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-950"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" />
            <span className="truncate">Volver al inicio</span>
          </a>

          <div className="inline-flex w-full min-w-0 items-start gap-2 rounded-[1.2rem] border border-teal-100 bg-teal-50/90 px-4 py-3 text-sm text-teal-900 shadow-sm">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="min-w-0 break-words">
              Regresarás a <strong className="break-all">{returnTo}</strong>
            </span>
          </div>
        </div>

        <section className="mx-auto mt-4 flex w-full max-w-xl flex-1 flex-col justify-center">
          <div className="min-w-0 overflow-hidden rounded-[2rem] border border-slate-200 bg-white/95 p-5 shadow-[0_24px_80px_-38px_rgba(15,23,42,0.22)] sm:p-6">
            <div className="flex min-w-0 items-center gap-3">
              <AuditaPatronLogoIcon imageClassName="h-11 w-11 rounded-2xl border border-slate-200 bg-white object-contain p-1.5 shadow-sm" />
              <div className="min-w-0">
                <AuditaPatronLogoWordmark imageClassName="max-w-[180px] sm:max-w-[210px]" subtitleClassName="text-[11px] uppercase tracking-[0.16em] text-slate-500" />
                <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Acceso simple</p>
              </div>
            </div>

            <div className="mt-5 min-w-0 space-y-3">
              <h1 className="max-w-[18ch] text-3xl font-semibold leading-tight tracking-[-0.05em] text-slate-950 sm:max-w-none sm:text-[2.2rem]">
                Inicia sesión sin vueltas.
              </h1>
              <p className="text-sm leading-7 text-slate-600">
                Te enviamos un código a tu correo y entras al instante. Si todavía no tienes cuenta, se crea automáticamente al validar ese código.
              </p>
            </div>

            <div className="mt-5 rounded-[1.4rem] border border-teal-100 bg-teal-50 px-4 py-4 text-sm leading-6 text-teal-950">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-700">Si eres el CEO</p>
              <p className="mt-2">
                Inicia sesión con el <strong>mismo correo principal del propietario</strong>. Ese correo conserva tu acceso de administrador automáticamente.
              </p>
            </div>

            {!manusLoginAvailable ? (
              <div className="mt-4 rounded-[1.4rem] border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-700">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Acceso activo en este dominio</p>
                <p className="mt-2">
                  Aquí la vía estable es <strong>código por correo</strong>. Así evitamos el rebote de autenticación que daba el acceso con Manus en el dominio público.
                </p>
              </div>
            ) : manusLoginUrl ? (
              <div className="mt-4 rounded-[1.4rem] border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-700">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">También disponible en preview</p>
                <p className="mt-2">Si estás entrando desde la previsualización hospedada, Manus también puede servirte como atajo.</p>
                <Button
                  size="lg"
                  variant="outline"
                  className="mt-4 h-12 w-full rounded-2xl border-slate-200 bg-white text-slate-950"
                  onClick={() => {
                    window.location.href = manusLoginUrl;
                  }}
                >
                  Continuar con Manus
                </Button>
              </div>
            ) : null}

            <div id="acceso-correo" className="mt-5 min-w-0 rounded-[1.5rem] border border-slate-950 bg-slate-950 p-4 text-white sm:p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-white">
                  <Mail className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">Código por correo</p>
                  <h2 className="text-lg font-semibold tracking-tight text-white">Tu acceso principal</h2>
                </div>
              </div>

              <p className="mt-4 text-sm leading-6 text-slate-300">
                Usa tu correo de trabajo. Si eres el CEO, usa aquí el correo principal con el que administras la cuenta.
              </p>

              {statusMessage ? (
                <div className="mt-4 rounded-2xl border border-emerald-300/40 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
                  {statusMessage}
                </div>
              ) : null}

              {errorMessage ? (
                <div className="mt-4 flex items-start gap-3 rounded-2xl border border-rose-300/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span className="min-w-0 break-words">{errorMessage}</span>
                </div>
              ) : null}

              {emailStep === "request" ? (
                <form className="mt-5 space-y-4" onSubmit={handleRequestCode}>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-white" htmlFor="access-email">
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
                      className="h-12 w-full min-w-0 rounded-2xl border border-white/15 bg-white px-4 text-base text-slate-950 outline-none transition-colors placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                    />
                    <p className="text-xs leading-5 text-slate-400">
                      Si eres el CEO, escribe aquí tu correo principal de propietario.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-white" htmlFor="access-name">
                      Nombre visible (opcional)
                    </label>
                    <input
                      id="access-name"
                      type="text"
                      autoComplete="name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="Cómo quieres aparecer en la consola"
                      className="h-12 w-full min-w-0 rounded-2xl border border-white/15 bg-white px-4 text-base text-slate-950 outline-none transition-colors placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                    />
                  </div>

                  <Button
                    type="submit"
                    size="lg"
                    className="h-12 w-full rounded-2xl bg-white text-base font-semibold text-slate-950 hover:bg-slate-100"
                    disabled={requestEmailCode.isPending || loading || emailCooldownActive}
                  >
                    {requestEmailCode.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {emailCooldownActive ? `Espera ${emailCooldownSecondsRemaining}s para pedir otro código` : "Recibir código"}
                  </Button>
                </form>
              ) : (
                <form className="mt-5 space-y-4" onSubmit={handleVerifyCode}>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-white" htmlFor="verify-email">
                      Correo verificado
                    </label>
                    <input
                      id="verify-email"
                      type="email"
                      value={submittedEmail || email}
                      readOnly
                      className="h-12 w-full rounded-2xl border border-white/15 bg-white px-4 text-base text-slate-950 outline-none"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-white" htmlFor="verify-code">
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
                      className="h-12 w-full rounded-2xl border border-white/15 bg-white px-4 text-base tracking-[0.35em] text-slate-950 outline-none transition-colors placeholder:tracking-normal placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                    />
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Button
                      type="submit"
                      size="lg"
                      className="h-12 w-full rounded-2xl bg-white text-slate-950 hover:bg-slate-100"
                      disabled={verifyEmailCode.isPending || loading}
                    >
                      {verifyEmailCode.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Validar e iniciar sesión
                    </Button>
                    <Button
                      type="button"
                      size="lg"
                      variant="outline"
                      className="h-12 w-full rounded-2xl border-white/20 bg-transparent text-white hover:bg-white/10"
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
                    <p className="text-sm text-slate-400">
                      Puedes pedir un nuevo código en <strong className="text-white">{emailCooldownSecondsRemaining}s</strong>.
                    </p>
                  ) : null}

                  <button
                    type="button"
                    className="text-sm font-medium text-teal-300 transition-colors hover:text-teal-200"
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

            <div className="mt-4 rounded-[1.4rem] border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-700">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Otra opción</p>
              <p className="mt-2">Google sólo aparece cuando la configuración esté terminada. Mientras tanto, el acceso por correo es la vía recomendada.</p>
              <Button
                size="lg"
                variant="outline"
                className="mt-4 h-12 w-full rounded-2xl border-slate-200 bg-white"
                disabled={!googleEnabled || googleStatusQuery.isLoading}
                onClick={() => {
                  window.location.href = getGoogleLoginUrl(returnTo);
                }}
              >
                {googleStatusQuery.isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {googleLabel}
              </Button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

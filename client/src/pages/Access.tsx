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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(15,103,177,0.12),_transparent_34%),linear-gradient(180deg,#f8fbff_0%,#eef4fb_48%,#f8fafc_100%)] text-foreground">
      <div className="container py-10 lg:py-16">
        <div className="mb-8 flex items-center justify-between gap-4">
          <a
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/90 px-4 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver al inicio
          </a>
          <div className="rounded-full border border-border/70 bg-background/90 px-4 py-2 text-sm text-muted-foreground shadow-sm">
            Retorno protegido: <strong className="text-foreground">{returnTo}</strong>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1.08fr_0.92fr] lg:items-start">
          <section className="overflow-hidden rounded-[2rem] border border-border/70 bg-card/95 shadow-[0_30px_100px_-40px_rgba(15,23,42,0.35)] backdrop-blur">
            <div className="border-b border-border/70 px-8 py-8">
              <div className="flex items-start gap-4">
                <AuditaPatronLogoIcon imageClassName="h-16 w-16 rounded-2xl border border-border/70 bg-background object-contain p-1.5 shadow-[0_20px_50px_-28px_rgba(15,23,42,0.45)]" />
                <div className="space-y-3">
                  <AuditaPatronLogoWordmark imageClassName="max-w-[230px]" subtitleClassName="text-xs uppercase tracking-[0.16em]" />
                  <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Acceso multi-identidad para operación y auditoría
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-8 px-8 py-8">
              <div className="space-y-4">
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-primary/80">Inicio de sesión unificado</p>
                <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-balance text-foreground">
                  Elige el método de acceso que mejor encaje con tu operación sin romper la sesión corporativa existente.
                </h1>
                <p className="max-w-2xl text-base leading-8 text-muted-foreground">
                  La consola conserva el acceso corporativo actual y añade un canal passwordless por correo para contingencia, adopción gradual y continuidad operativa. Google queda preparado para activarse tan pronto se complete la configuración segura del proveedor.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-3xl border border-border/70 bg-background/80 p-5 shadow-sm">
                  <p className="text-sm font-semibold text-foreground">Métodos habilitados</p>
                  <ul className="mt-4 space-y-3 text-sm leading-6 text-muted-foreground">
                    <li><strong className="text-foreground">Manus OAuth</strong> mantiene el acceso institucional ya desplegado.</li>
                    <li><strong className="text-foreground">Correo passwordless</strong> envía un código temporal sin requerir contraseña persistente.</li>
                    <li><strong className="text-foreground">Google OAuth</strong> queda listo para activación controlada cuando se carguen las credenciales.</li>
                  </ul>
                </div>
                <div className="rounded-3xl border border-border/70 bg-slate-950 p-5 text-slate-100 shadow-sm">
                  <p className="text-sm font-semibold">Controles operativos</p>
                  <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
                    <li>Trazabilidad por sesión protegida y retorno seguro a la ruta solicitada.</li>
                    <li>Compatibilidad incremental con el flujo existente de expedientes.</li>
                    <li>Canal alterno para soporte y continuidad en ventanas críticas.</li>
                  </ul>
                </div>
              </div>

              <div className="rounded-3xl border border-dashed border-border/80 bg-muted/40 p-5 text-sm leading-7 text-muted-foreground">
                Si vienes desde una ruta protegida, al autenticarte volverás automáticamente a <strong className="text-foreground">{returnTo}</strong>.
              </div>
            </div>
          </section>

          <section className="space-y-6">
            <div className="rounded-[2rem] border border-border/70 bg-card/95 p-6 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.32)]">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">Acceso con proveedores</p>
              <div className="mt-5 grid gap-3">
                <Button
                  size="lg"
                  className="h-12 justify-center rounded-2xl shadow-lg shadow-primary/10"
                  onClick={() => {
                    window.location.href = getManusLoginUrl(returnTo);
                  }}
                >
                  Continuar con Manus
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="h-12 justify-center rounded-2xl border-border/80 bg-background/70"
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

            <div className="rounded-[2rem] border border-border/70 bg-card/95 p-6 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.32)]">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Mail className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">Acceso por correo</p>
                  <h2 className="text-xl font-semibold tracking-tight text-foreground">Código temporal sin contraseña</h2>
                </div>
              </div>

                  <p className="mt-4 text-sm leading-7 text-muted-foreground">
                    Usa tu correo de trabajo para recibir un código de verificación. Si es tu primer acceso por este canal, el sistema reconciliará tu identidad con la cuenta existente cuando encuentre el mismo email.
                  </p>

                  <div className="mt-4 rounded-2xl border border-border/70 bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                    Por seguridad, el reenvío del código tiene un breve enfriamiento visible y el sistema limita la cantidad de solicitudes repetidas por correo durante la misma ventana operativa.
                  </div>


              {statusMessage ? (
                <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  {statusMessage}
                </div>
              ) : null}

              {errorMessage ? (
                <div className="mt-5 flex items-start gap-3 rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              ) : null}

              {emailStep === "request" ? (
                <form className="mt-6 space-y-4" onSubmit={handleRequestCode}>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground" htmlFor="access-email">
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
                      className="h-12 w-full rounded-2xl border border-input bg-background px-4 text-base text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground" htmlFor="access-name">
                      Nombre visible (opcional)
                    </label>
                    <input
                      id="access-name"
                      type="text"
                      autoComplete="name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="Cómo quieres aparecer en la consola"
                      className="h-12 w-full rounded-2xl border border-input bg-background px-4 text-base text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                  </div>

                  <Button
                    type="submit"
                    size="lg"
                    className="h-12 w-full rounded-2xl"
                    disabled={requestEmailCode.isPending || loading || emailCooldownActive}
                  >
                    {requestEmailCode.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {emailCooldownActive ? `Espera ${emailCooldownSecondsRemaining}s para pedir otro código` : "Enviar código de acceso"}
                  </Button>
                </form>
              ) : (
                <form className="mt-6 space-y-4" onSubmit={handleVerifyCode}>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground" htmlFor="verify-email">
                      Correo verificado
                    </label>
                    <input
                      id="verify-email"
                      type="email"
                      value={submittedEmail || email}
                      readOnly
                      className="h-12 w-full rounded-2xl border border-input bg-muted/60 px-4 text-base text-foreground outline-none"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground" htmlFor="verify-code">
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
                      className="h-12 w-full rounded-2xl border border-input bg-background px-4 text-base tracking-[0.4em] text-foreground outline-none transition-colors placeholder:tracking-normal placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Button
                      type="submit"
                      size="lg"
                      className="h-12 rounded-2xl"
                      disabled={verifyEmailCode.isPending || loading}
                    >
                      {verifyEmailCode.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Validar e ingresar
                    </Button>
                    <Button
                      type="button"
                      size="lg"
                      variant="outline"
                      className="h-12 rounded-2xl border-border/80 bg-background/70"
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
                    <p className="text-sm text-muted-foreground">
                      Puedes pedir un nuevo código en <strong className="text-foreground">{emailCooldownSecondsRemaining}s</strong>.
                    </p>
                  ) : null}

                  <button
                    type="button"
                    className="text-sm font-medium text-primary transition-colors hover:text-primary/80"
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
    </div>
  );
}

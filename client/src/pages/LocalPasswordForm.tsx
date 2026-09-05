import { Button } from "@/components/ui/button";
import { AlertCircle, ArrowRight, Loader2, LockKeyhole } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";

function readFormCredentials(form: HTMLFormElement | null, fallback: { email: string; password: string }) {
  if (!form) return { email: fallback.email.trim(), password: fallback.password };
  const data = new FormData(form);
  const emailFromDom = String(data.get("email") ?? "").trim();
  const passwordFromDom = String(data.get("password") ?? "");
  return {
    email: emailFromDom || fallback.email.trim(),
    password: passwordFromDom || fallback.password,
  };
}

export default function LocalPasswordForm({
  returnPath,
  accessMode,
}: {
  returnPath: string;
  accessMode: "signup" | "signin";
}) {
  const [mode, setMode] = useState<"signup" | "signin">(accessMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<"login" | "register" | null>(null);

  useEffect(() => {
    setMode(accessMode);
  }, [accessMode]);

  const submit = async (action: "login" | "register", form: HTMLFormElement | null) => {
    setError(null);
    const credentials = readFormCredentials(form, { email, password });
    setEmail(credentials.email);
    setPassword(credentials.password);

    if (!credentials.email.includes("@")) {
      setError("Escribe un correo válido.");
      return;
    }
    if (credentials.password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }

    setPending(action);
    try {
      const response = await fetch(action === "register" ? "/api/auth/local/register" : "/api/auth/local/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          email: credentials.email,
          password: credentials.password,
          returnPath,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string; returnPath?: string };
      if (!response.ok) {
        setError(typeof data.error === "string" ? data.error : "No se pudo completar el acceso.");
        return;
      }
      window.location.href = typeof data.returnPath === "string" ? data.returnPath : returnPath;
    } catch {
      setError("No se pudo completar el acceso. Revisa tu conexión e inténtalo de nuevo.");
    } finally {
      setPending(null);
    }
  };

  return (
    <form
      className="mt-6 space-y-4"
      onSubmit={(event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        void submit(mode === "signup" ? "register" : "login", event.currentTarget);
      }}
    >
      <h1 className="text-center text-2xl font-semibold tracking-tight text-slate-950">
        {mode === "signup" ? "Crea tu cuenta" : "Entra a tu cuenta"}
      </h1>
      <div className="rounded-[1.35rem] border border-teal-100 bg-teal-50/80 px-4 py-3 text-sm leading-6 text-teal-950">
        <p className="font-medium">En esta copia entras con correo y contraseña. No usamos la otra plataforma de acceso.</p>
        <p className="mt-1 text-teal-900/80">La revisión pública por RFC sigue igual, sin cuenta.</p>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-900" htmlFor="local-access-email">
          Correo
        </label>
        <input
          id="local-access-email"
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          onInput={(event) => setEmail((event.target as HTMLInputElement).value)}
          placeholder="nombre@empresa.com"
          className="h-12 w-full min-w-0 rounded-2xl border border-slate-200 bg-white px-4 text-base text-slate-950 outline-none transition-colors placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-900" htmlFor="local-access-password">
          Contraseña
        </label>
        <input
          id="local-access-password"
          type="password"
          name="password"
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          required
          minLength={8}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          onInput={(event) => setPassword((event.target as HTMLInputElement).value)}
          placeholder="Mínimo 8 caracteres"
          className="h-12 w-full min-w-0 rounded-2xl border border-slate-200 bg-white px-4 text-base text-slate-950 outline-none transition-colors placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
        />
      </div>

      {error ? (
        <div className="flex items-start gap-3 rounded-[1.35rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900" role="alert">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="min-w-0 break-words">{error}</span>
        </div>
      ) : null}

      <Button
        type="submit"
        size="lg"
        className="h-12 w-full rounded-2xl bg-slate-950 text-base font-semibold text-white hover:bg-slate-900"
        disabled={pending !== null}
      >
        {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LockKeyhole className="mr-2 h-4 w-4" />}
        {pending
          ? mode === "signup"
            ? "Creando cuenta..."
            : "Entrando..."
          : mode === "signup"
            ? "Crear mi cuenta"
            : "Iniciar sesión"}
        {!pending ? <ArrowRight className="ml-2 h-4 w-4" /> : null}
      </Button>

      <Button
        type="button"
        variant="outline"
        className="h-12 w-full rounded-2xl border-teal-200 bg-teal-50 text-base font-semibold text-teal-900 hover:bg-teal-100"
        disabled={pending !== null}
        onClick={() => {
          setError(null);
          setMode((current) => (current === "signup" ? "signin" : "signup"));
        }}
      >
        {mode === "signup" ? "Ya tengo cuenta: iniciar sesión" : "Crear mi cuenta por primera vez"}
      </Button>
    </form>
  );
}

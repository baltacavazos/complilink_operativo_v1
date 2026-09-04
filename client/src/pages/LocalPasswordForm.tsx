import { Button } from "@/components/ui/button";
import { AlertCircle, ArrowRight, Loader2, LockKeyhole } from "lucide-react";
import { type FormEvent, useState } from "react";

export default function LocalPasswordForm({
  returnPath,
  accessMode,
}: {
  returnPath: string;
  accessMode: "signup" | "signin";
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<"login" | "register" | null>(null);

  const submit = async (mode: "login" | "register") => {
    setError(null);
    setPending(mode);
    try {
      const response = await fetch(mode === "register" ? "/api/auth/local/register" : "/api/auth/local/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ email, password, returnPath }),
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
        void submit(accessMode === "signup" ? "register" : "login");
      }}
    >
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
          autoComplete={accessMode === "signup" ? "new-password" : "current-password"}
          required
          minLength={8}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
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
          ? accessMode === "signup"
            ? "Creando cuenta..."
            : "Entrando..."
          : accessMode === "signup"
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
          void submit(accessMode === "signup" ? "login" : "register");
        }}
      >
        {accessMode === "signup" ? "Ya tengo cuenta: iniciar sesión" : "Crear mi cuenta por primera vez"}
      </Button>
    </form>
  );
}

import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, FolderOpen, Home } from "lucide-react";
import { useLocation } from "wouter";

export default function PapersPlaceholder() {
  const [, setLocation] = useLocation();
  const auth = useAuth();
  const homeSnapshotQuery = trpc.workspace.homeSnapshot.useQuery(undefined, {
    enabled: auth.isAuthenticated,
    refetchOnWindowFocus: false,
  });
  const latestCase = homeSnapshotQuery.data?.latestCase ?? null;

  return (
    <main className="audita-historial min-h-screen bg-[linear-gradient(180deg,#f8fbfc_0%,#eef4f5_100%)] px-4 py-8 text-slate-950 sm:px-6">
      <div className="mx-auto flex min-h-[80vh] w-full max-w-lg flex-col justify-center">
        <section className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-[0_22px_56px_-40px_rgba(15,23,42,0.2)] sm:p-7">
          <div className="mb-5 flex justify-center">
            <div className="rounded-full bg-teal-50 p-4">
              <FolderOpen className="h-12 w-12 text-teal-800" />
            </div>
          </div>
          <p className="text-center text-sm font-semibold text-teal-800">Tu historial</p>
          <h1 className="mt-2 text-center text-[1.75rem] font-semibold leading-tight tracking-[-0.03em] text-slate-950">
            Lo que ya revisaste
          </h1>
          <p className="mt-3 text-center text-sm leading-6 text-slate-700">
            Tus documentos y revisiones viven en tu expediente. Ábrelo para ver lo más reciente
            con calma, en el mismo lugar donde subes tu recibo.
          </p>

          {auth.isAuthenticated && latestCase ? (
            <div className="mt-5 rounded-[1.25rem] border border-slate-200 bg-slate-50 px-4 py-4 text-left">
              <p className="text-sm font-medium text-slate-600">Última revisión</p>
              <p className="mt-1 text-base font-semibold text-slate-950">
                {latestCase.stageLabel ?? "Expediente en curso"}
              </p>
              {latestCase.summary ? (
                <p className="mt-2 text-sm leading-6 text-slate-700">{latestCase.summary}</p>
              ) : null}
            </div>
          ) : (
            <div className="mt-5 rounded-[1.25rem] border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-center text-sm leading-6 text-slate-700">
              Si todavía no subes un archivo, empieza por tu recibo. El historial se arma solo
              cuando guardas la primera revisión.
            </div>
          )}

          <div className="mt-6 flex flex-col gap-3">
            <Button
              onClick={() => setLocation("/auditar")}
              className="h-12 w-full rounded-full bg-teal-700 px-6 text-white hover:bg-teal-800"
            >
              Ir a mi revisión
            </Button>
            {!auth.isAuthenticated ? (
              <Button
                variant="outline"
                onClick={() => setLocation("/acceso?returnTo=/historial")}
                className="h-12 w-full rounded-full border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
              >
                Entrar para ver mi historial
              </Button>
            ) : null}
            <Button
              variant="outline"
              onClick={() => setLocation("/")}
              className="h-12 w-full rounded-full border-0 bg-transparent text-slate-700 hover:bg-slate-50"
            >
              <Home className="mr-2 h-4 w-4" />
              Ir al inicio
            </Button>
            <button
              type="button"
              onClick={() => setLocation("/auditar")}
              className="inline-flex items-center justify-center gap-2 text-sm font-medium text-slate-600"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver al expediente
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}

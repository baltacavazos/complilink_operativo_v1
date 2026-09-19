import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FolderOpen, Home } from "lucide-react";
import { useLocation } from "wouter";

export default function PapersPlaceholder() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
      <Card className="w-full max-w-lg mx-4 border-0 bg-white/80 shadow-lg backdrop-blur-sm">
        <CardContent className="pt-8 pb-8 text-center">
          <div className="mb-6 flex justify-center">
            <div className="rounded-full bg-teal-50 p-4">
              <FolderOpen className="h-14 w-14 text-teal-700" />
            </div>
          </div>
          <h1 className="mb-3 text-2xl font-semibold text-slate-900">
            Pronto verás aquí tus papeles
          </h1>
          <p className="mb-8 leading-relaxed text-slate-600">
            Esta sección todavía no está lista. Tus documentos siguen en tu
            revisión. Ábrela cuando quieras continuar.
          </p>
          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            <Button
              onClick={() => setLocation("/auditar")}
              className="rounded-lg bg-teal-700 px-6 py-2.5 text-white shadow-md transition-all duration-200 hover:bg-teal-800 hover:shadow-lg"
            >
              Ir a mi revisión
            </Button>
            <Button
              onClick={() => setLocation("/")}
              className="rounded-lg bg-slate-950 px-6 py-2.5 text-white shadow-md transition-all duration-200 hover:bg-slate-900 hover:shadow-lg"
            >
              <Home className="mr-2 h-4 w-4" />
              Ir al inicio
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

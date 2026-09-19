import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, Home } from "lucide-react";
import { useLocation } from "wouter";

export default function NotFound() {
  const [location, setLocation] = useLocation();

  const handleGoHome = () => {
    setLocation("/");
  };

  const isPapersPlaceholder =
    location === "/historial" ||
    location === "/expediente" ||
    location.startsWith("/historial/") ||
    location.startsWith("/expediente/");

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
      <Card className="w-full max-w-lg mx-4 shadow-lg border-0 bg-white/80 backdrop-blur-sm">
        <CardContent className="pt-8 pb-8 text-center">
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="absolute inset-0 bg-teal-100 rounded-full animate-pulse" />
              <AlertCircle className="relative h-16 w-16 text-teal-600" />
            </div>
          </div>

          {isPapersPlaceholder ? (
            <>
              <h1 className="text-2xl font-semibold text-slate-900 mb-3">
                Pronto verás aquí tus papeles
              </h1>
              <p className="text-slate-600 mb-8 leading-relaxed">
                Esta sección todavía no está lista. Tus documentos siguen en tu
                revisión. Ábrela cuando quieras continuar.
              </p>
            </>
          ) : (
            <>
              <h1 className="text-xl font-semibold text-slate-900 mb-2">
                Página no encontrada
              </h1>
              <p className="text-slate-600 mb-8 leading-relaxed">
                Esta página no existe o ya no está disponible.
                <br />
                Puedes volver al inicio y continuar tu revisión.
              </p>
            </>
          )}

          <div
            id="not-found-button-group"
            className="flex flex-col sm:flex-row gap-3 justify-center"
          >
            {isPapersPlaceholder ? (
              <Button
                onClick={() => setLocation("/auditar")}
                className="bg-teal-700 hover:bg-teal-800 text-white px-6 py-2.5 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg"
              >
                Ir a mi revisión
              </Button>
            ) : null}
            <Button
              onClick={handleGoHome}
              className="bg-slate-950 hover:bg-slate-900 text-white px-6 py-2.5 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg"
            >
              <Home className="w-4 h-4 mr-2" />
              Ir al inicio
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

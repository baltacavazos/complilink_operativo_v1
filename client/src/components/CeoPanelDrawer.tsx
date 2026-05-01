import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

const CEO_ACTIONS = [
  {
    label: "Resumen ejecutivo",
    helper: "Prioridades del día, decisiones seguras y lectura general.",
    path: "/ceo",
  },
  {
    label: "Alertas CEO",
    helper: "Entrar directo a incidencias, focos rojos y seguimientos.",
    path: "/ceo/alertas",
  },
  {
    label: "Documentos CEO",
    helper: "Abrir la revisión ejecutiva de documentos y pendientes.",
    path: "/ceo/documentos",
  },
  {
    label: "Accesos CEO",
    helper: "Revisar membresías, vigencias y control operativo.",
    path: "/ceo/accesos",
  },
  {
    label: "Bridge operativo",
    helper: "Ir al puente técnico solo cuando necesites profundidad.",
    path: "/ceo/bridge",
  },
] as const;

type CeoPanelDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  baseLabel: string;
};

export default function CeoPanelDrawer({
  open,
  onOpenChange,
  baseLabel,
}: CeoPanelDrawerProps) {
  const auth = useAuth();

  const navigateToCeoAction = (path: string) => {
    onOpenChange(false);
    if (auth.isViewingAsUser) {
      auth.exitUserView();
    }
    window.location.href = path;
  };

  if (!auth.canToggleUserView) {
    return null;
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader className="text-left">
          <DrawerTitle>Acciones CEO desde tu vista base</DrawerTitle>
          <DrawerDescription>
            Entra al resumen ejecutivo o a una vista específica del CEO sin
            perder la claridad de que tu base actual sigue siendo
            <strong>{` ${baseLabel}`}</strong>. Si vienes en demo de usuario,
            saldremos de esa simulación en cuanto abras una acción ejecutiva.
          </DrawerDescription>
        </DrawerHeader>
        <div className="space-y-3 px-4 pb-2">
          {CEO_ACTIONS.map(action => (
            <Button
              key={action.path}
              variant="outline"
              className="h-auto w-full items-start justify-between rounded-[1.2rem] border-slate-200 bg-white px-4 py-4 text-left text-slate-900 hover:bg-slate-50"
              onClick={() => navigateToCeoAction(action.path)}
            >
              <div className="pr-4">
                <p className="text-sm font-semibold text-slate-900">
                  {action.label}
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-600">
                  {action.helper}
                </p>
              </div>
            </Button>
          ))}
        </div>
        <DrawerFooter>
          {auth.isViewingAsUser ? (
            <Button
              variant="outline"
              className="rounded-2xl border-amber-300 bg-white text-amber-900 hover:bg-amber-100"
              onClick={() => {
                onOpenChange(false);
                auth.exitUserView();
                window.location.href = "/ceo";
              }}
            >
              Salir de la demo y abrir tablero CEO
            </Button>
          ) : null}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

import { AIChatBox, type Message as AIChatMessage } from "@/components/AIChatBox";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Sparkles } from "lucide-react";

export type HeliosCopilotMessage = AIChatMessage;

type HeliosCopilotSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSendMessage: (content: string) => void;
  messages: HeliosCopilotMessage[];
  isLoading?: boolean;
  suggestedPrompts?: string[];
  caseTitle?: string | null;
  employeeName?: string | null;
  confidenceScore?: number | null;
  disclaimer?: string | null;
  summary?: string | null;
};

export function HeliosCopilotSheet({
  open,
  onOpenChange,
  onSendMessage,
  messages,
  isLoading = false,
  suggestedPrompts = [],
  caseTitle,
  employeeName,
  confidenceScore,
  disclaimer,
  summary,
}: HeliosCopilotSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full border-l border-slate-200 bg-white p-0 sm:max-w-xl">
        <div className="flex h-full flex-col">
          <SheetHeader className="border-b border-slate-200 bg-slate-50/80 px-5 py-5 text-left sm:px-6">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-teal-100 text-teal-700">
                <Sparkles className="h-5 w-5" strokeWidth={1.8} />
              </div>
              <div className="min-w-0">
                <SheetTitle className="text-lg tracking-[-0.02em] text-slate-950">
                  Copiloto laboral de Helios
                </SheetTitle>
                <SheetDescription className="mt-1 text-sm leading-6 text-slate-600">
                  Haz preguntas rápidas sobre este expediente y recibe una explicación clara basada en los documentos ya integrados.
                </SheetDescription>
              </div>
            </div>

            <div className="mt-4 space-y-3 rounded-[1.2rem] border border-teal-100 bg-white p-4 shadow-sm">
              <p className="text-sm font-semibold text-slate-950">
                {caseTitle ?? "Expediente activo"}
                {employeeName ? <span className="font-normal text-slate-600"> · {employeeName}</span> : null}
              </p>
              {summary ? <p className="text-sm leading-6 text-slate-700">{summary}</p> : null}
              <div className="flex flex-wrap gap-2 text-xs font-semibold">
                <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">Basado en el expediente visible</span>
                {typeof confidenceScore === "number" ? (
                  <span className="rounded-full bg-teal-50 px-3 py-1 text-teal-800">Confianza orientativa {confidenceScore}%</span>
                ) : null}
              </div>
            </div>
          </SheetHeader>

          <div className="flex-1 px-4 pb-4 pt-4 sm:px-6">
            <AIChatBox
              messages={messages}
              onSendMessage={onSendMessage}
              isLoading={isLoading}
              className="h-full border-slate-200 shadow-none"
              height="100%"
              placeholder="Pregúntale a Helios sobre riesgos, pasos sugeridos o dudas de tu expediente"
              emptyStateMessage="Helios puede explicarte tu expediente con palabras simples y decirte qué conviene revisar primero."
              suggestedPrompts={suggestedPrompts}
            />
          </div>

          <div className="border-t border-slate-200 bg-slate-50 px-5 py-4 sm:px-6">
            <p className="text-xs leading-6 text-slate-500">
              {disclaimer ??
                "Esta respuesta se basa en los documentos visibles del expediente y en lecturas preliminares. No sustituye a un abogado ni constituye asesoría legal vinculante."}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-full border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                onClick={() => onOpenChange(false)}
              >
                Seguir revisando el expediente
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

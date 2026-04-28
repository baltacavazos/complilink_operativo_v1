import { AIChatBox, type Message as AIChatMessage } from "@/components/AIChatBox";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ArrowRight, Clock3, FileText, Sparkles } from "lucide-react";

export type HeliosCopilotMessage = AIChatMessage;
export type HeliosCopilotResponseTone = "brief" | "explained";

type HeliosCopilotHistoryItem = {
  id: string;
  title: string;
  detail: string;
  timestampLabel?: string | null;
};

type HeliosCopilotSupportingDocument = {
  id: string;
  label: string;
  detail: string;
};

type HeliosCopilotNextSuggestedDocument = {
  title: string;
  label: string;
  reason: string;
  contrastTitle?: string | null;
  confirmedSummary?: string | null;
  missingSummary?: string | null;
  actionHint?: string | null;
  ctaLabel?: string | null;
};

export type HeliosCopilotSheetCopy = {
  eyebrow?: string;
  title?: string;
  description?: string;
  documentBadge?: string;
  capabilityBadge?: string;
  quickHighlights?: string[];
  promptsHeading?: string;
  historyHeading?: string;
  supportingHeading?: string;
  toneHeading?: string;
  toneBriefLabel?: string;
  toneExplainedLabel?: string;
  toneBriefHint?: string;
  toneExplainedHint?: string;
  placeholder?: string;
  emptyStateMessage?: string;
  closeLabel?: string;
};

type HeliosCopilotSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSendMessage: (content: string) => void;
  messages: HeliosCopilotMessage[];
  isLoading?: boolean;
  suggestedPrompts?: string[];
  suggestedPromptsContext?: string | null;
  caseTitle?: string | null;
  employeeName?: string | null;
  confidenceScore?: number | null;
  disclaimer?: string | null;
  summary?: string | null;
  historyItems?: HeliosCopilotHistoryItem[];
  historyContext?: string | null;
  supportingDocuments?: HeliosCopilotSupportingDocument[];
  nextSuggestedDocument?: HeliosCopilotNextSuggestedDocument | null;
  responseTone?: HeliosCopilotResponseTone;
  onResponseToneChange?: ((tone: HeliosCopilotResponseTone) => void) | null;
  onFocusSuggestedDocument?: (() => void) | null;
  uiCopy?: HeliosCopilotSheetCopy;
};

export function HeliosCopilotSheet({
  open,
  onOpenChange,
  onSendMessage,
  messages,
  isLoading = false,
  suggestedPrompts = [],
  suggestedPromptsContext,
  caseTitle,
  employeeName,
  confidenceScore,
  disclaimer,
  summary,
  historyItems = [],
  historyContext,
  supportingDocuments = [],
  nextSuggestedDocument,
  responseTone = "brief",
  onResponseToneChange,
  onFocusSuggestedDocument,
  uiCopy,
}: HeliosCopilotSheetProps) {
  const copy = {
    eyebrow: "Helios · asesor laboral",
    title: "Tu asesor laboral ya entendió lo visible de tu expediente",
    description:
      "Cuéntale qué te preocupa y te responderá con una orientación clara, lo que ya se puede sostener, lo que falta confirmar y el siguiente paso más útil con base en tus documentos.",
    documentBadge: "Basado en tus documentos visibles",
    capabilityBadge: "Puede explicar, conectar y señalar el documento útil que falte",
    quickHighlights: [
      "Te traduce lo complejo a lenguaje claro",
      "Retoma tu contexto reciente sin sacarte del flujo",
      "Te dice qué documento puede destrabar mejor tu caso",
    ],
    promptsHeading: "Preguntas rápidas para seguir contigo",
    historyHeading: "Continuidad reciente de tu caso",
    supportingHeading: "Evidencia de tu caso",
    toneHeading: "Cómo quieres que responda",
    toneBriefLabel: "Breve",
    toneExplainedLabel: "Más explicativo",
    toneBriefHint: "Va al punto y resume lo esencial en menos líneas.",
    toneExplainedHint:
      "Da más contexto y baja a lenguaje simple lo importante del punto legal.",
    placeholder:
      "Cuéntame qué pasó o qué te preocupa. Tu asesor laboral responde con base en tus documentos visibles",
    emptyStateMessage:
      "Tu asesor laboral ya tiene contexto para empezar. Puede explicarte tu situación actual, decirte qué falta confirmar y señalar qué documento podría ayudarte más después.",
    closeLabel: "Volver al expediente",
    ...uiCopy,
  };
  const visibleHistoryItems = historyItems.slice(0, 3);
  const visibleSupportingDocuments = supportingDocuments.slice(0, 3);
  const visibleSuggestedPrompts = suggestedPrompts.slice(0, 4);
  const quickHighlights = copy.quickHighlights.slice(0, 3);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full border-l border-slate-200 bg-white p-0 transition-colors duration-300 dark:border-white/10 dark:bg-slate-950 sm:max-w-xl"
      >
        <div className="flex h-full flex-col">
          <SheetHeader className="border-b border-slate-200 bg-slate-50/80 px-5 py-5 text-left transition-colors duration-300 dark:border-white/10 dark:bg-slate-950/90 sm:px-6">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-teal-100 text-teal-700 transition-colors duration-300 dark:bg-teal-400/14 dark:text-teal-200">
                <Sparkles className="h-5 w-5" strokeWidth={1.8} />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-700 dark:text-teal-200">
                  {copy.eyebrow}
                </p>
                <SheetTitle className="mt-1 text-lg tracking-[-0.02em] text-slate-950 dark:text-slate-50">
                  {copy.title}
                </SheetTitle>
                <SheetDescription className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                  {copy.description}
                </SheetDescription>
              </div>
            </div>

            <div className="mt-4 space-y-3 rounded-[1.2rem] border border-teal-100 bg-white p-4 shadow-sm transition-colors duration-300 dark:border-teal-400/25 dark:bg-slate-900/85">
              <p className="text-sm font-semibold text-slate-950 dark:text-slate-50">
                {caseTitle ?? "Expediente activo"}
                {employeeName ? (
                  <span className="font-normal text-slate-600 dark:text-slate-300">
                    {" "}· {employeeName}
                  </span>
                ) : null}
              </p>
              {summary ? (
                <p className="text-sm leading-6 text-slate-700 dark:text-slate-200">
                  {summary}
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2 text-xs font-semibold">
                <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  {copy.documentBadge}
                </span>
                <span className="rounded-full bg-white px-3 py-1 text-slate-700 dark:bg-slate-900 dark:text-slate-200">
                  {copy.capabilityBadge}
                </span>
                {typeof confidenceScore === "number" ? (
                  <span className="rounded-full bg-teal-50 px-3 py-1 text-teal-800 dark:bg-teal-400/14 dark:text-teal-100">
                    Confianza orientativa {confidenceScore}%
                  </span>
                ) : null}
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {quickHighlights.map((item) => (
                  <div
                    key={item}
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-700 dark:border-white/10 dark:bg-slate-950/70 dark:text-slate-200"
                  >
                    {item}
                  </div>
                ))}
              </div>
              {onResponseToneChange ? (
                <div className="rounded-[1rem] border border-slate-200 bg-slate-50 px-3 py-3 dark:border-white/10 dark:bg-slate-950/70">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                    {copy.toneHeading}
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className={`rounded-full ${
                        responseTone === "brief"
                          ? "border-teal-200 bg-teal-50 text-teal-900 hover:bg-teal-100 dark:border-teal-400/30 dark:bg-teal-400/14 dark:text-teal-100"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-white/12 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                      }`}
                      onClick={() => onResponseToneChange("brief")}
                    >
                      {copy.toneBriefLabel}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className={`rounded-full ${
                        responseTone === "explained"
                          ? "border-teal-200 bg-teal-50 text-teal-900 hover:bg-teal-100 dark:border-teal-400/30 dark:bg-teal-400/14 dark:text-teal-100"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-white/12 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                      }`}
                      onClick={() => onResponseToneChange("explained")}
                    >
                      {copy.toneExplainedLabel}
                    </Button>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                    {responseTone === "explained"
                      ? copy.toneExplainedHint
                      : copy.toneBriefHint}
                  </p>
                </div>
              ) : null}
            </div>

            {visibleSuggestedPrompts.length ? (
              <div className="mt-4 rounded-[1.2rem] border border-slate-200 bg-white p-4 shadow-sm transition-colors duration-300 dark:border-white/10 dark:bg-slate-900/85">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                  {copy.promptsHeading}
                </p>
                {suggestedPromptsContext ? (
                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                    {suggestedPromptsContext}
                  </p>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  {visibleSuggestedPrompts.map((prompt) => (
                    <Button
                      key={prompt}
                      type="button"
                      variant="outline"
                      className="h-auto rounded-full border-slate-200 bg-white px-4 py-2 text-left text-xs leading-5 text-slate-700 hover:bg-slate-50 dark:border-white/12 dark:bg-slate-950/70 dark:text-slate-100 dark:hover:bg-slate-900"
                      onClick={() => onSendMessage(prompt)}
                    >
                      {prompt}
                    </Button>
                  ))}
                </div>
              </div>
            ) : null}
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-4 pb-4 pt-4 sm:px-6">
            {visibleHistoryItems.length ? (
              <div className="mb-4 rounded-[1.2rem] border border-slate-200 bg-slate-50 p-4 transition-colors duration-300 dark:border-white/10 dark:bg-slate-900/75">
                <div className="flex items-center gap-2">
                  <Clock3
                    className="h-4 w-4 text-slate-500 dark:text-slate-400"
                    strokeWidth={1.8}
                  />
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                    {copy.historyHeading}
                  </p>
                </div>
                {historyContext ? (
                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                    {historyContext}
                  </p>
                ) : null}
                <div className="mt-3 space-y-3">
                  {visibleHistoryItems.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-[1rem] border border-white bg-white p-3 transition-colors duration-300 dark:border-white/10 dark:bg-slate-950/70"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-semibold text-slate-950 dark:text-slate-50">
                          {item.title}
                        </p>
                        {item.timestampLabel ? (
                          <span className="shrink-0 text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">
                            {item.timestampLabel}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                        {item.detail}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {nextSuggestedDocument ? (
              <div className="mb-4 rounded-[1.2rem] border border-emerald-100 bg-emerald-50/80 p-4 transition-colors duration-300 dark:border-emerald-400/20 dark:bg-emerald-400/10">
                <div className="flex items-center gap-2">
                  <FileText
                    className="h-4 w-4 text-emerald-700 dark:text-emerald-200"
                    strokeWidth={1.8}
                  />
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-800 dark:text-emerald-100">
                    {nextSuggestedDocument.title}
                  </p>
                </div>
                <div className="mt-3 rounded-[1rem] border border-white/90 bg-white p-3 transition-colors duration-300 dark:border-white/10 dark:bg-slate-950/70">
                  <p className="text-sm font-semibold text-slate-950 dark:text-slate-50">
                    {nextSuggestedDocument.label}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                    {nextSuggestedDocument.reason}
                  </p>

                  {nextSuggestedDocument.confirmedSummary ||
                  nextSuggestedDocument.missingSummary ? (
                    <div className="mt-3 rounded-[0.95rem] border border-emerald-100 bg-emerald-50/70 p-3 dark:border-emerald-400/20 dark:bg-emerald-400/10">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-800 dark:text-emerald-100">
                        {nextSuggestedDocument.contrastTitle ??
                          "Lo ya confirmado vs lo que este archivo aclararía"}
                      </p>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-[0.9rem] border border-white/90 bg-white px-3 py-3 dark:border-white/10 dark:bg-slate-950/70">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                            Ya confirmado
                          </p>
                          <p className="mt-1 text-sm leading-6 text-slate-700 dark:text-slate-200">
                            {nextSuggestedDocument.confirmedSummary ??
                              "Ya existe base inicial en tu expediente."}
                          </p>
                        </div>
                        <div className="rounded-[0.9rem] border border-white/90 bg-white px-3 py-3 dark:border-white/10 dark:bg-slate-950/70">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                            Lo que aclararía
                          </p>
                          <p className="mt-1 text-sm leading-6 text-slate-700 dark:text-slate-200">
                            {nextSuggestedDocument.missingSummary ??
                              nextSuggestedDocument.reason}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {nextSuggestedDocument.actionHint ? (
                    <p className="mt-3 text-xs leading-5 text-emerald-900 dark:text-emerald-100">
                      {nextSuggestedDocument.actionHint}
                    </p>
                  ) : null}

                  {onFocusSuggestedDocument ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="mt-3 w-full rounded-full border-emerald-200 bg-white text-emerald-900 hover:bg-emerald-100 dark:border-emerald-400/30 dark:bg-slate-950 dark:text-emerald-100 dark:hover:bg-slate-900"
                      onClick={onFocusSuggestedDocument}
                    >
                      {nextSuggestedDocument.ctaLabel ?? "Subir este documento ahora"}
                      <ArrowRight className="ml-2 h-4 w-4" strokeWidth={1.8} />
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : null}

            {visibleSupportingDocuments.length ? (
              <div className="mb-4 rounded-[1.2rem] border border-teal-100 bg-teal-50/70 p-4 transition-colors duration-300 dark:border-teal-400/25 dark:bg-teal-400/10">
                <div className="flex items-center gap-2">
                  <FileText
                    className="h-4 w-4 text-teal-700 dark:text-teal-200"
                    strokeWidth={1.8}
                  />
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-800 dark:text-teal-100">
                    {copy.supportingHeading}
                  </p>
                </div>
                <div className="mt-3 space-y-3">
                  {visibleSupportingDocuments.map((document) => (
                    <div
                      key={document.id}
                      className="rounded-[1rem] border border-white/90 bg-white p-3 transition-colors duration-300 dark:border-white/10 dark:bg-slate-950/70"
                    >
                      <p className="text-sm font-semibold text-slate-950 dark:text-slate-50">
                        {document.label}
                      </p>
                      <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                        {document.detail}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="min-h-[22rem]">
              <AIChatBox
                messages={messages}
                onSendMessage={onSendMessage}
                isLoading={isLoading}
                className="h-full border-slate-200 shadow-none dark:border-white/10"
                height="100%"
                placeholder={copy.placeholder}
                emptyStateMessage={copy.emptyStateMessage}
                suggestedPrompts={[]}
              />
            </div>
          </div>

          <div className="border-t border-slate-200 bg-slate-50 px-5 py-4 transition-colors duration-300 dark:border-white/10 dark:bg-slate-950/90 sm:px-6">
            <p className="text-xs leading-6 text-slate-500 dark:text-slate-400">
              {disclaimer ??
                "Esta orientación se basa en los documentos visibles de tu expediente y en una lectura preliminar. No sustituye a un abogado ni constituye asesoría legal vinculante."}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-full border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-white/12 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                onClick={() => onOpenChange(false)}
              >
                {copy.closeLabel}
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

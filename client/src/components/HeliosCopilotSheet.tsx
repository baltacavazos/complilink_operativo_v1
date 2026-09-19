import { AIChatBox, type Message as AIChatMessage } from "@/components/AIChatBox";
import { sanitizeClientVisibleCopy } from "@/lib/clientVisibleCopy";
import {
  WORKER_CHAT_DISCLAIMER,
  WORKER_CHAT_SHEET_COPY,
  WORKER_CHAT_SOURCES_HEADING,
  sanitizeVisibleChatHistoryContent,
} from "@shared/workerChatUx";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ArrowRight, Clock3, FileText, Scale, Sparkles } from "lucide-react";

export type HeliosOfficialTitle = {
  title: string;
  url: string;
  kindLabel?: string | null;
  source?: "scjn" | "dof" | string;
};

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
  officialSourcesHeading?: string;
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
  officialTitles?: HeliosOfficialTitle[];
  officialSourcesNote?: string | null;
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
  officialTitles = [],
  officialSourcesNote,
  uiCopy,
}: HeliosCopilotSheetProps) {
  const mergedCopy = {
    ...WORKER_CHAT_SHEET_COPY,
    quickHighlights: [...WORKER_CHAT_SHEET_COPY.quickHighlights],
    ...uiCopy,
  };
  const sanitizeMultiline = (value?: string | null) => {
    if (value == null) return value ?? null;
    return sanitizeVisibleChatHistoryContent(value);
  };
  const copy = {
    ...mergedCopy,
    eyebrow: sanitizeClientVisibleCopy(mergedCopy.eyebrow) ?? mergedCopy.eyebrow,
    title: sanitizeClientVisibleCopy(mergedCopy.title) ?? mergedCopy.title,
    description: sanitizeClientVisibleCopy(mergedCopy.description) ?? mergedCopy.description,
    documentBadge: sanitizeClientVisibleCopy(mergedCopy.documentBadge) ?? mergedCopy.documentBadge,
    capabilityBadge:
      sanitizeClientVisibleCopy(mergedCopy.capabilityBadge) ?? mergedCopy.capabilityBadge,
    promptsHeading:
      sanitizeClientVisibleCopy(mergedCopy.promptsHeading) ?? mergedCopy.promptsHeading,
    historyHeading:
      sanitizeClientVisibleCopy(mergedCopy.historyHeading) ?? mergedCopy.historyHeading,
    supportingHeading:
      sanitizeClientVisibleCopy(mergedCopy.supportingHeading) ?? mergedCopy.supportingHeading,
    placeholder: sanitizeClientVisibleCopy(mergedCopy.placeholder) ?? mergedCopy.placeholder,
    emptyStateMessage:
      sanitizeClientVisibleCopy(mergedCopy.emptyStateMessage) ?? mergedCopy.emptyStateMessage,
    closeLabel: sanitizeClientVisibleCopy(mergedCopy.closeLabel) ?? mergedCopy.closeLabel,
    officialSourcesHeading:
      sanitizeClientVisibleCopy(
        mergedCopy.officialSourcesHeading ?? WORKER_CHAT_SOURCES_HEADING,
      ) ?? WORKER_CHAT_SOURCES_HEADING,
    quickHighlights: mergedCopy.quickHighlights.map(
      (item) => sanitizeClientVisibleCopy(item) ?? item,
    ),
  };
  const visibleHistoryItems = historyItems.slice(0, 3).map((item) => ({
    ...item,
    title: sanitizeClientVisibleCopy(item.title) ?? item.title,
    detail: sanitizeClientVisibleCopy(item.detail) ?? item.detail,
  }));
  const visibleSupportingDocuments = supportingDocuments.slice(0, 3).map((document) => ({
    ...document,
    label: sanitizeClientVisibleCopy(document.label) ?? document.label,
    detail: sanitizeClientVisibleCopy(document.detail) ?? document.detail,
  }));
  const visibleSuggestedPrompts = suggestedPrompts
    .slice(0, 4)
    .map((prompt) => sanitizeClientVisibleCopy(prompt) ?? prompt);
  const visibleMessages = messages.map((message) => ({
    ...message,
    content: sanitizeMultiline(message.content) ?? message.content,
  }));
  const visibleSummary = sanitizeMultiline(summary) ?? summary;
  const visibleDisclaimer = sanitizeMultiline(disclaimer) ?? disclaimer;
  const visibleCaseTitle = sanitizeClientVisibleCopy(caseTitle) ?? caseTitle;
  const visibleOfficialTitles = officialTitles.slice(0, 3).map((item) => ({
    ...item,
    title: sanitizeClientVisibleCopy(item.title) ?? item.title,
    kindLabel: item.kindLabel
      ? sanitizeClientVisibleCopy(item.kindLabel) ?? item.kindLabel
      : null,
  }));
  const visibleOfficialNote =
    sanitizeClientVisibleCopy(officialSourcesNote) ?? officialSourcesNote;
  const visiblePromptsContext =
    sanitizeClientVisibleCopy(suggestedPromptsContext) ?? suggestedPromptsContext;
  const visibleHistoryContext = sanitizeClientVisibleCopy(historyContext) ?? historyContext;
  const quickHighlights = copy.quickHighlights.slice(0, 4);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        data-testid="ap-worker-chat"
        className="ap-worker-chat h-full w-full max-w-full border-l border-slate-200/80 bg-[#f7f8fa] p-0 sm:max-w-xl"
      >
        <div className="flex h-full flex-col">
          <SheetHeader className="ap-chat-header border-b border-slate-200/80 bg-white/90 px-4 py-4 pr-12 text-left backdrop-blur-md sm:px-6 sm:py-5">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-teal-50 text-teal-800">
                <Sparkles className="h-5 w-5" strokeWidth={1.7} />
              </div>
              <div className="min-w-0">
                <p className="text-[12px] font-medium tracking-[-0.01em] text-teal-800">
                  {copy.eyebrow}
                </p>
                <SheetTitle className="mt-1 text-[1.25rem] font-semibold leading-snug tracking-[-0.03em] text-slate-950 sm:text-[1.4rem]">
                  {copy.title}
                </SheetTitle>
                <SheetDescription className="mt-1.5 text-[0.95rem] leading-6 tracking-[-0.015em] text-slate-700">
                  {copy.description}
                </SheetDescription>
              </div>
            </div>

            <div className="mt-5 space-y-3 rounded-[1.35rem] border border-slate-200/80 bg-white p-4 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.28)]">
              <p className="text-sm font-semibold text-slate-950">
                {visibleCaseTitle ?? "Expediente activo"}
                {employeeName ? (
                  <span className="font-normal text-slate-600">
                    {" "}· {employeeName}
                  </span>
                ) : null}
              </p>
              {visibleSummary ? (
                <p className="text-sm leading-6 text-slate-700">
                  {visibleSummary}
                </p>
              ) : null}
              <div className="flex flex-wrap gap-1.5">
                <span className="ap-chat-chip">
                  {copy.documentBadge}
                </span>
                <span className="ap-chat-chip">
                  {copy.capabilityBadge}
                </span>
                {typeof confidenceScore === "number" ? (
                  <span className="ap-chat-chip">
                    Confianza orientativa {confidenceScore}%
                  </span>
                ) : null}
              </div>
              <div className="ap-chat-compact-hide mt-3 grid gap-2 sm:grid-cols-2">
                {quickHighlights.map((item) => (
                  <div
                    key={item}
                    className="rounded-2xl border border-slate-200/80 bg-[#f7f8fa] px-3 py-2.5 text-[0.78rem] leading-5 tracking-[-0.01em] text-slate-600"
                  >
                    {item}
                  </div>
                ))}
              </div>
              {onResponseToneChange ? (
                <div className="ap-chat-compact-hide rounded-[1.15rem] border border-slate-200/80 bg-[#f7f8fa] px-3 py-3">
                  <p className="text-[12px] font-medium tracking-[-0.01em] text-slate-500">
                    {copy.toneHeading}
                  </p>
                  <div className="mt-2.5 grid grid-cols-2 gap-1 rounded-full bg-white p-1">
                    <Button
                      type="button"
                      variant="outline"
                      className={`h-9 rounded-full border-0 text-[0.82rem] shadow-none ${
                        responseTone === "brief"
                          ? "bg-slate-950 text-white hover:bg-slate-800"
                          : "bg-transparent text-slate-600 hover:bg-slate-50"
                      }`}
                      onClick={() => onResponseToneChange("brief")}
                    >
                      {copy.toneBriefLabel}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className={`h-9 rounded-full border-0 text-[0.82rem] shadow-none ${
                        responseTone === "explained"
                          ? "bg-slate-950 text-white hover:bg-slate-800"
                          : "bg-transparent text-slate-600 hover:bg-slate-50"
                      }`}
                      onClick={() => onResponseToneChange("explained")}
                    >
                      {copy.toneExplainedLabel}
                    </Button>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    {responseTone === "explained"
                      ? copy.toneExplainedHint
                      : copy.toneBriefHint}
                  </p>
                </div>
              ) : null}
            </div>

            {visibleSuggestedPrompts.length ? (
              <div className="mt-4 rounded-[1.35rem] border border-slate-200/80 bg-white p-4 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.22)] transition-colors duration-300">
                <p className="text-[12px] font-medium tracking-[-0.01em] text-slate-500">
                  {copy.promptsHeading}
                </p>
                {visiblePromptsContext ? (
                  <p className="mt-2 text-[0.92rem] leading-6 tracking-[-0.015em] text-slate-500">
                    {visiblePromptsContext}
                  </p>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  {visibleSuggestedPrompts.map((prompt) => (
                    <Button
                      key={prompt}
                      type="button"
                      variant="outline"
                      className="ap-chat-prompt motion-hover-lift h-auto rounded-full px-3.5 py-2 text-left text-[0.82rem] leading-5 tracking-[-0.01em] text-slate-800"
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
              <div className="mb-4 rounded-[1.2rem] border border-slate-200 bg-slate-50 p-4 transition-colors duration-300">
                <div className="flex items-center gap-2">
                  <Clock3
                    className="h-4 w-4 text-slate-500"
                    strokeWidth={1.8}
                  />
                  <p className="text-[12px] font-medium tracking-[-0.01em] text-slate-500">
                    {copy.historyHeading}
                  </p>
                </div>
                {visibleHistoryContext ? (
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {visibleHistoryContext}
                  </p>
                ) : null}
                <div className="mt-3 space-y-3">
                  {visibleHistoryItems.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-[1rem] border border-white bg-white p-3 transition-colors duration-300"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-semibold text-slate-950">
                          {item.title}
                        </p>
                        {item.timestampLabel ? (
                          <span className="shrink-0 text-[11px] font-medium tracking-[-0.01em] text-slate-400">
                            {item.timestampLabel}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-sm leading-6 text-slate-600">
                        {item.detail}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {nextSuggestedDocument ? (
              <div className="mb-4 rounded-[1.2rem] border border-emerald-100 bg-emerald-50/80 p-4 transition-colors duration-300">
                <div className="flex items-center gap-2">
                  <FileText
                    className="h-4 w-4 text-emerald-700"
                    strokeWidth={1.8}
                  />
                  <p className="text-[12px] font-medium tracking-[-0.01em] text-emerald-800">
                    {nextSuggestedDocument.title}
                  </p>
                </div>
                <div className="mt-3 rounded-[1rem] border border-white/90 bg-white p-3 transition-colors duration-300">
                  <p className="text-sm font-semibold text-slate-950">
                    {nextSuggestedDocument.label}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    {nextSuggestedDocument.reason}
                  </p>

                  {nextSuggestedDocument.confirmedSummary ||
                  nextSuggestedDocument.missingSummary ? (
                    <div className="mt-3 rounded-[0.95rem] border border-emerald-100 bg-emerald-50/70 p-3">
                      <p className="text-[12px] font-medium tracking-[-0.01em] text-emerald-800">
                        {nextSuggestedDocument.contrastTitle ??
                          "Lo ya confirmado vs lo que este archivo aclararía"}
                      </p>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-[0.9rem] border border-white/90 bg-white px-3 py-3">
                          <p className="text-[11px] font-medium tracking-[-0.01em] text-slate-500">
                            Ya confirmado
                          </p>
                          <p className="mt-1 text-sm leading-6 text-slate-700">
                            {nextSuggestedDocument.confirmedSummary ??
                              "Ya existe base inicial en tu expediente."}
                          </p>
                        </div>
                        <div className="rounded-[0.9rem] border border-white/90 bg-white px-3 py-3">
                          <p className="text-[11px] font-medium tracking-[-0.01em] text-slate-500">
                            Lo que aclararía
                          </p>
                          <p className="mt-1 text-sm leading-6 text-slate-700">
                            {nextSuggestedDocument.missingSummary ??
                              nextSuggestedDocument.reason}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {nextSuggestedDocument.actionHint ? (
                    <p className="mt-3 text-xs leading-5 text-emerald-900">
                      {nextSuggestedDocument.actionHint}
                    </p>
                  ) : null}

                  {onFocusSuggestedDocument ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="mt-3 w-full rounded-full border-emerald-200 bg-white text-emerald-900 hover:bg-emerald-100"
                      onClick={onFocusSuggestedDocument}
                    >
                      {nextSuggestedDocument.ctaLabel ?? "Subir este documento ahora"}
                      <ArrowRight className="ml-2 h-4 w-4" strokeWidth={1.8} />
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : null}

            {visibleOfficialTitles.length || visibleOfficialNote ? (
              <div
                className="ap-chat-official mb-4 rounded-[1.2rem] border border-slate-200/90 bg-white p-4"
                data-testid="ap-chat-official-sources"
              >
                <div className="flex items-center gap-2">
                  <Scale className="h-4 w-4 text-teal-800" strokeWidth={1.8} />
                  <p className="text-[12px] font-medium tracking-[-0.01em] text-slate-600">
                    {copy.officialSourcesHeading}
                  </p>
                </div>
                {visibleOfficialNote ? (
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {visibleOfficialNote}
                  </p>
                ) : null}
                {visibleOfficialTitles.length ? (
                  <div className="mt-3 space-y-2.5">
                    {visibleOfficialTitles.map((item) => (
                      <a
                        key={`${item.source ?? "official"}-${item.url}`}
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="ap-chat-source-link block rounded-[1rem] border border-slate-200/80 bg-[#f7f8fa] px-3 py-3"
                      >
                        {item.kindLabel ? (
                          <p className="text-[11px] font-medium tracking-[-0.01em] text-teal-800">
                            {item.kindLabel}
                          </p>
                        ) : null}
                        <p
                          className="mt-1 line-clamp-3 text-sm font-medium leading-6 tracking-[-0.015em] text-slate-950"
                          title={item.title}
                        >
                          {item.title}
                        </p>
                      </a>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            {visibleSupportingDocuments.length ? (
              <div className="mb-4 rounded-[1.2rem] border border-teal-100 bg-teal-50/70 p-4 transition-colors duration-300">
                <div className="flex items-center gap-2">
                  <FileText
                    className="h-4 w-4 text-teal-700"
                    strokeWidth={1.8}
                  />
                  <p className="text-[12px] font-medium tracking-[-0.01em] text-teal-800">
                    {copy.supportingHeading}
                  </p>
                </div>
                <div className="mt-3 space-y-3">
                  {visibleSupportingDocuments.map((document) => (
                    <div
                      key={document.id}
                      className="rounded-[1rem] border border-white/90 bg-white p-3 transition-colors duration-300"
                    >
                      <p className="text-sm font-semibold text-slate-950">
                        {document.label}
                      </p>
                      <p className="mt-1 text-sm leading-6 text-slate-600">
                        {document.detail}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="ap-chat-thread min-h-[14rem] sm:min-h-[22rem]">
              <AIChatBox
                messages={visibleMessages}
                onSendMessage={onSendMessage}
                isLoading={isLoading}
                variant="calm"
                className="h-full border-0 bg-transparent shadow-none"
                height="100%"
                placeholder={copy.placeholder}
                emptyStateMessage={copy.emptyStateMessage}
                suggestedPrompts={[]}
              />
            </div>
          </div>

          <div className="border-t border-slate-200/80 bg-white/90 px-5 py-4 backdrop-blur-md transition-colors duration-300 sm:px-6">
            <p className="text-[0.78rem] leading-6 tracking-[-0.01em] text-slate-600">
              {visibleDisclaimer ?? WORKER_CHAT_DISCLAIMER}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-10 rounded-full border-slate-200/80 bg-white px-5 text-[0.88rem] text-slate-600 hover:bg-slate-50"
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

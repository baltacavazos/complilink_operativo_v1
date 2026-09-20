import {
  ADVISOR_MEMORY_MODEL,
  mergeAdvisorMemory,
  parseAdvisorMemoryLlmPayload,
  resolveAdvisorMemoryModel,
  type AdvisorMemoryRecord,
  type AdvisorMemoryScope,
} from "@shared/advisorMemory";
import { invokeLLM } from "./_core/llm";

export {
  ADVISOR_MEMORY_MODEL,
  buildAdvisorGreeting,
  buildAsesorContinuityIntro,
  buildAdvisorMemoryScopeKey,
  createScopedAdvisorMemoryStore,
  formatAdvisorMemoryForPrompt,
  hasAdvisorMemoryContent,
  mergeAdvisorMemory,
  normalizeAdvisorMemoryRecord,
  parseAdvisorMemoryLlmPayload,
  resolveAdvisorMemoryModel,
  toPublicAdvisorMemory,
  type AdvisorMemoryRecord,
  type AdvisorMemoryScope,
} from "@shared/advisorMemory";

export const ADVISOR_MEMORY_SYSTEM_PROMPT = [
  "Actualizas la memoria durable de un expediente laboral mexicano.",
  "Devuelve solo JSON con greeting, highlights, documentsDiscussed, risksFlagged y nextSteps.",
  "El greeting va en español cálido, caso primero, como quien ya conoce a esta persona y a su patrón.",
  "Nunca escribas Helios, CompliLink, GPT, mini, ni nombres de modelos.",
  "Nunca te presentes como abogado ni autoridad.",
  "No inventes documentos, riesgos ni pasos que no estén en el contexto.",
  "Máximo 5 frases cortas por lista. Sin tecnicismos.",
].join(" ");

function readLlmText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .filter(
      (part): part is { type: "text"; text: string } =>
        Boolean(part) &&
        typeof part === "object" &&
        "type" in part &&
        (part as { type?: string }).type === "text" &&
        typeof (part as { text?: unknown }).text === "string",
    )
    .map((part) => part.text)
    .join("\n");
}

export function buildAdvisorMemorySummarizePrompt(params: {
  previous?: AdvisorMemoryRecord | null;
  employeeName?: string | null;
  employerEntity?: string | null;
  caseTitle?: string | null;
  prompt: string;
  answer: string;
  visibleDocuments?: Array<{ originalName?: string | null; documentType?: string | null }>;
}): string {
  return JSON.stringify(
    {
      persona: params.employeeName ?? null,
      patron: params.employerEntity ?? null,
      expediente: params.caseTitle ?? null,
      memoriaPrevia: params.previous
        ? {
            highlights: params.previous.highlights,
            documentsDiscussed: params.previous.documentsDiscussed,
            risksFlagged: params.previous.risksFlagged,
            nextSteps: params.previous.nextSteps,
          }
        : null,
      documentosVisibles: (params.visibleDocuments ?? [])
        .map((document) => document.originalName || document.documentType)
        .filter(Boolean)
        .slice(0, 6),
      ultimaPregunta: params.prompt,
      ultimaRespuesta: params.answer,
    },
    null,
    2,
  );
}

export type SummarizeAdvisorMemoryParams = {
  previous?: AdvisorMemoryRecord | null;
  scope: AdvisorMemoryScope;
  employeeName?: string | null;
  employerEntity?: string | null;
  caseTitle?: string | null;
  prompt: string;
  answer: string;
  visibleDocuments?: Array<{ originalName?: string | null; documentType?: string | null }>;
};

export function buildFallbackAdvisorMemory(
  params: SummarizeAdvisorMemoryParams,
): AdvisorMemoryRecord {
  return mergeAdvisorMemory({
    ...params,
    draft: null,
    modelUsed: ADVISOR_MEMORY_MODEL,
  });
}

export async function summarizeAdvisorCaseMemory(
  params: SummarizeAdvisorMemoryParams,
): Promise<AdvisorMemoryRecord> {
  const model = resolveAdvisorMemoryModel();
  const fallback = buildFallbackAdvisorMemory({ ...params, modelUsed: model });

  try {
    const response = await invokeLLM({
      model,
      messages: [
        { role: "system", content: ADVISOR_MEMORY_SYSTEM_PROMPT },
        { role: "user", content: buildAdvisorMemorySummarizePrompt(params) },
      ],
      responseFormat: { type: "json_object" },
    });
    const draft = parseAdvisorMemoryLlmPayload(readLlmText(response.choices[0]?.message.content));
    if (!draft) return fallback;
    return mergeAdvisorMemory({
      ...params,
      draft,
      modelUsed: model,
    });
  } catch {
    return fallback;
  }
}

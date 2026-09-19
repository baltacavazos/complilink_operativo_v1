import {
  WORKER_CHAT_CLEAR_HEADING,
  WORKER_CHAT_DISCLAIMER,
  WORKER_CHAT_KNOWN_HEADING,
  WORKER_CHAT_MISSING_HEADING,
  WORKER_CHAT_MULTI_DOC_UPSELL,
  WORKER_CHAT_NEXT_HEADING,
  WORKER_CHAT_TITLE,
  buildWorkerStarterQuestions,
  formatWorkerChatAnswer,
  sanitizeWorkerChatCopy,
  type WorkerChatStarterContext,
} from "@shared/workerChatUx";
import {
  DOCUMENT_SIGNAL_DISCLAIMER,
  describeWorkerReviewSource,
  isPreferredRemoteWorkerOpinion,
  summarizeLaborFiscalSignals,
  type DocumentLaborFiscalInput,
} from "./laborFiscalSignals";
import {
  buildLaborFiscalChatGuidance,
  type WorkerChatLaborGuidance,
} from "./workerChatLaborGuidance";

type RecordLike = Record<string, unknown>;

export type WorkerChatLegalFoundation = {
  title: string;
  reference: string;
  relevance: string;
};

export type WorkerChatGrounding = {
  liveImssValidation: false;
  validationMode: "document_signals";
  documentsCount: number;
  documentType: string | null;
  summary: string | null;
  recommendedNextStep: string | null;
  uncertainties: string[];
  keyFacts: string[];
  legalFoundations: WorkerChatLegalFoundation[];
  allowedLegalReferences: string[];
  laborFacts: ReturnType<typeof summarizeLaborFiscalSignals>["facts"];
  laborExplanations: ReturnType<typeof summarizeLaborFiscalSignals>["explanations"];
  hasImssSignal: boolean;
  hasFiscalSignal: boolean;
  hasInfonavitSignal: boolean;
  missingDocumentLabel: string | null;
  missingDocumentReason: string | null;
  resultCardQuestions: string[];
  disclaimer: string;
  multiDocUpsell: string | null;
  sourceOpinion: unknown;
  prefersRemoteOpinion: boolean;
  reviewSource: "local" | "remote";
  reviewSourceLabel: string;
};

function asRecord(value: unknown): RecordLike | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as RecordLike;
}

function asText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const next = value.replace(/\s+/g, " ").trim();
  return next.length > 0 ? next : null;
}

function asTextList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => asText(item))
    .filter((item): item is string => Boolean(item));
}

function readLegalFoundations(opinion: RecordLike | null): WorkerChatLegalFoundation[] {
  const raw = opinion?.legalFoundations;
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item) => {
      const record = asRecord(item);
      if (!record) return null;
      const title = asText(record.title);
      const reference = asText(record.reference);
      const relevance = asText(record.relevance);
      if (!title && !reference && !relevance) return null;
      return {
        title: title ?? "Base de la lectura",
        reference: reference ?? "Ya aparece en la lectura de tus documentos",
        relevance: relevance ?? "Ayuda a entender lo que ya se ve en tus papeles.",
      };
    })
    .filter((item): item is WorkerChatLegalFoundation => item !== null)
    .slice(0, 4);
}

export function buildWorkerChatGrounding(params: {
  documents: DocumentLaborFiscalInput[];
  opinion?: unknown;
  missingDocument?: { label?: string | null; reason?: string | null } | null;
  multiDocUpsell?: string | null;
}): WorkerChatGrounding {
  const opinion = asRecord(params.opinion);
  const labor = summarizeLaborFiscalSignals(params.documents);
  const legalFoundations = readLegalFoundations(opinion);
  const resultCard = asRecord(opinion?.resultCard);
  const summary = asText(opinion?.summary) ?? asText(opinion?.legalOpinion);
  const recommendedNextStep =
    asText(opinion?.recommendedNextStep) ??
    asText(resultCard?.nextStepSummary) ??
    asText(params.missingDocument?.reason) ??
    null;
  const review = describeWorkerReviewSource(params.opinion);

  return {
    liveImssValidation: false,
    validationMode: "document_signals",
    documentsCount: params.documents.length,
    documentType: labor.snapshots[0]?.documentType ?? asText(params.documents[0]?.documentType),
    summary,
    recommendedNextStep,
    uncertainties: asTextList(opinion?.uncertainties).slice(0, 3),
    keyFacts: asTextList(opinion?.keyFactsUsed).slice(0, 4),
    legalFoundations,
    allowedLegalReferences: legalFoundations.flatMap((item) => [item.title, item.reference]),
    laborFacts: labor.facts,
    laborExplanations: labor.explanations,
    hasImssSignal: labor.hasImssSignal,
    hasFiscalSignal: labor.hasFiscalSignal,
    hasInfonavitSignal: labor.hasInfonavitSignal,
    missingDocumentLabel: asText(params.missingDocument?.label),
    missingDocumentReason: asText(params.missingDocument?.reason),
    resultCardQuestions: asTextList(resultCard?.suggestedQuestions).slice(0, 4),
    disclaimer: WORKER_CHAT_DISCLAIMER,
    multiDocUpsell: asText(params.multiDocUpsell),
    sourceOpinion: params.opinion ?? null,
    prefersRemoteOpinion: isPreferredRemoteWorkerOpinion(params.opinion),
    reviewSource: review.reviewSource,
    reviewSourceLabel: review.reviewSourceLabel,
  };
}

export function resolveWorkerChatGuidance(
  grounding: WorkerChatGrounding,
  prompt?: string | null,
): WorkerChatLaborGuidance {
  return buildLaborFiscalChatGuidance(grounding, prompt);
}

export function buildWorkerChatSuggestedPrompts(grounding: WorkerChatGrounding): string[] {
  const context: WorkerChatStarterContext = {
    documentType: grounding.documentType,
    documentsCount: grounding.documentsCount,
    hasImssSignal: grounding.hasImssSignal,
    hasFiscalSignal: grounding.hasFiscalSignal,
    hasInfonavitSignal: grounding.hasInfonavitSignal,
    missingDocumentLabel: grounding.missingDocumentLabel,
    recommendedNextStep: grounding.recommendedNextStep,
    resultCardQuestions: grounding.resultCardQuestions,
  };
  return buildWorkerStarterQuestions(context);
}

export function buildWorkerChatFallbackAnswer(
  grounding: WorkerChatGrounding,
  options?: { prompt?: string | null },
): string {
  if (grounding.documentsCount === 0) {
    return formatWorkerChatAnswer({
      answer: "Todavía no hay un documento para leer. Sin un recibo, contrato o CFDI no puedo decirte qué se ve ni qué falta.",
      known: "Aún no hay señales visibles en un papel tuyo.",
      missing: "Falta el primer documento laboral para empezar la lectura.",
      nextStep: "Sube el papel laboral que tengas más a la mano. Con eso te digo lo que sí se ve y el siguiente paso.",
      disclaimer: grounding.disclaimer,
    });
  }

  const guidance = resolveWorkerChatGuidance(grounding, options?.prompt);

  return formatWorkerChatAnswer({
    answer: guidance.clearAnswer,
    known: guidance.known,
    missing: guidance.missing,
    nextStep: guidance.nextStep,
    disclaimer: grounding.disclaimer,
    multiDocUpsell: grounding.multiDocUpsell,
  });
}

export function buildWorkerChatLlmInstructions(
  grounding: WorkerChatGrounding,
  options?: { prompt?: string | null },
): string {
  const guidance = resolveWorkerChatGuidance(grounding, options?.prompt);
  const foundations =
    grounding.legalFoundations.length > 0
      ? grounding.legalFoundations
          .map((item) => `- ${item.title} (${item.reference}): ${item.relevance}`)
          .join("\n")
      : "- No hay bases legales extra en esta lectura. No inventes artículos, tesis ni jurisprudencia.";
  const visibleFacts =
    guidance.visibleFactLines.length > 0
      ? guidance.visibleFactLines.map((item) => `- ${item}`).join("\n")
      : "- No hay montos, RFC ni NSS claros. No inventes ninguno.";

  return [
    `Internamente puedes razonar como Helios, pero NUNCA escribas Helios, Modo Helios ni CompliLink en la respuesta visible.`,
    `Si necesitas un nombre, preséntate solo como ${WORKER_CHAT_TITLE.toLowerCase()}.`,
    "Eres una lectura laboral de AuditaPatrón para una persona trabajadora en México.",
    "Habla en español simple, frases cortas, sin jerga.",
    "Nunca te presentes como Helios, CompliLink, abogado ni autoridad.",
    "Usa únicamente las señales del documento y las bases legales ya listadas.",
    "Si un dato no aparece, di que no se ve en tus papeles.",
    "Nunca inventes tesis, registro digital, Semanario Judicial, IUS ni jurisprudencia.",
    "Nunca digas que consultaste IMSS, SAT o Infonavit en vivo, ni que confirmaste un alta oficial.",
    `Modo de lectura: ${grounding.validationMode}. Validación IMSS en vivo: no.`,
    `Origen de la lectura: ${guidance.reviewSourceLabel}. ${
      guidance.prefersRemoteOpinion
        ? "Hay revisión avanzada usable. Prefiere su resumen, opinión y siguiente paso. No los sustituyas por una plantilla local."
        : "Esta es la ruta local. Profundiza con las señales visibles, sin inventar consulta oficial."
    }`,
    `Límite: ${DOCUMENT_SIGNAL_DISCLAIMER}`,
    "Hechos visibles (únicos montos, RFC o NSS que puedes citar):",
    visibleFacts,
    "Bases legales ya presentes en la lectura (únicas que puedes mencionar, en palabras simples):",
    foundations,
    `Siguiente paso ya anclado (acláralo si hace falta, no lo cambies por otro distinto): ${guidance.nextStep}`,
    `Si preguntan por IMSS e ISR (o impuestos/retenciones) juntos, el siguiente paso debe cubrir ambos: cruzar NSS/IMSS con el siguiente recibo o un papel IMSS (sin confirmar alta oficial) y cruzar la retención ISR con el CFDI o el depósito del mismo periodo. Si también mencionan Infonavit —o preguntan los tres—, cubre además el cruce de retención/crédito Infonavit con el aviso de retención o estado de crédito. Si preguntan por IMSS, impuestos o Infonavit por separado, usa esas señales y el límite honesto. Foco de esta pregunta: ${guidance.promptFocus}.`,
    `Responde con cuatro partes y estos títulos exactos: 1) ${WORKER_CHAT_CLEAR_HEADING} 2) ${WORKER_CHAT_KNOWN_HEADING} 3) ${WORKER_CHAT_MISSING_HEADING} 4) ${WORKER_CHAT_NEXT_HEADING}.`,
    "En modo breve: 1 o 2 frases por parte. En modo más explicativo: hasta 3 frases por parte.",
    `Cierra con esta frase exacta: ${WORKER_CHAT_DISCLAIMER}`,
  ].join("\n");
}

export function sanitizeWorkerChatAnswer(
  answer: string,
  grounding: WorkerChatGrounding,
  options?: { prompt?: string | null },
): string {
  const cleaned = sanitizeWorkerChatCopy(answer) ?? answer;
  const guidance = resolveWorkerChatGuidance(grounding, options?.prompt);
  return formatWorkerChatAnswer({
    answer: cleaned,
    known: guidance.known,
    missing: guidance.missing,
    nextStep: guidance.nextStep,
    disclaimer: grounding.disclaimer,
    multiDocUpsell: grounding.multiDocUpsell,
  });
}

export function buildWorkerChatContextNote(grounding: WorkerChatGrounding): string {
  return JSON.stringify(
    {
      liveImssValidation: grounding.liveImssValidation,
      validationMode: grounding.validationMode,
      documentsCount: grounding.documentsCount,
      documentType: grounding.documentType,
      summary: grounding.summary,
      recommendedNextStep: grounding.recommendedNextStep,
      uncertainties: grounding.uncertainties,
      keyFacts: grounding.keyFacts,
      legalFoundations: grounding.legalFoundations,
      laborFacts: grounding.laborFacts,
      laborExplanations: grounding.laborExplanations.slice(0, 6),
      missingDocumentLabel: grounding.missingDocumentLabel,
      missingDocumentReason: grounding.missingDocumentReason,
      resultCardQuestions: grounding.resultCardQuestions,
      prefersRemoteOpinion: grounding.prefersRemoteOpinion,
      reviewSource: grounding.reviewSource,
      guidance:
        "Responde solo con estas señales y bases. Si falta un dato, dilo. No inventes consulta oficial ni jurisprudencia. Nunca uses Helios en la salida visible. Si hay revisión avanzada, prefierela.",
    },
    null,
    2,
  );
}

type WorkerChatDocumentLike = {
  heliosOpinion?: unknown;
  createdAt?: Date | string | null;
};

function documentHasUsableOpinion(document: WorkerChatDocumentLike) {
  const opinion = asRecord(document.heliosOpinion);
  if (!opinion) return false;
  return Boolean(asText(opinion.summary) || asText(opinion.legalOpinion) || asRecord(opinion.resultCard));
}

function documentRecency(document: WorkerChatDocumentLike) {
  const value = document.createdAt;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function pickPrincipalWorkerChatDocument<T extends WorkerChatDocumentLike>(
  documents: T[],
): T | null {
  if (documents.length === 0) return null;
  return [...documents].sort((left, right) => {
    const leftOpinion = Number(documentHasUsableOpinion(left));
    const rightOpinion = Number(documentHasUsableOpinion(right));
    if (leftOpinion !== rightOpinion) return rightOpinion - leftOpinion;
    return documentRecency(right) - documentRecency(left);
  })[0] ?? null;
}

export function scopeWorkerChatDocumentsForPlan<T extends WorkerChatDocumentLike>(params: {
  documents: T[];
  canUseMultiDocument: boolean;
}): {
  documents: T[];
  scopedToSingleDocument: boolean;
  upsell: string | null;
} {
  if (params.canUseMultiDocument || params.documents.length <= 1) {
    return {
      documents: params.documents,
      scopedToSingleDocument: false,
      upsell: null,
    };
  }

  const principal = pickPrincipalWorkerChatDocument(params.documents);
  return {
    documents: principal ? [principal] : params.documents.slice(0, 1),
    scopedToSingleDocument: true,
    upsell: WORKER_CHAT_MULTI_DOC_UPSELL,
  };
}

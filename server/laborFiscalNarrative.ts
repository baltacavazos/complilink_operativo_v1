import { sanitizeClientVisibleCopy } from "../client/src/lib/clientVisibleCopy";
import {
  geminiGenerateContentUrl,
  isOpenAiModelUnavailableError,
  mapResponsesApiToInvokeResult,
  OPENAI_REASONING_EFFORT,
  OPENAI_RESPONSES_URL,
  resolveGeminiModelChain,
  resolveOpenAiModelChain,
} from "./_core/llm";
import {
  DOCUMENT_SIGNAL_DISCLAIMER,
  extractStructuredLaborFiscalFacts,
  isPreferredRemoteWorkerOpinion,
  type DocumentLaborFiscalInput,
  type LaborFiscalStructuredFacts,
} from "./laborFiscalSignals";

export const LABOR_FISCAL_NARRATIVE_TIMEOUT_MS = 6_000;
export const LABOR_FISCAL_NARRATIVE_MAX_TOKENS = 280;
const NEXT_STEP_MAX_CHARS = 220;
const EXPLANATION_MAX_CHARS = 420;
const CONCERN_MAX_CHARS = 180;

export type LaborFiscalNarrativeSource = "remote" | "ai" | "deterministic";
export type LaborFiscalNarrativeProvider = "remote" | "openai" | "gemini" | "none";

export type LaborFiscalNarrative = {
  nextStep: string;
  explanation: string;
  concern: string | null;
  source: LaborFiscalNarrativeSource;
  provider: LaborFiscalNarrativeProvider;
  liveOfficialValidation: false;
};

export type NarrativeCapableOpinion = {
  mode?: string | null;
  status?: string | null;
  summary?: string | null;
  legalOpinion?: string | null;
  recommendedNextStep?: string | null;
  resultCard?: {
    nextStepSummary?: string | null;
    simpleExplanation?: Array<{
      label: string;
      summary: string;
      tone?: "neutral" | "support" | "attention";
    }>;
  } | null;
  legalHighlights?: {
    nextActionLabel?: string | null;
  } | null;
  rawPayload?: Record<string, unknown> | null;
};

export type ResolveLaborFiscalNarrativeParams = {
  documentType?: string | null;
  document?: DocumentLaborFiscalInput;
  facts?: LaborFiscalStructuredFacts;
  preferredOpinion?: unknown;
  env?: NodeJS.ProcessEnv;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  allowInTests?: boolean;
};

const FORBIDDEN_WORKER_JARGON =
  /\b(helios|complilink|manus|forge|webhook|hmac|mime|enum|mock|openai|gemini|gpt-4|json_schema)\b/i;

const HONEST_NO_PORTAL =
  /\bno consulta(?:mos)?\b|\bsin consultar\b|\bno es una consulta\b|\bno confirma\b|\bno prueba\b|\bno valida\b|\bno sustituye\b/i;

const FAKE_OFFICIAL_QUERY =
  /(?:ya\s+)?(?:consultamos|consult[eé]|validamos|valid[eé]|confirmamos|confirm[eé]|verificamos).{0,40}(?:portal|en vivo|oficial).{0,24}(?:imss|sat|infonavit)|(?:imss|sat|infonavit).{0,40}(?:portal oficial|consulta oficial|validaci[oó]n oficial|alta est[aá] vigente)/i;

const NARRATIVE_SYSTEM_PROMPT = [
  "Eres una abogada laboral mexicana. Escribes en español claro, como se lo explicarías a una persona trabajadora.",
  "Solo puedes usar los datos extraídos del recibo o CFDI que te pasan. No inventes montos, RFC, NSS ni retenciones.",
  "Nunca digas que consultaste IMSS, SAT o Infonavit en un portal o en vivo. Ver un dato en el papel no prueba alta, vigencia ni entero.",
  "No menciones Helios, CompliLink, MIME, mock, webhook, HMAC, OpenAI, Gemini ni nombres internos.",
  "Devuelve solo JSON con nextStep (1 frase, qué hacer ahora), explanation (2 o 3 frases) y concern (1 frase o vacío).",
].join(" ");

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asText(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > 0 ? normalized : null;
}

function clipText(value: string, maxChars: number) {
  if (value.length <= maxChars) return value;
  const sliced = value.slice(0, maxChars - 1);
  const lastSpace = sliced.lastIndexOf(" ");
  return `${(lastSpace > 80 ? sliced.slice(0, lastSpace) : sliced).trimEnd()}…`;
}

function isTestRuntime() {
  return process.env.VITEST === "true" || process.env.NODE_ENV === "test";
}

export function hasLaborFiscalNarrativeAiKeys(env: NodeJS.ProcessEnv = process.env) {
  return Boolean(env.OPENAI_API_KEY?.trim() || env.GEMINI_API_KEY?.trim());
}

export function pickLaborFiscalNarrativeProvider(
  env: NodeJS.ProcessEnv = process.env,
): Exclude<LaborFiscalNarrativeProvider, "remote" | "none"> | null {
  if (env.OPENAI_API_KEY?.trim()) return "openai";
  if (env.GEMINI_API_KEY?.trim()) return "gemini";
  return null;
}

export function shouldAttemptLocalNarrativeAi(params: {
  env?: NodeJS.ProcessEnv;
  preferredOpinion?: unknown;
  allowInTests?: boolean;
}) {
  if (isPreferredRemoteWorkerOpinion(params.preferredOpinion)) return false;
  const env = params.env ?? process.env;
  if (!hasLaborFiscalNarrativeAiKeys(env)) return false;
  if (isTestRuntime() && !params.allowInTests && env.LABOR_FISCAL_NARRATIVE_AI_IN_TESTS !== "1") {
    return false;
  }
  return true;
}

export function sanitizeLaborFiscalNarrativeText(value?: string | null) {
  const cleaned = asText(sanitizeClientVisibleCopy(value) ?? value);
  if (!cleaned) return null;
  if (FORBIDDEN_WORKER_JARGON.test(cleaned)) return null;
  if (FAKE_OFFICIAL_QUERY.test(cleaned) && !HONEST_NO_PORTAL.test(cleaned)) return null;
  if (/application\/[a-z0-9.+-]+/i.test(cleaned)) return null;
  if (/document\.(uploaded|processed\.v1|rejected\.v1)/i.test(cleaned)) return null;
  return cleaned;
}

function genericNextStep(documentType?: string | null) {
  if (documentType === "cfdi") {
    return "Compara lo timbrado con tu recibo o depósito del mismo periodo antes de dar por bueno el pago.";
  }
  if (documentType === "payroll_receipt") {
    return "Si puedes, sube el CFDI o el contrato del mismo periodo para cruzar pagos, deducciones y retenciones.";
  }
  return "Aporta el otro comprobante del mismo periodo para contrastar montos y descuentos visibles.";
}

export function buildDeterministicLaborFiscalNarrative(
  facts: LaborFiscalStructuredFacts,
  documentType?: string | null,
): LaborFiscalNarrative {
  const period = facts.period;
  const netAmount = facts.netAmount;
  const retentions = [
    facts.isrWithheld ? `ISR ${facts.isrWithheld}` : null,
    facts.imssWithheld ? `IMSS ${facts.imssWithheld}` : null,
    facts.infonavitWithheld ? `Infonavit ${facts.infonavitWithheld}` : null,
  ].filter((item): item is string => Boolean(item));

  let nextStep = genericNextStep(documentType);
  if (period && netAmount) {
    nextStep =
      documentType === "cfdi"
        ? `Compara este CFDI del periodo ${period} (neto ${netAmount}) con tu recibo o depósito del mismo periodo.`
        : `Si puedes, sube el CFDI del periodo ${period} para contrastar el neto ${netAmount} y las retenciones visibles.`;
  } else if (period) {
    nextStep = `Reúne el otro comprobante del periodo ${period} (recibo o CFDI) para cruzar montos y descuentos.`;
  } else if (netAmount) {
    nextStep = `El neto visible es ${netAmount}. Cruza ese monto con el otro comprobante o con lo que realmente te depositaron.`;
  }

  const factBits = [
    period ? `periodo ${period}` : null,
    netAmount ? `neto ${netAmount}` : null,
    facts.employerRfc ? `RFC del patrón ${facts.employerRfc}` : null,
    facts.nss ? `NSS ${facts.nss}` : null,
    retentions.length > 0 ? `retenciones ${retentions.join(", ")}` : null,
  ].filter((item): item is string => Boolean(item));

  const explanation =
    factBits.length > 0
      ? `Esta lectura usa solo lo visible en el recibo o CFDI: ${factBits.join("; ")}. ${DOCUMENT_SIGNAL_DISCLAIMER}`
      : `Todavía hay pocos datos claros en el archivo. ${DOCUMENT_SIGNAL_DISCLAIMER}`;

  const concern = facts.nss
    ? "Ver el NSS en el papel no confirma alta, vigencia ni semanas cotizadas ante IMSS."
    : retentions.length > 0
      ? "Ver una retención en el recibo no prueba que el patrón la haya enterado al SAT, IMSS o Infonavit."
      : null;

  return {
    nextStep,
    explanation,
    concern,
    source: "deterministic",
    provider: "none",
    liveOfficialValidation: false,
  };
}

function parseNarrativeJson(raw: string) {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return asRecord(JSON.parse(raw.slice(start, end + 1)));
  } catch {
    return null;
  }
}

function acceptAiNarrative(record: Record<string, unknown> | null): Omit<
  LaborFiscalNarrative,
  "source" | "provider" | "liveOfficialValidation"
> | null {
  if (!record) return null;
  const nextStep = sanitizeLaborFiscalNarrativeText(asText(record.nextStep));
  const explanation = sanitizeLaborFiscalNarrativeText(asText(record.explanation));
  const concern = sanitizeLaborFiscalNarrativeText(asText(record.concern));
  if (!nextStep || !explanation) return null;
  if (nextStep.length < 12 || explanation.length < 20) return null;
  return {
    nextStep: clipText(nextStep, NEXT_STEP_MAX_CHARS),
    explanation: clipText(explanation, EXPLANATION_MAX_CHARS),
    concern: concern ? clipText(concern, CONCERN_MAX_CHARS) : null,
  };
}

function buildFactsPrompt(facts: LaborFiscalStructuredFacts, documentType?: string | null) {
  const visible = Object.entries(facts)
    .filter(([, value]) => Boolean(value))
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");

  return [
    `Tipo de documento: ${documentType === "cfdi" ? "CFDI de nómina" : documentType === "payroll_receipt" ? "recibo de nómina" : documentType ?? "documento laboral"}.`,
    "Hechos extraídos (pueden faltar):",
    visible || "(ningún campo visible)",
    "Escribe el siguiente paso más útil y honesto para la persona trabajadora.",
  ].join("\n");
}

function readOpenAiNarrativeText(payload: unknown): string {
  const mapped = mapResponsesApiToInvokeResult(payload, resolveOpenAiModelChain()[0] ?? "");
  const content = mapped.choices[0]?.message.content;
  return typeof content === "string" ? content : "";
}

async function requestOpenAiNarrative(params: {
  apiKey: string;
  prompt: string;
  fetchImpl: typeof fetch;
  timeoutMs: number;
  env?: NodeJS.ProcessEnv;
}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), params.timeoutMs);
  const models = resolveOpenAiModelChain(params.env ?? process.env);
  try {
    let lastError: Error | null = null;
    for (let index = 0; index < models.length; index += 1) {
      const model = models[index];
      const response = await params.fetchImpl(OPENAI_RESPONSES_URL, {
        method: "POST",
        headers: {
          authorization: `Bearer ${params.apiKey}`,
          "content-type": "application/json",
        },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          store: false,
          reasoning: { effort: OPENAI_REASONING_EFFORT },
          instructions: NARRATIVE_SYSTEM_PROMPT,
          input: params.prompt,
          max_output_tokens: LABOR_FISCAL_NARRATIVE_MAX_TOKENS,
          text: { format: { type: "json_object" } },
        }),
      });
      if (response.ok) {
        const payload = await response.json();
        return acceptAiNarrative(parseNarrativeJson(readOpenAiNarrativeText(payload)));
      }
      const errorText = await response.text();
      lastError = new Error(`openai_narrative_${response.status}`);
      const canFallback =
        index < models.length - 1 && isOpenAiModelUnavailableError(response.status, errorText);
      if (!canFallback) {
        throw lastError;
      }
    }
    throw lastError ?? new Error("openai_narrative_unavailable");
  } finally {
    clearTimeout(timer);
  }
}

async function requestGeminiNarrative(params: {
  apiKey: string;
  prompt: string;
  fetchImpl: typeof fetch;
  timeoutMs: number;
  env?: NodeJS.ProcessEnv;
}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), params.timeoutMs);
  const models = resolveGeminiModelChain(params.env ?? process.env);
  try {
    let lastError: Error | null = null;
    for (let index = 0; index < models.length; index += 1) {
      const response = await params.fetchImpl(
        geminiGenerateContentUrl(models[index], params.apiKey),
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: NARRATIVE_SYSTEM_PROMPT }] },
            contents: [{ role: "user", parts: [{ text: params.prompt }] }],
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: LABOR_FISCAL_NARRATIVE_MAX_TOKENS,
              responseMimeType: "application/json",
            },
          }),
        },
      );
      if (response.ok) {
        const payload = (await response.json()) as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        };
        const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("\n") ?? "";
        return acceptAiNarrative(parseNarrativeJson(text));
      }
      const errorText = await response.text();
      lastError = new Error(`gemini_narrative_${response.status}`);
      const canFallback =
        index < models.length - 1 && isOpenAiModelUnavailableError(response.status, errorText);
      if (!canFallback) {
        throw lastError;
      }
    }
    throw lastError ?? new Error("gemini_narrative_unavailable");
  } finally {
    clearTimeout(timer);
  }
}

function remoteNarrativeFromOpinion(opinion: unknown): LaborFiscalNarrative | null {
  const record = asRecord(opinion);
  if (!record || !isPreferredRemoteWorkerOpinion(record)) return null;
  const resultCard = asRecord(record.resultCard);
  const nextStep =
    sanitizeLaborFiscalNarrativeText(asText(record.recommendedNextStep)) ??
    sanitizeLaborFiscalNarrativeText(asText(resultCard?.nextStepSummary));
  const explanation =
    sanitizeLaborFiscalNarrativeText(asText(record.legalOpinion)) ??
    sanitizeLaborFiscalNarrativeText(asText(record.summary));
  if (!nextStep || !explanation) return null;
  return {
    nextStep: clipText(nextStep, NEXT_STEP_MAX_CHARS),
    explanation: clipText(explanation, EXPLANATION_MAX_CHARS),
    concern: null,
    source: "remote",
    provider: "remote",
    liveOfficialValidation: false,
  };
}

export function readStoredLaborFiscalNarrative(opinion?: unknown): LaborFiscalNarrative | null {
  const record = asRecord(opinion);
  const rawPayload = asRecord(record?.rawPayload);
  const stored = asRecord(rawPayload?.localNarrative);
  if (!stored) return null;
  const nextStep = sanitizeLaborFiscalNarrativeText(asText(stored.nextStep));
  const explanation = sanitizeLaborFiscalNarrativeText(asText(stored.explanation));
  if (!nextStep || !explanation) return null;
  const source = asText(stored.source);
  const provider = asText(stored.provider);
  return {
    nextStep,
    explanation,
    concern: sanitizeLaborFiscalNarrativeText(asText(stored.concern)),
    source: source === "ai" || source === "remote" || source === "deterministic" ? source : "deterministic",
    provider:
      provider === "openai" || provider === "gemini" || provider === "remote" || provider === "none"
        ? provider
        : "none",
    liveOfficialValidation: false,
  };
}

export async function resolveLaborFiscalNarrative(
  params: ResolveLaborFiscalNarrativeParams,
): Promise<LaborFiscalNarrative> {
  const facts =
    params.facts ??
    extractStructuredLaborFiscalFacts(params.document ?? { documentType: params.documentType });
  const fallback = buildDeterministicLaborFiscalNarrative(facts, params.documentType);
  const remote = remoteNarrativeFromOpinion(params.preferredOpinion);
  if (remote) return remote;

  const env = params.env ?? process.env;
  if (
    !shouldAttemptLocalNarrativeAi({
      env,
      preferredOpinion: params.preferredOpinion,
      allowInTests: params.allowInTests,
    })
  ) {
    return fallback;
  }

  const provider = pickLaborFiscalNarrativeProvider(env);
  if (!provider) return fallback;

  try {
    const fetchImpl = params.fetchImpl ?? fetch;
    const timeoutMs = params.timeoutMs ?? LABOR_FISCAL_NARRATIVE_TIMEOUT_MS;
    const prompt = buildFactsPrompt(facts, params.documentType);
    const accepted =
      provider === "openai"
        ? await requestOpenAiNarrative({
            apiKey: env.OPENAI_API_KEY!.trim(),
            prompt,
            fetchImpl,
            timeoutMs,
            env,
          })
        : await requestGeminiNarrative({
            apiKey: env.GEMINI_API_KEY!.trim(),
            prompt,
            fetchImpl,
            timeoutMs,
            env,
          });
    if (!accepted) return fallback;
    return {
      ...accepted,
      source: "ai",
      provider,
      liveOfficialValidation: false,
    };
  } catch {
    return fallback;
  }
}

export function applyLaborFiscalNarrativeToOpinion<T extends NarrativeCapableOpinion>(
  opinion: T,
  narrative: LaborFiscalNarrative,
): T {
  if (isPreferredRemoteWorkerOpinion(opinion) && narrative.source !== "remote") {
    return opinion;
  }

  const nextStepSummary = narrative.concern
    ? `${narrative.nextStep} ${narrative.concern}`
    : narrative.nextStep;
  const simpleExplanation = (opinion.resultCard?.simpleExplanation ?? []).map((item) =>
    item.label.toLowerCase().includes("más claridad") || item.label.toLowerCase().includes("siguiente")
      ? { ...item, summary: narrative.nextStep, tone: item.tone ?? "neutral" }
      : item,
  );

  return {
    ...opinion,
    recommendedNextStep: narrative.nextStep,
    resultCard: opinion.resultCard
      ? {
          ...opinion.resultCard,
          nextStepSummary,
          simpleExplanation,
        }
      : opinion.resultCard,
    legalHighlights: opinion.legalHighlights
      ? {
          ...opinion.legalHighlights,
          nextActionLabel: narrative.nextStep,
        }
      : opinion.legalHighlights,
    rawPayload: {
      ...(opinion.rawPayload ?? {}),
      localNarrative: {
        source: narrative.source,
        provider: narrative.provider,
        nextStep: narrative.nextStep,
        explanation: narrative.explanation,
        concern: narrative.concern,
        liveOfficialValidation: false,
      },
    },
  };
}

export function prependNarrativeExplanations(
  explanations: Array<{ label: string; summary: string }>,
  narrative?: LaborFiscalNarrative | null,
) {
  if (!narrative || narrative.source === "deterministic") return explanations;
  const extra = [
    { label: "Siguiente paso", summary: narrative.nextStep },
    { label: "Qué conviene revisar", summary: narrative.explanation },
  ].filter((item) => !explanations.some((existing) => existing.summary === item.summary));
  const limit = explanations.find((item) => item.label === "Límite de esta lectura");
  const rest = explanations.filter((item) => item.label !== "Límite de esta lectura");
  return [...extra, ...rest, ...(limit ? [limit] : [])];
}

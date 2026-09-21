/**
 * Helpers de chat para la persona trabajadora.
 * Español plano, «Asesor laboral», secciones fijas y sin jerga interna.
 */

import {
  OFFICIAL_SOURCES_HEADING,
  maskOfficialDigestSpans,
  shouldAttachOfficialDigest,
  shortenOfficialTitle,
  shortenOfficialTitlesInText,
  stripOfficialTitlesFromText,
  type OfficialDigestCitation,
} from "./officialDigest";

const EMPTY_QUOTES = /["“”‘’`]{2,}/g;
const EXTRA_SPACE = /\s{2,}/g;

export const WORKER_CHAT_TITLE = "Asesor laboral";
export const WORKER_CHAT_ASK_CTA = "Preguntar al asesor";

export const WORKER_CHAT_CLEAR_HEADING = "Respuesta clara";
export const WORKER_CHAT_KNOWN_HEADING = "Lo que sí se sabe";
export const WORKER_CHAT_MISSING_HEADING = "Lo que falta";
export const WORKER_CHAT_NEXT_HEADING = "Siguiente paso";
export const WORKER_CHAT_SOURCES_HEADING = OFFICIAL_SOURCES_HEADING;
export const WORKER_CHAT_WHAT_NOW_HEADING = WORKER_CHAT_NEXT_HEADING;

export const WORKER_CHAT_DISCLAIMER =
  "Esto no es asesoría legal. No soy abogado. Te hablo con el resultado de TU consulta IMSS, SAT o Infonavit y con tu recibo. No inventamos que tu patrón cumple.";

export const WORKER_CHAT_MULTI_DOC_UPSELL =
  "La lectura de varios documentos juntos está en el plan Esencial. Con tu plan gratis puedes preguntar sobre este documento.";

export const WORKER_CHAT_RETRY_ERROR = "No pude completar esa respuesta. Intenta de nuevo.";
export const WORKER_CHAT_HISTORY_MAX_MESSAGES = 6;
export const WORKER_CHAT_HISTORY_MAX_CONTENT_CHARS = 1800;

const PIPE_CONTROL_MARKER_RE = /\|\|\s*[A-Za-z][A-Za-z0-9_]*\s*=\s*[^|\s]*/g;
const BARE_PLAN_MARKER_RE =
  /(?:^|[\s,;])(?:required_plan|current_plan|requiredPlan|currentPlan|required_plan_key|current_plan_key)\s*=\s*[A-Za-z0-9_-]+/gi;

export function stripInternalControlMarkers(value: string): string {
  let next = value.replace(PIPE_CONTROL_MARKER_RE, "");
  next = next.replace(BARE_PLAN_MARKER_RE, (match) => (/^\s/.test(match) ? " " : ""));
  next = next.replace(/\|\|/g, " ");
  return collapseCopy(next);
}

export function hasInternalControlMarkers(value?: string | null): boolean {
  if (!value) return false;
  return (
    /\|\|\s*[A-Za-z][A-Za-z0-9_]*\s*=/.test(value) ||
    /(?:required_plan|current_plan|requiredPlan|currentPlan)\s*=/.test(value)
  );
}

export const WORKER_CHAT_SHEET_COPY = {
  eyebrow: "Tu expediente, en palabras simples",
  title: WORKER_CHAT_TITLE,
  description:
    "Soy tu asesor laboral de este caso. Te hablo con el resultado de TU consulta y con tu recibo. Si aún no hay resultado, te lo digo.",
  documentBadge: "Resultado de TU consulta",
  capabilityBadge: "Solo este expediente",
  officialSourcesHeading: WORKER_CHAT_SOURCES_HEADING,
  quickHighlights: [
    WORKER_CHAT_CLEAR_HEADING,
    WORKER_CHAT_KNOWN_HEADING,
    WORKER_CHAT_MISSING_HEADING,
    WORKER_CHAT_NEXT_HEADING,
  ],
  promptsHeading: "Empieza por aquí",
  historyHeading: "Lo que ya platicamos",
  supportingHeading: "Lo que ya se ve en tus papeles",
  toneHeading: "Cómo quieres la respuesta",
  toneBriefLabel: "Corta",
  toneExplainedLabel: "Un poco más",
  toneBriefHint: "Va al punto, en pocas líneas.",
  toneExplainedHint: "Explica un poco más, todavía en palabras simples.",
  placeholder: "Pregúntame de ESTE expediente. Ejemplo: ¿en mi recibo me descontaron IMSS?",
  emptyStateMessage:
    "Pregúntame del resultado de TU consulta y de tu recibo. Si aún no hay resultado, pulsa Consultar IMSS y SAT.",
  closeLabel: "Cerrar",
} as const;

export const WORKER_ADVISOR_VOICE_NOTE = [
  "Habla solo con el resultado de TU consulta y el recibo de ESTE expediente.",
  "Si no hay resultado de TU consulta, una frase y el botón Consultar. Nada de consejos genéricos.",
  "Nunca inventes cumple, alta vigente ni salario oficial si no vienen en los hechos de la consulta.",
  "Español sencillo y claro. Sin tecnicismos, sin citar autores ni doctrina por citar.",
  "Nunca te presentes como Helios ni uses jerga de ingeniería.",
  "No sustituyes a un abogado de su confianza; sí los acompañas a entender su caso.",
].join(" ");

export type WorkerChatDocumentType =
  | "payroll_receipt"
  | "cfdi"
  | "contract"
  | "imss"
  | "evidence"
  | "other"
  | (string & {});

export type WorkerChatStarterContext = {
  documentType?: string | null;
  documentsCount?: number;
  hasImssSignal?: boolean;
  hasFiscalSignal?: boolean;
  hasInfonavitSignal?: boolean;
  missingDocumentLabel?: string | null;
  recommendedNextStep?: string | null;
  resultCardQuestions?: string[] | null;
  hasOfficialConsulta?: boolean;
  officialStarters?: string[] | null;
};

export type WorkerChatAnswerSections = {
  clearAnswer: string;
  known: string | null;
  missing: string | null;
  nextStep: string | null;
  officialSources: string | null;
};

export type WorkerChatDisplayBlock = {
  heading: string | null;
  body: string;
  kind: "section" | "disclaimer" | "plain";
};

function collapseCopy(value: string) {
  return value.replace(EMPTY_QUOTES, "").replace(EXTRA_SPACE, " ").trim();
}

function asText(value?: string | null) {
  if (typeof value !== "string") return null;
  const next = value.replace(/\s+/g, " ").trim();
  return next.length > 0 ? next : null;
}

export function hasForbiddenWorkerBrand(value?: string | null): boolean {
  if (!value) return false;
  return /CompliLink|complilink|\bHelios\b|\bhelios\b|\bManus\b|\bForge\b|APIMarket|\bForensic\b/.test(
    value,
  );
}

export function hasInventedLegalCitation(value?: string | null): boolean {
  if (!value) return false;
  const { masked } = maskOfficialDigestSpans(value);
  return (
    /\btesis\b/i.test(masked) ||
    /registro digital/i.test(masked) ||
    /semanario judicial/i.test(masked) ||
    /\bIUS\s*\d+/i.test(masked) ||
    /jurisprudencia\s+\d+/i.test(masked)
  );
}

export function hasForbiddenLiveValidationClaim(value?: string | null): boolean {
  if (!value) return false;
  const deniesCumple = /no (?:inventamos|significa) que tu patr[oó]n (?:cumple|est[eé] al corriente)/i.test(
    value,
  );
  return (
    /validaci[oó]n en vivo/i.test(value) ||
    /ya (?:validamos|verificamos) (?:ante |en )?(?:el )?(?:IMSS|SAT|Infonavit)/i.test(value) ||
    /confirmamos (?:tu |el )?alta/i.test(value) ||
    /(?:confirmamos|validamos|verificamos|confirma(?:mos)? que|s[ií][,.]?\s+que)\s+(?:est[aá]s? )?(?:oficialmente )?(?:bien )?dado de alta/i.test(
      value,
    ) ||
    (/\btu patr[oó]n cumple\b/i.test(value) && !deniesCumple)
  );
}

export function hasForbiddenWorkerChatClaim(value?: string | null): boolean {
  return (
    hasForbiddenWorkerBrand(value) ||
    hasInventedLegalCitation(value) ||
    hasForbiddenLiveValidationClaim(value) ||
    hasInternalControlMarkers(value)
  );
}

export function stripInventedLegalCitations(value: string): string {
  const { masked, restore } = maskOfficialDigestSpans(value);
  let next = masked;
  next = next.replace(
    /\b(?:tesis|jurisprudencia)\s+(?:p\.|1a\.|2a\.|pc\.)?\/?j\.?\s*\d+(?:\s*\/\s*\d+)?(?:\s*\([^)]+\))?/gi,
    "la lectura de tus documentos",
  );
  next = next.replace(/\btesis\s+[^\n.,;]{0,80}/gi, "la lectura de tus documentos");
  next = next.replace(/registro digital(?:\s*no\.?)?\s*\d+/gi, "tus papeles");
  next = next.replace(/semanario judicial(?: de la federaci[oó]n)?/gi, "tus documentos");
  next = next.replace(/\bIUS\s*\d+/gi, "tus documentos");
  next = next.replace(/jurisprudencia\s+\d+(?:\s*\/\s*\d+)?/gi, "la lectura de tus documentos");
  return restore(next);
}

export function stripLiveValidationClaims(value: string): string {
  let next = value;
  next = next.replace(/validaci[oó]n en vivo/gi, "lectura de tus documentos");
  next = next.replace(
    /ya (?:validamos|verificamos) (?:ante |en )?(?:el )?(IMSS|SAT|Infonavit)/gi,
    "la consulta de $1 de este caso, si ya existe, es lo único que puedo citar",
  );
  next = next.replace(
    /confirmamos (?:tu |el )?alta(?: ante el IMSS)?/gi,
    "en tus papeles se ve una señal de IMSS, pero eso no confirma el alta oficial",
  );
  next = next.replace(
    /(?:confirmamos|validamos|verificamos|confirma(?:mos)? que|s[ií][,.]?\s+que)\s+(?:est[aá]s? )?(?:oficialmente )?(?:bien )?dado de alta(?: en el IMSS)?/gi,
    "en tus papeles se ve una señal de IMSS, pero eso no confirma el alta oficial",
  );
  next = next.replace(
    /(?:^|[.]\s+)est[aá]s? (?:oficialmente )?(?:bien )?dado de alta(?: en el IMSS)?/gim,
    "En tus papeles se ve una señal de IMSS, pero eso no confirma el alta oficial",
  );
  return next;
}

export function sanitizeWorkerChatCopy(value?: string | null): string | null {
  if (value == null) return value ?? null;
  if (!value) return value;

  let next = stripInternalControlMarkers(value);
  next = next.replace(/CompliLink Operativo/gi, "AuditaPatrón");
  next = next.replace(/CompliLink/gi, "AuditaPatrón");
  next = next.replace(/Modo Helios/gi, "Asesor laboral");
  next = next.replace(/Preguntar a Helios/gi, WORKER_CHAT_ASK_CTA);
  next = next.replace(/copiloto Helios/gi, "asesor laboral");
  next = next.replace(/Copiloto Helios/gi, "Asesor laboral");
  next = next.replace(/\bHelios ya\b/g, "Ya");
  next = next.replace(/\bHelios\b/g, "esta lectura");
  next = next.replace(/\bhelios\b/gi, "esta lectura");
  next = next.replace(/\bManus\b/g, "tu acceso");
  next = next.replace(/\bForge\b/g, "la plataforma");
  next = next.replace(/APIMarket/gi, "el servicio de consulta");
  next = next.replace(/\bForensic\b/gi, "revisión documental");
  next = stripInventedLegalCitations(next);
  next = stripLiveValidationClaims(next);
  next = collapseCopy(next);
  return next;
}

function payrollDiscountQuestion(context: WorkerChatStarterContext): string {
  const hasImss = Boolean(context.hasImssSignal);
  const hasFiscal = Boolean(context.hasFiscalSignal);
  const hasInfonavit = Boolean(context.hasInfonavitSignal);
  if ((hasImss || hasFiscal) && hasInfonavit) {
    if (hasImss && hasFiscal) return "¿Me descontaron IMSS, impuestos o Infonavit?";
    if (hasImss) return "¿Me descontaron IMSS o Infonavit?";
    return "¿Me descontaron impuestos o Infonavit?";
  }
  if (hasImss || hasFiscal) return "¿Me descontaron IMSS o impuestos?";
  if (hasInfonavit) return "¿Qué hay de Infonavit?";
  return "¿Qué descuentos se ven?";
}

export function buildWorkerStarterQuestions(context: WorkerChatStarterContext = {}): string[] {
  const official = (context.officialStarters ?? [])
    .map((item) => asText(item))
    .filter((item): item is string => Boolean(item))
    .map((item) => sanitizeWorkerChatCopy(item) ?? item)
    .filter((item) => !hasForbiddenWorkerBrand(item));
  if (official.length > 0) {
    return official.slice(0, 4);
  }
  if (context.hasOfficialConsulta === false) {
    return [];
  }

  const fromCard = (context.resultCardQuestions ?? [])
    .map((item) => asText(item))
    .filter((item): item is string => Boolean(item))
    .map((item) => sanitizeWorkerChatCopy(item) ?? item)
    .filter((item) => !hasForbiddenWorkerBrand(item));

  const documentsCount = context.documentsCount ?? 0;
  const prompts: string[] = [];

  if (documentsCount === 0) {
    prompts.push(
      "¿Qué documento me conviene subir primero?",
      "¿Qué hago ahora?",
      "¿Esto sirve para IMSS o impuestos?",
    );
  } else {
    switch (context.documentType) {
      case "payroll_receipt":
        prompts.push("¿Qué dice mi recibo?");
        prompts.push(payrollDiscountQuestion(context));
        break;
      case "cfdi":
        prompts.push("¿Qué dice mi CFDI?");
        prompts.push("¿Coincide con lo que me pagaron?");
        break;
      case "contract":
        prompts.push("¿Qué dice mi contrato?");
        prompts.push("¿Qué debo comparar con mi recibo?");
        break;
      case "imss":
        prompts.push("¿Qué dice este papel del IMSS?");
        prompts.push("¿Esto confirma que estoy dado de alta?");
        break;
      default:
        prompts.push("¿Qué dice mi documento?");
        if (context.hasImssSignal) prompts.push("¿Me descontaron IMSS?");
        else if (context.hasFiscalSignal) prompts.push("¿Me descontaron impuestos?");
        else prompts.push("¿Qué debo revisar aquí?");
    }

    prompts.push("¿Qué hago ahora?");

    if (context.missingDocumentLabel) {
      prompts.push(`¿Me sirve subir ${context.missingDocumentLabel.toLowerCase()}?`);
    } else if (context.hasImssSignal && context.documentType !== "imss") {
      prompts.push("¿Estoy bien dado de alta?");
    }
  }

  return Array.from(new Set([...fromCard, ...prompts])).slice(0, 4);
}

const CLEAR_HEADING_RE = /(?:^|\n)\s*(?:\d+\)\s*)?Respuesta clara\s*:?\s*/i;
const KNOWN_HEADING_RE = /(?:^|\n)\s*(?:\d+\)\s*)?Lo que s[ií] se sabe\s*:?\s*/i;
const MISSING_HEADING_RE = /(?:^|\n)\s*(?:\d+\)\s*)?Lo que falta(?: confirmar)?\s*:?\s*/i;
const NEXT_HEADING_RE =
  /(?:^|\n)\s*(?:\d+\)\s*)?(?:Siguiente paso(?: [uú]til)?|Qu[eé] hacer ahora)\s*:?\s*/i;
const SOURCES_HEADING_RE = /(?:^|\n)\s*(?:\d+\)\s*)?Lecturas oficiales\s*:?\s*/i;
const DISCLAIMER_HEADING_RE = /(?:^|\n)\s*(?:Esto no es asesor[ií]a legal|\d+\))/i;

function takeSection(content: string, startRe: RegExp, endRes: RegExp[]): string | null {
  const start = content.match(startRe);
  if (!start || start.index == null) return null;
  const after = content.slice(start.index + start[0].length);
  let end = after.length;
  for (const endRe of endRes) {
    const match = after.match(endRe);
    if (match && match.index != null && match.index < end) {
      end = match.index;
    }
  }
  return asText(after.slice(0, end));
}

export function extractWorkerChatSections(content: string): WorkerChatAnswerSections {
  const normalized = content.replace(/\r/g, "").trim();
  if (!normalized) {
    return { clearAnswer: "", known: null, missing: null, nextStep: null, officialSources: null };
  }

  const known = takeSection(normalized, KNOWN_HEADING_RE, [
    MISSING_HEADING_RE,
    NEXT_HEADING_RE,
    SOURCES_HEADING_RE,
    DISCLAIMER_HEADING_RE,
  ]);
  const missing = takeSection(normalized, MISSING_HEADING_RE, [
    NEXT_HEADING_RE,
    SOURCES_HEADING_RE,
    DISCLAIMER_HEADING_RE,
  ]);
  const nextStep = takeSection(normalized, NEXT_HEADING_RE, [
    SOURCES_HEADING_RE,
    DISCLAIMER_HEADING_RE,
  ]);
  const officialSources = takeSection(normalized, SOURCES_HEADING_RE, [DISCLAIMER_HEADING_RE]);
  const clearFromHeading = takeSection(normalized, CLEAR_HEADING_RE, [
    KNOWN_HEADING_RE,
    MISSING_HEADING_RE,
    NEXT_HEADING_RE,
    SOURCES_HEADING_RE,
    DISCLAIMER_HEADING_RE,
  ]);

  if (clearFromHeading) {
    return { clearAnswer: clearFromHeading, known, missing, nextStep, officialSources };
  }

  if (known || missing || nextStep || officialSources) {
    const firstHeading = normalized.search(
      /(?:^|\n)\s*(?:\d+\)\s*)?(?:Lo que s[ií] se sabe|Lo que falta|Siguiente paso|Qu[eé] hacer ahora|Lecturas oficiales)/i,
    );
    const before = asText(normalized.slice(0, firstHeading >= 0 ? firstHeading : normalized.length));
    return { clearAnswer: before ?? normalized, known, missing, nextStep, officialSources };
  }

  return {
    clearAnswer: collapseCopy(normalized),
    known: null,
    missing: null,
    nextStep: null,
    officialSources: null,
  };
}

export function extractWorkerClearAnswer(content: string): string {
  return extractWorkerChatSections(content).clearAnswer;
}

export function extractWorkerWhatToDoNow(content: string): string | null {
  return extractWorkerChatSections(content).nextStep;
}

export function formatWorkerChatAnswer(params: {
  answer: string;
  known?: string | null;
  missing?: string | null;
  nextStep?: string | null;
  officialSources?: string | OfficialDigestCitation[] | null;
  officialSourcesNote?: string | null;
  includeOfficialSources?: boolean;
  prompt?: string | null;
  disclaimer?: string | null;
  multiDocUpsell?: string | boolean | null;
}): string {
  const includeOfficialSources =
    params.includeOfficialSources ??
    (params.prompt != null ? shouldAttachOfficialDigest(params.prompt) : true);
  const rawSections = extractWorkerChatSections(params.answer);
  const sections = includeOfficialSources
    ? rawSections
    : {
        ...rawSections,
        clearAnswer: stripOfficialTitlesFromText(rawSections.clearAnswer),
        known: rawSections.known ? stripOfficialTitlesFromText(rawSections.known) : null,
        missing: rawSections.missing ? stripOfficialTitlesFromText(rawSections.missing) : null,
        nextStep: rawSections.nextStep ? stripOfficialTitlesFromText(rawSections.nextStep) : null,
        officialSources: null,
      };
  const clearAnswer =
    sanitizeWorkerChatCopy(sections.clearAnswer) ??
    "Todavía no hay suficiente para responder con lo que se ve en tus papeles.";
  const known =
    sanitizeWorkerChatCopy(sections.known ?? params.known ?? null) ??
    "En tus papeles se ve lo que ya listamos arriba. Si un dato no aparece, no lo inventamos.";
  const missing =
    sanitizeWorkerChatCopy(sections.missing ?? params.missing ?? null) ??
    "Todavía falta contrastar con más papeles del mismo periodo.";
  const nextStep =
    sanitizeWorkerChatCopy(sections.nextStep ?? params.nextStep ?? null) ??
    "Revisa lo que ya se ve en tus papeles y, si puedes, sube el siguiente documento del mismo periodo.";
  const officialFromParams = includeOfficialSources
    ? Array.isArray(params.officialSources)
      ? params.officialSources
          .slice(0, 3)
          .map((item) => shortenOfficialTitle(item.title))
          .join("\n")
      : params.officialSources
        ? shortenOfficialTitlesInText(params.officialSources)
        : null
    : null;
  const officialSources = includeOfficialSources
    ? sanitizeWorkerChatCopy(
        sections.officialSources
          ? shortenOfficialTitlesInText(sections.officialSources)
          : officialFromParams,
      )
    : null;
  const officialNote = includeOfficialSources
    ? sanitizeWorkerChatCopy(params.officialSourcesNote ?? null)
    : null;
  const disclaimer = asText(params.disclaimer) ?? WORKER_CHAT_DISCLAIMER;
  const upsell =
    params.multiDocUpsell === true
      ? WORKER_CHAT_MULTI_DOC_UPSELL
      : asText(typeof params.multiDocUpsell === "string" ? params.multiDocUpsell : null);

  return [
    WORKER_CHAT_CLEAR_HEADING,
    clearAnswer,
    "",
    WORKER_CHAT_KNOWN_HEADING,
    known,
    "",
    WORKER_CHAT_MISSING_HEADING,
    missing,
    "",
    WORKER_CHAT_NEXT_HEADING,
    nextStep,
    ...(officialSources
      ? ["", WORKER_CHAT_SOURCES_HEADING, officialSources, ...(officialNote ? [officialNote] : [])]
      : officialNote
        ? ["", WORKER_CHAT_SOURCES_HEADING, officialNote]
        : []),
    "",
    disclaimer,
    ...(upsell ? ["", upsell] : []),
  ].join("\n");
}

function looksLikeApiValidationJargon(value?: string | null): boolean {
  if (!value) return false;
  return (
    /\btoo_big\b/i.test(value) ||
    /\btoo_small\b/i.test(value) ||
    /\bZodError\b/i.test(value) ||
    /\binvalid_type\b/i.test(value) ||
    /"code"\s*:\s*"/i.test(value) ||
    /String must contain at most/i.test(value) ||
    /Array must contain at most/i.test(value) ||
    /Too big:/i.test(value) ||
    /expected (?:string|array) to have/i.test(value) ||
    /conversationHistory/i.test(value)
  );
}

export function toFriendlyWorkerChatError(raw?: string | null, fallback?: string | null): string {
  const fallbackText = asText(fallback) ?? WORKER_CHAT_RETRY_ERROR;

  if (looksLikeApiValidationJargon(raw)) {
    return WORKER_CHAT_RETRY_ERROR;
  }

  const cleaned = sanitizeWorkerChatCopy(raw) ?? fallbackText;

  if (looksLikeApiValidationJargon(cleaned)) {
    return WORKER_CHAT_RETRY_ERROR;
  }

  const looksLikeUpgradeLeak =
    hasInternalControlMarkers(raw) ||
    /está disponible desde Audita (?:Esencial|Pro)/i.test(raw ?? "");

  if (looksLikeUpgradeLeak && /varios documentos/i.test(raw ?? "")) {
    return formatWorkerChatAnswer({
      answer: WORKER_CHAT_MULTI_DOC_UPSELL,
      known: "Con tu plan gratis el asesor puede leer este documento.",
      missing: "Todavía no puede leer varios documentos juntos.",
      nextStep: "Pregúntame sobre este documento.",
    });
  }

  return cleaned || fallbackText;
}

export function sanitizeVisibleChatHistoryContent(value?: string | null): string {
  if (value == null) return "";
  const raw = value;
  if (!raw.trim()) return "";

  if (looksLikeApiValidationJargon(raw)) {
    return WORKER_CHAT_RETRY_ERROR;
  }

  const looksLikeUpgradeLeak =
    hasInternalControlMarkers(raw) ||
    /está disponible desde Audita (?:Esencial|Pro)/i.test(raw) ||
    /required_plan|current_plan/i.test(raw);

  if (looksLikeUpgradeLeak) {
    return toFriendlyWorkerChatError(raw, raw);
  }

  return raw
    .split(/\r?\n/)
    .map((line) => sanitizeWorkerChatCopy(line) ?? line)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function sanitizeVisibleChatHistoryMessages<
  T extends { role: string; content: string },
>(messages: T[]): T[] {
  return messages.flatMap((message) => {
    const content = sanitizeVisibleChatHistoryContent(message.content);
    if (!content) return [];
    return [{ ...message, content }];
  });
}

export function truncateSpanishSafe(value: string, maxLength: number): string {
  const normalized = value.normalize("NFC").replace(/\u00a0/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  if (maxLength <= 1) return "…";
  const budget = maxLength - 1;
  let slice = normalized.slice(0, budget);
  const breakAt = Math.max(
    slice.lastIndexOf("\n"),
    slice.lastIndexOf(" "),
    slice.lastIndexOf("."),
    slice.lastIndexOf(","),
    slice.lastIndexOf(";"),
    slice.lastIndexOf("?"),
    slice.lastIndexOf("!"),
  );
  if (breakAt >= Math.floor(budget * 0.55)) {
    const atBreak = slice[breakAt];
    slice = slice.slice(0, atBreak === " " || atBreak === "\n" ? breakAt : breakAt + 1);
  }
  return `${slice.trimEnd()}…`;
}

export function capWorkerChatHistoryContent(
  value: string,
  maxLength = WORKER_CHAT_HISTORY_MAX_CONTENT_CHARS,
): string {
  const cleaned = sanitizeVisibleChatHistoryContent(value);
  if (!cleaned) return "";
  const withShortTitles = shortenOfficialTitlesInText(cleaned);
  if (withShortTitles.length <= maxLength) return withShortTitles;
  return truncateSpanishSafe(withShortTitles, maxLength);
}

export type WorkerChatHistoryTurn = {
  role: "user" | "assistant";
  content: string;
};

export function capWorkerChatConversationHistory(
  history: unknown,
  options?: { maxMessages?: number; maxContentChars?: number },
): WorkerChatHistoryTurn[] {
  if (!Array.isArray(history)) return [];
  const maxMessages = Math.max(1, options?.maxMessages ?? WORKER_CHAT_HISTORY_MAX_MESSAGES);
  const maxContentChars = options?.maxContentChars ?? WORKER_CHAT_HISTORY_MAX_CONTENT_CHARS;

  return history
    .flatMap((item): WorkerChatHistoryTurn[] => {
      if (!item || typeof item !== "object") return [];
      const role = (item as { role?: unknown }).role;
      const content = (item as { content?: unknown }).content;
      if ((role !== "user" && role !== "assistant") || typeof content !== "string") {
        return [];
      }
      const capped = capWorkerChatHistoryContent(content, maxContentChars);
      if (!capped) return [];
      return [{ role, content: capped }];
    })
    .slice(-maxMessages);
}

export function ensureWorkerChatDisclaimer(
  content: string,
  disclaimer = WORKER_CHAT_DISCLAIMER,
): string {
  const normalized = content.replace(/\s+/g, " ").trim();
  if (/esto no es asesor[ií]a legal/i.test(normalized)) {
    return content.trim();
  }
  return `${content.trim()}\n\n${disclaimer}`;
}

export function parseWorkerStructuredAnswer(content: string): WorkerChatDisplayBlock[] {
  const normalized = content.replace(/\r/g, "").trim();
  if (!normalized) return [];

  const sections = extractWorkerChatSections(normalized);
  const hasStructuredHeadings =
    CLEAR_HEADING_RE.test(normalized) ||
    KNOWN_HEADING_RE.test(normalized) ||
    MISSING_HEADING_RE.test(normalized) ||
    NEXT_HEADING_RE.test(normalized) ||
    SOURCES_HEADING_RE.test(normalized);

  if (!hasStructuredHeadings) {
    const disclaimerMatch = normalized.match(/\n\s*(Esto no es asesor[ií]a legal[\s\S]*)$/i);
    if (disclaimerMatch && disclaimerMatch.index != null) {
      const body = asText(normalized.slice(0, disclaimerMatch.index));
      return [
        ...(body ? [{ heading: null, body, kind: "plain" as const }] : []),
        { heading: null, body: disclaimerMatch[1].trim(), kind: "disclaimer" },
      ];
    }
    return [{ heading: null, body: normalized, kind: "plain" }];
  }

  const blocks: WorkerChatDisplayBlock[] = [];
  if (sections.clearAnswer) {
    blocks.push({
      heading: WORKER_CHAT_CLEAR_HEADING,
      body: sections.clearAnswer,
      kind: "section",
    });
  }
  if (sections.known) {
    blocks.push({
      heading: WORKER_CHAT_KNOWN_HEADING,
      body: sections.known,
      kind: "section",
    });
  }
  if (sections.missing) {
    blocks.push({
      heading: WORKER_CHAT_MISSING_HEADING,
      body: sections.missing,
      kind: "section",
    });
  }
  if (sections.nextStep) {
    blocks.push({
      heading: WORKER_CHAT_NEXT_HEADING,
      body: sections.nextStep,
      kind: "section",
    });
  }
  if (sections.officialSources) {
    blocks.push({
      heading: WORKER_CHAT_SOURCES_HEADING,
      body: sections.officialSources,
      kind: "section",
    });
  }

  const disclaimerMatch = normalized.match(/(Esto no es asesor[ií]a legal[\s\S]*)$/i);
  if (disclaimerMatch) {
    blocks.push({
      heading: null,
      body: disclaimerMatch[1].trim(),
      kind: "disclaimer",
    });
  }

  return blocks.length > 0
    ? blocks
    : [{ heading: null, body: normalized, kind: "plain" }];
}

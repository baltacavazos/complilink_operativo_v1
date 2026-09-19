/**
 * Helpers de chat para la persona trabajadora.
 * Español plano, respuestas cortas, «qué hacer ahora» y sin jerga interna.
 */

const EMPTY_QUOTES = /["“”‘’`]{2,}/g;
const EXTRA_SPACE = /\s{2,}/g;

export const WORKER_CHAT_CLEAR_HEADING = "Respuesta clara";
export const WORKER_CHAT_WHAT_NOW_HEADING = "Qué hacer ahora";

export const WORKER_CHAT_DISCLAIMER =
  "Esto no es asesoría legal. Solo lee lo que ya aparece en tus documentos. No consulta IMSS, SAT ni Infonavit en vivo.";

export const WORKER_CHAT_SHEET_COPY = {
  eyebrow: "Preguntas sobre tu documento",
  title: "Pregúntame en palabras simples",
  description:
    "Elige una pregunta o escribe la tuya. Te respondo corto, con lo que ya se ve en tus papeles y qué puedes hacer ahora.",
  documentBadge: "Solo lee tus papeles",
  capabilityBadge: "No es un abogado",
  quickHighlights: [
    "Respuestas cortas",
    "Qué hacer ahora",
    "Sin palabras raras",
  ],
  promptsHeading: "Empieza por aquí",
  historyHeading: "Lo que ya platicamos",
  supportingHeading: "Lo que ya se ve en tus papeles",
  toneHeading: "Cómo quieres la respuesta",
  toneBriefLabel: "Corta",
  toneExplainedLabel: "Un poco más",
  toneBriefHint: "Va al punto, en pocas líneas.",
  toneExplainedHint: "Explica un poco más, todavía en palabras simples.",
  placeholder: "Escribe tu duda. Ejemplo: ¿me descontaron IMSS?",
  emptyStateMessage:
    "Elige una pregunta de arriba o escribe la tuya. Te digo lo que sí se ve en tus papeles y qué hacer ahora.",
  closeLabel: "Cerrar",
} as const;

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
  return (
    /\btesis\b/i.test(value) ||
    /registro digital/i.test(value) ||
    /semanario judicial/i.test(value) ||
    /\bIUS\s*\d+/i.test(value) ||
    /jurisprudencia\s+\d+/i.test(value)
  );
}

export function hasForbiddenLiveValidationClaim(value?: string | null): boolean {
  if (!value) return false;
  return (
    /consulta(?:r|mos|do)? en vivo/i.test(value) ||
    /validaci[oó]n en vivo/i.test(value) ||
    /ya (?:consultamos|validamos|verificamos) (?:ante |en )?(?:el )?(?:IMSS|SAT|Infonavit)/i.test(
      value,
    ) ||
    /confirmamos (?:tu |el )?alta/i.test(value) ||
    /(?:confirmamos|validamos|verificamos|confirma(?:mos)? que|s[ií][,.]?\s+que)\s+(?:est[aá]s? )?(?:oficialmente )?(?:bien )?dado de alta/i.test(
      value,
    )
  );
}

export function hasForbiddenWorkerChatClaim(value?: string | null): boolean {
  return (
    hasForbiddenWorkerBrand(value) ||
    hasInventedLegalCitation(value) ||
    hasForbiddenLiveValidationClaim(value)
  );
}

export function stripInventedLegalCitations(value: string): string {
  let next = value;
  next = next.replace(
    /\b(?:tesis|jurisprudencia)\s+(?:p\.|1a\.|2a\.|pc\.)?\/?j\.?\s*\d+(?:\s*\/\s*\d+)?(?:\s*\([^)]+\))?/gi,
    "la lectura de tus documentos",
  );
  next = next.replace(/\btesis\s+[^\n.,;]{0,80}/gi, "la lectura de tus documentos");
  next = next.replace(/registro digital(?:\s*no\.?)?\s*\d+/gi, "tus papeles");
  next = next.replace(/semanario judicial(?: de la federaci[oó]n)?/gi, "tus documentos");
  next = next.replace(/\bIUS\s*\d+/gi, "tus documentos");
  next = next.replace(/jurisprudencia\s+\d+(?:\s*\/\s*\d+)?/gi, "la lectura de tus documentos");
  return next;
}

export function stripLiveValidationClaims(value: string): string {
  let next = value;
  next = next.replace(/consulta(?:r|mos|do)? en vivo/gi, "leer tus documentos");
  next = next.replace(/validaci[oó]n en vivo/gi, "lectura de tus documentos");
  next = next.replace(
    /ya (?:consultamos|validamos|verificamos) (?:ante |en )?(?:el )?(IMSS|SAT|Infonavit)/gi,
    "en tus papeles se ve una señal de $1, pero no es una consulta oficial",
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

  let next = value;
  next = next.replace(/CompliLink Operativo/gi, "AuditaPatrón");
  next = next.replace(/CompliLink/gi, "AuditaPatrón");
  next = next.replace(/Preguntar a Helios/gi, "Preguntar sobre tu documento");
  next = next.replace(/copiloto Helios/gi, "esta lectura");
  next = next.replace(/Copiloto Helios/gi, "Esta lectura");
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

export function buildWorkerStarterQuestions(context: WorkerChatStarterContext = {}): string[] {
  const documentsCount = context.documentsCount ?? 0;
  const prompts: string[] = [];

  if (documentsCount === 0) {
    return [
      "¿Qué documento me conviene subir primero?",
      "¿Qué hago ahora?",
      "¿Esto sirve para IMSS o impuestos?",
    ];
  }

  switch (context.documentType) {
    case "payroll_receipt":
      prompts.push("¿Qué dice mi recibo?");
      prompts.push(
        context.hasImssSignal || context.hasFiscalSignal
          ? "¿Me descontaron IMSS o impuestos?"
          : "¿Qué descuentos se ven?",
      );
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

  return Array.from(new Set(prompts)).slice(0, 4);
}

export function extractWorkerChatSections(content: string): {
  clearAnswer: string;
  whatToDoNow: string | null;
} {
  const normalized = content.replace(/\r/g, "").trim();
  if (!normalized) {
    return { clearAnswer: "", whatToDoNow: null };
  }

  const whatNowMatch = normalized.match(
    /(?:^|\n)\s*(?:\d+\)\s*)?(?:Qu[eé] hacer ahora|Siguiente paso [uú]til)\s*:?\s*([\s\S]*?)(?:\n\s*(?:Esto no es asesor[ií]a legal|\d+\))|$)/i,
  );
  const clearMatch = normalized.match(
    /(?:^|\n)\s*(?:\d+\)\s*)?Respuesta clara\s*:?\s*([\s\S]*?)(?:\n\s*(?:\d+\)\s*)?(?:Qu[eé] hacer ahora|Siguiente paso [uú]til|Lo que s[ií] se sabe)|$)/i,
  );

  const whatToDoNow = asText(whatNowMatch?.[1] ?? null);
  const clearFromHeading = asText(clearMatch?.[1] ?? null);

  if (clearFromHeading) {
    return { clearAnswer: clearFromHeading, whatToDoNow };
  }

  if (whatToDoNow) {
    const before = asText(normalized.slice(0, whatNowMatch?.index ?? normalized.length));
    return { clearAnswer: before ?? normalized, whatToDoNow };
  }

  return { clearAnswer: collapseCopy(normalized), whatToDoNow: null };
}

export function extractWorkerClearAnswer(content: string): string {
  return extractWorkerChatSections(content).clearAnswer;
}

export function extractWorkerWhatToDoNow(content: string): string | null {
  return extractWorkerChatSections(content).whatToDoNow;
}

export function formatWorkerChatAnswer(params: {
  answer: string;
  nextStep?: string | null;
  disclaimer?: string | null;
}): string {
  const sections = extractWorkerChatSections(params.answer);
  const clearAnswer =
    sanitizeWorkerChatCopy(sections.clearAnswer) ??
    "Todavía no hay suficiente para responder con lo que se ve en tus papeles.";
  const nextStep =
    sanitizeWorkerChatCopy(sections.whatToDoNow ?? params.nextStep ?? null) ??
    "Revisa lo que ya se ve en tus papeles y, si puedes, sube el siguiente documento del mismo periodo.";
  const disclaimer = asText(params.disclaimer) ?? WORKER_CHAT_DISCLAIMER;

  return [
    `${WORKER_CHAT_CLEAR_HEADING}`,
    clearAnswer,
    "",
    WORKER_CHAT_WHAT_NOW_HEADING,
    nextStep,
    "",
    disclaimer,
  ].join("\n");
}

export function ensureWorkerChatDisclaimer(content: string, disclaimer = WORKER_CHAT_DISCLAIMER): string {
  const normalized = content.replace(/\s+/g, " ").trim();
  if (/esto no es asesor[ií]a legal/i.test(normalized)) {
    return content.trim();
  }
  return `${content.trim()}\n\n${disclaimer}`;
}

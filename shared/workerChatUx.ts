/**
 * Helpers de chat para la persona trabajadora.
 * Español plano, «Asesor laboral», secciones fijas y sin jerga interna.
 */

const EMPTY_QUOTES = /["“”‘’`]{2,}/g;
const EXTRA_SPACE = /\s{2,}/g;

export const WORKER_CHAT_TITLE = "Asesor laboral";
export const WORKER_CHAT_ASK_CTA = "Preguntar al asesor";

export const WORKER_CHAT_CLEAR_HEADING = "Respuesta clara";
export const WORKER_CHAT_KNOWN_HEADING = "Lo que sí se sabe";
export const WORKER_CHAT_MISSING_HEADING = "Lo que falta";
export const WORKER_CHAT_NEXT_HEADING = "Siguiente paso";
export const WORKER_CHAT_WHAT_NOW_HEADING = WORKER_CHAT_NEXT_HEADING;

export const WORKER_CHAT_DISCLAIMER =
  "Esto no es asesoría legal. No soy abogado. Solo leo lo que ya aparece en tus documentos. No consulta IMSS, SAT ni Infonavit en vivo.";

export const WORKER_CHAT_MULTI_DOC_UPSELL =
  "La lectura de varios documentos juntos está en el plan Esencial. Con tu plan gratis puedes preguntar sobre este documento.";

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
  eyebrow: WORKER_CHAT_TITLE,
  title: WORKER_CHAT_TITLE,
  description:
    "Pregúntame en palabras simples. Te digo lo que sí se ve, lo que falta y el siguiente paso.",
  documentBadge: "Solo lee tus papeles",
  capabilityBadge: "No es un abogado",
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
  placeholder: "Escribe tu duda. Ejemplo: ¿me descontaron IMSS?",
  emptyStateMessage:
    "Elige una pregunta de arriba o escribe la tuya. Te digo lo que sí se ve, lo que falta y el siguiente paso.",
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
  resultCardQuestions?: string[] | null;
};

export type WorkerChatAnswerSections = {
  clearAnswer: string;
  known: string | null;
  missing: string | null;
  nextStep: string | null;
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
    hasForbiddenLiveValidationClaim(value) ||
    hasInternalControlMarkers(value)
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
    return { clearAnswer: "", known: null, missing: null, nextStep: null };
  }

  const known = takeSection(normalized, KNOWN_HEADING_RE, [
    MISSING_HEADING_RE,
    NEXT_HEADING_RE,
    DISCLAIMER_HEADING_RE,
  ]);
  const missing = takeSection(normalized, MISSING_HEADING_RE, [
    NEXT_HEADING_RE,
    DISCLAIMER_HEADING_RE,
  ]);
  const nextStep = takeSection(normalized, NEXT_HEADING_RE, [DISCLAIMER_HEADING_RE]);
  const clearFromHeading = takeSection(normalized, CLEAR_HEADING_RE, [
    KNOWN_HEADING_RE,
    MISSING_HEADING_RE,
    NEXT_HEADING_RE,
    DISCLAIMER_HEADING_RE,
  ]);

  if (clearFromHeading) {
    return { clearAnswer: clearFromHeading, known, missing, nextStep };
  }

  if (known || missing || nextStep) {
    const firstHeading = normalized.search(
      /(?:^|\n)\s*(?:\d+\)\s*)?(?:Lo que s[ií] se sabe|Lo que falta|Siguiente paso|Qu[eé] hacer ahora)/i,
    );
    const before = asText(normalized.slice(0, firstHeading >= 0 ? firstHeading : normalized.length));
    return { clearAnswer: before ?? normalized, known, missing, nextStep };
  }

  return { clearAnswer: collapseCopy(normalized), known: null, missing: null, nextStep: null };
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
  disclaimer?: string | null;
  multiDocUpsell?: string | boolean | null;
}): string {
  const sections = extractWorkerChatSections(params.answer);
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
    "",
    disclaimer,
    ...(upsell ? ["", upsell] : []),
  ].join("\n");
}

export function toFriendlyWorkerChatError(raw?: string | null, fallback?: string | null): string {
  const fallbackText =
    asText(fallback) ??
    "No tengo suficiente claridad para responderte bien en este momento. Si quieres, intenta decirme qué te preocupa o sube otro documento útil y seguimos desde ahí.";
  const cleaned = sanitizeWorkerChatCopy(raw) ?? fallbackText;

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
    NEXT_HEADING_RE.test(normalized);

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

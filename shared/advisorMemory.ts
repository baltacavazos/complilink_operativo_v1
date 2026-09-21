import {
  capWorkerChatConversationHistory,
  sanitizeWorkerChatCopy,
  type WorkerChatHistoryTurn,
} from "./workerChatUx";

export const ADVISOR_MEMORY_MODEL = "gpt-6-astra";
export const ADVISOR_MEMORY_MAX_LIST_ITEMS = 5;
export const ADVISOR_MEMORY_MAX_ITEM_CHARS = 240;
export const ADVISOR_MEMORY_MAX_GREETING_CHARS = 280;
export const ADVISOR_MEMORY_MAX_GREETING_SENTENCES = 4;
export const ADVISOR_MEMORY_MAX_TURNS = 6;

export type AdvisorMemoryScope = {
  tenantId: string;
  caseId: string;
  userId: number;
};

export type AdvisorMemoryRecord = AdvisorMemoryScope & {
  employeeName: string | null;
  employerEntity: string | null;
  caseTitle: string | null;
  greeting: string;
  highlights: string[];
  documentsDiscussed: string[];
  risksFlagged: string[];
  nextSteps: string[];
  recentTurns: WorkerChatHistoryTurn[];
  lastPrompt: string | null;
  lastAnswer: string | null;
  modelUsed: string;
  updatedAt: string;
};

export type AdvisorMemorySummaryDraft = {
  greeting?: string | null;
  highlights?: string[] | null;
  documentsDiscussed?: string[] | null;
  risksFlagged?: string[] | null;
  nextSteps?: string[] | null;
};

export function buildAdvisorMemoryScopeKey(scope: AdvisorMemoryScope): string {
  return `${scope.tenantId}::${scope.caseId}::${scope.userId}`;
}

export function scopesShareAdvisorMemory(
  left: AdvisorMemoryScope,
  right: AdvisorMemoryScope,
): boolean {
  return buildAdvisorMemoryScopeKey(left) === buildAdvisorMemoryScopeKey(right);
}

export function createScopedAdvisorMemoryStore() {
  const store = new Map<string, AdvisorMemoryRecord>();

  return {
    get(scope: AdvisorMemoryScope): AdvisorMemoryRecord | null {
      return store.get(buildAdvisorMemoryScopeKey(scope)) ?? null;
    },
    upsert(record: AdvisorMemoryRecord): AdvisorMemoryRecord {
      store.set(buildAdvisorMemoryScopeKey(record), record);
      return record;
    },
    size(): number {
      return store.size;
    },
  };
}

export function firstGivenName(value?: string | null): string | null {
  if (typeof value !== "string") return null;
  const first = value.replace(/\s+/g, " ").trim().split(" ")[0] ?? "";
  return first.length >= 2 ? first : null;
}

function capGreetingSentences(value: string): string {
  const sentences = value
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, ADVISOR_MEMORY_MAX_GREETING_SENTENCES);
  return sentences.join(" ");
}

function capMemoryText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const cleaned = sanitizeWorkerChatCopy(value.replace(/\s+/g, " ").trim()) ?? "";
  if (!cleaned) return null;
  if (cleaned.length <= maxLength) return cleaned;
  return `${cleaned.slice(0, Math.max(1, maxLength - 1)).trimEnd()}…`;
}

function capMemoryList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const next: string[] = [];
  for (const item of value) {
    const cleaned = capMemoryText(item, ADVISOR_MEMORY_MAX_ITEM_CHARS);
    if (!cleaned || next.includes(cleaned)) continue;
    next.push(cleaned);
    if (next.length >= ADVISOR_MEMORY_MAX_LIST_ITEMS) break;
  }
  return next;
}

function mergeUniqueMemoryItems(values: Array<string[] | undefined>): string[] {
  const next: string[] = [];
  for (const list of values) {
    for (const item of list ?? []) {
      if (!item || next.includes(item)) continue;
      next.push(item);
      if (next.length >= ADVISOR_MEMORY_MAX_LIST_ITEMS) return next;
    }
  }
  return next;
}

export function resolveAdvisorMemoryModel(requested?: string | null): string {
  const model = requested?.trim() || ADVISOR_MEMORY_MODEL;
  if (/mini/i.test(model) || model === ADVISOR_MEMORY_MODEL) {
    return ADVISOR_MEMORY_MODEL;
  }
  return ADVISOR_MEMORY_MODEL;
}

export function hasAdvisorMemoryContent(memory?: AdvisorMemoryRecord | null): boolean {
  if (!memory) return false;
  return Boolean(
    memory.greeting ||
      memory.highlights.length ||
      memory.documentsDiscussed.length ||
      memory.risksFlagged.length ||
      memory.nextSteps.length ||
      memory.recentTurns.length,
  );
}

export function buildAdvisorGreeting(params: {
  employeeName?: string | null;
  employerEntity?: string | null;
  highlights?: string[];
  documentsDiscussed?: string[];
  risksFlagged?: string[];
  nextSteps?: string[];
}): string {
  const name = firstGivenName(params.employeeName);
  const employer = capMemoryText(params.employerEntity, 80);
  const highlight = params.highlights?.[0];
  const document = params.documentsDiscussed?.[0];
  const risk = params.risksFlagged?.[0];
  const nextStep = params.nextSteps?.[0];
  const hasPrior =
    Boolean(highlight || document || risk || nextStep);

  const parts: string[] = [];
  if (hasPrior) {
    parts.push(name ? `Hola de nuevo, ${name}.` : "Hola de nuevo.");
    if (employer) {
      parts.push(`Seguimos con tu caso frente a ${employer}.`);
    } else {
      parts.push("Seguimos con este mismo expediente.");
    }
    if (document) parts.push(`Ya platicamos de ${document}.`);
    if (highlight) parts.push(`Lo que dejó más claro la última plática: ${highlight}`);
    if (risk) parts.push(`Lo que más nos preocupa: ${risk}`);
    if (nextStep) parts.push(`El siguiente paso que dejamos: ${nextStep}`);
    parts.push("¿Seguimos por ahí o quieres revisar otra cosa de este expediente?");
  } else if (name && employer) {
    parts.push(
      `Hola, ${name}. Empiezo con tu expediente frente a ${employer}. Pregúntame en palabras simples: te digo lo que sí se ve, qué falta y el siguiente paso.`,
    );
  } else if (name) {
    parts.push(
      `Hola, ${name}. Empiezo con tu expediente. Pregúntame en palabras simples: te digo lo que sí se ve, qué falta y el siguiente paso.`,
    );
  } else {
    parts.push(
      "Hola. Empiezo con este expediente. Pregúntame en palabras simples: te digo lo que sí se ve, qué falta y el siguiente paso.",
    );
  }

  return (
    capMemoryText(capGreetingSentences(parts.join(" ")), ADVISOR_MEMORY_MAX_GREETING_CHARS) ??
    "Hola. Seguimos con este expediente."
  );
}

export function buildAsesorContinuityIntro(params: {
  memoryGreeting?: string | null;
  opinionIntro?: string | null;
  opinionSummary?: string | null;
  employeeName?: string | null;
  employerEntity?: string | null;
  documentsCount: number;
}): string {
  const memoryGreeting = capMemoryText(
    params.memoryGreeting ? capGreetingSentences(params.memoryGreeting) : null,
    ADVISOR_MEMORY_MAX_GREETING_CHARS,
  );
  if (memoryGreeting) return memoryGreeting;

  const opinionIntro = capMemoryText(
    params.opinionIntro ? capGreetingSentences(params.opinionIntro) : null,
    ADVISOR_MEMORY_MAX_GREETING_CHARS,
  );
  if (opinionIntro) return opinionIntro;

  const opinionSummary = capMemoryText(
    params.opinionSummary ? capGreetingSentences(params.opinionSummary) : null,
    ADVISOR_MEMORY_MAX_GREETING_CHARS,
  );
  if (opinionSummary) {
    return `${opinionSummary}\n\nPregúntame en palabras simples. Te digo lo que sí se ve, lo que falta y el siguiente paso.`;
  }

  const workerName = params.employeeName?.trim();
  const employerName = params.employerEntity?.trim();
  const casePeople =
    workerName && employerName
      ? `el expediente de ${workerName} con ${employerName}`
      : workerName
        ? `el expediente de ${workerName}`
        : "este expediente";

  if (params.documentsCount === 0) {
    return `Todavía no hay un documento para leer en ${casePeople}. Sube tu recibo, CFDI o PDF del IMSS y te digo, de este caso, qué se ve, qué falta y el siguiente paso.`;
  }

  return `Ya hay una primera lectura de ${params.documentsCount} documento${
    params.documentsCount === 1 ? "" : "s"
  } en ${casePeople}. Pregúntame qué se ve aquí, qué falta y el siguiente paso.`;
}

export function normalizeAdvisorMemoryRecord(
  value: unknown,
  fallbackScope?: Partial<AdvisorMemoryScope> & {
    employeeName?: string | null;
    employerEntity?: string | null;
    caseTitle?: string | null;
  },
): AdvisorMemoryRecord | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const tenantId =
    typeof record.tenantId === "string" && record.tenantId.trim()
      ? record.tenantId.trim()
      : fallbackScope?.tenantId;
  const caseId =
    typeof record.caseId === "string" && record.caseId.trim()
      ? record.caseId.trim()
      : fallbackScope?.caseId;
  const userId =
    typeof record.userId === "number" && Number.isFinite(record.userId)
      ? record.userId
      : fallbackScope?.userId;
  if (!tenantId || !caseId || typeof userId !== "number") return null;

  const recentTurns = capWorkerChatConversationHistory(record.recentTurns, {
    maxMessages: ADVISOR_MEMORY_MAX_TURNS,
  });
  const highlights = capMemoryList(record.highlights);
  const documentsDiscussed = capMemoryList(record.documentsDiscussed);
  const risksFlagged = capMemoryList(record.risksFlagged);
  const nextSteps = capMemoryList(record.nextSteps);
  const employeeName =
    capMemoryText(record.employeeName, 80) ?? fallbackScope?.employeeName ?? null;
  const employerEntity =
    capMemoryText(record.employerEntity, 80) ?? fallbackScope?.employerEntity ?? null;
  const caseTitle = capMemoryText(record.caseTitle, 120) ?? fallbackScope?.caseTitle ?? null;
  const greeting =
    capMemoryText(record.greeting, ADVISOR_MEMORY_MAX_GREETING_CHARS) ??
    buildAdvisorGreeting({
      employeeName,
      employerEntity,
      highlights,
      documentsDiscussed,
      risksFlagged,
      nextSteps,
    });

  return {
    tenantId,
    caseId,
    userId,
    employeeName,
    employerEntity,
    caseTitle,
    greeting,
    highlights,
    documentsDiscussed,
    risksFlagged,
    nextSteps,
    recentTurns,
    lastPrompt: capMemoryText(record.lastPrompt, 400),
    lastAnswer: capMemoryText(record.lastAnswer, 800),
    modelUsed: resolveAdvisorMemoryModel(
      typeof record.modelUsed === "string" ? record.modelUsed : ADVISOR_MEMORY_MODEL,
    ),
    updatedAt:
      typeof record.updatedAt === "string" && record.updatedAt.trim()
        ? record.updatedAt
        : new Date().toISOString(),
  };
}

export function parseAdvisorMemoryLlmPayload(value: unknown): AdvisorMemorySummaryDraft | null {
  const raw =
    typeof value === "string"
      ? value
      : value && typeof value === "object"
        ? JSON.stringify(value)
        : "";
  if (!raw.trim()) return null;

  const fenced = raw.match(/\{[\s\S]*\}/);
  if (!fenced) return null;

  try {
    const parsed = JSON.parse(fenced[0]) as Record<string, unknown>;
    return {
      greeting: capMemoryText(parsed.greeting, ADVISOR_MEMORY_MAX_GREETING_CHARS),
      highlights: capMemoryList(parsed.highlights),
      documentsDiscussed: capMemoryList(parsed.documentsDiscussed),
      risksFlagged: capMemoryList(parsed.risksFlagged),
      nextSteps: capMemoryList(parsed.nextSteps),
    };
  } catch {
    return null;
  }
}

export function appendAdvisorMemoryTurn(
  previous: WorkerChatHistoryTurn[] | undefined,
  turn: { prompt: string; answer: string },
): WorkerChatHistoryTurn[] {
  return capWorkerChatConversationHistory(
    [
      ...(previous ?? []),
      { role: "user", content: turn.prompt },
      { role: "assistant", content: turn.answer },
    ],
    { maxMessages: ADVISOR_MEMORY_MAX_TURNS },
  );
}

export function mergeAdvisorMemory(params: {
  previous?: AdvisorMemoryRecord | null;
  draft?: AdvisorMemorySummaryDraft | null;
  scope: AdvisorMemoryScope;
  employeeName?: string | null;
  employerEntity?: string | null;
  caseTitle?: string | null;
  prompt: string;
  answer: string;
  visibleDocuments?: Array<{ originalName?: string | null; documentType?: string | null }>;
  modelUsed?: string | null;
}): AdvisorMemoryRecord {
  const visibleDocuments = (params.visibleDocuments ?? [])
    .map((document) => document.originalName || document.documentType || "")
    .filter(Boolean);
  const highlights = mergeUniqueMemoryItems([
    params.draft?.highlights ?? undefined,
    params.previous?.highlights,
    [params.prompt],
  ]);
  const documentsDiscussed = mergeUniqueMemoryItems([
    params.draft?.documentsDiscussed ?? undefined,
    params.previous?.documentsDiscussed,
    visibleDocuments,
  ]);
  const risksFlagged = mergeUniqueMemoryItems([
    params.draft?.risksFlagged ?? undefined,
    params.previous?.risksFlagged,
  ]);
  const nextSteps = mergeUniqueMemoryItems([
    params.draft?.nextSteps ?? undefined,
    params.previous?.nextSteps,
  ]);
  const recentTurns = appendAdvisorMemoryTurn(params.previous?.recentTurns, {
    prompt: params.prompt,
    answer: params.answer,
  });

  return {
    tenantId: params.scope.tenantId,
    caseId: params.scope.caseId,
    userId: params.scope.userId,
    employeeName: params.employeeName ?? params.previous?.employeeName ?? null,
    employerEntity: params.employerEntity ?? params.previous?.employerEntity ?? null,
    caseTitle: params.caseTitle ?? params.previous?.caseTitle ?? null,
    greeting:
      capMemoryText(params.draft?.greeting, ADVISOR_MEMORY_MAX_GREETING_CHARS) ??
      buildAdvisorGreeting({
        employeeName: params.employeeName ?? params.previous?.employeeName,
        employerEntity: params.employerEntity ?? params.previous?.employerEntity,
        highlights,
        documentsDiscussed,
        risksFlagged,
        nextSteps,
      }),
    highlights,
    documentsDiscussed,
    risksFlagged,
    nextSteps,
    recentTurns,
    lastPrompt: capMemoryText(params.prompt, 400),
    lastAnswer: capMemoryText(params.answer, 800),
    modelUsed: resolveAdvisorMemoryModel(params.modelUsed),
    updatedAt: new Date().toISOString(),
  };
}

export function formatAdvisorMemoryForPrompt(memory?: AdvisorMemoryRecord | null): {
  available: boolean;
  greeting: string | null;
  employeeName: string | null;
  employerEntity: string | null;
  highlights: string[];
  documentsDiscussed: string[];
  risksFlagged: string[];
  nextSteps: string[];
  lastPrompt: string | null;
  guidance: string;
} {
  if (!hasAdvisorMemoryContent(memory) || !memory) {
    return {
      available: false,
      greeting: null,
      employeeName: null,
      employerEntity: null,
      highlights: [],
      documentsDiscussed: [],
      risksFlagged: [],
      nextSteps: [],
      lastPrompt: null,
      guidance:
        "Aún no hay memoria previa de este expediente. Empieza con calidez, caso primero, y no inventes pláticas anteriores.",
    };
  }

  return {
    available: true,
    greeting: memory.greeting,
    employeeName: memory.employeeName,
    employerEntity: memory.employerEntity,
    highlights: memory.highlights,
    documentsDiscussed: memory.documentsDiscussed,
    risksFlagged: memory.risksFlagged,
    nextSteps: memory.nextSteps,
    lastPrompt: memory.lastPrompt,
    guidance:
      "Ya conoces a esta persona y a su patrón. Continúa como quien ya llevó este expediente: cálido, caso primero, sin tecnicismos. Nunca te presentes como Helios ni digas que eres abogado. Recuerda solo lo de ESTE expediente.",
  };
}

export function toPublicAdvisorMemory(memory?: AdvisorMemoryRecord | null) {
  if (!memory) return null;
  return {
    greeting: memory.greeting,
    highlights: memory.highlights,
    documentsDiscussed: memory.documentsDiscussed,
    risksFlagged: memory.risksFlagged,
    nextSteps: memory.nextSteps,
    recentTurns: memory.recentTurns,
    updatedAt: memory.updatedAt,
  };
}

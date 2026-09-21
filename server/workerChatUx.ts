import {
  CASE_ADVISOR_FALLO_RULE,
  CASE_ADVISOR_RULE,
  briefingHasInstituteFailure,
  buildNoLiveOfficialAnswer,
  alignVisibleChatWithBriefing,
  buildOfficialCaseBriefing,
  buildOfficialChatStarterQuestions,
  buildPayWellFallback,
  formatOfficialCaseBriefingForPrompt,
  isPayWellQuestion,
  type OfficialCaseBriefing,
  type OfficialBriefingFacts,
} from "@shared/officialCaseBriefing";
import {
  OFFICIAL_FAILED_MISSING,
  INSTITUTE_SILENCE_CHAT,
  hasLiveOfficialResult,
  identityFlagsFromReceiptValues,
  stripContradictoryMissingIdentityCopy,
  type OfficialChatAnchor,
  type OfficialCheckSummary,
  type ReciboVsOficial,
} from "@shared/officialCheckCopy";
import {
  emptyOfficialDigest,
  shouldAttachOfficialDigest,
  shortenOfficialTitle,
  type OfficialDigestResult,
} from "@shared/officialDigest";
import {
  WORKER_CHAT_CLEAR_HEADING,
  WORKER_CHAT_DISCLAIMER,
  WORKER_CHAT_KNOWN_HEADING,
  WORKER_CHAT_MISSING_HEADING,
  WORKER_CHAT_MULTI_DOC_UPSELL,
  WORKER_CHAT_NEXT_HEADING,
  WORKER_CHAT_SOURCES_HEADING,
  WORKER_ADVISOR_VOICE_NOTE,
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
  liveImssValidation: boolean;
  validationMode: "document_signals";
  documentsCount: number;
  documentType: string | null;
  summary: string | null;
  recommendedNextStep: string | null;
  uncertainties: string[];
  keyFacts: string[];
  legalFoundations: WorkerChatLegalFoundation[];
  officialDigest: OfficialDigestResult;
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
  workerName: string | null;
  employerName: string | null;
  caseTitle: string | null;
  riskLevel: string | null;
  officialCheck: OfficialCheckSummary | null;
  chatAnchor: OfficialChatAnchor | null;
  reciboVsOficial: ReciboVsOficial | null;
  officialBriefing: OfficialCaseBriefing;
  caseOnly: boolean;
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
  officialDigest?: OfficialDigestResult | null;
  workerName?: string | null;
  employerName?: string | null;
  caseTitle?: string | null;
  riskLevel?: string | null;
  officialCheck?: OfficialCheckSummary | null;
  officialBriefing?: OfficialCaseBriefing | null;
  chatAnchor?: OfficialChatAnchor | null;
  reciboVsOficial?: ReciboVsOficial | null;
  caseOnly?: boolean;
  nowMs?: number;
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
  const receiptFacts: OfficialBriefingFacts = {
    ...labor.facts,
    ...(params.officialBriefing?.facts ?? {}),
    nss: params.officialBriefing?.facts.nss ?? labor.facts.nss ?? null,
    curp: params.officialBriefing?.facts.curp ?? labor.facts.curp ?? null,
    workerRfc: params.officialBriefing?.facts.workerRfc ?? labor.facts.workerRfc ?? null,
    netAmount: params.officialBriefing?.facts.netAmount ?? labor.facts.netAmount ?? null,
  };
  const officialBriefing = buildOfficialCaseBriefing({
    officialCheck: params.officialCheck ?? params.officialBriefing?.officialCheck ?? null,
    facts: receiptFacts,
    chatAnchor:
      params.chatAnchor ??
      params.officialCheck?.chatAnchor ??
      params.officialBriefing?.chatAnchor ??
      null,
    reciboVsOficial:
      params.reciboVsOficial ??
      params.officialCheck?.reciboVsOficial ??
      params.officialBriefing?.reciboVsOficial ??
      null,
    nowMs: params.nowMs,
  });
  const caseOnly = params.caseOnly ?? !(params.officialDigest && params.officialDigest.citations.length > 0);

  return {
    liveImssValidation: hasLiveOfficialResult(officialBriefing.officialCheck) || officialBriefing.hasLiveOfficialResult,
    officialCheck: params.officialCheck ?? officialBriefing.officialCheck,
    chatAnchor: officialBriefing.chatAnchor,
    reciboVsOficial: officialBriefing.reciboVsOficial,
    officialBriefing,
    caseOnly,
    validationMode: "document_signals",
    documentsCount: params.documents.length,
    documentType: labor.snapshots[0]?.documentType ?? asText(params.documents[0]?.documentType),
    summary,
    recommendedNextStep,
    uncertainties: asTextList(opinion?.uncertainties).slice(0, 3),
    keyFacts: asTextList(opinion?.keyFactsUsed).slice(0, 4),
    legalFoundations,
    officialDigest: params.officialDigest ?? emptyOfficialDigest(),
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
    workerName: asText(params.workerName),
    employerName: asText(params.employerName),
    caseTitle: asText(params.caseTitle),
    riskLevel: asText(params.riskLevel),
  };
}

function receiptIdentityFromGrounding(grounding: WorkerChatGrounding) {
  return identityFlagsFromReceiptValues({
    nss: grounding.officialBriefing.facts.nss ?? grounding.laborFacts.nss,
    curp: grounding.officialBriefing.facts.curp ?? grounding.laborFacts.curp,
    workerRfc: grounding.officialBriefing.facts.workerRfc ?? grounding.laborFacts.workerRfc,
    rfc: grounding.officialBriefing.facts.workerRfc ?? grounding.laborFacts.workerRfc,
    employerRfc: grounding.officialBriefing.facts.employerRfc ?? grounding.laborFacts.employerRfc,
  });
}

function sanitizeChatIdentityCopy(answer: string, grounding: WorkerChatGrounding) {
  return alignVisibleChatWithBriefing(
    stripContradictoryMissingIdentityCopy(
      answer,
      receiptIdentityFromGrounding(grounding),
      grounding.officialBriefing.facts,
    ),
    grounding.officialBriefing,
  );
}

export function resolveWorkerChatGuidance(
  grounding: WorkerChatGrounding,
  prompt?: string | null,
): WorkerChatLaborGuidance {
  return buildLaborFiscalChatGuidance(
    { ...grounding, caseChatPrimary: grounding.caseOnly },
    prompt,
  );
}

export function buildWorkerChatSuggestedPrompts(grounding: WorkerChatGrounding): string[] {
  const officialStarters = buildOfficialChatStarterQuestions(grounding.officialBriefing);
  const context: WorkerChatStarterContext = {
    documentType: grounding.documentType,
    documentsCount: grounding.documentsCount,
    hasImssSignal: grounding.hasImssSignal,
    hasFiscalSignal: grounding.hasFiscalSignal,
    hasInfonavitSignal: grounding.hasInfonavitSignal,
    missingDocumentLabel: grounding.missingDocumentLabel,
    recommendedNextStep: grounding.recommendedNextStep,
    resultCardQuestions: grounding.caseOnly ? [] : grounding.resultCardQuestions,
    hasOfficialConsulta: grounding.officialBriefing.hasOfficialConsulta,
    officialStarters,
  };
  return buildWorkerStarterQuestions(context);
}

export function buildWorkerChatFallbackAnswer(
  grounding: WorkerChatGrounding,
  options?: { prompt?: string | null },
): string {
  let answer: string;
  if (
    grounding.documentsCount > 0 &&
    !grounding.officialBriefing.hasLiveOfficialResult &&
    (grounding.officialBriefing.instituteSilence || briefingHasInstituteFailure(grounding.officialBriefing))
  ) {
    return buildNoLiveOfficialAnswer(grounding.officialBriefing).clearAnswer;
  }
  if (grounding.documentsCount === 0) {
    const who =
      grounding.workerName && grounding.employerName
        ? `el expediente de ${grounding.workerName} con ${grounding.employerName}`
        : grounding.workerName
          ? `el expediente de ${grounding.workerName}`
          : "tu expediente";
    answer = formatWorkerChatAnswer({
      answer: `Hola. Todavía no hay un documento para leer en ${who}. Sin un recibo, contrato o CFDI no puedo decirte qué se ve ni qué falta en este caso.`,
      known: "Aún no hay señales visibles en un papel de este expediente.",
      missing: "Falta el primer documento laboral para empezar la lectura de este caso.",
      nextStep: "Sube el papel laboral que tengas más a la mano. Con eso te digo, de ESTE expediente, lo que sí se ve y el siguiente paso.",
      disclaimer: grounding.disclaimer,
    });
  } else if (grounding.caseOnly && !grounding.officialBriefing.hasLiveOfficialResult) {
    const blocked = isPayWellQuestion(options?.prompt)
      ? buildPayWellFallback(grounding.officialBriefing)
      : buildNoLiveOfficialAnswer(grounding.officialBriefing);
    answer = formatWorkerChatAnswer({
      answer: blocked.clearAnswer,
      known: blocked.known,
      missing: blocked.missing,
      nextStep: blocked.nextStep,
      includeOfficialSources: false,
      prompt: options?.prompt,
      disclaimer: grounding.disclaimer,
      multiDocUpsell: grounding.multiDocUpsell,
    });
  } else if (grounding.officialBriefing.verdict?.kind === "mixed") {
    const mixed = grounding.officialBriefing.verdict;
    const comparison = grounding.officialBriefing.comparison;
    const comparisonBit =
      comparison.seen === "bien" || comparison.seen === "hay_diferencia"
        ? ` ${comparison.seenLine} ${comparison.nextStep}`
        : "";
    answer = formatWorkerChatAnswer({
      answer: `${mixed.chat}${comparisonBit}`,
      known: mixed.verdict,
      missing: "Todavía falta la respuesta de las oficinas que hoy no contestaron.",
      nextStep: mixed.nextStep,
      includeOfficialSources: false,
      prompt: options?.prompt,
      disclaimer: grounding.disclaimer,
      multiDocUpsell: grounding.multiDocUpsell,
    });
  } else if (isPayWellQuestion(options?.prompt)) {
    const pay = buildPayWellFallback(grounding.officialBriefing);
    answer = formatWorkerChatAnswer({
      answer: pay.clearAnswer,
      known: pay.known,
      missing: pay.missing,
      nextStep: pay.nextStep,
      includeOfficialSources: false,
      prompt: options?.prompt,
      disclaimer: grounding.disclaimer,
      multiDocUpsell: grounding.multiDocUpsell,
    });
  } else {
    const briefing = grounding.officialBriefing;
    const includeOfficialSources = !grounding.caseOnly && shouldAttachOfficialDigest(options?.prompt);
    const known =
      briefing.hechoLines.length > 0
        ? briefing.hechoLines.slice(0, 6).join(" ")
        : briefing.statusLines.join(". ") || briefing.headline;
    answer = formatWorkerChatAnswer({
      answer: `${briefing.comparison.seenLine} ${briefing.statusLines.join(". ")}`.trim(),
      known: known ?? "Hay un resultado de TU consulta en este expediente.",
      missing:
        briefing.comparison.seen === "no_se_pudo"
          ? briefing.missingIdentityDetail ??
            (briefingHasInstituteFailure(briefing) ? OFFICIAL_FAILED_MISSING : "La consulta no trajo un monto comparable.")
          : "La consulta no confirma que el patrón cumpla.",
      nextStep: briefing.comparison.nextStep,
      officialSources: includeOfficialSources ? grounding.officialDigest.citations : null,
      officialSourcesNote: includeOfficialSources ? grounding.officialDigest.honestyNote : null,
      includeOfficialSources,
      prompt: options?.prompt,
      disclaimer: grounding.disclaimer,
      multiDocUpsell: grounding.multiDocUpsell,
    });
  }
  return sanitizeChatIdentityCopy(answer, grounding);
}

export function buildWorkerChatLlmInstructions(
  grounding: WorkerChatGrounding,
  options?: { prompt?: string | null },
): string {
  const guidance = resolveWorkerChatGuidance(grounding, options?.prompt);
  const nextStep = grounding.officialBriefing.verdict?.kind === "mixed"
    ? grounding.officialBriefing.verdict.nextStep
    : briefingHasInstituteFailure(grounding.officialBriefing)
      ? grounding.officialBriefing.comparison.nextStep
      : guidance.nextStep;
  const includeOfficialSources = !grounding.caseOnly && shouldAttachOfficialDigest(options?.prompt);
  const foundations =
    grounding.legalFoundations.length > 0
      ? grounding.legalFoundations
          .map((item) => `- ${item.title} (${item.reference}): ${item.relevance}`)
          .join("\n")
      : "- No hay bases legales extra en esta lectura. No inventes artículos, tesis ni jurisprudencia.";
  const officialLines = includeOfficialSources
    ? grounding.officialDigest.citations.length > 0
      ? grounding.officialDigest.citations
          .map(
            (item) =>
              `- ${shortenOfficialTitle(item.title)} (${item.kindLabel}; liga oficial: ${item.url})`,
          )
          .join("\n")
      : grounding.officialDigest.honestyNote
        ? `- ${grounding.officialDigest.honestyNote}`
        : "- No hay lecturas oficiales en el digest para esta pregunta. No inventes títulos, IUS ni registro digital."
    : "- Esta pregunta es sobre el papel (recibo/IMSS/NSS/ISR/Infonavit). NO agregues la sección Lecturas oficiales ni cites DOF, SCJN, decretos, subcontratación u otros rubros oficiales.";
  const visibleFacts =
    guidance.visibleFactLines.length > 0
      ? guidance.visibleFactLines.map((item) => `- ${item}`).join("\n")
      : "- No hay montos, RFC ni NSS claros. No inventes ninguno.";

  const casePeople = [
    grounding.workerName ? `persona trabajadora: ${grounding.workerName}` : null,
    grounding.employerName ? `patrón: ${grounding.employerName}` : null,
    grounding.caseTitle ? `expediente: ${grounding.caseTitle}` : null,
    grounding.riskLevel ? `riesgo visible: ${grounding.riskLevel}` : null,
  ]
    .filter((item): item is string => Boolean(item))
    .join("; ");

  if (grounding.caseOnly) {
    return [
      CASE_ADVISOR_RULE,
      CASE_ADVISOR_FALLO_RULE,
      formatOfficialCaseBriefingForPrompt(grounding.officialBriefing),
      `chatAnchor: ${JSON.stringify(grounding.chatAnchor)}`,
      `reciboVsOficial: ${JSON.stringify(grounding.reciboVsOficial)}`,
      WORKER_ADVISOR_VOICE_NOTE,
      `Si necesitas un nombre, preséntate solo como ${WORKER_CHAT_TITLE.toLowerCase()}. NUNCA escribas Helios, Modo Helios ni CompliLink.`,
      "Habla en español sencillo, cálido y familiar. Frases cortas. Sin jerga de ingeniería ni tecnicismos.",
      casePeople
        ? `Este es el caso concreto que ya tienes abierto: ${casePeople}. Toda respuesta debe hablar de estas personas y papeles, no de un caso genérico.`
        : "Este es un expediente concreto. No des consejos de libro: aplica todo a los papeles que sí están aquí.",
      "Si preguntan un concepto (IMSS, ISR, finiquito, etc.), explícalo aplicado a ESTE expediente: qué se ve aquí, qué falta aquí y qué le conviene a esta persona.",
      "Nunca inventes tesis, registro digital, Semanario Judicial, IUS ni jurisprudencia.",
      "No uses el título Lecturas oficiales del digest. La respuesta son solo las cuatro secciones del papel.",
      "Si una lectura es doctrina, dilo: doctrina de la Corte, no jurisprudencia. Nunca etiquetes doctrina como jurisprudencia.",
      grounding.officialBriefing.verdict?.kind === "mixed"
        ? `Hay fuentes que sí contestaron y otras que no. Cita solo las vivas. No digas que fallaron las que sí contestaron. Idea: ${grounding.officialBriefing.verdict.chat}`
        : grounding.officialBriefing.hasLiveOfficialResult
          ? "Cita solo estados, fechas y hechos de chatAnchor. No inventes cumple, alta vigente ni salario oficial si no vienen en esos hechos."
          : briefingHasInstituteFailure(grounding.officialBriefing)
            ? `${CASE_ADVISOR_FALLO_RULE} Inténtalo más tarde.`
            : "No hay resultado vivo de TU consulta. Una frase y el botón Consultar IMSS y SAT. No inventes un estado oficial.",
      "Límite: habla solo con el resultado de TU consulta y el recibo de ESTE expediente. No inventes cumple, alta vigente ni salario oficial.",
      "Hechos visibles (únicos montos, RFC o NSS que puedes citar):",
      visibleFacts,
      `Siguiente paso ya anclado (acláralo si hace falta, no lo cambies por otro distinto): ${nextStep}`,
      grounding.officialBriefing.verdict?.kind === "mixed"
        ? `Responde con un solo párrafo, sin títulos de Respuesta clara, Lo que sí se sabe, Lo que falta ni Siguiente paso. Cita lo que sí contestó. No digas que esa oficina no contestó. Idea: ${grounding.officialBriefing.verdict.chat} Prohibido: Falló, «no de AuditaPatrón», «Esto vimos: bien», decir que IMSS, SAT e Infonavit no contestaron si alguna sí lo hizo.`
        : grounding.officialBriefing.instituteSilence ||
          (!grounding.officialBriefing.hasLiveOfficialResult &&
            briefingHasInstituteFailure(grounding.officialBriefing))
          ? `Responde con un solo párrafo, sin títulos de Respuesta clara, Lo que sí se sabe, Lo que falta ni Siguiente paso. Idea: ${grounding.officialBriefing.verdict?.chat ?? INSTITUTE_SILENCE_CHAT} Si preguntan qué implica para el pago, di que hoy no se puede saber si el patrón está bien dado de alta ni si el pago está bien o mal. Prohibido: Falló, «no de AuditaPatrón», «Esto vimos: bien», dictamen.`
          : `Responde con cuatro partes y estos títulos exactos: 1) ${WORKER_CHAT_CLEAR_HEADING} 2) ${WORKER_CHAT_KNOWN_HEADING} 3) ${WORKER_CHAT_MISSING_HEADING} 4) ${WORKER_CHAT_NEXT_HEADING}.`,
      "En modo breve: 1 o 2 frases por parte. En modo más explicativo: hasta 3 frases por parte. Si la respuesta es el párrafo de oficinas sin respuesta, no partas en cuatro.",
      `Cierra con esta frase exacta: ${WORKER_CHAT_DISCLAIMER}`,
    ].join("\n");
  }

  return [
    CASE_ADVISOR_RULE,
    CASE_ADVISOR_FALLO_RULE,
    formatOfficialCaseBriefingForPrompt(grounding.officialBriefing),
    `chatAnchor: ${JSON.stringify(grounding.chatAnchor)}`,
    `reciboVsOficial: ${JSON.stringify(grounding.reciboVsOficial)}`,
    WORKER_ADVISOR_VOICE_NOTE,
    `Si necesitas un nombre, preséntate solo como ${WORKER_CHAT_TITLE.toLowerCase()}. NUNCA escribas Helios, Modo Helios ni CompliLink.`,
    "Habla en español sencillo, cálido y familiar. Frases cortas. Sin jerga de ingeniería ni tecnicismos.",
    casePeople
      ? `Este es el caso concreto que ya tienes abierto: ${casePeople}. Toda respuesta debe hablar de estas personas y papeles, no de un caso genérico.`
      : "Este es un expediente concreto. No des consejos de libro: aplica todo a los papeles que sí están aquí.",
    "Si preguntan un concepto (IMSS, ISR, finiquito, etc.), explícalo aplicado a ESTE expediente: qué se ve aquí, qué falta aquí y qué le conviene a esta persona.",
    "No cites autores, doctrina, tesis ni jurisprudencia por citar. Solo bases ya listadas, en palabras simples.",
    "Usa únicamente las señales del documento y las bases legales ya listadas.",
    "Si un dato no aparece, di que no se ve en los papeles de este expediente.",
    "Nunca inventes tesis, registro digital, Semanario Judicial, IUS ni jurisprudencia.",
    "Si el digest trae lecturas oficiales, puedes citar SOLO esos títulos y ligas, en palabras simples, sin claves de tesis.",
    "Si una lectura es doctrina, dilo: doctrina de la Corte, no jurisprudencia. Si es criterio reiterado, dilo así. Nunca etiquetes doctrina como jurisprudencia.",
    includeOfficialSources
      ? `Si el digest está bloqueado o viene de una consulta anterior, di esa honestidad. Frase útil: ${grounding.officialDigest.honestyNote ?? "No pude abrir la fuente oficial ahora. No invento criterios ni números."}`
      : "No menciones la Corte, el Diario Oficial, decretos ni lecturas oficiales. Quédate en lo que se ve en el papel.",
    includeOfficialSources
      ? `Si citas lecturas oficiales, usa el título recortado tal como aparece aquí y agrégalas bajo ${WORKER_CHAT_SOURCES_HEADING}. No completes el rubro ni inventes IUS.`
      : `No uses el título ${WORKER_CHAT_SOURCES_HEADING}. La respuesta son solo las cuatro secciones del papel.`,
    grounding.officialBriefing.verdict?.kind === "mixed"
      ? `Hay fuentes que sí contestaron y otras que no. Cita solo las vivas. No digas que fallaron las que sí contestaron. Idea: ${grounding.officialBriefing.verdict.chat}`
      : grounding.officialBriefing.hasLiveOfficialResult
        ? "Cita solo estados, fechas y hechos de chatAnchor. No inventes cumple, alta vigente ni salario oficial si no vienen en esos hechos."
        : briefingHasInstituteFailure(grounding.officialBriefing)
          ? `${CASE_ADVISOR_FALLO_RULE} Inténtalo más tarde.`
          : "No hay resultado vivo de TU consulta. Una frase y el botón Consultar IMSS y SAT. No inventes un estado oficial.",
    `Modo de lectura: ${grounding.officialBriefing.hasLiveOfficialResult ? "recibo + resultado de TU consulta" : "sin resultado vivo"}.`,
    `Origen de la lectura: ${guidance.reviewSourceLabel}. ${
      guidance.prefersRemoteOpinion
        ? "Hay revisión avanzada usable. Prefiere su resumen, opinión y siguiente paso. No los sustituyas por una plantilla local."
        : "Esta es la ruta local. Profundiza con las señales visibles, sin inventar consulta oficial."
    }`,
    grounding.caseOnly
      ? "Límite: habla solo con el resultado de TU consulta y el recibo de ESTE expediente. No inventes cumple, alta vigente ni salario oficial."
      : `Límite: ${DOCUMENT_SIGNAL_DISCLAIMER}`,
    "Hechos visibles (únicos montos, RFC o NSS que puedes citar):",
    visibleFacts,
    "Bases legales ya presentes en la lectura (únicas que puedes mencionar, en palabras simples):",
    foundations,
    "Lecturas oficiales del digest (únicos títulos y ligas que puedes citar):",
    officialLines,
    `Siguiente paso ya anclado (acláralo si hace falta, no lo cambies por otro distinto): ${nextStep}`,
    `Si preguntan por IMSS e ISR (o impuestos/retenciones) juntos, el siguiente paso debe cubrir ambos: cruzar NSS/IMSS con el siguiente recibo o un papel IMSS (sin confirmar alta oficial) y cruzar la retención ISR con el CFDI o el depósito del mismo periodo. Si también mencionan Infonavit —o preguntan los tres—, cubre además el cruce de retención/crédito Infonavit con el aviso de retención o estado de crédito. Si preguntan por IMSS, impuestos o Infonavit por separado, usa esas señales y el límite honesto. Foco de esta pregunta: ${guidance.promptFocus}.`,
    grounding.officialBriefing.verdict?.kind === "mixed"
      ? `Responde con un solo párrafo, sin títulos de Respuesta clara, Lo que sí se sabe, Lo que falta ni Siguiente paso. Cita lo que sí contestó. No digas que esa oficina no contestó. Idea: ${grounding.officialBriefing.verdict.chat} Prohibido: Falló, «no de AuditaPatrón», «Esto vimos: bien», decir que IMSS, SAT e Infonavit no contestaron si alguna sí lo hizo.`
      : grounding.officialBriefing.instituteSilence ||
        (!grounding.officialBriefing.hasLiveOfficialResult &&
          briefingHasInstituteFailure(grounding.officialBriefing))
        ? `Responde con un solo párrafo, sin títulos de Respuesta clara, Lo que sí se sabe, Lo que falta ni Siguiente paso. Idea: ${grounding.officialBriefing.verdict?.chat ?? INSTITUTE_SILENCE_CHAT} Si preguntan qué implica para el pago, di que hoy no se puede saber si el patrón está bien dado de alta ni si el pago está bien o mal. Prohibido: Falló, «no de AuditaPatrón», «Esto vimos: bien», dictamen.`
        : `Responde con cuatro partes y estos títulos exactos: 1) ${WORKER_CHAT_CLEAR_HEADING} 2) ${WORKER_CHAT_KNOWN_HEADING} 3) ${WORKER_CHAT_MISSING_HEADING} 4) ${WORKER_CHAT_NEXT_HEADING}.`,
    "En modo breve: 1 o 2 frases por parte. En modo más explicativo: hasta 3 frases por parte. Si la respuesta es el párrafo de oficinas sin respuesta, no partas en cuatro.",
    `Cierra con esta frase exacta: ${WORKER_CHAT_DISCLAIMER}`,
  ].join("\n");
}

export function sanitizeWorkerChatAnswer(
  answer: string,
  grounding: WorkerChatGrounding,
  options?: { prompt?: string | null },
): string {
  const cleaned = sanitizeWorkerChatCopy(answer) ?? answer;
  const briefing = grounding.officialBriefing;
  if (briefing.verdict?.kind === "mixed") {
    if (
      /Hoy no pudimos confirmar con IMSS, SAT e Infonavit|Hoy pedimos datos a IMSS, SAT e Infonavit y no contestaron/i.test(
        cleaned,
      )
    ) {
      return briefing.verdict.chat;
    }
  }
  if (
    !briefing.hasLiveOfficialResult &&
    (briefing.instituteSilence || briefingHasInstituteFailure(briefing))
  ) {
    return buildNoLiveOfficialAnswer(briefing).clearAnswer;
  }
  const includeOfficialSources = !grounding.caseOnly && shouldAttachOfficialDigest(options?.prompt);
  if (grounding.caseOnly) {
    return sanitizeChatIdentityCopy(
      formatWorkerChatAnswer({
        answer: cleaned,
        known:
          briefing.hechoLines.slice(0, 6).join(" ") ||
          briefing.statusLines.join(". ") ||
          briefing.headline,
        missing:
          briefing.comparison.seen === "no_se_pudo"
            ? briefing.missingIdentityDetail ??
              (briefingHasInstituteFailure(briefing) ? OFFICIAL_FAILED_MISSING : "La consulta no trajo un monto comparable.")
            : "La consulta no confirma que el patrón cumpla.",
        nextStep: briefing.hasLiveOfficialResult
          ? briefing.comparison.nextStep
          : briefing.comparison.nextStep,
        officialSources: null,
        officialSourcesNote: null,
        includeOfficialSources: false,
        prompt: options?.prompt,
        disclaimer: grounding.disclaimer,
        multiDocUpsell: grounding.multiDocUpsell,
      }),
      grounding,
    );
  }
  const guidance = resolveWorkerChatGuidance(grounding, options?.prompt);
  return sanitizeChatIdentityCopy(
    formatWorkerChatAnswer({
      answer: cleaned,
      known: guidance.known,
      missing: guidance.missing,
      nextStep: guidance.nextStep,
      officialSources: includeOfficialSources ? grounding.officialDigest.citations : null,
      officialSourcesNote: includeOfficialSources ? grounding.officialDigest.honestyNote : null,
      includeOfficialSources,
      prompt: options?.prompt,
      disclaimer: grounding.disclaimer,
      multiDocUpsell: grounding.multiDocUpsell,
    }),
    grounding,
  );
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
      officialDigest: {
        freshness: grounding.officialDigest.freshness,
        liveBlocked: grounding.officialDigest.liveBlocked,
        honestyNote: grounding.officialDigest.honestyNote,
        titles: grounding.officialDigest.citations.map((item) => ({
          title: shortenOfficialTitle(item.title),
          url: item.url,
          kindLabel: item.kindLabel,
        })),
      },
      laborFacts: grounding.laborFacts,
      laborExplanations: grounding.laborExplanations.slice(0, 6),
      missingDocumentLabel: grounding.missingDocumentLabel,
      missingDocumentReason: grounding.missingDocumentReason,
      resultCardQuestions: grounding.resultCardQuestions,
      prefersRemoteOpinion: grounding.prefersRemoteOpinion,
      reviewSource: grounding.reviewSource,
      workerName: grounding.workerName,
      employerName: grounding.employerName,
      caseTitle: grounding.caseTitle,
      riskLevel: grounding.riskLevel,
      officialBriefing: {
        hasOfficialConsulta: grounding.officialBriefing.hasOfficialConsulta,
        hasLiveOfficialResult: grounding.officialBriefing.hasLiveOfficialResult,
        statusLines: grounding.officialBriefing.statusLines,
        hechoLines: grounding.officialBriefing.hechoLines,
        comparison: grounding.officialBriefing.comparison,
        receiptLines: grounding.officialBriefing.receiptLines,
        missingIdentity: grounding.officialBriefing.missingIdentity,
      },
      chatAnchor: grounding.chatAnchor,
      reciboVsOficial: grounding.reciboVsOficial,
      guidance: CASE_ADVISOR_RULE,
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

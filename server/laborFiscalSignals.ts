import {
  humanizeStructuredFieldLabel,
  isWorkerSystemStructuredField,
} from "./workerVisibleExtraction";
import { extractReceiptOfficialIdentity } from "./governmentLiveCheck";

type RecordLike = Record<string, unknown>;

export const LABOR_FISCAL_SIGNAL_SOURCE = "document_text" as const;
export const LABOR_FISCAL_VALIDATION_MODE = "document_signals" as const;

export const DOCUMENT_SIGNAL_DISCLAIMER =
  "Esto no consulta IMSS, SAT ni Infonavit en vivo. Solo lee lo que ya aparece en tus documentos.";

export const LOCAL_REVIEW_LABEL = "Revisión local";
export const REMOTE_REVIEW_LABEL = "Revisión avanzada";

export type LaborFiscalStructuredFacts = {
  period: string | null;
  netAmount: string | null;
  perceptions: string | null;
  deductions: string | null;
  employerRfc: string | null;
  workerRfc: string | null;
  nss: string | null;
  curp: string | null;
  employerRegistration: string | null;
  isrWithheld: string | null;
  imssWithheld: string | null;
  infonavitWithheld: string | null;
};

export type LaborFiscalWorkerExplanation = {
  label: string;
  summary: string;
};

export type WorkerReviewSource = "local" | "remote";

export type WorkerReviewSourceSnapshot = {
  reviewSource: WorkerReviewSource;
  reviewSourceLabel: string;
  reviewSourceExplanation: string;
};

export type LaborFiscalSignalSnapshot = {
  liveImssValidation: false;
  source: typeof LABOR_FISCAL_SIGNAL_SOURCE;
  validationMode: typeof LABOR_FISCAL_VALIDATION_MODE;
  documentType: string | null;
  hasImssDocument: boolean;
  hasImssWithholding: boolean;
  hasNss: boolean;
  hasEmployerRegistration: boolean;
  hasSbc: boolean;
  hasSdi: boolean;
  hasIsrWithholding: boolean;
  hasInfonavitDeduction: boolean;
  hasImssLaborSignal: boolean;
  hasInfonavitSignal: boolean;
  hasFiscalSignal: boolean;
  facts: LaborFiscalStructuredFacts;
  explanations: LaborFiscalWorkerExplanation[];
};

export type DocumentLaborFiscalInput = {
  documentType?: string | null;
  originalName?: string | null;
  heliosOpinion?: unknown;
  preliminaryAnalysis?: unknown;
};

const FACT_ALIASES: Record<keyof LaborFiscalStructuredFacts, string[]> = {
  period: ["payrollperiod", "period", "periodo", "paymentperiod", "payperiod", "fechapago", "apparenteffectivedate"],
  netAmount: ["payrollnetamount", "neto", "netamount", "totalneto", "apparentamount", "totalpagar"],
  perceptions: ["payrollperceptions", "percepciones", "totalpercepciones", "grossamount"],
  deductions: ["payrolldeductions", "deducciones", "totaldeducciones", "deductions"],
  employerRfc: ["employerrfc", "rfcpayrollissuer", "rfcemisor", "rfcpatron"],
  workerRfc: ["workerrfc", "rfctrabajador", "rfcreceptor", "rfcworker", "rfcempleado", "rfcreceptorcfdi"],
  nss: [
    "payrollnss",
    "nss",
    "numseguridadsocial",
    "numerodeseguridadsocial",
    "numerosegurosocial",
    "numnss",
    "imssnss",
    "nsstrabajador",
  ],
  curp: ["payrollcurp", "curp", "clavunica", "claveunicaregistropoblacion", "curptrabajador", "curpempleado", "curpreceptor"],
  employerRegistration: ["payrollemployerregistration", "registropatronal", "regpatronal"],
  isrWithheld: ["isrwithheld", "isr", "retencionisr"],
  imssWithheld: ["imsswithheld", "cuotaimss", "retencionimss"],
  infonavitWithheld: ["infonavitwithheld", "pagoinfonavit", "retencioninfonavit"],
};

function asRecord(value: unknown): RecordLike | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as RecordLike;
}

function asText(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function asBoolean(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

function compactKey(value?: string | null) {
  return (value ?? "").replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function sanitizeVisibleFact(key: string, value: unknown) {
  if (isWorkerSystemStructuredField({ key, value })) return null;
  const text = asText(value);
  if (!text) return null;
  if (/^(true|false|yes|no|sí|si)$/i.test(text)) return null;
  if (/^[a-z]+(?:[_-][a-z0-9]+)+$/i.test(text)) return null;
  return text;
}

function hasVisibleValue(value: unknown) {
  if (typeof value === "boolean") return value;
  return asText(value) !== null;
}

function collectAnalysisRecords(document: DocumentLaborFiscalInput) {
  const opinion = asRecord(document.heliosOpinion);
  const rawPayload = asRecord(opinion?.rawPayload);
  const preliminaryAnalysis =
    asRecord(document.preliminaryAnalysis) ?? asRecord(rawPayload?.preliminaryAnalysis);
  const confirmedData = asRecord(preliminaryAnalysis?.confirmedData);
  const estimatedData = asRecord(preliminaryAnalysis?.estimatedData);

  return {
    opinion,
    rawPayload,
    preliminaryAnalysis,
    confirmedData,
    estimatedData,
  };
}

function readAnalysisValue(document: DocumentLaborFiscalInput, key: string) {
  const { confirmedData, estimatedData } = collectAnalysisRecords(document);
  return confirmedData?.[key] ?? estimatedData?.[key] ?? null;
}

function documentSearchHaystack(document: DocumentLaborFiscalInput) {
  const { opinion, rawPayload, confirmedData, estimatedData } = collectAnalysisRecords(document);
  return [
    document.originalName ?? "",
    document.documentType ?? "",
    asText(opinion?.summary) ?? "",
    asText(opinion?.legalOpinion) ?? "",
    JSON.stringify(confirmedData ?? {}),
    JSON.stringify(estimatedData ?? {}),
    JSON.stringify(rawPayload ?? {}),
  ]
    .join(" ")
    .toLowerCase();
}

function readAliasedFact(document: DocumentLaborFiscalInput, aliases: string[]) {
  const { confirmedData, estimatedData } = collectAnalysisRecords(document);
  for (const source of [confirmedData, estimatedData]) {
    if (!source) continue;
    for (const [key, rawValue] of Object.entries(source)) {
      if (!aliases.includes(compactKey(key))) continue;
      const value = sanitizeVisibleFact(key, rawValue);
      if (value) return value;
    }
  }
  return null;
}

function emptyFacts(): LaborFiscalStructuredFacts {
  return {
    period: null,
    netAmount: null,
    perceptions: null,
    deductions: null,
    employerRfc: null,
    workerRfc: null,
    nss: null,
    curp: null,
    employerRegistration: null,
    isrWithheld: null,
    imssWithheld: null,
    infonavitWithheld: null,
  };
}

function countVisibleFacts(facts: LaborFiscalStructuredFacts) {
  return Object.values(facts).filter((value) => value !== null).length;
}

function documentIdentityHaystack(document: DocumentLaborFiscalInput) {
  const { opinion, rawPayload, confirmedData, estimatedData } = collectAnalysisRecords(document);
  return {
    originalName: document.originalName ?? null,
    documentType: document.documentType ?? null,
    summary: asText(opinion?.summary),
    confirmedData,
    estimatedData,
    rawPayload,
  };
}

export function extractStructuredLaborFiscalFacts(
  document: DocumentLaborFiscalInput,
): LaborFiscalStructuredFacts {
  const employerRfc = readAliasedFact(document, FACT_ALIASES.employerRfc);
  const extracted = extractReceiptOfficialIdentity(documentIdentityHaystack(document));
  const workerRfc = readAliasedFact(document, FACT_ALIASES.workerRfc) ?? extracted.rfc;
  return {
    period: readAliasedFact(document, FACT_ALIASES.period),
    netAmount: readAliasedFact(document, FACT_ALIASES.netAmount),
    perceptions: readAliasedFact(document, FACT_ALIASES.perceptions),
    deductions: readAliasedFact(document, FACT_ALIASES.deductions),
    employerRfc,
    workerRfc: workerRfc && workerRfc !== employerRfc ? workerRfc : null,
    nss: readAliasedFact(document, FACT_ALIASES.nss) ?? extracted.nss,
    curp: readAliasedFact(document, FACT_ALIASES.curp) ?? extracted.curp,
    employerRegistration: readAliasedFact(document, FACT_ALIASES.employerRegistration),
    isrWithheld: readAliasedFact(document, FACT_ALIASES.isrWithheld),
    imssWithheld: readAliasedFact(document, FACT_ALIASES.imssWithheld),
    infonavitWithheld: readAliasedFact(document, FACT_ALIASES.infonavitWithheld),
  };
}

export function explainLaborFiscalFacts(facts: LaborFiscalStructuredFacts): LaborFiscalWorkerExplanation[] {
  const explanations: LaborFiscalWorkerExplanation[] = [];

  if (facts.period) {
    explanations.push({
      label: "Periodo visible",
      summary: `El periodo que se alcanza a leer es ${facts.period}. Eso sale del recibo o CFDI, no de un portal oficial.`,
    });
  } else {
    explanations.push({
      label: "Periodo visible",
      summary: "El periodo de pago no se alcanzó a leer completo en este archivo.",
    });
  }

  if (facts.netAmount) {
    explanations.push({
      label: "Pago visible",
      summary: `El pago neto que se alcanza a leer es ${facts.netAmount}. Compararlo con lo que realmente recibiste ayuda a detectar diferencias.`,
    });
  }

  if (facts.perceptions) {
    explanations.push({
      label: "Percepciones visibles",
      summary: `Las percepciones que se alcanzan a leer suman ${facts.perceptions}.`,
    });
  }

  if (facts.deductions) {
    explanations.push({
      label: "Deducciones visibles",
      summary: /^\$?0(?:\.0+)?$/i.test(facts.deductions)
        ? "El total de deducciones que se alcanza a leer es $0.00. Eso no confirma que no existan descuentos en otro documento del mismo periodo."
        : `Las deducciones que se alcanzan a leer suman ${facts.deductions}. Revisa que cada descuento esté explicado en el mismo recibo.`,
    });
  }

  if (facts.employerRfc) {
    explanations.push({
      label: humanizeStructuredFieldLabel("employerRfc"),
      summary: `El RFC del patrón que se alcanza a leer es ${facts.employerRfc}.`,
    });
  }

  if (facts.workerRfc) {
    explanations.push({
      label: "RFC de la persona trabajadora",
      summary: `El RFC de la persona trabajadora que se alcanza a leer es ${facts.workerRfc}.`,
    });
  }

  if (facts.nss || facts.employerRegistration || facts.curp) {
    const nssPart = facts.nss ? `se ve el NSS ${facts.nss}` : "no se alcanzó a leer el NSS";
    const registrationPart = facts.employerRegistration
      ? `se ve el registro patronal ${facts.employerRegistration}`
      : null;
    const curpPart = facts.curp ? `se ve la CURP ${facts.curp}` : null;
    explanations.push({
      label: "IMSS en el papel",
      summary: `${nssPart}${registrationPart ? ` y ${registrationPart}` : ""}${curpPart ? `. También ${curpPart}` : ""}. Esto sale de tus papeles; no confirma alta, vigencia ni semanas cotizadas ante IMSS.`,
    });
  }

  const retentions = [
    facts.isrWithheld ? `ISR ${facts.isrWithheld}` : null,
    facts.imssWithheld ? `IMSS ${facts.imssWithheld}` : null,
    facts.infonavitWithheld ? `Infonavit ${facts.infonavitWithheld}` : null,
  ].filter((item): item is string => Boolean(item));

  if (retentions.length > 0) {
    explanations.push({
      label: "Retenciones visibles",
      summary: `Se alcanzan a leer estas retenciones o descuentos: ${retentions.join(", ")}. Verlas en el recibo no prueba que el patrón las haya enterado al SAT, IMSS o Infonavit.`,
    });
  }

  explanations.push({
    label: "Límite de esta lectura",
    summary: DOCUMENT_SIGNAL_DISCLAIMER,
  });

  return explanations;
}

export function isPreferredRemoteWorkerOpinion(opinion: unknown) {
  const record = asRecord(opinion);
  if (!record) return false;
  if (asText(record.mode) !== "remote") return false;
  const status = asText(record.status);
  if (status && !["completed", "partial"].includes(status)) return false;
  return Boolean(asText(record.legalOpinion) || asText(record.summary) || asRecord(record.resultCard));
}

export function pickPreferredWorkerOpinion(opinions: unknown[]) {
  const records = opinions.map(asRecord).filter((item): item is RecordLike => item !== null);
  return records.find((item) => isPreferredRemoteWorkerOpinion(item)) ?? records[0] ?? null;
}

export function describeWorkerReviewSource(opinion?: unknown): WorkerReviewSourceSnapshot {
  const record = asRecord(opinion);
  const mode = asText(record?.mode);
  const status = asText(record?.status);

  if (mode === "remote" && (status === "completed" || status === "partial" || !status)) {
    return {
      reviewSource: "remote",
      reviewSourceLabel: REMOTE_REVIEW_LABEL,
      reviewSourceExplanation:
        "Esta lectura ya viene de la revisión avanzada del documento. No consulta IMSS, SAT ni Infonavit en vivo.",
    };
  }

  if (mode === "remote" && (status === "processing" || status === "sent")) {
    return {
      reviewSource: "remote",
      reviewSourceLabel: "Revisión avanzada en curso",
      reviewSourceExplanation:
        "Tu archivo sí quedó guardado. La revisión avanzada todavía no termina. No inventamos un dictamen.",
    };
  }

  if (mode === "remote") {
    return {
      reviewSource: "remote",
      reviewSourceLabel: "Revisión avanzada incompleta",
      reviewSourceExplanation:
        "El archivo sí quedó guardado, pero la revisión avanzada no se completó. No hay un dictamen inventado.",
    };
  }

  return {
    reviewSource: "local",
    reviewSourceLabel: LOCAL_REVIEW_LABEL,
    reviewSourceExplanation:
      "Esta es una revisión local de lo que ya se lee en tus papeles. No consulta IMSS, SAT ni Infonavit en vivo.",
  };
}

export function extractLaborFiscalSignalsFromDocument(
  document: DocumentLaborFiscalInput,
): LaborFiscalSignalSnapshot {
  const documentType = asText(document.documentType);
  const facts = extractStructuredLaborFiscalFacts(document);
  const hasImssDocument = documentType === "imss";
  const hasImssWithholding = hasVisibleValue(readAnalysisValue(document, "imssWithheld")) || Boolean(facts.imssWithheld);
  const hasNss = hasVisibleValue(readAnalysisValue(document, "payrollNss")) || Boolean(facts.nss);
  const hasEmployerRegistration =
    hasVisibleValue(readAnalysisValue(document, "payrollEmployerRegistration")) ||
    Boolean(facts.employerRegistration);
  const hasSbc = hasVisibleValue(readAnalysisValue(document, "socialSecurityBaseSalary"));
  const hasSdi = hasVisibleValue(readAnalysisValue(document, "integratedDailySalary"));
  const hasIsrWithholding = hasVisibleValue(readAnalysisValue(document, "isrWithheld")) || Boolean(facts.isrWithheld);
  const infonavitAmountVisible =
    hasVisibleValue(readAnalysisValue(document, "infonavitWithheld")) || Boolean(facts.infonavitWithheld);
  const explicitInfonavitFlag =
    asBoolean(readAnalysisValue(document, "hasInfonavitSignal")) === true ||
    asText(readAnalysisValue(document, "infonavitDeductionType")) === "010";
  const haystack = documentSearchHaystack(document);
  const hasInfonavitDeduction =
    infonavitAmountVisible || explicitInfonavitFlag || haystack.includes("infonavit");
  const hasImssLaborSignal =
    hasImssDocument ||
    hasImssWithholding ||
    hasNss ||
    hasEmployerRegistration ||
    hasSbc ||
    hasSdi ||
    /\b(imss|nss|sbc|sdi|registro patronal|salario base de cotizacion)\b/.test(haystack);

  return {
    liveImssValidation: false,
    source: LABOR_FISCAL_SIGNAL_SOURCE,
    validationMode: LABOR_FISCAL_VALIDATION_MODE,
    documentType,
    hasImssDocument,
    hasImssWithholding,
    hasNss,
    hasEmployerRegistration,
    hasSbc,
    hasSdi,
    hasIsrWithholding,
    hasInfonavitDeduction,
    hasImssLaborSignal,
    hasInfonavitSignal: hasInfonavitDeduction,
    hasFiscalSignal: hasIsrWithholding,
    facts,
    explanations: explainLaborFiscalFacts(facts),
  };
}

export function summarizeLaborFiscalSignals(documents: DocumentLaborFiscalInput[]) {
  const snapshots = documents.map((document) => extractLaborFiscalSignalsFromDocument(document));
  const imssDocumentsCount = snapshots.filter((item) => item.hasImssDocument).length;
  const imssSignalsCount = snapshots.filter((item) => item.hasImssLaborSignal).length;
  const infonavitSignalsCount = snapshots.filter((item) => item.hasInfonavitSignal).length;
  const fiscalSignalsCount = snapshots.filter((item) => item.hasFiscalSignal).length;
  const richestSnapshot = [...snapshots].sort(
    (left, right) => countVisibleFacts(right.facts) - countVisibleFacts(left.facts),
  )[0];
  const preferredOpinion = pickPreferredWorkerOpinion(documents.map((document) => document.heliosOpinion));

  return {
    liveImssValidation: false as const,
    source: LABOR_FISCAL_SIGNAL_SOURCE,
    validationMode: LABOR_FISCAL_VALIDATION_MODE,
    snapshots,
    imssDocumentsCount,
    imssSignalsCount,
    infonavitSignalsCount,
    fiscalSignalsCount,
    hasImssSignal: imssSignalsCount > 0,
    hasInfonavitSignal: infonavitSignalsCount > 0,
    hasFiscalSignal: fiscalSignalsCount > 0,
    facts: richestSnapshot?.facts ?? emptyFacts(),
    explanations: richestSnapshot?.explanations ?? explainLaborFiscalFacts(emptyFacts()),
    ...describeWorkerReviewSource(preferredOpinion),
  };
}

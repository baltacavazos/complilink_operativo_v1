type RecordLike = Record<string, unknown>;

export const LABOR_FISCAL_SIGNAL_SOURCE = "document_text" as const;
export const LABOR_FISCAL_VALIDATION_MODE = "document_signals" as const;

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
};

export type DocumentLaborFiscalInput = {
  documentType?: string | null;
  originalName?: string | null;
  heliosOpinion?: unknown;
  preliminaryAnalysis?: unknown;
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

export function extractLaborFiscalSignalsFromDocument(
  document: DocumentLaborFiscalInput,
): LaborFiscalSignalSnapshot {
  const documentType = asText(document.documentType);
  const hasImssDocument = documentType === "imss";
  const hasImssWithholding = hasVisibleValue(readAnalysisValue(document, "imssWithheld"));
  const hasNss = hasVisibleValue(readAnalysisValue(document, "payrollNss"));
  const hasEmployerRegistration = hasVisibleValue(
    readAnalysisValue(document, "payrollEmployerRegistration"),
  );
  const hasSbc = hasVisibleValue(readAnalysisValue(document, "socialSecurityBaseSalary"));
  const hasSdi = hasVisibleValue(readAnalysisValue(document, "integratedDailySalary"));
  const hasIsrWithholding = hasVisibleValue(readAnalysisValue(document, "isrWithheld"));
  const infonavitAmountVisible = hasVisibleValue(readAnalysisValue(document, "infonavitWithheld"));
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
  };
}

export function summarizeLaborFiscalSignals(documents: DocumentLaborFiscalInput[]) {
  const snapshots = documents.map((document) => extractLaborFiscalSignalsFromDocument(document));
  const imssDocumentsCount = snapshots.filter((item) => item.hasImssDocument).length;
  const imssSignalsCount = snapshots.filter((item) => item.hasImssLaborSignal).length;
  const infonavitSignalsCount = snapshots.filter((item) => item.hasInfonavitSignal).length;
  const fiscalSignalsCount = snapshots.filter((item) => item.hasFiscalSignal).length;

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
  };
}

export const DOCUMENT_SIGNAL_DISCLAIMER =
  "Esto no consulta IMSS, SAT ni Infonavit en vivo. Solo lee lo que ya aparece en tus documentos.";

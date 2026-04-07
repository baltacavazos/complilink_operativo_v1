import { createHash, randomUUID } from "node:crypto";

export const CASE_STATUSES = [
  "intake",
  "analysis",
  "conciliation",
  "litigation",
  "resolved",
  "archived",
] as const;

export const CASE_PRIORITIES = ["low", "medium", "high", "critical"] as const;

export const DOCUMENT_TYPES = [
  "payroll_receipt",
  "cfdi",
  "imss",
  "contract",
  "settlement",
  "evidence",
  "other",
] as const;

export const DOCUMENT_VISIBILITIES = [
  "case_team",
  "tenant_legal",
  "tenant_hr",
  "restricted",
] as const;

export const CONSENT_STATUSES = [
  "pending",
  "granted",
  "revoked",
  "expired",
  "not_required",
] as const;

export type CaseStatus = (typeof CASE_STATUSES)[number];
export type CasePriority = (typeof CASE_PRIORITIES)[number];
export type DocumentType = (typeof DOCUMENT_TYPES)[number];
export type DocumentVisibility = (typeof DOCUMENT_VISIBILITIES)[number];
export type ConsentStatus = (typeof CONSENT_STATUSES)[number];
export type ReviewRecommendation = "auto" | "human_review" | "legal_review";
export type ProcessingProfile = "standard" | "expanded" | "contract_deep_dive";
export type AnalysisValue = string | number | boolean | null;

export type DocumentClassification = {
  documentType: DocumentType;
  normalizedDocType: string;
  classificationConfidence: number;
  reasons: string[];
  processingProfile: ProcessingProfile;
  reviewRecommendation: ReviewRecommendation;
  supportsStructuredExtraction: boolean;
  supportsBenefitEstimation: boolean;
};

export type PreliminaryLaborAnalysis = {
  normalizedDocType: string;
  simpleLabel: string;
  processingProfile: ProcessingProfile;
  summary: string;
  confirmedData: Record<string, AnalysisValue>;
  estimatedData: Record<string, AnalysisValue>;
  extractionTargets: string[];
  guardrails: string[];
};

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function hasAny(haystack: string, ...terms: string[]) {
  return terms.some((term) => haystack.includes(normalizeText(term)));
}

function slugifyDocType(value: string) {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48) || "documento_laboral";
}

function extractRfc(text: string) {
  const match = text.match(/\b([A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3})\b/i);
  return match?.[1]?.toUpperCase() ?? null;
}

function extractPeriod(text: string) {
  const isoMatch = text.match(/\b(20\d{2}[-/](0[1-9]|1[0-2]))\b/);
  if (isoMatch?.[1]) {
    return isoMatch[1].replace("/", "-");
  }

  const monthMatch = text.match(/\b(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\s+(20\d{2})\b/i);
  if (!monthMatch) return null;

  const monthMap: Record<string, string> = {
    enero: "01",
    febrero: "02",
    marzo: "03",
    abril: "04",
    mayo: "05",
    junio: "06",
    julio: "07",
    agosto: "08",
    septiembre: "09",
    setiembre: "09",
    octubre: "10",
    noviembre: "11",
    diciembre: "12",
  };

  const month = monthMap[normalizeText(monthMatch[1])];
  return month ? `${monthMatch[2]}-${month}` : null;
}

function extractMoney(text: string) {
  const match = text.match(/\$\s?\d[\d,]*(?:\.\d{2})?/);
  return match?.[0]?.replace(/\s+/g, "") ?? null;
}

function extractDate(text: string) {
  const match = text.match(/\b(\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4})\b/);
  return match?.[1] ?? null;
}

function extractNamedField(text: string, labels: string[]) {
  const normalizedLabels = labels.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const regex = new RegExp(`(?:${normalizedLabels.join("|")})\\s*[:\\-]\\s*([A-Za-zÁÉÍÓÚÑáéíóúñ0-9 .,&-]{3,80})`, "i");
  const match = text.match(regex);
  return match?.[1]?.trim() ?? null;
}

function buildClassification(params: {
  documentType: DocumentType;
  normalizedDocType: string;
  classificationConfidence: number;
  reason: string;
  processingProfile: ProcessingProfile;
  reviewRecommendation: ReviewRecommendation;
  supportsStructuredExtraction: boolean;
  supportsBenefitEstimation: boolean;
  extraReasons?: string[];
}): DocumentClassification {
  return {
    documentType: params.documentType,
    normalizedDocType: params.normalizedDocType,
    classificationConfidence: params.classificationConfidence,
    reasons: [params.reason, ...(params.extraReasons ?? [])],
    processingProfile: params.processingProfile,
    reviewRecommendation: params.reviewRecommendation,
    supportsStructuredExtraction: params.supportsStructuredExtraction,
    supportsBenefitEstimation: params.supportsBenefitEstimation,
  };
}

export function computeSha256(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

export function decodeBase64File(input: string) {
  const normalized = input.includes(",") ? input.split(",").pop() ?? "" : input;
  return Buffer.from(normalized, "base64");
}

export function buildDocumentId() {
  return `DOC-${randomUUID().replace(/-/g, "").slice(0, 16).toUpperCase()}`;
}

export function sanitizeFileName(fileName: string) {
  const cleaned = fileName.trim().replace(/[^a-zA-Z0-9._-]+/g, "-");
  return cleaned.length > 0 ? cleaned : "document.bin";
}

export function buildDocumentStorageKey(params: {
  tenantId: string;
  caseId: string;
  documentId: string;
  fileName: string;
}) {
  const safeName = sanitizeFileName(params.fileName);
  return `complilink/${params.tenantId}/${params.caseId}/${params.documentId}/${safeName}`;
}

export function classifyMexicanLaborDocument(params: {
  fileName: string;
  mimeType: string;
  textHint?: string | null;
}): DocumentClassification {
  const haystack = normalizeText(`${params.fileName} ${params.mimeType} ${params.textHint ?? ""}`);

  if (hasAny(haystack, "cfdi", "xml", "factura", "timbre fiscal", "sat", "uuid")) {
    return buildClassification({
      documentType: "cfdi",
      normalizedDocType: "cfdi_nomina",
      classificationConfidence: 91,
      reason: "Se detectaron marcadores típicos de CFDI o timbrado fiscal.",
      processingProfile: "standard",
      reviewRecommendation: "auto",
      supportsStructuredExtraction: true,
      supportsBenefitEstimation: true,
    });
  }

  if (hasAny(haystack, "imss", "nss", "alta", "baja", "semanas cotizadas", "sipare", "seguro social")) {
    return buildClassification({
      documentType: "imss",
      normalizedDocType: "constancia_imss",
      classificationConfidence: 88,
      reason: "Se detectaron referencias operativas del IMSS o seguridad social.",
      processingProfile: "standard",
      reviewRecommendation: "auto",
      supportsStructuredExtraction: true,
      supportsBenefitEstimation: true,
    });
  }

  if (hasAny(haystack, "nomina", "nómina", "recibo", "payroll", "quincena", "semanal", "percepciones", "deducciones")) {
    return buildClassification({
      documentType: "payroll_receipt",
      normalizedDocType: "recibo_nomina",
      classificationConfidence: 86,
      reason: "Se detectaron indicadores de recibos de nómina o pagos laborales.",
      processingProfile: "standard",
      reviewRecommendation: "auto",
      supportsStructuredExtraction: true,
      supportsBenefitEstimation: true,
    });
  }

  if (hasAny(haystack, "contrato", "oferta laboral", "relacion laboral", "relación laboral", "periodo de prueba", "jornada", "prestaciones")) {
    return buildClassification({
      documentType: "contract",
      normalizedDocType: "contrato_laboral",
      classificationConfidence: 84,
      reason: "Se detectaron términos de contratación o relación laboral.",
      processingProfile: "contract_deep_dive",
      reviewRecommendation: "legal_review",
      supportsStructuredExtraction: true,
      supportsBenefitEstimation: true,
    });
  }

  if (hasAny(haystack, "finiquito", "liquidacion", "liquidación", "terminacion", "terminación", "severance", "renuncia", "rescisión", "rescision")) {
    return buildClassification({
      documentType: "settlement",
      normalizedDocType: hasAny(haystack, "liquidacion", "liquidación") ? "liquidacion_laboral" : "finiquito",
      classificationConfidence: 81,
      reason: "Se detectaron referencias a terminación laboral o liquidación.",
      processingProfile: "expanded",
      reviewRecommendation: "legal_review",
      supportsStructuredExtraction: true,
      supportsBenefitEstimation: true,
    });
  }

  if (hasAny(haystack, "infonavit", "credito vivienda", "estado de cuenta infonavit")) {
    return buildClassification({
      documentType: "other",
      normalizedDocType: "constancia_infonavit",
      classificationConfidence: 78,
      reason: "Se detectaron referencias de crédito o estado de cuenta INFONAVIT.",
      processingProfile: "expanded",
      reviewRecommendation: "human_review",
      supportsStructuredExtraction: true,
      supportsBenefitEstimation: false,
    });
  }

  if (hasAny(haystack, "opinion de cumplimiento", "cumplimiento fiscal", "positivo", "negativo sat")) {
    return buildClassification({
      documentType: "other",
      normalizedDocType: "opinion_cumplimiento",
      classificationConfidence: 74,
      reason: "Se detectaron referencias a una opinión de cumplimiento fiscal.",
      processingProfile: "expanded",
      reviewRecommendation: "human_review",
      supportsStructuredExtraction: true,
      supportsBenefitEstimation: false,
    });
  }

  if (hasAny(haystack, "evidencia", "correo", "email", "whatsapp", "captura", "screen", "screenshot", "chat", "acta", "mensaje", "asistencia", "horario", "bitacora", "bitácora")) {
    return buildClassification({
      documentType: "evidence",
      normalizedDocType: hasAny(haystack, "correo", "email")
        ? "correo_laboral"
        : hasAny(haystack, "whatsapp", "chat", "mensaje")
          ? "chat_laboral"
          : hasAny(haystack, "captura", "screen", "screenshot")
            ? "captura_pantalla"
            : "evidencia_laboral",
      classificationConfidence: 68,
      reason: "Se detectaron señales de evidencia complementaria del expediente.",
      processingProfile: "expanded",
      reviewRecommendation: "human_review",
      supportsStructuredExtraction: true,
      supportsBenefitEstimation: false,
    });
  }

  return buildClassification({
    documentType: "other",
    normalizedDocType: slugifyDocType(params.fileName.replace(/\.[^.]+$/, "") || "documento_laboral"),
    classificationConfidence: 45,
    reason: "No hubo suficientes marcadores para una clasificación exacta, pero se conserva como documento laboral analizable.",
    processingProfile: "expanded",
    reviewRecommendation: "human_review",
    supportsStructuredExtraction: true,
    supportsBenefitEstimation: false,
    extraReasons: ["Se recomienda revisión humana para confirmar el subtipo documental antes de usarlo como evidencia crítica."],
  });
}

export function buildPreliminaryLaborAnalysis(params: {
  fileName: string;
  mimeType: string;
  textHint?: string | null;
  classification?: DocumentClassification;
}): PreliminaryLaborAnalysis {
  const classification = params.classification ?? classifyMexicanLaborDocument(params);
  const sourceText = `${params.fileName} ${params.textHint ?? ""}`;
  const normalizedText = normalizeText(sourceText);

  const estimatedData: Record<string, AnalysisValue> = {
    employerRfc: extractRfc(sourceText),
    period: extractPeriod(sourceText),
    apparentAmount: extractMoney(sourceText),
    apparentEffectiveDate: extractDate(sourceText),
    workerName: extractNamedField(sourceText, ["trabajador", "empleado", "colaborador"]),
    employerName: extractNamedField(sourceText, ["patron", "patrón", "empresa", "empleador"]),
    jobTitle: extractNamedField(sourceText, ["puesto", "cargo"]),
  };

  const confirmedData: Record<string, AnalysisValue> = {
    fileName: params.fileName,
    mimeType: params.mimeType,
    internalDocumentType: classification.documentType,
    normalizedDocType: classification.normalizedDocType,
    processingProfile: classification.processingProfile,
    structuredExtractionReady: classification.supportsStructuredExtraction,
    benefitEstimationReady: classification.supportsBenefitEstimation,
  };

  const extractionTargets = (() => {
    switch (classification.documentType) {
      case "contract":
        return [
          "puesto",
          "salario pactado",
          "jornada",
          "fecha de ingreso",
          "duración o vigencia",
          "prestaciones",
          "vacaciones",
          "aguinaldo",
          "prima vacacional",
          "cláusulas de terminación",
        ];
      case "settlement":
        return [
          "motivo de terminación",
          "fecha de baja",
          "conceptos pagados",
          "monto total",
          "vacaciones pendientes",
          "prima vacacional",
          "aguinaldo proporcional",
          "indemnización",
        ];
      case "payroll_receipt":
      case "cfdi":
        return ["RFC patrón", "RFC trabajador", "periodo", "salario", "percepciones", "deducciones"];
      case "imss":
        return ["NSS", "fecha de alta", "salario base", "semanas cotizadas"];
      default:
        return ["tipo documental", "fechas relevantes", "personas involucradas", "hechos laborales relevantes"];
    }
  })();

  const summary = (() => {
    if (classification.documentType === "contract") {
      return "Parece un contrato laboral. Puede revisarse salario, puesto, jornada, vigencia y prestaciones, dejando por separado lo confirmado y lo estimado.";
    }
    if (classification.documentType === "settlement") {
      return "Parece un documento de terminación o pago final. Puede revisarse qué conceptos se liquidaron y cuáles solo parecen estimados.";
    }
    if (classification.documentType === "payroll_receipt" || classification.documentType === "cfdi") {
      return "Parece un comprobante de pago laboral. Puede usarse para extraer periodo, percepciones, deducciones y señales salariales.";
    }
    if (classification.documentType === "imss") {
      return "Parece un documento de seguridad social. Puede ayudar a revisar alta, salario registrado y semanas cotizadas.";
    }
    return "El documento parece laboralmente relevante y puede pasar a análisis ampliado con revisión humana si hace falta confirmar el subtipo.";
  })();

  const guardrails = [
    "Los datos en 'confirmedData' solo reflejan lo efectivamente observado en metadatos y clasificación actual.",
    "Los datos en 'estimatedData' son indicios preliminares y no deben presentarse como hechos confirmados ni como asesoría legal.",
  ];

  if (classification.reviewRecommendation !== "auto") {
    guardrails.push("Este documento requiere revisión humana antes de usar conclusiones sensibles en decisiones operativas o jurídicas.");
  }

  if (classification.documentType === "contract" || classification.documentType === "settlement") {
    guardrails.push("Cualquier cálculo preliminar de prestaciones debe mostrarse como estimación y dependerá del contenido completo del documento.");
  }

  if (hasAny(normalizedText, "ilegible", "borroso", "incompleto")) {
    guardrails.push("El texto sugiere que el documento podría estar incompleto o ser difícil de leer, por lo que la confianza real puede ser menor.");
  }

  return {
    normalizedDocType: classification.normalizedDocType,
    simpleLabel: classification.normalizedDocType.replace(/_/g, " "),
    processingProfile: classification.processingProfile,
    summary,
    confirmedData,
    estimatedData,
    extractionTargets,
    guardrails,
  };
}

export function buildCanonicalCaseContract(params: {
  tenantId: string;
  caseId: string;
  traceId: string;
  title: string;
  status: CaseStatus;
  priority: CasePriority;
  employeeName?: string | null;
  employerEntity?: string | null;
  summary?: string | null;
}) {
  return {
    contract_type: "case",
    schema_version: "v1",
    tenant_id: params.tenantId,
    case_id: params.caseId,
    trace_id: params.traceId,
    title: params.title,
    status: params.status,
    priority: params.priority,
    employee_name: params.employeeName ?? null,
    employer_entity: params.employerEntity ?? null,
    summary: params.summary ?? null,
    jurisdiction: "MX",
  };
}

export function buildCanonicalDocumentContract(params: {
  tenantId: string;
  caseId: string;
  traceId: string;
  documentId: string;
  documentType: DocumentType;
  sha256: string;
  storageKey: string;
  storageUrl: string;
  visibility: DocumentVisibility;
  consentStatus: ConsentStatus | "revoked" | "granted" | "pending" | "not_required";
  classificationConfidence: number;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
}) {
  return {
    contract_type: "document",
    schema_version: "v1",
    tenant_id: params.tenantId,
    case_id: params.caseId,
    trace_id: params.traceId,
    document_id: params.documentId,
    document_type: params.documentType,
    sha256: params.sha256,
    storage_key: params.storageKey,
    storage_url: params.storageUrl,
    visibility: params.visibility,
    consent_status: params.consentStatus,
    classification_confidence: params.classificationConfidence,
    original_name: params.originalName,
    mime_type: params.mimeType,
    size_bytes: params.sizeBytes,
    country: "MX",
  };
}

export function buildCanonicalConsentContract(params: {
  tenantId: string;
  caseId: string;
  traceId: string;
  documentId?: string | null;
  subjectName: string;
  status: ConsentStatus;
  legalBasis?: string | null;
}) {
  return {
    contract_type: "consent",
    schema_version: "v1",
    tenant_id: params.tenantId,
    case_id: params.caseId,
    trace_id: params.traceId,
    document_id: params.documentId ?? null,
    subject_name: params.subjectName,
    status: params.status,
    legal_basis: params.legalBasis ?? null,
  };
}

export function buildSharedEngineEnvelope(params: {
  tenantId: string;
  caseId: string;
  traceId: string;
  caseContract: ReturnType<typeof buildCanonicalCaseContract>;
  documentContracts: Array<ReturnType<typeof buildCanonicalDocumentContract>>;
}) {
  return {
    contract_type: "shared_engine",
    schema_version: "v1",
    tenant_id: params.tenantId,
    case_id: params.caseId,
    trace_id: params.traceId,
    case_contract: params.caseContract,
    document_contracts: params.documentContracts,
    ready_for_shared_engine: true,
  };
}

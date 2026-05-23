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

export type HeliosExpedienteStage = "intake" | "analysis" | "recommendations" | "closed";
export type HeliosDocumentStatus = "pending_ingestion" | "analyzing" | "ready";

const HELIOS_CANONICAL_DOCUMENT_TYPES: Record<DocumentType, { canonicalType: string; canonicalLabel: string }> = {
  payroll_receipt: {
    canonicalType: "recibo_nomina",
    canonicalLabel: "Recibo de nómina",
  },
  cfdi: {
    canonicalType: "cfdi_nomina",
    canonicalLabel: "CFDI de nómina",
  },
  imss: {
    canonicalType: "constancia_imss",
    canonicalLabel: "Soporte IMSS",
  },
  contract: {
    canonicalType: "contrato_laboral",
    canonicalLabel: "Contrato laboral",
  },
  settlement: {
    canonicalType: "liquidacion_laboral",
    canonicalLabel: "Liquidación o finiquito",
  },
  evidence: {
    canonicalType: "evidencia_laboral",
    canonicalLabel: "Evidencia laboral",
  },
  other: {
    canonicalType: "documento_laboral",
    canonicalLabel: "Documento laboral",
  },
};

export function getHeliosCanonicalDocumentDescriptor(documentType: DocumentType, normalizedDocType?: string | null) {
  const fallback = HELIOS_CANONICAL_DOCUMENT_TYPES[documentType] ?? HELIOS_CANONICAL_DOCUMENT_TYPES.other;
  const canonicalType = normalizedDocType?.trim().length ? normalizedDocType.trim() : fallback.canonicalType;

  return {
    canonicalType,
    canonicalLabel: fallback.canonicalLabel,
  };
}

export function getHeliosExpedienteStage(params: {
  caseStatus: CaseStatus;
  documentsCount: number;
  documentsWithOpinion: number;
  closedAt?: Date | string | null;
}) {
  if (params.closedAt || params.caseStatus === "resolved" || params.caseStatus === "archived") {
    return {
      stage: "closed" as const,
      stageLabel: "Cerrado",
      summary: "Este expediente ya recorrió su ciclo principal dentro de Helios y conserva su trazabilidad documental para futuras consultas.",
    };
  }

  if (
    params.documentsWithOpinion > 0 ||
    params.caseStatus === "conciliation" ||
    params.caseStatus === "litigation"
  ) {
    return {
      stage: "recommendations" as const,
      stageLabel: "Con lectura activa",
      summary: "Helios ya conectó documentos del expediente y está devolviendo una lectura preliminar con señales y siguientes pasos útiles.",
    };
  }

  if (params.documentsCount > 0 || params.caseStatus === "analysis") {
    return {
      stage: "analysis" as const,
      stageLabel: "Analizando",
      summary: "Helios ya recibió documentos del expediente y está ordenando la información para devolverte una lectura más clara.",
    };
  }

  return {
    stage: "intake" as const,
    stageLabel: "Listo para iniciar",
    summary: "Tu expediente Helios ya existe y está listo para empezar a ordenarse en cuanto subas el primer documento laboral útil.",
  };
}

export function getHeliosDocumentState(params: {
  documentType: DocumentType;
  normalizedDocType?: string | null;
  hasOpinion: boolean;
  processedAt?: Date | string | null;
}) {
  const descriptor = getHeliosCanonicalDocumentDescriptor(params.documentType, params.normalizedDocType);

  if (params.hasOpinion) {
    return {
      ...descriptor,
      status: "ready" as const,
      statusLabel: "Lectura lista",
      summary: "Helios ya integró una lectura preliminar para este documento dentro del expediente.",
    };
  }

  if (params.processedAt) {
    return {
      ...descriptor,
      status: "analyzing" as const,
      statusLabel: "Analizando",
      summary: "Helios ya clasificó este documento y sigue avanzando con su lectura dentro del expediente.",
    };
  }

  return {
    ...descriptor,
    status: "pending_ingestion" as const,
    statusLabel: "Pendiente de lectura",
    summary: "Este documento ya forma parte del expediente Helios y quedará listo conforme avance su lectura automática.",
  };
}

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

function fileNameLooksLikeUuid(value: string) {
  const cleaned = value.replace(/\.[^.]+$/, "");
  return /(?:^|[^a-z0-9])[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}(?:[^a-z0-9]|$)/i.test(cleaned);
}

function extractInfonavitDeductionType(text: string) {
  const match = text.match(/TipoDeduccion\s*=\s*["']?(010)["']?/i);
  return match?.[1] ?? null;
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

function normalizeBase64Payload(input: string) {
  return (input.includes(",") ? input.split(",").pop() ?? "" : input).replace(/\s+/g, "");
}

function assertValidBase64Payload(base64Payload: string) {
  if (!base64Payload || base64Payload.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64Payload)) {
    throw new Error("El archivo no tiene un contenido base64 válido. Vuelve a cargarlo antes de revisarlo.");
  }
}

function estimateDecodedByteLength(base64Payload: string) {
  if (!base64Payload) return 0;
  const padding = base64Payload.endsWith("==") ? 2 : base64Payload.endsWith("=") ? 1 : 0;
  return Math.floor((base64Payload.length * 3) / 4) - padding;
}

function formatFileSizeLimit(maxBytes: number) {
  if (maxBytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(maxBytes / 1024))} KB`;
  }

  return `${Math.round(maxBytes / (1024 * 1024))} MB`;
}

export function decodeBase64File(input: string, options?: { maxBytes?: number }) {
  const normalized = normalizeBase64Payload(input);
  assertValidBase64Payload(normalized);
  const estimatedBytes = estimateDecodedByteLength(normalized);

  if (options?.maxBytes && estimatedBytes > options.maxBytes) {
    throw new Error(
      `El archivo supera el límite de ${formatFileSizeLimit(options.maxBytes)} para esta revisión inicial. Súbelo en una versión más ligera.`,
    );
  }

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
  const uuidNamedPdf = params.mimeType === "application/pdf" && fileNameLooksLikeUuid(params.fileName);
  const normalizedMimeType = params.mimeType.trim().toLowerCase();
  const isXmlLikeFile = normalizedMimeType === "application/xml" || normalizedMimeType === "text/xml" || params.fileName.toLowerCase().endsWith(".xml");
  const hasCoreContractSignals = hasAny(
    haystack,
    "contrato",
    "oferta laboral",
    "relacion laboral",
    "relación laboral",
    "periodo de prueba",
    "jornada",
    "prestaciones",
    "puesto",
    "salario diario",
    "salario base",
    "fecha de ingreso",
  );
  const hasEmploymentParties = hasAny(haystack, "patron", "patrón") && hasAny(haystack, "trabajador", "empleado");
  const hasContractSignals = hasCoreContractSignals || (hasEmploymentParties && hasAny(haystack, "jornada", "prestaciones", "salario diario", "fecha de ingreso", "puesto"));
  const hasStrongCfdiSignals = hasAny(
    haystack,
    "cfdi",
    "timbre fiscal",
    "folio fiscal",
    "uuid",
    "representacion impresa",
    "representación impresa",
    "comprobante fiscal",
    "nomina12",
    "nomina 12",
  ) || (isXmlLikeFile && hasAny(haystack, "sat", "factura", "comprobante", "percepciones", "deducciones", "emisor", "receptor"));

  if (isXmlLikeFile && hasStrongCfdiSignals) {
    return buildClassification({
      documentType: "cfdi",
      normalizedDocType: "cfdi_nomina",
      classificationConfidence: 91,
      reason: "El archivo XML contiene marcadores típicos de CFDI de nómina o timbrado fiscal.",
      processingProfile: "standard",
      reviewRecommendation: "auto",
      supportsStructuredExtraction: true,
      supportsBenefitEstimation: true,
    });
  }

  if (hasContractSignals) {
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

  if (hasStrongCfdiSignals) {
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

  if (
    hasAny(haystack, "nomina", "nómina", "recibo", "payroll", "quincena", "semanal", "percepciones", "deducciones", "folio fiscal", "representacion impresa", "representación impresa", "comprobante fiscal") ||
    uuidNamedPdf
  ) {
    return buildClassification({
      documentType: "payroll_receipt",
      normalizedDocType: uuidNamedPdf ? "recibo_nomina_cfdi_pdf" : "recibo_nomina",
      classificationConfidence: uuidNamedPdf ? 82 : 86,
      reason: uuidNamedPdf
        ? "El PDF usa un nombre tipo UUID frecuente en representaciones impresas de CFDI o recibos de nómina."
        : "Se detectaron indicadores de recibos de nómina o pagos laborales.",
      processingProfile: "standard",
      reviewRecommendation: "auto",
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

  const infonavitDeductionType = extractInfonavitDeductionType(sourceText);
  const hasInfonavitSignal =
    infonavitDeductionType === "010" ||
    normalizedText.includes("pago infonavit") ||
    normalizedText.includes("credito infonavit") ||
    normalizedText.includes("crédito infonavit") ||
    normalizedText.includes("infonavit");

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
    hasInfonavitSignal,
    infonavitDeductionType,
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
        return ["RFC patrón", "RFC trabajador", "periodo", "salario", "percepciones", "deducciones", "INFONAVIT"];
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
      return hasInfonavitSignal
        ? "Parece un comprobante de pago laboral con señales visibles de INFONAVIT. Puede usarse para extraer periodo, percepciones, deducciones y validar seguridad social."
        : "Parece un comprobante de pago laboral. Puede usarse para extraer periodo, percepciones, deducciones y señales salariales.";
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

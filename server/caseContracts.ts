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
      summary: "Este expediente ya recorrió su ciclo principal y conserva su trazabilidad documental para futuras consultas.",
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
      summary: "El asesor laboral ya conectó documentos del expediente y está devolviendo una lectura preliminar con señales y siguientes pasos útiles.",
    };
  }

  if (params.documentsCount > 0 || params.caseStatus === "analysis") {
    return {
      stage: "analysis" as const,
      stageLabel: "Analizando",
      summary: "El asesor laboral ya recibió documentos del expediente y está ordenando la información para devolverte una lectura más clara.",
    };
  }

  return {
    stage: "intake" as const,
    stageLabel: "Listo para iniciar",
    summary: "Tu expediente laboral ya existe y está listo para empezar a ordenarse en cuanto subas el primer documento laboral útil.",
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
      summary: "El asesor laboral ya integró una lectura preliminar para este documento dentro del expediente.",
    };
  }

  if (params.processedAt) {
    return {
      ...descriptor,
      status: "analyzing" as const,
      statusLabel: "Analizando",
      summary: "El asesor laboral ya clasificó este documento y sigue avanzando con su lectura dentro del expediente.",
    };
  }

  return {
    ...descriptor,
    status: "pending_ingestion" as const,
    statusLabel: "Pendiente de lectura",
    summary: "Este documento ya forma parte del expediente laboral y quedará listo conforme avance su lectura automática.",
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

function extractXmlAttribute(text: string, attributeName: string) {
  const escapedName = attributeName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = text.match(new RegExp(`${escapedName}\\s*=\\s*["']([^"']+)["']`, "i"));
  return match?.[1] ?? null;
}

function extractXmlTags(text: string, localName: string) {
  const escapedName = localName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.match(new RegExp(`<[^>]*\\b${escapedName}\\b[^>]*>`, "gi")) ?? [];
}

/** Conserva Emisor/Receptor/Nómina si el certificado empuja el complemento fuera del recorte. */
export function derivePayrollXmlTextHint(xml: string) {
  const compact = xml.replace(/^\uFEFF/, "").replace(/\s+/g, " ").trim();
  const identityTags = (compact.match(/<[^>]*\b(?:Emisor|Receptor|Nomina)\b[^>]*>/gi) ?? []).join(" ");
  const head = compact.slice(0, 6000);
  if (!identityTags || head.includes(identityTags)) return head;
  return `${head} ${identityTags}`.replace(/\s+/g, " ").trim().slice(0, 20000);
}

function extractTagAttribute(tag: string, attributeName: string) {
  return extractXmlAttribute(tag, attributeName);
}

function extractSalaryByLabel(text: string, labels: string[]) {
  const normalizedLabels = labels.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const regex = new RegExp(`(?:${normalizedLabels.join("|")})[^$\\d]{0,30}(\\$?\\s?\\d[\\d,]*(?:\\.\\d{2,4})?)`, "i");
  const match = text.match(regex);
  return match?.[1]?.replace(/\s+/g, "") ?? null;
}

function extractContractDailySalary(text: string) {
  return (
    extractSalaryByLabel(text, [
      "salario diario integrado",
      "salario diario",
      "salario base",
      "salario",
      "sueldo diario",
      "sueldo",
    ]) ?? extractMoney(text)
  );
}

function extractSocialSecurityBaseSalary(text: string) {
  const xmlValue = extractXmlAttribute(text, "SalarioBaseCotApor");
  const labeledValue = extractSalaryByLabel(text, [
    "salariobasecotapor",
    "sbc",
    "salario base de cotizacion",
    "salario base cotizacion",
  ]);
  return {
    confirmed: xmlValue,
    estimated: xmlValue ? null : labeledValue,
  };
}

function extractIntegratedDailySalary(text: string) {
  const xmlValue = extractXmlAttribute(text, "SalarioDiarioIntegrado");
  const labeledValue = extractSalaryByLabel(text, ["salariodiariointegrado", "sdi", "salario diario integrado"]);
  return {
    confirmed: xmlValue,
    estimated: xmlValue ? null : labeledValue,
  };
}

function extractCfdiEmployerRfc(text: string) {
  const emitterRfc = extractXmlTags(text, "Emisor")
    .map((tag) => extractTagAttribute(tag, "Rfc"))
    .find((value) => Boolean(value));
  return emitterRfc?.toUpperCase() ?? null;
}

function extractCfdiWorkerRfc(text: string) {
  const employerRfc = extractCfdiEmployerRfc(text);
  const receptorRfc = extractXmlTags(text, "Receptor")
    .map((tag) => extractTagAttribute(tag, "Rfc")?.toUpperCase() ?? null)
    .find((value) => Boolean(value) && value !== employerRfc);
  return receptorRfc ?? null;
}

function extractCfdiWorkerName(text: string) {
  const receptors = extractXmlTags(text, "Receptor");
  const fiscalReceptor = receptors.find((tag) => extractTagAttribute(tag, "Rfc"));
  const receptorName =
    (fiscalReceptor ? extractTagAttribute(fiscalReceptor, "Nombre") : null) ??
    receptors.map((tag) => extractTagAttribute(tag, "Nombre")).find((value) => Boolean(value)) ??
    null;
  return (
    receptorName?.trim() ||
    extractNamedField(text, ["trabajador", "empleado", "colaborador"])
  );
}

function extractCfdiEmployerName(text: string) {
  const emitterMatch = text.match(/<[^>]*Emisor\b[^>]*\bNombre\s*=\s*["']([^"']+)["']/i);
  const printableEmitterLabelMatch = text.match(/(?:nombre|emisor)\s*[:\-]?\s*([^|\n]+?)(?=\s*(?:\||rfc\b))/i);
  const printableEmitterMatch = text.match(
    /(?:recibo\s*[:#]?\s*[\w-]+\s*\|\s*|\bCFDI\s*\|\s*|\|\s*)([A-ZÁÉÍÓÚÜÑ0-9&.,'\- ]{5,}?(?:S\.?(?:\s*A\.?)?\s*DE\s*C\.?\s*V\.?|S\.?(?:\s*DE\s*R\.?\s*L\.?)?))\s*(?:\|\s*)?RFC\s*:/i
  );
  const reasonSocialMatch = text.match(
    /(?:raz[oó]n\s+social|empresa|empleador)\s*[:\-]?\s*([\s\S]*?)(?=\s+(?:rfc|periodo(?:\s+de\s+pago)?|fecha\s+inicial\s+de\s+pago|neto(?:\s+a\s+pagar)?|salario|total\s+percepciones|total\s+deducciones|nss|registro\s+patronal)\b|$)/i
  );
  return (
    emitterMatch?.[1]?.trim() ??
    printableEmitterLabelMatch?.[1]?.trim().replace(/[;,]+$/, "") ??
    printableEmitterMatch?.[1]?.trim().replace(/[;,]+$/, "") ??
    reasonSocialMatch?.[1]?.trim().replace(/[;,]+$/, "") ??
    extractNamedField(text, ["razón social", "razon social", "patron", "patrón", "empresa", "empleador"])
  );
}

function extractPayrollAmount(text: string, labels: string[], xmlAttributes: string[] = []) {
  for (const attribute of xmlAttributes) {
    const value = extractXmlAttribute(text, attribute);
    if (value) return value.startsWith("$") ? value : `$${value}`;
  }

  const labeledAmount = extractSalaryByLabel(text, labels);
  return labeledAmount ? (labeledAmount.startsWith("$") ? labeledAmount : `$${labeledAmount}`) : null;
}

function extractPayrollNetAmount(text: string) {
  const total = extractPayrollAmount(
    text,
    ["neto a pagar", "total neto", "importe neto", "total a pagar", "total percepciones"],
    ["Total"],
  );
  if (total) return total;

  const salaryConcept = text.match(/(?:\b001\s+)?salario(?!\s+diario)\s*[:\-]?\s*(\$?\s?\d[\d,]*(?:\.\d{2,4})?)/i);
  const amount = salaryConcept?.[1]?.replace(/\s+/g, "");
  return amount ? (amount.startsWith("$") ? amount : `$${amount}`) : null;
}

function extractXmlDeductionAmount(text: string, deductionType: string) {
  const deduction = text.match(
    new RegExp(`<[^>]*Deduccion\\b[^>]*TipoDeduccion\\s*=\\s*["']${deductionType}["'][^>]*>`, "i")
  )?.[0];
  const amount = deduction ? extractXmlAttribute(deduction, "Importe") : null;
  return amount ? (amount.startsWith("$") ? amount : `$${amount}`) : null;
}

function extractPayrollPeriod(text: string) {
  const start = extractXmlAttribute(text, "FechaInicialPago");
  const end = extractXmlAttribute(text, "FechaFinalPago");
  if (start && end) return `${start} al ${end}`;

  const dateRange = text.match(
    /(?:periodo(?:\s+de\s+pago)?|del|fecha\s+inicial\s+de\s+pago)\s*[:\-]?\s*(\d{4}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\s*(?:al|a|hasta|[-–—])\s*(\d{4}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{1,2})/i
  );
  if (dateRange?.[1] && dateRange[2]) {
    const [startDate, endDate] = [dateRange[1], dateRange[2]];
    const normalizedEnd =
      /^\d{4}-\d{2}-\d{2}$/.test(startDate) && /^\d{1,2}$/.test(endDate)
        ? `${startDate.slice(0, 8)}${endDate.padStart(2, "0")}`
        : endDate;
    return `${startDate} al ${normalizedEnd}`;
  }

  const paidOn = extractXmlAttribute(text, "FechaPago") ?? extractNamedField(text, ["periodo de pago", "periodo", "fecha de pago"]);
  return paidOn ?? extractPeriod(text);
}

function extractPayrollEmployerRegistration(text: string) {
  const registrationMatch = text.match(
    /(?:registro\s+patronal|reg\.\s*patronal)\s*[:\-]?\s*([A-Z][A-Z0-9]{7,14})\b/i
  );
  return (
    extractXmlAttribute(text, "RegistroPatronal") ??
    registrationMatch?.[1]?.toUpperCase() ??
    extractNamedField(text, ["registro patronal", "reg. patronal"])
  );
}

function compactNss(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 11 ? digits : null;
}

function compactCurp(value: string | null | undefined): string | null {
  if (!value) return null;
  const compact = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return /^[A-Z]{4}\d{6}[A-Z]{6}[0-9A-Z]{2}$/.test(compact) ? compact : null;
}

function extractLabeledNss(text: string): string | null {
  const match = text.match(
    /(?:\bnss\b|n\s*\.\s*s\s*\.\s*s\s*\.?|n[úu]mero\s+de\s+seguridad\s+social|numseguridadsocial)\s*[:\-]?\s*((?:\d[\s.\-]*){10,11})/i,
  );
  return compactNss(match?.[1] ?? null);
}

function extractPayrollNss(text: string) {
  const fromReceptor = extractXmlTags(text, "Receptor")
    .map((tag) => compactNss(extractTagAttribute(tag, "NumSeguridadSocial")))
    .find((value) => Boolean(value));
  return (
    fromReceptor ??
    compactNss(extractXmlAttribute(text, "NumSeguridadSocial")) ??
    extractLabeledNss(text) ??
    compactNss(extractNamedField(text, ["nss", "numero de seguridad social", "número de seguridad social"]))
  );
}

function extractPayrollCurp(text: string) {
  const fromReceptor = extractXmlTags(text, "Receptor")
    .map((tag) => compactCurp(extractTagAttribute(tag, "Curp")))
    .find((value) => Boolean(value));
  const fromAttribute = compactCurp(extractXmlAttribute(text, "Curp"));
  const labeled = compactCurp(
    text.match(/\bcurp\b\s*[:=]?\s*((?:[A-Z0-9][\s.\-]*){18})/i)?.[1] ?? null,
  );
  const xmlValue = fromReceptor ?? fromAttribute ?? null;
  return {
    confirmed: xmlValue,
    estimated: xmlValue ? null : labeled,
  };
}

function extractExplicitEmployerRfc(text: string): string | null {
  const labeled = text.match(
    /(?:rfc\s+(?:del\s+)?(?:patr[oó]n|emisor)|rfc\s*emisor)\s*[:\-]?\s*([A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3})/i,
  )?.[1];
  if (labeled) return labeled.toUpperCase();
  return (
    [...text.matchAll(/\brfc\s*[:\-]\s*([A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3})/gi)]
      .map((item) => item[1].toUpperCase())
      .find((rfc) => rfc.length === 12) ?? null
  );
}

function extractExplicitWorkerRfc(text: string, employerRfc?: string | null): string | null {
  const labeled = text.match(
    /(?:rfc\s+(?:del\s+)?(?:trabajador|receptor|empleado)|rfc\s*receptor)\s*[:\-]?\s*([A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3})/i,
  )?.[1]?.toUpperCase();
  const genericPerson = [...text.matchAll(/\brfc\s*[:\-]\s*([A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3})/gi)]
    .map((item) => item[1].toUpperCase())
    .find((rfc) => rfc.length === 13 && rfc !== employerRfc);
  const candidate = labeled ?? genericPerson ?? null;
  if (!candidate || (employerRfc && candidate === employerRfc)) return null;
  return candidate;
}

function extractPlainDailySalary(text: string): string | null {
  const match = text.match(
    /(?:\bsueldo\s+diario\b|\bsueldo\b|\bsalario\s+diario\b(?!\s+integrado))\s*[:\-]?\s*(\$?\s?\d[\d,]*(?:\.\d{2,4})?)/i,
  );
  const amount = match?.[1]?.replace(/\s+/g, "") ?? null;
  if (!amount) return null;
  return amount.startsWith("$") ? amount : `$${amount}`;
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
  const hasPayrollSignals = hasAny(
    haystack,
    "nomina",
    "nómina",
    "recibo",
    "payroll",
    "quincena",
    "semanal",
    "percepciones",
    "deducciones",
    "folio fiscal",
    "representacion impresa",
    "representación impresa",
    "comprobante fiscal"
  );

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

  if (!hasPayrollSignals && hasAny(haystack, "imss", "nss", "alta", "baja", "semanas cotizadas", "sipare", "seguro social")) {
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

  if (hasPayrollSignals || uuidNamedPdf) {
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

function splitPayrollTextSources(text: string): { xml: string; plain: string } {
  const tags = text.match(/<[^>]+>/g) ?? [];
  if (tags.length === 0) return { xml: "", plain: text };
  return {
    xml: tags.join(" "),
    plain: text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
  };
}

type PayrollHarvest = {
  employerRfcXml: string | null;
  employerRfcLabeled: string | null;
  employerRfcLoose: string | null;
  workerRfcXml: string | null;
  workerRfcLabeled: string | null;
  workerName: string | null;
  employerName: string | null;
  period: string | null;
  perceptions: string | null;
  deductions: string | null;
  netAmount: string | null;
  nss: string | null;
  curpConfirmed: string | null;
  curpEstimated: string | null;
  employerRegistration: string | null;
  isrWithheld: string | null;
  imssWithheld: string | null;
  infonavitWithheld: string | null;
  sbcConfirmed: string | null;
  sbcEstimated: string | null;
  sdiConfirmed: string | null;
  sdiEstimated: string | null;
  dailySalary: string | null;
};

function emptyPayrollHarvest(): PayrollHarvest {
  return {
    employerRfcXml: null,
    employerRfcLabeled: null,
    employerRfcLoose: null,
    workerRfcXml: null,
    workerRfcLabeled: null,
    workerName: null,
    employerName: null,
    period: null,
    perceptions: null,
    deductions: null,
    netAmount: null,
    nss: null,
    curpConfirmed: null,
    curpEstimated: null,
    employerRegistration: null,
    isrWithheld: null,
    imssWithheld: null,
    infonavitWithheld: null,
    sbcConfirmed: null,
    sbcEstimated: null,
    sdiConfirmed: null,
    sdiEstimated: null,
    dailySalary: null,
  };
}

function harvestPayrollText(text: string): PayrollHarvest {
  if (!text.trim()) return emptyPayrollHarvest();
  const employerRfcXml = extractCfdiEmployerRfc(text);
  const employerRfcLabeled = extractExplicitEmployerRfc(text);
  const employerForWorker = employerRfcXml ?? employerRfcLabeled;
  const salaryBase = extractSocialSecurityBaseSalary(text);
  const salaryIntegrated = extractIntegratedDailySalary(text);
  const curp = extractPayrollCurp(text);
  return {
    employerRfcXml,
    employerRfcLabeled,
    employerRfcLoose: extractRfc(text),
    workerRfcXml: extractCfdiWorkerRfc(text),
    workerRfcLabeled: extractExplicitWorkerRfc(text, employerForWorker),
    workerName: extractCfdiWorkerName(text),
    employerName: extractCfdiEmployerName(text),
    period: extractPayrollPeriod(text),
    perceptions: extractPayrollAmount(text, ["total percepciones", "percepciones"], ["TotalPercepciones"]),
    deductions: extractPayrollAmount(text, ["total deducciones", "deducciones", "descuentos"], ["TotalDeducciones", "Descuento"]),
    netAmount: extractPayrollNetAmount(text),
    nss: extractPayrollNss(text),
    curpConfirmed: curp.confirmed,
    curpEstimated: curp.estimated,
    employerRegistration: extractPayrollEmployerRegistration(text),
    isrWithheld: extractXmlDeductionAmount(text, "002") ?? extractPayrollAmount(text, ["isr", "impuesto sobre la renta"]),
    imssWithheld:
      extractXmlDeductionAmount(text, "001") ?? extractPayrollAmount(text, ["cuota imss", "imss", "seguridad social"]),
    infonavitWithheld:
      extractXmlDeductionAmount(text, "010") ?? extractPayrollAmount(text, ["pago infonavit", "infonavit"]),
    sbcConfirmed: salaryBase.confirmed,
    sbcEstimated: salaryBase.estimated,
    sdiConfirmed: salaryIntegrated.confirmed,
    sdiEstimated: salaryIntegrated.estimated,
    dailySalary: extractPlainDailySalary(text),
  };
}

function pickHarvestValue(primary: string | null, fallback: string | null) {
  return primary ?? fallback ?? null;
}

/** El XML manda cuando el mismo dato también viene del PDF o del OCR. El otro solo llena huecos. */
function resolvePayrollHarvest(sourceText: string) {
  const { xml, plain } = splitPayrollTextSources(sourceText);
  const fromXml = xml ? harvestPayrollText(xml) : emptyPayrollHarvest();
  const fromPlain = xml ? harvestPayrollText(plain) : harvestPayrollText(sourceText);
  const employerConfirmed = pickHarvestValue(fromXml.employerRfcXml, pickHarvestValue(fromXml.employerRfcLabeled, fromPlain.employerRfcLabeled));
  const looseEmployer = pickHarvestValue(fromXml.employerRfcLoose, fromPlain.employerRfcLoose);
  const workerFromXml =
    fromXml.workerRfcXml && fromXml.workerRfcXml !== employerConfirmed && fromXml.workerRfcXml !== looseEmployer
      ? fromXml.workerRfcXml
      : null;
  const workerFromPlain =
    fromPlain.workerRfcLabeled &&
    fromPlain.workerRfcLabeled !== employerConfirmed &&
    fromPlain.workerRfcLabeled !== looseEmployer
      ? fromPlain.workerRfcLabeled
      : null;
  const workerConfirmed = pickHarvestValue(workerFromXml, pickHarvestValue(fromXml.workerRfcLabeled, workerFromPlain));
  const employerEstimated =
    employerConfirmed ?? (looseEmployer && looseEmployer !== workerConfirmed ? looseEmployer : null);

  return {
    employerConfirmed,
    employerEstimated,
    workerConfirmed,
    workerName: pickHarvestValue(fromXml.workerName, fromPlain.workerName),
    employerName: pickHarvestValue(fromXml.employerName, fromPlain.employerName),
    period: pickHarvestValue(fromXml.period, fromPlain.period),
    perceptions: pickHarvestValue(fromXml.perceptions, fromPlain.perceptions),
    deductions: pickHarvestValue(fromXml.deductions, fromPlain.deductions),
    netAmount: pickHarvestValue(fromXml.netAmount, fromPlain.netAmount),
    nss: pickHarvestValue(fromXml.nss, fromPlain.nss),
    curpConfirmed: pickHarvestValue(fromXml.curpConfirmed, fromPlain.curpConfirmed),
    curpEstimated: pickHarvestValue(fromXml.curpEstimated, fromPlain.curpEstimated),
    employerRegistration: pickHarvestValue(fromXml.employerRegistration, fromPlain.employerRegistration),
    isrWithheld: pickHarvestValue(fromXml.isrWithheld, fromPlain.isrWithheld),
    imssWithheld: pickHarvestValue(fromXml.imssWithheld, fromPlain.imssWithheld),
    infonavitWithheld: pickHarvestValue(fromXml.infonavitWithheld, fromPlain.infonavitWithheld),
    sbcConfirmed: pickHarvestValue(fromXml.sbcConfirmed, fromPlain.sbcConfirmed),
    sbcEstimated: pickHarvestValue(fromXml.sbcEstimated, fromPlain.sbcEstimated),
    sdiConfirmed: pickHarvestValue(fromXml.sdiConfirmed, fromPlain.sdiConfirmed),
    sdiEstimated: pickHarvestValue(fromXml.sdiEstimated, fromPlain.sdiEstimated),
    dailySalary: pickHarvestValue(fromXml.dailySalary, fromPlain.dailySalary),
  };
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

  const isPayrollDocument = classification.documentType === "cfdi" || classification.documentType === "payroll_receipt";
  const payroll = isPayrollDocument ? resolvePayrollHarvest(sourceText) : null;
  const payrollEmployerName = payroll?.employerName ?? null;
  const payrollPeriod = payroll?.period ?? null;
  const payrollPerceptions = payroll?.perceptions ?? null;
  const payrollDeductions = payroll?.deductions ?? null;
  const payrollNetAmount = payroll?.netAmount ?? null;
  const payrollNss = payroll?.nss ?? null;
  const payrollCurpConfirmed = payroll?.curpConfirmed ?? null;
  const payrollCurpEstimated = payroll?.curpEstimated ?? null;
  const payrollEmployerRegistration = payroll?.employerRegistration ?? null;
  const isrWithheld = payroll?.isrWithheld ?? null;
  const imssWithheld = payroll?.imssWithheld ?? null;
  const infonavitWithheld = payroll?.infonavitWithheld ?? null;
  const xmlEmployerRfc = payroll?.employerConfirmed ?? null;
  const xmlWorkerRfc = payroll?.workerConfirmed ?? null;

  const estimatedData: Record<string, AnalysisValue> = {
    employerRfc: payroll ? payroll.employerEstimated : extractRfc(sourceText),
    workerRfc: xmlWorkerRfc,
    payrollCurp: payrollCurpConfirmed ?? payrollCurpEstimated,
    period: payrollPeriod ?? extractPeriod(sourceText),
    apparentAmount: payrollNetAmount ?? extractMoney(sourceText),
    apparentEffectiveDate: extractDate(sourceText),
    workerName: payroll?.workerName ?? extractCfdiWorkerName(sourceText),
    employerName: payrollEmployerName,
    jobTitle: extractNamedField(sourceText, ["puesto", "cargo"]),
    contractDailySalary: classification.documentType === "contract" ? extractContractDailySalary(sourceText) : null,
    socialSecurityBaseSalary: payroll ? (payroll.sbcConfirmed ?? payroll.sbcEstimated) : null,
    integratedDailySalary: payroll ? (payroll.sdiConfirmed ?? payroll.sdiEstimated) : null,
    payrollDailySalary: payroll?.dailySalary ?? null,
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
    payrollEmployerName,
    payrollPeriod,
    payrollNetAmount,
    payrollPerceptions,
    payrollDeductions,
    payrollNss,
    payrollCurp: payrollCurpConfirmed,
    payrollEmployerRegistration,
    isrWithheld,
    imssWithheld,
    infonavitWithheld,
    employerRfc: xmlEmployerRfc,
    workerRfc: xmlWorkerRfc,
    socialSecurityBaseSalary: payroll?.sbcConfirmed ?? null,
    integratedDailySalary: payroll?.sdiConfirmed ?? null,
    payrollDailySalary: payroll?.dailySalary ?? null,
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

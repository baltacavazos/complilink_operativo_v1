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

export type DocumentClassification = {
  documentType: DocumentType;
  classificationConfidence: number;
  reasons: string[];
};

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
  const haystack = `${params.fileName} ${params.mimeType} ${params.textHint ?? ""}`.toLowerCase();
  const reasons: string[] = [];

  const hasAny = (...terms: string[]) => terms.some((term) => haystack.includes(term));

  if (hasAny("cfdi", "xml", "factura", "timbre fiscal", "sat")) {
    reasons.push("Se detectaron marcadores típicos de CFDI o timbrado fiscal.");
    return { documentType: "cfdi", classificationConfidence: 91, reasons };
  }

  if (hasAny("imss", "nss", "alta", "baja", "semanas cotizadas", "sipare")) {
    reasons.push("Se detectaron referencias operativas del IMSS o seguridad social.");
    return { documentType: "imss", classificationConfidence: 88, reasons };
  }

  if (hasAny("nomina", "nómina", "recibo", "payroll", "quincena", "semanal", "percepciones", "deducciones")) {
    reasons.push("Se detectaron indicadores de recibos de nómina o pagos laborales.");
    return { documentType: "payroll_receipt", classificationConfidence: 86, reasons };
  }

  if (hasAny("contrato", "oferta laboral", "relacion laboral", "relación laboral")) {
    reasons.push("Se detectaron términos de contratación o relación laboral.");
    return { documentType: "contract", classificationConfidence: 78, reasons };
  }

  if (hasAny("finiquito", "liquidacion", "liquidación", "terminacion", "terminación", "severance")) {
    reasons.push("Se detectaron referencias a terminación laboral o liquidación.");
    return { documentType: "settlement", classificationConfidence: 79, reasons };
  }

  if (hasAny("evidencia", "correo", "whatsapp", "captura", "screen", "screenshot", "chat")) {
    reasons.push("Se detectaron señales de evidencia complementaria del expediente.");
    return { documentType: "evidence", classificationConfidence: 65, reasons };
  }

  reasons.push("No hubo suficientes marcadores para una clasificación específica; se mantiene como otro.");
  return { documentType: "other", classificationConfidence: 40, reasons };
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

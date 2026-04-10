import { Buffer } from "node:buffer";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import {
  addCaseEvent,
  addConsentRecord,
  addOperationalAlert,
  addPolicyRecord,
  assertActiveTenantMember,
  assertCaseAccess,
  assertCaseWriteAccess,
  assertTenantAccess,
  assertTenantAdminAccess,
  buildCaseId,
  buildTraceId,
  createAuditLog,
  createCaseRecord,
  ensureTenantForUser,
  findAuditLogEntry,
  getCaseDetailForUser,
  getDashboardForUser,
  getCeoDashboardSnapshot,
  getSystemSnapshot,
  getVisibleDocumentForUser,
  grantCaseAccess,
  listAccessibleUsersByTenant,
  listAuditTrail,
  listCanonicalContractsByType,
  listCasesForUser,
  listTenantsForUser,
  listVisibleDocuments,
  persistAuditarViewState,
  seedDemoCaseIfEmpty,
  updateCaseStatus,
  upsertCanonicalContract,
  addDocumentRecord,
  getAuditarDraftById,
  updateDocumentPostProcessing,
  withDatabaseLock,
} from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { invokeLLM } from "./_core/llm";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { storageGet, storagePut } from "./storage";
import {
  buildCanonicalCaseContract,
  buildCanonicalConsentContract,
  buildCanonicalDocumentContract,
  buildDocumentId,
  buildDocumentStorageKey,
  buildPreliminaryLaborAnalysis,
  buildSharedEngineEnvelope,
  CASE_PRIORITIES,
  CASE_STATUSES,
  classifyMexicanLaborDocument,
  computeSha256,
  CONSENT_STATUSES,
  decodeBase64File,
  DOCUMENT_VISIBILITIES,
  getHeliosDocumentState,
  getHeliosExpedienteStage,
  sanitizeFileName,
} from "./caseContracts";
import { sendDocumentToAuditaPatronEngine } from "./auditaPatronIntegrationService";
import { buildHeliosOpinionContract } from "./heliosIntegrationService";
import {
  HELIOS_CONTEXT_NOTE,
  LEGAL_ACCEPTANCE_VERSION,
  LEGAL_CONTRACT_SCHEMA_VERSION,
  LEGAL_CONTACT_EMAIL,
  LEGAL_CONSENT_TYPES,
  LEGAL_DOCUMENTS,
  LEGAL_EFFECTIVE_DATE,
  LEGAL_GATE_COPY,
  LEGAL_VERSION,
  getLegalConsentLabel,
  type LegalConsentType,
} from "@shared/legal";

const caseStatusSchema = z.enum(CASE_STATUSES);
const casePrioritySchema = z.enum(CASE_PRIORITIES);
const consentStatusSchema = z.enum(CONSENT_STATUSES);
const documentConsentStatusSchema = z.enum(["pending", "granted", "revoked", "not_required"]);
const documentVisibilitySchema = z.enum(DOCUMENT_VISIBILITIES);
const auditarTargetTypeSchema = z.enum(["payroll_receipt", "cfdi", "contract", "imss", "evidence"]);
const auditarHistoryFilterSchema = z.enum(["all", "document", "response", "summary"]);
const auditarCaptureModeSchema = z.enum(["camera", "file"]);
const auditarManualOverrideSchema = z.object({
  key: z.string().min(1).max(80),
  label: z.string().trim().min(1).max(120).optional(),
  value: z.string().trim().min(1).max(240),
});

const auditarEditableFieldKeys = [
  "workerName",
  "employerName",
  "period",
  "apparentAmount",
  "apparentEffectiveDate",
  "employerRfc",
  "jobTitle",
] as const;

const auditarEditableFieldKeySet = new Set<string>(auditarEditableFieldKeys);

const COMPLILINK_RETURN_TIMEOUT_MS = 15 * 60 * 1000;
const complilinkReturnEventNames = new Set([
  "document.processing.started",
  "document.analysis.completed",
  "document.analyzed",
  "contract.analysis.detailed",
]);

function parseEventMetadata(metadata: string | null) {
  if (!metadata) return null;

  try {
    const parsed = JSON.parse(metadata);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function getMetadataDocumentId(metadata: Record<string, unknown> | null) {
  if (!metadata) return null;
  if (typeof metadata.documentId === "string") return metadata.documentId;
  if (typeof metadata.document_id === "string") return metadata.document_id;
  return null;
}

const legalRequiredConsentTypes = ["privacy_policy", "terms_of_service"] as const satisfies LegalConsentType[];

type LegalConsentSummarySource = {
  legalBasis: string | null;
  status: string;
  notes?: string | null;
  grantedAt?: Date | string | null;
  updatedAt?: Date | string | null;
  createdAt?: Date | string | null;
};

function getHeaderValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value.find((item) => item.trim().length > 0)?.trim() ?? null;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }

  return null;
}

function getClientIp(req: { headers: Record<string, unknown>; ip?: string | null }) {
  const forwarded = getHeaderValue(req.headers["x-forwarded-for"] as string | string[] | undefined);
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() ?? forwarded;
  }

  return req.ip?.trim() ? req.ip.trim() : null;
}

function getUserAgent(req: { headers: Record<string, unknown> }) {
  return getHeaderValue(req.headers["user-agent"] as string | string[] | undefined);
}

function buildLegalConsentBasis(type: LegalConsentType) {
  return `legal_package:${LEGAL_ACCEPTANCE_VERSION}:${type}`;
}

function getLegalConsentTypeFromBasis(legalBasis: string | null | undefined) {
  if (!legalBasis) return null;

  const prefix = `legal_package:${LEGAL_ACCEPTANCE_VERSION}:`;
  if (!legalBasis.startsWith(prefix)) return null;

  const candidate = legalBasis.slice(prefix.length);
  return LEGAL_CONSENT_TYPES.find((item) => item === candidate) ?? null;
}

function getLegalDocumentRouteByConsentType(type: LegalConsentType) {
  return LEGAL_DOCUMENTS.find((document) => document.consentType === type)?.route ?? null;
}

function buildLegalAcceptanceSummary(consents: LegalConsentSummarySource[]) {
  const latestByType = new Map<LegalConsentType, { status: string; recordedAt: string | null }>();

  for (const consent of consents) {
    const consentType = getLegalConsentTypeFromBasis(consent.legalBasis);
    if (!consentType) continue;

    const recordedAtValue = consent.updatedAt ?? consent.grantedAt ?? consent.createdAt ?? null;
    const recordedAt = recordedAtValue ? new Date(recordedAtValue).toISOString() : null;
    const previous = latestByType.get(consentType);
    const previousTime = previous?.recordedAt ? new Date(previous.recordedAt).getTime() : -1;
    const currentTime = recordedAt ? new Date(recordedAt).getTime() : 0;

    if (!previous || currentTime >= previousTime) {
      latestByType.set(consentType, {
        status: consent.status,
        recordedAt,
      });
    }
  }

  const missingConsentTypes = legalRequiredConsentTypes.filter((type) => latestByType.get(type)?.status !== "granted");
  const acceptedAt = legalRequiredConsentTypes
    .map((type) => latestByType.get(type)?.recordedAt ?? null)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1) ?? null;

  return {
    acceptanceVersion: LEGAL_ACCEPTANCE_VERSION,
    legalVersion: LEGAL_VERSION,
    effectiveDate: LEGAL_EFFECTIVE_DATE,
    isAccepted: missingConsentTypes.length === 0,
    acceptedAt,
    missingConsentTypes,
    missingDocuments: LEGAL_DOCUMENTS.filter((document) => missingConsentTypes.includes(document.consentType)).map((document) => ({
      slug: document.slug,
      route: document.route,
      shortTitle: document.shortTitle,
    })),
    gate: LEGAL_GATE_COPY,
    contactEmail: LEGAL_CONTACT_EMAIL,
    documents: LEGAL_DOCUMENTS.map((document) => ({
      slug: document.slug,
      route: document.route,
      shortTitle: document.shortTitle,
      fullTitle: document.fullTitle,
      version: document.version,
      effectiveDate: document.effectiveDate,
      consentType: document.consentType,
      accepted: latestByType.get(document.consentType)?.status === "granted",
      acceptedAt: latestByType.get(document.consentType)?.recordedAt ?? null,
    })),
    consentStatusByType: Object.fromEntries(
      LEGAL_CONSENT_TYPES.map((type) => [
        type,
        {
          label: getLegalConsentLabel(type),
          status: latestByType.get(type)?.status ?? "pending",
          acceptedAt: latestByType.get(type)?.recordedAt ?? null,
          route: getLegalDocumentRouteByConsentType(type),
        },
      ]),
    ),
  };
}

type AuditarTargetType = z.infer<typeof auditarTargetTypeSchema>;
type AuditarCaptureMode = z.infer<typeof auditarCaptureModeSchema>;
type AuditarManualOverride = z.infer<typeof auditarManualOverrideSchema>;
type ScanAssistAssessment = {
  readiness: "ready" | "retry" | "manual_review";
  documentPresence: "clear" | "partial" | "uncertain";
  issues: string[];
  userGuidance: string;
  friendlyHeadline: string;
  expectedTypeAlignment: "match" | "possible" | "uncertain" | "mismatch";
  confidence: number;
};

type StructuredExtractionField = {
  key: string;
  label: string;
  value: string;
  status: "confirmed" | "estimated";
  confidence: "high" | "medium" | "low";
};

type StructuredExtractionResult = {
  headline: string;
  summary: string;
  fields: StructuredExtractionField[];
  missingFields: string[];
  reviewNotes: string[];
};

type DraftPreliminaryAnalysis = ReturnType<typeof buildPreliminaryLaborAnalysis> & {
  structuredExtraction: StructuredExtractionResult;
};

type AuditarDraftContractPayload = {
  draftId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  storageKey: string;
  storageUrl: string;
  textHint: string | null;
  expectedDocumentType: AuditarTargetType | null;
  captureMode: AuditarCaptureMode | null;
  sourceChannel: "manual" | "email" | "api" | "bulk_import";
  classification: ReturnType<typeof classifyMexicanLaborDocument>;
  preliminaryAnalysis: DraftPreliminaryAnalysis;
  scanAssistance: ScanAssistAssessment;
  createdAt: string;
};

function readLlmMessageText(messageContent: unknown) {
  if (typeof messageContent === "string") {
    return messageContent;
  }

  if (Array.isArray(messageContent)) {
    return messageContent
      .filter((part): part is { type: "text"; text: string } => Boolean(part) && typeof part === "object" && "type" in part && (part as { type?: string }).type === "text")
      .map((part) => part.text)
      .join("\n");
  }

  return "";
}

function humanizeStructuredFieldLabel(key: string) {
  const explicitLabels: Record<string, string> = {
    fileName: "Archivo",
    mimeType: "Formato",
    internalDocumentType: "Tipo de documento",
    normalizedDocType: "Detalle detectado",
    processingProfile: "Nivel de revisión",
    structuredExtractionReady: "Puede leer detalles",
    benefitEstimationReady: "Puede estimar prestaciones",
    employerRfc: "RFC visible",
    period: "Periodo visible",
    apparentAmount: "Monto visible",
    apparentEffectiveDate: "Fecha visible",
    workerName: "Nombre visible de la persona trabajadora",
    employerName: "Nombre visible del patrón o empresa",
    jobTitle: "Puesto visible",
  };

  if (explicitLabels[key]) {
    return explicitLabels[key];
  }

  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/^./, (value) => value.toUpperCase());
}

function buildStructuredExtractionHeadline(documentType: ReturnType<typeof classifyMexicanLaborDocument>["documentType"]) {
  switch (documentType) {
    case "contract":
      return "Esto es lo más importante que parece decir el contrato";
    case "settlement":
      return "Esto es lo más importante que parece decir el pago final";
    case "payroll_receipt":
    case "cfdi":
      return "Esto es lo más importante que parece decir el comprobante de pago";
    case "imss":
      return "Esto es lo más importante que parece decir el documento de seguridad social";
    default:
      return "Esto es lo más importante que alcanzamos a leer en tu documento";
  }
}

function buildStructuredExtractionFallback(params: {
  classification: ReturnType<typeof classifyMexicanLaborDocument>;
  preliminaryAnalysis: ReturnType<typeof buildPreliminaryLaborAnalysis>;
}): StructuredExtractionResult {
  const confirmedFields = Object.entries(params.preliminaryAnalysis.confirmedData)
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .map(([key, value]) => ({
      key,
      label: humanizeStructuredFieldLabel(key),
      value: String(value),
      status: "confirmed" as const,
      confidence: "high" as const,
    }));

  const estimatedFields = Object.entries(params.preliminaryAnalysis.estimatedData)
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .map(([key, value]) => ({
      key,
      label: humanizeStructuredFieldLabel(key),
      value: String(value),
      status: "estimated" as const,
      confidence: "medium" as const,
    }));

  const fields = [...confirmedFields, ...estimatedFields].slice(0, 10);
  const normalizedFieldIndex = new Set(fields.map((field) => `${field.key}|${field.label}`.toLowerCase()));
  const missingFields = params.preliminaryAnalysis.extractionTargets.filter((target) => {
    const normalizedTarget = target.toLowerCase();
    return !Array.from(normalizedFieldIndex).some((entry) => entry.includes(normalizedTarget));
  });

  return {
    headline: buildStructuredExtractionHeadline(params.classification.documentType),
    summary: params.preliminaryAnalysis.summary,
    fields,
    missingFields: missingFields.slice(0, 6),
    reviewNotes: params.preliminaryAnalysis.guardrails.slice(0, 3),
  };
}

async function analyzeStructuredDocumentPreview(params: {
  fileUrl: string;
  mimeType: string;
  fileName: string;
  textHint?: string | null;
  classification: ReturnType<typeof classifyMexicanLaborDocument>;
  preliminaryAnalysis: ReturnType<typeof buildPreliminaryLaborAnalysis>;
}): Promise<StructuredExtractionResult> {
  const fallback = buildStructuredExtractionFallback({
    classification: params.classification,
    preliminaryAnalysis: params.preliminaryAnalysis,
  });

  const supportsImageVision = params.mimeType.startsWith("image/");
  const supportsPdfVision = params.mimeType === "application/pdf";

  if (!supportsImageVision && !supportsPdfVision) {
    return fallback;
  }

  const targetList = params.preliminaryAnalysis.extractionTargets.join(", ");

  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content:
            "Eres un extractor documental laboral para México. Solo puedes devolver datos visibles o fuertemente inferibles desde el documento mostrado. Nunca inventes, no des asesoría legal y distingue con claridad lo confirmado de lo estimado.",
        },
        {
          role: "user",
          content: supportsImageVision
            ? [
                {
                  type: "text",
                  text: `Analiza este documento laboral y responde exclusivamente con el JSON solicitado. Archivo: ${params.fileName}. Tipo detectado: ${params.classification.normalizedDocType}. Objetivos de extracción: ${targetList}. Resumen preliminar: ${params.preliminaryAnalysis.summary}. Pista adicional: ${params.textHint ?? "sin pista adicional"}. Extrae solo lo visible, marca como confirmed lo claramente visible y como estimated lo ambiguo pero plausible.`,
                },
                {
                  type: "image_url",
                  image_url: {
                    url: params.fileUrl,
                    detail: "high",
                  },
                },
              ]
            : [
                {
                  type: "text",
                  text: `Analiza este PDF laboral y responde exclusivamente con el JSON solicitado. Archivo: ${params.fileName}. Tipo detectado: ${params.classification.normalizedDocType}. Objetivos de extracción: ${targetList}. Resumen preliminar: ${params.preliminaryAnalysis.summary}. Pista adicional: ${params.textHint ?? "sin pista adicional"}. Extrae solo lo visible, marca como confirmed lo claramente visible y como estimated lo ambiguo pero plausible.`,
                },
                {
                  type: "file_url",
                  file_url: {
                    url: params.fileUrl,
                    mime_type: "application/pdf",
                  },
                },
              ],
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "auditar_structured_extraction",
          strict: true,
          schema: {
            type: "object",
            properties: {
              headline: { type: "string" },
              summary: { type: "string" },
              fields: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    key: { type: "string" },
                    label: { type: "string" },
                    value: { type: "string" },
                    status: { type: "string", enum: ["confirmed", "estimated"] },
                    confidence: { type: "string", enum: ["high", "medium", "low"] },
                  },
                  required: ["key", "label", "value", "status", "confidence"],
                  additionalProperties: false,
                },
              },
              missingFields: {
                type: "array",
                items: { type: "string" },
              },
              reviewNotes: {
                type: "array",
                items: { type: "string" },
              },
            },
            required: ["headline", "summary", "fields", "missingFields", "reviewNotes"],
            additionalProperties: false,
          },
        },
      },
    });

    const serialized = readLlmMessageText(response.choices[0]?.message.content);
    if (!serialized) {
      return fallback;
    }

    const parsed = JSON.parse(serialized) as StructuredExtractionResult;

    return {
      headline: typeof parsed.headline === "string" && parsed.headline.trim().length > 0 ? parsed.headline.trim() : fallback.headline,
      summary: typeof parsed.summary === "string" && parsed.summary.trim().length > 0 ? parsed.summary.trim() : fallback.summary,
      fields: Array.isArray(parsed.fields)
        ? parsed.fields
            .filter((field) => field && typeof field.key === "string" && typeof field.label === "string" && typeof field.value === "string")
            .map((field): StructuredExtractionField => ({
              key: field.key.trim(),
              label: field.label.trim(),
              value: field.value.trim(),
              status: field.status === "estimated" ? "estimated" : "confirmed",
              confidence: field.confidence === "high" ? "high" : field.confidence === "low" ? "low" : "medium",
            }))
            .filter((field) => field.key.length > 0 && field.label.length > 0 && field.value.length > 0)
            .slice(0, 12)
        : fallback.fields,
      missingFields: Array.isArray(parsed.missingFields)
        ? parsed.missingFields.filter((item): item is string => typeof item === "string" && item.trim().length > 0).slice(0, 6)
        : fallback.missingFields,
      reviewNotes: Array.isArray(parsed.reviewNotes)
        ? parsed.reviewNotes.filter((item): item is string => typeof item === "string" && item.trim().length > 0).slice(0, 4)
        : fallback.reviewNotes,
    };
  } catch {
    return fallback;
  }
}

function buildDraftId() {
  return buildDocumentId().replace(/^DOC-/, "DRF-");
}

function buildDraftPreviewPayload(payload: AuditarDraftContractPayload) {
  return {
    draftId: payload.draftId,
    createdAt: payload.createdAt,
    previewAsset: {
      fileName: payload.fileName,
      mimeType: payload.mimeType,
      sizeBytes: payload.sizeBytes,
      sha256: payload.sha256,
      storageUrl: payload.storageUrl,
      captureMode: payload.captureMode,
      expectedDocumentType: payload.expectedDocumentType,
    },
    classification: payload.classification,
    preliminaryAnalysis: payload.preliminaryAnalysis,
    scanAssistance: payload.scanAssistance,
  };
}

function normalizeManualFieldOverrides(overrides: AuditarManualOverride[] | undefined) {
  const normalized = new Map<string, AuditarManualOverride>();

  for (const override of overrides ?? []) {
    const key = override.key.trim();
    const value = override.value.replace(/\s+/g, " ").trim();
    const label = override.label?.trim();

    if (!auditarEditableFieldKeySet.has(key) || value.length === 0) {
      continue;
    }

    normalized.set(key, {
      key,
      label: label && label.length > 0 ? label : humanizeStructuredFieldLabel(key),
      value: value.slice(0, 240),
    });
  }

  return Array.from(normalized.values()).slice(0, 5);
}

function getRecordStringValue(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function applyManualFieldOverrides(params: {
  preliminaryAnalysis: DraftPreliminaryAnalysis;
  overrides: AuditarManualOverride[];
}): DraftPreliminaryAnalysis {
  if (params.overrides.length === 0) {
    return params.preliminaryAnalysis;
  }

  const confirmedData = { ...params.preliminaryAnalysis.confirmedData };
  const estimatedData = { ...params.preliminaryAnalysis.estimatedData };
  const overrideMap = new Map(params.overrides.map((override) => [override.key, override]));

  for (const override of params.overrides) {
    confirmedData[override.key] = override.value;
    delete estimatedData[override.key];
  }

  const overrideLabels = new Set(
    params.overrides.map((override) => (override.label?.trim() || humanizeStructuredFieldLabel(override.key)).toLowerCase()),
  );

  const preservedFields = params.preliminaryAnalysis.structuredExtraction.fields.filter((field) => !overrideMap.has(field.key));
  const overrideFields: StructuredExtractionField[] = params.overrides.map((override) => ({
    key: override.key,
    label: override.label?.trim() || humanizeStructuredFieldLabel(override.key),
    value: override.value,
    status: "confirmed",
    confidence: "high",
  }));

  return {
    ...params.preliminaryAnalysis,
    confirmedData,
    estimatedData,
    structuredExtraction: {
      ...params.preliminaryAnalysis.structuredExtraction,
      fields: [...overrideFields, ...preservedFields].slice(0, 12),
      missingFields: params.preliminaryAnalysis.structuredExtraction.missingFields
        .filter((item) => !overrideLabels.has(item.trim().toLowerCase()))
        .slice(0, 6),
      reviewNotes: [
        `Antes de guardar, la persona usuaria confirmó o corrigió ${params.overrides.length} dato${params.overrides.length === 1 ? "" : "s"} clave.`,
        ...params.preliminaryAnalysis.structuredExtraction.reviewNotes,
      ].slice(0, 4),
    },
  };
}

function buildExpectedDocumentTypeHint(targetType?: AuditarTargetType) {
  switch (targetType) {
    case "payroll_receipt":
      return "El usuario espera subir un recibo de nómina o comprobante de pago laboral.";
    case "cfdi":
      return "El usuario espera subir un CFDI o XML timbrado de nómina.";
    case "contract":
      return "El usuario espera subir un contrato laboral o condiciones iniciales de trabajo.";
    case "imss":
      return "El usuario espera subir un soporte IMSS, alta, baja o semanas cotizadas.";
    case "evidence":
      return "El usuario espera subir evidencia complementaria como chat, correo, captura o documento de apoyo.";
    default:
      return "";
  }
}

function buildFallbackScanAssist(params: { mimeType: string; expectedDocumentType?: AuditarTargetType }): ScanAssistAssessment {
  const isImage = params.mimeType.startsWith("image/");
  return {
    readiness: isImage ? "manual_review" : "ready",
    documentPresence: isImage ? "partial" : "uncertain",
    issues: isImage
      ? ["La captura necesita una revisión adicional para confirmar nitidez, bordes y legibilidad."]
      : ["Este formato seguirá su revisión automática sin bloquear tu carga."],
    userGuidance: isImage
      ? "Si puedes, toma la foto con más luz, mostrando toda la hoja y evitando sombras para que el análisis sea más claro."
      : "Tu archivo ya puede subirse. Si después quieres una lectura más clara, intenta también con una foto o PDF nítido.",
    friendlyHeadline: isImage ? "Vamos a ayudarte a revisar si la foto se entiende bien" : "Tu archivo está listo para seguir al análisis",
    expectedTypeAlignment: params.expectedDocumentType ? "possible" : "uncertain",
    confidence: isImage ? 55 : 60,
  };
}

async function analyzeDocumentScanAssist(params: {
  fileUrl: string;
  mimeType: string;
  fileName: string;
  expectedDocumentType?: AuditarTargetType;
  textHint?: string;
}): Promise<ScanAssistAssessment> {
  const fallback = buildFallbackScanAssist({
    mimeType: params.mimeType,
    expectedDocumentType: params.expectedDocumentType,
  });

  const supportsImageVision = params.mimeType.startsWith("image/");
  const supportsPdfVision = params.mimeType === "application/pdf";

  if (!supportsImageVision && !supportsPdfVision) {
    return fallback;
  }

  const expectedHint = buildExpectedDocumentTypeHint(params.expectedDocumentType);

  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content:
            "Eres un asistente experto en escaneo documental laboral. Evalúas si una captura es usable para personas con muy baja alfabetización digital. Debes priorizar instrucciones cortas, humanas y accionables. No des asesoría legal ni inventes contenido no visible.",
        },
        {
          role: "user",
          content: supportsImageVision
            ? [
                {
                  type: "text",
                  text: `Analiza esta captura documental. Archivo: ${params.fileName}. Tipo esperado: ${params.expectedDocumentType ?? "no especificado"}. ${expectedHint} Pista adicional: ${params.textHint ?? "sin pista adicional"}. Responde solo con el esquema solicitado, evaluando legibilidad, bordes, orientación, sombras, reflejos, completitud visible y si parece alinearse con el tipo esperado.`,
                },
                {
                  type: "image_url",
                  image_url: {
                    url: params.fileUrl,
                    detail: "high",
                  },
                },
              ]
            : [
                {
                  type: "text",
                  text: `Analiza este PDF documental laboral. Archivo: ${params.fileName}. Tipo esperado: ${params.expectedDocumentType ?? "no especificado"}. ${expectedHint} Pista adicional: ${params.textHint ?? "sin pista adicional"}. Responde solo con el esquema solicitado, evaluando si el documento parece completo, legible y compatible con el tipo esperado.`,
                },
                {
                  type: "file_url",
                  file_url: {
                    url: params.fileUrl,
                    mime_type: "application/pdf",
                  },
                },
              ],
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "scan_assist_assessment",
          strict: true,
          schema: {
            type: "object",
            properties: {
              readiness: {
                type: "string",
                enum: ["ready", "retry", "manual_review"],
              },
              documentPresence: {
                type: "string",
                enum: ["clear", "partial", "uncertain"],
              },
              issues: {
                type: "array",
                items: { type: "string" },
              },
              userGuidance: { type: "string" },
              friendlyHeadline: { type: "string" },
              expectedTypeAlignment: {
                type: "string",
                enum: ["match", "possible", "uncertain", "mismatch"],
              },
              confidence: {
                type: "number",
              },
            },
            required: [
              "readiness",
              "documentPresence",
              "issues",
              "userGuidance",
              "friendlyHeadline",
              "expectedTypeAlignment",
              "confidence",
            ],
            additionalProperties: false,
          },
        },
      },
    });

    const messageContent = response.choices[0]?.message.content;
    const serialized =
      typeof messageContent === "string"
        ? messageContent
        : Array.isArray(messageContent)
          ? messageContent
              .filter((part): part is { type: "text"; text: string } => part.type === "text")
              .map((part) => part.text)
              .join("\n")
          : "";

    if (!serialized) {
      return fallback;
    }

    const parsed = JSON.parse(serialized) as ScanAssistAssessment;
    return {
      readiness: parsed.readiness,
      documentPresence: parsed.documentPresence,
      issues: Array.isArray(parsed.issues) ? parsed.issues.slice(0, 4) : fallback.issues,
      userGuidance: typeof parsed.userGuidance === "string" && parsed.userGuidance.trim().length > 0 ? parsed.userGuidance.trim() : fallback.userGuidance,
      friendlyHeadline:
        typeof parsed.friendlyHeadline === "string" && parsed.friendlyHeadline.trim().length > 0
          ? parsed.friendlyHeadline.trim()
          : fallback.friendlyHeadline,
      expectedTypeAlignment: parsed.expectedTypeAlignment,
      confidence:
        typeof parsed.confidence === "number" && Number.isFinite(parsed.confidence)
          ? Math.min(100, Math.max(0, Math.round(parsed.confidence)))
          : fallback.confidence,
    };
  } catch {
    return fallback;
  }
}

function buildCompliLinkMonitoring(
  documents: Array<{ documentId: string; originalName: string }>,
  events: Array<{ title: string; metadata: string | null; eventAt: Date }>,
) {
  const now = Date.now();

  const items = documents.map((document) => {
    const relatedEvents = events
      .map((event) => ({ event, metadata: parseEventMetadata(event.metadata) }))
      .filter(({ metadata }) => getMetadataDocumentId(metadata) === document.documentId);

    const dispatchEntry = relatedEvents.find(
      ({ metadata }) => metadata?.stage === "complilink_dispatch" && metadata?.dispatch_status === "sent",
    );

    if (!dispatchEntry) {
      return {
        documentId: document.documentId,
        documentName: document.originalName,
        status: "not_sent",
        dispatchedAt: null,
        respondedAt: null,
        responseEvent: null,
        message: "",
      } as const;
    }

    const returnEntry = relatedEvents.find(
      ({ metadata }) => typeof metadata?.event === "string" && complilinkReturnEventNames.has(metadata.event),
    );

    const dispatchedAt =
      typeof dispatchEntry.metadata?.dispatched_at === "string"
        ? dispatchEntry.metadata.dispatched_at
        : dispatchEntry.event.eventAt.toISOString();

    if (returnEntry) {
      return {
        documentId: document.documentId,
        documentName: document.originalName,
        status: "received",
        dispatchedAt,
        respondedAt: returnEntry.event.eventAt.toISOString(),
        responseEvent: String(returnEntry.metadata?.event ?? returnEntry.event.title),
        message: "CompliLink ya devolvió una respuesta para este documento.",
      } as const;
    }

    const overdue = now - new Date(dispatchedAt).getTime() >= COMPLILINK_RETURN_TIMEOUT_MS;

    return {
      documentId: document.documentId,
      documentName: document.originalName,
      status: overdue ? "attention" : "waiting",
      dispatchedAt,
      respondedAt: null,
      responseEvent: null,
      message: overdue
        ? "Este documento ya fue enviado, pero todavía no llega una respuesta automática. Conviene revisarlo con calma."
        : "Este documento ya fue enviado y seguimos esperando la respuesta automática.",
    } as const;
  });

  return {
    documents: items,
    summary: {
      waitingCount: items.filter((item) => item.status === "waiting").length,
      attentionCount: items.filter((item) => item.status === "attention").length,
      receivedCount: items.filter((item) => item.status === "received").length,
    },
  };
}

function asObjectRecord(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function getOptionalString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function getOptionalNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getOptionalStringList(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim())
    : [];
}

function documentMentionsInfonavit(document: {
  documentType: string;
  originalName?: string | null;
  heliosOpinion?: unknown;
}) {
  const heliosOpinion = asObjectRecord(document.heliosOpinion);
  const searchableText = [
    document.originalName ?? "",
    getOptionalString(heliosOpinion?.summary) ?? "",
    getOptionalString(heliosOpinion?.legalOpinion) ?? "",
    JSON.stringify(heliosOpinion?.rawPayload ?? {}),
  ]
    .join(" ")
    .toLowerCase();

  return searchableText.includes("infonavit");
}

function buildSocialSecurityValidationSummary(params: {
  documents: Array<{
    documentType: string;
    originalName?: string | null;
    heliosOpinion?: unknown;
  }>;
  events: Array<{ title: string; metadata: string | null; eventAt: Date | string }>;
}) {
  const documentsWithOpinion = params.documents.filter((item) => Boolean(asObjectRecord(item.heliosOpinion))).length;
  const imssDocumentsCount = params.documents.filter((item) => item.documentType === "imss").length;
  const infonavitSignalsCount = params.documents.filter((item) => documentMentionsInfonavit(item)).length;

  const revalidationHistory = params.events
    .map((event) => ({ event, metadata: parseEventMetadata(event.metadata) }))
    .filter(({ metadata }) => getOptionalString(metadata?.revalidation_scope) === "social_security")
    .sort((left, right) => new Date(right.event.eventAt).getTime() - new Date(left.event.eventAt).getTime())
    .map(({ event, metadata }) => ({
      recordedAt: new Date(event.eventAt).toISOString(),
      summary: getOptionalString(metadata?.summary) ?? event.title,
      statusLabel: getOptionalString(metadata?.status_label) ?? "Revalidación registrada",
      coverageScore: getOptionalNumber(metadata?.coverage_score),
      recommendedNextStep: getOptionalString(metadata?.recommended_next_step),
    }));

  const lastRevalidation = revalidationHistory[0] ?? null;
  const lastRecordedCoverage = lastRevalidation?.coverageScore ?? null;

  const coverageScore = Math.max(
    18,
    Math.min(
      98,
      (imssDocumentsCount > 0 ? 38 : 0) +
        (infonavitSignalsCount > 0 ? 32 : 0) +
        Math.min(params.documents.length, 4) * 6 +
        Math.min(documentsWithOpinion, 3) * 7,
    ),
  );

  const clarityDelta = lastRecordedCoverage === null ? 0 : Math.max(0, coverageScore - lastRecordedCoverage);
  const hasNewClarity = clarityDelta > 0;

  const statusLabel =
    imssDocumentsCount > 0 && infonavitSignalsCount > 0
      ? "Cruce visible listo"
      : imssDocumentsCount > 0 || infonavitSignalsCount > 0
        ? "Cruce parcial"
        : "Cruce pendiente";

  const summary =
    imssDocumentsCount > 0 && infonavitSignalsCount > 0
      ? "Ya hay señales visibles de IMSS e Infonavit dentro del expediente y puedes revalidarlas sin salir de AuditaPatron."
      : imssDocumentsCount > 0
        ? "Ya hay señales visibles de IMSS, pero todavía conviene reforzar o confirmar el frente de Infonavit dentro del expediente."
        : infonavitSignalsCount > 0
          ? "Ya hay señales visibles de Infonavit, pero todavía conviene reforzar o confirmar el frente de IMSS dentro del expediente."
          : "Todavía faltan señales suficientes de IMSS e Infonavit para darte un cruce más completo dentro del expediente.";

  const recommendedNextStep =
    imssDocumentsCount > 0 && infonavitSignalsCount > 0
      ? "Puedes revalidar cuando subas un documento nuevo o cuando quieras confirmar de nuevo tus señales de seguridad social."
      : imssDocumentsCount > 0
        ? "Si cuentas con un estado de cuenta o constancia relacionada con Infonavit, súbela para cerrar mejor el cruce."
        : infonavitSignalsCount > 0
          ? "Si cuentas con alta, semanas cotizadas o salario registrado ante IMSS, súbelo para cerrar mejor el cruce."
          : "Empieza por un soporte IMSS o un estado de cuenta o constancia relacionada con Infonavit para abrir este cruce.";

  const recommendedDocumentKey =
    imssDocumentsCount > 0 && infonavitSignalsCount > 0
      ? null
      : imssDocumentsCount > 0
        ? "infonavit"
        : infonavitSignalsCount > 0
          ? "imss"
          : "imss_or_infonavit";

  const recommendedDocumentTitle =
    recommendedDocumentKey === "infonavit"
      ? "Estado de cuenta o constancia de Infonavit"
      : recommendedDocumentKey === "imss"
        ? "Alta, semanas cotizadas o salario registrado ante IMSS"
        : recommendedDocumentKey === "imss_or_infonavit"
          ? "Un soporte de IMSS o una constancia de Infonavit"
          : "Cruce base cubierto";

  const recommendedDocumentReason =
    recommendedDocumentKey === null
      ? "Tu cruce base ya está visible; el siguiente mejor paso es revalidar cuando subas evidencia nueva o quieras confirmar otra vez el estado actual."
      : recommendedDocumentKey === "infonavit"
        ? "Ya hay señal suficiente del frente IMSS y el mayor salto de claridad ahora viene de reforzar el lado de Infonavit."
        : recommendedDocumentKey === "imss"
          ? "Ya hay señal suficiente del frente Infonavit y el mayor salto de claridad ahora viene de reforzar el lado de IMSS."
          : "Todavía no hay señales firmes de IMSS e Infonavit, así que cualquiera de esos soportes puede abrir el cruce inicial del expediente.";

  const clarityChangeLabel =
    lastRecordedCoverage === null
      ? "Todavía no hay una revalidación registrada para comparar la claridad actual del expediente."
      : hasNewClarity
        ? `Tu expediente ganó ${clarityDelta} punto${clarityDelta === 1 ? "" : "s"} de claridad desde la última revalidación.`
        : "La claridad actual ya está alineada con la última revalidación registrada en tu expediente.";

  return {
    coverageScore,
    statusLabel,
    summary,
    recommendedNextStep,
    actionLabel: "Revalidar IMSS e Infonavit",
    imssDocumentsCount,
    infonavitSignalsCount,
    hasImssSignal: imssDocumentsCount > 0,
    hasInfonavitSignal: infonavitSignalsCount > 0,
    documentsWithOpinion,
    lastRevalidatedAt: lastRevalidation?.recordedAt ?? null,
    lastRevalidationSummary: lastRevalidation?.summary ?? null,
    revalidationHistory: revalidationHistory.slice(0, 3),
    revalidationCount: revalidationHistory.length,
    hasNewClarity,
    clarityDelta,
    clarityChangeLabel,
    recommendedDocumentKey,
    recommendedDocumentTitle,
    recommendedDocumentReason,
  };
}

function buildHeliosCopilotSuggestedPrompts(params: {
  opinion: Record<string, unknown> | null;
  documentsCount: number;
}) {
  const prompts = [
    "¿Cuáles son los riesgos principales de mi expediente?",
    "¿Qué paso práctico me conviene seguir ahora?",
  ];

  if (params.documentsCount > 0) {
    prompts.push("Explícame el resumen de mi auditoría en palabras simples.");
  }

  if (getOptionalString(params.opinion?.recommendedNextStep)) {
    prompts.push("Explícame por qué recomiendas ese siguiente paso.");
  }

  if (getOptionalStringList(params.opinion?.uncertainties).length > 0) {
    prompts.push("¿Qué cosas todavía faltan confirmar en mis documentos?");
  }

  return Array.from(new Set(prompts)).slice(0, 4);
}

function buildHeliosCopilotContext(params: {
  detail: Awaited<ReturnType<typeof getCaseDetailForUser>>;
  documents: Awaited<ReturnType<typeof listVisibleDocuments>>;
}) {
  const caseSummary = {
    title: params.detail.case.title,
    employeeName: params.detail.case.employeeName ?? null,
    employerEntity: params.detail.case.employerEntity ?? null,
    status: params.detail.case.status,
    summary: params.detail.case.summary ?? null,
    openedAt: params.detail.case.openedAt?.toISOString?.() ?? params.detail.case.openedAt,
    lastActivityAt: params.detail.case.lastActivityAt?.toISOString?.() ?? params.detail.case.lastActivityAt,
  };

  const documents = params.documents.slice(0, 6).map((document) => {
    const opinion = asObjectRecord(document.heliosOpinion);
    return {
      documentId: document.documentId,
      originalName: document.originalName,
      documentType: document.documentType,
      classificationConfidence: document.classificationConfidence,
      createdAt: document.createdAt?.toISOString?.() ?? document.createdAt,
      heliosSummary: getOptionalString(opinion?.summary),
      legalOpinion: getOptionalString(opinion?.legalOpinion),
      recommendedNextStep: getOptionalString(opinion?.recommendedNextStep),
      recommendedActions: getOptionalStringList(opinion?.recommendedActions).slice(0, 4),
      uncertainties: getOptionalStringList(opinion?.uncertainties).slice(0, 4),
      riskLevel: getOptionalString(opinion?.riskLevel),
      confidenceScore: getOptionalNumber(opinion?.confidenceScore),
    };
  });

  return JSON.stringify(
    {
      case: caseSummary,
      documents,
      guidance:
        "Responde solo con base en este expediente visible. Si algo no aparece aquí, dilo con claridad en vez de asumirlo.",
    },
    null,
    2,
  );
}

function buildHeliosCopilotFallbackAnswer(params: {
  opinion: Record<string, unknown> | null;
  documentsCount: number;
}) {
  if (params.documentsCount === 0) {
    return "Todavía no veo documentos integrados en este expediente. Si subes primero tu contrato, un recibo de nómina o un CFDI, podré darte una explicación más útil sobre riesgos, diferencias y siguientes pasos.";
  }

  const summary = getOptionalString(params.opinion?.summary);
  const nextStep = getOptionalString(params.opinion?.recommendedNextStep);
  const uncertainties = getOptionalStringList(params.opinion?.uncertainties);

  const sections = [
    summary ?? "Ya existe una lectura preliminar del expediente, pero todavía hace falta más contexto para responder con mayor precisión.",
    nextStep ? `Siguiente paso sugerido: ${nextStep}` : null,
    uncertainties.length > 0 ? `Todavía conviene confirmar: ${uncertainties.slice(0, 2).join("; ")}.` : null,
  ].filter((item): item is string => Boolean(item));

  return sections.join("\n\n");
}

function buildHeliosCopilotSupportingDocuments(params: {
  documents: Awaited<ReturnType<typeof listVisibleDocuments>>;
}) {
  return [...params.documents]
    .sort((left, right) => {
      const leftHasOpinion = Number(Boolean(asObjectRecord(left.heliosOpinion)));
      const rightHasOpinion = Number(Boolean(asObjectRecord(right.heliosOpinion)));

      if (leftHasOpinion !== rightHasOpinion) {
        return rightHasOpinion - leftHasOpinion;
      }

      return new Date(right.createdAt ?? 0).getTime() - new Date(left.createdAt ?? 0).getTime();
    })
    .slice(0, 3)
    .map((document) => {
      const opinion = asObjectRecord(document.heliosOpinion);
      const summary = getOptionalString(opinion?.summary);
      const nextStep = getOptionalString(opinion?.recommendedNextStep);
      const uncertainties = getOptionalStringList(opinion?.uncertainties);

      return {
        id: document.documentId,
        label: document.originalName,
        detail: [
          `Tipo: ${document.documentType}.`,
          summary ? `Lectura visible: ${summary}` : null,
          nextStep ? `Paso sugerido: ${nextStep}` : null,
          uncertainties[0] ? `Por confirmar: ${uncertainties[0]}` : null,
        ]
          .filter((item): item is string => Boolean(item))
          .join(" "),
      };
    });
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),
  workspace: router({
    bootstrap: protectedProcedure.mutation(async ({ ctx }) => {
      const tenant = await ensureTenantForUser({
        userId: ctx.user.id,
        userName: ctx.user.name ?? ctx.user.email ?? "CompliLink",
        userEmail: ctx.user.email,
      });
      await seedDemoCaseIfEmpty(ctx.user.id);
      const snapshot = await getSystemSnapshot(ctx.user.id);
      return {
        tenant,
        snapshot,
        legal: {
          acceptanceVersion: LEGAL_ACCEPTANCE_VERSION,
          legalVersion: LEGAL_VERSION,
          effectiveDate: LEGAL_EFFECTIVE_DATE,
          documents: LEGAL_DOCUMENTS.map((document) => ({
            slug: document.slug,
            route: document.route,
            shortTitle: document.shortTitle,
            fullTitle: document.fullTitle,
            version: document.version,
            effectiveDate: document.effectiveDate,
          })),
        },
      };
    }),
    snapshot: protectedProcedure.query(async ({ ctx }) => {
      return getSystemSnapshot(ctx.user.id);
    }),
  }),
  tenants: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return listTenantsForUser(ctx.user.id);
    }),
    members: protectedProcedure
      .input(
        z.object({
          tenantId: z.string().min(3),
        }),
      )
      .query(async ({ ctx, input }) => {
        await assertTenantAdminAccess(ctx.user.id, input.tenantId);
        return listAccessibleUsersByTenant(input.tenantId);
      }),
  }),
  dashboard: router({
    summary: protectedProcedure.query(async ({ ctx }) => {
      return getDashboardForUser(ctx.user.id);
    }),
    ceoSnapshot: adminProcedure.query(async () => {
      return getCeoDashboardSnapshot();
    }),
  }),
  cases: router({
    list: protectedProcedure
      .input(
        z
          .object({
            tenantId: z.string().min(3).optional(),
            status: caseStatusSchema.optional(),
            from: z.string().datetime().optional(),
            to: z.string().datetime().optional(),
          })
          .optional(),
      )
      .query(async ({ ctx, input }) => {
        return listCasesForUser({
          userId: ctx.user.id,
          tenantId: input?.tenantId,
          status: input?.status,
          from: input?.from ? new Date(input.from) : undefined,
          to: input?.to ? new Date(input.to) : undefined,
        });
      }),
    detail: protectedProcedure
      .input(
        z.object({
          tenantId: z.string().min(3),
          caseId: z.string().min(3),
        }),
      )
      .query(async ({ ctx, input }) => {
        const detail = await getCaseDetailForUser({
          userId: ctx.user.id,
          tenantId: input.tenantId,
          caseId: input.caseId,
        });
        const documents = await listVisibleDocuments({
          userId: ctx.user.id,
          tenantId: input.tenantId,
          caseId: input.caseId,
        });
        const heliosDocumentsCount = documents.filter((item) => Boolean(asObjectRecord(item.heliosOpinion))).length;
        const heliosExpedienteState = getHeliosExpedienteStage({
          caseStatus: detail.case.status,
          documentsCount: documents.length,
          documentsWithOpinion: heliosDocumentsCount,
          closedAt: detail.case.closedAt,
        });
        const heliosDocuments = documents.map((document) => {
          const heliosOpinion = asObjectRecord(document.heliosOpinion);
          const heliosDocumentState = getHeliosDocumentState({
            documentType: document.documentType,
            hasOpinion: Boolean(heliosOpinion),
            processedAt: document.processedAt,
          });

          return {
            documentId: document.documentId,
            heliosDocumentId: document.documentId,
            heliosExpedienteId: detail.case.caseId,
            canonicalType: heliosDocumentState.canonicalType,
            canonicalLabel: heliosDocumentState.canonicalLabel,
            status: heliosDocumentState.status,
            statusLabel: heliosDocumentState.statusLabel,
            summary: getOptionalString(heliosOpinion?.summary) ?? heliosDocumentState.summary,
            hasOpinion: Boolean(heliosOpinion),
          };
        });
        const socialSecurityValidation = buildSocialSecurityValidationSummary({
          documents,
          events: detail.events,
        });
        const complilinkMonitoring = buildCompliLinkMonitoring(documents, detail.events);
        const legalAcceptance = buildLegalAcceptanceSummary(detail.consents);
        return {
          ...detail,
          documents,
          complilinkMonitoring,
          legalAcceptance,
          legalDocuments: LEGAL_DOCUMENTS.map((document) => ({
            slug: document.slug,
            route: document.route,
            shortTitle: document.shortTitle,
            fullTitle: document.fullTitle,
            version: document.version,
            effectiveDate: document.effectiveDate,
          })),
          heliosExpediente: {
            heliosExpedienteId: detail.case.caseId,
            displayName: detail.case.employeeName ? `Expediente Helios de ${detail.case.employeeName}` : detail.case.title,
            stage: heliosExpedienteState.stage,
            stageLabel: heliosExpedienteState.stageLabel,
            summary: heliosExpedienteState.summary,
            documentsCount: documents.length,
            documentsWithOpinion: heliosDocumentsCount,
          },
          heliosDocuments,
          socialSecurityValidation,
        };
      }),
    heliosCopilotChat: protectedProcedure
      .input(
        z.object({
          tenantId: z.string().min(3),
          caseId: z.string().min(3),
          prompt: z.string().trim().min(3).max(2000),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const detail = await getCaseDetailForUser({
          userId: ctx.user.id,
          tenantId: input.tenantId,
          caseId: input.caseId,
        });
        const documents = await listVisibleDocuments({
          userId: ctx.user.id,
          tenantId: input.tenantId,
          caseId: input.caseId,
        });
        const latestOpinion = asObjectRecord(documents.find((item) => asObjectRecord(item.heliosOpinion))?.heliosOpinion);
        const legalAcceptance = buildLegalAcceptanceSummary(detail.consents);
        const suggestedPrompts = buildHeliosCopilotSuggestedPrompts({
          opinion: latestOpinion,
          documentsCount: documents.length,
        });
        const disclaimer =
          getOptionalString(latestOpinion?.disclaimer) ??
          `Esta respuesta se basa en los documentos visibles del expediente y en el marco operativo vigente de AuditaPatron ${LEGAL_VERSION}. No sustituye asesoría profesional vinculante.`;
        const confidenceScore = getOptionalNumber(latestOpinion?.confidenceScore);
        const fallbackAnswer = buildHeliosCopilotFallbackAnswer({
          opinion: latestOpinion,
          documentsCount: documents.length,
        });
        const supportingDocuments = buildHeliosCopilotSupportingDocuments({ documents });

        let answer = fallbackAnswer;

        if (documents.length > 0) {
          try {
            const response = await invokeLLM({
              messages: [
                {
                  role: "system",
                  content:
                    "Eres Helios, el copiloto laboral de AuditaPatron para México. Responde siempre en español claro, práctico y breve. Usa únicamente el contexto del expediente proporcionado. Si falta información, dilo de frente. No inventes hechos, no prometas resultados, no sustituyas a un abogado y evita lenguaje alarmista. Reconoce derechos ARCO, revocación y límites del expediente digital cuando sea pertinente. Cierra con una nota corta recordando que es orientación general basada en documentos visibles.",
                },
                {
                  role: "user",
                  content: `Contexto del expediente:\n${buildHeliosCopilotContext({ detail, documents })}\n\nMarco operativo y legal:\n${HELIOS_CONTEXT_NOTE}\n- Estado de aceptación legal visible: ${
                    legalAcceptance.isAccepted
                      ? `vigente ${legalAcceptance.legalVersion} aceptada el ${legalAcceptance.acceptedAt ?? "sin timestamp visible"}`
                      : `la aceptación vigente ${legalAcceptance.legalVersion} todavía no consta para este expediente`
                  }.\n\nPregunta de la persona usuaria: ${input.prompt}\n\nResponde con cuatro partes breves: 1) respuesta clara, 2) lo que sí se sabe, 3) lo que falta confirmar si aplica, 4) siguiente paso útil.`,
                },
              ],
            });

            const candidate = readLlmMessageText(response.choices[0]?.message.content).trim();
            if (candidate) {
              answer = candidate;
            }
          } catch {
            answer = fallbackAnswer;
          }
        }

        await createAuditLog({
          tenantId: input.tenantId,
          caseId: input.caseId,
          traceId: detail.case.traceId,
          actorUserId: ctx.user.id,
          entityType: "case",
          entityId: input.caseId,
          action: "case.helios_copilot_chat",
          afterState: {
            prompt: input.prompt,
            sourceDocumentCount: documents.length,
            confidenceScore,
            suggestedPrompts,
            supportingDocuments,
          },
        });

        return {
          answer,
          disclaimer,
          confidenceScore,
          suggestedPrompts,
          supportingDocuments,
          sourceDocumentCount: documents.length,
        };
      }),
    revalidateSocialSecurity: protectedProcedure
      .input(
        z.object({
          tenantId: z.string().min(3),
          caseId: z.string().min(3),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const detail = await getCaseDetailForUser({
          userId: ctx.user.id,
          tenantId: input.tenantId,
          caseId: input.caseId,
        });
        const documents = await listVisibleDocuments({
          userId: ctx.user.id,
          tenantId: input.tenantId,
          caseId: input.caseId,
        });
        const socialSecurityValidation = buildSocialSecurityValidationSummary({
          documents,
          events: detail.events,
        });
        const recordedAt = new Date();
        const revalidationContract = {
          engine: "helios" as const,
          scope: "social_security" as const,
          tenantId: input.tenantId,
          caseId: input.caseId,
          traceId: detail.case.traceId,
          generatedAt: recordedAt.toISOString(),
          status: socialSecurityValidation.hasImssSignal || socialSecurityValidation.hasInfonavitSignal ? "completed" : "partial",
          summary: socialSecurityValidation.summary,
          statusLabel: socialSecurityValidation.statusLabel,
          coverageScore: socialSecurityValidation.coverageScore,
          recommendedNextStep: socialSecurityValidation.recommendedNextStep,
          recommendedDocument: {
            key: socialSecurityValidation.recommendedDocumentKey,
            title: socialSecurityValidation.recommendedDocumentTitle,
            reason: socialSecurityValidation.recommendedDocumentReason,
          },
          hasNewClarity: socialSecurityValidation.hasNewClarity,
          clarityDelta: socialSecurityValidation.clarityDelta,
          signals: {
            imssDocumentsCount: socialSecurityValidation.imssDocumentsCount,
            infonavitSignalsCount: socialSecurityValidation.infonavitSignalsCount,
            documentsWithOpinion: socialSecurityValidation.documentsWithOpinion,
          },
        };

        await upsertCanonicalContract({
          tenantId: input.tenantId,
          caseId: input.caseId,
          traceId: detail.case.traceId,
          contractType: "audit",
          schemaVersion: "helios_social_security_v1",
          payload: JSON.stringify(revalidationContract),
          status: "ready",
        });

        await addCaseEvent({
          tenantId: input.tenantId,
          caseId: input.caseId,
          traceId: detail.case.traceId,
          actorUserId: ctx.user.id,
          eventType: "note_added",
          title: "Revalidación IMSS/Infonavit actualizada",
          description: socialSecurityValidation.summary,
          metadata: JSON.stringify({
            engine: "helios",
            revalidation_scope: "social_security",
            summary: socialSecurityValidation.summary,
            status_label: socialSecurityValidation.statusLabel,
            coverage_score: socialSecurityValidation.coverageScore,
            imss_documents_count: socialSecurityValidation.imssDocumentsCount,
            infonavit_signals_count: socialSecurityValidation.infonavitSignalsCount,
            recommended_next_step: socialSecurityValidation.recommendedNextStep,
            recommended_document_key: socialSecurityValidation.recommendedDocumentKey,
            recommended_document_title: socialSecurityValidation.recommendedDocumentTitle,
            recommended_document_reason: socialSecurityValidation.recommendedDocumentReason,
            has_new_clarity: socialSecurityValidation.hasNewClarity,
            clarity_delta: socialSecurityValidation.clarityDelta,
            generated_at: recordedAt.toISOString(),
          }),
          eventAt: recordedAt,
        });

        await createAuditLog({
          tenantId: input.tenantId,
          caseId: input.caseId,
          traceId: detail.case.traceId,
          actorUserId: ctx.user.id,
          entityType: "case",
          entityId: input.caseId,
          action: "case.revalidate_social_security",
          afterState: revalidationContract,
        });

        return {
          ...socialSecurityValidation,
          lastRevalidatedAt: recordedAt.toISOString(),
          lastRevalidationSummary: socialSecurityValidation.summary,
        };
      }),
    persistAuditarViewState: protectedProcedure
      .input(
        z.object({
          tenantId: z.string().min(3),
          caseId: z.string().min(3),
          viewState: z.object({
            historyFilter: auditarHistoryFilterSchema.optional(),
            mobileOnboardingIndex: z.number().int().min(0).max(2).optional(),
            selectedRecommendedTargetType: auditarTargetTypeSchema.nullable().optional(),
            preferredCaptureMode: auditarCaptureModeSchema.nullable().optional(),
          }),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const detail = await getCaseDetailForUser({
          userId: ctx.user.id,
          tenantId: input.tenantId,
          caseId: input.caseId,
        });

        const viewState = await persistAuditarViewState({
          userId: ctx.user.id,
          tenantId: input.tenantId,
          caseId: input.caseId,
          traceId: detail.case.traceId,
          viewState: input.viewState,
        });

        return {
          viewState,
          persistedAt: new Date().toISOString(),
        };
      }),
    create: protectedProcedure
      .input(
        z.object({
          tenantId: z.string().min(3),
          title: z.string().min(5).max(255),
          employeeName: z.string().max(255).optional(),
          employerEntity: z.string().max(255).optional(),
          summary: z.string().max(5000).optional(),
          status: caseStatusSchema.default("intake"),
          priority: casePrioritySchema.default("medium"),
          dueAt: z.string().datetime().optional(),
          assignToUserId: z.number().int().positive().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        await assertTenantAdminAccess(ctx.user.id, input.tenantId);

        if (input.assignToUserId) {
          await assertActiveTenantMember(input.assignToUserId, input.tenantId);
        }

        const caseId = buildCaseId(input.tenantId);
        const traceId = buildTraceId(input.tenantId, caseId);
        const canonicalCase = buildCanonicalCaseContract({
          tenantId: input.tenantId,
          caseId,
          traceId,
          title: input.title,
          status: input.status,
          priority: input.priority,
          employeeName: input.employeeName,
          employerEntity: input.employerEntity,
          summary: input.summary,
        });

        const createdCase = await createCaseRecord({
          tenantId: input.tenantId,
          caseId,
          traceId,
          title: input.title,
          employeeName: input.employeeName,
          employerEntity: input.employerEntity,
          jurisdiction: "México",
          status: input.status,
          priority: input.priority,
          assignedUserId: input.assignToUserId ?? ctx.user.id,
          summary: input.summary,
          canonicalPayload: JSON.stringify(canonicalCase),
          openedAt: new Date(),
          dueAt: input.dueAt ? new Date(input.dueAt) : undefined,
          lastActivityAt: new Date(),
        });

        await grantCaseAccess({
          tenantId: input.tenantId,
          caseId,
          traceId,
          userId: ctx.user.id,
          grantedByUserId: ctx.user.id,
          accessLevel: "owner",
          status: "active",
        });

        if (input.assignToUserId && input.assignToUserId !== ctx.user.id) {
          await grantCaseAccess({
            tenantId: input.tenantId,
            caseId,
            traceId,
            userId: input.assignToUserId,
            grantedByUserId: ctx.user.id,
            accessLevel: "editor",
            status: "active",
          });
        }

        await addCaseEvent({
          tenantId: input.tenantId,
          caseId,
          traceId,
          actorUserId: ctx.user.id,
          eventType: "case_created",
          title: "Caso creado",
          description: `Se creó el expediente ${caseId} con trazabilidad canónica inicial.`,
          metadata: JSON.stringify({ tenant_id: input.tenantId, case_id: caseId, trace_id: traceId }),
          eventAt: new Date(),
        });

        await upsertCanonicalContract({
          tenantId: input.tenantId,
          caseId,
          traceId,
          contractType: "case",
          schemaVersion: "v1",
          payload: JSON.stringify(canonicalCase),
          status: "ready",
        });

        await upsertCanonicalContract({
          tenantId: input.tenantId,
          caseId,
          traceId,
          contractType: "shared_engine",
          schemaVersion: "v1",
          payload: JSON.stringify(
            buildSharedEngineEnvelope({
              tenantId: input.tenantId,
              caseId,
              traceId,
              caseContract: canonicalCase,
              documentContracts: [],
            }),
          ),
          status: "ready",
        });

        await createAuditLog({
          tenantId: input.tenantId,
          caseId,
          traceId,
          actorUserId: ctx.user.id,
          entityType: "case",
          entityId: caseId,
          action: "case.create",
          afterState: createdCase,
        });

        return createdCase;
      }),
    updateStatus: protectedProcedure
      .input(
        z.object({
          tenantId: z.string().min(3),
          caseId: z.string().min(3),
          status: caseStatusSchema,
          priority: casePrioritySchema.optional(),
          dueAt: z.string().datetime().nullable().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        await assertCaseWriteAccess(ctx.user.id, input.tenantId, input.caseId);

        const updatedCase = await updateCaseStatus({
          tenantId: input.tenantId,
          caseId: input.caseId,
          status: input.status,
          priority: input.priority,
          dueAt: input.dueAt ? new Date(input.dueAt) : input.dueAt === null ? null : undefined,
        });

        await addCaseEvent({
          tenantId: input.tenantId,
          caseId: input.caseId,
          traceId: updatedCase.traceId,
          actorUserId: ctx.user.id,
          eventType: "status_changed",
          title: "Estatus actualizado",
          description: `El caso cambió a ${input.status}.`,
          metadata: JSON.stringify({ status: input.status, priority: input.priority ?? updatedCase.priority }),
          eventAt: new Date(),
        });

        await createAuditLog({
          tenantId: input.tenantId,
          caseId: input.caseId,
          traceId: updatedCase.traceId,
          actorUserId: ctx.user.id,
          entityType: "case",
          entityId: input.caseId,
          action: "case.update_status",
          afterState: updatedCase,
        });

        return updatedCase;
      }),
    analyzeDocumentDraft: protectedProcedure
      .input(
        z.object({
          tenantId: z.string().min(3),
          caseId: z.string().min(3),
          fileName: z.string().min(1).max(255),
          mimeType: z.string().min(3).max(128),
          base64Content: z.string().min(10),
          textHint: z.string().max(5000).optional(),
          expectedDocumentType: auditarTargetTypeSchema.optional(),
          captureMode: auditarCaptureModeSchema.optional(),
          sourceChannel: z.enum(["manual", "email", "api", "bulk_import"]).default("manual"),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const detail = await getCaseDetailForUser({
          userId: ctx.user.id,
          tenantId: input.tenantId,
          caseId: input.caseId,
        });

        const binary = decodeBase64File(input.base64Content);
        const sha256 = computeSha256(binary);
        const draftId = buildDraftId();
        const safeFileName = sanitizeFileName(input.fileName);
        const storageKey = buildDocumentStorageKey({
          tenantId: input.tenantId,
          caseId: input.caseId,
          documentId: draftId,
          fileName: safeFileName,
        });
        const uploaded = await storagePut(storageKey, binary, input.mimeType);
        const expectedDocumentTypeHint = buildExpectedDocumentTypeHint(input.expectedDocumentType);
        const enrichedTextHint = [input.textHint, expectedDocumentTypeHint].filter(Boolean).join(" ");
        const classification = classifyMexicanLaborDocument({
          fileName: safeFileName,
          mimeType: input.mimeType,
          textHint: enrichedTextHint || undefined,
        });
        const scanAssistance = await analyzeDocumentScanAssist({
          fileUrl: uploaded.url,
          mimeType: input.mimeType,
          fileName: safeFileName,
          expectedDocumentType: input.expectedDocumentType,
          textHint: input.textHint,
        });
        const basePreliminaryAnalysis = buildPreliminaryLaborAnalysis({
          fileName: safeFileName,
          mimeType: input.mimeType,
          textHint: enrichedTextHint || undefined,
          classification,
        });
        const structuredExtraction = await analyzeStructuredDocumentPreview({
          fileUrl: uploaded.url,
          mimeType: input.mimeType,
          fileName: safeFileName,
          textHint: enrichedTextHint || undefined,
          classification,
          preliminaryAnalysis: basePreliminaryAnalysis,
        });
        const preliminaryAnalysis: DraftPreliminaryAnalysis = {
          ...basePreliminaryAnalysis,
          structuredExtraction,
        };
        const createdAt = new Date();

        const draftPayload: AuditarDraftContractPayload = {
          draftId,
          fileName: safeFileName,
          mimeType: input.mimeType,
          sizeBytes: binary.byteLength,
          sha256,
          storageKey: uploaded.key,
          storageUrl: uploaded.url,
          textHint: input.textHint ?? null,
          expectedDocumentType: input.expectedDocumentType ?? null,
          captureMode: input.captureMode ?? null,
          sourceChannel: input.sourceChannel,
          classification,
          preliminaryAnalysis,
          scanAssistance,
          createdAt: createdAt.toISOString(),
        };

        await upsertCanonicalContract({
          tenantId: input.tenantId,
          caseId: input.caseId,
          traceId: detail.case.traceId,
          contractType: "classification",
          schemaVersion: "auditar_preview_v1",
          payload: JSON.stringify(draftPayload),
          status: "draft",
        });

        await createAuditLog({
          tenantId: input.tenantId,
          caseId: input.caseId,
          traceId: detail.case.traceId,
          actorUserId: ctx.user.id,
          entityType: "system",
          entityId: draftId,
          action: "document.preview_analyzed",
          afterState: {
            draftId,
            fileName: safeFileName,
            classification,
            scanAssistance,
            captureMode: input.captureMode ?? null,
            expectedDocumentType: input.expectedDocumentType ?? null,
          },
        });

        return buildDraftPreviewPayload(draftPayload);
      }),
    confirmDocumentDraft: protectedProcedure
      .input(
        z.object({
          tenantId: z.string().min(3),
          caseId: z.string().min(3),
          draftId: z.string().min(3),
          visibility: documentVisibilitySchema.default("case_team"),
          consentStatus: documentConsentStatusSchema.default("pending"),
          sourceChannel: z.enum(["manual", "email", "api", "bulk_import"]).default("manual"),
          manualOverrides: z.array(auditarManualOverrideSchema).max(5).optional().default([]),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        await assertCaseWriteAccess(ctx.user.id, input.tenantId, input.caseId);

        const detail = await getCaseDetailForUser({
          userId: ctx.user.id,
          tenantId: input.tenantId,
          caseId: input.caseId,
        });

        const draft = await getAuditarDraftById({
          tenantId: input.tenantId,
          caseId: input.caseId,
          draftId: input.draftId,
        });

        if (!draft) {
          throw new Error("La vista previa de este documento ya no está disponible. Súbelo otra vez para revisarlo antes de guardar.");
        }

        const payload = draft.payload as AuditarDraftContractPayload;
        const classification = payload.classification;
        const manualOverrides = normalizeManualFieldOverrides(input.manualOverrides);
        const preliminaryAnalysis = applyManualFieldOverrides({
          preliminaryAnalysis: payload.preliminaryAnalysis,
          overrides: manualOverrides,
        });
        const scanAssistance = payload.scanAssistance;
        const processedAt = new Date();
        const documentId = buildDocumentId();

        const documentRecord = await addDocumentRecord({
          tenantId: input.tenantId,
          caseId: input.caseId,
          traceId: detail.case.traceId,
          documentId,
          uploadedByUserId: ctx.user.id,
          originalName: payload.fileName,
          mimeType: payload.mimeType,
          sizeBytes: payload.sizeBytes,
          storageKey: payload.storageKey,
          storageUrl: payload.storageUrl,
          sha256: payload.sha256,
          documentType: classification.documentType,
          sourceChannel: input.sourceChannel,
          integrityStatus: "verified",
          consentStatus: input.consentStatus,
          visibility: input.visibility,
          classificationConfidence: classification.classificationConfidence,
          processedAt,
        });

        await updateDocumentPostProcessing({
          documentId,
          documentType: classification.documentType,
          classificationConfidence: classification.classificationConfidence,
          integrityStatus: "verified",
          processedAt,
          consentStatus: input.consentStatus,
        });

        const documentContract = buildCanonicalDocumentContract({
          tenantId: input.tenantId,
          caseId: input.caseId,
          traceId: detail.case.traceId,
          documentId,
          documentType: classification.documentType,
          sha256: payload.sha256,
          storageKey: payload.storageKey,
          storageUrl: payload.storageUrl,
          visibility: input.visibility,
          consentStatus: input.consentStatus,
          classificationConfidence: classification.classificationConfidence,
          originalName: payload.fileName,
          mimeType: payload.mimeType,
          sizeBytes: payload.sizeBytes,
        });

        await addCaseEvent({
          tenantId: input.tenantId,
          caseId: input.caseId,
          traceId: detail.case.traceId,
          actorUserId: ctx.user.id,
          eventType: "document_uploaded",
          title: "Documento confirmado y guardado",
          description: `${payload.fileName} fue confirmado después de la vista previa y quedó guardado con clasificación inicial ${classification.documentType}.`,
          metadata: JSON.stringify({
            document_id: documentId,
            draft_id: payload.draftId,
            sha256: payload.sha256,
            visibility: input.visibility,
            classification_confidence: classification.classificationConfidence,
            expected_document_type: payload.expectedDocumentType ?? null,
            capture_mode: payload.captureMode ?? null,
            scan_assistance: scanAssistance,
            manual_override_keys: manualOverrides.map((item) => item.key),
          }),
          eventAt: new Date(),
        });

        await addCaseEvent({
          tenantId: input.tenantId,
          caseId: input.caseId,
          traceId: detail.case.traceId,
          actorUserId: ctx.user.id,
          eventType: "document_classified",
          title: "Documento clasificado",
          description: `Clasificación automática preliminar: ${classification.normalizedDocType}.`,
          metadata: JSON.stringify({
            draft_id: payload.draftId,
            reasons: classification.reasons,
            normalized_doc_type: classification.normalizedDocType,
            processing_profile: classification.processingProfile,
            review_recommendation: classification.reviewRecommendation,
            supports_structured_extraction: classification.supportsStructuredExtraction,
            supports_benefit_estimation: classification.supportsBenefitEstimation,
            expected_document_type: payload.expectedDocumentType ?? null,
          }),
          eventAt: new Date(),
        });

        await addCaseEvent({
          tenantId: input.tenantId,
          caseId: input.caseId,
          traceId: detail.case.traceId,
          actorUserId: ctx.user.id,
          eventType: "note_added",
          title: "Escaneo asistido evaluó la captura",
          description: `${scanAssistance.friendlyHeadline}. ${scanAssistance.userGuidance}`,
          metadata: JSON.stringify({
            document_id: documentId,
            draft_id: payload.draftId,
            readiness: scanAssistance.readiness,
            document_presence: scanAssistance.documentPresence,
            expected_type_alignment: scanAssistance.expectedTypeAlignment,
            confidence: scanAssistance.confidence,
            issues: scanAssistance.issues,
            capture_mode: payload.captureMode ?? null,
          }),
          eventAt: new Date(),
        });

        if (input.consentStatus === "pending") {
          await addOperationalAlert({
            tenantId: input.tenantId,
            caseId: input.caseId,
            traceId: detail.case.traceId,
            severity: "warning",
            category: "missing_consent",
            title: "Documento con consentimiento pendiente",
            description: `${payload.fileName} requiere cierre de consentimiento o base legal explícita.`,
            status: "open",
            raisedAt: new Date(),
          });
        }

        await upsertCanonicalContract({
          tenantId: input.tenantId,
          caseId: input.caseId,
          traceId: detail.case.traceId,
          contractType: "document",
          schemaVersion: "v1",
          payload: JSON.stringify(documentContract),
          status: "ready",
        });

        await upsertCanonicalContract({
          tenantId: input.tenantId,
          caseId: input.caseId,
          traceId: detail.case.traceId,
          contractType: "classification",
          schemaVersion: "v1",
          payload: JSON.stringify({
            draftId: payload.draftId,
            documentId,
            classification,
            preliminaryAnalysis,
            confirmedData: preliminaryAnalysis.confirmedData,
            estimatedData: preliminaryAnalysis.estimatedData,
            structuredExtraction: preliminaryAnalysis.structuredExtraction,
            extractionTargets: preliminaryAnalysis.extractionTargets,
            manualOverrides,
            generatedAt: processedAt.toISOString(),
            previewCreatedAt: payload.createdAt,
          }),
          status: "ready",
        });

        const caseContract = buildCanonicalCaseContract({
          tenantId: detail.case.tenantId,
          caseId: detail.case.caseId,
          traceId: detail.case.traceId,
          title: detail.case.title,
          status: detail.case.status,
          priority: detail.case.priority,
          employeeName: detail.case.employeeName,
          employerEntity: detail.case.employerEntity,
          summary: detail.case.summary,
        });

        const sharedEngineEnvelope = buildSharedEngineEnvelope({
          tenantId: input.tenantId,
          caseId: input.caseId,
          traceId: detail.case.traceId,
          caseContract,
          documentContracts: [documentContract],
        });

        await upsertCanonicalContract({
          tenantId: input.tenantId,
          caseId: input.caseId,
          traceId: detail.case.traceId,
          contractType: "shared_engine",
          schemaVersion: "v1",
          payload: JSON.stringify(sharedEngineEnvelope),
          status: "ready",
        });

        const heliosOpinionContract = buildHeliosOpinionContract({
          tenantId: input.tenantId,
          caseId: input.caseId,
          traceId: detail.case.traceId,
          documentId,
          documentType: classification.documentType,
          documentName: payload.fileName,
          jurisdiction: detail.case.jurisdiction,
          caseTitle: detail.case.title,
          preliminaryAnalysis: {
            confirmedData: preliminaryAnalysis.confirmedData,
            estimatedData: preliminaryAnalysis.estimatedData,
            guardrails: preliminaryAnalysis.guardrails,
          },
        });

        await upsertCanonicalContract({
          tenantId: input.tenantId,
          caseId: input.caseId,
          traceId: detail.case.traceId,
          contractType: "audit",
          schemaVersion: "helios_v1",
          payload: JSON.stringify(heliosOpinionContract),
          status: "ready",
        });

        await addCaseEvent({
          tenantId: input.tenantId,
          caseId: input.caseId,
          traceId: detail.case.traceId,
          actorUserId: ctx.user.id,
          eventType: "note_added",
          title: "Helios preparó una opinión inicial",
          description: heliosOpinionContract.opinion.summary,
          metadata: JSON.stringify({
            engine: "helios",
            document_id: documentId,
            draft_id: payload.draftId,
            risk_level: heliosOpinionContract.opinion.riskLevel,
            confidence_score: heliosOpinionContract.opinion.confidenceScore,
            generated_at: heliosOpinionContract.opinion.generatedAt,
          }),
          eventAt: new Date(heliosOpinionContract.opinion.generatedAt),
        });

        const engineDispatch = await sendDocumentToAuditaPatronEngine({
          caseContract,
          documentContract,
          sharedEngineEnvelope,
          sourceUserId: ctx.user.id,
          uploadedAt: documentRecord.createdAt ?? processedAt,
          docType: classification.normalizedDocType,
          auditId: detail.case.traceId,
          caseId: detail.case.caseId,
          metadata: {
            employerRfc:
              getRecordStringValue(preliminaryAnalysis.confirmedData, "employerRfc") ??
              getRecordStringValue(preliminaryAnalysis.estimatedData, "employerRfc") ??
              null,
            workerName:
              getRecordStringValue(preliminaryAnalysis.confirmedData, "workerName") ??
              getRecordStringValue(preliminaryAnalysis.estimatedData, "workerName") ??
              null,
            period:
              getRecordStringValue(preliminaryAnalysis.confirmedData, "period") ??
              getRecordStringValue(preliminaryAnalysis.estimatedData, "period") ??
              null,
            descriptiveDocType: classification.normalizedDocType,
          },
        });

        if (engineDispatch.status !== "sent") {
          await addOperationalAlert({
            tenantId: input.tenantId,
            caseId: input.caseId,
            traceId: detail.case.traceId,
            severity: engineDispatch.status === "failed" ? "critical" : "warning",
            category: "upload_pending",
            title: "Entrega al motor inteligente pendiente",
            description: `La entrega documental al motor inteligente no se completó el ${engineDispatch.dispatchedAt}. Estado: ${engineDispatch.status}. Motivo: ${engineDispatch.reason ?? "sin detalle"}.`,
            status: "open",
            raisedAt: new Date(engineDispatch.dispatchedAt),
          });
        } else {
          await addCaseEvent({
            tenantId: input.tenantId,
            caseId: input.caseId,
            traceId: detail.case.traceId,
            actorUserId: ctx.user.id,
            eventType: "note_added",
            title: "Documento enviado a CompliLink",
            description: "CompliLink recibió este documento y estamos esperando su respuesta automática.",
            metadata: JSON.stringify({
              document_id: documentId,
              draft_id: payload.draftId,
              stage: "complilink_dispatch",
              dispatch_status: engineDispatch.status,
              dispatched_at: engineDispatch.dispatchedAt,
              attempts: engineDispatch.attempts,
              http_status: engineDispatch.httpStatus,
            }),
            eventAt: new Date(engineDispatch.dispatchedAt),
          });
        }

        await createAuditLog({
          tenantId: input.tenantId,
          caseId: input.caseId,
          traceId: detail.case.traceId,
          documentId,
          actorUserId: ctx.user.id,
          entityType: "document",
          entityId: documentId,
          action: "document.upload",
          afterState: documentRecord,
        });

        await createAuditLog({
          tenantId: input.tenantId,
          caseId: input.caseId,
          traceId: detail.case.traceId,
          documentId,
          actorUserId: ctx.user.id,
          entityType: "document",
          entityId: documentId,
          action: "document.preview_confirmed",
          afterState: {
            draftId: payload.draftId,
            previewCreatedAt: payload.createdAt,
            structuredExtraction: preliminaryAnalysis.structuredExtraction,
            manualOverrides,
          },
        });

        await createAuditLog({
          tenantId: input.tenantId,
          caseId: input.caseId,
          traceId: detail.case.traceId,
          documentId,
          actorUserId: ctx.user.id,
          entityType: "document",
          entityId: documentId,
          action: "document.engine_dispatch",
          afterState: engineDispatch,
        });

        await createAuditLog({
          tenantId: input.tenantId,
          caseId: input.caseId,
          traceId: detail.case.traceId,
          documentId,
          actorUserId: ctx.user.id,
          entityType: "document",
          entityId: documentId,
          action: "document.helios_opinion",
          afterState: heliosOpinionContract,
        });

        await createAuditLog({
          tenantId: input.tenantId,
          caseId: input.caseId,
          traceId: detail.case.traceId,
          documentId,
          actorUserId: ctx.user.id,
          entityType: "document",
          entityId: documentId,
          action: "document.scan_assist",
          afterState: {
            scanAssistance,
            expectedDocumentType: payload.expectedDocumentType ?? null,
            captureMode: payload.captureMode ?? null,
          },
        });

        const refreshedDocuments = await listVisibleDocuments({
          userId: ctx.user.id,
          tenantId: input.tenantId,
          caseId: input.caseId,
        });
        const socialSecurityValidation = buildSocialSecurityValidationSummary({
          documents: refreshedDocuments,
          events: detail.events,
        });

        return {
          draftId: payload.draftId,
          document: documentRecord,
          classification,
          preliminaryAnalysis,
          documentContract,
          sharedEngineEnvelope,
          heliosOpinion: heliosOpinionContract.opinion,
          heliosOpinionContract,
          engineDispatch,
          scanAssistance,
          socialSecurityValidation,
          nextSuggestedDocument:
            socialSecurityValidation.recommendedDocumentKey === null
              ? null
              : {
                  key: socialSecurityValidation.recommendedDocumentKey,
                  title: socialSecurityValidation.recommendedDocumentTitle,
                  reason: socialSecurityValidation.recommendedDocumentReason,
                },
          newClarityNotification: socialSecurityValidation.hasNewClarity
            ? {
                title: "Tu expediente ganó nueva claridad",
                message: socialSecurityValidation.clarityChangeLabel,
                delta: socialSecurityValidation.clarityDelta,
              }
            : null,
        };
      }),
    uploadDocument: protectedProcedure
      .input(
        z.object({
          tenantId: z.string().min(3),
          caseId: z.string().min(3),
          fileName: z.string().min(1).max(255),
          mimeType: z.string().min(3).max(128),
          base64Content: z.string().min(10),
          textHint: z.string().max(5000).optional(),
          expectedDocumentType: auditarTargetTypeSchema.optional(),
          captureMode: auditarCaptureModeSchema.optional(),
          visibility: documentVisibilitySchema.default("case_team"),
          consentStatus: documentConsentStatusSchema.default("pending"),
          sourceChannel: z.enum(["manual", "email", "api", "bulk_import"]).default("manual"),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const detail = await getCaseDetailForUser({
          userId: ctx.user.id,
          tenantId: input.tenantId,
          caseId: input.caseId,
        });

        const binary = decodeBase64File(input.base64Content);
        const sha256 = computeSha256(binary);
        const documentId = buildDocumentId();
        const safeFileName = sanitizeFileName(input.fileName);
        const storageKey = buildDocumentStorageKey({
          tenantId: input.tenantId,
          caseId: input.caseId,
          documentId,
          fileName: safeFileName,
        });
        const uploaded = await storagePut(storageKey, binary, input.mimeType);
        const expectedDocumentTypeHint = buildExpectedDocumentTypeHint(input.expectedDocumentType);
        const enrichedTextHint = [input.textHint, expectedDocumentTypeHint].filter(Boolean).join(" ");
        const classification = classifyMexicanLaborDocument({
          fileName: safeFileName,
          mimeType: input.mimeType,
          textHint: enrichedTextHint || undefined,
        });
        const scanAssistance = await analyzeDocumentScanAssist({
          fileUrl: uploaded.url,
          mimeType: input.mimeType,
          fileName: safeFileName,
          expectedDocumentType: input.expectedDocumentType,
          textHint: input.textHint,
        });
        const basePreliminaryAnalysis = buildPreliminaryLaborAnalysis({
          fileName: safeFileName,
          mimeType: input.mimeType,
          textHint: enrichedTextHint || undefined,
          classification,
        });
        const structuredExtraction = await analyzeStructuredDocumentPreview({
          fileUrl: uploaded.url,
          mimeType: input.mimeType,
          fileName: safeFileName,
          textHint: enrichedTextHint || undefined,
          classification,
          preliminaryAnalysis: basePreliminaryAnalysis,
        });
        const preliminaryAnalysis: DraftPreliminaryAnalysis = {
          ...basePreliminaryAnalysis,
          structuredExtraction,
        };

        const processedAt = new Date();

        const documentRecord = await addDocumentRecord({
          tenantId: input.tenantId,
          caseId: input.caseId,
          traceId: detail.case.traceId,
          documentId,
          uploadedByUserId: ctx.user.id,
          originalName: safeFileName,
          mimeType: input.mimeType,
          sizeBytes: binary.byteLength,
          storageKey: uploaded.key,
          storageUrl: uploaded.url,
          sha256,
          documentType: classification.documentType,
          sourceChannel: input.sourceChannel,
          integrityStatus: "verified",
          consentStatus: input.consentStatus,
          visibility: input.visibility,
          classificationConfidence: classification.classificationConfidence,
          processedAt,
        });

        await updateDocumentPostProcessing({
          documentId,
          documentType: classification.documentType,
          classificationConfidence: classification.classificationConfidence,
          integrityStatus: "verified",
          processedAt,
          consentStatus: input.consentStatus,
        });

        const documentContract = buildCanonicalDocumentContract({
          tenantId: input.tenantId,
          caseId: input.caseId,
          traceId: detail.case.traceId,
          documentId,
          documentType: classification.documentType,
          sha256,
          storageKey: uploaded.key,
          storageUrl: uploaded.url,
          visibility: input.visibility,
          consentStatus: input.consentStatus,
          classificationConfidence: classification.classificationConfidence,
          originalName: safeFileName,
          mimeType: input.mimeType,
          sizeBytes: binary.byteLength,
        });

        await addCaseEvent({
          tenantId: input.tenantId,
          caseId: input.caseId,
          traceId: detail.case.traceId,
          actorUserId: ctx.user.id,
          eventType: "document_uploaded",
          title: "Documento cargado",
          description: `${safeFileName} fue cargado con hash SHA-256 y clasificación inicial ${classification.documentType}.`,
          metadata: JSON.stringify({
            document_id: documentId,
            sha256,
            visibility: input.visibility,
            classification_confidence: classification.classificationConfidence,
            expected_document_type: input.expectedDocumentType ?? null,
            capture_mode: input.captureMode ?? null,
            scan_assistance: scanAssistance,
          }),
          eventAt: new Date(),
        });

        await addCaseEvent({
          tenantId: input.tenantId,
          caseId: input.caseId,
          traceId: detail.case.traceId,
          actorUserId: ctx.user.id,
          eventType: "document_classified",
          title: "Documento clasificado",
          description: `Clasificación automática preliminar: ${classification.normalizedDocType}.`,
          metadata: JSON.stringify({
            reasons: classification.reasons,
            normalized_doc_type: classification.normalizedDocType,
            processing_profile: classification.processingProfile,
            review_recommendation: classification.reviewRecommendation,
            supports_structured_extraction: classification.supportsStructuredExtraction,
            supports_benefit_estimation: classification.supportsBenefitEstimation,
            expected_document_type: input.expectedDocumentType ?? null,
          }),
          eventAt: new Date(),
        });

        await addCaseEvent({
          tenantId: input.tenantId,
          caseId: input.caseId,
          traceId: detail.case.traceId,
          actorUserId: ctx.user.id,
          eventType: "note_added",
          title: "Escaneo asistido evaluó la captura",
          description: `${scanAssistance.friendlyHeadline}. ${scanAssistance.userGuidance}`,
          metadata: JSON.stringify({
            document_id: documentId,
            readiness: scanAssistance.readiness,
            document_presence: scanAssistance.documentPresence,
            expected_type_alignment: scanAssistance.expectedTypeAlignment,
            confidence: scanAssistance.confidence,
            issues: scanAssistance.issues,
            capture_mode: input.captureMode ?? null,
          }),
          eventAt: new Date(),
        });

        if (input.consentStatus === "pending") {
          await addOperationalAlert({
            tenantId: input.tenantId,
            caseId: input.caseId,
            traceId: detail.case.traceId,
            severity: "warning",
            category: "missing_consent",
            title: "Documento con consentimiento pendiente",
            description: `${safeFileName} requiere cierre de consentimiento o base legal explícita.`,
            status: "open",
            raisedAt: new Date(),
          });
        }

        await upsertCanonicalContract({
          tenantId: input.tenantId,
          caseId: input.caseId,
          traceId: detail.case.traceId,
          contractType: "document",
          schemaVersion: "v1",
          payload: JSON.stringify(documentContract),
          status: "ready",
        });

        await upsertCanonicalContract({
          tenantId: input.tenantId,
          caseId: input.caseId,
          traceId: detail.case.traceId,
          contractType: "classification",
          schemaVersion: "v1",
          payload: JSON.stringify({
            documentId,
            classification,
            preliminaryAnalysis,
            confirmedData: preliminaryAnalysis.confirmedData,
            estimatedData: preliminaryAnalysis.estimatedData,
            structuredExtraction: preliminaryAnalysis.structuredExtraction,
            extractionTargets: preliminaryAnalysis.extractionTargets,
            generatedAt: processedAt.toISOString(),
          }),
          status: "ready",
        });

        const caseContract = buildCanonicalCaseContract({
          tenantId: detail.case.tenantId,
          caseId: detail.case.caseId,
          traceId: detail.case.traceId,
          title: detail.case.title,
          status: detail.case.status,
          priority: detail.case.priority,
          employeeName: detail.case.employeeName,
          employerEntity: detail.case.employerEntity,
          summary: detail.case.summary,
        });

        const sharedEngineEnvelope = buildSharedEngineEnvelope({
          tenantId: input.tenantId,
          caseId: input.caseId,
          traceId: detail.case.traceId,
          caseContract,
          documentContracts: [documentContract],
        });

        await upsertCanonicalContract({
          tenantId: input.tenantId,
          caseId: input.caseId,
          traceId: detail.case.traceId,
          contractType: "shared_engine",
          schemaVersion: "v1",
          payload: JSON.stringify(sharedEngineEnvelope),
          status: "ready",
        });

        const heliosOpinionContract = buildHeliosOpinionContract({
          tenantId: input.tenantId,
          caseId: input.caseId,
          traceId: detail.case.traceId,
          documentId,
          documentType: classification.documentType,
          documentName: safeFileName,
          jurisdiction: detail.case.jurisdiction,
          caseTitle: detail.case.title,
          preliminaryAnalysis: {
            confirmedData: preliminaryAnalysis.confirmedData,
            estimatedData: preliminaryAnalysis.estimatedData,
            guardrails: preliminaryAnalysis.guardrails,
          },
        });

        await upsertCanonicalContract({
          tenantId: input.tenantId,
          caseId: input.caseId,
          traceId: detail.case.traceId,
          contractType: "audit",
          schemaVersion: "helios_v1",
          payload: JSON.stringify(heliosOpinionContract),
          status: "ready",
        });

        await addCaseEvent({
          tenantId: input.tenantId,
          caseId: input.caseId,
          traceId: detail.case.traceId,
          actorUserId: ctx.user.id,
          eventType: "note_added",
          title: "Helios preparó una opinión inicial",
          description: heliosOpinionContract.opinion.summary,
          metadata: JSON.stringify({
            engine: "helios",
            document_id: documentId,
            risk_level: heliosOpinionContract.opinion.riskLevel,
            confidence_score: heliosOpinionContract.opinion.confidenceScore,
            generated_at: heliosOpinionContract.opinion.generatedAt,
          }),
          eventAt: new Date(heliosOpinionContract.opinion.generatedAt),
        });

        const engineDispatch = await sendDocumentToAuditaPatronEngine({
          caseContract,
          documentContract,
          sharedEngineEnvelope,
          sourceUserId: ctx.user.id,
          uploadedAt: documentRecord.createdAt ?? processedAt,
          docType: classification.normalizedDocType,
          auditId: detail.case.traceId,
          caseId: detail.case.caseId,
          metadata: {
            employerRfc:
              getRecordStringValue(preliminaryAnalysis.confirmedData, "employerRfc") ??
              getRecordStringValue(preliminaryAnalysis.estimatedData, "employerRfc") ??
              null,
            workerName:
              getRecordStringValue(preliminaryAnalysis.confirmedData, "workerName") ??
              getRecordStringValue(preliminaryAnalysis.estimatedData, "workerName") ??
              null,
            period:
              getRecordStringValue(preliminaryAnalysis.confirmedData, "period") ??
              getRecordStringValue(preliminaryAnalysis.estimatedData, "period") ??
              null,
            descriptiveDocType: classification.normalizedDocType,
          },
        });

        if (engineDispatch.status !== "sent") {
          await addOperationalAlert({
            tenantId: input.tenantId,
            caseId: input.caseId,
            traceId: detail.case.traceId,
            severity: engineDispatch.status === "failed" ? "critical" : "warning",
            category: "upload_pending",
            title: "Entrega al motor inteligente pendiente",
            description: `La entrega documental al motor inteligente no se completó el ${engineDispatch.dispatchedAt}. Estado: ${engineDispatch.status}. Motivo: ${engineDispatch.reason ?? "sin detalle"}.`,
            status: "open",
            raisedAt: new Date(engineDispatch.dispatchedAt),
          });
        } else {
          await addCaseEvent({
            tenantId: input.tenantId,
            caseId: input.caseId,
            traceId: detail.case.traceId,
            actorUserId: ctx.user.id,
            eventType: "note_added",
            title: "Documento enviado a CompliLink",
            description: "CompliLink recibió este documento y estamos esperando su respuesta automática.",
            metadata: JSON.stringify({
              document_id: documentId,
              stage: "complilink_dispatch",
              dispatch_status: engineDispatch.status,
              dispatched_at: engineDispatch.dispatchedAt,
              attempts: engineDispatch.attempts,
              http_status: engineDispatch.httpStatus,
            }),
            eventAt: new Date(engineDispatch.dispatchedAt),
          });
        }

        await createAuditLog({
          tenantId: input.tenantId,
          caseId: input.caseId,
          traceId: detail.case.traceId,
          documentId,
          actorUserId: ctx.user.id,
          entityType: "document",
          entityId: documentId,
          action: "document.upload",
          afterState: documentRecord,
        });

        await createAuditLog({
          tenantId: input.tenantId,
          caseId: input.caseId,
          traceId: detail.case.traceId,
          documentId,
          actorUserId: ctx.user.id,
          entityType: "document",
          entityId: documentId,
          action: "document.engine_dispatch",
          afterState: engineDispatch,
        });

        await createAuditLog({
          tenantId: input.tenantId,
          caseId: input.caseId,
          traceId: detail.case.traceId,
          documentId,
          actorUserId: ctx.user.id,
          entityType: "document",
          entityId: documentId,
          action: "document.helios_opinion",
          afterState: heliosOpinionContract,
        });

        await createAuditLog({
          tenantId: input.tenantId,
          caseId: input.caseId,
          traceId: detail.case.traceId,
          documentId,
          actorUserId: ctx.user.id,
          entityType: "document",
          entityId: documentId,
          action: "document.scan_assist",
          afterState: {
            scanAssistance,
            expectedDocumentType: input.expectedDocumentType ?? null,
            captureMode: input.captureMode ?? null,
          },
        });

        return {
          document: documentRecord,
          classification,
          preliminaryAnalysis,
          documentContract,
          sharedEngineEnvelope,
          heliosOpinion: heliosOpinionContract.opinion,
          heliosOpinionContract,
          engineDispatch,
          scanAssistance,
        };
      }),
  }),
  documents: router({
    access: protectedProcedure
      .input(
        z.object({
          tenantId: z.string().min(3),
          caseId: z.string().min(3),
          documentId: z.string().min(3),
        }),
      )
      .query(async ({ ctx, input }) => {
        const document = await getVisibleDocumentForUser({
          userId: ctx.user.id,
          tenantId: input.tenantId,
          caseId: input.caseId,
          documentId: input.documentId,
        });

        const download = await storageGet(document.storageKey);

        await createAuditLog({
          tenantId: input.tenantId,
          caseId: input.caseId,
          traceId: document.traceId,
          documentId: input.documentId,
          actorUserId: ctx.user.id,
          entityType: "document",
          entityId: input.documentId,
          action: "document.access",
          afterState: {
            document_id: document.documentId,
            visibility: document.visibility,
            consent_status: document.consentStatus,
            storage_key: document.storageKey,
            access_granted_at: new Date().toISOString(),
          },
        });

        return {
          documentId: document.documentId,
          fileName: document.originalName,
          mimeType: document.mimeType,
          visibility: document.visibility,
          consentStatus: document.consentStatus,
          integrityStatus: document.integrityStatus,
          sha256: document.sha256,
          traceId: document.traceId,
          downloadUrl: download.url,
        };
      }),
  }),
  consent: router({
    status: protectedProcedure
      .input(
        z.object({
          tenantId: z.string().min(3),
          caseId: z.string().min(3),
        }),
      )
      .query(async ({ ctx, input }) => {
        const detail = await getCaseDetailForUser({
          userId: ctx.user.id,
          tenantId: input.tenantId,
          caseId: input.caseId,
        });

        return buildLegalAcceptanceSummary(detail.consents);
      }),
    acceptLegalPackage: protectedProcedure
      .input(
        z.object({
          tenantId: z.string().min(3),
          caseId: z.string().min(3),
          accepted: z.literal(true),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const lockKey = `legal:${input.tenantId}:${input.caseId}:${LEGAL_ACCEPTANCE_VERSION}`;

        return withDatabaseLock({
          lockKey,
          timeoutSeconds: 12,
          action: async () => {
            const detail = await getCaseDetailForUser({
              userId: ctx.user.id,
              tenantId: input.tenantId,
              caseId: input.caseId,
            });
            const currentAcceptance = buildLegalAcceptanceSummary(detail.consents);
            const subjectName = ctx.user.name ?? ctx.user.email ?? `Usuario ${ctx.user.id}`;
            const subjectRole = "platform_user";
            const clientIp = getClientIp(ctx.req);
            const userAgent = getUserAgent(ctx.req);
            const acceptanceEntityId = `${input.caseId}:legal_package:${LEGAL_ACCEPTANCE_VERSION}`;

            type ConsentArtifact = {
              consentType: LegalConsentType;
              documentId: string | undefined;
              subjectName: string;
              subjectRole: string;
              legalBasis: string;
              status: "granted";
              notes: string;
              grantedAt: Date;
              createdAt: Date;
              updatedAt: Date;
            };

            const parseObject = (value: string | null | undefined) => {
              if (!value) return null;
              try {
                const parsed = JSON.parse(value);
                return parsed && typeof parsed === "object" && !Array.isArray(parsed)
                  ? (parsed as Record<string, unknown>)
                  : null;
              } catch {
                return null;
              }
            };

            const readString = (payload: Record<string, unknown> | null, key: string) => {
              const value = payload?.[key];
              return typeof value === "string" && value.trim().length > 0 ? value : null;
            };

            const toDate = (value: Date | string | null | undefined, fallback: Date) => {
              if (value instanceof Date) return value;
              if (typeof value === "string" && value.trim().length > 0) {
                const parsed = new Date(value);
                if (!Number.isNaN(parsed.getTime())) return parsed;
              }
              return fallback;
            };

            const isLegalConsentType = (value: string | null): value is LegalConsentType =>
              Boolean(value && LEGAL_CONSENT_TYPES.includes(value as LegalConsentType));

            const consentArtifactsByType = new Map<LegalConsentType, ConsentArtifact>();

            for (const consent of detail.consents) {
              if (consent.status !== "granted") continue;

              const consentType = getLegalConsentTypeFromBasis(consent.legalBasis);
              if (!consentType || consentArtifactsByType.has(consentType)) continue;

              const notes = parseObject(consent.notes);
              if (readString(notes, "acceptanceVersion") !== LEGAL_ACCEPTANCE_VERSION) continue;

              const fallbackTimestamp = currentAcceptance.acceptedAt ? new Date(currentAcceptance.acceptedAt) : new Date();
              const grantedAt = toDate(consent.grantedAt ?? consent.updatedAt ?? consent.createdAt, fallbackTimestamp);

              consentArtifactsByType.set(consentType, {
                consentType,
                documentId: consent.documentId ?? undefined,
                subjectName: consent.subjectName ?? subjectName,
                subjectRole: consent.subjectRole ?? subjectRole,
                legalBasis: consent.legalBasis ?? buildLegalConsentBasis(consentType),
                status: "granted",
                notes: consent.notes ?? JSON.stringify(notes ?? {}),
                grantedAt,
                createdAt: toDate(consent.createdAt, grantedAt),
                updatedAt: toDate(consent.updatedAt ?? consent.grantedAt ?? consent.createdAt, grantedAt),
              });
            }

            const consentContracts = await listCanonicalContractsByType({
              tenantId: input.tenantId,
              caseId: input.caseId,
              contractType: "consent",
              schemaVersion: LEGAL_CONTRACT_SCHEMA_VERSION,
              status: "ready",
            });

            const contractConsentTypes = new Set<LegalConsentType>();
            for (const contract of consentContracts) {
              const payload = parseObject(contract.payload);
              const consentType = readString(payload, "consent_type");
              if (readString(payload, "schema_version") !== LEGAL_ACCEPTANCE_VERSION || !isLegalConsentType(consentType)) {
                continue;
              }
              contractConsentTypes.add(consentType);
            }

            const hasAcceptanceEvent = detail.events.some((event) => {
              if (event.eventType !== "consent_updated") return false;
              return readString(parseObject(event.metadata), "acceptance_version") === LEGAL_ACCEPTANCE_VERSION;
            });

            const existingAuditLog = await findAuditLogEntry({
              tenantId: input.tenantId,
              caseId: input.caseId,
              entityType: "consent",
              entityId: acceptanceEntityId,
              action: "consent.legal_package_accept",
            });

            const missingConsentTypes = LEGAL_CONSENT_TYPES.filter((type) => !consentArtifactsByType.has(type));
            const missingContractTypes = LEGAL_CONSENT_TYPES.filter((type) => !contractConsentTypes.has(type));
            const requiresRepair = missingConsentTypes.length > 0 || missingContractTypes.length > 0 || !hasAcceptanceEvent || !existingAuditLog;

            if (currentAcceptance.isAccepted && !requiresRepair) {
              return {
                success: true,
                alreadyAccepted: true,
                acceptance: currentAcceptance,
              };
            }

            const operationAcceptedAt = new Date();
            const createdLegalSummaries: LegalConsentSummarySource[] = [];

            for (const consentType of missingConsentTypes) {
              const relatedDocument = LEGAL_DOCUMENTS.find((document) => document.consentType === consentType);
              const isSecondaryPurpose = consentType === "ai_training";
              const artifact: ConsentArtifact = {
                consentType,
                documentId: undefined,
                subjectName,
                subjectRole,
                legalBasis: buildLegalConsentBasis(consentType),
                status: "granted",
                notes: JSON.stringify({
                  acceptanceVersion: LEGAL_ACCEPTANCE_VERSION,
                  legalVersion: LEGAL_VERSION,
                  effectiveDate: LEGAL_EFFECTIVE_DATE,
                  consentType,
                  consentLabel: getLegalConsentLabel(consentType),
                  documentSlug: relatedDocument?.slug ?? null,
                  documentRoute: relatedDocument?.route ?? null,
                  clientIp,
                  userAgent,
                  actorUserId: ctx.user.id,
                  actorEmail: ctx.user.email ?? null,
                  source: "auditar_gate_v2",
                  treatmentMode: isSecondaryPurpose ? "opt_out_available" : "required_for_service",
                  idempotencyKey: lockKey,
                }),
                grantedAt: operationAcceptedAt,
                createdAt: operationAcceptedAt,
                updatedAt: operationAcceptedAt,
              };

              await addConsentRecord({
                tenantId: input.tenantId,
                caseId: input.caseId,
                traceId: detail.case.traceId,
                documentId: artifact.documentId,
                subjectName: artifact.subjectName,
                subjectRole: artifact.subjectRole,
                legalBasis: artifact.legalBasis,
                status: artifact.status,
                notes: artifact.notes,
                grantedAt: artifact.grantedAt,
              });

              consentArtifactsByType.set(consentType, artifact);
              createdLegalSummaries.push({
                legalBasis: artifact.legalBasis,
                status: artifact.status,
                grantedAt: artifact.grantedAt,
                createdAt: artifact.createdAt,
                updatedAt: artifact.updatedAt,
              });
            }

            for (const consentType of LEGAL_CONSENT_TYPES.filter((type) => !contractConsentTypes.has(type))) {
              const artifact = consentArtifactsByType.get(consentType);
              if (!artifact) continue;

              const notePayload = parseObject(artifact.notes);
              const consentContract = {
                ...buildCanonicalConsentContract({
                  tenantId: input.tenantId,
                  caseId: input.caseId,
                  traceId: detail.case.traceId,
                  documentId: artifact.documentId,
                  subjectName: artifact.subjectName,
                  status: artifact.status,
                  legalBasis: artifact.legalBasis,
                }),
                schema_version: LEGAL_ACCEPTANCE_VERSION,
                legal_version: LEGAL_VERSION,
                effective_date: LEGAL_EFFECTIVE_DATE,
                consent_type: consentType,
                consent_label: getLegalConsentLabel(consentType),
                document_route: getLegalDocumentRouteByConsentType(consentType),
                accepted_at: artifact.grantedAt.toISOString(),
                accepted_from_ip: readString(notePayload, "clientIp") ?? clientIp,
                accepted_user_agent: readString(notePayload, "userAgent") ?? userAgent,
                actor_user_id: ctx.user.id,
                actor_email: readString(notePayload, "actorEmail") ?? ctx.user.email ?? null,
                idempotency_key: lockKey,
              };

              await upsertCanonicalContract({
                tenantId: input.tenantId,
                caseId: input.caseId,
                traceId: detail.case.traceId,
                contractType: "consent",
                schemaVersion: LEGAL_CONTRACT_SCHEMA_VERSION,
                payload: JSON.stringify(consentContract),
                status: "ready",
              });
            }

            const finalAcceptance = buildLegalAcceptanceSummary([...detail.consents, ...createdLegalSummaries]);
            const acceptanceTimestamp = finalAcceptance.acceptedAt ? new Date(finalAcceptance.acceptedAt) : operationAcceptedAt;

            if (!hasAcceptanceEvent) {
              await addCaseEvent({
                tenantId: input.tenantId,
                caseId: input.caseId,
                traceId: detail.case.traceId,
                actorUserId: ctx.user.id,
                eventType: "consent_updated",
                title: `Paquete legal ${LEGAL_VERSION} aceptado`,
                description: `${subjectName} aceptó el Aviso de Privacidad Integral y los Términos y Condiciones vigentes para continuar en el expediente digital.`,
                metadata: JSON.stringify({
                  acceptance_version: LEGAL_ACCEPTANCE_VERSION,
                  legal_version: LEGAL_VERSION,
                  consent_types: LEGAL_CONSENT_TYPES,
                  client_ip: clientIp,
                  user_agent: userAgent,
                  idempotency_key: lockKey,
                }),
                eventAt: acceptanceTimestamp,
              });
            }

            if (!existingAuditLog) {
              await createAuditLog({
                tenantId: input.tenantId,
                caseId: input.caseId,
                traceId: detail.case.traceId,
                actorUserId: ctx.user.id,
                entityType: "consent",
                entityId: acceptanceEntityId,
                action: "consent.legal_package_accept",
                afterState: {
                  acceptanceVersion: LEGAL_ACCEPTANCE_VERSION,
                  legalVersion: LEGAL_VERSION,
                  effectiveDate: LEGAL_EFFECTIVE_DATE,
                  acceptedAt: acceptanceTimestamp.toISOString(),
                  clientIp,
                  userAgent,
                  consentTypes: LEGAL_CONSENT_TYPES,
                  requiredConsentTypes: legalRequiredConsentTypes,
                  idempotencyKey: lockKey,
                  repairedArtifacts: {
                    missingConsentTypes,
                    missingContractTypes,
                    createdAcceptanceEvent: !hasAcceptanceEvent,
                  },
                },
              });
            }

            return {
              success: true,
              alreadyAccepted: currentAcceptance.isAccepted,
              acceptance: finalAcceptance,
            };
          },
        });
      }),
    create: protectedProcedure
      .input(
        z.object({
          tenantId: z.string().min(3),
          caseId: z.string().min(3),
          documentId: z.string().min(3).optional(),
          subjectName: z.string().min(3).max(255),
          subjectRole: z.string().max(128).optional(),
          legalBasis: z.string().max(255).optional(),
          status: consentStatusSchema.default("pending"),
          notes: z.string().max(5000).optional(),
          expiresAt: z.string().datetime().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        await assertCaseWriteAccess(ctx.user.id, input.tenantId, input.caseId);

        const detail = await getCaseDetailForUser({
          userId: ctx.user.id,
          tenantId: input.tenantId,
          caseId: input.caseId,
        });

        await addConsentRecord({
          tenantId: input.tenantId,
          caseId: input.caseId,
          traceId: detail.case.traceId,
          documentId: input.documentId,
          subjectName: input.subjectName,
          subjectRole: input.subjectRole,
          legalBasis: input.legalBasis,
          status: input.status,
          notes: input.notes,
          grantedAt: input.status === "granted" ? new Date() : undefined,
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
        });

        const consentContract = buildCanonicalConsentContract({
          tenantId: input.tenantId,
          caseId: input.caseId,
          traceId: detail.case.traceId,
          documentId: input.documentId,
          subjectName: input.subjectName,
          status: input.status,
          legalBasis: input.legalBasis,
        });

        await upsertCanonicalContract({
          tenantId: input.tenantId,
          caseId: input.caseId,
          traceId: detail.case.traceId,
          contractType: "consent",
          schemaVersion: "v1",
          payload: JSON.stringify(consentContract),
          status: "ready",
        });

        await addCaseEvent({
          tenantId: input.tenantId,
          caseId: input.caseId,
          traceId: detail.case.traceId,
          actorUserId: ctx.user.id,
          eventType: "consent_updated",
          title: "Consentimiento registrado",
          description: `Se registró un consentimiento con estado ${input.status}.`,
          metadata: JSON.stringify({ document_id: input.documentId ?? null, subject_name: input.subjectName }),
          eventAt: new Date(),
        });

        await createAuditLog({
          tenantId: input.tenantId,
          caseId: input.caseId,
          traceId: detail.case.traceId,
          documentId: input.documentId,
          actorUserId: ctx.user.id,
          entityType: "consent",
          entityId: input.documentId ?? `${input.caseId}:${input.subjectName}`,
          action: "consent.create",
          afterState: consentContract,
        });

        return { success: true, consentContract };
      }),
  }),
  policies: router({
    create: protectedProcedure
      .input(
        z.object({
          tenantId: z.string().min(3),
          caseId: z.string().min(3),
          documentId: z.string().min(3),
          policyType: z.enum(["visibility", "retention", "legal_hold", "access_exception"]),
          visibilityScope: documentVisibilitySchema.default("case_team"),
          ruleText: z.string().min(5).max(5000),
          status: z.enum(["active", "inactive"]).default("active"),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        await assertCaseWriteAccess(ctx.user.id, input.tenantId, input.caseId);

        const detail = await getCaseDetailForUser({
          userId: ctx.user.id,
          tenantId: input.tenantId,
          caseId: input.caseId,
        });

        await addPolicyRecord({
          tenantId: input.tenantId,
          caseId: input.caseId,
          traceId: detail.case.traceId,
          documentId: input.documentId,
          policyType: input.policyType,
          visibilityScope: input.visibilityScope,
          status: input.status,
          ruleText: input.ruleText,
          createdByUserId: ctx.user.id,
        });

        await addCaseEvent({
          tenantId: input.tenantId,
          caseId: input.caseId,
          traceId: detail.case.traceId,
          actorUserId: ctx.user.id,
          eventType: "policy_updated",
          title: "Política documental actualizada",
          description: `Se aplicó una política ${input.policyType} al documento ${input.documentId}.`,
          metadata: JSON.stringify({ visibility_scope: input.visibilityScope, status: input.status }),
          eventAt: new Date(),
        });

        await createAuditLog({
          tenantId: input.tenantId,
          caseId: input.caseId,
          traceId: detail.case.traceId,
          documentId: input.documentId,
          actorUserId: ctx.user.id,
          entityType: "policy",
          entityId: input.documentId,
          action: "policy.create",
          afterState: input,
        });

        return { success: true };
      }),
  }),
  audit: router({
    list: protectedProcedure
      .input(
        z
          .object({
            tenantId: z.string().min(3).optional(),
            caseId: z.string().min(3).optional(),
            limit: z.number().int().positive().max(250).optional(),
          })
          .optional(),
      )
      .query(async ({ ctx, input }) => {
        return listAuditTrail({
          userId: ctx.user.id,
          tenantId: input?.tenantId,
          caseId: input?.caseId,
          limit: input?.limit,
        });
      }),
  }),
  utils: router({
    classifyDocument: protectedProcedure
      .input(
        z.object({
          fileName: z.string().min(1).max(255),
          mimeType: z.string().min(3).max(128),
          textHint: z.string().max(5000).optional(),
        }),
      )
      .mutation(({ input }) => {
        return classifyMexicanLaborDocument(input);
      }),
    sha256: protectedProcedure
      .input(
        z.object({
          base64Content: z.string().min(10),
        }),
      )
      .mutation(({ input }) => {
        const buffer = decodeBase64File(input.base64Content);
        return {
          sha256: computeSha256(Buffer.from(buffer)),
          sizeBytes: buffer.byteLength,
        };
      }),
  }),
});

export type AppRouter = typeof appRouter;

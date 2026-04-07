import { createHmac, timingSafeEqual } from "node:crypto";
import { ENV } from "./_core/env";
import {
  buildCanonicalCaseContract,
  buildCanonicalDocumentContract,
  buildSharedEngineEnvelope,
} from "./caseContracts";

const AUDITAPATRON_ENGINE_EVENT = "document.uploaded" as const;
const DEFAULT_RETRY_DELAYS_MS = [30_000, 60_000, 120_000] as const;
const SUPPORTED_RETURN_EVENTS = [
  "document.processing.started",
  "document.analysis.completed",
  "contract.analysis.detailed",
  "document.analyzed",
  "audit.completed",
] as const;

export type SupportedCompliLinkReturnEvent = (typeof SUPPORTED_RETURN_EVENTS)[number];

type CanonicalCaseContract = ReturnType<typeof buildCanonicalCaseContract>;
type CanonicalDocumentContract = ReturnType<typeof buildCanonicalDocumentContract>;
type SharedEngineEnvelope = ReturnType<typeof buildSharedEngineEnvelope>;

export type AuditaPatronEngineConfig = {
  webhookUrl: string;
  hmacSecret: string;
  retryDelaysMs: number[];
};

export type AuditaPatronMetadataValue = string | number | boolean | null;
export type AuditaPatronMetadata = Record<string, AuditaPatronMetadataValue>;

export type AuditaPatronEnginePayload = {
  event: typeof AUDITAPATRON_ENGINE_EVENT;
  documentId: string;
  sourceUserId: string;
  docType: string;
  fileUrl: string;
  sha256: string;
  mimeType: string;
  uploadedAt: string;
  fileSizeBytes?: number;
  auditId?: string;
  caseId?: string;
  metadata?: AuditaPatronMetadata;
};

export type AuditaPatronEngineDispatchResult = {
  status: "sent" | "failed" | "skipped";
  dispatchedAt: string;
  timestamp: string;
  attempts: number;
  httpStatus: number | null;
  reason?: string;
  errorMessage?: string;
  responseBody?: string | null;
  payload: AuditaPatronEnginePayload;
};

export type CompliLinkReturnEnvelope = {
  event: SupportedCompliLinkReturnEvent;
  documentId: string;
  compliLinkId?: string;
  status?: string;
  timestamp?: string;
  documentType?: string;
  subDocumentType?: string;
  confidenceScore?: number;
  extractedFields?: Record<string, unknown>;
  deduplicationStatus?: {
    isDuplicate?: boolean;
    originalCompliLinkId?: string;
  };
  contractSummary?: Record<string, unknown>;
  clauseAnalysis?: Array<Record<string, unknown>>;
  benefitEstimation?: Record<string, unknown>;
  guardrailWarnings?: string[];
  analysisResults?: Record<string, unknown>;
  estimatedBenefits?: Record<string, unknown>;
  guardrailsFlags?: string[];
  metadata?: Record<string, unknown>;
};

function normalizeIsoDate(input?: Date | string) {
  if (!input) return new Date().toISOString();
  if (input instanceof Date) return input.toISOString();
  const parsed = new Date(input);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function buildUnixTimestamp(input?: Date | string) {
  const parsed = input instanceof Date ? input : input ? new Date(input) : new Date();
  const safeDate = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  return Math.floor(safeDate.getTime() / 1000).toString();
}

function parseTimestampSeconds(timestampHeader?: string | null) {
  if (!timestampHeader) return null;

  const numericTimestamp = Number(timestampHeader);
  if (Number.isFinite(numericTimestamp)) {
    return numericTimestamp;
  }

  const parsedDate = Date.parse(timestampHeader);
  if (Number.isNaN(parsedDate)) {
    return null;
  }

  return Math.floor(parsedDate / 1000);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function slugifyDocType(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
}

function normalizeSignatureHeader(signatureHeader?: string | null) {
  if (!signatureHeader) return "";
  return signatureHeader.replace(/^hmac-sha256:/i, "").trim();
}

function inferCompliLinkDocType(params: {
  documentContract: CanonicalDocumentContract;
  metadata?: AuditaPatronMetadata;
}) {
  const originalName = `${params.documentContract.original_name ?? ""}`.toLowerCase();
  const metadataHaystack = Object.values(params.metadata ?? {})
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase();
  const haystack = `${originalName} ${metadataHaystack}`;

  if (params.metadata?.descriptiveDocType && typeof params.metadata.descriptiveDocType === "string") {
    return slugifyDocType(params.metadata.descriptiveDocType);
  }

  if (haystack.includes("opinion") && haystack.includes("cumplimiento")) {
    return "opinion_cumplimiento";
  }

  if (haystack.includes("infonavit")) {
    return "constancia_infonavit";
  }

  switch (params.documentContract.document_type) {
    case "payroll_receipt":
      return "recibo_nomina";
    case "cfdi":
      return "cfdi_nomina";
    case "imss":
      return "constancia_imss";
    case "contract":
      return "contrato_laboral";
    case "settlement":
      return haystack.includes("liquidacion") || haystack.includes("liquidación") ? "liquidacion_laboral" : "finiquito";
    case "evidence":
      if (haystack.includes("whatsapp") || haystack.includes("chat")) return "chat_laboral";
      if (haystack.includes("correo") || haystack.includes("email")) return "correo_laboral";
      if (haystack.includes("captura") || haystack.includes("screenshot")) return "captura_pantalla";
      return "evidencia_laboral";
    case "other":
    default: {
      const fallbackName = params.documentContract.original_name || "documento_laboral";
      return slugifyDocType(fallbackName.replace(/\.[^.]+$/, ""));
    }
  }
}

export function getAuditaPatronEngineConfig(overrides?: Partial<AuditaPatronEngineConfig>): AuditaPatronEngineConfig {
  return {
    webhookUrl: overrides?.webhookUrl ?? (ENV as typeof ENV & { auditapatronEngineWebhookUrl?: string }).auditapatronEngineWebhookUrl ?? "",
    hmacSecret: overrides?.hmacSecret ?? (ENV as typeof ENV & { auditapatronEngineHmacSecret?: string }).auditapatronEngineHmacSecret ?? "",
    retryDelaysMs: overrides?.retryDelaysMs ?? [...DEFAULT_RETRY_DELAYS_MS],
  };
}

export function buildAuditaPatronEnginePayload(params: {
  caseContract: CanonicalCaseContract;
  documentContract: CanonicalDocumentContract;
  sharedEngineEnvelope?: SharedEngineEnvelope;
  sourceUserId: number | string;
  uploadedAt: Date | string;
  metadata?: AuditaPatronMetadata;
  auditId?: string;
  caseId?: string;
  docType?: string;
}): AuditaPatronEnginePayload {
  const uploadedAt = normalizeIsoDate(params.uploadedAt);
  const metadata = params.metadata && Object.keys(params.metadata).length > 0 ? params.metadata : undefined;

  return {
    event: AUDITAPATRON_ENGINE_EVENT,
    documentId: params.documentContract.document_id,
    sourceUserId: String(params.sourceUserId),
    docType: params.docType ?? inferCompliLinkDocType({ documentContract: params.documentContract, metadata }),
    fileUrl: params.documentContract.storage_url,
    sha256: params.documentContract.sha256,
    mimeType: params.documentContract.mime_type,
    uploadedAt,
    fileSizeBytes: params.documentContract.size_bytes,
    auditId: params.auditId ?? params.caseContract.trace_id,
    caseId: params.caseId ?? params.documentContract.case_id,
    metadata,
  };
}

export function buildAuditaPatronEngineSignature(timestamp: string, payloadBody: string, hmacSecret: string) {
  return createHmac("sha256", hmacSecret).update(`${timestamp}.${payloadBody}`).digest("hex");
}

export function isSupportedCompliLinkReturnEvent(event: string): event is SupportedCompliLinkReturnEvent {
  return SUPPORTED_RETURN_EVENTS.includes(event as SupportedCompliLinkReturnEvent);
}

export function verifySignedWebhook(params: {
  signatureHeader?: string | null;
  timestampHeader?: string | null;
  payloadBody: string;
  hmacSecret: string;
}) {
  if (!params.signatureHeader || !params.timestampHeader || !params.hmacSecret) {
    return { ok: false as const, reason: "missing_signature" };
  }

  const normalizedReceivedSignature = normalizeSignatureHeader(params.signatureHeader);
  const expectedSignature = buildAuditaPatronEngineSignature(
    params.timestampHeader,
    params.payloadBody,
    params.hmacSecret,
  );

  const receivedBuffer = Buffer.from(normalizedReceivedSignature, "utf8");
  const expectedBuffer = Buffer.from(expectedSignature, "utf8");

  if (receivedBuffer.length !== expectedBuffer.length) {
    return { ok: false as const, reason: "invalid_signature", expectedSignature };
  }

  if (!timingSafeEqual(receivedBuffer, expectedBuffer)) {
    return { ok: false as const, reason: "invalid_signature", expectedSignature };
  }

  const parsedTimestamp = parseTimestampSeconds(params.timestampHeader);
  if (parsedTimestamp === null) {
    return { ok: false as const, reason: "invalid_timestamp", expectedSignature };
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - parsedTimestamp) > 300) {
    return { ok: false as const, reason: "stale_timestamp", expectedSignature };
  }

  return { ok: true as const, expectedSignature };
}

function shouldRetry(httpStatus: number | null) {
  return httpStatus !== null && httpStatus >= 500 && httpStatus <= 599;
}

export async function sendDocumentToAuditaPatronEngine(
  params: {
    caseContract: CanonicalCaseContract;
    documentContract: CanonicalDocumentContract;
    sharedEngineEnvelope?: SharedEngineEnvelope;
    sourceUserId: number | string;
    uploadedAt: Date | string;
    metadata?: AuditaPatronMetadata;
    auditId?: string;
    caseId?: string;
    docType?: string;
  },
  overrides?: Partial<AuditaPatronEngineConfig>,
): Promise<AuditaPatronEngineDispatchResult> {
  const payload = buildAuditaPatronEnginePayload(params);
  const config = getAuditaPatronEngineConfig(overrides);

  if (!config.webhookUrl || !config.hmacSecret) {
    return {
      status: "skipped",
      dispatchedAt: new Date().toISOString(),
      timestamp: buildUnixTimestamp(),
      attempts: 0,
      httpStatus: null,
      reason: "engine_not_configured",
      payload,
    };
  }

  const body = JSON.stringify(payload);
  let attempts = 0;
  let lastHttpStatus: number | null = null;
  let lastResponseBody: string | null = null;
  let lastErrorMessage: string | undefined;
  let lastReason: string | undefined;
  let finalTimestamp = buildUnixTimestamp();

  for (let attemptIndex = 0; attemptIndex <= config.retryDelaysMs.length; attemptIndex += 1) {
    attempts += 1;
    finalTimestamp = buildUnixTimestamp();
    const signature = buildAuditaPatronEngineSignature(finalTimestamp, body, config.hmacSecret);

    try {
      const response = await fetch(config.webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-AuditaPatron-Timestamp": finalTimestamp,
          "X-AuditaPatron-Signature": signature,
        },
        body,
      });

      lastHttpStatus = response.status;
      lastResponseBody = await response.text();

      if (response.ok) {
        return {
          status: "sent",
          dispatchedAt: new Date().toISOString(),
          timestamp: finalTimestamp,
          attempts,
          httpStatus: response.status,
          responseBody: lastResponseBody,
          payload,
        };
      }

      lastReason = "webhook_rejected";

      if (shouldRetry(response.status) && attemptIndex < config.retryDelaysMs.length) {
        await sleep(config.retryDelaysMs[attemptIndex] ?? 0);
        continue;
      }

      return {
        status: "failed",
        dispatchedAt: new Date().toISOString(),
        timestamp: finalTimestamp,
        attempts,
        httpStatus: response.status,
        reason: lastReason,
        responseBody: lastResponseBody,
        payload,
      };
    } catch (error) {
      lastHttpStatus = null;
      lastReason = "network_error";
      lastErrorMessage = error instanceof Error ? error.message : String(error);
      break;
    }
  }

  return {
    status: "failed",
    dispatchedAt: new Date().toISOString(),
    timestamp: finalTimestamp,
    attempts,
    httpStatus: lastHttpStatus,
    reason: lastReason ?? "network_error",
    errorMessage: lastErrorMessage,
    responseBody: lastResponseBody,
    payload,
  };
}

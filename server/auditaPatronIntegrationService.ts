import { createHmac } from "node:crypto";
import { ENV } from "./_core/env";
import {
  buildCanonicalCaseContract,
  buildCanonicalDocumentContract,
  buildSharedEngineEnvelope,
} from "./caseContracts";

const AUDITAPATRON_ENGINE_EVENT = "document_uploaded" as const;
const AUDITAPATRON_ENGINE_PAYLOAD_VERSION = "v1" as const;

type CanonicalCaseContract = ReturnType<typeof buildCanonicalCaseContract>;
type CanonicalDocumentContract = ReturnType<typeof buildCanonicalDocumentContract>;
type SharedEngineEnvelope = ReturnType<typeof buildSharedEngineEnvelope>;

export type AuditaPatronEngineConfig = {
  webhookUrl: string;
  hmacSecret: string;
};

export type AuditaPatronEnginePayload = {
  event: typeof AUDITAPATRON_ENGINE_EVENT;
  payloadVersion: typeof AUDITAPATRON_ENGINE_PAYLOAD_VERSION;
  source: "auditapatron";
  dispatchedAt: string;
  tenantId: string;
  caseId: string;
  traceId: string;
  sourceUserId: string;
  documentId: string;
  fileUrl: string;
  fileKey: string;
  sha256: string;
  mimeType: string;
  docType: string;
  uploadedAt: string;
  idempotencyKey: string;
  contracts: {
    case: CanonicalCaseContract;
    document: CanonicalDocumentContract;
    sharedEngine: SharedEngineEnvelope;
  };
};

export type AuditaPatronEngineDispatchResult = {
  status: "sent" | "failed" | "skipped";
  dispatchedAt: string;
  httpStatus: number | null;
  reason?: string;
  errorMessage?: string;
  responseBody?: string | null;
  payload: AuditaPatronEnginePayload;
};

export function getAuditaPatronEngineConfig(overrides?: Partial<AuditaPatronEngineConfig>): AuditaPatronEngineConfig {
  return {
    webhookUrl: overrides?.webhookUrl ?? (ENV as typeof ENV & { auditapatronEngineWebhookUrl?: string }).auditapatronEngineWebhookUrl ?? "",
    hmacSecret: overrides?.hmacSecret ?? (ENV as typeof ENV & { auditapatronEngineHmacSecret?: string }).auditapatronEngineHmacSecret ?? "",
  };
}

export function buildAuditaPatronEnginePayload(params: {
  caseContract: CanonicalCaseContract;
  documentContract: CanonicalDocumentContract;
  sharedEngineEnvelope: SharedEngineEnvelope;
  sourceUserId: number | string;
  uploadedAt: Date | string;
  dispatchedAt?: Date | string;
}): AuditaPatronEnginePayload {
  const uploadedAt = params.uploadedAt instanceof Date ? params.uploadedAt.toISOString() : params.uploadedAt;
  const dispatchedAtSource = params.dispatchedAt ?? new Date();
  const dispatchedAt = dispatchedAtSource instanceof Date ? dispatchedAtSource.toISOString() : dispatchedAtSource;

  return {
    event: AUDITAPATRON_ENGINE_EVENT,
    payloadVersion: AUDITAPATRON_ENGINE_PAYLOAD_VERSION,
    source: "auditapatron",
    dispatchedAt,
    tenantId: params.documentContract.tenant_id,
    caseId: params.documentContract.case_id,
    traceId: params.documentContract.trace_id,
    sourceUserId: String(params.sourceUserId),
    documentId: params.documentContract.document_id,
    fileUrl: params.documentContract.storage_url,
    fileKey: params.documentContract.storage_key,
    sha256: params.documentContract.sha256,
    mimeType: params.documentContract.mime_type,
    docType: params.documentContract.document_type,
    uploadedAt,
    idempotencyKey: `${params.documentContract.document_id}:${params.documentContract.sha256}`,
    contracts: {
      case: params.caseContract,
      document: params.documentContract,
      sharedEngine: params.sharedEngineEnvelope,
    },
  };
}

export function buildAuditaPatronEngineSignature(payloadBody: string, hmacSecret: string) {
  return `hmac-sha256:${createHmac("sha256", hmacSecret).update(payloadBody).digest("hex")}`;
}

export async function sendDocumentToAuditaPatronEngine(
  params: {
    caseContract: CanonicalCaseContract;
    documentContract: CanonicalDocumentContract;
    sharedEngineEnvelope: SharedEngineEnvelope;
    sourceUserId: number | string;
    uploadedAt: Date | string;
    dispatchedAt?: Date | string;
  },
  overrides?: Partial<AuditaPatronEngineConfig>,
): Promise<AuditaPatronEngineDispatchResult> {
  const payload = buildAuditaPatronEnginePayload(params);
  const config = getAuditaPatronEngineConfig(overrides);

  if (!config.webhookUrl || !config.hmacSecret) {
    return {
      status: "skipped",
      dispatchedAt: payload.dispatchedAt,
      httpStatus: null,
      reason: "engine_not_configured",
      payload,
    };
  }

  const body = JSON.stringify(payload);
  const signature = buildAuditaPatronEngineSignature(body, config.hmacSecret);

  try {
    const response = await fetch(config.webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-AuditaPatron-Event": payload.event,
        "X-AuditaPatron-Payload-Version": payload.payloadVersion,
        "X-AuditaPatron-Timestamp": payload.dispatchedAt,
        "X-AuditaPatron-Idempotency-Key": payload.idempotencyKey,
        "X-AuditaPatron-Signature": signature,
      },
      body,
    });

    const responseBody = await response.text();

    if (!response.ok) {
      return {
        status: "failed",
        dispatchedAt: payload.dispatchedAt,
        httpStatus: response.status,
        reason: "webhook_rejected",
        responseBody,
        payload,
      };
    }

    return {
      status: "sent",
      dispatchedAt: payload.dispatchedAt,
      httpStatus: response.status,
      responseBody,
      payload,
    };
  } catch (error) {
    return {
      status: "failed",
      dispatchedAt: payload.dispatchedAt,
      httpStatus: null,
      reason: "network_error",
      errorMessage: error instanceof Error ? error.message : String(error),
      payload,
    };
  }
}

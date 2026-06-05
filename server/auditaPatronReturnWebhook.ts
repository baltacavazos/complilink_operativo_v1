import type { Express, Request, Response } from "express";
import { createHash } from "node:crypto";
import { ENV } from "./_core/env";
import {
  addCaseEvent,
  addOperationalAlert,
  createAuditLog,
  getDocumentById,
  registerCompliLinkWebhookEvent,
  resolveCompliLinkDocument,
  upsertCanonicalContract,
  updateCompliLinkWebhookEvent,
  updateDocumentPostProcessing,
} from "./db";
import { type DocumentType, classifyMexicanLaborDocument } from "./caseContracts";
import {
  buildAuditaPatronEngineSignature,
  type CompliLinkReturnEnvelope,
  isSupportedCompliLinkReturnEvent,
  verifySignedWebhook,
} from "./auditaPatronIntegrationService";
import { buildRemoteHeliosOpinionContract } from "./heliosIntegrationService";

const RESPONSE_CONTRACT = "auditapatron.bridge.ack.v1" as const;

type RawBodyRequest = Request & {
  rawBody?: string;
};

type AuditaPatronUploadWebhookPayload = {
  event?: string;
  eventName?: string;
  documentId?: string;
  sourceDocumentId?: string;
  sourceUserId?: string | number;
  userId?: string | number;
  docType?: string;
  category?: string;
  fileUrl?: string;
  mimeType?: string;
  uploadedAt?: string;
  sha256?: string;
  operationalContext?: Record<string, unknown> | null;
};

function toNonEmptyString(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function toStringFromUnknown(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return toNonEmptyString(value);
}

function toRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function normalizeIncomingUploadPayload(payload: AuditaPatronUploadWebhookPayload) {
  const operationalContext = toRecord(payload.operationalContext);

  return {
    event: toNonEmptyString(payload.event) ?? toNonEmptyString(payload.eventName),
    documentId: toNonEmptyString(payload.documentId) ?? toNonEmptyString(payload.sourceDocumentId),
    sourceUserId: toStringFromUnknown(payload.sourceUserId) ?? toStringFromUnknown(payload.userId),
    docType: toNonEmptyString(payload.docType) ?? toNonEmptyString(payload.category),
    fileUrl: toNonEmptyString(payload.fileUrl),
    mimeType: toNonEmptyString(payload.mimeType),
    uploadedAt: toNonEmptyString(payload.uploadedAt),
    sha256: toNonEmptyString(payload.sha256) ?? toNonEmptyString(operationalContext?.sha256),
  };
}

function clampConfidence(value: number | undefined, fallback: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(100, Math.round(value ?? fallback)));
}

function stringifyMetadata(value: unknown) {
  return JSON.stringify(value ?? {});
}

function extractCorrelationId(payload: Partial<CompliLinkReturnEnvelope>) {
  if (typeof payload.correlationId === "string" && payload.correlationId.trim().length > 0) {
    return payload.correlationId.trim();
  }

  const metadata = payload.metadata;
  if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
    const candidate = (metadata as Record<string, unknown>).correlationId;
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }

  return null;
}

function extractEventId(payload: Partial<CompliLinkReturnEnvelope>) {
  const metadata = payload.metadata;
  const metadataRecord = metadata && typeof metadata === "object" && !Array.isArray(metadata)
    ? (metadata as Record<string, unknown>)
    : null;
  const candidates = [
    payload.eventId,
    payload.idempotencyKey,
    typeof metadataRecord?.eventId === "string" ? metadataRecord.eventId : null,
    typeof metadataRecord?.idempotencyKey === "string" ? metadataRecord.idempotencyKey : null,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }

  return null;
}

function extractReturnMetadata(payload: Partial<CompliLinkReturnEnvelope>) {
  return toRecord(payload.metadata);
}

function extractTraceId(payload: Partial<CompliLinkReturnEnvelope>) {
  const payloadRecord = payload as Record<string, unknown>;
  const metadataRecord = extractReturnMetadata(payload);

  return (
    toStringFromUnknown(payloadRecord.traceId) ??
    toStringFromUnknown(metadataRecord?.traceId) ??
    toStringFromUnknown(metadataRecord?.trace_id) ??
    null
  );
}

function extractSourceDocumentId(payload: Partial<CompliLinkReturnEnvelope>) {
  const payloadRecord = payload as Record<string, unknown>;
  const metadataRecord = extractReturnMetadata(payload);

  return (
    toStringFromUnknown(payloadRecord.sourceDocumentId) ??
    toStringFromUnknown(metadataRecord?.sourceDocumentId) ??
    toStringFromUnknown(metadataRecord?.source_document_id_sent) ??
    toStringFromUnknown(metadataRecord?.sourceDocumentUuid) ??
    null
  );
}

function extractDocumentNumericId(payload: Partial<CompliLinkReturnEnvelope>) {
  const payloadRecord = payload as Record<string, unknown>;
  const metadataRecord = extractReturnMetadata(payload);

  return (
    toStringFromUnknown(payloadRecord.documentNumericId) ??
    toStringFromUnknown(metadataRecord?.documentNumericId) ??
    toStringFromUnknown(metadataRecord?.document_numeric_id) ??
    toStringFromUnknown(metadataRecord?.sourceDocumentNumericId) ??
    null
  );
}

function hasSharedSecretAuth(req: Request) {
  const expectedSecret = ENV.auditapatronEngineHmacSecret.trim();
  if (!expectedSecret) return false;

  const bearerHeader = req.header("authorization");
  if (bearerHeader?.startsWith("Bearer ") && bearerHeader.slice(7).trim() === expectedSecret) {
    return true;
  }

  return [req.header("x-auditapatron-token"), req.header("x-helios-token")].some(
    (headerValue) => headerValue?.trim() === expectedSecret,
  );
}

function buildBridgeContractResponse() {
  return {
    status: "ok",
    service: "complilink-auditapatron-bridge",
    bridge: "auditapatron",
    responseContract: RESPONSE_CONTRACT,
    authentication: {
      sharedSecret: {
        acceptedHeaders: ["Authorization", "x-helios-token", "x-auditapatron-token"],
        bearerFormat: "Bearer <bridge-secret>",
      },
      signature: {
        acceptedHeaders: ["X-AuditaPatron-Timestamp", "X-AuditaPatron-Signature"],
        algorithm: "HMAC-SHA256(timestamp + '.' + body)",
      },
    },
    endpoints: {
      contract: "/api/internal/helios/bridge/contract",
      heliosBridge: "/api/internal/helios/bridge",
      auditapatronBridge: "/api/integrations/auditapatron/bridge",
      auditapatronHealth: "/api/auditapatron/health",
      auditapatronWebhook: "/api/auditapatron/webhook",
      compliLinkReturnWebhook: "/api/auditapatron/complilink-webhook",
    },
  };
}

function handleHeliosBridgeContract(req: Request, res: Response) {
  if (!hasSharedSecretAuth(req)) {
    res.status(403).json({
      received: false,
      issues: buildWebhookIssues("authentication_failed", "Invalid bridge credentials."),
      responseContract: RESPONSE_CONTRACT,
    });
    return;
  }

  res.status(200).json(buildBridgeContractResponse());
}

function verifyReturnWebhookAuthentication(req: RawBodyRequest, rawBody: string) {
  if (hasSharedSecretAuth(req)) {
    return { ok: true as const, reason: null, mode: "shared_secret" as const };
  }

  const verification = verifySignedWebhook({
    signatureHeader: req.header("X-AuditaPatron-Signature"),
    timestampHeader: req.header("X-AuditaPatron-Timestamp"),
    payloadBody: rawBody,
    hmacSecret: ENV.auditapatronEngineHmacSecret,
  });

  return {
    ok: verification.ok,
    reason: verification.reason,
    mode: "signature" as const,
  };
}

function buildWebhookIssues(code: string, detail: string, field?: string) {
  return [
    {
      code,
      detail,
      ...(field ? { field } : {}),
    },
  ];
}

function deriveProcessingStatus(event: CompliLinkReturnEnvelope["event"]) {
  if (event === "document.processed.v1") return "processed";
  if (event === "document.rejected.v1") return "rejected";
  return "retry_requested";
}

function buildWebhookAck(params: {
  payload: Partial<CompliLinkReturnEnvelope>;
  document: { documentId: string; caseId: string; traceId: string };
  intakeId: string;
  receivedAt: Date;
  correlationId: string | null;
  duplicate?: boolean;
}) {
  return {
    received: true,
    intakeId: params.intakeId,
    documentId: params.document.documentId,
    processingStatus:
      params.payload.event && isSupportedCompliLinkReturnEvent(params.payload.event)
        ? deriveProcessingStatus(params.payload.event)
        : "received",
    traceId: params.document.traceId,
    correlationId: params.correlationId,
    remoteEventId: extractEventId(params.payload) ?? params.payload.compliLinkId ?? null,
    receivedAt: params.receivedAt.toISOString(),
    memoryLinks: {
      caseId: params.document.caseId,
      duplicate: Boolean(params.duplicate),
    },
    recommendedNextAction:
      params.payload.event === "document.retry_requested.v1" ? "retry_dispatch" : "none",
    responseContract: RESPONSE_CONTRACT,
  };
}

function buildWebhookEventKey(params: {
  payload: Partial<CompliLinkReturnEnvelope>;
  rawBody: string;
  signatureHeader?: string | null;
  timestampHeader?: string | null;
}) {
  const compactKey = (value: string) => {
    if (value.length <= 64) return value;
    const suffix = createHash("sha256").update(value).digest("hex").slice(0, 16);
    return `${value.slice(0, 47)}:${suffix}`;
  };

  const canonicalEventId = extractEventId(params.payload);
  if (canonicalEventId) {
    return compactKey(`event:${canonicalEventId}`);
  }

  const correlationId = extractCorrelationId(params.payload);
  if (params.payload.event && correlationId) {
    return compactKey(`correlation:${params.payload.event}:${correlationId}`);
  }

  return createHash("sha256")
    .update(
      JSON.stringify({
        event: params.payload.event ?? null,
        documentId: params.payload.documentId ?? null,
        compliLinkId: params.payload.compliLinkId ?? null,
        correlationId,
        timestamp: params.payload.timestamp ?? params.timestampHeader ?? null,
        signature: params.signatureHeader ?? null,
        rawBody: params.rawBody,
      }),
    )
    .digest("hex");
}

function toFailureReason(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, 255) || "unknown_error";
}

function mapIncomingDocumentType(payload: Partial<CompliLinkReturnEnvelope>, existingDocument: {
  originalName: string;
  mimeType: string;
  documentType: DocumentType;
}): DocumentType {
  const textHint = [
    payload.documentType,
    payload.subDocumentType,
    Object.keys(payload.extractedFields ?? {}).join(" "),
    Object.keys(payload.analysisResults ?? {}).join(" "),
    Object.keys(payload.contractSummary ?? {}).join(" "),
  ]
    .filter(Boolean)
    .join(" ");

  const inferred = classifyMexicanLaborDocument({
    fileName: existingDocument.originalName,
    mimeType: existingDocument.mimeType,
    textHint,
  });

  return inferred.documentType ?? existingDocument.documentType;
}

function buildEventDescriptor(payload: CompliLinkReturnEnvelope) {
  if (payload.event === "document.processed.v1") {
    return {
      eventType: "document_classified" as const,
      title: "Documento procesado por CompliLink",
      description: "CompliLink MX devolvió un resultado final de procesamiento documental para este expediente.",
    };
  }

  if (payload.event === "document.rejected.v1") {
    return {
      eventType: "note_added" as const,
      title: "Documento rechazado por CompliLink",
      description: "CompliLink MX rechazó el documento y devolvió observaciones para corrección o reemplazo.",
    };
  }

  return {
    eventType: "note_added" as const,
    title: "Reintento solicitado por CompliLink",
    description: "CompliLink MX solicitó reenviar o reprocesar el documento asociado al expediente.",
  };
}

function deriveRemoteForwardWebhookUrl(req: RawBodyRequest) {
  const configuredWebhookUrl = ENV.auditapatronEngineWebhookUrl?.trim();
  if (!configuredWebhookUrl) return null;

  try {
    const parsed = new URL(configuredWebhookUrl);
    if (parsed.hostname.startsWith("www.")) {
      parsed.hostname = parsed.hostname.replace(/^www\./, "");
    }

    const requestHost = (req.header("x-forwarded-host") ?? req.header("host") ?? "")
      .split(",")[0]
      ?.trim()
      .toLowerCase();
    const requestProtocol = (req.header("x-forwarded-proto") ?? req.protocol ?? parsed.protocol.replace(":", ""))
      .split(",")[0]
      ?.trim()
      .toLowerCase();
    const requestOrigin = requestHost ? `${requestProtocol}://${requestHost}` : null;
    const targetHost = parsed.hostname.toLowerCase();

    if (targetHost === "127.0.0.1" || targetHost === "localhost") {
      return null;
    }

    if (requestOrigin && parsed.origin.toLowerCase() === requestOrigin) {
      return null;
    }

    return parsed.toString();
  } catch {
    return null;
  }
}

async function forwardIncomingUploadToRemote(params: { req: RawBodyRequest; rawBody: string }) {
  const targetUrl = deriveRemoteForwardWebhookUrl(params.req);
  if (!targetUrl) {
    return {
      ok: false as const,
      status: null,
      targetUrl: null,
      responseBody: null,
      reason: "bridge_target_invalid",
    };
  }

  const timestamp = params.req.header("X-AuditaPatron-Timestamp") ?? Math.floor(Date.now() / 1000).toString();
  const signature = buildAuditaPatronEngineSignature(timestamp, params.rawBody, ENV.auditapatronEngineHmacSecret);

  try {
    const response = await fetch(targetUrl, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-AuditaPatron-Timestamp": timestamp,
        "X-AuditaPatron-Signature": signature,
        "X-AuditaPatron-Forwarded-By": "auditapatron-intake",
      },
      body: params.rawBody,
    });

    const responseBody = await response.text();
    return {
      ok: response.ok,
      status: response.status,
      targetUrl,
      responseBody,
      reason: response.ok ? null : "bridge_forward_rejected",
    };
  } catch (error) {
    return {
      ok: false as const,
      status: null,
      targetUrl,
      responseBody: null,
      reason: "bridge_forward_failed",
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }
}

function handleAuditaPatronHealth(_req: Request, res: Response) {
  res.status(200).json({
    status: "ok",
    bridge: "auditapatron",
    webhookPath: "/api/auditapatron/webhook",
    responseContract: RESPONSE_CONTRACT,
  });
}

async function handleAuditaPatronIncomingWebhook(req: RawBodyRequest, res: Response) {
  try {
    const rawBody = req.rawBody ?? JSON.stringify(req.body ?? {});
    const verification = verifySignedWebhook({
      signatureHeader: req.header("X-AuditaPatron-Signature"),
      timestampHeader: req.header("X-AuditaPatron-Timestamp"),
      payloadBody: rawBody,
      hmacSecret: ENV.auditapatronEngineHmacSecret,
    });

    if (!verification.ok) {
      res.status(403).json({
        verified: false,
        issues: buildWebhookIssues(
          "authentication_failed",
          verification.reason ?? "Invalid bridge signature.",
        ),
        responseContract: RESPONSE_CONTRACT,
      });
      return;
    }

    const payload = (req.body ?? {}) as AuditaPatronUploadWebhookPayload;
    const normalized = normalizeIncomingUploadPayload(payload);
    const issues = [
      ...(!normalized.event ? buildWebhookIssues("missing_field", "The event field is required.", "event") : []),
      ...(!normalized.documentId ? buildWebhookIssues("missing_field", "The documentId field is required.", "documentId") : []),
      ...(!normalized.sourceUserId ? buildWebhookIssues("missing_field", "The sourceUserId field is required.", "sourceUserId") : []),
      ...(!normalized.docType ? buildWebhookIssues("missing_field", "The docType field is required.", "docType") : []),
      ...(!normalized.fileUrl ? buildWebhookIssues("missing_field", "The fileUrl field is required.", "fileUrl") : []),
      ...(!normalized.sha256 ? buildWebhookIssues("missing_field", "The sha256 field is required.", "sha256") : []),
      ...(!normalized.mimeType ? buildWebhookIssues("missing_field", "The mimeType field is required.", "mimeType") : []),
      ...(!normalized.uploadedAt ? buildWebhookIssues("missing_field", "The uploadedAt field is required.", "uploadedAt") : []),
    ];

    if (normalized.event && normalized.event !== "document.uploaded") {
      issues.push(...buildWebhookIssues("unknown_event", `Unsupported event '${normalized.event}'.`, "event"));
    }

    if (issues.length > 0) {
      res.status(400).json({
        verified: false,
        issues,
        responseContract: RESPONSE_CONTRACT,
      });
      return;
    }

    const remoteForward = await forwardIncomingUploadToRemote({ req, rawBody });

    if (!remoteForward.ok) {
      res.status(502).json({
        verified: false,
        issues: buildWebhookIssues(
          remoteForward.reason ?? "bridge_forward_failed",
          "The validated upload could not be forwarded to the remote CompliLink bridge.",
          "event",
        ),
        bridgeTarget: remoteForward.targetUrl,
        upstreamStatus: remoteForward.status,
        responseContract: RESPONSE_CONTRACT,
      });
      return;
    }

    const receivedAt = new Date().toISOString();
    res.status(202).json({
      verified: true,
      received: true,
      event: normalized.event,
      documentId: normalized.documentId,
      sourceUserId: normalized.sourceUserId,
      receivedAt,
      responseContract: RESPONSE_CONTRACT,
      processingStatus: "accepted",
      forwarded: true,
      bridgeTarget: remoteForward.targetUrl,
      upstreamStatus: remoteForward.status,
    });
  } catch (error) {
    console.error("[AuditaPatron Intake Webhook]", error);
    res.status(500).json({
      verified: false,
      issues: buildWebhookIssues("internal_error", "An unexpected error occurred while validating the bridge event."),
      responseContract: RESPONSE_CONTRACT,
    });
  }
}

export async function ingestCompliLinkReturnPayload(params: {
  payload: Partial<CompliLinkReturnEnvelope>;
  rawBody: string;
  signatureHeader?: string | null;
  timestampHeader?: string | null;
}) {
  const { payload, rawBody, signatureHeader, timestampHeader } = params;

  if (!payload.event || !payload.documentId) {
    return {
      ok: false as const,
      statusCode: 400,
      body: {
        received: false,
        issues: [
          ...(!payload.event ? buildWebhookIssues("missing_field", "The event field is required.", "event") : []),
          ...(!payload.documentId ? buildWebhookIssues("missing_field", "The documentId field is required.", "documentId") : []),
        ],
        responseContract: RESPONSE_CONTRACT,
      },
    };
  }

  if (!isSupportedCompliLinkReturnEvent(payload.event)) {
    return {
      ok: false as const,
      statusCode: 400,
      body: {
        received: false,
        issues: buildWebhookIssues("unknown_event", `Unsupported event '${payload.event}'.`, "event"),
        responseContract: RESPONSE_CONTRACT,
      },
    };
  }

  const correlationId = extractCorrelationId(payload);
  const traceId = extractTraceId(payload) ?? correlationId;
  const sourceDocumentId = extractSourceDocumentId(payload);
  const documentNumericId = extractDocumentNumericId(payload);
  const eventId = extractEventId(payload);
  const resolvedDocument = await resolveCompliLinkDocument({
    documentId: typeof payload.documentId === "string" ? payload.documentId : String(payload.documentId),
    sourceDocumentId,
    documentNumericId,
    remoteDocumentId: payload.documentId,
    correlationId,
    traceId,
    eventId,
  });

  if (!resolvedDocument) {
    return {
      ok: false as const,
      statusCode: 400,
      body: {
        received: false,
        issues: buildWebhookIssues(
          "document_not_found",
          `No local document exists for '${String(payload.documentId)}' and no dispatch correlation/sourceDocumentId match was found.`,
          "documentId",
        ),
        responseContract: RESPONSE_CONTRACT,
      },
    };
  }

  const document = resolvedDocument;
  const receivedAt = new Date();
  const eventKey = buildWebhookEventKey({
    payload,
    rawBody,
    signatureHeader,
    timestampHeader,
  });
  const registeredWebhookEvent = await registerCompliLinkWebhookEvent({
    tenantId: document.tenantId,
    caseId: document.caseId,
    traceId: document.traceId,
    documentId: document.documentId,
    eventKey,
    eventName: payload.event,
    compliLinkId: payload.compliLinkId ?? null,
    correlationId,
    sourceTimestamp: payload.timestamp ?? timestampHeader ?? null,
    sourceSignature: signatureHeader ?? null,
    rawPayload: rawBody,
    status: "processing",
  });

  if (!registeredWebhookEvent.created) {
    return {
      ok: true as const,
      statusCode: 200,
      body: buildWebhookAck({
        payload,
        document,
        intakeId: String(registeredWebhookEvent.event?.id ?? eventKey),
        receivedAt,
        correlationId,
        duplicate: true,
      }),
    };
  }

  const webhookEvent = registeredWebhookEvent.event;
  if (!webhookEvent) {
    throw new Error("No se pudo materializar el registro idempotente del webhook.");
  }

  const shouldRefreshDocumentState = payload.event !== "document.retry_requested.v1";
  const normalizedDocumentType = mapIncomingDocumentType(payload, {
    originalName: document.originalName,
    mimeType: document.mimeType,
    documentType: document.documentType,
  });
  const nextConfidence = clampConfidence(payload.confidenceScore, document.classificationConfidence ?? 0);

  if (shouldRefreshDocumentState) {
    await updateDocumentPostProcessing({
      documentId: document.documentId,
      documentType: normalizedDocumentType,
      classificationConfidence: nextConfidence,
      integrityStatus: document.integrityStatus,
      processedAt: receivedAt,
      consentStatus: document.consentStatus,
    });
  }

  try {
    const canonicalReturnPayload = {
      source: "complilink_mx",
      event: payload.event,
      eventId,
      eventKey,
      documentId: payload.documentId,
      resolvedDocumentId: document.documentId,
      sourceDocumentId,
      documentNumericId,
      traceId,
      compliLinkId: payload.compliLinkId ?? null,
      correlationId,
      status: payload.status ?? null,
      timestamp: payload.timestamp ?? null,
      documentType: payload.documentType ?? null,
      subDocumentType: payload.subDocumentType ?? null,
      confidenceScore: payload.confidenceScore ?? null,
      extractedFields: payload.extractedFields ?? null,
      deduplicationStatus: payload.deduplicationStatus ?? null,
      contractSummary: payload.contractSummary ?? null,
      clauseAnalysis: payload.clauseAnalysis ?? null,
      benefitEstimation: payload.benefitEstimation ?? null,
      analysisResults: payload.analysisResults ?? null,
      estimatedBenefits: payload.estimatedBenefits ?? null,
      guardrailWarnings: payload.guardrailWarnings ?? [],
      guardrailsFlags: payload.guardrailsFlags ?? [],
      metadata: payload.metadata ?? null,
      receivedAt: receivedAt.toISOString(),
    };

    await upsertCanonicalContract({
      tenantId: document.tenantId,
      caseId: document.caseId,
      traceId: document.traceId,
      contractType: "audit",
      schemaVersion: "v1",
      payload: JSON.stringify(canonicalReturnPayload),
      status: "ready",
    });

    if (payload.event === "document.processed.v1") {
      const remoteHeliosOpinionContract = buildRemoteHeliosOpinionContract({
        tenantId: document.tenantId,
        caseId: document.caseId,
        traceId: document.traceId,
        documentId: document.documentId,
        documentType: normalizedDocumentType,
        documentName: document.originalName,
        remotePayload: canonicalReturnPayload,
      });

      await upsertCanonicalContract({
        tenantId: document.tenantId,
        caseId: document.caseId,
        traceId: document.traceId,
        contractType: "audit",
        schemaVersion: "helios_v1",
        payload: JSON.stringify(remoteHeliosOpinionContract),
        status: "ready",
      });
    }

    const descriptor = buildEventDescriptor(payload as CompliLinkReturnEnvelope);

    await addCaseEvent({
      tenantId: document.tenantId,
      caseId: document.caseId,
      traceId: document.traceId,
      eventType: descriptor.eventType,
      title: descriptor.title,
      description: descriptor.description,
      metadata: stringifyMetadata(canonicalReturnPayload),
      eventAt: receivedAt,
    });

    const guardrails = [
      ...(payload.guardrailWarnings ?? []),
      ...(payload.guardrailsFlags ?? []),
    ].filter((item): item is string => typeof item === "string" && item.trim().length > 0);

    if (guardrails.length > 0) {
      await addOperationalAlert({
        tenantId: document.tenantId,
        caseId: document.caseId,
        traceId: document.traceId,
        severity: payload.event === "document.rejected.v1" ? "critical" : "warning",
        category: "integrity_gap",
        title: "Resultado con advertencias de revisión",
        description: `Se recibieron advertencias desde CompliLink MX para ${document.originalName}: ${guardrails.join(" | ")}`,
        status: "open",
        raisedAt: receivedAt,
      });
    }

    await createAuditLog({
      tenantId: document.tenantId,
      caseId: document.caseId,
      traceId: document.traceId,
      documentId: document.documentId,
      entityType: "document",
      entityId: document.documentId,
      action: `complilink.return_webhook.${payload.event}`,
      afterState: canonicalReturnPayload,
    });

    await updateCompliLinkWebhookEvent({
      id: webhookEvent.id,
      status: "processed",
      processedAt: receivedAt,
      compliLinkId: payload.compliLinkId ?? null,
      correlationId,
    });

    return {
      ok: true as const,
      statusCode: 200,
      body: buildWebhookAck({
        payload,
        document,
        intakeId: String(webhookEvent.id),
        receivedAt,
        correlationId,
      }),
    };
  } catch (processingError) {
    await updateCompliLinkWebhookEvent({
      id: webhookEvent.id,
      status: "failed_processing",
      processedAt: new Date(),
      failureReason: toFailureReason(processingError),
      compliLinkId: payload.compliLinkId ?? null,
      correlationId,
    });
    throw processingError;
  }
}

async function handleCompliLinkReturnWebhook(req: RawBodyRequest, res: Response) {
  try {
    const rawBody = req.rawBody ?? JSON.stringify(req.body ?? {});
    const verification = verifyReturnWebhookAuthentication(req, rawBody);

    if (!verification.ok) {
      res.status(403).json({
        received: false,
        issues: buildWebhookIssues("authentication_failed", verification.reason ?? "Invalid bridge credentials or signature."),
        responseContract: RESPONSE_CONTRACT,
      });
      return;
    }

    const outcome = await ingestCompliLinkReturnPayload({
      payload: (req.body ?? {}) as Partial<CompliLinkReturnEnvelope>,
      rawBody,
      signatureHeader: req.header("X-AuditaPatron-Signature"),
      timestampHeader: req.header("X-AuditaPatron-Timestamp"),
    });

    res.status(outcome.statusCode).json(outcome.body);
  } catch (error) {
    console.error("[CompliLink Return Webhook]", error);
    res.status(500).json({
      received: false,
      issues: buildWebhookIssues("internal_error", "An unexpected error occurred while processing the bridge event."),
      responseContract: RESPONSE_CONTRACT,
    });
  }
}

export function registerCompliLinkReturnWebhook(app: Express) {
  app.get("/api/auditapatron/health", handleAuditaPatronHealth);
  app.get("/api/internal/helios/bridge/contract", handleHeliosBridgeContract);
  app.post("/api/auditapatron/webhook", handleAuditaPatronIncomingWebhook);
  app.post("/api/auditapatron/complilink-webhook", handleCompliLinkReturnWebhook);
  app.post("/api/internal/helios/bridge", handleCompliLinkReturnWebhook);
  app.post("/api/integrations/auditapatron/bridge", handleCompliLinkReturnWebhook);
}

import type { Express, Request, Response } from "express";
import { createHash } from "node:crypto";
import { ENV } from "./_core/env";
import {
  addCaseEvent,
  addOperationalAlert,
  createAuditLog,
  getDocumentById,
  registerCompliLinkWebhookEvent,
  upsertCanonicalContract,
  updateCompliLinkWebhookEvent,
  updateDocumentPostProcessing,
} from "./db";
import { type DocumentType, classifyMexicanLaborDocument } from "./caseContracts";
import {
  type CompliLinkReturnEnvelope,
  isSupportedCompliLinkReturnEvent,
  verifySignedWebhook,
} from "./auditaPatronIntegrationService";

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

function hasSharedSecretAuth(req: Request) {
  const expectedSecret = ENV.auditapatronEngineHmacSecret.trim();
  if (!expectedSecret) return false;

  const bearerHeader = req.header("authorization");
  if (bearerHeader?.startsWith("Bearer ") && bearerHeader.slice(7).trim() === expectedSecret) {
    return true;
  }

  return req.header("x-auditapatron-token")?.trim() === expectedSecret;
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
  const canonicalEventId = extractEventId(params.payload);
  if (canonicalEventId) {
    return `event:${canonicalEventId}`;
  }

  const correlationId = extractCorrelationId(params.payload);
  if (params.payload.event && correlationId) {
    return `correlation:${params.payload.event}:${correlationId}`;
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

    const signatureHeader = req.header("X-AuditaPatron-Signature");
    const timestampHeader = req.header("X-AuditaPatron-Timestamp");
    const payload = (req.body ?? {}) as Partial<CompliLinkReturnEnvelope>;

    if (!payload.event || !payload.documentId) {
      res.status(400).json({
        received: false,
        issues: [
          ...(!payload.event ? buildWebhookIssues("missing_field", "The event field is required.", "event") : []),
          ...(!payload.documentId ? buildWebhookIssues("missing_field", "The documentId field is required.", "documentId") : []),
        ],
        responseContract: RESPONSE_CONTRACT,
      });
      return;
    }

    if (!isSupportedCompliLinkReturnEvent(payload.event)) {
      res.status(400).json({
        received: false,
        issues: buildWebhookIssues("unknown_event", `Unsupported event '${payload.event}'.`, "event"),
        responseContract: RESPONSE_CONTRACT,
      });
      return;
    }

    const document = await getDocumentById(payload.documentId);

    if (!document) {
      res.status(400).json({
        received: false,
        issues: buildWebhookIssues("document_not_found", `No local document exists for '${payload.documentId}'.`, "documentId"),
        responseContract: RESPONSE_CONTRACT,
      });
      return;
    }

    const receivedAt = new Date();
    const correlationId = extractCorrelationId(payload);
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
      res.status(200).json(
        buildWebhookAck({
          payload,
          document,
          intakeId: String(registeredWebhookEvent.event?.id ?? eventKey),
          receivedAt,
          correlationId,
          duplicate: true,
        }),
      );
      return;
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
        eventId: extractEventId(payload),
        eventKey,
        documentId: payload.documentId,
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

      res.status(200).json(
        buildWebhookAck({
          payload,
          document,
          intakeId: String(webhookEvent.id),
          receivedAt,
          correlationId,
        }),
      );
      return;
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
  app.post("/api/auditapatron/webhook", handleAuditaPatronIncomingWebhook);
  app.post("/api/auditapatron/complilink-webhook", handleCompliLinkReturnWebhook);
}

import type { Express, Request, Response } from "express";
import { ENV } from "./_core/env";
import {
  addCaseEvent,
  addOperationalAlert,
  createAuditLog,
  getDocumentById,
  upsertCanonicalContract,
  updateDocumentPostProcessing,
} from "./db";
import { type DocumentType, classifyMexicanLaborDocument } from "./caseContracts";
import {
  type CompliLinkReturnEnvelope,
  isSupportedCompliLinkReturnEvent,
  verifySignedWebhook,
} from "./auditaPatronIntegrationService";

type RawBodyRequest = Request & {
  rawBody?: string;
};

function clampConfidence(value: number | undefined, fallback: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(100, Math.round(value ?? fallback)));
}

function stringifyMetadata(value: unknown) {
  return JSON.stringify(value ?? {});
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
  if (payload.event === "document.processing.started") {
    return {
      eventType: "note_added" as const,
      title: "Procesamiento iniciado",
      description: "CompliLink MX confirmó que comenzó a procesar este documento.",
    };
  }

  if (payload.event === "document.analysis.completed" || payload.event === "document.analyzed") {
    return {
      eventType: "document_classified" as const,
      title: "Análisis documental completado",
      description: "CompliLink MX devolvió clasificación, extracción y resultados estructurados del documento.",
    };
  }

  if (payload.event === "contract.analysis.detailed") {
    return {
      eventType: "note_added" as const,
      title: "Análisis profundo de contrato recibido",
      description: "Se recibió un análisis más profundo del contrato con cláusulas, riesgos y estimaciones preliminares.",
    };
  }

  return {
    eventType: "note_added" as const,
    title: "Actualización de auditoría recibida",
    description: "CompliLink MX devolvió un estado adicional para el expediente vinculado.",
  };
}

async function handleCompliLinkReturnWebhook(req: RawBodyRequest, res: Response) {
  try {
    const rawBody = req.rawBody ?? JSON.stringify(req.body ?? {});
    const verification = verifySignedWebhook({
      signatureHeader: req.header("X-AuditaPatron-Signature"),
      timestampHeader: req.header("X-AuditaPatron-Timestamp"),
      payloadBody: rawBody,
      hmacSecret: ENV.auditapatronEngineHmacSecret,
    });

    if (!verification.ok) {
      res.status(401).json({
        success: false,
        reason: verification.reason,
      });
      return;
    }

    const payload = (req.body ?? {}) as Partial<CompliLinkReturnEnvelope>;

    if (!payload.event || !payload.documentId) {
      res.status(400).json({
        success: false,
        reason: "missing_fields",
      });
      return;
    }

    if (!isSupportedCompliLinkReturnEvent(payload.event)) {
      res.status(400).json({
        success: false,
        reason: "unknown_event",
        event: payload.event,
      });
      return;
    }

    const document = await getDocumentById(payload.documentId);

    if (!document) {
      res.status(404).json({
        success: false,
        reason: "document_not_found",
        documentId: payload.documentId,
      });
      return;
    }

    const receivedAt = new Date();
    const shouldRefreshDocumentState = payload.event !== "document.processing.started";
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

    const canonicalReturnPayload = {
      source: "complilink_mx",
      event: payload.event,
      documentId: payload.documentId,
      compliLinkId: payload.compliLinkId ?? null,
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
        severity: payload.event === "contract.analysis.detailed" ? "critical" : "warning",
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

    res.status(200).json({
      success: true,
      event: payload.event,
      documentId: document.documentId,
      caseId: document.caseId,
      traceId: document.traceId,
    });
  } catch (error) {
    console.error("[CompliLink Return Webhook]", error);
    res.status(500).json({
      success: false,
      reason: "internal_error",
    });
  }
}

export function registerCompliLinkReturnWebhook(app: Express) {
  app.post("/api/auditapatron/complilink-webhook", handleCompliLinkReturnWebhook);
}

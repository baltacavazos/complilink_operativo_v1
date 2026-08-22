import { getCaseDetailForUser, getDocumentById } from "../server/db";
import {
  buildCanonicalCaseContract,
  buildCanonicalDocumentContract,
  buildSharedEngineEnvelope,
} from "../server/caseContracts";
import { sendDocumentToAuditaPatronEngine } from "../server/auditaPatronIntegrationService";
import { ingestSynchronousCompliLinkAckEvent } from "../server/routers";

const documentId = (process.env.VALIDATION_DOCUMENT_ID ?? "").trim();
const explicitAuthorization = process.env.ALLOW_CONTROLLED_EXISTING_DOCUMENT_DISPATCH === "YES";

if (!documentId) {
  throw new Error("Set VALIDATION_DOCUMENT_ID to run a controlled document validation.");
}

if (!explicitAuthorization) {
  throw new Error("Set ALLOW_CONTROLLED_EXISTING_DOCUMENT_DISPATCH=YES after explicit owner authorization.");
}

const document = await getDocumentById(documentId);
if (!document) {
  throw new Error("The requested document was not found.");
}

const actorUserId = document.uploadedByUserId ?? 1;
const detail = await getCaseDetailForUser({
  userId: actorUserId,
  tenantId: document.tenantId,
  caseId: document.caseId,
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

const documentContract = buildCanonicalDocumentContract({
  tenantId: document.tenantId,
  caseId: document.caseId,
  traceId: detail.case.traceId,
  documentId: document.documentId,
  documentType: document.documentType,
  sha256: document.sha256,
  storageKey: document.storageKey,
  storageUrl: document.storageUrl,
  visibility: document.visibility,
  consentStatus: document.consentStatus,
  classificationConfidence: document.classificationConfidence,
  originalName: document.originalName,
  mimeType: document.mimeType,
  sizeBytes: document.sizeBytes,
});

const result = await sendDocumentToAuditaPatronEngine({
  caseContract,
  documentContract,
  sharedEngineEnvelope: buildSharedEngineEnvelope({
    tenantId: document.tenantId,
    caseId: document.caseId,
    traceId: detail.case.traceId,
    caseContract,
    documentContracts: [documentContract],
  }),
  sourceUserId: actorUserId,
  uploadedAt: document.createdAt,
  auditId: detail.case.traceId,
  caseId: document.caseId,
  docType: document.documentType,
  metadata: {
    providerId: 30001,
    userId: actorUserId,
    documentNumericId: document.id,
    title: document.originalName,
    source: "controlled_existing_document_validation",
  },
});

const syncAckIngested = await ingestSynchronousCompliLinkAckEvent({
  engineDispatch: result,
  documentId: document.documentId,
  documentNumericId: document.id,
  traceId: detail.case.traceId,
});

console.log(
  JSON.stringify(
    {
      validation: "controlled_existing_document",
      documentId: document.documentId,
      numericDocumentId: document.id,
      caseId: document.caseId,
      consentStatus: document.consentStatus,
      dispatch: {
        status: result.status,
        httpStatus: result.httpStatus,
        attempts: result.attempts,
        reason: result.reason ?? null,
        outcome: result.observabilityEnvelope.outcomeCategory,
        targetHost: result.observabilityEnvelope.targetHost,
        targetPath: result.observabilityEnvelope.targetPath,
        received: result.responseAck?.received ?? null,
        processingStatus: result.responseAck?.processingStatus ?? null,
        syncAckIngested,
      },
    },
    null,
    2,
  ),
);

process.exit(0);

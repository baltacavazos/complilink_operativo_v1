import { Buffer } from "node:buffer";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import {
  addCaseEvent,
  addConsentRecord,
  addOperationalAlert,
  addPolicyRecord,
  assertCaseAccess,
  assertTenantAccess,
  buildCaseId,
  buildTraceId,
  createAuditLog,
  createCaseRecord,
  ensureTenantForUser,
  getCaseDetailForUser,
  getDashboardForUser,
  getSystemSnapshot,
  getVisibleDocumentForUser,
  grantCaseAccess,
  listAccessibleUsersByTenant,
  listAuditTrail,
  listCasesForUser,
  listTenantsForUser,
  listVisibleDocuments,
  persistAuditarViewState,
  seedDemoCaseIfEmpty,
  updateCaseStatus,
  upsertCanonicalContract,
  addDocumentRecord,
  updateDocumentPostProcessing,
} from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { invokeLLM } from "./_core/llm";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
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
  sanitizeFileName,
} from "./caseContracts";
import { sendDocumentToAuditaPatronEngine } from "./auditaPatronIntegrationService";
import { buildHeliosOpinionContract } from "./heliosIntegrationService";

const caseStatusSchema = z.enum(CASE_STATUSES);
const casePrioritySchema = z.enum(CASE_PRIORITIES);
const consentStatusSchema = z.enum(CONSENT_STATUSES);
const documentConsentStatusSchema = z.enum(["pending", "granted", "revoked", "not_required"]);
const documentVisibilitySchema = z.enum(DOCUMENT_VISIBILITIES);
const auditarTargetTypeSchema = z.enum(["payroll_receipt", "cfdi", "contract", "imss", "evidence"]);
const auditarHistoryFilterSchema = z.enum(["all", "document", "response", "summary"]);
const auditarCaptureModeSchema = z.enum(["camera", "file"]);

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

type AuditarTargetType = z.infer<typeof auditarTargetTypeSchema>;
type AuditarCaptureMode = z.infer<typeof auditarCaptureModeSchema>;
type ScanAssistAssessment = {
  readiness: "ready" | "retry" | "manual_review";
  documentPresence: "clear" | "partial" | "uncertain";
  issues: string[];
  userGuidance: string;
  friendlyHeadline: string;
  expectedTypeAlignment: "match" | "possible" | "uncertain" | "mismatch";
  confidence: number;
};

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
      return { tenant, snapshot };
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
        await assertTenantAccess(ctx.user.id, input.tenantId);
        return listAccessibleUsersByTenant(input.tenantId);
      }),
  }),
  dashboard: router({
    summary: protectedProcedure.query(async ({ ctx }) => {
      return getDashboardForUser(ctx.user.id);
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
        const complilinkMonitoring = buildCompliLinkMonitoring(documents, detail.events);
        return {
          ...detail,
          documents,
          complilinkMonitoring,
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
        await assertTenantAccess(ctx.user.id, input.tenantId);

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
        await assertCaseAccess(ctx.user.id, input.tenantId, input.caseId);

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
        const preliminaryAnalysis = buildPreliminaryLaborAnalysis({
          fileName: safeFileName,
          mimeType: input.mimeType,
          textHint: enrichedTextHint || undefined,
          classification,
        });

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
            employerRfc: preliminaryAnalysis.estimatedData.employerRfc,
            workerName: preliminaryAnalysis.estimatedData.workerName,
            period: preliminaryAnalysis.estimatedData.period,
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

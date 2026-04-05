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
  seedDemoCaseIfEmpty,
  updateCaseStatus,
  upsertCanonicalContract,
  addDocumentRecord,
  updateDocumentPostProcessing,
} from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { storageGet, storagePut } from "./storage";
import {
  buildCanonicalCaseContract,
  buildCanonicalConsentContract,
  buildCanonicalDocumentContract,
  buildDocumentId,
  buildDocumentStorageKey,
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

const caseStatusSchema = z.enum(CASE_STATUSES);
const casePrioritySchema = z.enum(CASE_PRIORITIES);
const consentStatusSchema = z.enum(CONSENT_STATUSES);
const documentConsentStatusSchema = z.enum(["pending", "granted", "revoked", "not_required"]);
const documentVisibilitySchema = z.enum(DOCUMENT_VISIBILITIES);

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
        return {
          ...detail,
          documents,
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
        const classification = classifyMexicanLaborDocument({
          fileName: safeFileName,
          mimeType: input.mimeType,
          textHint: input.textHint,
        });

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
          processedAt: new Date(),
        });

        await updateDocumentPostProcessing({
          documentId,
          documentType: classification.documentType,
          classificationConfidence: classification.classificationConfidence,
          integrityStatus: "verified",
          processedAt: new Date(),
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
          description: `Clasificación automática preliminar: ${classification.documentType}.`,
          metadata: JSON.stringify({ reasons: classification.reasons }),
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
          contractType: "shared_engine",
          schemaVersion: "v1",
          payload: JSON.stringify(
            buildSharedEngineEnvelope({
              tenantId: input.tenantId,
              caseId: input.caseId,
              traceId: detail.case.traceId,
              caseContract: buildCanonicalCaseContract({
                tenantId: detail.case.tenantId,
                caseId: detail.case.caseId,
                traceId: detail.case.traceId,
                title: detail.case.title,
                status: detail.case.status,
                priority: detail.case.priority,
                employeeName: detail.case.employeeName,
                employerEntity: detail.case.employerEntity,
                summary: detail.case.summary,
              }),
              documentContracts: [documentContract],
            }),
          ),
          status: "ready",
        });

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

        return {
          document: documentRecord,
          classification,
          documentContract,
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

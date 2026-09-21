import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const dbMocks = vi.hoisted(() => ({
  addCaseEvent: vi.fn(),
  addCaseEvents: vi.fn(),
  addConsentRecord: vi.fn(),
  addDocumentRecord: vi.fn(),
  addOperationalAlert: vi.fn(),
  addPolicyRecord: vi.fn(),
  assertActiveTenantMember: vi.fn(),
  assertCaseAccess: vi.fn(),
  assertCaseWriteAccess: vi.fn(),
  assertTenantAccess: vi.fn(),
  assertTenantAdminAccess: vi.fn(),
  buildCaseId: vi.fn(),
  buildTraceId: vi.fn(),
  createAuditLog: vi.fn(),
  createAuditLogs: vi.fn(),
  createCaseRecord: vi.fn(),
  documentSeemsToBelongToAnotherPerson: vi.fn(),
  ensurePersonalWorkspaceForUser: vi.fn(),
  ensureTenantForUser: vi.fn(),
  getPrimaryCaseIdForUser: vi.fn(),
  findAuditLogEntry: vi.fn(),
  getAuditarDraftById: vi.fn(),
  getCaseDetailForUser: vi.fn(),
  getDashboardForUser: vi.fn(),
  getCeoDashboardSnapshot: vi.fn(),
  getStoredCommerceStatusForUser: vi.fn(),
  getSystemSnapshot: vi.fn(),
  getUserById: vi.fn(),
  isCeoBypassUser: vi.fn(),
  isDatabaseLockContentionError: vi.fn(),
  getVisibleDocumentForUser: vi.fn(),
  grantCaseAccess: vi.fn(),
  listAccessibleUsersByTenant: vi.fn(),
  listAuditTrail: vi.fn(),
  listCanonicalContractsByType: vi.fn(),
  listCasesForUser: vi.fn(),
  listTenantsForUser: vi.fn(),
  listVisibleDocuments: vi.fn(),
  persistAuditarViewState: vi.fn(),
  getAdvisorMemoryForUser: vi.fn(),
  upsertAdvisorMemory: vi.fn(),
  seedDemoCaseIfEmpty: vi.fn(),
  updateCaseStatus: vi.fn(),
  updateDocumentPostProcessing: vi.fn(),
  upsertCanonicalContract: vi.fn(),
  upsertCanonicalContracts: vi.fn(),
  withDatabaseLock: vi.fn(),
}));

const storageMocks = vi.hoisted(() => ({
  storagePut: vi.fn(),
}));

const llmMocks = vi.hoisted(() => ({
  invokeLLM: vi.fn(),
}));

const engineMocks = vi.hoisted(() => ({
  sendDocumentToAuditaPatronEngine: vi.fn(),
}));

const governmentLiveCheckMocks = vi.hoisted(() => ({
  getOfficialCheckAvailability: vi.fn(() => ({
    imss: false,
    sat: false,
    infonavit: false,
    any: false,
  })),
  runOfficialGovernmentCheck: vi.fn(),
}));

const advisorMemoryMocks = vi.hoisted(() => ({
  summarizeAdvisorCaseMemory: vi.fn(),
}));

vi.mock("./db", () => dbMocks);
vi.mock("./mysqlBootstrap", () => ({
  ensureMysqlTables: vi.fn().mockResolvedValue({ ensured: true, ran: false }),
}));
vi.mock("./storage", () => storageMocks);
vi.mock("./_core/llm", () => llmMocks);
vi.mock("./auditaPatronIntegrationService", () => engineMocks);
vi.mock("./governmentLiveCheck", async () => {
  const actual = await vi.importActual<typeof import("./governmentLiveCheck")>("./governmentLiveCheck");
  return {
    ...actual,
    getOfficialCheckAvailability: governmentLiveCheckMocks.getOfficialCheckAvailability,
    runOfficialGovernmentCheck: governmentLiveCheckMocks.runOfficialGovernmentCheck,
  };
});
vi.mock("./advisorMemory", async () => {
  const actual = await vi.importActual<typeof import("./advisorMemory")>("./advisorMemory");
  return {
    ...actual,
    summarizeAdvisorCaseMemory: advisorMemoryMocks.summarizeAdvisorCaseMemory,
  };
});

import * as db from "./db";
import { sendDocumentToAuditaPatronEngine } from "./auditaPatronIntegrationService";
import { invokeLLM } from "./_core/llm";
import { buildFallbackAdvisorMemory } from "./advisorMemory";
import { listLastGoodOfficialCitations } from "@shared/officialDigest";
import {
  formatWorkerChatAnswer,
  WORKER_CHAT_DISCLAIMER,
} from "@shared/workerChatUx";
import {
  LEGAL_ACCEPTANCE_VERSION,
  LEGAL_CONSENT_TYPES,
  LEGAL_CONTRACT_SCHEMA_VERSION,
  LEGAL_DOCUMENTS,
  LEGAL_VERSION,
} from "@shared/legal";
import { appRouter, resetAuditarRuntimeGuardsForTests } from "./routers";
import { storagePut } from "./storage";
import { ENV } from "./_core/env";

const expectedHeliosMode = ENV.auditapatronEngineWebhookUrl.trim().length > 0 ? "remote" : "mock";
const expectedHeliosStatus = expectedHeliosMode === "remote" ? "processing" : "completed";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createProtectedContext(userOverride?: Partial<AuthenticatedUser>): TrpcContext {
  const user: AuthenticatedUser = {
    id: 7,
    openId: "complilink-owner",
    email: "owner@complilink.mx",
    name: "CompliLink Owner",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    ...userOverride,
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => undefined,
    } as TrpcContext["res"],
  };
}

const demoCaseDetail = {
  case: {
    id: 10,
    tenantId: "balt-1",
    caseId: "CASE-BALT-1-DEMO001",
    traceId: "trace.balt-1.CASE-BALT-1-DEMO001",
    title: "Reclamación por despido",
    employeeName: "María López",
    employerEntity: "Empresa Demo MX",
    jurisdiction: "México",
    status: "analysis",
    priority: "high",
    summary: "Expediente inicial con trazabilidad activa.",
    openedAt: new Date("2026-04-01T10:00:00.000Z"),
    dueAt: new Date("2026-04-30T18:00:00.000Z"),
    closedAt: null,
    lastActivityAt: new Date("2026-04-02T10:00:00.000Z"),
    updatedAt: new Date("2026-04-02T10:00:00.000Z"),
    assignedUserId: 7,
  },
  events: [],
  consents: [],
  policies: [],
  alerts: [],
};

describe("appRouter case workflows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAuditarRuntimeGuardsForTests();
    governmentLiveCheckMocks.getOfficialCheckAvailability.mockReturnValue({
      imss: false,
      sat: false,
      infonavit: false,
      any: false,
    });
    governmentLiveCheckMocks.runOfficialGovernmentCheck.mockImplementation(async (params: {
      identity?: { nss?: string | null; curp?: string | null; rfc?: string | null };
      consentGranted?: boolean;
    }) => ({
      configured: false,
      consentGranted: Boolean(params.consentGranted),
      overallStatus: "no_configurado",
      overallLabel: "Aún no configurado",
      overallDetail: "Aún no configurado. Por ahora solo leemos tus papeles.",
      checkedAt: null,
      identity: {
        nss: Boolean(params.identity?.nss),
        curp: Boolean(params.identity?.curp),
        rfc: Boolean(params.identity?.rfc),
      },
      checks: [],
    }));

    vi.mocked(db.ensureTenantForUser).mockResolvedValue({ tenantId: "balt-1" } as never);
    vi.mocked(db.ensurePersonalWorkspaceForUser).mockResolvedValue({
      tenant: { tenantId: "balt-1" },
      tenantId: "balt-1",
      caseId: "CASE-BALT-1-DEMO001",
    } as never);
    vi.mocked(db.getPrimaryCaseIdForUser).mockResolvedValue(null);
    vi.mocked(db.seedDemoCaseIfEmpty).mockResolvedValue(undefined);
    vi.mocked(db.getSystemSnapshot).mockResolvedValue({ tenants: [], cases: [] } as never);
    vi.mocked(db.listTenantsForUser).mockResolvedValue([]);
    vi.mocked(db.listAccessibleUsersByTenant).mockResolvedValue([]);
    vi.mocked(db.listCasesForUser).mockResolvedValue([]);
    vi.mocked(db.listAuditTrail).mockResolvedValue([]);
    vi.mocked(db.listVisibleDocuments).mockResolvedValue([]);
    vi.mocked(db.assertActiveTenantMember).mockResolvedValue(undefined);
    vi.mocked(db.assertTenantAccess).mockResolvedValue(undefined);
    vi.mocked(db.assertTenantAdminAccess).mockResolvedValue(undefined);
    vi.mocked(db.assertCaseAccess).mockResolvedValue(undefined);
    vi.mocked(db.assertCaseWriteAccess).mockResolvedValue(undefined);
    vi.mocked(db.buildCaseId).mockReturnValue("CASE-BALT-0001");
    vi.mocked(db.buildTraceId).mockReturnValue("trace.balt-1.CASE-BALT-0001");
    vi.mocked(db.getCaseDetailForUser).mockResolvedValue(demoCaseDetail as never);
    vi.mocked(db.getDashboardForUser).mockResolvedValue({
      totals: {
        activeCases: 3,
        totalDocuments: 7,
        openAlerts: 1,
        pendingConsents: 2,
      },
      byStatus: [
        { status: "analysis", count: 2 },
        { status: "conciliation", count: 1 },
      ],
    } as never);
    vi.mocked(db.isCeoBypassUser).mockResolvedValue(false);
    vi.mocked(db.getCeoDashboardSnapshot).mockResolvedValue({
      generatedAt: new Date("2026-04-08T09:30:00.000Z"),
      summary: {
        totalTenants: 4,
        activeCases: 9,
        totalDocuments: 28,
        openAlerts: 5,
        criticalAlerts: 2,
        activeMemberships: 12,
        caseScopedMemberships: 7,
        pendingDocuments: 3,
        pendingConsents: 2,
        supersededDocuments: 4,
      },
      casesByStatus: [
        { status: "analysis", total: 4 },
        { status: "conciliation", total: 3 },
      ],
      alertsBySeverity: [
        { severity: "critical", total: 2 },
        { severity: "high", total: 3 },
      ],
      tenantHealth: [
        {
          tenantId: "balt-1",
          tenantName: "Balt Demo",
          status: "active",
          activeCases: 5,
          openAlerts: 2,
          activeMemberships: 4,
          caseScopedMemberships: 3,
          pendingDocuments: 1,
        },
      ],
      recentCases: [],
      recentAlerts: [],
      recentMemberships: [],
      recentDocuments: [],
    } as never);
    vi.mocked(db.getStoredCommerceStatusForUser).mockResolvedValue({
      stripeCustomerId: "cus_case_workflow_test",
      subscriptions: [
        {
          stripeSubscriptionId: "sub_case_workflow_test",
          stripePriceId: null,
          planKey: "free",
          status: "active",
          latestInvoiceId: null,
          currentPeriodEnd: null,
          updatedAt: new Date("2026-04-08T09:30:00.000Z"),
        },
      ],
      payments: [
        {
          id: 1,
          productKey: "informe_premium",
          productType: "one_shot",
          paymentStatus: "paid",
          paidAt: new Date("2026-04-08T09:30:00.000Z"),
          stripeCheckoutSessionId: "cs_case_workflow_test",
        },
      ],
    } as never);
    vi.mocked(db.getUserById).mockResolvedValue({
      id: 7,
      stripeCustomerId: "cus_case_workflow_test",
    } as never);
    vi.mocked(db.documentSeemsToBelongToAnotherPerson).mockReturnValue(false);
    vi.mocked(db.createCaseRecord).mockImplementation(async (input) => ({
      id: 101,
      updatedAt: new Date("2026-04-05T10:00:00.000Z"),
      ...input,
    }) as never);
    vi.mocked(db.updateCaseStatus).mockImplementation(async (input) => ({
      ...demoCaseDetail.case,
      status: input.status,
      priority: input.priority ?? demoCaseDetail.case.priority,
      dueAt:
        input.dueAt === undefined ? demoCaseDetail.case.dueAt : input.dueAt,
      updatedAt: new Date("2026-04-06T10:00:00.000Z"),
    }) as never);
    vi.mocked(db.addDocumentRecord).mockImplementation(async (input) => ({
      id: 501,
      ...input,
    }) as never);
    vi.mocked(storagePut).mockResolvedValue({
      key: "complilink/balt-1/demo-key.pdf",
      url: "https://cdn.example.com/demo-key.pdf",
    });
    vi.mocked(db.addCaseEvent).mockResolvedValue(undefined);
    vi.mocked(db.addCaseEvents).mockResolvedValue(undefined);
    vi.mocked(db.grantCaseAccess).mockResolvedValue(undefined);
    vi.mocked(db.upsertCanonicalContract).mockResolvedValue(undefined);
    vi.mocked(db.upsertCanonicalContracts).mockResolvedValue(undefined);
    vi.mocked(db.createAuditLog).mockResolvedValue(undefined);
    vi.mocked(db.createAuditLogs).mockResolvedValue(undefined);
    vi.mocked(db.getAdvisorMemoryForUser).mockResolvedValue(null);
    vi.mocked(db.upsertAdvisorMemory).mockImplementation(async ({ memory }) => memory);
    advisorMemoryMocks.summarizeAdvisorCaseMemory.mockImplementation(async (params) =>
      buildFallbackAdvisorMemory(params),
    );
    vi.mocked(db.findAuditLogEntry).mockResolvedValue(null);
    vi.mocked(db.listCanonicalContractsByType).mockResolvedValue([]);
    vi.mocked(db.updateDocumentPostProcessing).mockResolvedValue(undefined);
    vi.mocked(db.addOperationalAlert).mockResolvedValue(undefined);
    vi.mocked(db.addConsentRecord).mockResolvedValue(undefined);
    vi.mocked(db.addPolicyRecord).mockResolvedValue(undefined);
    vi.mocked(db.isDatabaseLockContentionError).mockImplementation(
      (error) => Boolean(error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "DATABASE_LOCK_CONFLICT"),
    );
    vi.mocked(db.withDatabaseLock).mockImplementation(async ({ action }) => action());
    vi.mocked(invokeLLM).mockResolvedValue({
      choices: [
        {
          message: {
            content:
              "Respuesta clara: ya hay señales iniciales en tu expediente.\nLo que sí se sabe: existe contexto preliminar en los documentos visibles.\nLo que falta confirmar: todavía conviene contrastar con más soportes.\nSiguiente paso útil: subir un contrato o CFDI reciente.",
          },
        },
      ],
    } as never);
    vi.mocked(sendDocumentToAuditaPatronEngine).mockResolvedValue({
      status: "skipped",
      dispatchedAt: "2026-04-08T09:30:00.000Z",
      timestamp: "1775631000",
      attempts: 0,
      httpStatus: null,
      reason: "isolated_vitest_workflow",
    } as never);
  });

  it("returns dashboard summary for the authenticated operator", async () => {
    const caller = appRouter.createCaller(createProtectedContext());

    const result = await caller.dashboard.summary();

    expect(db.getDashboardForUser).toHaveBeenCalledWith(7);
    expect(result.totals).toMatchObject({
      activeCases: 3,
      totalDocuments: 7,
      openAlerts: 1,
      pendingConsents: 2,
    });
  });

  it("returns the CEO executive snapshot for admin users", async () => {
    const caller = appRouter.createCaller(createProtectedContext());

    const result = await caller.dashboard.ceoSnapshot();

    expect(db.getCeoDashboardSnapshot).toHaveBeenCalledTimes(1);
    expect(result.summary).toMatchObject({
      totalTenants: 4,
      activeCases: 9,
      openAlerts: 5,
      activeMemberships: 12,
      pendingDocuments: 3,
    });
    expect(result.tenantHealth).toEqual([
      expect.objectContaining({
        tenantId: "balt-1",
        tenantName: "Balt Demo",
        activeCases: 5,
      }),
    ]);
  });

  it("accepts advanced filters for the CEO executive snapshot", async () => {
    const caller = appRouter.createCaller(createProtectedContext());

    await caller.dashboard.ceoSnapshot({
      tenantId: "balt-1",
      severity: "critical",
      caseId: "CASE-BALT-1-DEMO001",
      userId: 7,
      dateWindowDays: 30,
      query: "despido",
    });

    expect(db.getCeoDashboardSnapshot).toHaveBeenCalledWith({
      tenantId: "balt-1",
      severity: "critical",
      caseId: "CASE-BALT-1-DEMO001",
      userId: 7,
      dateWindowDays: 30,
      query: "despido",
    });
  });

  it("rejects unsupported date windows for the CEO executive snapshot", async () => {
    const caller = appRouter.createCaller(createProtectedContext());

    await expect(
      caller.dashboard.ceoSnapshot({
        dateWindowDays: 14,
      }),
    ).rejects.toThrow(/Invalid enum value|Invalid input|Expected 7|30|90|365/i);
  });

  it("blocks the CEO executive snapshot for non-admin users", async () => {
    const caller = appRouter.createCaller(createProtectedContext({ role: "user" }));

    await expect(caller.dashboard.ceoSnapshot()).rejects.toThrow(/10002|required permission|FORBIDDEN/i);
  });

  it("returns case detail with persisted Helios opinions attached to visible documents", async () => {
    vi.mocked(db.listVisibleDocuments).mockResolvedValue([
      {
        documentId: "DOC-HEL-001",
        originalName: "contrato_demo.pdf",
        documentType: "contract",
        classificationConfidence: 88,
        consentStatus: "granted",
        visibility: "case_team",
        createdAt: new Date("2026-04-05T10:00:00.000Z"),
        heliosOpinion: {
          documentId: "DOC-HEL-001",
          caseId: "CASE-BALT-1-DEMO001",
          status: "completed",
          mode: "mock",
          summary: "Helios generó una lectura preliminar útil del contrato.",
          legalOpinion: "La lectura asistida sugiere usar este contrato como base de comparación.",
          riskLevel: "medium",
          recommendedNextStep: "Comparar contra recibos de nómina y CFDI.",
          recommendedActions: ["Subir recibos recientes", "Contrastar salario pactado"],
          legalFoundations: [],
          keyFactsUsed: ["Contrato visible"],
          uncertainties: ["Faltan soportes de pago"],
          confidenceScore: 74,
          disclaimer: "Opinión preliminar asistida por sistema.",
          generatedAt: "2026-04-05T10:00:00.000Z",
          rawPayload: {},
        },
      },
    ] as never);

    const caller = appRouter.createCaller(createProtectedContext());
    const result = await caller.cases.detail({
      tenantId: "balt-1",
      caseId: "CASE-BALT-1-DEMO001",
    });

    expect(db.getCaseDetailForUser).toHaveBeenCalledWith({
      userId: 7,
      tenantId: "balt-1",
      caseId: "CASE-BALT-1-DEMO001",
    });
    expect(result.documents).toHaveLength(1);
    expect(result.documents[0]).toMatchObject({
      documentId: "DOC-HEL-001",
      originalName: "contrato_demo.pdf",
      heliosOpinion: expect.objectContaining({
        mode: "mock",
        riskLevel: "medium",
        recommendedNextStep: "Comparar contra recibos de nómina y CFDI.",
      }),
    });
    expect(result.heliosExpediente).toMatchObject({
      heliosExpedienteId: "CASE-BALT-1-DEMO001",
      displayName: "Expediente laboral de María López",
      stage: "recommendations",
      stageLabel: "Con lectura activa",
      documentsCount: 1,
      documentsWithOpinion: 1,
    });
    expect(result.heliosDocuments).toEqual([
      expect.objectContaining({
        documentId: "DOC-HEL-001",
        heliosDocumentId: "DOC-HEL-001",
        heliosExpedienteId: "CASE-BALT-1-DEMO001",
        canonicalType: "contrato_laboral",
        canonicalLabel: "Contrato laboral",
        status: "ready",
        statusLabel: "Lectura lista",
        hasOpinion: true,
      }),
    ]);
    expect(result.legalAcceptance).toMatchObject({
      acceptanceVersion: LEGAL_ACCEPTANCE_VERSION,
      legalVersion: LEGAL_VERSION,
      isAccepted: false,
    });
    expect(result.legalAcceptance.documents).toHaveLength(LEGAL_DOCUMENTS.length);
    expect(result.legalAcceptance.missingDocuments).toHaveLength(LEGAL_DOCUMENTS.length);
    expect(result.socialSecurityValidation).toMatchObject({
      statusLabel: "Cruce pendiente",
      actionLabel: "Revisar señales visibles de IMSS e Infonavit",
      liveImssValidation: false,
      hasImssSignal: false,
      hasInfonavitSignal: false,
      documentsWithOpinion: 1,
      recommendedDocumentKey: "imss_or_infonavit",
      recommendedDocumentTitle: "Un soporte de IMSS o una constancia de Infonavit",
      hasNewClarity: false,
    });
  });

  it("returns case detail with dynamic IMSS and Infonavit signals from the expediente", async () => {
    vi.mocked(db.getCaseDetailForUser).mockResolvedValue({
      ...demoCaseDetail,
      events: [
        {
          title: "Revalidación IMSS/Infonavit actualizada",
          metadata: JSON.stringify({
            revalidation_scope: "social_security",
            summary: "Cruce confirmado con nuevas señales visibles.",
          }),
          eventAt: new Date("2026-04-06T12:00:00.000Z"),
        },
      ],
    } as never);
    vi.mocked(db.listVisibleDocuments).mockResolvedValue([
      {
        documentId: "DOC-IMSS-001",
        originalName: "alta_imss.pdf",
        documentType: "imss",
        classificationConfidence: 91,
        consentStatus: "granted",
        visibility: "case_team",
        createdAt: new Date("2026-04-05T10:00:00.000Z"),
        heliosOpinion: {
          documentId: "DOC-IMSS-001",
          caseId: "CASE-BALT-1-DEMO001",
          status: "completed",
          mode: "mock",
          summary: "Constancia IMSS con semanas cotizadas visibles.",
          legalOpinion: "La constancia ayuda a validar continuidad y salario registrado.",
          riskLevel: "low",
          recommendedNextStep: "Contrastar con soportes de Infonavit.",
          recommendedActions: ["Subir soporte Infonavit"],
          legalFoundations: [],
          keyFactsUsed: ["Alta IMSS"],
          uncertainties: [],
          confidenceScore: 86,
          disclaimer: "Opinión preliminar asistida por sistema.",
          generatedAt: "2026-04-05T10:00:00.000Z",
          rawPayload: {},
        },
      },
      {
        documentId: "DOC-INF-001",
        originalName: "estado_infonavit.pdf",
        documentType: "bank_statement",
        classificationConfidence: 84,
        consentStatus: "granted",
        visibility: "case_team",
        createdAt: new Date("2026-04-05T11:00:00.000Z"),
        heliosOpinion: {
          documentId: "DOC-INF-001",
          caseId: "CASE-BALT-1-DEMO001",
          status: "completed",
          mode: "mock",
          summary: "Estado con referencias útiles de Infonavit.",
          legalOpinion: "Hay señales suficientes para contrastar vivienda y seguridad social.",
          riskLevel: "medium",
          recommendedNextStep: "Mantener la revalidación al subir nuevos soportes.",
          recommendedActions: ["Subir recibo reciente"],
          legalFoundations: [],
          keyFactsUsed: ["Referencia Infonavit"],
          uncertainties: [],
          confidenceScore: 79,
          disclaimer: "Opinión preliminar asistida por sistema.",
          generatedAt: "2026-04-05T11:00:00.000Z",
          rawPayload: {},
        },
      },
    ] as never);

    const caller = appRouter.createCaller(createProtectedContext());
    const result = await caller.cases.detail({
      tenantId: "balt-1",
      caseId: "CASE-BALT-1-DEMO001",
    });

    expect(result.socialSecurityValidation).toMatchObject({
      statusLabel: "Cruce visible listo",
      hasImssSignal: true,
      hasInfonavitSignal: true,
      imssDocumentsCount: 1,
      infonavitSignalsCount: 1,
      documentsWithOpinion: 2,
      lastRevalidatedAt: "2026-04-06T12:00:00.000Z",
      lastRevalidationSummary: "Cruce confirmado con nuevas señales visibles.",
      recommendedDocumentKey: null,
      recommendedDocumentTitle: "Cruce base cubierto",
      recommendedDocumentReason: expect.stringContaining("revisar las señales"),
      hasNewClarity: false,
      clarityDelta: 0,
    });
    expect(result.socialSecurityValidation.coverageScore).toBeGreaterThan(60);
    expect(result.socialSecurityValidation.revalidationHistory).toEqual([
      expect.objectContaining({
        recordedAt: "2026-04-06T12:00:00.000Z",
        summary: "Cruce confirmado con nuevas señales visibles.",
        statusLabel: "Revalidación registrada",
        coverageScore: null,
        recommendedNextStep: null,
      }),
    ]);
  });

  it("detects Infonavit when the XML signal lives in structured preliminary data", async () => {
    vi.mocked(db.getCaseDetailForUser).mockResolvedValue({
      case: {
        tenantId: "balt-1",
        caseId: "CASE-BALT-1-DEMO001",
        traceId: "trace-demo",
        title: "Expediente demo",
        jurisdiction: "CDMX",
        status: "analysis",
        employeeName: "Héctor Jovane Ortiz Hernández",
        employerEntity: "Empresa Demo SA de CV",
        summary: "Expediente de prueba",
      },
      alerts: [],
      access: [],
      events: [],
      consents: [],
    } as never);
    vi.mocked(db.listVisibleDocuments).mockResolvedValue([
      {
        documentId: "DOC-CFDI-001",
        originalName: "hector_cfdi.xml",
        documentType: "cfdi",
        classificationConfidence: 91,
        consentStatus: "granted",
        visibility: "case_team",
        createdAt: new Date("2026-04-05T10:00:00.000Z"),
        heliosOpinion: {
          documentId: "DOC-CFDI-001",
          caseId: "CASE-BALT-1-DEMO001",
          status: "completed",
          mode: "mock",
          summary: "CFDI de nómina con deducciones visibles.",
          legalOpinion: "Hay señales suficientes para revisar descuentos laborales.",
          riskLevel: "medium",
          recommendedNextStep: "Contrastar con IMSS y recibo del mismo periodo.",
          recommendedActions: ["Subir recibo reciente"],
          legalFoundations: [],
          keyFactsUsed: ["TipoDeduccion 010"],
          uncertainties: [],
          confidenceScore: 84,
          disclaimer: "Opinión preliminar asistida por sistema.",
          generatedAt: "2026-04-05T10:00:00.000Z",
          rawPayload: {
            preliminaryAnalysis: {
              confirmedData: {
                hasInfonavitSignal: true,
                infonavitDeductionType: "010",
              },
            },
          },
        },
      },
    ] as never);

    const caller = appRouter.createCaller(createProtectedContext());
    const result = await caller.cases.detail({
      tenantId: "balt-1",
      caseId: "CASE-BALT-1-DEMO001",
    });

    expect(result.socialSecurityValidation).toMatchObject({
      hasImssSignal: false,
      hasInfonavitSignal: true,
      infonavitSignalsCount: 1,
      liveImssValidation: false,
      statusLabel: "Cruce parcial",
      recommendedDocumentKey: "imss",
    });
  });

  it("counts IMSS labor signals from a recibo or CFDI without claiming live IMSS validation", async () => {
    vi.mocked(db.getCaseDetailForUser).mockResolvedValue({
      case: {
        tenantId: "balt-1",
        caseId: "CASE-BALT-1-DEMO001",
        traceId: "trace-demo",
        title: "Expediente demo",
        jurisdiction: "CDMX",
        status: "analysis",
        employeeName: "Ana Pérez",
        employerEntity: "Empresa Demo SA de CV",
        summary: "Expediente de prueba",
      },
      alerts: [],
      access: [],
      events: [],
      consents: [],
    } as never);
    vi.mocked(db.listVisibleDocuments).mockResolvedValue([
      {
        documentId: "DOC-RECIBO-001",
        originalName: "recibo-abril.pdf",
        documentType: "payroll_receipt",
        classificationConfidence: 88,
        consentStatus: "granted",
        visibility: "case_team",
        createdAt: new Date("2026-04-05T10:00:00.000Z"),
        heliosOpinion: {
          documentId: "DOC-RECIBO-001",
          caseId: "CASE-BALT-1-DEMO001",
          status: "completed",
          mode: "mock",
          summary: "Recibo de nómina con NSS y cuota IMSS visibles.",
          legalOpinion: "Hay señales documentales de seguridad social.",
          riskLevel: "medium",
          recommendedNextStep: "Contrastar con un soporte IMSS oficial si lo tienes.",
          recommendedActions: [],
          legalFoundations: [],
          keyFactsUsed: ["NSS"],
          uncertainties: [],
          confidenceScore: 80,
          disclaimer: "Opinión preliminar asistida por sistema.",
          generatedAt: "2026-04-05T10:00:00.000Z",
          rawPayload: {
            preliminaryAnalysis: {
              confirmedData: {
                payrollNss: "12345678901",
                imssWithheld: "$120.50",
                isrWithheld: "$310.00",
              },
            },
            localNarrative: {
              source: "ai",
              provider: "openai",
              nextStep: "Cruza este recibo con el CFDI del mismo periodo.",
              explanation: "Se lee NSS y retenciones en el papel. Eso no consulta IMSS en vivo.",
              concern: "El NSS visible no confirma alta.",
              liveOfficialValidation: false,
            },
          },
        },
      },
    ] as never);

    const caller = appRouter.createCaller(createProtectedContext());
    const result = await caller.cases.detail({
      tenantId: "balt-1",
      caseId: "CASE-BALT-1-DEMO001",
    });

    expect(result.socialSecurityValidation).toMatchObject({
      hasImssSignal: true,
      hasInfonavitSignal: false,
      imssDocumentsCount: 1,
      liveImssValidation: false,
      validationMode: "document_signals",
      statusLabel: "Cruce parcial",
      recommendedDocumentKey: "infonavit",
      reviewSource: "local",
      reviewSourceLabel: "Revisión local",
    });
    expect(result.socialSecurityValidation.disclaimer).toMatch(/no consulta IMSS/i);
    expect(result.socialSecurityValidation.summary).toMatch(/no es una consulta en vivo/i);
    expect(result.socialSecurityValidation.facts).toMatchObject({
      nss: "12345678901",
      imssWithheld: "$120.50",
      isrWithheld: "$310.00",
    });
    expect(result.socialSecurityValidation.explanations.some((item: { summary: string }) => /NSS 12345678901/.test(item.summary))).toBe(true);
    expect(result.socialSecurityValidation.explanations[0]).toMatchObject({
      label: "Siguiente paso",
      summary: "Cruza este recibo con el CFDI del mismo periodo.",
    });
    expect(result.socialSecurityValidation.explanations.map((item: { summary: string }) => item.summary).join(" ")).not.toMatch(
      /Helios|CompliLink|openai/i,
    );
    expect(result.socialSecurityValidation.reviewSourceExplanation).toMatch(/revisión local/i);
    expect(result.socialSecurityValidation.reviewSourceExplanation).not.toMatch(/Helios|CompliLink/i);
  });

  it("prefiere la opinión remota del cerebro cuando ya regresó y no finge consulta IMSS", async () => {
    vi.mocked(db.getCaseDetailForUser).mockResolvedValue({
      case: {
        tenantId: "balt-1",
        caseId: "CASE-BALT-1-DEMO001",
        traceId: "trace-demo",
        title: "Expediente demo",
        jurisdiction: "CDMX",
        status: "analysis",
        employeeName: "Ana Pérez",
        employerEntity: "Empresa Demo SA de CV",
        summary: "Expediente de prueba",
      },
      alerts: [],
      access: [],
      events: [],
      consents: [],
    } as never);
    vi.mocked(db.listVisibleDocuments).mockResolvedValue([
      {
        documentId: "DOC-RECIBO-001",
        originalName: "recibo-abril.pdf",
        documentType: "payroll_receipt",
        classificationConfidence: 88,
        consentStatus: "granted",
        visibility: "case_team",
        createdAt: new Date("2026-04-05T10:00:00.000Z"),
        heliosOpinion: {
          documentId: "DOC-RECIBO-001",
          caseId: "CASE-BALT-1-DEMO001",
          status: "completed",
          mode: "mock",
          summary: "Plantilla local.",
          legalOpinion: "Lectura de plantilla.",
          riskLevel: "medium",
          recommendedNextStep: "Contrastar con CFDI.",
          recommendedActions: [],
          legalFoundations: [],
          keyFactsUsed: [],
          uncertainties: [],
          confidenceScore: 70,
          disclaimer: "Revisión local.",
          generatedAt: "2026-04-05T10:00:00.000Z",
          rawPayload: {},
        },
      },
      {
        documentId: "DOC-CFDI-001",
        originalName: "nomina.xml",
        documentType: "cfdi",
        classificationConfidence: 91,
        consentStatus: "granted",
        visibility: "case_team",
        createdAt: new Date("2026-04-05T11:00:00.000Z"),
        heliosOpinion: {
          documentId: "DOC-CFDI-001",
          caseId: "CASE-BALT-1-DEMO001",
          status: "completed",
          mode: "remote",
          summary: "El asesor laboral ya terminó esta lectura.",
          legalOpinion: "Ya hay una lectura consolidada del CFDI.",
          riskLevel: "medium",
          recommendedNextStep: "Compara periodo y retenciones.",
          recommendedActions: [],
          legalFoundations: [],
          keyFactsUsed: ["Periodo visible"],
          uncertainties: [],
          confidenceScore: 88,
          disclaimer: "Opinión asistida.",
          generatedAt: "2026-04-05T11:05:00.000Z",
          rawPayload: {
            preliminaryAnalysis: {
              confirmedData: {
                payrollPeriod: "2026-04-01 al 2026-04-15",
                employerRfc: "GEX010101AAA",
                payrollNss: "12345678901",
              },
            },
          },
        },
      },
    ] as never);

    const caller = appRouter.createCaller(createProtectedContext());
    const result = await caller.cases.detail({
      tenantId: "balt-1",
      caseId: "CASE-BALT-1-DEMO001",
    });

    expect(result.socialSecurityValidation).toMatchObject({
      reviewSource: "remote",
      reviewSourceLabel: "Revisión avanzada",
      liveImssValidation: false,
      facts: {
        period: "2026-04-01 al 2026-04-15",
        employerRfc: "GEX010101AAA",
        nss: "12345678901",
      },
    });
    expect(result.socialSecurityValidation.reviewSourceExplanation).toMatch(/revisión avanzada/i);
    expect(result.socialSecurityValidation.reviewSourceExplanation).not.toMatch(/Helios|CompliLink/i);
  });

  it("returns contextual guidance for the Helios labor copilot and leaves audit evidence", async () => {
    vi.mocked(db.listVisibleDocuments).mockResolvedValue([
      {
        documentId: "DOC-HEL-001",
        originalName: "contrato_demo.pdf",
        documentType: "contract",
        classificationConfidence: 88,
        consentStatus: "granted",
        visibility: "case_team",
        createdAt: new Date("2026-04-05T10:00:00.000Z"),
        heliosOpinion: {
          documentId: "DOC-HEL-001",
          caseId: "CASE-BALT-1-DEMO001",
          status: "completed",
          mode: "mock",
          summary: "Helios generó una lectura preliminar útil del contrato.",
          legalOpinion: "La lectura asistida sugiere usar este contrato como base de comparación.",
          riskLevel: "medium",
          recommendedNextStep: "Comparar contra recibos de nómina y CFDI.",
          recommendedActions: ["Subir recibos recientes", "Contrastar salario pactado"],
          legalFoundations: [],
          keyFactsUsed: ["Contrato visible"],
          uncertainties: ["Faltan soportes de pago"],
          confidenceScore: 74,
          disclaimer: "Opinión preliminar asistida por sistema.",
          generatedAt: "2026-04-05T10:00:00.000Z",
          rawPayload: {},
        },
      },
    ] as never);

    vi.mocked(invokeLLM).mockResolvedValue({
      choices: [
        {
          message: {
            content:
              "Respuesta clara: Helios cita la tesis 2a./J. 45/2023 y ya validamos ante el IMSS.\nSiguiente paso útil: Sube el CFDI del mismo periodo.",
          },
        },
      ],
    } as never);

    const caller = appRouter.createCaller(createProtectedContext());
    const result = await caller.cases.heliosCopilotChat({
      tenantId: "balt-1",
      caseId: "CASE-BALT-1-DEMO001",
      prompt: "¿Qué riesgo principal ves y qué documento conviene subir después?",
      responseTone: "explained",
    });

    expect(db.getCaseDetailForUser).toHaveBeenCalledWith({
      userId: 7,
      tenantId: "balt-1",
      caseId: "CASE-BALT-1-DEMO001",
    });
    expect(db.listVisibleDocuments).toHaveBeenCalledWith({
      userId: 7,
      tenantId: "balt-1",
      caseId: "CASE-BALT-1-DEMO001",
    });
    expect(invokeLLM).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      disclaimer: WORKER_CHAT_DISCLAIMER,
      confidenceScore: 74,
      sourceDocumentCount: 1,
      supportingDocuments: expect.arrayContaining([
        expect.objectContaining({
          id: "DOC-HEL-001",
          label: "contrato_demo.pdf",
        }),
        expect.objectContaining({
          id: "missing-documents-hint",
          label: "Documento que puede destrabar mejor tu caso",
        }),
      ]),
    });
    expect(result.answer).toContain("Respuesta clara");
    expect(result.answer).toContain("Lo que sí se sabe");
    expect(result.answer).toContain("Lo que falta");
    expect(result.answer).toContain("Siguiente paso");
    expect(result.answer).toMatch(/resultado de TU consulta|Consultar IMSS y SAT/i);
    expect(result.answer).toMatch(/no es asesoría legal/i);
    expect(result.answer).not.toMatch(/Helios|tesis|validamos ante el IMSS/i);
    expect(result.officialTitles).toEqual([]);
    expect(result.suggestedPrompts.join(" ")).not.toMatch(/Helios|CompliLink/i);
    expect(result.supportingDocuments[0]?.detail).toMatch(/Lectura visible: esta lectura generó una lectura preliminar útil del contrato/);
    expect(result.supportingDocuments[1]?.detail).toContain("Soporte IMSS");
    expect(db.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "balt-1",
        caseId: "CASE-BALT-1-DEMO001",
        action: "case.helios_copilot_chat",
        afterState: expect.objectContaining({
          responseTone: "explained",
          conversationHistory: [],
          missingDocuments: expect.arrayContaining([
            expect.objectContaining({
              label: "Soporte IMSS",
            }),
          ]),
          supportingDocuments: expect.arrayContaining([
            expect.objectContaining({
              id: "DOC-HEL-001",
            }),
            expect.objectContaining({
              id: "missing-documents-hint",
            }),
          ]),
        }),
      }),
    );
  });

  it("keeps freemium single-document asesor chat working when the expediente has more papers", async () => {
    vi.mocked(db.listVisibleDocuments).mockResolvedValue([
      {
        documentId: "DOC-PAY-001",
        originalName: "recibo_mayo.pdf",
        documentType: "payroll_receipt",
        classificationConfidence: 91,
        consentStatus: "granted",
        visibility: "case_team",
        createdAt: new Date("2026-05-16T10:00:00.000Z"),
        heliosOpinion: {
          documentId: "DOC-PAY-001",
          caseId: "CASE-BALT-1-DEMO001",
          status: "completed",
          mode: "mock",
          summary: "El recibo muestra periodo, neto y un descuento de IMSS.",
          legalOpinion: "Hay señales de descuento IMSS en el papel, no un alta oficial.",
          riskLevel: "medium",
          recommendedNextStep: "Compara el descuento con tu siguiente recibo.",
          recommendedActions: ["Subir CFDI del mismo periodo"],
          legalFoundations: [],
          keyFactsUsed: ["Periodo 1 al 15 de mayo", "NSS 12345678901"],
          uncertainties: ["No se ve una constancia oficial de semanas cotizadas."],
          confidenceScore: 82,
          disclaimer: "Opinión preliminar asistida por sistema.",
          generatedAt: "2026-05-16T10:00:00.000Z",
          rawPayload: {},
        },
      },
      {
        documentId: "DOC-CFDI-001",
        originalName: "cfdi_mayo.pdf",
        documentType: "cfdi",
        classificationConfidence: 86,
        consentStatus: "granted",
        visibility: "case_team",
        createdAt: new Date("2026-05-02T10:00:00.000Z"),
        heliosOpinion: {
          documentId: "DOC-CFDI-001",
          caseId: "CASE-BALT-1-DEMO001",
          status: "completed",
          mode: "mock",
          summary: "El CFDI muestra el mismo periodo.",
          legalOpinion: "Sirve para comparar lo timbrado con el recibo.",
          riskLevel: "low",
          recommendedNextStep: "Contrasta montos con el recibo.",
          recommendedActions: [],
          legalFoundations: [],
          keyFactsUsed: ["Periodo visible"],
          uncertainties: [],
          confidenceScore: 70,
          disclaimer: "Opinión preliminar asistida por sistema.",
          generatedAt: "2026-05-02T10:00:00.000Z",
          rawPayload: {},
        },
      },
    ] as never);

    vi.mocked(invokeLLM).mockResolvedValue({
      choices: [
        {
          message: {
            content:
              "Respuesta clara: En tu recibo se ve un descuento de IMSS.\nLo que sí se sabe: Hay NSS y periodo visibles.\nLo que falta: No hay constancia oficial de semanas.\nSiguiente paso: Compara con tu siguiente recibo.",
          },
        },
      ],
    } as never);

    const caller = appRouter.createCaller(createProtectedContext({ role: "user" }));
    const result = await caller.cases.heliosCopilotChat({
      tenantId: "balt-1",
      caseId: "CASE-BALT-1-DEMO001",
      prompt: "¿Qué dice mi recibo?",
    });

    expect(invokeLLM).not.toHaveBeenCalled();
    expect(result.sourceDocumentCount).toBe(1);
    expect(result.answer).toContain("Respuesta clara");
    expect(result.answer).toContain("Lo que sí se sabe");
    expect(result.answer).toContain("Lo que falta");
    expect(result.answer).toContain("Siguiente paso");
    expect(result.answer).toContain(
      "La lectura de varios documentos juntos está en el plan Esencial. Con tu plan gratis puedes preguntar sobre este documento.",
    );
    expect(result.answer).not.toMatch(/required_plan|current_plan|\|\|/);
    expect(result.answer).not.toMatch(/Helios|consulta en vivo/i);
    expect(result.supportingDocuments.some((item) => item.id === "DOC-PAY-001")).toBe(true);
    expect(result.supportingDocuments.some((item) => item.id === "DOC-CFDI-001")).toBe(false);
  });

  it("cites real official digest titles for a legal question and keeps freemium copy clean", async () => {
    vi.mocked(db.listVisibleDocuments).mockResolvedValue([
      {
        documentId: "DOC-PAY-001",
        originalName: "recibo_mayo.pdf",
        documentType: "payroll_receipt",
        classificationConfidence: 91,
        consentStatus: "granted",
        visibility: "case_team",
        createdAt: new Date("2026-05-16T10:00:00.000Z"),
        heliosOpinion: {
          documentId: "DOC-PAY-001",
          caseId: "CASE-BALT-1-DEMO001",
          status: "completed",
          mode: "mock",
          summary: "El recibo muestra periodo y un descuento de IMSS.",
          legalOpinion: "Hay señales de descuento IMSS en el papel.",
          riskLevel: "medium",
          recommendedNextStep: "Compara el descuento con tu siguiente recibo.",
          recommendedActions: [],
          legalFoundations: [],
          keyFactsUsed: ["Periodo 1 al 15 de mayo"],
          uncertainties: [],
          confidenceScore: 80,
          disclaimer: "Opinión preliminar asistida por sistema.",
          generatedAt: "2026-05-16T10:00:00.000Z",
          rawPayload: {},
        },
      },
    ] as never);

    vi.mocked(invokeLLM).mockResolvedValue({
      choices: [
        {
          message: {
            content:
              "Respuesta clara: En tu recibo no se ven horas extra y aún no hay resultado de IMSS o SAT.\nLo que sí se sabe: El recibo no trae horas extra.\nLo que falta: Aún no hay resultado de IMSS o SAT.\nSiguiente paso: Pregunta por los montos del recibo o consulta IMSS y SAT.",
          },
        },
      ],
    } as never);

    const caller = appRouter.createCaller(createProtectedContext({ role: "user" }));
    const result = await caller.cases.heliosCopilotChat({
      tenantId: "balt-1",
      caseId: "CASE-BALT-1-DEMO001",
      prompt: "¿Qué dice la ley sobre horas extra?",
    });

    expect(result.officialTitles).toEqual([]);
    expect(result.answer).not.toMatch(/Lecturas oficiales|TIEMPO EXTRAORDINARIO|jurisprudencia/i);
    expect(result.answer).toMatch(/a[uú]n no hay resultado|recibo|IMSS|SAT/i);
    expect(result.answer).not.toMatch(/required_plan|current_plan|\|\||Helios|CompliLink/i);
  });

  it("con resultado vivo el chat manda al modelo solo chatAnchor, reciboVsOficial y el recibo", async () => {
    vi.mocked(db.getCaseDetailForUser).mockResolvedValue({
      ...demoCaseDetail,
      events: [
        {
          title: "Consulta IMSS y SAT",
          eventAt: new Date("2026-09-21T15:30:00.000Z"),
          metadata: JSON.stringify({
            live_check: {
              configured: true,
              consentGranted: true,
              overallStatus: "vivo",
              overallLabel: "Vivo",
              overallDetail: "Esto respondió el instituto hoy. No significa que tu patrón cumple.",
              checkedAt: "2026-09-21T15:30:00.000Z",
              identity: { nss: true, curp: false, rfc: true },
              checks: [],
              chatAnchor: {
                imss: {
                  fuente: "imss",
                  estado: "live",
                  fecha: "2026-09-21T15:30:00.000Z",
                  hechos: ["Alta vigente: sí."],
                  motivoFallo: null,
                },
                sat: {
                  fuente: "sat",
                  estado: "pending",
                  fecha: "2026-09-21T15:30:00.000Z",
                  hechos: ["Todavía no hay una respuesta oficial nueva de SAT."],
                  motivoFallo: null,
                },
                infonavit: {
                  fuente: "infonavit",
                  estado: "failed",
                  fecha: "2026-09-21T15:30:00.000Z",
                  hechos: ["Infonavit está en mantenimiento."],
                  motivoFallo: "Infonavit está en mantenimiento.",
                },
              },
              reciboVsOficial: { resultado: "hay_diferencia", motivo: "SBC distinto" },
            },
          }),
        },
      ],
    } as never);
    vi.mocked(db.listVisibleDocuments).mockResolvedValue([
      {
        documentId: "DOC-PAY-001",
        originalName: "recibo_mayo.pdf",
        documentType: "payroll_receipt",
        classificationConfidence: 91,
        consentStatus: "granted",
        visibility: "case_team",
        createdAt: new Date("2026-05-16T10:00:00.000Z"),
        heliosOpinion: {
          documentId: "DOC-PAY-001",
          caseId: "CASE-BALT-1-DEMO001",
          status: "completed",
          mode: "mock",
          summary: "El recibo muestra periodo y un descuento de IMSS.",
          legalOpinion: "Hay señales de descuento IMSS en el papel.",
          riskLevel: "medium",
          recommendedNextStep: "Compara el descuento con tu siguiente recibo.",
          recommendedActions: [],
          legalFoundations: [],
          keyFactsUsed: ["Periodo 1 al 15 de mayo", "NSS 12345678901"],
          uncertainties: [],
          confidenceScore: 80,
          disclaimer: "Opinión preliminar asistida por sistema.",
          generatedAt: "2026-05-16T10:00:00.000Z",
          rawPayload: {
            preliminaryAnalysis: {
              confirmedData: {
                payrollPeriod: "2026-05-01 al 2026-05-15",
                payrollNss: "12345678901",
                imssWithheld: "$120.50",
              },
            },
          },
        },
      },
    ] as never);
    vi.mocked(invokeLLM).mockResolvedValue({
      choices: [
        {
          message: {
            content:
              "Respuesta clara: Esto vimos: hay diferencia.\nLo que sí se sabe: IMSS respondió hoy.\nLo que falta: SAT sigue pendiente.\nSiguiente paso: Anota periodo y montos y pide aclaración por escrito a patrón o RH.",
          },
        },
      ],
    } as never);

    const caller = appRouter.createCaller(createProtectedContext({ role: "user" }));
    const result = await caller.cases.heliosCopilotChat({
      tenantId: "balt-1",
      caseId: "CASE-BALT-1-DEMO001",
      prompt: "¿Me pagan bien?",
    });

    expect(invokeLLM).toHaveBeenCalledTimes(1);
    const payload = JSON.stringify(vi.mocked(invokeLLM).mock.calls[0]?.[0]);
    expect(payload).toContain("chatAnchor");
    expect(payload).toContain("reciboVsOficial");
    expect(payload).toContain("Alta vigente: sí.");
    expect(payload).toMatch(/Esto vimos: hay diferencia/);
    expect(payload).not.toMatch(/no consultamos en vivo/i);
    expect(payload).not.toMatch(/Contexto del expediente/);
    expect(payload).not.toMatch(/HMAC|APIMARKET/i);
    expect(payload).toMatch(/NUNCA escribas Helios/);
    expect(result.answer).toMatch(/Esto vimos: hay diferencia|hay diferencia/i);
    expect(result.disclaimer).toBe(WORKER_CHAT_DISCLAIMER);
    expect(result.disclaimer).not.toMatch(/no consultamos en vivo/i);
  });

  it("revalidates IMSS and Infonavit with a Helios audit contract and traceable evidence", async () => {
    vi.mocked(db.listVisibleDocuments).mockResolvedValue([
      {
        documentId: "DOC-IMSS-001",
        originalName: "alta_imss.pdf",
        documentType: "imss",
        classificationConfidence: 91,
        consentStatus: "granted",
        visibility: "case_team",
        createdAt: new Date("2026-04-05T10:00:00.000Z"),
        heliosOpinion: {
          documentId: "DOC-IMSS-001",
          caseId: "CASE-BALT-1-DEMO001",
          status: "completed",
          mode: "mock",
          summary: "Constancia IMSS con semanas cotizadas visibles.",
          legalOpinion: "La constancia ayuda a validar continuidad y salario registrado.",
          riskLevel: "low",
          recommendedNextStep: "Contrastar con soportes de Infonavit.",
          recommendedActions: ["Subir soporte Infonavit"],
          legalFoundations: [],
          keyFactsUsed: ["Alta IMSS"],
          uncertainties: [],
          confidenceScore: 86,
          disclaimer: "Opinión preliminar asistida por sistema.",
          generatedAt: "2026-04-05T10:00:00.000Z",
          rawPayload: {},
        },
      },
      {
        documentId: "DOC-INF-001",
        originalName: "estado_infonavit.pdf",
        documentType: "bank_statement",
        classificationConfidence: 84,
        consentStatus: "granted",
        visibility: "case_team",
        createdAt: new Date("2026-04-05T11:00:00.000Z"),
        heliosOpinion: {
          documentId: "DOC-INF-001",
          caseId: "CASE-BALT-1-DEMO001",
          status: "completed",
          mode: "mock",
          summary: "Estado con referencias útiles de Infonavit.",
          legalOpinion: "Hay señales suficientes para contrastar vivienda y seguridad social.",
          riskLevel: "medium",
          recommendedNextStep: "Mantener la revalidación al subir nuevos soportes.",
          recommendedActions: ["Subir recibo reciente"],
          legalFoundations: [],
          keyFactsUsed: ["Referencia Infonavit"],
          uncertainties: [],
          confidenceScore: 79,
          disclaimer: "Opinión preliminar asistida por sistema.",
          generatedAt: "2026-04-05T11:00:00.000Z",
          rawPayload: {},
        },
      },
    ] as never);

    const caller = appRouter.createCaller(createProtectedContext());
    const result = await caller.cases.revalidateSocialSecurity({
      tenantId: "balt-1",
      caseId: "CASE-BALT-1-DEMO001",
    });

    expect(result).toMatchObject({
      statusLabel: "Cruce visible listo",
      actionLabel: "Revisar señales visibles de IMSS e Infonavit",
      liveImssValidation: false,
      hasImssSignal: true,
      hasInfonavitSignal: true,
      imssDocumentsCount: 1,
      infonavitSignalsCount: 1,
      documentsWithOpinion: 2,
      lastRevalidationSummary:
        "Ya hay señales visibles de IMSS e Infonavit en tus documentos. Esta revisión no consulta IMSS ni Infonavit en vivo; solo lee lo que ya aparece en el expediente.",
    });
    expect(result.coverageScore).toBeGreaterThan(60);
    expect(result.lastRevalidatedAt).toMatch(/^2026-/);

    expect(db.upsertCanonicalContract).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "balt-1",
        caseId: "CASE-BALT-1-DEMO001",
        contractType: "audit",
        schemaVersion: "helios_social_security_v1",
        status: "ready",
      }),
    );

    const revalidationContract = JSON.parse(String(vi.mocked(db.upsertCanonicalContract).mock.calls[0]?.[0]?.payload));
    expect(revalidationContract).toMatchObject({
      engine: "helios",
      scope: "social_security",
      status: "document_signals",
      liveImssValidation: false,
      statusLabel: "Cruce visible listo",
      signals: {
        imssDocumentsCount: 1,
        infonavitSignalsCount: 1,
        documentsWithOpinion: 2,
      },
    });

    expect(db.addCaseEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "note_added",
        title: "Revalidación IMSS/Infonavit actualizada",
      }),
    );
    expect(db.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "case.revalidate_social_security",
        entityType: "case",
        entityId: "CASE-BALT-1-DEMO001",
      }),
    );
  });

  it("reuses the personal case for a new account instead of opening a second expediente", async () => {
    vi.mocked(db.getPrimaryCaseIdForUser).mockResolvedValue("CASE-BALT-1-DEMO001");
    vi.mocked(db.isCeoBypassUser).mockResolvedValue(false);

    const caller = appRouter.createCaller(
      createProtectedContext({
        id: 24,
        openId: "email:tester-24",
        role: "user",
        name: "Tester Inf 24",
      }),
    );

    const result = await caller.cases.create({
      tenantId: "balt-1",
      title: "Revisión inicial · recibo",
      status: "intake",
      priority: "medium",
    });

    expect(db.getPrimaryCaseIdForUser).toHaveBeenCalledWith(24, "balt-1");
    expect(db.createCaseRecord).not.toHaveBeenCalled();
    expect(db.getCaseDetailForUser).toHaveBeenCalledWith({
      userId: 24,
      tenantId: "balt-1",
      caseId: "CASE-BALT-1-DEMO001",
    });
    expect(result.caseId).toBe("CASE-BALT-1-DEMO001");
  });

  it("gives a new account chat access on its personal case after first upload", async () => {
    vi.mocked(db.ensurePersonalWorkspaceForUser).mockResolvedValue({
      tenant: { tenantId: "ap-inf24-09191226-1249" },
      tenantId: "ap-inf24-09191226-1249",
      caseId: "CASE-AP-INF-PERSONAL",
    } as never);
    vi.mocked(db.isCeoBypassUser).mockResolvedValue(false);
    vi.mocked(db.getCaseDetailForUser).mockResolvedValue({
      ...demoCaseDetail,
      case: {
        ...demoCaseDetail.case,
        tenantId: "ap-inf24-09191226-1249",
        caseId: "CASE-AP-INF-PERSONAL",
      },
    } as never);
    vi.mocked(db.listVisibleDocuments).mockResolvedValue([
      {
        documentId: "DOC-PAY-024",
        originalName: "recibo.pdf",
        documentType: "payroll_receipt",
        classificationConfidence: 90,
        consentStatus: "granted",
        visibility: "case_team",
        createdAt: new Date("2026-09-19T12:00:00.000Z"),
        heliosOpinion: {
          documentId: "DOC-PAY-024",
          caseId: "CASE-AP-INF-PERSONAL",
          status: "completed",
          mode: "mock",
          summary: "El recibo muestra IMSS, ISR e Infonavit.",
          legalOpinion: "Hay descuentos visibles, no un alta oficial.",
          riskLevel: "medium",
          recommendedNextStep: "Cruza IMSS, ISR e Infonavit con tus papeles.",
          recommendedActions: [],
          legalFoundations: [],
          keyFactsUsed: ["IMSS $120.50", "ISR $310.00", "Infonavit $80.00"],
          uncertainties: [],
          confidenceScore: 80,
          disclaimer: "Opinión preliminar asistida por sistema.",
          generatedAt: "2026-09-19T12:00:00.000Z",
          rawPayload: {},
        },
      },
    ] as never);

    const caller = appRouter.createCaller(
      createProtectedContext({
        id: 24,
        openId: "email:tester-24",
        role: "user",
        name: "Tester Inf 24",
      }),
    );

    const result = await caller.cases.heliosCopilotChat({
      tenantId: "tenant-equivocado",
      caseId: "CASE-AJENO",
      prompt: "¿Me descontaron IMSS, impuestos o Infonavit?",
    });

    expect(db.ensurePersonalWorkspaceForUser).toHaveBeenCalledWith({
      userId: 24,
      userName: "Tester Inf 24",
      userEmail: "owner@complilink.mx",
    });
    expect(db.getCaseDetailForUser).toHaveBeenCalledWith({
      userId: 24,
      tenantId: "ap-inf24-09191226-1249",
      caseId: "CASE-AP-INF-PERSONAL",
    });
    expect(result.answer).toContain("Respuesta clara");
    expect(result.answer).not.toMatch(/No tienes acceso a este espacio/i);
    expect(result.answer).not.toMatch(/labor_cases|SQL|ER_NO_SUCH_TABLE/i);
  });

  it("acepta historial grande con rubros oficiales y responde IMSS en 4 secciones sin too_big ni portal en vivo", async () => {
    vi.mocked(db.listVisibleDocuments).mockResolvedValue([
      {
        documentId: "DOC-PAY-001",
        originalName: "recibo_mayo.pdf",
        documentType: "payroll_receipt",
        classificationConfidence: 91,
        consentStatus: "granted",
        visibility: "case_team",
        createdAt: new Date("2026-05-16T10:00:00.000Z"),
        heliosOpinion: {
          documentId: "DOC-PAY-001",
          caseId: "CASE-BALT-1-DEMO001",
          status: "completed",
          mode: "mock",
          summary: "El recibo muestra periodo, neto y un descuento de IMSS.",
          legalOpinion: "Hay señales de descuento IMSS en el papel, no un alta oficial.",
          riskLevel: "medium",
          recommendedNextStep: "Compara el descuento con tu siguiente recibo.",
          recommendedActions: ["Subir CFDI del mismo periodo"],
          legalFoundations: [],
          keyFactsUsed: ["Periodo 1 al 15 de mayo", "NSS 12345678901"],
          uncertainties: ["No se ve una constancia oficial de semanas cotizadas."],
          confidenceScore: 82,
          disclaimer: "Opinión preliminar asistida por sistema.",
          generatedAt: "2026-05-16T10:00:00.000Z",
          rawPayload: {
            preliminaryAnalysis: {
              confirmedData: {
                payrollPeriod: "2026-05-01 al 2026-05-15",
                payrollNss: "12345678901",
                imssWithheld: "$120.50",
              },
            },
          },
        },
      },
    ] as never);

    vi.mocked(invokeLLM).mockResolvedValue({
      choices: [
        {
          message: {
            content:
              "Respuesta clara: En tu recibo se ve un descuento de IMSS de $120.50.\nLo que sí se sabe: Hay NSS 12345678901 y periodo visibles.\nLo que falta: No hay constancia oficial de semanas.\nSiguiente paso: Cruza el descuento con tu siguiente recibo o un papel IMSS; eso no confirma el alta oficial.",
          },
        },
      ],
    } as never);

    const bloatedAssistant = [
      formatWorkerChatAnswer({
        answer: "Sobre horas extra solo puedo citar lecturas oficiales del digest.",
        known: "El recibo no trae horas extra.",
        missing: "Falta un papel que muestre las horas.",
        nextStep: "Compara con tu siguiente recibo.",
        officialSources: listLastGoodOfficialCitations(),
        officialSourcesNote:
          "Estas lecturas oficiales las tengo de una consulta anterior. Ahora no pude abrir la Corte o el Diario Oficial.",
      }),
      ...listLastGoodOfficialCitations().map((item) => item.title),
    ].join("\n\n");

    expect(bloatedAssistant.length).toBeGreaterThan(2000);

    const conversationHistory = [
      { role: "user" as const, content: "¿Qué dice la ley sobre horas extra?" },
      { role: "assistant" as const, content: bloatedAssistant },
      { role: "user" as const, content: "¿Y el Diario Oficial?" },
      { role: "assistant" as const, content: bloatedAssistant },
      { role: "user" as const, content: "¿Hay jurisprudencia de la Corte?" },
      { role: "assistant" as const, content: bloatedAssistant },
      { role: "user" as const, content: "¿Me sirve la doctrina?" },
      { role: "assistant" as const, content: bloatedAssistant },
      { role: "user" as const, content: "¿Me descontaron IMSS?" },
    ];

    const caller = appRouter.createCaller(createProtectedContext({ role: "user" }));
    const result = await caller.cases.heliosCopilotChat({
      tenantId: "balt-1",
      caseId: "CASE-BALT-1-DEMO001",
      prompt: "¿Me descontaron IMSS?",
      conversationHistory,
    });

    expect(result.answer).toContain("Respuesta clara");
    expect(result.answer).toContain("Lo que sí se sabe");
    expect(result.answer).toContain("Lo que falta");
    expect(result.answer).toContain("Siguiente paso");
    expect(result.answer).toMatch(/resultado de TU consulta|Consultar IMSS y SAT|recibo/i);
    expect(result.answer).not.toMatch(/too_big|ZodError|conversationHistory/i);
    expect(result.answer).not.toMatch(/consulta en vivo|portal oficial|validamos ante el IMSS/i);
    expect(result.answer).toContain(WORKER_CHAT_DISCLAIMER);
    expect(result.answer).not.toMatch(/Lecturas oficiales|Subcontrataci[oó]n|Diario Oficial/i);
    expect(result.officialTitles).toEqual([]);
    expect(result.officialSourcesNote).toBeNull();
    expect(invokeLLM).not.toHaveBeenCalled();
  });

  it("injects durable per-case memory, isolates case A from case B, and reloads the prior memory", async () => {
    const memoryStore = new Map<string, ReturnType<typeof buildFallbackAdvisorMemory>>();
    const scopeKey = (tenantId: string, caseId: string, userId: number) =>
      `${tenantId}::${caseId}::${userId}`;

    vi.mocked(db.isCeoBypassUser).mockResolvedValue(true);
    vi.mocked(db.getAdvisorMemoryForUser).mockImplementation(async ({ tenantId, caseId, userId }) => {
      return memoryStore.get(scopeKey(tenantId, caseId, userId)) ?? null;
    });
    vi.mocked(db.upsertAdvisorMemory).mockImplementation(async ({ tenantId, caseId, userId, memory }) => {
      const persisted = { ...memory, tenantId, caseId, userId };
      memoryStore.set(scopeKey(tenantId, caseId, userId), persisted);
      return persisted;
    });

    const documentFor = (documentId: string, name: string) =>
      ({
        documentId,
        originalName: name,
        documentType: "contract",
        classificationConfidence: 88,
        consentStatus: "granted",
        visibility: "case_team",
        createdAt: new Date("2026-04-05T10:00:00.000Z"),
        heliosOpinion: {
          documentId,
          status: "completed",
          mode: "mock",
          summary: `Lectura de ${name}`,
          recommendedNextStep: "Subir el recibo del mismo periodo.",
          riskLevel: "medium",
          confidenceScore: 74,
        },
      }) as never;

    vi.mocked(db.getCaseDetailForUser).mockImplementation(async ({ tenantId, caseId }) => {
      const isCaseA = caseId === "CASE-A";
      return {
        ...demoCaseDetail,
        case: {
          ...demoCaseDetail.case,
          tenantId,
          caseId,
          employeeName: isCaseA ? "María López" : "Juan Pérez",
          employerEntity: isCaseA ? "Empresa Norte" : "Taller Sur",
          title: isCaseA ? "Caso María" : "Caso Juan",
        },
      } as never;
    });
    vi.mocked(db.listVisibleDocuments).mockImplementation(async ({ caseId }) => {
      return [
        documentFor(
          caseId === "CASE-A" ? "DOC-A" : "DOC-B",
          caseId === "CASE-A" ? "contrato_maria.pdf" : "recibo_juan.pdf",
        ),
      ];
    });

    const caller = appRouter.createCaller(createProtectedContext());
    const firstA = await caller.cases.heliosCopilotChat({
      tenantId: "tenant-a",
      caseId: "CASE-A",
      prompt: "¿Qué riesgo ves en mi contrato con Empresa Norte?",
    });

    expect(invokeLLM).not.toHaveBeenCalled();
    expect(firstA.advisorMemory?.greeting).toMatch(/María|Empresa Norte/i);
    expect(db.upsertAdvisorMemory).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant-a",
        caseId: "CASE-A",
        userId: 7,
      }),
    );

    vi.mocked(invokeLLM).mockClear();
    const firstB = await caller.cases.heliosCopilotChat({
      tenantId: "tenant-b",
      caseId: "CASE-B",
      prompt: "¿Qué dice mi recibo de Taller Sur?",
    });

    expect(invokeLLM).not.toHaveBeenCalled();
    expect(firstB.advisorMemory?.greeting).toMatch(/Juan|Taller Sur/i);
    expect(firstB.advisorMemory?.greeting).not.toMatch(/María|Empresa Norte/i);

    const reloadedA = await caller.cases.detail({
      tenantId: "tenant-a",
      caseId: "CASE-A",
    });
    const reloadedB = await caller.cases.detail({
      tenantId: "tenant-b",
      caseId: "CASE-B",
    });

    expect(reloadedA.advisorMemory?.recentTurns?.some((turn) => turn.content.includes("Empresa Norte"))).toBe(
      true,
    );
    expect(JSON.stringify(reloadedA.advisorMemory)).not.toMatch(/Taller Sur|recibo_juan|CASE-B/i);
    expect(reloadedB.advisorMemory?.recentTurns?.some((turn) => turn.content.includes("Taller Sur"))).toBe(
      true,
    );
    expect(JSON.stringify(reloadedB.advisorMemory)).not.toMatch(/Empresa Norte|contrato_maria|CASE-A/i);
    expect(db.getAdvisorMemoryForUser).toHaveBeenCalledWith({
      userId: 7,
      tenantId: "tenant-a",
      caseId: "CASE-A",
    });
    expect(db.getAdvisorMemoryForUser).toHaveBeenCalledWith({
      userId: 7,
      tenantId: "tenant-b",
      caseId: "CASE-B",
    });
  });

  it("creates a case with canonical contracts, access grants and audit trail", async () => {
    const caller = appRouter.createCaller(createProtectedContext());

    const result = await caller.cases.create({
      tenantId: "balt-1",
      title: "Despido injustificado con prestaciones pendientes",
      employeeName: "María López",
      employerEntity: "Empresa Demo MX",
      summary: "Se requiere integrar expediente inicial y estrategia de conciliación.",
      status: "intake",
      priority: "high",
      dueAt: "2026-04-30T18:00:00.000Z",
    });

    expect(db.assertTenantAdminAccess).toHaveBeenCalledWith(7, "balt-1");
    expect(db.buildCaseId).toHaveBeenCalledWith("balt-1");
    expect(db.buildTraceId).toHaveBeenCalledWith("balt-1", "CASE-BALT-0001");
    expect(result.caseId).toBe("CASE-BALT-0001");
    expect(db.createCaseRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "balt-1",
        caseId: "CASE-BALT-0001",
        traceId: "trace.balt-1.CASE-BALT-0001",
        status: "intake",
        priority: "high",
      }),
    );

    const createCasePayload = vi.mocked(db.createCaseRecord).mock.calls[0]?.[0]
      ?.canonicalPayload as string;
    expect(createCasePayload).toContain('"tenant_id":"balt-1"');
    expect(createCasePayload).toContain('"case_id":"CASE-BALT-0001"');
    expect(createCasePayload).toContain('"trace_id":"trace.balt-1.CASE-BALT-0001"');

    expect(db.grantCaseAccess).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "balt-1",
        caseId: "CASE-BALT-0001",
        accessLevel: "owner",
        status: "active",
      }),
    );

    const upsertedContractTypes = vi
      .mocked(db.upsertCanonicalContract)
      .mock.calls.map((call) => call[0]?.contractType);
    expect(upsertedContractTypes).toEqual(["case", "shared_engine"]);
    expect(db.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "balt-1",
        caseId: "CASE-BALT-0001",
        action: "case.create",
      }),
    );
  });

  it("updates case workflow and leaves event plus audit evidence", async () => {
    const caller = appRouter.createCaller(createProtectedContext());

    const result = await caller.cases.updateStatus({
      tenantId: "balt-1",
      caseId: "CASE-BALT-1-DEMO001",
      status: "litigation",
      priority: "critical",
      dueAt: "2026-05-10T12:00:00.000Z",
    });

    expect(db.assertCaseWriteAccess).toHaveBeenCalledWith(7, "balt-1", "CASE-BALT-1-DEMO001");
    expect(db.updateCaseStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "balt-1",
        caseId: "CASE-BALT-1-DEMO001",
        status: "litigation",
        priority: "critical",
      }),
    );
    expect(result.status).toBe("litigation");
    expect(result.priority).toBe("critical");
    expect(db.addCaseEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "status_changed",
        title: "Estatus actualizado",
      }),
    );
    expect(db.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "case.update_status",
        entityType: "case",
        entityId: "CASE-BALT-1-DEMO001",
      }),
    );
  });

  it("uploads a document with SHA-256, classification, alerting and canonical contracts", async () => {
    const caller = appRouter.createCaller(createProtectedContext());

    const result = await caller.cases.uploadDocument({
      tenantId: "balt-1",
      caseId: "CASE-BALT-1-DEMO001",
      fileName: "recibo_nomina_abril.pdf",
      mimeType: "application/pdf",
      base64Content: "data:application/pdf;base64,JVBERi0xLjQKJSVFT0YK",
      visibility: "tenant_legal",
      consentStatus: "pending",
      sourceChannel: "manual",
    });

    expect(storagePut).toHaveBeenCalledTimes(1);
    expect(db.addDocumentRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "balt-1",
        caseId: "CASE-BALT-1-DEMO001",
        visibility: "tenant_legal",
        consentStatus: "pending",
        integrityStatus: "verified",
      }),
    );
    expect(result.classification.documentType).toBe("payroll_receipt");
    expect(result.document.sha256).toHaveLength(64);
    expect(result.document.storageUrl).toBe("https://cdn.example.com/demo-key.pdf");
    expect(db.addOperationalAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        category: "missing_consent",
        status: "open",
      }),
    );

    expect(db.upsertCanonicalContracts).toHaveBeenCalledTimes(1);
    const uploadContracts = vi.mocked(db.upsertCanonicalContracts).mock.calls[0]?.[0] ?? [];
    expect(uploadContracts.map((contract) => contract?.contractType)).toEqual([
      "document",
      "classification",
      "shared_engine",
      "audit",
    ]);
    expect(uploadContracts[3]).toMatchObject({
      contractType: "audit",
      schemaVersion: "helios_v1",
      status: "ready",
    });
    expect(result.heliosOpinion).toMatchObject({
      mode: expectedHeliosMode,
      status: expectedHeliosStatus,
    });
    expect(result.heliosOpinionContract).toMatchObject({
      engine: "helios",
      mode: expectedHeliosMode,
      status: expectedHeliosStatus,
    });

    expect(db.createAuditLogs).toHaveBeenCalledTimes(1);
    const auditActions = vi.mocked(db.createAuditLogs).mock.calls[0]?.[0]?.map((entry) => entry?.action) ?? [];
    expect(auditActions).toEqual(
      expect.arrayContaining(["document.upload", "document.engine_dispatch", "document.helios_opinion"]),
    );
  });

  it("rejects upload when a normal user submits a document that appears to belong to another person", async () => {
    vi.mocked(db.documentSeemsToBelongToAnotherPerson).mockReturnValueOnce(true);

    const caller = appRouter.createCaller(
      createProtectedContext({
        id: 81,
        openId: "worker-single-case",
        email: "worker-single-case@complilink.mx",
        role: "user",
      }),
    );

    await expect(
      caller.cases.uploadDocument({
        tenantId: "balt-1",
        caseId: "CASE-BALT-1-DEMO001",
        fileName: "recibo_otra_persona.pdf",
        mimeType: "application/pdf",
        base64Content: "data:application/pdf;base64,JVBERi0xLjQKJSVFT0YK",
        textHint: "Trabajador: Juan Pérez\nEmpresa: Empresa Alterna SA de CV",
        visibility: "tenant_legal",
        consentStatus: "pending",
        sourceChannel: "manual",
      }),
    ).rejects.toThrow(/expediente digital está vinculado a una sola persona[\s\S]*parece pertenecer a alguien distinto[\s\S]*cuenta correcta/i);

    expect(db.addDocumentRecord).not.toHaveBeenCalled();
  });

  it("acepta el XML del mismo recibo aunque el nombre parezca de otra persona", async () => {
    vi.mocked(db.documentSeemsToBelongToAnotherPerson).mockReturnValue(true);
    vi.mocked(db.listCanonicalContractsByType).mockResolvedValueOnce([
      {
        payload: JSON.stringify({
          confirmedData: {
            payrollNss: "84129214965",
            payrollCurp: "UIPD921125HYNCLD03",
            workerRfc: "UIPD9211257I0",
          },
        }),
        status: "ready",
      },
    ] as never);

    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:nomina12="http://www.sat.gob.mx/nomina12" Total="4725.60">',
      '<cfdi:Emisor Rfc="ECC190605VA1" Nombre="EVOLUCION CREATIVA CAMREFLEX S.A. DE C.V." />',
      '<cfdi:Receptor Rfc="UIPD9211257I0" Nombre="ULISES IRVIN PEREZ DOMINGUEZ" />',
      "<cfdi:Complemento>",
      '<nomina12:Nomina Version="1.2">',
      '<nomina12:Receptor Curp="UIPD921125HYNCLD03" NumSeguridadSocial="84129214965" />',
      "</nomina12:Nomina>",
      "</cfdi:Complemento>",
      "</cfdi:Comprobante>",
    ].join("");

    const caller = appRouter.createCaller(
      createProtectedContext({
        id: 81,
        openId: "worker-same-receipt-xml",
        email: "worker-same-receipt-xml@complilink.mx",
        role: "user",
      }),
    );

    await expect(
      caller.cases.uploadDocument({
        tenantId: "balt-1",
        caseId: "CASE-BALT-1-DEMO001",
        fileName: "recibo-nomina.xml",
        mimeType: "application/xml",
        base64Content: `data:application/xml;base64,${Buffer.from(xml, "utf8").toString("base64")}`,
        visibility: "tenant_legal",
        consentStatus: "pending",
        sourceChannel: "manual",
      }),
    ).resolves.toBeTruthy();

    expect(db.addDocumentRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "balt-1",
        caseId: "CASE-BALT-1-DEMO001",
        originalName: "recibo-nomina.xml",
      }),
    );
  });

  it("rejects draft analysis when a normal user submits a document that appears to belong to another person", async () => {
    vi.mocked(db.documentSeemsToBelongToAnotherPerson).mockReturnValueOnce(true);

    const caller = appRouter.createCaller(
      createProtectedContext({
        id: 82,
        openId: "worker-single-case-preview",
        email: "worker-single-case-preview@complilink.mx",
        role: "user",
      }),
    );

    await expect(
      caller.cases.analyzeDocumentDraft({
        tenantId: "balt-1",
        caseId: "CASE-BALT-1-DEMO001",
        fileName: "vista_otra_persona.pdf",
        mimeType: "application/pdf",
        base64Content: "data:application/pdf;base64,JVBERi0xLjQKJSVFT0YK",
        textHint: "Trabajador: Juan Pérez\nEmpresa: Empresa Alterna SA de CV",
        sourceChannel: "manual",
      }),
    ).rejects.toThrow(/expediente digital está vinculado a una sola persona[\s\S]*parece pertenecer a alguien distinto[\s\S]*cuenta correcta/i);

    expect(db.upsertCanonicalContract).not.toHaveBeenCalled();
  });

  it("allows the same upload for CEO bypass users so operational testing remains unrestricted", async () => {
    vi.mocked(db.isCeoBypassUser).mockResolvedValueOnce(true);
    vi.mocked(db.documentSeemsToBelongToAnotherPerson).mockReturnValueOnce(true);

    const caller = appRouter.createCaller(createProtectedContext());

    await expect(
      caller.cases.uploadDocument({
        tenantId: "balt-1",
        caseId: "CASE-BALT-1-DEMO001",
        fileName: "prueba_ceo_otra_persona.pdf",
        mimeType: "application/pdf",
        base64Content: "data:application/pdf;base64,JVBERi0xLjQKJSVFT0YK",
        textHint: "Trabajador: Juan Pérez\nEmpresa: Empresa Alterna SA de CV",
        visibility: "tenant_legal",
        consentStatus: "pending",
        sourceChannel: "manual",
      }),
    ).resolves.toBeTruthy();

    expect(db.addDocumentRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "balt-1",
        caseId: "CASE-BALT-1-DEMO001",
      }),
    );
  });

  it("rate limits burst uploads on the Auditar upload endpoint", async () => {
   const caller = appRouter.createCaller(
      createProtectedContext({
        id: 71,
        openId: "auditar-rate-upload",
        email: "rate-upload@complilink.mx",
      }),
    );

    const baseInput = {
      tenantId: "balt-1",
      caseId: "CASE-BALT-1-DEMO001",
      mimeType: "application/pdf",
      base64Content: "data:application/pdf;base64,JVBERi0xLjQKJSVFT0YK",
      visibility: "tenant_legal" as const,
      consentStatus: "pending" as const,
      sourceChannel: "manual" as const,
    };

    for (let attempt = 0; attempt < 4; attempt += 1) {
      await caller.cases.uploadDocument({
        ...baseInput,
        fileName: `burst_upload_${attempt}.pdf`,
      });
    }

    await expect(
      caller.cases.uploadDocument({
        ...baseInput,
        fileName: "burst_upload_blocked.pdf",
      }),
    ).rejects.toThrow(/demasiados intentos seguidos en Auditar/i);

    expect(db.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "balt-1",
        caseId: "CASE-BALT-1-DEMO001",
        action: "document.guardrail_rejected",
        entityType: "system",
        entityId: "document:CASE-BALT-1-DEMO001:burst_upload_blocked.pdf",
        afterState: expect.objectContaining({
          mutation: "uploadDocument",
          reason: "rate_limited",
        }),
      }),
    );
    expect(storagePut).toHaveBeenCalledTimes(4);
    expect(db.getCaseDetailForUser).toHaveBeenCalledTimes(4);
  });

  it("deduplicates immediate repeated uploads of the same Auditar file", async () => {
    const caller = appRouter.createCaller(
      createProtectedContext({
        id: 74,
        openId: "auditar-dedup-upload",
        email: "dedup-upload@complilink.mx",
      }),
    );

    const repeatedInput = {
      tenantId: "balt-1",
      caseId: "CASE-BALT-1-DEMO001",
      fileName: "duplicado_nomina.pdf",
      mimeType: "application/pdf",
      base64Content: "data:application/pdf;base64,JVBERi0xLjQKJSVFT0YK",
      visibility: "tenant_legal" as const,
      consentStatus: "pending" as const,
      sourceChannel: "manual" as const,
    };

    await caller.cases.uploadDocument(repeatedInput);

    await expect(caller.cases.uploadDocument(repeatedInput)).rejects.toThrow(
      /mismo archivo en Auditar/i,
    );

    expect(storagePut).toHaveBeenCalledTimes(1);
    expect(db.addDocumentRecord).toHaveBeenCalledTimes(1);
  });

  it("rate limits burst draft analysis on the Auditar preview endpoint", async () => {
    const caller = appRouter.createCaller(
      createProtectedContext({
        id: 73,
        openId: "auditar-rate-preview",
        email: "rate-preview@complilink.mx",
      }),
    );

    const baseInput = {
      tenantId: "balt-1",
      caseId: "CASE-BALT-1-DEMO001",
      mimeType: "application/pdf",
      base64Content: "data:application/pdf;base64,JVBERi0xLjQKJSVFT0YK",
      sourceChannel: "manual" as const,
    };

    for (let attempt = 0; attempt < 4; attempt += 1) {
      await caller.cases.analyzeDocumentDraft({
        ...baseInput,
        fileName: `preview_burst_${attempt}.pdf`,
      });
    }

    await expect(
      caller.cases.analyzeDocumentDraft({
        ...baseInput,
        fileName: "preview_burst_blocked.pdf",
      }),
    ).rejects.toThrow(/demasiados intentos seguidos en Auditar/i);

    expect(db.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "balt-1",
        caseId: "CASE-BALT-1-DEMO001",
        action: "document.guardrail_rejected",
        entityType: "system",
        entityId: "draft:CASE-BALT-1-DEMO001:preview_burst_blocked.pdf",
        afterState: expect.objectContaining({
          mutation: "analyzeDocumentDraft",
          reason: "rate_limited",
        }),
      }),
    );
    expect(storagePut).toHaveBeenCalledTimes(4);
    expect(db.upsertCanonicalContract).toHaveBeenCalledTimes(4);
  });

  it("deduplicates immediate repeated draft analysis for the same Auditar file", async () => {
    const caller = appRouter.createCaller(
      createProtectedContext({
        id: 75,
        openId: "auditar-dedup-preview",
        email: "dedup-preview@complilink.mx",
      }),
    );

    const repeatedInput = {
      tenantId: "balt-1",
      caseId: "CASE-BALT-1-DEMO001",
      fileName: "vista_previa_repetida.pdf",
      mimeType: "application/pdf",
      base64Content: "data:application/pdf;base64,JVBERi0xLjQKJSVFT0YK",
      sourceChannel: "manual" as const,
    };

    await caller.cases.analyzeDocumentDraft(repeatedInput);

    await expect(caller.cases.analyzeDocumentDraft(repeatedInput)).rejects.toThrow(
      /mismo archivo en Auditar/i,
    );

    expect(db.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "balt-1",
        caseId: "CASE-BALT-1-DEMO001",
        action: "document.guardrail_rejected",
        entityType: "system",
        entityId: "draft:CASE-BALT-1-DEMO001:vista_previa_repetida.pdf",
        afterState: expect.objectContaining({
          mutation: "analyzeDocumentDraft",
          reason: "duplicate_submission",
        }),
      }),
    );
    expect(storagePut).toHaveBeenCalledTimes(1);
    expect(db.upsertCanonicalContract).toHaveBeenCalledTimes(1);
  });

  it("rejects unsupported files in the Auditar preview before storage", async () => {
    const caller = appRouter.createCaller(createProtectedContext());

    await expect(
      caller.cases.analyzeDocumentDraft({
        tenantId: "balt-1",
        caseId: "CASE-BALT-1-DEMO001",
        fileName: "respaldo.zip",
        mimeType: "application/zip",
        base64Content: "data:application/zip;base64,SG9sYQ==",
        sourceChannel: "manual",
      }),
    ).rejects.toThrow(/PDF|JPG|PNG|WEBP/i);

    expect(storagePut).not.toHaveBeenCalled();
    expect(db.addDocumentRecord).not.toHaveBeenCalled();
  });

  it("rejects upload payloads whose real binary signature does not match the declared MIME type", async () => {
    const caller = appRouter.createCaller(createProtectedContext());

    await expect(
      caller.cases.uploadDocument({
        tenantId: "balt-1",
        caseId: "CASE-BALT-1-DEMO001",
        fileName: "nomina_camuflada.pdf",
        mimeType: "application/pdf",
        base64Content: "data:application/pdf;base64,iVBORw0KGgpQTkdEQVRB",
        visibility: "tenant_legal",
        consentStatus: "pending",
        sourceChannel: "manual",
      }),
    ).rejects.toThrow(/contenido real del archivo no coincide con el tipo declarado/i);

    expect(storagePut).not.toHaveBeenCalled();
    expect(db.addDocumentRecord).not.toHaveBeenCalled();
  });

  it("rejects preview payloads whose real binary signature does not match the declared MIME type", async () => {
    const caller = appRouter.createCaller(createProtectedContext());

    await expect(
      caller.cases.analyzeDocumentDraft({
        tenantId: "balt-1",
        caseId: "CASE-BALT-1-DEMO001",
        fileName: "vista_camuflada.pdf",
        mimeType: "application/pdf",
        base64Content: "data:application/pdf;base64,iVBORw0KGgpQTkdEQVRB",
        sourceChannel: "manual",
      }),
    ).rejects.toThrow(/contenido real del archivo no coincide con el tipo declarado/i);

    expect(db.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "balt-1",
        caseId: "CASE-BALT-1-DEMO001",
        action: "document.guardrail_rejected",
        entityType: "system",
        entityId: "draft:CASE-BALT-1-DEMO001:vista_camuflada.pdf",
        afterState: expect.objectContaining({
          mutation: "analyzeDocumentDraft",
          reason: "invalid_upload",
        }),
      }),
    );
    expect(storagePut).not.toHaveBeenCalled();
    expect(db.upsertCanonicalContract).not.toHaveBeenCalled();
  });

  it("rejects excessively long file names before the heavy Auditar upload work starts", async () => {
    const caller = appRouter.createCaller(createProtectedContext());
    const longFileName = `${"a".repeat(170)}.pdf`;

    await expect(
      caller.cases.uploadDocument({
        tenantId: "balt-1",
        caseId: "CASE-BALT-1-DEMO001",
        fileName: longFileName,
        mimeType: "application/pdf",
        base64Content: "data:application/pdf;base64,JVBERi0xLjQKJSVFT0YK",
        visibility: "tenant_legal",
        consentStatus: "pending",
        sourceChannel: "manual",
      }),
    ).rejects.toThrow(/nombre del archivo es demasiado largo/i);

    expect(storagePut).not.toHaveBeenCalled();
    expect(db.addDocumentRecord).not.toHaveBeenCalled();
  });

  it("rejects excessively long file names before the Auditar preview starts", async () => {
    const caller = appRouter.createCaller(createProtectedContext());
    const longFileName = `${"vista_previa_".repeat(14)}.pdf`;

    await expect(
      caller.cases.analyzeDocumentDraft({
        tenantId: "balt-1",
        caseId: "CASE-BALT-1-DEMO001",
        fileName: longFileName,
        mimeType: "application/pdf",
        base64Content: "data:application/pdf;base64,JVBERi0xLjQKJSVFT0YK",
        sourceChannel: "manual",
      }),
    ).rejects.toThrow(/nombre del archivo es demasiado largo/i);

    expect(storagePut).not.toHaveBeenCalled();
    expect(db.upsertCanonicalContract).not.toHaveBeenCalled();
  });

  it("fails upload authorization before any heavy Auditar work starts", async () => {
    vi.mocked(db.assertCaseWriteAccess).mockRejectedValueOnce(new Error("FORBIDDEN"));

    const caller = appRouter.createCaller(createProtectedContext());

    await expect(
      caller.cases.uploadDocument({
        tenantId: "balt-1",
        caseId: "CASE-BALT-1-DEMO001",
        fileName: "nomina_privada.pdf",
        mimeType: "application/pdf",
        base64Content: "data:application/pdf;base64,JVBERi0xLjQKJSVFT0YK",
        visibility: "tenant_legal",
        consentStatus: "pending",
        sourceChannel: "manual",
      }),
    ).rejects.toThrow(/FORBIDDEN/i);

    expect(storagePut).not.toHaveBeenCalled();
    expect(db.getCaseDetailForUser).not.toHaveBeenCalled();
  });

  it("fails preview authorization before any heavy Auditar analysis starts", async () => {
    vi.mocked(db.assertCaseWriteAccess).mockRejectedValueOnce(new Error("FORBIDDEN"));

    const caller = appRouter.createCaller(createProtectedContext());

    await expect(
      caller.cases.analyzeDocumentDraft({
        tenantId: "balt-1",
        caseId: "CASE-BALT-1-DEMO001",
        fileName: "vista_privada.pdf",
        mimeType: "application/pdf",
        base64Content: "data:application/pdf;base64,JVBERi0xLjQKJSVFT0YK",
        sourceChannel: "manual",
      }),
    ).rejects.toThrow(/FORBIDDEN/i);

    expect(storagePut).not.toHaveBeenCalled();
    expect(db.getCaseDetailForUser).not.toHaveBeenCalled();
  });

  it("fails draft confirmation authorization before acquiring the Auditar database lock", async () => {
    vi.mocked(db.assertCaseWriteAccess).mockRejectedValueOnce(new Error("FORBIDDEN"));

    const caller = appRouter.createCaller(createProtectedContext());

    await expect(
      caller.cases.confirmDocumentDraft({
        tenantId: "balt-1",
        caseId: "CASE-BALT-1-DEMO001",
        draftId: "DRF-FORBIDDEN-001",
      }),
    ).rejects.toThrow(/FORBIDDEN/i);

    expect(db.withDatabaseLock).not.toHaveBeenCalled();
    expect(db.getAuditarDraftById).not.toHaveBeenCalled();
  });

  it("blocks confirming an expired Auditar preview", async () => {
    vi.mocked(db.getAuditarDraftById).mockResolvedValue({
      contractId: 91,
      traceId: "trace.balt-1.CASE-BALT-1-DEMO001",
      createdAt: new Date("2026-04-05T08:00:00.000Z"),
      updatedAt: new Date("2026-04-05T08:00:00.000Z"),
      payload: {
        draftId: "DRF-EXPIRED-001",
        createdAt: "2026-04-05T08:00:00.000Z",
      },
    } as never);

    const caller = appRouter.createCaller(createProtectedContext());

    await expect(
      caller.cases.confirmDocumentDraft({
        tenantId: "balt-1",
        caseId: "CASE-BALT-1-DEMO001",
        draftId: "DRF-EXPIRED-001",
      }),
    ).rejects.toThrow(/expiró|Súbelo otra vez/i);

    expect(db.withDatabaseLock).toHaveBeenCalledWith(
      expect.objectContaining({
        lockKey: "auditar-confirm:balt-1:CASE-BALT-1-DEMO001:DRF-EXPIRED-001",
        timeoutSeconds: 12,
        action: expect.any(Function),
      }),
    );
    expect(db.addDocumentRecord).not.toHaveBeenCalled();
  });

  it("blocks confirming the same Auditar preview twice", async () => {
    const freshDraftCreatedAt = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    vi.mocked(db.getAuditarDraftById).mockResolvedValue({
      contractId: 92,
      traceId: "trace.balt-1.CASE-BALT-1-DEMO001",
      createdAt: new Date(freshDraftCreatedAt),
      updatedAt: new Date(freshDraftCreatedAt),
      payload: {
        draftId: "DRF-DUPLICATE-001",
        createdAt: freshDraftCreatedAt,
      },
    } as never);
    vi.mocked(db.listCanonicalContractsByType).mockResolvedValue([
      {
        id: 701,
        payload: JSON.stringify({
          draftId: "DRF-DUPLICATE-001",
          documentId: "DOC-EXISTING-001",
        }),
        createdAt: new Date("2026-04-08T10:10:00.000Z"),
        updatedAt: new Date("2026-04-08T10:10:00.000Z"),
        status: "ready",
        schemaVersion: "v1",
      },
    ] as never);

    const caller = appRouter.createCaller(createProtectedContext());

    await expect(
      caller.cases.confirmDocumentDraft({
        tenantId: "balt-1",
        caseId: "CASE-BALT-1-DEMO001",
        draftId: "DRF-DUPLICATE-001",
      }),
    ).rejects.toThrow(/ya fue confirmada/i);

    expect(db.withDatabaseLock).toHaveBeenCalledWith(
      expect.objectContaining({
        lockKey: "auditar-confirm:balt-1:CASE-BALT-1-DEMO001:DRF-DUPLICATE-001",
        timeoutSeconds: 12,
        action: expect.any(Function),
      }),
    );
    expect(db.addDocumentRecord).not.toHaveBeenCalled();
  });

  it("rate limits repeated preview confirmations before taking the database lock", async () => {
    vi.mocked(db.getAuditarDraftById).mockResolvedValue({
      contractId: 93,
      traceId: "trace.balt-1.CASE-BALT-1-DEMO001",
      createdAt: new Date("2026-04-05T08:00:00.000Z"),
      updatedAt: new Date("2026-04-05T08:00:00.000Z"),
      payload: {
        draftId: "DRF-RATE-CONFIRM-001",
        createdAt: "2026-04-05T08:00:00.000Z",
      },
    } as never);

    const caller = appRouter.createCaller(
      createProtectedContext({
        id: 72,
        openId: "auditar-rate-confirm",
        email: "rate-confirm@complilink.mx",
      }),
    );

    for (let attempt = 0; attempt < 8; attempt += 1) {
      await expect(
        caller.cases.confirmDocumentDraft({
          tenantId: "balt-1",
          caseId: "CASE-BALT-1-DEMO001",
          draftId: "DRF-RATE-CONFIRM-001",
        }),
      ).rejects.toThrow(/expiró|Súbelo otra vez/i);
    }

    await expect(
      caller.cases.confirmDocumentDraft({
        tenantId: "balt-1",
        caseId: "CASE-BALT-1-DEMO001",
        draftId: "DRF-RATE-CONFIRM-001",
      }),
    ).rejects.toThrow(/demasiados intentos seguidos en Auditar/i);

    expect(db.withDatabaseLock).toHaveBeenCalledTimes(8);
  });

  it("confirms an Auditar preview with lock plus batched contracts, events and audit logs", async () => {
    const freshDraftCreatedAt = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    vi.mocked(db.getAuditarDraftById).mockResolvedValue({
      id: 410,
      tenantId: "balt-1",
      caseId: "CASE-BALT-1-DEMO001",
      draftId: "DRF-CONFIRM-001",
      createdAt: new Date(freshDraftCreatedAt),
      payload: {
        draftId: "DRF-CONFIRM-001",
        createdAt: freshDraftCreatedAt,
        fileName: "constancia_imss.pdf",
        mimeType: "application/pdf",
        sizeBytes: 123456,
        storageKey: "complilink/balt-1/DRF-CONFIRM-001.pdf",
        storageUrl: "https://cdn.example.com/DRF-CONFIRM-001.pdf",
        sha256: "a".repeat(64),
        expectedDocumentType: "constancia_imss",
        captureMode: "manual_upload",
        classification: {
          documentType: "imss_record",
          classificationConfidence: 0.91,
          normalizedDocType: "constancia_imss",
          reasons: ["Se detectaron semanas cotizadas y datos patronales."],
          processingProfile: "structured",
          reviewRecommendation: "auto_accept",
          supportsStructuredExtraction: true,
          supportsBenefitEstimation: true,
        },
        preliminaryAnalysis: {
          confirmedData: {
            workerName: "María López",
            employerRfc: "ABC010101AAA",
            period: "2026-03",
          },
          estimatedData: {},
          structuredExtraction: {
            nss: "12345678901",
          },
          extractionTargets: ["nss", "employerRfc"],
          guardrails: [],
        },
        scanAssistance: {
          friendlyHeadline: "Captura utilizable",
          userGuidance: "La captura es legible y puede pasar a resguardo.",
          readiness: "ready",
          documentPresence: "present",
          expectedTypeAlignment: "match",
          confidence: 0.94,
          issues: [],
        },
      },
    } as never);

    const caller = appRouter.createCaller(createProtectedContext());
    const result = await caller.cases.confirmDocumentDraft({
      tenantId: "balt-1",
      caseId: "CASE-BALT-1-DEMO001",
      draftId: "DRF-CONFIRM-001",
      visibility: "case_team",
      consentStatus: "granted",
      sourceChannel: "manual",
    });

    expect(db.withDatabaseLock).toHaveBeenCalledWith(
      expect.objectContaining({
        lockKey: "auditar-confirm:balt-1:CASE-BALT-1-DEMO001:DRF-CONFIRM-001",
        timeoutSeconds: 12,
        action: expect.any(Function),
      }),
    );
    expect(db.addDocumentRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "balt-1",
        caseId: "CASE-BALT-1-DEMO001",
        originalName: "constancia_imss.pdf",
        documentType: "imss_record",
        consentStatus: "granted",
        visibility: "case_team",
        integrityStatus: "verified",
      }),
    );
    expect(db.upsertCanonicalContracts).toHaveBeenCalledTimes(1);
    const confirmContracts = vi.mocked(db.upsertCanonicalContracts).mock.calls[0]?.[0] ?? [];
    expect(confirmContracts.map((contract) => contract?.contractType)).toEqual([
      "document",
      "classification",
      "shared_engine",
      "audit",
    ]);

    expect(db.addCaseEvents).toHaveBeenCalledTimes(1);
    const confirmEvents = vi.mocked(db.addCaseEvents).mock.calls[0]?.[0] ?? [];
    expect(confirmEvents.map((event) => event?.title)).toEqual(
      expect.arrayContaining([
        "Documento confirmado y guardado",
        "Documento clasificado",
        "Escaneo asistido evaluó la captura",
        "El asesor laboral preparó una opinión inicial",
      ]),
    );

    expect(db.createAuditLogs).toHaveBeenCalledTimes(1);
    const confirmAuditActions = vi.mocked(db.createAuditLogs).mock.calls[0]?.[0]?.map((entry) => entry?.action) ?? [];
    expect(confirmAuditActions).toEqual(
      expect.arrayContaining([
        "document.upload",
        "document.preview_confirmed",
        "document.engine_dispatch",
        "document.helios_opinion",
        "document.scan_assist",
      ]),
    );
    expect(result.document.originalName).toBe("constancia_imss.pdf");
    expect(result.document.sha256).toHaveLength(64);
    expect(result.heliosOpinion).toMatchObject({
      status: expectedHeliosStatus,
      mode: expectedHeliosMode,
    });
  });

  it("deduplicates an immediate repeated confirmation of the same Auditar draft after success", async () => {
    const freshDraftCreatedAt = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    vi.mocked(db.getAuditarDraftById).mockResolvedValue({
      id: 411,
      tenantId: "balt-1",
      caseId: "CASE-BALT-1-DEMO001",
      draftId: "DRF-CONFIRM-DEDUP-001",
      createdAt: new Date(freshDraftCreatedAt),
      payload: {
        draftId: "DRF-CONFIRM-DEDUP-001",
        createdAt: freshDraftCreatedAt,
        fileName: "constancia_imss.pdf",
        mimeType: "application/pdf",
        sizeBytes: 123456,
        storageKey: "complilink/balt-1/DRF-CONFIRM-DEDUP-001.pdf",
        storageUrl: "https://cdn.example.com/DRF-CONFIRM-DEDUP-001.pdf",
        sha256: "b".repeat(64),
        expectedDocumentType: "constancia_imss",
        captureMode: "manual_upload",
        classification: {
          documentType: "imss_record",
          classificationConfidence: 0.91,
          normalizedDocType: "constancia_imss",
          reasons: ["Se detectaron semanas cotizadas y datos patronales."],
          processingProfile: "structured",
          reviewRecommendation: "auto_accept",
          supportsStructuredExtraction: true,
          supportsBenefitEstimation: true,
        },
        preliminaryAnalysis: {
          confirmedData: {
            workerName: "María López",
            employerRfc: "ABC010101AAA",
            period: "2026-03",
          },
          estimatedData: {},
          structuredExtraction: {
            nss: "12345678901",
          },
          extractionTargets: ["nss", "employerRfc"],
          guardrails: [],
        },
        scanAssistance: {
          friendlyHeadline: "Captura utilizable",
          userGuidance: "La captura es legible y puede pasar a resguardo.",
          readiness: "ready",
          documentPresence: "present",
          expectedTypeAlignment: "match",
          confidence: 0.94,
          issues: [],
        },
      },
    } as never);

    const caller = appRouter.createCaller(
      createProtectedContext({
        id: 76,
        openId: "auditar-dedup-confirm",
        email: "dedup-confirm@complilink.mx",
      }),
    );

    const repeatedInput = {
      tenantId: "balt-1",
      caseId: "CASE-BALT-1-DEMO001",
      draftId: "DRF-CONFIRM-DEDUP-001",
      visibility: "case_team" as const,
      consentStatus: "granted" as const,
      sourceChannel: "manual" as const,
    };

    await caller.cases.confirmDocumentDraft(repeatedInput);

    await expect(caller.cases.confirmDocumentDraft(repeatedInput)).rejects.toThrow(
      /confirmación documental ya está en curso|se procesó hace instantes/i,
    );

    expect(db.withDatabaseLock).toHaveBeenCalledTimes(1);
    expect(db.addDocumentRecord).toHaveBeenCalledTimes(1);
  });

  it("creates consent records with canonical contract and audit evidence", async () => {
    const caller = appRouter.createCaller(createProtectedContext());

    const result = await caller.consent.create({
      tenantId: "balt-1",
      caseId: "CASE-BALT-1-DEMO001",
      documentId: "DOC-TEST-001",
      subjectName: "María López",
      subjectRole: "Colaboradora",
      legalBasis: "Defensa jurídica y relación contractual",
      status: "granted",
      notes: "Consentimiento formalizado por el equipo legal.",
    });

    expect(result.success).toBe(true);
    expect(db.assertCaseWriteAccess).toHaveBeenCalledWith(7, "balt-1", "CASE-BALT-1-DEMO001");
    expect(db.addConsentRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "balt-1",
        caseId: "CASE-BALT-1-DEMO001",
        documentId: "DOC-TEST-001",
        status: "granted",
        grantedAt: expect.any(Date),
      }),
    );
    expect(db.upsertCanonicalContract).toHaveBeenCalledWith(
      expect.objectContaining({
        contractType: "consent",
        status: "ready",
      }),
    );
    expect(db.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "consent.create",
        entityType: "consent",
      }),
    );
  });

  it("accepts the legal package with versioned consent evidence and audit trail", async () => {
    vi.mocked(db.addConsentRecord).mockImplementation(async (input) => ({
      id: 800,
      ...input,
    }) as never);

    const baseContext = createProtectedContext();
    const caller = appRouter.createCaller({
      ...baseContext,
      req: {
        protocol: "https",
        headers: {
          "x-forwarded-for": "203.0.113.9",
          "user-agent": "Vitest Legal Gate",
        },
      } as TrpcContext["req"],
    });

    const result = await caller.consent.acceptLegalPackage({
      tenantId: "balt-1",
      caseId: "CASE-BALT-1-DEMO001",
      accepted: true,
    });

    expect(result).toMatchObject({
      success: true,
      alreadyAccepted: false,
      acceptance: {
        acceptanceVersion: LEGAL_ACCEPTANCE_VERSION,
        legalVersion: LEGAL_VERSION,
        isAccepted: true,
      },
    });
    expect(result.acceptance.documents).toHaveLength(LEGAL_DOCUMENTS.length);
    expect(result.acceptance.missingDocuments).toHaveLength(0);
    expect(db.addConsentRecord).toHaveBeenCalledTimes(LEGAL_CONSENT_TYPES.length);
    expect(vi.mocked(db.addConsentRecord).mock.calls.map((call) => call[0]?.legalBasis)).toEqual(
      LEGAL_CONSENT_TYPES.map((type) => `legal_package:${LEGAL_ACCEPTANCE_VERSION}:${type}`),
    );
    expect(db.upsertCanonicalContract).toHaveBeenCalledTimes(LEGAL_CONSENT_TYPES.length);
    expect(db.upsertCanonicalContract).toHaveBeenCalledWith(
      expect.objectContaining({
        contractType: "consent",
        schemaVersion: LEGAL_CONTRACT_SCHEMA_VERSION,
        status: "ready",
      }),
    );
    expect(db.addCaseEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        title: `Paquete legal ${LEGAL_VERSION} aceptado`,
      }),
    );
    expect(db.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "consent.legal_package_accept",
        entityId: `CASE-BALT-1-DEMO001:legal_package:${LEGAL_ACCEPTANCE_VERSION}`,
        afterState: expect.objectContaining({
          legalVersion: LEGAL_VERSION,
          clientIp: "203.0.113.9",
          userAgent: "Vitest Legal Gate",
        }),
      }),
    );
  });

  it("returns alreadyAccepted without duplicating consent evidence when the package was already registered", async () => {
    const acceptedAt = new Date("2026-04-06T12:30:00.000Z");

    vi.mocked(db.getCaseDetailForUser).mockResolvedValue({
      ...demoCaseDetail,
      events: [
        {
          eventType: "consent_updated",
          metadata: JSON.stringify({
            acceptance_version: LEGAL_ACCEPTANCE_VERSION,
          }),
        },
      ],
      consents: LEGAL_CONSENT_TYPES.map((consentType) => ({
        legalBasis: `legal_package:${LEGAL_ACCEPTANCE_VERSION}:${consentType}`,
        status: "granted",
        notes: JSON.stringify({
          acceptanceVersion: LEGAL_ACCEPTANCE_VERSION,
          consentType,
          clientIp: "203.0.113.9",
          userAgent: "Vitest Legal Gate",
          actorEmail: "owner@complilink.mx",
        }),
        subjectName: "CompliLink Owner",
        subjectRole: "platform_user",
        documentId: null,
        grantedAt: acceptedAt,
        createdAt: acceptedAt,
        updatedAt: acceptedAt,
      })),
    } as never);
    vi.mocked(db.listCanonicalContractsByType).mockResolvedValue(
      LEGAL_CONSENT_TYPES.map((consentType, index) => ({
        id: index + 1,
        payload: JSON.stringify({
          schema_version: LEGAL_ACCEPTANCE_VERSION,
          consent_type: consentType,
        }),
        createdAt: acceptedAt,
        updatedAt: acceptedAt,
        status: "ready",
        schemaVersion: LEGAL_CONTRACT_SCHEMA_VERSION,
      })) as never,
    );
    vi.mocked(db.findAuditLogEntry).mockResolvedValue({
      id: 88,
      createdAt: acceptedAt,
    } as never);

    const caller = appRouter.createCaller(createProtectedContext());
    const result = await caller.consent.acceptLegalPackage({
      tenantId: "balt-1",
      caseId: "CASE-BALT-1-DEMO001",
      accepted: true,
    });

    expect(result).toMatchObject({
      success: true,
      alreadyAccepted: true,
      acceptance: {
        isAccepted: true,
      },
    });
    expect(db.addConsentRecord).not.toHaveBeenCalled();
    expect(db.upsertCanonicalContract).not.toHaveBeenCalled();
    expect(db.addCaseEvent).not.toHaveBeenCalled();
    expect(db.createAuditLog).not.toHaveBeenCalled();
  });

  it("recreates only the persistent audit marker when the legal package was accepted but the audit entry is missing", async () => {
    const acceptedAt = new Date("2026-04-06T12:30:00.000Z");

    vi.mocked(db.getCaseDetailForUser).mockResolvedValue({
      ...demoCaseDetail,
      events: [
        {
          eventType: "consent_updated",
          metadata: JSON.stringify({
            acceptance_version: LEGAL_ACCEPTANCE_VERSION,
          }),
        },
      ],
      consents: LEGAL_CONSENT_TYPES.map((consentType) => ({
        legalBasis: `legal_package:${LEGAL_ACCEPTANCE_VERSION}:${consentType}`,
        status: "granted",
        notes: JSON.stringify({
          acceptanceVersion: LEGAL_ACCEPTANCE_VERSION,
          consentType,
          clientIp: "203.0.113.9",
          userAgent: "Vitest Legal Gate",
          actorEmail: "owner@complilink.mx",
        }),
        subjectName: "CompliLink Owner",
        subjectRole: "platform_user",
        documentId: null,
        grantedAt: acceptedAt,
        createdAt: acceptedAt,
        updatedAt: acceptedAt,
      })),
    } as never);
    vi.mocked(db.listCanonicalContractsByType).mockResolvedValue(
      LEGAL_CONSENT_TYPES.map((consentType, index) => ({
        id: index + 1,
        payload: JSON.stringify({
          schema_version: LEGAL_ACCEPTANCE_VERSION,
          consent_type: consentType,
        }),
        createdAt: acceptedAt,
        updatedAt: acceptedAt,
        status: "ready",
        schemaVersion: LEGAL_CONTRACT_SCHEMA_VERSION,
      })) as never,
    );
    vi.mocked(db.findAuditLogEntry).mockResolvedValue(null);

    const caller = appRouter.createCaller(createProtectedContext());
    const result = await caller.consent.acceptLegalPackage({
      tenantId: "balt-1",
      caseId: "CASE-BALT-1-DEMO001",
      accepted: true,
    });

    expect(result).toMatchObject({
      success: true,
      alreadyAccepted: true,
      acceptance: {
        isAccepted: true,
      },
    });
    expect(db.addConsentRecord).not.toHaveBeenCalled();
    expect(db.upsertCanonicalContract).not.toHaveBeenCalled();
    expect(db.addCaseEvent).not.toHaveBeenCalled();
    expect(db.createAuditLog).toHaveBeenCalledTimes(1);
    expect(db.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "consent.legal_package_accept",
        entityId: `CASE-BALT-1-DEMO001:legal_package:${LEGAL_ACCEPTANCE_VERSION}`,
        afterState: expect.objectContaining({
          repairedArtifacts: expect.objectContaining({
            missingConsentTypes: [],
            missingContractTypes: [],
            createdAcceptanceEvent: false,
          }),
        }),
      }),
    );
  });

  it("repairs missing legal artifacts without inserting duplicate consent rows", async () => {
    const acceptedAt = new Date("2026-04-06T12:30:00.000Z");

    vi.mocked(db.getCaseDetailForUser).mockResolvedValue({
      ...demoCaseDetail,
      events: [],
      consents: LEGAL_CONSENT_TYPES.map((consentType) => ({
        legalBasis: `legal_package:${LEGAL_ACCEPTANCE_VERSION}:${consentType}`,
        status: "granted",
        notes: JSON.stringify({
          acceptanceVersion: LEGAL_ACCEPTANCE_VERSION,
          consentType,
          clientIp: "198.51.100.10",
          userAgent: "Existing Legal Gate",
          actorEmail: "owner@complilink.mx",
        }),
        subjectName: "CompliLink Owner",
        subjectRole: "platform_user",
        documentId: null,
        grantedAt: acceptedAt,
        createdAt: acceptedAt,
        updatedAt: acceptedAt,
      })),
    } as never);
    vi.mocked(db.listCanonicalContractsByType).mockResolvedValue([]);
    vi.mocked(db.findAuditLogEntry).mockResolvedValue(null);

    const caller = appRouter.createCaller(createProtectedContext());
    const result = await caller.consent.acceptLegalPackage({
      tenantId: "balt-1",
      caseId: "CASE-BALT-1-DEMO001",
      accepted: true,
    });

    expect(result).toMatchObject({
      success: true,
      alreadyAccepted: true,
      acceptance: {
        isAccepted: true,
      },
    });
    expect(db.addConsentRecord).not.toHaveBeenCalled();
    expect(db.upsertCanonicalContract).toHaveBeenCalledTimes(LEGAL_CONSENT_TYPES.length);
    expect(db.addCaseEvent).toHaveBeenCalledTimes(1);
    expect(db.createAuditLog).toHaveBeenCalledTimes(1);
    expect(db.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        afterState: expect.objectContaining({
          repairedArtifacts: expect.objectContaining({
            missingConsentTypes: [],
            missingContractTypes: LEGAL_CONSENT_TYPES,
            createdAcceptanceEvent: true,
          }),
        }),
      }),
    );
  });

  it("maps lock contention to a conflict error without persisting duplicate acceptance artifacts", async () => {
    const caller = appRouter.createCaller(createProtectedContext());

    vi.mocked(db.withDatabaseLock).mockRejectedValueOnce({
      code: "DATABASE_LOCK_CONFLICT",
      lockKey: `legal:balt-1:CASE-BALT-1-DEMO001:${LEGAL_ACCEPTANCE_VERSION}`,
      timeoutSeconds: 12,
      waitTimeMs: 9_500,
    });

    await expect(
      caller.consent.acceptLegalPackage({
        tenantId: "balt-1",
        caseId: "CASE-BALT-1-DEMO001",
        accepted: true,
      }),
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: "Otro proceso está registrando esta aceptación. Espera unos segundos y vuelve a intentarlo.",
    });

    expect(db.addConsentRecord).not.toHaveBeenCalled();
    expect(db.upsertCanonicalContract).not.toHaveBeenCalled();
    expect(db.addCaseEvent).not.toHaveBeenCalled();
    expect(db.createAuditLog).toHaveBeenCalledTimes(1);
    expect(db.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "consent.legal_package_lock_conflict",
        tenantId: "balt-1",
        caseId: "CASE-BALT-1-DEMO001",
        entityType: "consent",
      }),
    );
  });

  it("supports a controlled retry after lock contention and persists the legal package only once", async () => {
    vi.mocked(db.addConsentRecord).mockImplementation(async (input) => ({
      id: 800,
      ...input,
    }) as never);

    const caller = appRouter.createCaller(createProtectedContext());

    vi.mocked(db.withDatabaseLock)
      .mockRejectedValueOnce({
        code: "DATABASE_LOCK_CONFLICT",
        lockKey: `legal:balt-1:CASE-BALT-1-DEMO001:${LEGAL_ACCEPTANCE_VERSION}`,
        timeoutSeconds: 12,
        waitTimeMs: 12_000,
      })
      .mockImplementationOnce(async ({ action }) => action());

    await expect(
      caller.consent.acceptLegalPackage({
        tenantId: "balt-1",
        caseId: "CASE-BALT-1-DEMO001",
        accepted: true,
      }),
    ).rejects.toMatchObject({
      code: "CONFLICT",
    });

    const retryResult = await caller.consent.acceptLegalPackage({
      tenantId: "balt-1",
      caseId: "CASE-BALT-1-DEMO001",
      accepted: true,
    });

    expect(retryResult).toMatchObject({
      success: true,
      alreadyAccepted: false,
      acceptance: {
        isAccepted: true,
        acceptanceVersion: LEGAL_ACCEPTANCE_VERSION,
      },
    });
    expect(db.withDatabaseLock).toHaveBeenCalledTimes(2);
    expect(db.addConsentRecord).toHaveBeenCalledTimes(LEGAL_CONSENT_TYPES.length);
    expect(db.upsertCanonicalContract).toHaveBeenCalledTimes(LEGAL_CONSENT_TYPES.length);
    expect(db.addCaseEvent).toHaveBeenCalledTimes(1);
    expect(db.createAuditLog).toHaveBeenCalledTimes(2);
    expect(db.createAuditLog).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        action: "consent.legal_package_lock_conflict",
        tenantId: "balt-1",
        caseId: "CASE-BALT-1-DEMO001",
        entityType: "consent",
      }),
    );
    expect(db.createAuditLog).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        action: "consent.legal_package_accept",
        tenantId: "balt-1",
        caseId: "CASE-BALT-1-DEMO001",
        entityType: "consent",
      }),
    );
  });

  it("keeps the retry path idempotent once the legal package was already completed by another process", async () => {
    const acceptedAt = new Date("2026-04-06T12:30:00.000Z");
    const caller = appRouter.createCaller(createProtectedContext());

    vi.mocked(db.withDatabaseLock)
      .mockRejectedValueOnce({
        code: "DATABASE_LOCK_CONFLICT",
        lockKey: `legal:balt-1:CASE-BALT-1-DEMO001:${LEGAL_ACCEPTANCE_VERSION}`,
        timeoutSeconds: 12,
        waitTimeMs: 7_000,
      })
      .mockImplementationOnce(async ({ action }) => action());

    await expect(
      caller.consent.acceptLegalPackage({
        tenantId: "balt-1",
        caseId: "CASE-BALT-1-DEMO001",
        accepted: true,
      }),
    ).rejects.toMatchObject({
      code: "CONFLICT",
    });

    vi.mocked(db.getCaseDetailForUser).mockResolvedValueOnce({
      ...demoCaseDetail,
      events: [
        {
          eventType: "consent_updated",
          metadata: JSON.stringify({
            acceptance_version: LEGAL_ACCEPTANCE_VERSION,
          }),
        },
      ],
      consents: LEGAL_CONSENT_TYPES.map((consentType) => ({
        legalBasis: `legal_package:${LEGAL_ACCEPTANCE_VERSION}:${consentType}`,
        status: "granted",
        notes: JSON.stringify({
          acceptanceVersion: LEGAL_ACCEPTANCE_VERSION,
          consentType,
          clientIp: "203.0.113.9",
          userAgent: "Vitest Legal Retry",
          actorEmail: "owner@complilink.mx",
        }),
        subjectName: "CompliLink Owner",
        subjectRole: "platform_user",
        documentId: null,
        grantedAt: acceptedAt,
        createdAt: acceptedAt,
        updatedAt: acceptedAt,
      })),
    } as never);
    vi.mocked(db.listCanonicalContractsByType).mockResolvedValueOnce(
      LEGAL_CONSENT_TYPES.map((consentType, index) => ({
        id: index + 1,
        payload: JSON.stringify({
          schema_version: LEGAL_ACCEPTANCE_VERSION,
          consent_type: consentType,
        }),
        createdAt: acceptedAt,
        updatedAt: acceptedAt,
        status: "ready",
        schemaVersion: LEGAL_CONTRACT_SCHEMA_VERSION,
      })) as never,
    );
    vi.mocked(db.findAuditLogEntry).mockResolvedValueOnce({
      id: 88,
      createdAt: acceptedAt,
    } as never);

    const retryResult = await caller.consent.acceptLegalPackage({
      tenantId: "balt-1",
      caseId: "CASE-BALT-1-DEMO001",
      accepted: true,
    });

    expect(retryResult).toMatchObject({
      success: true,
      alreadyAccepted: true,
      acceptance: {
        isAccepted: true,
      },
    });
    expect(db.withDatabaseLock).toHaveBeenCalledTimes(2);
    expect(db.addConsentRecord).not.toHaveBeenCalled();
    expect(db.upsertCanonicalContract).not.toHaveBeenCalled();
    expect(db.addCaseEvent).not.toHaveBeenCalled();
    expect(db.createAuditLog).toHaveBeenCalledTimes(1);
    expect(db.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "consent.legal_package_lock_conflict",
        tenantId: "balt-1",
        caseId: "CASE-BALT-1-DEMO001",
        entityType: "consent",
      }),
    );
  });

  it("creates document policies and exposes filtered audit entries", async () => {
    vi.mocked(db.listAuditTrail).mockResolvedValue([
      {
        id: 900,
        action: "policy.create",
        entityType: "policy",
        entityId: "DOC-TEST-001",
        traceId: "trace.balt-1.CASE-BALT-1-DEMO001",
        createdAt: new Date("2026-04-06T12:00:00.000Z"),
      },
    ] as never);

    const caller = appRouter.createCaller(createProtectedContext());

    const policyResult = await caller.policies.create({
      tenantId: "balt-1",
      caseId: "CASE-BALT-1-DEMO001",
      documentId: "DOC-TEST-001",
      policyType: "visibility",
      visibilityScope: "restricted",
      ruleText: "Acceso reservado a legal corporativo y counsel externo autorizado.",
      status: "active",
    });

    const auditResult = await caller.audit.list({
      tenantId: "balt-1",
      caseId: "CASE-BALT-1-DEMO001",
      limit: 25,
    });

    expect(policyResult).toEqual({ success: true });
    expect(db.assertCaseWriteAccess).toHaveBeenCalledWith(7, "balt-1", "CASE-BALT-1-DEMO001");
    expect(db.addPolicyRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "balt-1",
        caseId: "CASE-BALT-1-DEMO001",
        documentId: "DOC-TEST-001",
        policyType: "visibility",
        visibilityScope: "restricted",
      }),
    );
    expect(db.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "policy.create",
        entityType: "policy",
      }),
    );
    expect(db.listAuditTrail).toHaveBeenCalledWith({
      userId: 7,
      tenantId: "balt-1",
      caseId: "CASE-BALT-1-DEMO001",
      limit: 25,
    });
    expect(auditResult).toHaveLength(1);
    expect(auditResult[0]).toMatchObject({
      action: "policy.create",
      entityType: "policy",
      entityId: "DOC-TEST-001",
    });
  });
});

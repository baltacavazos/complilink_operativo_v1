import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const dbMocks = vi.hoisted(() => ({
  addCaseEvent: vi.fn(),
  createAuditLog: vi.fn(),
  getCeoDashboardSnapshot: vi.fn(),
  getCeoMasterMetrics: vi.fn(),
  updateCaseStatus: vi.fn(),
  updateOperationalAlertStatus: vi.fn(),
  updateTenantMembershipStatus: vi.fn(),
  ensureTenantForUser: vi.fn(),
  seedDemoCaseIfEmpty: vi.fn(),
  getSystemSnapshot: vi.fn(),
  listTenantsForUser: vi.fn(),
  listAccessibleUsersByTenant: vi.fn(),
  listCasesForUser: vi.fn(),
  listAuditTrail: vi.fn(),
  listVisibleDocuments: vi.fn(),
  assertActiveTenantMember: vi.fn(),
  assertTenantAccess: vi.fn(),
  assertTenantAdminAccess: vi.fn(),
  assertCaseAccess: vi.fn(),
  assertCaseWriteAccess: vi.fn(),
  buildCaseId: vi.fn(),
  buildTraceId: vi.fn(),
  createCaseRecord: vi.fn(),
  getCaseDetailForUser: vi.fn(),
  getDashboardForUser: vi.fn(),
  getVisibleDocumentForUser: vi.fn(),
  grantCaseAccess: vi.fn(),
  findAuditLogEntry: vi.fn(),
  listCanonicalContractsByType: vi.fn(),
  persistAuditarViewState: vi.fn(),
  updateDocumentPostProcessing: vi.fn(),
  upsertCanonicalContract: vi.fn(),
  addDocumentRecord: vi.fn(),
  addOperationalAlert: vi.fn(),
  addConsentRecord: vi.fn(),
  addPolicyRecord: vi.fn(),
  getAuditarDraftById: vi.fn(),
  withDatabaseLock: vi.fn(),
}));

const llmMocks = vi.hoisted(() => ({
  invokeLLM: vi.fn(),
}));

const bridgeSmokeMonitoringMocks = vi.hoisted(() => ({
  readBridgeSmokeMonitoringSnapshot: vi.fn(),
  updateBridgeSmokeAlertThreshold: vi.fn(),
}));

vi.mock("./db", () => dbMocks);
vi.mock("./_core/llm", () => llmMocks);
vi.mock("./bridgeSmokeMonitoring", () => bridgeSmokeMonitoringMocks);

import { appRouter } from "./routers";

const TEST_SNAPSHOT_GENERATED_AT = "2026-04-27T02:30:00.000Z";

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

function buildSnapshot() {
  return {
    generatedAt: new Date(TEST_SNAPSHOT_GENERATED_AT),
    summary: {
      totalTenants: 1,
      activeCases: 4,
      totalDocuments: 11,
      openAlerts: 3,
      criticalAlerts: 1,
      activeMemberships: 5,
      caseScopedMemberships: 2,
      pendingDocuments: 2,
      pendingConsents: 1,
      supersededDocuments: 0,
    },
    casesByStatus: [
      { status: "intake", total: 1 },
      { status: "analysis", total: 2 },
      { status: "conciliation", total: 1 },
    ],
    alertsBySeverity: [
      { severity: "critical", total: 1 },
      { severity: "warning", total: 2 },
    ],
    tenantHealth: [
      {
        tenantId: "balt-1",
        tenantName: "Balt Demo",
        status: "active",
        activeCases: 4,
        openAlerts: 3,
        activeMemberships: 5,
        caseScopedMemberships: 2,
        pendingDocuments: 2,
      },
    ],
    recentCases: [
      {
        tenantId: "balt-1",
        tenantName: "Balt Demo",
        caseId: "CASE-BALT-1-DEMO001",
        title: "Reclamación por despido",
        status: "analysis",
        priority: "critical",
        dueAt: null,
        updatedAt: new Date("2026-04-27T02:15:00.000Z"),
        lastActivityAt: new Date("2026-04-27T02:15:00.000Z"),
      },
    ],
    recentAlerts: [
      {
        id: 101,
        tenantId: "balt-1",
        tenantName: "Balt Demo",
        caseId: "CASE-BALT-1-DEMO001",
        caseTitle: "Reclamación por despido",
        traceId: "trace.balt-1.CASE-BALT-1-DEMO001",
        title: "Pago omitido detectado",
        description: "Se detectó una inconsistencia crítica en la nómina.",
        category: "overdue_case",
        severity: "critical",
        status: "open",
        raisedAt: new Date("2026-04-27T01:40:00.000Z"),
        resolvedAt: null,
      },
    ],
    recentMemberships: [
      {
        id: 501,
        tenantId: "balt-1",
        tenantName: "Balt Demo",
        caseId: "CASE-BALT-1-DEMO001",
        caseTitle: "Reclamación por despido",
        traceId: "trace.balt-1.CASE-BALT-1-DEMO001",
        userId: 21,
        userName: "Ana Operaciones",
        userEmail: "ana@demo.mx",
        role: "reviewer",
        status: "active",
        accessScope: "case",
        createdAt: new Date("2026-04-25T08:00:00.000Z"),
        updatedAt: new Date("2026-04-27T01:55:00.000Z"),
      },
    ],
    recentDocuments: [
      {
        documentId: "doc-001",
        supersedesDocumentId: null,
        tenantId: "balt-1",
        tenantName: "Balt Demo",
        caseId: "CASE-BALT-1-DEMO001",
        caseTitle: "Reclamación por despido",
        traceId: "trace.balt-1.CASE-BALT-1-DEMO001",
        originalName: "recibo-marzo.pdf",
        storedName: "recibo-marzo.pdf",
        documentType: "payroll_receipt",
        sourceKind: "user_upload",
        consentStatus: "granted",
        integrityStatus: "verified",
        visibility: "private",
        createdAt: new Date("2026-04-26T09:00:00.000Z"),
        updatedAt: new Date("2026-04-27T01:20:00.000Z"),
        supersededDocument: null,
      },
    ],
  };
}

describe("ceoHeliosChat", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-27T02:35:00.000Z"));
    vi.clearAllMocks();

    vi.mocked(dbMocks.ensureTenantForUser).mockResolvedValue({ tenantId: "balt-1" } as never);
    vi.mocked(dbMocks.seedDemoCaseIfEmpty).mockResolvedValue(undefined);
    vi.mocked(dbMocks.getSystemSnapshot).mockResolvedValue({ tenants: [], cases: [] } as never);
    vi.mocked(dbMocks.listTenantsForUser).mockResolvedValue([]);
    vi.mocked(dbMocks.listAccessibleUsersByTenant).mockResolvedValue([]);
    vi.mocked(dbMocks.listCasesForUser).mockResolvedValue([]);
    vi.mocked(dbMocks.listAuditTrail).mockResolvedValue([]);
    vi.mocked(dbMocks.listVisibleDocuments).mockResolvedValue([]);
    vi.mocked(dbMocks.assertActiveTenantMember).mockResolvedValue(undefined);
    vi.mocked(dbMocks.assertTenantAccess).mockResolvedValue(undefined);
    vi.mocked(dbMocks.assertTenantAdminAccess).mockResolvedValue(undefined);
    vi.mocked(dbMocks.assertCaseAccess).mockResolvedValue(undefined);
    vi.mocked(dbMocks.assertCaseWriteAccess).mockResolvedValue(undefined);
    vi.mocked(dbMocks.buildCaseId).mockReturnValue("CASE-BALT-0001");
    vi.mocked(dbMocks.buildTraceId).mockReturnValue("trace.balt-1.CEO-HELIOS");
    vi.mocked(dbMocks.getCaseDetailForUser).mockResolvedValue({} as never);
    vi.mocked(dbMocks.getDashboardForUser).mockResolvedValue({ totals: {}, byStatus: [] } as never);
    vi.mocked(dbMocks.getVisibleDocumentForUser).mockResolvedValue(null as never);
    vi.mocked(dbMocks.grantCaseAccess).mockResolvedValue(undefined);
    vi.mocked(dbMocks.findAuditLogEntry).mockResolvedValue(null);
    vi.mocked(dbMocks.listCanonicalContractsByType).mockResolvedValue([]);
    vi.mocked(dbMocks.persistAuditarViewState).mockResolvedValue(undefined);
    vi.mocked(dbMocks.updateDocumentPostProcessing).mockResolvedValue(undefined);
    vi.mocked(dbMocks.upsertCanonicalContract).mockResolvedValue(undefined);
    vi.mocked(dbMocks.addDocumentRecord).mockResolvedValue({} as never);
    vi.mocked(dbMocks.addOperationalAlert).mockResolvedValue(undefined);
    vi.mocked(dbMocks.addConsentRecord).mockResolvedValue(undefined);
    vi.mocked(dbMocks.addPolicyRecord).mockResolvedValue(undefined);
    vi.mocked(dbMocks.getAuditarDraftById).mockResolvedValue(null as never);
    vi.mocked(dbMocks.withDatabaseLock).mockImplementation(async ({ action }) => action());
    vi.mocked(dbMocks.getCeoDashboardSnapshot).mockResolvedValue(buildSnapshot() as never);
    vi.mocked(dbMocks.getCeoMasterMetrics).mockResolvedValue({
      generatedAt: new Date(TEST_SNAPSHOT_GENERATED_AT),
      summary: {
        totalConsoleViews: 12,
        totalGuardrailBlocks: 2,
        totalExports: 5,
        uniqueActors: 2,
      },
      last7Days: {
        consoleViews: 6,
        guardrailBlocks: 1,
        exports: 3,
      },
      latestActivity: {
        consoleViewedAt: new Date("2026-04-27T02:31:00.000Z"),
        guardrailBlockedAt: new Date("2026-04-27T02:28:00.000Z"),
        exportGeneratedAt: new Date("2026-04-27T02:20:00.000Z"),
      },
    } as never);
    vi.mocked(bridgeSmokeMonitoringMocks.readBridgeSmokeMonitoringSnapshot).mockReturnValue({
      testedAt: "2026-04-27T02:32:00.000Z",
      summary: {
        totalRuns: 8,
        passedRuns: 6,
        failedRuns: 2,
        errorRuns: 1,
        consecutiveFailures: 1,
        successRate: 75,
        last24Hours: 4,
      },
      alerting: {
        threshold: 3,
        visualState: "watch",
        statusLabel: "En observación",
        thresholdAudit: {
          userId: 7,
          userName: "CompliLink Owner",
          userEmail: "owner@complilink.mx",
          updatedAt: "2026-04-27T02:32:00.000Z",
        },
      },
    } as never);
    vi.mocked(llmMocks.invokeLLM).mockResolvedValue({
      choices: [
        {
          message: {
            content:
              "1) Confirmado: Balt Demo concentra la alerta visible más delicada.\n2) Inferido: la combinación de alerta crítica y documento pendiente presiona el frente patronal.\n3) Pendiente por confirmar: falta respuesta del área responsable.\n4) Lectura jurídico-laboral: el recibo sugiere revisar pagos omitidos.\n5) Instrucción operativa sugerida (requiere confirmación): confirma evidencia y asigna seguimiento hoy.",
          },
        },
      ],
    } as never);
    vi.mocked(dbMocks.createAuditLog).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("mantiene a Helios como interfaz única y añade la capa ejecutiva auditada para el CEO", async () => {
    const caller = appRouter.createCaller(createProtectedContext());

    const result = await caller.dashboard.ceoHeliosChat({
      prompt: "Resume qué debo mover primero hoy.",
      section: "resumen",
      tenantId: "balt-1",
    });

    expect(llmMocks.invokeLLM).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: "system",
            content: expect.stringContaining("misma interfaz central de AuditaPatron"),
          }),
          expect.objectContaining({
            role: "user",
            content: expect.stringContaining("Instrucción del CEO: Resume qué debo mover primero hoy."),
          }),
        ]),
      }),
    );
    expect(dbMocks.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "balt-1",
        actorUserId: 7,
        entityType: "system",
        entityId: "helios:resumen",
        action: "dashboard.ceo.helios_chat",
      }),
    );
    expect(result.answer).toContain("Confirmado");
    expect(result.disclaimer).toContain("degradará la respuesta a modo consulta");
    expect(result.summary).toContain("Helios separa confirmado, inferido y pendiente");
    expect(result.suggestedPrompts).toContain("Prioridades del día: dime qué urge mover hoy en alertas, accesos y documentos visibles.");
    expect(result.historyItems[0]).toMatchObject({
      title: "Snapshot ejecutivo activo",
    });
    expect(result.supportingDocuments[0]).toMatchObject({
      label: "Contexto que Helios sí está leyendo",
    });
    expect(result.supportingDocuments[1]).toMatchObject({
      label: "Permisos y carril seguro del modo CEO",
    });
  });

  it("cae a una respuesta conservadora cuando el LLM falla", async () => {
    vi.mocked(llmMocks.invokeLLM).mockRejectedValueOnce(new Error("llm_unavailable"));
    const caller = appRouter.createCaller(createProtectedContext());

    const result = await caller.dashboard.ceoHeliosChat({
      prompt: "Qué riesgo pesa más ahorita.",
      section: "alertas",
    });

    expect(result.answer).toContain("1) Confirmado");
    expect(result.answer).toContain("alertas abiertas");
    expect(result.answer).toContain("requiere confirmación");
    expect(dbMocks.createAuditLog).toHaveBeenCalledTimes(1);
  });
});

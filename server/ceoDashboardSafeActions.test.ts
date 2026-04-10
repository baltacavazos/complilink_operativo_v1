import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const dbMocks = vi.hoisted(() => ({
  addCaseEvent: vi.fn(),
  createAuditLog: vi.fn(),
  getCeoDashboardSnapshot: vi.fn(),
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

vi.mock("./db", () => dbMocks);

import * as db from "./db";
import { appRouter } from "./routers";

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
    generatedAt: new Date("2026-04-08T09:30:00.000Z"),
    summary: {
      totalTenants: 1,
      activeCases: 3,
      totalDocuments: 9,
      openAlerts: 2,
      criticalAlerts: 1,
      activeMemberships: 4,
      caseScopedMemberships: 2,
      pendingDocuments: 1,
      pendingConsents: 1,
      supersededDocuments: 0,
    },
    casesByStatus: [
      { status: "intake", total: 1 },
      { status: "analysis", total: 1 },
      { status: "conciliation", total: 1 },
    ],
    alertsBySeverity: [
      { severity: "critical", total: 1 },
      { severity: "high", total: 1 },
    ],
    tenantHealth: [
      {
        tenantId: "balt-1",
        tenantName: "Balt Demo",
        status: "active",
        activeCases: 3,
        openAlerts: 2,
        activeMemberships: 4,
        caseScopedMemberships: 2,
        pendingDocuments: 1,
      },
    ],
    recentCases: [
      {
        tenantId: "balt-1",
        tenantName: "Balt Demo",
        caseId: "CASE-BALT-1-DEMO001",
        title: "Reclamación por despido",
        status: "intake",
        priority: "high",
        updatedAt: new Date("2026-04-08T10:00:00.000Z"),
        lastActivityAt: new Date("2026-04-08T10:00:00.000Z"),
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
        category: "payroll",
        severity: "critical",
        status: "open",
        raisedAt: new Date("2026-04-08T08:00:00.000Z"),
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
        createdAt: new Date("2026-04-05T08:00:00.000Z"),
        updatedAt: new Date("2026-04-08T09:00:00.000Z"),
      },
    ],
    recentDocuments: [],
  };
}

describe("Dashboard CEO safe actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(db.ensureTenantForUser).mockResolvedValue({ tenantId: "balt-1" } as never);
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
    vi.mocked(db.getCaseDetailForUser).mockResolvedValue({} as never);
    vi.mocked(db.getDashboardForUser).mockResolvedValue({ totals: {}, byStatus: [] } as never);
    vi.mocked(db.getVisibleDocumentForUser).mockResolvedValue(null as never);
    vi.mocked(db.grantCaseAccess).mockResolvedValue(undefined);
    vi.mocked(db.findAuditLogEntry).mockResolvedValue(null);
    vi.mocked(db.listCanonicalContractsByType).mockResolvedValue([]);
    vi.mocked(db.persistAuditarViewState).mockResolvedValue(undefined);
    vi.mocked(db.updateDocumentPostProcessing).mockResolvedValue(undefined);
    vi.mocked(db.upsertCanonicalContract).mockResolvedValue(undefined);
    vi.mocked(db.addDocumentRecord).mockResolvedValue({} as never);
    vi.mocked(db.addOperationalAlert).mockResolvedValue(undefined);
    vi.mocked(db.addConsentRecord).mockResolvedValue(undefined);
    vi.mocked(db.addPolicyRecord).mockResolvedValue(undefined);
    vi.mocked(db.getAuditarDraftById).mockResolvedValue(null as never);
    vi.mocked(db.withDatabaseLock).mockImplementation(async ({ action }) => action());

    vi.mocked(db.getCeoDashboardSnapshot).mockResolvedValue(buildSnapshot() as never);
    vi.mocked(db.updateOperationalAlertStatus).mockResolvedValue({
      previous: { id: 101, status: "open" },
      updated: {
        id: 101,
        tenantId: "balt-1",
        caseId: "CASE-BALT-1-DEMO001",
        traceId: "trace.balt-1.CASE-BALT-1-DEMO001",
        status: "acknowledged",
      },
    } as never);
    vi.mocked(db.updateTenantMembershipStatus).mockResolvedValue({
      previous: { id: 501, status: "active" },
      updated: {
        id: 501,
        tenantId: "balt-1",
        caseId: "CASE-BALT-1-DEMO001",
        traceId: "trace.balt-1.CASE-BALT-1-DEMO001",
        status: "revoked",
      },
    } as never);
    vi.mocked(db.updateCaseStatus).mockResolvedValue({
      tenantId: "balt-1",
      caseId: "CASE-BALT-1-DEMO001",
      traceId: "trace.balt-1.CASE-BALT-1-DEMO001",
      status: "analysis",
    } as never);
    vi.mocked(db.addCaseEvent).mockResolvedValue(undefined);
    vi.mocked(db.createAuditLog).mockResolvedValue(undefined);
  });

  it("permite acusar recibo de una alerta abierta con trazabilidad", async () => {
    const caller = appRouter.createCaller(createProtectedContext());

    const result = await caller.dashboard.ceoUpdateAlertStatus({
      alertId: 101,
      status: "acknowledged",
    });

    expect(db.updateOperationalAlertStatus).toHaveBeenCalledWith({
      id: 101,
      status: "acknowledged",
    });
    expect(db.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "balt-1",
        caseId: "CASE-BALT-1-DEMO001",
        actorUserId: 7,
        action: "dashboard.ceo.alert_status_update",
      }),
    );
    expect(result).toMatchObject({
      id: 101,
      status: "acknowledged",
    });
  });

  it("bloquea transiciones de alerta que no siguen la secuencia segura", async () => {
    const caller = appRouter.createCaller(createProtectedContext());

    await expect(
      caller.dashboard.ceoUpdateAlertStatus({
        alertId: 101,
        status: "resolved",
      }),
    ).rejects.toThrow(/siguiente cambio operativo seguro/i);

    expect(db.updateOperationalAlertStatus).not.toHaveBeenCalled();
    expect(db.createAuditLog).not.toHaveBeenCalled();
  });

  it("permite revocar un acceso acotado a un caso y deja bitácora", async () => {
    const caller = appRouter.createCaller(createProtectedContext());

    const result = await caller.dashboard.ceoUpdateMembershipStatus({
      membershipId: 501,
      status: "revoked",
    });

    expect(db.updateTenantMembershipStatus).toHaveBeenCalledWith({
      id: 501,
      status: "revoked",
    });
    expect(db.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: "access",
        action: "dashboard.ceo.membership_status_update",
        actorUserId: 7,
      }),
    );
    expect(result).toMatchObject({
      id: 501,
      status: "revoked",
    });
  });

  it("rechaza operar accesos que no estén acotados a un caso", async () => {
    vi.mocked(db.getCeoDashboardSnapshot).mockResolvedValue({
      ...buildSnapshot(),
      recentMemberships: [
        {
          ...buildSnapshot().recentMemberships[0],
          membershipId: 777,
          id: 777,
          accessScope: "tenant",
          caseId: null,
          caseTitle: null,
        },
      ],
    } as never);

    const caller = appRouter.createCaller(createProtectedContext());

    await expect(
      caller.dashboard.ceoUpdateMembershipStatus({
        membershipId: 777,
        status: "revoked",
      }),
    ).rejects.toThrow(/fuera del caso visible|acotados a un caso/i);

    expect(db.updateTenantMembershipStatus).not.toHaveBeenCalled();
  });

  it("confirma el siguiente avance operativo sugerido para un caso", async () => {
    const caller = appRouter.createCaller(createProtectedContext());

    const result = await caller.dashboard.ceoProgressCaseStage({
      tenantId: "balt-1",
      caseId: "CASE-BALT-1-DEMO001",
      status: "analysis",
      expectedCurrentStatus: "intake",
    });

    expect(db.updateCaseStatus).toHaveBeenCalledWith({
      tenantId: "balt-1",
      caseId: "CASE-BALT-1-DEMO001",
      status: "analysis",
    });
    expect(db.addCaseEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "balt-1",
        caseId: "CASE-BALT-1-DEMO001",
        actorUserId: 7,
        eventType: "status_changed",
      }),
    );
    expect(db.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: "case",
        entityId: "CASE-BALT-1-DEMO001",
        action: "dashboard.ceo.case_progress_confirm",
      }),
    );
    expect(result).toMatchObject({ status: "analysis" });
  });

  it("bloquea acciones sobre alertas si la vista del operador quedó stale", async () => {
    const caller = appRouter.createCaller(createProtectedContext());

    await expect(
      caller.dashboard.ceoUpdateAlertStatus({
        alertId: 101,
        status: "acknowledged",
        expectedCurrentStatus: "acknowledged",
      }),
    ).rejects.toThrow(/han cambiado|desactualizada/i);

    expect(db.updateOperationalAlertStatus).not.toHaveBeenCalled();
    expect(db.createAuditLog).not.toHaveBeenCalled();
  });

  it("bloquea acciones sobre accesos si el estado visible ya cambió", async () => {
    const caller = appRouter.createCaller(createProtectedContext());

    await expect(
      caller.dashboard.ceoUpdateMembershipStatus({
        membershipId: 501,
        status: "revoked",
        expectedCurrentStatus: "revoked",
      }),
    ).rejects.toThrow(/han cambiado|desactualizada/i);

    expect(db.updateTenantMembershipStatus).not.toHaveBeenCalled();
    expect(db.createAuditLog).not.toHaveBeenCalled();
  });

  it("bloquea el avance del caso si el estado vigente ya no coincide con la vista del operador", async () => {
    const caller = appRouter.createCaller(createProtectedContext());

    await expect(
      caller.dashboard.ceoProgressCaseStage({
        tenantId: "balt-1",
        caseId: "CASE-BALT-1-DEMO001",
        status: "analysis",
        expectedCurrentStatus: "analysis",
      }),
    ).rejects.toThrow(/han cambiado|desactualizada/i);

    expect(db.updateCaseStatus).not.toHaveBeenCalled();
    expect(db.addCaseEvent).not.toHaveBeenCalled();
    expect(db.createAuditLog).not.toHaveBeenCalled();
  });

  it("bloquea estas mutaciones para usuarios sin rol admin", async () => {
    const caller = appRouter.createCaller(createProtectedContext({ role: "user" }));

    await expect(
      caller.dashboard.ceoProgressCaseStage({
        tenantId: "balt-1",
        caseId: "CASE-BALT-1-DEMO001",
        status: "analysis",
        expectedCurrentStatus: "intake",
      }),
    ).rejects.toThrow(/10002|required permission|FORBIDDEN/i);
  });
});

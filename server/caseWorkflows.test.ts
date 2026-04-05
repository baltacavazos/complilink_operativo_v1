import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const dbMocks = vi.hoisted(() => ({
  addCaseEvent: vi.fn(),
  addConsentRecord: vi.fn(),
  addDocumentRecord: vi.fn(),
  addOperationalAlert: vi.fn(),
  addPolicyRecord: vi.fn(),
  assertCaseAccess: vi.fn(),
  assertTenantAccess: vi.fn(),
  buildCaseId: vi.fn(),
  buildTraceId: vi.fn(),
  createAuditLog: vi.fn(),
  createCaseRecord: vi.fn(),
  ensureTenantForUser: vi.fn(),
  getCaseDetailForUser: vi.fn(),
  getDashboardForUser: vi.fn(),
  getSystemSnapshot: vi.fn(),
  grantCaseAccess: vi.fn(),
  listAccessibleUsersByTenant: vi.fn(),
  listAuditTrail: vi.fn(),
  listCasesForUser: vi.fn(),
  listTenantsForUser: vi.fn(),
  listVisibleDocuments: vi.fn(),
  seedDemoCaseIfEmpty: vi.fn(),
  updateCaseStatus: vi.fn(),
  updateDocumentPostProcessing: vi.fn(),
  upsertCanonicalContract: vi.fn(),
}));

const storageMocks = vi.hoisted(() => ({
  storagePut: vi.fn(),
}));

vi.mock("./db", () => dbMocks);
vi.mock("./storage", () => storageMocks);

import * as db from "./db";
import { appRouter } from "./routers";
import { storagePut } from "./storage";

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

    vi.mocked(db.ensureTenantForUser).mockResolvedValue({ tenantId: "balt-1" } as never);
    vi.mocked(db.seedDemoCaseIfEmpty).mockResolvedValue(undefined);
    vi.mocked(db.getSystemSnapshot).mockResolvedValue({ tenants: [], cases: [] } as never);
    vi.mocked(db.listTenantsForUser).mockResolvedValue([]);
    vi.mocked(db.listAccessibleUsersByTenant).mockResolvedValue([]);
    vi.mocked(db.listCasesForUser).mockResolvedValue([]);
    vi.mocked(db.listAuditTrail).mockResolvedValue([]);
    vi.mocked(db.listVisibleDocuments).mockResolvedValue([]);
    vi.mocked(db.assertTenantAccess).mockResolvedValue(undefined);
    vi.mocked(db.assertCaseAccess).mockResolvedValue(undefined);
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
    vi.mocked(db.grantCaseAccess).mockResolvedValue(undefined);
    vi.mocked(db.upsertCanonicalContract).mockResolvedValue(undefined);
    vi.mocked(db.createAuditLog).mockResolvedValue(undefined);
    vi.mocked(db.updateDocumentPostProcessing).mockResolvedValue(undefined);
    vi.mocked(db.addOperationalAlert).mockResolvedValue(undefined);
    vi.mocked(db.addConsentRecord).mockResolvedValue(undefined);
    vi.mocked(db.addPolicyRecord).mockResolvedValue(undefined);
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

    expect(db.assertTenantAccess).toHaveBeenCalledWith(7, "balt-1");
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

    expect(db.assertCaseAccess).toHaveBeenCalledWith(7, "balt-1", "CASE-BALT-1-DEMO001");
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
      base64Content: "data:application/pdf;base64,SG9sYSBDb21wbGlMaW5r",
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

    const uploadContractTypes = vi
      .mocked(db.upsertCanonicalContract)
      .mock.calls.map((call) => call[0]?.contractType);
    expect(uploadContractTypes).toEqual(["document", "shared_engine"]);
    expect(db.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "document.upload",
        entityType: "document",
      }),
    );
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

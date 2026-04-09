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
  getAuditarDraftById: vi.fn(),
  getCaseDetailForUser: vi.fn(),
  getDashboardForUser: vi.fn(),
  getSystemSnapshot: vi.fn(),
  getVisibleDocumentForUser: vi.fn(),
  grantCaseAccess: vi.fn(),
  listAccessibleUsersByTenant: vi.fn(),
  listAuditTrail: vi.fn(),
  listCasesForUser: vi.fn(),
  listTenantsForUser: vi.fn(),
  listVisibleDocuments: vi.fn(),
  persistAuditarViewState: vi.fn(),
  seedDemoCaseIfEmpty: vi.fn(),
  updateCaseStatus: vi.fn(),
  updateDocumentPostProcessing: vi.fn(),
  upsertCanonicalContract: vi.fn(),
}));

const storageMocks = vi.hoisted(() => ({
  storagePut: vi.fn(),
}));

const llmMocks = vi.hoisted(() => ({
  invokeLLM: vi.fn(),
}));

vi.mock("./db", () => dbMocks);
vi.mock("./storage", () => storageMocks);
vi.mock("./_core/llm", () => llmMocks);

import * as db from "./db";
import { invokeLLM } from "./_core/llm";
import { LEGAL_ACCEPTANCE_VERSION, LEGAL_CONSENT_TYPES, LEGAL_DOCUMENTS, LEGAL_VERSION } from "@shared/legal";
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
      displayName: "Expediente Helios de María López",
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
      actionLabel: "Revalidar IMSS e Infonavit",
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
      recommendedDocumentReason: expect.stringContaining("revalidar"),
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

    const caller = appRouter.createCaller(createProtectedContext());
    const result = await caller.cases.heliosCopilotChat({
      tenantId: "balt-1",
      caseId: "CASE-BALT-1-DEMO001",
      prompt: "¿Qué riesgo principal ves y qué documento conviene subir después?",
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
    expect(invokeLLM).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      disclaimer: "Opinión preliminar asistida por sistema.",
      confidenceScore: 74,
      sourceDocumentCount: 1,
      supportingDocuments: [
        expect.objectContaining({
          id: "DOC-HEL-001",
          label: "contrato_demo.pdf",
        }),
      ],
    });
    expect(result.answer).toContain("Respuesta clara");
    expect(result.suggestedPrompts.length).toBeGreaterThan(0);
    expect(result.supportingDocuments[0]?.detail).toContain("Lectura visible: Helios generó una lectura preliminar útil del contrato.");
    expect(db.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "balt-1",
        caseId: "CASE-BALT-1-DEMO001",
        action: "case.helios_copilot_chat",
        afterState: expect.objectContaining({
          supportingDocuments: [
            expect.objectContaining({
              id: "DOC-HEL-001",
            }),
          ],
        }),
      }),
    );
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
      actionLabel: "Revalidar IMSS e Infonavit",
      hasImssSignal: true,
      hasInfonavitSignal: true,
      imssDocumentsCount: 1,
      infonavitSignalsCount: 1,
      documentsWithOpinion: 2,
      lastRevalidationSummary: "Ya hay señales visibles de IMSS e Infonavit dentro del expediente y puedes revalidarlas sin salir de AuditaPatron.",
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
      status: "completed",
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

    const uploadContracts = vi.mocked(db.upsertCanonicalContract).mock.calls.map((call) => call[0]);
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
      mode: "mock",
      status: "completed",
    });
    expect(result.heliosOpinionContract).toMatchObject({
      engine: "helios",
      mode: "mock",
      status: "completed",
    });

    const auditActions = vi.mocked(db.createAuditLog).mock.calls.map((call) => call[0]?.action);
    expect(auditActions).toEqual(
      expect.arrayContaining(["document.upload", "document.engine_dispatch", "document.helios_opinion"]),
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

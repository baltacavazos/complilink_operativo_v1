import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import {
  buildCanonicalCaseContract,
  buildCanonicalConsentContract,
  buildCanonicalDocumentContract,
  buildDocumentStorageKey,
  buildPreliminaryLaborAnalysis,
  buildSharedEngineEnvelope,
  classifyMexicanLaborDocument,
  computeSha256,
  decodeBase64File,
  getHeliosDocumentState,
  getHeliosExpedienteStage,
  sanitizeFileName,
} from "./caseContracts";

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

describe("caseContracts", () => {
  it("decodes base64 input and computes a stable SHA-256 hash", () => {
    const base64 = "data:text/plain;base64,SG9sYSBDb21wbGlMaW5r";
    const buffer = decodeBase64File(base64);
    const expectedHash = createHash("sha256").update(buffer).digest("hex");

    expect(buffer.toString("utf8")).toBe("Hola CompliLink");
    expect(computeSha256(buffer)).toBe(expectedHash);
  });

  it("rejects oversized base64 payloads before decoding them", () => {
    const oversizedBase64 = "A".repeat(2048);

    expect(() => decodeBase64File(oversizedBase64, { maxBytes: 512 })).toThrow(
      "El archivo supera el límite de 1 KB para esta revisión inicial. Súbelo en una versión más ligera.",
    );
  });

  it("rejects malformed base64 payloads before decoding them", () => {
    expect(() => decodeBase64File("data:application/pdf;base64,%%%not-valid%%%=")).toThrow(
      "El archivo no tiene un contenido base64 válido. Vuelve a cargarlo antes de revisarlo.",
    );
  });

  it("sanitizes file names and builds a tenant-aware storage key", () => {
    const sanitized = sanitizeFileName(" Recibo nómina abril 2026.pdf ");
    const storageKey = buildDocumentStorageKey({
      tenantId: "tenant-bajio",
      caseId: "CASE-BAJIO-0001",
      documentId: "DOC-ABC123456789",
      fileName: " Recibo nómina abril 2026.pdf ",
    });

    expect(sanitized).toBe("Recibo-n-mina-abril-2026.pdf");
    expect(storageKey).toBe(
      "complilink/tenant-bajio/CASE-BAJIO-0001/DOC-ABC123456789/Recibo-n-mina-abril-2026.pdf",
    );
  });

  it("classifies representative Mexican labor documents", () => {
    expect(
      classifyMexicanLaborDocument({
        fileName: "cfdi_nomina_abril.xml",
        mimeType: "application/xml",
      }).documentType,
    ).toBe("cfdi");

    expect(
      classifyMexicanLaborDocument({
        fileName: "alta_imss_trabajador.pdf",
        mimeType: "application/pdf",
      }).documentType,
    ).toBe("imss");

    expect(
      classifyMexicanLaborDocument({
        fileName: "recibo_nomina_quincena.pdf",
        mimeType: "application/pdf",
      }).documentType,
    ).toBe("payroll_receipt");

    expect(
      classifyMexicanLaborDocument({
        fileName: "B022F1A1-1234-4F67-9ABC-1234567890AB.pdf",
        mimeType: "application/pdf",
      }).documentType,
    ).toBe("payroll_receipt");

    expect(
      classifyMexicanLaborDocument({
        fileName: "memo_interno.txt",
        mimeType: "text/plain",
      }).documentType,
    ).toBe("other");
  });

  it("propagates visible INFONAVIT signals into preliminary payroll analysis", () => {
    const analysis = buildPreliminaryLaborAnalysis({
      fileName: "hector_cfdi.xml",
      mimeType: "application/xml",
      textHint: '<cfdi:Comprobante><nomina12:Deduccion TipoDeduccion="010" Concepto="PAGO INFONAVIT" Importe="530.99" /></cfdi:Comprobante>',
    });

    expect(analysis.confirmedData.hasInfonavitSignal).toBe(true);
    expect(analysis.confirmedData.infonavitDeductionType).toBe("010");
    expect(analysis.summary).toMatch(/INFONAVIT/i);
  });

  it("derives a Helios-first stage for the expediente and an explicit state for each document", () => {
    expect(
      getHeliosExpedienteStage({
        caseStatus: "draft",
        documentsCount: 0,
        documentsWithOpinion: 0,
      }),
    ).toMatchObject({
      stage: "intake",
      stageLabel: "Listo para iniciar",
    });

    expect(
      getHeliosExpedienteStage({
        caseStatus: "analysis",
        documentsCount: 2,
        documentsWithOpinion: 0,
      }),
    ).toMatchObject({
      stage: "analysis",
      stageLabel: "Analizando",
    });

    expect(
      getHeliosExpedienteStage({
        caseStatus: "conciliation",
        documentsCount: 2,
        documentsWithOpinion: 1,
      }),
    ).toMatchObject({
      stage: "recommendations",
      stageLabel: "Con lectura activa",
    });

    expect(
      getHeliosDocumentState({
        documentType: "contract",
        hasOpinion: true,
      }),
    ).toMatchObject({
      canonicalType: "contrato_laboral",
      status: "ready",
      statusLabel: "Lectura lista",
    });

    expect(
      getHeliosDocumentState({
        documentType: "cfdi",
        hasOpinion: false,
        processedAt: new Date("2026-04-07T10:00:00.000Z"),
      }),
    ).toMatchObject({
      canonicalType: "cfdi_nomina",
      status: "analyzing",
      statusLabel: "Analizando",
    });

    expect(
      getHeliosDocumentState({
        documentType: "evidence",
        hasOpinion: false,
      }),
    ).toMatchObject({
      status: "pending_ingestion",
      statusLabel: "Pendiente de lectura",
    });
  });

  it("builds canonical case, document, consent and shared-engine envelopes with traceability fields", () => {
    const caseContract = buildCanonicalCaseContract({
      tenantId: "tenant-bajio",
      caseId: "CASE-BAJIO-0001",
      traceId: "trace.tenant-bajio.case-0001",
      title: "Despido con reclamación de prestaciones",
      status: "analysis",
      priority: "high",
      employeeName: "María López",
      employerEntity: "Empresa Demo MX",
      summary: "Se analiza expediente inicial.",
    });

    const documentContract = buildCanonicalDocumentContract({
      tenantId: "tenant-bajio",
      caseId: "CASE-BAJIO-0001",
      traceId: "trace.tenant-bajio.case-0001",
      documentId: "DOC-ABC123456789",
      documentType: "cfdi",
      sha256: "abc123hash",
      storageKey: "complilink/tenant-bajio/CASE-BAJIO-0001/DOC-ABC123456789/cfdi.xml",
      storageUrl: "https://cdn.example.com/cfdi.xml",
      visibility: "tenant_legal",
      consentStatus: "granted",
      classificationConfidence: 91,
      originalName: "cfdi.xml",
      mimeType: "application/xml",
      sizeBytes: 2048,
    });

    const consentContract = buildCanonicalConsentContract({
      tenantId: "tenant-bajio",
      caseId: "CASE-BAJIO-0001",
      traceId: "trace.tenant-bajio.case-0001",
      documentId: "DOC-ABC123456789",
      subjectName: "María López",
      status: "granted",
      legalBasis: "Relación contractual y defensa jurídica",
    });

    const envelope = buildSharedEngineEnvelope({
      tenantId: "tenant-bajio",
      caseId: "CASE-BAJIO-0001",
      traceId: "trace.tenant-bajio.case-0001",
      caseContract,
      documentContracts: [documentContract],
    });

    expect(caseContract).toMatchObject({
      contract_type: "case",
      tenant_id: "tenant-bajio",
      case_id: "CASE-BAJIO-0001",
      trace_id: "trace.tenant-bajio.case-0001",
      jurisdiction: "MX",
    });
    expect(documentContract).toMatchObject({
      contract_type: "document",
      tenant_id: "tenant-bajio",
      case_id: "CASE-BAJIO-0001",
      trace_id: "trace.tenant-bajio.case-0001",
      country: "MX",
    });
    expect(consentContract).toMatchObject({
      contract_type: "consent",
      document_id: "DOC-ABC123456789",
      status: "granted",
    });
    expect(envelope).toMatchObject({
      contract_type: "shared_engine",
      tenant_id: "tenant-bajio",
      case_id: "CASE-BAJIO-0001",
      trace_id: "trace.tenant-bajio.case-0001",
      ready_for_shared_engine: true,
    });
    expect(envelope.document_contracts).toHaveLength(1);
  });
});

describe("appRouter utils", () => {
  it("classifies documents through protected tRPC utils", async () => {
    const caller = appRouter.createCaller(createProtectedContext());

    const result = await caller.utils.classifyDocument({
      fileName: "semanas_cotizadas_imss.pdf",
      mimeType: "application/pdf",
      textHint: "Constancia IMSS con semanas cotizadas",
    });

    expect(result.documentType).toBe("imss");
    expect(result.classificationConfidence).toBeGreaterThanOrEqual(80);
  });

  it("returns SHA-256 and size through protected tRPC utils", async () => {
    const caller = appRouter.createCaller(createProtectedContext());

    const result = await caller.utils.sha256({
      base64Content: "data:text/plain;base64,SG9sYSBDb21wbGlMaW5r",
    });

    expect(result.sizeBytes).toBeGreaterThan(0);
    expect(result.sha256).toHaveLength(64);
  });

  it("rejects oversized payloads through protected tRPC sha256 utility", async () => {
    const caller = appRouter.createCaller(createProtectedContext());
    const oversizedBase64 = `data:application/pdf;base64,${"A".repeat(17 * 1024 * 1024)}`;

    await expect(
      caller.utils.sha256({
        base64Content: oversizedBase64,
      }),
    ).rejects.toThrow("El archivo supera el límite de 12 MB para esta revisión inicial. Súbelo en una versión más ligera.");
  });

  it("rejects utility access when there is no authenticated user", async () => {
    const caller = appRouter.createCaller({
      ...createProtectedContext(),
      user: null,
    });

    await expect(
      caller.utils.classifyDocument({
        fileName: "cfdi.xml",
        mimeType: "application/xml",
      }),
    ).rejects.toThrow(/Please login|UNAUTHORIZED|10001/i);
  });
});

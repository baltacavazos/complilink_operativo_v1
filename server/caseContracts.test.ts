import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import {
  buildCanonicalCaseContract,
  buildCanonicalConsentContract,
  buildCanonicalDocumentContract,
  buildDocumentStorageKey,
  buildSharedEngineEnvelope,
  classifyMexicanLaborDocument,
  computeSha256,
  decodeBase64File,
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
        fileName: "memo_interno.txt",
        mimeType: "text/plain",
      }).documentType,
    ).toBe("other");
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

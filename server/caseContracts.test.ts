import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { appRouter, buildStructuredExtractionFallback } from "./routers";
import type { TrpcContext } from "./_core/context";
import {
  buildCanonicalCaseContract,
  buildCanonicalConsentContract,
  buildCanonicalDocumentContract,
  buildDocumentStorageKey,
  buildPreliminaryLaborAnalysis,
  derivePayrollXmlTextHint,
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
        fileName: "CONTRATOINDETERMINADO-UICABPALOMODIDIERANTONIO.docx",
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        textHint: "Contrato individual de trabajo por tiempo indeterminado. Puesto: auxiliar. Jornada diurna. Prestaciones de ley. Salario diario integrado. Fecha de ingreso.",
      }).documentType,
    ).toBe("contract");

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

  it("detects salary signals from contract and CFDI text hints", () => {
    const contractAnalysis = buildPreliminaryLaborAnalysis({
      fileName: "contrato-hector.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      textHint: "Contrato individual de trabajo. Puesto: auxiliar. Salario diario $207.44. Jornada diurna.",
      classification: classifyMexicanLaborDocument({
        fileName: "contrato-hector.docx",
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        textHint: "Contrato individual de trabajo. Salario diario $207.44.",
      }),
    });
    const cfdiAnalysis = buildPreliminaryLaborAnalysis({
      fileName: "hector_cfdi.xml",
      mimeType: "application/xml",
      textHint:
        '<cfdi:Comprobante><nomina12:Nomina TotalPercepciones="999.00" SalarioBaseCotApor="331.45" SalarioDiarioIntegrado="331.45" /></cfdi:Comprobante>',
      classification: classifyMexicanLaborDocument({
        fileName: "hector_cfdi.xml",
        mimeType: "application/xml",
        textHint:
          '<cfdi:Comprobante><nomina12:Nomina SalarioBaseCotApor="331.45" SalarioDiarioIntegrado="331.45" /></cfdi:Comprobante>',
      }),
    });

    expect(contractAnalysis.estimatedData.contractDailySalary).toBe("$207.44");
    expect(cfdiAnalysis.estimatedData.socialSecurityBaseSalary).toBe("331.45");
    expect(cfdiAnalysis.estimatedData.integratedDailySalary).toBe("331.45");
    expect(cfdiAnalysis.confirmedData.socialSecurityBaseSalary).toBe("331.45");
    expect(cfdiAnalysis.confirmedData.integratedDailySalary).toBe("331.45");
  });

  it("keeps factual payroll and IMSS fields found in a printable CFDI PDF text layer", () => {
    const analysis = buildPreliminaryLaborAnalysis({
      fileName: "recibo-nomina.pdf",
      mimeType: "application/pdf",
      textHint:
        "RECIBO DE NÓMINA Razón social: Grupo Ejemplo, S.A. de C.V. Periodo: 01/08/2026 al 15/08/2026 Neto a pagar: $4,725.60 Total percepciones: $4,725.60 Total deducciones: $0.00 NSS: 12345678901 Registro patronal: Y1234567890 ISR: $0.00 Cuota IMSS: $0.00",
    });

    expect(analysis.confirmedData.payrollEmployerName).toBe("Grupo Ejemplo, S.A. de C.V.");
    expect(analysis.confirmedData.payrollPeriod).toBe("01/08/2026 al 15/08/2026");
    expect(analysis.confirmedData.payrollNetAmount).toBe("$4,725.60");
    expect(analysis.confirmedData.payrollDeductions).toBe("$0.00");
    expect(analysis.confirmedData.payrollNss).toBe("12345678901");
    expect(analysis.confirmedData.payrollEmployerRegistration).toBe("Y1234567890");
    expect(analysis.confirmedData.isrWithheld).toBe("$0.00");
    expect(analysis.confirmedData.imssWithheld).toBe("$0.00");
  });

  it("uses the CFDI XML when its payroll facts are present", () => {
    const analysis = buildPreliminaryLaborAnalysis({
      fileName: "recibo-nomina.xml",
      mimeType: "application/xml",
      textHint:
        '<cfdi:Comprobante Total="4725.60"><cfdi:Emisor Rfc="GEX010101AAA" Nombre="Grupo Ejemplo, S.A. de C.V." /><cfdi:Receptor Rfc="XOXX010101000" Nombre="Ana Pérez" /><nomina12:Nomina FechaPago="2026-08-15" FechaInicialPago="2026-08-01" FechaFinalPago="2026-08-15" TotalPercepciones="4725.60" TotalDeducciones="0.00" NumSeguridadSocial="12345678901" RegistroPatronal="Y1234567890" /></cfdi:Comprobante>',
    });

    expect(analysis.confirmedData.payrollEmployerName).toBe("Grupo Ejemplo, S.A. de C.V.");
    expect(analysis.confirmedData.payrollPeriod).toBe("2026-08-01 al 2026-08-15");
    expect(analysis.confirmedData.payrollNetAmount).toBe("$4725.60");
    expect(analysis.confirmedData.payrollPerceptions).toBe("$4725.60");
    expect(analysis.confirmedData.payrollDeductions).toBe("$0.00");
    expect(analysis.confirmedData.payrollNss).toBe("12345678901");
    expect(analysis.confirmedData.employerRfc).toBe("GEX010101AAA");
    expect(analysis.confirmedData.workerRfc).toBe("XOXX010101000");
  });

  it("reads the visible facts from the printable Camreflex payroll PDF text", () => {
    const realPdfTextDump = [
      "Representación impresa de un CFDI RECIBO:10963 |",
      "EVOLUCION CREATIVA CAMREFLEX S.A. DE C.V. | RFC: ECC190605VA1 REG FISCAL: 601",
      "REGISTRO PATRONAL: R1379389106",
      "NSS 84129214965",
      "PERIODO 2026-05-01 AL 2026-05-15 DIAS DE PAGO 15.000 FECHA DE PAGO 2026-05-15",
      "SALARIO DIARIO 315.04 REGIMEN 605 Sueldos y Salarios e Ingresos Asimilados a Salarios",
      "PERCEPCIONES DEDUCCIONES NO. CONCEPTO GRAVADO EXENTO TOTAL",
      "001 SALARIO 4,725.60 0.00 4,725.60",
      "002 SUBSIDIO 0.00 0.00 0.00",
      "TOTAL PERCEPCIONES 4,725.60 TOTAL DEDUCCIONES 0.00",
    ].join(" ");
    const analysis = buildPreliminaryLaborAnalysis({
      fileName: "recibo-cfdi.pdf",
      mimeType: "application/pdf",
      textHint: realPdfTextDump,
    });

    expect(analysis.confirmedData.internalDocumentType).toBe("cfdi");
    expect(analysis.confirmedData.payrollEmployerName).toBe("EVOLUCION CREATIVA CAMREFLEX S.A. DE C.V.");
    expect(analysis.confirmedData.payrollPeriod).toBe("2026-05-01 al 2026-05-15");
    expect(analysis.confirmedData.payrollNetAmount).toBe("$4,725.60");
    expect(analysis.confirmedData.payrollDeductions).toBe("$0.00");
    expect(analysis.confirmedData.payrollNss).toBe("84129214965");
    expect(analysis.confirmedData.payrollEmployerRegistration).toBe("R1379389106");
    expect(analysis.confirmedData.employerRfc ?? analysis.estimatedData.employerRfc).toBe("ECC190605VA1");
    expect(analysis.confirmedData.workerRfc ?? analysis.estimatedData.workerRfc).not.toBe("ECC190605VA1");
    expect(analysis.confirmedData.payrollCurp ?? null).toBeNull();
  });

  it("separa RFC del patrón y de la persona trabajadora en el CFDI de nómina de referencia", () => {
    const textHint = readFileSync(new URL("./fixtures/nomina-cfdi-referencia.xml", import.meta.url), "utf8");
    expect(textHint).toContain('cfdi:Emisor Rfc="ECC190605VA1"');
    expect(textHint).toContain('cfdi:Receptor Rfc="UIPD9211257I0"');
    expect(textHint).toContain('Curp="UIPD921125HYNCLD03"');
    expect(textHint).toContain('NumSeguridadSocial="84129214965"');
    expect(textHint).toContain('RfcProvCertif="CVD110412TF6"');

    const analysis = buildPreliminaryLaborAnalysis({
      fileName: "recibo-nomina.xml",
      mimeType: "application/xml",
      textHint,
    });

    expect(analysis.confirmedData.employerRfc).toBe("ECC190605VA1");
    expect(analysis.confirmedData.workerRfc).toBe("UIPD9211257I0");
    expect(analysis.confirmedData.workerRfc).not.toBe("ECC190605VA1");
    expect(analysis.confirmedData.workerRfc).not.toBe("CVD110412TF6");
    expect(analysis.estimatedData.workerRfc).toBe("UIPD9211257I0");
    expect(analysis.confirmedData.payrollCurp).toBe("UIPD921125HYNCLD03");
    expect(analysis.estimatedData.payrollCurp).toBe("UIPD921125HYNCLD03");
    expect(analysis.confirmedData.payrollNss).toBe("84129214965");
    expect(analysis.confirmedData.payrollNetAmount).toBe("$4725.60");
    expect(analysis.confirmedData.payrollPeriod).toBe("2026-05-01 al 2026-05-15");
    expect(analysis.estimatedData.workerName).toBe("DIDIER ANTONIO UICAB PALOMO");
    expect(String(analysis.estimatedData.workerName)).not.toMatch(/CAMREFLEX/i);
    expect(analysis.confirmedData.payrollEmployerName).toBe("EVOLUCION CREATIVA CAMREFLEX");
    expect(analysis.confirmedData.payrollFolio).toBe("10963");
    expect(analysis.confirmedData.payrollUuid).toBe("8C18C713-7AFA-5EA6-B323-FA208F8A3880");
    expect(analysis.confirmedData.integratedDailySalary).toBe("331.01");

    const padded = textHint.replace(
      "<cfdi:Comprobante ",
      `<cfdi:Comprobante Certificado="${"A".repeat(7000)}" `,
    );
    expect(padded.slice(0, 6000)).not.toContain("UIPD921125HYNCLD03");
    const hint = derivePayrollXmlTextHint(padded);
    const fromHint = buildPreliminaryLaborAnalysis({
      fileName: "recibo-nomina.xml",
      mimeType: "application/xml",
      textHint: hint,
    });
    expect(fromHint.confirmedData.workerRfc).toBe("UIPD9211257I0");
    expect(fromHint.confirmedData.payrollCurp).toBe("UIPD921125HYNCLD03");
    expect(fromHint.confirmedData.employerRfc).toBe("ECC190605VA1");
    expect(fromHint.confirmedData.workerRfc).not.toBe(fromHint.confirmedData.employerRfc);
    expect(fromHint.confirmedData.payrollFolio).toBe("10963");
    expect(fromHint.confirmedData.payrollUuid).toBe("8C18C713-7AFA-5EA6-B323-FA208F8A3880");

    const extraction = buildStructuredExtractionFallback({
      classification: classifyMexicanLaborDocument({
        fileName: "recibo-nomina.xml",
        mimeType: "application/xml",
        textHint,
      }),
      preliminaryAnalysis: analysis,
    });
    const missing = extraction.missingFields.join(" ");
    expect(missing).not.toMatch(/RFC del patrón|RFC patrón/i);
    expect(missing).not.toMatch(/RFC de la persona trabajadora|RFC trabajador/i);
    expect(extraction.fields.some((field) => field.key === "payrollCurp" && field.value === "UIPD921125HYNCLD03")).toBe(true);
    expect(extraction.fields.some((field) => field.key === "workerRfc" && field.value === "UIPD9211257I0")).toBe(true);
    expect(extraction.fields.some((field) => field.key === "workerRfc" && field.value === "ECC190605VA1")).toBe(false);
  });

  it("lee un NSS con espacios y no confunde el RFC del patrón con el de la persona", () => {
    const analysis = buildPreliminaryLaborAnalysis({
      fileName: "recibo.pdf",
      mimeType: "application/pdf",
      textHint:
        "Recibo de nomina. N.S.S. 84 12 921 4965. RFC emisor: ECC190605VA1. RFC receptor: UIPD9211257I0. CURP: UIPD 921125 HYNCLD 03. Periodo: 2026-05-01 al 2026-05-15. Neto a pagar: $4,725.60. Total percepciones: $4,725.60. Cuota IMSS: $88.10. Pago Infonavit: $210.00. Sueldo: $315.04.",
    });

    expect(analysis.confirmedData.payrollNss).toBe("84129214965");
    expect(analysis.confirmedData.employerRfc).toBe("ECC190605VA1");
    expect(analysis.confirmedData.workerRfc).toBe("UIPD9211257I0");
    expect(analysis.confirmedData.workerRfc).not.toBe(analysis.confirmedData.employerRfc);
    expect(analysis.estimatedData.payrollCurp).toBe("UIPD921125HYNCLD03");
    expect(analysis.confirmedData.payrollPeriod).toBe("2026-05-01 al 2026-05-15");
    expect(analysis.confirmedData.payrollNetAmount).toBe("$4,725.60");
    expect(analysis.confirmedData.payrollPerceptions).toBe("$4,725.60");
    expect(analysis.confirmedData.imssWithheld).toBe("$88.10");
    expect(analysis.confirmedData.infonavitWithheld).toBe("$210.00");
    expect(analysis.confirmedData.payrollDailySalary).toBe("$315.04");
  });

  it("prefiere el XML y completa con el OCR los datos que el XML no trae", () => {
    const analysis = buildPreliminaryLaborAnalysis({
      fileName: "recibo-nomina.xml",
      mimeType: "application/xml",
      textHint: [
        '<cfdi:Emisor Rfc="ECC190605VA1" Nombre="PATRON REAL SA DE CV" />',
        '<cfdi:Receptor Rfc="UIPD9211257I0" Nombre="DIDIER ANTONIO UICAB PALOMO" NumSeguridadSocial="84129214965" />',
        "OCR NSS: 11 111 111 111 RFC emisor: XXX010101AAA RFC receptor: UIPD9211257I0 Cuota IMSS: $120.50 Sueldo: $315.04",
      ].join(" "),
    });

    expect(analysis.confirmedData.payrollNss).toBe("84129214965");
    expect(analysis.confirmedData.payrollNss).not.toBe("11111111111");
    expect(analysis.confirmedData.employerRfc).toBe("ECC190605VA1");
    expect(analysis.confirmedData.employerRfc).not.toBe("XXX010101AAA");
    expect(analysis.confirmedData.workerRfc).toBe("UIPD9211257I0");
    expect(analysis.confirmedData.workerRfc).not.toBe(analysis.confirmedData.employerRfc);
    expect(analysis.confirmedData.imssWithheld).toBe("$120.50");
    expect(analysis.estimatedData.workerName).toBe("DIDIER ANTONIO UICAB PALOMO");
    expect(String(analysis.estimatedData.workerName)).not.toMatch(/PATRON REAL/i);
    expect(analysis.confirmedData.payrollDailySalary).toBe("$315.04");
  });

  it("separa el folio del folio fiscal y no usa el UUID del nombre del archivo", () => {
    const labeled = buildPreliminaryLaborAnalysis({
      fileName: "recibo.pdf",
      mimeType: "application/pdf",
      textHint:
        "Recibo de nomina. Folio fiscal: 8C18C713-7AFA-5EA6-B323-FA208F8A3880. Folio: 10963. NSS: 84129214965.",
    });
    expect(labeled.confirmedData.payrollFolio).toBe("10963");
    expect(labeled.confirmedData.payrollUuid).toBe("8C18C713-7AFA-5EA6-B323-FA208F8A3880");

    const namedLikeUuid = buildPreliminaryLaborAnalysis({
      fileName: "8c18c713-7afa-5ea6-b323-fa208f8a3880.pdf",
      mimeType: "application/pdf",
      textHint: "Recibo de nomina. NSS: 12345678901. Folio: 10963. Sueldo: $315.04.",
    });
    expect(namedLikeUuid.confirmedData.payrollFolio).toBe("10963");
    expect(namedLikeUuid.confirmedData.payrollUuid ?? null).toBeNull();
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
      summary:
        "El asesor laboral ya conectó documentos del expediente y está devolviendo una lectura preliminar con señales y siguientes pasos útiles.",
    });
    expect(
      getHeliosExpedienteStage({
        caseStatus: "conciliation",
        documentsCount: 2,
        documentsWithOpinion: 1,
      }).summary,
    ).not.toContain("Helios ya conectó documentos del expediente y está devolviendo una lectura preliminar");

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

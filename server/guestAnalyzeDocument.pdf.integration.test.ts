import { afterEach, describe, expect, it, vi } from "vitest";

import { OFFICIAL_FACT_ARRIVED_NOTICE } from "@shared/officialCheckCopy";
import type { OfficialCheckSummary } from "@shared/officialCheckCopy";
import { readGuestPreviewToken } from "./heliosPublicExperience";
import { persistGuestOfficialFact, rememberGuestOfficialSession } from "./guestOfficialFactStore";

const storageMocks = vi.hoisted(() => ({
  storagePut: vi.fn(async () => ({
    key: "guest-home/GST-test/recibo-camreflex.pdf",
    url: "https://example.test/recibo-camreflex.pdf",
  })),
}));

vi.mock("./storage", () => ({
  storagePut: storageMocks.storagePut,
  storageGet: vi.fn(),
}));

vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(async () => {
    throw new Error("No se requiere LLM para la regresión factual de PDF.");
  }),
}));

const { appRouter, resetAuditarRuntimeGuardsForTests } = await import("./routers");

function escapePdfLiteral(value: string) {
  return value.replace(/([\\()])/g, "\\$1");
}

function buildPrintablePayrollPdf() {
  // Snapshot of the authorized printable CFDI layout, sanitized to omit the
  // worker name/CURP. Fragments intentionally arrive out of operator order.
  const realLayoutFragments = [
    { text: "TOTAL DEDUCCIONES", x: 320, y: 370 },
    { text: "0.00", x: 505, y: 370 },
    { text: "REGISTRO PATRONAL: R1379389106", x: 72, y: 700 },
    { text: "001 SALARIO", x: 90, y: 408 },
    { text: "4,725.60", x: 300, y: 408 },
    { text: "PERIODO 2026-05-01 AL 2026-05-15", x: 72, y: 555 },
    { text: "RECIBO:10963 |", x: 72, y: 746 },
    { text: "EVOLUCION CREATIVA CAMREFLEX S.A. DE C.V.", x: 72, y: 746 },
    { text: "RFC: ECC190605VA1", x: 72, y: 730 },
    { text: "NSS 84129214965", x: 72, y: 575 },
    { text: "TOTAL PERCEPCIONES", x: 72, y: 370 },
    { text: "4,725.60", x: 190, y: 370 },
    { text: "REPRESENTACION IMPRESA DE CFDI", x: 72, y: 772 },
  ];
  const stream = realLayoutFragments
    .map(({ text, x, y }) => `BT\n/F1 11 Tf\n${x} ${y} Td\n(${escapePdfLiteral(text)}) Tj\nET`)
    .join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach(offset => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, "latin1").toString("base64");
}

describe("cases.guestAnalyzeDocument printable payroll PDF", () => {
  afterEach(() => {
    resetAuditarRuntimeGuardsForTests();
  });

  it("carries native PDF text through the public response with all payroll facts", async () => {
    const caller = appRouter.createCaller({
      user: null,
      req: { headers: {} },
      res: {},
    } as never);

    const result = await caller.cases.guestAnalyzeDocument({
      fileName: "recibo-camreflex.pdf",
      mimeType: "application/pdf",
      base64Content: buildPrintablePayrollPdf(),
      sourceChannel: "manual",
    });

    expect(result.preview.preliminaryAnalysis.confirmedData).toMatchObject({
      payrollEmployerName: "EVOLUCION CREATIVA CAMREFLEX S.A. DE C.V.",
      payrollPeriod: "2026-05-01 al 2026-05-15",
      payrollNetAmount: "$4,725.60",
      payrollDeductions: "$0.00",
      payrollNss: "84129214965",
      payrollEmployerRegistration: "R1379389106",
    });
    expect(result.preview.classification.documentType).toBe("cfdi");
    expect(storageMocks.storagePut).toHaveBeenCalledTimes(1);
  });
});

describe("cases.guestOfficialCheck", () => {
  afterEach(() => {
    resetAuditarRuntimeGuardsForTests();
  });

  function createPublicCaller() {
    return appRouter.createCaller({
      user: null,
      req: { headers: {} },
      res: {},
    } as never);
  }

  async function analyzeGuestReceipt() {
    return createPublicCaller().cases.guestAnalyzeDocument({
      fileName: "recibo-camreflex.pdf",
      mimeType: "application/pdf",
      base64Content: buildPrintablePayrollPdf(),
      sourceChannel: "manual",
    });
  }

  it("consulta IMSS y SAT sin cuenta usando el recibo de invitado", async () => {
    const preview = await analyzeGuestReceipt();
    const result = await createPublicCaller().cases.guestOfficialCheck({
      guestPreviewToken: preview.guestPreviewToken,
      consentGranted: true,
    });

    expect(result.officialCheck.consentGranted).toBe(true);
    expect(result.officialCheck.identity.nss).toBe(true);
    expect(result.officialCheck.overallStatus).toBe("no_configurado");
    expect(result.officialCheckHeadline).toMatch(/Aún no configurado|Faltan datos|Falta tu permiso|Todavía faltan respuestas|Hoy no se pudo comprobar|Aún no te podemos decir/);
    expect(result.officialCheckConsent).toMatch(/Autorizo que pregunten a IMSS y SAT/);
    expect(JSON.stringify(result)).not.toMatch(/Helios|CompliLink|HMAC|Manus|OTP/i);
  });

  it("rechaza un token inválido y no exige iniciar sesión", async () => {
    await expect(
      createPublicCaller().cases.guestOfficialCheck({
        guestPreviewToken: `${"x".repeat(40)}.invalido`,
        consentGranted: true,
      }),
    ).rejects.toThrow(/vista previa temporal/i);
  });

  it("limita consultas repetidas del mismo recibo de invitado", async () => {
    const preview = await analyzeGuestReceipt();
    const caller = createPublicCaller();

    for (let index = 0; index < 3; index += 1) {
      const result = await caller.cases.guestOfficialCheck({
        guestPreviewToken: preview.guestPreviewToken,
        consentGranted: true,
      });
      expect(result.officialCheck.identity.nss).toBe(true);
    }

    await expect(
      caller.cases.guestOfficialCheck({
        guestPreviewToken: preview.guestPreviewToken,
        consentGranted: true,
      }),
    ).rejects.toThrow(/demasiadas consultas/i);
  });

  it("sigue en espera si el invitado ya consultó y el hecho todavía no llega", async () => {
    const preview = await analyzeGuestReceipt();
    const token = readGuestPreviewToken(preview.guestPreviewToken);
    rememberGuestOfficialSession({
      guestPreviewId: token.guestPreviewId,
      traceId: token.traceId,
      officialCheck: null,
    });

    const pending = await createPublicCaller().cases.guestOfficialFact({
      guestPreviewToken: preview.guestPreviewToken,
    });
    expect(pending.awaiting).toBe(true);
    expect(pending.notice).toBeNull();
    expect(pending.officialCheck).toBeNull();
  });

  it("entrega el hecho IMSS tardío al mismo token de invitado, sin cuenta y sin correo", async () => {
    const preview = await analyzeGuestReceipt();
    const caller = createPublicCaller();
    await caller.cases.guestOfficialCheck({
      guestPreviewToken: preview.guestPreviewToken,
      consentGranted: true,
    });

    const waiting = await caller.cases.guestOfficialFact({
      guestPreviewToken: preview.guestPreviewToken,
    });
    expect(waiting.notice).toBeNull();
    expect(waiting.awaiting).toBe(false);
    expect(waiting.officialCheck?.overallStatus).toBe("no_configurado");

    const token = readGuestPreviewToken(preview.guestPreviewToken);
    const arrivedAt = "2026-09-24T18:01:10.000Z";
    const officialCheck: OfficialCheckSummary = {
      configured: true,
      consentGranted: true,
      overallStatus: "vivo",
      overallLabel: "Hay respuesta",
      overallDetail: "Llegó un dato del IMSS.",
      checkedAt: arrivedAt,
      identity: { nss: true, curp: false, rfc: false },
      checks: [
        {
          source: "imss",
          sourceLabel: "IMSS",
          status: "vivo",
          label: "IMSS",
          detail: "Dato del IMSS.",
          checkedAt: arrivedAt,
          used: { nss: true, curp: false, rfc: false },
          honesty: "live",
          hechos: ["Hay un movimiento de alta en el IMSS."],
        },
      ],
    };
    persistGuestOfficialFact({
      lookupIds: [token.traceId, token.guestPreviewId],
      officialCheck,
      arrivedAt,
    });

    const arrived = await caller.cases.guestOfficialFact({
      guestPreviewToken: preview.guestPreviewToken,
    });
    expect(arrived.notice).toBe(OFFICIAL_FACT_ARRIVED_NOTICE);
    expect(arrived.arrivedAt).toBe(arrivedAt);
    expect(arrived.officialCheck?.checks.find((item) => item.source === "imss")?.hechos).toEqual([
      "Hay un movimiento de alta en el IMSS.",
    ]);
    expect(JSON.stringify(arrived)).not.toMatch(/syntage|cumple|@/i);
  });
});

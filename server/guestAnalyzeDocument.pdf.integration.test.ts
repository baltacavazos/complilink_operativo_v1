import { describe, expect, it, vi } from "vitest";

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

const { appRouter } = await import("./routers");

function buildPrintablePayrollPdf() {
  const lines = [
    "REPRESENTACION IMPRESA DE CFDI NOMINA",
    "RAZON SOCIAL: EVOLUCION CREATIVA CAMREFLEX S.A. DE C.V.",
    "RFC: ECC190605VA1",
    "REGISTRO PATRONAL: R1379389106",
    "NSS 84129214965",
    "PERIODO 2026-05-01 AL 2026-05-15",
    "001 SALARIO 4,725.60",
    "TOTAL PERCEPCIONES 4,725.60",
    "TOTAL DEDUCCIONES 0.00",
  ];
  const stream = ["BT", "/F1 11 Tf", "72 760 Td", ...lines.flatMap((line, index) => [index ? "0 -22 Td" : "", `(${line}) Tj`].filter(Boolean)), "ET"].join("\n");
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
    expect(storageMocks.storagePut).toHaveBeenCalledTimes(1);
  });
});

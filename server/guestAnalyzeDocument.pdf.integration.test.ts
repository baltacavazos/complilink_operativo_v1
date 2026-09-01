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

import { describe, expect, it } from "vitest";
import {
  DOCUMENT_SIGNAL_DISCLAIMER,
  extractLaborFiscalSignalsFromDocument,
  summarizeLaborFiscalSignals,
} from "./laborFiscalSignals";

describe("laborFiscalSignals", () => {
  it("lee IMSS, ISR e Infonavit desde un recibo o CFDI sin fingir consulta en vivo", () => {
    const snapshot = extractLaborFiscalSignalsFromDocument({
      documentType: "payroll_receipt",
      originalName: "recibo-abril.pdf",
      heliosOpinion: {
        rawPayload: {
          preliminaryAnalysis: {
            confirmedData: {
              payrollNss: "12345678901",
              payrollEmployerRegistration: "Y1234567890",
              imssWithheld: "$120.50",
              isrWithheld: "$310.00",
              infonavitWithheld: "$530.99",
              hasInfonavitSignal: true,
              infonavitDeductionType: "010",
            },
            estimatedData: {
              socialSecurityBaseSalary: "331.45",
              integratedDailySalary: "331.45",
            },
          },
        },
      },
    });

    expect(snapshot).toMatchObject({
      liveImssValidation: false,
      source: "document_text",
      validationMode: "document_signals",
      hasImssDocument: false,
      hasImssLaborSignal: true,
      hasInfonavitSignal: true,
      hasFiscalSignal: true,
      hasNss: true,
      hasSbc: true,
    });
    expect(DOCUMENT_SIGNAL_DISCLAIMER).toMatch(/no consulta IMSS/i);
  });

  it("no inventa señal IMSS cuando el CFDI solo trae Infonavit", () => {
    const snapshot = extractLaborFiscalSignalsFromDocument({
      documentType: "cfdi",
      originalName: "hector_cfdi.xml",
      heliosOpinion: {
        rawPayload: {
          preliminaryAnalysis: {
            confirmedData: {
              hasInfonavitSignal: true,
              infonavitDeductionType: "010",
            },
          },
        },
      },
    });

    expect(snapshot.hasImssLaborSignal).toBe(false);
    expect(snapshot.hasInfonavitSignal).toBe(true);
    expect(snapshot.liveImssValidation).toBe(false);
  });

  it("cuenta un soporte IMSS como señal documental y un recibo con NSS como otra", () => {
    const summary = summarizeLaborFiscalSignals([
      {
        documentType: "imss",
        originalName: "alta_imss.pdf",
      },
      {
        documentType: "cfdi",
        originalName: "nomina.xml",
        preliminaryAnalysis: {
          confirmedData: {
            payrollNss: "12345678901",
            imssWithheld: "$0.00",
          },
        },
      },
    ]);

    expect(summary.liveImssValidation).toBe(false);
    expect(summary.imssDocumentsCount).toBe(1);
    expect(summary.imssSignalsCount).toBe(2);
    expect(summary.hasImssSignal).toBe(true);
    expect(summary.hasInfonavitSignal).toBe(false);
  });
});

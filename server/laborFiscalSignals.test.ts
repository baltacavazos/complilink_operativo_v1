import { describe, expect, it } from "vitest";
import {
  DOCUMENT_SIGNAL_DISCLAIMER,
  LOCAL_REVIEW_LABEL,
  REMOTE_REVIEW_LABEL,
  describeWorkerReviewSource,
  extractLaborFiscalSignalsFromDocument,
  pickPreferredWorkerOpinion,
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

  it("arma hechos estructurados y explicaciones en español desde periodo, montos, RFC y NSS", () => {
    const snapshot = extractLaborFiscalSignalsFromDocument({
      documentType: "cfdi",
      originalName: "nomina.xml",
      preliminaryAnalysis: {
        confirmedData: {
          mimeType: "application/xml",
          processingProfile: "expanded",
          hasInfonavitSignal: true,
          payrollPeriod: "2026-05-01 al 2026-05-15",
          payrollNetAmount: "$4,725.60",
          payrollPerceptions: "$4,725.60",
          payrollDeductions: "$0.00",
          employerRfc: "ECC190605VA1",
          workerRfc: "XOXX010101000",
          payrollNss: "84129214965",
          isrWithheld: "$0.00",
          imssWithheld: "$0.00",
        },
      },
    });

    expect(snapshot.facts).toMatchObject({
      period: "2026-05-01 al 2026-05-15",
      netAmount: "$4,725.60",
      perceptions: "$4,725.60",
      deductions: "$0.00",
      employerRfc: "ECC190605VA1",
      workerRfc: "XOXX010101000",
      nss: "84129214965",
      isrWithheld: "$0.00",
      imssWithheld: "$0.00",
    });
    expect(snapshot.explanations.map((item) => item.summary).join(" ")).toMatch(/periodo que se alcanza a leer/i);
    expect(snapshot.explanations.map((item) => item.summary).join(" ")).toMatch(/RFC del patrón/i);
    expect(snapshot.explanations.map((item) => item.summary).join(" ")).toMatch(/NSS 84129214965/);
    expect(snapshot.explanations.map((item) => item.summary).join(" ")).toMatch(/no consulta IMSS/i);
    expect(snapshot.explanations.map((item) => `${item.label} ${item.summary}`).join(" ")).not.toMatch(
      /application\/xml|expanded|hasInfonavitSignal|mimeType/i,
    );
    expect(snapshot.liveImssValidation).toBe(false);
  });

  it("no filtra MIME, enums ni banderas de sistema como si fueran hechos del recibo", () => {
    const snapshot = extractLaborFiscalSignalsFromDocument({
      documentType: "payroll_receipt",
      preliminaryAnalysis: {
        confirmedData: {
          mimeType: "application/pdf",
          internalDocumentType: "payroll_receipt",
          processingProfile: "standard",
          hasInfonavitSignal: false,
          eventName: "document.processed.v1",
          payrollPeriod: "septiembre 2026",
        },
      },
    });

    expect(snapshot.facts.period).toBe("septiembre 2026");
    expect(Object.values(snapshot.facts).filter(Boolean)).toEqual(["septiembre 2026"]);
    expect(snapshot.explanations.some((item) => /septiembre 2026/.test(item.summary))).toBe(true);
    expect(JSON.stringify(snapshot.facts)).not.toMatch(/application\/pdf|payroll_receipt|document\.processed/);
  });

  it("prefiere la opinión remota cuando el cerebro ya devolvió lectura y etiqueta el mock como revisión local", () => {
    const local = {
      mode: "mock",
      status: "completed",
      summary: "Plantilla local del recibo.",
      legalOpinion: "Lectura de plantilla.",
    };
    const remote = {
      mode: "remote",
      status: "completed",
      summary: "El asesor laboral ya terminó esta lectura.",
      legalOpinion: "Ya hay una lectura consolidada del recibo.",
    };

    expect(pickPreferredWorkerOpinion([local, remote])).toMatchObject({
      mode: "remote",
      legalOpinion: "Ya hay una lectura consolidada del recibo.",
    });
    expect(describeWorkerReviewSource(local)).toMatchObject({
      reviewSource: "local",
      reviewSourceLabel: LOCAL_REVIEW_LABEL,
    });
    expect(describeWorkerReviewSource(remote)).toMatchObject({
      reviewSource: "remote",
      reviewSourceLabel: REMOTE_REVIEW_LABEL,
    });
    expect(describeWorkerReviewSource(local).reviewSourceExplanation).toMatch(/revisión local/i);
    expect(describeWorkerReviewSource(local).reviewSourceExplanation).not.toMatch(/Helios|CompliLink|mock/i);
    expect(describeWorkerReviewSource(remote).reviewSourceExplanation).not.toMatch(/Helios|CompliLink|mock/i);
  });

  it("marca el expediente como revisión local si solo hay plantilla y no inventa portal IMSS", () => {
    const summary = summarizeLaborFiscalSignals([
      {
        documentType: "cfdi",
        heliosOpinion: {
          mode: "mock",
          status: "completed",
          summary: "Plantilla local.",
          rawPayload: {
            preliminaryAnalysis: {
              confirmedData: {
                payrollPeriod: "2026-04-01 al 2026-04-15",
                employerRfc: "GEX010101AAA",
                payrollNss: "12345678901",
              },
            },
          },
        },
      },
    ]);

    expect(summary.reviewSource).toBe("local");
    expect(summary.reviewSourceLabel).toBe(LOCAL_REVIEW_LABEL);
    expect(summary.facts.period).toBe("2026-04-01 al 2026-04-15");
    expect(summary.facts.employerRfc).toBe("GEX010101AAA");
    expect(summary.facts.nss).toBe("12345678901");
    expect(summary.liveImssValidation).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { buildHeliosCalculatorSnapshot } from "./heliosCalculatorService";

describe("buildHeliosCalculatorSnapshot", () => {
  it("construye el cruce más reciente, el histórico comparable y la guía legal a partir de nómina y CFDI del mismo periodo", () => {
    const snapshot = buildHeliosCalculatorSnapshot([
      {
        documentId: "payroll-abril",
        originalName: "recibo_abril.pdf",
        documentType: "payroll_receipt",
        createdAt: "2026-04-10T10:00:00.000Z",
        heliosOpinion: {
          generatedAt: "2026-04-10T10:05:00.000Z",
          legalOpinion:
            "La lectura preliminar sugiere revisar si el pago documentado coincide con el CFDI del mismo mes.",
          recommendedNextStep:
            "Sube o contrasta el CFDI del mismo periodo para confirmar si la diferencia es repetida.",
          recommendedActions: [
            "Comparar conceptos y deducciones del mismo mes",
            "Guardar evidencia bancaria del periodo",
          ],
          legalHighlights: {
            primaryConcern: "Existe una diferencia visible que todavía debe contrastarse.",
          },
          disclaimer:
            "La calculadora orienta la revisión del expediente y no sustituye asesoría personalizada.",
          rawPayload: {
            preliminaryAnalysis: {
              confirmedData: {
                period: "2026-04",
                apparentAmount: "12000.00",
              },
              estimatedData: {},
            },
          },
        },
      },
      {
        documentId: "cfdi-abril",
        originalName: "cfdi_abril.xml",
        documentType: "cfdi",
        createdAt: "2026-04-11T09:00:00.000Z",
        heliosOpinion: {
          generatedAt: "2026-04-11T09:03:00.000Z",
          legalOpinion:
            "Lo timbrado fiscalmente puede usarse para contrastar lo realmente pagado durante el periodo.",
          recommendedNextStep:
            "Revisar si la diferencia también aparece en depósitos o en el siguiente recibo.",
          recommendedActions: ["Revisar si la diferencia también aparece en depósitos o en el siguiente recibo."],
          legalHighlights: {
            primaryConcern: "El CFDI no coincide con la nómina visible.",
          },
          disclaimer:
            "La calculadora orienta la revisión del expediente y no sustituye asesoría personalizada.",
          rawPayload: {
            preliminaryAnalysis: {
              confirmedData: {
                period: "2026-04",
                apparentAmount: "11000.00",
              },
              estimatedData: {},
            },
          },
        },
      },
      {
        documentId: "payroll-marzo",
        originalName: "recibo_marzo.pdf",
        documentType: "payroll_receipt",
        createdAt: "2026-03-10T10:00:00.000Z",
        heliosOpinion: {
          generatedAt: "2026-03-10T10:05:00.000Z",
          legalOpinion:
            "Sirve como referencia para comparar otro periodo.",
          recommendedNextStep:
            "Completar el cruce con CFDI del mismo mes.",
          recommendedActions: ["Completar el cruce con CFDI del mismo mes."],
          legalHighlights: {
            primaryConcern: null,
          },
          disclaimer:
            "La calculadora orienta la revisión del expediente y no sustituye asesoría personalizada.",
          rawPayload: {
            preliminaryAnalysis: {
              confirmedData: {
                period: "2026-03",
                apparentAmount: "10800.00",
              },
              estimatedData: {},
            },
          },
        },
      },
    ]);

    expect(snapshot.status).toBe("ready");
    expect(snapshot.latestComparison).not.toBeNull();
    expect(snapshot.latestComparison?.periodLabel).toBe("2026-04");
    expect(snapshot.latestComparison?.differenceAmount).toBe(1000);
    expect(snapshot.latestComparison?.direction).toBe("payroll_above");
    expect(snapshot.history).toHaveLength(2);
    expect(snapshot.history[1]).toMatchObject({
      periodLabel: "2026-03",
      direction: "incomplete",
      payrollAmount: 10800,
      cfdiAmount: null,
    });
    expect(snapshot.legalExplanation).toMatchObject({
      headline: "Qué significa jurídicamente el cruce de 2026-04",
    });
    expect(snapshot.legalExplanation?.actionItems).toContain(
      "Comparar conceptos y deducciones del mismo mes"
    );
  });
});

import { describe, expect, it } from "vitest";

import {
  FIVE_SECOND_DISCLAIMER,
  selectFiveSecondVerdict,
  selectFiveSecondVerdictFromReceipt,
} from "./fiveSecondVerdict";

describe("veredicto de 5 segundos", () => {
  it("elige bien cuando el recibo se leyó claro y no hay diferencia", () => {
    const verdict = selectFiveSecondVerdict({
      hasEmployer: true,
      hasPeriod: true,
      hasPayment: true,
      classificationConfidence: 88,
      riskLevel: "low",
    });

    expect(verdict.seen).toBe("bien");
    expect(verdict.seenLine).toBe("Esto vimos: bien");
    expect(verdict.nextStepLine).toBe(
      "Qué hacer ahora: Sube el CFDI del mismo periodo para comparar lo timbrado con lo que te pagaron.",
    );
    expect(verdict.disclaimer).toBe(FIVE_SECOND_DISCLAIMER);
    expect(verdict.disclaimer).not.toMatch(/Helios|CompliLink|APIMarket|connector/i);
  });

  it("elige hay diferencia cuando hay riesgo o una señal de descuadre", () => {
    const byRisk = selectFiveSecondVerdict({
      hasEmployer: true,
      hasPeriod: true,
      hasPayment: true,
      riskLevel: "high",
    });
    const bySignal = selectFiveSecondVerdict({
      hasEmployer: true,
      hasPeriod: true,
      hasPayment: true,
      hasDifferenceSignal: true,
    });

    expect(byRisk.seen).toBe("hay_diferencia");
    expect(byRisk.seenLine).toBe("Esto vimos: hay diferencia");
    expect(byRisk.nextStep).toMatch(/pide el desglose por escrito/i);
    expect(bySignal.seen).toBe("hay_diferencia");
  });

  it("elige no se leyó cuando faltan los datos del recibo", () => {
    const empty = selectFiveSecondVerdict({});
    const weak = selectFiveSecondVerdict({
      hasPayment: true,
      classificationConfidence: 20,
    });

    expect(empty.seen).toBe("no_se_leyo");
    expect(empty.seenLine).toBe("Esto vimos: no se leyó");
    expect(empty.nextStep).toMatch(/foto más clara/i);
    expect(weak.seen).toBe("no_se_leyo");
  });

  it("si el recibo está bien y hay NSS, el paso único es consultar IMSS y SAT", () => {
    const verdict = selectFiveSecondVerdictFromReceipt({
      employer: "Taller del Sur",
      period: "1 al 15 de mayo",
      payment: "$4,200",
      nss: "12345678901",
      classificationConfidence: 90,
    });

    expect(verdict.seen).toBe("bien");
    expect(verdict.nextStep).toBe(
      "Consulta IMSS y SAT con tu permiso para ver si tu alta aparece hoy.",
    );
    expect(verdict.nextStepLine.startsWith("Qué hacer ahora:")).toBe(true);
  });

  it("nunca inventa que el patrón cumple", () => {
    const verdicts = [
      selectFiveSecondVerdict({ hasEmployer: true, hasPeriod: true, hasPayment: true }),
      selectFiveSecondVerdict({ hasDifferenceSignal: true, hasPeriod: true, hasPayment: true }),
      selectFiveSecondVerdict({}),
    ];

    for (const verdict of verdicts) {
      const blob = `${verdict.seenLine} ${verdict.nextStepLine} ${verdict.disclaimer}`;
      expect(blob).not.toMatch(/\bcumple\b/i);
      expect(blob).not.toMatch(/dictamen jurídico|valor probatorio|Helios|CompliLink/i);
    }
  });
});

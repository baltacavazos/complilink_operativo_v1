import { describe, expect, it } from "vitest";

import { reconcilePayrollDeductions } from "./payrollAmounts";

describe("deducciones del recibo", () => {
  it("el recibo de prueba siempre da $540 = 6500 − 5960", () => {
    for (const wrong of ["$540.00", "$160.00", "$380.00", null, "$0.00"]) {
      const result = reconcilePayrollDeductions({
        perceptions: "$6,500.00",
        netAmount: "$5,960.00",
        deductions: wrong,
        listed: ["$380.00", "$160.00"],
      });
      expect(result.deductions).toBe("$540.00");
    }
  });

  it("marca calculado cuando el total leído no cuadra", () => {
    const result = reconcilePayrollDeductions({
      perceptions: "6500",
      netAmount: "5960",
      deductions: "$160.00",
      listed: ["$160.00"],
    });
    expect(result).toEqual({ deductions: "$540.00", calculated: true });
  });
});

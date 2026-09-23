import { describe, expect, it } from "vitest";

import { buildReceiptFactSlots } from "./ReceiptFactSkeleton";

describe("huecos del recibo", () => {
  it("no pone un expediente ni un RFC en el lugar del emisor", () => {
    const slots = buildReceiptFactSlots({
      employer: "EXPEDIENTE UIPD9211257I0",
      employerRfc: "UIPD9211257I0",
      payment: "$1,200.00",
      period: "01/05/2026 al 15/05/2026",
      estatus: null,
    });
    expect(slots.emisor).toBeNull();
    expect(slots.monto).toBe("$1,200.00");
    expect(slots.fecha).toBe("01/05/2026 al 15/05/2026");
    expect(slots.estatus).toBeNull();
  });

  it("conserva la razón social cuando sí es un nombre", () => {
    const slots = buildReceiptFactSlots({
      employer: "Taller Norte SA de CV",
      payment: "$800.00",
      period: "mayo 2026",
      estatus: "RFC: UIPD9211257I0",
    });
    expect(slots.emisor).toBe("Taller Norte SA de CV");
    expect(slots.estatus).toBe("RFC: UIPD9211257I0");
    expect(slots.estatus).not.toMatch(/\bcumple\b/i);
  });
});

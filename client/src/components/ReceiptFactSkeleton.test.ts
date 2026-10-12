import { describe, expect, it } from "vitest";

import { buildReceiptFactSlots, receiptFactDisplayValue } from "./ReceiptFactSkeleton";

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

  it("un monto o periodo vacío dice que no se alcanzó a leer", () => {
    expect(receiptFactDisplayValue("monto", null, true)).toBe("No se alcanzó a leer");
    expect(receiptFactDisplayValue("fecha", null, true)).toBe("No se alcanzó a leer");
    expect(receiptFactDisplayValue("emisor", null, true)).toBe("No se alcanzó a leer");
    expect(receiptFactDisplayValue("monto", "$3,519.50", true)).toBe("$3,519.50");
    expect(receiptFactDisplayValue("monto", null, false)).toBeNull();
  });

  it("un monto que no es dinero se ve como no leído", () => {
    const slots = buildReceiptFactSlots({
      employer: "Taller El Roble SA de CV",
      payment: "N/A",
      period: "01/09/2026 al 15/09/2026",
    });
    expect(slots.emisor).toBe("Taller El Roble SA de CV");
    expect(slots.fecha).toBe("01/09/2026 al 15/09/2026");
    expect(slots.monto).toBeNull();
    expect(receiptFactDisplayValue("monto", slots.monto, true)).toBe("No se alcanzó a leer");
  });
});

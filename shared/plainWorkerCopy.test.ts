import { describe, expect, it } from "vitest";

import { toPlainWorkerLandingCopy } from "./plainWorkerCopy";

describe("toPlainWorkerLandingCopy", () => {
  it("cambia expediente por tu caso, tu consulta o palabras de recibo", () => {
    expect(toPlainWorkerLandingCopy("luego lo guardas en tu expediente.")).toBe(
      "luego lo guardas en tu caso.",
    );
    expect(toPlainWorkerLandingCopy("Guardar ahora en mi expediente")).toBe(
      "Guardar ahora en mi caso",
    );
    expect(toPlainWorkerLandingCopy("dentro del expediente.")).toBe("dentro de tu caso.");
    expect(toPlainWorkerLandingCopy("antes de abrir expediente.")).toBe("antes de abrir caso.");
    expect(toPlainWorkerLandingCopy("Tu expediente digital sigue listo.")).toBe(
      "Tu caso sigue listo.",
    );
    expect(toPlainWorkerLandingCopy("Hay 2 expedientes activos.")).toBe("Hay 2 casos activos.");
    expect(toPlainWorkerLandingCopy("Tu recibo ya está en tu consulta.")).toBe(
      "Tu recibo ya está en tu consulta.",
    );
  });

  it("no deja la palabra expediente", () => {
    const samples = [
      "Tu expediente en crecimiento",
      "Basado en tu expediente",
      "un expediente digital simple y privado",
      "El expediente ya muestra piezas",
      "documentos del expediente laboral",
    ];

    for (const sample of samples) {
      expect(toPlainWorkerLandingCopy(sample)).not.toMatch(/expediente/i);
    }
  });
});
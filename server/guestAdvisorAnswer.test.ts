import { describe, expect, it } from "vitest";

import { answerGuestAdvisor } from "./guestAdvisorAnswer";

const hector = {
  perceptions: "$6,500.00",
  netAmount: "$5,960.00",
  deductions: "$160.00",
  isrWithheld: "$380.00",
  imssWithheld: "$160.00",
  employerName: "EVOLUCION CREATIVA CAMREFLEX",
  workerName: "HECTOR JOVANE ORTIZ HERNANDEZ",
};

describe("asesor de invitado", () => {
  it("contesta el descuento de 540 y si el IMSS ya lo tiene", () => {
    const answer = answerGuestAdvisor({
      prompt: "¿me descontaron 540, es legal? ¿me tiene en el IMSS?",
      facts: hector,
      officialCheck: {
        configured: true,
        consentGranted: true,
        overallStatus: "vivo",
        overallLabel: "Contestó",
        overallDetail: "",
        checkedAt: "2026-10-19T18:00:00.000Z",
        identity: { nss: true, curp: true, rfc: true },
        checks: [
          {
            source: "sat",
            sourceLabel: "SAT",
            status: "vivo",
            label: "Contestó",
            detail: "",
            checkedAt: "2026-10-19T18:00:00.000Z",
            used: { nss: false, curp: false, rfc: true },
            hechos: ["Nombre en el SAT: HECTOR JOVANE ORTIZ HERNANDEZ."],
          },
          {
            source: "imss",
            sourceLabel: "IMSS",
            status: "pendiente",
            label: "Pendiente",
            detail: "",
            checkedAt: null,
            used: { nss: true, curp: true, rfc: false },
            hechos: [],
          },
        ],
      },
    });

    expect(answer).toContain("Tus $540.00 son ISR $380.00 (impuesto) e IMSS $160.00 (tu cuota del seguro).");
    expect(answer).toContain("Los dos los marca la ley.");
    expect(answer).toContain("El IMSS todavía no contesta");
    expect(answer).not.toMatch(/\bcumple\b/i);
    expect(answer).not.toMatch(/primera lectura útil|sube el CFDI/i);
  });

  it("cita el IMSS cuando ya contestó y no inventa el alta", () => {
    const answer = answerGuestAdvisor({
      prompt: "¿mi patrón sí me tiene en el IMSS?",
      facts: hector,
      officialCheck: {
        configured: true,
        consentGranted: true,
        overallStatus: "vivo",
        overallLabel: "Contestó",
        overallDetail: "",
        checkedAt: "2026-10-19T18:10:00.000Z",
        identity: { nss: true, curp: true, rfc: true },
        checks: [
          {
            source: "imss",
            sourceLabel: "IMSS",
            status: "vivo",
            honesty: "live",
            label: "Contestó",
            detail: "",
            checkedAt: "2026-10-19T18:10:00.000Z",
            used: { nss: true, curp: true, rfc: false },
            hechos: ["Salario registrado: $331.45.", "Fecha de alta reportada: 2023-09-01."],
          },
        ],
      },
    });
    expect(answer).toContain("El IMSS ya contestó.");
    expect(answer).toContain("$331.45");
    expect(answer).not.toMatch(/\bcumple\b/i);
  });

  it("Infonavit sin respuesta no se inventa", () => {
    const answer = answerGuestAdvisor({
      prompt: "¿y mi Infonavit?",
      facts: hector,
    });
    expect(answer).toMatch(/Infonavit no contestó/i);
    expect(answer).not.toMatch(/\bcumple\b/i);
  });
});

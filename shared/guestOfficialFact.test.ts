import { describe, expect, it } from "vitest";

import {
  GUEST_OFFICIAL_FACT_ARRIVED_KIND,
  GUEST_OFFICIAL_FACT_CLOSED_TAB_LIMIT,
  GUEST_OFFICIAL_FACT_WAIT_MS,
  guestOfficialFactStillWaiting,
  isOfficialFactArrivedKind,
  listGuestVisibleImssFacts,
  listGuestVisibleInfonavitFacts,
  listGuestVisibleOfficialFacts,
} from "./guestOfficialFact";
import { OFFICIAL_FACT_ARRIVED_NOTICE, OFFICIAL_WAIT_STILL_TRYING } from "./officialCheckCopy";
import type { OfficialCheckSummary } from "./officialCheckCopy";
import { OFFICIAL_RESULT_NOTIFICATION_KIND } from "./officialResultNotification";

function sourceCheck(
  source: "imss" | "sat" | "infonavit",
  hechos: string[],
  status: OfficialCheckSummary["overallStatus"] = "vivo",
): OfficialCheckSummary["checks"][number] {
  const live = status === "vivo";
  return {
    source,
    sourceLabel: source === "imss" ? "IMSS" : source === "sat" ? "SAT" : "Infonavit",
    status: status === "pendiente" ? "pendiente" : live ? "vivo" : status,
    label: sourceLabel(source),
    detail: "Dato de la consulta.",
    checkedAt: "2026-09-24T18:00:00.000Z",
    used: { nss: source === "imss", curp: source === "infonavit", rfc: source === "sat" },
    honesty: status === "pendiente" ? "pending" : live ? "live" : "failed",
    hechos,
  };
}

function sourceLabel(source: "imss" | "sat" | "infonavit") {
  if (source === "imss") return "IMSS";
  if (source === "sat") return "SAT";
  return "Infonavit";
}

function factSummary(
  checks: OfficialCheckSummary["checks"],
  status: OfficialCheckSummary["overallStatus"] = "vivo",
): OfficialCheckSummary {
  return {
    configured: true,
    consentGranted: true,
    overallStatus: status,
    overallLabel: "Hay respuesta",
    overallDetail: "Llegó un dato oficial.",
    checkedAt: "2026-09-24T18:00:00.000Z",
    identity: { nss: true, curp: true, rfc: false },
    checks,
  };
}

function imssFact(hechos: string[], status: OfficialCheckSummary["overallStatus"] = "vivo"): OfficialCheckSummary {
  return factSummary([sourceCheck("imss", hechos, status)], status);
}

describe("guest official fact", () => {
  it("reconoce el followup tardío y el aviso ya cableado", () => {
    expect(isOfficialFactArrivedKind(GUEST_OFFICIAL_FACT_ARRIVED_KIND)).toBe(true);
    expect(isOfficialFactArrivedKind(OFFICIAL_RESULT_NOTIFICATION_KIND)).toBe(true);
    expect(isOfficialFactArrivedKind("document.processed.v1")).toBe(false);
    expect(OFFICIAL_FACT_ARRIVED_NOTICE).toBe("Ya hay un resultado de tu consulta.");
    expect(OFFICIAL_WAIT_STILL_TRYING).toBe("Seguimos intentando. Te avisamos cuando haya resultado.");
  });

  it("el límite de cerrar la pestaña no trae datos personales ni un cumple", () => {
    expect(GUEST_OFFICIAL_FACT_CLOSED_TAB_LIMIT).toMatch(/cierras esta pestaña/i);
    expect(GUEST_OFFICIAL_FACT_CLOSED_TAB_LIMIT).toMatch(/recargas esta misma pestaña/i);
    expect(GUEST_OFFICIAL_FACT_CLOSED_TAB_LIMIT).not.toMatch(/syntage|cumple|semáforo|semaforo|@|nss|curp|rfc/i);
    expect(GUEST_OFFICIAL_FACT_CLOSED_TAB_LIMIT).not.toMatch(/\d{10,}/);
  });

  it("sigue esperando un fallo sincrónico y se detiene si ya hay hecho o se acabó la ventana", () => {
    const now = Date.parse("2026-09-24T18:01:00.000Z");
    const pending = imssFact([], "pendiente");
    pending.overallStatus = "pendiente";
    pending.checks[0].status = "pendiente";
    pending.checks[0].honesty = "pending";
    pending.checks[0].hechos = [];
    expect(guestOfficialFactStillWaiting(pending, now)).toBe(true);

    const failed = { ...pending, overallStatus: "no_se_pudo" as const, checks: [{ ...pending.checks[0], status: "no_se_pudo" as const, honesty: "failed" as const }] };
    expect(guestOfficialFactStillWaiting(failed, now)).toBe(true);
    expect(guestOfficialFactStillWaiting(failed, now + GUEST_OFFICIAL_FACT_WAIT_MS)).toBe(false);
    expect(guestOfficialFactStillWaiting(imssFact(["Hay un movimiento de alta en el IMSS."]), now)).toBe(false);
    expect(guestOfficialFactStillWaiting(null, now)).toBe(false);
  });

  it("lista el hecho IMSS usable sin inventar un cumple", () => {
    const lines = listGuestVisibleImssFacts(imssFact(["Hay un movimiento de alta en el IMSS."]));
    expect(lines).toEqual(["Hay un movimiento de alta en el IMSS."]);
    expect(lines.join(" ")).not.toMatch(/cumple|syntage|semáforo/i);
    expect(listGuestVisibleImssFacts(imssFact([]))).toEqual([]);
  });

  it("lista solo IMSS, solo Infonavit, o los dos, con tope de tres y sin inventar", () => {
    const imssOnly = factSummary([
      sourceCheck("imss", ["Hay un movimiento de alta en el IMSS."]),
      sourceCheck("infonavit", [], "no_se_pudo"),
    ]);
    expect(listGuestVisibleOfficialFacts(imssOnly)).toEqual({
      imss: ["Hay un movimiento de alta en el IMSS."],
      infonavit: [],
    });

    const infonavitOnly = factSummary([
      sourceCheck("imss", [], "no_se_pudo"),
      sourceCheck("infonavit", ["Hay un crédito de vivienda registrado."]),
    ]);
    expect(listGuestVisibleOfficialFacts(infonavitOnly)).toEqual({
      imss: [],
      infonavit: ["Hay un crédito de vivienda registrado."],
    });
    expect(listGuestVisibleInfonavitFacts(infonavitOnly)).toEqual(["Hay un crédito de vivienda registrado."]);

    const both = factSummary([
      sourceCheck("imss", ["Hay un movimiento de alta en el IMSS."]),
      sourceCheck("sat", ["Nombre en el SAT: EJEMPLO SA"]),
      sourceCheck("infonavit", [
        "Hay un crédito de vivienda registrado.",
        "Saldo de subcuenta de vivienda: 1000.",
        "Aportación de vivienda vista en la consulta.",
        "Cuarto dato que no cabe en la bandeja.",
      ]),
    ]);
    const listed = listGuestVisibleOfficialFacts(both);
    expect(listed.imss).toEqual(["Hay un movimiento de alta en el IMSS."]);
    expect(listed.infonavit).toEqual([
      "Hay un crédito de vivienda registrado.",
      "Saldo de subcuenta de vivienda: 1000.",
      "Aportación de vivienda vista en la consulta.",
    ]);
    expect(listed.infonavit.join(" ")).not.toMatch(/cumple|al corriente|syntage|semáforo/i);
    expect(JSON.stringify(listed)).not.toContain("EJEMPLO SA");
  });

  it("no inventa un hecho Infonavit si el webhook no lo trajo o la fuente no contestó", () => {
    const failed = factSummary([
      sourceCheck("infonavit", ["Infonavit no respondió en esta consulta."], "no_se_pudo"),
    ]);
    expect(listGuestVisibleInfonavitFacts(failed)).toEqual([]);
    expect(
      listGuestVisibleInfonavitFacts(
        factSummary([
          sourceCheck("infonavit", ["Todavía no hay una respuesta oficial nueva de Infonavit."], "vivo"),
        ]),
      ),
    ).toEqual([]);
    expect(listGuestVisibleInfonavitFacts(null)).toEqual([]);
  });
});

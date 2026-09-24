import { describe, expect, it } from "vitest";

import {
  GUEST_OFFICIAL_FACT_ARRIVED_KIND,
  GUEST_OFFICIAL_FACT_CLOSED_TAB_LIMIT,
  GUEST_OFFICIAL_FACT_WAIT_MS,
  guestOfficialFactStillWaiting,
  isOfficialFactArrivedKind,
  listGuestVisibleImssFacts,
} from "./guestOfficialFact";
import { OFFICIAL_FACT_ARRIVED_NOTICE, OFFICIAL_WAIT_STILL_TRYING } from "./officialCheckCopy";
import type { OfficialCheckSummary } from "./officialCheckCopy";
import { OFFICIAL_RESULT_NOTIFICATION_KIND } from "./officialResultNotification";

function imssFact(hechos: string[], status: OfficialCheckSummary["overallStatus"] = "vivo"): OfficialCheckSummary {
  return {
    configured: true,
    consentGranted: true,
    overallStatus: status,
    overallLabel: "Hay respuesta",
    overallDetail: "Llegó un dato del IMSS.",
    checkedAt: "2026-09-24T18:00:00.000Z",
    identity: { nss: true, curp: false, rfc: false },
    checks: [
      {
        source: "imss",
        sourceLabel: "IMSS",
        status: status === "pendiente" ? "pendiente" : "vivo",
        label: "IMSS",
        detail: "Dato del IMSS.",
        checkedAt: "2026-09-24T18:00:00.000Z",
        used: { nss: true, curp: false, rfc: false },
        honesty: status === "pendiente" ? "pending" : "live",
        hechos,
      },
    ],
  };
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
});

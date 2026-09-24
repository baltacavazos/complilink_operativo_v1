import { describe, expect, it } from "vitest";
import type { OfficialCheckSummary } from "./officialCheckCopy";
import {
  OFFICIAL_RESULT_NOTIFICATION_COPY,
  hasUsableOfficialFact,
  listUsableOfficialFacts,
} from "./officialResultNotification";

function summary(
  status: OfficialCheckSummary["overallStatus"],
  checks: OfficialCheckSummary["checks"],
): OfficialCheckSummary {
  return {
    configured: true,
    consentGranted: true,
    overallStatus: status,
    overallLabel: status,
    overallDetail: "",
    checkedAt: "2026-09-24T04:00:00.000Z",
    identity: { nss: true, curp: true, rfc: true },
    checks,
  };
}

describe("notificación durable de resultado oficial", () => {
  it("solo avisa cuando una fuente viva trae un hecho usable", () => {
    const pending = summary("pendiente", [
      {
        source: "sat",
        sourceLabel: "SAT",
        status: "pendiente",
        label: "Pendiente",
        detail: "Seguimos intentando.",
        checkedAt: null,
        used: { nss: false, curp: false, rfc: true },
        hechos: ["Todavía no hay una respuesta oficial nueva."],
      },
    ]);
    const emptyLive = summary("vivo", [
      {
        source: "sat",
        sourceLabel: "SAT",
        status: "vivo",
        label: "Contestó",
        detail: "Contestó.",
        checkedAt: "2026-09-24T04:00:00.000Z",
        used: { nss: false, curp: false, rfc: true },
        hechos: [],
      },
    ]);
    const usable = summary("vivo", [
      {
        source: "sat",
        sourceLabel: "SAT",
        status: "vivo",
        label: "Contestó",
        detail: "Contestó.",
        checkedAt: "2026-09-24T04:00:00.000Z",
        used: { nss: false, curp: false, rfc: true },
        hechos: ["RFC: UIPD9211257I0"],
      },
    ]);

    expect(hasUsableOfficialFact(pending)).toBe(false);
    expect(hasUsableOfficialFact(emptyLive)).toBe(false);
    expect(hasUsableOfficialFact(usable)).toBe(true);
    expect(listUsableOfficialFacts(usable)).toEqual(["RFC: UIPD9211257I0"]);
  });

  it("usa español simple, sin nombres de proveedores ni afirmar cumplimiento", () => {
    const copy = Object.values(OFFICIAL_RESULT_NOTIFICATION_COPY).join(" ");

    expect(copy).not.toMatch(
      /Resend|SendGrid|Helios|CompliLink|APIMarket|connector|provider|proveedor/i,
    );
    expect(copy).not.toMatch(/tu patrón (sí )?cumple|confirmamos que cumple/i);
    expect(copy).toContain("no prueba por sí solo");
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { SLOW_IMSS_WAIT_MS, type OfficialCheckSummary } from "@shared/officialCheckCopy";
import { guestOfficialFactStillWaiting } from "@shared/guestOfficialFact";

import { guestOfficialFactPollDelay } from "./useGuestOfficialFact";

const source = readFileSync(
  new URL("./useGuestOfficialFact.ts", import.meta.url),
  "utf8"
);

function pendingCheck(): OfficialCheckSummary {
  return {
    configured: true,
    consentGranted: true,
    overallStatus: "pendiente",
    overallLabel: "Pendiente",
    overallDetail: "Seguimos esperando.",
    checkedAt: new Date().toISOString(),
    identity: { nss: true, curp: false, rfc: false },
    checks: [
      {
        source: "imss",
        sourceLabel: "IMSS",
        status: "pendiente",
        label: "IMSS",
        detail: "Sin hecho todavía.",
        checkedAt: new Date().toISOString(),
        used: { nss: true, curp: false, rfc: false },
        honesty: "pending",
        hechos: [],
      },
    ],
  };
}

describe("useGuestOfficialFact transport", () => {
  it("pide el hecho por POST y no arma un GET con el token en la query", () => {
    expect(source).toContain("cases.guestOfficialFact.mutate");
    expect(source).not.toContain("guestOfficialFact.useQuery");
    expect(source).not.toContain(".useQuery(");
  });

  it("sigue preguntando mientras el hecho tarda y se detiene cuando ya no hay espera", () => {
    const pending = pendingCheck();
    expect(
      guestOfficialFactPollDelay({ awaiting: true, remote: null, local: null })
    ).toBe(4_000);
    expect(
      guestOfficialFactPollDelay({
        awaiting: false,
        remote: pending,
        local: null,
      })
    ).toBe(4_000);
    expect(
      guestOfficialFactPollDelay({
        awaiting: false,
        remote: null,
        local: pending,
      })
    ).toBe(4_000);
    expect(
      guestOfficialFactPollDelay({ awaiting: false, remote: null, local: null })
    ).toBe(false);

    const arrived = pendingCheck();
    arrived.overallStatus = "vivo";
    arrived.checks[0].status = "vivo";
    arrived.checks[0].honesty = "live";
    arrived.checks[0].hechos = ["Hay un movimiento de alta en el IMSS."];
    expect(
      guestOfficialFactPollDelay({
        awaiting: false,
        remote: arrived,
        local: arrived,
      })
    ).toBe(false);
    expect(
      guestOfficialFactPollDelay({
        awaiting: true,
        remote: arrived,
        local: arrived,
      })
    ).toBe(4_000);

    const satFirst = pendingCheck();
    satFirst.overallStatus = "vivo";
    satFirst.checks = [
      {
        ...satFirst.checks[0],
        source: "sat",
        sourceLabel: "SAT",
        status: "vivo",
        honesty: "live",
        hechos: ["El SAT confirmó el RFC consultado."],
      },
      {
        ...satFirst.checks[0],
        source: "imss",
        status: "pendiente",
        honesty: "pending",
        hechos: [],
      },
    ];
    satFirst.checkedAt = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    expect(guestOfficialFactStillWaiting(satFirst)).toBe(true);
    expect(
      guestOfficialFactPollDelay({ awaiting: false, remote: satFirst, local: satFirst })
    ).toBe(4_000);
    expect(SLOW_IMSS_WAIT_MS).toBeGreaterThan(10 * 60 * 1000);
  });
});

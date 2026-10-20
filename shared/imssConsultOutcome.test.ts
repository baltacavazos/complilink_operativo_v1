import { describe, expect, it } from "vitest";

import { guestOfficialFactStillWaiting } from "./guestOfficialFact";
import {
  IMSS_RECORD_NOT_FOUND_ACTION,
  IMSS_RECORD_NOT_FOUND_MESSAGE,
  IMSS_RECORD_NOT_FOUND_MEANING,
  IMSS_RECORD_NOT_FOUND_NEXT,
  OFFICIAL_PENDING_STALE_MS,
  OFFICIAL_WAIT_STILL_TRYING,
  SLOW_IMSS_WAIT_MS,
  assertNoInternalBrands,
  buildHonestOfficialPresentation,
  reconcileOfficialCheckWithIdentity,
  resolveOfficialCheckDisplay,
  shouldPollOfficialCheck,
  type OfficialCheckSummary,
  type OfficialSourceCheck,
} from "./officialCheckCopy";
import { hasUsableOfficialFact, officialImssArrivalSentence } from "./officialResultNotification";

const CHECKED = "2026-10-20T18:00:00.000Z";

function check(
  source: OfficialSourceCheck["source"],
  status: OfficialSourceCheck["status"],
  extra?: Partial<OfficialSourceCheck>,
): OfficialSourceCheck {
  return {
    source,
    sourceLabel: source === "imss" ? "IMSS" : source === "sat" ? "SAT" : "Infonavit",
    status,
    label: status,
    detail: extra?.detail ?? "",
    checkedAt: CHECKED,
    used: { nss: source === "imss", curp: true, rfc: source === "sat" },
    honesty: status === "vivo" ? "live" : status === "pendiente" ? "pending" : "failed",
    hechos: extra?.hechos ?? [],
    motivoFallo: extra?.motivoFallo ?? null,
    ...extra,
  };
}

function summary(checks: OfficialSourceCheck[], overall: OfficialCheckSummary["overallStatus"]): OfficialCheckSummary {
  return {
    configured: true,
    consentGranted: true,
    overallStatus: overall,
    overallLabel: overall,
    overallDetail: "",
    checkedAt: CHECKED,
    identity: { nss: true, curp: true, rfc: true },
    checks,
  };
}

function visible(value: string) {
  expect(value).not.toMatch(/\bFalló\b|\berror\b|\bcumple\b|ApiMarket|Consulta Única|Helios|\b400\b/i);
  expect(assertNoInternalBrands(value)).toBe(true);
}

describe("consulta IMSS: reintento y registro ausente", () => {
  it("mientras el reintento sigue abierto, el texto es de espera y no inventa un resultado", () => {
    const waiting = summary(
      [
        check("imss", "pendiente", { detail: OFFICIAL_WAIT_STILL_TRYING, honesty: "pending", motivoFallo: null }),
        check("sat", "vivo", { honesty: "live", hechos: ["El SAT contestó."] }),
        check("infonavit", "pendiente", { honesty: "pending" }),
      ],
      "pendiente",
    );
    const reconciled = reconcileOfficialCheckWithIdentity(waiting, waiting.identity, {
      nowMs: Date.parse(CHECKED) + OFFICIAL_PENDING_STALE_MS + 5_000,
    });
    const display = resolveOfficialCheckDisplay({
      consentGranted: true,
      summary: reconciled,
      identity: waiting.identity,
      nowMs: Date.parse(CHECKED) + OFFICIAL_PENDING_STALE_MS + 5_000,
    });

    expect(reconciled?.checks.find((item) => item.source === "imss")?.status).toBe("pendiente");
    expect(display.headline).toContain(OFFICIAL_WAIT_STILL_TRYING);
    expect(display.status).not.toBe("no_se_pudo");
    expect(shouldPollOfficialCheck(reconciled)).toBe(true);
    expect(hasUsableOfficialFact(reconciled)).toBe(true);
    expect(officialImssArrivalSentence(reconciled)).toBeNull();
    visible(`${display.headline} ${display.detail}`);
  });

  it("un reintento calmado del IMSS no se cierra a los 60 segundos", () => {
    const waiting = summary(
      [check("imss", "pendiente", { detail: OFFICIAL_WAIT_STILL_TRYING, honesty: "pending" })],
      "pendiente",
    );
    const stillOpen = reconcileOfficialCheckWithIdentity(waiting, waiting.identity, {
      nowMs: Date.parse(CHECKED) + OFFICIAL_PENDING_STALE_MS + 5_000,
    });
    const closed = reconcileOfficialCheckWithIdentity(waiting, waiting.identity, {
      nowMs: Date.parse(CHECKED) + SLOW_IMSS_WAIT_MS + 5_000,
    });
    expect(stillOpen?.overallStatus).toBe("pendiente");
    expect(closed?.checks.find((item) => item.source === "imss")?.status).toBe("no_se_pudo");
  });

  it("cuando llega el hecho, se muestra el dato y el aviso ya existente", () => {
    const arrived = summary(
      [check("imss", "vivo", { honesty: "live", hechos: ["Hay un movimiento de alta en el IMSS."] })],
      "vivo",
    );
    const display = resolveOfficialCheckDisplay({
      consentGranted: true,
      summary: arrived,
      identity: arrived.identity,
    });
    expect(hasUsableOfficialFact(arrived)).toBe(true);
    expect(officialImssArrivalSentence(arrived)).toMatch(/El IMSS ya contestó/);
    expect(display.correctImss).toBeFalsy();
    expect(guestOfficialFactStillWaiting(arrived, Date.parse(CHECKED))).toBe(false);
    visible(`${display.headline} ${officialImssArrivalSentence(arrived)}`);
  });

  it("registro no encontrado se corrige y no se queda en espera", () => {
    const missing = summary(
      [
        check("imss", "no_se_pudo", {
          detail: "No se encontró registro asociado a la CURP ni al NSS",
          motivoFallo: "No se encontró registro asociado a la CURP ni al NSS",
          hechos: ["No se encontró registro asociado a la CURP ni al NSS"],
        }),
      ],
      "no_se_pudo",
    );
    const reconciled = reconcileOfficialCheckWithIdentity(missing, missing.identity, {
      nowMs: Date.parse(CHECKED),
    });
    const display = resolveOfficialCheckDisplay({
      consentGranted: true,
      summary: reconciled,
      identity: missing.identity,
    });
    const presentation = buildHonestOfficialPresentation(reconciled);

    expect(reconciled?.overallStatus).toBe("registro_no_encontrado");
    expect(reconciled?.checks[0]?.detail).toBe(IMSS_RECORD_NOT_FOUND_MESSAGE);
    expect(shouldPollOfficialCheck(reconciled)).toBe(false);
    expect(guestOfficialFactStillWaiting(reconciled, Date.parse(CHECKED) + 1_000)).toBe(false);
    expect(hasUsableOfficialFact(reconciled)).toBe(false);
    expect(officialImssArrivalSentence(reconciled)).toBeNull();
    expect(display.correctImss).toBe(true);
    expect(display.status).toBe("registro_no_encontrado");
    expect(presentation?.retryLabel).toBe(IMSS_RECORD_NOT_FOUND_ACTION);
    expect(presentation?.nextStep).toBe(IMSS_RECORD_NOT_FOUND_NEXT);
    expect(presentation?.meaning).toBe(IMSS_RECORD_NOT_FOUND_MEANING);
    visible(`${display.headline} ${display.detail} ${presentation?.chat ?? ""}`);
  });
});

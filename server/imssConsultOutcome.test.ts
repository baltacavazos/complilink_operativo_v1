import { describe, expect, it } from "vitest";

import { guestOfficialFactStillWaiting } from "@shared/guestOfficialFact";
import {
  IMSS_RECORD_NOT_FOUND_MESSAGE,
  OFFICIAL_WAIT_STILL_TRYING,
  resolveOfficialCheckDisplay,
  shouldPollOfficialCheck,
} from "@shared/officialCheckCopy";
import { hasUsableOfficialFact, officialImssArrivalSentence } from "@shared/officialResultNotification";
import { applyWorkerIdentityCorrection, officialCheckFromBridgeReturn } from "./governmentLiveCheck";
import {
  persistGuestOfficialFact,
  rememberGuestOfficialSession,
  resetGuestOfficialFactStoreForTests,
} from "./guestOfficialFactStore";

const NOW = "2026-10-20T18:00:00.000Z";
const IDENTITY = { nss: true, curp: true, rfc: true };

function bridge(imss: Record<string, unknown>, followupKind?: string) {
  return officialCheckFromBridgeReturn({
    payload: {
      action: "official_check",
      ...(followupKind ? { followup: { kind: followupKind } } : {}),
      result: {
        officialCheck: {
          imss,
          sat: { honesty: "failed", resultado: "no_se_pudo", workerReason: "SAT no contestó.", hechos: ["SAT no contestó."] },
          infonavit: {
            honesty: "failed",
            resultado: "no_se_pudo",
            workerReason: "Infonavit no contestó.",
            hechos: ["Infonavit no contestó."],
          },
        },
      },
    },
    identity: IDENTITY,
    nowIso: NOW,
  });
}

describe("retorno Helios de IMSS", () => {
  it("mantenimiento abierto queda en consulta, sin tratarlo como fallo", () => {
    const parsed = bridge({
      honesty: "failed",
      resultado: "no_se_pudo",
      workerReason: "IMSS está en mantenimiento.",
      hechos: ["IMSS está en mantenimiento."],
    });
    const imss = parsed?.checks.find((item) => item.source === "imss");
    const display = resolveOfficialCheckDisplay({
      consentGranted: true,
      summary: parsed,
      identity: IDENTITY,
      nowMs: Date.parse(NOW),
    });

    expect(imss?.status).toBe("pendiente");
    expect(imss?.detail).toBe(OFFICIAL_WAIT_STILL_TRYING);
    expect(imss?.motivoFallo).toBeNull();
    expect(shouldPollOfficialCheck(parsed)).toBe(true);
    expect(display.correctImss).toBeFalsy();
    expect(`${display.headline} ${display.detail}`).not.toMatch(/\bFalló\b|\bcumple\b|ApiMarket|Consulta Única/);
  });

  it("el cierre del reintento sin dato no se queda pendiente", () => {
    const parsed = bridge(
      {
        honesty: "failed",
        resultado: "no_se_pudo",
        workerReason: "IMSS está en mantenimiento.",
        hechos: ["IMSS está en mantenimiento."],
      },
      "official_retry_closed",
    );
    expect(parsed?.checks.find((item) => item.source === "imss")?.status).toBe("no_se_pudo");
    expect(shouldPollOfficialCheck(parsed)).toBe(false);
    expect(hasUsableOfficialFact(parsed)).toBe(false);
  });

  it("el hecho que llega por reintento se muestra y usa el aviso existente", () => {
    const parsed = bridge(
      {
        honesty: "live",
        resultado: "vivo",
        hechos: ["Hay un movimiento de alta en el IMSS."],
      },
      "official_fact_arrived",
    );
    const imss = parsed?.checks.find((item) => item.source === "imss");
    expect(imss?.status).toBe("vivo");
    expect(hasUsableOfficialFact(parsed)).toBe(true);
    expect(officialImssArrivalSentence(parsed)).toMatch(/El IMSS ya contestó/);
    expect(guestOfficialFactStillWaiting(parsed, Date.parse(NOW))).toBe(false);
  });

  it.each([
    ["frase", { honesty: "failed", workerReason: "No se encontró registro asociado a la CURP ni al NSS", hechos: ["No se encontró registro asociado a la CURP ni al NSS"] }],
    ["estatus", { honesty: "failed", status: "not_found", workerReason: "sin dato" }],
    ["localizado", { honesty: "failed", aseguradoLocalizado: false, workerReason: "sin dato" }],
  ])("registro ausente (%s) no se reintenta", (_label, imss) => {
    const parsed = bridge(imss);
    const display = resolveOfficialCheckDisplay({
      consentGranted: true,
      summary: parsed,
      identity: IDENTITY,
      nowMs: Date.parse(NOW),
    });
    expect(parsed?.checks.find((item) => item.source === "imss")?.status).toBe("registro_no_encontrado");
    expect(parsed?.checks.find((item) => item.source === "imss")?.detail).toBe(IMSS_RECORD_NOT_FOUND_MESSAGE);
    expect(shouldPollOfficialCheck(parsed)).toBe(false);
    expect(guestOfficialFactStillWaiting(parsed, Date.parse(NOW) + 30_000)).toBe(false);
    expect(display.correctImss).toBe(true);
    expect(display.headline).toMatch(/No encontramos registro/);
    expect(`${display.headline} ${display.detail}`).not.toMatch(/\b400\b|ApiMarket|Consulta Única|\bcumple\b/);
  });

  it("un pendiente posterior no borra el registro ausente; un hecho sí", () => {
    resetGuestOfficialFactStoreForTests();
    const missing = bridge({
      honesty: "failed",
      status: "not_found",
      workerReason: "No se encontró registro asociado a la CURP ni al NSS",
    });
    const pending = bridge({ honesty: "pending", resultado: "pendiente", workerReason: "IMSS está en mantenimiento." });
    const arrived = bridge(
      { honesty: "live", resultado: "vivo", hechos: ["Hay un movimiento de alta en el IMSS."] },
      "official_fact_arrived",
    );
    expect(missing && pending && arrived).toBeTruthy();
    rememberGuestOfficialSession({
      guestPreviewId: "guest-imss-outcome",
      traceId: "trace-imss-outcome",
      officialCheck: missing,
      nowMs: Date.parse(NOW),
    });
    const kept = persistGuestOfficialFact({
      lookupIds: ["guest-imss-outcome", "trace-imss-outcome"],
      officialCheck: pending,
      arrivedAt: NOW,
      nowMs: Date.parse(NOW) + 1_000,
    });
    expect(kept?.officialCheck?.checks.find((item) => item.source === "imss")?.status).toBe("registro_no_encontrado");
    const replaced = persistGuestOfficialFact({
      lookupIds: ["guest-imss-outcome", "trace-imss-outcome"],
      officialCheck: arrived,
      arrivedAt: NOW,
      nowMs: Date.parse(NOW) + 2_000,
    });
    expect(replaced?.officialCheck?.checks.find((item) => item.source === "imss")?.status).toBe("vivo");
    expect(hasUsableOfficialFact(replaced?.officialCheck)).toBe(true);
  });

  it("una corrección inválida no repite el dato escrito", () => {
    const token = "ZZNOVALIDO";
    const nss = applyWorkerIdentityCorrection(
      { nss: null, curp: null, rfc: null },
      { nss: token },
    );
    const curp = applyWorkerIdentityCorrection(
      { nss: null, curp: null, rfc: null },
      { curp: token },
    );
    expect(nss.error).toMatch(/NSS/);
    expect(curp.error).toMatch(/CURP/);
    expect(`${nss.error} ${curp.error}`).not.toContain(token);
    const ok = applyWorkerIdentityCorrection(
      { nss: null, curp: null, rfc: null },
      { nss: "00000000000", curp: "AAAA000101HDFXXX00" },
    );
    expect(ok.error).toBeNull();
    expect(ok.identity.nss).toBe("00000000000");
    expect(ok.identity.curp).toBe("AAAA000101HDFXXX00");
  });
});

import { describe, expect, it } from "vitest";

import { guestOfficialFactStillWaiting } from "@shared/guestOfficialFact";
import {
  IMSS_RECORD_NOT_FOUND_MESSAGE,
  OFFICIAL_WAIT_STILL_TRYING,
  resolveOfficialCheckDisplay,
  shouldPollOfficialCheck,
} from "@shared/officialCheckCopy";
import { hasUsableOfficialFact, officialImssArrivalSentence } from "@shared/officialResultNotification";
import { applyWorkerIdentityCorrection, classifyBridgeOfficialCheck, officialCheckFromBridgeReturn } from "./governmentLiveCheck";
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
    expect(nss.error).toBe("11 números. Viene en tu recibo.");
    expect(curp.error).toMatch(/CURP/);
    expect(`${nss.error} ${curp.error}`).not.toContain(token);
    const ten = applyWorkerIdentityCorrection(
      { nss: null, curp: null, rfc: null },
      { nss: "0000000000" },
    );
    expect(ten.error).toBeNull();
    expect(ten.identity.nss).toBe("0000000000");
    const ok = applyWorkerIdentityCorrection(
      { nss: null, curp: null, rfc: null },
      { nss: "00000000000", curp: "AAAA000101HDFXXX00" },
    );
    expect(ok.error).toBeNull();
    expect(ok.identity.nss).toBe("00000000000");
    expect(ok.identity.curp).toBe("AAAA000101HDFXXX00");
  });

  it("lectura manda y el texto queda de último respaldo", () => {
    const missing = bridge({
      lectura: "registro_no_encontrado",
      resultado: "vivo",
      honesty: "live",
      workerReason: "sin dato",
    });
    expect(missing?.checks.find((item) => item.source === "imss")?.status).toBe("registro_no_encontrado");
    expect(missing?.checks.find((item) => item.source === "sat")?.status).not.toBe("registro_no_encontrado");

    const calm = bridge({
      lectura: "pendiente",
      resultado: "vivo",
      honesty: "live",
      workerReason: "No se encontró registro asociado a la CURP ni al NSS",
      hechos: ["No se encontró registro asociado a la CURP ni al NSS"],
      aseguradoLocalizado: false,
    });
    const calmImss = calm?.checks.find((item) => item.source === "imss");
    expect(calmImss?.status).toBe("pendiente");
    expect(calmImss?.detail).toBe(OFFICIAL_WAIT_STILL_TRYING);
    expect(calmImss?.hechos).toEqual([]);

    const closed = bridge({
      lectura: "sin_dato",
      resultado: "vivo",
      honesty: "live",
      workerReason: "No se encontró registro asociado a la CURP ni al NSS",
      aseguradoLocalizado: false,
    });
    expect(closed?.checks.find((item) => item.source === "imss")?.status).toBe("no_se_pudo");
    const closedDisplay = resolveOfficialCheckDisplay({
      consentGranted: true,
      summary: closed,
      identity: IDENTITY,
      nowMs: Date.parse(NOW),
    });
    expect(closedDisplay.correctImss).toBeFalsy();
    expect(shouldPollOfficialCheck(closed)).toBe(false);

    const done = bridge({
      lectura: "hecho",
      resultado: "no_se_pudo",
      honesty: "failed",
      hechos: ["Hay un movimiento de alta en el IMSS."],
    });
    expect(done?.checks.find((item) => item.source === "imss")?.status).toBe("vivo");
    expect(officialImssArrivalSentence(done)).toMatch(/El IMSS ya contestó/);

    const emptyHecho = bridge({ lectura: "hecho", resultado: "vivo", honesty: "live", workerReason: "sin dato" });
    expect(emptyHecho?.checks.find((item) => item.source === "imss")?.status).not.toBe("vivo");

    const fromFollowup = officialCheckFromBridgeReturn({
      payload: {
        action: "official_check",
        followup: { kind: "official_fact_arrived", resultado: "hecho" },
        result: {
          officialCheck: {
            imss: { honesty: "failed", resultado: "no_se_pudo", hechos: ["Hay un movimiento de alta en el IMSS."] },
            sat: { honesty: "failed", resultado: "no_se_pudo", workerReason: "SAT no contestó.", hechos: ["SAT no contestó."] },
            infonavit: { honesty: "failed", resultado: "no_se_pudo", workerReason: "Infonavit no contestó.", hechos: ["Infonavit no contestó."] },
          },
        },
      },
      identity: IDENTITY,
      nowIso: NOW,
    });
    expect(fromFollowup?.checks.find((item) => item.source === "imss")?.status).toBe("vivo");

    const nodeWins = officialCheckFromBridgeReturn({
      payload: {
        action: "official_check",
        followup: { kind: "official_fact_arrived", resultado: "hecho" },
        result: {
          officialCheck: {
            imss: {
              lectura: "pendiente",
              resultado: "vivo",
              honesty: "live",
              workerReason: "No se encontró registro asociado a la CURP ni al NSS",
              hechos: ["Hay un movimiento de alta en el IMSS."],
            },
            sat: { honesty: "failed", resultado: "no_se_pudo", workerReason: "SAT no contestó.", hechos: ["SAT no contestó."] },
            infonavit: { honesty: "failed", resultado: "no_se_pudo", workerReason: "Infonavit no contestó.", hechos: ["Infonavit no contestó."] },
          },
        },
      },
      identity: IDENTITY,
      nowIso: NOW,
    });
    expect(nodeWins?.checks.find((item) => item.source === "imss")?.status).toBe("pendiente");
  });
});

describe("contrato lectura de Helios", () => {
  const offices = {
    sat: { honesty: "live", resultado: "vivo", hechos: ["El SAT confirmó el RFC consultado."] },
    infonavit: { honesty: "pending", resultado: "pendiente", workerReason: "Infonavit está en mantenimiento.", hechos: ["Infonavit está en mantenimiento."] },
  };

  function posted(responseJson: Record<string, unknown>) {
    return classifyBridgeOfficialCheck({
      ok: true,
      httpStatus: 200,
      reason: null,
      responseBody: null,
      responseJson,
      signedBody: "{}",
      timestamp: NOW,
      targetUrl: "https://example.invalid/official",
      attempts: 1,
    });
  }

  it("no lee el resultado viejo del nodo como lectura", () => {
    const parsed = bridge({
      resultado: "pendiente",
      honesty: "failed",
      workerReason: "No se encontró registro asociado a la CURP ni al NSS",
    });
    expect(parsed?.checks.find((item) => item.source === "imss")?.status).toBe("registro_no_encontrado");
  });

  it("toma lectura del nodo, del ancla y de analysisResults", () => {
    const fromNode = bridge({ lectura: "sin_dato", resultado: "vivo", honesty: "live" });
    expect(fromNode?.checks.find((item) => item.source === "imss")?.status).toBe("no_se_pudo");

    const fromAnchor = officialCheckFromBridgeReturn({
      payload: {
        action: "official_check",
        result: {
          officialCheck: {
            imss: { resultado: "vivo", honesty: "live", hechos: ["IMSS respondió, pero no trajo alta, salario ni otro dato usable para citar."] },
            ...offices,
          },
          chatAnchor: {
            imss: { lectura: "registro_no_encontrado", estado: "live", resultado: "vivo", hechos: [] },
          },
        },
      },
      identity: IDENTITY,
      nowIso: NOW,
    });
    expect(fromAnchor?.checks.find((item) => item.source === "imss")?.status).toBe("registro_no_encontrado");
    expect(fromAnchor?.checks.find((item) => item.source === "imss")?.hechos).toEqual([]);

    const fromAnalysis = officialCheckFromBridgeReturn({
      payload: {
        action: "official_check",
        analysisResults: {
          officialCheck: {
            imss: { lectura: "pendiente", resultado: "no_se_pudo", honesty: "failed", workerReason: "IMSS está en mantenimiento." },
            ...offices,
          },
        },
      },
      identity: IDENTITY,
      nowIso: NOW,
    });
    expect(fromAnalysis?.checks.find((item) => item.source === "imss")?.status).toBe("pendiente");
    expect(fromAnalysis?.checks.find((item) => item.source === "imss")?.detail).toBe(OFFICIAL_WAIT_STILL_TRYING);
  });

  it("aseguradoLocalizado false con resultado vivo no es un hecho", () => {
    const parsed = officialCheckFromBridgeReturn({
      payload: {
        action: "official_check",
        followup: { kind: "official_fact_arrived", obligation: "imss" },
        result: {
          officialCheck: {
            imss: {
              resultado: "vivo",
              honesty: "live",
              hechos: ["IMSS respondió, pero no trajo alta, salario ni otro dato usable para citar."],
              rawPayload: JSON.stringify({ aseguradoLocalizado: false }),
            },
            sat: { honesty: "failed", resultado: "no_se_pudo", workerReason: "SAT no contestó.", hechos: ["SAT no contestó."] },
            infonavit: { honesty: "failed", resultado: "no_se_pudo", workerReason: "Infonavit no contestó.", hechos: ["Infonavit no contestó."] },
          },
        },
      },
      identity: IDENTITY,
      nowIso: NOW,
    });
    const imss = parsed?.checks.find((item) => item.source === "imss");
    const display = resolveOfficialCheckDisplay({
      consentGranted: true,
      summary: parsed,
      identity: IDENTITY,
      nowMs: Date.parse(NOW),
    });
    expect(imss?.status).toBe("registro_no_encontrado");
    expect(imss?.hechos).toEqual([]);
    expect(imss?.detail).toBe(IMSS_RECORD_NOT_FOUND_MESSAGE);
    expect(hasUsableOfficialFact(parsed)).toBe(false);
    expect(officialImssArrivalSentence(parsed)).toBeNull();
    expect(display.correctImss).toBe(true);
    expect(posted({
      ok: true,
      result: {
        officialCheck: {
          imss: { resultado: "vivo", honesty: "live", rawPayload: { aseguradoLocalizado: false } },
        },
      },
    })).toBe("registro_no_encontrado");
  });

  it("un hecho positivo de la misma lectura gana sobre el registro ausente", () => {
    const parsed = officialCheckFromBridgeReturn({
      payload: {
        action: "official_check",
        followup: { kind: "official_fact_arrived", resultado: "registro_no_encontrado" },
        result: {
          officialCheck: {
            imss: {
              lectura: "registro_no_encontrado",
              resultado: "vivo",
              honesty: "live",
              hechos: ["El IMSS no localizó al asegurado.", "Hay un movimiento de alta en el IMSS."],
              rawPayload: { aseguradoLocalizado: false, registroNoEncontrado: true },
            },
            ...offices,
          },
        },
      },
      identity: IDENTITY,
      nowIso: NOW,
    });
    const imss = parsed?.checks.find((item) => item.source === "imss");
    expect(imss?.status).toBe("vivo");
    expect(imss?.hechos).toEqual(["Hay un movimiento de alta en el IMSS."]);
    expect(imss?.detail).not.toMatch(/No encontramos registro|no localiz/i);
    expect(hasUsableOfficialFact(parsed)).toBe(true);
  });

  it("la frase de registro ausente solo respalda cuando no hay lectura ni marca", () => {
    const phraseOnly = bridge({
      resultado: "no_se_pudo",
      honesty: "failed",
      workerReason: "No se encontró registro asociado a la CURP ni al NSS",
    });
    expect(phraseOnly?.checks.find((item) => item.source === "imss")?.status).toBe("registro_no_encontrado");

    const ignored = bridge({
      lectura: "hecho",
      resultado: "vivo",
      honesty: "live",
      workerReason: "No se encontró registro asociado a la CURP ni al NSS",
      hechos: ["Hay un movimiento de alta en el IMSS."],
    });
    expect(ignored?.checks.find((item) => item.source === "imss")?.status).toBe("vivo");
  });

  it("el cierre con hecho, sin hecho y en silencio no se confunden", () => {
    const first = bridge({
      resultado: "no_se_pudo",
      honesty: "failed",
      workerReason: "IMSS está en mantenimiento.",
      hechos: ["IMSS está en mantenimiento."],
    });
    expect(first?.checks.find((item) => item.source === "imss")?.status).toBe("pendiente");
    expect(shouldPollOfficialCheck(first)).toBe(true);

    const arrived = officialCheckFromBridgeReturn({
      payload: {
        action: "official_check",
        followup: { kind: "official_fact_arrived", resultado: "hecho", obligation: "imss" },
        result: {
          officialCheck: {
            imss: { lectura: "hecho", resultado: "vivo", honesty: "live", hechos: ["Hay un movimiento de alta en el IMSS."] },
            ...offices,
          },
        },
      },
      identity: IDENTITY,
      nowIso: NOW,
    });
    expect(arrived?.checks.find((item) => item.source === "imss")?.status).toBe("vivo");
    expect(hasUsableOfficialFact(arrived)).toBe(true);

    const exhausted = officialCheckFromBridgeReturn({
      payload: {
        action: "official_check",
        followup: { kind: "official_retry_closed", resultado: "sin_dato", obligation: "imss" },
        result: {
          officialCheck: {
            imss: {
              resultado: "no_se_pudo",
              honesty: "failed",
              workerReason: "IMSS está en mantenimiento.",
              hechos: ["IMSS está en mantenimiento."],
            },
            sat: { honesty: "failed", resultado: "no_se_pudo", workerReason: "SAT no contestó.", hechos: ["SAT no contestó."] },
            infonavit: { honesty: "failed", resultado: "no_se_pudo", workerReason: "Infonavit no contestó.", hechos: ["Infonavit no contestó."] },
          },
        },
      },
      identity: IDENTITY,
      nowIso: NOW,
    });
    expect(exhausted?.checks.find((item) => item.source === "imss")?.status).toBe("no_se_pudo");
    expect(shouldPollOfficialCheck(exhausted)).toBe(false);
    expect(hasUsableOfficialFact(exhausted)).toBe(false);

    const closedMissing = officialCheckFromBridgeReturn({
      payload: {
        action: "official_check",
        followup: { kind: "official_retry_closed", resultado: "registro_no_encontrado", obligation: "imss" },
        result: {
          officialCheck: {
            imss: { resultado: "vivo", honesty: "live", hechos: ["IMSS respondió, pero no trajo alta, salario ni otro dato usable para citar."] },
            ...offices,
          },
        },
      },
      identity: IDENTITY,
      nowIso: NOW,
    });
    expect(closedMissing?.checks.find((item) => item.source === "imss")?.status).toBe("registro_no_encontrado");
    expect(closedMissing?.checks.find((item) => item.source === "sat")?.status).toBe("vivo");
    expect(closedMissing?.checks.find((item) => item.source === "infonavit")?.status).not.toBe("registro_no_encontrado");
  });
});

import { describe, expect, it } from "vitest";

import {
  OFFICIAL_CHECK_BUTTON,
  OFFICIAL_CHECK_CONSENT,
  OFFICIAL_CHECK_LOADING_DETAIL,
  OFFICIAL_CHECK_LOADING_LABEL,
  OFFICIAL_CHECK_READY_DETAIL,
  OFFICIAL_CHECK_READY_HEADLINE,
  OFFICIAL_CHECK_STATUS_DETAIL,
  OFFICIAL_CHECK_STATUS_LABEL,
  OFFICIAL_FAILED_BLAME,
  RECEIPT_OFFICIAL_COMPARISON_COPY,
  assertNoInternalBrands,
  buildOfficialFailedDetail,
  filterOfficialMissingFieldsForSource,
  hasLiveOfficialResult,
  honestyToOfficialStatus,
  pickHonestOfficialCheck,
  readChatAnchor,
  readReciboVsOficial,
  resolveOfficialCheckDisplay,
  type OfficialCheckSummary,
} from "./officialCheckCopy";

function expectFailedCopyBlamesInstitute(value: string) {
  expect(value).toMatch(/instituto|IMSS|SAT|Infonavit/);
  expect(value).toMatch(/Consultamos|no contest/);
  expect(value).toMatch(/no de AuditaPatrón/);
  expect(value).not.toMatch(/respuesta usable|falló (la )?(app|plataforma)|fallo de AuditaPatrón/i);
  expect(value).not.toMatch(/Helios|CompliLink|HMAC|APIMarket|connector/i);
  expect(value).not.toMatch(/\b(sí )?cumple\b/i);
}

function summary(status: OfficialCheckSummary["overallStatus"], extra?: Partial<OfficialCheckSummary>): OfficialCheckSummary {
  return {
    configured: true,
    consentGranted: status !== "sin_permiso",
    overallStatus: status,
    overallLabel: OFFICIAL_CHECK_STATUS_LABEL[status],
    overallDetail: OFFICIAL_CHECK_STATUS_DETAIL[status],
    checkedAt: extra?.checkedAt ?? null,
    identity: { nss: true, curp: false, rfc: false },
    checks: extra?.checks ?? [],
    ...extra,
  };
}

function expectNoInternalOrVerdictInvented(value: string) {
  expect(assertNoInternalBrands(value)).toBe(true);
  expect(value).not.toMatch(/Helios|CompliLink|HMAC/i);
  expect(value).not.toMatch(/\b(sí )?cumple\b/i);
}

describe("copia de consulta IMSS/SAT según permiso", () => {
  it("sin checkbox muestra Falta tu permiso y no inventa un estado del instituto", () => {
    const display = resolveOfficialCheckDisplay({
      consentGranted: false,
      summary: summary("sin_permiso"),
    });

    expect(display.headline).toBe("Falta tu permiso");
    expect(display.detail).toBe("Falta tu permiso para consultar IMSS y SAT.");
    expect(display.buttonLabel).toBe(OFFICIAL_CHECK_BUTTON);
    expect(display.status).toBe("sin_permiso");
    expect(display.showPermissionCopy).toBe(true);
    expect(display.headline).not.toMatch(/Vivo|Pendiente|Falló/);
    expectNoInternalOrVerdictInvented(display.headline);
    expect(OFFICIAL_CHECK_CONSENT).not.toMatch(/Helios|CompliLink|HMAC/i);
    expect(OFFICIAL_CHECK_CONSENT).toMatch(/No inventamos que tu patrón cumple/);
  });

  it("con checkbox nunca muestra Falta tu permiso, aunque el servidor siga en sin_permiso", () => {
    const display = resolveOfficialCheckDisplay({
      consentGranted: true,
      summary: summary("sin_permiso"),
    });

    expect(display.headline).not.toMatch(/Falta tu permiso/i);
    expect(display.detail).not.toMatch(/Falta tu permiso/i);
    expect(display.buttonLabel).toBe(OFFICIAL_CHECK_BUTTON);
    expect(display.headline).toBe(OFFICIAL_CHECK_READY_HEADLINE);
    expect(display.detail).toBe(OFFICIAL_CHECK_READY_DETAIL);
    expect(display.status).toBe("listo");
    expect(display.showPermissionCopy).toBe(false);
    expect(display.detail).toMatch(/No inventamos que tu patrón cumple/);
    expect(assertNoInternalBrands(display.detail)).toBe(true);
    expect(display.detail).not.toMatch(/Helios|CompliLink|HMAC/i);
  });

  it("con checkbox y sin NSS/CURP/RFC muestra Faltan datos, no Falta tu permiso", () => {
    const display = resolveOfficialCheckDisplay({
      consentGranted: true,
      summary: summary("sin_permiso"),
      missingIdentityDetail: "Falta tu NSS, CURP y RFC en el recibo para consultar.",
    });
    expect(display.headline).toBe("Faltan datos");
    expect(display.buttonLabel).toBe("Faltan datos");
    expect(display.detail).toMatch(/Falta tu NSS, CURP y RFC/);
    expect(display.headline).not.toMatch(/Falta tu permiso/i);
  });

  it("con checkbox y en curso muestra Consultando..., no Falta tu permiso", () => {
    const display = resolveOfficialCheckDisplay({
      consentGranted: true,
      isPending: true,
      summary: summary("sin_permiso"),
    });

    expect(display.headline).toBe(OFFICIAL_CHECK_LOADING_LABEL);
    expect(display.buttonLabel).toBe(OFFICIAL_CHECK_LOADING_LABEL);
    expect(display.status).toBe("consultando");
    expect(display.headline).not.toMatch(/Falta tu permiso/i);
    expect(display.detail).toBe(OFFICIAL_CHECK_LOADING_DETAIL);
    expect(display.detail).toMatch(/instituto no contesta/);
    expect(display.detail).toMatch(/no es un fallo de AuditaPatrón/);
    expect(display.detail).not.toMatch(/Falta tu permiso|Helios|HMAC|cumple/i);
  });

  it("con checkbox refleja Vivo, Pendiente y Falló del puente, nunca cumple", () => {
    const vivo = resolveOfficialCheckDisplay({
      consentGranted: true,
      summary: summary("vivo", { checkedAt: "2026-09-21T15:30:00.000Z" }),
    });
    const pendiente = resolveOfficialCheckDisplay({
      consentGranted: true,
      summary: summary("pendiente"),
    });
    const fallo = resolveOfficialCheckDisplay({
      consentGranted: true,
      summary: summary("no_se_pudo"),
    });

    expect(vivo.headline).toBe("Vivo · 21/09/2026");
    expect(vivo.buttonLabel).toBe("Vivo");
    expect(vivo.status).toBe("vivo");
    expect(pendiente.headline).toBe("Pendiente");
    expect(pendiente.buttonLabel).toBe("Pendiente");
    expect(pendiente.detail).toMatch(/Todavía no hay una respuesta oficial nueva/);
    expect(pendiente.detail).not.toMatch(/no respondió/);

    const afterConsult = resolveOfficialCheckDisplay({
      consentGranted: false,
      summary: summary("pendiente", { checkedAt: "2026-09-21T15:30:00.000Z" }),
    });
    expect(afterConsult.headline).toBe("Pendiente · 21/09/2026");
    expect(afterConsult.headline).not.toMatch(/Falta tu permiso/i);
    expect(afterConsult.showPermissionCopy).toBe(false);
    expect(fallo.headline).toBe("Falló");
    expect(fallo.buttonLabel).toBe("Falló");
    expectFailedCopyBlamesInstitute(fallo.detail);
    expect(fallo.detail).toBe(OFFICIAL_CHECK_STATUS_DETAIL.no_se_pudo);
    expect(fallo.detail).toContain(OFFICIAL_FAILED_BLAME);

    const faltan = resolveOfficialCheckDisplay({
      consentGranted: true,
      summary: summary("sin_datos", { checkedAt: "2026-09-21T15:30:00.000Z" }),
      missingIdentityDetail: "Falta tu NSS y CURP en el recibo para consultar.",
    });
    expect(faltan.headline).toBe("Faltan datos · 21/09/2026");
    expect(faltan.detail).toMatch(/Falta tu NSS y CURP/);
    expect(faltan.status).toBe("sin_datos");

    for (const display of [vivo, pendiente, fallo]) {
      expect(display.headline).not.toMatch(/Falta tu permiso/i);
      expect(display.buttonLabel).not.toMatch(/Falta tu permiso|Helios|HMAC/i);
      expect(display.buttonLabel).not.toMatch(/\bcumple\b/i);
      expect(display.detail).not.toMatch(/Helios|CompliLink|HMAC/i);
    }
    expect(vivo.detail).toMatch(/No significa que tu patrón cumple/);
  });

  it("con permiso elige el acuse honesto y descarta un sin_permiso viejo", () => {
    const picked = pickHonestOfficialCheck({
      consentGranted: true,
      candidates: [summary("sin_permiso"), summary("no_se_pudo"), summary("vivo")],
    });

    expect(picked?.overallStatus).toBe("no_se_pudo");
    expect(picked?.overallLabel).toBe("Falló");
    expect(pickHonestOfficialCheck({
      consentGranted: true,
      candidates: [summary("sin_permiso"), null],
    })).toBeNull();

    const afterRemount = pickHonestOfficialCheck({
      consentGranted: false,
      candidates: [
        summary("sin_permiso"),
        summary("pendiente", { checkedAt: "2026-09-21T15:30:00.000Z" }),
      ],
    });
    expect(afterRemount?.overallStatus).toBe("pendiente");
    expect(afterRemount?.checkedAt).toBe("2026-09-21T15:30:00.000Z");
  });

  it("lee chatAnchor y reciboVsOficial del contrato CLK sin inventar cumple", () => {
    expect(honestyToOfficialStatus("live")).toBe("vivo");
    expect(honestyToOfficialStatus("pending", ["nss"])).toBe("sin_datos");
    expect(honestyToOfficialStatus("pending")).toBe("pendiente");
    expect(honestyToOfficialStatus("failed", ["nss"])).toBe("sin_datos");
    expect(honestyToOfficialStatus("failed")).toBe("no_se_pudo");
    const receipt = { nss: true, curp: false, rfc: true };
    expect(honestyToOfficialStatus("pending", ["nss", "curp", "rfc"], receipt, "imss")).toBe("pendiente");
    expect(honestyToOfficialStatus("pending", ["nss", "curp", "rfc"], receipt, "sat")).toBe("pendiente");
    expect(honestyToOfficialStatus("pending", ["nss", "curp", "rfc"], receipt, "infonavit")).toBe("sin_datos");

    const anchor = readChatAnchor({
      sat: { fuente: "sat", estado: "pending", fecha: null, hechos: ["Todavía no hay una respuesta oficial nueva de SAT."], motivoFallo: null },
      imss: { fuente: "imss", estado: "live", fecha: "2026-09-21T12:00:00.000Z", hechos: ["Alta vigente: sí."], motivoFallo: null },
      infonavit: { fuente: "infonavit", estado: "failed", fecha: "2026-09-21T12:00:00.000Z", hechos: ["Infonavit no respondió."], motivoFallo: "Infonavit está en mantenimiento." },
    });
    expect(anchor?.imss.estado).toBe("live");
    expect(anchor?.imss.hechos[0]).toBe("Alta vigente: sí.");
    expect(anchor?.infonavit.motivoFallo).toMatch(/mantenimiento/);
    expect(anchor?.infonavit.motivoFallo).toMatch(/no de AuditaPatrón/);
    expect(anchor?.infonavit.motivoFallo).not.toMatch(/respuesta usable|fallo de AuditaPatrón/i);

    const noResponse = readChatAnchor({
      imss: {
        fuente: "imss",
        estado: "pending",
        fecha: null,
        hechos: ["El instituto no respondió hoy"],
        motivoFallo: "El instituto no respondió hoy",
      },
      sat: {
        fuente: "sat",
        estado: "pending",
        fecha: null,
        hechos: ["Todavía no hay una respuesta oficial nueva de SAT."],
        motivoFallo: null,
      },
      infonavit: {
        fuente: "infonavit",
        estado: "pending",
        fecha: null,
        hechos: ["El instituto no respondió hoy"],
        motivoFallo: null,
      },
    });
    expect(noResponse?.imss.estado).toBe("failed");
    expect(noResponse?.imss.motivoFallo).toMatch(/no contestó/);
    expect(noResponse?.imss.motivoFallo).toMatch(/no de AuditaPatrón/);
    expect(noResponse?.infonavit.estado).toBe("failed");
    expect(noResponse?.sat.estado).toBe("pending");

    expect(buildOfficialFailedDetail(["imss"])).toMatch(/Consultamos al IMSS hoy/);
    expect(buildOfficialFailedDetail(["imss"])).not.toMatch(/SAT|Infonavit/);
    expect(buildOfficialFailedDetail(["imss", "sat"])).toMatch(/IMSS y SAT/);
    expect(buildOfficialFailedDetail(["imss", "sat"])).toMatch(/Esos institutos no contestaron/);
    expectFailedCopyBlamesInstitute(buildOfficialFailedDetail(["imss"]));
    expectFailedCopyBlamesInstitute(buildOfficialFailedDetail(["imss", "sat", "infonavit"]));

    expect(readReciboVsOficial("bien")?.resultado).toBe("bien");
    expect(readReciboVsOficial({ resultado: "hay_diferencia", motivo: "SBC" })?.resultado).toBe("hay_diferencia");
    expect(readReciboVsOficial(null)).toBeNull();

    expect(RECEIPT_OFFICIAL_COMPARISON_COPY.bien.seenLine).toBe("Esto vimos: bien");
    expect(RECEIPT_OFFICIAL_COMPARISON_COPY.hay_diferencia.seenLine).toBe("Esto vimos: hay diferencia");
    expect(RECEIPT_OFFICIAL_COMPARISON_COPY.no_se_pudo.seenLine).toBe("Esto vimos: no se pudo");
    expect(RECEIPT_OFFICIAL_COMPARISON_COPY.hay_diferencia.nextStep).toMatch(/patrón o RH/);
    expect(JSON.stringify(RECEIPT_OFFICIAL_COMPARISON_COPY)).not.toMatch(/Helios|CompliLink|HMAC|\bcumple\b/i);

    expect(hasLiveOfficialResult(summary("vivo"))).toBe(true);
    expect(hasLiveOfficialResult(summary("pendiente"))).toBe(false);

    const parsedIdentity = { nss: true, curp: false, rfc: true };
    expect(filterOfficialMissingFieldsForSource("imss", ["nss", "curp", "rfc"], parsedIdentity)).toEqual([]);
    expect(filterOfficialMissingFieldsForSource("sat", ["nss", "curp", "rfc"], parsedIdentity)).toEqual([]);
    expect(filterOfficialMissingFieldsForSource("infonavit", ["nss", "curp", "rfc"], parsedIdentity)).toEqual(["curp"]);
  });
});

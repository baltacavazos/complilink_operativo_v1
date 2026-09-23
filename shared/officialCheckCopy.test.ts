import { describe, expect, it } from "vitest";

import {
  OFFICIAL_CHECK_BUTTON,
  OFFICIAL_CHECK_CONSENT,
  OFFICIAL_CHECK_LOADING_DETAIL,
  OFFICIAL_CHECK_LOADING_LABEL,
  OFFICIAL_CHECK_READY_DETAIL,
  OFFICIAL_CHECK_READY_HEADLINE,
  OFFICIAL_CHECK_STATUS_DETAIL,
  INSTITUTE_SILENCE_RETRY,
  INSTITUTE_SILENCE_VERDICT,
  INSTITUTE_WAITING_DETAIL,
  INSTITUTE_WAITING_HEADLINE,
  OFFICIAL_CHECK_STATUS_LABEL,
  RECEIPT_OFFICIAL_COMPARISON_COPY,
  assertNoInternalBrands,
  buildOfficialFailedDetail,
  canDispatchOfficialConsult,
  identityFlagsFromReceiptValues,
  isGenericSatRfc,
  filterOfficialMissingFieldsForSource,
  hasLiveOfficialResult,
  reconcileOfficialCheckWithIdentity,
  honestyToOfficialStatus,
  OFFICIAL_ALTERNATE_ROUTE_NOTE,
  LABOR_REVIEW_READY,
  RECEIPT_RECEIVED_ACK,
  RECEIPT_VALIDATION_CORRECTION,
  buildReceiptEstatusLine,
  laborInstitutesSettled,
  liveSatFactLines,
  pickHonestOfficialCheck,
  pickPromptOfficialCheck,
  readAlternateOfficialRoute,
  readChatAnchor,
  shouldPollOfficialCheck,
  readReciboVsOficial,
  resolveOfficialCheckDisplay,
  hasUsableSatResponse,
  isPlaceholderSatLegalName,
  isUnusableSatLegalNameLine,
  FALTA_NSS_Y_RFC_EXACT,
  OFFICIAL_PENDING_STALE_MS,
  officialDispatchGapDetail,
  officialSourceGapDetail,
  stripContradictoryMissingIdentityCopy,
  type OfficialCheckSummary,
} from "./officialCheckCopy";

function expectPlainNoResponseCopy(value: string) {
  expect(value).toMatch(/Pedimos la información|no hubo respuesta|no contestó|no contestaron|Hoy no pudimos consultar/);
  expect(value).not.toMatch(/no de AuditaPatrón/);
  expect(value).not.toMatch(/\bFalló\b/);
  expect(value).not.toMatch(/respuesta usable|fallo de AuditaPatrón/i);
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
    expect(OFFICIAL_CHECK_CONSENT).toBe(
      "Autorizo que pregunten a IMSS y SAT con los datos de mi recibo, solo para ver la respuesta de hoy.",
    );
    expect(OFFICIAL_CHECK_READY_DETAIL).toMatch(/No inventamos que tu patrón cumple/);
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
      summary: summary("sin_permiso", { identity: { nss: false, curp: false, rfc: false } }),
      identity: { nss: false, curp: false, rfc: false },
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

    expect(display.headline).toBe("Ya leímos tu recibo. Todavía faltan respuestas para saber si tu patrón te tiene bien registrado.");
    expect(display.buttonLabel).toBe(OFFICIAL_CHECK_LOADING_LABEL);
    expect(display.status).toBe("consultando");
    expect(display.headline).not.toMatch(/Falta tu permiso/i);
    expect(display.detail).toBe(INSTITUTE_WAITING_DETAIL);
    expect(display.detail).toMatch(/no es por tu recibo/i);
    expect(display.detail).not.toMatch(/no de AuditaPatrón|Falló/);
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

    expect(vivo.headline).toBe("Hoy no pudimos consultar.");
    expect(vivo.detail).toContain("Hoy no pudimos consultar. No prueba que tu patrón cumpla.");

    const capped = resolveOfficialCheckDisplay({
      consentGranted: true,
      summary: summary("pendiente", {
        bridgeBlock: "provider_cap",
        checkedAt: "2026-09-21T20:39:00.000Z",
        checks: [
          {
            source: "imss",
            sourceLabel: "IMSS",
            status: "pendiente",
            label: "Pendiente",
            detail: "Todavía no hay una respuesta oficial nueva.",
            checkedAt: "2026-09-21T20:39:00.000Z",
            used: { nss: true, curp: false, rfc: false },
            honesty: "pending",
            hechos: [],
          },
        ],
      }),
      nowMs: Date.parse("2026-09-21T20:39:00.000Z"),
    });
    expect(capped.headline).toBe("Hoy no pudimos consultar IMSS.");
    expect(capped.detail).toBe("Hoy no pudimos consultar IMSS. No prueba que tu patrón cumpla.");
    expect(capped.status).toBe("no_se_pudo");
    expect(capped.headline).not.toMatch(/Pendiente|Bien|Vivo|cumple/i);
    expect(vivo.headline).not.toMatch(/\bVivo\b|certificado|RFC confirmado/);
    expect(vivo.status).toBe("no_se_pudo");
    expect(vivo.status).not.toBe("vivo");
    expect(pendiente.headline).toBe(INSTITUTE_WAITING_HEADLINE);
    expect(pendiente.buttonLabel).toBe(OFFICIAL_CHECK_BUTTON);
    expect(pendiente.detail).toBe(INSTITUTE_WAITING_DETAIL);
    expect(pendiente.detail).not.toMatch(/no respondió/);

    const afterConsult = resolveOfficialCheckDisplay({
      consentGranted: false,
      summary: summary("pendiente", { checkedAt: "2026-09-21T15:30:00.000Z" }),
      nowMs: new Date("2026-09-21T15:30:30.000Z").getTime(),
    });
    expect(afterConsult.headline).toBe(INSTITUTE_WAITING_HEADLINE);
    expect(afterConsult.headline).not.toMatch(/Falta tu permiso/i);
    expect(afterConsult.showPermissionCopy).toBe(false);
    expect(fallo.headline).toBe(INSTITUTE_SILENCE_VERDICT);
    expect(fallo.buttonLabel).toBe(INSTITUTE_SILENCE_RETRY);
    expect(fallo.silence?.meaning).toMatch(/Tu recibo sí se leyó/);
    expect(fallo.silence?.sourceLines).toEqual([
      "Hoy no pudimos consultar IMSS. No prueba que tu patrón cumpla.",
      "Hoy no pudimos consultar SAT. No prueba que tu patrón cumpla.",
      "Hoy no pudimos consultar Infonavit. No prueba que tu patrón cumpla.",
    ]);
    expectPlainNoResponseCopy(fallo.detail);
    expect(fallo.detail).toContain(OFFICIAL_CHECK_STATUS_DETAIL.no_se_pudo);

    const faltan = resolveOfficialCheckDisplay({
      consentGranted: true,
      summary: summary("sin_datos", {
        checkedAt: "2026-09-21T15:30:00.000Z",
        identity: { nss: false, curp: false, rfc: false },
      }),
      identity: { nss: false, curp: false, rfc: false },
      missingIdentityDetail: "Falta tu NSS y RFC en el recibo para consultar.",
    });
    expect(faltan.headline).toBe("Faltan datos · 21/09/2026");
    expect(faltan.detail).toMatch(/Falta tu NSS y RFC/);
    expect(faltan.status).toBe("sin_datos");

    for (const display of [vivo, pendiente, fallo]) {
      expect(display.headline).not.toMatch(/Falta tu permiso/i);
      expect(display.buttonLabel).not.toMatch(/Falta tu permiso|Helios|HMAC/i);
      expect(display.buttonLabel).not.toMatch(/\bcumple\b/i);
      expect(display.detail).not.toMatch(/Helios|CompliLink|HMAC/i);
    }
    expect(vivo.detail).toMatch(/Hoy no pudimos consultar\. No prueba que tu patrón cumpla/);
    expect(vivo.detail).not.toMatch(/\bcumple\b/i);
  });

  it("con permiso elige el acuse honesto y descarta un sin_permiso viejo", () => {
    const picked = pickHonestOfficialCheck({
      consentGranted: true,
      candidates: [summary("sin_permiso"), summary("no_se_pudo"), summary("vivo")],
    });

    expect(picked?.overallStatus).toBe("no_se_pudo");
    expect(picked?.overallLabel).toBe("Sin respuesta");
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
    expect(anchor?.infonavit.motivoFallo).not.toMatch(/no de AuditaPatrón/);
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
    expect(noResponse?.imss.motivoFallo).toMatch(/no contestó hoy/);
    expect(noResponse?.imss.motivoFallo).not.toMatch(/no de AuditaPatrón/);
    expect(noResponse?.infonavit.estado).toBe("failed");
    expect(noResponse?.sat.estado).toBe("pending");

    expect(buildOfficialFailedDetail(["imss"])).toBe("Hoy no pudimos consultar IMSS. No prueba que tu patrón cumpla.");
    expect(buildOfficialFailedDetail(["imss"])).not.toMatch(/SAT|Infonavit/);
    expect(buildOfficialFailedDetail(["imss", "sat"])).toBe(
      "Hoy no pudimos consultar IMSS y SAT. No prueba que tu patrón cumpla.",
    );
    expectPlainNoResponseCopy(buildOfficialFailedDetail(["imss"]));
    expectPlainNoResponseCopy(buildOfficialFailedDetail(["imss", "sat", "infonavit"]));

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

  it("recibo con NSS y RFC visibles nunca pinta Faltan datos mentiroso", () => {
    const visible = { nss: true, curp: false, rfc: true };
    expect(canDispatchOfficialConsult(visible)).toBe(true);
    expect(canDispatchOfficialConsult({ nss: false, curp: true, rfc: false })).toBe(false);
    expect(isGenericSatRfc("XAXX010101000")).toBe(true);
    expect(identityFlagsFromReceiptValues({ nss: "12345678901", workerRfc: "XAXX010101000" })).toEqual({
      nss: true,
      curp: false,
      rfc: false,
    });

    const stale = summary("sin_datos", {
      checkedAt: "2026-09-21T15:30:00.000Z",
      identity: { nss: false, curp: false, rfc: false },
      overallDetail: "Falta tu NSS, CURP o RFC en el recibo para consultar.",
      checks: [
        {
          source: "imss",
          sourceLabel: "IMSS",
          status: "sin_datos",
          label: "Faltan datos",
          detail: "Falta tu NSS, CURP o RFC en el recibo para consultar.",
          checkedAt: "2026-09-21T15:30:00.000Z",
          used: { nss: false, curp: false, rfc: false },
          honesty: "failed",
          missingFields: ["nss", "curp", "rfc"],
        },
        {
          source: "sat",
          sourceLabel: "SAT",
          status: "sin_datos",
          label: "Faltan datos",
          detail: "Falta tu NSS, CURP o RFC en el recibo para consultar.",
          checkedAt: "2026-09-21T15:30:00.000Z",
          used: { nss: false, curp: false, rfc: false },
          honesty: "failed",
          missingFields: ["nss", "curp", "rfc"],
        },
        {
          source: "infonavit",
          sourceLabel: "Infonavit",
          status: "sin_datos",
          label: "Faltan datos",
          detail: "Falta tu CURP en el recibo para consultar.",
          checkedAt: "2026-09-21T15:30:00.000Z",
          used: { nss: false, curp: false, rfc: false },
          honesty: "failed",
          missingFields: ["curp"],
        },
      ],
      chatAnchor: {
        imss: {
          fuente: "imss",
          estado: "failed",
          fecha: "2026-09-21T15:30:00.000Z",
          hechos: ["Falta tu NSS, CURP o RFC en el recibo para consultar."],
          motivoFallo: "Falta tu NSS, CURP o RFC en el recibo para consultar.",
          missingFields: ["nss", "curp", "rfc"],
        },
        sat: {
          fuente: "sat",
          estado: "failed",
          fecha: "2026-09-21T15:30:00.000Z",
          hechos: ["Falta tu NSS, CURP o RFC en el recibo para consultar."],
          motivoFallo: "Falta tu NSS, CURP o RFC en el recibo para consultar.",
          missingFields: ["nss", "curp", "rfc"],
        },
        infonavit: {
          fuente: "infonavit",
          estado: "failed",
          fecha: "2026-09-21T15:30:00.000Z",
          hechos: ["Falta el CURP para consultar Infonavit."],
          motivoFallo: "Falta el CURP para consultar Infonavit.",
          missingFields: ["curp"],
        },
      },
    });

    const reconciled = reconcileOfficialCheckWithIdentity(stale, visible);
    expect(reconciled?.overallStatus).not.toBe("sin_datos");
    expect(reconciled?.overallLabel).not.toBe("Faltan datos");
    expect(reconciled?.identity).toEqual(visible);
    expect(reconciled?.checks.find((item) => item.source === "imss")?.status).not.toBe("sin_datos");
    expect(reconciled?.checks.find((item) => item.source === "sat")?.status).not.toBe("sin_datos");
    expect(reconciled?.checks.find((item) => item.source === "infonavit")?.status).toBe("sin_datos");

    const display = resolveOfficialCheckDisplay({
      consentGranted: true,
      summary: stale,
      identity: visible,
      missingIdentityDetail: "Falta tu CURP en el recibo para consultar.",
    });
    expect(display.headline).not.toMatch(/Faltan datos/i);
    expect(display.buttonLabel).not.toMatch(/Faltan datos/i);
    expect(display.status).not.toBe("sin_datos");
    expect(display.headline).toMatch(/Pendiente|Vivo|Hoy no se pudo comprobar|Todavía faltan respuestas|Aún no te podemos decir|Consulta IMSS y SAT/);
    expect(JSON.stringify(display)).not.toMatch(/Helios|CompliLink|HMAC|\bcumple\b/i);
  });

  it("NSS visible en lastUpload/OCR nunca genera «Falta tu NSS y RFC en el recibo para consultar.»", () => {
    const emptyIdentity = { nss: false, curp: false, rfc: false };
    const visibleNss = { nss: "12345678901", workerRfc: "XAXX010101000" };
    expect(officialDispatchGapDetail(emptyIdentity, visibleNss)).not.toBe(FALTA_NSS_Y_RFC_EXACT);
    expect(officialDispatchGapDetail(emptyIdentity, visibleNss)).not.toMatch(/Falta tu NSS/);
    expect(officialDispatchGapDetail(emptyIdentity)).toBe(FALTA_NSS_Y_RFC_EXACT);

    const stripped = stripContradictoryMissingIdentityCopy(
      FALTA_NSS_Y_RFC_EXACT,
      emptyIdentity,
      visibleNss,
    );
    expect(stripped).not.toMatch(/Falta tu NSS/);
    expect(stripped).not.toBe(FALTA_NSS_Y_RFC_EXACT);
  });

  it("Pendiente sin acuse oficial por más de 60s pasa a Falló y culpa al instituto", () => {
    const started = new Date("2026-09-21T15:30:00.000Z").getTime();
    const pending = summary("pendiente", {
      checkedAt: "2026-09-21T15:30:00.000Z",
      identity: { nss: true, curp: false, rfc: false },
      checks: [
        {
          source: "imss",
          sourceLabel: "IMSS",
          status: "pendiente",
          label: OFFICIAL_CHECK_STATUS_LABEL.pendiente,
          detail: OFFICIAL_CHECK_STATUS_DETAIL.pendiente,
          checkedAt: "2026-09-21T15:30:00.000Z",
          used: { nss: true, curp: false, rfc: false },
          honesty: "pending",
          hechos: [],
        },
      ],
    });

    const stillPending = reconcileOfficialCheckWithIdentity(pending, { nss: true, curp: false, rfc: false }, {
      nowMs: started + OFFICIAL_PENDING_STALE_MS,
    });
    expect(stillPending?.overallStatus).toBe("pendiente");
    expect(stillPending?.checks.find((item) => item.source === "imss")?.status).toBe("pendiente");

    const stale = reconcileOfficialCheckWithIdentity(pending, { nss: true, curp: false, rfc: false }, {
      nowMs: started + OFFICIAL_PENDING_STALE_MS + 1,
    });
    expect(stale?.overallStatus).toBe("no_se_pudo");
    expect(stale?.overallLabel).toBe("Sin respuesta");
    expectPlainNoResponseCopy(stale?.overallDetail ?? "");
    expect(stale?.checks.find((item) => item.source === "imss")?.status).toBe("no_se_pudo");

    const display = resolveOfficialCheckDisplay({
      consentGranted: true,
      summary: pending,
      identity: { nss: true, curp: false, rfc: false },
      nowMs: started + 70_000,
    });
    expect(display.status).toBe("no_se_pudo");
    expect(display.headline).toMatch(/Hoy no se pudo comprobar/);
    expect(display.buttonLabel).toBe(INSTITUTE_SILENCE_RETRY);
    expect(display.headline).not.toMatch(/Falló/);
    expectPlainNoResponseCopy(display.detail);
  });

  it("Pendiente sin checkedAt usa la fecha del ancla o el reloj de la tarjeta y pasa a Falló", () => {
    const started = new Date("2026-09-21T15:30:00.000Z").getTime();
    const imssCheck = {
      source: "imss" as const,
      sourceLabel: "IMSS",
      status: "pendiente" as const,
      label: OFFICIAL_CHECK_STATUS_LABEL.pendiente,
      detail: OFFICIAL_CHECK_STATUS_DETAIL.pendiente,
      checkedAt: null,
      used: { nss: true, curp: false, rfc: false },
      honesty: "pending" as const,
      hechos: [],
    };
    const anchor = {
      fuente: "imss" as const,
      estado: "pending" as const,
      fecha: "2026-09-21T15:30:00.000Z",
      hechos: ["Todavía no hay una respuesta oficial nueva de IMSS."],
      motivoFallo: null,
    };
    const fromAnchor = reconcileOfficialCheckWithIdentity(
      summary("pendiente", {
        checkedAt: null,
        identity: { nss: true, curp: false, rfc: false },
        checks: [imssCheck],
        chatAnchor: {
          imss: anchor,
          sat: { ...anchor, fuente: "sat", hechos: ["Todavía no hay una respuesta oficial nueva de SAT."] },
          infonavit: { ...anchor, fuente: "infonavit", hechos: ["Todavía no hay una respuesta oficial nueva de Infonavit."] },
        },
      }),
      { nss: true, curp: false, rfc: false },
      { nowMs: started + 70_000 },
    );
    expect(fromAnchor?.checks.find((item) => item.source === "imss")?.status).toBe("no_se_pudo");
    expectPlainNoResponseCopy(fromAnchor?.checks.find((item) => item.source === "imss")?.detail ?? "");
    expect(fromAnchor?.overallStatus).toBe("no_se_pudo");

    const fromCard = reconcileOfficialCheckWithIdentity(
      summary("pendiente", {
        checkedAt: null,
        identity: { nss: true, curp: false, rfc: false },
        checks: [imssCheck],
      }),
      { nss: true, curp: false, rfc: false },
      { nowMs: started + 70_000, pendingSinceMs: started },
    );
    expect(fromCard?.overallStatus).toBe("no_se_pudo");
    expect(fromCard?.checks.find((item) => item.source === "imss")?.status).toBe("no_se_pudo");
    expectPlainNoResponseCopy(fromCard?.overallDetail ?? "");
    expect(fromCard?.overallDetail ?? "").not.toMatch(/Falta tu NSS/);
  });

  it("un SAT vivo no congela el IMSS que sigue Pendiente más de 60s", () => {
    const started = new Date("2026-09-21T15:30:00.000Z").getTime();
    const stale = reconcileOfficialCheckWithIdentity(
      summary("pendiente", {
        checkedAt: "2026-09-21T15:30:00.000Z",
        identity: { nss: true, curp: false, rfc: true },
        checks: [
          {
            source: "imss",
            sourceLabel: "IMSS",
            status: "pendiente",
            label: OFFICIAL_CHECK_STATUS_LABEL.pendiente,
            detail: OFFICIAL_CHECK_STATUS_DETAIL.pendiente,
            checkedAt: "2026-09-21T15:30:00.000Z",
            used: { nss: true, curp: false, rfc: false },
            honesty: "pending",
            hechos: [],
          },
          {
            source: "sat",
            sourceLabel: "SAT",
            status: "vivo",
            label: OFFICIAL_CHECK_STATUS_LABEL.vivo,
            detail: OFFICIAL_CHECK_STATUS_DETAIL.vivo,
            checkedAt: "2026-09-21T15:30:00.000Z",
            used: { nss: false, curp: false, rfc: true },
            honesty: "live",
            hechos: ["El SAT confirmó el RFC consultado."],
          },
        ],
      }),
      { nss: true, curp: false, rfc: true },
      { nowMs: started + 70_000 },
    );
    expect(stale?.checks.find((item) => item.source === "imss")?.status).toBe("no_se_pudo");
    expect(stale?.checks.find((item) => item.source === "sat")?.status).toBe("vivo");
  });

  it("no dice que falta el RFC si el de la persona ya está, y no usa el del patrón", () => {
    expect(
      officialSourceGapDetail("sat", {
        workerRfc: "UIPD9211257I0",
        employerRfc: "ECC190605VA1",
      }),
    ).not.toMatch(/Falta tu RFC|Falta el RFC|Falta un RFC/i);
    expect(
      officialSourceGapDetail("sat", { employerRfc: "ECC190605VA1" }),
    ).toBe("Falta el RFC de la persona trabajadora para consultar SAT.");
    expect(
      officialSourceGapDetail("sat", {
        workerRfc: "UIPD9211257I0",
        employerRfc: "ECC190605VA1",
      }),
    ).toBe(OFFICIAL_CHECK_STATUS_DETAIL.pendiente);
  });

  it("SAT vivo con IMSS e Infonavit en mantenimiento no dice que las tres fallaron", () => {
    const checkedAt = "2026-09-21T12:00:00.000Z";
    const failed = (source: "imss" | "infonavit", label: string) => ({
      source,
      sourceLabel: label,
      status: "no_se_pudo" as const,
      label: "Sin respuesta",
      detail: "503 mantenimiento",
      checkedAt,
      used: { nss: true, curp: true, rfc: true },
      honesty: "failed" as const,
      hechos: [`${label} en mantenimiento.`],
      motivoFallo: "503 mantenimiento",
    });
    const display = resolveOfficialCheckDisplay({
      consentGranted: true,
      identity: { nss: true, curp: true, rfc: true },
      facts: {
        nss: "84129214965",
        curp: "UIPD921125HYNCLD03",
        workerRfc: "UIPD9211257I0",
        employerRfc: "ECC190605VA1",
      },
      summary: {
        configured: true,
        consentGranted: true,
        overallStatus: "no_se_pudo",
        overallLabel: "Sin respuesta",
        overallDetail: INSTITUTE_SILENCE_VERDICT,
        checkedAt,
        identity: { nss: true, curp: true, rfc: true },
        checks: [
          failed("imss", "IMSS"),
          {
            source: "sat",
            sourceLabel: "SAT",
            status: "no_se_pudo",
            label: "Sin respuesta",
            detail: "Hoy no hubo respuesta.",
            checkedAt,
            used: { nss: true, curp: true, rfc: true },
            honesty: "failed",
            hechos: ["Hoy no hubo respuesta."],
            motivoFallo: "Hoy no hubo respuesta.",
          },
          failed("infonavit", "Infonavit"),
        ],
        chatAnchor: {
          imss: {
            fuente: "imss",
            estado: "failed",
            fecha: checkedAt,
            hechos: ["IMSS en mantenimiento."],
            motivoFallo: "503 mantenimiento",
          },
          sat: {
            fuente: "sat",
            estado: "live",
            fecha: checkedAt,
            hechos: ["RFC: UIPD9211257I0", "Situación: activo"],
            motivoFallo: null,
          },
          infonavit: {
            fuente: "infonavit",
            estado: "failed",
            fecha: checkedAt,
            hechos: ["Infonavit en mantenimiento."],
            motivoFallo: "503 mantenimiento",
          },
        },
      },
    });

    expect(display.headline).toBe("Aún no te podemos decir si tu patrón te tiene bien registrado.");
    expect(display.headline).not.toMatch(/\bVivo\b|\bFalló\b|\d{2}\/\d{2}\/\d{4}/);
    const openerSentences = display.silence?.opener.split(/[.!?]/).filter((part) => part.trim()) ?? [];
    expect(openerSentences.length).toBeGreaterThanOrEqual(3);
    expect(openerSentences.length).toBeLessThanOrEqual(4);
    expect(display.silence?.opener).not.toMatch(/Vivo|Falló|UIPD|RFC|NSS|certificado/i);
    expect(display.silence?.opener).not.toContain(display.headline);
    expect(display.silence?.opener).not.toContain("Tu recibo sí se leyó");
    expect(display.silence?.opener).not.toContain("Vuelve a consultar");
    expect(display.headline).not.toBe(INSTITUTE_SILENCE_VERDICT);
    expect(display.silence?.whatHappened).toBe("Todavía faltan dos respuestas para saber si tu patrón te tiene bien registrado.");
    expect(display.silence?.whatHappened).not.toMatch(/en mantenimiento|\bVivo\b/);
    expect(display.silence?.meaning).toMatch(/Tu recibo sí se leyó/);
    expect(display.silence?.meaning).not.toMatch(/SAT también|SAT no contest/);
    expect(display.silence?.sourceLines.some((line) => line.startsWith("SAT contestó"))).toBe(true);
    expect(display.silence?.sourceLines.join("\n")).not.toMatch(/\bVivo\b|\bvivo\b/);
    expect(display.silence?.sourceLines.some((line) => line.includes("UIPD9211257I0"))).toBe(true);
    expect(display.silence?.sourceLines.some((line) => line === "Hoy no pudimos consultar IMSS. No prueba que tu patrón cumpla. Está en mantenimiento.")).toBe(true);
    expect(display.silence?.sourceLines.some((line) => line === "Hoy no pudimos consultar Infonavit. No prueba que tu patrón cumpla. Está en mantenimiento.")).toBe(true);
    expect(display.silence?.sourceLines.join(" ")).not.toMatch(/SAT — sin respuesta/);
    expect(display.silence?.chat).toMatch(/UIPD9211257I0/);
    expect(display.silence?.chat).not.toMatch(/Hoy no se pudo comprobar. No prueba que te engañen./);
    expect(display.silence?.chat).not.toMatch(/Hoy pedimos datos a IMSS, SAT e Infonavit/);
    expect(JSON.stringify(display)).not.toMatch(/\bFalló\b|no de AuditaPatrón/);
    expect(JSON.stringify(display)).not.toMatch(/\bcumple\b/i);
  });

  it("no enseña el nombre del expediente como razón social y no marca Vivo con el gancho vacío", () => {
    const checkedAt = "2026-09-21T12:00:00.000Z";
    const failed = (source: "imss" | "infonavit", label: string, maintenance: boolean) => ({
      fuente: source,
      estado: "failed" as const,
      fecha: checkedAt,
      hechos: [maintenance ? `${label} en mantenimiento.` : `${label} no contestó.`],
      motivoFallo: maintenance ? "503 mantenimiento" : "timeout",
      missingFields: [] as string[],
    });
    const displayOf = (satHechos: string[]) =>
      resolveOfficialCheckDisplay({
        consentGranted: true,
        summary: {
          configured: true,
          consentGranted: true,
          overallStatus: "no_se_pudo",
          overallLabel: "Sin respuesta",
          overallDetail: "Hoy no hubo respuesta.",
          checkedAt,
          identity: { nss: true, curp: true, rfc: true },
          checks: [],
          chatAnchor: {
            imss: failed("imss", "IMSS", false),
            sat: {
              fuente: "sat",
              estado: "live",
              fecha: checkedAt,
              hechos: satHechos,
              motivoFallo: null,
              missingFields: [],
            },
            infonavit: failed("infonavit", "Infonavit", false),
          },
        },
      });

    const answered = displayOf([
      "El SAT confirmó el RFC consultado.",
      "Razón social en SAT: EXPEDIENTE UIPD9211257I0.",
      "Tipo de persona en SAT: Persona física.",
    ]);
    const answeredLines = answered.silence?.sourceLines.join("\n") ?? "";
    expect(answered.headline).toBe("Aún no te podemos decir si tu patrón te tiene bien registrado.");
    expect(answeredLines).toMatch(/SAT contestó/);
    expect(answeredLines).not.toMatch(/\bVivo\b|\bvivo\b/);
    expect(answeredLines).toMatch(/El SAT confirmó el RFC consultado/);
    expect(answeredLines).toMatch(/Tipo de persona en SAT: Persona física/);
    expect(answeredLines).not.toMatch(/Razón social|EXPEDIENTE/i);
    expect(JSON.stringify(answered)).not.toMatch(/\bcumple\b/i);

    const realName = displayOf([
      "El SAT confirmó el RFC consultado.",
      "Razón social en SAT: EVOLUCION CREATIVA CAMREFLEX, S.A. DE C.V.",
    ]);
    expect(realName.silence?.sourceLines.join("\n")).toMatch(/Nombre en el SAT: EVOLUCION CREATIVA CAMREFLEX/);

    for (const hook of [
      ["Razón social en SAT: EXPEDIENTE UIPD9211257I0."],
      ["Razón social en SAT: UIPD9211257I0"],
      ["Razón social en SAT:"],
      ["Razón social en SAT: Bóveda UIPD9211257I0"],
      [],
    ]) {
      const emptyHook = displayOf(hook);
      expect(emptyHook.silence?.sourceLines.join("\n") ?? "").not.toMatch(/SAT contestó|Razón social|EXPEDIENTE/i);
      expect(emptyHook.headline).toBe(INSTITUTE_SILENCE_VERDICT);
    }

    expect(isPlaceholderSatLegalName("EXPEDIENTE UIPD9211257I0", "UIPD9211257I0")).toBe(true);
    expect(isPlaceholderSatLegalName("UIPD9211257I0", "UIPD9211257I0")).toBe(true);
    expect(isPlaceholderSatLegalName("", "UIPD9211257I0")).toBe(true);
    expect(isPlaceholderSatLegalName("EVOLUCION CREATIVA CAMREFLEX, S.A. DE C.V.")).toBe(false);
    expect(isUnusableSatLegalNameLine("Razón social en SAT: EXPEDIENTE UIPD9211257I0.")).toBe(true);
    expect(hasUsableSatResponse(["Razón social en SAT: EXPEDIENTE UIPD9211257I0."])).toBe(false);
    expect(hasUsableSatResponse(["El SAT confirmó el RFC consultado."])).toBe(true);
  });
});

function instituteCheck(
  source: "imss" | "sat" | "infonavit",
  status: OfficialCheckSummary["overallStatus"],
  hechos: string[] = [],
): OfficialCheckSummary["checks"][number] {
  return {
    source,
    sourceLabel: source === "sat" ? "SAT" : source === "imss" ? "IMSS" : "Infonavit",
    status,
    label: OFFICIAL_CHECK_STATUS_LABEL[status],
    detail: OFFICIAL_CHECK_STATUS_DETAIL[status],
    checkedAt: "2026-09-21T12:00:00.000Z",
    used: { nss: source === "imss", curp: source === "infonavit", rfc: source === "sat" },
    honesty: status === "vivo" ? "live" : status === "pendiente" ? "pending" : "failed",
    hechos,
  };
}

describe("resultado parcial sin esperar al instituto lento", () => {
  const now = Date.parse("2026-09-21T12:00:05.000Z");

  it("muestra el SAT en cuanto hay hechos y deja sin respuesta hoy en los que siguen pendientes", () => {
    const display = resolveOfficialCheckDisplay({
      consentGranted: true,
      nowMs: now,
      pendingSinceMs: now,
      summary: summary("pendiente", {
        checkedAt: "2026-09-21T12:00:00.000Z",
        identity: { nss: true, curp: true, rfc: true },
        checks: [
          instituteCheck("sat", "vivo", ["RFC: UIPD9211257I0"]),
          instituteCheck("imss", "pendiente"),
          instituteCheck("infonavit", "pendiente"),
        ],
      }),
    });

    expect(display.headline).toBe("Aún no te podemos decir si tu patrón te tiene bien registrado.");
    expect(display.status).toBe("vivo");
    expect(display.silence?.sourceLines.join("\n")).toMatch(/SAT contestó/);
    expect(display.silence?.sourceLines.join("\n")).not.toMatch(/\bVivo\b|\bvivo\b/);
    expect(display.silence?.sourceLines.join("\n")).toMatch(/RFC: UIPD9211257I0/);
    expect(display.silence?.whatHappened).toBe("Todavía faltan dos respuestas para saber si tu patrón te tiene bien registrado.");
    expect(display.silence?.sourceLines.join("\n")).toMatch(/IMSS: seguimos preguntando/);
    expect(display.silence?.sourceLines.join("\n")).toMatch(/Infonavit: seguimos preguntando/);
    expect(display.silence?.sourceLines.join("\n")).not.toMatch(/no contestó/);
    expect(display.headline).not.toBe(INSTITUTE_WAITING_HEADLINE);
    expect(display.detail).not.toMatch(/\bbackup\b|failover|Helios|CompliLink|\bcumple\b|Syntage/i);
    expect(display.silence?.whatHappened).not.toMatch(/Consultamos otra vía oficial/);
  });

  it("muestra la tarjeta del SAT aunque las otras oficinas no vengan en el resultado", () => {
    const display = resolveOfficialCheckDisplay({
      consentGranted: true,
      nowMs: now,
      pendingSinceMs: now,
      summary: summary("pendiente", {
        checkedAt: "2026-09-21T12:00:00.000Z",
        overallDetail: "Todavía no hay una respuesta oficial nueva. Inténtalo más tarde.",
        identity: { nss: true, curp: true, rfc: true },
        checks: [instituteCheck("sat", "vivo", ["RFC: UIPD9211257I0"])],
      }),
    });

    expect(display.silence?.kind).toBe("mixed");
    expect(display.headline).toBe("Aún no te podemos decir si tu patrón te tiene bien registrado.");
    expect(display.headline).not.toMatch(/Todavía no hay una respuesta oficial/);
    expect(display.silence?.whatHappened).toBe("Todavía faltan dos respuestas para saber si tu patrón te tiene bien registrado.");
    expect(display.silence?.sourceLines.join("\n")).toMatch(/RFC: UIPD9211257I0/);
    expect(display.silence?.sourceLines.join("\n")).not.toMatch(/no contestó/);
  });

  it("sigue en espera si nadie ha contestado", () => {
    const display = resolveOfficialCheckDisplay({
      consentGranted: true,
      nowMs: now,
      pendingSinceMs: now,
      summary: summary("pendiente", {
        checkedAt: "2026-09-21T12:00:00.000Z",
        checks: [
          instituteCheck("sat", "pendiente"),
          instituteCheck("imss", "pendiente"),
          instituteCheck("infonavit", "pendiente"),
        ],
      }),
    });
    expect(display.status).toBe("pendiente");
    expect(display.headline).toBe(INSTITUTE_WAITING_HEADLINE);
    expect(display.silence).toBeFalsy();
  });

  it("no tapa los hechos ya vivos mientras sigue la consulta", () => {
    const display = resolveOfficialCheckDisplay({
      consentGranted: true,
      isPending: true,
      nowMs: now,
      summary: summary("vivo", {
        checkedAt: "2026-09-21T12:00:00.000Z",
        identity: { nss: true, curp: true, rfc: true },
        checks: [
          instituteCheck("sat", "vivo", ["RFC: UIPD9211257I0"]),
          instituteCheck("imss", "no_se_pudo"),
          instituteCheck("infonavit", "no_se_pudo"),
        ],
      }),
    });
    expect(display.headline).toBe("Aún no te podemos decir si tu patrón te tiene bien registrado.");
    expect(display.buttonLabel).toBe(OFFICIAL_CHECK_LOADING_LABEL);
    expect(display.silence?.sourceLines.join(" ")).toMatch(/UIPD9211257I0/);
  });

  it("menciona la otra consulta oficial solo si el retorno trae la señal", () => {
    expect(readAlternateOfficialRoute({ failover: true })).toBe(true);
    expect(readAlternateOfficialRoute({ result: { sat: { providerRole: "backup" } } })).toBe(true);
    expect(readAlternateOfficialRoute({ backupJumps: [{ from: "principal", to: "secundaria" }] })).toBe(true);
    expect(readAlternateOfficialRoute({ helios: { backupJumps: [1] } })).toBe(true);
    expect(readAlternateOfficialRoute({ backupJumps: [] })).toBe(false);
    expect(readAlternateOfficialRoute({ providerId: 30001, provider: "syntage" })).toBe(false);
    expect(readAlternateOfficialRoute({ sat: { rfc: "UIPD9211257I0" } })).toBe(false);

    const withSignal = resolveOfficialCheckDisplay({
      consentGranted: true,
      nowMs: now,
      summary: summary("vivo", {
        checkedAt: "2026-09-21T12:00:00.000Z",
        alternateRoute: true,
        identity: { nss: true, curp: true, rfc: true },
        checks: [
          instituteCheck("sat", "vivo", ["RFC: UIPD9211257I0"]),
          instituteCheck("imss", "no_se_pudo"),
          instituteCheck("infonavit", "no_se_pudo"),
        ],
      }),
    });
    expect(withSignal.silence?.meaning).toContain("Consultamos otra vía oficial.");
    expect(withSignal.silence?.meaning).not.toContain("no hubo datos útiles");
    expect(withSignal.detail).toBe("Todavía faltan dos respuestas para saber si tu patrón te tiene bien registrado.");
    expect(withSignal.silence?.verdict).not.toContain("Consultamos otra vía oficial");
    expect(withSignal.silence?.whatHappened).not.toContain("Consultamos otra vía oficial");
    expect(withSignal.detail).not.toMatch(/\bbackup\b|failover|proveedor|Helios/i);

    const withoutSignal = resolveOfficialCheckDisplay({
      consentGranted: true,
      nowMs: now,
      summary: summary("vivo", {
        checkedAt: "2026-09-21T12:00:00.000Z",
        identity: { nss: true, curp: true, rfc: true },
        checks: [instituteCheck("sat", "vivo", ["RFC: UIPD9211257I0"])],
      }),
    });
    expect(withoutSignal.detail).not.toContain("Consultamos otra vía oficial");
    expect(JSON.stringify(withoutSignal)).not.toContain("Consultamos otra vía oficial");

    const signalWithoutFacts = resolveOfficialCheckDisplay({
      consentGranted: true,
      nowMs: now,
      summary: summary("no_se_pudo", {
        checkedAt: "2026-09-21T12:00:00.000Z",
        alternateRoute: true,
        identity: { nss: true, curp: true, rfc: true },
        checks: [
          instituteCheck("sat", "no_se_pudo"),
          instituteCheck("imss", "no_se_pudo"),
          instituteCheck("infonavit", "no_se_pudo"),
        ],
      }),
    });
    expect(signalWithoutFacts.headline).toBe("Hoy no se pudo comprobar. No prueba que te engañen.");
    expect(signalWithoutFacts.silence?.whatHappened).toBe("Hoy no pudimos consultar IMSS, SAT e Infonavit. No prueba que tu patrón cumpla.");
    expect(signalWithoutFacts.silence?.meaning).toContain("Consultamos otra vía oficial y hoy no hubo datos útiles.");
    expect(signalWithoutFacts.headline).not.toContain("Consultamos otra vía oficial");
    expect(signalWithoutFacts.silence?.whatHappened).not.toContain("Consultamos otra vía oficial");
    expect(JSON.stringify(signalWithoutFacts)).not.toMatch(/\bbackup\b|failover|Syntage|\bcumple\b/i);
  });

  it("al refrescar, prefiere la consulta que ya tiene hechos vivos", () => {
    const olderSilence = summary("no_se_pudo", { checkedAt: "2026-09-21T12:00:00.000Z" });
    const newerSat = summary("vivo", {
      checkedAt: "2026-09-21T12:00:20.000Z",
      checks: [instituteCheck("sat", "vivo", ["RFC: UIPD9211257I0"])],
    });
    expect(pickPromptOfficialCheck({ consentGranted: true, candidates: [olderSilence, newerSat] })?.overallStatus).toBe("vivo");
    expect(
      shouldPollOfficialCheck(
        summary("vivo", {
          checkedAt: "2026-09-21T12:00:00.000Z",
          checks: [instituteCheck("sat", "vivo", ["RFC: UIPD9211257I0"]), instituteCheck("imss", "pendiente")],
        }),
      ),
    ).toBe(true);
    expect(shouldPollOfficialCheck(summary("no_se_pudo", { checkedAt: "2026-09-21T12:00:00.000Z", bridgeBlock: "provider_cap" }))).toBe(false);
  });
});

describe("esqueleto del recibo y lo laboral en segundo plano", () => {
  const satFirst = summary("pendiente", {
    checkedAt: "2026-09-21T12:00:00.000Z",
    identity: { nss: true, curp: true, rfc: true },
    checks: [
      instituteCheck("sat", "vivo", ["RFC: UIPD9211257I0", "Régimen 612."]),
      instituteCheck("imss", "pendiente"),
      instituteCheck("infonavit", "pendiente"),
    ],
  });

  it("muestra los hechos del SAT sin decir que lo laboral ya se revisó", () => {
    expect(liveSatFactLines(satFirst)).toEqual(["RFC: UIPD9211257I0", "Régimen 612."]);
    expect(laborInstitutesSettled(satFirst)).toBe(false);
    expect(buildReceiptEstatusLine(satFirst)).toBe("RFC: UIPD9211257I0 · Régimen 612.");
    expect(buildReceiptEstatusLine(satFirst)).not.toContain(LABOR_REVIEW_READY);
    expect(buildReceiptEstatusLine(satFirst)).not.toMatch(/\bcumple\b/i);
  });

  it("deja el estatus vacío mientras nadie contesta", () => {
    const waiting = summary("pendiente", {
      checks: [
        instituteCheck("sat", "pendiente"),
        instituteCheck("imss", "pendiente"),
        instituteCheck("infonavit", "pendiente"),
      ],
    });
    expect(buildReceiptEstatusLine(waiting)).toBeNull();
    expect(laborInstitutesSettled(waiting)).toBe(false);
    expect(liveSatFactLines(waiting)).toEqual([]);
  });

  it("dice que ya revisó lo laboral solo cuando IMSS e Infonavit terminaron", () => {
    const settled = summary("vivo", {
      checks: [
        instituteCheck("sat", "vivo", ["RFC: UIPD9211257I0"]),
        instituteCheck("imss", "no_se_pudo"),
        instituteCheck("infonavit", "vivo", ["NSS localizado."]),
      ],
    });
    expect(laborInstitutesSettled(settled)).toBe(true);
    expect(buildReceiptEstatusLine(settled)).toBe(`RFC: UIPD9211257I0 ${LABOR_REVIEW_READY}`);

    const stillOpen = summary("vivo", {
      checks: [
        instituteCheck("sat", "vivo", ["RFC: UIPD9211257I0"]),
        instituteCheck("imss", "no_se_pudo"),
        instituteCheck("infonavit", "sin_datos"),
      ],
    });
    expect(laborInstitutesSettled(stillOpen)).toBe(false);
    expect(buildReceiptEstatusLine(stillOpen)).not.toContain(LABOR_REVIEW_READY);
  });

  it("cuando todos callan, el estatus es silencio y lo laboral ya revisado", () => {
    const silent = summary("no_se_pudo", {
      checks: [
        instituteCheck("sat", "no_se_pudo"),
        instituteCheck("imss", "no_se_pudo"),
        instituteCheck("infonavit", "no_se_pudo"),
      ],
    });
    expect(laborInstitutesSettled(silent)).toBe(true);
    expect(liveSatFactLines(silent)).toEqual([]);
    expect(buildReceiptEstatusLine(silent)).toBe(`Sin respuesta hoy. ${LABOR_REVIEW_READY}`);
    expect(RECEIPT_RECEIVED_ACK).toBe("Recibo recibido ✓");
    expect(RECEIPT_VALIDATION_CORRECTION).toBe("No pudimos validar el recibo. Intenta de nuevo.");
    expect(`${RECEIPT_RECEIVED_ACK} ${LABOR_REVIEW_READY}`).not.toMatch(/\bcumple\b|Helios|CompliLink/i);
  });
});

describe("veredicto de bolsillo", () => {
  const answered = [
    instituteCheck("imss", "vivo", ["NSS localizado."]),
    instituteCheck("sat", "vivo", ["RFC: UIPD9211257I0"]),
    instituteCheck("infonavit", "vivo", ["Crédito localizado."]),
  ];

  it("cuando las tres contestan, el título dice si cuadra, si hay que revisar, o si no se pudo", () => {
    const fine = resolveOfficialCheckDisplay({
      consentGranted: true,
      summary: summary("vivo", {
        checkedAt: "2026-09-21T12:00:00.000Z",
        identity: { nss: true, curp: true, rfc: true },
        reciboVsOficial: { resultado: "bien", motivo: "cuadra" },
        checks: answered,
      }),
    });
    expect(fine.headline).toBe("Por lo que vimos hoy, lo que comparamos cuadra con tu recibo.");
    expect(fine.silence?.meaning).not.toMatch(/en orden/);
    expect(fine.silence?.smallPrint).toBe("Esto es solo lo consultado hoy. No cubre todo tu trabajo.");
    expect(fine.buttonLabel).toBe("Guardar y listo");
    expect(fine.headline).not.toMatch(/\bVivo\b|certificado|RFC confirmado|\bcumple\b/i);

    const watch = resolveOfficialCheckDisplay({
      consentGranted: true,
      summary: summary("vivo", {
        identity: { nss: true, curp: true, rfc: true },
        reciboVsOficial: { resultado: "hay_diferencia", motivo: "sueldo" },
        checks: answered,
      }),
    });
    expect(watch.headline).toBe("Hay algo que no cuadra con lo que dice tu recibo. Conviene revisar.");
    expect(watch.buttonLabel).toBe("Ver qué no cuadra");
    expect(watch.silence?.askLabel).toBe("¿Qué implica esto para mi pago?");

    const unknown = resolveOfficialCheckDisplay({
      consentGranted: true,
      summary: summary("vivo", {
        identity: { nss: true, curp: true, rfc: true },
        checks: answered,
      }),
    });
    expect(unknown.headline).toBe("Hoy no se pudo comprobar. No prueba que te engañen.");
    expect(unknown.buttonLabel).toBe("Probar de nuevo mañana");
  });
});

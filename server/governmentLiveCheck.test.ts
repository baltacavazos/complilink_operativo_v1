import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

import {
  OFFICIAL_CHECK_BUTTON,
  OFFICIAL_CHECK_CONSENT,
  OFFICIAL_CHECK_STATUS_LABEL,
  buildOfficialCheckHeadline,
} from "@shared/officialCheckCopy";
import {
  buildAuditaPatronEngineSignature,
  canonicalizeEngineWebhookUrl,
} from "./auditaPatronIntegrationService";
import { buildPreliminaryLaborAnalysis } from "./caseContracts";
import {
  OFFICIAL_CHECK_ACTION,
  buildOfficialCheckBridgePayload,
  collectWorkerOfficialIdentity,
  extractReceiptOfficialIdentity,
  mergeWorkerOfficialIdentities,
  getOfficialCheckAvailability,
  isOfficialCheckConfigured,
  officialCheckFromBridgeReturn,
  resolveOfficialCheckTargetUrls,
  resolveOfficialCheckWebhookUrl,
  runOfficialGovernmentCheck,
} from "./governmentLiveCheck";

const ENGINE_ENV = {
  AUDITAPATRON_ENGINE_WEBHOOK_URL: "https://complilink.mx/api/integrations/auditapatron/bridge",
  AUDITAPATRON_ENGINE_HMAC_SECRET: "bridge-hmac-secret-123456",
};

function readPosted(fetchImpl: ReturnType<typeof vi.fn>) {
  const [url, init] = fetchImpl.mock.calls[0] ?? [];
  return {
    url: String(url ?? ""),
    init: (init ?? {}) as RequestInit,
    body: String((init as RequestInit | undefined)?.body ?? ""),
  };
}

describe("consulta IMSS/SAT vía puente Helios", () => {
  it("queda no configurado si faltan URL o HMAC del engine", () => {
    expect(isOfficialCheckConfigured({})).toBe(false);
    expect(
      isOfficialCheckConfigured({
        AUDITAPATRON_ENGINE_WEBHOOK_URL: ENGINE_ENV.AUDITAPATRON_ENGINE_WEBHOOK_URL,
      }),
    ).toBe(false);
    expect(getOfficialCheckAvailability(ENGINE_ENV).any).toBe(true);
    expect(canonicalizeEngineWebhookUrl(ENGINE_ENV.AUDITAPATRON_ENGINE_WEBHOOK_URL)).toBe(
      ENGINE_ENV.AUDITAPATRON_ENGINE_WEBHOOK_URL,
    );
    expect(
      canonicalizeEngineWebhookUrl("https://www.complilink.mx/api/integrations/auditapatron/bridge"),
    ).toBe("https://complilink.mx/api/integrations/auditapatron/bridge");
    expect(
      resolveOfficialCheckWebhookUrl("https://www.complilink.mx/api/integrations/auditapatron/bridge"),
    ).toBe("https://complilink.mx/api/integrations/auditapatron/bridge");
    expect(resolveOfficialCheckWebhookUrl("https://www.complilink.mx/api/auditapatron/webhook")).toBe(
      "https://complilink.mx/api/internal/helios/bridge",
    );
    expect(resolveOfficialCheckTargetUrls(ENGINE_ENV.AUDITAPATRON_ENGINE_WEBHOOK_URL)).toEqual([
      ENGINE_ENV.AUDITAPATRON_ENGINE_WEBHOOK_URL,
      "https://complilink.mx/api/internal/helios/bridge",
    ]);
    expect(resolveOfficialCheckTargetUrls("https://www.complilink.mx/api/internal/helios/bridge")).toEqual([
      "https://complilink.mx/api/internal/helios/bridge",
    ]);
  });

  it("devuelve aún no configurado sin llamar al puente", async () => {
    const fetchImpl = vi.fn();
    const result = await runOfficialGovernmentCheck({
      identity: { nss: "12345678901", curp: "DILE970625HBCZPM01", rfc: "XAXX010101000" },
      consentGranted: true,
      env: {},
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result.overallStatus).toBe("no_configurado");
    expect(result.overallLabel).toBe("Aún no configurado");
    expect(result.overallDetail).toMatch(/solo leemos tus papeles/i);
    expect(result.overallDetail).not.toMatch(/cumple/i);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("pide permiso y no inventa cumple", async () => {
    const fetchImpl = vi.fn();
    const result = await runOfficialGovernmentCheck({
      identity: { nss: "12345678901", curp: null, rfc: "VECJ880326XXX" },
      consentGranted: false,
      env: ENGINE_ENV,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result.overallStatus).toBe("sin_permiso");
    expect(result.overallDetail).toContain(OFFICIAL_CHECK_CONSENT);
    expect(result.overallLabel).not.toMatch(/cumple/i);
    expect(OFFICIAL_CHECK_BUTTON).toBe("Consultar IMSS y SAT");
    expect(OFFICIAL_CHECK_CONSENT).not.toMatch(/APIMarket|Helios|CompliLink|connector/i);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("pega a la URL del engine, firma el JSON exacto y manda Bearer = HMAC", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          action: OFFICIAL_CHECK_ACTION,
          result: { imss: { vigencia: "registrado" }, sat: { rfc: "VECJ880326XXX" } },
        }),
        { status: 200 },
      ),
    );

    const result = await runOfficialGovernmentCheck({
      identity: collectWorkerOfficialIdentity({
        nss: "12345678901",
        curp: "DILE970625HBCZPM01",
        workerRfc: "VECJ880326XXX",
      }),
      consentGranted: true,
      env: ENGINE_ENV,
      now: new Date("2026-09-21T15:30:00.000Z"),
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result.overallStatus).toBe("vivo");
    expect(result.overallLabel).toBe("Vivo");
    expect(result.overallDetail).toMatch(/no significa que tu patrón cumple/i);
    expect(buildOfficialCheckHeadline(result)).toBe("Vivo · 21/09/2026");
    expect(JSON.stringify(result)).not.toMatch(/APIMarket|Helios|CompliLink|connector/i);

    const posted = readPosted(fetchImpl);
    expect(posted.url).toBe(ENGINE_ENV.AUDITAPATRON_ENGINE_WEBHOOK_URL);
    expect(posted.url).not.toContain("/api/internal/helios/bridge");
    expect(posted.init.redirect).toBe("manual");
    const headers = posted.init.headers as Record<string, string>;
    expect(headers["X-AuditaPatron-Signature"]).toBe(
      buildAuditaPatronEngineSignature(
        headers["X-AuditaPatron-Timestamp"],
        posted.body,
        ENGINE_ENV.AUDITAPATRON_ENGINE_HMAC_SECRET,
      ),
    );
    expect(headers.Authorization).toBe(`Bearer ${ENGINE_ENV.AUDITAPATRON_ENGINE_HMAC_SECRET}`);
    const body = JSON.parse(posted.body) as Record<string, unknown>;
    expect(body.action).toBe(OFFICIAL_CHECK_ACTION);
    expect(body.providerId).toBeUndefined();
    expect(body.autonomousInput).toEqual({
      nss: "12345678901",
      curp: "DILE970625HBCZPM01",
      rfc: "VECJ880326XXX",
    });
    expect(body.worker).toEqual(body.autonomousInput);
    expect(body.identity).toEqual(body.autonomousInput);
    expect(body.workerIdentity).toEqual(body.autonomousInput);
  });

  it("si la URL es el intake, pega al puente derivado y firma timestamp+cuerpo", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ received: true, responseContract: "auditapatron.bridge.ack.v1" }), {
        status: 202,
      }),
    );

    const result = await runOfficialGovernmentCheck({
      identity: { nss: "12345678901", curp: null, rfc: null },
      consentGranted: true,
      env: {
        AUDITAPATRON_ENGINE_WEBHOOK_URL: "https://www.complilink.mx/api/auditapatron/webhook",
        AUDITAPATRON_ENGINE_HMAC_SECRET: ENGINE_ENV.AUDITAPATRON_ENGINE_HMAC_SECRET,
      },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result.overallStatus).toBe("pendiente");
    expect(result.overallLabel).toBe("Pendiente");
    expect(result.overallDetail).not.toMatch(/HMAC|Helios|cumple/i);
    const posted = readPosted(fetchImpl);
    expect(posted.url).toBe("https://complilink.mx/api/internal/helios/bridge");
    expect(posted.url).not.toContain("www.");
    expect(posted.init.redirect).toBe("manual");
    const headers = posted.init.headers as Record<string, string>;
    expect(headers["X-AuditaPatron-Signature"]).toBe(
      buildAuditaPatronEngineSignature(
        headers["X-AuditaPatron-Timestamp"],
        posted.body,
        ENGINE_ENV.AUDITAPATRON_ENGINE_HMAC_SECRET,
      ),
    );
    expect(headers.Authorization).toBe(`Bearer ${ENGINE_ENV.AUDITAPATRON_ENGINE_HMAC_SECRET}`);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("degrada HMAC 403 a no se pudo, sin inventar", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "Helios bridge HMAC authentication failed" }), { status: 403 }),
    );
    const result = await runOfficialGovernmentCheck({
      identity: { nss: "12345678901", curp: null, rfc: null },
      consentGranted: true,
      env: ENGINE_ENV,
      now: new Date("2026-09-21T12:00:00.000Z"),
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result.overallStatus).toBe("no_se_pudo");
    expect(result.overallLabel).toBe(OFFICIAL_CHECK_STATUS_LABEL.no_se_pudo);
    expect(result.overallDetail).toMatch(/inténtalo más tarde/i);
    expect(result.overallDetail).toMatch(/instituto|IMSS|SAT/);
    expect(result.overallDetail).toMatch(/no de AuditaPatrón/);
    expect(result.overallDetail).not.toMatch(/HMAC|Helios|cumple|respuesta usable/i);
    expect(result.checkedAt).toBe("2026-09-21T12:00:00.000Z");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(String(fetchImpl.mock.calls[0]?.[0])).toBe(ENGINE_ENV.AUDITAPATRON_ENGINE_WEBHOOK_URL);
  });

  it("muestra 404 de proveedor como no se pudo, no como consulta hecha", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "Provider not found" }), { status: 404 }),
    );
    const result = await runOfficialGovernmentCheck({
      identity: { nss: "12345678901", curp: "DILE970625HBCZPM01", rfc: "VECJ880326XXX" },
      consentGranted: true,
      env: ENGINE_ENV,
      now: new Date("2026-09-21T12:00:00.000Z"),
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result.overallStatus).toBe("no_se_pudo");
    expect(result.overallLabel).toBe("Falló");
    expect(result.overallDetail).toMatch(/Consultamos a IMSS y SAT hoy/);
    expect(result.overallDetail).toMatch(/no de AuditaPatrón/);
    expect(result.overallDetail).not.toMatch(/Provider|Helios|cumple|respuesta usable/i);
    expect(result.checkedAt).toBe("2026-09-21T12:00:00.000Z");
  });

  it("mantenimiento queda Pendiente con fecha; timeout o sin respuesta es Falló", async () => {
    const fetch503 = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: false, message: "Este endpoint se encuentra en mantenimiento" }), {
        status: 503,
      }),
    );
    const pending = await runOfficialGovernmentCheck({
      identity: { nss: "12345678901", curp: "DILE970625HBCZPM01", rfc: "VECJ880326XXX" },
      consentGranted: true,
      env: ENGINE_ENV,
      now: new Date("2026-09-21T12:00:00.000Z"),
      fetchImpl: fetch503 as unknown as typeof fetch,
      sleep: async () => undefined,
    });

    expect(pending.overallStatus).toBe("pendiente");
    expect(pending.overallLabel).toBe(OFFICIAL_CHECK_STATUS_LABEL.pendiente);
    expect(pending.checkedAt).toBe("2026-09-21T12:00:00.000Z");
    expect(pending.overallDetail).toMatch(/mantenimiento/);
    expect(pending.overallDetail).toMatch(/no de AuditaPatrón/);
    expect(pending.overallDetail).not.toMatch(/cumple|respuesta usable/i);
    expect(fetch503).toHaveBeenCalledTimes(2);

    const fetchTimeout = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error("connect timeout"), { name: "TimeoutError" }))
      .mockRejectedValueOnce(Object.assign(new Error("connect timeout"), { name: "TimeoutError" }));
    const timedOut = await runOfficialGovernmentCheck({
      identity: { nss: "12345678901", curp: null, rfc: null },
      consentGranted: true,
      env: ENGINE_ENV,
      fetchImpl: fetchTimeout as unknown as typeof fetch,
      sleep: async () => undefined,
    });
    expect(timedOut.overallStatus).toBe("no_se_pudo");
    expect(timedOut.overallLabel).toBe("Falló");
    expect(timedOut.overallDetail).toMatch(/Consultamos/);
    expect(timedOut.overallDetail).toMatch(/no contestó|instituto/);
    expect(timedOut.overallDetail).toMatch(/no de AuditaPatrón/);
    expect(timedOut.overallDetail).not.toMatch(/respuesta usable|fallo de AuditaPatrón/i);
    expect(timedOut.checkedAt).toBeTruthy();
    expect(fetchTimeout).toHaveBeenCalledTimes(2);
  });

  it("un acuse vacío no se inventa como consulta hecha", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          received: true,
          responseContract: "auditapatron.bridge.ack.v1",
        }),
        { status: 202 },
      ),
    );
    const result = await runOfficialGovernmentCheck({
      identity: { nss: "12345678901", curp: null, rfc: null },
      consentGranted: true,
      env: ENGINE_ENV,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result.overallStatus).toBe("pendiente");
    expect(result.checkedAt).toBeTruthy();
    expect(result.overallDetail).toMatch(/Todavía no hay una respuesta oficial nueva/);
    expect(result.overallDetail).not.toMatch(/no respondió|cumple/i);
  });

  it("lee IMSS/SAT/Infonavit honestos de document.processed.v1, sin jerga", () => {
    const vivo = officialCheckFromBridgeReturn({
      payload: {
        event: "document.processed.v1",
        analysisResults: {
          imss: "vivo",
          sat: "pendiente",
          infonavit: "falló",
        },
      },
      nowIso: "2026-09-21T12:00:00.000Z",
    });

    expect(vivo?.checks.map((item) => `${item.sourceLabel}: ${item.label}`)).toEqual([
      "IMSS: Vivo",
      "SAT: Pendiente",
      "Infonavit: Falló",
    ]);
    expect(JSON.stringify(vivo)).not.toMatch(/APIMarket|Helios|CompliLink|connector|document\.processed/i);
    expect(vivo?.overallStatus).toBe("vivo");

    const pending = officialCheckFromBridgeReturn({
      payload: { event: "document.processed.v1", analysisResults: { clauseCount: 9 } },
      nowIso: "2026-09-21T12:00:00.000Z",
    });
    expect(pending?.overallStatus).toBe("pendiente");
    expect(pending?.overallLabel).toBe("Pendiente");
  });

  it("si el puente queda pending por NSS/CURP/RFC, marca Faltan datos con fecha y qué falta", () => {
    const parsed = officialCheckFromBridgeReturn({
      payload: {
        event: "document.processed.v1",
        result: {
          officialCheck: {
            sat: {
              obligation: "sat",
              honesty: "pending",
              status: "pending",
              workerLabel: "Faltan datos",
              workerReason: "Falta el RFC para consultar SAT.",
              checkedAt: "2026-09-21T12:00:00.000Z",
              missingFields: ["rfc"],
              hechos: ["Falta el RFC para consultar SAT."],
            },
            imss: {
              obligation: "imss",
              honesty: "pending",
              status: "pending",
              workerLabel: "Faltan datos",
              workerReason: "Falta el NSS para consultar IMSS.",
              checkedAt: "2026-09-21T12:00:00.000Z",
              missingFields: ["nss"],
              hechos: ["Falta el NSS para consultar IMSS."],
            },
            infonavit: {
              obligation: "infonavit",
              honesty: "failed",
              status: "missing_identifiers",
              workerLabel: "Faltan datos",
              workerReason: "Falta el NSS para consultar Infonavit.",
              checkedAt: "2026-09-21T12:00:00.000Z",
              missingFields: ["nss"],
              hechos: ["Falta el NSS para consultar Infonavit."],
            },
          },
          chatAnchor: {
            sat: { fuente: "sat", estado: "pending", fecha: "2026-09-21T12:00:00.000Z", hechos: ["Falta el RFC para consultar SAT."], motivoFallo: null },
            imss: { fuente: "imss", estado: "pending", fecha: "2026-09-21T12:00:00.000Z", hechos: ["Falta el NSS para consultar IMSS."], motivoFallo: null },
            infonavit: { fuente: "infonavit", estado: "failed", fecha: "2026-09-21T12:00:00.000Z", hechos: ["Falta el NSS para consultar Infonavit."], motivoFallo: "Falta el NSS para consultar Infonavit." },
          },
          reciboVsOficial: { resultado: "no_se_pudo", motivo: "Faltan datos para comparar." },
        },
      },
      nowIso: "2026-09-21T12:00:00.000Z",
      identity: { nss: false, curp: true, rfc: false },
    });

    expect(parsed?.checks.find((item) => item.source === "imss")?.status).toBe("sin_datos");
    expect(parsed?.checks.find((item) => item.source === "sat")?.status).toBe("sin_datos");
    expect(parsed?.checks.find((item) => item.source === "infonavit")?.status).toBe("no_se_pudo");
    expect(parsed?.overallStatus).toBe("no_se_pudo");
    expect(parsed?.identity).toEqual({ nss: false, curp: true, rfc: false });
    expect(parsed?.reciboVsOficial?.resultado).toBe("no_se_pudo");
    expect(JSON.stringify(parsed)).not.toMatch(/APIMarket|Helios|CompliLink|HMAC|\b(sí )?cumple\b/i);
  });

  it("recibo con NSS y RFC sin CURP no marca IMSS/SAT overall Faltan datos", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          event: "document.processed.v1",
          result: {
            officialCheck: {
              imss: {
                honesty: "pending",
                status: "pending",
                missingFields: ["nss", "curp", "rfc"],
                hechos: ["Falta tu NSS, CURP o RFC en el recibo para consultar."],
              },
              sat: {
                honesty: "pending",
                status: "pending",
                missingFields: ["nss", "curp", "rfc"],
                hechos: ["Falta tu NSS, CURP o RFC en el recibo para consultar."],
              },
              infonavit: {
                honesty: "pending",
                status: "pending",
                missingFields: ["nss", "curp", "rfc"],
                hechos: ["Falta el CURP para consultar Infonavit."],
              },
            },
            chatAnchor: {
              imss: { fuente: "imss", estado: "pending", fecha: "2026-09-21T12:00:00.000Z", hechos: ["Falta tu NSS, CURP o RFC en el recibo para consultar."], motivoFallo: null, missingFields: ["nss", "curp", "rfc"] },
              sat: { fuente: "sat", estado: "pending", fecha: "2026-09-21T12:00:00.000Z", hechos: ["Falta tu NSS, CURP o RFC en el recibo para consultar."], motivoFallo: null, missingFields: ["nss", "curp", "rfc"] },
              infonavit: { fuente: "infonavit", estado: "pending", fecha: "2026-09-21T12:00:00.000Z", hechos: ["Falta el CURP para consultar Infonavit."], motivoFallo: null, missingFields: ["curp"] },
            },
            reciboVsOficial: { resultado: "hay_diferencia", motivo: "El SBC no coincide." },
          },
        }),
        { status: 200 },
      ),
    );

    const identity = collectWorkerOfficialIdentity({
      nss: "12345678901",
      workerRfc: "VECJ880326XXX",
    });
    const result = await runOfficialGovernmentCheck({
      identity,
      consentGranted: true,
      env: ENGINE_ENV,
      now: new Date("2026-09-21T12:00:00.000Z"),
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(identity).toMatchObject({ nss: "12345678901", curp: null, rfc: "VECJ880326XXX" });
    expect(result.identity).toEqual({ nss: true, curp: false, rfc: true });
    expect(result.overallStatus).toBe("pendiente");
    expect(result.overallLabel).toBe("Pendiente");
    expect(result.checks.find((item) => item.source === "imss")?.status).toBe("pendiente");
    expect(result.checks.find((item) => item.source === "sat")?.status).toBe("pendiente");
    expect(result.checks.find((item) => item.source === "infonavit")?.status).toBe("sin_datos");
    expect(result.checks.find((item) => item.source === "imss")?.missingFields).toEqual([]);
    expect(result.checks.find((item) => item.source === "sat")?.missingFields).toEqual([]);
    expect(result.checks.find((item) => item.source === "infonavit")?.missingFields).toEqual(["curp"]);
    expect(result.reciboVsOficial?.resultado).toBe("hay_diferencia");
    const posted = JSON.parse(String(fetchImpl.mock.calls[0]?.[1] && (fetchImpl.mock.calls[0][1] as RequestInit).body)) as Record<string, unknown>;
    expect(posted.autonomousInput).toEqual({ nss: "12345678901", rfc: "VECJ880326XXX" });
    expect(posted.worker).toEqual({ nss: "12345678901", curp: null, rfc: "VECJ880326XXX" });
    expect(JSON.stringify(result)).not.toMatch(/APIMarket|Helios|CompliLink|HMAC|\b(sí )?cumple\b/i);
  });

  it("el RFC del recibo, aunque sea genérico, no apaga SAT si ya se leyó como RFC de la persona", () => {
    const fromReceipt = collectWorkerOfficialIdentity({
      nss: "12345678901",
      workerRfc: "XAXX010101000",
    });
    expect(fromReceipt).toEqual({
      nss: "12345678901",
      curp: null,
      rfc: "XAXX010101000",
    });
    expect(
      mergeWorkerOfficialIdentities(
        { nss: null, curp: null, rfc: null },
        { nss: "12345678901", curp: null, rfc: null },
        { nss: null, curp: null, rfc: "XAXX010101000" },
      ),
    ).toEqual({
      nss: "12345678901",
      curp: null,
      rfc: "XAXX010101000",
    });

    const parsed = officialCheckFromBridgeReturn({
      payload: {
        event: "document.processed.v1",
        result: {
          officialCheck: {
            imss: { honesty: "pending", missingFields: ["nss", "curp", "rfc"] },
            sat: { honesty: "pending", missingFields: ["nss", "curp", "rfc"] },
            infonavit: { honesty: "pending", missingFields: ["curp"] },
          },
          reciboVsOficial: { resultado: "no_se_pudo", motivo: "Falta CURP para Infonavit." },
        },
      },
      identity: { nss: true, curp: false, rfc: true },
      nowIso: "2026-09-21T12:00:00.000Z",
    });

    expect(parsed?.overallStatus).toBe("pendiente");
    expect(parsed?.identity).toEqual({ nss: true, curp: false, rfc: true });
    expect(parsed?.checks.find((item) => item.source === "imss")?.status).toBe("pendiente");
    expect(parsed?.checks.find((item) => item.source === "sat")?.status).toBe("pendiente");
    expect(parsed?.checks.find((item) => item.source === "infonavit")?.status).toBe("sin_datos");
    expect(parsed?.reciboVsOficial?.motivo).toMatch(/CURP/);
  });

  it("saca NSS, CURP y RFC del texto del recibo", () => {
    const fromText = extractReceiptOfficialIdentity(
      "Recibo de nómina. NSS 12345678901 CURP DILE970625HBCZPM01 RFC del trabajador VECJ880326XXX. RFC del patrón ECC190605VA1.",
    );
    expect(fromText).toEqual({
      nss: "12345678901",
      curp: "DILE970625HBCZPM01",
      rfc: "VECJ880326XXX",
    });
    expect(
      collectWorkerOfficialIdentity({
        employerRfc: "ECC190605VA1",
        text: "NumSeguridadSocial 84129214965 Curp DILE970625HBCZPM01 RfcReceptor VECJ880326XXX",
      }),
    ).toMatchObject({
      nss: "84129214965",
      curp: "DILE970625HBCZPM01",
      rfc: "VECJ880326XXX",
    });
    expect(
      collectWorkerOfficialIdentity({
        nss: "12345678901",
        workerRfc: "XAXX010101000",
        text: "RFC del trabajador XAXX010101000 NSS 12345678901 neto $12,450",
      }),
    ).toEqual({
      nss: "12345678901",
      curp: null,
      rfc: "XAXX010101000",
    });
  });

  it("despacha SAT con el RFC de la persona, Infonavit con CURP e IMSS con NSS", () => {
    const textHint = readFileSync(new URL("./fixtures/nomina-cfdi-referencia.xml", import.meta.url), "utf8");
    const analysis = buildPreliminaryLaborAnalysis({
      fileName: "recibo-nomina.xml",
      mimeType: "application/xml",
      textHint,
    });
    const identity = collectWorkerOfficialIdentity({
      nss: analysis.confirmedData.payrollNss,
      curp: analysis.confirmedData.payrollCurp,
      workerRfc: analysis.confirmedData.workerRfc,
      employerRfc: analysis.confirmedData.employerRfc,
    });
    expect(identity).toEqual({
      nss: "84129214965",
      curp: "UIPD921125HYNCLD03",
      rfc: "UIPD9211257I0",
    });
    expect(identity.rfc).not.toBe("ECC190605VA1");
    expect(identity.curp).toBeTruthy();

    const payload = buildOfficialCheckBridgePayload({
      identity,
      nowIso: "2026-09-21T15:30:00.000Z",
    });
    expect(payload.sources).toEqual(["imss", "sat", "infonavit"]);
    expect(payload.nss).toBe("84129214965");
    expect(payload.curp).toBe("UIPD921125HYNCLD03");
    expect(payload.rfc).toBe("UIPD9211257I0");
    expect(payload.autonomousInput).toEqual({
      nss: "84129214965",
      curp: "UIPD921125HYNCLD03",
      rfc: "UIPD9211257I0",
    });
  });

  it("consume chatAnchor + officialCheck + reciboVsOficial del contrato CLK #97", () => {
    const parsed = officialCheckFromBridgeReturn({
      payload: {
        event: "document.processed.v1",
        result: {
          officialCheck: {
            sat: {
              obligation: "sat",
              honesty: "pending",
              status: "pending",
              workerLabel: "Pendiente",
              workerReason: "Todavía no hay una respuesta oficial nueva de SAT.",
              checkedAt: "2026-09-21T12:00:00.000Z",
              missingFields: [],
              hechos: ["Todavía no hay una respuesta oficial nueva de SAT."],
            },
            imss: {
              obligation: "imss",
              honesty: "live",
              status: "live",
              workerLabel: "Hay respuesta oficial",
              workerReason: "Ya hay una respuesta oficial de IMSS con fecha.",
              checkedAt: "2026-09-21T12:00:00.000Z",
              missingFields: [],
              hechos: ["Alta vigente: sí.", "Salario registrado: $450.25."],
            },
            infonavit: {
              obligation: "infonavit",
              honesty: "failed",
              status: "failed",
              workerLabel: "No se pudo consultar",
              workerReason: "Infonavit está en mantenimiento.",
              checkedAt: "2026-09-21T12:00:00.000Z",
              missingFields: [],
              hechos: ["Infonavit está en mantenimiento."],
            },
          },
          chatAnchor: {
            sat: { fuente: "sat", estado: "pending", fecha: "2026-09-21T12:00:00.000Z", hechos: ["Todavía no hay una respuesta oficial nueva de SAT."], motivoFallo: null },
            imss: { fuente: "imss", estado: "live", fecha: "2026-09-21T12:00:00.000Z", hechos: ["Alta vigente: sí.", "Salario registrado: $450.25."], motivoFallo: null },
            infonavit: { fuente: "infonavit", estado: "failed", fecha: "2026-09-21T12:00:00.000Z", hechos: ["Infonavit está en mantenimiento."], motivoFallo: "Infonavit está en mantenimiento." },
          },
          reciboVsOficial: { resultado: "hay_diferencia", motivo: "El SBC no coincide." },
        },
      },
      nowIso: "2026-09-21T12:00:00.000Z",
      identity: { nss: true, curp: false, rfc: true },
    });

    expect(parsed?.overallStatus).toBe("vivo");
    expect(parsed?.chatAnchor?.imss.estado).toBe("live");
    expect(parsed?.chatAnchor?.imss.hechos).toEqual(["Alta vigente: sí.", "Salario registrado: $450.25."]);
    expect(parsed?.chatAnchor?.infonavit.motivoFallo).toMatch(/mantenimiento/);
    expect(parsed?.reciboVsOficial?.resultado).toBe("hay_diferencia");
    expect(parsed?.checks.find((item) => item.source === "imss")?.hechos?.[0]).toMatch(/Alta vigente/);
    expect(JSON.stringify(parsed)).not.toMatch(/APIMarket|Helios|CompliLink|HMAC/i);
    expect(JSON.stringify(parsed)).toMatch(/No significa que tu patrón cumple/);
  });

  it("si el instituto no respondió, es Falló con fecha y motivo — no Pendiente eterno", () => {
    const parsed = officialCheckFromBridgeReturn({
      payload: {
        event: "document.processed.v1",
        result: {
          officialCheck: {
            imss: {
              honesty: "pending",
              status: "pending",
              workerReason: "El instituto no respondió hoy",
              checkedAt: null,
              hechos: ["El instituto no respondió hoy"],
            },
            sat: {
              honesty: "pending",
              status: "pending",
              workerReason: "Falta el RFC para consultar SAT.",
              missingFields: ["rfc"],
              hechos: ["Falta el RFC para consultar SAT."],
            },
            infonavit: {
              honesty: "pending",
              status: "pending",
              workerReason: "El instituto no respondió hoy",
              hechos: ["El instituto no respondió hoy"],
            },
          },
          chatAnchor: {
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
              hechos: ["Falta el RFC para consultar SAT."],
              motivoFallo: "Falta el RFC para consultar SAT.",
              missingFields: ["rfc"],
            },
            infonavit: {
              fuente: "infonavit",
              estado: "pending",
              fecha: null,
              hechos: ["El instituto no respondió hoy"],
              motivoFallo: "El instituto no respondió hoy",
            },
          },
        },
      },
      identity: { nss: true, curp: true, rfc: false },
      nowIso: "2026-09-21T12:00:00.000Z",
    });

    expect(parsed?.checkedAt).toBe("2026-09-21T12:00:00.000Z");
    expect(parsed?.checks.find((item) => item.source === "imss")?.status).toBe("no_se_pudo");
    expect(parsed?.checks.find((item) => item.source === "infonavit")?.status).toBe("no_se_pudo");
    expect(parsed?.checks.find((item) => item.source === "sat")?.status).toBe("sin_datos");
    expect(parsed?.overallStatus).toBe("no_se_pudo");
    expect(parsed?.overallLabel).toBe("Falló");
    expect(parsed?.chatAnchor?.imss.estado).toBe("failed");
    expect(parsed?.chatAnchor?.imss.fecha).toBe("2026-09-21T12:00:00.000Z");
    expect(parsed?.chatAnchor?.imss.motivoFallo).toMatch(/no contestó/);
    expect(parsed?.chatAnchor?.imss.motivoFallo).toMatch(/no de AuditaPatrón/);
    expect(parsed?.overallDetail).toMatch(/Consultamos/);
    expect(parsed?.overallDetail).toMatch(/IMSS|Infonavit|instituto/);
    expect(parsed?.overallDetail).toMatch(/no de AuditaPatrón/);
    expect(parsed?.overallDetail).not.toMatch(/El instituto no respondió hoy|respuesta usable/);
    expect(JSON.stringify(parsed)).not.toMatch(/APIMarket|Helios|CompliLink|HMAC|\b(sí )?cumple\b/i);
  });

  it("no lee APIMARKET_* ni las trata como configuración", async () => {
    const fetchImpl = vi.fn();
    const result = await runOfficialGovernmentCheck({
      identity: { nss: "12345678901", curp: null, rfc: null },
      consentGranted: true,
      env: {
        APIMARKET_API_KEY: "sk-should-be-ignored",
        APIMARKET_IMSS_URL: "https://consulta.imss.test",
        APIMARKET_SAT_URL: "https://consulta.sat.test",
      },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result.overallStatus).toBe("no_configurado");
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(isOfficialCheckConfigured({ APIMARKET_API_KEY: "sk-should-be-ignored" })).toBe(false);
  });
});

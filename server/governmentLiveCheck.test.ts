import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

import { buildOfficialCaseBriefing, buildPayWellFallback } from "@shared/officialCaseBriefing";
import {
  OFFICIAL_CHECK_BUTTON,
  OFFICIAL_CHECK_CONSENT,
  OFFICIAL_PENDING_STALE_MS,
  OFFICIAL_CHECK_STATUS_LABEL,
  buildOfficialCheckHeadline,
  pickHonestOfficialCheck,
  reconcileOfficialCheckWithIdentity,
  resolveOfficialCheckDisplay,
} from "@shared/officialCheckCopy";
import {
  buildAuditaPatronEngineSignature,
  canonicalizeEngineWebhookUrl,
} from "./auditaPatronIntegrationService";
import { buildPreliminaryLaborAnalysis } from "./caseContracts";
import { extractStructuredLaborFiscalFacts } from "./laborFiscalSignals";
import {
  OFFICIAL_CHECK_ACTION,
  buildOfficialCheckBridgePayload,
  collectWorkerOfficialIdentity,
  extractReceiptOfficialIdentity,
  mergeWorkerOfficialIdentities,
  getOfficialCheckAvailability,
  isOfficialCheckConfigured,
  officialCheckFromBridgeReturn,
  officialReceiptFromLaborFacts,
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
    expect(result.overallLabel).toBe("Contestó");
    expect(result.overallDetail).toMatch(/no significa que tu patrón cumple/i);
    expect(buildOfficialCheckHeadline(result)).toBe("Aún no te podemos decir si tu patrón te tiene bien registrado.");
    expect(buildOfficialCheckHeadline(result)).not.toMatch(/\bVivo\b|certificado|RFC confirmado/);
    expect(result.checks.find((item) => item.source === "sat")?.hechos.join(" ")).toMatch(/RFC: VECJ880326XXX/);
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
    expect(result.overallDetail).toMatch(/no hubo respuesta|Pedimos la información|no contestó|No es un error de tu recibo/i);
    expect(result.overallDetail).toMatch(/instituto|IMSS|SAT|oficinas/);
    expect(result.overallDetail).not.toMatch(/no de AuditaPatrón|Falló/);
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
    expect(result.overallLabel).toBe("Sin respuesta");
    expect(result.overallDetail).toMatch(/Hoy IMSS y SAT no contestaron/);
    expect(result.overallDetail).not.toMatch(/no de AuditaPatrón|Falló/);
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
    expect(pending.overallDetail).not.toMatch(/no de AuditaPatrón|Falló/);
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
    expect(timedOut.overallLabel).toBe("Sin respuesta");
    expect(timedOut.overallDetail).toMatch(/no contestó|no contestaron|Pedimos la información/);
    expect(timedOut.overallDetail).toMatch(/no hubo respuesta|IMSS/);
    expect(timedOut.overallDetail).not.toMatch(/no de AuditaPatrón|Falló/);
    expect(timedOut.overallDetail).not.toMatch(/respuesta usable|fallo de AuditaPatrón/i);
    expect(timedOut.checkedAt).toBeTruthy();
    expect(fetchTimeout).toHaveBeenCalledTimes(1);
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
      "IMSS: Contestó",
      "SAT: Pendiente",
      "Infonavit: Sin respuesta",
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

  it("lee un NSS separado y manda patrón y sueldo junto con NSS, CURP y RFC", () => {
    expect(extractReceiptOfficialIdentity("N.S.S. 84 12 921 4965 RFC receptor UIPD9211257I0 RFC del patrón ECC190605VA1")).toMatchObject({
      nss: "84129214965",
      rfc: "UIPD9211257I0",
    });
    expect(
      collectWorkerOfficialIdentity({
        employerRfc: "ECC190605VA1",
        text: "RFC emisor ECC190605VA1 RFC receptor UIPD9211257I0",
      }).rfc,
    ).toBe("UIPD9211257I0");

    const payload = buildOfficialCheckBridgePayload({
      identity: {
        nss: "84129214965",
        curp: "UIPD921125HYNCLD03",
        rfc: "UIPD9211257I0",
      },
      nowIso: "2026-09-21T15:30:00.000Z",
      receipt: {
        employerRfc: "ECC190605VA1",
        salary: "331.01",
        netAmount: "$4,725.60",
        perceptions: "$4,725.60",
        imssWithheld: "$88.10",
        infonavitWithheld: "$210.00",
        period: "2026-05-01 al 2026-05-15",
        workerName: "DIDIER ANTONIO UICAB PALOMO",
        employerRegistration: "R1379389106",
      },
    });

    expect(payload.autonomousInput).toMatchObject({
      nss: "84129214965",
      curp: "UIPD921125HYNCLD03",
      rfc: "UIPD9211257I0",
      rfcPatron: "ECC190605VA1",
      salario: "331.01",
      neto: "$4,725.60",
      percepciones: "$4,725.60",
      descuentoImss: "$88.10",
      descuentoInfonavit: "$210.00",
      periodo: "2026-05-01 al 2026-05-15",
      nombreTrabajador: "DIDIER ANTONIO UICAB PALOMO",
      registroPatronal: "R1379389106",
    });
    expect(payload.patronRfc).toBe("ECC190605VA1");
    expect(payload.salary).toBe("331.01");
    expect(payload.recibo.rfc).toBe("UIPD9211257I0");
    expect(payload.recibo.rfcPatron).toBe("ECC190605VA1");
    expect(payload.recibo.rfc).not.toBe(payload.recibo.rfcPatron);
  });

  it("manda al puente folio, folio fiscal, SDI y patrón cuando el recibo los trae", () => {
    const textHint = readFileSync(new URL("./fixtures/nomina-cfdi-referencia.xml", import.meta.url), "utf8");
    const analysis = buildPreliminaryLaborAnalysis({
      fileName: "recibo-nomina.xml",
      mimeType: "application/xml",
      textHint,
    });
    const facts = extractStructuredLaborFiscalFacts({
      documentType: "cfdi",
      originalName: "recibo-nomina.xml",
      preliminaryAnalysis: analysis,
    });
    const identity = collectWorkerOfficialIdentity({
      nss: facts.nss,
      curp: facts.curp,
      workerRfc: facts.workerRfc,
      employerRfc: facts.employerRfc,
    });
    const payload = buildOfficialCheckBridgePayload({
      identity,
      nowIso: "2026-09-21T15:30:00.000Z",
      receipt: officialReceiptFromLaborFacts(facts),
    });

    expect(payload.autonomousInput).toMatchObject({
      nss: "84129214965",
      curp: "UIPD921125HYNCLD03",
      rfc: "UIPD9211257I0",
      rfcPatron: "ECC190605VA1",
      nombreTrabajador: "DIDIER ANTONIO UICAB PALOMO",
      nombrePatron: "EVOLUCION CREATIVA CAMREFLEX",
      salario: "331.01",
      sdi: "331.01",
      percepciones: "$4725.60",
      periodo: "2026-05-01 al 2026-05-15",
      folio: "10963",
      uuid: "8C18C713-7AFA-5EA6-B323-FA208F8A3880",
    });
    expect(payload.recibo.rfc).not.toBe(payload.recibo.rfcPatron);
    expect(payload.recibo).toMatchObject({
      folio: "10963",
      uuid: "8C18C713-7AFA-5EA6-B323-FA208F8A3880",
      nombrePatron: "EVOLUCION CREATIVA CAMREFLEX",
      sdi: "331.01",
    });
    expect(Object.values(payload.autonomousInput).every((value) => value.trim().length > 0)).toBe(true);
    expect(Object.values(payload.recibo).every((value) => value == null || String(value).trim().length > 0)).toBe(true);
  });

  it("si el retorno trae salario y patrón del registro, no los convierte en Vivo", () => {
    const parsed = officialCheckFromBridgeReturn({
      payload: {
        event: "document.processed.v1",
        result: {
          officialCheck: {
            imss: {
              honesty: "pending",
              status: "pending",
              workerReason: "Todavía no hay una respuesta oficial nueva de IMSS.",
              checkedAt: "2026-09-21T12:00:00.000Z",
              hechos: ["Salario RPCI: $450.25", "Patrón RPCI: TALLER NORTE SA"],
            },
            sat: {
              honesty: "failed",
              status: "failed",
              workerReason: "SAT en mantenimiento.",
              hechos: ["SAT en mantenimiento."],
            },
            infonavit: {
              honesty: "pending",
              status: "pending",
              workerReason: "Todavía no hay una respuesta oficial nueva de Infonavit.",
              hechos: ["Todavía no hay una respuesta oficial nueva de Infonavit."],
            },
          },
        },
      },
      identity: { nss: true, curp: true, rfc: true },
      nowIso: "2026-09-21T12:00:00.000Z",
    });

    expect(parsed?.overallStatus).not.toBe("vivo");
    expect(parsed?.checks.find((item) => item.source === "imss")?.status).not.toBe("vivo");
    expect(parsed?.institutePay).toMatchObject({ salary: "$450.25", employer: "TALLER NORTE SA" });
  });

  it("lee salario base, RFC y razón social del retorno sin marcar Vivo si el IMSS sigue pendiente", () => {
    const parsed = officialCheckFromBridgeReturn({
      payload: {
        event: "document.processed.v1",
        result: {
          officialCheck: {
            imss: {
              honesty: "pending",
              status: "pending",
              workerReason: "Todavía no hay una respuesta oficial nueva de IMSS.",
              hechos: ["Todavía no hay una respuesta oficial nueva de IMSS."],
              rawPayload: {
                sourceProduct: "rpci",
                salario_base: "1850.75",
                rfc_patron: "PAG850101AB1",
                razon_social: "TECNOMEX SOLUCIONES, S.A. DE C.V.",
                dias: "15",
              },
            },
            sat: {
              honesty: "failed",
              status: "failed",
              workerReason: "SAT en mantenimiento.",
              hechos: ["SAT en mantenimiento."],
            },
            infonavit: {
              honesty: "pending",
              status: "pending",
              hechos: ["Todavía no hay una respuesta oficial nueva de Infonavit."],
            },
          },
        },
      },
      identity: { nss: true, curp: true, rfc: true },
      nowIso: "2026-09-21T12:00:00.000Z",
    });

    expect(parsed?.overallStatus).not.toBe("vivo");
    expect(parsed?.checks.find((item) => item.source === "imss")?.status).not.toBe("vivo");
    expect(parsed?.institutePay?.salary).toMatch(/\$1,?850\.75/);
    expect(parsed?.institutePay).toMatchObject({
      employer: "TECNOMEX SOLUCIONES, S.A. DE C.V.",
      employerRfc: "PAG850101AB1",
      days: "15",
    });
    expect(JSON.stringify(parsed?.checks)).not.toMatch(/RPCI|Syntage|certificado/i);
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
    expect(parsed?.overallLabel).toBe("Sin respuesta");
    expect(parsed?.chatAnchor?.imss.estado).toBe("failed");
    expect(parsed?.chatAnchor?.imss.fecha).toBe("2026-09-21T12:00:00.000Z");
    expect(parsed?.chatAnchor?.imss.motivoFallo).toMatch(/no contestó hoy/);
    expect(parsed?.chatAnchor?.imss.motivoFallo).not.toMatch(/no de AuditaPatrón/);
    expect(parsed?.overallDetail).toMatch(/no contestó|no contestaron|Pedimos la información/);
    expect(parsed?.overallDetail).toMatch(/IMSS|Infonavit|oficinas/);
    expect(parsed?.overallDetail).not.toMatch(/no de AuditaPatrón|Falló/);
    expect(parsed?.overallDetail).not.toMatch(/El instituto no respondió hoy|respuesta usable/);
    expect(JSON.stringify(parsed)).not.toMatch(/APIMarket|Helios|CompliLink|HMAC|\b(sí )?cumple\b/i);
  });

  it("recibo UIPD: SAT vivo sobrevive si IMSS e Infonavit vienen en 503 mantenimiento", () => {
    const parsed = officialCheckFromBridgeReturn({
      payload: {
        event: "document.processed.v1",
        result: {
          officialCheck: {
            sat: {
              honesty: "live",
              status: "vivo",
              checkedAt: "2026-09-21T12:00:00.000Z",
              hechos: ["RFC: UIPD9211257I0", "Situación: activo"],
            },
            imss: {
              honesty: "failed",
              status: "no_se_pudo",
              workerReason: "503 mantenimiento",
              message: "503 mantenimiento",
              hechos: ["IMSS en mantenimiento."],
            },
            infonavit: {
              honesty: "failed",
              status: "no_se_pudo",
              workerReason: "503 mantenimiento",
              hechos: ["Infonavit en mantenimiento."],
            },
          },
          chatAnchor: {
            sat: {
              fuente: "sat",
              estado: "live",
              fecha: "2026-09-21T12:00:00.000Z",
              hechos: ["RFC: UIPD9211257I0", "Situación: activo"],
              motivoFallo: null,
            },
            imss: {
              fuente: "imss",
              estado: "failed",
              fecha: "2026-09-21T12:00:00.000Z",
              hechos: ["IMSS en mantenimiento."],
              motivoFallo: "503 mantenimiento",
            },
            infonavit: {
              fuente: "infonavit",
              estado: "failed",
              fecha: "2026-09-21T12:00:00.000Z",
              hechos: ["Infonavit en mantenimiento."],
              motivoFallo: "503 mantenimiento",
            },
          },
        },
      },
      identity: { nss: true, curp: true, rfc: true },
      nowIso: "2026-09-21T12:00:00.000Z",
    });
    const reconciled = reconcileOfficialCheckWithIdentity(parsed, { nss: true, curp: true, rfc: true }, {
      facts: {
        nss: "84129214965",
        curp: "UIPD921125HYNCLD03",
        workerRfc: "UIPD9211257I0",
        employerRfc: "ECC190605VA1",
      },
    });
    const display = resolveOfficialCheckDisplay({
      consentGranted: true,
      summary: reconciled,
      identity: { nss: true, curp: true, rfc: true },
      facts: {
        nss: "84129214965",
        curp: "UIPD921125HYNCLD03",
        workerRfc: "UIPD9211257I0",
      },
    });

    expect(parsed?.checks.find((item) => item.source === "sat")?.status).toBe("vivo");
    expect(parsed?.checks.find((item) => item.source === "imss")?.status).toBe("no_se_pudo");
    expect(parsed?.checks.find((item) => item.source === "infonavit")?.status).toBe("no_se_pudo");
    expect(display.headline).toBe("Aún no te podemos decir si tu patrón te tiene bien registrado.");
    expect(display.headline).not.toMatch(/Hoy no se pudo comprobar. No prueba que te engañen./);
    expect(display.silence?.sourceLines.join("\n")).toMatch(/SAT contestó/);
    expect(display.silence?.sourceLines.join("\n")).not.toMatch(/\bVivo\b|\bvivo\b/);
    expect(display.silence?.sourceLines.join("\n")).toMatch(/UIPD9211257I0/);
    expect(display.silence?.sourceLines.join("\n")).toMatch(/Hoy IMSS no contestó. No es un error de tu recibo. Está en mantenimiento./);
    expect(JSON.stringify(display)).not.toMatch(/\bFalló\b|no de AuditaPatrón|\bcumple\b/i);
  });

  it("un cuerpo largo con SAT vivo y opinión pendiente no se vuelve silencio de las tres", async () => {
    const certificates = Array.from({ length: 30 }, (_, index) => ({
      serial: `CERT-${index}-`.padEnd(90, "A"),
      opinionStatus: "pendiente",
      tipo: "certificado",
    }));
    const payload = {
      ok: true,
      action: "official_check",
      satHonesty: "live",
      imssHonesty: "failed",
      infonavitHonesty: "failed",
      result: {
        sat: {
          opinionStatus: "pendiente",
          matchedRfc: true,
          rfc: "UIPD9211257I0",
          documents: certificates,
        },
        imss: { message: "503 mantenimiento" },
        infonavit: { message: "503 mantenimiento" },
        officialCheck: {
          sat: {
            honesty: "live",
            status: "pendiente",
            resultado: "vivo",
            opinionStatus: "pendiente",
            checkedAt: "2026-09-21T20:41:00.000Z",
            hechos: ["RFC: UIPD9211257I0", "Certificados del SAT."],
          },
          imss: {
            honesty: "failed",
            status: "failed",
            resultado: "no_se_pudo",
            workerReason: "IMSS está en mantenimiento.",
            hechos: ["IMSS está en mantenimiento."],
          },
          infonavit: {
            honesty: "failed",
            status: "failed",
            resultado: "no_se_pudo",
            workerReason: "Infonavit está en mantenimiento.",
            hechos: ["Infonavit está en mantenimiento."],
          },
        },
        chatAnchor: {
          sat: {
            fuente: "sat",
            estado: "live",
            resultado: "vivo",
            fecha: "2026-09-21T20:41:00.000Z",
            hechos: ["RFC: UIPD9211257I0", "Certificados del SAT."],
            motivoFallo: null,
          },
          imss: {
            fuente: "imss",
            estado: "failed",
            resultado: "no_se_pudo",
            fecha: "2026-09-21T20:41:00.000Z",
            hechos: ["IMSS está en mantenimiento."],
            motivoFallo: "IMSS está en mantenimiento.",
          },
          infonavit: {
            fuente: "infonavit",
            estado: "failed",
            resultado: "no_se_pudo",
            fecha: "2026-09-21T20:41:00.000Z",
            hechos: ["Infonavit está en mantenimiento."],
            motivoFallo: "Infonavit está en mantenimiento.",
          },
        },
      },
    };
    const raw = JSON.stringify(payload);
    expect(raw.length).toBeGreaterThan(2000);
    expect(raw.slice(0, 2000)).not.toContain('"honesty":"live"');

    const checkedAt = new Date("2026-09-21T20:41:00.000Z");
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(raw, { status: 200, headers: { "content-type": "application/json" } }),
    );
    const result = await runOfficialGovernmentCheck({
      identity: { nss: "84129214965", curp: "UIPD921125HYNCLD03", rfc: "UIPD9211257I0" },
      consentGranted: true,
      env: ENGINE_ENV,
      now: checkedAt,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const facts = {
      nss: "84129214965",
      curp: "UIPD921125HYNCLD03",
      workerRfc: "UIPD9211257I0",
      employerRfc: "ECC190605VA1",
    };
    const laterMs = checkedAt.getTime() + OFFICIAL_PENDING_STALE_MS + 60_000;
    const display = resolveOfficialCheckDisplay({
      consentGranted: true,
      summary: result,
      identity: { nss: true, curp: true, rfc: true },
      facts,
      nowMs: laterMs,
    });
    const briefing = buildOfficialCaseBriefing({
      officialCheck: result,
      facts,
      nowMs: laterMs,
    });

    expect(result.checks.find((item) => item.source === "sat")?.status).toBe("vivo");
    expect(result.checks.find((item) => item.source === "imss")?.status).toBe("no_se_pudo");
    expect(result.checks.find((item) => item.source === "infonavit")?.status).toBe("no_se_pudo");
    expect(display.headline).toBe("Aún no te podemos decir si tu patrón te tiene bien registrado.");
    expect(display.headline).not.toMatch(/Hoy no se pudo comprobar. No prueba que te engañen./);
    expect(display.silence?.sourceLines.join("\n")).toMatch(/SAT contestó/);
    expect(display.silence?.sourceLines.join("\n")).not.toMatch(/\bVivo\b|\bvivo\b/);
    expect(display.silence?.sourceLines.join("\n")).toMatch(/UIPD9211257I0/);
    expect(display.silence?.sourceLines.join("\n")).toMatch(/Hoy IMSS no contestó. No es un error de tu recibo./);
    expect(display.silence?.sourceLines.join("\n")).toMatch(/en mantenimiento/);
    expect(briefing.instituteSilence).toBe(false);
    expect(briefing.hasLiveOfficialResult).toBe(true);
    expect(briefing.verdict?.kind).toBe("mixed");
    expect(briefing.verdict?.chat).toMatch(/SAT sí contestó/);
    expect(briefing.verdict?.chat).not.toMatch(/IMSS, SAT e Infonavit y no contestaron/);
    expect(buildPayWellFallback(briefing).clearAnswer).not.toMatch(/IMSS, SAT e Infonavit y no contestaron/);
    expect(JSON.stringify(display)).not.toMatch(/\bFalló\b|no de AuditaPatrón|\bcumple\b/i);
    expect(briefing.verdict?.chat).not.toMatch(/\bcumple\b/i);
  });

  it("satHonesty vivo gana aunque la opinión del SAT diga pendiente", () => {
    const parsed = officialCheckFromBridgeReturn({
      payload: {
        action: "official_check",
        satHonesty: "live",
        result: {
          sat: { opinionStatus: "pendiente", status: "pendiente", rfc: "UIPD9211257I0" },
          imss: {
            honesty: "failed",
            resultado: "no_se_pudo",
            workerReason: "IMSS está en mantenimiento.",
            hechos: ["IMSS está en mantenimiento."],
          },
          infonavit: {
            honesty: "failed",
            resultado: "no_se_pudo",
            workerReason: "Infonavit está en mantenimiento.",
            hechos: ["Infonavit está en mantenimiento."],
          },
        },
      },
      identity: { nss: true, curp: true, rfc: true },
      nowIso: "2026-09-21T20:41:00.000Z",
    });
    const display = resolveOfficialCheckDisplay({
      consentGranted: true,
      summary: parsed,
      identity: { nss: true, curp: true, rfc: true },
      nowMs: Date.parse("2026-09-21T20:41:00.000Z") + OFFICIAL_PENDING_STALE_MS + 5_000,
    });

    expect(parsed?.checks.find((item) => item.source === "sat")?.status).toBe("vivo");
    expect(parsed?.checks.find((item) => item.source === "sat")?.hechos.join(" ")).toMatch(/UIPD9211257I0/);
    expect(display.headline).toBe("Aún no te podemos decir si tu patrón te tiene bien registrado.");
    expect(display.silence?.sourceLines.join("\n")).toMatch(/Certificados|RFC: UIPD9211257I0/);
    expect(display.headline).not.toMatch(/Hoy no se pudo comprobar. No prueba que te engañen./);
  });

  it("no copia el nombre del expediente como razón social y no deja vivo un SAT vacío", () => {
    const nowIso = "2026-09-21T22:44:00.000Z";
    const institutes = {
      imss: {
        honesty: "failed",
        resultado: "no_se_pudo",
        workerReason: "IMSS no contestó.",
        hechos: ["IMSS no contestó."],
      },
      infonavit: {
        honesty: "failed",
        resultado: "no_se_pudo",
        workerReason: "Infonavit no contestó.",
        hechos: ["Infonavit no contestó."],
      },
    };
    const answered = officialCheckFromBridgeReturn({
      payload: {
        action: "official_check",
        result: {
          sat: {
            honesty: "live",
            resultado: "vivo",
            rfc: "UIPD9211257I0",
            legalName: "EXPEDIENTE UIPD9211257I0",
            tipoPersona: "Persona física",
            hechos: ["El SAT confirmó el RFC consultado."],
          },
          ...institutes,
        },
      },
      identity: { nss: true, curp: true, rfc: true },
      nowIso,
    });
    const answeredLines = answered?.checks.find((item) => item.source === "sat")?.hechos.join("\n") ?? "";
    expect(answered?.checks.find((item) => item.source === "sat")?.status).toBe("vivo");
    expect(answeredLines).toMatch(/El SAT confirmó el RFC consultado/);
    expect(answeredLines).not.toMatch(/Razón social|EXPEDIENTE/i);

    const named = officialCheckFromBridgeReturn({
      payload: {
        action: "official_check",
        result: {
          sat: {
            honesty: "live",
            resultado: "vivo",
            rfc: "ECC190605VA1",
            legalName: "EVOLUCION CREATIVA CAMREFLEX, S.A. DE C.V.",
          },
          ...institutes,
        },
      },
      identity: { nss: true, curp: true, rfc: true },
      nowIso,
    });
    expect(named?.checks.find((item) => item.source === "sat")?.hechos.join(" ")).toMatch(
      /Nombre del RFC consultado en el SAT: EVOLUCION CREATIVA CAMREFLEX/,
    );

    const emptyHook = officialCheckFromBridgeReturn({
      payload: {
        action: "official_check",
        result: {
          sat: {
            honesty: "live",
            resultado: "vivo",
            legalName: "EXPEDIENTE UIPD9211257I0",
            razonSocial: "UIPD9211257I0",
          },
          ...institutes,
        },
      },
      identity: { nss: true, curp: true, rfc: true },
      nowIso,
    });
    const emptySat = emptyHook?.checks.find((item) => item.source === "sat");
    expect(emptySat?.status).toBe("no_se_pudo");
    expect(emptySat?.hechos.join(" ")).not.toMatch(/Razón social|EXPEDIENTE|SAT: Vivo/i);
    const display = resolveOfficialCheckDisplay({
      consentGranted: true,
      summary: emptyHook,
      identity: { nss: true, curp: true, rfc: true },
      nowMs: Date.parse(nowIso) + OFFICIAL_PENDING_STALE_MS + 5_000,
    });
    expect(display.silence?.sourceLines.join("\n") ?? "").not.toMatch(/SAT: Vivo|Razón social|EXPEDIENTE/i);
    expect(display.headline).not.toMatch(/\bcumple\b/i);
    expect(answeredLines).not.toMatch(/\bcumple\b/i);
  });

  it("el tope de un proveedor no apaga un SAT vivo ni en el humo ni en guest-official", async () => {
    const capMessage = "En el acceso gratuito solo puedes revisar un proveedor. Para revisar otro, elige un plan.";
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: false,
          action: "official_check",
          error: capMessage,
          idempotencyKey: "guest-official:preview-uipd",
          providerId: null,
          result: {
            satHonesty: "live",
            officialCheck: {
              sat: {
                honesty: "live",
                resultado: "vivo",
                status: "pendiente",
                rfc: "UIPD9211257I0",
                hechos: ["RFC: UIPD9211257I0", "El SAT entregó 30 certificados."],
              },
              imss: { honesty: "failed", resultado: "no_se_pudo", workerReason: "IMSS está en mantenimiento.", hechos: ["IMSS está en mantenimiento."] },
              infonavit: { honesty: "failed", resultado: "no_se_pudo", workerReason: "Infonavit está en mantenimiento.", hechos: ["Infonavit está en mantenimiento."] },
            },
          },
        }),
        { status: 403 },
      ),
    );
    const checkedAt = new Date("2026-09-21T20:41:00.000Z");
    const result = await runOfficialGovernmentCheck({
      identity: { nss: "84129214965", curp: "UIPD921125HYNCLD03", rfc: "UIPD9211257I0" },
      consentGranted: true,
      env: ENGINE_ENV,
      now: checkedAt,
      idempotencyKey: "guest-official:preview-uipd",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const laterMs = checkedAt.getTime() + OFFICIAL_PENDING_STALE_MS + 60_000;
    const display = resolveOfficialCheckDisplay({
      consentGranted: true,
      summary: result,
      identity: { nss: true, curp: true, rfc: true },
      nowMs: laterMs,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(result.checks.find((item) => item.source === "sat")?.status).toBe("vivo");
    expect(result.checks.find((item) => item.source === "imss")?.status).toBe("no_se_pudo");
    expect(result.checks.find((item) => item.source === "infonavit")?.status).toBe("no_se_pudo");
    expect(display.headline).toBe("Aún no te podemos decir si tu patrón te tiene bien registrado.");
    expect(display.headline).not.toMatch(/Hoy no se pudo comprobar. No prueba que te engañen./);
    expect(display.silence?.sourceLines.join("\n")).toMatch(/UIPD9211257I0/);
    expect(JSON.stringify(display)).not.toMatch(/acceso gratuito|proveedor|elige un plan/i);
  });

  it("un 403 de tope sin consulta no se vuelve silencio de las tres y no pisa un SAT vivo", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: false,
          action: "official_check",
          providerId: null,
          error: "En el acceso gratuito solo puedes revisar un proveedor. Para revisar otro, elige un plan.",
        }),
        { status: 403 },
      ),
    );
    const blocked = await runOfficialGovernmentCheck({
      identity: { nss: "84129214965", curp: "UIPD921125HYNCLD03", rfc: "UIPD9211257I0" },
      consentGranted: true,
      env: ENGINE_ENV,
      now: new Date("2026-09-21T20:39:00.000Z"),
      idempotencyKey: "guest-official:preview-uipd",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(blocked.bridgeBlock).toBe("provider_cap");
    expect(blocked.overallStatus).toBe("pendiente");
    expect(blocked.checks.every((item) => item.status !== "no_se_pudo")).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const capOnly = {
      configured: true,
      consentGranted: true,
      overallStatus: "pendiente" as const,
      overallLabel: "Pendiente",
      overallDetail: "Todavía no hay una respuesta oficial nueva. Inténtalo más tarde.",
      checkedAt: "2026-09-21T20:39:00.000Z",
      identity: { nss: true, curp: true, rfc: true },
      bridgeBlock: "provider_cap" as const,
      checks: [],
    };
    const live = {
      configured: true,
      consentGranted: true,
      overallStatus: "vivo" as const,
      overallLabel: "Vivo",
      overallDetail: "Esto respondió el instituto hoy.",
      checkedAt: "2026-09-21T20:41:00.000Z",
      identity: { nss: true, curp: true, rfc: true },
      checks: [
        {
          source: "sat" as const,
          sourceLabel: "SAT",
          status: "vivo" as const,
          label: "Vivo",
          detail: "Esto respondió el instituto hoy.",
          checkedAt: "2026-09-21T20:41:00.000Z",
          used: { nss: false, curp: false, rfc: true },
          honesty: "live" as const,
          hechos: ["RFC: UIPD9211257I0"],
        },
      ],
    };
    const picked = pickHonestOfficialCheck({
      consentGranted: true,
      candidates: [capOnly, live],
    });
    expect(picked?.checks.find((item) => item.source === "sat")?.status).toBe("vivo");
    expect(picked?.bridgeBlock).toBeUndefined();

    const display = resolveOfficialCheckDisplay({
      consentGranted: true,
      summary: capOnly,
      identity: { nss: true, curp: true, rfc: true },
      nowMs: Date.parse("2026-09-21T20:39:00.000Z") + OFFICIAL_PENDING_STALE_MS + 60_000,
    });
    expect(display.headline).not.toMatch(/Hoy no se pudo comprobar. No prueba que te engañen./);
    expect(display.headline).not.toMatch(/acceso gratuito|proveedor/i);
  });

  it("marca otra consulta oficial solo cuando el retorno trae la señal", () => {
    const withSignal = officialCheckFromBridgeReturn({
      payload: {
        action: "official_check",
        failover: true,
        result: {
          sat: {
            honesty: "live",
            resultado: "vivo",
            rfc: "UIPD9211257I0",
            hechos: ["RFC: UIPD9211257I0"],
            providerRole: "backup",
          },
          imss: { honesty: "pending", resultado: "pendiente", hechos: ["Todavía no hay una respuesta oficial nueva de IMSS."] },
          infonavit: { honesty: "failed", resultado: "no_se_pudo", workerReason: "Infonavit no contestó.", hechos: ["Infonavit no contestó."] },
        },
      },
      identity: { nss: true, curp: true, rfc: true },
      nowIso: "2026-09-21T12:00:00.000Z",
    });
    expect(withSignal?.alternateRoute).toBe(true);
    expect(withSignal?.checks.find((item) => item.source === "sat")?.status).toBe("vivo");
    const display = resolveOfficialCheckDisplay({
      consentGranted: true,
      summary: withSignal,
      identity: { nss: true, curp: true, rfc: true },
      nowMs: Date.parse("2026-09-21T12:00:05.000Z"),
    });
    expect(display.headline).toBe("Aún no te podemos decir si tu patrón te tiene bien registrado.");
    expect(display.detail).toBe("Todavía faltan dos respuestas para saber si tu patrón te tiene bien registrado.");
    expect(display.silence?.meaning).toContain("Consultamos otra vía oficial.");
    expect(display.silence?.meaning).not.toContain("no hubo datos útiles");
    expect(display.detail).not.toMatch(/\bbackup\b|failover|Helios|CompliLink|\bcumple\b/i);
    expect(display.silence?.meaning).not.toMatch(/\bbackup\b|failover|Helios|CompliLink|\bcumple\b/i);

    const plain = officialCheckFromBridgeReturn({
      payload: {
        action: "official_check",
        providerId: 30001,
        result: {
          sat: { honesty: "live", resultado: "vivo", rfc: "UIPD9211257I0", hechos: ["RFC: UIPD9211257I0"] },
        },
      },
      identity: { nss: false, curp: false, rfc: true },
      nowIso: "2026-09-21T12:00:00.000Z",
    });
    expect(plain?.alternateRoute).toBeUndefined();

    const triedEmpty = officialCheckFromBridgeReturn({
      payload: {
        action: "official_check",
        backupJumps: [{ from: "principal", to: "secundaria" }],
        result: {
          imss: { honesty: "failed", resultado: "no_se_pudo", workerReason: "IMSS no contestó.", hechos: ["IMSS no contestó."] },
          sat: { honesty: "failed", resultado: "no_se_pudo", workerReason: "SAT no contestó.", hechos: ["SAT no contestó."] },
          infonavit: { honesty: "failed", resultado: "no_se_pudo", workerReason: "Infonavit no contestó.", hechos: ["Infonavit no contestó."] },
        },
      },
      identity: { nss: true, curp: true, rfc: true },
      nowIso: "2026-09-21T12:00:00.000Z",
    });
    expect(triedEmpty?.alternateRoute).toBe(true);
    const emptyDisplay = resolveOfficialCheckDisplay({
      consentGranted: true,
      summary: triedEmpty,
      identity: { nss: true, curp: true, rfc: true },
      nowMs: Date.parse("2026-09-21T12:00:05.000Z"),
    });
    expect(emptyDisplay.silence?.whatHappened).toMatch(/Hoy IMSS, SAT e Infonavit no contestaron/);
    expect(emptyDisplay.silence?.meaning).toContain("Consultamos otra vía oficial y hoy no hubo datos útiles.");
    expect(emptyDisplay.headline).not.toMatch(/\bbackup\b|failover|Helios|CompliLink|\bcumple\b/i);
    expect(JSON.stringify(emptyDisplay)).not.toMatch(/\bbackup\b|failover|Helios|CompliLink|\bcumple\b/i);
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

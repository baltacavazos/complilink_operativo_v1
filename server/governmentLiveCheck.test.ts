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
import {
  OFFICIAL_CHECK_ACTION,
  collectWorkerOfficialIdentity,
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
    expect(result.overallDetail).not.toMatch(/HMAC|Helios|cumple/i);
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
    expect(result.overallDetail).toMatch(/todavía no hay una respuesta de IMSS o SAT/i);
    expect(result.overallDetail).not.toMatch(/Provider|Helios|cumple/i);
    expect(result.checkedAt).toBe("2026-09-21T12:00:00.000Z");
  });

  it("degrada 503 y timeout a pendiente", async () => {
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
    expect(pending.overallDetail).not.toMatch(/cumple/i);
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
    expect(timedOut.overallStatus).toBe("pendiente");
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
    expect(result.overallDetail).not.toMatch(/cumple/i);
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

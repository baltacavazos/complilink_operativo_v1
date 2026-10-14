import { describe, expect, it, vi } from "vitest";
import {
  clearInstantLookupState,
  isInstantLookupConfigured,
  listDirectInstantProviders,
  runInstantWorkerLookup,
} from "./instantLookup";
import { isOfficialCheckConfigured } from "./governmentLiveCheck";

const BRIDGE_ENV = {
  AUDITAPATRON_ENGINE_WEBHOOK_URL: "https://complilink.mx/api/integrations/auditapatron/bridge",
  AUDITAPATRON_ENGINE_HMAC_SECRET: "bridge-hmac-secret-123456",
};

describe("consulta instantánea en paralelo", () => {
  it("no trata Syntage ni una llave suelta como proveedor", () => {
    clearInstantLookupState();
    expect(listDirectInstantProviders({
      SYNTAGE_API_KEY: "no",
      SYNTAGE_URL: "https://syntage.example/lookup",
      APIMARKET_API_KEY: "key",
    })).toEqual([]);
    expect(isInstantLookupConfigured({ APIMARKET_API_KEY: "key" })).toBe(false);
    expect(isOfficialCheckConfigured({ APIMARKET_API_KEY: "key" })).toBe(false);
    expect(isInstantLookupConfigured({
      NUFI_API_KEY: "nufi-key",
      NUFI_INFONAVIT_URL: "https://nufi.example/infonavit",
    })).toBe(true);
  });

  it("salta un proveedor caído y se queda con la primera respuesta usable", async () => {
    clearInstantLookupState();
    const calls: string[] = [];
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push(`${init?.method ?? "GET"} ${url}`);
      if (String(url).includes("apimarket.example/health")) {
        return new Response("down", { status: 503 });
      }
      if (String(url).includes("nufi.example")) {
        return new Response(JSON.stringify({
          credito: "1234567890",
          saldo: "125000.00",
        }), { status: 200 });
      }
      await new Promise((resolve) => setTimeout(resolve, 40));
      return new Response("{}", { status: 502 });
    });

    const result = await runInstantWorkerLookup({
      identity: { nss: "12345678901", curp: "GOML800101HDFRRL09", rfc: null },
      consentGranted: true,
      now: new Date("2026-10-14T12:00:00.000Z"),
      env: {
        ...BRIDGE_ENV,
        APIMARKET_API_KEY: "market-key",
        APIMARKET_HEALTH_URL: "https://apimarket.example/health",
        APIMARKET_IMSS_URL: "https://apimarket.example/imss",
        NUFI_API_KEY: "nufi-key",
        NUFI_INFONAVIT_URL: "https://nufi.example/infonavit",
        SYNTAGE_API_KEY: "no",
        SYNTAGE_URL: "https://syntage.example/lookup",
      },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result.overallStatus).toBe("vivo");
    expect(JSON.stringify(result)).not.toMatch(/apimarket|nufi|syntage/i);
    expect(result.sourceRole ?? null).toBeNull();
    expect(calls.some((call) => call.includes("syntage"))).toBe(false);
    expect(calls.some((call) => call.includes("apimarket.example/imss"))).toBe(false);
    expect(calls.some((call) => call.includes("nufi.example"))).toBe(true);
    expect(result.checks.some((item) => item.status === "vivo")).toBe(true);
  });

  it("abre el circuito después de dos caídas y ni lo intenta", async () => {
    clearInstantLookupState();
    const fetchImpl = vi.fn(async () => new Response("down", { status: 503 }));
    const env = {
      APIMARKET_API_KEY: "market-key",
      APIMARKET_HEALTH_URL: "https://apimarket.example/health",
      APIMARKET_IMSS_URL: "https://apimarket.example/imss",
    };
    const identity = { nss: "12345678901", curp: null, rfc: null };
    await runInstantWorkerLookup({
      identity,
      consentGranted: true,
      env,
      now: new Date("2026-10-14T12:00:00.000Z"),
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await runInstantWorkerLookup({
      identity,
      consentGranted: true,
      env,
      now: new Date("2026-10-14T12:00:10.000Z"),
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    fetchImpl.mockClear();
    const skipped = await runInstantWorkerLookup({
      identity,
      consentGranted: true,
      env,
      now: new Date("2026-10-14T12:00:20.000Z"),
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(skipped.overallStatus).toBe("no_se_pudo");
    expect(JSON.stringify(skipped)).not.toMatch(/apimarket|nufi|syntage/i);
  });
});

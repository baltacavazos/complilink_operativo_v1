import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  analyticsScriptSrc,
  installOptionalAnalytics,
  isAnalyticsEndpoint,
  isAnalyticsWebsiteId,
  trackCeoConsoleViewed,
  trackCeoExport,
  trackCeoGuardrail,
  trackCeoMasterMetricsViewed,
  trackCeoRefresh,
  trackCeoViewModeToggled,
  trackEvent,
  trackFunnelStep,
  trackLegalGateEvent,
} from "./analytics";

type TestWindow = Window & {
  umami?: {
    track: ReturnType<typeof vi.fn>;
  };
};

const globalScope = globalThis as typeof globalThis & {
  window?: TestWindow;
};

afterEach(() => {
  delete globalScope.window;
  delete (globalThis as { document?: unknown }).document;
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

function installFakeDocument() {
  const scripts: Array<{
    defer: boolean;
    src: string;
    attrs: Record<string, string>;
  }> = [];
  const document = {
    scripts,
    querySelector(selector: string) {
      if (selector !== 'script[data-auditapatron-analytics="1"]') return null;
      return scripts.find((script) => script.attrs["data-auditapatron-analytics"] === "1") ?? null;
    },
    createElement() {
      const node = {
        defer: false,
        src: "",
        attrs: {} as Record<string, string>,
        setAttribute(name: string, value: string) {
          this.attrs[name] = value;
        },
      };
      return node;
    },
    head: {
      appendChild(node: (typeof scripts)[number]) {
        scripts.push(node);
      },
    },
  };
  (globalThis as { document?: typeof document }).document = document;
  return document;
}

describe("optional analytics script", () => {
  it("deja el HTML sin placeholder ni ruta de Umami", () => {
    const html = readFileSync(resolve(import.meta.dirname, "../../index.html"), "utf8");

    expect(html).not.toContain("VITE_ANALYTICS");
    expect(html).not.toContain("/umami");
    expect(html).not.toContain("%VITE_");
  });

  it("solo acepta URL http(s) y un id sin porcentaje", () => {
    expect(isAnalyticsEndpoint("%VITE_ANALYTICS_ENDPOINT%")).toBe(false);
    expect(isAnalyticsEndpoint("/%VITE_ANALYTICS_ENDPOINT%")).toBe(false);
    expect(isAnalyticsEndpoint("")).toBe(false);
    expect(isAnalyticsEndpoint(undefined)).toBe(false);
    expect(isAnalyticsEndpoint("ftp://analytics.example")).toBe(false);
    expect(isAnalyticsEndpoint("https://analytics.example/script%2Fumami")).toBe(false);
    expect(isAnalyticsEndpoint("https://analytics.example/")).toBe(true);
    expect(isAnalyticsEndpoint("http://analytics.example")).toBe(true);
    expect(isAnalyticsWebsiteId("%VITE_ANALYTICS_WEBSITE_ID%")).toBe(false);
    expect(isAnalyticsWebsiteId("")).toBe(false);
    expect(isAnalyticsWebsiteId("site 1")).toBe(false);
    expect(isAnalyticsWebsiteId("0a4e0f16-a107-4e88-876f-90bab091816b")).toBe(true);
    expect(analyticsScriptSrc("https://analytics.example/")).toBe("https://analytics.example/umami");
  });

  it("no inserta el script si no hay endpoint real", () => {
    const document = installFakeDocument();

    installOptionalAnalytics();

    expect(document.scripts).toHaveLength(0);
  });

  it("inserta el script una sola vez cuando la URL y el id son reales", () => {
    vi.stubEnv("VITE_ANALYTICS_ENDPOINT", "https://analytics.example/");
    vi.stubEnv("VITE_ANALYTICS_WEBSITE_ID", "site-1");
    const document = installFakeDocument();

    installOptionalAnalytics();
    installOptionalAnalytics();

    expect(document.scripts).toHaveLength(1);
    expect(document.scripts[0]?.defer).toBe(true);
    expect(document.scripts[0]?.src).toBe("https://analytics.example/umami");
    expect(document.scripts[0]?.attrs["data-website-id"]).toBe("site-1");
  });

  it("ignora un id con porcentaje aunque el endpoint sea http", () => {
    vi.stubEnv("VITE_ANALYTICS_ENDPOINT", "https://analytics.example");
    vi.stubEnv("VITE_ANALYTICS_WEBSITE_ID", "%VITE_ANALYTICS_WEBSITE_ID%");
    const document = installFakeDocument();

    installOptionalAnalytics();

    expect(document.scripts).toHaveLength(0);
  });
});

describe("analytics helpers", () => {
  it("does nothing when Umami is unavailable", () => {
    expect(() => trackEvent("custom_event", { ok: true })).not.toThrow();
  });

  it("sends sanitized payloads and standardized funnel steps", () => {
    const track = vi.fn();

    globalScope.window = {
      umami: {
        track,
      },
    } as TestWindow;

    trackEvent("custom_event", {
      source: "home",
      ignored: undefined,
    });

    trackFunnelStep("legal_gate_viewed", {
      caseId: "case_123",
      accepted: false,
    });
    trackLegalGateEvent("lock_conflict", {
      caseId: "case_123",
      waitTimeMs: 4200,
      retryAfterSeconds: 4,
    });

    expect(track).toHaveBeenNthCalledWith(1, "custom_event", {
      source: "home",
    });
    expect(track).toHaveBeenNthCalledWith(2, "audipatron_funnel_step", {
      step: "legal_gate_viewed",
      caseId: "case_123",
      accepted: false,
    });
    expect(track).toHaveBeenNthCalledWith(3, "audipatron_legal_gate", {
      event: "lock_conflict",
      caseId: "case_123",
      waitTimeMs: 4200,
      retryAfterSeconds: 4,
    });
  });

  it("emits standardized CEO analytics events for view, toggle, refresh, export, guardrails and master metrics", () => {
    const track = vi.fn();

    globalScope.window = {
      umami: {
        track,
      },
    } as TestWindow;

    trackCeoConsoleViewed("resumen", { source: "ceo_dashboard" });
    trackCeoViewModeToggled("user_demo", { source: "dashboard_layout" });
    trackCeoRefresh("alertas", { hasFilters: true });
    trackCeoExport("pdf", "completed", { section: "puente" });
    trackCeoGuardrail("blocked", {
      section: "resumen",
      actionKind: "export",
      reason: "snapshot_stale",
    });
    trackCeoMasterMetricsViewed({
      source: "ceo_dashboard",
      uniqueActors: 2,
    });

    expect(track).toHaveBeenNthCalledWith(1, "audipatron_ceo_console_viewed", {
      section: "resumen",
      source: "ceo_dashboard",
    });
    expect(track).toHaveBeenNthCalledWith(2, "audipatron_funnel_step", {
      step: "ceo_console_viewed",
      section: "resumen",
      source: "ceo_dashboard",
    });
    expect(track).toHaveBeenNthCalledWith(3, "audipatron_ceo_view_mode_toggled", {
      mode: "user_demo",
      source: "dashboard_layout",
    });
    expect(track).toHaveBeenNthCalledWith(4, "audipatron_funnel_step", {
      step: "ceo_user_view_entered",
      mode: "user_demo",
      source: "dashboard_layout",
    });
    expect(track).toHaveBeenNthCalledWith(5, "audipatron_ceo_refresh", {
      section: "alertas",
      hasFilters: true,
    });
    expect(track).toHaveBeenNthCalledWith(6, "audipatron_ceo_export", {
      kind: "pdf",
      status: "completed",
      section: "puente",
    });
    expect(track).toHaveBeenNthCalledWith(7, "audipatron_funnel_step", {
      step: "ceo_export_completed",
      kind: "pdf",
      section: "puente",
    });
    expect(track).toHaveBeenNthCalledWith(8, "audipatron_ceo_guardrail", {
      status: "blocked",
      reason: "snapshot_stale",
      section: "resumen",
      actionKind: "export",
    });
    expect(track).toHaveBeenNthCalledWith(9, "audipatron_funnel_step", {
      step: "ceo_guardrail_blocked",
      status: "blocked",
      reason: "snapshot_stale",
      section: "resumen",
      actionKind: "export",
    });
    expect(track).toHaveBeenNthCalledWith(10, "audipatron_ceo_master_metrics_viewed", {
      source: "ceo_dashboard",
      uniqueActors: 2,
    });
    expect(track).toHaveBeenNthCalledWith(11, "audipatron_funnel_step", {
      step: "ceo_master_metrics_viewed",
      source: "ceo_dashboard",
      uniqueActors: 2,
    });
  });
});

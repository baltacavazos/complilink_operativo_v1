import { afterEach, describe, expect, it, vi } from "vitest";
import {
  trackCeoConsoleViewed,
  trackCeoExport,
  trackCeoRefresh,
  trackCeoViewModeToggled,
  trackEvent,
  trackFunnelStep,
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
  vi.restoreAllMocks();
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

    expect(track).toHaveBeenNthCalledWith(1, "custom_event", {
      source: "home",
    });
    expect(track).toHaveBeenNthCalledWith(2, "audipatron_funnel_step", {
      step: "legal_gate_viewed",
      caseId: "case_123",
      accepted: false,
    });
  });

  it("emits standardized CEO analytics events for view, toggle, refresh and export", () => {
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
  });
});

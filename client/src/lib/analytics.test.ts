import { afterEach, describe, expect, it, vi } from "vitest";

import { trackEvent, trackFunnelStep } from "./analytics";

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
});

type AnalyticsPayload = Record<string, string | number | boolean | null | undefined>;

type UmamiTracker = {
  track: (eventName: string, payload?: AnalyticsPayload) => void;
};

declare global {
  interface Window {
    umami?: UmamiTracker;
  }
}

function sanitizePayload(payload?: AnalyticsPayload) {
  if (!payload) {
    return undefined;
  }

  const entries = Object.entries(payload).filter(([, value]) => value !== undefined);

  if (entries.length === 0) {
    return undefined;
  }

  return Object.fromEntries(entries);
}

export function trackEvent(eventName: string, payload?: AnalyticsPayload) {
  if (typeof window === "undefined" || !window.umami?.track) {
    return;
  }

  window.umami.track(eventName, sanitizePayload(payload));
}

export function trackFunnelStep(step: string, payload?: AnalyticsPayload) {
  trackEvent("audipatron_funnel_step", {
    step,
    ...payload,
  });
}

const ANALYTICS_ENDPOINT_PATTERN = /^https?:\/\/[^\s%]+$/i;
const ANALYTICS_WEBSITE_ID_PATTERN = /^[^\s%]+$/;
const GA_MEASUREMENT_ID_PATTERN = /^G-[A-Z0-9]+$/;
const META_PIXEL_ID_PATTERN = /^\d{5,20}$/;

export function isAnalyticsEndpoint(value: unknown): value is string {
  return typeof value === "string" && ANALYTICS_ENDPOINT_PATTERN.test(value);
}

export function isAnalyticsWebsiteId(value: unknown): value is string {
  return typeof value === "string" && ANALYTICS_WEBSITE_ID_PATTERN.test(value);
}

export function isGaMeasurementId(value: unknown): value is string {
  return typeof value === "string" && GA_MEASUREMENT_ID_PATTERN.test(value);
}

export function isMetaPixelId(value: unknown): value is string {
  return typeof value === "string" && META_PIXEL_ID_PATTERN.test(value);
}

/** Umami Cloud and current self-host builds serve `/script.js`, not legacy `/umami`. */
export function analyticsScriptSrc(endpoint: string) {
  const trimmed = endpoint.replace(/\/+$/, "");
  if (/\.js$/i.test(trimmed)) {
    return trimmed;
  }
  return `${trimmed}/script.js`;
}

function installUmamiAnalytics() {
  const endpoint = import.meta.env.VITE_ANALYTICS_ENDPOINT;
  const websiteId = import.meta.env.VITE_ANALYTICS_WEBSITE_ID;

  if (
    !isAnalyticsEndpoint(endpoint) ||
    !isAnalyticsWebsiteId(websiteId) ||
    typeof document === "undefined" ||
    document.querySelector('script[data-auditapatron-analytics="1"]')
  ) {
    return;
  }

  const script = document.createElement("script");
  script.defer = true;
  script.src = analyticsScriptSrc(endpoint);
  script.setAttribute("data-website-id", websiteId);
  script.setAttribute("data-auditapatron-analytics", "1");
  document.head.appendChild(script);
}

function installGoogleAnalytics() {
  const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID;

  if (
    !isGaMeasurementId(measurementId) ||
    typeof document === "undefined" ||
    typeof window === "undefined" ||
    document.querySelector('script[data-auditapatron-ga="1"]')
  ) {
    return;
  }

  window.dataLayer = window.dataLayer || [];
  if (typeof window.gtag !== "function") {
    window.gtag = function gtag(...args: unknown[]) {
      window.dataLayer?.push(args);
    };
  }

  window.gtag("js", new Date());
  window.gtag("config", measurementId, {
    anonymize_ip: true,
    send_page_view: true,
  });

  const script = document.createElement("script");
  script.async = true;
  script.defer = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  script.setAttribute("data-auditapatron-ga", "1");
  document.head.appendChild(script);
}

type FbqFn = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[];
  loaded: boolean;
  version: string;
  push: (...args: unknown[]) => void;
};

function createMetaPixelStub(): FbqFn {
  const holder: { fn?: FbqFn } = {};
  const fbq = function (...args: unknown[]) {
    const fn = holder.fn;
    if (!fn) {
      return;
    }
    if (typeof fn.callMethod === "function") {
      fn.callMethod(...args);
    } else {
      fn.queue.push(args);
    }
  } as FbqFn;
  fbq.queue = [];
  fbq.loaded = true;
  fbq.version = "2.0";
  fbq.push = fbq;
  holder.fn = fbq;
  return fbq;
}

function installMetaPixel() {
  const pixelId = import.meta.env.VITE_META_PIXEL_ID;

  if (
    !isMetaPixelId(pixelId) ||
    typeof document === "undefined" ||
    typeof window === "undefined" ||
    document.querySelector('script[data-auditapatron-meta="1"]')
  ) {
    return;
  }

  if (typeof window.fbq !== "function") {
    const fbq = createMetaPixelStub();
    window.fbq = fbq;
    if (!window._fbq) {
      window._fbq = fbq;
    }
  }

  window.fbq("init", pixelId);
  window.fbq("track", "PageView");

  const script = document.createElement("script");
  script.async = true;
  script.defer = true;
  script.src = "https://connect.facebook.net/en_US/fbevents.js";
  script.setAttribute("data-auditapatron-meta", "1");
  document.head.appendChild(script);
}

/**
 * Optional analytics installers. Each one no-ops when its env var is missing or invalid.
 * Page views only for GA4 and Meta. No personal data is attached.
 * Product `track*` helpers stay on Umami and do not forward identifiers.
 */
export function installOptionalAnalytics() {
  installUmamiAnalytics();
  installGoogleAnalytics();
  installMetaPixel();
}

type AnalyticsPayload = Record<string, string | number | boolean | null | undefined>;

type UmamiTracker = {
  track: (eventName: string, payload?: AnalyticsPayload) => void;
};

declare global {
  interface Window {
    umami?: UmamiTracker;
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    fbq?: FbqFn;
    _fbq?: FbqFn;
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

export function trackLegalGateEvent(
  event:
    | "consent_toggled"
    | "validation_blocked"
    | "accepted"
    | "lock_conflict"
    | "retry_available",
  payload?: AnalyticsPayload,
) {
  trackEvent("audipatron_legal_gate", {
    event,
    ...payload,
  });
}

export function trackCeoConsoleViewed(section: string, payload?: AnalyticsPayload) {
  trackEvent("audipatron_ceo_console_viewed", {
    section,
    ...payload,
  });

  trackFunnelStep("ceo_console_viewed", {
    section,
    ...payload,
  });
}

export function trackCeoMasterMetricsViewed(payload?: AnalyticsPayload) {
  trackEvent("audipatron_ceo_master_metrics_viewed", payload);

  trackFunnelStep("ceo_master_metrics_viewed", payload);
}

export function trackCeoViewModeToggled(mode: "user_demo" | "ceo_master", payload?: AnalyticsPayload) {
  trackEvent("audipatron_ceo_view_mode_toggled", {
    mode,
    ...payload,
  });

  trackFunnelStep(mode === "user_demo" ? "ceo_user_view_entered" : "ceo_master_view_restored", {
    mode,
    ...payload,
  });
}

export function trackCeoRefresh(section: string, payload?: AnalyticsPayload) {
  trackEvent("audipatron_ceo_refresh", {
    section,
    ...payload,
  });
}

export function trackCeoGuardrail(
  status: "blocked" | "warning" | "resolved",
  payload?: AnalyticsPayload,
) {
  trackEvent("audipatron_ceo_guardrail", {
    status,
    ...payload,
  });

  if (status === "blocked") {
    trackFunnelStep("ceo_guardrail_blocked", {
      status,
      ...payload,
    });
  }
}

export function trackCeoExport(
  kind: "csv" | "pdf",
  status: "requested" | "completed" | "blocked" | "failed",
  payload?: AnalyticsPayload,
) {
  trackEvent("audipatron_ceo_export", {
    kind,
    status,
    ...payload,
  });

  if (status === "completed") {
    trackFunnelStep("ceo_export_completed", {
      kind,
      ...payload,
    });
  }
}

export function trackCommercePaywallViewed(planTarget: string, triggerPoint: string, payload?: AnalyticsPayload) {
  trackEvent("audipatron_commerce_paywall_viewed", {
    plan_target: planTarget,
    trigger_point: triggerPoint,
    ...payload,
  });

  trackFunnelStep("commerce_paywall_viewed", {
    plan_target: planTarget,
    trigger_point: triggerPoint,
    ...payload,
  });
}

export function trackCommerceUpgradeCTAClicked(planTarget: string, triggerPoint: string, payload?: AnalyticsPayload) {
  trackEvent("audipatron_commerce_upgrade_cta_clicked", {
    plan_target: planTarget,
    trigger_point: triggerPoint,
    ...payload,
  });

  trackFunnelStep("commerce_upgrade_cta_clicked", {
    plan_target: planTarget,
    trigger_point: triggerPoint,
    ...payload,
  });
}

export function trackCommerceCheckoutStarted(productKey: string, payload?: AnalyticsPayload) {
  trackEvent("audipatron_commerce_checkout_started", {
    product_key: productKey,
    ...payload,
  });

  trackFunnelStep("commerce_checkout_started", {
    product_key: productKey,
    ...payload,
  });
}

export function trackCommercePaymentSuccessful(productKey: string, payload?: AnalyticsPayload) {
  trackEvent("audipatron_commerce_payment_successful", {
    product_key: productKey,
    ...payload,
  });

  trackFunnelStep("commerce_payment_successful", {
    product_key: productKey,
    ...payload,
  });
}

export function trackCommercePlanActivated(planName: string, payload?: AnalyticsPayload) {
  trackEvent("audipatron_commerce_plan_activated", {
    plan_name: planName,
    ...payload,
  });

  trackFunnelStep("commerce_plan_activated", {
    plan_name: planName,
    ...payload,
  });
}

export function trackCommerceOneShotPurchased(productName: string, payload?: AnalyticsPayload) {
  trackEvent("audipatron_commerce_one_shot_purchased", {
    product_name: productName,
    ...payload,
  });

  trackFunnelStep("commerce_one_shot_purchased", {
    product_name: productName,
    ...payload,
  });
}

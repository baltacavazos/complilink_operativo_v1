const ANALYTICS_ENDPOINT_PATTERN = /^https?:\/\/[^\s%]+$/i;
const ANALYTICS_WEBSITE_ID_PATTERN = /^[^\s%]+$/;

export function isAnalyticsEndpoint(value: unknown): value is string {
  return typeof value === "string" && ANALYTICS_ENDPOINT_PATTERN.test(value);
}

export function isAnalyticsWebsiteId(value: unknown): value is string {
  return typeof value === "string" && ANALYTICS_WEBSITE_ID_PATTERN.test(value);
}

export function analyticsScriptSrc(endpoint: string) {
  return `${endpoint.replace(/\/+$/, "")}/umami`;
}

export function installOptionalAnalytics() {
  const endpoint = import.meta.env.VITE_ANALYTICS_ENDPOINT;
  const websiteId = import.meta.env.VITE_ANALYTICS_WEBSITE_ID;

  if (
    typeof endpoint !== "string" ||
    !ANALYTICS_ENDPOINT_PATTERN.test(endpoint) ||
    typeof websiteId !== "string" ||
    !ANALYTICS_WEBSITE_ID_PATTERN.test(websiteId) ||
    typeof document === "undefined" ||
    document.querySelector('script[data-auditapatron-analytics="1"]')
  ) {
    return;
  }

  const script = document.createElement("script");
  script.defer = true;
  script.src = `${endpoint.replace(/\/+$/, "")}/umami`;
  script.setAttribute("data-website-id", websiteId);
  script.setAttribute("data-auditapatron-analytics", "1");
  document.head.appendChild(script);
}

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

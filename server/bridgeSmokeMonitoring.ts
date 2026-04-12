import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const DEFAULT_RESULTS_PATH = resolve(process.cwd(), "bridge_smoke_test_results.json");
const DEFAULT_HISTORY_PATH = resolve(process.cwd(), "bridge_smoke_test_history.jsonl");
const DEFAULT_ALERT_STATE_PATH = resolve(process.cwd(), "bridge_smoke_test_alert_state.json");
const DEFAULT_HISTORY_LIMIT = 30;
const DEFAULT_ALERT_THRESHOLD = 3;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export type BridgeSmokeHistoryStatus = "passed" | "failed" | "error";
export type BridgeSmokeAlertSeverity = "neutral" | "warning" | "critical" | "success";
export type BridgeSmokeAlertVisualState = "stable" | "watch" | "active_alert" | "recovered";
export type BridgeSmokeAlertAction =
  | "none"
  | "below-threshold"
  | "failure-threshold-reached"
  | "deduped-active-alert"
  | "recovery";

export type BridgeSmokeHistoryEntry = {
  testedAt: string | null;
  testedAtMs: number | null;
  baseUrl: string | null;
  runMode: string | null;
  passed: boolean;
  status: BridgeSmokeHistoryStatus;
  healthStatus: number | null;
  webhookStatus: number | null;
  verified: boolean | null;
  error: string | null;
};

export type BridgeSmokeMonitoringSnapshot = {
  availability: "missing" | "error" | "ready";
  testedAt: string | null;
  baseUrl: string | null;
  ageMinutes: number | null;
  health: {
    status: number | null;
    statusText: string | null;
    responseContract: string | null;
    ok: boolean;
  };
  webhook: {
    status: number | null;
    verified: boolean | null;
    processingStatus: string | null;
    event: string | null;
    responseContract: string | null;
    receivedAt: string | null;
    ok: boolean;
  };
  contractCheck: {
    passed: boolean;
    expectedHealthStatus: number;
    expectedWebhookStatus: number;
    expectedContract: string;
  };
  history: BridgeSmokeHistoryEntry[];
  summary: {
    totalRuns: number;
    passedRuns: number;
    failedRuns: number;
    errorRuns: number;
    consecutiveFailures: number;
    successRate: number;
    last24Hours: number;
  };
  alerting: {
    threshold: number;
    notificationsConfigured: boolean;
    action: BridgeSmokeAlertAction;
    delivered: boolean;
    alertActive: boolean;
    visualState: BridgeSmokeAlertVisualState;
    severity: BridgeSmokeAlertSeverity;
    statusLabel: string;
    detail: string;
    activatedAt: string | null;
    recoveredAt: string | null;
    lastFailureAlertAt: string | null;
    lastRecoveryAlertAt: string | null;
    lastObservedStatus: BridgeSmokeHistoryStatus | null;
    lastObservedConsecutiveFailures: number;
  };
};

type BridgeSmokeAlertStateFile = {
  threshold: number | null;
  alertActive: boolean;
  activatedAt: string | null;
  recoveredAt: string | null;
  lastFailureAlertAt: string | null;
  lastRecoveryAlertAt: string | null;
  lastNotifiedStatus: string | null;
  lastObservedStatus: BridgeSmokeHistoryStatus | null;
  lastObservedConsecutiveFailures: number | null;
};

function getPayloadRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function getPayloadString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function getPayloadNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getPayloadBoolean(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

function parseTestedAt(value: unknown) {
  const testedAt = getPayloadString(value);
  if (!testedAt) {
    return { testedAt: null, testedAtMs: null } as const;
  }

  const testedAtMs = new Date(testedAt).getTime();
  return {
    testedAt,
    testedAtMs: Number.isFinite(testedAtMs) ? testedAtMs : null,
  } as const;
}

function getHistoryStatus(input: { passed: boolean; error: string | null; healthStatus: number | null; webhookStatus: number | null }) {
  if (input.passed) return "passed" as const;
  if (input.error || (input.healthStatus === null && input.webhookStatus === null)) return "error" as const;
  return "failed" as const;
}

function getDefaultAlertThreshold() {
  const value = Number.parseInt(process.env.BRIDGE_SMOKE_ALERT_THRESHOLD ?? "", 10);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_ALERT_THRESHOLD;
}

function buildFallbackSnapshot(): BridgeSmokeMonitoringSnapshot {
  return {
    availability: "missing",
    testedAt: null,
    baseUrl: null,
    ageMinutes: null,
    health: {
      status: null,
      statusText: null,
      responseContract: null,
      ok: false,
    },
    webhook: {
      status: null,
      verified: null,
      processingStatus: null,
      event: null,
      responseContract: null,
      receivedAt: null,
      ok: false,
    },
    contractCheck: {
      passed: false,
      expectedHealthStatus: 200,
      expectedWebhookStatus: 202,
      expectedContract: "auditapatron.bridge.ack.v1",
    },
    history: [],
    summary: {
      totalRuns: 0,
      passedRuns: 0,
      failedRuns: 0,
      errorRuns: 0,
      consecutiveFailures: 0,
      successRate: 0,
      last24Hours: 0,
    },
    alerting: {
      threshold: getDefaultAlertThreshold(),
      notificationsConfigured: false,
      action: "none",
      delivered: false,
      alertActive: false,
      visualState: "stable",
      severity: "neutral",
      statusLabel: "Sin alertas activas",
      detail: "El smoke test del bridge no reporta alertas activas todavía.",
      activatedAt: null,
      recoveredAt: null,
      lastFailureAlertAt: null,
      lastRecoveryAlertAt: null,
      lastObservedStatus: null,
      lastObservedConsecutiveFailures: 0,
    },
  };
}

function parseLatestSnapshot(raw: string, nowMs: number) {
  const fallback = buildFallbackSnapshot();
  const payload = getPayloadRecord(JSON.parse(raw));
  if (!payload) return fallback;

  const health = getPayloadRecord(payload.health);
  const healthBody = getPayloadRecord(health?.body);
  const webhook = getPayloadRecord(payload.webhook);
  const webhookBody = getPayloadRecord(webhook?.body);
  const contractCheck = getPayloadRecord(payload.contractCheck);
  const alerting = getPayloadRecord(payload.alerting);
  const { testedAt, testedAtMs } = parseTestedAt(payload.testedAt);

  return {
    ...fallback,
    availability: "ready" as const,
    testedAt,
    baseUrl: getPayloadString(payload.baseUrl),
    ageMinutes: testedAtMs === null ? null : Math.max(0, Math.round((nowMs - testedAtMs) / 60000)),
    health: {
      status: getPayloadNumber(health?.status),
      statusText: getPayloadString(healthBody?.status),
      responseContract: getPayloadString(healthBody?.responseContract),
      ok: getPayloadNumber(health?.status) === 200,
    },
    webhook: {
      status: getPayloadNumber(webhook?.status),
      verified: getPayloadBoolean(webhookBody?.verified),
      processingStatus: getPayloadString(webhookBody?.processingStatus),
      event: getPayloadString(webhookBody?.event),
      responseContract: getPayloadString(webhookBody?.responseContract),
      receivedAt: getPayloadString(webhookBody?.receivedAt),
      ok: getPayloadNumber(webhook?.status) === 202 && getPayloadBoolean(webhookBody?.verified) === true,
    },
    contractCheck: {
      passed: getPayloadBoolean(contractCheck?.passed) === true,
      expectedHealthStatus: getPayloadNumber(contractCheck?.expectedHealthStatus) ?? 200,
      expectedWebhookStatus: getPayloadNumber(contractCheck?.expectedWebhookStatus) ?? 202,
      expectedContract: getPayloadString(contractCheck?.expectedContract) ?? "auditapatron.bridge.ack.v1",
    },
    alerting: {
      ...fallback.alerting,
      threshold: getPayloadNumber(alerting?.threshold) ?? fallback.alerting.threshold,
      notificationsConfigured: getPayloadBoolean(alerting?.notificationsConfigured) ?? false,
      action: (getPayloadString(alerting?.action) as BridgeSmokeAlertAction | null) ?? "none",
      delivered: getPayloadBoolean(alerting?.delivered) ?? false,
      alertActive: getPayloadBoolean(alerting?.alertActive) ?? false,
    },
  };
}

function parseHistoryEntry(line: string): BridgeSmokeHistoryEntry | null {
  if (line.trim().length === 0) return null;

  try {
    const payload = getPayloadRecord(JSON.parse(line));
    if (!payload) return null;

    const health = getPayloadRecord(payload.health);
    const webhook = getPayloadRecord(payload.webhook);
    const webhookBody = getPayloadRecord(webhook?.body);
    const contractCheck = getPayloadRecord(payload.contractCheck);
    const { testedAt, testedAtMs } = parseTestedAt(payload.testedAt);
    const healthStatus = getPayloadNumber(health?.status);
    const webhookStatus = getPayloadNumber(webhook?.status);
    const verified = getPayloadBoolean(webhookBody?.verified);
    const error = getPayloadString(payload.error);
    const passed = getPayloadBoolean(contractCheck?.passed) === true;

    return {
      testedAt,
      testedAtMs,
      baseUrl: getPayloadString(payload.baseUrl),
      runMode: getPayloadString(payload.runMode),
      passed,
      status: getHistoryStatus({ passed, error, healthStatus, webhookStatus }),
      healthStatus,
      webhookStatus,
      verified,
      error,
    };
  } catch {
    return null;
  }
}

function readHistoryEntries(historyPath: string, historyLimit: number) {
  if (!existsSync(historyPath)) return [] as BridgeSmokeHistoryEntry[];

  const raw = readFileSync(historyPath, "utf8");
  const entries = raw
    .split("\n")
    .map((line) => parseHistoryEntry(line))
    .filter((entry): entry is BridgeSmokeHistoryEntry => entry !== null)
    .sort((left, right) => (right.testedAtMs ?? -1) - (left.testedAtMs ?? -1));

  return entries.slice(0, Math.max(1, historyLimit));
}

function buildHistorySummary(entries: BridgeSmokeHistoryEntry[], nowMs: number) {
  const totalRuns = entries.length;
  const passedRuns = entries.filter((entry) => entry.status === "passed").length;
  const failedRuns = entries.filter((entry) => entry.status === "failed").length;
  const errorRuns = entries.filter((entry) => entry.status === "error").length;
  let consecutiveFailures = 0;

  for (const entry of entries) {
    if (entry.status === "passed") break;
    consecutiveFailures += 1;
  }

  const successRate = totalRuns === 0 ? 0 : Math.round((passedRuns / totalRuns) * 100);
  const last24Hours = entries.filter((entry) => entry.testedAtMs !== null && nowMs - entry.testedAtMs <= ONE_DAY_MS).length;

  return {
    totalRuns,
    passedRuns,
    failedRuns,
    errorRuns,
    consecutiveFailures,
    successRate,
    last24Hours,
  };
}

function readAlertState(alertStatePath: string): BridgeSmokeAlertStateFile {
  const fallback: BridgeSmokeAlertStateFile = {
    threshold: null,
    alertActive: false,
    activatedAt: null,
    recoveredAt: null,
    lastFailureAlertAt: null,
    lastRecoveryAlertAt: null,
    lastNotifiedStatus: null,
    lastObservedStatus: null,
    lastObservedConsecutiveFailures: null,
  };

  if (!existsSync(alertStatePath)) return fallback;

  try {
    const payload = getPayloadRecord(JSON.parse(readFileSync(alertStatePath, "utf8")));
    if (!payload) return fallback;

    const lastObservedStatus = getPayloadString(payload.lastObservedStatus);

    return {
      threshold: getPayloadNumber(payload.threshold),
      alertActive: getPayloadBoolean(payload.alertActive) ?? false,
      activatedAt: getPayloadString(payload.activatedAt),
      recoveredAt: getPayloadString(payload.recoveredAt),
      lastFailureAlertAt: getPayloadString(payload.lastFailureAlertAt),
      lastRecoveryAlertAt: getPayloadString(payload.lastRecoveryAlertAt),
      lastNotifiedStatus: getPayloadString(payload.lastNotifiedStatus),
      lastObservedStatus:
        lastObservedStatus === "passed" || lastObservedStatus === "failed" || lastObservedStatus === "error"
          ? lastObservedStatus
          : null,
      lastObservedConsecutiveFailures: getPayloadNumber(payload.lastObservedConsecutiveFailures),
    };
  } catch {
    return fallback;
  }
}

function buildAlertingSnapshot(input: {
  latestAlerting: BridgeSmokeMonitoringSnapshot["alerting"];
  alertState: BridgeSmokeAlertStateFile;
  summary: BridgeSmokeMonitoringSnapshot["summary"];
  history: BridgeSmokeHistoryEntry[];
}) {
  const latestHistoryStatus = input.history[0]?.status ?? null;
  const threshold = input.alertState.threshold || input.latestAlerting.threshold || getDefaultAlertThreshold();
  const lastObservedConsecutiveFailures =
    input.alertState.lastObservedConsecutiveFailures ?? input.summary.consecutiveFailures;
  const lastObservedStatus = input.alertState.lastObservedStatus ?? latestHistoryStatus;
  const alertActive = input.latestAlerting.alertActive || input.alertState.alertActive;
  const action = input.latestAlerting.action;

  let visualState: BridgeSmokeAlertVisualState = "stable";
  let severity: BridgeSmokeAlertSeverity = "neutral";
  let statusLabel = "Sin alertas activas";
  let detail = "El bridge se mantiene estable dentro del umbral operativo configurado.";

  if (alertActive) {
    visualState = "active_alert";
    severity = "critical";
    statusLabel = "Alerta activa";
    detail = `El bridge acumula ${lastObservedConsecutiveFailures} fallos consecutivos y mantiene una alerta operativa activa.`;
  } else if (lastObservedConsecutiveFailures >= threshold) {
    visualState = "watch";
    severity = "warning";
    statusLabel = "Umbral alcanzado";
    detail = `El bridge alcanzó el umbral operativo de ${threshold} fallos consecutivos, pero la alerta no figura como activa.`;
  } else if (lastObservedConsecutiveFailures > 0) {
    visualState = "watch";
    severity = "warning";
    statusLabel = "En observación";
    detail = `El bridge suma ${lastObservedConsecutiveFailures} fallo${lastObservedConsecutiveFailures === 1 ? "" : "s"} consecutivo${lastObservedConsecutiveFailures === 1 ? "" : "s"} y sigue por debajo del umbral ${threshold}.`;
  } else if (
    lastObservedStatus === "passed" &&
    (action === "recovery" || input.alertState.lastNotifiedStatus === "recovery")
  ) {
    visualState = "recovered";
    severity = "success";
    statusLabel = "Recuperación notificada";
    detail = "La última ejecución volvió a pasar y ya se notificó la recuperación del bridge al propietario.";
  } else if (lastObservedStatus === "passed") {
    detail = "La última verificación contractual del bridge pasó correctamente y no hay rachas de fallo activas.";
  }

  return {
    threshold,
    notificationsConfigured: input.latestAlerting.notificationsConfigured,
    action,
    delivered: input.latestAlerting.delivered,
    alertActive,
    visualState,
    severity,
    statusLabel,
    detail,
    activatedAt: input.alertState.activatedAt,
    recoveredAt: input.alertState.recoveredAt,
    lastFailureAlertAt: input.alertState.lastFailureAlertAt,
    lastRecoveryAlertAt: input.alertState.lastRecoveryAlertAt,
    lastObservedStatus,
    lastObservedConsecutiveFailures,
  } satisfies BridgeSmokeMonitoringSnapshot["alerting"];
}

export function readBridgeSmokeMonitoringSnapshot(options?: {
  resultsPath?: string;
  historyPath?: string;
  alertStatePath?: string;
  historyLimit?: number;
  nowMs?: number;
}): BridgeSmokeMonitoringSnapshot {
  const resultsPath = options?.resultsPath ?? DEFAULT_RESULTS_PATH;
  const historyPath = options?.historyPath ?? DEFAULT_HISTORY_PATH;
  const alertStatePath = options?.alertStatePath ?? DEFAULT_ALERT_STATE_PATH;
  const historyLimit = options?.historyLimit ?? DEFAULT_HISTORY_LIMIT;
  const nowMs = options?.nowMs ?? Date.now();
  const history = readHistoryEntries(historyPath, historyLimit);
  const historySummary = buildHistorySummary(history, nowMs);
  const alertState = readAlertState(alertStatePath);

  if (!existsSync(resultsPath)) {
    const fallback = buildFallbackSnapshot();
    return {
      ...fallback,
      history,
      summary: historySummary,
      alerting: buildAlertingSnapshot({
        latestAlerting: fallback.alerting,
        alertState,
        summary: historySummary,
        history,
      }),
    };
  }

  try {
    const latest = parseLatestSnapshot(readFileSync(resultsPath, "utf8"), nowMs);
    return {
      ...latest,
      history,
      summary: historySummary,
      alerting: buildAlertingSnapshot({
        latestAlerting: latest.alerting,
        alertState,
        summary: historySummary,
        history,
      }),
    };
  } catch {
    const fallback = buildFallbackSnapshot();
    return {
      ...fallback,
      availability: "error",
      history,
      summary: historySummary,
      alerting: buildAlertingSnapshot({
        latestAlerting: fallback.alerting,
        alertState,
        summary: historySummary,
        history,
      }),
    };
  }
}

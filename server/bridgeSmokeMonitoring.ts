import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const DEFAULT_RESULTS_PATH = resolve(process.cwd(), "bridge_smoke_test_results.json");
const DEFAULT_HISTORY_PATH = resolve(process.cwd(), "bridge_smoke_test_history.jsonl");
const DEFAULT_HISTORY_LIMIT = 30;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export type BridgeSmokeHistoryStatus = "passed" | "failed" | "error";

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

export function readBridgeSmokeMonitoringSnapshot(options?: {
  resultsPath?: string;
  historyPath?: string;
  historyLimit?: number;
  nowMs?: number;
}): BridgeSmokeMonitoringSnapshot {
  const resultsPath = options?.resultsPath ?? DEFAULT_RESULTS_PATH;
  const historyPath = options?.historyPath ?? DEFAULT_HISTORY_PATH;
  const historyLimit = options?.historyLimit ?? DEFAULT_HISTORY_LIMIT;
  const nowMs = options?.nowMs ?? Date.now();
  const history = readHistoryEntries(historyPath, historyLimit);
  const historySummary = buildHistorySummary(history, nowMs);

  if (!existsSync(resultsPath)) {
    return {
      ...buildFallbackSnapshot(),
      history,
      summary: historySummary,
    };
  }

  try {
    const latest = parseLatestSnapshot(readFileSync(resultsPath, "utf8"), nowMs);
    return {
      ...latest,
      history,
      summary: historySummary,
    };
  } catch {
    return {
      ...buildFallbackSnapshot(),
      availability: "error",
      history,
      summary: historySummary,
    };
  }
}

export type BridgeSmokeHistoryStatus = "passed" | "failed" | "error";
export type BridgeSmokeHistoryFilter = "all" | BridgeSmokeHistoryStatus;
export type BridgeSmokeAlertSeverity = "neutral" | "warning" | "critical" | "success";
export type BridgeSmokeAlertVisualState = "stable" | "watch" | "active_alert" | "recovered";
export type BridgeSmokeHistoryTimeWindow = "all" | "24h" | "72h" | "7d";
export type BridgeSmokeHistorySeverityFilter = "all" | "success" | "warning" | "critical";

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

export type BridgeSmokeHistoryFilters = {
  status?: BridgeSmokeHistoryFilter;
  timeWindow?: BridgeSmokeHistoryTimeWindow;
  severity?: BridgeSmokeHistorySeverityFilter;
  nowMs?: number;
};

const BRIDGE_SMOKE_TIME_WINDOW_MS: Record<Exclude<BridgeSmokeHistoryTimeWindow, "all">, number> = {
  "24h": 24 * 60 * 60 * 1000,
  "72h": 72 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
};

export function getBridgeSmokeHistorySeverity(entry: BridgeSmokeHistoryEntry): BridgeSmokeHistorySeverityFilter {
  if (entry.status === "passed") return "success";
  if (entry.status === "failed") return "warning";
  return "critical";
}

export function filterBridgeSmokeHistory(
  entries: BridgeSmokeHistoryEntry[],
  filterOrOptions: BridgeSmokeHistoryFilter | BridgeSmokeHistoryFilters,
  nowMs = Date.now(),
) {
  const options =
    typeof filterOrOptions === "string"
      ? ({ status: filterOrOptions, timeWindow: "all", severity: "all", nowMs } satisfies BridgeSmokeHistoryFilters)
      : ({ status: "all", timeWindow: "all", severity: "all", nowMs, ...filterOrOptions } satisfies BridgeSmokeHistoryFilters);

  return entries.filter((entry) => {
    if (options.status !== "all" && entry.status !== options.status) {
      return false;
    }

    if (options.severity !== "all" && getBridgeSmokeHistorySeverity(entry) !== options.severity) {
      return false;
    }

    if (options.timeWindow !== "all") {
      const entryTime = entry.testedAtMs;
      const maxAgeMs = BRIDGE_SMOKE_TIME_WINDOW_MS[options.timeWindow];
      if (entryTime === null || (options.nowMs ?? nowMs) - entryTime > maxAgeMs) {
        return false;
      }
    }

    return true;
  });
}

export function buildBridgeSmokeHistorySummary(entries: BridgeSmokeHistoryEntry[]) {
  const totalRuns = entries.length;
  const passedRuns = entries.filter((entry) => entry.status === "passed").length;
  const failedRuns = entries.filter((entry) => entry.status === "failed").length;
  const errorRuns = entries.filter((entry) => entry.status === "error").length;
  let consecutiveFailures = 0;

  for (const entry of entries) {
    if (entry.status === "passed") break;
    consecutiveFailures += 1;
  }

  return {
    totalRuns,
    passedRuns,
    failedRuns,
    errorRuns,
    successRate: totalRuns === 0 ? 0 : Math.round((passedRuns / totalRuns) * 100),
    consecutiveFailures,
    latestStatus: entries[0]?.status ?? null,
  };
}

export function getBridgeSmokeHistoryFilterLabel(filter: BridgeSmokeHistoryFilter) {
  switch (filter) {
    case "passed":
      return "Conformes";
    case "failed":
      return "Fallos";
    case "error":
      return "Errores";
    default:
      return "Todos";
  }
}

export function getBridgeSmokeHistoryTimeWindowLabel(timeWindow: BridgeSmokeHistoryTimeWindow) {
  switch (timeWindow) {
    case "24h":
      return "24 h";
    case "72h":
      return "72 h";
    case "7d":
      return "7 días";
    default:
      return "Todo el histórico";
  }
}

export function getBridgeSmokeHistorySeverityLabel(severity: BridgeSmokeHistorySeverityFilter) {
  switch (severity) {
    case "success":
      return "Conformes";
    case "warning":
      return "Contractuales";
    case "critical":
      return "Técnicos";
    default:
      return "Todas las severidades";
  }
}

export function getBridgeSmokeHistoryStatusLabel(status: BridgeSmokeHistoryStatus) {
  if (status === "passed") return "Conforme";
  if (status === "failed") return "Falló";
  return "Error técnico";
}

export function getBridgeSmokeHistoryStatusTone(status: BridgeSmokeHistoryStatus) {
  if (status === "passed") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "failed") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-rose-200 bg-rose-50 text-rose-700";
}

export function getBridgeSmokeHistoryContext(entry: BridgeSmokeHistoryEntry) {
  if (entry.status === "passed") {
    return `Health ${entry.healthStatus ?? "—"} · Webhook ${entry.webhookStatus ?? "—"}`;
  }

  if (entry.error) {
    return entry.error;
  }

  return `Health ${entry.healthStatus ?? "—"} · Webhook ${entry.webhookStatus ?? "—"}`;
}

export function getBridgeSmokeAlertSeverityTone(severity: BridgeSmokeAlertSeverity) {
  switch (severity) {
    case "critical":
      return {
        badge: "border-rose-200 bg-rose-50 text-rose-700",
        card: "border-rose-200 bg-rose-50/80 text-rose-950",
      };
    case "warning":
      return {
        badge: "border-amber-200 bg-amber-50 text-amber-700",
        card: "border-amber-200 bg-amber-50/80 text-amber-950",
      };
    case "success":
      return {
        badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
        card: "border-emerald-200 bg-emerald-50/80 text-emerald-950",
      };
    default:
      return {
        badge: "border-slate-200 bg-slate-50 text-slate-700",
        card: "border-slate-200 bg-slate-50/80 text-slate-950",
      };
  }
}

export function getBridgeSmokeAlertVisualStateLabel(state: BridgeSmokeAlertVisualState) {
  switch (state) {
    case "active_alert":
      return "Alerta activa";
    case "watch":
      return "En observación";
    case "recovered":
      return "Recuperado";
    default:
      return "Estable";
  }
}

export function getBridgeSmokeAlertTimestampLabel(input: {
  activatedAt?: string | null;
  recoveredAt?: string | null;
  testedAt?: string | null;
}) {
  if (input.recoveredAt) return `Recuperado ${input.recoveredAt}`;
  if (input.activatedAt) return `Alerta desde ${input.activatedAt}`;
  if (input.testedAt) return `Observado ${input.testedAt}`;
  return "Sin marca temporal";
}

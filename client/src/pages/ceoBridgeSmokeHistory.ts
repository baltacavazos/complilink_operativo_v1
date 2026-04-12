export type BridgeSmokeHistoryStatus = "passed" | "failed" | "error";
export type BridgeSmokeHistoryFilter = "all" | BridgeSmokeHistoryStatus;

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

export function filterBridgeSmokeHistory(entries: BridgeSmokeHistoryEntry[], filter: BridgeSmokeHistoryFilter) {
  if (filter === "all") return entries;
  return entries.filter((entry) => entry.status === filter);
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

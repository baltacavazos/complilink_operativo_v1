import type { AuditFeedItem } from "./ceoDashboardMonitoring";

export type BridgeScheduleListItem = {
  id: number;
  presetId: number;
  tenantId: string | null;
  presetName?: string | null;
  cronExpression: string;
  timezone: string;
  nextRunAt: string | null;
  lastRunAt: string | null;
  lastRunStatus: string | null;
  lastRunError: string | null;
  isActive: boolean;
};

export type BridgeScheduleLogbookStatus = "success" | "failed";
export type BridgeScheduleLogbookFilter = "all" | BridgeScheduleLogbookStatus;
export type BridgeScheduleLogbookTimeWindow = "all" | "24h" | "7d" | "30d";

export type BridgeScheduleLogbookRow = {
  key: string;
  scheduleId: number;
  presetId: number | null;
  presetName: string;
  tenantId: string | null;
  status: BridgeScheduleLogbookStatus;
  executedAt: string;
  nextRunAt: string | null;
  traceId: string | null;
  errorMessage: string | null;
  visibleCount: number | null;
  recipientCount: number | null;
  exportFormat: string | null;
  attachments: string[];
  appliedFilters: string[];
};

export type BridgeScheduleLogbookSummary = {
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  schedulesWithHistory: number;
  schedulesWithoutHistory: number;
  activeSchedules: number;
  pausedSchedules: number;
};

export type BridgeScheduleLogbookPanel = {
  summary: BridgeScheduleLogbookSummary;
  rows: BridgeScheduleLogbookRow[];
};

export type BridgeScheduleLogbookFilters = {
  status?: BridgeScheduleLogbookFilter;
  presetKey?: string;
  timeWindow?: BridgeScheduleLogbookTimeWindow;
  searchTerm?: string;
  nowMs?: number;
};

export type BridgeScheduleLogbookPresetOption = {
  value: string;
  label: string;
  count: number;
};

export type BridgeScheduleLogbookUrlState = {
  status: BridgeScheduleLogbookFilter;
  presetKey: string;
  timeWindow: BridgeScheduleLogbookTimeWindow;
  searchTerm: string;
};

const BRIDGE_SCHEDULE_LOGBOOK_TIME_WINDOW_MS: Record<Exclude<BridgeScheduleLogbookTimeWindow, "all">, number> = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

const BRIDGE_SCHEDULE_LOGBOOK_DEFAULT_URL_STATE: BridgeScheduleLogbookUrlState = {
  status: "all",
  presetKey: "all",
  timeWindow: "all",
  searchTerm: "",
};

function parseObject(value: unknown): Record<string, unknown> | null {
  if (!value) return null;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }

  return typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

function readScheduleId(item: AuditFeedItem, state: Record<string, unknown> | null) {
  const explicitId = readNumber(state?.scheduleId);
  if (explicitId !== null) return explicitId;

  const entityMatch = /^bridge-schedule:(\d+)$/.exec(item.entityId);
  if (!entityMatch) return null;

  const parsed = Number(entityMatch[1]);
  return Number.isInteger(parsed) ? parsed : null;
}

function readExecutedAt(item: AuditFeedItem, state: Record<string, unknown> | null) {
  return readString(state?.lastRunAt) ?? readString(state?.executedAt) ?? new Date(item.createdAt).toISOString();
}

function buildPresetKey(row: Pick<BridgeScheduleLogbookRow, "presetId" | "presetName">) {
  if (typeof row.presetId === "number" && Number.isFinite(row.presetId)) {
    return `preset:${row.presetId}`;
  }

  return `name:${row.presetName.toLowerCase()}`;
}

function normalizeSearchTerm(value: string | null | undefined) {
  return value?.trim().toLocaleLowerCase("es") ?? "";
}

function buildBridgeScheduleLogbookSearchIndex(row: BridgeScheduleLogbookRow) {
  return [
    row.presetName,
    `agenda ${row.scheduleId}`,
    String(row.scheduleId),
    row.traceId ?? "",
    row.errorMessage ?? "",
    row.exportFormat ?? "",
    row.tenantId ?? "",
    ...row.appliedFilters,
    ...row.attachments,
  ]
    .join(" ")
    .toLocaleLowerCase("es");
}

function escapeCsvCell(value: string | number | null | undefined) {
  const normalized = value == null ? "" : String(value);
  if (!/[",\n]/.test(normalized)) {
    return normalized;
  }

  return `"${normalized.replaceAll('"', '""')}"`;
}

function isBridgeScheduleLogbookStatus(value: string | null | undefined): value is BridgeScheduleLogbookFilter {
  return value === "all" || value === "success" || value === "failed";
}

function isBridgeScheduleLogbookTimeWindow(value: string | null | undefined): value is BridgeScheduleLogbookTimeWindow {
  return value === "all" || value === "24h" || value === "7d" || value === "30d";
}

export function getBridgeScheduleLogbookDefaultUrlState(): BridgeScheduleLogbookUrlState {
  return { ...BRIDGE_SCHEDULE_LOGBOOK_DEFAULT_URL_STATE };
}

export function parseBridgeScheduleLogbookUrlState(search: string | null | undefined): BridgeScheduleLogbookUrlState {
  const params = new URLSearchParams(search ?? "");
  const rawStatus = params.get("bridgeLogStatus");
  const rawPresetKey = params.get("bridgeLogPreset");
  const rawTimeWindow = params.get("bridgeLogWindow");
  const rawSearchTerm = params.get("bridgeLogQuery");

  return {
    status: isBridgeScheduleLogbookStatus(rawStatus) ? rawStatus : BRIDGE_SCHEDULE_LOGBOOK_DEFAULT_URL_STATE.status,
    presetKey: rawPresetKey?.trim() || BRIDGE_SCHEDULE_LOGBOOK_DEFAULT_URL_STATE.presetKey,
    timeWindow: isBridgeScheduleLogbookTimeWindow(rawTimeWindow) ? rawTimeWindow : BRIDGE_SCHEDULE_LOGBOOK_DEFAULT_URL_STATE.timeWindow,
    searchTerm: rawSearchTerm?.trim() ?? BRIDGE_SCHEDULE_LOGBOOK_DEFAULT_URL_STATE.searchTerm,
  };
}

export function mergeBridgeScheduleLogbookUrlState(
  currentSearch: string | null | undefined,
  state: Partial<BridgeScheduleLogbookUrlState>,
) {
  const baseState = {
    ...BRIDGE_SCHEDULE_LOGBOOK_DEFAULT_URL_STATE,
    ...parseBridgeScheduleLogbookUrlState(currentSearch),
    ...state,
  } satisfies BridgeScheduleLogbookUrlState;
  const params = new URLSearchParams(currentSearch ?? "");

  if (baseState.status === "all") {
    params.delete("bridgeLogStatus");
  } else {
    params.set("bridgeLogStatus", baseState.status);
  }

  if (baseState.presetKey === "all") {
    params.delete("bridgeLogPreset");
  } else {
    params.set("bridgeLogPreset", baseState.presetKey);
  }

  if (baseState.timeWindow === "all") {
    params.delete("bridgeLogWindow");
  } else {
    params.set("bridgeLogWindow", baseState.timeWindow);
  }

  if (baseState.searchTerm.trim().length === 0) {
    params.delete("bridgeLogQuery");
  } else {
    params.set("bridgeLogQuery", baseState.searchTerm.trim());
  }

  const serialized = params.toString();
  return serialized.length > 0 ? `?${serialized}` : "";
}

export function filterBridgeScheduleLogbookRows(
  rows: BridgeScheduleLogbookRow[],
  options: BridgeScheduleLogbookFilters = {},
  nowMs = Date.now(),
) {
  const normalized = {
    status: options.status ?? "all",
    presetKey: options.presetKey ?? "all",
    timeWindow: options.timeWindow ?? "all",
    searchTerm: normalizeSearchTerm(options.searchTerm),
    nowMs: options.nowMs ?? nowMs,
  } satisfies Required<BridgeScheduleLogbookFilters>;

  return rows.filter((row) => {
    if (normalized.status !== "all" && row.status !== normalized.status) {
      return false;
    }

    if (normalized.presetKey !== "all" && buildPresetKey(row) !== normalized.presetKey) {
      return false;
    }

    if (normalized.timeWindow !== "all") {
      const executedAtMs = new Date(row.executedAt).getTime();
      if (Number.isNaN(executedAtMs)) {
        return false;
      }

      if (normalized.nowMs - executedAtMs > BRIDGE_SCHEDULE_LOGBOOK_TIME_WINDOW_MS[normalized.timeWindow]) {
        return false;
      }
    }

    if (normalized.searchTerm.length > 0 && !buildBridgeScheduleLogbookSearchIndex(row).includes(normalized.searchTerm)) {
      return false;
    }

    return true;
  });
}

export function buildBridgeScheduleLogbookPresetOptions(rows: BridgeScheduleLogbookRow[]) {
  const presetMap = new Map<string, BridgeScheduleLogbookPresetOption>();

  for (const row of rows) {
    const key = buildPresetKey(row);
    const existing = presetMap.get(key);
    if (existing) {
      existing.count += 1;
      continue;
    }

    presetMap.set(key, {
      value: key,
      label: row.presetName,
      count: 1,
    });
  }

  return Array.from(presetMap.values()).sort((left, right) => {
    if (right.count !== left.count) return right.count - left.count;
    return left.label.localeCompare(right.label, "es");
  });
}

export function buildBridgeScheduleLogbookCsv(rows: BridgeScheduleLogbookRow[]) {
  const header = [
    "Ejecutada",
    "Estado",
    "Preset",
    "Agenda",
    "Trace ID",
    "Tenant",
    "Proxima corrida",
    "Registros visibles",
    "Destinatarios",
    "Exportacion",
    "Error",
    "Filtros aplicados",
    "Adjuntos",
  ];

  const lines = rows.map((row) => [
    row.executedAt,
    row.status,
    row.presetName,
    row.scheduleId,
    row.traceId,
    row.tenantId,
    row.nextRunAt,
    row.visibleCount,
    row.recipientCount,
    row.exportFormat,
    row.errorMessage,
    row.appliedFilters.join(" | "),
    row.attachments.join(" | "),
  ]);

  return [header, ...lines].map((line) => line.map((cell) => escapeCsvCell(cell)).join(",")).join("\n");
}

export function getBridgeScheduleLogbookStatusLabel(status: BridgeScheduleLogbookFilter) {
  switch (status) {
    case "success":
      return "Envíos exitosos";
    case "failed":
      return "Fallos registrados";
    default:
      return "Todos los estados";
  }
}

export function getBridgeScheduleLogbookTimeWindowLabel(timeWindow: BridgeScheduleLogbookTimeWindow) {
  switch (timeWindow) {
    case "24h":
      return "24 h";
    case "7d":
      return "7 días";
    case "30d":
      return "30 días";
    default:
      return "Todo el histórico";
  }
}

export function buildBridgeScheduleLogbook(params: {
  auditTrail: AuditFeedItem[];
  schedules: BridgeScheduleListItem[];
}): BridgeScheduleLogbookPanel {
  const scheduleMap = new Map(params.schedules.map((schedule) => [schedule.id, schedule]));
  const relevantItems = params.auditTrail.filter(
    (item) => item.action === "dashboard.ceo.bridge_schedule_executed" || item.action === "dashboard.ceo.bridge_schedule_failed",
  );

  const rows = relevantItems
    .flatMap((item) => {
      const state = parseObject(item.afterState);
      const scheduleId = readScheduleId(item, state);
      if (!scheduleId) return [];

      const knownSchedule = scheduleMap.get(scheduleId);
      const status: BridgeScheduleLogbookStatus = item.action === "dashboard.ceo.bridge_schedule_failed" ? "failed" : "success";
      const executedAt = readExecutedAt(item, state);
      const presetName = readString(state?.presetName) ?? knownSchedule?.presetName ?? `Preset ${knownSchedule?.presetId ?? scheduleId}`;

      const row: BridgeScheduleLogbookRow = {
        key: `${item.id}:${scheduleId}`,
        scheduleId,
        presetId: readNumber(state?.presetId) ?? knownSchedule?.presetId ?? null,
        presetName,
        tenantId: knownSchedule?.tenantId ?? item.tenantId ?? null,
        status,
        executedAt,
        nextRunAt: readString(state?.nextRunAt) ?? knownSchedule?.nextRunAt ?? null,
        traceId: item.traceId ?? null,
        errorMessage: readString(state?.error) ?? readString(state?.lastRunError) ?? knownSchedule?.lastRunError ?? null,
        visibleCount: readNumber(state?.visibleCount),
        recipientCount: readNumber(state?.recipientCount),
        exportFormat: readString(state?.exportFormat),
        attachments: readStringArray(state?.attachments),
        appliedFilters: readStringArray(state?.appliedFilters),
      };

      return [row];
    })
    .sort((left, right) => new Date(right.executedAt).getTime() - new Date(left.executedAt).getTime());

  const schedulesWithHistory = new Set(rows.map((row) => row.scheduleId)).size;
  const activeSchedules = params.schedules.filter((schedule) => schedule.isActive).length;
  const pausedSchedules = params.schedules.length - activeSchedules;

  return {
    summary: {
      totalRuns: rows.length,
      successfulRuns: rows.filter((row) => row.status === "success").length,
      failedRuns: rows.filter((row) => row.status === "failed").length,
      schedulesWithHistory,
      schedulesWithoutHistory: Math.max(0, params.schedules.length - schedulesWithHistory),
      activeSchedules,
      pausedSchedules,
    },
    rows,
  };
}

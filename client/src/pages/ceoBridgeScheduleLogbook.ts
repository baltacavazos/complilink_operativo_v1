import type { AuditFeedItem } from "@/pages/ceoDashboardMonitoring";

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
  return typeof value === "string" && value.trim().length > 0 ? value : null;
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

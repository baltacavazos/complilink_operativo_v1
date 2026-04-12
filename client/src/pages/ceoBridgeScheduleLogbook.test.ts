import { describe, expect, it } from "vitest";
import {
  buildBridgeScheduleLogbook,
  buildBridgeScheduleLogbookPresetOptions,
  filterBridgeScheduleLogbookRows,
  type BridgeScheduleListItem,
} from "./ceoBridgeScheduleLogbook";
import type { AuditFeedItem } from "./ceoDashboardMonitoring";

function createAuditItem(overrides: Partial<AuditFeedItem>): AuditFeedItem {
  return {
    id: overrides.id ?? 1,
    tenantId: overrides.tenantId ?? "tenant-1",
    caseId: overrides.caseId ?? null,
    traceId: overrides.traceId ?? "trace-1",
    entityType: overrides.entityType ?? "system",
    entityId: overrides.entityId ?? "bridge-schedule:10",
    action: overrides.action ?? "dashboard.ceo.bridge_schedule_executed",
    severity: overrides.severity ?? "info",
    actorName: overrides.actorName ?? "Scheduler",
    summary: overrides.summary ?? "Bridge run",
    beforeState: overrides.beforeState ?? null,
    afterState: overrides.afterState ?? null,
    createdAt: overrides.createdAt ?? "2026-04-12T12:00:00.000Z",
  };
}

describe("buildBridgeScheduleLogbook", () => {
  it("resume corridas exitosas y fallidas con métricas visibles para el dashboard", () => {
    const schedules: BridgeScheduleListItem[] = [
      {
        id: 10,
        presetId: 99,
        tenantId: "tenant-1",
        presetName: "Bridge semanal",
        cronExpression: "0 0 8 * * 1",
        timezone: "America/Mexico_City",
        nextRunAt: "2026-04-15T13:00:00.000Z",
        lastRunAt: "2026-04-12T12:00:00.000Z",
        lastRunStatus: "sent",
        lastRunError: null,
        isActive: true,
      },
      {
        id: 20,
        presetId: 100,
        tenantId: "tenant-1",
        presetName: "Bridge diario",
        cronExpression: "0 30 9 * * *",
        timezone: "America/Mexico_City",
        nextRunAt: "2026-04-13T14:30:00.000Z",
        lastRunAt: null,
        lastRunStatus: null,
        lastRunError: null,
        isActive: false,
      },
    ];

    const auditTrail: AuditFeedItem[] = [
      createAuditItem({
        id: 2,
        action: "dashboard.ceo.bridge_schedule_failed",
        severity: "error",
        createdAt: "2026-04-12T15:00:00.000Z",
        afterState: {
          scheduleId: 10,
          presetId: 99,
          presetName: "Bridge semanal",
          lastRunAt: "2026-04-12T15:00:00.000Z",
          nextRunAt: "2026-04-19T13:00:00.000Z",
          lastRunError: "SMTP timeout",
        },
      }),
      createAuditItem({
        id: 1,
        action: "dashboard.ceo.bridge_schedule_executed",
        createdAt: "2026-04-12T12:00:00.000Z",
        afterState: {
          scheduleId: 10,
          presetId: 99,
          presetName: "Bridge semanal",
          lastRunAt: "2026-04-12T12:00:00.000Z",
          nextRunAt: "2026-04-15T13:00:00.000Z",
          visibleCount: 3,
          recipientCount: 2,
          exportFormat: "pdf",
          attachments: ["bridge.pdf"],
          appliedFilters: ["smoke>=60", "criticos"],
        },
      }),
      createAuditItem({
        id: 3,
        action: "dashboard.ceo.guardrail_updated",
        entityId: "guardrail:1",
      }),
    ];

    const result = buildBridgeScheduleLogbook({ auditTrail, schedules });

    expect(result.summary).toEqual({
      totalRuns: 2,
      successfulRuns: 1,
      failedRuns: 1,
      schedulesWithHistory: 1,
      schedulesWithoutHistory: 1,
      activeSchedules: 1,
      pausedSchedules: 1,
    });

    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toMatchObject({
      scheduleId: 10,
      status: "failed",
      presetName: "Bridge semanal",
      errorMessage: "SMTP timeout",
    });
    expect(result.rows[1]).toMatchObject({
      scheduleId: 10,
      status: "success",
      visibleCount: 3,
      recipientCount: 2,
      exportFormat: "pdf",
      attachments: ["bridge.pdf"],
      appliedFilters: ["smoke>=60", "criticos"],
    });
  });

  it("tolera eventos con estado serializado y cae al schedule conocido cuando faltan campos", () => {
    const schedules: BridgeScheduleListItem[] = [
      {
        id: 31,
        presetId: 501,
        tenantId: null,
        presetName: "Bridge mensual",
        cronExpression: "0 0 9 1 * *",
        timezone: "UTC",
        nextRunAt: "2026-05-01T09:00:00.000Z",
        lastRunAt: null,
        lastRunStatus: null,
        lastRunError: null,
        isActive: true,
      },
    ];

    const auditTrail: AuditFeedItem[] = [
      createAuditItem({
        id: 4,
        traceId: null,
        tenantId: null,
        entityId: "bridge-schedule:31",
        action: "dashboard.ceo.bridge_schedule_executed",
        createdAt: "2026-04-01T09:00:00.000Z",
        afterState: JSON.stringify({
          scheduleId: 31,
          lastRunAt: "2026-04-01T09:00:00.000Z",
        }),
      }),
    ];

    const result = buildBridgeScheduleLogbook({ auditTrail, schedules });

    expect(result.summary.totalRuns).toBe(1);
    expect(result.rows[0]).toMatchObject({
      scheduleId: 31,
      presetId: 501,
      presetName: "Bridge mensual",
      nextRunAt: "2026-05-01T09:00:00.000Z",
      traceId: "trace-1",
      tenantId: "tenant-1",
      errorMessage: null,
    });
  });
});

describe("filterBridgeScheduleLogbookRows", () => {
  const rows = [
    {
      key: "a",
      scheduleId: 10,
      presetId: 99,
      presetName: "Bridge semanal",
      tenantId: "tenant-1",
      status: "success" as const,
      executedAt: "2026-04-12T12:00:00.000Z",
      nextRunAt: null,
      traceId: "trace-a",
      errorMessage: null,
      visibleCount: 4,
      recipientCount: 2,
      exportFormat: "pdf",
      attachments: [],
      appliedFilters: [],
    },
    {
      key: "b",
      scheduleId: 20,
      presetId: 100,
      presetName: "Bridge diario",
      tenantId: "tenant-1",
      status: "failed" as const,
      executedAt: "2026-04-10T12:00:00.000Z",
      nextRunAt: null,
      traceId: "trace-b",
      errorMessage: "SMTP timeout",
      visibleCount: null,
      recipientCount: null,
      exportFormat: null,
      attachments: [],
      appliedFilters: [],
    },
    {
      key: "c",
      scheduleId: 30,
      presetId: 99,
      presetName: "Bridge semanal",
      tenantId: "tenant-2",
      status: "failed" as const,
      executedAt: "2026-03-01T12:00:00.000Z",
      nextRunAt: null,
      traceId: "trace-c",
      errorMessage: "Webhook error",
      visibleCount: null,
      recipientCount: null,
      exportFormat: null,
      attachments: [],
      appliedFilters: [],
    },
  ];

  it("aplica filtros combinados por estado, preset y ventana temporal usando AND", () => {
    const filtered = filterBridgeScheduleLogbookRows(rows, {
      status: "failed",
      presetKey: "preset:100",
      timeWindow: "7d",
      nowMs: new Date("2026-04-12T13:00:00.000Z").getTime(),
    });

    expect(filtered).toEqual([rows[1]]);
  });

  it("expone presets únicos con conteos para construir chips o botones simples", () => {
    expect(buildBridgeScheduleLogbookPresetOptions(rows)).toEqual([
      { value: "preset:99", label: "Bridge semanal", count: 2 },
      { value: "preset:100", label: "Bridge diario", count: 1 },
    ]);
  });
});

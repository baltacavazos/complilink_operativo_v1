import { describe, expect, it } from "vitest";

import {
  buildBridgeSmokeHistorySummary,
  filterBridgeSmokeHistory,
  getBridgeSmokeAlertSeverityTone,
  getBridgeSmokeAlertTimestampLabel,
  getBridgeSmokeAlertVisualStateLabel,
  getBridgeSmokeHistoryContext,
  getBridgeSmokeHistoryFilterLabel,
  getBridgeSmokeHistorySeverity,
  getBridgeSmokeHistorySeverityLabel,
  getBridgeSmokeHistoryStatusLabel,
  getBridgeSmokeHistoryStatusTone,
  getBridgeSmokeHistoryTimeWindowLabel,
  type BridgeSmokeHistoryEntry,
} from "./ceoBridgeSmokeHistory";

function buildEntry(overrides: Partial<BridgeSmokeHistoryEntry> = {}): BridgeSmokeHistoryEntry {
  return {
    testedAt: overrides.testedAt ?? "2026-04-11T12:00:00.000Z",
    testedAtMs: overrides.testedAtMs ?? new Date("2026-04-11T12:00:00.000Z").getTime(),
    baseUrl: overrides.baseUrl ?? "https://bridge.auditapatron.com",
    runMode: overrides.runMode ?? "scheduled",
    passed: overrides.passed ?? true,
    status: overrides.status ?? "passed",
    healthStatus: overrides.healthStatus ?? 200,
    webhookStatus: overrides.webhookStatus ?? 202,
    verified: overrides.verified ?? true,
    error: overrides.error ?? null,
  };
}

describe("ceoBridgeSmokeHistory", () => {
  it("resume la serie reciente y calcula la tasa de éxito con racha de fallos", () => {
    const entries = [
      buildEntry({
        status: "error",
        passed: false,
        verified: null,
        error: "timeout",
        healthStatus: null,
        webhookStatus: null,
      }),
      buildEntry({
        testedAt: "2026-04-11T11:45:00.000Z",
        testedAtMs: new Date("2026-04-11T11:45:00.000Z").getTime(),
        status: "failed",
        passed: false,
        verified: false,
        healthStatus: 500,
        webhookStatus: 500,
      }),
      buildEntry({
        testedAt: "2026-04-11T11:30:00.000Z",
        testedAtMs: new Date("2026-04-11T11:30:00.000Z").getTime(),
        status: "passed",
        passed: true,
        verified: true,
        healthStatus: 200,
        webhookStatus: 202,
      }),
    ];

    expect(buildBridgeSmokeHistorySummary(entries)).toEqual({
      totalRuns: 3,
      passedRuns: 1,
      failedRuns: 1,
      errorRuns: 1,
      successRate: 33,
      consecutiveFailures: 2,
      latestStatus: "error",
    });
  });

  it("mantiene compatibilidad con el filtro por estado y expone etiquetas legibles para la vista CEO", () => {
    const entries = [
      buildEntry({ status: "passed", passed: true }),
      buildEntry({ status: "failed", passed: false, healthStatus: 500, webhookStatus: 500, verified: false }),
      buildEntry({
        status: "error",
        passed: false,
        healthStatus: null,
        webhookStatus: null,
        verified: null,
        error: "fetch failed",
      }),
    ];

    expect(filterBridgeSmokeHistory(entries, "all")).toHaveLength(3);
    expect(filterBridgeSmokeHistory(entries, "failed")).toHaveLength(1);
    expect(getBridgeSmokeHistoryFilterLabel("error")).toBe("Errores");
    expect(getBridgeSmokeHistoryStatusLabel("passed")).toBe("Conforme");
    expect(getBridgeSmokeHistoryStatusTone("failed")).toContain("amber");
    expect(getBridgeSmokeHistoryContext(entries[2])).toBe("fetch failed");
  });

  it("filtra por ventana temporal y severidad sin romper el filtro de estado", () => {
    const nowMs = new Date("2026-04-12T12:00:00.000Z").getTime();
    const entries = [
      buildEntry({
        testedAt: "2026-04-12T11:00:00.000Z",
        testedAtMs: new Date("2026-04-12T11:00:00.000Z").getTime(),
        status: "error",
        passed: false,
        error: "timeout",
        healthStatus: null,
        webhookStatus: null,
        verified: null,
      }),
      buildEntry({
        testedAt: "2026-04-11T18:00:00.000Z",
        testedAtMs: new Date("2026-04-11T18:00:00.000Z").getTime(),
        status: "failed",
        passed: false,
        healthStatus: 500,
        webhookStatus: 500,
        verified: false,
      }),
      buildEntry({
        testedAt: "2026-04-09T11:00:00.000Z",
        testedAtMs: new Date("2026-04-09T11:00:00.000Z").getTime(),
        status: "passed",
        passed: true,
      }),
    ];

    expect(
      filterBridgeSmokeHistory(entries, {
        status: "all",
        timeWindow: "24h",
        severity: "critical",
        nowMs,
      }),
    ).toEqual([entries[0]]);

    expect(
      filterBridgeSmokeHistory(entries, {
        status: "failed",
        timeWindow: "72h",
        severity: "warning",
        nowMs,
      }),
    ).toEqual([entries[1]]);

    expect(getBridgeSmokeHistorySeverity(entries[0])).toBe("critical");
    expect(getBridgeSmokeHistorySeverity(entries[1])).toBe("warning");
    expect(getBridgeSmokeHistorySeverity(entries[2])).toBe("success");
    expect(getBridgeSmokeHistoryTimeWindowLabel("7d")).toBe("7 días");
    expect(getBridgeSmokeHistorySeverityLabel("critical")).toBe("Técnicos");
  });

  it("devuelve tonos y etiquetas consistentes para el estado operativo del bridge", () => {
    expect(getBridgeSmokeAlertSeverityTone("critical")).toEqual({
      badge: expect.stringContaining("rose"),
      card: expect.stringContaining("rose"),
    });
    expect(getBridgeSmokeAlertSeverityTone("success")).toEqual({
      badge: expect.stringContaining("emerald"),
      card: expect.stringContaining("emerald"),
    });
    expect(getBridgeSmokeAlertVisualStateLabel("active_alert")).toBe("Alerta activa");
    expect(getBridgeSmokeAlertVisualStateLabel("recovered")).toBe("Recuperado");
  });

  it("prioriza recovery, luego activación y por último observación al construir la marca temporal", () => {
    expect(
      getBridgeSmokeAlertTimestampLabel({
        recoveredAt: "12 abr 2026, 10:00",
        activatedAt: "12 abr 2026, 08:00",
        testedAt: "12 abr 2026, 09:30",
      }),
    ).toBe("Recuperado 12 abr 2026, 10:00");
    expect(
      getBridgeSmokeAlertTimestampLabel({
        activatedAt: "12 abr 2026, 08:00",
        testedAt: "12 abr 2026, 09:30",
      }),
    ).toBe("Alerta desde 12 abr 2026, 08:00");
    expect(getBridgeSmokeAlertTimestampLabel({ testedAt: "12 abr 2026, 09:30" })).toBe(
      "Observado 12 abr 2026, 09:30",
    );
  });
});

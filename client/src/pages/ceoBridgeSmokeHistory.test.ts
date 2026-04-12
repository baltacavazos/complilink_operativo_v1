import { describe, expect, it } from "vitest";

import {
  buildBridgeSmokeHistorySummary,
  filterBridgeSmokeHistory,
  getBridgeSmokeHistoryContext,
  getBridgeSmokeHistoryFilterLabel,
  getBridgeSmokeHistoryStatusLabel,
  getBridgeSmokeHistoryStatusTone,
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
      buildEntry({ status: "error", passed: false, verified: null, error: "timeout", healthStatus: null, webhookStatus: null }),
      buildEntry({ testedAt: "2026-04-11T11:45:00.000Z", testedAtMs: new Date("2026-04-11T11:45:00.000Z").getTime(), status: "failed", passed: false, verified: false, healthStatus: 500, webhookStatus: 500 }),
      buildEntry({ testedAt: "2026-04-11T11:30:00.000Z", testedAtMs: new Date("2026-04-11T11:30:00.000Z").getTime(), status: "passed", passed: true, verified: true, healthStatus: 200, webhookStatus: 202 }),
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

  it("filtra por estado y expone etiquetas legibles para la vista CEO", () => {
    const entries = [
      buildEntry({ status: "passed", passed: true }),
      buildEntry({ status: "failed", passed: false, healthStatus: 500, webhookStatus: 500, verified: false }),
      buildEntry({ status: "error", passed: false, healthStatus: null, webhookStatus: null, verified: null, error: "fetch failed" }),
    ];

    expect(filterBridgeSmokeHistory(entries, "all")).toHaveLength(3);
    expect(filterBridgeSmokeHistory(entries, "failed")).toHaveLength(1);
    expect(getBridgeSmokeHistoryFilterLabel("error")).toBe("Errores");
    expect(getBridgeSmokeHistoryStatusLabel("passed")).toBe("Conforme");
    expect(getBridgeSmokeHistoryStatusTone("failed")).toContain("amber");
    expect(getBridgeSmokeHistoryContext(entries[2])).toBe("fetch failed");
  });
});

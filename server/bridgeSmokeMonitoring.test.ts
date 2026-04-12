import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { readBridgeSmokeMonitoringSnapshot, updateBridgeSmokeAlertThreshold } from "./bridgeSmokeMonitoring";

const tempDirs: string[] = [];

function createTempDir() {
  const dir = mkdtempSync(join(tmpdir(), "bridge-smoke-monitoring-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  delete process.env.BRIDGE_SMOKE_ALERT_THRESHOLD;

  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("readBridgeSmokeMonitoringSnapshot", () => {
  it("resume el historial reciente, calcula tasa de éxito y racha de fallos consecutivos", () => {
    const dir = createTempDir();
    const resultsPath = join(dir, "bridge_smoke_test_results.json");
    const historyPath = join(dir, "bridge_smoke_test_history.jsonl");

    writeFileSync(
      resultsPath,
      JSON.stringify({
        testedAt: "2026-04-11T12:00:00.000Z",
        baseUrl: "https://bridge.auditapatron.com",
        health: { status: 200, body: { status: "ok", responseContract: "auditapatron.bridge.ack.v1" } },
        webhook: {
          status: 202,
          body: {
            verified: true,
            responseContract: "auditapatron.bridge.ack.v1",
            processingStatus: "accepted",
            event: "document.uploaded",
            receivedAt: "2026-04-11T12:00:01.000Z",
          },
        },
        contractCheck: {
          passed: true,
          expectedHealthStatus: 200,
          expectedWebhookStatus: 202,
          expectedContract: "auditapatron.bridge.ack.v1",
        },
      }),
      "utf8",
    );

    writeFileSync(
      historyPath,
      [
        JSON.stringify({
          testedAt: "2026-04-11T12:00:00.000Z",
          runMode: "scheduled",
          baseUrl: "https://bridge.auditapatron.com",
          health: { status: 200 },
          webhook: { status: 202, body: { verified: true } },
          contractCheck: { passed: true },
        }),
        JSON.stringify({
          testedAt: "2026-04-11T11:30:00.000Z",
          runMode: "scheduled",
          baseUrl: "https://bridge.auditapatron.com",
          health: { status: 500 },
          webhook: { status: 500, body: { verified: false } },
          contractCheck: { passed: false },
        }),
        JSON.stringify({
          testedAt: "2026-04-11T11:00:00.000Z",
          runMode: "manual",
          baseUrl: "https://bridge.auditapatron.com",
          error: "fetch failed",
          health: { status: null },
          webhook: { status: null, body: { verified: null } },
          contractCheck: { passed: false },
        }),
      ].join("\n"),
      "utf8",
    );

    const snapshot = readBridgeSmokeMonitoringSnapshot({
      resultsPath,
      historyPath,
      nowMs: new Date("2026-04-11T12:05:00.000Z").getTime(),
    });

    expect(snapshot.availability).toBe("ready");
    expect(snapshot.ageMinutes).toBe(5);
    expect(snapshot.health).toMatchObject({
      status: 200,
      statusText: "ok",
      responseContract: "auditapatron.bridge.ack.v1",
      ok: true,
    });
    expect(snapshot.webhook).toMatchObject({
      status: 202,
      verified: true,
      processingStatus: "accepted",
      event: "document.uploaded",
      ok: true,
    });
    expect(snapshot.history.map((entry) => entry.status)).toEqual(["passed", "failed", "error"]);
    expect(snapshot.summary).toEqual({
      totalRuns: 3,
      passedRuns: 1,
      failedRuns: 1,
      errorRuns: 1,
      consecutiveFailures: 0,
      successRate: 33,
      last24Hours: 3,
    });
  });

  it("tolera historial corrupto y mantiene fallback cuando falta el último resultado persistido", () => {
    const dir = createTempDir();
    const historyPath = join(dir, "bridge_smoke_test_history.jsonl");

    writeFileSync(
      historyPath,
      [
        "not-json",
        JSON.stringify({
          testedAt: "2026-04-11T12:00:00.000Z",
          runMode: "scheduled",
          baseUrl: "https://bridge.auditapatron.com",
          error: "timeout",
          health: { status: null },
          webhook: { status: null, body: { verified: null } },
          contractCheck: { passed: false },
        }),
      ].join("\n"),
      "utf8",
    );

    const snapshot = readBridgeSmokeMonitoringSnapshot({
      resultsPath: join(dir, "missing_results.json"),
      historyPath,
      nowMs: new Date("2026-04-11T12:10:00.000Z").getTime(),
    });

    expect(snapshot.availability).toBe("missing");
    expect(snapshot.history).toHaveLength(1);
    expect(snapshot.history[0]).toMatchObject({
      status: "error",
      error: "timeout",
      runMode: "scheduled",
    });
    expect(snapshot.summary).toEqual({
      totalRuns: 1,
      passedRuns: 0,
      failedRuns: 0,
      errorRuns: 1,
      consecutiveFailures: 1,
      successRate: 0,
      last24Hours: 1,
    });
  });

  it("expone recovery notificado sólo cuando ya no hay racha activa y conserva watch si reaparecen fallas", () => {
    const dir = createTempDir();
    const resultsPath = join(dir, "bridge_smoke_test_results.json");
    const historyPath = join(dir, "bridge_smoke_test_history.jsonl");
    const alertStatePath = join(dir, "bridge_smoke_test_alert_state.json");

    writeFileSync(
      resultsPath,
      JSON.stringify({
        testedAt: "2026-04-11T12:00:00.000Z",
        baseUrl: "https://bridge.auditapatron.com",
        health: { status: 200, body: { status: "ok", responseContract: "auditapatron.bridge.ack.v1" } },
        webhook: { status: 202, body: { verified: true, responseContract: "auditapatron.bridge.ack.v1" } },
        contractCheck: {
          passed: true,
          expectedHealthStatus: 200,
          expectedWebhookStatus: 202,
          expectedContract: "auditapatron.bridge.ack.v1",
        },
      }),
      "utf8",
    );

    writeFileSync(
      historyPath,
      [
        JSON.stringify({
          testedAt: "2026-04-11T12:00:00.000Z",
          runMode: "scheduled",
          baseUrl: "https://bridge.auditapatron.com",
          health: { status: 200 },
          webhook: { status: 202, body: { verified: true } },
          contractCheck: { passed: true },
        }),
        JSON.stringify({
          testedAt: "2026-04-11T11:45:00.000Z",
          runMode: "scheduled",
          baseUrl: "https://bridge.auditapatron.com",
          health: { status: 500 },
          webhook: { status: 500, body: { verified: false } },
          contractCheck: { passed: false },
        }),
      ].join("\n"),
      "utf8",
    );

    writeFileSync(
      alertStatePath,
      JSON.stringify({
        threshold: 4,
        alertActive: false,
        recoveredAt: "2026-04-11T12:00:30.000Z",
        lastRecoveryAlertAt: "2026-04-11T12:00:30.000Z",
        lastNotifiedStatus: "recovery",
        lastObservedStatus: "passed",
        lastObservedConsecutiveFailures: 0,
      }),
      "utf8",
    );

    const recoveredSnapshot = readBridgeSmokeMonitoringSnapshot({
      resultsPath,
      historyPath,
      alertStatePath,
      nowMs: new Date("2026-04-11T12:05:00.000Z").getTime(),
    });

    expect(recoveredSnapshot.alerting).toMatchObject({
      threshold: 4,
      visualState: "recovered",
      severity: "success",
      statusLabel: "Recuperación notificada",
      lastObservedConsecutiveFailures: 0,
    });

    writeFileSync(
      alertStatePath,
      JSON.stringify({
        threshold: 4,
        alertActive: false,
        recoveredAt: "2026-04-11T12:00:30.000Z",
        lastRecoveryAlertAt: "2026-04-11T12:00:30.000Z",
        lastNotifiedStatus: "recovery",
        lastObservedStatus: "failed",
        lastObservedConsecutiveFailures: 1,
      }),
      "utf8",
    );

    const watchSnapshot = readBridgeSmokeMonitoringSnapshot({
      resultsPath,
      historyPath,
      alertStatePath,
      nowMs: new Date("2026-04-11T12:06:00.000Z").getTime(),
    });

    expect(watchSnapshot.alerting).toMatchObject({
      threshold: 4,
      visualState: "watch",
      severity: "warning",
      statusLabel: "En observación",
      lastObservedConsecutiveFailures: 1,
      lastObservedStatus: "failed",
    });
  });

  it("usa el umbral configurable por entorno cuando no existe estado persistido", () => {
    const dir = createTempDir();
    process.env.BRIDGE_SMOKE_ALERT_THRESHOLD = "5";

    const snapshot = readBridgeSmokeMonitoringSnapshot({
      resultsPath: join(dir, "missing_results.json"),
      historyPath: join(dir, "missing_history.jsonl"),
      alertStatePath: join(dir, "missing_alert_state.json"),
      nowMs: new Date("2026-04-11T12:10:00.000Z").getTime(),
    });

    expect(snapshot.alerting).toMatchObject({
      threshold: 5,
      visualState: "stable",
      severity: "neutral",
      statusLabel: "Sin alertas activas",
    });
  });

  it("persiste un umbral editable con trazabilidad y lo refleja en el snapshot", () => {
    const dir = createTempDir();
    const alertStatePath = join(dir, "bridge_smoke_test_alert_state.json");
    process.env.BRIDGE_SMOKE_ALERT_THRESHOLD = "4";

    const update = updateBridgeSmokeAlertThreshold({
      alertStatePath,
      threshold: 6,
      actor: {
        userId: 7,
        userName: "CompliLink Owner",
        userEmail: "owner@complilink.mx",
      },
      updatedAt: "2026-04-11T12:30:00.000Z",
    });

    expect(update).toMatchObject({
      previousThreshold: 4,
      threshold: 6,
      changed: true,
      thresholdAudit: {
        userId: 7,
        userName: "CompliLink Owner",
        userEmail: "owner@complilink.mx",
        updatedAt: "2026-04-11T12:30:00.000Z",
      },
    });

    const snapshot = readBridgeSmokeMonitoringSnapshot({
      resultsPath: join(dir, "missing_results.json"),
      historyPath: join(dir, "missing_history.jsonl"),
      alertStatePath,
      nowMs: new Date("2026-04-11T12:31:00.000Z").getTime(),
    });

    expect(snapshot.alerting).toMatchObject({
      threshold: 6,
      thresholdAudit: {
        userId: 7,
        userName: "CompliLink Owner",
        userEmail: "owner@complilink.mx",
        updatedAt: "2026-04-11T12:30:00.000Z",
      },
      visualState: "stable",
    });
  });
});

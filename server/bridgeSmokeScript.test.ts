import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { readFileSync, rmSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const projectRoot = "/home/ubuntu/complilink_operativo_v1";
const resultPath = `${projectRoot}/bridge_smoke_test_results.json`;
const historyPath = `${projectRoot}/bridge_smoke_test_history.jsonl`;
const alertStatePath = `${projectRoot}/bridge_smoke_test_alert_state.json`;
const scriptPath = `${projectRoot}/bridge_smoke_test.mjs`;
const serversToClose: Array<ReturnType<typeof createServer>> = [];

function cleanupSmokeOutputs() {
  rmSync(resultPath, { force: true });
  rmSync(historyPath, { force: true });
  rmSync(alertStatePath, { force: true });
}

async function runSmoke(baseUrl: string, runMode = "test", extraEnv: Record<string, string> = {}) {
  await execFileAsync("node", [scriptPath, baseUrl, runMode], {
    cwd: projectRoot,
    env: {
      ...process.env,
      AUDITAPATRON_ENGINE_HMAC_SECRET: "return-webhook-secret-123456",
      ...extraEnv,
    },
  });

  return JSON.parse(readFileSync(resultPath, "utf8")) as Record<string, any>;
}

function buildHealthyBridgeServer() {
  const server = createServer((req, res) => {
    if (req.url === "/api/auditapatron/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", responseContract: "auditapatron.bridge.ack.v1" }));
      return;
    }

    if (req.url === "/api/auditapatron/webhook" && req.method === "POST") {
      res.writeHead(202, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          responseContract: "auditapatron.bridge.ack.v1",
          verified: true,
          event: "document.uploaded",
        }),
      );
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "not found" }));
  });

  serversToClose.push(server);
  return server;
}

async function listen(server: ReturnType<typeof createServer>) {
  await new Promise<void>((resolve) => server.listen(0, () => resolve()));
  const address = server.address() as AddressInfo;
  return `http://127.0.0.1:${address.port}`;
}

function buildNotificationServer(notifications: Array<{ title: string; content: string }>) {
  const server = createServer(async (req, res) => {
    if (req.url === "/webdevtoken.v1.WebDevService/SendNotification" && req.method === "POST") {
      const chunks: Uint8Array[] = [];
      for await (const chunk of req) {
        chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
      }
      const payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      notifications.push(payload);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ delivered: true }));
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "not found" }));
  });

  serversToClose.push(server);
  return server;
}

describe("bridge_smoke_test.mjs", () => {
  afterEach(async () => {
    cleanupSmokeOutputs();
    await Promise.all(
      serversToClose.splice(0).map(
        (server) =>
          new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
          }),
      ),
    );
  });

  it("persiste un resultado contractual exitoso con health 200 y webhook 202", async () => {
    const server = buildHealthyBridgeServer();
    const baseUrl = await listen(server);

    const result = await runSmoke(baseUrl, "scheduled-test");

    expect(result).toMatchObject({
      baseUrl,
      runMode: "scheduled-test",
      error: null,
      health: {
        status: 200,
        body: {
          responseContract: "auditapatron.bridge.ack.v1",
        },
      },
      webhook: {
        status: 202,
        body: {
          responseContract: "auditapatron.bridge.ack.v1",
          verified: true,
          event: "document.uploaded",
        },
      },
      contractCheck: {
        expectedHealthStatus: 200,
        expectedWebhookStatus: 202,
        expectedContract: "auditapatron.bridge.ack.v1",
        passed: true,
      },
      alerting: {
        action: "none",
        delivered: false,
        alertActive: false,
      },
    });

    const historyLines = readFileSync(historyPath, "utf8").trim().split("\n");
    expect(historyLines).toHaveLength(1);
  });

  it("persiste un fallo operativo cuando el endpoint no está disponible", async () => {
    const unreachableUrl = "http://127.0.0.1:9";

    const result = await runSmoke(unreachableUrl, "scheduled-test");

    expect(result.baseUrl).toBe(unreachableUrl);
    expect(result.runMode).toBe("scheduled-test");
    expect(result.contractCheck.passed).toBe(false);
    expect(result.error).toEqual(expect.any(String));
    expect(result.health.status).toBeNull();
    expect(result.webhook.status).toBeNull();
    expect(result.alerting.action).toBe("below-threshold");

    const historyLines = readFileSync(historyPath, "utf8").trim().split("\n");
    expect(historyLines).toHaveLength(1);
  });

  it("envía una sola alerta al alcanzar el umbral y deduplica fallos posteriores mientras siga activa", async () => {
    const notifications: Array<{ title: string; content: string }> = [];
    const notificationServer = buildNotificationServer(notifications);
    const notificationBaseUrl = await listen(notificationServer);
    const unreachableUrl = "http://127.0.0.1:9";
    const env = {
      BUILT_IN_FORGE_API_URL: notificationBaseUrl,
      BUILT_IN_FORGE_API_KEY: "forge-test-key",
    };

    await runSmoke(unreachableUrl, "scheduled-test", env);
    await runSmoke(unreachableUrl, "scheduled-test", env);
    const thresholdResult = await runSmoke(unreachableUrl, "scheduled-test", env);
    const dedupedResult = await runSmoke(unreachableUrl, "scheduled-test", env);

    expect(thresholdResult.alerting).toMatchObject({
      action: "failure-threshold-reached",
      delivered: true,
      alertActive: true,
    });
    expect(dedupedResult.alerting).toMatchObject({
      action: "deduped-active-alert",
      delivered: false,
      alertActive: true,
    });

    expect(notifications).toHaveLength(1);
    expect(notifications[0]?.title).toContain("3 fallos consecutivos");
    expect(notifications[0]?.content).toContain("Consecutive failures: 3");
    expect(notifications[0]?.content).toContain("Timestamp:");

    const alertState = JSON.parse(readFileSync(alertStatePath, "utf8"));
    expect(alertState).toMatchObject({
      alertActive: true,
      lastNotifiedStatus: "failure",
      threshold: 3,
    });
  });

  it("envía recuperación cuando el bridge vuelve a pasar después de una alerta activa", async () => {
    const notifications: Array<{ title: string; content: string }> = [];
    const notificationServer = buildNotificationServer(notifications);
    const notificationBaseUrl = await listen(notificationServer);
    const healthyServer = buildHealthyBridgeServer();
    const healthyUrl = await listen(healthyServer);
    const unreachableUrl = "http://127.0.0.1:9";
    const env = {
      BUILT_IN_FORGE_API_URL: notificationBaseUrl,
      BUILT_IN_FORGE_API_KEY: "forge-test-key",
    };

    await runSmoke(unreachableUrl, "scheduled-test", env);
    await runSmoke(unreachableUrl, "scheduled-test", env);
    await runSmoke(unreachableUrl, "scheduled-test", env);
    const recoveryResult = await runSmoke(healthyUrl, "scheduled-test", env);

    expect(notifications).toHaveLength(2);
    expect(notifications[0]?.title).toContain("3 fallos consecutivos");
    expect(notifications[1]?.title).toContain("Bridge smoke recovered");
    expect(notifications[1]?.content).toContain("Recovered after alert activated at:");
    expect(recoveryResult.alerting).toMatchObject({
      action: "recovery",
      delivered: true,
      alertActive: false,
    });

    const alertState = JSON.parse(readFileSync(alertStatePath, "utf8"));
    expect(alertState).toMatchObject({
      alertActive: false,
      lastNotifiedStatus: "recovery",
      threshold: 3,
    });
  });
});

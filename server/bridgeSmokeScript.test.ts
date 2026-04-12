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
const scriptPath = `${projectRoot}/bridge_smoke_test.mjs`;
const serversToClose: Array<ReturnType<typeof createServer>> = [];

function cleanupSmokeOutputs() {
  rmSync(resultPath, { force: true });
  rmSync(historyPath, { force: true });
}

async function runSmoke(baseUrl: string, runMode = "test") {
  await execFileAsync("node", [scriptPath, baseUrl, runMode], {
    cwd: projectRoot,
    env: {
      ...process.env,
      AUDITAPATRON_ENGINE_HMAC_SECRET: "return-webhook-secret-123456",
    },
  });

  return JSON.parse(readFileSync(resultPath, "utf8")) as Record<string, any>;
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
    await new Promise<void>((resolve) => server.listen(0, () => resolve()));
    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}`;

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

    const historyLines = readFileSync(historyPath, "utf8").trim().split("\n");
    expect(historyLines).toHaveLength(1);
  });
});

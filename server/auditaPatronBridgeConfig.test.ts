import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import { afterEach, describe, expect, it, vi } from "vitest";

const configuredWebhookUrl = process.env.AUDITAPATRON_ENGINE_WEBHOOK_URL ?? "";
const configuredSecret = process.env.AUDITAPATRON_ENGINE_HMAC_SECRET ?? "";

vi.mock("./db", () => ({
  addCaseEvent: vi.fn(),
  addOperationalAlert: vi.fn(),
  createAuditLog: vi.fn(),
  getDocumentById: vi.fn(),
  registerCompliLinkWebhookEvent: vi.fn(),
  upsertCanonicalContract: vi.fn(),
  updateCompliLinkWebhookEvent: vi.fn(),
  updateDocumentPostProcessing: vi.fn(),
}));

import { registerCompliLinkReturnWebhook } from "./auditaPatronReturnWebhook";

const serversToClose: Array<ReturnType<typeof createServer>> = [];

async function startServer() {
  const app = express();
  app.use(
    express.json({
      verify: (req, _res, buffer) => {
        (req as typeof req & { rawBody?: string }).rawBody = buffer.toString("utf8");
      },
    }),
  );
  registerCompliLinkReturnWebhook(app);

  const server = createServer(app);
  serversToClose.push(server);
  await new Promise<void>((resolve) => server.listen(0, () => resolve()));
  return server;
}

afterEach(async () => {
  await Promise.all(
    serversToClose.splice(0).map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        }),
    ),
  );
});

describe("auditaPatron bridge runtime configuration", () => {
  it("uses the published www webhook URL", () => {
    expect(configuredWebhookUrl).toBe("https://www.complilink.mx/api/auditapatron/webhook");
  });

  it("authenticates the internal Helios contract route with the configured bridge secret", async () => {
    expect(configuredSecret.trim().length).toBeGreaterThan(0);

    const server = await startServer();
    const address = server.address() as AddressInfo;
    const response = await fetch(`http://127.0.0.1:${address.port}/api/internal/helios/bridge/contract`, {
      headers: {
        Authorization: `Bearer ${configuredSecret}`,
        Accept: "application/json",
      },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: "ok",
      endpoints: {
        contract: "/api/internal/helios/bridge/contract",
      },
      authentication: {
        sharedSecret: {
          acceptedHeaders: ["Authorization", "x-helios-token", "x-auditapatron-token"],
        },
      },
    });
  });
});

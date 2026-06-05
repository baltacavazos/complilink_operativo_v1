import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ENV } from "./_core/env";

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

const expectedWebhookUrl = "https://complilink.mx/api/integrations/auditapatron/bridge";
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

describe("AUDITAPATRON_ENGINE_WEBHOOK_URL", () => {
  it("usa el bridge remoto canónico y mantiene disponible el contrato ligero autenticado", async () => {
    const webhookUrl = ENV.auditapatronEngineWebhookUrl;
    const hmacSecret = ENV.auditapatronEngineHmacSecret;

    expect(webhookUrl).toBeTruthy();
    expect(webhookUrl).toBe(expectedWebhookUrl);
    expect(new URL(webhookUrl).origin).toBe("https://complilink.mx");
    expect(hmacSecret.trim().length).toBeGreaterThan(0);

    const server = await startServer();
    const address = server.address() as AddressInfo;
    const response = await fetch(`http://127.0.0.1:${address.port}/api/internal/helios/bridge/contract`, {
      headers: {
        Authorization: `Bearer ${hmacSecret}`,
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

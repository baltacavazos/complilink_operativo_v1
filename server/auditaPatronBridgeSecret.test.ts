import { createServer } from "node:http";
import { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { buildAuditaPatronEngineSignature } from "./auditaPatronIntegrationService";

const webhookUrl = process.env.AUDITAPATRON_ENGINE_WEBHOOK_URL ?? "";
const hmacSecret = process.env.AUDITAPATRON_ENGINE_HMAC_SECRET ?? "";
const expectedWebhookUrl = "https://complilink.mx/api/auditapatron/webhook";
const expectedHealthUrl = "https://complilink.mx/api/internal/helios/bridge/contract";
const allowLiveBridgeSmokeByEnv =
  process.env.ENABLE_LIVE_COMPLILINK_BRIDGE_SMOKE_TEST_IN_DEV_ONLY === "TRUE";
const allowLiveBridgeSmokeByRuntime = process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test";
const runLiveBridgeSmoke = allowLiveBridgeSmokeByEnv && allowLiveBridgeSmokeByRuntime;
const liveSmokeIt = runLiveBridgeSmoke ? it : it.skip;
const serversToClose: Array<ReturnType<typeof createServer>> = [];

afterEach(async () => {
  await Promise.all(
    serversToClose.splice(0).map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => {
            if (error) reject(error);
            else resolve();
          });
        }),
    ),
  );
});

describe("CompliLink MX bridge credentials", () => {
  it("validates the configured public bridge endpoint and HMAC secret shape", () => {
    expect(webhookUrl).toBe(expectedWebhookUrl);
    expect(new URL(webhookUrl).origin).toBe("https://complilink.mx");
    expect(hmacSecret.trim().length).toBeGreaterThan(0);
  });

  it("builds timestamp-based HMAC headers for the bridge contract without calling the live endpoint", async () => {
    const payload = {
      event: "document.uploaded",
      documentId: "test_secret_validation_contract",
      sourceUserId: "test_user",
      docType: "recibo_nomina",
      fileUrl: "https://example.com/test.pdf",
      sha256: "0000000000000000000000000000000000000000000000000000000000000000",
      mimeType: "application/pdf",
      uploadedAt: "2026-04-07T00:00:00.000Z",
    };

    const timestamp = "1775433600";
    const body = JSON.stringify(payload);
    const signature = buildAuditaPatronEngineSignature(timestamp, body, hmacSecret);

    const serverResult = await new Promise<{
      method: string | undefined;
      url: string | undefined;
      signatureHeader: string | undefined;
      timestampHeader: string | undefined;
      body: string;
    }>((resolve, reject) => {
      const server = createServer((req, res) => {
        const chunks: Buffer[] = [];

        req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        req.on("end", () => {
          try {
            const receivedBody = Buffer.concat(chunks).toString("utf-8");
            res.statusCode = 200;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ ok: true }));

            resolve({
              method: req.method,
              url: req.url,
              signatureHeader: req.headers["x-auditapatron-signature"] as string | undefined,
              timestampHeader: req.headers["x-auditapatron-timestamp"] as string | undefined,
              body: receivedBody,
            });
          } catch (error) {
            reject(error);
          }
        });
      });

      serversToClose.push(server);

      server.listen(0, "127.0.0.1", async () => {
        try {
          const address = server.address() as AddressInfo;
          const response = await fetch(`http://127.0.0.1:${address.port}/bridge-check`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-AuditaPatron-Timestamp": timestamp,
              "X-AuditaPatron-Signature": signature,
            },
            body,
          });

          if (!response.ok) {
            reject(new Error(`Local bridge verification returned ${response.status}`));
          }
        } catch (error) {
          reject(error);
        }
      });
    });

    expect(serverResult.method).toBe("POST");
    expect(serverResult.url).toBe("/bridge-check");
    expect(serverResult.timestampHeader).toBe(timestamp);
    expect(serverResult.signatureHeader).toBe(signature);
    expect(serverResult.signatureHeader).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.parse(serverResult.body)).toMatchObject(payload);
  });

  it("keeps the live smoke test disabled unless the explicit dev-only guardrail is enabled", () => {
    expect(runLiveBridgeSmoke).toBe(allowLiveBridgeSmokeByEnv && allowLiveBridgeSmokeByRuntime);

    if (allowLiveBridgeSmokeByEnv) {
      expect(allowLiveBridgeSmokeByRuntime).toBe(true);
    }
  });

  liveSmokeIt("reaches the published health endpoint over the network", async () => {
    const response = await fetch(expectedHealthUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${hmacSecret}`,
      },
    });

    expect(response.ok).toBe(true);

    const body = await response.json();
    expect(body).toMatchObject({
      status: "ok",
      service: "complilink-auditapatron-bridge",
    });
  });

  liveSmokeIt("accepts a signed test webhook against the published bridge over the network", async () => {
    const payload = {
      event: "document.uploaded",
      documentId: `test_secret_validation_${Date.now()}`,
      sourceUserId: "test_user",
      docType: "recibo_nomina",
      fileUrl: "https://example.com/test.pdf",
      sha256: "0000000000000000000000000000000000000000000000000000000000000000",
      mimeType: "application/pdf",
      uploadedAt: "2026-04-07T00:00:00.000Z",
    };

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const body = JSON.stringify(payload);
    const signature = buildAuditaPatronEngineSignature(timestamp, body, hmacSecret);

    const response = await fetch(expectedWebhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-AuditaPatron-Timestamp": timestamp,
        "X-AuditaPatron-Signature": signature,
      },
      body,
    });

    expect(response.status).toBe(200);

    const responseBody = await response.json();
    expect(responseBody).toMatchObject({
      verified: true,
      event: "document.uploaded",
      documentId: payload.documentId,
    });
  });
});

import { createServer } from "node:http";
import { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { buildAuditaPatronEngineSignature } from "./auditaPatronIntegrationService";

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

describe("AuditaPatron engine secrets", () => {
  it("validates webhook configuration and signs a lightweight local request with the current HMAC contract", async () => {
    const webhookUrl = process.env.AUDITAPATRON_ENGINE_WEBHOOK_URL ?? "";
    const hmacSecret = process.env.AUDITAPATRON_ENGINE_HMAC_SECRET ?? "";

    expect(webhookUrl).toBeTruthy();
    expect(() => new URL(webhookUrl)).not.toThrow();
    expect(hmacSecret.trim().length).toBeGreaterThan(0);

    const payload = {
      event: "document.uploaded",
      documentId: "ap-doc-secret-check",
      sourceUserId: "ap-user-secret-check",
      docType: "recibo_nomina",
      fileUrl: "https://example.com/ap-doc-secret-check.pdf",
      sha256: "1111111111111111111111111111111111111111111111111111111111111111",
      mimeType: "application/pdf",
      uploadedAt: "2026-04-06T10:30:00.000Z",
    };

    const timestamp = "1775433600";
    const body = JSON.stringify(payload);
    const signature = buildAuditaPatronEngineSignature(timestamp, body, hmacSecret);

    const serverResult = await new Promise<{
      status: number;
      body: string;
      signatureHeader: string | undefined;
      timestampHeader: string | undefined;
    }>((resolve, reject) => {
      const server = createServer((req, res) => {
        const chunks: Buffer[] = [];

        req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        req.on("end", () => {
          try {
            const receivedBody = Buffer.concat(chunks).toString("utf-8");
            const signatureHeader = req.headers["x-auditapatron-signature"] as string | undefined;
            const timestampHeader = req.headers["x-auditapatron-timestamp"] as string | undefined;

            if (signatureHeader !== signature || timestampHeader !== timestamp) {
              res.statusCode = 401;
              res.end(JSON.stringify({ status: "invalid_signature" }));
              resolve({
                status: 401,
                body: receivedBody,
                signatureHeader,
                timestampHeader,
              });
              return;
            }

            res.statusCode = 200;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ status: "received" }));
            resolve({
              status: 200,
              body: receivedBody,
              signatureHeader,
              timestampHeader,
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
          const response = await fetch(`http://127.0.0.1:${address.port}/secret-check`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-AuditaPatron-Signature": signature,
              "X-AuditaPatron-Timestamp": timestamp,
            },
            body,
          });

          if (!response.ok) {
            reject(new Error(`Secret validation endpoint returned ${response.status}`));
          }
        } catch (error) {
          reject(error);
        }
      });
    });

    expect(serverResult.status).toBe(200);
    expect(serverResult.signatureHeader).toBe(signature);
    expect(serverResult.signatureHeader).toMatch(/^[a-f0-9]{64}$/);
    expect(serverResult.timestampHeader).toBe(timestamp);
    expect(JSON.parse(serverResult.body)).toMatchObject({
      event: "document.uploaded",
      documentId: "ap-doc-secret-check",
      sourceUserId: "ap-user-secret-check",
    });
  });
});

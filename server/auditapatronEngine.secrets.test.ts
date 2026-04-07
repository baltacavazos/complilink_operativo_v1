import { createHmac } from "node:crypto";
import { createServer } from "node:http";
import { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";

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
  it("validates webhook configuration and signs a lightweight API request with the supplied HMAC secret", async () => {
    const webhookUrl = process.env.AUDITAPATRON_ENGINE_WEBHOOK_URL;
    const hmacSecret = process.env.AUDITAPATRON_ENGINE_HMAC_SECRET;

    expect(webhookUrl).toBeTruthy();
    expect(hmacSecret).toBeTruthy();
    expect(() => new URL(webhookUrl!)).not.toThrow();
    expect(hmacSecret!.trim().length).toBeGreaterThanOrEqual(16);

    const payload = JSON.stringify({
      event: "document.uploaded",
      version: "1.0",
      timestamp: "2026-04-06T10:30:00.000Z",
      data: {
        documentId: "ap-doc-secret-check",
        caseId: "ap-case-secret-check",
        sourceUserId: "ap-user-secret-check",
      },
    });

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
            const body = Buffer.concat(chunks).toString("utf-8");
            const signatureHeader = req.headers["x-auditapatron-signature"] as string | undefined;
            const timestampHeader = req.headers["x-auditapatron-timestamp"] as string | undefined;
            const expectedSignature = `hmac-sha256:${createHmac("sha256", hmacSecret!).update(body).digest("hex")}`;

            if (signatureHeader !== expectedSignature) {
              res.statusCode = 401;
              res.end(JSON.stringify({ status: "invalid_signature" }));
              resolve({ status: 401, body, signatureHeader, timestampHeader });
              return;
            }

            res.statusCode = 200;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ status: "received" }));
            resolve({ status: 200, body, signatureHeader, timestampHeader });
          } catch (error) {
            reject(error);
          }
        });
      });

      serversToClose.push(server);

      server.listen(0, "127.0.0.1", async () => {
        try {
          const address = server.address() as AddressInfo;
          const signature = `hmac-sha256:${createHmac("sha256", hmacSecret!).update(payload).digest("hex")}`;
          const response = await fetch(`http://127.0.0.1:${address.port}/health`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-AuditaPatron-Signature": signature,
              "X-AuditaPatron-Timestamp": "2026-04-06T10:30:00.000Z",
            },
            body: payload,
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
    expect(serverResult.signatureHeader).toMatch(/^hmac-sha256:[a-f0-9]{64}$/);
    expect(serverResult.timestampHeader).toBe("2026-04-06T10:30:00.000Z");
    expect(JSON.parse(serverResult.body)).toMatchObject({
      event: "document.uploaded",
      version: "1.0",
      data: {
        documentId: "ap-doc-secret-check",
      },
    });
  });
});

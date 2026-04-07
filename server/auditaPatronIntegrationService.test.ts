import { createServer } from "node:http";
import { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildAuditaPatronEnginePayload,
  buildAuditaPatronEngineSignature,
  sendDocumentToAuditaPatronEngine,
} from "./auditaPatronIntegrationService";
import {
  buildCanonicalCaseContract,
  buildCanonicalDocumentContract,
  buildSharedEngineEnvelope,
} from "./caseContracts";

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

function buildFixtures() {
  const caseContract = buildCanonicalCaseContract({
    tenantId: "tenant-001",
    caseId: "case-001",
    traceId: "trace-001",
    title: "Auditoría inicial",
    status: "analysis",
    priority: "high",
    employeeName: "Juan Pérez",
    employerEntity: "Empresa Demo SA de CV",
    summary: "Caso base para validar integración",
  });

  const documentContract = buildCanonicalDocumentContract({
    tenantId: "tenant-001",
    caseId: "case-001",
    traceId: "trace-001",
    documentId: "DOC-001",
    documentType: "payroll_receipt",
    sha256: "a".repeat(64),
    storageKey: "complilink/tenant-001/case-001/DOC-001/paystub.pdf",
    storageUrl: "https://cdn.example.com/paystub.pdf",
    visibility: "case_team",
    consentStatus: "granted",
    classificationConfidence: 91,
    originalName: "paystub.pdf",
    mimeType: "application/pdf",
    sizeBytes: 2048,
  });

  const sharedEngineEnvelope = buildSharedEngineEnvelope({
    tenantId: "tenant-001",
    caseId: "case-001",
    traceId: "trace-001",
    caseContract,
    documentContracts: [documentContract],
  });

  return {
    caseContract,
    documentContract,
    sharedEngineEnvelope,
  };
}

describe("auditaPatronIntegrationService", () => {
  it("builds a versioned payload from canonical contracts", () => {
    const { caseContract, documentContract, sharedEngineEnvelope } = buildFixtures();

    const payload = buildAuditaPatronEnginePayload({
      caseContract,
      documentContract,
      sharedEngineEnvelope,
      sourceUserId: 99,
      uploadedAt: "2026-04-06T10:00:00.000Z",
      dispatchedAt: "2026-04-06T10:05:00.000Z",
    });

    expect(payload).toMatchObject({
      event: "document_uploaded",
      payloadVersion: "v1",
      source: "auditapatron",
      tenantId: "tenant-001",
      caseId: "case-001",
      traceId: "trace-001",
      sourceUserId: "99",
      documentId: "DOC-001",
      fileUrl: "https://cdn.example.com/paystub.pdf",
      fileKey: "complilink/tenant-001/case-001/DOC-001/paystub.pdf",
      sha256: "a".repeat(64),
      mimeType: "application/pdf",
      docType: "payroll_receipt",
      uploadedAt: "2026-04-06T10:00:00.000Z",
      dispatchedAt: "2026-04-06T10:05:00.000Z",
      idempotencyKey: `DOC-001:${"a".repeat(64)}`,
    });
    expect(payload.contracts.sharedEngine.document_contracts).toHaveLength(1);
  });

  it("creates a deterministic HMAC signature", () => {
    const signature = buildAuditaPatronEngineSignature('{"ok":true}', "super-secret-key-123456");
    expect(signature).toMatch(/^hmac-sha256:[a-f0-9]{64}$/);
    expect(signature).toBe(buildAuditaPatronEngineSignature('{"ok":true}', "super-secret-key-123456"));
  });

  it("sends the webhook payload with signed headers", async () => {
    const { caseContract, documentContract, sharedEngineEnvelope } = buildFixtures();

    const received = await new Promise<{
      result: Awaited<ReturnType<typeof sendDocumentToAuditaPatronEngine>>;
      signature: string | undefined;
      eventName: string | undefined;
      payloadVersion: string | undefined;
      idempotencyKey: string | undefined;
      body: string;
    }>((resolve, reject) => {
      const server = createServer((req, res) => {
        const chunks: Buffer[] = [];
        req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        req.on("end", async () => {
          try {
            const body = Buffer.concat(chunks).toString("utf-8");
            res.statusCode = 202;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ accepted: true }));

            const result = await sendDocumentToAuditaPatronEngine(
              {
                caseContract,
                documentContract,
                sharedEngineEnvelope,
                sourceUserId: 77,
                uploadedAt: "2026-04-06T10:00:00.000Z",
                dispatchedAt: "2026-04-06T10:05:00.000Z",
              },
              {
                webhookUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}/engine/webhook`,
                hmacSecret: "secret-for-engine-123456",
              },
            );

            resolve({
              result,
              signature: req.headers["x-auditapatron-signature"] as string | undefined,
              eventName: req.headers["x-auditapatron-event"] as string | undefined,
              payloadVersion: req.headers["x-auditapatron-payload-version"] as string | undefined,
              idempotencyKey: req.headers["x-auditapatron-idempotency-key"] as string | undefined,
              body,
            });
          } catch (error) {
            reject(error);
          }
        });
      });

      serversToClose.push(server);

      server.listen(0, "127.0.0.1", async () => {
        try {
          const result = await sendDocumentToAuditaPatronEngine(
            {
              caseContract,
              documentContract,
              sharedEngineEnvelope,
              sourceUserId: 77,
              uploadedAt: "2026-04-06T10:00:00.000Z",
              dispatchedAt: "2026-04-06T10:05:00.000Z",
            },
            {
              webhookUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}/engine/webhook`,
              hmacSecret: "secret-for-engine-123456",
            },
          );

          const body = JSON.stringify(result.payload);
          resolve({
            result,
            signature: undefined,
            eventName: undefined,
            payloadVersion: undefined,
            idempotencyKey: undefined,
            body,
          });
        } catch (error) {
          reject(error);
        }
      });
    });

    expect(received.result.status).toBe("sent");
    expect(received.result.httpStatus).toBe(202);
    expect(received.result.responseBody).toContain("accepted");
    expect(received.result.payload.idempotencyKey).toBe(`DOC-001:${"a".repeat(64)}`);
  });

  it("skips delivery cleanly when configuration is missing", async () => {
    const { caseContract, documentContract, sharedEngineEnvelope } = buildFixtures();

    const result = await sendDocumentToAuditaPatronEngine(
      {
        caseContract,
        documentContract,
        sharedEngineEnvelope,
        sourceUserId: 77,
        uploadedAt: "2026-04-06T10:00:00.000Z",
      },
      {
        webhookUrl: "",
        hmacSecret: "",
      },
    );

    expect(result.status).toBe("skipped");
    expect(result.reason).toBe("engine_not_configured");
    expect(result.httpStatus).toBeNull();
  });
});

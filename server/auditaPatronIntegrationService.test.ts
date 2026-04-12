import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildAuditaPatronEnginePayload,
  buildAuditaPatronEngineSignature,
  sendDocumentToAuditaPatronEngine,
  verifySignedWebhook,
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
  it("builds a compliant payload for CompliLink MX", () => {
    const { caseContract, documentContract, sharedEngineEnvelope } = buildFixtures();

    const payload = buildAuditaPatronEnginePayload({
      caseContract,
      documentContract,
      sharedEngineEnvelope,
      sourceUserId: 99,
      uploadedAt: "2026-04-06T10:00:00.000Z",
      metadata: {
        descriptiveDocType: "Recibo Nómina",
        employerRfc: "AAA010101AAA",
      },
    });

    expect(payload).toMatchObject({
      event: "document.uploaded",
      documentId: "DOC-001",
      sourceUserId: "99",
      docType: "recibo_nomina",
      fileUrl: "https://cdn.example.com/paystub.pdf",
      sha256: "a".repeat(64),
      mimeType: "application/pdf",
      uploadedAt: "2026-04-06T10:00:00.000Z",
      fileSizeBytes: 2048,
      auditId: "trace-001",
      caseId: "case-001",
      metadata: {
        descriptiveDocType: "Recibo Nómina",
        employerRfc: "AAA010101AAA",
      },
    });
  });

  it("creates a deterministic HMAC signature from timestamp and body", () => {
    const timestamp = "1712397900";
    const body = '{"ok":true}';

    const signature = buildAuditaPatronEngineSignature(timestamp, body, "super-secret-key-123456");

    expect(signature).toMatch(/^[a-f0-9]{64}$/);
    expect(signature).toBe(buildAuditaPatronEngineSignature(timestamp, body, "super-secret-key-123456"));
    expect(signature).not.toBe(buildAuditaPatronEngineSignature("1712397901", body, "super-secret-key-123456"));
  });

  it("verifies a signed webhook using timestamp and raw body", () => {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const body = JSON.stringify({ event: "document.analysis.completed", documentId: "DOC-001" });
    const signature = buildAuditaPatronEngineSignature(timestamp, body, "secret-for-engine-123456");

    const verification = verifySignedWebhook({
      signatureHeader: signature,
      timestampHeader: timestamp,
      payloadBody: body,
      hmacSecret: "secret-for-engine-123456",
    });

    expect(verification.ok).toBe(true);
  });

  it("sends the webhook payload with signed headers", async () => {
    const { caseContract, documentContract, sharedEngineEnvelope } = buildFixtures();

    const receivedPromise = new Promise<{
      body: string;
      timestamp: string | undefined;
      signature: string | undefined;
    }>((resolve) => {
      const server = createServer((req, res) => {
        const chunks: Buffer[] = [];
        req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        req.on("end", () => {
          const body = Buffer.concat(chunks).toString("utf8");
          res.statusCode = 202;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ accepted: true }));
          resolve({
            body,
            timestamp: req.headers["x-auditapatron-timestamp"] as string | undefined,
            signature: req.headers["x-auditapatron-signature"] as string | undefined,
          });
        });
      });

      serversToClose.push(server);
      server.listen(0, "127.0.0.1");
    });

    const server = serversToClose.at(-1);
    if (!server) {
      throw new Error("Server was not created");
    }

    await new Promise<void>((resolve) => server.once("listening", () => resolve()));
    const webhookUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/engine/webhook`;

    const resultPromise = sendDocumentToAuditaPatronEngine(
      {
        caseContract,
        documentContract,
        sharedEngineEnvelope,
        sourceUserId: 77,
        uploadedAt: "2026-04-06T10:00:00.000Z",
        docType: "recibo_nomina",
      },
      {
        webhookUrl,
        hmacSecret: "secret-for-engine-123456",
        retryDelaysMs: [],
      },
    );

    const [received, result] = await Promise.all([receivedPromise, resultPromise]);

    expect(received.timestamp).toBeTruthy();
    expect(received.signature).toBe(
      buildAuditaPatronEngineSignature(received.timestamp ?? "", received.body, "secret-for-engine-123456"),
    );
    expect(result.status).toBe("sent");
    expect(result.httpStatus).toBe(202);
    expect(result.attempts).toBe(1);
    expect(result.responseBody).toContain("accepted");
    expect(result.payload.event).toBe("document.uploaded");
    expect(result.payload.correlationId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(result.observabilityEnvelope.targetHost).toContain("127.0.0.1");
    expect(result.observabilityEnvelope.targetPath).toBe("/engine/webhook");
    expect(result.observabilityEnvelope.outcomeCategory).toBe("success");
    expect(result.observabilityEnvelope.retryScheduled).toBe(false);
    expect(result.observabilityEnvelope.retryDelayMs).toBeNull();
    expect(result.observabilityEnvelope.httpStatusCode).toBe(202);
    expect(result.observabilityEnvelope.remoteSmokeEnabled).toBe(false);
    expect(result.observabilityEnvelope.dispatchId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(result.observabilityEnvelope.correlationId).toBe(result.payload.correlationId);
  });

  it("retries only for 5xx responses and eventually succeeds", async () => {
    const { caseContract, documentContract, sharedEngineEnvelope } = buildFixtures();
    let hitCount = 0;

    const server = createServer((req, res) => {
      hitCount += 1;
      req.resume();
      if (hitCount < 3) {
        res.statusCode = 503;
        res.end("temporary error");
        return;
      }

      res.statusCode = 202;
      res.end("accepted");
    });

    serversToClose.push(server);
    server.listen(0, "127.0.0.1");
    await new Promise<void>((resolve) => server.once("listening", () => resolve()));

    const result = await sendDocumentToAuditaPatronEngine(
      {
        caseContract,
        documentContract,
        sharedEngineEnvelope,
        sourceUserId: 77,
        uploadedAt: "2026-04-06T10:00:00.000Z",
      },
      {
        webhookUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}/engine/webhook`,
        hmacSecret: "secret-for-engine-123456",
        retryDelaysMs: [0, 0],
      },
    );

    expect(hitCount).toBe(3);
    expect(result.status).toBe("sent");
    expect(result.httpStatus).toBe(202);
    expect(result.attempts).toBe(3);
    expect(result.observabilityEnvelope.outcomeCategory).toBe("success");
    expect(result.observabilityEnvelope.retryScheduled).toBe(false);
    expect(result.observabilityEnvelope.httpStatusCode).toBe(202);
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
    expect(result.attempts).toBe(0);
    expect(result.observabilityEnvelope.targetHost).toBeNull();
    expect(result.observabilityEnvelope.targetPath).toBeNull();
    expect(result.observabilityEnvelope.outcomeCategory).toBe("skipped");
    expect(result.observabilityEnvelope.retryScheduled).toBe(false);
    expect(result.observabilityEnvelope.retryDelayMs).toBeNull();
    expect(result.observabilityEnvelope.httpStatusCode).toBeNull();
  });
});

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

async function startBridgeServer(options: {
  webhookPath?: string;
  healthHandler?: (req: InstanceType<typeof IncomingMessageShim>, res: InstanceType<typeof ServerResponseShim>) => void;
  webhookHandler: (req: InstanceType<typeof IncomingMessageShim>, res: InstanceType<typeof ServerResponseShim>) => void;
}) {
  const webhookPath = options.webhookPath ?? "/engine/webhook";
  const server = createServer((req, res) => {
    if (req.url === "/api/auditapatron/health") {
      if (options.healthHandler) {
        options.healthHandler(req as never, res as never);
        return;
      }

      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          status: "ok",
          bridge: "auditapatron",
          webhookPath,
          responseContract: "auditapatron.bridge.ack.v1",
        }),
      );
      return;
    }

    if (req.url === webhookPath) {
      options.webhookHandler(req as never, res as never);
      return;
    }

    res.statusCode = 404;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "not_found" }));
  });

  serversToClose.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  return server;
}

type IncomingMessageShim = {
  on: (event: string, handler: (chunk?: Buffer) => void) => void;
  resume: () => void;
  headers: Record<string, string | string[] | undefined>;
  url?: string;
};

type ServerResponseShim = {
  statusCode: number;
  setHeader: (name: string, value: string) => void;
  end: (body?: string) => void;
};

describe("auditaPatronIntegrationService", () => {
  it("builds a compliant outbound payload for the final CompliLink contract", () => {
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
        providerId: 501,
        title: "Recibo de nómina abril 2026",
        obligation: "nomina",
        notes: "Documento prioritario para validación contractual",
      },
      dispatchId: "dispatch-001",
      correlationId: "corr-001",
    });

    expect(payload).toMatchObject({
      providerId: 501,
      userId: 99,
      title: "Recibo de nómina abril 2026",
      mimeType: "application/pdf",
      fileUrl: "https://cdn.example.com/paystub.pdf",
      documentId: "DOC-001",
      category: "recibo_nomina",
      obligation: "nomina",
      originalFileName: "paystub.pdf",
      notes: "Documento prioritario para validación contractual",
      sourceModule: "complilink_operativo",
      sourceCaseId: "case-001",
      sourceDocumentId: "DOC-001",
      uploadedAt: "2026-04-06T10:00:00.000Z",
      traceId: "trace-001",
      processingStatus: "queued",
      eventName: "document.uploaded",
      eventId: "dispatch-001",
      idempotencyKey: "dispatch-001",
      correlationId: "corr-001",
      tags: ["recibo_nomina", "nomina"],
      operationalContext: {
        traceId: "trace-001",
        auditId: "trace-001",
        caseId: "case-001",
        dispatchId: "dispatch-001",
        sha256: "a".repeat(64),
        fileSizeBytes: 2048,
        documentType: "payroll_receipt",
        sharedEnvelopeDocumentCount: 1,
      },
    });
  });

  it("creates deterministic signatures for timestamped verification and raw-body bridge delivery", () => {
    const timestamp = "1712397900";
    const body = '{"ok":true}';

    const timestampedSignature = buildAuditaPatronEngineSignature(timestamp, body, "super-secret-key-123456");

    expect(timestampedSignature).toMatch(/^[a-f0-9]{64}$/);
    expect(timestampedSignature).toBe(
      buildAuditaPatronEngineSignature(timestamp, body, "super-secret-key-123456"),
    );
    expect(timestampedSignature).not.toBe(
      buildAuditaPatronEngineSignature("1712397901", body, "super-secret-key-123456"),
    );
  });

  it("verifies a signed return webhook using timestamp and raw body", () => {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const body = JSON.stringify({ event: "document.processed.v1", documentId: "DOC-001" });
    const signature = buildAuditaPatronEngineSignature(timestamp, body, "secret-for-engine-123456");

    const verification = verifySignedWebhook({
      signatureHeader: signature,
      timestampHeader: timestamp,
      payloadBody: body,
      hmacSecret: "secret-for-engine-123456",
    });

    expect(verification.ok).toBe(true);
  });

  it("sends the final bridge payload after a successful contractual health preflight", async () => {
    const { caseContract, documentContract, sharedEngineEnvelope } = buildFixtures();

    let resolveReceived: ((value: {
      body: string;
      signature: string | undefined;
      timestamp: string | undefined;
    }) => void) | null = null;

    const receivedPromise = new Promise<{
      body: string;
      signature: string | undefined;
      timestamp: string | undefined;
    }>((resolve) => {
      resolveReceived = resolve;
    });

    const server = await startBridgeServer({
      webhookHandler: (req, res) => {
        const chunks: Buffer[] = [];
        req.on("data", (chunk) => chunks.push(Buffer.from(chunk ?? [])));
        req.on("end", () => {
          const body = Buffer.concat(chunks).toString("utf8");
          res.statusCode = 202;
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              received: true,
              intakeId: "intake-001",
              documentId: "DOC-001",
              processingStatus: "queued",
              traceId: "trace-001",
              correlationId: "corr-remote-001",
              remoteEventId: "remote-event-001",
              recommendedNextAction: "none",
              responseContract: "auditapatron.bridge.ack.v1",
            }),
          );
          resolveReceived?.({
            body,
            signature: req.headers["x-auditapatron-signature"] as string | undefined,
            timestamp: req.headers["x-auditapatron-timestamp"] as string | undefined,
          });
        });
      },
    });

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
      buildAuditaPatronEngineSignature(String(received.timestamp), received.body, "secret-for-engine-123456"),
    );
    expect(result.status).toBe("sent");
    expect(result.httpStatus).toBe(202);
    expect(result.attempts).toBe(1);
    expect(result.responseAck).toMatchObject({
      received: true,
      intakeId: "intake-001",
      documentId: "DOC-001",
      processingStatus: "queued",
      traceId: "trace-001",
      correlationId: "corr-remote-001",
      remoteEventId: "remote-event-001",
      recommendedNextAction: "none",
      responseContract: "auditapatron.bridge.ack.v1",
    });
    expect(result.observabilityEnvelope.targetHost).toContain("127.0.0.1");
    expect(result.observabilityEnvelope.targetPath).toBe("/engine/webhook");
    expect(result.observabilityEnvelope.outcomeCategory).toBe("success");
  });

  it("fails with invalid_ack_contract when health is valid but the webhook returns HTML", async () => {
    const { caseContract, documentContract, sharedEngineEnvelope } = buildFixtures();
    const htmlBody = `<html><body>${"landing ".repeat(400)}</body></html>`;

    const server = await startBridgeServer({
      webhookHandler: (req, res) => {
        req.resume();
        res.statusCode = 200;
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.end(htmlBody);
      },
    });

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

    expect(result.status).toBe("failed");
    expect(result.httpStatus).toBe(200);
    expect(result.reason).toBe("invalid_ack_contract");
    expect(result.responseAck).toBeNull();
    expect(result.responseBody).toContain("<html><body>");
    expect(result.responseBody).toContain("…[truncated]");
  });

  it("classifies 400 responses as contract validation failures without retrying", async () => {
    const { caseContract, documentContract, sharedEngineEnvelope } = buildFixtures();
    let hitCount = 0;

    const server = await startBridgeServer({
      webhookHandler: (req, res) => {
        hitCount += 1;
        req.resume();
        res.statusCode = 400;
        res.setHeader("Content-Type", "application/json");
        res.end(
          JSON.stringify({
            received: false,
            issues: [{ code: "missing_field", field: "providerId" }],
            responseContract: "auditapatron.bridge.ack.v1",
          }),
        );
      },
    });

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

    expect(hitCount).toBe(1);
    expect(result.status).toBe("failed");
    expect(result.httpStatus).toBe(400);
    expect(result.reason).toBe("contract_validation_failed");
  });

  it("retries only for 5xx responses and eventually succeeds", async () => {
    const { caseContract, documentContract, sharedEngineEnvelope } = buildFixtures();
    let hitCount = 0;

    const server = await startBridgeServer({
      webhookHandler: (req, res) => {
        hitCount += 1;
        req.resume();
        if (hitCount < 3) {
          res.statusCode = 503;
          res.end("temporary error");
          return;
        }

        res.statusCode = 202;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ received: true, responseContract: "auditapatron.bridge.ack.v1" }));
      },
    });

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
  });

  it("falls back to a healthy secondary webhook when the primary candidate fails the health contract", async () => {
    const { caseContract, documentContract, sharedEngineEnvelope } = buildFixtures();

    const unhealthyServer = await startBridgeServer({
      healthHandler: (_req, res) => {
        res.statusCode = 200;
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.end("<html>landing</html>");
      },
      webhookHandler: (req, res) => {
        req.resume();
        res.statusCode = 500;
        res.end("should_not_be_used");
      },
    });

    const healthyServer = await startBridgeServer({
      webhookHandler: (req, res) => {
        req.resume();
        res.statusCode = 202;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ received: true, responseContract: "auditapatron.bridge.ack.v1" }));
      },
    });

    const result = await sendDocumentToAuditaPatronEngine(
      {
        caseContract,
        documentContract,
        sharedEngineEnvelope,
        sourceUserId: 77,
        uploadedAt: "2026-04-06T10:00:00.000Z",
      },
      {
        webhookUrl: `http://127.0.0.1:${(unhealthyServer.address() as AddressInfo).port}/engine/webhook`,
        fallbackWebhookUrls: [`http://127.0.0.1:${(healthyServer.address() as AddressInfo).port}/engine/webhook`],
        hmacSecret: "secret-for-engine-123456",
        retryDelaysMs: [],
      },
    );

    expect(result.status).toBe("sent");
    expect(result.httpStatus).toBe(202);
    expect(result.attempts).toBe(1);
    expect(result.observabilityEnvelope.targetHost).toContain(String((healthyServer.address() as AddressInfo).port));
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
  });
});

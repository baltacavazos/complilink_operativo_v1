import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildAuditaPatronEngineSignature } from "./auditaPatronIntegrationService";

const { dbMocks } = vi.hoisted(() => ({
  dbMocks: {
    addCaseEvent: vi.fn(),
    addOperationalAlert: vi.fn(),
    createAuditLog: vi.fn(),
    getDocumentById: vi.fn(),
    registerCompliLinkWebhookEvent: vi.fn(),
    upsertCanonicalContract: vi.fn(),
    updateCompliLinkWebhookEvent: vi.fn(),
    updateDocumentPostProcessing: vi.fn(),
  },
}));

vi.mock("./db", () => dbMocks);
vi.mock("./_core/env", () => ({
  ENV: {
    auditapatronEngineHmacSecret: "return-webhook-secret-123456",
  },
}));

import { registerCompliLinkReturnWebhook } from "./auditaPatronReturnWebhook";

const serversToClose: Array<ReturnType<typeof createServer>> = [];

async function startWebhookServer() {
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

function buildReturnPayload(overrides: Record<string, unknown> = {}) {
  return {
    event: "document.processed.v1",
    eventId: "evt-bridge-001",
    idempotencyKey: "evt-bridge-001",
    documentId: "DOC-BRIDGE-001",
    compliLinkId: "cmp-001",
    correlationId: "corr-bridge-001",
    status: "completed",
    timestamp: "2026-04-11T18:20:00.000Z",
    documentType: "contrato_laboral",
    confidenceScore: 87,
    extractedFields: {
      salario_diario: 420,
    },
    analysisResults: {
      clauseCount: 9,
    },
    metadata: {
      source: "complilink-mx",
    },
    ...overrides,
  };
}

function buildIncomingUploadPayload(overrides: Record<string, unknown> = {}) {
  return {
    event: "document.uploaded",
    documentId: "DOC-UP-001",
    sourceUserId: "USER-UP-001",
    docType: "recibo_nomina",
    fileUrl: "https://example.com/document.pdf",
    sha256: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    mimeType: "application/pdf",
    uploadedAt: "2026-04-11T18:20:00.000Z",
    ...overrides,
  };
}

describe("auditaPatronReturnWebhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.getDocumentById.mockResolvedValue({
      id: 41,
      tenantId: "tenant-bridge",
      caseId: "CASE-BRIDGE-001",
      traceId: "trace.bridge.case-001",
      documentId: "DOC-BRIDGE-001",
      originalName: "contrato-individual.pdf",
      mimeType: "application/pdf",
      documentType: "contrato_laboral",
      classificationConfidence: 12,
      integrityStatus: "verified",
      consentStatus: "accepted",
    });
    dbMocks.upsertCanonicalContract.mockResolvedValue(undefined);
    dbMocks.addCaseEvent.mockResolvedValue(undefined);
    dbMocks.addOperationalAlert.mockResolvedValue(undefined);
    dbMocks.createAuditLog.mockResolvedValue(undefined);
    dbMocks.updateDocumentPostProcessing.mockResolvedValue(undefined);
    dbMocks.updateCompliLinkWebhookEvent.mockResolvedValue(undefined);
  });

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

  it("expone el endpoint público de health del bridge", async () => {
    const server = await startWebhookServer();
    const address = server.address() as AddressInfo;
    const url = `http://127.0.0.1:${address.port}/api/auditapatron/health`;

    const response = await fetch(url);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: "ok",
      bridge: "auditapatron",
      webhookPath: "/api/auditapatron/webhook",
      responseContract: "auditapatron.bridge.ack.v1",
    });
  });

  it("acepta el webhook público firmado de document.uploaded sin tocar la base de datos interna", async () => {
    const payload = buildIncomingUploadPayload();
    const body = JSON.stringify(payload);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = buildAuditaPatronEngineSignature(timestamp, body, "return-webhook-secret-123456");

    const server = await startWebhookServer();
    const address = server.address() as AddressInfo;
    const url = `http://127.0.0.1:${address.port}/api/auditapatron/webhook`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-AuditaPatron-Timestamp": timestamp,
        "X-AuditaPatron-Signature": signature,
      },
      body,
    });

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toMatchObject({
      verified: true,
      received: true,
      event: "document.uploaded",
      documentId: "DOC-UP-001",
      sourceUserId: "USER-UP-001",
      responseContract: "auditapatron.bridge.ack.v1",
      processingStatus: "accepted",
    });
    expect(dbMocks.registerCompliLinkWebhookEvent).not.toHaveBeenCalled();
  });

  it("rechaza el webhook público con firma inválida y conserva el contrato de error", async () => {
    const payload = buildIncomingUploadPayload();
    const body = JSON.stringify(payload);
    const timestamp = Math.floor(Date.now() / 1000).toString();

    const server = await startWebhookServer();
    const address = server.address() as AddressInfo;
    const url = `http://127.0.0.1:${address.port}/api/auditapatron/webhook`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-AuditaPatron-Timestamp": timestamp,
        "X-AuditaPatron-Signature": "firma-invalida",
      },
      body,
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      verified: false,
      responseContract: "auditapatron.bridge.ack.v1",
      issues: [
        {
          code: "authentication_failed",
        },
      ],
    });
    expect(dbMocks.registerCompliLinkWebhookEvent).not.toHaveBeenCalled();
  });

  it("rechaza el webhook público si faltan campos contractuales aunque la firma sea válida", async () => {
    const payload = buildIncomingUploadPayload({
      fileUrl: undefined,
    });
    const body = JSON.stringify(payload);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = buildAuditaPatronEngineSignature(timestamp, body, "return-webhook-secret-123456");

    const server = await startWebhookServer();
    const address = server.address() as AddressInfo;
    const url = `http://127.0.0.1:${address.port}/api/auditapatron/webhook`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-AuditaPatron-Timestamp": timestamp,
        "X-AuditaPatron-Signature": signature,
      },
      body,
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      verified: false,
      responseContract: "auditapatron.bridge.ack.v1",
      issues: [
        {
          code: "missing_field",
          field: "fileUrl",
        },
      ],
    });
  });

  it("procesa solo una vez un mismo webhook autenticado por token cuando llega duplicado", async () => {
    dbMocks.registerCompliLinkWebhookEvent
      .mockResolvedValueOnce({
        created: true,
        event: {
          id: 901,
        },
      })
      .mockResolvedValueOnce({
        created: false,
        event: {
          id: 901,
        },
      });

    const payload = buildReturnPayload();
    const body = JSON.stringify(payload);

    const server = await startWebhookServer();
    const address = server.address() as AddressInfo;
    const url = `http://127.0.0.1:${address.port}/api/auditapatron/complilink-webhook`;

    const firstResponse = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer return-webhook-secret-123456",
      },
      body,
    });
    const secondResponse = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer return-webhook-secret-123456",
      },
      body,
    });

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(200);

    await expect(firstResponse.json()).resolves.toMatchObject({
      received: true,
      intakeId: "901",
      documentId: "DOC-BRIDGE-001",
      processingStatus: "processed",
      traceId: "trace.bridge.case-001",
      correlationId: "corr-bridge-001",
      remoteEventId: "evt-bridge-001",
      responseContract: "auditapatron.bridge.ack.v1",
    });
    await expect(secondResponse.json()).resolves.toMatchObject({
      received: true,
      intakeId: "901",
      documentId: "DOC-BRIDGE-001",
      processingStatus: "processed",
      traceId: "trace.bridge.case-001",
      correlationId: "corr-bridge-001",
      remoteEventId: "evt-bridge-001",
      responseContract: "auditapatron.bridge.ack.v1",
    });

    expect(dbMocks.registerCompliLinkWebhookEvent).toHaveBeenCalledTimes(2);
    expect(dbMocks.updateDocumentPostProcessing).toHaveBeenCalledTimes(1);
    expect(dbMocks.upsertCanonicalContract).toHaveBeenCalledTimes(2);
    expect(dbMocks.addCaseEvent).toHaveBeenCalledTimes(1);
    expect(dbMocks.createAuditLog).toHaveBeenCalledTimes(1);
    expect(dbMocks.updateCompliLinkWebhookEvent).toHaveBeenCalledTimes(1);
    expect(dbMocks.addOperationalAlert).not.toHaveBeenCalled();

    const firstInsert = dbMocks.registerCompliLinkWebhookEvent.mock.calls[0]?.[0];
    const secondInsert = dbMocks.registerCompliLinkWebhookEvent.mock.calls[1]?.[0];
    const genericAuditContract = dbMocks.upsertCanonicalContract.mock.calls[0]?.[0];
    const heliosAuditContract = dbMocks.upsertCanonicalContract.mock.calls[1]?.[0];

    expect(genericAuditContract).toMatchObject({
      contractType: "audit",
      schemaVersion: "v1",
      status: "ready",
    });
    expect(heliosAuditContract).toMatchObject({
      contractType: "audit",
      schemaVersion: "helios_v1",
      status: "ready",
    });
    const parsedHeliosContract = JSON.parse(String(heliosAuditContract?.payload ?? "{}"));
    expect(parsedHeliosContract).toMatchObject({
      engine: "helios",
      mode: "remote",
      status: "completed",
    });

    expect(firstInsert?.eventKey).toBe("event:evt-bridge-001");
    expect(firstInsert?.eventKey).toBe(secondInsert?.eventKey);
    expect(firstInsert).toMatchObject({
      tenantId: "tenant-bridge",
      caseId: "CASE-BRIDGE-001",
      traceId: "trace.bridge.case-001",
      documentId: "DOC-BRIDGE-001",
      eventName: "document.processed.v1",
      compliLinkId: "cmp-001",
      correlationId: "corr-bridge-001",
      sourceTimestamp: "2026-04-11T18:20:00.000Z",
      rawPayload: body,
      status: "processing",
    });
  });

  it("acepta autenticación por firma para eventos retry_requested y conserva el acuse contractual", async () => {
    dbMocks.registerCompliLinkWebhookEvent.mockResolvedValue({
      created: true,
      event: {
        id: 902,
      },
    });

    const payload = buildReturnPayload({
      event: "document.retry_requested.v1",
      eventId: "evt-bridge-002",
      idempotencyKey: "evt-bridge-002",
      correlationId: "corr-bridge-002",
    });
    const body = JSON.stringify(payload);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = buildAuditaPatronEngineSignature(timestamp, body, "return-webhook-secret-123456");

    const server = await startWebhookServer();
    const address = server.address() as AddressInfo;
    const url = `http://127.0.0.1:${address.port}/api/auditapatron/complilink-webhook`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-AuditaPatron-Timestamp": timestamp,
        "X-AuditaPatron-Signature": signature,
      },
      body,
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      received: true,
      intakeId: "902",
      documentId: "DOC-BRIDGE-001",
      processingStatus: "retry_requested",
      correlationId: "corr-bridge-002",
      remoteEventId: "evt-bridge-002",
      recommendedNextAction: "retry_dispatch",
      responseContract: "auditapatron.bridge.ack.v1",
    });
    expect(dbMocks.updateDocumentPostProcessing).not.toHaveBeenCalled();
  });

  it("responde 500 y marca failed_processing cuando el retorno autenticado falla durante el procesamiento", async () => {
    dbMocks.registerCompliLinkWebhookEvent.mockResolvedValue({
      created: true,
      event: {
        id: 903,
      },
    });
    dbMocks.upsertCanonicalContract.mockRejectedValueOnce(new Error("storage unavailable"));

    const payload = buildReturnPayload({
      event: "document.processed.v1",
      eventId: "evt-bridge-003",
      idempotencyKey: "evt-bridge-003",
      correlationId: "corr-bridge-003",
    });
    const body = JSON.stringify(payload);

    const server = await startWebhookServer();
    const address = server.address() as AddressInfo;
    const url = `http://127.0.0.1:${address.port}/api/auditapatron/complilink-webhook`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer return-webhook-secret-123456",
      },
      body,
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      received: false,
      responseContract: "auditapatron.bridge.ack.v1",
      issues: [
        {
          code: "internal_error",
        },
      ],
    });
    expect(dbMocks.updateCompliLinkWebhookEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 903,
        status: "failed_processing",
        failureReason: expect.stringContaining("storage unavailable"),
      }),
    );
  });

  it("rechaza payloads inválidos con issues[] y código 400", async () => {
    const server = await startWebhookServer();
    const address = server.address() as AddressInfo;
    const url = `http://127.0.0.1:${address.port}/api/auditapatron/complilink-webhook`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-auditapatron-token": "return-webhook-secret-123456",
      },
      body: JSON.stringify({
        documentId: "DOC-BRIDGE-001",
      }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      received: false,
      responseContract: "auditapatron.bridge.ack.v1",
      issues: [
        {
          code: "missing_field",
          field: "event",
        },
      ],
    });
    expect(dbMocks.registerCompliLinkWebhookEvent).not.toHaveBeenCalled();
  });

  it("expone el contrato interno de Helios con autenticación por bearer", async () => {
    const server = await startWebhookServer();
    const address = server.address() as AddressInfo;
    const url = `http://127.0.0.1:${address.port}/api/internal/helios/bridge/contract`;

    const response = await fetch(url, {
      headers: {
        Authorization: "Bearer return-webhook-secret-123456",
      },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: "ok",
      service: "complilink-auditapatron-bridge",
      endpoints: {
        contract: "/api/internal/helios/bridge/contract",
        heliosBridge: "/api/internal/helios/bridge",
        auditapatronBridge: "/api/integrations/auditapatron/bridge",
      },
      authentication: {
        sharedSecret: {
          acceptedHeaders: ["Authorization", "x-helios-token", "x-auditapatron-token"],
        },
      },
    });
  });

  it("acepta x-helios-token en el POST interno y si el payload es incompleto responde 400 en vez de 403", async () => {
    const server = await startWebhookServer();
    const address = server.address() as AddressInfo;
    const url = `http://127.0.0.1:${address.port}/api/internal/helios/bridge`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-helios-token": "return-webhook-secret-123456",
      },
      body: JSON.stringify({ documentId: "DOC-BRIDGE-001" }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      received: false,
      responseContract: "auditapatron.bridge.ack.v1",
      issues: [
        {
          code: "missing_field",
          field: "event",
        },
      ],
    });
  });

  it("acepta x-auditapatron-token en el POST de integración y si el payload es incompleto responde 400 en vez de 403", async () => {
    const server = await startWebhookServer();
    const address = server.address() as AddressInfo;
    const url = `http://127.0.0.1:${address.port}/api/integrations/auditapatron/bridge`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-auditapatron-token": "return-webhook-secret-123456",
      },
      body: JSON.stringify({ documentId: "DOC-BRIDGE-001" }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      received: false,
      responseContract: "auditapatron.bridge.ack.v1",
      issues: [
        {
          code: "missing_field",
          field: "event",
        },
      ],
    });
  });
});

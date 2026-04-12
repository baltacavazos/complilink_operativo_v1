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

  it("procesa solo una vez un mismo webhook firmado cuando llega duplicado", async () => {
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

    const payload = {
      event: "document.analysis.completed",
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
    };

    const body = JSON.stringify(payload);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = buildAuditaPatronEngineSignature(timestamp, body, "return-webhook-secret-123456");

    const server = await startWebhookServer();
    const address = server.address() as AddressInfo;
    const url = `http://127.0.0.1:${address.port}/api/auditapatron/complilink-webhook`;

    const firstResponse = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-AuditaPatron-Timestamp": timestamp,
        "X-AuditaPatron-Signature": signature,
      },
      body,
    });
    const secondResponse = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-AuditaPatron-Timestamp": timestamp,
        "X-AuditaPatron-Signature": signature,
      },
      body,
    });

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(200);

    await expect(firstResponse.json()).resolves.toMatchObject({
      success: true,
      event: "document.analysis.completed",
      documentId: "DOC-BRIDGE-001",
      correlationId: "corr-bridge-001",
    });
    await expect(secondResponse.json()).resolves.toMatchObject({
      success: true,
      duplicate: true,
      event: "document.analysis.completed",
      documentId: "DOC-BRIDGE-001",
      correlationId: "corr-bridge-001",
    });

    expect(dbMocks.registerCompliLinkWebhookEvent).toHaveBeenCalledTimes(2);
    expect(dbMocks.updateDocumentPostProcessing).toHaveBeenCalledTimes(1);
    expect(dbMocks.upsertCanonicalContract).toHaveBeenCalledTimes(1);
    expect(dbMocks.addCaseEvent).toHaveBeenCalledTimes(1);
    expect(dbMocks.createAuditLog).toHaveBeenCalledTimes(1);
    expect(dbMocks.updateCompliLinkWebhookEvent).toHaveBeenCalledTimes(1);
    expect(dbMocks.addOperationalAlert).not.toHaveBeenCalled();

    const firstInsert = dbMocks.registerCompliLinkWebhookEvent.mock.calls[0]?.[0];
    const secondInsert = dbMocks.registerCompliLinkWebhookEvent.mock.calls[1]?.[0];

    expect(firstInsert?.eventKey).toBeTruthy();
    expect(firstInsert?.eventKey).toBe(secondInsert?.eventKey);
    expect(firstInsert).toMatchObject({
      tenantId: "tenant-bridge",
      caseId: "CASE-BRIDGE-001",
      traceId: "trace.bridge.case-001",
      documentId: "DOC-BRIDGE-001",
      eventName: "document.analysis.completed",
      compliLinkId: "cmp-001",
      correlationId: "corr-bridge-001",
      sourceTimestamp: "2026-04-11T18:20:00.000Z",
      sourceSignature: signature,
      rawPayload: body,
      status: "processing",
    });
  });
});

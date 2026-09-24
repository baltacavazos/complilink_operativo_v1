import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildAuditaPatronEngineSignature } from "./auditaPatronIntegrationService";

const { dbMocks, emailMocks } = vi.hoisted(() => ({
  dbMocks: {
    addCaseEvent: vi.fn(),
    addOperationalAlert: vi.fn(),
    createAuditLog: vi.fn(),
    getUserById: vi.fn(),
    getDocumentById: vi.fn(),
    resolveCompliLinkDocument: vi.fn(),
    findLaborCaseByTraceOrId: vi.fn(),
    findLatestCaseDocument: vi.fn(),
    registerCompliLinkWebhookEvent: vi.fn(),
    upsertCanonicalContract: vi.fn(),
    updateCompliLinkWebhookEvent: vi.fn(),
    updateDocumentPostProcessing: vi.fn(),
    claimWhatsappNotificationDelivery: vi.fn(),
    releaseWhatsappNotificationDelivery: vi.fn(),
  },
  emailMocks: {
    sendEmailWithResend: vi.fn(),
  },
}));

vi.mock("./db", () => dbMocks);
vi.mock("./authService", () => emailMocks);
vi.mock("./_core/env", () => ({
  ENV: {
    auditapatronEngineHmacSecret: "return-webhook-secret-123456",
    auditapatronEngineWebhookUrl: "https://complilink.mx/api/auditapatron/webhook",
    resendApiKey: "resend-test-key",
    resendFromEmail: "avisos@auditapatron.com",
    whatsappNotifyEnabled: "",
    whatsappCloudAccessToken: "",
    whatsappCloudPhoneNumberId: "",
    whatsappTemplateName: "",
    whatsappTemplateLanguage: "es_MX",
  },
}));

import { ENV } from "./_core/env";
import {
  registerCompliLinkReturnWebhook,
  shouldReplayCompliLinkWebhookEvent,
} from "./auditaPatronReturnWebhook";

const serversToClose: Array<ReturnType<typeof createServer>> = [];
const realFetch = globalThis.fetch;

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

function officialObligation(source: "sat" | "imss" | "infonavit", resultado: "vivo" | "no_se_pudo", reason: string) {
  const live = resultado === "vivo";
  return {
    obligation: source,
    honesty: live ? "live" : "failed",
    status: live ? "vivo" : "failed",
    resultado,
    workerLabel: live ? "Hay respuesta oficial" : "Falló",
    workerReason: reason,
    checkedAt: "2026-09-21T18:00:00.000Z",
    missingFields: [],
    hechos: [reason],
  };
}

function buildOfficialCheckReturnContract() {
  const sat = officialObligation("sat", "vivo", "El SAT confirmó el RFC consultado.");
  const imss = officialObligation("imss", "no_se_pudo", "IMSS no respondió en esta consulta.");
  const infonavit = officialObligation("infonavit", "no_se_pudo", "Infonavit no respondió en esta consulta.");
  const officialCheck = {
    sat,
    imss,
    infonavit,
    chatAnchor: {
      sat: { fuente: "sat", estado: "live", resultado: "vivo", fecha: "2026-09-21T18:00:00.000Z", hechos: sat.hechos, motivoFallo: null },
      imss: { fuente: "imss", estado: "failed", resultado: "no_se_pudo", fecha: "2026-09-21T18:00:00.000Z", hechos: imss.hechos, motivoFallo: imss.workerReason },
      infonavit: { fuente: "infonavit", estado: "failed", resultado: "no_se_pudo", fecha: "2026-09-21T18:00:00.000Z", hechos: infonavit.hechos, motivoFallo: infonavit.workerReason },
    },
    nota: "SAT respondió. IMSS no se pudo consultar. Infonavit no se pudo consultar.",
  };

  return {
    contractVersion: "auditapatron_return_contract_v1",
    currentResponseEvent: {
      eventId: "clx-official-check-001",
      eventName: "document.processed.v1",
      correlationId: "trace.bridge.case-001",
      traceId: "trace.bridge.case-001",
      documentId: null,
      businessStatus: "accepted",
      emittedAt: "2026-09-21T18:05:00.000Z",
      result: {
        officialCheck,
        chatAnchor: officialCheck.chatAnchor,
        nota: officialCheck.nota,
        reciboVsOficial: null,
      },
    },
    canonicalExamples: {
      success: { eventName: "document.processed.v1", note: "ejemplo, no es esta consulta" },
    },
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
    const resolvedDocument = {
      id: 41,
      tenantId: "tenant-bridge",
      caseId: "CASE-BRIDGE-001",
      traceId: "trace.bridge.case-001",
      documentId: "DOC-BRIDGE-001",
      uploadedByUserId: 77,
      originalName: "contrato-individual.pdf",
      mimeType: "application/pdf",
      documentType: "contrato_laboral",
      classificationConfidence: 12,
      integrityStatus: "verified",
      consentStatus: "accepted",
    };
    dbMocks.getDocumentById.mockResolvedValue(resolvedDocument);
    dbMocks.getUserById.mockResolvedValue({
      id: 77,
      email: "persona@empresa.com",
      whatsappNotifyOptIn: false,
      whatsappPhoneE164: null,
    });
    dbMocks.claimWhatsappNotificationDelivery.mockResolvedValue("claimed");
    dbMocks.releaseWhatsappNotificationDelivery.mockResolvedValue(undefined);
    ENV.whatsappNotifyEnabled = "";
    ENV.whatsappCloudAccessToken = "";
    ENV.whatsappCloudPhoneNumberId = "";
    ENV.whatsappTemplateName = "";
    dbMocks.resolveCompliLinkDocument.mockResolvedValue(resolvedDocument);
    dbMocks.findLaborCaseByTraceOrId.mockResolvedValue(null);
    dbMocks.findLatestCaseDocument.mockResolvedValue(null);
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
      completeness: {
        phase: "fase_0",
        mode: "remote",
        webhookComplete: true,
        heliosApiKeyRequired: false,
        requiredPresent: {
          AUDITAPATRON_ENGINE_WEBHOOK_URL: true,
          AUDITAPATRON_ENGINE_HMAC_SECRET: true,
        },
      },
    });
  });

  it("acepta el webhook público firmado de document.uploaded y lo reenvía al bridge remoto configurado", async () => {
    const payload = buildIncomingUploadPayload();
    const body = JSON.stringify(payload);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = buildAuditaPatronEngineSignature(timestamp, body, "return-webhook-secret-123456");
    const upstreamFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          verified: true,
          received: true,
          responseContract: "auditapatron.bridge.ack.v1",
          processingStatus: "accepted",
        }),
        {
          status: 202,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      const requestUrl = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (requestUrl.startsWith("https://complilink.mx/")) {
        return upstreamFetch(input, init) as ReturnType<typeof fetch>;
      }
      return realFetch(input as Parameters<typeof fetch>[0], init as Parameters<typeof fetch>[1]);
    });

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
      forwarded: true,
      bridgeTarget: "https://complilink.mx/api/auditapatron/webhook",
      upstreamStatus: 202,
    });
    expect(upstreamFetch).toHaveBeenCalledTimes(1);
    expect(upstreamFetch).toHaveBeenCalledWith(
      "https://complilink.mx/api/auditapatron/webhook",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          "X-AuditaPatron-Timestamp": timestamp,
          "X-AuditaPatron-Signature": signature,
          "X-AuditaPatron-Forwarded-By": "auditapatron-intake",
        }),
        body,
      }),
    );
    expect(dbMocks.registerCompliLinkWebhookEvent).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("devuelve 502 si el bridge remoto rechaza el documento ya validado", async () => {
    const payload = buildIncomingUploadPayload();
    const body = JSON.stringify(payload);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = buildAuditaPatronEngineSignature(timestamp, body, "return-webhook-secret-123456");
    const upstreamFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ issues: [{ code: "bridge_busy" }] }), {
        status: 503,
        headers: {
          "Content-Type": "application/json",
        },
      }),
    );
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      const requestUrl = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (requestUrl.startsWith("https://complilink.mx/")) {
        return upstreamFetch(input, init) as ReturnType<typeof fetch>;
      }
      return realFetch(input as Parameters<typeof fetch>[0], init as Parameters<typeof fetch>[1]);
    });

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

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({
      verified: false,
      bridgeTarget: "https://complilink.mx/api/auditapatron/webhook",
      upstreamStatus: 503,
      responseContract: "auditapatron.bridge.ack.v1",
      issues: [
        {
          code: "bridge_forward_rejected",
          field: "event",
        },
      ],
    });
    fetchSpy.mockRestore();
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
    expect(emailMocks.sendEmailWithResend).not.toHaveBeenCalled();

    const firstInsert = dbMocks.registerCompliLinkWebhookEvent.mock.calls[0]?.[0];
    const secondInsert = dbMocks.registerCompliLinkWebhookEvent.mock.calls[1]?.[0];
    const genericAuditContract = dbMocks.upsertCanonicalContract.mock.calls[0]?.[0];
    const heliosAuditContract = dbMocks.upsertCanonicalContract.mock.calls[1]?.[0];

    expect(genericAuditContract).toMatchObject({
      contractType: "audit",
      schemaVersion: "v1",
      status: "ready",
    });
    const parsedReturnContract = JSON.parse(String(genericAuditContract?.payload ?? "{}"));
    expect(parsedReturnContract.live_check?.overallStatus).toBe("pendiente");
    expect(parsedReturnContract.live_check?.checks?.map((item: { sourceLabel: string; label: string }) => `${item.sourceLabel}: ${item.label}`)).toEqual([
      "IMSS: Pendiente",
      "SAT: Pendiente",
      "Infonavit: Pendiente",
    ]);
    expect(JSON.stringify(parsedReturnContract.live_check)).not.toMatch(/Helios|CompliLink|APIMarket|connector/i);
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

    expect(dbMocks.addCaseEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Documento revisado",
        description: expect.stringMatching(/IMSS: Pendiente/),
      }),
    );
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

  it("acepta document.processed.v1 firmado en /api/auditapatron/webhook", async () => {
    dbMocks.registerCompliLinkWebhookEvent.mockResolvedValue({
      created: true,
      event: {
        id: 910,
      },
    });

    const payload = buildReturnPayload({
      eventId: "evt-webhook-return-001",
      idempotencyKey: "evt-webhook-return-001",
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

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      received: true,
      documentId: "DOC-BRIDGE-001",
      processingStatus: "processed",
      responseContract: "auditapatron.bridge.ack.v1",
    });
    expect(dbMocks.registerCompliLinkWebhookEvent).toHaveBeenCalledTimes(1);
    expect(dbMocks.addCaseEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Documento revisado",
      }),
    );
  });

  it("rechaza un evento desconocido en ambos webhooks y no lo procesa", async () => {
    const payload = { event: "document.processed", documentId: "DOC-BRIDGE-001" };
    const body = JSON.stringify(payload);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = buildAuditaPatronEngineSignature(timestamp, body, "return-webhook-secret-123456");

    const server = await startWebhookServer();
    const address = server.address() as AddressInfo;

    const publicResponse = await fetch(`http://127.0.0.1:${address.port}/api/auditapatron/webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-AuditaPatron-Timestamp": timestamp,
        "X-AuditaPatron-Signature": signature,
      },
      body,
    });
    const returnResponse = await fetch(`http://127.0.0.1:${address.port}/api/auditapatron/complilink-webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer return-webhook-secret-123456",
      },
      body,
    });

    expect(publicResponse.status).toBe(400);
    expect(returnResponse.status).toBe(400);
    await expect(publicResponse.json()).resolves.toMatchObject({
      issues: [{ code: "unknown_event", field: "event" }],
    });
    await expect(returnResponse.json()).resolves.toMatchObject({
      issues: [{ code: "unknown_event", field: "event" }],
    });
    expect(dbMocks.registerCompliLinkWebhookEvent).not.toHaveBeenCalled();
  });

  it("acepta el contrato de retorno con SAT vivo e IMSS e Infonavit en no_se_pudo", async () => {
    dbMocks.registerCompliLinkWebhookEvent.mockResolvedValue({
      created: true,
      event: { id: 977 },
    });

    const payload = buildOfficialCheckReturnContract();
    const body = JSON.stringify(payload);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = buildAuditaPatronEngineSignature(timestamp, body, "return-webhook-secret-123456");
    const server = await startWebhookServer();
    const address = server.address() as AddressInfo;

    const bearerResponse = await fetch(`http://127.0.0.1:${address.port}/api/auditapatron/complilink-webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer return-webhook-secret-123456",
      },
      body,
    });
    const signedResponse = await fetch(`http://127.0.0.1:${address.port}/api/auditapatron/webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-AuditaPatron-Timestamp": timestamp,
        "X-AuditaPatron-Signature": signature,
      },
      body,
    });

    expect(bearerResponse.status).toBe(200);
    expect(signedResponse.status).toBe(200);
    await expect(bearerResponse.json()).resolves.toMatchObject({
      received: true,
      processingStatus: "processed",
      responseContract: "auditapatron.bridge.ack.v1",
    });

    const stored = JSON.parse(String(dbMocks.upsertCanonicalContract.mock.calls[0]?.[0]?.payload));
    const statusBySource = Object.fromEntries(
      (stored.live_check?.checks ?? []).map((item: { source: string; status: string }) => [item.source, item.status]),
    );
    expect(statusBySource).toEqual({
      imss: "no_se_pudo",
      sat: "vivo",
      infonavit: "no_se_pudo",
    });
    expect(stored.live_check.overallDetail).toMatch(/No significa que tu patrón cumple/);
    expect(dbMocks.resolveCompliLinkDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        correlationId: "trace.bridge.case-001",
        traceId: "trace.bridge.case-001",
      }),
    );
  });

  it("guarda el aviso en la bandeja y envía un solo correo para un hecho usable", async () => {
    dbMocks.registerCompliLinkWebhookEvent
      .mockResolvedValueOnce({
        created: true,
        event: { id: 978, status: "processing" },
      })
      .mockResolvedValueOnce({
        created: false,
        event: { id: 978, status: "processed" },
      });

    const body = JSON.stringify(buildOfficialCheckReturnContract());
    const server = await startWebhookServer();
    const address = server.address() as AddressInfo;
    const url = `http://127.0.0.1:${address.port}/api/auditapatron/complilink-webhook`;
    const request = () =>
      fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer return-webhook-secret-123456",
        },
        body,
      });

    const firstResponse = await request();
    const duplicateResponse = await request();

    expect(firstResponse.status).toBe(200);
    expect(duplicateResponse.status).toBe(200);
    expect(emailMocks.sendEmailWithResend).toHaveBeenCalledTimes(1);
    expect(emailMocks.sendEmailWithResend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ["persona@empresa.com"],
        subject: "Ya hay un resultado de tu consulta oficial",
      }),
    );

    const email = emailMocks.sendEmailWithResend.mock.calls[0]?.[0];
    const visibleEmailCopy = `${email?.subject ?? ""} ${email?.html ?? ""} ${email?.text ?? ""}`;
    expect(visibleEmailCopy).not.toMatch(
      /Resend|SendGrid|Helios|CompliLink|APIMarket|connector|provider|proveedor/i,
    );
    expect(visibleEmailCopy).not.toMatch(
      /tu patrón (sí )?cumple|confirmamos que cumple/i,
    );
    expect(visibleEmailCopy).toContain(
      "Este resultado no prueba por sí solo que tu patrón cumpla.",
    );

    expect(dbMocks.addCaseEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Ya hay un resultado de tu consulta oficial",
        description: expect.stringContaining(
          "Este resultado no prueba por sí solo que tu patrón cumpla.",
        ),
      }),
    );
    const eventMetadata = JSON.parse(
      String(dbMocks.addCaseEvent.mock.calls[0]?.[0]?.metadata),
    );
    expect(eventMetadata.notification_kind).toBe("official_fact_ready");
    expect(dbMocks.claimWhatsappNotificationDelivery).not.toHaveBeenCalled();
  });

  it("con opt-in y el canal encendido manda un solo WhatsApp si el webhook llega dos veces", async () => {
    ENV.whatsappNotifyEnabled = "true";
    ENV.whatsappCloudAccessToken = "test-token";
    ENV.whatsappCloudPhoneNumberId = "1099";
    ENV.whatsappTemplateName = "aviso_resultado_oficial";
    dbMocks.getUserById.mockResolvedValue({
      id: 77,
      email: "persona@empresa.com",
      whatsappNotifyOptIn: true,
      whatsappPhoneE164: "+525512345678",
    });
    dbMocks.registerCompliLinkWebhookEvent
      .mockResolvedValueOnce({
        created: true,
        event: { id: 979, status: "processing" },
      })
      .mockResolvedValueOnce({
        created: false,
        event: { id: 979, status: "processed" },
      });

    const graphBodies: string[] = [];
    globalThis.fetch = async (input, init) => {
      const url = String(input);
      if (url.includes("graph.facebook.com")) {
        graphBodies.push(String(init?.body ?? ""));
        return new Response("{}", { status: 200 });
      }
      return realFetch(input, init);
    };

    try {
      const body = JSON.stringify(buildOfficialCheckReturnContract());
      const server = await startWebhookServer();
      const address = server.address() as AddressInfo;
      const url = `http://127.0.0.1:${address.port}/api/auditapatron/complilink-webhook`;
      const request = () =>
        fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer return-webhook-secret-123456",
          },
          body,
        });

      const firstResponse = await request();
      const duplicateResponse = await request();

      expect(firstResponse.status).toBe(200);
      expect(duplicateResponse.status).toBe(200);
      expect(emailMocks.sendEmailWithResend).toHaveBeenCalledTimes(1);
      expect(graphBodies).toHaveLength(1);
      expect(dbMocks.claimWhatsappNotificationDelivery).toHaveBeenCalledTimes(1);
      const visible = graphBodies[0] ?? "";
      expect(visible).toContain("Ya hay un resultado de tu consulta oficial");
      expect(visible).toContain("tu caso");
      expect(visible).toContain("Este resultado no prueba por sí solo que tu patrón cumpla.");
      expect(visible).not.toMatch(
        /Resend|SendGrid|Helios|CompliLink|APIMarket|Syntage|proveedor/i,
      );
      expect(visible).not.toMatch(/tu patrón (sí )?cumple|confirmamos que cumple/i);
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  it("guarda el SAT vivo en el expediente cuando el retorno no trae documentId pero sí el trace", async () => {
    dbMocks.resolveCompliLinkDocument.mockResolvedValue(null);
    dbMocks.findLaborCaseByTraceOrId.mockResolvedValue({
      tenantId: "tenant-bridge",
      caseId: "CASE-BRIDGE-001",
      traceId: "trace.bridge.case-001",
      assignedUserId: 77,
    });

    const server = await startWebhookServer();
    const address = server.address() as AddressInfo;
    const response = await fetch(`http://127.0.0.1:${address.port}/api/auditapatron/complilink-webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer return-webhook-secret-123456",
      },
      body: JSON.stringify(buildOfficialCheckReturnContract()),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      received: true,
      processingStatus: "accepted",
      caseId: "CASE-BRIDGE-001",
    });
    expect(dbMocks.registerCompliLinkWebhookEvent).not.toHaveBeenCalled();
    const eventMetadata = JSON.parse(String(dbMocks.addCaseEvent.mock.calls[0]?.[0]?.metadata));
    expect(eventMetadata.live_check.checks.map((item: { source: string; status: string }) => `${item.source}:${item.status}`)).toEqual([
      "imss:no_se_pudo",
      "sat:vivo",
      "infonavit:no_se_pudo",
    ]);
    expect(eventMetadata.revalidation_scope).toBe("social_security");
    expect(eventMetadata.notification_kind).toBe("official_fact_ready");
    expect(emailMocks.sendEmailWithResend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ["persona@empresa.com"],
        subject: "Ya hay un resultado de tu consulta oficial",
      }),
    );
  });

  it("responde 200 al retorno de official_check aunque todavía no haya expediente local", async () => {
    dbMocks.resolveCompliLinkDocument.mockResolvedValue(null);

    const server = await startWebhookServer();
    const address = server.address() as AddressInfo;
    const response = await fetch(`http://127.0.0.1:${address.port}/api/auditapatron/complilink-webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer return-webhook-secret-123456",
      },
      body: JSON.stringify(buildOfficialCheckReturnContract()),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      received: true,
      processingStatus: "accepted",
      correlationId: "trace.bridge.case-001",
      remoteEventId: "clx-official-check-001",
    });
    expect(dbMocks.addCaseEvent).not.toHaveBeenCalled();
    expect(dbMocks.registerCompliLinkWebhookEvent).not.toHaveBeenCalled();
  });

  it("reprocesa de forma segura un evento failed_processing o processing estancado", async () => {
    dbMocks.registerCompliLinkWebhookEvent.mockResolvedValue({
      created: false,
      event: {
        id: 911,
        status: "failed_processing",
        createdAt: new Date("2026-04-11T18:00:00.000Z"),
      },
    });

    const payload = buildReturnPayload({
      eventId: "evt-bridge-replay-001",
      idempotencyKey: "evt-bridge-replay-001",
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

    expect(response.status).toBe(200);
    expect(dbMocks.updateCompliLinkWebhookEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 911,
        status: "processing",
        processedAt: null,
        failureReason: null,
      }),
    );
    expect(dbMocks.updateDocumentPostProcessing).toHaveBeenCalledTimes(1);
    expect(dbMocks.addCaseEvent).toHaveBeenCalledTimes(1);
    expect(dbMocks.updateCompliLinkWebhookEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 911,
        status: "processed",
      }),
    );
    expect(shouldReplayCompliLinkWebhookEvent({ status: "processed" })).toBe(false);
    expect(
      shouldReplayCompliLinkWebhookEvent({
        status: "processing",
        createdAt: new Date(Date.now() - 30_000),
      }),
    ).toBe(false);
    expect(
      shouldReplayCompliLinkWebhookEvent({
        status: "processing",
        createdAt: new Date(Date.now() - 3 * 60_000),
      }),
    ).toBe(true);
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

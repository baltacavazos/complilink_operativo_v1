import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({
  addCaseEvent: vi.fn(),
  addOperationalAlert: vi.fn(),
  createAuditLog: vi.fn(),
  findLaborCaseByTraceOrId: vi.fn(),
  findLatestCaseDocument: vi.fn(),
  getDocumentById: vi.fn(),
  resolveCompliLinkDocument: vi.fn(),
  updateCompliLinkWebhookEvent: vi.fn(),
  updateDocumentPostProcessing: vi.fn(),
  upsertCanonicalContract: vi.fn(),
}));

vi.mock("./_core/env", () => ({
  ENV: {
    auditapatronEngineHmacSecret: "return-webhook-secret-123456",
    auditapatronEngineWebhookUrl: "",
    resendApiKey: "",
    resendFromEmail: "",
    whatsappNotifyEnabled: "",
    whatsappCloudAccessToken: "",
    whatsappCloudPhoneNumberId: "",
    whatsappTemplateName: "",
    whatsappTemplateLanguage: "es_MX",
  },
}));

vi.mock("./authService", () => ({
  sendEmailWithResend: vi.fn(),
}));

vi.mock("./officialResultNotification", () => ({
  sendOfficialResultReadyEmail: vi.fn(),
  sendOfficialResultWhatsapp: vi.fn(),
}));

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    ...dbMocks,
  };
});

import { bindDatabaseForTests, resetDatabaseForTests } from "./db";
import { registerCompliLinkReturnWebhook } from "./auditaPatronReturnWebhook";

type StoredEvent = Record<string, unknown> & {
  id: number;
  eventKey: string;
  createdAt: Date;
  status: string;
};

function duplicateKeyError() {
  const cause = Object.assign(new Error("constraint violation"), {
    code: "ER_DUP_ENTRY",
    errno: 1062,
    sqlState: "23000",
  });
  const error = new Error("Failed query: insert into `complilink_webhook_events` (`eventKey`) values (?)");
  error.name = "DrizzleQueryError";
  error.cause = cause;
  return error;
}

function otherDatabaseError() {
  const cause = Object.assign(new Error("connection lost"), {
    code: "PROTOCOL_CONNECTION_LOST",
  });
  const error = new Error("Failed query: insert into `complilink_webhook_events` (`eventKey`) values (?)");
  error.name = "DrizzleQueryError";
  error.cause = cause;
  return error;
}

function createWebhookEventTable() {
  const rows = new Map<string, StoredEvent>();
  let nextId = 1;
  let chain = Promise.resolve();
  let lastKey: string | null = null;

  const db = {
    insert() {
      return {
        values(entry: { eventKey: string; status?: string }) {
          const run = chain.then(() => {
            lastKey = entry.eventKey;
            if (entry.eventKey === "event:fail-db") throw otherDatabaseError();
            if (rows.has(entry.eventKey)) throw duplicateKeyError();
            rows.set(entry.eventKey, {
              ...entry,
              id: nextId++,
              createdAt: new Date(),
              processedAt: null,
              failureReason: null,
              status: entry.status ?? "processing",
            });
          });
          chain = run.then(
            () => undefined,
            () => undefined,
          );
          return run;
        },
      };
    },
    select() {
      return {
        from() {
          return {
            where() {
              return {
                limit() {
                  const row = lastKey ? rows.get(lastKey) : undefined;
                  return Promise.resolve(row ? [row] : []);
                },
              };
            },
          };
        },
      };
    },
  };

  return { db, rows };
}

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

function buildReturnPayload(eventId: string) {
  return {
    event: "document.processed.v1",
    eventId,
    idempotencyKey: eventId,
    documentId: "DOC-BRIDGE-001",
    compliLinkId: "cmp-001",
    correlationId: "corr-bridge-001",
    status: "completed",
    timestamp: "2026-04-11T18:20:00.000Z",
    documentType: "contrato_laboral",
    confidenceScore: 87,
    metadata: {
      source: "bridge-test",
    },
  };
}

describe("webhook CompliLink idempotente", () => {
  let rows: Map<string, StoredEvent>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const table = createWebhookEventTable();
    rows = table.rows;
    bindDatabaseForTests(table.db);

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
    dbMocks.resolveCompliLinkDocument.mockResolvedValue(resolvedDocument);
    dbMocks.getDocumentById.mockResolvedValue(resolvedDocument);
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
    resetDatabaseForTests();
    errorSpy.mockRestore();
    await Promise.all(
      serversToClose.splice(0).map(
        (server) =>
          new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
          }),
      ),
    );
  });

  async function postEvent(eventId: string) {
    const server = await startWebhookServer();
    const address = server.address() as AddressInfo;
    const response = await fetch(`http://127.0.0.1:${address.port}/api/auditapatron/complilink-webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer return-webhook-secret-123456",
      },
      body: JSON.stringify(buildReturnPayload(eventId)),
    });
    const body = await response.json();
    return { response, body };
  }

  it("guarda la primera entrega", async () => {
    const { response, body } = await postEvent("evt-once");

    expect(response.status).toBe(200);
    expect(body.received).toBe(true);
    expect(body.alreadyReceived).toBeUndefined();
    expect(rows.size).toBe(1);
    expect(rows.get("event:evt-once")?.status).toBe("processing");
    expect(dbMocks.updateDocumentPostProcessing).toHaveBeenCalledTimes(1);
    expect(dbMocks.addCaseEvent).toHaveBeenCalledTimes(1);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("responde 200 alreadyReceived al duplicado y deja un solo registro", async () => {
    const first = await postEvent("evt-dup");
    expect(first.response.status).toBe(200);
    expect(rows.size).toBe(1);
    const sideEffects = {
      documents: dbMocks.updateDocumentPostProcessing.mock.calls.length,
      events: dbMocks.addCaseEvent.mock.calls.length,
      contracts: dbMocks.upsertCanonicalContract.mock.calls.length,
      audits: dbMocks.createAuditLog.mock.calls.length,
    };

    const duplicate = await postEvent("evt-dup");

    expect(duplicate.response.status).toBe(200);
    expect(duplicate.body).toMatchObject({
      ok: true,
      alreadyReceived: true,
      received: true,
    });
    expect(rows.size).toBe(1);
    expect(dbMocks.updateDocumentPostProcessing).toHaveBeenCalledTimes(sideEffects.documents);
    expect(dbMocks.addCaseEvent).toHaveBeenCalledTimes(sideEffects.events);
    expect(dbMocks.upsertCanonicalContract).toHaveBeenCalledTimes(sideEffects.contracts);
    expect(dbMocks.createAuditLog).toHaveBeenCalledTimes(sideEffects.audits);
    expect(dbMocks.updateCompliLinkWebhookEvent).toHaveBeenCalledTimes(1);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("acepta dos entregas idénticas a la vez con 2xx y un solo registro", async () => {
    const server = await startWebhookServer();
    const address = server.address() as AddressInfo;
    const url = `http://127.0.0.1:${address.port}/api/auditapatron/complilink-webhook`;
    const payload = JSON.stringify(buildReturnPayload("evt-race"));
    const request = () =>
      fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer return-webhook-secret-123456",
        },
        body: payload,
      });

    const [left, right] = await Promise.all([request(), request()]);
    const leftBody = await left.json();
    const rightBody = await right.json();

    expect(left.status).toBeGreaterThanOrEqual(200);
    expect(left.status).toBeLessThan(300);
    expect(right.status).toBeGreaterThanOrEqual(200);
    expect(right.status).toBeLessThan(300);
    expect(rows.size).toBe(1);
    const already = [leftBody, rightBody].filter((body) => body.alreadyReceived === true);
    const fresh = [leftBody, rightBody].filter((body) => body.alreadyReceived !== true);
    expect(already).toHaveLength(1);
    expect(fresh).toHaveLength(1);
    expect(already[0]).toMatchObject({ ok: true, alreadyReceived: true });
    expect(dbMocks.updateDocumentPostProcessing).toHaveBeenCalledTimes(1);
    expect(dbMocks.addCaseEvent).toHaveBeenCalledTimes(1);
    expect(dbMocks.createAuditLog).toHaveBeenCalledTimes(1);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("mantiene 403 si la firma no sirve y 400 si el payload está incompleto", async () => {
    const server = await startWebhookServer();
    const address = server.address() as AddressInfo;
    const url = `http://127.0.0.1:${address.port}/api/auditapatron/complilink-webhook`;

    const unauthorized = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildReturnPayload("evt-auth")),
    });
    const malformed = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer return-webhook-secret-123456",
      },
      body: JSON.stringify({ documentId: "DOC-BRIDGE-001" }),
    });

    expect(unauthorized.status).toBe(403);
    expect(malformed.status).toBe(400);
    expect(rows.size).toBe(0);
    expect(dbMocks.updateDocumentPostProcessing).not.toHaveBeenCalled();
  });

  it("sigue respondiendo 500 cuando la base falla por algo distinto a la llave duplicada", async () => {
    const { response, body } = await postEvent("fail-db");

    expect(response.status).toBe(500);
    expect(body).toMatchObject({
      received: false,
      issues: [expect.objectContaining({ code: "internal_error" })],
    });
    expect(JSON.stringify(body)).not.toMatch(/ER_|Failed query|Duplicate entry/i);
    expect(rows.size).toBe(0);
    expect(dbMocks.updateDocumentPostProcessing).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();
  });
});

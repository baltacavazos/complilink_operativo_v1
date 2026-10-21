import { createHmac } from "node:crypto";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const secrets = vi.hoisted(() => ({
  current: "current-bridge-hmac-placeholder",
  previous: "previous-bridge-hmac-placeholder",
  foreign: "foreign-bridge-hmac-placeholder",
}));

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
    auditapatronEngineHmacSecret: secrets.current,
    auditapatronEngineHmacSecretPrevious: secrets.previous,
    auditapatronEngineWebhookUrl: "https://complilink.mx/api/integrations/auditapatron/bridge",
    cookieSecret: "cookie-secret-placeholder",
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
import { readEngineBridgeConfig } from "./governmentLiveCheck";
import { createGuestPreviewToken, readGuestPreviewToken } from "./heliosPublicExperience";
import {
  buildAuditaPatronEngineSignature,
  buildSignedEngineHeaders,
  getAuditaPatronEngineConfig,
} from "./auditaPatronIntegrationService";
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
    metadata: { source: "bridge-test" },
  };
}

function previewFixture() {
  return {
    guestPreviewId: "guest-rotation",
    traceId: "trace-rotation",
    createdAt: new Date().toISOString(),
    fileName: "recibo.pdf",
    mimeType: "application/pdf",
    sizeBytes: 12,
    sha256: "abc",
    storageKey: "key",
    storageUrl: "https://example.test/file",
    expectedDocumentType: null,
    captureMode: null,
    sourceChannel: "manual" as const,
    classification: {} as never,
    preliminaryAnalysis: {} as never,
    scanAssistance: null,
    previewOpinion: {} as never,
  };
}

describe("ventana de doble secreto del puente", () => {
  let rows: Map<string, StoredEvent>;
  let baseUrl: string;

  beforeEach(async () => {
    vi.clearAllMocks();
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

    const server = await startWebhookServer();
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    resetDatabaseForTests();
    await Promise.all(
      serversToClose.splice(0).map(
        (server) =>
          new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
          }),
      ),
    );
  });

  async function postWebhook(path: string, headers: Record<string, string>, body: string) {
    const response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body,
    });
    const json = await response.json();
    return { response, json };
  }

  it("acepta el secreto actual y el previo en Bearer, x-auditapatron-token y x-helios-token", async () => {
    const contract = `${baseUrl}/api/internal/helios/bridge/contract`;
    for (const headers of [
      { Authorization: `Bearer ${secrets.current}` },
      { Authorization: `Bearer ${secrets.previous}` },
      { "x-auditapatron-token": secrets.previous },
      { "x-helios-token": secrets.current },
    ]) {
      const response = await fetch(contract, { headers });
      expect(response.status).toBe(200);
    }
  });

  it("responde 403 con un secreto ajeno y no acepta x-bridge-token ni x-api-key", async () => {
    const contract = `${baseUrl}/api/internal/helios/bridge/contract`;
    const foreign = await fetch(contract, { headers: { Authorization: `Bearer ${secrets.foreign}` } });
    const bridgeHeader = await fetch(contract, { headers: { "x-bridge-token": secrets.current } });
    const apiKey = await fetch(contract, { headers: { "x-api-key": secrets.current } });
    expect(foreign.status).toBe(403);
    expect(bridgeHeader.status).toBe(403);
    expect(apiKey.status).toBe(403);
  });

  it("acepta la firma con timestamp del actual y del previo, y rechaza la ajena y la de solo cuerpo", async () => {
    const path = "/api/auditapatron/complilink-webhook";
    const body = JSON.stringify({ documentId: "DOC-BRIDGE-001" });
    const timestamp = Math.floor(Date.now() / 1000).toString();

    const current = await postWebhook(
      path,
      {
        "X-AuditaPatron-Timestamp": timestamp,
        "X-AuditaPatron-Signature": buildAuditaPatronEngineSignature(timestamp, body, secrets.current),
      },
      body,
    );
    const previous = await postWebhook(
      path,
      {
        "X-AuditaPatron-Timestamp": timestamp,
        "X-AuditaPatron-Signature": buildAuditaPatronEngineSignature(timestamp, body, secrets.previous),
      },
      body,
    );
    const foreign = await postWebhook(
      path,
      {
        "X-AuditaPatron-Timestamp": timestamp,
        "X-AuditaPatron-Signature": buildAuditaPatronEngineSignature(timestamp, body, secrets.foreign),
      },
      body,
    );
    const legacy = await postWebhook(
      path,
      {
        "X-AuditaPatron-Signature": createHmac("sha256", secrets.current).update(body).digest("hex"),
      },
      body,
    );

    expect(current.response.status).toBe(400);
    expect(previous.response.status).toBe(400);
    expect(foreign.response.status).toBe(403);
    expect(legacy.response.status).toBe(403);
    expect(JSON.stringify(legacy.json)).toContain("missing_signature");
    expect(rows.size).toBe(0);
  });

  it("firma lo saliente solo con el secreto actual", () => {
    const config = getAuditaPatronEngineConfig();
    expect(config.hmacSecret).toBe(secrets.current);
    const body = '{"ok":true}';
    const timestamp = "1710000000";
    const headers = buildSignedEngineHeaders({ timestamp, body, hmacSecret: config.hmacSecret });
    expect(headers.Authorization).toBe(`Bearer ${secrets.current}`);
    expect(headers["X-AuditaPatron-Signature"]).toBe(
      buildAuditaPatronEngineSignature(timestamp, body, secrets.current),
    );
    expect(headers["X-AuditaPatron-Signature"]).not.toBe(
      buildAuditaPatronEngineSignature(timestamp, body, secrets.previous),
    );
    expect(
      readEngineBridgeConfig({
        AUDITAPATRON_ENGINE_WEBHOOK_URL: "https://complilink.mx/api/integrations/auditapatron/bridge",
        AUDITAPATRON_ENGINE_HMAC_SECRET: secrets.current,
        AUDITAPATRON_ENGINE_HMAC_SECRET_PREVIOUS: secrets.previous,
      }).hmacSecret,
    ).toBe(secrets.current);
  });

  it("valida vistas previas con el secreto previo y las firma con el actual", () => {
    const token = createGuestPreviewToken(previewFixture());
    const [encoded, signature] = token.split(".");
    const signedWith = (secret: string) => createHmac("sha256", secret).update(encoded).digest("base64url");

    expect(signature).toBe(signedWith(secrets.current));
    expect(signature).not.toBe(signedWith(secrets.previous));
    expect(readGuestPreviewToken(token).guestPreviewId).toBe("guest-rotation");
    expect(readGuestPreviewToken(`${encoded}.${signedWith(secrets.previous)}`).guestPreviewId).toBe("guest-rotation");
    expect(() => readGuestPreviewToken(`${encoded}.${signedWith(secrets.foreign)}`)).toThrow(/validación de seguridad/);
  });

  it("no rompe la idempotencia si el duplicado llega con el secreto previo", async () => {
    const body = JSON.stringify(buildReturnPayload("evt-rotation-dup"));
    const first = await postWebhook(
      "/api/auditapatron/complilink-webhook",
      { Authorization: `Bearer ${secrets.current}` },
      body,
    );
    const duplicate = await postWebhook(
      "/api/auditapatron/complilink-webhook",
      { Authorization: `Bearer ${secrets.previous}` },
      body,
    );

    expect(first.response.status).toBe(200);
    expect(first.json.alreadyReceived).toBeUndefined();
    expect(duplicate.response.status).toBe(200);
    expect(duplicate.json).toMatchObject({ ok: true, alreadyReceived: true, received: true });
    expect(rows.size).toBe(1);
    expect(dbMocks.updateDocumentPostProcessing).toHaveBeenCalledTimes(1);
  });
});

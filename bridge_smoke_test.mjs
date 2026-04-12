import { appendFileSync, writeFileSync } from 'node:fs';
import { createHmac } from 'node:crypto';

const baseUrl = (process.argv[2] || process.env.BRIDGE_SMOKE_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const runMode = process.argv[3] || 'manual';
const secret = process.env.AUDITAPATRON_ENGINE_HMAC_SECRET;
const resultPath = '/home/ubuntu/complilink_operativo_v1/bridge_smoke_test_results.json';
const historyPath = '/home/ubuntu/complilink_operativo_v1/bridge_smoke_test_history.jsonl';

if (!secret) {
  throw new Error('Missing AUDITAPATRON_ENGINE_HMAC_SECRET environment variable');
}

const timestamp = Math.floor(Date.now() / 1000).toString();
const payload = {
  event: 'document.uploaded',
  documentId: 'SMOKE-DOC-001',
  sourceUserId: 'SMOKE-USER-001',
  docType: 'recibo_nomina',
  fileUrl: 'https://example.com/smoke-document.pdf',
  sha256: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  mimeType: 'application/pdf',
  uploadedAt: '2026-04-11T18:20:00.000Z',
};
const body = JSON.stringify(payload);
const signature = createHmac('sha256', secret).update(`${timestamp}.${body}`, 'utf8').digest('hex');

async function parseResponseJson(response) {
  const raw = await response.text();

  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return { raw };
  }
}

function persistSummary(summary) {
  writeFileSync(resultPath, `${JSON.stringify(summary, null, 2)}\n`);
  appendFileSync(historyPath, `${JSON.stringify(summary)}\n`);
  console.log(JSON.stringify(summary, null, 2));
}

const summary = {
  testedAt: new Date().toISOString(),
  baseUrl,
  runMode,
  health: {
    status: null,
    body: null,
  },
  webhook: {
    status: null,
    body: null,
  },
  contractCheck: {
    expectedHealthStatus: 200,
    expectedWebhookStatus: 202,
    expectedContract: 'auditapatron.bridge.ack.v1',
    passed: false,
  },
  error: null,
};

try {
  const healthResponse = await fetch(`${baseUrl}/api/auditapatron/health`);
  const healthJson = await parseResponseJson(healthResponse);
  summary.health = {
    status: healthResponse.status,
    body: healthJson,
  };

  const webhookResponse = await fetch(`${baseUrl}/api/auditapatron/webhook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-AuditaPatron-Timestamp': timestamp,
      'X-AuditaPatron-Signature': signature,
    },
    body,
  });
  const webhookJson = await parseResponseJson(webhookResponse);
  summary.webhook = {
    status: webhookResponse.status,
    body: webhookJson,
  };

  summary.contractCheck.passed =
    healthResponse.status === 200 &&
    webhookResponse.status === 202 &&
    healthJson?.responseContract === 'auditapatron.bridge.ack.v1' &&
    webhookJson?.responseContract === 'auditapatron.bridge.ack.v1' &&
    webhookJson?.verified === true &&
    webhookJson?.event === 'document.uploaded';
} catch (error) {
  summary.error = error instanceof Error ? error.message : String(error);
}

persistSummary(summary);

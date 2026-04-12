import { createHmac } from 'node:crypto';
import { writeFileSync } from 'node:fs';

const baseUrl = process.argv[2];
const secret = process.env.AUDITAPATRON_ENGINE_HMAC_SECRET;

if (!baseUrl) {
  throw new Error('Missing base URL argument');
}

if (!secret) {
  throw new Error('Missing AUDITAPATRON_ENGINE_HMAC_SECRET environment variable');
}

const normalizedBaseUrl = baseUrl.replace(/\/$/, '');
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

const healthResponse = await fetch(`${normalizedBaseUrl}/api/auditapatron/health`);
const healthJson = await healthResponse.json();

const webhookResponse = await fetch(`${normalizedBaseUrl}/api/auditapatron/webhook`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-AuditaPatron-Timestamp': timestamp,
    'X-AuditaPatron-Signature': signature,
  },
  body,
});
const webhookJson = await webhookResponse.json();

const summary = {
  testedAt: new Date().toISOString(),
  baseUrl: normalizedBaseUrl,
  health: {
    status: healthResponse.status,
    body: healthJson,
  },
  webhook: {
    status: webhookResponse.status,
    body: webhookJson,
  },
  contractCheck: {
    expectedHealthStatus: 200,
    expectedWebhookStatus: 202,
    expectedContract: 'auditapatron.bridge.ack.v1',
    passed:
      healthResponse.status === 200 &&
      webhookResponse.status === 202 &&
      healthJson?.responseContract === 'auditapatron.bridge.ack.v1' &&
      webhookJson?.responseContract === 'auditapatron.bridge.ack.v1' &&
      webhookJson?.verified === true &&
      webhookJson?.event === 'document.uploaded',
  },
};

writeFileSync('/home/ubuntu/complilink_operativo_v1/bridge_smoke_test_results.json', `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify(summary, null, 2));

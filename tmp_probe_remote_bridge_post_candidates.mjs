import fs from 'node:fs';
import crypto from 'node:crypto';

const sourcePath = '/home/ubuntu/complilink_operativo_v1/tmp_revalidate_jaime_case_output.json';
const outputPath = '/home/ubuntu/complilink_operativo_v1/tmp_probe_remote_bridge_post_candidates_output.json';
const secret = process.env.AUDITAPATRON_ENGINE_HMAC_SECRET;

if (!secret) {
  throw new Error('Missing AUDITAPATRON_ENGINE_HMAC_SECRET');
}

function findDispatchPayload(value) {
  if (!value || typeof value !== 'object') return null;
  if (
    !Array.isArray(value) &&
    typeof value.providerId === 'number' &&
    typeof value.userId === 'number' &&
    typeof value.documentId === 'string' &&
    value.eventName === 'document.uploaded'
  ) {
    return value;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findDispatchPayload(item);
      if (found) return found;
    }
    return null;
  }
  for (const nested of Object.values(value)) {
    const found = findDispatchPayload(nested);
    if (found) return found;
  }
  return null;
}

const raw = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
const payload = findDispatchPayload(raw);
if (!payload) throw new Error('Dispatch payload not found');

const body = JSON.stringify(payload);
const timestamp = Math.floor(Date.now() / 1000).toString();
const signature = crypto.createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');

const candidates = [
  { url: 'https://complilink.mx/api/auditapatron/webhook', auth: 'signature' },
  { url: 'https://complilink.mx/api/auditapatron/webhook', auth: 'bearer' },
  { url: 'https://complilink.mx/api/integrations/auditapatron/bridge', auth: 'signature' },
  { url: 'https://complilink.mx/api/integrations/auditapatron/bridge', auth: 'bearer' },
  { url: 'https://complilink.mx/api/internal/helios/bridge', auth: 'signature' },
  { url: 'https://complilink.mx/api/internal/helios/bridge', auth: 'bearer' },
];

const results = [];
for (const candidate of candidates) {
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
  if (candidate.auth === 'signature') {
    headers['X-AuditaPatron-Timestamp'] = timestamp;
    headers['X-AuditaPatron-Signature'] = signature;
  }
  if (candidate.auth === 'bearer') {
    headers['Authorization'] = `Bearer ${secret}`;
  }
  try {
    const response = await fetch(candidate.url, {
      method: 'POST',
      headers,
      body,
      redirect: 'manual',
    });
    const responseBody = await response.text();
    results.push({
      ...candidate,
      status: response.status,
      contentType: response.headers.get('content-type'),
      location: response.headers.get('location'),
      bodySnippet: responseBody.slice(0, 500),
    });
  } catch (error) {
    results.push({
      ...candidate,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

fs.writeFileSync(outputPath, JSON.stringify({ executedAt: new Date().toISOString(), timestamp, payloadSummary: {
  documentId: payload.documentId,
  category: payload.category,
  eventName: payload.eventName,
  correlationId: payload.correlationId,
}, results }, null, 2));
console.log(outputPath);

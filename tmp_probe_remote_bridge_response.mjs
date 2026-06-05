import fs from 'node:fs';
import crypto from 'node:crypto';

const sourcePath = '/home/ubuntu/complilink_operativo_v1/tmp_revalidate_jaime_case_output.json';
const outputPath = '/home/ubuntu/complilink_operativo_v1/tmp_probe_remote_bridge_response_output.json';
const configuredUrl = process.env.AUDITAPATRON_ENGINE_WEBHOOK_URL;
const hmacSecret = process.env.AUDITAPATRON_ENGINE_HMAC_SECRET;

if (!configuredUrl || !hmacSecret) {
  throw new Error('Missing AUDITAPATRON_ENGINE_WEBHOOK_URL or AUDITAPATRON_ENGINE_HMAC_SECRET');
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
if (!payload) {
  throw new Error('Could not find a real dispatch payload in tmp_revalidate_jaime_case_output.json');
}

const canonicalUrl = new URL(configuredUrl);
if (canonicalUrl.hostname.startsWith('www.')) {
  canonicalUrl.hostname = canonicalUrl.hostname.replace(/^www\./, '');
}

const body = JSON.stringify(payload);
const timestamp = Math.floor(Date.now() / 1000).toString();
const signature = crypto.createHmac('sha256', hmacSecret).update(`${timestamp}.${body}`).digest('hex');

const response = await fetch(canonicalUrl.toString(), {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'X-AuditaPatron-Timestamp': timestamp,
    'X-AuditaPatron-Signature': signature,
  },
  body,
});

const responseText = await response.text();
const output = {
  executedAt: new Date().toISOString(),
  targetUrl: canonicalUrl.toString(),
  request: {
    timestamp,
    signature,
    payload,
  },
  response: {
    status: response.status,
    headers: Object.fromEntries(response.headers.entries()),
    body: responseText,
  },
};
fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
console.log(outputPath);

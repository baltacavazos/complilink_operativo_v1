import fs from 'node:fs';

const sourcePath = '/home/ubuntu/complilink_operativo_v1/tmp_revalidate_jaime_case_output.json';
const outputPath = '/home/ubuntu/complilink_operativo_v1/tmp_probe_remote_bridge_adapter_variants_output.json';
const secret = process.env.AUDITAPATRON_ENGINE_HMAC_SECRET;
if (!secret) throw new Error('Missing AUDITAPATRON_ENGINE_HMAC_SECRET');

function findDispatchPayloads(value, found = []) {
  if (!value || typeof value !== 'object') return found;
  if (
    !Array.isArray(value) &&
    typeof value.providerId === 'number' &&
    typeof value.userId === 'number' &&
    typeof value.documentId === 'string' &&
    value.eventName === 'document.uploaded'
  ) {
    found.push(value);
    return found;
  }
  if (Array.isArray(value)) {
    for (const item of value) findDispatchPayloads(item, found);
    return found;
  }
  for (const nested of Object.values(value)) findDispatchPayloads(nested, found);
  return found;
}

const raw = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
const payloads = findDispatchPayloads(raw);
if (payloads.length === 0) throw new Error('No payloads found');

const variants = [];
for (const payload of payloads) {
  const isContract = String(payload.category).includes('contrato') || String(payload.title).includes('contrato');
  const documentIdsToTry = isContract ? [300002, 300001] : [300001, 300002];
  const categoriesToTry = isContract ? ['contract', 'other'] : ['other', 'contract'];
  const statusesToTry = ['received', 'pending'];

  for (const numericDocumentId of documentIdsToTry) {
    for (const mappedCategory of categoriesToTry) {
      for (const mappedStatus of statusesToTry) {
        variants.push({
          sourceDocumentId: payload.documentId,
          numericDocumentId,
          mappedCategory,
          mappedStatus,
          payload: {
            ...payload,
            documentId: numericDocumentId,
            category: mappedCategory,
            processingStatus: mappedStatus,
          },
        });
      }
    }
  }
}

const results = [];
for (const variant of variants) {
  try {
    const response = await fetch('https://complilink.mx/api/integrations/auditapatron/bridge', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${secret}`,
      },
      body: JSON.stringify(variant.payload),
      redirect: 'manual',
    });
    const responseBody = await response.text();
    results.push({
      sourceDocumentId: variant.sourceDocumentId,
      numericDocumentId: variant.numericDocumentId,
      mappedCategory: variant.mappedCategory,
      mappedStatus: variant.mappedStatus,
      status: response.status,
      contentType: response.headers.get('content-type'),
      bodySnippet: responseBody.slice(0, 500),
    });
  } catch (error) {
    results.push({
      sourceDocumentId: variant.sourceDocumentId,
      numericDocumentId: variant.numericDocumentId,
      mappedCategory: variant.mappedCategory,
      mappedStatus: variant.mappedStatus,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

fs.writeFileSync(outputPath, JSON.stringify({ executedAt: new Date().toISOString(), results }, null, 2));
console.log(outputPath);

const secret = process.env.AUDITAPATRON_ENGINE_HMAC_SECRET;
if (!secret) throw new Error('Missing AUDITAPATRON_ENGINE_HMAC_SECRET');

const basePayloads = [
  {
    source: 'cfdi',
    providerId: 1,
    userId: 1,
    documentId: 300001,
    title: 'cfdi_nomina',
    mimeType: 'application/xml',
    fileUrl: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663473809458/cGpJC3DAdnBiVVBEKZfqbd/complilink/balt-1/CASE-BALT-1-MPQ5YBNG/DOC-E5AD0B07DEA847AE/1F870DC0-BDF0-5227-A698-907D55E15F69_JAIME_SANTIAGO_LOPEZ.xml',
    category: 'other',
    originalFileName: '1F870DC0-BDF0-5227-A698-907D55E15F69_JAIME_SANTIAGO_LOPEZ.xml',
    sourceModule: 'complilink_operativo',
    sourceCaseId: 'CASE-BALT-1-MPQ5YBNG',
    sourceDocumentId: 'DOC-E5AD0B07DEA847AE',
    uploadedAt: '2026-05-29T00:08:11.000Z',
    traceId: 'trace.balt-1.CASE-BALT-1-MPQ5YBNG.mpq5ybngh1h91v',
    processingStatus: 'received',
    eventName: 'document.uploaded',
    eventId: '173d1deb-e99d-4c82-9050-242e4b43286d',
    idempotencyKey: '173d1deb-e99d-4c82-9050-242e4b43286d',
    correlationId: '9d950b8e-475c-4506-a422-59156315c061',
  },
  {
    source: 'contract',
    providerId: 1,
    userId: 1,
    documentId: 300002,
    title: 'contrato_laboral',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    fileUrl: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663473809458/cGpJC3DAdnBiVVBEKZfqbd/complilink/balt-1/CASE-BALT-1-MPQ5YBNG/DOC-D04249F1446D472A/CONTRATOINDETERMINADO-SANTIAGOLOPEZJAIME.docx',
    category: 'contract',
    originalFileName: 'CONTRATOINDETERMINADO-SANTIAGOLOPEZJAIME.docx',
    sourceModule: 'complilink_operativo',
    sourceCaseId: 'CASE-BALT-1-MPQ5YBNG',
    sourceDocumentId: 'DOC-D04249F1446D472A',
    uploadedAt: '2026-05-29T00:08:18.000Z',
    traceId: 'trace.balt-1.CASE-BALT-1-MPQ5YBNG.mpq5ybngh1h91v',
    processingStatus: 'received',
    eventName: 'document.uploaded',
    eventId: 'ce76aee2-2731-45f5-a7d1-d769a872b2db',
    idempotencyKey: 'ce76aee2-2731-45f5-a7d1-d769a872b2db',
    correlationId: '7053b2d4-1911-4564-89ed-244eaf633307',
  },
];

const providerIds = [1, 101, 300001, 300002];
const userIds = [1, 101, 300001, 300002];
const results = [];

for (const base of basePayloads) {
  for (const providerId of providerIds) {
    for (const userId of userIds) {
      const payload = { ...base, providerId, userId };
      try {
        const response = await fetch('https://complilink.mx/api/integrations/auditapatron/bridge', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': `Bearer ${secret}`,
          },
          body: JSON.stringify(payload),
          redirect: 'manual',
        });
        const body = await response.text();
        results.push({
          source: base.source,
          providerId,
          userId,
          status: response.status,
          contentType: response.headers.get('content-type'),
          bodySnippet: body.slice(0, 300),
        });
      } catch (error) {
        results.push({
          source: base.source,
          providerId,
          userId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
}

const outputPath = '/home/ubuntu/complilink_operativo_v1/tmp_probe_remote_bridge_provider_ids_output.json';
await import('node:fs').then(({ writeFileSync }) => writeFileSync(outputPath, JSON.stringify({ executedAt: new Date().toISOString(), results }, null, 2)));
console.log(outputPath);

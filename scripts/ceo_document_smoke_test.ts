import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { basename, extname } from 'node:path';
import { appRouter } from '../server/routers';

const tenantId = 'balt-1';
const ownerUser = {
  id: 1,
  openId: 'S8ApRqTbJj4mEpPnubsWbo',
  name: 'balt',
  email: 'balt@cavazos.com',
  loginMethod: 'manus',
  role: 'admin' as const,
  createdAt: new Date('2026-04-05T23:31:37.000Z'),
  updatedAt: new Date('2026-05-06T22:43:57.000Z'),
  lastSignedIn: new Date('2026-05-06T22:43:58.000Z'),
};

const req = {
  headers: {
    origin: 'https://3000-ifwslt4380ij879g0ghvu-446467cd.us2.manus.computer',
    'user-agent': 'Manus CEO document smoke test',
    host: '3000-ifwslt4380ij879g0ghvu-446467cd.us2.manus.computer',
  },
  socket: {
    remoteAddress: '127.0.0.1',
  },
} as any;

const res = {
  setHeader() {},
  getHeader() { return undefined; },
  clearCookie() {},
  cookie() {},
} as any;

const caller = appRouter.createCaller({ req, res, user: ownerUser });

const documents = [
  {
    workerKey: 'alma',
    workerName: 'ALMA GABRIELA GOMEZ RUIZ',
    title: 'CEO smoke · Alma Gabriela Gomez Ruiz',
    summary: 'Prueba funcional del sistema con CFDI, PDF y contrato laboral de Alma Gabriela Gomez Ruiz.',
    files: [
      '/home/ubuntu/upload/B022F1A1-41DB-5595-8ADD-9D39AAE96640_ALMA_GABRIELA_GOMEZ_RUIZ.xml',
      '/home/ubuntu/upload/B022F1A1-41DB-5595-8ADD-9D39AAE96640_ALMA_GABRIELA_GOMEZ_RUIZ.pdf',
      '/home/ubuntu/upload/CONTRATOINDETERMINADO-GOMEZRUIZALMAGABRIELA.docx',
    ],
  },
  {
    workerKey: 'hector',
    workerName: 'HECTOR JOVANE ORTIZ HERNANDEZ',
    title: 'CEO smoke · Hector Jovane Ortiz Hernandez',
    summary: 'Prueba funcional del sistema con CFDI, PDF y contrato laboral de Hector Jovane Ortiz Hernandez.',
    files: [
      '/home/ubuntu/upload/CCCB2850-BD58-503B-ABDA-4A91F201B716_HECTOR_JOVANE_ORTIZ_HERNANDEZ.xml',
      '/home/ubuntu/upload/CCCB2850-BD58-503B-ABDA-4A91F201B716_HECTOR_JOVANE_ORTIZ_HERNANDEZ.pdf',
      '/home/ubuntu/upload/CONTRATOINDETERMINADO-ORTIZHERNANDEZHECTORJOVANE.docx',
    ],
  },
];

function inferMimeType(filePath: string) {
  const extension = extname(filePath).toLowerCase();
  if (extension === '.xml') return 'application/xml';
  if (extension === '.pdf') return 'application/pdf';
  if (extension === '.docx') {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }
  return 'application/octet-stream';
}

function encodeFile(filePath: string, mimeType: string) {
  const binary = readFileSync(filePath);
  return `data:${mimeType};base64,${binary.toString('base64')}`;
}

function pickUploadSummary(result: any) {
  return {
    documentId: result.document?.documentId ?? null,
    fileName: result.document?.fileName ?? result.previewAsset?.fileName ?? null,
    documentType: result.classification?.documentType ?? null,
    classificationConfidence: result.classification?.classificationConfidence ?? null,
    displayName: result.classification?.displayName ?? null,
    summary: result.heliosOpinion?.summary ?? null,
    headline: result.heliosOpinion?.resultCard?.headline ?? null,
    nextStep: result.heliosOpinion?.resultCard?.nextStepSummary ?? result.heliosOpinion?.recommendedNextStep ?? null,
    primaryConcern: result.heliosOpinion?.legalHighlights?.primaryConcern ?? null,
    workerName: result.heliosOpinion?.workerProfile?.name ?? null,
    employerName: result.heliosOpinion?.workerProfile?.employer ?? null,
  };
}

async function main() {
  const startedAt = new Date().toISOString();
  const output: any = {
    startedAt,
    actor: ownerUser,
    tenantId,
    cases: [],
  };

  for (const worker of documents) {
    const createdCase = await caller.cases.create({
      tenantId,
      title: worker.title,
      employeeName: worker.workerName,
      summary: worker.summary,
      status: 'intake',
      priority: 'medium',
    });

    const caseResult: any = {
      workerKey: worker.workerKey,
      workerName: worker.workerName,
      caseId: createdCase.caseId,
      caseTitle: createdCase.title,
      uploads: [],
    };

    for (const filePath of worker.files) {
      const mimeType = inferMimeType(filePath);
      const fileName = basename(filePath);

      try {
        const uploadResult = await caller.cases.uploadDocument({
          tenantId,
          caseId: createdCase.caseId,
          fileName,
          mimeType,
          base64Content: encodeFile(filePath, mimeType),
          visibility: 'tenant_legal',
          consentStatus: 'pending',
          sourceChannel: 'manual',
        });

        caseResult.uploads.push({
          fileName,
          mimeType,
          status: 'success',
          result: pickUploadSummary(uploadResult),
        });
      } catch (error) {
        caseResult.uploads.push({
          fileName,
          mimeType,
          status: 'error',
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const detail = await caller.cases.detail({ tenantId, caseId: createdCase.caseId });
    caseResult.detail = {
      caseStatus: detail.case.status,
      casePriority: detail.case.priority,
      documentsCount: detail.documents.length,
      documentTypes: detail.documents.map((item: any) => ({
        fileName: item.fileName,
        documentType: item.documentType,
        classificationConfidence: item.classificationConfidence,
        visibility: item.visibility,
        consentStatus: item.consentStatus,
      })),
      heliosSummary: detail.heliosExpediente?.summary ?? null,
      heliosDocumentsCount: detail.heliosExpediente?.documentsCount ?? null,
      heliosDocumentsWithOpinion: detail.heliosExpediente?.documentsWithOpinion ?? null,
      socialSecurityValidation: detail.socialSecurityValidation
        ? {
            statusLabel: detail.socialSecurityValidation.statusLabel,
            summary: detail.socialSecurityValidation.summary,
            hasImssSignal: detail.socialSecurityValidation.hasImssSignal,
            hasInfonavitSignal: detail.socialSecurityValidation.hasInfonavitSignal,
          }
        : null,
    };

    output.cases.push(caseResult);
  }

  output.finishedAt = new Date().toISOString();
  mkdirSync('/home/ubuntu/complilink_operativo_v1/ui-audit', { recursive: true });
  writeFileSync(
    '/home/ubuntu/complilink_operativo_v1/ui-audit/ceo_document_smoke_test_results_2026-05-06.json',
    JSON.stringify(output, null, 2),
    'utf8'
  );
  console.log(JSON.stringify(output, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

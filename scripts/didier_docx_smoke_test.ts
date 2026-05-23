import { basename, extname } from "node:path";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { appRouter } from "../server/routers";

const tenantId = "balt-1";
const ownerUser = {
  id: 1,
  openId: "S8ApRqTbJj4mEpPnubsWbo",
  name: "balt",
  email: "balt@cavazos.com",
  loginMethod: "manus" as const,
  role: "admin" as const,
  createdAt: new Date("2026-04-05T23:31:37.000Z"),
  updatedAt: new Date("2026-05-06T22:43:57.000Z"),
  lastSignedIn: new Date("2026-05-06T22:43:58.000Z"),
};

const req = {
  headers: {
    origin: "https://3000-ifwslt4380ij879g0ghvu-446467cd.us2.manus.computer",
    "user-agent": "Didier DOCX smoke test",
    host: "3000-ifwslt4380ij879g0ghvu-446467cd.us2.manus.computer",
  },
  socket: {
    remoteAddress: "127.0.0.1",
  },
} as any;

const res = {
  setHeader() {},
  getHeader() {
    return undefined;
  },
  clearCookie() {},
  cookie() {},
} as any;

const caller = appRouter.createCaller({ req, res, user: ownerUser });

const worker = {
  workerKey: "didier",
  workerName: "DIDIER ANTONIO UICAB PALOMO",
  title: "Smoke test · Didier Antonio Uicab Palomo",
  summary:
    "Validación end-to-end del flujo documental con PDF, XML y contrato DOCX reales de Didier Antonio Uicab Palomo.",
  files: [
    "/home/ubuntu/upload/8C18C713-7AFA-5EA6-B323-FA208F8A3880_DIDIER_ANTONIO_UICAB_PALOMO.pdf",
    "/home/ubuntu/upload/8C18C713-7AFA-5EA6-B323-FA208F8A3880_DIDIER_ANTONIO_UICAB_PALOMO.xml",
    "/home/ubuntu/upload/CONTRATOINDETERMINADO-UICABPALOMODIDIERANTONIO.docx",
  ],
};

function inferMimeType(filePath: string) {
  const extension = extname(filePath).toLowerCase();
  if (extension === ".xml") return "application/xml";
  if (extension === ".pdf") return "application/pdf";
  if (extension === ".docx") {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  return "application/octet-stream";
}

function encodeFile(filePath: string, mimeType: string) {
  const binary = readFileSync(filePath);
  return `data:${mimeType};base64,${binary.toString("base64")}`;
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
    nextStep:
      result.heliosOpinion?.resultCard?.nextStepSummary ??
      result.heliosOpinion?.recommendedNextStep ??
      null,
    primaryConcern: result.heliosOpinion?.legalHighlights?.primaryConcern ?? null,
    workerName: result.heliosOpinion?.workerProfile?.name ?? null,
    employerName: result.heliosOpinion?.workerProfile?.employer ?? null,
  };
}

async function main() {
  const createdCase = await caller.cases.create({
    tenantId,
    title: worker.title,
    employeeName: worker.workerName,
    summary: worker.summary,
    status: "intake",
    priority: "medium",
  });

  const output: any = {
    startedAt: new Date().toISOString(),
    workerName: worker.workerName,
    caseId: createdCase.caseId,
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
        visibility: "tenant_legal",
        consentStatus: "pending",
        sourceChannel: "manual",
      });

      output.uploads.push({
        fileName,
        mimeType,
        status: "success",
        result: pickUploadSummary(uploadResult),
      });
    } catch (error) {
      output.uploads.push({
        fileName,
        mimeType,
        status: "error",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const detail = await caller.cases.detail({ tenantId, caseId: createdCase.caseId });
  output.detail = {
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
  };
  output.finishedAt = new Date().toISOString();

  mkdirSync("/home/ubuntu/complilink_operativo_v1/ui-audit", { recursive: true });
  writeFileSync(
    "/home/ubuntu/complilink_operativo_v1/ui-audit/didier_docx_smoke_test_results.json",
    JSON.stringify(output, null, 2),
    "utf8",
  );
  console.log(JSON.stringify(output, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { and, asc, desc, eq } from 'drizzle-orm';
import {
  tenantMemberships,
  users,
  laborCases,
  caseDocuments,
  caseEvents,
  compliLinkWebhookEvents,
  operationalAlerts,
} from './drizzle/schema.ts';
import { getCaseDetailForUser, getDb, getUserByOpenId } from './server/db.ts';
import { ENV } from './server/_core/env.ts';
import { appRouter } from './server/routers.ts';

const PROJECT = '/home/ubuntu/complilink_operativo_v1';
const OUT = join(PROJECT, 'tmp_revalidate_jaime_case_output.json');
const ORIGIN = 'https://auditapatron.com';
const TARGET_EMPLOYEE = 'JAIME SANTIAGO LOPEZ';

function createMockRes() {
  return {
    statusCode: 200,
    headers: {} as Record<string, string>,
    locals: {},
    setHeader(name: string, value: string) {
      this.headers[name.toLowerCase()] = value;
      return this;
    },
    getHeader(name: string) {
      return this.headers[name.toLowerCase()];
    },
    removeHeader(name: string) {
      delete this.headers[name.toLowerCase()];
      return this;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      return payload;
    },
    send(payload: unknown) {
      return payload;
    },
    end(payload?: unknown) {
      return payload;
    },
    cookie() {
      return this;
    },
    clearCookie() {
      return this;
    },
    redirect() {
      return this;
    },
  };
}

async function loadAdminContext() {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  let user = ENV.ownerOpenId ? await getUserByOpenId(ENV.ownerOpenId) : undefined;
  if (!user) {
    const admins = await db
      .select()
      .from(users)
      .where(eq(users.role, 'admin'))
      .orderBy(desc(users.lastSignedIn), desc(users.id))
      .limit(1);
    user = admins[0];
  }
  if (!user) throw new Error('No administrative user found');
  const memberships = await db
    .select()
    .from(tenantMemberships)
    .where(eq(tenantMemberships.userId, user.id))
    .orderBy(desc(tenantMemberships.updatedAt), desc(tenantMemberships.id));
  const membership = memberships.find((row) => row.status === 'active' && row.role === 'tenant_admin') ?? memberships[0];
  if (!membership) throw new Error('No tenant membership found for admin user');
  return { db, user, membership };
}

async function resolveJaimeSourceDocuments(db: Awaited<ReturnType<typeof getDb>>) {
  const candidateCases = await db
    .select()
    .from(laborCases)
    .where(eq(laborCases.employeeName, TARGET_EMPLOYEE))
    .orderBy(desc(laborCases.updatedAt), desc(laborCases.id))
    .limit(10);

  for (const candidateCase of candidateCases) {
    const docs = await db
      .select()
      .from(caseDocuments)
      .where(eq(caseDocuments.caseId, candidateCase.caseId))
      .orderBy(asc(caseDocuments.createdAt), asc(caseDocuments.id));

    const xmlDoc = docs.find((doc) => doc.documentType === 'cfdi' || doc.mimeType === 'application/xml' || doc.originalName.toLowerCase().endsWith('.xml'));
    const contractDoc = docs.find((doc) => doc.documentType === 'contract');

    if (xmlDoc && contractDoc) {
      return {
        sourceCase: candidateCase,
        xmlDoc,
        contractDoc,
      };
    }
  }

  throw new Error('No previous Jaime case with both CFDI and contract was found');
}

async function downloadBinary(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download source document: ${response.status} ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function main() {
  const { db, user, membership } = await loadAdminContext();
  const { sourceCase, xmlDoc, contractDoc } = await resolveJaimeSourceDocuments(db);
  const xmlBuffer = await downloadBinary(xmlDoc.storageUrl);
  const contractBuffer = await downloadBinary(contractDoc.storageUrl);

  const req = {
    headers: {
      origin: ORIGIN,
      'user-agent': 'manus-jaime-revalidation/1.0',
      host: 'auditapatron.com',
      'x-forwarded-for': '127.0.0.1',
    },
    socket: { remoteAddress: '127.0.0.1' },
    method: 'POST',
    url: '/api/trpc',
  } as any;
  const res = createMockRes() as any;
  const caller = appRouter.createCaller({ req, res, user });

  const createdCase = await caller.cases.create({
    tenantId: membership.tenantId,
    title: 'Revalidación E2E Jaime Santiago López',
    employeeName: TARGET_EMPLOYEE,
    employerEntity: sourceCase.employerEntity ?? 'EMPLEADOR NO IDENTIFICADO',
    summary:
      'Corrida interna de revalidación usando CFDI y contrato reutilizados del caso histórico de Jaime para validar alerta salarial, Helios inicial, bridge y callback visible en el runtime restaurado.',
    status: 'intake',
    priority: 'medium',
    assignToUserId: user.id,
  });
  const caseId = createdCase.caseId;
  if (!caseId) throw new Error('Case creation did not return caseId');

  const xmlUpload = await caller.cases.uploadDocument({
    tenantId: membership.tenantId,
    caseId,
    fileName: xmlDoc.originalName,
    mimeType: xmlDoc.mimeType,
    base64Content: xmlBuffer.toString('base64'),
    textHint: 'CFDI XML de Jaime Santiago López para contrastar salario, RFC, periodo y seguridad social.',
    expectedDocumentType: 'cfdi',
    captureMode: 'file',
    visibility: 'case_team',
    consentStatus: 'granted',
    sourceChannel: 'manual',
  });

  const contractUpload = await caller.cases.uploadDocument({
    tenantId: membership.tenantId,
    caseId,
    fileName: contractDoc.originalName,
    mimeType: contractDoc.mimeType,
    base64Content: contractBuffer.toString('base64'),
    textHint: 'Contrato laboral de Jaime Santiago López para contrastar salario diario, puesto y fecha de ingreso.',
    expectedDocumentType: 'contract',
    captureMode: 'file',
    visibility: 'case_team',
    consentStatus: 'granted',
    sourceChannel: 'manual',
  });

  await new Promise((resolve) => setTimeout(resolve, 5000));

  const [persistedCase] = await db
    .select()
    .from(laborCases)
    .where(eq(laborCases.caseId, caseId))
    .limit(1);
  const persistedDocuments = await db
    .select()
    .from(caseDocuments)
    .where(eq(caseDocuments.caseId, caseId))
    .orderBy(asc(caseDocuments.createdAt), asc(caseDocuments.id));
  const persistedCaseEvents = await db
    .select()
    .from(caseEvents)
    .where(eq(caseEvents.caseId, caseId))
    .orderBy(asc(caseEvents.createdAt), asc(caseEvents.id));
  const persistedWebhookEvents = await db
    .select()
    .from(compliLinkWebhookEvents)
    .where(eq(compliLinkWebhookEvents.caseId, caseId))
    .orderBy(asc(compliLinkWebhookEvents.createdAt), asc(compliLinkWebhookEvents.id));
  const persistedAlerts = await db
    .select()
    .from(operationalAlerts)
    .where(eq(operationalAlerts.caseId, caseId))
    .orderBy(asc(operationalAlerts.raisedAt), asc(operationalAlerts.id));
  const caseDetail = await getCaseDetailForUser({
    userId: user.id,
    tenantId: membership.tenantId,
    caseId,
  });

  const output = {
    executedAt: new Date().toISOString(),
    origin: ORIGIN,
    actorUser: {
      id: user.id,
      openId: user.openId,
      email: user.email,
      role: user.role,
    },
    tenant: {
      tenantId: membership.tenantId,
      role: membership.role,
      accessScope: membership.accessScope,
    },
    sourceCase: {
      caseId: sourceCase.caseId,
      title: sourceCase.title,
      employerEntity: sourceCase.employerEntity,
      updatedAt: sourceCase.updatedAt,
    },
    sourceDocuments: {
      xml: {
        documentId: xmlDoc.documentId,
        originalName: xmlDoc.originalName,
        mimeType: xmlDoc.mimeType,
        storageUrl: xmlDoc.storageUrl,
      },
      contract: {
        documentId: contractDoc.documentId,
        originalName: contractDoc.originalName,
        mimeType: contractDoc.mimeType,
        storageUrl: contractDoc.storageUrl,
      },
    },
    case: createdCase,
    persistedCase,
    xmlUpload,
    contractUpload,
    persistedDocuments,
    caseEvents: persistedCaseEvents,
    webhookEvents: persistedWebhookEvents,
    persistedAlerts,
    visibleAlerts: caseDetail.alerts,
  };
  await writeFile(OUT, JSON.stringify(output, null, 2), 'utf8');
  console.log(OUT);
}

main().catch(async (error) => {
  const serialized = {
    executedAt: new Date().toISOString(),
    error: error instanceof Error
      ? {
          name: error.name,
          message: error.message,
          stack: error.stack,
        }
      : String(error),
  };
  await writeFile(OUT, JSON.stringify(serialized, null, 2), 'utf8');
  console.error(error);
  console.log(OUT);
  process.exit(1);
});

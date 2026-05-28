import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { asc, desc, eq } from 'drizzle-orm';

import { tenantMemberships, users, laborCases, caseDocuments, caseEvents, compliLinkWebhookEvents } from './drizzle/schema.ts';
import { getDb, getUserByOpenId } from './server/db.ts';
import { ENV } from './server/_core/env.ts';
import { appRouter } from './server/routers.ts';

const PROJECT = '/home/ubuntu/complilink_operativo_v1';
const UPLOAD = '/home/ubuntu/upload';
const OUT = join(PROJECT, 'tmp_revalidate_hector_case_output.json');
const ORIGIN = 'https://auditapatron.com';

const XML_FILE = '29C44A28-91A0-513B-877E-E8F527AFC12C_HECTOR_JOVANE_ORTIZ_HERNANDEZ.xml';
const DOCX_FILE = 'CONTRATOINDETERMINADO-ORTIZHERNANDEZHECTORJOVANE.docx';

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

async function main() {
  const { db, user, membership } = await loadAdminContext();

  const xmlBuffer = await readFile(join(UPLOAD, XML_FILE));
  const docxBuffer = await readFile(join(UPLOAD, DOCX_FILE));

  const req = {
    headers: {
      origin: ORIGIN,
      'user-agent': 'manus-hector-revalidation/1.0',
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
    title: 'Revalidación E2E Héctor Jovane Ortiz Hernández',
    employeeName: 'HECTOR JOVANE ORTIZ HERNANDEZ',
    employerEntity: 'EVOLUCION CREATIVA CAMREFLEX',
    summary: 'Corrida interna de revalidación con CFDI XML y contrato DOCX para verificar expediente, Helios inicial, bridge y retorno asíncrono en ventana corta.',
    status: 'intake',
    priority: 'medium',
    assignToUserId: user.id,
  });

  const caseId = createdCase.caseId;
  if (!caseId) throw new Error('Case creation did not return caseId');

  const xmlUpload = await caller.cases.uploadDocument({
    tenantId: membership.tenantId,
    caseId,
    fileName: XML_FILE,
    mimeType: 'application/xml',
    base64Content: xmlBuffer.toString('base64'),
    textHint: 'CFDI XML de nómina de Héctor Jovane Ortiz Hernández para contrastar salario, RFC, CURP, NSS y periodo.',
    expectedDocumentType: 'cfdi',
    captureMode: 'file',
    visibility: 'case_team',
    consentStatus: 'granted',
    sourceChannel: 'manual',
  });

  const docxUpload = await caller.cases.uploadDocument({
    tenantId: membership.tenantId,
    caseId,
    fileName: DOCX_FILE,
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    base64Content: docxBuffer.toString('base64'),
    textHint: 'Contrato laboral de Héctor Jovane Ortiz Hernández para contrastar salario diario, puesto y fecha de ingreso.',
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
    case: createdCase,
    persistedCase,
    xmlUpload,
    docxUpload,
    persistedDocuments,
    caseEvents: persistedCaseEvents,
    webhookEvents: persistedWebhookEvents,
  };

  await writeFile(OUT, JSON.stringify(output, null, 2), 'utf8');
  console.log(OUT);
}

main().catch(async (error) => {
  const serialized = {
    executedAt: new Date().toISOString(),
    error: error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack,
    } : String(error),
  };
  await writeFile(OUT, JSON.stringify(serialized, null, 2), 'utf8');
  console.error(error);
  console.log(OUT);
  process.exit(1);
});

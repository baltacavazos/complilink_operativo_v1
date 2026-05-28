import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { desc, eq } from 'drizzle-orm';
import { tenantMemberships, users } from './drizzle/schema.ts';
import { getCaseDetailForUser, getDb, getUserByOpenId } from './server/db.ts';
import { ENV } from './server/_core/env.ts';

const PROJECT = '/home/ubuntu/complilink_operativo_v1';
const SOURCE = join(PROJECT, 'tmp_revalidate_jaime_case_output.json');
const OUT = join(PROJECT, 'tmp_inspect_jaime_callback_visibility_output.json');

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
  return { user, membership };
}

async function main() {
  const { user, membership } = await loadAdminContext();
  const payload = JSON.parse(await readFile(SOURCE, 'utf8')) as { case?: { caseId?: string } };
  const caseId = payload.case?.caseId;
  if (!caseId) throw new Error('No caseId found in Jaime revalidation output');

  const detail = await getCaseDetailForUser({
    userId: user.id,
    tenantId: membership.tenantId,
    caseId,
  });

  const output = {
    inspectedAt: new Date().toISOString(),
    caseId,
    alerts: detail.alerts,
    events: detail.events.slice(0, 12),
  };

  await writeFile(OUT, JSON.stringify(output, null, 2), 'utf8');
  console.log(OUT);
}

main().catch(async (error) => {
  const serialized = {
    inspectedAt: new Date().toISOString(),
    error: error instanceof Error
      ? { name: error.name, message: error.message, stack: error.stack }
      : String(error),
  };
  await writeFile(OUT, JSON.stringify(serialized, null, 2), 'utf8');
  console.error(error);
  console.log(OUT);
  process.exit(1);
});

import { desc, eq } from 'drizzle-orm';
import { getDb, getUserByOpenId } from './server/db.ts';
import { tenantMemberships, users } from './drizzle/schema.ts';
import { ENV } from './server/_core/env.ts';

async function main() {
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

  if (!user) throw new Error('No admin/owner user found');

  const memberships = await db
    .select()
    .from(tenantMemberships)
    .where(eq(tenantMemberships.userId, user.id))
    .orderBy(desc(tenantMemberships.updatedAt), desc(tenantMemberships.id));

  console.log(JSON.stringify({
    ownerOpenIdConfigured: Boolean(ENV.ownerOpenId),
    user,
    memberships,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

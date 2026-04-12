import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import mysql from "mysql2/promise";

const pool = mysql.createPool(process.env.DATABASE_URL);
const migrationPath = "/home/ubuntu/complilink_operativo_v1/drizzle/0004_even_liz_osborn.sql";

async function sha256(path) {
  const content = await readFile(path);
  return createHash("sha256").update(content).digest("hex");
}

async function main() {
  const migrationHash = await sha256(migrationPath);

  const [tables] = await pool.query(
    `SELECT TABLE_NAME
     FROM information_schema.tables
     WHERE table_schema = DATABASE()
       AND table_name IN ('ceo_bridge_presets', 'ceo_bridge_schedules')
     ORDER BY table_name`,
  );

  const [scheduleIndexes] = await pool.query(
    `SELECT INDEX_NAME, COLUMN_NAME, NON_UNIQUE
     FROM information_schema.statistics
     WHERE table_schema = DATABASE()
       AND table_name = 'ceo_bridge_schedules'
     ORDER BY INDEX_NAME, SEQ_IN_INDEX`,
  );

  const [scheduleConstraints] = await pool.query(
    `SELECT CONSTRAINT_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
     FROM information_schema.key_column_usage
     WHERE table_schema = DATABASE()
       AND table_name = 'ceo_bridge_schedules'
       AND REFERENCED_TABLE_NAME IS NOT NULL
     ORDER BY CONSTRAINT_NAME`,
  );

  const [migrationRows] = await pool.query(
    `SELECT hash, created_at
     FROM __drizzle_migrations
     WHERE hash = ?
     LIMIT 1`,
    [migrationHash],
  );

  const [recentMigrations] = await pool.query(
    `SELECT hash, created_at
     FROM __drizzle_migrations
     ORDER BY created_at DESC
     LIMIT 10`,
  );

  console.log(
    JSON.stringify(
      {
        migrationPath,
        migrationHash,
        tables,
        scheduleIndexes,
        scheduleConstraints,
        migrationRegistered: Array.isArray(migrationRows) && migrationRows.length > 0,
        recentMigrations,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });

import mysql from "mysql2/promise";

const pool = mysql.createPool(process.env.DATABASE_URL);

async function main() {
  const [tables] = await pool.query(
    `SELECT TABLE_NAME
     FROM information_schema.tables
     WHERE table_schema = DATABASE()
       AND table_name = 'complilink_webhook_events'`,
  );

  const [constraints] = await pool.query(
    `SELECT CONSTRAINT_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
     FROM information_schema.key_column_usage
     WHERE table_schema = DATABASE()
       AND table_name = 'complilink_webhook_events'
       AND REFERENCED_TABLE_NAME IS NOT NULL
     ORDER BY CONSTRAINT_NAME`,
  );

  const [indexes] = await pool.query(
    `SELECT INDEX_NAME, COLUMN_NAME, NON_UNIQUE
     FROM information_schema.statistics
     WHERE table_schema = DATABASE()
       AND table_name = 'complilink_webhook_events'
     ORDER BY INDEX_NAME, SEQ_IN_INDEX`,
  );

  const [migrationRows] = await pool.query(
    `SELECT * FROM __drizzle_migrations ORDER BY created_at DESC LIMIT 10`,
  );

  console.log(JSON.stringify({
    tableExists: Array.isArray(tables) && tables.length > 0,
    tables,
    constraints,
    indexes,
    recentMigrations: migrationRows,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });

import fs from "node:fs/promises";
import mysql from "mysql2/promise";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set");
  }

  const connection = await mysql.createConnection(databaseUrl);
  try {
    const [dbRows] = await connection.query("SELECT DATABASE() AS dbName");
    const dbName = dbRows?.[0]?.dbName;
    if (!dbName) {
      throw new Error("Unable to resolve current database name");
    }

    const [tableRows] = await connection.query(
      `SELECT table_name AS tableName
       FROM information_schema.tables
       WHERE table_schema = ?
         AND table_name IN ('ceo_bridge_presets', 'ceo_bridge_schedules')
       ORDER BY table_name`,
      [dbName],
    );

    const [migrationTableRows] = await connection.query(
      `SELECT table_name AS tableName
       FROM information_schema.tables
       WHERE table_schema = ?
         AND table_name LIKE '%drizzle%'
       ORDER BY table_name`,
      [dbName],
    );

    const migrationTables = migrationTableRows.map((row) => row.tableName);
    const migrationData = {};

    for (const tableName of migrationTables) {
      try {
        const [rows] = await connection.query(`SELECT * FROM \`${tableName}\` ORDER BY id DESC LIMIT 10`);
        migrationData[tableName] = rows;
      } catch (error) {
        migrationData[tableName] = { error: error instanceof Error ? error.message : String(error) };
      }
    }

    const result = {
      database: dbName,
      ceoBridgeTablesPresent: tableRows.map((row) => row.tableName),
      missingTables: ["ceo_bridge_presets", "ceo_bridge_schedules"].filter(
        (name) => !tableRows.some((row) => row.tableName === name),
      ),
      migrationTables,
      migrationData,
      checkedAt: new Date().toISOString(),
    };

    await fs.mkdir("./tmp", { recursive: true });
    await fs.writeFile("./tmp/ceo_bridge_migration_status.json", JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

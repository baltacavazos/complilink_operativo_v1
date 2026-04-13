import mysql from 'mysql2/promise';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL missing');
  process.exit(1);
}

const connection = await mysql.createConnection(url);
try {
  const [dbRows] = await connection.query('SELECT DATABASE() AS db');
  const dbName = dbRows[0]?.db;
  const [rows] = await connection.query(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = ?
       AND table_name IN ('ceo_bridge_presets', 'ceo_bridge_schedules', 'operational_alerts', '__drizzle_migrations')
     ORDER BY table_name`,
    [dbName],
  );
  console.log(JSON.stringify({ dbName, tables: rows.map((row) => row.table_name) }, null, 2));
} finally {
  await connection.end();
}

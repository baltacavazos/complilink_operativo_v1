import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import mysql from "mysql2/promise";

const pool = mysql.createPool(process.env.DATABASE_URL);

async function sha256(path) {
  const content = await readFile(path);
  return createHash("sha256").update(content).digest("hex");
}

async function hasIndex(connection, indexName) {
  const [rows] = await connection.query(
    `SELECT 1
     FROM information_schema.statistics
     WHERE table_schema = DATABASE()
       AND table_name = 'complilink_webhook_events'
       AND index_name = ?
     LIMIT 1`,
    [indexName],
  );
  return Array.isArray(rows) && rows.length > 0;
}

async function hasConstraint(connection, constraintName) {
  const [rows] = await connection.query(
    `SELECT 1
     FROM information_schema.key_column_usage
     WHERE table_schema = DATABASE()
       AND table_name = 'complilink_webhook_events'
       AND constraint_name = ?
       AND referenced_table_name IS NOT NULL
     LIMIT 1`,
    [constraintName],
  );
  return Array.isArray(rows) && rows.length > 0;
}

async function hasMigrationHash(connection, hash) {
  const [rows] = await connection.query(
    `SELECT 1 FROM __drizzle_migrations WHERE hash = ? LIMIT 1`,
    [hash],
  );
  return Array.isArray(rows) && rows.length > 0;
}

async function main() {
  const connection = await pool.getConnection();
  const actions = [];

  try {
    const [tableRows] = await connection.query(
      `SELECT 1
       FROM information_schema.tables
       WHERE table_schema = DATABASE()
         AND table_name = 'complilink_webhook_events'
       LIMIT 1`,
    );

    if (!Array.isArray(tableRows) || tableRows.length === 0) {
      throw new Error("La tabla complilink_webhook_events no existe; el script de reparación esperaba una migración parcial previa.");
    }

    const requiredIndexes = [
      {
        name: "complilink_webhook_events_document_idx",
        sql: "CREATE INDEX `complilink_webhook_events_document_idx` ON `complilink_webhook_events` (`documentId`)",
      },
      {
        name: "complilink_webhook_events_trace_idx",
        sql: "CREATE INDEX `complilink_webhook_events_trace_idx` ON `complilink_webhook_events` (`traceId`)",
      },
      {
        name: "complilink_webhook_events_status_idx",
        sql: "CREATE INDEX `complilink_webhook_events_status_idx` ON `complilink_webhook_events` (`status`)",
      },
    ];

    for (const indexDef of requiredIndexes) {
      if (!(await hasIndex(connection, indexDef.name))) {
        await connection.query(indexDef.sql);
        actions.push(`created index ${indexDef.name}`);
      }
    }

    if (!(await hasConstraint(connection, "cl_we_doc_fk"))) {
      await connection.query(
        "ALTER TABLE `complilink_webhook_events` ADD CONSTRAINT `cl_we_doc_fk` FOREIGN KEY (`documentId`) REFERENCES `case_documents`(`documentId`) ON DELETE no action ON UPDATE no action",
      );
      actions.push("created foreign key cl_we_doc_fk");
    }

    const migrationFiles = [
      "/home/ubuntu/complilink_operativo_v1/drizzle/0002_spotty_blob.sql",
      "/home/ubuntu/complilink_operativo_v1/drizzle/0003_mysterious_star_brand.sql",
    ];

    for (const filePath of migrationFiles) {
      const hash = await sha256(filePath);
      if (!(await hasMigrationHash(connection, hash))) {
        await connection.query(
          `INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)` ,
          [hash, Date.now()],
        );
        actions.push(`registered migration ${filePath.split("/").pop()}`);
      }
    }

    console.log(JSON.stringify({ ok: true, actions }, null, 2));
  } finally {
    connection.release();
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });

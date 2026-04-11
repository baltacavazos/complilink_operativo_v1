import { createHash } from "node:crypto";
import { gunzipSync, gzipSync } from "node:zlib";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import * as mysql from "mysql2";
import { createConnection, type Connection } from "mysql2/promise";

export type BackupRow = Record<string, unknown>;

export type TableSnapshot = {
  name: string;
  columns: string[];
  createTableSql: string;
  referencedTables: string[];
  rows: BackupRow[];
  rowCount: number;
  rowChecksum: string;
  schemaChecksum: string;
};

export type DatabaseSnapshot = {
  databaseName: string;
  capturedAt: string;
  tables: TableSnapshot[];
};

export type RecoverableBackupManifest = {
  version: 1;
  backupId: string;
  backupLabel: string;
  databaseName: string;
  capturedAt: string;
  tableCount: number;
  totalRowCount: number;
  schemaChecksum: string;
  datasetChecksum: string;
  restoreSqlChecksum: string;
  artifactChecksum: string;
  tables: Array<{
    name: string;
    rowCount: number;
    rowChecksum: string;
    schemaChecksum: string;
    referencedTables: string[];
  }>;
};

export type RecoverableBackupArtifact = {
  manifest: RecoverableBackupManifest;
  restoreSql: string;
  snapshot: DatabaseSnapshot;
};

export type DropboxUploadResult = {
  path: string;
  sizeBytes: number;
};

export type RecoverableBackupResult = {
  backupId: string;
  backupLabel: string;
  outputDir: string;
  manifestPath: string;
  restoreSqlPath: string;
  artifactPath: string;
  manifest: RecoverableBackupManifest;
  dropboxUploads: DropboxUploadResult[];
};

export type BackupValidationResult = {
  ok: boolean;
  artifactPath: string;
  backupId: string;
  validatedAt: string;
  totalTables: number;
  totalRows: number;
  artifactChecksumVerified: boolean;
  restoreSqlChecksumVerified: boolean;
  schemaChecksumVerified: boolean;
  dataChecksumVerified: boolean;
  liveDatabaseComparison?: {
    ok: boolean;
    databaseName: string;
    mismatchedTables: string[];
  };
};

export type CreateRecoverableDatabaseBackupOptions = {
  databaseUrl: string;
  backupLabel?: string;
  outputDir?: string;
  dropbox?: {
    accessToken: string;
    basePath?: string;
  };
  snapshotLoader?: (databaseUrl: string) => Promise<DatabaseSnapshot>;
  now?: Date;
};

export type ValidateRecoverableDatabaseBackupOptions = {
  artifactPath: string;
  databaseUrl?: string;
  snapshotLoader?: (databaseUrl: string) => Promise<DatabaseSnapshot>;
};

const DEFAULT_OUTPUT_DIR = ".manus-work/backups/database";

function sha256(input: string | Buffer) {
  return createHash("sha256").update(input).digest("hex");
}

function normalizeValue(value: unknown): unknown {
  if (value === undefined) return null;
  if (value === null) return null;
  if (typeof value === "bigint") {
    return { $type: "bigint", value: value.toString() };
  }
  if (value instanceof Date) {
    return { $type: "date", value: value.toISOString() };
  }
  if (Buffer.isBuffer(value)) {
    return { $type: "buffer", encoding: "base64", value: value.toString("base64") };
  }
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeValue(entry));
  }
  if (typeof value === "object") {
    return Object.keys(value as Record<string, unknown>)
      .sort((left, right) => left.localeCompare(right))
      .reduce<Record<string, unknown>>((accumulator, key) => {
        accumulator[key] = normalizeValue((value as Record<string, unknown>)[key]);
        return accumulator;
      }, {});
  }
  return value;
}

function stableStringify(value: unknown) {
  return JSON.stringify(normalizeValue(value));
}

function normalizeRows(rows: BackupRow[]) {
  return rows.map((row) => normalizeValue(row) as BackupRow);
}

function extractReferencedTables(createTableSql: string, tableName: string) {
  const matches = Array.from(createTableSql.matchAll(/REFERENCES\s+`([^`]+)`/g)).map((match) => match[1]);
  return Array.from(new Set(matches.filter((candidate) => candidate !== tableName))).sort((left, right) => left.localeCompare(right));
}

export function orderTablesForRestore(tables: Array<Pick<TableSnapshot, "name" | "referencedTables">>) {
  const byName = new Map(tables.map((table) => [table.name, table]));
  const permanent = new Set<string>();
  const temporary = new Set<string>();
  const ordered: string[] = [];

  function visit(tableName: string) {
    if (permanent.has(tableName)) return;
    if (temporary.has(tableName)) {
      return;
    }

    temporary.add(tableName);
    const table = byName.get(tableName);
    const dependencies = [...(table?.referencedTables ?? [])].sort((left, right) => left.localeCompare(right));
    for (const dependency of dependencies) {
      if (byName.has(dependency)) {
        visit(dependency);
      }
    }
    temporary.delete(tableName);
    permanent.add(tableName);
    ordered.push(tableName);
  }

  for (const tableName of Array.from(byName.keys()).sort((left, right) => left.localeCompare(right))) {
    visit(tableName);
  }

  return ordered;
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function buildInsertStatements(table: Pick<TableSnapshot, "name" | "columns" | "rows">) {
  if (table.rows.length === 0) {
    return `-- ${table.name}: sin filas para insertar.`;
  }

  const tableSqlName = mysql.escapeId(table.name);
  const columnSqlNames = table.columns.map((column) => mysql.escapeId(column)).join(", ");
  const chunks = chunkArray(table.rows, 200);

  return chunks
    .map((chunk) => {
      const valuesSql = chunk
        .map((row) => {
          const values = table.columns.map((column) => mysql.escape((row as Record<string, unknown>)[column] ?? null)).join(", ");
          return `(${values})`;
        })
        .join(",\n");

      return `INSERT INTO ${tableSqlName} (${columnSqlNames}) VALUES\n${valuesSql};`;
    })
    .join("\n\n");
}

export function buildRestoreSql(snapshot: DatabaseSnapshot) {
  const tablesByName = new Map(snapshot.tables.map((table) => [table.name, table]));
  const restoreOrder = orderTablesForRestore(snapshot.tables);
  const dropOrder = [...restoreOrder].reverse();

  const sections = [
    `-- AuditaPatron recoverable backup`,
    `-- Backup ID: generated at export time`,
    `-- Database: ${snapshot.databaseName}`,
    `-- Captured at: ${snapshot.capturedAt}`,
    "SET SESSION sql_mode = 'STRICT_ALL_TABLES';",
    "SET FOREIGN_KEY_CHECKS = 0;",
    "START TRANSACTION;",
    ...dropOrder.map((tableName) => `DROP TABLE IF EXISTS ${mysql.escapeId(tableName)};`),
  ];

  for (const tableName of restoreOrder) {
    const table = tablesByName.get(tableName);
    if (!table) continue;
    sections.push(`\n-- Schema for ${table.name}`);
    sections.push(`${table.createTableSql};`);
  }

  for (const tableName of restoreOrder) {
    const table = tablesByName.get(tableName);
    if (!table) continue;
    sections.push(`\n-- Data for ${table.name}`);
    sections.push(buildInsertStatements(table));
  }

  sections.push("COMMIT;");
  sections.push("SET FOREIGN_KEY_CHECKS = 1;");

  return `${sections.join("\n")}\n`;
}

function buildManifest(params: { backupId: string; backupLabel: string; snapshot: DatabaseSnapshot; restoreSql: string }) {
  const schemaChecksum = sha256(params.snapshot.tables.map((table) => `${table.name}:${table.schemaChecksum}`).join("|"));
  const datasetChecksum = sha256(params.snapshot.tables.map((table) => `${table.name}:${table.rowChecksum}:${table.rowCount}`).join("|"));
  const restoreSqlChecksum = sha256(params.restoreSql);

  const manifestBase = {
    version: 1 as const,
    backupId: params.backupId,
    backupLabel: params.backupLabel,
    databaseName: params.snapshot.databaseName,
    capturedAt: params.snapshot.capturedAt,
    tableCount: params.snapshot.tables.length,
    totalRowCount: params.snapshot.tables.reduce((total, table) => total + table.rowCount, 0),
    schemaChecksum,
    datasetChecksum,
    restoreSqlChecksum,
    tables: params.snapshot.tables.map((table) => ({
      name: table.name,
      rowCount: table.rowCount,
      rowChecksum: table.rowChecksum,
      schemaChecksum: table.schemaChecksum,
      referencedTables: table.referencedTables,
    })),
  };

  const artifactChecksum = sha256(stableStringify(manifestBase));

  return {
    ...manifestBase,
    artifactChecksum,
  } satisfies RecoverableBackupManifest;
}

export function createArtifactFromSnapshot(params: { backupId: string; backupLabel: string; snapshot: DatabaseSnapshot }) {
  const enrichedSnapshot: DatabaseSnapshot = {
    ...params.snapshot,
    tables: params.snapshot.tables.map((table) => {
      const normalizedRows = normalizeRows(table.rows);
      return {
        ...table,
        referencedTables:
          table.referencedTables.length > 0
            ? [...table.referencedTables].sort((left, right) => left.localeCompare(right))
            : extractReferencedTables(table.createTableSql, table.name),
        rowCount: table.rows.length,
        rowChecksum: sha256(stableStringify(normalizedRows)),
        schemaChecksum: sha256(table.createTableSql),
      } satisfies TableSnapshot;
    }),
  };

  const restoreSql = buildRestoreSql(enrichedSnapshot);
  const manifest = buildManifest({
    backupId: params.backupId,
    backupLabel: params.backupLabel,
    snapshot: enrichedSnapshot,
    restoreSql,
  });

  return {
    manifest,
    restoreSql,
    snapshot: {
      ...enrichedSnapshot,
      tables: enrichedSnapshot.tables.map((table) => ({
        ...table,
        rows: normalizeRows(table.rows),
      })),
    },
  } satisfies RecoverableBackupArtifact;
}

function parseDatabaseNameFromUrl(databaseUrl: string) {
  try {
    const parsed = new URL(databaseUrl);
    return parsed.pathname.replace(/^\//, "") || "database";
  } catch {
    return "database";
  }
}

async function resolveCurrentDatabaseName(connection: Connection, fallbackFromUrl: string) {
  const [rows] = await connection.query("SELECT DATABASE() AS databaseName");
  const row = Array.isArray(rows) && rows.length > 0 ? (rows[0] as Record<string, unknown>) : null;
  const currentDatabase = typeof row?.databaseName === "string" && row.databaseName.trim().length > 0 ? row.databaseName : fallbackFromUrl;
  return currentDatabase;
}

async function listBaseTables(connection: Connection) {
  const [rows] = await connection.query(
    "SELECT TABLE_NAME FROM information_schema.tables WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE' ORDER BY TABLE_NAME ASC",
  );
  return (Array.isArray(rows) ? rows : [])
    .map((row) => (row as Record<string, unknown>).TABLE_NAME)
    .filter((value): value is string => typeof value === "string" && value.length > 0);
}

async function listColumns(connection: Connection, tableName: string) {
  const [rows] = await connection.query(
    "SELECT COLUMN_NAME FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? ORDER BY ORDINAL_POSITION ASC",
    [tableName],
  );

  return (Array.isArray(rows) ? rows : [])
    .map((row) => (row as Record<string, unknown>).COLUMN_NAME)
    .filter((value): value is string => typeof value === "string" && value.length > 0);
}

async function getCreateTableSql(connection: Connection, tableName: string) {
  const [rows] = await connection.query(`SHOW CREATE TABLE ${mysql.escapeId(tableName)}`);
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error(`No se pudo obtener el CREATE TABLE de ${tableName}`);
  }

  const row = rows[0] as Record<string, unknown>;
  const createSql = Object.entries(row).find(([key]) => key.toLowerCase().includes("create table"))?.[1];
  if (typeof createSql !== "string" || createSql.trim().length === 0) {
    throw new Error(`El CREATE TABLE de ${tableName} llegó vacío`);
  }

  return createSql.trim();
}

async function selectAllRows(connection: Connection, tableName: string) {
  const [rows] = await connection.query(`SELECT * FROM ${mysql.escapeId(tableName)}`);
  if (!Array.isArray(rows)) return [];
  return rows as BackupRow[];
}

export async function loadDatabaseSnapshot(databaseUrl: string): Promise<DatabaseSnapshot> {
  const connection = await createConnection(databaseUrl);
  const fallbackDatabaseName = parseDatabaseNameFromUrl(databaseUrl);

  try {
    await connection.query("SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ");
    await connection.query("START TRANSACTION WITH CONSISTENT SNAPSHOT");

    const databaseName = await resolveCurrentDatabaseName(connection, fallbackDatabaseName);
    const tables = await listBaseTables(connection);
    const capturedAt = new Date().toISOString();

    const tableSnapshots: TableSnapshot[] = [];
    for (const tableName of tables) {
      const [columns, createTableSql, rows] = await Promise.all([
        listColumns(connection, tableName),
        getCreateTableSql(connection, tableName),
        selectAllRows(connection, tableName),
      ]);
      const normalizedRows = normalizeRows(rows);
      tableSnapshots.push({
        name: tableName,
        columns,
        createTableSql,
        referencedTables: extractReferencedTables(createTableSql, tableName),
        rows,
        rowCount: rows.length,
        rowChecksum: sha256(stableStringify(normalizedRows)),
        schemaChecksum: sha256(createTableSql),
      });
    }

    await connection.query("COMMIT");

    return {
      databaseName,
      capturedAt,
      tables: tableSnapshots,
    };
  } catch (error) {
    try {
      await connection.query("ROLLBACK");
    } catch {
      // ignore rollback failure
    }
    throw error;
  } finally {
    await connection.end();
  }
}

async function uploadToDropbox(params: {
  accessToken: string;
  dropboxPath: string;
  content: Buffer;
}) {
  const response = await fetch("https://content.dropboxapi.com/2/files/upload", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "Content-Type": "application/octet-stream",
      "Dropbox-API-Arg": JSON.stringify({
        path: params.dropboxPath,
        mode: "add",
        autorename: true,
        mute: false,
        strict_conflict: false,
      }),
    },
    body: new Uint8Array(params.content),
  });

  const raw = await response.text();
  if (!response.ok) {
    throw new Error(`Dropbox rechazó la subida a ${params.dropboxPath} con status ${response.status}: ${raw}`);
  }

  return {
    path: params.dropboxPath,
    sizeBytes: params.content.byteLength,
  } satisfies DropboxUploadResult;
}

export async function createRecoverableDatabaseBackup(options: CreateRecoverableDatabaseBackupOptions) {
  if (!options.databaseUrl) {
    throw new Error("DATABASE_URL es obligatorio para exportar el backup recuperable");
  }

  const now = options.now ?? new Date();
  const timestampCompact = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const backupId = `db-backup-${timestampCompact.toLowerCase()}`;
  const backupLabel = (options.backupLabel ?? "manual").trim().replace(/\s+/g, "-").toLowerCase() || "manual";
  const outputDir = path.resolve(options.outputDir ?? DEFAULT_OUTPUT_DIR);
  mkdirSync(outputDir, { recursive: true });

  const snapshotLoader = options.snapshotLoader ?? loadDatabaseSnapshot;
  const snapshot = await snapshotLoader(options.databaseUrl);
  const artifact = createArtifactFromSnapshot({
    backupId,
    backupLabel,
    snapshot,
  });

  const fileStem = `${backupId}-${backupLabel}`;
  const artifactBytes = gzipSync(Buffer.from(JSON.stringify(artifact), "utf-8"));
  const manifestBytes = Buffer.from(JSON.stringify(artifact.manifest, null, 2), "utf-8");
  const restoreSqlBytes = Buffer.from(artifact.restoreSql, "utf-8");

  const artifactPath = path.join(outputDir, `${fileStem}.backup.json.gz`);
  const manifestPath = path.join(outputDir, `${fileStem}.manifest.json`);
  const restoreSqlPath = path.join(outputDir, `${fileStem}.restore.sql`);

  writeFileSync(artifactPath, artifactBytes);
  writeFileSync(manifestPath, manifestBytes);
  writeFileSync(restoreSqlPath, restoreSqlBytes);

  const dropboxUploads: DropboxUploadResult[] = [];
  if (options.dropbox?.accessToken) {
    const basePath = options.dropbox.basePath?.trim() || "/Backups/AuditaPatron";
    for (const file of [
      { name: path.basename(artifactPath), content: artifactBytes },
      { name: path.basename(manifestPath), content: manifestBytes },
      { name: path.basename(restoreSqlPath), content: restoreSqlBytes },
    ]) {
      const normalizedBase = basePath.endsWith("/") ? basePath.slice(0, -1) : basePath;
      dropboxUploads.push(
        await uploadToDropbox({
          accessToken: options.dropbox.accessToken,
          dropboxPath: `${normalizedBase}/${file.name}`,
          content: file.content,
        }),
      );
    }
  }

  return {
    backupId,
    backupLabel,
    outputDir,
    manifestPath,
    restoreSqlPath,
    artifactPath,
    manifest: artifact.manifest,
    dropboxUploads,
  } satisfies RecoverableBackupResult;
}

function readArtifact(artifactPath: string) {
  const compressed = readFileSync(artifactPath);
  const raw = gunzipSync(compressed).toString("utf-8");
  return JSON.parse(raw) as RecoverableBackupArtifact;
}

function validateArtifactInternals(artifact: RecoverableBackupArtifact) {
  const recomputedRestoreSqlChecksum = sha256(artifact.restoreSql);
  const recomputedSchemaChecksum = sha256(
    artifact.snapshot.tables.map((table) => `${table.name}:${sha256(table.createTableSql)}`).join("|"),
  );
  const recomputedDatasetChecksum = sha256(
    artifact.snapshot.tables.map((table) => `${table.name}:${sha256(stableStringify(table.rows))}:${table.rows.length}`).join("|"),
  );

  const manifestBase = {
    version: artifact.manifest.version,
    backupId: artifact.manifest.backupId,
    backupLabel: artifact.manifest.backupLabel,
    databaseName: artifact.manifest.databaseName,
    capturedAt: artifact.manifest.capturedAt,
    tableCount: artifact.manifest.tableCount,
    totalRowCount: artifact.manifest.totalRowCount,
    schemaChecksum: artifact.manifest.schemaChecksum,
    datasetChecksum: artifact.manifest.datasetChecksum,
    restoreSqlChecksum: artifact.manifest.restoreSqlChecksum,
    tables: artifact.manifest.tables,
  };
  const recomputedArtifactChecksum = sha256(stableStringify(manifestBase));

  return {
    artifactChecksumVerified: recomputedArtifactChecksum === artifact.manifest.artifactChecksum,
    restoreSqlChecksumVerified: recomputedRestoreSqlChecksum === artifact.manifest.restoreSqlChecksum,
    schemaChecksumVerified: recomputedSchemaChecksum === artifact.manifest.schemaChecksum,
    dataChecksumVerified: recomputedDatasetChecksum === artifact.manifest.datasetChecksum,
  };
}

export async function validateRecoverableDatabaseBackup(options: ValidateRecoverableDatabaseBackupOptions) {
  const artifact = readArtifact(options.artifactPath);
  const internalChecks = validateArtifactInternals(artifact);

  let liveDatabaseComparison: BackupValidationResult["liveDatabaseComparison"];
  if (options.databaseUrl) {
    const snapshotLoader = options.snapshotLoader ?? loadDatabaseSnapshot;
    const liveSnapshot = await snapshotLoader(options.databaseUrl);
    const canonicalLiveSnapshot = createArtifactFromSnapshot({
      backupId: artifact.manifest.backupId,
      backupLabel: artifact.manifest.backupLabel,
      snapshot: liveSnapshot,
    }).snapshot;
    const artifactTables = new Map(
      artifact.snapshot.tables.map((table) => [table.name, { rowCount: table.rows.length, rowChecksum: sha256(stableStringify(table.rows)), schemaChecksum: sha256(table.createTableSql) }]),
    );
    const mismatchedTables = canonicalLiveSnapshot.tables
      .filter((table) => {
        const artifactTable = artifactTables.get(table.name);
        if (!artifactTable) return true;
        return (
          artifactTable.rowCount !== table.rowCount ||
          artifactTable.rowChecksum !== table.rowChecksum ||
          artifactTable.schemaChecksum !== table.schemaChecksum
        );
      })
      .map((table) => table.name);

    liveDatabaseComparison = {
      ok: mismatchedTables.length === 0,
      databaseName: canonicalLiveSnapshot.databaseName,
      mismatchedTables,
    };
  }

  const ok =
    internalChecks.artifactChecksumVerified &&
    internalChecks.restoreSqlChecksumVerified &&
    internalChecks.schemaChecksumVerified &&
    internalChecks.dataChecksumVerified &&
    (liveDatabaseComparison ? liveDatabaseComparison.ok : true);

  return {
    ok,
    artifactPath: path.resolve(options.artifactPath),
    backupId: artifact.manifest.backupId,
    validatedAt: new Date().toISOString(),
    totalTables: artifact.manifest.tableCount,
    totalRows: artifact.manifest.totalRowCount,
    ...internalChecks,
    ...(liveDatabaseComparison ? { liveDatabaseComparison } : {}),
  } satisfies BackupValidationResult;
}

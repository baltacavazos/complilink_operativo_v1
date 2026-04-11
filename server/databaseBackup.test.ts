import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  createArtifactFromSnapshot,
  createRecoverableDatabaseBackup,
  orderTablesForRestore,
  validateRecoverableDatabaseBackup,
  type DatabaseSnapshot,
} from "./databaseBackup";

const tempDirs: string[] = [];

function createTempDir() {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "auditapatron-db-backup-"));
  tempDirs.push(tempDir);
  return tempDir;
}

function buildSnapshot(): DatabaseSnapshot {
  return {
    databaseName: "auditapatron_test",
    capturedAt: "2026-04-11T18:30:00.000Z",
    tables: [
      {
        name: "users",
        columns: ["id", "email"],
        createTableSql:
          "CREATE TABLE `users` (\n  `id` bigint NOT NULL,\n  `email` varchar(255) NOT NULL,\n  PRIMARY KEY (`id`)\n)",
        referencedTables: [],
        rows: [
          { id: 1, email: "owner@auditapatron.com" },
          { id: 2, email: "cliente@auditapatron.com" },
        ],
        rowCount: 2,
        rowChecksum: "pending",
        schemaChecksum: "pending",
      },
      {
        name: "cases",
        columns: ["id", "userId", "folio"],
        createTableSql:
          "CREATE TABLE `cases` (\n  `id` bigint NOT NULL,\n  `userId` bigint NOT NULL,\n  `folio` varchar(80) NOT NULL,\n  PRIMARY KEY (`id`),\n  KEY `cases_user_idx` (`userId`),\n  CONSTRAINT `cases_user_fk` FOREIGN KEY (`userId`) REFERENCES `users` (`id`)\n)",
        referencedTables: ["users"],
        rows: [{ id: 10, userId: 1, folio: "AUD-001" }],
        rowCount: 1,
        rowChecksum: "pending",
        schemaChecksum: "pending",
      },
    ],
  };
}

describe("databaseBackup", () => {
  afterEach(() => {
    while (tempDirs.length > 0) {
      const tempDir = tempDirs.pop();
      if (tempDir) {
        rmSync(tempDir, { recursive: true, force: true });
      }
    }
  });

  it("ordena primero las tablas padre para restaurar referencias foráneas", () => {
    const order = orderTablesForRestore([
      { name: "cases", referencedTables: ["users"] },
      { name: "users", referencedTables: [] },
      { name: "exports", referencedTables: ["cases", "users"] },
    ]);

    expect(order).toEqual(["users", "cases", "exports"]);
  });

  it("genera un artefacto recuperable con SQL de restauración e integridad verificable", async () => {
    const snapshot = buildSnapshot();
    const outputDir = createTempDir();

    const backup = await createRecoverableDatabaseBackup({
      databaseUrl: "mysql://demo:demo@localhost:3306/auditapatron_test",
      backupLabel: "resilience-sprint",
      outputDir,
      snapshotLoader: async () => snapshot,
      now: new Date("2026-04-11T18:30:00.000Z"),
    });

    expect(backup.manifest.tableCount).toBe(2);
    expect(backup.manifest.totalRowCount).toBe(3);
    expect(backup.artifactPath).toMatch(/\.backup\.json\.gz$/);
    expect(backup.restoreSqlPath).toMatch(/\.restore\.sql$/);

    const validation = await validateRecoverableDatabaseBackup({
      artifactPath: backup.artifactPath,
      snapshotLoader: async () => snapshot,
      databaseUrl: "mysql://demo:demo@localhost:3306/auditapatron_test",
    });

    expect(validation.ok).toBe(true);
    expect(validation.liveDatabaseComparison).toEqual({
      ok: true,
      databaseName: "auditapatron_test",
      mismatchedTables: [],
    });
  });

  it("incluye el esquema y los inserts en el SQL de restauración", () => {
    const artifact = createArtifactFromSnapshot({
      backupId: "db-backup-20260411t183000z",
      backupLabel: "manual",
      snapshot: buildSnapshot(),
    });

    expect(artifact.restoreSql).toContain("DROP TABLE IF EXISTS `cases`;");
    expect(artifact.restoreSql).toContain("CREATE TABLE `users`");
    expect(artifact.restoreSql).toContain("INSERT INTO `cases` (`id`, `userId`, `folio`) VALUES");
    expect(artifact.restoreSql).toContain("SET FOREIGN_KEY_CHECKS = 0;");
    expect(artifact.manifest.tables.map((table) => table.name)).toEqual(["users", "cases"]);
  });
});

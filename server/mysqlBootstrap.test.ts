import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

import { MYSQL_BOOTSTRAP_STATEMENTS } from "./localPasswordAuth";
import {
  ensureMysqlTables,
  mysqlBootstrapCreatesLaborCases,
  resetMysqlBootstrapForTests,
} from "./mysqlBootstrap";

const indexSource = readFileSync(resolve(process.cwd(), "server/_core/index.ts"), "utf8");
const dbSource = readFileSync(resolve(process.cwd(), "server/db.ts"), "utf8");

describe("ensureMysqlTables labor_cases", () => {
  beforeEach(() => {
    resetMysqlBootstrapForTests();
  });

  it("incluye CREATE TABLE IF NOT EXISTS de labor_cases y case_access", () => {
    const sql = MYSQL_BOOTSTRAP_STATEMENTS.join("\n");
    expect(mysqlBootstrapCreatesLaborCases()).toBe(true);
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS `labor_cases`");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS `case_access`");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS `case_advisor_memories`");
    expect(sql).toContain("`case_advisor_memories_scope_uq`");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS `tenant_memberships`");
    expect(sql).toContain("`caseId`");
    expect(sql).toContain("`assignedUserId`");
  });

  it("ejecuta el statement de labor_cases al asegurar tablas", async () => {
    const executed: string[] = [];
    const result = await ensureMysqlTables({
      execute: async (statement) => {
        executed.push(statement);
      },
    });

    expect(result.ran).toBe(true);
    expect(result.ensured).toBe(true);
    expect(executed.some((statement) => statement.includes("CREATE TABLE IF NOT EXISTS `labor_cases`"))).toBe(
      true,
    );
    expect(executed.some((statement) => statement.includes("CREATE TABLE IF NOT EXISTS `case_access`"))).toBe(
      true,
    );
  });

  it("se llama al arrancar el servidor y antes de insertar expedientes", () => {
    expect(indexSource).toContain("await ensureMysqlTables()");
    expect(indexSource).toContain('from "../mysqlBootstrap"');
    expect(dbSource).toContain("await ensureMysqlTables()");
    expect(dbSource).toContain("export async function createCaseRecord");
    expect(dbSource).toContain("export async function ensurePersonalWorkspaceForUser");
    expect(dbSource).toContain("export async function repairPersonalCaseAccess");
    expect(dbSource).toContain("export async function getAdvisorMemoryForUser");
    expect(dbSource).toContain("export async function upsertAdvisorMemory");
    expect(dbSource).toContain("caseAdvisorMemories");
  });
});

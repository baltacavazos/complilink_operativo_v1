import mysql from "mysql2/promise";

import { ENV } from "./_core/env";
import { MYSQL_BOOTSTRAP_STATEMENTS } from "./mysqlBootstrapStatements";

let pool: mysql.Pool | null = null;
let tablesReady = false;

function getBootstrapPool() {
  if (!ENV.databaseUrl.trim()) {
    throw new Error("Falta DATABASE_URL para preparar las tablas.");
  }
  if (!pool) {
    pool = mysql.createPool(ENV.databaseUrl);
  }
  return pool;
}

export function resetMysqlBootstrapForTests() {
  tablesReady = false;
}

export function mysqlBootstrapCreatesLaborCases() {
  return MYSQL_BOOTSTRAP_STATEMENTS.some((statement) =>
    statement.includes("CREATE TABLE IF NOT EXISTS `labor_cases`"),
  );
}

export async function ensureMysqlTables(options?: {
  execute?: (statement: string) => Promise<unknown>;
}) {
  if (tablesReady && !options?.execute) {
    return { ensured: true, ran: false };
  }

  const execute =
    options?.execute ??
    (async (statement: string) => {
      if (!ENV.databaseUrl.trim()) {
        console.warn("[MysqlBootstrap] Falta DATABASE_URL; no se crean tablas.");
        return;
      }
      await getBootstrapPool().query(statement);
    });

  if (!options?.execute && !ENV.databaseUrl.trim()) {
    console.warn("[MysqlBootstrap] Falta DATABASE_URL; no se crean tablas.");
    return { ensured: false, ran: false };
  }

  for (const statement of MYSQL_BOOTSTRAP_STATEMENTS) {
    await execute(statement);
  }

  if (!options?.execute) {
    tablesReady = true;
    console.warn("[MysqlBootstrap] Tablas producto listas (incl. labor_cases, case_access).");
  }

  return { ensured: true, ran: true };
}

import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import mysql from "mysql2/promise";
import type { Request, Response } from "express";

import * as db from "./db";
import { ENV } from "./_core/env";
import { createAppSessionForUser } from "./authService";

const scrypt = promisify(scryptCallback);
const SCRYPT_KEYLEN = 64;
const LOCAL_APP_ID = "auditapatron-local";

let pool: mysql.Pool | null = null;
let tablesReady = false;

export const MYSQL_BOOTSTRAP_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS \`users\` (\n      \`id\` int NOT NULL AUTO_INCREMENT,\n      \`openId\` varchar(64) NOT NULL,\n      \`name\` text,\n      \`email\` varchar(320),\n      \`stripeCustomerId\` varchar(64),\n      \`loginMethod\` varchar(64),\n      \`role\` enum('user','admin') NOT NULL DEFAULT 'user',\n      \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,\n      \`updatedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,\n      \`lastSignedIn\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,\n      PRIMARY KEY (\`id\`),\n      UNIQUE KEY \`users_openId_unique\` (\`openId\`),\n      UNIQUE KEY \`users_stripeCustomerId_unique\` (\`stripeCustomerId\`)\n    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS \`local_logins\` (\n      \`email\` varchar(320) NOT NULL,\n      \`passwordHash\` varchar(255) NOT NULL,\n      \`openId\` varchar(64) NOT NULL,\n      \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,\n      PRIMARY KEY (\`email\`),\n      UNIQUE KEY \`local_logins_openId\` (\`openId\`)\n    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS \`tenants\` (\n      \`id\` int NOT NULL AUTO_INCREMENT,\n      \`tenantId\` varchar(64) NOT NULL,\n      \`traceId\` varchar(96) NOT NULL,\n      \`legalName\` varchar(255) NOT NULL,\n      \`displayName\` varchar(255) NOT NULL,\n      \`status\` enum('pilot','active','inactive') NOT NULL DEFAULT 'pilot',\n      \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,\n      \`updatedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,\n      PRIMARY KEY (\`id\`),\n      UNIQUE KEY \`tenants_tenant_id_uq\` (\`tenantId\`),\n      KEY \`tenants_status_idx\` (\`status\`)\n    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS \`tenant_memberships\` (\n      \`id\` int NOT NULL AUTO_INCREMENT,\n      \`tenantId\` varchar(64) NOT NULL,\n      \`caseId\` varchar(64),\n      \`traceId\` varchar(96) NOT NULL,\n      \`userId\` int NOT NULL,\n      \`role\` enum('tenant_admin','manager','reviewer','viewer') NOT NULL DEFAULT 'viewer',\n      \`accessScope\` enum('tenant','case') NOT NULL DEFAULT 'tenant',\n      \`status\` enum('active','revoked') NOT NULL DEFAULT 'active',\n      \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,\n      \`updatedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,\n      PRIMARY KEY (\`id\`),\n      KEY \`tenant_memberships_user_idx\` (\`userId\`),\n      KEY \`tenant_memberships_tenant_case_idx\` (\`tenantId\`,\`caseId\`)\n    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS \`audit_logs\` (\n      \`id\` int NOT NULL AUTO_INCREMENT,\n      \`tenantId\` varchar(64) NOT NULL,\n      \`caseId\` varchar(64),\n      \`traceId\` varchar(96) NOT NULL,\n      \`documentId\` varchar(64),\n      \`actorUserId\` int,\n      \`entityType\` enum('tenant','case','document','consent','policy','access','system') NOT NULL,\n      \`entityId\` varchar(128) NOT NULL,\n      \`action\` varchar(128) NOT NULL,\n      \`beforeState\` text,\n      \`afterState\` text,\n      \`hashChain\` varchar(255),\n      \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,\n      PRIMARY KEY (\`id\`),\n      KEY \`audit_logs_trace_idx\` (\`traceId\`),\n      KEY \`audit_logs_entity_idx\` (\`entityType\`,\`entityId\`)\n    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS \`labor_cases\` (\n      \`id\` int NOT NULL AUTO_INCREMENT,\n      \`tenantId\` varchar(64) NOT NULL,\n      \`caseId\` varchar(64) NOT NULL,\n      \`traceId\` varchar(96) NOT NULL,\n      \`title\` varchar(255) NOT NULL,\n      \`employeeName\` varchar(255),\n      \`employerEntity\` varchar(255),\n      \`jurisdiction\` varchar(128) NOT NULL DEFAULT 'México',\n      \`status\` enum('intake','analysis','conciliation','litigation','resolved','archived') NOT NULL DEFAULT 'intake',\n      \`priority\` enum('low','medium','high','critical') NOT NULL DEFAULT 'medium',\n      \`assignedUserId\` int,\n      \`summary\` text,\n      \`canonicalPayload\` text,\n      \`openedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,\n      \`dueAt\` timestamp NULL DEFAULT NULL,\n      \`closedAt\` timestamp NULL DEFAULT NULL,\n      \`lastActivityAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,\n      \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,\n      \`updatedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,\n      PRIMARY KEY (\`id\`),\n      UNIQUE KEY \`labor_cases_case_id_uq\` (\`caseId\`),\n      KEY \`labor_cases_tenant_status_idx\` (\`tenantId\`,\`status\`)\n    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS \`case_access\` (\n      \`id\` int NOT NULL AUTO_INCREMENT,\n      \`tenantId\` varchar(64) NOT NULL,\n      \`caseId\` varchar(64) NOT NULL,\n      \`traceId\` varchar(96) NOT NULL,\n      \`userId\` int NOT NULL,\n      \`grantedByUserId\` int,\n      \`accessLevel\` enum('owner','editor','reviewer','viewer') NOT NULL DEFAULT 'viewer',\n      \`status\` enum('active','revoked') NOT NULL DEFAULT 'active',\n      \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,\n      \`updatedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,\n      PRIMARY KEY (\`id\`),\n      KEY \`case_access_case_user_idx\` (\`caseId\`,\`userId\`)\n    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS \`case_events\` (\n      \`id\` int NOT NULL AUTO_INCREMENT,\n      \`tenantId\` varchar(64) NOT NULL,\n      \`caseId\` varchar(64) NOT NULL,\n      \`traceId\` varchar(96) NOT NULL,\n      \`actorUserId\` int,\n      \`eventType\` enum('case_created','status_changed','document_uploaded','document_classified','consent_updated','policy_updated','note_added','alert_raised') NOT NULL,\n      \`title\` varchar(255) NOT NULL,\n      \`description\` text,\n      \`metadata\` text,\n      \`eventAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,\n      \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,\n      PRIMARY KEY (\`id\`)\n    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS \`operational_alerts\` (\n      \`id\` int NOT NULL AUTO_INCREMENT,\n      \`tenantId\` varchar(64) NOT NULL,\n      \`caseId\` varchar(64),\n      \`traceId\` varchar(96) NOT NULL,\n      \`severity\` enum('info','warning','critical') NOT NULL DEFAULT 'warning',\n      \`category\` enum('missing_consent','integrity_gap','overdue_case','upload_pending','access_risk') NOT NULL,\n      \`title\` varchar(255) NOT NULL,\n      \`description\` text,\n      \`status\` enum('open','acknowledged','resolved') NOT NULL DEFAULT 'open',\n      \`raisedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,\n      \`resolvedAt\` timestamp NULL DEFAULT NULL,\n      \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,\n      \`updatedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,\n      PRIMARY KEY (\`id\`)\n    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS \`consent_records\` (\n      \`id\` int NOT NULL AUTO_INCREMENT,\n      \`tenantId\` varchar(64) NOT NULL,\n      \`caseId\` varchar(64) NOT NULL,\n      \`traceId\` varchar(96) NOT NULL,\n      \`documentId\` varchar(64),\n      \`subjectName\` varchar(255) NOT NULL,\n      \`subjectRole\` varchar(128),\n      \`legalBasis\` varchar(255),\n      \`status\` enum('pending','granted','revoked','expired','not_required') NOT NULL DEFAULT 'pending',\n      \`notes\` text,\n      \`grantedAt\` timestamp NULL DEFAULT NULL,\n      \`revokedAt\` timestamp NULL DEFAULT NULL,\n      \`expiresAt\` timestamp NULL DEFAULT NULL,\n      \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,\n      \`updatedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,\n      PRIMARY KEY (\`id\`)\n    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS \`case_documents\` (\n      \`id\` int NOT NULL AUTO_INCREMENT,\n      \`tenantId\` varchar(64) NOT NULL,\n      \`caseId\` varchar(64) NOT NULL,\n      \`traceId\` varchar(96) NOT NULL,\n      \`documentId\` varchar(64) NOT NULL,\n      \`uploadedByUserId\` int,\n      \`supersedesDocumentId\` varchar(64),\n      \`originalName\` varchar(255) NOT NULL,\n      \`mimeType\` varchar(128) NOT NULL,\n      \`sizeBytes\` bigint NOT NULL,\n      \`storageKey\` varchar(512) NOT NULL,\n      \`storageUrl\` varchar(1024) NOT NULL,\n      \`sha256\` varchar(64) NOT NULL,\n      \`documentType\` enum('payroll_receipt','cfdi','imss','contract','settlement','evidence','other') NOT NULL DEFAULT 'other',\n      \`sourceChannel\` enum('manual','email','api','bulk_import') NOT NULL DEFAULT 'manual',\n      \`integrityStatus\` enum('pending','verified','replaced') NOT NULL DEFAULT 'pending',\n      \`consentStatus\` enum('pending','granted','revoked','not_required') NOT NULL DEFAULT 'pending',\n      \`visibility\` enum('case_team','tenant_legal','tenant_hr','restricted') NOT NULL DEFAULT 'case_team',\n      \`classificationConfidence\` int NOT NULL DEFAULT 0,\n      \`processedAt\` timestamp NULL DEFAULT NULL,\n      \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,\n      \`updatedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,\n      PRIMARY KEY (\`id\`),\n      UNIQUE KEY \`case_documents_document_id_uq\` (\`documentId\`)\n    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS \`canonical_contracts\` (\n      \`id\` int NOT NULL AUTO_INCREMENT,\n      \`tenantId\` varchar(64) NOT NULL,\n      \`caseId\` varchar(64),\n      \`traceId\` varchar(96) NOT NULL,\n      \`contractType\` enum('case','intake','document','classification','consent','audit','shared_engine') NOT NULL,\n      \`schemaVersion\` varchar(32) NOT NULL DEFAULT 'v1',\n      \`payload\` text NOT NULL,\n      \`status\` enum('draft','ready','exported') NOT NULL DEFAULT 'draft',\n      \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,\n      \`updatedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,\n      PRIMARY KEY (\`id\`)\n    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
] as const;

export function isLocalPasswordAuthEnabled() {
  const flag = (process.env.ENABLE_LOCAL_PASSWORD_AUTH ?? "").trim();
  if (flag === "0" || flag.toLowerCase() === "false") return false;
  if (flag === "1" || flag.toLowerCase() === "true") return true;
  // Copia Railway sin Resend: correo+código no sirve; se usa contraseña.
  return !ENV.resendApiKey.trim();
}

export function localSessionAppId() {
  return ENV.appId.trim() || LOCAL_APP_ID;
}

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function openIdForEmail(email: string) {
  const digest = createHash("sha256").update(normalizeEmail(email)).digest("hex").slice(0, 48);
  return `email:${digest}`.slice(0, 64);
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(password, salt, SCRYPT_KEYLEN)) as Buffer;
  return `scrypt$${salt}$${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [scheme, salt, hex] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hex) return false;
  const derived = (await scrypt(password, salt, SCRYPT_KEYLEN)) as Buffer;
  const expected = Buffer.from(hex, "hex");
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}

function getPool() {
  if (!ENV.databaseUrl.trim()) {
    throw new Error("Falta DATABASE_URL para guardar cuentas.");
  }
  if (!pool) {
    pool = mysql.createPool(ENV.databaseUrl);
  }
  return pool;
}

export async function ensureLocalAuthTables() {
  if (tablesReady) return;
  if (!ENV.databaseUrl.trim()) {
    console.warn("[LocalAuth] Falta DATABASE_URL; no se crean tablas.");
    return;
  }
  const dbPool = getPool();
  for (const statement of MYSQL_BOOTSTRAP_STATEMENTS) {
    await dbPool.query(statement);
  }
  tablesReady = true;
  console.warn("[LocalAuth] Tablas users, local_logins, tenants, tenant_memberships, audit_logs y expediente (labor_cases…) listas.");
}

/** Same pattern as workspace.bootstrap / CEO resolveCeoAuditTenantId. */
async function ensureActiveTenantMembership(user: {
  id: number;
  name: string | null;
  email: string | null;
}) {
  await db.ensureTenantForUser({
    userId: user.id,
    userName: user.name ?? user.email ?? "CompliLink",
    userEmail: user.email,
  });
}

export async function registerLocalPasswordAccount(input: {
  req: Request;
  res: Response;
  email: string;
  password: string;
  name?: string;
}) {
  if (!isLocalPasswordAuthEnabled()) {
    throw new Error("El acceso con contraseña no está activo en esta copia.");
  }
  if (!ENV.cookieSecret.trim()) {
    throw new Error("Falta JWT_SECRET para firmar la sesión.");
  }

  const email = normalizeEmail(input.email);
  if (!email || !email.includes("@")) {
    throw new Error("Escribe un correo válido.");
  }
  if (input.password.length < 8) {
    throw new Error("La contraseña debe tener al menos 8 caracteres.");
  }

  await ensureLocalAuthTables();
  const openId = openIdForEmail(email);
  const passwordHash = await hashPassword(input.password);
  const name = (input.name?.trim() || email.split("@")[0] || "Usuario AuditaPatron").slice(0, 120);

  try {
    await getPool().execute(
      "INSERT INTO local_logins (email, passwordHash, openId) VALUES (?, ?, ?)",
      [email, passwordHash, openId],
    );
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String((error as { code?: string }).code) : "";
    if (code === "ER_DUP_ENTRY") {
      throw new Error("Ese correo ya tiene una cuenta. Entra con tu contraseña.");
    }
    throw error;
  }

  await db.upsertUser({
    openId,
    name,
    email,
    loginMethod: "email",
    lastSignedIn: new Date(),
  });

  const user = await db.getUserByOpenId(openId);
  if (!user) {
    throw new Error("No se pudo crear la cuenta.");
  }

  await ensureActiveTenantMembership(user);

  await createAppSessionForUser(input.req, input.res, {
    openId: user.openId,
    name: user.name ?? name,
  });

  return user;
}

export async function loginLocalPasswordAccount(input: {
  req: Request;
  res: Response;
  email: string;
  password: string;
}) {
  if (!isLocalPasswordAuthEnabled()) {
    throw new Error("El acceso con contraseña no está activo en esta copia.");
  }
  if (!ENV.cookieSecret.trim()) {
    throw new Error("Falta JWT_SECRET para firmar la sesión.");
  }

  const email = normalizeEmail(input.email);
  if (!email || !input.password) {
    throw new Error("Escribe correo y contraseña.");
  }

  await ensureLocalAuthTables();
  const [rows] = await getPool().execute(
    "SELECT email, passwordHash, openId FROM local_logins WHERE email = ? LIMIT 1",
    [email],
  );
  const record = Array.isArray(rows)
    ? (rows[0] as { email: string; passwordHash: string; openId: string } | undefined)
    : undefined;
  if (!record || !(await verifyPassword(input.password, record.passwordHash))) {
    throw new Error("Correo o contraseña incorrectos.");
  }

  const existing = await db.getUserByOpenId(record.openId);
  const name = existing?.name?.trim() || email.split("@")[0] || "Usuario AuditaPatron";

  await db.upsertUser({
    openId: record.openId,
    name,
    email,
    loginMethod: "email",
    lastSignedIn: new Date(),
  });

  const user = await db.getUserByOpenId(record.openId);
  if (!user) {
    throw new Error("No se pudo abrir la sesión.");
  }

  await ensureActiveTenantMembership(user);

  await createAppSessionForUser(input.req, input.res, {
    openId: user.openId,
    name: user.name ?? name,
  });

  return user;
}

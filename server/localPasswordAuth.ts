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
  `CREATE TABLE IF NOT EXISTS \`users\` (
      \`id\` int NOT NULL AUTO_INCREMENT,
      \`openId\` varchar(64) NOT NULL,
      \`name\` text,
      \`email\` varchar(320),
      \`stripeCustomerId\` varchar(64),
      \`loginMethod\` varchar(64),
      \`role\` enum('user','admin') NOT NULL DEFAULT 'user',
      \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updatedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      \`lastSignedIn\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`users_openId_unique\` (\`openId\`),
      UNIQUE KEY \`users_stripeCustomerId_unique\` (\`stripeCustomerId\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS \`local_logins\` (
      \`email\` varchar(320) NOT NULL,
      \`passwordHash\` varchar(255) NOT NULL,
      \`openId\` varchar(64) NOT NULL,
      \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`email\`),
      UNIQUE KEY \`local_logins_openId\` (\`openId\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  // Soft-boot tenants stack (no FKs) so ensureTenantForUser works on Railway
  // before drizzle migrations have been applied.
  `CREATE TABLE IF NOT EXISTS \`tenants\` (
      \`id\` int NOT NULL AUTO_INCREMENT,
      \`tenantId\` varchar(64) NOT NULL,
      \`traceId\` varchar(96) NOT NULL,
      \`legalName\` varchar(255) NOT NULL,
      \`displayName\` varchar(255) NOT NULL,
      \`status\` enum('pilot','active','inactive') NOT NULL DEFAULT 'pilot',
      \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updatedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`tenants_tenant_id_uq\` (\`tenantId\`),
      KEY \`tenants_status_idx\` (\`status\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS \`tenant_memberships\` (
      \`id\` int NOT NULL AUTO_INCREMENT,
      \`tenantId\` varchar(64) NOT NULL,
      \`caseId\` varchar(64),
      \`traceId\` varchar(96) NOT NULL,
      \`userId\` int NOT NULL,
      \`role\` enum('tenant_admin','manager','reviewer','viewer') NOT NULL DEFAULT 'viewer',
      \`accessScope\` enum('tenant','case') NOT NULL DEFAULT 'tenant',
      \`status\` enum('active','revoked') NOT NULL DEFAULT 'active',
      \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updatedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`tenant_memberships_user_idx\` (\`userId\`),
      KEY \`tenant_memberships_tenant_case_idx\` (\`tenantId\`, \`caseId\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS \`audit_logs\` (
      \`id\` int NOT NULL AUTO_INCREMENT,
      \`tenantId\` varchar(64) NOT NULL,
      \`caseId\` varchar(64),
      \`traceId\` varchar(96) NOT NULL,
      \`documentId\` varchar(64),
      \`actorUserId\` int,
      \`entityType\` enum('tenant','case','document','consent','policy','access','system') NOT NULL,
      \`entityId\` varchar(128) NOT NULL,
      \`action\` varchar(128) NOT NULL,
      \`beforeState\` text,
      \`afterState\` text,
      \`hashChain\` varchar(255),
      \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`audit_logs_trace_idx\` (\`traceId\`),
      KEY \`audit_logs_entity_idx\` (\`entityType\`, \`entityId\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
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
  console.warn("[LocalAuth] Tablas users, local_logins, tenants, tenant_memberships y audit_logs listas.");
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

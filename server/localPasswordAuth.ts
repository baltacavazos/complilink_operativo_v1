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
  console.warn("[LocalAuth] Tablas users y local_logins listas.");
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

  await createAppSessionForUser(input.req, input.res, {
    openId: user.openId,
    name: user.name ?? name,
  });

  return user;
}

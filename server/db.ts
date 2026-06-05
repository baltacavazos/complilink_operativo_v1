import { createHash } from "node:crypto";
import { and, asc, count, desc, eq, gte, inArray, isNull, like, lte, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { createPool, type Pool } from "mysql2/promise";
import {
  auditLogs,
  canonicalContracts,
  caseAccess,
  ceoBridgePresets,
  ceoBridgeSchedules,
  caseDocuments,
  caseEvents,
  commercePayments,
  commerceSubscriptions,
  compliLinkWebhookEvents,
  consentRecords,
  documentPolicies,
  InsertAuditLog,
  InsertCanonicalContract,
  InsertCaseAccess,
  InsertCeoBridgePreset,
  InsertCeoBridgeSchedule,
  InsertCaseDocument,
  InsertCaseEvent,
  InsertCommercePayment,
  InsertCommerceSubscription,
  InsertCompliLinkWebhookEvent,
  InsertConsentRecord,
  InsertDocumentPolicy,
  InsertLaborCase,
  InsertOperationalAlert,
  InsertTenant,
  InsertTenantMembership,
  InsertUser,
  laborCases,
  operationalAlerts,
  tenantMemberships,
  tenants,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";
import type { HeliosOpinion, HeliosOpinionContract } from "./heliosIntegrationService";
import { deriveBridgeCallbackAlerts } from "./operationalSignals";

let _db: ReturnType<typeof drizzle> | null = null;
let _lockPool: Pool | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

async function getLockPool() {
  if (!_lockPool && process.env.DATABASE_URL) {
    try {
      _lockPool = createPool(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to create lock pool:", error);
      _lockPool = null;
    }
  }
  return _lockPool;
}

function readLockResult(rows: unknown, field: string) {
  if (!Array.isArray(rows) || rows.length === 0) return 0;
  const firstRow = rows[0] as Record<string, unknown>;
  const value = firstRow?.[field];
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string") return Number.parseInt(value, 10) || 0;
  return 0;
}

function emitDatabaseLockTelemetry(level: "info" | "warn", event: string, payload: Record<string, unknown>) {
  const body = JSON.stringify({
    source: "withDatabaseLock",
    event,
    ...payload,
  });

  if (level === "warn") {
    console.warn(`[DatabaseLock] ${body}`);
    return;
  }

  console.info(`[DatabaseLock] ${body}`);
}

export class DatabaseLockContentionError extends Error {
  readonly code = "DATABASE_LOCK_CONFLICT";
  readonly lockKey: string;
  readonly timeoutSeconds: number;
  readonly waitTimeMs: number;

  constructor(params: { lockKey: string; timeoutSeconds: number; waitTimeMs: number }) {
    super("No se pudo asegurar la aceptación legal en este momento. Intenta de nuevo.");
    this.name = "DatabaseLockContentionError";
    this.lockKey = params.lockKey;
    this.timeoutSeconds = params.timeoutSeconds;
    this.waitTimeMs = params.waitTimeMs;
  }
}

export function isDatabaseLockContentionError(error: unknown): error is DatabaseLockContentionError {
  return error instanceof DatabaseLockContentionError;
}

export async function withDatabaseLock<T>(params: {
  lockKey: string;
  timeoutSeconds?: number;
  action: () => Promise<T>;
}) {
  const lockPool = await getLockPool();
  if (!lockPool) throw new Error("Database not available");

  const lockKey = params.lockKey.trim().slice(0, 64);
  const timeoutSeconds = Math.max(1, Math.min(params.timeoutSeconds ?? 10, 30));
  const connection = await lockPool.getConnection();
  const requestStartedAt = Date.now();
  let acquired = false;
  let lockHeldStartedAt: number | null = null;

  try {
    const [acquiredRows] = await connection.query("SELECT GET_LOCK(?, ?) AS acquired", [lockKey, timeoutSeconds]);
    const waitTimeMs = Date.now() - requestStartedAt;
    acquired = readLockResult(acquiredRows, "acquired") === 1;

    if (!acquired) {
      emitDatabaseLockTelemetry("warn", "lock_conflict", {
        lockKey,
        timeoutSeconds,
        waitTimeMs,
      });
      throw new DatabaseLockContentionError({
        lockKey,
        timeoutSeconds,
        waitTimeMs,
      });
    }

    lockHeldStartedAt = Date.now();
    emitDatabaseLockTelemetry("info", "lock_acquired", {
      lockKey,
      timeoutSeconds,
      waitTimeMs,
    });

    return await params.action();
  } finally {
    if (acquired) {
      try {
        await connection.query("SELECT RELEASE_LOCK(?) AS released", [lockKey]);
        emitDatabaseLockTelemetry("info", "lock_released", {
          lockKey,
          timeoutSeconds,
          holdTimeMs: lockHeldStartedAt ? Date.now() - lockHeldStartedAt : null,
        });
      } catch (error) {
        connection.destroy();
        throw error;
      }
    }

    connection.release();
  }
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user by email: database not available");
    return undefined;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const adminPriority = sql<number>`case when ${users.role} = 'admin' then 1 else 0 end`;
  const result = await db
    .select()
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .orderBy(desc(adminPriority), desc(users.lastSignedIn), desc(users.id))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(userId: number) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user by id: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByStripeCustomerId(stripeCustomerId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user by Stripe customer id: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.stripeCustomerId, stripeCustomerId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function linkStripeCustomerToUser(params: { userId: number; stripeCustomerId: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(users)
    .set({
      stripeCustomerId: params.stripeCustomerId,
      updatedAt: new Date(),
    })
    .where(eq(users.id, params.userId));
}

export async function upsertCommerceSubscription(input: InsertCommerceSubscription) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const values: InsertCommerceSubscription = {
    userId: input.userId,
    stripeCustomerId: input.stripeCustomerId,
    stripeSubscriptionId: input.stripeSubscriptionId,
    stripePriceId: input.stripePriceId ?? null,
    planKey: input.planKey,
    status: input.status,
    latestInvoiceId: input.latestInvoiceId ?? null,
    currentPeriodEnd: input.currentPeriodEnd ?? null,
  };

  await db.insert(commerceSubscriptions).values(values).onDuplicateKeyUpdate({
    set: {
      userId: values.userId,
      stripeCustomerId: values.stripeCustomerId,
      stripePriceId: values.stripePriceId,
      planKey: values.planKey,
      status: values.status,
      latestInvoiceId: values.latestInvoiceId,
      currentPeriodEnd: values.currentPeriodEnd,
      updatedAt: new Date(),
    },
  });
}

export async function upsertCommercePayment(input: InsertCommercePayment) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const values: InsertCommercePayment = {
    userId: input.userId ?? null,
    stripeCustomerId: input.stripeCustomerId ?? null,
    stripeCheckoutSessionId: input.stripeCheckoutSessionId ?? null,
    stripePaymentIntentId: input.stripePaymentIntentId ?? null,
    stripeInvoiceId: input.stripeInvoiceId ?? null,
    stripeSubscriptionId: input.stripeSubscriptionId ?? null,
    productKey: input.productKey,
    productLabel: input.productLabel,
    productType: input.productType,
    amountTotal: input.amountTotal,
    currency: input.currency ?? "mxn",
    paymentStatus: input.paymentStatus,
    paidAt: input.paidAt ?? new Date(),
  };

  await db.insert(commercePayments).values(values).onDuplicateKeyUpdate({
    set: {
      userId: values.userId,
      stripeCustomerId: values.stripeCustomerId,
      stripeSubscriptionId: values.stripeSubscriptionId,
      productKey: values.productKey,
      productLabel: values.productLabel,
      productType: values.productType,
      amountTotal: values.amountTotal,
      currency: values.currency,
      paymentStatus: values.paymentStatus,
      paidAt: values.paidAt,
      updatedAt: new Date(),
    },
  });
}

export async function getStoredCommerceStatusForUser(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [user] = await db
    .select({ stripeCustomerId: users.stripeCustomerId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const subscriptions = await db
    .select()
    .from(commerceSubscriptions)
    .where(eq(commerceSubscriptions.userId, userId))
    .orderBy(desc(commerceSubscriptions.updatedAt), desc(commerceSubscriptions.id));

  const payments = await db
    .select()
    .from(commercePayments)
    .where(eq(commercePayments.userId, userId))
    .orderBy(desc(commercePayments.paidAt), desc(commercePayments.id));

  return {
    stripeCustomerId: user?.stripeCustomerId ?? null,
    subscriptions,
    payments,
  };
}

export async function listCommercePaymentsForUser(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db
    .select()
    .from(commercePayments)
    .where(eq(commercePayments.userId, userId))
    .orderBy(desc(commercePayments.paidAt), desc(commercePayments.id));
}

function toJson<T>(value: T) {
  return JSON.stringify(value ?? null);
}

function parseJsonSafely<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export type CeoBridgeDateWindowDays = 7 | 30 | 90 | 365;

export type CeoBridgePresetFilters = {
  tenantId?: string;
  severity?: string;
  caseId?: string;
  userId?: number;
  dateWindowDays?: CeoBridgeDateWindowDays;
  query?: string;
};

export type CeoBridgePresetRecord = {
  id: number;
  userId: number;
  tenantId: string | null;
  name: string;
  description: string | null;
  filters: CeoBridgePresetFilters;
  exportFormat: "csv" | "pdf";
  emailRecipients: string[];
  emailMessage: string | null;
  smokeThreshold: number;
  createdAt: string;
  updatedAt: string;
};

export type CeoBridgeScheduleRecord = {
  id: number;
  presetId: number;
  userId: number;
  tenantId: string | null;
  cronExpression: string;
  timezone: string;
  nextRunAt: string | null;
  lastRunAt: string | null;
  lastRunStatus: string | null;
  lastRunError: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type AuditarViewStateRecord = {
  historyFilter?: "all" | "document" | "response" | "summary";
  mobileOnboardingIndex?: number;
  selectedRecommendedTargetType?: "payroll_receipt" | "cfdi" | "contract" | "imss" | "evidence" | null;
  preferredCaptureMode?: "camera" | "file" | null;
  preferredTone?: "brief" | "explained";
};

function normalizeAuditarViewState(value: unknown): AuditarViewStateRecord {
  if (!value || typeof value !== "object") {
    return {};
  }

  const record = value as Record<string, unknown>;
  const historyFilter =
    record.historyFilter === "all" ||
    record.historyFilter === "document" ||
    record.historyFilter === "response" ||
    record.historyFilter === "summary"
      ? (record.historyFilter as AuditarViewStateRecord["historyFilter"])
      : undefined;
  const mobileOnboardingIndex =
    typeof record.mobileOnboardingIndex === "number" && Number.isFinite(record.mobileOnboardingIndex)
      ? Math.min(Math.max(Math.trunc(record.mobileOnboardingIndex), 0), 2)
      : undefined;
  const selectedRecommendedTargetType =
    record.selectedRecommendedTargetType === null
      ? null
      : record.selectedRecommendedTargetType === "payroll_receipt" ||
          record.selectedRecommendedTargetType === "cfdi" ||
          record.selectedRecommendedTargetType === "contract" ||
          record.selectedRecommendedTargetType === "imss" ||
          record.selectedRecommendedTargetType === "evidence"
        ? (record.selectedRecommendedTargetType as AuditarViewStateRecord["selectedRecommendedTargetType"])
        : undefined;
  const preferredCaptureMode =
    record.preferredCaptureMode === null
      ? null
      : record.preferredCaptureMode === "camera" || record.preferredCaptureMode === "file"
        ? (record.preferredCaptureMode as AuditarViewStateRecord["preferredCaptureMode"])
        : undefined;
  const preferredTone =
    record.preferredTone === "brief" || record.preferredTone === "explained"
      ? (record.preferredTone as AuditarViewStateRecord["preferredTone"])
      : undefined;

  return {
    historyFilter,
    mobileOnboardingIndex,
    selectedRecommendedTargetType,
    preferredCaptureMode,
    preferredTone,
  };
}

function normalizeCeoBridgePresetFilters(value: unknown): CeoBridgePresetFilters {
  if (!value || typeof value !== "object") {
    return {};
  }

  const record = value as Record<string, unknown>;
  const dateWindowDays =
    record.dateWindowDays === 7 ||
    record.dateWindowDays === 30 ||
    record.dateWindowDays === 90 ||
    record.dateWindowDays === 365
      ? (record.dateWindowDays as CeoBridgeDateWindowDays)
      : undefined;

  return {
    tenantId: typeof record.tenantId === "string" && record.tenantId.trim() ? record.tenantId.trim() : undefined,
    severity: typeof record.severity === "string" && record.severity.trim() ? record.severity.trim() : undefined,
    caseId: typeof record.caseId === "string" && record.caseId.trim() ? record.caseId.trim() : undefined,
    userId:
      typeof record.userId === "number" && Number.isFinite(record.userId) && record.userId > 0
        ? Math.trunc(record.userId)
        : undefined,
    dateWindowDays,
    query: typeof record.query === "string" && record.query.trim() ? record.query.trim().slice(0, 160) : undefined,
  };
}

function normalizeRecipientEmails(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 5);
}

function serializeTimestamp(value: Date | string | null | undefined) {
  if (!value) return null;
  if (typeof value === "string") return value;
  return value.toISOString();
}

function normalizeCeoBridgePresetRow(
  row: typeof ceoBridgePresets.$inferSelect,
): CeoBridgePresetRecord {
  return {
    id: row.id,
    userId: row.userId,
    tenantId: row.tenantId ?? null,
    name: row.name,
    description: row.description ?? null,
    filters: normalizeCeoBridgePresetFilters(parseJsonSafely(row.filtersJson) ?? {}),
    exportFormat: row.exportFormat,
    emailRecipients: normalizeRecipientEmails(parseJsonSafely(row.emailRecipientsJson ?? "[]") ?? []),
    emailMessage: row.emailMessage ?? null,
    smokeThreshold: Math.max(1, Math.min(row.smokeThreshold ?? 3, 99)),
    createdAt: serializeTimestamp(row.createdAt) ?? new Date().toISOString(),
    updatedAt: serializeTimestamp(row.updatedAt) ?? new Date().toISOString(),
  };
}

function normalizeCeoBridgeScheduleRow(
  row: typeof ceoBridgeSchedules.$inferSelect,
): CeoBridgeScheduleRecord {
  return {
    id: row.id,
    presetId: row.presetId,
    userId: row.userId,
    tenantId: row.tenantId ?? null,
    cronExpression: row.cronExpression,
    timezone: row.timezone,
    nextRunAt: serializeTimestamp(row.nextRunAt),
    lastRunAt: serializeTimestamp(row.lastRunAt),
    lastRunStatus: row.lastRunStatus ?? null,
    lastRunError: row.lastRunError ?? null,
    isActive: Boolean(row.isActive),
    createdAt: serializeTimestamp(row.createdAt) ?? new Date().toISOString(),
    updatedAt: serializeTimestamp(row.updatedAt) ?? new Date().toISOString(),
  };
}

function isHeliosOpinionContract(value: unknown): value is HeliosOpinionContract {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<HeliosOpinionContract>;
  return (
    candidate.engine === "helios" &&
    typeof candidate.documentId === "string" &&
    Boolean(candidate.opinion) &&
    typeof candidate.opinion === "object"
  );
}

async function getPersistedHeliosOpinionsByDocument(params: { tenantId: string; caseId: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const rows = await db
    .select({
      payload: canonicalContracts.payload,
      createdAt: canonicalContracts.createdAt,
    })
    .from(canonicalContracts)
    .where(
      and(
        eq(canonicalContracts.tenantId, params.tenantId),
        eq(canonicalContracts.caseId, params.caseId),
        eq(canonicalContracts.contractType, "audit"),
        eq(canonicalContracts.schemaVersion, "helios_v1"),
      ),
    )
    .orderBy(desc(canonicalContracts.createdAt));

  const opinionsByDocument = new Map<string, HeliosOpinion>();

  for (const row of rows) {
    const parsed = parseJsonSafely<HeliosOpinionContract>(row.payload);
    if (!isHeliosOpinionContract(parsed)) continue;
    if (opinionsByDocument.has(parsed.documentId)) continue;
    opinionsByDocument.set(parsed.documentId, parsed.opinion);
  }

  return opinionsByDocument;
}

export function slugifyName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function buildTenantId(displayName: string, seed?: string) {
  const base = slugifyName(displayName) || "tenant";
  const suffix = (seed ?? Date.now().toString(36)).slice(-6).toLowerCase();
  return `${base}-${suffix}`;
}

export function buildCaseId(tenantId: string, seed?: string) {
  const suffix = (seed ?? Date.now().toString(36)).slice(-8).toUpperCase();
  return `CASE-${tenantId.slice(0, 6).toUpperCase()}-${suffix}`;
}

export function buildTraceId(tenantId: string, caseId?: string, seed?: string) {
  const tail = (seed ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`).replace(/[^a-zA-Z0-9]/g, "");
  return ["trace", tenantId, caseId ?? "root", tail].join(".");
}

export async function ensureTenantForUser(params: {
  userId: number;
  userName: string;
  userEmail?: string | null;
}) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const existingMembership = await db
    .select({ tenantId: tenantMemberships.tenantId })
    .from(tenantMemberships)
    .where(and(eq(tenantMemberships.userId, params.userId), eq(tenantMemberships.status, "active")))
    .limit(1);

  if (existingMembership[0]?.tenantId) {
    const tenant = await db.select().from(tenants).where(eq(tenants.tenantId, existingMembership[0].tenantId)).limit(1);
    return tenant[0];
  }

  const displayName = params.userName?.trim() || params.userEmail?.split("@")[0] || "CompliLink Tenant";
  const tenantId = buildTenantId(displayName, String(params.userId));
  const traceId = buildTraceId(tenantId, undefined, String(params.userId));

  const tenantPayload: InsertTenant = {
    tenantId,
    traceId,
    legalName: `${displayName} Legal`,
    displayName,
    status: "pilot",
  };

  await db.insert(tenants).values(tenantPayload);

  const membershipPayload: InsertTenantMembership = {
    tenantId,
    traceId,
    userId: params.userId,
    role: "tenant_admin",
    accessScope: "tenant",
    status: "active",
  };

  await db.insert(tenantMemberships).values(membershipPayload);
  await createAuditLog({
    tenantId,
    traceId,
    actorUserId: params.userId,
    entityType: "tenant",
    entityId: tenantId,
    action: "tenant.bootstrap",
    afterState: tenantPayload,
  });

  const createdTenant = await db.select().from(tenants).where(eq(tenants.tenantId, tenantId)).limit(1);
  return createdTenant[0];
}

export async function getAccessibleTenantIds(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const rows = await db
    .select({ tenantId: tenantMemberships.tenantId })
    .from(tenantMemberships)
    .where(and(eq(tenantMemberships.userId, userId), eq(tenantMemberships.status, "active")));

  return Array.from(new Set(rows.map((row) => row.tenantId)));
}

function normalizeIdentityLabel(value?: string | null) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeIdentityLabel(value?: string | null) {
  return normalizeIdentityLabel(value)
    .split(" ")
    .filter((token) => token.length >= 3);
}

export function documentSeemsToBelongToAnotherPerson(expectedName?: string | null, detectedName?: string | null) {
  const expectedTokens = tokenizeIdentityLabel(expectedName);
  const detectedTokens = tokenizeIdentityLabel(detectedName);

  if (expectedTokens.length < 2 || detectedTokens.length < 2) {
    return false;
  }

  const overlap = expectedTokens.filter((token) => detectedTokens.includes(token));
  return overlap.length < 2;
}

export async function isCeoBypassUser(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db
    .select({ openId: users.openId, role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return result[0]?.role === "admin" && result[0]?.openId === ENV.ownerOpenId;
}

async function getPrimaryCaseIdForUser(userId: number, tenantId?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  if (await isCeoBypassUser(userId)) {
    return null;
  }

  const grantedCases = await db
    .select({ caseId: caseAccess.caseId })
    .from(caseAccess)
    .where(
      and(
        eq(caseAccess.userId, userId),
        eq(caseAccess.status, "active"),
        tenantId ? eq(caseAccess.tenantId, tenantId) : undefined,
      ),
    )
    .orderBy(asc(caseAccess.createdAt));

  const assignedCases = await db
    .select({ caseId: laborCases.caseId })
    .from(laborCases)
    .where(
      and(
        eq(laborCases.assignedUserId, userId),
        tenantId ? eq(laborCases.tenantId, tenantId) : undefined,
      ),
    )
    .orderBy(asc(laborCases.createdAt));

  const orderedCaseIds = Array.from(
    new Set([...grantedCases.map((row) => row.caseId), ...assignedCases.map((row) => row.caseId)]),
  );

  return orderedCaseIds[0] ?? null;
}

export async function getAccessibleCaseIds(userId: number, tenantId?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  if (await isCeoBypassUser(userId)) {
    const rows = await db
      .select({ caseId: caseAccess.caseId })
      .from(caseAccess)
      .where(
        and(
          eq(caseAccess.userId, userId),
          eq(caseAccess.status, "active"),
          tenantId ? eq(caseAccess.tenantId, tenantId) : undefined,
        ),
      );

    return Array.from(new Set(rows.map((row) => row.caseId)));
  }

  const primaryCaseId = await getPrimaryCaseIdForUser(userId, tenantId);
  return primaryCaseId ? [primaryCaseId] : [];
}

export async function assertTenantAccess(userId: number, tenantId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const membership = await db
    .select()
    .from(tenantMemberships)
    .where(
      and(
        eq(tenantMemberships.userId, userId),
        eq(tenantMemberships.tenantId, tenantId),
        eq(tenantMemberships.status, "active"),
      ),
    )
    .limit(1);

  if (!membership[0]) {
    throw new Error("Access denied for tenant");
  }

  return membership[0];
}

export async function assertCaseAccess(userId: number, tenantId: string, caseId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const tenantMembership = await assertTenantAccess(userId, tenantId);
  const ceoBypass = await isCeoBypassUser(userId);

  if (!ceoBypass) {
    const primaryCaseId = await getPrimaryCaseIdForUser(userId, tenantId);
    if (!primaryCaseId) {
      throw new Error("No personal case assigned to this account");
    }

    if (primaryCaseId !== caseId) {
      throw new Error("This account is limited to a single personal case");
    }
  }

  const caseGrant = await db
    .select()
    .from(caseAccess)
    .where(
      and(
        eq(caseAccess.userId, userId),
        eq(caseAccess.tenantId, tenantId),
        eq(caseAccess.caseId, caseId),
        eq(caseAccess.status, "active"),
      ),
    )
    .limit(1);

  if (caseGrant[0]) {
    return caseGrant[0];
  }

  const tenantWide = await db
    .select()
    .from(tenantMemberships)
    .where(
      and(
        eq(tenantMemberships.userId, userId),
        eq(tenantMemberships.tenantId, tenantId),
        eq(tenantMemberships.status, "active"),
        eq(tenantMemberships.accessScope, "tenant"),
      ),
    )
    .limit(1);

  if (!tenantWide[0]) {
    if (!ceoBypass) {
      return tenantMembership;
    }

    throw new Error("Access denied for case");
  }

  return tenantWide[0];
}

export async function assertActiveTenantMember(userId: number, tenantId: string) {
  return assertTenantAccess(userId, tenantId);
}

function hasWriteCapability(membership: { accessLevel?: string | null; role?: string | null }) {
  return (
    membership.accessLevel === "owner" ||
    membership.accessLevel === "editor" ||
    membership.role === "tenant_admin" ||
    membership.role === "manager"
  );
}

function hasAdminCapability(membership: { role?: string | null }) {
  return membership.role === "tenant_admin" || membership.role === "manager";
}

export async function assertCaseWriteAccess(userId: number, tenantId: string, caseId: string) {
  const membership = await assertCaseAccess(userId, tenantId, caseId);
  if (!hasWriteCapability(membership)) {
    throw new Error("Write access denied for case");
  }
  return membership;
}

export async function assertTenantAdminAccess(userId: number, tenantId: string) {
  const membership = await assertTenantAccess(userId, tenantId);
  if (!hasAdminCapability(membership)) {
    throw new Error("Admin access denied for tenant");
  }
  return membership;
}

export async function createCaseRecord(input: InsertLaborCase) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(laborCases).values(input);
  const result = await db.select().from(laborCases).where(eq(laborCases.caseId, input.caseId)).limit(1);
  return result[0];
}

export async function grantCaseAccess(input: InsertCaseAccess) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(caseAccess).values(input);
}

export async function addCaseEvent(input: InsertCaseEvent) {
  await addCaseEvents([input]);
}

export async function addCaseEvents(inputs: InsertCaseEvent[]) {
  if (inputs.length === 0) return;

  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(caseEvents).values(inputs);
}

export async function addDocumentRecord(input: InsertCaseDocument) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(caseDocuments).values(input);
  const result = await db.select().from(caseDocuments).where(eq(caseDocuments.documentId, input.documentId)).limit(1);
  return result[0];
}

export async function addConsentRecord(input: InsertConsentRecord) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(consentRecords).values(input);
}

export async function addPolicyRecord(input: InsertDocumentPolicy) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(documentPolicies).values(input);
}

export async function addOperationalAlert(input: InsertOperationalAlert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(operationalAlerts).values(input);
}

export async function updateOperationalAlertStatus(params: {
  id: number;
  status: (typeof operationalAlerts.status.enumValues)[number];
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const previous = await db.select().from(operationalAlerts).where(eq(operationalAlerts.id, params.id)).limit(1);
  if (!previous[0]) {
    throw new Error("Operational alert not found");
  }

  await db
    .update(operationalAlerts)
    .set({
      status: params.status,
      resolvedAt: params.status === "resolved" ? new Date() : null,
    })
    .where(eq(operationalAlerts.id, params.id));

  const updated = await db.select().from(operationalAlerts).where(eq(operationalAlerts.id, params.id)).limit(1);
  return {
    previous: previous[0],
    updated: updated[0],
  };
}

export async function updateTenantMembershipStatus(params: {
  id: number;
  status: (typeof tenantMemberships.status.enumValues)[number];
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const previous = await db.select().from(tenantMemberships).where(eq(tenantMemberships.id, params.id)).limit(1);
  if (!previous[0]) {
    throw new Error("Tenant membership not found");
  }

  await db
    .update(tenantMemberships)
    .set({
      status: params.status,
    })
    .where(eq(tenantMemberships.id, params.id));

  const updated = await db.select().from(tenantMemberships).where(eq(tenantMemberships.id, params.id)).limit(1);
  return {
    previous: previous[0],
    updated: updated[0],
  };
}

export async function upsertCanonicalContract(input: InsertCanonicalContract) {
  await upsertCanonicalContracts([input]);
}

export async function upsertCanonicalContracts(inputs: InsertCanonicalContract[]) {
  if (inputs.length === 0) return;

  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(canonicalContracts).values(inputs);
}

export async function listCanonicalContractsByType(params: {
  tenantId: string;
  caseId: string;
  contractType: InsertCanonicalContract["contractType"];
  schemaVersion?: string;
  status?: InsertCanonicalContract["status"];
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db
    .select({
      id: canonicalContracts.id,
      payload: canonicalContracts.payload,
      createdAt: canonicalContracts.createdAt,
      updatedAt: canonicalContracts.updatedAt,
      status: canonicalContracts.status,
      schemaVersion: canonicalContracts.schemaVersion,
    })
    .from(canonicalContracts)
    .where(
      and(
        eq(canonicalContracts.tenantId, params.tenantId),
        eq(canonicalContracts.caseId, params.caseId),
        eq(canonicalContracts.contractType, params.contractType),
        params.schemaVersion ? eq(canonicalContracts.schemaVersion, params.schemaVersion) : undefined,
        params.status ? eq(canonicalContracts.status, params.status) : undefined,
      ),
    )
    .orderBy(desc(canonicalContracts.createdAt));
}

export async function getHeliosPublicActivityCount(params?: { since?: Date }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const since = params?.since ?? new Date(Date.now() - 24 * 60 * 60 * 1000);
  const rows = await db
    .select({ total: count(canonicalContracts.id) })
    .from(canonicalContracts)
    .where(
      and(
        eq(canonicalContracts.contractType, "audit"),
        eq(canonicalContracts.schemaVersion, "helios_v1"),
        eq(canonicalContracts.status, "ready"),
        gte(canonicalContracts.createdAt, since),
      ),
    );

  return {
    documentsReviewed: Number(rows[0]?.total ?? 0),
    measuredFrom: since,
  };
}

export async function findAuditLogEntry(params: {
  tenantId: string;
  caseId: string;
  entityType: InsertAuditLog["entityType"];
  entityId: string;
  action: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const rows = await db
    .select({
      id: auditLogs.id,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.tenantId, params.tenantId),
        eq(auditLogs.caseId, params.caseId),
        eq(auditLogs.entityType, params.entityType),
        eq(auditLogs.entityId, params.entityId),
        eq(auditLogs.action, params.action),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}

export async function getAuditarDraftById(params: { tenantId: string; caseId: string; draftId: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const rows = await db
    .select({
      id: canonicalContracts.id,
      traceId: canonicalContracts.traceId,
      payload: canonicalContracts.payload,
      createdAt: canonicalContracts.createdAt,
      updatedAt: canonicalContracts.updatedAt,
    })
    .from(canonicalContracts)
    .where(
      and(
        eq(canonicalContracts.tenantId, params.tenantId),
        eq(canonicalContracts.caseId, params.caseId),
        eq(canonicalContracts.contractType, "classification"),
        eq(canonicalContracts.schemaVersion, "auditar_preview_v1"),
        eq(canonicalContracts.status, "draft"),
      ),
    )
    .orderBy(desc(canonicalContracts.createdAt))
    .limit(25);

  for (const row of rows) {
    const parsed = parseJsonSafely<Record<string, unknown>>(row.payload);
    if (parsed && parsed.draftId === params.draftId) {
      return {
        contractId: row.id,
        traceId: row.traceId,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        payload: parsed,
      };
    }
  }

  return null;
}

function stableSerialize(value: unknown): string {
  if (value === null || value === undefined) {
    return "null";
  }

  if (value instanceof Date) {
    return JSON.stringify(value.toISOString());
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableSerialize(entry)).join(",")}]`;
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entryValue]) => entryValue !== undefined)
      .sort(([left], [right]) => left.localeCompare(right));

    return `{${entries
      .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableSerialize(entryValue)}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

async function getLatestAuditHash(params: { tenantId: string; caseId?: string | null }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const rows = await db
    .select({ hashChain: auditLogs.hashChain })
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.tenantId, params.tenantId),
        params.caseId ? eq(auditLogs.caseId, params.caseId) : isNull(auditLogs.caseId),
      ),
    )
    .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
    .limit(1);

  return rows[0]?.hashChain ?? null;
}

function buildAuditHashChain(params: {
  previousHash: string | null;
  tenantId: string;
  caseId?: string | null;
  traceId: string;
  documentId?: string | null;
  actorUserId?: number | null;
  entityType: InsertAuditLog["entityType"];
  entityId: string;
  action: string;
  beforeState: string | null;
  afterState: string | null;
}) {
  return createHash("sha256")
    .update(
      stableSerialize({
        previousHash: params.previousHash,
        tenantId: params.tenantId,
        caseId: params.caseId ?? "__tenant_scope__",
        traceId: params.traceId,
        documentId: params.documentId ?? null,
        actorUserId: params.actorUserId ?? null,
        entityType: params.entityType,
        entityId: params.entityId,
        action: params.action,
        beforeState: params.beforeState,
        afterState: params.afterState,
      }),
    )
    .digest("hex");
}

type AuditLogPayload = {
  tenantId: string;
  caseId?: string | null;
  traceId: string;
  documentId?: string | null;
  actorUserId?: number | null;
  entityType: InsertAuditLog["entityType"];
  entityId: string;
  action: string;
  beforeState?: unknown;
  afterState?: unknown;
};

function buildAuditLogInsertPayload(input: AuditLogPayload, previousHash: string | null): InsertAuditLog {
  const beforeState = input.beforeState === undefined ? null : toJson(input.beforeState);
  const afterState = input.afterState === undefined ? null : toJson(input.afterState);

  return {
    ...input,
    caseId: input.caseId ?? null,
    beforeState,
    afterState,
    hashChain: buildAuditHashChain({
      previousHash,
      tenantId: input.tenantId,
      caseId: input.caseId,
      traceId: input.traceId,
      documentId: input.documentId,
      actorUserId: input.actorUserId,
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      beforeState,
      afterState,
    }),
  };
}

export async function createAuditLog(input: AuditLogPayload) {
  await createAuditLogs([input]);
}

export async function createAuditLogs(inputs: AuditLogPayload[]) {
  if (inputs.length === 0) return;

  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const tenantId = inputs[0].tenantId;
  const caseId = inputs[0].caseId ?? null;

  for (const input of inputs) {
    if (input.tenantId !== tenantId || (input.caseId ?? null) !== caseId) {
      throw new Error("createAuditLogs requires the same tenantId and caseId for every entry");
    }
  }

  let previousHash = await getLatestAuditHash({ tenantId, caseId });
  const payloads = inputs.map((input) => {
    const payload = buildAuditLogInsertPayload(input, previousHash);
    previousHash = payload.hashChain ?? null;
    return payload;
  });

  await db.insert(auditLogs).values(payloads);
}

export async function persistAuditarViewState(params: {
  userId: number;
  tenantId: string;
  caseId: string;
  traceId: string;
  viewState: AuditarViewStateRecord;
}) {
  await assertCaseAccess(params.userId, params.tenantId, params.caseId);

  const normalizedViewState = normalizeAuditarViewState(params.viewState);

  await createAuditLog({
    tenantId: params.tenantId,
    caseId: params.caseId,
    traceId: params.traceId,
    actorUserId: params.userId,
    entityType: "system",
    entityId: `auditar_view_state:${params.userId}`,
    action: "auditar.view_state.upsert",
    afterState: {
      viewState: normalizedViewState,
      persistedAt: new Date().toISOString(),
    },
  });

  return normalizedViewState;
}

export async function listCasesForUser(params: {
  userId: number;
  tenantId?: string;
  status?: (typeof laborCases.status.enumValues)[number];
  from?: Date;
  to?: Date;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const tenantIds = params.tenantId ? [params.tenantId] : await getAccessibleTenantIds(params.userId);
  if (tenantIds.length === 0) return [];

  const explicitCaseIds = await getAccessibleCaseIds(params.userId, params.tenantId);
  const rows = await db
    .select({
      caseId: laborCases.caseId,
      tenantId: laborCases.tenantId,
      traceId: laborCases.traceId,
      title: laborCases.title,
      employeeName: laborCases.employeeName,
      employerEntity: laborCases.employerEntity,
      status: laborCases.status,
      priority: laborCases.priority,
      summary: laborCases.summary,
      openedAt: laborCases.openedAt,
      dueAt: laborCases.dueAt,
      closedAt: laborCases.closedAt,
      lastActivityAt: laborCases.lastActivityAt,
      updatedAt: laborCases.updatedAt,
      assignedUserId: laborCases.assignedUserId,
      tenantName: tenants.displayName,
    })
    .from(laborCases)
    .innerJoin(tenants, eq(laborCases.tenantId, tenants.tenantId))
    .where(
      and(
        inArray(laborCases.tenantId, tenantIds),
        explicitCaseIds.length > 0
          ? or(inArray(laborCases.caseId, explicitCaseIds), sql`${laborCases.assignedUserId} = ${params.userId}`)
          : undefined,
        params.status ? eq(laborCases.status, params.status) : undefined,
        params.from ? gte(laborCases.updatedAt, params.from) : undefined,
        params.to ? lte(laborCases.updatedAt, params.to) : undefined,
      ),
    )
    .orderBy(desc(laborCases.updatedAt));

  if (explicitCaseIds.length === 0) {
    return rows;
  }

  return rows.filter((row) => tenantIds.includes(row.tenantId));
}

export async function getCaseDetailForUser(params: { userId: number; tenantId: string; caseId: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await assertCaseAccess(params.userId, params.tenantId, params.caseId);

  const [caseRow] = await db
    .select()
    .from(laborCases)
    .where(and(eq(laborCases.tenantId, params.tenantId), eq(laborCases.caseId, params.caseId)))
    .limit(1);

  if (!caseRow) {
    throw new Error("Case not found");
  }

  const [events, documents, consents, alerts, policies, latestAuditarViewStateEntry, dispatchAuditLogs, webhookEvents] = await Promise.all([
    db
      .select()
      .from(caseEvents)
      .where(and(eq(caseEvents.tenantId, params.tenantId), eq(caseEvents.caseId, params.caseId)))
      .orderBy(desc(caseEvents.eventAt)),
    db
      .select()
      .from(caseDocuments)
      .where(and(eq(caseDocuments.tenantId, params.tenantId), eq(caseDocuments.caseId, params.caseId)))
      .orderBy(desc(caseDocuments.createdAt)),
    db
      .select()
      .from(consentRecords)
      .where(and(eq(consentRecords.tenantId, params.tenantId), eq(consentRecords.caseId, params.caseId)))
      .orderBy(desc(consentRecords.updatedAt)),
    db
      .select()
      .from(operationalAlerts)
      .where(and(eq(operationalAlerts.tenantId, params.tenantId), eq(operationalAlerts.caseId, params.caseId)))
      .orderBy(desc(operationalAlerts.raisedAt)),
    db
      .select()
      .from(documentPolicies)
      .where(and(eq(documentPolicies.tenantId, params.tenantId), eq(documentPolicies.caseId, params.caseId)))
      .orderBy(desc(documentPolicies.updatedAt)),
    db
      .select({ afterState: auditLogs.afterState })
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.tenantId, params.tenantId),
          eq(auditLogs.caseId, params.caseId),
          eq(auditLogs.actorUserId, params.userId),
          eq(auditLogs.entityType, "system"),
          eq(auditLogs.action, "auditar.view_state.upsert"),
        ),
      )
      .orderBy(desc(auditLogs.createdAt))
      .limit(1),
    db
      .select({
        id: auditLogs.id,
        documentId: auditLogs.documentId,
        createdAt: auditLogs.createdAt,
        afterState: auditLogs.afterState,
      })
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.tenantId, params.tenantId),
          eq(auditLogs.caseId, params.caseId),
          eq(auditLogs.action, "document.engine_dispatch"),
        ),
      )
      .orderBy(desc(auditLogs.createdAt)),
    db
      .select({
        id: compliLinkWebhookEvents.id,
        documentId: compliLinkWebhookEvents.documentId,
        correlationId: compliLinkWebhookEvents.correlationId,
        createdAt: compliLinkWebhookEvents.createdAt,
      })
      .from(compliLinkWebhookEvents)
      .where(and(eq(compliLinkWebhookEvents.tenantId, params.tenantId), eq(compliLinkWebhookEvents.caseId, params.caseId)))
      .orderBy(desc(compliLinkWebhookEvents.createdAt)),
  ]);

  const auditarViewStatePayload = latestAuditarViewStateEntry[0]?.afterState
    ? parseJsonSafely<{ viewState?: unknown }>(latestAuditarViewStateEntry[0].afterState)
    : null;

  const derivedBridgeAlerts = deriveBridgeCallbackAlerts({
    dispatchAuditLogs,
    webhookEvents,
    tenantId: params.tenantId,
    caseId: params.caseId,
    traceId: caseRow.traceId,
  });
  const mergedAlerts = [...derivedBridgeAlerts, ...alerts].sort(
    (left, right) => new Date(right.raisedAt).getTime() - new Date(left.raisedAt).getTime(),
  );

  return {
    case: caseRow,
    events,
    documents,
    consents,
    alerts: mergedAlerts,
    policies,
    auditarViewState: normalizeAuditarViewState(auditarViewStatePayload?.viewState ?? auditarViewStatePayload),
  };
}

export async function getDashboardForUser(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const tenantIds = await getAccessibleTenantIds(userId);
  if (tenantIds.length === 0) {
    return {
      totals: {
        activeCases: 0,
        totalDocuments: 0,
        openAlerts: 0,
        pendingConsents: 0,
      },
      casesByStatus: [],
      alertsBySeverity: [],
      recentCases: [],
    };
  }

  const [activeCasesRow] = await db
    .select({ value: count() })
    .from(laborCases)
    .where(and(inArray(laborCases.tenantId, tenantIds), or(eq(laborCases.status, "intake"), eq(laborCases.status, "analysis"), eq(laborCases.status, "conciliation"), eq(laborCases.status, "litigation"))));

  const [documentsRow] = await db
    .select({ value: count() })
    .from(caseDocuments)
    .where(inArray(caseDocuments.tenantId, tenantIds));

  const [alertsRow] = await db
    .select({ value: count() })
    .from(operationalAlerts)
    .where(and(inArray(operationalAlerts.tenantId, tenantIds), eq(operationalAlerts.status, "open")));

  const [consentsRow] = await db
    .select({ value: count() })
    .from(consentRecords)
    .where(and(inArray(consentRecords.tenantId, tenantIds), eq(consentRecords.status, "pending")));

  const casesByStatus = await db
    .select({ status: laborCases.status, total: count() })
    .from(laborCases)
    .where(inArray(laborCases.tenantId, tenantIds))
    .groupBy(laborCases.status)
    .orderBy(laborCases.status);

  const alertsBySeverity = await db
    .select({ severity: operationalAlerts.severity, total: count() })
    .from(operationalAlerts)
    .where(and(inArray(operationalAlerts.tenantId, tenantIds), eq(operationalAlerts.status, "open")))
    .groupBy(operationalAlerts.severity)
    .orderBy(operationalAlerts.severity);

  const recentCases = await db
    .select({
      caseId: laborCases.caseId,
      title: laborCases.title,
      tenantId: laborCases.tenantId,
      status: laborCases.status,
      priority: laborCases.priority,
      updatedAt: laborCases.updatedAt,
      tenantName: tenants.displayName,
    })
    .from(laborCases)
    .innerJoin(tenants, eq(laborCases.tenantId, tenants.tenantId))
    .where(inArray(laborCases.tenantId, tenantIds))
    .orderBy(desc(laborCases.updatedAt))
    .limit(5);

  return {
    totals: {
      activeCases: Number(activeCasesRow?.value ?? 0),
      totalDocuments: Number(documentsRow?.value ?? 0),
      openAlerts: Number(alertsRow?.value ?? 0),
      pendingConsents: Number(consentsRow?.value ?? 0),
    },
    casesByStatus,
    alertsBySeverity,
    recentCases,
  };
}

type CeoDashboardSnapshotFilters = {
  tenantId?: string;
  severity?: string;
  caseId?: string;
  userId?: number;
  dateWindowDays?: number;
  query?: string;
};

const normalizeFilterValue = (value: unknown) => String(value ?? "").trim().toLowerCase();

const matchesFreeText = (query: string | undefined, values: unknown[]) => {
  const needle = normalizeFilterValue(query);
  if (!needle) return true;

  return values.some((value) => normalizeFilterValue(value).includes(needle));
};

const matchesDateWindow = (value: Date | string | number | null | undefined, dateWindowDays?: number) => {
  if (!dateWindowDays || dateWindowDays <= 0) return true;
  if (!value) return false;

  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return false;

  return parsed.getTime() >= Date.now() - dateWindowDays * 24 * 60 * 60 * 1000;
};

export async function getCeoDashboardSnapshot(filters: CeoDashboardSnapshotFilters = {}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const activeCaseFilter = or(
    eq(laborCases.status, "intake"),
    eq(laborCases.status, "analysis"),
    eq(laborCases.status, "conciliation"),
    eq(laborCases.status, "litigation"),
  );
  const openAlertFilter = eq(operationalAlerts.status, "open");

  const [
    [tenantRow],
    [activeCasesRow],
    [documentsRow],
    [openAlertsRow],
    [criticalAlertsRow],
    [activeMembershipsRow],
    [caseScopedMembershipsRow],
    [pendingDocumentsRow],
    [pendingConsentsRow],
    [supersededDocumentsRow],
    casesByStatusRaw,
    alertsBySeverityRaw,
    tenantRows,
    activeCasesByTenantRaw,
    openAlertsByTenantRaw,
    activeMembershipsByTenantRaw,
    caseScopedMembershipsByTenantRaw,
    pendingDocumentsByTenantRaw,
    recentCases,
    recentAlertsRaw,
    recentMembershipsRaw,
    recentDocumentsRaw,
  ] = await Promise.all([
    db.select({ value: count() }).from(tenants),
    db.select({ value: count() }).from(laborCases).where(activeCaseFilter),
    db.select({ value: count() }).from(caseDocuments),
    db.select({ value: count() }).from(operationalAlerts).where(openAlertFilter),
    db
      .select({ value: count() })
      .from(operationalAlerts)
      .where(and(openAlertFilter, eq(operationalAlerts.severity, "critical"))),
    db.select({ value: count() }).from(tenantMemberships).where(eq(tenantMemberships.status, "active")),
    db
      .select({ value: count() })
      .from(tenantMemberships)
      .where(and(eq(tenantMemberships.status, "active"), eq(tenantMemberships.accessScope, "case"))),
    db.select({ value: count() }).from(caseDocuments).where(eq(caseDocuments.integrityStatus, "pending")),
    db.select({ value: count() }).from(consentRecords).where(eq(consentRecords.status, "pending")),
    db.select({ value: count() }).from(caseDocuments).where(eq(caseDocuments.integrityStatus, "replaced")),
    db
      .select({ status: laborCases.status, total: count() })
      .from(laborCases)
      .groupBy(laborCases.status)
      .orderBy(laborCases.status),
    db
      .select({ severity: operationalAlerts.severity, total: count() })
      .from(operationalAlerts)
      .where(openAlertFilter)
      .groupBy(operationalAlerts.severity)
      .orderBy(operationalAlerts.severity),
    db
      .select({
        tenantId: tenants.tenantId,
        displayName: tenants.displayName,
        status: tenants.status,
        updatedAt: tenants.updatedAt,
      })
      .from(tenants)
      .orderBy(tenants.displayName),
    db
      .select({ tenantId: laborCases.tenantId, total: count() })
      .from(laborCases)
      .where(activeCaseFilter)
      .groupBy(laborCases.tenantId),
    db
      .select({ tenantId: operationalAlerts.tenantId, total: count() })
      .from(operationalAlerts)
      .where(openAlertFilter)
      .groupBy(operationalAlerts.tenantId),
    db
      .select({ tenantId: tenantMemberships.tenantId, total: count() })
      .from(tenantMemberships)
      .where(eq(tenantMemberships.status, "active"))
      .groupBy(tenantMemberships.tenantId),
    db
      .select({ tenantId: tenantMemberships.tenantId, total: count() })
      .from(tenantMemberships)
      .where(and(eq(tenantMemberships.status, "active"), eq(tenantMemberships.accessScope, "case")))
      .groupBy(tenantMemberships.tenantId),
    db
      .select({ tenantId: caseDocuments.tenantId, total: count() })
      .from(caseDocuments)
      .where(eq(caseDocuments.integrityStatus, "pending"))
      .groupBy(caseDocuments.tenantId),
    db
      .select({
        caseId: laborCases.caseId,
        title: laborCases.title,
        tenantId: laborCases.tenantId,
        tenantName: tenants.displayName,
        status: laborCases.status,
        priority: laborCases.priority,
        dueAt: laborCases.dueAt,
        lastActivityAt: laborCases.lastActivityAt,
        updatedAt: laborCases.updatedAt,
      })
      .from(laborCases)
      .innerJoin(tenants, eq(laborCases.tenantId, tenants.tenantId))
      .orderBy(desc(laborCases.lastActivityAt), desc(laborCases.updatedAt))
      .limit(8),
    db
      .select({
        id: operationalAlerts.id,
        tenantId: operationalAlerts.tenantId,
        tenantName: tenants.displayName,
        caseId: operationalAlerts.caseId,
        traceId: operationalAlerts.traceId,
        severity: operationalAlerts.severity,
        category: operationalAlerts.category,
        title: operationalAlerts.title,
        description: operationalAlerts.description,
        status: operationalAlerts.status,
        raisedAt: operationalAlerts.raisedAt,
        updatedAt: operationalAlerts.updatedAt,
        resolvedAt: operationalAlerts.resolvedAt,
      })
      .from(operationalAlerts)
      .innerJoin(tenants, eq(operationalAlerts.tenantId, tenants.tenantId))
      .orderBy(desc(operationalAlerts.raisedAt), desc(operationalAlerts.updatedAt))
      .limit(12),
    db
      .select({
        id: tenantMemberships.id,
        tenantId: tenantMemberships.tenantId,
        tenantName: tenants.displayName,
        caseId: tenantMemberships.caseId,
        userId: tenantMemberships.userId,
        userName: users.name,
        userEmail: users.email,
        role: tenantMemberships.role,
        accessScope: tenantMemberships.accessScope,
        status: tenantMemberships.status,
        createdAt: tenantMemberships.createdAt,
        updatedAt: tenantMemberships.updatedAt,
      })
      .from(tenantMemberships)
      .innerJoin(users, eq(tenantMemberships.userId, users.id))
      .innerJoin(tenants, eq(tenantMemberships.tenantId, tenants.tenantId))
      .orderBy(desc(tenantMemberships.updatedAt), desc(tenantMemberships.createdAt))
      .limit(12),
    db
      .select({
        documentId: caseDocuments.documentId,
        supersedesDocumentId: caseDocuments.supersedesDocumentId,
        tenantId: caseDocuments.tenantId,
        tenantName: tenants.displayName,
        caseId: caseDocuments.caseId,
        caseTitle: laborCases.title,
        originalName: caseDocuments.originalName,
        documentType: caseDocuments.documentType,
        integrityStatus: caseDocuments.integrityStatus,
        consentStatus: caseDocuments.consentStatus,
        visibility: caseDocuments.visibility,
        classificationConfidence: caseDocuments.classificationConfidence,
        traceId: caseDocuments.traceId,
        createdAt: caseDocuments.createdAt,
        updatedAt: caseDocuments.updatedAt,
      })
      .from(caseDocuments)
      .innerJoin(laborCases, eq(caseDocuments.caseId, laborCases.caseId))
      .innerJoin(tenants, eq(caseDocuments.tenantId, tenants.tenantId))
      .orderBy(desc(caseDocuments.createdAt), desc(caseDocuments.updatedAt))
      .limit(12),
  ]);

  const caseIds = Array.from(
    new Set(
      [...recentAlertsRaw.map((alert) => alert.caseId), ...recentMembershipsRaw.map((membership) => membership.caseId)].filter(
        (value): value is string => Boolean(value),
      ),
    ),
  );
  const linkedCaseRows = caseIds.length
    ? await db
        .select({ caseId: laborCases.caseId, title: laborCases.title })
        .from(laborCases)
        .where(inArray(laborCases.caseId, caseIds))
    : [];
  const caseTitles = new Map(linkedCaseRows.map((row) => [row.caseId, row.title]));

  const supersededIds = Array.from(
    new Set(
      recentDocumentsRaw
        .map((document) => document.supersedesDocumentId)
        .filter((value): value is string => Boolean(value)),
    ),
  );
  const supersededRows = supersededIds.length
    ? await db
        .select({
          documentId: caseDocuments.documentId,
          originalName: caseDocuments.originalName,
          createdAt: caseDocuments.createdAt,
          integrityStatus: caseDocuments.integrityStatus,
        })
        .from(caseDocuments)
        .where(inArray(caseDocuments.documentId, supersededIds))
    : [];
  const supersededMap = new Map(supersededRows.map((row) => [row.documentId, row]));

  const toCountMap = <T extends { tenantId: string; total: unknown }>(rows: T[]) =>
    new Map(rows.map((row) => [row.tenantId, Number(row.total ?? 0)]));

  const activeCasesByTenant = toCountMap(activeCasesByTenantRaw);
  const openAlertsByTenant = toCountMap(openAlertsByTenantRaw);
  const activeMembershipsByTenant = toCountMap(activeMembershipsByTenantRaw);
  const caseScopedMembershipsByTenant = toCountMap(caseScopedMembershipsByTenantRaw);
  const pendingDocumentsByTenant = toCountMap(pendingDocumentsByTenantRaw);

  const normalizedFilters = {
    tenantId: filters.tenantId?.trim() || undefined,
    severity: filters.severity?.trim() || undefined,
    caseId: filters.caseId?.trim() || undefined,
    userId: typeof filters.userId === "number" ? filters.userId : undefined,
    dateWindowDays:
      typeof filters.dateWindowDays === "number" && filters.dateWindowDays > 0 ? filters.dateWindowDays : undefined,
    query: filters.query?.trim() || undefined,
  };

  const filtersApplied = {
    ...normalizedFilters,
    active: Boolean(
      normalizedFilters.tenantId ||
        normalizedFilters.severity ||
        normalizedFilters.caseId ||
        normalizedFilters.userId ||
        normalizedFilters.dateWindowDays ||
        normalizedFilters.query,
    ),
  };

  const baseTenantHealth = tenantRows.map((tenant) => ({
    tenantId: tenant.tenantId,
    tenantName: tenant.displayName,
    status: tenant.status,
    updatedAt: tenant.updatedAt,
    activeCases: activeCasesByTenant.get(tenant.tenantId) ?? 0,
    openAlerts: openAlertsByTenant.get(tenant.tenantId) ?? 0,
    activeMemberships: activeMembershipsByTenant.get(tenant.tenantId) ?? 0,
    caseScopedMemberships: caseScopedMembershipsByTenant.get(tenant.tenantId) ?? 0,
    pendingDocuments: pendingDocumentsByTenant.get(tenant.tenantId) ?? 0,
  }));

  const baseRecentCases = recentCases;
  const baseRecentAlerts = recentAlertsRaw.map((alert) => ({
    ...alert,
    caseTitle: alert.caseId ? caseTitles.get(alert.caseId) ?? null : null,
  }));
  const baseRecentMemberships = recentMembershipsRaw.map((membership) => ({
    ...membership,
    caseTitle: membership.caseId ? caseTitles.get(membership.caseId) ?? null : null,
  }));
  const baseRecentDocuments = recentDocumentsRaw.map((document) => ({
    ...document,
    supersededDocument: document.supersedesDocumentId ? supersededMap.get(document.supersedesDocumentId) ?? null : null,
  }));

  const filteredTenantHealth = baseTenantHealth.filter(
    (tenant) =>
      (!normalizedFilters.tenantId || tenant.tenantId === normalizedFilters.tenantId) &&
      matchesFreeText(normalizedFilters.query, [tenant.tenantId, tenant.tenantName, tenant.status]),
  );

  const filteredRecentCases = baseRecentCases.filter(
    (laborCase) =>
      (!normalizedFilters.tenantId || laborCase.tenantId === normalizedFilters.tenantId) &&
      (!normalizedFilters.caseId || laborCase.caseId === normalizedFilters.caseId) &&
      matchesDateWindow(laborCase.lastActivityAt ?? laborCase.updatedAt, normalizedFilters.dateWindowDays) &&
      matchesFreeText(normalizedFilters.query, [
        laborCase.caseId,
        laborCase.title,
        laborCase.tenantId,
        laborCase.tenantName,
        laborCase.status,
        laborCase.priority,
      ]),
  );

  const filteredRecentAlerts = baseRecentAlerts.filter(
    (alert) =>
      (!normalizedFilters.tenantId || alert.tenantId === normalizedFilters.tenantId) &&
      (!normalizedFilters.severity || alert.severity === normalizedFilters.severity) &&
      (!normalizedFilters.caseId || alert.caseId === normalizedFilters.caseId) &&
      matchesDateWindow(alert.raisedAt ?? alert.resolvedAt, normalizedFilters.dateWindowDays) &&
      matchesFreeText(normalizedFilters.query, [
        alert.id,
        alert.title,
        alert.description,
        alert.caseId,
        alert.caseTitle,
        alert.tenantId,
        alert.tenantName,
        alert.category,
        alert.status,
        alert.traceId,
      ]),
  );

  const filteredRecentMemberships = baseRecentMemberships.filter(
    (membership) =>
      (!normalizedFilters.tenantId || membership.tenantId === normalizedFilters.tenantId) &&
      (!normalizedFilters.caseId || membership.caseId === normalizedFilters.caseId) &&
      (!normalizedFilters.userId || membership.userId === normalizedFilters.userId) &&
      matchesDateWindow(membership.updatedAt ?? membership.createdAt, normalizedFilters.dateWindowDays) &&
      matchesFreeText(normalizedFilters.query, [
        membership.id,
        membership.tenantId,
        membership.tenantName,
        membership.caseId,
        membership.caseTitle,
        membership.userId,
        membership.userName,
        membership.userEmail,
        membership.role,
        membership.accessScope,
        membership.status,
      ]),
  );

  const filteredRecentDocuments = baseRecentDocuments.filter(
    (document) =>
      (!normalizedFilters.tenantId || document.tenantId === normalizedFilters.tenantId) &&
      (!normalizedFilters.caseId || document.caseId === normalizedFilters.caseId) &&
      matchesDateWindow(document.updatedAt ?? document.createdAt, normalizedFilters.dateWindowDays) &&
      matchesFreeText(normalizedFilters.query, [
        document.documentId,
        document.originalName,
        document.documentType,
        document.integrityStatus,
        document.consentStatus,
        document.visibility,
        document.tenantId,
        document.tenantName,
        document.caseId,
        document.caseTitle,
        document.traceId,
      ]),
  );

  return {
    generatedAt: new Date(),
    summary: {
      totalTenants: Number(tenantRow?.value ?? 0),
      activeCases: Number(activeCasesRow?.value ?? 0),
      totalDocuments: Number(documentsRow?.value ?? 0),
      openAlerts: Number(openAlertsRow?.value ?? 0),
      criticalAlerts: Number(criticalAlertsRow?.value ?? 0),
      activeMemberships: Number(activeMembershipsRow?.value ?? 0),
      caseScopedMemberships: Number(caseScopedMembershipsRow?.value ?? 0),
      pendingDocuments: Number(pendingDocumentsRow?.value ?? 0),
      pendingConsents: Number(pendingConsentsRow?.value ?? 0),
      supersededDocuments: Number(supersededDocumentsRow?.value ?? 0),
    },
    filteredSummary: {
      visibleTenants: filteredTenantHealth.length,
      visibleCases: filteredRecentCases.length,
      visibleAlerts: filteredRecentAlerts.length,
      visibleMemberships: filteredRecentMemberships.length,
      visibleDocuments: filteredRecentDocuments.length,
    },
    filtersApplied,
    casesByStatus: casesByStatusRaw.map((row) => ({ status: row.status, total: Number(row.total ?? 0) })),
    alertsBySeverity: alertsBySeverityRaw.map((row) => ({ severity: row.severity, total: Number(row.total ?? 0) })),
    tenantHealth: filteredTenantHealth,
    recentCases: filteredRecentCases,
    recentAlerts: filteredRecentAlerts,
    recentMemberships: filteredRecentMemberships,
    recentDocuments: filteredRecentDocuments,
  };
}

export async function getCeoMasterMetrics() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const trackedActions = [
    "dashboard.ceo.console_viewed",
    "dashboard.ceo.guardrail_blocked",
    "dashboard.ceo.export_generated",
  ] as const;
  const last7DaysThreshold = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [actionTotals, last7DaysRows, [uniqueActorsRow], [latestConsoleViewRow], [latestGuardrailRow], [latestExportRow]] =
    await Promise.all([
      db
        .select({ action: auditLogs.action, total: count() })
        .from(auditLogs)
        .where(inArray(auditLogs.action, [...trackedActions]))
        .groupBy(auditLogs.action),
      db
        .select({ action: auditLogs.action, total: count() })
        .from(auditLogs)
        .where(and(inArray(auditLogs.action, [...trackedActions]), gte(auditLogs.createdAt, last7DaysThreshold)))
        .groupBy(auditLogs.action),
      db
        .select({ value: sql<number>`count(distinct ${auditLogs.actorUserId})` })
        .from(auditLogs)
        .where(inArray(auditLogs.action, [...trackedActions])),
      db
        .select({ createdAt: auditLogs.createdAt })
        .from(auditLogs)
        .where(eq(auditLogs.action, "dashboard.ceo.console_viewed"))
        .orderBy(desc(auditLogs.createdAt))
        .limit(1),
      db
        .select({ createdAt: auditLogs.createdAt })
        .from(auditLogs)
        .where(eq(auditLogs.action, "dashboard.ceo.guardrail_blocked"))
        .orderBy(desc(auditLogs.createdAt))
        .limit(1),
      db
        .select({ createdAt: auditLogs.createdAt })
        .from(auditLogs)
        .where(eq(auditLogs.action, "dashboard.ceo.export_generated"))
        .orderBy(desc(auditLogs.createdAt))
        .limit(1),
    ]);

  const toActionCountMap = <T extends { action: string; total: unknown }>(rows: T[]) =>
    new Map(rows.map((row) => [row.action, Number(row.total ?? 0)]));

  const totals = toActionCountMap(actionTotals);
  const last7Days = toActionCountMap(last7DaysRows);

  return {
    generatedAt: new Date(),
    summary: {
      totalConsoleViews: totals.get("dashboard.ceo.console_viewed") ?? 0,
      totalGuardrailBlocks: totals.get("dashboard.ceo.guardrail_blocked") ?? 0,
      totalExports: totals.get("dashboard.ceo.export_generated") ?? 0,
      uniqueActors: Number(uniqueActorsRow?.value ?? 0),
    },
    last7Days: {
      consoleViews: last7Days.get("dashboard.ceo.console_viewed") ?? 0,
      guardrailBlocks: last7Days.get("dashboard.ceo.guardrail_blocked") ?? 0,
      exports: last7Days.get("dashboard.ceo.export_generated") ?? 0,
    },
    latestActivity: {
      consoleViewedAt: latestConsoleViewRow?.createdAt ?? null,
      guardrailBlockedAt: latestGuardrailRow?.createdAt ?? null,
      exportGeneratedAt: latestExportRow?.createdAt ?? null,
    },
  };
}

export async function listTenantsForUser(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const tenantIds = await getAccessibleTenantIds(userId);
  if (tenantIds.length === 0) return [];

  return db.select().from(tenants).where(inArray(tenants.tenantId, tenantIds)).orderBy(tenants.displayName);
}

export async function listAuditTrail(params: { userId: number; tenantId?: string; caseId?: string; limit?: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const tenantIds = params.tenantId ? [params.tenantId] : await getAccessibleTenantIds(params.userId);
  if (tenantIds.length === 0) return [];

  if (params.caseId && params.tenantId) {
    await assertCaseAccess(params.userId, params.tenantId, params.caseId);
  }

  return db
    .select()
    .from(auditLogs)
    .where(
      and(
        inArray(auditLogs.tenantId, tenantIds),
        params.caseId ? eq(auditLogs.caseId, params.caseId) : undefined,
      ),
    )
    .orderBy(desc(auditLogs.createdAt))
    .limit(params.limit ?? 100);
}

export async function listAccessibleUsersByTenant(tenantId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      membershipRole: tenantMemberships.role,
      accessScope: tenantMemberships.accessScope,
      caseId: tenantMemberships.caseId,
    })
    .from(tenantMemberships)
    .innerJoin(users, eq(tenantMemberships.userId, users.id))
    .where(and(eq(tenantMemberships.tenantId, tenantId), eq(tenantMemberships.status, "active")))
    .orderBy(users.name);
}

export async function getDocumentById(documentId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const rows = await db.select().from(caseDocuments).where(eq(caseDocuments.documentId, documentId)).limit(1);
  return rows[0];
}

export async function resolveCompliLinkDocument(params: {
  documentId?: string | null;
  sourceDocumentId?: string | null;
  documentNumericId?: string | number | null;
  remoteDocumentId?: string | number | null;
  correlationId?: string | null;
  traceId?: string | null;
  eventId?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const directCandidates = [params.sourceDocumentId, params.documentId]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map((value) => value.trim());

  for (const candidate of directCandidates) {
    const found = await getDocumentById(candidate);
    if (found) return found;
  }

  const numericCandidates = [params.documentNumericId]
    .map((value) => {
      if (typeof value === "number" && Number.isFinite(value)) return value;
      if (typeof value === "string" && /^\d+$/.test(value.trim())) return Number.parseInt(value.trim(), 10);
      return null;
    })
    .filter((value): value is number => Number.isFinite(value));

  for (const numericId of numericCandidates) {
    const rows = await db.select().from(caseDocuments).where(eq(caseDocuments.id, numericId)).limit(1);
    if (rows[0]) return rows[0];
  }

  const fingerprintPatterns = [
    params.remoteDocumentId != null ? `\"documentId\":${String(params.remoteDocumentId)}` : null,
    params.eventId ? String(params.eventId).trim() : null,
    params.correlationId ? String(params.correlationId).trim() : null,
    params.traceId ? String(params.traceId).trim() : null,
    params.sourceDocumentId ? String(params.sourceDocumentId).trim() : null,
    numericCandidates[0] != null ? `\"documentNumericId\":${numericCandidates[0]}` : null,
  ].filter((value): value is string => typeof value === "string" && value.length > 0);

  if (fingerprintPatterns.length === 0) return null;

  const matches = await db
    .select({
      documentId: auditLogs.documentId,
    })
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.action, "document.engine_dispatch"),
        or(...fingerprintPatterns.map((pattern) => like(auditLogs.afterState, `%${pattern}%`))),
      ),
    )
    .orderBy(desc(auditLogs.createdAt))
    .limit(10);

  for (const match of matches) {
    if (!match.documentId) continue;
    const found = await getDocumentById(match.documentId);
    if (found) return found;
  }

  return null;
}

export async function registerCompliLinkWebhookEvent(entry: InsertCompliLinkWebhookEvent) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  try {
    await db.insert(compliLinkWebhookEvents).values(entry);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.toLowerCase().includes("duplicate entry")) {
      const existing = await db
        .select()
        .from(compliLinkWebhookEvents)
        .where(eq(compliLinkWebhookEvents.eventKey, entry.eventKey))
        .limit(1);

      return {
        created: false as const,
        event: existing[0] ?? null,
      };
    }

    throw error;
  }

  const inserted = await db
    .select()
    .from(compliLinkWebhookEvents)
    .where(eq(compliLinkWebhookEvents.eventKey, entry.eventKey))
    .limit(1);

  return {
    created: true as const,
    event: inserted[0] ?? null,
  };
}

export async function updateCompliLinkWebhookEvent(params: {
  id: number;
  status: (typeof compliLinkWebhookEvents.status.enumValues)[number];
  processedAt?: Date | null;
  failureReason?: string | null;
  compliLinkId?: string | null;
  correlationId?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(compliLinkWebhookEvents)
    .set({
      status: params.status,
      processedAt: params.processedAt ?? undefined,
      failureReason: params.failureReason ?? null,
      compliLinkId: params.compliLinkId ?? undefined,
      correlationId: params.correlationId ?? undefined,
    })
    .where(eq(compliLinkWebhookEvents.id, params.id));

  const updated = await db
    .select()
    .from(compliLinkWebhookEvents)
    .where(eq(compliLinkWebhookEvents.id, params.id))
    .limit(1);

  return updated[0] ?? null;
}

export async function updateDocumentPostProcessing(params: {
  documentId: string;
  documentType: (typeof caseDocuments.documentType.enumValues)[number];
  classificationConfidence: number;
  integrityStatus: (typeof caseDocuments.integrityStatus.enumValues)[number];
  processedAt: Date;
  consentStatus?: (typeof caseDocuments.consentStatus.enumValues)[number];
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(caseDocuments)
    .set({
      documentType: params.documentType,
      classificationConfidence: params.classificationConfidence,
      integrityStatus: params.integrityStatus,
      processedAt: params.processedAt,
      consentStatus: params.consentStatus,
    })
    .where(eq(caseDocuments.documentId, params.documentId));

  const updated = await getDocumentById(params.documentId);
  return updated;
}

export async function updateCaseStatus(params: {
  tenantId: string;
  caseId: string;
  status: (typeof laborCases.status.enumValues)[number];
  priority?: (typeof laborCases.priority.enumValues)[number];
  dueAt?: Date | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(laborCases)
    .set({
      status: params.status,
      priority: params.priority,
      dueAt: params.dueAt,
      lastActivityAt: new Date(),
    })
    .where(and(eq(laborCases.tenantId, params.tenantId), eq(laborCases.caseId, params.caseId)));

  const rows = await db
    .select()
    .from(laborCases)
    .where(and(eq(laborCases.tenantId, params.tenantId), eq(laborCases.caseId, params.caseId)))
    .limit(1);

  return rows[0];
}

export async function listVisibleDocuments(params: { userId: number; tenantId: string; caseId: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const membership = await assertCaseAccess(params.userId, params.tenantId, params.caseId);

  const docs = await db
    .select()
    .from(caseDocuments)
    .where(and(eq(caseDocuments.tenantId, params.tenantId), eq(caseDocuments.caseId, params.caseId)))
    .orderBy(desc(caseDocuments.createdAt));

  const hasElevatedAccess =
    ("accessLevel" in membership && (membership.accessLevel === "owner" || membership.accessLevel === "editor")) ||
    ("role" in membership && (membership.role === "tenant_admin" || membership.role === "manager"));

  const visibleDocuments = hasElevatedAccess
    ? docs
    : docs.filter((doc) => doc.visibility === "case_team" || doc.visibility === "restricted");

  const heliosOpinionsByDocument = await getPersistedHeliosOpinionsByDocument({
    tenantId: params.tenantId,
    caseId: params.caseId,
  });

  return visibleDocuments.map((document) => ({
    ...document,
    heliosOpinion: heliosOpinionsByDocument.get(document.documentId) ?? null,
  }));
}

export async function getVisibleDocumentForUser(params: {
  userId: number;
  tenantId: string;
  caseId: string;
  documentId: string;
}) {
  const visibleDocuments = await listVisibleDocuments({
    userId: params.userId,
    tenantId: params.tenantId,
    caseId: params.caseId,
  });

  const document = visibleDocuments.find((item) => item.documentId === params.documentId);
  if (!document) {
    throw new Error("Document not accessible");
  }

  return document;
}

export async function seedDemoCaseIfEmpty(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const tenantIds = await getAccessibleTenantIds(userId);
  if (tenantIds.length === 0) {
    throw new Error("No accessible tenant found");
  }

  const [caseCount] = await db.select({ value: count() }).from(laborCases).where(inArray(laborCases.tenantId, tenantIds));
  if (Number(caseCount?.value ?? 0) > 0) {
    return false;
  }

  const tenantId = tenantIds[0]!;
  const caseId = buildCaseId(tenantId, "demo001");
  const traceId = buildTraceId(tenantId, caseId, "demo001");
  const now = new Date();

  await createCaseRecord({
    tenantId,
    caseId,
    traceId,
    title: "Despido y reclamación inicial",
    employeeName: "María Fernanda López",
    employerEntity: "Compañía Piloto MX",
    jurisdiction: "México",
    status: "analysis",
    priority: "high",
    assignedUserId: userId,
    summary: "Caso de ejemplo para visualizar intake documental, trazabilidad y tablero ejecutivo.",
    canonicalPayload: toJson({
      tenant_id: tenantId,
      case_id: caseId,
      trace_id: traceId,
      domain: "labor_case",
      country: "MX",
      workflow_stage: "analysis",
    }),
    openedAt: now,
    lastActivityAt: now,
    dueAt: new Date(now.getTime() + 1000 * 60 * 60 * 24 * 10),
  });

  await grantCaseAccess({
    tenantId,
    caseId,
    traceId,
    userId,
    grantedByUserId: userId,
    accessLevel: "owner",
    status: "active",
  });

  await addCaseEvent({
    tenantId,
    caseId,
    traceId,
    actorUserId: userId,
    eventType: "case_created",
    title: "Caso inicial creado",
    description: "Se generó el caso base para operación y validación del flujo.",
    metadata: toJson({ source: "system_seed" }),
    eventAt: now,
  });

  await addOperationalAlert({
    tenantId,
    caseId,
    traceId,
    severity: "warning",
    category: "missing_consent",
    title: "Consentimiento documental pendiente",
    description: "El expediente piloto requiere registrar consentimiento para al menos un documento sensible.",
    status: "open",
    raisedAt: now,
  });

  await addConsentRecord({
    tenantId,
    caseId,
    traceId,
    subjectName: "María Fernanda López",
    subjectRole: "Trabajadora",
    legalBasis: "Revisión de expediente laboral y trazabilidad interna",
    status: "pending",
    notes: "Registro de ejemplo para tablero y visibilidad.",
  });

  await upsertCanonicalContract({
    tenantId,
    caseId,
    traceId,
    contractType: "shared_engine",
    schemaVersion: "v1",
    status: "ready",
    payload: toJson({
      tenant_id: tenantId,
      case_id: caseId,
      trace_id: traceId,
      entity: "labor_case",
      documents: [],
      policies: [],
      audit_ready: true,
    }),
  });

  await createAuditLog({
    tenantId,
    caseId,
    traceId,
    actorUserId: userId,
    entityType: "case",
    entityId: caseId,
    action: "case.seed_demo",
    afterState: { tenantId, caseId, traceId },
  });

  return true;
}

export async function listCeoBridgePresets(params: { userId: number; tenantId?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const filters = [eq(ceoBridgePresets.userId, params.userId)];
  if (params.tenantId) {
    filters.push(eq(ceoBridgePresets.tenantId, params.tenantId));
  }

  const rows = await db
    .select()
    .from(ceoBridgePresets)
    .where(and(...filters))
    .orderBy(desc(ceoBridgePresets.updatedAt), desc(ceoBridgePresets.id));

  return rows.map(normalizeCeoBridgePresetRow);
}

export async function createCeoBridgePreset(input: {
  userId: number;
  tenantId?: string | null;
  name: string;
  description?: string | null;
  filters?: CeoBridgePresetFilters;
  exportFormat: "csv" | "pdf";
  emailRecipients?: string[];
  emailMessage?: string | null;
  smokeThreshold?: number | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const payload: InsertCeoBridgePreset = {
    userId: input.userId,
    tenantId: input.tenantId ?? null,
    name: input.name.trim().slice(0, 120),
    description: input.description?.trim().slice(0, 255) ?? null,
    filtersJson: toJson(normalizeCeoBridgePresetFilters(input.filters ?? {})),
    exportFormat: input.exportFormat,
    emailRecipientsJson: toJson(normalizeRecipientEmails(input.emailRecipients ?? [])),
    emailMessage: input.emailMessage?.trim() ? input.emailMessage.trim().slice(0, 1000) : null,
    smokeThreshold: Math.max(1, Math.min(input.smokeThreshold ?? 3, 99)),
  };

  await db.insert(ceoBridgePresets).values(payload);

  const rows = await db
    .select()
    .from(ceoBridgePresets)
    .where(eq(ceoBridgePresets.userId, input.userId))
    .orderBy(desc(ceoBridgePresets.id))
    .limit(1);

  if (rows.length === 0) throw new Error("Failed to create CEO bridge preset");
  return normalizeCeoBridgePresetRow(rows[0]);
}

export async function updateCeoBridgePreset(input: {
  id: number;
  userId: number;
  tenantId?: string | null;
  name: string;
  description?: string | null;
  filters?: CeoBridgePresetFilters;
  exportFormat: "csv" | "pdf";
  emailRecipients?: string[];
  emailMessage?: string | null;
  smokeThreshold?: number | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await db
    .select()
    .from(ceoBridgePresets)
    .where(and(eq(ceoBridgePresets.id, input.id), eq(ceoBridgePresets.userId, input.userId)))
    .limit(1);

  if (existing.length === 0) return null;

  const payload: Partial<InsertCeoBridgePreset> = {
    tenantId: input.tenantId ?? null,
    name: input.name.trim().slice(0, 120),
    description: input.description?.trim().slice(0, 255) ?? null,
    filtersJson: toJson(normalizeCeoBridgePresetFilters(input.filters ?? {})),
    exportFormat: input.exportFormat,
    emailRecipientsJson: toJson(normalizeRecipientEmails(input.emailRecipients ?? [])),
    emailMessage: input.emailMessage?.trim() ? input.emailMessage.trim().slice(0, 1000) : null,
    smokeThreshold: Math.max(1, Math.min(input.smokeThreshold ?? 3, 99)),
  };

  await db
    .update(ceoBridgePresets)
    .set(payload)
    .where(and(eq(ceoBridgePresets.id, input.id), eq(ceoBridgePresets.userId, input.userId)));

  const rows = await db.select().from(ceoBridgePresets).where(eq(ceoBridgePresets.id, input.id)).limit(1);
  return rows.length > 0 ? normalizeCeoBridgePresetRow(rows[0]) : null;
}

export async function deleteCeoBridgePreset(params: { id: number; userId: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(ceoBridgeSchedules).where(eq(ceoBridgeSchedules.presetId, params.id));
  await db.delete(ceoBridgePresets).where(and(eq(ceoBridgePresets.id, params.id), eq(ceoBridgePresets.userId, params.userId)));

  return true;
}

export async function getCeoBridgePresetById(params: { id: number; userId: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const rows = await db
    .select()
    .from(ceoBridgePresets)
    .where(and(eq(ceoBridgePresets.id, params.id), eq(ceoBridgePresets.userId, params.userId)))
    .limit(1);

  return rows.length > 0 ? normalizeCeoBridgePresetRow(rows[0]) : null;
}

export async function listCeoBridgeSchedules(params: { userId: number; tenantId?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const filters = [eq(ceoBridgeSchedules.userId, params.userId)];
  if (params.tenantId) {
    filters.push(eq(ceoBridgeSchedules.tenantId, params.tenantId));
  }

  const rows = await db
    .select({
      schedule: ceoBridgeSchedules,
      presetName: ceoBridgePresets.name,
    })
    .from(ceoBridgeSchedules)
    .innerJoin(ceoBridgePresets, eq(ceoBridgePresets.id, ceoBridgeSchedules.presetId))
    .where(and(...filters))
    .orderBy(desc(ceoBridgeSchedules.updatedAt), desc(ceoBridgeSchedules.id));

  return rows.map((row) => ({
    ...normalizeCeoBridgeScheduleRow(row.schedule),
    presetName: row.presetName,
  }));
}

export async function createCeoBridgeSchedule(input: {
  presetId: number;
  userId: number;
  tenantId?: string | null;
  cronExpression: string;
  timezone: string;
  nextRunAt: Date | null;
  isActive: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const payload: InsertCeoBridgeSchedule = {
    presetId: input.presetId,
    userId: input.userId,
    tenantId: input.tenantId ?? null,
    cronExpression: input.cronExpression.trim().slice(0, 64),
    timezone: input.timezone.trim().slice(0, 64) || "UTC",
    nextRunAt: input.nextRunAt,
    isActive: input.isActive ? 1 : 0,
  };

  await db.insert(ceoBridgeSchedules).values(payload);

  const rows = await db
    .select()
    .from(ceoBridgeSchedules)
    .where(eq(ceoBridgeSchedules.userId, input.userId))
    .orderBy(desc(ceoBridgeSchedules.id))
    .limit(1);

  if (rows.length === 0) throw new Error("Failed to create CEO bridge schedule");
  return normalizeCeoBridgeScheduleRow(rows[0]);
}

export async function updateCeoBridgeSchedule(input: {
  id: number;
  userId: number;
  presetId: number;
  tenantId?: string | null;
  cronExpression: string;
  timezone: string;
  nextRunAt: Date | null;
  isActive: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await db
    .select()
    .from(ceoBridgeSchedules)
    .where(and(eq(ceoBridgeSchedules.id, input.id), eq(ceoBridgeSchedules.userId, input.userId)))
    .limit(1);

  if (existing.length === 0) return null;

  await db
    .update(ceoBridgeSchedules)
    .set({
      presetId: input.presetId,
      tenantId: input.tenantId ?? null,
      cronExpression: input.cronExpression.trim().slice(0, 64),
      timezone: input.timezone.trim().slice(0, 64) || "UTC",
      nextRunAt: input.nextRunAt,
      isActive: input.isActive ? 1 : 0,
      lastRunError: input.isActive ? null : existing[0].lastRunError,
    })
    .where(and(eq(ceoBridgeSchedules.id, input.id), eq(ceoBridgeSchedules.userId, input.userId)));

  const rows = await db.select().from(ceoBridgeSchedules).where(eq(ceoBridgeSchedules.id, input.id)).limit(1);
  return rows.length > 0 ? normalizeCeoBridgeScheduleRow(rows[0]) : null;
}

export async function deleteCeoBridgeSchedule(params: { id: number; userId: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(ceoBridgeSchedules).where(and(eq(ceoBridgeSchedules.id, params.id), eq(ceoBridgeSchedules.userId, params.userId)));
  return true;
}

export async function listDueCeoBridgeSchedules(now: Date, limit = 5) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const rows = await db
    .select({
      schedule: ceoBridgeSchedules,
      preset: ceoBridgePresets,
      userEmail: users.email,
      userName: users.name,
    })
    .from(ceoBridgeSchedules)
    .innerJoin(ceoBridgePresets, eq(ceoBridgePresets.id, ceoBridgeSchedules.presetId))
    .innerJoin(users, eq(users.id, ceoBridgeSchedules.userId))
    .where(
      and(
        eq(ceoBridgeSchedules.isActive, 1),
        lte(ceoBridgeSchedules.nextRunAt, now),
      ),
    )
    .orderBy(ceoBridgeSchedules.nextRunAt)
    .limit(limit);

  return rows.map((row) => ({
    schedule: normalizeCeoBridgeScheduleRow(row.schedule),
    preset: normalizeCeoBridgePresetRow(row.preset),
    userEmail: row.userEmail,
    userName: row.userName ?? null,
  }));
}

export async function recordCeoBridgeScheduleRun(input: {
  id: number;
  lastRunAt: Date;
  nextRunAt: Date | null;
  lastRunStatus: string;
  lastRunError?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(ceoBridgeSchedules)
    .set({
      lastRunAt: input.lastRunAt,
      nextRunAt: input.nextRunAt,
      lastRunStatus: input.lastRunStatus.slice(0, 32),
      lastRunError: input.lastRunError?.slice(0, 2000) ?? null,
    })
    .where(eq(ceoBridgeSchedules.id, input.id));
}

export async function getSystemSnapshot(userId: number) {
  const [tenantsList, dashboard, auditTrail] = await Promise.all([
    listTenantsForUser(userId),
    getDashboardForUser(userId),
    listAuditTrail({ userId, limit: 10 }),
  ]);

  return {
    tenants: tenantsList,
    dashboard,
    auditTrail,
  };
}

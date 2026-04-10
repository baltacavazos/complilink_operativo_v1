import { createHash } from "node:crypto";
import { and, count, desc, eq, gte, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  auditLogs,
  canonicalContracts,
  caseAccess,
  caseDocuments,
  caseEvents,
  consentRecords,
  documentPolicies,
  InsertAuditLog,
  InsertCanonicalContract,
  InsertCaseAccess,
  InsertCaseDocument,
  InsertCaseEvent,
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

let _db: ReturnType<typeof drizzle> | null = null;

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

function readLockResult(rows: unknown, field: string) {
  if (!Array.isArray(rows) || rows.length === 0) return 0;
  const firstRow = rows[0] as Record<string, unknown>;
  const value = firstRow?.[field];
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string") return Number.parseInt(value, 10) || 0;
  return 0;
}

export async function withDatabaseLock<T>(params: {
  lockKey: string;
  timeoutSeconds?: number;
  action: () => Promise<T>;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const lockKey = params.lockKey.trim().slice(0, 64);
  const timeoutSeconds = Math.max(1, Math.min(params.timeoutSeconds ?? 10, 30));
  const acquiredRows = await db.execute(sql`SELECT GET_LOCK(${lockKey}, ${timeoutSeconds}) AS acquired`);
  const acquired = readLockResult(acquiredRows, "acquired");

  if (acquired !== 1) {
    throw new Error("No se pudo asegurar la aceptación legal en este momento. Intenta de nuevo.");
  }

  try {
    return await params.action();
  } finally {
    await db.execute(sql`SELECT RELEASE_LOCK(${lockKey}) AS released`);
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

type AuditarViewStateRecord = {
  historyFilter?: "all" | "document" | "response" | "summary";
  mobileOnboardingIndex?: number;
  selectedRecommendedTargetType?: "payroll_receipt" | "cfdi" | "contract" | "imss" | "evidence" | null;
  preferredCaptureMode?: "camera" | "file" | null;
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

  return {
    historyFilter,
    mobileOnboardingIndex,
    selectedRecommendedTargetType,
    preferredCaptureMode,
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

export async function getAccessibleCaseIds(userId: number, tenantId?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

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

  await assertTenantAccess(userId, tenantId);

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
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(caseEvents).values(input);
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

export async function upsertCanonicalContract(input: InsertCanonicalContract) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(canonicalContracts).values(input);
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

export async function createAuditLog(input: {
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
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const beforeState = input.beforeState === undefined ? null : toJson(input.beforeState);
  const afterState = input.afterState === undefined ? null : toJson(input.afterState);
  const previousHash = await getLatestAuditHash({ tenantId: input.tenantId, caseId: input.caseId });

  const payload: InsertAuditLog = {
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

  await db.insert(auditLogs).values(payload);
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

  const [events, documents, consents, alerts, policies, latestAuditarViewStateEntry] = await Promise.all([
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
  ]);

  const auditarViewStatePayload = latestAuditarViewStateEntry[0]?.afterState
    ? parseJsonSafely<{ viewState?: unknown }>(latestAuditarViewStateEntry[0].afterState)
    : null;

  return {
    case: caseRow,
    events,
    documents,
    consents,
    alerts,
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

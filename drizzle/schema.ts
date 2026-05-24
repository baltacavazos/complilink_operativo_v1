import {
  bigint,
  foreignKey,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  stripeCustomerId: varchar("stripeCustomerId", { length: 64 }).unique(),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const tenants = mysqlTable(
  "tenants",
  {
    id: int("id").autoincrement().primaryKey(),
    tenantId: varchar("tenantId", { length: 64 }).notNull(),
    traceId: varchar("traceId", { length: 96 }).notNull(),
    legalName: varchar("legalName", { length: 255 }).notNull(),
    displayName: varchar("displayName", { length: 255 }).notNull(),
    status: mysqlEnum("status", ["pilot", "active", "inactive"]).default("pilot").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    uniqueIndex("tenants_tenant_id_uq").on(table.tenantId),
    index("tenants_status_idx").on(table.status),
  ],
);

export const tenantMemberships = mysqlTable(
  "tenant_memberships",
  {
    id: int("id").autoincrement().primaryKey(),
    tenantId: varchar("tenantId", { length: 64 })
      .notNull()
      .references(() => tenants.tenantId),
    caseId: varchar("caseId", { length: 64 }),
    traceId: varchar("traceId", { length: 96 }).notNull(),
    userId: int("userId")
      .notNull()
      .references(() => users.id),
    role: mysqlEnum("role", ["tenant_admin", "manager", "reviewer", "viewer"]).default("viewer").notNull(),
    accessScope: mysqlEnum("accessScope", ["tenant", "case"]).default("tenant").notNull(),
    status: mysqlEnum("status", ["active", "revoked"]).default("active").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    index("tenant_memberships_user_idx").on(table.userId),
    index("tenant_memberships_tenant_case_idx").on(table.tenantId, table.caseId),
  ],
);

export const laborCases = mysqlTable(
  "labor_cases",
  {
    id: int("id").autoincrement().primaryKey(),
    tenantId: varchar("tenantId", { length: 64 })
      .notNull()
      .references(() => tenants.tenantId),
    caseId: varchar("caseId", { length: 64 }).notNull(),
    traceId: varchar("traceId", { length: 96 }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    employeeName: varchar("employeeName", { length: 255 }),
    employerEntity: varchar("employerEntity", { length: 255 }),
    jurisdiction: varchar("jurisdiction", { length: 128 }).default("México").notNull(),
    status: mysqlEnum("status", ["intake", "analysis", "conciliation", "litigation", "resolved", "archived"]).default("intake").notNull(),
    priority: mysqlEnum("priority", ["low", "medium", "high", "critical"]).default("medium").notNull(),
    assignedUserId: int("assignedUserId").references(() => users.id),
    summary: text("summary"),
    canonicalPayload: text("canonicalPayload"),
    openedAt: timestamp("openedAt").defaultNow().notNull(),
    dueAt: timestamp("dueAt"),
    closedAt: timestamp("closedAt"),
    lastActivityAt: timestamp("lastActivityAt").defaultNow().notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    uniqueIndex("labor_cases_case_id_uq").on(table.caseId),
    index("labor_cases_tenant_status_idx").on(table.tenantId, table.status),
    index("labor_cases_tenant_updated_idx").on(table.tenantId, table.updatedAt),
  ],
);

export const caseAccess = mysqlTable(
  "case_access",
  {
    id: int("id").autoincrement().primaryKey(),
    tenantId: varchar("tenantId", { length: 64 })
      .notNull()
      .references(() => tenants.tenantId),
    caseId: varchar("caseId", { length: 64 })
      .notNull()
      .references(() => laborCases.caseId),
    traceId: varchar("traceId", { length: 96 }).notNull(),
    userId: int("userId")
      .notNull()
      .references(() => users.id),
    grantedByUserId: int("grantedByUserId").references(() => users.id),
    accessLevel: mysqlEnum("accessLevel", ["owner", "editor", "reviewer", "viewer"]).default("viewer").notNull(),
    status: mysqlEnum("status", ["active", "revoked"]).default("active").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    index("case_access_case_user_idx").on(table.caseId, table.userId),
    index("case_access_tenant_idx").on(table.tenantId),
  ],
);

export const caseEvents = mysqlTable(
  "case_events",
  {
    id: int("id").autoincrement().primaryKey(),
    tenantId: varchar("tenantId", { length: 64 })
      .notNull()
      .references(() => tenants.tenantId),
    caseId: varchar("caseId", { length: 64 })
      .notNull()
      .references(() => laborCases.caseId),
    traceId: varchar("traceId", { length: 96 }).notNull(),
    actorUserId: int("actorUserId").references(() => users.id),
    eventType: mysqlEnum("eventType", [
      "case_created",
      "status_changed",
      "document_uploaded",
      "document_classified",
      "consent_updated",
      "policy_updated",
      "note_added",
      "alert_raised",
    ]).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    metadata: text("metadata"),
    eventAt: timestamp("eventAt").defaultNow().notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [
    index("case_events_case_event_at_idx").on(table.caseId, table.eventAt),
    index("case_events_trace_idx").on(table.traceId),
  ],
);

export const caseDocuments = mysqlTable(
  "case_documents",
  {
    id: int("id").autoincrement().primaryKey(),
    tenantId: varchar("tenantId", { length: 64 })
      .notNull()
      .references(() => tenants.tenantId),
    caseId: varchar("caseId", { length: 64 })
      .notNull()
      .references(() => laborCases.caseId),
    traceId: varchar("traceId", { length: 96 }).notNull(),
    documentId: varchar("documentId", { length: 64 }).notNull(),
    uploadedByUserId: int("uploadedByUserId").references(() => users.id),
    supersedesDocumentId: varchar("supersedesDocumentId", { length: 64 }),
    originalName: varchar("originalName", { length: 255 }).notNull(),
    mimeType: varchar("mimeType", { length: 128 }).notNull(),
    sizeBytes: bigint("sizeBytes", { mode: "number" }).notNull(),
    storageKey: varchar("storageKey", { length: 512 }).notNull(),
    storageUrl: varchar("storageUrl", { length: 1024 }).notNull(),
    sha256: varchar("sha256", { length: 64 }).notNull(),
    documentType: mysqlEnum("documentType", [
      "payroll_receipt",
      "cfdi",
      "imss",
      "contract",
      "settlement",
      "evidence",
      "other",
    ]).default("other").notNull(),
    sourceChannel: mysqlEnum("sourceChannel", ["manual", "email", "api", "bulk_import"]).default("manual").notNull(),
    integrityStatus: mysqlEnum("integrityStatus", ["pending", "verified", "replaced"]).default("pending").notNull(),
    consentStatus: mysqlEnum("consentStatus", ["pending", "granted", "revoked", "not_required"]).default("pending").notNull(),
    visibility: mysqlEnum("visibility", ["case_team", "tenant_legal", "tenant_hr", "restricted"]).default("case_team").notNull(),
    classificationConfidence: int("classificationConfidence").default(0).notNull(),
    processedAt: timestamp("processedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    uniqueIndex("case_documents_document_id_uq").on(table.documentId),
    index("case_documents_case_type_idx").on(table.caseId, table.documentType),
    index("case_documents_trace_idx").on(table.traceId),
  ],
);

export const compliLinkWebhookEvents = mysqlTable(
  "complilink_webhook_events",
  {
    id: int("id").autoincrement().primaryKey(),
    tenantId: varchar("tenantId", { length: 64 })
      .notNull()
      .references(() => tenants.tenantId),
    caseId: varchar("caseId", { length: 64 })
      .notNull()
      .references(() => laborCases.caseId),
    traceId: varchar("traceId", { length: 96 }).notNull(),
    documentId: varchar("documentId", { length: 64 }).notNull(),
    eventKey: varchar("eventKey", { length: 64 }).notNull(),
    eventName: varchar("eventName", { length: 128 }).notNull(),
    compliLinkId: varchar("compliLinkId", { length: 128 }),
    correlationId: varchar("correlationId", { length: 128 }),
    sourceTimestamp: varchar("sourceTimestamp", { length: 64 }),
    sourceSignature: varchar("sourceSignature", { length: 255 }),
    rawPayload: text("rawPayload").notNull(),
    status: mysqlEnum("status", ["processing", "processed", "failed_processing"]).default("processing").notNull(),
    failureReason: varchar("failureReason", { length: 255 }),
    processedAt: timestamp("processedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.documentId],
      foreignColumns: [caseDocuments.documentId],
      name: "cl_we_doc_fk",
    }),
    uniqueIndex("complilink_webhook_events_event_key_uq").on(table.eventKey),
    index("complilink_webhook_events_document_idx").on(table.documentId),
    index("complilink_webhook_events_trace_idx").on(table.traceId),
    index("complilink_webhook_events_status_idx").on(table.status),
  ],
);

export const documentPolicies = mysqlTable(
  "document_policies",
  {
    id: int("id").autoincrement().primaryKey(),
    tenantId: varchar("tenantId", { length: 64 })
      .notNull()
      .references(() => tenants.tenantId),
    caseId: varchar("caseId", { length: 64 })
      .notNull()
      .references(() => laborCases.caseId),
    traceId: varchar("traceId", { length: 96 }).notNull(),
    documentId: varchar("documentId", { length: 64 })
      .notNull()
      .references(() => caseDocuments.documentId),
    policyType: mysqlEnum("policyType", ["visibility", "retention", "legal_hold", "access_exception"]).notNull(),
    visibilityScope: mysqlEnum("visibilityScope", ["case_team", "tenant_legal", "tenant_hr", "restricted"]).default("case_team").notNull(),
    status: mysqlEnum("status", ["active", "inactive"]).default("active").notNull(),
    ruleText: text("ruleText").notNull(),
    createdByUserId: int("createdByUserId").references(() => users.id),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [index("document_policies_document_idx").on(table.documentId)],
);

export const consentRecords = mysqlTable(
  "consent_records",
  {
    id: int("id").autoincrement().primaryKey(),
    tenantId: varchar("tenantId", { length: 64 })
      .notNull()
      .references(() => tenants.tenantId),
    caseId: varchar("caseId", { length: 64 })
      .notNull()
      .references(() => laborCases.caseId),
    traceId: varchar("traceId", { length: 96 }).notNull(),
    documentId: varchar("documentId", { length: 64 }).references(() => caseDocuments.documentId),
    subjectName: varchar("subjectName", { length: 255 }).notNull(),
    subjectRole: varchar("subjectRole", { length: 128 }),
    legalBasis: varchar("legalBasis", { length: 255 }),
    status: mysqlEnum("status", ["pending", "granted", "revoked", "expired", "not_required"]).default("pending").notNull(),
    notes: text("notes"),
    grantedAt: timestamp("grantedAt"),
    revokedAt: timestamp("revokedAt"),
    expiresAt: timestamp("expiresAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    index("consent_records_case_idx").on(table.caseId),
    index("consent_records_document_idx").on(table.documentId),
  ],
);

export const auditLogs = mysqlTable(
  "audit_logs",
  {
    id: int("id").autoincrement().primaryKey(),
    tenantId: varchar("tenantId", { length: 64 })
      .notNull()
      .references(() => tenants.tenantId),
    caseId: varchar("caseId", { length: 64 }).references(() => laborCases.caseId),
    traceId: varchar("traceId", { length: 96 }).notNull(),
    documentId: varchar("documentId", { length: 64 }).references(() => caseDocuments.documentId),
    actorUserId: int("actorUserId").references(() => users.id),
    entityType: mysqlEnum("entityType", ["tenant", "case", "document", "consent", "policy", "access", "system"]).notNull(),
    entityId: varchar("entityId", { length: 128 }).notNull(),
    action: varchar("action", { length: 128 }).notNull(),
    beforeState: text("beforeState"),
    afterState: text("afterState"),
    hashChain: varchar("hashChain", { length: 255 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [
    index("audit_logs_trace_idx").on(table.traceId),
    index("audit_logs_entity_idx").on(table.entityType, table.entityId),
  ],
);

export const ceoBridgePresets = mysqlTable(
  "ceo_bridge_presets",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId")
      .notNull()
      .references(() => users.id),
    tenantId: varchar("tenantId", { length: 64 }).references(() => tenants.tenantId),
    name: varchar("name", { length: 120 }).notNull(),
    description: varchar("description", { length: 255 }),
    filtersJson: text("filtersJson").notNull(),
    exportFormat: mysqlEnum("exportFormat", ["csv", "pdf"]).default("csv").notNull(),
    emailRecipientsJson: text("emailRecipientsJson"),
    emailMessage: text("emailMessage"),
    smokeThreshold: int("smokeThreshold").default(3).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    index("ceo_bridge_presets_user_idx").on(table.userId, table.updatedAt),
    index("ceo_bridge_presets_tenant_idx").on(table.tenantId),
  ],
);

export const ceoBridgeSchedules = mysqlTable(
  "ceo_bridge_schedules",
  {
    id: int("id").autoincrement().primaryKey(),
    presetId: int("presetId")
      .notNull()
      .references(() => ceoBridgePresets.id),
    userId: int("userId")
      .notNull()
      .references(() => users.id),
    tenantId: varchar("tenantId", { length: 64 }).references(() => tenants.tenantId),
    cronExpression: varchar("cronExpression", { length: 64 }).notNull(),
    timezone: varchar("timezone", { length: 64 }).default("UTC").notNull(),
    nextRunAt: timestamp("nextRunAt"),
    lastRunAt: timestamp("lastRunAt"),
    lastRunStatus: varchar("lastRunStatus", { length: 32 }),
    lastRunError: text("lastRunError"),
    isActive: int("isActive").default(1).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    index("ceo_bridge_schedules_user_active_idx").on(table.userId, table.isActive, table.nextRunAt),
    index("ceo_bridge_schedules_preset_idx").on(table.presetId),
    index("ceo_bridge_schedules_tenant_idx").on(table.tenantId),
  ],
);

export const operationalAlerts = mysqlTable(
  "operational_alerts",
  {
    id: int("id").autoincrement().primaryKey(),
    tenantId: varchar("tenantId", { length: 64 })
      .notNull()
      .references(() => tenants.tenantId),
    caseId: varchar("caseId", { length: 64 }).references(() => laborCases.caseId),
    traceId: varchar("traceId", { length: 96 }).notNull(),
    severity: mysqlEnum("severity", ["info", "warning", "critical"]).default("warning").notNull(),
    category: mysqlEnum("category", ["missing_consent", "integrity_gap", "overdue_case", "upload_pending", "access_risk"]).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    status: mysqlEnum("status", ["open", "acknowledged", "resolved"]).default("open").notNull(),
    raisedAt: timestamp("raisedAt").defaultNow().notNull(),
    resolvedAt: timestamp("resolvedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    index("operational_alerts_tenant_status_idx").on(table.tenantId, table.status),
    index("operational_alerts_case_idx").on(table.caseId),
  ],
);

export const commerceSubscriptions = mysqlTable(
  "commerce_subscriptions",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId")
      .notNull()
      .references(() => users.id),
    stripeCustomerId: varchar("stripeCustomerId", { length: 64 }).notNull(),
    stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 64 }).notNull(),
    stripePriceId: varchar("stripePriceId", { length: 64 }),
    planKey: mysqlEnum("planKey", ["free", "essential", "pro"]).notNull(),
    status: varchar("status", { length: 32 }).notNull(),
    latestInvoiceId: varchar("latestInvoiceId", { length: 64 }),
    currentPeriodEnd: timestamp("currentPeriodEnd"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    uniqueIndex("commerce_subscriptions_subscription_uq").on(table.stripeSubscriptionId),
    index("commerce_subscriptions_user_status_idx").on(table.userId, table.status),
    index("commerce_subscriptions_customer_idx").on(table.stripeCustomerId),
  ],
);

export const commercePayments = mysqlTable(
  "commerce_payments",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").references(() => users.id),
    stripeCustomerId: varchar("stripeCustomerId", { length: 64 }),
    stripeCheckoutSessionId: varchar("stripeCheckoutSessionId", { length: 64 }).unique(),
    stripePaymentIntentId: varchar("stripePaymentIntentId", { length: 64 }).unique(),
    stripeInvoiceId: varchar("stripeInvoiceId", { length: 64 }).unique(),
    stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 64 }),
    productKey: varchar("productKey", { length: 64 }).notNull(),
    productLabel: varchar("productLabel", { length: 255 }).notNull(),
    productType: mysqlEnum("productType", ["subscription", "one_shot"]).notNull(),
    amountTotal: int("amountTotal").notNull(),
    currency: varchar("currency", { length: 8 }).default("mxn").notNull(),
    paymentStatus: varchar("paymentStatus", { length: 32 }).notNull(),
    paidAt: timestamp("paidAt").defaultNow().notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    index("commerce_payments_user_paid_idx").on(table.userId, table.paidAt),
    index("commerce_payments_customer_idx").on(table.stripeCustomerId),
    index("commerce_payments_subscription_idx").on(table.stripeSubscriptionId),
  ],
);

export const canonicalContracts = mysqlTable(
  "canonical_contracts",
  {
    id: int("id").autoincrement().primaryKey(),
    tenantId: varchar("tenantId", { length: 64 })
      .notNull()
      .references(() => tenants.tenantId),
    caseId: varchar("caseId", { length: 64 }).references(() => laborCases.caseId),
    traceId: varchar("traceId", { length: 96 }).notNull(),
    contractType: mysqlEnum("contractType", ["case", "intake", "document", "classification", "consent", "audit", "shared_engine"]).notNull(),
    schemaVersion: varchar("schemaVersion", { length: 32 }).default("v1").notNull(),
    payload: text("payload").notNull(),
    status: mysqlEnum("status", ["draft", "ready", "exported"]).default("draft").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    index("canonical_contracts_tenant_case_idx").on(table.tenantId, table.caseId),
    index("canonical_contracts_type_idx").on(table.contractType),
  ],
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Tenant = typeof tenants.$inferSelect;
export type InsertTenant = typeof tenants.$inferInsert;
export type TenantMembership = typeof tenantMemberships.$inferSelect;
export type InsertTenantMembership = typeof tenantMemberships.$inferInsert;
export type LaborCase = typeof laborCases.$inferSelect;
export type InsertLaborCase = typeof laborCases.$inferInsert;
export type CaseAccess = typeof caseAccess.$inferSelect;
export type InsertCaseAccess = typeof caseAccess.$inferInsert;
export type CaseEvent = typeof caseEvents.$inferSelect;
export type InsertCaseEvent = typeof caseEvents.$inferInsert;
export type CaseDocument = typeof caseDocuments.$inferSelect;
export type InsertCaseDocument = typeof caseDocuments.$inferInsert;
export type CompliLinkWebhookEvent = typeof compliLinkWebhookEvents.$inferSelect;
export type InsertCompliLinkWebhookEvent = typeof compliLinkWebhookEvents.$inferInsert;
export type DocumentPolicy = typeof documentPolicies.$inferSelect;
export type InsertDocumentPolicy = typeof documentPolicies.$inferInsert;
export type ConsentRecord = typeof consentRecords.$inferSelect;
export type InsertConsentRecord = typeof consentRecords.$inferInsert;
export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = typeof auditLogs.$inferInsert;
export type CeoBridgePreset = typeof ceoBridgePresets.$inferSelect;
export type InsertCeoBridgePreset = typeof ceoBridgePresets.$inferInsert;
export type CeoBridgeSchedule = typeof ceoBridgeSchedules.$inferSelect;
export type InsertCeoBridgeSchedule = typeof ceoBridgeSchedules.$inferInsert;
export type OperationalAlert = typeof operationalAlerts.$inferSelect;
export type InsertOperationalAlert = typeof operationalAlerts.$inferInsert;
export type CommerceSubscription = typeof commerceSubscriptions.$inferSelect;
export type InsertCommerceSubscription = typeof commerceSubscriptions.$inferInsert;
export type CommercePayment = typeof commercePayments.$inferSelect;
export type InsertCommercePayment = typeof commercePayments.$inferInsert;
export type CanonicalContract = typeof canonicalContracts.$inferSelect;
export type InsertCanonicalContract = typeof canonicalContracts.$inferInsert;

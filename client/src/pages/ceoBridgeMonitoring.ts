import type { AuditFeedItem } from "@/pages/ceoDashboardMonitoring";

export type BridgeTenantHealth = {
  tenantId: string;
  tenantName: string;
};

export type BridgeRecentDocument = {
  documentId: string;
  tenantId: string;
  tenantName: string;
  caseId: string;
  caseTitle: string | null;
  originalName: string;
  documentType: string;
  integrityStatus: string;
  traceId: string | null;
  updatedAt: Date | string | null;
  createdAt: Date | string | null;
};

export type BridgeRecentAlert = {
  id: number;
  tenantId: string;
  tenantName: string;
  caseId: string | null;
  caseTitle: string | null;
  title: string;
  description: string | null;
  category: string;
  severity: string;
  status: string;
  raisedAt: Date | string | null;
};

export type BridgeActivityHealth = "healthy" | "warning" | "critical" | "pending";
export type BridgeOutcomeCategory =
  | "success"
  | "retry_scheduled"
  | "permanent_failure"
  | "skipped"
  | "pending_return"
  | "warning"
  | "unknown";

export type BridgeActivityRow = {
  documentId: string;
  tenantId: string;
  tenantName: string;
  caseId: string | null;
  caseTitle: string | null;
  traceId: string | null;
  documentName: string;
  documentType: string;
  integrityStatus: string | null;
  dispatchStatus: string;
  outcomeCategory: BridgeOutcomeCategory;
  latestReturnEvent: string | null;
  latestReturnStatus: string | null;
  dispatchedAt: Date | string | null;
  returnedAt: Date | string | null;
  lastActivityAt: Date | string | null;
  attempts: number;
  httpStatusCode: number | null;
  retryScheduled: boolean;
  retryDelayMs: number | null;
  targetHost: string | null;
  remoteSmokeEnabled: boolean | null;
  compliLinkId: string | null;
  warnings: string[];
  guardrailReason: string | null;
  errorMessage: string | null;
  openAlertCount: number;
  openAlertSeverity: string | null;
  health: BridgeActivityHealth;
};

export type BridgeMonitoringSummary = {
  trackedDocuments: number;
  healthy: number;
  pending: number;
  warning: number;
  critical: number;
  withReturn: number;
  withWarnings: number;
  retryScheduled: number;
};

export type BridgeMonitoringPanel = {
  summary: BridgeMonitoringSummary;
  rows: BridgeActivityRow[];
  issues: BridgeActivityRow[];
};

type BridgeAccumulator = BridgeActivityRow;

function parseObject(value: unknown): Record<string, unknown> | null {
  if (!value) return null;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }

  return typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readBoolean(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

function readStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

function resolveLastActivityAt(row: BridgeAccumulator) {
  const candidates = [row.returnedAt, row.dispatchedAt, row.lastActivityAt]
    .map((value) => (value ? new Date(value).getTime() : Number.NaN))
    .filter((value) => Number.isFinite(value));

  if (candidates.length === 0) return null;
  return new Date(Math.max(...candidates)).toISOString();
}

function resolveHealth(row: BridgeAccumulator): BridgeActivityHealth {
  if (row.outcomeCategory === "permanent_failure" || row.dispatchStatus === "failed") return "critical";
  if ((row.warnings?.length ?? 0) > 0 || (row.openAlertCount ?? 0) > 0 || row.outcomeCategory === "retry_scheduled") return "warning";
  if (row.outcomeCategory === "pending_return" || ((row.dispatchStatus === "sent" || row.dispatchStatus === "accepted") && !row.returnedAt)) return "pending";
  return "healthy";
}

function resolveOutcomeCategory(row: BridgeAccumulator): BridgeOutcomeCategory {
  if (row.outcomeCategory && row.outcomeCategory !== "unknown") return row.outcomeCategory;
  if (row.dispatchStatus === "sent" && !row.returnedAt) return "pending_return";
  if ((row.warnings?.length ?? 0) > 0) return "warning";
  return "unknown";
}

export function buildBridgeMonitoringPanel(params: {
  auditTrail: AuditFeedItem[];
  tenantHealth: BridgeTenantHealth[];
  recentDocuments: BridgeRecentDocument[];
  recentAlerts: BridgeRecentAlert[];
}): BridgeMonitoringPanel {
  const tenantNameMap = new Map(params.tenantHealth.map((tenant) => [tenant.tenantId, tenant.tenantName]));
  const documentMap = new Map(params.recentDocuments.map((document) => [document.documentId, document]));
  const issueAlertMap = new Map<string, { count: number; severity: string | null }>();

  for (const alert of params.recentAlerts) {
    const isBridgeAlert =
      alert.category === "integrity_gap" ||
      alert.title.toLowerCase().includes("compli") ||
      (alert.description ?? "").toLowerCase().includes("compli");

    if (!isBridgeAlert || alert.status === "resolved") continue;

    const caseKey = alert.caseId ? `case:${alert.caseId}` : `tenant:${alert.tenantId}`;
    const current = issueAlertMap.get(caseKey) ?? { count: 0, severity: null };
    current.count += 1;
    current.severity = current.severity === "critical" || alert.severity !== "critical" ? current.severity : alert.severity;
    if (!current.severity) current.severity = alert.severity;
    issueAlertMap.set(caseKey, current);
  }

  const rowsByDocument = new Map<string, BridgeAccumulator>();

  const relevantAuditItems = params.auditTrail.filter(
    (item) =>
      item.action === "document.engine_dispatch" ||
      item.action === "document.guardrail_rejected" ||
      item.action.startsWith("complilink.return_webhook."),
  );

  for (const item of relevantAuditItems) {
    const auditState = parseObject(item.afterState);
    const resolvedDocumentId =
      readString(auditState?.documentId) ??
      (item.entityType === "document" ? item.entityId : null) ??
      readString(auditState?.payload && typeof auditState.payload === "object" ? (auditState.payload as Record<string, unknown>).documentId : null);

    if (!resolvedDocumentId) continue;

    const knownDocument = documentMap.get(resolvedDocumentId);
    const caseAlertKey = item.caseId ? `case:${item.caseId}` : `tenant:${item.tenantId}`;
    const openAlertDescriptor = issueAlertMap.get(caseAlertKey);
    const current = rowsByDocument.get(resolvedDocumentId) ?? {
      documentId: resolvedDocumentId,
      tenantId: item.tenantId,
      tenantName: knownDocument?.tenantName ?? tenantNameMap.get(item.tenantId) ?? item.tenantId,
      caseId: item.caseId,
      caseTitle: knownDocument?.caseTitle ?? null,
      traceId: item.traceId,
      documentName: knownDocument?.originalName ?? resolvedDocumentId,
      documentType: knownDocument?.documentType ?? "documento",
      integrityStatus: knownDocument?.integrityStatus ?? null,
      dispatchStatus: "unknown",
      outcomeCategory: "unknown",
      latestReturnEvent: null,
      latestReturnStatus: null,
      dispatchedAt: null,
      returnedAt: null,
      lastActivityAt: item.createdAt,
      attempts: 0,
      httpStatusCode: null,
      retryScheduled: false,
      retryDelayMs: null,
      targetHost: null,
      remoteSmokeEnabled: null,
      compliLinkId: null,
      warnings: [],
      guardrailReason: null,
      errorMessage: null,
      openAlertCount: openAlertDescriptor?.count ?? 0,
      openAlertSeverity: openAlertDescriptor?.severity ?? null,
      health: "pending",
    } satisfies BridgeAccumulator;

    current.tenantId = current.tenantId ?? item.tenantId;
    current.tenantName = current.tenantName ?? knownDocument?.tenantName ?? tenantNameMap.get(item.tenantId) ?? item.tenantId;
    current.caseId = current.caseId ?? item.caseId ?? knownDocument?.caseId ?? null;
    current.caseTitle = current.caseTitle ?? knownDocument?.caseTitle ?? null;
    current.traceId = current.traceId ?? item.traceId ?? knownDocument?.traceId ?? null;
    current.documentName = current.documentName ?? knownDocument?.originalName ?? resolvedDocumentId;
    current.documentType = current.documentType ?? knownDocument?.documentType ?? "documento";
    current.integrityStatus = current.integrityStatus ?? knownDocument?.integrityStatus ?? null;

    if (item.action === "document.engine_dispatch") {
      const observability = parseObject(auditState?.observabilityEnvelope);
      current.dispatchStatus = readString(auditState?.status) ?? current.dispatchStatus ?? "unknown";
      current.dispatchedAt = readString(auditState?.dispatchedAt) ?? current.dispatchedAt ?? item.createdAt;
      current.attempts = readNumber(auditState?.attempts) ?? current.attempts ?? 0;
      current.httpStatusCode = readNumber(auditState?.httpStatus) ?? readNumber(observability?.httpStatusCode) ?? current.httpStatusCode ?? null;
      current.retryScheduled = readBoolean(observability?.retryScheduled) ?? current.retryScheduled ?? false;
      current.retryDelayMs = readNumber(observability?.retryDelayMs) ?? current.retryDelayMs ?? null;
      current.targetHost = readString(observability?.targetHost) ?? current.targetHost ?? null;
      current.remoteSmokeEnabled = readBoolean(observability?.remoteSmokeEnabled) ?? current.remoteSmokeEnabled ?? null;
      current.outcomeCategory =
        (readString(observability?.outcomeCategory) as BridgeOutcomeCategory | null) ?? current.outcomeCategory ?? "unknown";
      current.errorMessage = readString(auditState?.errorMessage) ?? readString(auditState?.reason) ?? current.errorMessage ?? null;
    }

    if (item.action.startsWith("complilink.return_webhook.")) {
      const warningList = [
        ...readStringArray(auditState?.guardrailWarnings),
        ...readStringArray(auditState?.guardrailsFlags),
      ];
      current.latestReturnEvent = readString(auditState?.event) ?? item.action.replace("complilink.return_webhook.", "");
      current.latestReturnStatus = readString(auditState?.status) ?? current.latestReturnStatus ?? null;
      current.returnedAt = readString(auditState?.receivedAt) ?? readString(auditState?.timestamp) ?? item.createdAt;
      current.compliLinkId = readString(auditState?.compliLinkId) ?? current.compliLinkId ?? null;
      current.warnings = Array.from(new Set([...(current.warnings ?? []), ...warningList]));
      if (warningList.length > 0 && current.outcomeCategory !== "permanent_failure") current.outcomeCategory = "warning";
      if (warningList.length === 0 && current.outcomeCategory === "unknown") current.outcomeCategory = "success";
    }

    if (item.action === "document.guardrail_rejected") {
      const reason = readString(auditState?.reason);
      current.guardrailReason = reason ?? current.guardrailReason ?? null;
      if (reason) current.warnings = Array.from(new Set([...(current.warnings ?? []), reason]));
      if (current.outcomeCategory !== "permanent_failure") current.outcomeCategory = "warning";
    }

    current.lastActivityAt = resolveLastActivityAt(current);
    current.outcomeCategory = resolveOutcomeCategory(current);
    current.health = resolveHealth(current);

    rowsByDocument.set(resolvedDocumentId, current);
  }

  const rows = Array.from(rowsByDocument.values())
    .map((row) => ({
      ...row,
      caseId: row.caseId ?? null,
      caseTitle: row.caseTitle ?? null,
      traceId: row.traceId ?? null,
      integrityStatus: row.integrityStatus ?? null,
      dispatchStatus: row.dispatchStatus ?? "unknown",
      outcomeCategory: resolveOutcomeCategory(row),
      latestReturnEvent: row.latestReturnEvent ?? null,
      latestReturnStatus: row.latestReturnStatus ?? null,
      dispatchedAt: row.dispatchedAt ?? null,
      returnedAt: row.returnedAt ?? null,
      lastActivityAt: resolveLastActivityAt(row),
      attempts: row.attempts ?? 0,
      httpStatusCode: row.httpStatusCode ?? null,
      retryScheduled: row.retryScheduled ?? false,
      retryDelayMs: row.retryDelayMs ?? null,
      targetHost: row.targetHost ?? null,
      remoteSmokeEnabled: row.remoteSmokeEnabled ?? null,
      compliLinkId: row.compliLinkId ?? null,
      warnings: row.warnings ?? [],
      guardrailReason: row.guardrailReason ?? null,
      errorMessage: row.errorMessage ?? null,
      openAlertCount: row.openAlertCount ?? 0,
      openAlertSeverity: row.openAlertSeverity ?? null,
      health: resolveHealth(row),
    }))
    .sort((left, right) => {
      const leftAt = left.lastActivityAt ? new Date(left.lastActivityAt).getTime() : 0;
      const rightAt = right.lastActivityAt ? new Date(right.lastActivityAt).getTime() : 0;
      return rightAt - leftAt;
    });

  const summary: BridgeMonitoringSummary = {
    trackedDocuments: rows.length,
    healthy: rows.filter((row) => row.health === "healthy").length,
    pending: rows.filter((row) => row.health === "pending").length,
    warning: rows.filter((row) => row.health === "warning").length,
    critical: rows.filter((row) => row.health === "critical").length,
    withReturn: rows.filter((row) => Boolean(row.returnedAt)).length,
    withWarnings: rows.filter((row) => row.warnings.length > 0).length,
    retryScheduled: rows.filter((row) => row.retryScheduled).length,
  };

  return {
    summary,
    rows,
    issues: rows.filter((row) => row.health === "critical" || row.health === "warning").slice(0, 6),
  };
}

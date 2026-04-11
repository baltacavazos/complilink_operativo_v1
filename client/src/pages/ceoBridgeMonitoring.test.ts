import { describe, expect, it } from "vitest";

import type { AuditFeedItem } from "./ceoDashboardMonitoring";
import {
  buildBridgeMonitoringPanel,
  type BridgeRecentAlert,
  type BridgeRecentDocument,
  type BridgeTenantHealth,
} from "./ceoBridgeMonitoring";

function buildAuditItem(overrides: Partial<AuditFeedItem> = {}): AuditFeedItem {
  return {
    id: overrides.id ?? 1,
    tenantId: overrides.tenantId ?? "tenant-a",
    caseId: Object.prototype.hasOwnProperty.call(overrides, "caseId") ? (overrides.caseId ?? null) : "case-001",
    traceId: overrides.traceId ?? "trace-001",
    documentId: Object.prototype.hasOwnProperty.call(overrides, "documentId") ? (overrides.documentId ?? null) : "doc-001",
    actorUserId: overrides.actorUserId ?? 9,
    entityType: overrides.entityType ?? "document",
    entityId: overrides.entityId ?? "doc-001",
    action: overrides.action ?? "document.engine_dispatch",
    beforeState: overrides.beforeState ?? null,
    afterState: overrides.afterState ?? null,
    hashChain: overrides.hashChain ?? null,
    createdAt: overrides.createdAt ?? new Date("2026-04-10T12:00:00.000Z"),
  };
}

function buildDocument(overrides: Partial<BridgeRecentDocument> = {}): BridgeRecentDocument {
  return {
    documentId: overrides.documentId ?? "doc-001",
    tenantId: overrides.tenantId ?? "tenant-a",
    tenantName: overrides.tenantName ?? "Tenant Alfa",
    caseId: Object.prototype.hasOwnProperty.call(overrides, "caseId") ? (overrides.caseId as string) : "case-001",
    caseTitle: Object.prototype.hasOwnProperty.call(overrides, "caseTitle") ? overrides.caseTitle ?? null : "Caso uno",
    originalName: overrides.originalName ?? "contrato.pdf",
    documentType: overrides.documentType ?? "contrato",
    integrityStatus: overrides.integrityStatus ?? "ok",
    traceId: overrides.traceId ?? "trace-001",
    updatedAt: overrides.updatedAt ?? new Date("2026-04-10T12:05:00.000Z"),
    createdAt: overrides.createdAt ?? new Date("2026-04-10T11:59:00.000Z"),
  };
}

function buildAlert(overrides: Partial<BridgeRecentAlert> = {}): BridgeRecentAlert {
  return {
    id: overrides.id ?? 1,
    tenantId: overrides.tenantId ?? "tenant-a",
    tenantName: overrides.tenantName ?? "Tenant Alfa",
    caseId: Object.prototype.hasOwnProperty.call(overrides, "caseId") ? overrides.caseId ?? null : "case-001",
    caseTitle: Object.prototype.hasOwnProperty.call(overrides, "caseTitle") ? overrides.caseTitle ?? null : "Caso uno",
    title: overrides.title ?? "Alerta CompliLink",
    description: Object.prototype.hasOwnProperty.call(overrides, "description") ? overrides.description ?? null : "Seguimiento operativo de CompliLink",
    category: overrides.category ?? "integrity_gap",
    severity: overrides.severity ?? "high",
    status: overrides.status ?? "open",
    raisedAt: overrides.raisedAt ?? new Date("2026-04-10T12:06:00.000Z"),
  };
}

const tenantHealth: BridgeTenantHealth[] = [{ tenantId: "tenant-a", tenantName: "Tenant Alfa" }];

describe("ceoBridgeMonitoring", () => {
  it("resume expedientes críticos, warning, pendientes y conformes a partir del feed bridge", () => {
    const panel = buildBridgeMonitoringPanel({
      tenantHealth,
      recentDocuments: [
        buildDocument({ documentId: "doc-critical", caseId: "case-critical", caseTitle: "Caso crítico", originalName: "critico.pdf", traceId: "trace-critical" }),
        buildDocument({ documentId: "doc-warning", caseId: "case-warning", caseTitle: "Caso warning", originalName: "warning.pdf", traceId: "trace-warning" }),
        buildDocument({ documentId: "doc-pending", caseId: "case-pending", caseTitle: "Caso pendiente", originalName: "pending.pdf", traceId: "trace-pending" }),
        buildDocument({ documentId: "doc-healthy", caseId: "case-healthy", caseTitle: "Caso conforme", originalName: "healthy.pdf", traceId: "trace-healthy" }),
      ],
      recentAlerts: [buildAlert({ caseId: "case-critical", caseTitle: "Caso crítico", severity: "critical" })],
      auditTrail: [
        buildAuditItem({
          id: 1,
          entityId: "doc-critical",
          documentId: "doc-critical",
          traceId: "trace-critical",
          caseId: "case-critical",
          createdAt: new Date("2026-04-10T12:00:00.000Z"),
          action: "document.engine_dispatch",
          afterState: {
            documentId: "doc-critical",
            status: "error",
            attempts: 3,
            httpStatus: 500,
            errorMessage: "Bridge down",
            observabilityEnvelope: {
              outcomeCategory: "permanent_failure",
              httpStatusCode: 500,
              retryScheduled: false,
            },
          },
        }),
        buildAuditItem({
          id: 2,
          entityId: "doc-warning",
          documentId: "doc-warning",
          traceId: "trace-warning",
          caseId: "case-warning",
          createdAt: new Date("2026-04-10T12:01:00.000Z"),
          action: "document.engine_dispatch",
          afterState: {
            documentId: "doc-warning",
            status: "accepted",
            attempts: 2,
            httpStatus: 202,
            observabilityEnvelope: {
              outcomeCategory: "retry_scheduled",
              httpStatusCode: 202,
              retryScheduled: true,
              retryDelayMs: 60000,
            },
          },
        }),
        buildAuditItem({
          id: 3,
          entityId: "doc-warning",
          documentId: "doc-warning",
          traceId: "trace-warning",
          caseId: "case-warning",
          createdAt: new Date("2026-04-10T12:02:00.000Z"),
          action: "complilink.return_webhook.warning",
          afterState: {
            documentId: "doc-warning",
            event: "warning",
            status: "received",
            receivedAt: "2026-04-10T12:02:00.000Z",
            guardrailWarnings: ["duplicate_candidate"],
            compliLinkId: "cmp-001",
          },
        }),
        buildAuditItem({
          id: 4,
          entityId: "doc-pending",
          documentId: "doc-pending",
          traceId: "trace-pending",
          caseId: "case-pending",
          createdAt: new Date("2026-04-10T12:03:00.000Z"),
          action: "document.engine_dispatch",
          afterState: {
            documentId: "doc-pending",
            status: "accepted",
            attempts: 1,
            observabilityEnvelope: {
              outcomeCategory: "pending_return",
              httpStatusCode: 202,
              retryScheduled: false,
            },
          },
        }),
        buildAuditItem({
          id: 5,
          entityId: "doc-healthy",
          documentId: "doc-healthy",
          traceId: "trace-healthy",
          caseId: "case-healthy",
          createdAt: new Date("2026-04-10T12:04:00.000Z"),
          action: "document.engine_dispatch",
          afterState: {
            documentId: "doc-healthy",
            status: "accepted",
            attempts: 1,
            observabilityEnvelope: {
              outcomeCategory: "success",
              httpStatusCode: 200,
              retryScheduled: false,
            },
          },
        }),
        buildAuditItem({
          id: 6,
          entityId: "doc-healthy",
          documentId: "doc-healthy",
          traceId: "trace-healthy",
          caseId: "case-healthy",
          createdAt: new Date("2026-04-10T12:05:00.000Z"),
          action: "complilink.return_webhook.processed",
          afterState: {
            documentId: "doc-healthy",
            event: "processed",
            status: "received",
            receivedAt: "2026-04-10T12:05:00.000Z",
            compliLinkId: "cmp-002",
          },
        }),
      ],
    });

    expect(panel.summary).toEqual({
      trackedDocuments: 4,
      healthy: 1,
      pending: 1,
      warning: 1,
      critical: 1,
      withReturn: 2,
      withWarnings: 1,
      retryScheduled: 1,
    });

    expect(panel.issues.map((item) => ({ documentId: item.documentId, health: item.health }))).toEqual([
      { documentId: "doc-warning", health: "warning" },
      { documentId: "doc-critical", health: "critical" },
    ]);

    const critical = panel.rows.find((item) => item.documentId === "doc-critical");
    const warning = panel.rows.find((item) => item.documentId === "doc-warning");
    const pending = panel.rows.find((item) => item.documentId === "doc-pending");
    const healthy = panel.rows.find((item) => item.documentId === "doc-healthy");

    expect(critical).toMatchObject({
      health: "critical",
      outcomeCategory: "permanent_failure",
      httpStatusCode: 500,
      errorMessage: "Bridge down",
      openAlertCount: 1,
    });

    expect(warning).toMatchObject({
      health: "warning",
      outcomeCategory: "warning",
      retryScheduled: true,
      attempts: 2,
      compliLinkId: "cmp-001",
      warnings: ["duplicate_candidate"],
    });

    expect(pending).toMatchObject({
      health: "pending",
      outcomeCategory: "pending_return",
      returnedAt: null,
    });

    expect(healthy).toMatchObject({
      health: "healthy",
      outcomeCategory: "success",
      latestReturnEvent: "processed",
      compliLinkId: "cmp-002",
    });
  });

  it("ignora alertas resueltas o ajenas al bridge y tolera descripciones nulas", () => {
    const panel = buildBridgeMonitoringPanel({
      tenantHealth,
      recentDocuments: [buildDocument({ documentId: "doc-001" })],
      recentAlerts: [
        buildAlert({ id: 1, description: null, status: "resolved" }),
        buildAlert({ id: 2, category: "general", title: "Seguimiento interno", description: null, severity: "critical" }),
      ],
      auditTrail: [
        buildAuditItem({
          id: 1,
          entityId: "doc-001",
          documentId: "doc-001",
          action: "document.engine_dispatch",
          afterState: {
            documentId: "doc-001",
            status: "accepted",
            attempts: 1,
            observabilityEnvelope: {
              outcomeCategory: "pending_return",
              httpStatusCode: 202,
              retryScheduled: false,
            },
          },
        }),
      ],
    });

    expect(panel.rows).toHaveLength(1);
    expect(panel.rows[0]).toMatchObject({
      documentId: "doc-001",
      health: "pending",
      openAlertCount: 0,
      openAlertSeverity: null,
    });
  });
});

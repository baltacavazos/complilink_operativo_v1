import { describe, expect, it } from "vitest";

import {
  buildAuditMonitoringSummary,
  getAuditActionLabel,
  getAuditActionTone,
  getAuditRejectionReason,
  type AuditFeedItem,
} from "./ceoDashboardMonitoring";

function buildAuditItem(overrides: Partial<AuditFeedItem> = {}): AuditFeedItem {
  return {
    id: overrides.id ?? 1,
    tenantId: overrides.tenantId ?? "tenant-demo",
    caseId: overrides.caseId ?? "case-001",
    traceId: overrides.traceId ?? "trace-001",
    documentId: overrides.documentId ?? null,
    actorUserId: overrides.actorUserId ?? 7,
    entityType: overrides.entityType ?? "document",
    entityId: overrides.entityId ?? "doc-001",
    action: overrides.action ?? "document.uploaded",
    beforeState: overrides.beforeState ?? null,
    afterState: overrides.afterState ?? null,
    hashChain: overrides.hashChain ?? null,
    createdAt: overrides.createdAt ?? new Date("2026-04-10T12:00:00.000Z"),
  };
}

describe("ceoDashboardMonitoring", () => {
  it("resume eventos por tipo y casos distintos", () => {
    const items = [
      buildAuditItem({ id: 1, action: "document.uploaded", entityType: "document", caseId: "case-001" }),
      buildAuditItem({ id: 2, action: "document.guardrail_rejected", entityType: "document", caseId: "case-001" }),
      buildAuditItem({ id: 3, action: "access.membership_updated", entityType: "access", caseId: "case-002" }),
      buildAuditItem({ id: 4, action: "policy.create", entityType: "policy", caseId: null }),
    ];

    expect(buildAuditMonitoringSummary(items)).toEqual({
      totalEvents: 4,
      guardrailRejections: 1,
      documentEvents: 2,
      accessEvents: 1,
      policyEvents: 1,
      distinctCases: 2,
    });
  });

  it("normaliza etiquetas y tonos para rechazos operativos", () => {
    expect(getAuditActionLabel("document.guardrail_rejected")).toBe("Rechazo operativo");
    expect(getAuditActionLabel("access.membership_updated")).toBe("Acceso");
    expect(getAuditActionTone("document.guardrail_rejected")).toEqual({
      badge: "border-amber-200 bg-amber-50 text-amber-800",
      card: "border-amber-200/80 bg-amber-50/60",
    });
  });

  it("extrae el motivo de rechazo sólo cuando existe en afterState", () => {
    const rejected = buildAuditItem({
      action: "document.guardrail_rejected",
      afterState: { reason: "rate_limit_exceeded", message: "Demasiados intentos" },
    });
    const regular = buildAuditItem({ action: "document.uploaded", afterState: { reason: "ignored" } });

    expect(getAuditRejectionReason(rejected)).toBe("rate_limit_exceeded");
    expect(getAuditRejectionReason(regular)).toBeNull();
  });
});

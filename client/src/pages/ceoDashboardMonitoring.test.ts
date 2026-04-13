import { describe, expect, it } from "vitest";

import {
  LEGAL_GATE_WEEKLY_ALERT_THRESHOLD,
  buildAuditExecutiveAlerts,
  buildAuditMonitoringSummary,
  filterAuditFeed,
  getAuditActionLabel,
  getAuditActionTone,
  getAuditDrilldownDescriptor,
  getAuditEventFamily,
  getAuditEventSeverity,
  getAuditRejectionReason,
  getGuardrailSuggestedAction,
  type AuditFeedItem,
} from "./ceoDashboardMonitoring";

function buildAuditItem(overrides: Partial<AuditFeedItem> = {}): AuditFeedItem {
  return {
    id: overrides.id ?? 1,
    tenantId: overrides.tenantId ?? "tenant-demo",
    caseId: Object.prototype.hasOwnProperty.call(overrides, "caseId") ? (overrides.caseId ?? null) : "case-001",
    traceId: overrides.traceId ?? "trace-001",
    documentId: Object.prototype.hasOwnProperty.call(overrides, "documentId") ? (overrides.documentId ?? null) : null,
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
  it("resume eventos por tipo, casos distintos y embudo operativo derivado del audit trail", () => {
    const items = [
      buildAuditItem({
        id: 1,
        action: "document.preview_analyzed",
        entityType: "document",
        caseId: "case-001",
        afterState: { captureMode: "camera" },
      }),
      buildAuditItem({
        id: 2,
        action: "document.preview_confirmed",
        entityType: "document",
        caseId: "case-001",
        afterState: { previewCreatedAt: "2026-04-10T11:59:10.000Z", captureMode: "camera" },
        createdAt: "2026-04-10T12:00:00.000Z",
      }),
      buildAuditItem({ id: 3, action: "document.upload", entityType: "document", caseId: "case-001" }),
      buildAuditItem({ id: 4, action: "access.membership_updated", entityType: "access", caseId: "case-002" }),
      buildAuditItem({ id: 5, action: "policy.create", entityType: "policy", caseId: null }),
      buildAuditItem({ id: 6, action: "consent.legal_package_accept", entityType: "consent", caseId: "case-001" }),
      buildAuditItem({ id: 7, action: "consent.legal_package_lock_conflict", entityType: "consent", caseId: "case-003" }),
      buildAuditItem({ id: 8, action: "document.guardrail_rejected", entityType: "system", caseId: null, entityId: "draft:guardrail" }),
    ];

    expect(buildAuditMonitoringSummary(items)).toEqual({
      totalEvents: 8,
      guardrailRejections: 1,
      documentEvents: 4,
      accessEvents: 1,
      policyEvents: 1,
      distinctCases: 3,
      previewAnalyzedEvents: 1,
      previewConfirmedEvents: 1,
      documentUploadEvents: 1,
      cameraCaptureSelections: 1,
      fileCaptureSelections: 0,
      previewToConfirmRate: 100,
      confirmToUploadRate: 100,
      averagePreviewToConfirmationSeconds: 50,
      legalGateAcceptances: 1,
      legalGateLockConflicts: 1,
      legalGateAbandonments: 1,
      legalGateAbandonmentRate: 50,
      averageLegalGateResolutionSeconds: null,
      legalGateAffectedCases: [
        {
          tenantId: "tenant-demo",
          caseId: "case-003",
          scopeId: "case-003",
          conflictStartedAt: "2026-04-10T12:00:00.000Z",
          ageSeconds: 0,
        },
      ],
      legalGateWeeklyTrend: [{ weekStart: "2026-04-06T00:00:00.000Z", abandonmentCount: 1, isOutOfRange: false }],
      guardrailReasonRanking: [
        {
          reason: "sin_detalle",
          count: 1,
          latestAt: "2026-04-10T12:00:00.000Z",
          caseId: null,
          tenantId: "tenant-demo",
          suggestedAction: "Revisar el detalle del rechazo en el feed filtrado y replicar el caso antes de ajustar reglas.",
        },
      ],
      cameraPreviewToConfirmRate: 100,
      filePreviewToConfirmRate: null,
      dominantCaptureMode: "camera",
    });
  });

  it("deriva abandono y tiempo medio de resolución del gate legal reutilizando el audit trail existente", () => {
    const items = [
      buildAuditItem({
        id: 11,
        action: "consent.legal_package_lock_conflict",
        entityType: "consent",
        caseId: "case-201",
        createdAt: "2026-04-10T12:00:00.000Z",
      }),
      buildAuditItem({
        id: 12,
        action: "consent.legal_package_accept",
        entityType: "consent",
        caseId: "case-201",
        createdAt: "2026-04-10T12:02:00.000Z",
      }),
      buildAuditItem({
        id: 13,
        action: "consent.legal_package_lock_conflict",
        entityType: "consent",
        caseId: "case-202",
        createdAt: "2026-04-10T12:03:00.000Z",
      }),
    ];

    expect(buildAuditMonitoringSummary(items)).toMatchObject({
      legalGateAcceptances: 1,
      legalGateLockConflicts: 2,
      legalGateAbandonments: 1,
      legalGateAbandonmentRate: 50,
      averageLegalGateResolutionSeconds: 120,
      legalGateAffectedCases: [
        {
          tenantId: "tenant-demo",
          caseId: "case-202",
          scopeId: "case-202",
          conflictStartedAt: "2026-04-10T12:03:00.000Z",
          ageSeconds: 0,
        },
      ],
      legalGateWeeklyTrend: [{ weekStart: "2026-04-06T00:00:00.000Z", abandonmentCount: 1, isOutOfRange: false }],
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

  it("extrae el motivo de rechazo sólo cuando existe en afterState incluso si viene serializado", () => {
    const rejected = buildAuditItem({
      action: "document.guardrail_rejected",
      afterState: JSON.stringify({ reason: "rate_limit_exceeded", message: "Demasiados intentos" }),
    });
    const regular = buildAuditItem({ action: "document.uploaded", afterState: { reason: "ignored" } });

    expect(getAuditRejectionReason(rejected)).toBe("rate_limit_exceeded");
    expect(getAuditRejectionReason(regular)).toBeNull();
  });

  it("clasifica familia y severidad para los filtros rápidos del feed", () => {
    const rejected = buildAuditItem({ action: "document.guardrail_rejected", entityType: "document" });
    const access = buildAuditItem({ action: "access.membership_updated", entityType: "access" });
    const document = buildAuditItem({ action: "document.uploaded", entityType: "document" });

    expect(getAuditEventFamily(rejected)).toBe("guardrail");
    expect(getAuditEventSeverity(rejected)).toBe("high");
    expect(getAuditEventFamily(access)).toBe("access");
    expect(getAuditEventSeverity(access)).toBe("medium");
    expect(getAuditEventFamily(document)).toBe("document");
    expect(getAuditEventSeverity(document)).toBe("normal");
  });

  it("filtra la bitácora por familia y severidad sin mezclar eventos ajenos", () => {
    const items = [
      buildAuditItem({ id: 1, action: "document.guardrail_rejected", entityType: "document" }),
      buildAuditItem({ id: 2, action: "document.uploaded", entityType: "document" }),
      buildAuditItem({ id: 3, action: "access.membership_updated", entityType: "access" }),
      buildAuditItem({ id: 4, action: "policy.create", entityType: "policy" }),
    ];

    expect(filterAuditFeed(items, { family: "guardrail", severity: "all" }).map((item) => item.id)).toEqual([1]);
    expect(filterAuditFeed(items, { family: "all", severity: "medium" }).map((item) => item.id)).toEqual([3, 4]);
    expect(filterAuditFeed(items, { family: "document", severity: "normal" }).map((item) => item.id)).toEqual([2]);
  });

  it("agrupa las causas de guardrail y ordena el ranking por volumen y recencia", () => {
    const items = [
      buildAuditItem({
        id: 31,
        tenantId: "tenant-a",
        caseId: "case-401",
        action: "document.guardrail_rejected",
        afterState: { reason: "rate_limit_exceeded" },
        createdAt: "2026-04-01T10:00:00.000Z",
      }),
      buildAuditItem({
        id: 32,
        tenantId: "tenant-a",
        caseId: "case-402",
        action: "document.guardrail_rejected",
        afterState: { reason: "unsupported_format" },
        createdAt: "2026-04-08T10:00:00.000Z",
      }),
      buildAuditItem({
        id: 33,
        tenantId: "tenant-b",
        caseId: "case-403",
        action: "document.guardrail_rejected",
        afterState: { reason: "rate_limit_exceeded" },
        createdAt: "2026-04-09T10:00:00.000Z",
      }),
      buildAuditItem({
        id: 34,
        tenantId: "tenant-c",
        caseId: "case-404",
        action: "document.guardrail_rejected",
        afterState: { reason: "rate_limit_exceeded" },
        createdAt: "2026-04-10T10:00:00.000Z",
      }),
    ];

    expect(buildAuditMonitoringSummary(items).guardrailReasonRanking).toEqual([
      {
        reason: "rate_limit_exceeded",
        count: 3,
        latestAt: "2026-04-10T10:00:00.000Z",
        caseId: "case-404",
        tenantId: "tenant-c",
        suggestedAction: "Espaciar reintentos y revisar deduplicación o control de ráfagas antes de volver a auditar.",
      },
      {
        reason: "unsupported_format",
        count: 1,
        latestAt: "2026-04-08T10:00:00.000Z",
        caseId: "case-402",
        tenantId: "tenant-a",
        suggestedAction: "Guiar al usuario a formatos permitidos y validar el archivo antes de enviarlo al análisis.",
      },
    ]);
  });

  it("marca semanas fuera de rango cuando superan el umbral visible de abandono legal", () => {
    const items = [
      buildAuditItem({ id: 41, action: "consent.legal_package_lock_conflict", entityType: "consent", caseId: "case-501", createdAt: "2026-04-07T10:00:00.000Z" }),
      buildAuditItem({ id: 42, action: "consent.legal_package_lock_conflict", entityType: "consent", caseId: "case-502", createdAt: "2026-04-08T10:00:00.000Z" }),
    ];

    expect(LEGAL_GATE_WEEKLY_ALERT_THRESHOLD).toBe(2);
    expect(buildAuditMonitoringSummary(items).legalGateWeeklyTrend).toEqual([
      { weekStart: "2026-04-06T00:00:00.000Z", abandonmentCount: 2, isOutOfRange: true },
    ]);
  });

  it("mapea acciones sugeridas de guardrail sin necesitar backend adicional", () => {
    expect(getGuardrailSuggestedAction("rate_limit_exceeded")).toBe(
      "Espaciar reintentos y revisar deduplicación o control de ráfagas antes de volver a auditar.",
    );
    expect(getGuardrailSuggestedAction("unsupported_format")).toBe(
      "Guiar al usuario a formatos permitidos y validar el archivo antes de enviarlo al análisis.",
    );
    expect(getGuardrailSuggestedAction("custom_reason")).toBe(
      "Revisar el detalle del rechazo en el feed filtrado y replicar el caso antes de ajustar reglas.",
    );
  });

  it("genera alertas ejecutivas cuando se acumulan rechazos por tenant o por caso", () => {
    const items = [
      buildAuditItem({ id: 1, tenantId: "tenant-a", caseId: "case-001", action: "document.guardrail_rejected" }),
      buildAuditItem({ id: 2, tenantId: "tenant-a", caseId: "case-001", action: "document.guardrail_rejected" }),
      buildAuditItem({ id: 3, tenantId: "tenant-a", caseId: "case-002", action: "document.guardrail_rejected" }),
      buildAuditItem({ id: 4, tenantId: "tenant-b", caseId: "case-010", action: "document.uploaded" }),
    ];

    expect(buildAuditExecutiveAlerts(items)).toEqual([
      {
        source: "guardrail",
        scope: "tenant",
        scopeId: "tenant-a",
        tenantId: "tenant-a",
        caseId: null,
        count: 3,
        rejectionCount: 3,
        countLabel: "rechazos",
        severity: "high",
        title: "Fricción repetida en tenant-a",
        description: "Se acumularon 3 rechazos operativos recientes en el tenant y conviene revisar saturación, deduplicación o reglas de entrada.",
      },
      {
        source: "guardrail",
        scope: "case",
        scopeId: "case-001",
        tenantId: "tenant-a",
        caseId: "case-001",
        count: 2,
        rejectionCount: 2,
        countLabel: "rechazos",
        severity: "medium",
        title: "Caso case-001 con rechazos repetidos",
        description: "El caso visible suma 2 rechazos operativos recientes; conviene revisar el motivo antes de seguir operando.",
      },
    ]);
  });

  it("propone el drill-down correcto según el tipo de evento auditado", () => {
    expect(getAuditDrilldownDescriptor(buildAuditItem({ documentId: "doc-123", action: "document.uploaded" }))).toEqual({
      path: "/ceo/documentos",
      label: "Ver documento relacionado",
      helper: "Documento doc-123",
    });

    expect(getAuditDrilldownDescriptor(buildAuditItem({ entityType: "access", action: "access.membership_updated", caseId: "case-002" }))).toEqual({
      path: "/ceo/accesos",
      label: "Ver acceso del caso",
      helper: "Caso case-002",
    });

    expect(getAuditDrilldownDescriptor(buildAuditItem({ entityType: "alert", action: "alert.raised", caseId: null }))).toEqual({
      path: "/ceo/alertas",
      label: "Ver alertas relacionadas",
      helper: "Abrir la vista de alertas filtrada",
    });
  });
});

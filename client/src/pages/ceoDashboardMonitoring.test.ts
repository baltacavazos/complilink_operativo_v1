import { describe, expect, it } from "vitest";

import {
  LEGAL_GATE_WEEKLY_ALERT_THRESHOLD,
  buildAuditExecutiveAlerts,
  buildAuditMonitoringSummary,
  buildGuardrailFollowUpSummary,
  filterAuditFeed,
  getAuditActionLabel,
  getAuditActionTone,
  getAuditDrilldownDescriptor,
  getAuditEventFamily,
  getAuditEventSeverity,
  getAuditRejectionReason,
  getGuardrailFollowUpMeta,
  getGuardrailSuggestedAction,
  getNextGuardrailFollowUpStatus,
  hasConsecutiveLegalGateWorseningWeeks,
  parseAuditEventFamily,
  parseAuditEventSeverity,
  type AuditFeedItem,
  type GuardrailFollowUpStatus,
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
      legalGateWeeklyTrend: [
        {
          weekStart: "2026-04-06T00:00:00.000Z",
          abandonmentCount: 1,
          previousAbandonmentCount: null,
          deltaCount: null,
          trendDirection: "new",
          isOutOfRange: false,
        },
      ],
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
      firstDossier: {
        visibleStarts: 1,
        visibleConfirmations: 1,
        visibleUploads: 1,
        previewGapCount: 0,
        uploadGapCount: 0,
        visibleDropOffCount: 0,
        visibleDropOffRate: 0,
        legalGateOpenCount: 1,
        dominantCaptureMode: "camera",
        paceLabel: "Confirmación visible en 50 s promedio.",
        priorityStage: "legal_gate",
        priorityLabel: "Fricción dominante en gate legal",
        narrative: "El mayor corte visible no está en el documento sino en 1 conflicto(s) abiertos del gate legal que siguen frenando expedientes.",
        nextAction: "Revisar copy, espera y concurrencia del gate legal antes de atribuir la caída al motor documental.",
        dataSourceNote: "Lectura derivada del audit trail visible: preview, confirmación, carga y gate legal. Los eventos cliente a cliente del primer expediente todavía no están consolidados aquí.",
      },
      firstDossierHistory: {
        weeklyDropOffRate: 0,
        previousWeeklyDropOffRate: null,
        weeklyDropOffDelta: null,
        weeklyTrendDirection: "new",
        statusLabel: "Serie en arranque",
        dominantStage: "legal_gate",
        dominantStageLabel: "Gate legal",
        latestDailyDropOffCount: 0,
        latestDailyCompletionRate: 100,
        latestDailyPreviewToConfirmationSeconds: 50,
        dailySeries: [
          {
            bucketStart: "2026-04-10T00:00:00.000Z",
            starts: 1,
            confirmations: 1,
            uploads: 1,
            visibleDropOffCount: 0,
            visibleDropOffRate: 0,
            averagePreviewToConfirmationSeconds: 50,
            legalGateConflictCount: 1,
            dominantStage: "legal_gate",
            dominantStageLabel: "Gate legal",
          },
        ],
        weeklySeries: [
          {
            bucketStart: "2026-04-06T00:00:00.000Z",
            starts: 1,
            confirmations: 1,
            uploads: 1,
            visibleDropOffCount: 0,
            visibleDropOffRate: 0,
            averagePreviewToConfirmationSeconds: 50,
            legalGateConflictCount: 1,
            dominantStage: "legal_gate",
            dominantStageLabel: "Gate legal",
          },
        ],
        insight: "La semana más reciente sugiere que la caída visible se explica más por conflictos del gate legal que por el embudo documental puro.",
        dataSourceNote:
          "Serie derivada del audit trail visible y agregada en ventanas móviles de hasta 7 días y 6 semanas. El historial usa preview, confirmación, carga y conflictos visibles de gate legal; aún no consolida eventos cliente a cliente como atajos o vacilación.",
      },
    });
  });

  it("prioriza la caída antes de confirmar cuando el preview se enfría más que el cierre final", () => {
    const items = [
      buildAuditItem({
        id: 51,
        action: "document.preview_analyzed",
        entityType: "document",
        caseId: "case-601",
        afterState: { captureMode: "file" },
      }),
      buildAuditItem({
        id: 52,
        action: "document.preview_analyzed",
        entityType: "document",
        caseId: "case-602",
        afterState: { captureMode: "file" },
      }),
      buildAuditItem({
        id: 53,
        action: "document.preview_confirmed",
        entityType: "document",
        caseId: "case-601",
        afterState: { previewCreatedAt: "2026-04-10T11:59:20.000Z", captureMode: "file" },
        createdAt: "2026-04-10T12:00:00.000Z",
      }),
    ];

    expect(buildAuditMonitoringSummary(items).firstDossier).toEqual({
      visibleStarts: 2,
      visibleConfirmations: 1,
      visibleUploads: 0,
      previewGapCount: 1,
      uploadGapCount: 1,
      visibleDropOffCount: 2,
      visibleDropOffRate: 100,
      legalGateOpenCount: 0,
      dominantCaptureMode: "file",
      paceLabel: "Confirmación visible en 40 s promedio.",
      priorityStage: "preview_confirmation",
      priorityLabel: "Se enfría antes de confirmar",
      narrative: "La pérdida visible principal ocurre entre preview y confirmación: 1 expediente(s) no terminan de validarse tras el análisis inicial.",
      nextAction: "Revisar claridad del preview, naming del documento y señales de confianza antes del clic de confirmar.",
      dataSourceNote: "Lectura derivada del audit trail visible: preview, confirmación, carga y gate legal. Los eventos cliente a cliente del primer expediente todavía no están consolidados aquí.",
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
      legalGateWeeklyTrend: [
        {
          weekStart: "2026-04-06T00:00:00.000Z",
          abandonmentCount: 1,
          previousAbandonmentCount: null,
          deltaCount: null,
          trendDirection: "new",
          isOutOfRange: false,
        },
      ],
    });
  });

  it("arma una serie histórica visible por día y semana para leer tendencia del primer expediente", () => {
    const summary = buildAuditMonitoringSummary([
      buildAuditItem({
        id: 81,
        action: "document.preview_analyzed",
        caseId: "case-701",
        createdAt: "2026-04-01T10:00:00.000Z",
        afterState: { captureMode: "file" },
      }),
      buildAuditItem({
        id: 82,
        action: "document.preview_confirmed",
        caseId: "case-701",
        createdAt: "2026-04-01T10:01:00.000Z",
        afterState: { previewCreatedAt: "2026-04-01T10:00:00.000Z", captureMode: "file" },
      }),
      buildAuditItem({
        id: 83,
        action: "document.upload",
        caseId: "case-701",
        createdAt: "2026-04-01T10:02:00.000Z",
      }),
      buildAuditItem({
        id: 84,
        action: "document.preview_analyzed",
        caseId: "case-702",
        createdAt: "2026-04-01T11:00:00.000Z",
        afterState: { captureMode: "file" },
      }),
      buildAuditItem({
        id: 91,
        action: "document.preview_analyzed",
        caseId: "case-801",
        createdAt: "2026-04-08T10:00:00.000Z",
        afterState: { captureMode: "camera" },
      }),
      buildAuditItem({
        id: 92,
        action: "document.preview_analyzed",
        caseId: "case-802",
        createdAt: "2026-04-08T10:05:00.000Z",
        afterState: { captureMode: "camera" },
      }),
      buildAuditItem({
        id: 93,
        action: "document.preview_analyzed",
        caseId: "case-803",
        createdAt: "2026-04-08T10:10:00.000Z",
        afterState: { captureMode: "camera" },
      }),
      buildAuditItem({
        id: 94,
        action: "document.preview_confirmed",
        caseId: "case-801",
        createdAt: "2026-04-08T10:01:00.000Z",
        afterState: { previewCreatedAt: "2026-04-08T10:00:00.000Z", captureMode: "camera" },
      }),
      buildAuditItem({
        id: 95,
        action: "document.preview_confirmed",
        caseId: "case-802",
        createdAt: "2026-04-08T10:07:00.000Z",
        afterState: { previewCreatedAt: "2026-04-08T10:05:00.000Z", captureMode: "camera" },
      }),
      buildAuditItem({
        id: 96,
        action: "document.preview_confirmed",
        caseId: "case-803",
        createdAt: "2026-04-08T10:13:00.000Z",
        afterState: { previewCreatedAt: "2026-04-08T10:10:00.000Z", captureMode: "camera" },
      }),
      buildAuditItem({
        id: 97,
        action: "document.upload",
        caseId: "case-801",
        createdAt: "2026-04-08T10:20:00.000Z",
      }),
      buildAuditItem({
        id: 98,
        action: "consent.legal_package_lock_conflict",
        entityType: "consent",
        caseId: "case-804",
        createdAt: "2026-04-08T11:00:00.000Z",
      }),
    ]);

    expect(summary.firstDossierHistory).toMatchObject({
      weeklyDropOffRate: 67,
      previousWeeklyDropOffRate: 50,
      weeklyDropOffDelta: 17,
      weeklyTrendDirection: "up",
      statusLabel: "Fricción en aumento",
      dominantStage: "confirmation_upload",
      dominantStageLabel: "Confirmación → carga",
      latestDailyDropOffCount: 2,
      latestDailyCompletionRate: 33,
      latestDailyPreviewToConfirmationSeconds: 120,
      weeklySeries: [
        {
          bucketStart: "2026-03-30T00:00:00.000Z",
          starts: 2,
          confirmations: 1,
          uploads: 1,
          visibleDropOffCount: 1,
          visibleDropOffRate: 50,
          averagePreviewToConfirmationSeconds: 60,
          legalGateConflictCount: 0,
          dominantStage: "preview_confirmation",
          dominantStageLabel: "Preview → confirmación",
        },
        {
          bucketStart: "2026-04-06T00:00:00.000Z",
          starts: 3,
          confirmations: 3,
          uploads: 1,
          visibleDropOffCount: 2,
          visibleDropOffRate: 67,
          averagePreviewToConfirmationSeconds: 120,
          legalGateConflictCount: 1,
          dominantStage: "confirmation_upload",
          dominantStageLabel: "Confirmación → carga",
        },
      ],
      dailySeries: [
        {
          bucketStart: "2026-04-01T00:00:00.000Z",
          starts: 2,
          confirmations: 1,
          uploads: 1,
          visibleDropOffCount: 1,
          visibleDropOffRate: 50,
          averagePreviewToConfirmationSeconds: 60,
          legalGateConflictCount: 0,
          dominantStage: "preview_confirmation",
          dominantStageLabel: "Preview → confirmación",
        },
        {
          bucketStart: "2026-04-08T00:00:00.000Z",
          starts: 3,
          confirmations: 3,
          uploads: 1,
          visibleDropOffCount: 2,
          visibleDropOffRate: 67,
          averagePreviewToConfirmationSeconds: 120,
          legalGateConflictCount: 1,
          dominantStage: "confirmation_upload",
          dominantStageLabel: "Confirmación → carga",
        },
      ],
    });
    expect(summary.firstDossierHistory.insight).toContain("después de confirmar");
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
    expect(parseAuditEventFamily("access")).toBe("access");
    expect(parseAuditEventFamily("desconocido")).toBe("all");
    expect(parseAuditEventSeverity("medium")).toBe("medium");
    expect(parseAuditEventSeverity("critica")).toBe("all");
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

  it("marca semanas fuera de rango y calcula comparación contra la semana previa", () => {
    const items = [
      buildAuditItem({ id: 41, action: "consent.legal_package_lock_conflict", entityType: "consent", caseId: "case-501", createdAt: "2026-03-31T10:00:00.000Z" }),
      buildAuditItem({ id: 42, action: "consent.legal_package_lock_conflict", entityType: "consent", caseId: "case-502", createdAt: "2026-04-07T10:00:00.000Z" }),
      buildAuditItem({ id: 43, action: "consent.legal_package_lock_conflict", entityType: "consent", caseId: "case-503", createdAt: "2026-04-08T10:00:00.000Z" }),
    ];

    expect(LEGAL_GATE_WEEKLY_ALERT_THRESHOLD).toBe(2);
    expect(buildAuditMonitoringSummary(items).legalGateWeeklyTrend).toEqual([
      {
        weekStart: "2026-03-30T00:00:00.000Z",
        abandonmentCount: 1,
        previousAbandonmentCount: null,
        deltaCount: null,
        trendDirection: "new",
        isOutOfRange: false,
      },
      {
        weekStart: "2026-04-06T00:00:00.000Z",
        abandonmentCount: 2,
        previousAbandonmentCount: 1,
        deltaCount: 1,
        trendDirection: "up",
        isOutOfRange: true,
      },
    ]);
  });

  it("detecta cuando el gate legal empeora dos semanas consecutivas", () => {
    expect(
      hasConsecutiveLegalGateWorseningWeeks([
        {
          weekStart: "2026-03-30T00:00:00.000Z",
          abandonmentCount: 1,
          previousAbandonmentCount: null,
          deltaCount: null,
          trendDirection: "new",
          isOutOfRange: false,
        },
        {
          weekStart: "2026-04-06T00:00:00.000Z",
          abandonmentCount: 2,
          previousAbandonmentCount: 1,
          deltaCount: 1,
          trendDirection: "up",
          isOutOfRange: true,
        },
        {
          weekStart: "2026-04-13T00:00:00.000Z",
          abandonmentCount: 4,
          previousAbandonmentCount: 2,
          deltaCount: 2,
          trendDirection: "up",
          isOutOfRange: true,
        },
      ]),
    ).toBe(true);

    expect(
      hasConsecutiveLegalGateWorseningWeeks([
        {
          weekStart: "2026-03-30T00:00:00.000Z",
          abandonmentCount: 1,
          previousAbandonmentCount: null,
          deltaCount: null,
          trendDirection: "new",
          isOutOfRange: false,
        },
        {
          weekStart: "2026-04-06T00:00:00.000Z",
          abandonmentCount: 2,
          previousAbandonmentCount: 1,
          deltaCount: 1,
          trendDirection: "up",
          isOutOfRange: true,
        },
        {
          weekStart: "2026-04-13T00:00:00.000Z",
          abandonmentCount: 2,
          previousAbandonmentCount: 2,
          deltaCount: 0,
          trendDirection: "flat",
          isOutOfRange: true,
        },
      ]),
    ).toBe(false);
  });

  it("mapea acciones sugeridas y permite ciclar el seguimiento operativo sin backend adicional", () => {
    expect(getGuardrailSuggestedAction("rate_limit_exceeded")).toBe(
      "Espaciar reintentos y revisar deduplicación o control de ráfagas antes de volver a auditar.",
    );
    expect(getGuardrailSuggestedAction("unsupported_format")).toBe(
      "Guiar al usuario a formatos permitidos y validar el archivo antes de enviarlo al análisis.",
    );
    expect(getGuardrailSuggestedAction("custom_reason")).toBe(
      "Revisar el detalle del rechazo en el feed filtrado y replicar el caso antes de ajustar reglas.",
    );

    const cycle: GuardrailFollowUpStatus[] = ["pending", "tracking", "resolved"];
    expect(cycle.map((status) => getNextGuardrailFollowUpStatus(status))).toEqual(["tracking", "resolved", "pending"]);
    expect(getGuardrailFollowUpMeta("pending")).toEqual({
      label: "Pendiente",
      badgeClassName: "border-slate-200 bg-slate-100 text-slate-700",
      actionLabel: "Marcar seguimiento",
    });
    expect(getGuardrailFollowUpMeta("tracking")).toEqual({
      label: "En seguimiento",
      badgeClassName: "border-amber-200 bg-amber-50 text-amber-800",
      actionLabel: "Marcar resuelta",
    });
    expect(getGuardrailFollowUpMeta("resolved")).toEqual({
      label: "Resuelta",
      badgeClassName: "border-emerald-200 bg-emerald-50 text-emerald-800",
      actionLabel: "Reabrir seguimiento",
    });
    expect(
      buildGuardrailFollowUpSummary(["rate_limit_exceeded", "unsupported_format", "legal_consent"], {
        rate_limit_exceeded: "resolved",
        unsupported_format: "tracking",
      }),
    ).toEqual({
      totalCount: 3,
      pendingCount: 1,
      trackingCount: 1,
      resolvedCount: 1,
      openCount: 2,
    });
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

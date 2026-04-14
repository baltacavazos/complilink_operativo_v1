export type AuditFeedItem = {
  id: number;
  tenantId: string;
  caseId: string | null;
  traceId: string;
  documentId: string | null;
  actorUserId: number | null;
  entityType: string;
  entityId: string;
  action: string;
  beforeState: unknown;
  afterState: unknown;
  hashChain: string | null;
  createdAt: Date | string;
};

export type LegalGateDrilldownItem = {
  tenantId: string;
  caseId: string | null;
  scopeId: string;
  conflictStartedAt: string;
  ageSeconds: number | null;
};

export type LegalGateWeeklyTrendPoint = {
  weekStart: string;
  abandonmentCount: number;
  previousAbandonmentCount: number | null;
  deltaCount: number | null;
  trendDirection: "up" | "down" | "flat" | "new";
  isOutOfRange: boolean;
};

export type FirstDossierPriorityStage = "no_signal" | "preview_confirmation" | "confirmation_upload" | "legal_gate" | "healthy";

export type FirstDossierExecutiveSummary = {
  visibleStarts: number;
  visibleConfirmations: number;
  visibleUploads: number;
  previewGapCount: number;
  uploadGapCount: number;
  visibleDropOffCount: number;
  visibleDropOffRate: number | null;
  legalGateOpenCount: number;
  dominantCaptureMode: "camera" | "file" | "balanced" | "none";
  paceLabel: string;
  priorityStage: FirstDossierPriorityStage;
  priorityLabel: string;
  narrative: string;
  nextAction: string;
  dataSourceNote: string;
};

export type GuardrailFollowUpStatus = "pending" | "tracking" | "resolved";

export type GuardrailReasonRankingItem = {
  reason: string;
  count: number;
  latestAt: string | null;
  caseId: string | null;
  tenantId: string;
  suggestedAction: string;
};

export type GuardrailFollowUpSummary = {
  totalCount: number;
  pendingCount: number;
  trackingCount: number;
  resolvedCount: number;
  openCount: number;
};

export type AuditMonitoringSummary = {
  totalEvents: number;
  guardrailRejections: number;
  documentEvents: number;
  accessEvents: number;
  policyEvents: number;
  distinctCases: number;
  previewAnalyzedEvents: number;
  previewConfirmedEvents: number;
  documentUploadEvents: number;
  cameraCaptureSelections: number;
  fileCaptureSelections: number;
  previewToConfirmRate: number | null;
  confirmToUploadRate: number | null;
  averagePreviewToConfirmationSeconds: number | null;
  legalGateAcceptances: number;
  legalGateLockConflicts: number;
  legalGateAbandonments: number;
  legalGateAbandonmentRate: number | null;
  averageLegalGateResolutionSeconds: number | null;
  legalGateAffectedCases: LegalGateDrilldownItem[];
  legalGateWeeklyTrend: LegalGateWeeklyTrendPoint[];
  guardrailReasonRanking: GuardrailReasonRankingItem[];
  cameraPreviewToConfirmRate: number | null;
  filePreviewToConfirmRate: number | null;
  dominantCaptureMode: "camera" | "file" | "balanced" | "none";
  firstDossier: FirstDossierExecutiveSummary;
};

export type AuditEventFamily = "all" | "guardrail" | "document" | "access" | "policy" | "alert" | "case" | "dashboard" | "other";
export type AuditEventSeverity = "all" | "high" | "medium" | "normal";

const AUDIT_EVENT_FAMILY_VALUES: AuditEventFamily[] = ["all", "guardrail", "document", "access", "policy", "alert", "case", "dashboard", "other"];
const AUDIT_EVENT_SEVERITY_VALUES: AuditEventSeverity[] = ["all", "high", "medium", "normal"];

export type AuditExecutiveAlert = {
  source: "guardrail" | "access_risk";
  scope: "tenant" | "case";
  scopeId: string;
  tenantId: string;
  caseId: string | null;
  count: number;
  rejectionCount: number;
  countLabel: "rechazos" | "señales";
  severity: Exclude<AuditEventSeverity, "all">;
  title: string;
  description: string;
};

export type AuditDrilldownDescriptor = {
  path: "/ceo" | "/ceo/alertas" | "/ceo/accesos" | "/ceo/documentos";
  label: string;
  helper: string;
};

type AuditStateRecord = Record<string, unknown>;

export const LEGAL_GATE_WEEKLY_ALERT_THRESHOLD = 2;

type AccessRiskBucket = {
  tenantId: string;
  caseId: string | null;
  scope: "tenant" | "case";
  scopeId: string;
  kind: string;
  title: string;
  description: string;
  count: number;
  severity: Exclude<AuditEventSeverity, "all">;
};

function uniqueCount(values: Array<string | null | undefined>) {
  return new Set(values.filter((value): value is string => Boolean(value))).size;
}

function normalizeActionFamily(action: string): Exclude<AuditEventFamily, "all"> {
  if (action === "document.guardrail_rejected") return "guardrail";
  if (action.startsWith("document.")) return "document";
  if (action.startsWith("access.")) return "access";
  if (action.startsWith("policy.")) return "policy";
  if (action.startsWith("alert.")) return "alert";
  if (action.startsWith("case.")) return "case";
  if (action.startsWith("dashboard.")) return "dashboard";
  return "other";
}

export function parseAuditEventFamily(value: string | null | undefined): AuditEventFamily {
  return AUDIT_EVENT_FAMILY_VALUES.includes(value as AuditEventFamily) ? (value as AuditEventFamily) : "all";
}

export function parseAuditEventSeverity(value: string | null | undefined): AuditEventSeverity {
  return AUDIT_EVENT_SEVERITY_VALUES.includes(value as AuditEventSeverity) ? (value as AuditEventSeverity) : "all";
}

function parseAuditState(state: unknown): AuditStateRecord | null {
  if (!state) return null;

  if (typeof state === "string") {
    try {
      const parsed = JSON.parse(state) as unknown;
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as AuditStateRecord) : null;
    } catch {
      return null;
    }
  }

  return typeof state === "object" && !Array.isArray(state) ? (state as AuditStateRecord) : null;
}

function toTimestampMs(value: unknown) {
  if (value instanceof Date) {
    const timestamp = value.getTime();
    return Number.isFinite(timestamp) ? timestamp : null;
  }

  if (typeof value === "string" || typeof value === "number") {
    const timestamp = new Date(value).getTime();
    return Number.isFinite(timestamp) ? timestamp : null;
  }

  return null;
}

function getPercentage(numerator: number, denominator: number) {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 100);
}

function normalizeCaptureMode(value: unknown): "camera" | "file" | null {
  return value === "camera" || value === "file" ? value : null;
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function normalizeAccessRiskSeverity(value: unknown): Exclude<AuditEventSeverity, "all"> {
  if (value === "critical" || value === "high") return "high";
  if (value === "warning" || value === "medium") return "medium";
  return "normal";
}

function pickMoreSevereAlert(
  left: Exclude<AuditEventSeverity, "all">,
  right: Exclude<AuditEventSeverity, "all">,
): Exclude<AuditEventSeverity, "all"> {
  const order = { high: 0, medium: 1, normal: 2 } satisfies Record<Exclude<AuditEventSeverity, "all">, number>;
  return order[left] <= order[right] ? left : right;
}

function getCaptureModeFromItem(item: AuditFeedItem) {
  const state = parseAuditState(item.afterState);
  return normalizeCaptureMode(state?.captureMode);
}

function getPreviewToConfirmationSeconds(item: AuditFeedItem) {
  if (item.action !== "document.preview_confirmed") return null;

  const state = parseAuditState(item.afterState);
  const previewCreatedAt = toTimestampMs(state?.previewCreatedAt);
  const confirmedAt = toTimestampMs(item.createdAt);

  if (previewCreatedAt === null || confirmedAt === null || confirmedAt < previewCreatedAt) {
    return null;
  }

  return Math.max(0, Math.round((confirmedAt - previewCreatedAt) / 1000));
}

function getDominantCaptureMode(cameraCount: number, fileCount: number): "camera" | "file" | "balanced" | "none" {
  if (cameraCount === 0 && fileCount === 0) return "none";
  if (cameraCount === fileCount) return "balanced";
  return cameraCount > fileCount ? "camera" : "file";
}

function buildFirstDossierExecutiveSummary(params: {
  starts: number;
  confirmations: number;
  uploads: number;
  legalGateOpenCount: number;
  averagePreviewToConfirmationSeconds: number | null;
  dominantCaptureMode: "camera" | "file" | "balanced" | "none";
}): FirstDossierExecutiveSummary {
  const previewGapCount = Math.max(params.starts - params.confirmations, 0);
  const uploadGapCount = Math.max(params.confirmations - params.uploads, 0);
  const visibleDropOffCount = Math.max(params.starts - params.uploads, 0);
  const visibleDropOffRate = getPercentage(visibleDropOffCount, params.starts);

  const paceLabel =
    params.averagePreviewToConfirmationSeconds === null
      ? "Todavía no hay tiempo medio visible entre preview y confirmación."
      : params.averagePreviewToConfirmationSeconds < 60
        ? `Confirmación visible en ${params.averagePreviewToConfirmationSeconds} s promedio.`
        : `Confirmación visible en ${(params.averagePreviewToConfirmationSeconds / 60).toFixed(1)} min promedio.`;

  if (params.starts === 0) {
    return {
      visibleStarts: 0,
      visibleConfirmations: 0,
      visibleUploads: 0,
      previewGapCount: 0,
      uploadGapCount: 0,
      visibleDropOffCount: 0,
      visibleDropOffRate: null,
      legalGateOpenCount: params.legalGateOpenCount,
      dominantCaptureMode: params.dominantCaptureMode,
      paceLabel,
      priorityStage: "no_signal",
      priorityLabel: "Sin base visible aún",
      narrative: "La consola todavía no ve suficientes eventos del primer expediente para construir una lectura ejecutiva confiable.",
      nextAction: "Esperar más actividad visible antes de extraer una prioridad operativa.",
      dataSourceNote: "Lectura derivada sólo del audit trail visible; aún no incorpora eventos cliente a cliente como atajos o vacilación.",
    };
  }

  let priorityStage: FirstDossierPriorityStage = "healthy";
  let priorityLabel = "Flujo visible estable";
  let narrative = "El primer expediente visible ya recorre preview, confirmación y carga sin una fricción dominante clara.";
  let nextAction = "Mantener seguimiento de tiempo de confirmación y del modo de captura predominante para no perder esta estabilidad.";

  if (params.legalGateOpenCount > 0 && params.legalGateOpenCount >= Math.max(previewGapCount, uploadGapCount)) {
    priorityStage = "legal_gate";
    priorityLabel = "Fricción dominante en gate legal";
    narrative = `El mayor corte visible no está en el documento sino en ${params.legalGateOpenCount} conflicto(s) abiertos del gate legal que siguen frenando expedientes.`;
    nextAction = "Revisar copy, espera y concurrencia del gate legal antes de atribuir la caída al motor documental.";
  } else if (previewGapCount >= uploadGapCount && previewGapCount > 0) {
    priorityStage = "preview_confirmation";
    priorityLabel = "Se enfría antes de confirmar";
    narrative = `La pérdida visible principal ocurre entre preview y confirmación: ${previewGapCount} expediente(s) no terminan de validarse tras el análisis inicial.`;
    nextAction = "Revisar claridad del preview, naming del documento y señales de confianza antes del clic de confirmar.";
  } else if (uploadGapCount > 0) {
    priorityStage = "confirmation_upload";
    priorityLabel = "Se cae después de confirmar";
    narrative = `La fricción visible se concentra tras la confirmación: ${uploadGapCount} expediente(s) no llegan a carga final aun después de validar el preview.`;
    nextAction = "Reforzar el CTA posterior a la confirmación y comprobar si el cierre final compite con pasos secundarios.";
  }

  return {
    visibleStarts: params.starts,
    visibleConfirmations: params.confirmations,
    visibleUploads: params.uploads,
    previewGapCount,
    uploadGapCount,
    visibleDropOffCount,
    visibleDropOffRate,
    legalGateOpenCount: params.legalGateOpenCount,
    dominantCaptureMode: params.dominantCaptureMode,
    paceLabel,
    priorityStage,
    priorityLabel,
    narrative,
    nextAction,
    dataSourceNote: "Lectura derivada del audit trail visible: preview, confirmación, carga y gate legal. Los eventos cliente a cliente del primer expediente todavía no están consolidados aquí.",
  };
}

function getLegalGateScopeId(item: AuditFeedItem) {
  if (typeof item.caseId === "string" && item.caseId.length > 0) {
    return item.caseId;
  }
  return item.entityId;
}

function getWeekStartIso(timestampMs: number) {
  const weekStart = new Date(timestampMs);
  weekStart.setUTCHours(0, 0, 0, 0);
  const dayOffset = (weekStart.getUTCDay() + 6) % 7;
  weekStart.setUTCDate(weekStart.getUTCDate() - dayOffset);
  return weekStart.toISOString();
}

export function getGuardrailSuggestedAction(reason: string) {
  const normalizedReason = reason.trim().toLowerCase();

  if (normalizedReason.includes("rate_limit") || normalizedReason.includes("too_many") || normalizedReason.includes("burst")) {
    return "Espaciar reintentos y revisar deduplicación o control de ráfagas antes de volver a auditar.";
  }

  if (normalizedReason.includes("format") || normalizedReason.includes("mime") || normalizedReason.includes("extension")) {
    return "Guiar al usuario a formatos permitidos y validar el archivo antes de enviarlo al análisis.";
  }

  if (normalizedReason.includes("size") || normalizedReason.includes("payload") || normalizedReason.includes("large")) {
    return "Reducir peso o páginas del archivo y mostrar una recomendación de compresión antes del reintento.";
  }

  if (normalizedReason.includes("legal") || normalizedReason.includes("consent")) {
    return "Revisar copy, espera y estado del gate legal antes de pedir un nuevo intento al usuario.";
  }

  return "Revisar el detalle del rechazo en el feed filtrado y replicar el caso antes de ajustar reglas.";
}

export function getNextGuardrailFollowUpStatus(current: GuardrailFollowUpStatus): GuardrailFollowUpStatus {
  if (current === "pending") return "tracking";
  if (current === "tracking") return "resolved";
  return "pending";
}

export function getGuardrailFollowUpMeta(status: GuardrailFollowUpStatus) {
  if (status === "tracking") {
    return {
      label: "En seguimiento",
      badgeClassName: "border-amber-200 bg-amber-50 text-amber-800",
      actionLabel: "Marcar resuelta",
    };
  }

  if (status === "resolved") {
    return {
      label: "Resuelta",
      badgeClassName: "border-emerald-200 bg-emerald-50 text-emerald-800",
      actionLabel: "Reabrir seguimiento",
    };
  }

  return {
    label: "Pendiente",
    badgeClassName: "border-slate-200 bg-slate-100 text-slate-700",
    actionLabel: "Marcar seguimiento",
  };
}

export function buildGuardrailFollowUpSummary(
  reasons: string[],
  followUpByReason: Record<string, GuardrailFollowUpStatus>,
): GuardrailFollowUpSummary {
  return reasons.reduce<GuardrailFollowUpSummary>(
    (summary, reason) => {
      const status = followUpByReason[reason] ?? "pending";
      summary.totalCount += 1;

      if (status === "resolved") {
        summary.resolvedCount += 1;
        return summary;
      }

      summary.openCount += 1;
      if (status === "tracking") {
        summary.trackingCount += 1;
      } else {
        summary.pendingCount += 1;
      }

      return summary;
    },
    {
      totalCount: 0,
      pendingCount: 0,
      trackingCount: 0,
      resolvedCount: 0,
      openCount: 0,
    },
  );
}

export function hasConsecutiveLegalGateWorseningWeeks(points: LegalGateWeeklyTrendPoint[]) {
  const comparablePoints = points.filter((point) => typeof point.deltaCount === "number");
  if (comparablePoints.length < 2) return false;

  const latestPoint = comparablePoints[comparablePoints.length - 1];
  const previousPoint = comparablePoints[comparablePoints.length - 2];
  return (latestPoint.deltaCount ?? 0) > 0 && (previousPoint.deltaCount ?? 0) > 0;
}

export function buildAuditMonitoringSummary(items: AuditFeedItem[]): AuditMonitoringSummary {
  const previewAnalyzedEvents = items.filter((item) => item.action === "document.preview_analyzed");
  const previewConfirmedEvents = items.filter((item) => item.action === "document.preview_confirmed");
  const documentUploadEvents = items.filter((item) => item.action === "document.upload");
  const guardrailEvents = items.filter((item) => item.action === "document.guardrail_rejected");
  const guardrailRejections = guardrailEvents.length;
  const legalGateAcceptances = items.filter((item) => item.action === "consent.legal_package_accept").length;
  const legalGateLockConflicts = items.filter((item) => item.action === "consent.legal_package_lock_conflict").length;
  const legalGateEvents = items
    .filter((item) => item.action === "consent.legal_package_accept" || item.action === "consent.legal_package_lock_conflict")
    .slice()
    .sort((left, right) => (toTimestampMs(left.createdAt) ?? 0) - (toTimestampMs(right.createdAt) ?? 0));

  let cameraCaptureSelections = 0;
  let fileCaptureSelections = 0;
  let cameraPreviewConfirmedEvents = 0;
  let filePreviewConfirmedEvents = 0;

  for (const item of previewAnalyzedEvents) {
    const captureMode = getCaptureModeFromItem(item);
    if (captureMode === "camera") cameraCaptureSelections += 1;
    if (captureMode === "file") fileCaptureSelections += 1;
  }

  for (const item of previewConfirmedEvents) {
    const captureMode = getCaptureModeFromItem(item);
    if (captureMode === "camera") cameraPreviewConfirmedEvents += 1;
    if (captureMode === "file") filePreviewConfirmedEvents += 1;
  }

  const previewToConfirmationSamples = previewConfirmedEvents
    .map((item) => getPreviewToConfirmationSeconds(item))
    .filter((value): value is number => value !== null);

  const latestVisibleTimestamp = items.reduce<number | null>((latest, item) => {
    const timestamp = toTimestampMs(item.createdAt);
    if (timestamp === null) return latest;
    return latest === null || timestamp > latest ? timestamp : latest;
  }, null);

  const legalGateOpenConflicts = new Map<string, { tenantId: string; caseId: string | null; scopeId: string; conflictStartedAt: number }>();
  const legalGateResolutionSamples: number[] = [];

  for (const event of legalGateEvents) {
    const scopeId = getLegalGateScopeId(event);
    const eventTimestamp = toTimestampMs(event.createdAt);
    if (!scopeId || eventTimestamp === null) {
      continue;
    }

    if (event.action === "consent.legal_package_lock_conflict") {
      if (!legalGateOpenConflicts.has(scopeId)) {
        legalGateOpenConflicts.set(scopeId, {
          tenantId: event.tenantId,
          caseId: event.caseId,
          scopeId,
          conflictStartedAt: eventTimestamp,
        });
      }
      continue;
    }

    const conflict = legalGateOpenConflicts.get(scopeId);
    if (conflict && eventTimestamp >= conflict.conflictStartedAt) {
      legalGateResolutionSamples.push(Math.round((eventTimestamp - conflict.conflictStartedAt) / 1000));
      legalGateOpenConflicts.delete(scopeId);
    }
  }

  const legalGateAffectedCases = Array.from(legalGateOpenConflicts.values())
    .sort((left, right) => right.conflictStartedAt - left.conflictStartedAt)
    .map((entry) => ({
      tenantId: entry.tenantId,
      caseId: entry.caseId,
      scopeId: entry.scopeId,
      conflictStartedAt: new Date(entry.conflictStartedAt).toISOString(),
      ageSeconds: latestVisibleTimestamp === null ? null : Math.max(0, Math.round((latestVisibleTimestamp - entry.conflictStartedAt) / 1000)),
    }));

  const legalGateWeeklyTrendEntries = Array.from(
    legalGateAffectedCases.reduce((buckets, entry) => {
      const conflictTimestamp = toTimestampMs(entry.conflictStartedAt);
      if (conflictTimestamp === null) return buckets;
      const bucketKey = getWeekStartIso(conflictTimestamp);
      buckets.set(bucketKey, (buckets.get(bucketKey) ?? 0) + 1);
      return buckets;
    }, new Map<string, number>()).entries(),
  ).sort(([left], [right]) => left.localeCompare(right));

  const legalGateWeeklyTrend = legalGateWeeklyTrendEntries.map(([weekStart, abandonmentCount], index) => {
    const previousAbandonmentCount = index > 0 ? legalGateWeeklyTrendEntries[index - 1]?.[1] ?? null : null;
    const deltaCount = previousAbandonmentCount === null ? null : abandonmentCount - previousAbandonmentCount;
    let trendDirection: LegalGateWeeklyTrendPoint["trendDirection"] = "new";
    if (deltaCount !== null) {
      trendDirection = deltaCount === 0 ? "flat" : deltaCount > 0 ? "up" : "down";
    }

    return {
      weekStart,
      abandonmentCount,
      previousAbandonmentCount,
      deltaCount,
      trendDirection,
      isOutOfRange: abandonmentCount >= LEGAL_GATE_WEEKLY_ALERT_THRESHOLD,
    } satisfies LegalGateWeeklyTrendPoint;
  });

  const guardrailReasonRanking = Array.from(
    guardrailEvents.reduce((buckets, item) => {
      const state = parseAuditState(item.afterState);
      const reason = readString(state?.reason) ?? "sin_detalle";
      const eventTimestamp = toTimestampMs(item.createdAt);
      const current =
        buckets.get(reason) ??
        ({
          reason,
          count: 0,
          latestAt: null,
          latestAtMs: null,
          caseId: item.caseId,
          tenantId: item.tenantId,
          suggestedAction: getGuardrailSuggestedAction(reason),
        } satisfies GuardrailReasonRankingItem & { latestAtMs: number | null });

      current.count += 1;
      if (eventTimestamp !== null && (current.latestAtMs === null || eventTimestamp >= current.latestAtMs)) {
        current.latestAtMs = eventTimestamp;
        current.latestAt = new Date(eventTimestamp).toISOString();
        current.caseId = item.caseId;
        current.tenantId = item.tenantId;
      }

      buckets.set(reason, current);
      return buckets;
    }, new Map<string, GuardrailReasonRankingItem & { latestAtMs: number | null }>()).values(),
  )
    .sort((left, right) => {
      if (right.count !== left.count) return right.count - left.count;
      return (right.latestAtMs ?? 0) - (left.latestAtMs ?? 0);
    })
    .slice(0, 5)
    .map(({ latestAtMs: _latestAtMs, ...entry }) => entry);

  const averagePreviewToConfirmationSeconds =
    previewToConfirmationSamples.length > 0
      ? Math.round(previewToConfirmationSamples.reduce((total, value) => total + value, 0) / previewToConfirmationSamples.length)
      : null;
  const legalGateAbandonments = legalGateOpenConflicts.size;
  const averageLegalGateResolutionSeconds =
    legalGateResolutionSamples.length > 0
      ? Math.round(legalGateResolutionSamples.reduce((total, value) => total + value, 0) / legalGateResolutionSamples.length)
      : null;
  const dominantCaptureMode = getDominantCaptureMode(cameraCaptureSelections, fileCaptureSelections);
  const firstDossier = buildFirstDossierExecutiveSummary({
    starts: previewAnalyzedEvents.length,
    confirmations: previewConfirmedEvents.length,
    uploads: documentUploadEvents.length,
    legalGateOpenCount: legalGateAbandonments,
    averagePreviewToConfirmationSeconds,
    dominantCaptureMode,
  });

  return {
    totalEvents: items.length,
    guardrailRejections,
    documentEvents: items.filter((item) => item.action.startsWith("document.") || item.entityType === "document").length,
    accessEvents: items.filter((item) => item.action.startsWith("access.") || item.entityType === "access").length,
    policyEvents: items.filter((item) => item.entityType === "policy").length,
    distinctCases: uniqueCount(items.map((item) => item.caseId)),
    previewAnalyzedEvents: previewAnalyzedEvents.length,
    previewConfirmedEvents: previewConfirmedEvents.length,
    documentUploadEvents: documentUploadEvents.length,
    cameraCaptureSelections,
    fileCaptureSelections,
    previewToConfirmRate: getPercentage(previewConfirmedEvents.length, previewAnalyzedEvents.length),
    confirmToUploadRate: getPercentage(documentUploadEvents.length, previewConfirmedEvents.length),
    averagePreviewToConfirmationSeconds,
    legalGateAcceptances,
    legalGateLockConflicts,
    legalGateAbandonments,
    legalGateAbandonmentRate: getPercentage(legalGateAbandonments, legalGateAcceptances + legalGateAbandonments),
    averageLegalGateResolutionSeconds,
    legalGateAffectedCases,
    legalGateWeeklyTrend,
    guardrailReasonRanking,
    cameraPreviewToConfirmRate: getPercentage(cameraPreviewConfirmedEvents, cameraCaptureSelections),
    filePreviewToConfirmRate: getPercentage(filePreviewConfirmedEvents, fileCaptureSelections),
    dominantCaptureMode,
    firstDossier,
  };
}

export function getAuditActionLabel(action: string) {
  if (action === "document.guardrail_rejected") return "Rechazo operativo";
  if (action.startsWith("document.")) return "Documento";
  if (action.startsWith("access.")) return "Acceso";
  if (action.startsWith("policy.")) return "Política";
  if (action.startsWith("alert.")) return "Alerta";
  if (action.startsWith("case.")) return "Caso";
  if (action.startsWith("dashboard.")) return "Tablero";
  return action.replaceAll("_", " ");
}

export function getAuditActionTone(action: string) {
  if (action === "document.guardrail_rejected") {
    return {
      badge: "border-amber-200 bg-amber-50 text-amber-800",
      card: "border-amber-200/80 bg-amber-50/60",
    };
  }

  if (action.startsWith("document.")) {
    return {
      badge: "border-cyan-200 bg-cyan-50 text-cyan-800",
      card: "border-cyan-100 bg-cyan-50/40",
    };
  }

  if (action.startsWith("access.")) {
    return {
      badge: "border-violet-200 bg-violet-50 text-violet-800",
      card: "border-violet-100 bg-violet-50/40",
    };
  }

  if (action.startsWith("policy.")) {
    return {
      badge: "border-emerald-200 bg-emerald-50 text-emerald-800",
      card: "border-emerald-100 bg-emerald-50/40",
    };
  }

  return {
    badge: "border-slate-200 bg-slate-100 text-slate-700",
    card: "border-slate-200 bg-slate-50/70",
  };
}

export function getAuditRejectionReason(item: AuditFeedItem) {
  if (item.action !== "document.guardrail_rejected") return null;
  const state = parseAuditState(item.afterState);
  const reason = state?.reason;
  return typeof reason === "string" && reason.length > 0 ? reason : null;
}

export function getAuditEventFamily(item: AuditFeedItem): Exclude<AuditEventFamily, "all"> {
  return normalizeActionFamily(item.action);
}

export function getAuditFamilyLabel(family: AuditEventFamily) {
  if (family === "all") return "Todos";
  if (family === "guardrail") return "Guardrails";
  if (family === "document") return "Documentos";
  if (family === "access") return "Accesos";
  if (family === "policy") return "Políticas";
  if (family === "alert") return "Alertas";
  if (family === "case") return "Casos";
  if (family === "dashboard") return "Tablero";
  return "Otros";
}

export function getAuditEventSeverity(item: AuditFeedItem): Exclude<AuditEventSeverity, "all"> {
  if (item.action === "document.guardrail_rejected") return "high";
  if (item.action.startsWith("alert.")) return "high";
  if (item.action.startsWith("access.") || item.action.startsWith("policy.") || item.action.startsWith("case.")) return "medium";
  return "normal";
}

export function getAuditSeverityLabel(severity: AuditEventSeverity) {
  if (severity === "all") return "Toda severidad";
  if (severity === "high") return "Alta";
  if (severity === "medium") return "Media";
  return "Normal";
}

export function filterAuditFeed(
  items: AuditFeedItem[],
  selection: {
    family: AuditEventFamily;
    severity: AuditEventSeverity;
  },
) {
  return items.filter((item) => {
    if (selection.family !== "all" && getAuditEventFamily(item) !== selection.family) return false;
    if (selection.severity !== "all" && getAuditEventSeverity(item) !== selection.severity) return false;
    return true;
  });
}

function getAlertSeverityByCount(count: number): Exclude<AuditEventSeverity, "all"> {
  if (count >= 3) return "high";
  if (count >= 2) return "medium";
  return "normal";
}

function buildGuardrailExecutiveAlerts(items: AuditFeedItem[]): AuditExecutiveAlert[] {
  const guardrailRejections = items.filter((item) => item.action === "document.guardrail_rejected");
  const byTenant = new Map<string, { tenantId: string; count: number }>();
  const byCase = new Map<string, { tenantId: string; caseId: string; count: number }>();

  for (const item of guardrailRejections) {
    const tenantBucket = byTenant.get(item.tenantId) ?? { tenantId: item.tenantId, count: 0 };
    tenantBucket.count += 1;
    byTenant.set(item.tenantId, tenantBucket);

    if (item.caseId) {
      const caseKey = `${item.tenantId}::${item.caseId}`;
      const caseBucket = byCase.get(caseKey) ?? { tenantId: item.tenantId, caseId: item.caseId, count: 0 };
      caseBucket.count += 1;
      byCase.set(caseKey, caseBucket);
    }
  }

  const alerts: AuditExecutiveAlert[] = [];

  for (const tenant of Array.from(byTenant.values())) {
    if (tenant.count < 2) continue;
    const severity = getAlertSeverityByCount(tenant.count);
    alerts.push({
      source: "guardrail",
      scope: "tenant",
      scopeId: tenant.tenantId,
      tenantId: tenant.tenantId,
      caseId: null,
      count: tenant.count,
      rejectionCount: tenant.count,
      countLabel: "rechazos",
      severity,
      title: `Fricción repetida en ${tenant.tenantId}`,
      description:
        severity === "high"
          ? `Se acumularon ${tenant.count} rechazos operativos recientes en el tenant y conviene revisar saturación, deduplicación o reglas de entrada.`
          : `Ya van ${tenant.count} rechazos operativos recientes en el tenant visible y la fricción amerita seguimiento.`,
    });
  }

  for (const entry of Array.from(byCase.values())) {
    if (entry.count < 2) continue;
    const severity = getAlertSeverityByCount(entry.count);
    alerts.push({
      source: "guardrail",
      scope: "case",
      scopeId: entry.caseId,
      tenantId: entry.tenantId,
      caseId: entry.caseId,
      count: entry.count,
      rejectionCount: entry.count,
      countLabel: "rechazos",
      severity,
      title: `Caso ${entry.caseId} con rechazos repetidos`,
      description:
        severity === "high"
          ? `El caso visible acumula ${entry.count} rechazos operativos recientes y ya presenta una fricción alta que merece intervención.`
          : `El caso visible suma ${entry.count} rechazos operativos recientes; conviene revisar el motivo antes de seguir operando.`,
    });
  }

  return alerts;
}

function buildAccessRiskExecutiveAlerts(items: AuditFeedItem[]): AuditExecutiveAlert[] {
  const anomalies = items.filter((item) => item.action === "access.anomaly_detected");
  const buckets = new Map<string, AccessRiskBucket>();

  for (const item of anomalies) {
    const state = parseAuditState(item.afterState);
    const scope = item.caseId ? "case" : "tenant";
    const scopeId = item.caseId ?? item.tenantId;
    const title = readString(state?.title) ?? "Señal de acceso inusual";
    const description =
      readString(state?.description) ??
      "Se detectó una señal reciente de acceso fuera del patrón esperado y conviene revisar el contexto visible.";
    const kind = readString(state?.kind) ?? title.toLowerCase();
    const severity = normalizeAccessRiskSeverity(state?.severity);
    const bucketKey = [item.tenantId, item.caseId ?? "__tenant__", scope, kind, title].join("::");
    const current =
      buckets.get(bucketKey) ??
      ({
        tenantId: item.tenantId,
        caseId: item.caseId ?? null,
        scope,
        scopeId,
        kind,
        title,
        description,
        count: 0,
        severity,
      } satisfies AccessRiskBucket);

    current.count += 1;
    current.severity = pickMoreSevereAlert(current.severity, severity);
    buckets.set(bucketKey, current);
  }

  return Array.from(buckets.values()).map((bucket) => ({
    source: "access_risk",
    scope: bucket.scope,
    scopeId: bucket.scopeId,
    tenantId: bucket.tenantId,
    caseId: bucket.caseId,
    count: bucket.count,
    rejectionCount: bucket.count,
    countLabel: "señales",
    severity: bucket.severity,
    title: bucket.title,
    description:
      bucket.count > 1
        ? `${bucket.description} Esta señal se repitió ${bucket.count} veces en la ventana visible.`
        : bucket.description,
  }));
}

export function buildAuditExecutiveAlerts(items: AuditFeedItem[]) {
  const alerts = [...buildGuardrailExecutiveAlerts(items), ...buildAccessRiskExecutiveAlerts(items)];
  const severityOrder = { high: 0, medium: 1, normal: 2 } satisfies Record<Exclude<AuditEventSeverity, "all">, number>;

  return alerts.sort((left, right) => {
    if (severityOrder[left.severity] !== severityOrder[right.severity]) {
      return severityOrder[left.severity] - severityOrder[right.severity];
    }
    return right.count - left.count;
  });
}

export function getAuditDrilldownDescriptor(item: AuditFeedItem): AuditDrilldownDescriptor {
  if (item.documentId || item.entityType === "document" || item.action.startsWith("document.")) {
    return {
      path: "/ceo/documentos",
      label: item.documentId ? "Ver documento relacionado" : "Ver flujo documental",
      helper: item.documentId ? `Documento ${item.documentId}` : "Abrir la vista documental filtrada",
    };
  }

  if (item.entityType === "access" || item.action.startsWith("access.")) {
    return {
      path: "/ceo/accesos",
      label: item.caseId ? "Ver acceso del caso" : "Ver accesos relacionados",
      helper: item.caseId ? `Caso ${item.caseId}` : "Abrir la vista de accesos filtrada",
    };
  }

  if (item.entityType === "alert" || item.action.startsWith("alert.")) {
    return {
      path: "/ceo/alertas",
      label: item.caseId ? "Ver alerta del caso" : "Ver alertas relacionadas",
      helper: item.caseId ? `Caso ${item.caseId}` : "Abrir la vista de alertas filtrada",
    };
  }

  return {
    path: "/ceo",
    label: item.caseId ? "Abrir caso relacionado" : "Abrir contexto del tenant",
    helper: item.caseId ? `Caso ${item.caseId}` : `Tenant ${item.tenantId}`,
  };
}

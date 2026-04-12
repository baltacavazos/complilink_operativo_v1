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
};

export type AuditEventFamily = "all" | "guardrail" | "document" | "access" | "policy" | "alert" | "case" | "dashboard" | "other";
export type AuditEventSeverity = "all" | "high" | "medium" | "normal";
export type AuditOperationalScope = "all" | "downloads" | "exports";
export type AuditOperationalOutcome = "all" | "success" | "denied" | "emailed";

export type AuditExecutiveAlert = {
  source: "guardrail" | "access_risk";
  scope: "tenant" | "case";
  scopeId: string;
  tenantId: string;
  caseId: string | null;
  count: number;
  countLabel: string;
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

export function buildAuditMonitoringSummary(items: AuditFeedItem[]): AuditMonitoringSummary {
  const previewAnalyzedEvents = items.filter((item) => item.action === "document.preview_analyzed");
  const previewConfirmedEvents = items.filter((item) => item.action === "document.preview_confirmed");
  const documentUploadEvents = items.filter((item) => item.action === "document.upload");

  let cameraCaptureSelections = 0;
  let fileCaptureSelections = 0;

  for (const item of previewAnalyzedEvents) {
    const captureMode = getCaptureModeFromItem(item);
    if (captureMode === "camera") cameraCaptureSelections += 1;
    if (captureMode === "file") fileCaptureSelections += 1;
  }

  const previewToConfirmationSamples = previewConfirmedEvents
    .map((item) => getPreviewToConfirmationSeconds(item))
    .filter((value): value is number => value !== null);

  const averagePreviewToConfirmationSeconds =
    previewToConfirmationSamples.length > 0
      ? Math.round(previewToConfirmationSamples.reduce((total, value) => total + value, 0) / previewToConfirmationSamples.length)
      : null;

  return {
    totalEvents: items.length,
    guardrailRejections: items.filter((item) => item.action === "document.guardrail_rejected").length,
    documentEvents: items.filter((item) => item.entityType === "document").length,
    accessEvents: items.filter((item) => item.entityType === "access").length,
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

export function isAuditDownloadOrExport(item: AuditFeedItem) {
  return item.action === "document.access" || item.action === "document.access_denied" || item.action === "dashboard.ceo.export_generated" || item.action === "dashboard.ceo.export_emailed";
}

export function getAuditOperationalScope(item: AuditFeedItem): Exclude<AuditOperationalScope, "all"> | null {
  if (item.action === "document.access" || item.action === "document.access_denied") return "downloads";
  if (item.action === "dashboard.ceo.export_generated" || item.action === "dashboard.ceo.export_emailed") return "exports";
  return null;
}

export function getAuditOperationalScopeLabel(scope: AuditOperationalScope) {
  if (scope === "all") return "Todo el flujo";
  if (scope === "downloads") return "Descargas";
  return "Exportaciones";
}

export function getAuditOperationalOutcome(item: AuditFeedItem): Exclude<AuditOperationalOutcome, "all"> | null {
  if (item.action === "document.access") return "success";
  if (item.action === "document.access_denied") return "denied";
  if (item.action === "dashboard.ceo.export_generated") return "success";
  if (item.action === "dashboard.ceo.export_emailed") return "emailed";
  return null;
}

export function getAuditOperationalOutcomeLabel(outcome: AuditOperationalOutcome) {
  if (outcome === "all") return "Todos los resultados";
  if (outcome === "success") return "Correctos";
  if (outcome === "denied") return "Denegados";
  return "Enviados por correo";
}

export function filterAuditOperationalFeed(
  items: AuditFeedItem[],
  selection: {
    scope: AuditOperationalScope;
    outcome: AuditOperationalOutcome;
    actorUserId?: number | null;
  },
) {
  return items.filter((item) => {
    if (!isAuditDownloadOrExport(item)) return false;
    if (selection.scope !== "all" && getAuditOperationalScope(item) !== selection.scope) return false;
    if (selection.outcome !== "all" && getAuditOperationalOutcome(item) !== selection.outcome) return false;
    if (selection.actorUserId && item.actorUserId !== selection.actorUserId) return false;
    return true;
  });
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

function normalizeAnomalySeverity(value: unknown): Exclude<AuditEventSeverity, "all"> {
  if (value === "critical") return "high";
  if (value === "warning") return "medium";
  return "normal";
}

export function buildAuditExecutiveAlerts(items: AuditFeedItem[]) {
  const guardrailRejections = items.filter((item) => item.action === "document.guardrail_rejected");
  const anomalySignals = items.filter((item) => item.action === "access.anomaly_detected");
  const byTenant = new Map<string, { tenantId: string; count: number }>();
  const byCase = new Map<string, { tenantId: string; caseId: string; count: number }>();
  const anomalyBuckets = new Map<
    string,
    {
      scope: "tenant" | "case";
      scopeId: string;
      tenantId: string;
      caseId: string | null;
      count: number;
      severity: Exclude<AuditEventSeverity, "all">;
      title: string;
      description: string;
    }
  >();

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

  for (const item of anomalySignals) {
    const state = parseAuditState(item.afterState);
    const rawKind = typeof state?.kind === "string" && state.kind.trim().length > 0 ? state.kind.trim() : "access_anomaly";
    const scope = item.caseId ? "case" : "tenant";
    const scopeId = item.caseId ?? item.tenantId;
    const bucketKey = `${scope}:${scopeId}:${rawKind}`;
    const severity = normalizeAnomalySeverity(state?.severity);
    const title = typeof state?.title === "string" && state.title.trim().length > 0 ? state.title.trim() : "Anomalía de acceso detectada";
    const description =
      typeof state?.description === "string" && state.description.trim().length > 0
        ? state.description.trim()
        : "Se detectó una señal anómala en descargas o exportaciones auditadas.";

    const bucket =
      anomalyBuckets.get(bucketKey) ?? {
        scope,
        scopeId,
        tenantId: item.tenantId,
        caseId: item.caseId ?? null,
        count: 0,
        severity,
        title,
        description,
      };

    bucket.count += 1;
    if (severity === "high" || (severity === "medium" && bucket.severity === "normal")) {
      bucket.severity = severity;
    }
    bucket.title = title;
    bucket.description = description;
    anomalyBuckets.set(bucketKey, bucket);
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
      countLabel: tenant.count === 1 ? "rechazo" : "rechazos",
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
      countLabel: entry.count === 1 ? "rechazo" : "rechazos",
      severity,
      title: `Caso ${entry.caseId} con rechazos repetidos`,
      description:
        severity === "high"
          ? `El caso visible acumula ${entry.count} rechazos operativos recientes y ya presenta una fricción alta que merece intervención.`
          : `El caso visible suma ${entry.count} rechazos operativos recientes; conviene revisar el motivo antes de seguir operando.`,
    });
  }

  for (const anomaly of Array.from(anomalyBuckets.values())) {
    alerts.push({
      source: "access_risk",
      scope: anomaly.scope,
      scopeId: anomaly.scopeId,
      tenantId: anomaly.tenantId,
      caseId: anomaly.caseId,
      count: anomaly.count,
      countLabel: anomaly.count === 1 ? "señal" : "señales",
      severity: anomaly.severity,
      title: anomaly.title,
      description:
        anomaly.count > 1 ? `${anomaly.description} Esta señal se repitió ${anomaly.count} veces en la ventana visible.` : anomaly.description,
    });
  }

  return alerts.sort((left, right) => {
    const severityOrder = { high: 0, medium: 1, normal: 2 } satisfies Record<Exclude<AuditEventSeverity, "all">, number>;
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

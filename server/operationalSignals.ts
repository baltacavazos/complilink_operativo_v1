type RecordLike = Record<string, unknown>;

export const BRIDGE_CALLBACK_PENDING_GRACE_MS = 30 * 1000;
export const BRIDGE_CALLBACK_TIMEOUT_MS = 5 * 60 * 1000;
export const SALARY_DISCREPANCY_THRESHOLD_PERCENT = 5;
export const SALARY_DISCREPANCY_THRESHOLD_ABSOLUTE = 0.5;

export type SalarySignalSnapshot = {
  documentId: string;
  documentType: string | null;
  fileName: string | null;
  generatedAt: string | null;
  contractDailySalary: number | null;
  socialSecurityBaseSalary: number | null;
  integratedDailySalary: number | null;
};

export type SalaryDiscrepancySignal = {
  contract: SalarySignalSnapshot;
  payroll: SalarySignalSnapshot;
  comparedValue: number;
  comparedField: "integratedDailySalary" | "socialSecurityBaseSalary";
  absoluteDifference: number;
  percentageDifference: number;
};

export type DispatchAuditCandidate = {
  id?: number | string | null;
  documentId?: string | null;
  createdAt?: Date | string | null;
  afterState?: unknown;
};

export type WebhookEventCandidate = {
  id?: number | string | null;
  documentId?: string | null;
  correlationId?: string | null;
  createdAt?: Date | string | null;
};

export type DerivedBridgeAlert = {
  id: string;
  tenantId?: string | null;
  caseId?: string | null;
  traceId?: string | null;
  severity: "warning" | "critical";
  category: "upload_pending";
  title: string;
  description: string;
  status: "open";
  raisedAt: Date;
  updatedAt: Date;
  resolvedAt: null;
  source: "derived_bridge_monitor";
  metadata: {
    documentId: string | null;
    dispatchId: string | null;
    correlationId: string | null;
    dispatchedAt: string;
    timeoutAt: string;
    ageMs: number;
  };
};

function asRecord(value: unknown): RecordLike | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as RecordLike;
}

function parseJsonLike(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function getString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeNumberish(value: string) {
  return value.replace(/[^0-9.,-]/g, "").replace(/,(?=\d{3}(?:\D|$))/g, "");
}

function getNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const normalized = normalizeNumberish(value.trim());
  if (!normalized) return null;

  const hasDot = normalized.includes(".");
  const hasComma = normalized.includes(",");
  let candidate = normalized;

  if (hasComma && hasDot) {
    candidate = normalized.replace(/,/g, "");
  } else if (hasComma && !hasDot) {
    const commaCount = (normalized.match(/,/g) ?? []).length;
    candidate = commaCount === 1 ? normalized.replace(",", ".") : normalized.replace(/,/g, "");
  }

  const parsed = Number(candidate);
  return Number.isFinite(parsed) ? parsed : null;
}

function getDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

function getValueFromAnalysis(root: RecordLike | null, key: string) {
  const confirmed = asRecord(root?.confirmedData);
  const estimated = asRecord(root?.estimatedData);
  return confirmed?.[key] ?? estimated?.[key] ?? null;
}

export function extractSalarySignalFromClassificationPayload(payload: unknown): SalarySignalSnapshot | null {
  const root = asRecord(parseJsonLike(payload));
  if (!root) return null;

  const classification = asRecord(root.classification);
  const documentId = getString(root.documentId) ?? getString(root.document_id);
  if (!documentId) return null;

  return {
    documentId,
    documentType:
      getString(classification?.documentType) ??
      getString(getValueFromAnalysis(root, "internalDocumentType")) ??
      getString(getValueFromAnalysis(root, "normalizedDocType")),
    fileName: getString(getValueFromAnalysis(root, "fileName")),
    generatedAt: getString(root.generatedAt),
    contractDailySalary: getNumber(getValueFromAnalysis(root, "contractDailySalary")),
    socialSecurityBaseSalary: getNumber(getValueFromAnalysis(root, "socialSecurityBaseSalary")),
    integratedDailySalary: getNumber(getValueFromAnalysis(root, "integratedDailySalary")),
  };
}

export function buildSalaryDiscrepancySignal(params: {
  snapshots: SalarySignalSnapshot[];
  thresholdPercent?: number;
  thresholdAbsolute?: number;
}): SalaryDiscrepancySignal | null {
  const thresholdPercent = params.thresholdPercent ?? SALARY_DISCREPANCY_THRESHOLD_PERCENT;
  const thresholdAbsolute = params.thresholdAbsolute ?? SALARY_DISCREPANCY_THRESHOLD_ABSOLUTE;
  const latestContract = params.snapshots.find(
    (snapshot) => snapshot.contractDailySalary !== null && snapshot.contractDailySalary > 0,
  );
  const latestPayroll = params.snapshots.find(
    (snapshot) =>
      (snapshot.integratedDailySalary !== null && snapshot.integratedDailySalary > 0) ||
      (snapshot.socialSecurityBaseSalary !== null && snapshot.socialSecurityBaseSalary > 0),
  );

  if (!latestContract || !latestPayroll || latestContract.documentId === latestPayroll.documentId) {
    return null;
  }

  const comparedField = latestPayroll.integratedDailySalary !== null ? "integratedDailySalary" : "socialSecurityBaseSalary";
  const comparedValue = latestPayroll[comparedField];
  if (comparedValue === null || latestContract.contractDailySalary === null || latestContract.contractDailySalary <= 0) {
    return null;
  }

  const absoluteDifference = Number(Math.abs(comparedValue - latestContract.contractDailySalary).toFixed(2));
  const percentageDifference = Number(((absoluteDifference / latestContract.contractDailySalary) * 100).toFixed(2));

  if (absoluteDifference < thresholdAbsolute || percentageDifference < thresholdPercent) {
    return null;
  }

  return {
    contract: latestContract,
    payroll: latestPayroll,
    comparedValue,
    comparedField,
    absoluteDifference,
    percentageDifference,
  };
}

function parseDispatchEnvelope(candidate: DispatchAuditCandidate) {
  const root = asRecord(parseJsonLike(candidate.afterState));
  if (!root) return null;

  const observability = asRecord(root.observabilityEnvelope);
  const status = getString(root.status);
  const httpStatus = getNumber(root.httpStatus) ?? getNumber(observability?.httpStatusCode);
  const dispatchedAt = getDate(root.dispatchedAt) ?? getDate(candidate.createdAt);
  const documentId = getString(candidate.documentId) ?? getString(root.documentId);
  const correlationId = getString(observability?.correlationId) ?? getString(root.correlationId);
  const dispatchId = getString(observability?.dispatchId) ?? getString(root.dispatchId);

  if (!dispatchedAt || status !== "sent" || httpStatus !== 202 || !documentId) {
    return null;
  }

  return {
    documentId,
    dispatchedAt,
    correlationId,
    dispatchId,
  };
}

export function deriveBridgeCallbackAlerts(params: {
  dispatchAuditLogs: DispatchAuditCandidate[];
  webhookEvents: WebhookEventCandidate[];
  tenantId?: string | null;
  caseId?: string | null;
  traceId?: string | null;
  now?: Date;
  pendingGraceMs?: number;
  timeoutMs?: number;
}): DerivedBridgeAlert[] {
  const now = params.now ?? new Date();
  const pendingGraceMs = params.pendingGraceMs ?? BRIDGE_CALLBACK_PENDING_GRACE_MS;
  const timeoutMs = params.timeoutMs ?? BRIDGE_CALLBACK_TIMEOUT_MS;
  const alertsByKey = new Map<string, DerivedBridgeAlert>();

  for (const dispatchAudit of params.dispatchAuditLogs) {
    const dispatch = parseDispatchEnvelope(dispatchAudit);
    if (!dispatch) continue;

    const hasMatchingWebhook = params.webhookEvents.some((event) => {
      const eventCreatedAt = getDate(event.createdAt);
      const sameCorrelation = Boolean(dispatch.correlationId) && event.correlationId === dispatch.correlationId;
      const sameDocument = event.documentId === dispatch.documentId;
      return (sameCorrelation || sameDocument) && (!eventCreatedAt || eventCreatedAt >= dispatch.dispatchedAt);
    });

    if (hasMatchingWebhook) continue;

    const ageMs = now.getTime() - dispatch.dispatchedAt.getTime();
    if (ageMs < pendingGraceMs) continue;

    const timedOut = ageMs >= timeoutMs;
    const timeoutAt = new Date(dispatch.dispatchedAt.getTime() + timeoutMs);
    const key = dispatch.correlationId ?? dispatch.documentId;

    alertsByKey.set(key, {
      id: `derived-bridge-${key}`,
      tenantId: params.tenantId ?? null,
      caseId: params.caseId ?? null,
      traceId: params.traceId ?? null,
      severity: timedOut ? "critical" : "warning",
      category: "upload_pending",
      title: timedOut ? "Callback de CompliLink fuera de ventana" : "Callback de CompliLink pendiente",
      description: timedOut
        ? `El documento ${dispatch.documentId} fue aceptado por el bridge el ${dispatch.dispatchedAt.toISOString()}, pero no existe callback correlacionado dentro de la ventana de ${Math.round(timeoutMs / 60000)} minutos.`
        : `El documento ${dispatch.documentId} ya fue aceptado por el bridge el ${dispatch.dispatchedAt.toISOString()} y seguimos esperando el callback asíncrono de CompliLink.`,
      status: "open",
      raisedAt: dispatch.dispatchedAt,
      updatedAt: now,
      resolvedAt: null,
      source: "derived_bridge_monitor",
      metadata: {
        documentId: dispatch.documentId,
        dispatchId: dispatch.dispatchId,
        correlationId: dispatch.correlationId,
        dispatchedAt: dispatch.dispatchedAt.toISOString(),
        timeoutAt: timeoutAt.toISOString(),
        ageMs,
      },
    });
  }

  return Array.from(alertsByKey.values()).sort((a, b) => b.raisedAt.getTime() - a.raisedAt.getTime());
}

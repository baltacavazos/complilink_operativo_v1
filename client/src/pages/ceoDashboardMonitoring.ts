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
};

function uniqueCount(values: Array<string | null | undefined>) {
  return new Set(values.filter((value): value is string => Boolean(value))).size;
}

export function buildAuditMonitoringSummary(items: AuditFeedItem[]): AuditMonitoringSummary {
  return {
    totalEvents: items.length,
    guardrailRejections: items.filter((item) => item.action === "document.guardrail_rejected").length,
    documentEvents: items.filter((item) => item.entityType === "document").length,
    accessEvents: items.filter((item) => item.entityType === "access").length,
    policyEvents: items.filter((item) => item.entityType === "policy").length,
    distinctCases: uniqueCount(items.map((item) => item.caseId)),
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
  if (!item.afterState || typeof item.afterState !== "object") return null;
  const reason = (item.afterState as { reason?: unknown }).reason;
  return typeof reason === "string" && reason.length > 0 ? reason : null;
}

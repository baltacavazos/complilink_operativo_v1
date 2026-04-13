import type { AuditEventFamily, AuditEventSeverity } from "@/pages/ceoDashboardMonitoring";

const AUDIT_EVENT_FAMILY_VALUES: AuditEventFamily[] = ["all", "guardrail", "document", "access", "policy", "alert", "case", "dashboard", "other"];
const AUDIT_EVENT_SEVERITY_VALUES: AuditEventSeverity[] = ["all", "high", "medium", "normal"];

function parseAuditEventFamily(value: string | null | undefined): AuditEventFamily {
  return AUDIT_EVENT_FAMILY_VALUES.includes(value as AuditEventFamily) ? (value as AuditEventFamily) : "all";
}

function parseAuditEventSeverity(value: string | null | undefined): AuditEventSeverity {
  return AUDIT_EVENT_SEVERITY_VALUES.includes(value as AuditEventSeverity) ? (value as AuditEventSeverity) : "all";
}

export type LegalGateNavigationContext = {
  tenantId: string;
  caseId: string | null;
  scopeId: string;
  target: "feed" | "documents";
  family: AuditEventFamily;
  severity: AuditEventSeverity;
};

export function buildLegalGateContextPath(
  targetPath: "/ceo" | "/ceo/documentos",
  item: { tenantId: string; caseId: string | null; scopeId: string },
  filters?: { family: AuditEventFamily; severity: AuditEventSeverity },
) {
  const params = new URLSearchParams({
    legalTenantId: item.tenantId,
    legalScopeId: item.scopeId,
    legalTarget: targetPath === "/ceo" ? "feed" : "documents",
    legalAuditFamily: filters?.family ?? "all",
    legalAuditSeverity: filters?.severity ?? "all",
  });

  if (item.caseId) {
    params.set("legalCaseId", item.caseId);
  }

  return `${targetPath}?${params.toString()}`;
}

export function parseLegalGateNavigationContext(location: string): LegalGateNavigationContext | null {
  const [, rawQuery = ""] = location.split("?");
  const params = new URLSearchParams(rawQuery);
  const tenantId = params.get("legalTenantId");
  const scopeId = params.get("legalScopeId");
  const target = params.get("legalTarget");

  if (!tenantId || !scopeId || (target !== "feed" && target !== "documents")) {
    return null;
  }

  return {
    tenantId,
    caseId: params.get("legalCaseId"),
    scopeId,
    target,
    family: parseAuditEventFamily(params.get("legalAuditFamily")),
    severity: parseAuditEventSeverity(params.get("legalAuditSeverity")),
  };
}

export function buildLegalGateContextSummary(context: LegalGateNavigationContext) {
  const parts = [
    `Tenant ${context.tenantId}`,
    context.caseId ? `Caso ${context.caseId}` : `Scope ${context.scopeId}`,
  ];

  if (context.family !== "all") {
    parts.push(`Familia ${context.family}`);
  }

  if (context.severity !== "all") {
    parts.push(`Severidad ${context.severity}`);
  }

  return parts.join(" · ");
}

import { describe, expect, it } from "vitest";

import {
  buildLegalGateContextPath,
  buildLegalGateContextSummary,
  parseLegalGateNavigationContext,
} from "@/pages/ceoDashboardContext";

describe("ceoDashboardContext", () => {
  it("preserva tenant, caso, familia y severidad en el roundtrip del contexto legal", () => {
    const path = buildLegalGateContextPath(
      "/ceo/documentos",
      {
        tenantId: "tenant-demo",
        caseId: "CASE-42",
        scopeId: "scope-7",
      },
      {
        family: "guardrail",
        severity: "high",
      },
    );

    expect(path).toContain("legalTenantId=tenant-demo");
    expect(path).toContain("legalCaseId=CASE-42");
    expect(path).toContain("legalAuditFamily=guardrail");
    expect(path).toContain("legalAuditSeverity=high");

    expect(parseLegalGateNavigationContext(path)).toEqual({
      tenantId: "tenant-demo",
      caseId: "CASE-42",
      scopeId: "scope-7",
      target: "documents",
      family: "guardrail",
      severity: "high",
    });
  });

  it("resume el contexto activo sin perder los filtros visibles", () => {
    const summary = buildLegalGateContextSummary({
      tenantId: "tenant-demo",
      caseId: "CASE-42",
      scopeId: "scope-7",
      target: "feed",
      family: "guardrail",
      severity: "high",
    });

    expect(summary).toBe("Tenant tenant-demo · Caso CASE-42 · Familia guardrail · Severidad high");
  });
});

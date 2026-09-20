import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { buildCaseId, buildPersonalCaseId, buildTenantId } from "./db";
import { isDuplicateKeyError } from "./userFacingDatabaseError";

const dbSource = readFileSync(resolve(process.cwd(), "server/db.ts"), "utf8");
const routersSource = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");
const auditarSource = readFileSync(resolve(process.cwd(), "client/src/pages/Auditar.tsx"), "utf8");

describe("workspace bootstrap para cuentas smoke", () => {
  it("el caseId personal no colisiona cuando dos tenants comparten prefijo", () => {
    const leftTenant = buildTenantId("smoke tester", "12");
    const rightTenant = buildTenantId("smoke user", "45");
    expect(leftTenant.slice(0, 6)).toBe(rightTenant.slice(0, 6));
    expect(buildCaseId(leftTenant, "demo001")).toBe(buildCaseId(rightTenant, "demo001"));
    expect(buildPersonalCaseId(12)).toBe("CASE-U12");
    expect(buildPersonalCaseId(45)).toBe("CASE-U45");
    expect(buildPersonalCaseId(12)).not.toBe(buildPersonalCaseId(45));
  });

  it("reutiliza tenant y expediente en vez de fallar por Duplicate entry", () => {
    expect(dbSource).toContain("isDuplicateKeyError");
    expect(dbSource).toContain("buildPersonalCaseId(userId)");
    expect(dbSource).not.toContain('buildCaseId(tenantId, "demo001")');
    expect(dbSource).toContain("No pudimos preparar tu espacio de revisión.");
    expect(dbSource).toContain("[workspace.bootstrap]");
    expect(routersSource).toContain("logActionableDatabaseFailure(\"workspace.bootstrap\"");
    expect(routersSource).toContain("caseId: workspace.caseId");
    expect(auditarSource).toContain("result.caseId");
    expect(auditarSource).toContain("result.tenant?.tenantId");
  });

  it("abre el asesor desde /asesor y /chat sin 404", () => {
    const appSource = readFileSync(resolve(process.cwd(), "client/src/App.tsx"), "utf8");
    expect(appSource).toContain('path={"/asesor"}');
    expect(appSource).toContain('path={"/asesor-laboral"}');
    expect(appSource).toContain('path={"/chat"}');
    expect(appSource).toContain('setLocation("/auditar?chat=1")');
    expect(auditarSource).toContain('params.get("chat") === "1"');
    expect(auditarSource).toContain("employerEntity={caseDetailQuery.data?.case.employerEntity}");
  });

  it("el chat del trabajador usa voz de abogado del caso, no el marco CEO", () => {
    expect(routersSource).toContain("WORKER_ADVISOR_VOICE_NOTE");
    expect(routersSource).toContain("workerName: detail.case.employeeName");
    expect(routersSource).toContain("employerName: detail.case.employerEntity");
    const workerChatSlice = routersSource.slice(
      routersSource.indexOf("heliosCopilotChat:"),
      routersSource.indexOf("heliosCopilotChat:") + 8000,
    );
    expect(workerChatSlice).toContain("WORKER_ADVISOR_VOICE_NOTE");
    expect(routersSource).toContain("durableMemory");
    expect(routersSource).toContain("getAdvisorMemoryForUser");
    expect(routersSource).toContain("summarizeAdvisorCaseMemory");
    expect(workerChatSlice).not.toContain("ADVISOR_CONTEXT_NOTE");
    expect(workerChatSlice).not.toContain("Cavazos");
  });

  it("detecta el error de llave duplicada de MySQL", () => {
    const error = Object.assign(new Error("Duplicate entry 'CASE-SMOKE--DEMO001' for key 'labor_cases_case_id_uq'"), {
      code: "ER_DUP_ENTRY",
    });
    expect(isDuplicateKeyError(error)).toBe(true);
    expect(isDuplicateKeyError(new Error("otra cosa"))).toBe(false);
  });
});

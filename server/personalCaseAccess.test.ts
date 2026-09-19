import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dbSource = readFileSync(resolve(process.cwd(), "server/db.ts"), "utf8");
const routersSource = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");

describe("acceso de expediente para cuentas nuevas", () => {
  it("repara membresía y case_access del expediente personal", () => {
    expect(dbSource).toContain("export async function repairPersonalCaseAccess");
    expect(dbSource).toContain("export async function ensurePersonalWorkspaceForUser");
    expect(dbSource).toContain("export async function getPrimaryCaseIdForUser");
    expect(dbSource).toContain('role: "tenant_admin"');
    expect(dbSource).toContain('accessLevel: "owner"');
    expect(dbSource).toContain("await grantCaseAccess(");
  });

  it("el chat del asesor usa el expediente personal de la cuenta nueva", () => {
    expect(routersSource).toContain("ensurePersonalWorkspaceForUser");
    expect(routersSource).toContain("heliosCopilotChat");
    expect(routersSource).toContain('throw new Error("Esta consulta necesita tu expediente abierto.")');
    expect(routersSource).not.toMatch(/workspace.caseId \? workspace.caseId : input.caseId/);
    expect(routersSource).toContain("getPrimaryCaseIdForUser");
  });

  it("repara membresía y crea expediente personal si falta case_access", () => {
    expect(dbSource).toContain("allowCreate");
    expect(dbSource).toContain("createBarePersonalCase");
    expect(dbSource).toContain("isNull(laborCases.assignedUserId)");
    expect(dbSource).toContain('throw new Error("Esta consulta necesita tu expediente abierto.")');
    expect(dbSource).not.toContain('throw new Error("No tienes acceso a este espacio.")');
  });

  it("un segundo create no abre otro expediente personal", () => {
    expect(routersSource).toContain("const existingCaseId = await getPrimaryCaseIdForUser");
    expect(routersSource).toContain("return existing.case;");
  });
});

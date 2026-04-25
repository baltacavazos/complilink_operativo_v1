import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("V1 release scope safeguards", () => {
  const homeSource = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");
  const accessSource = readFileSync(resolve(process.cwd(), "client/src/pages/Access.tsx"), "utf8");
  const appSource = readFileSync(resolve(process.cwd(), "client/src/App.tsx"), "utf8");
  const ceoSource = readFileSync(resolve(process.cwd(), "client/src/pages/CeoDashboard.tsx"), "utf8");

  it("keeps the public home focused on the worker flow and routes secondary entry to /acceso", () => {
    expect(homeSource).toContain('window.location.href = "/acceso?returnTo=/auditar"');
    expect(homeSource).toContain("Entrar");
    expect(homeSource).not.toContain("Consola CEO");
  });

  it("preserves the critical public routes for V1 and keeps CEO routes explicit in the router", () => {
    expect(appSource).toContain('Route path={"/"} component={Home}');
    expect(appSource).toContain('Route path={"/acceso"} component={Access}');
    expect(appSource).toContain('Route path={"/auditar"} component={Auditar}');
    expect(appSource).toContain('Route path={"/ceo"} component={CeoDashboard}');
  });

  it("keeps the email access experience ready for returning users, cooldowns and friendly verification errors", () => {
    expect(accessSource).toContain("Entrar con correo");
    expect(accessSource).toContain("Te reconocimos en este equipo");
    expect(accessSource).toContain("Espera un momento antes de pedir otro código.");
    expect(accessSource).toContain("Código incorrecto. Revisa tu correo e inténtalo otra vez.");
    expect(accessSource).toContain("window.location.replace(returnTo)");
  });

  it("leaves the CEO console behind authentication and admin-only messaging", () => {
    expect(ceoSource).toContain('useAuth({ redirectOnUnauthenticated: true, redirectPath: "/ceo" })');
    expect(ceoSource).toContain('const isAdmin = user?.role === "admin";');
    expect(ceoSource).toContain("Acceso restringido");
    expect(ceoSource).toContain("Este expediente privado sólo está disponible para el owner autorizado.");
  });
});

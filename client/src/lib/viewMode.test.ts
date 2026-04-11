import {
  canToggleUserView,
  getEffectiveRole,
  isCeoRoute,
  isViewingAsUser,
  shouldRedirectDemoUserFromCeo,
} from "./viewMode";
import { describe, expect, it } from "vitest";

describe("viewMode helpers", () => {
  it("permite activar la vista demo sólo al rol admin", () => {
    expect(canToggleUserView({ role: "admin" })).toBe(true);
    expect(canToggleUserView({ role: "user" })).toBe(false);
    expect(canToggleUserView(null)).toBe(false);
  });

  it("convierte temporalmente al CEO en usuario normal sin alterar otros roles", () => {
    expect(getEffectiveRole({ role: "admin" }, "native")).toBe("admin");
    expect(getEffectiveRole({ role: "admin" }, "demo-user")).toBe("user");
    expect(getEffectiveRole({ role: "user" }, "demo-user")).toBe("user");
  });

  it("detecta correctamente cuándo se está navegando como usuario normal", () => {
    expect(isViewingAsUser({ role: "admin" }, "demo-user")).toBe(true);
    expect(isViewingAsUser({ role: "admin" }, "native")).toBe(false);
    expect(isViewingAsUser({ role: "user" }, "demo-user")).toBe(false);
  });

  it("reconoce las rutas CEO que deben cerrarse durante una demo", () => {
    expect(isCeoRoute("/ceo")).toBe(true);
    expect(isCeoRoute("/ceo/documentos")).toBe(true);
    expect(isCeoRoute("/auditar")).toBe(false);
  });

  it("redirige fuera de la consola CEO sólo cuando el admin está en modo demo", () => {
    expect(shouldRedirectDemoUserFromCeo("/ceo", { role: "admin" }, "demo-user")).toBe(true);
    expect(shouldRedirectDemoUserFromCeo("/ceo/alertas", { role: "admin" }, "demo-user")).toBe(true);
    expect(shouldRedirectDemoUserFromCeo("/ceo", { role: "admin" }, "native")).toBe(false);
    expect(shouldRedirectDemoUserFromCeo("/ceo", { role: "user" }, "demo-user")).toBe(false);
    expect(shouldRedirectDemoUserFromCeo("/auditar", { role: "admin" }, "demo-user")).toBe(false);
  });
});

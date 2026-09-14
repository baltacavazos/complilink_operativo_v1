import {
  VIEW_MODE_SESSION_KEY,
  VIEW_MODE_SESSION_KEY_LEGACY,
  canToggleUserView,
  getEffectiveRole,
  isCeoRoute,
  isViewingAsUser,
  readPersistedViewMode,
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

  it("migra la clave legacy a auditapatron-view-mode una sola vez", () => {
    const store = new Map<string, string>();
    store.set(VIEW_MODE_SESSION_KEY_LEGACY, "demo-user");

    const mode = readPersistedViewMode({
      getItem: (key) => store.get(key) ?? null,
      setItem: (key, value) => {
        store.set(key, value);
      },
      removeItem: (key) => {
        store.delete(key);
      },
    });

    expect(mode).toBe("demo-user");
    expect(store.get(VIEW_MODE_SESSION_KEY)).toBe("demo-user");
    expect(store.has(VIEW_MODE_SESSION_KEY_LEGACY)).toBe(false);
  });

  it("prefiere la clave nueva si ambas existen", () => {
    const store = new Map<string, string>([
      [VIEW_MODE_SESSION_KEY, "native"],
      [VIEW_MODE_SESSION_KEY_LEGACY, "demo-user"],
    ]);

    const mode = readPersistedViewMode({
      getItem: (key) => store.get(key) ?? null,
      setItem: (key, value) => {
        store.set(key, value);
      },
      removeItem: (key) => {
        store.delete(key);
      },
    });

    expect(mode).toBe("native");
    expect(store.get(VIEW_MODE_SESSION_KEY_LEGACY)).toBe("demo-user");
  });
});

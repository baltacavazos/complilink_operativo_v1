import { describe, expect, it } from "vitest";
import {
  buildAbsolutePublicUrl,
  getApiBaseUrl,
  getAppPathFromUrl,
} from "./nativeRuntime";

describe("native runtime helpers", () => {
  it("extrae la ruta interna desde enlaces del dominio público", () => {
    expect(getAppPathFromUrl("https://auditapatron.com/auditar?from=mobile#top")).toBe(
      "/auditar?from=mobile#top",
    );
    expect(getAppPathFromUrl("https://www.auditapatron.com/acceso?returnTo=%2Fauditar")).toBe(
      "/acceso?returnTo=%2Fauditar",
    );
  });

  it("acepta el esquema nativo planeado para retornos futuros con doble o triple slash", () => {
    expect(getAppPathFromUrl("auditapatron:///auditar?from=oauth")).toBe(
      "/auditar?from=oauth",
    );
    expect(getAppPathFromUrl("auditapatron://acceso?returnTo=%2Fauditar")).toBe(
      "/acceso?returnTo=%2Fauditar",
    );
  });

  it("convierte callbacks OAuth del backend en rutas internas seguras", () => {
    expect(
      getAppPathFromUrl(
        "https://auditapatron.com/api/auth/google/callback?returnTo=%2Fauditar%3Ffrom%3Dgoogle",
      ),
    ).toBe("/auditar?from=google");

    expect(
      getAppPathFromUrl(
        "https://auditapatron.com/api/oauth/callback?error=manus_callback_failed&returnTo=%2Fauditar",
      ),
    ).toBe("/acceso?error=manus_callback_failed&returnTo=%2Fauditar");
  });

  it("ignora URLs ajenas a la app", () => {
    expect(getAppPathFromUrl("https://example.com/auditar")).toBeNull();
    expect(getAppPathFromUrl(null)).toBeNull();
  });

  it("construye URLs absolutas contra el origen web público", () => {
    expect(buildAbsolutePublicUrl("/api/trpc")).toBe("https://auditapatron.com/api/trpc");
    expect(getApiBaseUrl()).toBe("https://auditapatron.com/api/trpc");
  });
});

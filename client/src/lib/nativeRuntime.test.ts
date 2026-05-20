import { describe, expect, it } from "vitest";
import { buildAbsolutePublicUrl, getAppPathFromUrl } from "./nativeRuntime";

describe("native runtime helpers", () => {
  it("extrae la ruta interna desde enlaces del dominio público", () => {
    expect(getAppPathFromUrl("https://auditapatron.com/auditar?from=mobile#top")).toBe(
      "/auditar?from=mobile#top",
    );
    expect(getAppPathFromUrl("https://www.auditapatron.com/acceso?returnTo=%2Fauditar")).toBe(
      "/acceso?returnTo=%2Fauditar",
    );
  });

  it("acepta el esquema nativo planeado para retornos futuros", () => {
    expect(getAppPathFromUrl("auditapatron:///auditar?from=oauth")).toBe("/auditar?from=oauth");
    expect(getAppPathFromUrl("auditapatron:///acceso?returnTo=%2Fauditar")).toBe(
      "/acceso?returnTo=%2Fauditar",
    );
  });

  it("ignora URLs ajenas a la app", () => {
    expect(getAppPathFromUrl("https://example.com/auditar")).toBeNull();
    expect(getAppPathFromUrl(null)).toBeNull();
  });

  it("construye URLs absolutas contra el origen web público", () => {
    expect(buildAbsolutePublicUrl("/api/trpc")).toBe("https://auditapatron.com/api/trpc");
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";

async function loadConstModule(nativeApp: boolean) {
  vi.resetModules();
  vi.doMock("@/lib/nativeRuntime", () => ({
    getPublicWebOrigin: () => "https://auditapatron.com",
    isNativeApp: () => nativeApp,
  }));

  return import("./const");
}

describe("getGoogleLoginUrl", () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock("@/lib/nativeRuntime");
  });

  it("mantiene la URL relativa en web", async () => {
    const { getGoogleLoginUrl } = await loadConstModule(false);

    expect(getGoogleLoginUrl("/auditar?from=web")).toBe(
      "/api/auth/google/start?returnTo=%2Fauditar%3Ffrom%3Dweb",
    );
  });

  it("construye una URL absoluta con bandera nativa cuando corre dentro de la app", async () => {
    const { getGoogleLoginUrl } = await loadConstModule(true);

    expect(getGoogleLoginUrl("/auditar?from=mobile")).toBe(
      "https://auditapatron.com/api/auth/google/start?returnTo=%2Fauditar%3Ffrom%3Dmobile&native=1",
    );
  });
});

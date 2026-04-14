import { describe, expect, it } from "vitest";

import { buildManusLoginUrl, isHostedManusDomain } from "./const";

describe("const auth helpers", () => {
  it("acepta dominios hospedados por Manus y rechaza dominios personalizados", () => {
    expect(isHostedManusDomain("localhost")).toBe(true);
    expect(isHostedManusDomain("demo.manus.space")).toBe(true);
    expect(isHostedManusDomain("preview.manus.computer")).toBe(true);
    expect(isHostedManusDomain("auditapatron.com")).toBe(false);
    expect(isHostedManusDomain("www.auditapatron.com")).toBe(false);
  });

  it("construye la URL de login con ambos nombres de redirect URI y conserva la ruta destino", () => {
    const loginUrl = buildManusLoginUrl({
      origin: "https://demo.manus.space",
      hostname: "demo.manus.space",
      oauthPortalUrl: "https://manus.im",
      appId: "test-app-id",
      returnPath: "/auditar",
    });

    expect(loginUrl).not.toBeNull();

    const parsed = new URL(loginUrl!);
    expect(parsed.searchParams.get("redirectUri")).toBe("https://demo.manus.space/api/oauth/callback?returnTo=%2Fauditar");
    expect(parsed.searchParams.get("redirect_uri")).toBe("https://demo.manus.space/api/oauth/callback?returnTo=%2Fauditar");
    expect(parsed.searchParams.get("type")).toBe("signIn");
    expect(parsed.searchParams.get("state")).toBeTruthy();
  });

  it("desactiva el acceso con Manus en dominios personalizados para evitar rebotes rotos", () => {
    const loginUrl = buildManusLoginUrl({
      origin: "https://auditapatron.com",
      hostname: "auditapatron.com",
      oauthPortalUrl: "https://manus.im",
      appId: "test-app-id",
      returnPath: "/auditar",
    });

    expect(loginUrl).toBeNull();
  });
});

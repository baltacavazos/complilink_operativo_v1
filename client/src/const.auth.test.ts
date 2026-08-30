import { describe, expect, it } from "vitest";

import { buildManusLoginUrl, buildManusSignupUrl, isHostedManusDomain } from "./const";

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
    expect(parsed.searchParams.get("locale")).toBe("es");
    expect(parsed.searchParams.get("state")).toBeTruthy();
  });

  it("construye la URL de alta en el dominio público con signUp y retorno al panel", () => {
    const signupUrl = buildManusSignupUrl({
      origin: "https://auditapatron.com",
      hostname: "auditapatron.com",
      oauthPortalUrl: "https://manus.im",
      appId: "test-app-id",
      returnPath: "/auditar",
    });

    expect(signupUrl).not.toBeNull();

    const parsed = new URL(signupUrl!);
    expect(parsed.pathname).toBe("/app-auth");
    expect(parsed.searchParams.get("type")).toBe("signUp");
    expect(parsed.searchParams.get("locale")).toBe("es");
    expect(parsed.searchParams.get("redirectUri")).toBe("https://auditapatron.com/api/oauth/callback?returnTo=%2Fauditar");
  });

  it("mantiene signIn disponible en dominios personalizados", () => {
    const loginUrl = buildManusLoginUrl({
      origin: "https://auditapatron.com",
      hostname: "auditapatron.com",
      oauthPortalUrl: "https://manus.im",
      appId: "test-app-id",
      returnPath: "/auditar",
    });

    expect(loginUrl).not.toBeNull();
    expect(new URL(loginUrl!).searchParams.get("type")).toBe("signIn");
  });
});

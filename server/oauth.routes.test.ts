import type { Express, Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authServiceMocks = vi.hoisted(() => ({
  buildGoogleAuthorizationUrl: vi.fn(),
  completeGoogleLogin: vi.fn(),
  createAppSessionForUser: vi.fn(),
  syncManusUser: vi.fn(),
  verifyGoogleStateToken: vi.fn(),
}));

const sdkMocks = vi.hoisted(() => ({
  exchangeCodeForToken: vi.fn(),
  getUserInfo: vi.fn(),
}));

vi.mock("../server/authService", () => authServiceMocks);
vi.mock("../server/_core/sdk", () => ({
  sdk: sdkMocks,
}));

const { registerOAuthRoutes } = await import("./_core/oauth");

type RouteHandler = (req: Request, res: Response) => unknown;

function createFakeApp() {
  const routes = new Map<string, RouteHandler>();
  const app = {
    get(path: string, handler: RouteHandler) {
      routes.set(path, handler);
      return app;
    },
  } as unknown as Express;

  registerOAuthRoutes(app);
  return routes;
}

function createResponse() {
  return {
    redirect: vi.fn(),
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
    cookie: vi.fn(),
  } as unknown as Response;
}

describe("registerOAuthRoutes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirige el callback de Manus al returnTo original cuando el acceso concluye bien", async () => {
    const routes = createFakeApp();
    const handler = routes.get("/api/oauth/callback");
    const res = createResponse();

    sdkMocks.exchangeCodeForToken.mockResolvedValue({ accessToken: "token-123" });
    sdkMocks.getUserInfo.mockResolvedValue({
      openId: "owner-open-id",
      name: "CEO",
      email: "ceo@empresa.com",
    });
    authServiceMocks.syncManusUser.mockResolvedValue({
      openId: "owner-open-id",
      name: "CEO",
      email: "ceo@empresa.com",
    });
    authServiceMocks.createAppSessionForUser.mockResolvedValue(undefined);

    await handler?.(
      {
        query: {
          code: "oauth-code",
          state: "encoded-state",
          returnTo: "/auditar?from=phone",
        },
      } as Request,
      res,
    );

    expect(authServiceMocks.createAppSessionForUser).toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith(302, "/auditar?from=phone");
  });

  it("redirige a /acceso con un error controlado cuando el callback de Manus falla", async () => {
    const routes = createFakeApp();
    const handler = routes.get("/api/oauth/callback");
    const res = createResponse();

    sdkMocks.exchangeCodeForToken.mockRejectedValue(new Error("oauth failed"));

    await handler?.(
      {
        query: {
          code: "oauth-code",
          state: "encoded-state",
          returnTo: "/auditar",
        },
      } as Request,
      res,
    );

    expect(res.redirect).toHaveBeenCalledWith(302, "/acceso?error=manus_callback_failed&returnTo=%2Fauditar");
  });

  it("propaga la bandera nativa al inicio de Google para preparar el retorno a la app", async () => {
    const routes = createFakeApp();
    const handler = routes.get("/api/auth/google/start");
    const res = createResponse();

    authServiceMocks.buildGoogleAuthorizationUrl.mockResolvedValue("https://accounts.google.com/mock");

    await handler?.(
      {
        query: {
          returnTo: "/auditar?from=mobile",
          native: "1",
        },
      } as Request,
      res,
    );

    expect(authServiceMocks.buildGoogleAuthorizationUrl).toHaveBeenCalledWith(
      expect.anything(),
      "/auditar?from=mobile",
      { nativeApp: true },
    );
    expect(res.redirect).toHaveBeenCalledWith(302, "https://accounts.google.com/mock");
  });

  it("redirige el callback exitoso de Google al esquema nativo cuando la sesión viene de móvil", async () => {
    const routes = createFakeApp();
    const handler = routes.get("/api/auth/google/callback");
    const res = createResponse();

    authServiceMocks.completeGoogleLogin.mockResolvedValue({
      returnTo: "/auditar?from=google",
      nativeApp: true,
      user: { openId: "email:persona@empresa.com" },
    });

    await handler?.(
      {
        query: {
          code: "oauth-code",
          state: "signed-state",
        },
      } as Request,
      res,
    );

    expect(res.redirect).toHaveBeenCalledWith(302, "auditapatron:///auditar?from=google");
  });

  it("usa el estado firmado para regresar a /acceso dentro de la app cuando falla Google en móvil", async () => {
    const routes = createFakeApp();
    const handler = routes.get("/api/auth/google/callback");
    const res = createResponse();

    authServiceMocks.completeGoogleLogin.mockRejectedValue(new Error("google failed"));
    authServiceMocks.verifyGoogleStateToken.mockResolvedValue({
      returnTo: "/auditar?from=mobile",
      nativeApp: true,
    });

    await handler?.(
      {
        query: {
          code: "oauth-code",
          state: "signed-state",
        },
      } as Request,
      res,
    );

    expect(res.redirect).toHaveBeenCalledWith(
      302,
      "auditapatron:///acceso?error=google_callback_failed&returnTo=%2Fauditar%3Ffrom%3Dmobile",
    );
  });
});

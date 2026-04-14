import type { Express, Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authServiceMocks = vi.hoisted(() => ({
  buildGoogleAuthorizationUrl: vi.fn(),
  completeGoogleLogin: vi.fn(),
  createAppSessionForUser: vi.fn(),
  syncManusUser: vi.fn(),
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
});

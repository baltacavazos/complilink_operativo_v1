import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const authServiceMocks = vi.hoisted(() => {
  class AuthFlowError extends Error {
    constructor(
      public readonly code: string,
      message: string,
      public readonly retryAfterSeconds?: number,
    ) {
      super(message);
      this.name = "AuthFlowError";
    }
  }

  return {
    AuthFlowError,
    isGoogleOAuthConfigured: vi.fn(),
    startEmailLogin: vi.fn(),
    completeEmailLogin: vi.fn(),
    clearEmailChallengeCookie: vi.fn(),
  };
});

vi.mock("./authService", () => ({
  AuthFlowError: authServiceMocks.AuthFlowError,
  isGoogleOAuthConfigured: authServiceMocks.isGoogleOAuthConfigured,
  startEmailLogin: authServiceMocks.startEmailLogin,
  completeEmailLogin: authServiceMocks.completeEmailLogin,
  clearEmailChallengeCookie: authServiceMocks.clearEmailChallengeCookie,
}));

const { appRouter } = await import("./routers");

type CookieCall = {
  name: string;
  options: Record<string, unknown>;
};

function createContext() {
  const cookieCalls: CookieCall[] = [];

  const ctx: TrpcContext = {
    user: null,
    req: {
      protocol: "https",
      headers: {},
      get: (name: string) => {
        const lower = name.toLowerCase();
        if (lower === "host") return "example.com";
        if (lower === "x-forwarded-proto") return "https";
        return undefined;
      },
    } as TrpcContext["req"],
    res: {
      cookie: (name: string, _value: string, options: Record<string, unknown>) => {
        cookieCalls.push({ name, options });
      },
      clearCookie: (name: string, options: Record<string, unknown>) => {
        cookieCalls.push({ name, options });
      },
    } as TrpcContext["res"],
  };

  return { ctx, cookieCalls };
}

describe("auth router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reports whether Google OAuth is enabled", async () => {
    authServiceMocks.isGoogleOAuthConfigured.mockReturnValue(true);
    const { ctx } = createContext();

    const result = await appRouter.createCaller(ctx).auth.googleStatus();

    expect(result).toEqual({
      enabled: true,
      startPath: "/api/auth/google/start",
    });
  });

  it("requests an email code and returns masked metadata plus cooldown details", async () => {
    authServiceMocks.startEmailLogin.mockResolvedValue({
      maskedEmail: "al***@empresa.com",
      usedOwnerBackupEmail: false,
      expiresInSeconds: 600,
      cooldownSeconds: 60,
      maxRequestsPerWindow: 5,
      rateLimitWindowSeconds: 3600,
    });
    const { ctx } = createContext();

    const result = await appRouter.createCaller(ctx).auth.requestEmailCode({
      email: "alicia@empresa.com",
      name: "Alicia",
    });

    expect(authServiceMocks.startEmailLogin).toHaveBeenCalledWith({
      req: ctx.req,
      res: ctx.res,
      email: "alicia@empresa.com",
      name: "Alicia",
    });
    expect(result).toEqual({
      success: true,
      maskedEmail: "al***@empresa.com",
      usedOwnerBackupEmail: false,
      expiresInSeconds: 600,
      cooldownSeconds: 60,
      maxRequestsPerWindow: 5,
      rateLimitWindowSeconds: 3600,
    });
  });

  it("propagates requestEmailCode failures to the caller", async () => {
    authServiceMocks.startEmailLogin.mockRejectedValue(new Error("Resend rejected the request: 403"));
    const { ctx } = createContext();

    await expect(
      appRouter.createCaller(ctx).auth.requestEmailCode({
        email: "alice@empresa.com",
        name: "Alice",
      }),
    ).rejects.toThrow("Resend rejected the request: 403");
  });

  it("returns a controlled cooldown error when email resend is requested too soon", async () => {
    authServiceMocks.startEmailLogin.mockRejectedValue(
      new authServiceMocks.AuthFlowError(
        "EMAIL_CODE_COOLDOWN_ACTIVE",
        "Debes esperar antes de solicitar otro código.",
        42,
      ),
    );
    const { ctx } = createContext();

    await expect(
      appRouter.createCaller(ctx).auth.requestEmailCode({
        email: "alice@empresa.com",
        name: "Alice",
      }),
    ).rejects.toThrow("Debes esperar antes de solicitar otro código.||retry_after=42||code=EMAIL_CODE_COOLDOWN_ACTIVE");
  });

  it("verifies an email code and returns the signed-in user", async () => {
    const signedUser = {
      id: 9,
      openId: "manus:existing-user",
      email: "alice@empresa.com",
      name: "Alice",
      loginMethod: "email",
      role: "user",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      lastSignedIn: new Date("2026-01-02T00:00:00.000Z"),
    };
    authServiceMocks.completeEmailLogin.mockResolvedValue(signedUser);
    const { ctx } = createContext();

    const result = await appRouter.createCaller(ctx).auth.verifyEmailCode({
      email: "alice@empresa.com",
      code: "123456",
      name: "Alice",
    });

    expect(authServiceMocks.completeEmailLogin).toHaveBeenCalledWith({
      req: ctx.req,
      res: ctx.res,
      email: "alice@empresa.com",
      code: "123456",
      name: "Alice",
    });
    expect(result).toEqual({ success: true, user: signedUser });
  });

  it("propagates verifyEmailCode failures to the caller", async () => {
    authServiceMocks.completeEmailLogin.mockRejectedValue(new Error("Invalid verification code"));
    const { ctx } = createContext();

    await expect(
      appRouter.createCaller(ctx).auth.verifyEmailCode({
        email: "alice@empresa.com",
        code: "123456",
        name: "Alice",
      }),
    ).rejects.toThrow("Invalid verification code");
  });

  it("returns a controlled verification error when the submitted code is invalid or expired", async () => {
    authServiceMocks.completeEmailLogin.mockRejectedValue(
      new authServiceMocks.AuthFlowError(
        "INVALID_EMAIL_CODE",
        "El código es incorrecto o ya expiró. Revisa tu correo e inténtalo otra vez.",
      ),
    );
    const { ctx } = createContext();

    await expect(
      appRouter.createCaller(ctx).auth.verifyEmailCode({
        email: "alice@empresa.com",
        code: "123456",
        name: "Alice",
      }),
    ).rejects.toThrow("El código es incorrecto o ya expiró. Revisa tu correo e inténtalo otra vez.||code=INVALID_EMAIL_CODE");
  });
});

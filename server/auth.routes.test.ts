import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { TRPCError } from "@trpc/server";
import { getHTTPStatusCodeFromError } from "@trpc/server/http";
import express from "express";
import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getFriendlyAuthMessage, parseStructuredAuthMessage } from "@/pages/accessAuthMessage";
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

async function rejectedError(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error("expected the procedure to reject");
}

function expectClientAuthRejection(
  error: unknown,
  expected: {
    code: "BAD_REQUEST" | "UNAUTHORIZED" | "TOO_MANY_REQUESTS";
    status: number;
    message: string;
    friendly: string;
  },
) {
  expect(error).toBeInstanceOf(TRPCError);
  const trpcError = error as TRPCError;
  expect(trpcError.code).toBe(expected.code);
  expect(getHTTPStatusCodeFromError(trpcError)).toBe(expected.status);
  expect(trpcError.message).toBe(expected.message);
  expect(getFriendlyAuthMessage(parseStructuredAuthMessage(trpcError.message))).toBe(expected.friendly);
}

function expectServerFailure(error: unknown, message: string) {
  expect(error).toBeInstanceOf(TRPCError);
  const trpcError = error as TRPCError;
  expect(trpcError.code).toBe("INTERNAL_SERVER_ERROR");
  expect(getHTTPStatusCodeFromError(trpcError)).toBe(500);
  expect(trpcError.message).toBe(message);
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

    const error = await rejectedError(
      appRouter.createCaller(ctx).auth.requestEmailCode({
        email: "alice@empresa.com",
        name: "Alice",
      }),
    );
    expectServerFailure(error, "Resend rejected the request: 403");
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

    const error = await rejectedError(
      appRouter.createCaller(ctx).auth.requestEmailCode({
        email: "alice@empresa.com",
        name: "Alice",
      }),
    );
    expectClientAuthRejection(error, {
      code: "TOO_MANY_REQUESTS",
      status: 429,
      message: "Debes esperar antes de solicitar otro código.||retry_after=42||code=EMAIL_CODE_COOLDOWN_ACTIVE",
      friendly: "Espera 42s para pedir otro código.",
    });
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

    const error = await rejectedError(
      appRouter.createCaller(ctx).auth.verifyEmailCode({
        email: "alice@empresa.com",
        code: "123456",
        name: "Alice",
      }),
    );
    expectServerFailure(error, "Invalid verification code");
  });

  it("returns a controlled verification error when the submitted code is invalid or expired", async () => {
    authServiceMocks.completeEmailLogin.mockRejectedValue(
      new authServiceMocks.AuthFlowError(
        "INVALID_EMAIL_CODE",
        "El código es incorrecto o ya expiró. Revisa tu correo e inténtalo otra vez.",
      ),
    );
    const { ctx } = createContext();

    const error = await rejectedError(
      appRouter.createCaller(ctx).auth.verifyEmailCode({
        email: "alice@empresa.com",
        code: "123456",
        name: "Alice",
      }),
    );
    expectClientAuthRejection(error, {
      code: "UNAUTHORIZED",
      status: 401,
      message: "El código es incorrecto o ya expiró. Revisa tu correo e inténtalo otra vez.||code=INVALID_EMAIL_CODE",
      friendly: "Código incorrecto. Revisa tu correo e inténtalo otra vez.",
    });
  });

  it("returns 429 when too many email codes were requested", async () => {
    authServiceMocks.startEmailLogin.mockRejectedValue(
      new authServiceMocks.AuthFlowError(
        "EMAIL_CODE_RATE_LIMITED",
        "Ya enviamos demasiados códigos a este correo en la última hora. Espera antes de intentarlo otra vez.",
        120,
      ),
    );
    const { ctx } = createContext();

    const error = await rejectedError(
      appRouter.createCaller(ctx).auth.requestEmailCode({
        email: "alice@empresa.com",
        name: "Alice",
      }),
    );
    expectClientAuthRejection(error, {
      code: "TOO_MANY_REQUESTS",
      status: 429,
      message:
        "Ya enviamos demasiados códigos a este correo en la última hora. Espera antes de intentarlo otra vez.||retry_after=120||code=EMAIL_CODE_RATE_LIMITED",
      friendly: "Ya enviamos varios códigos a este correo. Intenta de nuevo más tarde.",
    });
  });
});

describe("auth email code HTTP status", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.use(
      "/api/trpc",
      createExpressMiddleware({
        router: appRouter,
        createContext: ({ req, res }) => ({ req, res, user: null }),
      }),
    );
    server = createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve());
    });
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  async function postProcedure(path: string, input: unknown) {
    const response = await fetch(`${baseUrl}/api/trpc/${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ json: input }),
    });
    const body = (await response.json()) as {
      error?: { json?: { message?: string; data?: { code?: string; httpStatus?: number } } };
    };
    return { status: response.status, body };
  }

  it("answers 400 when a smoke address submits 000000 and the code is expired", async () => {
    const serviceMessage =
      "El código ya expiró o esta solicitud ya no es válida. Solicita uno nuevo para continuar.";
    authServiceMocks.completeEmailLogin.mockRejectedValue(
      new authServiceMocks.AuthFlowError("EMAIL_CODE_EXPIRED", serviceMessage),
    );

    const { status, body } = await postProcedure("auth.verifyEmailCode", {
      email: "smoke-off@auditapatron-smoke.test",
      code: "000000",
    });
    const error = body.error?.json;

    expect(status).toBe(400);
    expect(error?.data?.httpStatus).toBe(400);
    expect(error?.data?.code).toBe("BAD_REQUEST");
    expect(error?.message).toBe(`${serviceMessage}||code=EMAIL_CODE_EXPIRED`);
    expect(getFriendlyAuthMessage(parseStructuredAuthMessage(error?.message ?? ""))).toBe(
      "Ese código ya venció. Pide uno nuevo.",
    );
  });

  it("answers 401 when the submitted code does not match", async () => {
    const serviceMessage = "El código es incorrecto o ya expiró. Revisa tu correo e inténtalo otra vez.";
    authServiceMocks.completeEmailLogin.mockRejectedValue(
      new authServiceMocks.AuthFlowError("INVALID_EMAIL_CODE", serviceMessage),
    );

    const { status, body } = await postProcedure("auth.verifyEmailCode", {
      email: "persona@example.com",
      code: "123456",
    });

    expect(status).toBe(401);
    expect(body.error?.json?.data?.code).toBe("UNAUTHORIZED");
    expect(body.error?.json?.message).toBe(`${serviceMessage}||code=INVALID_EMAIL_CODE`);
    expect(getFriendlyAuthMessage(parseStructuredAuthMessage(body.error?.json?.message ?? ""))).toBe(
      "Código incorrecto. Revisa tu correo e inténtalo otra vez.",
    );
  });

  it("answers 429 when too many codes were requested", async () => {
    authServiceMocks.startEmailLogin.mockRejectedValue(
      new authServiceMocks.AuthFlowError(
        "EMAIL_CODE_RATE_LIMITED",
        "Ya enviamos demasiados códigos a este correo en la última hora. Espera antes de intentarlo otra vez.",
        90,
      ),
    );

    const { status, body } = await postProcedure("auth.requestEmailCode", {
      email: "persona@example.com",
    });

    expect(status).toBe(429);
    expect(body.error?.json?.data?.code).toBe("TOO_MANY_REQUESTS");
    expect(body.error?.json?.message).toContain("||retry_after=90||code=EMAIL_CODE_RATE_LIMITED");
    expect(getFriendlyAuthMessage(parseStructuredAuthMessage(body.error?.json?.message ?? ""))).toBe(
      "Ya enviamos varios códigos a este correo. Intenta de nuevo más tarde.",
    );
  });

  it("keeps an unexpected verify failure on HTTP 500", async () => {
    authServiceMocks.completeEmailLogin.mockRejectedValue(new Error("Database not available"));

    const { status, body } = await postProcedure("auth.verifyEmailCode", {
      email: "smoke-off@auditapatron-smoke.test",
      code: "000000",
    });

    expect(status).toBe(500);
    expect(body.error?.json?.data?.code).toBe("INTERNAL_SERVER_ERROR");
    expect(body.error?.json?.data?.httpStatus).toBe(500);
    expect(body.error?.json?.message).toBe("Database not available");
  });
});

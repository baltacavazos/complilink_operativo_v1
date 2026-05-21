import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";

process.env.JWT_SECRET = "test-cookie-secret";
process.env.GOOGLE_CLIENT_ID = "google-client-id";
process.env.GOOGLE_CLIENT_SECRET = "google-client-secret";

const dbMocks = vi.hoisted(() => ({
  getUserByOpenId: vi.fn(),
  getUserByEmail: vi.fn(),
  upsertUser: vi.fn(),
}));

const sdkMocks = vi.hoisted(() => ({
  createSessionToken: vi.fn(),
  exchangeCodeForToken: vi.fn(),
  getUserInfo: vi.fn(),
}));

vi.mock("./db", () => dbMocks);
vi.mock("./_core/sdk", () => ({
  sdk: sdkMocks,
}));

const { buildGoogleAuthorizationUrl, completeGoogleLogin } = await import("./authService");

function makeReq(): Request {
  return {
    protocol: "https",
    query: {},
    headers: {},
    get(header: string) {
      if (header === "host") return "auditapatron.com";
      if (header === "x-forwarded-proto") return "https";
      return undefined;
    },
  } as unknown as Request;
}

function makeRes(): Response {
  return {
    cookie: vi.fn(),
    clearCookie: vi.fn(),
  } as unknown as Response;
}

async function issueGoogleState(returnTo = "/auditar", nativeApp = false) {
  const authorizationUrl = await buildGoogleAuthorizationUrl(makeReq(), returnTo, { nativeApp });
  const state = new URL(authorizationUrl).searchParams.get("state");

  if (!state) {
    throw new Error("Google OAuth state was not generated");
  }

  return state;
}

describe("authService account linking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sdkMocks.createSessionToken.mockResolvedValue("session-token");
  });

  it("reusa la cuenta existente por correo cuando Google entra con el mismo email", async () => {
    const existingEmailUser = {
      id: 11,
      openId: "email:persona@empresa.com",
      email: "persona@empresa.com",
      name: "Persona",
      loginMethod: "email",
      role: "user",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
      lastSignedIn: new Date("2026-01-03T00:00:00.000Z"),
    };

    dbMocks.getUserByOpenId
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(existingEmailUser);
    dbMocks.getUserByEmail.mockResolvedValue(existingEmailUser);
    dbMocks.upsertUser.mockResolvedValue(undefined);

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ access_token: "google-access-token" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          sub: "google-user-123",
          email: "persona@empresa.com",
          name: "Persona Google",
        }),
      });

    vi.stubGlobal("fetch", fetchMock);

    const user = await completeGoogleLogin({
      req: makeReq(),
      res: makeRes(),
      code: "oauth-code",
      state: await issueGoogleState("/auditar?from=google", true),
    });

    expect(dbMocks.upsertUser).toHaveBeenCalledWith(
      expect.objectContaining({
        openId: "email:persona@empresa.com",
        email: "persona@empresa.com",
        loginMethod: "google",
      }),
    );
    expect(sdkMocks.createSessionToken).toHaveBeenCalledWith(
      "email:persona@empresa.com",
      expect.objectContaining({ name: "Persona" }),
    );
    expect(user.user.openId).toBe("email:persona@empresa.com");
    expect(user.nativeApp).toBe(true);
  });

  it("mantiene la identidad Google ya enlazada aunque cambie el email visible", async () => {
    const existingGoogleUser = {
      id: 22,
      openId: "google:google-user-123",
      email: "anterior@empresa.com",
      name: "Persona Google",
      loginMethod: "google",
      role: "user",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
      lastSignedIn: new Date("2026-01-03T00:00:00.000Z"),
    };

    dbMocks.getUserByOpenId
      .mockResolvedValueOnce(existingGoogleUser)
      .mockResolvedValueOnce({
        ...existingGoogleUser,
        email: "nuevo@empresa.com",
      });
    dbMocks.getUserByEmail.mockResolvedValue(undefined);
    dbMocks.upsertUser.mockResolvedValue(undefined);

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ access_token: "google-access-token" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          sub: "google-user-123",
          email: "nuevo@empresa.com",
          name: "Persona Google",
        }),
      });

    vi.stubGlobal("fetch", fetchMock);

    const user = await completeGoogleLogin({
      req: makeReq(),
      res: makeRes(),
      code: "oauth-code",
      state: await issueGoogleState("/acceso", false),
    });

    expect(dbMocks.upsertUser).toHaveBeenCalledWith(
      expect.objectContaining({
        openId: "google:google-user-123",
        email: "nuevo@empresa.com",
        loginMethod: "google",
      }),
    );
    expect(user.user.openId).toBe("google:google-user-123");
    expect(user.returnTo).toBe("/acceso");
    expect(user.nativeApp).toBe(false);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.JWT_SECRET = "test-cookie-secret";
process.env.RESEND_API_KEY = "resend_test_key";
process.env.RESEND_FROM_EMAIL = "onboarding@resend.dev";

const dbMocks = vi.hoisted(() => ({
  getUserByEmail: vi.fn(),
  upsertUser: vi.fn(),
  getUserByOpenId: vi.fn(),
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
vi.mock("./_core/cookies", () => ({
  getSessionCookieOptions: vi.fn(() => ({
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
  })),
}));

const { AuthFlowError, completeEmailLogin, startEmailLogin } = await import("./authService");

function makeReq(cookieHeader?: string) {
  return {
    headers: cookieHeader ? { cookie: cookieHeader } : {},
    protocol: "https",
    get: vi.fn((header: string) => {
      if (header === "host") return "auditapatron.com";
      if (header === "x-forwarded-proto") return "https";
      return undefined;
    }),
  } as any;
}

function makeRes() {
  return {
    cookie: vi.fn(),
    clearCookie: vi.fn(),
  } as any;
}

function extractCodeFromEmailPayload(fetchMock: ReturnType<typeof vi.fn>) {
  const body = String(fetchMock.mock.calls[0]?.[1]?.body ?? "");
  const payload = JSON.parse(body);
  const match = String(payload.text).match(/(\d{6})/);

  if (!match) {
    throw new Error("Could not extract code from email payload");
  }

  return {
    code: match[1],
    payload,
  };
}

describe("authService email code flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.SMOKE_AUTH;
    sdkMocks.createSessionToken.mockResolvedValue("session_token_value");
  });

  it("permite completar el acceso aunque falte la cookie temporal y envía el correo con branding Auditapatron", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ id: "email_123" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    dbMocks.getUserByEmail.mockResolvedValueOnce(undefined);
    dbMocks.upsertUser.mockResolvedValue(undefined);
    dbMocks.getUserByOpenId.mockResolvedValue({
      id: 1,
      openId: "email:balt@cavazos.com",
      email: "balt@cavazos.com",
      name: "Balta",
      loginMethod: "email",
      role: "user",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      lastSignedIn: new Date("2026-01-01T00:00:00.000Z"),
    });

    await startEmailLogin({
      req: makeReq(),
      res: makeRes(),
      email: "balt@cavazos.com",
      name: "Balta",
    });

    const { code, payload } = extractCodeFromEmailPayload(fetchMock);
    expect(payload.subject).toBe("Tu código de acceso a Auditapatron");
    expect(payload.from).toBe("Auditapatron <onboarding@resend.dev>");

    const verifyRes = makeRes();
    const user = await completeEmailLogin({
      req: makeReq(),
      res: verifyRes,
      email: "balt@cavazos.com",
      code,
    });

    expect(user.openId).toBe("email:balt@cavazos.com");
    expect(sdkMocks.createSessionToken).toHaveBeenCalledOnce();
    expect(verifyRes.clearCookie).toHaveBeenCalledOnce();
  });

  it("devuelve código inválido cuando el desafío temporal sigue vivo pero el usuario escribe un OTP incorrecto", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ id: "email_456" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await startEmailLogin({
      req: makeReq(),
      res: makeRes(),
      email: "otra.persona@empresa.com",
      name: "Otra Persona",
    });

    await expect(
      completeEmailLogin({
        req: makeReq(),
        res: makeRes(),
        email: "otra.persona@empresa.com",
        code: "000000",
      }),
    ).rejects.toMatchObject<AuthFlowError>({
      code: "INVALID_EMAIL_CODE",
    });
  });

  it("con SMOKE_AUTH=1 el correo smoke entra con 000000 y no manda OTP", async () => {
    process.env.SMOKE_AUTH = "1";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    dbMocks.getUserByEmail.mockResolvedValue(undefined);
    dbMocks.upsertUser.mockResolvedValue(undefined);
    dbMocks.getUserByOpenId.mockResolvedValue({
      id: 2,
      openId: "email:tester@auditapatron-smoke.test",
      email: "tester@auditapatron-smoke.test",
      name: "Tester",
      loginMethod: "email",
      role: "user",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      lastSignedIn: new Date("2026-01-01T00:00:00.000Z"),
    });

    await startEmailLogin({
      req: makeReq(),
      res: makeRes(),
      email: "tester@auditapatron-smoke.test",
      name: "Tester",
    });
    expect(fetchMock).not.toHaveBeenCalled();

    const verifyRes = makeRes();
    const user = await completeEmailLogin({
      req: makeReq(),
      res: verifyRes,
      email: "tester@auditapatron-smoke.test",
      code: "000000",
    });

    expect(user.email).toBe("tester@auditapatron-smoke.test");
    expect(sdkMocks.createSessionToken).toHaveBeenCalledOnce();
    expect(verifyRes.cookie).toHaveBeenCalled();
  });

  it("con SMOKE_AUTH=1 un correo +smoke@ entra sin inbox", async () => {
    process.env.SMOKE_AUTH = "1";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    dbMocks.getUserByEmail.mockResolvedValue(undefined);
    dbMocks.upsertUser.mockResolvedValue(undefined);
    dbMocks.getUserByOpenId.mockResolvedValue({
      id: 3,
      openId: "email:qa+smoke@empresa.com",
      email: "qa+smoke@empresa.com",
      name: "qa+smoke@empresa.com",
      loginMethod: "email",
      role: "user",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      lastSignedIn: new Date("2026-01-01T00:00:00.000Z"),
    });

    const user = await completeEmailLogin({
      req: makeReq(),
      res: makeRes(),
      email: "qa+smoke@empresa.com",
      code: "000000",
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(user.email).toBe("qa+smoke@empresa.com");
    expect(sdkMocks.createSessionToken).toHaveBeenCalledOnce();
  });

  it("con SMOKE_AUTH=1 un correo normal sigue exigiendo el OTP real", async () => {
    process.env.SMOKE_AUTH = "1";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ id: "email_normal" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await startEmailLogin({
      req: makeReq(),
      res: makeRes(),
      email: "cliente.real@empresa.com",
      name: "Cliente",
    });
    expect(fetchMock).toHaveBeenCalledOnce();

    await expect(
      completeEmailLogin({
        req: makeReq(),
        res: makeRes(),
        email: "cliente.real@empresa.com",
        code: "000000",
      }),
    ).rejects.toMatchObject<AuthFlowError>({
      code: "INVALID_EMAIL_CODE",
    });
    expect(sdkMocks.createSessionToken).not.toHaveBeenCalled();
  });

  it("sin SMOKE_AUTH un correo smoke no salta el OTP", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ id: "email_smoke_off" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await startEmailLogin({
      req: makeReq(),
      res: makeRes(),
      email: "flag-off@auditapatron-smoke.test",
      name: "Tester",
    });
    expect(fetchMock).toHaveBeenCalledOnce();

    await expect(
      completeEmailLogin({
        req: makeReq(),
        res: makeRes(),
        email: "flag-off@auditapatron-smoke.test",
        code: "000000",
      }),
    ).rejects.toMatchObject<AuthFlowError>({
      code: "INVALID_EMAIL_CODE",
    });
    expect(sdkMocks.createSessionToken).not.toHaveBeenCalled();
  });
});

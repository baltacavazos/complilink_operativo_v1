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
});

import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.JWT_SECRET = "test-cookie-secret";
process.env.RESEND_API_KEY = "resend_test_key";
process.env.RESEND_FROM_EMAIL = "onboarding@resend.dev";
process.env.OWNER_BACKUP_EMAIL = "baltacavazos85@gmail.com";

const dbMocks = vi.hoisted(() => ({
  getUserByEmail: vi.fn(),
}));

vi.mock("./db", () => dbMocks);
vi.mock("./_core/sdk", () => ({
  sdk: {
    createSessionToken: vi.fn(),
    exchangeCodeForToken: vi.fn(),
    getUserInfo: vi.fn(),
  },
}));
vi.mock("./_core/cookies", () => ({
  getSessionCookieOptions: vi.fn(() => ({
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
  })),
}));

const { startEmailLogin } = await import("./authService");

describe("startEmailLogin owner fallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirige el envío al correo de respaldo del propietario cuando Resend bloquea destinatarios externos", async () => {
    dbMocks.getUserByEmail.mockResolvedValue({
      id: 1,
      openId: "owner-open-id",
      email: "balt@cavazos.com",
      name: "Balta",
      loginMethod: "email",
      role: "admin",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      lastSignedIn: new Date("2026-01-01T00:00:00.000Z"),
    });

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: async () =>
          '{"statusCode":403,"message":"You can only send testing emails to your own email address (baltacavazos85@gmail.com)."}',
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ id: "email_123" }),
      });

    vi.stubGlobal("fetch", fetchMock);

    const req = {
      headers: {},
      protocol: "https",
      get: vi.fn((header: string) => {
        if (header === "host") return "auditapatron.com";
        if (header === "x-forwarded-proto") return "https";
        return undefined;
      }),
    } as any;
    const res = {
      cookie: vi.fn(),
    } as any;

    const result = await startEmailLogin({
      req,
      res,
      email: "balt@cavazos.com",
      name: "Balta",
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        method: "POST",
      }),
    );

    const firstPayload = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    const secondPayload = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body));

    expect(firstPayload.to).toEqual(["balt@cavazos.com"]);
    expect(secondPayload.to).toEqual(["baltacavazos85@gmail.com"]);
    expect(result.usedOwnerBackupEmail).toBe(true);
    expect(result.maskedEmail).toBe("ba************@gmail.com");
    expect(res.cookie).toHaveBeenCalledOnce();
  });

  it("no aplica el fallback para correos que no pertenecen al propietario", async () => {
    dbMocks.getUserByEmail.mockResolvedValue({
      id: 2,
      openId: "email:persona@empresa.com",
      email: "persona@empresa.com",
      name: "Persona",
      loginMethod: "email",
      role: "user",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      lastSignedIn: new Date("2026-01-01T00:00:00.000Z"),
    });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        text: async () =>
          '{"statusCode":403,"message":"You can only send testing emails to your own email address (baltacavazos85@gmail.com)."}',
      }),
    );

    const req = {
      headers: {},
      protocol: "https",
      get: vi.fn(() => "auditapatron.com"),
    } as any;
    const res = {
      cookie: vi.fn(),
    } as any;

    await expect(
      startEmailLogin({
        req,
        res,
        email: "persona@empresa.com",
        name: "Persona",
      }),
    ).rejects.toThrow("Resend rejected the request: 403");
  });
});

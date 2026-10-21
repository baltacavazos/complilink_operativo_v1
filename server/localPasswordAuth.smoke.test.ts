import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

process.env.JWT_SECRET = "test-cookie-secret";

const dbMocks = vi.hoisted(() => ({
  upsertUser: vi.fn(),
  getUserByOpenId: vi.fn(),
  ensureTenantForUser: vi.fn(),
  ensurePersonalWorkspaceForUser: vi.fn(),
}));

const authServiceMocks = vi.hoisted(() => ({
  createAppSessionForUser: vi.fn(),
}));

vi.mock("./db", () => dbMocks);
vi.mock("./authService", () => authServiceMocks);
vi.mock("./mysqlBootstrap", () => ({
  ensureMysqlTables: vi.fn(),
}));

const { completeSmokeTestSession, loginLocalPasswordAccount, registerLocalPasswordAccount } =
  await import("./localPasswordAuth");

const previousSmokeAuth = process.env.SMOKE_AUTH;
const previousSmokeCode = process.env.SMOKE_CODE;
const previousJwt = process.env.JWT_SECRET;
const SMOKE_CODE_FIXTURE = "fixture-smoke-code-not-real";

function makeReqRes() {
  return {
    req: { headers: {}, get: () => undefined } as never,
    res: { cookie: vi.fn(), clearCookie: vi.fn() } as never,
  };
}

describe("local password smoke session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = "test-cookie-secret";
    dbMocks.upsertUser.mockResolvedValue(undefined);
    dbMocks.ensurePersonalWorkspaceForUser.mockResolvedValue({
      tenant: { tenantId: "tnt-smoke" },
      tenantId: "tnt-smoke",
      caseId: "CASE-U9",
    });
    dbMocks.getUserByOpenId.mockResolvedValue({
      id: 9,
      openId: "email:smoke",
      email: "tester@auditapatron-smoke.test",
      name: "Tester",
      loginMethod: "email",
      role: "user",
    });
    authServiceMocks.createAppSessionForUser.mockResolvedValue(undefined);
  });

  afterEach(() => {
    if (previousSmokeAuth === undefined) delete process.env.SMOKE_AUTH;
    else process.env.SMOKE_AUTH = previousSmokeAuth;
    if (previousSmokeCode === undefined) delete process.env.SMOKE_CODE;
    else process.env.SMOKE_CODE = previousSmokeCode;
    if (previousJwt === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousJwt;
  });

  it("con SMOKE_AUTH=1 el correo smoke abre sesión y expediente sin OTP", async () => {
    process.env.SMOKE_AUTH = "1";
    process.env.SMOKE_CODE = SMOKE_CODE_FIXTURE;
    const { req, res } = makeReqRes();

    const user = await loginLocalPasswordAccount({
      req,
      res,
      email: "tester@auditapatron-smoke.test",
      password: SMOKE_CODE_FIXTURE,
    });

    expect(user.email).toBe("tester@auditapatron-smoke.test");
    expect(dbMocks.ensurePersonalWorkspaceForUser).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 9 }),
    );
    expect(authServiceMocks.createAppSessionForUser).toHaveBeenCalledOnce();
  });

  it("con SMOKE_AUTH=1 +smoke@ también abre sesión de prueba", async () => {
    process.env.SMOKE_AUTH = "1";
    process.env.SMOKE_CODE = SMOKE_CODE_FIXTURE;
    dbMocks.getUserByOpenId.mockResolvedValue({
      id: 10,
      openId: "email:plus-smoke",
      email: "qa+smoke@empresa.com",
      name: "QA",
      loginMethod: "email",
      role: "user",
    });
    const { req, res } = makeReqRes();

    const user = await registerLocalPasswordAccount({
      req,
      res,
      email: "qa+smoke@empresa.com",
      password: SMOKE_CODE_FIXTURE,
    });

    expect(user.email).toBe("qa+smoke@empresa.com");
    expect(dbMocks.ensurePersonalWorkspaceForUser).toHaveBeenCalled();
  });

  it("un correo normal no abre sesión de prueba aunque el flag esté en 1", async () => {
    process.env.SMOKE_AUTH = "1";
    process.env.SMOKE_CODE = SMOKE_CODE_FIXTURE;
    const { req, res } = makeReqRes();

    await expect(
      completeSmokeTestSession({
        req,
        res,
        email: "cliente.real@empresa.com",
        password: SMOKE_CODE_FIXTURE,
      }),
    ).rejects.toThrow(/sesión de prueba no está activa/);
    expect(authServiceMocks.createAppSessionForUser).not.toHaveBeenCalled();
    expect(dbMocks.ensurePersonalWorkspaceForUser).not.toHaveBeenCalled();
  });

  it("sin SMOKE_AUTH el correo smoke no salta la auth real", async () => {
    delete process.env.SMOKE_AUTH;
    process.env.SMOKE_CODE = SMOKE_CODE_FIXTURE;
    const { req, res } = makeReqRes();

    await expect(
      loginLocalPasswordAccount({
        req,
        res,
        email: "tester@auditapatron-smoke.test",
        password: SMOKE_CODE_FIXTURE,
      }),
    ).rejects.toThrow();
    expect(authServiceMocks.createAppSessionForUser).not.toHaveBeenCalled();
  });

  it("con SMOKE_AUTH=1 y sin SMOKE_CODE no abre la sesión de prueba", async () => {
    process.env.SMOKE_AUTH = "1";
    delete process.env.SMOKE_CODE;
    const { req, res } = makeReqRes();

    await expect(
      loginLocalPasswordAccount({
        req,
        res,
        email: "tester@auditapatron-smoke.test",
        password: SMOKE_CODE_FIXTURE,
      }),
    ).rejects.toThrow();
    expect(authServiceMocks.createAppSessionForUser).not.toHaveBeenCalled();
  });
});

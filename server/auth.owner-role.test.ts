import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.OWNER_OPEN_ID = "owner-open-id";

const dbMocks = vi.hoisted(() => ({
  getUserByOpenId: vi.fn(),
  getUserByEmail: vi.fn(),
  upsertUser: vi.fn(),
}));

vi.mock("./db", () => dbMocks);
vi.mock("./_core/sdk", () => ({
  sdk: {
    createSessionToken: vi.fn(),
    exchangeCodeForToken: vi.fn(),
    getUserInfo: vi.fn(),
  },
}));

const { syncManusUser } = await import("./authService");

describe("syncManusUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("canonicaliza al propietario como admin aunque antes existiera un acceso simple por correo", async () => {
    dbMocks.getUserByOpenId
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({
        id: 91,
        openId: "owner-open-id",
        email: "ceo@empresa.com",
        name: "CEO",
        loginMethod: "manus",
        role: "admin",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-02T00:00:00.000Z"),
        lastSignedIn: new Date("2026-01-03T00:00:00.000Z"),
      });
    dbMocks.getUserByEmail.mockResolvedValue({
      id: 12,
      openId: "email:ceo@empresa.com",
      email: "ceo@empresa.com",
      name: "CEO temporal",
      loginMethod: "email",
      role: "user",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
      lastSignedIn: new Date("2026-01-03T00:00:00.000Z"),
    });
    dbMocks.upsertUser.mockResolvedValue(undefined);

    const user = await syncManusUser({
      openId: "owner-open-id",
      email: "ceo@empresa.com",
      name: "CEO",
    });

    expect(dbMocks.upsertUser).toHaveBeenCalledWith(
      expect.objectContaining({
        openId: "owner-open-id",
        email: "ceo@empresa.com",
        loginMethod: "manus",
        role: "admin",
      }),
    );
    expect(user.role).toBe("admin");
    expect(user.openId).toBe("owner-open-id");
  });
});

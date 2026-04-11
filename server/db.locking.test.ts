import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  connection: {
    query: vi.fn(),
    release: vi.fn(),
    destroy: vi.fn(),
  },
  getConnection: vi.fn(),
  createPool: vi.fn(),
}));

vi.mock("drizzle-orm/mysql2", () => ({
  drizzle: vi.fn(() => ({})),
}));

vi.mock("mysql2/promise", () => ({
  createPool: state.createPool,
}));

describe("withDatabaseLock", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.DATABASE_URL = "mysql://local-test";

    state.connection.query.mockReset();
    state.connection.release.mockReset();
    state.connection.destroy.mockReset();
    state.getConnection.mockReset();
    state.createPool.mockReset();

    state.getConnection.mockResolvedValue(state.connection);
    state.createPool.mockReturnValue({
      getConnection: state.getConnection,
    });
  });

  it("acquires and releases the named lock on the same dedicated connection", async () => {
    state.connection.query
      .mockResolvedValueOnce([[{ acquired: 1 }]])
      .mockResolvedValueOnce([[{ released: 1 }]]);

    const { withDatabaseLock } = await import("./db");
    const action = vi.fn(async () => "ok");

    const result = await withDatabaseLock({
      lockKey: "legal:balt-1:CASE-BALT-1-DEMO001:v1",
      timeoutSeconds: 12,
      action,
    });

    expect(result).toBe("ok");
    expect(state.createPool).toHaveBeenCalledWith("mysql://local-test");
    expect(state.getConnection).toHaveBeenCalledTimes(1);
    expect(state.connection.query).toHaveBeenNthCalledWith(
      1,
      "SELECT GET_LOCK(?, ?) AS acquired",
      ["legal:balt-1:CASE-BALT-1-DEMO001:v1", 12],
    );
    expect(action).toHaveBeenCalledTimes(1);
    expect(state.connection.query).toHaveBeenNthCalledWith(
      2,
      "SELECT RELEASE_LOCK(?) AS released",
      ["legal:balt-1:CASE-BALT-1-DEMO001:v1"],
    );
    expect(state.connection.release).toHaveBeenCalledTimes(1);
    expect(state.connection.destroy).not.toHaveBeenCalled();
  });

  it("throws the friendly legal acceptance error when the lock is not acquired", async () => {
    state.connection.query.mockResolvedValueOnce([[{ acquired: 0 }]]);

    const { withDatabaseLock } = await import("./db");

    await expect(
      withDatabaseLock({
        lockKey: "legal:balt-1:CASE-BALT-1-DEMO001:v1",
        timeoutSeconds: 12,
        action: async () => "ok",
      }),
    ).rejects.toThrow("No se pudo asegurar la aceptación legal en este momento. Intenta de nuevo.");

    expect(state.connection.query).toHaveBeenCalledTimes(1);
    expect(state.connection.release).toHaveBeenCalledTimes(1);
    expect(state.connection.destroy).not.toHaveBeenCalled();
  });
});

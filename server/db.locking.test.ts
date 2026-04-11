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
    vi.restoreAllMocks();
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

  it("acquires and releases the named lock on the same dedicated connection with telemetry", async () => {
    state.connection.query
      .mockResolvedValueOnce([[{ acquired: 1 }]])
      .mockResolvedValueOnce([[{ released: 1 }]]);

    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.spyOn(Date, "now")
      .mockReturnValueOnce(1_000)
      .mockReturnValueOnce(1_012)
      .mockReturnValueOnce(1_015)
      .mockReturnValueOnce(1_029);

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
    expect(infoSpy).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('"event":"lock_acquired"'),
    );
    expect(infoSpy).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('"event":"lock_released"'),
    );
    expect(infoSpy.mock.calls[0]?.[0]).toContain('"waitTimeMs":12');
    expect(infoSpy.mock.calls[1]?.[0]).toContain('"holdTimeMs":14');
    expect(state.connection.release).toHaveBeenCalledTimes(1);
    expect(state.connection.destroy).not.toHaveBeenCalled();
  });

  it("throws a typed lock contention error with telemetry when the lock is not acquired", async () => {
    state.connection.query.mockResolvedValueOnce([[{ acquired: 0 }]]);

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(Date, "now")
      .mockReturnValueOnce(2_000)
      .mockReturnValueOnce(2_014);

    const { DatabaseLockContentionError, withDatabaseLock } = await import("./db");

    let capturedError: unknown;
    try {
      await withDatabaseLock({
        lockKey: "legal:balt-1:CASE-BALT-1-DEMO001:v1",
        timeoutSeconds: 12,
        action: async () => "ok",
      });
    } catch (error) {
      capturedError = error;
    }

    expect(capturedError).toBeInstanceOf(DatabaseLockContentionError);
    expect(capturedError).toMatchObject({
      code: "DATABASE_LOCK_CONFLICT",
      lockKey: "legal:balt-1:CASE-BALT-1-DEMO001:v1",
      timeoutSeconds: 12,
      waitTimeMs: 14,
      message: "No se pudo asegurar la aceptación legal en este momento. Intenta de nuevo.",
    });
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('"event":"lock_conflict"'));
    expect(warnSpy.mock.calls[0]?.[0]).toContain('"waitTimeMs":14');
    expect(state.connection.query).toHaveBeenCalledTimes(1);
    expect(state.connection.release).toHaveBeenCalledTimes(1);
    expect(state.connection.destroy).not.toHaveBeenCalled();
  });
});

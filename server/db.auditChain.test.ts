import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  inserted: [] as Array<Record<string, unknown>>,
}));

vi.mock("drizzle-orm/mysql2", () => ({
  drizzle: vi.fn(() => ({
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: async () => {
              const last = state.inserted.at(-1);
              return last ? [{ hashChain: last.hashChain }] : [];
            },
          }),
        }),
      }),
    }),
    insert: () => ({
      values: async (payload: Record<string, unknown>) => {
        state.inserted.push(payload);
      },
    }),
  })),
}));

describe("createAuditLog hash chain", () => {
  beforeEach(() => {
    state.inserted.length = 0;
    vi.resetModules();
    process.env.DATABASE_URL = "mysql://local-test";
  });

  it("generates a stable hash and chains the next audit entry to the previous one", async () => {
    const { createAuditLog } = await import("./db");

    await createAuditLog({
      tenantId: "tenant-1",
      caseId: "CASE-001",
      traceId: "trace.tenant-1.CASE-001",
      actorUserId: 7,
      entityType: "case",
      entityId: "CASE-001",
      action: "case.create",
      afterState: { status: "intake", priority: "high" },
    });

    await createAuditLog({
      tenantId: "tenant-1",
      caseId: "CASE-001",
      traceId: "trace.tenant-1.CASE-001",
      actorUserId: 7,
      entityType: "case",
      entityId: "CASE-001",
      action: "case.update_status",
      beforeState: { status: "intake", priority: "high" },
      afterState: { status: "analysis", priority: "high" },
    });

    expect(state.inserted).toHaveLength(2);
    expect(state.inserted[0]?.hashChain).toMatch(/^[a-f0-9]{64}$/);
    expect(state.inserted[1]?.hashChain).toMatch(/^[a-f0-9]{64}$/);
    expect(state.inserted[1]?.hashChain).not.toBe(state.inserted[0]?.hashChain);
  });

  it("uses a tenant-scope chain when the audit entry has no caseId", async () => {
    const { createAuditLog } = await import("./db");

    await createAuditLog({
      tenantId: "tenant-1",
      traceId: "trace.tenant-1.bootstrap",
      actorUserId: 7,
      entityType: "tenant",
      entityId: "tenant-1",
      action: "tenant.bootstrap",
      afterState: { status: "pilot" },
    });

    expect(state.inserted).toHaveLength(1);
    expect(state.inserted[0]?.caseId).toBeNull();
    expect(state.inserted[0]?.hashChain).toMatch(/^[a-f0-9]{64}$/);
  });
});

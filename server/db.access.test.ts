import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  selectResults: [] as Array<Array<Record<string, unknown>>>,
  selectCalls: 0,
}));

vi.mock("drizzle-orm/mysql2", () => ({
  drizzle: vi.fn(() => ({
    select: () => ({
      from: () => ({
        where: () => {
          let consumed = false;
          const consume = async () => {
            if (!consumed) {
              consumed = true;
              const result = state.selectResults[state.selectCalls] ?? [];
              state.selectCalls += 1;
              return result;
            }
            return state.selectResults[state.selectCalls - 1] ?? [];
          };

          return {
            limit: async () => consume(),
            then: (resolve: (value: Array<Record<string, unknown>>) => unknown, reject?: (reason: unknown) => unknown) =>
              consume().then(resolve, reject),
          };
        },
      }),
    }),
  })),
}));

describe("db access guards", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.DATABASE_URL = "mysql://local-test";
    state.selectResults = [];
    state.selectCalls = 0;
  });

  it("denies tenant admin access when the only matching membership is case-scoped", async () => {
    state.selectResults = [[]];

    const { assertTenantAdminAccess } = await import("./db");

    await expect(assertTenantAdminAccess(7, "tenant-a")).rejects.toThrow("Admin access denied for tenant");
    expect(state.selectCalls).toBe(1);
  });

  it("allows tenant admin access when there is an active tenant-wide manager membership", async () => {
    const tenantAdminMembership = {
      id: 99,
      userId: 7,
      tenantId: "tenant-a",
      role: "manager",
      accessScope: "tenant",
      status: "active",
    };

    state.selectResults = [[tenantAdminMembership]];

    const { assertTenantAdminAccess } = await import("./db");

    await expect(assertTenantAdminAccess(7, "tenant-a")).resolves.toEqual(tenantAdminMembership);
    expect(state.selectCalls).toBe(1);
  });

  it("reuses the already validated tenant-wide membership when no explicit case grant exists", async () => {
    const tenantWideMembership = {
      id: 15,
      userId: 7,
      tenantId: "tenant-a",
      role: "tenant_admin",
      accessScope: "tenant",
      status: "active",
    };

    state.selectResults = [[tenantWideMembership], []];

    const { assertCaseAccess } = await import("./db");

    await expect(assertCaseAccess(7, "tenant-a", "CASE-001")).resolves.toEqual(tenantWideMembership);
    expect(state.selectCalls).toBe(2);
  });

  it("preserves tenant-wide fallback when the memberships include both case and tenant scope", async () => {
    const caseScopedMembership = {
      id: 16,
      userId: 7,
      tenantId: "tenant-a",
      role: "reviewer",
      accessScope: "case",
      status: "active",
    };
    const tenantWideMembership = {
      id: 17,
      userId: 7,
      tenantId: "tenant-a",
      role: "manager",
      accessScope: "tenant",
      status: "active",
    };

    state.selectResults = [[caseScopedMembership, tenantWideMembership], []];

    const { assertCaseAccess } = await import("./db");

    await expect(assertCaseAccess(7, "tenant-a", "CASE-002")).resolves.toEqual(tenantWideMembership);
    expect(state.selectCalls).toBe(2);
  });

  it("preserves explicit case grant precedence over a tenant-wide membership", async () => {
    const tenantWideMembership = {
      id: 18,
      userId: 7,
      tenantId: "tenant-a",
      role: "manager",
      accessScope: "tenant",
      status: "active",
    };
    const explicitCaseGrant = {
      id: 19,
      userId: 7,
      tenantId: "tenant-a",
      caseId: "CASE-003",
      role: "reviewer",
      accessScope: "case",
      status: "active",
    };

    state.selectResults = [[tenantWideMembership], [explicitCaseGrant]];

    const { assertCaseAccess } = await import("./db");

    await expect(assertCaseAccess(7, "tenant-a", "CASE-003")).resolves.toEqual(explicitCaseGrant);
    expect(state.selectCalls).toBe(2);
  });
});

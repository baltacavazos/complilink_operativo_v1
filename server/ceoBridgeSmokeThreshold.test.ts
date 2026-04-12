import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const dbMocks = vi.hoisted(() => ({
  ensureTenantForUser: vi.fn(),
  assertTenantAdminAccess: vi.fn(),
  createAuditLog: vi.fn(),
  buildTraceId: vi.fn(),
}));

const bridgeSmokeMonitoringMocks = vi.hoisted(() => ({
  readBridgeSmokeMonitoringSnapshot: vi.fn(),
  updateBridgeSmokeAlertThreshold: vi.fn(),
}));

vi.mock("./db", () => dbMocks);
vi.mock("./bridgeSmokeMonitoring", () => bridgeSmokeMonitoringMocks);

import { appRouter } from "./routers";

function createProtectedContext(): TrpcContext {
  return {
    user: {
      id: 7,
      openId: "complilink-owner",
      email: "owner@complilink.mx",
      name: "CompliLink Owner",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => undefined,
    } as TrpcContext["res"],
  };
}

describe("ceoUpdateBridgeSmokeThreshold", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-12T06:00:00.000Z"));
    vi.clearAllMocks();

    vi.mocked(dbMocks.ensureTenantForUser).mockResolvedValue({ tenantId: "balt-1" });
    vi.mocked(dbMocks.assertTenantAdminAccess).mockResolvedValue(undefined);
    vi.mocked(dbMocks.buildTraceId).mockReturnValue("trace.balt-1.CEO-BRIDGE-SMOKE-THRESHOLD");
    vi.mocked(bridgeSmokeMonitoringMocks.readBridgeSmokeMonitoringSnapshot)
      .mockReturnValueOnce({
        alerting: {
          threshold: 4,
          thresholdAudit: {
            userId: null,
            userName: null,
            userEmail: null,
            updatedAt: null,
          },
          visualState: "watch",
          statusLabel: "En observación",
        },
      })
      .mockReturnValueOnce({
        alerting: {
          threshold: 6,
          thresholdAudit: {
            userId: 7,
            userName: "CompliLink Owner",
            userEmail: "owner@complilink.mx",
            updatedAt: "2026-04-12T06:00:00.000Z",
          },
          visualState: "stable",
          statusLabel: "Sin alertas activas",
        },
      });
    vi.mocked(bridgeSmokeMonitoringMocks.updateBridgeSmokeAlertThreshold).mockReturnValue({
      previousThreshold: 4,
      threshold: 6,
      changed: true,
      thresholdAudit: {
        userId: 7,
        userName: "CompliLink Owner",
        userEmail: "owner@complilink.mx",
        updatedAt: "2026-04-12T06:00:00.000Z",
      },
    });
    vi.mocked(dbMocks.createAuditLog).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("actualiza el umbral y deja una bitácora auditada", async () => {
    const caller = appRouter.createCaller(createProtectedContext());

    const result = await caller.dashboard.ceoUpdateBridgeSmokeThreshold({
      threshold: 6,
      tenantId: "balt-1",
      snapshotGeneratedAt: "2026-04-12T05:59:30.000Z",
    });

    expect(bridgeSmokeMonitoringMocks.updateBridgeSmokeAlertThreshold).toHaveBeenCalledWith({
      threshold: 6,
      actor: {
        userId: 7,
        userName: "CompliLink Owner",
        userEmail: "owner@complilink.mx",
      },
    });
    expect(dbMocks.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "balt-1",
        actorUserId: 7,
        entityType: "system",
        entityId: "bridge_smoke_alert_threshold",
        action: "dashboard.ceo.bridge_smoke_threshold_updated",
        beforeState: expect.objectContaining({
          threshold: 4,
        }),
        afterState: expect.objectContaining({
          threshold: 6,
          changed: true,
          previousThreshold: 4,
          visualState: "stable",
          statusLabel: "Sin alertas activas",
        }),
      }),
    );
    expect(result).toMatchObject({
      alerting: {
        threshold: 6,
        visualState: "stable",
      },
    });
  });
});

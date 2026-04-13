import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  listDueCeoBridgeSchedulesMock,
  recordCeoBridgeScheduleRunMock,
  createAuditLogMock,
  getCeoDashboardSnapshotMock,
  listAuditTrailMock,
  buildTraceIdMock,
  sendEmailWithResendMock,
  buildCeoCsvReportMock,
  buildCeoPdfReportMock,
} = vi.hoisted(() => ({
  listDueCeoBridgeSchedulesMock: vi.fn(),
  recordCeoBridgeScheduleRunMock: vi.fn(),
  createAuditLogMock: vi.fn(),
  getCeoDashboardSnapshotMock: vi.fn(),
  listAuditTrailMock: vi.fn(),
  buildTraceIdMock: vi.fn(() => "trace-id"),
  sendEmailWithResendMock: vi.fn(),
  buildCeoCsvReportMock: vi.fn(),
  buildCeoPdfReportMock: vi.fn(),
}));

vi.mock("./db", () => ({
  buildTraceId: buildTraceIdMock,
  createAuditLog: createAuditLogMock,
  getCeoDashboardSnapshot: getCeoDashboardSnapshotMock,
  listAuditTrail: listAuditTrailMock,
  listDueCeoBridgeSchedules: listDueCeoBridgeSchedulesMock,
  recordCeoBridgeScheduleRun: recordCeoBridgeScheduleRunMock,
}));

vi.mock("./authService", () => ({
  sendEmailWithResend: sendEmailWithResendMock,
}));

vi.mock("../client/src/pages/ceoDashboardExports", () => ({
  buildCeoCsvReport: buildCeoCsvReportMock,
  buildCeoPdfReport: buildCeoPdfReportMock,
}));

import {
  isMissingCeoBridgeScheduleInfrastructureError,
  processDueCeoBridgeSchedules,
} from "./ceoBridgeAutomation";

function buildMissingBridgeTableError() {
  return {
    message: "Failed query: select * from ceo_bridge_schedules",
    query: "select * from ceo_bridge_schedules",
    cause: new Error("Table 'demo.ceo_bridge_schedules' doesn't exist"),
  };
}

describe("ceoBridgeAutomation resilience", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("detecta errores de infraestructura faltante del bridge incluso si vienen anidados en cause", () => {
    expect(isMissingCeoBridgeScheduleInfrastructureError(buildMissingBridgeTableError())).toBe(true);
  });

  it("no confunde otros errores de base de datos con infraestructura faltante del bridge", () => {
    expect(
      isMissingCeoBridgeScheduleInfrastructureError(
        new Error("Failed query: select * from audit_logs where tenantId = 'demo'"),
      ),
    ).toBe(false);
  });

  it("degrada el escaneo automático sin reventar cuando la tabla del bridge aún no existe", async () => {
    listDueCeoBridgeSchedulesMock.mockRejectedValueOnce(buildMissingBridgeTableError());
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await expect(processDueCeoBridgeSchedules()).resolves.toBeUndefined();

    expect(recordCeoBridgeScheduleRunMock).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(String(warnSpy.mock.calls[0]?.[0] ?? "")).toContain("Infraestructura faltante");
  });

  it("repropaga errores no relacionados para no ocultar fallos genuinos del worker", async () => {
    listDueCeoBridgeSchedulesMock.mockRejectedValueOnce(new Error("database connection lost"));

    await expect(processDueCeoBridgeSchedules()).rejects.toThrow("database connection lost");
  });
});

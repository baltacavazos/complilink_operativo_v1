import { describe, expect, it } from "vitest";

import {
  computeNextBridgeScheduleRunAt,
  isMissingCeoBridgeScheduleInfrastructureError,
  validateBridgeScheduleCronExpression,
  validateBridgeScheduleTimezone,
} from "./ceoBridgeAutomation";

describe("ceoBridgeAutomation", () => {
  it("acepta expresiones cron válidas de 6 campos", () => {
    expect(validateBridgeScheduleCronExpression("0 0 8 * * 1")).toBe(true);
    expect(validateBridgeScheduleCronExpression("0 */15 * * * *")).toBe(true);
  });

  it("rechaza expresiones cron incompletas o fuera de rango", () => {
    expect(validateBridgeScheduleCronExpression("0 8 * * 1")).toBe(false);
    expect(validateBridgeScheduleCronExpression("0 61 8 * * 1")).toBe(false);
    expect(validateBridgeScheduleCronExpression("0 0 25 * * 1")).toBe(false);
  });

  it("valida timezones IANA reales", () => {
    expect(validateBridgeScheduleTimezone("UTC")).toBe(true);
    expect(validateBridgeScheduleTimezone("America/Mexico_City")).toBe(true);
    expect(validateBridgeScheduleTimezone("Mars/Olympus_Mons")).toBe(false);
  });

  it("calcula la siguiente ejecución diaria usando UTC cuando la hora objetivo aún no pasó", () => {
    const nextRun = computeNextBridgeScheduleRunAt("0 30 8 * * *", "UTC", new Date("2026-04-12T08:05:00.000Z"));

    expect(nextRun.toISOString()).toBe("2026-04-12T08:30:00.000Z");
  });

  it("salta al siguiente día cuando la hora objetivo ya pasó", () => {
    const nextRun = computeNextBridgeScheduleRunAt("0 30 8 * * *", "UTC", new Date("2026-04-12T09:05:00.000Z"));

    expect(nextRun.toISOString()).toBe("2026-04-13T08:30:00.000Z");
  });

  it("detecta el error de infraestructura cuando falta ceo_bridge_schedules en el stack de error", () => {
    const error = {
      name: "DrizzleQueryError",
      message: "Failed query: select * from ceo_bridge_schedules",
      cause: {
        message: "Table 'tenant.ceo_bridge_schedules' doesn't exist",
        sql: "select * from ceo_bridge_schedules where isActive = 1",
      },
    };

    expect(isMissingCeoBridgeScheduleInfrastructureError(error)).toBe(true);
  });

  it("evita falsos positivos cuando el fallo no corresponde a tablas del bridge", () => {
    const error = {
      name: "DrizzleQueryError",
      message: "Failed query: select * from users",
      cause: {
        message: "Table 'tenant.users' doesn't exist",
      },
    };

    expect(isMissingCeoBridgeScheduleInfrastructureError(error)).toBe(false);
  });
});

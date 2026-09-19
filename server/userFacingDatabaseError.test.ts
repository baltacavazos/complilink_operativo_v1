import { describe, expect, it } from "vitest";

import {
  isRawDatabaseError,
  toUserFacingDatabaseError,
  USER_FACING_DATABASE_ERROR,
} from "./userFacingDatabaseError";

describe("errores de base nunca llegan crudos", () => {
  it("detecta SQL de labor_cases y lo traduce al español", () => {
    const sqlError = Object.assign(
      new Error("Table 'railway.labor_cases' doesn't exist"),
      { code: "ER_NO_SUCH_TABLE" },
    );

    expect(isRawDatabaseError(sqlError)).toBe(true);
    expect(toUserFacingDatabaseError(sqlError).message).toBe(USER_FACING_DATABASE_ERROR);
    expect(toUserFacingDatabaseError(sqlError).message).not.toMatch(/labor_cases|SQL|ER_NO_SUCH_TABLE/i);
  });

  it("conserva denegaciones claras de acceso en español", () => {
    expect(toUserFacingDatabaseError(new Error("No tienes acceso a este espacio.")).message).toBe(
      "No tienes acceso a este espacio.",
    );
    expect(
      toUserFacingDatabaseError(new Error("Esta cuenta aún no tiene un expediente personal.")).message,
    ).toBe("Esta cuenta aún no tiene un expediente personal.");
  });
});

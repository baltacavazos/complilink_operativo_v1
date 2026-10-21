import { describe, expect, it } from "vitest";

import {
  isDuplicateKeyError,
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

  it("reconoce Duplicate entry para reutilizar el expediente", () => {
    expect(isDuplicateKeyError(Object.assign(new Error("Duplicate entry"), { code: "ER_DUP_ENTRY" }))).toBe(
      true,
    );
  });

  it("reconoce ER_DUP_ENTRY aunque Drizzle lo esconda en cause", () => {
    const cause = Object.assign(new Error("constraint violation"), {
      code: "ER_DUP_ENTRY",
      errno: 1062,
    });
    const wrapped = new Error("Failed query: insert into `complilink_webhook_events` (`eventKey`) values (?)");
    wrapped.name = "DrizzleQueryError";
    wrapped.cause = cause;

    expect(wrapped.message.toLowerCase()).not.toContain("duplicate entry");
    expect(isDuplicateKeyError(wrapped)).toBe(true);
    const otherCause = Object.assign(new Error("connection lost"), { code: "PROTOCOL_CONNECTION_LOST" });
    const other = new Error("Failed query: insert into `complilink_webhook_events`");
    other.cause = otherCause;
    expect(isDuplicateKeyError(other)).toBe(false);
  });
});

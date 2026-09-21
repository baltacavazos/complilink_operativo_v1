import { afterEach, describe, expect, it } from "vitest";

import {
  canUseSmokeAuth,
  isSmokeAuthCode,
  isSmokeAuthEmail,
  isSmokeAuthEnabled,
  shouldOpenSmokeTestSession,
  SMOKE_AUTH_CODE,
} from "./smokeAuth";

const previousSmokeAuth = process.env.SMOKE_AUTH;

describe("smoke auth allowlist", () => {
  afterEach(() => {
    if (previousSmokeAuth === undefined) {
      delete process.env.SMOKE_AUTH;
    } else {
      process.env.SMOKE_AUTH = previousSmokeAuth;
    }
  });

  it("reconoce solo correos de prueba", () => {
    expect(isSmokeAuthEmail("tester@auditapatron-smoke.test")).toBe(true);
    expect(isSmokeAuthEmail("  FOO@Auditapatron-Smoke.TEST ")).toBe(true);
    expect(isSmokeAuthEmail("qa+smoke@empresa.com")).toBe(true);
    expect(isSmokeAuthEmail("qa+SMOKE@Empresa.COM")).toBe(true);
    expect(isSmokeAuthEmail("balt@cavazos.com")).toBe(false);
    expect(isSmokeAuthEmail("smoke@empresa.com")).toBe(false);
    expect(isSmokeAuthEmail("qa+smoke-test@empresa.com")).toBe(false);
    expect(isSmokeAuthEmail("tester@auditapatron-smoke.test.evil.com")).toBe(false);
    expect(isSmokeAuthEmail("@auditapatron-smoke.test")).toBe(false);
  });

  it("nunca abre bypass si el flag está apagado", () => {
    delete process.env.SMOKE_AUTH;
    expect(isSmokeAuthEnabled()).toBe(false);
    expect(canUseSmokeAuth("tester@auditapatron-smoke.test")).toBe(false);
    expect(canUseSmokeAuth("qa+smoke@empresa.com")).toBe(false);
    expect(canUseSmokeAuth("balt@cavazos.com")).toBe(false);
    expect(shouldOpenSmokeTestSession("tester@auditapatron-smoke.test", "000000")).toBe(false);
  });

  it("con SMOKE_AUTH=1 solo deja pasar correos smoke", () => {
    process.env.SMOKE_AUTH = "1";
    expect(isSmokeAuthEnabled()).toBe(true);
    expect(canUseSmokeAuth("tester@auditapatron-smoke.test")).toBe(true);
    expect(canUseSmokeAuth("qa+smoke@empresa.com")).toBe(true);
    expect(canUseSmokeAuth("balt@cavazos.com")).toBe(false);
    expect(canUseSmokeAuth("otra.persona@empresa.com")).toBe(false);
    expect(shouldOpenSmokeTestSession("tester@auditapatron-smoke.test", "000000")).toBe(true);
    expect(shouldOpenSmokeTestSession("qa+smoke@empresa.com", "000000")).toBe(true);
    expect(shouldOpenSmokeTestSession("balt@cavazos.com", "000000")).toBe(false);
    expect(shouldOpenSmokeTestSession("tester@auditapatron-smoke.test", "111111")).toBe(false);
    expect(isSmokeAuthCode("000000")).toBe(true);
    expect(isSmokeAuthCode("111111")).toBe(false);
    expect(SMOKE_AUTH_CODE).toBe("000000");
  });
});

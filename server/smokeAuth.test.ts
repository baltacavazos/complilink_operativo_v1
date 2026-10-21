import { afterEach, describe, expect, it, vi } from "vitest";

import {
  canUseSmokeAuth,
  isSmokeAuthCode,
  isSmokeAuthEmail,
  isSmokeAuthEnabled,
  readConfiguredSmokeCode,
  shouldOpenSmokeTestSession,
  SMOKE_CODE_MIN_LENGTH,
} from "./smokeAuth";

const previousSmokeAuth = process.env.SMOKE_AUTH;
const previousSmokeCode = process.env.SMOKE_CODE;
const SMOKE_CODE_FIXTURE = "fixture-smoke-code-not-real";

describe("smoke auth allowlist", () => {
  afterEach(() => {
    if (previousSmokeAuth === undefined) delete process.env.SMOKE_AUTH;
    else process.env.SMOKE_AUTH = previousSmokeAuth;
    if (previousSmokeCode === undefined) delete process.env.SMOKE_CODE;
    else process.env.SMOKE_CODE = previousSmokeCode;
    vi.restoreAllMocks();
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

  it("nunca abre bypass si el flag está apagado, aunque el secreto exista", () => {
    delete process.env.SMOKE_AUTH;
    process.env.SMOKE_CODE = SMOKE_CODE_FIXTURE;
    expect(isSmokeAuthEnabled()).toBe(false);
    expect(canUseSmokeAuth("tester@auditapatron-smoke.test")).toBe(false);
    expect(canUseSmokeAuth("qa+smoke@empresa.com")).toBe(false);
    expect(canUseSmokeAuth("balt@cavazos.com")).toBe(false);
    expect(shouldOpenSmokeTestSession("tester@auditapatron-smoke.test", SMOKE_CODE_FIXTURE)).toBe(false);
  });

  it("con SMOKE_AUTH=1 y sin SMOKE_CODE el atajo no existe", () => {
    process.env.SMOKE_AUTH = "1";
    delete process.env.SMOKE_CODE;
    expect(isSmokeAuthEnabled()).toBe(true);
    expect(readConfiguredSmokeCode()).toBeNull();
    expect(canUseSmokeAuth("tester@auditapatron-smoke.test")).toBe(false);
    expect(shouldOpenSmokeTestSession("tester@auditapatron-smoke.test", SMOKE_CODE_FIXTURE)).toBe(false);
    expect(isSmokeAuthCode(SMOKE_CODE_FIXTURE)).toBe(false);
  });

  it("un SMOKE_CODE vacío o corto no abre el atajo", () => {
    process.env.SMOKE_AUTH = "1";
    process.env.SMOKE_CODE = "   ";
    expect(canUseSmokeAuth("tester@auditapatron-smoke.test")).toBe(false);

    process.env.SMOKE_CODE = "x".repeat(SMOKE_CODE_MIN_LENGTH - 1);
    expect(readConfiguredSmokeCode()).toBeNull();
    expect(shouldOpenSmokeTestSession("qa+smoke@empresa.com", process.env.SMOKE_CODE)).toBe(false);
  });

  it("con SMOKE_AUTH=1 y un secreto largo solo deja pasar correos smoke", () => {
    process.env.SMOKE_AUTH = "1";
    process.env.SMOKE_CODE = SMOKE_CODE_FIXTURE;
    expect(isSmokeAuthEnabled()).toBe(true);
    expect(canUseSmokeAuth("tester@auditapatron-smoke.test")).toBe(true);
    expect(canUseSmokeAuth("qa+smoke@empresa.com")).toBe(true);
    expect(canUseSmokeAuth("balt@cavazos.com")).toBe(false);
    expect(canUseSmokeAuth("otra.persona@empresa.com")).toBe(false);
    expect(shouldOpenSmokeTestSession("tester@auditapatron-smoke.test", SMOKE_CODE_FIXTURE)).toBe(true);
    expect(shouldOpenSmokeTestSession("qa+smoke@empresa.com", `  ${SMOKE_CODE_FIXTURE}  `)).toBe(true);
    expect(shouldOpenSmokeTestSession("balt@cavazos.com", SMOKE_CODE_FIXTURE)).toBe(false);
    expect(shouldOpenSmokeTestSession("tester@auditapatron-smoke.test", "otro-codigo-falso")).toBe(false);
    expect(isSmokeAuthCode(SMOKE_CODE_FIXTURE)).toBe(true);
    expect(isSmokeAuthCode("otro-codigo-falso")).toBe(false);
    expect(isSmokeAuthCode(SMOKE_CODE_FIXTURE.slice(0, -1))).toBe(false);
  });

  it("no escribe el código en los logs", () => {
    process.env.SMOKE_AUTH = "1";
    process.env.SMOKE_CODE = SMOKE_CODE_FIXTURE;
    const sinks = [console.log, console.info, console.warn, console.error, console.debug].map((method) =>
      vi.spyOn(console, method.name as "log").mockImplementation(() => undefined),
    );

    expect(shouldOpenSmokeTestSession("tester@auditapatron-smoke.test", "otro-codigo-falso")).toBe(false);
    expect(shouldOpenSmokeTestSession("tester@auditapatron-smoke.test", SMOKE_CODE_FIXTURE)).toBe(true);

    const dumped = sinks.flatMap((spy) => spy.mock.calls.flat().map((value) => String(value))).join("\n");
    expect(dumped).not.toContain(SMOKE_CODE_FIXTURE);
  });
});

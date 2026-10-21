import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));

describe("Access local password wiring", () => {
  it("includes LocalPasswordForm and local status endpoint", () => {
    const source = readFileSync(join(here, "AccessGate.tsx"), "utf8");
    expect(source).toContain("LocalPasswordForm");
    expect(source).toContain("/api/auth/local/status");
  });

  it("no conoce el código de humo y exige 8 caracteres a todos", () => {
    const source = readFileSync(join(here, "LocalPasswordForm.tsx"), "utf8");
    expect(source).not.toContain("isSmokeAuthCode");
    expect(source).not.toContain("isSmokeAuthEmail");
    expect(source).not.toContain("SMOKE_CODE");
    expect(source).toContain("password.length < 8");
    expect(source).not.toMatch(/SMOKE_AUTH|Manus|OTP|Helios|CompliLink/);
  });
});

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

  it("deja pasar el secreto de 6 dígitos solo en correos smoke", () => {
    const source = readFileSync(join(here, "LocalPasswordForm.tsx"), "utf8");
    expect(source).toContain("isSmokeAuthEmail");
    expect(source).toContain("isSmokeAuthCode");
    expect(source).toContain("smokeTestSecret");
    expect(source).not.toMatch(/SMOKE_AUTH|Manus|OTP|Helios|CompliLink/);
  });
});

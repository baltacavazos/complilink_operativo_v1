import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("auth service transactional trust copy", () => {
  const source = readFileSync(resolve(process.cwd(), "server/authService.ts"), "utf8");

  it("adds visible privacy and vault wording to the email access code message", () => {
    expect(source).toContain("Tu código de acceso a CompliLink");
    expect(source).toContain("Tu acceso es privado.");
    expect(source).toContain("asegurar evidencia");
    expect(source).toContain("Bóveda Laboral");
    expect(source).toContain("resguardo serio y visible");
  });
});

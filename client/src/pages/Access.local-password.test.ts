import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));

describe("Access local password wiring", () => {
  it("includes LocalPasswordForm and local status endpoint", () => {
    const source = readFileSync(join(here, "Access.tsx"), "utf8");
    expect(source).toContain("LocalPasswordForm");
    expect(source).toContain("/api/auth/local/status");
  });
});

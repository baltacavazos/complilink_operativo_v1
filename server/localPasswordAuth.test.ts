import { describe, expect, it } from "vitest";

import {
  MYSQL_BOOTSTRAP_STATEMENTS,
  hashPassword,
  normalizeEmail,
  openIdForEmail,
  verifyPassword,
} from "./localPasswordAuth";

describe("local password auth", () => {
  it("normalizes email and builds a stable openId", () => {
    expect(normalizeEmail("  Balt@Cavazos.com ")).toBe("balt@cavazos.com");
    expect(openIdForEmail("balt@cavazos.com")).toBe(openIdForEmail("  BALT@cavazos.com"));
    expect(openIdForEmail("balt@cavazos.com").startsWith("email:")).toBe(true);
    expect(openIdForEmail("balt@cavazos.com").length).toBeLessThanOrEqual(64);
  });

  it("hashes and verifies passwords", async () => {
    const stored = await hashPassword("secreto12");
    expect(stored.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("secreto12", stored)).toBe(true);
    expect(await verifyPassword("otra-clave", stored)).toBe(false);
  });

  it("bootstraps users and local_logins with MySQL backticks", () => {
    const sql = MYSQL_BOOTSTRAP_STATEMENTS.join("\n");
    expect(sql).toContain("`users`");
    expect(sql).toContain("`local_logins`");
    expect(sql).toContain("ENGINE=InnoDB");
    expect(sql).not.toContain("from 'users'");
  });
});

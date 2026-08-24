import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const homeSource = readFileSync(new URL("./pages/Home.tsx", import.meta.url), "utf8");

describe("landing footer brand", () => {
  it("uses the permanent official wordmark asset instead of generic or generated lettering", () => {
    expect(homeSource).toContain("src={AUDITAPATRON_LOGO_ASSETS.headerDark}");
    expect(homeSource).toContain("w-[220px] max-w-[70vw] object-contain object-left sm:w-[250px]");
    expect(homeSource).not.toContain("auditapatron-wordmark-footer-transparent");
    expect(homeSource).not.toContain(">\n\t              AUDITAPATRON\n\t            </span>");
  });
});

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readProjectFile(...segments: string[]) {
  return fs.readFileSync(path.join(process.cwd(), ...segments), "utf8");
}

describe("responsive layout regression guards", () => {
  it("keeps global overflow-x protection for mobile layouts", () => {
    const css = readProjectFile("client", "src", "index.css");

    expect(css).toContain("overflow-x: hidden");
    expect(css).toContain("#root");
  });

  it("keeps the mobile header CTA and wordmark constrained on Home", () => {
    const homeSource = readProjectFile("client", "src", "pages", "Home.tsx");

    expect(homeSource).toContain('max-w-[40vw]');
    expect(homeSource).toContain('max-w-[min(34vw,7.8rem)]');
    expect(homeSource).toContain('max-w-[8rem]');
    expect(homeSource).toContain('Sube foto o PDF');
  });

  it("keeps Auditar hero elements shrink-safe on mobile", () => {
    const auditarSource = readProjectFile("client", "src", "pages", "Auditar.tsx");

    expect(auditarSource).toContain('overflow-hidden rounded-[2rem]');
    expect(auditarSource).toContain('max-w-[min(62vw,13rem)]');
    expect(auditarSource).toContain('showTagline={false}');
    expect(auditarSource).toContain('whitespace-normal rounded-full');
    expect(auditarSource).toContain('className="flex min-w-0 items-start gap-3');
  });

  it("keeps the quick exit action compact on mobile", () => {
    const appSource = readProjectFile("client", "src", "App.tsx");

    expect(appSource).toContain('bottom-3 right-3');
    expect(appSource).toContain('sm:hidden">Salir<');
  });
});

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
    expect(homeSource).toContain('max-[359px]:max-w-[37vw]');
    expect(homeSource).toContain('max-w-[min(34vw,7.8rem)]');
    expect(homeSource).toContain('max-[359px]:max-w-[min(31vw,6.85rem)]');
    expect(homeSource).toContain('h-11 min-h-11 min-w-[6.75rem] max-w-[7.25rem]');
    expect(homeSource).toContain('Sube foto o PDF');
  });

  it("keeps Home optimized for sub-360px hero density and CTA spacing", () => {
    const homeSource = readProjectFile("client", "src", "pages", "Home.tsx");

    expect(homeSource).toContain('max-[359px]:text-[1.95rem]');
    expect(homeSource).toContain('max-[359px]:leading-[0.98]');
    expect(homeSource).toContain('max-[359px]:hidden');
    expect(homeSource).toContain('mt-8 flex flex-col gap-4 sm:flex-row');
    expect(homeSource).toContain('h-12 w-full rounded-full bg-teal-600 px-6 text-white hover:bg-teal-700 sm:w-auto');
    expect(homeSource).toContain('motion-hover-lift h-12 w-full rounded-full border-slate-200 bg-white px-7 text-base text-slate-700 hover:bg-slate-50 sm:w-auto');
  });

  it("keeps the quick exit action compact on mobile", () => {
    const appSource = readProjectFile("client", "src", "App.tsx");

    expect(appSource).toContain('bottom-3 right-3');
    expect(appSource).toContain('sm:hidden">Salir<');
  });
});

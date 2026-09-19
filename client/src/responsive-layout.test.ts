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
    expect(homeSource).toContain('max-[359px]:leading-[1.14]');
    expect(homeSource).not.toContain('max-[359px]:leading-[0.98]');
    expect(homeSource).toContain('max-[359px]:hidden');
    expect(homeSource).toContain('ap-hero-cta-row flex w-full flex-col items-stretch gap-3 sm:flex-row sm:items-center');
    expect(homeSource).toContain('h-12 w-full rounded-full bg-teal-600 px-6 text-white hover:bg-teal-700 sm:w-auto');
    expect(homeSource).toContain('motion-hover-lift h-11 w-full rounded-full border-slate-200 bg-transparent px-5 text-sm font-medium text-slate-600 hover:bg-white sm:w-auto');
  });

  it("keeps a single in-flow mobile back control instead of a floating exit", () => {
    const appSource = readProjectFile("client", "src", "App.tsx");
    const shellSource = readProjectFile("client", "src", "components", "MobileAppShell.tsx");

    expect(appSource).not.toContain("fixed bottom-3 right-3");
    expect(appSource).not.toContain(">Salir<");
    expect(appSource).toContain("path === \"/auditar\"");
    expect(appSource).toMatch(/>\s*Volver\s*</);
    expect(shellSource).toMatch(/>\s*Volver\s*</);
    expect(shellSource).toContain('data-testid="mobile-header-back"');
    expect(shellSource).not.toContain("sticky top-3 z-40");
    expect(shellSource).not.toContain("inline-flex shrink-0 items-center rounded-full bg-slate-950 px-3 py-1.5");
  });
});

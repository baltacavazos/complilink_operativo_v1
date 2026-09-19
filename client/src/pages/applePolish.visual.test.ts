import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(currentDir, "../../..");

function readRepoFile(...segments: string[]) {
  return readFileSync(resolve(repoRoot, ...segments), "utf8");
}

const forbiddenClientStrings = ["CompliLink", "Helios", "Webhook"];

describe("Apple tip #3 — pulido visual", () => {
  it("mejora el contraste de los paneles de resultado en /auditar", () => {
    const css = readRepoFile("client", "src", "index.css");

    expect(css).toContain('[data-testid="auditar-verdict-panel"] [class*="text-slate-400"]');
    expect(css).toContain('[data-testid="auditar-result-reveal"] [class*="text-slate-400"]');
    expect(css).toContain("background-color: var(--ap-panel-bg-strong) !important");
    expect(css).toContain("--ap-text-muted: rgb(203 213 225)");
    expect(css).toContain("color: rgb(51 65 85)");
    expect(css).toContain("color: rgb(226 232 240) !important");
  });

  it("pasa las pastillas uppercase tracking a minúsculas de oración", () => {
    const css = readRepoFile("client", "src", "index.css");

    expect(css).toContain('.uppercase[class*="tracking-"]');
    expect(css).toContain("text-transform: none !important");
    expect(css).toContain("letter-spacing: 0.01em !important");
    expect(css).toContain(".audita-home");
    expect(css).toContain(".audita-access");
    expect(css).toContain(".audita-auditar");
  });

  it("deja un solo peso visual primario en los CTA del hero de Home", () => {
    const home = readRepoFile("client", "src", "pages", "Home.tsx");

    expect(home).toContain("ap-hero-cta-row");
    expect(home).toContain(
      "h-12 w-full rounded-full bg-teal-600 px-6 text-white hover:bg-teal-700 sm:w-auto",
    );
    expect(home).toContain(
      "motion-hover-lift h-11 w-full rounded-full border-slate-200 bg-transparent px-5 text-sm font-medium text-slate-600 hover:bg-white sm:w-auto",
    );
    expect(home).not.toContain(
      "motion-hover-lift h-12 w-full rounded-full border-slate-200 bg-white px-7 text-base text-slate-700 hover:bg-slate-50 sm:w-auto",
    );
  });

  it("usa copy calmado en la bóveda vacía y oculta ids de depuración", () => {
    const auditar = readRepoFile("client", "src", "pages", "Auditar.tsx");

    expect(auditar).toContain("Todavía no hay documentos resguardados. Cuando guardes el");
    expect(auditar).toContain("primero, quedará aquí para consultarlo con calma.");
    expect(auditar).toContain("stripWorkerDebugIds");
    expect(auditar).toContain("\\bap\\.pol");
    expect(auditar).not.toContain("Aún no tienes documentos en tu bóveda laboral. Puedes");

    const vaultCopy = auditar.slice(
      auditar.indexOf("Todavía no hay documentos resguardados"),
      auditar.indexOf("Todavía no hay documentos resguardados") + 280,
    );
    for (const forbidden of forbiddenClientStrings) {
      expect(vaultCopy).not.toContain(forbidden);
    }
  });

  it("expone favicon local de AuditaPatrón además de las rutas de almacenamiento", () => {
    const html = readRepoFile("client", "index.html");
    const manifest = readRepoFile("client", "public", "site.webmanifest");
    const favicon = readRepoFile("client", "public", "favicon.svg");

    expect(html).toContain('href="/favicon.svg"');
    expect(manifest).toContain('"/favicon.svg"');
    expect(favicon).toContain("AuditaPatron");
    expect(favicon).toContain("#143c86");
  });
});

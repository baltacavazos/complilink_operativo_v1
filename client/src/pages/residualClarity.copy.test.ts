import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));
const clientSrc = resolve(currentDir, "..");

function readClientSource(relativePath: string) {
  return readFileSync(resolve(clientSrc, relativePath), "utf8");
}

describe("claridad residual AuditaPatrón", () => {
  it("deja un solo Volver de cabecera en móvil y no flota sobre el contenido", () => {
    const app = readClientSource("App.tsx");
    const shell = readClientSource("components/MobileAppShell.tsx");
    const accessGate = readClientSource("pages/AccessGate.tsx");
    const papers = readClientSource("pages/PapersPlaceholder.tsx");
    const auditar = readClientSource("pages/Auditar.tsx");

    expect(app).toContain("MobileQuickExit");
    expect(app).not.toContain("fixed bottom-3 right-3");
    expect(app).toContain('path === "/auditar"');
    expect(app).toMatch(/>\s*Volver\s*</);
    expect(shell).toContain('data-testid="mobile-header-back"');
    expect(shell).toContain("Volver");
    expect(shell).not.toContain("sticky top-3 z-40");
    expect(shell).not.toContain("inline-flex shrink-0 items-center rounded-full bg-slate-950 px-3 py-1.5");
    expect(accessGate).toContain('data-testid="mobile-header-back"');
    expect(accessGate).toContain("hidden justify-center sm:flex");
    expect(papers).toContain('data-testid="mobile-header-back"');
    expect(papers).toContain("hidden items-center justify-center gap-2 text-sm font-medium text-slate-600 sm:inline-flex");
    expect(auditar).toContain("Ver tu expediente");
    expect(auditar).not.toContain('"Volver al expediente"');
  });

  it("no muestra handles de smoke como chrome de producto", () => {
    const dashboard = readClientSource("components/DashboardLayout.tsx");
    const auditar = readClientSource("pages/Auditar.tsx");
    const ceo = readClientSource("pages/CeoDashboard.tsx");

    expect(dashboard).toContain("formatWorkerAccountChrome");
    expect(dashboard).toContain("accountChrome.title");
    expect(dashboard).not.toContain("{realUser?.name || user?.name || \"Usuario\"}");
    expect(auditar).toContain("formatWorkerVisibleAccountName(tenant.displayName)");
    expect(ceo).toContain("formatWorkerAccountChrome({ name: user?.name, email: user?.email }).title");
  });

  it("explica 0 de 5 documentos en español llano", () => {
    const auditar = readClientSource("pages/Auditar.tsx");

    expect(auditar).toContain("0 de 5 documentos · Estás empezando");
    expect(auditar).toContain("formatDossierProgressCopy");
    expect(auditar).toContain("Estás empezando");
    expect(auditar).not.toContain('"Base inicial"');
    expect(auditar).not.toContain("{dossierStatus.completed}/{dossierStatus.total}");
  });
});

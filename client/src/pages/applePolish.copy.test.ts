import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));
const clientSrc = resolve(currentDir, "..");

function readClientSource(relativePath: string) {
  return readFileSync(resolve(clientSrc, relativePath), "utf8");
}

function visibleCopySurface(source: string) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^\s*\/\/.*$/gm, " ")
    .replace(/`[^`]*complilink[^`]*`/gi, " ")
    .replace(/["'][^"']*complilink[^"']*["']/gi, " ");
}

const KEY_CLIENT_PAGES = [
  "pages/Home.tsx",
  "pages/Auditar.tsx",
  "pages/Access.tsx",
  "pages/Payments.tsx",
  "pages/CeoDashboard.tsx",
  "pages/LegalDocuments.tsx",
  "components/DashboardLayout.tsx",
  "components/MobileAppShell.tsx",
  "App.tsx",
] as const;

describe("AuditaPatrón Apple polish · separación de marca", () => {
  it("no muestra CompliLink en el copy de las páginas cliente principales", () => {
    for (const relativePath of KEY_CLIENT_PAGES) {
      const source = readClientSource(relativePath);
      expect(source, relativePath).not.toContain("CompliLink");
      expect(source, relativePath).not.toContain("CompliLink Operativo");
    }
  });

  it("no deja Manus, Forge, APIMarket ni Forensic en copy visible de chrome y flujos clave", () => {
    const surfaces = [
      readClientSource("components/DashboardLayout.tsx"),
      readClientSource("components/ManusDialog.tsx"),
      readClientSource("pages/Access.tsx"),
      readClientSource("pages/Auditar.tsx"),
      readClientSource("pages/Home.tsx"),
    ];

    for (const source of surfaces) {
      expect(source).not.toContain("Inicia sesión con Manus");
      expect(source).not.toContain("Continuar con Manus");
      expect(source).not.toContain("APIMarket");
      expect(source).not.toContain("Forensic");
      expect(visibleCopySurface(source)).not.toMatch(/\bForge\b/);
    }
  });

  it("mantiene AuditaPatron/AuditaPatrón como marca de chrome y no CompliLink Operativo", () => {
    const indexHtml = readFileSync(resolve(clientSrc, "../index.html"), "utf8");
    const dashboard = readClientSource("components/DashboardLayout.tsx");
    const app = readClientSource("App.tsx");

    expect(indexHtml).toContain("AuditaPatron · Conoce tus derechos");
    expect(indexHtml).not.toContain("CompliLink");
    expect(dashboard).toContain("AuditaPatron");
    expect(dashboard).not.toContain("CompliLink Operativo");
    expect(app).toContain("AuditaPatronLogo");
  });

  it("deja estados vacíos honestos con una acción clara en /auditar", () => {
    const auditar = readClientSource("pages/Auditar.tsx");
    expect(auditar).toContain("Aún no tienes documentos en tu bóveda laboral");
    expect(auditar).toContain("Subir mi primer documento");
    expect(auditar).toContain("Ver toda la bóveda");
    expect(auditar).toContain("focusRecommendedUpload()");
  });

  it("usa el sanitizador central en Home, Auditar y el panel conversacional", () => {
    expect(readClientSource("pages/Home.tsx")).toContain("sanitizeClientVisibleCopy");
    expect(readClientSource("pages/Auditar.tsx")).toContain("sanitizeClientVisibleCopy");
    expect(readClientSource("components/HeliosCopilotSheet.tsx")).toContain(
      "sanitizeClientVisibleCopy",
    );
    expect(readClientSource("lib/clientVisibleCopy.ts")).toContain("sanitizeClientVisibleCopy");
  });
});

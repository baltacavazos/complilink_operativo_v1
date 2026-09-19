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
  "components/HeliosCopilotSheet.tsx",
  "App.tsx",
] as const;

const WORKER_PAGES = [
  "pages/Home.tsx",
  "pages/Auditar.tsx",
  "pages/Access.tsx",
  "pages/Payments.tsx",
  "pages/LegalDocuments.tsx",
  "components/MobileAppShell.tsx",
  "lib/pricingExperience.ts",
  "App.tsx",
] as const;

describe("AuditaPatrón Apple polish · separación de marca", () => {
  it("no muestra CompliLink en el copy de las páginas cliente principales", () => {
    for (const relativePath of KEY_CLIENT_PAGES) {
      const source = readClientSource(relativePath);
      expect(source, relativePath).not.toContain("CompliLink");
      expect(source, relativePath).not.toContain("CompliLink Operativo");
      expect(visibleCopySurface(source), relativePath).not.toMatch(/complilink/i);
    }
  });

  it("falla si Helios queda visible en rutas de trabajador", () => {
    for (const relativePath of WORKER_PAGES) {
      const visible = visibleCopySurface(readClientSource(relativePath));
      expect(visible, relativePath).not.toMatch(/\bHelios\b/);
    }

    const ceo = readClientSource("pages/CeoDashboard.tsx");
    expect(ceo).not.toContain("Preguntar a Helios");
    expect(visibleCopySurface(ceo)).not.toMatch(/["'`][^"'`]*\bHelios\b[^"'`]*["'`]/);
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
    expect(auditar).toContain('className="mt-4 rounded-full bg-teal-600 text-white hover:bg-teal-700"');
    expect(auditar).toContain('text-xs font-semibold tracking-tight text-emerald-800">Señal inicial');
    expect(auditar).not.toContain(
      'text-xs font-semibold uppercase tracking-[0.16em] text-emerald-800">Señal inicial',
    );
    expect(auditar).toContain('label: "Bien"');
    expect(auditar).toContain('label: "Atención"');
    expect(auditar).toContain('label: "Crítico"');
    expect(auditar).not.toContain('label: "Riesgo crítico"');
    expect(auditar).not.toContain("complilinkMonitoring");
  });

  it("oculta el chrome CEO cuando la sesión no es admin", () => {
    const ceo = readClientSource("pages/CeoDashboard.tsx");
    expect(ceo).toContain("if (!isAdmin) {\n    return (");
    expect(ceo.indexOf("if (!isAdmin) {\n    return (")).toBeLessThan(ceo.indexOf("<DashboardLayout"));
    expect(ceo).toContain("Preguntar al asesor laboral");
    expect(ceo).not.toContain("Preguntar a Helios");
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

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

function auditarClientFacingRenderPaths(source: string) {
  const withoutComments = visibleCopySurface(source);
  return [...withoutComments.matchAll(/(["'])([^"'`\n]{3,220})\1/g)]
    .map((match) => match[2])
    .filter((text) => /\s/.test(text) && /[A-ZÁÉÍÓÚÑáéíóúñ]/.test(text))
    .join("\n");
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

  it("deja el CTA de /auditar como documento y el aviso sugerido legible", () => {
    const auditar = readClientSource("pages/Auditar.tsx");
    expect(auditar).toContain('const UPLOAD_PRIMARY_EMPTY_LABEL = "Sube tu documento"');
    expect(auditar).toContain("Cambiar documento");
    expect(auditar).not.toContain("Cambiar recibo");
    expect(auditar).toContain("ap-suggested-document");
    expect(auditar).toContain('data-testid="auditar-suggested-document"');
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

    expect(indexHtml).toContain("AuditaPatrón · Conoce tus derechos");
    expect(indexHtml).toContain('<html lang="es">');
    expect(indexHtml).not.toContain("CompliLink");
    expect(dashboard).toContain("AuditaPatron");
    expect(dashboard).not.toContain("CompliLink Operativo");
    expect(app).toContain("AuditaPatronLogo");
  });

  it("deja estados vacíos honestos con una acción clara en /auditar", () => {
    const auditar = readClientSource("pages/Auditar.tsx");
    expect(auditar).toContain("Todavía no hay documentos resguardados");
    expect(auditar).toContain("Subir mi primer documento");
    expect(auditar).toContain("Ver toda la bóveda");
    expect(auditar).toContain("focusRecommendedUpload()");
    expect(auditar).toContain('className="mt-4 rounded-full bg-teal-600 text-white hover:bg-teal-700"');
    expect(auditar).toContain('text-sm font-semibold tracking-tight text-emerald-900">Resultado inicial');
    expect(auditar).toContain('label: "Bien"');
    expect(auditar).toContain('label: "Atención"');
    expect(auditar).toContain('label: "Crítico"');
    expect(auditar).not.toContain('label: "Riesgo crítico"');
    expect(auditar).not.toContain("complilinkMonitoring");
    expect(auditar).toContain("Revisa esto primero");
    expect(auditar).toContain("Todo en orden por ahora");
    expect(auditar).toContain("El resultado es la primera lectura de tu documento: qué ya se entiende y qué conviene revisar.");
    expect(auditar).toContain("Asesor laboral");
    expect(auditar).toContain("Preguntar al asesor");
    expect(auditar).toContain("Lo que sí se sabe");
    expect(auditar).toContain("Lo que falta");
    expect(auditar).toContain("Siguiente paso");
    expect(auditar).not.toContain("Abrir asesor laboral");
    expect(auditar).not.toContain("Modo Helios");
    expect(auditar).not.toContain("Modo asesor");
    expect(auditar).not.toContain("Modo del asesor");
    expect(auditar).toContain("No pudimos recibir el aviso.");
  });

  it("deja /auditar sin Helios, CompliLink ni Webhook en copy que se renderiza", () => {
    const auditar = readClientSource("pages/Auditar.tsx");
    const renderPaths = auditarClientFacingRenderPaths(auditar);

    expect(renderPaths).not.toMatch(/\bHelios\b/);
    expect(renderPaths).not.toMatch(/CompliLink|complilink/);
    expect(renderPaths).not.toMatch(/\bWebhook\b/);
    expect(renderPaths).not.toMatch(/\bwebhook\b/);
    expect(auditar).not.toMatch(/>\s*Webhook\b/);
    expect(auditar).not.toContain("Webhook ");
    expect(auditar).not.toMatch(/["'`][^"'`]*\bWebhook\b[^"'`]*["'`]/);
  });

  it("oculta el chrome CEO cuando la sesión no es admin", () => {
    const ceo = readClientSource("pages/CeoDashboard.tsx");
    expect(ceo).toContain("if (!isAdmin) {\n    return (");
    expect(ceo.indexOf("if (!isAdmin) {\n    return (")).toBeLessThan(ceo.indexOf("<DashboardLayout"));
    expect(ceo).toContain("Preguntar al asesor laboral");
    expect(ceo).not.toContain("Preguntar a Helios");
    expect(ceo).not.toContain("Helios · modo CEO");
  });

  it("limpia /acceso, NotFound y el sandbox de /auditar para el trabajador", () => {
    const access = readClientSource("pages/AccessGate.tsx");
    const password = readClientSource("pages/LocalPasswordForm.tsx");
    const notFound = readClientSource("pages/NotFound.tsx");
    const auditar = readClientSource("pages/Auditar.tsx");
    const home = readClientSource("pages/Home.tsx");

    expect(access).not.toContain("Copia temporal para pruebas");
    expect(access).not.toContain("otra plataforma");
    expect(password).not.toContain("otra plataforma");
    expect(password).not.toContain("En esta copia");
    expect(notFound).toContain("Página no encontrada");
    expect(notFound).toContain("Ir al inicio");
    expect(notFound).not.toContain("Pronto verás aquí tus papeles");
    expect(notFound).not.toContain("Page Not Found");
    expect(notFound).not.toContain("Go Home");
    expect(notFound).not.toContain("text-4xl font-bold text-slate-900 mb-2\">404");

    const papers = readClientSource("pages/PapersPlaceholder.tsx");
    expect(papers).toContain("Lo que ya revisaste");
    expect(papers).not.toContain("Tus documentos siguen en tu revisión");
    expect(papers).toContain("Aún no hay revisiones guardadas");
    expect(papers).toContain("Aquí verás cada documento que confirmes y el resultado de esa revisión");
    expect(papers).toContain("Ir a mi revisión");
    expect(papers).not.toContain("Pronto verás");
    expect(papers).not.toContain("todavía no está lista");
    expect(papers).not.toContain("Page Not Found");
    expect(papers).not.toContain("Página no encontrada");
    expect(papers).not.toMatch(/\bHelios\b/);
    expect(papers).not.toMatch(/CompliLink|complilink/);
    expect(auditar).toContain("{auth.canToggleUserView ? (\n              <article");
    expect(auditar).toContain("Conversión de esta sesión");
    expect(auditar).toContain("{auth.canToggleUserView ? (\n            <article");
    expect(auditar).toContain("Validación sandbox");
    expect(home).toContain(
      "rounded-full bg-teal-50 px-3 py-1 text-[11px] font-semibold tracking-tight text-teal-700",
    );
    expect(home).not.toContain(
      "rounded-full bg-teal-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-700",
    );
  });

  it("cierra claridad y confianza en /auditar, /pagos y legales", () => {
    const auditar = readClientSource("pages/Auditar.tsx");
    const payments = readClientSource("pages/Payments.tsx");
    const legal = readClientSource("pages/LegalDocuments.tsx");
    const app = readClientSource("App.tsx");
    const papers = readClientSource("pages/PapersPlaceholder.tsx");
    const sanitizer = readClientSource("lib/clientVisibleCopy.ts");

    expect(auditar).not.toContain("Tu jefe nunca se enterará");
    expect(auditar).not.toContain("Folio {item.caseId.slice(-6)}");
    expect(auditar).toContain("Esta revisión es para ti. No compartimos tu archivo con tu empresa.");
    expect(auditar).toContain("{legalGateHarnessMode ? (");
    expect(auditar).toContain("data-testid=\"legal-gate-lock-metrics\"");
    expect(auditar).toContain("humanizeWorkerVisibleScalar");
    expect(auditar).toContain("sanitizePreviewText(field.value");
    expect(payments).not.toContain("Stripe");
    expect(payments).not.toContain("persistencia local");
    expect(payments).not.toContain("Checkout:");
    expect(payments).not.toContain("Invoice:");
    expect(payments).not.toContain("Payment Intent");
    expect(payments).toContain("La primera lectura es gratis. Solo pagas si quieres más documentos o un entregable extra.");
    expect(legal).toContain("LEGAL_CONTROLLER_NAME");
    expect(legal).toContain("LEGAL_CONTROLLER_ADDRESS");
    expect(legal).not.toContain("La identidad legal del responsable y el domicilio se publicarán antes del lanzamiento comercial definitivo.");
    expect(legal).not.toContain("Nadie de tu empresa puede ver lo que subes.");
    expect(app).toContain('path={"/historial"}');
    expect(app).toContain("PapersPlaceholder");
    expect(app).toContain('path={"/expediente"}');
    expect(app).not.toContain('path={"/historial"} component={NotFound}');
    const vite = readFileSync(resolve(clientSrc, "../../server/_core/vite.ts"), "utf8");
    expect(vite).toContain('app.get("/historial", sendSpaIndex)');
    expect(vite).toContain('app.get("/expediente", sendSpaIndex)');
    expect(vite).toContain("Worker placeholder routes must never fall through to an English host 404.");
    expect(auditar).toContain("lastUploadRiskCopy.label");
    expect(auditar).not.toContain("Resultado listo");
    expect(payments).not.toContain("Historial comercial");
    expect(payments).toContain("Tu plan y lo que ya pagaste");
    expect(payments).toContain("Aquí verás tus pagos");
    expect(payments).not.toContain("Lista para tus cobros");
    expect(payments).not.toContain("Tus cobros");
    expect(app).toContain("Volver al inicio");
    expect(app).toContain('path === "/auditar"');
    expect(app).toContain('path === "/pagos"');
    expect(app).toContain('path.startsWith("/legal")');
    expect(app).toContain('path.startsWith("/ceo")');
    expect(app).not.toContain("fixed top-3 right-3");
    expect(app).not.toContain("fixed bottom-4 left-4");
    expect(app).not.toContain(">Salir<");
    expect(app).toMatch(/>\s*Volver\s*</);
    expect(auditar).toContain('text-xl font-semibold tracking-[-0.03em] text-slate-950');
    expect(auditar).toContain("La confirmación aparece justo cuando envías o guardas tu");
    expect(auditar).toContain('data-testid="auditar-legal-confirmation"');
    expect(papers).not.toContain("Tus documentos siguen en tu revisión");
    expect(papers).not.toContain("Esta sección todavía no está lista");
    expect(sanitizer).toContain("CompliLink");
    expect(sanitizer).toContain("Helios");
  });

  it("usa el sanitizador central en Home, Auditar y el panel conversacional", () => {
    expect(readClientSource("pages/Home.tsx")).toContain("sanitizeClientVisibleCopy");
    expect(readClientSource("pages/Auditar.tsx")).toContain("sanitizeClientVisibleCopy");
    expect(readClientSource("components/HeliosCopilotSheet.tsx")).toContain(
      "sanitizeClientVisibleCopy",
    );
    expect(readClientSource("lib/clientVisibleCopy.ts")).toContain("sanitizeClientVisibleCopy");
  });

  it("Home no renderiza la frase exacta de Helios del expediente", () => {
    const home = readClientSource("pages/Home.tsx");
    const auditar = readClientSource("pages/Auditar.tsx");

    expect(home).not.toContain(
      "Helios ya conectó documentos del expediente y está devolviendo una lectura preliminar",
    );
    expect(home).toContain("sanitizeHomeVisibleCopy(example.summary)");
    expect(home).toContain("sanitizeHomeVisibleCopy(homeSnapshotQuery.data.latestCase.summary)");
    expect(auditar).toContain("warmVisibleNamingCopy(heliosExpediente?.summary)");
  });
});

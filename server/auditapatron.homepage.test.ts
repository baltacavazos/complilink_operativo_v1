import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Auditapatron homepage and audit flow content", () => {
  const homeSource = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");
  const auditFlowSource = readFileSync(resolve(process.cwd(), "client/src/pages/Auditar.tsx"), "utf8");
  const appSource = readFileSync(resolve(process.cwd(), "client/src/App.tsx"), "utf8");

  it("shows an urgent worker-centered value proposition that also reinforces immediate control", () => {
    expect(homeSource).toContain("Podrías estar perdiendo dinero o derechos");
    expect(homeSource).toContain("y ni siquiera lo sabes.");
    expect(homeSource).toContain("Revísalo hoy y toma control de tu historial laboral.");
    expect(homeSource).toContain("detectar señales de riesgo en nómina, CFDI y documentos clave");
    expect(homeSource).toContain("El documento que ya tengas más a la mano siempre puede servir.");
    expect(homeSource).toContain("Control y claridad desde tu primer archivo");
    expect(homeSource).not.toContain("CompliLink Operativo");
  });

  it("keeps the educational journey and routes the main CTA to the audit workspace", () => {
    expect(homeSource).toContain("Sube tu documento y AuditaPatron lo recibe");
    expect(homeSource).toContain("AuditaPatron te devuelve hallazgos claros");
    expect(homeSource).toContain("Tu expediente se fortalece con AuditaPatron");
    expect(homeSource).toContain("AuditaPatron lo analiza y lo guarda en tu expediente");
    expect(homeSource).toContain("Ves qué se entendió, qué conviene revisar y mantienes tus documentos y resultados disponibles 24/7");
    expect(homeSource).toContain('window.location.href = "/auditar"');
    expect(appSource).toContain('Route path={"/auditar"} component={Auditar}');
  });

  it("preserves trust, privacy and guided FAQs while keeping Helios out of the public homepage copy", () => {
    expect(homeSource).toContain("Ya entendí mejor qué revisar primero.");
    expect(homeSource).toContain("Ver qué documento subir primero");
    expect(homeSource).toContain("Guía rápida para empezar");
    expect(homeSource).toContain("Mini prediagnóstico guiado");
    expect(homeSource).toContain("Resultado instantáneo");
    expect(homeSource).toContain("Carrusel de hallazgos laborales resumidos");
    expect(homeSource).toContain("Tu recibo de nómina más reciente o un CFDI del mismo periodo");
    expect(homeSource).toContain("Un recibo reciente o tu contrato actual");
    expect(homeSource).not.toContain("Sube tu documento y Helios lo recibe");
    expect(homeSource).not.toContain("Helios te devuelve hallazgos claros");
  });

  it("includes the new hero instrumentation for variant changes, scroll depth and finding navigation", () => {
    expect(homeSource).toContain("audipatron_hero_variant_changed");
    expect(homeSource).toContain("audipatron_hero_scroll_depth_reached");
    expect(homeSource).toContain("audipatron_hero_finding_changed");
    expect(homeSource).toContain("audipatron_hero_finding_viewed");
  });

  it("ships an audit workspace with dynamic expediente clarity and revalidation for IMSS and Infonavit", () => {
    expect(auditFlowSource).toContain("Hecho para trabajadores, sin lenguaje complicado");
    expect(auditFlowSource).toContain("AuditaPatron recibe tu documento, lo analiza, lo resguarda y te devuelve resultados útiles.");
    expect(auditFlowSource).toContain("Así va tu expediente laboral");
    expect(auditFlowSource).toContain("un indicador vivo que se ajusta con señales reales del expediente");
    expect(auditFlowSource).toContain("Cruce IMSS e Infonavit hoy");
    expect(auditFlowSource).toContain("Claridad actual del expediente");
    expect(auditFlowSource).toContain("Revalidar IMSS e Infonavit");
    expect(auditFlowSource).toContain("Aún no has revalidado este cruce desde tu expediente.");
    expect(auditFlowSource).toContain("AuditaPatron concentra la información que subes, analiza cada documento, lo resguarda en tu expediente digital y te devuelve resultados útiles para entender mejor tu situación laboral, incluyendo señales sobre IMSS e Infonavit");
    expect(auditFlowSource).toContain("Confirmar y guardar documento");
    expect(auditFlowSource).not.toContain("Helios-first, para trabajadores y sin lenguaje complicado");
    expect(auditFlowSource).not.toContain("Helios recibe tu documento, lo analiza, lo resguarda y te devuelve resultados útiles dentro de AuditaPatron.");
    expect(auditFlowSource).not.toContain("CompliLink Operativo");
  });

  it("simplifies the first mobile upload touchpoint with a camera-first entry and stronger expediente value copy", () => {
    expect(auditFlowSource).toContain("const isFirstDocumentFlow = documents.length === 0 && !pendingDraft && !lastUpload;");
    expect(auditFlowSource).toContain("Sube tu primer documento");
    expect(auditFlowSource).toContain("Toma foto para empezar");
    expect(auditFlowSource).toContain("Cada documento que agregas fortalece tu expediente");
    expect(auditFlowSource).toContain("Abriremos primero la cámara para que empieces en un solo toque.");
  });
});

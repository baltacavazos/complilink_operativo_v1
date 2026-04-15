import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Auditapatron homepage and audit flow content", () => {
  const homeSource = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");
  const auditFlowSource = readFileSync(resolve(process.cwd(), "client/src/pages/Auditar.tsx"), "utf8");
  const appSource = readFileSync(resolve(process.cwd(), "client/src/App.tsx"), "utf8");
  const pricingSource = readFileSync(resolve(process.cwd(), "client/src/lib/pricingExperience.ts"), "utf8");
  const heliosSheetSource = readFileSync(resolve(process.cwd(), "client/src/components/HeliosCopilotSheet.tsx"), "utf8");

  it("shows a clearer worker-centered value proposition focused on document auditing", () => {
    expect(homeSource).toContain("Sube un documento laboral");
    expect(homeSource).toContain("y recibe una auditoría clara.");
    expect(homeSource).toContain("getAuditapatronPricingExperience(0)");
    expect(pricingSource).toContain("Prueba gratis y con claridad desde el inicio");
    expect(pricingSource).toContain("Puedes seguir usando la auditoría y tu expediente sin pagar ni desbloquear nada por obligación.");
    expect(homeSource).toContain("Sube un recibo, contrato o CFDI y recibe hallazgos claros con el siguiente paso sugerido.");
    expect(homeSource).toContain("AuditaPatron empieza a leer y ordenar solo");
    expect(homeSource).toContain("Recibes primero lo más importante");
    expect(homeSource).toContain("Empieza con el documento correcto");
    expect(homeSource).toContain("Sin reunir todo de una vez");
    expect(homeSource).not.toContain("CompliLink Operativo");
  });

  it("keeps the educational journey in 3 steps and routes the main CTA to the audit workspace", () => {
    expect(homeSource).toContain("Sube tu documento y AuditaPatron lo recibe");
    expect(homeSource).toContain("AuditaPatron te devuelve hallazgos claros");
    expect(homeSource).toContain("Tu expediente se fortalece con AuditaPatron");
    expect(homeSource).toContain("Sube tu documento ahora.");
    expect(homeSource).toContain("Sube desde tu celular y recibe claridad útil desde el inicio.");
    expect(homeSource).toContain('bullets: ["Desde tu celular"]');
    expect(homeSource).toContain("Hallazgos claros prioritarios.");
    expect(homeSource).toContain("Breves y urgentes primero.");
    expect(homeSource).toContain("Fortalece expediente con contexto.");
    expect(homeSource).toContain("Tus documentos se convierten en expediente con más contexto para ordenar y comparar resultados.");
    expect(homeSource).toContain("Más contexto con cada archivo.");
    expect(homeSource).toContain("Privacidad y control visibles.");
    expect(homeSource).toContain("Empieza con el documento correcto");
    expect(homeSource).toContain("Primer documento sugerido");
    expect(homeSource).toContain("Continúa con tu primera auditoría");
    expect(homeSource).toContain('window.location.href = "/auditar"');
    expect(appSource).toContain('Route path={"/auditar"} component={Auditar}');
  });

  it("preserves trust, privacy and guided FAQs while keeping Helios out of the public homepage copy", () => {
    expect(homeSource).toContain("Ya entendí mejor qué revisar primero.");
    expect(homeSource).toContain("Ver cómo se ve mi reporte");
    expect(homeSource).toContain("Guía rápida para empezar");
    expect(homeSource).toContain("Vista previa del reporte que recibes");
    expect(homeSource).toContain("Un ejemplo simple de cómo AuditaPatron traduce tu documento en hallazgos accionables.");
    expect(homeSource).toContain("Puedes recorrer estados reales: documento recibido, hallazgo preliminar y siguiente paso sugerido.");
    expect(homeSource).toContain("Caso anónimo 01");
    expect(homeSource).toContain("Señal verificada en pruebas de comprensión");
    expect(homeSource).toContain("Tu privacidad es parte del producto");
    expect(homeSource).toContain("Tus documentos se resguardan para darte claridad y tranquilidad desde el inicio.");
    expect(homeSource).toContain("Tu recibo de nómina más reciente o un CFDI del mismo periodo");
    expect(homeSource).toContain("Un recibo reciente o tu contrato actual");
    expect(homeSource).not.toContain("Sube tu documento y Helios lo recibe");
    expect(homeSource).not.toContain("Helios te devuelve hallazgos claros");
  });

  it("includes the new hero instrumentation for variant changes, scroll depth, report states and finding navigation", () => {
    expect(homeSource).toContain("audipatron_hero_variant_changed");
    expect(homeSource).toContain("audipatron_hero_scroll_depth_reached");
    expect(homeSource).toContain("audipatron_hero_finding_changed");
    expect(homeSource).toContain("audipatron_hero_finding_viewed");
    expect(homeSource).toContain("audipatron_report_demo_state_selected");
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
    expect(auditFlowSource).toContain("AuditaPatron recibe tu documento, lo analiza, lo resguarda y te devuelve resultados útiles.");
    expect(auditFlowSource).toContain("Sube tu primer archivo y recibe una lectura útil al momento.");
    expect(auditFlowSource).toContain("Sube un documento y revisa el borrador");
    expect(auditFlowSource).toContain("La carga empieza sola. Tú decides si se guarda.");
    expect(auditFlowSource).toContain("Confirmar y guardar documento");
    expect(auditFlowSource).toContain("getAuditapatronPricingExperience(documents.length)");
    expect(auditFlowSource).toContain("pricingExperience.platform.priceLabel");
    expect(auditFlowSource).toContain("Cerrar y seguir gratis");
    expect(pricingSource).toContain("Preparación guiada de tu siguiente paso laboral");
    expect(pricingSource).toContain("$199 MXN pago único");
    expect(auditFlowSource).not.toContain("Helios-first, para trabajadores y sin lenguaje complicado");
    expect(auditFlowSource).not.toContain("Helios recibe tu documento, lo analiza, lo resguarda y te devuelve resultados útiles dentro de AuditaPatron.");
    expect(auditFlowSource).not.toContain("CompliLink Operativo");
  });

  it("keeps the first homepage block more mobile-efficient and surfaces the primary CTA earlier", () => {
    expect(homeSource).toContain("order-3 mt-5 hidden w-full max-w-xl");
    expect(homeSource).toContain("hidden motion-hover-lift h-10 border-transparent bg-transparent");
    expect(homeSource).toContain("order-2 mt-4 flex w-full max-w-sm");
    expect(homeSource).toContain("pb-7 pt-5");
  });

  it("keeps the header navigation wired to unique section targets and mounts the assistant preview", () => {
    expect(homeSource).toContain('{ href: "#como-funciona", label: "Cómo funciona" }');
    expect(homeSource).toContain('{ href: "#expediente", label: "Tu expediente" }');
    expect(homeSource).toContain('{ href: "#copiloto", label: "Asistente" }');
    expect(homeSource).toContain('const candidateIds = SCROLL_TARGET_FALLBACKS[id] ?? [id];');
    expect(homeSource).toContain('const sectionMatch = document.querySelector<HTMLElement>(`section#${CSS.escape(candidateId)}`);');
    expect(homeSource).toContain('window.history.replaceState(null, "", `#${id}`)');
    expect(homeSource).toContain('<CopilotPreviewSection />');
    expect(homeSource).toContain('id: "ruta-movil-como-funciona"');
    expect(homeSource).toContain('id: "ruta-movil-expediente"');
    expect(homeSource).not.toContain('id: "como-funciona",\n      eyebrow: "Qué pasa cuando empiezas"');
    expect(homeSource).not.toContain('id: "expediente",\n      eyebrow: "Qué gana tu expediente"');
  });

  it("simplifies the first mobile upload touchpoint with a visible mode toggle, autofocus and selector analytics", () => {
    expect(auditFlowSource).toContain("const isFirstDocumentFlow = documents.length === 0 && !pendingDraft && !lastUpload;");
    expect(auditFlowSource).toContain("Sube tu primer documento");
    expect(auditFlowSource).toContain("Toma foto para empezar");
    expect(auditFlowSource).toContain("Elige archivo para empezar");
    expect(auditFlowSource).toContain("El análisis empieza solo en cuanto captures o elijas el documento.");
    expect(auditFlowSource).toContain('`${COMPACT_UPLOAD_GUARDRAILS.fileRules} El borrador se abre aquí mismo.`');
    expect(auditFlowSource).toContain('fileRules: "PDF, XML, JPG, PNG o WEBP · máximo 12 MB."');
    expect(auditFlowSource).toContain("upload_mode_selected");
    expect(auditFlowSource).toContain("compact_mobile_toggle");
    expect(auditFlowSource).toContain("preference_panel");
    expect(auditFlowSource).toContain("recommendedStepRef.current?.scrollIntoView");
    expect(auditFlowSource).toContain("Siguiente paso sugerido");
    expect(auditFlowSource).toContain("Archivo");
    expect(auditFlowSource).toContain("Cámara");
    expect(auditFlowSource).toContain("La revisión preliminar empieza sola en cuanto termina la carga");
    expect(heliosSheetSource).toContain("Helios ya leyó lo visible de tu expediente");
    expect(heliosSheetSource).toContain("Atajos para avanzar sin pensar demasiado");
    expect(heliosSheetSource).toContain("Resumen automático del expediente");
    expect(heliosSheetSource).toContain("Volver al expediente");
  });
});

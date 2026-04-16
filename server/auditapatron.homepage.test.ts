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
    expect(homeSource).toContain("getAuditapatronPricingExperience(0)");
    expect(pricingSource).toContain("Prueba gratis y con claridad desde el inicio");
    expect(pricingSource).toContain("Puedes seguir usando la auditoría y tu expediente sin pagar ni desbloquear nada por obligación.");
    expect(homeSource).toContain("Detecta señales en nómina, CFDI y documentos clave para entender qué revisar primero.");
    expect(homeSource).toContain("Ordena tus archivos y te orienta sobre el siguiente documento útil desde el primer paso.");
    expect(homeSource).toContain("Subir mi primer documento");
    expect(homeSource).toContain("Ir a mi primera auditoría");
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
    expect(homeSource).toContain("Subir mi primer documento");
    expect(homeSource).toContain("Ir a mi primera auditoría");
    expect(homeSource).toContain("Continúa con tu primera auditoría");
    expect(homeSource).toContain('window.location.href = "/auditar"');
    expect(appSource).toContain('Route path={"/auditar"} component={Auditar}');
  });

  it("preserves trust, privacy and guided FAQs while keeping Helios out of the public homepage copy", () => {
    expect(homeSource).toContain("Ya entendí mejor qué revisar primero.");
    expect(homeSource).toContain("Ver cómo se ve mi reporte");
    expect(homeSource).toContain("Guía rápida para empezar");
    expect(homeSource).toContain("Caso anónimo 01");
    expect(homeSource).toContain("Señal verificada en pruebas de comprensión");
    expect(homeSource).toContain("Tu privacidad es parte del producto");
    expect(homeSource).toContain("Tus documentos se resguardan para darte claridad y tranquilidad desde el inicio.");
    expect(homeSource).toContain("Tu recibo de nómina más reciente o un CFDI del mismo periodo");
    expect(homeSource).toContain("Un recibo reciente o tu contrato actual");
    expect(homeSource).toContain("Tu expediente en crecimiento");
    expect(homeSource).toContain("Tus documentos se convierten en expediente con más contexto para ordenar y comparar resultados.");
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

  it("ships an audit workspace with expediente clarity, revalidation and guided saving for the V1 flow", () => {
    expect(auditFlowSource).toContain("Hecho para trabajadores, sin lenguaje complicado");
    expect(auditFlowSource).toContain("AuditaPatron recibe tu documento, lo analiza, lo resguarda");
    expect(auditFlowSource).toContain("Así va tu expediente laboral");
    expect(auditFlowSource).toContain("Cruce IMSS e Infonavit hoy");
    expect(auditFlowSource).toContain("Claridad actual del expediente");
    expect(auditFlowSource).toContain("Revalidar IMSS e Infonavit");
    expect(auditFlowSource).toContain("Aún no has revalidado este cruce desde tu expediente.");
    expect(auditFlowSource).toContain("Sube tu primer archivo y recibe una lectura útil al momento.");
    expect(auditFlowSource).toContain("Sube un documento y revisa el borrador");
    expect(auditFlowSource).toContain("La carga empieza sola. Tú decides si se guarda.");
    expect(auditFlowSource).toContain("Confirmar y guardar documento");
    expect(auditFlowSource).toContain("Tu expediente se va volviendo más claro con cada documento");
    expect(auditFlowSource).toContain("getAuditapatronPricingExperience(documents.length)");
    expect(auditFlowSource).toContain("pricingExperience.platform.priceLabel");
    expect(auditFlowSource).toContain("Cerrar y seguir gratis");
    expect(pricingSource).toContain("Preparación guiada de tu siguiente paso laboral");
    expect(pricingSource).toContain("$199 MXN pago único");
    expect(auditFlowSource).not.toContain("Helios-first, para trabajadores y sin lenguaje complicado");
    expect(auditFlowSource).not.toContain("Helios recibe tu documento, lo analiza, lo resguarda y te devuelve resultados útiles dentro de AuditaPatron.");
    expect(auditFlowSource).not.toContain("CompliLink Operativo");
  });

  it("keeps the first homepage block mobile-first and exposes the audit CTA early", () => {
    expect(homeSource).toContain("pb-5 pt-4 sm:pb-12 sm:pt-12 lg:pt-16");
    expect(homeSource).toContain("Sube 1 documento y entiende qué revisar");
    expect(homeSource).toContain("order-3 mt-5 hidden w-full max-w-xl");
    expect(homeSource).toContain("order-2 mt-3 flex w-full max-w-sm");
    expect(homeSource).toContain("goToAuditFlow({");
    expect(homeSource).toContain("Ver cómo se ve el reporte");
    expect(homeSource).toContain("mt-2.5 w-full max-w-xl rounded-[1.45rem]");
    expect(homeSource).toContain("rounded-[1.15rem] border border-slate-200 bg-slate-50 px-3.5 py-3 shadow-sm");
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

  it("keeps the first mobile upload touchpoint guided, automatic and connected to the expediente flow", () => {
    expect(auditFlowSource).toContain("COMPACT_UPLOAD_GUARDRAILS");
    expect(auditFlowSource).toContain("Sube tu primer documento");
    expect(auditFlowSource).toContain("Toma foto para empezar");
    expect(auditFlowSource).toContain("Elige archivo para empezar");
    expect(auditFlowSource).toContain("PDF, XML, JPG, PNG o WEBP · máximo 12 MB.");
    expect(auditFlowSource).toContain("upload_mode_selected");
    expect(auditFlowSource).toContain("compact_mobile_toggle");
    expect(auditFlowSource).toContain("preference_panel");
    expect(auditFlowSource).toContain("recommendedStepRef.current?.scrollIntoView");
    expect(auditFlowSource).toContain("Siguiente paso sugerido");
    expect(auditFlowSource).toContain("La revisión preliminar empieza sola en cuanto termina la carga");
    expect(auditFlowSource).toContain("Volver al expediente");
    expect(heliosSheetSource).toContain("Helios ya leyó lo visible de tu expediente");
    expect(heliosSheetSource).toContain("Atajos para avanzar sin pensar demasiado");
    expect(heliosSheetSource).toContain("Resumen automático del expediente");
    expect(heliosSheetSource).toContain("Volver al expediente");
  });

  it("keeps the post-upload state lighter by surfacing a compact result summary before secondary modules", () => {
    expect(auditFlowSource).toContain("const shouldCompactPostUploadExperience =");
    expect(auditFlowSource).toContain("Resultado listo");
    expect(auditFlowSource).toContain("lastUploadResultHeadline");
    expect(auditFlowSource).toContain("Subir otro documento");
    expect(auditFlowSource).toContain("condensedDossierTargets");
    expect(auditFlowSource).toContain("condensedPriorityUploadGuides");
    expect(auditFlowSource).toContain("Tu último archivo ya fue incorporado.");
    expect(auditFlowSource).toContain("Abajo tienes el veredicto y el siguiente paso.");
    expect(auditFlowSource).toContain("Primero mira el veredicto y el siguiente paso.");
  });

  it("reduces mobile post-upload noise by hiding the harness from the first viewport and shrinking secondary surfaces", () => {
    expect(auditFlowSource).toContain(
      'className={shouldCompactPostUploadExperience\n              ? "hidden"',
    );
    expect(auditFlowSource).toContain(
      'shouldCompactPostUploadExperience ? "hidden" : ""',
    );
    expect(auditFlowSource).toContain(
      'shouldCompactPostUploadExperience ? "hidden rounded-[1.25rem] border border-sky-100 bg-sky-50 p-4 shadow-sm sm:block sm:p-5"',
    );
    expect(auditFlowSource).toContain(
      "Tu expediente ya quedó guardado y lo puedes abrir cuando quieras.",
    );
    expect(auditFlowSource).not.toContain(
      "Tu siguiente paso principal está justo abajo.",
    );
  });
});

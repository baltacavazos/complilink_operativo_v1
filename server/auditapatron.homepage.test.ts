import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Auditapatron homepage and audit flow content", () => {
  const homeSource = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");
  const auditFlowSource = readFileSync(resolve(process.cwd(), "client/src/pages/Auditar.tsx"), "utf8");
  const appSource = readFileSync(resolve(process.cwd(), "client/src/App.tsx"), "utf8");

  it("shows a clearer worker-centered value proposition focused on document auditing", () => {
    expect(homeSource).toContain("Sube un documento laboral");
    expect(homeSource).toContain("y recibe una auditoría clara.");
    expect(homeSource).toContain("Empieza con lo que ya tienes a la mano y convierte ese primer archivo en orden, contexto y un expediente digital que seguirá contigo.");
    expect(homeSource).toContain("La auditoría documental es el centro de la experiencia");
    expect(homeSource).toContain("Empieza con el documento correcto");
    expect(homeSource).toContain("Sin reunir todo de una vez");
    expect(homeSource).not.toContain("CompliLink Operativo");
  });

  it("keeps the educational journey in 3 steps and routes the main CTA to the audit workspace", () => {
    expect(homeSource).toContain("Sube tu documento y AuditaPatron lo recibe");
    expect(homeSource).toContain("AuditaPatron te devuelve hallazgos claros");
    expect(homeSource).toContain("Tu expediente se fortalece con AuditaPatron");
    expect(homeSource).toContain("Empieza con el documento correcto");
    expect(homeSource).toContain("Primer documento sugerido");
    expect(homeSource).toContain("Continúa con tu primera auditoría");
    expect(homeSource).toContain('window.location.href = "/auditar"');
    expect(appSource).toContain('Route path={"/auditar"} component={Auditar}');
  });

  it("preserves trust, privacy and guided FAQs while keeping Helios out of the public homepage copy", () => {
    expect(homeSource).toContain("Ya entendí mejor qué revisar primero.");
    expect(homeSource).toContain("Ver ejemplo del reporte");
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
    expect(auditFlowSource).toContain("Sube un archivo y recibe una lectura útil sin pasos extra.");
    expect(auditFlowSource).toContain("Después de subirlo, AuditaPatron lo analizará para mostrarte qué ya se entendió, qué conviene revisar y cómo ese archivo queda ordenado dentro de tu expediente digital para tenerlo siempre a la mano.");
    expect(auditFlowSource).toContain("Confirmar y guardar documento");
    expect(auditFlowSource).not.toContain("Helios-first, para trabajadores y sin lenguaje complicado");
    expect(auditFlowSource).not.toContain("Helios recibe tu documento, lo analiza, lo resguarda y te devuelve resultados útiles dentro de AuditaPatron.");
    expect(auditFlowSource).not.toContain("CompliLink Operativo");
  });

  it("keeps the first homepage block more mobile-efficient and surfaces the primary CTA earlier", () => {
    expect(homeSource).toContain("order-3 mt-5 w-full max-w-xl");
    expect(homeSource).toContain("order-2 mt-4 flex w-full max-w-sm");
    expect(homeSource).toContain("pb-7 pt-5");
  });

  it("simplifies the first mobile upload touchpoint with a visible mode toggle, autofocus and selector analytics", () => {
    expect(auditFlowSource).toContain("const isFirstDocumentFlow = documents.length === 0 && !pendingDraft && !lastUpload;");
    expect(auditFlowSource).toContain("Sube tu primer documento");
    expect(auditFlowSource).toContain("Toma foto para empezar");
    expect(auditFlowSource).toContain("Elige archivo para empezar");
    expect(auditFlowSource).toContain("El análisis empieza solo en cuanto captures o elijas el documento.");
    expect(auditFlowSource).toContain("Elige cómo subirlo. Después te mostraremos el borrador y el siguiente documento sugerido.");
    expect(auditFlowSource).toContain("upload_mode_selected");
    expect(auditFlowSource).toContain("compact_mobile_toggle");
    expect(auditFlowSource).toContain("preference_panel");
    expect(auditFlowSource).toContain("recommendedStepRef.current?.scrollIntoView");
    expect(auditFlowSource).toContain("Siguiente paso sugerido");
    expect(auditFlowSource).toContain("Archivo");
    expect(auditFlowSource).toContain("Cámara");
    expect(auditFlowSource).toContain("La revisión preliminar empieza sola en cuanto termina la carga");
  });
});

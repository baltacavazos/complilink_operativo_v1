import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Auditapatron homepage and audit flow content", () => {
  const homeSource = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");
  const auditFlowSource = readFileSync(resolve(process.cwd(), "client/src/pages/Auditar.tsx"), "utf8");
  const appSource = readFileSync(resolve(process.cwd(), "client/src/App.tsx"), "utf8");

  it("shows a worker-centered value proposition with IMSS and Infonavit clarity", () => {
    expect(homeSource).toContain("Protege tu historia laboral");
    expect(homeSource).toContain("y recupera la calma.");
    expect(homeSource).toContain("Sube tus documentos sin complicarte.");
    expect(homeSource).toContain("te muestra lo importante");
    expect(homeSource).toContain("Empieza con el documento que ya tienes más a la mano.");
    expect(homeSource).toContain("un recibo de nómina, un CFDI, tu contrato o un soporte IMSS/Infonavit");
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
    expect(homeSource).toContain("Quiero una guía rápida antes de subir");
    expect(homeSource).toContain("Guía rápida para empezar");
    expect(homeSource).toContain("Mini diagnóstico inicial");
    expect(homeSource).toContain("un recibo de nómina, un CFDI, tu contrato o un soporte IMSS/Infonavit");
    expect(homeSource).not.toContain("Sube tu documento y Helios lo recibe");
    expect(homeSource).not.toContain("Helios te devuelve hallazgos claros");
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
});

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Auditapatron homepage and audit flow content", () => {
  const homeSource = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");
  const auditFlowSource = readFileSync(resolve(process.cwd(), "client/src/pages/Auditar.tsx"), "utf8");
  const appSource = readFileSync(resolve(process.cwd(), "client/src/App.tsx"), "utf8");

  it("shows a worker-centered value proposition with IMSS and Infonavit clarity", () => {
    expect(homeSource).toContain("Tus derechos laborales,");
    expect(homeSource).toContain("claros desde el primer documento que subes.");
    expect(homeSource).toContain("Sube tus documentos y deja que AuditaPatron los analice, los resguarde y te devuelva resultados útiles dentro de AuditaPatron.");
    expect(homeSource).toContain("podrás revisar con más claridad si tu alta en IMSS e Infonavit está en orden");
    expect(homeSource).toContain("Sube recibo, CFDI, soporte IMSS o constancia de Infonavit.");
    expect(homeSource).toContain("Recibos, CFDI, contratos, soportes IMSS, constancias de Infonavit y evidencia");
    expect(homeSource).not.toContain("CompliLink Operativo");
  });

  it("keeps the educational journey and routes the main CTA to the audit workspace", () => {
    expect(homeSource).toContain("Sube tu documento y AuditaPatron lo recibe");
    expect(homeSource).toContain("AuditaPatron te devuelve hallazgos claros");
    expect(homeSource).toContain("Tu expediente se fortalece con AuditaPatron");
    expect(homeSource).toContain("AuditaPatron lo analiza y lo guarda en tu expediente");
    expect(homeSource).toContain("Tus resultados y archivos quedan disponibles 24/7");
    expect(homeSource).toContain('window.location.href = "/auditar"');
    expect(appSource).toContain('Route path={"/auditar"} component={Auditar}');
  });

  it("preserves trust, privacy and FAQs while keeping Helios out of the public homepage copy", () => {
    expect(homeSource).toContain("Tus archivos se resguardan con control dentro del flujo de AuditaPatron");
    expect(homeSource).toContain("Preguntas frecuentes");
    expect(homeSource).toContain("Recibos de nómina, CFDI, contrato, soporte IMSS, constancias de Infonavit");
    expect(homeSource).not.toContain("Sube tu documento y Helios lo recibe");
    expect(homeSource).not.toContain("Helios te devuelve hallazgos claros");
  });

  it("ships an audit workspace aligned with the public AuditaPatron narrative while preserving IMSS and Infonavit clarity", () => {
    expect(auditFlowSource).toContain("Hecho para trabajadores, sin lenguaje complicado");
    expect(auditFlowSource).toContain("AuditaPatron recibe tu documento, lo analiza, lo resguarda y te devuelve resultados útiles.");
    expect(auditFlowSource).toContain("Ve rápido cómo va creciendo tu expediente.");
    expect(auditFlowSource).toContain("Distingue lo confirmado de lo estimado, incluyendo señales de IMSS e Infonavit.");
    expect(auditFlowSource).toContain("Tu expediente se ordena, resguarda y revisa por ti");
    expect(auditFlowSource).toContain("AuditaPatron recibe y protege");
    expect(auditFlowSource).toContain("La revisión encuentra contexto útil");
    expect(auditFlowSource).toContain("Cada documento nuevo fortalece tu expediente, y cada retorno útil de la revisión automática ayuda a afinar la lectura del caso.");
    expect(auditFlowSource).toContain("Confirmar y guardar documento");
    expect(auditFlowSource).not.toContain("Helios-first, para trabajadores y sin lenguaje complicado");
    expect(auditFlowSource).not.toContain("Helios recibe tu documento, lo analiza, lo resguarda y te devuelve resultados útiles dentro de AuditaPatron.");
    expect(auditFlowSource).not.toContain("Helios recibe y protege");
    expect(auditFlowSource).not.toContain("Tú recibes una guía más clara desde Helios");
    expect(auditFlowSource).not.toContain("CompliLink Operativo");
  });
});

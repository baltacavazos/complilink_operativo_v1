import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Auditapatron homepage content", () => {
  const homeSource = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");
  const auditFlowSource = readFileSync(resolve(process.cwd(), "client/src/pages/Auditar.tsx"), "utf8");
  const appSource = readFileSync(resolve(process.cwd(), "client/src/App.tsx"), "utf8");

  it("shows a worker-centered trust narrative without exposing the internal engine", () => {
    expect(homeSource).toContain("Tus derechos laborales,");
    expect(homeSource).toContain("claros, protegidos y mejor respaldados.");
    expect(homeSource).toContain("Diseñado para trabajadores, no para expertos");
    expect(homeSource).toContain("100% confidencial");
    expect(homeSource).toContain("Tu privacidad es parte del producto");
    expect(homeSource).toContain("Tu expediente en crecimiento");
    expect(homeSource).not.toContain("Helios es el cerebro central de AuditaPatron");
    expect(homeSource).not.toContain("Helios ordena tu expediente y fortalece tu respaldo");
  });

  it("includes the dossier-strength explanation and CTA to the real audit route", () => {
    expect(homeSource).toContain("Fortaleza inicial del expediente");
    expect(homeSource).toContain("Claridad acumulada");
    expect(homeSource).toContain("Tu revisión se organiza sola y te devuelve claridad útil");
    expect(homeSource).toContain("Ir a /auditar ahora");
    expect(homeSource).toContain('window.location.href = "/auditar"');
    expect(appSource).toContain('Route path={"/auditar"} component={Auditar}');
  });

  it("preserves the guided educational journey without reverting to the previous brand identity", () => {
    expect(homeSource).toContain("Recorrido guiado");
    expect(homeSource).toContain("Volver a ver el recorrido");
    expect(homeSource).toContain("Sube tu recibo o documento");
    expect(homeSource).toContain("Te mostramos hallazgos claros");
    expect(homeSource).toContain("Tu expediente se fortalece contigo");
    expect(homeSource).toContain("Preguntas frecuentes");
    expect(homeSource).not.toContain("CompliLink Operativo");
    expect(homeSource).not.toContain("Garantizar que CompliLink opere hoy mismo");
  });

  it("ships a friendly audit workspace with clear progress, comparison and alerts without visible internal jargon", () => {
    expect(auditFlowSource).toContain("Tus derechos laborales, claros y protegidos");
    expect(auditFlowSource).toContain("Hoy tu expediente va en:");
    expect(auditFlowSource).toContain("Próximo paso que más puede ayudarte");
    expect(auditFlowSource).toContain("Añade un documento a tu expediente");
    expect(auditFlowSource).toContain("Subir y revisar documento");
    expect(auditFlowSource).toContain("Siguiente paso sugerido para ti");
    expect(auditFlowSource).toContain("Qué está pasando ahora");
    expect(auditFlowSource).toContain("Tipo de revisión");
    expect(auditFlowSource).toContain("Qué tienes que hacer");
    expect(auditFlowSource).toContain("Tu espacio");
    expect(auditFlowSource).toContain("Elige tu caso");
    expect(auditFlowSource).toContain("Seguimiento automático");
    expect(auditFlowSource).toContain("Cómo va la respuesta automática");
    expect(auditFlowSource).toContain("Comparación guiada");
    expect(auditFlowSource).toContain("¿Qué cambió aquí?");
    expect(auditFlowSource).toContain("Compara tú mismo dos documentos del expediente");
    expect(auditFlowSource).toContain("Usar la comparación sugerida");
    expect(auditFlowSource).toContain("Alertas priorizadas");
    expect(auditFlowSource).toContain("Línea de tiempo del expediente");
    expect(auditFlowSource).toContain("Cómo se fue fortaleciendo tu expediente");
    expect(auditFlowSource).toContain("Tu línea de tiempo está esperando.");
    expect(auditFlowSource).toContain("Conviene darle un vistazo con calma");
    expect(auditFlowSource).toContain("En espera, pero avanzando");
    expect(auditFlowSource).not.toContain("Estado de Helios");
    expect(auditFlowSource).not.toContain("Comparación guiada de Helios");
    expect(auditFlowSource).not.toContain("Helios: ¿Qué cambió aquí?");
    expect(auditFlowSource).not.toContain("Alertas priorizadas por Helios");
    expect(auditFlowSource).not.toContain("Cómo Helios mejora esta comparación");
    expect(auditFlowSource).not.toContain("Siguiente documento recomendado por Helios");
  });
});

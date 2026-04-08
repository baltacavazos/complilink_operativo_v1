import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Auditapatron homepage content", () => {
  const homeSource = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");
  const auditFlowSource = readFileSync(resolve(process.cwd(), "client/src/pages/Auditar.tsx"), "utf8");
  const appSource = readFileSync(resolve(process.cwd(), "client/src/App.tsx"), "utf8");

  it("shows a worker-centered trust narrative without exposing the internal engine", () => {
    expect(homeSource).toContain("Tus derechos laborales,");
    expect(homeSource).toContain("claros desde el primer documento que subes.");
    expect(homeSource).toContain("Diseñado para trabajadores, no para expertos");
    expect(homeSource).toContain("Expediente privado");
    expect(homeSource).toContain("Tu privacidad es parte del producto");
    expect(homeSource).toContain("disponible 24/7");
    expect(homeSource).toContain("Tu expediente en crecimiento");
    expect(homeSource).not.toContain("Helios es el cerebro central de AuditaPatron");
    expect(homeSource).not.toContain("Helios ordena tu expediente y fortalece tu respaldo");
  });

  it("includes the dossier-strength explanation and CTA to the real audit route", () => {
    expect(homeSource).toContain("Todo en un solo lugar");
    expect(homeSource).toContain("Tu expediente en crecimiento");
    expect(homeSource).toContain("Ya aporta claridad");
    expect(homeSource).toContain("Puede fortalecerlo");
    expect(homeSource).toContain("Ir a /auditar ahora");
    expect(homeSource).toContain('window.location.href = "/auditar"');
    expect(appSource).toContain('Route path={"/auditar"} component={Auditar}');
  });

  it("preserves a guided and simpler educational journey without reverting to the previous brand identity", () => {
    expect(homeSource).toContain("Así de fácil");
    expect(homeSource).toContain("Sube lo que ya tienes");
    expect(homeSource).toContain("La plataforma entiende lo importante");
    expect(homeSource).toContain("Recibes guía útil para avanzar");
    expect(homeSource).toContain("Tus documentos dejan de vivir en folders sueltos y empiezan a trabajar a tu favor.");
    expect(homeSource).toContain("Preguntas frecuentes");
    expect(homeSource).not.toContain("CompliLink Operativo");
    expect(homeSource).not.toContain("Garantizar que CompliLink opere hoy mismo");
  });

  it("ships a friendly audit workspace with guided review, comparison and alerts", () => {
    expect(auditFlowSource).toContain("Tus derechos laborales, claros y protegidos");
    expect(auditFlowSource).toContain("Tu revisión");
    expect(auditFlowSource).toContain("Vista clara");
    expect(auditFlowSource).toContain("Próximo paso que más puede ayudarte");
    expect(auditFlowSource).toContain("Añade un documento a tu expediente");
    expect(auditFlowSource).toContain("Analizar antes de guardar");
    expect(auditFlowSource).toContain("Vista previa antes de guardar");
    expect(auditFlowSource).toContain("Confirmar y guardar documento");
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
    expect(auditFlowSource).toContain("todo queda disponible para ti 24/7");
    expect(auditFlowSource).toContain("Tu línea de tiempo está esperando.");
    expect(auditFlowSource).toContain("Conviene darle un vistazo con calma");
    expect(auditFlowSource).toContain("En espera, pero avanzando");
  });
});

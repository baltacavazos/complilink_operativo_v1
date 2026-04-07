import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Auditapatron homepage content", () => {
  const homeSource = readFileSync(
    resolve(process.cwd(), "client/src/pages/Home.tsx"),
    "utf8",
  );
  const auditFlowSource = readFileSync(
    resolve(process.cwd(), "client/src/pages/Auditar.tsx"),
    "utf8",
  );
  const appSource = readFileSync(
    resolve(process.cwd(), "client/src/App.tsx"),
    "utf8",
  );

  it("shows the protective dossier positioning, worker-centered trust narrative, and Helios as visible engine", () => {
    expect(homeSource).toContain("Tus derechos laborales,");
    expect(homeSource).toContain("claros, protegidos y mejor respaldados.");
    expect(homeSource).toContain("Diseñado para trabajadores, no para expertos");
    expect(homeSource).toContain("100% confidencial");
    expect(homeSource).toContain("Tu privacidad es parte del producto");
    expect(homeSource).toContain("Tu expediente en crecimiento");
    expect(homeSource).toContain("Cada documento útil fortalece tu protección laboral.");
    expect(homeSource).toContain("Helios es el cerebro central de AuditaPatron: recopila señales de tus documentos, las interpreta con lenguaje claro y te orienta sobre qué sigue sin complicarte.");
    expect(homeSource).toContain("Helios ordena tu expediente y fortalece tu respaldo");
  });

  it("includes the dossier-strength explanation, Helios guidance, findings examples, and CTA to the real audit route", () => {
    expect(homeSource).toContain("Fortaleza inicial del expediente");
    expect(homeSource).toContain("Claridad acumulada");
    expect(homeSource).toContain("Helios detecta lo útil, conecta tus documentos y te da más claridad para comparar cambios y cuidar tu respaldo.");
    expect(homeSource).toContain("Helios te muestra lo importante con palabras simples.");
    expect(homeSource).toContain("Helios te indica qué documento puede ayudarte después.");
    expect(homeSource).toContain("Qué hace Helios por ti");
    expect(homeSource).toContain("Helios convierte documentos sueltos en claridad accionable.");
    expect(homeSource).toContain("La persona usuaria solo sube, revisa y avanza.");
    expect(homeSource).toContain("Ejemplos de hallazgos");
    expect(homeSource).toContain("Diferencias entre nómina y CFDI");
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

  it("ships a functional audit workspace that explains contributions and next useful documents after upload", () => {
    expect(auditFlowSource).toContain("Tus derechos laborales, claros y protegidos");
    expect(auditFlowSource).toContain("Hoy tu expediente va en:");
    expect(auditFlowSource).toContain("Próximo paso que más puede ayudarte");
    expect(auditFlowSource).toContain("Añade un documento a tu expediente");
    expect(auditFlowSource).toContain("Subir y revisar documento");
    expect(auditFlowSource).toContain("Siguiente paso sugerido para ti");
    expect(auditFlowSource).toContain("Ya forma parte del expediente.");
    expect(auditFlowSource).toContain("Microestado de Helios");
    expect(auditFlowSource).toContain("Qué hace ahora");
    expect(auditFlowSource).toContain("Cómo interactúas");
    expect(auditFlowSource).toContain("Base lista para modo remoto");
  });
});

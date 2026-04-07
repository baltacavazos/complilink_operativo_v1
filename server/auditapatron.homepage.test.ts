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

  it("shows the protective dossier positioning and worker-centered trust narrative", () => {
    expect(homeSource).toContain("Tus derechos laborales,");
    expect(homeSource).toContain("claros, protegidos y mejor respaldados.");
    expect(homeSource).toContain("Diseñado para trabajadores, no para expertos");
    expect(homeSource).toContain("100% confidencial");
    expect(homeSource).toContain("Tu privacidad es parte del producto");
    expect(homeSource).toContain("Tu expediente en crecimiento");
    expect(homeSource).toContain("Cada documento útil fortalece tu protección laboral.");
  });

  it("includes the dossier-strength explanation, findings examples, and CTA to the real audit route", () => {
    expect(homeSource).toContain("Fortaleza inicial del expediente");
    expect(homeSource).toContain("Claridad acumulada");
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
    expect(auditFlowSource).toContain("Tu flujo de auditoría y fortalecimiento del expediente");
    expect(auditFlowSource).toContain("Fortaleza del expediente:");
    expect(auditFlowSource).toContain("Cobertura documental útil");
    expect(auditFlowSource).toContain("Siguiente documento recomendado");
    expect(auditFlowSource).toContain("Subir y auditar documento");
    expect(auditFlowSource).toContain("Siguiente paso sugerido");
    expect(auditFlowSource).toContain("Tu documento ya forma parte del expediente");
  });
});

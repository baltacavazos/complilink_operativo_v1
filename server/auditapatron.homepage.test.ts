import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Auditapatron homepage content", () => {
  const homeSource = readFileSync(
    resolve(process.cwd(), "client/src/pages/Home.tsx"),
    "utf8",
  );

  it("shows the new worker-friendly positioning and trust narrative", () => {
    expect(homeSource).toContain("Tus derechos laborales,");
    expect(homeSource).toContain("claros y protegidos.");
    expect(homeSource).toContain("Diseñado para trabajadores, no para expertos");
    expect(homeSource).toContain("100% confidencial");
    expect(homeSource).toContain("Tu privacidad es parte del producto");
  });

  it("includes the guided informational tour and friendly conversion structure", () => {
    expect(homeSource).toContain("Recorrido guiado");
    expect(homeSource).toContain("Volver a ver el recorrido");
    expect(homeSource).toContain("Sube tu recibo o documento");
    expect(homeSource).toContain("Te mostramos hallazgos claros");
    expect(homeSource).toContain("Conservas evidencia y tranquilidad");
    expect(homeSource).toContain("Preguntas frecuentes");
  });

  it("removes the previous CompliLink homepage identity", () => {
    expect(homeSource).not.toContain("CompliLink Operativo");
    expect(homeSource).not.toContain("Garantizar que CompliLink opere hoy mismo");
  });
});

import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const readPage = (fileName: string) => {
  const filePath = path.resolve(import.meta.dirname, `${fileName}.tsx`);
  return fs.readFileSync(filePath, "utf8");
};

describe("copy visible de la experiencia", () => {
  it("oculta referencias al motor interno en Home", () => {
    const source = readPage("Home");

    expect(source).not.toContain("Helios es el cerebro central de AuditaPatron");
    expect(source).not.toContain("Helios ordena tu expediente y fortalece tu respaldo");
    expect(source).not.toContain("CompliLink");
    expect(source).not.toContain("ThemeToggle");
    expect(source).toContain("Tus derechos laborales");
    expect(source).toContain("sin palabras difíciles.");
    expect(source).toContain("Claro y móvil");
  });

  it("oculta referencias visibles al motor interno en Auditar", () => {
    const source = readPage("Auditar");

    expect(source).not.toContain("Estado de Helios");
    expect(source).not.toContain("Comparación guiada de Helios");
    expect(source).not.toContain("Helios: ¿Qué cambió aquí?");
    expect(source).not.toContain("Alertas priorizadas por Helios");
    expect(source).not.toContain("Siguiente documento recomendado por Helios");
    expect(source).not.toContain("ThemeToggle");
    expect(source).toContain("Tu revisión");
    expect(source).toContain("Tus derechos laborales, claros y protegidos");
    expect(source).toContain("Vista clara");
  });

  it("mantiene el tema base en claro sin interruptor global", () => {
    const appSource = fs.readFileSync(path.resolve(import.meta.dirname, "../App.tsx"), "utf8");

    expect(appSource).toContain('<ThemeProvider defaultTheme="light">');
    expect(appSource).not.toContain('<ThemeProvider defaultTheme="light" switchable');
  });
});

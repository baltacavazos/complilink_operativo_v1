import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const readPage = (fileName: string) => {
  const filePath = path.resolve(import.meta.dirname, `${fileName}.tsx`);
  return fs.readFileSync(filePath, "utf8");
};

describe("novena ola móvil/web", () => {
  it("mantiene una web más explicativa y prepara descargas móviles sin enlaces falsos", () => {
    const source = readPage("Home");

    expect(source).toContain('id="app"');
    expect(source).toContain("Web explicativa · app directa");
    expect(source).toContain("En la web entiendes el valor. En la app avanzas más rápido.");
    expect(source).toContain("Los botones de descarga aparecerán aquí cuando existan destinos reales y confiables para iOS y Android.");
    expect(source).toContain("Próximamente en iOS y Android");
    expect(source).toContain("App Store");
    expect(source).toContain("Google Play");
    expect(source).toContain('placement: "app_download_section_primary"');
    expect(source).not.toContain("https://apps.apple.com/");
    expect(source).not.toContain("https://play.google.com/");
  });

  it("vuelve más directa la app nativa en /auditar sin quitar privacidad ni siguiente paso", () => {
    const source = readPage("Auditar");

    expect(source).toContain("const isNativeAppExperience = canUseNativeDocumentInput();");
    expect(source).toContain("Directo desde tu app");
    expect(source).toContain("Ruta corta dentro de la app");
    expect(source).toContain("Toma una foto o elige un archivo. Primero ves la señal y después decides si quieres guardarla.");
    expect(source).toContain("Subes un archivo o tomas una foto desde tu celular.");
    expect(source).toContain("Ves de inmediato la señal principal y qué conviene revisar después.");
    expect(source).toContain("Sube una foto o archivo. Primero revisas la señal y luego decides si guardas.");
    expect(source).toContain("Tu documento sigue privado dentro de la app");
    expect(source).toContain("Primero revisas. Guardas solo si te sirve.");
  });
});

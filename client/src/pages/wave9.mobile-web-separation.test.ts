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
    expect(source).toContain("App móvil en camino");
    expect(source).toContain("Empieza hoy aquí. La app viene después.");
    expect(source).toContain("No necesitas esperar: la revisión gratuita ya funciona aquí.");
    expect(source).toContain("Próximamente en iPhone y Android");
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
    expect(source).toContain("Sube y revisa en segundos");
    expect(source).toContain("Ruta corta dentro de la app");
    expect(source).toContain("Sube foto o archivo. Ves la señal en segundos.");
    expect(source).toContain("Subes foto o archivo desde tu celular.");
    expect(source).toContain("Ves la señal principal y el siguiente paso útil.");
    expect(source).toContain("Sube tu documento");
    expect(source).toContain("Sube tu recibo gratis");
    expect(source).toContain("Tu documento sigue privado dentro de la app");
    expect(source).toContain("Primero revisas. Guardas solo si te sirve.");
  });
});

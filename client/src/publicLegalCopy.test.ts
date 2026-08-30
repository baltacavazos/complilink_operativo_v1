import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), "utf8");

describe("copy público y aviso de privacidad", () => {
  it("mantiene el lema y presenta la lectura como orientativa", () => {
    const home = read("src/pages/Home.tsx");
    const html = read("index.html");

    expect(home).toContain("Esto no es asesoría legal. AuditaPatrón no sustituye a un abogado ni presenta quejas por ti.");
    expect(home).toContain("Es una lectura orientativa, no una validación oficial ante SAT, IMSS ni Infonavit, ni asesoría legal.");
    expect(home).toContain("No es un cruce en vivo con SAT/IMSS.");
    expect(home).toContain("Lectura orientativa desde el primer archivo");
    expect(home).toContain("señal inicial");
    expect(home).not.toContain("Resultado instantáneo");
    expect(home).not.toContain("Resultado real desde el primer archivo");
    expect(home).not.toContain("señal real");
    expect(home).not.toContain("valor probatorio");
    expect(home).toContain('alt="AuditaPatron - Conoce tus derechos"');
    expect(html).toContain("AuditaPatron · Conoce tus derechos");
    expect(html).toContain("No es asesoría legal ni validación oficial.");
    expect(html).toContain("Logotipo oficial de AuditaPatron con el lema Conoce tus derechos");
  });

  it("expone el mismo aviso sin login en las tres rutas y desde el footer", () => {
    const app = read("src/App.tsx");
    const home = read("src/pages/Home.tsx");
    const legalPage = read("src/pages/LegalDocuments.tsx");
    const legalCopy = read("../shared/legal.ts");

    expect(app.match(/component={LegalPrivacyPage}/g)).toHaveLength(3);
    expect(app).toContain('path={"/legal/privacidad"}');
    expect(app).toContain('path={"/aviso-de-privacidad"}');
    expect(app).toContain('path={"/privacidad"}');
    expect(home).toContain('<a href="/aviso-de-privacidad"');
    expect(legalPage).toContain("Este aviso carga sin login");
    expect(legalPage).toContain("resguardo con acceso controlado");
    expect(legalCopy).toContain('route: "/aviso-de-privacidad"');
    expect(legalCopy).toContain("La identidad legal del responsable y el domicilio se publicarán antes del lanzamiento comercial definitivo.");
  });
});

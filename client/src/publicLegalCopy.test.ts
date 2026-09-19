import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

import { sanitizeClientVisibleCopy } from "./lib/clientVisibleCopy";
import {
  LEGAL_DOCUMENTS,
  LEGAL_GATE_COPY,
  PRIVACY_CENTER_COPY,
} from "../../shared/legal";

const root = path.resolve(import.meta.dirname, "..");
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), "utf8");

const CLIENT_FACING_LEGAL_SURFACES = [
  "src/pages/LegalDocuments.tsx",
  "src/pages/Home.tsx",
  "src/pages/Auditar.tsx",
  "src/pages/AccessGate.tsx",
  "src/pages/Payments.tsx",
  "src/pages/PapersPlaceholder.tsx",
  "src/pages/NotFound.tsx",
  "../shared/legal.ts",
] as const;

describe("copy público y aviso de privacidad", () => {
  it("mantiene el lema y presenta la lectura como orientativa", () => {
    const home = read("src/pages/Home.tsx");
    const html = read("index.html");

    expect(home).toContain("Esto no es asesoría legal. AuditaPatrón no sustituye a un abogado ni presenta quejas por ti.");
    expect(home).toContain("Es una lectura orientativa, no una validación oficial ante SAT, IMSS ni Infonavit, ni asesoría legal.");
    expect(home).toContain("No es un cruce en vivo con SAT/IMSS.");
    expect(home).toContain("Lectura orientativa desde el primer archivo");
    expect(home).toContain("primera lectura");
    expect(home).not.toContain("Resultado instantáneo");
    expect(home).not.toContain("Resultado real desde el primer archivo");
    expect(home).not.toContain("valor probatorio");
    expect(home).toContain('alt="AuditaPatron - Conoce tus derechos"');
    expect(html).toContain("AuditaPatrón · Conoce tus derechos");
    expect(html).toContain('<html lang="es">');
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
    expect(legalCopy).toContain("LEGAL_CONTROLLER_NAME");
    expect(legalCopy).toContain("LEGAL_CONTROLLER_ADDRESS");
    expect(legalCopy).not.toContain("La identidad legal del responsable y el domicilio se publicarán antes del lanzamiento comercial definitivo.");
    expect(legalCopy).not.toMatch(/helios/i);
    expect(legalCopy).not.toMatch(/complilink/i);
    for (const document of LEGAL_DOCUMENTS) {
      const visible = [
        document.shortTitle,
        document.fullTitle,
        sanitizeClientVisibleCopy(document.markdown) ?? "",
      ].join("\n");
      expect(visible, document.slug).not.toMatch(/helios/i);
      expect(visible, document.slug).not.toMatch(/complilink/i);
    }
    expect(legalPage).toContain("visibleLegalCopy");
    expect(legalPage).toContain("sanitizeClientVisibleCopy");
    expect(app).toContain('path={"/historial"}');
    expect(app).toContain("PapersPlaceholder");
    expect(app).toContain('path={"/expediente"}');
    expect(app).not.toContain('path={"/historial"} component={NotFound}');
  });

  it("falla si el copy legal o cliente visible menciona Helios o CompliLink", () => {
    const visibleLegalTexts = [
      ...LEGAL_DOCUMENTS.map((document) => sanitizeClientVisibleCopy(document.markdown) ?? ""),
      ...Object.values(LEGAL_GATE_COPY).map((value) => sanitizeClientVisibleCopy(value) ?? ""),
      PRIVACY_CENTER_COPY.title,
      PRIVACY_CENTER_COPY.intro,
      ...PRIVACY_CENTER_COPY.rightsSummary,
      PRIVACY_CENTER_COPY.revocationNotice,
    ].join("\n");

    expect(visibleLegalTexts).not.toMatch(/\bHelios\b/i);
    expect(visibleLegalTexts).not.toMatch(/CompliLink|complilink/);
    expect(visibleLegalTexts).not.toContain("interacción con Helios");
    expect(visibleLegalTexts).not.toContain("incluyendo CompliLink y Helios");
    expect(visibleLegalTexts).not.toContain(
      "La identidad legal del responsable y el domicilio se publicarán antes del lanzamiento comercial definitivo.",
    );

    for (const relativePath of CLIENT_FACING_LEGAL_SURFACES) {
      const source = read(relativePath);
      expect(source, relativePath).not.toContain("interacción con Helios");
      expect(source, relativePath).not.toContain("incluyendo CompliLink y Helios");
      expect(source, relativePath).not.toContain(
        "La identidad legal del responsable y el domicilio se publicarán antes del lanzamiento comercial definitivo.",
      );

      if (relativePath.endsWith("legal.ts")) {
        expect(source, relativePath).not.toMatch(/\bHelios\b/);
        expect(source, relativePath).not.toMatch(/CompliLink|complilink/);
        continue;
      }

      const quoted = [...source.matchAll(/(["'`])([^"'`\n]{3,220})\1/g)]
        .map((match) => match[2])
        .join("\n");
      expect(quoted, relativePath).not.toMatch(/\bHelios\b/);
      expect(quoted, relativePath).not.toMatch(/CompliLink|complilink/);
    }

    const commerceCopy = read("../shared/commerce.ts");
    const commerceQuoted = [...commerceCopy.matchAll(/(["'`])([^"'`\n]{3,220})\1/g)]
      .map((match) => match[2])
      .join("\n");
    expect(commerceQuoted).not.toMatch(/\bHelios\b/);
    expect(commerceQuoted).not.toMatch(/CompliLink|complilink/);
  });
});

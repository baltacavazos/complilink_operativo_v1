import { describe, expect, it } from "vitest";

import {
  hasForbiddenClientBrand,
  sanitizeClientVisibleCopy,
} from "./clientVisibleCopy";

describe("sanitizeClientVisibleCopy", () => {
  it("oculta CompliLink y deja el producto como AuditaPatrón", () => {
    expect(sanitizeClientVisibleCopy("Bienvenido a CompliLink Operativo")).toBe(
      "Bienvenido a AuditaPatrón",
    );
    expect(sanitizeClientVisibleCopy("CompliLink ID: 123")).toBe("ID de integración: 123");
    expect(sanitizeClientVisibleCopy("Snapshot operativo CompliLink ↔ AuditaPatron")).toBe(
      "Snapshot operativo del puente ↔ AuditaPatron",
    );
    expect(hasForbiddenClientBrand(sanitizeClientVisibleCopy("Alerta CompliLink"))).toBe(false);
  });

  it("oculta Helios, Manus y jerga de score/ONLINE", () => {
    expect(sanitizeClientVisibleCopy("Preguntar a Helios")).toBe("Preguntar al asesor laboral");
    expect(sanitizeClientVisibleCopy("El copiloto Helios ya leyó tu expediente")).toBe(
      "El asesor laboral ya leyó tu expediente",
    );
    expect(sanitizeClientVisibleCopy("Inicia sesión con Manus, Google o un código")).toBe(
      "Inicia sesión con Google o un código",
    );
    expect(sanitizeClientVisibleCopy("Continuar con Manus")).toBe("Continuar");
    expect(sanitizeClientVisibleCopy("confidence score 94")).toBe("confianza orientativa 94");
    expect(sanitizeClientVisibleCopy("Estado ONLINE")).toBe("Estado en línea");
    expect(sanitizeClientVisibleCopy("Forge / APIMarket / Forensic")).toBe(
      "la plataforma / el servicio de consulta / revisión documental",
    );
  });

  it("conserva nulos y textos ya limpios", () => {
    expect(sanitizeClientVisibleCopy(null)).toBeNull();
    expect(sanitizeClientVisibleCopy(undefined)).toBeNull();
    expect(sanitizeClientVisibleCopy("Tu recibo ya tiene una lectura útil")).toBe(
      "Tu recibo ya tiene una lectura útil",
    );
    expect(hasForbiddenClientBrand("Tu recibo ya tiene una lectura útil")).toBe(false);
  });
});

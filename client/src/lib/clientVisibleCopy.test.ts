import { describe, expect, it } from "vitest";

import {
  hasForbiddenClientBrand,
  hasRawBooleanLeak,
  humanizeWorkerVisibleScalar,
  isWorkerInternalFieldValue,
  isWorkerSystemFieldLabel,
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
    expect(sanitizeClientVisibleCopy("Preguntar a Helios")).toBe("Preguntar al asesor");
    expect(sanitizeClientVisibleCopy("Modo Helios")).toBe("Asesor laboral");
    expect(sanitizeClientVisibleCopy("Helios básico")).toBe("asesor laboral básico");
    expect(sanitizeClientVisibleCopy("Helios multi-documento")).toBe("lectura de varios documentos");
    expect(sanitizeClientVisibleCopy("motor Helios")).toBe("inteligencia laboral");
    expect(sanitizeClientVisibleCopy("Helios · modo CEO")).toBe("Asesor laboral · modo CEO");
    expect(
      sanitizeClientVisibleCopy(
        "Helios ya conectó documentos del expediente y está devolviendo una lectura preliminar con alertas y siguientes pasos útiles.",
      ),
    ).toBe(
      "El asesor laboral ya conectó documentos del expediente y está devolviendo una lectura preliminar con alertas y siguientes pasos útiles.",
    );
    expect(
      hasForbiddenClientBrand(
        sanitizeClientVisibleCopy(
          "Helios ya conectó documentos del expediente y está devolviendo una lectura preliminar con alertas y siguientes pasos útiles.",
        ),
      ),
    ).toBe(false);
    expect(sanitizeClientVisibleCopy("El copiloto Helios ya leyó tu expediente")).toBe(
      "El asesor laboral ya leyó tu expediente",
    );
    expect(hasForbiddenClientBrand(sanitizeClientVisibleCopy("Modo Helios"))).toBe(false);
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

  it("reescribe frases legales viejas de Helios/CompliLink y omite la promesa vacía de identidad", () => {
    expect(
      sanitizeClientVisibleCopy(
        "así como la interacción con Helios, CompliLink y demás componentes del ecosistema",
      ),
    ).toBe("así como la interacción con el asesor laboral");
    expect(
      sanitizeClientVisibleCopy("incluyendo CompliLink y Helios"),
    ).toBe("incluyendo AuditaPatrón y su asesor laboral");
    expect(
      sanitizeClientVisibleCopy(
        "La identidad legal del responsable y el domicilio se publicarán antes del lanzamiento comercial definitivo.",
      ),
    ).toBe("");
    expect(
      hasForbiddenClientBrand(
        sanitizeClientVisibleCopy("interacción con Helios, CompliLink"),
      ),
    ).toBe(false);
  });

  it("convierte booleanos crudos a Sí/No y no deja true/false visible", () => {
    expect(humanizeWorkerVisibleScalar(true)).toBe("Sí");
    expect(humanizeWorkerVisibleScalar(false)).toBe("No");
    expect(humanizeWorkerVisibleScalar("true")).toBe("Sí");
    expect(humanizeWorkerVisibleScalar("false")).toBe("No");
    expect(humanizeWorkerVisibleScalar("true.")).toBe("Sí");
    expect(humanizeWorkerVisibleScalar('"true"')).toBe("Sí");
    expect(humanizeWorkerVisibleScalar("Confirmado")).toBe("Confirmado");
    expect(hasRawBooleanLeak("true")).toBe(true);
    expect(hasRawBooleanLeak("Sí")).toBe(false);
    expect(hasRawBooleanLeak("Confirmado")).toBe(false);
  });

  it("reconoce MIME, enums internos y etiquetas de sistema para ocultarlos al trabajador", () => {
    expect(isWorkerInternalFieldValue("application/pdf")).toBe(true);
    expect(isWorkerInternalFieldValue("other")).toBe(true);
    expect(isWorkerInternalFieldValue("expanded")).toBe(true);
    expect(isWorkerInternalFieldValue("standard")).toBe(true);
    expect(isWorkerInternalFieldValue("ECC190605VA1")).toBe(false);
    expect(isWorkerInternalFieldValue("$4,725.60")).toBe(false);
    expect(isWorkerInternalFieldValue("Ana Pérez")).toBe(false);
    expect(isWorkerSystemFieldLabel("Formato")).toBe(true);
    expect(isWorkerSystemFieldLabel("Nivel de revisión")).toBe(true);
    expect(isWorkerSystemFieldLabel("RFC visible")).toBe(false);
    expect(isWorkerSystemFieldLabel("Periodo visible")).toBe(false);
  });

  it("quita marcadores internos required_plan/current_plan del copy visible", () => {
    const leaked =
      "Asesor laboral con lectura de varios documentos del expediente está disponible desde Audita Esencial.||required_plan=essential||current_plan=free";
    const clean = sanitizeClientVisibleCopy(leaked);

    expect(clean).not.toMatch(/required_plan|current_plan|\|\|/);
    expect(clean).toMatch(/Audita Esencial/);
    expect(hasForbiddenClientBrand(clean)).toBe(false);
  });

  it("el chat del trabajador complementa el sanitizador y no reintroduce Helios", () => {
    const dirty = "Helios y CompliLink ya leyeron tu recibo";
    expect(hasForbiddenClientBrand(sanitizeClientVisibleCopy(dirty))).toBe(false);
    expect(sanitizeClientVisibleCopy(dirty)).not.toMatch(/\bHelios\b|CompliLink/);
  });

  it("oculta Webhook y webhook_rejected con copy humano", () => {
    expect(sanitizeClientVisibleCopy("webhook_rejected")).toBe("No pudimos recibir el aviso.");
    expect(sanitizeClientVisibleCopy("compra detectada por webhook")).toBe(
      "compra detectada automáticamente",
    );
    expect(sanitizeClientVisibleCopy("Webhook listo")).toBe("Aviso listo");
    expect(hasForbiddenClientBrand(sanitizeClientVisibleCopy("Webhook pendiente"))).toBe(false);
  });

  it("reescribe límites de cuenta/expediente en español claro para el trabajador", () => {
    expect(sanitizeClientVisibleCopy("This account is limited to a single personal case")).toBe(
      "Esta cuenta solo puede tener un expediente personal.",
    );
    expect(sanitizeClientVisibleCopy("This account is limited to a single personal case.")).toBe(
      "Esta cuenta solo puede tener un expediente personal.",
    );
    expect(sanitizeClientVisibleCopy("No personal case assigned to this account")).toBe(
      "Esta cuenta aún no tiene un expediente personal.",
    );
    expect(sanitizeClientVisibleCopy("Access denied for tenant")).toBe(
      "No tienes acceso a este espacio.",
    );
    expect(sanitizeClientVisibleCopy("Access denied for case")).toBe(
      "No tienes acceso a este expediente.",
    );
    expect(sanitizeClientVisibleCopy("Write access denied for case")).toBe(
      "No puedes modificar este expediente.",
    );
    expect(sanitizeClientVisibleCopy("Admin access denied for tenant")).toBe(
      "No tienes permiso de administración en este espacio.",
    );
    expect(sanitizeClientVisibleCopy("Database not available")).toBe(
      "No pudimos guardar esto ahora. Intenta de nuevo en un momento.",
    );
    expect(sanitizeClientVisibleCopy("Table 'railway.labor_cases' doesn't exist")).toBe(
      "No pudimos preparar tu expediente ahora. Intenta de nuevo en un momento.",
    );
    expect(sanitizeClientVisibleCopy("ER_NO_SUCH_TABLE: labor_cases")).toMatch(
      /No pudimos preparar tu expediente ahora/,
    );
    expect(sanitizeClientVisibleCopy("Table 'railway.labor_cases' doesn't exist")).not.toMatch(
      /labor_cases|SQL|ER_NO_SUCH_TABLE/i,
    );
    expect(
      sanitizeClientVisibleCopy("This account is limited to a single personal case"),
    ).not.toMatch(/This account|personal case|Access denied/i);
    expect(sanitizeClientVisibleCopy("No accessible tenant found")).toBe(
      "No pudimos preparar tu espacio de revisión.",
    );
  });
});

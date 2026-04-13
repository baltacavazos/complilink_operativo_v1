import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const readPage = (fileName: string) => {
  const filePath = path.resolve(import.meta.dirname, `${fileName}.tsx`);
  return fs.readFileSync(filePath, "utf8");
};

const readComponent = (relativePath: string) => {
  const filePath = path.resolve(import.meta.dirname, "..", relativePath);
  return fs.readFileSync(filePath, "utf8");
};

describe("copy visible de la experiencia", () => {
  it("oculta referencias al motor interno en Home", () => {
    const source = readPage("Home");

    expect(source).not.toContain("Helios es el cerebro central de AuditaPatron");
    expect(source).not.toContain("Helios ordena tu expediente y fortalece tu respaldo");
    expect(source).not.toContain("CompliLink");
    expect(source).not.toContain("ThemeToggle");
    expect(source).toContain('tabLabel: "Alerta y control"');
    expect(source).toContain('tabLabel: "Control inmediato"');
    expect(source).toContain("Sube un documento laboral");
    expect(source).toContain("y recibe una auditoría clara.");
    expect(source).toContain("La auditoría documental es el centro de la experiencia");
    expect(source).toContain("Alerta laboral temprana");
    expect(source).toContain('label: "Asistente"');
    expect(source).not.toContain("Comenzar mi revisión");
    expect(source).not.toContain("Revisar mis documentos");
    expect(source).not.toContain("Entrar con mi asistente");
    expect(source).not.toContain("Abrir mi expediente");
    expect(source).not.toContain("Tus derechos laborales,");
    expect(source).toContain('const PRIMARY_CTA_LABEL = "Empieza ahora y protege tu futuro"');
    expect(source).toContain("Empieza ahora y protege tu futuro");
    expect(source).toContain("Ya entendí mejor qué revisar primero.");
    expect(source).toContain("Por fin tengo mis documentos en un solo lugar.");
    expect(source).toContain("Caso anónimo 01");
    expect(source).toContain("Señal verificada en pruebas de comprensión");
    expect(source).toContain("Señales de confianza");
    expect(source).toContain("Privacidad visible, lenguaje simple y siguientes pasos concretos.");
    expect(source).toContain("Ver qué documento subir primero");
    expect(source).toContain("Guía rápida para empezar");
    expect(source).toContain("Empieza con el documento correcto");
    expect(source).toContain("Quiero entender rápido si esto me sirve");
    expect(source).toContain("Auditoría inicial en segundos");
    expect(source).toContain("Tu recibo de nómina más reciente o un CFDI del mismo periodo");
    expect(source).toContain("Vista previa del reporte que recibes");
    expect(source).toContain("Puedes recorrer estados reales: documento recibido, hallazgo preliminar y siguiente paso sugerido.");
    expect(source).toContain("Estado real 02");
    expect(source).toContain("SectionDivider");
    expect(source).toContain('bg-[#dbeeee]');
    expect(source).toContain('bg-[#eef6f5]');
    expect(source).toContain('bg-[#eaf5f3]');
  });

  it("oculta referencias visibles al motor interno en Auditar y usa una variante cálida", () => {
    const source = readPage("Auditar");

    expect(source).not.toContain("Antes de usar el copiloto Helios");
    expect(source).not.toContain("Abrir copiloto laboral");
    expect(source).not.toContain("ThemeToggle");
    expect(source).toContain("function warmVisibleNamingCopy");
    expect(source).toContain("Tu revisión");
    expect(source).toContain("Tus derechos laborales, claros y protegidos");
    expect(source).toContain("Lectura visible");
    expect(source).toContain("tu asistente laboral");
    expect(source).toContain("expediente laboral");
  });

  it("mantiene lenguaje cálido y comprensible en el panel conversacional", () => {
    const source = readComponent("components/HeliosCopilotSheet.tsx");

    expect(source).toContain("Tu asistente laboral");
    expect(source).toContain("Pregunta sobre riesgos, pasos sugeridos o dudas de tu expediente");
    expect(source).toContain("Tu asistente laboral puede explicarte tu expediente con palabras simples");
    expect(source).not.toContain("Copiloto laboral de Helios");
  });

  it("mantiene el marco legal visible sin referencias intimidantes", () => {
    const source = readPage("LegalDocuments");

    expect(source).toContain("acompañamiento laboral dentro de la plataforma");
    expect(source).not.toContain("AuditaPatron y Helios");
  });

  it("mantiene el tema base en claro sin interruptor global", () => {
    const appSource = fs.readFileSync(path.resolve(import.meta.dirname, "../App.tsx"), "utf8");

    expect(appSource).toContain('<ThemeProvider defaultTheme="light">');
    expect(appSource).not.toContain('<ThemeProvider defaultTheme="light" switchable');
  });
});

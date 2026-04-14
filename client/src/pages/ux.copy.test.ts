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
    expect(source).toContain("Sube un recibo, contrato o CFDI y recibe hallazgos claros con el siguiente paso sugerido.");
    expect(source).toContain("Alerta laboral temprana");
    expect(source).toContain('label: "Asistente"');
    expect(source).not.toContain("Comenzar mi revisión");
    expect(source).not.toContain("Revisar mis documentos");
    expect(source).not.toContain("Entrar con mi asistente");
    expect(source).not.toContain("Abrir mi expediente");
    expect(source).not.toContain("Tus derechos laborales,");
    expect(source).toContain('const PRIMARY_CTA_LABEL = "Auditar ahora"');
    expect(source).toContain("Auditar ahora");
    expect(source).toContain("Ya entendí mejor qué revisar primero.");
    expect(source).toContain("Por fin tengo mis documentos en un solo lugar.");
    expect(source).toContain("Caso anónimo 01");
    expect(source).toContain("Señal verificada en pruebas de comprensión");
    expect(source).toContain("Señales de confianza");
    expect(source).toContain("Privacidad visible, lenguaje simple y siguientes pasos concretos.");
    expect(source).toContain("Ver cómo se ve mi reporte");
    expect(source).toContain("Guía rápida para empezar");
    expect(source).toContain("Empieza con el documento correcto");
    expect(source).toContain("Sube tu documento ahora.");
    expect(source).toContain("Sube desde tu celular y recibe claridad útil desde el inicio.");
    expect(source).toContain("Hallazgos claros prioritarios.");
    expect(source).toContain("Breves y urgentes primero.");
    expect(source).toContain("Fortalece expediente con contexto.");
    expect(source).toContain("Tus documentos se convierten en expediente con más contexto para ordenar y comparar resultados.");
    expect(source).toContain("Más contexto con cada archivo.");
    expect(source).toContain("Privacidad y control visibles.");
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
    expect(source).toContain("function MobilePriorityPathSection");
    expect(source).toContain("Ruta móvil priorizada");
    expect(source).toContain("Primero decides si quieres empezar; lo demás aparece cuando te sirve.");
    expect(source).toContain('className="hidden sm:block"');
    expect(source).toContain('id="como-funciona"');
    expect(source).toContain('id="expediente"');
    expect(source).toContain('id="privacidad"');
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
    expect(source).toContain("Expediente en {heliosExpediente?.stageLabel ?? dossierStatus.label}");
    expect(source).toContain("Siguiente útil: ${effectiveRecommendedTarget.label}. Lo puedes subir justo debajo.");
    expect(source).toContain('hidden gap-3 sm:grid sm:grid-cols-3');
    expect(source).toContain('className="hidden motion-hover-lift rounded-[1.65rem] border border-slate-200 bg-white p-5 shadow-sm sm:block sm:p-6"');
    expect(source).toContain('Sube tu primer archivo y recibe una lectura útil al momento.');
    expect(source).toContain('`${COMPACT_UPLOAD_GUARDRAILS.fileRules} Apenas lo subas, empezaremos solos el borrador y después te mostraremos el siguiente documento sugerido.`');
    expect(source).toContain('fileRules: "PDF, XML o imagen clara · máximo 15 MB."');
    expect(source).toContain('Documento sugerido preparado');
    expect(source).toContain('Enfocado en {effectiveRecommendedTarget.label.toLowerCase()}. Sube tu archivo para aplicar.');
  });

  it("refuerza la ruta principal en acceso sin competir visualmente con alternativas", () => {
    const source = readPage("Access");

    expect(source).toContain("Acceso simple");
    expect(source).toContain("Inicia sesión sin vueltas.");
    expect(source).toContain("Si eres el CEO");
    expect(source).toContain("mismo correo principal del propietario");
    expect(source).toContain("Código por correo");
    expect(source).toContain("Tu acceso principal");
    expect(source).toContain("Recibir código");
    expect(source).toContain("Google sólo aparece cuando la configuración esté terminada.");
    expect(source).not.toContain("Continúa con Manus");
  });

  it("compacta el primer bloque operativo de la consola CEO para lectura móvil más rápida", () => {
    const source = readPage("CeoDashboard");

    expect(source).toContain('text-2xl font-semibold tracking-tight sm:text-3xl xl:text-[2.55rem]');
    expect(source).toContain("Revisa alertas, accesos y salud operativa desde una sola vista para priorizar acciones rápidas.");
    expect(source).toContain("Panorama arriba y detalle filtrado abajo, sin desorden.");
    expect(source).toContain("Las acciones seguras siguen visibles para resolver rápido.");
    expect(source).toContain("Cierra la revisión sin salir de la consola.");
  });

  it("mantiene el lenguaje cálido y comprensible en el panel conversacional", () => {
    const source = readComponent("components/HeliosCopilotSheet.tsx");

    expect(source).toContain("Helios ya leyó lo visible de tu expediente");
    expect(source).toContain("Escribe tu duda o toca un atajo. Helios ya parte de lo visible en tu expediente");
    expect(source).toContain("Helios ya tiene suficiente contexto para empezar");
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

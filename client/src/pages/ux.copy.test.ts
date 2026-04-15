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
    expect(source).toContain("Sube 1 documento y entiende qué revisar");
    expect(source).toContain("Sube un documento");
    expect(source).toContain("y te decimos qué sigue.");
    expect(source).toContain("Empieza con el recibo, contrato o CFDI que ya tienes a la mano.");
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
    expect(source).toContain("Auditoría documental clara desde el primer archivo.");
    expect(source).toContain("Privacidad visible, lenguaje simple y siguientes pasos concretos.");
    expect(source).toContain("Ver cómo se ve mi reporte");
    expect(source).toContain("Guía rápida para empezar");
    expect(source).toContain("Si no sabes cuál subir primero");
    expect(source).toContain("Quiero revisar mi documento");
    expect(source).toContain("Entras, subes un archivo y ves un resultado claro. Lo demás aparece después, solo si hace falta.");
    expect(source).toContain("Hallazgos claros prioritarios.");
    expect(source).toContain("Breves y urgentes primero.");
    expect(source).toContain("Fortalece expediente con contexto.");
    expect(source).toContain("Tus documentos se convierten en expediente con más contexto para ordenar y comparar resultados.");
    expect(source).toContain("Más contexto con cada archivo.");
    expect(source).toContain("Privacidad y control visibles.");
    expect(source).toContain("Si no sabes cuál subir primero");
    expect(source).toContain("Empieza con cualquier archivo que ya tengas.");
    expect(source).toContain("Un archivo basta para empezar");
    expect(source).toContain("Ejemplo del resultado que recibes");
    expect(source).toContain("Esto verás apenas subas tu documento.");
    expect(source).toContain("Primero ves lo esencial: qué documento entendimos, qué señal apareció y qué te conviene hacer después.");
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
    expect(source).toContain("Expediente en");
    expect(source).toContain("Siguiente útil: ${effectiveRecommendedTarget.label}. Lo puedes subir justo debajo.");
    expect(source).toContain('hidden gap-3 sm:grid sm:grid-cols-3');
    expect(source).toContain('className="hidden motion-hover-lift rounded-[1.65rem] border border-slate-200 bg-white p-5 shadow-sm sm:block sm:p-6"');
    expect(source).toContain('Sube tu primer archivo y recibe una lectura útil al momento.');
    expect(source).toContain('Elegir cómo subir el documento');
    expect(source).toContain('En un solo paso puedes tomar foto o elegir un archivo');
    expect(source).toContain('Elegir cámara o archivo');
    expect(source).toContain('El borrador se abre aquí mismo.');
    expect(source).toContain('fileRules: "PDF, XML, JPG, PNG o WEBP · máximo 12 MB."');
    expect(source).toContain('Documento sugerido preparado');
    expect(source).toContain('Enfocado en');
    expect(source).toContain('tu archivo para aplicar.');
    expect(source).toContain('mt-4 grid gap-3 md:grid-cols-2');
    expect(source).toContain('md:col-span-2');
    expect(source).toContain('Ver historial detallado');
    expect(source).toContain('Esta preparación es opcional. Si por ahora solo quieres');
    expect(source).toContain('puedes continuar sin pagar ni desbloquear nada.');
    expect(source).toContain('mt-3 grid grid-cols-2 gap-2 text-center');
    expect(source).toContain('sm:grid-cols-2 lg:grid-cols-3');
    expect(source).toContain('mt-4 grid gap-3 md:grid-cols-2');
    expect(source).not.toContain('mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4');
  });

  it("refuerza la ruta principal en acceso con una sola vía clara por correo", () => {
    const source = readPage("Access");

    expect(source).toContain("Acceso simple");
    expect(source).toContain("Entrar con correo");
    expect(source).toContain("Escribe tu correo y te mandamos un código de 6 dígitos para entrar.");
    expect(source).toContain("Si ya habías usado este equipo, te mostramos el último correo para avanzar más rápido.");
    expect(source).toContain("Te reconocimos en este equipo");
    expect(source).toContain("Si quieres, sigue con ese correo. Si no, cámbialo antes de pedir el código.");
    expect(source).toContain("Luego vuelves a");
    expect(source).toContain("function getReturnToLabel");
    expect(source).toContain('return "tu auditoría"');
    expect(source).toContain('return "la consola ejecutiva"');
    expect(source).toContain('return "el inicio"');
    expect(source).toContain('return "la pantalla que dejaste abierta"');
    expect(source).toContain("Usa el correo con el que quieres entrar hoy.");
    expect(source).toContain("Después vuelves directo a ");
    expect(source).toContain("Después de entrar: ");
    expect(source).toContain("Recibir código");
    expect(source).toContain("Enviando código...");
    expect(source).toContain("Estamos enviando tu código.");
    expect(source).toContain("Código enviado");
    expect(source).toContain("Entrar");
    expect(source).toContain("Reenviar código");
    expect(source).toContain("Más opciones de acceso");
    expect(source).not.toContain("Si eres el CEO");
    expect(source).not.toContain("Tu acceso principal");
    expect(source).not.toContain("Google sólo aparece cuando la configuración esté terminada.");
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

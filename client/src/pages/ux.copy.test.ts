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
    expect(source).toContain('tabLabel: "Pago y señales"');
    expect(source).toContain('tabLabel: "Revisar primero"');
    expect(source).toContain("Sube una foto o PDF y revisa tu pago");
    expect(source).toContain("Tu recibo de nómina puede tener señales raras.");
    expect(source).toContain("Empieza con una foto o PDF y revisa si hay algo que conviene mirar en tu pago, deducciones o CFDI.");
    expect(source).toContain("Empieza con una foto. No necesitas reunir todo.");
    expect(source).toContain("Revisión urgente de nómina");
    expect(source).not.toContain("Comenzar mi revisión");
    expect(source).not.toContain("Revisar mis documentos");
    expect(source).not.toContain("Entrar con mi asistente");
    expect(source).not.toContain("Abrir mi expediente");
    expect(source).not.toContain("Tus derechos laborales,");
    expect(source).toContain('const PRIMARY_CTA_LABEL = "Revisar mi recibo gratis"');
    expect(source).toContain("Revisar mi recibo gratis");
    expect(source).toContain("Ya entendí mejor qué revisar primero.");
    expect(source).toContain("Por fin tengo mis documentos en un solo lugar.");
    expect(source).toContain("Caso anónimo 01");
    expect(source).toContain("Señal verificada en pruebas de comprensión");
    expect(source).toContain("Privacidad visible y humana");
    expect(source).toContain("Nadie de tu empresa puede ver lo que subes.");
    expect(source).toContain("Borrado visible");
    expect(source).toContain("Ver ejemplo de resultado");
    expect(source).toContain("Guía rápida para empezar");
    expect(source).toContain("Si no sabes con qué empezar");
    expect(source).toContain("Empieza por el archivo que más rápido suele revelar diferencias");
    expect(source).toContain("Empieza con una foto. No necesitas reunir todo.");
    expect(source).toContain('id="helios-desde-home"');
    expect(source).toContain("Helios desde la Home");
    expect(source).toContain("Empieza con una foto. No necesitas reunir todo. Si este primer resultado te sirve, lo guardamos después dentro de tu expediente.");
    expect(source).toContain("Vista previa temporal Helios-first");
    expect(source).toContain("Empieza con una foto. No necesitas reunir todo.");
    expect(source).toContain("Guardar en mi expediente por correo");
    expect(source).toContain("Primero ves la lectura. El correo sólo se usa cuando decides guardar el expediente y seguir desde tu cuenta.");
    expect(source).toContain("audipatron_home_primary_cta_redirected_to_guest_preview");
    expect(source).toContain("Hallazgos claros prioritarios.");
    expect(source).toContain("Breves y urgentes primero.");
    expect(source).toContain("Fortalece expediente con contexto.");
    expect(source).toContain("Tus documentos se convierten en expediente con más contexto para ordenar y comparar resultados.");
    expect(source).toContain("Más contexto con cada archivo.");
    expect(source).toContain("Privacidad y control visibles.");
    expect(source).toContain("Si no sabes con qué empezar");
    expect(source).toContain("Empieza por el archivo que más rápido suele revelar diferencias");
    expect(source).toContain("Empieza por un solo recibo");
    expect(source).toContain("Ejemplo del resultado que recibes");
    expect(source).toContain("Esto verás apenas subas tu recibo.");
    expect(source).toContain("Ejemplo anónimo: posible diferencia estimada de $3,240 MXN.");
    expect(source).toContain("Primero ves lo esencial: qué documento detectamos, qué señal apareció, qué significa y qué te conviene hacer después.");
    expect(source).toContain("Posible diferencia contra CFDI");
    expect(source).toContain("SectionDivider");
    expect(source).toContain('bg-[#dbeeee]');
    expect(source).toContain('bg-[#eef6f5]');
    expect(source).toContain('bg-[#eaf5f3]');
    expect(source).not.toContain("<MobilePriorityPathSection />");
    expect(source).not.toContain("<DossierSection />");
    expect(source).not.toContain("<CopilotPreviewSection />");
    expect(source).toContain('id="como-funciona"');
    expect(source).toContain('id="privacidad"');
  });

  it("oculta referencias visibles al motor interno en Auditar y usa una variante cálida", () => {
    const source = readPage("Auditar");

    expect(source).not.toContain("Antes de usar el copiloto Helios");
    expect(source).not.toContain("Abrir copiloto laboral");
    expect(source).not.toContain("ThemeToggle");
    expect(source).toContain("function warmVisibleNamingCopy");
    expect(source).toContain("Carga inmediata");
    expect(source).toContain("Sube tu recibo de nómina");
    expect(source).toContain("Lectura visible");
    expect(source).toContain("tu asistente laboral");
    expect(source).toContain("expediente laboral");
    expect(source).toContain("Expediente en");
    expect(source).toContain("mobileDossierStageLabel");
    expect(source).toContain('.replace(/^Con\\s+/i, "")');
    expect(source).toContain("Siguiente útil: ${effectiveRecommendedTarget.label}. Lo puedes subir justo debajo.");
    expect(source).toContain('hidden gap-3 sm:grid sm:grid-cols-3');
    expect(source).toContain('hidden motion-hover-lift rounded-[1.65rem] border border-slate-200 bg-white p-5 shadow-sm sm:block sm:p-6');
    expect(source).toContain('mt-5 rounded-[1.35rem] border border-slate-200 bg-slate-50 p-4 sm:p-5');
    expect(source).toContain('qué documento recibió');
    expect(source).toContain('qué señal encontró y qué conviene revisar después.');
    expect(source).toContain('Revisar mi recibo gratis');
    expect(source).toContain('mx-auto h-[3.35rem] w-full max-w-[22rem] rounded-[1.35rem] bg-slate-950');
    expect(source).toContain('mx-auto max-w-[22rem] text-center text-[13px] leading-5 text-slate-500');
    expect(source).toContain('Empieza con una foto. No necesitas reunir todo. Si no tienes recibo, también puedes subir PDF, XML o una imagen clara. Cifrado AES-256 y control de borrado visibles.');
    expect(source).toContain('Elegir cámara o archivo');
    expect(source).toContain('Sube tu recibo de nómina');
    expect(source).toContain('Calculadora rápida');
    expect(source).toContain('Compara tu nómina contra tu CFDI');
    expect(source).toContain('Diferencia estimada');
    expect(source).toContain('Paso 1');
    expect(source).toContain('Señal encontrada');
    expect(source).toContain('Qué revisar después');
    expect(source).toContain('mx-auto h-[3.35rem] w-full max-w-[22rem] rounded-[1.35rem] px-5 text-[1.02rem] font-semibold text-white');
    expect(source).toContain('mx-auto inline-flex h-10 w-full max-w-[22rem] items-center justify-center gap-2 rounded-[1.2rem]');
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
    expect(source).toContain("Escribe tu correo, recibe un código de 6 dígitos y entra. Después vuelves directo al ");
    expect(source).not.toContain("Si ya habías usado este equipo, te mostramos el último correo para avanzar más rápido.");
    expect(source).toContain("Te reconocimos en este equipo");
    expect(source).toContain("Si quieres, sigue con ese correo. Si no, cámbialo antes de pedir el código.");
    expect(source).not.toContain("Luego vuelves a");
    expect(source).toContain("function getReturnToLabel");
    expect(source).toContain('return "tu auditoría"');
    expect(source).toContain('return "tu expediente privado"');
    expect(source).toContain('return "inicio"');
    expect(source).toContain('return "la pantalla que dejaste abierta"');
    expect(source).not.toContain("Usa el correo con el que quieres entrar hoy.");
    expect(source).toContain("sin perder tu avance.");
    expect(source).not.toContain("Después de entrar: ");
    expect(source).toContain('Vuelves al ');
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
    expect(source).toContain("Panel privado del owner");
    expect(source).toContain("Mi Expediente de Defensa");
    expect(source).toContain("Panel privado del owner autorizado para AuditaPatron");
    expect(source).toContain("Este expediente privado sólo está disponible para el owner autorizado.");
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

    expect(source).toContain("Resumen humano antes del texto completo");
    expect(source).toContain("acompañamiento laboral dentro de la plataforma");
    expect(source).toContain("Privacidad visible y pública");
    expect(source).toContain("Nadie de tu empresa puede ver lo que subes.");
    expect(source).not.toContain("AuditaPatron y Helios");
  });

  it("mantiene el tema base en claro sin interruptor global", () => {
    const appSource = fs.readFileSync(path.resolve(import.meta.dirname, "../App.tsx"), "utf8");

    expect(appSource).toContain('<ThemeProvider defaultTheme="light">');
    expect(appSource).not.toContain('<ThemeProvider defaultTheme="light" switchable');
  });
});

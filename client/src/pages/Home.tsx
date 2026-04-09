import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { AuditaPatronLogoIcon, AuditaPatronLogoWordmark } from "@/components/AuditaPatronLogo";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  FileSearch,
  Lock,
  Menu,
  Shield,
  ShieldCheck,
  Upload,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { LEGAL_CONTACT_EMAIL, LEGAL_DOCUMENTS, LEGAL_VERSION, PRIVACY_CENTER_COPY } from "@shared/legal";

type TourStep = {
  id: string;
  title: string;
  summary: string;
  description: string;
  bullets: string[];
  icon: typeof Upload;
};

type DossierSignal = {
  title: string;
  description: string;
  status: "listo" | "faltante";
};

type PriorityDocument = {
  title: string;
  description: string;
  value: string;
};

type MobileOnboardingCard = {
  step: string;
  title: string;
  description: string;
};

const navLinks = [
  { href: "#como-funciona", label: "Cómo funciona" },
  { href: "#expediente", label: "Tu expediente" },
  { href: "#copiloto", label: "Copiloto" },
  { href: "#preguntas", label: "Preguntas" },
];

const tourSteps: TourStep[] = [
  {
    id: "sube",
    title: "Sube tu recibo o documento",
    summary: "Empieza con el archivo que ya tienes a la mano.",
    description:
      "No necesitas saber de leyes ni de nómina. Tú subes el documento y AuditaPatron te ayuda a entender qué puede aportar.",
    bullets: [
      "Puedes empezar desde tu celular.",
      "Te orientamos con lenguaje simple.",
      "Cada archivo útil suma contexto.",
    ],
    icon: Upload,
  },
  {
    id: "revisamos",
    title: "Te mostramos hallazgos claros",
    summary: "Lo importante aparece primero y sin palabras difíciles.",
    description:
      "Separas lo confirmado de lo estimado para que entiendas mejor tu situación y sepas qué revisar con más calma.",
    bullets: [
      "Mensajes breves y fáciles de leer.",
      "Lo urgente se ve rápido.",
      "Te orienta sin asustarte.",
    ],
    icon: FileSearch,
  },
  {
    id: "proteges",
    title: "Tu expediente se fortalece contigo",
    summary: "Tus documentos no se quedan sueltos: se convierten en respaldo.",
    description:
      "Con más documentos útiles, el análisis gana contexto y tu expediente puede ayudarte mejor a ordenar, comparar y respaldar tu caso.",
    bullets: [
      "Más contexto para entender cambios.",
      "Mejor organización de evidencia.",
      "Privacidad y control de tus archivos.",
    ],
    icon: ShieldCheck,
  },
];

const dossierSignals: DossierSignal[] = [
  {
    title: "Recibos de nómina recientes",
    description: "Ayudan a detectar cambios de pago, deducciones y patrones repetidos.",
    status: "listo",
  },
  {
    title: "CFDI timbrado",
    description: "Sirve para contrastar lo reportado contra lo que realmente recibiste.",
    status: "listo",
  },
  {
    title: "Contrato o condiciones iniciales",
    description: "Aclara sueldo pactado, jornada y prestaciones desde el inicio.",
    status: "faltante",
  },
  {
    title: "Soporte IMSS o evidencia adicional",
    description: "Puede reforzar el contexto cuando hay dudas sobre tu relación laboral.",
    status: "faltante",
  },
];

const findingsExamples = [
  {
    title: "Diferencias entre nómina y CFDI",
    description:
      "Comparar ambos documentos puede mostrar pagos o conceptos reportados de forma distinta.",
  },
  {
    title: "Cambios repetidos en pagos o deducciones",
    description:
      "Varios recibos seguidos ayudan a detectar patrones que un solo archivo no deja ver.",
  },
  {
    title: "Condiciones pactadas frente a la realidad",
    description:
      "Contrato, nómina y evidencia adicional permiten revisar si lo prometido coincide con lo vivido.",
  },
];

const priorityDocuments: PriorityDocument[] = [
  {
    title: "Recibos de nómina de varios periodos",
    description: "Son de los archivos más útiles para detectar cambios repetidos en pagos, deducciones y depósitos.",
    value: "Ayudan a encontrar patrones mes con mes y a darle más contexto real a tu expediente.",
  },
  {
    title: "CFDI timbrados",
    description: "Permiten contrastar lo que fiscalmente aparece reportado contra lo que ves en tus recibos.",
    value: "Aclaran diferencias que una sola pieza documental podría dejar ocultas.",
  },
  {
    title: "Contrato, anexos o condiciones iniciales",
    description: "Aterrizan sueldo pactado, jornada, prestaciones y promesas de arranque.",
    value: "Sirven para comparar lo acordado frente a lo que realmente ocurrió después.",
  },
  {
    title: "Alta, baja o semanas cotizadas del IMSS",
    description: "Refuerzan la historia laboral con fechas y señales de seguridad social.",
    value: "Suman evidencia útil cuando necesitas respaldarte mejor o entender huecos en tu expediente.",
  },
];

const mobileOnboardingCards: MobileOnboardingCard[] = [
  {
    step: "01",
    title: "Empieza con lo que ya tienes",
    description: "Desde tu celular puedes abrir AuditaPatron y elegir el documento que tengas más a la mano, sin prepararlo antes.",
  },
  {
    step: "02",
    title: "Todo queda guardado en tu expediente",
    description: "Después de subirlo, el archivo se ordena en un solo lugar para que no termine perdido entre folders o chats.",
  },
  {
    step: "03",
    title: "Recibes claridad útil y la conservas",
    description: "Ves qué se entendió, qué conviene revisar y mantienes tus documentos disponibles 24/7 cuando vuelvas a necesitarlos.",
  },
];

const faqs = [
  {
    question: "¿AuditaPatron es para demandar a mi empresa?",
    answer:
      "No. Primero te ayuda a entender tu situación, ordenar tus documentos y detectar si hay algo que conviene revisar con más atención.",
  },
  {
    question: "¿Necesito saber de leyes o de nómina para usarlo?",
    answer:
      "No. Está pensado para explicarte lo importante con palabras sencillas y pasos claros.",
  },
  {
    question: "¿Por qué conviene subir más de un documento?",
    answer:
      "Porque varios documentos dan más contexto. Eso ayuda a ver patrones, diferencias y a construir un expediente digital ordenado, disponible 24/7 cuando lo necesites.",
  },
  {
    question: "¿Mi información está protegida?",
    answer:
      "Sí. Tus archivos se resguardan con control y se usan para fortalecer tu expediente digital, mantenerlo ordenado y dejarlo disponible para ti cuando lo necesites.",
  },
  {
    question: "¿Qué tipo de archivos puedo reunir aquí?",
    answer:
      "Recibos de nómina, CFDI, contrato, soporte IMSS y otros documentos laborales que ayuden a entender mejor tu caso.",
  },
];

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function goToAuditFlow() {
  window.location.href = "/auditar";
}

function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-slate-800/45 bg-slate-900/82 text-white shadow-[0_8px_22px_-22px_rgba(2,6,23,0.55)] backdrop-blur-lg">
      <div className="container mx-auto flex h-[4.55rem] max-w-[1380px] items-center justify-between gap-1.5 sm:h-[5rem] lg:gap-3">
        <a
          href="#top"
          aria-label="Ir al inicio de AuditaPatron"
          className="flex min-w-0 shrink-0 items-center pl-1 sm:pl-0 lg:max-w-[420px]"
        >
          <AuditaPatronLogoWordmark
            surface="dark"
            className="min-w-0"
            imageClassName="!h-9 w-auto max-w-[min(56vw,18rem)] object-contain sm:!h-10 sm:max-w-[19rem] lg:!h-[3rem] lg:max-w-[23rem]"
          />
        </a>

        <nav className="hidden min-w-0 flex-1 items-center justify-center gap-1 lg:flex xl:gap-1.5">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-full px-2.25 py-1.5 text-[0.84rem] font-medium text-slate-300/80 transition hover:bg-white/8 hover:text-white"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden shrink-0 items-center gap-1.5 lg:flex xl:gap-2">
          <Button
            variant="outline"
            className="motion-hover-lift h-9 rounded-full border-white/10 bg-white/5 px-3 text-[0.9rem] text-white hover:bg-white/10 xl:px-3.5"
            onClick={() => scrollToId("expediente")}
          >
            Ver tu expediente
          </Button>
          <Button
            className="motion-hover-lift h-9 rounded-full bg-teal-500 px-3 text-[0.9rem] font-semibold text-slate-950 hover:bg-teal-400 xl:px-3.5"
            onClick={goToAuditFlow}
          >
            Ir a /auditar ahora
            <ArrowRight className="ml-2 h-4 w-4" strokeWidth={1.8} />
          </Button>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 lg:hidden">
          <Button
            className="h-8.5 rounded-full bg-teal-400 px-3 text-[0.88rem] font-semibold text-slate-950 shadow-[0_14px_28px_-20px_rgba(45,212,191,0.75)] hover:bg-teal-300"
            onClick={goToAuditFlow}
          >
            Auditar
          </Button>
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/6 text-white transition hover:bg-white/10"
            onClick={() => setOpen((value) => !value)}
            aria-label={open ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={open}
          >
            {open ? <X className="h-4.5 w-4.5" /> : <Menu className="h-4.5 w-4.5" />}
          </button>
        </div>
      </div>

      {open ? (
        <div className="border-t border-white/8 bg-white md:hidden">
          <div className="container mx-auto max-w-6xl space-y-3 py-4">
            <div className="rounded-[1.55rem] border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <AuditaPatronLogoWordmark imageClassName="h-6 max-w-[184px]" />
                <span className="rounded-full bg-teal-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-700">
                  Claro y móvil
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Entra directo a lo importante y muévete entre áreas sin perderte.
              </p>
            </div>

            <div className="overflow-hidden rounded-[1.55rem] border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Explora
                </p>
              </div>
              <div className="divide-y divide-slate-100">
                {navLinks.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className="flex items-center justify-between px-4 py-3.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 hover:text-slate-950"
                  >
                    <span>{link.label}</span>
                    <ArrowRight className="h-4 w-4 text-slate-400" strokeWidth={1.8} />
                  </a>
                ))}
              </div>
            </div>

            <div className="grid gap-3 pt-1">
              <Button
                variant="outline"
                className="motion-hover-lift h-11 rounded-full border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                onClick={() => {
                  setOpen(false);
                  scrollToId("expediente");
                }}
              >
                Ver tu expediente
              </Button>
              <Button
                className="motion-hover-lift h-12 rounded-full bg-teal-600 text-white hover:bg-teal-700"
                onClick={() => {
                  setOpen(false);
                  goToAuditFlow();
                }}
              >
                Ir a /auditar ahora
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}

function HeroSection() {
  const dossierReadiness = 58;

  return (
    <section
      id="top"
      className="relative overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(20,184,166,0.14),_transparent_38%),radial-gradient(circle_at_top_right,_rgba(125,211,252,0.16),_transparent_28%),linear-gradient(180deg,_#ffffff_0%,_#f8fafc_100%)] pb-8 pt-7 sm:pb-12 sm:pt-12 lg:pt-16"
    >
      <div className="container mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 xl:gap-20">
        <div className="mx-auto flex max-w-2xl flex-col items-center text-center lg:mx-0 lg:items-start lg:text-left">
          <div
            className="motion-enter-soft inline-flex items-center gap-2 rounded-full border border-teal-100 bg-white/88 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-800 shadow-[0_18px_40px_-30px_rgba(20,184,166,0.4)] sm:px-4 sm:py-2 sm:text-xs"
            style={{ ["--motion-delay" as string]: "20ms" }}
          >
            <ShieldCheck className="h-4 w-4" strokeWidth={1.8} />
            <span className="sm:hidden">Hecho para trabajadores</span>
            <span className="hidden sm:inline">Diseñado para trabajadores, no para expertos</span>
          </div>

          <h1
            className="motion-enter-soft mt-4 max-w-[13ch] text-balance text-[2.55rem] font-bold leading-[0.94] tracking-[-0.06em] text-slate-950 sm:mt-5 sm:text-[3.6rem] lg:max-w-[11ch] lg:text-[4.4rem]"
            style={{ ["--motion-delay" as string]: "120ms" }}
          >
            <span className="block sm:hidden">
              Tus derechos laborales,
              <span className="mt-1 block text-teal-700">claros desde tu primer documento.</span>
            </span>
            <span className="hidden sm:block">
              Tus derechos laborales,
              <span className="block text-teal-700">claros desde el primer documento que subes.</span>
            </span>
          </h1>

          <p
            className="motion-enter-soft mt-4 max-w-xl text-base leading-7 text-slate-600 sm:text-[1.08rem] sm:leading-8"
            style={{ ["--motion-delay" as string]: "210ms" }}
          >
            Sube tus documentos, ordénalos en un solo lugar y entiende rápido qué revisar, qué falta y cuál es tu siguiente paso, sin palabras difíciles.
          </p>

          <div
            className="motion-enter-soft mt-6 flex w-full max-w-sm flex-col gap-2.5 sm:max-w-none sm:flex-row sm:justify-center lg:justify-start"
            style={{ ["--motion-delay" as string]: "300ms" }}
          >
            <Button
              className="motion-hover-lift h-12 w-full rounded-full bg-teal-600 px-7 text-base text-white hover:bg-teal-700 sm:w-auto"
              onClick={goToAuditFlow}
            >
              Auditar mis documentos
              <ArrowRight className="motion-arrow ml-2 h-4 w-4" strokeWidth={1.8} />
            </Button>
            <Button
              variant="outline"
              className="motion-hover-lift h-10 border-transparent bg-transparent px-2 text-sm font-semibold text-slate-600 shadow-none hover:bg-transparent hover:text-slate-950 sm:h-12 sm:rounded-full sm:border-slate-200 sm:bg-white sm:px-7 sm:text-base sm:text-slate-700 sm:hover:bg-slate-50"
              onClick={() => scrollToId("copiloto")}
            >
              Ver cómo funciona
            </Button>
          </div>

          <div
            className="motion-enter-soft mt-4 w-full max-w-xl rounded-[1.5rem] border border-slate-200 bg-white/92 p-3.5 shadow-[0_22px_50px_-38px_rgba(15,23,42,0.32)]"
            style={{ ["--motion-delay" as string]: "360ms" }}
          >
            <div className="flex flex-wrap items-center justify-center gap-2.5 lg:justify-start">
              <div className="flex -space-x-2">
                {[
                  "bg-teal-100 text-teal-900",
                  "bg-sky-100 text-sky-900",
                  "bg-emerald-100 text-emerald-900",
                ].map((tone, index) => (
                  <span
                    key={tone}
                    className={`inline-flex h-8 w-8 items-center justify-center rounded-full border border-white text-xs font-semibold shadow-sm ${tone}`}
                  >
                    {index === 0 ? "R" : index === 1 ? "C" : "N"}
                  </span>
                ))}
              </div>
              <p className="text-sm font-medium leading-6 text-slate-700">
                Diseñado con dudas reales de trabajadores sobre recibos, contratos y CFDI.
              </p>
            </div>

            <div className="mt-3 flex flex-wrap justify-center gap-2.5 text-sm text-slate-600 lg:justify-start">
              {["Expediente privado", "Guía paso a paso", "Sin palabras difíciles"].map((item) => (
                <span
                  key={item}
                  className="motion-hover-lift rounded-full border border-slate-200 bg-slate-50 px-4 py-2 shadow-sm"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="relative lg:pl-2">
          <div className="absolute -left-4 top-6 h-24 w-24 rounded-full bg-teal-200/50 blur-3xl" />
          <div className="absolute -right-4 bottom-8 h-24 w-24 rounded-full bg-sky-200/60 blur-3xl" />
          <div
            className="motion-enter-soft relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-5 shadow-[0_28px_72px_-56px_rgba(15,23,42,0.28)] sm:p-6"
            style={{ ["--motion-delay" as string]: "220ms" }}
          >
            <div className="rounded-[1.4rem] border border-slate-200 bg-slate-50 px-5 py-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                    Tu claridad hoy
                  </p>
                  <div className="mt-2 flex items-end gap-3">
                    <p className="text-[2.7rem] font-semibold tracking-[-0.06em] text-slate-950">{dossierReadiness}%</p>
                    <span className="mb-1 text-sm font-semibold text-teal-700">Ya puedes empezar</span>
                  </div>
                </div>
                <div className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                  24/7
                </div>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Entiendes rápido qué revisar primero.
              </p>
              <div className="mt-4 h-3 overflow-hidden rounded-full bg-white">
                <div
                  className="motion-progress-fill h-full rounded-full bg-gradient-to-r from-teal-500 to-cyan-500"
                  style={{ ["--progress-scale" as string]: `${dossierReadiness / 100}`, ["--motion-delay" as string]: "260ms" }}
                />
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {[
                "Subes tu recibo, contrato o CFDI.",
                "Ves lo importante sin lenguaje complicado.",
                "Todo queda ordenado en tu expediente digital.",
              ].map((item, index) => (
                <div
                  key={item}
                  className="motion-enter-soft flex gap-3 rounded-[1.3rem] border border-slate-200 bg-white p-4 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.42)]"
                  style={{ ["--motion-delay" as string]: `${420 + index * 80}ms` }}
                >
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-teal-700" strokeWidth={1.8} />
                  <p className="text-sm leading-6 text-slate-700">{item}</p>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={goToAuditFlow}
              className="mt-5 block w-full rounded-[1.35rem] border border-teal-100 bg-teal-50 px-4 py-4 text-left transition hover:bg-teal-100/80"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-700">
                    Siguiente paso sugerido
                  </p>
                  <p className="mt-1 text-sm font-semibold text-teal-950">
                    Ya tienes recibo y contrato listos; sigue con tu CFDI reciente.
                  </p>
                </div>
                <ArrowRight className="mt-0.5 h-4.5 w-4.5 shrink-0 text-teal-700" strokeWidth={1.8} />
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/80">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-teal-500 to-cyan-500"
                  style={{ width: `${dossierReadiness}%` }}
                />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-teal-900 shadow-sm">
                  Listos: recibo y contrato
                </span>
                <span className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-teal-900 shadow-sm">
                  Siguiente: CFDI reciente
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-teal-800">
                Toca aquí para continuar con el siguiente archivo recomendado y entender mejor qué te falta.
              </p>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function QuickTrustSection() {
  return (
    <section className="border-y border-slate-200 bg-white py-3.5">
      <div className="container mx-auto grid gap-3 sm:grid-cols-3">
        {[
          "Sube recibo, CFDI o contrato.",
          "Todo se ordena en tu expediente digital.",
          "Lo tienes disponible 24/7.",
        ].map((item) => (
          <div
            key={item}
            className="rounded-[1.3rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700"
          >
            {item}
          </div>
        ))}
      </div>
    </section>
  );
}

function ConfidenceMagicSection() {
  return (
    <section className="bg-white py-12 sm:py-14">
      <div className="container mx-auto max-w-6xl">
        <div className="rounded-[2rem] border border-slate-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f8fafc_100%)] p-6 shadow-[0_28px_80px_-60px_rgba(15,23,42,0.45)] sm:p-8">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-teal-700">
              Una experiencia simple y confiable
            </p>
            <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-4xl">
              Tus documentos dejan de vivir en folders sueltos y empiezan a trabajar a tu favor.
            </h2>
            <p className="mt-4 text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
              Tú solo subes lo que ya tienes. AuditaPatron ordena la información, la convierte en un expediente digital disponible 24/7 y la traduce en señales, comparaciones y siguientes pasos para que sepas qué revisar con calma.
            </p>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {[
              {
                title: "Subes una pieza útil y queda protegida",
                description:
                  "Recibos, CFDI, contratos y evidencia dejan de vivir en folders separados y empiezan a ordenarse en un mismo lugar.",
                detail: "Todo queda dentro de tu expediente digital, disponible 24/7 para revisar, descargar y volver a usar cuando lo necesites.",
                icon: Upload,
              },
              {
                title: "La plataforma conecta el contexto del expediente",
                description:
                  "Conecta fechas, pagos, documentos relacionados y puntos dudosos para encontrar qué ya está claro y qué todavía conviene tomar con cautela.",
                detail: "No promete certezas automáticas: organiza señales útiles y te ayuda a interpretar mejor la información visible.",
                icon: FileSearch,
              },
              {
                title: "Recibes guía laboral útil",
                description:
                  "Ves qué se confirmó, qué parece estimado y cuál puede ser el siguiente documento o paso más útil para fortalecer tu respaldo.",
                detail: "La persona usuaria solo sube, revisa y avanza; el expediente sigue creciendo por detrás sin sumar complejidad.",
                icon: ShieldCheck,
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <article
                  key={item.title}
                  className="rounded-[1.6rem] border border-slate-200 bg-white p-5 shadow-[0_20px_50px_-38px_rgba(15,23,42,0.35)]"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
                    <Icon className="h-5 w-5" strokeWidth={1.8} />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold tracking-[-0.03em] text-slate-950">{item.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-600 sm:text-base sm:leading-7">{item.description}</p>
                  <div className="mt-4 rounded-[1.2rem] border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-700">
                    {item.detail}
                  </div>
                </article>
              );
            })}
          </div>

          <div className="mt-6 rounded-[1.5rem] border border-teal-100 bg-teal-50/80 p-5 text-sm leading-7 text-teal-950 sm:p-6">
            El valor real no es solo guardar archivos. El valor está en que tu expediente se ordena, conecta mejor el contexto y te devuelve una guía que te ayuda a entender tu situación sin dejar de tener todo en un solo lugar.
          </div>
        </div>
      </div>
    </section>
  );
}

function CopilotPreviewSection() {
  return (
    <section id="copiloto" className="bg-slate-50 py-14 sm:py-16">
      <div className="container mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.92fr_1.08fr] lg:items-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-teal-700">
            Copiloto laboral
          </p>
          <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-4xl">
            Una capa extra para hacer preguntas rápidas sobre tu expediente.
          </h2>
          <p className="mt-4 text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
            Cuando ya tienes documentos visibles dentro de AuditaPatron, el copiloto puede ayudarte a resumir riesgos, explicar qué todavía falta confirmar y sugerir el siguiente paso útil sin sacarte del expediente.
          </p>

          <div className="mt-6 space-y-3">
            {[
              "Responde con base en los documentos que ya integraste en tu expediente.",
              "Usa lenguaje simple para decirte qué ya se entiende y qué sigue siendo preliminar.",
              "Te ayuda a priorizar el siguiente documento o movimiento más útil sin sustituir asesoría legal formal.",
            ].map((item) => (
              <div key={item} className="flex gap-3 rounded-[1.3rem] border border-slate-200 bg-white p-4 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.35)]">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-teal-700" strokeWidth={1.8} />
                <p className="text-sm leading-6 text-slate-700">{item}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-[1.5rem] border border-amber-200 bg-amber-50 p-5 text-sm leading-7 text-amber-950">
            El copiloto es una guía contextual basada en tu expediente visible. No sustituye a un abogado ni constituye una opinión legal vinculante.
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button className="rounded-full bg-teal-600 px-6 text-white hover:bg-teal-700" onClick={goToAuditFlow}>
              Probar el copiloto en /auditar
              <ArrowRight className="ml-2 h-4 w-4" strokeWidth={1.8} />
            </Button>
            <Button
              variant="outline"
              className="rounded-full border-slate-200 bg-white px-6 text-slate-700 hover:bg-slate-50"
              onClick={() => scrollToId("preguntas")}
            >
              Ver límites y dudas frecuentes
            </Button>
          </div>
        </div>

        <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-[0_40px_100px_-60px_rgba(15,23,42,0.45)] sm:p-7">
          <div className="flex items-center justify-between gap-4 rounded-[1.4rem] border border-teal-100 bg-teal-50 px-4 py-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-teal-700">
                Vista previa del copiloto
              </p>
              <p className="mt-1 text-lg font-semibold tracking-[-0.02em] text-slate-950">
                El copiloto te explica tu expediente con palabras simples
              </p>
            </div>
            <div className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-teal-700 shadow-sm">
              Contexto visible
            </div>
          </div>

          <div className="mt-5 space-y-3">
            <div className="rounded-[1.35rem] border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Tú preguntas</p>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                “¿Qué riesgo principal ves en mi expediente y qué documento me conviene subir después?”
              </p>
            </div>
            <div className="rounded-[1.35rem] border border-teal-100 bg-teal-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">El copiloto responde</p>
              <p className="mt-2 text-sm leading-6 text-teal-950">
                “Ya hay señales útiles para revisar pagos y condiciones, pero todavía faltan piezas para confirmarlo con más seguridad. Un contrato o CFDI reciente podría darte más claridad y fortalecer tu expediente.”
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                "Basado en tu expediente",
                "Lenguaje simple",
                "Siguiente paso sugerido",
              ].map((item) => (
                <div key={item} className="rounded-[1.2rem] border border-slate-200 bg-white p-4 text-center text-sm font-medium text-slate-700">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function HowItWorksSection() {
  return (
    <section id="como-funciona" className="bg-slate-50 py-14 sm:py-16">
      <div className="container">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-teal-700">
            Así de fácil
          </p>
          <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-4xl">
            Entiende tu situación sin complicarte.
          </h2>
          <p className="mt-4 text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
            En pocos pasos puedes subir tu documento, entender lo importante y empezar a construir un expediente digital ordenado que siga contigo cuando lo necesites.
          </p>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {[
            {
              number: "01",
              title: "Sube lo que ya tienes",
              description: "Puedes empezar con un recibo, CFDI, contrato u otro documento laboral útil sin preparar nada antes.",
            },
            {
              number: "02",
              title: "La plataforma entiende lo importante",
              description: "Ordena señales, separa lo confirmado de lo estimado y te explica con claridad dónde conviene poner atención.",
            },
            {
              number: "03",
              title: "Recibes guía útil para avanzar",
              description: "Cada documento adicional puede dar más contexto, ayudarte a entender mejor tu caso y sugerirte el siguiente paso más útil.",
            },
          ].map((item) => (
            <article
              key={item.number}
              className="rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-[0_24px_60px_-46px_rgba(15,23,42,0.35)]"
            >
              <div className="inline-flex rounded-full bg-teal-50 px-3 py-1 text-sm font-semibold text-teal-700">
                {item.number}
              </div>
              <h3 className="mt-4 text-lg font-semibold tracking-[-0.03em] text-slate-950">
                {item.title}
              </h3>
              <p className="mt-3 text-sm leading-6 text-slate-600 sm:text-base sm:leading-7">{item.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function DossierSection() {
  return (
    <section id="expediente" className="bg-white py-14 sm:py-16">
      <div className="container mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
        <div className="mx-auto max-w-2xl text-center lg:mx-0 lg:text-left">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-teal-700">
            Tu expediente en crecimiento
          </p>
          <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-4xl">
            Cada documento útil se convierte en orden, claridad y respaldo.
          </h2>
          <p className="mt-4 text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
            No se trata de subir por subir. Se trata de reunir piezas que te den más claridad, mejor orden y un expediente digital disponible 24/7 si después necesitas revisar, reclamar o respaldar algo con calma.
          </p>

          <div className="mt-6 space-y-3">
            {[
              "Más claridad sobre pagos, deducciones y condiciones laborales.",
              "Todo en un solo lugar, sin folders sueltos ni búsquedas eternas.",
              "Mejor respaldo documental disponible 24/7 para futuras revisiones.",
            ].map((item) => (
              <div key={item} className="flex gap-3 rounded-[1.3rem] border border-slate-200 bg-slate-50 p-4">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-teal-700" strokeWidth={1.8} />
                <p className="text-sm leading-6 text-slate-700">{item}</p>
              </div>
            ))}
          </div>

          <Button
            className="mt-7 rounded-full bg-teal-600 px-6 text-white hover:bg-teal-700"
            onClick={goToAuditFlow}
          >
            Empezar mi expediente digital
            <ArrowRight className="ml-2 h-4 w-4" strokeWidth={1.8} />
          </Button>
        </div>

        <div className="mx-auto w-full max-w-xl rounded-[2rem] border border-slate-200 bg-slate-50 p-5 shadow-[0_40px_100px_-70px_rgba(15,23,42,0.55)] sm:p-7">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">
                Qué ya aporta contexto
              </p>
              <h3 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950">
                Tu expediente en crecimiento
              </h3>
            </div>
            <div className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-teal-700 shadow-sm">
              Simple y útil
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {dossierSignals.map((item) => (
              <div key={item.title} className="rounded-[1.3rem] border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-slate-900">{item.title}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{item.description}</p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      item.status === "listo"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {item.status === "listo" ? "Ya aporta claridad" : "Puede fortalecerlo"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function PriorityDocumentsSection() {
  return (
    <section className="bg-slate-50 py-14 sm:py-16">
      <div className="container mx-auto max-w-6xl">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-teal-700">
            Documentos que más pueden ayudarte
          </p>
          <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-4xl">
            Si quieres darle más valor a tu expediente, empieza por los archivos con más contexto.
          </h2>
          <p className="mt-4 text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
            No todos los documentos aportan lo mismo. Si todavía no los has subido, estos suelen ser de los primeros archivos que más conviene reunir para darte claridad, ordenar mejor tu caso y hacer que el expediente te devuelva una lectura más completa.
          </p>
        </div>

        <div className="mt-10 grid gap-4 lg:grid-cols-2">
          {priorityDocuments.map((item) => (
            <article
              key={item.title}
              className="motion-hover-lift rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-[0_24px_70px_-56px_rgba(15,23,42,0.55)] sm:p-6"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
                  <FileSearch className="h-5 w-5" strokeWidth={1.8} />
                </div>
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-700">Alta utilidad para tu expediente</p>
                  <h3 className="mt-2 text-lg font-semibold tracking-[-0.03em] text-slate-950">{item.title}</h3>
                </div>
              </div>

              <p className="mt-4 text-sm leading-6 text-slate-600 sm:text-base sm:leading-7">{item.description}</p>
              <div className="mt-4 rounded-[1.2rem] border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                {item.value}
              </div>
            </article>
          ))}
        </div>

        <div className="mt-5 rounded-[1.5rem] border border-teal-100 bg-teal-50/80 p-5 text-sm leading-7 text-teal-950 sm:p-6">
          En cuanto entres a <span className="font-semibold">/auditar</span>, estas sugerencias dejan de ser generales y se conectan con los documentos que realmente faltan en tu expediente para que sepas qué te conviene subir primero.
        </div>
      </div>
    </section>
  );
}

function MobileOnboardingSection() {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeCard = mobileOnboardingCards[activeIndex] ?? mobileOnboardingCards[0];

  return (
    <section className="bg-white py-14 sm:py-16">
      <div className="container mx-auto max-w-6xl">
        <div className="rounded-[2rem] border border-slate-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f8fafc_100%)] p-6 shadow-[0_32px_100px_-70px_rgba(15,23,42,0.55)] sm:p-8">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-teal-700">
              En tu celular se entiende en segundos
            </p>
            <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-4xl">
              Un onboarding breve para que sepas qué pasa desde el primer archivo.
            </h2>
            <p className="mt-4 text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
              La idea es simple: subes, entiendes y conservas. Sin pasos técnicos, sin menús enredados y con tu expediente siempre disponible cuando lo necesites de nuevo.
            </p>
          </div>

          <div className="mt-8 md:hidden">
            <article className="rounded-[1.6rem] border border-slate-200 bg-white p-5 shadow-[0_20px_50px_-38px_rgba(15,23,42,0.35)]">
              <div className="flex items-center justify-between gap-3">
                <div className="inline-flex rounded-full bg-teal-50 px-3 py-1 text-sm font-semibold text-teal-700">
                  {activeCard.step}
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  {activeIndex + 1}/{mobileOnboardingCards.length}
                </span>
              </div>
              <h3 className="mt-4 text-lg font-semibold tracking-[-0.03em] text-slate-950">{activeCard.title}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-600">{activeCard.description}</p>
            </article>

            <div className="mt-4 flex items-center justify-between gap-3">
              <Button
                type="button"
                variant="outline"
                className="rounded-full border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-45"
                onClick={() => setActiveIndex((current) => Math.max(0, current - 1))}
                disabled={activeIndex === 0}
              >
                <ChevronRight className="mr-2 h-4 w-4 rotate-180" strokeWidth={1.8} />
                Anterior
              </Button>
              <div className="flex items-center gap-2">
                {mobileOnboardingCards.map((item, index) => (
                  <button
                    key={item.step}
                    type="button"
                    onClick={() => setActiveIndex(index)}
                    className={`h-2.5 rounded-full transition-all ${
                      index === activeIndex ? "w-6 bg-teal-600" : "w-2.5 bg-slate-300"
                    }`}
                    aria-label={`Ir al paso ${item.step}`}
                  />
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                className="rounded-full border-teal-200 bg-teal-50 px-4 text-sm text-teal-800 hover:bg-teal-100 disabled:opacity-45"
                onClick={() => setActiveIndex((current) => Math.min(mobileOnboardingCards.length - 1, current + 1))}
                disabled={activeIndex === mobileOnboardingCards.length - 1}
              >
                Siguiente
                <ChevronRight className="ml-2 h-4 w-4" strokeWidth={1.8} />
              </Button>
            </div>
          </div>

          <div className="mt-8 hidden gap-4 md:grid md:grid-cols-3">
            {mobileOnboardingCards.map((item) => (
              <article key={item.step} className="rounded-[1.6rem] border border-slate-200 bg-white p-5 shadow-[0_20px_50px_-38px_rgba(15,23,42,0.35)]">
                <div className="inline-flex rounded-full bg-teal-50 px-3 py-1 text-sm font-semibold text-teal-700">
                  {item.step}
                </div>
                <h3 className="mt-4 text-lg font-semibold tracking-[-0.03em] text-slate-950">{item.title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600 sm:text-base sm:leading-7">{item.description}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function GuidedTourSection() {
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const activeStep = useMemo(() => tourSteps[activeStepIndex], [activeStepIndex]);
  const ActiveIcon = activeStep.icon;

  return (
    <section id="recorrido" className="bg-slate-950 py-14 text-white sm:py-16">
      <div className="container mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.82fr_1.18fr] lg:items-start">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-teal-300">
            Recorrido guiado
          </p>
          <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
            Primero entiendes, después decides.
          </h2>
          <p className="mt-4 text-base leading-7 text-slate-300 sm:text-lg sm:leading-8">
            Este recorrido te muestra de forma rápida qué pasa cuando subes un documento y por qué tu expediente puede ayudarte más con el tiempo.
          </p>

          <div className="mt-6 space-y-3">
            {tourSteps.map((step, index) => (
              <button
                key={step.id}
                type="button"
                onClick={() => setActiveStepIndex(index)}
                className={`w-full rounded-[1.4rem] border px-5 py-4 text-left transition ${
                  activeStepIndex === index
                    ? "border-teal-400 bg-white/10 shadow-[0_25px_60px_-45px_rgba(45,212,191,0.9)]"
                    : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/7"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-white">{step.title}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-300">{step.summary}</p>
                  </div>
                  <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-400" strokeWidth={1.8} />
                </div>
              </button>
            ))}
          </div>

          <Button
            variant="outline"
            className="mt-6 rounded-full border-white/15 bg-transparent px-5 text-white hover:bg-white/10"
            onClick={() => setActiveStepIndex(0)}
          >
            Volver a ver el recorrido
          </Button>
        </div>

        <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/5 p-5 sm:p-6">
          <div className="rounded-[1.6rem] bg-white px-5 py-5 text-slate-950 sm:px-6 sm:py-6">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-600 text-white shadow-[0_18px_40px_-24px_rgba(13,148,136,0.9)]">
                <ActiveIcon className="h-5 w-5" strokeWidth={1.8} />
              </div>
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">
                  Paso {activeStepIndex + 1}
                </p>
                <h3 className="text-2xl font-semibold tracking-[-0.03em] text-slate-950">
                  {activeStep.title}
                </h3>
              </div>
            </div>

            <p className="mt-5 text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">{activeStep.description}</p>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {activeStep.bullets.map((item) => (
                <div key={item} className="rounded-[1.3rem] border border-slate-200 bg-slate-50 p-4">
                  <CheckCircle2 className="h-5 w-5 text-teal-700" strokeWidth={1.8} />
                  <p className="mt-3 text-sm leading-6 text-slate-700">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function FindingsExamplesSection() {
  return (
    <section id="hallazgos" className="bg-white py-14 sm:py-16">
      <div className="container">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-teal-700">
            Ejemplos de hallazgos
          </p>
          <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-4xl">
            Algunos patrones se entienden mejor cuando tu expediente tiene más contexto.
          </h2>
          <p className="mt-4 text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
            Varios documentos juntos ayudan a ver diferencias, repeticiones y señales que un solo archivo puede dejar ocultas, y además fortalecen un expediente digital que puedes consultar cuando lo necesites.
          </p>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {findingsExamples.map((item) => (
            <article
              key={item.title}
                  className="motion-hover-lift rounded-[1.8rem] border border-slate-200 bg-slate-50 p-5 shadow-[0_24px_70px_-56px_rgba(15,23,42,0.6)]"

            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-teal-700 shadow-sm">
                <FileSearch className="h-5 w-5" strokeWidth={1.8} />
              </div>
              <h3 className="mt-4 text-lg font-semibold tracking-[-0.03em] text-slate-950">
                {item.title}
              </h3>
              <p className="mt-3 text-sm leading-6 text-slate-600 sm:text-base sm:leading-7">{item.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function PrivacySection() {
  return (
    <section id="privacidad" className="bg-slate-50 py-14 sm:py-16">
      <div className="container grid gap-6 lg:grid-cols-[1fr_0.92fr] lg:items-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-teal-700">
            Tu privacidad es parte del producto
          </p>
          <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-4xl">
            Tus archivos se resguardan para ayudarte, no para confundirte.
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
            Cada documento puede darte más claridad y mejor respaldo, pero siempre con control, resguardo y la tranquilidad de tener tu expediente digital disponible 24/7.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {[
              "Tus documentos se organizan con propósito.",
              "La explicación es clara y humana.",
              "Tu expediente queda disponible 24/7 para ti.",
              "La confianza se cuida desde el inicio.",
            ].map((item) => (
              <div key={item} className="flex gap-3 rounded-[1.3rem] border border-teal-100 bg-white p-4">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-teal-700" strokeWidth={1.8} />
                <p className="text-sm leading-6 text-slate-700">{item}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">Centro de privacidad</p>
            <h3 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-slate-950">{PRIVACY_CENTER_COPY.title}</h3>
            <p className="mt-3 text-sm leading-7 text-slate-600">{PRIVACY_CENTER_COPY.intro}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {PRIVACY_CENTER_COPY.rightsSummary.map((item) => (
                <div key={item} className="rounded-[1.2rem] border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                  {item}
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm leading-7 text-slate-600">{PRIVACY_CENTER_COPY.revocationNotice}</p>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Para derechos ARCO o revocación, escríbenos a{" "}
              <a className="font-semibold text-slate-900 underline underline-offset-4" href={`mailto:${LEGAL_CONTACT_EMAIL}`}>
                {LEGAL_CONTACT_EMAIL}
              </a>
              .
            </p>
          </div>
        </div>

        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_40px_100px_-60px_rgba(15,23,42,0.45)] sm:p-7">
          <div className="rounded-[1.5rem] border border-teal-100 bg-teal-50 p-5">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-teal-700">
              Lo que necesitas sentir aquí
            </p>
            <div className="mt-4 space-y-3">
              {[
                "Entiendo mejor mi situación.",
                "Mi información está cuidada y ordenada.",
                "Tengo mis documentos a la mano cuando los necesite.",
              ].map((item) => (
                <div key={item} className="flex gap-3 rounded-[1.2rem] border border-white bg-white p-4 shadow-sm">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-teal-700" strokeWidth={1.8} />
                  <p className="text-sm leading-6 text-slate-700">{item}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 rounded-[1.4rem] bg-teal-50 p-5">
            <div className="flex items-start gap-3">
              <Lock className="mt-0.5 h-5 w-5 shrink-0 text-teal-800" strokeWidth={1.8} />
              <div>
                <p className="text-sm leading-7 text-teal-950">
                  Tus documentos pueden fortalecer tu expediente y tu contexto laboral sin perder trazabilidad, control ni disponibilidad cuando los necesites.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {LEGAL_DOCUMENTS.map((document) => (
                    <a
                      key={document.slug}
                      href={document.route}
                      className="rounded-full border border-white bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-teal-900 transition hover:border-teal-200 hover:bg-teal-100"
                    >
                      {document.shortTitle}
                    </a>
                  ))}
                </div>
                <p className="mt-3 text-xs leading-6 text-teal-900">
                  Versión legal vigente: {LEGAL_VERSION}. La aceptación completa se solicita de forma natural cuando entras a tu expediente.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function FAQSection() {
  return (
    <section id="preguntas" className="bg-white py-14 sm:py-16">
      <div className="container grid gap-8 lg:grid-cols-[0.8fr_1fr]">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-teal-700">
            Preguntas frecuentes
          </p>
          <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-4xl">
            Respuestas claras antes de que empieces.
          </h2>
          <p className="mt-4 text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
            Si llegas con dudas o desconfianza, aquí puedes resolver lo esencial sin leer explicaciones largas.
          </p>
        </div>

        <div className="rounded-[2rem] border border-slate-200 bg-slate-50 p-4 sm:p-6">
          <Accordion type="single" collapsible className="space-y-3">
            {faqs.map((item, index) => (
              <AccordionItem
                key={item.question}
                value={`item-${index}`}
                className="rounded-[1.3rem] border border-slate-200 bg-white px-5"
              >
                <AccordionTrigger className="text-left text-base font-semibold text-slate-950 hover:no-underline">
                  {item.question}
                </AccordionTrigger>
                <AccordionContent className="pb-5 text-sm leading-7 text-slate-600">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
}

function FinalCtaSection() {
  return (
    <section className="bg-slate-50 py-14 sm:py-16">
      <div className="container">
        <div className="overflow-hidden rounded-[2.2rem] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(45,212,191,0.18),_transparent_32%),linear-gradient(135deg,_#ffffff,_#f8fafc)] px-6 py-10 shadow-[0_36px_90px_-64px_rgba(15,23,42,0.38)] sm:px-10 sm:py-12">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-teal-700">
              Empieza cuando quieras
            </p>
            <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-5xl">
              Tu primer documento ya puede darte más claridad.
            </h2>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
              Empieza con lo que ya tienes a la mano y ve fortaleciendo un expediente digital que seguirá contigo, ordenado y disponible 24/7.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button
                className="motion-hover-lift h-12 rounded-full bg-teal-600 px-7 text-base text-white hover:bg-teal-700"
                onClick={goToAuditFlow}
              >
                Ir a /auditar ahora
                <ArrowRight className="ml-2 h-4 w-4" strokeWidth={1.8} />
              </Button>
              <Button
                variant="outline"
                className="motion-hover-lift h-12 rounded-full border-slate-200 bg-white px-7 text-base text-slate-700 hover:bg-slate-50"
                onClick={() => scrollToId("preguntas")}
              >
                Resolver mis dudas primero
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function SiteFooter() {
  return (
    <footer className="bg-white py-8">
      <div className="container flex flex-col gap-6 border-t border-slate-200 pt-8 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-3">
          <AuditaPatronLogoWordmark
            className="inline-flex min-w-0 items-center"
            imageClassName="max-w-[220px] sm:max-w-[250px]"
            subtitleClassName="text-[0.75rem] tracking-[0.14em]"
          />
          <p className="max-w-md text-sm leading-6 text-slate-500">
            AuditaPatron te ayuda a conocer tus derechos con un expediente digital simple, privado y útil para revisar tu situación con más claridad.
          </p>
        </div>
        <div className="flex flex-wrap gap-4">
          <a href="#como-funciona" className="transition-colors hover:text-slate-900">
            Cómo funciona
          </a>
          <a href="#expediente" className="transition-colors hover:text-slate-900">
            Tu expediente
          </a>
          <a href="#privacidad" className="transition-colors hover:text-slate-900">
            Privacidad
          </a>
          {LEGAL_DOCUMENTS.map((document) => (
            <a key={document.slug} href={document.route} className="transition-colors hover:text-slate-900">
              {document.shortTitle}
            </a>
          ))}
          <a href={`mailto:${LEGAL_CONTACT_EMAIL}`} className="transition-colors hover:text-slate-900">
            Derechos ARCO
          </a>
        </div>
      </div>
    </footer>
  );
}

export default function Home() {
  return (
    <main className="audita-home min-h-screen bg-white font-sans text-slate-950">
      <SiteHeader />
      <HeroSection />
      <QuickTrustSection />
      <HowItWorksSection />
      <DossierSection />
      <PriorityDocumentsSection />
      <CopilotPreviewSection />
      <PrivacySection />
      <FAQSection />
      <FinalCtaSection />
      <SiteFooter />
    </main>
  );
}

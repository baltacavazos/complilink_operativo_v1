import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  FileCheck2,
  FileSearch,
  HeartHandshake,
  Lock,
  Menu,
  Scale,
  Shield,
  ShieldCheck,
  Sparkles,
  Upload,
  WalletCards,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";

type TourStep = {
  id: string;
  title: string;
  summary: string;
  description: string;
  bullets: string[];
  accent: string;
  icon: typeof Upload;
};

type DossierSignal = {
  title: string;
  description: string;
  status: "listo" | "faltante";
};

const navLinks = [
  { href: "#como-funciona", label: "Cómo funciona" },
  { href: "#expediente", label: "Tu expediente" },
  { href: "#hallazgos", label: "Hallazgos" },
  { href: "#privacidad", label: "Privacidad" },
  { href: "#preguntas", label: "Preguntas" },
];

const tourSteps: TourStep[] = [
  {
    id: "sube",
    title: "Sube tu recibo o documento",
    summary: "Empiezas con el archivo que ya tienes más a la mano.",
    description:
      "AuditaPatron está pensado para personas normales, no para especialistas. El primer paso debe sentirse ligero, guiado y sin miedo a equivocarte.",
    bullets: [
      "Te explicamos qué archivo sirve y por qué.",
      "El proceso está pensado para celular.",
      "No necesitas lenguaje técnico ni trámites previos.",
    ],
    accent: "from-emerald-400/20 via-teal-400/10 to-white",
    icon: Upload,
  },
  {
    id: "revisamos",
    title: "Te mostramos hallazgos claros",
    summary: "La información complicada se traduce a mensajes sencillos.",
    description:
      "En lugar de soltar términos legales o fiscales difíciles, AuditaPatron te traduce lo importante a riesgos, diferencias y señales que sí puedes comprender rápido.",
    bullets: [
      "Explicaciones simples y accionables.",
      "Prioridad visual para lo urgente.",
      "Tono protector, no confrontacional.",
    ],
    accent: "from-cyan-400/20 via-sky-400/10 to-white",
    icon: FileSearch,
  },
  {
    id: "proteges",
    title: "Tu expediente se fortalece contigo",
    summary: "Cada documento agrega contexto útil, no solo almacenamiento.",
    description:
      "Cada archivo puede ayudar a detectar patrones, ordenar tu caso y preparar evidencia útil para el futuro, sin perder el control de tu información.",
    bullets: [
      "Privacidad por diseño y trazabilidad documental.",
      "Contexto acumulado para futuras revisiones.",
      "Base para respaldo técnico y legal.",
    ],
    accent: "from-amber-300/20 via-orange-300/10 to-white",
    icon: ShieldCheck,
  },
];

const checks = [
  {
    title: "Recibos de nómina",
    description:
      "Te ayuda a detectar diferencias de pago, descuentos extraños o cambios que ya no te cuadran.",
    icon: WalletCards,
  },
  {
    title: "CFDI y documentos fiscales",
    description:
      "Sirven para contrastar lo timbrado contra lo que realmente recibiste o te reportaron.",
    icon: FileCheck2,
  },
  {
    title: "Contrato e IMSS",
    description:
      "Aterrizan condiciones iniciales, prestaciones y señales de seguridad social que a veces pasan desapercibidas.",
    icon: Shield,
  },
  {
    title: "Evidencia complementaria",
    description:
      "Correos, capturas o chats pueden ayudar a entender mejor fechas, instrucciones y cambios relevantes.",
    icon: FileSearch,
  },
];

const benefitCards = [
  {
    title: "Entiendes tu situación sin lenguaje raro",
    description:
      "La plataforma debe explicarte las cosas con palabras cotidianas para que puedas decidir con calma.",
    icon: Sparkles,
  },
  {
    title: "Tu expediente gana fuerza real",
    description:
      "Cada archivo agrega claridad, contexto y evidencia útil para respaldarte mejor si más adelante la necesitas.",
    icon: Scale,
  },
  {
    title: "Te sientes acompañado, no intimidado",
    description:
      "El tono es protector y constructivo: primero claridad, después decisión.",
    icon: HeartHandshake,
  },
  {
    title: "Tu información permanece de tu lado",
    description:
      "Privacidad, trazabilidad y resguardo documental como parte central de la experiencia.",
    icon: Lock,
  },
];

const dossierSignals: DossierSignal[] = [
  {
    title: "Recibos de nómina recientes",
    description: "Ayudan a detectar cambios de pago, deducciones y conceptos repetidos en el tiempo.",
    status: "listo",
  },
  {
    title: "CFDI timbrado",
    description: "Sirve para contrastar lo reportado fiscalmente contra lo recibido por la persona trabajadora.",
    status: "listo",
  },
  {
    title: "Contrato o condiciones iniciales",
    description: "Aclara jornada, sueldo pactado, prestaciones y punto de partida de la relación laboral.",
    status: "faltante",
  },
  {
    title: "Soporte IMSS o evidencia complementaria",
    description: "Fortalece el contexto cuando hay dudas sobre alta, bajas, semanas o instrucciones laborales.",
    status: "faltante",
  },
];

const findingsExamples = [
  {
    title: "Diferencias entre nómina y CFDI",
    description:
      "Cuando se acumulan recibos y CFDI, se vuelve más fácil detectar si hubo conceptos pagados de una forma y reportados de otra.",
  },
  {
    title: "Cambios repetidos en pagos o deducciones",
    description:
      "Varios recibos seguidos permiten ver patrones que un solo documento no muestra, como descuentos constantes o variaciones injustificadas.",
  },
  {
    title: "Condiciones pactadas frente a la realidad",
    description:
      "Si además existe contrato o evidencia complementaria, se aclara mejor si lo que se prometió coincide con lo que realmente ocurrió.",
  },
];

const faqs = [
  {
    question: "¿AuditaPatron es para demandar a mi empresa?",
    answer:
      "No nace desde la confrontación. Primero te ayuda a entender tu situación, ordenar tus documentos y detectar si hay algo que merece atención. La idea es darte claridad y protección para que tomes mejores decisiones.",
  },
  {
    question: "¿Necesito saber de leyes o de nómina para usarlo?",
    answer:
      "No. La experiencia está pensada para personas que no dominan lenguaje técnico. La plataforma debe traducir lo complejo a mensajes simples, visuales y accionables.",
  },
  {
    question: "¿Por qué me conviene subir más de un documento?",
    answer:
      "Porque cada archivo útil añade contexto. Un solo documento puede mostrar una señal, pero varios documentos ayudan a entender mejor patrones, inconsistencias y evidencia acumulada para tu protección.",
  },
  {
    question: "¿Mi información está protegida?",
    answer:
      "Sí. La propuesta de AuditaPatron prioriza privacidad, trazabilidad y control documental. Tus archivos no deben quedar como documentos sueltos: se resguardan y pueden alimentar tu expediente de forma segura.",
  },
  {
    question: "¿Qué tipo de archivos puedo reunir aquí?",
    answer:
      "Recibos de nómina, CFDI, constancias, contrato, soporte IMSS y otros documentos laborales que ayuden a entender mejor tu caso. La lógica del producto es que cada archivo tenga utilidad real y no se desperdicie.",
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
    <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/90 backdrop-blur-xl">
      <div className="container flex h-16 items-center justify-between gap-4">
        <a href="#top" className="flex items-center gap-3 text-slate-950">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-teal-600 text-white shadow-[0_14px_30px_-18px_rgba(13,148,136,0.9)]">
            <Shield className="h-5 w-5" strokeWidth={1.8} />
          </div>
          <div>
            <p className="text-sm font-semibold tracking-[-0.02em]">AuditaPatron</p>
            <p className="text-xs text-slate-500">Claridad laboral para trabajadores</p>
          </div>
        </a>

        <nav className="hidden items-center gap-7 md:flex">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-950"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Button
            variant="outline"
            className="rounded-full border-slate-200 bg-white px-5 text-sm text-slate-700 hover:bg-slate-50"
            onClick={() => scrollToId("expediente")}
          >
            Ver tu expediente
          </Button>
          <Button
            className="rounded-full bg-teal-600 px-5 text-sm text-white hover:bg-teal-700"
            onClick={goToAuditFlow}
          >
            Auditar mis documentos
            <ArrowRight className="ml-2 h-4 w-4" strokeWidth={1.8} />
          </Button>
        </div>

        <button
          type="button"
          className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 text-slate-700 transition hover:bg-slate-50 md:hidden"
          onClick={() => setOpen((value) => !value)}
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open ? (
        <div className="border-t border-slate-200 bg-white md:hidden">
          <div className="container space-y-1 py-4">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="block rounded-2xl px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 hover:text-slate-950"
              >
                {link.label}
              </a>
            ))}
            <div className="grid gap-3 pt-3">
              <Button
                variant="outline"
                className="h-11 rounded-full border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                onClick={() => {
                  setOpen(false);
                  scrollToId("expediente");
                }}
              >
                Entender mi expediente
              </Button>
              <Button
                className="h-11 rounded-full bg-teal-600 text-white hover:bg-teal-700"
                onClick={() => {
                  setOpen(false);
                  goToAuditFlow();
                }}
              >
                Ir a auditar ahora
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
    <section id="top" className="relative overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(20,184,166,0.14),_transparent_38%),radial-gradient(circle_at_top_right,_rgba(125,211,252,0.16),_transparent_28%),linear-gradient(180deg,_#ffffff_0%,_#f8fafc_100%)] pb-20 pt-12 sm:pb-24 sm:pt-20">
      <div className="container grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-teal-100 bg-teal-50/80 px-4 py-2 text-sm font-medium text-teal-800">
            <ShieldCheck className="h-4 w-4" strokeWidth={1.8} />
            Diseñado para trabajadores, no para expertos
          </div>

          <h1 className="mt-6 text-balance text-4xl font-semibold leading-[1.02] tracking-[-0.05em] text-slate-950 sm:text-5xl lg:text-[4rem]">
            Tus derechos laborales,
            <span className="block text-teal-700">claros, protegidos y mejor respaldados.</span>
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600 sm:text-xl">
            AuditaPatron convierte recibos, CFDI y documentos laborales en claridad.
            Cada archivo útil fortalece tu expediente, mejora el contexto del análisis y te ayuda a
            conservar evidencia con una experiencia amable, privada y fácil de seguir.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button
              className="h-12 rounded-full bg-teal-600 px-7 text-base text-white hover:bg-teal-700"
              onClick={goToAuditFlow}
            >
              Auditar mis documentos
              <ArrowRight className="ml-2 h-4 w-4" strokeWidth={1.8} />
            </Button>
            <Button
              variant="outline"
              className="h-12 rounded-full border-slate-200 bg-white px-7 text-base text-slate-700 hover:bg-slate-50"
              onClick={() => scrollToId("privacidad")}
            >
              Conoce cómo te protegemos
            </Button>
          </div>

          <div className="mt-8 flex flex-wrap gap-3 text-sm text-slate-600">
            {[
              "100% confidencial",
              "Hecho para celular",
              "Lenguaje simple",
              "Expediente documental útil",
            ].map((item) => (
              <span
                key={item}
                className="rounded-full border border-slate-200 bg-white/80 px-4 py-2 shadow-sm"
              >
                {item}
              </span>
            ))}
          </div>
        </div>

        <div className="relative">
          <div className="absolute -left-4 top-6 h-24 w-24 rounded-full bg-teal-200/50 blur-3xl" />
          <div className="absolute -right-4 bottom-8 h-24 w-24 rounded-full bg-sky-200/60 blur-3xl" />
          <div className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_40px_120px_-55px_rgba(15,23,42,0.4)] sm:p-7">
            <div className="flex items-center justify-between gap-4 rounded-[1.5rem] bg-slate-50 px-4 py-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                  Fortaleza inicial del expediente
                </p>
                <p className="mt-1 text-lg font-semibold tracking-[-0.02em] text-slate-950">
                  En crecimiento, con valor real
                </p>
              </div>
              <div className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                Protegido
              </div>
            </div>

            <div className="mt-5 rounded-[1.5rem] border border-teal-100 bg-teal-50 p-4">
              <div className="flex items-center justify-between gap-4 text-sm font-semibold text-teal-900">
                <span>Claridad acumulada</span>
                <span>{dossierReadiness}%</span>
              </div>
              <div className="mt-3 h-3 overflow-hidden rounded-full bg-white">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-teal-500 to-cyan-500"
                  style={{ width: `${dossierReadiness}%` }}
                />
              </div>
              <p className="mt-3 text-sm leading-6 text-teal-900">
                Entre más documentos útiles agregas, más completo se vuelve tu respaldo para entender patrones, inconsistencias y contexto laboral.
              </p>
            </div>

            <div className="mt-6 space-y-4">
              {[
                {
                  title: "Subes tu documento",
                  text: "Recibo, CFDI o archivo laboral con instrucciones claras para que no dudes.",
                },
                {
                  title: "Te explicamos lo importante",
                  text: "Los hallazgos se muestran con prioridad visual y lenguaje fácil de entender.",
                },
                {
                  title: "Tu expediente se fortalece",
                  text: "Cada documento puede sumar evidencia, contexto y preparación para futuras revisiones.",
                },
              ].map((item, index) => (
                <div
                  key={item.title}
                  className="flex gap-4 rounded-[1.4rem] border border-slate-100 bg-white p-4 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.5)]"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-teal-600 text-sm font-semibold text-white">
                    {index + 1}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">{item.title}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{item.text}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-[1.5rem] bg-gradient-to-r from-teal-600 to-cyan-600 px-5 py-4 text-white">
              <p className="text-sm font-semibold">Promesa principal</p>
              <p className="mt-1 text-sm leading-6 text-teal-50">
                Tu expediente se convierte en una herramienta poderosa para entender y proteger tus derechos laborales con mayor claridad.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function QuickProofSection() {
  return (
    <section className="border-y border-slate-200 bg-white py-5">
      <div className="container flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <p className="text-sm font-medium text-slate-500">
          Construida para una adopción masiva: claridad inmediata, confianza visible y motivación ética para reunir evidencia útil.
        </p>
        <div className="flex flex-wrap gap-3 text-sm text-slate-700">
          {[
            "Proceso guiado",
            "Privacidad por diseño",
            "Tono constructivo",
            "Fortalecimiento documental",
          ].map((item) => (
            <span key={item} className="rounded-full bg-slate-100 px-4 py-2">
              {item}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorksSection() {
  return (
    <section id="como-funciona" className="bg-slate-50 py-20 sm:py-24">
      <div className="container">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-teal-700">
            Así de fácil
          </p>
          <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-4xl">
            La experiencia debe sentirse simple desde el primer minuto.
          </h2>
          <p className="mt-4 text-lg leading-8 text-slate-600">
            La persona debe entender rápido qué hace la herramienta, cómo la protege y por qué sí vale la pena seguir reuniendo documentos útiles para su respaldo.
          </p>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {[
            {
              number: "01",
              title: "Entiendes sin estudiar leyes",
              description:
                "El mensaje central evita tecnicismos y te habla como una herramienta cercana, no como un trámite frío.",
            },
            {
              number: "02",
              title: "Avanzas con confianza",
              description:
                "Cada bloque resuelve una duda distinta: qué subes, qué recibe la plataforma y qué beneficio concreto te entrega.",
            },
            {
              number: "03",
              title: "Fortaleces tu respaldo",
              description:
                "La página explica por qué un expediente más completo puede darte mejor contexto, más claridad y evidencia mejor organizada.",
            },
          ].map((item) => (
            <article
              key={item.number}
              className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_30px_70px_-50px_rgba(15,23,42,0.4)]"
            >
              <div className="inline-flex rounded-full bg-teal-50 px-3 py-1 text-sm font-semibold text-teal-700">
                {item.number}
              </div>
              <h3 className="mt-5 text-xl font-semibold tracking-[-0.03em] text-slate-950">
                {item.title}
              </h3>
              <p className="mt-3 text-base leading-7 text-slate-600">{item.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function DossierSection() {
  return (
    <section id="expediente" className="bg-white py-20 sm:py-24">
      <div className="container grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-teal-700">
            Tu expediente en crecimiento
          </p>
          <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-4xl">
            Cada documento útil fortalece tu protección laboral.
          </h2>
          <p className="mt-4 text-lg leading-8 text-slate-600">
            Aquí no se trata de subir por subir. Se trata de reunir piezas que expliquen mejor tu situación y vuelvan más sólido tu respaldo si mañana necesitas aclarar, comparar o defender algo.
          </p>

          <div className="mt-8 space-y-4">
            {[
              "Más claridad sobre tu situación laboral.",
              "Evidencia acumulada para respaldar tus derechos.",
              "Mejor preparación para futuras auditorías o acciones.",
            ].map((item) => (
              <div key={item} className="flex gap-3 rounded-[1.4rem] border border-slate-200 bg-slate-50 p-4">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-teal-700" strokeWidth={1.8} />
                <p className="text-sm leading-7 text-slate-700">{item}</p>
              </div>
            ))}
          </div>

          <Button
            className="mt-8 rounded-full bg-teal-600 px-6 text-white hover:bg-teal-700"
            onClick={goToAuditFlow}
          >
            Empezar mi expediente
            <ArrowRight className="ml-2 h-4 w-4" strokeWidth={1.8} />
          </Button>
        </div>

        <div className="rounded-[2rem] border border-slate-200 bg-slate-50 p-6 shadow-[0_40px_100px_-70px_rgba(15,23,42,0.55)] sm:p-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">
                Widget recomendado
              </p>
              <h3 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950">
                Tu expediente en crecimiento
              </h3>
            </div>
            <div className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-teal-700 shadow-sm">
              Claro, no gamificado
            </div>
          </div>

          <div className="mt-6 h-3 overflow-hidden rounded-full bg-white">
            <div className="h-full w-[58%] rounded-full bg-gradient-to-r from-teal-500 to-cyan-500" />
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Un expediente con varios tipos de documentos suele permitir un análisis más profundo y recomendaciones más útiles.
          </p>

          <div className="mt-6 space-y-3">
            {dossierSignals.map((item) => (
              <div key={item.title} className="rounded-[1.4rem] border border-slate-200 bg-white p-4">
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
                    {item.status === "listo" ? "Ya aporta claridad" : "Podría fortalecerlo"}
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

function WhatItChecksSection() {
  return (
    <section id="que-revisa" className="bg-slate-50 py-20 sm:py-24">
      <div className="container">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-teal-700">
              Qué puede revisar contigo
            </p>
            <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-4xl">
              No es solo una página bonita: debe prometer utilidad real.
            </h2>
          </div>
          <p className="max-w-xl text-base leading-7 text-slate-600">
            La narrativa correcta vende una herramienta útil y comprensible. Por eso la home aterriza ejemplos concretos de lo que el trabajador puede ordenar, revisar y proteger.
          </p>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {checks.map((item) => {
            const Icon = item.icon;
            return (
              <article
                key={item.title}
                className="group rounded-[2rem] border border-slate-200 bg-white p-6 transition hover:-translate-y-1 hover:shadow-[0_30px_80px_-50px_rgba(13,148,136,0.5)]"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-50 text-teal-700 transition group-hover:bg-teal-600 group-hover:text-white">
                  <Icon className="h-5 w-5" strokeWidth={1.8} />
                </div>
                <h3 className="mt-5 text-lg font-semibold tracking-[-0.02em] text-slate-950">
                  {item.title}
                </h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">{item.description}</p>
              </article>
            );
          })}
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
    <section id="recorrido" className="bg-slate-950 py-20 text-white sm:py-24">
      <div className="container grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-teal-300">
            Recorrido guiado
          </p>
          <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
            Una primera experiencia informativa, cero intimidante.
          </h2>
          <p className="mt-4 text-lg leading-8 text-slate-300">
            Antes de pedirte cosas, la home debe ayudarte a entender qué va a pasar. Este recorrido resume la lógica correcta: claridad primero, confianza después y acción al final.
          </p>

          <div className="mt-8 space-y-3">
            {tourSteps.map((step, index) => (
              <button
                key={step.id}
                type="button"
                onClick={() => setActiveStepIndex(index)}
                className={`w-full rounded-[1.5rem] border px-5 py-4 text-left transition ${
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

        <div className={`overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br ${activeStep.accent} p-[1px]`}>
          <div className="rounded-[calc(2rem-1px)] bg-white px-6 py-6 text-slate-950 sm:px-8 sm:py-8">
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

            <p className="mt-6 text-lg leading-8 text-slate-600">{activeStep.description}</p>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {activeStep.bullets.map((item) => (
                <div key={item} className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
                  <CheckCircle2 className="h-5 w-5 text-teal-700" strokeWidth={1.8} />
                  <p className="mt-3 text-sm leading-6 text-slate-700">{item}</p>
                </div>
              ))}
            </div>

            <div className="mt-8 rounded-[1.5rem] border border-teal-100 bg-teal-50 px-5 py-4 text-sm leading-7 text-teal-900">
              Lo importante aquí es que la persona sienta que puede entender el proceso antes de tomar cualquier decisión. Esa sensación de control es parte esencial de la conversión.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function FindingsExamplesSection() {
  return (
    <section id="hallazgos" className="bg-white py-20 sm:py-24">
      <div className="container">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-teal-700">
            Ejemplos de hallazgos
          </p>
          <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-4xl">
            Hay señales que se entienden mejor cuando tu expediente acumula contexto.
          </h2>
          <p className="mt-4 text-lg leading-8 text-slate-600">
            No prometemos milagros ni resultados automáticos. Lo que sí mostramos es cómo varios documentos pueden ayudar a ver relaciones y patrones con mucha más claridad.
          </p>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {findingsExamples.map((item) => (
            <article
              key={item.title}
              className="rounded-[2rem] border border-slate-200 bg-slate-50 p-6 shadow-[0_24px_70px_-56px_rgba(15,23,42,0.6)]"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-teal-700 shadow-sm">
                <FileSearch className="h-5 w-5" strokeWidth={1.8} />
              </div>
              <h3 className="mt-5 text-xl font-semibold tracking-[-0.03em] text-slate-950">
                {item.title}
              </h3>
              <p className="mt-3 text-base leading-7 text-slate-600">{item.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function BenefitGridSection() {
  return (
    <section className="bg-slate-50 py-20 sm:py-24">
      <div className="container">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-teal-700">
            Por qué se siente diferente
          </p>
          <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-4xl">
            Una herramienta constructiva vende mejor que una experiencia basada en miedo.
          </h2>
          <p className="mt-4 text-lg leading-8 text-slate-600">
            La home debe transmitir apoyo, sencillez y utilidad concreta. Esa es la forma correcta de hablarle a las masas sin perder seriedad.
          </p>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-2">
          {benefitCards.map((card) => {
            const Icon = card.icon;
            return (
              <article
                key={card.title}
                className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_24px_70px_-56px_rgba(15,23,42,0.6)]"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-teal-700 shadow-sm">
                  <Icon className="h-5 w-5" strokeWidth={1.8} />
                </div>
                <h3 className="mt-5 text-xl font-semibold tracking-[-0.03em] text-slate-950">
                  {card.title}
                </h3>
                <p className="mt-3 text-base leading-7 text-slate-600">{card.description}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function PrivacySection() {
  return (
    <section id="privacidad" className="bg-gradient-to-b from-white to-teal-50/50 py-20 sm:py-24">
      <div className="container grid gap-8 lg:grid-cols-[1fr_0.9fr] lg:items-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-teal-700">
            Tu privacidad es parte del producto
          </p>
          <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-4xl">
            La confianza no se promete solo con palabras: se diseña.
          </h2>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-600">
            AuditaPatron debe hacer que el usuario sienta control. Eso significa una experiencia con tono humano, protección visible y una lógica documental que cuide cada archivo como evidencia útil, no como simple almacenamiento.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {[
              "Privacidad visible desde el hero y durante todo el flujo.",
              "Documentos con trazabilidad y utilidad acumulada.",
              "Lenguaje que reduce miedo a represalias.",
              "Promesa clara de acompañamiento y orden.",
            ].map((item) => (
              <div key={item} className="flex gap-3 rounded-[1.5rem] border border-teal-100 bg-white p-4">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-teal-700" strokeWidth={1.8} />
                <p className="text-sm leading-7 text-slate-700">{item}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_40px_100px_-60px_rgba(15,23,42,0.45)] sm:p-8">
          <div className="rounded-[1.6rem] bg-slate-950 p-6 text-white">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-teal-300">
              Lo que la home debe hacer sentir
            </p>
            <div className="mt-5 space-y-4">
              {[
                "Estoy entendiendo mi situación sin que me hablen raro.",
                "No estoy poniendo en riesgo mi información por usar la herramienta.",
                "Esto me puede servir ahora y también después.",
              ].map((item) => (
                <div key={item} className="flex gap-3 rounded-[1.3rem] border border-white/10 bg-white/5 p-4">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-teal-300" strokeWidth={1.8} />
                  <p className="text-sm leading-7 text-slate-200">{item}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 rounded-[1.5rem] bg-teal-50 p-5">
            <p className="text-sm font-semibold text-teal-800">Principio rector</p>
            <p className="mt-2 text-sm leading-7 text-teal-900">
              Cada archivo puede alimentar contexto útil para el motor documental y para el expediente del trabajador, siempre con seguridad, trazabilidad y propósito claro.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function FAQSection() {
  return (
    <section id="preguntas" className="bg-white py-20 sm:py-24">
      <div className="container grid gap-10 lg:grid-cols-[0.8fr_1fr]">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-teal-700">
            Preguntas frecuentes
          </p>
          <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-4xl">
            La home también debe resolver objeciones importantes.
          </h2>
          <p className="mt-4 text-lg leading-8 text-slate-600">
            Si una persona llega con dudas, miedo o desconfianza, aquí debe encontrar respuestas sencillas y tranquilizadoras antes de abandonar la página.
          </p>
        </div>

        <div className="rounded-[2rem] border border-slate-200 bg-slate-50 p-4 sm:p-6">
          <Accordion type="single" collapsible className="space-y-3">
            {faqs.map((item, index) => (
              <AccordionItem
                key={item.question}
                value={`item-${index}`}
                className="rounded-[1.4rem] border border-slate-200 bg-white px-5"
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
    <section className="bg-slate-950 py-20 text-white sm:py-24">
      <div className="container">
        <div className="overflow-hidden rounded-[2.25rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(45,212,191,0.22),_transparent_32%),linear-gradient(135deg,_rgba(15,23,42,0.96),_rgba(15,23,42,0.88))] px-6 py-10 sm:px-10 sm:py-12">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-teal-300">
              Cierre de conversión
            </p>
            <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">
              Empieza hoy con el primer documento que ya tienes contigo.
            </h2>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">
              AuditaPatron debe sentirse como una puerta de entrada amable: te orienta, te da tranquilidad y convierte cada documento útil en un respaldo más sólido para tu situación laboral.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button
                className="h-12 rounded-full bg-teal-500 px-7 text-base text-slate-950 hover:bg-teal-400"
                onClick={goToAuditFlow}
              >
                Ir a /auditar ahora
                <ArrowRight className="ml-2 h-4 w-4" strokeWidth={1.8} />
              </Button>
              <Button
                variant="outline"
                className="h-12 rounded-full border-white/15 bg-transparent px-7 text-base text-white hover:bg-white/10"
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
      <div className="container flex flex-col gap-4 border-t border-slate-200 pt-8 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <p>AuditaPatron — claridad laboral con una experiencia simple, privada y útil.</p>
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
        </div>
      </div>
    </footer>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen bg-white font-sans text-slate-950">
      <SiteHeader />
      <HeroSection />
      <QuickProofSection />
      <HowItWorksSection />
      <DossierSection />
      <WhatItChecksSection />
      <GuidedTourSection />
      <FindingsExamplesSection />
      <BenefitGridSection />
      <PrivacySection />
      <FAQSection />
      <FinalCtaSection />
      <SiteFooter />
    </main>
  );
}

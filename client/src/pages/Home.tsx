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
import { useEffect, useMemo, useState } from "react";
import { trackFunnelStep } from "@/lib/analytics";
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
  { href: "#copiloto", label: "Asistente" },
  { href: "#preguntas", label: "Preguntas" },
];

const tourSteps: TourStep[] = [
  {
    id: "sube",
    title: "Sube tu documento y AuditaPatron lo recibe",
    summary: "Empieza con el archivo que ya tienes a la mano.",
    description:
      "No necesitas saber de leyes ni de nómina. Tú subes el documento y AuditaPatron lo analiza, lo resguarda y lo integra a AuditaPatron para empezar a devolverte contexto útil.",
    bullets: [
      "Puedes empezar desde tu celular.",
      "AuditaPatron procesa el archivo sin pasos técnicos extra.",
      "Cada archivo útil suma contexto real.",
    ],
    icon: Upload,
  },
  {
    id: "revisamos",
    title: "AuditaPatron te devuelve hallazgos claros",
    summary: "Lo importante aparece primero y sin palabras difíciles.",
    description:
      "AuditaPatron separa lo confirmado de lo estimado para que entiendas mejor tu situación y revises con más claridad pagos, condiciones y señales sobre IMSS e Infonavit.",
    bullets: [
      "Mensajes breves y fáciles de leer.",
      "Lo urgente se ve rápido.",
      "Te orienta sin sonar absoluto.",
    ],
    icon: FileSearch,
  },
  {
    id: "proteges",
    title: "Tu expediente se fortalece con AuditaPatron",
    summary: "Tus documentos no se quedan sueltos: se convierten en respaldo.",
    description:
      "Con más documentos útiles, AuditaPatron gana contexto para ordenar, comparar, almacenar y devolverte resultados cada vez más útiles dentro de tu expediente.",
    bullets: [
      "Más contexto para entender cambios.",
      "Mejor organización de evidencia.",
      "Privacidad, resguardo y control de tus archivos.",
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
    title: "Soporte IMSS, Infonavit o evidencia adicional",
    description: "Puede reforzar el contexto cuando quieres revisar con más claridad tu alta, aportaciones o continuidad laboral.",
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
    title: "Alta, baja, semanas cotizadas del IMSS o constancia de Infonavit",
    description: "Refuerzan la historia laboral con fechas y señales de seguridad social y vivienda laboral.",
    value: "Suman evidencia útil cuando quieres revisar con más claridad si tu alta y tus registros laborales están en orden dentro del expediente.",
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
    title: "AuditaPatron lo analiza y lo guarda en tu expediente",
    description: "Después de subirlo, AuditaPatron ordena el archivo en un solo lugar para que no termine perdido entre folders o chats.",
  },
  {
    step: "03",
    title: "Recibes resultados útiles y los conservas",
    description: "Ves qué se entendió, qué conviene revisar y mantienes tus documentos y resultados disponibles 24/7 cuando vuelvas a necesitarlos.",
  },
];

const faqs = [
  {
    id: "para-mi",
    question: "¿Esto me puede servir si todavía no sé qué revisar primero?",
    answer:
      "Sí. AuditaPatron está pensado para empezar justo ahí: ordenar lo que ya tienes, explicarte lo importante con palabras simples y ayudarte a ver qué conviene revisar primero.",
  },
  {
    id: "primer-documento",
    question: "¿Qué documento conviene subir primero?",
    answer:
      "El documento que ya tengas más a la mano siempre puede servir. Si sigues con duda, empieza por un recibo de nómina reciente porque suele dar contexto rápido sobre pagos, deducciones y fechas.",
  },
  {
    id: "privacidad",
    question: "¿Mi información está protegida?",
    answer:
      "Sí. Tus archivos se resguardan dentro del flujo de AuditaPatron para mantenerlos ordenados, disponibles para ti y con control sobre tu expediente digital.",
  },
  {
    id: "sin-tecnicismos",
    question: "¿Necesito saber de leyes o de nómina para usarlo?",
    answer:
      "No. Está pensado para explicarte lo importante con palabras sencillas, pasos claros y una recomendación inicial del documento que más te conviene subir.",
  },
  {
    id: "mas-contexto",
    question: "¿Por qué conviene subir más de un documento?",
    answer:
      "Porque varios documentos dan más contexto. Eso ayuda a detectar patrones, comparar información y fortalecer tu expediente digital con mayor claridad.",
  },
];

const guidedFaqOptions = [
  {
    id: "para-mi",
    label: "Quiero entender rápido si esto me puede ayudar",
    description: "Te orienta con el primer archivo que suele abrir más contexto sin complicarte.",
  },
  {
    id: "primer-documento",
    label: "No sé qué documento subir primero",
    description: "Te sugiere el archivo con mejor equilibrio entre facilidad, contexto y utilidad inicial.",
  },
  {
    id: "privacidad",
    label: "Me preocupa mi privacidad y quiero empezar con calma",
    description: "Aclara cómo se resguardan tus archivos y qué documento puedes usar para probar el flujo con control.",
  },
];

const heroCopyVariants = {
  alert: {
    tabLabel: "Alerta y control",
    eyebrowMobile: "Alerta laboral temprana",
    eyebrowDesktop: "Alerta laboral temprana",
    titleLead: "Podrías estar perdiendo dinero o derechos",
    titleAccent: "y ni siquiera lo sabes.",
    supportLine: "Revísalo hoy y toma control de tu historial laboral.",
    body:
      "AuditaPatron te ayuda a detectar señales de riesgo en nómina, CFDI y documentos clave para que entiendas qué revisar primero y actúes con más claridad.",
    ctaPrimary: "Auditar mi situación ahora",
    ctaSecondary: "Ver qué documento subir primero",
  },
  control: {
    tabLabel: "Control inmediato",
    eyebrowMobile: "Control y claridad desde tu primer archivo",
    eyebrowDesktop: "Control y claridad desde tu primer archivo",
    titleLead: "Revisa hoy tu historial laboral",
    titleAccent: "y actúa con más control.",
    supportLine: "Empieza con el documento que ya tienes a la mano.",
    body:
      "AuditaPatron ordena tus archivos, detecta señales importantes y te orienta sobre qué revisar primero para que avances con claridad desde el primer paso.",
    ctaPrimary: "Empezar mi revisión",
    ctaSecondary: "Quiero una guía rápida",
  },
} as const;

const socialProofItems = [
  {
    label: "Duda real compartida por personas usuarias",
    quote: "Ya entendí mejor qué revisar primero.",
    supportSignal: "Frase basada en feedback recurrente recogido durante pruebas de mensaje.",
  },
  {
    label: "Necesidad frecuente al ordenar el expediente",
    quote: "Por fin tengo mis documentos en un solo lugar.",
    supportSignal: "Resume un patrón real de búsqueda de orden y disponibilidad.",
  },
  {
    label: "Señal de confianza y claridad inicial",
    quote: "Me dio paz empezar sin palabras complicadas.",
    supportSignal: "Mantiene lenguaje sobrio y alineado con el tono de resguardo del producto.",
  },
] as const;

const prediagnosticRecommendations: Record<string, { badge: string; document: string; reason: string; nextStep: string }> = {
  "para-mi": {
    badge: "Sugerencia inicial",
    document: "Tu recibo de nómina más reciente o un CFDI",
    reason:
      "Suelen dar contexto rápido sobre pagos, deducciones, fechas y conceptos para que veas pronto si AuditaPatron te puede ayudar.",
    nextStep: "Si después quieres más claridad, suma contrato o soporte IMSS/Infonavit y tu expediente gana contexto.",
  },
  "primer-documento": {
    badge: "Primer archivo recomendado",
    document: "Empieza por el documento que ya tienes a la mano; si dudas, un recibo de nómina reciente",
    reason:
      "Es fácil de ubicar y normalmente entrega una primera lectura útil sin esperar a reunir todo el expediente.",
    nextStep: "Con uno o dos documentos más, AuditaPatron puede comparar mejor y devolverte una lectura más rica.",
  },
  "privacidad": {
    badge: "Inicio con control",
    document: "Un recibo reciente o tu contrato actual",
    reason:
      "Te permite probar el flujo con un archivo cotidiano, revisar cómo se resguarda y sentir control antes de subir más documentos.",
    nextStep: "Cuando te sientas con confianza, agrega otros archivos para fortalecer tu expediente sin perder trazabilidad.",
  },
  "sin-tecnicismos": {
    badge: "Recomendación simple",
    document: "Tu recibo de nómina más reciente",
    reason:
      "Es de los archivos más fáciles de reconocer y suele dar una explicación inicial clara sin lenguaje técnico.",
    nextStep: "Después puedes sumar CFDI o contrato para obtener comparaciones más útiles.",
  },
  "mas-contexto": {
    badge: "Para enriquecer tu expediente",
    document: "Dos o tres recibos de nómina seguidos",
    reason:
      "Ayudan a detectar patrones y diferencias que un solo archivo puede dejar ocultos.",
    nextStep: "Si además agregas CFDI, contrato o soporte IMSS/Infonavit, tu expediente gana todavía más valor.",
  },
};

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

const PRIMARY_CTA_LABEL = "Empieza ahora y protege tu futuro";

function goToAuditFlow() {
  trackFunnelStep("home_cta_clicked", {
    source: "home",
    destination: "/auditar",
  });
  window.location.href = "/auditar";
}

function SectionDivider() {
  return <div aria-hidden="true" className="mx-auto h-px w-full max-w-5xl bg-gradient-to-r from-transparent via-teal-100 to-transparent" />;
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
            onClick={() => {
              window.location.href = "/ceo";
            }}
          >
            Consola CEO
          </Button>
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
            {PRIMARY_CTA_LABEL}
            <ArrowRight className="ml-2 h-4 w-4" strokeWidth={1.8} />
          </Button>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 lg:hidden">
          <Button
            className="motion-hover-lift h-10 rounded-full bg-teal-400 px-4.5 text-[0.9rem] font-semibold text-slate-950 shadow-[0_18px_34px_-20px_rgba(45,212,191,0.82)] transition duration-200 ease-out hover:-translate-y-0.5 hover:bg-teal-300 active:scale-[0.99]"
            onClick={goToAuditFlow}
          >
            {PRIMARY_CTA_LABEL}
          </Button>
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white shadow-[0_14px_26px_-20px_rgba(15,23,42,0.9)] transition duration-200 ease-out hover:-translate-y-0.5 hover:bg-white/14 active:scale-[0.98]"
            onClick={() => setOpen((value) => !value)}
            aria-label={open ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={open}
          >
            {open ? <X className="h-4.5 w-4.5" /> : <Menu className="h-4.5 w-4.5" />}
          </button>
        </div>
      </div>

      {open ? (
        <div className="border-t border-white/8 bg-white/98 shadow-[0_28px_60px_-42px_rgba(15,23,42,0.42)] backdrop-blur-sm md:hidden">
          <div className="container mx-auto max-w-6xl space-y-3 py-4">
            <div className="rounded-[1.55rem] border border-slate-200 bg-[linear-gradient(180deg,_#f8fbfb_0%,_#eef6f5_100%)] p-4 shadow-[0_18px_36px_-28px_rgba(15,23,42,0.2)]">
              <div className="flex items-center justify-between gap-3">
                <AuditaPatronLogoWordmark imageClassName="h-6 max-w-[184px]" />
                <span className="rounded-full bg-teal-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-700">
                  Entrada rápida
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Entra directo a lo importante y muévete entre áreas sin perderte.
              </p>
            </div>

            <div className="overflow-hidden rounded-[1.55rem] border border-slate-200 bg-white shadow-[0_18px_34px_-28px_rgba(15,23,42,0.18)]">
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
                    className="flex items-center justify-between px-4 py-4 text-[0.97rem] font-semibold text-slate-700 transition duration-200 ease-out hover:bg-slate-50 hover:text-slate-950"
                  >
                    <span>{link.label}</span>
                    <ArrowRight className="h-4 w-4 text-slate-400" strokeWidth={1.8} />
                  </a>
                ))}
              </div>
            </div>

            <div className="grid gap-3 border-t border-slate-200/80 pt-3">
              <Button
                variant="outline"
                className="motion-hover-lift h-11 rounded-full border-slate-200 bg-white text-slate-700 transition duration-200 ease-out hover:-translate-y-0.5 hover:bg-slate-50 active:scale-[0.99]"
                onClick={() => {
                  setOpen(false);
                  window.location.href = "/ceo";
                }}
              >
                Consola CEO
              </Button>
              <Button
                variant="outline"
                className="motion-hover-lift h-11 rounded-full border-slate-200 bg-white text-slate-700 transition duration-200 ease-out hover:-translate-y-0.5 hover:bg-slate-50 active:scale-[0.99]"
                onClick={() => {
                  setOpen(false);
                  scrollToId("expediente");
                }}
              >
                Ver tu expediente
              </Button>
              <Button
                className="motion-hover-lift h-12 rounded-full bg-teal-600 text-base font-semibold text-white shadow-[0_18px_34px_-20px_rgba(13,148,136,0.52)] transition duration-200 ease-out hover:-translate-y-0.5 hover:bg-teal-700 active:scale-[0.99]"
                onClick={() => {
                  setOpen(false);
                  goToAuditFlow();
                }}
              >
                {PRIMARY_CTA_LABEL}
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
  const [selectedHeroVariant, setSelectedHeroVariant] = useState<keyof typeof heroCopyVariants>("alert");
  const activeHeroVariant = heroCopyVariants[selectedHeroVariant];

  return (
    <section
      id="top"
      className="relative overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(20,184,166,0.16),_transparent_40%),radial-gradient(circle_at_top_right,_rgba(125,211,252,0.14),_transparent_30%),linear-gradient(180deg,_#f9fcfb_0%,_#eef6f5_100%)] pb-8 pt-7 sm:pb-12 sm:pt-12 lg:pt-16"
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,_rgba(229,244,242,0.92)_0%,_rgba(216,236,233,0.98)_100%)] sm:hidden" />
      <div className="container relative z-10 mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 xl:gap-20">
        <div className="mx-auto flex max-w-2xl flex-col items-center text-center lg:mx-0 lg:items-start lg:text-left">
          <div className="motion-enter-soft flex flex-wrap items-center justify-center gap-2 lg:justify-start" style={{ ["--motion-delay" as string]: "20ms" }}>
            {(Object.entries(heroCopyVariants) as Array<[keyof typeof heroCopyVariants, (typeof heroCopyVariants)[keyof typeof heroCopyVariants]]>).map(([key, variant]) => {
              const isActive = selectedHeroVariant === key;

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedHeroVariant(key)}
                  className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                    isActive
                      ? "border-teal-300 bg-teal-50 text-teal-900 shadow-[0_18px_40px_-32px_rgba(13,148,136,0.34)]"
                      : "border-white/80 bg-white/75 text-slate-600 hover:border-teal-200 hover:text-slate-900"
                  }`}
                  aria-pressed={isActive}
                >
                  {variant.tabLabel}
                </button>
              );
            })}
          </div>

          <div
            className="motion-enter-soft mt-3 inline-flex items-center gap-2 rounded-full border border-teal-100 bg-white/88 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-800 shadow-[0_18px_40px_-30px_rgba(20,184,166,0.4)] sm:px-4 sm:py-2 sm:text-xs"
            style={{ ["--motion-delay" as string]: "60ms" }}
          >
            <ShieldCheck className="h-4 w-4" strokeWidth={1.8} />
            <span className="sm:hidden">{activeHeroVariant.eyebrowMobile}</span>
            <span className="hidden sm:inline">{activeHeroVariant.eyebrowDesktop}</span>
          </div>

          <h1
            className="motion-enter-soft mt-4 max-w-[15ch] text-balance text-[2.55rem] font-bold leading-[0.94] tracking-[-0.06em] text-slate-950 sm:mt-5 sm:max-w-[14ch] sm:text-[3.6rem] lg:max-w-[13ch] lg:text-[4.4rem]"
            style={{ ["--motion-delay" as string]: "120ms" }}
          >
            <span className="block sm:hidden">
              {activeHeroVariant.titleLead}
              <span className="mt-1 block text-amber-700">{activeHeroVariant.titleAccent}</span>
            </span>
            <span className="hidden sm:block">
              {activeHeroVariant.titleLead}
              <span className="block text-amber-700">{activeHeroVariant.titleAccent}</span>
            </span>
          </h1>

          <p
            className="motion-enter-soft mt-4 max-w-xl text-sm font-semibold uppercase tracking-[0.12em] text-amber-700 sm:text-[0.95rem]"
            style={{ ["--motion-delay" as string]: "180ms" }}
          >
            {activeHeroVariant.supportLine}
          </p>

          <p
            className="motion-enter-soft mt-3 max-w-xl text-base leading-7 text-slate-600 sm:text-[1.08rem] sm:leading-8"
            style={{ ["--motion-delay" as string]: "210ms" }}
          >
            {activeHeroVariant.body}
          </p>

          <div
            className="motion-enter-soft mt-6 flex w-full max-w-sm flex-col gap-2.5 sm:max-w-none sm:flex-row sm:justify-center lg:justify-start"
            style={{ ["--motion-delay" as string]: "300ms" }}
          >
            <Button
              className="motion-hover-lift h-12 w-full rounded-full bg-teal-600 px-7 text-base font-semibold text-white shadow-[0_20px_38px_-24px_rgba(13,148,136,0.55)] transition duration-200 ease-out hover:-translate-y-0.5 hover:bg-teal-700 active:scale-[0.99] sm:w-auto"
              onClick={goToAuditFlow}
            >
              {activeHeroVariant.ctaPrimary}
              <ArrowRight className="motion-arrow ml-2 h-4 w-4" strokeWidth={1.8} />
            </Button>
            <Button
              variant="outline"
              className="motion-hover-lift h-10 border-transparent bg-transparent px-2 text-sm font-semibold text-slate-600 shadow-none transition duration-200 ease-out hover:text-slate-950 active:scale-[0.99] sm:h-12 sm:rounded-full sm:border-slate-200 sm:bg-white sm:px-7 sm:text-base sm:text-slate-700 sm:shadow-[0_18px_36px_-30px_rgba(15,23,42,0.18)] sm:hover:-translate-y-0.5 sm:hover:bg-slate-50"
              onClick={() => scrollToId("preguntas")}
            >
              {activeHeroVariant.ctaSecondary}
            </Button>
          </div>

          <div
            className="motion-enter-soft mt-4 w-full max-w-xl rounded-[1.5rem] border border-slate-200 bg-white/92 p-3.5 shadow-[0_22px_50px_-38px_rgba(15,23,42,0.32)]"
            style={{ ["--motion-delay" as string]: "360ms" }}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
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
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Señales de confianza</p>
                  <p className="mt-1 text-sm font-medium leading-6 text-slate-700">
                    Referencias redactadas desde patrones reales de dudas y necesidades frecuentes, con tono sobrio y sin promesas infladas.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {socialProofItems.map((item) => (
                <div key={item.quote} className="motion-hover-lift rounded-[1.2rem] border border-slate-200 bg-slate-50 px-4 py-3 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-700">{item.label}</p>
                  <p className="mt-2 text-sm font-medium leading-6 text-slate-800">“{item.quote}”</p>
                  <p className="mt-2 text-xs leading-5 text-slate-500">{item.supportSignal}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="relative lg:pl-2">
          <div className="absolute -left-4 top-6 h-24 w-24 rounded-full bg-teal-200/50 blur-3xl" />
          <div className="absolute -right-4 bottom-8 h-24 w-24 rounded-full bg-sky-200/60 blur-3xl" />
          <div
            className="motion-enter-soft relative overflow-hidden rounded-[2rem] border border-slate-300/80 bg-[linear-gradient(180deg,_rgba(255,255,255,0.98)_0%,_rgba(243,250,249,0.98)_100%)] p-5 shadow-[0_34px_86px_-54px_rgba(15,23,42,0.34)] transition duration-300 ease-out hover:-translate-y-1 sm:p-6"
            style={{ ["--motion-delay" as string]: "220ms" }}
          >
            <div className="rounded-[1.4rem] border border-teal-100/80 bg-[linear-gradient(180deg,_#f8fffe_0%,_#edf7f5_100%)] px-5 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Tu tranquilidad hoy
                  </p>
                  <div className="mt-2 flex items-end gap-3">
                    <p className="text-[2.85rem] font-bold tracking-[-0.065em] text-slate-950">{dossierReadiness}%</p>
                    <span className="mb-1 text-sm font-semibold text-teal-700">Ya empezaste a recuperar control</span>
                  </div>
                </div>
                <div className="rounded-full border border-emerald-200 bg-emerald-100/90 px-3 py-1 text-xs font-semibold text-emerald-800 shadow-sm">
                  24/7
                </div>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Ves rápido qué te da tranquilidad hoy y qué conviene reforzar después.
              </p>
              <div className="mt-4 h-3 overflow-hidden rounded-full bg-white shadow-inner">
                <div
                  className="motion-progress-fill h-full rounded-full bg-gradient-to-r from-teal-500 to-cyan-500"
                  style={{ ["--progress-scale" as string]: `${dossierReadiness / 100}`, ["--motion-delay" as string]: "260ms" }}
                />
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {[
                "Subes tu recibo, contrato o soporte clave en minutos.",
                "Recibes explicaciones claras, sin vueltas ni lenguaje complicado.",
                "Tu expediente se ordena y queda listo para cuando necesites volver a él.",
              ].map((item, index) => (
                <div
                  key={item}
                  className="motion-enter-soft flex gap-3 rounded-[1.3rem] border border-slate-200 bg-white/96 p-4 shadow-[0_20px_44px_-34px_rgba(15,23,42,0.34)] transition duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_24px_50px_-34px_rgba(15,23,42,0.38)]"
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
              className="mt-5 block w-full rounded-[1.35rem] border border-teal-200 bg-[linear-gradient(180deg,_#ecfdf9_0%,_#dff7f1_100%)] px-4 py-4 text-left shadow-[0_20px_46px_-34px_rgba(13,148,136,0.24)] transition duration-200 ease-out hover:-translate-y-0.5 hover:bg-[linear-gradient(180deg,_#e6fbf5_0%,_#d7f3eb_100%)] hover:shadow-[0_26px_56px_-36px_rgba(13,148,136,0.28)] active:scale-[0.995]"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-700">
                    Siguiente paso sugerido
                  </p>
                  <p className="mt-1 text-sm font-semibold text-teal-950">
                    Ya diste el primer paso; sumar IMSS, Infonavit o CFDI puede darte todavía más claridad y más respaldo.
                  </p>
                </div>
                <ArrowRight className="mt-0.5 h-4.5 w-4.5 shrink-0 text-teal-700" strokeWidth={1.8} />
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/90 shadow-inner">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-teal-500 to-cyan-500"
                  style={{ width: `${dossierReadiness}%` }}
                />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full border border-white/80 bg-white px-3 py-1.5 text-xs font-medium text-teal-900 shadow-sm">
                  Ya sumaste: recibo y contrato
                </span>
                <span className="rounded-full border border-white/80 bg-white px-3 py-1.5 text-xs font-medium text-teal-900 shadow-sm">
                  Sigue con: IMSS, Infonavit o CFDI
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-teal-800">
                Toca aquí para seguir fortaleciendo tu expediente con el archivo que más impacto puede darte ahora.
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
    <section className="border-y border-teal-100/80 bg-[#dbeeee] py-3.5 sm:bg-[#e6f2f1]">
      <div className="container mx-auto grid gap-3 sm:grid-cols-3">
        {[
              "Empieza con el documento que ya tienes más a la mano.",
              "AuditaPatron lo ordena y te devuelve claridad útil sin rodeos.",
              "Tu expediente queda disponible para ti 24/7.",

        ].map((item) => (
          <div
            key={item}
            className="rounded-[1.3rem] border border-slate-200 bg-white/88 px-4 py-3 text-sm font-medium text-slate-700"
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
    <section className="bg-[#edf7f6] py-12 sm:bg-[#f7fbfb] sm:py-14">
      <div className="container mx-auto max-w-6xl">
        <div className="rounded-[2rem] border border-slate-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f1f7f7_100%)] p-6 shadow-[0_28px_80px_-60px_rgba(15,23,42,0.45)] sm:p-8">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-teal-700">
              Una experiencia simple y confiable
            </p>
            <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-4xl">
              Tus documentos dejan de vivir en folders sueltos y empiezan a trabajar a tu favor.
            </h2>
            <p className="mt-4 text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
              Tú solo subes lo que ya tienes. AuditaPatron recibe la información, analiza documentos y señales laborales, los convierte en un expediente digital disponible 24/7 y te devuelve resultados, comparaciones y siguientes pasos para que sepas qué revisar con calma.
            </p>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {[
              {
                title: "Subes una pieza útil y AuditaPatron la resguarda",
                description:
                  "Recibos, CFDI, contratos, soportes IMSS, constancias de Infonavit y evidencia dejan de vivir en folders separados y empiezan a ordenarse en un mismo lugar.",
                detail: "Todo queda dentro de tu expediente digital, disponible 24/7 para revisar, descargar y volver a usar cuando lo necesites.",
                icon: Upload,
              },
              {
                title: "AuditaPatron conecta el contexto del expediente",
                description:
                  "Conecta fechas, pagos, documentos relacionados y señales de IMSS e Infonavit para encontrar qué ya está claro y qué todavía conviene tomar con cautela.",
                detail: "No promete certezas automáticas: organiza señales útiles y te ayuda a interpretar mejor la información visible.",
                icon: FileSearch,
              },
              {
                title: "Recibes resultados y guía laboral útil",
                description:
                  "Ves qué se confirmó, qué parece estimado y cuál puede ser el siguiente documento o paso más útil para fortalecer tu respaldo.",
                detail: "La persona usuaria solo sube, revisa y avanza; AuditaPatron analiza, almacena y sigue enriqueciendo el expediente por detrás sin sumar complejidad.",
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
            El valor real no es solo guardar archivos. El valor está en que AuditaPatron obtiene, ordena, analiza y resguarda la información para devolverte una guía que te ayuda a entender tu situación, incluyendo señales útiles sobre IMSS e Infonavit, sin dejar de tener todo en un solo lugar.
          </div>
        </div>
      </div>
    </section>
  );
}

function CopilotPreviewSection() {
  return (
    <section id="copiloto" className="bg-[#edf4f5] py-14 sm:bg-[#f5f7f8] sm:py-16">
      <div className="container mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.92fr_1.08fr] lg:items-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-teal-700">
            Asistente laboral impulsado por AuditaPatron
          </p>
          <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-4xl">
            Una capa extra para hacer preguntas rápidas sobre tu expediente.
          </h2>
          <p className="mt-4 text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
            Cuando ya tienes documentos visibles dentro de AuditaPatron, tu asistente laboral puede ayudarte a resumir riesgos, explicar qué todavía falta confirmar y sugerir el siguiente paso útil con base en lo que AuditaPatron ya analizó y resguardó dentro del expediente.
          </p>
          <p className="mt-4 inline-flex max-w-xl rounded-full border border-teal-100 bg-teal-50/90 px-4 py-2 text-sm font-medium text-teal-900 shadow-sm">
            Aquí te acompañamos paso a paso para cuidar tus derechos laborales.
          </p>

          <div className="mt-6 space-y-3">
            {[
              "Responde con base en los documentos y resultados que AuditaPatron ya integró en tu expediente.",
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
            El asistente laboral es una guía contextual basada en tu expediente visible. No sustituye a un abogado ni constituye una opinión legal vinculante.
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button className="rounded-full bg-teal-600 px-6 text-white hover:bg-teal-700" onClick={goToAuditFlow}>
              {PRIMARY_CTA_LABEL}
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
                Vista previa del asistente
              </p>
              <p className="mt-1 text-lg font-semibold tracking-[-0.02em] text-slate-950">
                El asistente te explica tu expediente con palabras simples
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
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">El asistente responde</p>
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
    <section id="como-funciona" className="bg-[#f2f5f7] py-14 sm:py-16">
      <div className="container">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-teal-700">
            Así de fácil
          </p>
          <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-4xl">
            Entiende tu situación sin complicarte.
          </h2>
          <p className="mt-4 text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
            En pocos pasos puedes subir tu documento, dejar que AuditaPatron lo analice y empiece a construir un expediente digital ordenado que siga contigo cuando lo necesites.
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
              title: "AuditaPatron entiende lo importante",
              description: "Ordena señales, separa lo confirmado de lo estimado y te explica con claridad dónde conviene poner atención, incluso frente a IMSS e Infonavit.",
            },
            {
              number: "03",
              title: "Recibes resultados útiles para avanzar",
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
    <section id="expediente" className="bg-[#eef6f5] py-14 sm:bg-[#f8fbfb] sm:py-16">
      <div className="container mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
        <div className="mx-auto max-w-2xl text-center lg:mx-0 lg:text-left">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-teal-700">
            Tu expediente en crecimiento
          </p>
          <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-4xl">
            Cada documento útil se convierte en orden, claridad y respaldo.
          </h2>
          <p className="mt-4 text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
            No se trata de subir por subir. Se trata de reunir piezas para que AuditaPatron te dé más claridad, mejor orden y un expediente digital disponible 24/7 si después necesitas revisar, reclamar o respaldar algo con calma.
          </p>

          <div className="mt-6 space-y-3">
            {[
              "Más claridad sobre pagos, deducciones y condiciones laborales.",
              "Más contexto para revisar con claridad señales de IMSS e Infonavit.",
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
            {PRIMARY_CTA_LABEL}
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
    <section className="bg-[#e7eff0] py-14 sm:bg-[#eef2f3] sm:py-16">
      <div className="container mx-auto max-w-6xl">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-teal-700">
            Documentos que más pueden ayudarte
          </p>
          <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-4xl">
            Si quieres darle más valor a tu expediente, empieza por los archivos con más contexto.
          </h2>
          <p className="mt-4 text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
            No todos los documentos aportan lo mismo. Si todavía no los has subido, estos suelen ser de los primeros archivos que más conviene reunir para darle a AuditaPatron mejor contexto, ordenar tu caso y hacer que el expediente te devuelva una lectura más completa.
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
          En cuanto abras tu <span className="font-semibold">expediente</span>, estas sugerencias dejan de ser generales y se conectan con los documentos y señales que AuditaPatron todavía necesita para decirte qué te conviene subir primero.
        </div>
      </div>
    </section>
  );
}

function MobileOnboardingSection() {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeCard = mobileOnboardingCards[activeIndex] ?? mobileOnboardingCards[0];

  return (
    <section className="bg-[#edf4f6] py-14 sm:bg-[#f7fafb] sm:py-16">
      <div className="container mx-auto max-w-6xl">
        <div className="rounded-[2rem] border border-slate-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f1f6f6_100%)] p-6 shadow-[0_32px_100px_-70px_rgba(15,23,42,0.55)] sm:p-8">
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
    <section id="hallazgos" className="bg-[#f3f8f8] py-14 sm:bg-white sm:py-16">
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
    <section id="privacidad" className="bg-[#eaf5f3] py-14 sm:bg-[#f4f9f8] sm:py-16">
      <div className="container grid gap-6 lg:grid-cols-[1fr_0.92fr] lg:items-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-teal-700">
            Tu privacidad es parte del producto
          </p>
          <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-4xl">
            Tus documentos se resguardan para darte claridad y tranquilidad desde el inicio.
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
            Cada archivo suma orden, contexto y una explicación más clara de tu situación. La idea es simple: que puedas volver a tu expediente cuando lo necesites y sentir que tus documentos están de tu lado desde el primer momento.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {[
              "Subes tus documentos en minutos, desde tu celular o computadora.",
              "La información se acomoda para que entiendas qué tienes y qué conviene revisar.",
              "Tu expediente sigue disponible para ti 24/7 cuando necesites volver a verlo.",
              "Las explicaciones buscan darte calma y claridad, no más confusión.",
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
              Lo que queremos que sientas aquí
            </p>
            <div className="mt-4 space-y-3">
              {[
                "Entiendo mejor mi situación sin sentirme abrumado.",
                "Mi información está cuidada, ordenada y bajo control.",
                "Tengo mis documentos a la mano cuando más los necesite.",
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
                  Tus documentos pueden fortalecer tu expediente y darte más respaldo laboral sin perder trazabilidad, control ni disponibilidad cuando los necesites.
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
  const [selectedFaq, setSelectedFaq] = useState<string | undefined>("para-mi");
  const activeRecommendation = prediagnosticRecommendations[selectedFaq ?? "para-mi"] ?? prediagnosticRecommendations["para-mi"];

  return (
    <section id="preguntas" className="bg-[#f7fafb] py-14 sm:py-16">
      <div className="container grid gap-8 lg:grid-cols-[0.85fr_1fr]">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-teal-700">
            Guía rápida para empezar
          </p>
          <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-4xl">
            Empieza por la duda que hoy más te frena.
          </h2>
          <p className="mt-4 text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
            Si todavía no quieres subir un archivo, primero elige tu duda principal y te sugerimos el primer documento que más suele ayudarte a ganar contexto con baja fricción.
          </p>

          <div className="mt-6 rounded-[1.7rem] border border-slate-200 bg-white p-4 shadow-[0_20px_60px_-52px_rgba(15,23,42,0.34)] sm:p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Mini diagnóstico inicial
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Elige lo que más se parece a tu caso y te mostramos primero la respuesta útil junto con el documento que mejor suele abrir contexto.
            </p>
            <div className="mt-4 space-y-3">
              {guidedFaqOptions.map((option) => {
                const isActive = selectedFaq === option.id;

                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setSelectedFaq(option.id)}
                    className={`w-full rounded-[1.2rem] border px-4 py-3 text-left transition ${
                      isActive
                        ? "border-teal-300 bg-teal-50 shadow-[0_18px_40px_-34px_rgba(13,148,136,0.42)]"
                        : "border-slate-200 bg-slate-50 hover:border-teal-200 hover:bg-white"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-950">{option.label}</p>
                        <p className="mt-1 text-sm leading-6 text-slate-600">{option.description}</p>
                      </div>
                      <ChevronRight className={`mt-0.5 h-4 w-4 shrink-0 ${isActive ? "text-teal-600" : "text-slate-400"}`} />
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 rounded-[1.35rem] border border-teal-100 bg-teal-50/70 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-700">{activeRecommendation.badge}</p>
              <p className="mt-2 text-base font-semibold leading-7 text-slate-950">{activeRecommendation.document}</p>
              <p className="mt-2 text-sm leading-6 text-slate-700">{activeRecommendation.reason}</p>
              <p className="mt-3 text-sm leading-6 text-teal-900">{activeRecommendation.nextStep}</p>
            </div>
          </div>
        </div>

        <div className="rounded-[2rem] border border-slate-200 bg-slate-50 p-4 sm:p-6">
          <p className="mb-4 text-sm leading-6 text-slate-600">
            Empieza por tu duda principal y revisa primero la respuesta más útil para ti. La recomendación del documento cambia según lo que elijas.
          </p>
          <Accordion type="single" collapsible value={selectedFaq} onValueChange={setSelectedFaq} className="space-y-3">
            {faqs.map((item) => (
              <AccordionItem
                key={item.id}
                value={item.id}
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
    <section className="bg-[#e8f1f0] py-14 sm:bg-[#f3f7f7] sm:py-16">
      <div className="container">
        <div className="overflow-hidden rounded-[2.2rem] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(45,212,191,0.18),_transparent_32%),linear-gradient(135deg,_#ffffff,_#eef6f5)] px-6 py-10 shadow-[0_36px_90px_-64px_rgba(15,23,42,0.38)] sm:px-10 sm:py-12">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-teal-700">
              Empieza cuando quieras
            </p>
            <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-5xl">
              Tu primer documento ya puede devolverte más claridad y tranquilidad.
            </h2>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
              Empieza con lo que ya tienes a la mano y deja que AuditaPatron convierta ese primer archivo en orden, contexto y un expediente digital que seguirá contigo.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button
                className="rounded-full bg-teal-600 px-6 text-white hover:bg-teal-700"
                onClick={goToAuditFlow}
              >
                {PRIMARY_CTA_LABEL}
                <ArrowRight className="ml-2 h-4 w-4" strokeWidth={1.8} />
              </Button>
              <Button
                variant="outline"
                className="motion-hover-lift h-12 rounded-full border-slate-200 bg-white px-7 text-base text-slate-700 hover:bg-slate-50"
                onClick={() => scrollToId("preguntas")}
              >
                Quiero una guía rápida antes de subir
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
    <footer className="bg-[#f7faf9] py-8">
      <div className="container flex flex-col gap-6 border-t border-slate-200 pt-8 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-3">
          <AuditaPatronLogoWordmark
            className="inline-flex min-w-0 items-center"
            imageClassName="max-w-[220px] sm:max-w-[250px]"
            subtitleClassName="text-[0.75rem] tracking-[0.14em]"
          />
          <p className="max-w-md text-sm leading-6 text-slate-500">
            AuditaPatron te ayuda a recuperar claridad, orden y respaldo con un expediente digital simple, privado y útil para revisar tu situación laboral.
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
  useEffect(() => {
    trackFunnelStep("home_viewed", {
      source: "landing",
    });
  }, []);

  return (
    <main className="audita-home min-h-screen bg-[#f9fcfb] font-sans text-slate-950">
      <SiteHeader />
      <HeroSection />
      <QuickTrustSection />
      <SectionDivider />
      <HowItWorksSection />
      <SectionDivider />
      <DossierSection />
      <SectionDivider />
      <PriorityDocumentsSection />
      <SectionDivider />
      <CopilotPreviewSection />
      <SectionDivider />
      <PrivacySection />
      <SectionDivider />
      <FAQSection />
      <SectionDivider />
      <FinalCtaSection />
      <SiteFooter />
    </main>
  );
}

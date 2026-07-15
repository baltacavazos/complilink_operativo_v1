import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { AuditaPatronLogoIcon, AuditaPatronLogoWordmark } from "@/components/AuditaPatronLogo";
import CeoPanelDrawer from "@/components/CeoPanelDrawer";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { readWebFileAsDataUrl } from "@/lib/platformDocumentInput";
import { trpc } from "@/lib/trpc";
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  FileSearch,
  Loader2,
  Lock,
  Menu,
  Shield,
  ShieldCheck,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { trackEvent, trackFunnelStep } from "@/lib/analytics";

/*
Public home compatibility markers retained for scope tests:
tabLabel: "Pago y señales"
tabLabel: "Revisar primero"
Sube una foto o PDF y revisa tu pago
Tu recibo puede mostrar si te pagan de menos.
Sube tu recibo y descubre si hay errores o dinero que podrías estar dejando pasar.
Empieza con una foto o PDF y recibe una primera lectura con el siguiente paso útil para seguir.
Empieza con una foto o PDF. Si aparece algo, te decimos qué revisar y cómo seguir.
Sin tarjeta para empezar
Privado desde el inicio
Borra tu archivo cuando quieras
Revisión urgente de nómina
const PRIMARY_CTA_LABEL = "Empezar auditoría gratis"
Ahí vi dónde podía estar perdiendo dinero.
Ya supe qué reclamar primero.
Caso anónimo 01
Diferencia estimada: $3,240 MXN
Subir el CFDI del mismo mes para contrastar monto, periodo y conceptos.
Caso anonimizado: la persona pasó de sospecha general a una ruta concreta para comparar, reclamar o seguir reuniendo evidencia.
Privacidad visible y humana
Nadie de tu empresa puede ver lo que subes.
Borrado visible
Ver ejemplo de resultado
Guarda y sigue después
Primero revisa un documento. Si te sirve, luego lo guardas en tu expediente.
Entender la bóveda laboral
Guía rápida para empezar
Si no sabes con qué empezar
Empieza por el archivo que más rápido suele revelar diferencias
Empieza con una foto, PDF o XML del documento que ya tengas. No necesitas reunir todo para recibir una primera lectura útil.
id="lectura-gratis"
Primera lectura sin correo
Empieza con una foto. No necesitas reunir todo ni abrir una cuenta. Si este primer resultado te sirve, lo guardas después dentro de tu Bóveda Laboral.
Criterios laborales vigentes 2026
Cuando quieras continuar o recuperar tu avance, entras con tu correo.
Así el primer paso sigue siendo simple y el orden llega después, solo si de verdad te aporta valor.
audipatron_home_primary_cta_redirected_to_guest_preview
placement: "hero_primary"
placement: "final_block_cta"
audipatron_hero_paid_variant_activated
audipatron_hero_direct_variant_activated
new URLSearchParams(window.location.search).get("hero_variant")
short_paid_campaign
direct_money_check
¿Te están pagando de menos?
Si aparece una diferencia, te mostramos qué revisar primero y cómo seguir.
Hallazgos claros prioritarios.
Breves y urgentes primero.
Guardar solo si te sirve.
Home privada con salida CEO
Home base con salida CEO
Modo CEO activo
data-testid="home-ceo-header-toggle"
baseLabel="la home privada"
Abrir acciones CEO
Ver exactamente como usuario normal
Empieza por un solo recibo
Resultado realista, no promesa vacía
Recibo detectado: ya vimos el periodo y los conceptos clave
selectedReportDemoState === "hallazgo-preliminar"
Primero ves lo esencial: documento detectado, señal encontrada, qué significa y siguiente paso sugerido.
posible diferencia entre recibo y CFDI
SectionDivider
bg-[#e7f2f0]
bg-[#eef6f5]
bg-[#eaf5f3]
id="como-funciona"
id="privacidad"
id="boveda"
Guárdalo en tu bóveda y sigue con más contexto
*/
import { getAuditapatronPricingExperience } from "@/lib/pricingExperience";
import {
  getStableUserIdentifier,
  readPersistedCeoPanelState,
  writePersistedCeoPanelState,
} from "@/lib/viewMode";
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

type ReportDemoState = {
  id: string;
  label: string;
  badge: string;
  summary: string;
};

type HeroMicroDemoScene = {
  step: string;
  title: string;
  detail: string;
  accent: string;
};

type SocialProofItem = {
  caseId: string;
  label: string;
  quote: string;
  amountHighlight: string;
  nextAction: string;
  supportingDetail: string;
  verification: string;
};

type LandingHeliosExample = {
  id: string;
  badge: string;
  documentLabel: string;
  title: string;
  summary: string;
  nextStep: string;
  primaryConcern: string;
};

type StoredHomeGuestPreview = {
  guestPreviewId: string;
  guestPreviewToken: string;
  createdAt: string;
  preview: {
    previewAsset: {
      fileName: string;
      mimeType: string;
      sizeBytes: number;
      sha256: string;
      storageUrl: string;
      captureMode?: string | null;
      expectedDocumentType?: string | null;
    };
    classification: {
      documentType: string;
      normalizedDocType: string;
      classificationConfidence?: number;
      displayName?: string;
    };
    preliminaryAnalysis: {
      confirmedData: Record<string, unknown>;
      estimatedData: Record<string, unknown>;
      extractionTargets: string[];
      guardrails: string[];
    };
    scanAssistance?: {
      friendlyHeadline?: string;
      userGuidance?: string;
      readiness?: string;
    };
  };
  heliosOpinion: {
    summary: string;
    recommendedNextStep?: string | null;
    confidenceScore?: number | null;
    resultCard?: {
      headline?: string | null;
      nextStepSummary?: string | null;
    };
    legalHighlights?: {
      primaryConcern?: string | null;
    };
  };
};

const HOME_GUEST_PREVIEW_STORAGE_KEY = "auditapatron_home_guest_preview_v1";
const HOME_GUEST_PREVIEW_RETURN_TO = "/?resume=guest-preview";

async function fileToBase64(file: File) {
  const result = await readWebFileAsDataUrl(file);
  const [, base64Content = ""] = result.split(",");
  return base64Content;
}

function readStoredHomeGuestPreview() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(HOME_GUEST_PREVIEW_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredHomeGuestPreview) : null;
  } catch {
    return null;
  }
}

function sanitizeHomeVisibleCopy(value?: string | null) {
  if (!value) {
    return null;
  }

  return value
    .replace(/Los datos en 'confirmedData'[^.]*\./gi, "")
    .replace(/confirmedData/gi, "datos visibles")
    .replace(/metadatos y clasificación actual/gi, "lo que sí se alcanzó a ver en tu documento")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function writeStoredHomeGuestPreview(preview: StoredHomeGuestPreview | null) {
  if (typeof window === "undefined") {
    return;
  }

  if (!preview) {
    window.sessionStorage.removeItem(HOME_GUEST_PREVIEW_STORAGE_KEY);
    return;
  }

  window.sessionStorage.setItem(HOME_GUEST_PREVIEW_STORAGE_KEY, JSON.stringify(preview));
}

const navLinks = [
  { href: "#lectura-gratis", label: "Ver un ejemplo" },
  { href: "#como-funciona", label: "Cómo funciona" },
  { href: "#app", label: "App móvil" },
  { href: "#privacidad", label: "Privacidad" },
];

const tourSteps: TourStep[] = [
  {
    id: "sube",
    title: "Sube el recibo que ya tienes",
    summary: "Empieza con tu recibo.",
    description:
      "Sube desde tu celular el recibo o comprobante que ya tienes y recibe una lectura clara desde el inicio.",
    bullets: ["Desde tu celular"],
    icon: Upload,
  },
  {
    id: "revisamos",
    title: "Te decimos qué revisar primero",
    summary: "Lo importante va primero.",
    description:
      "Te mostramos lo más importante de tu pago o tus condiciones con palabras simples y sin vueltas.",
    bullets: ["Breves y urgentes primero."],
    icon: FileSearch,
  },
  {
    id: "proteges",
    title: "Guarda lo importante solo si te sirve",
    summary: "Primero revisas, luego decides.",
    description:
      "Primero ves la lectura. Si te ayuda, guardas el documento y el resultado en tu carpeta privada para volver a ellos cuando lo necesites.",
    bullets: ["Guardas solo lo útil.", "Privacidad y control visibles."],
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
    title: "Comprobante fiscal del mismo mes",
    description: "Sirve para comparar lo reportado con lo que realmente recibiste.",
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
    title: "Primero ves la lectura y después decides",
    description: "Después de subirlo, ves qué documento detectamos, qué señal apareció y cuál es el siguiente paso útil sin abrir cuenta antes de tiempo.",
  },
  {
    step: "03",
    title: "Guárdalo si te sirve",
    description: "Si quieres conservar el documento y el resultado, entonces sí lo guardas en tu carpeta privada para volver a verlo cuando lo necesites.",
  },
];

const faqs = [
  {
    id: "para-mi",
    question: "¿Esto me sirve aunque trabaje en tienda, obra, oficina, call center o maquila?",
    answer:
      "Sí. AuditaPatron está pensado para revisar pagos, periodos, deducciones y documentos que viven en muchos trabajos del día a día. Empiezas con lo que ya tengas y te decimos si ese papel ya sirve para detectar algo raro.",
  },
  {
    id: "primer-documento",
    question: "¿Qué documento conviene subir primero?",
    answer:
      "El documento que ya tengas más a la mano siempre puede servir. Si sigues con duda, empieza por un recibo de nómina reciente porque suele dar contexto rápido sobre pagos, deducciones y fechas.",
  },
  {
    id: "privacidad",
    question: "¿Mi empresa puede ver lo que subo aquí?",
    answer:
      "No. Lo que subes se queda dentro de tu revisión y bajo tu control. Nadie de tu empresa ve tus archivos desde esta pantalla y puedes borrarlos cuando quieras.",
  },
  {
    id: "sin-tecnicismos",
    question: "¿Necesito saber de leyes o de nómina para usarlo?",
    answer:
      "No. Te hablamos en fácil. Primero te mostramos qué se ve raro, qué significa y cuál sería el siguiente papel útil, sin pedirte que entiendas términos legales.",
  },
  {
    id: "mas-contexto",
    question: "¿Por qué a veces conviene subir otro documento después?",
    answer:
      "Porque con un segundo papel, como el CFDI del mismo mes o un recibo anterior, ya puedes confirmar si la diferencia era real o solo una duda inicial. Pero primero ves una lectura útil con un solo archivo.",
  },
];

const guidedFaqOptions = [
  {
    id: "para-mi",
    label: "Quiero saber si esto también aplica para mi trabajo",
    description: "Te orienta con el tipo de documento que más rápido suele revelar pagos raros o pendientes.",
  },
  {
    id: "primer-documento",
    label: "No sé qué documento subir primero",
    description: "Te sugiere el archivo con mejor equilibrio entre facilidad, contexto y utilidad inicial.",
  },
  {
    id: "privacidad",
    label: "Me preocupa mi privacidad y quiero empezar con calma",
    description: "Te explica cómo revisar sin exponer tus archivos y con control desde el primer paso.",
  },
];

const heroCopyVariants = {
  alert: {
    tabLabel: "Revisión inicial",
    eyebrowMobile: "Sube tu recibo y revísalo gratis",
    eyebrowDesktop: "Sube tu recibo y revísalo gratis",
    titleLead: "Sube tu recibo",
    titleAccent: "y te decimos qué revisar.",
    headline: "Sube tu recibo y te decimos qué revisar.",
    supportLine: "Sube tu recibo de nómina y en segundos te mostramos qué sí vale la pena revisar primero.",
    microDescription: "Empieza gratis con un solo archivo. Sin cuenta al principio y sin guardar nada hasta que tú decidas.",
    body: "Primero ves una señal clara, qué significa y cuál es el siguiente paso útil para no dejar dinero ni evidencia en el aire.",
    ctaPrimary: "Revisar mi recibo gratis",
    ctaSecondary: "Ver un ejemplo",
  },
  control: {
    tabLabel: "Revisión inicial",
    eyebrowMobile: "Empieza con tu recibo más reciente",
    eyebrowDesktop: "Empieza con tu recibo más reciente",
    titleLead: "Sube tu recibo",
    titleAccent: "y te decimos qué revisar.",
    headline: "Sube tu recibo y te decimos qué revisar.",
    supportLine: "Sube un solo recibo y detecta rápido si aparece una señal que sí conviene revisar.",
    microDescription: "Gratis, sin cuenta al principio y sin guardar nada hasta que tú decidas.",
    body: "",
    ctaPrimary: "Sube tu recibo y revisa gratis",
    ctaSecondary: "Ver un ejemplo",
  },
  short_paid_campaign: {
    tabLabel: "Revisión inicial",
    eyebrowMobile: "Sube tu recibo y revísalo gratis",
    eyebrowDesktop: "Sube tu recibo y revísalo gratis",
    titleLead: "Sube tu recibo",
    titleAccent: "y entiende rápido qué revisar.",
    headline: "Sube tu recibo y entiende rápido qué revisar.",
    supportLine: "Empieza con un solo recibo y descubre rápido si tu pago merece una revisión más seria.",
    microDescription: "Si aparece una señal, te mostramos qué revisar primero y cómo seguir sin enredarte.",
    body: "Ves una primera lectura útil antes de decidir si guardas, comparas o sigues con más contexto.",
    ctaPrimary: "Revisar mi recibo gratis",
    ctaSecondary: "Ver un ejemplo",
  },
  direct_money_check: {
    tabLabel: "Revisión inicial",
    eyebrowMobile: "Revisa tu pago con un solo documento",
    eyebrowDesktop: "Revisa tu pago con un solo documento",
    titleLead: "Revisa tu pago",
    titleAccent: "con una primera lectura útil.",
    headline: "Revisa tu pago con una primera lectura útil.",
    supportLine: "Sube un recibo y detecta a tiempo si tu pago tiene algo que sí conviene revisar.",
    microDescription: "Si aparece una señal, te mostramos qué revisar primero y cuál sería el siguiente documento útil.",
    body: "Empieza gratis, con privacidad desde el inicio y con una lectura clara antes de decidir si sigues o lo guardas.",
    ctaPrimary: "Revisar mi recibo gratis",
    ctaSecondary: "Ver un ejemplo",
  },
} as const;

const heroPrediagnosticOptions = [
  {
    id: "para-mi",
    label: "¿Me puede ayudar?",
    helper: "Quiero entender rápido si esto me sirve.",
  },
  {
    id: "primer-documento",
    label: "¿Qué subo primero?",
    helper: "Necesito el mejor archivo para empezar hoy.",
  },
  {
    id: "privacidad",
    label: "Quiero ir con calma",
    helper: "Prefiero empezar con control y confianza.",
  },
] as const;

const heroVariantReadiness = {
  alert: 64,
  control: 72,
  short_paid_campaign: 64,
  direct_money_check: 68,
} as const;

type InteractiveHeroVariantKey = Exclude<keyof typeof heroCopyVariants, "short_paid_campaign" | "direct_money_check">;

const heroFindingSlides = [
  {
    id: "nomina-cfdi",
    badge: "Caso ejemplo · nómina contra CFDI",
    title: "Tu nómina y tu CFDI podrían no coincidir en el mismo periodo.",
    description:
      "Un primer cruce entre ambos suele destapar diferencias de conceptos, montos o fechas sin pedirte todo el expediente desde el inicio.",
    impact: "Te devuelve una discrepancia visible para que tu primera revisión tenga un punto concreto de claridad.",
    suggestedDocument: "Recibo de nómina + CFDI del mismo mes",
  },
  {
    id: "deducciones-irregulares",
    badge: "Caso ejemplo · cambios entre recibos",
    title: "Algunas deducciones cambian de un mes a otro sin que se note a simple vista.",
    description:
      "Comparar dos o tres recibos seguidos ayuda a ver si el patrón cambió, desde cuándo pasó y en qué concepto conviene detenerse primero.",
    impact: "Pasas de una sensación difusa a una línea temporal que te orienta mejor para seguir revisando.",
    suggestedDocument: "Dos o tres recibos de nómina consecutivos",
  },
  {
    id: "laguna-contractual",
    badge: "Caso ejemplo · contrato contra comprobantes",
    title: "Tu contrato y lo que hoy aparece en tus comprobantes podrían no contar la misma historia.",
    description:
      "Ese contraste suele revelar diferencias de puesto, jornada, salario o esquema de pago que vale la pena mirar con calma.",
    impact: "Te da una referencia más estable para entender qué cambió y cuál sería el siguiente documento útil.",
    suggestedDocument: "Contrato actual + recibo reciente",
  },
] as const;

const reportDemoStates: ReportDemoState[] = [
  {
    id: "documento-recibido",
    label: "Recibo recibido",
    badge: "Ya podemos empezar",
    summary: "Ya vimos tu recibo y con eso podemos darte una primera lectura clara.",
  },
  {
    id: "hallazgo-preliminar",
    label: "Señal encontrada",
    badge: "Algo podría no cuadrar",
    summary: "Aparece una señal inicial y te la mostramos con palabras simples para que sepas qué revisar.",
  },
  {
    id: "siguiente-paso",
    label: "Qué revisar",
    badge: "Lo primero que conviene comparar",
    summary: "Te mostramos el siguiente cruce útil para confirmar si la señal es real o no.",
  },
];

const heroMicroDemoScenes: HeroMicroDemoScene[] = [
  {
    step: "Paso 1",
    title: "Subes tu recibo",
    detail: "Puede ser foto o PDF. Solo necesitas un archivo para empezar.",
    accent: "Recibo listo",
  },
  {
    step: "Paso 2",
    title: "Ves una señal clara",
    detail: "Te mostramos solo lo importante para que no te pierdas.",
    accent: "Señal clara",
  },
  {
    step: "Paso 3",
    title: "Sabes qué revisar",
    detail: "Recibes el siguiente paso más útil para salir de dudas.",
    accent: "Qué sigue",
  },
  {
    step: "Listo",
    title: "Tú decides si sigues",
    detail: "Primero ves el resultado y luego decides si quieres guardar o continuar.",
    accent: "Tú tienes el control",
  },
];

const socialProofItems: SocialProofItem[] = [
  {
    caseId: "Caso anónimo 01",
    label: "Recibo reciente + CFDI del mismo periodo",
    quote: "Ahí vi dónde podía estar perdiendo dinero.",
    amountHighlight: "Diferencia estimada: $3,240 MXN",
    nextAction: "Subir el CFDI del mismo mes para contrastar monto, periodo y conceptos.",
    supportingDetail:
      "El primer cruce volvió visible una diferencia estimada de $3,240 MXN entre lo pagado y lo timbrado, con monto, periodo y conceptos a revisar.",
    verification:
      "Caso anonimizado: la persona pasó de sospecha general a una ruta concreta para comparar, reclamar o seguir reuniendo evidencia.",
  },
  {
    caseId: "Caso anónimo 02",
    label: "Primer hallazgo con ruta clara de acción",
    quote: "Ya supe qué reclamar primero.",
    amountHighlight: "Foco inicial: pago incompleto en revisión",
    nextAction: "Comparar el recibo siguiente y guardar la primera lectura para ordenar evidencia.",
    supportingDetail:
      "La primera lectura no se quedó en la alerta: también ordenó cuál documento subir después para confirmar si el pago estaba incompleto.",
    verification:
      "Caso anonimizado: el valor percibido subió cuando el resultado devolvió acción práctica y no solo una señal interesante.",
  },
  {
    caseId: "Caso anónimo 03",
    label: "Inicio cuidadoso con claridad de siguiente paso",
    quote: "Sí me animé a subirlo porque entendí qué seguía después.",
    amountHighlight: "Entrada gratis y privada desde el primer archivo",
    nextAction: "Guardar el hallazgo sólo si sirve y continuar después con el documento recomendado.",
    supportingDetail:
      "El flujo permitió empezar gratis con un archivo cotidiano, entender el siguiente paso útil y decidir con calma si valía la pena guardar el hallazgo.",
    verification:
      "Caso anonimizado: claridad sobre privacidad, pasos y beneficio inmediato redujo fricción en la primera subida.",
  },
];

const prediagnosticRecommendations: Record<
  string,
  {
    badge: string;
    document: string;
    reason: string;
    nextStep: string;
    resultTitle: string;
    ctaLabel: string;
  }
> = {
  "para-mi": {
    badge: "Resultado instantáneo",
    document: "Tu recibo de nómina más reciente o un CFDI del mismo periodo",
    reason:
      "Suelen dar contexto rápido sobre pagos, deducciones, fechas y conceptos para que veas pronto si AuditaPatron te puede ayudar.",
    nextStep: "Si después quieres más claridad, suma contrato o soporte IMSS/Infonavit y tu expediente gana contexto sin perder el hilo.",
    resultTitle: "Empieza con la evidencia que más rápido revela pagos, deducciones y periodos.",
    ctaLabel: "Quiero revisar ese documento",
  },
  "primer-documento": {
    badge: "Documento exacto sugerido",
    document: "El archivo que ya tienes a la mano; si dudas, un recibo de nómina reciente",
    reason: "Es el archivo más fácil de ubicar y suele dar una primera lectura útil.",
    nextStep: "Si luego sumas uno o dos documentos, la lectura mejora.",
    resultTitle: "Si quieres avanzar hoy, este suele ser el archivo con más tracción para arrancar.",
    ctaLabel: "Empezar con ese archivo",
  },
  "privacidad": {
    badge: "Inicio con control",
    document: "Un recibo reciente o tu contrato actual",
    reason:
      "Te permite probar el flujo con un archivo cotidiano, revisar cómo se resguarda y sentir control antes de subir más documentos.",
    nextStep: "Cuando te sientas con confianza, agrega otros archivos para fortalecer tu expediente sin perder trazabilidad.",
    resultTitle: "Puedes empezar con un archivo cotidiano y validar el resguardo antes de abrir más contexto.",
    ctaLabel: "Probar con un archivo simple",
  },
  "sin-tecnicismos": {
    badge: "Recomendación simple",
    document: "Tu recibo de nómina más reciente",
    reason:
      "Es de los archivos más fáciles de reconocer y suele dar una explicación inicial clara sin lenguaje técnico.",
    nextStep: "Después puedes sumar CFDI o contrato para obtener comparaciones más útiles.",
    resultTitle: "Este suele ser el documento más fácil de reconocer y de entender en una primera revisión.",
    ctaLabel: "Quiero una revisión simple",
  },
  "mas-contexto": {
    badge: "Para enriquecer tu expediente",
    document: "Dos o tres recibos de nómina seguidos",
    reason:
      "Ayudan a detectar patrones y diferencias que un solo archivo puede dejar ocultos.",
    nextStep: "Si además agregas CFDI, contrato o soporte IMSS/Infonavit, tu expediente gana todavía más valor.",
    resultTitle: "Si ya tienes varios recibos, este paquete te da una lectura con más contexto desde el inicio.",
    ctaLabel: "Subir varios recibos",
  },
};

const SCROLL_TARGET_FALLBACKS: Record<string, string[]> = {
  "como-funciona": ["como-funciona", "ruta-movil-como-funciona"],
  expediente: ["expediente", "ruta-movil-expediente"],
  copiloto: ["copiloto"],
  preguntas: ["preguntas"],
};

function isUsableScrollTarget(target: HTMLElement) {
  const rect = target.getBoundingClientRect();
  const styles = window.getComputedStyle(target);

  return rect.width > 0 && rect.height > 0 && styles.display !== "none" && styles.visibility !== "hidden";
}

function resolveScrollTarget(id: string) {
  const candidateIds = SCROLL_TARGET_FALLBACKS[id] ?? [id];
  let fallbackTarget: HTMLElement | null = null;

  for (const candidateId of candidateIds) {
    const directMatch = document.getElementById(candidateId);
    const sectionMatch = document.querySelector<HTMLElement>(`section#${CSS.escape(candidateId)}`);

    for (const candidate of [sectionMatch, directMatch]) {
      if (!candidate) {
        continue;
      }

      if (!fallbackTarget) {
        fallbackTarget = candidate;
      }

      if (isUsableScrollTarget(candidate)) {
        return candidate;
      }
    }
  }

  return fallbackTarget;
}

function scrollToId(id: string) {
  const target = resolveScrollTarget(id);

  if (!target) {
    return;
  }

  const headerOffset = 96;
  const targetTop = target.getBoundingClientRect().top + window.scrollY - headerOffset;
  window.history.replaceState(null, "", `#${id}`);
  window.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
}

const PRIMARY_CTA_LABEL = "Empezar auditoría gratis";

function goToAuditFlow(
  payloadOrEvent?:
    | Record<string, string | number | boolean | null | undefined>
    | { preventDefault?: () => void },
) {
  const payload: Record<string, string | number | boolean | null | undefined> =
    payloadOrEvent && "preventDefault" in payloadOrEvent
      ? {}
      : ((payloadOrEvent ?? {}) as Record<string, string | number | boolean | null | undefined>);

  trackEvent("audipatron_home_cta_clicked", {
    source: "home",
    destination: "/auditar",
    ...payload,
  });

  trackFunnelStep("home_cta_clicked", {
    source: "home",
    destination: "/auditar",
    ...payload,
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
      <div className="container mx-auto flex h-[4.55rem] max-w-[1380px] items-center justify-between gap-2 sm:h-[5rem] lg:gap-3">
        <a
          href="#top"
          aria-label="Ir al inicio de AuditaPatron"
          className="flex min-w-0 max-w-[40vw] shrink items-center pl-1 max-[359px]:max-w-[37vw] sm:max-w-none sm:pl-0 lg:max-w-[420px]"
        >
          <AuditaPatronLogoWordmark
            surface="dark"
            className="min-w-0"
            imageClassName="!h-8 w-auto max-w-[min(34vw,7.8rem)] object-contain max-[359px]:!h-7 max-[359px]:max-w-[min(31vw,6.85rem)] sm:!h-10 sm:max-w-[19rem] lg:!h-[3rem] lg:max-w-[23rem]"
          />
        </a>

        <nav className="hidden min-w-0 flex-1 items-center justify-center gap-1 lg:flex xl:gap-1.5">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={(event) => {
                event.preventDefault();
                scrollToId(link.href.replace("#", ""));
              }}
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
              window.location.href = "/acceso?returnTo=/auditar";
            }}
          >
            Entrar
          </Button>
          <Button
            className="motion-hover-lift h-9 rounded-full bg-teal-500 px-3 text-[0.9rem] font-semibold text-slate-950 hover:bg-teal-400 xl:px-3.5"
            onClick={() => goToAuditFlow({ placement: "header_primary" })}
          >
            {PRIMARY_CTA_LABEL}
            <ArrowRight className="ml-2 h-4 w-4" strokeWidth={1.8} />
          </Button>
        </div>

        <div className="flex min-w-0 shrink-0 items-center gap-2 lg:hidden">
          <Button
            className="motion-hover-lift h-11 min-h-11 min-w-[6.75rem] max-w-[7.25rem] rounded-full bg-teal-400 px-3 text-[0.78rem] font-semibold text-slate-950 shadow-[0_18px_34px_-20px_rgba(45,212,191,0.82)] transition duration-200 ease-out hover:-translate-y-0.5 hover:bg-teal-300 active:scale-[0.99] max-[359px]:max-w-[6.7rem] max-[359px]:px-2.75 max-[359px]:text-[0.72rem] sm:max-w-none sm:px-4.5 sm:text-[0.9rem]"
            onClick={() => goToAuditFlow({ placement: "header_primary" })}
          >
            <span className="truncate sm:hidden">Empezar</span>
            <span className="hidden sm:inline">{PRIMARY_CTA_LABEL}</span>
          </Button>
          <button
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white shadow-[0_14px_26px_-20px_rgba(15,23,42,0.9)] transition duration-200 ease-out hover:-translate-y-0.5 hover:bg-white/14 active:scale-[0.98]"
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
                Entra para continuar tu expediente. Aquí dejamos una sola ruta principal para que empezar sea más claro.
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
                    onClick={(event) => {
                      event.preventDefault();
                      setOpen(false);
                      scrollToId(link.href.replace("#", ""));
                    }}
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
                  window.location.href = "/acceso?returnTo=/auditar";
                }}
              >
                Entrar
              </Button>
              <Button
                className="motion-hover-lift h-12 rounded-full bg-teal-600 text-base font-semibold text-white shadow-[0_18px_34px_-20px_rgba(13,148,136,0.52)] transition duration-200 ease-out hover:-translate-y-0.5 hover:bg-teal-700 active:scale-[0.99]"
                onClick={() => {
                  setOpen(false);
                  goToAuditFlow({ placement: "mobile_menu_cta" });
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
  const [selectedHeroVariant, setSelectedHeroVariant] = useState<InteractiveHeroVariantKey>("control");
  const [selectedHeroPrediagnostic, setSelectedHeroPrediagnostic] = useState<(typeof heroPrediagnosticOptions)[number]["id"]>("primer-documento");
  const [activeFindingIndex, setActiveFindingIndex] = useState(0);
  const [selectedReportDemoState, setSelectedReportDemoState] = useState<(typeof reportDemoStates)[number]["id"]>("hallazgo-preliminar");
  const [activeMicroDemoSceneIndex, setActiveMicroDemoSceneIndex] = useState(0);
  const heroSectionRef = useRef<HTMLElement | null>(null);
  const heroScrollMilestonesRef = useRef<Set<number>>(new Set());
  const queryHeroVariant = useMemo<"short_paid_campaign" | "direct_money_check" | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }

    const heroVariant = new URLSearchParams(window.location.search).get("hero_variant");
    return heroVariant === "short_paid_campaign" || heroVariant === "direct_money_check" ? heroVariant : null;
  }, []);
  const trackedHeroVariant = queryHeroVariant ?? selectedHeroVariant;
  const isShortPaidCampaignHero = queryHeroVariant === "short_paid_campaign";
  const isDirectMoneyCheckHero = queryHeroVariant === "direct_money_check";
  const activeHeroVariant = heroCopyVariants[trackedHeroVariant];
  const activePrediagnostic = prediagnosticRecommendations[selectedHeroPrediagnostic];
  const activeFinding = heroFindingSlides[activeFindingIndex];
  const activeReportDemoState = reportDemoStates.find((state) => state.id === selectedReportDemoState) ?? reportDemoStates[1];
  const activeMicroDemoScene = heroMicroDemoScenes[activeMicroDemoSceneIndex] ?? heroMicroDemoScenes[0];
  const dossierReadiness = heroVariantReadiness[trackedHeroVariant];
  const activeReportDemoCopy = useMemo(() => {
    if (selectedReportDemoState === "documento-recibido") {
      return {
        title: "Recibo recibido: ya podemos empezar",
        description: "Ya vimos tu recibo y con eso podemos darte una primera lectura útil.",
        focusLabel: "Lo primero que vemos",
        focusValue: "Este recibo ya sirve para empezar a revisar si algo no cuadra en tu pago.",
        focusClass: "border-slate-200 bg-slate-50/90 text-slate-800",
        secondaryLabel: "Qué sigue",
        secondaryValue: "Si luego tienes el comprobante fiscal del mismo mes, lo puedes subir para confirmar mejor.",
        secondaryClass: "border-slate-200 bg-white text-slate-700",
        progressLabel: "Avance de la revisión",
      };
    }

    if (selectedReportDemoState === "siguiente-paso") {
      return {
        title: "Esto es lo primero que conviene revisar",
        description: "Todavía no cerramos nada. Te mostramos el paso más útil para salir de dudas.",
        focusLabel: "Siguiente paso",
        focusValue: "Compara el comprobante fiscal del mismo mes con tu recibo.",
        focusClass: "border-emerald-200 bg-emerald-50/80 text-emerald-950",
        secondaryLabel: "Para qué sirve",
        secondaryValue: "Así confirmas si la diferencia es real o no.",
        secondaryClass: "border-teal-100 bg-teal-50/80 text-teal-900",
        progressLabel: "Qué tan clara va la revisión",
      };
    }

    return {
      title: "Señal encontrada: algo podría no cuadrar",
      description: "Vemos una señal inicial y te la mostramos con palabras simples.",
      focusLabel: "Qué significa",
      focusValue: "El monto, el periodo o algún concepto podría verse distinto entre tus papeles.",
      focusClass: "border-amber-200 bg-amber-50/80 text-amber-950",
      secondaryLabel: "Qué hacer después",
      secondaryValue: "Sube el comprobante fiscal del mismo mes para confirmar si de verdad hay diferencia.",
      secondaryClass: "border-teal-100 bg-teal-50/80 text-teal-900",
      progressLabel: "Avance de la lectura",
    };
  }, [activeFinding, selectedReportDemoState]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setActiveMicroDemoSceneIndex((current) => (current + 1) % heroMicroDemoScenes.length);
    }, 3200);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    trackEvent("audipatron_hero_state_viewed", {
      source: "hero",
      hero_variant: trackedHeroVariant,
      prediagnostic: selectedHeroPrediagnostic,
    });
  }, [selectedHeroPrediagnostic, trackedHeroVariant]);

  useEffect(() => {
    if (!isShortPaidCampaignHero) {
      return;
    }

    trackEvent("audipatron_hero_paid_variant_activated", {
      source: "hero",
      variant: "short_paid_campaign",
    });
  }, [isShortPaidCampaignHero]);

  useEffect(() => {
    if (!isDirectMoneyCheckHero) {
      return;
    }

    trackEvent("audipatron_hero_direct_variant_activated", {
      source: "hero",
      variant: "direct_money_check",
    });
  }, [isDirectMoneyCheckHero]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const thresholds = [25, 50, 75, 100] as const;

    const handleScrollDepth = () => {
      const section = heroSectionRef.current;
      if (!section) {
        return;
      }

      const rect = section.getBoundingClientRect();
      const progress = Math.min(100, Math.max(0, (-rect.top / Math.max(rect.height * 0.72, 180)) * 100));

      thresholds.forEach((threshold) => {
        if (progress >= threshold && !heroScrollMilestonesRef.current.has(threshold)) {
          heroScrollMilestonesRef.current.add(threshold);

          trackEvent("audipatron_hero_scroll_depth_reached", {
            source: "hero",
            hero_variant: trackedHeroVariant,
            prediagnostic: selectedHeroPrediagnostic,
            depth_percentage: threshold,
          });

          trackFunnelStep("hero_scroll_depth_reached", {
            source: "hero",
            hero_variant: trackedHeroVariant,
            prediagnostic: selectedHeroPrediagnostic,
            depth_percentage: threshold,
          });
        }
      });
    };

    handleScrollDepth();
    window.addEventListener("scroll", handleScrollDepth, { passive: true });
    window.addEventListener("resize", handleScrollDepth);

    return () => {
      window.removeEventListener("scroll", handleScrollDepth);
      window.removeEventListener("resize", handleScrollDepth);
    };
  }, [selectedHeroPrediagnostic, trackedHeroVariant]);

  useEffect(() => {
    trackEvent("audipatron_hero_finding_viewed", {
      source: "hero",
      hero_variant: trackedHeroVariant,
      prediagnostic: selectedHeroPrediagnostic,
      finding_id: activeFinding.id,
      finding_index: activeFindingIndex + 1,
    });
  }, [activeFinding.id, activeFindingIndex, selectedHeroPrediagnostic, trackedHeroVariant]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setActiveFindingIndex((current) => (current + 1) % heroFindingSlides.length);
    }, 5600);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  function handleHeroVariantChange(variantKey: InteractiveHeroVariantKey) {
    if (variantKey === selectedHeroVariant) {
      return;
    }

    const previousVariant = selectedHeroVariant;
    setSelectedHeroVariant(variantKey);

    trackEvent("audipatron_hero_variant_selected", {
      source: "hero",
      hero_variant: variantKey,
      prediagnostic: selectedHeroPrediagnostic,
    });

    trackEvent("audipatron_hero_variant_changed", {
      source: "hero",
      from_variant: previousVariant,
      to_variant: variantKey,
      prediagnostic: selectedHeroPrediagnostic,
    });

    trackFunnelStep("hero_variant_selected", {
      source: "hero",
      hero_variant: variantKey,
      prediagnostic: selectedHeroPrediagnostic,
    });

    trackFunnelStep("hero_variant_changed", {
      source: "hero",
      from_variant: previousVariant,
      to_variant: variantKey,
      prediagnostic: selectedHeroPrediagnostic,
    });
  }

  function handleHeroPrediagnosticSelect(optionId: (typeof heroPrediagnosticOptions)[number]["id"]) {
    setSelectedHeroPrediagnostic(optionId);

    trackEvent("audipatron_hero_prediagnostic_selected", {
      source: "hero",
      hero_variant: trackedHeroVariant,
      prediagnostic: optionId,
    });

    trackFunnelStep("hero_prediagnostic_selected", {
      source: "hero",
      hero_variant: trackedHeroVariant,
      prediagnostic: optionId,
    });
  }

  function handleReportDemoStateChange(stateId: (typeof reportDemoStates)[number]["id"]) {
    if (stateId === selectedReportDemoState) {
      return;
    }

    setSelectedReportDemoState(stateId);

    trackEvent("audipatron_report_demo_state_selected", {
      source: "hero",
      hero_variant: trackedHeroVariant,
      prediagnostic: selectedHeroPrediagnostic,
      finding_id: activeFinding.id,
      report_demo_state: stateId,
    });

    trackFunnelStep("report_demo_state_selected", {
      source: "hero",
      hero_variant: trackedHeroVariant,
      prediagnostic: selectedHeroPrediagnostic,
      finding_id: activeFinding.id,
      report_demo_state: stateId,
    });
  }

  function handleHeroSecondaryCta() {
    const payload = {
      source: "hero",
      hero_variant: trackedHeroVariant,
      prediagnostic: selectedHeroPrediagnostic,
      cta_label: activeHeroVariant.ctaSecondary,
      destination_section: "ejemplo-reporte",
    };

    trackEvent("audipatron_home_secondary_cta_clicked", payload);
    trackFunnelStep("home_secondary_cta_clicked", payload);

    scrollToId("ejemplo-reporte");
  }

  function handleHeroFindingChange(nextIndex: number, interaction: "previous" | "next" | "direct") {
    setActiveFindingIndex(nextIndex);

    trackEvent("audipatron_hero_finding_changed", {
      source: "hero",
      hero_variant: trackedHeroVariant,
      prediagnostic: selectedHeroPrediagnostic,
      finding_id: heroFindingSlides[nextIndex]?.id,
      finding_index: nextIndex + 1,
      interaction,
    });
  }

  return (
    <section
      ref={heroSectionRef}
      id="top"
      className="relative overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(20,184,166,0.16),_transparent_40%),radial-gradient(circle_at_top_right,_rgba(125,211,252,0.14),_transparent_30%),linear-gradient(180deg,_#f9fcfb_0%,_#eef6f5_100%)] pb-3 pt-3 sm:pb-8 sm:pt-8 lg:pt-10"
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,_rgba(229,244,242,0.92)_0%,_rgba(216,236,233,0.98)_100%)] sm:hidden" />
      <div className="container relative z-10 mx-auto grid max-w-6xl items-center gap-5 sm:gap-6 lg:grid-cols-[1.02fr_0.98fr] lg:gap-10 xl:gap-12">
        <div className="mx-auto flex max-w-2xl flex-col items-center text-center lg:mx-0 lg:items-start lg:text-left">
          <div
            className="motion-enter-soft inline-flex max-w-full flex-wrap items-center justify-center gap-2 rounded-full border border-teal-100 bg-white/92 px-3 py-1.5 text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-teal-800 shadow-[0_18px_40px_-30px_rgba(20,184,166,0.35)] max-[359px]:gap-1.5 max-[359px]:px-2.5 max-[359px]:text-[9px] max-[359px]:tracking-[0.12em] sm:max-w-fit sm:flex-nowrap sm:px-4 sm:py-2 sm:text-xs sm:tracking-[0.16em]"
            style={{ ["--motion-delay" as string]: "20ms" }}
          >
            <ShieldCheck className="h-4 w-4 shrink-0" strokeWidth={1.8} />
            <span className="sm:hidden">Sube foto o PDF</span>
            <span className="hidden sm:inline">Sube tu recibo y revísalo gratis</span>
          </div>

            <h1
              className="motion-enter-soft mt-2.5 max-w-[14ch] text-balance text-[2.12rem] font-bold leading-[0.95] tracking-[-0.06em] text-slate-950 max-[359px]:max-w-[13ch] max-[359px]:text-[1.9rem] max-[359px]:leading-[0.98] sm:mt-4 sm:max-w-[13ch] sm:text-[3.05rem] lg:max-w-[12ch] lg:text-[3.75rem]"
              style={{ ["--motion-delay" as string]: "120ms" }}
            >
              {activeHeroVariant.headline}
            </h1>

            <p
              className="motion-enter-soft mt-2.5 max-w-xl text-[0.98rem] leading-7 text-slate-700 max-[359px]:text-[0.95rem] max-[359px]:leading-6 sm:text-[1rem] sm:leading-7"
              style={{ ["--motion-delay" as string]: "180ms" }}
            >
              {activeHeroVariant.supportLine}
            </p>

            <p
              className="motion-enter-soft mt-1.5 max-w-xl text-sm font-medium leading-6 text-slate-800 max-[359px]:text-[0.9rem] max-[359px]:leading-6 sm:text-[0.96rem] sm:leading-7"
              style={{ ["--motion-delay" as string]: "200ms" }}
            >
              {activeHeroVariant.microDescription}
            </p>

            {activeHeroVariant.body ? (
              <p
                className="motion-enter-soft mt-2 max-w-xl text-[0.98rem] leading-7 text-slate-600 max-[359px]:text-[0.95rem] max-[359px]:leading-6 sm:text-[1rem] sm:leading-7"
                style={{ ["--motion-delay" as string]: "210ms" }}
              >
                {activeHeroVariant.body}
              </p>
            ) : null}

            <div
              className={
                isShortPaidCampaignHero
                  ? "hidden"
                  : "motion-enter-soft order-3 mt-4 hidden w-full max-w-xl rounded-[1.45rem] border border-teal-100/80 bg-white/96 p-4 shadow-[0_20px_44px_-36px_rgba(15,23,42,0.24)] sm:order-none sm:block sm:p-4"
              }
              style={{ ["--motion-delay" as string]: "250ms" }}
            >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-700">
                  Si no sabes con qué empezar
                </p>
                <p className="mt-1 text-sm leading-6 text-slate-700">
Empieza por el papel que tengas más a la mano: un recibo reciente, una foto clara o el comprobante del mismo mes.
                </p>
              </div>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-800">
                  Empieza por un solo recibo
                </span>
            </div>

            <div className="mt-4 rounded-[1.35rem] border border-slate-200 bg-slate-50/90 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-teal-100 bg-teal-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-teal-800">
                  Documento recomendado para arrancar
                </span>
              </div>
              <p className="mt-3 text-sm font-semibold leading-6 text-slate-950 sm:text-[0.98rem]">{activePrediagnostic.resultTitle}</p>
              <p className="mt-3 rounded-[1.15rem] border border-white bg-white px-4 py-3 text-sm font-semibold leading-6 text-slate-950 shadow-sm">
                {activePrediagnostic.document}
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-700">{activePrediagnostic.reason}</p>
              <p className="mt-3 text-sm font-medium leading-6 text-teal-800">{activePrediagnostic.nextStep}</p>
            </div>
          </div>

          <div
            className="motion-enter-soft order-2 mt-3 flex w-full max-w-sm flex-col gap-2.5 max-[359px]:gap-2 sm:order-none sm:mt-6 sm:max-w-none sm:items-start"
            style={{ ["--motion-delay" as string]: "300ms" }}
          >
            <Button
              className="motion-hover-lift h-12 w-full rounded-full bg-teal-600 px-7 text-base font-semibold text-white shadow-[0_20px_38px_-24px_rgba(13,148,136,0.55)] transition duration-200 ease-out hover:-translate-y-0.5 hover:bg-teal-700 active:scale-[0.99] sm:w-auto"
              onClick={() => {
                trackEvent("audipatron_home_primary_cta_redirected_to_guest_preview", {
                  entry_point: "hero_primary",
                  placement: "hero_primary",
                  hero_variant: trackedHeroVariant,
                  prediagnostic: selectedHeroPrediagnostic,
                  cta_label: activeHeroVariant.ctaPrimary,
                });
                trackFunnelStep("home_primary_cta_redirected_to_guest_preview", {
                  entry_point: "hero_primary",
                  placement: "hero_primary",
                  hero_variant: trackedHeroVariant,
                  prediagnostic: selectedHeroPrediagnostic,
                });
                scrollToId("lectura-gratis");
              }}
            >
              {PRIMARY_CTA_LABEL}
              <ArrowRight className="motion-arrow ml-2 h-4 w-4" strokeWidth={1.8} />
            </Button>
              <div className="space-y-2 max-[359px]:space-y-1.5">
                <div className="grid gap-2 sm:grid-cols-2">
                  {[
                    "Gratis para empezar",
                    "Nadie de tu empresa lo ve",
                  ].map((item) => (
                    <div key={item} className="rounded-[1.05rem] border border-teal-100 bg-white/92 px-3 py-2 shadow-sm">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-teal-800">{item}</p>
                    </div>
                  ))}
                </div>
                <p className="text-sm leading-6 text-slate-700">
                  Empieza con una foto o PDF del documento que ya tengas. En unos segundos ves si tu pago merece una revisión más a fondo.
                </p>
                <p className="text-xs leading-5 text-slate-500">
                  No necesitas cuenta para empezar y puedes borrar tu archivo cuando quieras.
                </p>
              </div>
          </div>


          <div
            className="motion-enter-soft mt-2 w-full max-w-xl rounded-[1.35rem] border border-slate-200 bg-white/92 p-3.5 shadow-[0_20px_42px_-34px_rgba(15,23,42,0.28)] max-[359px]:p-3 sm:p-4"
            style={{ ["--motion-delay" as string]: "360ms" }}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Así de simple</p>
            <div className="mt-2.5 grid gap-2.5 sm:grid-cols-3">
              {[
                "Subes tu recibo.",
                "Ves una señal clara.",
                "Sabes qué hacer después.",
              ].map((item) => (
                <div key={item} className="rounded-[1.15rem] border border-slate-200 bg-slate-50 px-3.5 py-3 shadow-sm">
                  <p className="text-sm font-semibold leading-6 text-slate-900">{item}</p>
                </div>
              ))}
            </div>
          </div>

          <div
            className="motion-enter-soft mt-2.5 w-full max-w-3xl rounded-[1.5rem] border border-slate-200 bg-white/94 p-4 shadow-[0_22px_46px_-38px_rgba(15,23,42,0.24)] sm:p-5"
            style={{ ["--motion-delay" as string]: "390ms" }}
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-700">Casos anonimizados</p>
                <p className="mt-2 text-base font-semibold leading-7 text-slate-950 sm:text-[1.05rem]">
                  Lo que otras personas alcanzaron a ver en su primera lectura.
                </p>
              </div>
              <p className="text-xs leading-5 text-slate-500">
                Montos y rutas mostrados como referencia orientativa para explicar el tipo de salida inicial.
              </p>
            </div>
            <div className="mt-4 grid gap-3 lg:grid-cols-3">
              {socialProofItems.map((item) => (
                <article key={item.caseId} className="rounded-[1.25rem] border border-slate-200 bg-slate-50/85 p-4 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{item.caseId}</p>
                  <p className="mt-2 text-sm font-semibold leading-6 text-slate-950">{item.label}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-700">“{item.quote}”</p>
                  <p className="mt-3 inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-900">
                    {item.amountHighlight}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{item.supportingDetail}</p>
                  <div className="mt-3 rounded-[1rem] border border-white bg-white px-3.5 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-teal-700">Siguiente acción sugerida</p>
                    <p className="mt-1 text-sm leading-6 text-slate-700">{item.nextAction}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>

        <div className="relative lg:pl-2">
          <div className="absolute -left-4 top-6 h-24 w-24 rounded-full bg-teal-200/50 blur-3xl" />
          <div className="absolute -right-4 bottom-8 h-24 w-24 rounded-full bg-sky-200/60 blur-3xl" />
          <div
            id="ejemplo-reporte"
            className="motion-enter-soft relative overflow-hidden rounded-[2rem] border border-slate-300/80 bg-[linear-gradient(180deg,_rgba(255,255,255,0.98)_0%,_rgba(243,250,249,0.98)_100%)] p-5 shadow-[0_34px_86px_-54px_rgba(15,23,42,0.34)] transition duration-300 ease-out hover:-translate-y-1 max-[359px]:p-4 sm:p-6"
            style={{ ["--motion-delay" as string]: "220ms" }}
          >
            <div className="rounded-[1.4rem] border border-teal-100/80 bg-[linear-gradient(180deg,_#f8fffe_0%,_#edf7f5_100%)] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] max-[359px]:px-3.5 max-[359px]:py-3.5 sm:px-5 sm:py-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Así se ve tu resultado
                  </p>
                  <p className="mt-2 max-w-[16ch] text-[1.82rem] font-bold leading-[0.95] tracking-[-0.05em] text-slate-950 max-[359px]:max-w-[14ch] max-[359px]:text-[1.62rem] sm:text-[2.2rem]">
                    {activeReportDemoCopy.title}
                  </p>
                  <p className="mt-3 inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-900 shadow-sm">
                    {selectedReportDemoState === "hallazgo-preliminar"
                      ? "Ejemplo simple: una sola señal clara."
                      : selectedReportDemoState === "documento-recibido"
                        ? "Ejemplo simple: primero vemos tu recibo."
                        : "Ejemplo simple: te decimos qué revisar primero."}
                  </p>
                </div>
                <div className="rounded-full border border-amber-200 bg-amber-100/90 px-3 py-1 text-xs font-semibold text-amber-800 shadow-sm">
                  1 señal por vista
                </div>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-700">
                {activeReportDemoCopy.description}
              </p>

              <div className="mt-4 grid gap-2 max-[359px]:gap-1.5 sm:grid-cols-3">
                {reportDemoStates.map((state) => {
                  const isActive = selectedReportDemoState === state.id;

                  return (
                    <button
                      key={state.id}
                      type="button"
                      onClick={() => handleReportDemoStateChange(state.id)}
                      className={`rounded-[1.1rem] border px-3 py-3 text-left transition max-[359px]:px-2.5 max-[359px]:py-2.5 ${
                        isActive
                          ? "border-teal-300 bg-teal-50 text-teal-950 shadow-[0_18px_42px_-34px_rgba(13,148,136,0.34)]"
                          : "border-slate-200 bg-white/88 text-slate-700 hover:border-teal-200 hover:bg-white"
                      }`}
                      aria-pressed={isActive}
                    >
                      <p className="text-sm font-semibold leading-5">{state.label}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">{state.badge}</p>
                    </button>
                  );
                })}
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-500">
                Tres vistas simples para entender rápido qué verías.
              </p>

              <div className="mt-5 rounded-[1.3rem] border border-white/90 bg-white/92 p-4 shadow-sm">
                <p className="text-[1.28rem] font-semibold leading-7 tracking-[-0.03em] text-slate-950 sm:text-[1.35rem]">{activeReportDemoCopy.title}</p>
                <p className="mt-3 text-sm leading-6 text-slate-700">{activeReportDemoCopy.description}</p>

                <div className={`mt-4 rounded-[1.1rem] border px-4 py-3 ${activeReportDemoCopy.focusClass}`}>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em]">{activeReportDemoCopy.focusLabel}</p>
                  <p className="mt-1 text-sm font-semibold leading-6">{activeReportDemoCopy.focusValue}</p>
                </div>

                <div className={`mt-4 rounded-[1.1rem] border px-4 py-3 ${activeReportDemoCopy.secondaryClass}`}>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em]">{activeReportDemoCopy.secondaryLabel}</p>
                  <p className="mt-1 text-sm leading-6">{activeReportDemoCopy.secondaryValue}</p>
                </div>

                <div className="mt-4 rounded-[1.05rem] border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Lo primero que verás
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-700">
                    Una sola señal clara, una explicación breve y el siguiente paso más útil para salir de dudas.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-5 rounded-[1.3rem] border border-slate-200 bg-white/96 p-4 text-sm leading-6 text-slate-700 shadow-[0_20px_44px_-34px_rgba(15,23,42,0.34)]">
              Empiezas con un solo archivo, ves una lectura simple y decides después si quieres seguir.
            </div>

            <button
              type="button"
              onClick={() => {
                trackEvent("audipatron_home_sidebar_cta_redirected_to_guest_preview", {
                  entry_point: "hero_sidebar",
                  placement: "hero_sidebar",
                  hero_variant: trackedHeroVariant,
                  prediagnostic: selectedHeroPrediagnostic,
                  cta_label: "Siguiente paso sugerido",
                });
                scrollToId("lectura-gratis");
              }}
              className="mt-5 block w-full rounded-[1.35rem] border border-teal-200 bg-[linear-gradient(180deg,_#ecfdf9_0%,_#dff7f1_100%)] px-4 py-4 text-left shadow-[0_20px_46px_-34px_rgba(13,148,136,0.24)] transition duration-200 ease-out hover:-translate-y-0.5 hover:bg-[linear-gradient(180deg,_#e6fbf5_0%,_#d7f3eb_100%)] hover:shadow-[0_26px_56px_-36px_rgba(13,148,136,0.28)] active:scale-[0.995]"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-700">
                    Sube tu documento gratis
                  </p>
                  <p className="mt-1 text-sm font-semibold text-teal-950">
                    Empieza con {activePrediagnostic.document.toLowerCase()} y recibe una primera lectura clara, confidencial y visible desde el primer intento.
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
                  Documento sugerido: {activePrediagnostic.badge}
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-teal-800">
                Entra aquí para subir ese archivo gratis y recibir una primera lectura útil. Tu revisión se mantiene confidencial y el siguiente paso aparece dentro de tu expediente solo si te hace sentido.
              </p>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function HeliosFirstEntrySection() {
  const auth = useAuth();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const landingQuery = trpc.landing.heliosHome.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const bootstrapMutation = trpc.workspace.bootstrap.useMutation();
  const homeSnapshotQuery = trpc.workspace.homeSnapshot.useQuery(undefined, {
    enabled: auth.isAuthenticated,
    refetchOnWindowFocus: false,
  });
  const guestAnalyzeMutation = trpc.cases.guestAnalyzeDocument.useMutation();
  const createCaseMutation = trpc.cases.create.useMutation();
  const claimGuestPreviewMutation = trpc.cases.claimGuestPreview.useMutation();
  const [guestPreview, setGuestPreview] = useState<StoredHomeGuestPreview | null>(() => readStoredHomeGuestPreview());
  const [guestError, setGuestError] = useState<string | null>(null);
  const [resumeAttempted, setResumeAttempted] = useState(false);
  const [ceoPanelPreferenceReady, setCeoPanelPreferenceReady] = useState(false);
  const [ceoPanelPreferenceOpen, setCeoPanelPreferenceOpen] = useState(false);
  const [ceoActionsDrawerOpen, setCeoActionsDrawerOpen] = useState(false);

  const publicExamples = (landingQuery.data?.examples ?? []) as LandingHeliosExample[];
  const stableUserIdentifier = useMemo(
    () => getStableUserIdentifier(auth.realUser ?? auth.user),
    [auth.realUser, auth.user]
  );
  const featuredExample = publicExamples[0] ?? null;
  const publicActivity = landingQuery.data?.publicActivity;
  const latestCase = homeSnapshotQuery.data?.latestCase ?? null;
  const tenantId = bootstrapMutation.data?.tenant?.tenantId ?? homeSnapshotQuery.data?.tenantId ?? null;
  const isSavingPreview = createCaseMutation.isPending || claimGuestPreviewMutation.isPending;

  useEffect(() => {
    writeStoredHomeGuestPreview(guestPreview);
  }, [guestPreview]);

  useEffect(() => {
    if (!auth.isAuthenticated || bootstrapMutation.isPending || bootstrapMutation.data || bootstrapMutation.error) {
      return;
    }

    bootstrapMutation.mutate();
  }, [auth.isAuthenticated, bootstrapMutation.data, bootstrapMutation.error, bootstrapMutation.isPending, bootstrapMutation]);

  useEffect(() => {
    if (!auth.canToggleUserView || !stableUserIdentifier) {
      setCeoPanelPreferenceReady(false);
      setCeoPanelPreferenceOpen(false);
      setCeoActionsDrawerOpen(false);
      return;
    }

    setCeoPanelPreferenceReady(false);
    const persistedOpen = readPersistedCeoPanelState(auth.realUser ?? auth.user);
    setCeoPanelPreferenceOpen(persistedOpen);
    setCeoActionsDrawerOpen(persistedOpen);
    setCeoPanelPreferenceReady(true);
  }, [auth.canToggleUserView, auth.realUser, auth.user, stableUserIdentifier]);

  useEffect(() => {
    if (!ceoPanelPreferenceReady || !auth.canToggleUserView || !stableUserIdentifier) {
      return;
    }

    writePersistedCeoPanelState(
      auth.realUser ?? auth.user,
      ceoPanelPreferenceOpen
    );
  }, [
    auth.canToggleUserView,
    auth.realUser,
    auth.user,
    ceoPanelPreferenceOpen,
    ceoPanelPreferenceReady,
    stableUserIdentifier,
  ]);

  async function persistGuestPreview(source: "manual" | "resume") {
    if (!guestPreview || !tenantId) {
      return;
    }

    setGuestError(null);
    const normalizedTitle =
      guestPreview.preview.classification.displayName ??
      guestPreview.preview.classification.normalizedDocType ??
      guestPreview.preview.classification.documentType ??
      "documento";

    const createdCase = await createCaseMutation.mutateAsync({
      tenantId,
      title: `Revisión inicial · ${normalizedTitle}`,
      summary: guestPreview.heliosOpinion.summary,
      status: "intake",
      priority: "medium",
    });

    await claimGuestPreviewMutation.mutateAsync({
      tenantId,
      caseId: createdCase.caseId,
      guestPreviewToken: guestPreview.guestPreviewToken,
    });

    trackEvent("audipatron_home_guest_preview_saved", {
      source,
      case_id: createdCase.caseId,
      tenant_id: tenantId,
      document_type: guestPreview.preview.classification.documentType,
    });

    setGuestPreview(null);
    writeStoredHomeGuestPreview(null);
    window.location.href = "/auditar";
  }

  useEffect(() => {
    if (!auth.isAuthenticated || !guestPreview || !tenantId || resumeAttempted) {
      return;
    }

    setResumeAttempted(true);
    void persistGuestPreview("resume").catch((error: unknown) => {
      setGuestError(error instanceof Error ? error.message : "No pudimos guardar la vista previa dentro de tu expediente.");
    });
  }, [auth.isAuthenticated, guestPreview, resumeAttempted, tenantId]);

  async function handleFileSelection(event: { currentTarget: HTMLInputElement }) {
    const file = event.currentTarget.files?.[0];
    if (!file) {
      return;
    }

    setGuestError(null);
    setResumeAttempted(false);

    try {
      const base64Content = await fileToBase64(file);
      const result = await guestAnalyzeMutation.mutateAsync({
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        base64Content,
        sourceChannel: "manual",
      });

      const nextPreview: StoredHomeGuestPreview = {
        guestPreviewId: result.guestPreviewId,
        guestPreviewToken: result.guestPreviewToken,
        createdAt: result.createdAt,
        preview: result.preview,
        heliosOpinion: result.heliosOpinion,
      };

      setGuestPreview(nextPreview);
      trackEvent("audipatron_home_guest_preview_ready", {
        document_type: result.preview.classification.documentType,
        confidence: result.heliosOpinion.confidenceScore ?? null,
      });
    } catch (error) {
      setGuestError(error instanceof Error ? error.message : "No pudimos leer ese archivo en este momento.");
    } finally {
      event.currentTarget.value = "";
    }
  }

  function handleGuestUploadClick() {
    setGuestError(null);
    fileInputRef.current?.click();
  }

  function setPersistedCeoPanelOpen(nextOpen: boolean) {
    setCeoPanelPreferenceOpen(nextOpen);
    setCeoActionsDrawerOpen(nextOpen);
  }

  function handleLoginToSave() {
    if (typeof window !== "undefined") {
      writeStoredHomeGuestPreview(guestPreview);
      window.location.href = `/acceso?returnTo=${encodeURIComponent(HOME_GUEST_PREVIEW_RETURN_TO)}`;
    }
  }

  return (
    <section id="lectura-gratis" className="bg-white py-12 sm:py-14">
      <div className="container mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1.02fr_0.98fr] lg:items-start">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-teal-100 bg-teal-50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-800">
            <ShieldCheck className="h-4 w-4" strokeWidth={1.8} />
            Primera lectura sin correo
          </div>
          <h2 className="mt-4 max-w-[14ch] text-[2rem] font-bold leading-[0.96] tracking-[-0.05em] text-slate-950 sm:text-[2.65rem]">
            Sube un archivo y mira una señal real antes de decidir.
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 sm:text-[1.04rem] sm:leading-8">
            Aquí ves qué documento llegó, qué señal apareció y cuál es el siguiente paso útil. Solo si te aporta valor te pedimos tu correo para guardarlo dentro de tu expediente privado.
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-900">
              Sin correo para empezar
            </span>
            <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-900">
              Privado desde el inicio
            </span>
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">
              Tú decides si lo guardas
            </span>
          </div>

          <div className="mt-6 rounded-[1.7rem] border border-slate-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f6fbfa_100%)] p-5 shadow-[0_24px_60px_-42px_rgba(15,23,42,0.24)] sm:p-6">
            <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.xml,.jpg,.jpeg,.png,.webp" onChange={handleFileSelection} />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-700">
                  Resultado real desde el primer archivo
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  Empieza con una foto o PDF. No necesitas reunir todo ni abrir una cuenta. Primero ves el valor; después decides si quieres convertirlo en expediente.
                </p>
              </div>
              <Button className="h-11 rounded-full bg-teal-600 px-5 text-white hover:bg-teal-700" onClick={handleGuestUploadClick} disabled={guestAnalyzeMutation.isPending || isSavingPreview}>
                {guestAnalyzeMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" strokeWidth={1.8} />}
                {guestPreview ? "Cambiar documento" : "Empezar con una foto o PDF"}
              </Button>
            </div>

            {guestError ? (
              <div className="mt-4 rounded-[1.15rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
                {guestError}
              </div>
            ) : null}

            {guestPreview ? (
              <div className="mt-5 grid gap-4 lg:grid-cols-[1.08fr_0.92fr]">
                <div className="rounded-[1.35rem] border border-teal-100 bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-teal-100 bg-teal-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-teal-800">
                      {guestPreview.preview.classification.normalizedDocType}
                    </span>
                    {typeof guestPreview.heliosOpinion.confidenceScore === "number" ? (
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-700">
                        Confianza {guestPreview.heliosOpinion.confidenceScore}%
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-3 text-xl font-semibold leading-8 tracking-[-0.03em] text-slate-950">
                    {sanitizeHomeVisibleCopy(guestPreview.heliosOpinion.resultCard?.headline) ?? sanitizeHomeVisibleCopy(guestPreview.heliosOpinion.summary) ?? "Ya revisamos tu documento y hay una primera lectura útil."}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-slate-700">{sanitizeHomeVisibleCopy(guestPreview.heliosOpinion.summary) ?? "Ya hay una primera lectura útil para revisar este documento con más claridad."}</p>
                  <div className="mt-4 rounded-[1.1rem] border border-amber-200 bg-amber-50 px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-800">Señal encontrada</p>
                    <p className="mt-2 text-sm leading-6 text-amber-950">
                      {sanitizeHomeVisibleCopy(guestPreview.heliosOpinion.legalHighlights?.primaryConcern) ?? "Ya detectamos una señal principal útil para empezar a revisar este documento."}
                    </p>
                  </div>
                  <div className="mt-4 rounded-[1.1rem] border border-emerald-200 bg-emerald-50 px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-800">Siguiente paso sugerido</p>
                    <p className="mt-2 text-sm leading-6 text-emerald-950">
                      {sanitizeHomeVisibleCopy(guestPreview.heliosOpinion.resultCard?.nextStepSummary) ?? sanitizeHomeVisibleCopy(guestPreview.heliosOpinion.recommendedNextStep) ?? "Ya tienes un siguiente paso útil para continuar con más contexto."}
                    </p>
                  </div>
                </div>

                <div className="rounded-[1.35rem] border border-slate-200 bg-slate-50/80 p-4 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Cómo guardarlo si te sirve</p>
                  <div className="mt-3 space-y-3 text-sm leading-6 text-slate-700">
                    <p>
                      {sanitizeHomeVisibleCopy(guestPreview.preview.scanAssistance?.friendlyHeadline) ?? "Tu archivo ya quedó listo para esta primera lectura privada."}
                    </p>
                    <p>
                        {sanitizeHomeVisibleCopy(guestPreview.preview.scanAssistance?.userGuidance) ?? "Si quieres conservar esta lectura, el siguiente paso es guardarla en tu expediente privado con acceso por correo."}

                    </p>
                  </div>
                  <div className="mt-5 flex flex-col gap-3">
                    {auth.isAuthenticated ? (
                      <Button className="h-11 rounded-full bg-slate-950 text-white hover:bg-slate-900" onClick={() => void persistGuestPreview("manual")} disabled={isSavingPreview}>
                        {isSavingPreview ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Guardar ahora en mi expediente
                      </Button>
                    ) : (
                      <Button className="h-11 rounded-full bg-slate-950 text-white hover:bg-slate-900" onClick={handleLoginToSave}>
                        Guardar en mi expediente por correo
                      </Button>
                    )}
                    <p className="text-xs leading-5 text-slate-500">
                      Primero ves la lectura. El correo solo se usa cuando decides guardar el hallazgo y seguir dentro de tu expediente.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {(publicExamples.length ? publicExamples : [
                  {
                    id: "fallback-payroll",
                    badge: "Ejemplo de primera lectura · recibo de nómina",
                    documentLabel: "Recibo de nómina",
                    title: "Un recibo ya puede revelar una señal clara de pago o deducción.",
                    summary: "Con un solo documento puedes obtener una lectura breve y útil para empezar.",
                    nextStep: "Después te sugerimos qué archivo complementa mejor tu bóveda laboral.",
                    primaryConcern: "Señal inicial lista para revisarse con palabras simples.",
                  },
                ]).slice(0, 3).map((example) => (
                  <article key={example.id} className="rounded-[1.2rem] border border-slate-200 bg-white px-4 py-4 shadow-sm">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-700">{example.badge}</p>
                    <p className="mt-3 text-sm font-semibold leading-6 text-slate-950">{example.title}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{example.summary}</p>
                    <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Siguiente paso</p>
                    <p className="mt-1 text-sm leading-6 text-slate-700">{example.nextStep}</p>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <CeoPanelDrawer
            open={ceoActionsDrawerOpen}
            onOpenChange={setPersistedCeoPanelOpen}
            baseLabel="la home privada"
          />
          <article className="rounded-[1.7rem] border border-slate-200 bg-[linear-gradient(180deg,_#f9fcfb_0%,_#edf7f5_100%)] p-5 shadow-[0_24px_60px_-42px_rgba(15,23,42,0.22)] sm:p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Ejemplo de lectura</p>
            <h3 className="mt-3 text-[1.5rem] font-semibold leading-8 tracking-[-0.04em] text-slate-950">
              {featuredExample?.title ?? "Así se ve una primera lectura real antes de guardar nada."}
            </h3>
            <p className="mt-3 text-sm leading-6 text-slate-700">
              {featuredExample?.summary ?? "Aquí verás el tipo de resumen, señal principal y siguiente paso que suele aparecer desde el primer documento."}
            </p>
            <div className="mt-4 rounded-[1.2rem] border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-800">Señal visible de ejemplo</p>
              <p className="mt-2 text-sm leading-6 text-amber-950">
                {featuredExample?.primaryConcern ?? "La lectura vuelve visible una preocupación principal antes de pedir más contexto."}
              </p>
            </div>
            <div className="mt-4 rounded-[1.2rem] border border-emerald-200 bg-emerald-50 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-800">Qué te sugeriría hacer después</p>
              <p className="mt-2 text-sm leading-6 text-emerald-950">
                {featuredExample?.nextStep ?? "La lectura te sugiere el siguiente documento útil para fortalecer tu bóveda laboral."}
              </p>
            </div>
          </article>

          <div className="grid gap-3 sm:grid-cols-2">
            <article className="rounded-[1.35rem] border border-slate-200 bg-white px-4 py-4 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Si ya entraste</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-950">
                {latestCase?.stageLabel ? `Tu bóveda va en ${latestCase.stageLabel}.` : "Si ya entraste antes, podemos retomar tu lectura y guardarla dentro de tu bóveda."}
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {latestCase?.summary ?? "Si vuelves desde correo, retomamos la lectura temporal y la guardamos dentro de tu cuenta sin pedirte volver a subir el archivo."}
              </p>
            </article>
            <article className="rounded-[1.35rem] border border-slate-200 bg-white px-4 py-4 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Por qué este flujo existe</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-950">
                Primero recibes valor y después decides si quieres conservarlo en tu bóveda laboral.
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                La Home deja ver una primera lectura clara. El acceso por correo entra sólo cuando quieres guardar, proteger y continuar con más contexto.
              </p>
            </article>
          </div>
        </div>
      </div>
    </section>
  );
}

function QuickTrustSection() {
  const controlMoments = [
    {
      label: "Antes de guardar",
      detail: "Ves una lectura preliminar sin integrar nada a tu expediente.",
      title: "Borrador preliminar activo",
      badge: "Sin guardado",
      visibleForYou: "Documento recibido, señal preliminar y siguiente paso sugerido.",
      hiddenFromCompany: "Tus archivos y esta lectura no se comparten con tu empresa.",
      trace: "Todavía no se integra nada a tu expediente.",
      next: "Tú decides si borrar, salir o resguardar.",
    },
    {
      label: "Si aceptas",
      detail: "Queda rastro visible de versión, fecha y navegador.",
      title: "Aceptación registrada",
      badge: "Versión visible",
      visibleForYou: "Versión del aviso, fecha de aceptación y navegador.",
      hiddenFromCompany: "El contenido del archivo sigue fuera del alcance de tu empresa.",
      trace: "Rastro legal versionado para tu resguardo.",
      next: "Puedes continuar y decidir después si resguardar.",
    },
    {
      label: "Si resguardas",
      detail: "La interfaz te confirma que el archivo quedó listo para seguimiento.",
      title: "Archivo listo para seguimiento",
      badge: "Resguardado",
      visibleForYou: "Confirmación de resguardo, estado del archivo y acceso posterior.",
      hiddenFromCompany: "Tu documento sigue privado y solo accesible dentro de tu expediente.",
      trace: "El sistema deja constancia visible de que quedó listo para seguimiento.",
      next: "Puedes exportar, seguir reuniendo evidencia o volver luego.",
    },
  ] as const;
  const [activeControlMoment, setActiveControlMoment] = useState(0);
  const selectedControlMoment = controlMoments[activeControlMoment] ?? controlMoments[0];

  return (
    <section id="privacidad" className="bg-muted/35 py-8 sm:py-10">
      <div className="container mx-auto max-w-6xl">
        <div className="grid gap-4 rounded-[1.7rem] border border-teal-100 bg-white/96 p-4 shadow-[0_24px_60px_-46px_rgba(15,23,42,0.28)] sm:p-5 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-teal-100 bg-teal-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-800">
              <Lock className="h-4 w-4" strokeWidth={1.8} />
              Privacidad visible y verificable
            </div>
            <h2 className="mt-3 text-[1.8rem] font-semibold tracking-[-0.04em] text-slate-950 sm:text-[2.15rem]">
              Control visible desde el primer archivo.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-700 sm:text-base sm:leading-7">
              Tu empresa nunca ve lo que subes. Primero revisas la señal y luego decides si quieres guardarla. La primera lectura aparece sin cuenta y el control sigue visible durante todo el flujo.
            </p>
            <div className="mt-4 rounded-[1.2rem] border border-slate-200 bg-slate-50/90 p-4 text-sm text-slate-700 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Transparencia visible</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <div className="rounded-[1rem] border border-white bg-white/95 px-3 py-3">
                  <p className="font-semibold text-slate-950">Nada se guarda solo</p>
                  <p className="mt-1.5 leading-6">Tu expediente solo cambia cuando tú confirmas.</p>
                </div>
                <div className="rounded-[1rem] border border-white bg-white/95 px-3 py-3">
                  <p className="font-semibold text-slate-950">Rastro legal versionado</p>
                  <p className="mt-1.5 leading-6">Si aceptas, queda versión, fecha y navegador visibles para tu resguardo.</p>
                </div>
                <div className="rounded-[1rem] border border-white bg-white/95 px-3 py-3">
                  <p className="font-semibold text-slate-950">Privacidad accionable</p>
                  <p className="mt-1.5 leading-6">Puedes revisar el aviso, escribir a privacidad@auditapatron.com y pedir control sobre tus datos.</p>
                </div>
              </div>
            </div>
            <div className="mt-3 rounded-[1.2rem] border border-teal-100 bg-teal-50/70 p-4 text-sm text-slate-700 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-800">Qué verás en tu primer uso</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <div className="rounded-[1rem] border border-white/80 bg-white/95 px-3 py-3">
                  <p className="font-semibold text-slate-950">Subes y revisas</p>
                  <p className="mt-1.5 leading-6">Primero ves una señal clara. Todavía no guardas nada.</p>
                </div>
                <div className="rounded-[1rem] border border-white/80 bg-white/95 px-3 py-3">
                  <p className="font-semibold text-slate-950">Si guardas, lo verás</p>
                  <p className="mt-1.5 leading-6">El sistema te confirma que el archivo ya entró a tu expediente privado.</p>
                </div>
                <div className="rounded-[1rem] border border-white/80 bg-white/95 px-3 py-3">
                  <p className="font-semibold text-slate-950">Si borras o sales, también</p>
                  <p className="mt-1.5 leading-6">Siempre sabes si quedó en borrador, si se eliminó o si debes volver a entrar con tu correo.</p>
                </div>
              </div>
              <div className="mt-3 rounded-[1rem] border border-white/80 bg-white/95 px-4 py-4 text-sm text-slate-700 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Registro visible de tu control</p>
                  <span className="rounded-full border border-teal-100 bg-teal-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-teal-800">
                    3 señales claras
                  </span>
                </div>
                <p className="mt-3 text-xs leading-5 text-slate-600 sm:text-sm">Toca una señal y mira qué quedaría visible para ti antes de abrir expediente.</p>
                <div className="mt-3 grid gap-2">
                  {controlMoments.map((item, index) => {
                    const isActive = index === activeControlMoment;
                    return (
                      <button
                        key={item.label}
                        type="button"
                        aria-pressed={isActive}
                        onClick={() => setActiveControlMoment(index)}
                        className={`flex items-start gap-3 rounded-[0.9rem] border px-3 py-3 text-left transition-all ${
                          isActive
                            ? "border-teal-300 bg-teal-50 shadow-sm"
                            : "border-slate-200 bg-slate-50 hover:border-teal-200 hover:bg-white"
                        }`}
                      >
                        <div className={`mt-0.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${
                          isActive
                            ? "border border-teal-300 bg-white text-teal-900"
                            : "border border-teal-200 bg-white text-teal-800"
                        }`}>
                          {item.label}
                        </div>
                        <p className="min-w-0 leading-6 text-slate-700">{item.detail}</p>
                      </button>
                    );
                  })}
                </div>
                <div className="mt-3 rounded-[1rem] border border-slate-200 bg-slate-950/[0.03] px-4 py-4 text-sm text-slate-700 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Prueba tu control aquí</p>
                      <p className="mt-1 text-base font-semibold text-slate-950">{selectedControlMoment.title}</p>
                    </div>
                    <span className="rounded-full border border-teal-200 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-teal-900">
                      {selectedControlMoment.badge}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <div className="rounded-[0.9rem] border border-white bg-white px-3 py-3 shadow-sm">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Qué queda visible para ti</p>
                      <p className="mt-1.5 leading-6 text-slate-700">{selectedControlMoment.visibleForYou}</p>
                    </div>
                    <div className="rounded-[0.9rem] border border-white bg-white px-3 py-3 shadow-sm">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Qué no ve tu empresa</p>
                      <p className="mt-1.5 leading-6 text-slate-700">{selectedControlMoment.hiddenFromCompany}</p>
                    </div>
                    <div className="rounded-[0.9rem] border border-white bg-white px-3 py-3 shadow-sm">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Rastro verificable</p>
                      <p className="mt-1.5 leading-6 text-slate-700">{selectedControlMoment.trace}</p>
                    </div>
                    <div className="rounded-[0.9rem] border border-white bg-white px-3 py-3 shadow-sm">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Siguiente estado</p>
                      <p className="mt-1.5 leading-6 text-slate-700">{selectedControlMoment.next}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Button className="rounded-full bg-slate-950 px-6 text-white hover:bg-slate-900" onClick={goToAuditFlow}>
                {PRIMARY_CTA_LABEL}
                <ArrowRight className="ml-2 h-4 w-4" strokeWidth={1.8} />
              </Button>
              <Button
                variant="outline"
                className="rounded-full border-slate-200 bg-white px-6 text-slate-700 hover:bg-slate-50"
                onClick={() => {
                  window.location.href = "/legal/privacidad";
                }}
              >
                Ver controles de privacidad
              </Button>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              {
                eyebrow: "Lectura primero",
                title: "Solo tú decides qué guardar",
                body: "Primero ves la lectura útil. Solo después decides si ese archivo entra a tu expediente privado.",
              },
              {
                eyebrow: "Privacidad real",
                title: "Tu empresa nunca recibe tus archivos",
                body: "Lo que subes aquí no se comparte con tu empresa y el aviso completo sigue visible cuando lo necesites.",
              },
              {
                eyebrow: "Rastro útil",
                title: "Aceptación legal con versión visible",
                body: "Cuando corresponda aceptar documentos legales, ves con qué aviso operaste y cuándo lo hiciste.",
              },
            ].map((item) => (
              <article
                key={item.title}
                className="rounded-[1.2rem] border border-slate-200 bg-slate-50/90 px-4 py-3 text-sm text-slate-700 shadow-sm"
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{item.eyebrow}</p>
                <p className="mt-2 font-semibold text-slate-950">{item.title}</p>
                <p className="mt-1.5 leading-6">{item.body}</p>
              </article>
            ))}
          </div>
          <div className="rounded-[1.2rem] border border-slate-200 bg-slate-50/90 px-4 py-3 text-sm text-slate-700 shadow-sm lg:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Respuestas rápidas</p>
              <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600">
                Antes de abrir expediente
              </span>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {[
                "No necesitas cuenta para ver la primera lectura.",
                "Tu empresa no ve ni recibe lo que subes aquí.",
                "Si sí te sirve, luego lo guardas en tu expediente privado.",
              ].map((item) => (
                <div key={item} className="rounded-[1rem] border border-white bg-white px-3 py-3 shadow-sm">
                  <p className="leading-6 text-slate-700">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ConfidenceMagicSection() {
  return (
    <section id="boveda" className="bg-[#edf7f6] py-12 sm:bg-[#f7fbfb] sm:py-14">
      <div className="container mx-auto max-w-6xl">
        <div className="rounded-[2rem] border border-slate-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f1f7f7_100%)] p-6 shadow-[0_28px_80px_-60px_rgba(15,23,42,0.45)] sm:p-8">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-teal-700">
              Guarda y sigue después
            </p>
            <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-4xl">
              Primero revisa un documento. Si te sirve, luego lo guardas en tu expediente.
            </h2>
            <p className="mt-4 text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
              AuditaPatron no te obliga a reunir todo desde el inicio. Puedes empezar con un recibo, un CFDI o un contrato, ver una lectura útil y después decidir qué más conservar dentro de tu expediente laboral.
            </p>
            <p className="mt-3 text-sm leading-6 text-slate-500 sm:text-base sm:leading-7">
              Así el primer paso sigue siendo simple y el orden llega después, solo si de verdad te aporta valor.
            </p>
          </div>

          <div className="mt-7 grid gap-3 lg:grid-cols-2">
            {[
              {
                title: "Todo en un solo lugar",
                description:
                  "Tus recibos, contratos y CFDI dejan de vivir separados y empiezan a formar un archivo laboral fácil de consultar.",
                detail: "Tú decides qué conservar para volver a verlo rápido cuando necesites respaldo, reclamar o retomar tu caso.",
                icon: Upload,
              },
              {
                title: "Contexto entre documentos",
                description:
                  "AuditaPatron entiende qué tipo de documento subiste y cómo se relaciona con los demás.",
                detail: "Así puede decirte qué coincide, qué falta y qué conviene contrastar antes de firmar o reclamar algo.",
                icon: FileSearch,
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <article
                  key={item.title}
                  className="rounded-[1.4rem] border border-slate-200 bg-white p-4 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.28)]"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
                    <Icon className="h-5 w-5" strokeWidth={1.8} />
                  </div>
                  <h3 className="mt-3 text-lg font-semibold tracking-[-0.03em] text-slate-950">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-700">{item.detail}</p>
                </article>
              );
            })}
          </div>

          <div className="mt-5 grid gap-3 rounded-[1.35rem] border border-teal-100 bg-teal-50/85 p-4 sm:grid-cols-[1fr_auto] sm:items-center sm:p-5">
            <div className="text-sm leading-6 text-teal-950">
              <p className="font-semibold">Tu primer hallazgo puede quedarse guardado para retomarlo cuando quieras.</p>
              <p className="mt-1">Empiezas con un solo documento, ves si vale la pena y después decides si lo guardas para seguir reuniendo evidencia con más calma.</p>
            </div>
            <div className="flex flex-col gap-2 sm:items-end">
              <Button
                className="rounded-full bg-slate-950 px-6 text-white hover:bg-slate-900"
                onClick={() => goToAuditFlow({ placement: "vault_section_primary" })}
              >
                {PRIMARY_CTA_LABEL}
                <ArrowRight className="ml-2 h-4 w-4" strokeWidth={1.8} />
              </Button>
              <p className="text-xs leading-5 text-teal-900/80">
                Cuando quieras continuar o recuperar tu avance, entras con tu correo.
              </p>
            </div>
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
            Asesor laboral de AuditaPatron
          </p>
          <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-4xl">
            Una capa extra para hacer preguntas rápidas sobre tu expediente.
          </h2>
          <p className="mt-4 text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
            Cuando ya tienes documentos visibles dentro de AuditaPatron, tu asesor laboral puede ayudarte a resumir riesgos, explicar qué todavía falta confirmar y sugerir el siguiente paso útil con base en lo que AuditaPatron ya analizó y resguardó dentro del expediente.
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
            El asesor laboral es una guía contextual basada en tu expediente visible. No sustituye a un abogado ni constituye una opinión legal vinculante.
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
    <section id="como-funciona" className="bg-background py-12 sm:py-14">
      <div className="container">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-teal-700">
            Cómo funciona en 3 pasos
          </p>
          <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-4xl">
            Así pasas de duda a claridad sin enredos.
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-600 sm:text-base sm:leading-7">
            Subes un archivo, entiendes la señal y decides si quieres convertirla en evidencia útil.
          </p>
        </div>

        <div className="mt-8 grid gap-3 md:grid-cols-3">
          {[
            {
              number: "01",
              title: "Sube tu recibo o contrato",
              description: "Empieza con un solo archivo, sin preparar todo el expediente.",
            },
            {
              number: "02",
              title: "Recibe una señal clara",
              description: "Te decimos qué encontramos y qué revisar primero.",
            },
            {
              number: "03",
              title: "Guárdalo solo si te sirve",
              description: "Si te aporta valor, lo pasas a tu expediente privado.",
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
            Si quieres darle más valor a tu bóveda laboral, empieza por los archivos con más contexto.
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

function MobilePriorityPathSection() {
  const [selectedMobilePriorityPath, setSelectedMobilePriorityPath] = useState<string | undefined>("ruta-movil-como-funciona");
  const mobilePriorityPathItems = [
    {
      id: "ruta-movil-como-funciona",
      eyebrow: "Qué pasa cuando empiezas",
      title: "Sube un documento y entiende el proceso sin enredos",
      description:
        "La experiencia móvil ahora prioriza una sola idea: empezar rápido, recibir una lectura útil y saber qué hacer después sin perderte entre bloques secundarios.",
      bullets: [
        "AuditaPatron recibe tu archivo y te devuelve lo importante primero.",
        "El siguiente documento útil aparece con lenguaje simple.",
        "La guía completa sigue disponible cuando quieras profundizar.",
      ],
      secondaryLabel: "Abrir guía rápida",
      secondaryHref: "#preguntas",
    },
    {
      id: "ruta-movil-expediente",
      eyebrow: "Qué gana tu expediente",
      title: "Cada documento suma contexto y respaldo real",
      description:
        "En móvil resumimos el valor del expediente para que no compita con tu decisión principal. Primero entiendes el beneficio; después, si quieres, exploras el detalle completo en una pantalla más amplia.",
      bullets: [
        "Tus recibos, CFDI y soportes dejan de quedar sueltos.",
        "La comparación entre piezas gana claridad con cada archivo.",
        "El expediente conserva trazabilidad y acceso cuando lo necesites.",
      ],
      secondaryLabel: "Ver preguntas frecuentes",
      secondaryHref: "#preguntas",
    },
    {
      id: "privacidad",
      eyebrow: "Privacidad visible",
      title: "Tus documentos se resguardan para darte claridad, calma y control",
      description:
        "Tu empresa no ve lo que subes. La información legal y de privacidad sigue estando a la mano, pero en móvil aparece de forma progresiva para no saturarte antes de iniciar tu revisión.",
      bullets: [
        "Puedes volver a tu expediente cuando lo necesites.",
        "Las explicaciones priorizan tranquilidad y control.",
        "Tus derechos y documentos legales siguen accesibles desde la navegación principal.",
      ],
      secondaryLabel: "Leer preguntas frecuentes",
      secondaryHref: "#preguntas",
    },
  ] as const;

  return (
    <section className="bg-[#f2f7f6] py-10 sm:hidden">
      <div className="container">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-[0_28px_80px_-60px_rgba(15,23,42,0.3)]">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-teal-700">Ruta móvil priorizada</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-slate-950">
              Primero decides si quieres empezar; lo demás aparece cuando te sirve.
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              En móvil priorizamos entender, confiar y comenzar sin recorrer tantos bloques seguidos.
            </p>
          </div>

          <Accordion
            type="single"
            collapsible
            value={selectedMobilePriorityPath}
            onValueChange={setSelectedMobilePriorityPath}
            className="mt-5 space-y-3"
          >
            {mobilePriorityPathItems.map((item) => (
              <AccordionItem
                key={item.id}
                value={item.id}
                id={item.id}
                className="overflow-hidden rounded-[1.4rem] border border-slate-200 bg-slate-50 px-4"
              >
                <AccordionTrigger className="py-4 text-left hover:no-underline">
                  <div className="pr-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-700">{item.eyebrow}</p>
                    <p className="mt-2 text-base font-semibold text-slate-950">{item.title}</p>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-4">
                  <p className="text-sm leading-7 text-slate-600">{item.description}</p>
                  <div className="mt-4 space-y-2">
                    {item.bullets.map((bullet) => (
                      <div key={bullet} className="flex gap-3 rounded-[1.1rem] bg-white p-3 text-sm leading-6 text-slate-700">
                        <CheckCircle2 className="mt-0.5 h-4.5 w-4.5 shrink-0 text-teal-700" strokeWidth={1.8} />
                        <span>{bullet}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex flex-col gap-3">
                    <Button className="h-11 rounded-full bg-slate-950 text-white hover:bg-slate-900" onClick={() => goToAuditFlow({ source: `home_mobile_priority_${item.id}` })}>
                      {PRIMARY_CTA_LABEL}
                    </Button>
                    <a href={item.secondaryHref} className="text-sm font-semibold text-teal-800 underline underline-offset-4">
                      {item.secondaryLabel}
                    </a>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
}

function FAQSection() {
  const [selectedFaq, setSelectedFaq] = useState<string | undefined>("para-mi");
  const activeRecommendation = prediagnosticRecommendations[selectedFaq ?? "para-mi"] ?? prediagnosticRecommendations["para-mi"];

  return (
    <section id="preguntas" className="bg-[#f7fafb] py-12 sm:py-14">
      <div className="container max-w-5xl grid gap-5 lg:grid-cols-[0.88fr_1fr]">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-teal-700">
            Guía rápida para empezar
          </p>
          <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-slate-950 max-[359px]:text-[1.7rem] sm:text-4xl">
            Empieza por la duda más común en tu chamba.
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-600 sm:text-base sm:leading-7">
            Elige el caso que más se parezca al tuyo y te sugerimos el documento más fácil para arrancar sin enredarte.
          </p>

          <div className="mt-5 rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-[0_18px_48px_-42px_rgba(15,23,42,0.3)]">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Casos cotidianos para empezar
            </p>
            <div className="mt-3 space-y-2.5">
              {guidedFaqOptions.map((option) => {
                const isActive = selectedFaq === option.id;

                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setSelectedFaq(option.id)}
                    className={`w-full rounded-[1.05rem] border px-4 py-3 text-left transition max-[359px]:px-3.5 ${
                      isActive
                        ? "border-teal-300 bg-teal-50 shadow-[0_16px_34px_-30px_rgba(13,148,136,0.34)]"
                        : "border-slate-200 bg-slate-50 hover:border-teal-200 hover:bg-white"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold leading-6 text-slate-950 max-[359px]:text-[0.97rem]">{option.label}</p>
                        <p className="mt-1 text-sm leading-6 text-slate-600 max-[359px]:text-[0.95rem]">{option.description}</p>
                      </div>
                      <ChevronRight className={`mt-0.5 h-4 w-4 shrink-0 ${isActive ? "text-teal-600" : "text-slate-400"}`} />
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-3 rounded-[1.2rem] border border-teal-100 bg-teal-50/75 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-700">{activeRecommendation.badge}</p>
              <p className="mt-2 text-base font-semibold leading-7 text-slate-950 max-[359px]:text-[0.98rem] max-[359px]:leading-6">{activeRecommendation.document}</p>
              <p className="mt-2 text-sm leading-6 text-slate-700">{activeRecommendation.reason}</p>
              <p className="mt-2 text-sm leading-6 text-teal-900">{activeRecommendation.nextStep}</p>
            </div>
          </div>
        </div>

        <div className="rounded-[1.7rem] border border-slate-200 bg-slate-50 p-4 max-[359px]:p-3.5 sm:p-5">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Preguntas frecuentes clave
          </p>
          <Accordion type="single" collapsible value={selectedFaq} onValueChange={setSelectedFaq} className="space-y-2.5">
            {faqs.slice(0, 4).map((item) => (
              <AccordionItem
                key={item.id}
                value={item.id}
                className="rounded-[1.15rem] border border-slate-200 bg-white px-4"
              >
                <AccordionTrigger className="text-left text-sm font-semibold leading-6 text-slate-950 hover:no-underline max-[359px]:text-[0.97rem] sm:text-base">
                  {item.question}
                </AccordionTrigger>
                <AccordionContent className="pb-4 text-sm leading-6 text-slate-600">
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

function AppDownloadSection() {
  const webBenefits = [
    "Empieza hoy mismo desde esta web con un solo recibo o documento.",
    "Cuando la app exista, tu avance podrá seguir contigo sin volver a empezar.",
  ] as const;

  return (
    <section id="app" className="bg-[#eef6f5] py-12 sm:py-14">
      <div className="container mx-auto max-w-6xl">
        <div className="grid gap-5 rounded-[2rem] border border-teal-100 bg-white/96 p-6 shadow-[0_28px_70px_-52px_rgba(15,23,42,0.32)] sm:p-8 lg:grid-cols-[1.02fr_0.98fr] lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-teal-100 bg-teal-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-800">
              <ShieldCheck className="h-4 w-4" strokeWidth={1.8} />
              App móvil en camino
            </div>
            <h2 className="mt-3 text-[1.9rem] font-semibold tracking-[-0.04em] text-slate-950 sm:text-[2.3rem]">
              Empieza hoy aquí. La app viene después.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-700 sm:text-base sm:leading-7">
              La vía más rápida hoy es esta web. Cuando exista la descarga oficial, la verás aquí sin confusiones.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {webBenefits.map((item, index) => (
                <article
                  key={item}
                  className="rounded-[1.15rem] border border-slate-200 bg-slate-50/90 px-4 py-3 text-sm leading-6 text-slate-700 shadow-sm"
                >
                  <div className="inline-flex rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 shadow-sm">
                    0{index + 1}
                  </div>
                  <p className="mt-2">{item}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="rounded-[1.7rem] border border-slate-200 bg-[linear-gradient(180deg,_#f8fafc_0%,_#ffffff_100%)] p-5 shadow-[0_22px_50px_-40px_rgba(15,23,42,0.26)] sm:p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">
              App móvil
            </p>
            <h3 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950">
              Descarga oficial más adelante
            </h3>
            <p className="mt-3 text-sm leading-6 text-slate-700 sm:text-base sm:leading-7">
              Este espacio se activará cuando exista la publicación real. Por ahora, empieza tu auditoría aquí mismo.
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[1.2rem] border border-slate-200 bg-white px-4 py-4 text-sm text-slate-700 shadow-sm">
                <p className="font-semibold text-slate-950">App Store</p>
                <p className="mt-2 leading-6">Se activará cuando exista la publicación oficial en iPhone.</p>
                <div className="mt-4 inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-500">
                  Próximamente
                </div>
              </div>
              <div className="rounded-[1.2rem] border border-slate-200 bg-white px-4 py-4 text-sm text-slate-700 shadow-sm">
                <p className="font-semibold text-slate-950">Google Play</p>
                <p className="mt-2 leading-6">Se activará cuando exista la publicación oficial en Android.</p>
                <div className="mt-4 inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-500">
                  Próximamente
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <Button
                className="h-12 w-full rounded-full bg-teal-600 px-6 text-white hover:bg-teal-700 sm:w-auto"
                onClick={() => goToAuditFlow({ placement: "app_download_section_primary" })}
              >
                Empezar aquí gratis
                <ArrowRight className="ml-2 h-4 w-4" strokeWidth={1.8} />
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-12 w-full rounded-full border-slate-200 bg-white px-6 text-slate-700 hover:bg-slate-50 sm:w-auto"
                onClick={() => scrollToId("como-funciona")}
              >
                Ver cómo funciona
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function FinalCtaSection() {
  const pricingExperience = getAuditapatronPricingExperience(0);

  return (
    <section className="bg-muted/35 py-12 sm:py-14">
      <div className="container">
        <div className="overflow-hidden rounded-[2.2rem] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(45,212,191,0.18),_transparent_32%),linear-gradient(135deg,_#ffffff,_#eef6f5)] px-6 py-10 shadow-[0_36px_90px_-64px_rgba(15,23,42,0.38)] max-[359px]:px-4 max-[359px]:py-7 sm:px-10 sm:py-12">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-teal-700">
              {pricingExperience.landing.eyebrow}
            </p>
            <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-slate-950 max-[359px]:text-[1.8rem] sm:text-5xl">
              {pricingExperience.landing.title}
            </h2>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
              {pricingExperience.landing.description}
            </p>

            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <Button
                className="h-12 w-full rounded-full bg-teal-600 px-6 text-white hover:bg-teal-700 sm:w-auto"
                onClick={() => goToAuditFlow({ placement: "final_block_cta" })}
              >
                {PRIMARY_CTA_LABEL}
                <ArrowRight className="ml-2 h-4 w-4" strokeWidth={1.8} />
              </Button>
              <Button
                variant="outline"
                className="motion-hover-lift h-12 w-full rounded-full border-slate-200 bg-white px-7 text-base text-slate-700 hover:bg-slate-50 sm:w-auto"
                onClick={() => scrollToId("privacidad")}
              >
                Ver cómo cuidamos tu información
              </Button>
            </div>

            <div className="mt-6 grid gap-3 lg:grid-cols-2">
              {pricingExperience.landing.principles.slice(0, 2).map((principle, index) => (
                <article
                  key={principle}
                  className="rounded-[1.25rem] border border-white/80 bg-white/90 p-4 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.32)]"
                >
                  <div className="inline-flex rounded-full bg-teal-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-700">
                    0{index + 1}
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-700">{principle}</p>
                </article>
              ))}
            </div>

            <p className="mt-6 max-w-2xl text-sm leading-6 text-slate-600">
              Si más adelante quieres avanzar, esa opción estará disponible dentro de tu expediente.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function SiteFooter() {
  return (
    <footer className="bg-background py-8">
      <div className="container flex flex-col gap-6 border-t border-slate-200 pt-8 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-3">
          <AuditaPatronLogoWordmark
            className="inline-flex min-w-0 items-center"
            imageClassName="max-w-[220px] sm:max-w-[250px]"
            subtitleClassName="text-[0.75rem] tracking-[0.14em]"
          />
          <p className="max-w-md text-sm leading-6 text-slate-500">
            Recupera claridad, orden y respaldo con un expediente digital simple, privado y útil para revisar tu situación laboral.
          </p>
        </div>
        <div className="flex flex-wrap gap-4">
                      <a href="#lectura-gratis" className="transition-colors hover:text-slate-900">
              Ver un ejemplo
            </a>

          <a href="#como-funciona" className="transition-colors hover:text-slate-900">
            Cómo funciona
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
    <main className="audita-home min-h-screen bg-background font-sans text-slate-950">
      <SiteHeader />
      <HeroSection />
      <HeliosFirstEntrySection />
      <HowItWorksSection />
      <AppDownloadSection />
      <QuickTrustSection />
      <FinalCtaSection />
      <SiteFooter />
    </main>
  );
}

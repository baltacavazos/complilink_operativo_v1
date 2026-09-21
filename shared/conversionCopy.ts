import {
  COMMERCE_PLANS,
  formatCommerceDocumentLimitBullet,
  formatCommercePriceMx,
} from "./commerce";

/** Anecdota concreta y anónima. Sin logos, nombres, razones sociales ni cifras inventadas. */
export const SOCIAL_PROOF_LINE =
  "Una persona subió su recibo porque no entendía el IMSS ni las retenciones: vio en palabras simples qué aparece y qué conviene revisar.";

export const GUARANTEE_LINE =
  "Te garantizamos claridad del análisis. No prometemos que ganes un juicio.";

export const BILLING_SOFT_NOTE = "Activaremos el cobro cuando esté listo.";
export const PLAN_PRIMARY_CTA = "Elegir plan y empezar";
export const PLAN_NAV_CTA = "Ver planes y activar";
export const PLANS_PATH = "/planes";
export const PRECIOS_PATH = "/precios";

export const FIRST_WIN_PROMISE =
  "Sube tu documento y en minutos ves el resultado y qué hacer.";

/** Home pública: mix emocional + callejero aprobado. Español, honesto, sin cifras inventadas. */
export const HOME_HERO_HEADLINE =
  "Que no te vean la cara: ¿tu patrón te paga bien y declara el salario que corresponde?";

export const HOME_HERO_SUBHEAD =
  "Sube tu recibo, CFDI o papeles del IMSS o Infonavit. En minutos y en español normal te explicamos qué dicen sobre tu pago, tus descuentos y tu salario registrado — y qué conviene aclarar.";

export const HOME_HERO_SECTION_TITLE = "Qué revisas con AuditaPatrón";

export const HOME_HERO_CHECKLIST = [
  "Tu salario ante el IMSS (si el documento lo muestra)",
  "Descuentos: cada peso que te quitan y bajo qué concepto",
  "Recibo vs lo que declara el CFDI (si subes ambos)",
  "Pagos, total y periodo de la quincena",
  "Infonavit / aportaciones, cuando aparezcan",
  "Datos faltantes o inconsistencias que conviene aclarar",
] as const;

export const HOME_HERO_PRIMARY_CTA = "Revisar mi recibo gratis";

export const HOME_HERO_CTA_MICROCOPY =
  "Primera lectura gratis, un solo archivo. Sin cuenta al principio. No entra a tu expediente hasta que tú lo guardes.";

export const HOME_HERO_HONESTY_LINE =
  "Explicamos lo que dicen tus documentos. No demuestra por sí sola un incumplimiento ni garantiza el cálculo completo.";

export const HOME_HERO_CLOSING_LINE =
  "Cuentas claras. Primero entiende. Luego decides si hablas con RH o pides aclaración.";

export const FIRST_WIN_STEPS = [
  {
    title: "Sube tu documento",
    detail: "Recibo, CFDI o PDF del IMSS. Un solo archivo basta para empezar.",
  },
  {
    title: "Mira el resultado",
    detail: "Qué se entiende en IMSS, recibo y retenciones, en palabras simples.",
  },
  {
    title: "Qué hacer",
    detail: "El siguiente paso útil. Luego decides si lo guardas o sigues.",
  },
] as const;

const PAID_PLAN_KEYS = ["essential", "pro"] as const;

export function getVisiblePaidPlans() {
  return COMMERCE_PLANS.filter((plan) =>
    PAID_PLAN_KEYS.includes(plan.key as (typeof PAID_PLAN_KEYS)[number]),
  ).map((plan) => ({
    key: plan.key,
    name: plan.name,
    badge: plan.badge,
    headline: plan.headline,
    priceLabel: `${formatCommercePriceMx(plan.monthlyPriceMx)} MXN al mes`,
    monthlyPriceMx: plan.monthlyPriceMx,
    ctaLabel: "Elegir plan",
    highlighted: plan.highlighted,
    includes: plan.featureBullets.map((bullet) =>
      /^Hasta \d+ documentos por expediente\.?$/i.test(bullet)
        ? formatCommerceDocumentLimitBullet(plan.limits.maxDocumentsPerCase)
        : bullet,
    ),
  }));
}

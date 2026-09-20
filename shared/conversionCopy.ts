import { COMMERCE_PLANS, formatCommercePriceMx } from "./commerce";

/**
 * Anecdote concreta y anónima, al estilo CompliLink (compras/REPSE).
 * Sin logos, nombres, razones sociales ni cifras inventadas.
 */
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
    includes: plan.featureBullets,
  }));
}

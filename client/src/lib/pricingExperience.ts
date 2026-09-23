import {
  COMMERCE_ONE_SHOTS,
  COMMERCE_PLANS,
  formatCommercePriceMx,
  formatFreePlanLandingPrinciple,
} from "@shared/commerce";
import { sanitizeClientVisibleCopy } from "./clientVisibleCopy";

function visiblePricingCopy(value: string) {
  return sanitizeClientVisibleCopy(value) ?? value;
}

export type AuditapatronPricingExperience = {
  landing: {
    showPrice: boolean;
    eyebrow: string;
    title: string;
    description: string;
    principles: string[];
  };
  platform: {
    showPrice: boolean;
    eyebrow: string;
    title: string;
    description: string;
    priceLabel: string;
    primaryCtaLabel: string;
    secondaryCtaLabel: string;
    reassurance: string;
    plans: Array<{
      key: (typeof COMMERCE_PLANS)[number]["key"];
      name: string;
      badge: string;
      headline: string;
      priceLabel: string;
      ctaLabel: string;
      description: string;
      highlighted: boolean;
      featureBullets: string[];
    }>;
    oneShots: Array<{
      key: (typeof COMMERCE_ONE_SHOTS)[number]["key"];
      name: string;
      badge: string;
      priceLabel: string;
      ctaLabel: string;
      description: string;
      deliveryLabel: string;
      featureBullets: string[];
    }>;
  };
};

export function getAuditapatronPricingExperience(documentCount: number): AuditapatronPricingExperience {
  const freePlan = COMMERCE_PLANS[0];
  const essentialPlan = COMMERCE_PLANS[1];
  const hasEnoughContext = documentCount >= freePlan.limits.maxDocumentsPerCase;

  return {
    landing: {
      showPrice: false,
      eyebrow: "Gratis para revisar tu recibo",
      title: "Empieza gratis tu auditoría laboral y paga solo cuando ya te genere valor.",
      description:
        "Entras sin tarjeta, revisas un recibo y después decides si te conviene activar más documentos o un entregable puntual.",
      principles: [
        "La primera lectura sigue siendo gratis.",
        formatFreePlanLandingPrinciple(freePlan.limits.maxDocumentsPerCase),
        "Más documentos aparecen solo cuando ya viste para qué te sirven.",
      ],
    },
    platform: {
      showPrice: true,
      eyebrow: hasEnoughContext
        ? "Ya llegaste al punto donde conviene ordenar más contexto"
        : "Sigue gratis y activa un plan solo si ya te hace sentido",
      title: "Planes claros para seguir gratis o desbloquear más profundidad",
      description: hasEnoughContext
        ? visiblePricingCopy(
            `Tu expediente ya alcanzó el tramo gratuito. Si necesitas más documentos, lectura de varios archivos o más continuidad, aquí puedes activarlo sin salir del expediente.`,
          )
        : "Puedes seguir usando la parte gratuita. Cuando quieras más contexto, comparativas o productos listos para compartir, aquí mismo lo activas.",
      priceLabel: `${formatCommercePriceMx(essentialPlan.monthlyPriceMx)}/mes desde`,
      primaryCtaLabel: "Ver planes y activar",
      secondaryCtaLabel: "Seguir gratis por ahora",
      reassurance:
        "La primera lectura es gratis. Solo pagas si quieres más documentos o un entregable extra.",
      plans: COMMERCE_PLANS.map((plan) => ({
        key: plan.key,
        name: plan.name,
        badge: plan.badge,
        headline: plan.headline,
        priceLabel:
          plan.monthlyPriceMx <= 0
            ? "Gratis"
            : `${formatCommercePriceMx(plan.monthlyPriceMx)}/mes`,
        ctaLabel: plan.ctaLabel,
        description: visiblePricingCopy(plan.description),
        highlighted: plan.highlighted,
        featureBullets: plan.featureBullets.map(visiblePricingCopy),
      })),
      oneShots: COMMERCE_ONE_SHOTS.map((item) => ({
        key: item.key,
        name: item.name,
        badge: item.badge,
        priceLabel: formatCommercePriceMx(item.priceMx),
        ctaLabel: item.ctaLabel,
        description: visiblePricingCopy(item.description),
        deliveryLabel: item.deliveryLabel,
        featureBullets: item.featureBullets.map(visiblePricingCopy),
      })),
    },
  };
}

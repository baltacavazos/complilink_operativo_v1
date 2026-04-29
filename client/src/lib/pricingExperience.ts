import {
  COMMERCE_ONE_SHOTS,
  COMMERCE_PLANS,
  formatCommercePriceMx,
} from "@shared/commerce";

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
      eyebrow: "Freemium laboral pensado para México",
      title: "Empieza gratis tu auditoría laboral y paga solo cuando ya te genere valor.",
      description:
        "AuditaPatron te deja entrar sin tarjeta, revisar tu primer contexto y decidir después si te conviene activar más profundidad o un entregable puntual.",
      principles: [
        "La primera lectura sigue siendo gratis.",
        `El expediente básico incluye hasta ${freePlan.limits.maxDocumentsPerCase} documentos por caso.`,
        "Los upgrades aparecen solo cuando el usuario ya entendió para qué le sirven.",
      ],
    },
    platform: {
      showPrice: true,
      eyebrow: hasEnoughContext
        ? "Ya llegaste al punto donde conviene ordenar más contexto"
        : "Sigue gratis y activa un plan solo si ya te hace sentido",
      title: "Planes claros para seguir gratis o desbloquear más profundidad",
      description: hasEnoughContext
        ? `Tu expediente ya alcanzó el tramo gratuito. Si necesitas más documentos, Helios multi-documento o más continuidad, aquí puedes activarlo sin salir del expediente.`
        : "Puedes seguir usando la parte gratuita. Cuando quieras más contexto, comparativas o productos listos para compartir, aquí mismo lo activas.",
      priceLabel: `${formatCommercePriceMx(essentialPlan.monthlyPriceMx)}/mes desde`,
      primaryCtaLabel: "Ver planes y activar",
      secondaryCtaLabel: "Seguir gratis por ahora",
      reassurance:
        "La parte gratuita sigue disponible. El cobro solo aparece cuando intentas usar funciones que requieren más contexto, más memoria o entregables premium.",
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
        description: plan.description,
        highlighted: plan.highlighted,
        featureBullets: plan.featureBullets,
      })),
      oneShots: COMMERCE_ONE_SHOTS.map((item) => ({
        key: item.key,
        name: item.name,
        badge: item.badge,
        priceLabel: formatCommercePriceMx(item.priceMx),
        ctaLabel: item.ctaLabel,
        description: item.description,
        deliveryLabel: item.deliveryLabel,
        featureBullets: item.featureBullets,
      })),
    },
  };
}

export type CommercePlanKey = "free" | "essential" | "pro";
export type CommerceOneShotKey = "informe_premium" | "expediente_abogado";
export type CommerceProductKey = CommercePlanKey | CommerceOneShotKey;

export type CommercePlanDefinition = {
  key: CommercePlanKey;
  name: string;
  headline: string;
  monthlyPriceMx: number;
  badge: string;
  ctaLabel: string;
  description: string;
  highlighted: boolean;
  limits: {
    maxDocumentsPerCase: number;
    heliosConversationMode: "single_document" | "multi_document" | "historical";
    includedRevalidations: boolean;
    includedProactiveAlerts: boolean;
  };
  featureBullets: string[];
};

export type CommerceOneShotDefinition = {
  key: CommerceOneShotKey;
  name: string;
  priceMx: number;
  badge: string;
  ctaLabel: string;
  description: string;
  deliveryLabel: string;
  featureBullets: string[];
};

export type CommerceEntitlements = {
  planKey: CommercePlanKey;
  planName: string;
  isPaidPlan: boolean;
  maxDocumentsPerCase: number;
  heliosConversationMode: "single_document" | "multi_document" | "historical";
  canUseHeliosBasic: boolean;
  canUseHeliosMultiDocument: boolean;
  canUseHeliosHistoricalMemory: boolean;
  canUseComparativeView: boolean;
  canUseExtendedContext: boolean;
  canUseRevalidations: boolean;
  canUseProactiveAlerts: boolean;
  canGeneratePremiumReport: boolean;
  canGenerateLawyerPacket: boolean;
};

export const COMMERCE_PLANS: CommercePlanDefinition[] = [
  {
    key: "free",
    name: "Audita Gratis",
    headline: "Para validar tu primer señal sin pagar.",
    monthlyPriceMx: 0,
    badge: "Freemium",
    ctaLabel: "Empezar gratis",
    description:
      "Incluye tu primera lectura, expediente básico de hasta 3 documentos y Helios básico sobre el contexto visible inicial.",
    highlighted: false,
    limits: {
      maxDocumentsPerCase: 3,
      heliosConversationMode: "single_document",
      includedRevalidations: false,
      includedProactiveAlerts: false,
    },
    featureBullets: [
      "Primera lectura gratis y sin tarjeta.",
      "Expediente básico de hasta 3 documentos por caso.",
      "Helios básico sobre un documento principal o contexto inicial.",
    ],
  },
  {
    key: "essential",
    name: "Audita Esencial",
    headline: "Para ordenar mejor tu expediente y comparar más contexto.",
    monthlyPriceMx: 79,
    badge: "Más vendido",
    ctaLabel: "Activar Esencial",
    description:
      "Desbloquea más documentos por expediente, comparativas más claras y continuidad útil de Helios para llevar mejor tu caso.",
    highlighted: true,
    limits: {
      maxDocumentsPerCase: 15,
      heliosConversationMode: "multi_document",
      includedRevalidations: false,
      includedProactiveAlerts: false,
    },
    featureBullets: [
      "Hasta 15 documentos por expediente.",
      "Helios multi-documento y memoria corta dentro del expediente.",
      "Comparativas visibles y continuidad conversacional extendida.",
    ],
  },
  {
    key: "pro",
    name: "Audita Pro",
    headline: "Para operar expedientes con seguimiento más profundo.",
    monthlyPriceMx: 199,
    badge: "Operación completa",
    ctaLabel: "Activar Pro",
    description:
      "Suma memoria histórica, revalidaciones, alertas proactivas y la capa más completa del copiloto laboral.",
    highlighted: false,
    limits: {
      maxDocumentsPerCase: 50,
      heliosConversationMode: "historical",
      includedRevalidations: true,
      includedProactiveAlerts: true,
    },
    featureBullets: [
      "Hasta 50 documentos por expediente.",
      "Helios con memoria histórica del expediente.",
      "Revalidaciones IMSS/Infonavit y alertas proactivas.",
    ],
  },
];

export const COMMERCE_ONE_SHOTS: CommerceOneShotDefinition[] = [
  {
    key: "informe_premium",
    name: "Informe Premium",
    priceMx: 299,
    badge: "Pago único",
    ctaLabel: "Comprar informe",
    description:
      "Entrega una síntesis más ejecutiva del expediente con hallazgos, puntos por confirmar y siguiente paso sugerido.",
    deliveryLabel: "Generación puntual dentro del expediente",
    featureBullets: [
      "Resumen ejecutivo del expediente.",
      "Hallazgos, huecos y siguiente paso sugerido.",
      "Útil para preparar orientación o conciliación.",
    ],
  },
  {
    key: "expediente_abogado",
    name: "Expediente para abogado",
    priceMx: 499,
    badge: "Pago único",
    ctaLabel: "Preparar expediente",
    description:
      "Ordena un paquete de contexto para compartir con una abogada o abogado sin empezar desde cero.",
    deliveryLabel: "Preparación puntual para compartir",
    featureBullets: [
      "Cronología base del expediente.",
      "Documentos confirmados y huecos detectados.",
      "Lista de preguntas útiles para orientación legal.",
    ],
  },
];

const PLAN_ORDER: CommercePlanKey[] = ["free", "essential", "pro"];

export function getCommercePlanDefinition(planKey: CommercePlanKey): CommercePlanDefinition {
  return COMMERCE_PLANS.find((plan) => plan.key === planKey) ?? COMMERCE_PLANS[0];
}

export function getCommerceOneShotDefinition(productKey: CommerceOneShotKey): CommerceOneShotDefinition {
  return COMMERCE_ONE_SHOTS.find((item) => item.key === productKey) ?? COMMERCE_ONE_SHOTS[0];
}

export function isCommercePlanKey(value: string): value is CommercePlanKey {
  return PLAN_ORDER.includes(value as CommercePlanKey);
}

export function isCommerceOneShotKey(value: string): value is CommerceOneShotKey {
  return COMMERCE_ONE_SHOTS.some((item) => item.key === value);
}

export function compareCommercePlans(left: CommercePlanKey, right: CommercePlanKey) {
  return PLAN_ORDER.indexOf(left) - PLAN_ORDER.indexOf(right);
}

export function resolveHighestCommercePlan(candidates: CommercePlanKey[]): CommercePlanKey {
  return candidates.reduce<CommercePlanKey>((currentBest, candidate) => {
    return compareCommercePlans(candidate, currentBest) > 0 ? candidate : currentBest;
  }, "free");
}

export function buildCommerceEntitlements(params: {
  planKey: CommercePlanKey;
  purchasedOneShots?: CommerceOneShotKey[];
}): CommerceEntitlements {
  const plan = getCommercePlanDefinition(params.planKey);
  const purchasedSet = new Set(params.purchasedOneShots ?? []);

  return {
    planKey: plan.key,
    planName: plan.name,
    isPaidPlan: plan.key !== "free",
    maxDocumentsPerCase: plan.limits.maxDocumentsPerCase,
    heliosConversationMode: plan.limits.heliosConversationMode,
    canUseHeliosBasic: true,
    canUseHeliosMultiDocument: plan.limits.heliosConversationMode !== "single_document",
    canUseHeliosHistoricalMemory: plan.limits.heliosConversationMode === "historical",
    canUseComparativeView: plan.key !== "free",
    canUseExtendedContext: plan.key !== "free",
    canUseRevalidations: plan.limits.includedRevalidations,
    canUseProactiveAlerts: plan.limits.includedProactiveAlerts,
    canGeneratePremiumReport: purchasedSet.has("informe_premium") || plan.key === "pro",
    canGenerateLawyerPacket: purchasedSet.has("expediente_abogado") || plan.key === "pro",
  };
}

export function formatCommercePriceMx(amount: number) {
  if (amount <= 0) {
    return "Gratis";
  }

  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function buildUpgradeMessage(params: {
  featureLabel: string;
  requiredPlan: CommercePlanKey;
}) {
  const plan = getCommercePlanDefinition(params.requiredPlan);
  return `${params.featureLabel} está disponible desde ${plan.name}. Puedes seguir usando la parte gratuita o desbloquearlo cuando te haga sentido.`;
}

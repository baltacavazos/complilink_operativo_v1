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

export const FREE_MAX_DOCUMENTS_PER_CASE = 1;

export function formatCommerceDocumentLimitBullet(maxDocumentsPerCase: number) {
  if (maxDocumentsPerCase === 1) {
    return "1 documento en tu caso.";
  }

  return `Hasta ${maxDocumentsPerCase} documentos en tu caso.`;
}

export function formatActiveDocumentCapCopy(maxDocumentsPerCase: number) {
  if (maxDocumentsPerCase === 1) {
    return "1 documento con tu plan actual.";
  }

  return `${maxDocumentsPerCase} documentos con tu plan actual.`;
}

export const FREE_TIER_EXHAUSTED_COPY =
  "En el plan gratis ya usaste tu documento. Si quieres subir otro, activa Audita Esencial.";

export const FREE_DOCUMENT_LIMIT_BLOCK_MESSAGE =
  "Subir otro documento en este caso está disponible desde Audita Esencial.";

export function isFreePlanDocumentLimitMessage(message: string) {
  const normalized = message.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return false;
  }

  return (
    normalized.includes(FREE_TIER_EXHAUSTED_COPY) ||
    normalized.includes(FREE_DOCUMENT_LIMIT_BLOCK_MESSAGE) ||
    /en el plan gratis ya usaste tu documento/i.test(normalized) ||
    /subir otro documento en este (expediente|caso)/i.test(normalized)
  );
}

export function formatExceededDocumentLimitFeatureLabel(maxDocumentsPerCase: number) {
  if (maxDocumentsPerCase <= 1) {
    return "Subir otro documento en este caso";
  }

  return `Subir más de ${maxDocumentsPerCase} documentos en este caso`;
}

export function formatDocumentLimitBlockedMessage(maxDocumentsPerCase: number) {
  if (maxDocumentsPerCase <= 1) {
    return FREE_DOCUMENT_LIMIT_BLOCK_MESSAGE;
  }

  return buildUpgradeMessage({
    featureLabel: formatExceededDocumentLimitFeatureLabel(maxDocumentsPerCase),
    requiredPlan: "essential",
  });
}

export function formatFreePlanLandingPrinciple(maxDocumentsPerCase: number) {
  if (maxDocumentsPerCase === 1) {
    return "El plan gratis incluye un documento.";
  }

  return `El plan básico incluye hasta ${maxDocumentsPerCase} documentos en tu caso.`;
}

function formatFreePlanDescription(maxDocumentsPerCase: number) {
  if (maxDocumentsPerCase === 1) {
    return "1 documento. Primera lectura y asesor básico.";
  }

  return `Incluye tu primera lectura, hasta ${maxDocumentsPerCase} documentos en tu caso y el asesor laboral básico sobre ese contexto.`;
}

function formatFreePlanAdvisorBullet(maxDocumentsPerCase: number) {
  if (maxDocumentsPerCase === 1) {
    return "Asesor laboral básico sobre ese documento.";
  }

  return "Asesor laboral básico sobre los documentos de tu caso.";
}

const ESSENTIAL_MAX_DOCUMENTS_PER_CASE = 15;
const PRO_MAX_DOCUMENTS_PER_CASE = 50;

export const COMMERCE_PLANS: CommercePlanDefinition[] = [
  {
    key: "free",
    name: "Audita Gratis",
    headline: "Para validar tu primer resultado sin pagar.",
    monthlyPriceMx: 0,
    badge: "Para empezar",
    ctaLabel: "Empezar",
    description: formatFreePlanDescription(FREE_MAX_DOCUMENTS_PER_CASE),
    highlighted: false,
    limits: {
      maxDocumentsPerCase: FREE_MAX_DOCUMENTS_PER_CASE,
      heliosConversationMode: "single_document",
      includedRevalidations: false,
      includedProactiveAlerts: false,
    },
    featureBullets: ["1 documento. Primera lectura y asesor básico."],
  },
  {
    key: "essential",
    name: "Audita Esencial",
    headline: "Para guardar más recibos en tu caso y compararlos.",
    monthlyPriceMx: 92,
    badge: "Más vendido",
    ctaLabel: "Elegir plan",
    description:
      "Más recibos en tu caso, para comparar lo que te pagaron y lo que ya vimos.",
    highlighted: true,
    limits: {
      maxDocumentsPerCase: ESSENTIAL_MAX_DOCUMENTS_PER_CASE,
      heliosConversationMode: "multi_document",
      includedRevalidations: false,
      includedProactiveAlerts: false,
    },
    featureBullets: [
      "Hasta 15 recibos en tu caso.",
      "Lectura de varios recibos y memoria corta dentro de tu caso.",
      "Puedes comparar recibos y el asesor recuerda lo que ya vimos.",
    ],
  },
  {
    key: "pro",
    name: "Audita Pro",
    headline: "Para seguir tu caso y avisarte si algo cambia.",
    monthlyPriceMx: 231,
    badge: "Operación completa",
    ctaLabel: "Elegir plan",
    description:
      "Suma el historial de tu caso, vuelve a preguntar a IMSS e Infonavit y te avisa si algo cambia.",
    highlighted: false,
    limits: {
      maxDocumentsPerCase: PRO_MAX_DOCUMENTS_PER_CASE,
      heliosConversationMode: "historical",
      includedRevalidations: true,
      includedProactiveAlerts: true,
    },
    featureBullets: [
      "Hasta 50 recibos en tu caso.",
      "Asesor laboral con el historial de tu caso.",
      "Volvemos a preguntar a IMSS e Infonavit y te avisamos si algo cambia.",
    ],
  },
];

export const COMMERCE_ONE_SHOTS: CommerceOneShotDefinition[] = [
  {
    key: "informe_premium",
    name: "Informe Premium",
    priceMx: 347,
    badge: "Pago único",
    ctaLabel: "Comprar informe",
    description:
      "Entrega una síntesis más ejecutiva de tu caso, con hallazgos, puntos por confirmar y el siguiente paso sugerido.",
    deliveryLabel: "Generación puntual dentro de tu caso",
    featureBullets: [
      "Resumen ejecutivo de tu caso.",
      "Hallazgos, huecos y siguiente paso sugerido.",
      "Útil para preparar orientación o conciliación.",
    ],
  },
  {
    key: "expediente_abogado",
    name: "Paquete para tu abogado",
    priceMx: 579,
    badge: "Pago único",
    ctaLabel: "Preparar paquete",
    description:
      "Ordena un paquete de contexto para compartir con una abogada o abogado sin empezar desde cero.",
    deliveryLabel: "Preparación puntual para compartir",
    featureBullets: [
      "Cronología base del caso.",
      "Documentos confirmados y huecos detectados.",
      "Lista de preguntas útiles para tu abogado.",
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

export const COMMERCE_PRICE_FOOTER = "Precios en MXN. IVA incluido.";

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

/** Sticker B2C: el número ya trae el IVA. No se muestra base ni «sin IVA». */
export function formatCommerceIvaSticker(amount: number) {
  if (amount <= 0) {
    return "$0";
  }

  return `${formatCommercePriceMx(amount)} · IVA incluido`;
}

export function buildUpgradeMessage(params: {
  featureLabel: string;
  requiredPlan: CommercePlanKey;
}) {
  const plan = getCommercePlanDefinition(params.requiredPlan);
  return `${params.featureLabel} está disponible desde ${plan.name}. Puedes seguir usando la parte gratuita o desbloquearlo cuando te haga sentido.`;
}

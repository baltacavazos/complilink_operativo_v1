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
  };
};

export function getAuditapatronPricingExperience(documentCount: number): AuditapatronPricingExperience {
  const hasEnoughContext = documentCount >= 2;

  return {
    landing: {
      showPrice: false,
      eyebrow: "Prueba gratis y con claridad desde el inicio",
      title: "Sube tu documento laboral y recibe una auditoría clara y confiable.",
      description:
        "Sube tu primer documento y entiende tu situación laboral en minutos. Las opciones para avanzar estarán disponibles en tu expediente.",
      principles: [
        "Empieza gratis con tu primer documento.",
        "Recibe claridad antes de tomar cualquier decisión.",
        "Avanza con más respaldo solo cuando lo necesites.",
      ],
    },
    platform: {
      showPrice: true,
      eyebrow: hasEnoughContext
        ? "Opcional cuando tu expediente ya tiene más contexto"
        : "Opcional para cuando quieras avanzar con más respaldo",
      title: "Preparación guiada de tu siguiente paso laboral",
      description: hasEnoughContext
        ? "Si tu expediente ya reúne señales útiles, puedes activar una preparación guiada para ordenar tu siguiente paso con más claridad."
        : "Fortalece tu expediente gratis. Cuando quieras avanzar, podrás activar una preparación guiada con tus documentos.",
      priceLabel: "$199 MXN pago único",
      primaryCtaLabel: "Entender esta opción",
      secondaryCtaLabel: "Seguir gratis por ahora",
      reassurance: "Puedes seguir usando la auditoría y tu expediente sin pagar ni desbloquear nada por obligación.",
    },
  };
}

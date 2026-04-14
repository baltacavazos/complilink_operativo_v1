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
        "Empieza con tu primer documento y entiende mejor tu situación laboral en minutos. Si más adelante necesitas más respaldo, las opciones adicionales aparecen dentro de tu expediente, cuando realmente te sirvan.",
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
        ? "Cuando tu expediente ya juntó señales útiles, puedes activar una preparación guiada para convertir tus documentos en un borrador ordenado del siguiente paso que quieras dar."
        : "Primero sigue fortaleciendo tu expediente gratis. Cuando quieras avanzar con más respaldo, podrás activar una preparación guiada basada en los documentos que ya reuniste.",
      priceLabel: "$199 MXN pago único",
      primaryCtaLabel: "Entender esta opción",
      secondaryCtaLabel: "Seguir gratis por ahora",
      reassurance: "Puedes seguir usando la auditoría y tu expediente sin pagar ni desbloquear nada por obligación.",
    },
  };
}

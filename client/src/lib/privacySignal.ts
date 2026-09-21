export type WorkerPrivacySignal = {
  badge: string;
  title: string;
  detail: string;
  company: string;
  control: string;
  trace: string;
  cardClass: string;
  badgeClass: string;
  eyebrowClass: string;
  ready: boolean;
};

/**
 * Si ya hay consulta o resultado, no se muestra «Privacidad activa» ni «mientras analizamos».
 * Esa barra solo existe mientras todavía no hay resultado.
 */
export function resolveWorkerPrivacySignal(input: {
  pendingDraft: boolean;
  analyzing: boolean;
  saved: boolean;
  officialResultReady: boolean;
}): WorkerPrivacySignal {
  if (input.officialResultReady) {
    return {
      badge: "",
      title: "",
      detail: "",
      company: "",
      control: "",
      trace: "",
      cardClass: "hidden",
      badgeClass: "hidden",
      eyebrowClass: "hidden",
      ready: true,
    };
  }

  if (input.pendingDraft) {
    return {
      badge: "Sin guardar",
      title: "Privacidad activa en borrador",
      detail: "Tu archivo sigue en revisión privada. Solo entra al expediente si tú lo confirmas.",
      company: "Empresa sin acceso",
      control: "Tú decides si guardar",
      trace: "Rastro solo al confirmar",
      cardClass: "border-teal-200 bg-teal-50/95",
      badgeClass: "border-teal-200 bg-white text-teal-900",
      eyebrowClass: "text-teal-800",
      ready: false,
    };
  }

  if (input.analyzing) {
    return {
      badge: "Protegido",
      title: "Privacidad activa mientras analizamos",
      detail:
        "El documento ya quedó protegido mientras vuelve la lectura. Aquí ves si sigue en análisis o si ya quedó listo.",
      company: "Empresa sin acceso",
      control: "Sin cambios automáticos",
      trace: "Seguimiento visible aquí",
      cardClass: "border-sky-200 bg-sky-50/95",
      badgeClass: "border-sky-200 bg-white text-sky-900",
      eyebrowClass: "text-sky-800",
      ready: false,
    };
  }

  if (input.saved) {
    return {
      badge: "Resguardado",
      title: "Privacidad activa dentro del expediente",
      detail: "El archivo ya está en tu expediente privado y aquí ves su estado sin tener que adivinar qué pasó.",
      company: "Empresa sin acceso",
      control: "Tú conservas el mando",
      trace: "Versión y estado visibles",
      cardClass: "border-emerald-200 bg-emerald-50/95",
      badgeClass: "border-emerald-200 bg-white text-emerald-900",
      eyebrowClass: "text-emerald-800",
      ready: false,
    };
  }

  return {
    badge: "Lista",
    title: "Privacidad activa desde el primer intento",
    detail: "Puedes subir un archivo, revisar el primer resultado y decidir después si te conviene guardarlo.",
    company: "Empresa sin acceso",
    control: "Tú confirmas si se guarda",
    trace: "Rastro visible al confirmar",
    cardClass: "border-teal-200 bg-teal-50/90",
    badgeClass: "border-teal-200 bg-white text-teal-900",
    eyebrowClass: "text-teal-800",
    ready: false,
  };
}

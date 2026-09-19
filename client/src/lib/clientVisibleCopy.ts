/**
 * Sanitizador de copy visible para la UI de AuditaPatrón.
 * Quita marcas y jerga internas (CompliLink, Helios, Manus, Forge, etc.)
 * sin tocar identificadores de código ni claves de storage.
 */

const EMPTY_QUOTES = /["“”‘’`]{2,}/g;
const EXTRA_SPACE = /\s{2,}/g;
const RAW_BOOLEAN_VALUE =
  /^["'`“”‘’]*\s*(true|false)\s*["'`“”‘’]*[.!]?\s*$/i;

export function humanizeWorkerVisibleScalar(value?: unknown): string | null {
  if (value == null) {
    return null;
  }

  if (typeof value === "boolean") {
    return value ? "Sí" : "No";
  }

  const text = String(value).replace(/\s+/g, " ").trim();
  if (!text) {
    return null;
  }

  if (RAW_BOOLEAN_VALUE.test(text)) {
    return /true/i.test(text) ? "Sí" : "No";
  }

  return text;
}

export function hasRawBooleanLeak(value?: string | null): boolean {
  if (!value) {
    return false;
  }

  return RAW_BOOLEAN_VALUE.test(value.trim());
}

function collapseCopy(value: string) {
  return value.replace(EMPTY_QUOTES, "").replace(EXTRA_SPACE, " ").trim();
}

export function sanitizeClientVisibleCopy(value?: string | null): string | null {
  if (value == null) {
    return value ?? null;
  }

  if (!value) {
    return value;
  }

  let next = value;

  next = next.replace(
    /interacci[oó]n con Helios(?:,)?\s*CompliLink(?:\s+y\s+dem[aá]s componentes(?:\s+del ecosistema)?)?/gi,
    "interacción con el asesor laboral",
  );
  next = next.replace(/incluyendo CompliLink y Helios/gi, "incluyendo AuditaPatrón y su asesor laboral");
  next = next.replace(
    /La identidad legal del responsable y el domicilio se publicar[aá]n antes del lanzamiento comercial definitivo\.?\s*/gi,
    "",
  );

  next = next.replace(/CompliLink Operativo/gi, "AuditaPatrón");
  next = next.replace(/CompliLink\s*ID/gi, "ID de integración");
  next = next.replace(/Snapshot operativo CompliLink/gi, "Snapshot operativo del puente");
  next = next.replace(/Alerta CompliLink/gi, "Alerta del puente");
  next = next.replace(/CompliLink/gi, "AuditaPatrón");

  next = next.replace(/Inicia sesión con Manus para continuar/gi, "Inicia sesión para continuar");
  next = next.replace(/Inicia sesión con Manus,\s*/gi, "Inicia sesión con ");
  next = next.replace(/Continuar con Manus/gi, "Continuar");
  next = next.replace(/\s*con Manus(?=,|\s|$)/gi, "");
  next = next.replace(/\bManus\b/g, "tu acceso");

  next = next.replace(/APIMarket/gi, "el servicio de consulta");
  next = next.replace(/\bForge\b/g, "la plataforma");
  next = next.replace(/\bForensic\b/gi, "revisión documental");

  next = next.replace(/Modo Helios/gi, "Modo asesor");
  next = next.replace(/Helios · modo CEO/gi, "Asesor laboral · modo CEO");
  next = next.replace(/Helios · /g, "Asesor laboral · ");
  next = next.replace(/Helios básico/gi, "asesor laboral básico");
  next = next.replace(/Helios multi-documento/gi, "lectura de varios documentos");
  next = next.replace(/Helios con memoria histórica/gi, "asesor laboral con memoria histórica");
  next = next.replace(/Helios con lectura/gi, "asesor laboral con lectura");
  next = next.replace(/capa ejecutiva de Helios/gi, "capa ejecutiva del asesor laboral");
  next = next.replace(/consulta sensible a Helios/gi, "consulta sensible al asesor laboral");
  next = next.replace(/Atajos ejecutivos de Helios/gi, "Atajos ejecutivos del asesor");
  next = next.replace(/Lo que Helios sí está leyendo/gi, "Lo que el asesor sí está leyendo");
  next = next.replaceAll("copiloto Helios", "asesor laboral");
  next = next.replaceAll("Copiloto Helios", "Asesor laboral");
  next = next.replaceAll("copiloto laboral", "asesor laboral");
  next = next.replaceAll("Copiloto laboral", "Asesor laboral");
  next = next.replaceAll("asistente laboral", "asesor laboral");
  next = next.replaceAll("Asistente laboral", "Asesor laboral");
  next = next.replaceAll("Expediente Helios", "expediente laboral");
  next = next.replaceAll("expediente Helios", "expediente laboral");
  next = next.replaceAll("HeliosDocumento", "documento");
  next = next.replaceAll("Estado de Helios", "estado del expediente");
  next = next.replaceAll("Etapa Helios", "etapa del expediente");
  next = next.replaceAll("Tipo Helios", "tipo sugerido");
  next = next.replaceAll("motor Helios", "inteligencia laboral");
  next = next.replaceAll("Motor Helios", "Inteligencia laboral");
  next = next.replaceAll("Preguntar a Helios", "Preguntar al asesor laboral");
  next = next.replace(/\bHelios\b/g, "la inteligencia laboral");
  next = next.replace(/\bhelios\b/gi, "la inteligencia laboral");

  next = next.replace(/webhook_rejected/gi, "No pudimos recibir el aviso.");
  next = next.replace(/detectada por webhook/gi, "detectada automáticamente");
  next = next.replace(/envíe el webhook/gi, "confirme el pago");
  next = next.replace(/Webhook listo/gi, "Aviso listo");
  next = next.replace(/Webhook pendiente/gi, "Aviso pendiente");
  next = next.replace(/\bWebhook\b/g, "aviso");
  next = next.replace(/\bwebhook\b/g, "aviso");

  next = next.replace(/\bconfidence score\b/gi, "confianza orientativa");
  next = next.replace(/\bscore\b/gi, "indicador");
  next = next.replace(/\bONLINE\b/g, "en línea");

  next = collapseCopy(next);
  return next;
}

export function hasForbiddenClientBrand(value?: string | null): boolean {
  if (!value) {
    return false;
  }

  return /CompliLink|complilink|\bManus\b|\bForge\b|\bHelios\b|\bhelios\b|APIMarket|\bForensic\b|\bONLINE\b|\bWebhook\b|\bwebhook\b/.test(
    value,
  );
}

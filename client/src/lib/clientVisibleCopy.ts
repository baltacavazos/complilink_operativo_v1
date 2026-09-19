/**
 * Sanitizador de copy visible para la UI de AuditaPatrón.
 * Quita marcas y jerga internas (CompliLink, Helios, Manus, Forge, etc.)
 * sin tocar identificadores de código ni claves de storage.
 */

const EMPTY_QUOTES = /["“”‘’`]{2,}/g;
const EXTRA_SPACE = /\s{2,}/g;

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
  next = next.replaceAll("Preguntar a Helios", "Preguntar al asesor");
  next = next.replace(/\bHelios\b/g, "la inteligencia laboral");
  next = next.replace(/\bhelios\b/gi, "la inteligencia laboral");

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

  return /CompliLink|complilink|\bManus\b|\bForge\b|\bHelios\b|\bhelios\b|APIMarket|\bForensic\b|\bONLINE\b/.test(
    value,
  );
}

/**
 * Sanitizador de copy visible para la UI de AuditaPatrón.
 * Quita marcas y jerga internas (CompliLink, Helios, Manus, Forge, etc.)
 * sin tocar identificadores de código ni claves de storage.
 */

import { stripInternalControlMarkers } from "@shared/workerChatUx";

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

const WORKER_SYSTEM_LABEL =
  /^(archivo|formato|tipo de documento|detalle detectado|nivel de revisi[oó]n|puede leer detalles|puede estimar prestaciones)$/i;

const WORKER_INTERNAL_VALUE =
  /^(application\/[a-z0-9.+-]+|image\/[a-z0-9.+-]+|text\/[a-z0-9.+-]+|audio\/[a-z0-9.+-]+|video\/[a-z0-9.+-]+|multipart\/[a-z0-9.+-]+|other|expanded|standard|contract[_-]?deep[_-]?dive|payroll[_-]?receipt|cfdi|imss|contract|settlement|evidence)$/i;

export function isWorkerInternalFieldValue(value?: unknown): boolean {
  if (value == null) {
    return false;
  }

  const text = String(value).replace(/\s+/g, " ").trim();
  if (!text) {
    return false;
  }

  return WORKER_INTERNAL_VALUE.test(text);
}

export function isWorkerSystemFieldLabel(label?: string | null): boolean {
  if (!label) {
    return false;
  }

  return WORKER_SYSTEM_LABEL.test(label.replace(/\s+/g, " ").trim());
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

  let next = stripInternalControlMarkers(value);

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

  next = next.replace(/Modo Helios/gi, "Asesor laboral");
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
  next = next.replaceAll("Preguntar a Helios", "Preguntar al asesor");
  next = next.replace(
    /Helios ya conectó documentos del expediente y está devolviendo una lectura preliminar[^.]*\.?/gi,
    "El asesor laboral ya conectó documentos del expediente y está devolviendo una lectura preliminar con datos y siguientes pasos útiles.",
  );
  next = next.replace(/\bHelios ya\b/g, "El asesor laboral ya");
  next = next.replace(/\bHelios\b/g, "el asesor laboral");
  next = next.replace(/\bhelios\b/gi, "el asesor laboral");
  next = next.replace(/se[nñ]ales/gi, "datos");
  next = next.replace(/se[nñ]alar/gi, "indicar");
  next = next.replace(/se[nñ]ala(?=\s|\b)/gi, "indica");
  next = next.replace(/se[nñ]al(?!es)/gi, "resultado");
  next = next.replace(
    /Esto es una demostraci[oó]n\.?\s*No se cobra nada\.?/gi,
    "Activaremos el cobro cuando esté listo.",
  );

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

  next = next.replace(
    /This account is limited to a single personal case\.?/gi,
    "Esta cuenta solo puede tener un expediente personal.",
  );
  next = next.replace(
    /No personal case assigned to this account\.?/gi,
    "Esta cuenta aún no tiene un expediente personal.",
  );
  next = next.replace(
    /Write access denied for case\.?/gi,
    "No puedes modificar este expediente.",
  );
  next = next.replace(
    /Admin access denied for tenant\.?/gi,
    "No tienes permiso de administración en este espacio.",
  );
  next = next.replace(
    /Access denied for tenant\.?/gi,
    "No tienes acceso a este espacio.",
  );
  next = next.replace(
    /Access denied for case\.?/gi,
    "No tienes acceso a este expediente.",
  );
  next = next.replace(
    /Database not available\.?/gi,
    "No pudimos guardar esto ahora. Intenta de nuevo en un momento.",
  );
  next = next.replace(
    /Table ['`][^'`]+['`] doesn't exist\.?/gi,
    "No pudimos preparar tu expediente ahora. Intenta de nuevo en un momento.",
  );
  next = next.replace(
    /(?:ER_NO_SUCH_TABLE|ER_BAD_FIELD_ERROR|SQLSTATE\[[^\]]+\]|Unknown column '[^']+'|Unknown table '[^']+')[^.!]*/gi,
    "No pudimos preparar tu expediente ahora. Intenta de nuevo en un momento.",
  );
  next = next.replace(
    /(?:Failed query|sqlMessage|sqlState|errno\s*:?\s*\d+)[:\s].*/gi,
    "No pudimos preparar tu expediente ahora. Intenta de nuevo en un momento.",
  );
  next = next.replace(
    /No accessible tenant found\.?/gi,
    "No pudimos preparar tu espacio de revisión.",
  );

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

const SMOKE_ACCOUNT_HANDLE = /^(ap\.)?wave\d+$/i;
const INTERNAL_ACCOUNT_HANDLE =
  /^(ap|cl|helios|complilink|smoke|e2e|harness|test|tester|demo)([._-][a-z0-9._-]*)?$/i;
const TECHNICAL_HANDLE = /^[a-z0-9]+[._-][a-z0-9._-]+$/i;

export function isSmokeOrInternalAccountHandle(value?: string | null): boolean {
  if (!value) {
    return false;
  }

  const text = value.replace(/\s+/g, " ").trim();
  if (!text) {
    return false;
  }

  const localPart = text.includes("@") ? text.slice(0, text.indexOf("@")) : text;
  return SMOKE_ACCOUNT_HANDLE.test(localPart) || INTERNAL_ACCOUNT_HANDLE.test(localPart);
}

export function maskWorkerEmail(email?: string | null): string | null {
  if (!email) {
    return null;
  }

  const normalized = email.replace(/\s+/g, "").trim();
  const separator = normalized.indexOf("@");
  if (separator < 1 || separator === normalized.length - 1) {
    return null;
  }

  const localPart = normalized.slice(0, separator);
  const domain = normalized.slice(separator + 1);
  if (!localPart || !domain) {
    return null;
  }

  if (isSmokeOrInternalAccountHandle(localPart)) {
    return null;
  }

  return `${localPart.slice(0, 1)}***@${domain}`;
}

export function formatWorkerVisibleAccountName(value?: string | null): string | null {
  if (value == null) {
    return null;
  }

  const text = value.replace(/\s+/g, " ").trim();
  if (!text) {
    return null;
  }

  if (isSmokeOrInternalAccountHandle(text)) {
    return "Ejemplo";
  }

  if (/[/\\]/.test(text) || (TECHNICAL_HANDLE.test(text) && /\d/.test(text))) {
    return "Mi revisión";
  }

  const cleaned = text
    .replace(/\b(?:ap\.)?wave\d+\b/gi, "ejemplo")
    .replace(/\b(?:tester|demo)\b/gi, "ejemplo")
    .replace(/\s{2,}/g, " ")
    .trim();

  return cleaned || "Tu cuenta";
}

export function formatWorkerAccountChrome(input: {
  name?: string | null;
  email?: string | null;
}): { title: string; subtitle: string } {
  const name = input.name?.replace(/\s+/g, " ").trim() || "";
  const email = input.email?.replace(/\s+/g, "").trim() || "";
  const nameIsInternal = isSmokeOrInternalAccountHandle(name);
  const emailIsInternal = isSmokeOrInternalAccountHandle(email);
  const nameLooksTechnical = Boolean(name) && !/\s/.test(name) && TECHNICAL_HANDLE.test(name);
  const maskedEmail = maskWorkerEmail(email);

  if (!name || nameIsInternal || emailIsInternal || nameLooksTechnical) {
    return {
      title: "Ejemplo",
      subtitle: "Estos papeles no son tu caso.",
    };
  }

  return {
    title: formatWorkerVisibleAccountName(name) ?? "Tu cuenta",
    subtitle: maskedEmail || "Sesión protegida",
  };
}

const DOSSIER_PROGRESS_LABELS: Record<string, string> = {
  "base inicial": "Estás empezando",
  "listo para iniciar": "Estás empezando",
  "respaldo en crecimiento": "Ya vas avanzando",
  "respaldo sólido": "Ya tienes un buen respaldo",
  analizando: "Estamos leyendo tu documento",
  "con lectura activa": "Ya hay una lectura",
  "lectura activa": "Ya hay una lectura",
  cerrado: "Expediente cerrado",
};

export function humanizeDossierProgressLabel(label?: string | null): string {
  const text = (label ?? "").replace(/\s+/g, " ").trim().replace(/^Con\s+/i, "");
  if (!text) {
    return "Estás empezando";
  }

  return DOSSIER_PROGRESS_LABELS[text.toLowerCase()] ?? text;
}

export function formatDossierProgressCopy(
  completed: number,
  total: number,
  label?: string | null,
): string {
  const safeCompleted = Math.max(0, Number.isFinite(completed) ? completed : 0);
  const safeTotal = Math.max(1, Number.isFinite(total) ? total : 1);
  const noun = safeTotal === 1 ? "documento" : "documentos";
  return `${safeCompleted} de ${safeTotal} ${noun} · ${humanizeDossierProgressLabel(label)}`;
}

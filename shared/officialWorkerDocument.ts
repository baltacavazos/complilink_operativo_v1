import { readInfonavitMiCuentaText } from "./infonavitMiCuentaDocument";

/**
 * Papel oficial que la persona baja ella misma.
 * La consulta de un tercero solo entra si no hay este papel.
 * Nunca se pide ni se guarda una clave de gobierno.
 */

export const OFFICIAL_WORKER_KINDS = ["imss", "infonavit", "sat"] as const;
export type OfficialWorkerKind = (typeof OFFICIAL_WORKER_KINDS)[number];

export const WORKER_DATA_FUENTES = ["fuente oficial", "respaldo"] as const;
export type WorkerDataFuente = (typeof WORKER_DATA_FUENTES)[number];

export const WORKER_DATA_VERDICTS = ["cumple", "falta_un_dato", "no_pudimos_confirmar"] as const;
export type WorkerDataVerdict = (typeof WORKER_DATA_VERDICTS)[number];

export const ONLINE_VERIFICATIONS = [
  "matched",
  "mismatch",
  "unavailable",
  "captcha",
  "not_attempted",
] as const;
export type OnlineVerification = (typeof ONLINE_VERIFICATIONS)[number];

export const OFFICIAL_UPLOAD_LABEL = "¿Ya te llegó? Súbela";
export const IMSS_CONSTANCIA_BUTTON = "Pedir mi constancia del IMSS";
export const IMSS_EMAIL_WHEN_SLOW = "Avísame por correo cuando conteste";
export const RECEIPT_PERMISSION_MISSING = "Falta tu permiso para preguntar al IMSS y al SAT";
export const IMSS_CONSTANCIA_WHILE_WAITING = "Pide tu constancia del IMSS y súbela.";
export const OFFICIAL_DOCUMENT_FALLBACK_LEAD =
  "Pide tu constancia aquí (te llega en un minuto), súbela y te la reviso";
export const OFFICIAL_FALLBACK_LABEL = OFFICIAL_DOCUMENT_FALLBACK_LEAD;
export const OFFICIAL_VERIFIED_LABEL = "Verificado con documento oficial";
export const OFFICIAL_GUIDE_INTRO =
  "La consulta no contestó. Pide tu papel en la página del gobierno. Aquí no escribas tu clave.";
export const OFFICIAL_PAGE_DOWN =
  "La página oficial no abre ahora. Si ya te llegó el PDF, súbelo.";
export const OFFICIAL_NO_PASSWORD = "No pedimos tu clave del gobierno. Nadie entra por ti.";

export const OFFICIAL_WORKER_PAGES: Record<
  OfficialWorkerKind,
  { title: string; url: string; help: string }
> = {
  imss: {
    title: "Pide tu constancia del IMSS",
    url: "https://serviciosdigitales.imss.gob.mx/semanascotizadas-web/usuarios/IngresoAsegurado",
    help: "Entra a la página del IMSS. Pide tu constancia de semanas cotizadas. Te llega a tu correo. Usa tu CURP allá.",
  },
  infonavit: {
    title: "Descarga tu estado de cuenta de Mi Cuenta Infonavit",
    url: "https://micuenta.infonavit.org.mx/",
    help: "Entra a Mi Cuenta Infonavit. Baja el PDF de tu estado de cuenta o de tu crédito.",
  },
  sat: {
    title: "Tu constancia del SAT (CSF)",
    url: "https://www.sat.gob.mx/aplicacion/53027/genera-tu-constancia-de-situacion-fiscal",
    help: "Entra al SAT. Baja tu constancia de situación fiscal. Es un PDF.",
  },
};

const ALLOWED_HOSTS: Record<OfficialWorkerKind, string[]> = {
  imss: ["imss.gob.mx"],
  sat: ["sat.gob.mx"],
  infonavit: ["infonavit.org.mx"],
};

export type ExpectedWorkerIdentity = {
  nss?: string | null;
  curp?: string | null;
  rfc?: string | null;
};

export type ImssPatronFact = {
  nombre: string | null;
  registro: string | null;
  alta: string | null;
  baja: string | null;
};

export type OfficialWorkerReading = {
  kind: OfficialWorkerKind;
  fuente: WorkerDataFuente;
  verdict: WorkerDataVerdict;
  verdictLabel: string;
  readable: boolean;
  lines: string[];
  notice: string;
  nss: string | null;
  curp: string | null;
  rfc: string | null;
  semanas: string | null;
  salario: string | null;
  patrones: ImssPatronFact[];
  satNombre: string | null;
  satEstatus: string | null;
  verificationUrl: string | null;
  online: OnlineVerification;
  editSuspicious: boolean;
  identityMismatch: boolean;
};

export type WorkerSourceChoice = "fuente oficial" | "consulta" | "pedir_papel" | "respaldo";

const CURP_RE = /^[A-Z]{4}\d{6}[A-Z]{6}[0-9A-Z]{2}$/;
const RFC_RE = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/;
const DATE_RE = /(\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2}|vigente)/i;

export function normalizeWorkerNss(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const digits = String(value).replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 11) return null;
  if (/^0+$/.test(digits)) return null;
  return digits;
}

export function normalizeWorkerCurp(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return CURP_RE.test(normalized) ? normalized : null;
}

export function normalizeWorkerRfc(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.toUpperCase().replace(/[^A-Z0-9Ñ&]/g, "");
  if (!RFC_RE.test(normalized)) return null;
  if (normalized === "XAXX010101000" || normalized === "XEXX010101000") return null;
  return normalized;
}

export function verdictLabel(verdict: WorkerDataVerdict): string {
  if (verdict === "cumple") return OFFICIAL_VERIFIED_LABEL;
  if (verdict === "falta_un_dato") return "Falta un dato";
  return "No pudimos confirmar";
}

/**
 * La consulta con CURP o NSS va primero.
 * El papel oficial solo se pide si esa consulta no contestó, o si la persona ya lo subió.
 */
export function selectWorkerDataPath(input: {
  hasOfficialDocument: boolean;
  instantSourcesFailed?: boolean;
}): WorkerSourceChoice {
  if (input.hasOfficialDocument) return "fuente oficial";
  if (input.instantSourcesFailed) return "pedir_papel";
  return "consulta";
}

/** La consulta instantánea corre salvo que ya haya un papel oficial verificado. */
export function shouldCallThirdPartyFallback(input: {
  hasOfficialDocument: boolean;
  workerCannotProvideDocument?: boolean;
}): boolean {
  return !input.hasOfficialDocument;
}

/** La guía del PDF solo aparece cuando ninguna consulta instantánea contestó. */
export function shouldOfferOfficialDocumentFallback(input: {
  silence?: boolean | null;
  status?: string | null;
}): boolean {
  if (input.silence) return true;
  return input.status === "no_se_pudo" || input.status === "no_configurado";
}

export function tagOfficialCheckFuente<T extends { sourceRole?: WorkerDataFuente | null }>(
  summary: T,
  thirdPartyFallback: boolean,
): T {
  if (!thirdPartyFallback) return summary;
  return { ...summary, sourceRole: "respaldo" };
}

export function officialVerificationHostAllowed(url: string, kind: OfficialWorkerKind): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    const host = parsed.hostname.toLowerCase();
    return ALLOWED_HOSTS[kind].some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
  } catch {
    return false;
  }
}

export function extractOfficialUrls(value: string): string[] {
  const found = value.match(/https?:\/\/[^\s<>"')\]]+/gi) ?? [];
  const urls: string[] = [];
  for (const raw of found) {
    const cleaned = raw.replace(/[.,;]+$/, "");
    if (!urls.includes(cleaned)) urls.push(cleaned);
  }
  return urls;
}

export function pickVerificationUrl(text: string, kind: OfficialWorkerKind): string | null {
  return extractOfficialUrls(text).find((url) => officialVerificationHostAllowed(url, kind)) ?? null;
}

function tidy(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function uniqueIds(values: Array<string | null>): string[] {
  const next: string[] = [];
  for (const value of values) {
    if (!value || next.includes(value)) continue;
    next.push(value);
  }
  return next;
}

function collectMatches(text: string, pattern: RegExp): RegExpExecArray[] {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  const expression = new RegExp(pattern.source, flags);
  const found: RegExpExecArray[] = [];
  let match: RegExpExecArray | null = expression.exec(text);
  while (match) {
    found.push(match);
    match = expression.exec(text);
  }
  return found;
}

function collectLabeled(text: string, pattern: RegExp, normalize: (value: string) => string | null): string[] {
  const found: string[] = [];
  for (const match of collectMatches(text, pattern)) {
    const value = normalize(match[1] ?? "");
    if (value) found.push(value);
  }
  return uniqueIds(found);
}

function readImssPatrones(text: string): ImssPatronFact[] {
  const chunks = text.split(/(?=patr[oó]n\s*:)/i).slice(1);
  const patrones: ImssPatronFact[] = [];
  for (const chunk of chunks) {
    const nombre = tidy(chunk.match(/patr[oó]n\s*:\s*([^0-9\n]{3,80}?)(?=\s+registro|\s+fecha|$)/i)?.[1] ?? "");
    const registro = chunk.match(/registro\s+patronal\s*[:\s]\s*([A-Z0-9]{8,12})/i)?.[1]?.toUpperCase() ?? null;
    const alta = chunk.match(new RegExp(`fecha\\s+de\\s+alta\\s*[:\\s]\\s*${DATE_RE.source}`, "i"))?.[1] ?? null;
    const baja = chunk.match(new RegExp(`fecha\\s+de\\s+baja\\s*[:\\s]\\s*${DATE_RE.source}`, "i"))?.[1] ?? null;
    if (!nombre && !registro && !alta && !baja) continue;
    patrones.push({
      nombre: nombre || null,
      registro,
      alta: alta ? tidy(alta) : null,
      baja: baja ? tidy(baja) : null,
    });
    if (patrones.length >= 8) break;
  }
  return patrones;
}

function looksLikeKind(kind: OfficialWorkerKind, text: string): boolean {
  if (kind === "imss") return /imss|semanas cotizadas|seguro social/i.test(text);
  if (kind === "sat") return /constancia de situaci[oó]n fiscal|\bSAT\b|\bRFC\b/i.test(text);
  return /infonavit|mi cuenta|cr[eé]dito/i.test(text);
}

function idsConflict(found: string | null, expected: string | null | undefined): boolean {
  if (!found || !expected) return false;
  return found !== expected;
}

export function decideOfficialVerdict(input: {
  readable: boolean;
  missingCore: boolean;
  identityMismatch: boolean;
  editSuspicious: boolean;
  online: OnlineVerification;
}): WorkerDataVerdict {
  if (input.identityMismatch || input.editSuspicious) return "no_pudimos_confirmar";
  if (!input.readable || input.missingCore) return "falta_un_dato";
  if (input.online === "matched") return "cumple";
  return "no_pudimos_confirmar";
}

function noticeFor(verdict: WorkerDataVerdict, kind: OfficialWorkerKind): string {
  if (verdict === "cumple") return "La página oficial coincide con este papel.";
  if (verdict === "falta_un_dato") {
    if (kind === "imss") return "Falta un dato. Revisa que sea tu constancia de semanas del IMSS.";
    if (kind === "sat") return "Falta un dato. Revisa que sea tu constancia del SAT.";
    return "Falta un dato. Revisa que sea tu estado de cuenta de Infonavit.";
  }
  return "No pudimos confirmar este papel en la página oficial.";
}

function emptyReading(kind: OfficialWorkerKind, partial: Partial<OfficialWorkerReading> = {}): OfficialWorkerReading {
  const verdict = partial.verdict ?? "falta_un_dato";
  return {
    kind,
    readable: false,
    lines: [],
    notice: noticeFor(verdict, kind),
    nss: null,
    curp: null,
    rfc: null,
    semanas: null,
    salario: null,
    patrones: [],
    satNombre: null,
    satEstatus: null,
    verificationUrl: null,
    online: "not_attempted",
    editSuspicious: false,
    identityMismatch: false,
    ...partial,
    fuente: "fuente oficial",
    verdict,
    verdictLabel: verdictLabel(verdict),
  };
}

export function readOfficialWorkerDocumentText(params: {
  kind: OfficialWorkerKind;
  text: string;
  expected?: ExpectedWorkerIdentity | null;
  online?: OnlineVerification;
  editSuspicious?: boolean;
  verificationUrl?: string | null;
}): OfficialWorkerReading {
  const text = tidy(params.text);
  const online = params.online ?? "not_attempted";
  const editSuspicious = Boolean(params.editSuspicious);
  if (!looksLikeKind(params.kind, text)) {
    return emptyReading(params.kind, {
      online,
      editSuspicious,
      verdict: editSuspicious ? "no_pudimos_confirmar" : "falta_un_dato",
    });
  }

  const nssValues = collectLabeled(
    text,
    /(?:nss|n\.?\s*s\.?\s*s\.?|seguro social)\D{0,12}((?:\d[\s.\-]*){10,11})/gi,
    (value) => normalizeWorkerNss(value),
  );
  const bareNss = uniqueIds(
    collectMatches(text, /\b(\d{11})\b/g).map((match) => normalizeWorkerNss(match[1] ?? "")),
  );
  const curpValues = uniqueIds(
    collectMatches(text, /\b([A-Z]{4}\d{6}[A-Z]{6}[0-9A-Z]{2})\b/gi).map((match) =>
      normalizeWorkerCurp(match[1] ?? ""),
    ),
  );
  const rfcValues = collectLabeled(
    text,
    /\bRFC\b[:\s]{0,8}([A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3})/gi,
    (value) => normalizeWorkerRfc(value),
  );
  const nss = nssValues[0] ?? (params.kind === "imss" ? bareNss[0] ?? null : null);
  const curp = curpValues[0] ?? null;
  const rfc = rfcValues[0] ?? null;
  const duplicated =
    nssValues.length > 1 ||
    (params.kind === "imss" && bareNss.length > 1) ||
    curpValues.length > 1 ||
    rfcValues.length > 1;

  const expected = params.expected ?? {};
  const identityMismatch =
    duplicated ||
    idsConflict(nss, normalizeWorkerNss(expected.nss ?? null)) ||
    idsConflict(curp, normalizeWorkerCurp(expected.curp ?? null)) ||
    idsConflict(rfc, normalizeWorkerRfc(expected.rfc ?? null));

  const semanas = text.match(/(?:total\s+de\s+)?semanas(?:\s+cotizadas)?\s*[:\s]\s*(\d{1,4})/i)?.[1] ?? null;
  const salarioRaw = text.match(
    /salario(?:\s+base)?(?:\s+de\s+cotizaci[oó]n)?\s*[:\s]\s*\$?\s*([\d]{1,3}(?:,\d{3})*(?:\.\d{2})?|\d+(?:\.\d{2})?)/i,
  )?.[1];
  const salario = salarioRaw ? `$${salarioRaw.replace(/\s+/g, "")}` : null;
  const patrones = params.kind === "imss" ? readImssPatrones(text) : [];

  const infonavit = params.kind === "infonavit" ? readInfonavitMiCuentaText(text) : null;
  const satNombre = readSatName(text);
  const satEstatus = tidy(text.match(/estatus(?:\s+en\s+el\s+padr[oó]n)?\s*[:\s]\s*([A-Za-zÁÉÍÓÚÜáéíóúüñÑ ]{3,40})/i)?.[1] ?? "");

  const lines: string[] = [];
  if (params.kind === "imss") {
    if (nss) lines.push(`En tu constancia del IMSS aparece el NSS ${nss}.`);
    if (curp) lines.push(`En tu constancia aparece la CURP ${curp}.`);
    if (semanas) lines.push(`Semanas cotizadas: ${semanas}.`);
    if (salario) lines.push(`Salario base de cotización: ${salario}.`);
    for (const patron of patrones) {
      const bits = [
        patron.nombre ? `Patrón ${patron.nombre}` : null,
        patron.registro ? `registro ${patron.registro}` : null,
        patron.alta ? `alta ${patron.alta}` : null,
        patron.baja ? `baja ${patron.baja}` : null,
      ].filter(Boolean);
      if (bits.length) lines.push(`${bits.join(", ")}.`);
    }
  } else if (params.kind === "infonavit") {
    lines.push(...(infonavit?.lines ?? []));
    if (curp) lines.push(`En tu estado de cuenta aparece la CURP ${curp}.`);
    if (nss) lines.push(`En tu estado de cuenta aparece el NSS ${nss}.`);
  } else {
    if (rfc) lines.push(`En tu constancia del SAT aparece el RFC ${rfc}.`);
    if (curp) lines.push(`En tu constancia del SAT aparece la CURP ${curp}.`);
    if (satNombre) lines.push(`Nombre en la constancia: ${satNombre}.`);
    if (satEstatus) lines.push(`Estatus en el padrón: ${satEstatus}.`);
  }

  const missingCore =
    params.kind === "imss"
      ? (!nss && !curp) || (patrones.length === 0 && !semanas)
      : params.kind === "sat"
        ? !rfc
        : lines.length === 0;

  const verdict = decideOfficialVerdict({
    readable: lines.length > 0,
    missingCore,
    identityMismatch,
    editSuspicious,
    online,
  });

  return emptyReading(params.kind, {
    verdict,
    readable: lines.length > 0 && !missingCore,
    lines,
    notice: noticeFor(verdict, params.kind),
    nss,
    curp,
    rfc,
    semanas,
    salario,
    patrones,
    satNombre: satNombre || null,
    satEstatus: satEstatus || null,
    verificationUrl: params.verificationUrl ?? pickVerificationUrl(text, params.kind),
    online,
    editSuspicious,
    identityMismatch,
  });
}

function readSatName(text: string): string {
  const match = text.match(
    /(?:denominaci[oó]n(?:\s+o\s+raz[oó]n\s+social)?|raz[oó]n\s+social|nombre(?:\s+del\s+contribuyente)?)\s*[:\s]\s*([A-Za-zÁÉÍÓÚÜÑáéíóúüñ][^:\n]{1,80})/i,
  );
  if (!match?.[1]) return "";
  const stopped = match[1].split(/\b(?:estatus|rfc|curp|regimen|régimen)\b/i)[0] ?? "";
  return tidy(stopped).replace(/[:\s]+$/g, "");
}

export function buildOfficialWorkerAdvisorAnswer(
  reading: OfficialWorkerReading,
  prompt?: string | null,
): string {
  const verified = reading.fuente === "fuente oficial" && reading.verdict === "cumple";
  const fuente = verified ? "" : reading.fuente === "respaldo" ? "Respaldo." : "Fuente oficial.";
  const verdictLine = verified
    ? `${OFFICIAL_VERIFIED_LABEL}.`
    : reading.verdict === "falta_un_dato"
      ? "Falta un dato."
      : "No pudimos confirmar.";
  const facts = reading.lines.slice(0, 8).join(" ");
  const ask = String(prompt ?? "").toLowerCase();
  const pay = /pago|sueldo|descuento|n[oó]mina/.test(ask)
    ? " Sobre tu pago solo uso este papel. No digo que tu patrón cumpla."
    : "";
  const body = [fuente, verdictLine, facts || reading.notice, pay].filter(Boolean).join(" ");
  return tidy(body);
}

import { OFFICIAL_FAILURE_SHIELD_TAIL, readOfficialSourceOutcomes, type OfficialCheckSummary } from "./officialCheckCopy";

/**
 * Hecho sacado del PDF que el titular sube.
 * Origen documental: nunca una consulta oficial en vivo.
 */
export const INFONAVIT_DOCUMENT_ORIGIN = "document" as const;
export const INFONAVIT_DOCUMENT_SOURCE = "user_upload" as const;

export type InfonavitDocumentOrigin = typeof INFONAVIT_DOCUMENT_ORIGIN;
export type InfonavitDocumentSource = typeof INFONAVIT_DOCUMENT_SOURCE;

export const INFONAVIT_MICUENTA_URL = "https://micuenta.infonavit.org.mx";

export const INFONAVIT_DOCUMENT_CTA =
  "Si quieres un dato de tu vivienda hoy, sube el PDF de Mi Cuenta Infonavit (Resumen de movimientos). Tú lo bajas en el portal oficial.";

export const INFONAVIT_DOCUMENT_UNREADABLE =
  "No pudimos leer ese PDF. No inventamos datos. Prueba otro archivo o vuelve cuando Infonavit conteste.";

export const INFONAVIT_DOCUMENT_ORIGIN_LINE = "Origen: documento que subiste.";

export const INFONAVIT_DOCUMENT_UPLOAD_LABEL = "Subir PDF de Mi Cuenta";
export const INFONAVIT_DOCUMENT_READING_LABEL = "Leyendo el PDF…";

/** Dos pasos visibles la primera vez que Infonavit no contestó. */
export const INFONAVIT_DOCUMENT_STEPS =
  "(1) Baja el PDF en Mi Cuenta (2) Súbelo aquí.";

const CREDIT_RE =
  /(?:n[uú]mero\s+de\s+cr[eé]dito|no\.?\s+de\s+cr[eé]dito|cr[eé]dito)\s*[:#\-]\s*(\d{6,18})/i;
const BALANCE_RE =
  /(saldo(?:\s+[a-záéíóúüñ]{2,24}){0,5})\s*:\s*(\$\s?\d[\d,]*(?:\.\d{2})?)/gi;
const MOVEMENT_RE =
  /(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4})\s+([A-Za-zÁÉÍÓÚÜáéíóúüñÑ][^$\d]{1,60}?)\s+(\$\s?\d[\d,]*(?:\.\d{2})?)/g;

const DISHONEST_DOCUMENT_COPY = [
  /consulta en vivo/i,
  /al corriente/i,
  /\bBien\b/,
  /tu patr[oó]n cumple\b/i,
  /confirmamos aportaciones/i,
  /\bApiMarket\b/i,
  /\bNufi\b/i,
  /\bSyntage\b/i,
  /alternateRoute/i,
  /contrase[nñ]a/i,
  /usuario\s*\/\s*pass/i,
];

export type InfonavitDocumentFactKind = "credit" | "balance" | "movement";

export type InfonavitDocumentFact = {
  origin: InfonavitDocumentOrigin;
  source: InfonavitDocumentSource;
  kind: InfonavitDocumentFactKind;
  creditNumber: string | null;
  label: string | null;
  amount: string | null;
  date: string | null;
  line: string;
};

export type InfonavitDocumentReading = {
  origin: InfonavitDocumentOrigin;
  source: InfonavitDocumentSource;
  readable: boolean;
  facts: InfonavitDocumentFact[];
  lines: string[];
  originLine: string;
  shield: string | null;
  notice: string;
};

export function infonavitDocumentCopyIsHonest(text: string): boolean {
  return !DISHONEST_DOCUMENT_COPY.some((pattern) => pattern.test(text));
}

function tidy(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function moneyToken(value: string): string {
  return tidy(value).replace(/\$\s+/, "$");
}

function creditLine(creditNumber: string): string {
  return `En el documento que subiste aparece el crédito ${creditNumber}.`;
}

function balanceLine(label: string, amount: string): string {
  return `En tu documento: ${tidy(label).toLowerCase()} ${moneyToken(amount)}.`;
}

function movementPhrase(label: string): string {
  const normalized = tidy(label).toLowerCase();
  if (/aportaci[oó]n/.test(normalized) && /patronal/.test(normalized)) return "aportación patronal";
  if (/aportaci[oó]n/.test(normalized)) return "aportación";
  return `movimiento ${normalized}`;
}

function movementLine(date: string, label: string, amount: string): string {
  return `En tu documento: ${movementPhrase(label)} ${moneyToken(amount)} · fecha ${date}.`;
}

function unreadReading(): InfonavitDocumentReading {
  return {
    origin: INFONAVIT_DOCUMENT_ORIGIN,
    source: INFONAVIT_DOCUMENT_SOURCE,
    readable: false,
    facts: [],
    lines: [],
    originLine: INFONAVIT_DOCUMENT_ORIGIN_LINE,
    shield: null,
    notice: INFONAVIT_DOCUMENT_UNREADABLE,
  };
}

function keepHonestLine(line: string): string | null {
  const cleaned = tidy(line);
  if (!cleaned || !infonavitDocumentCopyIsHonest(cleaned)) return null;
  return cleaned;
}

export function readInfonavitMiCuentaText(text: string): InfonavitDocumentReading {
  const sourceText = tidy(text);
  if (sourceText.length < 8) return unreadReading();

  const facts: InfonavitDocumentFact[] = [];
  const creditMatch = sourceText.match(CREDIT_RE);
  if (creditMatch?.[1]) {
    const line = keepHonestLine(creditLine(creditMatch[1]));
    if (line) {
      facts.push({
        origin: INFONAVIT_DOCUMENT_ORIGIN,
        source: INFONAVIT_DOCUMENT_SOURCE,
        kind: "credit",
        creditNumber: creditMatch[1],
        label: "crédito",
        amount: null,
        date: null,
        line,
      });
    }
  }

  for (const match of sourceText.matchAll(BALANCE_RE)) {
    const label = tidy(match[1] ?? "");
    const amount = moneyToken(match[2] ?? "");
    if (!label || !amount) continue;
    const line = keepHonestLine(balanceLine(label, amount));
    if (!line) continue;
    facts.push({
      origin: INFONAVIT_DOCUMENT_ORIGIN,
      source: INFONAVIT_DOCUMENT_SOURCE,
      kind: "balance",
      creditNumber: null,
      label,
      amount,
      date: null,
      line,
    });
    if (facts.filter((item) => item.kind === "balance").length >= 4) break;
  }

  for (const match of sourceText.matchAll(MOVEMENT_RE)) {
    const date = tidy(match[1] ?? "");
    const label = tidy(match[2] ?? "");
    const amount = moneyToken(match[3] ?? "");
    if (!date || !label || !amount) continue;
    const line = keepHonestLine(movementLine(date, label, amount));
    if (!line) continue;
    facts.push({
      origin: INFONAVIT_DOCUMENT_ORIGIN,
      source: INFONAVIT_DOCUMENT_SOURCE,
      kind: "movement",
      creditNumber: null,
      label,
      amount,
      date,
      line,
    });
    if (facts.filter((item) => item.kind === "movement").length >= 12) break;
  }

  if (facts.length === 0) return unreadReading();

  const lines = facts.map((item) => item.line);
  const publicCopy = [INFONAVIT_DOCUMENT_ORIGIN_LINE, OFFICIAL_FAILURE_SHIELD_TAIL, ...lines].join(" ");
  if (!infonavitDocumentCopyIsHonest(publicCopy)) return unreadReading();

  return {
    origin: INFONAVIT_DOCUMENT_ORIGIN,
    source: INFONAVIT_DOCUMENT_SOURCE,
    readable: true,
    facts,
    lines,
    originLine: INFONAVIT_DOCUMENT_ORIGIN_LINE,
    shield: OFFICIAL_FAILURE_SHIELD_TAIL,
    notice: INFONAVIT_DOCUMENT_ORIGIN_LINE,
  };
}

type InfonavitOfferSummary = Parameters<typeof readOfficialSourceOutcomes>[0] &
  Partial<Pick<OfficialCheckSummary, "overallStatus">>;

/** CTA solo si Infonavit quedó sin hecho usable. Un hecho vivo no se tapa con el PDF. */
export function shouldOfferInfonavitDocumentUpload(summary?: InfonavitOfferSummary | null): boolean {
  if (!summary) return false;
  const outcomes = readOfficialSourceOutcomes(summary);
  const infonavit = outcomes.find((item) => item.source === "infonavit");
  if (infonavit) {
    if (infonavit.status === "vivo" && infonavit.hechos.length > 0) return false;
    return infonavit.status === "no_se_pudo";
  }
  return summary.overallStatus === "no_se_pudo";
}

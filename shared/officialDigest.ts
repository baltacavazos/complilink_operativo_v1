/**
 * Digest honesto de fuentes oficiales (SCJN / DOF).
 * Solo títulos y ligas reales. Nunca inventa IUS ni registro digital.
 */

export const OFFICIAL_SOURCES_HEADING = "Lecturas oficiales";

export const OFFICIAL_DIGEST_BLOCKED_COPY =
  "No pude abrir la Corte ni el Diario Oficial ahora. No invento criterios ni números.";

export const OFFICIAL_DIGEST_LAST_GOOD_COPY =
  "Estas lecturas oficiales las tengo de una consulta anterior. Ahora no pude abrir la Corte o el Diario Oficial.";

export const OFFICIAL_DIGEST_DOCTRINA_LABEL = "Doctrina de la Corte, no jurisprudencia";
export const OFFICIAL_DIGEST_JURISPRUDENCIA_LABEL = "Criterio reiterado de la Corte";
export const OFFICIAL_DIGEST_DOF_LABEL = "Publicación del Diario Oficial";

export type OfficialDigestSource = "scjn" | "dof";
export type OfficialDigestKind = "jurisprudencia" | "doctrina" | "dof";
export type OfficialDigestFreshness = "live" | "last_good" | "blocked";

export type OfficialDigestCitation = {
  title: string;
  url: string;
  source: OfficialDigestSource;
  kind: OfficialDigestKind;
  kindLabel: string;
  officialId: string;
  publishedAt?: string | null;
  matchedTopics: string[];
  freshness: OfficialDigestFreshness;
};

export type OfficialDigestResult = {
  citations: OfficialDigestCitation[];
  freshness: OfficialDigestFreshness;
  liveAttempted: boolean;
  liveBlocked: boolean;
  honestyNote: string | null;
};

export type OfficialDigestQuery = {
  prompt?: string | null;
  documentType?: string | null;
  hasImssSignal?: boolean;
  hasFiscalSignal?: boolean;
  hasInfonavitSignal?: boolean;
};

export type OfficialHarvestEntry = {
  title: string;
  officialId: string;
  tesis?: string | null;
  url: string;
  publishedAt?: string | null;
  matchedTopics?: string[];
};

export type OfficialDofSeedEntry = {
  title: string;
  officialId: string;
  publishedAt: string;
  matchedTopics: string[];
};

export const SCJN_SJF_UI_URL = "https://bicentenario.scjn.gob.mx/repositorio-scjn/sjf";
export const SCJN_API_BASE = "https://bicentenario.scjn.gob.mx/repositorio-scjn/api/v1/tesis/";
export const SIDOF_TITLE_SEARCH_BASE =
  "https://sidof.segob.gob.mx/dof/sidof/buscarNotas/titulo/";

export const SCJN_HARVEST_SEED: OfficialHarvestEntry[] = [
  {
    title:
      "PERSONAS TRABAJADORAS DE CONFIANZA DE LA CÁMARA DE DIPUTADOS DEL CONGRESO DE LA UNIÓN. LA NATURALEZA DE SUS FUNCIONES PUEDE CORROBORARSE MEDIANTE LAS IMPUTACIONES PROBADAS EN JUICIO, CUANDO ÉSTAS EVIDENCIEN EL DESEMPEÑO DE LAS ACTIVIDADES PREVISTAS EN EL CATÁLOGO DE PUESTOS DE CONFIANZA.",
    officialId: "2032630",
    tesis: "I.4o.T.10 L (12a.)",
    url: "https://sjf2.scjn.gob.mx/detalle/tesis/2032630",
    publishedAt: "2026-09-11 10:20",
    matchedTopics: ["Laboral", "confianza"],
  },
  {
    title:
      "IMPROCEDENCIA DEL AMPARO INDIRECTO POR CAMBIO DE SITUACIÓN JURÍDICA. NO SE ACTUALIZA DICHA CAUSAL CUANDO SE RECLAMA EL ACUERDO QUE DEFINE LA COMPETENCIA EN EL JUICIO LABORAL, POR EL HECHO DE QUE EN EL MISMO SE DICTE UNO DIVERSO QUE PONGA FIN AL PROCEDIMIENTO.",
    officialId: "2032625",
    tesis: "VII.2o.T.18 L (12a.)",
    url: "https://sjf2.scjn.gob.mx/detalle/tesis/2032625",
    publishedAt: "2026-09-11 10:20",
    matchedTopics: ["Laboral", "amparo", "competencia"],
  },
  {
    title:
      "CARGA DE LA PRUEBA EN MATERIA LABORAL. CUANDO SE RECLAMA LA PRESTACIÓN DE VIVIENDA PREVISTA EN EL ARTÍCULO 66o., INCISO B), DEL CONTRATO LEY DE LAS INDUSTRIAS AZUCARERA, ALCOHOLERA Y SIMILARES DE LA REPÚBLICA MEXICANA, CORRESPONDE A LAS PERSONAS TRABAJADORAS ACREDITAR LOS REQUISITOS DE CLASIFICACIÓN Y TEMPORALIDAD ESTABLECIDOS EN DICHO PRECEPTO.",
    officialId: "2032619",
    tesis: "VII.2o.T.19 L (12a.)",
    url: "https://sjf2.scjn.gob.mx/detalle/tesis/2032619",
    publishedAt: "2026-09-11 10:20",
    matchedTopics: ["Laboral", "carga de la prueba", "vivienda"],
  },
  {
    title:
      "OFRECIMIENTO DE TRABAJO. PARA CALIFICARLO DE BUENA FE Y, EN SU CASO, DETERMINAR LA PROCEDENCIA DE LA REVERSIÓN DE LA CARGA DE LA PRUEBA, NO DEBEN VALORARSE LOS MEDIOS PROBATORIOS RELACIONADOS CON LA EXISTENCIA O INEXISTENCIA DEL DESPIDO QUE DIO ORIGEN AL JUICIO LABORAL.",
    officialId: "2032614",
    tesis: "PR.P.T.CN. J/14 L (12a.)",
    url: "https://sjf2.scjn.gob.mx/detalle/tesis/2032614",
    publishedAt: "2026-09-11 10:20",
    matchedTopics: ["Laboral", "despido", "ofrecimiento de trabajo"],
  },
  {
    title:
      "TIEMPO EXTRAORDINARIO DE LAS PERSONAS TRABAJADORAS AL SERVICIO DEL ESTADO DE GUERRERO. NO ES REQUISITO LA AUTORIZACIÓN POR ESCRITO DE LA PATRONAL PARA LABORARLAS, A FIN DE RECLAMAR SU PAGO [INTERRUPCIÓN DE LA JURISPRUDENCIA XXI.2o.C.T. J/1 L (11a.)].",
    officialId: "2032611",
    tesis: "XXI.2o.C.T.1 L (12a.)",
    url: "https://sjf2.scjn.gob.mx/detalle/tesis/2032611",
    publishedAt: "2026-09-04 10:13",
    matchedTopics: ["Laboral", "tiempo extraordinario", "horas extra"],
  },
];

export const DOF_LAST_GOOD_SEED: OfficialDofSeedEntry[] = [
  {
    title:
      "Decreto por el que se reforman, adicionan y derogan diversas disposiciones de la Ley Federal del Trabajo; de la Ley del Seguro Social; de la Ley del Instituto del Fondo Nacional de la Vivienda para los Trabajadores; del Código Fiscal de la Federación; de la Ley del Impuesto sobre la Renta; de la Ley del Impuesto al Valor Agregado; de la Ley Federal de los Trabajadores al Servicio del Estado, Reglamentaria del Apartado B) del Artículo 123 Constitucional; de la Ley Reglamentaria de la Fracción XIII Bis del Apartado B, del Artículo 123 de la Constitución Política de los Estados Unidos Mexicanos, en materia de Subcontratación Laboral.",
    officialId: "5616745",
    publishedAt: "23-04-2021",
    matchedTopics: ["subcontratacion", "repse", "lft", "imss", "infonavit", "reforma laboral"],
  },
  {
    title:
      "Decreto por el que se reforman, adicionan y derogan diversas disposiciones de la Ley Federal del Trabajo, en materia de reducción de la jornada laboral.",
    officialId: "5786537",
    publishedAt: "01-05-2026",
    matchedTopics: ["lft", "jornada", "horas extra", "tiempo extraordinario", "reforma laboral"],
  },
  {
    title:
      "Decreto por el que se reforman las fracciones IV y XI del Apartado A del Artículo 123 de la Constitución Política de los Estados Unidos Mexicanos, en materia de reducción de la jornada laboral.",
    officialId: "5781417",
    publishedAt: "03-03-2026",
    matchedTopics: ["jornada", "horas extra", "reforma laboral"],
  },
  {
    title:
      "Decreto por el que se reforman y adicionan diversas disposiciones de la Ley del Seguro Social y de la Ley del Instituto de Seguridad y Servicios Sociales de los Trabajadores del Estado.",
    officialId: "5729937",
    publishedAt: "07-06-2024",
    matchedTopics: ["imss", "seguro social"],
  },
  {
    title:
      "Condiciones Generales de Contratación que ofrece el Instituto del Fondo Nacional de la Vivienda para los Trabajadores a sus derechohabientes con relación laboral vigente para el otorgamiento de créditos destinados al pago de adeudos contraídos con Entidad Financiera o el INFONAVIT para la adquisición de vivienda o suelo destinado a la construcción de vivienda, así como para construir, reparar, ampliar o mejorar su vivienda en su versión 1.0.",
    officialId: "5732209",
    publishedAt: "03-07-2024",
    matchedTopics: ["infonavit", "vivienda"],
  },
];

const LEGAL_SOURCE_QUESTION_RE =
  /\b(?:ley|lft|corte|scjn|dof|diario oficial|doctrina|jurisprudencia|criterio|despido|horas?\s+extras?|tiempo extraordinario|jornada|subcontrat|repse|amparo|carga de la prueba|ofrecimiento de trabajo|reforma laboral|trabajadores? de confianza)\b/i;

const OFFICIAL_SOURCE_ASK_RE =
  /\b(?:reforma(?:\s+laboral)?|jurisprudencia|ley(?:es)?|lft|dof|diario oficial|doctrina|corte|scjn|criterio)\b/i;

const PAPER_DOCUMENT_QUESTION_RE =
  /\b(?:recibo|imss|nss|isr|infonavit|cfdi|n[oó]mina|descuent\w*|retenci[oó]n(?:es)?|impuestos?|alta|semanas?\s+cotizad\w*|seguro social)\b/i;

export function isOfficialLegalQuestion(prompt?: string | null): boolean {
  return LEGAL_SOURCE_QUESTION_RE.test(prompt ?? "");
}

export function isOfficialSourceAsk(prompt?: string | null): boolean {
  return OFFICIAL_SOURCE_ASK_RE.test(prompt ?? "");
}

export function isPaperDocumentQuestion(prompt?: string | null): boolean {
  return PAPER_DOCUMENT_QUESTION_RE.test(prompt ?? "");
}

export function shouldAttachOfficialDigest(prompt?: string | null): boolean {
  const text = (prompt ?? "").trim();
  if (!text) return false;
  if (isPaperDocumentQuestion(text) && !isOfficialSourceAsk(text)) {
    return false;
  }
  return isOfficialLegalQuestion(text);
}

export function classifyScjnKind(tesisKey?: string | null): OfficialDigestKind {
  if (!tesisKey) return "doctrina";
  return /\bJ\s*\/\s*\d+/i.test(tesisKey) ? "jurisprudencia" : "doctrina";
}

export function officialKindLabel(kind: OfficialDigestKind): string {
  if (kind === "jurisprudencia") return OFFICIAL_DIGEST_JURISPRUDENCIA_LABEL;
  if (kind === "dof") return OFFICIAL_DIGEST_DOF_LABEL;
  return OFFICIAL_DIGEST_DOCTRINA_LABEL;
}

export function buildScjnUrl(officialId: string): string {
  return `https://sjf2.scjn.gob.mx/detalle/tesis/${officialId}`;
}

export function buildDofUrl(officialId: string, publishedAt?: string | null): string {
  const date = (publishedAt ?? "").trim().replace(/-/g, "/");
  const fecha = /^\d{2}\/\d{2}\/\d{4}$/.test(date) ? date : "";
  return fecha
    ? `https://www.dof.gob.mx/nota_detalle.php?codigo=${officialId}&fecha=${fecha}`
    : `https://www.dof.gob.mx/nota_detalle.php?codigo=${officialId}`;
}

export function toScjnCitation(
  entry: OfficialHarvestEntry,
  freshness: OfficialDigestFreshness,
): OfficialDigestCitation {
  const kind = classifyScjnKind(entry.tesis);
  return {
    title: entry.title.trim(),
    url: entry.url || buildScjnUrl(entry.officialId),
    source: "scjn",
    kind,
    kindLabel: officialKindLabel(kind),
    officialId: entry.officialId,
    publishedAt: entry.publishedAt ?? null,
    matchedTopics: entry.matchedTopics ?? ["Laboral"],
    freshness,
  };
}

export function toDofCitation(
  entry: OfficialDofSeedEntry,
  freshness: OfficialDigestFreshness,
): OfficialDigestCitation {
  return {
    title: entry.title.trim(),
    url: buildDofUrl(entry.officialId, entry.publishedAt),
    source: "dof",
    kind: "dof",
    kindLabel: officialKindLabel("dof"),
    officialId: entry.officialId,
    publishedAt: entry.publishedAt,
    matchedTopics: entry.matchedTopics,
    freshness,
  };
}

export function listLastGoodOfficialCitations(): OfficialDigestCitation[] {
  return [
    ...SCJN_HARVEST_SEED.map((entry) => toScjnCitation(entry, "last_good")),
    ...DOF_LAST_GOOD_SEED.map((entry) => toDofCitation(entry, "last_good")),
  ];
}

export function listKnownOfficialIds(): Set<string> {
  return new Set(listLastGoodOfficialCitations().map((item) => item.officialId));
}

export function listKnownOfficialTitles(): string[] {
  return listLastGoodOfficialCitations()
    .map((item) => item.title)
    .sort((left, right) => right.length - left.length);
}

export function isKnownOfficialUrl(value: string): boolean {
  const scjn = value.match(/https:\/\/sjf2\.scjn\.gob\.mx\/detalle\/tesis\/(\d+)/i);
  if (scjn?.[1] && listKnownOfficialIds().has(scjn[1])) return true;
  const dof = value.match(
    /https:\/\/www\.dof\.gob\.mx\/nota_detalle\.php\?codigo=(\d+)/i,
  );
  return Boolean(dof?.[1] && listKnownOfficialIds().has(dof[1]));
}

const KNOWN_OFFICIAL_URL_RE =
  /https:\/\/(?:sjf2\.scjn\.gob\.mx\/detalle\/tesis\/\d+|www\.dof\.gob\.mx\/nota_detalle\.php\?codigo=\d+(?:&fecha=\d{2}\/\d{2}\/\d{4})?)/gi;

export function maskOfficialDigestSpans(value: string): {
  masked: string;
  restore: (next: string) => string;
} {
  const tokens: string[] = [];
  const mask = (match: string) => {
    const token = `\u0000OFFICIAL${tokens.length}\u0000`;
    tokens.push(match);
    return token;
  };

  let masked = value;
  for (const title of listKnownOfficialTitles()) {
    if (title && masked.includes(title)) {
      masked = masked.split(title).join(mask(title));
    }
  }
  masked = masked.replace(KNOWN_OFFICIAL_URL_RE, (match) =>
    isKnownOfficialUrl(match) ? mask(match) : match,
  );

  return {
    masked,
    restore: (next: string) => {
      let restored = next;
      tokens.forEach((token, index) => {
        restored = restored.split(`\u0000OFFICIAL${index}\u0000`).join(token);
      });
      return restored;
    },
  };
}

function normalizeMatchText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function queryTopics(query: OfficialDigestQuery): string[] {
  const haystack = normalizeMatchText(
    [query.prompt, query.documentType, query.hasImssSignal ? "imss" : "", query.hasInfonavitSignal ? "infonavit" : ""]
      .filter(Boolean)
      .join(" "),
  );
  const topics: string[] = [];
  const add = (topic: string, re: RegExp) => {
    if (re.test(haystack)) topics.push(topic);
  };
  add("tiempo extraordinario", /tiempo extraordinario|horas extras?|jornada/);
  add("despido", /despido|ofrecimiento de trabajo|buena fe/);
  add("carga de la prueba", /carga de la prueba/);
  add("amparo", /amparo|competencia/);
  add("confianza", /confianza|camara de diputados/);
  add("vivienda", /vivienda|azucarera/);
  add("subcontratacion", /subcontrat|repse|outsourcing/);
  add("lft", /\blft\b|ley federal del trabajo|reforma laboral/);
  add("imss", /\bimss\b|seguro social/);
  add("infonavit", /infonavit/);
  add("reforma laboral", /reforma laboral/);
  return topics;
}

function scoreCitation(citation: OfficialDigestCitation, query: OfficialDigestQuery): number {
  const haystack = normalizeMatchText(
    [query.prompt, query.documentType, ...(citation.matchedTopics ?? []), citation.title].join(" "),
  );
  const prompt = normalizeMatchText(query.prompt ?? "");
  const topics = queryTopics(query);
  let score = 0;

  for (const topic of topics) {
    const needle = normalizeMatchText(topic);
    if (citation.matchedTopics.some((item) => normalizeMatchText(item).includes(needle))) {
      score += 4;
    }
    if (normalizeMatchText(citation.title).includes(needle)) score += 3;
  }

  if (prompt) {
    if (citation.source === "scjn" && /corte|scjn|doctrina|jurisprudencia|criterio/.test(prompt)) {
      score += 2;
    }
    if (citation.source === "dof" && /dof|diario oficial|\bley\b|\blft\b/.test(prompt)) {
      score += 2;
    }
  }

  if (query.hasImssSignal && citation.matchedTopics.includes("imss")) score += 1;
  if (query.hasInfonavitSignal && citation.matchedTopics.includes("infonavit")) score += 1;
  if (haystack.includes("laboral") && citation.source === "scjn") score += 0;

  return score;
}

export function selectOfficialDigest(
  query: OfficialDigestQuery,
  options?: {
    candidates?: OfficialDigestCitation[];
    freshness?: OfficialDigestFreshness;
    liveAttempted?: boolean;
    liveBlocked?: boolean;
    limit?: number;
  },
): OfficialDigestResult {
  const liveAttempted = Boolean(options?.liveAttempted);
  const liveBlocked = Boolean(options?.liveBlocked);
  if (!shouldAttachOfficialDigest(query.prompt)) {
    return {
      citations: [],
      freshness: options?.freshness ?? (liveBlocked ? "blocked" : "last_good"),
      liveAttempted,
      liveBlocked,
      honestyNote: null,
    };
  }

  const candidates = options?.candidates ?? listLastGoodOfficialCitations();
  const scored = candidates
    .map((citation) => ({ citation, score: scoreCitation(citation, query) }))
    .filter((item) => item.score >= 3)
    .sort((left, right) => right.score - left.score)
    .slice(0, options?.limit ?? 3)
    .map((item) => item.citation);

  const unique = new Map<string, OfficialDigestCitation>();
  for (const citation of scored) {
    unique.set(`${citation.source}:${citation.officialId}`, citation);
  }
  const citations = [...unique.values()].slice(0, options?.limit ?? 3);

  const freshness =
    options?.freshness ??
    (liveBlocked && citations.length > 0 ? "last_good" : liveBlocked ? "blocked" : "last_good");

  let honestyNote: string | null = null;
  if (liveBlocked && citations.length === 0) {
    honestyNote = OFFICIAL_DIGEST_BLOCKED_COPY;
  } else if (citations.length > 0 && (freshness === "last_good" || liveBlocked)) {
    honestyNote = OFFICIAL_DIGEST_LAST_GOOD_COPY;
  }

  return {
    citations,
    freshness: citations.length === 0 && liveBlocked ? "blocked" : freshness,
    liveAttempted,
    liveBlocked,
    honestyNote,
  };
}

export function emptyOfficialDigest(liveBlocked = false): OfficialDigestResult {
  return {
    citations: [],
    freshness: liveBlocked ? "blocked" : "last_good",
    liveAttempted: liveBlocked,
    liveBlocked,
    honestyNote: liveBlocked ? OFFICIAL_DIGEST_BLOCKED_COPY : null,
  };
}

export const OFFICIAL_TITLE_SHORT_MAX = 140;

function cutSpanishSafe(value: string, maxLength: number): string {
  const normalized = value.normalize("NFC").replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  if (maxLength <= 1) return "…";
  const budget = maxLength - 1;
  let slice = normalized.slice(0, budget);
  const breakAt = Math.max(
    slice.lastIndexOf(" "),
    slice.lastIndexOf(","),
    slice.lastIndexOf(";"),
    slice.lastIndexOf(":"),
  );
  if (breakAt >= Math.floor(budget * 0.55)) {
    slice = slice.slice(0, breakAt);
  }
  return `${slice.trimEnd()}…`;
}

export function shortenOfficialTitle(title: string, maxLength = OFFICIAL_TITLE_SHORT_MAX): string {
  const normalized = title.normalize("NFC").replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  if (normalized.length <= maxLength) return normalized;
  const sentence = normalized.match(/^(.{32,}?[.。])(?:\s|$)/)?.[1];
  if (sentence && sentence.length <= maxLength) {
    return sentence;
  }
  return cutSpanishSafe(normalized, maxLength);
}

export function shortenOfficialTitlesInText(
  value: string,
  maxLength = OFFICIAL_TITLE_SHORT_MAX,
): string {
  let next = value;
  for (const title of listKnownOfficialTitles()) {
    if (title && next.includes(title)) {
      next = next.split(title).join(shortenOfficialTitle(title, maxLength));
    }
  }
  return next;
}

export function formatOfficialCitationLines(citations: OfficialDigestCitation[]): string[] {
  return citations.slice(0, 3).map((item) => shortenOfficialTitle(item.title));
}

export function stripOfficialTitlesFromText(value: string): string {
  let next = value;
  for (const title of listKnownOfficialTitles()) {
    if (title && next.includes(title)) {
      next = next.split(title).join("");
    }
    const shortened = shortenOfficialTitle(title);
    if (shortened.length >= 24 && next.includes(shortened)) {
      next = next.split(shortened).join("");
    }
  }
  next = next.replace(OFFICIAL_DIGEST_LAST_GOOD_COPY, "");
  next = next.replace(OFFICIAL_DIGEST_BLOCKED_COPY, "");
  return next.replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ").trim();
}

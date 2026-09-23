/**
 * Copy y formas de la consulta en vivo IMSS/SAT.
 * Español plano. Nunca "cumple". Nunca marcas internas en UI.
 */

export const OFFICIAL_CHECK_SOURCES = ["imss", "sat", "infonavit"] as const;
export type OfficialCheckSource = (typeof OFFICIAL_CHECK_SOURCES)[number];

export const OFFICIAL_CHECK_STATUSES = [
  "vivo",
  "pendiente",
  "no_se_pudo",
  "no_configurado",
  "sin_datos",
  "sin_permiso",
] as const;
export type OfficialCheckStatus = (typeof OFFICIAL_CHECK_STATUSES)[number];

export const OFFICIAL_CHECK_BUTTON = "Consultar IMSS y SAT";
export const OFFICIAL_CHECK_CONSENT =
  "Autorizo que pregunten a IMSS y SAT con los datos de mi recibo, solo para ver la respuesta de hoy.";

export const OFFICIAL_CHECK_STATUS_LABEL: Record<OfficialCheckStatus, string> = {
  vivo: "Vivo",
  pendiente: "Pendiente",
  no_se_pudo: "Sin respuesta",
  no_configurado: "Aún no configurado",
  sin_datos: "Faltan datos",
  sin_permiso: "Falta tu permiso",
};

export const OFFICIAL_SOURCE_LABEL: Record<OfficialCheckSource, string> = {
  imss: "IMSS",
  sat: "SAT",
  infonavit: "Infonavit",
};

export const POCKET_PARTIAL_VERDICT =
  "Aún no te podemos decir si tu patrón te tiene bien registrado.";
export const POCKET_BIEN_VERDICT =
  "Por lo que vimos hoy, tu patrón aparece en orden en lo consultado.";
export const POCKET_OJO_VERDICT =
  "Hay algo que no cuadra con lo que dice tu recibo. Conviene revisar.";
export const POCKET_COULDNT_VERDICT =
  "Hoy no se pudo comprobar. No prueba que te engañen.";
export const POCKET_CTA_MISMATCH = "Ver qué no cuadra";
export const POCKET_CTA_SAVE = "Guardar y listo";
export const POCKET_ASK = "¿Qué implica esto para mi pago?";

export const INSTITUTE_SILENCE_VERDICT = POCKET_COULDNT_VERDICT;
export const INSTITUTE_SILENCE_WHAT_HAPPENED =
  "Hoy IMSS, SAT e Infonavit no contestaron. No es un error de tu recibo.";
export const INSTITUTE_SILENCE_MEANING =
  "Tu recibo sí se leyó. Todavía no sabemos si tu patrón está bien registrado ahí. Eso no quiere decir que te estén haciendo trampa; solo que hoy no se pudo comprobar.";
export const INSTITUTE_SILENCE_NEXT =
  "Prueba de nuevo mañana. Si quieres, pregunta: «¿qué implica esto para mi pago?»";
export const INSTITUTE_SILENCE_SMALL =
  "Si algo falla al preguntar otra vez, no es por tu recibo.";
export const INSTITUTE_SILENCE_RETRY = "Probar de nuevo mañana";
export const INSTITUTE_SILENCE_ASK = POCKET_ASK;
export const INSTITUTE_SILENCE_CHAT =
  "Hoy pedimos datos a IMSS, SAT e Infonavit y no contestaron. Tu recibo ya está leído; aún no podemos decirte si tu patrón está bien dado de alta. Prueba mañana, o pregúntame qué implica para tu pago.";
/** Apertura del chat: no repite el veredicto ni las tres líneas de la tarjeta. */
export const WORKER_RESULT_CHAT_OPENER =
  "Esto es de tu consulta de hoy. Si te preocupa el sueldo, te lo explico en corto. No voy a repetir lo que ya dice la tarjeta. Dime qué duda te quedó.";
export const INSTITUTE_WAITING_HEADLINE =
  "Estamos preguntando a IMSS, SAT e Infonavit…";
export const INSTITUTE_WAITING_DETAIL =
  "Si tarda, casi siempre es la oficina, no tu recibo.";

export const OFFICIAL_FAILED_NEXT_STEP = "Vuelve a consultar mañana.";
export const OFFICIAL_FAILED_MISSING =
  "Hoy no hubo respuesta. Aún no podemos decir si tu patrón está bien dado de alta.";

const INSTITUTE_BLAME_RE =
  /el fallo es del instituto, no de auditapatr[oó]n\.?|el fallo es de ellos, no de auditapatr[oó]n\.?|no de auditapatr[oó]n/gi;

export function stripInstituteBlameCopy(value?: string | null): string {
  return String(value ?? "")
    .replace(INSTITUTE_BLAME_RE, "")
    .replace(/Falló\s*·\s*\d{1,2}\/\d{1,2}\/\d{2,4}/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([.,;])/g, "$1")
    .trim();
}

function uniqueOfficialSources(sources?: OfficialCheckSource[] | null): OfficialCheckSource[] {
  const seen = new Set<OfficialCheckSource>();
  const next: OfficialCheckSource[] = [];
  for (const source of sources ?? []) {
    if (!OFFICIAL_CHECK_SOURCES.includes(source) || seen.has(source)) continue;
    seen.add(source);
    next.push(source);
  }
  return next;
}

export function formatOfficialSourceList(sources?: OfficialCheckSource[] | null): string {
  const labels = uniqueOfficialSources(sources).map((source) => OFFICIAL_SOURCE_LABEL[source]);
  if (labels.length === 0) return "el instituto";
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} y ${labels[1]}`;
  return `${labels[0]}, ${labels[1]} e ${labels[2]}`;
}

export type InstituteSilencePresentation = {
  verdict: string;
  whatHappened: string;
  meaning: string;
  nextStep: string;
  smallPrint: string;
  retryLabel: string;
  askLabel: string;
  sourceLines: string[];
  chat: string;
  /** Apertura del chat: 3–4 frases de este caso, sin ficha técnica. */
  opener: string;
};

export function instituteSilenceVerdict(_sources?: OfficialCheckSource[] | null): string {
  return INSTITUTE_SILENCE_VERDICT;
}

export function instituteSilenceWhatHappened(sources?: OfficialCheckSource[] | null): string {
  const unique = uniqueOfficialSources(sources);
  if (unique.length === 1) return `Hoy ${OFFICIAL_SOURCE_LABEL[unique[0]]} no contestó. No es un error de tu recibo.`;
  if (unique.length === 2) {
    return `Hoy ${formatOfficialSourceList(unique)} no contestaron. No es un error de tu recibo.`;
  }
  return INSTITUTE_SILENCE_WHAT_HAPPENED;
}

export function instituteSilenceChat(sources?: OfficialCheckSource[] | null): string {
  const unique = uniqueOfficialSources(sources);
  if (unique.length === 0 || unique.length >= 3) return INSTITUTE_SILENCE_CHAT;
  return `Hoy pedimos datos a ${formatOfficialSourceList(unique)} y no contestaron. Tu recibo ya está leído; aún no podemos decirte si tu patrón está bien dado de alta. Prueba mañana, o pregúntame qué implica para tu pago.`;
}

export function instituteSilenceSourceLine(label: string): string {
  return `Hoy ${label} no contestó. No es un error de tu recibo.`;
}

export function buildInstituteSilencePresentation(
  sources?: OfficialCheckSource[] | null,
): InstituteSilencePresentation {
  const unique = uniqueOfficialSources(sources);
  const listed = unique.length > 0 ? unique : (["imss", "sat", "infonavit"] as const);
  return {
    verdict: instituteSilenceVerdict(unique),
    whatHappened: instituteSilenceWhatHappened(unique),
    meaning: INSTITUTE_SILENCE_MEANING,
    nextStep: INSTITUTE_SILENCE_NEXT,
    smallPrint: INSTITUTE_SILENCE_SMALL,
    retryLabel: INSTITUTE_SILENCE_RETRY,
    askLabel: INSTITUTE_SILENCE_ASK,
    sourceLines: listed.slice(0, 3).map((source) => instituteSilenceSourceLine(OFFICIAL_SOURCE_LABEL[source])),
    chat: instituteSilenceChat(unique),
    opener: instituteSilenceOpener(unique),
  };
}

function instituteSilenceOpener(_sources?: OfficialCheckSource[] | null): string {
  return WORKER_RESULT_CHAT_OPENER;
}

function capitalizeSpanish(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export type OfficialSourceOutcome = {
  source: OfficialCheckSource;
  status: OfficialCheckStatus;
  maintenance: boolean;
  hechos: string[];
  checkedAt: string | null;
};

export type OfficialResultPresentation = InstituteSilencePresentation & {
  kind: "silent" | "mixed" | "settled";
};

/** Línea corta bajo el veredicto. Sin fechas ni «Vivo». */
export function pocketOfficeStatusLine(live: OfficialCheckSource[], missing: OfficialCheckSource[]): string {
  const liveOrdered = OFFICIAL_CHECK_SOURCES.filter((source) => live.includes(source));
  const missingOrdered = OFFICIAL_CHECK_SOURCES.filter((source) => missing.includes(source));
  const liveBit = capitalizeSpanish(joinSpanishLabels(liveOrdered.map((source) => officialSourceWithArticle(source))));
  const verb = liveOrdered.length === 1 ? "ya respondió" : "ya respondieron";
  const missingNames = joinSpanishLabels(missingOrdered.map((source) => OFFICIAL_SOURCE_LABEL[source]));
  const falta = missingOrdered.length === 1 ? "falta" : "faltan";
  return `${liveBit} ${verb}; ${falta} ${missingNames}.`;
}

function officialSourceWithArticle(source: OfficialCheckSource): string {
  if (source === "sat") return "el SAT";
  if (source === "imss") return "el IMSS";
  return "Infonavit";
}

function joinSpanishLabels(labels: string[]): string {
  if (labels.length === 0) return "";
  if (labels.length === 1) return labels[0];
  const last = labels[labels.length - 1];
  const conj = /^i/i.test(last) ? "e" : "y";
  if (labels.length === 2) return `${labels[0]} ${conj} ${last}`;
  return `${labels.slice(0, -1).join(", ")} ${conj} ${last}`;
}

function isPendingOfficialPlaceholder(source: OfficialCheckSource, text?: string | null): boolean {
  const label = OFFICIAL_SOURCE_LABEL[source];
  return String(text ?? "").replace(/\s+/g, " ").trim() === `Todavía no hay una respuesta oficial nueva de ${label}.`;
}

const SAT_LEGAL_NAME_LINE_RE =
  /^(?:sat:\s*)?(?:raz[oó]n\s+social(?:\s+en\s+(?:el\s+)?sat)?|legal\s*name|nombre\s+fiscal)\s*[:：-]\s*(.*)$/i;
const SAT_VAULT_NAME_RE =
  /^(?:expediente|exp\.?|b[oó]veda|vault|placeholder|nombre\s+del\s+expediente)\b/i;
const SAT_EMPTY_NAME_RE =
  /^(?:sin\s+nombre|no\s+disponible|desconocido|pendiente|n\/?a|s\/n|null|undefined|none|--+|—+)$/i;

/**
 * Razón social que no se puede enseñar: vacía, igual al RFC, o el nombre
 * interno del expediente / un placeholder de bóveda. No es la razón social.
 */
export function isPlaceholderSatLegalName(value?: unknown, rfcHint?: unknown): boolean {
  const raw = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[."'\s]+|[."'\s]+$/g, "");
  if (!raw) return true;
  if (SAT_VAULT_NAME_RE.test(raw) || SAT_EMPTY_NAME_RE.test(raw)) return true;
  const compact = raw.toUpperCase().replace(/[^A-Z0-9Ñ&]/g, "");
  const hinted = normalizeRfcToken(rfcHint);
  if (hinted && compact === hinted) return true;
  const asRfc = normalizeRfcToken(raw);
  if (asRfc && (PERSON_WORKER_RFC_RE.test(asRfc) || /^[A-ZÑ&]{3}\d{6}[A-Z0-9]{3}$/.test(asRfc))) {
    return compact === asRfc;
  }
  return false;
}

export function isUnusableSatLegalNameLine(line: string, rfcHint?: unknown): boolean {
  const text = String(line ?? "").replace(/\s+/g, " ").trim();
  const match = text.match(SAT_LEGAL_NAME_LINE_RE);
  if (match) return isPlaceholderSatLegalName(match[1], rfcHint);
  const bare = text.replace(/[.\s]+$/g, "");
  return SAT_VAULT_NAME_RE.test(bare);
}

/** Hechos que sí se pueden citar. La frase de espera no es un dato del SAT. */
export function citeableOfficialHechos(source: OfficialCheckSource, hechos: string[]): string[] {
  return hechos
    .map((item) => item.replace(/\s+/g, " ").trim())
    .filter((item) => item.length > 0 && !isPendingOfficialPlaceholder(source, item))
    .filter((item) => source !== "sat" || !isUnusableSatLegalNameLine(item));
}

/** Quita siglas de proveedor. El trabajador ve el dato, no el nombre del sistema. */
export function humanizeOfficialHecho(text: string): string {
  return text
    .replace(/salario\s+rpci/gi, "salario que el IMSS tiene registrado")
    .replace(/\brpci\b/gi, "registro del IMSS")
    .replace(/\bapimarket\b/gi, "")
    .replace(/\bcomplilink\b/gi, "")
    .replace(/\bsyntage\b/gi, "")
    .replace(/\bhelios\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([:,.])/g, "$1")
    .replace(/\.{2,}/g, ".")
    .trim();
}

function usefulOfficialHechos(hechos: string[]): string[] {
  return hechos
    .map((item) => humanizeOfficialHecho(item))
    .filter((item) => item.length > 0)
    .filter((item) => !/^Todavía no hay una respuesta oficial nueva de (IMSS|SAT|Infonavit)\.$/.test(item))
    .filter((item) => !looksLikeNoOfficialResponse(item))
    .filter((item) => !looksLikeInstituteMaintenance(item))
    .filter((item) => !/faltan datos|falta tu |falta el |falta un /i.test(item))
    .filter((item) => !isUnusableSatLegalNameLine(item))
    .slice(0, 3);
}

/** El SAT está vivo solo si trajo un dato usable. El gancho vacío no cuenta. */
export function hasUsableSatResponse(hechos: string[]): boolean {
  return usefulOfficialHechos(hechos).length > 0;
}

export function sourceReportedMaintenance(parts: Array<string | null | undefined>): boolean {
  return parts.some((part) => looksLikeInstituteMaintenance(part));
}

export function silentOfficialSourceLine(label: string, maintenance: boolean): string {
  const base = instituteSilenceSourceLine(label);
  return maintenance ? `${base} Está en mantenimiento.` : base;
}

export function readOfficialSourceOutcomes(
  summary?: (Pick<OfficialCheckSummary, "checkedAt"> &
    Partial<Pick<OfficialCheckSummary, "checks" | "chatAnchor">>) | null,
): OfficialSourceOutcome[] {
  if (!summary) return [];
  const bySource = new Map<OfficialCheckSource, OfficialSourceOutcome>();
  for (const check of summary.checks ?? []) {
    const hechos = usefulOfficialHechos(check.hechos ?? []);
    const status =
      check.source === "sat" && check.status === "vivo" && hechos.length === 0 ? "no_se_pudo" : check.status;
    bySource.set(check.source, {
      source: check.source,
      status,
      maintenance: sourceReportedMaintenance([check.motivoFallo, ...(check.hechos ?? [])]),
      hechos,
      checkedAt: check.checkedAt ?? summary.checkedAt ?? null,
    });
  }
  const anchor = summary.chatAnchor;
  if (anchor) {
    for (const source of [anchor.imss, anchor.sat, anchor.infonavit]) {
      const current = bySource.get(source.fuente);
      const combinedHechos = [...source.hechos, ...(current?.hechos ?? [])];
      const satUsable = source.fuente !== "sat" || hasUsableSatResponse(combinedHechos);
      const anchorLive = source.estado === "live" && satUsable;
      const keepCurrentLive = current?.status === "vivo" && satUsable;
      const anchorFailed = source.estado === "failed" && listOfficialMissingFieldKeys(source.missingFields).length === 0;
      const emptySatHook =
        source.fuente === "sat" && !satUsable && (source.estado === "live" || current?.status === "vivo");
      const status: OfficialCheckStatus = anchorLive
        ? "vivo"
        : keepCurrentLive
          ? "vivo"
          : emptySatHook || anchorFailed
            ? "no_se_pudo"
            : (current?.status ?? "pendiente");
      const maintenance =
        sourceReportedMaintenance([source.motivoFallo, ...source.hechos]) || Boolean(current?.maintenance && status === "no_se_pudo");
      const hechos = anchorLive || keepCurrentLive
        ? usefulOfficialHechos(source.hechos.length > 0 ? source.hechos : (current?.hechos ?? []))
        : (current?.hechos ?? usefulOfficialHechos(source.hechos));
      bySource.set(source.fuente, {
        source: source.fuente,
        status,
        maintenance,
        hechos,
        checkedAt: source.fecha ?? current?.checkedAt ?? summary.checkedAt ?? null,
      });
    }
  }
  return OFFICIAL_CHECK_SOURCES.map((source) => bySource.get(source)).filter(
    (item): item is OfficialSourceOutcome => Boolean(item),
  );
}

export const LABOR_REVIEW_READY = "Ya revisamos lo laboral.";
export const RECEIPT_RECEIVED_ACK = "Recibo recibido ✓";
export const RECEIPT_VALIDATION_CORRECTION = "No pudimos validar el recibo. Intenta de nuevo.";

const LABOR_SETTLED_STATUS = new Set<OfficialCheckStatus>(["vivo", "no_se_pudo"]);

export function laborInstitutesSettled(
  summary?: Parameters<typeof readOfficialSourceOutcomes>[0],
): boolean {
  const outcomes = readOfficialSourceOutcomes(summary);
  const imss = outcomes.find((item) => item.source === "imss");
  const infonavit = outcomes.find((item) => item.source === "infonavit");
  return Boolean(
    imss &&
      infonavit &&
      LABOR_SETTLED_STATUS.has(imss.status) &&
      LABOR_SETTLED_STATUS.has(infonavit.status),
  );
}

/** Hechos del SAT que ya se pueden mostrar. Vacío mientras el SAT no contesta. */
export function liveSatFactLines(
  summary?: Parameters<typeof readOfficialSourceOutcomes>[0],
): string[] {
  const sat = readOfficialSourceOutcomes(summary).find((item) => item.source === "sat" && item.status === "vivo");
  return (sat?.hechos ?? []).slice(0, 2);
}

/**
 * Estatus del recibo. Gris (null) hasta que haya un hecho.
 * Lo laboral solo entra cuando IMSS e Infonavit ya terminaron, vivos o en silencio.
 */
export function buildReceiptEstatusLine(
  summary?: Parameters<typeof readOfficialSourceOutcomes>[0],
): string | null {
  const outcomes = readOfficialSourceOutcomes(summary);
  if (outcomes.length === 0) return null;
  const satFacts = liveSatFactLines(summary);
  const laborReady = laborInstitutesSettled(summary);
  const allSilent = outcomes.every((item) => item.status === "no_se_pudo");
  const parts: string[] = [];
  if (satFacts.length > 0) parts.push(satFacts.join(" · "));
  else if (allSilent && laborReady) parts.push("Sin respuesta hoy.");
  if (laborReady) parts.push(LABOR_REVIEW_READY);
  const line = parts.join(" ").replace(/\s+/g, " ").trim();
  return line || null;
}

function mixedOfficialChat(live: OfficialSourceOutcome[], silent: OfficialSourceOutcome[]): string {
  const liveNames = joinSpanishLabels(live.map((item) => officialSourceWithArticle(item.source)));
  const silentNames = joinSpanishLabels(silent.map((item) => OFFICIAL_SOURCE_LABEL[item.source]));
  const verb = live.length === 1 ? "contestó" : "contestaron";
  const facts = live.flatMap((item) => item.hechos.slice(0, 2).map((hecho) => `${OFFICIAL_SOURCE_LABEL[item.source]}: ${hecho}`));
  const factBit = facts.length > 0 ? ` ${facts.join(" ")}` : "";
  const still = silent.length === 1 ? "aún no contesta" : "aún no contestan";
  const maint = silent.length > 0 && silent.every((item) => item.maintenance) ? " (en mantenimiento)" : "";
  return `${liveNames.charAt(0).toUpperCase()}${liveNames.slice(1)} sí ${verb} hoy.${factBit} ${silentNames} ${still}${maint}. Tu recibo ya está leído; eso no dice si tu patrón está bien dado de alta en ${silentNames}. Prueba mañana, o pregúntame qué implica para tu pago.`;
}

function mixedOfficialPresentation(
  live: OfficialSourceOutcome[],
  silent: OfficialSourceOutcome[],
  options?: { stillWaiting?: boolean },
): OfficialResultPresentation {
  const silentNames = joinSpanishLabels(silent.map((item) => OFFICIAL_SOURCE_LABEL[item.source]));
  const sourceLines = [
    ...live.flatMap((item) => {
      const label = OFFICIAL_SOURCE_LABEL[item.source];
      const date = formatOfficialCheckDate(item.checkedAt);
      const head = date ? `${label}: Vivo · ${date}` : `${label}: Vivo`;
      return [head, ...item.hechos.map((hecho) => `${label}: ${hecho}`)];
    }),
    ...silent.map((item) => unansweredOfficialSourceLine(item)),
  ];
  return {
    kind: "mixed",
    verdict: POCKET_PARTIAL_VERDICT,
    whatHappened: pocketOfficeStatusLine(
      live.map((item) => item.source),
      silent.map((item) => item.source),
    ),
    meaning: `Tu recibo sí se leyó. Todavía no sabemos si tu patrón está bien registrado en ${silentNames}.`,
    nextStep: options?.stillWaiting ? INSTITUTE_WAITING_DETAIL : "Prueba de nuevo mañana.",
    smallPrint: INSTITUTE_SILENCE_SMALL,
    retryLabel: INSTITUTE_SILENCE_RETRY,
    askLabel: INSTITUTE_SILENCE_ASK,
    sourceLines,
    chat: mixedOfficialChat(live, silent),
    opener: WORKER_RESULT_CHAT_OPENER,
  };
}

/**
 * Veredicto por fuente. El título de las tres oficinas solo cabe si ninguna contestó.
 * Si alguna está viva, se cita. El silencio de las otras no la arrastra.
 */
function unansweredOfficialSourceLine(item: OfficialSourceOutcome): string {
  const label = OFFICIAL_SOURCE_LABEL[item.source];
  if (item.status === "pendiente") return `${label}: seguimos preguntando.`;
  if (item.status === "sin_datos") return `Falta un dato del recibo para preguntar a ${label}.`;
  return silentOfficialSourceLine(label, item.maintenance);
}

function appendAlternateRouteNote(text: string, note: string, enabled: boolean): string {
  if (!enabled || text.includes(note)) return text;
  return `${text} ${note}`.replace(/\s+/g, " ").trim();
}

function withAlternateRouteCopy(
  presentation: OfficialResultPresentation,
  enabled: boolean,
): OfficialResultPresentation {
  if (!enabled) return presentation;
  return {
    ...presentation,
    meaning: appendAlternateRouteNote(presentation.meaning, OFFICIAL_ALTERNATE_ROUTE_NOTE, true),
  };
}

function fillUnansweredWhileLive(outcomes: OfficialSourceOutcome[]): OfficialSourceOutcome[] {
  if (!outcomes.some((item) => item.status === "vivo")) return outcomes;
  const present = new Set(outcomes.map((item) => item.source));
  const missing = OFFICIAL_CHECK_SOURCES.filter((source) => !present.has(source)).map((source) => ({
    source,
    status: "pendiente" as const,
    maintenance: false,
    hechos: [] as string[],
    checkedAt: null,
  }));
  return missing.length > 0 ? [...outcomes, ...missing] : outcomes;
}

function withAlternateRouteEmptyCopy<T extends InstituteSilencePresentation>(
  presentation: T,
  enabled: boolean,
): T {
  if (!enabled) return presentation;
  return {
    ...presentation,
    meaning: appendAlternateRouteNote(presentation.meaning, OFFICIAL_ALTERNATE_ROUTE_EMPTY_NOTE, true),
  };
}

function alternateRouteContributedFacts(
  summary: { alternateRoute?: boolean | null },
  live: OfficialSourceOutcome[],
): boolean {
  return summary.alternateRoute === true && live.some((item) => item.hechos.length > 0);
}

function allThreeAnswered(outcomes: OfficialSourceOutcome[]): boolean {
  return OFFICIAL_CHECK_SOURCES.every((source) => outcomes.some((item) => item.source === source && item.status === "vivo"));
}

function settledOfficialPresentation(
  resultado: ReciboVsOficialResultado | null,
  outcomes: OfficialSourceOutcome[],
): OfficialResultPresentation {
  const watch = resultado === "hay_diferencia";
  const fine = resultado === "bien";
  const sourceLines = outcomes.flatMap((item) => {
    const label = OFFICIAL_SOURCE_LABEL[item.source];
    const date = formatOfficialCheckDate(item.checkedAt);
    const head = date ? `${label}: Vivo · ${date}` : `${label}: Vivo`;
    return [head, ...item.hechos.map((hecho) => `${label}: ${hecho}`)];
  });
  if (watch) {
    return {
      kind: "settled",
      verdict: POCKET_OJO_VERDICT,
      whatHappened: "Hay una diferencia entre tu recibo y lo que contestaron las oficinas.",
      meaning: "Conviene mirar el detalle antes de sacar conclusiones. No quiere decir que te estén engañando.",
      nextStep: "Abre el detalle y anota lo que no cuadra.",
      smallPrint: INSTITUTE_SILENCE_SMALL,
      retryLabel: POCKET_CTA_MISMATCH,
      askLabel: POCKET_ASK,
      sourceLines,
      chat: `${POCKET_OJO_VERDICT} ${POCKET_ASK}`,
      opener: WORKER_RESULT_CHAT_OPENER,
    };
  }
  if (fine) {
    return {
      kind: "settled",
      verdict: POCKET_BIEN_VERDICT,
      whatHappened: "IMSS, SAT e Infonavit contestaron y lo comparado cuadra con tu recibo.",
      meaning: "Esto es lo que se vio hoy en lo consultado. No dice que todo tu trabajo esté en orden.",
      nextStep: "Puedes guardar este resultado.",
      smallPrint: INSTITUTE_SILENCE_SMALL,
      retryLabel: POCKET_CTA_SAVE,
      askLabel: POCKET_ASK,
      sourceLines,
      chat: `${POCKET_BIEN_VERDICT} ${POCKET_ASK}`,
      opener: WORKER_RESULT_CHAT_OPENER,
    };
  }
  return {
    kind: "settled",
    verdict: POCKET_COULDNT_VERDICT,
    whatHappened: "Las oficinas contestaron, pero hoy no alcanzó para comprobar tu registro.",
    meaning: "No prueba que te engañen. Solo que hoy no se pudo cerrar la comparación.",
    nextStep: "Prueba de nuevo mañana.",
    smallPrint: INSTITUTE_SILENCE_SMALL,
    retryLabel: INSTITUTE_SILENCE_RETRY,
    askLabel: POCKET_ASK,
    sourceLines,
    chat: `${POCKET_COULDNT_VERDICT} ${POCKET_ASK}`,
    opener: WORKER_RESULT_CHAT_OPENER,
  };
}

export function buildHonestOfficialPresentation(
  summary?: (Pick<OfficialCheckSummary, "overallStatus" | "checkedAt"> &
    Partial<Pick<OfficialCheckSummary, "checks" | "chatAnchor" | "alternateRoute" | "reciboVsOficial">>) | null,
): OfficialResultPresentation | null {
  if (!summary) return null;
  const outcomes = fillUnansweredWhileLive(readOfficialSourceOutcomes(summary));
  const live = outcomes.filter((item) => item.status === "vivo");
  const silent = outcomes.filter((item) => item.status === "no_se_pudo");
  const waiting = outcomes.filter((item) => item.status === "pendiente" || item.status === "sin_datos");
  if (allThreeAnswered(outcomes)) {
    return withAlternateRouteCopy(
      settledOfficialPresentation(summary.reciboVsOficial?.resultado ?? null, outcomes),
      alternateRouteContributedFacts(summary, outcomes.filter((item) => item.status === "vivo")),
    );
  }
  if (live.length > 0 && (silent.length > 0 || waiting.length > 0)) {
    const unanswered = OFFICIAL_CHECK_SOURCES.flatMap((source) => {
      const match = [...silent, ...waiting].find((item) => item.source === source);
      return match ? [match] : [];
    });
    const presentation = mixedOfficialPresentation(live, unanswered, {
      stillWaiting: waiting.length > 0 && silent.length === 0,
    });
    return withAlternateRouteCopy(presentation, alternateRouteContributedFacts(summary, live));
  }
  if (live.length > 0 || outcomes.some((item) => item.status === "pendiente" || item.status === "sin_datos")) {
    return null;
  }
  if (summary.overallStatus !== "no_se_pudo" && silent.length === 0) return null;
  const silentSources = silent.map((item) => item.source);
  const base = buildInstituteSilencePresentation(silentSources);
  const lines =
    silent.length > 0
      ? silent.map((item) => silentOfficialSourceLine(OFFICIAL_SOURCE_LABEL[item.source], item.maintenance))
      : base.sourceLines;
  return withAlternateRouteEmptyCopy(
    { ...base, kind: "silent", sourceLines: lines },
    summary.alternateRoute === true,
  );
}

/** Qué pasó cuando la oficina no contestó. Sin culpar a la app y sin la palabra Falló. */
export function buildOfficialFailedDetail(sources?: OfficialCheckSource[] | null): string {
  return instituteSilenceWhatHappened(sources);
}

export function buildOfficialMaintenanceDetail(sources?: OfficialCheckSource[] | null): string {
  const unique = uniqueOfficialSources(sources);
  if (unique.length === 0) {
    return "Pedimos la información y la oficina está en mantenimiento. Puedes intentar más tarde.";
  }
  const who = formatOfficialSourceList(unique);
  if (unique.length === 1) {
    return `Pedimos la información a ${who} y está en mantenimiento. Puedes intentar más tarde.`;
  }
  return `Pedimos la información a ${who} y están en mantenimiento. Puedes intentar más tarde.`;
}

export function buildOfficialFailedMotivo(
  source: OfficialCheckSource,
  kind: "timeout" | "mantenimiento" | "generic" = "generic",
): string {
  const name = OFFICIAL_SOURCE_LABEL[source];
  if (kind === "mantenimiento") return `El ${name} está en mantenimiento.`;
  return `El ${name} no contestó hoy.`;
}

export function looksLikeInstituteMaintenance(text?: string | null): boolean {
  return /mantenimiento/i.test(String(text ?? ""));
}

export function rewriteOfficialFailedMotivo(
  source: OfficialCheckSource,
  text?: string | null,
): string {
  if (looksLikeInstituteMaintenance(text)) {
    return buildOfficialFailedMotivo(source, "mantenimiento");
  }
  return buildOfficialFailedMotivo(source, looksLikeNoOfficialResponse(text) ? "timeout" : "generic");
}

export function rewriteOfficialFailedHechos(
  source: OfficialCheckSource,
  hechos: string[],
): string[] {
  if (hechos.length === 0) return [buildOfficialFailedMotivo(source)];
  return hechos.map((item) =>
    looksLikeNoOfficialResponse(item) || looksLikeInstituteMaintenance(item)
      ? rewriteOfficialFailedMotivo(source, item)
      : item,
  );
}

export function listFailedOfficialSources(
  checks?: Array<{ source: OfficialCheckSource; status: OfficialCheckStatus }> | null,
): OfficialCheckSource[] {
  return uniqueOfficialSources(
    (checks ?? []).filter((item) => item.status === "no_se_pudo").map((item) => item.source),
  );
}

export function listFailedOfficialSourcesFromAnchor(
  anchor?: OfficialChatAnchor | null,
): OfficialCheckSource[] {
  if (!anchor) return [];
  return uniqueOfficialSources(
    (["imss", "sat", "infonavit"] as const).filter((source) => {
      const item = anchor[source];
      return item.estado === "failed" && listOfficialMissingFieldKeys(item.missingFields).length === 0;
    }),
  );
}

/** Reescribe un resultado sin respuesta para decir qué pasó, sin culpar a la app. */
export function honestOfficialFailedDetail(
  summary?: Pick<OfficialCheckSummary, "overallStatus" | "overallDetail" | "checks" | "chatAnchor"> | null,
): string {
  if (!summary || summary.overallStatus !== "no_se_pudo") {
    return summary?.overallDetail ?? buildOfficialFailedDetail();
  }
  const fromChecks = listFailedOfficialSources(summary.checks);
  const fromAnchor = listFailedOfficialSourcesFromAnchor(summary.chatAnchor);
  return buildOfficialFailedDetail(fromChecks.length > 0 ? fromChecks : fromAnchor);
}

export const OFFICIAL_CHECK_STATUS_DETAIL: Record<OfficialCheckStatus, string> = {
  vivo: "Esto respondió el instituto hoy. No significa que tu patrón cumple.",
  pendiente: "Todavía no hay una respuesta oficial nueva. Inténtalo más tarde.",
  no_se_pudo: buildOfficialFailedDetail(),
  no_configurado: "Aún no configurado. Por ahora solo leemos tus papeles.",
  sin_datos: "Falta tu NSS, CURP o RFC en el recibo para consultar.",
  sin_permiso: "Falta tu permiso para consultar IMSS y SAT.",
};

export type OfficialIdentityFlags = {
  nss: boolean;
  curp: boolean;
  rfc: boolean;
};

export const GENERIC_SAT_RFCS = ["XAXX010101000", "XEXX010101000"] as const;

export function isGenericSatRfc(value?: unknown): boolean {
  const normalized = String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9Ñ&]/g, "");
  return (GENERIC_SAT_RFCS as readonly string[]).includes(normalized);
}

export function looksLikeOfficialNss(value?: unknown): boolean {
  if (typeof value !== "string" && typeof value !== "number") return false;
  const digits = String(value).replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 11;
}

export function looksLikeOfficialCurp(value?: unknown): boolean {
  return /^[A-Z]{4}\d{6}[A-Z]{6}[0-9A-Z]{2}$/i.test(String(value ?? "").trim());
}

const PERSON_WORKER_RFC_RE = /^[A-ZÑ&]{4}\d{6}[A-Z0-9]{3}$/;
const GENERIC_SAT_RFC_SCAN_RE = /\b(XAXX010101000|XEXX010101000)\b/;

function collectRfcHaystacks(value: unknown, into: string[], depth = 0) {
  if (depth > 5 || value == null) return;
  if (typeof value === "string" || typeof value === "number") {
    const text = String(value).trim();
    if (text) into.push(text);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectRfcHaystacks(item, into, depth + 1);
    return;
  }
  if (typeof value === "object") {
    for (const item of Object.values(value as Record<string, unknown>)) {
      collectRfcHaystacks(item, into, depth + 1);
    }
  }
}

export function normalizeRfcToken(value?: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const normalized = String(value).trim().toUpperCase().replace(/[^A-Z0-9Ñ&]/g, "");
  if (normalized.length < 12 || normalized.length > 13) return null;
  return normalized;
}

/** RFC de persona (13). No cuenta el del patrón ni XAXX/XEXX. */
export function pickPersonWorkerRfc(values: unknown[], employerRfc?: unknown): string | null {
  const employer = normalizeRfcToken(employerRfc);
  const haystacks: string[] = [];
  for (const value of values) collectRfcHaystacks(value, haystacks);
  const found: string[] = [];
  for (const raw of haystacks) {
    const direct = normalizeRfcToken(raw);
    if (direct && PERSON_WORKER_RFC_RE.test(direct)) found.push(direct);
    const scan = /\b([A-ZÑ&]{4}\d{6}[A-Z0-9]{3})\b/g;
    const upper = raw.toUpperCase();
    let match: RegExpExecArray | null;
    while ((match = scan.exec(upper))) {
      found.push(match[1]);
    }
  }
  for (const token of found) {
    if (!PERSON_WORKER_RFC_RE.test(token) || isGenericSatRfc(token)) continue;
    if (employer && token === employer) continue;
    return token;
  }
  return null;
}

/** Conserva XAXX/XEXX para poder pedir un RFC de persona. Si hay persona, esa gana. */
export function resolveBriefingWorkerRfc(values: unknown[], employerRfc?: unknown): string | null {
  const person = pickPersonWorkerRfc(values, employerRfc);
  if (person) return person;
  const haystacks: string[] = [];
  for (const value of values) collectRfcHaystacks(value, haystacks);
  for (const raw of haystacks) {
    const direct = normalizeRfcToken(raw);
    if (direct && isGenericSatRfc(direct)) return direct;
    const embedded = raw.toUpperCase().match(GENERIC_SAT_RFC_SCAN_RE);
    if (embedded?.[1]) return embedded[1];
  }
  return null;
}

export function looksLikeRealWorkerRfc(value?: unknown, employerRfc?: unknown): boolean {
  return Boolean(pickPersonWorkerRfc([value], employerRfc));
}

/** RFC de 12 o 13 que no es XAXX/XEXX. Sirve para reconocer el del patrón. */
function looksLikeNonGenericRfc(value?: unknown): boolean {
  const token = normalizeRfcToken(value);
  return Boolean(token && !isGenericSatRfc(token));
}

/** IMSS=NSS, SAT=RFC real (XAXX no cuenta), Infonavit=CURP. */
export function identityFlagsFromReceiptValues(values?: {
  nss?: unknown;
  curp?: unknown;
  rfc?: unknown;
  workerRfc?: unknown;
  employerRfc?: unknown;
} | null): OfficialIdentityFlags {
  return {
    nss: looksLikeOfficialNss(values?.nss),
    curp: looksLikeOfficialCurp(values?.curp),
    rfc: Boolean(
      pickPersonWorkerRfc([values?.workerRfc, values?.rfc], values?.employerRfc),
    ),
  };
}

const GENERIC_MISSING_IDENTITY_RE =
  /falta(?:n)?\s+(?:tu\s+)?nss[,/]?\s*curp\s+(y|o)\s+rfc/i;
const FALTA_NSS_RE = /falta(?:n)?[^.]{0,48}\bnss\b|\bnss\b[^.]{0,48}falta/i;
const FALTA_RFC_RE = /falta(?:n)?[^.]{0,48}\brfc\b|\brfc\b[^.]{0,48}falta/i;

export function textContradictsVisibleReceiptIdentity(
  text?: string | null,
  identity?: OfficialIdentityFlags | null,
): boolean {
  const haystack = String(text ?? "");
  if (!haystack) return false;
  if (identity?.nss && (GENERIC_MISSING_IDENTITY_RE.test(haystack) || FALTA_NSS_RE.test(haystack))) {
    return true;
  }
  if (identity?.rfc && FALTA_RFC_RE.test(haystack) && !isGenericSatRfc(haystack)) {
    return true;
  }
  return false;
}

export function rewriteOfficialIdentityHechos(
  source: OfficialCheckSource,
  hechos: string[],
  identity?: OfficialIdentityFlags | null,
): string[] {
  const label = OFFICIAL_SOURCE_LABEL[source];
  const pending = `Todavía no hay una respuesta oficial nueva de ${label}.`;
  const next = hechos.map((item) => {
    if (!textContradictsVisibleReceiptIdentity(item, identity)) return item;
    if (source === "sat" && !identity?.rfc) return officialSourceGapDetail("sat");
    if (source === "imss" && identity?.nss) return pending;
    if (source === "sat" && identity?.rfc) return pending;
    if (source === "infonavit") return officialSourceGapDetail("infonavit");
    return pending;
  });
  const cleaned = (next.length > 0 ? next : [pending]).map((item) => humanizeOfficialHecho(item)).filter((item) => item.length > 0);
  return cleaned.length > 0 ? cleaned : [pending];
}

export function stripContradictoryMissingIdentityCopy(
  text: string,
  identity?: OfficialIdentityFlags | null,
  facts?: { nss?: unknown; workerRfc?: unknown; rfc?: unknown; employerRfc?: unknown } | null,
): string {
  const nssVisible = Boolean(identity?.nss) || looksLikeOfficialNss(facts?.nss);
  const rfcVisible =
    Boolean(identity?.rfc) ||
    looksLikeRealWorkerRfc(facts?.workerRfc ?? facts?.rfc, facts?.employerRfc);
  if (!nssVisible && !rfcVisible) return text;
  let next = text;
  if (nssVisible) {
    next = next
      .replace(/IMSS y SAT:\s*Faltan datos(?:\s*·\s*\d{2}\/\d{2}\/\d{4})?/gi, "IMSS: Pendiente")
      .replace(/Falta tu NSS, CURP y RFC en el recibo para consultar\.?/gi, "")
      .replace(/Falta tu NSS y RFC en el recibo para consultar\.?/gi, "")
      .replace(/Falta tu NSS(?: y CURP)?(?: y RFC)? en el recibo para consultar\.?/gi, "")
      .replace(/Falta tu NSS\b/gi, "Tu NSS ya aparece en el recibo");
  }
  if (rfcVisible) {
    next = next
      .replace(/Falta tu RFC en el recibo para consultar\.?/gi, "")
      .replace(/[^.!\n]*RFC real[^.!\n]*[.!?]?/gi, "")
      .replace(/[^.!\n]*Falta un RFC[^.!\n]*[.!?]?/gi, "");
  }
  return next.replace(/[ \t]{2,}/g, " ").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

export const OFFICIAL_CHAT_ANCHOR_STATES = ["live", "pending", "failed"] as const;
export type OfficialChatAnchorEstado = (typeof OFFICIAL_CHAT_ANCHOR_STATES)[number];

export type OfficialChatAnchorSource = {
  fuente: OfficialCheckSource;
  estado: OfficialChatAnchorEstado;
  fecha: string | null;
  hechos: string[];
  motivoFallo: string | null;
  missingFields?: string[];
};

export type OfficialChatAnchor = {
  sat: OfficialChatAnchorSource;
  imss: OfficialChatAnchorSource;
  infonavit: OfficialChatAnchorSource;
};

export const RECIBO_VS_OFICIAL_RESULTS = ["bien", "hay_diferencia", "no_se_pudo"] as const;
export type ReciboVsOficialResultado = (typeof RECIBO_VS_OFICIAL_RESULTS)[number];

export type ReciboVsOficialCampo = {
  campo: string;
  recibo?: string | null;
  oficial?: string | null;
  resultado: ReciboVsOficialResultado;
};

export type ReciboVsOficial = {
  resultado: ReciboVsOficialResultado;
  motivo: string;
  campos?: ReciboVsOficialCampo[];
};

export const RECEIPT_OFFICIAL_COMPARISON_SEEN_LABEL: Record<ReciboVsOficialResultado, string> = {
  bien: "bien",
  hay_diferencia: "hay diferencia",
  no_se_pudo: "no se pudo",
};

/** Misma fuente de verdad: tarjeta + chat. Nunca inventar «cumple». */
export const RECEIPT_OFFICIAL_COMPARISON_COPY = {
  bien: {
    seenLine: "Esto vimos: bien",
    nextStep: "Guarda este resultado con la fecha.",
  },
  hay_diferencia: {
    seenLine: "Esto vimos: hay diferencia",
    nextStep: "Anota periodo y montos y pide aclaración por escrito a patrón o RH.",
  },
  no_se_pudo: {
    seenLine: "Esto vimos: no se pudo",
    nextStep: "Da permiso, revisa NSS, CURP y RFC, y pulsa Consultar IMSS y SAT otra vez.",
    instituteNextStep: INSTITUTE_SILENCE_NEXT,
  },
} as const;

export const ADVISOR_CHAT_NEVER_INVENT = ["cumple", "alta vigente", "salario oficial"] as const;

export type OfficialSourceCheck = {
  source: OfficialCheckSource;
  sourceLabel: string;
  status: OfficialCheckStatus;
  label: string;
  detail: string;
  checkedAt: string | null;
  used: OfficialIdentityFlags;
  honesty?: OfficialChatAnchorEstado | null;
  hechos?: string[];
  motivoFallo?: string | null;
  missingFields?: string[];
};

/** Salario o patrón que el retorno ya trae. No cambia el estado a Vivo. */
export type InstitutePayFacts = {
  salary: string | null;
  employer: string | null;
  employerRfc: string | null;
  days: string | null;
};

const INSTITUTE_PAY_TEXT = /\brpci\b|salario que el IMSS tiene registrado|registro del IMSS/i;
const STRUCTURED_SALARY_KEYS = new Set(["salariobase", "salariobasecotizacion", "sbc", "salariobasecotapor"]);
const STRUCTURED_RFC_KEYS = new Set(["rfcpatron"]);
const STRUCTURED_NAME_KEYS = new Set(["razonsocial", "nombrepatron"]);

function compactInstituteKey(value: string) {
  return value.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function moneyFromInstituteText(text: string): string | null {
  const match = text.match(/\$\s?\d[\d,]*(?:\.\d{2,4})?/) ?? text.match(/\b\d{1,6}(?:,\d{3})*(?:\.\d{2,4})\b/);
  if (!match) return null;
  const raw = match[0].replace(/\s+/g, "");
  return raw.startsWith("$") ? raw : `$${raw}`;
}

function moneyFromUnknown(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (typeof value !== "string") return null;
  return moneyFromInstituteText(value.trim());
}

function employerFromInstituteText(text: string): string | null {
  const match = text.match(
    /(?<!rfc del )(?:patr[oó]n|raz[oó]n\s+social|empresa)\s*(?:rpci|registro del IMSS)?\s*[:\-]\s*([^;\n]{3,160})/i,
  );
  if (!match?.[1]) return null;
  const cleaned = match[1]
    .replace(/\brpci\b/gi, "")
    .replace(/registro del IMSS/gi, "")
    .replace(/\s+/g, " ")
    .replace(/[;]+$/g, "")
    .trim();
  if (cleaned.length < 3 || /^\$?\d/.test(cleaned)) return null;
  if (/^rfc\b/i.test(cleaned)) return null;
  return cleaned;
}

function rfcFromInstituteText(text: string): string | null {
  return text.match(/rfc del patr[oó]n:\s*([A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3})/i)?.[1]?.toUpperCase() ?? null;
}

function daysFromInstituteText(text: string): string | null {
  return text.match(/d[ií]as cotizados[^:]*:\s*(\d{1,4})\b/i)?.[1] ?? null;
}

function absorbInstituteText(target: InstitutePayFacts, text: string, allowContractSentence: boolean) {
  const marked = INSTITUTE_PAY_TEXT.test(text);
  if (!marked && !allowContractSentence) return;
  if (!target.salary && /salario|sueldo|\$\s?\d|\d+\.\d{2}/i.test(text)) {
    const labeled = text.match(/salario registrado:\s*(\$?\s?\d[\d,]*(?:\.\d{2,4})?)/i)?.[1];
    target.salary = moneyFromInstituteText(labeled ?? text);
  }
  if (!target.employerRfc) target.employerRfc = rfcFromInstituteText(text);
  if (!target.employer) target.employer = employerFromInstituteText(text);
  if (!target.days) target.days = daysFromInstituteText(text);
}

function emptyInstitutePay(): InstitutePayFacts {
  return { salary: null, employer: null, employerRfc: null, days: null };
}

function institutePayHasFact(facts: InstitutePayFacts) {
  return Boolean(facts.salary || facts.employer || facts.employerRfc || facts.days);
}

/**
 * Lee salario base, RFC del patrón y razón social solo si el retorno ya los trae.
 * Un sueldo suelto, sin ese hecho, no cuenta y no vuelve el estado Vivo.
 */
export function readInstitutePayFacts(value: unknown): InstitutePayFacts | null {
  const found = emptyInstitutePay();
  const walk = (node: unknown, depth: number, fromImss: boolean) => {
    if (depth > 10 || node == null) return;
    if (typeof node === "string") {
      absorbInstituteText(found, node, false);
      return;
    }
    if (typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item, depth + 1, fromImss);
      return;
    }
    const record = node as Record<string, unknown>;
    const keys = Object.keys(record);
    const compact = new Set(keys.map(compactInstituteKey));
    const product = String(record.sourceProduct ?? record.source_product ?? "");
    const source = String(record.source ?? record.fuente ?? "").toLowerCase();
    const imssNode = fromImss || source === "imss";
    const structured =
      /rpci/i.test(product) ||
      ([...STRUCTURED_SALARY_KEYS].some((key) => compact.has(key)) &&
        (imssNode || compact.has("rfcpatron") || compact.has("razonsocial") || compact.has("nombrepatron")));
    if (structured) {
      for (const [key, raw] of Object.entries(record)) {
        const name = compactInstituteKey(key);
        if (!found.salary && STRUCTURED_SALARY_KEYS.has(name)) found.salary = moneyFromUnknown(raw);
        if (!found.employerRfc && STRUCTURED_RFC_KEYS.has(name) && typeof raw === "string") {
          found.employerRfc = raw.trim().toUpperCase() || null;
        }
        if (!found.employer && STRUCTURED_NAME_KEYS.has(name) && typeof raw === "string") {
          const cleaned = raw.trim();
          if (cleaned.length >= 3) found.employer = cleaned;
        }
        if (!found.days && name === "dias" && /^\d{1,4}$/.test(String(raw).trim())) found.days = String(raw).trim();
      }
    }
    const status = String(record.status ?? record.resultado ?? "").toLowerCase();
    const honesty = String(record.honesty ?? record.estado ?? "").toLowerCase();
    const live = status === "vivo" || status === "live" || honesty === "live";
    if (imssNode && Array.isArray(record.hechos)) {
      for (const item of record.hechos) {
        if (typeof item === "string") absorbInstituteText(found, item, live || structured);
      }
    }
    for (const [key, child] of Object.entries(record)) {
      if (key === "hechos" && imssNode) continue;
      walk(child, depth + 1, imssNode || compactInstituteKey(key) === "imss");
    }
  };
  walk(value, 0, false);
  return institutePayHasFact(found) ? found : null;
}

export type OfficialCheckSummary = {
  configured: boolean;
  consentGranted: boolean;
  overallStatus: OfficialCheckStatus;
  overallLabel: string;
  overallDetail: string;
  checkedAt: string | null;
  identity: OfficialIdentityFlags;
  checks: OfficialSourceCheck[];
  chatAnchor?: OfficialChatAnchor | null;
  reciboVsOficial?: ReciboVsOficial | null;
  /** El puente rechazó la consulta por el tope de un proveedor. No es silencio de IMSS, SAT o Infonavit. */
  bridgeBlock?: "provider_cap" | null;
  /** Otra consulta oficial aportó hechos. Solo si el retorno lo dice. */
  alternateRoute?: boolean | null;
  /** Presente solo cuando el retorno ya trae salario o patrón del registro. Nunca inventa el estado. */
  institutePay?: InstitutePayFacts | null;
};

export type OfficialIdentityField = keyof OfficialIdentityFlags;

/** IMSS consulta con NSS; SAT con RFC; Infonavit con CURP. No se piden los tres en cada fuente. */
export const OFFICIAL_SOURCE_REQUIRED_FIELDS: Record<OfficialCheckSource, OfficialIdentityField[]> = {
  imss: ["nss"],
  sat: ["rfc"],
  infonavit: ["curp"],
};

export function listOfficialMissingFieldKeys(values?: unknown): string[] {
  if (!Array.isArray(values)) return [];
  const keys: string[] = [];
  for (const item of values) {
    const compact = String(item ?? "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
    if (!compact) continue;
    if ((compact === "nss" || compact.includes("nss") || compact.includes("numseguridad")) && !keys.includes("nss")) {
      keys.push("nss");
    } else if ((compact === "curp" || compact.includes("curp")) && !keys.includes("curp")) {
      keys.push("curp");
    } else if ((compact === "rfc" || compact.includes("rfc")) && !keys.includes("rfc")) {
      keys.push("rfc");
    }
  }
  return keys;
}

export function sourceHasRequiredOfficialIdentity(
  source: OfficialCheckSource,
  identity?: OfficialIdentityFlags | null,
): boolean {
  return OFFICIAL_SOURCE_REQUIRED_FIELDS[source].some((key) => Boolean(identity?.[key]));
}

export function missingOfficialFieldsForSource(
  source: OfficialCheckSource,
  identity?: OfficialIdentityFlags | null,
): OfficialIdentityField[] {
  return OFFICIAL_SOURCE_REQUIRED_FIELDS[source].filter((key) => !identity?.[key]);
}

export function usedOfficialIdentityForSource(
  source: OfficialCheckSource,
  identity?: OfficialIdentityFlags | null,
): OfficialIdentityFlags {
  return {
    nss: source === "imss" && Boolean(identity?.nss),
    curp: source === "infonavit" && Boolean(identity?.curp),
    rfc: source === "sat" && Boolean(identity?.rfc),
  };
}

/** IMSS/SAT se despachan con NSS y/o RFC. CURP no bloquea el panel entero. */
export function canDispatchOfficialConsult(identity?: OfficialIdentityFlags | null): boolean {
  return Boolean(identity?.nss || identity?.rfc);
}

export function mergeOfficialIdentityFlags(
  ...identities: Array<OfficialIdentityFlags | null | undefined>
): OfficialIdentityFlags {
  return {
    nss: identities.some((item) => item?.nss),
    curp: identities.some((item) => item?.curp),
    rfc: identities.some((item) => item?.rfc),
  };
}

export const FALTA_NSS_Y_RFC_EXACT = "Falta tu NSS y RFC en el recibo para consultar.";
export const OFFICIAL_PENDING_STALE_MS = 60_000;

export function isStaleOfficialPending(
  checkedAt?: string | null,
  nowMs: number = Date.now(),
  extra?: { anchorFecha?: string | null; pendingSinceMs?: number | null },
): boolean {
  const times: number[] = [];
  for (const value of [checkedAt, extra?.anchorFecha]) {
    if (!value) continue;
    const at = new Date(value).getTime();
    if (Number.isFinite(at)) times.push(at);
  }
  if (typeof extra?.pendingSinceMs === "number" && Number.isFinite(extra.pendingSinceMs)) {
    times.push(extra.pendingSinceMs);
  }
  if (times.length === 0) return false;
  return nowMs - Math.min(...times) > OFFICIAL_PENDING_STALE_MS;
}

export function officialDispatchGapDetail(
  identity?: OfficialIdentityFlags | null,
  facts?: { nss?: unknown; workerRfc?: unknown; rfc?: unknown; employerRfc?: unknown } | null,
): string {
  const nssVisible = Boolean(identity?.nss) || looksLikeOfficialNss(facts?.nss);
  const rfcVisible =
    Boolean(identity?.rfc) ||
    looksLikeRealWorkerRfc(facts?.workerRfc ?? facts?.rfc, facts?.employerRfc);
  const missing: string[] = [];
  if (!nssVisible) missing.push("NSS");
  if (!rfcVisible) missing.push("RFC");
  if (missing.length === 0) return OFFICIAL_CHECK_STATUS_DETAIL.sin_datos;
  if (nssVisible && !rfcVisible) {
    if (isGenericSatRfc(facts?.workerRfc ?? facts?.rfc)) {
      return "El RFC del recibo es genérico; SAT necesita un RFC real para consultar.";
    }
    return officialSourceGapDetail("sat", facts);
  }
  if (missing.length === 1) return `Falta tu ${missing[0]} en el recibo para consultar.`;
  return FALTA_NSS_Y_RFC_EXACT;
}

export function officialSourceGapDetail(
  source: OfficialCheckSource,
  facts?: { workerRfc?: unknown; rfc?: unknown; employerRfc?: unknown } | null,
): string {
  if (source === "sat") {
    if (looksLikeRealWorkerRfc(facts?.workerRfc ?? facts?.rfc)) {
      return OFFICIAL_CHECK_STATUS_DETAIL.pendiente;
    }
    if (
      looksLikeNonGenericRfc(facts?.employerRfc) &&
      !looksLikeRealWorkerRfc(facts?.workerRfc ?? facts?.rfc, facts?.employerRfc)
    ) {
      return "Falta el RFC de la persona trabajadora para consultar SAT.";
    }
    return "Falta un RFC real en el recibo para consultar SAT.";
  }
  const field = OFFICIAL_SOURCE_REQUIRED_FIELDS[source][0];
  const label = field === "nss" ? "NSS" : field === "curp" ? "CURP" : "RFC";
  return `Falta tu ${label} en el recibo para consultar.`;
}

export function rollupOfficialCheckStatus(statuses: OfficialCheckStatus[]): OfficialCheckStatus {
  if (statuses.includes("vivo")) return "vivo";
  if (statuses.length > 0 && statuses.every((status) => status === "no_configurado")) return "no_configurado";
  if (statuses.length > 0 && statuses.every((status) => status === "sin_datos")) return "sin_datos";
  if (statuses.length > 0 && statuses.every((status) => status === "sin_permiso")) return "sin_permiso";
  if (statuses.includes("pendiente")) return "pendiente";
  if (statuses.includes("no_se_pudo")) return "no_se_pudo";
  return statuses[0] ?? "no_se_pudo";
}

function officialConsultAttempted(summary: OfficialCheckSummary): boolean {
  if (isPermissionBlockedStatus(summary.overallStatus) && !summary.checkedAt && !summary.chatAnchor) {
    return false;
  }
  return Boolean(summary.checkedAt || summary.chatAnchor || summary.reciboVsOficial);
}

function demoteFalseIdentityFailure(
  source: OfficialCheckSource,
  status: OfficialCheckStatus,
  identity: OfficialIdentityFlags,
  reportedMissing: unknown,
  failText?: string | null,
): OfficialCheckStatus {
  if (!sourceHasRequiredOfficialIdentity(source, identity)) return status;
  if (status !== "no_se_pudo" && status !== "sin_datos") return status;
  if (looksLikeNoOfficialResponse(failText) || looksLikeInstituteMaintenance(failText)) {
    return status === "sin_datos" ? "no_se_pudo" : status;
  }
  const leftover = filterOfficialMissingFieldsForSource(source, reportedMissing, identity);
  if (leftover.length > 0) return "sin_datos";
  if (textContradictsVisibleReceiptIdentity(failText, identity) || listOfficialMissingFieldKeys(reportedMissing).length > 0) {
    return "pendiente";
  }
  return status === "sin_datos" ? "pendiente" : status;
}

function sourceFromAnchor(
  fuente: OfficialCheckSource,
  anchor: OfficialChatAnchorSource,
  identity: OfficialIdentityFlags,
  facts?: { workerRfc?: unknown; rfc?: unknown; employerRfc?: unknown } | null,
): OfficialSourceCheck {
  const missing = filterOfficialMissingFieldsForSource(fuente, anchor.missingFields, identity);
  const mapped =
    honestyToOfficialStatus(anchor.estado, missing, identity, fuente) ??
    (sourceHasRequiredOfficialIdentity(fuente, identity) ? "pendiente" : "sin_datos");
  const demoted = demoteFalseIdentityFailure(
    fuente,
    mapped,
    identity,
    anchor.missingFields,
    `${anchor.motivoFallo ?? ""} ${anchor.hechos.join(" ")}`,
  );
  const emptySatHook = fuente === "sat" && !hasUsableSatResponse(anchor.hechos) && (demoted === "vivo" || anchor.estado === "live");
  const status = emptySatHook ? "no_se_pudo" : demoted;
  return {
    source: fuente,
    sourceLabel: OFFICIAL_SOURCE_LABEL[fuente],
    status,
    label: OFFICIAL_CHECK_STATUS_LABEL[status],
    detail:
      status === "sin_datos"
        ? officialSourceGapDetail(fuente, facts)
        : status === "no_se_pudo"
          ? rewriteOfficialFailedMotivo(fuente, anchor.motivoFallo)
          : OFFICIAL_CHECK_STATUS_DETAIL[status],
    checkedAt: anchor.fecha,
    used: usedOfficialIdentityForSource(fuente, identity),
    honesty: officialStatusToHonesty(status),
    hechos: anchor.hechos,
    motivoFallo: anchor.motivoFallo,
    missingFields: missingOfficialFieldsForSource(fuente, identity),
  };
}

export type CardOfficialCheckSnapshot = {
  overallStatus: OfficialCheckStatus;
  checkedAt?: string | null;
  identity: OfficialIdentityFlags;
  checks?: Array<{
    source: OfficialCheckSource;
    status: OfficialCheckStatus;
    checkedAt?: string | null;
    detail?: string | null;
  }>;
};

/**
 * La tarjeta ya reconcilió Falló. El chat no se queda en el snapshot viejo
 * de Pendiente o Faltan datos. No sube un Vivo que el servidor no tenga.
 */
export function mergeCardFailedOfficialCheck(
  server: OfficialCheckSummary | null | undefined,
  card: CardOfficialCheckSnapshot | null | undefined,
): OfficialCheckSummary | null {
  if (!card || card.overallStatus !== "no_se_pudo") return server ?? null;
  const base: OfficialCheckSummary = server ?? {
    configured: true,
    consentGranted: true,
    overallStatus: "no_se_pudo",
    overallLabel: OFFICIAL_CHECK_STATUS_LABEL.no_se_pudo,
    overallDetail: buildOfficialFailedDetail(),
    checkedAt: card.checkedAt ?? null,
    identity: card.identity,
    checks: [],
  };
  const identity = mergeOfficialIdentityFlags(base.identity, card.identity);
  const sources: OfficialCheckSource[] = ["imss", "sat", "infonavit"];
  const checks = sources.flatMap((source) => {
    const fromServer = base.checks.find((item) => item.source === source) ?? null;
    const fromCard = card.checks?.find((item) => item.source === source) ?? null;
    const cardFailed = fromCard ? fromCard.status === "no_se_pudo" : card.overallStatus === "no_se_pudo";
    const serverStatus = fromServer?.status;
    const serverWeaker = !serverStatus || serverStatus === "pendiente" || serverStatus === "sin_datos";
    if (!cardFailed || !serverWeaker) {
      return fromServer ? [fromServer] : [];
    }
    if (fromCard && fromCard.status !== "no_se_pudo") {
      return fromServer ? [fromServer] : [];
    }
    const motivo = rewriteOfficialFailedMotivo(source, fromServer?.motivoFallo ?? fromCard?.detail);
    return [
      {
        source,
        sourceLabel: OFFICIAL_SOURCE_LABEL[source],
        status: "no_se_pudo" as const,
        label: OFFICIAL_CHECK_STATUS_LABEL.no_se_pudo,
        detail: motivo,
        checkedAt: fromCard?.checkedAt ?? card.checkedAt ?? fromServer?.checkedAt ?? base.checkedAt,
        used: usedOfficialIdentityForSource(source, identity),
        honesty: "failed" as const,
        hechos: fromServer?.hechos ?? [motivo],
        motivoFallo: motivo,
        missingFields: [],
      } satisfies OfficialSourceCheck,
    ];
  });
  const failedSources = checks.filter((item) => item.status === "no_se_pudo").map((item) => item.source);
  const keepLive = base.overallStatus === "vivo";
  const overallStatus = keepLive ? "vivo" : "no_se_pudo";
  return {
    ...base,
    identity,
    checks: checks.length > 0 ? checks : base.checks,
    checkedAt: card.checkedAt ?? base.checkedAt,
    overallStatus,
    overallLabel: OFFICIAL_CHECK_STATUS_LABEL[overallStatus],
    overallDetail: keepLive ? base.overallDetail : buildOfficialFailedDetail(failedSources),
  };
}

/**
 * Recibo gana: si ya hay NSS/RFC, no se pinta Faltan datos en esa fuente
 * ni en el overall. Solo Faltan datos si no se puede despachar IMSS/SAT.
 */
export function reconcileOfficialCheckWithIdentity(
  summary: OfficialCheckSummary | null | undefined,
  identity?: OfficialIdentityFlags | null,
  options?: {
    nowMs?: number;
    pendingSinceMs?: number | null;
    facts?: { nss?: unknown; curp?: unknown; workerRfc?: unknown; rfc?: unknown; employerRfc?: unknown } | null;
  },
): OfficialCheckSummary | null {
  if (!summary) return null;
  const factIdentity = options?.facts
    ? identityFlagsFromReceiptValues({
        nss: options.facts.nss,
        curp: options.facts.curp,
        rfc: options.facts.rfc,
        workerRfc: options.facts.workerRfc,
        employerRfc: options.facts.employerRfc,
      })
    : undefined;
  const mergedIdentity = mergeOfficialIdentityFlags(summary.identity, identity, factIdentity);
  const canDispatch = canDispatchOfficialConsult(mergedIdentity);

  if (
    (isPermissionBlockedStatus(summary.overallStatus) || summary.overallStatus === "no_configurado") &&
    !officialConsultAttempted(summary)
  ) {
    return { ...summary, identity: mergedIdentity };
  }

  const chatAnchor = summary.chatAnchor ? readChatAnchor(summary.chatAnchor, mergedIdentity) : null;

  const reconcileCheck = (item: OfficialSourceCheck): OfficialSourceCheck => {
    const missing = filterOfficialMissingFieldsForSource(item.source, item.missingFields, mergedIdentity);
    const honesty = item.honesty ?? officialStatusToHonesty(item.status);
    let status =
      honestyToOfficialStatus(honesty, missing, mergedIdentity, item.source) ?? item.status;
    if (sourceHasRequiredOfficialIdentity(item.source, mergedIdentity)) {
      if (status === "sin_datos") {
        if (honesty === "live" || item.status === "vivo") status = "vivo";
        else if (
          (honesty === "failed" || item.status === "no_se_pudo") &&
          looksLikeNoOfficialResponse(item.motivoFallo ?? item.detail)
        ) {
          status = "no_se_pudo";
        } else status = "pendiente";
      }
      status = demoteFalseIdentityFailure(
        item.source,
        status,
        mergedIdentity,
        item.missingFields,
        `${item.motivoFallo ?? ""} ${item.detail ?? ""} ${(item.hechos ?? []).join(" ")}`,
      );
    } else if (missingOfficialFieldsForSource(item.source, mergedIdentity).length > 0) {
      status = "sin_datos";
    }
    const anchor = chatAnchor?.[item.source];
    const anchorSaysLive = anchor?.estado === "live";
    const fromAnchor = anchorSaysLive ? citeableOfficialHechos(item.source, anchor?.hechos ?? []) : [];
    const fromItem = citeableOfficialHechos(item.source, item.hechos ?? []);
    const liveHechos = fromAnchor.length > 0 ? fromAnchor : fromItem;
    const satUsable =
      item.source !== "sat" ||
      hasUsableSatResponse(liveHechos.length > 0 ? liveHechos : [...(anchor?.hechos ?? []), ...(item.hechos ?? [])]);
    if (item.source === "sat" && !satUsable && (anchorSaysLive || honesty === "live" || status === "vivo" || item.status === "vivo")) {
      status = "no_se_pudo";
    } else if ((anchorSaysLive || honesty === "live" || item.status === "vivo") && satUsable) {
      status = "vivo";
    }
    const detail =
      status === "sin_datos"
        ? officialSourceGapDetail(item.source, options?.facts)
        : status === "no_se_pudo"
          ? rewriteOfficialFailedMotivo(item.source, item.motivoFallo ?? item.detail)
          : textContradictsVisibleReceiptIdentity(item.detail, mergedIdentity)
            ? OFFICIAL_CHECK_STATUS_DETAIL[status]
            : status === item.status
              ? item.detail
              : OFFICIAL_CHECK_STATUS_DETAIL[status];
    return {
      ...item,
      status,
      label: OFFICIAL_CHECK_STATUS_LABEL[status],
      detail,
      used: usedOfficialIdentityForSource(item.source, mergedIdentity),
      missingFields: missingOfficialFieldsForSource(item.source, mergedIdentity),
      honesty: officialStatusToHonesty(status),
      hechos:
        status === "vivo"
          ? liveHechos.length > 0
            ? rewriteOfficialIdentityHechos(item.source, liveHechos, mergedIdentity)
            : []
          : rewriteOfficialIdentityHechos(item.source, item.hechos ?? [], mergedIdentity),
      motivoFallo:
        status === "vivo"
          ? null
          : item.motivoFallo && textContradictsVisibleReceiptIdentity(item.motivoFallo, mergedIdentity)
          ? sourceHasRequiredOfficialIdentity(item.source, mergedIdentity)
            ? null
            : officialSourceGapDetail(item.source, options?.facts)
          : item.motivoFallo,
    };
  };

  let checks = (summary.checks ?? []).map(reconcileCheck);
  if (checks.length === 0 && chatAnchor) {
    checks = [
      sourceFromAnchor("imss", chatAnchor.imss, mergedIdentity, options?.facts),
      sourceFromAnchor("sat", chatAnchor.sat, mergedIdentity, options?.facts),
      sourceFromAnchor("infonavit", chatAnchor.infonavit, mergedIdentity, options?.facts),
    ];
  }

  const syncAnchorSource = (
    fuente: OfficialCheckSource,
    source: OfficialChatAnchorSource,
  ): OfficialChatAnchorSource => {
    const check = checks.find((item) => item.source === fuente);
    const status =
      check?.status ??
      honestyToOfficialStatus(source.estado, source.missingFields, mergedIdentity, fuente) ??
      "pendiente";
    const fromSource = citeableOfficialHechos(fuente, source.hechos);
    const fromCheck = citeableOfficialHechos(fuente, check?.hechos ?? []);
    const chosen = status === "vivo" ? (fromSource.length > 0 ? fromSource : fromCheck) : source.hechos;
    const hechos =
      status === "vivo" && citeableOfficialHechos(fuente, chosen).length === 0
        ? []
        : rewriteOfficialIdentityHechos(fuente, chosen, mergedIdentity);
    const motivoFallo =
      source.motivoFallo && textContradictsVisibleReceiptIdentity(source.motivoFallo, mergedIdentity)
        ? sourceHasRequiredOfficialIdentity(fuente, mergedIdentity)
          ? null
          : officialSourceGapDetail(fuente, options?.facts)
        : source.motivoFallo;
    return {
      ...source,
      estado: officialStatusToHonesty(status),
      hechos,
      motivoFallo,
      missingFields: missingOfficialFieldsForSource(fuente, mergedIdentity),
    };
  };

  let overallStatus = summary.overallStatus;
  if (checks.length > 0 && !isPermissionBlockedStatus(overallStatus) && overallStatus !== "no_configurado") {
    overallStatus = rollupOfficialCheckStatus(checks.map((item) => item.status));
  }
  if (canDispatch && overallStatus === "sin_datos") {
    overallStatus = officialConsultAttempted(summary) || checks.length > 0 ? "pendiente" : summary.overallStatus;
    if (overallStatus === "sin_datos") {
      overallStatus = "pendiente";
    }
  }
  if (!canDispatch && overallStatus !== "vivo" && overallStatus !== "no_se_pudo" && overallStatus !== "pendiente") {
    overallStatus = "sin_datos";
  }

  const nowMs = options?.nowMs ?? Date.now();
  const pendingSinceMs = options?.pendingSinceMs ?? null;
  const anchorFechaFor = (source: OfficialCheckSource) => chatAnchor?.[source]?.fecha ?? null;
  const livePresent = hasLiveOfficialResult({ ...summary, checks, chatAnchor: chatAnchor ?? summary.chatAnchor });
  const providerCap = summary.bridgeBlock === "provider_cap";
  checks = checks.map((item) => {
    if (providerCap) return item;
    if (item.status !== "pendiente" || item.honesty === "live") return item;
    if (
      !isStaleOfficialPending(item.checkedAt ?? summary.checkedAt, nowMs, {
        anchorFecha: anchorFechaFor(item.source),
        pendingSinceMs,
      })
    ) {
      return item;
    }
    return {
      ...item,
      status: "no_se_pudo" as const,
      label: OFFICIAL_CHECK_STATUS_LABEL.no_se_pudo,
      detail: rewriteOfficialFailedMotivo(item.source, item.motivoFallo ?? item.detail),
      honesty: "failed" as const,
      motivoFallo: rewriteOfficialFailedMotivo(item.source, item.motivoFallo),
    };
  });
  if (!providerCap && !livePresent && overallStatus === "pendiente" && isStaleOfficialPending(summary.checkedAt, nowMs, {
    anchorFecha: anchorFechaFor("imss") ?? anchorFechaFor("sat") ?? anchorFechaFor("infonavit"),
    pendingSinceMs,
  })) {
    overallStatus = "no_se_pudo";
  } else if (checks.length > 0 && !isPermissionBlockedStatus(overallStatus) && overallStatus !== "no_configurado") {
    overallStatus = rollupOfficialCheckStatus(checks.map((item) => item.status));
  }

  const syncedAnchor = chatAnchor
    ? {
        imss: syncAnchorSource("imss", chatAnchor.imss),
        sat: syncAnchorSource("sat", chatAnchor.sat),
        infonavit: syncAnchorSource("infonavit", chatAnchor.infonavit),
      }
    : chatAnchor;

  const overallDetail =
    overallStatus === "sin_datos"
      ? officialDispatchGapDetail(mergedIdentity, options?.facts)
      : overallStatus === "no_se_pudo"
        ? honestOfficialFailedDetail({
            ...summary,
            overallStatus,
            checks,
            chatAnchor: syncedAnchor ?? summary.chatAnchor,
          })
        : OFFICIAL_CHECK_STATUS_DETAIL[overallStatus];

  const visibleChecks = checks.map((item) => {
    if (item.status !== "no_se_pudo") {
      return { ...item, label: OFFICIAL_CHECK_STATUS_LABEL[item.status] };
    }
    const kind = looksLikeInstituteMaintenance(item.detail ?? item.motivoFallo) ? "mantenimiento" : "timeout";
    return {
      ...item,
      label: OFFICIAL_CHECK_STATUS_LABEL.no_se_pudo,
      detail: buildOfficialFailedMotivo(item.source, kind),
      motivoFallo: item.motivoFallo ? buildOfficialFailedMotivo(item.source, kind) : item.motivoFallo,
    };
  });

  return {
    ...summary,
    identity: mergedIdentity,
    checks: visibleChecks,
    chatAnchor: syncedAnchor ?? summary.chatAnchor,
    overallStatus,
    overallLabel: OFFICIAL_CHECK_STATUS_LABEL[overallStatus],
    overallDetail: stripInstituteBlameCopy(overallDetail),
  };
}

/** Quita campos que la fuente no pide o que el recibo ya trae. */
export function filterOfficialMissingFieldsForSource(
  source: OfficialCheckSource | null | undefined,
  reported: unknown,
  identity?: OfficialIdentityFlags | null,
): string[] {
  const reportedKeys = listOfficialMissingFieldKeys(reported);
  const required = source ? OFFICIAL_SOURCE_REQUIRED_FIELDS[source] : (["nss", "curp", "rfc"] as OfficialIdentityField[]);
  return reportedKeys.filter((key) => {
    if (!required.includes(key as OfficialIdentityField)) return false;
    if (identity?.[key as OfficialIdentityField]) return false;
    return true;
  });
}

export function looksLikeNoOfficialResponse(text?: string | null): boolean {
  return /no respondi[oó]|no contest[oó]|\btimeout\b|\btimed?\s*out\b|service unavailable|error del servidor/i.test(
    String(text ?? ""),
  );
}

export function inferOfficialMissingFieldKeys(text?: string | null): string[] {
  const haystack = String(text ?? "").toLowerCase();
  if (!haystack) return [];
  // Copy genérico del panel: no pintar las tres fuentes como si faltara todo.
  if (/faltan?\s+(?:tu\s+)?nss[,/]?\s*curp\s+(y|o)\s+rfc/.test(haystack)) return [];
  const keys: string[] = [];
  if (/\bfalta(?:n)?\b[^.]{0,40}\bnss\b|\bnss\b[^.]{0,40}\bfalta/.test(haystack)) keys.push("nss");
  if (/\bfalta(?:n)?\b[^.]{0,40}\bcurp\b|\bcurp\b[^.]{0,40}\bfalta/.test(haystack)) keys.push("curp");
  if (/\bfalta(?:n)?\b[^.]{0,40}\brfc\b|\brfc\b[^.]{0,40}\bfalta/.test(haystack)) keys.push("rfc");
  return keys;
}

export function honestyToOfficialStatus(
  honesty?: string | null,
  missingFields?: string[] | null,
  identity?: OfficialIdentityFlags | null,
  source?: OfficialCheckSource | null,
): OfficialCheckStatus | null {
  const value = String(honesty ?? "").trim().toLowerCase();
  const missing = filterOfficialMissingFieldsForSource(source, missingFields, identity);
  if (value === "live" || value === "vivo") return "vivo";
  if (missing.length > 0) return "sin_datos";
  if (!value) return null;
  if (value === "pending" || value === "pendiente") return "pendiente";
  if (
    value === "failed" ||
    value === "no_se_pudo" ||
    value === "fallo" ||
    value === "falló"
  ) {
    return "no_se_pudo";
  }
  return null;
}

export function officialStatusToHonesty(status: OfficialCheckStatus): OfficialChatAnchorEstado {
  if (status === "vivo") return "live";
  if (status === "no_se_pudo" || status === "sin_datos") return "failed";
  return "pending";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asText(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value !== "string") return null;
  const next = value.replace(/\s+/g, " ").trim();
  return next.length > 0 ? next : null;
}

function sanitizeHechos(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => asText(item))
    .filter((item): item is string => Boolean(item))
    .map((item) => item.replace(/\bcumple(?:n|r)?\b/gi, "respondió"))
    .slice(0, 3);
}

function pendingChatSource(fuente: OfficialCheckSource): OfficialChatAnchorSource {
  const label = fuente === "sat" ? "SAT" : fuente === "imss" ? "IMSS" : "Infonavit";
  return {
    fuente,
    estado: "pending",
    fecha: null,
    hechos: [`Todavía no hay una respuesta oficial nueva de ${label}.`],
    motivoFallo: null,
    missingFields: [],
  };
}

export function readChatAnchorSource(
  value: unknown,
  fuente: OfficialCheckSource,
  identity?: OfficialIdentityFlags | null,
): OfficialChatAnchorSource {
  const record = asRecord(value);
  if (!record) return pendingChatSource(fuente);
  const hechos = sanitizeHechos(record.hechos);
  const motivoFalloText =
    asText(record.motivoFallo) ?? asText(record.workerReason) ?? asText(record.reason);
  const missing = filterOfficialMissingFieldsForSource(
    fuente,
    [
      ...listOfficialMissingFieldKeys(record.missingFields),
      ...inferOfficialMissingFieldKeys(hechos.join(" ")),
      ...inferOfficialMissingFieldKeys(motivoFalloText),
    ],
    identity,
  );
  const resultado = asText(record.resultado)?.toLowerCase() ?? "";
  const honesty = asText(record.honesty)?.toLowerCase() ?? "";
  let estado =
    record.estado === "live" || record.estado === "pending" || record.estado === "failed"
      ? record.estado
      : officialStatusToHonesty(
          honestyToOfficialStatus(
            honesty === "live" || resultado === "vivo" || resultado === "live"
              ? "live"
              : honesty || (resultado === "no_se_pudo" ? "failed" : null) || asText(record.status),
            missing,
            identity,
            fuente,
          ) ?? "pendiente",
        );
  const noResponse = looksLikeNoOfficialResponse(`${motivoFalloText ?? ""} ${hechos.join(" ")}`);
  if (estado === "pending" && missing.length === 0 && noResponse) {
    estado = "failed";
  }
  if (honesty === "live" || resultado === "vivo" || resultado === "live") {
    estado = "live";
  }
  const rawMotivo =
    estado === "failed" || missing.length > 0
      ? motivoFalloText ?? (noResponse ? hechos.find((item) => looksLikeNoOfficialResponse(item)) ?? null : null)
      : null;
  const motivoFallo =
    missing.length > 0
      ? rawMotivo
      : estado === "failed"
        ? rewriteOfficialFailedMotivo(fuente, rawMotivo)
        : null;
  const resolvedHechos =
    estado === "live"
      ? citeableOfficialHechos(fuente, hechos)
      : estado === "failed" && missing.length === 0
        ? rewriteOfficialFailedHechos(fuente, hechos)
        : hechos.length > 0
          ? hechos
          : pendingChatSource(fuente).hechos;
  const identityHechos =
    estado === "live" && resolvedHechos.length === 0
      ? []
      : rewriteOfficialIdentityHechos(fuente, resolvedHechos, identity);
  const cleanedHechos =
    fuente === "sat" ? identityHechos.filter((item) => !isUnusableSatLegalNameLine(item)) : identityHechos;
  const identityMotivo =
    motivoFallo && textContradictsVisibleReceiptIdentity(motivoFallo, identity)
      ? sourceHasRequiredOfficialIdentity(fuente, identity)
        ? null
        : officialSourceGapDetail(fuente)
      : motivoFallo;
  return {
    fuente,
    estado,
    fecha: asText(record.fecha) ?? asText(record.checkedAt) ?? asText(record.date),
    hechos: cleanedHechos,
    motivoFallo: identityMotivo,
    missingFields: missing,
  };
}

export function readChatAnchor(
  value: unknown,
  identity?: OfficialIdentityFlags | null,
): OfficialChatAnchor | null {
  const record = asRecord(value);
  if (!record) return null;
  if (!record.sat && !record.imss && !record.infonavit) return null;
  return {
    sat: readChatAnchorSource(record.sat, "sat", identity),
    imss: readChatAnchorSource(record.imss, "imss", identity),
    infonavit: readChatAnchorSource(record.infonavit, "infonavit", identity),
  };
}

export function readReciboVsOficial(value: unknown): ReciboVsOficial | null {
  if (value == null) return null;
  if (value === "bien" || value === "hay_diferencia" || value === "no_se_pudo") {
    return { resultado: value, motivo: "" };
  }
  const record = asRecord(value);
  if (!record) return null;
  const resultado = record.resultado ?? record.result ?? record.signal;
  if (resultado !== "bien" && resultado !== "hay_diferencia" && resultado !== "no_se_pudo") {
    return null;
  }
  const campos = Array.isArray(record.campos)
    ? record.campos.flatMap((item) => {
        const row = asRecord(item);
        if (!row) return [];
        const campoResult = row.resultado;
        if (
          campoResult !== "bien" &&
          campoResult !== "hay_diferencia" &&
          campoResult !== "no_se_pudo"
        ) {
          return [];
        }
        return [
          {
            campo: asText(row.campo) ?? "monto",
            recibo: asText(row.recibo),
            oficial: asText(row.oficial),
            resultado: campoResult,
          } satisfies ReciboVsOficialCampo,
        ];
      })
    : undefined;
  return {
    resultado,
    motivo: asText(record.motivo) ?? "",
    campos,
  };
}

export function hasLiveOfficialResult(summary?: OfficialCheckSummary | null): boolean {
  if (!summary) return false;
  if (summary.checks.some((item) => item.status === "vivo" || item.honesty === "live")) return true;
  if (summary.chatAnchor) {
    return [summary.chatAnchor.sat, summary.chatAnchor.imss, summary.chatAnchor.infonavit].some(
      (item) => item.estado === "live",
    );
  }
  return summary.overallStatus === "vivo";
}

export function formatReceiptOfficialSeenLine(seen: ReciboVsOficialResultado) {
  return `Esto vimos: ${RECEIPT_OFFICIAL_COMPARISON_SEEN_LABEL[seen]}`;
}

export function formatReceiptOfficialNextStepLine(nextStep: string) {
  return `Qué hacer ahora: ${nextStep}`;
}

export function buildReceiptOfficialComparisonCopy(
  resultado: ReciboVsOficialResultado | null | undefined,
  options?: { instituteFailed?: boolean },
): { seen: ReciboVsOficialResultado; seenLine: string; nextStep: string; nextStepLine: string } {
  const seen = resultado ?? "no_se_pudo";
  const copy = RECEIPT_OFFICIAL_COMPARISON_COPY[seen];
  const nextStep =
    seen === "no_se_pudo" && options?.instituteFailed
      ? RECEIPT_OFFICIAL_COMPARISON_COPY.no_se_pudo.instituteNextStep
      : copy.nextStep;
  return {
    seen,
    seenLine: formatReceiptOfficialSeenLine(seen),
    nextStep,
    nextStepLine: formatReceiptOfficialNextStepLine(nextStep),
  };
}

export function formatOfficialCheckDate(iso: string | null | undefined) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

export function buildOfficialCheckHeadline(
  summary: Pick<OfficialCheckSummary, "overallStatus" | "checkedAt"> &
    Partial<Pick<OfficialCheckSummary, "checks" | "chatAnchor">>,
) {
  const presentation = buildHonestOfficialPresentation(summary);
  if (presentation?.kind === "mixed" || presentation?.kind === "silent" || presentation?.kind === "settled") {
    return presentation.verdict;
  }
  if (summary.overallStatus === "vivo") return POCKET_PARTIAL_VERDICT;
  if (summary.overallStatus === "no_se_pudo") {
    if (presentation?.kind === "silent") return presentation.verdict;
    const fromChecks = listFailedOfficialSources(summary.checks);
    const fromAnchor = listFailedOfficialSourcesFromAnchor(summary.chatAnchor);
    return instituteSilenceVerdict(fromChecks.length > 0 ? fromChecks : fromAnchor);
  }
  if (summary.overallStatus === "pendiente") return INSTITUTE_WAITING_HEADLINE;
  const label = OFFICIAL_CHECK_STATUS_LABEL[summary.overallStatus];
  const date = formatOfficialCheckDate(summary.checkedAt);
  return date ? `${label} · ${date}` : label;
}

export const OFFICIAL_CHECK_LOADING_LABEL = "Consultando...";
export const OFFICIAL_CHECK_LOADING_DETAIL =
  "Estamos preguntando a IMSS, SAT e Infonavit. Si hoy no contestan, te lo diremos.";
/** Solo si el retorno dice que otra consulta oficial aportó el dato. Nunca dice «backup». */
export const OFFICIAL_ALTERNATE_ROUTE_NOTE = "Consultamos otra vía oficial.";
/** Otra vía se intentó y no dejó un dato usable. Nunca dice «backup». */
export const OFFICIAL_ALTERNATE_ROUTE_EMPTY_NOTE =
  "Consultamos otra vía oficial y hoy no hubo datos útiles.";
export const OFFICIAL_CHECK_READY_HEADLINE = "Consulta IMSS y SAT";
export const OFFICIAL_CHECK_READY_DETAIL =
  "Con tu permiso preguntamos a IMSS y SAT. Si hoy no contestan, te lo diremos. No inventamos que tu patrón cumple.";

export type OfficialCheckDisplayStatus = OfficialCheckStatus | "consultando" | "listo";

export type OfficialCheckDisplay = {
  headline: string;
  detail: string;
  buttonLabel: string;
  status: OfficialCheckDisplayStatus;
  showPermissionCopy: boolean;
  silence?: InstituteSilencePresentation | null;
};

export function isPermissionBlockedStatus(status: OfficialCheckStatus | null | undefined) {
  return status === "sin_permiso";
}

export function pickHonestOfficialCheck(params: {
  consentGranted: boolean;
  candidates: Array<OfficialCheckSummary | null | undefined>;
}): OfficialCheckSummary | null {
  const present = params.candidates.filter((item): item is OfficialCheckSummary => Boolean(item));
  const withoutProviderCap = present.filter((item) => item.bridgeBlock !== "provider_cap");
  const pool = withoutProviderCap.length > 0 ? withoutProviderCap : present;
  const consulted = pool.find(
    (item) =>
      !isPermissionBlockedStatus(item.overallStatus) &&
      Boolean(item.checkedAt || item.chatAnchor || item.reciboVsOficial),
  );
  if (params.consentGranted || consulted) {
    return (
      consulted ??
      pool.find((item) => !isPermissionBlockedStatus(item.overallStatus)) ??
      null
    );
  }
  return pool[0] ?? null;
}

/**
 * Permiso primero. Con el checkbox marcado nunca se muestra «Falta tu permiso».
 * El CTA refleja Consultando / Vivo / esperando / sin respuesta según la respuesta, no un veredicto inventado.
 */
const ALTERNATE_ROUTE_TRUE_KEYS = new Set([
  "usedbackup",
  "usedfallback",
  "viabackup",
  "frombackup",
  "backupused",
  "failover",
  "providerfailover",
  "usedsecondary",
  "fallbackused",
]);
const ALTERNATE_ROUTE_ROLE_KEYS = new Set([
  "providerrole",
  "consultroute",
  "route",
  "via",
  "sourcekind",
  "providerkind",
  "failoverrole",
]);
const ALTERNATE_ROUTE_ROLE_VALUES = new Set([
  "backup",
  "fallback",
  "secondary",
  "respaldo",
  "alternate",
  "failover",
]);

function compactRouteKey(value: string) {
  return value.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function secondaryAttemptPresent(raw: unknown): boolean {
  if (raw === true || raw === "true" || raw === 1) return true;
  if (typeof raw === "number") return raw > 0;
  if (Array.isArray(raw)) return raw.length > 0;
  if (raw && typeof raw === "object") return Object.keys(raw as Record<string, unknown>).length > 0;
  return false;
}

/**
 * Señal explícita de que otra consulta oficial aportó el dato.
 * Sin esa señal, no se dice nada. No inventa un proveedor.
 */
export function readAlternateOfficialRoute(value: unknown): boolean {
  const seen = new Set<unknown>();
  const visit = (node: unknown, depth: number): boolean => {
    if (!node || typeof node !== "object" || depth > 4 || seen.has(node)) return false;
    seen.add(node);
    if (Array.isArray(node)) return node.some((item) => visit(item, depth + 1));
    const record = node as Record<string, unknown>;
    for (const [key, raw] of Object.entries(record)) {
      const name = compactRouteKey(key);
      if (ALTERNATE_ROUTE_TRUE_KEYS.has(name) && (raw === true || raw === "true" || raw === 1)) return true;
      if ((name === "backupjumps" || name === "backupjump") && secondaryAttemptPresent(raw)) return true;
      if (ALTERNATE_ROUTE_ROLE_KEYS.has(name) && ALTERNATE_ROUTE_ROLE_VALUES.has(String(raw ?? "").trim().toLowerCase())) {
        return true;
      }
    }
    for (const childKey of ["result", "officialCheck", "sat", "imss", "infonavit", "metadata", "helios", "sources"]) {
      if (childKey in record && visit(record[childKey], depth + 1)) return true;
    }
    return false;
  };
  return visit(value, 0);
}

export function shouldPollOfficialCheck(summary?: OfficialCheckSummary | null): boolean {
  if (!summary || summary.bridgeBlock === "provider_cap") return false;
  if (isPermissionBlockedStatus(summary.overallStatus) && !summary.checkedAt && !summary.chatAnchor) return false;
  if (summary.overallStatus === "pendiente") return true;
  return (summary.checks ?? []).some((item) => item.status === "pendiente" || item.honesty === "pending");
}

function liveSourceCount(summary: OfficialCheckSummary): number {
  const fromChecks = (summary.checks ?? []).filter((item) => item.status === "vivo" || item.honesty === "live").length;
  if (fromChecks > 0) return fromChecks;
  if (summary.chatAnchor) {
    return [summary.chatAnchor.imss, summary.chatAnchor.sat, summary.chatAnchor.infonavit].filter(
      (item) => item.estado === "live",
    ).length;
  }
  return summary.overallStatus === "vivo" ? 1 : 0;
}

/** Entre consultas ya hechas, muestra la que ya tiene más hechos vivos. */
export function pickPromptOfficialCheck(params: {
  consentGranted: boolean;
  candidates: Array<OfficialCheckSummary | null | undefined>;
}): OfficialCheckSummary | null {
  const base = pickHonestOfficialCheck(params);
  const present = params.candidates.filter((item): item is OfficialCheckSummary => Boolean(item));
  const withoutCap = present.filter((item) => item.bridgeBlock !== "provider_cap");
  const pool = withoutCap.length > 0 ? withoutCap : present;
  const consulted = pool.filter(
    (item) =>
      !isPermissionBlockedStatus(item.overallStatus) &&
      Boolean(item.checkedAt || item.chatAnchor || item.reciboVsOficial),
  );
  if (consulted.length === 0) return base;
  return consulted.reduce((best, item) => {
    const liveDelta = liveSourceCount(item) - liveSourceCount(best);
    if (liveDelta > 0) return item;
    if (liveDelta < 0) return best;
    const bestAt = best.checkedAt ? Date.parse(best.checkedAt) : 0;
    const itemAt = item.checkedAt ? Date.parse(item.checkedAt) : 0;
    return itemAt > bestAt ? item : best;
  });
}

export function resolveOfficialCheckDisplay(params: {
  consentGranted: boolean;
  isPending?: boolean;
  summary?: OfficialCheckSummary | null;
  missingIdentityDetail?: string | null;
  identity?: OfficialIdentityFlags | null;
  nowMs?: number;
  pendingSinceMs?: number | null;
  facts?: { nss?: unknown; workerRfc?: unknown; rfc?: unknown; employerRfc?: unknown } | null;
}): OfficialCheckDisplay {
  if (params.isPending) {
    const settled = resolveOfficialCheckDisplay({ ...params, isPending: false });
    if (settled.silence || settled.status === "vivo") {
      return {
        ...settled,
        buttonLabel: OFFICIAL_CHECK_LOADING_LABEL,
      };
    }
    return {
      headline: INSTITUTE_WAITING_HEADLINE,
      detail: INSTITUTE_WAITING_DETAIL,
      buttonLabel: OFFICIAL_CHECK_LOADING_LABEL,
      status: "consultando",
      showPermissionCopy: false,
    };
  }

  const identity = mergeOfficialIdentityFlags(params.identity, params.summary?.identity);
  const canDispatch = canDispatchOfficialConsult(identity);
  const reconciled = reconcileOfficialCheckWithIdentity(params.summary, identity, {
    nowMs: params.nowMs,
    pendingSinceMs: params.pendingSinceMs,
    facts: params.facts,
  });
  const consultAlreadyVisible = Boolean(
    reconciled &&
      !isPermissionBlockedStatus(reconciled.overallStatus) &&
      (reconciled.checkedAt || reconciled.chatAnchor || reconciled.reciboVsOficial),
  );
  const consentGranted = params.consentGranted || consultAlreadyVisible;

  const honest =
    consentGranted && isPermissionBlockedStatus(reconciled?.overallStatus)
      ? null
      : reconciled;

  if (consentGranted) {
    if (honest && !isPermissionBlockedStatus(honest.overallStatus)) {
      if (honest.overallStatus === "sin_datos" && canDispatch) {
        if (honest.checkedAt || honest.chatAnchor || honest.reciboVsOficial) {
          return {
            headline: INSTITUTE_WAITING_HEADLINE,
            detail: INSTITUTE_WAITING_DETAIL,
            buttonLabel: OFFICIAL_CHECK_BUTTON,
            status: "pendiente",
            showPermissionCopy: false,
            silence: null,
          };
        }
        return {
          headline: OFFICIAL_CHECK_READY_HEADLINE,
          detail: OFFICIAL_CHECK_READY_DETAIL,
          buttonLabel: OFFICIAL_CHECK_BUTTON,
          status: "listo",
          showPermissionCopy: false,
        };
      }
      const presentation = buildHonestOfficialPresentation(honest);
      if (presentation?.kind === "mixed" || presentation?.kind === "settled") {
        return {
          headline: presentation.verdict,
          detail: presentation.whatHappened,
          buttonLabel: presentation.retryLabel,
          status: "vivo",
          showPermissionCopy: false,
          silence: presentation,
        };
      }
      if (presentation?.kind === "silent" || honest.overallStatus === "no_se_pudo") {
        const fromChecks = listFailedOfficialSources(honest.checks);
        const fromAnchor = listFailedOfficialSourcesFromAnchor(honest.chatAnchor);
        const silenceBase = presentation ?? buildInstituteSilencePresentation(fromChecks.length > 0 ? fromChecks : fromAnchor);
        const silence = presentation?.kind === "silent"
          ? silenceBase
          : withAlternateRouteEmptyCopy(
              silenceBase,
              honest.alternateRoute === true &&
                !readOfficialSourceOutcomes(honest).some((item) => item.status === "vivo" && item.hechos.length > 0),
            );
        return {
          headline: silence.verdict,
          detail: `${silence.whatHappened} ${silence.meaning} ${silence.nextStep}`,
          buttonLabel: silence.retryLabel,
          status: "no_se_pudo",
          showPermissionCopy: false,
          silence,
        };
      }
      if (honest.overallStatus === "pendiente") {
        return {
          headline: INSTITUTE_WAITING_HEADLINE,
          detail: looksLikeInstituteMaintenance(honest.overallDetail)
            ? honest.overallDetail
            : INSTITUTE_WAITING_DETAIL,
          buttonLabel: OFFICIAL_CHECK_BUTTON,
          status: "pendiente",
          showPermissionCopy: false,
          silence: null,
        };
      }
      return {
        headline: buildOfficialCheckHeadline(honest),
        detail: appendAlternateRouteNote(
          honest.overallStatus === "sin_datos" && !canDispatch && params.missingIdentityDetail
            ? params.missingIdentityDetail
            : honest.overallDetail,
          alternateRouteContributedFacts(honest, readOfficialSourceOutcomes(honest).filter((item) => item.status === "vivo")),
        ),
        buttonLabel: honest.overallStatus === "vivo" ? OFFICIAL_CHECK_BUTTON : honest.overallLabel,
        status: honest.overallStatus,
        showPermissionCopy: false,
        silence: null,
      };
    }

    if (params.missingIdentityDetail && !canDispatch) {
      return {
        headline: OFFICIAL_CHECK_STATUS_LABEL.sin_datos,
        detail: params.missingIdentityDetail,
        buttonLabel: OFFICIAL_CHECK_STATUS_LABEL.sin_datos,
        status: "sin_datos",
        showPermissionCopy: false,
      };
    }

    return {
      headline: OFFICIAL_CHECK_READY_HEADLINE,
      detail: OFFICIAL_CHECK_READY_DETAIL,
      buttonLabel: OFFICIAL_CHECK_BUTTON,
      status: "listo",
      showPermissionCopy: false,
    };
  }

  return {
    headline: OFFICIAL_CHECK_STATUS_LABEL.sin_permiso,
    detail: OFFICIAL_CHECK_STATUS_DETAIL.sin_permiso,
    buttonLabel: OFFICIAL_CHECK_BUTTON,
    status: "sin_permiso",
    showPermissionCopy: true,
  };
}

export function assertNoInternalBrands(value: string) {
  return !/\b(APIMarket|Helios|CompliLink|connector|Capsolver)\b/i.test(value);
}

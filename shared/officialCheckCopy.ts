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
  "Doy permiso para consultar IMSS y SAT con mi NSS, CURP o RFC que ya aparecen en mis papeles. Solo para ver si hay una respuesta de hoy. No inventamos que tu patrón cumple.";

export const OFFICIAL_CHECK_STATUS_LABEL: Record<OfficialCheckStatus, string> = {
  vivo: "Vivo",
  pendiente: "Pendiente",
  no_se_pudo: "Falló",
  no_configurado: "Aún no configurado",
  sin_datos: "Faltan datos",
  sin_permiso: "Falta tu permiso",
};

export const OFFICIAL_SOURCE_LABEL: Record<OfficialCheckSource, string> = {
  imss: "IMSS",
  sat: "SAT",
  infonavit: "Infonavit",
};

export const OFFICIAL_FAILED_BLAME = "El fallo es del instituto, no de AuditaPatrón.";
export const OFFICIAL_FAILED_BLAME_PLURAL = "El fallo es de ellos, no de AuditaPatrón.";
export const OFFICIAL_FAILED_NEXT_STEP =
  "Inténtalo más tarde. El instituto no contestó; el fallo es de ellos, no de AuditaPatrón.";
export const OFFICIAL_FAILED_MISSING =
  "El instituto no contestó. El fallo es del instituto, no de AuditaPatrón.";

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

function consultedTodayPhrase(sources?: OfficialCheckSource[] | null): string {
  const unique = uniqueOfficialSources(sources);
  if (unique.length === 0) return "Consultamos al instituto hoy.";
  if (unique.length === 1) return `Consultamos al ${OFFICIAL_SOURCE_LABEL[unique[0]]} hoy.`;
  return `Consultamos a ${formatOfficialSourceList(unique)} hoy.`;
}

/** Detalle canónico de Falló. Si solo falló una, la nombra. Si fallaron varias, un solo párrafo. */
export function buildOfficialFailedDetail(sources?: OfficialCheckSource[] | null): string {
  const unique = uniqueOfficialSources(sources);
  if (unique.length <= 1) {
    return `${consultedTodayPhrase(unique)} El instituto no contestó (o está en mantenimiento). ${OFFICIAL_FAILED_BLAME} Inténtalo más tarde.`;
  }
  return `${consultedTodayPhrase(unique)} Esos institutos no contestaron (o están en mantenimiento). ${OFFICIAL_FAILED_BLAME_PLURAL} Inténtalo más tarde.`;
}

export function buildOfficialMaintenanceDetail(sources?: OfficialCheckSource[] | null): string {
  const unique = uniqueOfficialSources(sources);
  if (unique.length <= 1) {
    return `${consultedTodayPhrase(unique)} El instituto está en mantenimiento. ${OFFICIAL_FAILED_BLAME} Inténtalo más tarde.`;
  }
  return `${consultedTodayPhrase(unique)} Esos institutos están en mantenimiento. ${OFFICIAL_FAILED_BLAME_PLURAL} Inténtalo más tarde.`;
}

export function buildOfficialFailedMotivo(
  source: OfficialCheckSource,
  kind: "timeout" | "mantenimiento" | "generic" = "generic",
): string {
  const name = OFFICIAL_SOURCE_LABEL[source];
  if (kind === "mantenimiento") {
    return `El ${name} está en mantenimiento. ${OFFICIAL_FAILED_BLAME}`;
  }
  return `El ${name} no contestó. ${OFFICIAL_FAILED_BLAME}`;
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

/** Reescribe un Falló guardado (o vago) para que culpe al instituto, no a la app. */
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

export function looksLikeRealWorkerRfc(value?: unknown): boolean {
  if (typeof value !== "string") return false;
  const normalized = value.trim().toUpperCase().replace(/[^A-Z0-9Ñ&]/g, "");
  if (normalized.length < 12 || normalized.length > 13) return false;
  return !isGenericSatRfc(normalized);
}

/** IMSS=NSS, SAT=RFC real (XAXX no cuenta), Infonavit=CURP. */
export function identityFlagsFromReceiptValues(values?: {
  nss?: unknown;
  curp?: unknown;
  rfc?: unknown;
  workerRfc?: unknown;
} | null): OfficialIdentityFlags {
  return {
    nss: looksLikeOfficialNss(values?.nss),
    curp: looksLikeOfficialCurp(values?.curp),
    rfc: looksLikeRealWorkerRfc(values?.workerRfc ?? values?.rfc),
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
  return next.length > 0 ? next : [pending];
}

export function stripContradictoryMissingIdentityCopy(
  text: string,
  identity?: OfficialIdentityFlags | null,
): string {
  if (!identity?.nss && !identity?.rfc) return text;
  let next = text;
  if (identity.nss) {
    next = next
      .replace(/IMSS y SAT:\s*Faltan datos(?:\s*·\s*\d{2}\/\d{2}\/\d{4})?/gi, "IMSS: Pendiente")
      .replace(/Falta tu NSS, CURP y RFC en el recibo para consultar\.?/gi, "")
      .replace(/Falta tu NSS(?: y CURP)?(?: y RFC)? en el recibo para consultar\.?/gi, "")
      .replace(/Falta tu NSS\b/gi, "Tu NSS ya aparece en el recibo");
  }
  if (identity.rfc) {
    next = next.replace(/Falta tu RFC en el recibo para consultar\.?/gi, "");
  }
  return next.replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
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
    instituteNextStep: OFFICIAL_FAILED_NEXT_STEP,
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

export function officialDispatchGapDetail(identity?: OfficialIdentityFlags | null): string {
  const missing: string[] = [];
  if (!identity?.nss) missing.push("NSS");
  if (!identity?.rfc) missing.push("RFC");
  if (missing.length === 0) return OFFICIAL_CHECK_STATUS_DETAIL.sin_datos;
  if (missing.length === 1) return `Falta tu ${missing[0]} en el recibo para consultar.`;
  return `Falta tu ${missing[0]} y ${missing[1]} en el recibo para consultar.`;
}

export function officialSourceGapDetail(source: OfficialCheckSource): string {
  if (source === "sat") return "Falta un RFC real en el recibo para consultar SAT.";
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
): OfficialSourceCheck {
  const missing = filterOfficialMissingFieldsForSource(fuente, anchor.missingFields, identity);
  const mapped =
    honestyToOfficialStatus(anchor.estado, missing, identity, fuente) ??
    (sourceHasRequiredOfficialIdentity(fuente, identity) ? "pendiente" : "sin_datos");
  const status = demoteFalseIdentityFailure(
    fuente,
    mapped,
    identity,
    anchor.missingFields,
    `${anchor.motivoFallo ?? ""} ${anchor.hechos.join(" ")}`,
  );
  return {
    source: fuente,
    sourceLabel: OFFICIAL_SOURCE_LABEL[fuente],
    status,
    label: OFFICIAL_CHECK_STATUS_LABEL[status],
    detail:
      status === "sin_datos"
        ? officialSourceGapDetail(fuente)
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

/**
 * Recibo gana: si ya hay NSS/RFC, no se pinta Faltan datos en esa fuente
 * ni en el overall. Solo Faltan datos si no se puede despachar IMSS/SAT.
 */
export function reconcileOfficialCheckWithIdentity(
  summary: OfficialCheckSummary | null | undefined,
  identity?: OfficialIdentityFlags | null,
): OfficialCheckSummary | null {
  if (!summary) return null;
  const mergedIdentity = mergeOfficialIdentityFlags(summary.identity, identity);
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
    const detail =
      status === "sin_datos"
        ? officialSourceGapDetail(item.source)
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
      hechos: rewriteOfficialIdentityHechos(item.source, item.hechos ?? [], mergedIdentity),
      motivoFallo:
        item.motivoFallo && textContradictsVisibleReceiptIdentity(item.motivoFallo, mergedIdentity)
          ? sourceHasRequiredOfficialIdentity(item.source, mergedIdentity)
            ? null
            : officialSourceGapDetail(item.source)
          : item.motivoFallo,
    };
  };

  let checks = (summary.checks ?? []).map(reconcileCheck);
  if (checks.length === 0 && chatAnchor) {
    checks = [
      sourceFromAnchor("imss", chatAnchor.imss, mergedIdentity),
      sourceFromAnchor("sat", chatAnchor.sat, mergedIdentity),
      sourceFromAnchor("infonavit", chatAnchor.infonavit, mergedIdentity),
    ];
  }

  const syncAnchorSource = (
    fuente: OfficialCheckSource,
    source: OfficialChatAnchorSource,
  ): OfficialChatAnchorSource => {
    const status =
      checks.find((item) => item.source === fuente)?.status ??
      honestyToOfficialStatus(source.estado, source.missingFields, mergedIdentity, fuente) ??
      "pendiente";
    const hechos = rewriteOfficialIdentityHechos(fuente, source.hechos, mergedIdentity);
    const motivoFallo =
      source.motivoFallo && textContradictsVisibleReceiptIdentity(source.motivoFallo, mergedIdentity)
        ? sourceHasRequiredOfficialIdentity(fuente, mergedIdentity)
          ? null
          : officialSourceGapDetail(fuente)
        : source.motivoFallo;
    return {
      ...source,
      estado: officialStatusToHonesty(status),
      hechos,
      motivoFallo,
      missingFields: missingOfficialFieldsForSource(fuente, mergedIdentity),
    };
  };
  const syncedAnchor = chatAnchor
    ? {
        imss: syncAnchorSource("imss", chatAnchor.imss),
        sat: syncAnchorSource("sat", chatAnchor.sat),
        infonavit: syncAnchorSource("infonavit", chatAnchor.infonavit),
      }
    : chatAnchor;

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

  const overallDetail =
    overallStatus === "sin_datos"
      ? officialDispatchGapDetail(mergedIdentity)
      : overallStatus === "no_se_pudo"
        ? honestOfficialFailedDetail({
            ...summary,
            overallStatus,
            checks,
            chatAnchor: syncedAnchor ?? summary.chatAnchor,
          })
        : OFFICIAL_CHECK_STATUS_DETAIL[overallStatus];

  return {
    ...summary,
    identity: mergedIdentity,
    checks,
    chatAnchor: syncedAnchor ?? summary.chatAnchor,
    overallStatus,
    overallLabel: OFFICIAL_CHECK_STATUS_LABEL[overallStatus],
    overallDetail,
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
  let estado =
    record.estado === "live" || record.estado === "pending" || record.estado === "failed"
      ? record.estado
      : officialStatusToHonesty(
          honestyToOfficialStatus(
            asText(record.honesty) ?? asText(record.status),
            missing,
            identity,
            fuente,
          ) ?? "pendiente",
        );
  const noResponse = looksLikeNoOfficialResponse(`${motivoFalloText ?? ""} ${hechos.join(" ")}`);
  if (estado === "pending" && missing.length === 0 && noResponse) {
    estado = "failed";
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
    estado === "failed" && missing.length === 0
      ? rewriteOfficialFailedHechos(fuente, hechos)
      : hechos.length > 0
        ? hechos
        : pendingChatSource(fuente).hechos;
  const identityHechos = rewriteOfficialIdentityHechos(fuente, resolvedHechos, identity);
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
    hechos: identityHechos,
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
  if (summary.chatAnchor) {
    return [summary.chatAnchor.sat, summary.chatAnchor.imss, summary.chatAnchor.infonavit].some(
      (item) => item.estado === "live",
    );
  }
  return (
    summary.overallStatus === "vivo" ||
    summary.checks.some((item) => item.status === "vivo" || item.honesty === "live")
  );
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

export function buildOfficialCheckHeadline(summary: Pick<OfficialCheckSummary, "overallStatus" | "checkedAt">) {
  const label = OFFICIAL_CHECK_STATUS_LABEL[summary.overallStatus];
  const date = formatOfficialCheckDate(summary.checkedAt);
  return date ? `${label} · ${date}` : label;
}

export const OFFICIAL_CHECK_LOADING_LABEL = "Consultando...";
export const OFFICIAL_CHECK_LOADING_DETAIL =
  "Estamos consultando IMSS y SAT. Si el instituto no contesta, te lo decimos. Eso no es un fallo de AuditaPatrón.";
export const OFFICIAL_CHECK_READY_HEADLINE = "Consulta IMSS y SAT";
export const OFFICIAL_CHECK_READY_DETAIL =
  "Con tu permiso consultamos IMSS y SAT. Si el instituto no contesta, te lo decimos. El fallo sería del instituto, no de AuditaPatrón. No inventamos que tu patrón cumple.";

export type OfficialCheckDisplayStatus = OfficialCheckStatus | "consultando" | "listo";

export type OfficialCheckDisplay = {
  headline: string;
  detail: string;
  buttonLabel: string;
  status: OfficialCheckDisplayStatus;
  showPermissionCopy: boolean;
};

export function isPermissionBlockedStatus(status: OfficialCheckStatus | null | undefined) {
  return status === "sin_permiso";
}

export function pickHonestOfficialCheck(params: {
  consentGranted: boolean;
  candidates: Array<OfficialCheckSummary | null | undefined>;
}): OfficialCheckSummary | null {
  const present = params.candidates.filter((item): item is OfficialCheckSummary => Boolean(item));
  const consulted = present.find(
    (item) =>
      !isPermissionBlockedStatus(item.overallStatus) &&
      Boolean(item.checkedAt || item.chatAnchor || item.reciboVsOficial),
  );
  if (params.consentGranted || consulted) {
    return (
      consulted ??
      present.find((item) => !isPermissionBlockedStatus(item.overallStatus)) ??
      null
    );
  }
  return present[0] ?? null;
}

/**
 * Permiso primero. Con el checkbox marcado nunca se muestra «Falta tu permiso».
 * El CTA refleja Consultando / Vivo / Pendiente / Falló según la respuesta, no un veredicto inventado.
 */
export function resolveOfficialCheckDisplay(params: {
  consentGranted: boolean;
  isPending?: boolean;
  summary?: OfficialCheckSummary | null;
  missingIdentityDetail?: string | null;
  identity?: OfficialIdentityFlags | null;
}): OfficialCheckDisplay {
  if (params.isPending) {
    return {
      headline: OFFICIAL_CHECK_LOADING_LABEL,
      detail: OFFICIAL_CHECK_LOADING_DETAIL,
      buttonLabel: OFFICIAL_CHECK_LOADING_LABEL,
      status: "consultando",
      showPermissionCopy: false,
    };
  }

  const identity = mergeOfficialIdentityFlags(params.identity, params.summary?.identity);
  const canDispatch = canDispatchOfficialConsult(identity);
  const reconciled = reconcileOfficialCheckWithIdentity(params.summary, identity);
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
            headline: buildOfficialCheckHeadline({
              overallStatus: "pendiente",
              checkedAt: honest.checkedAt,
            }),
            detail: OFFICIAL_CHECK_STATUS_DETAIL.pendiente,
            buttonLabel: OFFICIAL_CHECK_STATUS_LABEL.pendiente,
            status: "pendiente",
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
        headline: buildOfficialCheckHeadline(honest),
        detail:
          honest.overallStatus === "sin_datos" && !canDispatch && params.missingIdentityDetail
            ? params.missingIdentityDetail
            : honest.overallStatus === "no_se_pudo"
              ? honestOfficialFailedDetail(honest)
              : honest.overallDetail,
        buttonLabel: honest.overallLabel,
        status: honest.overallStatus,
        showPermissionCopy: false,
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

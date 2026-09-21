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

export const OFFICIAL_CHECK_STATUS_DETAIL: Record<OfficialCheckStatus, string> = {
  vivo: "Esto respondió el instituto hoy. No significa que tu patrón cumple.",
  pendiente: "Todavía no hay una respuesta oficial nueva. Inténtalo más tarde.",
  no_se_pudo: "No hubo respuesta usable en esta consulta. Inténtalo más tarde.",
  no_configurado: "Aún no configurado. Por ahora solo leemos tus papeles.",
  sin_datos: "Falta tu NSS, CURP o RFC en el recibo para consultar.",
  sin_permiso: "Falta tu permiso para consultar IMSS y SAT.",
};

export type OfficialIdentityFlags = {
  nss: boolean;
  curp: boolean;
  rfc: boolean;
};

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

export function looksLikeNoOfficialResponse(text?: string | null): boolean {
  return /no respondi[oó]|\btimeout\b|\btimed?\s*out\b|service unavailable/i.test(
    String(text ?? ""),
  );
}

export function inferOfficialMissingFieldKeys(text?: string | null): string[] {
  const haystack = String(text ?? "").toLowerCase();
  if (!haystack) return [];
  const keys: string[] = [];
  if (/\bfalta(?:n)?\b[^.]{0,40}\bnss\b|\bnss\b[^.]{0,40}\bfalta/.test(haystack)) keys.push("nss");
  if (/\bfalta(?:n)?\b[^.]{0,40}\bcurp\b|\bcurp\b[^.]{0,40}\bfalta/.test(haystack)) keys.push("curp");
  if (/\bfalta(?:n)?\b[^.]{0,40}\brfc\b|\brfc\b[^.]{0,40}\bfalta/.test(haystack)) keys.push("rfc");
  return keys;
}

export function honestyToOfficialStatus(
  honesty?: string | null,
  missingFields?: string[] | null,
): OfficialCheckStatus | null {
  const value = String(honesty ?? "").trim().toLowerCase();
  const missing = listOfficialMissingFieldKeys(missingFields);
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
): OfficialChatAnchorSource {
  const record = asRecord(value);
  if (!record) return pendingChatSource(fuente);
  const hechos = sanitizeHechos(record.hechos);
  const motivoFalloText =
    asText(record.motivoFallo) ?? asText(record.workerReason) ?? asText(record.reason);
  const missing = [
    ...listOfficialMissingFieldKeys(record.missingFields),
    ...inferOfficialMissingFieldKeys(hechos.join(" ")),
    ...inferOfficialMissingFieldKeys(motivoFalloText),
  ].filter((item, index, all) => all.indexOf(item) === index);
  let estado =
    record.estado === "live" || record.estado === "pending" || record.estado === "failed"
      ? record.estado
      : officialStatusToHonesty(
          honestyToOfficialStatus(asText(record.honesty) ?? asText(record.status), missing) ??
            "pendiente",
        );
  const noResponse = looksLikeNoOfficialResponse(`${motivoFalloText ?? ""} ${hechos.join(" ")}`);
  if (estado === "pending" && missing.length === 0 && noResponse) {
    estado = "failed";
  }
  const motivoFallo =
    estado === "failed" || missing.length > 0
      ? motivoFalloText ?? (noResponse ? hechos.find((item) => looksLikeNoOfficialResponse(item)) ?? null : null)
      : null;
  return {
    fuente,
    estado,
    fecha: asText(record.fecha) ?? asText(record.checkedAt) ?? asText(record.date),
    hechos: hechos.length > 0 ? hechos : pendingChatSource(fuente).hechos,
    motivoFallo,
    missingFields: missing,
  };
}

export function readChatAnchor(value: unknown): OfficialChatAnchor | null {
  const record = asRecord(value);
  if (!record) return null;
  if (!record.sat && !record.imss && !record.infonavit) return null;
  return {
    sat: readChatAnchorSource(record.sat, "sat"),
    imss: readChatAnchorSource(record.imss, "imss"),
    infonavit: readChatAnchorSource(record.infonavit, "infonavit"),
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
): { seen: ReciboVsOficialResultado; seenLine: string; nextStep: string; nextStepLine: string } {
  const seen = resultado ?? "no_se_pudo";
  const copy = RECEIPT_OFFICIAL_COMPARISON_COPY[seen];
  return {
    seen,
    seenLine: formatReceiptOfficialSeenLine(seen),
    nextStep: copy.nextStep,
    nextStepLine: formatReceiptOfficialNextStepLine(copy.nextStep),
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
export const OFFICIAL_CHECK_READY_HEADLINE = "Consulta IMSS y SAT";
export const OFFICIAL_CHECK_READY_DETAIL =
  "Con tu permiso consultamos IMSS y SAT. Si no hay respuesta, te lo decimos. No inventamos que tu patrón cumple.";

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
}): OfficialCheckDisplay {
  if (params.isPending) {
    return {
      headline: OFFICIAL_CHECK_LOADING_LABEL,
      detail: "Estamos consultando IMSS y SAT. Si no hay respuesta, te lo decimos.",
      buttonLabel: OFFICIAL_CHECK_LOADING_LABEL,
      status: "consultando",
      showPermissionCopy: false,
    };
  }

  const consultAlreadyVisible = Boolean(
    params.summary &&
      !isPermissionBlockedStatus(params.summary.overallStatus) &&
      (params.summary.checkedAt || params.summary.chatAnchor || params.summary.reciboVsOficial),
  );
  const consentGranted = params.consentGranted || consultAlreadyVisible;

  const honest =
    consentGranted && isPermissionBlockedStatus(params.summary?.overallStatus)
      ? null
      : (params.summary ?? null);

  if (consentGranted) {
    if (honest && !isPermissionBlockedStatus(honest.overallStatus)) {
      return {
        headline: buildOfficialCheckHeadline(honest),
        detail:
          honest.overallStatus === "sin_datos" && params.missingIdentityDetail
            ? params.missingIdentityDetail
            : honest.overallDetail,
        buttonLabel: honest.overallLabel,
        status: honest.overallStatus,
        showPermissionCopy: false,
      };
    }

    if (params.missingIdentityDetail) {
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

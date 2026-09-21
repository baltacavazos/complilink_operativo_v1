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
  pendiente: "El instituto no respondió hoy. Inténtalo más tarde.",
  no_se_pudo: "Falló la consulta. Inténtalo más tarde.",
  no_configurado: "Aún no configurado. Por ahora solo leemos tus papeles.",
  sin_datos: "Falta tu NSS, CURP o RFC en el recibo para consultar.",
  sin_permiso: "Falta tu permiso para consultar IMSS y SAT.",
};

export type OfficialIdentityFlags = {
  nss: boolean;
  curp: boolean;
  rfc: boolean;
};

export type OfficialSourceCheck = {
  source: OfficialCheckSource;
  sourceLabel: string;
  status: OfficialCheckStatus;
  label: string;
  detail: string;
  checkedAt: string | null;
  used: OfficialIdentityFlags;
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
};

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
  if (params.consentGranted) {
    return present.find((item) => !isPermissionBlockedStatus(item.overallStatus)) ?? null;
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

  const honest =
    params.consentGranted && isPermissionBlockedStatus(params.summary?.overallStatus)
      ? null
      : (params.summary ?? null);

  if (params.consentGranted) {
    if (honest && !isPermissionBlockedStatus(honest.overallStatus)) {
      return {
        headline: buildOfficialCheckHeadline(honest),
        detail: honest.overallDetail,
        buttonLabel: honest.overallLabel,
        status: honest.overallStatus,
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

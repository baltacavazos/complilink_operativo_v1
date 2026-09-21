/**
 * Copy y formas de la consulta en vivo IMSS/SAT.
 * Español plano. Nunca "cumple". Nunca marcas internas en UI.
 */

export const OFFICIAL_CHECK_SOURCES = ["imss", "sat"] as const;
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
  vivo: "Consulta hecha",
  pendiente: "Pendiente",
  no_se_pudo: "No se pudo",
  no_configurado: "Aún no configurado",
  sin_datos: "Faltan datos",
  sin_permiso: "Falta tu permiso",
};

export const OFFICIAL_CHECK_STATUS_DETAIL: Record<OfficialCheckStatus, string> = {
  vivo: "Esto respondió el instituto hoy. No significa que tu patrón cumple.",
  pendiente: "El instituto no respondió hoy. Inténtalo más tarde.",
  no_se_pudo: "No se pudo consultar. Inténtalo más tarde.",
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

export function assertNoInternalBrands(value: string) {
  return !/\b(APIMarket|Helios|CompliLink|connector|Capsolver)\b/i.test(value);
}

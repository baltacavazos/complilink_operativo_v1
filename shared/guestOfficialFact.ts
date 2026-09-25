import {
  citeableOfficialHechos,
  humanizeOfficialHecho,
  isPermissionBlockedStatus,
  shouldPollOfficialCheck,
  type OfficialCheckSummary,
} from "./officialCheckCopy";
import { hasUsableOfficialFact, OFFICIAL_RESULT_NOTIFICATION_KIND } from "./officialResultNotification";

/** Contrato de followup cuando CompliLink entrega el hecho después de la consulta. */
export const GUEST_OFFICIAL_FACT_ARRIVED_KIND = "official_fact_arrived" as const;

/** Ventana para seguir preguntando el hecho tardío (~70s en vivo, con margen). */
export const GUEST_OFFICIAL_FACT_WAIT_MS = 4 * 60 * 1000;

/**
 * El token de invitado vive en sessionStorage de esta pestaña.
 * Cerrar la pestaña lo borra. No hay correo: el aviso por email exige cuenta.
 */
export const GUEST_OFFICIAL_FACT_CLOSED_TAB_LIMIT =
  "Si cierras esta pestaña, el aviso de invitado no se guarda. Si sigues aquí o recargas esta misma pestaña, verás el resultado cuando llegue.";

export function isOfficialFactArrivedKind(kind: string | null | undefined): boolean {
  return kind === GUEST_OFFICIAL_FACT_ARRIVED_KIND || kind === OFFICIAL_RESULT_NOTIFICATION_KIND;
}

export function officialCheckFingerprint(summary: OfficialCheckSummary | null | undefined): string {
  if (!summary) return "";
  const facts = (summary.checks ?? [])
    .map((check) => `${check.source}:${check.status}:${(check.hechos ?? []).join("|")}`)
    .join(";");
  return `${summary.overallStatus}|${summary.checkedAt ?? ""}|${facts}`;
}

export function officialChecksMatch(
  left: OfficialCheckSummary | null | undefined,
  right: OfficialCheckSummary | null | undefined,
): boolean {
  return officialCheckFingerprint(left) === officialCheckFingerprint(right);
}

const GUEST_VISIBLE_FACT_CAP = 3;

/**
 * Hechos de una fuente que ya contestó y sí se pueden citar.
 * Misma ruta que el IMSS: citeableOfficialHechos + humanize. Tope de 3.
 * No inventa un cumple ni un semáforo si el webhook no trajo el dato.
 */
function listGuestVisibleSourceFacts(
  summary: OfficialCheckSummary | null | undefined,
  source: "imss" | "infonavit",
): string[] {
  const check = summary?.checks?.find((item) => item.source === source);
  if (!check) return [];
  if (check.status !== "vivo" && check.honesty !== "live") return [];
  return citeableOfficialHechos(source, check.hechos ?? [])
    .map((line) => humanizeOfficialHecho(line))
    .filter((line) => line.length > 0)
    .slice(0, GUEST_VISIBLE_FACT_CAP);
}

/** Hechos IMSS que sí se pueden mostrar. No inventa un cumple ni un semáforo. */
export function listGuestVisibleImssFacts(summary: OfficialCheckSummary | null | undefined): string[] {
  return listGuestVisibleSourceFacts(summary, "imss");
}

/** Hechos Infonavit que sí se pueden mostrar. Misma ruta que el IMSS. */
export function listGuestVisibleInfonavitFacts(summary: OfficialCheckSummary | null | undefined): string[] {
  return listGuestVisibleSourceFacts(summary, "infonavit");
}

/** Líneas de bandeja: IMSS e Infonavit, cada uno con su tope. El SAT no entra aquí. */
export function listGuestVisibleOfficialFacts(summary: OfficialCheckSummary | null | undefined): {
  imss: string[];
  infonavit: string[];
} {
  return {
    imss: listGuestVisibleImssFacts(summary),
    infonavit: listGuestVisibleInfonavitFacts(summary),
  };
}

/**
 * Mientras el hecho no llega, la consulta guest sigue en espera.
 * Un fallo sincrónico también espera un rato: el webhook puede traer el dato después.
 */
export function guestOfficialFactStillWaiting(
  summary: OfficialCheckSummary | null | undefined,
  nowMs = Date.now(),
): boolean {
  if (!summary) return false;
  if (summary.bridgeBlock === "provider_cap") return false;
  if (hasUsableOfficialFact(summary)) return false;
  if (
    summary.overallStatus === "sin_permiso" ||
    summary.overallStatus === "no_configurado" ||
    summary.overallStatus === "sin_datos"
  ) {
    return false;
  }
  if (isPermissionBlockedStatus(summary.overallStatus) && !summary.checkedAt) return false;

  const checkedAt = summary.checkedAt ? Date.parse(summary.checkedAt) : Number.NaN;
  if (Number.isFinite(checkedAt) && nowMs - checkedAt >= GUEST_OFFICIAL_FACT_WAIT_MS) return false;

  return (
    shouldPollOfficialCheck(summary) ||
    summary.overallStatus === "pendiente" ||
    summary.overallStatus === "no_se_pudo"
  );
}

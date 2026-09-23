import {
  OFFICIAL_CHECK_CONSENT,
  OFFICIAL_CHECK_STATUS_DETAIL,
  OFFICIAL_CHECK_STATUS_LABEL,
  buildOfficialFailedDetail,
  buildOfficialMaintenanceDetail,
  citeableOfficialHechos,
  hasUsableSatResponse,
  isPlaceholderSatLegalName,
  filterOfficialMissingFieldsForSource,
  honestyToOfficialStatus,
  inferOfficialMissingFieldKeys,
  listFailedOfficialSources,
  listOfficialMissingFieldKeys,
  missingOfficialFieldsForSource,
  looksLikeInstituteMaintenance,
  looksLikeNoOfficialResponse,
  readInstitutePayFacts,
  officialStatusToHonesty,
  readAlternateOfficialRoute,
  readChatAnchor,
  readChatAnchorSource,
  readReciboVsOficial,
  rewriteOfficialFailedMotivo,
  isGenericSatRfc,
  reconcileOfficialCheckWithIdentity,
  usedOfficialIdentityForSource,
  type OfficialChatAnchor,
  type OfficialCheckSource,
  type OfficialCheckStatus,
  type OfficialCheckSummary,
  type OfficialIdentityFlags,
  type OfficialSourceCheck,
  type ReciboVsOficial,
} from "@shared/officialCheckCopy";
import {
  officialIdentityGapDetail,
} from "@shared/officialCaseBriefing";
import {
  canonicalizeEngineWebhookUrl,
  deriveHeliosBridgeUrl,
  postSignedAuditaPatronEngine,
  type SignedEnginePostResult,
} from "./auditaPatronIntegrationService";

/** El puente espera cada fuente (hasta dos intentos de 12s) y devuelve el SAT en el mismo cuerpo. */
/** El puente espera dos intentos de 12s por fuente. Un corte antes, y el reintento, dejan providerId vacío y el tope de un proveedor. */
export const GOVERNMENT_LIVE_TIMEOUT_MS = 45_000;
export const GOVERNMENT_LIVE_MAX_ATTEMPTS = 2;
export const OFFICIAL_CHECK_ACTION = "official_check";
export const OFFICIAL_CHECK_EVENT = "official.check.requested";

const SOURCE_LABEL = {
  imss: "IMSS",
  sat: "SAT",
  infonavit: "Infonavit",
} as const;

export type GovernmentLiveEnv = Record<string, string | undefined>;

export type WorkerOfficialIdentity = {
  nss: string | null;
  curp: string | null;
  rfc: string | null;
};

export type OfficialCheckEngineConfig = {
  webhookUrl: string;
  hmacSecret: string;
};

export function resolveOfficialCheckWebhookUrl(engineWebhookUrl: string): string {
  const configured = canonicalizeEngineWebhookUrl(engineWebhookUrl);
  if (!configured) return "";

  try {
    const path = new URL(configured).pathname.replace(/\/+$/, "") || "/";
    if (path === "/api/auditapatron/webhook" || path === "/api/auditapatron/complilink-webhook") {
      return deriveHeliosBridgeUrl(configured) || configured;
    }
    return configured;
  } catch {
    return configured;
  }
}

export function resolveOfficialCheckTargetUrls(engineWebhookUrl: string): string[] {
  const primary = resolveOfficialCheckWebhookUrl(engineWebhookUrl);
  const derived = deriveHeliosBridgeUrl(engineWebhookUrl);
  const urls: string[] = [];
  if (primary) urls.push(primary);
  if (derived && !urls.includes(derived)) urls.push(derived);
  return urls;
}

export function readEngineBridgeConfig(env: GovernmentLiveEnv = process.env): OfficialCheckEngineConfig {
  return {
    webhookUrl: resolveOfficialCheckWebhookUrl(String(env.AUDITAPATRON_ENGINE_WEBHOOK_URL ?? "")),
    hmacSecret: String(env.AUDITAPATRON_ENGINE_HMAC_SECRET ?? "").trim(),
  };
}

export function isOfficialCheckConfigured(env: GovernmentLiveEnv = process.env) {
  const config = readEngineBridgeConfig(env);
  return Boolean(config.webhookUrl && config.hmacSecret);
}

export function getOfficialCheckAvailability(env: GovernmentLiveEnv = process.env) {
  const configured = isOfficialCheckConfigured(env);
  return {
    imss: configured,
    sat: configured,
    infonavit: false,
    any: configured,
  };
}

export function normalizeNss(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const digits = String(value).replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 11 ? digits : null;
}

export function normalizeCurp(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return /^[A-Z]{4}\d{6}[A-Z]{6}[0-9A-Z]{2}$/.test(normalized) ? normalized : null;
}

export { isGenericSatRfc };

export function normalizeRfc(value: unknown, options?: { allowGeneric?: boolean }): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase().replace(/[^A-Z0-9Ñ&]/g, "");
  if (normalized.length < 12 || normalized.length > 13) return null;
  if (!options?.allowGeneric && isGenericSatRfc(normalized)) return null;
  return normalized;
}

const NSS_LABELED_RE =
  /(?:nss|n\.?\s*s\.?\s*s\.?|num(?:ero)?\s+(?:de\s+)?seguro\s+social|seguridad\s+social|numseguridadsocial)\D{0,16}((?:\d[\s.\-]*){10,11})/i;
const NSS_BARE_RE = /\b(\d{11})\b/;
const CURP_LABELED_RE = /(?:curp)\D{0,16}((?:[A-Z0-9][\s.\-]*){18})/i;
const CURP_BARE_RE = /\b([A-Z]{4}\d{6}[A-Z]{6}[0-9A-Z]{2})\b/;
const RFC_TRABAJADOR_RE =
  /rfc\s+(?:del\s+)?(?:trabajador|receptor|empleado)[:\s]*([A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3})/i;
const RFC_BARE_RE = /\b([A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3})\b/g;

function walkIdentityRecords(root: unknown, visit: (record: Record<string, unknown>) => void) {
  const seen = new Set<unknown>();
  const stack = [root];
  while (stack.length) {
    const current = stack.pop();
    if (!current || typeof current !== "object") continue;
    if (seen.has(current)) continue;
    seen.add(current);
    if (Array.isArray(current)) {
      stack.push(...current);
      continue;
    }
    visit(current as Record<string, unknown>);
    for (const child of Object.values(current)) {
      if (child && typeof child === "object") stack.push(child);
    }
  }
}

export function extractReceiptOfficialIdentity(source: unknown): WorkerOfficialIdentity {
  const found: WorkerOfficialIdentity = { nss: null, curp: null, rfc: null };
  const texts: string[] = [];

  if (typeof source === "string") {
    texts.push(source);
  } else if (source && typeof source === "object") {
    walkIdentityRecords(source, (record) => {
      for (const [key, value] of Object.entries(record)) {
        const compact = key.replace(/[^a-z0-9]/gi, "").toLowerCase();
        if (!found.nss && /nss|numseguridadsocial|numeroseguridadsocial|numerosegurosocial|segurosocial/.test(compact)) {
          found.nss = normalizeNss(value);
        }
        if (!found.curp && compact.includes("curp")) {
          found.curp = normalizeCurp(value);
        }
        if (
          !found.rfc &&
          /rfctrabajador|rfcreceptor|rfcempleado|rfcworker|workerrfc/.test(compact)
        ) {
          found.rfc = normalizeRfc(value, { allowGeneric: true });
        }
        if (typeof value === "string" || typeof value === "number") {
          texts.push(String(value));
        }
      }
    });
    try {
      texts.push(JSON.stringify(source));
    } catch {
      // El recibo no era serializable; se sigue con los textos ya vistos.
    }
  }

  const haystack = texts.join(" ");
  if (!found.nss) {
    const labeled = haystack.match(NSS_LABELED_RE);
    found.nss = normalizeNss(labeled?.[1]) ?? normalizeNss(haystack.match(NSS_BARE_RE)?.[1]);
  }
  if (!found.curp) {
    found.curp =
      normalizeCurp(haystack.match(CURP_LABELED_RE)?.[1]) ??
      normalizeCurp(haystack.match(CURP_BARE_RE)?.[1]);
  }
  if (!found.rfc) {
    found.rfc = normalizeRfc(haystack.match(RFC_TRABAJADOR_RE)?.[1], { allowGeneric: true });
    if (!found.rfc) {
      const physical = [...haystack.toUpperCase().matchAll(RFC_BARE_RE)]
        .map((item) => normalizeRfc(item[1]))
        .find((item) => item && item.length === 13);
      found.rfc = physical ?? null;
    }
  }
  return found;
}

export function collectWorkerOfficialIdentity(facts: {
  nss?: unknown;
  curp?: unknown;
  workerRfc?: unknown;
  rfc?: unknown;
  text?: unknown;
  haystack?: unknown;
  employerRfc?: unknown;
}): WorkerOfficialIdentity {
  const fromFacts = {
    nss: normalizeNss(facts.nss),
    curp: normalizeCurp(facts.curp),
    rfc: normalizeRfc(facts.workerRfc ?? facts.rfc, { allowGeneric: Boolean(facts.workerRfc) }),
  };
  const extracted = extractReceiptOfficialIdentity(facts.haystack ?? facts.text ?? facts);
  const rfc = fromFacts.rfc ?? extracted.rfc;
  const employerRfc = normalizeRfc(facts.employerRfc, { allowGeneric: true });
  return {
    nss: fromFacts.nss ?? extracted.nss,
    curp: fromFacts.curp ?? extracted.curp,
    rfc: rfc && rfc !== employerRfc ? rfc : null,
  };
}

export function mergeWorkerOfficialIdentities(
  ...identities: Array<WorkerOfficialIdentity | null | undefined>
): WorkerOfficialIdentity {
  return {
    nss: identities.find((item) => item?.nss)?.nss ?? null,
    curp: identities.find((item) => item?.curp)?.curp ?? null,
    rfc: identities.find((item) => item?.rfc)?.rfc ?? null,
  };
}

/** Mismo trabajador si coincide NSS, CURP o RFC. No usa el RFC del patrón. */
export function fiscalIdentitiesMatch(
  left?: WorkerOfficialIdentity | null,
  right?: WorkerOfficialIdentity | null,
): boolean {
  if (!left || !right) return false;
  if (left.nss && right.nss && left.nss === right.nss) return true;
  if (left.curp && right.curp && left.curp === right.curp) return true;
  if (left.rfc && right.rfc && left.rfc === right.rfc) return true;
  return false;
}

function identityFlags(identity: WorkerOfficialIdentity): OfficialIdentityFlags {
  return {
    nss: Boolean(identity.nss),
    curp: Boolean(identity.curp),
    rfc: Boolean(identity.rfc),
  };
}

function hasAnyIdentity(identity: WorkerOfficialIdentity) {
  return Boolean(identity.nss || identity.curp || identity.rfc);
}

function sourceCheck(
  source: OfficialSourceCheck["source"],
  status: OfficialCheckStatus,
  extra?: Partial<Pick<OfficialSourceCheck, "checkedAt" | "used" | "detail" | "honesty" | "hechos" | "motivoFallo" | "missingFields">>,
): OfficialSourceCheck {
  return {
    source,
    sourceLabel: SOURCE_LABEL[source],
    status,
    label: OFFICIAL_CHECK_STATUS_LABEL[status],
    detail:
      extra?.detail ??
      extra?.motivoFallo ??
      (status === "no_se_pudo" ? buildOfficialFailedDetail([source]) : OFFICIAL_CHECK_STATUS_DETAIL[status]),
    checkedAt: extra?.checkedAt ?? null,
    used: extra?.used ?? { nss: false, curp: false, rfc: false },
    honesty: extra?.honesty ?? officialStatusToHonesty(status),
    hechos: extra?.hechos?.slice(0, 3) ?? [],
    motivoFallo:
      extra?.motivoFallo !== undefined
        ? extra.motivoFallo
        : status === "no_se_pudo"
          ? rewriteOfficialFailedMotivo(source, extra?.detail)
          : null,
    missingFields: extra?.missingFields ?? [],
  };
}

function rollupStatus(statuses: OfficialCheckStatus[]): OfficialCheckStatus {
  if (statuses.includes("vivo")) return "vivo";
  if (statuses.every((status) => status === "no_configurado")) return "no_configurado";
  if (statuses.every((status) => status === "sin_datos")) return "sin_datos";
  if (statuses.every((status) => status === "sin_permiso")) return "sin_permiso";
  if (statuses.includes("pendiente")) return "pendiente";
  if (statuses.includes("no_se_pudo")) return "no_se_pudo";
  return statuses[0] ?? "no_se_pudo";
}

function emptySummary(status: OfficialCheckStatus, identity: WorkerOfficialIdentity): OfficialCheckSummary {
  return {
    configured: false,
    consentGranted: false,
    overallStatus: status,
    overallLabel: OFFICIAL_CHECK_STATUS_LABEL[status],
    overallDetail: OFFICIAL_CHECK_STATUS_DETAIL[status],
    checkedAt: null,
    identity: identityFlags(identity),
    checks: [],
  };
}

function fitBridgeField(value: string | null | undefined, min: number, max: number) {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (trimmed.length < min || trimmed.length > max) return undefined;
  return trimmed;
}

export type OfficialReceiptBridgeFacts = {
  employerRfc?: string | null;
  workerName?: string | null;
  employerName?: string | null;
  salary?: string | null;
  sdi?: string | null;
  netAmount?: string | null;
  perceptions?: string | null;
  imssWithheld?: string | null;
  infonavitWithheld?: string | null;
  period?: string | null;
  employerRegistration?: string | null;
  folio?: string | null;
  uuid?: string | null;
};

export function officialReceiptFromLaborFacts(facts: OfficialReceiptBridgeFacts | null | undefined): OfficialReceiptBridgeFacts {
  return {
    employerRfc: facts?.employerRfc ?? null,
    workerName: facts?.workerName ?? null,
    employerName: facts?.employerName ?? null,
    salary: facts?.salary ?? null,
    sdi: facts?.sdi ?? null,
    netAmount: facts?.netAmount ?? null,
    perceptions: facts?.perceptions ?? null,
    imssWithheld: facts?.imssWithheld ?? null,
    infonavitWithheld: facts?.infonavitWithheld ?? null,
    period: facts?.period ?? null,
    employerRegistration: facts?.employerRegistration ?? null,
    folio: facts?.folio ?? null,
    uuid: facts?.uuid ?? null,
  };
}

function putReceiptField(target: Record<string, string>, key: string, value: string | null | undefined, max = 80) {
  const fitted = fitBridgeField(value, 1, max);
  if (fitted) target[key] = fitted;
}

export function buildOfficialCheckBridgePayload(params: {
  identity: WorkerOfficialIdentity;
  nowIso: string;
  idempotencyKey?: string;
  correlationId?: string;
  traceId?: string | null;
  caseId?: string | null;
  sourceDocumentId?: string | null;
  receipt?: OfficialReceiptBridgeFacts | null;
}) {
  const autonomousInput: Record<string, string> = {};
  if (params.identity.nss) autonomousInput.nss = params.identity.nss;
  if (params.identity.curp) autonomousInput.curp = params.identity.curp;
  if (params.identity.rfc) autonomousInput.rfc = params.identity.rfc;
  const receipt = officialReceiptFromLaborFacts(params.receipt);
  const receiptFields: Record<string, string> = {};
  putReceiptField(receiptFields, "rfcPatron", receipt.employerRfc, 13);
  putReceiptField(receiptFields, "salario", receipt.salary, 40);
  putReceiptField(receiptFields, "sdi", receipt.sdi, 40);
  putReceiptField(receiptFields, "neto", receipt.netAmount, 40);
  putReceiptField(receiptFields, "percepciones", receipt.perceptions, 40);
  putReceiptField(receiptFields, "descuentoImss", receipt.imssWithheld, 40);
  putReceiptField(receiptFields, "descuentoInfonavit", receipt.infonavitWithheld, 40);
  putReceiptField(receiptFields, "periodo", receipt.period, 80);
  putReceiptField(receiptFields, "nombreTrabajador", receipt.workerName, 120);
  putReceiptField(receiptFields, "nombrePatron", receipt.employerName, 160);
  putReceiptField(receiptFields, "registroPatronal", receipt.employerRegistration, 20);
  putReceiptField(receiptFields, "folio", receipt.folio, 40);
  putReceiptField(receiptFields, "uuid", receipt.uuid, 64);
  Object.assign(autonomousInput, receiptFields);

  const worker = {
    nss: params.identity.nss,
    curp: params.identity.curp,
    rfc: params.identity.rfc,
  };
  const recibo = {
    nss: params.identity.nss,
    curp: params.identity.curp,
    rfc: params.identity.rfc,
    ...receiptFields,
  };

  return {
    action: OFFICIAL_CHECK_ACTION,
    eventName: OFFICIAL_CHECK_EVENT,
    event: OFFICIAL_CHECK_EVENT,
    consentGranted: true,
    sources: params.identity.curp ? ["imss", "sat", "infonavit"] : ["imss", "sat"],
    autonomousInput,
    worker,
    identity: worker,
    workerIdentity: worker,
    nss: params.identity.nss,
    curp: params.identity.curp,
    rfc: params.identity.rfc,
    patronRfc: receiptFields.rfcPatron ?? null,
    salary: receiptFields.salario ?? null,
    recibo,
    sourceModule: "auditapatron_official_check",
    requestedAt: params.nowIso,
    idempotencyKey: params.idempotencyKey,
    correlationId: fitBridgeField(params.correlationId, 4, 180) ?? fitBridgeField(params.traceId, 4, 180),
    traceId: fitBridgeField(params.traceId, 8, 180),
    sourceCaseId: fitBridgeField(params.caseId, 1, 120),
    sourceDocumentId: fitBridgeField(params.sourceDocumentId, 1, 120),
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function collectHaystack(value: unknown): string {
  try {
    return JSON.stringify(value ?? "").toLowerCase();
  } catch {
    return "";
  }
}

const PENDING_HINT = /mantenimiento|temporarily unavailable|retry|queued|pending|en curso|en progreso/;
const LIVE_HINT =
  /\b(imss|sat|vigencia|semanas|cotiz|rfc|nss|curp|alta|baja|constancia|situacion fiscal|situación fiscal|connector|historial)\b/;

function looksLikeLiveInstituteResult(payload: unknown): boolean {
  const root = asRecord(payload);
  if (!root) return false;
  if (root.received && !root.result && !root.imss && !root.sat) return false;

  const result = asRecord(root.result) ?? root;
  if (result.imss || result.sat || result.imssStatus || result.satStatus) return true;
  if (result.connectors || result.verifications || result.official) return true;

  const action = String(root.action ?? "");
  if (root.ok === true && (action === OFFICIAL_CHECK_ACTION || action === "verify") && root.result) {
    return true;
  }

  const haystack = collectHaystack(result);
  return LIVE_HINT.test(haystack) && !/\breceived\b/.test(haystack);
}

function readSourceStatusFromResult(
  payload: unknown,
  source: OfficialSourceCheck["source"],
): OfficialCheckStatus | null {
  const root = asRecord(payload);
  if (!root) return null;
  const result = asRecord(root.result) ?? root;
  const direct = result[source] ?? result[`${source}Status`] ?? asRecord(result.sources)?.[source];
  if (typeof direct === "string") {
    const normalized = direct.trim().toLowerCase();
    if (normalized === "vivo" || normalized === "pendiente" || normalized === "no_se_pudo") {
      return normalized;
    }
    if (looksLikeNoOfficialResponse(normalized)) return "no_se_pudo";
    if (PENDING_HINT.test(normalized)) return "pendiente";
    if (normalized) return "vivo";
  }
  if (direct && typeof direct === "object") {
    const status = String((direct as { status?: unknown; honesty?: unknown }).honesty ?? (direct as { status?: unknown }).status ?? "").toLowerCase();
    const haystack = collectHaystack(direct);
    if (status === "vivo" || status === "live") return "vivo";
    if (status === "pendiente" || status === "pending") return "pendiente";
    if (status === "no_se_pudo" || status === "failed" || status === "fallo" || status === "falló") return "no_se_pudo";
    if (/503|service unavailable/.test(haystack) || looksLikeInstituteMaintenance(haystack)) return "no_se_pudo";
    if (looksLikeNoOfficialResponse(status) || looksLikeNoOfficialResponse(haystack)) return "no_se_pudo";
    if (PENDING_HINT.test(status) || PENDING_HINT.test(haystack)) return "pendiente";
    return "vivo";
  }
  return null;
}

export function classifyBridgeOfficialCheck(result: SignedEnginePostResult): OfficialCheckStatus {
  const haystack = `${collectHaystack(result.responseJson)} ${result.reason ?? ""}`;
  if (result.ok) {
    if (looksLikeLiveInstituteResult(result.responseJson)) return "vivo";
    return "pendiente";
  }

  if (/mantenimiento/.test(haystack)) {
    return "pendiente";
  }
  if (result.reason === "timeout" || looksLikeNoOfficialResponse(haystack)) {
    return "no_se_pudo";
  }
  if (result.reason === "retryable_http" || result.reason === "server_error") {
    return /mantenimiento/.test(haystack) ? "pendiente" : "no_se_pudo";
  }
  if (result.httpStatus === 429) {
    return "pendiente";
  }
  if (result.httpStatus !== null && result.httpStatus >= 500) {
    return /mantenimiento/.test(haystack) ? "pendiente" : "no_se_pudo";
  }
  if (result.httpStatus === 404) {
    return "no_se_pudo";
  }
  if (result.reason === "hmac_failed" || result.reason === "authentication_failed") {
    return "no_se_pudo";
  }
  if (result.reason === "redirect_without_hmac_headers") {
    return "no_se_pudo";
  }
  if (result.reason === "network_error") {
    return "no_se_pudo";
  }
  return "no_se_pudo";
}

const CONSULTED_BRIDGE_SOURCES: OfficialCheckSource[] = ["imss", "sat"];

const PROVIDER_CAP_RE = /acceso gratuito solo puedes revisar un proveedor/i;

function isProviderCapBridgeFailure(posted: SignedEnginePostResult): boolean {
  if (posted.reason === "provider_cap") return true;
  return PROVIDER_CAP_RE.test(`${collectHaystack(posted.responseJson)} ${posted.responseBody ?? ""}`);
}

function officialCheckHasLiveSource(summary: OfficialCheckSummary | null | undefined): boolean {
  return Boolean(summary?.checks?.some((item) => item.status === "vivo" || item.honesty === "live"));
}

function workerDetailForBridgeResult(
  status: OfficialCheckStatus,
  posted: SignedEnginePostResult,
  sources: OfficialCheckSource[] = CONSULTED_BRIDGE_SOURCES,
): string {
  const haystack = `${collectHaystack(posted.responseJson)} ${posted.reason ?? ""}`;
  if (status === "pendiente" && looksLikeInstituteMaintenance(haystack)) {
    return buildOfficialMaintenanceDetail(sources);
  }
  if (status === "no_se_pudo") {
    return buildOfficialFailedDetail(sources);
  }
  return OFFICIAL_CHECK_STATUS_DETAIL[status];
}

/**
 * Honestidad de la consulta, no la opinión fiscal.
 * `opinionStatus: pendiente` (la opinión aún no sale) no es «la fuente no contestó».
 * `resultado: vivo` o `honesty: live` ganan sobre un status pendiente.
 */
function consultHonesty(record: Record<string, unknown> | null): string | null {
  if (!record) return null;
  const honesty = String(record.honesty ?? "").trim().toLowerCase();
  const estado = String(record.estado ?? "").trim().toLowerCase();
  const resultado = String(record.resultado ?? "").trim().toLowerCase();
  if (honesty === "live" || estado === "live" || resultado === "vivo" || resultado === "live") return "live";
  if (honesty === "failed" || estado === "failed" || resultado === "no_se_pudo") return "failed";
  if (honesty === "pending" || estado === "pending" || resultado === "pendiente") return "pending";
  const status = String(record.status ?? "").trim().toLowerCase();
  if (
    status === "live" ||
    status === "vivo" ||
    status === "pending" ||
    status === "pendiente" ||
    status === "failed" ||
    status === "no_se_pudo" ||
    status === "fallo" ||
    status === "falló"
  ) {
    return status;
  }
  return null;
}

function flatSourceHonesty(
  roots: Array<Record<string, unknown> | null>,
  source: OfficialSourceCheck["source"],
): string | null {
  const names = {
    sat: ["satHonesty", "sat_honesty"],
    imss: ["imssHonesty", "imss_honesty"],
    infonavit: ["infonavitHonesty", "infonavit_honesty"],
  }[source];
  for (const root of roots) {
    if (!root) continue;
    for (const name of names) {
      const value = root[name] ?? asRecord(root.result)?.[name] ?? asRecord(root.officialCheck)?.[name];
      if (typeof value === "string" && value.trim()) return value.trim().toLowerCase();
    }
  }
  return null;
}

function withFlatHonesty(
  value: unknown,
  source: OfficialSourceCheck["source"],
  roots: Array<Record<string, unknown> | null>,
): unknown {
  const flat = flatSourceHonesty(roots, source);
  if (flat !== "live") return value;
  const record = asRecord(value) ?? {};
  if (consultHonesty(record) === "live") return value ?? record;
  return { ...record, honesty: "live" };
}

function normalizeReturnedOfficialStatus(value: unknown): OfficialCheckStatus | null {
  if (value == null) return null;
  if (typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    const declared = consultHonesty(record);
    if (declared === "live" || declared === "vivo") return "vivo";
    if (declared === "failed" || declared === "no_se_pudo" || declared === "fallo" || declared === "falló") {
      return "no_se_pudo";
    }
    if (declared === "pending" || declared === "pendiente") return "pendiente";
    return (
      normalizeReturnedOfficialStatus(record.status) ??
      normalizeReturnedOfficialStatus(record.state) ??
      normalizeReturnedOfficialStatus(record.result) ??
      normalizeReturnedOfficialStatus(record.outcome)
    );
  }

  const text = String(value).trim().toLowerCase();
  if (!text) return null;
  if (text === "vivo" || text === "live" || text === "ok" || /vigente|registrad|alta|hecho/.test(text)) {
    return "vivo";
  }
  if (
    text === "no_se_pudo" ||
    text === "fallo" ||
    text === "falló" ||
    text === "failed" ||
    looksLikeNoOfficialResponse(text) ||
    /fail|error|not_found|rejected|denied/.test(text)
  ) {
    return "no_se_pudo";
  }
  if (text === "pendiente" || text === "pending" || /queued|processing|retry|mantenimiento/.test(text)) {
    return "pendiente";
  }
  return null;
}

function firstRecordText(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function factsFromOfficialRecord(record: Record<string, unknown> | null): string[] {
  if (!record) return [];
  const picked: string[] = [];
  const rfc = typeof record.rfc === "string" ? record.rfc.trim() : "";
  if (rfc && !isGenericSatRfc(rfc)) picked.push(`RFC: ${rfc}`);
  const legalName = firstRecordText(record, ["legalName", "razonSocial", "razon_social", "nombreFiscal"]);
  if (legalName && !isPlaceholderSatLegalName(legalName, rfc)) {
    picked.push(`Nombre del RFC consultado en el SAT: ${legalName.replace(/\.+$/g, "")}.`);
  }
  const personType = firstRecordText(record, ["tipoPersona", "tipo_persona", "personType"]);
  if (personType && !isPlaceholderSatLegalName(personType)) {
    picked.push(`Tipo de persona en SAT: ${personType.replace(/\.+$/g, "")}.`);
  }
  const vigencia = typeof record.vigencia === "string" ? record.vigencia.trim() : "";
  if (vigencia) picked.push(`Vigencia: ${vigencia}`);
  const situacionRaw = record.situacionFiscal ?? record.situacion ?? record["situación"];
  const situacion = typeof situacionRaw === "string" ? situacionRaw.trim() : "";
  if (situacion) picked.push(`Situación: ${situacion}`);
  return picked.slice(0, 3);
}

function readNestedOfficialRecord(
  roots: Array<Record<string, unknown> | null>,
  source: OfficialSourceCheck["source"],
): Record<string, unknown> | null {
  const keys = {
    imss: ["imss", "imssStatus", "imss_status"],
    sat: ["sat", "satStatus", "sat_status"],
    infonavit: ["infonavit", "infonavitStatus", "infonavit_status"],
  }[source];
  for (const root of roots) {
    if (!root) continue;
    const sources = asRecord(root.sources);
    for (const key of keys) {
      const direct = root[key] ?? sources?.[key];
      const record = asRecord(direct);
      if (record) return record;
    }
  }
  return null;
}

function readNestedOfficialSource(
  roots: Array<Record<string, unknown> | null>,
  source: OfficialSourceCheck["source"],
): OfficialCheckStatus | null {
  const keys = {
    imss: ["imss", "imssStatus", "imss_status"],
    sat: ["sat", "satStatus", "sat_status"],
    infonavit: ["infonavit", "infonavitStatus", "infonavit_status"],
  }[source];

  for (const root of roots) {
    if (!root) continue;
    const sources = asRecord(root.sources);
    for (const key of keys) {
      const direct = normalizeReturnedOfficialStatus(root[key] ?? sources?.[key]);
      if (direct) return direct;
    }
  }
  return null;
}

function readOfficialObligationCheck(
  value: unknown,
  source: OfficialSourceCheck["source"],
  fallback: OfficialCheckStatus | null,
  nowIso: string | null,
  used: OfficialIdentityFlags,
): OfficialSourceCheck {
  const record = asRecord(value);
  const hechos = record
    ? (Array.isArray(record.hechos) ? record.hechos.map((item) => String(item).trim()).filter(Boolean).slice(0, 3) : [])
    : [];
  const motivoText =
    (typeof record?.workerReason === "string" ? record.workerReason : null) ??
    (typeof record?.motivoFallo === "string" ? record.motivoFallo : null) ??
    (typeof record?.message === "string" ? record.message : null) ??
    (typeof record?.error === "string" ? record.error : null);
  const missing = filterOfficialMissingFieldsForSource(
    source,
    [
      ...listOfficialMissingFieldKeys(record?.missingFields),
      ...inferOfficialMissingFieldKeys(hechos.join(" ")),
      ...inferOfficialMissingFieldKeys(motivoText),
    ],
    used,
  );
  const fromHonesty = honestyToOfficialStatus(
    consultHonesty(record),
    missing,
    used,
    source,
  );
  const mapped = fromHonesty ?? fallback ?? "pendiente";
  const status =
    mapped === "pendiente" && looksLikeNoOfficialResponse(`${motivoText ?? ""} ${hechos.join(" ")}`)
      ? "no_se_pudo"
      : mapped;
  const anchor = record ? readChatAnchorSource(record, source, used) : null;
  const rawMotivo =
    status === "no_se_pudo" || status === "sin_datos"
      ? motivoText
      : null;
  const motivoFallo =
    status === "sin_datos"
      ? rawMotivo ?? anchor?.motivoFallo ?? null
      : status === "no_se_pudo"
        ? rewriteOfficialFailedMotivo(source, rawMotivo ?? anchor?.motivoFallo)
        : null;
  const resolvedHechos = (() => {
    const own = citeableOfficialHechos(source, hechos);
    const fromAnchor = citeableOfficialHechos(source, anchor?.hechos ?? []);
    if (own.length > 0) return own;
    if (fromAnchor.length > 0) return fromAnchor;
    if (status === "vivo") return factsFromOfficialRecord(record);
    return anchor?.hechos?.length ? anchor.hechos : [];
  })();
  const demoteEmptySat = source === "sat" && status === "vivo" && !hasUsableSatResponse(resolvedHechos);
  const resolvedStatus = demoteEmptySat ? "no_se_pudo" : status;
  return sourceCheck(source, resolvedStatus, {
    checkedAt:
      (typeof record?.checkedAt === "string" ? record.checkedAt : null) ??
      anchor?.fecha ??
      nowIso,
    used: usedOfficialIdentityForSource(source, used),
    honesty: demoteEmptySat ? "failed" : (anchor?.estado ?? officialStatusToHonesty(status)),
    hechos: resolvedHechos,
    motivoFallo: demoteEmptySat
      ? rewriteOfficialFailedMotivo(source, rawMotivo ?? anchor?.motivoFallo)
      : motivoFallo,
    detail:
      resolvedStatus === "no_se_pudo"
        ? buildOfficialFailedDetail([source])
        : rawMotivo ?? undefined,
    missingFields: missing.length > 0 ? missing : filterOfficialMissingFieldsForSource(source, anchor?.missingFields, used),
  });
}

function bridgeContractResult(root: Record<string, unknown>): Record<string, unknown> | null {
  const contracts = [
    asRecord(root.responseContract),
    asRecord(asRecord(root.result)?.responseContract),
    asRecord(asRecord(root.metadata)?.responseContract),
  ];
  for (const contract of contracts) {
    const current = asRecord(contract?.currentResponseEvent);
    const result = asRecord(current?.result);
    if (result) return result;
  }
  return asRecord(asRecord(root.currentResponseEvent)?.result);
}

function pickBridgeResultRoots(root: Record<string, unknown>): Array<Record<string, unknown> | null> {
  const result = asRecord(root.result) ?? asRecord(root.analysisResults) ?? root;
  const currentResult = bridgeContractResult(root);
  const officialCheck =
    asRecord(result?.officialCheck) ??
    asRecord(root.officialCheck) ??
    asRecord(currentResult?.officialCheck);
  const extracted = asRecord(root.extractedFields);
  const metadata = asRecord(root.metadata);
  const official = asRecord(result?.official) ?? asRecord(metadata?.official) ?? asRecord(metadata?.live_check);
  return [officialCheck, currentResult, official, result, extracted, metadata, root];
}

export function officialCheckFromBridgeReturn(params: {
  payload: Record<string, unknown> | null | undefined;
  identity?: OfficialIdentityFlags;
  nowIso?: string;
}): OfficialCheckSummary | null {
  const root = asRecord(params.payload);
  if (!root) return null;
  const institutePay = readInstitutePayFacts(root);

  const eventName = String(root.event ?? root.eventName ?? "");
  if (eventName && eventName !== "document.processed.v1" && root.action !== "official_check") {
    if (eventName === "document.rejected.v1") {
      const failed: OfficialCheckStatus = "no_se_pudo";
      return {
        configured: true,
        consentGranted: true,
        overallStatus: failed,
        overallLabel: OFFICIAL_CHECK_STATUS_LABEL[failed],
        overallDetail: buildOfficialFailedDetail(["imss", "sat", "infonavit"]),
        checkedAt: params.nowIso ?? null,
        identity: params.identity ?? { nss: false, curp: false, rfc: false },
        checks: [
          sourceCheck("imss", failed, { checkedAt: params.nowIso ?? null }),
          sourceCheck("sat", failed, { checkedAt: params.nowIso ?? null }),
          sourceCheck("infonavit", failed, { checkedAt: params.nowIso ?? null }),
        ],
        chatAnchor: null,
        reciboVsOficial: null,
        institutePay,
      };
    }
    return null;
  }

  const roots = pickBridgeResultRoots(root);
  const result = asRecord(root.result) ?? asRecord(root.analysisResults) ?? root;
  const currentResult = bridgeContractResult(root);
  const officialCheck =
    asRecord(result?.officialCheck) ??
    asRecord(root.officialCheck) ??
    asRecord(currentResult?.officialCheck);
  const used = params.identity ?? { nss: false, curp: false, rfc: false };
  const knownIdentity = Boolean(params.identity);
  const chatAnchor =
    readChatAnchor(result?.chatAnchor, used) ??
    readChatAnchor(root.chatAnchor, used) ??
    readChatAnchor(officialCheck?.chatAnchor, used) ??
    readChatAnchor(currentResult?.chatAnchor, used);
  const reciboVsOficial: ReciboVsOficial | null =
    readReciboVsOficial(result?.reciboVsOficial) ??
    readReciboVsOficial(result?.receiptVsOfficial) ??
    readReciboVsOficial(root.reciboVsOficial) ??
    readReciboVsOficial(root.receiptVsOfficial) ??
    readReciboVsOficial(currentResult?.reciboVsOficial) ??
    readReciboVsOficial(currentResult?.receiptVsOfficial);
  const nowIso = params.nowIso ?? null;
  const alternateRoute = readAlternateOfficialRoute(root) || undefined;
  const imssStatus = readNestedOfficialSource(roots, "imss");
  const satStatus = readNestedOfficialSource(roots, "sat");
  const infonavitStatus = readNestedOfficialSource(roots, "infonavit");
  const hasClkShape = Boolean(officialCheck?.sat || officialCheck?.imss || officialCheck?.infonavit || chatAnchor);

  if (!imssStatus && !satStatus && !infonavitStatus && !hasClkShape) {
    if (eventName === "document.processed.v1") {
      return {
        configured: true,
        consentGranted: true,
        overallStatus: "pendiente",
        overallLabel: OFFICIAL_CHECK_STATUS_LABEL.pendiente,
        overallDetail: OFFICIAL_CHECK_STATUS_DETAIL.pendiente,
        checkedAt: nowIso,
        identity: used,
        checks: [
          sourceCheck("imss", !knownIdentity || used.nss ? "pendiente" : "sin_datos", {
            checkedAt: nowIso,
            used: usedOfficialIdentityForSource("imss", used),
            missingFields: knownIdentity ? missingOfficialFieldsForSource("imss", used) : [],
          }),
          sourceCheck("sat", !knownIdentity || used.rfc ? "pendiente" : "sin_datos", {
            checkedAt: nowIso,
            used: usedOfficialIdentityForSource("sat", used),
            missingFields: knownIdentity ? missingOfficialFieldsForSource("sat", used) : [],
          }),
          sourceCheck("infonavit", !knownIdentity || used.curp ? "pendiente" : "sin_datos", {
            checkedAt: nowIso,
            used: usedOfficialIdentityForSource("infonavit", used),
            missingFields: knownIdentity ? missingOfficialFieldsForSource("infonavit", used) : [],
          }),
        ],
        chatAnchor,
        reciboVsOficial,
        institutePay,
      };
    }
    return null;
  }

  const checks = [
    readOfficialObligationCheck(
      withFlatHonesty(officialCheck?.imss ?? chatAnchor?.imss ?? readNestedOfficialRecord(roots, "imss"), "imss", roots),
      "imss",
      imssStatus,
      nowIso,
      used,
    ),
    readOfficialObligationCheck(
      withFlatHonesty(officialCheck?.sat ?? chatAnchor?.sat ?? readNestedOfficialRecord(roots, "sat"), "sat", roots),
      "sat",
      satStatus,
      nowIso,
      used,
    ),
    readOfficialObligationCheck(
      withFlatHonesty(
        officialCheck?.infonavit ?? chatAnchor?.infonavit ?? readNestedOfficialRecord(roots, "infonavit"),
        "infonavit",
        roots,
      ),
      "infonavit",
      infonavitStatus,
      nowIso,
      used,
    ),
  ];
  const overallStatus = rollupStatus(checks.map((item) => item.status));
  const mergeMissing = (source: NonNullable<OfficialChatAnchor>[string], check: OfficialSourceCheck) => {
    const merged = readChatAnchorSource(
      {
        ...source,
        honesty: check.honesty ?? source.estado,
        estado: check.status === "no_se_pudo" ? "failed" : check.status === "vivo" ? "live" : source.estado,
        workerReason: source.motivoFallo ?? check.motivoFallo,
        motivoFallo: source.motivoFallo ?? check.motivoFallo,
        hechos: source.hechos.length > 0 ? source.hechos : check.hechos,
        missingFields: filterOfficialMissingFieldsForSource(
          source.fuente,
          [
            ...listOfficialMissingFieldKeys(source.missingFields),
            ...listOfficialMissingFieldKeys(check.missingFields),
          ],
          used,
        ),
        fecha: source.fecha ?? check.checkedAt,
        checkedAt: source.fecha ?? check.checkedAt,
      },
      source.fuente,
      used,
    );
    return {
      ...merged,
      fecha: merged.fecha ?? check.checkedAt ?? nowIso,
    };
  };
  const resolvedAnchor: OfficialChatAnchor | null =
    chatAnchor
      ? {
          imss: mergeMissing(chatAnchor.imss, checks[0]),
          sat: mergeMissing(chatAnchor.sat, checks[1]),
          infonavit: mergeMissing(chatAnchor.infonavit, checks[2]),
        }
      : ({
      imss: readChatAnchorSource({
        ...checks[0],
        estado: checks[0].honesty,
        fecha: checks[0].checkedAt,
        missingFields: checks[0].missingFields,
      }, "imss", used),
      sat: readChatAnchorSource({
        ...checks[1],
        estado: checks[1].honesty,
        fecha: checks[1].checkedAt,
        missingFields: checks[1].missingFields,
      }, "sat", used),
      infonavit: readChatAnchorSource({
        ...checks[2],
        estado: checks[2].honesty,
        fecha: checks[2].checkedAt,
        missingFields: checks[2].missingFields,
      }, "infonavit", used),
    } satisfies OfficialChatAnchor);
  const identity = used;
  const failedSources = listFailedOfficialSources(checks);
  const overallDetail =
    overallStatus === "sin_datos"
      ? officialIdentityGapDetail(identity)
      : overallStatus === "no_se_pudo"
        ? buildOfficialFailedDetail(failedSources)
        : OFFICIAL_CHECK_STATUS_DETAIL[overallStatus];

  return {
    configured: true,
    consentGranted: true,
    overallStatus,
    overallLabel: OFFICIAL_CHECK_STATUS_LABEL[overallStatus],
    overallDetail,
    checkedAt: nowIso,
    identity,
    checks,
    chatAnchor: resolvedAnchor,
    reciboVsOficial,
    institutePay,
    alternateRoute,
  };
}

export async function runOfficialGovernmentCheck(params: {
  identity: WorkerOfficialIdentity;
  consentGranted: boolean;
  env?: GovernmentLiveEnv;
  now?: Date;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  idempotencyKey?: string;
  correlationId?: string;
  traceId?: string | null;
  caseId?: string | null;
  sourceDocumentId?: string | null;
  receipt?: OfficialReceiptBridgeFacts | null;
}): Promise<OfficialCheckSummary> {
  const env = params.env ?? process.env;
  const identity = {
    nss: normalizeNss(params.identity.nss),
    curp: normalizeCurp(params.identity.curp),
    rfc: normalizeRfc(params.identity.rfc, { allowGeneric: true }),
  };
  const engine = readEngineBridgeConfig(env);
  const configured = Boolean(engine.webhookUrl && engine.hmacSecret);
  const nowIso = (params.now ?? new Date()).toISOString();
  const used = identityFlags(identity);

  if (!configured) {
    return {
      ...emptySummary("no_configurado", identity),
      configured: false,
      consentGranted: params.consentGranted,
    };
  }

  if (!params.consentGranted) {
    return {
      ...emptySummary("sin_permiso", identity),
      configured: true,
      consentGranted: false,
      overallDetail: `${OFFICIAL_CHECK_STATUS_DETAIL.sin_permiso} ${OFFICIAL_CHECK_CONSENT}`,
    };
  }

  if (!hasAnyIdentity(identity)) {
    return {
      ...emptySummary("sin_datos", identity),
      configured: true,
      consentGranted: true,
      checkedAt: nowIso,
      overallDetail: officialIdentityGapDetail(identityFlags(identity)),
    };
  }

  const payload = buildOfficialCheckBridgePayload({
    identity,
    nowIso,
    idempotencyKey: params.idempotencyKey,
    correlationId: params.correlationId,
    traceId: params.traceId,
    caseId: params.caseId,
    sourceDocumentId: params.sourceDocumentId,
    receipt: params.receipt,
  });

  const targetUrls = resolveOfficialCheckTargetUrls(String(env.AUDITAPATRON_ENGINE_WEBHOOK_URL ?? engine.webhookUrl));
  let posted: SignedEnginePostResult | null = null;
  for (const url of targetUrls.length > 0 ? targetUrls : [engine.webhookUrl]) {
    posted = await postSignedAuditaPatronEngine({
      url,
      payload,
      hmacSecret: engine.hmacSecret,
      timeoutMs: GOVERNMENT_LIVE_TIMEOUT_MS,
      maxAttempts: GOVERNMENT_LIVE_MAX_ATTEMPTS,
      retryTimeouts: false,
      fetchImpl: params.fetchImpl,
      sleep: params.sleep,
      now: params.now,
    });
    if (posted.ok) break;
    if (posted.reason === "hmac_failed" || posted.reason === "authentication_failed") break;
    if (posted.reason === "timeout" || posted.reason === "retryable_http" || posted.reason === "server_error") {
      break;
    }
    if (posted.httpStatus === 404 || posted.reason === "redirect_without_hmac_headers") {
      continue;
    }
    break;
  }
  if (!posted) {
    return {
      ...emptySummary("no_se_pudo", identity),
      configured: true,
      consentGranted: true,
    };
  }

  const fromReturn = officialCheckFromBridgeReturn({
    payload: asRecord(posted.responseJson),
    identity: used,
    nowIso,
  });
  const providerCap = isProviderCapBridgeFailure(posted);
  if (providerCap && !officialCheckHasLiveSource(fromReturn)) {
    return {
      configured: true,
      consentGranted: true,
      overallStatus: "pendiente",
      overallLabel: OFFICIAL_CHECK_STATUS_LABEL.pendiente,
      overallDetail: OFFICIAL_CHECK_STATUS_DETAIL.pendiente,
      checkedAt: nowIso,
      identity: used,
      bridgeBlock: "provider_cap",
      checks: [
        sourceCheck("imss", identity.nss ? "pendiente" : "sin_datos", {
          checkedAt: nowIso,
          used: usedOfficialIdentityForSource("imss", used),
          missingFields: missingOfficialFieldsForSource("imss", used),
        }),
        sourceCheck("sat", identity.rfc ? "pendiente" : "sin_datos", {
          checkedAt: nowIso,
          used: usedOfficialIdentityForSource("sat", used),
          missingFields: missingOfficialFieldsForSource("sat", used),
        }),
        sourceCheck("infonavit", identity.curp ? "pendiente" : "sin_datos", {
          checkedAt: nowIso,
          used: usedOfficialIdentityForSource("infonavit", used),
          missingFields: missingOfficialFieldsForSource("infonavit", used),
        }),
      ],
      chatAnchor: null,
      reciboVsOficial: null,
    };
  }
  if (fromReturn) {
    const mergedIdentity = {
      nss: used.nss || Boolean(fromReturn.identity?.nss),
      curp: used.curp || Boolean(fromReturn.identity?.curp),
      rfc: used.rfc || Boolean(fromReturn.identity?.rfc),
    };
    const reconciled = reconcileOfficialCheckWithIdentity(
      {
        ...fromReturn,
        configured: true,
        consentGranted: true,
        identity: mergedIdentity,
      },
      mergedIdentity,
      { nowMs: (params.now ?? new Date()).getTime() },
    );
    const resolved = reconciled ?? fromReturn;
    return {
      ...resolved,
      configured: true,
      consentGranted: true,
      identity: mergedIdentity,
      overallDetail:
        resolved.overallStatus === "sin_datos"
          ? resolved.overallDetail
          : resolved.overallDetail || workerDetailForBridgeResult(resolved.overallStatus, posted),
    };
  }

  const overallStatus = classifyBridgeOfficialCheck(posted);
  const imssStatus = readSourceStatusFromResult(posted.responseJson, "imss") ?? overallStatus;
  const satStatus = readSourceStatusFromResult(posted.responseJson, "sat") ?? overallStatus;
  const infonavitStatus = readSourceStatusFromResult(posted.responseJson, "infonavit") ?? overallStatus;
  const responseRoot = asRecord(posted.responseJson);
  const satRecord = responseRoot ? readNestedOfficialRecord(pickBridgeResultRoots(responseRoot), "sat") : null;
  const satHechos = satStatus === "vivo" ? factsFromOfficialRecord(satRecord) : [];
  const checks = [
    sourceCheck("imss", identity.nss ? imssStatus : "sin_datos", {
      checkedAt: nowIso,
      used: usedOfficialIdentityForSource("imss", used),
      missingFields: missingOfficialFieldsForSource("imss", used),
    }),
    sourceCheck("sat", identity.rfc ? satStatus : "sin_datos", {
      checkedAt: nowIso,
      used: usedOfficialIdentityForSource("sat", used),
      missingFields: missingOfficialFieldsForSource("sat", used),
      hechos: satHechos,
    }),
    sourceCheck("infonavit", identity.curp ? infonavitStatus : "sin_datos", {
      checkedAt: nowIso,
      used: usedOfficialIdentityForSource("infonavit", used),
      missingFields: missingOfficialFieldsForSource("infonavit", used),
    }),
  ];
  const rolled = rollupStatus(checks.map((item) => item.status));

  return {
    configured: true,
    consentGranted: true,
    overallStatus: rolled,
    overallLabel: OFFICIAL_CHECK_STATUS_LABEL[rolled],
    overallDetail: workerDetailForBridgeResult(rolled, posted),
    checkedAt: nowIso,
    identity: used,
    checks,
    chatAnchor: null,
    reciboVsOficial: null,
    institutePay: readInstitutePayFacts(posted.responseJson),
  };
}

export function readOfficialCheckFromMetadata(metadata: Record<string, unknown> | null | undefined): OfficialCheckSummary | null {
  const raw = metadata?.live_check ?? metadata?.liveCheck;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const record = raw as OfficialCheckSummary;
  if (!record.overallStatus) return null;
  return record;
}

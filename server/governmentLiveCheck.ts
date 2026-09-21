import {
  OFFICIAL_CHECK_CONSENT,
  OFFICIAL_CHECK_STATUS_DETAIL,
  OFFICIAL_CHECK_STATUS_LABEL,
  honestyToOfficialStatus,
  officialStatusToHonesty,
  readChatAnchor,
  readChatAnchorSource,
  readReciboVsOficial,
  type OfficialChatAnchor,
  type OfficialCheckStatus,
  type OfficialCheckSummary,
  type OfficialIdentityFlags,
  type OfficialSourceCheck,
  type ReciboVsOficial,
} from "@shared/officialCheckCopy";
import { officialIdentityGapDetail } from "@shared/officialCaseBriefing";
import {
  canonicalizeEngineWebhookUrl,
  deriveHeliosBridgeUrl,
  postSignedAuditaPatronEngine,
  type SignedEnginePostResult,
} from "./auditaPatronIntegrationService";

export const GOVERNMENT_LIVE_TIMEOUT_MS = 12_000;
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
  const normalized = value.trim().toUpperCase();
  return /^[A-Z]{4}\d{6}[A-Z]{6}[0-9A-Z]{2}$/.test(normalized) ? normalized : null;
}

export function normalizeRfc(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase().replace(/[^A-Z0-9Ñ&]/g, "");
  if (normalized.length < 12 || normalized.length > 13) return null;
  if (normalized === "XAXX010101000" || normalized === "XEXX010101000") return null;
  return normalized;
}

export function collectWorkerOfficialIdentity(facts: {
  nss?: unknown;
  curp?: unknown;
  workerRfc?: unknown;
  rfc?: unknown;
}): WorkerOfficialIdentity {
  return {
    nss: normalizeNss(facts.nss),
    curp: normalizeCurp(facts.curp),
    rfc: normalizeRfc(facts.workerRfc ?? facts.rfc),
  };
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
  extra?: Partial<Pick<OfficialSourceCheck, "checkedAt" | "used" | "detail" | "honesty" | "hechos" | "motivoFallo">>,
): OfficialSourceCheck {
  return {
    source,
    sourceLabel: SOURCE_LABEL[source],
    status,
    label: OFFICIAL_CHECK_STATUS_LABEL[status],
    detail: extra?.detail ?? extra?.motivoFallo ?? OFFICIAL_CHECK_STATUS_DETAIL[status],
    checkedAt: extra?.checkedAt ?? null,
    used: extra?.used ?? { nss: false, curp: false, rfc: false },
    honesty: extra?.honesty ?? officialStatusToHonesty(status),
    hechos: extra?.hechos?.slice(0, 3) ?? [],
    motivoFallo: extra?.motivoFallo ?? null,
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

export function buildOfficialCheckBridgePayload(params: {
  identity: WorkerOfficialIdentity;
  nowIso: string;
  idempotencyKey?: string;
  correlationId?: string;
}) {
  const autonomousInput: Record<string, string> = {};
  if (params.identity.nss) autonomousInput.nss = params.identity.nss;
  if (params.identity.curp) autonomousInput.curp = params.identity.curp;
  if (params.identity.rfc) autonomousInput.rfc = params.identity.rfc;

  return {
    action: OFFICIAL_CHECK_ACTION,
    eventName: OFFICIAL_CHECK_EVENT,
    event: OFFICIAL_CHECK_EVENT,
    consentGranted: true,
    sources: ["imss", "sat"],
    autonomousInput,
    nss: params.identity.nss,
    curp: params.identity.curp,
    rfc: params.identity.rfc,
    sourceModule: "auditapatron_official_check",
    requestedAt: params.nowIso,
    idempotencyKey: params.idempotencyKey,
    correlationId: params.correlationId,
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

const PENDING_HINT = /mantenimiento|temporarily unavailable|service unavailable|timeout|timed out|retry|queued|pending|en curso|en progreso/;
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
    if (PENDING_HINT.test(normalized)) return "pendiente";
    if (normalized) return "vivo";
  }
  if (direct && typeof direct === "object") {
    const status = String((direct as { status?: unknown }).status ?? "").toLowerCase();
    if (status === "vivo" || status === "pendiente" || status === "no_se_pudo") return status;
    if (PENDING_HINT.test(status) || PENDING_HINT.test(collectHaystack(direct))) return "pendiente";
    return "vivo";
  }
  return null;
}

export function classifyBridgeOfficialCheck(result: SignedEnginePostResult): OfficialCheckStatus {
  if (result.ok) {
    if (looksLikeLiveInstituteResult(result.responseJson)) return "vivo";
    return "pendiente";
  }

  if (result.reason === "timeout" || result.reason === "retryable_http" || result.reason === "server_error") {
    return "pendiente";
  }
  if (result.httpStatus === 429 || (result.httpStatus !== null && result.httpStatus >= 500)) {
    return "pendiente";
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

function workerDetailForBridgeResult(
  status: OfficialCheckStatus,
  posted: SignedEnginePostResult,
): string {
  if (posted.httpStatus === 404) {
    return "Falló la consulta. Todavía no hay una respuesta de IMSS o SAT para estos datos.";
  }
  return OFFICIAL_CHECK_STATUS_DETAIL[status];
}

function normalizeReturnedOfficialStatus(value: unknown): OfficialCheckStatus | null {
  if (value == null) return null;
  if (typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
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
  if (text === "pendiente" || text === "pending" || /queued|processing|retry|timeout|mantenimiento/.test(text)) {
    return "pendiente";
  }
  if (
    text === "no_se_pudo" ||
    text === "fallo" ||
    text === "falló" ||
    text === "failed" ||
    /fail|error|not_found|rejected|denied/.test(text)
  ) {
    return "no_se_pudo";
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
  const missing = Array.isArray(record?.missingFields)
    ? record.missingFields.map((item) => String(item))
    : [];
  const fromHonesty = honestyToOfficialStatus(
    record ? String(record.honesty ?? record.estado ?? record.status ?? "") : null,
    missing,
  );
  const status = fromHonesty ?? fallback ?? "pendiente";
  const anchor = record ? readChatAnchorSource(record, source) : null;
  const hechos = record
    ? (Array.isArray(record.hechos) ? record.hechos.map((item) => String(item).trim()).filter(Boolean).slice(0, 3) : [])
    : [];
  const motivoFallo =
    status === "no_se_pudo" || status === "sin_datos"
      ? (typeof record?.workerReason === "string" ? record.workerReason : null) ??
        (typeof record?.motivoFallo === "string" ? record.motivoFallo : null)
      : null;
  return sourceCheck(source, status, {
    checkedAt:
      (typeof record?.checkedAt === "string" ? record.checkedAt : null) ??
      anchor?.fecha ??
      nowIso,
    used,
    honesty: anchor?.estado ?? officialStatusToHonesty(status),
    hechos: hechos.length > 0 ? hechos : anchor?.hechos,
    motivoFallo: motivoFallo ?? anchor?.motivoFallo ?? null,
    detail: motivoFallo ?? undefined,
  });
}

function pickBridgeResultRoots(root: Record<string, unknown>): Array<Record<string, unknown> | null> {
  const result = asRecord(root.result) ?? asRecord(root.analysisResults) ?? root;
  const current = asRecord(root.currentResponseEvent);
  const currentResult = asRecord(current?.result);
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

  const eventName = String(root.event ?? root.eventName ?? "");
  if (eventName && eventName !== "document.processed.v1" && root.action !== "official_check") {
    if (eventName === "document.rejected.v1") {
      const failed: OfficialCheckStatus = "no_se_pudo";
      return {
        configured: true,
        consentGranted: true,
        overallStatus: failed,
        overallLabel: OFFICIAL_CHECK_STATUS_LABEL[failed],
        overallDetail: OFFICIAL_CHECK_STATUS_DETAIL[failed],
        checkedAt: params.nowIso ?? null,
        identity: params.identity ?? { nss: false, curp: false, rfc: false },
        checks: [
          sourceCheck("imss", failed, { checkedAt: params.nowIso ?? null }),
          sourceCheck("sat", failed, { checkedAt: params.nowIso ?? null }),
          sourceCheck("infonavit", failed, { checkedAt: params.nowIso ?? null }),
        ],
        chatAnchor: null,
        reciboVsOficial: null,
      };
    }
    return null;
  }

  const roots = pickBridgeResultRoots(root);
  const result = asRecord(root.result) ?? asRecord(root.analysisResults) ?? root;
  const currentResult = asRecord(asRecord(root.currentResponseEvent)?.result);
  const officialCheck =
    asRecord(result?.officialCheck) ??
    asRecord(root.officialCheck) ??
    asRecord(currentResult?.officialCheck);
  const chatAnchor =
    readChatAnchor(result?.chatAnchor) ??
    readChatAnchor(root.chatAnchor) ??
    readChatAnchor(officialCheck?.chatAnchor) ??
    readChatAnchor(currentResult?.chatAnchor);
  const reciboVsOficial: ReciboVsOficial | null =
    readReciboVsOficial(result?.reciboVsOficial) ??
    readReciboVsOficial(result?.receiptVsOfficial) ??
    readReciboVsOficial(root.reciboVsOficial) ??
    readReciboVsOficial(root.receiptVsOfficial) ??
    readReciboVsOficial(currentResult?.reciboVsOficial) ??
    readReciboVsOficial(currentResult?.receiptVsOfficial);

  const used = params.identity ?? { nss: false, curp: false, rfc: false };
  const nowIso = params.nowIso ?? null;
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
          sourceCheck("imss", "pendiente", { checkedAt: nowIso }),
          sourceCheck("sat", "pendiente", { checkedAt: nowIso }),
          sourceCheck("infonavit", "pendiente", { checkedAt: nowIso }),
        ],
        chatAnchor,
        reciboVsOficial,
      };
    }
    return null;
  }

  const checks = [
    readOfficialObligationCheck(officialCheck?.imss ?? chatAnchor?.imss, "imss", imssStatus, nowIso, used),
    readOfficialObligationCheck(officialCheck?.sat ?? chatAnchor?.sat, "sat", satStatus, nowIso, used),
    readOfficialObligationCheck(
      officialCheck?.infonavit ?? chatAnchor?.infonavit,
      "infonavit",
      infonavitStatus,
      nowIso,
      used,
    ),
  ];
  const overallStatus = rollupStatus(checks.map((item) => item.status));
  const resolvedAnchor: OfficialChatAnchor | null =
    chatAnchor ??
    ({
      imss: readChatAnchorSource({ ...checks[0], estado: checks[0].honesty, fecha: checks[0].checkedAt }, "imss"),
      sat: readChatAnchorSource({ ...checks[1], estado: checks[1].honesty, fecha: checks[1].checkedAt }, "sat"),
      infonavit: readChatAnchorSource({ ...checks[2], estado: checks[2].honesty, fecha: checks[2].checkedAt }, "infonavit"),
    } satisfies OfficialChatAnchor);

  return {
    configured: true,
    consentGranted: true,
    overallStatus,
    overallLabel: OFFICIAL_CHECK_STATUS_LABEL[overallStatus],
    overallDetail: OFFICIAL_CHECK_STATUS_DETAIL[overallStatus],
    checkedAt: nowIso,
    identity: used,
    checks,
    chatAnchor: resolvedAnchor,
    reciboVsOficial,
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
}): Promise<OfficialCheckSummary> {
  const env = params.env ?? process.env;
  const identity = {
    nss: normalizeNss(params.identity.nss),
    curp: normalizeCurp(params.identity.curp),
    rfc: normalizeRfc(params.identity.rfc),
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
      overallDetail: officialIdentityGapDetail(identityFlags(identity)),
    };
  }

  const payload = buildOfficialCheckBridgePayload({
    identity,
    nowIso,
    idempotencyKey: params.idempotencyKey,
    correlationId: params.correlationId,
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
  if (fromReturn) {
    return {
      ...fromReturn,
      configured: true,
      consentGranted: true,
      identity: used,
      overallDetail: fromReturn.overallDetail || workerDetailForBridgeResult(fromReturn.overallStatus, posted),
    };
  }

  const overallStatus = classifyBridgeOfficialCheck(posted);
  const imssStatus = readSourceStatusFromResult(posted.responseJson, "imss") ?? overallStatus;
  const satStatus = readSourceStatusFromResult(posted.responseJson, "sat") ?? overallStatus;
  const infonavitStatus = readSourceStatusFromResult(posted.responseJson, "infonavit") ?? overallStatus;
  const checks = [
    sourceCheck("imss", identity.nss || identity.curp ? imssStatus : "sin_datos", {
      checkedAt: nowIso,
      used,
    }),
    sourceCheck("sat", identity.rfc || identity.curp ? satStatus : "sin_datos", {
      checkedAt: nowIso,
      used,
    }),
    sourceCheck("infonavit", identity.nss || identity.curp ? infonavitStatus : "sin_datos", {
      checkedAt: nowIso,
      used,
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
  };
}

export function readOfficialCheckFromMetadata(metadata: Record<string, unknown> | null | undefined): OfficialCheckSummary | null {
  const raw = metadata?.live_check ?? metadata?.liveCheck;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const record = raw as OfficialCheckSummary;
  if (!record.overallStatus) return null;
  return record;
}

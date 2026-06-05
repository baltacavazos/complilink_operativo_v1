import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { ENV } from "./_core/env";
import {
  buildCanonicalCaseContract,
  buildCanonicalDocumentContract,
  buildSharedEngineEnvelope,
} from "./caseContracts";

const AUDITAPATRON_ENGINE_EVENT_NAME = "document.uploaded" as const;
const DEFAULT_RETRY_DELAYS_MS = [30_000, 60_000, 120_000] as const;
const SUPPORTED_RETURN_EVENTS = [
  "document.processed.v1",
  "document.rejected.v1",
  "document.retry_requested.v1",
] as const;
const COMPLILINK_BRIDGE_RESPONSE_CONTRACT = "auditapatron.bridge.ack.v1" as const;
const DEFAULT_PROCESSING_STATUS = "queued" as const;
const DEFAULT_SOURCE_MODULE = "complilink_operativo" as const;

export type SupportedCompliLinkReturnEvent = (typeof SUPPORTED_RETURN_EVENTS)[number];

type CanonicalCaseContract = ReturnType<typeof buildCanonicalCaseContract>;
type CanonicalDocumentContract = ReturnType<typeof buildCanonicalDocumentContract>;
type SharedEngineEnvelope = ReturnType<typeof buildSharedEngineEnvelope>;

export type AuditaPatronEngineConfig = {
  webhookUrl: string;
  hmacSecret: string;
  retryDelaysMs: number[];
  fallbackWebhookUrls?: string[];
};

export type AuditaPatronMetadataValue = string | number | boolean | null;
export type AuditaPatronMetadata = Record<string, AuditaPatronMetadataValue>;

export type CompliLinkBridgeResponseAck = {
  received: boolean;
  intakeId?: string | null;
  documentId?: string | number | null;
  processingStatus?: string | null;
  traceId?: string | null;
  correlationId?: string | null;
  remoteEventId?: string | null;
  receivedAt?: string | null;
  memoryLinks?: unknown;
  recommendedNextAction?: string | null;
  responseContract?: string | { contractVersion?: string | null } | null;
  issues?: Array<Record<string, unknown>>;
};

type BridgeHealthAck = {
  status?: string | null;
  bridge?: string | null;
  webhookPath?: string | null;
  responseContract?: string | null;
};

type BridgeHealthProbeResult = {
  ok: boolean;
  reason?: string;
  httpStatus: number | null;
  responseBody: string | null;
  errorMessage?: string;
};

export type AuditaPatronEnginePayload = {
  providerId: number;
  userId: number;
  title: string;
  mimeType: string;
  fileUrl?: string;
  base64Data?: string;
  documentId?: string;
  category?: string;
  obligation?: string;
  originalFileName?: string;
  notes?: string;
  sourceModule?: string;
  sourceCaseId?: string;
  sourceDocumentId?: string;
  uploadedAt?: string;
  traceId?: string;
  processingStatus?: string;
  eventName?: string;
  eventId?: string;
  idempotencyKey?: string;
  correlationId?: string;
  tags?: string[];
  operationalContext?: Record<string, unknown>;
};

export type AuditaPatronBridgeObservabilityEnvelope = {
  dispatchId: string;
  correlationId: string;
  targetHost: string | null;
  targetPath: string | null;
  outcomeCategory: "success" | "retry_scheduled" | "permanent_failure" | "skipped";
  retryScheduled: boolean;
  retryDelayMs: number | null;
  remoteSmokeEnabled: boolean;
  httpStatusCode: number | null;
};

export type AuditaPatronEngineDispatchResult = {
  status: "sent" | "failed" | "skipped";
  dispatchedAt: string;
  timestamp: string;
  attempts: number;
  httpStatus: number | null;
  reason?: string;
  errorMessage?: string;
  responseBody?: string | null;
  responseAck?: CompliLinkBridgeResponseAck | null;
  payload: AuditaPatronEnginePayload;
  observabilityEnvelope: AuditaPatronBridgeObservabilityEnvelope;
};

export type CompliLinkReturnEnvelope = {
  event: SupportedCompliLinkReturnEvent;
  documentId: string;
  compliLinkId?: string;
  correlationId?: string;
  eventId?: string;
  idempotencyKey?: string;
  status?: string;
  timestamp?: string;
  documentType?: string;
  subDocumentType?: string;
  confidenceScore?: number;
  extractedFields?: Record<string, unknown>;
  deduplicationStatus?: {
    isDuplicate?: boolean;
    originalCompliLinkId?: string;
  };
  contractSummary?: Record<string, unknown>;
  clauseAnalysis?: Array<Record<string, unknown>>;
  benefitEstimation?: Record<string, unknown>;
  guardrailWarnings?: string[];
  analysisResults?: Record<string, unknown>;
  estimatedBenefits?: Record<string, unknown>;
  guardrailsFlags?: string[];
  metadata?: Record<string, unknown>;
};

function normalizeIsoDate(input?: Date | string) {
  if (!input) return new Date().toISOString();
  if (input instanceof Date) return input.toISOString();
  const parsed = new Date(input);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function buildUnixTimestamp(input?: Date | string) {
  const parsed = input instanceof Date ? input : input ? new Date(input) : new Date();
  const safeDate = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  return Math.floor(safeDate.getTime() / 1000).toString();
}

function parseTimestampSeconds(timestampHeader?: string | null) {
  if (!timestampHeader) return null;

  const numericTimestamp = Number(timestampHeader);
  if (Number.isFinite(numericTimestamp)) {
    return numericTimestamp;
  }

  const parsedDate = Date.parse(timestampHeader);
  if (Number.isNaN(parsedDate)) {
    return null;
  }

  return Math.floor(parsedDate / 1000);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseWebhookTarget(webhookUrl: string) {
  if (!webhookUrl) {
    return { targetHost: null, targetPath: null };
  }

  try {
    const url = new URL(webhookUrl);
    return {
      targetHost: url.host,
      targetPath: `${url.pathname}${url.search}` || url.pathname || "/",
    };
  } catch {
    return { targetHost: null, targetPath: null };
  }
}

function isRemoteBridgeSmokeEnabled() {
  return (
    process.env.ENABLE_LIVE_COMPLILINK_BRIDGE_SMOKE_TEST_IN_DEV_ONLY === "TRUE" &&
    (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test")
  );
}

function buildLoopbackWebhookUrl(webhookUrl: string) {
  const port = process.env.PORT?.trim();
  if (!port) return null;

  try {
    const parsed = new URL(webhookUrl);
    const allowedHost =
      parsed.hostname === "complilink.mx" ||
      parsed.hostname === "www.complilink.mx" ||
      parsed.hostname.endsWith(".manus.space") ||
      parsed.hostname.includes(".manus.computer");

    if (!allowedHost || parsed.pathname !== "/api/auditapatron/webhook") {
      return null;
    }

    return `http://127.0.0.1:${port}${parsed.pathname}${parsed.search}`;
  } catch {
    return null;
  }
}

function normalizeWebhookUrlCandidates(config: AuditaPatronEngineConfig) {
  const candidates: string[] = [];
  const push = (value?: string | null) => {
    const normalized = value?.trim();
    if (!normalized || candidates.includes(normalized)) return;
    candidates.push(normalized);
  };

  push(config.webhookUrl);
  for (const fallbackUrl of config.fallbackWebhookUrls ?? []) {
    push(fallbackUrl);
  }

  try {
    const parsed = new URL(config.webhookUrl);
    if (parsed.hostname.startsWith("www.")) {
      const withoutWww = new URL(parsed.toString());
      withoutWww.hostname = parsed.hostname.replace(/^www\./, "");
      push(withoutWww.toString());
    }
  } catch {
    // Ignore malformed URL here; the send function will surface a clearer error later.
  }

  push(buildLoopbackWebhookUrl(config.webhookUrl));

  return candidates;
}

function deriveBridgeHealthUrl(webhookUrl: string) {
  try {
    const parsed = new URL(webhookUrl);
    parsed.pathname = "/api/auditapatron/health";
    parsed.search = "";
    return parsed.toString();
  } catch {
    return null;
  }
}

function shouldProbeBridgeHealth(webhookUrl: string, remoteSmokeEnabled: boolean) {
  if (remoteSmokeEnabled) return true;

  try {
    const parsed = new URL(webhookUrl);
    return (
      parsed.hostname === "127.0.0.1" ||
      parsed.hostname === "localhost" ||
      parsed.hostname.endsWith(".manus.space") ||
      parsed.hostname.includes(".manus.computer")
    );
  } catch {
    return false;
  }
}

function hasValidBridgeHealthAck(value: BridgeHealthAck | null, webhookUrl: string) {
  if (value?.status !== "ok" || value?.responseContract !== COMPLILINK_BRIDGE_RESPONSE_CONTRACT) {
    return false;
  }

  try {
    const parsed = new URL(webhookUrl);
    return !value.webhookPath || value.webhookPath === parsed.pathname;
  } catch {
    return true;
  }
}

async function probeBridgeHealth(webhookUrl: string): Promise<BridgeHealthProbeResult> {
  const healthUrl = deriveBridgeHealthUrl(webhookUrl);
  if (!healthUrl) {
    return {
      ok: false,
      reason: "invalid_webhook_url",
      httpStatus: null,
      responseBody: null,
    };
  }

  try {
    const response = await fetch(healthUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });
    const responseBody = sanitizeResponseBody(await response.text());
    const parsed = safeJsonParse<BridgeHealthAck>(responseBody);
    const contentType = (response.headers.get("content-type") ?? "").toLowerCase();

    if (!response.ok) {
      return {
        ok: false,
        reason: "health_check_failed",
        httpStatus: response.status,
        responseBody,
      };
    }

    if (!contentType.includes("application/json")) {
      return {
        ok: false,
        reason: "health_non_json",
        httpStatus: response.status,
        responseBody,
      };
    }

    if (!hasValidBridgeHealthAck(parsed, webhookUrl)) {
      return {
        ok: false,
        reason: "health_invalid_contract",
        httpStatus: response.status,
        responseBody,
      };
    }

    return {
      ok: true,
      httpStatus: response.status,
      responseBody,
    };
  } catch (error) {
    return {
      ok: false,
      reason: "health_network_error",
      httpStatus: null,
      responseBody: null,
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }
}

function buildObservabilityEnvelope(params: {
  dispatchId: string;
  correlationId: string;
  targetHost: string | null;
  targetPath: string | null;
  outcomeCategory: AuditaPatronBridgeObservabilityEnvelope["outcomeCategory"];
  retryScheduled: boolean;
  retryDelayMs: number | null;
  remoteSmokeEnabled: boolean;
  httpStatusCode: number | null;
}) {
  return {
    dispatchId: params.dispatchId,
    correlationId: params.correlationId,
    targetHost: params.targetHost,
    targetPath: params.targetPath,
    outcomeCategory: params.outcomeCategory,
    retryScheduled: params.retryScheduled,
    retryDelayMs: params.retryDelayMs,
    remoteSmokeEnabled: params.remoteSmokeEnabled,
    httpStatusCode: params.httpStatusCode,
  } satisfies AuditaPatronBridgeObservabilityEnvelope;
}

function emitBridgeObservability(params: {
  status: AuditaPatronEngineDispatchResult["status"];
  attempts: number;
  reason?: string;
  errorMessage?: string;
  observabilityEnvelope: AuditaPatronBridgeObservabilityEnvelope;
}) {
  console.info(
    JSON.stringify({
      event: "auditapatron_bridge_dispatch",
      status: params.status,
      attempts: params.attempts,
      reason: params.reason,
      errorMessage: params.errorMessage,
      ...params.observabilityEnvelope,
    }),
  );
}

function slugifyDocType(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
}

function normalizeSignatureHeader(signatureHeader?: string | null) {
  if (!signatureHeader) return "";
  return signatureHeader.replace(/^hmac-sha256:/i, "").trim();
}

function toOptionalString(value: AuditaPatronMetadataValue | undefined) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function toOptionalNumber(value: AuditaPatronMetadataValue | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function safeJsonParse<T>(value: string | null): T | null {
  if (!value) return null;

  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function sanitizeResponseBody(value: string | null, maxLength = 2000) {
  if (!value) return null;
  const normalized = value.trim();
  if (!normalized) return null;
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}…[truncated]` : normalized;
}

function hasValidBridgeAck(value: CompliLinkBridgeResponseAck | null) {
  if (!value?.received) return false;

  if (value.responseContract === COMPLILINK_BRIDGE_RESPONSE_CONTRACT) {
    return true;
  }

  if (
    value.responseContract &&
    typeof value.responseContract === "object" &&
    value.responseContract.contractVersion === "auditapatron_return_contract_v1"
  ) {
    return true;
  }

  return false;
}

function inferCompliLinkDocType(params: {
  documentContract: CanonicalDocumentContract;
  metadata?: AuditaPatronMetadata;
}) {
  const originalName = `${params.documentContract.original_name ?? ""}`.toLowerCase();
  const metadataHaystack = Object.values(params.metadata ?? {})
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase();
  const haystack = `${originalName} ${metadataHaystack}`;

  if (params.metadata?.descriptiveDocType && typeof params.metadata.descriptiveDocType === "string") {
    return slugifyDocType(params.metadata.descriptiveDocType);
  }

  if (haystack.includes("opinion") && haystack.includes("cumplimiento")) {
    return "opinion_cumplimiento";
  }

  if (haystack.includes("infonavit")) {
    return "constancia_infonavit";
  }

  switch (params.documentContract.document_type) {
    case "payroll_receipt":
      return "recibo_nomina";
    case "cfdi":
      return "cfdi_nomina";
    case "imss":
      return "constancia_imss";
    case "contract":
      return "contrato_laboral";
    case "settlement":
      return haystack.includes("liquidacion") || haystack.includes("liquidación") ? "liquidacion_laboral" : "finiquito";
    case "evidence":
      if (haystack.includes("whatsapp") || haystack.includes("chat")) return "chat_laboral";
      if (haystack.includes("correo") || haystack.includes("email")) return "correo_laboral";
      if (haystack.includes("captura") || haystack.includes("screenshot")) return "captura_pantalla";
      return "evidencia_laboral";
    case "other":
    default: {
      const fallbackName = params.documentContract.original_name || "documento_laboral";
      return slugifyDocType(fallbackName.replace(/\.[^.]+$/, ""));
    }
  }
}

function mapCompliLinkBridgeCategory(params: {
  documentContract: CanonicalDocumentContract;
  metadata?: AuditaPatronMetadata;
  inferredDocType: string;
}) {
  const haystack = [
    params.inferredDocType,
    params.documentContract.document_type,
    params.documentContract.original_name ?? "",
    ...Object.values(params.metadata ?? {}).filter((value): value is string => typeof value === "string"),
  ]
    .join(" ")
    .toLowerCase();

  if (haystack.includes("repse")) return "repse_certificate";
  if (haystack.includes("infonavit")) return "infonavit_opinion";
  if (params.documentContract.document_type === "imss" || haystack.includes("imss")) return "imss_opinion";
  if (params.documentContract.document_type === "contract") return "contract";
  if (haystack.includes("sat") || haystack.includes("constancia de situacion fiscal") || haystack.includes("opinion_cumplimiento")) {
    return "sat_certificate";
  }

  return "other";
}

export function getAuditaPatronEngineConfig(overrides?: Partial<AuditaPatronEngineConfig>): AuditaPatronEngineConfig {
  return {
    webhookUrl: overrides?.webhookUrl ?? (ENV as typeof ENV & { auditapatronEngineWebhookUrl?: string }).auditapatronEngineWebhookUrl ?? "",
    hmacSecret: overrides?.hmacSecret ?? (ENV as typeof ENV & { auditapatronEngineHmacSecret?: string }).auditapatronEngineHmacSecret ?? "",
    retryDelaysMs: overrides?.retryDelaysMs ?? [...DEFAULT_RETRY_DELAYS_MS],
    fallbackWebhookUrls: overrides?.fallbackWebhookUrls ?? [],
  };
}

export function buildAuditaPatronEnginePayload(params: {
  caseContract: CanonicalCaseContract;
  documentContract: CanonicalDocumentContract;
  sharedEngineEnvelope?: SharedEngineEnvelope;
  sourceUserId: number | string;
  uploadedAt: Date | string;
  metadata?: AuditaPatronMetadata;
  auditId?: string;
  caseId?: string;
  docType?: string;
  dispatchId?: string;
  correlationId?: string;
}): AuditaPatronEnginePayload {
  const uploadedAt = normalizeIsoDate(params.uploadedAt);
  const providerId =
    toOptionalNumber(params.metadata?.providerId) ??
    toOptionalNumber(params.metadata?.sourceProviderId) ??
    Number(params.sourceUserId);
  const userId =
    toOptionalNumber(params.metadata?.userId) ??
    toOptionalNumber(params.metadata?.sourceUserId) ??
    Number(params.sourceUserId);
  const inferredDocType = params.docType ?? inferCompliLinkDocType({
    documentContract: params.documentContract,
    metadata: params.metadata,
  });
  const title =
    toOptionalString(params.metadata?.title) ??
    toOptionalString(params.metadata?.descriptiveDocType) ??
    params.documentContract.original_name ??
    inferredDocType;
  const category =
    toOptionalString(params.metadata?.category) ??
    mapCompliLinkBridgeCategory({
      documentContract: params.documentContract,
      metadata: params.metadata,
      inferredDocType,
    });
  const notes = toOptionalString(params.metadata?.notes);
  const obligation = toOptionalString(params.metadata?.obligation);
  const eventId = params.dispatchId ?? randomUUID();
  const correlationId = params.correlationId ?? randomUUID();
  const tags = [category, obligation].filter((value): value is string => Boolean(value));
  const operationalContext = {
    traceId: params.caseContract.trace_id,
    auditId: params.auditId ?? params.caseContract.trace_id,
    caseId: params.caseId ?? params.documentContract.case_id,
    dispatchId: params.dispatchId,
    sha256: params.documentContract.sha256,
    fileSizeBytes: params.documentContract.size_bytes,
    documentType: params.documentContract.document_type,
    sharedEnvelopeDocumentCount: params.sharedEngineEnvelope?.document_contracts?.length ?? 1,
  } satisfies Record<string, unknown>;

  return {
    providerId: Number.isFinite(providerId) ? providerId : userId,
    userId: Number.isFinite(userId) ? userId : 0,
    title,
    mimeType: params.documentContract.mime_type,
    fileUrl: params.documentContract.storage_url,
    documentId:
      toOptionalNumber(params.metadata?.documentNumericId)?.toString() ??
      toOptionalNumber(params.metadata?.sourceNumericDocumentId)?.toString() ??
      params.documentContract.document_id,
    category,
    obligation,
    originalFileName: params.documentContract.original_name ?? undefined,
    notes,
    sourceModule: toOptionalString(params.metadata?.sourceModule) ?? DEFAULT_SOURCE_MODULE,
    sourceCaseId: params.caseId ?? params.documentContract.case_id,
    sourceDocumentId: params.documentContract.document_id,
    uploadedAt,
    traceId: params.caseContract.trace_id,
    processingStatus: toOptionalString(params.metadata?.processingStatus) ?? "pending",
    eventName: AUDITAPATRON_ENGINE_EVENT_NAME,
    eventId,
    idempotencyKey: eventId,
    correlationId,
    tags: tags.length > 0 ? tags : undefined,
    operationalContext,
  };
}

export function buildAuditaPatronEngineSignature(timestamp: string, payloadBody: string, hmacSecret: string) {
  return createHmac("sha256", hmacSecret).update(`${timestamp}.${payloadBody}`).digest("hex");
}

export function buildAuditaPatronBodySignature(payloadBody: string, hmacSecret: string) {
  return createHmac("sha256", hmacSecret).update(payloadBody).digest("hex");
}

export function isSupportedCompliLinkReturnEvent(event: string): event is SupportedCompliLinkReturnEvent {
  return SUPPORTED_RETURN_EVENTS.includes(event as SupportedCompliLinkReturnEvent);
}

export function verifySignedWebhook(params: {
  signatureHeader?: string | null;
  timestampHeader?: string | null;
  payloadBody: string;
  hmacSecret: string;
}) {
  if (!params.signatureHeader || !params.timestampHeader || !params.hmacSecret) {
    return { ok: false as const, reason: "missing_signature" };
  }

  const normalizedReceivedSignature = normalizeSignatureHeader(params.signatureHeader);
  const expectedSignature = buildAuditaPatronEngineSignature(
    params.timestampHeader,
    params.payloadBody,
    params.hmacSecret,
  );

  const receivedBuffer = Buffer.from(normalizedReceivedSignature, "utf8");
  const expectedBuffer = Buffer.from(expectedSignature, "utf8");

  if (receivedBuffer.length !== expectedBuffer.length) {
    return { ok: false as const, reason: "invalid_signature", expectedSignature };
  }

  if (!timingSafeEqual(receivedBuffer, expectedBuffer)) {
    return { ok: false as const, reason: "invalid_signature", expectedSignature };
  }

  const parsedTimestamp = parseTimestampSeconds(params.timestampHeader);
  if (parsedTimestamp === null) {
    return { ok: false as const, reason: "invalid_timestamp", expectedSignature };
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - parsedTimestamp) > 300) {
    return { ok: false as const, reason: "stale_timestamp", expectedSignature };
  }

  return { ok: true as const, expectedSignature };
}

function shouldRetry(httpStatus: number | null) {
  return httpStatus !== null && httpStatus >= 500 && httpStatus <= 599;
}

export async function sendDocumentToAuditaPatronEngine(
  params: {
    caseContract: CanonicalCaseContract;
    documentContract: CanonicalDocumentContract;
    sharedEngineEnvelope?: SharedEngineEnvelope;
    sourceUserId: number | string;
    uploadedAt: Date | string;
    metadata?: AuditaPatronMetadata;
    auditId?: string;
    caseId?: string;
    docType?: string;
  },
  overrides?: Partial<AuditaPatronEngineConfig>,
): Promise<AuditaPatronEngineDispatchResult> {
  const config = getAuditaPatronEngineConfig(overrides);
  const candidateWebhookUrls = normalizeWebhookUrlCandidates(config);
  const dispatchId = randomUUID();
  const correlationId = randomUUID();
  const payload = buildAuditaPatronEnginePayload({
    ...params,
    dispatchId,
    correlationId,
  });
  const initialTarget = parseWebhookTarget(candidateWebhookUrls[0] ?? config.webhookUrl);
  const remoteSmokeEnabled = isRemoteBridgeSmokeEnabled();

  if (candidateWebhookUrls.length === 0 || !config.hmacSecret) {
    const result = {
      status: "skipped",
      dispatchedAt: new Date().toISOString(),
      timestamp: buildUnixTimestamp(),
      attempts: 0,
      httpStatus: null,
      reason: "engine_not_configured",
      payload,
      observabilityEnvelope: buildObservabilityEnvelope({
        dispatchId,
        correlationId,
        targetHost: initialTarget.targetHost,
        targetPath: initialTarget.targetPath,
        outcomeCategory: "skipped",
        retryScheduled: false,
        retryDelayMs: null,
        remoteSmokeEnabled,
        httpStatusCode: null,
      }),
    } satisfies AuditaPatronEngineDispatchResult;

    emitBridgeObservability({
      status: result.status,
      attempts: result.attempts,
      reason: result.reason,
      observabilityEnvelope: result.observabilityEnvelope,
    });

    return result;
  }

  const body = JSON.stringify(payload);
  let attempts = 0;
  let lastHttpStatus: number | null = null;
  let lastResponseBody: string | null = null;
  let lastErrorMessage: string | undefined;
  let lastReason: string | undefined;
  let lastResponseAck: CompliLinkBridgeResponseAck | null = null;
  let finalTimestamp = buildUnixTimestamp();
  let lastTargetHost = initialTarget.targetHost;
  let lastTargetPath = initialTarget.targetPath;

  for (const webhookUrl of candidateWebhookUrls) {
    const candidateTarget = parseWebhookTarget(webhookUrl);
    lastTargetHost = candidateTarget.targetHost;
    lastTargetPath = candidateTarget.targetPath;

    if (shouldProbeBridgeHealth(webhookUrl, remoteSmokeEnabled)) {
      const healthProbe = await probeBridgeHealth(webhookUrl);
      if (!healthProbe.ok) {
        lastHttpStatus = healthProbe.httpStatus;
        lastResponseBody = healthProbe.responseBody;
        lastErrorMessage = healthProbe.errorMessage;
        lastReason = healthProbe.reason;
        continue;
      }
    }

    for (let attemptIndex = 0; attemptIndex <= config.retryDelaysMs.length; attemptIndex += 1) {
      attempts += 1;
      finalTimestamp = buildUnixTimestamp();
      const signature = buildAuditaPatronEngineSignature(finalTimestamp, body, config.hmacSecret);

      try {
        const response = await fetch(webhookUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: `Bearer ${config.hmacSecret}`,
            "X-AuditaPatron-Signature": signature,
            "X-AuditaPatron-Timestamp": finalTimestamp,
          },
          body,
        });

        lastHttpStatus = response.status;
        const rawResponseBody = await response.text();
        lastResponseBody = sanitizeResponseBody(rawResponseBody);
        lastResponseAck = safeJsonParse<CompliLinkBridgeResponseAck>(rawResponseBody);
        lastErrorMessage = undefined;

        if (response.ok && hasValidBridgeAck(lastResponseAck)) {
          const result = {
            status: "sent",
            dispatchedAt: new Date().toISOString(),
            timestamp: finalTimestamp,
            attempts,
            httpStatus: response.status,
            responseBody: lastResponseBody,
            responseAck: lastResponseAck,
            payload,
            observabilityEnvelope: buildObservabilityEnvelope({
              dispatchId,
              correlationId,
              targetHost: candidateTarget.targetHost,
              targetPath: candidateTarget.targetPath,
              outcomeCategory: "success",
              retryScheduled: false,
              retryDelayMs: null,
              remoteSmokeEnabled,
              httpStatusCode: response.status,
            }),
          } satisfies AuditaPatronEngineDispatchResult;

          emitBridgeObservability({
            status: result.status,
            attempts: result.attempts,
            observabilityEnvelope: result.observabilityEnvelope,
          });

          return result;
        }

        if (response.ok) {
          lastReason = "invalid_ack_contract";
          break;
        }

        lastReason = response.status === 400
          ? "contract_validation_failed"
          : response.status === 403
            ? "authentication_failed"
            : "webhook_rejected";

        if (shouldRetry(response.status) && attemptIndex < config.retryDelaysMs.length) {
          const retryDelayMs = config.retryDelaysMs[attemptIndex] ?? 0;
          emitBridgeObservability({
            status: "failed",
            attempts,
            reason: lastReason,
            observabilityEnvelope: buildObservabilityEnvelope({
              dispatchId,
              correlationId,
              targetHost: candidateTarget.targetHost,
              targetPath: candidateTarget.targetPath,
              outcomeCategory: "retry_scheduled",
              retryScheduled: true,
              retryDelayMs,
              remoteSmokeEnabled,
              httpStatusCode: response.status,
            }),
          });
          await sleep(retryDelayMs);
          continue;
        }

        break;
      } catch (error) {
        lastHttpStatus = null;
        lastReason = "network_error";
        lastErrorMessage = error instanceof Error ? error.message : String(error);
        break;
      }
    }
  }

  const result = {
    status: "failed",
    dispatchedAt: new Date().toISOString(),
    timestamp: finalTimestamp,
    attempts,
    httpStatus: lastHttpStatus,
    reason: lastReason ?? "network_error",
    errorMessage: lastErrorMessage,
    responseBody: lastResponseBody,
    responseAck: lastResponseAck,
    payload,
    observabilityEnvelope: buildObservabilityEnvelope({
      dispatchId,
      correlationId,
      targetHost: lastTargetHost,
      targetPath: lastTargetPath,
      outcomeCategory: "permanent_failure",
      retryScheduled: false,
      retryDelayMs: null,
      remoteSmokeEnabled,
      httpStatusCode: lastHttpStatus,
    }),
  } satisfies AuditaPatronEngineDispatchResult;

  emitBridgeObservability({
    status: result.status,
    attempts: result.attempts,
    reason: result.reason,
    errorMessage: result.errorMessage,
    observabilityEnvelope: result.observabilityEnvelope,
  });

  return result;
}

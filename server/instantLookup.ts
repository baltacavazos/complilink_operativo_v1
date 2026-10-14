import {
  OFFICIAL_CHECK_CONSENT,
  OFFICIAL_CHECK_STATUS_DETAIL,
  OFFICIAL_CHECK_STATUS_LABEL,
  buildOfficialFailedDetail,
  humanizeOfficialHecho,
  type OfficialCheckSource,
  type OfficialCheckSummary,
} from "@shared/officialCheckCopy";
import {
  isOfficialCheckConfigured,
  normalizeCurp,
  normalizeNss,
  normalizeRfc,
  officialCheckFromBridgeReturn,
  runOfficialGovernmentCheck,
  type GovernmentLiveEnv,
  type WorkerOfficialIdentity,
} from "./governmentLiveCheck";

const DIRECT_TIMEOUT_MS = 8_000;
const HEALTH_TIMEOUT_MS = 1_500;
const CIRCUIT_FAILURES = 2;
const CIRCUIT_OPEN_MS = 45_000;
const PROVIDER_NAME = /apimarket|nufi|syntage|capsolver/gi;

type DirectProviderId = "apimarket" | "nufi";
type CircuitState = { failures: number; openUntilMs: number };

const circuits = new Map<string, CircuitState>();

export type InstantLookupParams = {
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
  receipt?: Parameters<typeof runOfficialGovernmentCheck>[0]["receipt"];
};

type DirectEndpoint = {
  source: OfficialCheckSource;
  url: string;
};

type DirectProvider = {
  id: DirectProviderId;
  apiKey: string;
  healthUrl: string;
  endpoints: DirectEndpoint[];
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function scrubWorkerText(value: string): string {
  return humanizeOfficialHecho(value).replace(PROVIDER_NAME, "").replace(/\s{2,}/g, " ").trim();
}

export function clearInstantLookupState() {
  circuits.clear();
}

export function instantCircuitOpen(id: string, nowMs: number): boolean {
  const circuit = circuits.get(id);
  return Boolean(circuit && circuit.openUntilMs > nowMs);
}

function noteProviderDown(id: string, nowMs: number) {
  const current = circuits.get(id) ?? { failures: 0, openUntilMs: 0 };
  const failures = current.failures + 1;
  circuits.set(id, {
    failures,
    openUntilMs: failures >= CIRCUIT_FAILURES ? nowMs + CIRCUIT_OPEN_MS : current.openUntilMs,
  });
}

function noteProviderUp(id: string) {
  circuits.delete(id);
}

function configuredUrl(env: GovernmentLiveEnv, key: string): string {
  const value = String(env[key] ?? "").trim();
  if (!value) return "";
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:") return "";
    return parsed.toString();
  } catch {
    return "";
  }
}

/** Proveedores directos. Syntage nunca entra, aunque exista la llave. */
export function listDirectInstantProviders(env: GovernmentLiveEnv = process.env): DirectProvider[] {
  const providers: DirectProvider[] = [];
  const apiMarketKey = String(env.APIMARKET_API_KEY ?? "").trim();
  const apiMarketEndpoints = (
    [
      ["imss", configuredUrl(env, "APIMARKET_IMSS_URL")],
      ["sat", configuredUrl(env, "APIMARKET_SAT_URL")],
      ["infonavit", configuredUrl(env, "APIMARKET_INFONAVIT_URL")],
    ] as Array<[OfficialCheckSource, string]>
  ).filter((entry) => entry[1]);
  if (apiMarketKey && apiMarketEndpoints.length > 0) {
    providers.push({
      id: "apimarket",
      apiKey: apiMarketKey,
      healthUrl: configuredUrl(env, "APIMARKET_HEALTH_URL"),
      endpoints: apiMarketEndpoints.map(([source, url]) => ({ source, url })),
    });
  }

  const nufiKey = String(env.NUFI_API_KEY ?? "").trim();
  const nufiUrl = configuredUrl(env, "NUFI_INFONAVIT_URL");
  if (nufiKey && nufiUrl) {
    providers.push({
      id: "nufi",
      apiKey: nufiKey,
      healthUrl: configuredUrl(env, "NUFI_HEALTH_URL"),
      endpoints: [{ source: "infonavit", url: nufiUrl }],
    });
  }
  return providers;
}

export function isInstantLookupConfigured(env: GovernmentLiveEnv = process.env): boolean {
  return isOfficialCheckConfigured(env) || listDirectInstantProviders(env).length > 0;
}

function identityFlags(identity: WorkerOfficialIdentity) {
  return {
    nss: Boolean(identity.nss),
    curp: Boolean(identity.curp),
    rfc: Boolean(identity.rfc),
  };
}

function quietMiss(identity: WorkerOfficialIdentity, nowIso: string): OfficialCheckSummary {
  return {
    configured: true,
    consentGranted: true,
    overallStatus: "no_se_pudo",
    overallLabel: OFFICIAL_CHECK_STATUS_LABEL.no_se_pudo,
    overallDetail: buildOfficialFailedDetail(),
    checkedAt: nowIso,
    identity: identityFlags(identity),
    checks: [],
  };
}

function scrubSummary(summary: OfficialCheckSummary): OfficialCheckSummary {
  return {
    ...summary,
    overallDetail: scrubWorkerText(summary.overallDetail),
    checks: summary.checks.map((check) => ({
      ...check,
      detail: scrubWorkerText(check.detail),
      motivoFallo: check.motivoFallo ? scrubWorkerText(check.motivoFallo) : check.motivoFallo,
      hechos: (check.hechos ?? []).map((item) => scrubWorkerText(item)).filter(Boolean),
    })),
    sourceRole: null,
  };
}

function hasLiveSource(summary: OfficialCheckSummary | null | undefined): boolean {
  return Boolean(summary?.checks?.some((item) => item.status === "vivo" || item.honesty === "live"));
}

function collectHechos(record: Record<string, unknown>): string[] {
  const pairs: Array<[string, string]> = [
    ["nss", "NSS"],
    ["curp", "CURP"],
    ["rfc", "RFC"],
    ["semanas", "Semanas cotizadas"],
    ["semanasCotizadas", "Semanas cotizadas"],
    ["salario", "Salario"],
    ["salarioBase", "Salario"],
    ["nombrePatron", "Patrón"],
    ["registroPatronal", "Registro patronal"],
    ["credito", "Crédito"],
    ["numeroCredito", "Crédito"],
    ["saldo", "Saldo"],
    ["estatus", "Estatus"],
    ["vigencia", "Vigencia"],
  ];
  const lines: string[] = [];
  for (let index = 0; index < pairs.length; index += 1) {
    const [key, label] = pairs[index];
    const value = record[key];
    if (typeof value === "string" || typeof value === "number") {
      const text = scrubWorkerText(String(value));
      if (text) lines.push(`${label}: ${text}`);
    }
  }
  const nested = Array.isArray(record.hechos) ? record.hechos : [];
  for (let index = 0; index < nested.length; index += 1) {
    if (typeof nested[index] === "string") {
      const text = scrubWorkerText(String(nested[index]));
      if (text) lines.push(text);
    }
  }
  return lines.slice(0, 3);
}

function adaptSourceBody(body: unknown): { status: "vivo" | "no_se_pudo"; hechos: string[] } | null {
  const root = asRecord(body);
  if (!root) return null;
  const nested = asRecord(root.data) ?? asRecord(root.result) ?? root;
  const hechos = collectHechos(nested);
  if (hechos.length === 0) return { status: "no_se_pudo", hechos: [] };
  return { status: "vivo", hechos };
}

async function providerHostUp(url: string, fetchImpl: typeof fetch): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
  try {
    const response = await fetchImpl(url, { method: "GET", signal: controller.signal });
    return response.status < 500;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function postDirectEndpoint(params: {
  endpoint: DirectEndpoint;
  apiKey: string;
  identity: WorkerOfficialIdentity;
  fetchImpl: typeof fetch;
}): Promise<{ down: boolean; body: unknown | null }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DIRECT_TIMEOUT_MS);
  try {
    const response = await params.fetchImpl(params.endpoint.url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${params.apiKey}`,
        "x-api-key": params.apiKey,
      },
      body: JSON.stringify({
        nss: params.identity.nss,
        curp: params.identity.curp,
        rfc: params.identity.rfc,
      }),
    });
    if (response.status >= 500) return { down: true, body: null };
    if (!response.ok) return { down: false, body: null };
    return { down: false, body: await response.json() };
  } catch {
    return { down: true, body: null };
  } finally {
    clearTimeout(timer);
  }
}

async function runDirectProvider(params: {
  provider: DirectProvider;
  identity: WorkerOfficialIdentity;
  fetchImpl: typeof fetch;
  nowIso: string;
  nowMs: number;
}): Promise<{ summary: OfficialCheckSummary | null; down: boolean }> {
  if (params.provider.healthUrl) {
    const up = await providerHostUp(params.provider.healthUrl, params.fetchImpl);
    if (!up) {
      noteProviderDown(params.provider.id, params.nowMs);
      return { summary: null, down: true };
    }
  }

  const posted = await Promise.all(
    params.provider.endpoints.map((endpoint) =>
      postDirectEndpoint({
        endpoint,
        apiKey: params.provider.apiKey,
        identity: params.identity,
        fetchImpl: params.fetchImpl,
      }),
    ),
  );
  const down = posted.every((item) => item.down);
  if (down) {
    noteProviderDown(params.provider.id, params.nowMs);
    return { summary: null, down: true };
  }

  const result: Record<string, unknown> = {};
  for (let index = 0; index < params.provider.endpoints.length; index += 1) {
    const adapted = adaptSourceBody(posted[index]?.body);
    if (!adapted) continue;
    result[params.provider.endpoints[index].source] = {
      status: adapted.status,
      honesty: adapted.status === "vivo" ? "live" : "failed",
      hechos: adapted.hechos,
    };
  }
  const summary = officialCheckFromBridgeReturn({
    payload: { action: "official_check", result },
    identity: identityFlags(params.identity),
    nowIso: params.nowIso,
  });
  if (summary && hasLiveSource(summary)) noteProviderUp(params.provider.id);
  return { summary, down: false };
}

function gateBeforeLookup(
  params: InstantLookupParams,
  identity: WorkerOfficialIdentity,
  nowIso: string,
): OfficialCheckSummary | null {
  if (!params.consentGranted) {
    return {
      configured: true,
      consentGranted: false,
      overallStatus: "sin_permiso",
      overallLabel: OFFICIAL_CHECK_STATUS_LABEL.sin_permiso,
      overallDetail: `${OFFICIAL_CHECK_STATUS_DETAIL.sin_permiso} ${OFFICIAL_CHECK_CONSENT}`,
      checkedAt: null,
      identity: identityFlags(identity),
      checks: [],
    };
  }
  if (!identity.nss && !identity.curp && !identity.rfc) {
    return {
      configured: true,
      consentGranted: true,
      overallStatus: "sin_datos",
      overallLabel: OFFICIAL_CHECK_STATUS_LABEL.sin_datos,
      overallDetail: OFFICIAL_CHECK_STATUS_DETAIL.sin_datos,
      checkedAt: nowIso,
      identity: identityFlags(identity),
      checks: [],
    };
  }
  return null;
}

/**
 * Consulta instantánea. El puente ya configurado y los proveedores con llave
 * corren juntos. Gana la primera respuesta con un dato usable.
 * Un proveedor caído se salta. Nunca se nombra al proveedor.
 */
export async function runInstantWorkerLookup(params: InstantLookupParams): Promise<OfficialCheckSummary> {
  const env = params.env ?? process.env;
  const direct = listDirectInstantProviders(env);
  if (direct.length === 0) {
    const bridgeOnly = await runOfficialGovernmentCheck({ ...params, env });
    return { ...bridgeOnly, sourceRole: null };
  }

  const identity = {
    nss: normalizeNss(params.identity.nss),
    curp: normalizeCurp(params.identity.curp),
    rfc: normalizeRfc(params.identity.rfc, { allowGeneric: true }),
  };
  const now = params.now ?? new Date();
  const nowIso = now.toISOString();
  const nowMs = now.getTime();
  const gated = gateBeforeLookup(params, identity, nowIso);
  if (gated) return gated;

  const fetchImpl = params.fetchImpl ?? fetch;
  const tasks: Array<Promise<OfficialCheckSummary | null>> = [];
  if (isOfficialCheckConfigured(env) && !instantCircuitOpen("bridge", nowMs)) {
    tasks.push(
      runOfficialGovernmentCheck({ ...params, env, identity }).then((summary) => summary),
    );
  }
  for (let index = 0; index < direct.length; index += 1) {
    const provider = direct[index];
    if (instantCircuitOpen(provider.id, nowMs)) continue;
    tasks.push(
      runDirectProvider({ provider, identity, fetchImpl, nowIso, nowMs }).then((attempt) => attempt.summary),
    );
  }

  if (tasks.length === 0) return quietMiss(identity, nowIso);

  return new Promise((resolve) => {
    let pending = tasks.length;
    let settled = false;
    let lastMiss: OfficialCheckSummary | null = null;
    const finish = (summary: OfficialCheckSummary) => {
      if (settled) return;
      settled = true;
      resolve(scrubSummary(summary));
    };
    for (let index = 0; index < tasks.length; index += 1) {
      tasks[index].then((summary) => {
        if (summary && hasLiveSource(summary)) finish(summary);
        else if (summary) lastMiss = summary;
      }).catch(() => undefined).finally(() => {
        pending -= 1;
        if (pending === 0 && !settled) finish(lastMiss ?? quietMiss(identity, nowIso));
      });
    }
  });
}

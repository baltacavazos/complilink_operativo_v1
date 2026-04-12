import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createHmac } from 'node:crypto';

const baseUrl = (process.argv[2] || process.env.BRIDGE_SMOKE_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const runMode = process.argv[3] || 'manual';
const secret = process.env.AUDITAPATRON_ENGINE_HMAC_SECRET;
const resultPath = '/home/ubuntu/complilink_operativo_v1/bridge_smoke_test_results.json';
const historyPath = '/home/ubuntu/complilink_operativo_v1/bridge_smoke_test_history.jsonl';
const alertStatePath = '/home/ubuntu/complilink_operativo_v1/bridge_smoke_test_alert_state.json';
const oneDayMs = 24 * 60 * 60 * 1000;
const alertThreshold = Number.isFinite(Number(process.env.BRIDGE_SMOKE_ALERT_THRESHOLD))
  ? Math.max(1, Math.round(Number(process.env.BRIDGE_SMOKE_ALERT_THRESHOLD)))
  : 3;
const forgeApiUrl = (process.env.BUILT_IN_FORGE_API_URL || '').trim();
const forgeApiKey = (process.env.BUILT_IN_FORGE_API_KEY || '').trim();

if (!secret) {
  throw new Error('Missing AUDITAPATRON_ENGINE_HMAC_SECRET environment variable');
}

const timestamp = Math.floor(Date.now() / 1000).toString();
const payload = {
  event: 'document.uploaded',
  documentId: 'SMOKE-DOC-001',
  sourceUserId: 'SMOKE-USER-001',
  docType: 'recibo_nomina',
  fileUrl: 'https://example.com/smoke-document.pdf',
  sha256: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  mimeType: 'application/pdf',
  uploadedAt: '2026-04-11T18:20:00.000Z',
};
const body = JSON.stringify(payload);
const signature = createHmac('sha256', secret).update(`${timestamp}.${body}`, 'utf8').digest('hex');

async function parseResponseJson(response) {
  const raw = await response.text();

  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return { raw };
  }
}

function readJsonFile(path, fallback) {
  if (!existsSync(path)) return fallback;

  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return fallback;
  }
}

function persistSummary(summary) {
  writeFileSync(resultPath, `${JSON.stringify(summary, null, 2)}\n`);
  appendFileSync(historyPath, `${JSON.stringify(summary)}\n`);
}

function getString(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function getNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function getBoolean(value) {
  return typeof value === 'boolean' ? value : null;
}

function parseTestedAt(value) {
  const testedAt = getString(value);
  if (!testedAt) return { testedAt: null, testedAtMs: null };

  const testedAtMs = new Date(testedAt).getTime();
  return {
    testedAt,
    testedAtMs: Number.isFinite(testedAtMs) ? testedAtMs : null,
  };
}

function getEntryStatus(entry) {
  if (entry?.contractCheck?.passed === true) return 'passed';
  if (getString(entry?.error) || (getNumber(entry?.health?.status) === null && getNumber(entry?.webhook?.status) === null)) {
    return 'error';
  }
  return 'failed';
}

function parseHistoryEntry(line) {
  if (!line || line.trim().length === 0) return null;

  try {
    const parsed = JSON.parse(line);
    const status = getEntryStatus(parsed);
    const { testedAt, testedAtMs } = parseTestedAt(parsed?.testedAt);
    return {
      testedAt,
      testedAtMs,
      status,
    };
  } catch {
    return null;
  }
}

function readHistoryMetrics(nowMs) {
  if (!existsSync(historyPath)) {
    return {
      totalRuns: 0,
      passedRuns: 0,
      failedRuns: 0,
      errorRuns: 0,
      consecutiveFailures: 0,
      successRate: 0,
      last24Hours: 0,
      latestStatus: 'missing',
    };
  }

  const entries = readFileSync(historyPath, 'utf8')
    .split('\n')
    .map((line) => parseHistoryEntry(line))
    .filter(Boolean)
    .sort((left, right) => (right.testedAtMs ?? -1) - (left.testedAtMs ?? -1));

  const totalRuns = entries.length;
  const passedRuns = entries.filter((entry) => entry.status === 'passed').length;
  const failedRuns = entries.filter((entry) => entry.status === 'failed').length;
  const errorRuns = entries.filter((entry) => entry.status === 'error').length;
  let consecutiveFailures = 0;

  for (const entry of entries) {
    if (entry.status === 'passed') break;
    consecutiveFailures += 1;
  }

  return {
    totalRuns,
    passedRuns,
    failedRuns,
    errorRuns,
    consecutiveFailures,
    successRate: totalRuns === 0 ? 0 : Math.round((passedRuns / totalRuns) * 100),
    last24Hours: entries.filter((entry) => entry.testedAtMs !== null && nowMs - entry.testedAtMs <= oneDayMs).length,
    latestStatus: entries[0]?.status ?? 'missing',
  };
}

function buildNotificationEndpoint(base) {
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  return new URL('webdevtoken.v1.WebDevService/SendNotification', normalizedBase).toString();
}

function readAlertState() {
  const fallback = {
    alertActive: false,
    activatedAt: null,
    recoveredAt: null,
    lastFailureAlertAt: null,
    lastRecoveryAlertAt: null,
    lastNotifiedStatus: null,
    lastObservedStatus: null,
    lastObservedConsecutiveFailures: 0,
    threshold: alertThreshold,
  };

  const state = readJsonFile(alertStatePath, fallback);
  return {
    ...fallback,
    ...(state && typeof state === 'object' ? state : {}),
    threshold: alertThreshold,
  };
}

function writeAlertState(state) {
  writeFileSync(alertStatePath, `${JSON.stringify(state, null, 2)}\n`);
}

async function notifyOwner({ title, content }) {
  if (!forgeApiUrl || !forgeApiKey) {
    return false;
  }

  const response = await fetch(buildNotificationEndpoint(forgeApiUrl), {
    method: 'POST',
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${forgeApiKey}`,
      'content-type': 'application/json',
      'connect-protocol-version': '1',
    },
    body: JSON.stringify({ title, content }),
  });

  return response.ok;
}

function buildFailureNotification(summary, metrics) {
  const title = `Bridge smoke alert: ${metrics.consecutiveFailures} fallos consecutivos · ${summary.testedAt}`;
  const lines = [
    `Timestamp: ${summary.testedAt}`,
    `Base URL: ${summary.baseUrl}`,
    `Run mode: ${summary.runMode}`,
    `Consecutive failures: ${metrics.consecutiveFailures}`,
    `Success rate: ${metrics.successRate}%`,
    `Runs last 24h: ${metrics.last24Hours}`,
    `Health status: ${summary.health.status ?? 'null'}`,
    `Webhook status: ${summary.webhook.status ?? 'null'}`,
    `Verified: ${summary.webhook.body?.verified === true ? 'true' : 'false'}`,
  ];

  if (summary.error) {
    lines.push(`Error: ${summary.error}`);
  }

  return {
    title,
    content: lines.join('\n'),
  };
}

function buildRecoveryNotification(summary, metrics, state) {
  return {
    title: `Bridge smoke recovered · ${summary.testedAt}`,
    content: [
      `Timestamp: ${summary.testedAt}`,
      `Base URL: ${summary.baseUrl}`,
      `Run mode: ${summary.runMode}`,
      `Recovered after alert activated at: ${state.activatedAt ?? 'unknown'}`,
      `Success rate: ${metrics.successRate}%`,
      `Runs last 24h: ${metrics.last24Hours}`,
      `Health status: ${summary.health.status ?? 'null'}`,
      `Webhook status: ${summary.webhook.status ?? 'null'}`,
      `Verified: ${summary.webhook.body?.verified === true ? 'true' : 'false'}`,
    ].join('\n'),
  };
}

async function evaluateAlerting(summary, metrics) {
  const state = readAlertState();
  const baseState = {
    ...state,
    threshold: alertThreshold,
    lastObservedStatus: metrics.latestStatus,
    lastObservedConsecutiveFailures: metrics.consecutiveFailures,
  };
  const notificationsConfigured = Boolean(forgeApiUrl && forgeApiKey);

  if (summary.contractCheck.passed === true) {
    if (!state.alertActive) {
      return {
        nextState: {
          ...baseState,
          alertActive: false,
        },
        alerting: {
          threshold: alertThreshold,
          notificationsConfigured,
          action: 'none',
          delivered: false,
          alertActive: false,
        },
      };
    }

    const payload = buildRecoveryNotification(summary, metrics, state);
    const delivered = await notifyOwner(payload);
    return {
      nextState: delivered
        ? {
            ...baseState,
            alertActive: false,
            recoveredAt: summary.testedAt,
            lastRecoveryAlertAt: summary.testedAt,
            lastNotifiedStatus: 'recovery',
          }
        : {
            ...baseState,
            alertActive: true,
          },
      alerting: {
        threshold: alertThreshold,
        notificationsConfigured,
        action: 'recovery',
        delivered,
        alertActive: delivered ? false : true,
      },
    };
  }

  if (metrics.consecutiveFailures < alertThreshold) {
    return {
      nextState: {
        ...baseState,
        alertActive: state.alertActive,
      },
      alerting: {
        threshold: alertThreshold,
        notificationsConfigured,
        action: 'below-threshold',
        delivered: false,
        alertActive: state.alertActive,
      },
    };
  }

  if (state.alertActive) {
    return {
      nextState: {
        ...baseState,
        alertActive: true,
      },
      alerting: {
        threshold: alertThreshold,
        notificationsConfigured,
        action: 'deduped-active-alert',
        delivered: false,
        alertActive: true,
      },
    };
  }

  const payload = buildFailureNotification(summary, metrics);
  const delivered = await notifyOwner(payload);
  return {
    nextState: delivered
      ? {
          ...baseState,
          alertActive: true,
          activatedAt: summary.testedAt,
          lastFailureAlertAt: summary.testedAt,
          lastNotifiedStatus: 'failure',
        }
      : {
          ...baseState,
          alertActive: false,
        },
    alerting: {
      threshold: alertThreshold,
      notificationsConfigured,
      action: 'failure-threshold-reached',
      delivered,
      alertActive: delivered,
    },
  };
}

const summary = {
  testedAt: new Date().toISOString(),
  baseUrl,
  runMode,
  health: {
    status: null,
    body: null,
  },
  webhook: {
    status: null,
    body: null,
  },
  contractCheck: {
    expectedHealthStatus: 200,
    expectedWebhookStatus: 202,
    expectedContract: 'auditapatron.bridge.ack.v1',
    passed: false,
  },
  error: null,
  alerting: {
    threshold: alertThreshold,
    notificationsConfigured: Boolean(forgeApiUrl && forgeApiKey),
    action: 'pending',
    delivered: false,
    alertActive: false,
  },
};

try {
  const healthResponse = await fetch(`${baseUrl}/api/auditapatron/health`);
  const healthJson = await parseResponseJson(healthResponse);
  summary.health = {
    status: healthResponse.status,
    body: healthJson,
  };

  const webhookResponse = await fetch(`${baseUrl}/api/auditapatron/webhook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-AuditaPatron-Timestamp': timestamp,
      'X-AuditaPatron-Signature': signature,
    },
    body,
  });
  const webhookJson = await parseResponseJson(webhookResponse);
  summary.webhook = {
    status: webhookResponse.status,
    body: webhookJson,
  };

  summary.contractCheck.passed =
    healthResponse.status === 200 &&
    webhookResponse.status === 202 &&
    healthJson?.responseContract === 'auditapatron.bridge.ack.v1' &&
    webhookJson?.responseContract === 'auditapatron.bridge.ack.v1' &&
    webhookJson?.verified === true &&
    webhookJson?.event === 'document.uploaded';
} catch (error) {
  summary.error = error instanceof Error ? error.message : String(error);
}

persistSummary(summary);
const metrics = readHistoryMetrics(new Date(summary.testedAt).getTime());
const alertEvaluation = await evaluateAlerting(summary, metrics);
summary.alerting = alertEvaluation.alerting;
writeAlertState(alertEvaluation.nextState);
writeFileSync(resultPath, `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify(summary, null, 2));

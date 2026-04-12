import { buildBridgeMonitoringPanel } from "../client/src/pages/ceoBridgeMonitoring";
import {
  buildCeoCsvReport,
  buildCeoPdfReport,
  type CeoCustomExportPayload,
} from "../client/src/pages/ceoDashboardExports";
import { sendEmailWithResend } from "./authService";
import {
  buildTraceId,
  createAuditLog,
  getCeoDashboardSnapshot,
  listAuditTrail,
  listDueCeoBridgeSchedules,
  recordCeoBridgeScheduleRun,
  type CeoBridgePresetRecord,
  type CeoBridgeScheduleRecord,
} from "./db";

const CRON_PARTS = 6;
const BRIDGE_SCHEDULER_INTERVAL_MS = 60_000;
const CRON_RANGES: Array<[number, number]> = [
  [0, 59],
  [0, 59],
  [0, 23],
  [1, 31],
  [1, 12],
  [0, 6],
];

let schedulerStarted = false;
let schedulerTimer: NodeJS.Timeout | null = null;
let scheduleRunInFlight = false;

function sanitizeCronExpression(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function isIntegerToken(value: string) {
  return /^\d+$/.test(value);
}

function validateCronToken(token: string, range: [number, number]): boolean {
  const [min, max] = range;
  if (token === "*") return true;

  const [base, step] = token.split("/");
  if (step !== undefined) {
    if (!isIntegerToken(step)) return false;
    const stepValue = Number(step);
    if (!Number.isInteger(stepValue) || stepValue < 1 || stepValue > max - min + 1) return false;
    return validateCronToken(base, range);
  }

  if (base.includes(",")) {
    return base
      .split(",")
      .every((part) => validateCronToken(part, range));
  }

  if (base.includes("-")) {
    const [start, end] = base.split("-");
    if (!isIntegerToken(start) || !isIntegerToken(end)) return false;
    const startValue = Number(start);
    const endValue = Number(end);
    return startValue >= min && endValue <= max && startValue <= endValue;
  }

  if (!isIntegerToken(base)) return false;
  const numeric = Number(base);
  return numeric >= min && numeric <= max;
}

function cronMatchesValue(token: string, value: number): boolean {
  if (token === "*") return true;

  const [base, step] = token.split("/");
  if (step !== undefined) {
    const stepValue = Number(step);
    if (!Number.isInteger(stepValue) || stepValue < 1) return false;
    if (base === "*") {
      return value % stepValue === 0;
    }
    if (base.includes("-")) {
      const [start, end] = base.split("-").map(Number);
      return value >= start && value <= end && (value - start) % stepValue === 0;
    }
    const start = Number(base);
    return value >= start && (value - start) % stepValue === 0;
  }

  if (base.includes(",")) {
    return base.split(",").some((part) => cronMatchesValue(part, value));
  }

  if (base.includes("-")) {
    const [start, end] = base.split("-").map(Number);
    return value >= start && value <= end;
  }

  return Number(base) === value;
}

function getTimeParts(date: Date, timezone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour12: false,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    weekday: "short",
  });
  const parts = formatter.formatToParts(date);
  const map = new Map<string, string>(parts.map((part): [string, string] => [part.type, part.value]));
  const weekday = map.get("weekday") ?? "Sun";
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  return {
    second: Number(map.get("second") ?? "0"),
    minute: Number(map.get("minute") ?? "0"),
    hour: Number(map.get("hour") ?? "0"),
    day: Number(map.get("day") ?? "1"),
    month: Number(map.get("month") ?? "1"),
    weekday: weekdayMap[weekday] ?? 0,
  };
}

export function validateBridgeScheduleTimezone(timezone: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function validateBridgeScheduleCronExpression(expression: string) {
  const normalized = sanitizeCronExpression(expression);
  const tokens = normalized.split(" ");
  if (tokens.length !== CRON_PARTS) return false;
  return tokens.every((token, index) => validateCronToken(token, CRON_RANGES[index]));
}

function cronMatchesDate(expression: string, date: Date, timezone: string) {
  const tokens = sanitizeCronExpression(expression).split(" ");
  if (tokens.length !== CRON_PARTS) return false;
  const parts = getTimeParts(date, timezone);
  const values = [parts.second, parts.minute, parts.hour, parts.day, parts.month, parts.weekday];
  return tokens.every((token, index) => cronMatchesValue(token, values[index]));
}

export function computeNextBridgeScheduleRunAt(expression: string, timezone: string, fromDate = new Date()) {
  if (!validateBridgeScheduleCronExpression(expression)) {
    throw new Error("La expresión cron debe usar 6 campos válidos.");
  }
  if (!validateBridgeScheduleTimezone(timezone)) {
    throw new Error("La zona horaria indicada no es válida.");
  }

  const probe = new Date(fromDate.getTime() + 1000);
  probe.setMilliseconds(0);
  const horizon = probe.getTime() + 366 * 24 * 60 * 60 * 1000;

  while (probe.getTime() <= horizon) {
    if (cronMatchesDate(expression, probe, timezone)) {
      return new Date(probe.getTime());
    }
    probe.setSeconds(probe.getSeconds() + 1);
  }

  throw new Error("No se encontró una próxima ejecución válida en el horizonte permitido.");
}

async function buildBridgeCustomExport(params: {
  userId: number;
  snapshot: Awaited<ReturnType<typeof getCeoDashboardSnapshot>>;
  tenantId?: string;
}): Promise<CeoCustomExportPayload> {
  const auditTrail = await listAuditTrail({
    userId: params.userId,
    tenantId: params.tenantId,
    limit: 300,
  });
  const panel = buildBridgeMonitoringPanel({
    auditTrail,
    tenantHealth: params.snapshot.tenantHealth,
    recentDocuments: params.snapshot.recentDocuments,
    recentAlerts: params.snapshot.recentAlerts,
  });

  return {
    title: "Reporte ejecutivo CEO · Bridge operativo",
    summaryRows: [
      ["Documentos monitoreados", String(panel.summary.trackedDocuments)],
      ["Saludables", String(panel.summary.healthy)],
      ["Pendientes", String(panel.summary.pending)],
      ["Con warning", String(panel.summary.warning)],
      ["Críticos", String(panel.summary.critical)],
      ["Con retorno", String(panel.summary.withReturn)],
      ["Con advertencias", String(panel.summary.withWarnings)],
      ["Con reintento programado", String(panel.summary.retryScheduled)],
    ],
    tables: [
      {
        title: "Bridge operativo",
        columns: [
          "Tenant",
          "Caso",
          "Documento",
          "Tipo",
          "Estado bridge",
          "Resultado",
          "Intentos",
          "Alertas abiertas",
          "Última actividad",
          "Warnings",
        ],
        rows: panel.rows.map((row) => [
          row.tenantName,
          row.caseTitle ?? row.caseId ?? "—",
          row.documentName,
          row.documentType,
          row.dispatchStatus,
          row.health,
          String(row.attempts),
          String(row.openAlertCount),
          row.lastActivityAt ? new Date(row.lastActivityAt).toISOString() : "—",
          row.warnings.length > 0 ? row.warnings.join(" | ") : "—",
        ]),
      },
    ],
  };
}

async function buildBridgeScheduleAttachments(params: {
  preset: CeoBridgePresetRecord;
  actorLabel: string;
  userId: number;
}) {
  const snapshot = await getCeoDashboardSnapshot(params.preset.filters);
  const appliedFilters: string[] = [];

  if (params.preset.filters.tenantId) appliedFilters.push(`Tenant: ${params.preset.filters.tenantId}`);
  if (params.preset.filters.severity) appliedFilters.push(`Severidad: ${params.preset.filters.severity}`);
  if (params.preset.filters.caseId) appliedFilters.push(`Caso: ${params.preset.filters.caseId}`);
  if (params.preset.filters.userId) appliedFilters.push(`Usuario: ${params.preset.filters.userId}`);
  if (params.preset.filters.dateWindowDays) appliedFilters.push(`Ventana: ${params.preset.filters.dateWindowDays} días`);
  if (params.preset.filters.query) appliedFilters.push(`Búsqueda: ${params.preset.filters.query}`);

  const exportPayload = {
    section: "bridge" as const,
    snapshot,
    appliedFilters,
    actorLabel: params.actorLabel,
    customExport: await buildBridgeCustomExport({
      userId: params.userId,
      snapshot,
      tenantId: params.preset.tenantId ?? undefined,
    }),
  };

  const csv = buildCeoCsvReport(exportPayload);
  const attachments = [
    {
      filename: csv.filename,
      content: Buffer.from(csv.content, "utf8").toString("base64"),
      contentType: "text/csv",
    },
  ];

  if (params.preset.exportFormat === "pdf") {
    const pdf = buildCeoPdfReport(exportPayload);
    const pdfBuffer = Buffer.from(await pdf.blob.arrayBuffer());
    attachments.unshift({
      filename: pdf.filename,
      content: pdfBuffer.toString("base64"),
      contentType: "application/pdf",
    });
  }

  return {
    snapshot,
    appliedFilters,
    visibleCount: exportPayload.customExport.tables[0]?.rows.length ?? 0,
    attachments,
  };
}

async function runSingleCeoBridgeSchedule(job: {
  schedule: CeoBridgeScheduleRecord;
  preset: CeoBridgePresetRecord;
  userEmail: string | null;
  userName: string | null;
}) {
  const executedAt = new Date();
  const nextRunAt = computeNextBridgeScheduleRunAt(job.schedule.cronExpression, job.schedule.timezone, executedAt);
  const recipients =
    job.preset.emailRecipients.length > 0
      ? job.preset.emailRecipients
      : job.userEmail
        ? [job.userEmail]
        : [];

  if (recipients.length === 0) {
    throw new Error("La agenda automática no tiene destinatarios configurados.");
  }

  const actorLabel = job.userName?.trim() || job.userEmail?.trim() || "Agenda bridge CEO";
  const auditTenantId = job.schedule.tenantId ?? job.preset.tenantId ?? "global";
  const { snapshot, appliedFilters, visibleCount, attachments } = await buildBridgeScheduleAttachments({
    preset: job.preset,
    actorLabel,
    userId: job.schedule.userId,
  });

  const snapshotLabel = new Date(snapshot.generatedAt).toLocaleString("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  });
  const filtersLabel = appliedFilters.length > 0 ? appliedFilters.join(" | ") : "Sin filtros activos";

  await sendEmailWithResend({
    to: recipients,
    subject: `CompliLink · Agenda bridge operativo · ${job.preset.name}`,
    html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a"><h2 style="margin-bottom:12px">Bridge operativo · Agenda automática</h2><p>Se adjunta la exportación programada del bridge operativo.</p><p><strong>Preset:</strong> ${job.preset.name}</p><p><strong>Ejecutado por:</strong> ${actorLabel}</p><p><strong>Snapshot:</strong> ${snapshotLabel} UTC</p><p><strong>Filtros:</strong> ${filtersLabel}</p><p><strong>Registros visibles:</strong> ${visibleCount}</p>${job.preset.emailMessage ? `<p><strong>Mensaje:</strong> ${job.preset.emailMessage}</p>` : ""}<p style="margin-top:18px;color:#475569">AuditaPatron · Entrega automática generada desde la Consola CEO.</p></div>`,
    text: [
      "Bridge operativo · Agenda automática",
      `Preset: ${job.preset.name}`,
      `Ejecutado por: ${actorLabel}`,
      `Snapshot: ${snapshotLabel} UTC`,
      `Filtros: ${filtersLabel}`,
      `Registros visibles: ${visibleCount}`,
      job.preset.emailMessage ? `Mensaje: ${job.preset.emailMessage}` : null,
      "AuditaPatron · Entrega automática generada desde la Consola CEO.",
    ]
      .filter(Boolean)
      .join("\n"),
    attachments,
  });

  await createAuditLog({
    tenantId: auditTenantId,
    caseId: null,
    traceId: buildTraceId(auditTenantId, `CEO-BRIDGE-SCHEDULE-${job.schedule.id}`),
    actorUserId: job.schedule.userId,
    entityType: "system",
    entityId: `bridge-schedule:${job.schedule.id}`,
    action: "dashboard.ceo.bridge_schedule_executed",
    afterState: {
      scheduleId: job.schedule.id,
      presetId: job.preset.id,
      presetName: job.preset.name,
      snapshotGeneratedAt: snapshot.generatedAt,
      appliedFilters,
      visibleCount,
      recipientCount: recipients.length,
      recipients,
      exportFormat: job.preset.exportFormat,
      attachments: attachments.map((attachment) => attachment.filename),
    },
  });

  await recordCeoBridgeScheduleRun({
    id: job.schedule.id,
    lastRunAt: executedAt,
    nextRunAt,
    lastRunStatus: "sent",
    lastRunError: null,
  });
}

function flattenBridgeScheduleErrorSignals(error: unknown) {
  const signals: string[] = [];
  let current: unknown = error;

  for (let depth = 0; depth < 4 && current; depth += 1) {
    if (typeof current === "string") {
      signals.push(current);
      break;
    }

    if (current instanceof Error) {
      signals.push(current.message);
      current = "cause" in current ? (current as Error & { cause?: unknown }).cause : undefined;
      continue;
    }

    if (typeof current === "object") {
      const record = current as Record<string, unknown>;
      for (const key of ["message", "code", "sql", "query"]) {
        if (typeof record[key] === "string") {
          signals.push(record[key] as string);
        }
      }
      current = record.cause;
      continue;
    }

    signals.push(String(current));
    break;
  }

  return signals.join(" | ").toLowerCase();
}

export function isMissingCeoBridgeScheduleTableError(error: unknown) {
  const normalized = flattenBridgeScheduleErrorSignals(error);
  const mentionsBridgeScheduleTable =
    normalized.includes("ceo_bridge_schedules") || normalized.includes("ceo_bridge_presets");
  const missingTableSignals =
    normalized.includes("doesn't exist") ||
    normalized.includes("no such table") ||
    normalized.includes("er_no_such_table");

  return mentionsBridgeScheduleTable && missingTableSignals;
}

export async function processDueCeoBridgeSchedules() {
  if (scheduleRunInFlight) return;
  scheduleRunInFlight = true;

  try {
    let dueSchedules: Awaited<ReturnType<typeof listDueCeoBridgeSchedules>> = [];
    try {
      dueSchedules = await listDueCeoBridgeSchedules(new Date(), 5);
    } catch (error) {
      if (isMissingCeoBridgeScheduleTableError(error)) {
        console.info("[CEO Bridge Schedule] Worker paused: faltan tablas de agenda del bridge en la base de datos.");
        return;
      }
      throw error;
    }

    for (const job of dueSchedules) {
      try {
        await runSingleCeoBridgeSchedule(job);
      } catch (error) {
        const executedAt = new Date();
        const nextRunAt = computeNextBridgeScheduleRunAt(job.schedule.cronExpression, job.schedule.timezone, executedAt);
        const errorMessage = error instanceof Error ? error.message : "Error desconocido al ejecutar la agenda automática del bridge.";

        const auditTenantId = job.schedule.tenantId ?? "global";

        await createAuditLog({
          tenantId: auditTenantId,
          caseId: null,
          traceId: buildTraceId(auditTenantId, `CEO-BRIDGE-SCHEDULE-${job.schedule.id}-FAILED`),
          actorUserId: job.schedule.userId,
          entityType: "system",
          entityId: `bridge-schedule:${job.schedule.id}`,
          action: "dashboard.ceo.bridge_schedule_failed",
          afterState: {
            scheduleId: job.schedule.id,
            presetId: job.preset.id,
            presetName: job.preset.name,
            lastRunAt: executedAt.toISOString(),
            nextRunAt: nextRunAt.toISOString(),
            lastRunError: errorMessage,
            error: errorMessage,
          },
        });

        await recordCeoBridgeScheduleRun({
          id: job.schedule.id,
          lastRunAt: executedAt,
          nextRunAt,
          lastRunStatus: "failed",
          lastRunError: errorMessage,
        });
      }
    }
  } finally {
    scheduleRunInFlight = false;
  }
}

export function startCeoBridgeScheduleWorker() {
  if (schedulerStarted) return;
  schedulerStarted = true;
  schedulerTimer = setInterval(() => {
    processDueCeoBridgeSchedules().catch((error) => {
      console.error("[CEO Bridge Schedule] Worker error", error);
    });
  }, BRIDGE_SCHEDULER_INTERVAL_MS);
  processDueCeoBridgeSchedules().catch((error) => {
    if (isMissingCeoBridgeScheduleTableError(error)) {
      console.info("[CEO Bridge Schedule] Initial scan skipped: faltan tablas de agenda del bridge.");
      return;
    }
    console.error("[CEO Bridge Schedule] Initial scan error", error);
  });
}

export function stopCeoBridgeScheduleWorker() {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
  }
  schedulerStarted = false;
}

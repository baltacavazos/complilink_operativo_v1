import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export type CeoDashboardSection = "resumen" | "bridge" | "alertas" | "accesos" | "documentos";

export type CeoDashboardSnapshot = {
  generatedAt: Date | string;
  summary: {
    totalTenants: number;
    activeCases: number;
    totalDocuments: number;
    openAlerts: number;
    criticalAlerts: number;
    activeMemberships: number;
    caseScopedMemberships: number;
    pendingDocuments: number;
    pendingConsents: number;
    supersededDocuments: number;
  };
  tenantHealth: Array<{
    tenantId: string;
    tenantName: string;
    status: string;
    activeCases: number;
    openAlerts: number;
    activeMemberships: number;
    caseScopedMemberships: number;
    pendingDocuments: number;
  }>;
  recentCases: Array<{
    tenantId: string;
    tenantName: string;
    caseId: string;
    title: string;
    status: string;
    priority: string;
    updatedAt: Date | string | null;
    lastActivityAt?: Date | string | null;
  }>;
  recentAlerts: Array<{
    id: number;
    tenantId: string;
    tenantName: string;
    caseId?: string | null;
    caseTitle?: string | null;
    traceId?: string | null;
    title: string;
    description?: string | null;
    category: string;
    severity: string;
    status: string;
    raisedAt: Date | string | null;
    resolvedAt?: Date | string | null;
  }>;
  recentMemberships: Array<{
    id: number;
    tenantId: string;
    tenantName: string;
    caseId?: string | null;
    caseTitle?: string | null;
    traceId?: string | null;
    userId: number;
    userName?: string | null;
    userEmail?: string | null;
    role: string;
    status: string;
    accessScope: string;
    createdAt: Date | string | null;
    updatedAt: Date | string | null;
  }>;
  recentDocuments: Array<{
    documentId: string;
    tenantId: string;
    tenantName: string;
    caseId: string;
    caseTitle?: string | null;
    traceId: string;
    originalName: string;
    documentType: string;
    visibility: string;
    integrityStatus: string;
    classificationConfidence?: number | null;
    consentStatus: string;
    supersedesDocumentId?: string | null;
    createdAt: Date | string | null;
    updatedAt: Date | string | null;
    supersededDocument?: {
      originalName?: string | null;
      integrityStatus?: string | null;
    } | null;
  }>;
};

export type CeoExportTable = {
  title: string;
  columns: string[];
  rows: string[][];
};

export type CeoCustomExportPayload = {
  title?: string;
  summaryRows: Array<[string, string]>;
  tables: CeoExportTable[];
};

const CEO_EXPORT_MAX_CELL_LENGTH = 240;

export type CeoPdfModel = {
  title: string;
  filename: string;
  summaryRows: Array<[string, string]>;
  tables: CeoExportTable[];
};

type BuildExportArgs = {
  section: CeoDashboardSection;
  snapshot: CeoDashboardSnapshot;
  appliedFilters: string[];
  actorLabel: string;
  exportedAt?: Date;
  customExport?: CeoCustomExportPayload;
};

export type CeoExportGuardInput = {
  hasSnapshot: boolean;
  isRefreshing: boolean;
  isSnapshotStale: boolean;
  hasSnapshotError: boolean;
};

export function getCeoExportBlockReason({
  hasSnapshot,
  isRefreshing,
  isSnapshotStale,
  hasSnapshotError,
}: CeoExportGuardInput) {
  if (!hasSnapshot) {
    return "Espera a que el snapshot ejecutivo termine de cargar para generar el reporte.";
  }
  if (isRefreshing) {
    return "La consola está refrescando la vista ejecutiva. Espera a que termine antes de exportar.";
  }
  if (hasSnapshotError) {
    return "La vista ejecutiva tuvo un problema al cargar. Refresca antes de generar un reporte.";
  }
  if (isSnapshotStale) {
    return "Datos desactualizados. Actualiza el dashboard antes de continuar.";
  }

  return null;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("es-MX").format(value ?? 0);
}

function clampExportText(value: string) {
  if (value.length <= CEO_EXPORT_MAX_CELL_LENGTH) {
    return value;
  }

  return `${value.slice(0, CEO_EXPORT_MAX_CELL_LENGTH - 1).trimEnd()}…`;
}

function formatDateTime(value: Date | string | null | undefined) {
  if (!value) return "Sin fecha";
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Sin fecha";

  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

function sanitizeCell(value: unknown) {
  if (typeof value === "number") return String(value);
  if (typeof value === "string") {
    const normalized = value.replace(/\r\n/g, "\n").replace(/[\r\n\t]+/g, " ").replace(/\s{2,}/g, " ").trim();
    return normalized.length > 0 ? clampExportText(normalized) : "—";
  }
  if (value instanceof Date) return formatDateTime(value);
  if (value === null || value === undefined) return "—";
  return clampExportText(String(value));
}

function sanitizeCsvCell(value: unknown) {
  const normalized = sanitizeCell(value)
    .replace(/\r\n/g, "\n")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

  if (/^[=+\-@]/.test(normalized)) {
    return `'${normalized}`;
  }

  return normalized;
}

function escapeCsv(value: unknown) {
  const sanitized = sanitizeCsvCell(value).replaceAll('"', '""');
  return `"${sanitized}"`;
}

export function getCeoSectionLabel(section: CeoDashboardSection) {
  if (section === "bridge") return "Bridge operativo";
  if (section === "alertas") return "Alertas";
  if (section === "accesos") return "Accesos";
  if (section === "documentos") return "Documentos";
  return "Resumen CEO";
}

function buildFilename(section: CeoDashboardSection, kind: "csv" | "pdf", exportedAt: Date) {
  const parts = [
    exportedAt.getFullYear(),
    String(exportedAt.getMonth() + 1).padStart(2, "0"),
    String(exportedAt.getDate()).padStart(2, "0"),
  ].join("");
  const time = [
    String(exportedAt.getHours()).padStart(2, "0"),
    String(exportedAt.getMinutes()).padStart(2, "0"),
  ].join("");

  return `ceo-${section}-${parts}-${time}.${kind}`;
}

export function buildCeoExportTables(
  section: CeoDashboardSection,
  snapshot: CeoDashboardSnapshot,
  customExport?: CeoCustomExportPayload,
): CeoExportTable[] {
  const tenantTable: CeoExportTable = {
    title: "Salud por tenant",
    columns: ["Tenant", "Estado", "Casos activos", "Alertas abiertas", "Accesos vigentes", "Documentos pendientes"],
    rows: snapshot.tenantHealth.map((tenant) => [
      tenant.tenantName,
      tenant.status,
      formatNumber(tenant.activeCases),
      formatNumber(tenant.openAlerts),
      formatNumber(tenant.activeMemberships),
      formatNumber(tenant.pendingDocuments),
    ]),
  };

  const caseTable: CeoExportTable = {
    title: "Casos visibles",
    columns: ["Caso", "ID", "Tenant", "Estado", "Prioridad", "Actualizado", "Última actividad"],
    rows: snapshot.recentCases.map((item) => [
      item.title,
      item.caseId,
      item.tenantName,
      item.status,
      item.priority,
      formatDateTime(item.updatedAt),
      formatDateTime(item.lastActivityAt ?? item.updatedAt),
    ]),
  };

  const alertTable: CeoExportTable = {
    title: "Alertas visibles",
    columns: ["Alerta", "Tenant", "Caso", "Severidad", "Estado", "Categoría", "Levantada", "Trace ID"],
    rows: snapshot.recentAlerts.map((alert) => [
      alert.title || `Alerta ${alert.id}`,
      alert.tenantName,
      alert.caseTitle || alert.caseId || "—",
      alert.severity,
      alert.status,
      alert.category,
      formatDateTime(alert.raisedAt),
      alert.traceId || "—",
    ]),
  };

  const membershipTable: CeoExportTable = {
    title: "Accesos visibles",
    columns: ["Usuario", "Correo", "Tenant", "Caso", "Rol", "Estado", "Ámbito", "Actualizado"],
    rows: snapshot.recentMemberships.map((membership) => [
      membership.userName || membership.userEmail || `Usuario ${membership.userId}`,
      membership.userEmail || "—",
      membership.tenantName,
      membership.caseTitle || membership.caseId || "—",
      membership.role,
      membership.status,
      membership.accessScope,
      formatDateTime(membership.updatedAt),
    ]),
  };

  const documentTable: CeoExportTable = {
    title: "Documentos visibles",
    columns: ["Documento", "Tenant", "Caso", "Tipo", "Visibilidad", "Integridad", "Consentimiento", "Actualizado"],
    rows: snapshot.recentDocuments.map((document) => [
      document.originalName,
      document.tenantName,
      document.caseTitle || document.caseId,
      document.documentType,
      document.visibility,
      document.integrityStatus,
      document.consentStatus,
      formatDateTime(document.updatedAt),
    ]),
  };

  if (section === "bridge") {
    return customExport?.tables ?? [
      {
        title: "Bridge operativo",
        columns: ["Estado"],
        rows: [["Sin datos de exportación bridge disponibles"]],
      },
    ];
  }
  if (section === "alertas") return [alertTable];
  if (section === "accesos") return [membershipTable];
  if (section === "documentos") return [documentTable];
  return [tenantTable, caseTable, alertTable, membershipTable, documentTable];
}

export function buildCeoPdfModel({ section, snapshot, appliedFilters, actorLabel, exportedAt = new Date(), customExport }: BuildExportArgs): CeoPdfModel {
  const currentSection = getCeoSectionLabel(section);
  const filename = buildFilename(section, "pdf", exportedAt);
  const filtersLabel = appliedFilters.length > 0 ? appliedFilters.join(" | ") : "Sin filtros activos";
  const tables = buildCeoExportTables(section, snapshot, customExport).map((table) => ({
    title: sanitizeCell(table.title),
    columns: table.columns.map((column) => sanitizeCell(column)),
    rows: table.rows.map((row) => row.map((cell) => sanitizeCell(cell))),
  }));
  const summaryRows: Array<[string, string]> =
    section === "bridge" && customExport
      ? [
          ["Vista", sanitizeCell(currentSection)],
          ["Exportado por", sanitizeCell(actorLabel)],
          ["Generado", formatDateTime(exportedAt)],
          ["Snapshot", formatDateTime(snapshot.generatedAt)],
          ["Filtros", sanitizeCell(filtersLabel)],
          ...customExport.summaryRows.map(
            ([label, value]): [string, string] => [sanitizeCell(label), sanitizeCell(value)],
          ),
        ]
      : [
          ["Vista", sanitizeCell(currentSection)],
          ["Exportado por", sanitizeCell(actorLabel)],
          ["Generado", formatDateTime(exportedAt)],
          ["Snapshot", formatDateTime(snapshot.generatedAt)],
          ["Filtros", sanitizeCell(filtersLabel)],
          ["Tenants activos", formatNumber(snapshot.summary.totalTenants)],
          ["Casos activos", formatNumber(snapshot.summary.activeCases)],
          ["Alertas abiertas", formatNumber(snapshot.summary.openAlerts)],
          ["Alertas críticas", formatNumber(snapshot.summary.criticalAlerts)],
          ["Accesos vigentes", formatNumber(snapshot.summary.activeMemberships)],
          ["Documentos pendientes", formatNumber(snapshot.summary.pendingDocuments)],
          ["Documentos totales", formatNumber(snapshot.summary.totalDocuments)],
        ];

  return {
    title: sanitizeCell(customExport?.title ?? `Reporte ejecutivo CEO · ${currentSection}`),
    filename,
    summaryRows,
    tables,
  };
}

export function buildCeoCsvReport({ section, snapshot, appliedFilters, actorLabel, exportedAt = new Date(), customExport }: BuildExportArgs) {
  const model = buildCeoPdfModel({ section, snapshot, appliedFilters, actorLabel, exportedAt, customExport });
  const lines: string[] = [];

  lines.push([escapeCsv("Reporte ejecutivo CEO"), escapeCsv(model.title)].join(","));
  for (const [label, value] of model.summaryRows) {
    lines.push([escapeCsv(label), escapeCsv(value)].join(","));
  }

  for (const table of model.tables) {
    lines.push("");
    lines.push([escapeCsv(table.title)].join(","));
    lines.push(table.columns.map((cell) => escapeCsv(cell)).join(","));
    for (const row of table.rows) {
      lines.push(row.map((cell) => escapeCsv(cell)).join(","));
    }
    if (table.rows.length === 0) {
      lines.push([escapeCsv("Sin registros visibles para esta sección")].join(","));
    }
  }

  return {
    filename: buildFilename(section, "csv", exportedAt),
    content: `${lines.join("\n")}\n`,
  };
}

function saveBlob(filename: string, content: BlobPart | Blob, mimeType: string) {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  window.setTimeout(() => {
    URL.revokeObjectURL(url);
    anchor.remove();
  }, 0);
}

export function downloadCeoCsvReport(args: BuildExportArgs) {
  const csv = buildCeoCsvReport(args);
  saveBlob(csv.filename, csv.content, "text/csv;charset=utf-8");
  return csv.filename;
}

export function downloadCeoPdfReport(args: BuildExportArgs) {
  const model = buildCeoPdfModel(args);
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 40;
  let cursorY = 44;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(model.title, marginX, cursorY);
  cursorY += 18;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text("AuditaPatron · Reporte exportable generado desde la Consola CEO", marginX, cursorY);
  cursorY += 18;

  autoTable(doc, {
    startY: cursorY,
    theme: "grid",
    margin: { left: marginX, right: marginX },
    styles: {
      fontSize: 9,
      cellPadding: 6,
      textColor: [15, 23, 42],
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
    },
    body: model.summaryRows,
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 180 },
      1: { cellWidth: pageWidth - marginX * 2 - 180 },
    },
  });

  for (const table of model.tables) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    const nextY = ((doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? cursorY) + 26;
    doc.text(table.title, marginX, nextY);

    autoTable(doc, {
      startY: nextY + 10,
      theme: "striped",
      margin: { left: marginX, right: marginX },
      head: [table.columns],
      body: table.rows.length > 0 ? table.rows : [["Sin registros visibles para esta sección"]],
      styles: {
        fontSize: 8,
        cellPadding: 5,
        textColor: [15, 23, 42],
        overflow: "linebreak",
      },
      headStyles: {
        fillColor: [13, 148, 136],
        textColor: [255, 255, 255],
      },
    });
  }

  const pdfBlob = doc.output("blob");
  saveBlob(model.filename, pdfBlob, "application/pdf");
  return model.filename;
}

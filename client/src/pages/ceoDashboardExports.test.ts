import { describe, expect, it } from "vitest";

import {
  buildCeoCsvReport,
  buildCeoExportTables,
  buildCeoPdfModel,
  getCeoExportBlockReason,
  type CeoDashboardSnapshot,
} from "./ceoDashboardExports";

function buildExpectedFilename(section: string, extension: "pdf" | "csv", exportedAt: Date) {
  const parts = [
    exportedAt.getFullYear(),
    String(exportedAt.getMonth() + 1).padStart(2, "0"),
    String(exportedAt.getDate()).padStart(2, "0"),
  ].join("");
  const time = [
    String(exportedAt.getHours()).padStart(2, "0"),
    String(exportedAt.getMinutes()).padStart(2, "0"),
  ].join("");

  return `ceo-${section}-${parts}-${time}.${extension}`;
}

function buildSnapshot(): CeoDashboardSnapshot {
  return {
    generatedAt: new Date("2026-04-10T12:00:00.000Z"),
    summary: {
      totalTenants: 2,
      activeCases: 5,
      totalDocuments: 14,
      openAlerts: 3,
      criticalAlerts: 1,
      activeMemberships: 6,
      caseScopedMemberships: 4,
      pendingDocuments: 2,
      pendingConsents: 1,
      supersededDocuments: 1,
    },
    tenantHealth: [
      {
        tenantId: "tenant-a",
        tenantName: "Balt Demo",
        status: "active",
        activeCases: 3,
        openAlerts: 2,
        activeMemberships: 4,
        caseScopedMemberships: 3,
        pendingDocuments: 1,
      },
    ],
    recentCases: [
      {
        tenantId: "tenant-a",
        tenantName: "Balt Demo",
        caseId: "CASE-001",
        title: "Despido injustificado",
        status: "analysis",
        priority: "high",
        updatedAt: new Date("2026-04-10T10:00:00.000Z"),
        lastActivityAt: new Date("2026-04-10T11:00:00.000Z"),
      },
    ],
    recentAlerts: [
      {
        id: 101,
        tenantId: "tenant-a",
        tenantName: "Balt Demo",
        caseId: "CASE-001",
        caseTitle: "Despido injustificado",
        title: "Pago omitido detectado",
        description: "Se detectó una omisión en nómina.",
        category: "payroll",
        severity: "critical",
        status: "open",
        raisedAt: new Date("2026-04-10T09:00:00.000Z"),
        resolvedAt: null,
      },
    ],
    recentMemberships: [
      {
        id: 501,
        tenantId: "tenant-a",
        tenantName: "Balt Demo",
        caseId: "CASE-001",
        caseTitle: "Despido injustificado",
        userId: 77,
        userName: "Ana Operaciones",
        userEmail: "ana@demo.mx",
        role: "reviewer",
        status: "active",
        accessScope: "case",
        createdAt: new Date("2026-04-08T08:00:00.000Z"),
        updatedAt: new Date("2026-04-10T09:30:00.000Z"),
      },
    ],
    recentDocuments: [
      {
        documentId: "DOC-9",
        tenantId: "tenant-a",
        tenantName: "Balt Demo",
        caseId: "CASE-001",
        caseTitle: "Despido injustificado",
        traceId: "trace.tenant-a.CASE-001",
        originalName: "contrato.pdf",
        documentType: "contract",
        visibility: "tenant",
        integrityStatus: "verified",
        classificationConfidence: 0.97,
        consentStatus: "granted",
        supersedesDocumentId: null,
        createdAt: new Date("2026-04-01T08:00:00.000Z"),
        updatedAt: new Date("2026-04-10T09:15:00.000Z"),
        supersededDocument: null,
      },
    ],
  };
}

describe("getCeoExportBlockReason", () => {
  it("bloquea la exportación cuando aún no existe snapshot ejecutivo", () => {
    expect(
      getCeoExportBlockReason({
        hasSnapshot: false,
        isRefreshing: false,
        isSnapshotStale: false,
        hasSnapshotError: false,
      }),
    ).toMatch(/snapshot ejecutivo termine de cargar/i);
  });

  it("prioriza el bloqueo por refresco por encima de otros estados no confiables", () => {
    expect(
      getCeoExportBlockReason({
        hasSnapshot: true,
        isRefreshing: true,
        isSnapshotStale: true,
        hasSnapshotError: true,
      }),
    ).toMatch(/refrescando la vista ejecutiva/i);
  });

  it("bloquea la exportación cuando la vista ejecutiva quedó stale", () => {
    expect(
      getCeoExportBlockReason({
        hasSnapshot: true,
        isRefreshing: false,
        isSnapshotStale: true,
        hasSnapshotError: false,
      }),
    ).toMatch(/datos desactualizados|actualiza el dashboard/i);
  });

  it("permite exportar cuando el snapshot está disponible y confiable", () => {
    expect(
      getCeoExportBlockReason({
        hasSnapshot: true,
        isRefreshing: false,
        isSnapshotStale: false,
        hasSnapshotError: false,
      }),
    ).toBeNull();
  });
});

describe("ceoDashboardExports", () => {
  it("arma el modelo PDF del resumen con metadatos ejecutivos y todas las tablas clave", () => {
    const exportedAt = new Date("2026-04-10T18:45:00.000Z");
    const model = buildCeoPdfModel({
      section: "resumen",
      snapshot: buildSnapshot(),
      appliedFilters: ["Tenant: Balt Demo", "Severidad: critical"],
      actorLabel: "CEO Demo",
      exportedAt,
    });

    expect(model.title).toBe("Reporte ejecutivo CEO · Resumen CEO");
    expect(model.filename).toBe(buildExpectedFilename("resumen", "pdf", exportedAt));
    expect(model.summaryRows).toEqual(
      expect.arrayContaining([
        ["Vista", "Resumen CEO"],
        ["Exportado por", "CEO Demo"],
        ["Filtros", "Tenant: Balt Demo | Severidad: critical"],
        ["Casos activos", "5"],
        ["Documentos totales", "14"],
      ]),
    );
    expect(model.tables).toHaveLength(5);
    expect(model.tables.map((table) => table.title)).toEqual([
      "Salud por tenant",
      "Casos visibles",
      "Alertas visibles",
      "Accesos visibles",
      "Documentos visibles",
    ]);
  });

  it("devuelve una vista exportable enfocada a alertas y rellena traceId ausente con placeholder seguro", () => {
    const snapshot = buildSnapshot();
    snapshot.recentAlerts = [
      {
        ...snapshot.recentAlerts[0],
        traceId: null,
      },
    ];

    const tables = buildCeoExportTables("alertas", snapshot);

    expect(tables).toHaveLength(1);
    expect(tables[0].title).toBe("Alertas visibles");
    expect(tables[0].rows[0]).toEqual([
      "Pago omitido detectado",
      "Balt Demo",
      "Despido injustificado",
      "critical",
      "open",
      "payroll",
      expect.any(String),
      "—",
    ]);
  });

  it("genera CSV con encabezados ejecutivos, tablas y mensaje de sección vacía cuando no hay registros", () => {
    const snapshot = buildSnapshot();
    snapshot.recentDocuments = [];

    const csv = buildCeoCsvReport({
      section: "documentos",
      snapshot,
      appliedFilters: [],
      actorLabel: "CEO Demo",
      exportedAt: new Date("2026-04-10T19:00:00.000Z"),
    });

    expect(csv.filename).toBe(buildExpectedFilename("documentos", "csv", new Date("2026-04-10T19:00:00.000Z")));
    expect(csv.content).toContain('"Reporte ejecutivo CEO","Reporte ejecutivo CEO · Documentos"');
    expect(csv.content).toContain('"Filtros","Sin filtros activos"');
    expect(csv.content).toContain('"Documentos visibles"');
    expect(csv.content).toContain('"Sin registros visibles para esta sección"');
  });

  it("neutraliza fórmulas CSV y normaliza saltos de línea peligrosos antes de exportar", () => {
    const snapshot = buildSnapshot();
    snapshot.recentDocuments = [
      {
        ...snapshot.recentDocuments[0],
        originalName: '=HYPERLINK("https://malicioso.test","Abrir")',
      },
    ];
    snapshot.recentAlerts = [
      {
        ...snapshot.recentAlerts[0],
        title: 'Hallazgo crítico\n=CMD()\t',
      },
    ];

    const csv = buildCeoCsvReport({
      section: "resumen",
      snapshot,
      appliedFilters: ["Estado: abierto"],
      actorLabel: "CEO Demo",
      exportedAt: new Date("2026-04-10T19:05:00.000Z"),
    });

    expect(csv.content).toContain('"\'=HYPERLINK(""https://malicioso.test"",""Abrir"")"');
    expect(csv.content).toContain('"Hallazgo crítico =CMD()"');
    expect(csv.content).not.toContain('Hallazgo crítico\n=CMD()');
    expect(csv.content).not.toContain('"=HYPERLINK');
  });

  it("recorta texto exportable excesivo para evitar celdas PDF o CSV patológicas", () => {
    const snapshot = buildSnapshot();
    const longLabel = `Hallazgo ${"X".repeat(400)}`;

    snapshot.recentAlerts = [
      {
        ...snapshot.recentAlerts[0],
        title: longLabel,
      },
    ];

    const model = buildCeoPdfModel({
      section: "alertas",
      snapshot,
      appliedFilters: [longLabel],
      actorLabel: longLabel,
      exportedAt: new Date("2026-04-10T19:10:00.000Z"),
    });
    const csv = buildCeoCsvReport({
      section: "alertas",
      snapshot,
      appliedFilters: [longLabel],
      actorLabel: longLabel,
      exportedAt: new Date("2026-04-10T19:10:00.000Z"),
    });

    expect(model.summaryRows.find(([label]) => label === "Exportado por")?.[1]).toMatch(/…$/);
    expect(model.summaryRows.find(([label]) => label === "Filtros")?.[1]).toMatch(/…$/);
    expect(model.tables[0].rows[0][0]).toMatch(/…$/);
    expect(model.tables[0].rows[0][0].length).toBeLessThanOrEqual(240);
    expect(model.tables[0].rows[0][0]).not.toContain("\n");
    expect(csv.content).toContain("…");
  });
});

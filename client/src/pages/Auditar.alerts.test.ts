import { describe, expect, it } from "vitest";
import { buildHeliosPriorityAlerts } from "./Auditar";

describe("buildHeliosPriorityAlerts", () => {
  it("incluye fecha, motivo y acción cuando existe seguimiento con atención", () => {
    const alerts = buildHeliosPriorityAlerts({
      documents: [
        {
          documentId: "DOC-001",
          originalName: "recibo_marzo.pdf",
          documentType: "payroll_receipt",
          createdAt: "2026-04-07T10:00:00.000Z",
        },
        {
          documentId: "DOC-002",
          originalName: "recibo_abril.pdf",
          documentType: "payroll_receipt",
          createdAt: "2026-04-08T10:00:00.000Z",
        },
      ],
      attentionCount: 1,
      monitoringDocuments: [
        {
          documentId: "DOC-002",
          documentName: "recibo_abril.pdf",
          status: "attention",
          dispatchedAt: "2026-04-08T12:00:00.000Z",
          respondedAt: "2026-04-08T13:15:00.000Z",
          responseEvent: "document.analysis.completed",
          message: "La respuesta tardó más de lo esperado.",
        },
      ],
      nextTarget: {
        type: "cfdi",
        label: "CFDI",
        description: "Sirven para contrastar lo timbrado fiscalmente.",
        benefit: "Aclaran diferencias entre nómina y comprobantes fiscales.",
      },
      opinion: {
        uncertainties: ["Todavía conviene confirmar el periodo exacto."],
      },
    });

    expect(alerts[0]).toMatchObject({
      id: "monitoring-attention",
      reasonLabel: "Análisis documental completado",
      actionLabel: "Documento relacionado: recibo_abril.pdf",
    });
    expect(alerts[0]?.timestampLabel).toContain("2026");
  });

  it("muestra una alerta útil de comparación cuando ya existe una pareja lista", () => {
    const alerts = buildHeliosPriorityAlerts({
      documents: [
        {
          documentId: "DOC-010",
          originalName: "contrato_inicial.pdf",
          documentType: "contract",
          createdAt: "2026-01-10T09:00:00.000Z",
        },
        {
          documentId: "DOC-011",
          originalName: "contrato_actualizado.pdf",
          documentType: "contract",
          createdAt: "2026-02-10T09:00:00.000Z",
        },
      ],
      attentionCount: 0,
      monitoringDocuments: [],
      selectedPair: [
        {
          documentId: "DOC-010",
          originalName: "contrato_inicial.pdf",
          documentType: "contract",
          createdAt: "2026-01-10T09:00:00.000Z",
        },
        {
          documentId: "DOC-011",
          originalName: "contrato_actualizado.pdf",
          documentType: "contract",
          createdAt: "2026-02-10T09:00:00.000Z",
        },
      ],
      opinion: {},
    });

    const comparisonReady = alerts.find((alert) => alert.id === "comparison-ready");

    expect(comparisonReady).toMatchObject({
      reasonLabel: "Ya existe una pareja útil de documentos dentro del expediente",
      actionLabel: "Puedes abrir la comparación lado a lado para revisar con más calma",
    });
    expect(comparisonReady?.timestampLabel).toContain("2026");
  });
});

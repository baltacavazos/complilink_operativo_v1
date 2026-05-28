import { describe, expect, it } from "vitest";
import {
  BRIDGE_CALLBACK_TIMEOUT_MS,
  buildSalaryDiscrepancySignal,
  deriveBridgeCallbackAlerts,
  extractSalarySignalFromClassificationPayload,
} from "./operationalSignals";

describe("operationalSignals", () => {
  it("extrae señales salariales desde un contrato de clasificación", () => {
    const snapshot = extractSalarySignalFromClassificationPayload({
      documentId: "DOC-CONTRACT-001",
      classification: { documentType: "contract" },
      confirmedData: {
        fileName: "contrato-hector.docx",
      },
      estimatedData: {
        contractDailySalary: "$207.44",
      },
      generatedAt: "2026-05-28T21:29:54.000Z",
    });

    expect(snapshot).toMatchObject({
      documentId: "DOC-CONTRACT-001",
      documentType: "contract",
      fileName: "contrato-hector.docx",
      contractDailySalary: 207.44,
    });
  });

  it("detecta discrepancia relevante entre salario contractual y SDI/SBC", () => {
    const discrepancy = buildSalaryDiscrepancySignal({
      snapshots: [
        {
          documentId: "DOC-CONTRACT-001",
          documentType: "contract",
          fileName: "contrato-hector.docx",
          generatedAt: "2026-05-28T21:29:54.000Z",
          contractDailySalary: 207.44,
          socialSecurityBaseSalary: null,
          integratedDailySalary: null,
        },
        {
          documentId: "DOC-CFDI-001",
          documentType: "cfdi",
          fileName: "hector-nomina.xml",
          generatedAt: "2026-05-28T21:28:54.000Z",
          contractDailySalary: null,
          socialSecurityBaseSalary: 331.45,
          integratedDailySalary: 331.45,
        },
      ],
    });

    expect(discrepancy).toMatchObject({
      comparedField: "integratedDailySalary",
      comparedValue: 331.45,
      absoluteDifference: 124.01,
    });
    expect(discrepancy?.percentageDifference).toBeGreaterThan(50);
  });

  it("no marca discrepancia cuando la diferencia es irrelevante", () => {
    const discrepancy = buildSalaryDiscrepancySignal({
      snapshots: [
        {
          documentId: "DOC-CONTRACT-001",
          documentType: "contract",
          fileName: "contrato.docx",
          generatedAt: "2026-05-28T21:29:54.000Z",
          contractDailySalary: 300,
          socialSecurityBaseSalary: null,
          integratedDailySalary: null,
        },
        {
          documentId: "DOC-CFDI-001",
          documentType: "cfdi",
          fileName: "nomina.xml",
          generatedAt: "2026-05-28T21:28:54.000Z",
          contractDailySalary: null,
          socialSecurityBaseSalary: 303,
          integratedDailySalary: null,
        },
      ],
    });

    expect(discrepancy).toBeNull();
  });

  it("deriva alerta warning mientras el callback sigue pendiente", () => {
    const now = new Date("2026-05-28T21:35:00.000Z");
    const alerts = deriveBridgeCallbackAlerts({
      tenantId: "balt-1",
      caseId: "CASE-BALT-1-001",
      traceId: "trace.balt-1.case-001",
      now,
      dispatchAuditLogs: [
        {
          id: 1,
          documentId: "DOC-001",
          createdAt: "2026-05-28T21:34:00.000Z",
          afterState: {
            status: "sent",
            httpStatus: 202,
            dispatchedAt: "2026-05-28T21:34:00.000Z",
            observabilityEnvelope: {
              dispatchId: "dispatch-001",
              correlationId: "corr-001",
            },
          },
        },
      ],
      webhookEvents: [],
    });

    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({
      severity: "warning",
      category: "upload_pending",
      title: "Callback de CompliLink pendiente",
    });
  });

  it("deriva alerta crítica cuando la ventana del callback venció", () => {
    const dispatchedAt = new Date("2026-05-28T21:20:00.000Z");
    const now = new Date(dispatchedAt.getTime() + BRIDGE_CALLBACK_TIMEOUT_MS + 60_000);
    const alerts = deriveBridgeCallbackAlerts({
      tenantId: "balt-1",
      caseId: "CASE-BALT-1-001",
      traceId: "trace.balt-1.case-001",
      now,
      dispatchAuditLogs: [
        {
          id: 1,
          documentId: "DOC-001",
          createdAt: dispatchedAt,
          afterState: {
            status: "sent",
            httpStatus: 202,
            dispatchedAt: dispatchedAt.toISOString(),
            observabilityEnvelope: {
              dispatchId: "dispatch-001",
              correlationId: "corr-001",
            },
          },
        },
      ],
      webhookEvents: [],
    });

    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({
      severity: "critical",
      title: "Callback de CompliLink fuera de ventana",
    });
  });

  it("no genera alerta derivada cuando el callback ya llegó", () => {
    const alerts = deriveBridgeCallbackAlerts({
      tenantId: "balt-1",
      caseId: "CASE-BALT-1-001",
      traceId: "trace.balt-1.case-001",
      now: new Date("2026-05-28T21:35:00.000Z"),
      dispatchAuditLogs: [
        {
          id: 1,
          documentId: "DOC-001",
          createdAt: "2026-05-28T21:30:00.000Z",
          afterState: {
            status: "sent",
            httpStatus: 202,
            dispatchedAt: "2026-05-28T21:30:00.000Z",
            observabilityEnvelope: {
              dispatchId: "dispatch-001",
              correlationId: "corr-001",
            },
          },
        },
      ],
      webhookEvents: [
        {
          id: 2,
          documentId: "DOC-001",
          correlationId: "corr-001",
          createdAt: "2026-05-28T21:31:00.000Z",
        },
      ],
    });

    expect(alerts).toHaveLength(0);
  });
});

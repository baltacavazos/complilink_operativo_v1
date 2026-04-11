import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/HeliosCopilotSheet", () => ({
  HeliosCopilotSheet: () => null,
}));

import {
  buildDossierTypeProgress,
  buildHeliosPriorityAlerts,
  buildInlineLegalConsentState,
  sanitizePersistedAuditarViewState,
  sanitizePersistedHeliosCopilotMessages,
} from "./Auditar";

describe("buildHeliosPriorityAlerts", () => {
  it("prioriza una alerta de nueva claridad cuando el último documento mejora la lectura del expediente", () => {
    const alerts = buildHeliosPriorityAlerts({
      documents: [],
      attentionCount: 0,
      monitoringDocuments: [],
      nextTarget: {
        type: "imss",
        label: "Soporte IMSS",
        description: "Ayuda a conectar altas, bajas o semanas cotizadas.",
        benefit: "Da más contexto al cruce social del expediente.",
        suggestedCount: 1,
      },
      newClarityNotification: {
        title: "Tu expediente ganó nueva claridad",
        message: "Ahora ya se distingue mejor qué soporte social conviene revisar después.",
        delta: 14,
      },
    });

    expect(alerts[0]).toMatchObject({
      id: "new-clarity",
      title: "Tu expediente ganó nueva claridad",
      reasonLabel: "Ganaste 14 puntos de claridad",
      actionLabel: "Puede ayudarte seguir con soporte imss",
    });
  });

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
        suggestedCount: 2,
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

describe("sanitizePersistedAuditarViewState", () => {
  it("conserva solo valores válidos y acota el paso móvil dentro del rango permitido", () => {
    expect(
      sanitizePersistedAuditarViewState({
        historyFilter: "response",
        mobileOnboardingIndex: 99,
        selectedRecommendedTargetType: "contract",
      }),
    ).toEqual({
      historyFilter: "response",
      mobileOnboardingIndex: 2,
      selectedRecommendedTargetType: "contract",
    });
  });

  it("descarta filtros o tipos documentales inválidos sin romper el estado", () => {
    expect(
      sanitizePersistedAuditarViewState({
        historyFilter: "invalid",
        mobileOnboardingIndex: -4,
        selectedRecommendedTargetType: "unknown",
      }),
    ).toEqual({
      historyFilter: undefined,
      mobileOnboardingIndex: 0,
      selectedRecommendedTargetType: undefined,
    });
  });
});

describe("sanitizePersistedHeliosCopilotMessages", () => {
  it("conserva solo mensajes válidos del copiloto y limita el historial persistido", () => {
    expect(
      sanitizePersistedHeliosCopilotMessages([
        { role: "assistant", content: "  Primera lectura útil.  " },
        { role: "user", content: "¿Qué riesgo ves?" },
        { role: "system", content: "ignorar" },
        { role: "assistant", content: "" },
        { role: "assistant", content: "Segunda respuesta" },
        { role: "user", content: "Tercera pregunta" },
        { role: "assistant", content: "Cuarta respuesta" },
        { role: "user", content: "Quinta pregunta" },
        { role: "assistant", content: "Sexta respuesta" },
        { role: "user", content: "Séptima pregunta" },
      ]),
    ).toEqual([
      { role: "assistant", content: "Segunda respuesta" },
      { role: "user", content: "Tercera pregunta" },
      { role: "assistant", content: "Cuarta respuesta" },
      { role: "user", content: "Quinta pregunta" },
      { role: "assistant", content: "Sexta respuesta" },
      { role: "user", content: "Séptima pregunta" },
    ]);
  });

  it("devuelve arreglo vacío cuando la persistencia no tiene el formato esperado", () => {
    expect(sanitizePersistedHeliosCopilotMessages({ invalid: true })).toEqual([]);
    expect(sanitizePersistedHeliosCopilotMessages(null)).toEqual([]);
  });
});

describe("buildDossierTypeProgress", () => {
  it("calcula el avance por tipo respetando el objetivo sugerido de cada documento", () => {
    const progress = buildDossierTypeProgress({
      payroll_receipt: 1,
      cfdi: 3,
      contract: 1,
    });

    expect(progress.find((item) => item.type === "payroll_receipt")).toMatchObject({
      percent: 50,
      coverageLabel: "En progreso",
      count: 1,
      targetCount: 2,
    });
    expect(progress.find((item) => item.type === "cfdi")).toMatchObject({
      percent: 100,
      coverageLabel: "Cubierto",
      count: 3,
      targetCount: 2,
    });
    expect(progress.find((item) => item.type === "evidence")).toMatchObject({
      percent: 0,
      coverageLabel: "Pendiente",
      count: 0,
      targetCount: 1,
    });
  });
});

describe("buildInlineLegalConsentState", () => {
  it("activa el consentimiento inline y renombra el CTA cuando hay un archivo seleccionado con gate legal pendiente", () => {
    expect(
      buildInlineLegalConsentState({
        legalGateRequired: true,
        pendingDraft: false,
        hasSelectedFile: true,
        activeCaptureMode: "file",
        manualOverrideCount: 0,
      }),
    ).toEqual({
      shouldShowInlineLegalConsent: true,
      confirmPrimaryActionLabel: "Aceptar y guardar documento",
      uploadPrimaryActionLabel: "Aceptar y analizar documento",
    });
  });

  it("mantiene el consentimiento inline para borradores pendientes y adapta el CTA cuando existen ajustes manuales", () => {
    expect(
      buildInlineLegalConsentState({
        legalGateRequired: true,
        pendingDraft: true,
        hasSelectedFile: false,
        activeCaptureMode: "camera",
        manualOverrideCount: 2,
      }),
    ).toEqual({
      shouldShowInlineLegalConsent: true,
      confirmPrimaryActionLabel: "Aceptar y guardar con ajustes",
      uploadPrimaryActionLabel: "Tomar foto para continuar",
    });
  });

  it("desactiva el consentimiento inline y conserva los CTA originales cuando el gate legal ya está resuelto", () => {
    expect(
      buildInlineLegalConsentState({
        legalGateRequired: false,
        pendingDraft: false,
        hasSelectedFile: true,
        activeCaptureMode: "file",
        manualOverrideCount: 1,
      }),
    ).toEqual({
      shouldShowInlineLegalConsent: false,
      confirmPrimaryActionLabel: "Guardar y aplicar ajustes",
      uploadPrimaryActionLabel: "Analizar antes de guardar",
    });
  });
});

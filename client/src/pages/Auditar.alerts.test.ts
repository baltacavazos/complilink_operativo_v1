import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/HeliosCopilotSheet", () => ({
  HeliosCopilotSheet: () => null,
}));

import { readFileSync } from "node:fs";

import {
  buildAuditarTimelineEntryState,
  buildDossierTypeProgress,
  buildHeliosPriorityAlerts,
  buildInlineLegalConsentState,
  buildReanalyzeDraftActionState,
  buildUploadProgressState,
  formatVisibleFileSize,
  getUploadCompactGuardrails,
  getUploadHelpDisclosureSummary,
  getUploadHelpMobileHint,
  getAuditarViewportSegment,
  getUploadStepAnnouncement,
  getUploadStepAriaLabel,
  sanitizePersistedAuditarViewState,
  sanitizePersistedHeliosCopilotMessages,
  shouldAutoAnalyzeSelectedFile,
  validateDocumentUploadFile,
} from "./Auditar";

const auditarSource = readFileSync(new URL("./Auditar.tsx", import.meta.url), "utf8");

describe("compact mobile upload entry", () => {
  it("mantiene dominante la acción principal de subida en el primer flujo móvil", () => {
    expect(auditarSource).toContain("shouldCompactMobileUploadEntry");
    expect(auditarSource).toContain(
      '"bg-teal-600 shadow-[0_18px_34px_-22px_rgba(13,148,136,0.58)] hover:bg-teal-700"',
    );
    expect(auditarSource).toContain('"bg-slate-900 hover:bg-slate-950"');
    expect(auditarSource).toContain('"Toma foto para empezar"');
    expect(auditarSource).toContain('"Elige archivo para empezar"');
  });
});

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

describe("formatVisibleFileSize", () => {
  it("muestra archivos pequeños en KB y archivos grandes en MB con un decimal", () => {
    expect(formatVisibleFileSize(860)).toBe("1 KB");
    expect(formatVisibleFileSize(2.4 * 1024 * 1024)).toBe("2.4 MB");
  });
});

describe("validateDocumentUploadFile", () => {
  it("acepta PDFs e imágenes dentro del límite preventivo", () => {
    const pdf = new File(["hola"], "contrato.pdf", { type: "application/pdf" });
    expect(validateDocumentUploadFile(pdf)).toBeNull();
  });

  it("rechaza formatos no compatibles y archivos que exceden 15 MB", () => {
    const unsupported = new File(["hola"], "contrato.exe", { type: "application/octet-stream" });
    expect(validateDocumentUploadFile(unsupported)).toContain("no es compatible");

    const largePdf = new File([new Uint8Array(16 * 1024 * 1024)], "pesado.pdf", { type: "application/pdf" });
    expect(validateDocumentUploadFile(largePdf)).toContain("supera el límite preventivo de 15 MB");
  });
});

describe("getUploadStepAriaLabel", () => {
  it("explica para lectores de pantalla la posición y estado actual de cada etapa", () => {
    expect(
      getUploadStepAriaLabel({
        index: 2,
        total: 4,
        label: "Analizar",
        isActive: true,
        isComplete: false,
      }),
    ).toBe("Etapa 2 de 4: Analizar, actual.");

    expect(
      getUploadStepAriaLabel({
        index: 1,
        total: 4,
        label: "Preparar",
        isActive: false,
        isComplete: true,
      }),
    ).toBe("Etapa 1 de 4: Preparar, completada.");
  });
});

describe("getUploadCompactGuardrails", () => {
  it("mantiene visibles versiones compactas de límites y privacidad para móvil", () => {
    expect(getUploadCompactGuardrails()).toEqual({
      fileRules: "PDF, XML o imagen clara · máximo 15 MB.",
      privacyRules: "Nada se integra al expediente hasta que revisas y confirmas.",
    });
  });
});

describe("getUploadHelpDisclosureSummary", () => {
  it("hace evidente que la ayuda colapsable muestra seguridad, límites y momento de guardado", () => {
    expect(getUploadHelpDisclosureSummary()).toBe(
      "Abrir ayuda rápida: seguridad, límites y momento de guardado",
    );
  });
});

describe("getUploadHelpMobileHint", () => {
  it("mantiene una pista breve y visible para móvil dentro de la ayuda colapsable", () => {
    expect(getUploadHelpMobileHint()).toBe(
      "Ayuda rápida: toca para ver seguridad, límites y guardado.",
    );
  });
});

describe("getUploadStepAnnouncement", () => {
  it("genera un anuncio corto y claro para lectores de pantalla cuando cambia la etapa", () => {
    expect(
      getUploadStepAnnouncement(
        "Etapa 2 de 4 · Analizando documento",
        "Estamos leyendo tu archivo y preparando el borrador",
      ),
    ).toBe(
      "Progreso actual: Etapa 2 de 4 · Analizando documento. Estamos leyendo tu archivo y preparando el borrador.",
    );
  });

  it("mantiene el formato breve original cuando no recibe contexto adicional", () => {
    expect(getUploadStepAnnouncement("Etapa 3 de 4 · Listo para revisar")).toBe(
      "Progreso actual: Etapa 3 de 4 · Listo para revisar.",
    );
  });
});

describe("getAuditarViewportSegment", () => {
  it("segmenta el viewport entre móvil, tablet y escritorio para los eventos del funnel", () => {
    expect(getAuditarViewportSegment(390)).toBe("mobile");
    expect(getAuditarViewportSegment(768)).toBe("tablet");
    expect(getAuditarViewportSegment(1280)).toBe("desktop");
  });
});

describe("buildUploadProgressState", () => {
  it("prioriza el guardado final sobre otros estados y comunica control al usuario", () => {
    expect(
      buildUploadProgressState({
        selectedFile: new File(["hola"], "recibo.pdf", { type: "application/pdf" }),
        pendingDraft: true,
        isAnalyzingDraft: true,
        isConfirmingDraft: true,
      }),
    ).toMatchObject({
      eyebrow: "Guardado en curso",
      progress: 92,
      stageLabel: "Etapa 3 de 4 · Guardando con control",
      etaLabel: "Tiempo estimado: menos de 10 segundos para integrar y cerrar esta etapa.",
      stepKey: "save",
    });
  });

  it("muestra el estado preventivo inicial y el salto a archivo listo cuando ya existe una selección válida", () => {
    expect(
      buildUploadProgressState({
        selectedFile: null,
        pendingDraft: false,
        isAnalyzingDraft: false,
        isConfirmingDraft: false,
      }),
    ).toMatchObject({
      eyebrow: "Control del documento",
      progress: 12,
      stageLabel: "Etapa 1 de 4 · Preparación segura",
      stepKey: "prepare",
    });

    expect(
      buildUploadProgressState({
        selectedFile: new File(["hola"], "evidencia.jpg", { type: "image/jpeg" }),
        pendingDraft: false,
        isAnalyzingDraft: false,
        isConfirmingDraft: false,
      }),
    ).toMatchObject({
      eyebrow: "Archivo listo",
      progress: 38,
      etaLabel: "Tiempo estimado al iniciar: normalmente menos de 1 minuto hasta la vista previa.",
      stepKey: "prepare",
    });
  });

  it("comunica la etapa de análisis y el paso final de revisión cuando el borrador ya está listo", () => {
    expect(
      buildUploadProgressState({
        selectedFile: new File(["hola"], "evidencia.jpg", { type: "image/jpeg" }),
        pendingDraft: false,
        isAnalyzingDraft: true,
        isConfirmingDraft: false,
      }),
    ).toMatchObject({
      eyebrow: "Análisis en curso",
      progress: 72,
      stageLabel: "Etapa 2 de 4 · Analizando contenido",
      stepKey: "analyze",
    });

    expect(
      buildUploadProgressState({
        selectedFile: new File(["hola"], "evidencia.jpg", { type: "image/jpeg" }),
        pendingDraft: true,
        isAnalyzingDraft: false,
        isConfirmingDraft: false,
      }),
    ).toMatchObject({
      eyebrow: "Vista previa lista",
      progress: 100,
      stageLabel: "Etapa 4 de 4 · Vista previa lista",
      etaLabel: "Siguiente acción: revisar y confirmar solo si quieres guardarlo.",
      stepKey: "review",
    });
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

describe("shouldAutoAnalyzeSelectedFile", () => {
  it("permite el autoanálisis solo cuando existe archivo, expediente listo y el gate legal ya no bloquea", () => {
    expect(
      shouldAutoAnalyzeSelectedFile({
        autoAnalyzeRequested: true,
        hasSelectedFile: true,
        pendingDraft: false,
        legalGateRequired: false,
        hasSelectedTenant: true,
        hasSelectedCase: true,
        analyzePending: false,
        confirmPending: false,
      }),
    ).toBe(true);
  });

  it("bloquea el autoanálisis si el documento sigue sujeto a aceptación legal o ya existe un borrador pendiente", () => {
    expect(
      shouldAutoAnalyzeSelectedFile({
        autoAnalyzeRequested: true,
        hasSelectedFile: true,
        pendingDraft: false,
        legalGateRequired: true,
        hasSelectedTenant: true,
        hasSelectedCase: true,
        analyzePending: false,
        confirmPending: false,
      }),
    ).toBe(false);

    expect(
      shouldAutoAnalyzeSelectedFile({
        autoAnalyzeRequested: true,
        hasSelectedFile: true,
        pendingDraft: true,
        legalGateRequired: false,
        hasSelectedTenant: true,
        hasSelectedCase: true,
        analyzePending: false,
        confirmPending: false,
      }),
    ).toBe(false);
  });
});

describe("buildAuditarTimelineEntryState", () => {
  it("marca los documentos confirmados como parte estable del expediente", () => {
    expect(buildAuditarTimelineEntryState("confirmed")).toEqual({
      label: "Documento confirmado",
      badgeClasses: "border border-emerald-200 bg-emerald-100 text-emerald-800",
      cardClasses: "border-slate-200 bg-slate-50",
      roleCardClasses: "border-teal-100 bg-teal-50",
      supportingCopy: "Este documento ya quedó confirmado dentro del expediente y sirve como base para el contraste posterior.",
    });
  });

  it("destaca los borradores como lectura temporal pendiente de confirmación", () => {
    expect(buildAuditarTimelineEntryState("draft")).toEqual({
      label: "Borrador analizado",
      badgeClasses: "border border-amber-200 bg-amber-100 text-amber-900",
      cardClasses: "border-amber-200 border-dashed bg-amber-50/70",
      roleCardClasses: "border-amber-200 bg-white",
      supportingCopy: "Aún no forma parte del expediente: confirma o ajusta este borrador antes de integrarlo.",
    });
  });
});

describe("buildReanalyzeDraftActionState", () => {
  it("expone el CTA de Reanalizar cuando existe un borrador activo", () => {
    expect(buildReanalyzeDraftActionState({ pendingDraft: true, hasManualOverrides: false })).toEqual({
      shouldShow: true,
      label: "Reanalizar",
      supportingCopy: "Empezarás una nueva lectura desde cero sin tocar lo que ya confirmaste dentro del expediente.",
    });
  });

  it("advierte que los ajustes manuales no se arrastran al reanalizar", () => {
    expect(buildReanalyzeDraftActionState({ pendingDraft: true, hasManualOverrides: true })).toEqual({
      shouldShow: true,
      label: "Reanalizar",
      supportingCopy:
        "Empezarás una nueva lectura desde cero. Los ajustes de este borrador no se arrastran y los documentos ya confirmados no cambian.",
    });
  });

  it("oculta el CTA cuando no hay un borrador activo", () => {
    expect(buildReanalyzeDraftActionState({ pendingDraft: false, hasManualOverrides: false })).toEqual({
      shouldShow: false,
      label: "",
      supportingCopy: "",
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

  it("sugiere elegir archivo para continuar cuando el flujo mobile-first abre directo el picker preferido sin documento previo", () => {
    expect(
      buildInlineLegalConsentState({
        legalGateRequired: false,
        pendingDraft: false,
        hasSelectedFile: false,
        activeCaptureMode: "file",
        manualOverrideCount: 0,
      }),
    ).toEqual({
      shouldShowInlineLegalConsent: false,
      confirmPrimaryActionLabel: "Confirmar y guardar documento",
      uploadPrimaryActionLabel: "Elegir archivo para continuar",
    });
  });
});

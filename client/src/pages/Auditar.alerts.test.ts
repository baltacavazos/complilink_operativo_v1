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
  getContextualDossierNextTarget,
  getHumanUploadProgressMessages,
  getPrimaryContextualShortcut,
  getUploadCompactGuardrails,
  getUploadHelpDisclosureSummary,
  getUploadHelpMobileHint,
  getAuditarViewportSegment,
  getUploadStepAnnouncement,
  getUploadStepAriaLabel,
  sanitizePersistedAuditarViewState,
  sanitizePersistedHeliosCopilotMessages,
  sanitizePreviewText,
  sanitizeStructuredExtractionView,
  shouldAutoAnalyzeSelectedFile,
  validateDocumentUploadFile,
} from "./Auditar";

const auditarSource = readFileSync(new URL("./Auditar.tsx", import.meta.url), "utf8");
const routersSource = readFileSync(new URL("../../../server/routers.ts", import.meta.url), "utf8");

describe("compact mobile upload entry", () => {
  it("mantiene dominante la acción principal de subida en el primer flujo móvil", () => {
    expect(auditarSource).toContain("shouldCompactMobileUploadEntry");
    expect(auditarSource).toContain(
      '"bg-teal-600 shadow-[0_18px_34px_-22px_rgba(13,148,136,0.58)] hover:bg-teal-700"',
    );
    expect(auditarSource).toContain('"bg-slate-900 shadow-[0_18px_34px_-24px_rgba(15,23,42,0.42)] hover:bg-slate-950"');
    expect(auditarSource).toContain('"Toma foto para empezar"');
    expect(auditarSource).toContain('"Elige archivo para empezar"');
  });

  it("bloquea temporalmente los controles y explica el análisis automático en móvil", () => {
    expect(auditarSource).toContain("isAutoAnalyzingSelectedFile");
    expect(auditarSource).toContain('"Analizando documento..."');
    expect(auditarSource).toContain("Estamos analizando tu documento");
    expect(auditarSource).toContain("Ya recibimos tu documento. Enseguida abriremos la vista");
    expect(auditarSource).toContain("disabled={isAutoAnalyzingSelectedFile}");
  });

  it("inyecta progreso humano y tracking discreto del veredicto móvil en la cuarta ronda", () => {
    expect(auditarSource).toContain("Leyendo los detalles...");
    expect(auditarSource).toContain("Buscando señales importantes...");
    expect(auditarSource).toContain("Preparando tu veredicto...");
    expect(auditarSource).toContain("auditar_mobile_verdict_viewed");
    expect(auditarSource).toContain("auditar_mobile_verdict_cta_clicked");
    expect(auditarSource).toContain('data-testid="auditar-verdict-panel"');
  });

  it("equilibra el primer viewport con CTA consistente y salida secundaria discreta", () => {
    expect(auditarSource).toContain('"flex min-h-[42vh] w-full flex-col items-center justify-center space-y-2 rounded-[2.2rem] bg-slate-50 px-2 py-3"');
    expect(auditarSource).toContain('"text-[3.1rem] leading-[0.87]"');
    expect(auditarSource).toContain('"w-full max-w-none self-center rounded-[2.1rem] border border-emerald-200/90 bg-[linear-gradient(135deg,_rgba(250,254,251,0.998),_rgba(255,255,255,1))] px-7 py-8 shadow-[0_10px_28px_-22px_rgba(16,185,129,0.18)] sm:rounded-[2.2rem] sm:px-10 sm:py-9"');
    expect(auditarSource).toContain('"flex items-center gap-4 sm:mt-3"');
    expect(auditarSource).toContain('"h-10 w-10 shrink-0 text-emerald-700"');
    expect(auditarSource).toContain('"mt-1 text-center text-[1.62rem] font-semibold leading-snug text-slate-800"');
    expect(auditarSource).toContain('Ya está en tu expediente.');
    expect(auditarSource).toContain('"mx-auto flex h-auto min-h-[6.6rem] w-full max-w-[24rem] items-center justify-center gap-3 rounded-[1.8rem] border-2 border-emerald-700 bg-emerald-700 px-7 py-5 text-center text-[1.92rem] leading-tight tracking-[-0.03em] shadow-[0_26px_60px_-24px_rgba(5,150,105,0.52)] hover:bg-emerald-600"');
    expect(auditarSource).toContain('"Comparar nómina y CFDI"');
    expect(auditarSource).toContain('"inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium text-slate-500 transition hover:text-slate-700"');
    expect(auditarSource).toContain('scrollToDigitalArchive("result_panel")');
    expect(auditarSource).toContain('Ir a mi expediente');
  });
});

describe("single-case blocking alert", () => {
  it("mantiene visible el patrón de alerta y el copy orientado a solución cuando un documento parece pertenecer a otra persona", () => {
    expect(auditarSource).toContain("No fue posible preparar tu espacio de revisión.");
    expect(auditarSource).toContain("{bootstrapMutation.error.message}");
    expect(routersSource).toContain("Este expediente digital está vinculado a una sola persona.");
    expect(routersSource).toContain("parece pertenecer a alguien distinto al expediente actual.");
    expect(routersSource).toContain("entra con la cuenta correcta");
  });
});

describe("digital archive access", () => {
  it("hace visible el archivo digital desde el resultado principal y permite saltar al expediente", () => {
    expect(auditarSource).toContain("Mi archivo digital");
    expect(auditarSource).toContain(
      "Tu expediente ya quedó guardado y lo puedes abrir cuando quieras",
    );
    expect(auditarSource).toContain('id="mi-archivo-digital"');
    expect(auditarSource).toContain("Ver todo mi archivo");
    expect(auditarSource).toContain(
      "Ver resumen del expediente y documentos sugeridos",
    );
    expect(auditarSource).toContain("shouldCompactPostUploadExperience ? \"hidden rounded-[1.25rem]");
    expect(auditarSource).toContain("Tu expediente ya quedó guardado y lo puedes abrir cuando quieras.");
  });

  it("añade apertura segura del documento y CTA clara por tarjeta", () => {
    expect(auditarSource).toContain("utils.documents.access.fetch");
    expect(auditarSource).toContain("auditar_digital_archive_document_opened");
    expect(auditarSource).toContain("Aquí están tus documentos guardados");
    expect(auditarSource).toContain('"Ver documento"');
  });
});

describe("digital archive round 8", () => {
  it("añade tipología visual y extensión visible en cada tarjeta del expediente", () => {
    expect(auditarSource).toContain("getArchiveDocumentVisual");
    expect(auditarSource).toContain("getArchiveFileExtensionLabel");
    expect(auditarSource).toContain("documentTypeLabel");
    expect(auditarSource).toContain("fileExtensionLabel");
  });

  it("incorpora filtros simples por tipo y fecha dentro del archivo digital", () => {
    expect(auditarSource).toContain("Filtrar por tipo o fecha");
    expect(auditarSource).toContain("Cualquier fecha");
    expect(auditarSource).toContain("Últimos 30 días");
    expect(auditarSource).toContain("No encontramos documentos con este filtro");
  });

  it("expone un retorno móvil fijo al expediente cuando ya hay documentos", () => {
    expect(auditarSource).toContain('data-testid="auditar-mobile-archive-return"');
    expect(auditarSource).toContain("Volver al expediente filtrado");
    expect(auditarSource).toContain("Volver al expediente");
  });
});

describe("getContextualDossierNextTarget", () => {
  it("prioriza CFDI cuando ya existe nómina en el expediente", () => {
    expect(getContextualDossierNextTarget(new Set(["payroll_receipt"]))?.type).toBe("cfdi");
  });

  it("prioriza nómina cuando ya existe un soporte IMSS", () => {
    expect(getContextualDossierNextTarget(new Set(["imss"]))?.type).toBe("payroll_receipt");
  });

  it("prioriza evidencia relacionada cuando ya existe contrato", () => {
    expect(getContextualDossierNextTarget(new Set(["contract"]))?.type).toBe("evidence");
  });
});

describe("next document recommendation copy", () => {
  it("muestra copy contextual para contrastar nómina con CFDI y una CTA más directa", () => {
    expect(auditarSource).toContain('headline: "Sigue con tu CFDI para contrastar lo que ya ves en nómina"');
    expect(auditarSource).toContain('cta: "Subir mi CFDI ahora"');
    expect(auditarSource).toContain('Sugerencia automática según tu expediente');
    expect(auditarSource).toContain('El siguiente paso que más puede ayudarte hoy');
  });

  it("reemplaza el fallback pasivo por uno más proactivo cuando no hay nextTarget específico", () => {
    expect(auditarSource).toContain('headline: "Tu expediente puede ganar más claridad"');
    expect(auditarSource).toContain('cta: "Subir otro documento y seguir"');
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

  it("rechaza formatos no compatibles, HEIC y archivos que exceden 12 MB", () => {
    const unsupported = new File(["hola"], "contrato.exe", { type: "application/octet-stream" });
    expect(validateDocumentUploadFile(unsupported)).toContain("no es compatible");

    const heic = new File(["hola"], "foto.heic", { type: "image/heic" });
    expect(validateDocumentUploadFile(heic)).toContain("HEIC o HEIF");

    const largePdf = new File([new Uint8Array(13 * 1024 * 1024)], "pesado.pdf", { type: "application/pdf" });
    expect(validateDocumentUploadFile(largePdf)).toContain("rebasa el límite real de 12 MB");
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
      fileRules: "PDF, XML, JPG, PNG o WEBP · máximo 12 MB.",
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
      etaLabel: "Casi listo: normalmente menos de 10 segundos para integrarlo con seguridad.",
      stepKey: "save",
      humanMessages: [
        "Protegiendo tu documento...",
        "Integrándolo al expediente...",
        "Dejando listo el resultado...",
      ],
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
      etaLabel: "En cuanto eliges el archivo, el borrador suele quedar listo en menos de 1 minuto.",
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
      humanMessages: [
        "Leyendo los detalles...",
        "Buscando señales importantes...",
        "Preparando tu veredicto...",
      ],
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
      etaLabel: "Siguiente acción: revisar lo importante y confirmar solo si quieres guardarlo.",
      stepKey: "review",
    });
  });
});

describe("getHumanUploadProgressMessages", () => {
  it("devuelve mensajes breves y humanos para análisis y guardado sin alargar la pantalla", () => {
    expect(getHumanUploadProgressMessages("analyze")).toEqual([
      "Leyendo los detalles...",
      "Buscando señales importantes...",
      "Preparando tu veredicto...",
    ]);
    expect(getHumanUploadProgressMessages("save")).toEqual([
      "Protegiendo tu documento...",
      "Integrándolo al expediente...",
      "Dejando listo el resultado...",
    ]);
    expect(getHumanUploadProgressMessages("review")).toEqual([]);
  });
});

describe("getPrimaryContextualShortcut", () => {
  it("prioriza una acción de comprensión para contrato, IMSS y evidencia, y una de contraste para nómina y CFDI", () => {
    expect(
      getPrimaryContextualShortcut("contract", [
        {
          id: "contract-upload-annex",
          label: "Subir anexo o condiciones relacionadas",
          description: "Sirve para completar lo pactado al inicio o en cambios posteriores.",
          action: "upload",
          targetType: "contract",
        },
        {
          id: "contract-ask-clauses",
          label: "Resumir cláusulas importantes",
          description: "Helios te señala lo que vale la pena contrastar después con nómina o CFDI.",
          action: "assistant",
          prompt: "Resume las cláusulas o condiciones más importantes de este contrato y qué conviene comparar después.",
        },
      ])?.id,
    ).toBe("contract-ask-clauses");

    expect(
      getPrimaryContextualShortcut("payroll_receipt", [
        {
          id: "payroll-upload-cfdi",
          label: "Subir CFDI del mismo periodo",
          description: "Sirve para contrastar lo timbrado contra la nómina que acabas de revisar.",
          action: "upload",
          targetType: "cfdi",
        },
        {
          id: "payroll-ask-deductions",
          label: "Explicar deducciones clave",
          description: "Helios te resume descuentos, pagos y señales llamativas en palabras simples.",
          action: "assistant",
          prompt: "Explícame las deducciones, pagos y señales más importantes que ves en esta nómina con palabras simples.",
        },
      ])?.id,
    ).toBe("payroll-upload-cfdi");
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


describe("preview sanitization", () => {
  it("reemplaza blobs técnicos por un fallback corto y legible", () => {
    const technicalBlob = "TRPCClientError: Failed query at http://localhost:3000 node_modules react-dom jsx-runtime function App(){ return null; }";

    expect(
      sanitizePreviewText(technicalBlob, {
        technicalFallback: "Contenido técnico omitido para mantener la lectura clara.",
      }),
    ).toBe("Contenido técnico omitido para mantener la lectura clara.");
  });

  it("recorta textos largos pero mantiene visibles los resúmenes normales", () => {
    const longNarrative =
      "Este resumen mantiene lenguaje humano y claro para la persona usuaria, pero necesita recortarse en móvil para no desbordar la tarjeta de revisión antes de guardar el documento dentro del expediente laboral.";

    expect(
      sanitizePreviewText(longNarrative, {
        maxLength: 80,
        technicalFallback: "no-aplica",
      }),
    ).toBe("Este resumen mantiene lenguaje humano y claro para la persona usuaria, pero nec…");
  });

  it("sanea la structuredExtraction para que el preview no imprima dumps visibles", () => {
    expect(
      sanitizeStructuredExtractionView({
        headline: "Resumen detectado",
        summary: "TRPCClientError: Failed query at http://localhost:3000 node_modules react-dom jsx-runtime function App(){ return null; }",
        fields: [
          {
            key: "workerName",
            label: "Nombre visible",
            value: "TRPCClientError: Failed query at http://localhost:3000 node_modules react-dom jsx-runtime function App(){ return null; }",
            status: "confirmed",
            confidence: "high",
          },
        ],
        missingFields: ["Periodo"],
        reviewNotes: ["function brokenPreview(){ return 'blob'; }"],
      }),
    ).toEqual({
      headline: "Resumen detectado",
      summary: "La lectura previa quedó demasiado técnica o extensa. Conviene repetir la captura o revisar el archivo original.",
      fields: [
        {
          key: "workerName",
          label: "Nombre visible",
          value: "Contenido técnico omitido para mantener la vista previa clara.",
          status: "confirmed",
          confidence: "high",
        },
      ],
      missingFields: ["Periodo"],
      reviewNotes: ["Se ocultó una nota técnica para mantener esta revisión clara."],
    });
  });
});

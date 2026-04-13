import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { AuditaPatronLogo, AuditaPatronLogoIcon, AuditaPatronLogoWordmark } from "@/components/AuditaPatronLogo";
import { HeliosCopilotSheet, type HeliosCopilotMessage } from "@/components/HeliosCopilotSheet";
import { trpc } from "@/lib/trpc";
import { trackFunnelStep } from "@/lib/analytics";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Camera,
  CheckCircle2,
  FileSearch,
  FileUp,
  FolderOpen,
  Lock,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { LEGAL_CONTACT_EMAIL, LEGAL_DOCUMENTS, LEGAL_GATE_COPY, LEGAL_VERSION, PRIVACY_CENTER_COPY } from "@shared/legal";

type LegalGateErrorType = "validation" | "concurrency" | "transient" | "fatal";

type LegalGateErrorState = {
  message: string;
  type: LegalGateErrorType;
  retryCount: number;
  retryAfterSeconds: number;
  retryAvailableAt: number | null;
};

type LegalGateMetricEvent = "idle" | "attempt" | "retry" | "conflict" | "accepted" | "transient" | "fatal";

type LegalGateMetricsState = {
  attempts: number;
  retries: number;
  conflicts: number;
  lastEvent: LegalGateMetricEvent;
  lastUpdatedAt: number | null;
};

const MAX_LEGAL_GATE_RETRIES = 3;
const LEGAL_GATE_CONCURRENCY_RETRY_SECONDS = 4;
const LEGAL_GATE_TRANSIENT_RETRY_SECONDS = 6;
const INITIAL_LEGAL_GATE_METRICS: LegalGateMetricsState = {
  attempts: 0,
  retries: 0,
  conflicts: 0,
  lastEvent: "idle",
  lastUpdatedAt: null,
};
const MAX_DOCUMENT_UPLOAD_SIZE_BYTES = 15 * 1024 * 1024;
const SUPPORTED_DOCUMENT_UPLOAD_EXTENSIONS = [".pdf", ".xml", ".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"] as const;

export function formatVisibleFileSize(bytes: number) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function validateDocumentUploadFile(file: File | null) {
  if (!file) {
    return null;
  }

  const lowerName = file.name.toLowerCase();
  const isSupportedByMime =
    file.type.startsWith("image/") ||
    file.type === "application/pdf" ||
    file.type === "text/xml" ||
    file.type === "application/xml";
  const isSupportedByExtension = SUPPORTED_DOCUMENT_UPLOAD_EXTENSIONS.some((extension) => lowerName.endsWith(extension));

  if (!isSupportedByMime && !isSupportedByExtension) {
    return "Este archivo no es compatible todavía. Sube PDF, XML o una imagen clara del documento para continuar.";
  }

  if (file.size > MAX_DOCUMENT_UPLOAD_SIZE_BYTES) {
    return `El archivo pesa ${formatVisibleFileSize(file.size)} y supera el límite preventivo de 15 MB. Comprime la imagen o exporta el PDF en tamaño más ligero antes de subirlo.`;
  }

  return null;
}

export function buildUploadProgressState(params: {
  selectedFile: File | null;
  pendingDraft: boolean;
  isAnalyzingDraft: boolean;
  isConfirmingDraft: boolean;
}) {
  const { selectedFile, pendingDraft, isAnalyzingDraft, isConfirmingDraft } = params;

  if (isConfirmingDraft) {
    return {
      eyebrow: "Guardado en curso",
      title: "Estamos integrando tu documento al expediente",
      description: "No necesitas repetir la carga. En cuanto termine, verás el resultado y el siguiente paso sugerido.",
      progress: 92,
      toneClasses: "border-teal-200 bg-teal-50 text-teal-950",
      barClasses: "bg-teal-600",
    };
  }

  if (pendingDraft) {
    return {
      eyebrow: "Vista previa lista",
      title: "Tu documento ya quedó listo para revisión",
      description: "Todavía no se guarda en el expediente: primero revisas lo leído y después confirmas si quieres integrarlo.",
      progress: 100,
      toneClasses: "border-sky-200 bg-sky-50 text-sky-950",
      barClasses: "bg-sky-600",
    };
  }

  if (isAnalyzingDraft) {
    return {
      eyebrow: "Análisis en curso",
      title: "Estamos leyendo tu archivo y preparando el borrador",
      description: "Quédate en esta pantalla. En cuanto termine, abriremos la revisión rápida automáticamente para que mantengas el control.",
      progress: 72,
      toneClasses: "border-amber-200 bg-amber-50 text-amber-950",
      barClasses: "bg-amber-500",
    };
  }

  if (selectedFile) {
    return {
      eyebrow: "Archivo listo",
      title: "Documento preparado para borrador automático",
      description: "La revisión preliminar empieza sola en cuanto termina la carga, para que llegues a la vista previa sin un paso manual adicional antes del guardado final.",
      progress: 38,
      toneClasses: "border-emerald-200 bg-emerald-50 text-emerald-950",
      barClasses: "bg-emerald-500",
    };
  }

  return {
    eyebrow: "Control del documento",
    title: "Elige un PDF, XML o una imagen clara para empezar",
    description: "Primero preparas el borrador, luego revisas la lectura y sólo al final decides si quieres guardar el documento en tu expediente.",
    progress: 12,
    toneClasses: "border-slate-200 bg-slate-50 text-slate-950",
    barClasses: "bg-slate-400",
  };
}

function buildLegalGateErrorState(
  message: string,
  type: LegalGateErrorType,
  retryCount = 0,
  retryAfterSeconds = 0,
): LegalGateErrorState {
  return {
    message,
    type,
    retryCount,
    retryAfterSeconds,
    retryAvailableAt: retryAfterSeconds > 0 ? Date.now() + retryAfterSeconds * 1000 : null,
  };
}

function extractLegalGateCauseType(value: unknown) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const causeType = (value as { type?: unknown }).type;
  return typeof causeType === "string" ? causeType : null;
}

function resolveLegalGateError(error: unknown, retryCount = 0): LegalGateErrorState {
  const fallbackMessage = "No fue posible registrar tu aceptación legal en este momento.";
  const errorRecord = error as {
    message?: string;
    data?: {
      code?: string;
      cause?: unknown;
    };
    shape?: {
      data?: {
        code?: string;
        cause?: unknown;
      };
    };
  };
  const message = typeof errorRecord?.message === "string" && errorRecord.message.trim().length > 0
    ? errorRecord.message
    : fallbackMessage;
  const code = errorRecord?.data?.code ?? errorRecord?.shape?.data?.code ?? null;
  const causeType = extractLegalGateCauseType(errorRecord?.data?.cause ?? errorRecord?.shape?.data?.cause);

   if (code === "CONFLICT" || causeType === "CONCURRENCY_LOCK_FAILURE") {
    return buildLegalGateErrorState(
      "Otro proceso está registrando esta aceptación. Protegimos tu expediente para evitar registros duplicados. Espera el temporizador y vuelve a intentarlo.",
      "concurrency",
      retryCount,
      LEGAL_GATE_CONCURRENCY_RETRY_SECONDS,
    );
  }
  if (code === "TOO_MANY_REQUESTS" || code === "TIMEOUT" || message.toLowerCase().includes("intenta de nuevo")) {
    return buildLegalGateErrorState(message, "transient", retryCount, LEGAL_GATE_TRANSIENT_RETRY_SECONDS);
  }
  return buildLegalGateErrorState(message, "fatal", retryCount);
}

function describeLegalGateMetricEvent(event: LegalGateMetricEvent) {
  switch (event) {
    case "attempt":
      return "Intento en curso";
    case "retry":
      return "Reintento ejecutado";
    case "conflict":
      return "Conflicto de lock detectado";
    case "accepted":
      return "Aceptación registrada";
    case "transient":
      return "Fallo transitorio";
    case "fatal":
      return "Error que requiere revisión";
    default:
      return "Sin actividad reciente";
  }
}


type DossierTarget = {
  type: "payroll_receipt" | "cfdi" | "contract" | "imss" | "evidence";
  label: string;
  description: string;
  benefit: string;
  suggestedCount: number;
};

type UploadInsight = {
  label: string;
  contribution: string;
  nextSuggestion: string;
};

type HeliosOpinionView = {
  summary?: string | null;
  legalOpinion?: string | null;
  recommendedNextStep?: string | null;
  recommendedActions?: string[];
  uncertainties?: string[];
  riskLevel?: string | null;
  confidenceScore?: number | null;
  generatedAt?: string | null;
  disclaimer?: string | null;
  mode?: string | null;
  status?: string | null;
};

type ComparisonDocument = {
  documentId: string;
  originalName: string;
  documentType: string;
  createdAt: Date | string;
  heliosOpinion?: unknown;
};

type HeliosPriorityAlert = {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  toneClasses: string;
  icon: "alert" | "file" | "sparkles";
  timestampLabel?: string;
  reasonLabel?: string;
  actionLabel?: string;
};

type MonitoringDocumentView = {
  documentId: string;
  documentName: string;
  status?: string | null;
  dispatchedAt?: Date | string | null;
  respondedAt?: Date | string | null;
  responseEvent?: string | null;
  message?: string | null;
};

type PriorityUploadGuide = {
  type: DossierTarget["type"];
  title: string;
  summary: string;
  value: string;
};

type DossierHistoryEntry = {
  id: string;
  title: string;
  description: string;
  tag: string;
  category: "document" | "response" | "summary";
  timestamp?: Date | string | null;
};

type DossierHistoryFilter = "all" | "document" | "response" | "summary";

type MobileOnboardingStep = {
  step: string;
  title: string;
  description: string;
};

type AuditarCaptureMode = "camera" | "file";

type ScanAssistAssessmentView = {
  readiness: "ready" | "retry" | "manual_review";
  documentPresence: "clear" | "partial" | "uncertain";
  issues: string[];
  userGuidance: string;
  friendlyHeadline: string;
  expectedTypeAlignment: "match" | "possible" | "uncertain" | "mismatch";
  confidence: number;
};

type StructuredExtractionFieldView = {
  key: string;
  label: string;
  value: string;
  status: "confirmed" | "estimated";
  confidence: "high" | "medium" | "low";
};

function warmVisibleNamingCopy(value?: string | null) {
  if (!value) return value ?? null;

  return value
    .replaceAll("copiloto Helios", "asistente laboral")
    .replaceAll("Copiloto Helios", "Asistente laboral")
    .replaceAll("copiloto laboral", "asistente laboral")
    .replaceAll("Copiloto laboral", "Asistente laboral")
    .replaceAll("Expediente Helios", "expediente laboral")
    .replaceAll("expediente Helios", "expediente laboral")
    .replaceAll("HeliosDocumento", "documento")
    .replaceAll("Estado de Helios", "estado del expediente")
    .replaceAll("Etapa Helios", "etapa del expediente")
    .replaceAll("Tipo Helios", "tipo sugerido")
    .replaceAll("Helios", "tu asistente laboral");
}

type StructuredExtractionView = {
  headline: string;
  summary: string;
  fields: StructuredExtractionFieldView[];
  missingFields: string[];
  reviewNotes: string[];
};

type PreviewEditableFieldView = {
  key: string;
  label: string;
  value: string;
  source: "confirmed" | "estimated" | "structured";
};

type DraftPreviewResultView = {
  draftId: string;
  createdAt: string;
  previewAsset: {
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    sha256: string;
    storageUrl: string;
    captureMode: AuditarCaptureMode | null;
    expectedDocumentType: "payroll_receipt" | "cfdi" | "contract" | "imss" | "evidence" | null;
  };
  classification: {
    documentType: string;
    normalizedDocType: string;
    classificationConfidence: number;
    reviewRecommendation: string;
    reasons: string[];
    processingProfile: string;
    supportsStructuredExtraction: boolean;
    supportsBenefitEstimation: boolean;
  };
  preliminaryAnalysis: {
    summary: string;
    processingProfile: string;
    confirmedData: Record<string, unknown>;
    estimatedData: Record<string, unknown>;
    guardrails: string[];
    extractionTargets: string[];
    structuredExtraction: StructuredExtractionView;
  };
  scanAssistance: ScanAssistAssessmentView;
};

type ConfirmedUploadResultView = {
  draftId?: string;
  classification: {
    documentType: string;
    classificationConfidence: number;
  };
  preliminaryAnalysis: {
    summary: string;
    processingProfile: string;
    confirmedData: Record<string, unknown>;
    estimatedData: Record<string, unknown>;
    guardrails: string[];
    structuredExtraction?: StructuredExtractionView;
  };
  scanAssistance?: ScanAssistAssessmentView;
  heliosOpinion?: unknown;
  engineDispatch?: {
    status?: string | null;
    reason?: string | null;
  };
  socialSecurityValidation?: {
    coverageScore?: number;
    statusLabel?: string | null;
    summary?: string | null;
    recommendedNextStep?: string | null;
    lastRevalidatedAt?: string | null;
    lastRevalidationSummary?: string | null;
    revalidationHistory?: Array<{
      recordedAt: string;
      summary: string;
      statusLabel: string;
      coverageScore?: number | null;
      recommendedNextStep?: string | null;
    }>;
    revalidationCount?: number;
    hasNewClarity?: boolean;
    clarityDelta?: number;
    clarityChangeLabel?: string | null;
    recommendedDocumentKey?: string | null;
    recommendedDocumentTitle?: string | null;
    recommendedDocumentReason?: string | null;
  };
  nextSuggestedDocument?: {
    key: string;
    title: string;
    reason: string;
  } | null;
  newClarityNotification?: {
    title: string;
    message: string;
    delta: number;
  } | null;
};

const dossierTargets: DossierTarget[] = [
  {
    type: "payroll_receipt",
    label: "Recibos de nómina",
    description: "Ayudan a revisar pagos, deducciones y cambios entre periodos.",
    benefit: "Permiten detectar diferencias y patrones de pago con más claridad.",
    suggestedCount: 2,
  },
  {
    type: "cfdi",
    label: "CFDI",
    description: "Sirven para contrastar lo timbrado fiscalmente contra lo que recibiste.",
    benefit: "Aclaran diferencias entre nómina y comprobantes fiscales.",
    suggestedCount: 2,
  },
  {
    type: "contract",
    label: "Contrato o condiciones iniciales",
    description: "Aterrizan sueldo pactado, jornada, prestaciones y condiciones de inicio.",
    benefit: "Ayudan a comparar lo prometido frente a lo realmente ocurrido.",
    suggestedCount: 1,
  },
  {
    type: "imss",
    label: "Soporte IMSS",
    description: "Refuerza contexto sobre alta, baja, NSS o semanas cotizadas.",
    benefit: "Aporta respaldo sobre seguridad social y relación laboral formal.",
    suggestedCount: 1,
  },
  {
    type: "evidence",
    label: "Evidencia complementaria",
    description: "Correos, capturas o chats ayudan a explicar fechas, instrucciones y cambios.",
    benefit: "Da contexto adicional cuando un recibo o CFDI por sí solos no bastan.",
    suggestedCount: 1,
  },
];

const priorityUploadGuides: PriorityUploadGuide[] = [
  {
    type: "payroll_receipt",
    title: "Recibos de nómina de varios periodos",
    summary: "Suelen ser de los archivos más útiles para detectar cambios repetidos en pagos, descuentos y depósitos.",
    value: "Mientras más periodos tengas en tu expediente, más fácil es darte una lectura comparada y detectar patrones que un solo recibo no muestra.",
  },
  {
    type: "cfdi",
    title: "CFDI timbrados",
    summary: "Sirven para contrastar lo que fiscalmente quedó reportado contra lo que aparece en otros documentos del caso.",
    value: "Ayudan a aclarar diferencias que muchas veces pasan desapercibidas cuando solo existe una versión del pago o del periodo revisado.",
  },
  {
    type: "contract",
    title: "Contrato o condiciones de inicio",
    summary: "Aterrizan sueldo pactado, jornada, prestaciones y acuerdos que luego conviene contrastar con la realidad.",
    value: "Son clave para entender si lo prometido al inicio coincide con lo que después muestran nóminas, CFDI o evidencia adicional.",
  },
  {
    type: "imss",
    title: "Alta, baja o semanas cotizadas del IMSS",
    summary: "Aportan fechas y señales de seguridad social que fortalecen la historia laboral del expediente.",
    value: "Suman contexto útil cuando quieres respaldarte mejor, aclarar periodos o entender huecos importantes dentro del caso.",
  },
];

const mobileOnboardingSteps: MobileOnboardingStep[] = [
  {
    step: "01",
    title: "Elige el archivo más a la mano",
    description: "Desde tu celular puedes tomar foto o subir un documento guardado sin preparar nada antes.",
  },
  {
    step: "02",
    title: "Todo se ordena en tu expediente",
    description: "Ese archivo queda guardado en un solo lugar para que no termine perdido entre carpetas, correos o chats.",
  },
  {
    step: "03",
    title: "Recibes claridad y la conservas",
    description: "Ves qué ya se entendió, qué conviene revisar y mantienes tus documentos disponibles 24/7 cuando vuelvas a necesitarlos.",
  },
];

type AuditarPersistedViewState = {
  historyFilter?: DossierHistoryFilter;
  mobileOnboardingIndex?: number;
  selectedRecommendedTargetType?: DossierTarget["type"] | null;
  preferredCaptureMode?: AuditarCaptureMode | null;
};

function isDossierTargetType(value: unknown): value is DossierTarget["type"] {
  return dossierTargets.some((item) => item.type === value);
}

function getRecommendedDocumentHint(targetType: DossierTarget["type"]) {
  switch (targetType) {
    case "payroll_receipt":
      return "Voy a subir recibos de nómina para comparar periodos, pagos y deducciones.";
    case "cfdi":
      return "Voy a subir CFDI para contrastar lo timbrado con otros documentos del expediente.";
    case "contract":
      return "Voy a subir mi contrato o condiciones iniciales para comparar lo pactado con lo ocurrido.";
    case "imss":
      return "Voy a subir soporte IMSS para reforzar fechas y contexto de seguridad social.";
    case "evidence":
      return "Voy a subir evidencia complementaria para dar más contexto al expediente.";
    default:
      return "Voy a subir un documento laboral útil para fortalecer mi expediente.";
  }
}

export function sanitizePersistedAuditarViewState(value: unknown): AuditarPersistedViewState {
  if (!value || typeof value !== "object") {
    return {};
  }

  const record = value as Record<string, unknown>;
  const historyFilter =
    record.historyFilter === "all" ||
    record.historyFilter === "document" ||
    record.historyFilter === "response" ||
    record.historyFilter === "summary"
      ? (record.historyFilter as DossierHistoryFilter)
      : undefined;
  const mobileOnboardingIndex =
    typeof record.mobileOnboardingIndex === "number" && Number.isFinite(record.mobileOnboardingIndex)
      ? Math.min(Math.max(Math.trunc(record.mobileOnboardingIndex), 0), mobileOnboardingSteps.length - 1)
      : undefined;
  const selectedRecommendedTargetType =
    record.selectedRecommendedTargetType === null
      ? null
      : isDossierTargetType(record.selectedRecommendedTargetType)
        ? record.selectedRecommendedTargetType
        : undefined;
  const preferredCaptureMode =
    record.preferredCaptureMode === null
      ? null
      : record.preferredCaptureMode === "camera" || record.preferredCaptureMode === "file"
        ? (record.preferredCaptureMode as AuditarCaptureMode)
        : undefined;

  return {
    historyFilter,
    mobileOnboardingIndex,
    selectedRecommendedTargetType,
    preferredCaptureMode,
  };
}

export function sanitizePersistedHeliosCopilotMessages(value: unknown): HeliosCopilotMessage[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .flatMap((item) => {
      if (!item || typeof item !== "object") {
        return [];
      }

      const record = item as Record<string, unknown>;
      const role = record.role;
      const content = record.content;

      if ((role === "user" || role === "assistant") && typeof content === "string" && content.trim().length > 0) {
        return [{ role, content: content.trim() } satisfies HeliosCopilotMessage];
      }

      return [];
    })
    .slice(-6);
}

function appendHeliosCopilotMessage(current: HeliosCopilotMessage[], next: HeliosCopilotMessage) {
  return [...current, next].slice(-6);
}

export function buildDossierTypeProgress(documentTypeCounts: Record<string, number>) {
  return dossierTargets.map((item) => {
    const count = documentTypeCounts[item.type] ?? 0;
    const targetCount = item.suggestedCount;
    const percent = Math.min(100, Math.round((Math.min(count, targetCount) / targetCount) * 100));
    const coverageLabel = percent === 100 ? "Cubierto" : count > 0 ? "En progreso" : "Pendiente";
    const supportingCopy =
      percent === 100
        ? "Ya tienes base suficiente en este frente para seguir contrastando con mejor contexto."
        : count > 0
          ? `Ya subiste ${count} archivo${count === 1 ? "" : "s"} de este tipo. Un poco más de respaldo aquí puede darte una lectura todavía más clara.`
          : item.benefit;

    return {
      type: item.type,
      label: item.label,
      count,
      targetCount,
      percent,
      coverageLabel,
      supportingCopy,
    };
  });
}

export function buildInlineLegalConsentState(params: {
  legalGateRequired: boolean;
  pendingDraft: boolean;
  hasSelectedFile: boolean;
  activeCaptureMode: AuditarCaptureMode;
  manualOverrideCount: number;
}) {
  const { legalGateRequired, pendingDraft, hasSelectedFile, activeCaptureMode, manualOverrideCount } = params;

  return {
    shouldShowInlineLegalConsent: legalGateRequired && (hasSelectedFile || pendingDraft),
    confirmPrimaryActionLabel: legalGateRequired
      ? manualOverrideCount > 0
        ? "Aceptar y guardar con ajustes"
        : "Aceptar y guardar documento"
      : manualOverrideCount > 0
        ? "Guardar y aplicar ajustes"
        : "Confirmar y guardar documento",
    uploadPrimaryActionLabel: hasSelectedFile
      ? legalGateRequired
        ? "Aceptar y analizar documento"
        : "Analizar antes de guardar"
      : activeCaptureMode === "camera"
        ? "Tomar foto para continuar"
        : "Elegir archivo para continuar",
  };
}

export function buildAuditarTimelineEntryState(status: "draft" | "confirmed") {
  if (status === "draft") {
    return {
      label: "Borrador analizado",
      badgeClasses: "border border-amber-200 bg-amber-100 text-amber-900",
      cardClasses: "border-amber-200 border-dashed bg-amber-50/70",
      roleCardClasses: "border-amber-200 bg-white",
      supportingCopy: "Aún no forma parte del expediente: confirma o ajusta este borrador antes de integrarlo.",
    } as const;
  }

  return {
    label: "Documento confirmado",
    badgeClasses: "border border-emerald-200 bg-emerald-100 text-emerald-800",
    cardClasses: "border-slate-200 bg-slate-50",
    roleCardClasses: "border-teal-100 bg-teal-50",
    supportingCopy: "Este documento ya quedó confirmado dentro del expediente y sirve como base para el contraste posterior.",
  } as const;
}

export function buildReanalyzeDraftActionState(params: { pendingDraft: boolean; hasManualOverrides: boolean }) {
  if (!params.pendingDraft) {
    return {
      shouldShow: false,
      label: "",
      supportingCopy: "",
    } as const;
  }

  return {
    shouldShow: true,
    label: "Reanalizar",
    supportingCopy: params.hasManualOverrides
      ? "Empezarás una nueva lectura desde cero. Los ajustes de este borrador no se arrastran y los documentos ya confirmados no cambian."
      : "Empezarás una nueva lectura desde cero sin tocar lo que ya confirmaste dentro del expediente.",
  } as const;
}

export function shouldAutoAnalyzeSelectedFile(params: {
  autoAnalyzeRequested: boolean;
  hasSelectedFile: boolean;
  pendingDraft: boolean;
  legalGateRequired: boolean;
  hasSelectedTenant: boolean;
  hasSelectedCase: boolean;
  analyzePending: boolean;
  confirmPending: boolean;
}) {
  const {
    autoAnalyzeRequested,
    hasSelectedFile,
    pendingDraft,
    legalGateRequired,
    hasSelectedTenant,
    hasSelectedCase,
    analyzePending,
    confirmPending,
  } = params;

  return (
    autoAnalyzeRequested &&
    hasSelectedFile &&
    !pendingDraft &&
    !legalGateRequired &&
    hasSelectedTenant &&
    hasSelectedCase &&
    !analyzePending &&
    !confirmPending
  );
}

function getCaptureModeSupportCopy(value: AuditarCaptureMode | null | undefined) {
  return value === "camera"
    ? "Ideal si tu documento está en papel. Abriremos primero la cámara para escanearlo más rápido."
    : "Ideal si ya tienes un PDF, XML o una foto guardada. Abriremos primero tus archivos para quitar fricción.";
}

function getScanAssistTone(scanAssist?: ScanAssistAssessmentView | null) {
  if (!scanAssist) {
    return {
      containerClasses: "border-sky-100 bg-sky-50",
      badgeClasses: "bg-white text-sky-800",
      badgeLabel: "IA preparada",
    };
  }

  if (scanAssist.readiness === "ready") {
    return {
      containerClasses: "border-emerald-100 bg-emerald-50",
      badgeClasses: "bg-white text-emerald-800",
      badgeLabel: "Captura utilizable",
    };
  }

  if (scanAssist.readiness === "retry") {
    return {
      containerClasses: "border-amber-200 bg-amber-50",
      badgeClasses: "bg-white text-amber-800",
      badgeLabel: "Conviene repetirla",
    };
  }

  return {
    containerClasses: "border-sky-100 bg-sky-50",
    badgeClasses: "bg-white text-sky-800",
    badgeLabel: "Revisión guiada",
  };
}

function getExpectedTypeAlignmentCopy(value: ScanAssistAssessmentView["expectedTypeAlignment"]) {
  switch (value) {
    case "match":
      return "Coincide bien con el documento esperado";
    case "possible":
      return "Podría coincidir con el documento esperado";
    case "mismatch":
      return "No parece el documento esperado";
    default:
      return "El tipo documental todavía no es concluyente";
  }
}

function getSelectedFilePreparationCopy(params: {
  file: File | null;
  preferredCaptureMode?: AuditarCaptureMode | null;
  selectedRecommendedTargetType?: DossierTarget["type"] | null;
}) {
  const expectedLabel = params.selectedRecommendedTargetType
    ? getSimpleDocumentTypeLabel(params.selectedRecommendedTargetType).toLowerCase()
    : "documento laboral";

  if (!params.file) {
    return params.preferredCaptureMode === "camera"
      ? "Cuando tomes la foto, la IA revisará si la hoja se ve completa, derecha y con luz suficiente antes de decirte qué conviene repetir."
      : `Cuando elijas el archivo, la IA revisará si el ${expectedLabel} parece legible y suficientemente claro para seguir con el análisis.`;
  }

  if (params.file.type.startsWith("image/")) {
    return "En cuanto tomes la foto iniciaremos una revisión preliminar de nitidez, bordes y orientación para dejarte una vista previa antes de cualquier guardado final.";
  }

  if (params.file.type === "application/pdf") {
    return "En cuanto elijas el PDF iniciaremos una revisión preliminar para validar que sus páginas se vean completas y claras antes de pedirte confirmación.";
  }

  return "En cuanto elijas el archivo haremos una revisión preliminar automática y te avisaremos si conviene complementarlo con una foto o PDF más claro antes de guardarlo.";
}

const analysisFieldLabels: Record<string, string> = {
  fileName: "Archivo",
  mimeType: "Formato",
  internalDocumentType: "Tipo de documento",
  normalizedDocType: "Detalle detectado",
  processingProfile: "Nivel de revisión",
  structuredExtractionReady: "Puede leer detalles",
  benefitEstimationReady: "Puede estimar prestaciones",
  employerRfc: "RFC visible",
  period: "Periodo visible",
  apparentAmount: "Monto visible",
  apparentEffectiveDate: "Fecha visible",
  workerName: "Nombre visible de la persona trabajadora",
  employerName: "Nombre visible de la empresa",
  jobTitle: "Puesto visible",
};

function formatDate(value?: Date | string | null) {
  if (!value) return "Sin fecha visible";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime())
    ? "Sin fecha visible"
    : date.toLocaleString("es-MX", {
        dateStyle: "medium",
        timeStyle: "short",
      });
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("No fue posible convertir el archivo."));
    };
    reader.onerror = () => reject(reader.error ?? new Error("No fue posible leer el archivo."));
    reader.readAsDataURL(file);
  });
}

function humanizeSnakeCase(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (letter) => letter.toUpperCase());
}

function getSimpleDocumentTypeLabel(value?: string | null) {
  switch (value) {
    case "payroll_receipt":
      return "Recibo de nómina";
    case "cfdi":
      return "CFDI";
    case "imss":
      return "Soporte IMSS";
    case "contract":
      return "Contrato laboral";
    case "settlement":
      return "Finiquito o liquidación";
    case "evidence":
      return "Evidencia complementaria";
    case "other":
      return "Otro documento laboral";
    default:
      return value ? humanizeSnakeCase(value) : "Documento laboral";
  }
}

function getVisibilityLabel(value?: string | null) {
  switch (value) {
    case "case_team":
      return "Solo equipo del caso";
    case "tenant_legal":
      return "Equipo legal";
    case "tenant_hr":
      return "Equipo interno autorizado";
    case "restricted":
      return "Acceso restringido";
    default:
      return "Visibilidad sin detalle";
  }
}

function getConsentLabel(value?: string | null) {
  switch (value) {
    case "pending":
      return "Permiso pendiente";
    case "granted":
      return "Permiso confirmado";
    case "revoked":
      return "Permiso retirado";
    case "expired":
      return "Permiso vencido";
    case "not_required":
      return "No hace falta permiso";
    default:
      return "Permiso sin detalle";
  }
}

function getCaseStatusLabel(value?: string | null) {
  switch (value) {
    case "intake":
      return "Inicio del caso";
    case "analysis":
      return "En análisis";
    case "conciliation":
      return "En conciliación";
    case "litigation":
      return "En juicio";
    case "resolved":
      return "Resuelto";
    case "archived":
      return "Archivado";
    default:
      return "Sin estado visible";
  }
}

function getProcessingProfileLabel(value?: string | null) {
  switch (value) {
    case "standard":
      return "Revisión inicial";
    case "expanded":
      return "Revisión ampliada";
    case "contract_deep_dive":
      return "Revisión profunda de contrato";
    default:
      return value ? humanizeSnakeCase(value) : "Sin detalle";
  }
}

function getDocumentReadiness(confidence?: number | null) {
  if ((confidence ?? 0) >= 85) {
    return {
      label: "Lectura clara",
      classes: "bg-emerald-100 text-emerald-800",
      description: "Este documento ya deja señales bastante claras para empezar a usarlo en el expediente.",
    } as const;
  }

  if ((confidence ?? 0) >= 65) {
    return {
      label: "Lectura útil",
      classes: "bg-teal-100 text-teal-800",
      description: "Este documento ya aporta contexto útil, aunque algunas partes pueden necesitar revisión adicional.",
    } as const;
  }

  return {
    label: "Conviene revisar",
    classes: "bg-amber-100 text-amber-800",
    description: "El sistema encontró valor en este archivo, pero conviene revisar con más cuidado algunos detalles.",
  } as const;
}

function asHeliosOpinion(value: unknown): HeliosOpinionView | null {
  if (!value || typeof value !== "object") return null;
  return value as HeliosOpinionView;
}

function getHeliosRiskCopy(value?: string | null) {
  switch (value) {
    case "critical":
      return { label: "Riesgo crítico", classes: "bg-rose-100 text-rose-800" } as const;
    case "high":
      return { label: "Riesgo alto", classes: "bg-red-100 text-red-800" } as const;
    case "medium":
      return { label: "Riesgo medio", classes: "bg-amber-100 text-amber-800" } as const;
    case "low":
      return { label: "Riesgo bajo", classes: "bg-emerald-100 text-emerald-800" } as const;
    default:
      return { label: "Riesgo preliminar", classes: "bg-slate-100 text-slate-700" } as const;
  }
}

function getHeliosModeLabel(value?: string | null) {
  return value === "remote" ? "Revisión ampliada" : "Revisión inicial";
}

function getHeliosActivationCopy(value?: string | null) {
  return value === "remote"
    ? "La revisión ya volvió con más contexto y la experiencia sigue viéndose igual de simple para ti."
    : "La experiencia está lista para darte una primera lectura ahora y una revisión más completa después, sin cambiar la forma de uso.";
}

function getHeliosStageCopy(params: {
  opinion?: HeliosOpinionView | null;
  engineStatus?: string;
  engineReason?: string | null;
  documentsWithOpinion: number;
}) {
  if (params.opinion && params.opinion.status !== "processing" && params.opinion.status !== "sent") {
    return {
      badge: "Lectura visible",
      title: "Tu expediente ya empezó a devolverte respuestas útiles",
      description:
        params.documentsWithOpinion > 1
          ? `Ya hay una lectura preliminar visible en ${params.documentsWithOpinion} documentos y eso ayuda a darte más contexto entre ellos.`
          : "Ya hay una lectura preliminar visible y puede seguir conectándose con el resto de tu expediente.",
      detail:
        "La revisión ya separa lo claro de lo preliminar y te orienta sobre el siguiente paso útil dentro del caso.",
      tone: "success" as const,
    };
  }

  if (params.engineStatus === "sent" || params.opinion?.status === "processing" || params.opinion?.status === "sent") {
    return {
      badge: "Interpretando",
      title: "Tu documento ya está siendo revisado",
      description:
        "El documento ya quedó protegido y la interfaz mostrará la lectura apenas regrese más detalle.",
      detail:
        "Mientras tanto, puedes seguir reuniendo documentos sin perder trazabilidad ni contexto del expediente.",
      tone: "processing" as const,
    };
  }

  if (params.engineStatus === "failed") {
    return {
      badge: "Revisión pendiente",
      title: "Hace falta reintentar una parte de la revisión, pero tu expediente sigue intacto",
      description:
        params.engineReason === "webhook_rejected"
          ? "La etapa automática necesita revisión, aunque el documento sí quedó guardado y protegido dentro del expediente."
          : "Hubo una pausa temporal en la etapa automática, pero el documento quedó resguardado y listo para retomar la lectura.",
      detail:
        "La experiencia mantiene el archivo disponible y deja lista la base para reanudar la revisión sin rehacer pasos.",
      tone: "warning" as const,
    };
  }

  return {
    badge: "Listo para empezar",
    title: "Tu expediente está listo para empezar a darte claridad",
    description:
      "En cuanto subas un documento útil, la revisión empezará a ordenar señales y a sugerir el siguiente paso más útil.",
    detail:
      "La interfaz ya está preparada para mostrar una lectura inicial ahora y una revisión más completa después, sin cambiar la forma de usar AuditaPatron.",
    tone: "neutral" as const,
  };
}

function getUploadInsight(documentType: string): UploadInsight {
  switch (documentType) {
    case "payroll_receipt":
      return {
        label: "Recibo de nómina incorporado",
        contribution:
          "Este archivo ayuda a revisar percepciones, deducciones y cambios entre pagos. Ya suma contexto útil para tu expediente.",
        nextSuggestion:
          "Si también tienes tu CFDI o contrato, subirlo puede ayudarte a comparar mejor lo reportado con lo que realmente pasó.",
      };
    case "cfdi":
      return {
        label: "CFDI incorporado",
        contribution:
          "Este documento aporta una capa fiscal muy útil para contrastar lo timbrado con lo que recibiste o trabajaste.",
        nextSuggestion:
          "Si cuentas con recibos de nómina o soporte IMSS, agregarlos puede aclarar mejor diferencias o patrones.",
      };
    case "contract":
      return {
        label: "Contrato incorporado",
        contribution:
          "Este archivo ayuda a fijar el punto de partida de la relación laboral y a entender mejor lo que se pactó desde el inicio.",
        nextSuggestion:
          "Subir recibos de nómina y CFDI puede ayudarte a comparar lo prometido con lo que sucedió en la práctica.",
      };
    case "imss":
      return {
        label: "Soporte IMSS incorporado",
        contribution:
          "Este documento fortalece el contexto de seguridad social y puede aclarar movimientos relevantes de tu historial laboral.",
        nextSuggestion:
          "Si también tienes contrato, recibos o CFDI, juntos pueden darte una visión laboral mucho más completa.",
      };
    case "evidence":
      return {
        label: "Evidencia complementaria incorporada",
        contribution:
          "Este archivo ayuda a explicar contexto, instrucciones o fechas que pueden ser importantes para interpretar mejor tu caso.",
        nextSuggestion:
          "Si te falta contrato, nómina o CFDI, súbelos también para que esa evidencia tenga todavía más contexto.",
      };
    default:
      return {
        label: "Documento incorporado",
        contribution:
          "Tu archivo ya forma parte del expediente y puede sumar contexto útil para una revisión más completa.",
        nextSuggestion:
          "Si sabes qué tipo de documento es, cuéntalo en la descripción o sube también recibos, CFDI o contrato para fortalecer mejor el análisis.",
      };
  }
}

function getHeliosTimelineRole(documentType: string, opinion?: HeliosOpinionView | null) {
  if (opinion?.summary) {
    return opinion.summary;
  }

  switch (documentType) {
    case "payroll_receipt":
      return "Este documento ayuda a comparar montos, fechas y deducciones con otros periodos para detectar cambios útiles dentro del expediente.";
    case "cfdi":
      return "Este documento ayuda a contrastar lo timbrado fiscalmente con otros comprobantes para entender mejor pagos y diferencias.";
    case "contract":
      return "Este documento sirve como base para comparar lo pactado con lo que realmente ocurrió durante la relación laboral.";
    case "imss":
      return "Este soporte ayuda a conectar altas, bajas y continuidad laboral para reforzar el contexto del caso.";
    case "evidence":
      return "Este archivo suma contexto de hechos, instrucciones o fechas para entender mejor la historia completa.";
    default:
      return "Este archivo se agrega al expediente para conectarlo con los demás documentos y reducir partes todavía preliminares.";
  }
}

function getEngineStatusCopy(status?: string, reason?: string | null) {
  if (status === "sent") {
    return {
      title: "Tu documento ya está en análisis",
      description: "Quedó guardado, siguió su proceso automático y ahora esperamos la respuesta de vuelta para completar más detalle.",
      tone: "success",
    } as const;
  }

  if (status === "failed") {
    return {
      title: "Tu documento sí quedó protegido",
      description:
        reason === "webhook_rejected"
          ? "Tu archivo sí se guardó bien. La siguiente etapa automática necesita revisión, pero tu documento no se perdió."
          : "Tu archivo sí se guardó bien. La siguiente etapa automática quedó pendiente por un tema temporal y puede revisarse después.",
      tone: "warning",
    } as const;
  }

  return {
    title: "Tu documento ya quedó resguardado",
    description:
      reason === "engine_not_configured"
        ? "Tu documento ya está protegido dentro del expediente. En este entorno, la parte automática todavía no está encendida por completo."
        : "Tu documento ya quedó guardado y listo para continuar con su revisión.",
    tone: "neutral",
  } as const;
}

function getMonitoringStatusCopy(status?: string | null) {
  switch (status) {
    case "received":
      return {
        label: "Respuesta recibida",
        classes: "bg-emerald-100 text-emerald-800",
        description: "La revisión automática ya devolvió información para este documento.",
      } as const;
    case "attention":
      return {
        label: "Conviene revisarlo",
        classes: "bg-amber-100 text-amber-800",
        description: "Ya se envió, pero la respuesta automática está tardando más de lo esperado.",
      } as const;
    case "waiting":
      return {
        label: "Esperando respuesta",
        classes: "bg-sky-100 text-sky-800",
        description: "El documento ya salió y sigue en espera de respuesta automática.",
      } as const;
    default:
      return {
        label: "Aún no enviado",
        classes: "bg-slate-100 text-slate-700",
        description: "Este documento todavía no entra a un seguimiento automático visible.",
      } as const;
  }
}

function getReturnEventLabel(value?: string | null) {
  switch (value) {
    case "document.processing.started":
      return "Procesamiento iniciado";
    case "document.analysis.completed":
    case "document.analyzed":
      return "Análisis documental completado";
    case "contract.analysis.detailed":
      return "Análisis profundo recibido";
    default:
      return value ? humanizeSnakeCase(value.replace(/\./g, "_")) : "Respuesta recibida";
  }
}

function getAnalysisFieldLabel(key: string) {
  return analysisFieldLabels[key] ?? humanizeSnakeCase(key);
}

function formatAnalysisValue(key: string, value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "Sin dato visible";
  }

  if (typeof value === "boolean") {
    return value ? "Sí" : "No";
  }

  if (key === "internalDocumentType") {
    return getSimpleDocumentTypeLabel(String(value));
  }

  if (key === "normalizedDocType") {
    return humanizeSnakeCase(String(value));
  }

  if (key === "processingProfile") {
    return getProcessingProfileLabel(String(value));
  }

  if (value instanceof Date) {
    return formatDate(value);
  }

  return String(value);
}

function getVisibleAnalysisEntries(record?: Record<string, unknown> | null) {
  return Object.entries(record ?? {}).filter(([, value]) => value !== null && value !== undefined && value !== "");
}

const editablePreviewFieldKeys = new Set<string>([
  "workerName",
  "employerName",
  "period",
  "apparentAmount",
  "apparentEffectiveDate",
  "employerRfc",
  "jobTitle",
]);

const editablePreviewFieldPriority: Record<PreviewEditableFieldView["source"], number> = {
  confirmed: 3,
  estimated: 2,
  structured: 1,
};

function normalizeEditableFieldValue(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  return String(value).trim();
}

function buildPreviewEditableFields(draft?: DraftPreviewResultView | null) {
  const fields = new Map<string, PreviewEditableFieldView>();

  const registerField = (key: string, label: string, value: unknown, source: PreviewEditableFieldView["source"]) => {
    if (!editablePreviewFieldKeys.has(key)) return;

    const normalizedValue = normalizeEditableFieldValue(value);
    if (!normalizedValue) return;

    const existing = fields.get(key);
    if (existing && editablePreviewFieldPriority[existing.source] >= editablePreviewFieldPriority[source]) {
      return;
    }

    fields.set(key, {
      key,
      label: label.trim() || getAnalysisFieldLabel(key),
      value: normalizedValue,
      source,
    });
  };

  Object.entries(draft?.preliminaryAnalysis?.confirmedData ?? {}).forEach(([key, value]) => {
    registerField(key, getAnalysisFieldLabel(key), value, "confirmed");
  });

  Object.entries(draft?.preliminaryAnalysis?.estimatedData ?? {}).forEach(([key, value]) => {
    registerField(key, getAnalysisFieldLabel(key), value, "estimated");
  });

  (draft?.preliminaryAnalysis?.structuredExtraction?.fields ?? []).forEach((field) => {
    registerField(field.key, field.label, field.value, "structured");
  });

  return Array.from(fields.values()).slice(0, 5);
}

function buildManualOverridePayload(fields: PreviewEditableFieldView[], values: Record<string, string>) {
  return fields
    .map((field) => {
      const normalizedValue = (values[field.key] ?? field.value).replace(/\s+/g, " ").trim();
      if (!normalizedValue || normalizedValue === field.value.replace(/\s+/g, " ").trim()) {
        return null;
      }

      return {
        key: field.key,
        label: field.label,
        value: normalizedValue,
      };
    })
    .filter((item): item is { key: string; label: string; value: string } => Boolean(item));
}

function getEditableFieldSupportCopy(key: string) {
  switch (key) {
    case "workerName":
      return "Úsalo si el nombre visible quedó incompleto o con un orden raro.";
    case "employerName":
      return "Corrígelo si la razón social no coincide con lo que realmente aparece en el documento.";
    case "period":
      return "Ajusta este dato cuando el periodo laboral o de pago se vea cortado o ambiguo.";
    case "apparentAmount":
      return "Útil cuando el monto quedó mal separado, con símbolos extra o lectura parcial.";
    case "apparentEffectiveDate":
      return "Corrígela si la fecha visible no coincide con la que identificas en el documento.";
    case "employerRfc":
      return "Puedes confirmarlo manualmente cuando el RFC se vea borroso o incompleto.";
    case "jobTitle":
      return "Ajusta este campo si el puesto aparece abreviado o con lectura poco clara.";
    default:
      return "Si este dato no se leyó bien, puedes dejarlo corregido antes de guardar.";
  }
}

function lowercaseFirstLetter(value: string) {
  if (!value) return value;
  return `${value.charAt(0).toLowerCase()}${value.slice(1)}`;
}

function formatListWithConjunction(values: string[]) {
  const filtered = values.filter(Boolean);
  if (filtered.length === 0) return "";
  if (filtered.length === 1) return filtered[0];
  if (filtered.length === 2) return `${filtered[0]} y ${filtered[1]}`;
  return `${filtered.slice(0, -1).join(", ")} y ${filtered[filtered.length - 1]}`;
}

function getPresentDocumentSummary(presentTypes: Set<string>) {
  const labels = dossierTargets
    .filter((item) => presentTypes.has(item.type))
    .map((item) => item.label.toLowerCase());

  return formatListWithConjunction(labels.slice(0, 3));
}

function getMonitoringOverviewCopy(params: {
  monitoringDocumentsCount: number;
  waitingCount: number;
  attentionCount: number;
  receivedCount: number;
}) {
  if (params.monitoringDocumentsCount === 0) {
      return {
        title: "El seguimiento automático está listo",
        body: "En cuanto subas un documento, su revisión avanzará aquí paso a paso. Tu expediente seguirá protegido en todo momento.",
        classes: "border-slate-200 bg-slate-50 text-slate-700",
      } as const;

  }

  if (params.attentionCount > 0) {
      return {
        title: "Conviene darle un vistazo con calma",
        body: `Hay ${params.attentionCount} documento${params.attentionCount === 1 ? "" : "s"} cuya respuesta está tardando un poco más de lo normal. No se perdió nada: tu expediente sigue resguardado y puedes seguir subiendo documentos mientras tanto.`,
        classes: "border-amber-200 bg-amber-50 text-amber-950",
      } as const;

  }

  if (params.waitingCount > 0) {
      return {
        title: "En espera, pero avanzando",
        body: `La revisión automática está esperando respuesta para ${params.waitingCount} documento${params.waitingCount === 1 ? "" : "s"}. Tu expediente sigue avanzando y te avisaremos cuando haya novedades visibles aquí.`,
        classes: "border-sky-200 bg-sky-50 text-sky-950",
      } as const;

  }

  if (params.receivedCount > 0) {
      return {
        title: "Todo al día por ahora",
        body: `Ya llegó información automática para ${params.receivedCount} documento${params.receivedCount === 1 ? "" : "s"} y esa información ya forma parte del expediente. Si subes más archivos, el seguimiento continuará en este espacio.`,
        classes: "border-emerald-100 bg-emerald-50 text-emerald-950",
      } as const;

  }

  return {
    title: "Seguimiento disponible",
    body: "Aquí seguirás viendo cualquier avance automático importante del expediente.",
    classes: "border-slate-200 bg-slate-50 text-slate-700",
  } as const;
}

function getPersonalizedNextDocumentCopy(params: {
  nextTarget?: DossierTarget;
  presentTypes: Set<string>;
  opinion?: HeliosOpinionView | null;
}) {
  const presentSummary = getPresentDocumentSummary(params.presentTypes);
  const firstUncertainty = params.opinion?.uncertainties?.find((item) => item?.trim());

  if (params.nextTarget) {
    return {
      headline: `Documento sugerido: ${params.nextTarget.label}`,
      intro: presentSummary
        ? `Con lo que ya subiste, como ${presentSummary}, ${params.nextTarget.label.toLowerCase()} puede ayudarte a ${lowercaseFirstLetter(params.nextTarget.benefit)}`
        : `Con tu expediente actual, ${params.nextTarget.label.toLowerCase()} puede ayudarte a ${lowercaseFirstLetter(params.nextTarget.benefit)}`,
      reasonTitle: "Por qué ahora puede ser el archivo más útil",
      reasonBody: firstUncertainty
        ? `${params.nextTarget.description} Además, hoy todavía conviene aclarar algo importante: ${firstUncertainty}`
        : `${params.nextTarget.description} ${params.nextTarget.benefit}`,
      followUp:
        params.opinion?.recommendedNextStep ??
        "Cada documento ayuda a reducir estimaciones y a dejar más partes del expediente en terreno claro.",
      coverage: presentSummary
        ? `Tu expediente ya se apoya en ${presentSummary}. Cada archivo adicional da más contexto para conectar señales con menos partes preliminares.`
        : "Tu expediente apenas está empezando. Cada documento útil que subas da más contexto para orientarte mejor.",
      cta: "Subir este documento ahora",
    } as const;
  }

  return {
    headline: "Tu expediente ya cubre varias piezas clave",
    intro: presentSummary
      ? `Ya subiste ${presentSummary}. Tu expediente ya tiene una base amplia para seguir ordenando tu caso con más contexto.`
      : "Tu expediente ya tiene una base amplia de documentos para seguir ordenando tu caso con más contexto.",
    reasonTitle: "Qué puede sumar si tienes otro archivo",
    reasonBody: firstUncertainty
      ? `Si cuentas con otro archivo específico de tu caso, puede ayudar a aclarar mejor esto: ${firstUncertainty}`
      : "Si tienes otro archivo específico de tu caso, también puede ayudar a confirmar o contrastar mejor tu historia laboral.",
    followUp:
      params.opinion?.recommendedNextStep ??
        "La revisión sigue usando cada documento para separar lo claro de lo que todavía conviene confirmar.",

    coverage:
      "Mientras más documentos útiles incorpores, más crece tu expediente y más contexto tendrás para orientarte mejor.",
    cta: "Subir otro documento útil",
  } as const;
}

function getComparisonFocus(leftType: string, rightType: string) {
  if (leftType === rightType) {
    switch (leftType) {
      case "payroll_receipt":
        return "montos, deducciones y cambios entre periodos";
      case "cfdi":
        return "lo timbrado, los periodos y la consistencia fiscal";
      case "contract":
        return "sueldo pactado, puesto y condiciones relevantes";
      case "imss":
        return "altas, bajas y continuidad laboral";
      case "evidence":
        return "fechas, instrucciones y contexto de los hechos";
      default:
        return "fechas, montos y contexto visible";
    }
  }

  const pairKey = [leftType, rightType].sort().join(":");
  switch (pairKey) {
    case "contract:payroll_receipt":
      return "lo pactado en el contrato frente a lo que reflejan los recibos";
    case "cfdi:payroll_receipt":
      return "lo timbrado frente a lo que aparece en la nómina";
    case "cfdi:contract":
      return "las condiciones iniciales frente a los comprobantes fiscales";
    default:
      return "fechas, montos y señales útiles entre ambos archivos";
  }
}

function pickHeliosComparisonPair(documents: ComparisonDocument[]) {
  const sortedDocuments = [...documents].sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  );

  if (sortedDocuments.length < 2) {
    return null;
  }

  const groupedDocuments = new Map<string, ComparisonDocument[]>();
  sortedDocuments.forEach((document) => {
    const current = groupedDocuments.get(document.documentType) ?? [];
    current.push(document);
    groupedDocuments.set(document.documentType, current);
  });

  for (const priorityType of ["payroll_receipt", "cfdi", "contract", "imss", "evidence"]) {
    const matches = groupedDocuments.get(priorityType);
    if (matches && matches.length >= 2) {
      return [matches[1], matches[0]] as [ComparisonDocument, ComparisonDocument];
    }
  }

  const newestContract = sortedDocuments.find((item) => item.documentType === "contract");
  const newestPayroll = sortedDocuments.find((item) => item.documentType === "payroll_receipt");
  const newestCfdi = sortedDocuments.find((item) => item.documentType === "cfdi");

  if (newestContract && newestPayroll) {
    return [newestContract, newestPayroll] as [ComparisonDocument, ComparisonDocument];
  }

  if (newestPayroll && newestCfdi) {
    return [newestPayroll, newestCfdi] as [ComparisonDocument, ComparisonDocument];
  }

  return [sortedDocuments[1], sortedDocuments[0]] as [ComparisonDocument, ComparisonDocument];
}

function buildHeliosComparisonCopy(params: {
  documents: ComparisonDocument[];
  nextTarget?: DossierTarget | null;
  opinion?: HeliosOpinionView | null;
  selectedPair?: [ComparisonDocument, ComparisonDocument] | null;
}) {
  const sortedDocuments = [...params.documents].sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  );

  if (sortedDocuments.length === 0) {
    return {
      badge: "Comparación en espera",
      headline: "La comparación se activará cuando tengas dos piezas útiles",
      supportingText:
        "En cuanto subas documentos relacionados, podrás verlos lado a lado y detectar cambios con más claridad.",
      cards: [
        {
          title: "Documentos comparados",
          body: "Todavía no hay archivos suficientes para una comparación guiada dentro del expediente.",
        },
        {
          title: "Lo que se está contrastando",
          body: "Cuando tengas dos documentos útiles, podrás revisar fechas, montos, condiciones y señales que hoy aún no se pueden cruzar.",
        },
        {
          title: "Qué puede ayudarte a aclararlo más",
          body: params.nextTarget
            ? `Puedes empezar con ${params.nextTarget.label.toLowerCase()} para darle una primera base útil a tu expediente.`
            : "Puedes empezar con el documento que tengas más a la mano para abrir la comparación después.",
        },
      ],
      guardrail: "Verás señales y diferencias útiles, siempre como una lectura preliminar y entendible.",
      coverage:
        "Mientras más documentos útiles subas, más contexto habrá para distinguir cambios reales de simples huecos de información.",
      cta: params.nextTarget ? `Subir ${params.nextTarget.label.toLowerCase()}` : "Subir mi primer documento",
    } as const;
  }

  if (sortedDocuments.length === 1) {
    const onlyDocument = sortedDocuments[0];
    return {
      badge: "Falta una segunda pieza",
      headline: "Ya tienes una base, pero hace falta otro documento para comparar mejor",
      supportingText: `Por ahora solo está ${onlyDocument.originalName}. Si subes otro archivo relacionado, será más fácil señalar cambios con claridad y menos partes preliminares.`,
      cards: [
        {
          title: "Documentos comparados",
          body: `${onlyDocument.originalName} ya forma parte del expediente, pero todavía no hay un segundo documento con el cual contrastarlo.`,
        },
        {
          title: "Lo que se está contrastando",
          body: `En cuanto haya otro ${getSimpleDocumentTypeLabel(onlyDocument.documentType).toLowerCase()} o un archivo relacionado, será posible revisar fechas, montos o condiciones entre ambos.`,
        },
        {
          title: "Qué puede ayudarte a aclararlo más",
          body: params.nextTarget
            ? `Si puedes, sube ${params.nextTarget.label.toLowerCase()} para conectar mejor esta historia.`
            : "Si tienes otro documento del mismo periodo o del mismo caso, subirlo puede ayudar mucho a la comparación.",
        },
      ],
      guardrail: "Verás señales y diferencias útiles, siempre como una lectura preliminar y entendible.",
      coverage:
        "Dos documentos bien conectados suelen darle a tu expediente una base mucho más útil que un archivo aislado.",
      cta: params.nextTarget ? `Subir ${params.nextTarget.label.toLowerCase()}` : "Subir otro documento para comparar",
    } as const;
  }

  const selectedPair = params.selectedPair ?? pickHeliosComparisonPair(sortedDocuments);

  if (!selectedPair) {
    return {
      badge: "Comparación en preparación",
      headline: "La comparación sigue reuniendo contexto para ayudarte mejor",
      supportingText:
        "Todavía no hay una pareja de documentos suficiente para contrastar cambios con claridad, pero el expediente ya quedó listo para ello en cuanto subas otra pieza útil.",
      cards: [
        {
          title: "Documentos comparados",
          body: "Todavía no hay una pareja lista para contraste manual o sugerido dentro del expediente.",
        },
        {
          title: "Lo que se está contrastando",
          body: "En cuanto exista una segunda pieza útil, podrás revisar fechas, montos y condiciones lado a lado.",
        },
        {
          title: "Qué puede ayudarte a aclararlo más",
          body: params.nextTarget
            ? `Si puedes, sube ${params.nextTarget.label.toLowerCase()} para abrir esta comparación con más contexto.`
            : "Si tienes un segundo documento relacionado, subirlo permitirá activar la comparación guiada.",
        },
      ],
      guardrail: "Verás diferencias y señales útiles, pero esta sigue siendo una lectura preliminar.",
      coverage:
        "Mientras más documentos conectados tenga tu expediente, más fácil será separar cambios reales de simples huecos de información.",
      cta: params.nextTarget ? `Subir ${params.nextTarget.label.toLowerCase()}` : "Subir otro documento para comparar mejor",
    } as const;
  }

  const [leftDocument, rightDocument] = selectedPair;
  const sameType = leftDocument.documentType === rightDocument.documentType;
  const focus = getComparisonFocus(leftDocument.documentType, rightDocument.documentType);
  const leftOpinion = asHeliosOpinion(leftDocument.heliosOpinion);
  const rightOpinion = asHeliosOpinion(rightDocument.heliosOpinion);
  const firstUncertainty =
    rightOpinion?.uncertainties?.find((item) => item?.trim()) ??
    leftOpinion?.uncertainties?.find((item) => item?.trim()) ??
    params.opinion?.uncertainties?.find((item) => item?.trim());
  const suggestedStep =
    rightOpinion?.recommendedNextStep ??
    leftOpinion?.recommendedNextStep ??
    params.opinion?.recommendedNextStep ??
    (params.nextTarget
      ? `Si puedes, sube ${params.nextTarget.label.toLowerCase()} para aclarar todavía más esta lectura.`
      : "Si tienes otro archivo relacionado, subirlo puede ayudar a confirmar mejor este contraste.");

  return {
    badge: sameType ? "Comparación lista" : "Cruce útil disponible",
    headline: sameType
      ? `Ya se pueden revisar dos ${getSimpleDocumentTypeLabel(rightDocument.documentType).toLowerCase()} para buscar cambios útiles`
      : `Ya se pueden cruzar ${getSimpleDocumentTypeLabel(leftDocument.documentType).toLowerCase()} y ${getSimpleDocumentTypeLabel(rightDocument.documentType).toLowerCase()}`,
      supportingText: `Tomamos ${leftDocument.originalName} y ${rightDocument.originalName} para revisar ${focus}. Así recibes una lectura más clara sin tener que compararlo todo manualmente.`,

    cards: [
      {
        title: "Documentos comparados",
        body: `${leftDocument.originalName} (${formatDate(leftDocument.createdAt)}) y ${rightDocument.originalName} (${formatDate(rightDocument.createdAt)}).`,
      },
        {
          title: "Lo que se está contrastando",

        body: sameType
          ? `Estamos buscando cambios en ${focus} para que sea más fácil notar qué se movió entre ambos documentos.`
          : `Está revisando ${focus} para ayudarte a conectar dos piezas distintas del expediente con menos fricción.`,
      },
      {
        title: "Qué puede ayudarte a aclararlo más",
        body: firstUncertainty ? `Por ahora todavía conviene revisar esto con calma: ${firstUncertainty}` : suggestedStep,
      },
    ],
    guardrail: "Te mostramos diferencias y señales útiles, pero esta sigue siendo una lectura preliminar.",
    coverage:
      "Mientras más documentos conectados tenga tu expediente, más fácil será distinguir cambios reales de partes que todavía necesitan contexto.",
    cta: params.nextTarget ? `Subir ${params.nextTarget.label.toLowerCase()}` : "Subir otro documento para comparar mejor",
  } as const;
}

export function buildHeliosPriorityAlerts(params: {
  documents: ComparisonDocument[];
  attentionCount: number;
  monitoringDocuments: MonitoringDocumentView[];
  selectedPair?: [ComparisonDocument, ComparisonDocument] | null;
  nextTarget?: DossierTarget | null;
  opinion?: HeliosOpinionView | null;
  newClarityNotification?: ConfirmedUploadResultView["newClarityNotification"] | null;
}) {
  const alerts: HeliosPriorityAlert[] = [];
  const latestAttentionDocument = params.monitoringDocuments.find((item) => item.status === "attention");

  if (params.newClarityNotification) {
    alerts.push({
      id: "new-clarity",
      eyebrow: "Novedad útil",
      title: params.newClarityNotification.title,
      body: params.newClarityNotification.message,
      toneClasses: "border-emerald-200 bg-emerald-50 text-emerald-950",
      icon: "sparkles",
      reasonLabel:
        params.newClarityNotification.delta > 0
          ? `Ganaste ${params.newClarityNotification.delta} punto${params.newClarityNotification.delta === 1 ? "" : "s"} de claridad`
          : "Tu expediente acaba de ganar contexto útil",
      actionLabel: params.nextTarget ? `Puede ayudarte seguir con ${params.nextTarget.label.toLowerCase()}` : "Revisa la nueva lectura de tu expediente",
    });
  }

  if (params.attentionCount > 0) {
    alerts.push({
      id: "monitoring-attention",
      eyebrow: "Prioridad alta",
      title: "Hay movimientos del seguimiento que conviene revisar pronto",
      body:
        params.attentionCount === 1
          ? "Se detectó un documento en seguimiento con una señal que merece atención para que el expediente no pierda ritmo."
          : `Se detectaron ${params.attentionCount} documentos en seguimiento con señales que conviene revisar pronto para no dejar cabos sueltos.`,
      toneClasses: "border-amber-200 bg-amber-50 text-amber-950",
      icon: "alert",
      timestampLabel: latestAttentionDocument
        ? formatDate(latestAttentionDocument.respondedAt ?? latestAttentionDocument.dispatchedAt)
        : undefined,
      reasonLabel: latestAttentionDocument?.responseEvent
        ? getReturnEventLabel(latestAttentionDocument.responseEvent)
        : "Seguimiento automático con demora visible",
      actionLabel: latestAttentionDocument?.documentName
        ? `Documento relacionado: ${latestAttentionDocument.documentName}`
        : undefined,
    });
  }

  const groupedDocuments = new Map<string, ComparisonDocument[]>();
  params.documents.forEach((document) => {
    const current = groupedDocuments.get(document.documentType) ?? [];
    current.push(document);
    groupedDocuments.set(document.documentType, current);
  });

  const repeatedGroup = ["payroll_receipt", "cfdi", "contract", "imss", "evidence"]
    .map((type) => groupedDocuments.get(type))
    .find((group): group is ComparisonDocument[] => Boolean(group && group.length >= 2));

  if (repeatedGroup) {
    const label = getSimpleDocumentTypeLabel(repeatedGroup[0].documentType).toLowerCase();
    const focus = getComparisonFocus(repeatedGroup[0].documentType, repeatedGroup[0].documentType);

    alerts.push({
      id: "repeated-patterns",
      eyebrow: "Prioridad media",
      title: `Ya hay base para detectar cambios repetidos en ${label}`,
      body: `Tienes ${repeatedGroup.length} ${label} dentro del expediente. Eso da una mejor base para revisar ${focus} con más contexto y menos partes preliminares.`,
      toneClasses: "border-teal-100 bg-teal-50 text-teal-950",
      icon: "file",
      timestampLabel: formatDate(repeatedGroup[repeatedGroup.length - 1]?.createdAt),
      reasonLabel: `Comparación útil sobre ${focus}`,
      actionLabel: `Hay ${repeatedGroup.length} documentos del mismo tipo listos para contraste`,
    });
  }

  const firstUncertainty = params.opinion?.uncertainties?.find((item) => item?.trim());
  if (firstUncertainty) {
    alerts.push({
      id: "uncertainty",
      eyebrow: "Prioridad media",
      title: "Hay un punto que todavía conviene aclarar con calma",
      body: firstUncertainty,
      toneClasses: "border-slate-200 bg-slate-50 text-slate-900",
      icon: "sparkles",
      timestampLabel: params.selectedPair ? formatDate(params.selectedPair[1].createdAt) : undefined,
      reasonLabel: "Todavía hay una parte preliminar o pendiente de confirmar",
      actionLabel: params.nextTarget ? `Puede ayudar subir ${params.nextTarget.label.toLowerCase()}` : undefined,
    });
  }

  if (params.selectedPair) {
    const sameType = params.selectedPair[0].documentType === params.selectedPair[1].documentType;
    alerts.push({
      id: "comparison-ready",
      eyebrow: "Prioridad útil",
      title: sameType
        ? "Ya tienes dos documentos listos para una comparación más fina"
        : "Ya tienes dos piezas listas para contrastarse con claridad",
      body: sameType
        ? "Ya se pueden revisar cambios del mismo tipo de documento para ayudarte a distinguir mejor qué se movió entre periodos."
        : "Ya se pueden contrastar dos piezas distintas del expediente para conectar mejor la historia del caso.",
      toneClasses: "border-teal-100 bg-teal-50 text-teal-950",
      icon: "file",
      timestampLabel: formatDate(params.selectedPair[1].createdAt),
      reasonLabel: "Ya existe una pareja útil de documentos dentro del expediente",
      actionLabel: "Puedes abrir la comparación lado a lado para revisar con más calma",
    });
  }

  if (params.nextTarget && alerts.length < 3) {
    alerts.push({
      id: "next-target",
      eyebrow: "Siguiente oportunidad",
      title: `Subir ${params.nextTarget.label.toLowerCase()} puede destrabar más claridad`,
      body: `${params.nextTarget.description} ${params.nextTarget.benefit}`,
      toneClasses: "border-emerald-100 bg-emerald-50 text-emerald-950",
      icon: "sparkles",
      reasonLabel: "Todavía falta una pieza útil para aclarar mejor el expediente",
      actionLabel: `Siguiente documento sugerido: ${params.nextTarget.label}`,
    });
  }

  if (alerts.length === 0) {
    alerts.push({
      id: "foundation",
      eyebrow: "Base activa",
      title: "Tu expediente ya tiene una base útil para seguir ordenándose",
      body: "Cada documento adicional aporta más contexto para convertir diferencias aisladas en señales más fáciles de priorizar.",
      toneClasses: "border-slate-200 bg-slate-50 text-slate-900",
      icon: "sparkles",
      reasonLabel: "Tu expediente ya tiene contexto inicial suficiente para seguir creciendo",
    });
  }

  return alerts.slice(0, 3);
}

export default function Auditar() {
  const auth = useAuth();
  const utils = trpc.useUtils();
  const bootstrapMutation = trpc.workspace.bootstrap.useMutation();
  const analyzeDraftMutation = trpc.cases.analyzeDocumentDraft.useMutation();
  const confirmDraftMutation = trpc.cases.confirmDocumentDraft.useMutation();
  const persistAuditarViewStateMutation = trpc.cases.persistAuditarViewState.useMutation();
  const heliosCopilotMutation = trpc.cases.heliosCopilotChat.useMutation();
  const revalidateSocialSecurityMutation = trpc.cases.revalidateSocialSecurity.useMutation();
  const acceptLegalPackageMutation = trpc.consent.acceptLegalPackage.useMutation();

  const [bootstrapStarted, setBootstrapStarted] = useState(false);
  const [selectedTenantId, setSelectedTenantId] = useState("");
  const [selectedCaseId, setSelectedCaseId] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [textHint, setTextHint] = useState("");
  const [pickerKey, setPickerKey] = useState(0);
  const [uploadSourceOpen, setUploadSourceOpen] = useState(false);
  const [estimatedAcknowledged, setEstimatedAcknowledged] = useState(false);
  const [timelineExpandedOnMobile, setTimelineExpandedOnMobile] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<DossierHistoryFilter>("all");
  const [mobileOnboardingIndex, setMobileOnboardingIndex] = useState(0);
  const [selectedRecommendedTargetType, setSelectedRecommendedTargetType] = useState<DossierTarget["type"] | null>(null);
  const [preferredCaptureMode, setPreferredCaptureMode] = useState<AuditarCaptureMode | null>(null);
  const [selectedCaptureMode, setSelectedCaptureMode] = useState<AuditarCaptureMode | null>(null);
  const [autoAnalyzeRequested, setAutoAnalyzeRequested] = useState(false);
  const [selectedComparisonLeftId, setSelectedComparisonLeftId] = useState("");
  const [selectedComparisonRightId, setSelectedComparisonRightId] = useState("");
  const [pendingDraft, setPendingDraft] = useState<DraftPreviewResultView | null>(null);
  const [manualFieldValues, setManualFieldValues] = useState<Record<string, string>>({});
  const [previewStatusFlash, setPreviewStatusFlash] = useState(false);
  const [saveStatusFlash, setSaveStatusFlash] = useState(false);
  const [recommendedStepFlash, setRecommendedStepFlash] = useState(false);
  const [autoAdvanceFlash, setAutoAdvanceFlash] = useState(false);
  const [lastUpload, setLastUpload] = useState<ConfirmedUploadResultView | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [persistenceReady, setPersistenceReady] = useState(false);
  const [remoteViewStateReadyKey, setRemoteViewStateReadyKey] = useState<string | null>(null);
  const [heliosCopilotOpen, setHeliosCopilotOpen] = useState(false);
  const [heliosCopilotMessages, setHeliosCopilotMessages] = useState<HeliosCopilotMessage[]>([]);
  const [legalGateChecked, setLegalGateChecked] = useState(false);
  const [legalGateError, setLegalGateError] = useState<LegalGateErrorState | null>(null);
  const [legalGateMetrics, setLegalGateMetrics] = useState<LegalGateMetricsState>(INITIAL_LEGAL_GATE_METRICS);
  const [legalGateRetryCountdown, setLegalGateRetryCountdown] = useState(0);
  const [legalDocumentsDrawerOpen, setLegalDocumentsDrawerOpen] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const uploadSectionRef = useRef<HTMLDivElement | null>(null);
  const recommendedStepRef = useRef<HTMLDivElement | null>(null);
  const syncedRemoteViewStateRef = useRef("");
  const trackedExpedienteScopeRef = useRef("");
  const trackedLegalGateScopeRef = useRef("");
  const documentSelectionStartedAtRef = useRef<number | null>(null);
  const legalGateHarnessMode = useMemo(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return new URLSearchParams(window.location.search).get("legalGateHarness") === "1";
  }, []);

  useEffect(() => {
    const retryAvailableAt = legalGateError?.retryAvailableAt ?? null;

    if (!retryAvailableAt) {
      setLegalGateRetryCountdown(0);
      return;
    }

    const updateCountdown = () => {
      const remainingSeconds = Math.max(Math.ceil((retryAvailableAt - Date.now()) / 1000), 0);
      setLegalGateRetryCountdown(remainingSeconds);
    };

    updateCountdown();
    const countdownTimer = window.setInterval(updateCountdown, 250);
    return () => window.clearInterval(countdownTimer);
  }, [legalGateError?.retryAvailableAt]);

  const auditarPersistenceKey = useMemo(() => {
    if (!auth.user) {
      return null;
    }

    const userRecord = auth.user as Record<string, unknown>;
    const stableId = ["openId", "id", "userId", "email"].find((key) => {
      const value = userRecord[key];
      return typeof value === "string" && value.trim().length > 0;
    });

    if (!stableId) {
      return null;
    }

    return `auditar-view-state:v1:${String(userRecord[stableId])}`;
  }, [auth.user]);

  useEffect(() => {
    setPersistenceReady(false);

    if (typeof window === "undefined" || !auditarPersistenceKey) {
      return;
    }

    try {
      const rawValue = window.localStorage.getItem(auditarPersistenceKey);
      const persistedState = sanitizePersistedAuditarViewState(rawValue ? JSON.parse(rawValue) : null);

      setHistoryFilter(persistedState.historyFilter ?? "all");
      setMobileOnboardingIndex(persistedState.mobileOnboardingIndex ?? 0);
      setSelectedRecommendedTargetType(
        persistedState.selectedRecommendedTargetType === undefined ? null : persistedState.selectedRecommendedTargetType,
      );
      setPreferredCaptureMode(persistedState.preferredCaptureMode === undefined ? null : persistedState.preferredCaptureMode);
    } catch {
      window.localStorage.removeItem(auditarPersistenceKey);
      setHistoryFilter("all");
      setMobileOnboardingIndex(0);
      setSelectedRecommendedTargetType(null);
      setPreferredCaptureMode(null);
    } finally {
      setPersistenceReady(true);
    }
  }, [auditarPersistenceKey]);

  useEffect(() => {
    if (typeof window === "undefined" || !auditarPersistenceKey || !persistenceReady) {
      return;
    }

    window.localStorage.setItem(
      auditarPersistenceKey,
      JSON.stringify({
        historyFilter,
        mobileOnboardingIndex,
        selectedRecommendedTargetType,
        preferredCaptureMode,
      }),
    );
  }, [auditarPersistenceKey, historyFilter, mobileOnboardingIndex, persistenceReady, preferredCaptureMode, selectedRecommendedTargetType]);

  useEffect(() => {
    if (auth.loading || !auth.isAuthenticated || bootstrapStarted) return;

    setBootstrapStarted(true);
    bootstrapMutation.mutate(undefined, {
      onSuccess: (result) => {
        if (!selectedTenantId) {
          setSelectedTenantId(result.tenant.tenantId);
        }
      },
    });
  }, [auth.isAuthenticated, auth.loading, bootstrapMutation, bootstrapStarted, selectedTenantId]);

  const tenantsQuery = trpc.tenants.list.useQuery(undefined, {
    enabled: auth.isAuthenticated && bootstrapMutation.isSuccess,
    refetchOnWindowFocus: false,
  });

  const casesQuery = trpc.cases.list.useQuery(selectedTenantId ? { tenantId: selectedTenantId } : undefined, {
    enabled: auth.isAuthenticated && Boolean(selectedTenantId),
    refetchOnWindowFocus: false,
  });

  const caseDetailInput = selectedTenantId && selectedCaseId ? { tenantId: selectedTenantId, caseId: selectedCaseId } : undefined;
  const currentCaseScopeKey = caseDetailInput ? `${caseDetailInput.tenantId}:${caseDetailInput.caseId}` : null;
  const heliosCopilotHistoryStorageKey = useMemo(() => {
    if (!auditarPersistenceKey || !currentCaseScopeKey) {
      return null;
    }

    return `${auditarPersistenceKey}:copilot:${currentCaseScopeKey}`;
  }, [auditarPersistenceKey, currentCaseScopeKey]);

  useEffect(() => {
    setHeliosCopilotOpen(false);
    heliosCopilotMutation.reset();
  }, [currentCaseScopeKey]);

  useEffect(() => {
    if (typeof window === "undefined" || !heliosCopilotHistoryStorageKey) {
      setHeliosCopilotMessages([]);
      return;
    }

    try {
      const rawValue = window.localStorage.getItem(heliosCopilotHistoryStorageKey);
      setHeliosCopilotMessages(sanitizePersistedHeliosCopilotMessages(rawValue ? JSON.parse(rawValue) : null));
    } catch {
      window.localStorage.removeItem(heliosCopilotHistoryStorageKey);
      setHeliosCopilotMessages([]);
    }
  }, [heliosCopilotHistoryStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined" || !heliosCopilotHistoryStorageKey) {
      return;
    }

    if (heliosCopilotMessages.length === 0) {
      window.localStorage.removeItem(heliosCopilotHistoryStorageKey);
      return;
    }

    window.localStorage.setItem(heliosCopilotHistoryStorageKey, JSON.stringify(heliosCopilotMessages.slice(-6)));
  }, [heliosCopilotHistoryStorageKey, heliosCopilotMessages]);

  const caseDetailQuery = trpc.cases.detail.useQuery(caseDetailInput as { tenantId: string; caseId: string }, {
    enabled: auth.isAuthenticated && Boolean(caseDetailInput),
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    setRemoteViewStateReadyKey(null);
    syncedRemoteViewStateRef.current = "";
  }, [currentCaseScopeKey]);

  useEffect(() => {
    if (!currentCaseScopeKey || caseDetailQuery.status !== "success" || remoteViewStateReadyKey === currentCaseScopeKey) {
      return;
    }

    const remoteState = sanitizePersistedAuditarViewState(caseDetailQuery.data?.auditarViewState);

    if (remoteState.historyFilter !== undefined) {
      setHistoryFilter(remoteState.historyFilter);
    }
    if (remoteState.mobileOnboardingIndex !== undefined) {
      setMobileOnboardingIndex(remoteState.mobileOnboardingIndex);
    }
    if (remoteState.selectedRecommendedTargetType !== undefined) {
      setSelectedRecommendedTargetType(remoteState.selectedRecommendedTargetType);
    }
    if (remoteState.preferredCaptureMode !== undefined) {
      setPreferredCaptureMode(remoteState.preferredCaptureMode);
    }

    syncedRemoteViewStateRef.current = JSON.stringify(remoteState);
    setRemoteViewStateReadyKey(currentCaseScopeKey);
  }, [caseDetailQuery.data?.auditarViewState, caseDetailQuery.status, currentCaseScopeKey, remoteViewStateReadyKey]);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !currentCaseScopeKey ||
      !selectedTenantId ||
      !selectedCaseId ||
      !persistenceReady ||
      remoteViewStateReadyKey !== currentCaseScopeKey
    ) {
      return;
    }

    const serializedViewState = JSON.stringify({
      historyFilter,
      mobileOnboardingIndex,
      selectedRecommendedTargetType,
      preferredCaptureMode,
    });

    if (syncedRemoteViewStateRef.current === serializedViewState) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      persistAuditarViewStateMutation.mutate(
        {
          tenantId: selectedTenantId,
          caseId: selectedCaseId,
          viewState: {
            historyFilter,
            mobileOnboardingIndex,
            selectedRecommendedTargetType,
            preferredCaptureMode,
          },
        },
        {
          onSuccess: () => {
            syncedRemoteViewStateRef.current = serializedViewState;
          },
        },
      );
    }, 450);

    return () => window.clearTimeout(timeoutId);
  }, [
    currentCaseScopeKey,
    historyFilter,
    mobileOnboardingIndex,
    persistenceReady,
    preferredCaptureMode,
    remoteViewStateReadyKey,
    selectedCaseId,
    selectedRecommendedTargetType,
    selectedTenantId,
  ]);

  useEffect(() => {
    if (!selectedTenantId && tenantsQuery.data?.[0]?.tenantId) {
      setSelectedTenantId(tenantsQuery.data[0].tenantId);
    }
  }, [selectedTenantId, tenantsQuery.data]);

  useEffect(() => {
    if (!casesQuery.data?.length) return;
    const stillExists = casesQuery.data.some((item) => item.caseId === selectedCaseId);
    if (!selectedCaseId || !stillExists) {
      setSelectedCaseId(casesQuery.data[0].caseId);
    }
  }, [casesQuery.data, selectedCaseId]);

  const legalAcceptance = caseDetailQuery.data?.legalAcceptance;
  const legalAcceptanceDocuments = legalAcceptance?.documents ?? [];
  const acceptedLegalDocumentsCount = legalAcceptanceDocuments.filter((document) => document.accepted).length;
  const legalPendingDocuments = legalAcceptance?.missingDocuments ?? [];
  const legalGateRequired = Boolean(caseDetailInput && legalAcceptance && !legalAcceptance.isAccepted);
  const documents = caseDetailQuery.data?.documents ?? [];

  useEffect(() => {
    if (!currentCaseScopeKey || caseDetailQuery.status !== "success" || trackedExpedienteScopeRef.current === currentCaseScopeKey) {
      return;
    }

    trackedExpedienteScopeRef.current = currentCaseScopeKey;
    trackFunnelStep("expediente_opened", {
      tenantId: selectedTenantId,
      caseId: selectedCaseId,
      documentCount: documents.length,
      legalAccepted: !legalGateRequired,
    });
  }, [caseDetailQuery.status, currentCaseScopeKey, documents.length, legalGateRequired, selectedCaseId, selectedTenantId]);

  useEffect(() => {
    if (!currentCaseScopeKey || !legalGateRequired || trackedLegalGateScopeRef.current === currentCaseScopeKey) {
      return;
    }

    trackedLegalGateScopeRef.current = currentCaseScopeKey;
    trackFunnelStep("legal_gate_viewed", {
      tenantId: selectedTenantId,
      caseId: selectedCaseId,
      missingDocumentsCount: legalPendingDocuments.length,
    });
  }, [currentCaseScopeKey, legalGateRequired, legalPendingDocuments.length, selectedCaseId, selectedTenantId]);
  const heliosExpediente = caseDetailQuery.data?.heliosExpediente;
  const socialSecurityValidation = caseDetailQuery.data?.socialSecurityValidation;
  const uploadSocialSecurityValidation = lastUpload?.socialSecurityValidation ?? null;
  const effectiveSocialSecurityValidation = uploadSocialSecurityValidation ?? socialSecurityValidation ?? null;
  const heliosDocumentSnapshots = caseDetailQuery.data?.heliosDocuments ?? [];
  const heliosDocumentSnapshotById = useMemo(
    () => new Map(heliosDocumentSnapshots.map((item) => [item.documentId, item] as const)),
    [heliosDocumentSnapshots],
  );
  const lastHeliosOpinion = asHeliosOpinion(lastUpload?.heliosOpinion);
  const heliosDocumentsCount = useMemo(
    () => documents.filter((item) => Boolean(asHeliosOpinion(item.heliosOpinion))).length,
    [documents],
  );
  const latestHeliosDocument = useMemo(
    () => documents.find((item) => Boolean(asHeliosOpinion(item.heliosOpinion))) ?? null,
    [documents],
  );
  const latestPersistedHeliosOpinion = asHeliosOpinion(latestHeliosDocument?.heliosOpinion);
  const visibleHeliosOpinion = lastHeliosOpinion ?? latestPersistedHeliosOpinion;
  const heliosStage = getHeliosStageCopy({
    opinion: visibleHeliosOpinion,
    engineStatus: lastUpload?.engineDispatch?.status ?? undefined,
    engineReason: lastUpload?.engineDispatch?.reason ?? undefined,
    documentsWithOpinion: heliosDocumentsCount,
  });
  const heliosCopilotIntro = useMemo(() => {
    if (visibleHeliosOpinion?.summary?.trim()) {
      return `${warmVisibleNamingCopy(visibleHeliosOpinion.summary)}\n\nSi quieres, puedo explicarte con palabras simples qué ya se entiende en tu expediente laboral, qué falta confirmar y cuál parece ser el siguiente paso más útil.`;
    }

    if (heliosDocumentsCount === 0) {
      return "Todavía no hay una lectura visible de tu expediente laboral. En cuanto subas o confirmes documentos, podré ayudarte a entender riesgos, documentos faltantes y siguientes pasos sin tecnicismos.";
    }

    return `Ya hay contexto preliminar para ${heliosDocumentsCount} documento${heliosDocumentsCount === 1 ? "" : "s"} dentro de tu expediente laboral. Puedo ayudarte a traducir esa información en acciones concretas y fáciles de entender.`;
  }, [heliosDocumentsCount, visibleHeliosOpinion?.summary]);
  const heliosCopilotSuggestedPrompts = useMemo(() => {
    const serverPrompts = heliosCopilotMutation.data?.suggestedPrompts ?? [];
    const localPrompts = [
      "¿Qué riesgo principal ves en mi expediente?",
      visibleHeliosOpinion?.recommendedNextStep
        ? "Explícame el siguiente paso sugerido con palabras simples."
        : "¿Qué paso me conviene seguir ahora?",
      visibleHeliosOpinion?.uncertainties?.length
        ? "¿Qué puntos todavía faltan confirmar?"
        : "¿Qué documento me conviene subir después?",
      "Resúmeme mi situación actual en pocas palabras.",
    ].filter((item): item is string => Boolean(item));

    return Array.from(new Set([...serverPrompts, ...localPrompts])).slice(0, 4);
  }, [heliosCopilotMutation.data?.suggestedPrompts, visibleHeliosOpinion?.recommendedNextStep, visibleHeliosOpinion?.uncertainties]);
  const heliosCopilotConversation = useMemo<HeliosCopilotMessage[]>(
    () => [{ role: "assistant", content: heliosCopilotIntro }, ...heliosCopilotMessages],
    [heliosCopilotIntro, heliosCopilotMessages],
  );
  const heliosCopilotSupportingDocuments = useMemo(() => {
    const prioritizedDocuments = [...documents].sort((left, right) => {
      const leftHasOpinion = Number(Boolean(asHeliosOpinion(left.heliosOpinion)));
      const rightHasOpinion = Number(Boolean(asHeliosOpinion(right.heliosOpinion)));

      if (leftHasOpinion !== rightHasOpinion) {
        return rightHasOpinion - leftHasOpinion;
      }

      return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    });

    return prioritizedDocuments.slice(0, 3).map((document) => {
      const opinion = asHeliosOpinion(document.heliosOpinion);
      const detail = [
        `Tipo: ${getSimpleDocumentTypeLabel(document.documentType)}.`,
        opinion?.summary ? `Lectura visible: ${opinion.summary}` : null,
        opinion?.recommendedNextStep ? `Paso sugerido: ${opinion.recommendedNextStep}` : null,
        opinion?.uncertainties?.[0] ? `Por confirmar: ${opinion.uncertainties[0]}` : null,
      ]
        .filter((item): item is string => Boolean(item))
        .join(" ");

      return {
        id: document.documentId,
        label: document.originalName,
        detail,
      };
    });
  }, [documents]);
  const presentTypes = useMemo(() => new Set(documents.map((item) => item.documentType)), [documents]);

  const dossierStatus = useMemo(() => {
    const completed = dossierTargets.filter((item) => presentTypes.has(item.type)).length;
    const percent = Math.max(12, Math.round((completed / dossierTargets.length) * 100));
    const nextTarget = dossierTargets.find((item) => !presentTypes.has(item.type));
    const label = completed >= 4 ? "Respaldo sólido" : completed >= 2 ? "Respaldo en crecimiento" : "Base inicial";

    return {
      completed,
      percent,
      label,
      nextTarget,
      total: dossierTargets.length,
    };
  }, [presentTypes]);
  const socialSecurityCoveragePercent = effectiveSocialSecurityValidation?.coverageScore ?? dossierStatus.percent;
  const socialSecurityStatusLabel = effectiveSocialSecurityValidation?.statusLabel ?? "Cruce pendiente";
  const socialSecuritySummary =
    effectiveSocialSecurityValidation?.summary ??
    "Todavía faltan señales suficientes de IMSS e Infonavit para darte un cruce más completo dentro del expediente.";
  const socialSecurityRecommendedNextStep =
    effectiveSocialSecurityValidation?.recommendedNextStep ??
    "Empieza por un soporte IMSS o un estado relacionado con Infonavit para abrir este cruce dentro del expediente.";
  const socialSecurityLastCheckLabel = effectiveSocialSecurityValidation?.lastRevalidatedAt
    ? `Última revalidación: ${formatDate(effectiveSocialSecurityValidation.lastRevalidatedAt)}`
    : "Aún no has revalidado este cruce desde tu expediente.";
  const socialSecurityRevalidationHistory = effectiveSocialSecurityValidation?.revalidationHistory ?? [];
  const socialSecurityRecommendedDocument = lastUpload?.nextSuggestedDocument
    ? {
        title: lastUpload.nextSuggestedDocument.title,
        reason: lastUpload.nextSuggestedDocument.reason,
      }
    : effectiveSocialSecurityValidation?.recommendedDocumentTitle
      ? {
          title: effectiveSocialSecurityValidation.recommendedDocumentTitle,
          reason:
            effectiveSocialSecurityValidation.recommendedDocumentReason ??
            "Este documento puede ayudarte a ganar más claridad dentro del expediente.",
        }
      : null;
  const timelineEntries = useMemo(() => {
    const confirmedEntries = [...documents]
      .sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime())
      .map((document, index) => {
        const heliosOpinion = asHeliosOpinion(document.heliosOpinion);
        const insight = getUploadInsight(document.documentType);
        const readiness = getDocumentReadiness(document.classificationConfidence);

        return {
          id: document.documentId,
          step: index + 1,
          title: getSimpleDocumentTypeLabel(document.documentType),
          originalName: document.originalName,
          contribution: insight.contribution,
          heliosRole: getHeliosTimelineRole(document.documentType, heliosOpinion),
          createdAt: document.createdAt,
          readiness,
          hasVisibleOpinion: Boolean(heliosOpinion),
          lifecycleState: buildAuditarTimelineEntryState("confirmed"),
        };
      });

    if (!pendingDraft) {
      return confirmedEntries;
    }

    const previewInsight = getUploadInsight(pendingDraft.classification.documentType);

    return [
      ...confirmedEntries,
      {
        id: `draft-${pendingDraft.draftId}`,
        step: confirmedEntries.length + 1,
        title: getSimpleDocumentTypeLabel(pendingDraft.classification.documentType),
        originalName: pendingDraft.previewAsset.fileName,
        contribution: previewInsight.contribution,
        heliosRole:
          pendingDraft.preliminaryAnalysis.summary ||
          "Este borrador ya ofrece una lectura inicial, pero seguirá fuera del expediente hasta que lo confirmes.",
        createdAt: new Date().toISOString(),
        readiness: getDocumentReadiness(pendingDraft.scanAssistance?.confidence),
        hasVisibleOpinion: true,
        lifecycleState: buildAuditarTimelineEntryState("draft"),
      },
    ];
  }, [documents, pendingDraft]);

  const comparisonDocuments = useMemo(
    () => [...documents].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()),
    [documents],
  );
  const automaticComparisonPair = useMemo(() => pickHeliosComparisonPair(documents), [documents]);
  const engineStatus = getEngineStatusCopy(
    lastUpload?.engineDispatch?.status ?? undefined,
    lastUpload?.engineDispatch?.reason ?? undefined,
  );
  const uploadInsight = lastUpload ? getUploadInsight(lastUpload.classification.documentType) : null;
  const confirmedEntries = useMemo(
    () => getVisibleAnalysisEntries(lastUpload?.preliminaryAnalysis?.confirmedData as Record<string, unknown> | undefined),
    [lastUpload],
  );
  const estimatedEntries = useMemo(
    () => getVisibleAnalysisEntries(lastUpload?.preliminaryAnalysis?.estimatedData as Record<string, unknown> | undefined),
    [lastUpload],
  );
  const guardrails = lastUpload?.preliminaryAnalysis?.guardrails ?? [];
  const lastUploadReadiness = getDocumentReadiness(lastUpload?.classification?.classificationConfidence);
  const complilinkMonitoring = caseDetailQuery.data?.complilinkMonitoring;
  const monitoringDocuments = complilinkMonitoring?.documents ?? [];
  const pendingMonitoringDocuments = monitoringDocuments.filter(
    (item) => item.status === "waiting" || item.status === "attention",
  );
  const attentionMonitoringDocuments = pendingMonitoringDocuments.filter((item) => item.status === "attention");
  const timelinePreviewLimit = 3;
  const mobileHiddenTimelineCount = Math.max(0, timelineEntries.length - timelinePreviewLimit);
  const monitoringOverview = getMonitoringOverviewCopy({
    monitoringDocumentsCount: monitoringDocuments.length,
    waitingCount: complilinkMonitoring?.summary.waitingCount ?? 0,
    attentionCount: complilinkMonitoring?.summary.attentionCount ?? 0,
    receivedCount: complilinkMonitoring?.summary.receivedCount ?? 0,
  });
  const operationalFunnelSteps = [
    {
      id: "home",
      label: "Home",
      completed: auth.isAuthenticated || bootstrapMutation.isSuccess,
      detail: "Ya entraste al entorno base desde el que empieza el recorrido operativo.",
    },
    {
      id: "expediente",
      label: "Expediente",
      completed: Boolean(currentCaseScopeKey),
      detail: currentCaseScopeKey
        ? "Ya seleccionaste un expediente y la continuidad entre dispositivos quedó activa."
        : "Falta elegir un expediente para continuar con el flujo principal.",
    },
    {
      id: "legal",
      label: "Aceptación legal",
      completed: Boolean(legalAcceptance?.isAccepted),
      detail: legalAcceptance?.isAccepted
        ? "El paquete legal ya quedó aceptado para este expediente."
        : "Todavía falta aceptar el paquete legal antes de subir documentos al expediente.",
    },
    {
      id: "documents",
      label: "Subida documental",
      completed: documents.length > 0,
      detail:
        documents.length > 0
          ? `Ya hay ${documents.length} documento${documents.length === 1 ? "" : "s"} incorporado${documents.length === 1 ? "" : "s"} al expediente.`
          : "Aún no hay documentos incorporados al expediente visible.",
    },
  ] as const;
  const operationalFunnelCompletedCount = operationalFunnelSteps.filter((step) => step.completed).length;
  const operationalFunnelNextStep = operationalFunnelSteps.find((step) => !step.completed) ?? null;

  useEffect(() => {
    setLegalGateChecked(false);
    setLegalGateError(null);
  }, [currentCaseScopeKey, legalAcceptance?.isAccepted]);
  const documentTypeCounts = useMemo(
    () =>
      documents.reduce<Record<string, number>>((counts, document) => {
        counts[document.documentType] = (counts[document.documentType] ?? 0) + 1;
        return counts;
      }, {}),
    [documents],
  );
  const dossierTypeProgress = useMemo(() => buildDossierTypeProgress(documentTypeCounts), [documentTypeCounts]);
  const effectiveRecommendedTarget = useMemo(
    () => dossierTargets.find((item) => item.type === selectedRecommendedTargetType) ?? dossierStatus.nextTarget ?? null,
    [dossierStatus.nextTarget, selectedRecommendedTargetType],
  );
  const nextDocumentCopy = getPersonalizedNextDocumentCopy({
    nextTarget: effectiveRecommendedTarget ?? undefined,
    presentTypes,
    opinion: visibleHeliosOpinion,
  });
  const missingPriorityUploadGuides = useMemo(
    () => priorityUploadGuides.filter((item) => !presentTypes.has(item.type)),
    [presentTypes],
  );
  const visiblePriorityUploadGuides = missingPriorityUploadGuides.length > 0 ? missingPriorityUploadGuides : priorityUploadGuides.slice(0, 2);
  const activeMobileOnboardingStep = mobileOnboardingSteps[mobileOnboardingIndex] ?? mobileOnboardingSteps[0];
  const isFirstDocumentFlow = documents.length === 0 && !pendingDraft && !lastUpload;
  const shouldCompactMobileUploadEntry = isFirstDocumentFlow;
  const activeCaptureMode = selectedCaptureMode ?? preferredCaptureMode ?? (isFirstDocumentFlow ? "camera" : "file");
  const remoteViewStateSyncLabel = !currentCaseScopeKey
    ? "Elige tu caso para activar continuidad entre dispositivos."
    : persistAuditarViewStateMutation.isPending
      ? "Guardando esta vista para cuando vuelvas a entrar..."
      : remoteViewStateReadyKey === currentCaseScopeKey
        ? "Tu avance de esta vista se guarda también entre dispositivos."
        : "Preparando la continuidad entre dispositivos...";
  const selectedFilePreparationCopy = useMemo(
    () =>
      getSelectedFilePreparationCopy({
        file: selectedFile,
        preferredCaptureMode,
        selectedRecommendedTargetType,
      }),
    [preferredCaptureMode, selectedFile, selectedRecommendedTargetType],
  );
  const isProcessingDocument = analyzeDraftMutation.isPending || confirmDraftMutation.isPending;
  const selectedFileValidationMessage = useMemo(() => validateDocumentUploadFile(selectedFile), [selectedFile]);
  const uploadProgressState = useMemo(
    () =>
      buildUploadProgressState({
        selectedFile,
        pendingDraft: Boolean(pendingDraft),
        isAnalyzingDraft: analyzeDraftMutation.isPending,
        isConfirmingDraft: confirmDraftMutation.isPending,
      }),
    [analyzeDraftMutation.isPending, confirmDraftMutation.isPending, pendingDraft, selectedFile],
  );
  const previewInsight = pendingDraft ? getUploadInsight(pendingDraft.classification.documentType) : null;
  const previewReadiness = getDocumentReadiness(pendingDraft?.classification?.classificationConfidence);
  const previewConfirmedEntries = useMemo(
    () => getVisibleAnalysisEntries(pendingDraft?.preliminaryAnalysis?.confirmedData),
    [pendingDraft],
  );
  const previewEstimatedEntries = useMemo(
    () => getVisibleAnalysisEntries(pendingDraft?.preliminaryAnalysis?.estimatedData),
    [pendingDraft],
  );
  const previewStructuredExtraction = pendingDraft?.preliminaryAnalysis?.structuredExtraction ?? null;
  const previewEditableFields = useMemo(() => buildPreviewEditableFields(pendingDraft), [pendingDraft]);
  const manualOverridePayload = useMemo(
    () => buildManualOverridePayload(previewEditableFields, manualFieldValues),
    [manualFieldValues, previewEditableFields],
  );
  const {
    shouldShowInlineLegalConsent,
    confirmPrimaryActionLabel,
    uploadPrimaryActionLabel,
  } = buildInlineLegalConsentState({
    legalGateRequired,
    pendingDraft: Boolean(pendingDraft),
    hasSelectedFile: Boolean(selectedFile),
    activeCaptureMode,
    manualOverrideCount: manualOverridePayload.length,
  });
  const reanalyzeDraftAction = buildReanalyzeDraftActionState({
    pendingDraft: Boolean(pendingDraft),
    hasManualOverrides: manualOverridePayload.length > 0,
  });
  const isPrimaryDocumentActionPending = isProcessingDocument || acceptLegalPackageMutation.isPending;
  const manualOverrideMap = useMemo(
    () => new Map<string, string>(manualOverridePayload.map((item) => [item.key, item.value])),
    [manualOverridePayload],
  );
  const previewPresentTypes = useMemo(() => {
    const nextTypes = new Set(presentTypes);
    const previewTarget = dossierTargets.find((item) => item.type === pendingDraft?.classification.documentType);
    if (previewTarget) {
      nextTypes.add(previewTarget.type);
    }
    return nextTypes;
  }, [pendingDraft, presentTypes]);
  const previewNextTarget = useMemo(
    () => dossierTargets.find((item) => !previewPresentTypes.has(item.type)) ?? null,
    [previewPresentTypes],
  );
  const previewNextDocumentCopy = useMemo(
    () =>
      getPersonalizedNextDocumentCopy({
        nextTarget: previewNextTarget ?? undefined,
        presentTypes: previewPresentTypes,
        opinion: visibleHeliosOpinion,
      }),
    [previewNextTarget, previewPresentTypes, visibleHeliosOpinion],
  );
  const previewConfirmedDisplayEntries = useMemo(() => {
    const entries = previewConfirmedEntries.map(([key, value]) => [key, manualOverrideMap.get(key) ?? value] as [string, unknown]);
    const seenKeys = new Set(entries.map(([key]) => key));

    previewEditableFields.forEach((field) => {
      const overrideValue = manualOverrideMap.get(field.key);
      if (overrideValue && !seenKeys.has(field.key)) {
        entries.unshift([field.key, overrideValue]);
        seenKeys.add(field.key);
      }
    });

    return entries;
  }, [manualOverrideMap, previewConfirmedEntries, previewEditableFields]);
  const previewEstimatedDisplayEntries = useMemo(
    () => previewEstimatedEntries.filter(([key]) => !manualOverrideMap.has(key)),
    [manualOverrideMap, previewEstimatedEntries],
  );
  const displayPreviewStructuredExtraction = useMemo(() => {
    if (!previewStructuredExtraction) {
      return null;
    }

    const editableLabelByKey = new Map(previewEditableFields.map((field) => [field.key, field.label]));
    const existingKeys = new Set<string>();
    const mergedFields = previewStructuredExtraction.fields.map((field) => {
      existingKeys.add(field.key);
      const overrideValue = manualOverrideMap.get(field.key);
      if (!overrideValue) {
        return field;
      }

      return {
        ...field,
        label: editableLabelByKey.get(field.key) ?? field.label,
        value: overrideValue,
        status: "confirmed" as const,
        confidence: "high" as const,
      };
    });

    previewEditableFields.forEach((field) => {
      const overrideValue = manualOverrideMap.get(field.key);
      if (overrideValue && !existingKeys.has(field.key)) {
        mergedFields.unshift({
          key: field.key,
          label: field.label,
          value: overrideValue,
          status: "confirmed",
          confidence: "high",
        });
      }
    });

    const overrideLabels = new Set(manualOverridePayload.map((item) => item.label.trim().toLowerCase()));

    return {
      ...previewStructuredExtraction,
      fields: mergedFields.slice(0, 12),
      missingFields: previewStructuredExtraction.missingFields
        .filter((item) => !overrideLabels.has(item.trim().toLowerCase()))
        .slice(0, 6),
      reviewNotes: manualOverridePayload.length
        ? [
            `Antes de guardar, revisaste manualmente ${manualOverridePayload.length} dato${manualOverridePayload.length === 1 ? "" : "s"} clave.`,
            ...previewStructuredExtraction.reviewNotes,
          ].slice(0, 4)
        : previewStructuredExtraction.reviewNotes,
    };
  }, [manualOverrideMap, manualOverridePayload, previewEditableFields, previewStructuredExtraction]);
  const handleTriggerLegalGateHarnessConflict = () => {
    setLegalGateChecked(true);
    setSubmitError(null);
    setLegalGateMetrics((current) => ({
      attempts: current.attempts + 1,
      retries: current.retries,
      conflicts: current.conflicts + 1,
      lastEvent: "conflict",
      lastUpdatedAt: Date.now(),
    }));
    setLegalGateError(
      buildLegalGateErrorState(
        "Otro proceso está registrando esta aceptación. Protegimos tu expediente para evitar registros duplicados. Espera el temporizador y vuelve a intentarlo.",
        "concurrency",
        0,
        3,
      ),
    );
  };

  const handleAcceptLegalPackage = async ({ isRetry = false }: { isRetry?: boolean } = {}) => {
    if (!caseDetailInput) {
      if (legalGateHarnessMode && isRetry) {
        setLegalGateError(null);
        setSubmitError(null);
        setLegalGateMetrics((current) => ({
          attempts: current.attempts + 1,
          retries: current.retries + 1,
          conflicts: current.conflicts,
          lastEvent: "retry",
          lastUpdatedAt: Date.now(),
        }));
        await Promise.resolve();
        setLegalGateChecked(false);
        setLegalGateMetrics((current) => ({
          ...current,
          lastEvent: "accepted",
          lastUpdatedAt: Date.now(),
        }));
        return true;
      }
      return false;
    }

    if (!legalGateChecked) {
      setLegalGateError(
        buildLegalGateErrorState(
          "Confirma la casilla para registrar tu aceptación y continuar con el expediente.",
          "validation",
        ),
      );
      return false;
    }

    const nextRetryCount = isRetry ? (legalGateError?.retryCount ?? 0) + 1 : 0;

    try {
      setLegalGateError(null);
      setSubmitError(null);
      setLegalGateMetrics((current) => ({
        attempts: current.attempts + (isRetry ? 0 : 1),
        retries: current.retries + (isRetry ? 1 : 0),
        conflicts: current.conflicts,
        lastEvent: isRetry ? "retry" : "attempt",
        lastUpdatedAt: Date.now(),
      }));

      if (isRetry) {
        trackFunnelStep("legal_package_retry_attempt", {
          tenantId: caseDetailInput.tenantId,
          caseId: caseDetailInput.caseId,
          retryCount: nextRetryCount,
          errorType: legalGateError?.type ?? "transient",
        });
      }

      await acceptLegalPackageMutation.mutateAsync({
        ...caseDetailInput,
        accepted: true,
      });
      trackFunnelStep("legal_package_accepted", {
        tenantId: caseDetailInput.tenantId,
        caseId: caseDetailInput.caseId,
        acceptedDocumentsCount: acceptedLegalDocumentsCount + legalPendingDocuments.length,
        retryCount: nextRetryCount,
      });
      setLegalGateChecked(false);
      setLegalGateMetrics((current) => ({
        ...current,
        lastEvent: "accepted",
        lastUpdatedAt: Date.now(),
      }));
      await Promise.all([
        utils.cases.detail.invalidate(caseDetailInput),
        utils.consent.status.invalidate(caseDetailInput),
      ]);
      await caseDetailQuery.refetch();
      return true;
    } catch (error) {
      const resolvedError = resolveLegalGateError(error, nextRetryCount);

      if (resolvedError.type === "concurrency") {
        trackFunnelStep("legal_package_lock_conflict", {
          tenantId: caseDetailInput.tenantId,
          caseId: caseDetailInput.caseId,
          retryCount: nextRetryCount,
        });
      }

      setLegalGateMetrics((current) => ({
        ...current,
        conflicts: current.conflicts + (resolvedError.type === "concurrency" ? 1 : 0),
        lastEvent:
          resolvedError.type === "concurrency"
            ? "conflict"
            : resolvedError.type === "transient"
              ? "transient"
              : "fatal",
        lastUpdatedAt: Date.now(),
      }));
      setLegalGateError(resolvedError);
      return false;
    }
  };

  const canRetryLegalGate =
    Boolean(legalGateError) &&
    (legalGateError?.type === "concurrency" || legalGateError?.type === "transient") &&
    legalGateError.retryCount < MAX_LEGAL_GATE_RETRIES;

  const handleRevalidateSocialSecurity = async () => {
    if (!caseDetailInput) {
      setSubmitError("Primero elige un expediente para revalidar IMSS e Infonavit.");
      return;
    }

    if (legalGateRequired) {
      setLegalGateError(
        buildLegalGateErrorState(
          "Antes de revalidar IMSS e Infonavit, acepta el Aviso de Privacidad y los Términos vigentes del expediente.",
          "validation",
        ),
      );
      return;
    }

    try {
      setSubmitError(null);
      setLegalGateError(null);
      await revalidateSocialSecurityMutation.mutateAsync(caseDetailInput);
      await Promise.all([utils.cases.detail.invalidate(caseDetailInput), caseDetailQuery.refetch()]);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "No fue posible revalidar IMSS e Infonavit en este momento.");
    }
  };

  const handleHeliosCopilotSend = (content: string) => {
    if (!selectedTenantId || !selectedCaseId) {
      setHeliosCopilotMessages((current) =>
        appendHeliosCopilotMessage(current, {
          role: "assistant",
          content: "Primero elige un expediente para que pueda responder con el contexto correcto.",
        }),
      );
      return;
    }

    if (legalGateRequired) {
      setLegalGateError(
        buildLegalGateErrorState(
          "Antes de usar tu asistente laboral, acepta el Aviso de Privacidad y los Términos vigentes del expediente.",
          "validation",
        ),
      );
      setHeliosCopilotMessages((current) =>
        appendHeliosCopilotMessage(current, {
          role: "assistant",
          content: "Antes de abrir tu asistente laboral, acepta primero el Aviso de Privacidad y los Términos vigentes de AuditaPatron para dejar constancia versionada en tu expediente.",
        }),
      );
      return;
    }

    setHeliosCopilotMessages((current) => appendHeliosCopilotMessage(current, { role: "user", content }));
    heliosCopilotMutation.mutate(
      {
        tenantId: selectedTenantId,
        caseId: selectedCaseId,
        prompt: content,
      },
      {
        onSuccess: (response) => {
          setHeliosCopilotMessages((current) => appendHeliosCopilotMessage(current, { role: "assistant", content: response.answer }));
        },
        onError: (error) => {
          setHeliosCopilotMessages((current) =>
            appendHeliosCopilotMessage(current, {
              role: "assistant",
              content:
                error.message ||
                "No pude responder en este momento. Puedes intentarlo otra vez o seguir fortaleciendo tu expediente con más documentos.",
            }),
          );
        },
      },
    );
  };

  const previewStructuredConfirmedFields = useMemo(
    () => (displayPreviewStructuredExtraction?.fields ?? []).filter((field) => field.status === "confirmed"),
    [displayPreviewStructuredExtraction],
  );
  const previewStructuredEstimatedFields = useMemo(
    () => (displayPreviewStructuredExtraction?.fields ?? []).filter((field) => field.status === "estimated"),
    [displayPreviewStructuredExtraction],
  );
  const previewGuardrails = pendingDraft?.preliminaryAnalysis?.guardrails ?? [];
  const dossierHistoryEntries = useMemo<DossierHistoryEntry[]>(() => {
    const documentEntries: DossierHistoryEntry[] = documents.map((document) => ({
      id: `document-${document.documentId}`,
      title: `Subiste ${getSimpleDocumentTypeLabel(document.documentType).toLowerCase()}`,
      description: `${document.originalName} ya quedó ordenado dentro de tu expediente digital.`,
      tag: "Documento agregado",
      category: "document",
      timestamp: document.createdAt,
    }));

    const monitoringEntries: DossierHistoryEntry[] = monitoringDocuments.map((item) => ({
      id: `monitoring-${item.documentId}`,
      title:
        item.status === "received"
          ? "Llegó una actualización automática"
          : item.status === "attention"
            ? "Conviene revisar un seguimiento"
            : "Tu documento sigue avanzando",
      description:
        item.status === "received"
          ? `${item.documentName} ya devolvió una respuesta útil para tu expediente.`
          : item.status === "attention"
            ? `${item.documentName} requiere una revisión con más calma para no perder contexto importante.`
            : `${item.documentName} sigue en revisión y se mantiene protegido dentro de tu expediente.`,
      tag:
        item.status === "received"
          ? "Respuesta recibida"
          : item.status === "attention"
            ? "Seguimiento sensible"
            : "Seguimiento en curso",
      category: "response",
      timestamp: item.respondedAt ?? item.dispatchedAt,
    }));

    const summaryEntries: DossierHistoryEntry[] = visibleHeliosOpinion?.generatedAt
      ? [
          {
            id: "visible-summary",
            title: "Tu resumen del expediente se actualizó",
            description:
              warmVisibleNamingCopy(visibleHeliosOpinion.summary) ??
              "Ya tienes una lectura más clara y útil dentro de tu expediente digital.",
            tag: "Resumen actualizado",
            category: "summary",
            timestamp: visibleHeliosOpinion.generatedAt,
          },
        ]
      : [];

    return [...documentEntries, ...monitoringEntries, ...summaryEntries]
      .sort((left, right) => new Date(right.timestamp ?? 0).getTime() - new Date(left.timestamp ?? 0).getTime())
      .slice(0, 5);
  }, [documents, monitoringDocuments, visibleHeliosOpinion]);
  const filteredDossierHistoryEntries = useMemo(
    () =>
      historyFilter === "all"
        ? dossierHistoryEntries
        : dossierHistoryEntries.filter((entry) => entry.category === historyFilter),
    [dossierHistoryEntries, historyFilter],
  );
  const heliosCopilotHistoryItems = useMemo(() => {
    const recentConversation = heliosCopilotMessages
      .filter((message) => message.role === "user" || message.role === "assistant")
      .slice(-2)
      .map((message, index) => ({
        id: `copilot-${index}-${message.role}`,
        title: message.role === "user" ? "Tu última pregunta al asistente" : "Última respuesta del asistente",
        detail: message.content,
        timestampLabel: "Ahora",
      }));

    const recentDossierEntries = dossierHistoryEntries
      .slice(0, recentConversation.length > 0 ? 2 : 3)
      .map((entry) => ({
        id: entry.id,
        title: entry.title,
        detail: entry.description,
        timestampLabel: entry.timestamp ? formatDate(entry.timestamp) : null,
      }));

    return [...recentConversation, ...recentDossierEntries].slice(0, 3);
  }, [dossierHistoryEntries, heliosCopilotMessages]);
  const selectedComparisonLeft = comparisonDocuments.find((item) => item.documentId === selectedComparisonLeftId);
  const selectedComparisonRight = comparisonDocuments.find((item) => item.documentId === selectedComparisonRightId);
  const activeComparisonPair =
    selectedComparisonLeft &&
    selectedComparisonRight &&
    selectedComparisonLeft.documentId !== selectedComparisonRight.documentId
      ? ([selectedComparisonLeft, selectedComparisonRight] as [ComparisonDocument, ComparisonDocument])
      : automaticComparisonPair;
  const comparisonCopy = buildHeliosComparisonCopy({
    documents,
    nextTarget: dossierStatus.nextTarget,
    opinion: visibleHeliosOpinion,
    selectedPair: activeComparisonPair ?? undefined,
  });
  const comparisonSelectionLocked = comparisonDocuments.length < 2;
  const comparisonSuggestedLabel = automaticComparisonPair
    ? `${automaticComparisonPair[0].originalName} ↔ ${automaticComparisonPair[1].originalName}`
    : null;
  const comparisonAlerts = buildHeliosPriorityAlerts({
    documents,
    attentionCount: attentionMonitoringDocuments.length,
    monitoringDocuments,
    selectedPair: activeComparisonPair,
    nextTarget: dossierStatus.nextTarget,
    opinion: visibleHeliosOpinion,
    newClarityNotification: lastUpload?.newClarityNotification ?? null,
  });
  const comparisonLeftDocument = activeComparisonPair?.[0] ?? null;
  const comparisonRightDocument = activeComparisonPair?.[1] ?? null;

  useEffect(() => {
    const fallbackLeft = automaticComparisonPair?.[0]?.documentId ?? comparisonDocuments[0]?.documentId ?? "";
    const fallbackRight =
      automaticComparisonPair?.[1]?.documentId ??
      comparisonDocuments.find((item) => item.documentId !== fallbackLeft)?.documentId ??
      "";

    setSelectedComparisonLeftId((current) =>
      comparisonDocuments.some((item) => item.documentId === current) ? current : fallbackLeft,
    );
    setSelectedComparisonRightId((current) =>
      comparisonDocuments.some((item) => item.documentId === current && item.documentId !== fallbackLeft)
        ? current
        : fallbackRight,
    );
  }, [automaticComparisonPair, comparisonDocuments]);

  useEffect(() => {
    setEstimatedAcknowledged(false);
  }, [lastUpload, pendingDraft]);

  useEffect(() => {
    if (!pendingDraft) {
      setManualFieldValues({});
      setPreviewStatusFlash(false);
      return;
    }

    setManualFieldValues(Object.fromEntries(buildPreviewEditableFields(pendingDraft).map((field) => [field.key, field.value])));
    setPreviewStatusFlash(true);
    const timeoutId = window.setTimeout(() => setPreviewStatusFlash(false), 1800);
    return () => window.clearTimeout(timeoutId);
  }, [pendingDraft]);

  useEffect(() => {
    if (!pendingDraft || !previewNextTarget) {
      setRecommendedStepFlash(false);
      return;
    }

    recommendedStepRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    setRecommendedStepFlash(true);
    const timeoutId = window.setTimeout(() => setRecommendedStepFlash(false), 2200);
    return () => window.clearTimeout(timeoutId);
  }, [pendingDraft, previewNextTarget]);

  useEffect(() => {
    if (!autoAdvanceFlash) {
      return;
    }

    const timeoutId = window.setTimeout(() => setAutoAdvanceFlash(false), 2400);
    return () => window.clearTimeout(timeoutId);
  }, [autoAdvanceFlash]);

  useEffect(() => {
    if (!lastUpload) {
      setSaveStatusFlash(false);
      return;
    }

    setSaveStatusFlash(true);
    const timeoutId = window.setTimeout(() => setSaveStatusFlash(false), 2200);
    return () => window.clearTimeout(timeoutId);
  }, [lastUpload]);

  useEffect(() => {
    if (!selectedRecommendedTargetType) {
      return;
    }

    const selectedProgress = dossierTypeProgress.find((item) => item.type === selectedRecommendedTargetType);
    if (selectedProgress?.percent === 100) {
      setSelectedRecommendedTargetType(null);
    }
  }, [dossierTypeProgress, selectedRecommendedTargetType]);

  const clearSelectedFile = () => {
    documentSelectionStartedAtRef.current = null;
    setSelectedFile(null);
    setSelectedCaptureMode(null);
    setAutoAnalyzeRequested(false);
    setPendingDraft(null);
    setTextHint("");
    setSubmitError(null);
    setPickerKey((value) => value + 1);
    setUploadSourceOpen(false);
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    const validationMessage = validateDocumentUploadFile(file);

    if (validationMessage) {
      documentSelectionStartedAtRef.current = null;
      setSelectedFile(null);
      setAutoAnalyzeRequested(false);
      setPendingDraft(null);
      setLastUpload(null);
      setSubmitError(validationMessage);
      setPickerKey((value) => value + 1);
      setUploadSourceOpen(false);
      return;
    }

    setSelectedFile(file);
    setAutoAnalyzeRequested(Boolean(file));
    setPendingDraft(null);
    setLastUpload(null);
    if (file) {
      documentSelectionStartedAtRef.current = Date.now();
      trackFunnelStep("document_selected_for_analysis", {
        tenantId: selectedTenantId,
        caseId: selectedCaseId,
        captureMode: selectedCaptureMode ?? preferredCaptureMode ?? "file",
        fileSizeKb: Math.max(1, Math.round(file.size / 1024)),
      });
    } else {
      documentSelectionStartedAtRef.current = null;
    }
    if (file && selectedRecommendedTargetType) {
      setTextHint((current) => current.trim() || getRecommendedDocumentHint(selectedRecommendedTargetType));
    }
    setSubmitError(null);
    setUploadSourceOpen(false);
  };

  const openCameraPicker = () => {
    setPreferredCaptureMode("camera");
    setSelectedCaptureMode("camera");
    cameraInputRef.current?.click();
  };

  const openFilePicker = () => {
    setPreferredCaptureMode("file");
    setSelectedCaptureMode("file");
    fileInputRef.current?.click();
  };

  const openPreferredPicker = () => {
    if (activeCaptureMode === "camera") {
      openCameraPicker();
      return;
    }

    openFilePicker();
  };

  const handleCaptureModeSelection = (
    mode: AuditarCaptureMode,
    surface: "compact_mobile_toggle" | "preference_panel",
  ) => {
    setPreferredCaptureMode(mode);
    setSelectedCaptureMode(mode);
    trackFunnelStep("upload_mode_selected", {
      tenantId: selectedTenantId,
      caseId: selectedCaseId,
      mode,
      context: shouldCompactMobileUploadEntry ? "first_upload" : "subsequent_upload",
      surface,
    });
  };

  const focusRecommendedUpload = (targetType?: DossierTarget["type"] | null) => {
    const resolvedTargetType = targetType ?? effectiveRecommendedTarget?.type ?? dossierStatus.nextTarget?.type ?? null;

    if (resolvedTargetType) {
      setSelectedRecommendedTargetType(resolvedTargetType);
      setTextHint((current) => current.trim() || getRecommendedDocumentHint(resolvedTargetType));
    }

    setSubmitError(null);
    uploadSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

    if (selectedFile) {
      return;
    }

    openPreferredPicker();
  };

  const restartPreviewFlow = () => {
    trackFunnelStep("document_reanalysis_requested", {
      tenantId: selectedTenantId,
      caseId: selectedCaseId,
      documentType: pendingDraft?.classification.documentType,
      hadManualOverrides: manualOverridePayload.length > 0,
    });
    documentSelectionStartedAtRef.current = null;
    setPendingDraft(null);
    setManualFieldValues({});
    setSelectedFile(null);
    setSelectedCaptureMode(null);
    setAutoAnalyzeRequested(false);
    setSubmitError(null);
    setPickerKey((value) => value + 1);

    openPreferredPicker();
  };

  const handleManualFieldChange = (key: string, value: string) => {
    setManualFieldValues((current) => ({
      ...current,
      [key]: value,
    }));
    setSubmitError(null);
  };

  const handleUpload = async () => {
    setAutoAnalyzeRequested(false);

    if (!selectedTenantId || !selectedCaseId || !selectedFile) {
      setSubmitError("Selecciona un expediente y un archivo antes de continuar.");
      return;
    }

    if (legalGateRequired) {
      const accepted = await handleAcceptLegalPackage();
      if (!accepted) {
        setSubmitError("Acepta primero el Aviso de Privacidad y los Términos vigentes para continuar.");
        return;
      }
    }

    try {
      setSubmitError(null);
      const base64Content = await fileToBase64(selectedFile);
      const result = await analyzeDraftMutation.mutateAsync({
        tenantId: selectedTenantId,
        caseId: selectedCaseId,
        fileName: selectedFile.name,
        mimeType: selectedFile.type || "application/octet-stream",
        base64Content,
        textHint: textHint || undefined,
        expectedDocumentType: selectedRecommendedTargetType ?? undefined,
        captureMode: selectedCaptureMode ?? preferredCaptureMode ?? undefined,
        sourceChannel: "manual",
      });

      setPendingDraft(result as DraftPreviewResultView);
      const selectionToDraftSeconds =
        documentSelectionStartedAtRef.current === null
          ? undefined
          : Math.max(0, Math.round((Date.now() - documentSelectionStartedAtRef.current) / 1000));
      trackFunnelStep("document_draft_analyzed", {
        tenantId: selectedTenantId,
        caseId: selectedCaseId,
        documentType: result.classification.documentType,
        captureMode: selectedCaptureMode ?? preferredCaptureMode ?? null,
        selectionToDraftSeconds,
      });
      setLastUpload(null);
      setSelectedFile(null);
      setSelectedCaptureMode(null);
      setTextHint("");
      setPickerKey((value) => value + 1);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "No fue posible analizar el archivo.");
    }
  };

  useEffect(() => {
    const shouldStartAutoAnalysis = shouldAutoAnalyzeSelectedFile({
      autoAnalyzeRequested,
      hasSelectedFile: Boolean(selectedFile),
      pendingDraft: Boolean(pendingDraft),
      legalGateRequired,
      hasSelectedTenant: Boolean(selectedTenantId),
      hasSelectedCase: Boolean(selectedCaseId),
      analyzePending: analyzeDraftMutation.isPending,
      confirmPending: confirmDraftMutation.isPending,
    });

    if (!shouldStartAutoAnalysis) {
      return;
    }

    setAutoAnalyzeRequested(false);
    setAutoAdvanceFlash(true);
    void handleUpload();
  }, [
    autoAnalyzeRequested,
    confirmDraftMutation.isPending,
    legalGateRequired,
    pendingDraft,
    selectedCaseId,
    selectedFile,
    selectedTenantId,
    analyzeDraftMutation.isPending,
  ]);

  const handleConfirmDraft = async () => {
    if (!selectedTenantId || !selectedCaseId || !pendingDraft) {
      setSubmitError("Primero analiza un documento para revisarlo antes de guardarlo.");
      return;
    }

    if (legalGateRequired) {
      const accepted = await handleAcceptLegalPackage();
      if (!accepted) {
        setSubmitError("Acepta primero el Aviso de Privacidad y los Términos vigentes para continuar.");
        return;
      }
    }

    try {
      setSubmitError(null);
      const result = await confirmDraftMutation.mutateAsync({
        tenantId: selectedTenantId,
        caseId: selectedCaseId,
        draftId: pendingDraft.draftId,
        visibility: "tenant_legal",
        consentStatus: "pending",
        sourceChannel: "manual",
        manualOverrides: manualOverridePayload,
      });

      setLastUpload(result as ConfirmedUploadResultView);
      const selectionToConfirmedSeconds =
        documentSelectionStartedAtRef.current === null
          ? undefined
          : Math.max(0, Math.round((Date.now() - documentSelectionStartedAtRef.current) / 1000));
      trackFunnelStep("document_draft_confirmed", {
        tenantId: selectedTenantId,
        caseId: selectedCaseId,
        documentType: result.classification.documentType,
        captureMode: pendingDraft.previewAsset.captureMode,
        hadManualOverrides: manualOverridePayload.length > 0,
        selectionToConfirmedSeconds,
      });
      trackFunnelStep("document_uploaded", {
        tenantId: selectedTenantId,
        caseId: selectedCaseId,
        documentType: result.classification.documentType,
        captureMode: pendingDraft.previewAsset.captureMode,
        sourceChannel: "manual",
        hadManualOverrides: manualOverridePayload.length > 0,
        selectionToConfirmedSeconds,
      });
      documentSelectionStartedAtRef.current = null;
      setPendingDraft(null);
      setManualFieldValues({});
      setSelectedFile(null);
      setSelectedCaptureMode(null);
      setTextHint("");
      setPickerKey((value) => value + 1);

      await Promise.all([
        utils.cases.list.invalidate({ tenantId: selectedTenantId }),
        utils.cases.detail.invalidate({ tenantId: selectedTenantId, caseId: selectedCaseId }),
      ]);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "No fue posible guardar el documento.");
    }
  };

  if (auth.loading) {
    return (
      <main className="audita-auditar min-h-screen bg-slate-50 px-4 py-12 text-slate-950">
        <div className="container mx-auto max-w-6xl">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
            <div className="flex items-center gap-3">
              <AuditaPatronLogoIcon className="sm:hidden" imageClassName="h-10 w-10 object-contain" />
              <AuditaPatronLogoWordmark
                className="hidden sm:inline-flex"
                imageClassName="max-w-[240px]"
                subtitleClassName="text-[0.82rem] tracking-[0.14em] sm:text-[0.92rem]"
              />
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-slate-950">Preparando tu espacio de revisión...</h1>
          </div>
        </div>
      </main>
    );
  }

  if (!auth.isAuthenticated && !legalGateHarnessMode) {
    return (
      <main className="audita-auditar min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(20,184,166,0.12),_transparent_35%),linear-gradient(180deg,_#f8fafc_0%,_#ffffff_100%)] px-4 py-10 text-slate-950">
        <div className="container mx-auto max-w-6xl">
          <div className="rounded-[1.5rem] border border-slate-900 bg-slate-950 px-4 py-4 text-white shadow-[0_20px_50px_-34px_rgba(2,6,23,0.7)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <a href="/" className="inline-flex items-center gap-2 text-sm font-medium text-slate-300 transition hover:text-white">
                <ArrowLeft className="h-4 w-4" strokeWidth={1.8} />
                Volver al inicio
              </a>
              <span className="rounded-full bg-white/10 px-3 py-2 text-xs font-semibold text-white">
                Revisión guiada
              </span>
            </div>
          </div>

          <div className="mt-5 grid gap-6 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_35px_100px_-60px_rgba(15,23,42,0.45)] lg:grid-cols-[1fr_0.9fr] lg:p-8">
            <div className="mx-auto max-w-2xl text-center lg:mx-0 lg:text-left">
              <AuditaPatronLogo className="inline-flex" imageClassName="h-auto w-full max-w-[320px] object-contain sm:max-w-[388px] lg:max-w-[430px]" />
              <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-teal-100 bg-teal-50 px-4 py-2 text-sm font-medium text-teal-800">
                <ShieldCheck className="h-4 w-4" strokeWidth={1.8} />
                Hecho para trabajadores, sin lenguaje complicado
              </div>
              <h1 className="mt-5 text-3xl font-semibold tracking-[-0.05em] text-slate-950 sm:text-4xl">
                Tus derechos laborales, claros y protegidos
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
                AuditaPatron recibe tu documento, lo analiza, lo resguarda y te devuelve resultados útiles. Además, aquí podrás revisar con más claridad señales sobre IMSS e Infonavit sin pasos confusos.
              </p>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center lg:justify-start">
                <Button
                  className="h-12 rounded-full bg-teal-600 px-7 text-base text-white hover:bg-teal-700"
                  onClick={() => {
                    trackFunnelStep("auditar_login_clicked", {
                      source: "auditar_guard",
                    });
                    window.location.href = getLoginUrl();
                  }}
                >
                  Auditar mis documentos
                  <ArrowRight className="ml-2 h-4 w-4" strokeWidth={1.8} />
                </Button>
                <Button
                  variant="outline"
                  className="h-12 rounded-full border-slate-200 bg-white px-7 text-base text-slate-700 hover:bg-slate-50"
                  onClick={() => {
                    window.location.href = "/";
                  }}
                >
                  Ver primero cómo funciona
                </Button>
              </div>
            </div>

            <div className="mx-auto w-full max-w-xl rounded-[1.6rem] border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">Qué verás aquí</p>
              <div className="mt-4 space-y-3">
                {[
                  "Ve rápido cómo va creciendo tu expediente.",
                  "Sube documentos y deja que AuditaPatron los procese.",
                  "Distingue lo confirmado de lo estimado, incluyendo señales de IMSS e Infonavit.",
                ].map((item) => (
                  <div key={item} className="flex gap-3 rounded-[1.1rem] border border-white bg-white p-3.5">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-teal-700" strokeWidth={1.8} />
                    <p className="text-sm leading-6 text-slate-700">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
      <main className="audita-auditar min-h-screen bg-slate-50 px-4 py-6 pb-28 text-slate-950 sm:py-8 sm:pb-10">

      <div className="container mx-auto max-w-6xl">
        {auth.canToggleUserView && auth.isViewingAsUser ? (
          <Alert className="mb-6 border-amber-200 bg-amber-50/95 text-amber-950 shadow-sm">
            <AlertCircle className="h-4 w-4 text-amber-700" />
            <AlertTitle>Estás viendo la plataforma como usuario normal</AlertTitle>
            <AlertDescription className="mt-2 space-y-3 text-sm leading-6 text-amber-900">
              <p>
                Tu identidad real como <strong>CEO maestro</strong> sigue intacta. Esta vista sólo oculta la consola ejecutiva para que puedas hacer muestras con el mismo recorrido que vería un usuario estándar.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  className="rounded-full border-amber-300 bg-white text-amber-900 hover:bg-amber-100"
                  onClick={() => {
                    auth.exitUserView();
                    window.location.href = "/ceo";
                  }}
                >
                  <ShieldCheck className="mr-2 h-4 w-4" strokeWidth={1.8} />
                  Salir de la demo y volver al CEO
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        ) : null}
        <div className="rounded-[1.8rem] border border-slate-900 bg-slate-950 px-5 py-5 text-center text-white shadow-[0_24px_70px_-42px_rgba(2,6,23,0.82)] sm:flex sm:items-center sm:justify-between sm:text-left">
          <div>
            <a href="/" className="inline-flex items-center gap-2 text-sm font-medium text-slate-300 transition hover:text-white">
              <ArrowLeft className="h-4 w-4" strokeWidth={1.8} />
              Volver al inicio
            </a>
            <div className="mt-4 flex items-center justify-center gap-3 sm:justify-start">
              <AuditaPatronLogoIcon surface="dark" className="sm:hidden" imageClassName="h-11 w-11 object-contain" />
              <AuditaPatronLogoWordmark
                surface="dark"
                className="hidden max-w-full sm:inline-flex"
                imageClassName="h-auto w-auto max-w-[290px] object-contain"
                subtitleClassName="text-[0.82rem] tracking-[0.15em] sm:text-[0.92rem]"
              />
            </div>
            <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-teal-300">Tu revisión</p>

            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
              Sube tu documento y entiende rápido qué pasa con tu expediente.
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">
              Sube primero el archivo. Enseguida te devolvemos qué entendimos, qué hallazgo pesa más y cuál es el siguiente soporte que más te conviene revisar.
            </p>
            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-medium text-slate-200">
              <ShieldCheck className="h-3.5 w-3.5 text-teal-300" strokeWidth={1.8} />
              Resguardo y lectura preliminar en el mismo flujo
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-left sm:justify-start">
              <span className="inline-flex items-center gap-2 rounded-full border border-teal-400/20 bg-teal-400/10 px-3 py-1.5 text-[11px] font-medium text-teal-100">
                <Lock className="h-3.5 w-3.5" strokeWidth={1.8} />
                Tus documentos viajan protegidos
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-medium text-slate-200">
                <ShieldCheck className="h-3.5 w-3.5 text-teal-300" strokeWidth={1.8} />
                Solo se usan para tu auditoría
              </span>
            </div>

          </div>

          <div className="mt-4 flex flex-col items-stretch gap-2 sm:mt-0 sm:flex-wrap sm:items-center sm:justify-end">
            <Button
              variant="outline"
              className="hidden rounded-full border-teal-300/40 bg-teal-400/15 text-white hover:bg-teal-400/25 sm:inline-flex"
              onClick={() => {
                void handleRevalidateSocialSecurity();
              }}
              disabled={!caseDetailInput || revalidateSocialSecurityMutation.isPending}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${revalidateSocialSecurityMutation.isPending ? "animate-spin" : ""}`} strokeWidth={1.8} />
              {revalidateSocialSecurityMutation.isPending ? "Revalidando cruce..." : "Revalidar IMSS e Infonavit"}
            </Button>
            <Button
              variant="ghost"
              className="rounded-full border border-white/10 bg-white/5 px-3 text-slate-100 hover:bg-white/10 hover:text-white"
              onClick={() => {
                setMobileOnboardingIndex(0);
                uploadSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            >
              Ir directo a la guía
            </Button>
            <span className="text-[11px] font-medium text-slate-300">
              {remoteViewStateSyncLabel}
            </span>
          </div>
        </div>

        {bootstrapMutation.isPending ? (
          <div className="mt-8 rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-600">Estamos preparando tu espacio y la base inicial de tu expediente...</p>
          </div>
        ) : null}

        {bootstrapMutation.isError ? (
          <div className="mt-8 rounded-[1.75rem] border border-amber-200 bg-amber-50 p-6 text-amber-950">
            <p className="font-semibold">No fue posible preparar tu espacio de revisión.</p>
            <p className="mt-2 text-sm leading-7">{bootstrapMutation.error.message}</p>
            <Button
              className="mt-4 rounded-full bg-amber-500 text-slate-950 hover:bg-amber-400"
              onClick={() => {
                setBootstrapStarted(false);
              }}
            >
              Reintentar preparación
            </Button>
          </div>
        ) : null}

        {legalGateHarnessMode ? (
          <section className="mt-6 rounded-[1.75rem] border border-dashed border-amber-300 bg-amber-50/70 p-5 shadow-sm" data-testid="legal-gate-harness">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.14em] text-amber-900">Modo de prueba del gate legal</p>
                <p className="mt-2 text-sm leading-6 text-amber-950">
                  Simula un conflicto controlado del lock para validar en navegador el temporizador, las métricas visibles y el reintento.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                className="border-amber-300 bg-white text-amber-950 hover:bg-amber-100"
                onClick={handleTriggerLegalGateHarnessConflict}
                data-testid="legal-gate-harness-trigger"
              >
                Simular conflicto del lock
              </Button>

            </div>
          </section>
        ) : null}

        {legalGateRequired || legalGateHarnessMode ? (
          <section className="mt-6 rounded-[1.5rem] border border-amber-200/80 bg-gradient-to-br from-amber-50 via-white to-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-3xl">
                <div className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-900">
                  <Lock className="h-4 w-4" strokeWidth={1.8} />
                  Autorización legal pendiente
                </div>
                <h2 className="mt-3 text-lg font-semibold tracking-[-0.03em] text-slate-950">La confirmación aparece justo cuando envías o guardas tu archivo.</h2>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  No interrumpe tu flujo antes de tiempo. Solo protege el expediente y deja registro versionado en la acción principal.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 font-semibold text-slate-900 underline decoration-slate-300 underline-offset-4 transition hover:text-slate-700"
                    onClick={() => setLegalDocumentsDrawerOpen(true)}
                  >
                    Revisar aviso y términos vigentes
                    <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
                  </button>
                  <span className="text-slate-500">Versión vigente {legalAcceptance?.legalVersion ?? LEGAL_VERSION}</span>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[21rem]">
                <div className="rounded-[1.1rem] border border-white bg-white/90 px-4 py-3 text-sm text-slate-700">
                  <p className="font-semibold text-slate-950">Cobertura legal</p>
                  <p className="mt-2">{acceptedLegalDocumentsCount} de {legalAcceptanceDocuments.length || LEGAL_DOCUMENTS.length} documentos aceptados en esta versión.</p>
                  <p className="mt-2 text-xs leading-5 text-slate-500">La aceptación se registra cuando confirmas la acción principal de este expediente.</p>
                </div>
                <div className="rounded-[1.1rem] border border-white bg-white/90 px-4 py-3 text-sm text-slate-700" data-testid="legal-gate-lock-metrics">
                  <p className="font-semibold text-slate-950">Estado del resguardo</p>
                  <div className="mt-3 grid grid-cols-3 gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Intentos</p>
                      <p className="mt-1 text-lg font-semibold text-slate-950" data-testid="legal-gate-metric-attempts">{legalGateMetrics.attempts}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Conflictos</p>
                      <p className="mt-1 text-lg font-semibold text-slate-950" data-testid="legal-gate-metric-conflicts">{legalGateMetrics.conflicts}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Reintentos</p>
                      <p className="mt-1 text-lg font-semibold text-slate-950" data-testid="legal-gate-metric-retries">{legalGateMetrics.retries}</p>
                    </div>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-slate-600" data-testid="legal-gate-metric-status">
                    Estado actual: {describeLegalGateMetricEvent(legalGateMetrics.lastEvent)}
                    {legalGateMetrics.lastUpdatedAt
                      ? ` · Última actualización ${new Date(legalGateMetrics.lastUpdatedAt).toLocaleTimeString("es-MX", {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}`
                      : ""}
                  </p>
                  {legalGateRetryCountdown > 0 ? (
                    <p className="mt-2 text-xs font-semibold text-amber-900" data-testid="legal-gate-metric-timer">Temporizador de reintento activo: {legalGateRetryCountdown}s</p>
                  ) : null}
                </div>
              </div>
            </div>
          </section>
        ) : null}

        <Drawer open={legalDocumentsDrawerOpen} onOpenChange={setLegalDocumentsDrawerOpen}>
          <DrawerContent>
            <DrawerHeader className="text-left">
              <DrawerTitle>Documentos legales vigentes de tu expediente</DrawerTitle>
              <DrawerDescription>
                Revísalos con calma. La aceptación se registra únicamente cuando confirmas la acción principal de analizar o guardar dentro de este expediente.
              </DrawerDescription>
            </DrawerHeader>
            <div className="space-y-3 px-4 pb-2">
              {LEGAL_DOCUMENTS.map((document) => {
                const status = legalAcceptanceDocuments.find((item) => item.slug === document.slug);
                const accepted = status?.accepted ?? false;
                return (
                  <div key={document.slug} className="rounded-[1.1rem] border border-slate-200 bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-950">{document.fullTitle}</p>
                        <p className="mt-1 text-sm leading-6 text-slate-600">Versión {document.version} · Vigencia {document.effectiveDate}</p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${accepted ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-900"}`}>
                        {accepted ? "Aceptado" : "Pendiente"}
                      </span>
                    </div>
                    <a href={document.route} className="mt-3 inline-flex text-sm font-semibold text-slate-900 underline underline-offset-4">
                      Abrir documento completo
                    </a>
                  </div>
                );
              })}
            </div>
            <DrawerFooter>
              <DrawerClose asChild>
                <Button variant="outline" className="rounded-2xl border-slate-200 bg-white text-slate-700 hover:bg-slate-50">
                  Cerrar
                </Button>
              </DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>

        <div className="mt-6 grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
          <section className="space-y-6">
            <div className="rounded-[1.7rem] border border-teal-100 bg-[radial-gradient(circle_at_top_left,_rgba(45,212,191,0.14),_transparent_35%),linear-gradient(180deg,_#ffffff_0%,_#f0fdfa_100%)] p-5 shadow-sm sm:p-6">
              <div className="grid gap-4 xl:grid-cols-[1.22fr_0.78fr] xl:items-start">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-800 shadow-sm">
                    Empieza aquí
                  </div>
                  <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-[2rem]">
                    Sube un archivo y recibe una lectura útil sin pasos extra.
                  </h2>
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-700 sm:text-base">
                    Apenas eliges el documento, inicia la revisión preliminar y te devolvemos tres cosas: qué entendimos, qué hallazgo pesa más y qué archivo conviene después.
                  </p>
                  <div className="mt-4 grid gap-2 sm:grid-cols-3">
                    <article className="rounded-[1rem] border border-teal-100 bg-white/95 px-3 py-2 text-sm text-slate-700 shadow-sm">
                      <p className="font-semibold text-slate-950">Privacidad activa</p>
                      <p className="mt-1 text-xs leading-5 text-slate-600">Tus datos se usan solo dentro de esta auditoría.</p>
                    </article>
                    <article className="rounded-[1rem] border border-teal-100 bg-white/95 px-3 py-2 text-sm text-slate-700 shadow-sm">
                      <p className="font-semibold text-slate-950">Control total</p>
                      <p className="mt-1 text-xs leading-5 text-slate-600">Primero ves el borrador y luego decides si lo guardas.</p>
                    </article>
                    <article className="rounded-[1rem] border border-teal-100 bg-white/95 px-3 py-2 text-sm text-slate-700 shadow-sm">
                      <p className="font-semibold text-slate-950">Siguiente paso claro</p>
                      <p className="mt-1 text-xs leading-5 text-slate-600">Después de subirlo te diremos exactamente qué sigue.</p>
                    </article>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <article className="rounded-[1.1rem] border border-white bg-white/90 p-3 shadow-sm">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Recibes</p>
                      <p className="mt-2 text-sm font-semibold text-slate-950">Lectura inicial clara</p>
                    </article>
                    <article className="rounded-[1.1rem] border border-white bg-white/90 p-3 shadow-sm">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Se guarda</p>
                      <p className="mt-2 text-sm font-semibold text-slate-950">Dentro de tu expediente</p>
                    </article>
                    <article className="rounded-[1.1rem] border border-white bg-white/90 p-3 shadow-sm">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Siguiente paso</p>
                      <p className="mt-2 text-sm font-semibold text-slate-950">Documento recomendado</p>
                    </article>
                  </div>

                  {selectedRecommendedTargetType && effectiveRecommendedTarget ? (
                    <div className="mt-4 rounded-[1.15rem] border border-sky-100 bg-sky-50 px-4 py-3 text-sm leading-6 text-sky-950">
                      Hoy conviene empezar por <strong>{effectiveRecommendedTarget.label.toLowerCase()}</strong> para fortalecer más rápido la siguiente lectura.
                    </div>
                  ) : null}

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <Button
                      className="h-12 rounded-2xl bg-slate-950 text-white hover:bg-slate-900"
                      onClick={openPreferredPicker}
                    >
                      {selectedFile
                        ? "Cambiar documento"
                        : activeCaptureMode === "camera"
                          ? "Tomar foto y empezar"
                          : "Elegir documento y continuar"}
                    </Button>
                    <Button
                      variant="outline"
                      className="h-12 rounded-2xl border-teal-200 bg-white text-teal-900 hover:bg-teal-50"
                      onClick={() => {
                        handleCaptureModeSelection(activeCaptureMode === "camera" ? "file" : "camera", "compact_mobile_toggle");
                      }}
                    >
                      {activeCaptureMode === "camera" ? "Prefiero elegir archivo" : "Prefiero usar la cámara"}
                    </Button>
                  </div>
                </div>

                <div className="hidden gap-3 sm:grid">
                  <article className="rounded-[1.25rem] border border-white bg-white/90 p-4 shadow-sm">
                    <p className="text-sm font-semibold text-slate-950">Qué pasa con tu archivo</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      Se resguarda dentro del expediente y alimenta la comparación progresiva con el resto de tus piezas.
                    </p>
                  </article>
                  <article className="rounded-[1.25rem] border border-white bg-white/90 p-4 shadow-sm">
                    <p className="text-sm font-semibold text-slate-950">Cómo seguir después</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      Si ya lo tienes listo, súbelo ahora. Si dudas, la sugerencia activa te marca el siguiente documento útil.
                    </p>
                  </article>
                </div>
              </div>
            </div>

            <div className="hidden motion-hover-lift rounded-[1.65rem] border border-slate-200 bg-white p-5 shadow-sm sm:block sm:p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">Así va tu expediente laboral</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950">
                    Hoy tu expediente laboral va en: {heliosExpediente?.stageLabel ?? dossierStatus.label}
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                    Ya tienes {documents.length} documento{documents.length === 1 ? "" : "s"} cargado{documents.length === 1 ? "" : "s"}, {dossierStatus.completed} de {dossierStatus.total} tipos útiles y un indicador vivo que se ajusta con señales reales del expediente. La siguiente mejor acción es simple: {selectedFile ? "confirma el archivo que acabas de elegir y súbelo para actualizar el expediente" : `${uploadPrimaryActionLabel.toLowerCase()} para mejorar la lectura del caso ahora mismo`}. {socialSecuritySummary} {heliosExpediente?.summary ?? "Cada archivo que subes se integra a una lectura progresiva del caso y queda resguardado dentro de tu expediente."}
                  </p>
                </div>

                <div className="motion-hover-lift w-full rounded-[1.5rem] border border-teal-100 bg-teal-50 p-4 sm:max-w-sm">
                  <p className="text-sm font-semibold text-teal-900">Cruce IMSS e Infonavit hoy</p>
                  <p className="mt-2 text-base font-semibold text-slate-950">{socialSecurityStatusLabel}</p>
                  <p className="mt-2 text-sm leading-6 text-teal-950">{socialSecurityRecommendedNextStep}</p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-teal-900">
                    <span className="rounded-full bg-white px-3 py-1">
                      {socialSecurityValidation?.imssDocumentsCount ?? 0} señal{(socialSecurityValidation?.imssDocumentsCount ?? 0) === 1 ? "" : "es"} IMSS
                    </span>
                    <span className="rounded-full bg-white px-3 py-1">
                      {socialSecurityValidation?.infonavitSignalsCount ?? 0} señal{(socialSecurityValidation?.infonavitSignalsCount ?? 0) === 1 ? "" : "es"} Infonavit
                    </span>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-teal-900">{socialSecurityLastCheckLabel}</p>
                </div>
              </div>

              <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-gradient-to-r from-teal-500 to-cyan-500" style={{ width: `${socialSecurityCoveragePercent}%` }} />
              </div>
              <div className="mt-2 flex items-center justify-between text-xs font-semibold text-slate-500">
                <span>Claridad actual del expediente</span>
                <span>{socialSecurityCoveragePercent}%</span>
              </div>

              <div className="mt-4 flex flex-col gap-3 rounded-[1.35rem] border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Siguiente paso recomendado</p>
                  <p className="mt-2 text-base font-semibold text-slate-950">
                    {selectedFile ? "Ya elegiste un archivo: sólo falta subirlo para reflejarlo en el expediente." : uploadPrimaryActionLabel}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    Prioriza un documento con mayor contexto antes de revisar módulos secundarios. El expediente se vuelve más útil en cuanto entra la siguiente pieza clave.
                  </p>
                </div>
                <div className="rounded-full bg-teal-50 px-4 py-2 text-sm font-semibold text-teal-900">
                  Acción principal primero
                </div>
              </div>

              <div className="mt-6 grid gap-3 md:grid-cols-2">
                {dossierTargets.map((item) => {
                  const progress = dossierTypeProgress.find((entry) => entry.type === item.type);
                  const isSelectedRecommendation = item.type === selectedRecommendedTargetType;

                  return (
                    <article
                      key={item.type}
                      className={`rounded-[1.25rem] border p-4 ${
                        isSelectedRecommendation ? "border-teal-200 bg-teal-50" : "border-slate-200 bg-slate-50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-semibold text-slate-900">{item.label}</p>
                          <p className="mt-1 text-sm leading-6 text-slate-600">{item.description}</p>
                        </div>
                        <div className="text-right">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${
                              (progress?.percent ?? 0) === 100
                                ? "bg-emerald-100 text-emerald-700"
                                : (progress?.percent ?? 0) > 0
                                  ? "bg-teal-100 text-teal-800"
                                  : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {progress?.percent ?? 0}%
                          </span>
                          <p className="mt-2 text-xs font-medium text-slate-500">{progress?.coverageLabel}</p>
                        </div>
                      </div>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
                        <div
                          className={`h-full rounded-full ${
                            (progress?.percent ?? 0) === 100
                              ? "bg-emerald-500"
                              : (progress?.percent ?? 0) > 0
                                ? "bg-teal-500"
                                : "bg-slate-300"
                          }`}
                          style={{ width: `${progress?.percent ?? 0}%` }}
                        />
                      </div>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-700">
                        <p className="leading-6">{progress?.supportingCopy ?? item.benefit}</p>
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                          {progress?.count ?? 0}/{progress?.targetCount ?? item.suggestedCount} pieza{(progress?.targetCount ?? item.suggestedCount) === 1 ? "" : "s"} clave
                        </span>
                      </div>
                    </article>
                  );
                })}
              </div>

              <div className="mt-5 rounded-[1.45rem] border border-slate-200 bg-slate-50 p-4 sm:p-5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">Documentos que más enriquecen tu expediente laboral</p>
                    <h3 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-slate-950">
                      Si vas a subir algo más, empieza por los archivos con más contexto.
                    </h3>
                  </div>
                  <p className="max-w-xl text-sm leading-6 text-slate-600">
                    Estos suelen ser de los documentos más útiles para darte una lectura más completa y dejar tu expediente mejor respaldado con el tiempo.
                  </p>
                </div>

                <div className="mt-4 flex flex-col gap-2 rounded-[1rem] border border-slate-200 bg-white/70 p-4 text-sm leading-6 text-slate-700 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-semibold text-slate-950">
                      {missingPriorityUploadGuides.length > 0
                        ? `Hoy te conviene reforzar ${missingPriorityUploadGuides.length} tipo${missingPriorityUploadGuides.length === 1 ? "" : "s"} de documento.`
                        : "Tu expediente ya cubre los documentos más estratégicos de esta guía."}
                    </p>
                    <p className="mt-1">
                      {missingPriorityUploadGuides.length > 0
                        ? "Estas recomendaciones ya están ligadas a lo que todavía hace falta dentro de tu expediente, para que no subas archivos de más ni repitas esfuerzos."
                        : "Si tienes más evidencia específica de tu caso, también puede ayudar a afinar todavía más la lectura y el respaldo de tu expediente."}
                    </p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                    {missingPriorityUploadGuides.length > 0 ? "Faltantes reales detectados" : "Base prioritaria cubierta"}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 xl:grid-cols-2">
                  {visiblePriorityUploadGuides.map((item) => {
                    const isPresent = presentTypes.has(item.type);
                    const isFocused = item.type === selectedRecommendedTargetType;
                    return (
                      <article
                        key={item.type}
                        className={`rounded-[1.2rem] border bg-white p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm ${
                          isFocused ? "border-teal-200 shadow-sm" : "border-white"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-700">Alta utilidad para tu expediente</p>
                            <p className="mt-2 font-semibold text-slate-950">{item.title}</p>
                          </div>
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${
                              isPresent ? "bg-emerald-100 text-emerald-700" : isFocused ? "bg-teal-100 text-teal-800" : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {isPresent ? "Ya lo tienes" : isFocused ? "Enfocado ahora" : "Te falta y conviene subirlo"}
                          </span>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-slate-600">{item.summary}</p>
                        <div className="mt-3 rounded-[1rem] border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-700">
                          {item.value}
                        </div>
                        <Button
                          variant="outline"
                          className="mt-4 h-11 w-full rounded-full border-teal-200 bg-teal-50 text-teal-900 hover:bg-teal-100"
                          onClick={() => focusRecommendedUpload(item.type)}
                        >
                          Subir este documento
                          <ArrowRight className="ml-2 h-4 w-4" strokeWidth={1.8} />
                        </Button>
                      </article>
                    );
                  })}
                </div>
              </div>

              <div
                className={`mt-5 rounded-[1.45rem] border p-4 sm:p-5 ${
                  heliosStage.tone === "success"
                    ? "border-emerald-100 bg-emerald-50"
                    : heliosStage.tone === "processing"
                      ? "border-sky-200 bg-sky-50"
                      : heliosStage.tone === "warning"
                        ? "border-amber-200 bg-amber-50"
                        : "border-teal-100 bg-teal-50"
                }`}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex items-start gap-3">
                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
                        heliosStage.tone === "success"
                          ? "bg-white text-emerald-700"
                          : heliosStage.tone === "processing"
                            ? "bg-white text-sky-700"
                            : heliosStage.tone === "warning"
                              ? "bg-white text-amber-700"
                              : "bg-white text-teal-700"
                      }`}
                    >
                      {heliosStage.tone === "success" ? (
                        <Sparkles className="h-5 w-5" strokeWidth={1.8} />
                      ) : heliosStage.tone === "processing" ? (
                        <RefreshCw className="h-5 w-5" strokeWidth={1.8} />
                      ) : heliosStage.tone === "warning" ? (
                        <AlertCircle className="h-5 w-5" strokeWidth={1.8} />
                      ) : (
                        <ShieldCheck className="h-5 w-5" strokeWidth={1.8} />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Estado de tu expediente laboral</p>
                      <h3 className="mt-2 text-xl font-semibold text-slate-950">
                        {heliosExpediente?.stageLabel ? `${heliosStage.title} · ${heliosExpediente.stageLabel}` : heliosStage.title}
                      </h3>
                      <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-700">{heliosExpediente?.summary ?? heliosStage.description}</p>
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      heliosStage.tone === "success"
                        ? "bg-emerald-100 text-emerald-800"
                        : heliosStage.tone === "processing"
                          ? "bg-sky-100 text-sky-800"
                          : heliosStage.tone === "warning"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-white text-teal-800"
                    }`}
                  >
                    {heliosStage.badge}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <div className="rounded-[1.15rem] border border-white/80 bg-white/85 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Qué está pasando ahora</p>
                    <p className="mt-2 font-semibold text-slate-950">Tu expediente se ordena, resguarda y revisa por ti</p>
                    <p className="mt-2 text-sm leading-6 text-slate-700">{heliosStage.detail}</p>
                  </div>

                  <div className="rounded-[1.15rem] border border-white/80 bg-white/85 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Tipo de revisión</p>
                    <p className="mt-2 font-semibold text-slate-950">
                      {visibleHeliosOpinion ? getHeliosModeLabel(visibleHeliosOpinion.mode) : "Modo inicial preparado"}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-700">{getHeliosActivationCopy(visibleHeliosOpinion?.mode)}</p>
                  </div>

                  <div className="rounded-[1.15rem] border border-white/80 bg-white/85 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Cruce IMSS e Infonavit</p>
                    <p className="mt-2 font-semibold text-slate-950">{socialSecurityStatusLabel}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-700">
                      {effectiveSocialSecurityValidation?.lastRevalidationSummary ?? socialSecurityRecommendedNextStep}
                    </p>
                    <p className="mt-2 text-xs leading-5 text-slate-500">{socialSecurityLastCheckLabel}</p>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                  <div className="rounded-[1.15rem] border border-white/80 bg-white/85 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Siguiente documento que más puede ayudarte</p>
                    <p className="mt-2 font-semibold text-slate-950">
                      {socialSecurityRecommendedDocument?.title ?? "Todavía no hay una sugerencia documental específica"}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-700">
                      {socialSecurityRecommendedDocument?.reason ?? socialSecurityRecommendedNextStep}
                    </p>
                    <Button
                      variant="outline"
                      className="mt-4 h-11 rounded-full border-teal-200 bg-teal-50 text-teal-900 hover:bg-teal-100"
                      onClick={() => focusRecommendedUpload(effectiveRecommendedTarget?.type ?? null)}
                    >
                      {socialSecurityRecommendedDocument ? "Preparar esta sugerencia" : "Subir otro documento útil"}
                      <ArrowRight className="ml-2 h-4 w-4" strokeWidth={1.8} />
                    </Button>
                  </div>

                  <div className="rounded-[1.15rem] border border-white/80 bg-white/85 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Historial de revalidaciones</p>
                        <p className="mt-2 font-semibold text-slate-950">
                          {socialSecurityRevalidationHistory.length
                            ? `${socialSecurityRevalidationHistory.length} revalidación${socialSecurityRevalidationHistory.length === 1 ? "" : "es"} visible${socialSecurityRevalidationHistory.length === 1 ? "" : "s"}`
                            : "Todavía no hay revalidaciones guardadas"}
                        </p>
                      </div>
                      {effectiveSocialSecurityValidation?.clarityChangeLabel ? (
                        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                          {effectiveSocialSecurityValidation.clarityChangeLabel}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-4 space-y-3">
                      {socialSecurityRevalidationHistory.length ? (
                        socialSecurityRevalidationHistory.map((entry) => (
                          <div key={`${entry.recordedAt}-${entry.summary}`} className="rounded-[1rem] border border-slate-200 bg-slate-50 p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="font-semibold text-slate-900">{entry.statusLabel}</p>
                              <span className="text-xs font-medium text-slate-500">{formatDate(entry.recordedAt)}</span>
                            </div>
                            <p className="mt-2 text-sm leading-6 text-slate-700">{entry.summary}</p>
                            <p className="mt-2 text-xs leading-5 text-slate-500">
                              {entry.coverageScore ? `Cobertura estimada: ${entry.coverageScore}%` : "Cobertura registrada en esta revalidación."}
                              {entry.recommendedNextStep ? ` · ${entry.recommendedNextStep}` : ""}
                            </p>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-[1rem] border border-dashed border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-600">
                          Cuando revalides IMSS e Infonavit desde tu expediente, aquí verás la fecha, el estado y el cambio detectado entre revisiones.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="sm:hidden rounded-[1.45rem] border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Resumen antes de subir</p>
                  <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-slate-950">
                    Tu expediente va en {heliosExpediente?.stageLabel ?? dossierStatus.label}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Ya tienes {documents.length} documento{documents.length === 1 ? "" : "s"} cargado{documents.length === 1 ? "" : "s"}. El siguiente paso útil aparece justo debajo para que no pierdas el hilo.
                  </p>
                </div>
                <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-800">
                  {dossierStatus.completed}/{dossierStatus.total}
                </span>
              </div>

              <div className="mt-4 grid gap-3">
                <div className="rounded-[1.1rem] border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Cruce IMSS e Infonavit</p>
                  <p className="mt-2 text-sm font-semibold text-slate-950">{socialSecurityStatusLabel}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{socialSecuritySummary}</p>
                </div>

                {effectiveRecommendedTarget ? (
                  <div className="rounded-[1.1rem] border border-sky-100 bg-sky-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">Documento sugerido</p>
                    <p className="mt-2 text-sm font-semibold text-slate-950">{effectiveRecommendedTarget.label}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      Preparamos el cargador para retomar exactamente esta recomendación cuando quieras subirla.
                    </p>
                    <Button
                      variant="outline"
                      className="mt-3 h-10 w-full rounded-full border-sky-200 bg-white text-sky-900 hover:bg-sky-100"
                      onClick={() => focusRecommendedUpload(effectiveRecommendedTarget.type)}
                    >
                      Preparar esta sugerencia
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="motion-hover-lift rounded-[1.65rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">Sube tu documento</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950">
                    Añade un documento a tu expediente
                  </h2>
                </div>
                <p className="max-w-lg text-sm leading-6 text-slate-600">
                  Después de subirlo, AuditaPatron lo analizará para mostrarte qué ya se entendió, qué conviene revisar y cómo ese archivo queda ordenado dentro de tu expediente digital para tenerlo siempre a la mano.
                </p>
              </div>

              <div className={`mt-5 gap-3 sm:hidden ${shouldCompactMobileUploadEntry ? "hidden" : "grid"}`}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-900">Si vienes desde tu celular, así se siente de simple</p>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                    {mobileOnboardingIndex + 1}/{mobileOnboardingSteps.length}
                  </span>
                </div>
                <div className="rounded-[1.2rem] border border-slate-200 bg-slate-50 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm">
                  <div className="inline-flex rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold tracking-[0.14em] text-teal-700">
                    Paso {activeMobileOnboardingStep.step}
                  </div>
                  <p className="mt-3 font-semibold text-slate-950">{activeMobileOnboardingStep.title}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{activeMobileOnboardingStep.description}</p>
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      className="inline-flex h-10 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-45"
                      onClick={() => setMobileOnboardingIndex((current) => Math.max(0, current - 1))}
                      disabled={mobileOnboardingIndex === 0}
                    >
                      <ArrowLeft className="h-4 w-4" strokeWidth={1.8} />
                      Anterior
                    </button>
                    <div className="flex items-center gap-2">
                      {mobileOnboardingSteps.map((item, index) => (
                        <button
                          key={item.step}
                          type="button"
                          onClick={() => setMobileOnboardingIndex(index)}
                          className={`h-2.5 rounded-full transition-all ${
                            index === mobileOnboardingIndex ? "w-6 bg-teal-600" : "w-2.5 bg-slate-300"
                          }`}
                          aria-label={`Ver paso ${item.step}`}
                        />
                      ))}
                    </div>
                    <button
                      type="button"
                      className="inline-flex h-10 items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-4 text-sm font-medium text-teal-800 transition hover:border-teal-300 hover:bg-teal-100 disabled:cursor-not-allowed disabled:opacity-45"
                      onClick={() => setMobileOnboardingIndex((current) => Math.min(mobileOnboardingSteps.length - 1, current + 1))}
                      disabled={mobileOnboardingIndex === mobileOnboardingSteps.length - 1}
                    >
                      Siguiente
                      <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
                    </button>
                  </div>
                </div>
              </div>

              <div className={`mt-6 gap-4 md:grid-cols-2 ${shouldCompactMobileUploadEntry ? "hidden sm:grid" : "grid"}`}>
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Tu espacio</span>
                  <select
                    value={selectedTenantId}
                    onChange={(event) => {
                      setSelectedTenantId(event.target.value);
                      setSelectedCaseId("");
                      setPendingDraft(null);
                      setLastUpload(null);
                    }}
                    className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-teal-500"
                  >
                    {tenantsQuery.data?.map((tenant) => (
                      <option key={tenant.tenantId} value={tenant.tenantId}>
                        {tenant.displayName}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Elige tu caso</span>
                  <select
                    value={selectedCaseId}
                    onChange={(event) => {
                      setSelectedCaseId(event.target.value);
                      setPendingDraft(null);
                      setLastUpload(null);
                    }}
                    className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-teal-500"
                  >
                    {casesQuery.data?.map((item) => (
                      <option key={item.caseId} value={item.caseId}>
                        {item.title} · Folio {item.caseId.slice(-6)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div ref={uploadSectionRef} className="mt-6 rounded-[1.4rem] border border-slate-200 bg-slate-50 p-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-teal-600 text-white">
                      <FileUp className="h-5 w-5" strokeWidth={1.8} />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-950">Archivo principal</p>
                      <p className="text-sm text-slate-600">Puede ser foto, PDF, XML u otro archivo laboral útil. Lo revisamos primero y tú decides si se guarda.</p>
                    </div>
                  </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  <article className="rounded-[1rem] border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-950">
                    <p className="font-semibold">Confidencial</p>
                    <p className="mt-1 text-xs leading-5 text-emerald-900">Tus documentos se usan solo para esta auditoría.</p>
                  </article>
                  <article className="rounded-[1rem] border border-sky-100 bg-sky-50 px-3 py-2 text-sm text-sky-950">
                    <p className="font-semibold">Protegido</p>
                    <p className="mt-1 text-xs leading-5 text-sky-900">La carga viaja protegida y queda resguardada en tu expediente.</p>
                  </article>
                  <article className="rounded-[1rem] border border-violet-100 bg-violet-50 px-3 py-2 text-sm text-violet-950">
                    <p className="font-semibold">Bajo tu control</p>
                    <p className="mt-1 text-xs leading-5 text-violet-900">Antes de guardarlo, te mostramos una vista previa para validar.</p>
                  </article>
                </div>

                {selectedRecommendedTargetType && effectiveRecommendedTarget ? (

                  <div className="mt-4 rounded-[1.2rem] border border-sky-100 bg-sky-50 p-4 text-sm leading-6 text-sky-950">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-semibold">Documento sugerido preparado</p>
                        <p className="mt-1">
                          Ahora mismo estamos enfocando {effectiveRecommendedTarget.label.toLowerCase()} para que retomes exactamente esa recomendación al subir tu archivo.
                        </p>
                      </div>
                      <button
                        type="button"
                        className="text-sm font-semibold text-sky-800 underline-offset-4 hover:underline"
                        onClick={() => setSelectedRecommendedTargetType(null)}
                      >
                        Quitar enfoque
                      </button>
                    </div>
                  </div>
                ) : null}

                <div className="mt-4 grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
                  <div className="rounded-[1.2rem] border border-sky-100 bg-sky-50 p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-sky-700">
                        <FileSearch className="h-5 w-5" strokeWidth={1.8} />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-950">
                          {shouldCompactMobileUploadEntry ? "Sube tu primer documento" : "Escaneo asistido por IA"}
                        </p>
                        <p className="mt-1 text-sm leading-6 text-slate-700">
                          {shouldCompactMobileUploadEntry ? "El análisis empieza solo en cuanto captures o elijas el documento. Tus datos siguen protegidos durante todo el flujo." : selectedFilePreparationCopy}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                      <span className="rounded-full bg-white px-3 py-1 text-slate-700">Nitidez y legibilidad</span>
                      <span className="rounded-full bg-white px-3 py-1 text-slate-700">Bordes y orientación</span>
                      <span className="rounded-full bg-white px-3 py-1 text-slate-700">Coincidencia con el documento esperado</span>
                    </div>
                  </div>

                  <div className={`rounded-[1.2rem] border border-slate-200 bg-white p-4 ${shouldCompactMobileUploadEntry ? "hidden sm:block" : ""}`}>
                    <p className="text-sm font-semibold text-slate-950">Abrir primero</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{getCaptureModeSupportCopy(preferredCaptureMode)}</p>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        className={`inline-flex h-11 items-center justify-center gap-2 rounded-2xl border text-sm font-medium transition ${
                          preferredCaptureMode === "camera"
                            ? "border-teal-200 bg-teal-50 text-teal-900"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                        }`}
                        onClick={() => handleCaptureModeSelection("camera", "preference_panel")}
                      >
                        <Camera className="h-4 w-4" strokeWidth={1.8} />
                        Cámara
                      </button>
                      <button
                        type="button"
                        className={`inline-flex h-11 items-center justify-center gap-2 rounded-2xl border text-sm font-medium transition ${
                          preferredCaptureMode === "file" || preferredCaptureMode === null
                            ? "border-teal-200 bg-teal-50 text-teal-900"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                        }`}
                        onClick={() => handleCaptureModeSelection("file", "preference_panel")}
                      >
                        <FolderOpen className="h-4 w-4" strokeWidth={1.8} />
                        Archivo
                      </button>
                    </div>
                  </div>
                </div>

                {activeCaptureMode === "camera" && !shouldCompactMobileUploadEntry ? (
                  <div className="mt-4 grid gap-3 lg:grid-cols-[0.95fr_1.05fr]">
                    <div className="rounded-[1.2rem] border border-teal-100 bg-white p-4">
                      <p className="text-sm font-semibold text-slate-950">Guía visual para encuadrar el documento</p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        Usa este marco como referencia al tomar la foto. Intenta que se vean las cuatro esquinas, evita sombras intensas y procura que el texto quede derecho.
                      </p>
                      <p className="mt-3 text-xs leading-5 text-slate-500">
                        Es una ayuda visual ligera. Si tu celular no sigue el borde perfecto, igual puedes continuar mientras el documento se vea completo y legible.
                      </p>
                    </div>
                    <div className="rounded-[1.2rem] border border-teal-100 bg-teal-50 p-4">
                      <div className="mx-auto aspect-[4/5] max-w-[220px] rounded-[1.7rem] border border-white/80 bg-white/70 p-4 shadow-inner">
                        <div className="relative h-full rounded-[1.35rem] border-2 border-dashed border-teal-300 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(240,253,250,0.75))]">
                          <div className="absolute left-3 top-3 h-8 w-8 rounded-tl-[1rem] border-l-4 border-t-4 border-teal-500" />
                          <div className="absolute right-3 top-3 h-8 w-8 rounded-tr-[1rem] border-r-4 border-t-4 border-teal-500" />
                          <div className="absolute bottom-3 left-3 h-8 w-8 rounded-bl-[1rem] border-b-4 border-l-4 border-teal-500" />
                          <div className="absolute bottom-3 right-3 h-8 w-8 rounded-br-[1rem] border-b-4 border-r-4 border-teal-500" />
                          <div className="absolute inset-x-6 top-1/2 -translate-y-1/2 rounded-full bg-white/90 px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-700 shadow-sm">
                            Centra aquí tu documento
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}

                <input
                  ref={cameraInputRef}
                  key={`camera-${pickerKey}`}
                  type="file"
                  accept="image/*,application/pdf,.xml,text/xml,application/xml"
                  capture="environment"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <input
                  ref={fileInputRef}
                  key={`file-${pickerKey}`}
                  type="file"
                  accept="image/*,application/pdf,.xml,text/xml,application/xml"
                  onChange={handleFileChange}
                  className="hidden"
                />

                <div className="mt-5 rounded-[1.25rem] border border-dashed border-slate-300 bg-white p-4">
                  <div className="rounded-[1.1rem] border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-700">
                    <p className="font-semibold text-slate-950">Tú controlas lo que pasa con este archivo</p>
                    <p className="mt-1">
                      Elegirlo sólo prepara el borrador. Antes de guardar, revisas la lectura y confirmas si realmente quieres integrarlo al expediente.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                      <span className="rounded-full bg-white px-3 py-1 text-slate-700">PDF, XML o imagen</span>
                      <span className="rounded-full bg-white px-3 py-1 text-slate-700">Hasta 15 MB</span>
                      <span className="rounded-full bg-white px-3 py-1 text-slate-700">Sin guardado automático</span>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2 sm:hidden">
                    <Button
                      variant="outline"
                      className="h-12 w-full rounded-2xl border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
                      onClick={openPreferredPicker}
                    >
                      {selectedFile
                        ? "Cambiar documento"
                        : shouldCompactMobileUploadEntry
                          ? activeCaptureMode === "camera"
                            ? "Toma foto para empezar"
                            : "Elige archivo para empezar"
                          : uploadPrimaryActionLabel}
                    </Button>
                    <div className="space-y-3">
                      <p className="text-xs leading-5 text-slate-500">
                        {shouldCompactMobileUploadEntry
                          ? "Elige cómo subirlo. Después te mostraremos el borrador y el siguiente documento sugerido."
                          : preferredCaptureMode === "camera"
                            ? "Abriremos primero la cámara para que tomes la foto sin pasos extra."
                            : preferredCaptureMode === "file"
                              ? "Abriremos primero tus archivos para quitarte un toque innecesario."
                              : "Abriremos primero tus archivos para avanzar más rápido. Si prefieres foto, puedes cambiarlo aquí."}
                      </p>
                      {shouldCompactMobileUploadEntry ? (
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            className={`inline-flex h-10 items-center justify-center gap-2 rounded-2xl border text-sm font-medium transition ${
                              activeCaptureMode === "camera"
                                ? "border-teal-200 bg-teal-50 text-teal-900"
                                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                            }`}
                            onClick={() => handleCaptureModeSelection("camera", "compact_mobile_toggle")}
                          >
                            <Camera className="h-4 w-4" strokeWidth={1.8} />
                            Cámara
                          </button>
                          <button
                            type="button"
                            className={`inline-flex h-10 items-center justify-center gap-2 rounded-2xl border text-sm font-medium transition ${
                              activeCaptureMode === "file"
                                ? "border-teal-200 bg-teal-50 text-teal-900"
                                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                            }`}
                            onClick={() => handleCaptureModeSelection("file", "compact_mobile_toggle")}
                          >
                            <FolderOpen className="h-4 w-4" strokeWidth={1.8} />
                            Archivo
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-start justify-end">
                          <button
                            type="button"
                            className="shrink-0 text-xs font-semibold text-teal-700 underline decoration-teal-200 underline-offset-4"
                            onClick={() => setUploadSourceOpen(true)}
                          >
                            Cambiar método
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="hidden gap-3 sm:grid sm:grid-cols-2">
                    <Button
                      variant="outline"
                      className={`h-12 rounded-2xl ${
                        preferredCaptureMode === "camera"
                          ? "border-teal-200 bg-teal-50 text-teal-900 hover:bg-teal-100"
                          : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
                      }`}
                      onClick={openCameraPicker}
                    >
                      <Camera className="mr-2 h-4 w-4" strokeWidth={1.8} />
                      Tomar foto
                    </Button>
                    <Button
                      variant="outline"
                      className={`h-12 rounded-2xl ${
                        preferredCaptureMode === "file" || preferredCaptureMode === null
                          ? "border-teal-200 bg-teal-50 text-teal-900 hover:bg-teal-100"
                          : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
                      }`}
                      onClick={openFilePicker}
                    >
                      <FolderOpen className="mr-2 h-4 w-4" strokeWidth={1.8} />
                      Elegir archivo
                    </Button>
                  </div>

                  <div className={`mt-4 rounded-[1.1rem] border p-4 ${uploadProgressState.toneClasses}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] opacity-80">{uploadProgressState.eyebrow}</p>
                        <p className="mt-2 font-semibold">{uploadProgressState.title}</p>
                      </div>
                      <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-slate-700">
                        {uploadProgressState.progress}%
                      </span>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/70">
                      <div className={`h-full rounded-full transition-all duration-500 ${uploadProgressState.barClasses}`} style={{ width: `${uploadProgressState.progress}%` }} />
                    </div>
                    <p className="mt-3 text-sm leading-6 opacity-90">{uploadProgressState.description}</p>
                    <p className="mt-2 text-xs leading-5 opacity-80">
                      {selectedFile
                        ? `Archivo actual: ${selectedFile.name} · ${formatVisibleFileSize(selectedFile.size)}`
                        : "Consejo preventivo: procura que el archivo esté completo, legible y sin sombras antes de subirlo."}
                    </p>
                    {selectedFileValidationMessage ? (
                      <p className="mt-2 text-xs font-medium text-amber-900">{selectedFileValidationMessage}</p>
                    ) : null}
                  </div>
                </div>

                {pendingDraft ? (
                  <div className="mt-4 rounded-[1.2rem] border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950">
                    <p className="font-semibold">Vista previa lista para confirmarse</p>
                    <p className="mt-1">{pendingDraft.previewAsset.fileName} · {(pendingDraft.previewAsset.sizeBytes / 1024).toFixed(1)} KB</p>
                    <p className="mt-2 leading-6">
                      Este archivo ya fue analizado, pero todavía no se guarda en tu expediente hasta que lo confirmes.
                    </p>
                  </div>
                ) : selectedFile ? (
                  <div className="mt-4 rounded-[1.2rem] border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-900">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold">Documento recibido para borrador automático</p>
                      <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-emerald-900">Listo para análisis</span>
                    </div>
                    <p className="mt-1">{selectedFile.name} · {formatVisibleFileSize(selectedFile.size)}</p>
                    <p className="mt-2 leading-6">La revisión preliminar empieza sola en cuanto termina la carga, para que llegues a la vista previa sin un paso manual adicional antes del guardado final.</p>
                    <p className="mt-2 text-xs leading-5 text-emerald-900/80">Elegir el archivo no lo guarda todavía en el expediente: primero verás el borrador y después decidirás si confirmas.</p>
                  </div>
                ) : (
                  <div className="mt-4 rounded-[1.2rem] border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-600">
                    Todavía no elegiste archivo. Cuando lo hagas, aquí verás el nombre, el avance del análisis, el borrador automático y el siguiente paso recomendado antes de guardarlo definitivamente.
                  </div>
                )}
              </div>

              <label className="mt-5 block">
                <span className="text-sm font-medium text-slate-700">Si quieres, cuéntanos qué es este archivo o para qué te ayuda</span>
                <textarea
                  value={textHint}
                  onChange={(event) => setTextHint(event.target.value)}
                  rows={3}
                  placeholder="Ejemplo: recibo de nómina de marzo, alta IMSS, contrato inicial, captura de instrucciones por WhatsApp..."
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-teal-500"
                />
              </label>

              <div className="mt-5 flex flex-col gap-3 rounded-[1.3rem] border border-teal-100 bg-teal-50 p-4 text-sm leading-6 text-teal-950">
                <div className="flex items-start gap-3">
                  <Lock className="mt-1 h-5 w-5 shrink-0 text-teal-700" strokeWidth={1.8} />
                  <div className="space-y-2">
                    <p>
                      Tu documento queda protegido dentro del flujo de AuditaPatron. Primero te mostramos una vista previa para separar lo confirmado de lo estimado y solo después decides si quieres guardarlo en tu expediente.
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="rounded-2xl bg-white/80 px-3 py-2 text-xs leading-5 text-teal-950">
                        <strong className="font-semibold">Privacidad activa:</strong> tus archivos se usan solo para esta auditoría.
                      </div>
                      <div className="rounded-2xl bg-white/80 px-3 py-2 text-xs leading-5 text-teal-950">
                        <strong className="font-semibold">Recuperación clara:</strong> si algo falla, puedes reintentar sin perder el control del flujo.
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {pendingDraft ? (
                <div className="mt-6 rounded-[1.45rem] border border-sky-200 bg-sky-50 p-5 sm:p-6">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-sky-700">Vista previa antes de guardar</p>
                      <h3 className="mt-2 text-xl font-semibold text-slate-950">
                        Ya analizamos tu documento. Revisa primero lo importante antes de integrarlo a tu expediente.
                      </h3>
                      <p className="mt-2 text-sm leading-7 text-slate-700">
                        Aquí todavía nada reemplaza ni estorba lo que ya tenías bien guardado. Si algo se ve incompleto, puedes repetir la foto o elegir otro archivo.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs font-semibold">
                      <span className="rounded-full bg-white px-3 py-1 text-slate-700">
                        Tipo: {getSimpleDocumentTypeLabel(pendingDraft.classification.documentType)}
                      </span>
                      <span className="rounded-full bg-white px-3 py-1 text-slate-700">
                        Revisión: {getProcessingProfileLabel(pendingDraft.preliminaryAnalysis.processingProfile)}
                      </span>
                      <span className={`rounded-full px-3 py-1 ${previewReadiness.classes}`}>{previewReadiness.label}</span>
                    </div>
                  </div>

                  <div
                    className={`mt-4 rounded-[1.2rem] border bg-white/90 p-4 transition-all duration-300 ${
                      previewStatusFlash ? "border-sky-300 shadow-[0_24px_60px_-38px_rgba(14,165,233,0.55)] ring-2 ring-sky-100" : "border-white/80"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className={`mt-1 inline-flex h-2.5 w-2.5 rounded-full ${previewStatusFlash ? "animate-pulse bg-sky-500" : "bg-sky-300"}`} />
                      <div>
                        <p className="font-semibold text-slate-950">Vista previa lista para revisión rápida</p>
                        <p className="mt-1 text-sm leading-6 text-slate-700">
                          {manualOverridePayload.length
                            ? `Llevas ${manualOverridePayload.length} ajuste${manualOverridePayload.length === 1 ? "" : "s"} manual${manualOverridePayload.length === 1 ? "" : "es"} preparado${manualOverridePayload.length === 1 ? "" : "s"} para el guardado final.`
                            : "Si ves un dato importante mal leído, puedes corregirlo aquí. Es opcional y toma solo unos segundos."}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
                    <div className="rounded-[1.2rem] border border-white/80 bg-white p-4">
                      <p className="font-semibold text-slate-950">{pendingDraft.scanAssistance.friendlyHeadline}</p>
                      <p className="mt-2 text-sm leading-7 text-slate-700">{pendingDraft.scanAssistance.userGuidance}</p>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                          Confianza visual {pendingDraft.scanAssistance.confidence}%
                        </span>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                          {getExpectedTypeAlignmentCopy(pendingDraft.scanAssistance.expectedTypeAlignment)}
                        </span>
                        {previewInsight ? (
                          <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-800">{previewInsight.label}</span>
                        ) : null}
                      </div>
                      {pendingDraft.scanAssistance.issues.length ? (
                        <div className="mt-4 space-y-2 text-sm leading-6 text-slate-700">
                          {pendingDraft.scanAssistance.issues.map((item) => (
                            <p key={item}>• {item}</p>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    <div className="rounded-[1.2rem] border border-white/80 bg-white p-4">
                      <p className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-400">Lectura estructurada</p>
                      <h4 className="mt-2 font-semibold text-slate-950">
                        {displayPreviewStructuredExtraction?.headline ?? "Resumen del documento"}
                      </h4>
                      <p className="mt-2 text-sm leading-7 text-slate-700">
                        {displayPreviewStructuredExtraction?.summary ?? pendingDraft.preliminaryAnalysis.summary}
                      </p>
                      {previewStructuredConfirmedFields.length || previewStructuredEstimatedFields.length ? (
                        <div className="mt-4 space-y-2">
                          {[...previewStructuredConfirmedFields, ...previewStructuredEstimatedFields].slice(0, 6).map((field) => (
                            <div key={`${field.key}-${field.label}`} className="rounded-[1rem] border border-slate-200 bg-slate-50 p-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{field.label}</p>
                                <span
                                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                                    field.status === "confirmed" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                                  }`}
                                >
                                  {field.status === "confirmed" ? "Confirmado" : "Estimado"}
                                </span>
                              </div>
                              <p className="mt-1 text-sm leading-6 text-slate-800">{field.value}</p>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                    <div className="rounded-[1.2rem] border border-teal-100 bg-teal-50 p-4 transition-all duration-300">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-teal-950">Corrige rápido solo lo que sí veas claro</p>
                          <p className="mt-2 text-sm leading-7 text-teal-900">
                            Esta revisión es opcional. Solo ajusta los datos que identifiques con claridad para dejar más preciso el guardado final.
                          </p>
                        </div>
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-teal-800">
                          {manualOverridePayload.length
                            ? `${manualOverridePayload.length} ajuste${manualOverridePayload.length === 1 ? "" : "s"}`
                            : "Opcional"}
                        </span>
                      </div>

                      {previewEditableFields.length === 0 ? (
                        <p className="mt-4 text-sm leading-7 text-teal-900">
                          Esta vista previa no detectó campos prioritarios para corrección manual. Si la foto quedó floja, conviene repetir la captura.
                        </p>
                      ) : (
                        <div className="mt-4 space-y-3">
                          {previewEditableFields.map((field) => {
                            const currentValue = manualFieldValues[field.key] ?? field.value;
                            const isEdited = currentValue.trim() !== field.value.trim();

                            return (
                              <label key={field.key} className="block rounded-[1rem] border border-white/80 bg-white p-3 shadow-sm transition-all duration-300">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-teal-700">{field.label}</p>
                                  <span
                                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                                      isEdited
                                        ? "bg-teal-100 text-teal-900"
                                        : field.source === "confirmed"
                                          ? "bg-emerald-100 text-emerald-800"
                                          : "bg-amber-100 text-amber-800"
                                    }`}
                                  >
                                    {isEdited ? "Ajustado" : field.source === "confirmed" ? "Confirmado" : "Sugerido"}
                                  </span>
                                </div>
                                <input
                                  value={currentValue}
                                  onChange={(event) => handleManualFieldChange(field.key, event.target.value)}
                                  placeholder={field.value}
                                  className="mt-3 h-11 w-full rounded-2xl border border-teal-100 bg-teal-50/60 px-4 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
                                />
                                <p className="mt-2 text-xs leading-5 text-teal-900">{getEditableFieldSupportCopy(field.key)}</p>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div
                      ref={recommendedStepRef}
                      className={`rounded-[1.2rem] border bg-emerald-50 p-4 transition-all duration-300 ${
                        recommendedStepFlash
                          ? "border-emerald-300 shadow-[0_24px_60px_-38px_rgba(16,185,129,0.45)] ring-2 ring-emerald-100"
                          : "border-emerald-100"
                      }`}
                    >
                      <p className="text-sm font-semibold uppercase tracking-[0.14em] text-emerald-800">
                        {recommendedStepFlash ? "Siguiente paso sugerido" : "Sugerencia útil para seguir"}
                      </p>
                      <h4 className="mt-2 text-lg font-semibold text-slate-950">{previewNextDocumentCopy.headline}</h4>
                      <p className="mt-2 text-sm leading-7 text-emerald-950">{previewNextDocumentCopy.intro}</p>
                      <div className="mt-4 rounded-[1rem] border border-white/80 bg-white p-3">
                        <p className="text-sm font-semibold text-slate-950">{previewNextDocumentCopy.reasonTitle}</p>
                        <p className="mt-2 text-sm leading-7 text-slate-700">{previewNextDocumentCopy.reasonBody}</p>
                        <p className="mt-2 text-xs leading-6 text-slate-500">{previewNextDocumentCopy.coverage}</p>
                      </div>
                      {previewNextTarget ? (
                        <Button
                          variant="outline"
                          className="mt-4 h-11 w-full rounded-full border-emerald-200 bg-white text-emerald-900 hover:bg-emerald-100"
                          onClick={() => focusRecommendedUpload(previewNextTarget.type)}
                        >
                          Seguir con esta sugerencia
                          <ArrowRight className="ml-2 h-4 w-4" strokeWidth={1.8} />
                        </Button>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <div className="rounded-[1.2rem] border border-emerald-100 bg-emerald-50 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-semibold text-emerald-950">Lo que ya se ve claro</p>
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-emerald-800">
                          {previewConfirmedDisplayEntries.length} dato{previewConfirmedDisplayEntries.length === 1 ? "" : "s"}
                        </span>
                      </div>
                      {previewConfirmedDisplayEntries.length === 0 ? (
                        <p className="mt-3 text-sm leading-7 text-emerald-900">
                          Todavía no hay suficiente información clara para mostrar datos confirmados en esta vista previa.
                        </p>
                      ) : (
                        <div className="mt-4 space-y-3">
                          {previewConfirmedDisplayEntries.map(([key, value]) => (
                            <div key={key} className="rounded-[1rem] bg-white p-3">
                              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">{getAnalysisFieldLabel(key)}</p>
                              <p className="mt-1 text-sm leading-6 text-slate-800">{formatAnalysisValue(key, value)}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="rounded-[1.2rem] border border-amber-200 bg-amber-50 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-semibold text-amber-950">Lo que conviene revisar</p>
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-amber-800">
                          {previewEstimatedDisplayEntries.length} dato{previewEstimatedDisplayEntries.length === 1 ? "" : "s"}
                        </span>
                      </div>
                      <p className="mt-3 text-sm leading-7 text-amber-900">
                        Tómalos como orientación inicial. Si no te convence la lectura o la foto quedó floja, puedes repetir la captura antes de guardar.
                      </p>
                      {previewEstimatedDisplayEntries.length === 0 ? (
                        <p className="mt-3 text-sm leading-7 text-amber-900">
                          Por ahora no hay estimaciones adicionales que revisar en esta vista previa.
                        </p>
                      ) : (
                        <div className="mt-4 space-y-3">
                          {previewEstimatedDisplayEntries.map(([key, value]) => (
                            <div key={key} className="rounded-[1rem] bg-white p-3">
                              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-700">{getAnalysisFieldLabel(key)}</p>
                              <p className="mt-1 text-sm leading-6 text-slate-800">{formatAnalysisValue(key, value)}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {displayPreviewStructuredExtraction?.missingFields?.length || displayPreviewStructuredExtraction?.reviewNotes?.length || previewGuardrails.length ? (
                    <div className="mt-4 rounded-[1.2rem] border border-white/80 bg-white p-4">
                      <p className="font-semibold text-slate-950">Qué revisar antes de guardar</p>
                      <div className="mt-3 space-y-2 text-sm leading-7 text-slate-700">
                        {displayPreviewStructuredExtraction?.missingFields?.map((item) => (
                          <p key={`missing-${item}`}>• Todavía no se alcanzó a leer con claridad: {item}.</p>
                        ))}
                        {displayPreviewStructuredExtraction?.reviewNotes?.map((item) => (
                          <p key={`note-${item}`}>• {item}</p>
                        ))}
                        {previewGuardrails.map((item) => (
                          <p key={`guardrail-${item}`}>• {item}</p>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {shouldShowInlineLegalConsent ? (
                    <div className="mt-5 rounded-[1.25rem] border border-amber-200 bg-amber-50/70 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="max-w-2xl">
                          <p className="text-sm font-semibold text-amber-950">Antes de guardar, confirma tu autorización</p>
                          <p className="mt-1 text-sm leading-6 text-amber-900/90">
                            Protegemos tu información y registramos la versión legal vigente en el mismo momento en que guardas este documento.
                          </p>
                        </div>
                        <button
                          type="button"
                          className="text-sm font-semibold text-amber-950 underline decoration-amber-300 underline-offset-4"
                          onClick={() => setLegalDocumentsDrawerOpen(true)}
                        >
                          Ver documentos vigentes
                        </button>
                      </div>
                      <label className="mt-4 flex items-start gap-3 rounded-[1rem] border border-amber-200 bg-white/85 p-3">
                        <input
                          type="checkbox"
                          checked={legalGateChecked}
                          onChange={(event) => {
                            setLegalGateChecked(event.target.checked);
                            if (event.target.checked) {
                              setLegalGateError(null);
                            }
                          }}
                          className="mt-1 h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                        />
                        <span className="text-sm leading-6 text-slate-700">{LEGAL_GATE_COPY.checkbox}</span>
                      </label>
                    </div>
                  ) : null}

                  <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                    <Button
                      className={`h-12 rounded-full px-7 text-white transition-all duration-300 ${
                        manualOverridePayload.length
                          ? "bg-teal-700 shadow-[0_18px_40px_-24px_rgba(15,118,110,0.7)] hover:bg-teal-800"
                          : "bg-teal-600 hover:bg-teal-700"
                      }`}
                      disabled={isPrimaryDocumentActionPending || !selectedTenantId || !selectedCaseId}
                      onClick={() => void handleConfirmDraft()}
                    >
                      {confirmDraftMutation.isPending
                        ? "Guardando documento..."
                        : acceptLegalPackageMutation.isPending
                          ? "Registrando autorización..."
                          : confirmPrimaryActionLabel}
                      {isPrimaryDocumentActionPending ? (
                        <RefreshCw className="ml-2 h-4 w-4 animate-spin" strokeWidth={1.8} />
                      ) : (
                        <ArrowRight className="ml-2 h-4 w-4" strokeWidth={1.8} />
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      className="h-12 rounded-full border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      disabled={isPrimaryDocumentActionPending}
                      onClick={restartPreviewFlow}
                    >
                      {reanalyzeDraftAction.label}
                    </Button>
                  </div>
                </div>
              ) : null}

              {submitError ? (
                <div className="mt-6 rounded-[1.2rem] border border-amber-200 bg-amber-50 p-4 text-sm leading-7 text-amber-950">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="mt-1 h-5 w-5 shrink-0" strokeWidth={1.8} />
                    <div className="space-y-2">
                      <p className="font-semibold text-amber-950">Algo interrumpió la carga, pero tus datos siguen a salvo.</p>
                      <p>{submitError}</p>
                      <p className="text-xs leading-5 text-amber-900">Puedes reintentar ahora mismo o elegir otro archivo sin perder el control del flujo.</p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <Button
                      type="button"
                      variant="outline"
                      className="border-amber-300 bg-white text-amber-950 hover:bg-amber-100"
                      onClick={() => {
                        setSubmitError(null);
                        if (pendingDraft) {
                          restartPreviewFlow();
                          return;
                        }
                        openPreferredPicker();
                      }}
                    >
                      Reintentar ahora
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="text-amber-950 hover:bg-amber-100"
                      onClick={() => setSubmitError(null)}
                    >
                      Cerrar mensaje
                    </Button>
                  </div>
                </div>
              ) : null}

              {legalGateError ? (
                <div className="mt-6 rounded-[1.2rem] border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-900" data-testid="legal-gate-error">
                  <p className="font-semibold text-rose-950">No pudimos registrar tu autorización todavía.</p>
                  <p className="mt-2">{legalGateError.message}</p>
                  <p className="mt-2 text-xs text-rose-800/90">
                    Tu archivo y tu progreso siguen resguardados. Puedes reintentar desde aquí sin duplicar el expediente.
                  </p>
                  {canRetryLegalGate ? (
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        className="border-rose-300 text-rose-700 hover:bg-rose-50"
                        onClick={() => {
                          void handleAcceptLegalPackage({ isRetry: true });
                        }}
                        disabled={acceptLegalPackageMutation.isPending || legalGateRetryCountdown > 0 || legalGateError.retryCount >= MAX_LEGAL_GATE_RETRIES}
                        data-testid="legal-gate-retry-button"
                      >
                        <RefreshCw className="mr-2 size-4" />
                        {legalGateRetryCountdown > 0 ? `Disponible en ${legalGateRetryCountdown}s` : "Reintentar autorización"}
                      </Button>
                      <span className="text-xs text-rose-700" data-testid="legal-gate-retry-copy">
                        Reintento {Math.min(legalGateError.retryCount + 1, MAX_LEGAL_GATE_RETRIES)} de {MAX_LEGAL_GATE_RETRIES}
                      </span>
                      <span className="text-xs font-semibold text-rose-800" data-testid="legal-gate-retry-countdown" data-seconds={legalGateRetryCountdown}>
                        {legalGateRetryCountdown > 0 ? `Disponible nuevamente en ${legalGateRetryCountdown}s` : "Reintento inmediato disponible"}
                      </span>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {shouldShowInlineLegalConsent ? (
                <div className="mt-5 hidden rounded-[1.25rem] border border-amber-200 bg-amber-50/70 p-4 sm:block">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="max-w-2xl">
                      <p className="text-sm font-semibold text-amber-950">Autorización integrada a la acción principal</p>
                      <p className="mt-1 text-sm leading-6 text-amber-900/90">
                        Cuando avances con este documento, registraremos tu aceptación del aviso de privacidad y de los términos vigentes en ese mismo paso.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="text-sm font-semibold text-amber-950 underline decoration-amber-300 underline-offset-4"
                      onClick={() => setLegalDocumentsDrawerOpen(true)}
                    >
                      Revisar términos y aviso
                    </button>
                  </div>
                  <label className="mt-4 flex items-start gap-3 rounded-[1rem] border border-amber-200 bg-white/85 p-3">
                    <input
                      type="checkbox"
                      checked={legalGateChecked}
                      onChange={(event) => {
                        setLegalGateChecked(event.target.checked);
                        if (event.target.checked) {
                          setLegalGateError(null);
                        }
                      }}
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                    />
                    <span className="text-sm leading-6 text-slate-700">{LEGAL_GATE_COPY.checkbox}</span>
                  </label>
                </div>
              ) : null}

              <div className="mt-5 hidden flex-col gap-3 sm:flex lg:flex-row">
                    <Button
                      className={`h-12 rounded-full px-7 text-white transition-all duration-300 ${
                        pendingDraft && manualOverridePayload.length
                          ? "bg-teal-700 shadow-[0_18px_40px_-24px_rgba(15,118,110,0.7)] hover:bg-teal-800"
                          : "bg-teal-600 hover:bg-teal-700"
                      }`}
                      disabled={isPrimaryDocumentActionPending || !selectedTenantId || !selectedCaseId}
                      onClick={() => {
                        if (pendingDraft) {
                          void handleConfirmDraft();
                          return;
                        }
                        if (!selectedFile) {
                          openPreferredPicker();
                          return;
                        }
                        void handleUpload();
                      }}
                    >
                      {isProcessingDocument
                        ? pendingDraft
                          ? "Guardando documento..."
                          : autoAdvanceFlash
                            ? "Autoavance activado..."
                            : "Analizando documento..."
                        : acceptLegalPackageMutation.isPending
                          ? "Registrando autorización..."
                          : pendingDraft
                            ? confirmPrimaryActionLabel
                            : uploadPrimaryActionLabel}
                      {isPrimaryDocumentActionPending ? (
                        <RefreshCw className="ml-2 h-4 w-4 animate-spin" strokeWidth={1.8} />
                      ) : (
                        <ArrowRight className="ml-2 h-4 w-4" strokeWidth={1.8} />
                      )}
                    </Button>
                    {autoAdvanceFlash && !pendingDraft ? (
                      <p className="mt-2 text-xs font-medium leading-5 text-teal-700">
                        Autoavance activado: en cuanto termine el análisis te llevamos a la revisión rápida para confirmar el documento.
                      </p>
                    ) : null}

                <Button
                  variant="outline"
                  className="h-12 rounded-full border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  onClick={pendingDraft ? restartPreviewFlow : clearSelectedFile}
                  disabled={isPrimaryDocumentActionPending}
                >
                    {pendingDraft ? reanalyzeDraftAction.label : "Limpiar formulario"}

                </Button>
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">Tu último documento</p>

              {saveStatusFlash && lastUpload ? (
                <div className="mt-4 rounded-[1.3rem] border border-emerald-200 bg-emerald-50 p-4 text-sm leading-7 text-emerald-950 shadow-sm transition-all duration-300">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-emerald-700" strokeWidth={1.8} />
                    <div>
                      <p className="font-semibold">Documento guardado y expediente actualizado</p>
                      <p className="mt-1">La vista previa ya se convirtió en un documento real dentro de tu expediente. Si hiciste ajustes manuales, también quedaron incorporados en este guardado para mantener una lectura consistente sobre la misma base documental.</p>
                    </div>
                  </div>
                </div>
              ) : null}

              {!lastUpload ? (
                pendingDraft ? (
                  <div className="mt-4 rounded-[1.3rem] border border-sky-200 bg-sky-50 p-5 text-sm leading-7 text-sky-950">
                    Tu documento ya quedó listo para confirmarse. En cuanto lo guardes, aquí verás el resultado final, el siguiente paso sugerido y el estado de seguimiento automático.
                  </div>
                ) : (
                  <div className="mt-4 rounded-[1.3rem] border border-slate-200 bg-slate-50 p-5 text-sm leading-7 text-slate-600">
                      Sube un documento para ver qué aportó y cuál es el siguiente paso.

                  </div>
                )
              ) : (
                <div className="mt-4 space-y-4">
                  <div className="rounded-[1.3rem] border border-teal-100 bg-teal-50 p-4">
                    <div className="flex items-start gap-3">
                      <Sparkles className="mt-1 h-5 w-5 shrink-0 text-teal-700" strokeWidth={1.8} />
                      <div>
                        <p className="font-semibold text-teal-950">Siguiente paso sugerido para ti</p>
                        <p className="mt-1 text-sm leading-7 text-teal-900">{uploadInsight?.nextSuggestion}</p>
                      </div>
                    </div>
                  </div>

                  {lastUpload?.scanAssistance ? (
                    <div className={`rounded-[1.3rem] border p-4 ${getScanAssistTone(lastUpload.scanAssistance as ScanAssistAssessmentView).containerClasses}`}>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex items-start gap-3">
                          <FileSearch className="mt-1 h-5 w-5 shrink-0 text-slate-700" strokeWidth={1.8} />
                          <div>
                            <p className="font-semibold text-slate-950">
                              {(lastUpload.scanAssistance as ScanAssistAssessmentView).friendlyHeadline}
                            </p>
                            <p className="mt-1 text-sm leading-7 text-slate-700">
                              {(lastUpload.scanAssistance as ScanAssistAssessmentView).userGuidance}
                            </p>
                          </div>
                        </div>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${getScanAssistTone(lastUpload.scanAssistance as ScanAssistAssessmentView).badgeClasses}`}
                        >
                          {getScanAssistTone(lastUpload.scanAssistance as ScanAssistAssessmentView).badgeLabel}
                        </span>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                        <span className="rounded-full bg-white px-3 py-1 text-slate-700">
                          Confianza visual {(lastUpload.scanAssistance as ScanAssistAssessmentView).confidence}%
                        </span>
                        <span className="rounded-full bg-white px-3 py-1 text-slate-700">
                          {getExpectedTypeAlignmentCopy((lastUpload.scanAssistance as ScanAssistAssessmentView).expectedTypeAlignment)}
                        </span>
                      </div>

                      {(lastUpload.scanAssistance as ScanAssistAssessmentView).issues.length ? (
                        <div className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
                          {(lastUpload.scanAssistance as ScanAssistAssessmentView).issues.map((item) => (
                            <p key={item}>• {item}</p>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
                    <div className="rounded-[1.3rem] border border-slate-200 bg-slate-50 p-4">
                      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">Resumen sencillo</p>
                      <h3 className="mt-2 text-xl font-semibold text-slate-950">
                        {getSimpleDocumentTypeLabel(lastUpload.classification.documentType)}
                      </h3>
                      <p className="mt-3 text-sm leading-7 text-slate-700">{lastUpload.preliminaryAnalysis.summary}</p>
                      <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
                        <span className="rounded-full bg-white px-3 py-1 text-slate-700">
                          Tipo: {getSimpleDocumentTypeLabel(lastUpload.classification.documentType)}
                        </span>
                        <span className="rounded-full bg-white px-3 py-1 text-slate-700">
                          Revisión: {getProcessingProfileLabel(lastUpload.preliminaryAnalysis.processingProfile)}
                        </span>
                        <span className={`rounded-full px-3 py-1 ${lastUploadReadiness.classes}`}>{lastUploadReadiness.label}</span>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="rounded-[1.3rem] border border-emerald-100 bg-emerald-50 p-4">
                        <div className="flex items-start gap-3">
                          <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-emerald-700" strokeWidth={1.8} />
                          <div>
                            <p className="font-semibold text-emerald-950">{uploadInsight?.label}</p>
                            <p className="mt-1 text-sm leading-7 text-emerald-900">{uploadInsight?.contribution}</p>
                          </div>
                        </div>
                      </div>

                      <div
                        className={`rounded-[1.3rem] border p-4 ${
                          engineStatus.tone === "success"
                            ? "border-emerald-100 bg-emerald-50"
                            : engineStatus.tone === "warning"
                              ? "border-amber-200 bg-amber-50"
                              : "border-slate-200 bg-slate-50"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {engineStatus.tone === "warning" ? (
                            <AlertCircle className="mt-1 h-5 w-5 shrink-0 text-amber-700" strokeWidth={1.8} />
                          ) : (
                            <ShieldCheck className="mt-1 h-5 w-5 shrink-0 text-teal-700" strokeWidth={1.8} />
                          )}
                          <div>
                            <p className="font-semibold text-slate-950">{engineStatus.title}</p>
                            <p className="mt-1 text-sm leading-7 text-slate-700">{engineStatus.description}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[1.2rem] border border-slate-200 bg-white p-4 text-sm leading-7 text-slate-700">
                    Lo confirmado aparece separado de lo estimado para que sepas qué ya está claro, qué todavía conviene revisar con calma y qué ya forma parte de tu expediente digital.
                  </div>

                  {lastHeliosOpinion ? (
                    <div className="rounded-[1.3rem] border border-teal-100 bg-white p-4 sm:p-5">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-teal-700">Lectura preliminar del expediente</p>
                            <h3 className="mt-2 text-xl font-semibold text-slate-950">Este documento ya quedó integrado a tu expediente con una primera lectura útil</h3>

                          <p className="mt-3 text-sm leading-7 text-slate-700">
                            {warmVisibleNamingCopy(lastHeliosOpinion.summary) ?? "Ya se generó una lectura preliminar útil para seguir armando tu expediente."}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs font-semibold">
                          <span className={`rounded-full px-3 py-1 ${getHeliosRiskCopy(lastHeliosOpinion.riskLevel).classes}`}>
                            {getHeliosRiskCopy(lastHeliosOpinion.riskLevel).label}
                          </span>
                          {typeof lastHeliosOpinion.confidenceScore === "number" ? (
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">Confianza {lastHeliosOpinion.confidenceScore}%</span>
                          ) : null}
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">{getHeliosModeLabel(lastHeliosOpinion.mode)}</span>
                        </div>
                      </div>

                      {lastHeliosOpinion.legalOpinion ? (
                        <div className="mt-4 rounded-[1rem] border border-slate-200 bg-slate-50 p-4 text-sm leading-7 text-slate-700">
                          {warmVisibleNamingCopy(lastHeliosOpinion.legalOpinion)}
                        </div>
                      ) : null}

                      <div className="mt-4 grid gap-4 lg:grid-cols-2">
                        <div className="rounded-[1rem] border border-teal-100 bg-teal-50 p-4">
                          <p className="font-semibold text-teal-950">Qué conviene hacer después</p>
                          <p className="mt-2 text-sm leading-7 text-teal-900">
                            {warmVisibleNamingCopy(lastHeliosOpinion.recommendedNextStep) ?? "Seguir conectando este documento con otros archivos del expediente para afinar la lectura y fortalecer tu respaldo."}
                          </p>
                          {lastHeliosOpinion.recommendedActions?.length ? (
                            <div className="mt-3 space-y-2 text-sm leading-6 text-teal-950">
                              {lastHeliosOpinion.recommendedActions.map((item) => (
                                <p key={item}>• {warmVisibleNamingCopy(item)}</p>
                              ))}
                            </div>
                          ) : null}
                        </div>

                        <div className="rounded-[1rem] border border-amber-200 bg-amber-50 p-4">
                          <p className="font-semibold text-amber-950">Qué sigue siendo preliminar</p>
                          {lastHeliosOpinion.uncertainties?.length ? (
                            <div className="mt-2 space-y-2 text-sm leading-6 text-amber-950">
                              {lastHeliosOpinion.uncertainties.map((item) => (
                                <p key={item}>• {warmVisibleNamingCopy(item)}</p>
                              ))}
                            </div>
                          ) : (
                            <p className="mt-2 text-sm leading-7 text-amber-900">
                              Esta lectura todavía conviene contrastarla con más hechos y documentos antes de cerrar conclusiones.
                            </p>
                          )}
                          <p className="mt-3 text-xs font-medium uppercase tracking-[0.12em] text-amber-800">
                            Generado: {formatDate(lastHeliosOpinion.generatedAt)}
                          </p>
                        </div>
                      </div>

                      {lastHeliosOpinion.disclaimer ? (
                        <p className="mt-4 text-xs leading-6 text-slate-500">{lastHeliosOpinion.disclaimer}</p>
                      ) : null}
                    </div>
                  ) : null}

                  {lastUpload?.engineDispatch?.status === "sent" ? (
                    <div className="rounded-[1.3rem] border border-sky-200 bg-sky-50 p-4 text-sm leading-7 text-sky-950">
                      <div className="flex items-start gap-3">
                        <RefreshCw className="mt-1 h-5 w-5 shrink-0 text-sky-700" strokeWidth={1.8} />
                        <div>
                          <p className="font-semibold">Seguimos esperando la respuesta automática</p>
                          <p className="mt-1">
                            Este documento ya entró a revisión automática. Aquí verás si la respuesta ya llegó, mientras sigue guardado y disponible dentro de tu expediente digital.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-[1.3rem] border border-emerald-100 bg-emerald-50 p-4">
                      <div className="flex items-center justify-between gap-4">
                        <p className="font-semibold text-emerald-950">Datos claros</p>
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-emerald-800">
                          {confirmedEntries.length} dato{confirmedEntries.length === 1 ? "" : "s"}
                        </span>
                      </div>

                      {confirmedEntries.length === 0 ? (
                        <p className="mt-3 text-sm leading-7 text-emerald-900">
                          Aquí aparecerá lo que ya se ve con claridad en este documento.
                        </p>
                      ) : (
                        <div className="mt-4 space-y-3">
                          {confirmedEntries.map(([key, value]) => (
                            <div key={key} className="rounded-[1rem] bg-white p-3">
                              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">
                                {getAnalysisFieldLabel(key)}
                              </p>
                              <p className="mt-1 text-sm leading-6 text-slate-800">{formatAnalysisValue(key, value)}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="rounded-[1.3rem] border border-amber-200 bg-amber-50 p-4">
                      <div className="flex items-center justify-between gap-4">
                        <p className="font-semibold text-amber-950">Datos a revisar</p>
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-amber-800">
                          {estimatedEntries.length} dato{estimatedEntries.length === 1 ? "" : "s"}
                        </span>
                      </div>

                      <p className="mt-3 text-sm leading-7 text-amber-900">
                        Tómalos como orientación inicial. Pueden ayudar, pero todavía conviene confirmarlos con más contexto.
                      </p>

                      <div className="mt-4 rounded-[1rem] border border-amber-200 bg-white p-3">
                        <button
                          type="button"
                          className="flex w-full items-start gap-3 text-left"
                          onClick={() => setEstimatedAcknowledged((value) => !value)}
                        >
                          <CheckCircle2
                            className={`mt-0.5 h-5 w-5 shrink-0 ${estimatedAcknowledged ? "text-emerald-600" : "text-amber-600"}`}
                            strokeWidth={1.8}
                          />
                          <div>
                            <p className="text-sm font-semibold text-slate-950">Entiendo que esto sigue en revisión</p>
                            <p className="mt-1 text-xs leading-6 text-slate-600">
                              {estimatedAcknowledged
                                ? "Perfecto. Esto queda como orientación útil, no como cierre definitivo."
                                : "Márcalo cuando tengas claro que esta parte sigue siendo orientación inicial."}
                            </p>
                          </div>
                        </button>
                      </div>

                      {estimatedEntries.length === 0 ? (
                        <p className="mt-3 text-sm leading-7 text-amber-900">
                          Por ahora no hay estimaciones adicionales que mostrar.
                        </p>
                      ) : (
                        <div className="mt-4 space-y-3">
                          {estimatedEntries.map(([key, value]) => (
                            <div key={key} className="rounded-[1rem] bg-white p-3">
                              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-700">
                                {getAnalysisFieldLabel(key)}
                              </p>
                              <p className="mt-1 text-sm leading-6 text-slate-800">{formatAnalysisValue(key, value)}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {guardrails.length > 0 ? (
                    <div className="rounded-[1.3rem] border border-slate-200 bg-white p-4">
                      <p className="font-semibold text-slate-950">Antes de tomar decisiones</p>
                      <div className="mt-3 space-y-2 text-sm leading-7 text-slate-600">
                        {guardrails.map((item) => (
                          <p key={item}>• {item}</p>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">Línea de tiempo del expediente</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950">
                    Cómo se fue fortaleciendo tu expediente
                  </h2>
                  <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">
                     Documento por documento, aquí ves cómo se fueron conectando señales para darte más claridad sobre tu caso.

                  </p>
                  {timelineEntries.length > timelinePreviewLimit ? (
                    <p className="mt-3 text-xs leading-6 text-slate-500 sm:hidden">
                      En móvil te mostramos primero lo esencial para reducir scroll. Si quieres, puedes abrir el resto en cualquier momento.
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-col items-start gap-2 sm:items-end">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                    <span className="rounded-full border border-amber-200 bg-amber-100 px-3 py-1 text-amber-900">Borrador analizado</span>
                    <span className="rounded-full border border-emerald-200 bg-emerald-100 px-3 py-1 text-emerald-800">Documento confirmado</span>
                  </div>
                  <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                    {timelineEntries.length} etapa{timelineEntries.length === 1 ? "" : "s"}
                  </div>
                </div>
              </div>

              {timelineEntries.length === 0 ? (
                <div className="mt-6 rounded-[1.3rem] border border-slate-200 bg-slate-50 p-5 text-sm leading-7 text-slate-600">
                    Tu línea de tiempo está esperando. Sube tu primer documento para ver cómo empieza a construirse tu expediente digital paso a paso y cómo todo queda disponible para ti 24/7.

                </div>
              ) : (
                <div className="mt-6 space-y-4">
                  {timelineEntries.map((entry, index) => (
                    <div
                      key={entry.id}
                      className={`${index >= timelinePreviewLimit && !timelineExpandedOnMobile ? "hidden sm:flex" : "flex"} gap-4 transition-all duration-200`}
                    >
                      <div className="flex w-10 shrink-0 flex-col items-center">
                        <div
                          className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold transition-all duration-200 ${
                            entry.hasVisibleOpinion ? "bg-teal-600 text-white shadow-sm" : "bg-slate-200 text-slate-700"
                          }`}
                        >
                          {entry.step}
                        </div>
                        {index !== timelineEntries.length - 1 ? <div className="mt-2 w-px flex-1 bg-slate-200" /> : null}
                      </div>

                      <article
                        className={`flex-1 rounded-[1.35rem] border p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm ${entry.lifecycleState.cardClasses}`}
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-semibold text-slate-950">{entry.title}</p>
                              <span className={`inline-flex rounded-full px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em] ${entry.lifecycleState.badgeClasses}`}>
                                {entry.lifecycleState.label}
                              </span>
                            </div>
                            <p className="mt-1 text-sm leading-6 text-slate-600">{entry.originalName}</p>
                            <p className="mt-1 text-xs leading-6 text-slate-500">Incorporado el {formatDate(entry.createdAt)}</p>
                            <p className="mt-2 text-xs leading-5 text-slate-600">{entry.lifecycleState.supportingCopy}</p>
                          </div>
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${entry.readiness.classes}`}>{entry.readiness.label}</span>
                        </div>

                        <div className="mt-4 grid gap-3 lg:grid-cols-2">
                          <div className="rounded-[1rem] border border-white bg-white p-3">
                            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Lo que aportó</p>
                            <p className="mt-2 text-sm leading-7 text-slate-700">{entry.contribution}</p>
                          </div>
                          <div className={`rounded-[1rem] border p-3 ${entry.lifecycleState.roleCardClasses}`}>
                            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-700">Cómo aportó al expediente</p>
                            <p className="mt-2 text-sm leading-7 text-slate-900">{entry.heliosRole}</p>
                          </div>
                        </div>
                      </article>
                    </div>
                  ))}

                  {timelineEntries.length > timelinePreviewLimit ? (
                    <button
                      type="button"
                      className="inline-flex items-center rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:text-slate-950 active:scale-[0.99] sm:hidden"
                      onClick={() => setTimelineExpandedOnMobile((value) => !value)}
                    >
                      {timelineExpandedOnMobile
                        ? "Mostrar menos"
                        : `Mostrar ${mobileHiddenTimelineCount} etapa${mobileHiddenTimelineCount === 1 ? "" : "s"} más`}
                    </button>
                  ) : null}
                </div>
              )}
            </div>

            <div className="rounded-[1.6rem] border border-slate-200 bg-white p-4 shadow-sm xl:hidden">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">Seguimiento rápido</p>
                  <h2 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-slate-950">Cómo va la respuesta automática</h2>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                  {complilinkMonitoring?.summary.waitingCount ?? 0} en espera
                </span>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-[1rem] border border-slate-200 bg-slate-50 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">En espera</p>
                  <p className="mt-2 text-xl font-semibold text-slate-950">{complilinkMonitoring?.summary.waitingCount ?? 0}</p>
                </div>
                <div className="rounded-[1rem] border border-amber-200 bg-amber-50 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-700">Revisar</p>
                  <p className="mt-2 text-xl font-semibold text-amber-950">{complilinkMonitoring?.summary.attentionCount ?? 0}</p>
                </div>
                <div className="rounded-[1rem] border border-emerald-100 bg-emerald-50 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-700">Listos</p>
                  <p className="mt-2 text-xl font-semibold text-emerald-950">{complilinkMonitoring?.summary.receivedCount ?? 0}</p>
                </div>
              </div>

              <div className={`mt-4 rounded-[1rem] border p-4 text-sm leading-6 ${monitoringOverview.classes}`}>
                <p className="font-semibold">{monitoringOverview.title}</p>
                <p className="mt-2">{monitoringOverview.body}</p>
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">Tus documentos</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950">
                    Documentos ya incorporados al expediente
                  </h2>
                </div>
                <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                  {documents.length} documento{documents.length === 1 ? "" : "s"}
                </div>
              </div>

              <div className="mt-6 space-y-4">
                {documents.length === 0 ? (
                  <div className="rounded-[1.3rem] border border-slate-200 bg-slate-50 p-5 text-sm leading-7 text-slate-600">
                    Aún no tienes documentos en este expediente. Puedes empezar con el archivo que tengas más a la mano.
                  </div>
                ) : (
                  documents.map((document) => {
                    const readiness = getDocumentReadiness(document.classificationConfidence);
                    const heliosOpinion = asHeliosOpinion(document.heliosOpinion);
                    const heliosRisk = getHeliosRiskCopy(heliosOpinion?.riskLevel);
                    const heliosDocument = heliosDocumentSnapshotById.get(document.documentId);
                    return (
                      <article key={document.documentId} className="rounded-[1.4rem] border border-slate-200 bg-slate-50 p-4">
                        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                          <div>
                            <p className="font-semibold text-slate-950">{document.originalName}</p>
                            <p className="mt-1 text-sm leading-6 text-slate-600">
                              Tipo sugerido: {heliosDocument?.canonicalLabel ?? getSimpleDocumentTypeLabel(document.documentType)}
                            </p>
                            <p className="mt-1 text-sm leading-6 text-slate-500">Incorporado el {formatDate(document.createdAt)}</p>
                          </div>

                          <div className="flex flex-wrap gap-2 text-xs font-semibold">
                            <span className={`rounded-full px-3 py-1 ${readiness.classes}`}>{readiness.label}</span>
                            <span className="rounded-full bg-white px-3 py-1 text-slate-700">{getConsentLabel(document.consentStatus)}</span>
                            <span className="rounded-full bg-white px-3 py-1 text-slate-700">{getVisibilityLabel(document.visibility)}</span>
                            <span className={`rounded-full px-3 py-1 ${heliosOpinion ? "bg-teal-100 text-teal-800" : "bg-slate-200 text-slate-700"}`}>
                              {heliosDocument?.statusLabel ?? (heliosOpinion ? "Lectura preliminar lista" : "Lectura pendiente")}
                            </span>
                          </div>
                        </div>

                        <div className="mt-4 rounded-[1rem] bg-white p-3 text-sm leading-6 text-slate-700">
                          {readiness.description}
                        </div>

                        <div className="mt-4 rounded-[1rem] border border-teal-100 bg-teal-50 p-3 text-sm leading-6 text-teal-950">
                          <p className="font-semibold text-teal-950">
                            {heliosDocument ? `${heliosDocument.canonicalLabel} dentro de tu expediente laboral` : "Este archivo ya pertenece a tu expediente laboral"}
                          </p>
                          <p className="mt-1">
                              {warmVisibleNamingCopy(heliosDocument?.summary) ?? "Tu asistente laboral tomará este documento como una unidad laboral visible para futuras lecturas, cruces y recomendaciones dentro del expediente."}
                          </p>
                        </div>

                        {heliosOpinion ? (
                          <details className="mt-4 rounded-[1rem] border border-teal-100 bg-white p-4">
                            <summary className="flex cursor-pointer list-none items-start justify-between gap-4">
                              <div>
                                <p className="text-sm font-semibold text-slate-950">Abrir lectura preliminar</p>
                                <p className="mt-1 text-sm leading-6 text-slate-600">
                                  {warmVisibleNamingCopy(heliosOpinion.summary) ?? "Ya hay una lectura inicial guardada dentro de tu expediente laboral."}
                                </p>
                              </div>
                              <div className="flex flex-wrap gap-2 text-xs font-semibold">
                                <span className={`rounded-full px-3 py-1 ${heliosRisk.classes}`}>{heliosRisk.label}</span>
                                <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">{getHeliosModeLabel(heliosOpinion.mode)}</span>
                              </div>
                            </summary>

                            <div className="mt-4 space-y-4 border-t border-slate-200 pt-4">
                              {heliosOpinion.legalOpinion ? (
                                <div className="rounded-[1rem] bg-slate-50 p-3 text-sm leading-7 text-slate-700">{heliosOpinion.legalOpinion}</div>
                              ) : null}

                              <div className="grid gap-4 lg:grid-cols-2">
                                <div className="rounded-[1rem] border border-teal-100 bg-teal-50 p-3">
                                  <p className="font-semibold text-teal-950">Siguiente paso sugerido</p>
                                  <p className="mt-2 text-sm leading-7 text-teal-900">
                                    {heliosOpinion.recommendedNextStep ?? "Conectar este archivo con más evidencia del expediente."}
                                  </p>
                                  {heliosOpinion.recommendedActions?.length ? (
                                    <div className="mt-3 space-y-2 text-sm leading-6 text-teal-950">
                                      {heliosOpinion.recommendedActions.map((item) => (
                                        <p key={item}>• {warmVisibleNamingCopy(item)}</p>
                                      ))}
                                    </div>
                                  ) : null}
                                </div>

                                <div className="rounded-[1rem] border border-amber-200 bg-amber-50 p-3">
                                  <p className="font-semibold text-amber-950">Puntos que todavía conviene confirmar</p>
                                  {heliosOpinion.uncertainties?.length ? (
                                    <div className="mt-2 space-y-2 text-sm leading-6 text-amber-950">
                                      {heliosOpinion.uncertainties.map((item) => (
                                        <p key={item}>• {warmVisibleNamingCopy(item)}</p>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="mt-2 text-sm leading-7 text-amber-900">
                                      Por ahora no hay observaciones adicionales visibles, pero sigue siendo una lectura preliminar.
                                    </p>
                                  )}
                                </div>
                              </div>

                              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-600">
                                {typeof heliosOpinion.confidenceScore === "number" ? (
                                  <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">Confianza {heliosOpinion.confidenceScore}%</span>
                                ) : null}
                                <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">Generado {formatDate(heliosOpinion.generatedAt)}</span>
                              </div>

                              {heliosOpinion.disclaimer ? (
                                <p className="text-xs leading-6 text-slate-500">{heliosOpinion.disclaimer}</p>
                              ) : null}
                            </div>
                          </details>
                        ) : (
                          <div className="mt-4 rounded-[1rem] border border-dashed border-slate-200 bg-white p-3 text-sm leading-6 text-slate-500">
                            Todavía no hay una lectura visible guardada para este documento dentro de tu expediente laboral.
                          </div>
                        )}
                      </article>
                    );
                  })
                )}
              </div>
            </div>
          </section>

          <aside className="space-y-6">
            <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">Expediente laboral seleccionado</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950">
                {heliosExpediente?.displayName ?? caseDetailQuery.data?.case.title ?? "Selecciona un expediente"}
              </h2>
              <div className="mt-4 space-y-3 text-sm leading-7 text-slate-600">
                <p>
                  <span className="font-semibold text-slate-900">Persona trabajadora:</span>{" "}
                  {caseDetailQuery.data?.case.employeeName ?? "Sin nombre visible"}
                </p>
                <p>
                  <span className="font-semibold text-slate-900">Patrón o empresa:</span>{" "}
                  {caseDetailQuery.data?.case.employerEntity ?? "Sin empresa visible"}
                </p>
                <p>
                  <span className="font-semibold text-slate-900">Estado del caso:</span>{" "}
                  {getCaseStatusLabel(caseDetailQuery.data?.case.status)}
                </p>
                <p>
                  <span className="font-semibold text-slate-900">Etapa del expediente:</span>{" "}
                  {heliosExpediente?.stageLabel ?? "Sin etapa visible"}
                </p>
              </div>

              <div className="mt-4 rounded-[1.2rem] border border-teal-100 bg-teal-50 p-4">
                <div className="flex items-start gap-3">
                  <Sparkles className="mt-1 h-5 w-5 shrink-0 text-teal-700" strokeWidth={1.8} />
                  <div>
                        <p className="font-semibold text-teal-950">Tu expediente se va volviendo más claro con cada documento</p>

                    <p className="mt-2 text-sm leading-7 text-teal-900">
                      {heliosExpediente?.summary ??
                        (heliosDocumentsCount === 0
                          ? "Todavía no hay una lectura visible del expediente. En cuanto se interpreten documentos, aquí verás cómo se va armando una explicación más útil para tu caso."
                          : `Ya hay una lectura preliminar para ${heliosDocumentsCount} documento${heliosDocumentsCount === 1 ? "" : "s"} y esa información se va conectando para construir una explicación cada vez más útil del caso.`)}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                      <span className="rounded-full bg-white px-3 py-1 text-slate-700">
                        {heliosExpediente?.documentsCount ?? documents.length} documento{(heliosExpediente?.documentsCount ?? documents.length) === 1 ? "" : "s"} en el expediente
                      </span>
                      <span className="rounded-full bg-white px-3 py-1 text-slate-700">
                        {heliosExpediente?.documentsWithOpinion ?? heliosDocumentsCount} con lectura visible
                      </span>
                    </div>
                    {latestPersistedHeliosOpinion ? (
                      <div className="mt-3 rounded-[1rem] bg-white p-3 text-sm leading-6 text-slate-700">
                        <p className="font-semibold text-slate-950">Última lectura guardada en tu expediente</p>
                        <p className="mt-1">{warmVisibleNamingCopy(latestPersistedHeliosOpinion.summary)}</p>
                        <p className="mt-2 text-xs text-slate-500">Documento: {latestHeliosDocument?.originalName ?? "Sin detalle visible"}</p>
                      </div>
                    ) : null}
                    <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                      <Button
                        className="rounded-full bg-slate-950 text-white hover:bg-slate-800"
                        onClick={() => setHeliosCopilotOpen(true)}
                        disabled={!selectedCaseId || legalGateRequired}
                      >
                        Abrir tu asistente laboral
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-full border-teal-200 text-teal-900 hover:bg-teal-100"
                        onClick={openPreferredPicker}
                      >
                        Subir otro documento
                      </Button>
                    </div>
                    <p className="mt-3 text-xs leading-6 text-teal-900">
                      Haz preguntas rápidas sobre riesgos, documentos faltantes o el siguiente paso útil con base en lo que ya se analizó, sin salir de tu expediente.
                    </p>
                      <HeliosCopilotSheet
                        open={heliosCopilotOpen}
                        onOpenChange={setHeliosCopilotOpen}
                        onSendMessage={handleHeliosCopilotSend}
                        messages={heliosCopilotConversation}
                        isLoading={heliosCopilotMutation.isPending}
                        suggestedPrompts={heliosCopilotSuggestedPrompts}
                        caseTitle={caseDetailQuery.data?.case.title}
                        employeeName={caseDetailQuery.data?.case.employeeName}
                        confidenceScore={heliosCopilotMutation.data?.confidenceScore ?? visibleHeliosOpinion?.confidenceScore ?? null}
                        disclaimer={warmVisibleNamingCopy(heliosCopilotMutation.data?.disclaimer ?? visibleHeliosOpinion?.disclaimer ?? null)}
                        summary={warmVisibleNamingCopy(visibleHeliosOpinion?.summary ?? null)}
                        historyItems={heliosCopilotHistoryItems}
                        supportingDocuments={heliosCopilotSupportingDocuments}
                      />

                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">Historial simple del expediente</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950">Lo último que se movió en tu caso</h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                Así puedes entender qué pasó recientemente sin buscar entre carpetas, mensajes o varios sistemas distintos.
              </p>
              <p className="mt-3 text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
                El filtro que elijas aquí se conserva en este dispositivo para que retomes tu expediente donde lo dejaste.
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                {[
                  { value: "all", label: "Todo" },
                  { value: "document", label: "Documentos" },
                  { value: "response", label: "Respuestas" },
                  { value: "summary", label: "Resúmenes" },
                ].map((option) => {
                  const active = historyFilter === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setHistoryFilter(option.value as DossierHistoryFilter)}
                      className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                        active
                          ? "bg-slate-900 text-white shadow-sm"
                          : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-950"
                      }`}
                      aria-pressed={active}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 space-y-3">
                {filteredDossierHistoryEntries.length === 0 ? (
                  <div className="rounded-[1.2rem] border border-slate-200 bg-slate-50 p-4 text-sm leading-7 text-slate-600">
                    {historyFilter === "all"
                      ? "En cuanto subas tu primer documento, aquí verás un historial simple con lo más reciente de tu expediente."
                      : "Todavía no hay movimientos de este tipo. Cambia el filtro o sigue fortaleciendo tu expediente para ver más actividad aquí."}
                  </div>
                ) : (
                  filteredDossierHistoryEntries.map((entry) => (
                    <article key={entry.id} className="rounded-[1.2rem] border border-slate-200 bg-slate-50 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-950">{entry.title}</p>
                          <p className="mt-1 text-sm leading-6 text-slate-600">{entry.description}</p>
                        </div>
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600">{entry.tag}</span>
                      </div>
                      <p className="mt-3 text-xs leading-6 text-slate-500">{formatDate(entry.timestamp)}</p>
                    </article>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">Privacidad y consentimiento</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950">Marco legal visible para tu expediente</h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                {PRIVACY_CENTER_COPY.intro} La versión vigente que aplica hoy en AuditaPatron es {LEGAL_VERSION}.
              </p>

              <div className={`mt-4 rounded-[1.2rem] border p-4 ${legalAcceptance?.isAccepted ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className={`text-sm font-semibold ${legalAcceptance?.isAccepted ? "text-emerald-950" : "text-amber-950"}`}>
                      {legalAcceptance?.isAccepted ? "Aceptación versionada al día" : "Aceptación legal pendiente"}
                    </p>
                    <p className={`mt-2 text-sm leading-7 ${legalAcceptance?.isAccepted ? "text-emerald-900" : "text-amber-900"}`}>
                      {legalAcceptance?.isAccepted
                        ? `Tu expediente ya registra la aceptación del paquete legal ${legalAcceptance.legalVersion}.`
                        : `Todavía faltan ${legalPendingDocuments.length || LEGAL_DOCUMENTS.length} documentos por aceptar para habilitar por completo tu expediente y tu asistente laboral.`}
                    </p>
                  </div>
                  <div className="rounded-full bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-700">
                    {acceptedLegalDocumentsCount}/{legalAcceptanceDocuments.length || LEGAL_DOCUMENTS.length} aceptados
                  </div>
                </div>
                {legalAcceptance?.acceptedAt ? (
                  <p className={`mt-3 text-xs uppercase tracking-[0.12em] ${legalAcceptance?.isAccepted ? "text-emerald-800" : "text-amber-800"}`}>
                    Última aceptación registrada: {formatDate(legalAcceptance.acceptedAt)}
                  </p>
                ) : null}
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {PRIVACY_CENTER_COPY.rightsSummary.map((item) => (
                  <div key={item} className="rounded-[1.2rem] border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                    {item}
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-[1.2rem] border border-teal-100 bg-teal-50 p-4">
                <p className="text-sm font-semibold text-teal-950">Revocación y derechos ARCO</p>
                <p className="mt-2 text-sm leading-7 text-teal-900">{PRIVACY_CENTER_COPY.revocationNotice}</p>
                <p className="mt-3 text-sm leading-7 text-teal-900">
                  Si quieres ejercer derechos ARCO o pedir apoyo, escríbenos a{" "}
                  <a className="font-semibold underline underline-offset-4" href={`mailto:${LEGAL_CONTACT_EMAIL}`}>
                    {LEGAL_CONTACT_EMAIL}
                  </a>
                  .
                </p>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {LEGAL_DOCUMENTS.map((document) => (
                  <a
                    key={document.slug}
                    href={document.route}
                    className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-700 transition hover:border-slate-300 hover:text-slate-950"
                  >
                    {document.shortTitle}
                  </a>
                ))}
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">Ciclo de valor visible</p>
              <div className="mt-2 flex items-start gap-3">
                <div className="rounded-[1rem] border border-teal-100 bg-teal-50 p-2">
                  <Sparkles className="h-5 w-5 text-teal-700" strokeWidth={1.8} />
                </div>
                <div>
                  <h2 className="text-2xl font-semibold tracking-[-0.03em] text-slate-950">Así se fortalece tu expediente</h2>
                  <p className="mt-2 text-sm leading-7 text-slate-600">
                    AuditaPatron recibe tus documentos, los organiza, los contrasta, los resguarda y te devuelve una explicación cada vez más clara y útil.
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-4">
                <article className="rounded-[1.25rem] border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Paso 1</p>
                    <p className="mt-2 font-semibold text-slate-950">AuditaPatron recibe y protege</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      Tu archivo entra a un expediente seguro, queda resguardado y listo para ordenarse sin que tengas que hacer pasos técnicos extra.
                    </p>

                </article>
                <article className="rounded-[1.25rem] border border-teal-100 bg-teal-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-700">Paso 2</p>
                    <p className="mt-2 font-semibold text-slate-950">La revisión encuentra contexto útil</p>
                    <p className="mt-2 text-sm leading-6 text-teal-950">

                    {heliosDocumentsCount === 0
                        ? "En cuanto haya lectura visible, empezaremos a decirte qué ya se entendió y qué conviene reforzar, incluyendo señales útiles de IMSS e Infonavit cuando existan en tu expediente."
                        : `Ya se conectaron ${heliosDocumentsCount} documento${heliosDocumentsCount === 1 ? "" : "s"} para encontrar señales, diferencias y siguientes pasos útiles.`}

                  </p>
                </article>
                <article className="rounded-[1.25rem] border border-sky-100 bg-sky-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-700">Paso 3</p>
                  <p className="mt-2 font-semibold text-slate-950">La respuesta vuelve más completa</p>
                  <p className="mt-2 text-sm leading-6 text-sky-950">
                    {monitoringDocuments.length === 0
                      ? "Cuando haya seguimiento activo, aquí verás cómo la revisión automática vuelve con más detalle para fortalecer el expediente."
                      : `Hoy hay ${monitoringDocuments.length} documento${monitoringDocuments.length === 1 ? "" : "s"} dentro del ciclo automático de revisión.`}
                  </p>
                </article>
                <article className="rounded-[1.25rem] border border-emerald-100 bg-emerald-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">Paso 4</p>
                    <p className="mt-2 font-semibold text-slate-950">Tú recibes una guía más clara</p>

                  <p className="mt-2 text-sm leading-6 text-emerald-950">
                    Las alertas, comparaciones y siguientes documentos sugeridos aparecen en lenguaje simple para ayudarte a decidir con calma.
                  </p>
                </article>
              </div>

              <div className="mt-4 rounded-[1.2rem] border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-950">Por qué esto te aporta más valor con el tiempo</p>
                <p className="mt-2 text-sm leading-7 text-slate-700">
                  Cada documento nuevo fortalece tu expediente, y cada retorno útil de la revisión automática ayuda a afinar la lectura del caso. Así recibes resultados más consistentes sin sumar complejidad.
                </p>
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">Seguimiento automático</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950">Cómo va la respuesta automática</h2>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-[1.1rem] border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">En espera</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-950">{complilinkMonitoring?.summary.waitingCount ?? 0}</p>
                </div>
                <div className="rounded-[1.1rem] border border-amber-200 bg-amber-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-700">Conviene revisar</p>
                  <p className="mt-2 text-2xl font-semibold text-amber-950">{complilinkMonitoring?.summary.attentionCount ?? 0}</p>
                </div>
                <div className="rounded-[1.1rem] border border-emerald-100 bg-emerald-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">Ya respondidos</p>
                  <p className="mt-2 text-2xl font-semibold text-emerald-950">{complilinkMonitoring?.summary.receivedCount ?? 0}</p>
                </div>
              </div>

              <div className={`mt-4 rounded-[1.3rem] border p-4 ${monitoringOverview.classes}`}>
                <p className="font-semibold">{monitoringOverview.title}</p>
                <p className="mt-2 text-sm leading-7">{monitoringOverview.body}</p>
              </div>

              <div className="mt-4 rounded-[1.3rem] border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Embudo operativo mínimo</p>
                    <p className="mt-2 text-lg font-semibold text-slate-950">Del acceso inicial al primer documento útil</p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                    {operationalFunnelCompletedCount}/{operationalFunnelSteps.length} hitos visibles
                  </span>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {operationalFunnelSteps.map((step, index) => (
                    <div
                      key={step.id}
                      className={`rounded-[1.1rem] border p-4 ${
                        step.completed
                          ? "border-emerald-200 bg-emerald-50"
                          : "border-slate-200 bg-white"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Paso {index + 1}</p>
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                            step.completed
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {step.completed ? "Listo" : "Pendiente"}
                        </span>
                      </div>
                      <p className="mt-3 font-semibold text-slate-950">{step.label}</p>
                      <p className="mt-2 text-sm leading-6 text-slate-700">{step.detail}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-4 rounded-[1rem] border border-slate-200 bg-white p-4 text-sm leading-7 text-slate-700">
                  {operationalFunnelNextStep
                    ? `Siguiente hito visible: ${operationalFunnelNextStep.label.toLowerCase()}. Cuando ese paso cambie, esta lectura mínima te dejará ver rápidamente en qué parte exacta se está cayendo el recorrido.`
                    : "Los cuatro hitos mínimos ya aparecen cubiertos en este expediente. A partir de aquí el valor operativo se concentra en la calidad del seguimiento y en las respuestas automáticas."}
                </div>
              </div>

              {pendingMonitoringDocuments.length === 0 ? (
                <div className="mt-4 rounded-[1.3rem] border border-slate-200 bg-slate-50 p-4 text-sm leading-7 text-slate-700">
                  {monitoringDocuments.length === 0
                    ? "Todavía no hay documentos en seguimiento automático visible. En cuanto subas archivos, aquí verás cómo van avanzando."
                    : "Por ahora no hay respuestas pendientes fuera del tiempo normal. Si subes más archivos, seguirás viendo el avance en este mismo espacio."}
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {pendingMonitoringDocuments.map((item) => {
                    const state = getMonitoringStatusCopy(item.status);
                    const friendlyMessage =
                      item.status === "attention"
                        ? "La respuesta está tardando un poco más de lo normal, pero tu documento sigue resguardado dentro del expediente."
                        : "Este documento ya entró a revisión automática y está esperando respuesta. Mientras llega, puedes seguir fortaleciendo tu expediente con otros archivos.";
                    return (
                      <div key={item.documentId} className="rounded-[1.2rem] border border-slate-200 bg-slate-50 p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-sm font-semibold text-slate-950">{item.documentName}</p>
                            <p className="mt-1 text-sm leading-6 text-slate-600">{friendlyMessage}</p>
                          </div>
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${state.classes}`}>{state.label}</span>
                        </div>
                        <div className="mt-3 text-xs leading-6 text-slate-500">
                          <p>Enviado el {item.dispatchedAt ? formatDate(item.dispatchedAt) : "sin fecha visible"}</p>
                          {item.respondedAt ? <p>Respondido el {formatDate(item.respondedAt)}</p> : null}
                          {item.responseEvent ? <p>Último movimiento: {getReturnEventLabel(item.responseEvent)}</p> : null}
                        </div>
                        <div className="mt-3 rounded-[1rem] border border-white bg-white p-3 text-sm leading-6 text-slate-700">
                          {item.message}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">Comparación guiada</p>
              <div className="mt-2 flex items-start gap-3">
                <div className="rounded-[1rem] border border-teal-100 bg-teal-50 p-2">
                  <FileSearch className="h-5 w-5 text-teal-700" strokeWidth={1.8} />
                </div>
                <div>
                    <h2 className="text-2xl font-semibold tracking-[-0.03em] text-slate-950">¿Qué cambió aquí?</h2>
                    <p className="mt-2 text-sm leading-7 text-slate-600">
                      Comparamos documentos del expediente para resaltar diferencias útiles y ayudarte a entender qué conviene revisar después, sin perder de vista que todo queda ordenado en un solo lugar.
                    </p>

                </div>
              </div>

              <div className="mt-4 rounded-[1.2rem] border border-slate-200 bg-slate-50 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">Compara tú mismo dos documentos del expediente</p>
                    <p className="mt-1 text-sm leading-7 text-slate-600">
                      Si quieres, puedes cambiar la pareja sugerida para revisar otro contraste sin salir del expediente.
                    </p>
                  </div>
                  {automaticComparisonPair ? (
                    <Button
                      variant="outline"
                      className="rounded-full border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                      onClick={() => {
                        setSelectedComparisonLeftId(automaticComparisonPair[0].documentId);
                        setSelectedComparisonRightId(automaticComparisonPair[1].documentId);
                      }}
                    >
                      Usar la comparación sugerida
                    </Button>
                  ) : null}
                </div>

                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Documento 1</p>
                    <Select value={selectedComparisonLeftId} onValueChange={setSelectedComparisonLeftId} disabled={comparisonSelectionLocked}>
                      <SelectTrigger className="mt-2 h-11 w-full rounded-[1rem] border-slate-200 bg-white">
                        <SelectValue placeholder="Selecciona un documento" />
                      </SelectTrigger>
                      <SelectContent>
                        {comparisonDocuments.map((document) => (
                          <SelectItem
                            key={document.documentId}
                            value={document.documentId}
                            disabled={document.documentId === selectedComparisonRightId}
                          >
                            {document.originalName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Documento 2</p>
                    <Select value={selectedComparisonRightId} onValueChange={setSelectedComparisonRightId} disabled={comparisonSelectionLocked}>
                      <SelectTrigger className="mt-2 h-11 w-full rounded-[1rem] border-slate-200 bg-white">
                        <SelectValue placeholder="Selecciona otro documento" />
                      </SelectTrigger>
                      <SelectContent>
                        {comparisonDocuments.map((document) => (
                          <SelectItem
                            key={document.documentId}
                            value={document.documentId}
                            disabled={document.documentId === selectedComparisonLeftId}
                          >
                            {document.originalName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {comparisonSelectionLocked ? (
                  <p className="mt-3 text-xs leading-6 text-slate-500">
                    Sube al menos dos documentos para activar la comparación manual.
                  </p>
                ) : comparisonSuggestedLabel ? (
                  <p className="mt-3 text-xs leading-6 text-slate-500">Sugerencia actual: {comparisonSuggestedLabel}.</p>
                ) : null}
              </div>

              <div className="mt-4 rounded-[1.3rem] border border-teal-100 bg-teal-50 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm">
                <p className="text-sm font-semibold text-teal-900">{comparisonCopy.badge}</p>
                <p className="mt-2 text-xl font-semibold text-slate-950">{comparisonCopy.headline}</p>
                <p className="mt-2 text-sm leading-7 text-teal-950">{comparisonCopy.supportingText}</p>
              </div>

              {comparisonLeftDocument && comparisonRightDocument ? (
                <div className="mt-4 grid gap-3 xl:grid-cols-[1fr_1fr_0.9fr]">
                  <article className="rounded-[1.2rem] border border-slate-200 bg-slate-50 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Documento original</p>
                    <p className="mt-2 font-semibold text-slate-950">{comparisonLeftDocument.originalName}</p>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
                      <span className="rounded-full bg-white px-3 py-1">{getSimpleDocumentTypeLabel(comparisonLeftDocument.documentType)}</span>
                      <span className="rounded-full bg-white px-3 py-1">{formatDate(comparisonLeftDocument.createdAt)}</span>
                    </div>
                    <p className="mt-3 text-sm leading-7 text-slate-700">
                      {asHeliosOpinion(comparisonLeftDocument.heliosOpinion)?.summary ?? "Este documento ya forma parte del expediente y sirve como punto de partida para el contraste."}
                    </p>
                  </article>

                  <article className="rounded-[1.2rem] border border-slate-200 bg-slate-50 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Documento comparado</p>
                    <p className="mt-2 font-semibold text-slate-950">{comparisonRightDocument.originalName}</p>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
                      <span className="rounded-full bg-white px-3 py-1">{getSimpleDocumentTypeLabel(comparisonRightDocument.documentType)}</span>
                      <span className="rounded-full bg-white px-3 py-1">{formatDate(comparisonRightDocument.createdAt)}</span>
                    </div>
                    <p className="mt-3 text-sm leading-7 text-slate-700">
                      {asHeliosOpinion(comparisonRightDocument.heliosOpinion)?.summary ?? "Este documento añade una segunda referencia para entender mejor qué cambió o qué falta aclarar."}
                    </p>
                  </article>

                  <article className="rounded-[1.2rem] border border-emerald-100 bg-emerald-50 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">Resumen de diferencias</p>
                    <p className="mt-2 font-semibold text-slate-950">Lo primero que conviene revisar</p>
                    <p className="mt-3 text-sm leading-7 text-emerald-950">{comparisonCopy.cards[1]?.body}</p>
                    <p className="mt-3 text-xs leading-6 text-emerald-900">Último punto comparado: {formatDate(comparisonRightDocument.createdAt)}</p>
                  </article>
                </div>
              ) : null}

              <div className="mt-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-teal-700" strokeWidth={1.8} />
                  <p className="text-sm font-semibold text-slate-950">Alertas priorizadas</p>
                </div>
                <p className="mt-1 text-sm leading-7 text-slate-600">
                    Convertimos señales repetidas y puntos sensibles en alertas más fáciles de priorizar dentro de un expediente claro, ordenado y siempre disponible para ti.

                </p>
                <div className="mt-3 grid gap-3">
                  {comparisonAlerts.map((alert) => (
                    <Alert key={alert.id} className={`${alert.toneClasses} transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm`}>
                      {alert.icon === "alert" ? (
                        <AlertCircle className="h-4 w-4" strokeWidth={1.8} />
                      ) : alert.icon === "file" ? (
                        <FileSearch className="h-4 w-4" strokeWidth={1.8} />
                      ) : (
                        <Sparkles className="h-4 w-4" strokeWidth={1.8} />
                      )}
                      <AlertTitle>{alert.eyebrow}</AlertTitle>
                      <AlertDescription className="text-current">
                        <p className="font-semibold text-current">{alert.title}</p>
                        <p>{alert.body}</p>
                        {alert.timestampLabel || alert.reasonLabel || alert.actionLabel ? (
                          <div className="mt-3 grid gap-2 text-xs leading-6 text-current/80 sm:grid-cols-3">
                            <div className="rounded-[0.9rem] bg-white/60 px-3 py-2">
                              <p className="font-semibold">Fecha y hora</p>
                              <p>{alert.timestampLabel ?? "Sin fecha visible"}</p>
                            </div>
                            <div className="rounded-[0.9rem] bg-white/60 px-3 py-2">
                              <p className="font-semibold">Motivo</p>
                              <p>{alert.reasonLabel ?? "Señal útil detectada en tu expediente"}</p>
                            </div>
                            <div className="rounded-[0.9rem] bg-white/60 px-3 py-2">
                              <p className="font-semibold">Qué puedes hacer</p>
                              <p>{alert.actionLabel ?? "Seguir fortaleciendo el expediente con calma."}</p>
                            </div>
                          </div>
                        ) : null}
                      </AlertDescription>
                    </Alert>
                  ))}
                </div>
              </div>

              <div className="mt-4 grid gap-3">
                {comparisonCopy.cards.map((card) => (
                  <div
                    key={card.title}
                    className="rounded-[1.2rem] border border-slate-200 bg-slate-50 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm"
                  >
                    <p className="font-semibold text-slate-950">{card.title}</p>
                    <p className="mt-2 text-sm leading-7 text-slate-700">{card.body}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-[1.2rem] border border-emerald-100 bg-emerald-50 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm">
                <p className="text-sm font-semibold text-emerald-900">Cómo esta comparación gana claridad</p>
                <p className="mt-2 text-sm leading-7 text-emerald-950">{comparisonCopy.coverage}</p>
                <p className="mt-2 text-xs leading-6 text-emerald-900">{comparisonCopy.guardrail}</p>
              </div>

              <Button
                className="mt-4 h-11 w-full rounded-full bg-slate-900 text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-slate-950"
                onClick={openFilePicker}
              >
                {comparisonCopy.cta}
                <ArrowRight className="ml-2 h-4 w-4" strokeWidth={1.8} />
              </Button>
            </div>

            <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">Siguiente documento recomendado</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950">Siguiente documento recomendado</h2>

              <div className="mt-4 rounded-[1.3rem] border border-teal-100 bg-teal-50 p-4">
                <p className="text-sm font-semibold text-teal-900">Lo que más puede ayudarte ahora</p>
                <p className="mt-2 text-xl font-semibold text-slate-950">{nextDocumentCopy.headline}</p>
                <p className="mt-2 text-sm leading-7 text-teal-950">{nextDocumentCopy.intro}</p>
              </div>

              <div className="mt-4 rounded-[1.2rem] border border-slate-200 bg-slate-50 p-4">
                <p className="font-semibold text-slate-950">{nextDocumentCopy.reasonTitle}</p>
                <p className="mt-2 text-sm leading-7 text-slate-700">{nextDocumentCopy.reasonBody}</p>
                <p className="mt-3 text-sm leading-7 text-slate-600">{nextDocumentCopy.followUp}</p>
              </div>

              <div className="mt-4 rounded-[1.2rem] border border-emerald-100 bg-emerald-50 p-4">
                <p className="text-sm font-semibold text-emerald-900">Cómo va creciendo tu expediente</p>
                <p className="mt-2 text-sm leading-7 text-emerald-950">{nextDocumentCopy.coverage}</p>
                <p className="mt-2 text-xs leading-6 text-emerald-900">
                  Hoy tu expediente ya cubre {dossierStatus.completed} de {dossierStatus.total} piezas clave.
                  {selectedRecommendedTargetType && effectiveRecommendedTarget
                    ? ` Además, dejamos enfocado ${effectiveRecommendedTarget.label.toLowerCase()} para que retomes esa sugerencia sin empezar de cero.`
                    : ""}
                </p>
              </div>

              <Button
                className="mt-4 h-11 w-full rounded-full bg-teal-600 text-white hover:bg-teal-700"
                onClick={() => focusRecommendedUpload(effectiveRecommendedTarget?.type ?? null)}
              >
                {nextDocumentCopy.cta}
                <ArrowRight className="ml-2 h-4 w-4" strokeWidth={1.8} />
              </Button>

              <div className="mt-4 space-y-3">
                {dossierTargets.map((item) => {
                  const isPresent = presentTypes.has(item.type);
                  return (
                    <div key={item.type} className="flex gap-3 rounded-[1.2rem] border border-slate-200 bg-slate-50 p-4">
                      <CheckCircle2 className={`mt-1 h-5 w-5 shrink-0 ${isPresent ? "text-emerald-600" : "text-slate-400"}`} strokeWidth={1.8} />
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                        <p className="text-sm leading-6 text-slate-600">{isPresent ? "Ya forma parte del expediente." : item.benefit}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">Lo que cuidamos al revisar</p>
              <div className="mt-4 space-y-3">
                {[
                  "Tu archivo queda guardado con trazabilidad.",
                  "Lo confirmado y lo estimado se muestran por separado.",
                  "Si algo necesita revisión humana, te lo diremos con claridad.",
                ].map((item) => (
                  <div key={item} className="flex gap-3 rounded-[1.2rem] border border-slate-200 bg-slate-50 p-4">
                    <ShieldCheck className="mt-1 h-5 w-5 shrink-0 text-teal-700" strokeWidth={1.8} />
                    <p className="text-sm leading-7 text-slate-700">{item}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">Qué suele aclararse mejor</p>
              <div className="mt-4 space-y-3">
                {[
                  "Diferencias entre recibos y CFDI cuando se comparan varios periodos.",
                  "Cambios repetidos en deducciones o montos a lo largo del tiempo.",
                  "Condiciones pactadas frente a lo que realmente ocurrió cuando también existe contrato o evidencia complementaria.",
                ].map((item) => (
                  <div key={item} className="flex gap-3 rounded-[1.2rem] border border-slate-200 bg-slate-50 p-4">
                    <FileSearch className="mt-1 h-5 w-5 shrink-0 text-teal-700" strokeWidth={1.8} />
                    <p className="text-sm leading-7 text-slate-700">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </div>

      <Drawer open={uploadSourceOpen} onOpenChange={setUploadSourceOpen}>
        <DrawerContent>
          <DrawerHeader className="text-left">
            <DrawerTitle>Elige cómo quieres subir tu documento</DrawerTitle>
            <DrawerDescription>
              Puedes tomar una foto en ese momento o elegir un archivo que ya tengas guardado en tu celular o computadora. Recordaremos tu opción para la siguiente vez.
            </DrawerDescription>
          </DrawerHeader>
          <div className="space-y-3 px-4 pb-2">
            <Button
              className={`h-12 w-full rounded-2xl ${
                preferredCaptureMode === "camera"
                  ? "bg-teal-600 text-white hover:bg-teal-700"
                  : "bg-slate-900 text-white hover:bg-slate-800"
              }`}
              onClick={openCameraPicker}
            >
              <Camera className="mr-2 h-4 w-4" strokeWidth={1.8} />
              Tomar foto del documento
            </Button>
            <Button
              variant="outline"
              className={`h-12 w-full rounded-2xl ${
                preferredCaptureMode === "file" || preferredCaptureMode === null
                  ? "border-teal-200 bg-teal-50 text-teal-900 hover:bg-teal-100"
                  : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
              }`}
              onClick={openFilePicker}
            >
              <FolderOpen className="mr-2 h-4 w-4" strokeWidth={1.8} />
              Elegir archivo guardado
            </Button>
          </div>
          <DrawerFooter>
            <DrawerClose asChild>
              <Button variant="outline" className="rounded-2xl border-slate-200 bg-white text-slate-700 hover:bg-slate-50">
                Cerrar
              </Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 shadow-[0_-18px_50px_-30px_rgba(15,23,42,0.45)] backdrop-blur sm:hidden">
        <div className="mx-auto max-w-6xl">
          {shouldShowInlineLegalConsent ? (
            <div className="mb-3 rounded-[1.15rem] border border-amber-200 bg-amber-50/95 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-amber-950">Confirma tu autorización en este paso</p>
                  <p className="mt-1 text-xs leading-5 text-amber-900/90">Tu aceptación se registra junto con la acción principal del documento.</p>
                </div>
                <button
                  type="button"
                  className="text-xs font-semibold text-amber-950 underline underline-offset-4"
                  onClick={() => setLegalDocumentsDrawerOpen(true)}
                >
                  Ver términos
                </button>
              </div>
              <label className="mt-3 flex items-start gap-3 rounded-[0.95rem] border border-amber-200 bg-white/85 p-3">
                <input
                  type="checkbox"
                  checked={legalGateChecked}
                  onChange={(event) => {
                    setLegalGateChecked(event.target.checked);
                    if (event.target.checked) {
                      setLegalGateError(null);
                    }
                  }}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                />
                <span className="text-xs leading-5 text-slate-700">{LEGAL_GATE_COPY.checkbox}</span>
              </label>
            </div>
          ) : null}

          <Button
            className={`h-14 w-full rounded-[1.2rem] text-base font-semibold text-white transition-all duration-300 ${
              pendingDraft && manualOverridePayload.length
                ? "bg-teal-700 shadow-[0_18px_40px_-24px_rgba(15,118,110,0.7)] hover:bg-teal-800"
                : "bg-teal-600 hover:bg-teal-700"
            }`}
            disabled={isPrimaryDocumentActionPending || !selectedTenantId || !selectedCaseId}
            onClick={() => {
              if (pendingDraft) {
                void handleConfirmDraft();
                return;
              }
              if (!selectedFile) {
                openPreferredPicker();
                return;
              }
              void handleUpload();
            }}
          >
            {isProcessingDocument
              ? pendingDraft
                ? "Guardando documento..."
                : autoAdvanceFlash
                  ? "Autoavance activado..."
                  : "Analizando documento..."
              : acceptLegalPackageMutation.isPending
                ? "Registrando autorización..."
                : pendingDraft
                  ? confirmPrimaryActionLabel
                  : uploadPrimaryActionLabel}
          </Button>
          {autoAdvanceFlash && !pendingDraft ? (
            <p className="mt-2 text-xs font-medium leading-5 text-teal-700">
              Autoavance activado: terminando el análisis abrimos la revisión rápida automáticamente.
            </p>
          ) : null}

          <div className="mt-2 flex items-center justify-between gap-3 text-xs leading-5 text-slate-500">
            <p className="min-w-0 flex-1 truncate">
              {pendingDraft
                ? manualOverridePayload.length
                  ? `Vista previa lista: ${manualOverridePayload.length} ajuste${manualOverridePayload.length === 1 ? "" : "s"} preparado${manualOverridePayload.length === 1 ? "" : "s"} antes de guardar.`
                  : `Vista previa lista: ${pendingDraft.previewAsset.fileName}`
                : selectedFile
                  ? `Borrador automático en preparación: ${selectedFile.name}`
                  : "Primero elige tu documento desde el celular o tus archivos guardados."}
            </p>
            {pendingDraft || selectedFile ? (
              <button className="font-semibold text-slate-700" onClick={pendingDraft ? restartPreviewFlow : clearSelectedFile} type="button">
                {pendingDraft ? reanalyzeDraftAction.label : "Limpiar"}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </main>
  );
}

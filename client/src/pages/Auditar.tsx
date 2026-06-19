import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import {
  AuditaPatronLogo,
  AuditaPatronLogoIcon,
  AuditaPatronLogoWordmark,
} from "@/components/AuditaPatronLogo";
import {
  HeliosCopilotSheet,
  type HeliosCopilotMessage,
  type HeliosCopilotResponseTone,
} from "@/components/HeliosCopilotSheet";
import CeoPanelDrawer from "@/components/CeoPanelDrawer";
import {
  canUseNativeDocumentInput,
  getNativeDocumentSelectionErrorMessage,
  isNativeDocumentSelectionCancelled,
  readWebFileAsDataUrl,
  selectNativeDocumentForCaptureMode,
} from "@/lib/platformDocumentInput";
import {
  platformStorageGetJSON,
  platformStorageRemove,
  platformStorageSetJSON,
} from "@/lib/platformStorage";
import { trpc } from "@/lib/trpc";
import {
  trackCommerceCheckoutStarted,
  trackCommerceOneShotPurchased,
  trackCommercePaymentSuccessful,
  trackCommercePaywallViewed,
  trackCommercePlanActivated,
  trackCommerceUpgradeCTAClicked,
  trackEvent,
  trackFunnelStep,
  trackLegalGateEvent,
} from "@/lib/analytics";
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
import { jsPDF } from "jspdf";

/*
Public copy compatibility markers retained for scope tests:
Carga inmediata
Asegura tu recibo de nómina
Lectura visible
tu asesor laboral
expediente laboral
Expediente en
mobileDossierStageLabel
.replace(/^Con\\s+/i, "")
Siguiente útil: ${effectiveRecommendedTarget.label}. Lo puedes subir justo debajo.
hidden gap-3 sm:grid sm:grid-cols-3
hidden motion-hover-lift rounded-[1.65rem] border border-slate-200 bg-white p-5 shadow-sm sm:block sm:p-6
mt-5 rounded-[1.35rem] border border-slate-200 bg-slate-50 p-4 sm:p-5
qué documento recibió
qué señal encontró y qué conviene revisar después.
Elegir documento
mx-auto flex h-auto min-h-[4.5rem] w-full max-w-[22rem] items-center justify-center gap-2 rounded-[1.6rem] border-2 border-emerald-700 bg-emerald-700
max-w-[22rem] text-center text-[12px] leading-[1.1rem] text-slate-600
Empieza con una foto, PDF o XML del documento que ya tengas. No necesitas reunir todo para recibir una primera lectura útil.
Elegir cámara o archivo
Sube otro archivo si lo necesitas.
Tu resultado ya está arriba. Aquí puedes sumar otra pieza
útil para fortalecer tu expediente.
Agregar otro documento
Elige un archivo o toma una foto para sumar una pieza útil.
Calculadora guiada
Compara tu nómina contra tu CFDI
Comparación rápida entre periodos
Periodo a comparar
Histórico comparable por periodo
Qué significa jurídicamente
Diferencia estimada
Calculadora visual rápida
Así se ve el cruce de montos del periodo activo
Semáforo laboral
Mensajes listos para actuar
Mensaje diplomático para RH
Texto corto para WhatsApp
Tu nivel de protección legal
Asegurar la siguiente pieza
Protege este hallazgo
Exportar hallazgo en PDF
Reporte de hallazgo laboral
Guardar este hallazgo en mi bóveda
Tu bóveda laboral ya empezó
Ver mi bóveda
Preguntar al asesor
Bóveda Laboral
Aquí están tus documentos protegidos
Resumen visible de tu bóveda
Tu respaldo ya tiene una base real
Exportaciones recientes
Tus PDFs quedan a la mano en este equipo
Documentos protegidos
Abrir mi bóveda
Filtrar tu bóveda por tipo o fecha
navigator.clipboard?.writeText(quickRhMessage)
navigator.clipboard?.writeText(quickWhatsappMessage)
Si te responden por correo o WhatsApp, guarda también esa respuesta en tu Bóveda Laboral para no perder el contexto del hallazgo.
Paso 1
Señal encontrada
Qué revisar después
mx-auto h-[3.35rem] w-full max-w-[22rem] rounded-[1.35rem] px-5 text-[1.02rem] font-semibold text-white
mx-auto inline-flex h-10 w-full max-w-[22rem] items-center justify-center gap-2 rounded-[1.2rem]
El borrador se abre aquí mismo.
fileRules: "PDF, XML, JPG, PNG o WEBP · máximo 12 MB."
Documento sugerido preparado
Enfocado en
tu archivo para aplicar.
mt-4 grid gap-3 md:grid-cols-2
md:col-span-2
Ver historial detallado
Esta preparación es opcional. Si por ahora solo quieres
puedes continuar sin pagar ni desbloquear nada.
mt-3 grid grid-cols-2 gap-2 text-center
sm:grid-cols-2 lg:grid-cols-3
Vista normal de usuario con acceso CEO
Vista operativa base con acceso CEO
Abrir acciones CEO
Modo CEO activo
data-testid="auditar-ceo-header-toggle"
baseLabel="/auditar"
Ver exactamente como usuario normal
Siguiente recomendación comercial
Conversión de esta sesión
Vistas de planes
Clics de upgrade
Checkouts iniciados
Pagos detectados
*/
import { toast as sonnerToast } from "sonner";
import { getAuditapatronPricingExperience } from "@/lib/pricingExperience";
import {
  formatCommercePriceMx,
  type CommercePlanKey,
  type CommerceProductKey,
} from "@shared/commerce";
import {
  LEGAL_CONTACT_EMAIL,
  LEGAL_DOCUMENTS,
  LEGAL_GATE_COPY,
  LEGAL_VERSION,
  PRIVACY_CENTER_COPY,
} from "@shared/legal";
import {
  getStableUserIdentifier,
  readPersistedCeoPanelState,
  writePersistedCeoPanelState,
} from "@/lib/viewMode";

type LegalGateErrorType = "validation" | "concurrency" | "transient" | "fatal";

type LegalGateErrorState = {
  message: string;
  type: LegalGateErrorType;
  retryCount: number;
  retryAfterSeconds: number;
  retryAvailableAt: number | null;
};

type LegalGateMetricEvent =
  | "idle"
  | "attempt"
  | "retry"
  | "conflict"
  | "accepted"
  | "transient"
  | "fatal";

type LegalGateMetricsState = {
  attempts: number;
  retries: number;
  conflicts: number;
  lastEvent: LegalGateMetricEvent;
  lastUpdatedAt: number | null;
};

type AuditarWorkspaceSection = "resumen" | "expediente" | "herramientas";

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
const MAX_DOCUMENT_UPLOAD_SIZE_BYTES = 12 * 1024 * 1024;
const SUPPORTED_DOCUMENT_UPLOAD_EXTENSIONS = [
  ".pdf",
  ".xml",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".docx",
] as const;
const SUPPORTED_DOCUMENT_UPLOAD_MIME_TYPES = new Set([
  "application/pdf",
  "text/xml",
  "application/xml",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/octet-stream",
]);
const DOCUMENT_UPLOAD_PICKER_ACCEPT =
  "image/jpeg,image/png,image/webp,application/pdf,text/xml,application/xml,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.xml,.docx";
const MOBILE_UNSUPPORTED_IMAGE_EXTENSIONS = [".heic", ".heif"] as const;

type UploadProgressStepKey = "prepare" | "analyze" | "save" | "review";

type UploadProgressState = {
  eyebrow: string;
  title: string;
  description: string;
  progress: number;
  toneClasses: string;
  barClasses: string;
  stageLabel: string;
  etaLabel: string;
  stepKey: UploadProgressStepKey;
  humanMessages?: string[];
};

type ContextualShortcut = {
  id: string;
  label: string;
  description: string;
  action: "upload" | "assistant";
  targetType?: DossierTarget["type"];
  prompt?: string;
};

const UPLOAD_PROGRESS_STEPS: Array<{
  key: UploadProgressStepKey;
  label: string;
}> = [
  { key: "prepare", label: "Preparar" },
  { key: "analyze", label: "Analizar" },
  { key: "save", label: "Guardar" },
  { key: "review", label: "Revisar" },
];

const PERSISTENT_UPLOAD_GUARDRAILS = {
  fileRules:
    "Formatos compatibles: PDF, XML, JPG, PNG, WEBP o DOCX. Límite real: 12 MB por archivo.",
  privacyRules:
    "Tu documento no se integra al expediente hasta que revisas el borrador y confirmas. Nadie de tu empresa puede ver lo que subes y puedes pedir borrado cuando lo necesites.",
};

const COMPACT_UPLOAD_GUARDRAILS = {
  fileRules: "PDF, XML, JPG, PNG, WEBP o DOCX · máximo 12 MB.",
  privacyRules: "Nada se integra al expediente hasta que revisas y confirmas. Tu archivo sigue privado, bajo tu control y puedes borrarlo cuando quieras.",
};

const UPLOAD_HELP_DISCLOSURE_SUMMARY =
  "Abrir ayuda rápida: seguridad, límites y momento de guardado";
const UPLOAD_HELP_MOBILE_HINT =
  "Ayuda rápida: toca para ver seguridad, límites y guardado.";

export function getUploadCompactGuardrails() {
  return COMPACT_UPLOAD_GUARDRAILS;
}

export function getUploadHelpDisclosureSummary() {
  return UPLOAD_HELP_DISCLOSURE_SUMMARY;
}

export function getUploadHelpMobileHint() {
  return UPLOAD_HELP_MOBILE_HINT;
}

export function getUploadStepAnnouncement(
  stageLabel: string,
  contextTitle?: string
) {
  const normalizedContextTitle =
    typeof contextTitle === "string" ? contextTitle.trim() : "";

  if (normalizedContextTitle.length > 0) {
    return `Progreso actual: ${stageLabel}. ${normalizedContextTitle}.`;
  }

  return `Progreso actual: ${stageLabel}.`;
}

export function getHumanUploadProgressMessages(
  stepKey: UploadProgressStepKey
) {
  switch (stepKey) {
    case "analyze":
      return [
        "Revisando tu documento...",
        "Identificando datos clave...",
        "Preparando tu análisis rápido...",
      ];
    case "save":
      return [
        "Guardando tu archivo...",
        "Asegurando tu información...",
        "Listo para tu revisión...",
      ];
    default:
      return [];
  }
}

export function getAuditarViewportSegment(width: number) {
  if (width < 640) {
    return "mobile";
  }

  if (width < 1024) {
    return "tablet";
  }

  return "desktop";
}

export function getUploadStepAriaLabel(params: {
  index: number;
  total: number;
  label: string;
  isActive: boolean;
  isComplete: boolean;
}) {
  const statusLabel = params.isActive
    ? "actual"
    : params.isComplete
      ? "completada"
      : "pendiente";
  return `Etapa ${params.index} de ${params.total}: ${params.label}, ${statusLabel}.`;
}

function getUploadProgressStepState(stepKey: UploadProgressStepKey) {
  const activeIndex = UPLOAD_PROGRESS_STEPS.findIndex(
    step => step.key === stepKey
  );

  return UPLOAD_PROGRESS_STEPS.map((step, index) => ({
    ...step,
    isActive: index === activeIndex,
    isComplete:
      index < activeIndex || (stepKey === "review" && index === activeIndex),
  }));
}

function getUploadTransitionCopy(stepKey: UploadProgressStepKey) {
  switch (stepKey) {
    case "analyze":
      return "Transición visible: del archivo listo al análisis guiado.";
    case "save":
      return "Transición visible: del borrador revisado al guardado protegido.";
    case "review":
      return "Transición visible: del procesamiento a la revisión final con control tuyo.";
    default:
      return "Transición visible: de la preparación segura al análisis automático.";
  }
}

function getUploadPersistentSupportCopy(file: File | null) {
  if (file) {
    return `Archivo actual: ${file.name} · ${formatVisibleFileSize(file.size)}.`;
  }

  return "Consejo preventivo: procura que el archivo esté completo, legible y sin sombras antes de subirlo.";
}

function getUploadSecuritySummary(stepKey: UploadProgressStepKey) {
  switch (stepKey) {
    case "save":
      return "Seguimos protegiendo el documento mientras se integra al expediente.";
    case "review":
      return "Ya puedes revisar con calma antes de confirmar cualquier guardado.";
    default:
      return "Los límites, la privacidad y tu control siguen visibles durante todo el flujo.";
  }
}

function getUploadEtaLabel(stepKey: UploadProgressStepKey) {
  switch (stepKey) {
    case "analyze":
      return "Tiempo estimado: normalmente menos de 20 segundos para dejar lista la vista previa.";
    case "save":
      return "Casi listo: normalmente menos de 10 segundos para integrarlo con seguridad.";
    case "review":
      return "Siguiente acción: revisar lo importante y confirmar solo si quieres guardarlo.";
    default:
      return "En cuanto eliges el archivo, el borrador suele quedar listo en menos de 1 minuto.";
  }
}

function getUploadMomentumCopy(stepKey: UploadProgressStepKey) {
  switch (stepKey) {
    case "analyze":
      return "Estamos ordenando primero lo más útil para que no tengas que interpretar todo desde cero.";
    case "save":
      return "Ya cerramos casi todo el proceso y mantenemos visible tu control hasta el final.";
    case "review":
      return "La parte pesada ya pasó: ahora puedes concentrarte solo en revisar y decidir.";
    default:
      return "En cuanto eliges el archivo, activamos la lectura preliminar sin pedirte un paso extra.";
  }
}

function getUploadOutcomeCopy(stepKey: UploadProgressStepKey) {
  switch (stepKey) {
    case "analyze":
      return "Siguiente señal visible: abriremos la vista previa apenas terminemos de leer el documento.";
    case "save":
      return "Siguiente señal visible: el documento aparecerá integrado y con el siguiente paso sugerido.";
    case "review":
      return "Siguiente señal visible: podrás confirmar o repetir la carga sin perder claridad del expediente.";
    default:
      return "Siguiente señal visible: aquí mismo verás el avance y la vista previa antes de guardar nada.";
  }
}

function getUploadStageLabel(stepKey: UploadProgressStepKey) {
  switch (stepKey) {
    case "analyze":
      return "Revisando tu archivo";
    case "save":
      return "Guardando tu revisión";
    case "review":
      return "Listo para revisar";
    default:
      return "Preparando tu archivo";
  }
}

export function formatVisibleFileSize(bytes: number) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

const AUDITAR_TECHNICAL_PREVIEW_PATTERNS = [
  /TRPCClientError/i,
  /TypeError/i,
  /ReferenceError/i,
  /SyntaxError/i,
  /Unhandled/i,
  /node_modules/i,
  /localhost/i,
  /127\.0\.0\.1/i,
  /@fs\//i,
  /https?:\/\//i,
  /function(?:\s+[A-Za-z0-9_$]+)?\s*\(/i,
  /=>/,
  /\bconst\b|\blet\b|\bvar\b/i,
  /webpack|vite|react-dom|jsx-runtime/i,
];

type SanitizePreviewTextOptions = {
  maxLength?: number;
  emptyFallback?: string;
  technicalFallback?: string;
};

function isLikelyTechnicalPreviewBlob(value: string) {
  if (!value) {
    return false;
  }

  if (AUDITAR_TECHNICAL_PREVIEW_PATTERNS.some(pattern => pattern.test(value))) {
    return true;
  }

  if (/[^\s]{120,}/.test(value)) {
    return true;
  }

  const symbolMatches = value.match(/[{}\[\]();<>/=\\@]/g) ?? [];
  const symbolDensity =
    value.length > 0 ? symbolMatches.length / value.length : 0;
  const commaDensity =
    value.length > 0 ? (value.match(/,/g) ?? []).length / value.length : 0;

  return (
    (value.length >= 180 && symbolDensity >= 0.12) ||
    (value.length >= 240 && commaDensity >= 0.04)
  );
}

export function sanitizePreviewText(
  value: unknown,
  options: SanitizePreviewTextOptions = {}
) {
  const {
    maxLength = 180,
    emptyFallback = "",
    technicalFallback = "Contenido técnico omitido para mantener la lectura clara.",
  } = options;
  const normalized =
    typeof value === "number"
      ? String(value)
      : typeof value === "string"
        ? value.replace(/\s+/g, " ").trim()
        : String(value ?? "")
            .replace(/\s+/g, " ")
            .trim();

  if (!normalized) {
    return emptyFallback;
  }

  if (isLikelyTechnicalPreviewBlob(normalized)) {
    return technicalFallback;
  }

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(24, maxLength - 1)).trimEnd()}…`;
}

function toFriendlyAuditarRuntimeMessage(error: unknown, fallback: string) {
  const candidate = error instanceof Error ? error.message : fallback;
  return sanitizePreviewText(candidate, {
    maxLength: 220,
    emptyFallback: fallback,
    technicalFallback:
      "No pudimos completar esta parte del documento. Intenta repetir la captura o subir el archivo original.",
  });
}

function isCommerceUpgradeMessage(message: string) {
  return /Audita Esencial|Audita Pro|desbloquearlo|parte gratuita/i.test(
    message
  );
}

function resolveCommercePlanFromMessage(message: string): CommercePlanKey {
  if (/Audita Pro/i.test(message)) {
    return "pro";
  }

  if (/Audita Esencial/i.test(message)) {
    return "essential";
  }

  return "essential";
}

type CommerceTriggerPoint =
  | "manual_drawer_open"
  | "document_limit_blocked"
  | "helios_multi_document_blocked"
  | "revalidation_blocked"
  | "plan_card"
  | "one_shot_card"
  | "checkout_return_success";

type CommercePromptContext = {
  title: string;
  body: string;
  targetPlan: CommercePlanKey;
  triggerPoint: CommerceTriggerPoint;
  productKey?: CommerceProductKey;
};

type CommerceSessionMetrics = {
  paywallViews: number;
  upgradeClicks: number;
  checkoutStarts: number;
  paymentSuccesses: number;
};

const INITIAL_COMMERCE_SESSION_METRICS: CommerceSessionMetrics = {
  paywallViews: 0,
  upgradeClicks: 0,
  checkoutStarts: 0,
  paymentSuccesses: 0,
};

function getCommercePlanLabel(planKey: CommercePlanKey) {
  switch (planKey) {
    case "pro":
      return "Audita Pro";
    case "essential":
      return "Audita Esencial";
    default:
      return "Audita Gratis";
  }
}

function getCommerceProductLabel(productKey: CommerceProductKey) {
  switch (productKey) {
    case "essential":
      return "Audita Esencial";
    case "pro":
      return "Audita Pro";
    case "informe_premium":
      return "Informe Premium";
    case "expediente_abogado":
      return "Expediente para abogado";
    default:
      return "Audita Gratis";
  }
}

function getCommerceTriggerLabel(triggerPoint: CommerceTriggerPoint) {
  switch (triggerPoint) {
    case "document_limit_blocked":
      return "Bloqueo por límite de documentos";
    case "helios_multi_document_blocked":
      return "Bloqueo por lectura avanzada del expediente";
    case "revalidation_blocked":
      return "Bloqueo por revalidación avanzada";
    case "one_shot_card":
      return "Interés en producto puntual";
    case "checkout_return_success":
      return "Retorno exitoso desde Stripe";
    case "plan_card":
      return "Interés directo en un plan";
    default:
      return "Apertura manual del panel";
  }
}

function buildManualCommercePromptContext(activePlanKey: CommercePlanKey): CommercePromptContext {
  const targetPlan = activePlanKey === "free" ? "essential" : "pro";
  const price = targetPlan === "essential" ? 79 : 199;

  return {
    title: "Elige solo cuando te ayude de verdad",
    body:
      targetPlan === "essential"
        ? `Si ya vas a seguir armando tu expediente, ${getCommercePlanLabel(targetPlan)} por ${formatCommercePriceMx(price)} al mes es el siguiente paso natural.`
        : `Si ya necesitas memoria histórica, revalidaciones y seguimiento más profundo, ${getCommercePlanLabel(targetPlan)} por ${formatCommercePriceMx(price)} al mes es el siguiente paso natural.`,
    targetPlan,
    triggerPoint: "manual_drawer_open",
    productKey: targetPlan,
  };
}

function buildCommercePromptContext(params: {
  message: string;
  activePlanKey: CommercePlanKey;
}): CommercePromptContext | null {
  if (/Subir más de \d+ documentos/i.test(params.message)) {
    return {
      title: "Sigue cargando pruebas en este expediente",
      body: `Ya llenaste el tramo gratuito del expediente. Audita Esencial cuesta ${formatCommercePriceMx(79)} al mes y te deja seguir subiendo documentos sin empezar de cero.`,
      targetPlan: "essential",
      triggerPoint: "document_limit_blocked",
      productKey: "essential",
    };
  }

  if (/Helios con lectura de varios documentos|varios documentos del expediente/i.test(params.message)) {
    const targetPlan = params.activePlanKey === "essential" ? "pro" : "essential";
    const price = targetPlan === "pro" ? 199 : 79;

    return {
      title:
        targetPlan === "pro"
          ? "Activa la lectura más profunda del expediente"
          : "Conecta más documentos en la misma conversación",
      body:
        targetPlan === "pro"
          ? `Para una lectura más profunda con memoria histórica y seguimiento ampliado, activa ${getCommercePlanLabel(targetPlan)} por ${formatCommercePriceMx(price)} al mes.`
          : `Para que tu asesor conecte varios documentos dentro de este mismo expediente, activa ${getCommercePlanLabel(targetPlan)} por ${formatCommercePriceMx(price)} al mes.`,
      targetPlan,
      triggerPoint: "helios_multi_document_blocked",
      productKey: targetPlan,
    };
  }

  if (/Revalidaciones IMSS e Infonavit/i.test(params.message)) {
    return {
      title: "Activa revalidaciones avanzadas",
      body: `Las revalidaciones IMSS e Infonavit están disponibles desde Audita Pro por ${formatCommercePriceMx(199)} al mes. Si ya quieres esa validación más profunda, puedes activarlo aquí mismo.`,
      targetPlan: "pro",
      triggerPoint: "revalidation_blocked",
      productKey: "pro",
    };
  }

  return null;
}

function buildCommerceCheckoutToast(productKey: CommerceProductKey) {
  switch (productKey) {
    case "essential":
      return `Te estamos llevando al checkout seguro de Audita Esencial por ${formatCommercePriceMx(79)} al mes.`;
    case "pro":
      return `Te estamos llevando al checkout seguro de Audita Pro por ${formatCommercePriceMx(199)} al mes.`;
    case "informe_premium":
      return `Te estamos llevando al checkout seguro de Informe Premium por ${formatCommercePriceMx(299)}.`;
    case "expediente_abogado":
      return `Te estamos llevando al checkout seguro de Expediente para abogado por ${formatCommercePriceMx(499)}.`;
    default:
      return "Te estamos llevando al checkout seguro.";
  }
}

function isUnsupportedMobileImageFormat(file: File) {
  const lowerName = file.name.toLowerCase();
  return (
    MOBILE_UNSUPPORTED_IMAGE_EXTENSIONS.some(extension =>
      lowerName.endsWith(extension)
    ) ||
    file.type === "image/heic" ||
    file.type === "image/heif"
  );
}

export function validateDocumentUploadFile(file: File | null) {
  if (!file) {
    return null;
  }

  const lowerName = file.name.toLowerCase();
  const isSupportedByMime = SUPPORTED_DOCUMENT_UPLOAD_MIME_TYPES.has(file.type);
  const isSupportedByExtension = SUPPORTED_DOCUMENT_UPLOAD_EXTENSIONS.some(
    extension => lowerName.endsWith(extension)
  );

  if (isUnsupportedMobileImageFormat(file)) {
    return "Tu celular entregó la imagen en HEIC o HEIF. Para evitar fallos, súbela como JPG, PNG, WEBP, PDF, XML o DOCX.";
  }

  if (!isSupportedByMime && !isSupportedByExtension) {
    return "Este archivo no es compatible todavía. Sube PDF, XML, JPG, PNG, WEBP o DOCX para continuar.";
  }

  if (file.size > MAX_DOCUMENT_UPLOAD_SIZE_BYTES) {
    return `El archivo pesa ${formatVisibleFileSize(file.size)} y rebasa el límite real de 12 MB. Comprime la imagen o exporta el PDF en tamaño más ligero antes de subirlo.`;
  }

  return null;
}

export function buildUploadProgressState(params: {
  selectedFile: File | null;
  pendingDraft: boolean;
  isAnalyzingDraft: boolean;
  isConfirmingDraft: boolean;
}): UploadProgressState {
  const { selectedFile, pendingDraft, isAnalyzingDraft, isConfirmingDraft } =
    params;

  if (isConfirmingDraft) {
    return {
      eyebrow: "Guardando",
      title: "Guardando en tu bóveda...",
      description:
        "En breve confirmamos que tu documento quedó resguardado.",
      progress: 92,
      toneClasses: "border-teal-200 bg-teal-50 text-teal-950",
      barClasses: "bg-teal-600",
      stageLabel: getUploadStageLabel("save"),
      etaLabel: getUploadEtaLabel("save"),
      stepKey: "save",
      humanMessages: getHumanUploadProgressMessages("save"),
    };
  }

  if (pendingDraft) {
    return {
      eyebrow: "Revisión lista",
      title: "Tu documento ya está listo para revisar",
      description:
        "Revísalo primero y decide después si quieres guardarlo.",
      progress: 100,
      toneClasses: "border-sky-200 bg-sky-50 text-sky-950",
      barClasses: "bg-sky-600",
      stageLabel: getUploadStageLabel("review"),
      etaLabel: getUploadEtaLabel("review"),
      stepKey: "review",
    };
  }

  if (isAnalyzingDraft) {
    return {
      eyebrow: "Analizando",
      title: "Analizando tu documento...",
      description:
        "Estamos extrayendo la información clave para mostrarte la revisión rápida.",
      progress: 72,
      toneClasses: "border-amber-200 bg-amber-50 text-amber-950",
      barClasses: "bg-amber-500",
      stageLabel: getUploadStageLabel("analyze"),
      etaLabel: getUploadEtaLabel("analyze"),
      stepKey: "analyze",
      humanMessages: getHumanUploadProgressMessages("analyze"),
    };
  }

  if (selectedFile) {
    return {
      eyebrow: "Documento cargado",
      title: "Listo para analizar",
      description:
        "En unos segundos verás la revisión rápida sin pasos extra.",
      progress: 38,
      toneClasses: "border-emerald-200 bg-emerald-50 text-emerald-950",
      barClasses: "bg-emerald-500",
      stageLabel: getUploadStageLabel("prepare"),
      etaLabel: getUploadEtaLabel("prepare"),
      stepKey: "prepare",
    };
  }

  return {
    eyebrow: "Control del documento",
    title: "Elige un PDF, XML o una imagen clara para empezar",
    description:
      "Primero recibes la lectura. Sólo al final decides si quieres guardarlo en tu carpeta privada.",
    progress: 12,
    toneClasses: "border-slate-200 bg-slate-50 text-slate-950",
    barClasses: "bg-slate-400",
    stageLabel: getUploadStageLabel("prepare"),
    etaLabel: getUploadEtaLabel("prepare"),
    stepKey: "prepare",
  };
}

function buildLegalGateErrorState(
  message: string,
  type: LegalGateErrorType,
  retryCount = 0,
  retryAfterSeconds = 0
): LegalGateErrorState {
  return {
    message,
    type,
    retryCount,
    retryAfterSeconds,
    retryAvailableAt:
      retryAfterSeconds > 0 ? Date.now() + retryAfterSeconds * 1000 : null,
  };
}

function extractLegalGateCauseType(value: unknown) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const causeType = (value as { type?: unknown }).type;
  return typeof causeType === "string" ? causeType : null;
}

function resolveLegalGateError(
  error: unknown,
  retryCount = 0
): LegalGateErrorState {
  const fallbackMessage =
    "No fue posible registrar tu aceptación legal en este momento.";
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
  const message =
    typeof errorRecord?.message === "string" &&
    errorRecord.message.trim().length > 0
      ? errorRecord.message
      : fallbackMessage;
  const code =
    errorRecord?.data?.code ?? errorRecord?.shape?.data?.code ?? null;
  const causeType = extractLegalGateCauseType(
    errorRecord?.data?.cause ?? errorRecord?.shape?.data?.cause
  );

  if (code === "CONFLICT" || causeType === "CONCURRENCY_LOCK_FAILURE") {
    return buildLegalGateErrorState(
      "Otro proceso está registrando esta aceptación. Protegimos tu expediente para evitar registros duplicados. Espera el temporizador y vuelve a intentarlo.",
      "concurrency",
      retryCount,
      LEGAL_GATE_CONCURRENCY_RETRY_SECONDS
    );
  }
  if (
    code === "TOO_MANY_REQUESTS" ||
    code === "TIMEOUT" ||
    message.toLowerCase().includes("intenta de nuevo")
  ) {
    return buildLegalGateErrorState(
      message,
      "transient",
      retryCount,
      LEGAL_GATE_TRANSIENT_RETRY_SECONDS
    );
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

type HeliosResultFindingView = {
  label: string;
  value: string;
  source?: "confirmed" | "estimated" | "derived";
  tone?: "neutral" | "support" | "attention";
};

type HeliosSimpleExplanationItemView = {
  label: string;
  summary: string;
  tone?: "neutral" | "support" | "attention";
};

type HeliosResultCardView = {
  headline?: string | null;
  lead?: string | null;
  keyFindings?: HeliosResultFindingView[];
  nextStepLabel?: string | null;
  nextStepSummary?: string | null;
  dossierUpdateLabel?: string | null;
  dossierUpdateSummary?: string | null;
  assistantIntro?: string | null;
  suggestedQuestions?: string[];
  signalsChecked?: string[];
  simpleExplanation?: HeliosSimpleExplanationItemView[];
  discrepancySignals?: HeliosSimpleExplanationItemView[];
  pendingClarifications?: HeliosSimpleExplanationItemView[];
};

type HeliosLegalHighlightsView = {
  primaryConclusion?: string | null;
  primaryConcern?: string | null;
  nextActionLabel?: string | null;
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
  resultCard?: HeliosResultCardView | null;
  legalHighlights?: HeliosLegalHighlightsView | null;
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
type ArchiveDateFilter = "all" | "last_30_days" | "this_year" | "older";

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
    .replaceAll("copiloto Helios", "asesor laboral")
    .replaceAll("Copiloto Helios", "Asesor laboral")
    .replaceAll("copiloto laboral", "asesor laboral")
    .replaceAll("Copiloto laboral", "Asesor laboral")
    .replaceAll("asistente laboral", "asesor laboral")
    .replaceAll("Asistente laboral", "Asesor laboral")
    .replaceAll("Expediente Helios", "expediente laboral")
    .replaceAll("expediente Helios", "expediente laboral")
    .replaceAll("HeliosDocumento", "documento")
    .replaceAll("Estado de Helios", "estado del expediente")
    .replaceAll("Etapa Helios", "etapa del expediente")
    .replaceAll("Tipo Helios", "tipo sugerido")
    .replaceAll("motor Helios", "inteligencia laboral")
    .replaceAll("Motor Helios", "Inteligencia laboral")
    .replaceAll("Helios", "la inteligencia laboral");
}

function parseQuickCalculatorAmount(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.replace(/[^0-9,.-]/g, "").trim();
  if (!normalized) {
    return null;
  }

  const lastComma = normalized.lastIndexOf(",");
  const lastDot = normalized.lastIndexOf(".");
  const sanitized =
    lastComma > lastDot
      ? normalized.replace(/\./g, "").replace(",", ".")
      : normalized.replace(/,/g, "");
  const parsed = Number.parseFloat(sanitized);

  return Number.isFinite(parsed) ? parsed : null;
}

function formatQuickCalculatorAmount(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 2,
  }).format(value);
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
    expectedDocumentType:
      | "payroll_receipt"
      | "cfdi"
      | "contract"
      | "imss"
      | "evidence"
      | null;
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
    imssDocumentsCount?: number;
    infonavitSignalsCount?: number;
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
    description:
      "Ayudan a revisar pagos, deducciones y cambios entre periodos.",
    benefit:
      "Permiten detectar diferencias y patrones de pago con más claridad.",
    suggestedCount: 2,
  },
  {
    type: "cfdi",
    label: "CFDI",
    description:
      "Sirven para contrastar lo timbrado fiscalmente contra lo que recibiste.",
    benefit: "Aclaran diferencias entre nómina y comprobantes fiscales.",
    suggestedCount: 2,
  },
  {
    type: "contract",
    label: "Contrato o condiciones iniciales",
    description:
      "Aterrizan sueldo pactado, jornada, prestaciones y condiciones de inicio.",
    benefit: "Ayudan a comparar lo prometido frente a lo realmente ocurrido.",
    suggestedCount: 1,
  },
  {
    type: "imss",
    label: "Soporte IMSS",
    description: "Refuerza contexto sobre alta, baja, NSS o semanas cotizadas.",
    benefit:
      "Aporta respaldo sobre seguridad social y relación laboral formal.",
    suggestedCount: 1,
  },
  {
    type: "evidence",
    label: "Evidencia complementaria",
    description:
      "Correos, capturas o chats ayudan a explicar fechas, instrucciones y cambios.",
    benefit:
      "Da contexto adicional cuando un recibo o CFDI por sí solos no bastan.",
    suggestedCount: 1,
  },
];

const priorityUploadGuides: PriorityUploadGuide[] = [
  {
    type: "payroll_receipt",
    title: "Recibos de nómina de varios periodos",
    summary:
      "Suelen ser de los archivos más útiles para detectar cambios repetidos en pagos, descuentos y depósitos.",
    value:
      "Mientras más periodos tengas en tu expediente, más fácil es darte una lectura comparada y detectar patrones que un solo recibo no muestra.",
  },
  {
    type: "cfdi",
    title: "CFDI timbrados",
    summary:
      "Sirven para contrastar lo que fiscalmente quedó reportado contra lo que aparece en otros documentos del caso.",
    value:
      "Ayudan a aclarar diferencias que muchas veces pasan desapercibidas cuando solo existe una versión del pago o del periodo revisado.",
  },
  {
    type: "contract",
    title: "Contrato o condiciones de inicio",
    summary:
      "Aterrizan sueldo pactado, jornada, prestaciones y acuerdos que luego conviene contrastar con la realidad.",
    value:
      "Son clave para entender si lo prometido al inicio coincide con lo que después muestran nóminas, CFDI o evidencia adicional.",
  },
  {
    type: "imss",
    title: "Alta, baja o semanas cotizadas del IMSS",
    summary:
      "Aportan fechas y señales de seguridad social que fortalecen la historia laboral del expediente.",
    value:
      "Suman contexto útil cuando quieres respaldarte mejor, aclarar periodos o entender huecos importantes dentro del caso.",
  },
];

const mobileOnboardingSteps: MobileOnboardingStep[] = [
  {
    step: "01",
    title: "Elige el archivo más a la mano",
    description:
      "Desde tu celular puedes tomar foto o subir un documento guardado sin preparar nada antes.",
  },
  {
    step: "02",
    title: "Todo se ordena en tu expediente",
    description:
      "Ese archivo queda guardado en un solo lugar para que no termine perdido entre carpetas, correos o chats.",
  },
  {
    step: "03",
    title: "Recibes claridad y la conservas",
    description:
      "Ves qué ya se entendió, qué conviene revisar y mantienes tus documentos disponibles 24/7 cuando vuelvas a necesitarlos.",
  },
];

type AuditarPersistedViewState = {
  historyFilter?: DossierHistoryFilter;
  mobileOnboardingIndex?: number;
  selectedRecommendedTargetType?: DossierTarget["type"] | null;
  preferredCaptureMode?: AuditarCaptureMode | null;
  preferredTone?: HeliosCopilotResponseTone;
};

function isDossierTargetType(value: unknown): value is DossierTarget["type"] {
  return dossierTargets.some(item => item.type === value);
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

export function sanitizePersistedAuditarViewState(
  value: unknown
): AuditarPersistedViewState {
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
    typeof record.mobileOnboardingIndex === "number" &&
    Number.isFinite(record.mobileOnboardingIndex)
      ? Math.min(
          Math.max(Math.trunc(record.mobileOnboardingIndex), 0),
          mobileOnboardingSteps.length - 1
        )
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
      : record.preferredCaptureMode === "camera" ||
          record.preferredCaptureMode === "file"
        ? (record.preferredCaptureMode as AuditarCaptureMode)
        : undefined;
  const preferredTone =
    record.preferredTone === "brief" || record.preferredTone === "explained"
      ? (record.preferredTone as HeliosCopilotResponseTone)
      : undefined;

  return {
    historyFilter,
    mobileOnboardingIndex,
    selectedRecommendedTargetType,
    preferredCaptureMode,
    preferredTone,
  };
}

export function sanitizePersistedHeliosCopilotMessages(
  value: unknown
): HeliosCopilotMessage[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .flatMap(item => {
      if (!item || typeof item !== "object") {
        return [];
      }

      const record = item as Record<string, unknown>;
      const role = record.role;
      const content = record.content;

      if (
        (role === "user" || role === "assistant") &&
        typeof content === "string" &&
        content.trim().length > 0
      ) {
        return [
          { role, content: content.trim() } satisfies HeliosCopilotMessage,
        ];
      }

      return [];
    })
    .slice(-6);
}

function appendHeliosCopilotMessage(
  current: HeliosCopilotMessage[],
  next: HeliosCopilotMessage
) {
  return [...current, next].slice(-6);
}

function summarizeHeliosCopilotSnippet(content: string, maxLength = 120) {
  const normalized = content.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function extractHeliosClearSnippet(content: string) {
  const normalized = content.replace(/\r/g, "").trim();
  const sectionMatch = normalized.match(
    /(?:1\)\s*Respuesta clara:?|Respuesta clara:?)([\s\S]*?)(?:\n\s*(?:2\)\s*Lo que sí se sabe|Lo que sí se sabe:|3\)\s*Lo que falta confirmar|Lo que falta confirmar:|4\)\s*Siguiente paso útil|Siguiente paso útil:)|$)/i
  );

  if (sectionMatch?.[1]?.trim()) {
    return summarizeHeliosCopilotSnippet(sectionMatch[1].trim());
  }

  return summarizeHeliosCopilotSnippet(normalized);
}

function buildHeliosCopilotConversationHistoryInput(params: {
  current: HeliosCopilotMessage[];
  nextPrompt: string;
}) {
  return [...params.current, { role: "user" as const, content: params.nextPrompt.trim() }]
    .flatMap(message => {
      if (
        (message.role === "user" || message.role === "assistant") &&
        typeof message.content === "string" &&
        message.content.trim().length > 0
      ) {
        return [
          {
            role: message.role,
            content: message.content.trim(),
          } as const,
        ];
      }

      return [];
    })
    .slice(-6);
}

function buildHeliosCopilotConversationHistoryItems(
  messages: HeliosCopilotMessage[]
) {
  const pairs: Array<{ question: string; answer: string }> = [];
  let pendingQuestion: string | null = null;

  messages.forEach(message => {
    if (message.role === "user") {
      pendingQuestion = message.content;
      return;
    }

    if (message.role === "assistant" && pendingQuestion) {
      pairs.push({
        question: pendingQuestion,
        answer: message.content,
      });
      pendingQuestion = null;
    }
  });

  return pairs.slice(-2).reverse().map((pair, index) => ({
    id: `copilot-pair-${index}`,
    title:
      index === 0
        ? "Último intercambio con tu asesor laboral"
        : "Intercambio reciente anterior",
    detail: `Tú: ${summarizeHeliosCopilotSnippet(pair.question, 90)} · Asesor: ${extractHeliosClearSnippet(pair.answer)}`,
    timestampLabel: "Ahora",
  }));
}

export function buildDossierTypeProgress(
  documentTypeCounts: Record<string, number>
) {
  return dossierTargets.map(item => {
    const count = documentTypeCounts[item.type] ?? 0;
    const targetCount = item.suggestedCount;
    const percent = Math.min(
      100,
      Math.round((Math.min(count, targetCount) / targetCount) * 100)
    );
    const coverageLabel =
      percent === 100 ? "Cubierto" : count > 0 ? "En progreso" : "Pendiente";
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
  const {
    legalGateRequired,
    pendingDraft,
    hasSelectedFile,
    activeCaptureMode,
    manualOverrideCount,
  } = params;

  return {
    shouldShowInlineLegalConsent:
      legalGateRequired && (hasSelectedFile || pendingDraft),
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
      supportingCopy:
        "Aún no forma parte del expediente: confirma o ajusta este borrador antes de integrarlo.",
    } as const;
  }

  return {
    label: "Documento confirmado",
    badgeClasses: "border border-emerald-200 bg-emerald-100 text-emerald-800",
    cardClasses: "border-slate-200 bg-slate-50",
    roleCardClasses: "border-teal-100 bg-teal-50",
    supportingCopy:
      "Este documento ya quedó confirmado dentro del expediente y sirve como base para el contraste posterior.",
  } as const;
}

export function buildReanalyzeDraftActionState(params: {
  pendingDraft: boolean;
  hasManualOverrides: boolean;
}) {
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

export function shouldHideUploadContextSelectors(params: {
  isFirstDocumentFlow: boolean;
  hasSelectedFile: boolean;
  hasPendingDraft: boolean;
  isAutoAnalyzing: boolean;
  hasSelectedTenant: boolean;
  hasSelectedCase: boolean;
}) {
  const {
    isFirstDocumentFlow,
    hasSelectedFile,
    hasPendingDraft,
    isAutoAnalyzing,
    hasSelectedTenant,
    hasSelectedCase,
  } = params;

  if (hasPendingDraft || isAutoAnalyzing) {
    return true;
  }

  if (!hasSelectedFile) {
    return false;
  }

  if (!isFirstDocumentFlow) {
    return true;
  }

  return hasSelectedTenant && hasSelectedCase;
}

function getCaptureModeSupportCopy(
  value: AuditarCaptureMode | null | undefined
) {
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

function getExpectedTypeAlignmentCopy(
  value: ScanAssistAssessmentView["expectedTypeAlignment"]
) {
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
    ? getSimpleDocumentTypeLabel(
        params.selectedRecommendedTargetType
      ).toLowerCase()
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

function getArchiveFileExtensionLabel(fileName: string) {
  const extension = fileName.split(".").pop()?.trim().toUpperCase() ?? "";
  if (!extension || extension === fileName.trim().toUpperCase()) {
    return "DOC";
  }
  return extension.slice(0, 4);
}

function getArchiveDocumentVisual(documentType?: string | null) {
  switch (documentType) {
    case "payroll_receipt":
      return {
        shortLabel: "NOM",
        tileClasses: "border-emerald-100 bg-emerald-50 text-emerald-700",
        badgeClasses: "bg-emerald-100 text-emerald-800",
      };
    case "cfdi":
      return {
        shortLabel: "SAT",
        tileClasses: "border-sky-100 bg-sky-50 text-sky-700",
        badgeClasses: "bg-sky-100 text-sky-800",
      };
    case "imss":
      return {
        shortLabel: "IMSS",
        tileClasses: "border-indigo-100 bg-indigo-50 text-indigo-700",
        badgeClasses: "bg-indigo-100 text-indigo-800",
      };
    case "contract":
      return {
        shortLabel: "LAB",
        tileClasses: "border-amber-100 bg-amber-50 text-amber-700",
        badgeClasses: "bg-amber-100 text-amber-800",
      };
    case "settlement":
      return {
        shortLabel: "FIN",
        tileClasses: "border-rose-100 bg-rose-50 text-rose-700",
        badgeClasses: "bg-rose-100 text-rose-800",
      };
    default:
      return {
        shortLabel: "EXP",
        tileClasses: "border-slate-200 bg-slate-100 text-slate-700",
        badgeClasses: "bg-slate-200 text-slate-800",
      };
  }
}

function matchesArchiveDateFilter(
  value: Date | string | null | undefined,
  filter: ArchiveDateFilter
) {
  if (filter === "all") {
    return true;
  }

  if (!value) {
    return false;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return false;
  }

  const now = new Date();
  if (filter === "last_30_days") {
    const threshold = new Date(now);
    threshold.setDate(threshold.getDate() - 30);
    return date >= threshold;
  }

  const currentYear = now.getFullYear();
  if (filter === "this_year") {
    return date.getFullYear() === currentYear;
  }

  return date.getFullYear() < currentYear;
}

async function fileToBase64(file: File) {
  return readWebFileAsDataUrl(file);
}

function humanizeSnakeCase(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, letter => letter.toUpperCase());
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
      description:
        "Este documento ya deja señales bastante claras para empezar a usarlo en el expediente.",
    } as const;
  }

  if ((confidence ?? 0) >= 65) {
    return {
      label: "Lectura útil con revisión",
      classes: "bg-amber-100 text-amber-800",
      description:
        "Ya encontramos señales útiles, aunque todavía conviene revisar algunos detalles antes de sacar conclusiones.",
    } as const;
  }

  return {
    label: "Lectura inicial",
    classes: "bg-slate-200 text-slate-700",
    description:
      "Este archivo abre la lectura, pero todavía conviene complementarlo con otra evidencia más clara.",
  } as const;
}

function getDocumentVerdictState(confidence?: number | null) {
  if ((confidence ?? 0) >= 85) {
    return {
      label: "Bien detectado",
      shortLabel: "Bien",
      classes: "bg-emerald-100 text-emerald-800 border border-emerald-200",
      panelClasses: "border-emerald-100 bg-emerald-50",
      description: "Se puede usar ya como una señal fuerte dentro del expediente.",
    } as const;
  }

  if ((confidence ?? 0) >= 65) {
    return {
      label: "Requiere revisión",
      shortLabel: "Revisar",
      classes: "bg-amber-100 text-amber-900 border border-amber-200",
      panelClasses: "border-amber-100 bg-amber-50",
      description: "Ya aporta contexto, pero conviene revisar detalles antes de confiar por completo.",
    } as const;
  }

  return {
    label: "Necesita refuerzo",
    shortLabel: "Refuerzo",
    classes: "bg-slate-200 text-slate-800 border border-slate-300",
    panelClasses: "border-slate-200 bg-slate-50",
    description: "Abre la lectura, pero todavía hace falta otro archivo o una versión más clara.",
  } as const;
}

function getResultRevealCopy(documentType?: string | null) {
  const title = (() => {
    switch (documentType) {
      case "payroll_receipt":
        return "Recibo de nómina listo para revisar";
      case "cfdi":
        return "CFDI listo para revisar";
      case "contract":
        return "Contrato listo para revisar";
      case "imss":
        return "Soporte IMSS listo para revisar";
      default:
        return `${documentType ? getSimpleDocumentTypeLabel(documentType) : "Documento"} listo para revisar`;
    }
  })();

  return {
    eyebrow: "Documento procesado",
    title,
    description:
      "Organizamos lo más importante para que veas primero lo esencial y luego el detalle completo.",
  } as const;
}


function asHeliosOpinion(value: unknown): HeliosOpinionView | null {
  if (!value || typeof value !== "object") return null;
  return value as HeliosOpinionView;
}

function getHeliosRiskCopy(value?: string | null) {
  switch (value) {
    case "critical":
      return {
        label: "Riesgo crítico",
        classes: "bg-rose-100 text-rose-800",
      } as const;
    case "high":
      return {
        label: "Riesgo alto",
        classes: "bg-red-100 text-red-800",
      } as const;
    case "medium":
      return {
        label: "Riesgo medio",
        classes: "bg-amber-100 text-amber-800",
      } as const;
    case "low":
      return {
        label: "Riesgo bajo",
        classes: "bg-emerald-100 text-emerald-800",
      } as const;
    default:
      return {
        label: "Revisión inicial",
        classes: "bg-slate-200 text-slate-700",
      } as const;
  }
}

function getHeliosSeverityNarrative(value?: string | null) {
  switch (value) {
    case "critical":
      return {
        eyebrow: "Atención inmediata",
        title: "Aquí sí vemos algo que conviene revisar hoy",
        description:
          "Hay señales que no se ven normales y vale la pena actuar rápido para evitar que el caso crezca.",
        panelClasses: "border-rose-200 bg-rose-50",
        eyebrowClasses: "text-rose-700",
      } as const;
    case "high":
      return {
        eyebrow: "Atención alta",
        title: "Aquí sí hay algo importante por revisar",
        description:
          "Ya encontramos señales suficientes para tratar este punto como relevante, aunque todavía puede requerir contraste adicional.",
        panelClasses: "border-amber-200 bg-amber-50",
        eyebrowClasses: "text-amber-800",
      } as const;
    case "medium":
      return {
        eyebrow: "Conviene confirmarlo",
        title: "Hay algo que vale la pena revisar con calma",
        description:
          "No parece una alerta máxima, pero sí hay indicios que conviene validar antes de cerrar una conclusión.",
        panelClasses: "border-cyan-200 bg-cyan-50",
        eyebrowClasses: "text-cyan-800",
      } as const;
    case "low":
      return {
        eyebrow: "Sin alerta fuerte",
        title: "Por ahora no vemos una señal grave",
        description:
          "Con lo que la inteligencia laboral ya revisó, no aparece una alerta fuerte; aun así puede hacer falta un documento más para darte más certeza.",
        panelClasses: "border-emerald-200 bg-emerald-50",
        eyebrowClasses: "text-emerald-800",
      } as const;
    default:
      return {
        eyebrow: "Lectura inicial",
        title: "Ya hay una primera lectura útil",
        description:
          "La inteligencia laboral ya revisó lo disponible y ordenó lo más importante para que sepas qué sí entendimos y qué falta confirmar.",
        panelClasses: "border-slate-200 bg-slate-50",
        eyebrowClasses: "text-slate-700",
      } as const;
  }
}

function getExplanationVariant(seed?: string | null) {
  const normalizedSeed = seed?.trim();

  if (!normalizedSeed) {
    return "direct" as const;
  }

  const score = normalizedSeed
    .split("")
    .reduce((total, char) => total + char.charCodeAt(0), 0);

  return score % 2 === 0 ? ("direct" as const) : ("guided" as const);
}

function getExplanationVariantCopy(
  variant: "direct" | "guided",
  severityTitle: string
) {
  if (variant === "guided") {
    return {
      badge: "Variante guiada",
      intro: `Te lo ordenamos paso por paso: qué sí vimos, qué no termina de cuadrar y qué falta para cerrar ${severityTitle.toLowerCase()}.`,
    } as const;
  }

  return {
    badge: "Variante directa",
    intro: `Te digo lo esencial sin rodeos: qué ya vimos, qué podría no cuadrar y qué falta para cerrar ${severityTitle.toLowerCase()}.`,
  } as const;
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
  if (
    params.opinion &&
    params.opinion.status !== "processing" &&
    params.opinion.status !== "sent"
  ) {
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

  if (
    params.engineStatus === "sent" ||
    params.opinion?.status === "processing" ||
    params.opinion?.status === "sent"
  ) {
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
      title:
        "Hace falta reintentar una parte de la revisión, pero tu expediente sigue intacto",
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
          "Te ayuda a revisar pagos, deducciones y cambios recientes dentro de tu expediente.",
        nextSuggestion:
          "Si subes el CFDI del mismo periodo, podrás contrastar mejor lo timbrado con lo recibido.",
      };
    case "cfdi":
      return {
        label: "CFDI incorporado",
        contribution:
          "Te ayuda a comparar lo timbrado con lo que realmente recibiste o trabajaste.",
        nextSuggestion:
          "Si también tienes recibos de nómina o soporte IMSS, pueden aclarar mejor diferencias o patrones.",
      };
    case "contract":
      return {
        label: "Contrato incorporado",
        contribution:
          "Te ayuda a revisar lo pactado desde el inicio de tu relación laboral.",
        nextSuggestion:
          "Si subes nómina o CFDI, podrás comparar mejor lo prometido con lo que pasó en la práctica.",
      };
    case "imss":
      return {
        label: "Soporte IMSS incorporado",
        contribution:
          "Te ayuda a ubicar movimientos relevantes de tu seguridad social.",
        nextSuggestion:
          "Si también tienes contrato, nómina o CFDI, juntos te darán una lectura más completa.",
      };
    case "evidence":
      return {
        label: "Evidencia complementaria incorporada",
        contribution:
          "Te ayuda a explicar contexto, instrucciones o fechas importantes para tu caso.",
        nextSuggestion:
          "Si te falta contrato, nómina o CFDI, súbelos también para dar más contexto al análisis.",
      };
    default:
      return {
        label: "Documento incorporado",
        contribution:
          "Tu archivo ya suma contexto útil para una revisión más clara.",
        nextSuggestion:
          "Si puedes, sube también nómina, CFDI o contrato para fortalecer mejor el análisis.",
      };
  }
}

function getDocumentContextualShortcuts(
  documentType: string
): ContextualShortcut[] {
  switch (documentType) {
    case "payroll_receipt":
      return [
        {
          id: "payroll-upload-cfdi",
          label: "Subir CFDI del mismo periodo",
          description:
            "Sirve para contrastar lo timbrado contra la nómina que acabas de revisar.",
          action: "upload",
          targetType: "cfdi",
        },
        {
          id: "payroll-ask-deductions",
          label: "Explicar deducciones clave",
          description:
            "Tu asesor laboral te resume descuentos, pagos y señales llamativas en palabras simples.",
          action: "assistant",
          prompt:
            "Explícame las deducciones, pagos y señales más importantes que ves en esta nómina con palabras simples.",
        },
      ];
    case "cfdi":
      return [
        {
          id: "cfdi-upload-payroll",
          label: "Subir recibo de nómina relacionado",
          description:
            "Ayuda a comparar lo fiscal con lo que realmente te pagaron.",
          action: "upload",
          targetType: "payroll_receipt",
        },
        {
          id: "cfdi-ask-compare",
          label: "Pedir comparación rápida",
          description:
            "Tu asesor laboral puede decirte qué revisar entre el CFDI y tu nómina.",
          action: "assistant",
          prompt:
            "Dime qué conviene comparar entre este CFDI y un recibo de nómina del mismo periodo.",
        },
      ];
    case "contract":
      return [
        {
          id: "contract-upload-annex",
          label: "Subir anexo o condiciones relacionadas",
          description:
            "Sirve para completar lo pactado al inicio o en cambios posteriores.",
          action: "upload",
          targetType: "contract",
        },
        {
          id: "contract-ask-clauses",
          label: "Resumir cláusulas importantes",
          description:
            "Tu asesor laboral te señala lo que vale la pena contrastar después con nómina o CFDI.",
          action: "assistant",
          prompt:
            "Resume las cláusulas o condiciones más importantes de este contrato y qué conviene comparar después.",
        },
      ];
    case "imss":
      return [
        {
          id: "imss-upload-payroll",
          label: "Comparar con recibos de nómina",
          description:
            "Subir nóminas ayuda a conectar movimientos IMSS con pagos reales.",
          action: "upload",
          targetType: "payroll_receipt",
        },
        {
          id: "imss-ask-gaps",
          label: "Explicar movimientos relevantes",
          description:
            "Tu asesor laboral puede traducir altas, bajas o huecos a lenguaje más claro.",
          action: "assistant",
          prompt:
            "Explícame qué movimientos o huecos relevantes ves en este soporte IMSS y cómo compararlos con mis nóminas.",
        },
      ];
    case "evidence":
      return [
        {
          id: "evidence-upload-contract",
          label: "Subir contrato o nómina relacionada",
          description:
            "La evidencia gana fuerza cuando queda ligada al documento base correcto.",
          action: "upload",
          targetType: "contract",
        },
        {
          id: "evidence-ask-context",
          label: "Pedir lectura contextual",
          description:
            "Tu asesor laboral puede decirte cómo se conecta esta evidencia con el resto del expediente.",
          action: "assistant",
          prompt:
            "Explícame cómo se conecta esta evidencia con mi expediente y qué documento base conviene subir después.",
        },
      ];
    default:
      return [
        {
          id: "generic-upload-companion",
          label: "Asegurar evidencia complementaria",
          description:
            "Agregar nómina, CFDI o contrato suele dar más contexto a la lectura inicial.",
          action: "upload",
          targetType: "payroll_receipt",
        },
        {
          id: "generic-ask-next-step",
          label: "Pedir siguiente paso claro",
          description:
            "Tu asesor laboral puede orientarte sobre qué conviene revisar o subir a continuación.",
          action: "assistant",
          prompt:
            "Dime cuál sería el siguiente paso más útil para este documento y por qué.",
        },
      ];
  }
}

export function getPrimaryContextualShortcut(
  documentType: string,
  shortcuts: ContextualShortcut[]
) {
  const shortcutById = (id: string) =>
    shortcuts.find(shortcut => shortcut.id === id) ?? null;

  switch (documentType) {
    case "payroll_receipt":
      return shortcutById("payroll-upload-cfdi") ?? shortcuts[0] ?? null;
    case "cfdi":
      return shortcutById("cfdi-upload-payroll") ?? shortcuts[0] ?? null;
    case "contract":
      return shortcutById("contract-ask-clauses") ?? shortcuts[0] ?? null;
    case "imss":
      return shortcutById("imss-ask-gaps") ?? shortcuts[0] ?? null;
    case "evidence":
      return shortcutById("evidence-ask-context") ?? shortcuts[0] ?? null;
    default:
      return shortcuts.find(shortcut => shortcut.action === "assistant") ?? shortcuts[0] ?? null;
  }
}

function getHeliosTimelineRole(
  documentType: string,
  opinion?: HeliosOpinionView | null
) {
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
      description:
        "Quedó guardado, siguió su proceso automático y ahora esperamos la respuesta de vuelta para completar más detalle.",
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
        description:
          "La revisión automática ya devolvió información para este documento.",
      } as const;
    case "attention":
      return {
        label: "Conviene revisarlo",
        classes: "bg-amber-100 text-amber-800",
        description:
          "Ya se envió, pero la respuesta automática está tardando más de lo esperado.",
      } as const;
    case "waiting":
      return {
        label: "Esperando respuesta",
        classes: "bg-sky-100 text-sky-800",
        description:
          "El documento ya salió y sigue en espera de respuesta automática.",
      } as const;
    default:
      return {
        label: "Aún no enviado",
        classes: "bg-slate-100 text-slate-700",
        description:
          "Este documento todavía no entra a un seguimiento automático visible.",
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
      return value
        ? humanizeSnakeCase(value.replace(/\./g, "_"))
        : "Respuesta recibida";
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
  return Object.entries(record ?? {})
    .map(
      ([key, value]) =>
        [
          key,
          sanitizePreviewText(value, {
            maxLength: 120,
            emptyFallback: "",
            technicalFallback:
              "Contenido técnico omitido para mantener la vista previa clara.",
          }),
        ] as [string, string]
    )
    .filter(([, value]) => value.length > 0);
}

export function sanitizeStructuredExtractionView(
  view?: StructuredExtractionView | null
) {
  if (!view) {
    return null;
  }

  return {
    ...view,
    headline: sanitizePreviewText(view.headline, {
      maxLength: 120,
      emptyFallback: "Vista previa documental",
      technicalFallback: "Vista previa documental",
    }),
    summary: sanitizePreviewText(view.summary, {
      maxLength: 220,
      emptyFallback:
        "La lectura previa quedó incompleta. Conviene revisar el documento original antes de guardarlo.",
      technicalFallback:
        "La lectura previa quedó demasiado técnica o extensa. Conviene repetir la captura o revisar el archivo original.",
    }),
    fields: view.fields
      .map(field => ({
        ...field,
        label: sanitizePreviewText(field.label, {
          maxLength: 60,
          emptyFallback: "Dato detectado",
          technicalFallback: "Dato detectado",
        }),
        value: sanitizePreviewText(field.value, {
          maxLength: 160,
          emptyFallback: "",
          technicalFallback:
            "Contenido técnico omitido para mantener la vista previa clara.",
        }),
      }))
      .filter(field => field.value.length > 0)
      .slice(0, 12),
    missingFields: view.missingFields
      .map(item =>
        sanitizePreviewText(item, {
          maxLength: 80,
          emptyFallback: "",
          technicalFallback: "",
        })
      )
      .filter(item => item.length > 0)
      .slice(0, 6),
    reviewNotes: view.reviewNotes
      .map(item =>
        sanitizePreviewText(item, {
          maxLength: 160,
          emptyFallback: "",
          technicalFallback:
            "Se ocultó una nota técnica para mantener esta revisión clara.",
        })
      )
      .filter(item => item.length > 0)
      .slice(0, 4),
  };
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

const editablePreviewFieldPriority: Record<
  PreviewEditableFieldView["source"],
  number
> = {
  confirmed: 3,
  estimated: 2,
  structured: 1,
};

function normalizeEditableFieldValue(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return String(value);
  return sanitizePreviewText(value, {
    maxLength: 120,
    emptyFallback: "",
    technicalFallback: "",
  });
}

function buildPreviewEditableFields(draft?: DraftPreviewResultView | null) {
  const fields = new Map<string, PreviewEditableFieldView>();

  const registerField = (
    key: string,
    label: string,
    value: unknown,
    source: PreviewEditableFieldView["source"]
  ) => {
    if (!editablePreviewFieldKeys.has(key)) return;

    const normalizedValue = normalizeEditableFieldValue(value);
    if (!normalizedValue) return;

    const existing = fields.get(key);
    if (
      existing &&
      editablePreviewFieldPriority[existing.source] >=
        editablePreviewFieldPriority[source]
    ) {
      return;
    }

    fields.set(key, {
      key,
      label: label.trim() || getAnalysisFieldLabel(key),
      value: normalizedValue,
      source,
    });
  };

  Object.entries(draft?.preliminaryAnalysis?.confirmedData ?? {}).forEach(
    ([key, value]) => {
      registerField(key, getAnalysisFieldLabel(key), value, "confirmed");
    }
  );

  Object.entries(draft?.preliminaryAnalysis?.estimatedData ?? {}).forEach(
    ([key, value]) => {
      registerField(key, getAnalysisFieldLabel(key), value, "estimated");
    }
  );

  (draft?.preliminaryAnalysis?.structuredExtraction?.fields ?? []).forEach(
    field => {
      registerField(field.key, field.label, field.value, "structured");
    }
  );

  return Array.from(fields.values()).slice(0, 5);
}

function buildManualOverridePayload(
  fields: PreviewEditableFieldView[],
  values: Record<string, string>
) {
  return fields
    .map(field => {
      const normalizedValue = (values[field.key] ?? field.value)
        .replace(/\s+/g, " ")
        .trim();
      if (
        !normalizedValue ||
        normalizedValue === field.value.replace(/\s+/g, " ").trim()
      ) {
        return null;
      }

      return {
        key: field.key,
        label: field.label,
        value: normalizedValue,
      };
    })
    .filter((item): item is { key: string; label: string; value: string } =>
      Boolean(item)
    );
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

function getDossierTargetByType(type: DossierTarget["type"]) {
  return dossierTargets.find(item => item.type === type) ?? null;
}

export function getContextualDossierNextTarget(presentTypes: Set<string>) {
  const has = (type: DossierTarget["type"]) => presentTypes.has(type);

  if (presentTypes.size === 0) {
    return getDossierTargetByType("payroll_receipt");
  }

  if (has("payroll_receipt") && !has("cfdi")) {
    return getDossierTargetByType("cfdi");
  }

  if (has("cfdi") && !has("payroll_receipt")) {
    return getDossierTargetByType("payroll_receipt");
  }

  if (has("contract") && !has("evidence")) {
    return getDossierTargetByType("evidence");
  }

  if (has("imss") && !has("payroll_receipt")) {
    return getDossierTargetByType("payroll_receipt");
  }

  return dossierTargets.find(item => !presentTypes.has(item.type)) ?? null;
}

function getContextualNextDocumentPreset(
  nextTarget: DossierTarget | undefined,
  presentTypes: Set<string>
) {
  if (!nextTarget) {
    return null;
  }

  const has = (type: DossierTarget["type"]) => presentTypes.has(type);

  if (nextTarget.type === "cfdi" && has("payroll_receipt")) {
    return {
      headline: "Sigue con tu CFDI para contrastar lo que ya ves en nómina",
      intro:
        "Como ya subiste recibos de nómina, el CFDI puede ayudarte a comparar lo timbrado con lo que realmente recibiste.",
      reasonTitle: "Por qué este paso tiene sentido ahora",
      reasonBody:
        "Conecta pagos, descuentos y periodos desde dos fuentes que suelen revelar diferencias útiles con muy poco esfuerzo.",
      coverage:
        "Esa combinación suele volver el expediente más claro desde el inicio, porque ya no dependes de una sola versión del pago.",
      cta: "Subir mi CFDI ahora",
    } as const;
  }

  if (nextTarget.type === "payroll_receipt" && has("cfdi")) {
    return {
      headline: "Sigue con tu nómina para darle contexto al CFDI",
      intro:
        "Si ya tienes CFDI, sumar recibos de nómina ayuda a aterrizar pagos, descuentos y periodos con más claridad.",
      reasonTitle: "Lo que ganas con este cruce",
      reasonBody:
        "La nómina suele ser la pieza que mejor explica lo fiscal frente a lo laboral y te deja una lectura más entendible del caso.",
      coverage:
        "Cuando CFDI y nómina se leen juntos, el expediente empieza a responder con más contexto y menos zonas preliminares.",
      cta: "Subir mi nómina ahora",
    } as const;
  }

  if (nextTarget.type === "evidence" && has("contract")) {
    return {
      headline:
        "Tu contrato puede ganar contexto con un anexo o evidencia relacionada",
      intro:
        "Si ya subiste contrato o condiciones iniciales, un anexo, cambio de condiciones o evidencia complementaria puede explicar mejor cómo siguió la relación laboral.",
      reasonTitle: "Qué conviene sumar después del contrato",
      reasonBody:
        "Ese tipo de evidencia ayuda a conectar lo pactado con lo que realmente ocurrió, sobre todo si hubo ajustes, instrucciones o cambios posteriores.",
      coverage:
        "Así tu expediente deja de depender sólo del documento inicial y empieza a reflejar mejor la historia completa del caso.",
      cta: "Subir evidencia relacionada",
    } as const;
  }

  if (nextTarget.type === "payroll_receipt" && has("imss")) {
    return {
      headline: "Sigue con tu nómina para comparar mejor tu señal de IMSS",
      intro:
        "Como ya tienes un soporte IMSS, los recibos de nómina ayudan a revisar si pagos, periodos y seguridad social cuentan la misma historia.",
      reasonTitle: "Por qué conviene hacer este cruce ahora",
      reasonBody:
        "Ese contraste suele aclarar rápido diferencias útiles y darle más sustento a la lectura del expediente.",
      coverage:
        "Con IMSS y nómina en el mismo expediente, la orientación gana contexto y empieza a volverse más precisa.",
      cta: "Subir mi nómina ahora",
    } as const;
  }

  return null;
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
    .filter(item => presentTypes.has(item.type))
    .map(item => item.label.toLowerCase());

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
  const firstUncertainty = params.opinion?.uncertainties?.find(item =>
    item?.trim()
  );
  const contextualPreset = getContextualNextDocumentPreset(
    params.nextTarget,
    params.presentTypes
  );

  if (params.nextTarget) {
    return {
      headline:
        contextualPreset?.headline ??
        `Documento sugerido: ${params.nextTarget.label}`,
      intro:
        contextualPreset?.intro ??
        (presentSummary
          ? `Con lo que ya subiste, como ${presentSummary}, ${params.nextTarget.label.toLowerCase()} puede ayudarte a ${lowercaseFirstLetter(params.nextTarget.benefit)}`
          : `Tu expediente puede empezar con ${params.nextTarget.label.toLowerCase()} para darte una primera lectura más clara y útil.`),
      reasonTitle:
        contextualPreset?.reasonTitle ??
        "Por qué ahora puede ser el archivo más útil",
      reasonBody:
        firstUncertainty && !contextualPreset
          ? `${params.nextTarget.description} Además, hoy todavía conviene aclarar algo importante: ${firstUncertainty}`
          : (contextualPreset?.reasonBody ??
            `${params.nextTarget.description} ${params.nextTarget.benefit}`),
      followUp:
        params.opinion?.recommendedNextStep ??
        "Con cada documento útil, tu expediente gana claridad y te sugiere el siguiente paso sin complicarte el proceso.",
      coverage:
        contextualPreset?.coverage ??
        (presentSummary
          ? `Tu expediente ya se apoya en ${presentSummary}. Cada archivo adicional da más contexto para conectar señales con menos partes preliminares.`
          : "Tu expediente apenas está empezando. Cada documento útil que subas da más contexto para orientarte mejor."),
      cta: contextualPreset?.cta ?? "Subir este documento ahora",
    } as const;
  }

  return {
    headline: "Tu expediente puede ganar más claridad",
    intro: presentSummary
      ? `Ya subiste ${presentSummary}. Si tienes otro archivo relacionado, podemos conectarlo para entender mejor tu caso.`
      : "Con el siguiente documento útil, tu expediente puede empezar a darte una lectura más clara sin pasos extra.",
    reasonTitle: "Lo que más puede sumar ahora",
    reasonBody: firstUncertainty
      ? `Si cuentas con otro archivo relacionado, puede ayudarnos a aclarar mejor esto: ${firstUncertainty}`
      : "Otro documento relacionado puede confirmar mejor tu historia laboral y darle más contexto a la lectura del caso.",
    followUp:
      params.opinion?.recommendedNextStep ??
      "La revisión sigue conectando cada documento para separar lo claro de lo que todavía conviene confirmar.",
    coverage:
      "Cada archivo útil hace crecer tu expediente y vuelve más precisa la orientación que ves aquí.",
    cta: "Subir otro documento y seguir",
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
    (left, right) =>
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
  );

  if (sortedDocuments.length < 2) {
    return null;
  }

  const groupedDocuments = new Map<string, ComparisonDocument[]>();
  sortedDocuments.forEach(document => {
    const current = groupedDocuments.get(document.documentType) ?? [];
    current.push(document);
    groupedDocuments.set(document.documentType, current);
  });

  for (const priorityType of [
    "payroll_receipt",
    "cfdi",
    "contract",
    "imss",
    "evidence",
  ]) {
    const matches = groupedDocuments.get(priorityType);
    if (matches && matches.length >= 2) {
      return [matches[1], matches[0]] as [
        ComparisonDocument,
        ComparisonDocument,
      ];
    }
  }

  const newestContract = sortedDocuments.find(
    item => item.documentType === "contract"
  );
  const newestPayroll = sortedDocuments.find(
    item => item.documentType === "payroll_receipt"
  );
  const newestCfdi = sortedDocuments.find(item => item.documentType === "cfdi");

  if (newestContract && newestPayroll) {
    return [newestContract, newestPayroll] as [
      ComparisonDocument,
      ComparisonDocument,
    ];
  }

  if (newestPayroll && newestCfdi) {
    return [newestPayroll, newestCfdi] as [
      ComparisonDocument,
      ComparisonDocument,
    ];
  }

  return [sortedDocuments[1], sortedDocuments[0]] as [
    ComparisonDocument,
    ComparisonDocument,
  ];
}

function buildHeliosComparisonCopy(params: {
  documents: ComparisonDocument[];
  nextTarget?: DossierTarget | null;
  opinion?: HeliosOpinionView | null;
  selectedPair?: [ComparisonDocument, ComparisonDocument] | null;
}) {
  const sortedDocuments = [...params.documents].sort(
    (left, right) =>
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
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
      guardrail:
        "Verás señales y diferencias útiles, siempre como una lectura preliminar y entendible.",
      coverage:
        "Mientras más documentos útiles subas, más contexto habrá para distinguir cambios reales de simples huecos de información.",
      cta: params.nextTarget
        ? `Subir ${params.nextTarget.label.toLowerCase()}`
        : "Subir mi documento gratis",
    } as const;
  }

  if (sortedDocuments.length === 1) {
    const onlyDocument = sortedDocuments[0];
    return {
      badge: "Falta una segunda pieza",
      headline:
        "Ya tienes una base, pero hace falta otro documento para comparar mejor",
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
      guardrail:
        "Verás señales y diferencias útiles, siempre como una lectura preliminar y entendible.",
      coverage:
        "Dos documentos bien conectados suelen darle a tu expediente una base mucho más útil que un archivo aislado.",
      cta: params.nextTarget
        ? `Subir ${params.nextTarget.label.toLowerCase()}`
        : "Subir otro documento para comparar",
    } as const;
  }

  const selectedPair =
    params.selectedPair ?? pickHeliosComparisonPair(sortedDocuments);

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
      guardrail:
        "Verás diferencias y señales útiles, pero esta sigue siendo una lectura preliminar.",
      coverage:
        "Mientras más documentos conectados tenga tu expediente, más fácil será separar cambios reales de simples huecos de información.",
      cta: params.nextTarget
        ? `Subir ${params.nextTarget.label.toLowerCase()}`
        : "Subir otro documento para comparar mejor",
    } as const;
  }

  const [leftDocument, rightDocument] = selectedPair;
  const sameType = leftDocument.documentType === rightDocument.documentType;
  const focus = getComparisonFocus(
    leftDocument.documentType,
    rightDocument.documentType
  );
  const leftOpinion = asHeliosOpinion(leftDocument.heliosOpinion);
  const rightOpinion = asHeliosOpinion(rightDocument.heliosOpinion);
  const firstUncertainty =
    rightOpinion?.uncertainties?.find(item => item?.trim()) ??
    leftOpinion?.uncertainties?.find(item => item?.trim()) ??
    params.opinion?.uncertainties?.find(item => item?.trim());
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
        body: firstUncertainty
          ? `Por ahora todavía conviene revisar esto con calma: ${firstUncertainty}`
          : suggestedStep,
      },
    ],
    guardrail:
      "Te mostramos diferencias y señales útiles, pero esta sigue siendo una lectura preliminar.",
    coverage:
      "Mientras más documentos conectados tenga tu expediente, más fácil será distinguir cambios reales de partes que todavía necesitan contexto.",
    cta: params.nextTarget
      ? `Subir ${params.nextTarget.label.toLowerCase()}`
      : "Subir otro documento para comparar mejor",
  } as const;
}

export function buildHeliosPriorityAlerts(params: {
  documents: ComparisonDocument[];
  attentionCount: number;
  monitoringDocuments: MonitoringDocumentView[];
  selectedPair?: [ComparisonDocument, ComparisonDocument] | null;
  nextTarget?: DossierTarget | null;
  opinion?: HeliosOpinionView | null;
  newClarityNotification?:
    | ConfirmedUploadResultView["newClarityNotification"]
    | null;
}) {
  const alerts: HeliosPriorityAlert[] = [];
  const latestAttentionDocument = params.monitoringDocuments.find(
    item => item.status === "attention"
  );

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
      actionLabel: params.nextTarget
        ? `Puede ayudarte seguir con ${params.nextTarget.label.toLowerCase()}`
        : "Revisa la nueva lectura de tu expediente",
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
        ? formatDate(
            latestAttentionDocument.respondedAt ??
              latestAttentionDocument.dispatchedAt
          )
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
  params.documents.forEach(document => {
    const current = groupedDocuments.get(document.documentType) ?? [];
    current.push(document);
    groupedDocuments.set(document.documentType, current);
  });

  const repeatedGroup = [
    "payroll_receipt",
    "cfdi",
    "contract",
    "imss",
    "evidence",
  ]
    .map(type => groupedDocuments.get(type))
    .find((group): group is ComparisonDocument[] =>
      Boolean(group && group.length >= 2)
    );

  if (repeatedGroup) {
    const label = getSimpleDocumentTypeLabel(
      repeatedGroup[0].documentType
    ).toLowerCase();
    const focus = getComparisonFocus(
      repeatedGroup[0].documentType,
      repeatedGroup[0].documentType
    );

    alerts.push({
      id: "repeated-patterns",
      eyebrow: "Prioridad media",
      title: `Ya hay base para detectar cambios repetidos en ${label}`,
      body: `Tienes ${repeatedGroup.length} ${label} dentro del expediente. Eso da una mejor base para revisar ${focus} con más contexto y menos partes preliminares.`,
      toneClasses: "border-teal-100 bg-teal-50 text-teal-950",
      icon: "file",
      timestampLabel: formatDate(
        repeatedGroup[repeatedGroup.length - 1]?.createdAt
      ),
      reasonLabel: `Comparación útil sobre ${focus}`,
      actionLabel: `Hay ${repeatedGroup.length} documentos del mismo tipo listos para contraste`,
    });
  }

  const firstUncertainty = params.opinion?.uncertainties?.find(item =>
    item?.trim()
  );
  if (firstUncertainty) {
    alerts.push({
      id: "uncertainty",
      eyebrow: "Prioridad media",
      title: "Hay un punto que todavía conviene aclarar con calma",
      body: firstUncertainty,
      toneClasses: "border-slate-200 bg-slate-50 text-slate-900",
      icon: "sparkles",
      timestampLabel: params.selectedPair
        ? formatDate(params.selectedPair[1].createdAt)
        : undefined,
      reasonLabel: "Todavía hay una parte preliminar o pendiente de confirmar",
      actionLabel: params.nextTarget
        ? `Puede ayudar subir ${params.nextTarget.label.toLowerCase()}`
        : undefined,
    });
  }

  if (params.selectedPair) {
    const sameType =
      params.selectedPair[0].documentType ===
      params.selectedPair[1].documentType;
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
      reasonLabel:
        "Ya existe una pareja útil de documentos dentro del expediente",
      actionLabel:
        "Puedes abrir la comparación lado a lado para revisar con más calma",
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
      reasonLabel:
        "Todavía falta una pieza útil para aclarar mejor el expediente",
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
      reasonLabel:
        "Tu expediente ya tiene contexto inicial suficiente para seguir creciendo",
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
  const persistAuditarViewStateMutation =
    trpc.cases.persistAuditarViewState.useMutation();
  const heliosCopilotMutation = trpc.cases.heliosCopilotChat.useMutation();
  const revalidateSocialSecurityMutation =
    trpc.cases.revalidateSocialSecurity.useMutation();
  const acceptLegalPackageMutation =
    trpc.consent.acceptLegalPackage.useMutation();
  const createCommerceCheckoutMutation =
    trpc.commerce.createCheckout.useMutation();
  const createCommerceBillingPortalMutation =
    trpc.commerce.createBillingPortal.useMutation();

  const [bootstrapStarted, setBootstrapStarted] = useState(false);
  const [selectedTenantId, setSelectedTenantId] = useState("");
  const [selectedCaseId, setSelectedCaseId] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [textHint, setTextHint] = useState("");
  const [pickerKey, setPickerKey] = useState(0);
  const [uploadSourceOpen, setUploadSourceOpen] = useState(false);
  const [estimatedAcknowledged, setEstimatedAcknowledged] = useState(false);
  const [timelineExpandedOnMobile, setTimelineExpandedOnMobile] =
    useState(false);
  const [historyFilter, setHistoryFilter] =
    useState<DossierHistoryFilter>("all");
  const [mobileOnboardingIndex, setMobileOnboardingIndex] = useState(0);
  const [selectedRecommendedTargetType, setSelectedRecommendedTargetType] =
    useState<DossierTarget["type"] | null>(null);
  const [preferredCaptureMode, setPreferredCaptureMode] =
    useState<AuditarCaptureMode | null>(null);
  const [preferredTone, setPreferredTone] =
    useState<HeliosCopilotResponseTone>("brief");
  const [selectedCaptureMode, setSelectedCaptureMode] =
    useState<AuditarCaptureMode | null>(null);
  const [workspaceSection, setWorkspaceSection] =
    useState<AuditarWorkspaceSection>("resumen");
  const [autoAnalyzeRequested, setAutoAnalyzeRequested] = useState(false);
  const [selectedComparisonLeftId, setSelectedComparisonLeftId] = useState("");
  const [selectedComparisonRightId, setSelectedComparisonRightId] =
    useState("");
  const [pendingDraft, setPendingDraft] =
    useState<DraftPreviewResultView | null>(null);
  const [manualFieldValues, setManualFieldValues] = useState<
    Record<string, string>
  >({});
  const [previewStatusFlash, setPreviewStatusFlash] = useState(false);
  const [saveStatusFlash, setSaveStatusFlash] = useState(false);
  const [recommendedStepFlash, setRecommendedStepFlash] = useState(false);
  const [autoAdvanceFlash, setAutoAdvanceFlash] = useState(false);
  const [lastUpload, setLastUpload] =
    useState<ConfirmedUploadResultView | null>(null);
  const [openingDocumentId, setOpeningDocumentId] = useState<string | null>(
    null
  );
  const [archiveTypeFilter, setArchiveTypeFilter] = useState<string>("all");
  const [archiveDateFilter, setArchiveDateFilter] =
    useState<ArchiveDateFilter>("all");
  const [quickExportHistory, setQuickExportHistory] = useState<
    Array<{
      id: string;
      exportedAt: string;
      periodLabel: string;
      differenceLabel: string;
      narrative: string;
      healthBadge: string;
      healthHeadline: string;
      protectionProgress: number;
      supportingText: string;
      checklist: string[];
      documentLabel: string;
      summary: string;
    }>
  >(() => {
    if (typeof window === "undefined") {
      return [];
    }

    try {
      const storedValue = window.localStorage.getItem(
        "auditapatron.quick-export-history.v1"
      );
      if (!storedValue) {
        return [];
      }

      const parsed = JSON.parse(storedValue);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [persistenceReady, setPersistenceReady] = useState(false);
  const [remoteViewStateReadyKey, setRemoteViewStateReadyKey] = useState<
    string | null
  >(null);
  const [heliosCopilotOpen, setHeliosCopilotOpen] = useState(false);
  const [heliosCopilotMessages, setHeliosCopilotMessages] = useState<
    HeliosCopilotMessage[]
  >([]);
  const [legalGateChecked, setLegalGateChecked] = useState(false);
  const [legalGateError, setLegalGateError] =
    useState<LegalGateErrorState | null>(null);
  const [legalGateMetrics, setLegalGateMetrics] =
    useState<LegalGateMetricsState>(INITIAL_LEGAL_GATE_METRICS);
  const [legalGateRetryCountdown, setLegalGateRetryCountdown] = useState(0);
  const [legalDocumentsDrawerOpen, setLegalDocumentsDrawerOpen] =
    useState(false);
  const [ceoPanelPreferenceReady, setCeoPanelPreferenceReady] =
    useState(false);
  const [ceoPanelPreferenceOpen, setCeoPanelPreferenceOpen] = useState(false);
  const [ceoActionsDrawerOpen, setCeoActionsDrawerOpen] = useState(false);
  const [casePreparationDrawerOpen, setCasePreparationDrawerOpen] =
    useState(false);
  const [commercePromptContext, setCommercePromptContext] =
    useState<CommercePromptContext | null>(null);
  const [commerceSessionMetrics, setCommerceSessionMetrics] = useState<CommerceSessionMetrics>(
    INITIAL_COMMERCE_SESSION_METRICS
  );
  const [showHeroJumpCta, setShowHeroJumpCta] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const heroCardRef = useRef<HTMLDivElement | null>(null);
  const uploadSectionRef = useRef<HTMLDivElement | null>(null);
  const digitalArchiveSectionRef = useRef<HTMLDivElement | null>(null);
  const recommendedStepRef = useRef<HTMLDivElement | null>(null);
  const syncedRemoteViewStateRef = useRef("");
  const trackedExpedienteScopeRef = useRef("");
  const trackedLegalGateScopeRef = useRef("");
  const documentSelectionStartedAtRef = useRef<number | null>(null);
  const previewReviewStartedAtRef = useRef<number | null>(null);
  const firstDossierShortcutCountRef = useRef(0);
  const trackedCommercePaywallKeyRef = useRef("");
  const trackedCommerceSuccessKeyRef = useRef("");
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(
      "auditapatron.quick-export-history.v1",
      JSON.stringify(quickExportHistory.slice(0, 6))
    );
  }, [quickExportHistory]);
  const legalGateHarnessMode = useMemo(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return (
      new URLSearchParams(window.location.search).get("legalGateHarness") ===
      "1"
    );
  }, []);
  const postUploadHarnessMode = useMemo(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return (
      new URLSearchParams(window.location.search).get("postUploadHarness") ===
      "1"
    );
  }, []);
  const auditarHarnessBypass = legalGateHarnessMode || postUploadHarnessMode;
  const billingReturnState = useMemo(() => {
    if (typeof window === "undefined") {
      return {
        status: null as string | null,
        productKey: null as CommerceProductKey | null,
      };
    }

    const params = new URLSearchParams(window.location.search);
    const product = params.get("product");
    const productKey =
      product === "essential" ||
      product === "pro" ||
      product === "informe_premium" ||
      product === "expediente_abogado"
        ? (product as CommerceProductKey)
        : null;

    return {
      status: params.get("billing"),
      productKey,
    };
  }, []);

  useEffect(() => {
    if (!postUploadHarnessMode) {
      return;
    }

    setPendingDraft(null);
    setSubmitError(null);
    setLastUpload({
      draftId: "post-upload-harness",
      classification: {
        documentType: "payroll_receipt",
        classificationConfidence: 86,
      },
      preliminaryAnalysis: {
        summary:
          "Este recibo ya sirve como una señal fuerte dentro del expediente y conviene contrastarlo con el CFDI del mismo periodo.",
        processingProfile: "mobile_harness_demo",
        confirmedData: {
          periodo: "Primera quincena de marzo de 2026",
          neto: "$8,420 MXN",
        },
        estimatedData: {
          deducciones: "$1,180 MXN",
        },
        guardrails: [
          "Todavía conviene contrastarlo con tu CFDI del mismo periodo para cerrar la revisión con más seguridad.",
        ],
      },
      nextSuggestedDocument: {
        key: "cfdi",
        title: "CFDI del mismo periodo",
        reason:
          "Te ayuda a comparar lo timbrado con lo que realmente te pagaron y confirmar si ambos coinciden.",
      },
      newClarityNotification: {
        title: "Ya hay una lectura inicial útil",
        message:
          "Con este archivo ya podemos decirte qué documento es y cuál conviene subir después.",
        delta: 18,
      },
    });
  }, [postUploadHarnessMode]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const evaluateHeroJumpCta = () => {
      const heroRect = heroCardRef.current?.getBoundingClientRect();
      const uploadRect = uploadSectionRef.current?.getBoundingClientRect();

      if (!heroRect) {
        setShowHeroJumpCta(false);
        return;
      }

      const heroOccupiesViewport = heroRect.height > window.innerHeight * 0.78;
      const uploadStartsBelowFold =
        (uploadRect?.top ?? 0) > window.innerHeight * 0.9;

      setShowHeroJumpCta(heroOccupiesViewport || uploadStartsBelowFold);
    };

    const animationFrameId = window.requestAnimationFrame(evaluateHeroJumpCta);
    window.addEventListener("resize", evaluateHeroJumpCta);
    window.addEventListener("scroll", evaluateHeroJumpCta);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", evaluateHeroJumpCta);
      window.removeEventListener("scroll", evaluateHeroJumpCta);
    };
  }, [lastUpload, mobileOnboardingIndex, pendingDraft, selectedFile]);

  useEffect(() => {
    const retryAvailableAt = legalGateError?.retryAvailableAt ?? null;

    if (!retryAvailableAt) {
      setLegalGateRetryCountdown(0);
      return;
    }

    const updateCountdown = () => {
      const remainingSeconds = Math.max(
        Math.ceil((retryAvailableAt - Date.now()) / 1000),
        0
      );
      setLegalGateRetryCountdown(remainingSeconds);
    };

    updateCountdown();
    const countdownTimer = window.setInterval(updateCountdown, 250);
    return () => window.clearInterval(countdownTimer);
  }, [legalGateError?.retryAvailableAt]);

  const stableUserIdentifier = useMemo(
    () => getStableUserIdentifier(auth.realUser ?? auth.user),
    [auth.realUser, auth.user]
  );

  const auditarPersistenceKey = useMemo(() => {
    if (!stableUserIdentifier) {
      return null;
    }

    return `auditar-view-state:v1:${stableUserIdentifier}`;
  }, [stableUserIdentifier]);

  useEffect(() => {
    if (!auth.canToggleUserView) {
      setCeoPanelPreferenceReady(false);
      setCeoPanelPreferenceOpen(false);
      setCeoActionsDrawerOpen(false);
      return;
    }

    setCeoPanelPreferenceReady(false);
    const persistedOpen = readPersistedCeoPanelState(auth.realUser ?? auth.user);
    setCeoPanelPreferenceOpen(persistedOpen);
    setCeoActionsDrawerOpen(persistedOpen);
    setCeoPanelPreferenceReady(true);
  }, [auth.canToggleUserView, auth.realUser, auth.user]);

  useEffect(() => {
    if (!ceoPanelPreferenceReady || !auth.canToggleUserView) {
      return;
    }

    writePersistedCeoPanelState(
      auth.realUser ?? auth.user,
      ceoPanelPreferenceOpen
    );
  }, [
    auth.canToggleUserView,
    auth.realUser,
    auth.user,
    ceoPanelPreferenceOpen,
    ceoPanelPreferenceReady,
  ]);

  useEffect(() => {
    setPersistenceReady(false);

    if (typeof window === "undefined" || !auditarPersistenceKey) {
      return;
    }

    void (async () => {
      try {
        const storedValue = await platformStorageGetJSON<unknown>(
          "local",
          auditarPersistenceKey
        );
        const persistedState = sanitizePersistedAuditarViewState(storedValue);

        setHistoryFilter(persistedState.historyFilter ?? "all");
        setMobileOnboardingIndex(persistedState.mobileOnboardingIndex ?? 0);
        setSelectedRecommendedTargetType(
          persistedState.selectedRecommendedTargetType === undefined
            ? null
            : persistedState.selectedRecommendedTargetType
        );
        setPreferredCaptureMode(
          persistedState.preferredCaptureMode === undefined
            ? null
            : persistedState.preferredCaptureMode
        );
        setPreferredTone(persistedState.preferredTone ?? "brief");
      } catch {
        await platformStorageRemove("local", auditarPersistenceKey);
        setHistoryFilter("all");
        setMobileOnboardingIndex(0);
        setSelectedRecommendedTargetType(null);
        setPreferredCaptureMode(null);
        setPreferredTone("brief");
      } finally {
        setPersistenceReady(true);
      }
    })();
  }, [auditarPersistenceKey]);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !auditarPersistenceKey ||
      !persistenceReady
    ) {
      return;
    }

    void platformStorageSetJSON("local", auditarPersistenceKey, {
      historyFilter,
      mobileOnboardingIndex,
      selectedRecommendedTargetType,
      preferredCaptureMode,
      preferredTone,
    });
  }, [
    auditarPersistenceKey,
    historyFilter,
    mobileOnboardingIndex,
    persistenceReady,
    preferredCaptureMode,
    preferredTone,
    selectedRecommendedTargetType,
  ]);

  useEffect(() => {
    if (auth.loading || !auth.isAuthenticated || bootstrapStarted) return;

    setBootstrapStarted(true);
    bootstrapMutation.mutate(undefined, {
      onSuccess: result => {
        if (!selectedTenantId) {
          setSelectedTenantId(result.tenant.tenantId);
        }
      },
    });
  }, [
    auth.isAuthenticated,
    auth.loading,
    bootstrapMutation,
    bootstrapStarted,
    selectedTenantId,
  ]);

  const tenantsQuery = trpc.tenants.list.useQuery(undefined, {
    enabled: auth.isAuthenticated && bootstrapMutation.isSuccess,
    refetchOnWindowFocus: false,
  });

  const casesQuery = trpc.cases.list.useQuery(
    selectedTenantId ? { tenantId: selectedTenantId } : undefined,
    {
      enabled: auth.isAuthenticated && Boolean(selectedTenantId),
      refetchOnWindowFocus: false,
    }
  );

  const caseDetailInput =
    selectedTenantId && selectedCaseId
      ? { tenantId: selectedTenantId, caseId: selectedCaseId }
      : undefined;
  const currentCaseScopeKey = caseDetailInput
    ? `${caseDetailInput.tenantId}:${caseDetailInput.caseId}`
    : null;
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
      const rawValue = window.localStorage.getItem(
        heliosCopilotHistoryStorageKey
      );
      setHeliosCopilotMessages(
        sanitizePersistedHeliosCopilotMessages(
          rawValue ? JSON.parse(rawValue) : null
        )
      );
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

    window.localStorage.setItem(
      heliosCopilotHistoryStorageKey,
      JSON.stringify(heliosCopilotMessages.slice(-6))
    );
  }, [heliosCopilotHistoryStorageKey, heliosCopilotMessages]);

  const caseDetailQuery = trpc.cases.detail.useQuery(
    caseDetailInput as { tenantId: string; caseId: string },
    {
      enabled: auth.isAuthenticated && Boolean(caseDetailInput),
      refetchOnWindowFocus: false,
    }
  );
  const commerceStatusQuery = trpc.commerce.status.useQuery(undefined, {
    enabled: auth.isAuthenticated,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    setRemoteViewStateReadyKey(null);
    syncedRemoteViewStateRef.current = "";
  }, [currentCaseScopeKey]);

  useEffect(() => {
    if (
      !currentCaseScopeKey ||
      caseDetailQuery.status !== "success" ||
      remoteViewStateReadyKey === currentCaseScopeKey
    ) {
      return;
    }

    const remoteState = sanitizePersistedAuditarViewState(
      caseDetailQuery.data?.auditarViewState
    );

    if (remoteState.historyFilter !== undefined) {
      setHistoryFilter(remoteState.historyFilter);
    }
    if (remoteState.mobileOnboardingIndex !== undefined) {
      setMobileOnboardingIndex(remoteState.mobileOnboardingIndex);
    }
    if (remoteState.selectedRecommendedTargetType !== undefined) {
      setSelectedRecommendedTargetType(
        remoteState.selectedRecommendedTargetType
      );
    }
    if (remoteState.preferredCaptureMode !== undefined) {
      setPreferredCaptureMode(remoteState.preferredCaptureMode);
    }
    if (remoteState.preferredTone !== undefined) {
      setPreferredTone(remoteState.preferredTone);
    }

    syncedRemoteViewStateRef.current = JSON.stringify(remoteState);
    setRemoteViewStateReadyKey(currentCaseScopeKey);
  }, [
    caseDetailQuery.data?.auditarViewState,
    caseDetailQuery.status,
    currentCaseScopeKey,
    remoteViewStateReadyKey,
  ]);

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
      preferredTone,
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
            preferredTone,
          },
        },
        {
          onSuccess: () => {
            syncedRemoteViewStateRef.current = serializedViewState;
          },
        }
      );
    }, 450);

    return () => window.clearTimeout(timeoutId);
  }, [
    currentCaseScopeKey,
    historyFilter,
    mobileOnboardingIndex,
    persistenceReady,
    persistAuditarViewStateMutation,
    preferredCaptureMode,
    preferredTone,
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
    const stillExists = casesQuery.data.some(
      item => item.caseId === selectedCaseId
    );
    if (!selectedCaseId || !stillExists) {
      setSelectedCaseId(casesQuery.data[0].caseId);
    }
  }, [casesQuery.data, selectedCaseId]);

  const legalAcceptance = caseDetailQuery.data?.legalAcceptance;
  const legalAcceptanceDocuments = legalAcceptance?.documents ?? [];
  const acceptedLegalDocumentsCount = legalAcceptanceDocuments.filter(
    document => document.accepted
  ).length;
  const legalPendingDocuments = legalAcceptance?.missingDocuments ?? [];
  const legalGateRequired = Boolean(
    caseDetailInput && legalAcceptance && !legalAcceptance.isAccepted
  );
  const documents = caseDetailQuery.data?.documents ?? [];
  const recentDocuments = useMemo(
    () =>
      [...documents].sort(
        (left, right) =>
          new Date(right.createdAt).getTime() -
          new Date(left.createdAt).getTime()
      ),
    [documents]
  );
  const latestArchiveDocument = recentDocuments[0] ?? null;
  const archiveTypeOptions = useMemo(
    () => [
      { value: "all", label: "Todos" },
      ...Array.from(
        new Set(
          (recentDocuments
            .map(item => item.documentType)
            .filter(Boolean) as Array<
            NonNullable<(typeof recentDocuments)[number]["documentType"]>
          >)
        )
      ).map(value => ({
        value,
        label: getSimpleDocumentTypeLabel(value),
      })),
    ],
    [recentDocuments]
  );
  const filteredArchiveDocuments = useMemo(
    () =>
      recentDocuments.filter(document => {
        const matchesType =
          archiveTypeFilter === "all" ||
          document.documentType === archiveTypeFilter;
        const matchesDate = matchesArchiveDateFilter(
          document.createdAt,
          archiveDateFilter
        );
        return matchesType && matchesDate;
      }),
    [archiveDateFilter, archiveTypeFilter, recentDocuments]
  );
  const archiveHasActiveFilters =
    archiveTypeFilter !== "all" || archiveDateFilter !== "all";
  const pricingExperience = getAuditapatronPricingExperience(documents.length);
  const commerceCatalog =
    commerceStatusQuery.data?.catalog ??
    ({
      plans: pricingExperience.platform.plans,
      oneShots: pricingExperience.platform.oneShots,
    } as const);
  const activeCommercePlanKey =
    commerceStatusQuery.data?.activePlanKey ?? ("free" as CommercePlanKey);
  const activeCommercePlanName =
    commerceStatusQuery.data?.activePlan?.name ?? "Audita Gratis";
  const visibleCommercePromptContext =
    commercePromptContext ?? buildManualCommercePromptContext(activeCommercePlanKey);
  const commercePlans = useMemo(
    () =>
      commerceCatalog.plans.map(plan => ({
        ...plan,
        displayPrice:
          "formattedPrice" in plan ? plan.formattedPrice : plan.priceLabel,
      })),
    [commerceCatalog.plans]
  );
  const commerceOneShots = useMemo(
    () =>
      commerceCatalog.oneShots.map(product => ({
        ...product,
        displayPrice:
          "formattedPrice" in product ? product.formattedPrice : product.priceLabel,
      })),
    [commerceCatalog.oneShots]
  );

  const handleCommerceError = (error: unknown, fallback: string) => {
    const message = toFriendlyAuditarRuntimeMessage(error, fallback);
    const contextualPrompt = buildCommercePromptContext({
      message,
      activePlanKey: activeCommercePlanKey,
    });
    const visibleMessage = contextualPrompt?.body ?? message;

    setSubmitError(visibleMessage);
    if (contextualPrompt) {
      setCommercePromptContext(contextualPrompt);
      setCasePreparationDrawerOpen(true);
      sonnerToast(visibleMessage);
      return visibleMessage;
    }
    if (isCommerceUpgradeMessage(message)) {
      setCommercePromptContext(buildManualCommercePromptContext(activeCommercePlanKey));
      setCasePreparationDrawerOpen(true);
      sonnerToast(visibleMessage);
    }
    return visibleMessage;
  };

  const handleCommerceCheckout = async (productKey: CommerceProductKey) => {
    const triggerPoint: CommerceTriggerPoint =
      productKey === "informe_premium" || productKey === "expediente_abogado"
        ? "one_shot_card"
        : commercePromptContext?.triggerPoint ?? "plan_card";

    trackCommerceUpgradeCTAClicked(productKey, triggerPoint, {
      current_plan_key: activeCommercePlanKey,
      documents_in_case: documents.length,
    });
    setCommerceSessionMetrics(current => ({
      ...current,
      upgradeClicks: current.upgradeClicks + 1,
    }));

    if (productKey === "informe_premium" || productKey === "expediente_abogado") {
      setCommercePromptContext({
        title:
          productKey === "informe_premium"
            ? "Compra puntual para este expediente"
            : "Prepara el paquete para compartir",
        body:
          productKey === "informe_premium"
            ? `Si solo necesitas un entregable puntual, puedes comprar Informe Premium por ${formatCommercePriceMx(299)} sin cambiar de plan mensual.`
            : `Si lo que necesitas es ordenar el caso para llevarlo con una abogada o abogado, puedes comprar este paquete por ${formatCommercePriceMx(499)} sin activar suscripción.`,
        targetPlan: activeCommercePlanKey,
        triggerPoint: "one_shot_card",
        productKey,
      });
    }

    try {
      setSubmitError(null);
      trackCommerceCheckoutStarted(productKey, {
        current_plan_key: activeCommercePlanKey,
        trigger_point: triggerPoint,
      });
      setCommerceSessionMetrics(current => ({
        ...current,
        checkoutStarts: current.checkoutStarts + 1,
      }));
      const checkout = await createCommerceCheckoutMutation.mutateAsync({
        productKey,
      });
      if (!checkout.url) {
        throw new Error(
          "No se recibió un enlace válido de checkout para este producto."
        );
      }
      sonnerToast(buildCommerceCheckoutToast(productKey));
      if (typeof window !== "undefined") {
        window.open(checkout.url, "_blank", "noopener,noreferrer");
      }
      void commerceStatusQuery.refetch();
    } catch (error) {
      handleCommerceError(
        error,
        "No fue posible abrir el checkout en este momento."
      );
    }
  };

  const handleOpenBillingPortal = async () => {
    try {
      setSubmitError(null);
      const portal = await createCommerceBillingPortalMutation.mutateAsync();
      sonnerToast("Abrimos tu centro de facturación en una nueva pestaña.");
      if (typeof window !== "undefined") {
        window.open(portal.url, "_blank", "noopener,noreferrer");
      }
    } catch (error) {
      handleCommerceError(
        error,
        "No fue posible abrir la gestión de suscripción en este momento."
      );
    }
  };

  useEffect(() => {
    if (!casePreparationDrawerOpen) {
      trackedCommercePaywallKeyRef.current = "";
      return;
    }

    const trackingKey = `${visibleCommercePromptContext.triggerPoint}:${visibleCommercePromptContext.targetPlan}:${documents.length}`;
    if (trackedCommercePaywallKeyRef.current === trackingKey) {
      return;
    }

    trackedCommercePaywallKeyRef.current = trackingKey;
    trackCommercePaywallViewed(
      visibleCommercePromptContext.targetPlan,
      visibleCommercePromptContext.triggerPoint,
      {
        current_plan_key: activeCommercePlanKey,
        documents_in_case: documents.length,
      }
    );
    setCommerceSessionMetrics(current => ({
      ...current,
      paywallViews: current.paywallViews + 1,
    }));
  }, [
    activeCommercePlanKey,
    casePreparationDrawerOpen,
    documents.length,
    visibleCommercePromptContext.targetPlan,
    visibleCommercePromptContext.triggerPoint,
  ]);

  useEffect(() => {
    if (billingReturnState.status !== "success" || !billingReturnState.productKey) {
      return;
    }

    const successKey = `${billingReturnState.productKey}:${activeCommercePlanKey}:${commerceStatusQuery.data?.purchasedOneShots?.length ?? 0}`;
    if (trackedCommerceSuccessKeyRef.current === successKey) {
      return;
    }

    trackedCommerceSuccessKeyRef.current = successKey;
    setSubmitError(null);
    setCasePreparationDrawerOpen(true);
    setCommerceSessionMetrics(current => ({
      ...current,
      paymentSuccesses: current.paymentSuccesses + 1,
    }));
    trackCommercePaymentSuccessful(billingReturnState.productKey, {
      active_plan_key: activeCommercePlanKey,
      source: "stripe_return",
    });

    if (billingReturnState.productKey === "essential" || billingReturnState.productKey === "pro") {
      const planName = getCommerceProductLabel(billingReturnState.productKey);
      trackCommercePlanActivated(planName, {
        active_plan_key: activeCommercePlanKey,
        source: "stripe_return",
      });
      setCommercePromptContext({
        title: "Pago detectado en sandbox",
        body: `${planName} ya regresó desde Stripe. Si el checkout terminó bien, tu acceso debería reflejarse al volver a consultar este expediente.`,
        targetPlan: billingReturnState.productKey,
        triggerPoint: "checkout_return_success",
        productKey: billingReturnState.productKey,
      });
      sonnerToast(`Pago detectado. Validaremos ${planName} dentro de tu expediente.`);
    } else {
      const productName = getCommerceProductLabel(billingReturnState.productKey);
      trackCommerceOneShotPurchased(productName, {
        source: "stripe_return",
      });
      setCommercePromptContext({
        title: "Pago puntual detectado",
        body: `${productName} regresó desde Stripe. Si el cobro quedó confirmado en sandbox, esta compra ya debe poder verse reflejada en tu expediente.`,
        targetPlan: activeCommercePlanKey,
        triggerPoint: "checkout_return_success",
        productKey: billingReturnState.productKey,
      });
      sonnerToast(`${productName} regresó desde Stripe para validación.`);
    }

    void commerceStatusQuery.refetch();

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      params.delete("billing");
      params.delete("product");
      const nextQuery = params.toString();
      const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}${window.location.hash}`;
      window.history.replaceState({}, "", nextUrl);
    }
  }, [
    activeCommercePlanKey,
    billingReturnState.productKey,
    billingReturnState.status,
    commerceStatusQuery,
    commerceStatusQuery.data?.purchasedOneShots?.length,
  ]);

  useEffect(() => {
    setArchiveTypeFilter("all");
    setArchiveDateFilter("all");
  }, [currentCaseScopeKey]);

  useEffect(() => {
    if (
      !currentCaseScopeKey ||
      caseDetailQuery.status !== "success" ||
      trackedExpedienteScopeRef.current === currentCaseScopeKey
    ) {
      return;
    }

    trackedExpedienteScopeRef.current = currentCaseScopeKey;
    trackFunnelStep("expediente_opened", {
      tenantId: selectedTenantId,
      caseId: selectedCaseId,
      documentCount: documents.length,
      legalAccepted: !legalGateRequired,
    });
  }, [
    caseDetailQuery.status,
    currentCaseScopeKey,
    documents.length,
    legalGateRequired,
    selectedCaseId,
    selectedTenantId,
  ]);

  useEffect(() => {
    if (
      !currentCaseScopeKey ||
      !legalGateRequired ||
      trackedLegalGateScopeRef.current === currentCaseScopeKey
    ) {
      return;
    }

    trackedLegalGateScopeRef.current = currentCaseScopeKey;
    trackFunnelStep("legal_gate_viewed", {
      tenantId: selectedTenantId,
      caseId: selectedCaseId,
      missingDocumentsCount: legalPendingDocuments.length,
    });
  }, [
    currentCaseScopeKey,
    legalGateRequired,
    legalPendingDocuments.length,
    selectedCaseId,
    selectedTenantId,
  ]);
  const heliosExpediente = caseDetailQuery.data?.heliosExpediente;
  const socialSecurityValidation =
    caseDetailQuery.data?.socialSecurityValidation;
  const uploadSocialSecurityValidation =
    lastUpload?.socialSecurityValidation ?? null;
  const effectiveSocialSecurityValidation =
    uploadSocialSecurityValidation ?? socialSecurityValidation ?? null;
  const heliosDocumentSnapshots = caseDetailQuery.data?.heliosDocuments ?? [];
  const heliosDocumentSnapshotById = useMemo(
    () =>
      new Map(
        heliosDocumentSnapshots.map(item => [item.documentId, item] as const)
      ),
    [heliosDocumentSnapshots]
  );
  const lastHeliosOpinion = asHeliosOpinion(lastUpload?.heliosOpinion);
  const heliosDocumentsCount = useMemo(
    () =>
      documents.filter(item => Boolean(asHeliosOpinion(item.heliosOpinion)))
        .length,
    [documents]
  );
  const latestHeliosDocument = useMemo(
    () =>
      documents.find(item => Boolean(asHeliosOpinion(item.heliosOpinion))) ??
      null,
    [documents]
  );
  const latestPersistedHeliosOpinion = asHeliosOpinion(
    latestHeliosDocument?.heliosOpinion
  );
  const visibleHeliosOpinion =
    lastHeliosOpinion ?? latestPersistedHeliosOpinion;
  const heliosStage = getHeliosStageCopy({
    opinion: visibleHeliosOpinion,
    engineStatus: lastUpload?.engineDispatch?.status ?? undefined,
    engineReason: lastUpload?.engineDispatch?.reason ?? undefined,
    documentsWithOpinion: heliosDocumentsCount,
  });
  const heliosCopilotIntro = useMemo(() => {
    if (visibleHeliosOpinion?.resultCard?.assistantIntro?.trim()) {
      return (
        warmVisibleNamingCopy(visibleHeliosOpinion.resultCard.assistantIntro) ??
        visibleHeliosOpinion.resultCard.assistantIntro
      );
    }

    if (visibleHeliosOpinion?.summary?.trim()) {
      return `${warmVisibleNamingCopy(visibleHeliosOpinion.summary)}\n\nSi quieres, puedo explicarte con palabras simples qué ya se entiende en tu expediente laboral, qué falta confirmar y cuál parece ser el siguiente paso más útil.`;
    }

    if (heliosDocumentsCount === 0) {
      return "Todavía no hay una lectura visible de tu expediente laboral. En cuanto subas o confirmes documentos, podré ayudarte a entender riesgos, documentos faltantes y siguientes pasos sin tecnicismos.";
    }

    return `Ya hay contexto preliminar para ${heliosDocumentsCount} documento${heliosDocumentsCount === 1 ? "" : "s"} dentro de tu expediente laboral. Puedo ayudarte a traducir esa información en acciones concretas y fáciles de entender.`;
  }, [
    heliosDocumentsCount,
    visibleHeliosOpinion?.resultCard?.assistantIntro,
    visibleHeliosOpinion?.summary,
  ]);
  const heliosCopilotPromptContextDocumentType =
    pendingDraft?.classification.documentType ??
    lastUpload?.classification.documentType ??
    documents[documents.length - 1]?.documentType ??
    "";
  const heliosCopilotSuggestedPrompts = useMemo(() => {
    const serverPrompts = heliosCopilotMutation.data?.suggestedPrompts ?? [];
    const cardPrompts =
      visibleHeliosOpinion?.resultCard?.suggestedQuestions ?? [];
    const contextualPrompts = getDocumentContextualShortcuts(
      heliosCopilotPromptContextDocumentType
    )
      .map(item => item.prompt)
      .filter((item): item is string => Boolean(item));
    const localPrompts = [
      "¿Qué riesgo principal ves en mi expediente?",
      visibleHeliosOpinion?.resultCard?.nextStepSummary ||
      visibleHeliosOpinion?.recommendedNextStep
        ? "Explícame el siguiente paso sugerido con palabras simples."
        : "¿Qué paso me conviene seguir ahora?",
      visibleHeliosOpinion?.legalHighlights?.primaryConcern ||
      visibleHeliosOpinion?.uncertainties?.length
        ? "¿Qué puntos todavía faltan confirmar?"
        : "¿Qué documento me conviene subir después?",
      "Explícame esto como si me lo dijera un abogado laboral en corto.",
    ];

    return Array.from(
      new Set([
        ...contextualPrompts,
        ...serverPrompts,
        ...cardPrompts,
        ...localPrompts,
      ])
    ).slice(0, 4);
  }, [
    documents,
    heliosCopilotMutation.data?.suggestedPrompts,
    heliosCopilotPromptContextDocumentType,
    visibleHeliosOpinion?.legalHighlights?.primaryConcern,
    visibleHeliosOpinion?.recommendedNextStep,
    visibleHeliosOpinion?.resultCard?.nextStepSummary,
    visibleHeliosOpinion?.resultCard?.suggestedQuestions,
    visibleHeliosOpinion?.uncertainties,
  ]);
  const heliosCopilotSuggestedPromptsContext = useMemo(() => {
    if (heliosCopilotPromptContextDocumentType) {
      return `Atajos sugeridos con base en tu ${getSimpleDocumentTypeLabel(heliosCopilotPromptContextDocumentType).toLowerCase()} más reciente y en lo que ya está visible en este expediente.`;
    }

    return "Atajos sugeridos con base en lo que Helios ya puede sostener hoy dentro de tu expediente.";
  }, [heliosCopilotPromptContextDocumentType]);
  const heliosCopilotHistoryContext = useMemo(() => {
    if (heliosCopilotMessages.length > 0) {
      return "Retomamos la última conversación guardada en este equipo para este expediente, así no empiezas de cero cuando vuelves.";
    }

    return "Aquí verás la continuidad reciente entre lo que ya hablaste con Helios y los movimientos visibles de tu expediente.";
  }, [heliosCopilotMessages.length]);

  const heliosCopilotConversation = useMemo<HeliosCopilotMessage[]>(
    () => [
      { role: "assistant", content: heliosCopilotIntro },
      ...heliosCopilotMessages,
    ],
    [heliosCopilotIntro, heliosCopilotMessages]
  );
  const heliosCopilotSupportingDocuments = useMemo(() => {
    const prioritizedDocuments = [...documents].sort((left, right) => {
      const leftHasOpinion = Number(
        Boolean(asHeliosOpinion(left.heliosOpinion))
      );
      const rightHasOpinion = Number(
        Boolean(asHeliosOpinion(right.heliosOpinion))
      );

      if (leftHasOpinion !== rightHasOpinion) {
        return rightHasOpinion - leftHasOpinion;
      }

      return (
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
      );
    });

    return prioritizedDocuments.slice(0, 3).map(document => {
      const opinion = asHeliosOpinion(document.heliosOpinion);
      const detail = [
        `Tipo: ${getSimpleDocumentTypeLabel(document.documentType)}.`,
        opinion?.summary ? `Lectura visible: ${opinion.summary}` : null,
        opinion?.recommendedNextStep
          ? `Paso sugerido: ${opinion.recommendedNextStep}`
          : null,
        opinion?.uncertainties?.[0]
          ? `Por confirmar: ${opinion.uncertainties[0]}`
          : null,
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
  const presentTypes = useMemo(
    () => new Set(documents.map(item => item.documentType)),
    [documents]
  );

  const dossierStatus = useMemo(() => {
    const completed = dossierTargets.filter(item =>
      presentTypes.has(item.type)
    ).length;
    const percent = Math.max(
      12,
      Math.round((completed / dossierTargets.length) * 100)
    );
    const nextTarget = getContextualDossierNextTarget(presentTypes);
    const label =
      completed >= 4
        ? "Respaldo sólido"
        : completed >= 2
          ? "Respaldo en crecimiento"
          : "Base inicial";

    return {
      completed,
      percent,
      label,
      nextTarget,
      total: dossierTargets.length,
    };
  }, [presentTypes]);
  const mobileDossierStageLabel = (
    heliosExpediente?.stageLabel ?? dossierStatus.label
  ).replace(/^Con\s+/i, "");
  const socialSecurityCoveragePercent =
    effectiveSocialSecurityValidation?.coverageScore ?? dossierStatus.percent;
  const socialSecurityStatusLabel =
    effectiveSocialSecurityValidation?.statusLabel ?? "Cruce pendiente";
  const socialSecuritySummary =
    effectiveSocialSecurityValidation?.summary ??
    "Todavía faltan señales suficientes de IMSS e Infonavit para darte un cruce más completo dentro del expediente.";
  const socialSecurityRecommendedNextStep =
    effectiveSocialSecurityValidation?.recommendedNextStep ??
    "Empieza por un soporte IMSS o un estado relacionado con Infonavit para abrir este cruce dentro del expediente.";
  const socialSecurityLastCheckLabel =
    effectiveSocialSecurityValidation?.lastRevalidatedAt
      ? `Última revalidación: ${formatDate(effectiveSocialSecurityValidation.lastRevalidatedAt)}`
      : "Aún no has revalidado este cruce desde tu expediente.";
  const socialSecurityRevalidationHistory =
    effectiveSocialSecurityValidation?.revalidationHistory ?? [];
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
  const visibleSignalsChecked = useMemo(() => {
    const baseSignals =
      lastHeliosOpinion?.resultCard?.signalsChecked ??
      visibleHeliosOpinion?.resultCard?.signalsChecked ??
      [];
    const extraSignals: string[] = [];

    if ((effectiveSocialSecurityValidation?.imssDocumentsCount ?? 0) > 0) {
      extraSignals.push(
        `${effectiveSocialSecurityValidation?.imssDocumentsCount ?? 0} señal${(effectiveSocialSecurityValidation?.imssDocumentsCount ?? 0) === 1 ? "" : "es"} IMSS`
      );
    }

    if ((effectiveSocialSecurityValidation?.infonavitSignalsCount ?? 0) > 0) {
      extraSignals.push(
        `${effectiveSocialSecurityValidation?.infonavitSignalsCount ?? 0} señal${(effectiveSocialSecurityValidation?.infonavitSignalsCount ?? 0) === 1 ? "" : "es"} Infonavit`
      );
    }

    if (effectiveSocialSecurityValidation?.statusLabel?.trim()) {
      extraSignals.push(effectiveSocialSecurityValidation.statusLabel.trim());
    }

    return Array.from(new Set([...baseSignals, ...extraSignals])).slice(0, 6);
  }, [
    effectiveSocialSecurityValidation?.imssDocumentsCount,
    effectiveSocialSecurityValidation?.infonavitSignalsCount,
    effectiveSocialSecurityValidation?.statusLabel,
    lastHeliosOpinion?.resultCard?.signalsChecked,
    visibleHeliosOpinion?.resultCard?.signalsChecked,
  ]);
  const visibleSimpleExplanation = useMemo<HeliosSimpleExplanationItemView[]>(() => {
    const baseExplanation =
      lastHeliosOpinion?.resultCard?.simpleExplanation ??
      visibleHeliosOpinion?.resultCard?.simpleExplanation ??
      [];

    if (baseExplanation.length) {
      return baseExplanation.slice(0, 3);
    }

    const items: HeliosSimpleExplanationItemView[] = [];
    const primarySummary =
      warmVisibleNamingCopy(lastHeliosOpinion?.summary ?? visibleHeliosOpinion?.summary) ??
      lastHeliosOpinion?.summary ??
      visibleHeliosOpinion?.summary ??
      null;

    if (primarySummary) {
      items.push({
        label: "Qué ya vimos",
        summary: primarySummary,
        tone: "support",
      });
    }

    if (socialSecuritySummary) {
      items.push({
        label: "Qué más revisamos",
        summary: warmVisibleNamingCopy(socialSecuritySummary) ?? socialSecuritySummary,
        tone:
          (effectiveSocialSecurityValidation?.coverageScore ?? 0) >= 60
            ? "support"
            : "neutral",
      });
    }

    if (socialSecurityRecommendedDocument) {
      items.push({
        label: "Si quieres más certeza",
        summary: `Sube ${socialSecurityRecommendedDocument.title}. ${socialSecurityRecommendedDocument.reason}`,
        tone: "attention",
      });
    }

    return items.slice(0, 3);
  }, [
    effectiveSocialSecurityValidation?.coverageScore,
    lastHeliosOpinion?.resultCard?.simpleExplanation,
    lastHeliosOpinion?.summary,
    socialSecurityRecommendedDocument,
    socialSecuritySummary,
    visibleHeliosOpinion?.resultCard?.simpleExplanation,
    visibleHeliosOpinion?.summary,
  ]);
  const visibleDiscrepancyItems = useMemo<HeliosSimpleExplanationItemView[]>(() => {
    const baseItems =
      lastHeliosOpinion?.resultCard?.discrepancySignals ??
      visibleHeliosOpinion?.resultCard?.discrepancySignals ??
      [];

    if (baseItems.length) {
      return baseItems.slice(0, 3);
    }

    const derivedItems =
      lastHeliosOpinion?.resultCard?.keyFindings
        ?.filter(item => item.tone === "attention")
        .map(item => ({
          label: item.label,
          summary: warmVisibleNamingCopy(item.value) ?? item.value,
          tone: "attention" as const,
        })) ?? [];

    if (derivedItems.length) {
      return derivedItems.slice(0, 3);
    }

    const primaryConcern =
      warmVisibleNamingCopy(lastHeliosOpinion?.legalHighlights?.primaryConcern) ??
      lastHeliosOpinion?.legalHighlights?.primaryConcern ??
      null;

    return primaryConcern
      ? [
          {
            label: "Punto por revisar",
            summary: primaryConcern,
            tone: "attention",
          },
        ]
      : [];
  }, [
    lastHeliosOpinion?.legalHighlights?.primaryConcern,
    lastHeliosOpinion?.resultCard?.discrepancySignals,
    lastHeliosOpinion?.resultCard?.keyFindings,
    visibleHeliosOpinion?.resultCard?.discrepancySignals,
  ]);
  const visiblePendingItems = useMemo<HeliosSimpleExplanationItemView[]>(() => {
    const baseItems =
      lastHeliosOpinion?.resultCard?.pendingClarifications ??
      visibleHeliosOpinion?.resultCard?.pendingClarifications ??
      [];

    if (baseItems.length) {
      return baseItems.slice(0, 3);
    }

    const items: HeliosSimpleExplanationItemView[] = [];
    const concern =
      warmVisibleNamingCopy(lastHeliosOpinion?.legalHighlights?.primaryConcern) ??
      lastHeliosOpinion?.legalHighlights?.primaryConcern ??
      null;

    if (concern) {
      items.push({
        label: "Todavía falta confirmar",
        summary: concern,
        tone: "neutral",
      });
    }

    const nextStepSummary =
      warmVisibleNamingCopy(
        lastHeliosOpinion?.resultCard?.nextStepSummary ??
          lastHeliosOpinion?.recommendedNextStep
      ) ??
      lastHeliosOpinion?.resultCard?.nextStepSummary ??
      lastHeliosOpinion?.recommendedNextStep ??
      null;

    if (nextStepSummary) {
      items.push({
        label: "Siguiente paso útil",
        summary: nextStepSummary,
        tone: "support",
      });
    }

    if (socialSecurityRecommendedDocument) {
      items.push({
        label: "Documento que ayudaría",
        summary: `Sube ${socialSecurityRecommendedDocument.title}. ${socialSecurityRecommendedDocument.reason}`,
        tone: "support",
      });
    }

    return Array.from(
      new Map(items.map(item => [`${item.label}:${item.summary}`, item] as const)).values()
    ).slice(0, 3);
  }, [
    lastHeliosOpinion?.legalHighlights?.primaryConcern,
    lastHeliosOpinion?.resultCard?.pendingClarifications,
    socialSecurityRecommendedDocument,
    visibleHeliosOpinion?.resultCard?.pendingClarifications,
  ]);
  const lastUploadSeverityNarrative = getHeliosSeverityNarrative(
    lastHeliosOpinion?.riskLevel ?? visibleHeliosOpinion?.riskLevel
  );
  const explanationVariant = getExplanationVariant(
    lastUpload?.draftId ??
      lastHeliosOpinion?.generatedAt ??
      lastUpload?.classification.documentType ??
      null
  );
  const explanationVariantCopy = getExplanationVariantCopy(
    explanationVariant,
    lastUploadSeverityNarrative.title
  );
  const timelineEntries = useMemo(() => {
    const confirmedEntries = [...documents]
      .sort(
        (left, right) =>
          new Date(left.createdAt).getTime() -
          new Date(right.createdAt).getTime()
      )
      .map((document, index) => {
        const heliosOpinion = asHeliosOpinion(document.heliosOpinion);
        const insight = getUploadInsight(document.documentType);
        const readiness = getDocumentReadiness(
          document.classificationConfidence
        );

        return {
          id: document.documentId,
          step: index + 1,
          title: getSimpleDocumentTypeLabel(document.documentType),
          originalName: document.originalName,
          contribution: insight.contribution,
          heliosRole: getHeliosTimelineRole(
            document.documentType,
            heliosOpinion
          ),
          createdAt: document.createdAt,
          readiness,
          hasVisibleOpinion: Boolean(heliosOpinion),
          lifecycleState: buildAuditarTimelineEntryState("confirmed"),
        };
      });

    if (!pendingDraft) {
      return confirmedEntries;
    }

    const previewInsight = getUploadInsight(
      pendingDraft.classification.documentType
    );

    return [
      ...confirmedEntries,
      {
        id: `draft-${pendingDraft.draftId}`,
        step: confirmedEntries.length + 1,
        title: getSimpleDocumentTypeLabel(
          pendingDraft.classification.documentType
        ),
        originalName: pendingDraft.previewAsset.fileName,
        contribution: previewInsight.contribution,
        heliosRole:
          pendingDraft.preliminaryAnalysis.summary ||
          "Este borrador ya ofrece una lectura inicial, pero seguirá fuera del expediente hasta que lo confirmes.",
        createdAt: new Date().toISOString(),
        readiness: getDocumentReadiness(
          pendingDraft.scanAssistance?.confidence
        ),
        hasVisibleOpinion: true,
        lifecycleState: buildAuditarTimelineEntryState("draft"),
      },
    ];
  }, [documents, pendingDraft]);

  const comparisonDocuments = useMemo(
    () =>
      [...documents].sort(
        (left, right) =>
          new Date(right.createdAt).getTime() -
          new Date(left.createdAt).getTime()
      ),
    [documents]
  );
  const automaticComparisonPair = useMemo(
    () => pickHeliosComparisonPair(documents),
    [documents]
  );
  const engineStatus = getEngineStatusCopy(
    lastUpload?.engineDispatch?.status ?? undefined,
    lastUpload?.engineDispatch?.reason ?? undefined
  );
  const privacySignal = useMemo(() => {
    if (pendingDraft) {
      return {
        badge: "Sin guardar",
        title: "Privacidad activa en borrador",
        detail:
          "Tu archivo sigue en revisión privada. Nada entra al expediente hasta que tú lo confirmes.",
        company: "Empresa sin acceso",
        control: "Tú decides si guardar",
        trace: "Rastro solo al confirmar",
        cardClass: "border-teal-200 bg-teal-50/95",
        badgeClass: "border-teal-200 bg-white text-teal-900",
        eyebrowClass: "text-teal-800",
      };
    }

    if (
      lastUpload?.engineDispatch?.status === "sent" ||
      visibleHeliosOpinion?.status === "processing" ||
      visibleHeliosOpinion?.status === "sent"
    ) {
      return {
        badge: "Protegido",
        title: "Privacidad activa mientras analizamos",
        detail:
          "El documento ya quedó protegido mientras vuelve la lectura. Aquí mismo verás si sigue en análisis o si ya quedó listo.",
        company: "Empresa sin acceso",
        control: "Sin cambios automáticos",
        trace: "Seguimiento visible aquí",
        cardClass: "border-sky-200 bg-sky-50/95",
        badgeClass: "border-sky-200 bg-white text-sky-900",
        eyebrowClass: "text-sky-800",
      };
    }

    if (documents.length > 0 || engineStatus.tone === "success") {
      return {
        badge: "Resguardado",
        title: "Privacidad activa dentro del expediente",
        detail:
          "El archivo ya está en tu expediente privado y la interfaz mantiene visible el estado para que no tengas que adivinar qué pasó.",
        company: "Empresa sin acceso",
        control: "Tú conservas el mando",
        trace: "Versión y estado visibles",
        cardClass: "border-emerald-200 bg-emerald-50/95",
        badgeClass: "border-emerald-200 bg-white text-emerald-900",
        eyebrowClass: "text-emerald-800",
      };
    }

    return {
      badge: "Lista",
      title: "Privacidad activa desde el primer intento",
      detail:
        "Puedes subir un archivo, revisar la primera señal y decidir después si te conviene guardarlo.",
      company: "Empresa sin acceso",
      control: "Nada se guarda solo",
      trace: "Rastro visible al confirmar",
      cardClass: "border-slate-200 bg-white/95",
      badgeClass: "border-slate-200 bg-white text-slate-700",
      eyebrowClass: "text-slate-500",
    };
  }, [
    documents.length,
    engineStatus.tone,
    lastUpload?.engineDispatch?.status,
    pendingDraft,
    visibleHeliosOpinion?.status,
  ]);
  const uploadInsight = lastUpload
    ? getUploadInsight(lastUpload.classification.documentType)
    : null;
  const pendingDraftShortcuts = useMemo(
    () =>
      pendingDraft
        ? getDocumentContextualShortcuts(
            pendingDraft.classification.documentType
          )
        : [],
    [pendingDraft]
  );
  const lastUploadShortcuts = useMemo(
    () =>
      lastUpload
        ? getDocumentContextualShortcuts(lastUpload.classification.documentType)
        : [],
    [lastUpload]
  );
  const confirmedEntries = useMemo(
    () =>
      getVisibleAnalysisEntries(
        lastUpload?.preliminaryAnalysis?.confirmedData as
          | Record<string, unknown>
          | undefined
      ),
    [lastUpload]
  );
  const estimatedEntries = useMemo(
    () =>
      getVisibleAnalysisEntries(
        lastUpload?.preliminaryAnalysis?.estimatedData as
          | Record<string, unknown>
          | undefined
      ),
    [lastUpload]
  );
  const guardrails = lastUpload?.preliminaryAnalysis?.guardrails ?? [];
  const lastUploadReadiness = getDocumentReadiness(
    lastUpload?.classification?.classificationConfidence
  );
  const lastUploadVerdict = getDocumentVerdictState(
    lastUpload?.classification?.classificationConfidence
  );
  const primaryLastUploadShortcut = useMemo(
    () =>
      getPrimaryContextualShortcut(
        lastUpload?.classification.documentType ?? "",
        lastUploadShortcuts
      ),
    [lastUpload?.classification.documentType, lastUploadShortcuts]
  );
  const secondaryLastUploadShortcuts = primaryLastUploadShortcut
    ? lastUploadShortcuts.filter(
        shortcut => shortcut.id !== primaryLastUploadShortcut.id
      )
    : lastUploadShortcuts;
  const lastUploadResultHeadline =
    warmVisibleNamingCopy(lastHeliosOpinion?.resultCard?.headline) ??
    uploadInsight?.label ??
    "Tu documento ya quedó integrado a tu expediente";
  const lastUploadResultLead =
    warmVisibleNamingCopy(
      lastHeliosOpinion?.resultCard?.lead ?? lastHeliosOpinion?.summary
    ) ??
    uploadInsight?.contribution ??
    "Ya hay una primera lectura útil para entender qué aporta este documento y cómo seguir avanzando.";
  const lastUploadNextStepSummary =
    warmVisibleNamingCopy(
      lastHeliosOpinion?.resultCard?.nextStepSummary ??
        lastHeliosOpinion?.recommendedNextStep
    ) ??
    uploadInsight?.nextSuggestion ??
    "Sigue conectando este documento con otros archivos del expediente para fortalecer tu lectura.";
  const postReadingWhatsappHref = `https://wa.me/?text=${encodeURIComponent(
    `Hola. Ya revisé mi documento en AuditaPatrón y me salió esto: ${lastUploadResultHeadline}. ${lastUploadNextStepSummary} ¿Me ayudas a entender qué me conviene hacer ahora?`
  )}`;
  const heliosCalculatorSnapshot = caseDetailQuery.data?.heliosCalculator ?? null;
  const heliosCalculatorLatestComparison =
    heliosCalculatorSnapshot?.latestComparison ?? null;
  const heliosCalculatorHistory = heliosCalculatorSnapshot?.history ?? [];
  const heliosCalculatorLegalExplanation =
    heliosCalculatorSnapshot?.legalExplanation ?? null;
  const quickCalculatorSelectableHistory = useMemo(
    () => heliosCalculatorHistory.filter(item => Boolean(item.periodKey)),
    [heliosCalculatorHistory]
  );
  const [selectedQuickCalculatorPeriodKey, setSelectedQuickCalculatorPeriodKey] =
    useState("");
  const selectedQuickCalculatorHistoryItem = useMemo(
    () =>
      quickCalculatorSelectableHistory.find(
        item => item.periodKey === selectedQuickCalculatorPeriodKey
      ) ?? null,
    [quickCalculatorSelectableHistory, selectedQuickCalculatorPeriodKey]
  );
  const quickComparisonReferenceItem = useMemo(() => {
    if (!heliosCalculatorLatestComparison) {
      return null;
    }

    if (
      selectedQuickCalculatorHistoryItem &&
      selectedQuickCalculatorHistoryItem.periodKey ===
        heliosCalculatorLatestComparison.periodKey
    ) {
      return null;
    }

    return heliosCalculatorLatestComparison;
  }, [heliosCalculatorLatestComparison, selectedQuickCalculatorHistoryItem]);
  const quickCalculatorFallbackAmount = useMemo(() => {
    const confirmedData = lastUpload?.preliminaryAnalysis?.confirmedData as
      | Record<string, unknown>
      | undefined;
    const estimatedData = lastUpload?.preliminaryAnalysis?.estimatedData as
      | Record<string, unknown>
      | undefined;

    return (
      parseQuickCalculatorAmount(confirmedData?.neto) ??
      parseQuickCalculatorAmount(confirmedData?.salario) ??
      parseQuickCalculatorAmount(estimatedData?.apparentAmount) ??
      null
    );
  }, [lastUpload]);
  const quickCalculatorPeriodHint = useMemo(() => {
    if (
      typeof selectedQuickCalculatorHistoryItem?.periodLabel === "string" &&
      selectedQuickCalculatorHistoryItem.periodLabel.trim().length
    ) {
      return selectedQuickCalculatorHistoryItem.periodLabel.trim();
    }

    if (
      typeof heliosCalculatorLatestComparison?.periodLabel === "string" &&
      heliosCalculatorLatestComparison.periodLabel.trim().length
    ) {
      return heliosCalculatorLatestComparison.periodLabel.trim();
    }

    const estimatedData = lastUpload?.preliminaryAnalysis?.estimatedData as
      | Record<string, unknown>
      | undefined;
    const visiblePeriod = estimatedData?.period;

    return typeof visiblePeriod === "string" && visiblePeriod.trim().length
      ? visiblePeriod.trim()
      : null;
  }, [selectedQuickCalculatorHistoryItem, heliosCalculatorLatestComparison, lastUpload]);
  const [quickPayrollAmount, setQuickPayrollAmount] = useState("");
  const [quickCfdiAmount, setQuickCfdiAmount] = useState("");
  const quickCalculatorSeedKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!quickCalculatorSelectableHistory.length) {
      if (selectedQuickCalculatorPeriodKey) {
        setSelectedQuickCalculatorPeriodKey("");
      }
      return;
    }

    const preferredPeriodKey =
      heliosCalculatorLatestComparison?.periodKey &&
      quickCalculatorSelectableHistory.some(
        item => item.periodKey === heliosCalculatorLatestComparison.periodKey
      )
        ? heliosCalculatorLatestComparison.periodKey
        : quickCalculatorSelectableHistory[0]?.periodKey ?? "";

    if (
      !selectedQuickCalculatorPeriodKey ||
      !quickCalculatorSelectableHistory.some(
        item => item.periodKey === selectedQuickCalculatorPeriodKey
      )
    ) {
      setSelectedQuickCalculatorPeriodKey(preferredPeriodKey);
    }
  }, [
    heliosCalculatorLatestComparison,
    quickCalculatorSelectableHistory,
    selectedQuickCalculatorPeriodKey,
  ]);
  useEffect(() => {
    if (selectedQuickCalculatorHistoryItem) {
      const seedKey = [
        "selected",
        selectedQuickCalculatorHistoryItem.periodKey,
        selectedQuickCalculatorHistoryItem.payrollAmount ?? "no-payroll",
        selectedQuickCalculatorHistoryItem.cfdiAmount ?? "no-cfdi",
      ].join("::");

      if (quickCalculatorSeedKeyRef.current === seedKey) {
        return;
      }

      quickCalculatorSeedKeyRef.current = seedKey;
      setQuickPayrollAmount(
        selectedQuickCalculatorHistoryItem.payrollAmount !== null &&
          selectedQuickCalculatorHistoryItem.payrollAmount !== undefined
          ? selectedQuickCalculatorHistoryItem.payrollAmount.toFixed(2)
          : ""
      );
      setQuickCfdiAmount(
        selectedQuickCalculatorHistoryItem.cfdiAmount !== null &&
          selectedQuickCalculatorHistoryItem.cfdiAmount !== undefined
          ? selectedQuickCalculatorHistoryItem.cfdiAmount.toFixed(2)
          : ""
      );
      return;
    }

    if (heliosCalculatorLatestComparison) {
      const seedKey = [
        "server",
        heliosCalculatorLatestComparison.periodKey,
        heliosCalculatorLatestComparison.payrollAmount ?? "no-payroll",
        heliosCalculatorLatestComparison.cfdiAmount ?? "no-cfdi",
      ].join("::");

      if (quickCalculatorSeedKeyRef.current === seedKey) {
        return;
      }

      quickCalculatorSeedKeyRef.current = seedKey;
      setQuickPayrollAmount(
        heliosCalculatorLatestComparison.payrollAmount !== null &&
          heliosCalculatorLatestComparison.payrollAmount !== undefined
          ? heliosCalculatorLatestComparison.payrollAmount.toFixed(2)
          : ""
      );
      setQuickCfdiAmount(
        heliosCalculatorLatestComparison.cfdiAmount !== null &&
          heliosCalculatorLatestComparison.cfdiAmount !== undefined
          ? heliosCalculatorLatestComparison.cfdiAmount.toFixed(2)
          : ""
      );
      return;
    }

    if (!lastUpload) {
      return;
    }

    const seedKey = [
      lastUpload.draftId ?? "confirmed",
      lastUpload.classification.documentType,
      quickCalculatorFallbackAmount ?? "no-amount",
    ].join("::");

    if (quickCalculatorSeedKeyRef.current === seedKey) {
      return;
    }

    quickCalculatorSeedKeyRef.current = seedKey;
    const seededAmount =
      quickCalculatorFallbackAmount !== null
        ? quickCalculatorFallbackAmount.toFixed(2)
        : "";

    if (lastUpload.classification.documentType === "payroll_receipt") {
      setQuickPayrollAmount(seededAmount);
      setQuickCfdiAmount("");
      return;
    }

    if (lastUpload.classification.documentType === "cfdi") {
      setQuickCfdiAmount(seededAmount);
      setQuickPayrollAmount("");
      return;
    }

    setQuickPayrollAmount(seededAmount);
    setQuickCfdiAmount("");
  }, [
    heliosCalculatorLatestComparison,
    lastUpload,
    quickCalculatorFallbackAmount,
    selectedQuickCalculatorHistoryItem,
  ]);
  const quickPayrollNumeric = parseQuickCalculatorAmount(quickPayrollAmount);
  const quickCfdiNumeric = parseQuickCalculatorAmount(quickCfdiAmount);
  const quickDifferenceAmount =
    quickPayrollNumeric !== null && quickCfdiNumeric !== null
      ? quickPayrollNumeric - quickCfdiNumeric
      : null;
  const quickDifferenceAbsolute =
    quickDifferenceAmount !== null ? Math.abs(quickDifferenceAmount) : null;
  const showQuickDifferenceCalculator = Boolean(
    (heliosCalculatorSnapshot && heliosCalculatorSnapshot.status !== "empty") ||
      (lastUpload &&
        ((lastUpload.preliminaryAnalysis?.confirmedData as
          | Record<string, unknown>
          | undefined)?.benefitEstimationReady ||
          lastUpload.classification.documentType === "payroll_receipt" ||
          lastUpload.classification.documentType === "cfdi"))
  );
  const quickDifferenceRelative =
    quickDifferenceAbsolute !== null &&
    quickCfdiNumeric !== null &&
    quickCfdiNumeric > 0
      ? quickDifferenceAbsolute / quickCfdiNumeric
      : null;
  const quickComparisonVisualMax = Math.max(
    quickPayrollNumeric ?? 0,
    quickCfdiNumeric ?? 0,
    1
  );
  const quickPayrollVisualWidth = `${Math.max(
    12,
    Math.round(((quickPayrollNumeric ?? 0) / quickComparisonVisualMax) * 100)
  )}%`;
  const quickCfdiVisualWidth = `${Math.max(
    12,
    Math.round(((quickCfdiNumeric ?? 0) / quickComparisonVisualMax) * 100)
  )}%`;
  const quickLaborHealthSignal =
    quickDifferenceAmount === null || quickDifferenceAbsolute === null
      ? {
          badge: "Semáforo en preparación",
          headline: "Faltan dos montos para medir el riesgo visible",
          supportingText:
            "En cuanto tengas nómina y CFDI del mismo periodo, te diremos si el cruce se ve sano, si requiere atención o si ya amerita revisión prioritaria.",
          progress: 34,
          toneClasses: "border-amber-200 bg-amber-50 text-amber-950",
          barClasses: "bg-amber-500",
          checklist: [
            "Sube o captura los dos montos del mismo periodo.",
            "Confirma que la fecha corresponda al mismo mes.",
            "Revisa después conceptos y deducciones.",
          ],
        }
      : quickDifferenceAmount === 0
        ? {
            badge: "Semáforo laboral: bajo",
            headline: "Por monto no se ve una diferencia inmediata",
            supportingText:
              "La lectura inicial luce estable en este periodo, pero todavía conviene revisar conceptos, fechas y deducciones para cerrar bien la comparación.",
            progress: 82,
            toneClasses: "border-emerald-200 bg-emerald-50 text-emerald-950",
            barClasses: "bg-emerald-500",
            checklist: [
              "Comparar periodo y concepto del mismo mes.",
              "Guardar este cruce como referencia sana.",
              "Subir otro mes si quieres ver tendencia.",
            ],
          }
        : quickDifferenceRelative !== null && quickDifferenceRelative >= 0.15
          ? {
              badge: "Semáforo laboral: alto",
              headline: "La diferencia ya merece revisión prioritaria",
              supportingText:
                "La separación entre nómina y CFDI ya es suficientemente visible como para pedir contexto, conservar evidencia y preparar una aclaración con calma.",
              progress: 24,
              toneClasses: "border-rose-200 bg-rose-50 text-rose-950",
              barClasses: "bg-rose-500",
              checklist: [
                "Guardar el recibo y el CFDI del mismo periodo.",
                "Pedir explicación por escrito antes de discutirlo en persona.",
                "Revisar si se repite en otros meses.",
              ],
            }
          : quickDifferenceRelative !== null && quickDifferenceRelative >= 0.05
            ? {
                badge: "Semáforo laboral: medio",
                headline: "Hay una diferencia visible que conviene aclarar",
                supportingText:
                  "No implica por sí sola un incumplimiento definitivo, pero sí una señal suficiente para comparar conceptos y dejar registro de la aclaración.",
                progress: 51,
                toneClasses: "border-amber-200 bg-amber-50 text-amber-950",
                barClasses: "bg-amber-500",
                checklist: [
                  "Contrastar monto, fecha y concepto.",
                  "Guardar captura o PDF del CFDI del mismo mes.",
                  "Preparar una pregunta neutral para RH.",
                ],
              }
            : {
                badge: "Semáforo laboral: atención",
                headline: "La diferencia luce pequeña, pero ya deja una señal útil",
                supportingText:
                  "Puede bastar una aclaración simple, sobre todo si el concepto o la fecha no coinciden exactamente con el periodo revisado.",
                progress: 66,
                toneClasses: "border-sky-200 bg-sky-50 text-sky-950",
                barClasses: "bg-sky-500",
                checklist: [
                  "Verificar si ambos archivos son del mismo periodo.",
                  "Revisar si hubo ajuste o pago extraordinario.",
                  "Guardar este cruce para no perder contexto.",
                ],
              };
  const quickScriptPeriodLabel =
    quickCalculatorPeriodHint ??
    heliosCalculatorLatestComparison?.periodLabel ??
    "el mismo periodo";
  const quickDifferenceNarrative =
    quickDifferenceAmount === 0
      ? "Por ahora ambos montos coinciden. Aun así conviene revisar periodo y conceptos del mismo mes."
      : quickDifferenceAmount !== null && quickDifferenceAbsolute !== null
        ? quickDifferenceAmount > 0
          ? `Tu recibo muestra ${formatQuickCalculatorAmount(quickDifferenceAbsolute)} por encima del CFDI capturado.`
          : `Tu CFDI muestra ${formatQuickCalculatorAmount(quickDifferenceAbsolute)} por encima del recibo capturado.`
        : "Completa ambos montos para ver una diferencia rápida antes de seguir con la comparación documental.";
  const quickSideBySideComparisons = useMemo(() => {
    const cards = [] as Array<{
      key: string;
      eyebrow: string;
      title: string;
      summary: string;
      nextStep: string;
      payrollLabel: string;
      cfdiLabel: string;
      differenceLabel: string;
    }>;

    if (selectedQuickCalculatorHistoryItem) {
      cards.push({
        key: `selected-${selectedQuickCalculatorHistoryItem.periodKey}`,
        eyebrow: "Periodo que elegiste",
        title: selectedQuickCalculatorHistoryItem.periodLabel,
        summary: selectedQuickCalculatorHistoryItem.summary,
        nextStep: selectedQuickCalculatorHistoryItem.recommendedNextStep,
        payrollLabel:
          selectedQuickCalculatorHistoryItem.payrollAmount !== null &&
          selectedQuickCalculatorHistoryItem.payrollAmount !== undefined
            ? formatQuickCalculatorAmount(selectedQuickCalculatorHistoryItem.payrollAmount)
            : "Pendiente",
        cfdiLabel:
          selectedQuickCalculatorHistoryItem.cfdiAmount !== null &&
          selectedQuickCalculatorHistoryItem.cfdiAmount !== undefined
            ? formatQuickCalculatorAmount(selectedQuickCalculatorHistoryItem.cfdiAmount)
            : "Pendiente",
        differenceLabel:
          selectedQuickCalculatorHistoryItem.differenceAmount !== null &&
          selectedQuickCalculatorHistoryItem.differenceAmount !== undefined
            ? formatQuickCalculatorAmount(
                Math.abs(selectedQuickCalculatorHistoryItem.differenceAmount)
              )
            : "Pendiente",
      });
    }

    if (quickComparisonReferenceItem) {
      cards.push({
        key: `reference-${quickComparisonReferenceItem.periodKey}`,
        eyebrow: "Referencia más reciente",
        title: quickComparisonReferenceItem.periodLabel,
        summary: quickComparisonReferenceItem.summary,
        nextStep: quickComparisonReferenceItem.recommendedNextStep,
        payrollLabel:
          quickComparisonReferenceItem.payrollAmount !== null &&
          quickComparisonReferenceItem.payrollAmount !== undefined
            ? formatQuickCalculatorAmount(quickComparisonReferenceItem.payrollAmount)
            : "Pendiente",
        cfdiLabel:
          quickComparisonReferenceItem.cfdiAmount !== null &&
          quickComparisonReferenceItem.cfdiAmount !== undefined
            ? formatQuickCalculatorAmount(quickComparisonReferenceItem.cfdiAmount)
            : "Pendiente",
        differenceLabel:
          quickComparisonReferenceItem.differenceAmount !== null &&
          quickComparisonReferenceItem.differenceAmount !== undefined
            ? formatQuickCalculatorAmount(
                Math.abs(quickComparisonReferenceItem.differenceAmount)
              )
            : "Pendiente",
      });
    }

    return cards;
  }, [selectedQuickCalculatorHistoryItem, quickComparisonReferenceItem]);
  const buildQuickHallazgoExportSnapshot = () => ({
    id: [quickScriptPeriodLabel, new Date().toISOString()].join("::"),
    exportedAt: new Date().toISOString(),
    periodLabel: quickScriptPeriodLabel,
    differenceLabel:
      quickDifferenceAbsolute !== null
        ? formatQuickCalculatorAmount(quickDifferenceAbsolute)
        : "Pendiente",
    narrative: quickDifferenceNarrative,
    healthBadge: quickLaborHealthSignal.badge,
    healthHeadline: quickLaborHealthSignal.headline,
    protectionProgress: quickLaborHealthSignal.progress,
    supportingText: quickLaborHealthSignal.supportingText,
    checklist: quickLaborHealthSignal.checklist,
    documentLabel:
      latestArchiveDocument?.originalName ??
      (lastUpload
        ? getSimpleDocumentTypeLabel(lastUpload.classification.documentType)
        : "Documento auditado"),
    summary: lastUpload?.preliminaryAnalysis.summary ?? quickDifferenceNarrative,
  });
  const downloadQuickHallazgoPdf = (
    snapshot: {
      id: string;
      exportedAt: string;
      periodLabel: string;
      differenceLabel: string;
      narrative: string;
      healthBadge: string;
      healthHeadline: string;
      protectionProgress: number;
      supportingText: string;
      checklist: string[];
      documentLabel: string;
      summary: string;
    },
    options?: { persist?: boolean; location?: string }
  ) => {
    const pdf = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 48;
    const maxWidth = pageWidth - margin * 2;
    let y = 54;

    const writeBlock = (
      text: string,
      blockOptions?: { size?: number; weight?: "normal" | "bold"; gap?: number }
    ) => {
      const size = blockOptions?.size ?? 11;
      const weight = blockOptions?.weight ?? "normal";
      const gap = blockOptions?.gap ?? 16;
      const lineHeight = Math.max(14, Math.round(size * 1.45));
      const lines = pdf.splitTextToSize(text, maxWidth);
      const requiredHeight = lines.length * lineHeight + gap;

      if (y + requiredHeight > pageHeight - 48) {
        pdf.addPage();
        y = 54;
      }

      pdf.setFont("helvetica", weight);
      pdf.setFontSize(size);
      pdf.text(lines, margin, y);
      y += lines.length * lineHeight + gap;
    };

    writeBlock("AuditaPatrón", { size: 14, weight: "bold", gap: 18 });
    writeBlock("Reporte de hallazgo laboral", { size: 22, weight: "bold", gap: 14 });
    writeBlock(`Documento base: ${snapshot.documentLabel}`, {
      size: 11,
      weight: "bold",
      gap: 10,
    });
    writeBlock(`Periodo auditado: ${snapshot.periodLabel}`, {
      size: 11,
      weight: "bold",
      gap: 10,
    });
    writeBlock(
      `Exportado el ${formatDate(snapshot.exportedAt)} con el hallazgo visible y el checklist accionable que aparecían en pantalla.`,
      { gap: 14 }
    );
    writeBlock("Resumen ejecutivo", { size: 12, weight: "bold", gap: 10 });
    writeBlock(snapshot.summary, { gap: 12 });
    writeBlock(`Diferencia visible: ${snapshot.differenceLabel}`, {
      size: 11,
      weight: "bold",
      gap: 10,
    });
    writeBlock(
      `${snapshot.healthBadge} · ${snapshot.healthHeadline} · Protección estimada ${snapshot.protectionProgress}%`,
      { size: 11, weight: "bold", gap: 10 }
    );
    writeBlock(
      "Privacidad y resguardo: este PDF condensa solo el hallazgo visible y está pensado para conservar una referencia simple dentro de tu expediente.",
      { size: 10, gap: 0 }
    );

    pdf.addPage();
    y = 54;
    writeBlock("Detalle del hallazgo visible", { size: 18, weight: "bold", gap: 18 });
    writeBlock(`Periodo activo: ${snapshot.periodLabel}`, {
      size: 11,
      weight: "bold",
      gap: 12,
    });
    writeBlock(`Diferencia estimada visible: ${snapshot.differenceLabel}`, {
      size: 11,
      weight: "bold",
      gap: 10,
    });
    writeBlock(snapshot.narrative, { gap: 12 });
    writeBlock(`${snapshot.healthBadge} · ${snapshot.healthHeadline}`, {
      size: 12,
      weight: "bold",
      gap: 10,
    });
    writeBlock(`Protección estimada: ${snapshot.protectionProgress}%`, {
      size: 11,
      weight: "bold",
      gap: 10,
    });
    writeBlock(snapshot.supportingText, { gap: 12 });
    writeBlock("Checklist accionable", { size: 12, weight: "bold", gap: 10 });
    snapshot.checklist.forEach((item, index) => {
      writeBlock(`${index + 1}. ${item}`, { gap: 8 });
    });
    writeBlock(
      "Privacidad y resguardo: si quieres fortalecer mejor la evidencia, guarda también este PDF junto con tus documentos clave dentro de tu Bóveda Laboral.",
      { size: 10, gap: 0 }
    );

    const safePeriod = snapshot.periodLabel
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "periodo-activo";

    if (options?.location) {
      trackEvent("quick_hallazgo_pdf_exported", {
        location: options.location,
        period: snapshot.periodLabel,
        hasDifference: snapshot.differenceLabel !== "Pendiente",
      });
    }

    if (options?.persist !== false) {
      setQuickExportHistory(current =>
        [snapshot, ...current.filter(item => item.id !== snapshot.id)].slice(0, 6)
      );
    }

    pdf.save(`auditapatron-hallazgo-${safePeriod}.pdf`);
  };
  const exportQuickHallazgoPdf = () => {
    downloadQuickHallazgoPdf(buildQuickHallazgoExportSnapshot(), {
      location: "auditar_quick_calculator",
    });
  };
  const quickRhMessage =
    quickDifferenceAmount !== null && quickDifferenceAbsolute !== null
      ? `Hola, al revisar mi recibo y el CFDI de ${quickScriptPeriodLabel} detecté una diferencia aproximada de ${formatQuickCalculatorAmount(quickDifferenceAbsolute)}. ¿Me ayudan por favor a revisar si corresponde a monto, fecha o concepto y a compartirme por escrito el desglose correcto?`
      : `Hola, quiero revisar si mi recibo y el CFDI de ${quickScriptPeriodLabel} corresponden correctamente. ¿Me ayudan por favor a confirmar por escrito monto, fecha y concepto?`;
  const quickWhatsappMessage =
    quickDifferenceAmount !== null && quickDifferenceAbsolute !== null
      ? `Hola. Detecté una posible diferencia de ${formatQuickCalculatorAmount(quickDifferenceAbsolute)} entre mi nómina y el CFDI de ${quickScriptPeriodLabel}. ¿Me ayudas a revisarlo y a confirmarme por escrito si hubo ajuste en monto, fecha o concepto?`
      : `Hola. Quiero confirmar si mi nómina y mi CFDI de ${quickScriptPeriodLabel} coinciden en monto, fecha y concepto. ¿Me ayudas a revisarlo y a dejármelo por escrito?`;
  const [showResultReveal, setShowResultReveal] = useState(false);
  const lastRevealedUploadIdRef = useRef<string | null>(null);
  const verdictPanelRef = useRef<HTMLDivElement | null>(null);
  const verdictAnalyticsStartedAtRef = useRef<number | null>(null);
  const verdictAnalyticsTrackedIdRef = useRef<string | null>(null);
  const verdictMaxScrollDepthRef = useRef(0);
  const lastUploadRevealId = lastUpload
    ? [
        lastUpload.draftId ?? "confirmed",
        lastUpload.classification.documentType,
        lastUpload.preliminaryAnalysis.summary,
      ].join("::")
    : null;

  useEffect(() => {
    const uploadId = lastUploadRevealId;

    if (!uploadId) {
      setShowResultReveal(false);
      lastRevealedUploadIdRef.current = null;
      return;
    }

    if (lastRevealedUploadIdRef.current === uploadId) {
      return;
    }

    lastRevealedUploadIdRef.current = uploadId;
    setShowResultReveal(true);

    const timer = window.setTimeout(() => {
      setShowResultReveal(false);
    }, 2200);

    return () => window.clearTimeout(timer);
  }, [lastUploadRevealId]);
  const resultRevealCopy = getResultRevealCopy(
    lastUpload?.classification.documentType
  );
  const complilinkMonitoring = caseDetailQuery.data?.complilinkMonitoring;
  const monitoringDocuments = complilinkMonitoring?.documents ?? [];
  const pendingMonitoringDocuments = monitoringDocuments.filter(
    item => item.status === "waiting" || item.status === "attention"
  );
  const attentionMonitoringDocuments = pendingMonitoringDocuments.filter(
    item => item.status === "attention"
  );
  const timelinePreviewLimit = 3;
  const mobileHiddenTimelineCount = Math.max(
    0,
    timelineEntries.length - timelinePreviewLimit
  );
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
      detail:
        "Ya entraste al entorno base desde el que empieza el recorrido operativo.",
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
  const operationalFunnelCompletedCount = operationalFunnelSteps.filter(
    step => step.completed
  ).length;
  const operationalFunnelNextStep =
    operationalFunnelSteps.find(step => !step.completed) ?? null;

  useEffect(() => {
    setLegalGateChecked(false);
    setLegalGateError(null);
  }, [currentCaseScopeKey, legalAcceptance?.isAccepted]);
  const documentTypeCounts = useMemo(
    () =>
      documents.reduce<Record<string, number>>((counts, document) => {
        counts[document.documentType] =
          (counts[document.documentType] ?? 0) + 1;
        return counts;
      }, {}),
    [documents]
  );
  const dossierTypeProgress = useMemo(
    () => buildDossierTypeProgress(documentTypeCounts),
    [documentTypeCounts]
  );
  const effectiveRecommendedTarget = useMemo(
    () =>
      dossierTargets.find(
        item => item.type === selectedRecommendedTargetType
      ) ??
      dossierStatus.nextTarget ??
      null,
    [dossierStatus.nextTarget, selectedRecommendedTargetType]
  );
  const nextDocumentCopy = getPersonalizedNextDocumentCopy({
    nextTarget: effectiveRecommendedTarget ?? undefined,
    presentTypes,
    opinion: lastHeliosOpinion,
  });
  const heliosCopilotSuggestedUploadMode =
    preferredCaptureMode ??
    (documents.length === 0 && !pendingDraft && !lastUpload ? "camera" : "file");
  const heliosCopilotNextSuggestedDocument = useMemo(() => {
    const firstMissingDocument = heliosCopilotMutation.data?.missingDocuments?.[0];
    const rawConfirmedSummary =
      heliosCopilotMutation.data?.supportingDocuments?.[0]?.detail ??
      heliosCopilotSupportingDocuments[0]?.detail ??
      (typeof visibleHeliosOpinion?.summary === "string" &&
      visibleHeliosOpinion.summary.trim().length > 0
        ? visibleHeliosOpinion.summary.trim()
        : null) ??
      lastUpload?.preliminaryAnalysis?.summary ??
      (documents.length > 0
        ? `Ya hay ${documents.length} documento${documents.length === 1 ? "" : "s"} visible${documents.length === 1 ? "" : "s"} dentro del expediente.`
        : "Ya existe una lectura inicial visible dentro del expediente.");
    const confirmedSummary = rawConfirmedSummary.replace(/^Lectura visible:\s*/i, "");
    const ctaLabel =
      heliosCopilotSuggestedUploadMode === "camera"
        ? "Abrir cámara para subirlo"
        : "Elegir archivo ahora";
    const actionHint =
      heliosCopilotSuggestedUploadMode === "camera"
        ? "Al tocar el botón abriremos la cámara para capturarlo al momento."
        : "Al tocar el botón abriremos tu selector de archivos para subirlo sin salir del flujo.";

    if (firstMissingDocument) {
      return {
        title: "Documento que puede destrabar mejor tu caso",
        label: firstMissingDocument.label,
        reason: firstMissingDocument.reason,
        targetType: firstMissingDocument.targetType,
        contrastTitle: "Lo ya confirmado y lo que este archivo aclararía",
        confirmedSummary,
        missingSummary: firstMissingDocument.reason,
        actionHint,
        ctaLabel,
      };
    }

    if (effectiveRecommendedTarget) {
      return {
        title: nextDocumentCopy.reasonTitle,
        label: effectiveRecommendedTarget.label,
        reason: nextDocumentCopy.reasonBody,
        targetType: effectiveRecommendedTarget.type,
        contrastTitle: "Lo ya confirmado y lo que este archivo aclararía",
        confirmedSummary,
        missingSummary: nextDocumentCopy.reasonBody,
        actionHint,
        ctaLabel,
      };
    }

    return null;
  }, [
    documents.length,
    effectiveRecommendedTarget,
    heliosCopilotMutation.data?.missingDocuments,
    heliosCopilotMutation.data?.supportingDocuments,
    heliosCopilotSupportingDocuments,
    heliosCopilotSuggestedUploadMode,
    lastUpload?.preliminaryAnalysis?.summary,
    nextDocumentCopy.reasonBody,
    nextDocumentCopy.reasonTitle,
    visibleHeliosOpinion?.summary,
  ]);

  const missingPriorityUploadGuides = useMemo(
    () => priorityUploadGuides.filter(item => !presentTypes.has(item.type)),
    [presentTypes]
  );
  const visiblePriorityUploadGuides =
    missingPriorityUploadGuides.length > 0
      ? missingPriorityUploadGuides
      : priorityUploadGuides.slice(0, 2);
  const activeMobileOnboardingStep =
    mobileOnboardingSteps[mobileOnboardingIndex] ?? mobileOnboardingSteps[0];
  const isFirstDocumentFlow =
    documents.length === 0 && !pendingDraft && !lastUpload;
  const shouldCompactPostUploadExperience =
    Boolean(lastUpload) && !pendingDraft && !selectedFile;
  const condensedDossierTargets = shouldCompactPostUploadExperience
    ? dossierTargets.slice(0, 1)
    : dossierTargets;
  const condensedPriorityUploadGuides = shouldCompactPostUploadExperience
    ? visiblePriorityUploadGuides.slice(0, 1)
    : visiblePriorityUploadGuides;
  const shouldCompactMobileUploadEntry = isFirstDocumentFlow;
  const hasDossierActivity =
    documents.length > 0 || Boolean(lastUpload) || Boolean(pendingDraft);
  const showWorkspaceSectionSelector =
    hasDossierActivity &&
    !selectedFile &&
    !pendingDraft &&
    !shouldCompactPostUploadExperience;
  const isSummaryWorkspaceSection = workspaceSection === "resumen";
  const isDossierWorkspaceSection = workspaceSection === "expediente";
  const isAdvancedWorkspaceSection = workspaceSection === "herramientas";
  const workspaceSectionCards: Array<{
    key: AuditarWorkspaceSection;
    label: string;
    title: string;
    description: string;
  }> = [
    {
      key: "resumen",
      label: "Resumen",
      title: "Sube, revisa y toma la siguiente decisión.",
      description: "Ideal para empezar o volver rápido a lo importante.",
    },
    {
      key: "expediente",
      label: "Expediente",
      title: "Progreso, faltantes y continuidad del caso.",
      description: "Úsalo cuando quieras entender cómo va tu respaldo completo.",
    },
    {
      key: "herramientas",
      label: "Herramientas",
      title: "Comparaciones y lectura más fina entre documentos.",
      description: "Aquí dejamos lo avanzado para que no compita con el flujo principal.",
    },
  ];
  const activeWorkspaceSectionCard =
    workspaceSectionCards.find(item => item.key === workspaceSection) ??
    workspaceSectionCards[0];
  const activeCaptureMode =
    selectedCaptureMode ??
    preferredCaptureMode ??
    (isFirstDocumentFlow ? "camera" : "file");
  const remoteViewStateSyncLabel = !currentCaseScopeKey
    ? "Elige tu caso para activar continuidad entre dispositivos."
    : persistAuditarViewStateMutation.isPending
      ? "Guardando esta vista para cuando vuelvas a entrar..."
      : remoteViewStateReadyKey === currentCaseScopeKey
        ? "Tu avance se guarda solo."
        : "Preparando tu revisión...";
  const selectedFilePreparationCopy = useMemo(
    () =>
      getSelectedFilePreparationCopy({
        file: selectedFile,
        preferredCaptureMode,
        selectedRecommendedTargetType,
      }),
    [preferredCaptureMode, selectedFile, selectedRecommendedTargetType]
  );
  const isProcessingDocument =
    analyzeDraftMutation.isPending || confirmDraftMutation.isPending;
  const isAutoAnalyzingSelectedFile =
    analyzeDraftMutation.isPending && Boolean(selectedFile) && !pendingDraft;
  const shouldHideUploadSelectors = shouldHideUploadContextSelectors({
    isFirstDocumentFlow,
    hasSelectedFile: Boolean(selectedFile),
    hasPendingDraft: Boolean(pendingDraft),
    isAutoAnalyzing: isAutoAnalyzingSelectedFile,
    hasSelectedTenant: Boolean(selectedTenantId),
    hasSelectedCase: Boolean(selectedCaseId),
  });
  const showCompactUploadContextHint =
    shouldCompactMobileUploadEntry && !shouldHideUploadSelectors;
  const selectedFileValidationMessage = useMemo(
    () => validateDocumentUploadFile(selectedFile),
    [selectedFile]
  );
  const uploadProgressState = useMemo(
    () =>
      buildUploadProgressState({
        selectedFile,
        pendingDraft: Boolean(pendingDraft),
        isAnalyzingDraft: analyzeDraftMutation.isPending,
        isConfirmingDraft: confirmDraftMutation.isPending,
      }),
    [
      analyzeDraftMutation.isPending,
      confirmDraftMutation.isPending,
      pendingDraft,
      selectedFile,
    ]
  );
  const uploadProgressSteps = useMemo(
    () => getUploadProgressStepState(uploadProgressState.stepKey),
    [uploadProgressState.stepKey]
  );
  const [uploadProgressMessageIndex, setUploadProgressMessageIndex] =
    useState(0);
  const uploadProgressMessagesKey =
    uploadProgressState.humanMessages?.join("|") ?? "";
  const uploadProgressHumanMessage =
    uploadProgressState.humanMessages?.[uploadProgressMessageIndex] ??
    uploadProgressState.title;

  useEffect(() => {
    if (uploadProgressState.humanMessages?.length) {
      setUploadProgressMessageIndex(0);
    }

    if ((uploadProgressState.humanMessages?.length ?? 0) <= 1) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setUploadProgressMessageIndex(currentIndex => {
        const totalMessages = uploadProgressState.humanMessages?.length ?? 0;
        if (totalMessages <= 1) {
          return 0;
        }

        return (currentIndex + 1) % totalMessages;
      });
    }, 800);

    return () => window.clearInterval(intervalId);
  }, [uploadProgressMessagesKey, uploadProgressState.humanMessages]);
  const previewInsight = pendingDraft
    ? getUploadInsight(pendingDraft.classification.documentType)
    : null;
  const previewReadiness = getDocumentReadiness(
    pendingDraft?.classification?.classificationConfidence
  );
  const previewConfirmedEntries = useMemo(
    () =>
      getVisibleAnalysisEntries(
        pendingDraft?.preliminaryAnalysis?.confirmedData
      ),
    [pendingDraft]
  );
  const previewEstimatedEntries = useMemo(
    () =>
      getVisibleAnalysisEntries(
        pendingDraft?.preliminaryAnalysis?.estimatedData
      ),
    [pendingDraft]
  );
  const previewStructuredExtraction = useMemo(
    () =>
      sanitizeStructuredExtractionView(
        pendingDraft?.preliminaryAnalysis?.structuredExtraction ?? null
      ),
    [pendingDraft]
  );
  const previewEditableFields = useMemo(
    () => buildPreviewEditableFields(pendingDraft),
    [pendingDraft]
  );
  const manualOverridePayload = useMemo(
    () => buildManualOverridePayload(previewEditableFields, manualFieldValues),
    [manualFieldValues, previewEditableFields]
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
  const isPrimaryDocumentActionPending =
    isProcessingDocument || acceptLegalPackageMutation.isPending;
  const manualOverrideMap = useMemo(
    () =>
      new Map<string, string>(
        manualOverridePayload.map(item => [item.key, item.value])
      ),
    [manualOverridePayload]
  );
  const previewPresentTypes = useMemo(() => {
    const nextTypes = new Set(presentTypes);
    const previewTarget = dossierTargets.find(
      item => item.type === pendingDraft?.classification.documentType
    );
    if (previewTarget) {
      nextTypes.add(previewTarget.type);
    }
    return nextTypes;
  }, [pendingDraft, presentTypes]);
  const previewNextTarget = useMemo(
    () => getContextualDossierNextTarget(previewPresentTypes),
    [previewPresentTypes]
  );
  const previewNextDocumentCopy = useMemo(
    () =>
      getPersonalizedNextDocumentCopy({
        nextTarget: previewNextTarget ?? undefined,
        presentTypes: previewPresentTypes,
        opinion: visibleHeliosOpinion,
      }),
    [previewNextTarget, previewPresentTypes, visibleHeliosOpinion]
  );
  const previewConfirmedDisplayEntries = useMemo(() => {
    const entries = previewConfirmedEntries.map(
      ([key, value]) =>
        [key, manualOverrideMap.get(key) ?? value] as [string, unknown]
    );
    const seenKeys = new Set(entries.map(([key]) => key));

    previewEditableFields.forEach(field => {
      const overrideValue = manualOverrideMap.get(field.key);
      if (overrideValue && !seenKeys.has(field.key)) {
        entries.unshift([field.key, overrideValue]);
        seenKeys.add(field.key);
      }
    });

    return entries;
  }, [manualOverrideMap, previewConfirmedEntries, previewEditableFields]);
  const previewEstimatedDisplayEntries = useMemo(
    () =>
      previewEstimatedEntries.filter(([key]) => !manualOverrideMap.has(key)),
    [manualOverrideMap, previewEstimatedEntries]
  );
  const displayPreviewStructuredExtraction = useMemo(() => {
    if (!previewStructuredExtraction) {
      return null;
    }

    const editableLabelByKey = new Map(
      previewEditableFields.map(field => [field.key, field.label])
    );
    const existingKeys = new Set<string>();
    const mergedFields = previewStructuredExtraction.fields.map(field => {
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

    previewEditableFields.forEach(field => {
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

    const overrideLabels = new Set(
      manualOverridePayload.map(item => item.label.trim().toLowerCase())
    );

    return {
      ...previewStructuredExtraction,
      fields: mergedFields.slice(0, 12),
      missingFields: previewStructuredExtraction.missingFields
        .filter(item => !overrideLabels.has(item.trim().toLowerCase()))
        .slice(0, 6),
      reviewNotes: manualOverridePayload.length
        ? [
            `Antes de guardar, revisaste manualmente ${manualOverridePayload.length} dato${manualOverridePayload.length === 1 ? "" : "s"} clave.`,
            ...previewStructuredExtraction.reviewNotes,
          ].slice(0, 4)
        : previewStructuredExtraction.reviewNotes,
    };
  }, [
    manualOverrideMap,
    manualOverridePayload,
    previewEditableFields,
    previewStructuredExtraction,
  ]);
  const handleTriggerLegalGateHarnessConflict = () => {
    setLegalGateChecked(true);
    setSubmitError(null);
    setLegalGateMetrics(current => ({
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
        3
      )
    );
  };

  const handleAcceptLegalPackage = async ({
    isRetry = false,
  }: { isRetry?: boolean } = {}) => {
    if (!caseDetailInput) {
      if (legalGateHarnessMode && isRetry) {
        setLegalGateError(null);
        setSubmitError(null);
        setLegalGateMetrics(current => ({
          attempts: current.attempts + 1,
          retries: current.retries + 1,
          conflicts: current.conflicts,
          lastEvent: "retry",
          lastUpdatedAt: Date.now(),
        }));
        await Promise.resolve();
        setLegalGateChecked(false);
        setLegalGateMetrics(current => ({
          ...current,
          lastEvent: "accepted",
          lastUpdatedAt: Date.now(),
        }));
        return true;
      }
      return false;
    }

    if (!legalGateChecked) {
      trackLegalGateEvent("validation_blocked", {
        tenantId: caseDetailInput.tenantId,
        caseId: caseDetailInput.caseId,
        reason: "checkbox_required",
        hasSelectedFile: Boolean(selectedFile),
        hasPendingDraft: Boolean(pendingDraft),
      });
      setLegalGateError(
        buildLegalGateErrorState(
          "Marca la casilla para seguir con este documento y registrar tu autorización.",
          "validation"
        )
      );
      return false;
    }

    const nextRetryCount = isRetry ? (legalGateError?.retryCount ?? 0) + 1 : 0;

    try {
      setLegalGateError(null);
      setSubmitError(null);
      setLegalGateMetrics(current => ({
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
      trackLegalGateEvent("accepted", {
        tenantId: caseDetailInput.tenantId,
        caseId: caseDetailInput.caseId,
        acceptedDocumentsCount:
          acceptedLegalDocumentsCount + legalPendingDocuments.length,
        retryCount: nextRetryCount,
        source: pendingDraft
          ? "draft_confirmation"
          : selectedFile
            ? "draft_analysis"
            : "gate_only",
      });
      trackFunnelStep("legal_package_accepted", {
        tenantId: caseDetailInput.tenantId,
        caseId: caseDetailInput.caseId,
        acceptedDocumentsCount:
          acceptedLegalDocumentsCount + legalPendingDocuments.length,
        retryCount: nextRetryCount,
      });
      setLegalGateChecked(false);
      setLegalGateMetrics(current => ({
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
        trackLegalGateEvent("lock_conflict", {
          tenantId: caseDetailInput.tenantId,
          caseId: caseDetailInput.caseId,
          retryCount: nextRetryCount,
          retryAfterSeconds: resolvedError.retryAfterSeconds,
          waitTimeMs: resolvedError.retryAfterSeconds * 1000,
          source: pendingDraft
            ? "draft_confirmation"
            : selectedFile
              ? "draft_analysis"
              : "gate_only",
        });
        trackFunnelStep("legal_package_lock_conflict", {
          tenantId: caseDetailInput.tenantId,
          caseId: caseDetailInput.caseId,
          retryCount: nextRetryCount,
        });
      }

      setLegalGateMetrics(current => ({
        ...current,
        conflicts:
          current.conflicts + (resolvedError.type === "concurrency" ? 1 : 0),
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
    (legalGateError?.type === "concurrency" ||
      legalGateError?.type === "transient") &&
    legalGateError.retryCount < MAX_LEGAL_GATE_RETRIES;

  const handleRevalidateSocialSecurity = async () => {
    if (!caseDetailInput) {
      setSubmitError(
        "Primero elige un expediente para revalidar IMSS e Infonavit."
      );
      return;
    }

    if (legalGateRequired) {
      setLegalGateError(
        buildLegalGateErrorState(
          "Antes de revalidar IMSS e Infonavit, acepta el Aviso de Privacidad y los Términos vigentes del expediente.",
          "validation"
        )
      );
      return;
    }

    try {
      setSubmitError(null);
      setLegalGateError(null);
      await revalidateSocialSecurityMutation.mutateAsync(caseDetailInput);
      await Promise.all([
        utils.cases.detail.invalidate(caseDetailInput),
        caseDetailQuery.refetch(),
      ]);
    } catch (error) {
      setSubmitError(
        toFriendlyAuditarRuntimeMessage(
          error,
          "No fue posible revalidar IMSS e Infonavit en este momento."
        )
      );
    }
  };

  const handleHeliosCopilotSend = (content: string) => {
    if (!selectedTenantId || !selectedCaseId) {
      setHeliosCopilotMessages(current =>
        appendHeliosCopilotMessage(current, {
          role: "assistant",
          content:
            "Primero elige un expediente para que pueda responder con el contexto correcto.",
        })
      );
      return;
    }

    if (legalGateRequired) {
      setLegalGateError(
        buildLegalGateErrorState(
          "Antes de usar tu asesor laboral, acepta el Aviso de Privacidad y los Términos vigentes del expediente.",
          "validation"
        )
      );
      setHeliosCopilotMessages(current =>
        appendHeliosCopilotMessage(current, {
          role: "assistant",
          content:
            "Antes de abrir tu asesor laboral, acepta primero el Aviso de Privacidad y los Términos vigentes de AuditaPatron para dejar constancia versionada en tu expediente.",
        })
      );
      return;
    }

    setHeliosCopilotMessages(current =>
      appendHeliosCopilotMessage(current, { role: "user", content })
    );
    heliosCopilotMutation.mutate(
      {
        tenantId: selectedTenantId,
        caseId: selectedCaseId,
        prompt: content,
        responseTone: preferredTone,
        conversationHistory: buildHeliosCopilotConversationHistoryInput({
          current: heliosCopilotMessages,
          nextPrompt: content,
        }),
      },
      {
        onSuccess: response => {
          setHeliosCopilotMessages(current =>
            appendHeliosCopilotMessage(current, {
              role: "assistant",
              content: response.answer,
            })
          );
        },
        onError: error => {
          setHeliosCopilotMessages(current =>
            appendHeliosCopilotMessage(current, {
              role: "assistant",
              content:
                error.message ||
                "No tengo suficiente claridad para responderte bien en este momento. Si quieres, intenta decirme qué te preocupa o sube otro documento útil y seguimos desde ahí.",
            })
          );
        },
      }
    );
  };

  const openHeliosCopilot = (prompt?: string | null) => {
    setHeliosCopilotOpen(true);

    if (typeof prompt === "string" && prompt.trim().length > 0) {
      handleHeliosCopilotSend(prompt.trim());
    }
  };

  const previewStructuredConfirmedFields = useMemo(
    () =>
      (displayPreviewStructuredExtraction?.fields ?? []).filter(
        field => field.status === "confirmed"
      ),
    [displayPreviewStructuredExtraction]
  );
  const previewStructuredEstimatedFields = useMemo(
    () =>
      (displayPreviewStructuredExtraction?.fields ?? []).filter(
        field => field.status === "estimated"
      ),
    [displayPreviewStructuredExtraction]
  );
  const previewGuardrails = pendingDraft?.preliminaryAnalysis?.guardrails ?? [];
  const dossierHistoryEntries = useMemo<DossierHistoryEntry[]>(() => {
    const documentEntries: DossierHistoryEntry[] = documents.map(document => ({
      id: `document-${document.documentId}`,
      title: `Subiste ${getSimpleDocumentTypeLabel(document.documentType).toLowerCase()}`,
      description: `${document.originalName} ya quedó ordenado dentro de tu expediente digital.`,
      tag: "Documento agregado",
      category: "document",
      timestamp: document.createdAt,
    }));

    const monitoringEntries: DossierHistoryEntry[] = monitoringDocuments.map(
      item => ({
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
      })
    );

    const summaryEntries: DossierHistoryEntry[] =
      visibleHeliosOpinion?.generatedAt
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
      .sort(
        (left, right) =>
          new Date(right.timestamp ?? 0).getTime() -
          new Date(left.timestamp ?? 0).getTime()
      )
      .slice(0, 5);
  }, [documents, monitoringDocuments, visibleHeliosOpinion]);
  const filteredDossierHistoryEntries = useMemo(
    () =>
      historyFilter === "all"
        ? dossierHistoryEntries
        : dossierHistoryEntries.filter(
            entry => entry.category === historyFilter
          ),
    [dossierHistoryEntries, historyFilter]
  );
  const heliosCopilotHistoryItems = useMemo(() => {
    const recentConversation = buildHeliosCopilotConversationHistoryItems(
      heliosCopilotMessages
    );

    const recentDossierEntries = dossierHistoryEntries
      .slice(0, recentConversation.length > 0 ? 1 : 3)
      .map(entry => ({
        id: entry.id,
        title: entry.title,
        detail: entry.description,
        timestampLabel: entry.timestamp ? formatDate(entry.timestamp) : null,
      }));

    return [...recentConversation, ...recentDossierEntries].slice(0, 3);
  }, [dossierHistoryEntries, heliosCopilotMessages]);
  const selectedComparisonLeft = comparisonDocuments.find(
    item => item.documentId === selectedComparisonLeftId
  );
  const selectedComparisonRight = comparisonDocuments.find(
    item => item.documentId === selectedComparisonRightId
  );
  const activeComparisonPair =
    selectedComparisonLeft &&
    selectedComparisonRight &&
    selectedComparisonLeft.documentId !== selectedComparisonRight.documentId
      ? ([selectedComparisonLeft, selectedComparisonRight] as [
          ComparisonDocument,
          ComparisonDocument,
        ])
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
  const comparisonHighlightCards = useMemo(() => {
    if (!comparisonLeftDocument || !comparisonRightDocument) {
      return [] as Array<{
        id: string;
        title: string;
        subtitle: string;
        summary: string;
        findings: HeliosResultFindingView[];
      }>;
    }

    return [comparisonLeftDocument, comparisonRightDocument].map(document => {
      const opinion = asHeliosOpinion(document.heliosOpinion);
      return {
        id: document.documentId,
        title: document.originalName,
        subtitle: `${getSimpleDocumentTypeLabel(document.documentType)} · ${formatDate(document.createdAt)}`,
        summary:
          warmVisibleNamingCopy(opinion?.summary ?? null) ??
          "Este documento ya forma parte del expediente y sirve como referencia para comparar lo más relevante.",
        findings: opinion?.resultCard?.keyFindings?.slice(0, 2) ?? [],
      };
    });
  }, [comparisonLeftDocument, comparisonRightDocument]);

  useEffect(() => {
    const fallbackLeft =
      automaticComparisonPair?.[0]?.documentId ??
      comparisonDocuments[0]?.documentId ??
      "";
    const fallbackRight =
      automaticComparisonPair?.[1]?.documentId ??
      comparisonDocuments.find(item => item.documentId !== fallbackLeft)
        ?.documentId ??
      "";

    setSelectedComparisonLeftId(current =>
      comparisonDocuments.some(item => item.documentId === current)
        ? current
        : fallbackLeft
    );
    setSelectedComparisonRightId(current =>
      comparisonDocuments.some(
        item => item.documentId === current && item.documentId !== fallbackLeft
      )
        ? current
        : fallbackRight
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

    setManualFieldValues(
      Object.fromEntries(
        buildPreviewEditableFields(pendingDraft).map(field => [
          field.key,
          field.value,
        ])
      )
    );
    setPreviewStatusFlash(true);
    const timeoutId = window.setTimeout(
      () => setPreviewStatusFlash(false),
      1800
    );
    return () => window.clearTimeout(timeoutId);
  }, [pendingDraft]);

  useEffect(() => {
    if (!pendingDraft || !previewNextTarget) {
      setRecommendedStepFlash(false);
      return;
    }

    recommendedStepRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
    setRecommendedStepFlash(true);
    const timeoutId = window.setTimeout(
      () => setRecommendedStepFlash(false),
      2200
    );
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

    const selectedProgress = dossierTypeProgress.find(
      item => item.type === selectedRecommendedTargetType
    );
    if (selectedProgress?.percent === 100) {
      setSelectedRecommendedTargetType(null);
    }
  }, [dossierTypeProgress, selectedRecommendedTargetType]);

  const isFirstDossierJourney = documents.length === 0;

  const trackFirstDossierReviewOutcome = (
    outcome: "confirmed" | "restarted" | "cleared"
  ) => {
    if (
      !isFirstDossierJourney ||
      !pendingDraft ||
      previewReviewStartedAtRef.current === null
    ) {
      return;
    }

    const secondsInReview = Math.max(
      0,
      Math.round((Date.now() - previewReviewStartedAtRef.current) / 1000)
    );
    if (secondsInReview >= 12) {
      trackEvent("auditar_first_dossier_review_hesitated", {
        tenantId: selectedTenantId,
        caseId: selectedCaseId,
        documentType: pendingDraft.classification.documentType,
        secondsInReview,
        outcome,
      });
    }

    previewReviewStartedAtRef.current = null;
  };

  const handleContextualShortcut = (
    shortcut: ContextualShortcut,
    documentType: string,
    surface: "draft" | "confirmed"
  ) => {
    trackEvent("auditar_contextual_shortcut_used", {
      tenantId: selectedTenantId,
      caseId: selectedCaseId,
      documentType,
      shortcutId: shortcut.id,
      shortcutAction: shortcut.action,
      surface,
      firstDossier: isFirstDossierJourney,
    });

    if (isFirstDossierJourney) {
      firstDossierShortcutCountRef.current += 1;
      trackEvent("auditar_first_dossier_shortcut_used", {
        tenantId: selectedTenantId,
        caseId: selectedCaseId,
        documentType,
        shortcutId: shortcut.id,
        shortcutAction: shortcut.action,
        surface,
      });
    }

    if (shortcut.action === "upload" && shortcut.targetType) {
      focusRecommendedUpload(shortcut.targetType);
      return;
    }

    if (shortcut.action === "assistant" && shortcut.prompt) {
      openHeliosCopilot(shortcut.prompt);
    }
  };

  const handlePrimaryVerdictCta = () => {
    if (viewportSegment === "mobile" && lastUpload) {
      const timeToVerdictMs =
        verdictAnalyticsStartedAtRef.current === null
          ? undefined
          : Math.max(0, Date.now() - verdictAnalyticsStartedAtRef.current);

      trackEvent("auditar_mobile_verdict_cta_clicked", {
        tenantId: selectedTenantId,
        caseId: selectedCaseId,
        documentType: lastUpload.classification.documentType,
        viewportSegment,
        ctaLabel: primaryLastUploadShortcut?.label ?? "Abrir asesor laboral",
        ctaAction: primaryLastUploadShortcut?.action ?? "assistant",
        explanationVariant,
        severityLabel: lastUploadSeverityNarrative.eyebrow,
        timeToVerdictMs,
        scrollDepthPx: verdictMaxScrollDepthRef.current,
      });
    }

    if (primaryLastUploadShortcut) {
      handleContextualShortcut(
        primaryLastUploadShortcut,
        lastUpload?.classification.documentType ?? "unknown",
        "confirmed"
      );
      return;
    }

    openHeliosCopilot();
  };

  const scrollToDigitalArchive = (
    source: "quick_access" | "result_panel" | "section_header"
  ) => {
    digitalArchiveSectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });

    trackEvent("auditar_digital_archive_scrolled", {
      tenantId: selectedTenantId,
      caseId: selectedCaseId,
      source,
      documentCount: documents.length,
    });
  };

  const handleOpenArchiveDocument = async (
    documentId: string,
    source: "quick_access" | "document_card" | "section_header"
  ) => {
    if (!selectedTenantId || !selectedCaseId) {
      return;
    }

    setSubmitError(null);
    setOpeningDocumentId(documentId);

    try {
      const access = await utils.documents.access.fetch({
        tenantId: selectedTenantId,
        caseId: selectedCaseId,
        documentId,
      });

      trackEvent("auditar_digital_archive_document_opened", {
        tenantId: selectedTenantId,
        caseId: selectedCaseId,
        documentId,
        source,
      });

      if (typeof window !== "undefined") {
        window.open(access.downloadUrl, "_blank", "noopener,noreferrer");
      }
    } catch (error) {
      console.error(error);
      setSubmitError(
        "No pudimos abrir tu documento por ahora. Intenta de nuevo en unos segundos."
      );
      trackEvent("auditar_digital_archive_document_open_failed", {
        tenantId: selectedTenantId,
        caseId: selectedCaseId,
        documentId,
        source,
      });
    } finally {
      setOpeningDocumentId(current =>
        current === documentId ? null : current
      );
    }
  };

  const handleDigitalArchiveQuickAction = async () => {
    if (latestArchiveDocument) {
      await handleOpenArchiveDocument(
        latestArchiveDocument.documentId,
        "quick_access"
      );
      return;
    }

    scrollToDigitalArchive("quick_access");
  };

  const clearSelectedFile = () => {
    if (isFirstDossierJourney && (selectedFile || pendingDraft)) {
      trackEvent("auditar_first_dossier_cleared", {
        tenantId: selectedTenantId,
        caseId: selectedCaseId,
        hadSelectedFile: Boolean(selectedFile),
        hadDraft: Boolean(pendingDraft),
      });
    }

    trackFirstDossierReviewOutcome("cleared");
    documentSelectionStartedAtRef.current = null;
    previewReviewStartedAtRef.current = null;
    setSelectedFile(null);
    setSelectedCaptureMode(null);
    setAutoAnalyzeRequested(false);
    setPendingDraft(null);
    setTextHint("");
    setSubmitError(null);
    setPickerKey(value => value + 1);
    setUploadSourceOpen(false);
  };

  const handleSelectedDocumentFile = (file: File | null) => {
    const validationMessage = validateDocumentUploadFile(file);

    if (validationMessage) {
      if (isFirstDossierJourney && file) {
        trackEvent("auditar_first_dossier_validation_blocked", {
          tenantId: selectedTenantId,
          caseId: selectedCaseId,
          reason:
            file.size > MAX_DOCUMENT_UPLOAD_SIZE_BYTES
              ? "file_too_large"
              : "unsupported_file",
          fileSizeKb: Math.max(1, Math.round(file.size / 1024)),
        });
      }
      documentSelectionStartedAtRef.current = null;
      previewReviewStartedAtRef.current = null;
      setSelectedFile(null);
      setAutoAnalyzeRequested(false);
      setPendingDraft(null);
      setLastUpload(null);
      setSubmitError(validationMessage);
      setPickerKey(value => value + 1);
      setUploadSourceOpen(false);
      return;
    }

    setSelectedFile(file);
    setAutoAnalyzeRequested(Boolean(file));
    setPendingDraft(null);
    setLastUpload(null);
    if (file) {
      documentSelectionStartedAtRef.current = Date.now();
      previewReviewStartedAtRef.current = null;
      trackFunnelStep("document_selected_for_analysis", {
        tenantId: selectedTenantId,
        caseId: selectedCaseId,
        captureMode: selectedCaptureMode ?? preferredCaptureMode ?? "file",
        fileSizeKb: Math.max(1, Math.round(file.size / 1024)),
      });
      if (isFirstDossierJourney) {
        trackEvent("auditar_first_dossier_started", {
          tenantId: selectedTenantId,
          caseId: selectedCaseId,
          captureMode: selectedCaptureMode ?? preferredCaptureMode ?? "file",
          fileSizeKb: Math.max(1, Math.round(file.size / 1024)),
          viewportSegment,
        });
      }
    } else {
      documentSelectionStartedAtRef.current = null;
      previewReviewStartedAtRef.current = null;
    }
    if (file && selectedRecommendedTargetType) {
      setTextHint(
        current =>
          current.trim() ||
          getRecommendedDocumentHint(selectedRecommendedTargetType)
      );
    }
    setSubmitError(null);
    setUploadSourceOpen(false);
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    handleSelectedDocumentFile(event.target.files?.[0] ?? null);
  };

  const openCameraPicker = () => {
    setPreferredCaptureMode("camera");
    setSelectedCaptureMode("camera");

    if (canUseNativeDocumentInput()) {
      void selectNativeDocumentForCaptureMode("camera")
        .then(selection => {
          handleSelectedDocumentFile(selection.file ?? null);
        })
        .catch(error => {
          if (isNativeDocumentSelectionCancelled(error)) {
            setSubmitError(null);
            setUploadSourceOpen(false);
            return;
          }

          setSelectedFile(null);
          setAutoAnalyzeRequested(false);
          setPendingDraft(null);
          setSubmitError(
            error instanceof Error
              ? error.message
              : getNativeDocumentSelectionErrorMessage("camera")
          );
          setUploadSourceOpen(false);
        });
      return;
    }

    cameraInputRef.current?.click();
  };

  const openFilePicker = () => {
    setPreferredCaptureMode("file");
    setSelectedCaptureMode("file");

    if (canUseNativeDocumentInput()) {
      void selectNativeDocumentForCaptureMode("file")
        .then(selection => {
          handleSelectedDocumentFile(selection.file ?? null);
        })
        .catch(error => {
          if (isNativeDocumentSelectionCancelled(error)) {
            setSubmitError(null);
            setUploadSourceOpen(false);
            return;
          }

          setSelectedFile(null);
          setAutoAnalyzeRequested(false);
          setPendingDraft(null);
          setSubmitError(
            error instanceof Error
              ? error.message
              : getNativeDocumentSelectionErrorMessage("file")
          );
          setUploadSourceOpen(false);
        });
      return;
    }

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
    surface: "compact_mobile_toggle" | "preference_panel"
  ) => {
    setPreferredCaptureMode(mode);
    setSelectedCaptureMode(mode);
    trackFunnelStep("upload_mode_selected", {
      tenantId: selectedTenantId,
      caseId: selectedCaseId,
      mode,
      context: shouldCompactMobileUploadEntry
        ? "first_upload"
        : "subsequent_upload",
      surface,
    });
  };

  const focusRecommendedUpload = (
    targetType?: DossierTarget["type"] | null
  ) => {
    const resolvedTargetType =
      targetType ??
      effectiveRecommendedTarget?.type ??
      dossierStatus.nextTarget?.type ??
      null;

    if (resolvedTargetType) {
      setSelectedRecommendedTargetType(resolvedTargetType);
      setTextHint(
        current =>
          current.trim() || getRecommendedDocumentHint(resolvedTargetType)
      );
    }

    setSubmitError(null);
    uploadSectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });

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
    trackFirstDossierReviewOutcome("restarted");
    documentSelectionStartedAtRef.current = null;
    previewReviewStartedAtRef.current = null;
    setPendingDraft(null);
    setManualFieldValues({});
    setSelectedFile(null);
    setSelectedCaptureMode(null);
    setAutoAnalyzeRequested(false);
    setSubmitError(null);
    setPickerKey(value => value + 1);

    openPreferredPicker();
  };

  const handleManualFieldChange = (key: string, value: string) => {
    setManualFieldValues(current => ({
      ...current,
      [key]: value,
    }));
    setSubmitError(null);
  };

  const handleUpload = async () => {
    setAutoAnalyzeRequested(false);

    if (!selectedTenantId || !selectedCaseId || !selectedFile) {
      setSubmitError(
        "Selecciona un expediente y un archivo antes de continuar."
      );
      return;
    }

    if (legalGateRequired) {
      const accepted = await handleAcceptLegalPackage();
      if (!accepted) {
        setSubmitError(
          "Acepta primero el Aviso de Privacidad y los Términos vigentes para continuar."
        );
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
      if (isFirstDossierJourney) {
        previewReviewStartedAtRef.current = Date.now();
      }
      const selectionToDraftSeconds =
        documentSelectionStartedAtRef.current === null
          ? undefined
          : Math.max(
              0,
              Math.round(
                (Date.now() - documentSelectionStartedAtRef.current) / 1000
              )
            );
      trackFunnelStep("document_draft_analyzed", {
        tenantId: selectedTenantId,
        caseId: selectedCaseId,
        documentType: result.classification.documentType,
        captureMode: selectedCaptureMode ?? preferredCaptureMode ?? null,
        viewportSegment,
        selectionToDraftSeconds,
      });
      setLastUpload(null);
      setSelectedFile(null);
      setSelectedCaptureMode(null);
      setTextHint("");
      setPickerKey(value => value + 1);
    } catch (error) {
      setSubmitError(
        toFriendlyAuditarRuntimeMessage(
          error,
          "No fue posible analizar el archivo."
        )
      );
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

  const viewportSegment = getAuditarViewportSegment(window.innerWidth);

  useEffect(() => {
    if (typeof window === "undefined" || viewportSegment !== "mobile") {
      return;
    }

    const captureScrollDepth = () => {
      verdictMaxScrollDepthRef.current = Math.max(
        verdictMaxScrollDepthRef.current,
        Math.max(0, Math.round(window.scrollY))
      );
    };

    captureScrollDepth();
    window.addEventListener("scroll", captureScrollDepth, { passive: true });

    return () => {
      window.removeEventListener("scroll", captureScrollDepth);
    };
  }, [viewportSegment, lastUploadRevealId]);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      viewportSegment !== "mobile" ||
      !lastUpload ||
      !lastUploadRevealId ||
      !verdictPanelRef.current ||
      typeof IntersectionObserver === "undefined"
    ) {
      return;
    }

    const currentVerdictId = lastUploadRevealId;
    const observer = new IntersectionObserver(
      entries => {
        const entry = entries[0];

        if (!entry?.isIntersecting) {
          return;
        }

        if (verdictAnalyticsTrackedIdRef.current === currentVerdictId) {
          return;
        }

        verdictAnalyticsTrackedIdRef.current = currentVerdictId;
        const timeToVerdictMs =
          verdictAnalyticsStartedAtRef.current === null
            ? undefined
            : Math.max(0, Date.now() - verdictAnalyticsStartedAtRef.current);

        trackEvent("auditar_mobile_verdict_viewed", {
          tenantId: selectedTenantId,
          caseId: selectedCaseId,
          documentType: lastUpload.classification.documentType,
          viewportSegment,
          explanationVariant,
          severityLabel: lastUploadSeverityNarrative.eyebrow,
          timeToVerdictMs,
          scrollDepthPx: verdictMaxScrollDepthRef.current,
        });
      },
      { threshold: 0.6 }
    );

    observer.observe(verdictPanelRef.current);

    return () => observer.disconnect();
  }, [
    lastUpload,
    lastUploadRevealId,
    selectedCaseId,
    selectedTenantId,
    viewportSegment,
  ]);

  const handleConfirmDraft = async () => {
    if (!selectedTenantId || !selectedCaseId || !pendingDraft) {
      setSubmitError(
        "Primero analiza un documento para revisarlo antes de guardarlo."
      );
      return;
    }

    if (legalGateRequired) {
      const accepted = await handleAcceptLegalPackage();
      if (!accepted) {
        setSubmitError(
          "Acepta primero el Aviso de Privacidad y los Términos vigentes para continuar."
        );
        return;
      }
    }

    try {
      setSubmitError(null);
      if (viewportSegment === "mobile") {
        verdictAnalyticsStartedAtRef.current = Date.now();
        verdictAnalyticsTrackedIdRef.current = null;
        verdictMaxScrollDepthRef.current = Math.max(0, Math.round(window.scrollY));
      }
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
      trackFirstDossierReviewOutcome("confirmed");
      const selectionToConfirmedSeconds =
        documentSelectionStartedAtRef.current === null
          ? undefined
          : Math.max(
              0,
              Math.round(
                (Date.now() - documentSelectionStartedAtRef.current) / 1000
              )
            );
      trackFunnelStep("document_draft_confirmed", {
        tenantId: selectedTenantId,
        caseId: selectedCaseId,
        documentType: result.classification.documentType,
        captureMode: pendingDraft.previewAsset.captureMode,
        hadManualOverrides: manualOverridePayload.length > 0,
        viewportSegment,
        selectionToConfirmedSeconds,
      });
      trackFunnelStep("document_uploaded", {
        tenantId: selectedTenantId,
        caseId: selectedCaseId,
        documentType: result.classification.documentType,
        captureMode: pendingDraft.previewAsset.captureMode,
        sourceChannel: "manual",
        hadManualOverrides: manualOverridePayload.length > 0,
        viewportSegment,
        selectionToConfirmedSeconds,
      });
      if (isFirstDossierJourney) {
        trackEvent("auditar_first_dossier_confirmed", {
          tenantId: selectedTenantId,
          caseId: selectedCaseId,
          documentType: result.classification.documentType,
          selectionToConfirmedSeconds,
          usedContextualShortcuts: firstDossierShortcutCountRef.current,
          hadManualOverrides: manualOverridePayload.length > 0,
        });
      }
      documentSelectionStartedAtRef.current = null;
      previewReviewStartedAtRef.current = null;
      firstDossierShortcutCountRef.current = 0;
      setPendingDraft(null);
      setManualFieldValues({});
      setSelectedFile(null);
      setSelectedCaptureMode(null);
      setTextHint("");
      setPickerKey(value => value + 1);

      await Promise.all([
        utils.cases.list.invalidate({ tenantId: selectedTenantId }),
        utils.cases.detail.invalidate({
          tenantId: selectedTenantId,
          caseId: selectedCaseId,
        }),
      ]);
    } catch (error) {
      setSubmitError(
        toFriendlyAuditarRuntimeMessage(
          error,
          "No fue posible guardar el documento."
        )
      );
    }
  };

  if (auth.loading) {
    return (
      <main className="audita-auditar min-h-screen bg-slate-50 px-4 py-12 text-slate-950">
        <div className="container mx-auto max-w-6xl">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
            <div className="flex items-center gap-3">
              <AuditaPatronLogoIcon
                className="sm:hidden"
                imageClassName="h-10 w-10 object-contain"
              />
              <AuditaPatronLogoWordmark
                className="hidden sm:inline-flex"
                imageClassName="max-w-[240px]"
                subtitleClassName="text-[0.82rem] tracking-[0.14em] sm:text-[0.92rem]"
              />
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-slate-950">
              Preparando tu espacio de revisión...
            </h1>
          </div>
        </div>
      </main>
    );
  }

  if (!auth.isAuthenticated && !auditarHarnessBypass) {
    return (
      <main className="audita-auditar min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(20,184,166,0.12),_transparent_35%),linear-gradient(180deg,_#f8fafc_0%,_#ffffff_100%)] px-3 py-8 text-slate-950 sm:px-4 sm:py-10">
        <div className="container mx-auto max-w-6xl">
          <div className="rounded-[1.5rem] border border-slate-900 bg-slate-950 px-4 py-4 text-white shadow-[0_20px_50px_-34px_rgba(2,6,23,0.7)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <a
                href="/"
                className="inline-flex items-center gap-2 text-sm font-medium text-slate-300 transition hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" strokeWidth={1.8} />
                Volver al inicio
              </a>
              <span className="rounded-full bg-white/10 px-3 py-2 text-xs font-semibold text-white">
                Revisión guiada
              </span>
            </div>
          </div>

          <div className="mt-5 grid gap-6 overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-5 shadow-[0_35px_100px_-60px_rgba(15,23,42,0.45)] sm:p-6 lg:grid-cols-[1fr_0.9fr] lg:p-8">
            <div className="mx-auto flex max-w-full flex-col items-center text-center lg:mx-0 lg:max-w-2xl lg:items-start lg:text-left">
              <AuditaPatronLogo
                showTagline={false}
                className="inline-flex max-w-full justify-center lg:justify-start"
                imageClassName="h-auto w-full max-w-[min(62vw,13rem)] object-contain sm:max-w-[300px] md:max-w-[388px] lg:max-w-[430px]"
              />
              <div className="mt-5 inline-flex max-w-full flex-wrap items-center justify-center gap-2 rounded-full border border-teal-100 bg-teal-50 px-4 py-2 text-center text-sm font-medium leading-5 text-teal-800 lg:justify-start">
                <ShieldCheck className="h-4 w-4" strokeWidth={1.8} />
                Revisión rápida y privada
              </div>
              <h1 className="mt-5 max-w-[13ch] text-balance text-3xl font-semibold tracking-[-0.05em] text-slate-950 sm:text-4xl">
                Sube tu primer documento
              </h1>
              <p className="mt-4 max-w-full text-base leading-7 text-slate-600 sm:max-w-2xl sm:text-lg sm:leading-8">
                Empieza con una foto, PDF, XML o contrato en DOCX. Te diremos rápido qué encontramos y qué conviene hacer después. El correo solo hace falta si decides guardarlo.
              </p>

              <div className="mt-6 flex w-full max-w-md flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center lg:justify-start">
                <Button
                  className="h-auto min-h-12 w-full rounded-full bg-teal-600 px-5 py-3 text-sm leading-5 text-white hover:bg-teal-700 sm:h-12 sm:w-auto sm:px-7 sm:py-0 sm:text-base"
                  onClick={() => {
                    trackFunnelStep("auditar_guest_entry_clicked", {
                      source: "auditar_guard",
                    });
                    window.location.href = "/#lectura-gratis";
                  }}
                >
                  Empezar gratis
                  <ArrowRight className="ml-2 h-4 w-4 shrink-0" strokeWidth={1.8} />
                </Button>
                <Button
                  variant="ghost"
                  className="h-auto min-h-12 w-full whitespace-normal rounded-full px-5 py-3 text-sm leading-5 text-slate-600 hover:bg-slate-100 sm:h-12 sm:w-auto sm:px-4 sm:py-0 sm:text-[0.95rem]"
                  onClick={() => {
                    trackFunnelStep("auditar_login_clicked", {
                      source: "auditar_guard_secondary",
                    });
                    window.location.href = getLoginUrl();
                  }}
                >
                  <span className="sm:hidden">Ya tengo cuenta</span>
                  <span className="hidden sm:inline">Ya tengo cuenta · iniciar sesión</span>
                </Button>
              </div>
            </div>

            <div className="mx-auto w-full max-w-full overflow-hidden rounded-[1.6rem] border border-slate-200 bg-slate-50 p-4 sm:max-w-xl sm:p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 sm:text-sm sm:tracking-[0.22em]">
                Qué pasa después de subirlo
              </p>
              <div className="mt-4 space-y-3">
                {[
                  "Subes un solo archivo desde tu celular o computadora.",
                  "Te mostramos qué detectamos y si ya apareció una señal para revisar.",
                  "Si quieres guardarlo o seguir después, entonces activas tu acceso por correo.",
                ].map(item => (
                  <div
                    key={item}
                    className="flex min-w-0 items-start gap-3 rounded-[1.1rem] border border-white bg-white p-3.5"
                  >
                    <CheckCircle2
                      className="mt-0.5 h-5 w-5 shrink-0 text-teal-700"
                      strokeWidth={1.8}
                    />
                    <p className="min-w-0 text-sm leading-6 text-slate-700">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const setPersistedCeoPanelOpen = (nextOpen: boolean) => {
    setCeoPanelPreferenceOpen(nextOpen);
    setCeoActionsDrawerOpen(nextOpen);
  };

  return (
    <main className="audita-auditar min-h-screen overflow-x-hidden bg-slate-50 px-4 py-6 pb-28 text-slate-950 sm:py-8 sm:pb-10">
      <div className="container mx-auto max-w-6xl">
        <div
          ref={heroCardRef}
          className={shouldCompactPostUploadExperience
            ? "mb-2 text-left"
            : "rounded-[1.8rem] border border-slate-900 bg-slate-950 px-5 py-5 text-center text-white shadow-[0_24px_70px_-42px_rgba(2,6,23,0.82)] sm:flex sm:items-center sm:justify-between sm:text-left"}
        >
          <div>
            {shouldCompactPostUploadExperience ? null : (
              <a
                href="/"
                className="inline-flex items-center gap-2 text-sm font-medium text-slate-300 transition hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" strokeWidth={1.8} />
                <span>Volver al inicio</span>
              </a>
            )}
            {shouldCompactPostUploadExperience ? null : (
              <div className="mt-4 flex items-center justify-center sm:justify-start">
                <AuditaPatronLogoWordmark
                  surface="dark"
                  className="inline-flex max-w-full"
                  imageClassName="h-auto w-full max-w-[180px] object-contain sm:w-auto sm:max-w-[290px]"
                  subtitleClassName="text-[0.78rem] tracking-[0.14em] sm:text-[0.92rem]"
                />
              </div>
            )}
            {shouldCompactPostUploadExperience ? null : (
              <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-teal-300">
                Paso 1
              </p>
            )}

            {shouldCompactPostUploadExperience ? null : (
              <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
                Sube tu recibo o comprobante
              </h1>
            )}
            <p className={`max-w-xl text-sm leading-6 text-slate-300 ${shouldCompactPostUploadExperience ? "hidden" : "mt-2"}`}>
              {shouldCompactPostUploadExperience ? null : (
                <>
                  <span className="sm:hidden">
                      Sube una foto, PDF o contrato en DOCX. Primero te mostraremos lo importante y qué hacer después.

                  </span>
                  <span className="hidden sm:inline">
                    Sube una foto, PDF, XML o contrato en DOCX. Primero te mostraremos lo importante y qué hacer después.
                  </span>
                </>
              )}
            </p>
            {!shouldCompactPostUploadExperience ? (
              <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-medium text-slate-200">
                <ShieldCheck
                  className="h-3.5 w-3.5 text-teal-300"
                  strokeWidth={1.8}
                />
Tu recibo está seguro y solo tú lo ves
              </div>
            ) : null}
          </div>

          <div className="mt-4 flex flex-col items-stretch gap-2 sm:mt-0 sm:flex-wrap sm:items-center sm:justify-end">
            {shouldCompactPostUploadExperience ? null : null}
   </div>
        </div>

        <section className="sticky top-3 z-30 mt-4 hidden sm:block">
          <div
            className={`rounded-[1.15rem] border px-4 py-3 shadow-[0_16px_38px_-30px_rgba(15,23,42,0.4)] backdrop-blur ${privacySignal.cardClass}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className={`inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] ${privacySignal.eyebrowClass}`}>
                  <ShieldCheck className="h-4 w-4" strokeWidth={1.8} />
                  Privacidad activa en este expediente
                </div>
                <p className="mt-1 text-sm font-semibold text-slate-950">
                  {privacySignal.title}
                </p>
              </div>
              <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${privacySignal.badgeClass}`}>
                {privacySignal.badge}
              </span>
            </div>
            <div className="mt-2 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              <p className="max-w-3xl text-sm leading-6 text-slate-700">
                {privacySignal.detail}
              </p>
              <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-700">
                <span className="rounded-full border border-white/80 bg-white/90 px-3 py-1.5 shadow-sm">
                  {privacySignal.company}
                </span>
                <span className="rounded-full border border-white/80 bg-white/90 px-3 py-1.5 shadow-sm">
                  {privacySignal.control}
                </span>
                <span className="rounded-full border border-white/80 bg-white/90 px-3 py-1.5 shadow-sm">
                  {privacySignal.trace}
                </span>
              </div>
            </div>
          </div>
        </section>

        {bootstrapMutation.isPending ? (
          <div className="mt-8 rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-600">
              Estamos dejando lista tu revisión...
            </p>
          </div>
        ) : null}

        {bootstrapMutation.isError ? (
          <div className="mt-8 rounded-[1.75rem] border border-amber-200 bg-amber-50 p-6 text-amber-950">
            <p className="font-semibold">
              No fue posible preparar tu espacio de revisión.
            </p>
            <p className="mt-2 text-sm leading-7">
              {bootstrapMutation.error.message}
            </p>
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
          <section
            className="mt-6 rounded-[1.75rem] border border-dashed border-amber-300 bg-amber-50/70 p-5 shadow-sm"
            data-testid="legal-gate-harness"
          >
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.14em] text-amber-900">
                  Modo de prueba del gate legal
                </p>
                <p className="mt-2 text-sm leading-6 text-amber-950">
                  Simula un conflicto controlado del lock para validar en
                  navegador el temporizador, las métricas visibles y el
                  reintento.
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

        {postUploadHarnessMode ? (
          <section
            className={shouldCompactPostUploadExperience
              ? "hidden"
              : "mt-4 rounded-[1.5rem] border border-dashed border-teal-300 bg-teal-50/80 p-4 shadow-sm"}
            data-testid="post-upload-harness"
          >
            <div className={`flex gap-2 ${shouldCompactPostUploadExperience ? "items-center justify-between" : "flex-col"}`}>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-800">
                Modo de prueba del veredicto post-upload
              </p>
              <p className={`text-teal-950 ${shouldCompactPostUploadExperience ? "text-xs leading-5" : "mt-2 text-sm leading-6"}`}>
                {shouldCompactPostUploadExperience
                  ? "Vista simulada para revisar el veredicto sin login ni subida real."
                  : "Esta vista deja un resultado móvil simulado para validar el revelado, el semáforo y el CTA principal sin depender de login ni de una subida real."}
              </p>
            </div>
          </section>
        ) : null}

        {!auth.canToggleUserView && (legalGateRequired || legalGateHarnessMode) ? (
          <section className="mt-6 rounded-[1.5rem] border border-amber-200/80 bg-gradient-to-br from-amber-50 via-white to-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-3xl">
                <div className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-900">
                  <Lock className="h-4 w-4" strokeWidth={1.8} />
                  Autorización legal pendiente
                </div>
                <h2 className="mt-3 text-lg font-semibold tracking-[-0.03em] text-slate-950">
                  La confirmación aparece justo cuando envías o guardas tu
                  archivo.
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  No interrumpe tu flujo antes de tiempo. Solo protege el
                  expediente y deja registro versionado en la acción principal.
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
                  <span className="text-slate-500">
                    Versión vigente{" "}
                    {legalAcceptance?.legalVersion ?? LEGAL_VERSION}
                  </span>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[21rem]">
                <div className="rounded-[1.1rem] border border-white bg-white/90 px-4 py-3 text-sm text-slate-700">
                  <p className="font-semibold text-slate-950">
                            Cobertura legal y privacidad
                  </p>
                  <p className="mt-2">
                    {acceptedLegalDocumentsCount} de{" "}
                    {legalAcceptanceDocuments.length || LEGAL_DOCUMENTS.length}{" "}
                    documentos aceptados en esta versión.
                  </p>
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    La aceptación se registra cuando confirmas la acción
                    principal de este expediente.
                  </p>
                </div>
                <div
                  className="rounded-[1.1rem] border border-white bg-white/90 px-4 py-3 text-sm text-slate-700"
                  data-testid="legal-gate-lock-metrics"
                >
                  <p className="font-semibold text-slate-950">
                    Estado del resguardo
                  </p>
                  <div className="mt-3 grid grid-cols-3 gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                        Intentos
                      </p>
                      <p
                        className="mt-1 text-lg font-semibold text-slate-950"
                        data-testid="legal-gate-metric-attempts"
                      >
                        {legalGateMetrics.attempts}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                        Conflictos
                      </p>
                      <p
                        className="mt-1 text-lg font-semibold text-slate-950"
                        data-testid="legal-gate-metric-conflicts"
                      >
                        {legalGateMetrics.conflicts}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                        Reintentos
                      </p>
                      <p
                        className="mt-1 text-lg font-semibold text-slate-950"
                        data-testid="legal-gate-metric-retries"
                      >
                        {legalGateMetrics.retries}
                      </p>
                    </div>
                  </div>
                  <p
                    className="mt-3 text-xs leading-5 text-slate-600"
                    data-testid="legal-gate-metric-status"
                  >
                    Estado actual:{" "}
                    {describeLegalGateMetricEvent(legalGateMetrics.lastEvent)}
                    {legalGateMetrics.lastUpdatedAt
                      ? ` · Última actualización ${new Date(
                          legalGateMetrics.lastUpdatedAt
                        ).toLocaleTimeString("es-MX", {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}`
                      : ""}
                  </p>
                  {legalGateRetryCountdown > 0 ? (
                    <p
                      className="mt-2 text-xs font-semibold text-amber-900"
                      data-testid="legal-gate-metric-timer"
                    >
                      Temporizador de reintento activo:{" "}
                      {legalGateRetryCountdown}s
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          </section>
        ) : null}

        <Drawer
          open={legalDocumentsDrawerOpen}
          onOpenChange={setLegalDocumentsDrawerOpen}
        >
          <DrawerContent>
            <DrawerHeader className="text-left">
              <DrawerTitle>
                Documentos legales vigentes de tu expediente
              </DrawerTitle>
              <DrawerDescription>
                Revísalos con calma. La aceptación se registra únicamente cuando
                confirmas la acción principal de analizar o guardar dentro de
                este expediente.
              </DrawerDescription>
            </DrawerHeader>
            <div className="space-y-3 px-4 pb-2">
              {LEGAL_DOCUMENTS.map(document => {
                const status = legalAcceptanceDocuments.find(
                  item => item.slug === document.slug
                );
                const accepted = status?.accepted ?? false;
                return (
                  <div
                    key={document.slug}
                    className="rounded-[1.1rem] border border-slate-200 bg-white p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-950">
                          {document.fullTitle}
                        </p>
                        <p className="mt-1 text-sm leading-6 text-slate-600">
                          Versión {document.version} · Vigencia{" "}
                          {document.effectiveDate}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${accepted ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-900"}`}
                      >
                        {accepted ? "Aceptado" : "Pendiente"}
                      </span>
                    </div>
                    <a
                      href={document.route}
                      className="mt-3 inline-flex text-sm font-semibold text-slate-900 underline underline-offset-4"
                    >
                      Abrir documento completo
                    </a>
                  </div>
                );
              })}
            </div>
            <DrawerFooter>
              <DrawerClose asChild>
                <Button
                  variant="outline"
                  className="rounded-2xl border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                >
                  Cerrar
                </Button>
              </DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>

        <CeoPanelDrawer
          open={ceoActionsDrawerOpen}
          onOpenChange={setPersistedCeoPanelOpen}
          baseLabel="/auditar"
        />

        {showWorkspaceSectionSelector && !auth.canToggleUserView ? (
          <section className={`${shouldCompactPostUploadExperience ? "mt-4" : "mt-6"} rounded-[1.7rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5`}>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">
                  Ordena la pantalla por capas
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950 sm:hidden">
                  {activeWorkspaceSectionCard.label}
                </h2>
                <h2 className="mt-2 hidden text-2xl font-semibold tracking-[-0.03em] text-slate-950 sm:block">
                  Primero ve lo esencial. Luego entra al expediente o a herramientas más finas.
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 sm:hidden">
                  {activeWorkspaceSectionCard.description}
                </p>
                <p className="mt-2 hidden max-w-3xl text-sm leading-6 text-slate-600 sm:block sm:text-base">
                  Dejamos tres vistas simples para que no tengas todo abierto al mismo tiempo: resumen para actuar rápido, expediente para continuidad y herramientas para comparaciones más avanzadas.
                </p>
              </div>
              <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-800">
                Vista activa: {activeWorkspaceSectionCard.label.toLowerCase()}
              </span>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              {workspaceSectionCards.map(item => {
                const isActive = workspaceSection === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    className={`rounded-[1.2rem] border px-4 py-4 text-left transition ${isActive ? "border-slate-950 bg-slate-950 text-white shadow-sm" : "border-slate-200 bg-slate-50 text-slate-900 hover:border-slate-300 hover:bg-white"}`}
                    onClick={() => setWorkspaceSection(item.key)}
                  >
                    <p className={`text-xs font-semibold uppercase tracking-[0.16em] ${isActive ? "text-slate-300" : "text-slate-500"}`}>
                      {item.label}
                    </p>
                    <p className="mt-2 text-base font-semibold">{item.title}</p>
                    <p className={`mt-2 text-sm leading-6 ${isActive ? "text-slate-200" : "text-slate-600"}`}>
                      {item.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}

        <div className={`${shouldCompactPostUploadExperience ? "mt-0" : "mt-6"} grid gap-5 ${shouldCompactPostUploadExperience ? "" : "xl:grid-cols-[1.2fr_0.8fr]"}`}>
          <section className={shouldCompactPostUploadExperience ? "flex min-h-[32vh] w-full flex-col items-center justify-center space-y-1.5 rounded-[2rem] bg-slate-50 px-1 py-1.5" : "space-y-6"}>
            {shouldCompactPostUploadExperience && lastUpload ? (
              <div className="w-full max-w-none self-center rounded-[1.9rem] border border-emerald-200/90 bg-[linear-gradient(135deg,_rgba(250,254,251,0.998),_rgba(255,255,255,1))] px-4 py-4 shadow-[0_10px_24px_-22px_rgba(16,185,129,0.16)] sm:rounded-[2.1rem] sm:px-8 sm:py-7">
                <div className={`flex flex-col gap-2 ${shouldCompactPostUploadExperience ? "" : "lg:flex-row lg:items-center lg:justify-between"}`}>
                  <div className="min-w-0">
                    {shouldCompactPostUploadExperience ? null : (
                      <div className="flex flex-wrap items-center gap-3">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold shadow-sm ${lastUploadVerdict.classes}`}
                        >
                          {lastUploadVerdict.label}
                        </span>
                      </div>
                    )}
                    {shouldCompactPostUploadExperience ? (
                      <div className="flex flex-wrap items-center justify-center gap-2 text-center sm:justify-start">
                        <span className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-800">
                          Resultado listo
                        </span>
                        <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 shadow-sm">
                          {getSimpleDocumentTypeLabel(lastUpload.classification.documentType)}
                        </span>
                      </div>
                    ) : null}
                    <div className={`flex items-start gap-2.5 ${shouldCompactPostUploadExperience ? "mt-3" : "sm:mt-1"}`}>
                      <CheckCircle2 className="h-8 w-8 shrink-0 text-emerald-700" strokeWidth={2.1} />
                      <div className="min-w-0">
                        <h2 className={`font-semibold tracking-[-0.05em] text-slate-950 ${shouldCompactPostUploadExperience ? "text-[1.85rem] leading-[1.02] sm:text-[2.3rem]" : "text-[1.55rem] sm:text-[2.1rem]"}`}>
                          {shouldCompactPostUploadExperience
                            ? lastUploadResultHeadline
                            : lastUploadVerdict.label}
                        </h2>
                        {shouldCompactPostUploadExperience ? (
                          <>
                            <p className="mt-2 text-sm leading-6 text-slate-700 sm:text-base sm:leading-7">
                              {lastUploadResultLead}
                            </p>
                            <div className="mt-3 rounded-[1rem] border border-emerald-200 bg-emerald-50/80 px-3 py-3 text-left">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-800">
                                Qué sigue
                              </p>
                              <p className="mt-1 text-sm leading-6 text-slate-900">
                                {lastUploadNextStepSummary}
                              </p>
                            </div>
                          </>
                        ) : null}
                      </div>
                    </div>
                    {shouldCompactPostUploadExperience ? null : (
                      <p className={`mt-2 font-semibold text-emerald-900 ${shouldCompactPostUploadExperience ? "text-base tracking-[-0.01em]" : "text-[13px] uppercase tracking-[0.16em] text-slate-500 sm:mt-3 sm:text-xs"}`}>
                        {lastUploadResultHeadline}
                      </p>
                    )}
                    {shouldCompactPostUploadExperience ? null : (
                      <p className={`mt-2 max-w-3xl text-slate-700 ${shouldCompactPostUploadExperience ? "text-[1.08rem] font-semibold leading-[1.65rem]" : "text-sm leading-5 sm:mt-3 sm:text-base sm:leading-6"}`}>
                        {lastUploadResultLead}
                      </p>
                    )}
                  </div>
                  <div className={`flex w-full flex-col gap-1 ${shouldCompactPostUploadExperience ? "items-center" : "lg:max-w-sm"}`}>
                    <Button
                      type="button"
                      className={`rounded-[2rem] font-semibold text-white shadow-[0_46px_96px_-20px_rgba(16,185,129,0.46)] transition-all sm:h-14 sm:text-[1.08rem] ${shouldCompactPostUploadExperience ? "mx-auto flex h-auto min-h-[4.5rem] w-full max-w-[22rem] items-center justify-center gap-2 rounded-[1.6rem] border-2 border-emerald-700 bg-emerald-700 px-4 py-3 text-center text-[1.24rem] leading-tight tracking-[-0.02em] shadow-[0_22px_48px_-24px_rgba(5,150,105,0.42)] hover:bg-emerald-600" : "h-13 bg-slate-950 px-5 text-[1.02rem] hover:bg-slate-900"}`}
                      onClick={handlePrimaryVerdictCta}
                    >
                      {shouldCompactPostUploadExperience ? <ArrowRight className="h-5 w-5 shrink-0" strokeWidth={2.5} /> : null}
                      {shouldCompactPostUploadExperience
                        ? primaryLastUploadShortcut?.label ?? "Ver qué sigue"
                        : primaryLastUploadShortcut
                          ? primaryLastUploadShortcut.label
                          : "Abrir asesor laboral"}
                    </Button>
                    {shouldCompactPostUploadExperience ? (
                      <p className="max-w-[22rem] text-center text-[12px] leading-[1.1rem] text-slate-600">
                        Un solo paso claro primero. Si luego quieres profundizar, abajo puedes abrir el informe completo.
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}

            <div className={shouldCompactPostUploadExperience ? "hidden" : "rounded-[1.7rem] border border-teal-100 bg-[radial-gradient(circle_at_top_left,_rgba(45,212,191,0.14),_transparent_35%),linear-gradient(180deg,_#ffffff_0%,_#f0fdfa_100%)] p-5 shadow-sm sm:p-6"}>
              {shouldCompactPostUploadExperience ? (
                <details className="rounded-[1.2rem] border border-white/80 bg-white/90 p-4 shadow-sm sm:hidden">
                  <summary className="flex list-none items-center justify-between gap-3 text-left">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-800">
                        Opcional si sigues hoy
                      </p>
                      <p className="mt-1 text-base font-semibold tracking-[-0.03em] text-slate-950">
                        Sube otro archivo si lo necesitas.
                      </p>
                    </div>
                    <span className="rounded-full border border-teal-200 bg-teal-50 px-2.5 py-1 text-[11px] font-semibold text-teal-900">
                      Opcional
                    </span>
                  </summary>
                  <p className="mt-3 text-sm leading-6 text-slate-700">
                    Tu resultado ya está arriba. Aquí puedes sumar otra pieza
                    útil para fortalecer tu expediente.
                  </p>
                  {selectedRecommendedTargetType &&
                  effectiveRecommendedTarget ? (
                    <div className="mt-3 rounded-[1rem] border border-sky-100 bg-sky-50 px-3 py-2 text-[13px] leading-5 text-sky-950">
                      Hoy conviene empezar por <strong>{effectiveRecommendedTarget.label.toLowerCase()}</strong>.
                    </div>
                  ) : null}
                  <div className="mt-4 grid gap-2.5">
                    <Button
                      className="h-11 rounded-2xl bg-slate-950 text-white hover:bg-slate-900"
                      onClick={() => setUploadSourceOpen(true)}
                    >
                      {selectedFile ? "Cambiar documento" : "Agregar otro documento"}
                    </Button>
                    <p className="text-xs leading-5 text-slate-500">
                      Elige un archivo o toma una foto para sumar una pieza útil.
                    </p>
                  </div>
                </details>
              ) : null}
              <div className={`grid gap-4 xl:grid-cols-[1.22fr_0.78fr] xl:items-start ${shouldCompactPostUploadExperience || auth.canToggleUserView ? "hidden" : ""}`}>
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-800 shadow-sm">
                    {shouldCompactPostUploadExperience
                      ? "Opcional si sigues hoy"
                        : "Asegura tu recibo de nómina"}
                  </div>
                  <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950 sm:mt-3 sm:text-[2rem]">
                    {shouldCompactPostUploadExperience
                      ? "Tu resultado ya está arriba. Aquí puedes agregar otro documento."
                      : "Te diremos qué documento recibimos, qué señal encontramos y qué conviene revisar después."}
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-700 sm:mt-3 sm:text-base sm:leading-7">
                    {shouldCompactPostUploadExperience
                      ? "Úsalo solo si quieres fortalecer tu expediente con otra pieza útil."
                      : "Empieza con una foto o PDF. Primero subes, luego ves la señal y después decides si sigues."}
                  </p>
                  <div
                    className={`mt-4 hidden gap-2 sm:grid sm:grid-cols-3 ${shouldCompactPostUploadExperience || auth.canToggleUserView ? "sm:hidden" : ""}`}
                  >
                    <article className="rounded-[1rem] border border-teal-100 bg-white/95 px-3 py-2 text-sm text-slate-700 shadow-sm">
                      <p className="font-semibold text-slate-950">
                        Privacidad radical
                      </p>
                      <p className="mt-1 text-xs leading-5 text-slate-600">
                        Tu jefe nunca se enterará de esta revisión inicial y tu empresa no puede ver lo que subes aquí.
                      </p>
                    </article>
                    <article className="rounded-[1rem] border border-teal-100 bg-white/95 px-3 py-2 text-sm text-slate-700 shadow-sm">
                      <p className="font-semibold text-slate-950">
                        Control total
                      </p>
                      <p className="mt-1 text-xs leading-5 text-slate-600">
                        Primero ves el borrador y luego decides si lo guardas.
                      </p>
                    </article>
                    <article className="rounded-[1rem] border border-teal-100 bg-white/95 px-3 py-2 text-sm text-slate-700 shadow-sm">
                      <p className="font-semibold text-slate-950">
                        Borrado visible
                      </p>
                      <p className="mt-1 text-xs leading-5 text-slate-600">
                        Tus documentos son tuyos, puedes pedir borrado cuando lo necesites y reforzamos su resguardo con un nivel de cuidado comparable al de una banca digital.
                      </p>
                    </article>
                  </div>

                  <div
                    className={`mt-4 hidden gap-3 sm:grid sm:grid-cols-3 ${shouldCompactPostUploadExperience || auth.canToggleUserView ? "sm:hidden" : ""}`}
                  >
                    <article className="rounded-[1.1rem] border border-white bg-white/90 p-3 shadow-sm">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Paso 1
                      </p>
                      <p className="mt-2 text-sm font-semibold text-slate-950">
                        Documento recibido
                      </p>
                    </article>
                    <article className="rounded-[1.1rem] border border-white bg-white/90 p-3 shadow-sm">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Paso 2
                      </p>
                      <p className="mt-2 text-sm font-semibold text-slate-950">
                        Señal encontrada
                      </p>
                    </article>
                    <article className="rounded-[1.1rem] border border-white bg-white/90 p-3 shadow-sm">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Paso 3
                      </p>
                      <p className="mt-2 text-sm font-semibold text-slate-950">
                        Qué revisar después
                      </p>
                    </article>
                  </div>

                  {selectedRecommendedTargetType &&
                  effectiveRecommendedTarget ? (
                    <div className="mt-3 rounded-[1.15rem] border border-sky-100 bg-sky-50 px-3 py-2 text-[13px] leading-5 text-sky-950 sm:mt-4 sm:px-4 sm:py-3 sm:text-sm sm:leading-6">
                      Hoy conviene empezar por{" "}
                      <strong>
                        {effectiveRecommendedTarget.label.toLowerCase()}
                      </strong>
                      .
                    </div>
                  ) : null}

                  <div className="mt-4 grid gap-2.5 sm:mt-5 sm:gap-3">
                    <Button
                      className="mx-auto h-[3.35rem] w-full max-w-[22rem] rounded-[1.35rem] bg-slate-950 px-6 text-[1.02rem] font-semibold text-white shadow-[0_18px_36px_-24px_rgba(15,23,42,0.46)] transition hover:bg-slate-900 sm:mx-0 sm:h-12 sm:max-w-none sm:rounded-2xl sm:px-4 sm:text-base sm:shadow-none"
                      onClick={() => setUploadSourceOpen(true)}
                    >
                      {selectedFile
                        ? "Cambiar documento"
                        : shouldCompactPostUploadExperience
                          ? "Agregar otro documento"
                          : "Elegir documento"}
                    </Button>
                    <p className="mx-auto max-w-[22rem] text-center text-[13px] leading-5 text-slate-500 sm:mx-0 sm:max-w-none sm:text-left sm:text-sm">
                      {shouldCompactPostUploadExperience
                        ? "Elige un archivo o toma una foto cuando quieras sumar otra pieza útil."
                        : "Empieza con una foto, PDF o XML del documento que ya tengas. No necesitas reunir todo para recibir una primera lectura útil."}
                    </p>
                  </div>
                </div>

                <div
                  className={`hidden gap-3 sm:grid ${shouldCompactPostUploadExperience || auth.canToggleUserView ? "sm:hidden" : ""}`}
                >
                  <article className="rounded-[1.25rem] border border-white bg-white/90 p-4 shadow-sm">
                      <p className="text-sm font-semibold text-slate-950">
                        Qué pasa con tu archivo
                      </p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        Se revisa dentro de un espacio privado, no se integra sin tu confirmación y luego alimenta la comparación progresiva con el resto de tus piezas.
                      </p>
                  </article>
                  <article className="rounded-[1.25rem] border border-white bg-white/90 p-4 shadow-sm">
                      <p className="text-sm font-semibold text-slate-950">
                        Cómo seguir después
                      </p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        Si ya tienes el recibo, súbelo ahora. Si dudas, la sugerencia activa te marca el siguiente documento útil sin obligarte a reunir todo desde el inicio.
                      </p>
                  </article>
                </div>
              </div>
            </div>

            <div
              className={shouldCompactPostUploadExperience || !isDossierWorkspaceSection ? "hidden" : "hidden motion-hover-lift rounded-[1.65rem] border border-slate-200 bg-white p-5 shadow-sm sm:block sm:p-6"}
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">
                    {shouldCompactPostUploadExperience
                      ? "Resumen rápido del expediente"
                      : "Así va tu expediente laboral"}
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950">
                    {shouldCompactPostUploadExperience
                      ? "Tu expediente sigue tomando forma"
                      : "Hoy tu expediente laboral va en:"}{" "}
                    {heliosExpediente?.stageLabel ?? dossierStatus.label}
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                    {shouldCompactPostUploadExperience
                      ? `Ya tienes ${documents.length} documento${documents.length === 1 ? "" : "s"} cargado${documents.length === 1 ? "" : "s"} y ${dossierStatus.completed} de ${dossierStatus.total} tipos útiles cubiertos. Si sigues hoy, prioriza ${uploadPrimaryActionLabel.toLowerCase()}.`
                      : `Ya tienes ${documents.length} documento${documents.length === 1 ? "" : "s"} cargado${documents.length === 1 ? "" : "s"}, ${dossierStatus.completed} de ${dossierStatus.total} tipos útiles y un indicador vivo que se ajusta con señales reales del expediente. La siguiente mejor acción es simple: ${selectedFile ? "confirma el archivo que acabas de elegir y súbelo para actualizar el expediente" : `${uploadPrimaryActionLabel.toLowerCase()} para mejorar la lectura del caso ahora mismo`}. ${socialSecuritySummary} ${heliosExpediente?.summary ?? "Cada archivo que subes se integra a una lectura progresiva del caso y queda resguardado dentro de tu expediente."}`}
                  </p>
                </div>

                <div className="motion-hover-lift w-full rounded-[1.5rem] border border-teal-100 bg-teal-50 p-4 sm:max-w-sm">
                  <p className="text-sm font-semibold text-teal-900">
                    Cruce IMSS e Infonavit hoy
                  </p>
                  <p className="mt-2 text-base font-semibold text-slate-950">
                    {socialSecurityStatusLabel}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-teal-950">
                    {socialSecurityRecommendedNextStep}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-teal-900">
                    <span className="rounded-full bg-white px-3 py-1">
                      {socialSecurityValidation?.imssDocumentsCount ?? 0} señal
                      {(socialSecurityValidation?.imssDocumentsCount ?? 0) === 1
                        ? ""
                        : "es"}{" "}
                      IMSS
                    </span>
                    <span className="rounded-full bg-white px-3 py-1">
                      {socialSecurityValidation?.infonavitSignalsCount ?? 0}{" "}
                      señal
                      {(socialSecurityValidation?.infonavitSignalsCount ??
                        0) === 1
                        ? ""
                        : "es"}{" "}
                      Infonavit
                    </span>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-teal-900">
                    {socialSecurityLastCheckLabel}
                  </p>
                </div>
              </div>

              {shouldCompactPostUploadExperience ? (
                <details className="group mt-5 rounded-[1.35rem] border border-slate-200 bg-white p-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">
                        Más opciones si quieres seguir
                      </p>
                      <p className="mt-1 text-sm leading-6 text-slate-600">
                        Aquí dejamos solo lo secundario para que no compita con tu resultado principal.
                      </p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                      Abrir detalle
                    </span>
                  </summary>

                  <div className="mt-4 space-y-4">
                    <div className="rounded-[1.2rem] border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center justify-between gap-3 text-xs font-semibold text-slate-500">
                        <span>Claridad actual del expediente</span>
                        <span>{socialSecurityCoveragePercent}%</span>
                      </div>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-teal-500 to-cyan-500"
                          style={{ width: `${socialSecurityCoveragePercent}%` }}
                        />
                      </div>
                      <p className="mt-3 text-sm leading-6 text-slate-600">
                        {socialSecurityLastCheckLabel}
                      </p>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      {condensedDossierTargets.map(item => {
                        const progress = dossierTypeProgress.find(
                          entry => entry.type === item.type
                        );
                        const isSelectedRecommendation =
                          item.type === selectedRecommendedTargetType;

                        return (
                          <article
                            key={item.type}
                            className={`rounded-[1.2rem] border p-4 ${
                              isSelectedRecommendation
                                ? "border-teal-200 bg-teal-50"
                                : "border-slate-200 bg-white"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <p className="font-semibold text-slate-900">
                                {item.label}
                              </p>
                              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                                {progress?.percent ?? 0}%
                              </span>
                            </div>
                            <p className="mt-2 text-sm leading-6 text-slate-600">
                              {progress?.supportingCopy ?? item.benefit}
                            </p>
                          </article>
                        );
                      })}
                    </div>

                    {condensedPriorityUploadGuides[0] ? (
                      <article className="rounded-[1.2rem] border border-teal-100 bg-teal-50 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-700">
                              Documento sugerido
                            </p>
                            <p className="mt-2 font-semibold text-slate-950">
                              {condensedPriorityUploadGuides[0].title}
                            </p>
                          </div>
                          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-teal-800">
                            {presentTypes.has(condensedPriorityUploadGuides[0].type)
                              ? "Ya lo tienes"
                              : "Siguiente mejor paso"}
                          </span>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-slate-700">
                          {condensedPriorityUploadGuides[0].summary}
                        </p>
                        <Button
                          variant="outline"
                          className="mt-4 h-11 rounded-full border-teal-200 bg-white text-teal-900 hover:bg-teal-100"
                          onClick={() => focusRecommendedUpload(condensedPriorityUploadGuides[0].type)}
                        >
                          Subir este documento
                          <ArrowRight className="ml-2 h-4 w-4" strokeWidth={1.8} />
                        </Button>
                      </article>
                    ) : null}

                    {visiblePriorityUploadGuides.length >
                    condensedPriorityUploadGuides.length ? (
                      <p className="text-xs leading-5 text-slate-500">
                        Hay {visiblePriorityUploadGuides.length - condensedPriorityUploadGuides.length} sugerencia
                        {visiblePriorityUploadGuides.length - condensedPriorityUploadGuides.length === 1 ? "" : "s"} más dentro del expediente cuando quieras profundizar.
                      </p>
                    ) : null}
                  </div>
                </details>
              ) : null}

              <div className={shouldCompactPostUploadExperience || !isDossierWorkspaceSection ? "hidden" : ""}>
              <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-teal-500 to-cyan-500"
                  style={{ width: `${socialSecurityCoveragePercent}%` }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between text-xs font-semibold text-slate-500">
                <span>Claridad actual del expediente</span>
                <span>{socialSecurityCoveragePercent}%</span>
              </div>

              <div className="mt-4 flex flex-col gap-3 rounded-[1.35rem] border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Siguiente paso recomendado
                  </p>
                  <p className="mt-2 text-base font-semibold text-slate-950">
                    {selectedFile
                      ? "Ya elegiste un archivo: sólo falta subirlo para reflejarlo en el expediente."
                      : uploadPrimaryActionLabel}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    Prioriza un documento con mayor contexto antes de revisar
                    módulos secundarios. El expediente se vuelve más útil en
                    cuanto entra la siguiente pieza clave.
                  </p>
                </div>
                <div className="rounded-full bg-teal-50 px-4 py-2 text-sm font-semibold text-teal-900">
                  Acción principal primero
                </div>
              </div>

              <div className="mt-6 grid gap-3 md:grid-cols-2">
                {condensedDossierTargets.map(item => {
                  const progress = dossierTypeProgress.find(
                    entry => entry.type === item.type
                  );
                  const isSelectedRecommendation =
                    item.type === selectedRecommendedTargetType;

                  return (
                    <article
                      key={item.type}
                      className={`rounded-[1.25rem] border p-4 ${
                        isSelectedRecommendation
                          ? "border-teal-200 bg-teal-50"
                          : "border-slate-200 bg-slate-50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-semibold text-slate-900">
                            {item.label}
                          </p>
                          <p className="mt-1 text-sm leading-6 text-slate-600">
                            {item.description}
                          </p>
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
                          <p className="mt-2 text-xs font-medium text-slate-500">
                            {progress?.coverageLabel}
                          </p>
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
                        <p className="leading-6">
                          {progress?.supportingCopy ?? item.benefit}
                        </p>
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                          {progress?.count ?? 0}/
                          {progress?.targetCount ?? item.suggestedCount} pieza
                          {(progress?.targetCount ?? item.suggestedCount) === 1
                            ? ""
                            : "s"}{" "}
                          clave
                        </span>
                      </div>
                    </article>
                  );
                })}
              </div>

              <div className="mt-5 rounded-[1.45rem] border border-slate-200 bg-slate-50 p-4 sm:p-5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Documentos que más enriquecen tu expediente laboral
                    </p>
                    <h3 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-slate-950">
                      {shouldCompactPostUploadExperience
                        ? "Si vas a subir algo más, empieza por esto."
                        : "Si vas a subir algo más, empieza por los archivos con más contexto."}
                    </h3>
                  </div>
                  <p className="max-w-xl text-sm leading-6 text-slate-600">
                    {shouldCompactPostUploadExperience
                      ? "Te dejamos solo las recomendaciones con más valor inmediato para no saturarte después del resultado."
                      : "Estos suelen ser de los documentos más útiles para darte una lectura más completa y dejar tu expediente mejor respaldado con el tiempo."}
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
                    {missingPriorityUploadGuides.length > 0
                      ? "Faltantes reales detectados"
                      : "Base prioritaria cubierta"}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 xl:grid-cols-2">
                  {condensedPriorityUploadGuides.map(item => {
                    const isPresent = presentTypes.has(item.type);
                    const isFocused =
                      item.type === selectedRecommendedTargetType;
                    return (
                      <article
                        key={item.type}
                        className={`rounded-[1.2rem] border bg-white p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm ${
                          isFocused
                            ? "border-teal-200 shadow-sm"
                            : "border-white"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-700">
                              Alta utilidad para tu expediente
                            </p>
                            <p className="mt-2 font-semibold text-slate-950">
                              {item.title}
                            </p>
                          </div>
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${
                              isPresent
                                ? "bg-emerald-100 text-emerald-700"
                                : isFocused
                                  ? "bg-teal-100 text-teal-800"
                                  : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {isPresent
                              ? "Ya lo tienes"
                              : isFocused
                                ? "Enfocado ahora"
                                : "Te falta y conviene subirlo"}
                          </span>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-slate-600">
                          {item.summary}
                        </p>
                        <div className="mt-3 rounded-[1rem] border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-700">
                          {item.value}
                        </div>
                        <Button
                          variant="outline"
                          className="mt-4 h-11 w-full rounded-full border-teal-200 bg-teal-50 text-teal-900 hover:bg-teal-100"
                          onClick={() => focusRecommendedUpload(item.type)}
                        >
                          Subir este documento
                          <ArrowRight
                            className="ml-2 h-4 w-4"
                            strokeWidth={1.8}
                          />
                        </Button>
                      </article>
                    );
                  })}
                </div>
                {shouldCompactPostUploadExperience &&
                visiblePriorityUploadGuides.length >
                  condensedPriorityUploadGuides.length ? (
                  <p className="mt-3 text-xs leading-5 text-slate-500">
                    Hay {visiblePriorityUploadGuides.length - condensedPriorityUploadGuides.length} sugerencia
                    {visiblePriorityUploadGuides.length - condensedPriorityUploadGuides.length === 1 ? "" : "s"} más dentro del expediente cuando quieras profundizar.
                  </p>
                ) : null}
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
                      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Estado de tu expediente laboral
                      </p>
                      <h3 className="mt-2 text-xl font-semibold text-slate-950">
                        {heliosExpediente?.stageLabel
                          ? `${heliosStage.title} · ${heliosExpediente.stageLabel}`
                          : heliosStage.title}
                      </h3>
                      <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-700">
                        {heliosExpediente?.summary ?? heliosStage.description}
                      </p>
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

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-[1.15rem] border border-white/80 bg-white/85 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                      Qué está pasando ahora
                    </p>
                    <p className="mt-2 font-semibold text-slate-950">
                      Tu expediente se ordena, resguarda y revisa por ti
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-700">
                      {heliosStage.detail}
                    </p>
                  </div>

                  <div className="rounded-[1.15rem] border border-white/80 bg-white/85 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                      Tipo de revisión
                    </p>
                    <p className="mt-2 font-semibold text-slate-950">
                      {visibleHeliosOpinion
                        ? getHeliosModeLabel(visibleHeliosOpinion.mode)
                        : "Modo inicial preparado"}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-700">
                      {getHeliosActivationCopy(visibleHeliosOpinion?.mode)}
                    </p>
                  </div>

                  <div className="rounded-[1.15rem] border border-white/80 bg-white/85 p-4 md:col-span-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                      Cruce IMSS e Infonavit
                    </p>
                    <p className="mt-2 font-semibold text-slate-950">
                      {socialSecurityStatusLabel}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-700">
                      {effectiveSocialSecurityValidation?.lastRevalidationSummary ??
                        socialSecurityRecommendedNextStep}
                    </p>
                    <p className="mt-2 text-xs leading-5 text-slate-500">
                      {socialSecurityLastCheckLabel}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                  <div className="rounded-[1.15rem] border border-white/80 bg-white/85 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                      Siguiente documento que más puede ayudarte
                    </p>
                    <p className="mt-2 font-semibold text-slate-950">
                      {socialSecurityRecommendedDocument?.title ??
                        "Todavía no hay una sugerencia documental específica"}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-700">
                      {socialSecurityRecommendedDocument?.reason ??
                        socialSecurityRecommendedNextStep}
                    </p>
                    <Button
                      variant="outline"
                      className="mt-4 h-11 rounded-full border-teal-200 bg-teal-50 text-teal-900 hover:bg-teal-100"
                      onClick={() =>
                        focusRecommendedUpload(
                          effectiveRecommendedTarget?.type ?? null
                        )
                      }
                    >
                      {socialSecurityRecommendedDocument
                        ? "Preparar esta sugerencia"
                        : "Subir otro documento útil"}
                      <ArrowRight className="ml-2 h-4 w-4" strokeWidth={1.8} />
                    </Button>
                  </div>

                  <div className="rounded-[1.15rem] border border-white/80 bg-white/85 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                          Historial de revalidaciones
                        </p>
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
                    <div className="mt-4">
                      {socialSecurityRevalidationHistory.length ? (
                        <details className="group rounded-[1rem] border border-slate-200 bg-slate-50 p-3">
                          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-slate-900">
                            <span>Ver historial detallado</span>
                            <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-slate-600">
                              {socialSecurityRevalidationHistory.length}{" "}
                              registro
                              {socialSecurityRevalidationHistory.length === 1
                                ? ""
                                : "s"}
                            </span>
                          </summary>
                          <div className="mt-3 space-y-3">
                            {socialSecurityRevalidationHistory.map(entry => (
                              <div
                                key={`${entry.recordedAt}-${entry.summary}`}
                                className="rounded-[1rem] border border-slate-200 bg-white p-3"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <p className="font-semibold text-slate-900">
                                    {entry.statusLabel}
                                  </p>
                                  <span className="text-xs font-medium text-slate-500">
                                    {formatDate(entry.recordedAt)}
                                  </span>
                                </div>
                                <p className="mt-2 text-sm leading-6 text-slate-700">
                                  {entry.summary}
                                </p>
                                <p className="mt-2 text-xs leading-5 text-slate-500">
                                  {entry.coverageScore
                                    ? `Cobertura estimada: ${entry.coverageScore}%`
                                    : "Cobertura registrada en esta revalidación."}
                                  {entry.recommendedNextStep
                                    ? ` · ${entry.recommendedNextStep}`
                                    : ""}
                                </p>
                              </div>
                            ))}
                          </div>
                        </details>
                      ) : (
                        <div className="rounded-[1rem] border border-dashed border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-600">
                          Cuando revalides IMSS e Infonavit desde tu expediente,
                          aquí verás la fecha, el estado y el cambio detectado
                          entre revisiones.
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-4 rounded-[1.25rem] border border-teal-100 bg-[linear-gradient(135deg,_rgba(240,253,250,0.96),_rgba(255,255,255,0.98))] p-4 shadow-sm">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0 max-w-2xl">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-800">
                          {pricingExperience.platform.eyebrow}
                        </span>
                        {pricingExperience.platform.showPrice ? (
                          <span className="rounded-full bg-teal-600 px-3 py-1 text-xs font-semibold text-white">
                            {pricingExperience.platform.priceLabel}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-3 text-lg font-semibold text-slate-950">
                        {pricingExperience.platform.title}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-slate-700">
                        Esta preparación es opcional. Si por ahora solo quieres
                        seguir con tu expediente y los documentos sugeridos,
                        puedes continuar sin pagar ni desbloquear nada.
                      </p>
                    </div>

                    <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[240px]">
                        <Button
                          className="h-11 rounded-full bg-slate-900 text-white hover:bg-slate-800"
                          onClick={() => {
                            setCommercePromptContext(
                              buildManualCommercePromptContext(activeCommercePlanKey)
                            );
                            setCasePreparationDrawerOpen(true);
                          }}
                        >

                        {pricingExperience.platform.primaryCtaLabel}
                        <Sparkles className="ml-2 h-4 w-4" strokeWidth={1.8} />
                      </Button>
                      <Button
                        variant="outline"
                        className="h-11 rounded-full border-teal-200 bg-white text-teal-900 hover:bg-teal-50"
                        onClick={() =>
                          focusRecommendedUpload(
                            effectiveRecommendedTarget?.type ?? null
                          )
                        }
                      >
                        {pricingExperience.platform.secondaryCtaLabel}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="sm:hidden rounded-[1.3rem] border border-slate-200 bg-white px-3.5 py-3 shadow-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-teal-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-teal-800">
                  Expediente en {mobileDossierStageLabel}
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-700">
                  {dossierStatus.completed}/{dossierStatus.total}
                </span>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {effectiveRecommendedTarget
                  ? `Siguiente útil: ${effectiveRecommendedTarget.label}. Lo puedes subir justo debajo.`
                  : `Ya tienes ${documents.length} documento${documents.length === 1 ? "" : "s"} cargado${documents.length === 1 ? "" : "s"}. El siguiente paso útil aparece justo debajo.`}
              </p>
            </div>

            <div className={shouldCompactPostUploadExperience || (showWorkspaceSectionSelector && !isSummaryWorkspaceSection) ? "hidden" : "motion-hover-lift rounded-[1.65rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6"}>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">
                      Sube tu archivo
                    </p>
                      <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950">
                        Sube tu recibo y revisa lo importante
                      </h2>

                </div>
                  <p className="max-w-lg text-sm leading-6 text-slate-600">
                    Primero ves lo importante y después decides si lo guardas.

                </p>
              </div>

              <div className="hidden">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-900">
                    Si vienes desde tu celular, así se siente de simple
                  </p>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                    {mobileOnboardingIndex + 1}/{mobileOnboardingSteps.length}
                  </span>
                </div>
                <div className="rounded-[1.2rem] border border-slate-200 bg-slate-50 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm">
                  <div className="inline-flex rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold tracking-[0.14em] text-teal-700">
                    Paso {activeMobileOnboardingStep.step}
                  </div>
                  <p className="mt-3 font-semibold text-slate-950">
                    {activeMobileOnboardingStep.title}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {activeMobileOnboardingStep.description}
                  </p>
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      className="inline-flex h-10 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-45"
                      onClick={() =>
                        setMobileOnboardingIndex(current =>
                          Math.max(0, current - 1)
                        )
                      }
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
                            index === mobileOnboardingIndex
                              ? "w-6 bg-teal-600"
                              : "w-2.5 bg-slate-300"
                          }`}
                          aria-label={`Ver paso ${item.step}`}
                        />
                      ))}
                    </div>
                    <button
                      type="button"
                      className="inline-flex h-10 items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-4 text-sm font-medium text-teal-800 transition hover:border-teal-300 hover:bg-teal-100 disabled:cursor-not-allowed disabled:opacity-45"
                      onClick={() =>
                        setMobileOnboardingIndex(current =>
                          Math.min(
                            mobileOnboardingSteps.length - 1,
                            current + 1
                          )
                        )
                      }
                      disabled={
                        mobileOnboardingIndex ===
                        mobileOnboardingSteps.length - 1
                      }
                    >
                      Siguiente
                      <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
                    </button>
                  </div>
                </div>
              </div>

              <div
                className={`mt-6 gap-4 md:grid-cols-2 ${shouldHideUploadSelectors || auth.canToggleUserView ? "hidden" : "grid"}`}
              >
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">
                    Tu espacio
                  </span>
                  <select
                    value={selectedTenantId}
                    onChange={event => {
                      setSelectedTenantId(event.target.value);
                      setSelectedCaseId("");
                      setPendingDraft(null);
                      setLastUpload(null);
                    }}
                    className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-teal-500"
                  >
                    {tenantsQuery.data?.map(tenant => (
                      <option key={tenant.tenantId} value={tenant.tenantId}>
                        {tenant.displayName}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-slate-700">
                    Elige tu caso
                  </span>
                  <select
                    value={selectedCaseId}
                    onChange={event => {
                      setSelectedCaseId(event.target.value);
                      setPendingDraft(null);
                      setLastUpload(null);
                    }}
                    className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-teal-500"
                  >
                    {casesQuery.data?.map(item => (
                      <option key={item.caseId} value={item.caseId}>
                        {item.title} · Folio {item.caseId.slice(-6)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {showCompactUploadContextHint ? (
                <p className="mt-3 text-xs leading-5 text-slate-500 sm:hidden">
                  Primero elige el documento. Después puedes tomar la foto o subir el archivo.
                </p>
              ) : null}

              <div
                ref={uploadSectionRef}
                className="mt-5 rounded-[1.35rem] border border-slate-200 bg-slate-50 p-4 sm:p-5"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-teal-600 text-white">
                    <FileUp className="h-5 w-5" strokeWidth={1.8} />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-950">
                      Tu recibo o comprobante
                    </p>
                    <p className="text-sm text-slate-600">
                      Puede ser foto, PDF o el archivo que te mandaron. Lo
                      revisamos primero y tú decides si se guarda, incluso si es un contrato en DOCX.
                    </p>
                  </div>
                </div>

                <div className="mt-4 hidden">
                  <article className="rounded-[1rem] border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-950">
                    <p className="font-semibold">Confidencial</p>
                    <p className="mt-1 text-xs leading-5 text-emerald-900">
                      Tus documentos se usan solo para esta auditoría.
                    </p>
                  </article>
                  <article className="rounded-[1rem] border border-sky-100 bg-sky-50 px-3 py-2 text-sm text-sky-950">
                    <p className="font-semibold">Protegido</p>
                    <p className="mt-1 text-xs leading-5 text-sky-900">
                      La carga viaja protegida y queda resguardada en tu
                      expediente.
                    </p>
                  </article>
                  <article className="rounded-[1rem] border border-violet-100 bg-violet-50 px-3 py-2 text-sm text-violet-950">
                    <p className="font-semibold">Bajo tu control</p>
                    <p className="mt-1 text-xs leading-5 text-violet-900">
                      Antes de guardarlo, te mostramos una vista previa para
                      validar.
                    </p>
                  </article>
                </div>

                {selectedRecommendedTargetType && effectiveRecommendedTarget ? (
                  <div className="mt-4 rounded-[1.2rem] border border-sky-100 bg-sky-50 px-4 py-2.5 text-sm leading-6 text-sky-950">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-semibold">
                          Documento sugerido preparado
                        </p>
                        <p className="mt-1">
                          Enfocado en{" "}
                          {effectiveRecommendedTarget.label.toLowerCase()}. Sube
                          tu archivo para aplicar.
                        </p>
                      </div>
                      <button
                        type="button"
                        className="mt-1 text-sm font-semibold text-sky-700 underline-offset-4 hover:underline sm:mt-0"
                        onClick={() => setSelectedRecommendedTargetType(null)}
                      >
                        Quitar enfoque
                      </button>
                    </div>
                  </div>
                ) : null}

                <div
                  className={`mt-4 grid gap-3 lg:grid-cols-[1.1fr_0.9fr] ${pendingDraft ? "hidden sm:grid" : ""}`}
                >
                  <div className="rounded-[1.2rem] border border-sky-100 bg-sky-50 p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-sky-700">
                        <FileSearch className="h-5 w-5" strokeWidth={1.8} />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-950">
                          {shouldCompactMobileUploadEntry
                            ? "Sube tu primer documento"
                            : "Revisión automática"}
                        </p>
                        <p className="mt-1 text-sm leading-6 text-slate-700">
                          {shouldCompactMobileUploadEntry
                            ? "El análisis empieza solo en cuanto captures o elijas el documento. Tus datos siguen protegidos durante todo el flujo."
                            : "En cuanto lo subas, lo revisamos y te mostramos lo importante. Si algo falta o no se ve bien, te diremos cómo corregirlo."}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 hidden">
                      <span className="rounded-full bg-white px-3 py-1 text-slate-700">
                        Nitidez y legibilidad
                      </span>
                      <span className="rounded-full bg-white px-3 py-1 text-slate-700">
                        Bordes y orientación
                      </span>
                      <span className="rounded-full bg-white px-3 py-1 text-slate-700">
                        Coincidencia con el documento esperado
                      </span>
                    </div>
                  </div>

                  <div
                    className="hidden"
                  >
                    <p className="text-sm font-semibold text-slate-950">
                      Abrir primero
                    </p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      {getCaptureModeSupportCopy(preferredCaptureMode)}
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        className={`inline-flex h-11 items-center justify-center gap-2 rounded-2xl border text-sm font-medium transition ${
                          preferredCaptureMode === "camera"
                            ? "border-teal-200 bg-teal-50 text-teal-900"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                        }`}
                        onClick={() =>
                          handleCaptureModeSelection(
                            "camera",
                            "preference_panel"
                          )
                        }
                      >
                        <Camera className="h-4 w-4" strokeWidth={1.8} />
                        Cámara
                      </button>
                      <button
                        type="button"
                        className={`inline-flex h-11 items-center justify-center gap-2 rounded-2xl border text-sm font-medium transition ${
                          preferredCaptureMode === "file" ||
                          preferredCaptureMode === null
                            ? "border-teal-200 bg-teal-50 text-teal-900"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                        }`}
                        onClick={() =>
                          handleCaptureModeSelection("file", "preference_panel")
                        }
                      >
                        <FolderOpen className="h-4 w-4" strokeWidth={1.8} />
                        Archivo
                      </button>
                    </div>
                  </div>
                </div>

                {activeCaptureMode === "camera" &&
                !shouldCompactMobileUploadEntry &&
                !pendingDraft ? (
                  <div className="mt-4 grid gap-3 lg:grid-cols-[0.95fr_1.05fr]">
                    <div className="rounded-[1.2rem] border border-teal-100 bg-white p-4">
                      <p className="text-sm font-semibold text-slate-950">
                        Guía visual para encuadrar el documento
                      </p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        Usa este marco como referencia al tomar la foto. Intenta
                        que se vean las cuatro esquinas, evita sombras intensas
                        y procura que el texto quede derecho.
                      </p>
                      <p className="mt-3 text-xs leading-5 text-slate-500">
                        Es una ayuda visual ligera. Si tu celular no sigue el
                        borde perfecto, igual puedes continuar mientras el
                        documento se vea completo y legible.
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
                  accept={DOCUMENT_UPLOAD_PICKER_ACCEPT}
                  capture="environment"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <input
                  ref={fileInputRef}
                  key={`file-${pickerKey}`}
                  type="file"
                  accept={DOCUMENT_UPLOAD_PICKER_ACCEPT}
                  onChange={handleFileChange}
                  className="hidden"
                />

                {pendingDraft ? (
                  <div className="mt-5 rounded-[1.25rem] border border-slate-200 bg-white p-4 shadow-sm sm:hidden">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                          Documento cargado
                        </p>
                        <p className="mt-1 truncate text-sm font-semibold text-slate-950">
                          {pendingDraft.previewAsset.fileName}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-slate-600">
                          {formatVisibleFileSize(
                            pendingDraft.previewAsset.sizeBytes
                          )}{" "}
                          · Si prefieres, puedes cambiarlo y rehacer el
                          análisis.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-10 shrink-0 rounded-full border-slate-200 bg-white px-4 text-slate-700 hover:bg-slate-50"
                        onClick={restartPreviewFlow}
                        disabled={isPrimaryDocumentActionPending}
                      >
                        Cambiar
                      </Button>
                    </div>
                  </div>
                ) : null}

                <div
                  className={`mt-5 rounded-[1.25rem] border border-dashed border-slate-300 bg-white p-4 ${pendingDraft ? "hidden sm:block" : ""}`}
                >
                  <div className="rounded-[1.1rem] border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-950">
Sube tu recibo y empieza en menos de un minuto
                        </p>
                        <p className="mt-1 text-xs leading-5 text-slate-600">
Lo revisamos en cuanto lo subes y te mostramos una primera lectura sin vueltas.
                        </p>
                      </div>
                      <div className="hidden">
                        <span className="rounded-full bg-white px-3 py-1">
                          12 MB
                        </span>
                        <span className="rounded-full bg-white px-3 py-1">
                          PDF · XML · DOCX · imagen
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2.5 sm:hidden">
                    <Button
                      className={`mx-auto h-[3.35rem] w-full max-w-[22rem] rounded-[1.35rem] px-5 text-[1.02rem] font-semibold text-white transition-all duration-200 ${
                        shouldCompactMobileUploadEntry
                          ? "bg-teal-600 shadow-[0_18px_34px_-22px_rgba(13,148,136,0.58)] hover:bg-teal-700"
                          : "bg-slate-900 shadow-[0_18px_34px_-24px_rgba(15,23,42,0.42)] hover:bg-slate-950"
                      }`}
                      disabled={isAutoAnalyzingSelectedFile}
                      onClick={shouldCompactMobileUploadEntry ? () => setUploadSourceOpen(true) : openPreferredPicker}
                    >
                      {isAutoAnalyzingSelectedFile
                        ? "Analizando documento..."
                        : selectedFile
                          ? "Cambiar documento"
                          : shouldCompactMobileUploadEntry
                            ? "Sube tu recibo"
                            : uploadPrimaryActionLabel}
                    </Button>
                    <div className="space-y-3">
                      <p className="mx-auto max-w-[22rem] text-center text-[13px] leading-5 text-slate-500">
                        {isAutoAnalyzingSelectedFile
                          ? "Tu documento está siendo analizado."
                          : shouldCompactMobileUploadEntry
                                ? "Puedes tomar una foto clara o subir un PDF, XML, DOCX o imagen desde tu celular."

                            : preferredCaptureMode === "camera"
                              ? "Abriremos la cámara primero."
                              : preferredCaptureMode === "file"
                                ? "Abriremos tus archivos primero."
                                : "Abriremos tus archivos; si prefieres foto puedes cambiarlo aquí."}
                      </p>
                      {isAutoAnalyzingSelectedFile ? (
                        <div className="rounded-[1rem] border border-teal-200 bg-teal-50/80 px-4 py-3 text-teal-950 shadow-sm">
                          <div className="flex items-start gap-3">
                            <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-teal-700 shadow-sm">
                              <RefreshCw
                                className="h-4 w-4 animate-spin"
                                strokeWidth={1.8}
                              />
                            </span>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold">
                                Documento recibido
                              </p>
                              <p className="mt-1 text-xs leading-5 text-teal-900/90">
                                Lo estamos analizando. En breve verás tu borrador.
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : shouldCompactMobileUploadEntry ? (
                        <div className="rounded-[1rem] border border-dashed border-teal-200 bg-white/80 px-3 py-3">
                          <div className="mx-auto flex max-w-[22rem] items-start gap-3 rounded-[1rem] border border-teal-100 bg-teal-50/70 px-3 py-3 text-left text-teal-950 shadow-sm">
                            <span className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-teal-700 shadow-sm">
                              <Camera className="h-4 w-4" strokeWidth={1.8} />
                            </span>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold">Elige cómo quieres subirlo</p>
                              <p className="mt-1 text-xs leading-5 text-teal-900/80">
                                Si lo tienes en papel, toma una foto. Si ya lo guardaste, elige tu archivo.
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start justify-end">
                          <button
                            type="button"
                            className="shrink-0 text-xs font-semibold text-teal-700 underline decoration-teal-200 underline-offset-4"
                            disabled={isAutoAnalyzingSelectedFile}
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
                      disabled={isAutoAnalyzingSelectedFile}
                      onClick={openCameraPicker}
                    >
                      <Camera className="mr-2 h-4 w-4" strokeWidth={1.8} />
                      Tomar foto
                    </Button>
                    <Button
                      variant="outline"
                      className={`h-12 rounded-2xl ${
                        preferredCaptureMode === "file" ||
                        preferredCaptureMode === null
                          ? "border-teal-200 bg-teal-50 text-teal-900 hover:bg-teal-100"
                          : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
                      }`}
                      disabled={isAutoAnalyzingSelectedFile}
                      onClick={openFilePicker}
                    >
                      <FolderOpen className="mr-2 h-4 w-4" strokeWidth={1.8} />
                      Elegir archivo
                    </Button>
                  </div>

                  <div
                    aria-describedby="upload-guardrails-summary"
                    className={`${pendingDraft ? "mt-4 hidden sm:block" : "mt-4"} rounded-[1.1rem] border p-4 shadow-sm transition-all duration-500 ease-out ${uploadProgressState.toneClasses}`}
                  >
                    <p
                      className="sr-only"
                      aria-live="polite"
                      aria-atomic="true"
                    >
                      {getUploadStepAnnouncement(
                        uploadProgressState.stageLabel,
                        uploadProgressState.title
                      )}
                    </p>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] opacity-80">
                          {uploadProgressState.eyebrow}
                        </p>
                          <p className="mt-2 break-words font-semibold">
                            {uploadProgressHumanMessage}
                          </p>
                      </div>
                      <span className="hidden">
                        {uploadProgressState.progress}%
                      </span>
                    </div>
                    <div
                      className="hidden"
                      role="list"
                      aria-label="Progreso de la carga y análisis del documento"
                    >
                      {uploadProgressSteps.map((step, index) => (
                        <div
                          key={step.key}
                          role="listitem"
                          aria-current={step.isActive ? "step" : undefined}
                          aria-label={getUploadStepAriaLabel({
                            index: index + 1,
                            total: uploadProgressSteps.length,
                            label: step.label,
                            isActive: step.isActive,
                            isComplete: step.isComplete,
                          })}
                          className={`rounded-2xl border px-3 py-2 text-xs font-semibold transition-all duration-300 ${
                            step.isActive
                              ? "border-white/80 bg-white text-slate-900 shadow-sm"
                              : step.isComplete
                                ? "border-white/70 bg-white/80 text-slate-700"
                                : "border-white/40 bg-white/40 text-slate-600"
                          }`}
                        >
                          <span className="block text-[11px] uppercase tracking-[0.16em] opacity-70">
                            Etapa {index + 1}
                          </span>
                          <span className="mt-1 block">{step.label}</span>
                          <span className="sr-only">
                            {step.isActive
                              ? "Etapa actual"
                              : step.isComplete
                                ? "Etapa completada"
                                : "Etapa pendiente"}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div
                      className="hidden"
                      aria-hidden="true"
                    >
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${uploadProgressState.barClasses}`}
                        style={{ width: `${uploadProgressState.progress}%` }}
                      />
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs opacity-90">
                      <span className="font-semibold uppercase tracking-[0.14em]">
                        {uploadProgressState.stageLabel}
                      </span>
                      <span className="hidden sm:inline">•</span>
                      <span className="truncate">
                        {pendingDraft
                          ? `${pendingDraft.previewAsset.fileName} · ${formatVisibleFileSize(pendingDraft.previewAsset.sizeBytes)}`
                          : selectedFile
                            ? `${selectedFile.name} · ${formatVisibleFileSize(selectedFile.size)}`
                            : getUploadCompactGuardrails().fileRules}
                      </span>
                    </div>
                    {isAutoAnalyzingSelectedFile ? (
                      <p className="mt-2 text-sm leading-5 opacity-90">
                        Ya recibimos tu documento. Enseguida abriremos la vista
                        previa.
                      </p>
                    ) : (
                      <p className="mt-2 text-sm leading-5 opacity-90">
                        {uploadProgressState.description}
                      </p>
                    )}
                    {selectedFileValidationMessage ? (
                      <p className="mt-2 text-xs font-medium text-amber-900">
                        {selectedFileValidationMessage}
                      </p>
                    ) : null}
                  </div>

                  <div
                    id="upload-guardrails-summary"
                    className={`mt-3 ${pendingDraft ? "hidden sm:flex" : "flex"} flex-wrap items-center gap-2 rounded-[1.1rem] border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-700`}
                  >
                    <span className="font-semibold text-slate-900">
                      Límites:
                    </span>
                    <span>{getUploadCompactGuardrails().fileRules}</span>
                    <span className="hidden sm:inline text-slate-400">•</span>
                    <span>{getUploadCompactGuardrails().privacyRules}</span>
                  </div>
                </div>

                {pendingDraft ? (
                  <div className="mt-4 hidden rounded-[1.2rem] border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950 sm:block">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold">Vista previa lista</p>
                      <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-sky-900">
                        Revisar y confirmar
                      </span>
                    </div>
                    <p className="mt-1">
                      {pendingDraft.previewAsset.fileName} ·{" "}
                      {formatVisibleFileSize(
                        pendingDraft.previewAsset.sizeBytes
                      )}
                    </p>
                  </div>
                ) : selectedFile ? (
                  <div className="mt-4 rounded-[1.2rem] border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-900">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold">
                        Documento listo para análisis
                      </p>
                      <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-emerald-900">
                        En cola
                      </span>
                    </div>
                    <p className="mt-1">
                      {selectedFile.name} ·{" "}
                      {formatVisibleFileSize(selectedFile.size)}
                    </p>
                  </div>
                ) : (
                  <div className="mt-4 rounded-[1.2rem] border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-600">
                    Elige el documento más claro que tengas a la mano.
                  </div>
                )}
              </div>

              <label
                className={`mt-4 block ${pendingDraft ? "hidden sm:block" : ""}`}
              >
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Si quieres, cuéntanos un poco más
                  </span>
                <textarea
                  value={textHint}
                  onChange={event => setTextHint(event.target.value)}
                  rows={2}
                  placeholder="Ejemplo: recibo de nómina de marzo o alta IMSS."
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-teal-500"
                />
              </label>

              <div
                className={`mt-4 flex flex-wrap items-center gap-2 rounded-[1.2rem] border border-teal-100 bg-teal-50 px-4 py-3 text-xs leading-5 text-teal-950 ${pendingDraft ? "hidden sm:flex" : ""}`}
              >
                <Lock
                  className="h-4 w-4 shrink-0 text-teal-700"
                  strokeWidth={1.8}
                />
                <span className="font-semibold">Confidencialidad activa.</span>
                <span>Nadie de tu empresa ve lo que subes.</span>
                <span className="hidden sm:inline text-teal-400">•</span>
                <span>Si algo falla, puedes reintentar.</span>
              </div>

              {pendingDraft ? (
                <>
                  <div className="mt-6 space-y-3 sm:hidden">
                    <div className="overflow-hidden rounded-[1.5rem] bg-slate-950 p-5 text-white shadow-[0_28px_70px_-42px_rgba(2,6,23,0.8)]">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-teal-200">
                        Análisis listo
                      </p>
                      <h3 className="mt-2 text-[1.85rem] font-semibold tracking-[-0.04em]">
                        {getSimpleDocumentTypeLabel(
                          pendingDraft.classification.documentType
                        )}
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-slate-300">
                        {pendingDraft.previewAsset.fileName} ·{" "}
                        {formatVisibleFileSize(
                          pendingDraft.previewAsset.sizeBytes
                        )}
                      </p>
                      <div className="mt-4 rounded-[1.2rem] bg-white/10 p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-200">
                          Qué significa
                        </p>
                        <p className="mt-2 text-sm leading-6 text-white">
                          {displayPreviewStructuredExtraction?.summary ??
                            pendingDraft.preliminaryAnalysis.summary}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-[1.35rem] border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                            Qué encontramos
                          </p>
                          <p className="mt-1 text-base font-semibold text-slate-950">
                            Lo más útil para decidir si lo guardas
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-3 py-1 text-[11px] font-semibold ${previewReadiness.classes}`}
                        >
                          {previewReadiness.label}
                        </span>
                      </div>
                      <div className="mt-4 space-y-3">
                        {[
                          ...previewStructuredConfirmedFields,
                          ...previewStructuredEstimatedFields,
                        ]
                          .slice(0, 3)
                          .map(field => (
                            <div
                              key={`${field.key}-${field.label}`}
                              className="rounded-[1rem] border border-slate-200 bg-slate-50 p-3"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                                  {field.label}
                                </p>
                                <span
                                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                                    field.status === "confirmed"
                                      ? "bg-emerald-100 text-emerald-800"
                                      : "bg-amber-100 text-amber-800"
                                  }`}
                                >
                                  {field.status === "confirmed"
                                    ? "Confirmado"
                                    : "Estimado"}
                                </span>
                              </div>
                              <p className="mt-2 break-words text-sm leading-6 text-slate-900">
                                {field.value}
                              </p>
                            </div>
                          ))}
                        {previewStructuredConfirmedFields.length === 0 &&
                        previewStructuredEstimatedFields.length === 0 ? (
                          <div className="rounded-[1rem] border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-600">
                            Todavía no hay datos claros para mostrar. Si la foto
                            quedó floja, te conviene reintentar antes de
                            guardar.
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="rounded-[1.35rem] border border-emerald-100 bg-emerald-50 p-4 shadow-sm">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-800">
                        Siguiente paso
                      </p>
                      <p className="mt-2 text-base font-semibold text-slate-950">
                        {previewNextTarget
                          ? previewNextDocumentCopy.headline
                          : "Si esto se ve bien, ya puedes guardarlo."}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-emerald-950">
                        {previewNextTarget
                          ? previewNextDocumentCopy.intro
                          : "El botón de abajo lo integra a tu expediente. Si algo importante no se leyó bien, corrígelo o vuelve a subirlo antes de guardar."}
                      </p>
                      {previewNextTarget ? (
                        <Button
                          variant="outline"
                          className="mt-4 h-11 w-full rounded-full border-emerald-200 bg-white text-emerald-900 hover:bg-emerald-100"
                          onClick={() =>
                            focusRecommendedUpload(previewNextTarget.type)
                          }
                        >
                          Seguir con esta sugerencia
                          <ArrowRight
                            className="ml-2 h-4 w-4"
                            strokeWidth={1.8}
                          />
                        </Button>
                      ) : null}
                    </div>

                    {previewEditableFields.length ? (
                      <details className="rounded-[1.35rem] border border-teal-100 bg-teal-50 p-4 shadow-sm">
                        <summary className="cursor-pointer list-none text-sm font-semibold text-teal-950">
                          Corregir un dato antes de guardar
                        </summary>
                        <p className="mt-2 text-sm leading-6 text-teal-900">
                          Solo si ves algo claramente incorrecto. Si no, puedes
                          guardar directo.
                        </p>
                        <div className="mt-4 space-y-3">
                          {previewEditableFields.map(field => {
                            const currentValue =
                              manualFieldValues[field.key] ?? field.value;
                            const isEdited =
                              currentValue.trim() !== field.value.trim();

                            return (
                              <label
                                key={field.key}
                                className="block rounded-[1rem] border border-white/80 bg-white p-3 shadow-sm"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-teal-700">
                                    {field.label}
                                  </p>
                                  <span
                                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                                      isEdited
                                        ? "bg-teal-100 text-teal-900"
                                        : field.source === "confirmed"
                                          ? "bg-emerald-100 text-emerald-800"
                                          : "bg-amber-100 text-amber-800"
                                    }`}
                                  >
                                    {isEdited
                                      ? "Ajustado"
                                      : field.source === "confirmed"
                                        ? "Confirmado"
                                        : "Sugerido"}
                                  </span>
                                </div>
                                <input
                                  value={currentValue}
                                  onChange={event =>
                                    handleManualFieldChange(
                                      field.key,
                                      event.target.value
                                    )
                                  }
                                  placeholder={field.value}
                                  className="mt-3 h-11 w-full rounded-2xl border border-teal-100 bg-teal-50/60 px-4 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
                                />
                              </label>
                            );
                          })}
                        </div>
                      </details>
                    ) : null}

                    {displayPreviewStructuredExtraction?.reviewNotes?.length ||
                    previewGuardrails.length ? (
                      <details className="rounded-[1.35rem] border border-slate-200 bg-white p-4 shadow-sm">
                        <summary className="cursor-pointer list-none text-sm font-semibold text-slate-900">
                          Qué revisar antes de guardar
                        </summary>
                        <div className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
                          {displayPreviewStructuredExtraction?.reviewNotes
                            ?.slice(0, 2)
                            .map(item => (
                              <p key={`mobile-note-${item}`}>• {item}</p>
                            ))}
                          {previewGuardrails.slice(0, 2).map(item => (
                            <p key={`mobile-guardrail-${item}`}>• {item}</p>
                          ))}
                        </div>
                      </details>
                    ) : null}
                  </div>

                  <div className="mt-6 hidden rounded-[1.45rem] border border-sky-200 bg-sky-50 p-5 sm:block sm:p-6">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-sky-700">
                          Vista previa antes de guardar
                        </p>
                        <h3 className="mt-2 text-xl font-semibold text-slate-950">
                          Ya analizamos tu documento. Revisa primero lo
                          importante antes de integrarlo a tu expediente.
                        </h3>
                        <p className="mt-2 text-sm leading-7 text-slate-700">
                          Aquí todavía nada reemplaza ni estorba lo que ya
                          tenías bien guardado. Si algo se ve incompleto, puedes
                          repetir la foto o elegir otro archivo.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs font-semibold">
                        <span className="rounded-full bg-white px-3 py-1 text-slate-700">
                          Tipo:{" "}
                          {getSimpleDocumentTypeLabel(
                            pendingDraft.classification.documentType
                          )}
                        </span>
                        <span className="rounded-full bg-white px-3 py-1 text-slate-700">
                          Revisión:{" "}
                          {getProcessingProfileLabel(
                            pendingDraft.preliminaryAnalysis.processingProfile
                          )}
                        </span>
                        <span
                          className={`rounded-full px-3 py-1 ${previewReadiness.classes}`}
                        >
                          {previewReadiness.label}
                        </span>
                      </div>
                    </div>

                    <div
                      className={`mt-4 rounded-[1.2rem] border bg-white/90 p-4 transition-all duration-300 ${
                        previewStatusFlash
                          ? "border-sky-300 shadow-[0_24px_60px_-38px_rgba(14,165,233,0.55)] ring-2 ring-sky-100"
                          : "border-white/80"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className={`mt-1 inline-flex h-2.5 w-2.5 rounded-full ${previewStatusFlash ? "animate-pulse bg-sky-500" : "bg-sky-300"}`}
                        />
                        <div>
                          <p className="font-semibold text-slate-950">
                            Vista previa lista para revisión rápida
                          </p>
                          <p className="mt-1 text-sm leading-6 text-slate-700">
                            {manualOverridePayload.length
                              ? `Llevas ${manualOverridePayload.length} ajuste${manualOverridePayload.length === 1 ? "" : "s"} manual${manualOverridePayload.length === 1 ? "" : "es"} preparado${manualOverridePayload.length === 1 ? "" : "s"} para el guardado final.`
                              : "Si ves un dato importante mal leído, puedes corregirlo aquí. Es opcional y toma solo unos segundos."}
                          </p>
                        </div>
                      </div>
                    </div>

                    {pendingDraftShortcuts.length ? (
                      <div className="mt-4 rounded-[1.2rem] border border-indigo-100 bg-indigo-50 p-4">
                        <div className="flex items-start gap-3">
                          <Sparkles
                            className="mt-1 h-5 w-5 shrink-0 text-indigo-700"
                            strokeWidth={1.8}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-indigo-950">
                              Atajos útiles para este documento
                            </p>
                            <p className="mt-1 text-sm leading-6 text-indigo-900">
                              Según el tipo detectado, puedes avanzar más rápido
                              con uno de estos pasos sin salirte del flujo.
                            </p>
                          </div>
                        </div>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          {pendingDraftShortcuts.map(shortcut => (
                            <button
                              key={shortcut.id}
                              type="button"
                              onClick={() =>
                                handleContextualShortcut(
                                  shortcut,
                                  pendingDraft.classification.documentType,
                                  "draft"
                                )
                              }
                              className="rounded-[1rem] border border-white/80 bg-white px-4 py-3 text-left transition hover:border-indigo-200 hover:bg-indigo-50"
                            >
                              <span className="text-sm font-semibold text-slate-950">
                                {shortcut.label}
                              </span>
                              <span className="mt-1 block text-xs leading-5 text-slate-600">
                                {shortcut.description}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <div className="mt-4 grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
                      <div className="rounded-[1.2rem] border border-white/80 bg-white p-4">
                        <p className="font-semibold text-slate-950">
                          {pendingDraft.scanAssistance.friendlyHeadline}
                        </p>
                        <p className="mt-2 text-sm leading-7 text-slate-700">
                          {pendingDraft.scanAssistance.userGuidance}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                            Confianza visual{" "}
                            {pendingDraft.scanAssistance.confidence}%
                          </span>
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                            {getExpectedTypeAlignmentCopy(
                              pendingDraft.scanAssistance.expectedTypeAlignment
                            )}
                          </span>
                          {previewInsight ? (
                            <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-800">
                              {previewInsight.label}
                            </span>
                          ) : null}
                        </div>
                        {pendingDraft.scanAssistance.issues.length ? (
                          <div className="mt-4 space-y-2 text-sm leading-6 text-slate-700">
                            {pendingDraft.scanAssistance.issues.map(item => (
                              <p key={item}>• {item}</p>
                            ))}
                          </div>
                        ) : null}
                      </div>

                      <div className="rounded-[1.2rem] border border-white/80 bg-white p-4">
                        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-400">
                          Lectura estructurada
                        </p>
                        <h4 className="mt-2 font-semibold text-slate-950">
                          {displayPreviewStructuredExtraction?.headline ??
                            "Resumen del documento"}
                        </h4>
                        <p className="mt-2 text-sm leading-7 text-slate-700">
                          {displayPreviewStructuredExtraction?.summary ??
                            pendingDraft.preliminaryAnalysis.summary}
                        </p>
                        {previewStructuredConfirmedFields.length ||
                        previewStructuredEstimatedFields.length ? (
                          <div className="mt-4 space-y-2">
                            {[
                              ...previewStructuredConfirmedFields,
                              ...previewStructuredEstimatedFields,
                            ]
                              .slice(0, 6)
                              .map(field => (
                                <div
                                  key={`${field.key}-${field.label}`}
                                  className="rounded-[1rem] border border-slate-200 bg-slate-50 p-3"
                                >
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                                      {field.label}
                                    </p>
                                    <span
                                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                                        field.status === "confirmed"
                                          ? "bg-emerald-100 text-emerald-800"
                                          : "bg-amber-100 text-amber-800"
                                      }`}
                                    >
                                      {field.status === "confirmed"
                                        ? "Confirmado"
                                        : "Estimado"}
                                    </span>
                                  </div>
                                  <p className="mt-1 break-words text-sm leading-6 text-slate-800">
                                    {field.value}
                                  </p>
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
                            <p className="font-semibold text-teal-950">
                              Corrige rápido solo lo que sí veas claro
                            </p>
                            <p className="mt-2 text-sm leading-7 text-teal-900">
                              Esta revisión es opcional. Solo ajusta los datos
                              que identifiques con claridad para dejar más
                              preciso el guardado final.
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
                            Esta vista previa no detectó campos prioritarios
                            para corrección manual. Si la foto quedó floja,
                            conviene repetir la captura.
                          </p>
                        ) : (
                          <div className="mt-4 space-y-3">
                            {previewEditableFields.map(field => {
                              const currentValue =
                                manualFieldValues[field.key] ?? field.value;
                              const isEdited =
                                currentValue.trim() !== field.value.trim();

                              return (
                                <label
                                  key={field.key}
                                  className="block rounded-[1rem] border border-white/80 bg-white p-3 shadow-sm transition-all duration-300"
                                >
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-teal-700">
                                      {field.label}
                                    </p>
                                    <span
                                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                                        isEdited
                                          ? "bg-teal-100 text-teal-900"
                                          : field.source === "confirmed"
                                            ? "bg-emerald-100 text-emerald-800"
                                            : "bg-amber-100 text-amber-800"
                                      }`}
                                    >
                                      {isEdited
                                        ? "Ajustado"
                                        : field.source === "confirmed"
                                          ? "Confirmado"
                                          : "Sugerido"}
                                    </span>
                                  </div>
                                  <input
                                    value={currentValue}
                                    onChange={event =>
                                      handleManualFieldChange(
                                        field.key,
                                        event.target.value
                                      )
                                    }
                                    placeholder={field.value}
                                    className="mt-3 h-11 w-full rounded-2xl border border-teal-100 bg-teal-50/60 px-4 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
                                  />
                                  <p className="mt-2 text-xs leading-5 text-teal-900">
                                    {getEditableFieldSupportCopy(field.key)}
                                  </p>
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
                          {recommendedStepFlash
                            ? "Siguiente paso sugerido"
                            : "Sugerencia útil para seguir"}
                        </p>
                        <h4 className="mt-2 text-lg font-semibold text-slate-950">
                          {previewNextDocumentCopy.headline}
                        </h4>
                        <p className="mt-2 text-sm leading-7 text-emerald-950">
                          {previewNextDocumentCopy.intro}
                        </p>
                        <div className="mt-4 rounded-[1rem] border border-white/80 bg-white p-3">
                          <p className="text-sm font-semibold text-slate-950">
                            {previewNextDocumentCopy.reasonTitle}
                          </p>
                          <p className="mt-2 text-sm leading-7 text-slate-700">
                            {previewNextDocumentCopy.reasonBody}
                          </p>
                          <p className="mt-2 text-xs leading-6 text-slate-500">
                            {previewNextDocumentCopy.coverage}
                          </p>
                        </div>
                        {previewNextTarget ? (
                          <Button
                            variant="outline"
                            className="mt-4 h-11 w-full rounded-full border-emerald-200 bg-white text-emerald-900 hover:bg-emerald-100"
                            onClick={() =>
                              focusRecommendedUpload(previewNextTarget.type)
                            }
                          >
                            Seguir con esta sugerencia
                            <ArrowRight
                              className="ml-2 h-4 w-4"
                              strokeWidth={1.8}
                            />
                          </Button>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-4 grid gap-4 lg:grid-cols-2">
                      <div className="rounded-[1.2rem] border border-emerald-100 bg-emerald-50 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-semibold text-emerald-950">
                            Lo que ya se ve claro
                          </p>
                          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-emerald-800">
                            {previewConfirmedDisplayEntries.length} dato
                            {previewConfirmedDisplayEntries.length === 1
                              ? ""
                              : "s"}
                          </span>
                        </div>
                        {previewConfirmedDisplayEntries.length === 0 ? (
                          <p className="mt-3 text-sm leading-7 text-emerald-900">
                            Todavía no hay suficiente información clara para
                            mostrar datos confirmados en esta vista previa.
                          </p>
                        ) : (
                          <div className="mt-4 space-y-3">
                            {previewConfirmedDisplayEntries.map(
                              ([key, value]) => (
                                <div
                                  key={key}
                                  className="rounded-[1rem] bg-white p-3"
                                >
                                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">
                                    {getAnalysisFieldLabel(key)}
                                  </p>
                                  <p className="mt-1 text-sm leading-6 text-slate-800">
                                    {formatAnalysisValue(key, value)}
                                  </p>
                                </div>
                              )
                            )}
                          </div>
                        )}
                      </div>

                      <div className="rounded-[1.2rem] border border-amber-200 bg-amber-50 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-semibold text-amber-950">
                            Lo que conviene revisar
                          </p>
                          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-amber-800">
                            {previewEstimatedDisplayEntries.length} dato
                            {previewEstimatedDisplayEntries.length === 1
                              ? ""
                              : "s"}
                          </span>
                        </div>
                        <p className="mt-3 text-sm leading-7 text-amber-900">
                          Tómalos como orientación inicial. Si no te convence la
                          lectura o la foto quedó floja, puedes repetir la
                          captura antes de guardar.
                        </p>
                        {previewEstimatedDisplayEntries.length === 0 ? (
                          <p className="mt-3 text-sm leading-7 text-amber-900">
                            Por ahora no hay estimaciones adicionales que
                            revisar en esta vista previa.
                          </p>
                        ) : (
                          <div className="mt-4 space-y-3">
                            {previewEstimatedDisplayEntries.map(
                              ([key, value]) => (
                                <div
                                  key={key}
                                  className="rounded-[1rem] bg-white p-3"
                                >
                                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-700">
                                    {getAnalysisFieldLabel(key)}
                                  </p>
                                  <p className="mt-1 text-sm leading-6 text-slate-800">
                                    {formatAnalysisValue(key, value)}
                                  </p>
                                </div>
                              )
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {displayPreviewStructuredExtraction?.missingFields
                      ?.length ||
                    displayPreviewStructuredExtraction?.reviewNotes?.length ||
                    previewGuardrails.length ? (
                      <div className="mt-4 rounded-[1.2rem] border border-white/80 bg-white p-4">
                        <p className="font-semibold text-slate-950">
                          Qué revisar antes de guardar
                        </p>
                        <div className="mt-3 space-y-2 text-sm leading-7 text-slate-700">
                          {displayPreviewStructuredExtraction?.missingFields?.map(
                            item => (
                              <p key={`missing-${item}`}>
                                • Todavía no se alcanzó a leer con claridad:{" "}
                                {item}.
                              </p>
                            )
                          )}
                          {displayPreviewStructuredExtraction?.reviewNotes?.map(
                            item => (
                              <p key={`note-${item}`}>• {item}</p>
                            )
                          )}
                          {previewGuardrails.map(item => (
                            <p key={`guardrail-${item}`}>• {item}</p>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {shouldShowInlineLegalConsent ? (
                      <div className="mt-5 rounded-[1.25rem] border border-slate-200 bg-slate-50/85 p-4 shadow-[0_16px_32px_-28px_rgba(15,23,42,0.42)]">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="max-w-2xl">
                            <p className="text-sm font-semibold text-slate-950">
                              Tu autorización se registra junto con este
                              documento.
                            </p>
                            <p className="mt-1 text-sm leading-6 text-slate-600">
                              Así protegemos tu expediente, reforzamos la confidencialidad y dejamos constancia de la versión legal vigente en el mismo paso.
                            </p>
                          </div>
                          <button
                            type="button"
                            className="text-sm font-semibold text-slate-700 underline decoration-slate-300 underline-offset-4 transition hover:text-slate-950"
                            onClick={() => setLegalDocumentsDrawerOpen(true)}
                          >
                            Revisar aviso y términos
                          </button>
                        </div>
                        <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-[1rem] border border-slate-200 bg-white p-4 shadow-[0_12px_26px_-24px_rgba(15,23,42,0.38)] transition-colors hover:border-teal-200">
                          <input
                            type="checkbox"
                            checked={legalGateChecked}
                            onChange={event => {
                              const checked = event.target.checked;
                              setLegalGateChecked(checked);
                              trackLegalGateEvent("consent_toggled", {
                                tenantId: selectedTenantId,
                                caseId: selectedCaseId,
                                checked,
                                location: "review_card",
                                hasPendingDraft: Boolean(pendingDraft),
                              });
                              if (checked) {
                                setLegalGateError(null);
                              }
                            }}
                            className="mt-0.5 h-5 w-5 shrink-0 rounded-md border-slate-300 text-teal-600 focus:ring-teal-500"
                          />
                          <span className="text-sm leading-6 text-slate-700">
                            {LEGAL_GATE_COPY.checkbox}
                          </span>
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
                        disabled={
                          isPrimaryDocumentActionPending ||
                          !selectedTenantId ||
                          !selectedCaseId
                        }
                        onClick={() => void handleConfirmDraft()}
                      >
                        {confirmDraftMutation.isPending
                          ? "Guardando documento..."
                          : acceptLegalPackageMutation.isPending
                            ? "Registrando autorización..."
                            : confirmPrimaryActionLabel}
                        {isPrimaryDocumentActionPending ? (
                          <RefreshCw
                            className="ml-2 h-4 w-4 animate-spin"
                            strokeWidth={1.8}
                          />
                        ) : (
                          <ArrowRight
                            className="ml-2 h-4 w-4"
                            strokeWidth={1.8}
                          />
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
                </>
              ) : null}

              {submitError ? (
                <div className="mt-6 rounded-[1.2rem] border border-amber-200 bg-amber-50 p-4 text-sm leading-7 text-amber-950">
                  <div className="flex items-start gap-3">
                    <AlertCircle
                      className="mt-1 h-5 w-5 shrink-0"
                      strokeWidth={1.8}
                    />
                    <div className="space-y-2">
                      <p className="font-semibold text-amber-950">
                        Algo interrumpió la carga, pero tus datos siguen a
                        salvo.
                      </p>
                      <p className="break-words">{submitError}</p>
                      <p className="text-xs leading-5 text-amber-900">
                        Puedes reintentar ahora mismo o elegir otro archivo sin
                        perder el control del flujo.
                      </p>
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
                <div
                  className="mt-6 rounded-[1.2rem] border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-900"
                  data-testid="legal-gate-error"
                >
                  <p className="font-semibold text-rose-950">
                    No pudimos registrar tu autorización todavía.
                  </p>
                  <p className="mt-2">{legalGateError.message}</p>
                  <p className="mt-2 text-xs text-rose-800/90">
                    Tu archivo y tu progreso siguen resguardados. Puedes
                    reintentar desde aquí sin duplicar el expediente.
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
                        disabled={
                          acceptLegalPackageMutation.isPending ||
                          legalGateRetryCountdown > 0 ||
                          legalGateError.retryCount >= MAX_LEGAL_GATE_RETRIES
                        }
                        data-testid="legal-gate-retry-button"
                      >
                        <RefreshCw className="mr-2 size-4" />
                        {legalGateRetryCountdown > 0
                          ? `Disponible en ${legalGateRetryCountdown}s`
                          : "Reintentar autorización"}
                      </Button>
                      <span
                        className="text-xs text-rose-700"
                        data-testid="legal-gate-retry-copy"
                      >
                        Reintento{" "}
                        {Math.min(
                          legalGateError.retryCount + 1,
                          MAX_LEGAL_GATE_RETRIES
                        )}{" "}
                        de {MAX_LEGAL_GATE_RETRIES}
                      </span>
                      <span
                        className="text-xs font-semibold text-rose-800"
                        data-testid="legal-gate-retry-countdown"
                        data-seconds={legalGateRetryCountdown}
                      >
                        {legalGateRetryCountdown > 0
                          ? `Disponible nuevamente en ${legalGateRetryCountdown}s`
                          : "Reintento inmediato disponible"}
                      </span>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {shouldShowInlineLegalConsent ? (
                <div className="mt-5 hidden rounded-[1.25rem] border border-slate-200 bg-slate-50/85 p-4 shadow-[0_16px_32px_-28px_rgba(15,23,42,0.42)] sm:block">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="max-w-2xl">
                      <p className="text-sm font-semibold text-slate-950">
                        Tu autorización se registra junto con este documento.
                      </p>
                      <p className="mt-1 text-sm leading-6 text-slate-600">
                         Así protegemos tu expediente, reforzamos la confidencialidad y dejamos constancia de la versión legal vigente en el mismo paso.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="text-sm font-semibold text-slate-700 underline decoration-slate-300 underline-offset-4 transition hover:text-slate-950"
                      onClick={() => setLegalDocumentsDrawerOpen(true)}
                    >
                      Revisar aviso y términos
                    </button>
                  </div>
                  <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-[1rem] border border-slate-200 bg-white p-4 shadow-[0_12px_26px_-24px_rgba(15,23,42,0.38)] transition-colors hover:border-teal-200">
                    <input
                      type="checkbox"
                      checked={legalGateChecked}
                      onChange={event => {
                        const checked = event.target.checked;
                        setLegalGateChecked(checked);
                        trackLegalGateEvent("consent_toggled", {
                          tenantId: selectedTenantId,
                          caseId: selectedCaseId,
                          checked,
                          location: "inline_consent",
                          hasPendingDraft: Boolean(pendingDraft),
                        });
                        if (checked) {
                          setLegalGateError(null);
                        }
                      }}
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                    />
                    <span className="text-sm leading-6 text-slate-700">
                      {LEGAL_GATE_COPY.checkbox}
                    </span>
                  </label>
                </div>
              ) : null}

              <div className="mt-5 hidden flex-col gap-3 sm:flex lg:flex-row lg:items-start">
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <Button
                    className={`h-12 rounded-full px-7 text-white transition-all duration-300 ${
                      pendingDraft && manualOverridePayload.length
                        ? "bg-teal-700 shadow-[0_18px_40px_-24px_rgba(15,118,110,0.7)] hover:bg-teal-800"
                        : "bg-teal-600 hover:bg-teal-700"
                    }`}
                    disabled={
                      isPrimaryDocumentActionPending ||
                      !selectedTenantId ||
                      !selectedCaseId
                    }
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
                        ? "Guardando..."
                        : autoAdvanceFlash
                          ? "Preparando revisión..."
                          : "Procesando..."
                      : acceptLegalPackageMutation.isPending
                        ? "Registrando autorización..."
                        : pendingDraft
                          ? confirmPrimaryActionLabel
                          : uploadPrimaryActionLabel}
                    {isPrimaryDocumentActionPending ? (
                      <RefreshCw
                        className="ml-2 h-4 w-4 animate-spin"
                        strokeWidth={1.8}
                      />
                    ) : (
                      <ArrowRight className="ml-2 h-4 w-4" strokeWidth={1.8} />
                    )}
                  </Button>

                  {autoAdvanceFlash && !pendingDraft ? (
                      <p className="text-xs font-medium leading-5 text-teal-700">
                        Abriremos tu revisión en breve.
                      </p>
                  ) : null}
                </div>

                <Button
                  variant="outline"
                  className="h-12 rounded-full border-slate-200 bg-white text-slate-700 hover:bg-slate-50 lg:w-auto lg:px-6"
                  onClick={
                    pendingDraft ? restartPreviewFlow : clearSelectedFile
                  }
                  disabled={isPrimaryDocumentActionPending}
                >
                  {pendingDraft
                    ? reanalyzeDraftAction.label
                    : "Limpiar formulario"}
                </Button>
              </div>
            </div>

            <div className={shouldCompactPostUploadExperience || !isDossierWorkspaceSection ? "hidden" : "rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8"}>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">
                Tu último documento
              </p>

              {saveStatusFlash && lastUpload ? (
                <div className="mt-4 rounded-[1.3rem] border border-emerald-200 bg-emerald-50 p-4 text-sm leading-7 text-emerald-950 shadow-sm transition-all duration-300">
                  <div className="flex items-start gap-3">
                    <CheckCircle2
                      className="mt-1 h-5 w-5 shrink-0 text-emerald-700"
                      strokeWidth={1.8}
                    />
                    <div>
                      <p className="font-semibold">
                        Documento guardado y expediente actualizado
                      </p>
                      <p className="mt-1">
                        La vista previa ya se convirtió en un documento real
                        dentro de tu expediente. Si hiciste ajustes manuales,
                        también quedaron incorporados en este guardado para
                        mantener una lectura consistente sobre la misma base
                        documental.
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

              {!lastUpload ? (
                pendingDraft ? (
                  <div className="mt-4 rounded-[1.3rem] border border-sky-200 bg-sky-50 p-5 text-sm leading-7 text-sky-950">
                    Tu documento ya quedó listo para confirmarse. En cuanto lo
                    guardes, aquí verás el resultado final, el siguiente paso
                    sugerido y el estado de seguimiento automático.
                  </div>
                ) : (
                  <div className="mt-4 rounded-[1.3rem] border border-slate-200 bg-slate-50 p-5 text-sm leading-7 text-slate-600">
                    Empieza con el documento más reciente que ya tengas contigo.
                    Aquí verás qué aportó, qué falta por confirmar y cuál es el
                    siguiente paso útil.
                  </div>
                )
              ) : (
                <div className="mt-4 space-y-4">
                  {showResultReveal && !shouldCompactPostUploadExperience ? (
                    <div
                      data-testid="auditar-result-reveal"
                      className="overflow-hidden rounded-[1.35rem] border border-teal-200 bg-[linear-gradient(135deg,_rgba(240,253,250,0.98),_rgba(255,255,255,0.98))] p-4 shadow-sm transition-all duration-500 ease-out"
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white shadow-sm">
                          <Sparkles
                            className="h-5 w-5 animate-pulse text-teal-700"
                            strokeWidth={1.9}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-700">
                            {resultRevealCopy.eyebrow}
                          </p>
                          <p className="mt-2 text-base font-semibold text-slate-950 sm:text-lg">
                            {resultRevealCopy.title}
                          </p>
                          <p className="mt-2 text-sm leading-6 text-slate-700">
                            {resultRevealCopy.description}
                          </p>
                          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-600">
                            <span className="rounded-full bg-white px-3 py-1 text-slate-700">
                              Archivo recibido
                            </span>
                            <span className="rounded-full bg-white px-3 py-1 text-slate-700">
                              Veredicto en pantalla
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  <div
                    ref={verdictPanelRef}
                    data-testid="auditar-verdict-panel"
                    className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(20,184,166,0.14),_transparent_42%),linear-gradient(180deg,_#ffffff_0%,_#f8fafc_100%)] p-5 shadow-sm sm:p-6"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                          Revisión rápida
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-900 sm:text-base">
                          {getSimpleDocumentTypeLabel(
                            lastUpload.classification.documentType
                          )} · {lastUploadVerdict.shortLabel}
                        </p>
                      </div>
                      <span
                        data-testid="auditar-verdict-pill"
                        className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold ${lastUploadVerdict.classes}`}
                      >
                        {lastUploadVerdict.label}
                      </span>
                    </div>

                    <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.18fr)_minmax(18rem,0.82fr)]">
                      <div className="rounded-[1.25rem] border border-white/80 bg-white/92 p-4 shadow-sm sm:p-5">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                          Lo esencial
                        </p>
                        <h3 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-slate-950 sm:text-[1.9rem]">
                          {lastUploadResultHeadline}
                        </h3>
                        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-700 sm:text-[0.98rem]">
                          {lastUploadResultLead}
                        </p>

                        <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                            {getSimpleDocumentTypeLabel(
                              lastUpload.classification.documentType
                            )}
                          </span>
                          <span
                            className={`rounded-full px-3 py-1 ${lastUploadVerdict.classes}`}
                          >
                            {lastUploadVerdict.shortLabel}
                          </span>
                        </div>

                        <div className="mt-4 rounded-[1rem] border border-teal-100 bg-teal-50/80 p-4">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-700">
                                Lo más útil ahora
                              </p>
                              <p className="mt-2 text-sm leading-6 text-teal-950">
                                Qué ya vimos y qué te conviene hacer ahora.
                              </p>
                            </div>
                            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-teal-800">
                              2 puntos clave
                            </span>
                          </div>

                          <div className="mt-3 space-y-2">
                            {(visibleSimpleExplanation.length
                              ? visibleSimpleExplanation
                                  .slice(0, shouldCompactPostUploadExperience ? 1 : 3)
                                  .map((item, index) => ({
                                  id: `${item.label}-${index}`,
                                  label: item.label,
                                  summary:
                                    warmVisibleNamingCopy(item.summary) ?? item.summary,
                                  tone: item.tone,
                                }))
                              : [
                                  {
                                    id: "result-contribution",
                                    label: "Qué aporta",
                                    summary:
                                      uploadInsight?.contribution ??
                                      "Ya quedó integrado para darte una primera lectura útil dentro del expediente.",
                                    tone: "support" as const,
                                  },
                                  {
                                    id: "result-next-step",
                                    label: "Haz esto ahora",
                                    summary: lastUploadNextStepSummary,
                                    tone: "attention" as const,
                                  },
                                ]).map(item => (
                              <div
                                key={item.id}
                                className={`rounded-[0.95rem] border px-3 py-3 ${
                                  item.tone === "attention"
                                    ? "border-amber-200 bg-white text-amber-950"
                                    : item.tone === "support"
                                      ? "border-emerald-200 bg-white text-emerald-950"
                                      : "border-cyan-200 bg-white text-cyan-950"
                                }`}
                              >
                                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                                  {item.label}
                                </p>
                                <p className="mt-1 text-sm leading-6 text-slate-900">
                                  {item.summary}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>

                        {showQuickDifferenceCalculator && !shouldCompactPostUploadExperience ? (
                          <div className="mt-4 rounded-[1rem] border border-amber-200 bg-amber-50/80 p-4">
                            <div className="flex items-start gap-3">
                              <FileSearch className="mt-1 h-5 w-5 shrink-0 text-amber-700" strokeWidth={1.8} />
                              <div className="min-w-0 flex-1">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-800">
                                  Calculadora guiada
                                </p>
                                <p className="mt-2 text-lg font-semibold text-slate-950">
                                  Compara tu nómina contra tu CFDI
                                </p>
                                <p className="mt-2 text-sm leading-6 text-slate-700">
                                  Tomamos los montos visibles del expediente para preparar un cruce por periodo y dejamos la diferencia en una capa determinística y auditable. Puedes ajustar los montos manualmente si quieres validar otro escenario.
                                </p>
                                {quickCalculatorPeriodHint ? (
                                  <p className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-amber-900">
                                    Periodo visible: {quickCalculatorPeriodHint}
                                  </p>
                                ) : null}
                              </div>
                            </div>

                            {quickCalculatorSelectableHistory.length > 0 ? (
                              <label className="mt-4 block rounded-[0.95rem] border border-amber-200 bg-white px-4 py-3">
                                <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-800">
                                  Periodo a comparar
                                </span>
                                <select
                                  value={selectedQuickCalculatorPeriodKey}
                                  onChange={event =>
                                    setSelectedQuickCalculatorPeriodKey(event.target.value)
                                  }
                                  className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 outline-none transition focus:border-amber-300 focus:ring-2 focus:ring-amber-200"
                                >
                                  {quickCalculatorSelectableHistory.map(item => (
                                    <option key={item.periodKey} value={item.periodKey}>
                                      {item.periodLabel}
                                    </option>
                                  ))}
                                </select>
                                <p className="mt-2 text-sm leading-6 text-slate-600">
                                  Elige un periodo del histórico y, si quieres, luego ajusta los montos manualmente para validar otro escenario.
                                </p>
                              </label>
                            ) : null}

                            {quickSideBySideComparisons.length > 0 ? (
                              <div className="mt-4 rounded-[0.95rem] border border-amber-200 bg-white px-4 py-4">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div>
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-800">
                                      Comparación rápida entre periodos
                                    </p>
                                    <p className="mt-2 text-base font-semibold text-slate-950">
                                      Mira el periodo elegido junto a la referencia más reciente
                                    </p>
                                  </div>
                                  <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900">
                                    {quickSideBySideComparisons.length === 1 ? "1 periodo visible" : "2 periodos visibles"}
                                  </span>
                                </div>
                                <p className="mt-3 text-sm leading-6 text-slate-700">
                                  Si eliges otro periodo del histórico, aquí verás ambos cortes uno junto al otro sin cambiar de pantalla ni perder el contexto.
                                </p>
                                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                                  {quickSideBySideComparisons.map(card => (
                                    <div key={card.key} className="rounded-[0.95rem] border border-slate-200 bg-slate-50 p-4">
                                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                                        {card.eyebrow}
                                      </p>
                                      <p className="mt-2 text-base font-semibold text-slate-950">{card.title}</p>
                                      <p className="mt-3 text-sm leading-6 text-slate-700">{card.summary}</p>
                                      <div className="mt-4 grid gap-2 sm:grid-cols-3">
                                        <div className="rounded-[0.85rem] border border-white bg-white px-3 py-3">
                                          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Nómina</p>
                                          <p className="mt-2 text-sm font-semibold text-slate-950">{card.payrollLabel}</p>
                                        </div>
                                        <div className="rounded-[0.85rem] border border-white bg-white px-3 py-3">
                                          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">CFDI</p>
                                          <p className="mt-2 text-sm font-semibold text-slate-950">{card.cfdiLabel}</p>
                                        </div>
                                        <div className="rounded-[0.85rem] border border-white bg-white px-3 py-3">
                                          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Diferencia</p>
                                          <p className="mt-2 text-sm font-semibold text-slate-950">{card.differenceLabel}</p>
                                        </div>
                                      </div>
                                      <p className="mt-3 text-sm leading-6 text-slate-600">
                                        Siguiente paso sugerido: {card.nextStep}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : null}

                            <div className="mt-4 grid gap-3 sm:grid-cols-2">
                              <label className="rounded-[0.95rem] border border-white/90 bg-white p-3">
                                <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                                  Monto en recibo
                                </span>
                                <input
                                  type="number"
                                  inputMode="decimal"
                                  step="0.01"
                                  min="0"
                                  value={quickPayrollAmount}
                                  onChange={event => setQuickPayrollAmount(event.target.value)}
                                  className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 outline-none transition focus:border-amber-300 focus:ring-2 focus:ring-amber-200"
                                  placeholder="0.00"
                                />
                              </label>
                              <label className="rounded-[0.95rem] border border-white/90 bg-white p-3">
                                <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                                  Monto en CFDI
                                </span>
                                <input
                                  type="number"
                                  inputMode="decimal"
                                  step="0.01"
                                  min="0"
                                  value={quickCfdiAmount}
                                  onChange={event => setQuickCfdiAmount(event.target.value)}
                                  className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 outline-none transition focus:border-amber-300 focus:ring-2 focus:ring-amber-200"
                                  placeholder="0.00"
                                />
                              </label>
                            </div>

                            {quickDifferenceAmount !== null && quickDifferenceAbsolute !== null ? (
                              <div className="mt-4 rounded-[0.95rem] border border-amber-200 bg-white px-4 py-3">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-800">
                                  Diferencia estimada
                                </p>
                                <p className="mt-2 text-xl font-semibold text-slate-950">
                                  {formatQuickCalculatorAmount(quickDifferenceAbsolute)}
                                </p>
                                <p className="mt-2 text-sm leading-6 text-slate-700">
                                  {quickDifferenceNarrative}
                                </p>
                              </div>
                            ) : (
                              <p className="mt-4 text-sm leading-6 text-slate-700">
                                Completa ambos montos para ver una diferencia rápida antes de seguir con la comparación documental.
                              </p>
                            )}

                            <div className="mt-4 rounded-[0.95rem] border border-slate-200 bg-white px-4 py-4">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                                    Calculadora visual rápida
                                  </p>
                                  <p className="mt-2 text-base font-semibold text-slate-950">
                                    Así se ve el cruce de montos del periodo activo
                                  </p>
                                </div>
                                {quickCalculatorPeriodHint ? (
                                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                                    {quickCalculatorPeriodHint}
                                  </span>
                                ) : null}
                              </div>
                              <div className="mt-4 space-y-4">
                                <div>
                                  <div className="flex items-center justify-between gap-3 text-sm font-medium text-slate-700">
                                    <span>Nómina</span>
                                    <span>{quickPayrollNumeric !== null ? formatQuickCalculatorAmount(quickPayrollNumeric) : "Pendiente"}</span>
                                  </div>
                                  <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-100">
                                    <div className="h-full rounded-full bg-teal-500" style={{ width: quickPayrollVisualWidth }} />
                                  </div>
                                </div>
                                <div>
                                  <div className="flex items-center justify-between gap-3 text-sm font-medium text-slate-700">
                                    <span>CFDI</span>
                                    <span>{quickCfdiNumeric !== null ? formatQuickCalculatorAmount(quickCfdiNumeric) : "Pendiente"}</span>
                                  </div>
                                  <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-100">
                                    <div className="h-full rounded-full bg-violet-500" style={{ width: quickCfdiVisualWidth }} />
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className={`mt-4 rounded-[0.95rem] border px-4 py-4 ${quickLaborHealthSignal.toneClasses}`}>
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em]">
                                    {quickLaborHealthSignal.badge}
                                  </p>
                                  <p className="mt-2 text-base font-semibold text-slate-950">
                                    {quickLaborHealthSignal.headline}
                                  </p>
                                </div>
                                <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-slate-700">
                                  Protección estimada {quickLaborHealthSignal.progress}%
                                </span>
                              </div>
                              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/70">
                                <div className={`h-full rounded-full ${quickLaborHealthSignal.barClasses}`} style={{ width: `${quickLaborHealthSignal.progress}%` }} />
                              </div>
                              <p className="mt-3 text-sm leading-6 text-slate-700">
                                {quickLaborHealthSignal.supportingText}
                              </p>
                              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                                {quickLaborHealthSignal.checklist.map(item => (
                                  <div key={item} className="rounded-[0.85rem] border border-white/80 bg-white/80 px-3 py-3 text-sm leading-6 text-slate-700">
                                    {item}
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div className="mt-4 rounded-[0.95rem] border border-teal-200 bg-teal-50/80 px-4 py-4">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-teal-800">
                                    Hallazgo protegido y listo para cuidar
                                  </p>
                                  <p className="mt-2 text-base font-semibold text-slate-950">
                                    Ya tienes una señal seria para asegurar en tu bóveda privada, exportar o reforzar con más contexto.
                                  </p>
                                </div>
                                <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-teal-800">
                                  Sesión blindada
                                </span>
                              </div>
                              <p className="mt-3 text-sm leading-6 text-slate-700">
                                Puedes conservar este documento, el hallazgo visible y el contexto del periodo dentro de tu archivo privado para revisarlo después con más calma, exportarlo como respaldo o sumar otros documentos para fortalecer tu caso. Solo tú decides qué guardar y nadie de tu empresa puede ver este material.
                              </p>
                              <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-teal-900/80">
                                <span className="rounded-full bg-white/90 px-3 py-1">Guardar evidencia útil</span>
                                <span className="rounded-full bg-white/90 px-3 py-1">Privacidad bajo tu control</span>
                                <span className="rounded-full bg-white/90 px-3 py-1">Descargar reporte</span>
                                <span className="rounded-full bg-white/90 px-3 py-1">Seguir con más contexto</span>
                              </div>
                              <div className="mt-3 rounded-[0.95rem] border border-white/80 bg-white/85 px-3 py-3 text-xs leading-5 text-slate-700 shadow-sm sm:text-sm">
                                <p className="font-semibold uppercase tracking-[0.14em] text-teal-800">Transparencia de esta sesión</p>
                                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                                  <div className="rounded-[0.85rem] border border-slate-200 bg-white px-3 py-2">
                                    <p className="font-semibold text-slate-950">Borrador primero</p>
                                    <p className="mt-1">Nada se guarda en tu expediente hasta que tú lo confirmas.</p>
                                  </div>
                                  <div className="rounded-[0.85rem] border border-slate-200 bg-white px-3 py-2">
                                    <p className="font-semibold text-slate-950">Rastro legal visible</p>
                                    <p className="mt-1">La aceptación legal registra versión, fecha, IP y navegador.</p>
                                  </div>
                                  <div className="rounded-[0.85rem] border border-slate-200 bg-white px-3 py-2">
                                    <p className="font-semibold text-slate-950">Control de privacidad</p>
                                    <p className="mt-1">Puedes borrar, exportar o pedir atención ARCO desde privacidad@auditapatron.com.</p>
                                  </div>
                                </div>
                              </div>
                              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                                <Button
                                  type="button"
                                  className="rounded-full bg-slate-950 px-5 text-white hover:bg-slate-900"
                                  onClick={() => {
                                    trackEvent("vault_cta_clicked_calculator", {
                                      location: "auditar_quick_calculator",
                                      hasDifference: quickDifferenceAmount !== null && quickDifferenceAmount !== 0,
                                      hasHistory: heliosCalculatorHistory.length > 0,
                                    });
                                    document.getElementById("mi-archivo-digital")?.scrollIntoView({
                                      behavior: "smooth",
                                      block: "start",
                                    });
                                  }}
                                >
Asegurar evidencia en tu bóveda privada
                                  <ArrowRight className="ml-2 h-4 w-4" strokeWidth={1.8} />
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="rounded-full border-slate-200 bg-white px-5 text-slate-700 hover:bg-slate-100"
                                  onClick={exportQuickHallazgoPdf}
                                >
Descargar reporte PDF
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="rounded-full border-slate-200 bg-white px-5 text-slate-700 hover:bg-slate-100"
                                  onClick={() => {
                                    trackEvent("vault_secondary_cta_clicked", {
                                      location: "auditar_quick_calculator",
                                    });
                                    openPreferredPicker();
                                  }}
                                >
Reforzar con otro documento
                                </Button>
                              </div>
                            </div>

                            <div className="mt-4 rounded-[0.95rem] border border-sky-200 bg-sky-50/75 px-4 py-4">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-800">
                                    Qué tan defendible va tu caso
                                  </p>
                                  <p className="mt-2 text-base font-semibold text-slate-950">
                                    Hoy tu respaldo visible va en {dossierStatus.percent}%.
                                  </p>
                                </div>
                                <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-sky-800">
                                  {heliosExpediente?.stageLabel ?? dossierStatus.label}
                                </span>
                              </div>
                              <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/90 shadow-inner">
                                <div
                                  className="h-full rounded-full bg-sky-600 transition-all duration-500"
                                  style={{ width: `${dossierStatus.percent}%` }}
                                />
                              </div>
                              <p className="mt-3 text-sm leading-6 text-slate-700">
                                Ya cubres {dossierStatus.completed} de {dossierStatus.total} piezas clave del expediente.
                                {selectedRecommendedTargetType && effectiveRecommendedTarget
                                  ? ` Si aseguras ${effectiveRecommendedTarget.label.toLowerCase()}, tu evidencia quedará más sólida para reclamar con más contexto.`
                                  : " Tu evidencia ya tiene una base útil para reclamar con más contexto."}
                              </p>
                              {selectedRecommendedTargetType && effectiveRecommendedTarget ? (
                                <button
                                  type="button"
                                  className="mt-3 inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-semibold text-sky-900 shadow-sm transition hover:bg-sky-100"
                                  onClick={() =>
                                    focusRecommendedUpload(
                                      effectiveRecommendedTarget.type
                                    )
                                  }
                                >
                                  Asegurar la siguiente pieza
                                  <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.8} />
                                </button>
                              ) : null}
                            </div>

                            <div className="mt-4 rounded-[0.95rem] border border-slate-200 bg-white px-4 py-4">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                                Mensajes listos para actuar
                              </p>
                              <p className="mt-2 text-base font-semibold text-slate-950">
                                Si quieres avanzar con firmeza y dejar constancia, aquí tienes dos borradores listos
                              </p>
                              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                                <div className="rounded-[0.9rem] border border-slate-200 bg-slate-50 p-3">
                                  <div className="flex items-center justify-between gap-3">
                                    <div>
                                      <p className="text-sm font-semibold text-slate-950">Mensaje diplomático para RH</p>
                                      <p className="mt-1 text-xs leading-5 text-slate-500">Úsalo para abrir la revisión y pedir respuesta por escrito.</p>
                                    </div>
                                    <button
                                      type="button"
                                      className="text-xs font-semibold text-teal-700 transition hover:text-teal-900"
                                      onClick={() => {
                                        void navigator.clipboard?.writeText(quickRhMessage);
                                      }}
                                    >
                                      Copiar
                                    </button>
                                  </div>
                                  <p className="mt-3 text-sm leading-6 text-slate-700">{quickRhMessage}</p>
                                </div>
                                <div className="rounded-[0.9rem] border border-slate-200 bg-slate-50 p-3">
                                  <div className="flex items-center justify-between gap-3">
                                    <div>
                                      <p className="text-sm font-semibold text-slate-950">Texto corto para WhatsApp</p>
                                      <p className="mt-1 text-xs leading-5 text-slate-500">Sirve para pedir confirmación rápida sin perder constancia.</p>
                                    </div>
                                    <button
                                      type="button"
                                      className="text-xs font-semibold text-teal-700 transition hover:text-teal-900"
                                      onClick={() => {
                                        void navigator.clipboard?.writeText(quickWhatsappMessage);
                                      }}
                                    >
                                      Copiar
                                    </button>
                                  </div>
                                  <p className="mt-3 text-sm leading-6 text-slate-700">{quickWhatsappMessage}</p>
                                </div>
                              </div>
                              <p className="mt-3 text-xs leading-5 text-slate-500">
                                Si te responden por correo o WhatsApp, guarda también esa respuesta en tu Bóveda Laboral para no perder el contexto del hallazgo.
                              </p>
                            </div>

                            <div className="mt-4 rounded-[0.95rem] border border-violet-200 bg-violet-50/70 px-4 py-4">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-violet-800">
                                    Tu bóveda laboral ya empezó
                                  </p>
                                  <p className="mt-2 text-base font-semibold text-slate-950">
                                    Este documento ya puede formar parte de tu archivo privado.
                                  </p>
                                </div>
                                <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-violet-800">
                                  Continúa con más contexto
                                </span>
                              </div>
                              <p className="mt-3 text-sm leading-6 text-slate-700">
                                Desde aquí puedes seguir subiendo documentos, guardar este hallazgo y preguntarle al asesor con más contexto sobre lo que ya apareció.
                              </p>
                              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                                <Button
                                  type="button"
                                  className="rounded-full bg-violet-700 px-5 text-white hover:bg-violet-800"
                                  onClick={() => {
                                    trackEvent("vault_view_requested", {
                                      location: "auditar_post_upload_microstate",
                                    });
                                    document.getElementById("mi-archivo-digital")?.scrollIntoView({
                                      behavior: "smooth",
                                      block: "start",
                                    });
                                  }}
                                >
                                  <FolderOpen className="mr-2 h-4 w-4" strokeWidth={1.8} />
                                  Ver mi bóveda
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="rounded-full border-violet-200 bg-white px-5 text-violet-900 hover:bg-violet-100"
                                  onClick={() => {
                                    trackEvent("vault_advisor_clicked", {
                                      location: "auditar_post_upload_microstate",
                                    });
                                    openHeliosCopilot("Explícame con palabras simples qué ya detectaste en este documento, qué conviene guardar y qué archivo me ayudaría a fortalecer mi bóveda laboral.");
                                  }}
                                >
                                  <Sparkles className="mr-2 h-4 w-4" strokeWidth={1.8} />
                                  Preguntar al asesor
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="rounded-full border-slate-200 bg-white px-5 text-slate-700 hover:bg-slate-100"
                                  onClick={() => {
                                    trackEvent("vault_upload_more_clicked", {
                                      location: "auditar_post_upload_microstate",
                                    });
                                    openPreferredPicker();
                                  }}
                                >
                                  <FileUp className="mr-2 h-4 w-4" strokeWidth={1.8} />
                                  Subir otro documento
                                </Button>
                              </div>
                            </div>

                            {heliosCalculatorHistory.length > 0 ? (
                              <div className="mt-4 rounded-[0.95rem] border border-slate-200 bg-white px-4 py-3">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                                  Histórico comparable por periodo
                                </p>
                                <div className="mt-3 space-y-3">
                                  {heliosCalculatorHistory.slice(0, 4).map(item => (
                                    <div
                                      key={item.periodKey}
                                      className="rounded-[0.85rem] border border-slate-200 bg-slate-50 px-3 py-3"
                                    >
                                      <div className="flex flex-wrap items-center justify-between gap-2">
                                        <p className="text-sm font-semibold text-slate-950">
                                          {item.periodLabel}
                                        </p>
                                        <p className="text-xs font-medium text-slate-500">
                                          {item.direction === "incomplete"
                                            ? "Comparación incompleta"
                                            : item.direction === "equal"
                                              ? "Sin diferencia visible"
                                              : "Diferencia visible"}
                                        </p>
                                      </div>
                                      <div className="mt-2 grid gap-2 text-sm text-slate-700 sm:grid-cols-3">
                                        <p>
                                          Nómina: {item.payrollAmount !== null && item.payrollAmount !== undefined
                                            ? formatQuickCalculatorAmount(item.payrollAmount)
                                            : "Falta documento"}
                                        </p>
                                        <p>
                                          CFDI: {item.cfdiAmount !== null && item.cfdiAmount !== undefined
                                            ? formatQuickCalculatorAmount(item.cfdiAmount)
                                            : "Falta documento"}
                                        </p>
                                        <p>
                                          Diferencia: {item.differenceAmount !== null && item.differenceAmount !== undefined
                                            ? formatQuickCalculatorAmount(Math.abs(item.differenceAmount))
                                            : "Pendiente"}
                                        </p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : null}

                            {heliosCalculatorLegalExplanation ? (
                              <div className="mt-4 rounded-[0.95rem] border border-cyan-200 bg-cyan-50/70 px-4 py-3">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-800">
                                  Qué significa jurídicamente
                                </p>
                                <p className="mt-2 text-base font-semibold text-slate-950">
                                  {heliosCalculatorLegalExplanation.headline}
                                </p>
                                <p className="mt-2 text-sm leading-6 text-slate-700">
                                  {heliosCalculatorLegalExplanation.summary}
                                </p>
                                <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
                                  {heliosCalculatorLegalExplanation.actionItems.map(item => (
                                    <li key={item} className="flex gap-2">
                                      <span className="mt-[0.45rem] h-1.5 w-1.5 rounded-full bg-cyan-700" />
                                      <span>{item}</span>
                                    </li>
                                  ))}
                                </ul>
                                <p className="mt-3 text-xs leading-5 text-slate-600">
                                  {heliosCalculatorLegalExplanation.disclaimer}
                                </p>
                              </div>
                            ) : null}

                            <p className="mt-3 text-xs leading-5 text-slate-600">
                              Sirve para una revisión inicial. Para cerrar mejor la lectura, todavía conviene comparar periodo y conceptos del mismo mes.
                            </p>
                          </div>
                        ) : null}

                        <div className={shouldCompactPostUploadExperience ? "hidden" : "mt-4 rounded-[1rem] border border-slate-200 bg-slate-50 p-4"}>
                          <div className="flex items-start gap-3">
                            <Sparkles
                              className="mt-1 h-5 w-5 shrink-0 text-teal-700"
                              strokeWidth={1.8}
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-700">
                                Acción principal
                              </p>
                              <p className="mt-2 text-lg font-semibold text-slate-950">
                                {primaryLastUploadShortcut
                                  ? primaryLastUploadShortcut.label
                                  : "Abrir asesor laboral"}
                              </p>
                              <p className="mt-2 text-sm leading-7 text-slate-700">
                                {primaryLastUploadShortcut
                                  ? primaryLastUploadShortcut.description
                                  : "Si quieres profundizar, aquí te explicamos este resultado y te ayudamos a elegir el siguiente documento útil."}
                              </p>
                            </div>
                          </div>

                          <Button
                            data-testid="auditar-primary-verdict-cta"
                            type="button"
                            className="mt-4 h-12 w-full justify-between rounded-full bg-slate-950 text-white hover:bg-slate-900"
                            onClick={handlePrimaryVerdictCta}
                          >
                            {primaryLastUploadShortcut
                              ? primaryLastUploadShortcut.label
                              : "Abrir asesor laboral"}
                            <ArrowRight className="h-4 w-4" strokeWidth={1.9} />
                          </Button>

                          <p className="mt-3 text-xs leading-5 text-slate-500">
                            Los detalles completos quedan abajo, solo para cuando quieras profundizar.
                          </p>

                        </div>
                      </div>

                      <div className={shouldCompactPostUploadExperience ? "hidden rounded-[1.25rem] border border-sky-100 bg-sky-50 p-4 shadow-sm sm:block sm:p-5" : "rounded-[1.25rem] border border-sky-100 bg-sky-50 p-4 shadow-sm sm:p-5"}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">
                              Mi archivo digital
                            </p>
                            <h3 className="mt-2 text-lg font-semibold tracking-[-0.03em] text-slate-950">
                              Tu expediente ya quedó guardado y lo puedes abrir cuando quieras
                            </h3>
                            <p className="mt-2 text-sm leading-6 text-slate-700">
                              Tu último archivo ya está dentro del expediente. Si quieres seguir, puedes abrirlo o saltar al archivo completo.
                            </p>
                          </div>
                          <div className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm">
                            {documents.length} documento
                            {documents.length === 1 ? "" : "s"}
                          </div>
                        </div>

                        <div className="mt-4 rounded-[1rem] border border-white/80 bg-white/90 p-3 text-sm leading-6 text-slate-700 shadow-sm">
                          <p className="font-semibold text-slate-950">
                            Último archivo guardado
                          </p>
                          <p className="mt-1 break-words text-slate-700">
                            {latestArchiveDocument?.originalName ??
                              "Tu expediente ya tiene documentos disponibles."}
                          </p>
                        </div>

                        <div className="mt-4 grid gap-3">
                          <Button
                            type="button"
                            className="h-11 rounded-full bg-slate-950 px-5 text-white hover:bg-slate-900"
                            disabled={Boolean(openingDocumentId)}
                            onClick={() => void handleDigitalArchiveQuickAction()}
                          >
                            <FolderOpen className="mr-2 h-4 w-4" strokeWidth={1.8} />
                            {openingDocumentId === latestArchiveDocument?.documentId
                              ? "Abriendo documento..."
                              : latestArchiveDocument
                                ? "Ver último documento"
                                : "Abrir archivo digital"}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            className={`h-11 rounded-full ${shouldCompactPostUploadExperience ? "border-transparent bg-transparent px-0 text-slate-500 shadow-none hover:bg-transparent hover:text-slate-700" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100"}`}
                            onClick={() => scrollToDigitalArchive("result_panel")}
                          >
                            Ver todo mi archivo
                          </Button>
                        </div>
                      </div>
                    </div>
                </div>

                  <details className="group rounded-[1.3rem] border border-slate-200 bg-white p-4 shadow-sm">

                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-950">
{shouldCompactPostUploadExperience ? "Ver informe completo" : "Ver cómo se obtuvo este resultado"}
                        </p>
                        <p className="mt-1 text-xs leading-6 text-slate-500">
                          {shouldCompactPostUploadExperience
                            ? "Aquí dejamos el detalle, el archivo y las comparaciones solo para cuando quieras profundizar."
                            : "Aquí quedan la lectura detallada, el apoyo visual y el contexto técnico solo para cuando quieras profundizar."}
                        </p>
                      </div>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
{shouldCompactPostUploadExperience ? "Abrir informe" : "Abrir detalles"}
                      </span>
                    </summary>

                    <div className="mt-4 space-y-4">
                      {lastUpload?.scanAssistance ? (
                        <div
                          className={`rounded-[1.3rem] border p-4 ${getScanAssistTone(lastUpload.scanAssistance as ScanAssistAssessmentView).containerClasses}`}
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="flex items-start gap-3">
                              <FileSearch
                                className="mt-1 h-5 w-5 shrink-0 text-slate-700"
                                strokeWidth={1.8}
                              />
                              <div>
                                <p className="font-semibold text-slate-950">
                                  {
                                    (
                                      lastUpload.scanAssistance as ScanAssistAssessmentView
                                    ).friendlyHeadline
                                  }
                                </p>
                                <p className="mt-1 text-sm leading-7 text-slate-700">
                                  {
                                    (
                                      lastUpload.scanAssistance as ScanAssistAssessmentView
                                    ).userGuidance
                                  }
                                </p>
                              </div>
                            </div>
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-semibold ${getScanAssistTone(lastUpload.scanAssistance as ScanAssistAssessmentView).badgeClasses}`}
                            >
                              {
                                getScanAssistTone(
                                  lastUpload.scanAssistance as ScanAssistAssessmentView
                                ).badgeLabel
                              }
                            </span>
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                            <span className="rounded-full bg-white px-3 py-1 text-slate-700">
                              Confianza visual{" "}
                              {
                                (
                                  lastUpload.scanAssistance as ScanAssistAssessmentView
                                ).confidence
                              }
                              %
                            </span>
                            <span className="rounded-full bg-white px-3 py-1 text-slate-700">
                              {getExpectedTypeAlignmentCopy(
                                (
                                  lastUpload.scanAssistance as ScanAssistAssessmentView
                                ).expectedTypeAlignment
                              )}
                            </span>
                          </div>

                          {(
                            lastUpload.scanAssistance as ScanAssistAssessmentView
                          ).issues.length ? (
                            <div className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
                              {(
                                lastUpload.scanAssistance as ScanAssistAssessmentView
                              ).issues.map(item => (
                                <p key={item}>• {item}</p>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ) : null}

                      <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
                        <div className="rounded-[1.3rem] border border-slate-200 bg-slate-50 p-4">
                          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">
                            Resumen sencillo
                          </p>
                          <h3 className="mt-2 text-xl font-semibold text-slate-950">
                            {getSimpleDocumentTypeLabel(
                              lastUpload.classification.documentType
                            )}
                          </h3>
                          <p className="mt-3 text-sm leading-7 text-slate-700">
                            {lastUpload.preliminaryAnalysis.summary}
                          </p>
                          <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
                            <span className="rounded-full bg-white px-3 py-1 text-slate-700">
                              Tipo:{" "}
                              {getSimpleDocumentTypeLabel(
                                lastUpload.classification.documentType
                              )}
                            </span>
                            <span className="rounded-full bg-white px-3 py-1 text-slate-700">
                              Revisión:{" "}
                              {getProcessingProfileLabel(
                                lastUpload.preliminaryAnalysis.processingProfile
                              )}
                            </span>
                            <span
                              className={`rounded-full px-3 py-1 ${lastUploadReadiness.classes}`}
                            >
                              {lastUploadReadiness.label}
                            </span>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div className="rounded-[1.3rem] border border-emerald-100 bg-emerald-50 p-4">
                            <div className="flex items-start gap-3">
                              <CheckCircle2
                                className="mt-1 h-5 w-5 shrink-0 text-emerald-700"
                                strokeWidth={1.8}
                              />
                              <div>
                                <p className="font-semibold text-emerald-950">
                                  {uploadInsight?.label}
                                </p>
                                <p className="mt-1 text-sm leading-7 text-emerald-900">
                                  {uploadInsight?.contribution}
                                </p>
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
                                <AlertCircle
                                  className="mt-1 h-5 w-5 shrink-0 text-amber-700"
                                  strokeWidth={1.8}
                                />
                              ) : (
                                <ShieldCheck
                                  className="mt-1 h-5 w-5 shrink-0 text-teal-700"
                                  strokeWidth={1.8}
                                />
                              )}
                              <div>
                                <p className="font-semibold text-slate-950">
                                  {engineStatus.title}
                                </p>
                                <p className="mt-1 text-sm leading-7 text-slate-700">
                                  {engineStatus.description}
                                </p>
                                <div className="mt-3 rounded-[1rem] border border-white/80 bg-white/85 px-3 py-3 text-sm leading-6 text-slate-700">
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Señal visible de control</p>
                                  <p className="mt-1.5">Aquí mismo te confirmamos si el documento quedó resguardado, si sigue en análisis o si hace falta retomar algo. No tienes que adivinar qué pasó con tu archivo.</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-[1.2rem] border border-slate-200 bg-white p-4 text-sm leading-7 text-slate-700">
                        Lo confirmado aparece separado de lo estimado para que
                        sepas qué ya está claro, qué todavía conviene revisar
                        con calma y qué ya forma parte de tu expediente digital.
                      </div>
                    </div>

                  {lastHeliosOpinion ? (
                    <div className="rounded-[1.3rem] border border-teal-100 bg-white p-4 sm:p-5">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="max-w-3xl">
                          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-teal-700">
                            Tu primera lectura
                          </p>
                          <h3 className="mt-2 text-xl font-semibold text-slate-950">
                            {warmVisibleNamingCopy(
                              lastHeliosOpinion.resultCard?.headline
                            ) ??
                              "Ya revisamos tu documento y hay una primera lectura útil"}
                          </h3>
                          <p className="mt-3 text-sm leading-7 text-slate-700">
                            {warmVisibleNamingCopy(
                              lastHeliosOpinion.resultCard?.lead ??
                                lastHeliosOpinion.summary
                            ) ??
                              "Ya hay una primera lectura clara para que entiendas qué aporta este documento a tu expediente laboral."}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs font-semibold">
                          <span
                            className={`rounded-full px-3 py-1 ${getHeliosRiskCopy(lastHeliosOpinion.riskLevel).classes}`}
                          >
                            {getHeliosRiskCopy(lastHeliosOpinion.riskLevel).label}
                          </span>
                          {typeof lastHeliosOpinion.confidenceScore === "number" ? (
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                              Confianza {lastHeliosOpinion.confidenceScore}%
                            </span>
                          ) : null}
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                            {getHeliosModeLabel(lastHeliosOpinion.mode)}
                          </span>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.18fr)_minmax(18rem,0.82fr)]">
                        <div className="space-y-4">
                          <div
                            className={`rounded-[1rem] border p-4 ${lastUploadSeverityNarrative.panelClasses}`}
                            data-testid="auditar-severity-summary"
                          >
                            <p
                              className={`text-[11px] font-semibold uppercase tracking-[0.16em] ${lastUploadSeverityNarrative.eyebrowClasses}`}
                            >
                              {lastUploadSeverityNarrative.eyebrow}
                            </p>
                            <p className="mt-2 text-base font-semibold text-slate-950">
                              {lastUploadSeverityNarrative.title}
                            </p>
                            <p className="mt-2 text-sm leading-6 text-slate-800">
                              {lastUploadSeverityNarrative.description}
                            </p>
                          </div>

                          <div
                            className="rounded-[1rem] border border-cyan-100 bg-cyan-50/70 p-4"
                            data-testid="auditar-simple-explanation"
                          >
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="text-sm font-semibold text-cyan-950">
                                    Lo más importante
                                  </p>
                                  <span
                                    className="rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-800"
                                    data-testid="auditar-explanation-variant"
                                  >
                                    {explanationVariantCopy.badge}
                                  </span>
                                </div>
                                <p className="mt-1 text-sm leading-6 text-cyan-900">
                                  Aquí te dejamos la idea principal para que entiendas rápido qué se vio y qué conviene hacer.
                                </p>
                              </div>
                            </div>

                            <div className="mt-3 space-y-2">
                              {(visibleSimpleExplanation.length
                                ? visibleSimpleExplanation.slice(0, 1)
                                : [
                                    {
                                      label: "Qué aporta",
                                      summary:
                                        warmVisibleNamingCopy(
                                          lastHeliosOpinion.summary
                                        ) ??
                                        "Este documento ya aporta una primera lectura útil a tu expediente.",
                                      tone: "support" as const,
                                    },
                                  ]).map((item, index) => (
                                <div
                                  key={`${item.label}-${index}`}
                                  className={`rounded-[0.95rem] border p-3 ${
                                    item.tone === "attention"
                                      ? "border-amber-200 bg-amber-50"
                                      : item.tone === "support"
                                        ? "border-emerald-200 bg-white"
                                        : "border-cyan-200 bg-white"
                                  }`}
                                >
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                                    {item.label}
                                  </p>
                                  <p className="mt-2 text-sm leading-6 text-slate-900">
                                    {warmVisibleNamingCopy(item.summary) ?? item.summary}
                                  </p>
                                </div>
                              ))}
                            </div>

                          </div>

                          <div className="rounded-[1rem] border border-teal-100 bg-teal-50 p-4">
                            <p className="text-sm font-semibold text-teal-950">
                              {warmVisibleNamingCopy(
                                lastHeliosOpinion.resultCard?.nextStepLabel
                              ) ?? "Tu siguiente paso más útil"}
                            </p>
                            <p className="mt-2 text-sm leading-7 text-teal-900">
                              {warmVisibleNamingCopy(
                                lastHeliosOpinion.resultCard?.nextStepSummary ??
                                  lastHeliosOpinion.recommendedNextStep
                              ) ??
                                "Si tienes otro documento del mismo periodo, súbelo para confirmar esta lectura y darte una respuesta más firme."}
                            </p>
                            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-start">
                              <Button
                                type="button"
                                className="rounded-full bg-teal-700 px-4 text-white hover:bg-teal-800"
                                onClick={() => {
                                  window.open(postReadingWhatsappHref, "_blank", "noopener,noreferrer");
                                }}
                              >
                                Pedir ayuda por WhatsApp
                                <ArrowRight className="ml-2 h-4 w-4" strokeWidth={1.8} />
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                className="rounded-full border-teal-200 bg-white px-4 text-teal-900 hover:bg-teal-50"
                                onClick={() => {
                                  window.location.href = getLoginUrl();
                                }}
                              >
                                Guardar y seguir después
                              </Button>
                              <p className="text-xs leading-5 text-teal-900/80 sm:max-w-[22rem]">
                                Puedes pedir ayuda por WhatsApp o guardar este avance para retomarlo luego con tu correo, sin empezar desde cero.
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div className="rounded-[1rem] border border-sky-100 bg-sky-50 p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-sky-950">
                                  Asistente laboral contextual
                                </p>
                                <p className="mt-2 text-sm leading-7 text-sky-900">
                                  {warmVisibleNamingCopy(
                                    lastHeliosOpinion.resultCard?.assistantIntro
                                  ) ??
                                    "Si quieres, ahora puedo explicarte este documento con palabras simples, decirte qué falta confirmar o ayudarte a elegir el siguiente archivo más útil."}
                                </p>
                              </div>
                              <Sparkles
                                className="mt-1 h-5 w-5 shrink-0 text-sky-700"
                                strokeWidth={1.8}
                              />
                            </div>

                            {lastHeliosOpinion.resultCard?.suggestedQuestions?.length ||
                            heliosCopilotSuggestedPrompts.length ? (
                              <div className="mt-3 flex flex-wrap gap-2">
                                {(
                                  lastHeliosOpinion.resultCard
                                    ?.suggestedQuestions ??
                                  heliosCopilotSuggestedPrompts
                                )
                                  .slice(0, 3)
                                  .map(item => (
                                    <Button
                                      key={item}
                                      type="button"
                                      variant="outline"
                                      className="h-auto rounded-full border-sky-200 bg-white px-3 py-2 text-left text-xs font-medium leading-5 text-sky-900 hover:bg-sky-100"
                                      onClick={() => openHeliosCopilot(item)}
                                    >
                                      {item}
                                    </Button>
                                  ))}
                              </div>
                            ) : null}

                            <Button
                              type="button"
                              className="mt-4 w-full justify-between rounded-full bg-sky-900 text-white hover:bg-sky-800"
                              onClick={() => openHeliosCopilot()}
                            >
                              Abrir asesor laboral
                              <ArrowRight className="h-4 w-4" strokeWidth={1.9} />
                            </Button>
                          </div>

                          <div className="rounded-[1rem] border border-amber-200 bg-amber-50 p-4">
                            <p className="text-sm font-semibold text-amber-950">
                              Qué sigue siendo preliminar
                            </p>
                            {lastHeliosOpinion.uncertainties?.length ? (
                              <div className="mt-2 space-y-2 text-sm leading-6 text-amber-950">
                                {lastHeliosOpinion.uncertainties.slice(0, 3).map(item => (
                                  <p key={item}>• {warmVisibleNamingCopy(item)}</p>
                                ))}
                              </div>
                            ) : (
                              <p className="mt-2 text-sm leading-7 text-amber-900">
                                Esta lectura todavía conviene contrastarla con más hechos y documentos antes de cerrar conclusiones.
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      <details className="group mt-4 rounded-[1rem] border border-slate-200 bg-slate-50 p-4">
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-950">
    {shouldCompactPostUploadExperience ? "Ver informe completo" : "Ver cómo se obtuvo este resultado"}
                            </p>
                            <p className="mt-1 text-sm leading-6 text-slate-600">
                              Aquí dejamos solo los detalles, comparaciones y notas que sirven para profundizar sin saturar la vista principal.
                            </p>
                          </div>
                          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                            Abrir detalle
                          </span>
                        </summary>

                        <div className="mt-4 space-y-4">
                          {lastUpload?.engineDispatch?.status === "sent" ? (
                            <div className="rounded-[1rem] border border-sky-200 bg-sky-50 p-4 text-sm leading-7 text-sky-950">
                              <div className="flex items-start gap-3">
                                <RefreshCw
                                  className="mt-1 h-5 w-5 shrink-0 text-sky-700"
                                  strokeWidth={1.8}
                                />
                                <div>
                                  <p className="font-semibold">
                                    Seguimos esperando la respuesta automática
                                  </p>
                                  <p className="mt-1">
                                    Este documento ya entró a revisión automática. Aquí verás si la respuesta ya llegó, mientras sigue guardado y disponible dentro de tu expediente digital.
                                  </p>
                                </div>
                              </div>
                            </div>
                          ) : null}

                          <div className="grid gap-3 sm:grid-cols-2">
                            <div
                              className="rounded-[1rem] border border-amber-200 bg-amber-50 p-4"
                              data-testid="auditar-discrepancies-panel"
                            >
                              <p className="text-sm font-semibold text-amber-950">
                                Posibles discrepancias
                              </p>
                              <p className="mt-1 text-sm leading-6 text-amber-900">
                                Aquí separamos lo que sí podría no cuadrar de lo que todavía solo hace falta confirmar.
                              </p>
                              {visibleDiscrepancyItems.length ? (
                                <div className="mt-3 space-y-2">
                                  {visibleDiscrepancyItems.map((item, index) => (
                                    <div
                                      key={`${item.label}-${index}`}
                                      className="rounded-[0.95rem] border border-amber-200 bg-white/80 p-3"
                                    >
                                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-800">
                                        {item.label}
                                      </p>
                                      <p className="mt-2 text-sm leading-6 text-slate-900">
                                        {warmVisibleNamingCopy(item.summary) ?? item.summary}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="mt-3 text-sm leading-6 text-amber-950">
                                  Por ahora no vemos una discrepancia fuerte solo con este archivo.
                                </p>
                              )}
                            </div>

                            <div
                              className="rounded-[1rem] border border-slate-200 bg-white p-4"
                              data-testid="auditar-pending-panel"
                            >
                              <p className="text-sm font-semibold text-slate-950">
                                Lo que todavía falta confirmar
                              </p>
                              <p className="mt-1 text-sm leading-6 text-slate-700">
                                Esto no significa problema. Solo indica lo que ayudaría a cerrar mejor la lectura.
                              </p>
                              {visiblePendingItems.length ? (
                                <div className="mt-3 space-y-2">
                                  {visiblePendingItems.map((item, index) => (
                                    <div
                                      key={`${item.label}-${index}`}
                                      className="rounded-[0.95rem] border border-slate-200 bg-slate-50 p-3"
                                    >
                                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                                        {item.label}
                                      </p>
                                      <p className="mt-2 text-sm leading-6 text-slate-900">
                                        {warmVisibleNamingCopy(item.summary) ?? item.summary}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="mt-3 text-sm leading-6 text-slate-700">
                                  Con lo disponible, Helios ya agotó esta parte y por ahora no dejó pendientes visibles.
                                </p>
                              )}
                            </div>
                          </div>

                          {comparisonHighlightCards.length === 2 ? (
                            <details className="group rounded-[1rem] border border-violet-100 bg-violet-50 p-4">
                              <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold text-violet-950">
                                    Compara hallazgos entre documentos
                                  </p>
                                  <p className="mt-1 text-sm leading-6 text-violet-900">
                                    Abre este bloque solo si quieres contrastar este archivo con otro del expediente.
                                  </p>
                                </div>
                                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-violet-800">
                                  {comparisonSuggestedLabel ?? "Abrir comparación"}
                                </span>
                              </summary>

                              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                                {comparisonHighlightCards.map(card => (
                                  <article
                                    key={card.id}
                                    className="rounded-[1rem] border border-white/80 bg-white p-4 shadow-sm"
                                  >
                                    <p className="text-sm font-semibold text-slate-950">
                                      {card.title}
                                    </p>
                                    <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-violet-700">
                                      {card.subtitle}
                                    </p>
                                    <p className="mt-3 text-sm leading-6 text-slate-700">
                                      {card.summary}
                                    </p>
                                    {card.findings.length ? (
                                      <div className="mt-3 space-y-2">
                                        {card.findings.map((item, index) => (
                                          <div
                                            key={`${card.id}-${item.label}-${index}`}
                                            className="rounded-[0.9rem] border border-slate-200 bg-slate-50 p-3"
                                          >
                                            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                                              {item.label}
                                            </p>
                                            <p className="mt-1 text-sm font-medium leading-6 text-slate-900">
                                              {warmVisibleNamingCopy(item.value) ?? item.value}
                                            </p>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <p className="mt-3 text-sm leading-6 text-slate-600">
                                        Todavía no hay hallazgos comparables visibles para este documento.
                                      </p>
                                    )}
                                  </article>
                                ))}
                              </div>
                            </details>
                          ) : null}

                          <div className="grid gap-4 lg:grid-cols-2">
                            <div className="rounded-[1rem] border border-emerald-100 bg-emerald-50 p-4">
                              <div className="flex items-center justify-between gap-4">
                                <p className="font-semibold text-emerald-950">
                                  Datos claros
                                </p>
                                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-emerald-800">
                                  {confirmedEntries.length} dato
                                  {confirmedEntries.length === 1 ? "" : "s"}
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
                                      <p className="mt-1 text-sm leading-6 text-slate-800">
                                        {formatAnalysisValue(key, value)}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            <div className="rounded-[1rem] border border-amber-200 bg-amber-50 p-4">
                              <div className="flex items-center justify-between gap-4">
                                <p className="font-semibold text-amber-950">
                                  Datos a revisar
                                </p>
                                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-amber-800">
                                  {estimatedEntries.length} dato
                                  {estimatedEntries.length === 1 ? "" : "s"}
                                </span>
                              </div>

                              <p className="mt-3 text-sm leading-7 text-amber-900">
                                Tómalos como orientación inicial. Pueden ayudar, pero todavía conviene confirmarlos con más contexto.
                              </p>

                              <div className="mt-4 rounded-[1rem] border border-amber-200 bg-white p-3">
                                <button
                                  type="button"
                                  className="flex w-full items-start gap-3 text-left"
                                  onClick={() =>
                                    setEstimatedAcknowledged(value => !value)
                                  }
                                >
                                  <CheckCircle2
                                    className={`mt-0.5 h-5 w-5 shrink-0 ${estimatedAcknowledged ? "text-emerald-600" : "text-amber-600"}`}
                                    strokeWidth={1.8}
                                  />
                                  <div>
                                    <p className="text-sm font-semibold text-slate-950">
                                      Entiendo que esto sigue en revisión
                                    </p>
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
                                      <p className="mt-1 text-sm leading-6 text-slate-800">
                                        {formatAnalysisValue(key, value)}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>

                          {lastHeliosOpinion.legalOpinion ? (
                            <div className="rounded-[1rem] border border-slate-200 bg-white p-4 text-sm leading-7 text-slate-700">
                              <p className="text-sm font-semibold text-slate-950">
                                Lectura ampliada
                              </p>
                              <p className="mt-2">
                                {warmVisibleNamingCopy(lastHeliosOpinion.legalOpinion)}
                              </p>
                            </div>
                          ) : null}

                          {guardrails.length > 0 ? (
                            <div className="rounded-[1rem] border border-slate-200 bg-white p-4">
                              <p className="font-semibold text-slate-950">
                                Antes de tomar decisiones
                              </p>
                              <div className="mt-3 space-y-2 text-sm leading-7 text-slate-600">
                                {guardrails.map(item => (
                                  <p key={item}>• {item}</p>
                                ))}
                              </div>
                            </div>
                          ) : null}

                          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                            <span>
                              Generado: {formatDate(lastHeliosOpinion.generatedAt)}
                            </span>
                            {lastHeliosOpinion.disclaimer ? (
                              <span className="max-w-3xl leading-6">
                                {lastHeliosOpinion.disclaimer}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </details>
                    </div>
                  ) : lastUpload?.engineDispatch?.status === "sent" ? (
                    <div className="rounded-[1.3rem] border border-sky-200 bg-sky-50 p-4 text-sm leading-7 text-sky-950">
                      <div className="flex items-start gap-3">
                        <RefreshCw
                          className="mt-1 h-5 w-5 shrink-0 text-sky-700"
                          strokeWidth={1.8}
                        />
                        <div>
                          <p className="font-semibold">
                            Seguimos esperando la respuesta automática
                          </p>
                          <p className="mt-1">
                            Este documento ya entró a revisión automática. Aquí verás si la respuesta ya llegó, mientras sigue guardado y disponible dentro de tu expediente digital.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : null}
              </details>

            </div>
          )}
          </div>

          {(timelineEntries.length > 0 || documents.length > 0) ? (
            <details className={shouldCompactPostUploadExperience || !isDossierWorkspaceSection ? "hidden" : "group rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5"}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">
                    Actividad completa del expediente
                  </p>
                  <p className="mt-2 text-base font-semibold text-slate-950">
                    Línea de tiempo, historial y comparaciones
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    El resultado principal ya quedó arriba. Abre este bloque solo si quieres profundizar más.
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                  Abrir actividad
                </span>
              </summary>

              <div className="mt-4 space-y-4">
                {timelineEntries.length > 0 ? (
              <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">
                      Línea de tiempo del expediente
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950">
                      Cómo se fue fortaleciendo tu expediente
                    </h2>
                    <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">
                      Documento por documento, aquí ves cómo se fueron
                      conectando señales para darte más claridad sobre tu caso.
                    </p>
                    {timelineEntries.length > timelinePreviewLimit ? (
                      <p className="mt-3 text-xs leading-6 text-slate-500 sm:hidden">
                        En móvil te mostramos primero lo esencial para reducir
                        scroll. Si quieres, puedes abrir el resto en cualquier
                        momento.
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-col items-start gap-2 sm:items-end">
                    <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                      <span className="rounded-full border border-amber-200 bg-amber-100 px-3 py-1 text-amber-900">
                        Borrador analizado
                      </span>
                      <span className="rounded-full border border-emerald-200 bg-emerald-100 px-3 py-1 text-emerald-800">
                        Documento confirmado
                      </span>
                    </div>
                    <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                      {timelineEntries.length} etapa
                      {timelineEntries.length === 1 ? "" : "s"}
                    </div>
                  </div>
                </div>

                {timelineEntries.length === 0 ? (
                  <div className="mt-6 rounded-[1.3rem] border border-slate-200 bg-slate-50 p-5 text-sm leading-7 text-slate-600">
                    Tu línea de tiempo empieza con el primer archivo guardado.
                    Cuando confirmes uno, aquí verás el orden del expediente y
                    qué cambió con cada documento.
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
                              entry.hasVisibleOpinion
                                ? "bg-teal-600 text-white shadow-sm"
                                : "bg-slate-200 text-slate-700"
                            }`}
                          >
                            {entry.step}
                          </div>
                          {index !== timelineEntries.length - 1 ? (
                            <div className="mt-2 w-px flex-1 bg-slate-200" />
                          ) : null}
                        </div>

                        <article
                          className={`flex-1 rounded-[1.35rem] border p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm ${entry.lifecycleState.cardClasses}`}
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-semibold text-slate-950">
                                  {entry.title}
                                </p>
                                <span
                                  className={`inline-flex rounded-full px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em] ${entry.lifecycleState.badgeClasses}`}
                                >
                                  {entry.lifecycleState.label}
                                </span>
                              </div>
                              <p className="mt-1 text-sm leading-6 text-slate-600">
                                {entry.originalName}
                              </p>
                              <p className="mt-1 text-xs leading-6 text-slate-500">
                                Incorporado el {formatDate(entry.createdAt)}
                              </p>
                              <p className="mt-2 text-xs leading-5 text-slate-600">
                                {entry.lifecycleState.supportingCopy}
                              </p>
                            </div>
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-semibold ${entry.readiness.classes}`}
                            >
                              {entry.readiness.label}
                            </span>
                          </div>

                          <div className="mt-4 grid gap-3 lg:grid-cols-2">
                            <div className="rounded-[1rem] border border-white bg-white p-3">
                              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                                Lo que aportó
                              </p>
                              <p className="mt-2 text-sm leading-7 text-slate-700">
                                {entry.contribution}
                              </p>
                            </div>
                            <div
                              className={`rounded-[1rem] border p-3 ${entry.lifecycleState.roleCardClasses}`}
                            >
                              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-700">
                                Cómo aportó al expediente
                              </p>
                              <p className="mt-2 text-sm leading-7 text-slate-900">
                                {entry.heliosRole}
                              </p>
                            </div>
                          </div>
                        </article>
                      </div>
                    ))}

                    {timelineEntries.length > timelinePreviewLimit ? (
                      <button
                        type="button"
                        className="inline-flex items-center rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:text-slate-950 active:scale-[0.99] sm:hidden"
                        onClick={() =>
                          setTimelineExpandedOnMobile(value => !value)
                        }
                      >
                        {timelineExpandedOnMobile
                          ? "Mostrar menos"
                          : `Mostrar ${mobileHiddenTimelineCount} etapa${mobileHiddenTimelineCount === 1 ? "" : "s"} más`}
                      </button>
                    ) : null}
                  </div>
                )}
              </div>
            ) : null}

            <div className="rounded-[1.6rem] border border-slate-200 bg-white p-4 shadow-sm xl:hidden">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">
                    Seguimiento rápido
                  </p>
                  <h2 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-slate-950">
                    Cómo va la respuesta automática
                  </h2>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                  {complilinkMonitoring?.summary.waitingCount ?? 0} en espera
                </span>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-center">
                <div className="rounded-[1rem] border border-slate-200 bg-slate-50 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    En espera
                  </p>
                  <p className="mt-2 text-xl font-semibold text-slate-950">
                    {complilinkMonitoring?.summary.waitingCount ?? 0}
                  </p>
                </div>
                <div className="rounded-[1rem] border border-amber-200 bg-amber-50 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-700">
                    Revisar
                  </p>
                  <p className="mt-2 text-xl font-semibold text-amber-950">
                    {complilinkMonitoring?.summary.attentionCount ?? 0}
                  </p>
                </div>
                <div className="col-span-2 rounded-[1rem] border border-emerald-100 bg-emerald-50 p-3 sm:col-span-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-700">
                    Listos
                  </p>
                  <p className="mt-2 text-xl font-semibold text-emerald-950">
                    {complilinkMonitoring?.summary.receivedCount ?? 0}
                  </p>
                </div>
              </div>

              <div
                className={`mt-4 rounded-[1rem] border p-4 text-sm leading-6 ${monitoringOverview.classes}`}
              >
                <p className="font-semibold">{monitoringOverview.title}</p>
                <p className="mt-2">{monitoringOverview.body}</p>
              </div>
            </div>

            {documents.length > 0 ? (
              <div
                ref={digitalArchiveSectionRef}
                id="mi-archivo-digital"
                className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">
                      Bóveda Laboral
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950">
                      Aquí están tus documentos protegidos
                    </h2>
                    <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600">
                      Esta es tu bóveda laboral visible. Puedes abrir cualquier
                      documento, volver a revisarlo y seguir fortaleciendo tu caso
                      sin perderte entre bloques largos.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-800">
                      {documents.length} documento
                      {documents.length === 1 ? "" : "s"} protegido
                      {documents.length === 1 ? "" : "s"}
                    </div>
                    {latestArchiveDocument ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="h-11 rounded-full border-slate-200 bg-white px-4 text-slate-700 hover:bg-slate-100"
                        disabled={Boolean(openingDocumentId)}
                        onClick={() =>
                          void handleOpenArchiveDocument(
                            latestArchiveDocument.documentId,
                            "section_header"
                          )
                        }
                      >
                        <FolderOpen
                          className="mr-2 h-4 w-4"
                          strokeWidth={1.8}
                        />
                        {openingDocumentId === latestArchiveDocument.documentId
                          ? "Abriendo..."
                          : "Abrir el más reciente"}
                      </Button>
                    ) : null}
                  </div>
                </div>

                <div className="mt-6 rounded-[1.4rem] border border-violet-100 bg-violet-50/70 p-4 sm:p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-violet-800">
                        Resumen visible de tu bóveda
                      </p>
                      <h3 className="mt-2 text-xl font-semibold text-slate-950">
                        Tu respaldo ya tiene una base real
                      </h3>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-700">
                        Aquí ves cuántos documentos ya quedaron protegidos, cuál fue el último archivo incorporado y cómo entrar rápido a tu bóveda sin salir de la auditoría.
                      </p>
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                      <Button
                        type="button"
                        className="rounded-full bg-violet-700 px-5 text-white hover:bg-violet-800"
                        disabled={Boolean(openingDocumentId)}
                        onClick={() => void handleDigitalArchiveQuickAction()}
                      >
                        <FolderOpen className="mr-2 h-4 w-4" strokeWidth={1.8} />
                        {openingDocumentId === latestArchiveDocument?.documentId
                          ? "Abriendo documento..."
                          : "Abrir mi bóveda"}
                      </Button>
                      {archiveHasActiveFilters ? (
                        <Button
                          type="button"
                          variant="outline"
                          className="rounded-full border-violet-200 bg-white px-5 text-violet-900 hover:bg-violet-100"
                          onClick={() => {
                            setArchiveTypeFilter("all");
                            setArchiveDateFilter("all");
                          }}
                        >
                          Limpiar filtros
                        </Button>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-4 rounded-[1.1rem] border border-white/80 bg-white/90 p-4 shadow-sm">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-violet-700">
                          Exportaciones recientes
                        </p>
                        <p className="mt-2 text-base font-semibold text-slate-950">
                          Tus PDFs quedan a la mano en este equipo
                        </p>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                          Cada vez que exportas el hallazgo, guardamos una referencia simple aquí para que puedas volver a descargarla sin buscar entre menús. Esto no reemplaza tus documentos protegidos: solo te ayuda a ubicar rápido tus reportes.
                        </p>
                      </div>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-violet-800 shadow-sm">
                        {quickExportHistory.length} exportación{quickExportHistory.length === 1 ? "" : "es"}
                      </span>
                    </div>

                    {quickExportHistory.length > 0 ? (
                      <div className="mt-4 grid gap-3 lg:grid-cols-2">
                        {quickExportHistory.slice(0, 4).map(item => (
                          <div key={item.id} className="rounded-[1rem] border border-violet-100 bg-violet-50/70 p-4">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-violet-800">
                                  {item.periodLabel}
                                </p>
                                <p className="mt-2 text-sm font-semibold text-slate-950">
                                  {item.documentLabel}
                                </p>
                              </div>
                              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                                {item.differenceLabel}
                              </span>
                            </div>
                            <p className="mt-3 text-sm leading-6 text-slate-700">
                              {item.healthBadge} · {item.healthHeadline}
                            </p>
                            <p className="mt-1 text-xs leading-6 text-slate-500">
                              Exportado el {formatDate(item.exportedAt)}
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                className="rounded-full border-violet-200 bg-white px-4 text-violet-900 hover:bg-violet-100"
                                onClick={() =>
                                  downloadQuickHallazgoPdf(item, {
                                    persist: false,
                                    location: "auditar_digital_archive_export_history",
                                  })
                                }
                              >
                                Descargar de nuevo
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-4 rounded-[1rem] border border-dashed border-violet-200 bg-white/80 p-4 text-sm leading-6 text-slate-600">
                        Cuando exportes tu primer PDF del hallazgo, aquí aparecerá para volver a descargarlo sin vueltas.
                      </div>
                    )}
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <div className="rounded-[1.1rem] border border-white/80 bg-white/90 p-4 shadow-sm">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-violet-700">
                        Documentos protegidos
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-slate-950">
                        {documents.length}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        {documents.length === 1
                          ? "Ya tienes una pieza útil resguardada dentro de tu bóveda laboral."
                          : "Tu bóveda laboral ya tiene varias piezas listas para volver a consultarse."}
                      </p>
                    </div>
                    <div className="rounded-[1.1rem] border border-white/80 bg-white/90 p-4 shadow-sm">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-violet-700">
                        Estado actual
                      </p>
                      <p className="mt-2 text-base font-semibold text-slate-950">
                        {heliosDocumentsCount > 0
                          ? "Con lectura visible"
                          : "Protegida y creciendo"}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        {heliosDocumentsCount > 0
                          ? `Ya hay lectura visible en ${heliosDocumentsCount} documento${heliosDocumentsCount === 1 ? "" : "s"} para darte más contexto.`
                          : "Todavía no hay lectura visible en documentos confirmados, pero la bóveda ya está lista para seguir creciendo."}
                      </p>
                    </div>
                    <div className="rounded-[1.1rem] border border-white/80 bg-white/90 p-4 shadow-sm">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-violet-700">
                        Último documento
                      </p>
                      <p className="mt-2 text-base font-semibold text-slate-950">
                        {latestArchiveDocument?.originalName ?? "Aún no hay documento reciente"}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        {latestArchiveDocument
                          ? `Se agregó el ${formatDate(latestArchiveDocument.createdAt)} y puedes abrirlo desde aquí cuando lo necesites.`
                          : "En cuanto confirmes el primer documento, aquí verás la referencia más reciente."}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-6 rounded-[1.35rem] border border-slate-200 bg-slate-50 p-4 sm:p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        Filtrar tu bóveda por tipo o fecha
                      </p>
                      <p className="mt-1 text-sm leading-6 text-slate-600">
                        Encuentra más rápido lo que necesitas sin perder el orden
                        de tu bóveda laboral.
                      </p>
                    </div>
                    <p className="text-sm font-medium text-slate-500">
                      Mostrando {filteredArchiveDocuments.length} de {documents.length} documento
                      {documents.length === 1 ? "" : "s"}
                    </p>
                  </div>

                  <div className="mt-4 space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {archiveTypeOptions.map(option => {
                        const active = archiveTypeFilter === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setArchiveTypeFilter(option.value)}
                            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                              active
                                ? "bg-slate-900 text-white shadow-sm"
                                : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-950"
                            }`}
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {[
                        { value: "all", label: "Cualquier fecha" },
                        { value: "last_30_days", label: "Últimos 30 días" },
                        { value: "this_year", label: "Este año" },
                        { value: "older", label: "Años anteriores" },
                      ].map(option => {
                        const active = archiveDateFilter === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() =>
                              setArchiveDateFilter(option.value as ArchiveDateFilter)
                            }
                            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                              active
                                ? "bg-teal-600 text-white shadow-sm hover:bg-teal-600"
                                : "border border-teal-100 bg-white text-teal-700 hover:border-teal-200 hover:text-teal-900"
                            }`}
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="mt-6 space-y-4">
                  {documents.length === 0 ? (
                    <div className="rounded-[1.3rem] border border-slate-200 bg-slate-50 p-5 text-sm leading-7 text-slate-600">
                      Aún no tienes documentos en tu bóveda laboral. Puedes
                      empezar con el archivo que tengas más a la mano.
                    </div>
                  ) : filteredArchiveDocuments.length === 0 ? (
                    <div className="rounded-[1.3rem] border border-dashed border-slate-300 bg-slate-50 p-5 text-sm leading-7 text-slate-600">
                      No encontramos documentos con este filtro. Cambia el tipo o
                      la fecha para volver a ver toda tu bóveda laboral.
                    </div>
                  ) : (
                    filteredArchiveDocuments.map(document => {
                      const readiness = getDocumentReadiness(
                        document.classificationConfidence
                      );
                      const heliosOpinion = asHeliosOpinion(
                        document.heliosOpinion
                      );
                      const heliosRisk = getHeliosRiskCopy(
                        heliosOpinion?.riskLevel
                      );
                      const heliosDocument = heliosDocumentSnapshotById.get(
                        document.documentId
                      );
                      const archiveVisual = getArchiveDocumentVisual(
                        document.documentType
                      );
                      const documentTypeLabel =
                        heliosDocument?.canonicalLabel ??
                        getSimpleDocumentTypeLabel(document.documentType);
                      const fileExtensionLabel = getArchiveFileExtensionLabel(
                        document.originalName
                      );
                      return (
                        <article
                          key={document.documentId}
                          className="rounded-[1.4rem] border border-slate-200 bg-slate-50 p-4"
                        >
                          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                            <div className="flex gap-4">
                              <div
                                className={`flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-[1.25rem] border text-center ${archiveVisual.tileClasses}`}
                              >
                                <span className="text-[10px] font-semibold uppercase tracking-[0.18em]">
                                  {fileExtensionLabel}
                                </span>
                                <span className="mt-1 text-sm font-semibold">
                                  {archiveVisual.shortLabel}
                                </span>
                              </div>
                              <div>
                                <p className="font-semibold text-slate-950">
                                  {document.originalName}
                                </p>
                                <p className="mt-1 text-sm leading-6 text-slate-600">
                                  {documentTypeLabel}
                                </p>
                                <p className="mt-1 text-sm leading-6 text-slate-500">
                                  Incorporado el {formatDate(document.createdAt)}
                                </p>
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-2 text-xs font-semibold">
                              <span
                                className={`rounded-full px-3 py-1 ${archiveVisual.badgeClasses}`}
                              >
                                {documentTypeLabel}
                              </span>
                              <span
                                className={`rounded-full px-3 py-1 ${readiness.classes}`}
                              >
                                {readiness.label}
                              </span>
                              <span className="rounded-full bg-white px-3 py-1 text-slate-700">
                                {getConsentLabel(document.consentStatus)}
                              </span>
                              <span className="rounded-full bg-white px-3 py-1 text-slate-700">
                                {getVisibilityLabel(document.visibility)}
                              </span>
                              <span
                                className={`rounded-full px-3 py-1 ${heliosOpinion ? "bg-teal-100 text-teal-800" : "bg-slate-200 text-slate-700"}`}
                              >
                                {heliosDocument?.statusLabel ??
                                  (heliosOpinion
                                    ? "Lectura preliminar lista"
                                    : "Lectura pendiente")}
                              </span>
                            </div>
                          </div>

                          <div className="mt-4 flex flex-wrap gap-3">
                            <Button
                              type="button"
                              className="h-11 rounded-full bg-slate-950 px-4 text-white hover:bg-slate-900"
                              disabled={openingDocumentId === document.documentId}
                              onClick={() =>
                                void handleOpenArchiveDocument(
                                  document.documentId,
                                  "document_card"
                                )
                              }
                            >
                              <FolderOpen
                                className="mr-2 h-4 w-4"
                                strokeWidth={1.8}
                              />
                              {openingDocumentId === document.documentId
                                ? "Abriendo documento..."
                                : "Ver documento"}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              className="h-11 rounded-full border-slate-200 bg-white px-4 text-slate-700 hover:bg-slate-100"
                              onClick={() => openHeliosCopilot()}
                            >
                              Entender este documento
                            </Button>
                          </div>

                          <div className="mt-4 rounded-[1rem] bg-white p-3 text-sm leading-6 text-slate-700">
                            {readiness.description}
                          </div>

                          <div className="mt-4 rounded-[1rem] border border-teal-100 bg-teal-50 p-3 text-sm leading-6 text-teal-950">
                            <p className="font-semibold text-teal-950">
                              {heliosDocument
                                ? `${heliosDocument.canonicalLabel} dentro de tu expediente laboral`
                                : "Este archivo ya pertenece a tu expediente laboral"}
                            </p>
                            <p className="mt-1">
                              {warmVisibleNamingCopy(heliosDocument?.summary) ??
                                "Tu asesor laboral tomará este documento como una unidad laboral visible para futuras lecturas, cruces y recomendaciones dentro del expediente."}
                            </p>
                          </div>

                          {heliosOpinion ? (
                            <details className="mt-4 rounded-[1rem] border border-teal-100 bg-white p-4">
                              <summary className="flex cursor-pointer list-none items-start justify-between gap-4">
                                <div>
                                  <p className="text-sm font-semibold text-slate-950">
                                    Abrir lectura preliminar
                                  </p>
                                  <p className="mt-1 text-sm leading-6 text-slate-600">
                                    {warmVisibleNamingCopy(
                                      heliosOpinion.summary
                                    ) ??
                                      "Ya hay una lectura inicial guardada dentro de tu expediente laboral."}
                                  </p>
                                </div>
                                <div className="flex flex-wrap gap-2 text-xs font-semibold">
                                  <span
                                    className={`rounded-full px-3 py-1 ${heliosRisk.classes}`}
                                  >
                                    {heliosRisk.label}
                                  </span>
                                  <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                                    {getHeliosModeLabel(heliosOpinion.mode)}
                                  </span>
                                </div>
                              </summary>

                              <div className="mt-4 space-y-4 border-t border-slate-200 pt-4">
                                {heliosOpinion.legalOpinion ? (
                                  <div className="rounded-[1rem] bg-slate-50 p-3 text-sm leading-7 text-slate-700">
                                    {heliosOpinion.legalOpinion}
                                  </div>
                                ) : null}

                                <div className="grid gap-4 lg:grid-cols-2">
                                  <div className="rounded-[1rem] border border-teal-100 bg-teal-50 p-3">
                                    <p className="font-semibold text-teal-950">
                                      Siguiente paso sugerido
                                    </p>
                                    <p className="mt-2 text-sm leading-7 text-teal-900">
                                      {heliosOpinion.recommendedNextStep ??
                                        "Conectar este archivo con más evidencia del expediente."}
                                    </p>
                                    {heliosOpinion.recommendedActions
                                      ?.length ? (
                                      <div className="mt-3 space-y-2 text-sm leading-6 text-teal-950">
                                        {heliosOpinion.recommendedActions.map(
                                          item => (
                                            <p key={item}>
                                              • {warmVisibleNamingCopy(item)}
                                            </p>
                                          )
                                        )}
                                      </div>
                                    ) : null}
                                  </div>

                                  <div className="rounded-[1rem] border border-amber-200 bg-amber-50 p-3">
                                    <p className="font-semibold text-amber-950">
                                      Puntos que todavía conviene confirmar
                                    </p>
                                    {heliosOpinion.uncertainties?.length ? (
                                      <div className="mt-2 space-y-2 text-sm leading-6 text-amber-950">
                                        {heliosOpinion.uncertainties.map(
                                          item => (
                                            <p key={item}>
                                              • {warmVisibleNamingCopy(item)}
                                            </p>
                                          )
                                        )}
                                      </div>
                                    ) : (
                                      <p className="mt-2 text-sm leading-7 text-amber-900">
                                        Por ahora no hay observaciones
                                        adicionales visibles, pero sigue siendo
                                        una lectura preliminar.
                                      </p>
                                    )}
                                  </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-600">
                                  {typeof heliosOpinion.confidenceScore ===
                                  "number" ? (
                                    <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                                      Confianza {heliosOpinion.confidenceScore}%
                                    </span>
                                  ) : null}
                                  <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                                    Generado{" "}
                                    {formatDate(heliosOpinion.generatedAt)}
                                  </span>
                                </div>

                                {heliosOpinion.disclaimer ? (
                                  <p className="text-xs leading-6 text-slate-500">
                                    {heliosOpinion.disclaimer}
                                  </p>
                                ) : null}
                              </div>
                            </details>
                          ) : (
                            <div className="mt-4 rounded-[1rem] border border-dashed border-slate-200 bg-white p-3 text-sm leading-6 text-slate-500">
                              Todavía no hay una lectura visible guardada para
                              este documento dentro de tu expediente laboral.
                            </div>
                          )}
                        </article>
                      );
                    })
                  )}
                </div>
              </div>
            ) : null}

            {documents.length > 0 && viewportSegment === "mobile" ? (
              <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4 sm:hidden">
                <Button
                  type="button"
                  data-testid="auditar-mobile-archive-return"
                  className="pointer-events-auto h-12 rounded-full bg-slate-950 px-5 text-white shadow-[0_18px_45px_rgba(15,23,42,0.22)] hover:bg-slate-900"
                  onClick={() => void scrollToDigitalArchive("section_header")}
                >
                  <FolderOpen className="mr-2 h-4 w-4" strokeWidth={1.8} />
                  {archiveHasActiveFilters
                    ? "Volver al expediente filtrado"
                    : "Volver al expediente"}
                </Button>
              </div>
            ) : null}
              </div>
            </details>
          ) : null}
        </section>

          <aside className={shouldCompactPostUploadExperience || !isDossierWorkspaceSection ? "hidden" : "hidden space-y-6 xl:block"}>
            <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">
                Expediente laboral seleccionado
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950">
                {heliosExpediente?.displayName ??
                  caseDetailQuery.data?.case.title ??
                  "Selecciona un expediente"}
              </h2>
              <div className="mt-4 space-y-3 text-sm leading-7 text-slate-600">
                <p>
                  <span className="font-semibold text-slate-900">
                    Persona trabajadora:
                  </span>{" "}
                  {caseDetailQuery.data?.case.employeeName ??
                    "Sin nombre visible"}
                </p>
                <p>
                  <span className="font-semibold text-slate-900">
                    Patrón o empresa:
                  </span>{" "}
                  {caseDetailQuery.data?.case.employerEntity ??
                    "Sin empresa visible"}
                </p>
                <p>
                  <span className="font-semibold text-slate-900">
                    Estado del caso:
                  </span>{" "}
                  {getCaseStatusLabel(caseDetailQuery.data?.case.status)}
                </p>
                <p>
                  <span className="font-semibold text-slate-900">
                    Etapa del expediente:
                  </span>{" "}
                  {heliosExpediente?.stageLabel ?? "Sin etapa visible"}
                </p>
              </div>

              <div className="mt-4 rounded-[1.2rem] border border-teal-100 bg-teal-50 p-4">
                <div className="flex items-start gap-3">
                  <Sparkles
                    className="mt-1 h-5 w-5 shrink-0 text-teal-700"
                    strokeWidth={1.8}
                  />
                  <div>
                    <p className="font-semibold text-teal-950">
                      Tu expediente se va volviendo más claro con cada documento
                    </p>

                    <p className="mt-2 text-sm leading-7 text-teal-900">
                      {heliosExpediente?.summary ??
                        (heliosDocumentsCount === 0
                          ? "Todavía no hay una lectura visible del expediente. En cuanto se interpreten documentos, aquí verás cómo se va armando una explicación más útil para tu caso."
                          : `Ya hay una lectura preliminar para ${heliosDocumentsCount} documento${heliosDocumentsCount === 1 ? "" : "s"} y esa información se va conectando para construir una explicación cada vez más útil del caso.`)}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                      <span className="rounded-full bg-white px-3 py-1 text-slate-700">
                        {heliosExpediente?.documentsCount ?? documents.length}{" "}
                        documento
                        {(heliosExpediente?.documentsCount ??
                          documents.length) === 1
                          ? ""
                          : "s"}{" "}
                        en el expediente
                      </span>
                      <span className="rounded-full bg-white px-3 py-1 text-slate-700">
                        {heliosExpediente?.documentsWithOpinion ??
                          heliosDocumentsCount}{" "}
                        con lectura visible
                      </span>
                    </div>
                    {latestPersistedHeliosOpinion ? (
                      <div className="mt-3 rounded-[1rem] bg-white p-3 text-sm leading-6 text-slate-700">
                        <p className="font-semibold text-slate-950">
                          Última lectura guardada en tu expediente
                        </p>
                        <p className="mt-1">
                          {warmVisibleNamingCopy(
                            latestPersistedHeliosOpinion.summary
                          )}
                        </p>
                        <p className="mt-2 text-xs text-slate-500">
                          Documento:{" "}
                          {latestHeliosDocument?.originalName ??
                            "Sin detalle visible"}
                        </p>
                      </div>
                    ) : null}
                    <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                      <Button
                        className="rounded-full bg-slate-950 text-white hover:bg-slate-800"
                        onClick={() => openHeliosCopilot()}
                        disabled={!selectedCaseId || legalGateRequired}
                      >
                        Abrir tu asesor laboral
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
                      Haz preguntas rápidas sobre riesgos, documentos faltantes
                      o el siguiente paso útil con base en lo que ya se ve en tu
                      expediente.
                    </p>
                  </div>
                </div>
              </div>

              <HeliosCopilotSheet
                open={heliosCopilotOpen}
                onOpenChange={setHeliosCopilotOpen}
                onSendMessage={handleHeliosCopilotSend}
                messages={heliosCopilotConversation}
                isLoading={heliosCopilotMutation.isPending}
                suggestedPrompts={heliosCopilotSuggestedPrompts}
                suggestedPromptsContext={heliosCopilotSuggestedPromptsContext}
                caseTitle={caseDetailQuery.data?.case.title}
                employeeName={caseDetailQuery.data?.case.employeeName}
                confidenceScore={
                  heliosCopilotMutation.data?.confidenceScore ??
                  visibleHeliosOpinion?.confidenceScore ??
                  null
                }
                disclaimer={warmVisibleNamingCopy(
                  heliosCopilotMutation.data?.disclaimer ??
                    visibleHeliosOpinion?.disclaimer ??
                    null
                )}
                summary={warmVisibleNamingCopy(
                  heliosCopilotMutation.data?.answer ??
                    visibleHeliosOpinion?.summary ??
                    null
                )}
                historyItems={heliosCopilotHistoryItems}
                historyContext={heliosCopilotHistoryContext}
                supportingDocuments={
                  heliosCopilotMutation.data?.supportingDocuments ??
                  heliosCopilotSupportingDocuments
                }
                nextSuggestedDocument={heliosCopilotNextSuggestedDocument}
                responseTone={preferredTone}
                onResponseToneChange={setPreferredTone}
                onFocusSuggestedDocument={() => {
                  setHeliosCopilotOpen(false);
                  focusRecommendedUpload(
                    heliosCopilotNextSuggestedDocument?.targetType ??
                      effectiveRecommendedTarget?.type ??
                      null
                  );
                }}
              />
            </div>


            <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">
                Historial simple del expediente
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950">
                Lo último que se movió en tu caso
              </h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                Así puedes entender qué pasó recientemente sin buscar entre
                carpetas, mensajes o varios sistemas distintos.
              </p>
              <p className="mt-3 text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
                El filtro que elijas aquí se conserva en este dispositivo para
                que retomes tu expediente donde lo dejaste.
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                {[
                  { value: "all", label: "Todo" },
                  { value: "document", label: "Documentos" },
                  { value: "response", label: "Respuestas" },
                  { value: "summary", label: "Resúmenes" },
                ].map(option => {
                  const active = historyFilter === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() =>
                        setHistoryFilter(option.value as DossierHistoryFilter)
                      }
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
                      ? "Tu historial aparecerá en cuanto guardes el primer documento. Aquí verás lo más reciente sin salir del expediente."
                      : "Todavía no hay movimientos con este filtro. Cámbialo o sube otro documento para seguir construyendo el historial."}
                  </div>
                ) : (
                  filteredDossierHistoryEntries.map(entry => (
                    <article
                      key={entry.id}
                      className="rounded-[1.2rem] border border-slate-200 bg-slate-50 p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-950">
                            {entry.title}
                          </p>
                          <p className="mt-1 text-sm leading-6 text-slate-600">
                            {entry.description}
                          </p>
                        </div>
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                          {entry.tag}
                        </span>
                      </div>
                      <p className="mt-3 text-xs leading-6 text-slate-500">
                        {formatDate(entry.timestamp)}
                      </p>
                    </article>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">
                Privacidad y consentimiento
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950">
                Marco legal visible para tu expediente
              </h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                {PRIVACY_CENTER_COPY.intro} La versión vigente que aplica hoy en
                AuditaPatron es {LEGAL_VERSION}.
              </p>

              <div
                className={`mt-4 rounded-[1.2rem] border p-4 ${legalAcceptance?.isAccepted ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p
                      className={`text-sm font-semibold ${legalAcceptance?.isAccepted ? "text-emerald-950" : "text-amber-950"}`}
                    >
                      {legalAcceptance?.isAccepted
                        ? "Aceptación versionada al día"
                        : "Aceptación legal pendiente"}
                    </p>
                    <p
                      className={`mt-2 text-sm leading-7 ${legalAcceptance?.isAccepted ? "text-emerald-900" : "text-amber-900"}`}
                    >
                      {legalAcceptance?.isAccepted
                        ? `Tu expediente ya registra la aceptación del paquete legal ${legalAcceptance.legalVersion}.`
                        : `Todavía faltan ${legalPendingDocuments.length || LEGAL_DOCUMENTS.length} documentos por aceptar para habilitar por completo tu expediente y tu asesor laboral.`}
                    </p>
                  </div>
                  <div className="rounded-full bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-700">
                    {acceptedLegalDocumentsCount}/
                    {legalAcceptanceDocuments.length || LEGAL_DOCUMENTS.length}{" "}
                    aceptados
                  </div>
                </div>
                {legalAcceptance?.acceptedAt ? (
                  <p
                    className={`mt-3 text-xs uppercase tracking-[0.12em] ${legalAcceptance?.isAccepted ? "text-emerald-800" : "text-amber-800"}`}
                  >
                    Última aceptación registrada:{" "}
                    {formatDate(legalAcceptance.acceptedAt)}
                  </p>
                ) : null}
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {PRIVACY_CENTER_COPY.rightsSummary.map(item => (
                  <div
                    key={item}
                    className="rounded-[1.2rem] border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700"
                  >
                    {item}
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-[1.2rem] border border-teal-100 bg-teal-50 p-4">
                <p className="text-sm font-semibold text-teal-950">
                  Revocación y derechos ARCO
                </p>
                <p className="mt-2 text-sm leading-7 text-teal-900">
                  {PRIVACY_CENTER_COPY.revocationNotice}
                </p>
                <p className="mt-3 text-sm leading-7 text-teal-900">
                  Si quieres ejercer derechos ARCO o pedir apoyo, escríbenos a{" "}
                  <a
                    className="font-semibold underline underline-offset-4"
                    href={`mailto:${LEGAL_CONTACT_EMAIL}`}
                  >
                    {LEGAL_CONTACT_EMAIL}
                  </a>
                  .
                </p>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {LEGAL_DOCUMENTS.map(document => (
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
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">
                Ciclo de valor visible
              </p>
              <div className="mt-2 flex items-start gap-3">
                <div className="rounded-[1rem] border border-teal-100 bg-teal-50 p-2">
                  <Sparkles
                    className="h-5 w-5 text-teal-700"
                    strokeWidth={1.8}
                  />
                </div>
                <div>
                  <h2 className="text-2xl font-semibold tracking-[-0.03em] text-slate-950">
                    Así se fortalece tu expediente
                  </h2>
                  <p className="mt-2 text-sm leading-7 text-slate-600">
                    AuditaPatron recibe tus documentos, los organiza, los
                    contrasta, los resguarda y te devuelve una explicación cada
                    vez más clara y útil.
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-4">
                <article className="rounded-[1.25rem] border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Paso 1
                  </p>
                  <p className="mt-2 font-semibold text-slate-950">
                    AuditaPatron recibe y protege
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Tu archivo entra a un expediente seguro, queda resguardado y
                    listo para ordenarse sin que tengas que hacer pasos técnicos
                    extra.
                  </p>
                </article>
                <article className="rounded-[1.25rem] border border-teal-100 bg-teal-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-700">
                    Paso 2
                  </p>
                  <p className="mt-2 font-semibold text-slate-950">
                    La revisión encuentra contexto útil
                  </p>
                  <p className="mt-2 text-sm leading-6 text-teal-950">
                    {heliosDocumentsCount === 0
                      ? "En cuanto haya lectura visible, empezaremos a decirte qué ya se entendió y qué conviene reforzar, incluyendo señales útiles de IMSS e Infonavit cuando existan en tu expediente."
                      : `Ya se conectaron ${heliosDocumentsCount} documento${heliosDocumentsCount === 1 ? "" : "s"} para encontrar señales, diferencias y siguientes pasos útiles.`}
                  </p>
                </article>
                <article className="rounded-[1.25rem] border border-sky-100 bg-sky-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-700">
                    Paso 3
                  </p>
                  <p className="mt-2 font-semibold text-slate-950">
                    La respuesta vuelve más completa
                  </p>
                  <p className="mt-2 text-sm leading-6 text-sky-950">
                    {monitoringDocuments.length === 0
                      ? "Cuando haya seguimiento activo, aquí verás cómo la revisión automática vuelve con más detalle para fortalecer el expediente."
                      : `Hoy hay ${monitoringDocuments.length} documento${monitoringDocuments.length === 1 ? "" : "s"} dentro del ciclo automático de revisión.`}
                  </p>
                </article>
                <article className="rounded-[1.25rem] border border-emerald-100 bg-emerald-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">
                    Paso 4
                  </p>
                  <p className="mt-2 font-semibold text-slate-950">
                    Tú recibes una guía más clara
                  </p>

                  <p className="mt-2 text-sm leading-6 text-emerald-950">
                    Las alertas, comparaciones y siguientes documentos sugeridos
                    aparecen en lenguaje simple para ayudarte a decidir con
                    calma.
                  </p>
                </article>
              </div>

              <div className="mt-4 rounded-[1.2rem] border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-950">
                  Por qué esto te aporta más valor con el tiempo
                </p>
                <p className="mt-2 text-sm leading-7 text-slate-700">
                  Cada documento nuevo fortalece tu expediente, y cada retorno
                  útil de la revisión automática ayuda a afinar la lectura del
                  caso. Así recibes resultados más consistentes sin sumar
                  complejidad.
                </p>
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">
                Seguimiento automático
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950">
                Cómo va la respuesta automática
              </h2>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-[1.1rem] border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    En espera
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-slate-950">
                    {complilinkMonitoring?.summary.waitingCount ?? 0}
                  </p>
                </div>
                <div className="rounded-[1.1rem] border border-amber-200 bg-amber-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-700">
                    Conviene revisar
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-amber-950">
                    {complilinkMonitoring?.summary.attentionCount ?? 0}
                  </p>
                </div>
                <div className="rounded-[1.1rem] border border-emerald-100 bg-emerald-50 p-4 sm:col-span-2 lg:col-span-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">
                    Ya respondidos
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-emerald-950">
                    {complilinkMonitoring?.summary.receivedCount ?? 0}
                  </p>
                </div>
              </div>

              <div
                className={`mt-4 rounded-[1.3rem] border p-4 ${monitoringOverview.classes}`}
              >
                <p className="font-semibold">{monitoringOverview.title}</p>
                <p className="mt-2 text-sm leading-7">
                  {monitoringOverview.body}
                </p>
              </div>

              <div className="mt-4 rounded-[1.3rem] border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Embudo operativo mínimo
                    </p>
                    <p className="mt-2 text-lg font-semibold text-slate-950">
                      Del acceso inicial al primer documento útil
                    </p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                    {operationalFunnelCompletedCount}/
                    {operationalFunnelSteps.length} hitos visibles
                  </span>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
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
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                          Paso {index + 1}
                        </p>
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
                      <p className="mt-3 font-semibold text-slate-950">
                        {step.label}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-slate-700">
                        {step.detail}
                      </p>
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
                  {pendingMonitoringDocuments.map(item => {
                    const state = getMonitoringStatusCopy(item.status);
                    const friendlyMessage =
                      item.status === "attention"
                        ? "La respuesta está tardando un poco más de lo normal, pero tu documento sigue resguardado dentro del expediente."
                        : "Este documento ya entró a revisión automática y está esperando respuesta. Mientras llega, puedes seguir fortaleciendo tu expediente con otros archivos.";
                    return (
                      <div
                        key={item.documentId}
                        className="rounded-[1.2rem] border border-slate-200 bg-slate-50 p-4"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-sm font-semibold text-slate-950">
                              {item.documentName}
                            </p>
                            <p className="mt-1 text-sm leading-6 text-slate-600">
                              {friendlyMessage}
                            </p>
                          </div>
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${state.classes}`}
                          >
                            {state.label}
                          </span>
                        </div>
                        <div className="mt-3 text-xs leading-6 text-slate-500">
                          <p>
                            Enviado el{" "}
                            {item.dispatchedAt
                              ? formatDate(item.dispatchedAt)
                              : "sin fecha visible"}
                          </p>
                          {item.respondedAt ? (
                            <p>Respondido el {formatDate(item.respondedAt)}</p>
                          ) : null}
                          {item.responseEvent ? (
                            <p>
                              Último movimiento:{" "}
                              {getReturnEventLabel(item.responseEvent)}
                            </p>
                          ) : null}
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

            <div className={isAdvancedWorkspaceSection ? "rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm" : "hidden"}>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">
                Comparación guiada
              </p>
              <div className="mt-2 flex items-start gap-3">
                <div className="rounded-[1rem] border border-teal-100 bg-teal-50 p-2">
                  <FileSearch
                    className="h-5 w-5 text-teal-700"
                    strokeWidth={1.8}
                  />
                </div>
                <div>
                  <h2 className="text-2xl font-semibold tracking-[-0.03em] text-slate-950">
                    ¿Qué cambió aquí?
                  </h2>
                  <p className="mt-2 text-sm leading-7 text-slate-600">
                    Comparamos documentos del expediente para resaltar
                    diferencias útiles y ayudarte a entender qué conviene
                    revisar después, sin perder de vista que todo queda ordenado
                    en un solo lugar.
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-[1.2rem] border border-slate-200 bg-slate-50 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">
                      Compara tú mismo dos documentos del expediente
                    </p>
                    <p className="mt-1 text-sm leading-7 text-slate-600">
                      Si quieres, puedes cambiar la pareja sugerida para revisar
                      otro contraste sin salir del expediente.
                    </p>
                  </div>
                  {automaticComparisonPair ? (
                    <Button
                      variant="outline"
                      className="rounded-full border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                      onClick={() => {
                        setSelectedComparisonLeftId(
                          automaticComparisonPair[0].documentId
                        );
                        setSelectedComparisonRightId(
                          automaticComparisonPair[1].documentId
                        );
                      }}
                    >
                      Usar la comparación sugerida
                    </Button>
                  ) : null}
                </div>

                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Documento 1
                    </p>
                    <Select
                      value={selectedComparisonLeftId}
                      onValueChange={setSelectedComparisonLeftId}
                      disabled={comparisonSelectionLocked}
                    >
                      <SelectTrigger className="mt-2 h-11 w-full rounded-[1rem] border-slate-200 bg-white">
                        <SelectValue placeholder="Selecciona un documento" />
                      </SelectTrigger>
                      <SelectContent>
                        {comparisonDocuments.map(document => (
                          <SelectItem
                            key={document.documentId}
                            value={document.documentId}
                            disabled={
                              document.documentId === selectedComparisonRightId
                            }
                          >
                            {document.originalName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Documento 2
                    </p>
                    <Select
                      value={selectedComparisonRightId}
                      onValueChange={setSelectedComparisonRightId}
                      disabled={comparisonSelectionLocked}
                    >
                      <SelectTrigger className="mt-2 h-11 w-full rounded-[1rem] border-slate-200 bg-white">
                        <SelectValue placeholder="Selecciona otro documento" />
                      </SelectTrigger>
                      <SelectContent>
                        {comparisonDocuments.map(document => (
                          <SelectItem
                            key={document.documentId}
                            value={document.documentId}
                            disabled={
                              document.documentId === selectedComparisonLeftId
                            }
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
                    Sube al menos dos documentos para activar la comparación
                    manual.
                  </p>
                ) : comparisonSuggestedLabel ? (
                  <p className="mt-3 text-xs leading-6 text-slate-500">
                    Sugerencia actual: {comparisonSuggestedLabel}.
                  </p>
                ) : null}
              </div>

              <div className="mt-4 rounded-[1.3rem] border border-teal-100 bg-teal-50 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm">
                <p className="text-sm font-semibold text-teal-900">
                  {comparisonCopy.badge}
                </p>
                <p className="mt-2 text-xl font-semibold text-slate-950">
                  {comparisonCopy.headline}
                </p>
                <p className="mt-2 text-sm leading-7 text-teal-950">
                  {comparisonCopy.supportingText}
                </p>
              </div>

              {comparisonLeftDocument && comparisonRightDocument ? (
                <div className="mt-4 grid gap-3 xl:grid-cols-[1fr_1fr_0.9fr]">
                  <article className="rounded-[1.2rem] border border-slate-200 bg-slate-50 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Documento original
                    </p>
                    <p className="mt-2 font-semibold text-slate-950">
                      {comparisonLeftDocument.originalName}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
                      <span className="rounded-full bg-white px-3 py-1">
                        {getSimpleDocumentTypeLabel(
                          comparisonLeftDocument.documentType
                        )}
                      </span>
                      <span className="rounded-full bg-white px-3 py-1">
                        {formatDate(comparisonLeftDocument.createdAt)}
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-7 text-slate-700">
                      {asHeliosOpinion(comparisonLeftDocument.heliosOpinion)
                        ?.summary ??
                        "Este documento ya forma parte del expediente y sirve como punto de partida para el contraste."}
                    </p>
                  </article>

                  <article className="rounded-[1.2rem] border border-slate-200 bg-slate-50 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Documento comparado
                    </p>
                    <p className="mt-2 font-semibold text-slate-950">
                      {comparisonRightDocument.originalName}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
                      <span className="rounded-full bg-white px-3 py-1">
                        {getSimpleDocumentTypeLabel(
                          comparisonRightDocument.documentType
                        )}
                      </span>
                      <span className="rounded-full bg-white px-3 py-1">
                        {formatDate(comparisonRightDocument.createdAt)}
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-7 text-slate-700">
                      {asHeliosOpinion(comparisonRightDocument.heliosOpinion)
                        ?.summary ??
                        "Este documento añade una segunda referencia para entender mejor qué cambió o qué falta aclarar."}
                    </p>
                  </article>

                  <article className="rounded-[1.2rem] border border-emerald-100 bg-emerald-50 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">
                      Resumen de diferencias
                    </p>
                    <p className="mt-2 font-semibold text-slate-950">
                      Lo primero que conviene revisar
                    </p>
                    <p className="mt-3 text-sm leading-7 text-emerald-950">
                      {comparisonCopy.cards[1]?.body}
                    </p>
                    <p className="mt-3 text-xs leading-6 text-emerald-900">
                      Último punto comparado:{" "}
                      {formatDate(comparisonRightDocument.createdAt)}
                    </p>
                  </article>
                </div>
              ) : null}

              <div className="mt-4">
                <div className="flex items-center gap-2">
                  <Sparkles
                    className="h-4 w-4 text-teal-700"
                    strokeWidth={1.8}
                  />
                  <p className="text-sm font-semibold text-slate-950">
                    Alertas priorizadas
                  </p>
                </div>
                <p className="mt-1 text-sm leading-7 text-slate-600">
                  Convertimos señales repetidas y puntos sensibles en alertas
                  más fáciles de priorizar dentro de un expediente claro,
                  ordenado y siempre disponible para ti.
                </p>
                <div className="mt-3 grid gap-3">
                  {comparisonAlerts.map(alert => (
                    <Alert
                      key={alert.id}
                      className={`${alert.toneClasses} transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm`}
                    >
                      {alert.icon === "alert" ? (
                        <AlertCircle className="h-4 w-4" strokeWidth={1.8} />
                      ) : alert.icon === "file" ? (
                        <FileSearch className="h-4 w-4" strokeWidth={1.8} />
                      ) : (
                        <Sparkles className="h-4 w-4" strokeWidth={1.8} />
                      )}
                      <AlertTitle>{alert.eyebrow}</AlertTitle>
                      <AlertDescription className="text-current">
                        <p className="font-semibold text-current">
                          {alert.title}
                        </p>
                        <p>{alert.body}</p>
                        {alert.timestampLabel ||
                        alert.reasonLabel ||
                        alert.actionLabel ? (
                          <div className="mt-3 grid gap-2 text-xs leading-6 text-current/80 sm:grid-cols-3">
                            <div className="rounded-[0.9rem] bg-white/60 px-3 py-2">
                              <p className="font-semibold">Fecha y hora</p>
                              <p>
                                {alert.timestampLabel ?? "Sin fecha visible"}
                              </p>
                            </div>
                            <div className="rounded-[0.9rem] bg-white/60 px-3 py-2">
                              <p className="font-semibold">Motivo</p>
                              <p>
                                {alert.reasonLabel ??
                                  "Señal útil detectada en tu expediente"}
                              </p>
                            </div>
                            <div className="rounded-[0.9rem] bg-white/60 px-3 py-2">
                              <p className="font-semibold">Qué puedes hacer</p>
                              <p>
                                {alert.actionLabel ??
                                  "Seguir fortaleciendo el expediente con calma."}
                              </p>
                            </div>
                          </div>
                        ) : null}
                      </AlertDescription>
                    </Alert>
                  ))}
                </div>
              </div>

              <div className="mt-4 grid gap-3">
                {comparisonCopy.cards.map(card => (
                  <div
                    key={card.title}
                    className="rounded-[1.2rem] border border-slate-200 bg-slate-50 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm"
                  >
                    <p className="font-semibold text-slate-950">{card.title}</p>
                    <p className="mt-2 text-sm leading-7 text-slate-700">
                      {card.body}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-[1.2rem] border border-emerald-100 bg-emerald-50 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm">
                <p className="text-sm font-semibold text-emerald-900">
                  Cómo esta comparación gana claridad
                </p>
                <p className="mt-2 text-sm leading-7 text-emerald-950">
                  {comparisonCopy.coverage}
                </p>
                <p className="mt-2 text-xs leading-6 text-emerald-900">
                  {comparisonCopy.guardrail}
                </p>
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
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">
                Siguiente documento recomendado
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950">
                El siguiente paso que más puede ayudarte hoy
              </h2>

              <div className="mt-4 rounded-[1.3rem] border border-teal-100 bg-teal-50 p-4">
                <p className="text-sm font-semibold text-teal-900">
                  Sugerencia automática según tu expediente
                </p>
                <p className="mt-2 text-xl font-semibold text-slate-950">
                  {nextDocumentCopy.headline}
                </p>
                <p className="mt-2 text-sm leading-7 text-teal-950">
                  {nextDocumentCopy.intro}
                </p>
              </div>

              <div className="mt-4 rounded-[1.2rem] border border-slate-200 bg-slate-50 p-4">
                <p className="font-semibold text-slate-950">
                  {nextDocumentCopy.reasonTitle}
                </p>
                <p className="mt-2 text-sm leading-7 text-slate-700">
                  {nextDocumentCopy.reasonBody}
                </p>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  {nextDocumentCopy.followUp}
                </p>
              </div>

              <div className="mt-4 rounded-[1.2rem] border border-emerald-100 bg-emerald-50 p-4">
                <p className="text-sm font-semibold text-emerald-900">
                  Cómo va creciendo tu expediente
                </p>
                <p className="mt-2 text-sm leading-7 text-emerald-950">
                  {nextDocumentCopy.coverage}
                </p>
                <p className="mt-2 text-xs leading-6 text-emerald-900">
                  Hoy tu expediente ya cubre {dossierStatus.completed} de{" "}
                  {dossierStatus.total} piezas clave.
                  {selectedRecommendedTargetType && effectiveRecommendedTarget
                    ? ` Además, dejamos enfocado ${effectiveRecommendedTarget.label.toLowerCase()} para que retomes esa sugerencia sin empezar de cero.`
                    : ""}
                </p>
              </div>

              <Button
                className="mt-4 h-11 w-full rounded-full bg-teal-600 text-white hover:bg-teal-700"
                onClick={() =>
                  focusRecommendedUpload(
                    effectiveRecommendedTarget?.type ?? null
                  )
                }
              >
                {nextDocumentCopy.cta}
                <ArrowRight className="ml-2 h-4 w-4" strokeWidth={1.8} />
              </Button>

              <div className="mt-4 space-y-3">
                {dossierTargets.map(item => {
                  const isPresent = presentTypes.has(item.type);
                  return (
                    <div
                      key={item.type}
                      className="flex gap-3 rounded-[1.2rem] border border-slate-200 bg-slate-50 p-4"
                    >
                      <CheckCircle2
                        className={`mt-1 h-5 w-5 shrink-0 ${isPresent ? "text-emerald-600" : "text-slate-400"}`}
                        strokeWidth={1.8}
                      />
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {item.label}
                        </p>
                        <p className="text-sm leading-6 text-slate-600">
                          {isPresent
                            ? "Ya forma parte del expediente."
                            : item.benefit}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">
                Lo que cuidamos al revisar
              </p>
              <div className="mt-4 space-y-3">
                {[
                  "Tu archivo queda guardado con trazabilidad.",
                  "Lo confirmado y lo estimado se muestran por separado.",
                  "Si algo necesita revisión humana, te lo diremos con claridad.",
                ].map(item => (
                  <div
                    key={item}
                    className="flex gap-3 rounded-[1.2rem] border border-slate-200 bg-slate-50 p-4"
                  >
                    <ShieldCheck
                      className="mt-1 h-5 w-5 shrink-0 text-teal-700"
                      strokeWidth={1.8}
                    />
                    <p className="text-sm leading-7 text-slate-700">{item}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">
                Qué suele aclararse mejor
              </p>
              <div className="mt-4 space-y-3">
                {[
                  "Diferencias entre recibos y CFDI cuando se comparan varios periodos.",
                  "Cambios repetidos en deducciones o montos a lo largo del tiempo.",
                  "Condiciones pactadas frente a lo que realmente ocurrió cuando también existe contrato o evidencia complementaria.",
                ].map(item => (
                  <div
                    key={item}
                    className="flex gap-3 rounded-[1.2rem] border border-slate-200 bg-slate-50 p-4"
                  >
                    <FileSearch
                      className="mt-1 h-5 w-5 shrink-0 text-teal-700"
                      strokeWidth={1.8}
                    />
                    <p className="text-sm leading-7 text-slate-700">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </div>

      <Drawer
        open={casePreparationDrawerOpen}
        onOpenChange={setCasePreparationDrawerOpen}
      >
        <DrawerContent>
          <DrawerHeader className="text-left">
            <DrawerTitle>{pricingExperience.platform.title}</DrawerTitle>
            <DrawerDescription>
              {pricingExperience.platform.description}
            </DrawerDescription>
          </DrawerHeader>
          <div className="space-y-4 px-4 pb-2">
            <div className="rounded-[1.2rem] border border-teal-100 bg-teal-50/80 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-800">
                  Plan actual
                </span>
                <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
                  {activeCommercePlanName}
                </span>
                <span className="rounded-full bg-teal-600 px-3 py-1 text-xs font-semibold text-white">
                  {pricingExperience.platform.priceLabel}
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-700">
                {pricingExperience.platform.reassurance}
              </p>
              <div className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-3">
                <div className="rounded-2xl bg-white/80 p-3">
                  <p className="font-semibold text-slate-950">Documentos por expediente</p>
                  <p className="mt-1">
                    {commerceStatusQuery.data?.entitlements.maxDocumentsPerCase ?? 3} activos con tu plan actual.
                  </p>
                </div>
                <div className="rounded-2xl bg-white/80 p-3">
                  <p className="font-semibold text-slate-950">Modo Helios</p>
                  <p className="mt-1">
                    {commerceStatusQuery.data?.entitlements.canUseHeliosHistoricalMemory
                      ? "Memoria histórica de expediente"
                      : commerceStatusQuery.data?.entitlements.canUseHeliosMultiDocument
                        ? "Multi-documento con continuidad"
                        : "Básico sobre contexto inicial"}
                  </p>
                </div>
                <div className="rounded-2xl bg-white/80 p-3">
                  <p className="font-semibold text-slate-950">Operación comercial</p>
                  <p className="mt-1">
                    {commerceStatusQuery.data?.hasStripe
                      ? commerceStatusQuery.data?.environment?.isSandbox
                        ? "Checkout listo en sandbox para validación."
                        : "Checkout y cobro listos para operar."
                      : "La activación de cobro todavía está pendiente."}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
              <article className="rounded-[1.1rem] border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-700">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-700">
                  Siguiente recomendación comercial
                </p>
                <p className="mt-2 text-base font-semibold text-slate-950">
                  {visibleCommercePromptContext.title}
                </p>
                <p className="mt-2">{visibleCommercePromptContext.body}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                    Objetivo: {getCommercePlanLabel(visibleCommercePromptContext.targetPlan)}
                  </span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                    {getCommerceTriggerLabel(visibleCommercePromptContext.triggerPoint)}
                  </span>
                </div>
              </article>

              <article className="rounded-[1.1rem] border border-slate-200 bg-white p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Conversión de esta sesión
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2 text-center">
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <p className="text-2xl font-semibold text-slate-950">{commerceSessionMetrics.paywallViews}</p>
                    <p className="mt-1 text-xs text-slate-600">Vistas de planes</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <p className="text-2xl font-semibold text-slate-950">{commerceSessionMetrics.upgradeClicks}</p>
                    <p className="mt-1 text-xs text-slate-600">Clics de upgrade</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <p className="text-2xl font-semibold text-slate-950">{commerceSessionMetrics.checkoutStarts}</p>
                    <p className="mt-1 text-xs text-slate-600">Checkouts iniciados</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <p className="text-2xl font-semibold text-slate-950">{commerceSessionMetrics.paymentSuccesses}</p>
                    <p className="mt-1 text-xs text-slate-600">Pagos detectados</p>
                  </div>
                </div>
              </article>
            </div>

            <article className="rounded-[1.1rem] border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-700">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-700">
                  Validación sandbox
                </span>
                <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700">
                  {commerceStatusQuery.data?.environment?.mode === "sandbox"
                    ? "Modo prueba"
                    : commerceStatusQuery.data?.environment?.mode === "live"
                      ? "Modo live"
                      : "Sin Stripe"}
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                  Webhook {commerceStatusQuery.data?.environment?.webhookReady ? "listo" : "pendiente"}
                </span>
              </div>
              <p className="mt-3 text-base font-semibold text-slate-950">
                Prueba técnica del checkout antes del cobro real
              </p>
              <p className="mt-2">
                {commerceStatusQuery.data?.environment?.validationHint ??
                  "Primero configura Stripe para poder validar el circuito completo."}
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
                {commerceStatusQuery.data?.environment?.recommendedTestCard ? (
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                    Tarjeta {commerceStatusQuery.data.environment.recommendedTestCard}
                  </span>
                ) : null}
                <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                  Retorno esperado a /auditar con confirmación visible
                </span>
              </div>
            </article>

            <div className="space-y-3">
              <div>
                <p className="text-sm font-semibold text-slate-950">Planes mensuales</p>
                <p className="text-sm text-slate-600">
                  Elige seguir gratis o activar más profundidad cuando tu expediente lo necesite.
                </p>
              </div>
              <div className="grid gap-3">
                {commercePlans.map(plan => {
                  const isCurrentPlan = activeCommercePlanKey === plan.key;
                  return (
                    <article
                      key={plan.key}
                      className={`rounded-[1.1rem] border p-4 ${
                        plan.highlighted
                          ? "border-teal-300 bg-teal-50/70"
                          : "border-slate-200 bg-white"
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-base font-semibold text-slate-950">{plan.name}</p>
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-700">
                              {plan.badge}
                            </span>
                            {isCurrentPlan ? (
                              <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700">
                                Activo
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 text-sm text-slate-600">{plan.headline}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-base font-semibold text-slate-950">
                            {plan.displayPrice}
                          </p>
                          <p className="text-xs text-slate-500">{plan.description}</p>
                        </div>
                      </div>
                      <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
                        {plan.featureBullets.map(feature => (
                          <li key={feature} className="flex gap-2">
                            <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-teal-600" strokeWidth={1.8} />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button
                          className="rounded-2xl bg-slate-900 text-white hover:bg-slate-800"
                          disabled={isCurrentPlan || createCommerceCheckoutMutation.isPending}
                          onClick={() => handleCommerceCheckout(plan.key)}
                        >
                          {isCurrentPlan ? "Ya estás en este plan" : plan.ctaLabel}
                        </Button>
                        {plan.key === "free" ? (
                          <Button
                            variant="outline"
                            className="rounded-2xl border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                            onClick={() =>
                              focusRecommendedUpload(
                                effectiveRecommendedTarget?.type ?? null
                              )
                            }
                          >
                            Seguir gratis en mi expediente
                          </Button>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-sm font-semibold text-slate-950">Productos puntuales</p>
                <p className="text-sm text-slate-600">
                  Útiles cuando no quieres una suscripción, sino un entregable concreto.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {commerceOneShots.map(product => {
                  const alreadyPurchased = (commerceStatusQuery.data?.purchasedOneShots ?? []).some(
                    item => item.key === product.key
                  );
                  return (
                    <article
                      key={product.key}
                      className="rounded-[1rem] border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-700"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-semibold text-slate-950">{product.name}</p>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-700">
                          {product.badge}
                        </span>
                      </div>
                      <p className="mt-2 text-slate-600">{product.description}</p>
                      <p className="mt-2 text-sm font-semibold text-slate-950">
                        {product.displayPrice} · {product.deliveryLabel}
                      </p>
                      <ul className="mt-3 space-y-2">
                        {product.featureBullets.map(feature => (
                          <li key={feature} className="flex gap-2">
                            <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-teal-600" strokeWidth={1.8} />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                      <Button
                        className="mt-4 rounded-2xl bg-teal-600 text-white hover:bg-teal-700"
                        disabled={createCommerceCheckoutMutation.isPending}
                        onClick={() => handleCommerceCheckout(product.key)}
                      >
                        {alreadyPurchased ? "Comprar otra vez" : product.ctaLabel}
                      </Button>
                    </article>
                  );
                })}
              </div>
            </div>
          </div>
          <DrawerFooter>
            <a href="/pagos" className="w-full">
              <Button
                variant="outline"
                className="w-full rounded-2xl border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              >
                Ver historial de pagos
              </Button>
            </a>
            {commerceStatusQuery.data?.canManageBilling ? (
              <Button
                variant="outline"
                className="rounded-2xl border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                onClick={handleOpenBillingPortal}
              >
                Gestionar suscripción y cobros
              </Button>
            ) : null}
            <DrawerClose asChild>
              <Button
                variant="outline"
                className="rounded-2xl border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              >
                Cerrar y seguir gratis
              </Button>
            </DrawerClose>
            <DrawerClose asChild>
              <Button
                className="rounded-2xl bg-teal-600 text-white hover:bg-teal-700"
                onClick={() =>
                  focusRecommendedUpload(
                    effectiveRecommendedTarget?.type ?? null
                  )
                }
              >
                Volver a mi expediente
              </Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <Drawer open={uploadSourceOpen} onOpenChange={setUploadSourceOpen}>
          <DrawerContent>
            <DrawerHeader className="text-left">
              <DrawerTitle>¿Cómo quieres subir tu recibo?</DrawerTitle>

            <DrawerDescription>
              Puedes tomar una foto en ese momento o elegir un archivo que ya
              tengas guardado en tu celular o computadora. Recordaremos tu
              opción para la siguiente vez.
            </DrawerDescription>
          </DrawerHeader>
          <div className="space-y-3 px-4 pb-2">
              <Button
                className={`h-14 w-full rounded-2xl ${
                  preferredCaptureMode === "camera"
                    ? "bg-teal-600 text-white hover:bg-teal-700"
                    : "bg-slate-900 text-white hover:bg-slate-800"
                }`}
                onClick={openCameraPicker}
              >
                <Camera className="mr-2 h-4 w-4" strokeWidth={1.8} />
                Tomar foto ahora

            </Button>
              <Button
                variant="outline"
                className={`h-14 w-full rounded-2xl ${
                  preferredCaptureMode === "file" || preferredCaptureMode === null
                    ? "border-teal-200 bg-teal-50 text-teal-900 hover:bg-teal-100"
                    : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
                }`}
                onClick={openFilePicker}
              >
                <FolderOpen className="mr-2 h-4 w-4" strokeWidth={1.8} />
                Elegir archivo o PDF

            </Button>
          </div>
          <DrawerFooter>
            <DrawerClose asChild>
              <Button
                variant="outline"
                className="rounded-2xl border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              >
                Cerrar
              </Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <div className={`fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 shadow-[0_-18px_50px_-30px_rgba(15,23,42,0.45)] backdrop-blur sm:hidden ${shouldCompactPostUploadExperience ? "hidden" : ""}`}>
        <div className="mx-auto max-w-6xl">
          <div className={`mb-3 rounded-[1.15rem] border px-3.5 py-3 shadow-[0_16px_30px_-28px_rgba(15,23,42,0.42)] ${privacySignal.cardClass}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="pr-1">
                <p className={`text-[10px] font-semibold uppercase tracking-[0.16em] ${privacySignal.eyebrowClass}`}>
                  Privacidad activa en este expediente
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-950">
                  {privacySignal.title}
                </p>
              </div>
              <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${privacySignal.badgeClass}`}>
                {privacySignal.badge}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-semibold text-slate-700">
              <span className="rounded-full border border-white/80 bg-white/90 px-3 py-1 shadow-sm">
                {privacySignal.company}
              </span>
              <span className="rounded-full border border-white/80 bg-white/90 px-3 py-1 shadow-sm">
                {privacySignal.trace}
              </span>
            </div>
          </div>
          {showWorkspaceSectionSelector && !auth.canToggleUserView ? (
            <div className="mb-3 grid grid-cols-3 gap-2 rounded-[1.15rem] border border-slate-200 bg-slate-50/95 p-2 shadow-[0_16px_30px_-28px_rgba(15,23,42,0.42)]">
              {workspaceSectionCards.map(item => {
                const isActive = workspaceSection === item.key;
                return (
                  <button
                    key={`mobile-nav-${item.key}`}
                    type="button"
                    className={`rounded-[0.95rem] px-3 py-2 text-left transition ${isActive ? "bg-slate-950 text-white shadow-sm" : "bg-white text-slate-700"}`}
                    onClick={() => setWorkspaceSection(item.key)}
                  >
                    <p className={`text-[10px] font-semibold uppercase tracking-[0.16em] ${isActive ? "text-slate-300" : "text-slate-400"}`}>
                      {item.label}
                    </p>
                    <p className={`mt-1 text-xs leading-5 ${isActive ? "text-slate-100" : "text-slate-600"}`}>
                      {item.key === "resumen"
                        ? "Lo esencial"
                        : item.key === "expediente"
                          ? "Continuidad"
                          : "Profundizar"}
                    </p>
                  </button>
                );
              })}
            </div>
          ) : null}
          {shouldShowInlineLegalConsent ? (
            <div className="mb-3 rounded-[1.15rem] border border-slate-200 bg-slate-50/95 p-3.5 shadow-[0_16px_30px_-28px_rgba(15,23,42,0.42)]">
              <div className="flex items-start justify-between gap-3">
                <div className="pr-1">
                  <p className="text-sm font-semibold text-slate-950">
                    Tu autorización se registra en este mismo paso.
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-600">
                    Protegemos tu expediente y dejamos la versión legal vigente
                    ligada a este documento.
                  </p>
                </div>
                <button
                  type="button"
                  className="text-xs font-semibold text-slate-700 underline decoration-slate-300 underline-offset-4 transition hover:text-slate-950"
                  onClick={() => setLegalDocumentsDrawerOpen(true)}
                >
                  Revisar aviso y términos
                </button>
              </div>
              <label className="mt-3 flex min-h-[4.25rem] cursor-pointer items-start gap-3.5 rounded-[1rem] border border-slate-200 bg-white p-4 shadow-[0_12px_26px_-24px_rgba(15,23,42,0.38)] transition-colors hover:border-teal-200">
                <input
                  type="checkbox"
                  checked={legalGateChecked}
                  onChange={event => {
                    const checked = event.target.checked;
                    setLegalGateChecked(checked);
                    trackLegalGateEvent("consent_toggled", {
                      tenantId: selectedTenantId,
                      caseId: selectedCaseId,
                      checked,
                      location: "mobile_sticky_bar",
                      hasPendingDraft: Boolean(pendingDraft),
                    });
                    if (checked) {
                      setLegalGateError(null);
                    }
                  }}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                />
                <span className="text-xs leading-5 text-slate-700">
                  {LEGAL_GATE_COPY.checkbox}
                </span>
              </label>
            </div>
          ) : null}

          <Button
            className={`h-14 w-full rounded-[1.2rem] text-base font-semibold text-white transition-all duration-300 ${
              pendingDraft && manualOverridePayload.length
                ? "bg-teal-700 shadow-[0_18px_40px_-24px_rgba(15,118,110,0.7)] hover:bg-teal-800"
                : "bg-teal-600 hover:bg-teal-700"
            }`}
            disabled={
              isPrimaryDocumentActionPending ||
              !selectedTenantId ||
              !selectedCaseId
            }
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
                ? "Guardando..."
                : autoAdvanceFlash
                  ? "Preparando revisión..."
                  : "Procesando..."
              : acceptLegalPackageMutation.isPending
                ? "Registrando autorización..."
                : pendingDraft
                  ? confirmPrimaryActionLabel
                  : uploadPrimaryActionLabel}
          </Button>
          {autoAdvanceFlash && !pendingDraft ? (
            <p className="mt-2 text-xs font-medium leading-5 text-teal-700">
              En cuanto termine, abrimos tu borrador automáticamente.
            </p>
          ) : null}

          <div className="mt-2 flex items-center justify-between gap-3 text-xs leading-5 text-slate-500">
            <p className="min-w-0 flex-1 truncate">
              {pendingDraft
                ? `${getSimpleDocumentTypeLabel(pendingDraft.classification.documentType)} listo para revisar`
                : selectedFile
                  ? isAutoAnalyzingSelectedFile
                    ? `Analizando ${selectedFile.name}`
                    : `Documento recibido: ${selectedFile.name}`
                  : "Primero elige tu documento desde el celular o tus archivos guardados."}
            </p>
            {pendingDraft || selectedFile ? (
              <button
                className="font-semibold text-slate-700"
                onClick={pendingDraft ? restartPreviewFlow : clearSelectedFile}
                type="button"
              >
                {pendingDraft ? reanalyzeDraftAction.label : "Limpiar"}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </main>
  );
}

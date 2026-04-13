## PROMPT_BASE

# Auditoría integral mobile-first de AuditaPatron

## Rol solicitado al modelo

Actúa como auditor senior de producto digital, UX, copy, confianza, arquitectura visible y fricción operativa. Debes evaluar **toda la app de AuditaPatron** con criterio **mobile-first**, asumiendo que la mayoría de usuarios la verá desde su celular. No evalúes sólo la landing: evalúa la experiencia pública, el flujo principal de auditoría documental y la consola ejecutiva/administrativa visible.

## Objetivo

Generar una auditoría severa pero útil que acerque el producto a una experiencia **10/10** o lo más cerca posible, sin caer en elogios vacíos. Debes priorizar aquello que mejora comprensión, confianza, velocidad de acción, claridad visual y robustez operativa percibida en pantallas pequeñas.

## Superficies incluidas

1. Homepage pública `/`
2. Flujo operativo principal `/auditar`
3. Consola ejecutiva `/ceo`
4. Ruta `/acceso` observada en el preview actual

## Evidencia visual disponible

- Home: https://files.manuscdn.com/user_upload_by_module/session_file/310519663473809458/GhqKpSUhvSyTWjDf.webp
- Auditar: https://files.manuscdn.com/user_upload_by_module/session_file/310519663473809458/KnNbjZcgSYXXHJGL.webp
- CEO: https://files.manuscdn.com/user_upload_by_module/session_file/310519663473809458/nCBiWTvkHvedmuXg.webp
- Acceso: https://files.manuscdn.com/user_upload_by_module/session_file/310519663473809458/vYEQzlaaHoLvrzLz.webp

## Contexto funcional resumido

AuditaPatron promete que la persona sube un documento laboral, recibe una auditoría clara, ve hallazgos, evidencia y siguientes pasos, y luego puede construir un expediente digital disponible 24/7. El valor se apoya en orden documental, claridad laboral, resguardo y trazabilidad.

La app ya mejoró en home: tiene una demo de reporte por estados, señales de confianza anónimas y mejor CTA temprana. Pero persiste la sospecha de que, en móvil, algunas superficies todavía priorizan demasiada explicación o demasiados módulos simultáneos antes de la acción primaria.

En `/auditar`, la arquitectura transmite orden y seriedad, pero puede sentirse extensa y densa en móvil. En `/ceo`, la consola concentra mucha información útil, aunque parece más optimizada para escritorio que para consulta rápida desde celular. En `/acceso`, la ruta observada parece comportarse visualmente como homepage o muy cercana a ella, lo cual puede indicar propósito insuficientemente diferenciado.

## Hallazgos preliminares del moderador

- La promesa principal está mejor resuelta que antes, pero puede comprimirse más en pantallas pequeñas.
- El flujo `/auditar` parece necesitar jerarquizar con más agresividad la tarea primaria: qué subir, cómo subirlo y qué obtengo.
- La consola `/ceo` comunica poder operativo, pero puede exceder la capacidad de escaneo en móvil.
- Hay que revisar si algunas rutas muestran identidad insuficiente o duplicación percibida.
- También hay que revisar robustez percibida: estados, vacíos, filtros, tablas, trazabilidad y confianza visible.

## Qué debes evaluar

Evalúa con severidad profesional estos ejes:

1. Claridad de propuesta de valor inicial en móvil.
2. Jerarquía visual y esfuerzo cognitivo en pantallas pequeñas.
3. Calidad y ubicación de CTAs primarias y secundarias.
4. Densidad del primer scroll y longitud efectiva de los recorridos.
5. Calidad del copy: claridad, precisión, confianza, tono y ausencia de ruido.
6. Continuidad del flujo principal desde descubrimiento hasta primera auditoría útil.
7. Fricción en formularios, carga documental y estados intermedios.
8. Capacidad de la consola CEO para ser consultada en móvil sin colapso de atención.
9. Consistencia de arquitectura entre rutas públicas y operativas.
10. Robustez percibida: si la app parece seria, confiable, estable y preparada para uso real.

## Entregable requerido

Responde **en español** y estructura tu análisis con este formato exacto:

### 1. Calificación global
Da una calificación de 0 a 10 para la app completa, con una breve justificación.

### 2. Fortalezas reales
Entre 3 y 6 fortalezas concretas, no genéricas.

### 3. Debilidades críticas
Entre 5 y 10 debilidades críticas priorizadas, explicando por qué afectan más en móvil.

### 4. Tabla de auditoría priorizada
Incluye una tabla con columnas:
- `Prioridad` (P0, P1, P2)
- `Ruta o superficie`
- `Problema`
- `Impacto móvil`
- `Recomendación precisa`

### 5. Qué arreglaría primero para acercarse a 10/10
Describe el top 5 de cambios en orden.

### 6. Qué NO cambiar todavía
Indica qué partes conservarías porque ya van bien o porque no son la prioridad actual.

### 7. Veredicto final
Un párrafo breve y firme: ¿qué tan cerca está realmente de una experiencia 10/10 mobile-first?

## Regla importante

No respondas como consultor complaciente. Si algo está sobreexplicado, sobrecargado o mal jerarquizado para móvil, dilo con claridad. Si algo está muy bien logrado, dilo también. Busca producir una auditoría que sirva para tomar decisiones de producto reales, no una opinión superficial.


## NOTAS_DEL_MODERADOR

# Contexto de auditoría mobile-first de AuditaPatron

## Muestra visual revisada

Se revisaron dos rutas reales de la app en el preview activo: la homepage (`/`) y el flujo principal de auditoría (`/auditar`). La auditoría se enfocará en uso prioritario desde celular, claridad de valor, velocidad de comprensión, fricción por scroll, continuidad de tareas y confianza visible.

## Hallazgos iniciales de la homepage

La homepage transmite con claridad la propuesta principal de subir un documento y recibir una auditoría clara. El hero ya tiene mejor demostración de valor que antes gracias al panel de reporte por estados. Aun así, en móvil se percibe riesgo de densidad alta en el primer scroll por la convivencia de navegación, tabs, copy largo, tarjetas de selección y demo lateral. La promesa es buena, pero todavía puede comprimirse más para reducir esfuerzo cognitivo inicial y adelantar la primera acción.

La prueba social está mejor resuelta que en versiones anteriores porque ya usa casos anónimos y señales verificables, pero sigue dependiendo de bastante lectura. En un teléfono, parte del valor puede quedarse demasiado abajo del pliegue y requerir demasiada interpretación antes de tocar la CTA.

## Hallazgos iniciales del flujo `/auditar`

La pantalla de auditoría tiene una arquitectura rica y transmite robustez operativa, pero en móvil aparece extensa y con muchos bloques de información simultánea. El encabezado, el estado legal, el resumen del expediente, la recomendación documental, el formulario de subida, el historial y los módulos de apoyo compiten por atención dentro del mismo recorrido vertical.

Se observa una fortaleza importante: el producto sí comunica orden, resguardo y trazabilidad. Sin embargo, el flujo parece necesitar una priorización más agresiva para celular. Hoy da sensación de dashboard informativo antes que de tarea primaria. El usuario móvil probablemente quiera resolver primero tres cosas: qué subir, cómo subirlo y qué obtiene al hacerlo. Todo lo demás debería subordinarse visualmente a eso.

## Hipótesis de auditoría para los modelos externos

La auditoría multi-IA deberá revisar si el producto está priorizando demasiado la explicación y demasiado poco la acción primaria en móvil. También deberá revisar si el lenguaje de confianza, privacidad y guía laboral está apareciendo en el momento correcto o si parte del contenido útil está compitiendo con decisiones de primera intención.

## Hallazgos iniciales de la consola CEO

La consola CEO comunica potencia operativa y trazabilidad, pero su densidad parece claramente orientada a escritorio. En pantallas pequeñas, la barra lateral, los filtros, los KPIs y las acciones superiores pueden convertir la primera impresión en una superficie exigente. Aun si el usuario CEO es menos móvil que el usuario final, la auditoría debe revisar si existe una versión compacta suficientemente jerarquizada para consulta rápida desde teléfono.

La consola tiene una fortaleza clara: unifica estado, métricas y bitácora. La debilidad visible es la simultaneidad de módulos. En móvil, el contenido parece priorizar exhaustividad antes que escaneo veloz. Esto puede reducir sensación de control inmediato en tareas urgentes.

## Hallazgos iniciales de la ruta `/acceso`

La ruta `/acceso` parece estar redirigiendo o replicando la homepage en la muestra observada. Eso sugiere una posible inconsistencia entre intención de arquitectura y experiencia real: si la ruta debía servir como entrada diferenciada, hoy no está ofreciendo una identidad propia visible dentro del recorrido público.

## Riesgos transversales para la auditoría multi-IA

Los tres modelos deben evaluar, con criterio mobile-first, si AuditaPatron ya resolvió bien la promesa pública pero todavía necesita una jerarquización más agresiva en flujos operativos largos. También deben revisar si hay rutas con propósito insuficientemente diferenciado y si la app está privilegiando módulos de contexto por encima de la acción principal en varios puntos del recorrido.


## NOTAS_DE_VALIDACION_VIVA

# Hallazgos vivos post-ronda 1

## Home

La home ya abre con una propuesta de valor más directa: el hero pone al documento laboral al centro y adelanta una vista previa del reporte. La navegación superior sigue presente, pero el mensaje principal ahora es más corto y menos disperso que antes. Persisten varios CTAs y microdecisiones en el primer scroll, por lo que todavía existe algo de competencia visual aunque la jerarquía general mejoró.

## /auditar

La pantalla ya muestra un bloque explícito orientado a la acción: "Sube tu documento y recibe una lectura clara desde el primer archivo". La promesa de resultado aparece antes del resto del expediente y las acciones para elegir archivo o usar cámara quedan visibles en el viewport inicial. La cabecera superior todavía conserva varios controles secundarios, pero el módulo principal dejó de quedar enterrado.

## Pistas para la reauditoría

La mejora más visible parece estar en claridad inicial y reducción de ambigüedad. Las dudas que quedan se concentran en densidad de controles, cantidad de CTAs en home y limpieza de la cabecera de /auditar.

## /acceso

La ruta /acceso todavía devuelve visualmente la home, por lo que la diferenciación operativa del login no quedó materializada en la experiencia viva. Esto explica un posible techo de calificación: el usuario sigue viendo la landing en lugar de una pantalla inequívoca de iniciar sesión y continuidad.

## /ceo

La consola CEO sí refleja mejor el enfoque desktop-first. El hero de la consola declara explícitamente que está pensada para computadora, prioriza lectura horizontal y concentra exportes, filtros y trazabilidad en una sola superficie. Aun así, la densidad sigue siendo alta y conviene confirmar si el bloque Bridge ya comunica con suficiente claridad el estado operativo tras la migración.


## MAPA_DE_RUTAS_APP_TSX

import { useAuth } from "@/_core/hooks/useAuth";
import { shouldRedirectDemoUserFromCeo } from "@/lib/viewMode";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import Access from "@/pages/Access";
import Auditar from "@/pages/Auditar";
import CeoDashboard from "@/pages/CeoDashboard";
import { useEffect } from "react";
import NotFound from "./pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import { LegalPrivacyPage, LegalTermsPage } from "./pages/LegalDocuments";

function DemoViewGuard() {
  const auth = useAuth();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    if (auth.loading) return;
    if (!shouldRedirectDemoUserFromCeo(location, auth.realUser, auth.viewMode)) {
      return;
    }
    setLocation("/auditar");
  }, [auth.loading, auth.realUser, auth.viewMode, location, setLocation]);

  return null;
}

function Router() {
  return (
    <>
      <DemoViewGuard />
      <Switch>
        <Route path={"/"} component={Home} />
        <Route path={"/acceso"} component={Access} />
        <Route path={"/auditar"} component={Auditar} />
        <Route path={"/ceo"} component={CeoDashboard} />
        <Route path={"/ceo/bridge"} component={CeoDashboard} />
        <Route path={"/ceo/alertas"} component={CeoDashboard} />
        <Route path={"/ceo/accesos"} component={CeoDashboard} />
        <Route path={"/ceo/documentos"} component={CeoDashboard} />
        <Route path={"/legal/privacidad"} component={LegalPrivacyPage} />
        <Route path={"/legal/terminos"} component={LegalTermsPage} />
        <Route path={"/404"} component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;


## FUENTE_AUDITAR_TSX

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
  const { legalGateRequired,

## FUENTE_ACCESS_TSX

import { useAuth } from "@/_core/hooks/useAuth";
import { AuditaPatronLogoIcon, AuditaPatronLogoWordmark } from "@/components/AuditaPatronLogo";
import { Button } from "@/components/ui/button";
import { getGoogleLoginUrl, getManusLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { AlertCircle, ArrowLeft, Loader2, Mail, ShieldCheck } from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";

function getReturnToFromSearch() {
  if (typeof window === "undefined") return "/";

  const params = new URLSearchParams(window.location.search);
  const returnTo = params.get("returnTo");

  if (!returnTo || !returnTo.startsWith("/")) {
    return "/";
  }

  return returnTo;
}

function getAccessErrorFromSearch() {
  if (typeof window === "undefined") return null;

  const error = new URLSearchParams(window.location.search).get("error");
  switch (error) {
    case "google_not_available":
      return "Google no está disponible todavía en este entorno. Mientras termina la configuración, puedes entrar con Manus o con código por correo.";
    case "google_callback_failed":
      return "No pudimos completar el acceso con Google. Intenta de nuevo o usa Manus o el código por correo para continuar.";
    default:
      return null;
  }
}

function parseStructuredAuthMessage(rawMessage: string) {
  const [baseMessage, ...tokens] = rawMessage.split("||");
  let retryAfterSeconds: number | null = null;
  let code: string | null = null;

  for (const token of tokens) {
    if (token.startsWith("retry_after=")) {
      const parsedSeconds = Number(token.replace("retry_after=", ""));
      retryAfterSeconds = Number.isFinite(parsedSeconds) ? parsedSeconds : null;
    }

    if (token.startsWith("code=")) {
      code = token.replace("code=", "") || null;
    }
  }

  return {
    message: baseMessage.trim(),
    retryAfterSeconds,
    code,
  };
}

export default function Access() {
  const returnTo = useMemo(() => getReturnToFromSearch(), []);
  const { loading, user } = useAuth();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [emailStep, setEmailStep] = useState<"request" | "verify">("request");
  const [emailCooldownUntil, setEmailCooldownUntil] = useState<number | null>(null);
  const [nowTs, setNowTs] = useState(() => Date.now());
  const accessErrorFromSearch = useMemo(() => getAccessErrorFromSearch(), []);

  const googleStatusQuery = trpc.auth.googleStatus.useQuery();
  const requestEmailCode = trpc.auth.requestEmailCode.useMutation({
    onSuccess(data) {
      const normalizedEmail = email.trim().toLowerCase();
      setSubmittedEmail(normalizedEmail);
      setEmailStep("verify");
      setCode("");
      setErrorMessage(null);
      setEmailCooldownUntil(Date.now() + data.cooldownSeconds * 1000);
      setStatusMessage(`Enviamos un código de 6 dígitos a ${data.maskedEmail}. Puedes solicitar otro dentro de ${data.cooldownSeconds} segundos si lo necesitas.`);
    },
    onError(error) {
      const parsed = parseStructuredAuthMessage(error.message);
      setErrorMessage(parsed.message);
      setStatusMessage(null);
      if (parsed.retryAfterSeconds) {
        setEmailCooldownUntil(Date.now() + parsed.retryAfterSeconds * 1000);
      }
    },
  });
  const verifyEmailCode = trpc.auth.verifyEmailCode.useMutation({
    onSuccess() {
      if (typeof window !== "undefined") {
        window.location.href = returnTo;
      }
    },
    onError(error) {
      const parsed = parseStructuredAuthMessage(error.message);
      setErrorMessage(parsed.message);
      setStatusMessage(null);
    },
  });

  useEffect(() => {
    if (!loading && user && typeof window !== "undefined") {
      window.location.replace(returnTo);
    }
  }, [loading, returnTo, user]);

  useEffect(() => {
    if (!accessErrorFromSearch) return;
    setErrorMessage(accessErrorFromSearch);
    setStatusMessage(null);
  }, [accessErrorFromSearch]);

  useEffect(() => {
    if (!emailCooldownUntil) return;

    const timer = window.setInterval(() => {
      setNowTs(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, [emailCooldownUntil]);

  const handleRequestCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setStatusMessage(null);
    await requestEmailCode.mutateAsync({
      email: email.trim(),
      name: name.trim() || undefined,
    });
  };

  const handleVerifyCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setStatusMessage(null);
    await verifyEmailCode.mutateAsync({
      email: submittedEmail || email.trim(),
      code: code.trim(),
      name: name.trim() || undefined,
    });
  };

  const googleEnabled = Boolean(googleStatusQuery.data?.enabled);
  const emailCooldownSecondsRemaining = emailCooldownUntil ? Math.max(0, Math.ceil((emailCooldownUntil - nowTs) / 1000)) : 0;
  const emailCooldownActive = emailCooldownSecondsRemaining > 0;
  const googleLabel = googleStatusQuery.isLoading
    ? "Verificando disponibilidad de Google"
    : googleEnabled
      ? "Continuar con Google"
      : "Google disponible en cuanto se complete la configuración";

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(20,184,166,0.1),_transparent_28%),linear-gradient(180deg,#f8fbfc_0%,#eef4f5_52%,#f8fafc_100%)] text-slate-950">
      <div className="container py-8 lg:py-14">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <a
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-950"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver al inicio
          </a>
          <div className="inline-flex items-center gap-2 rounded-full border border-teal-100 bg-teal-50/90 px-4 py-2 text-sm text-teal-900 shadow-sm">
            <ShieldCheck className="h-4 w-4" />
            Continuarás en <strong>{returnTo}</strong>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[0.82fr_1.18fr] xl:items-start">
          <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white/95 shadow-[0_30px_100px_-42px_rgba(15,23,42,0.28)]">
            <div className="border-b border-slate-200 bg-[linear-gradient(135deg,rgba(15,23,42,0.96),rgba(15,118,110,0.9))] px-7 py-7 text-white sm:px-8">
              <div className="flex items-start gap-4">
                <AuditaPatronLogoIcon imageClassName="h-14 w-14 rounded-2xl border border-white/20 bg-white object-contain p-1.5 shadow-[0_20px_50px_-28px_rgba(2,6,23,0.6)]" />
                <div className="space-y-3">
                  <AuditaPatronLogoWordmark imageClassName="max-w-[220px]" subtitleClassName="text-xs uppercase tracking-[0.16em] text-white/70" />
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/90">
                    Acceso operativo
                  </div>
                </div>
              </div>

              <div className="mt-6 max-w-xl space-y-3">
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-teal-100/90">Entrar y seguir trabajando</p>
                <h1 className="text-3xl font-semibold tracking-[-0.04em] text-white sm:text-[2.15rem]">
                  Inicia sesión para retomar tu expediente y tu operación sin fricción.
                </h1>
                <p className="max-w-2xl text-sm leading-7 text-slate-200 sm:text-base">
                  Esta pantalla existe para entrar rápido, recuperar la sesión y volver a la ruta protegida que estabas usando. La explicación del producto vive en la home; aquí priorizamos continuidad, seguridad y velocidad.
                </p>
              </div>
            </div>

            <div className="space-y-5 px-7 py-7 sm:px-8">
              <div className="grid gap-4 md:grid-cols-3">
                {[
                  {
                    title: "Retorno exacto",
                    body: "Después del acceso volverás automáticamente a la ruta que pediste, sin reconstruir el recorrido manualmente.",
                  },
                  {
                    title: "Canal principal y respaldo",
                    body: "Puedes usar Manus como acceso principal y correo temporal como alternativa operativa cuando necesites contingencia.",
                  },
                  {
                    title: "Sesión cuidada",
                    body: "La autenticación conserva la continuidad del expediente y mantiene el retorno protegido dentro del flujo actual.",
                  },
                ].map((item) => (
                  <article key={item.title} className="rounded-[1.4rem] border border-slate-200 bg-slate-50/85 p-4">
                    <p className="text-sm font-semibold text-slate-950">{item.title}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{item.body}</p>
                  </article>
                ))}
              </div>

              <div className="rounded-[1.4rem] border border-dashed border-teal-200 bg-teal-50/70 p-4 text-sm leading-7 text-teal-950">
                Si llegaste desde un enlace interno o una ruta protegida, el sistema te devolverá a <strong>{returnTo}</strong> en cuanto completes la autenticación.
              </div>
            </div>
          </section>

          <section className="space-y-5">
            <div className="rounded-[2rem] border border-slate-200 bg-white/95 p-6 shadow-[0_24px_80px_-38px_rgba(15,23,42,0.26)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Acceso principal</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950">Elige cómo entrar</h2>
                  <p className="mt-2 text-sm leading-7 text-slate-600">
                    Usa el proveedor que mejor encaje con tu sesión actual. Si solo quieres volver a trabajar cuanto antes, Manus suele ser la ruta más directa.
                  </p>
                </div>
                <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                  Ruta objetivo: {returnTo}
                </div>
              </div>

              <div className="mt-5 grid gap-3">
                <Button
                  size="lg"
                  className="h-12 justify-center rounded-2xl bg-slate-950 text-white shadow-lg shadow-slate-950/10 hover:bg-slate-900"
                  onClick={() => {
                    window.location.href = getManusLoginUrl(returnTo);
                  }}
                >
                  Continuar con Manus
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="h-12 justify-center rounded-2xl border-slate-200 bg-white"
                  disabled={!googleEnabled || googleStatusQuery.isLoading}
                  onClick={() => {
                    window.location.href = getGoogleLoginUrl(returnTo);
                  }}
                >
                  {googleStatusQuery.isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {googleLabel}
                </Button>
              </div>

              <div className="mt-5 rounded-[1.3rem] border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                <p className="font-semibold text-slate-900">Qué cambia según el método</p>
                <ul className="mt-3 space-y-2">
                  <li><strong className="text-slate-900">Manus OAuth:</strong> mantiene la continuidad con la sesión institucional ya existente.</li>
                  <li><strong className="text-slate-900">Google OAuth:</strong> queda listo para activación segura en cuanto termine la configuración del proveedor.</li>
                  <li><strong className="text-slate-900">Correo temporal:</strong> sirve como vía de respaldo sin introducir contraseñas persistentes.</li>
                </ul>
              </div>
            </div>

            <div className="rounded-[2rem] border border-slate-200 bg-white/95 p-6 shadow-[0_24px_80px_-38px_rgba(15,23,42,0.26)]">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-100 text-teal-700">
                  <Mail className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Respaldo operativo</p>
                  <h2 className="text-xl font-semibold tracking-tight text-slate-950">Entrar con código por correo</h2>
                </div>
              </div>

              <p className="mt-4 text-sm leading-7 text-slate-600">
                Si hoy prefieres no depender de otro proveedor, usa tu correo de trabajo para recibir un código temporal. Este flujo está pensado para continuidad operativa y adopción gradual.
              </p>

              <div className="mt-4 rounded-[1.2rem] border border-dashed border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-600">
                El reenvío del código muestra un temporizador visible y limita solicitudes repetidas dentro de la misma ventana para proteger el acceso.
              </div>

              {statusMessage ? (
                <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  {statusMessage}
                </div>
              ) : null}

              {errorMessage ? (
                <div className="mt-5 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              ) : null}

              {emailStep === "request" ? (
                <form className="mt-6 space-y-4" onSubmit={handleRequestCode}>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-900" htmlFor="access-email">
                      Correo corporativo
                    </label>
                    <input
                      id="access-email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="nombre@empresa.com"
                      className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base text-slate-950 outline-none transition-colors placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-900" htmlFor="access-name">
                      Nombre visible (opcional)
                    </label>
                    <input
                      id="access-name"
                      type="text"
                      autoComplete="name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="Cómo quieres aparecer en la consola"
                      className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base text-slate-950 outline-none transition-colors placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                    />
                  </div>

                  <Button
                    type="submit"
                    size="lg"
                    className="h-12 w-full rounded-2xl bg-teal-600 text-white hover:bg-teal-700"
                    disabled={requestEmailCode.isPending || loading || emailCooldownActive}
                  >
                    {requestEmailCode.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {emailCooldownActive ? `Espera ${emailCooldownSecondsRemaining}s para pedir otro código` : "Enviar código de acceso"}
                  </Button>
                </form>
              ) : (
                <form className="mt-6 space-y-4" onSubmit={handleVerifyCode}>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-900" htmlFor="verify-email">
                      Correo verificado
                    </label>
                    <input
                      id="verify-email"
                      type="email"
                      value={submittedEmail || email}
                      readOnly
                      className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-base text-slate-950 outline-none"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-900" htmlFor="verify-code">
                      Código de seis dígitos
                    </label>
                    <input
                      id="verify

## FUENTE_CEO_TSX

import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout, { type DashboardNavigationItem } from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { trackCeoConsoleViewed, trackCeoExport, trackCeoGuardrail, trackCeoMasterMetricsViewed, trackCeoRefresh } from "@/lib/analytics";
import { trpc } from "@/lib/trpc";
import { buildBridgeMonitoringPanel } from "@/pages/ceoBridgeMonitoring";
import {
  buildBridgeSmokeComparisonSummary,
  buildBridgeSmokeHistorySummary,
  filterBridgeSmokeHistory,
  getBridgeSmokeAlertSeverityTone,
  getBridgeSmokeAlertTimestampLabel,
  getBridgeSmokeAlertVisualStateLabel,
  getBridgeSmokeHistoryContext,
  getBridgeSmokeHistoryFilterLabel,
  getBridgeSmokeHistorySeverity,
  getBridgeSmokeHistorySeverityLabel,
  getBridgeSmokeHistoryStatusLabel,
  getBridgeSmokeHistoryStatusTone,
  getBridgeSmokeHistoryTimeWindowLabel,
  type BridgeSmokeHistoryFilter,
  type BridgeSmokeHistorySeverityFilter,
  type BridgeSmokeHistoryTimeWindow,
} from "@/pages/ceoBridgeSmokeHistory";
import {
  buildCeoCsvReport,
  buildCeoPdfReport,
  downloadCeoCsvReport,
  downloadCeoPdfReport,
  getCeoExportBlockReason,
  type CeoCustomExportPayload,
} from "@/pages/ceoDashboardExports";
import {
  buildAuditExecutiveAlerts,
  buildAuditMonitoringSummary,
  filterAuditFeed,
  getAuditActionLabel,
  getAuditActionTone,
  getAuditDrilldownDescriptor,
  getAuditEventSeverity,
  getAuditFamilyLabel,
  getAuditRejectionReason,
  getAuditSeverityLabel,
  type AuditEventFamily,
  type AuditEventSeverity,
  type AuditExecutiveAlert,
  type AuditFeedItem,
} from "@/pages/ceoDashboardMonitoring";
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  Clock3,
  Files,
  Filter,
  GitBranch,
  LayoutDashboard,
  Loader2,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  ShieldX,
  Siren,
  UsersRound,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast as sonnerToast } from "sonner";
import { useLocation } from "wouter";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

function formatNumber(value: number) {
  return new Intl.NumberFormat("es-MX").format(value ?? 0);
}

function formatDateTime(value: Date | string | null | undefined) {
  if (!value) return "Sin fecha";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin fecha";

  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

type BridgePresetFiltersDraft = {
  tenantId?: string;
  severity?: string;
  caseId?: string;
  userId?: number;
  dateWindowDays?: 7 | 30 | 90 | 365;
  query?: string;
};

function parseEmailRecipients(raw: string) {
  return raw
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
    .filter((value, index, collection) => collection.indexOf(value) === index);
}

function formatBridgePresetSummary(filters: BridgePresetFiltersDraft | null | undefined) {
  if (!filters) return "Sin filtros persistidos";

  const segments = [
    filters.tenantId ? `Tenant ${filters.tenantId}` : null,
    filters.severity ? `Severidad ${filters.severity}` : null,
    filters.caseId ? `Caso ${filters.caseId}` : null,
    filters.userId ? `Usuario ${filters.userId}` : null,
    filters.dateWindowDays ? `Ventana ${filters.dateWindowDays} días` : null,
    filters.query ? `Búsqueda “${filters.query}”` : null,
  ].filter(Boolean);

  return segments.length > 0 ? segments.join(" · ") : "Sin filtros persistidos";
}

async function blobToBase64(blob: Blob) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("No fue posible serializar el archivo exportable."));
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("No fue posible serializar el archivo exportable."));
        return;
      }
      resolve(result.split(",", 2)[1] ?? "");
    };
    reader.readAsDataURL(blob);
  });
}

function getSeverityBadgeClass(severity: string) {
  switch (severity) {
    case "critical":
      return "border-rose-200 bg-rose-50 text-rose-700";
    case "high":
      return "border-orange-200 bg-orange-50 text-orange-700";
    case "medium":
      return "border-amber-200 bg-amber-50 text-amber-700";
    default:
      return "border-slate-200 bg-slate-100 text-slate-700";
  }
}

function getStatusBadgeClass(status: string) {
  switch (status) {
    case "active":
    case "open":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "paused":
    case "pending":
    case "acknowledged":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "disabled":
    case "resolved":
    case "revoked":
      return "border-slate-200 bg-slate-100 text-slate-700";
    default:
      return "border-slate-200 bg-slate-100 text-slate-700";
  }
}

function getBridgeHealthBadgeClass(health: string) {
  switch (health) {
    case "healthy":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "pending":
      return "border-sky-200 bg-sky-50 text-sky-700";
    case "warning":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "critical":
      return "border-rose-200 bg-rose-50 text-rose-700";
    default:
      return "border-slate-200 bg-slate-100 text-slate-700";
  }
}

function getBridgeOutcomeLabel(outcome: string) {
  if (outcome === "success") return "Retorno conforme";
  if (outcome === "retry_scheduled") return "Reintento programado";
  if (outcome === "permanent_failure") return "Fallo permanente";
  if (outcome === "skipped") return "Envío omitido";
  if (outcome === "pending_return") return "Esperando retorno";
  if (outcome === "warning") return "Con advertencias";
  return "Sin clasificar";
}

function getSafeNextAlertStatus(status: string) {
  if (status === "open") return "acknowledged" as const;
  if (status === "acknowledged") return "resolved" as const;
  return null;
}

function getSafeAlertActionLabel(status: string) {
  if (status === "open") return "Acusar e iniciar investigación";
  if (status === "acknowledged") return "Marcar resuelta";
  return null;
}

function getAlertStatusLabel(status: string) {
  if (status === "open") return "Abierta";
  if (status === "acknowledged") return "En investigación";
  if (status === "resolved") return "Resuelta";
  return status;
}

function getAlertProgressLabel(status: string, updatedAt: Date | string | null | undefined) {
  if (status === "acknowledged") {
    return updatedAt ? `En investigación desde ${formatDateTime(updatedAt)}` : "En investigación";
  }

  if (status === "resolved") {
    return updatedAt ? `Resuelta el ${formatDateTime(updatedAt)}` : "Resuelta";
  }

  return "Pendiente de acuse operativo";
}

function getSafeNextCaseStatus(status: string) {
  if (status === "intake") return "analysis" as const;
  if (status === "analysis") return "conciliation" as const;
  if (status === "conciliation") return "litigation" as const;
  return null;
}

function getSafeCaseActionLabel(status: string) {
  if (status === "intake") return "Pasar a análisis";
  if (status === "analysis") return "Pasar a conciliación";
  if (status === "conciliation") return "Pasar a litigio";
  return null;
}

function getSafeMembershipAction(membership: { status: string; accessScope: string; caseId?: string | null }) {
  if (membership.accessScope !== "case" || !membership.caseId) return null;
  if (membership.status === "active") {
    return { status: "revoked" as const, label: "Revocar acceso" };
  }
  return null;
}

type PendingExecutiveAction =
  | {
      kind: "alert";
      alertId: number;
      title: string;
      currentStatus: "open" | "acknowledged" | "resolved";
      nextStatus: "acknowledged" | "resolved";
      actionLabel: string;
    }
  | {
      kind: "membership";
      membershipId: number;
      userLabel: string;
      currentStatus: "active" | "revoked";
      nextStatus: "active" | "revoked";
      actionLabel: string;
    }
  | {
      kind: "case";
      tenantId: string;
      caseId: string;
      title: string;
      currentStatus: "intake" | "analysis" | "conciliation" | "litigation" | "archived";
      nextStatus: "analysis" | "conciliation" | "litigation";
      actionLabel: string;
    };

function getSafeActionErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";

  if (/han cambiado|desactualizada/i.test(message)) {
    return "La vista quedó desactualizada. Refresca el panel antes de intentar de nuevo.";
  }
  if (/siguiente cambio operativo seguro|transición solicitada no es válida/i.test(message)) {
    return "El backend bloqueó un cambio fuera de la secuencia segura permitida por la consola CEO.";
  }
  if (/fuera del caso visible|acotados a un caso/i.test(message)) {
    return "Este bloque sólo permite operar accesos ligados a un caso visible y trazable.";
  }
  if (/permission|FORBIDDEN|10002/i.test(message)) {
    return "Tu sesión ya no tiene permisos suficientes para ejecutar esta acción.";
  }

  return "Intenta nuevamente en unos segundos.";
}

function KpiCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: number;
  helper: string;
}) {
  return (
    <article className="rounded-3xl border border-white/70 bg-white/92 p-5 shadow-[0_24px_70px_-34px_rgba(15,23,42,0.24)] backdrop-blur">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <div className="mt-3 flex items-end justify-between gap-3">
        <strong className="text-3xl font-semibold tracking-tight text-slate-950">{formatNumber(value)}</strong>
        <span className="text-right text-sm leading-5 text-slate-500">{helper}</span>
      </div>
    </article>
  );
}

function SectionEmptyState({
  title,
  description,
  onClear,
}: {
  title: string;
  description: string;
  onClear: () => void;
}) {
  return (
    <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50/80 px-5 py-8 text-center">
      <p className="text-base font-semibold text-slate-950">{title}</p>
      <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-slate-600">{description}</p>
      <Button variant="outline" className="mt-4 rounded-full bg-white" onClick={onClear}>
        <X className="mr-2 h-4 w-4" />
        Limpiar filtros
      </Button>
    </div>
  );
}

type SectionKey = "resumen" | "bridge" | "alertas" | "accesos" | "documentos";

type FilterState = {
  tenantId: string;
  severity: string;
  caseId: string;
  userId: string;
  dateWindowDays: string;
};

const DEFAULT_FILTER_STATE: FilterState = {
  tenantId: "all",
  severity: "all",
  caseId: "all",
  userId: "all",
  dateWindowDays: "all",
};

const DATE_WINDOW_OPTIONS = [
  { value: "7", label: "Últimos 7 días" },
  { value: "30", label: "Últimos 30 días" },
  { value: "90", label: "Últimos 90 días" },
  { value: "365", label: "Últimos 12 meses" },
];

const AUDIT_FAMILY_FILTER_OPTIONS: Array<{ value: AuditEventFamily; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "guardrail", label: "Guardrails" },
  { value: "document", label: "Documentos" },
  { value: "access", label: "Accesos" },
  { value: "policy", label: "Políticas" },
];

const AUDIT_SEVERITY_FILTER_OPTIONS: Array<{ value: AuditEventSeverity; label: string }> = [
  { value: "all", label: "Toda severidad" },
  { value: "high", label: "Alta" },
  { value: "medium", label: "Media" },
  { value: "normal", label: "Normal" },
];

function getCurrentSectionCount(
  section: SectionKey,
  snapshot: {
    tenantHealth: unknown[];
    recentCases: unknown[];
    recentAlerts: unknown[];
    recentMemberships: unknown[];
    recentDocuments: unknown[];
  } | null | undefined,
) {
  if (!snapshot) return 0;
  if (section === "alertas") return snapshot.recentAlerts.length;
  if (section === "accesos") return snapshot.recentMemberships.length;
  if (section === "documentos") return snapshot.recentDocuments.length;
  return snapshot.tenantHealth.length + snapshot.recentCases.length + snapshot.recentAlerts.length + snapshot.recentMemberships.length + snapshot.recentDocuments.length;
}

function getSectionLabel(section: SectionKey) {
  if (section === "bridge") return "Bridge operativo";
  if (section === "alertas") return "Alertas";
  if (section === "accesos") return "Accesos";
  if (section === "documentos") return "Documentos";
  return "Resumen CEO";
}

export default function CeoDashboard() {
  const auth = useAuth({ redirectOnUnauthenticated: true, redirectPath: "/ceo" });
  const { user, isViewingAsUser, loading } = auth;
  const [location, setLocation] = useLocation();
  const isAdmin = user?.role === "admin";

  useEffect(() => {
    if (loading || !isViewingAsUser) return;
    if (typeof window === "undefined") return;
    if (!window.location.pathname.startsWith("/ceo")) return;

    window.location.replace("/auditar");
  }, [isViewingAsUser, loading]);

  const utils = trpc.useUtils();
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTER_STATE);
  const [auditFamilyFilter, setAuditFamilyFilter] = useState<AuditEventFamily>("all");
  const [auditSeverityFilter, setAuditSeverityFilter] = useState<AuditEventSeverity>("all");
  const [bridgeSmokeHistoryFilter, setBridgeSmokeHistoryFilter] = useState<BridgeSmokeHistoryFilter>("all");
  const [bridgeSmokeTimeWindow, setBridgeSmokeTimeWindow] = useState<BridgeSmokeHistoryTimeWindow>("all");
  const [bridgeSmokeSeverityFilter, setBridgeSmokeSeverityFilter] = useState<BridgeSmokeHistorySeverityFilter>("all");
  const [bridgeSmokeThresholdDraft, setBridgeSmokeThresholdDraft] = useState("3");
  const [queryDraft, setQueryDraft] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [exportKind, setExportKind] = useState<"csv" | "pdf" | null>(null);
  const [emailExportPending, setEmailExportPending] = useState(false);
  const [pendingExecutiveAction, setPendingExecutiveAction] = useState<PendingExecutiveAction | null>(null);
  const [snapshotPulseAt, setSnapshotPulseAt] = useState(() => Date.now());
  const [bridgePresetNameDraft, setBridgePresetNameDraft] = useState("");
  const [bridgePresetDescriptionDraft, setBridgePresetDescriptionDraft] = useState("");
  const [bridgePresetExportFormatDraft, setBridgePresetExportFormatDraft] = useState<"csv" | "pdf">("pdf");
  const [bridgePresetEmailRecipientsDraft, setBridgePresetEmailRecipientsDraft] = useState("");
  const [bridgePresetEmailMessageDraft, setBridgePresetEmailMessageDraft] = useState("");
  const [bridgeSchedulePresetIdDraft, setBridgeSchedulePresetIdDraft] = useState("");
  const [bridgeScheduleCronDraft, setBridgeScheduleCronDraft] = useState("0 0 8 * * 1");
  const [bridgeScheduleTimezoneDraft, setBridgeScheduleTimezoneDraft] = useState("America/Mexico_City");
  const [bridgeScheduleActiveDraft, setBridgeScheduleActiveDraft] = useState(true);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedQuery(queryDraft.trim());
    }, 300);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [queryDraft]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setSnapshotPulseAt(Date.now());
    }, 30000);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  const currentSection = useMemo<SectionKey>(() => {
    if (location.startsWith("/ceo/bridge")) return "bridge";
    if (location.startsWith("/ceo/alertas")) return "alertas";
    if (location.startsWith("/ceo/accesos")) return "accesos";
    if (location.startsWith("/ceo/documentos")) return "documentos";
    return "resumen";
  }, [location]);

  const snapshotFilters = useMemo(() => {
    const input: {
      tenantId?: string;
      severity?: string;
      caseId?: string;
      userId?: number;
      dateWindowDays?: 7 | 30 | 90 | 365;
      query?: string;
    } = {};

    if (filters.tenantId !== "all") input.tenantId = filters.tenantId;
    if (filters.severity !== "all") input.severity = filters.severity;
    if (filters.caseId !== "all") input.caseId = filters.caseId;
    if (filters.userId !== "all") input.userId = Number(filters.userId);
    if (filters.dateWindowDays === "7" || filters.dateWindowDays === "30" || filters.dateWindowDays === "90" || filters.dateWindowDays === "365") {
      input.dateWindowDays = Number(filters.dateWindowDays) as 7 | 30 | 90 | 365;
    }
    if (debouncedQuery.length > 0) input.query = debouncedQuery;

    return input;
  }, [debouncedQuery, filters]);

  const hasActiveFilters = Object.keys(snapshotFilters).length > 0;
  const currentTenantScope = filters.tenantId !== "all" ? filters.tenantId : undefined;
  const bridgePresetFilters = useMemo<BridgePresetFiltersDraft>(() => ({ ...snapshotFilters }), [snapshotFilters]);
  const auditTrailFilters = useMemo(
    () => ({
      tenantId: filters.tenantId !== "all" ? filters.tenantId : undefined,
      caseId: filters.caseId !== "all" ? filters.caseId : undefined,
      limit: 30,
    }),
    [filters.caseId, filters.tenantId],
  );

  const baseSnapshotQuery = trpc.dashboard.ceoSnapshot.useQuery(undefined, {
    enabled: isAdmin,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const filteredSnapshotQuery = trpc.dashboard.ceoSnapshot.useQuery(snapshotFilters, {
  

## TEXTO_HOME

# AuditaPatron

**URL:** https://3000-igw07p7g2fg0o552njwun-6f266027.us2.manus.computer

---

Cómo funciona
Tu expediente
Asistente
Preguntas
Consola CEO
Ver tu expediente
Empieza ahora y protege tu futuro
Alerta y control
Control inmediato
ALERTA LABORAL TEMPRANA
Sube un documento laboral
y recibe una auditoría clara.

EMPIEZA CON UN SOLO ARCHIVO. AUDITAPATRON LO ORDENA, DETECTA SEÑALES RELEVANTES Y TE DEVUELVE QUÉ ENTENDIÓ, QUÉ FALTA Y QUÉ CONVIENE REVISAR DESPUÉS.

La auditoría documental es el centro de la experiencia: subes un recibo, contrato o CFDI y recibes hallazgos, evidencias y siguientes pasos. Después, si quieres, tu asistente laboral te ayuda a interpretar el expediente sin quitarle protagonismo al análisis principal.

EMPIEZA CON EL DOCUMENTO CORRECTO

Elige la situación que más se parece a tu caso y te sugerimos qué archivo conviene subir primero para obtener una auditoría útil sin reunir todo de una vez.

SIN REUNIR TODO DE UNA VEZ

¿Me puede ayudar?

Quiero entender rápido si esto me sirve.

¿Qué subo primero?

Necesito el mejor archivo para empezar hoy.

Quiero ir con calma

Prefiero empezar con control y confianza.

DOCUMENTO EXACTO SUGERIDO
PRIMER DOCUMENTO SUGERIDO

Si quieres avanzar hoy, este suele ser el archivo con más tracción para arrancar.

El archivo que ya tienes a la mano; si dudas, un recibo de nómina reciente

Es fácil de ubicar y normalmente entrega una primera lectura útil sin esperar a reunir todo el expediente.

Con uno o dos documentos más, AuditaPatron puede comparar mejor y devolverte una lectura más rica.

Variante activa: Alerta y control
Auditoría inicial en segundos
Empezar con ese archivo
Auditar mi situación ahora
Ver qué documento subir primero
R
C
N

SEÑALES DE CONFIANZA

Lenguaje claro, rutas guiadas y un enfoque prudente: primero ves la auditoría del documento, luego decides si quieres profundizar con tu expediente y tu asistente laboral.

CASO ANÓNIMO 01

SEÑAL VERIFICADA

Recibo reciente + CFDI del mismo periodo

“Ya entendí mejor qué revisar primero.”

La persona llegó con una duda difusa sobre pagos reportados y la lectura inicial volvió visible qué archivos convenía comparar primero.

Señal verificada en pruebas de comprensión: el cruce sugerido ayudó a pasar de incertidumbre general a una acción concreta.

CASO ANÓNIMO 02

SEÑAL VERIFICADA

Primer expediente reunido en un solo lugar

“Por fin tengo mis documentos en un solo lugar.”

La necesidad principal era dejar de depender de chats, carpetas dispersas y búsquedas manuales para revisar la situación laboral.

Señal verificada en sesiones de mensaje: el beneficio de orden y disponibilidad 24/7 se entendió como valor inmediato.

CASO ANÓNIMO 03

SEÑAL VERIFICADA

Inicio cuidadoso con enfoque de privacidad

“Me dio paz empezar sin palabras complicadas.”

El flujo permitió empezar con un archivo cotidiano antes de ampliar el contexto del expediente completo.

Señal verificada en feedback cualitativo: el tono prudente redujo fricción en la primera decisión de subida.

VISTA PREVIA DEL REPORTE QUE RECIBES

Un ejemplo simple de cómo AuditaPatron traduce tu documento en hallazgos accionables.

1/3

Esta vista resume lo que importa primero: la señal detectada, el documento que la respalda y el siguiente paso sugerido para seguir construyendo tu expediente.

Documento recibido

Estado real 01

Hallazgo preliminar

Estado real 02

Siguiente paso sugerido

Estado real 03

Puedes recorrer estados reales: documento recibido, hallazgo preliminar y siguiente paso sugerido.

HALLAZGO LABORAL FRECUENTE 01
ESTADO REAL 02

Se cruza la información útil y aparece una señal concreta para revisar sin adelantar conclusiones.

Tu nómina y tu CFDI podrían no coincidir en el mismo periodo.

Un primer cruce entre ambos suele destapar diferencias de conceptos, montos o fechas sin pedirte todo el expediente desde el inicio.

EVIDENCIA DOCUMENTAL SUGERIDA

Recibo de nómina + CFDI del mismo mes

QUÉ TE AYUDA A DECIDIR

Te devuelve una discrepancia visible para que tu primera revisión tenga un punto concreto de claridad.

Nivel de claridad inicial del expediente

64%
Anterior
Siguiente

Empiezas con un solo archivo, desde celular o computadora.

Recibes una auditoría clara con hallazgos, evidencia y siguiente paso.

Tus documentos quedan resguardados en un expediente disponible para ti 24/7.

CONTINÚA CON TU PRIMERA AUDITORÍA

Empieza con el archivo que ya tienes a la mano; si dudas, un recibo de nómina reciente y convierte tu primera duda en un resultado visible, con explicación y evidencia desde el primer intento.

Variante activa: Alerta y control
Recomendación: Documento exacto sugerido

Entra aquí para subir ese archivo y recibir tu primera lectura útil antes de pasar a comparaciones o preguntas más avanzadas.

Auditoría documental clara desde el primer archivo.
Tu información se resguarda y permanece disponible para ti 24/7.
Privacidad visible, lenguaje simple y siguientes pasos concretos.

CÓMO FUNCIONA EN 3 PASOS

Entiende tu situación sin complicarte.

Empiezas con un documento, recibes una auditoría útil y fortaleces tu expediente paso a paso, sin lenguaje complicado ni fricción innecesaria.

01
Sube lo que ya tienes

Puedes empezar con un recibo, CFDI, contrato u otro documento laboral útil sin preparar nada antes.

02
AuditaPatron entiende lo importante

Ordena señales, separa lo confirmado de lo estimado y te explica con claridad dónde conviene poner atención, incluso frente a IMSS e Infonavit.

03
Recibes resultados útiles para avanzar

Cada documento adicional puede dar más contexto, ayudarte a entender mejor tu caso y sugerirte el siguiente paso más útil.

TU EXPEDIENTE EN CRECIMIENTO

Cada documento útil se convierte en orden, claridad y respaldo.

No se trata de subir por subir. Se trata de reunir piezas para que AuditaPatron te dé más claridad, mejor orden y un expediente digital disponible 24/7 si después necesitas revisar, reclamar o respaldar algo con calma.

Más claridad sobre pagos, deducciones y condiciones laborales.

Más contexto para revisar con claridad señales de IMSS e Infonavit.

Mejor respaldo documental disponible 24/7 para futuras revisiones.

Empieza ahora y protege tu futuro

QUÉ YA APORTA CONTEXTO

Tu expediente en crecimiento
Simple y útil

Recibos de nómina recientes

Ayudan a detectar cambios de pago, deducciones y patrones repetidos.

Ya aporta claridad

CFDI timbrado

Sirve para contrastar lo reportado contra lo que realmente recibiste.

Ya aporta claridad

Contrato o condiciones iniciales

Aclara sueldo pactado, jornada y prestaciones desde el inicio.

Puede fortalecerlo

Soporte IMSS, Infonavit o evidencia adicional

Puede reforzar el contexto cuando quieres revisar con más claridad tu alta, aportaciones o continuidad laboral.

Puede fortalecerlo

TU PRIVACIDAD ES PARTE DEL PRODUCTO

Tus documentos se resguardan para darte claridad y tranquilidad desde el inicio.

Cada archivo suma orden, contexto y una explicación más clara de tu situación. La idea es simple: que puedas volver a tu expediente cuando lo necesites y sentir que tus documentos están de tu lado desde el primer momento.

Subes tus documentos en minutos, desde tu celular o computadora.

La información se acomoda para que entiendas qué tienes y qué conviene revisar.

Tu expediente sigue disponible para ti 24/7 cuando necesites volver a verlo.

Las explicaciones buscan darte calma y claridad, no más confusión.

CENTRO DE PRIVACIDAD

Privacidad y control de tu expediente

Aquí puedes conocer de forma simple cómo tratamos tus datos, qué derechos puedes ejercer y qué decisiones de privacidad dejan evidencia dentro de tu expediente digital.

Acceso: puedes solicitar qué datos tenemos, de dónde provienen y para qué se usan.
Rectificación: puedes pedir la corrección de datos inexactos, incompletos o desactualizados.
Cancelación: puedes solicitar la supresión cuando no exista obligación legal, contractual o de defensa jurídica que exija conservarlos.
Oposición: puedes oponerte a tratamientos específicos, en particular finalidades secundarias o usos no indispensables para la prestación principal.

La revocación de consentimientos se procesa con una ventana de gracia de 5 días hábiles para completar cierres operativos, preservar evidencia y atender obligaciones legales o contractuales que sigan vigentes.

Para derechos ARCO o revocación, escríbenos a privacidad@auditapatron.com.

LO QUE QUEREMOS QUE SIENTAS AQUÍ

Entiendo mejor mi situación sin sentirme abrumado.

Mi información está cuidada, ordenada y bajo control.

Tengo mis documentos a la mano cuando más los necesite.

Tus documentos pueden fortalecer tu expediente y darte más respaldo laboral sin perder trazabilidad, control ni disponibilidad cuando los necesites.

AVISO DE PRIVACIDAD
TÉRMINOS Y CONDICIONES

Versión legal vigente: v2.0. La aceptación completa se solicita de forma natural cuando entras a tu expediente.

GUÍA RÁPIDA PARA EMPEZAR

Empieza por la duda que hoy más te frena.

Si todavía no quieres subir un archivo, primero elige tu duda principal y te sugerimos el primer documento que más suele ayudarte a ganar contexto con baja fricción.

MINI DIAGNÓSTICO INICIAL

Elige lo que más se parece a tu caso y te mostramos primero la respuesta útil junto con el documento que mejor suele abrir contexto.

Quiero entender rápido si esto me puede ayudar

Te orienta con el primer archivo que suele abrir más contexto sin complicarte.

No sé qué documento subir primero

Te sugiere el archivo con mejor equilibrio entre facilidad, contexto y utilidad inicial.

Me preocupa mi privacidad y quiero empezar con calma

Aclara cómo se resguardan tus archivos y qué documento puedes usar para probar el flujo con control.

RESULTADO INSTANTÁNEO

Tu recibo de nómina más reciente o un CFDI del mismo periodo

Suelen dar contexto rápido sobre pagos, deducciones, fechas y conceptos para que veas pronto si AuditaPatron te puede ayudar.

Si después quieres más claridad, suma contrato o soporte IMSS/Infonavit y tu expediente gana contexto sin perder el hilo.

Empieza por tu duda principal y revisa primero la respuesta más útil para ti. La recomendación del documento cambia según lo que elijas.

¿Esto me puede servir si todavía no sé qué revisar primero?
Sí. AuditaPatron está pensado para empezar justo ahí: ordenar lo que ya tienes, explicarte lo importante con palabras simples y ayudarte a ver qué conviene revisar primero.
¿Qué documento conviene subir primero?
¿Mi información está protegida?
¿Necesito saber de leyes o de nómina para usarlo?
¿Por qué conviene subir más de un documento?

EMPIEZA CUANDO QUIERAS

Tu primer documento ya puede devolverte más claridad y tranquilidad.

Empieza con lo que ya tienes a la mano y deja que AuditaPatron convierta ese primer archivo en orden, contexto y un expediente digital que seguirá contigo.

Empieza ahora y protege tu futuro
Quiero una guía rápida antes de subir

AuditaPatron te ayuda a recuperar claridad, orden y respaldo con un expediente digital simple, privado y útil para revisar tu situación laboral.

Cómo funciona
Tu expediente
Privacidad
Aviso de Privacidad
Términos y Condiciones
Derechos ARCO

## TEXTO_AUDITAR

# AuditaPatron

**URL:** https://3000-igw07p7g2fg0o552njwun-6f266027.us2.manus.computer/auditar

---

Volver al inicio

TU REVISIÓN

Tus derechos laborales, claros y protegidos

AuditaPatron concentra la información que subes, analiza cada documento, lo resguarda en tu expediente digital y te devuelve resultados útiles para entender mejor tu situación laboral, incluyendo señales sobre IMSS e Infonavit, sin tecnicismos ni pasos confusos.

Vista clara
Revalidar IMSS e Infonavit
Actualizar vista
Ver guía otra vez
Tu avance de esta vista se guarda también entre dispositivos.
ACTUALIZACIÓN LEGAL PENDIENTE
Confirma tu autorización cuando subas o guardes tu documento

Ya no te detenemos con un paso aparte. Cuando estés listo para analizar o guardar tu archivo, verás una confirmación breve en ese mismo punto para proteger tu expediente y dejar trazabilidad versionada.

Revisar aviso y términos vigentes
Versión vigente v2.0

Cobertura legal

1 de 2 documentos aceptados en esta versión.

La aceptación se registra cuando confirmas la acción principal de este expediente.

Estado del resguardo

INTENTOS

0

CONFLICTOS

0

REINTENTOS

0

Estado actual: Sin actividad reciente

EMPIEZA AQUÍ
Sube tu documento y recibe una lectura clara desde el primer archivo.

Este es el punto principal de la experiencia. En cuanto eliges el archivo, arranca la revisión preliminar y la plataforma te devuelve qué entendió, qué hallazgo encontró y cuál conviene que sea tu siguiente movimiento.

Ahora mismo conviene enfocar recibos de nómina para fortalecer la siguiente lectura del expediente.
Elegir archivo para continuar
Prefiero usar la cámara

Qué recibes primero

Una lectura inicial entendible, la señal más importante detectada y el siguiente documento sugerido para no avanzar a ciegas.

Qué pasa con tu archivo

Tu documento se integra al expediente, queda resguardado y alimenta la comparación progresiva con IMSS, Infonavit y el resto de tus piezas.

Cómo seguir después

Si ya tienes un archivo listo, súbelo ahora. Si aún dudas, la sugerencia activa te indica qué documento conviene cargar para ganar más claridad.

ASÍ VA TU EXPEDIENTE LABORAL

Hoy tu expediente laboral va en: Analizando

Ya tienes 0 documentos cargados, 0 de 5 tipos útiles y un indicador vivo que se ajusta con señales reales del expediente. Todavía faltan señales suficientes de IMSS e Infonavit para darte un cruce más completo dentro del expediente. Helios ya recibió documentos del expediente y está ordenando la información para devolverte una lectura más clara.

Cruce IMSS e Infonavit hoy

Cruce pendiente

Empieza por un soporte IMSS o un estado de cuenta o constancia relacionada con Infonavit para abrir este cruce.

0 señales IMSS
0 señales Infonavit

Aún no has revalidado este cruce desde tu expediente.

Claridad actual del expediente
18%

Recibos de nómina

Ayudan a revisar pagos, deducciones y cambios entre periodos.

0%

Pendiente

Permiten detectar diferencias y patrones de pago con más claridad.

0/2 piezas clave

CFDI

Sirven para contrastar lo timbrado fiscalmente contra lo que recibiste.

0%

Pendiente

Aclaran diferencias entre nómina y comprobantes fiscales.

0/2 piezas clave

Contrato o condiciones iniciales

Aterrizan sueldo pactado, jornada, prestaciones y condiciones de inicio.

0%

Pendiente

Ayudan a comparar lo prometido frente a lo realmente ocurrido.

0/1 pieza clave

Soporte IMSS

Refuerza contexto sobre alta, baja, NSS o semanas cotizadas.

0%

Pendiente

Aporta respaldo sobre seguridad social y relación laboral formal.

0/1 pieza clave

Evidencia complementaria

Correos, capturas o chats ayudan a explicar fechas, instrucciones y cambios.

0%

Pendiente

Da contexto adicional cuando un recibo o CFDI por sí solos no bastan.

0/1 pieza clave

DOCUMENTOS QUE MÁS ENRIQUECEN TU EXPEDIENTE LABORAL

Si vas a subir algo más, empieza por los archivos con más contexto.

Estos suelen ser de los documentos más útiles para darte una lectura más completa y dejar tu expediente mejor respaldado con el tiempo.

Hoy te conviene reforzar 4 tipos de documento.

Estas recomendaciones ya están ligadas a lo que todavía hace falta dentro de tu expediente, para que no subas archivos de más ni repitas esfuerzos.

Faltantes reales detectados

ALTA UTILIDAD PARA TU EXPEDIENTE

Recibos de nómina de varios periodos

Enfocado ahora

Suelen ser de los archivos más útiles para detectar cambios repetidos en pagos, descuentos y depósitos.

Mientras más periodos tengas en tu expediente, más fácil es darte una lectura comparada y detectar patrones que un solo recibo no muestra.
Subir este documento

ALTA UTILIDAD PARA TU EXPEDIENTE

CFDI timbrados

Te falta y conviene subirlo

Sirven para contrastar lo que fiscalmente quedó reportado contra lo que aparece en otros documentos del caso.

Ayudan a aclarar diferencias que muchas veces pasan desapercibidas cuando solo existe una versión del pago o del periodo revisado.
Subir este documento

ALTA UTILIDAD PARA TU EXPEDIENTE

Contrato o condiciones de inicio

Te falta y conviene subirlo

Aterrizan sueldo pactado, jornada, prestaciones y acuerdos que luego conviene contrastar con la realidad.

Son clave para entender si lo prometido al inicio coincide con lo que después muestran nóminas, CFDI o evidencia adicional.
Subir este documento

ALTA UTILIDAD PARA TU EXPEDIENTE

Alta, baja o semanas cotizadas del IMSS

Te falta y conviene subirlo

Aportan fechas y señales de seguridad social que fortalecen la historia laboral del expediente.

Suman contexto útil cuando quieres respaldarte mejor, aclarar periodos o entender huecos importantes dentro del caso.
Subir este documento

ESTADO DE TU EXPEDIENTE LABORAL

Tu expediente está listo para empezar a darte claridad · Analizando

Helios ya recibió documentos del expediente y está ordenando la información para devolverte una lectura más clara.

Listo para empezar

QUÉ ESTÁ PASANDO AHORA

Tu expediente se ordena, resguarda y revisa por ti

La interfaz ya está preparada para mostrar una lectura inicial ahora y una revisión más completa después, sin cambiar la forma de usar AuditaPatron.

TIPO DE REVISIÓN

Modo inicial preparado

La experiencia está lista para darte una primera lectura ahora y una revisión más completa después, sin cambiar la forma de uso.

CRUCE IMSS E INFONAVIT

Cruce pendiente

Empieza por un soporte IMSS o un estado de cuenta o constancia relacionada con Infonavit para abrir este cruce.

Aún no has revalidado este cruce desde tu expediente.

SIGUIENTE DOCUMENTO QUE MÁS PUEDE AYUDARTE

Un soporte de IMSS o una constancia de Infonavit

Todavía no hay señales firmes de IMSS e Infonavit, así que cualquiera de esos soportes puede abrir el cruce inicial del expediente.

Preparar esta sugerencia

HISTORIAL DE REVALIDACIONES

Todavía no hay revalidaciones guardadas

Todavía no hay una revalidación registrada para comparar la claridad actual del expediente.
Cuando revalides IMSS e Infonavit desde tu expediente, aquí verás la fecha, el estado y el cambio detectado entre revisiones.

SUBE TU DOCUMENTO

Añade un documento a tu expediente

Después de subirlo, AuditaPatron lo analizará para mostrarte qué ya se entendió, qué conviene revisar y cómo ese archivo queda ordenado dentro de tu expediente digital para tenerlo siempre a la mano.

Tu espacio
balt
Elige tu caso
Despido y reclamación inicial · Folio EMO001

Archivo principal

Puede ser foto, PDF, XML u otro archivo laboral útil.

Documento sugerido preparado

Ahora mismo estamos enfocando recibos de nómina para que retomes exactamente esa recomendación al subir tu archivo.

Quitar enfoque

Sube tu primer documento

El análisis empieza solo en cuanto captures o elijas el documento.

Nitidez y legibilidad
Bordes y orientación
Coincidencia con el documento esperado

Abrir primero

Ideal si ya tienes un PDF, XML o una foto guardada. Abriremos primero tus archivos para quitar fricción.

Cámara
Archivo
Tomar foto
Elegir archivo
Todavía no elegiste archivo. Cuando lo hagas, aquí verás el nombre y el borrador automático antes de decidir si lo guardas definitivamente.
Si quieres, cuéntanos qué es este archivo o para qué te ayuda

Tu documento queda protegido dentro del flujo de AuditaPatron. Primero te mostramos una vista previa para separar lo confirmado de lo estimado y solo después decides si quieres guardarlo en tu expediente.

Elegir archivo para continuar
Limpiar formulario

TU ÚLTIMO DOCUMENTO

Sube un documento para ver qué aportó y cuál es el siguiente paso.

LÍNEA DE TIEMPO DEL EXPEDIENTE

Cómo se fue fortaleciendo tu expediente

Documento por documento, aquí ves cómo se fueron conectando señales para darte más claridad sobre tu caso.

Borrador analizado
Documento confirmado
0 etapas
Tu línea de tiempo está esperando. Sube tu primer documento para ver cómo empieza a construirse tu expediente digital paso a paso y cómo todo queda disponible para ti 24/7.

TUS DOCUMENTOS

Documentos ya incorporados al expediente
0 documentos
Aún no tienes documentos en este expediente. Puedes empezar con el archivo que tengas más a la mano.

EXPEDIENTE LABORAL SELECCIONADO

Expediente Helios de María Fernanda López

Persona trabajadora: María Fernanda López

Patrón o empresa: Compañía Piloto MX

Estado del caso: En análisis

Etapa del expediente: Analizando

Tu expediente se va volviendo más claro con cada documento

Helios ya recibió documentos del expediente y está ordenando la información para devolverte una lectura más clara.

0 documentos en el expediente
0 con lectura visible
Abrir tu asistente laboral
Subir otro documento

Haz preguntas rápidas sobre riesgos, documentos faltantes o el siguiente paso útil con base en lo que ya se analizó, sin salir de tu expediente.

HISTORIAL SIMPLE DEL EXPEDIENTE

Lo último que se movió en tu caso

Así puedes entender qué pasó recientemente sin buscar entre carpetas, mensajes o varios sistemas distintos.

EL FILTRO QUE ELIJAS AQUÍ SE CONSERVA EN ESTE DISPOSITIVO PARA QUE RETOMES TU EXPEDIENTE DONDE LO DEJASTE.

Todo
Documentos
Respuestas
Resúmenes
En cuanto subas tu primer documento, aquí verás un historial simple con lo más reciente de tu expediente.

PRIVACIDAD Y CONSENTIMIENTO

Marco legal visible para tu expediente

Aquí puedes conocer de forma simple cómo tratamos tus datos, qué derechos puedes ejercer y qué decisiones de privacidad dejan evidencia dentro de tu expediente digital. La versión vigente que aplica hoy en AuditaPatron es v2.0.

Aceptación legal pendiente

Todavía faltan 1 documentos por aceptar para habilitar por completo tu expediente y tu asistente laboral.

1/2 ACEPTADOS

ÚLTIMA ACEPTACIÓN REGISTRADA: 9 ABR 2026, 10:25 P.M.

Acceso: puedes solicitar qué datos tenemos, de dónde provienen y para qué se usan.
Rectificación: puedes pedir la corrección de datos inexactos, incompletos o desactualizados.
Cancelación: puedes solicitar la supresión cuando no exista obligación legal, contractual o de defensa jurídica que exija conservarlos.
Oposición: puedes oponerte a tratamientos específicos, en particular finalidades secundarias o usos no indispensables para la prestación principal.

Revocación y derechos ARCO

La revocación de consentimientos se procesa con una ventana de gracia de 5 días hábiles para completar cierres operativos, preservar evidencia y atender obligaciones legales o contractuales que sigan vigentes.

Si quieres ejercer derechos ARCO o pedir apoyo, escríbenos a privacidad@auditapatron.com.

AVISO DE PRIVACIDAD
TÉRMINOS Y CONDICIONES

CICLO DE VALOR VISIBLE

Así se fortalece tu expediente

AuditaPatron recibe tus documentos, los organiza, los contrasta, los resguarda y te devuelve una explicación cada vez más clara y útil.

PASO 1

AuditaPatron recibe y protege

Tu archivo entra a un expediente seguro, queda resguardado y listo para ordenarse sin que tengas que hacer pasos técnicos extra.

PASO 2

La revisión encuentra contexto útil

En cuanto haya lectura visible, empezaremos a decirte qué ya se entendió y qué conviene reforzar, incluyendo señales útiles de IMSS e Infonavit cuando existan en tu expediente.

PASO 3

La respuesta vuelve más completa

Cuando haya seguimiento activo, aquí verás cómo la revisión automática vuelve con más detalle para fortalecer el expediente.

PASO 4

Tú recibes una guía más clara

Las alertas, comparaciones y siguientes documentos sugeridos aparecen en lenguaje simple para ayudarte a decidir con calma.

Por qué esto te aporta más valor con el tiempo

Cada documento nuevo fortalece tu expediente, y cada retorno útil de la revisión automática ayuda a afinar la lectura del caso. Así recibes resultados más consistentes sin sumar complejidad.

SEGUIMIENTO AUTOMÁTICO

Cómo va la respuesta automática

EN ESPERA

0

CONVIENE REVISAR

0

YA RESPONDIDOS

0

El seguimiento automático está listo

En cuanto subas un documento, su revisión avanzará aquí paso a paso. Tu expediente seguirá protegido en todo momento.

EMBUDO OPERATIVO MÍNIMO

Del acceso inicial al primer documento útil

2/4 hitos visibles

PASO 1

Listo

Home

Ya entraste al entorno base desde el que empieza el recorrido operativo.

PASO 2

Listo

Expediente

Ya seleccionaste un expediente y la continuidad entre dispositivos quedó activa.

PASO 3

Pendiente

Aceptación legal

Todavía falta aceptar el paquete legal antes de subir documentos al expediente.

PASO 4

Pendiente

Subida documental

Aún no hay documentos incorporados al expediente visible.

Siguiente hito visible: aceptación legal. Cuando ese paso cambie, esta lectura mínima te dejará ver rápidamente en qué parte exacta se está cayendo el recorrido.
Todavía no hay documentos en seguimiento automático visible. En cuanto subas archivos, aquí verás cómo van avanzando.

COMPARACIÓN GUIADA

¿Qué cambió aquí?

Comparamos documentos del expediente para resaltar diferencias útiles y ayudarte a entender qué conviene revisar después, sin perder de vista que todo queda ordenado en un solo lugar.

Compara tú mismo dos documentos del expediente

Si quieres, puedes cambiar la pareja sugerida para revisar otro contraste sin salir del expediente.

DOCUMENTO 1

Selecciona un documento

DOCUMENTO 2

Selecciona otro documento

Sube al menos dos documentos para activar la comparación manual.

Comparación en espera

La comparación se activará cuando tengas dos piezas útiles

En cuanto subas documentos relacionados, podrás verlos lado a lado y detectar cambios con más claridad.

Alertas priorizadas

Convertimos señales repetidas y puntos sensibles en alertas más fáciles de priorizar dentro de un expediente claro, ordenado y siempre disponible para ti.

Siguiente oportunidad

Subir recibos de nómina puede destrabar más claridad

Ayudan a revisar pagos, deducciones y cambios entre periodos. Permiten detectar diferencias y patrones de pago con más claridad.

Fecha y hora

Sin fecha visible

Motivo

Todavía falta una pieza útil para aclarar mejor el expediente

Qué puedes hacer

Siguiente documento sugerido: Recibos de nómina

Documentos comparados

Todavía no hay archivos suficientes para una comparación guiada dentro del expediente.

Lo que se está contrastando

Cuando tengas dos documentos útiles, podrás revisar fechas, montos, condiciones y señales que hoy aún no se pueden cruzar.

Qué puede ayudarte a aclararlo más

Puedes empezar con recibos de nómina para darle una primera base útil a tu expediente.

Cómo esta comparación gana claridad

Mientras más documentos útiles subas, más contexto habrá para distinguir cambios reales de simples huecos de información.

Verás señales y diferencias útiles, siempre como una lectura preliminar y entendible.

Subir recibos de nómina

SIGUIENTE DOCUMENTO RECOMENDADO

Siguiente documento recomendado

Lo que más puede ayudarte ahora

Documento sugerido: Recibos de nómina

Con tu expediente actual, recibos de nómina puede ayudarte a permiten detectar diferencias y patrones de pago con más claridad.

Por qué ahora puede ser el archivo más útil

Ayudan a revisar pagos, deducciones y cambios entre periodos. Permiten detectar d

## TEXTO_CEO

# AuditaPatron

**URL:** https://3000-igw07p7g2fg0o552njwun-6f266027.us2.manus.computer/ceo

---

Centro de mando ejecutivo para AuditaPatron

Estación de mando para expedientes laborales, visibilidad documental y auditoría integral.
Resumen CEO
1
Bridge
Alertas
1
Accesos
1
Documentos
0
B

balt

balt@cavazos.com

Vista activa: CEO maestro

RESUMEN CEO

Dashboard CEO
Modo CEO maestro
Ver como usuario
Exportar CSV
Reporte PDF
Enviar por correo
Actualizar
Sitio público

CONSOLA EJECUTIVA

Visibilidad integral para operar AuditaPatron con criterio ejecutivo y flujo de escritorio.

Esta consola concentra salud operativa, alertas, accesos por caso y trazabilidad documental en una sola superficie. La jerarquía está pensada para trabajo continuo en computadora: escanear, priorizar, exportar y decidir sin brincar entre pantallas.

SUPERVISA

Mantén arriba la foto global y abajo los listados que sí responden a filtros para investigar sin perder contexto.

DECIDE

El tablero prioriza lectura horizontal y acciones seguras para revisar accesos, alertas y estado operativo con menor fricción.

EXPORTA

CSV, PDF y correo quedan en la misma cabecera para cerrar ciclos ejecutivos sin abandonar la consola.

LECTURA ACTUAL

13 abr 2026, 2:19 a.m.

Usuario actual: balt

Vista activa: Resumen CEO · sin filtros activos

Diseñado para operarlo principalmente desde escritorio. En móvil sigue siendo consultable, pero la experiencia prioriza amplitud visual, comparación y control lateral.

EXPLORACIÓN EJECUTIVA

Filtros y búsqueda rápida transversal

Busca tenants, casos, alertas, accesos y documentos desde una sola superficie. Los KPIs superiores se mantienen globales para conservar contexto; los listados y paneles inferiores sí reaccionan a los filtros.

Vista global
Más filtros
BÚSQUEDA ÚNICA
TENANT
Todos los tenants
balt
SEVERIDAD
Todas las severidades
warning
VENTANA TEMPORAL
Todo el histórico visible
Últimos 7 días
Últimos 30 días
Últimos 90 días
Últimos 12 meses
Cobertura del filtro actual:
Tenants 1
Casos 1
Alertas 1
Accesos 1
Docs 0

TENANTS ACTIVOS

1
Organizaciones con operación visible

CASOS ACTIVOS

1
Expedientes en intake, análisis, conciliación o litigio

ALERTAS ABIERTAS

1
0 críticas

ACCESOS VIGENTES

1
0 por caso

DOCUMENTOS PENDIENTES

0
0 reemplazados

PANEL MAESTRO

Métricas exclusivas del usuario dueño

Este bloque concentra vistas ejecutivas, exportes y bloqueos de guardrails persistidos en la bitácora para el usuario maestro.

Corte 13 abr 2026, 2:19 a.m.

VISTAS CEO

81
Últimos 7 días: 81

GUARDRAILS BLOQUEADOS

0
Últimos 7 días: 0

EXPORTES TRAZADOS

13
Últimos 7 días: 13

ACTORES ÚNICOS

1
Usuarios administradores con interacción registrada

ÚLTIMA VISTA CEO

13 abr 2026, 2:19 a.m.

ÚLTIMO BLOQUEO

Sin fecha

ÚLTIMO EXPORT

12 abr 2026, 7:37 p.m.

Las tarjetas superiores muestran contexto global. Los listados, paneles laterales y contadores de secciones muestran la vista filtrada para evitar perder el panorama completo.

FRESCURA OPERATIVA

Vista fresca. La vista visible sigue dentro de la ventana de frescura operativa para ejecutar acciones seguras.

Actualizar vista

BLOQUE SEGURO

Acciones administrativas acotadas
Sólo cambios con trazabilidad y bajo riesgo

Este bloque sólo expone cambios de bajo riesgo. Cada acción ahora exige una confirmación visual sobre una vista fresca, y el backend rechazará cualquier operación si detecta desalineación de estado o secuencia fuera del carril seguro.

Alertas en secuencia
1
warning
open

Consentimiento documental pendiente

balt

Acusar e iniciar investigación
Accesos por caso
0

No hay accesos por caso aptos para este bloque seguro.

Avance operativo
1
analysis
balt

Despido y reclamación inicial

Última actividad: 5 abr 2026, 11:41 p.m.

Pasar a conciliación

BITÁCORA OPERATIVA

Trazabilidad reciente para diagnóstico ejecutivo
30 eventos recientes

Esta superficie reutiliza la bitácora de auditoría existente para mostrar actividad reciente, rechazos operativos de guardrails y cobertura de casos visibles sin abrir un frente nuevo de infraestructura.

EVENTOS VISIBLES

30

Últimos movimientos auditados bajo el filtro actual.

GUARDRAILS RECHAZADOS

0

Sin rechazos operativos recientes en la vista actual.

EVENTOS DOCUMENTALES

0

Incluye carga, confirmación y rechazos operativos del flujo documental.

CASOS CON HUELLA

0

Casos distintos tocados por los eventos recientes del rastro operativo.

Eventos recientes

Ordenados desde la actividad más reciente del audit trail y segmentables sin salir del tablero.

6 de 30 visibles

FILTROS RÁPIDOS

Combina familia de evento y severidad para aislar fricción, accesos o documentos sin tocar el filtro global.

Todos
Guardrails
Documentos
Accesos
Políticas
Toda severidad
Alta
Media
Normal
Tablero
Normal
system

balt-1

Traza trace.balt-1.CEO-VIEW-1776044243728.mnwivx1shu1hiw

13 abr 2026, 1:37 a.m.

Abrir contexto del tenant
Tenant balt-1
Tablero
Normal
system

balt-1

Traza trace.balt-1.CEO-VIEW-1776044243457.mnwivwu937h01u

13 abr 2026, 1:37 a.m.

Abrir contexto del tenant
Tenant balt-1
Tablero
Normal
system

balt-1

Traza trace.balt-1.CEO-VIEW-1776036023660.mnwdzqekhyhy2a

12 abr 2026, 11:20 p.m.

Abrir contexto del tenant
Tenant balt-1
Tablero
Normal
system

balt-1

Traza trace.balt-1.CEO-VIEW-1776036023467.mnwdzq97y1eatd

12 abr 2026, 11:20 p.m.

Abrir contexto del tenant
Tenant balt-1
Tablero
Normal
system

balt-1

Traza trace.balt-1.CEO-VIEW-1776035986556.mnwdyxrw4w8a2c

12 abr 2026, 11:19 p.m.

Abrir contexto del tenant
Tenant balt-1
Tablero
Normal
system

balt-1

Traza trace.balt-1.CEO-VIEW-1776035986782.mnwdyxy6s3qat4

12 abr 2026, 11:19 p.m.

Abrir contexto del tenant
Tenant balt-1
Lectura rápida

Resumen ejecutivo mínimo para monitorear fricción, trazabilidad, embudo documental y preferencia Cámara/Archivo sin abrir otra capa analítica.

ALERTAS EJECUTIVAS DERIVADAS

0

Aún no se acumulan rechazos suficientes por tenant o caso para disparar una alerta ejecutiva derivada.

EMBUDO PREVIEW → CONFIRMACIÓN → CARGA

0 previews

PREVIEW

0

Análisis previos listos para revisión.

CONFIRMACIÓN

0

Sin base suficiente para medir el paso desde preview.

CARGA FINAL

0

Todavía no hay confirmaciones visibles para cerrar el paso final.

Aún no hay confirmaciones suficientes para estimar el tiempo entre preview y confirmación.

SELECTOR CÁMARA / ARCHIVO

0 selecciones

CÁMARA

0

Capturas donde el preview llegó desde cámara.

ARCHIVO

0

Selecciones donde el preview llegó desde archivo.

Todavía no hay previews visibles con captureMode suficiente para leer preferencia de entrada.

ACCESOS AUDITADOS

0

Cambios de membresías y superficie de acceso trazable.

POLÍTICAS AUDITADAS

0

Cambios de consentimiento o visibilidad ya persistidos.

ÚLTIMO GUARDRAIL

Sin eventos de rechazo recientes

Cuando un guardrail operativo bloquee una acción de Auditar, aparecerá aquí con su razón resumida.

ESTADO DE OPERACIÓN

Salud por tenant
1 organizaciones visibles

balt

pilot

Actualizado: 5 abr 2026, 11:41 p.m.

CASOS

1

ALERTAS

1

MEMBRESÍAS

1

DOCS PENDIENTES

0

EXPEDIENTES RECIENTES

Casos con actividad más reciente
1 visibles
CASO
TENANT
ESTATUS
ÚLTIMA ACTIVIDAD
ACCIÓN SEGURA

Despido y reclamación inicial

CASE-BALT-1-DEMO001

balt
analysis
5 abr 2026, 11:41 p.m.
Pasar a conciliación

DISTRIBUCIÓN

Señales operativas del momento

Casos por estatus

analysis
1

Alertas por severidad

warning
1

PENDIENTES DEL CEO

Prioridades para seguimiento
Hay 1 consentimientos pendientes de resolver.
Existen 0 alertas críticas que merecen revisión ejecutiva.
Se registran 0 accesos de alcance por caso actualmente activos.

## TEXTO_ACCESO

# AuditaPatron

**URL:** https://3000-igw07p7g2fg0o552njwun-6f266027.us2.manus.computer/acceso

---

Cómo funciona
Tu expediente
Asistente
Preguntas
Consola CEO
Ver tu expediente
Empieza ahora y protege tu futuro
Alerta y control
Control inmediato
ALERTA LABORAL TEMPRANA
Sube un documento laboral
y recibe una auditoría clara.

EMPIEZA CON UN SOLO ARCHIVO. AUDITAPATRON LO ORDENA, DETECTA SEÑALES RELEVANTES Y TE DEVUELVE QUÉ ENTENDIÓ, QUÉ FALTA Y QUÉ CONVIENE REVISAR DESPUÉS.

La auditoría documental es el centro de la experiencia: subes un recibo, contrato o CFDI y recibes hallazgos, evidencias y siguientes pasos. Después, si quieres, tu asistente laboral te ayuda a interpretar el expediente sin quitarle protagonismo al análisis principal.

EMPIEZA CON EL DOCUMENTO CORRECTO

Elige la situación que más se parece a tu caso y te sugerimos qué archivo conviene subir primero para obtener una auditoría útil sin reunir todo de una vez.

SIN REUNIR TODO DE UNA VEZ

¿Me puede ayudar?

Quiero entender rápido si esto me sirve.

¿Qué subo primero?

Necesito el mejor archivo para empezar hoy.

Quiero ir con calma

Prefiero empezar con control y confianza.

DOCUMENTO EXACTO SUGERIDO
PRIMER DOCUMENTO SUGERIDO

Si quieres avanzar hoy, este suele ser el archivo con más tracción para arrancar.

El archivo que ya tienes a la mano; si dudas, un recibo de nómina reciente

Es fácil de ubicar y normalmente entrega una primera lectura útil sin esperar a reunir todo el expediente.

Con uno o dos documentos más, AuditaPatron puede comparar mejor y devolverte una lectura más rica.

Variante activa: Alerta y control
Auditoría inicial en segundos
Empezar con ese archivo
Auditar mi situación ahora
Ver qué documento subir primero
R
C
N

SEÑALES DE CONFIANZA

Lenguaje claro, rutas guiadas y un enfoque prudente: primero ves la auditoría del documento, luego decides si quieres profundizar con tu expediente y tu asistente laboral.

CASO ANÓNIMO 01

SEÑAL VERIFICADA

Recibo reciente + CFDI del mismo periodo

“Ya entendí mejor qué revisar primero.”

La persona llegó con una duda difusa sobre pagos reportados y la lectura inicial volvió visible qué archivos convenía comparar primero.

Señal verificada en pruebas de comprensión: el cruce sugerido ayudó a pasar de incertidumbre general a una acción concreta.

CASO ANÓNIMO 02

SEÑAL VERIFICADA

Primer expediente reunido en un solo lugar

“Por fin tengo mis documentos en un solo lugar.”

La necesidad principal era dejar de depender de chats, carpetas dispersas y búsquedas manuales para revisar la situación laboral.

Señal verificada en sesiones de mensaje: el beneficio de orden y disponibilidad 24/7 se entendió como valor inmediato.

CASO ANÓNIMO 03

SEÑAL VERIFICADA

Inicio cuidadoso con enfoque de privacidad

“Me dio paz empezar sin palabras complicadas.”

El flujo permitió empezar con un archivo cotidiano antes de ampliar el contexto del expediente completo.

Señal verificada en feedback cualitativo: el tono prudente redujo fricción en la primera decisión de subida.

VISTA PREVIA DEL REPORTE QUE RECIBES

Un ejemplo simple de cómo AuditaPatron traduce tu documento en hallazgos accionables.

1/3

Esta vista resume lo que importa primero: la señal detectada, el documento que la respalda y el siguiente paso sugerido para seguir construyendo tu expediente.

Documento recibido

Estado real 01

Hallazgo preliminar

Estado real 02

Siguiente paso sugerido

Estado real 03

Puedes recorrer estados reales: documento recibido, hallazgo preliminar y siguiente paso sugerido.

HALLAZGO LABORAL FRECUENTE 01
ESTADO REAL 02

Se cruza la información útil y aparece una señal concreta para revisar sin adelantar conclusiones.

Tu nómina y tu CFDI podrían no coincidir en el mismo periodo.

Un primer cruce entre ambos suele destapar diferencias de conceptos, montos o fechas sin pedirte todo el expediente desde el inicio.

EVIDENCIA DOCUMENTAL SUGERIDA

Recibo de nómina + CFDI del mismo mes

QUÉ TE AYUDA A DECIDIR

Te devuelve una discrepancia visible para que tu primera revisión tenga un punto concreto de claridad.

Nivel de claridad inicial del expediente

64%
Anterior
Siguiente

Empiezas con un solo archivo, desde celular o computadora.

Recibes una auditoría clara con hallazgos, evidencia y siguiente paso.

Tus documentos quedan resguardados en un expediente disponible para ti 24/7.

CONTINÚA CON TU PRIMERA AUDITORÍA

Empieza con el archivo que ya tienes a la mano; si dudas, un recibo de nómina reciente y convierte tu primera duda en un resultado visible, con explicación y evidencia desde el primer intento.

Variante activa: Alerta y control
Recomendación: Documento exacto sugerido

Entra aquí para subir ese archivo y recibir tu primera lectura útil antes de pasar a comparaciones o preguntas más avanzadas.

Auditoría documental clara desde el primer archivo.
Tu información se resguarda y permanece disponible para ti 24/7.
Privacidad visible, lenguaje simple y siguientes pasos concretos.

CÓMO FUNCIONA EN 3 PASOS

Entiende tu situación sin complicarte.

Empiezas con un documento, recibes una auditoría útil y fortaleces tu expediente paso a paso, sin lenguaje complicado ni fricción innecesaria.

01
Sube lo que ya tienes

Puedes empezar con un recibo, CFDI, contrato u otro documento laboral útil sin preparar nada antes.

02
AuditaPatron entiende lo importante

Ordena señales, separa lo confirmado de lo estimado y te explica con claridad dónde conviene poner atención, incluso frente a IMSS e Infonavit.

03
Recibes resultados útiles para avanzar

Cada documento adicional puede dar más contexto, ayudarte a entender mejor tu caso y sugerirte el siguiente paso más útil.

TU EXPEDIENTE EN CRECIMIENTO

Cada documento útil se convierte en orden, claridad y respaldo.

No se trata de subir por subir. Se trata de reunir piezas para que AuditaPatron te dé más claridad, mejor orden y un expediente digital disponible 24/7 si después necesitas revisar, reclamar o respaldar algo con calma.

Más claridad sobre pagos, deducciones y condiciones laborales.

Más contexto para revisar con claridad señales de IMSS e Infonavit.

Mejor respaldo documental disponible 24/7 para futuras revisiones.

Empieza ahora y protege tu futuro

QUÉ YA APORTA CONTEXTO

Tu expediente en crecimiento
Simple y útil

Recibos de nómina recientes

Ayudan a detectar cambios de pago, deducciones y patrones repetidos.

Ya aporta claridad

CFDI timbrado

Sirve para contrastar lo reportado contra lo que realmente recibiste.

Ya aporta claridad

Contrato o condiciones iniciales

Aclara sueldo pactado, jornada y prestaciones desde el inicio.

Puede fortalecerlo

Soporte IMSS, Infonavit o evidencia adicional

Puede reforzar el contexto cuando quieres revisar con más claridad tu alta, aportaciones o continuidad laboral.

Puede fortalecerlo

TU PRIVACIDAD ES PARTE DEL PRODUCTO

Tus documentos se resguardan para darte claridad y tranquilidad desde el inicio.

Cada archivo suma orden, contexto y una explicación más clara de tu situación. La idea es simple: que puedas volver a tu expediente cuando lo necesites y sentir que tus documentos están de tu lado desde el primer momento.

Subes tus documentos en minutos, desde tu celular o computadora.

La información se acomoda para que entiendas qué tienes y qué conviene revisar.

Tu expediente sigue disponible para ti 24/7 cuando necesites volver a verlo.

Las explicaciones buscan darte calma y claridad, no más confusión.

CENTRO DE PRIVACIDAD

Privacidad y control de tu expediente

Aquí puedes conocer de forma simple cómo tratamos tus datos, qué derechos puedes ejercer y qué decisiones de privacidad dejan evidencia dentro de tu expediente digital.

Acceso: puedes solicitar qué datos tenemos, de dónde provienen y para qué se usan.
Rectificación: puedes pedir la corrección de datos inexactos, incompletos o desactualizados.
Cancelación: puedes solicitar la supresión cuando no exista obligación legal, contractual o de defensa jurídica que exija conservarlos.
Oposición: puedes oponerte a tratamientos específicos, en particular finalidades secundarias o usos no indispensables para la prestación principal.

La revocación de consentimientos se procesa con una ventana de gracia de 5 días hábiles para completar cierres operativos, preservar evidencia y atender obligaciones legales o contractuales que sigan vigentes.

Para derechos ARCO o revocación, escríbenos a privacidad@auditapatron.com.

LO QUE QUEREMOS QUE SIENTAS AQUÍ

Entiendo mejor mi situación sin sentirme abrumado.

Mi información está cuidada, ordenada y bajo control.

Tengo mis documentos a la mano cuando más los necesite.

Tus documentos pueden fortalecer tu expediente y darte más respaldo laboral sin perder trazabilidad, control ni disponibilidad cuando los necesites.

AVISO DE PRIVACIDAD
TÉRMINOS Y CONDICIONES

Versión legal vigente: v2.0. La aceptación completa se solicita de forma natural cuando entras a tu expediente.

GUÍA RÁPIDA PARA EMPEZAR

Empieza por la duda que hoy más te frena.

Si todavía no quieres subir un archivo, primero elige tu duda principal y te sugerimos el primer documento que más suele ayudarte a ganar contexto con baja fricción.

MINI DIAGNÓSTICO INICIAL

Elige lo que más se parece a tu caso y te mostramos primero la respuesta útil junto con el documento que mejor suele abrir contexto.

Quiero entender rápido si esto me puede ayudar

Te orienta con el primer archivo que suele abrir más contexto sin complicarte.

No sé qué documento subir primero

Te sugiere el archivo con mejor equilibrio entre facilidad, contexto y utilidad inicial.

Me preocupa mi privacidad y quiero empezar con calma

Aclara cómo se resguardan tus archivos y qué documento puedes usar para probar el flujo con control.

RESULTADO INSTANTÁNEO

Tu recibo de nómina más reciente o un CFDI del mismo periodo

Suelen dar contexto rápido sobre pagos, deducciones, fechas y conceptos para que veas pronto si AuditaPatron te puede ayudar.

Si después quieres más claridad, suma contrato o soporte IMSS/Infonavit y tu expediente gana contexto sin perder el hilo.

Empieza por tu duda principal y revisa primero la respuesta más útil para ti. La recomendación del documento cambia según lo que elijas.

¿Esto me puede servir si todavía no sé qué revisar primero?
Sí. AuditaPatron está pensado para empezar justo ahí: ordenar lo que ya tienes, explicarte lo importante con palabras simples y ayudarte a ver qué conviene revisar primero.
¿Qué documento conviene subir primero?
¿Mi información está protegida?
¿Necesito saber de leyes o de nómina para usarlo?
¿Por qué conviene subir más de un documento?

EMPIEZA CUANDO QUIERAS

Tu primer documento ya puede devolverte más claridad y tranquilidad.

Empieza con lo que ya tienes a la mano y deja que AuditaPatron convierta ese primer archivo en orden, contexto y un expediente digital que seguirá contigo.

Empieza ahora y protege tu futuro
Quiero una guía rápida antes de subir

AuditaPatron te ayuda a recuperar claridad, orden y respaldo con un expediente digital simple, privado y útil para revisar tu situación laboral.

Cómo funciona
Tu expediente
Privacidad
Aviso de Privacidad
Términos y Condiciones
Derechos ARCO
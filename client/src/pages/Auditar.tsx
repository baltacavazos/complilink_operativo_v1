import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
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

type DossierTarget = {
  type: "payroll_receipt" | "cfdi" | "contract" | "imss" | "evidence";
  label: string;
  description: string;
  benefit: string;
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

const dossierTargets: DossierTarget[] = [
  {
    type: "payroll_receipt",
    label: "Recibos de nómina",
    description: "Ayudan a revisar pagos, deducciones y cambios entre periodos.",
    benefit: "Permiten detectar diferencias y patrones de pago con más claridad.",
  },
  {
    type: "cfdi",
    label: "CFDI",
    description: "Sirven para contrastar lo timbrado fiscalmente contra lo que recibiste.",
    benefit: "Aclaran diferencias entre nómina y comprobantes fiscales.",
  },
  {
    type: "contract",
    label: "Contrato o condiciones iniciales",
    description: "Aterrizan sueldo pactado, jornada, prestaciones y condiciones de inicio.",
    benefit: "Ayudan a comparar lo prometido frente a lo realmente ocurrido.",
  },
  {
    type: "imss",
    label: "Soporte IMSS",
    description: "Refuerza contexto sobre alta, baja, NSS o semanas cotizadas.",
    benefit: "Aporta respaldo sobre seguridad social y relación laboral formal.",
  },
  {
    type: "evidence",
    label: "Evidencia complementaria",
    description: "Correos, capturas o chats ayudan a explicar fechas, instrucciones y cambios.",
    benefit: "Da contexto adicional cuando un recibo o CFDI por sí solos no bastan.",
  },
];

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
  return value === "remote" ? "Helios remoto" : "Helios inicial";
}

function getHeliosActivationCopy(value?: string | null) {
  return value === "remote"
    ? "La lectura ya viene desde la integración remota de Helios y la interfaz conserva la misma experiencia para la persona usuaria."
    : "La experiencia ya está lista para mostrar una respuesta remota de Helios en cuanto se encienda ese modo, sin cambiar la forma de uso.";
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
      title: "Helios ya está construyendo criterio dentro del expediente",
      description:
        params.documentsWithOpinion > 1
          ? `Ya dejó una lectura preliminar visible en ${params.documentsWithOpinion} documentos y puede seguir conectando señales entre ellos.`
          : "Ya dejó una lectura preliminar visible y puede seguir conectando este documento con el resto del expediente.",
      detail:
        "Ahora Helios no solo recibe archivos: interpreta contexto, separa lo claro de lo preliminar y orienta el siguiente paso útil dentro del caso.",
      tone: "success" as const,
    };
  }

  if (params.engineStatus === "sent" || params.opinion?.status === "processing" || params.opinion?.status === "sent") {
    return {
      badge: "Interpretando",
      title: "Helios ya recibió material y está listo para devolver lectura visible",
      description:
        "El documento ya quedó protegido y la interfaz está preparada para mostrar la lectura apenas la integración devuelva más detalle.",
      detail:
        "Mientras tanto, la persona puede seguir reuniendo documentos sin perder trazabilidad ni contexto del expediente.",
      tone: "processing" as const,
    };
  }

  if (params.engineStatus === "failed") {
    return {
      badge: "Revisión pendiente",
      title: "Helios necesita un nuevo intento, pero el expediente sigue intacto",
      description:
        params.engineReason === "webhook_rejected"
          ? "La etapa automática necesita revisión, aunque el documento sí quedó guardado y protegido dentro del expediente."
          : "Hubo una pausa temporal en la etapa automática, pero el documento quedó resguardado y listo para retomar la interpretación.",
      detail:
        "La experiencia mantiene el archivo disponible y deja lista la base para reanudar la lectura sin rehacer pasos del usuario.",
      tone: "warning" as const,
    };
  }

  return {
    badge: "Listo para empezar",
    title: "Helios está listo para convertirse en el cerebro activo de este expediente",
    description:
      "En cuanto subas un documento útil, Helios empezará a interpretarlo, ordenar señales y sugerir el siguiente paso más útil.",
    detail:
      "La interfaz ya está preparada para mostrar una lectura inicial ahora y una respuesta remota más adelante, sin cambiar la forma de usar AuditaPatron.",
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
        description: "CompliLink ya devolvió información para este documento.",
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

export default function Auditar() {
  const auth = useAuth();
  const utils = trpc.useUtils();
  const bootstrapMutation = trpc.workspace.bootstrap.useMutation();
  const uploadMutation = trpc.cases.uploadDocument.useMutation();

  const [bootstrapStarted, setBootstrapStarted] = useState(false);
  const [selectedTenantId, setSelectedTenantId] = useState("");
  const [selectedCaseId, setSelectedCaseId] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [textHint, setTextHint] = useState("");
  const [pickerKey, setPickerKey] = useState(0);
  const [uploadSourceOpen, setUploadSourceOpen] = useState(false);
  const [estimatedAcknowledged, setEstimatedAcknowledged] = useState(false);
  const [lastUpload, setLastUpload] = useState<Awaited<ReturnType<typeof uploadMutation.mutateAsync>> | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  const caseDetailQuery = trpc.cases.detail.useQuery(caseDetailInput as { tenantId: string; caseId: string }, {
    enabled: auth.isAuthenticated && Boolean(caseDetailInput),
    refetchOnWindowFocus: false,
  });

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

  const documents = caseDetailQuery.data?.documents ?? [];
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
    engineStatus: lastUpload?.engineDispatch?.status,
    engineReason: lastUpload?.engineDispatch?.reason,
    documentsWithOpinion: heliosDocumentsCount,
  });
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

  const engineStatus = getEngineStatusCopy(lastUpload?.engineDispatch?.status, lastUpload?.engineDispatch?.reason);
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

  useEffect(() => {
    setEstimatedAcknowledged(false);
  }, [lastUpload]);

  const clearSelectedFile = () => {
    setSelectedFile(null);
    setTextHint("");
    setSubmitError(null);
    setPickerKey((value) => value + 1);
    setUploadSourceOpen(false);
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    setSubmitError(null);
    setUploadSourceOpen(false);
  };

  const openCameraPicker = () => {
    cameraInputRef.current?.click();
  };

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  const handleUpload = async () => {
    if (!selectedTenantId || !selectedCaseId || !selectedFile) {
      setSubmitError("Selecciona un expediente y un archivo antes de continuar.");
      return;
    }

    try {
      setSubmitError(null);
      const base64Content = await fileToBase64(selectedFile);
      const result = await uploadMutation.mutateAsync({
        tenantId: selectedTenantId,
        caseId: selectedCaseId,
        fileName: selectedFile.name,
        mimeType: selectedFile.type || "application/octet-stream",
        base64Content,
        textHint: textHint || undefined,
        visibility: "tenant_legal",
        consentStatus: "pending",
        sourceChannel: "manual",
      });

      setLastUpload(result);
      setSelectedFile(null);
      setTextHint("");
      setPickerKey((value) => value + 1);

      await Promise.all([
        utils.cases.list.invalidate({ tenantId: selectedTenantId }),
        utils.cases.detail.invalidate({ tenantId: selectedTenantId, caseId: selectedCaseId }),
      ]);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "No fue posible subir el archivo.");
    }
  };

  if (auth.loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-12 text-slate-950">
        <div className="container max-w-5xl">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
            <p className="text-sm font-semibold text-teal-700">AuditaPatron</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-slate-950">Preparando tu espacio de revisión...</h1>
          </div>
        </div>
      </main>
    );
  }

  if (!auth.isAuthenticated) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(20,184,166,0.12),_transparent_35%),linear-gradient(180deg,_#f8fafc_0%,_#ffffff_100%)] px-4 py-10 text-slate-950">
        <div className="container max-w-5xl">
          <a href="/" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-950">
            <ArrowLeft className="h-4 w-4" strokeWidth={1.8} />
            Volver al inicio
          </a>

          <div className="mt-5 grid gap-6 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_35px_100px_-60px_rgba(15,23,42,0.45)] lg:grid-cols-[1fr_0.9fr] lg:p-8">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-teal-100 bg-teal-50 px-4 py-2 text-sm font-medium text-teal-800">
                <ShieldCheck className="h-4 w-4" strokeWidth={1.8} />
                Para trabajadores, sin lenguaje complicado
              </div>
              <h1 className="mt-5 text-3xl font-semibold tracking-[-0.05em] text-slate-950 sm:text-4xl">
                Tus derechos laborales, claros y protegidos
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
                Entiende lo importante y avanza con pasos simples.
              </p>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Button
                  className="h-12 rounded-full bg-teal-600 px-7 text-base text-white hover:bg-teal-700"
                  onClick={() => {
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

            <div className="rounded-[1.6rem] border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">Qué verás aquí</p>
              <div className="mt-4 space-y-3">
                {[
                  "Ve rápido cómo va tu expediente.",
                  "Sube documentos con pasos simples.",
                  "Distingue lo confirmado de lo estimado.",
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
    <main className="min-h-screen bg-slate-50 px-4 py-6 pb-28 text-slate-950 sm:py-8 sm:pb-10">
      <div className="container max-w-6xl">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <a href="/" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-950">
              <ArrowLeft className="h-4 w-4" strokeWidth={1.8} />
              Volver al inicio
            </a>
            <p className="mt-4 text-sm font-semibold uppercase tracking-[0.24em] text-teal-700">/auditar</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-4xl">
              Tus derechos laborales, claros y protegidos
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base sm:leading-7">
              Sube documentos y deja que Helios, el cerebro central del expediente, conecte señales, interprete contexto y te muestre una lectura preliminar en lenguaje claro.
            </p>
          </div>

          <Button
            variant="outline"
            className="rounded-full border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
            onClick={() => {
              setSubmitError(null);
              setLastUpload(null);
              void Promise.all([tenantsQuery.refetch(), casesQuery.refetch(), caseDetailQuery.refetch()]);
            }}
          >
            <RefreshCw className="mr-2 h-4 w-4" strokeWidth={1.8} />
            Actualizar información
          </Button>
        </div>

        {bootstrapMutation.isPending ? (
          <div className="mt-8 rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-600">Estamos preparando tu espacio y tu expediente inicial...</p>
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
                bootstrapMutation.reset();
              }}
            >
              Reintentar
            </Button>
          </div>
        ) : null}

        <div className="mt-6 grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
          <section className="space-y-6">
            <div className="rounded-[1.65rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">Así va tu expediente</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950">
                    Hoy tu expediente va en: {dossierStatus.label}
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                    Ya tienes {documents.length} documento{documents.length === 1 ? "" : "s"} cargado{documents.length === 1 ? "" : "s"} y {dossierStatus.completed} de {dossierStatus.total} tipos útiles para entender mejor tu caso.
                  </p>
                </div>

                <div className="min-w-[240px] rounded-[1.5rem] border border-teal-100 bg-teal-50 p-4">
                  <p className="text-sm font-semibold text-teal-900">Próximo paso que más puede ayudarte</p>
                  <p className="mt-2 text-base font-semibold text-slate-950">
                    {dossierStatus.nextTarget ? dossierStatus.nextTarget.label : "Ya tienes una base documental muy completa"}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-teal-950">
                    {dossierStatus.nextTarget
                      ? dossierStatus.nextTarget.benefit
                      : "Si tienes algún archivo adicional específico de tu caso, también puede sumar contexto útil."}
                  </p>
                </div>
              </div>

              <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-gradient-to-r from-teal-500 to-cyan-500" style={{ width: `${dossierStatus.percent}%` }} />
              </div>

              <div className="mt-6 grid gap-3 md:grid-cols-2">
                {dossierTargets.map((item) => {
                  const isPresent = presentTypes.has(item.type);
                  return (
                    <article key={item.type} className="rounded-[1.25rem] border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-semibold text-slate-900">{item.label}</p>
                          <p className="mt-1 text-sm leading-6 text-slate-600">{item.description}</p>
                        </div>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            isPresent ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {isPresent ? "Ya está presente" : "Puede ayudar mucho"}
                        </span>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-700">{item.benefit}</p>
                    </article>
                  );
                })}
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
                      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Microestado de Helios</p>
                      <h3 className="mt-2 text-xl font-semibold text-slate-950">{heliosStage.title}</h3>
                      <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-700">{heliosStage.description}</p>
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
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Qué hace ahora</p>
                    <p className="mt-2 font-semibold text-slate-950">Interpreta y ordena</p>
                    <p className="mt-2 text-sm leading-6 text-slate-700">{heliosStage.detail}</p>
                  </div>

                  <div className="rounded-[1.15rem] border border-white/80 bg-white/85 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Modo actual</p>
                    <p className="mt-2 font-semibold text-slate-950">
                      {visibleHeliosOpinion ? getHeliosModeLabel(visibleHeliosOpinion.mode) : "Base lista para modo remoto"}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-700">{getHeliosActivationCopy(visibleHeliosOpinion?.mode)}</p>
                  </div>

                  <div className="rounded-[1.15rem] border border-white/80 bg-white/85 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Cómo interactúas</p>
                    <p className="mt-2 font-semibold text-slate-950">Subes, revisas y avanzas</p>
                    <p className="mt-2 text-sm leading-6 text-slate-700">
                      {visibleHeliosOpinion
                        ? "La persona usuaria ve lo que Helios entendió, lo que sigue siendo preliminar y el siguiente documento más útil sin entrar a una interfaz técnica."
                        : "La persona usuaria solo necesita subir un archivo útil. Helios se encarga de interpretarlo y devolver una guía simple dentro del expediente."}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[1.65rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">Sube tu documento</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950">
                    Añade un documento a tu expediente
                  </h2>
                </div>
                <p className="max-w-lg text-sm leading-6 text-slate-600">
                  Después de subirlo, Helios te mostrará qué entendió, qué conviene revisar y cuál es el siguiente paso más útil.
                </p>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Espacio de trabajo</span>
                  <select
                    value={selectedTenantId}
                    onChange={(event) => {
                      setSelectedTenantId(event.target.value);
                      setSelectedCaseId("");
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
                  <span className="text-sm font-medium text-slate-700">Elige el expediente correcto</span>
                  <select
                    value={selectedCaseId}
                    onChange={(event) => {
                      setSelectedCaseId(event.target.value);
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

              <div className="mt-6 rounded-[1.4rem] border border-slate-200 bg-slate-50 p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-teal-600 text-white">
                    <FileUp className="h-5 w-5" strokeWidth={1.8} />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-950">Archivo principal</p>
                    <p className="text-sm text-slate-600">Puede ser foto, PDF, XML u otro archivo laboral útil.</p>
                  </div>
                </div>

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
                  <div className="sm:hidden space-y-2">
                    <Button
                      variant="outline"
                      className="h-12 w-full rounded-2xl border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
                      onClick={() => setUploadSourceOpen(true)}
                    >
                      {selectedFile ? "Cambiar foto o archivo" : "Elegir cómo subirlo"}
                    </Button>
                    <p className="text-xs leading-5 text-slate-500">
                      Toma foto o elige un archivo ya guardado.
                    </p>
                  </div>

                  <div className="hidden gap-3 sm:grid sm:grid-cols-2">
                    <Button
                      variant="outline"
                      className="h-12 rounded-2xl border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
                      onClick={openCameraPicker}
                    >
                      <Camera className="mr-2 h-4 w-4" strokeWidth={1.8} />
                      Tomar foto
                    </Button>
                    <Button
                      variant="outline"
                      className="h-12 rounded-2xl border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
                      onClick={openFilePicker}
                    >
                      <FolderOpen className="mr-2 h-4 w-4" strokeWidth={1.8} />
                      Elegir archivo
                    </Button>
                  </div>
                </div>

                {selectedFile ? (
                  <div className="mt-4 rounded-[1.2rem] border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-900">
                    <p className="font-semibold">Archivo listo para enviarse</p>
                    <p className="mt-1">{selectedFile.name} · {(selectedFile.size / 1024).toFixed(1)} KB</p>
                  </div>
                ) : (
                  <div className="mt-4 rounded-[1.2rem] border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-600">
                    Todavía no elegiste archivo. Cuando lo hagas, aquí verás el nombre antes de enviarlo.
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
                  <p>
                    Tu documento queda protegido. Lo que ya se vea con claridad aparecerá como dato confirmado; lo demás se mostrará como estimación para revisarlo con calma.
                  </p>
                </div>
              </div>

              {submitError ? (
                <div className="mt-6 rounded-[1.2rem] border border-amber-200 bg-amber-50 p-4 text-sm leading-7 text-amber-950">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="mt-1 h-5 w-5 shrink-0" strokeWidth={1.8} />
                    <p>{submitError}</p>
                  </div>
                </div>
              ) : null}

              <div className="mt-5 hidden flex-col gap-3 sm:flex lg:flex-row">
                <Button
                  className="h-12 rounded-full bg-teal-600 px-7 text-white hover:bg-teal-700"
                  disabled={uploadMutation.isPending || !selectedTenantId || !selectedCaseId}
                  onClick={() => {
                    if (!selectedFile) {
                      openFilePicker();
                      return;
                    }
                    void handleUpload();
                  }}
                >
                  {uploadMutation.isPending
                    ? "Subiendo y revisando..."
                    : selectedFile
                      ? "Subir y revisar documento"
                      : "Elegir archivo para continuar"}
                  <ArrowRight className="ml-2 h-4 w-4" strokeWidth={1.8} />
                </Button>
                <Button
                  variant="outline"
                  className="h-12 rounded-full border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  onClick={clearSelectedFile}
                >
                  Limpiar formulario
                </Button>
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">Tu último documento</p>

              {!lastUpload ? (
                <div className="mt-4 rounded-[1.3rem] border border-slate-200 bg-slate-50 p-5 text-sm leading-7 text-slate-600">
                  Sube un documento para ver qué aportó y cuál es el siguiente paso.
                </div>
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
                    Lo confirmado aparece separado de lo estimado para que sepas qué ya está claro y qué todavía conviene revisar con calma.
                  </div>

                  {lastHeliosOpinion ? (
                    <div className="rounded-[1.3rem] border border-teal-100 bg-white p-4 sm:p-5">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-teal-700">Lectura preliminar de Helios</p>
                          <h3 className="mt-2 text-xl font-semibold text-slate-950">Helios ya interpretó este documento dentro del expediente</h3>
                          <p className="mt-3 text-sm leading-7 text-slate-700">
                            {lastHeliosOpinion.summary ?? "Helios ya generó una lectura preliminar útil para seguir armando tu expediente."}
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
                          {lastHeliosOpinion.legalOpinion}
                        </div>
                      ) : null}

                      <div className="mt-4 grid gap-4 lg:grid-cols-2">
                        <div className="rounded-[1rem] border border-teal-100 bg-teal-50 p-4">
                          <p className="font-semibold text-teal-950">Qué haría Helios después</p>
                          <p className="mt-2 text-sm leading-7 text-teal-900">
                            {lastHeliosOpinion.recommendedNextStep ?? "Seguir conectando este documento con otros archivos del expediente para afinar la lectura."}
                          </p>
                          {lastHeliosOpinion.recommendedActions?.length ? (
                            <div className="mt-3 space-y-2 text-sm leading-6 text-teal-950">
                              {lastHeliosOpinion.recommendedActions.map((item) => (
                                <p key={item}>• {item}</p>
                              ))}
                            </div>
                          ) : null}
                        </div>

                        <div className="rounded-[1rem] border border-amber-200 bg-amber-50 p-4">
                          <p className="font-semibold text-amber-950">Qué sigue siendo preliminar</p>
                          {lastHeliosOpinion.uncertainties?.length ? (
                            <div className="mt-2 space-y-2 text-sm leading-6 text-amber-950">
                              {lastHeliosOpinion.uncertainties.map((item) => (
                                <p key={item}>• {item}</p>
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
                            Este documento ya se envió a CompliLink. En la columna lateral verás si la respuesta ya llegó o si conviene darle seguimiento con calma.
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

              {attentionMonitoringDocuments.length > 0 ? (
                <div className="mt-4 rounded-[1rem] border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
                  Hay {attentionMonitoringDocuments.length} documento{attentionMonitoringDocuments.length === 1 ? "" : "s"} cuya respuesta está tardando más de lo normal. No se perdió, pero conviene revisarlo.
                </div>
              ) : null}
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
                    return (
                      <article key={document.documentId} className="rounded-[1.4rem] border border-slate-200 bg-slate-50 p-4">
                        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                          <div>
                            <p className="font-semibold text-slate-950">{document.originalName}</p>
                            <p className="mt-1 text-sm leading-6 text-slate-600">
                              Tipo detectado: {getSimpleDocumentTypeLabel(document.documentType)}
                            </p>
                            <p className="mt-1 text-sm leading-6 text-slate-500">Incorporado el {formatDate(document.createdAt)}</p>
                          </div>

                          <div className="flex flex-wrap gap-2 text-xs font-semibold">
                            <span className={`rounded-full px-3 py-1 ${readiness.classes}`}>{readiness.label}</span>
                            <span className="rounded-full bg-white px-3 py-1 text-slate-700">{getConsentLabel(document.consentStatus)}</span>
                            <span className="rounded-full bg-white px-3 py-1 text-slate-700">{getVisibilityLabel(document.visibility)}</span>
                            <span className={`rounded-full px-3 py-1 ${heliosOpinion ? "bg-teal-100 text-teal-800" : "bg-slate-200 text-slate-700"}`}>
                              {heliosOpinion ? "Helios ya lo interpretó" : "Helios pendiente"}
                            </span>
                          </div>
                        </div>

                        <div className="mt-4 rounded-[1rem] bg-white p-3 text-sm leading-6 text-slate-700">
                          {readiness.description}
                        </div>

                        {heliosOpinion ? (
                          <details className="mt-4 rounded-[1rem] border border-teal-100 bg-white p-4">
                            <summary className="flex cursor-pointer list-none items-start justify-between gap-4">
                              <div>
                                <p className="text-sm font-semibold text-slate-950">Abrir lectura preliminar de Helios</p>
                                <p className="mt-1 text-sm leading-6 text-slate-600">
                                  {heliosOpinion.summary ?? "Helios ya dejó una lectura inicial guardada dentro del expediente."}
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
                                        <p key={item}>• {item}</p>
                                      ))}
                                    </div>
                                  ) : null}
                                </div>

                                <div className="rounded-[1rem] border border-amber-200 bg-amber-50 p-3">
                                  <p className="font-semibold text-amber-950">Puntos que todavía conviene confirmar</p>
                                  {heliosOpinion.uncertainties?.length ? (
                                    <div className="mt-2 space-y-2 text-sm leading-6 text-amber-950">
                                      {heliosOpinion.uncertainties.map((item) => (
                                        <p key={item}>• {item}</p>
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
                            Helios todavía no tiene una lectura visible guardada para este documento dentro del expediente.
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
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">Expediente seleccionado</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950">
                {caseDetailQuery.data?.case.title ?? "Selecciona un expediente"}
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
              </div>

              <div className="mt-4 rounded-[1.2rem] border border-teal-100 bg-teal-50 p-4">
                <div className="flex items-start gap-3">
                  <Sparkles className="mt-1 h-5 w-5 shrink-0 text-teal-700" strokeWidth={1.8} />
                  <div>
                    <p className="font-semibold text-teal-950">Helios es el cerebro central de este expediente</p>
                    <p className="mt-2 text-sm leading-7 text-teal-900">
                      {heliosDocumentsCount === 0
                        ? "Todavía no hay una lectura jurídica visible de Helios. En cuanto interprete documentos, aquí verás cómo va armando el criterio del expediente."
                        : `Helios ya interpretó ${heliosDocumentsCount} documento${heliosDocumentsCount === 1 ? "" : "s"} y va conectando esa información para construir una lectura cada vez más útil del caso.`}
                    </p>
                    {latestPersistedHeliosOpinion ? (
                      <div className="mt-3 rounded-[1rem] bg-white p-3 text-sm leading-6 text-slate-700">
                        <p className="font-semibold text-slate-950">Última lectura guardada</p>
                        <p className="mt-1">{latestPersistedHeliosOpinion.summary}</p>
                        <p className="mt-2 text-xs text-slate-500">Documento: {latestHeliosDocument?.originalName ?? "Sin detalle visible"}</p>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">Seguimiento con CompliLink</p>
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

              {pendingMonitoringDocuments.length === 0 ? (
                <div className="mt-4 rounded-[1.3rem] border border-slate-200 bg-slate-50 p-4 text-sm leading-7 text-slate-700">
                  {monitoringDocuments.length === 0
                    ? "Todavía no hay documentos con seguimiento automático visible en esta parte."
                    : "Por ahora no tienes documentos esperando respuesta automática fuera del tiempo normal."}
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {pendingMonitoringDocuments.map((item) => {
                    const state = getMonitoringStatusCopy(item.status);
                    return (
                      <div key={item.documentId} className="rounded-[1.2rem] border border-slate-200 bg-slate-50 p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-sm font-semibold text-slate-950">{item.documentName}</p>
                            <p className="mt-1 text-sm leading-6 text-slate-600">{item.message}</p>
                          </div>
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${state.classes}`}>{state.label}</span>
                        </div>
                        <div className="mt-3 text-xs leading-6 text-slate-500">
                          <p>Enviado el {item.dispatchedAt ? formatDate(item.dispatchedAt) : "sin fecha visible"}</p>
                          {item.respondedAt ? <p>Respondido el {formatDate(item.respondedAt)}</p> : null}
                          {item.responseEvent ? <p>Último movimiento: {getReturnEventLabel(item.responseEvent)}</p> : null}
                        </div>
                        {item.status === "attention" ? (
                          <div className="mt-3 rounded-[1rem] border border-amber-200 bg-white p-3 text-sm leading-6 text-amber-950">
                            Este documento no está perdido, pero sí conviene revisarlo porque la respuesta está tardando más de lo normal.
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">Qué documento suele ayudar más</p>
              <div className="mt-4 rounded-[1.3rem] border border-teal-100 bg-teal-50 p-4">
                <p className="font-semibold text-teal-950">
                  {dossierStatus.nextTarget ? dossierStatus.nextTarget.label : "Tu expediente ya cubre varias piezas clave"}
                </p>
                <p className="mt-2 text-sm leading-7 text-teal-900">
                  {dossierStatus.nextTarget
                    ? `${dossierStatus.nextTarget.description} ${dossierStatus.nextTarget.benefit}`
                    : "Si tienes un archivo adicional específico de tu caso, también puede complementar el contexto del expediente."}
                </p>
              </div>

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
              Puedes tomar una foto en ese momento o elegir un archivo que ya tengas guardado en tu celular o computadora.
            </DrawerDescription>
          </DrawerHeader>
          <div className="space-y-3 px-4 pb-2">
            <Button
              className="h-12 w-full rounded-2xl bg-teal-600 text-white hover:bg-teal-700"
              onClick={openCameraPicker}
            >
              <Camera className="mr-2 h-4 w-4" strokeWidth={1.8} />
              Tomar foto del documento
            </Button>
            <Button
              variant="outline"
              className="h-12 w-full rounded-2xl border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
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
          <Button
            className="h-14 w-full rounded-[1.2rem] bg-teal-600 text-base font-semibold text-white hover:bg-teal-700"
            disabled={uploadMutation.isPending || !selectedTenantId || !selectedCaseId}
            onClick={() => {
              if (!selectedFile) {
                setUploadSourceOpen(true);
                return;
              }
              void handleUpload();
            }}
          >
            {uploadMutation.isPending
              ? "Subiendo y revisando..."
              : selectedFile
                ? "Subir y revisar documento"
                : "Tomar foto o elegir archivo"}
          </Button>

          <div className="mt-2 flex items-center justify-between gap-3 text-xs leading-5 text-slate-500">
            <p className="min-w-0 flex-1 truncate">
              {selectedFile ? `Listo para enviar: ${selectedFile.name}` : "Primero elige tu documento desde el celular o tus archivos guardados."}
            </p>
            {selectedFile ? (
              <button className="font-semibold text-slate-700" onClick={clearSelectedFile} type="button">
                Limpiar
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </main>
  );
}

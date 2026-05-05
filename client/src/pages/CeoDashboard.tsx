import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout, { type DashboardNavigationItem } from "@/components/DashboardLayout";
import { HeliosCopilotSheet, type HeliosCopilotMessage } from "@/components/HeliosCopilotSheet";
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
  LEGAL_GATE_WEEKLY_ALERT_THRESHOLD,
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
  getGuardrailFollowUpMeta,
  getNextGuardrailFollowUpStatus,
  buildGuardrailFollowUpSummary,
  hasConsecutiveLegalGateWorseningWeeks,
  type AuditEventFamily,
  type AuditEventSeverity,
  type AuditExecutiveAlert,
  type AuditFeedItem,
  type GuardrailFollowUpStatus,
} from "@/pages/ceoDashboardMonitoring";
import {
  buildLegalGateContextPath,
  buildLegalGateContextSummary,
  parseLegalGateNavigationContext,
  type LegalGateNavigationContext,
} from "@/pages/ceoDashboardContext";
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
  Sparkles,
  ShieldX,
  Siren,
  UsersRound,
  X,
  ChevronDown,
  ChevronUp,
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

function formatWeekLabel(value: string | null | undefined) {
  if (!value) return "Sin semana";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin semana";

  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  }).format(date);
}

function formatDayLabel(value: string | null | undefined) {
  if (!value) return "Sin día";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin día";

  return new Intl.DateTimeFormat("es-MX", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  }).format(date);
}

function formatDurationCompact(seconds: number | null | undefined) {
  if (seconds === null || seconds === undefined || Number.isNaN(seconds)) return "Sin muestra";
  if (seconds < 60) return `${formatNumber(seconds)} s`;
  if (seconds < 3600) return `${(seconds / 60).toFixed(1)} min`;
  return `${(seconds / 3600).toFixed(1)} h`;
}

const GUARDRAIL_FOLLOW_UP_STORAGE_KEY = "ceo.guardrailFollowUp.v1";

function getCeoPathname(location: string) {
  return location.split("?")[0] ?? location;
}

function readStoredGuardrailFollowUp(): Record<string, GuardrailFollowUpStatus> {
  if (typeof window === "undefined") return {};

  try {
    const rawValue = window.localStorage.getItem(GUARDRAIL_FOLLOW_UP_STORAGE_KEY);
    if (!rawValue) return {};
    const parsed = JSON.parse(rawValue) as Record<string, unknown>;
    const next: Record<string, GuardrailFollowUpStatus> = {};

    for (const [key, value] of Object.entries(parsed ?? {})) {
      if (value === "pending" || value === "tracking" || value === "resolved") {
        next[key] = value;
      }
    }

    return next;
  } catch {
    return {};
  }
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
  return "Resumen ejecutivo";
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
  const [isLegalGateDrilldownOpen, setIsLegalGateDrilldownOpen] = useState(false);
  const [guardrailFollowUpByReason, setGuardrailFollowUpByReason] = useState<Record<string, GuardrailFollowUpStatus>>(() => readStoredGuardrailFollowUp());
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
  const [showExpandedAuditFeed, setShowExpandedAuditFeed] = useState(false);
  const [isHeliosSheetOpen, setIsHeliosSheetOpen] = useState(false);
  const [heliosMessages, setHeliosMessages] = useState<HeliosCopilotMessage[]>([]);
  const [pendingHeliosConfirmationPrompt, setPendingHeliosConfirmationPrompt] = useState<string | null>(null);

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

  const locationWithSearch = typeof window === "undefined" ? location : `${location}${window.location.search}`;
  const legalGateNavigationContext = useMemo(() => parseLegalGateNavigationContext(locationWithSearch), [locationWithSearch]);

  const currentSection = useMemo<SectionKey>(() => {
    const pathname = getCeoPathname(location);
    if (pathname.startsWith("/ceo/bridge")) return "bridge";
    if (pathname.startsWith("/ceo/alertas")) return "alertas";
    if (pathname.startsWith("/ceo/accesos")) return "accesos";
    if (pathname.startsWith("/ceo/documentos")) return "documentos";
    return "resumen";
  }, [location]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(GUARDRAIL_FOLLOW_UP_STORAGE_KEY, JSON.stringify(guardrailFollowUpByReason));
  }, [guardrailFollowUpByReason]);

  useEffect(() => {
    if (!legalGateNavigationContext) return;

    setFilters((previous) => {
      const nextTenantId = legalGateNavigationContext.tenantId;
      const nextCaseId = legalGateNavigationContext.caseId ?? "all";
      if (previous.tenantId === nextTenantId && previous.caseId === nextCaseId) {
        return previous;
      }
      return {
        ...previous,
        tenantId: nextTenantId,
        caseId: nextCaseId,
      };
    });

    if (legalGateNavigationContext.target === "feed") {
      setAuditFamilyFilter(legalGateNavigationContext.family);
      setAuditSeverityFilter(legalGateNavigationContext.severity);
    }
  }, [legalGateNavigationContext]);

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
    enabled: isAdmin && hasActiveFilters,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const auditTrailQuery = trpc.audit.list.useQuery(auditTrailFilters, {
    enabled: isAdmin,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const bridgeSmokeStatusQuery = trpc.dashboard.ceoBridgeSmokeStatus.useQuery(undefined, {
    enabled: isAdmin,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const snapshotData = hasActiveFilters ? filteredSnapshotQuery.data : baseSnapshotQuery.data;
  const isMasterUser = snapshotData?.viewerCapabilities?.isMasterUser ?? baseSnapshotQuery.data?.viewerCapabilities?.isMasterUser ?? false;
  const masterMetricsQuery = trpc.dashboard.ceoMasterMetrics.useQuery(undefined, {
    enabled: isAdmin && isMasterUser,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const recordConsoleViewMutation = trpc.dashboard.ceoRecordConsoleView.useMutation();
  const recordGuardrailMutation = trpc.dashboard.ceoRecordGuardrailEvent.useMutation();
  const recordExportAuditMutation = trpc.dashboard.ceoRecordExportAudit.useMutation();
  const emailBridgeExportMutation = trpc.dashboard.ceoEmailBridgeExport.useMutation();
  const bridgeSmokeThresholdMutation = trpc.dashboard.ceoUpdateBridgeSmokeThreshold.useMutation();
  const ceoHeliosMutation = trpc.dashboard.ceoHeliosChat.useMutation();
  const bridgePresetsQuery = trpc.dashboard.ceoListBridgePresets.useQuery(currentTenantScope ? { tenantId: currentTenantScope } : undefined, {
    enabled: isAdmin,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const bridgeSchedulesQuery = trpc.dashboard.ceoListBridgeSchedules.useQuery(currentTenantScope ? { tenantId: currentTenantScope } : undefined, {
    enabled: isAdmin,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const createBridgePresetMutation = trpc.dashboard.ceoCreateBridgePreset.useMutation();
  const deleteBridgePresetMutation = trpc.dashboard.ceoDeleteBridgePreset.useMutation();
  const createBridgeScheduleMutation = trpc.dashboard.ceoCreateBridgeSchedule.useMutation();
  const updateBridgeScheduleMutation = trpc.dashboard.ceoUpdateBridgeSchedule.useMutation();
  const deleteBridgeScheduleMutation = trpc.dashboard.ceoDeleteBridgeSchedule.useMutation();
  const bridgePresets = bridgePresetsQuery.data ?? [];
  const bridgeSchedules = bridgeSchedulesQuery.data ?? [];

  const snapshotError = hasActiveFilters ? filteredSnapshotQuery.error : baseSnapshotQuery.error;
  const isInitialLoading = !baseSnapshotQuery.data && baseSnapshotQuery.isLoading;
  const isFilterLoading = hasActiveFilters && !filteredSnapshotQuery.data && filteredSnapshotQuery.isLoading;
  const isRefreshing = baseSnapshotQuery.isFetching || filteredSnapshotQuery.isFetching;
  const snapshotGeneratedAtMs = useMemo(() => {
    if (!snapshotData?.generatedAt) return null;
    const value = new Date(snapshotData.generatedAt).getTime();
    return Number.isNaN(value) ? null : value;
  }, [snapshotData?.generatedAt]);
  const snapshotAgeMs = snapshotGeneratedAtMs === null ? null : Math.max(0, snapshotPulseAt - snapshotGeneratedAtMs);
  const snapshotGeneratedAtIso = useMemo(
    () => (snapshotGeneratedAtMs === null ? null : new Date(snapshotGeneratedAtMs).toISOString()),
    [snapshotGeneratedAtMs],
  );
  const snapshotFreshnessLabel =
    snapshotAgeMs === null ? "Frescura no disponible" : snapshotAgeMs < 60000 ? "Vista fresca" : `Actualizada hace ${Math.max(1, Math.round(snapshotAgeMs / 60000))} min`;
  const isSnapshotStale = snapshotAgeMs !== null && snapshotAgeMs > 2 * 60 * 1000;
  const executiveActionsBlocked = isRefreshing || isSnapshotStale || Boolean(snapshotError);
  const executiveGuardrailReason = isRefreshing ? "snapshot_refreshing" : snapshotError ? "snapshot_error" : isSnapshotStale ? "snapshot_stale" : "guardrail_active";
  const executiveGuardrailReasonLabel =
    executiveGuardrailReason === "snapshot_refreshing"
      ? "Refresco en curso"
      : executiveGuardrailReason === "snapshot_error"
        ? "Error de snapshot"
        : executiveGuardrailReason === "snapshot_stale"
          ? "Vista desactualizada"
          : "Carril operativo habilitado";
  const executiveGuardrailDescription = isRefreshing
    ? "La consola está refrescando la vista ejecutiva. Espera a que termine antes de operar cambios sensibles."
    : snapshotError
      ? "La vista ejecutiva tuvo un problema al cargar. Refresca antes de volver a intentar una acción sensible."
      : isSnapshotStale
        ? "Datos desactualizados. Actualiza el dashboard antes de continuar."
        : "La vista visible sigue dentro de la ventana de frescura operativa para ejecutar acciones seguras.";
  const exportGuardReason = getCeoExportBlockReason({
    hasSnapshot: Boolean(snapshotData),
    isRefreshing,
    isSnapshotStale,
    hasSnapshotError: Boolean(snapshotError),
  });
  const currentSectionExportGuardReason = exportGuardReason;
  const filterSelectClassName = "h-12 w-full rounded-[1.2rem] border border-slate-200 bg-white px-4 text-sm text-slate-950 shadow-sm outline-none transition focus:border-teal-400";
  const diagnosticPillClassName = "rounded-full border border-current/15 bg-white/70 px-3 py-1";
  const heliosScopeTenantId = filters.tenantId !== "all" ? filters.tenantId : undefined;
  const heliosScopeCaseId = filters.caseId !== "all" ? filters.caseId : undefined;
  const ceoHeliosSummary = `Modo CEO activo · ${snapshotData?.summary.activeCases ?? 0} expedientes activos · ${snapshotData?.summary.openAlerts ?? 0} alertas abiertas · ${snapshotData?.summary.pendingDocuments ?? 0} documentos pendientes.`;
  const ceoHeliosSuggestedPrompts = ceoHeliosMutation.data?.suggestedPrompts ?? [
    "Prioridades del día: dime qué urge mover hoy en alertas, accesos y documentos visibles.",
    "Riesgo patronal y pericial: separa qué está confirmado, qué infieres y qué falta verificar hoy.",
    "Prepara una instrucción operativa para el equipo sobre la vista visible; si requiere algo sensible, déjala sujeta a confirmación.",
    "Antes de volver a la app como usuario normal, dime qué debo vigilar y qué no está autorizado mover desde aquí.",
  ];
  const requiresHeliosCeoConfirmation = (prompt: string) => /instrucción operativa|ordena|autoriza|ejecuta|activa|desactiva|cambia|ajusta/i.test(prompt);
  const openHeliosForCeo = () => {
    setHeliosMessages((current) => {
      if (current.length > 0) return current;
      return [
        {
          role: "assistant",
          content:
            "Helios ya está en modo CEO. Conserva toda la lectura jurídica laboral del expediente y además puede ayudarte a traducir alertas, accesos, documentos y prioridades operativas del sistema visible. Si algo implica una acción sensible, primero te lo devolverá como propuesta sujeta a confirmación visible y, si falta permiso o trazabilidad, bajará a modo consulta.",
        },
      ];
    });
    setIsHeliosSheetOpen(true);
  };
  const dispatchHeliosCeoMessage = async (trimmed: string) => {
    const userMessage: HeliosCopilotMessage = {
      role: "user",
      content: trimmed,
    };
    setHeliosMessages((current) => [...current, userMessage]);

    try {
      const result = await ceoHeliosMutation.mutateAsync({
        prompt: trimmed,
        section: currentSection,
        tenantId: heliosScopeTenantId,
        caseId: heliosScopeCaseId,
      });
      setHeliosMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: result.answer,
        },
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "No pude abrir la capa ejecutiva de Helios en este momento.";
      setHeliosMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: message,
        },
      ]);
    }
  };
  const handleSendHeliosCeoMessage = async (content: string) => {
    const trimmed = content.trim();
    if (!trimmed || ceoHeliosMutation.isPending) return;
    if (requiresHeliosCeoConfirmation(trimmed)) {
      setPendingHeliosConfirmationPrompt(trimmed);
      return;
    }
    await dispatchHeliosCeoMessage(trimmed);
  };
  const handleConfirmHeliosCeoMessage = async () => {
    if (!pendingHeliosConfirmationPrompt || ceoHeliosMutation.isPending) return;
    const prompt = pendingHeliosConfirmationPrompt;
    setPendingHeliosConfirmationPrompt(null);
    await dispatchHeliosCeoMessage(prompt);
  };

  const alertMutation = trpc.dashboard.ceoUpdateAlertStatus.useMutation();
  const membershipMutation = trpc.dashboard.ceoUpdateMembershipStatus.useMutation();
  const caseMutation = trpc.dashboard.ceoProgressCaseStage.useMutation();

  const globalSummary = baseSnapshotQuery.data?.summary;
  const auditTrail = auditTrailQuery.data ?? [];
  const auditSummary = useMemo(() => buildAuditMonitoringSummary(auditTrail), [auditTrail]);
  const latestLegalGateTrendPoint = auditSummary.legalGateWeeklyTrend[auditSummary.legalGateWeeklyTrend.length - 1] ?? null;
  const hasConsecutiveLegalGateWorsening = useMemo(
    () => hasConsecutiveLegalGateWorseningWeeks(auditSummary.legalGateWeeklyTrend),
    [auditSummary.legalGateWeeklyTrend],
  );
  const guardrailFollowUpSummary = useMemo(
    () => buildGuardrailFollowUpSummary(auditSummary.guardrailReasonRanking.map((entry) => entry.reason), guardrailFollowUpByReason),
    [auditSummary.guardrailReasonRanking, guardrailFollowUpByReason],
  );
  const filteredAuditTrail = useMemo(
    () => filterAuditFeed(auditTrail, { family: auditFamilyFilter, severity: auditSeverityFilter }),
    [auditFamilyFilter, auditSeverityFilter, auditTrail],
  );
  const recentOperationalEvents = useMemo(() => filteredAuditTrail.slice(0, showExpandedAuditFeed ? 12 : 4), [filteredAuditTrail, showExpandedAuditFeed]);
  const hiddenOperationalEventsCount = Math.max(filteredAuditTrail.length - recentOperationalEvents.length, 0);
  const latestGuardrailEvent = useMemo(
    () => auditTrail.find((item) => item.action === "document.guardrail_rejected") ?? null,
    [auditTrail],
  );
  const auditExecutiveAlerts = useMemo(() => buildAuditExecutiveAlerts(auditTrail).slice(0, 4), [auditTrail]);
  const bridgeOverview = useMemo(
    () =>
      buildBridgeMonitoringPanel({
        auditTrail,
        tenantHealth: snapshotData?.tenantHealth ?? [],
        recentDocuments: snapshotData?.recentDocuments ?? [],
        recentAlerts: snapshotData?.recentAlerts ?? [],
      }),
    [auditTrail, snapshotData?.recentAlerts, snapshotData?.recentDocuments, snapshotData?.tenantHealth],
  );
  const bridgeSmokeStatus = bridgeSmokeStatusQuery.data ?? null;
  const bridgeSmokeAlerting = bridgeSmokeStatus?.alerting ?? null;
  const bridgeSmokeHistory = bridgeSmokeStatus?.history ?? [];
  const bridgeSmokeHistorySummary = useMemo(() => buildBridgeSmokeHistorySummary(bridgeSmokeHistory), [bridgeSmokeHistory]);
  const bridgeSmokeTrend = useMemo(() => bridgeSmokeHistory.slice(0, 10), [bridgeSmokeHistory]);
  const bridgeSmokeAlertTone = useMemo(
    () => getBridgeSmokeAlertSeverityTone(bridgeSmokeAlerting?.severity ?? "neutral"),
    [bridgeSmokeAlerting?.severity],
  );
  const bridgeSmokeAlertTimestamp = useMemo(
    () =>
      getBridgeSmokeAlertTimestampLabel({
        activatedAt: bridgeSmokeAlerting?.activatedAt ? formatDateTime(bridgeSmokeAlerting.activatedAt) : null,
        recoveredAt: bridgeSmokeAlerting?.recoveredAt ? formatDateTime(bridgeSmokeAlerting.recoveredAt) : null,
        testedAt: bridgeSmokeStatus?.testedAt ? formatDateTime(bridgeSmokeStatus.testedAt) : null,
      }),
    [bridgeSmokeAlerting?.activatedAt, bridgeSmokeAlerting?.recoveredAt, bridgeSmokeStatus?.testedAt],
  );
  const filteredBridgeSmokeHistory = useMemo(
    () =>
      filterBridgeSmokeHistory(bridgeSmokeHistory, {
        status: bridgeSmokeHistoryFilter,
        timeWindow: bridgeSmokeTimeWindow,
        severity: bridgeSmokeSeverityFilter,
      }).slice(0, 8),
    [bridgeSmokeHistory, bridgeSmokeHistoryFilter, bridgeSmokeSeverityFilter, bridgeSmokeTimeWindow],
  );
  const filteredBridgeSmokeHistorySummary = useMemo(
    () => buildBridgeSmokeHistorySummary(filteredBridgeSmokeHistory),
    [filteredBridgeSmokeHistory],
  );
  const bridgeSmokeComparisons = useMemo(() => buildBridgeSmokeComparisonSummary(bridgeSmokeHistory), [bridgeSmokeHistory]);
  const bridgeSmokeTrendChartConfig = useMemo<ChartConfig>(
    () => ({
      passedRuns: {
        label: "Conformes",
        color: "oklch(0.62 0.17 152)",
      },
      issueRuns: {
        label: "Con incidencia",
        color: "oklch(0.64 0.19 26)",
      },
    }),
    [],
  );
  const bridgeSmokeTrendChartData = useMemo(
    () => [
      {
        period: bridgeSmokeComparisons.daily.label,
        passedRuns: bridgeSmokeComparisons.daily.passedRuns,
        issueRuns: bridgeSmokeComparisons.daily.failedRuns + bridgeSmokeComparisons.daily.errorRuns,
      },
      {
        period: bridgeSmokeComparisons.weekly.label,
        passedRuns: bridgeSmokeComparisons.weekly.passedRuns,
        issueRuns: bridgeSmokeComparisons.weekly.failedRuns + bridgeSmokeComparisons.weekly.errorRuns,
      },
    ],
    [bridgeSmokeComparisons.daily, bridgeSmokeComparisons.weekly],
  );
  const bridgeSmokeExecutiveSummary = useMemo(() => {
    const technicalErrors = bridgeSmokeHistory.filter((entry) => getBridgeSmokeHistorySeverity(entry) === "critical").length;
    const contractualFailures = bridgeSmokeHistory.filter((entry) => getBridgeSmokeHistorySeverity(entry) === "warning").length;
    const conformingRuns = bridgeSmokeHistory.filter((entry) => getBridgeSmokeHistorySeverity(entry) === "success").length;
    const lastPassingRun = bridgeSmokeHistory.find((entry) => entry.status === "passed") ?? null;

    return {
      technicalErrors,
      contractualFailures,
      conformingRuns,
      lastPassingRun,
    };
  }, [bridgeSmokeHistory]);
  const bridgeOperationalSummary = useMemo(() => {
    const delivered = bridgeOverview.rows.filter((item) => Boolean(item.returnedAt)).length;
    const rejected = bridgeOverview.rows.filter(
      (item) =>
        item.latestReturnEvent === "rejected" || item.latestReturnStatus === "rejected" || item.outcomeCategory === "permanent_failure",
    ).length;
    const retries = bridgeOverview.rows.filter((item) => item.retryScheduled || item.outcomeCategory === "retry_scheduled").length;
    const awaitingAck = bridgeOverview.rows.filter(
      (item) => !item.returnedAt && (item.dispatchStatus === "sent" || item.dispatchStatus === "accepted" || item.outcomeCategory === "pending_return"),
    ).length;
    const smokeAgeMinutes = bridgeSmokeStatus?.ageMinutes ?? null;
    const smokeIsStale = smokeAgeMinutes !== null && smokeAgeMinutes > 60;
    const smokeStatusLabel =
      bridgeSmokeStatus?.availability === "ready"
        ? bridgeSmokeStatus.contractCheck.passed
          ? smokeIsStale
            ? "OK con atraso"
            : "OK"
          : "Fallo"
        : bridgeSmokeStatus?.availability === "error"
          ? "Lectura pendiente"
          : "Sin registro";

    return {
      delivered,
      rejected,
      retries,
      awaitingAck,
      smokeAgeMinutes,
      smokeIsStale,
      smokeStatusLabel,
    };
  }, [bridgeOverview.rows, bridgeSmokeStatus]);
  const bridgeExportPayload = useMemo<CeoCustomExportPayload>(
    () => ({
      title: "Reporte privado · Bridge operativo",
      summaryRows: [
        ["Expedientes trazados", formatNumber(bridgeOverview.summary.trackedDocuments)],
        ["Conformes", formatNumber(bridgeOverview.summary.healthy)],
        ["Pendientes de retorno", formatNumber(bridgeOverview.summary.pending)],
        ["Advertencias activas", formatNumber(bridgeOverview.summary.warning)],
        ["Críticos", formatNumber(bridgeOverview.summary.critical)],
        ["Entregas con retorno", formatNumber(bridgeOperationalSummary.delivered)],
        ["Rechazos visibles", formatNumber(bridgeOperationalSummary.rejected)],
        ["Reintentos activos", formatNumber(bridgeOperationalSummary.retries)],
        ["Pendientes de ack", formatNumber(bridgeOperationalSummary.awaitingAck)],
        ["Smoke recurrente", bridgeOperationalSummary.smokeStatusLabel],
        ["Última corrida smoke", bridgeSmokeStatus?.testedAt ? formatDateTime(bridgeSmokeStatus.testedAt) : "Sin registro"],
        ["Estado de alerta", getBridgeSmokeAlertVisualStateLabel(bridgeSmokeAlerting?.visualState ?? "stable")],
        ["Filtro smoke · estado", getBridgeSmokeHistoryFilterLabel(bridgeSmokeHistoryFilter)],
        ["Filtro smoke · ventana", getBridgeSmokeHistoryTimeWindowLabel(bridgeSmokeTimeWindow)],
        ["Filtro smoke · severidad", getBridgeSmokeHistorySeverityLabel(bridgeSmokeSeverityFilter)],
      ],
      tables: [
        {
          title: "Expedientes bridge visibles",
          columns: ["Documento", "Tenant", "Caso", "Salud", "Resultado", "Retorno", "Intentos", "Última actividad", "Trace ID"],
          rows: bridgeOverview.rows.map((item) => [
            item.documentName,
            item.tenantName,
            item.caseTitle || item.caseId || "—",
            item.health,
            item.outcomeCategory,
            item.latestReturnStatus || item.latestReturnEvent || item.dispatchStatus,
            formatNumber(item.attempts),
            formatDateTime(item.lastActivityAt),
            item.traceId || "—",
          ]),
        },
        {
          title: "Incidencias priorizadas",
          columns: ["Documento", "Tenant", "Caso", "Severidad", "Detalle", "Alertas abiertas", "Última actividad"],
          rows: bridgeOverview.issues.map((item) => [
            item.documentName,
            item.tenantName,
            item.caseTitle || item.caseId || "—",
            item.health,
            item.errorMessage || item.guardrailReason || item.warnings.join(" | ") || item.latestReturnStatus || item.dispatchStatus,
            formatNumber(item.openAlertCount),
            formatDateTime(item.lastActivityAt),
          ]),
        },
        {
          title: "Historial smoke reciente",
          columns: ["Corrida", "Estado", "Severidad", "Health", "Webhook", "Firma", "Base URL", "Contexto"],
          rows: filteredBridgeSmokeHistory.map((entry) => [
            entry.testedAt ? formatDateTime(entry.testedAt) : "Sin fecha",
            getBridgeSmokeHistoryStatusLabel(entry.status),
            getBridgeSmokeHistorySeverityLabel(getBridgeSmokeHistorySeverity(entry)),
            entry.healthStatus !== null ? String(entry.healthStatus) : "—",
            entry.webhookStatus !== null ? String(entry.webhookStatus) : "—",
            entry.verified === null ? "—" : entry.verified ? "Verificada" : "No verificada",
            entry.baseUrl || bridgeSmokeStatus?.baseUrl || "—",
            getBridgeSmokeHistoryContext(entry),
          ]),
        },
        {
          title: "Resumen smoke filtrado",
          columns: ["Métrica", "Valor"],
          rows: [
            ["Corridas visibles", formatNumber(filteredBridgeSmokeHistorySummary.totalRuns)],
            ["Corridas conformes", formatNumber(filteredBridgeSmokeHistorySummary.passedRuns)],
            ["Corridas con fallo contractual", formatNumber(filteredBridgeSmokeHistorySummary.failedRuns)],
            ["Errores técnicos", formatNumber(filteredBridgeSmokeHistorySummary.errorRuns)],
            ["Éxito visible", `${formatNumber(filteredBridgeSmokeHistorySummary.successRate)}%`],
            ["Racha visible de fallos", formatNumber(filteredBridgeSmokeHistorySummary.consecutiveFailures)],
            ["Fallo técnico acumulado", formatNumber(bridgeSmokeExecutiveSummary.technicalErrors)],
            ["Fallo contractual acumulado", formatNumber(bridgeSmokeExecutiveSummary.contractualFailures)],
            ["Última corrida conforme", bridgeSmokeExecutiveSummary.lastPassingRun?.testedAt ? formatDateTime(bridgeSmokeExecutiveSummary.lastPassingRun.testedAt) : "Sin corrida conforme"],
          ],
        },
      ],
    }),
    [
      bridgeOperationalSummary.awaitingAck,
      bridgeOperationalSummary.delivered,
      bridgeOperationalSummary.rejected,
      bridgeOperationalSummary.retries,
      bridgeOperationalSummary.smokeStatusLabel,
      bridgeOverview.issues,
      bridgeOverview.rows,
      bridgeOverview.summary.critical,
      bridgeOverview.summary.healthy,
      bridgeOverview.summary.pending,
      bridgeOverview.summary.trackedDocuments,
      bridgeOverview.summary.warning,
      bridgeSmokeAlerting?.visualState,
      bridgeSmokeExecutiveSummary.contractualFailures,
      bridgeSmokeExecutiveSummary.lastPassingRun,
      bridgeSmokeExecutiveSummary.technicalErrors,
      bridgeSmokeStatus?.baseUrl,
      bridgeSmokeStatus?.testedAt,
      filteredBridgeSmokeHistory,
      filteredBridgeSmokeHistorySummary.consecutiveFailures,
      filteredBridgeSmokeHistorySummary.errorRuns,
      filteredBridgeSmokeHistorySummary.failedRuns,
      filteredBridgeSmokeHistorySummary.passedRuns,
      filteredBridgeSmokeHistorySummary.successRate,
      filteredBridgeSmokeHistorySummary.totalRuns,
    ],
  );

  const contextualOverviewPath = legalGateNavigationContext
    ? buildLegalGateContextPath(
        "/ceo",
        legalGateNavigationContext,
        { family: legalGateNavigationContext.family, severity: legalGateNavigationContext.severity },
      )
    : "/ceo";
  const contextualDocumentsPath = legalGateNavigationContext
    ? buildLegalGateContextPath(
        "/ceo/documentos",
        legalGateNavigationContext,
        { family: legalGateNavigationContext.family, severity: legalGateNavigationContext.severity },
      )
    : "/ceo/documentos";
  const legalGateContextSummary = useMemo(
    () => (legalGateNavigationContext ? buildLegalGateContextSummary(legalGateNavigationContext) : null),
    [legalGateNavigationContext],
  );
  const navigation = useMemo<DashboardNavigationItem[]>(

    () => [
      {
        icon: LayoutDashboard,
        label: "Resumen ejecutivo",
        path: contextualOverviewPath,
        badge: globalSummary ? formatNumber(globalSummary.activeCases) : undefined,
      },
      {
        icon: GitBranch,
        label: "Bridge",
        path: "/ceo/bridge",
        badge:
          bridgeOverview.summary.critical + bridgeOverview.summary.warning + bridgeOverview.summary.pending > 0
            ? formatNumber(bridgeOverview.summary.critical + bridgeOverview.summary.warning + bridgeOverview.summary.pending)
            : undefined,
      },
      {
        icon: Siren,
        label: "Alertas",
        path: "/ceo/alertas",
        badge: globalSummary ? formatNumber(globalSummary.openAlerts) : undefined,
      },
      {
        icon: UsersRound,
        label: "Accesos",
        path: "/ceo/accesos",
        badge: globalSummary ? formatNumber(globalSummary.activeMemberships) : undefined,
      },
      {
        icon: Files,
        label: "Documentos",
        path: contextualDocumentsPath,
        badge: globalSummary ? formatNumber(globalSummary.pendingDocuments) : undefined,
      },
    ],
    [bridgeOverview.summary.critical, bridgeOverview.summary.pending, bridgeOverview.summary.warning, contextualDocumentsPath, contextualOverviewPath, globalSummary],
  );

  const tenantOptions = useMemo(() => {
    const items = new Map<string, string>();
    for (const tenant of baseSnapshotQuery.data?.tenantHealth ?? []) items.set(tenant.tenantId, tenant.tenantName);
    for (const item of baseSnapshotQuery.data?.recentCases ?? []) items.set(item.tenantId, item.tenantName);
    for (const item of baseSnapshotQuery.data?.recentAlerts ?? []) items.set(item.tenantId, item.tenantName);
    for (const item of baseSnapshotQuery.data?.recentMemberships ?? []) items.set(item.tenantId, item.tenantName);
    for (const item of baseSnapshotQuery.data?.recentDocuments ?? []) items.set(item.tenantId, item.tenantName);
    return Array.from(items.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "es-MX"));
  }, [baseSnapshotQuery.data]);

  const severityOptions = useMemo(() => {
    const values = new Set<string>();
    for (const item of baseSnapshotQuery.data?.alertsBySeverity ?? []) values.add(item.severity);
    for (const item of baseSnapshotQuery.data?.recentAlerts ?? []) values.add(item.severity);
    return Array.from(values)
      .map((value) => ({ value, label: value }))
      .sort((a, b) => a.label.localeCompare(b.label, "es-MX"));
  }, [baseSnapshotQuery.data]);

  const caseOptions = useMemo(() => {
    const items = new Map<string, string>();
    for (const item of baseSnapshotQuery.data?.recentCases ?? []) items.set(item.caseId, `${item.title} · ${item.caseId}`);
    for (const item of baseSnapshotQuery.data?.recentAlerts ?? []) {
      if (item.caseId) items.set(item.caseId, `${item.caseTitle || item.caseId} · ${item.caseId}`);
    }
    for (const item of baseSnapshotQuery.data?.recentMemberships ?? []) {
      if (item.caseId) items.set(item.caseId, `${item.caseTitle || item.caseId} · ${item.caseId}`);
    }
    for (const item of baseSnapshotQuery.data?.recentDocuments ?? []) items.set(item.caseId, `${item.caseTitle || item.caseId} · ${item.caseId}`);
    return Array.from(items.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "es-MX"));
  }, [baseSnapshotQuery.data]);

  const userOptions = useMemo(() => {
    const items = new Map<string, string>();
    for (const item of baseSnapshotQuery.data?.recentMemberships ?? []) {
      items.set(String(item.userId), item.userName || item.userEmail || `Usuario ${item.userId}`);
    }
    return Array.from(items.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "es-MX"));
  }, [baseSnapshotQuery.data]);

  const filteredCounts = useMemo(
    () => ({
      tenants: snapshotData?.tenantHealth.length ?? 0,
      cases: snapshotData?.recentCases.length ?? 0,
      alerts: snapshotData?.recentAlerts.length ?? 0,
      memberships: snapshotData?.recentMemberships.length ?? 0,
      documents: snapshotData?.recentDocuments.length ?? 0,
    }),
    [snapshotData],
  );

  const currentSectionCount = useMemo(
    () => (currentSection === "bridge" ? bridgeOverview.rows.length : getCurrentSectionCount(currentSection, snapshotData)),
    [bridgeOverview.rows.length, currentSection, snapshotData],
  );
  const exportableSection = currentSection;
  const lastTrackedSectionViewRef = useRef<string | null>(null);
  const lastTrackedMasterMetricsRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isAdmin) return;

    const nextViewKey = `${currentSection}:${snapshotGeneratedAtIso ?? "pending"}:${hasActiveFilters ? "filtered" : "global"}`;
    if (lastTrackedSectionViewRef.current === nextViewKey) {
      return;
    }

    lastTrackedSectionViewRef.current = nextViewKey;
    trackCeoConsoleViewed(currentSection, {
      source: "ceo_dashboard",
      hasActiveFilters,
      visibleCount: currentSectionCount,
    });
    void recordConsoleViewMutation
      .mutateAsync({
        tenantId: filters.tenantId !== "all" ? filters.tenantId : undefined,
        section: currentSection,
        snapshotGeneratedAt: snapshotGeneratedAtIso ?? undefined,
        hasActiveFilters,
        visibleCount: currentSectionCount,
      })
      .catch((error) => {
        console.warn("No se pudo registrar la vista persistente del dashboard CEO", error);
      });
  }, [currentSection, currentSectionCount, filters.tenantId, hasActiveFilters, isAdmin, recordConsoleViewMutation, snapshotGeneratedAtIso]);

  useEffect(() => {
    if (!isMasterUser || !masterMetricsQuery.data) return;

    const nextMetricsKey = `${masterMetricsQuery.data.generatedAt}`;
    if (lastTrackedMasterMetricsRef.current === nextMetricsKey) {
      return;
    }

    lastTrackedMasterMetricsRef.current = nextMetricsKey;
    trackCeoMasterMetricsViewed({
      source: "ceo_dashboard",
      totalConsoleViews: masterMetricsQuery.data.summary.totalConsoleViews,
      totalGuardrailBlocks: masterMetricsQuery.data.summary.totalGuardrailBlocks,
      totalExports: masterMetricsQuery.data.summary.totalExports,
    });
  }, [isMasterUser, masterMetricsQuery.data]);

  const safeCaseActions = useMemo(
    () =>
      (snapshotData?.recentCases ?? [])
        .map((item) => ({
          ...item,
          nextStatus: getSafeNextCaseStatus(item.status),
          actionLabel: getSafeCaseActionLabel(item.status),
        }))
        .filter(
          (item): item is typeof item & { nextStatus: "analysis" | "conciliation" | "litigation"; actionLabel: string } =>
            Boolean(item.nextStatus && item.actionLabel),
        )
        .slice(0, 3),
    [snapshotData?.recentCases],
  );

  const safeAlertActions = useMemo(
    () =>
      (snapshotData?.recentAlerts ?? [])
        .map((alert) => ({
          ...alert,
          nextStatus: getSafeNextAlertStatus(alert.status),
          actionLabel: getSafeAlertActionLabel(alert.status),
        }))
        .filter(
          (alert): alert is typeof alert & { nextStatus: "acknowledged" | "resolved"; actionLabel: string } =>
            Boolean(alert.nextStatus && alert.actionLabel),
        )
        .slice(0, 3),
    [snapshotData?.recentAlerts],
  );

  const safeMembershipActions = useMemo(
    () =>
      (snapshotData?.recentMemberships ?? [])
        .map((membership) => ({
          ...membership,
          action: getSafeMembershipAction(membership),
        }))
        .filter(
          (membership): membership is typeof membership & { action: { status: "active" | "revoked"; label: string } } =>
            Boolean(membership.action),
        )
        .slice(0, 3),
    [snapshotData?.recentMemberships],
  );

  const activeFilterChips = useMemo(() => {
    const chips: Array<{ key: keyof FilterState | "query"; label: string }> = [];

    if (debouncedQuery.length > 0) chips.push({ key: "query", label: `Búsqueda: ${debouncedQuery}` });
    if (filters.tenantId !== "all") {
      const tenantLabel = tenantOptions.find((item) => item.value === filters.tenantId)?.label ?? filters.tenantId;
      chips.push({ key: "tenantId", label: `Tenant: ${tenantLabel}` });
    }
    if (filters.severity !== "all") chips.push({ key: "severity", label: `Severidad: ${filters.severity}` });
    if (filters.caseId !== "all") {
      const caseLabel = caseOptions.find((item) => item.value === filters.caseId)?.label ?? filters.caseId;
      chips.push({ key: "caseId", label: `Caso: ${caseLabel}` });
    }
    if (filters.userId !== "all") {
      const userLabel = userOptions.find((item) => item.value === filters.userId)?.label ?? filters.userId;
      chips.push({ key: "userId", label: `Usuario: ${userLabel}` });
    }
    if (filters.dateWindowDays !== "all") {
      const dateLabel = DATE_WINDOW_OPTIONS.find((item) => item.value === filters.dateWindowDays)?.label ?? `${filters.dateWindowDays} días`;
      chips.push({ key: "dateWindowDays", label: `Fecha: ${dateLabel}` });
    }

    return chips;
  }, [caseOptions, debouncedQuery, filters, tenantOptions, userOptions]);

  const removeFilterChip = (key: keyof FilterState | "query") => {
    if (key === "query") {
      setQueryDraft("");
      setDebouncedQuery("");
      return;
    }

    setFilters((previous) => ({
      ...previous,
      [key]: "all",
    }));
  };

  const clearAllFilters = () => {
    setFilters(DEFAULT_FILTER_STATE);
    setQueryDraft("");
    setDebouncedQuery("");
  };

  const clearAuditFeedFilters = () => {
    setAuditFamilyFilter("all");
    setAuditSeverityFilter("all");
  };

  const clearBridgeSmokeFilters = () => {
    setBridgeSmokeHistoryFilter("all");
    setBridgeSmokeTimeWindow("all");
    setBridgeSmokeSeverityFilter("all");
  };

  const focusAuditItem = (item: AuditFeedItem) => {
    const descriptor = getAuditDrilldownDescriptor(item);
    setFilters((previous) => ({
      ...previous,
      tenantId: item.tenantId,
      caseId: item.caseId ?? "all",
    }));
    setLocation(descriptor.path);
  };

  const focusExecutiveAlert = (alert: AuditExecutiveAlert) => {
    setFilters((previous) => ({
      ...previous,
      tenantId: alert.tenantId,
      caseId: alert.caseId ?? "all",
    }));
    setAuditFamilyFilter("guardrail");
    setAuditSeverityFilter(alert.severity === "normal" ? "all" : alert.severity);
    setLocation("/ceo");
  };

  const focusLegalGateCase = (item: (typeof auditSummary.legalGateAffectedCases)[number], targetPath: "/ceo" | "/ceo/documentos") => {
    setFilters((previous) => ({
      ...previous,
      tenantId: item.tenantId,
      caseId: item.caseId ?? "all",
    }));
    void setLocation(
      buildLegalGateContextPath(targetPath, item, {
        family: auditFamilyFilter,
        severity: auditSeverityFilter,
      }),
    );
  };

  const toggleGuardrailFollowUp = (reason: string) => {
    setGuardrailFollowUpByReason((current) => {
      const previousStatus = current[reason] ?? "pending";
      return {
        ...current,
        [reason]: getNextGuardrailFollowUpStatus(previousStatus),
      };
    });
  };

  const isAlertBusy = (alertId: number) => alertMutation.isPending && alertMutation.variables?.alertId === alertId;
  const isMembershipBusy = (membershipId: number) =>
    membershipMutation.isPending && membershipMutation.variables?.membershipId === membershipId;
  const isCaseBusy = (tenantId: string, caseId: string) =>
    caseMutation.isPending && caseMutation.variables?.tenantId === tenantId && caseMutation.variables?.caseId === caseId;
  const isConfirmingExecutiveAction = alertMutation.isPending || membershipMutation.isPending || caseMutation.isPending;

  function notifyExecutiveGuardrail(actionKind: "alert" | "membership" | "case" | "export" | "refresh" | "master_metrics") {
    trackCeoGuardrail("blocked", {
      source: "ceo_dashboard",
      section: currentSection,
      actionKind,
      reason: executiveGuardrailReason,
      reasonLabel: executiveGuardrailReasonLabel,
      hasActiveFilters,
      hasLegalGateContext: Boolean(legalGateNavigationContext),
      retryScheduledVisible: bridgeOverview.summary.retryScheduled,
      pendingReturnVisible: bridgeOverview.summary.pending,
      visibleCount: currentSectionCount,
    });

    void recordGuardrailMutation
      .mutateAsync({
        tenantId: filters.tenantId !== "all" ? filters.tenantId : undefined,
        section: currentSection,
        actionKind,
        reason: executiveGuardrailReason,
        description: executiveGuardrailDescription,
        snapshotGeneratedAt: snapshotGeneratedAtIso ?? undefined,
        hasActiveFilters,
        visibleCount: currentSectionCount,
      })
      .catch((error) => {
        console.warn("No se pudo registrar el bloqueo persistente del guardrail CEO", error);
      });

    sonnerToast.error("Actualiza la vista antes de operar", {
      description: executiveGuardrailDescription,
    });
  }

  async function refreshSnapshotWithSuccess(title: string, description: string) {
    await utils.dashboard.ceoSnapshot.invalidate();
    sonnerToast.success(title, { description });
  }

  useEffect(() => {
    const nextThreshold = bridgeSmokeAlerting?.threshold;
    if (typeof nextThreshold === "number" && Number.isFinite(nextThreshold)) {
      setBridgeSmokeThresholdDraft(String(nextThreshold));
    }
  }, [bridgeSmokeAlerting?.threshold]);

  useEffect(() => {
    if (bridgeSchedulePresetIdDraft) return;
    if (bridgePresets.length === 0) return;
    setBridgeSchedulePresetIdDraft(String(bridgePresets[0].id));
  }, [bridgePresets, bridgeSchedulePresetIdDraft]);

  async function handleRefresh() {
    trackCeoRefresh(currentSection, {
      source: "ceo_dashboard",
      hasActiveFilters,
      visibleCount: currentSectionCount,
    });
    await utils.dashboard.ceoSnapshot.invalidate();
    await utils.dashboard.ceoBridgeSmokeStatus.invalidate();
  }

  async function handleBridgeSmokeThresholdSubmit() {
    if (executiveActionsBlocked) {
      notifyExecutiveGuardrail("case");
      return;
    }

    const normalizedThreshold = Number(bridgeSmokeThresholdDraft.trim());
    if (!Number.isInteger(normalizedThreshold) || normalizedThreshold < 1 || normalizedThreshold > 20) {
      sonnerToast.error("Umbral inválido", {
        description: "Usa un número entero entre 1 y 20 para el smoke test del bridge.",
      });
      return;
    }

    try {
      const nextSnapshot = await bridgeSmokeThresholdMutation.mutateAsync({
        threshold: normalizedThreshold,
        snapshotGeneratedAt: snapshotGeneratedAtIso ?? undefined,
        tenantId: filters.tenantId !== "all" ? filters.tenantId : undefined,
      });
      await utils.dashboard.ceoBridgeSmokeStatus.invalidate();
      setBridgeSmokeThresholdDraft(String(nextSnapshot.alerting.threshold));
      sonnerToast.success("Umbral operativo actualizado", {
        description: `El bridge ahora alertará al alcanzar ${formatNumber(nextSnapshot.alerting.threshold)} fallos consecutivos.`,
      });
    } catch (error) {
      sonnerToast.error("No fue posible actualizar el umbral", {
        description: error instanceof Error ? error.message : "Intenta nuevamente tras refrescar la consola CEO.",
      });
    }
  }

  function requestAlertAction(alertId: number, title: string, status: string) {
    if (executiveActionsBlocked) {
      notifyExecutiveGuardrail("alert");
      return;
    }

    const nextStatus = getSafeNextAlertStatus(status);
    const actionLabel = getSafeAlertActionLabel(status);
    if (!nextStatus || !actionLabel) return;
    if (status !== "open" && status !== "acknowledged" && status !== "resolved") return;

    setPendingExecutiveAction({
      kind: "alert",
      alertId,
      title,
      currentStatus: status,
      nextStatus,
      actionLabel,
    });
  }

  function requestMembershipAction(
    membershipId: number,
    membership: { status: string; accessScope: string; caseId?: string | null },
    userLabel: string,
  ) {
    if (executiveActionsBlocked) {
      notifyExecutiveGuardrail("membership");
      return;
    }

    const action = getSafeMembershipAction(membership);
    if (!action) return;
    if (membership.status !== "active" && membership.status !== "revoked") return;

    setPendingExecutiveAction({
      kind: "membership",
      membershipId,
      userLabel,
      currentStatus: membership.status,
      nextStatus: action.status,
      actionLabel: action.label,
    });
  }

  function requestCaseAction(tenantId: string, caseId: string, title: string, status: string) {
    if (executiveActionsBlocked) {
      notifyExecutiveGuardrail("case");
      return;
    }

    const nextStatus = getSafeNextCaseStatus(status);
    const actionLabel = getSafeCaseActionLabel(status);
    if (!nextStatus || !actionLabel) return;
    if (status !== "intake" && status !== "analysis" && status !== "conciliation" && status !== "litigation" && status !== "archived") return;

    setPendingExecutiveAction({
      kind: "case",
      tenantId,
      caseId,
      title,
      currentStatus: status,
      nextStatus,
      actionLabel,
    });
  }

  async function executePendingExecutiveAction(action: PendingExecutiveAction) {
    if (executiveActionsBlocked || !snapshotGeneratedAtIso) {
      notifyExecutiveGuardrail(action.kind);
      setPendingExecutiveAction(null);
      return;
    }

    try {
      if (action.kind === "alert") {
        await alertMutation.mutateAsync({
          alertId: action.alertId,
          status: action.nextStatus,
          expectedCurrentStatus: action.currentStatus,
          snapshotGeneratedAt: snapshotGeneratedAtIso!,
        });
        await refreshSnapshotWithSuccess("Alerta actualizada", `${action.title}: ${action.actionLabel.toLowerCase()} y traza registrada.`);
        return;
      }

      if (action.kind === "membership") {
        await membershipMutation.mutateAsync({
          membershipId: action.membershipId,
          status: action.nextStatus,
          expectedCurrentStatus: action.currentStatus,
          snapshotGeneratedAt: snapshotGeneratedAtIso!,
        });
        await refreshSnapshotWithSuccess("Acceso actualizado", `${action.userLabel}: ${action.actionLabel.toLowerCase()} con trazabilidad ejecutiva.`);
        return;
      }

      await caseMutation.mutateAsync({
        tenantId: action.tenantId,
        caseId: action.caseId,
        status: action.nextStatus,
        expectedCurrentStatus: action.currentStatus,
        snapshotGeneratedAt: snapshotGeneratedAtIso,
      });
      await refreshSnapshotWithSuccess("Caso actualizado", `${action.title}: ${action.actionLabel.toLowerCase()} y bitácora registrada.`);
    } catch (error) {
      const title = action.kind === "case" ? "No fue posible confirmar el avance del caso" : action.kind === "membership" ? "No fue posible actualizar el acceso" : "No fue posible actualizar la alerta";
      sonnerToast.error(title, {
        description: getSafeActionErrorMessage(error),
      });
    } finally {
      setPendingExecutiveAction(null);
    }
  }

  function handleApplyBridgePreset(preset: {
    name: string;
    description: string | null;
    filters: BridgePresetFiltersDraft;
    exportFormat: "csv" | "pdf";
    emailRecipients: string[];
    emailMessage: string | null;
    smokeThreshold: number;
  }) {
    setFilters({
      tenantId: preset.filters.tenantId ?? "all",
      severity: preset.filters.severity ?? "all",
      caseId: preset.filters.caseId ?? "all",
      userId: preset.filters.userId ? String(preset.filters.userId) : "all",
      dateWindowDays: preset.filters.dateWindowDays ? String(preset.filters.dateWindowDays) : "all",
    });
    setQueryDraft(preset.filters.query ?? "");
    setDebouncedQuery(preset.filters.query ?? "");
    setBridgeSmokeThresholdDraft(String(preset.smokeThreshold));
    setBridgePresetNameDraft(preset.name);
    setBridgePresetDescriptionDraft(preset.description ?? "");
    setBridgePresetExportFormatDraft(preset.exportFormat);
    setBridgePresetEmailRecipientsDraft(preset.emailRecipients.join(", "));
    setBridgePresetEmailMessageDraft(preset.emailMessage ?? "");
    void setLocation("/ceo/bridge");
    sonnerToast.success("Preset aplicado", {
      description: `Se cargó ${preset.name} con sus filtros y parámetros de reporte bridge.`,
    });
  }

  async function handleSaveBridgePreset() {
    const name = bridgePresetNameDraft.trim();
    if (name.length < 3) {
      sonnerToast.error("Nombre insuficiente", {
        description: "Asigna al menos 3 caracteres para guardar el preset del bridge.",
      });
      return;
    }

    const rawRecipients = bridgePresetEmailRecipientsDraft
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    const recipients = parseEmailRecipients(bridgePresetEmailRecipientsDraft);
    const invalidRecipients = rawRecipients.filter((value) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));
    if (invalidRecipients.length > 0) {
      sonnerToast.error("Correos inválidos", {
        description: `Revisa: ${invalidRecipients.join(", ")}`,
      });
      return;
    }

    const smokeThreshold = Number(bridgeSmokeThresholdDraft.trim());
    if (!Number.isInteger(smokeThreshold) || smokeThreshold < 1 || smokeThreshold > 99) {
      sonnerToast.error("Umbral inválido", {
        description: "El preset bridge requiere un umbral entero entre 1 y 99.",
      });
      return;
    }

    try {
      const preset = await createBridgePresetMutation.mutateAsync({
        tenantId: currentTenantScope,
        name,
        description: bridgePresetDescriptionDraft.trim() || undefined,
        filters: bridgePresetFilters,
        exportFormat: bridgePresetExportFormatDraft,
        emailRecipients: recipients,
        emailMessage: bridgePresetEmailMessageDraft.trim() || undefined,
        smokeThreshold,
      });
      await utils.dashboard.ceoListBridgePresets.invalidate();
      setBridgeSchedulePresetIdDraft(String(preset.id));
      sonnerToast.success("Preset bridge guardado", {
        description: `${preset.name} ya quedó disponible para reutilizar filtros, exportación y correo.`,
      });
    } catch (error) {
      sonnerToast.error("No fue posible guardar el preset", {
        description: error instanceof Error ? error.message : "Intenta nuevamente en unos segundos.",
      });
    }
  }

  async function handleCreateBridgeSchedule() {
    const presetId = Number(bridgeSchedulePresetIdDraft);
    if (!Number.isInteger(presetId) || presetId < 1) {
      sonnerToast.error("Selecciona un preset", {
        description: "Primero elige uno de los presets guardados para programar la agenda automática.",
      });
      return;
    }

    try {
      await createBridgeScheduleMutation.mutateAsync({
        presetId,
        tenantId: currentTenantScope,
        cronExpression: bridgeScheduleCronDraft.trim(),
        timezone: bridgeScheduleTimezoneDraft.trim(),
        isActive: bridgeScheduleActiveDraft,
      });
      await utils.dashboard.ceoListBridgeSchedules.invalidate();
      sonnerToast.success("Agenda automática creada", {
        description: "La automatización del bridge quedó registrada y empezará a correr según la siguiente ventana válida.",
      });
    } catch (error) {
      sonnerToast.error("No fue posible crear la agenda", {
        description: error instanceof Error ? error.message : "Verifica el cron y la zona horaria antes de intentar nuevamente.",
      });
    }
  }

  async function handleToggleBridgeSchedule(schedule: {
    id: number;
    presetId: number;
    tenantId: string | null;
    cronExpression: string;
    timezone: string;
    isActive: boolean;
  }) {
    try {
      await updateBridgeScheduleMutation.mutateAsync({
        id: schedule.id,
        presetId: schedule.presetId,
        tenantId: schedule.tenantId ?? undefined,
        cronExpression: schedule.cronExpression,
        timezone: schedule.timezone,
        isActive: !schedule.isActive,
      });
      await utils.dashboard.ceoListBridgeSchedules.invalidate();
      sonnerToast.success(schedule.isActive ? "Agenda pausada" : "Agenda reactivada");
    } catch (error) {
      sonnerToast.error("No fue posible actualizar la agenda", {
        description: error instanceof Error ? error.message : "Intenta nuevamente en unos segundos.",
      });
    }
  }

  async function handleDeleteBridgePreset(preset: { id: number; tenantId: string | null; name: string }) {
    if (!window.confirm(`¿Eliminar el preset bridge “${preset.name}”? También se eliminarán sus agendas asociadas.`)) {
      return;
    }

    try {
      await deleteBridgePresetMutation.mutateAsync({ id: preset.id, tenantId: preset.tenantId ?? undefined });
      await utils.dashboard.ceoListBridgePresets.invalidate();
      await utils.dashboard.ceoListBridgeSchedules.invalidate();
      sonnerToast.success("Preset bridge eliminado");
    } catch (error) {
      sonnerToast.error("No fue posible eliminar el preset", {
        description: error instanceof Error ? error.message : "Intenta nuevamente en unos segundos.",
      });
    }
  }

  async function handleDeleteBridgeSchedule(schedule: { id: number; tenantId: string | null }) {
    if (!window.confirm("¿Eliminar esta agenda automática del bridge?")) {
      return;
    }

    try {
      await deleteBridgeScheduleMutation.mutateAsync({ id: schedule.id, tenantId: schedule.tenantId ?? undefined });
      await utils.dashboard.ceoListBridgeSchedules.invalidate();
      sonnerToast.success("Agenda automática eliminada");
    } catch (error) {
      sonnerToast.error("No fue posible eliminar la agenda", {
        description: error instanceof Error ? error.message : "Intenta nuevamente en unos segundos.",
      });
    }
  }

  async function handleEmailBridgeExport() {
    if (exportableSection !== "bridge") {
      sonnerToast.info("El envío por correo sólo está disponible en el bridge operativo.");
      return;
    }
    if (currentSectionExportGuardReason || !snapshotData || !snapshotGeneratedAtIso) {
      sonnerToast.error("El envío por correo está bloqueado", {
        description:
          currentSectionExportGuardReason ?? "Espera a que el snapshot ejecutivo termine de cargar antes de compartir el reporte.",
      });
      return;
    }

    const recipientInput = window.prompt(
      "Ingresa uno o varios correos separados por coma para enviar el export bridge.",
      user?.email ?? "",
    );
    if (recipientInput === null) {
      return;
    }

    const recipients = recipientInput
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean)
      .filter((value, index, collection) => collection.indexOf(value) === index);

    const invalidRecipients = recipients.filter((value) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));
    if (recipients.length === 0 || invalidRecipients.length > 0) {
      sonnerToast.error("Captura al menos un correo válido para compartir el reporte.");
      return;
    }

    const messageDraft = window.prompt("Mensaje opcional para acompañar el correo.", "") ?? "";
    const actorLabel = user?.name || user?.email || "Operación ejecutiva";
    const appliedFilters = [
      ...activeFilterChips.map((chip) => chip.label),
      ...(exportableSection === "bridge"
        ? [
            `Smoke estado: ${getBridgeSmokeHistoryFilterLabel(bridgeSmokeHistoryFilter)}`,
            `Smoke ventana: ${getBridgeSmokeHistoryTimeWindowLabel(bridgeSmokeTimeWindow)}`,
            `Smoke severidad: ${getBridgeSmokeHistorySeverityLabel(bridgeSmokeSeverityFilter)}`,
          ]
        : []),
    ];

    try {
      setEmailExportPending(true);
      const pdf = buildCeoPdfReport({
        section: exportableSection,
        snapshot: snapshotData,
        appliedFilters,
        actorLabel,
        customExport: bridgeExportPayload,
      });
      const csv = buildCeoCsvReport({
        section: exportableSection,
        snapshot: snapshotData,
        appliedFilters,
        actorLabel,
        customExport: bridgeExportPayload,
      });

      await emailBridgeExportMutation.mutateAsync({
        tenantId: filters.tenantId !== "all" ? filters.tenantId : undefined,
        snapshotGeneratedAt: snapshotGeneratedAtIso,
        appliedFilters,
        visibleCount: currentSectionCount,
        recipients,
        message: messageDraft.trim() || undefined,
        attachments: [
          {
            filename: pdf.filename,
            content: await blobToBase64(pdf.blob),
            contentType: "application/pdf",
          },
          {
            filename: csv.filename,
            content: await blobToBase64(new Blob([csv.content], { type: "text/csv;charset=utf-8" })),
            contentType: "text/csv",
          },
        ],
      });

      sonnerToast.success("Reporte bridge enviado por correo", {
        description: `Destinatarios: ${recipients.join(", ")}`,
      });
    } catch (error) {
      sonnerToast.error("No fue posible enviar el reporte por correo", {
        description: error instanceof Error ? error.message : "Intenta nuevamente en unos segundos.",
      });
    } finally {
      setEmailExportPending(false);
    }
  }

  async function handleExport(kind: "csv" | "pdf") {
    if (currentSectionExportGuardReason || !snapshotData) {
      trackCeoExport(kind, "blocked", {
        section: exportableSection,
        source: "ceo_dashboard",
        hasActiveFilters,
        visibleCount: currentSectionCount,
        reason: currentSectionExportGuardReason ?? "snapshot_not_ready",
      });
      sonnerToast.error("La exportación ejecutiva está bloqueada", {
        description:
          currentSectionExportGuardReason ?? "Espera a que el snapshot ejecutivo termine de cargar para generar el reporte.",
      });
      return;
    }

    const actorLabel = user?.name || user?.email || "Operación ejecutiva";
    const appliedFilters = [
      ...activeFilterChips.map((chip) => chip.label),
      ...(exportableSection === "bridge"
        ? [
            `Smoke estado: ${getBridgeSmokeHistoryFilterLabel(bridgeSmokeHistoryFilter)}`,
            `Smoke ventana: ${getBridgeSmokeHistoryTimeWindowLabel(bridgeSmokeTimeWindow)}`,
            `Smoke severidad: ${getBridgeSmokeHistorySeverityLabel(bridgeSmokeSeverityFilter)}`,
          ]
        : []),
    ];

    trackCeoExport(kind, "requested", {
      section: exportableSection,
      source: "ceo_dashboard",
      hasActiveFilters,
      visibleCount: currentSectionCount,
    });

    try {
      setExportKind(kind);
      const filename =
        kind === "pdf"
          ? downloadCeoPdfReport({
              section: exportableSection,
              snapshot: snapshotData,
              appliedFilters,
              actorLabel,
              customExport: exportableSection === "bridge" ? bridgeExportPayload : undefined,
            })
          : downloadCeoCsvReport({
              section: exportableSection,
              snapshot: snapshotData,
              appliedFilters,
              actorLabel,
              customExport: exportableSection === "bridge" ? bridgeExportPayload : undefined,
            });

      try {
        await recordExportAuditMutation.mutateAsync({
          tenantId: filters.tenantId !== "all" ? filters.tenantId : undefined,
          section: exportableSection,
          format: kind,
          snapshotGeneratedAt: snapshotGeneratedAtIso ?? new Date().toISOString(),
          appliedFilters,
          visibleCount: currentSectionCount,
        });
      } catch (auditError) {
        console.warn("No se pudo registrar la auditoría del export ejecutivo", auditError);
        sonnerToast.warning("El reporte se descargó, pero la trazabilidad del export no quedó registrada.");
      }

      trackCeoExport(kind, "completed", {
        section: exportableSection,
        source: "ceo_dashboard",
        hasActiveFilters,
        visibleCount: currentSectionCount,
      });
      sonnerToast.success(kind === "pdf" ? "Reporte PDF generado" : "Reporte CSV generado", {
        description: `Archivo descargado: ${filename}`,
      });
    } catch (error) {
      trackCeoExport(kind, "failed", {
        section: exportableSection,
        source: "ceo_dashboard",
        hasActiveFilters,
        visibleCount: currentSectionCount,
        reason: error instanceof Error ? error.message : "unexpected_error",
      });
      sonnerToast.error(kind === "pdf" ? "No fue posible generar el PDF" : "No fue posible generar el CSV", {
        description: error instanceof Error ? error.message : "Intenta nuevamente en unos segundos.",
      });
    } finally {
      setExportKind(null);
    }
  }

  if (loading || isViewingAsUser) {
    return null;
  }


  return (
    <DashboardLayout
      title="Mi Expediente de Defensa"
      subtitle="Panel privado del owner autorizado para AuditaPatron"
      navigation={navigation}
      headerActions={
        <>
          <Button className="rounded-full bg-slate-950 text-white hover:bg-slate-800" onClick={openHeliosForCeo}>
            <Sparkles className="mr-2 h-4 w-4" />
            Abrir Helios CEO
          </Button>
          <Button
            variant="outline"
            className="rounded-full bg-white"
            title={currentSectionExportGuardReason ?? undefined}
            disabled={Boolean(currentSectionExportGuardReason) || exportKind !== null}
            onClick={() => {
              void handleExport("csv");
            }}
          >
            {exportKind === "csv" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Files className="mr-2 h-4 w-4" />}
            Exportar CSV
          </Button>
          <Button
            variant="outline"
            className="rounded-full bg-white"
            title={currentSectionExportGuardReason ?? undefined}
            disabled={Boolean(currentSectionExportGuardReason) || exportKind !== null}
            onClick={() => {
              void handleExport("pdf");
            }}
          >
            {exportKind === "pdf" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
            Reporte PDF
          </Button>
          <Button
            variant="outline"
            className="rounded-full bg-white"
            title={
              exportableSection !== "bridge"
                ? "Disponible únicamente para el bridge operativo"
                : currentSectionExportGuardReason ?? undefined
            }
            disabled={
              exportableSection !== "bridge" || Boolean(currentSectionExportGuardReason) || exportKind !== null || emailExportPending
            }
            onClick={() => {
              void handleEmailBridgeExport();
            }}
          >
            {emailExportPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Enviar por correo
          </Button>
          <Button variant="outline" className="rounded-full" onClick={() => void handleRefresh()}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
          <Button variant="ghost" className="rounded-full" onClick={() => setLocation("/")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Sitio público
          </Button>
        </>
      }
    >
      {!isAdmin || (!baseSnapshotQuery.isLoading && !baseSnapshotQuery.isError && !isMasterUser) ? (
        <section className="rounded-[2rem] border border-amber-200 bg-amber-50/90 p-8 shadow-[0_24px_70px_-34px_rgba(146,64,14,0.18)]">
          <div className="flex flex-wrap items-start gap-4">
            <div className="rounded-2xl bg-white p-3 text-amber-700 shadow-sm">
              <ShieldX className="h-6 w-6" />
            </div>
            <div className="max-w-3xl space-y-3">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-700">Acceso limitado</p>
              <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
                Solo la cuenta autorizada puede ver este expediente.
              </h2>
              <p className="text-base leading-7 text-slate-700">
                Tu sesión está activa, pero no tiene permiso para entrar aquí. Si este acceso debe revisarse, confirma primero la cuenta autorizada y luego valida los permisos internos.
              </p>
            </div>
          </div>
        </section>
      ) : isInitialLoading || isFilterLoading ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="h-32 animate-pulse rounded-3xl border border-white/60 bg-white/75" />
          ))}
        </section>
      ) : snapshotError || !snapshotData || !globalSummary ? (
        <section className="rounded-[2rem] border border-rose-200 bg-rose-50/90 p-8 shadow-[0_24px_70px_-34px_rgba(159,18,57,0.2)]">
          <div className="flex flex-wrap items-start gap-4">
            <div className="rounded-2xl bg-white p-3 text-rose-700 shadow-sm">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div className="max-w-3xl space-y-3">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-rose-700">Lectura no disponible</p>
              <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
                No fue posible cargar el snapshot ejecutivo del CEO.
              </h2>
              <p className="text-base leading-7 text-slate-700">
                {snapshotError?.message ?? "Se produjo un error inesperado al consultar el backend ejecutivo."}
              </p>
            </div>
          </div>
        </section>
      ) : (
        <div className="space-y-6">
          <section className="rounded-[2rem] border border-white/70 bg-[linear-gradient(135deg,rgba(15,23,42,0.98),rgba(15,118,110,0.92))] p-6 text-white shadow-[0_34px_90px_-42px_rgba(15,23,42,0.56)] xl:p-7">
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.8fr)] xl:items-start">
              <div className="space-y-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-teal-100/85">Modo CEO</p>
                    <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl xl:text-[2.55rem]">
                      Prioridades del día y acciones seguras en una sola vista.
                    </h2>
                    <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-100/90 xl:text-[15px]">
                      Empieza por alertas críticas, documentos pendientes y accesos vigentes. El detalle técnico queda más abajo para cuando realmente haga falta.
                    </p>
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    <article className="rounded-[1.35rem] border border-white/15 bg-white/10 p-3 backdrop-blur sm:p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.1em] text-teal-100/80">Qué ver primero</p>
                      <p className="mt-1.5 text-sm leading-6 text-slate-100/85">
                        Alertas críticas, cuellos de botella documentales y accesos que siguen activos.
                      </p>
                    </article>
                    <article className="rounded-[1.35rem] border border-white/15 bg-white/10 p-3 backdrop-blur sm:p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.1em] text-teal-100/80">Qué queda oculto</p>
                      <p className="mt-1.5 text-sm leading-6 text-slate-100/85">
                        Métricas maestras, trazabilidad profunda y controles técnicos solo cuando los abras.
                      </p>
                    </article>
                    <article className="rounded-[1.35rem] border border-white/15 bg-white/10 p-3 backdrop-blur sm:p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.1em] text-teal-100/80">Qué puedes hacer</p>
                      <p className="mt-1.5 text-sm leading-6 text-slate-100/85">
                        Decidir rápido, exportar cuando convenga y volver a la vista de usuario sin perder contexto.
                      </p>
                    </article>
                  </div>
                  <div className="rounded-[1.2rem] border border-amber-200/25 bg-slate-950/20 px-4 py-3 text-sm leading-6 text-slate-100/88">
                    <strong className="text-white">Carril seguro del chat CEO:</strong> si pides una acción sensible, primero se devuelve como propuesta sujeta a confirmación visible.
                  </div>

              </div>

              <div className="rounded-[1.5rem] border border-white/15 bg-white/10 p-4 backdrop-blur">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-100/80">Lectura actual</p>
                <p className="mt-2 text-lg font-semibold">{formatDateTime(snapshotData.generatedAt)}</p>
                <p className="mt-2 text-sm leading-6 text-slate-100/80">
                  Usuario actual: <strong>{user?.name || user?.email || "Administrador"}</strong>
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-100/80">
                  Vista activa: <strong>{getSectionLabel(currentSection)}</strong>
                  {hasActiveFilters ? ` · ${formatNumber(currentSectionCount)} coincidencias visibles` : " · sin filtros activos"}
                </p>
                <div className="mt-4 rounded-[1.15rem] border border-white/10 bg-slate-950/20 px-4 py-3 text-sm leading-6 text-slate-100/85">
                  Diseñada para escritorio; en móvil se mantiene como consulta rápida.
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-[1.8rem] border border-white/70 bg-white/92 p-5 shadow-[0_24px_70px_-34px_rgba(15,23,42,0.18)]">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-3xl space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Exploración ejecutiva</p>
                <h3 className="text-xl font-semibold tracking-tight text-slate-950">Filtros rápidos</h3>
                <p className="text-sm leading-6 text-slate-600">
                  Busca tenant, caso, alerta, acceso o documento. Los listados responden a tus filtros sin mover el panorama general.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="rounded-full border border-slate-200 bg-slate-100 text-slate-700">
                  {hasActiveFilters ? `${formatNumber(currentSectionCount)} resultados visibles` : "Vista global"}
                </Badge>
                <Button
                  variant="outline"
                  className="rounded-full bg-white"
                  onClick={() => setShowAdvancedFilters((previous) => !previous)}
                >
                  <Filter className="mr-2 h-4 w-4" />
                  {showAdvancedFilters ? "Ocultar filtros avanzados" : "Más filtros"}
                </Button>
              </div>
            </div>

            <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))]">
              <label className="block space-y-2 xl:col-span-1">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Búsqueda única</span>
                <div className="flex items-center gap-2 rounded-[1.2rem] border border-slate-200 bg-white px-4 py-3 shadow-sm">
                  <Search className="h-4 w-4 text-slate-400" />
                  <input
                    value={queryDraft}
                    onChange={(event) => setQueryDraft(event.target.value)}
                    placeholder="Buscar tenant, caso, alerta, acceso o documento"
                    className="w-full border-0 bg-transparent text-sm text-slate-950 outline-none placeholder:text-slate-400"
                  />
                  {queryDraft.length > 0 ? (
                    <button
                      type="button"
                      className="rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                      onClick={() => {
                        setQueryDraft("");
                        setDebouncedQuery("");
                      }}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
              </label>

              <label className="block space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Tenant</span>
                <select
                  value={filters.tenantId}
                  onChange={(event) => setFilters((previous) => ({ ...previous, tenantId: event.target.value }))}
                  className={filterSelectClassName}
                >
                  <option value="all">Todos los tenants</option>
                  {tenantOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Severidad</span>
                <select
                  value={filters.severity}
                  onChange={(event) => setFilters((previous) => ({ ...previous, severity: event.target.value }))}
                  className={filterSelectClassName}
                >
                  <option value="all">Todas las severidades</option>
                  {severityOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Ventana temporal</span>
                <select
                  value={filters.dateWindowDays}
                  onChange={(event) => setFilters((previous) => ({ ...previous, dateWindowDays: event.target.value }))}
                  className={filterSelectClassName}
                >
                  <option value="all">Todo el histórico visible</option>
                  {DATE_WINDOW_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {showAdvancedFilters ? (
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="block space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Caso</span>
                  <select
                    value={filters.caseId}
                    onChange={(event) => setFilters((previous) => ({ ...previous, caseId: event.target.value }))}
                    className={filterSelectClassName}
                  >
                    <option value="all">Todos los casos</option>
                    {caseOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Usuario</span>
                  <select
                    value={filters.userId}
                    onChange={(event) => setFilters((previous) => ({ ...previous, userId: event.target.value }))}
                    className={filterSelectClassName}
                  >
                    <option value="all">Todos los usuarios</option>
                    {userOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ) : null}

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-[1.2rem] border border-slate-200 bg-slate-50/80 px-4 py-3">
              <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
                <span className="font-medium text-slate-950">Cobertura del filtro actual:</span>
                <Badge className="rounded-full border border-white bg-white text-slate-700">Tenants {formatNumber(filteredCounts.tenants)}</Badge>
                <Badge className="rounded-full border border-white bg-white text-slate-700">Casos {formatNumber(filteredCounts.cases)}</Badge>
                <Badge className="rounded-full border border-white bg-white text-slate-700">Alertas {formatNumber(filteredCounts.alerts)}</Badge>
                <Badge className="rounded-full border border-white bg-white text-slate-700">Accesos {formatNumber(filteredCounts.memberships)}</Badge>
                <Badge className="rounded-full border border-white bg-white text-slate-700">Docs {formatNumber(filteredCounts.documents)}</Badge>
              </div>
              {hasActiveFilters ? (
                <Button variant="ghost" className="rounded-full text-slate-700" onClick={clearAllFilters}>
                  <X className="mr-2 h-4 w-4" />
                  Limpiar filtros
                </Button>
              ) : null}
            </div>

            {activeFilterChips.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {activeFilterChips.map((chip) => (
                  <button
                    key={`${chip.key}-${chip.label}`}
                    type="button"
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-950"
                    onClick={() => removeFilterChip(chip.key)}
                  >
                    <span>{chip.label}</span>
                    <X className="h-3.5 w-3.5" />
                  </button>
                ))}
              </div>
            ) : null}
          </section>

          <section className="grid gap-4 xl:grid-cols-[1.3fr_0.9fr]">
            <article className="rounded-[1.85rem] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(20,184,166,0.12),_transparent_32%),linear-gradient(180deg,_#ffffff_0%,_#f8fafc_100%)] p-5 shadow-[0_24px_70px_-36px_rgba(15,23,42,0.18)] sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="max-w-3xl">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Resumen ejecutivo</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-[2rem]">
                    {formatNumber(globalSummary.openAlerts)} alertas abiertas y {formatNumber(globalSummary.activeCases)} casos activos bajo seguimiento.
                  </h2>
                  <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">
                    Empieza por tres cosas: alertas críticas, documentos pendientes y accesos vigentes. El detalle fino queda abajo sólo para cuando realmente lo necesites.
                  </p>
                </div>
                <div className={`rounded-[1.2rem] border px-4 py-3 text-sm shadow-sm ${executiveActionsBlocked ? "border-amber-200 bg-amber-50 text-amber-950" : "border-emerald-200 bg-emerald-50 text-emerald-950"}`}>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em]">Estado de decisión</p>
                  <p className="mt-2 font-semibold">{executiveActionsBlocked ? "Revisión recomendada antes de actuar" : "Vista habilitada para decisiones de bajo riesgo"}</p>
                  <p className="mt-1 leading-6">{snapshotFreshnessLabel}</p>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-[1.25rem] border border-white bg-white/90 p-4 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Tenants activos</p>
                  <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{formatNumber(globalSummary.totalTenants)}</p>
                  <p className="mt-1 text-sm text-slate-600">Organizaciones con operación visible.</p>
                </div>
                <div className="rounded-[1.25rem] border border-white bg-white/90 p-4 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Accesos vigentes</p>
                  <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{formatNumber(globalSummary.activeMemberships)}</p>
                  <p className="mt-1 text-sm text-slate-600">{formatNumber(globalSummary.caseScopedMemberships)} por caso.</p>
                </div>
                <div className="rounded-[1.25rem] border border-white bg-white/90 p-4 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Documentos pendientes</p>
                  <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{formatNumber(globalSummary.pendingDocuments)}</p>
                  <p className="mt-1 text-sm text-slate-600">{formatNumber(globalSummary.supersededDocuments)} reemplazados.</p>
                </div>
              </div>
            </article>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
              <article className="rounded-[1.55rem] border border-rose-100 bg-rose-50/80 p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-600">Riesgo inmediato</p>
                <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{formatNumber(globalSummary.criticalAlerts)}</p>
                <p className="mt-2 text-sm leading-6 text-slate-700">Alertas críticas dentro de las {formatNumber(globalSummary.openAlerts)} alertas abiertas del panorama global.</p>
              </article>
              <article className="rounded-[1.55rem] border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Cobertura visible</p>
                <dl className="mt-3 space-y-3 text-sm text-slate-600">
                  <div className="flex items-center justify-between gap-3">
                    <dt>Casos en el filtro actual</dt>
                    <dd className="font-semibold text-slate-950">{formatNumber(filteredCounts.cases)}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt>Alertas en el filtro actual</dt>
                    <dd className="font-semibold text-slate-950">{formatNumber(filteredCounts.alerts)}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt>Documentos visibles</dt>
                    <dd className="font-semibold text-slate-950">{formatNumber(filteredCounts.documents)}</dd>
                  </div>
                </dl>
              </article>
            </div>
          </section>

          {isMasterUser ? (
            <section className="rounded-[1.8rem] border border-violet-200/70 bg-[linear-gradient(135deg,rgba(245,243,255,0.98),rgba(238,242,255,0.94))] p-5 shadow-[0_26px_80px_-44px_rgba(76,29,149,0.3)]">
              <details>
                <summary className="flex cursor-pointer list-none flex-wrap items-start justify-between gap-4">
                  <div className="max-w-3xl space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-600">Panel maestro</p>
                    <h3 className="text-xl font-semibold tracking-tight text-slate-950">Métricas exclusivas del usuario dueño</h3>
                    <p className="text-sm leading-6 text-slate-700">
                      Este bloque queda colapsado por defecto para no competir con la lectura ejecutiva inicial.
                    </p>
                  </div>
                  <div className="rounded-[1.2rem] border border-white/70 bg-white/80 px-4 py-3 text-sm text-slate-700 shadow-sm">
                    {masterMetricsQuery.isLoading ? "Cargando métricas maestras…" : `Abrir detalle · corte ${formatDateTime(masterMetricsQuery.data?.generatedAt ?? null)}`}
                  </div>
                </summary>

                {masterMetricsQuery.error ? (
                  <div className="mt-4 rounded-[1.2rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                    {masterMetricsQuery.error.message}
                  </div>
                ) : (
                  <>
                    <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                      <KpiCard label="Vistas CEO" value={masterMetricsQuery.data?.summary.totalConsoleViews ?? 0} helper={`Últimos 7 días: ${formatNumber(masterMetricsQuery.data?.last7Days.consoleViews ?? 0)}`} />
                      <KpiCard label="Guardrails bloqueados" value={masterMetricsQuery.data?.summary.totalGuardrailBlocks ?? 0} helper={`Últimos 7 días: ${formatNumber(masterMetricsQuery.data?.last7Days.guardrailBlocks ?? 0)}`} />
                      <KpiCard label="Exportes trazados" value={masterMetricsQuery.data?.summary.totalExports ?? 0} helper={`Últimos 7 días: ${formatNumber(masterMetricsQuery.data?.last7Days.exports ?? 0)}`} />
                      <KpiCard label="Actores únicos" value={masterMetricsQuery.data?.summary.uniqueActors ?? 0} helper="Usuarios administradores con interacción registrada" />
                    </div>
                    <div className="mt-4 rounded-[1.2rem] border border-white/70 bg-white/80 p-4 text-sm text-slate-700 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Última actividad maestra</p>
                      <p className="mt-2 leading-6 text-slate-700">
                        Vista CEO: <strong className="text-slate-950">{formatDateTime(masterMetricsQuery.data?.latestActivity.consoleViewedAt ?? null)}</strong>
                        <span className="mx-2 text-slate-300">•</span>
                        Bloqueo: <strong className="text-slate-950">{formatDateTime(masterMetricsQuery.data?.latestActivity.guardrailBlockedAt ?? null)}</strong>
                        <span className="mx-2 text-slate-300">•</span>
                        Exporte: <strong className="text-slate-950">{formatDateTime(masterMetricsQuery.data?.latestActivity.exportGeneratedAt ?? null)}</strong>
                      </p>
                    </div>
                  </>
                )}
              </details>
            </section>
          ) : null}


          <section
            className={`rounded-[1.45rem] border px-4 py-4 text-sm leading-6 shadow-sm ${executiveActionsBlocked ? "border-amber-200 bg-amber-50/90 text-amber-950" : "border-emerald-200 bg-emerald-50/90 text-emerald-950"}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="max-w-3xl space-y-1">
                <p className="text-xs font-semibold uppercase tracking-[0.18em]">Cómo leer esta consola hoy</p>
                <p>
                  <strong>{snapshotFreshnessLabel}.</strong> Empieza por la fila superior, luego revisa prioridades del día y baja al detalle sólo si necesitas aislar un tenant, caso o actor.
                </p>
                <p className="text-xs opacity-80">{executiveGuardrailDescription}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="rounded-full bg-white"
                disabled={isRefreshing}
                onClick={() => {
                  void handleRefresh();
                }}
              >
                {isRefreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Actualizar vista
              </Button>
            </div>
            <div data-testid="ceo-guardrail-diagnostics" className="mt-3 flex flex-wrap items-center gap-2 text-xs font-medium">
              <span className={diagnosticPillClassName}>Estado ejecutivo: {executiveGuardrailReasonLabel}</span>
              <span data-testid="ceo-retry-visible-pill" className={diagnosticPillClassName}>
                Fricción: {formatNumber(bridgeOverview.summary.retryScheduled)} reintentos · {formatNumber(bridgeOverview.summary.pending)} pendientes
              </span>
              {legalGateContextSummary ? (
                <span data-testid="ceo-context-summary-pill" className={diagnosticPillClassName}>
                  Contexto: {legalGateContextSummary}
                </span>
              ) : null}
              {legalGateNavigationContext && currentSection !== "resumen" ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  data-testid="ceo-contextual-return-button"
                  className="ml-auto rounded-full bg-white text-slate-700"
                  onClick={() => {
                    void setLocation(contextualOverviewPath);
                  }}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Volver al panel principal
                </Button>
              ) : null}
            </div>
          </section>

          {currentSection === "resumen" ? (
            <>
              <section className="rounded-[1.8rem] border border-white/70 bg-white/92 p-5 shadow-[0_24px_70px_-34px_rgba(15,23,42,0.18)]">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Bloque seguro</p>
                    <h3 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">Acciones administrativas acotadas</h3>
                  </div>
                  <Badge className="rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700">
                    Sólo cambios con trazabilidad y bajo riesgo
                  </Badge>
                </div>
                <p className="mt-4 text-sm leading-6 text-slate-600">
                  Este bloque sólo expone cambios de bajo riesgo. Cada acción ahora exige una confirmación visual sobre una vista fresca, y el backend rechazará
                  cualquier operación si detecta desalineación de estado o secuencia fuera del carril seguro.
                </p>
                {executiveActionsBlocked ? (
                  <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                    <strong>Acciones sensibles bloqueadas temporalmente.</strong> {executiveGuardrailDescription}
                  </div>
                ) : null}
                <div className="mt-5 grid gap-4 xl:grid-cols-3">
                  <article className="rounded-[1.4rem] border border-slate-200 bg-slate-50/70 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-base font-semibold text-slate-950">Alertas en secuencia</h4>
                      <Badge className="rounded-full border border-slate-200 bg-white text-slate-700">{formatNumber(safeAlertActions.length)}</Badge>
                    </div>
                    <div className="mt-4 space-y-3">
                      {safeAlertActions.length > 0 ? (
                        safeAlertActions.map((alert) => (
                          <div key={alert.id} className="rounded-2xl bg-white p-3 shadow-sm">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge className={`rounded-full border ${getSeverityBadgeClass(alert.severity)}`}>{alert.severity}</Badge>
                              <Badge className={`rounded-full border ${getStatusBadgeClass(alert.status)}`}>{alert.status}</Badge>
                            </div>
                            <p className="mt-2 line-clamp-2 text-sm font-semibold text-slate-950">{alert.title}</p>
                            <p className="mt-1 text-xs text-slate-500">{alert.tenantName}</p>
                            <Button
                              className="mt-3 w-full rounded-full"
                              size="sm"
                              disabled={executiveActionsBlocked || isAlertBusy(alert.id)}
                              onClick={() => {
                                requestAlertAction(alert.id, alert.title, alert.status);
                              }}
                            >
                              {isAlertBusy(alert.id) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                              {alert.actionLabel}
                            </Button>
                          </div>
                        ))
                      ) : (
                        <p className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-600">No hay alertas con transición segura pendiente.</p>
                      )}
                    </div>
                  </article>

                  <article className="rounded-[1.4rem] border border-slate-200 bg-slate-50/70 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-base font-semibold text-slate-950">Accesos por caso</h4>
                      <Badge className="rounded-full border border-slate-200 bg-white text-slate-700">{formatNumber(safeMembershipActions.length)}</Badge>
                    </div>
                    <div className="mt-4 space-y-3">
                      {safeMembershipActions.length > 0 ? (
                        safeMembershipActions.map((membership) => (
                          <div key={membership.id} className="rounded-2xl bg-white p-3 shadow-sm">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge className={`rounded-full border ${getStatusBadgeClass(membership.status)}`}>{membership.status}</Badge>
                              <Badge className="rounded-full border border-slate-200 bg-white text-slate-700">{membership.role}</Badge>
                            </div>
                            <p className="mt-2 text-sm font-semibold text-slate-950">
                              {membership.userName || membership.userEmail || `Usuario ${membership.userId}`}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">{membership.caseTitle || membership.caseId}</p>
                            <Button
                              variant="outline"
                              className="mt-3 w-full rounded-full bg-white"
                              size="sm"
                              disabled={executiveActionsBlocked || isMembershipBusy(membership.id)}
                              onClick={() => {
                                requestMembershipAction(
                                  membership.id,
                                  membership,
                                  membership.userName || membership.userEmail || `Usuario ${membership.userId}`,
                                );
                              }}
                            >
                              {isMembershipBusy(membership.id) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                              {membership.action.label}
                            </Button>
                          </div>
                        ))
                      ) : (
                        <p className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-600">No hay accesos por caso aptos para este bloque seguro.</p>
                      )}
                    </div>
                  </article>

                  <article className="rounded-[1.4rem] border border-slate-200 bg-slate-50/70 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-base font-semibold text-slate-950">Avance operativo</h4>
                      <Badge className="rounded-full border border-slate-200 bg-white text-slate-700">{formatNumber(safeCaseActions.length)}</Badge>
                    </div>
                    <div className="mt-4 space-y-3">
                      {safeCaseActions.length > 0 ? (
                        safeCaseActions.map((item) => (
                          <div key={item.caseId} className="rounded-2xl bg-white p-3 shadow-sm">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge className={`rounded-full border ${getStatusBadgeClass(item.status)}`}>{item.status}</Badge>
                              <Badge className="rounded-full border border-slate-200 bg-white text-slate-700">{item.tenantName}</Badge>
                            </div>
                            <p className="mt-2 line-clamp-2 text-sm font-semibold text-slate-950">{item.title}</p>
                            <p className="mt-1 text-xs text-slate-500">Última actividad: {formatDateTime(item.lastActivityAt ?? item.updatedAt)}</p>
                            <Button
                              variant="outline"
                              className="mt-3 w-full rounded-full bg-white"
                              size="sm"
                              disabled={executiveActionsBlocked || isCaseBusy(item.tenantId, item.caseId)}
                              onClick={() => {
                                requestCaseAction(item.tenantId, item.caseId, item.title, item.status);
                              }}
                            >
                              {isCaseBusy(item.tenantId, item.caseId) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                              {item.actionLabel}
                            </Button>
                          </div>
                        ))
                      ) : (
                        <p className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-600">No hay casos con siguiente avance operativo seguro disponible.</p>
                      )}
                    </div>
                  </article>
                </div>
              </section>

              <section className="rounded-[1.8rem] border border-white/70 bg-white/92 p-5 shadow-[0_24px_70px_-34px_rgba(15,23,42,0.18)]">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Bitácora operativa</p>
                    <h3 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">Bitácora reciente para decidir</h3>
                  </div>
                  <Badge className="rounded-full border border-slate-200 bg-slate-100 text-slate-700">
                    {auditTrailQuery.isFetching
                      ? "Actualizando eventos"
                      : recentOperationalEvents.length > 4
                        ? "4 prioritarios visibles"
                        : `${formatNumber(recentOperationalEvents.length)} visibles ahora`}
                  </Badge>
                </div>
                <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-600">
                  Quédate solo con la actividad más reciente y los rechazos que sí cambian una decisión ejecutiva.
                </p>
                <div className="mt-5 grid gap-4 lg:grid-cols-4">
                  <article className="rounded-[1.4rem] border border-slate-200 bg-slate-50/70 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Eventos visibles</p>
                    <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{formatNumber(auditSummary.totalEvents)}</p>
                    <p className="mt-2 text-sm text-slate-500">Últimos movimientos auditados bajo el filtro actual.</p>
                  </article>
                  <article className="rounded-[1.4rem] border border-amber-200 bg-amber-50/70 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700">Guardrails rechazados</p>
                    <p className="mt-2 text-2xl font-semibold tracking-tight text-amber-950">{formatNumber(auditSummary.guardrailRejections)}</p>
                    <p className="mt-2 text-sm text-amber-900/80">
                      {latestGuardrailEvent ? `Último: ${formatDateTime(latestGuardrailEvent.createdAt)}` : "Sin rechazos operativos recientes en la vista actual."}
                    </p>
                  </article>
                  <article className="rounded-[1.4rem] border border-cyan-200 bg-cyan-50/70 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-700">Eventos documentales</p>
                    <p className="mt-2 text-2xl font-semibold tracking-tight text-cyan-950">{formatNumber(auditSummary.documentEvents)}</p>
                    <p className="mt-2 text-sm text-cyan-900/80">Incluye carga, confirmación y rechazos operativos del flujo documental.</p>
                  </article>
                  <article className="rounded-[1.4rem] border border-violet-200 bg-violet-50/70 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-violet-700">Casos con huella</p>
                    <p className="mt-2 text-2xl font-semibold tracking-tight text-violet-950">{formatNumber(auditSummary.distinctCases)}</p>
                    <p className="mt-2 text-sm text-violet-900/80">Casos distintos tocados por los eventos recientes del rastro operativo.</p>
                  </article>
                </div>
                <div className="mt-5 grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
                  <details className="group rounded-[1.4rem] border border-slate-200 bg-slate-50/70">
                    <summary className="flex list-none cursor-pointer flex-wrap items-center justify-between gap-3 px-4 py-4 marker:content-none">
                      <div>
                        <h4 className="text-base font-semibold text-slate-950">Bitácora operativa detallada</h4>
                        <p className="text-sm text-slate-500">Expándela sólo cuando necesites eventos recientes, filtros rápidos y trazabilidad puntual.</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className="rounded-full border border-white bg-white text-slate-700">
                          {`${formatNumber(recentOperationalEvents.length)} de ${formatNumber(filteredAuditTrail.length)} visibles`}
                        </Badge>
                        {filteredAuditTrail.length > 4 ? (
                          <Button
                            type="button"
                            variant="outline"
                            className="rounded-full bg-white text-slate-700"
                            onClick={() => setShowExpandedAuditFeed((current) => !current)}
                          >
                            {showExpandedAuditFeed ? (
                              <ChevronUp className="mr-2 h-4 w-4" />
                            ) : (
                              <ChevronDown className="mr-2 h-4 w-4" />
                            )}
                            {showExpandedAuditFeed ? "Volver a 4" : `Ver 12 eventos`}
                          </Button>
                        ) : null}
                      </div>
                    </summary>
                    <div className="border-t border-slate-200 px-4 pb-4 pt-4">
                      <div className="space-y-4">
                      {filteredAuditTrail.length > 4 ? (
                        <p className="text-xs leading-5 text-slate-500">
                          {showExpandedAuditFeed
                            ? `Vista ampliada activa. Estás viendo 12 eventos priorizados y todavía quedan ${formatNumber(hiddenOperationalEventsCount)} fuera para conservar velocidad de lectura.`
                            : `Mostramos primero 4 eventos que más cambian una decisión. Si necesitas más contexto, expande la bitácora o usa los filtros rápidos.`}
                        </p>
                      ) : null}
                      <div className="rounded-[1.2rem] border border-dashed border-slate-200 bg-white/80 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Filtros rápidos</p>
                            <p className="mt-1 text-sm text-slate-500">Combina familia de evento y severidad para aislar fricción, accesos o documentos sin tocar el filtro global.</p>
                          </div>
                          {(auditFamilyFilter !== "all" || auditSeverityFilter !== "all") ? (
                            <Button variant="ghost" className="rounded-full text-slate-700" onClick={clearAuditFeedFilters}>
                              <X className="mr-2 h-4 w-4" />
                              Limpiar vista rápida
                            </Button>
                          ) : null}
                        </div>
                        <div className="mt-4 space-y-3">
                          <div className="flex flex-wrap gap-2">
                            {AUDIT_FAMILY_FILTER_OPTIONS.map((option) => {
                              const active = auditFamilyFilter === option.value;
                              return (
                                <Button
                                  key={option.value}
                                  type="button"
                                  variant="outline"
                                  className={`rounded-full ${active ? "border-slate-900 bg-slate-900 text-white hover:bg-slate-900 hover:text-white" : "bg-white text-slate-700"}`}
                                  onClick={() => setAuditFamilyFilter(option.value)}
                                >
                                  {option.label}
                                </Button>
                              );
                            })}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {AUDIT_SEVERITY_FILTER_OPTIONS.map((option) => {
                              const active = auditSeverityFilter === option.value;
                              return (
                                <Button
                                  key={option.value}
                                  type="button"
                                  variant="outline"
                                  className={`rounded-full ${active ? "border-slate-900 bg-slate-900 text-white hover:bg-slate-900 hover:text-white" : "bg-white text-slate-700"}`}
                                  onClick={() => setAuditSeverityFilter(option.value)}
                                >
                                  {option.label}
                                </Button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                      <div className="space-y-3">
                        {recentOperationalEvents.length > 0 ? (
                          recentOperationalEvents.map((item) => {
                            const tone = getAuditActionTone(item.action);
                            const rejectionReason = getAuditRejectionReason(item);
                            const severity = getAuditEventSeverity(item);
                            const drilldown = getAuditDrilldownDescriptor(item);
                            return (
                              <article key={item.id} className={`rounded-[1.2rem] border p-4 ${tone.card}`}>
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge className={`rounded-full border ${tone.badge}`}>{getAuditActionLabel(item.action)}</Badge>
                                  <Badge className={`rounded-full border ${getSeverityBadgeClass(severity)}`}>{getAuditSeverityLabel(severity)}</Badge>
                                  <Badge className="rounded-full border border-white/80 bg-white/90 text-slate-700">{item.entityType}</Badge>
                                  {item.caseId ? (
                                    <Badge className="rounded-full border border-white/80 bg-white/90 text-slate-700">{item.caseId}</Badge>
                                  ) : null}
                                </div>
                                <p className="mt-3 text-sm font-semibold text-slate-950">{item.tenantId}</p>
                                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                  {item.documentId ? <span>Documento {item.documentId}</span> : null}
                                  <span>{formatDateTime(item.createdAt)}</span>
                                </div>
                                {rejectionReason ? (
                                  <p className="mt-2 text-sm text-amber-950">
                                    <strong>Motivo:</strong> {rejectionReason}
                                  </p>
                                ) : null}
                                <div className="mt-3 flex flex-wrap items-center gap-3">
                                  <Button type="button" variant="outline" className="rounded-full bg-white/90 text-slate-700" onClick={() => focusAuditItem(item)}>
                                    {drilldown.label}
                                  </Button>
                                  <span className="text-xs font-medium text-slate-500">{drilldown.helper}</span>
                                </div>
                              </article>
                            );
                          })
                        ) : (
                          <SectionEmptyState
                            title="No hay eventos operativos para la combinación rápida actual"
                            description="Quita filtros rápidos de familia o severidad, o bien relaja tenant y caso para recuperar trazabilidad reciente desde la auditoría persistida."
                            onClear={clearAuditFeedFilters}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                  </details>
                  <div className="rounded-[1.4rem] border border-slate-200 bg-slate-50/70 p-4">
                    <div>
                        <h4 className="text-base font-semibold text-slate-950">Lectura rápida</h4>
                        <p className="mt-1 text-sm text-slate-500">Resumen ejecutivo mínimo para monitorear fricción, trazabilidad, embudo documental y preferencia Cámara/Archivo sin abrir otra capa analítica.</p>

                    </div>
                    <div className="mt-4 space-y-3">
                      <div className="rounded-2xl border border-rose-200 bg-rose-50/80 p-4 shadow-sm">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-800">Gate legal visible</p>
                            <p className="mt-2 text-2xl font-semibold tracking-tight text-rose-950">{formatNumber(auditSummary.legalGateAbandonments)}</p>
                          </div>
                          <Badge className="rounded-full border border-rose-200 bg-white text-rose-800">
                            {auditSummary.legalGateAbandonmentRate === null ? "Sin base" : `${formatNumber(auditSummary.legalGateAbandonmentRate)}% abandono`}
                          </Badge>
                        </div>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          <div className="rounded-2xl bg-white/90 p-3">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Casos sin cierre visible</p>
                            <p className="mt-2 text-xl font-semibold text-slate-950">{formatNumber(auditSummary.legalGateAbandonments)}</p>
                            <p className="mt-1 text-xs leading-5 text-slate-500">Conflictos del gate legal que aún no muestran una aceptación posterior.</p>
                          </div>
                          <div className="rounded-2xl bg-white/90 p-3">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Tiempo medio de resolución</p>
                            <p className="mt-2 text-xl font-semibold text-slate-950">{formatDurationCompact(auditSummary.averageLegalGateResolutionSeconds)}</p>
                            <p className="mt-1 text-xs leading-5 text-slate-500">Promedio entre conflicto visible y aceptación posterior del mismo caso.</p>
                          </div>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-rose-950/80">
                          {auditSummary.legalGateAbandonments === 0
                            ? "No se observan casos atorados en el gate legal dentro de la vista actual."
                            : `Se observan ${formatNumber(auditSummary.legalGateAbandonments)} casos con fricción legal aún abierta; conviene revisar copy, espera y reintentos antes de atribuir la caída al documento.`}
                        </p>
                        <div className="mt-4 grid gap-3 xl:grid-cols-[1.15fr_0.85fr]">
                          <div className="rounded-2xl border border-white/80 bg-white/90 p-3 shadow-sm">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Tendencia semanal</p>
                                <p className="mt-1 text-sm text-slate-600">Abandono legal aún abierto agrupado por semana de origen y comparado contra la semana previa.</p>
                              </div>
                              <Badge className="rounded-full border border-rose-200 bg-rose-50 text-rose-800">
                                {formatNumber(auditSummary.legalGateWeeklyTrend.length)} semanas
                              </Badge>
                            </div>
                            {auditSummary.legalGateWeeklyTrend.length > 0 ? (
                              <div className="mt-4 space-y-3">
                                {latestLegalGateTrendPoint ? (
                                  <div className={`rounded-2xl border px-3 py-3 text-sm ${latestLegalGateTrendPoint.isOutOfRange ? "border-rose-200 bg-rose-50/80 text-rose-950" : latestLegalGateTrendPoint.trendDirection === "up" ? "border-amber-200 bg-amber-50/80 text-amber-950" : "border-emerald-200 bg-emerald-50/80 text-emerald-950"}`}>
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em]">Comparación semanal</p>
                                    <p className="mt-2 leading-6">
                                      {latestLegalGateTrendPoint.previousAbandonmentCount === null
                                        ? `La semana de ${formatWeekLabel(latestLegalGateTrendPoint.weekStart)} inaugura la serie con ${formatNumber(latestLegalGateTrendPoint.abandonmentCount)} casos abiertos visibles.`
                                        : latestLegalGateTrendPoint.deltaCount === 0
                                          ? `La semana de ${formatWeekLabel(latestLegalGateTrendPoint.weekStart)} se mantiene estable frente a la previa, con ${formatNumber(latestLegalGateTrendPoint.abandonmentCount)} casos abiertos visibles.`
                                          : latestLegalGateTrendPoint.deltaCount !== null && latestLegalGateTrendPoint.deltaCount > 0
                                            ? `La semana de ${formatWeekLabel(latestLegalGateTrendPoint.weekStart)} sube en ${formatNumber(latestLegalGateTrendPoint.deltaCount)} casos frente a la previa.`
                                            : `La semana de ${formatWeekLabel(latestLegalGateTrendPoint.weekStart)} baja en ${formatNumber(Math.abs(latestLegalGateTrendPoint.deltaCount ?? 0))} casos frente a la previa.`}
                                    </p>
                                    {latestLegalGateTrendPoint.previousAbandonmentCount !== null ? (
                                      <p className="mt-3 text-xs leading-5 text-slate-600">
                                        Balance neto: {latestLegalGateTrendPoint.deltaCount !== null && latestLegalGateTrendPoint.deltaCount > 0 ? `+${formatNumber(latestLegalGateTrendPoint.deltaCount)}` : formatNumber(latestLegalGateTrendPoint.deltaCount ?? 0)} vs previa.
                                      </p>
                                    ) : null}
                                    {hasConsecutiveLegalGateWorsening ? (
                                      <p className="mt-3 text-xs leading-5 text-amber-900">
                                        Alerta discreta: ya van dos semanas consecutivas al alza en abandono visible.
                                      </p>
                                    ) : null}
                                  </div>
                                ) : null}
                                <p className="text-xs leading-5 text-slate-500">
                                  Para V1 se deja una lectura compacta: evolución reciente, balance neto y alerta discreta cuando el deterioro deja de ser puntual.
                                </p>
                              </div>
                            ) : (
                              <p className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
                                Todavía no hay casos abiertos suficientes para dibujar una tendencia semanal del gate legal.
                              </p>
                            )}
                          </div>
                          <div className="rounded-2xl border border-white/80 bg-white/90 p-3 shadow-sm">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Casos afectados</p>
                                <p className="mt-1 text-sm text-slate-600">Drill-down mínimo con los casos que siguen sin cierre visible.</p>
                              </div>
                              <Badge className="rounded-full border border-rose-200 bg-rose-50 text-rose-800">
                                {formatNumber(auditSummary.legalGateAffectedCases.length)}
                              </Badge>
                            </div>
                            {auditSummary.legalGateAffectedCases.length === 0 ? (
                              <p className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
                                No hay casos abiertos para profundizar en esta vista.
                              </p>
                            ) : (
                              <>
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="mt-4 rounded-full bg-white text-slate-700"
                                  onClick={() => setIsLegalGateDrilldownOpen((current) => !current)}
                                >
                                  {isLegalGateDrilldownOpen ? "Ocultar casos afectados" : "Ver casos afectados"}
                                </Button>
                                {isLegalGateDrilldownOpen ? (
                                  <div className="mt-3 space-y-2">
                                    {auditSummary.legalGateAffectedCases.slice(0, 5).map((item) => (
                                      <article key={`${item.scopeId}-${item.conflictStartedAt}`} className="rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-3 text-sm text-slate-700">
                                        <div className="flex flex-wrap items-center gap-2">
                                          <Badge className="rounded-full border border-slate-200 bg-white text-slate-700">Tenant {item.tenantId}</Badge>
                                          <Badge className="rounded-full border border-slate-200 bg-white text-slate-700">{item.caseId ? `Caso ${item.caseId}` : `Scope ${item.scopeId}`}</Badge>
                                          {legalGateNavigationContext && legalGateNavigationContext.scopeId === item.scopeId ? (
                                            <Badge className="rounded-full border border-cyan-200 bg-cyan-50 text-cyan-800">Contexto activo</Badge>
                                          ) : null}
                                        </div>
                                        <p className="mt-2 font-semibold text-slate-950">Fricción abierta desde {formatDateTime(item.conflictStartedAt)}</p>
                                        <p className="mt-1 text-xs leading-5 text-slate-500">
                                          {item.ageSeconds === null ? "La antigüedad visible no está disponible en este corte." : `Antigüedad visible: ${formatDurationCompact(item.ageSeconds)}.`}
                                        </p>
                                        <div className="mt-3 flex flex-wrap gap-2">
                                          <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            data-testid="ceo-contextual-feed-button"
                                            className="rounded-full bg-white text-slate-700"
                                            onClick={() => focusLegalGateCase(item, "/ceo")}
                                          >
                                            Abrir feed filtrado
                                          </Button>
                                          <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            data-testid="ceo-contextual-documents-button"
                                            className="rounded-full bg-white text-slate-700"
                                            onClick={() => focusLegalGateCase(item, "/ceo/documentos")}
                                          >
                                            Ver expediente documental
                                          </Button>
                                          <p className="text-xs leading-5 text-slate-500">Los enlaces conservan tenant y caso al aterrizar para evitar perder el contexto operativo.</p>
                                        </div>
                                      </article>
                                    ))}
                                    {auditSummary.legalGateAffectedCases.length > 5 ? (
                                      <p className="rounded-2xl bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-500">
                                        Se muestran 5 casos; aún quedan {formatNumber(auditSummary.legalGateAffectedCases.length - 5)} casos abiertos en esta vista.
                                      </p>
                                    ) : null}
                                  </div>
                                ) : null}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 shadow-sm">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-800">Alertas ejecutivas derivadas</p>
                          <Badge className="rounded-full border border-amber-200 bg-white text-amber-800">{formatNumber(auditExecutiveAlerts.length)}</Badge>
                        </div>
                        <div className="mt-3 space-y-3">
                          {auditExecutiveAlerts.length > 0 ? (
                            auditExecutiveAlerts.map((alert) => (
                              <article key={`${alert.scope}-${alert.scopeId}`} className="rounded-2xl border border-white/80 bg-white/90 p-3">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge className={`rounded-full border ${getSeverityBadgeClass(alert.severity)}`}>{getAuditSeverityLabel(alert.severity)}</Badge>
                                  <Badge className="rounded-full border border-slate-200 bg-slate-100 text-slate-700">{alert.scope === "case" ? "Caso" : "Tenant"}</Badge>
                                  <Badge className="rounded-full border border-slate-200 bg-slate-100 text-slate-700">{formatNumber(alert.rejectionCount)} rechazos</Badge>
                                </div>
                                <p className="mt-3 text-sm font-semibold text-slate-950">{alert.title}</p>
                                <p className="mt-2 text-sm leading-6 text-slate-600">{alert.description}</p>
                                <Button type="button" variant="outline" className="mt-3 rounded-full bg-white text-slate-700" onClick={() => focusExecutiveAlert(alert)}>
                                  Revisar contexto
                                </Button>
                              </article>
                            ))
                          ) : (
                            <p className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-600">Aún no se acumulan rechazos suficientes por tenant o caso para disparar una alerta ejecutiva derivada.</p>
                          )}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-cyan-100 bg-cyan-50/50 p-4 shadow-sm">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700">Embudo preview → confirmación → carga</p>
                          <Badge className="rounded-full border border-cyan-200 bg-white text-cyan-700">{formatNumber(auditSummary.previewAnalyzedEvents)} previews</Badge>
                        </div>
                        <div className="mt-3 grid gap-2 sm:grid-cols-3">
                          <div className="rounded-2xl bg-white/90 p-3">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Preview</p>
                            <p className="mt-2 text-xl font-semibold text-slate-950">{formatNumber(auditSummary.previewAnalyzedEvents)}</p>
                            <p className="mt-1 text-xs leading-5 text-slate-500">Análisis previos listos para revisión.</p>
                          </div>
                          <div className="rounded-2xl bg-white/90 p-3">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Confirmación</p>
                            <p className="mt-2 text-xl font-semibold text-slate-950">{formatNumber(auditSummary.previewConfirmedEvents)}</p>
                            <p className="mt-1 text-xs leading-5 text-slate-500">
                              {auditSummary.previewToConfirmRate === null
                                ? "Sin base suficiente para medir el paso desde preview."
                                : `${formatNumber(auditSummary.previewToConfirmRate)}% pasa de preview a confirmación.`}
                            </p>
                          </div>
                          <div className="rounded-2xl bg-white/90 p-3">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Carga final</p>
                            <p className="mt-2 text-xl font-semibold text-slate-950">{formatNumber(auditSummary.documentUploadEvents)}</p>
                            <p className="mt-1 text-xs leading-5 text-slate-500">
                              {auditSummary.confirmToUploadRate === null
                                ? "Todavía no hay confirmaciones visibles para cerrar el paso final."
                                : `${formatNumber(auditSummary.confirmToUploadRate)}% de las confirmaciones ya termina en carga.`}
                            </p>
                          </div>
                        </div>
                        <div className="mt-3 space-y-2 text-sm text-cyan-900/80">
                          <p>
                            {auditSummary.averagePreviewToConfirmationSeconds === null
                              ? "Aún no hay confirmaciones suficientes para estimar el tiempo entre preview y confirmación."
                              : auditSummary.averagePreviewToConfirmationSeconds < 60
                                ? `Promedio visible: ${formatNumber(auditSummary.averagePreviewToConfirmationSeconds)} s entre preview y confirmación.`
                                : `Promedio visible: ${(auditSummary.averagePreviewToConfirmationSeconds / 60).toFixed(1)} min entre preview y confirmación.`}
                          </p>
                          <p>
                            {auditSummary.legalGateLockConflicts === 0
                              ? `Gate legal visible: ${formatNumber(auditSummary.legalGateAcceptances)} aceptaciones sin conflictos recientes.`
                              : auditSummary.legalGateAbandonments === 0
                                ? `Gate legal visible: ${formatNumber(auditSummary.legalGateLockConflicts)} conflictos ya absorbidos por ${formatNumber(auditSummary.legalGateAcceptances)} aceptaciones posteriores.`
                                : `Gate legal visible: ${formatNumber(auditSummary.legalGateAbandonments)} conflictos siguen abiertos sobre ${formatNumber(auditSummary.legalGateLockConflicts)} choques y ${formatNumber(auditSummary.legalGateAcceptances)} aceptaciones; conviene revisar espera o concurrencia antes de atribuir la caída al documento.`}
                          </p>
                        </div>
                        <div className="mt-4 rounded-2xl border border-cyan-200 bg-white/90 p-4 shadow-sm">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700">Lectura ejecutiva: primer expediente visible</p>
                              <h4 className="mt-1 text-lg font-semibold text-slate-950">{auditSummary.firstDossier.priorityLabel}</h4>
                              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{auditSummary.firstDossier.narrative}</p>
                            </div>
                            <Badge
                              className={
                                auditSummary.firstDossier.priorityStage === "healthy"
                                  ? "rounded-full border border-emerald-200 bg-emerald-50 text-emerald-800"
                                  : auditSummary.firstDossier.priorityStage === "legal_gate"
                                    ? "rounded-full border border-amber-200 bg-amber-50 text-amber-800"
                                    : "rounded-full border border-cyan-200 bg-cyan-50 text-cyan-800"
                              }
                            >
                              {auditSummary.firstDossier.visibleDropOffRate === null
                                ? "Sin base visible"
                                : `${formatNumber(auditSummary.firstDossier.visibleDropOffRate)}% caída visible`}
                            </Badge>
                          </div>
                          <div className="mt-4 grid gap-3 sm:grid-cols-3">
                            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Señal visible</p>
                              <p className="mt-2 text-xl font-semibold text-slate-950">{formatNumber(auditSummary.firstDossier.visibleStarts)}</p>
                              <p className="mt-1 text-xs leading-5 text-slate-500">Expedientes con preview visible en consola.</p>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Caída observable</p>
                              <p className="mt-2 text-xl font-semibold text-slate-950">{formatNumber(auditSummary.firstDossier.visibleDropOffCount)}</p>
                              <p className="mt-1 text-xs leading-5 text-slate-500">
                                {auditSummary.firstDossier.previewGapCount > 0
                                  ? `${formatNumber(auditSummary.firstDossier.previewGapCount)} se enfrían antes de confirmar.`
                                  : auditSummary.firstDossier.uploadGapCount > 0
                                    ? `${formatNumber(auditSummary.firstDossier.uploadGapCount)} se caen después de confirmar.`
                                    : "No se observa una pérdida dominante dentro del embudo visible."}
                              </p>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Modo dominante</p>
                              <p className="mt-2 text-xl font-semibold capitalize text-slate-950">
                                {auditSummary.firstDossier.dominantCaptureMode === "none" ? "Sin base" : auditSummary.firstDossier.dominantCaptureMode}
                              </p>
                              <p className="mt-1 text-xs leading-5 text-slate-500">{auditSummary.firstDossier.paceLabel}</p>
                            </div>
                          </div>
                          <div className="mt-4 rounded-2xl border border-cyan-100 bg-cyan-50/70 p-3 text-sm text-cyan-950">
                            <p className="font-semibold">Siguiente foco recomendado</p>
                            <p className="mt-1 leading-6">{auditSummary.firstDossier.nextAction}</p>
                            <p className="mt-2 text-xs leading-5 text-cyan-900/80">{auditSummary.firstDossier.dataSourceNote}</p>
                          </div>
                          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 shadow-sm">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Histórico visible de fricción</p>
                                <h5 className="mt-1 text-base font-semibold text-slate-950">{auditSummary.firstDossierHistory.statusLabel}</h5>
                                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{auditSummary.firstDossierHistory.insight}</p>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <Badge className="rounded-full border border-slate-200 bg-white text-slate-700">
                                  {auditSummary.firstDossierHistory.weeklyDropOffRate === null
                                    ? "Sin base semanal"
                                    : `${formatNumber(auditSummary.firstDossierHistory.weeklyDropOffRate)}% caída semanal`}
                                </Badge>
                                <Badge
                                  className={
                                    auditSummary.firstDossierHistory.weeklyTrendDirection === "down"
                                      ? "rounded-full border border-emerald-200 bg-emerald-50 text-emerald-800"
                                      : auditSummary.firstDossierHistory.weeklyTrendDirection === "up"
                                        ? "rounded-full border border-amber-200 bg-amber-50 text-amber-800"
                                        : "rounded-full border border-slate-200 bg-white text-slate-700"
                                  }
                                >
                                  {auditSummary.firstDossierHistory.weeklyDropOffDelta === null
                                    ? "Sin comparación previa"
                                    : auditSummary.firstDossierHistory.weeklyDropOffDelta === 0
                                      ? "0 pts vs semana previa"
                                      : `${auditSummary.firstDossierHistory.weeklyDropOffDelta > 0 ? "+" : ""}${formatNumber(auditSummary.firstDossierHistory.weeklyDropOffDelta)} pts vs previa`}
                                </Badge>
                              </div>
                            </div>
                            <div className="mt-4 grid gap-3 lg:grid-cols-3">
                              <div className="rounded-2xl border border-slate-200 bg-white/90 p-3">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Último día visible</p>
                                <p className="mt-2 text-xl font-semibold text-slate-950">{formatNumber(auditSummary.firstDossierHistory.latestDailyDropOffCount)}</p>
                                <p className="mt-1 text-xs leading-5 text-slate-500">Caídas visibles en la jornada más reciente del audit trail.</p>
                              </div>
                              <div className="rounded-2xl border border-slate-200 bg-white/90 p-3">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Cierre diario</p>
                                <p className="mt-2 text-xl font-semibold text-slate-950">
                                  {auditSummary.firstDossierHistory.latestDailyCompletionRate === null
                                    ? "Sin base"
                                    : `${formatNumber(auditSummary.firstDossierHistory.latestDailyCompletionRate)}%`}
                                </p>
                                <p className="mt-1 text-xs leading-5 text-slate-500">
                                  {auditSummary.firstDossierHistory.latestDailyPreviewToConfirmationSeconds === null
                                    ? "Aún no hay suficiente confirmación visible para medir el ritmo diario."
                                    : `Ritmo medio preview → confirmación: ${formatDurationCompact(auditSummary.firstDossierHistory.latestDailyPreviewToConfirmationSeconds)}.`}
                                </p>
                              </div>
                              <div className="rounded-2xl border border-slate-200 bg-white/90 p-3">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Dominio reciente</p>
                                <p className="mt-2 text-xl font-semibold text-slate-950">{auditSummary.firstDossierHistory.dominantStageLabel}</p>
                                <p className="mt-1 text-xs leading-5 text-slate-500">Etapa que más explica la fricción visible en la semana más reciente.</p>
                              </div>
                            </div>
                            <div className="mt-4 grid gap-3 xl:grid-cols-2">
                              <div className="rounded-2xl border border-slate-200 bg-white/90 p-3">
                                <div className="flex items-center justify-between gap-3">
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Últimas semanas</p>
                                  <p className="text-[11px] text-slate-500">Hasta 6 cortes visibles</p>
                                </div>
                                <div className="mt-3 space-y-2">
                                  {auditSummary.firstDossierHistory.weeklySeries.length === 0 ? (
                                    <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
                                      La serie semanal aparecerá cuando el audit trail visible acumule más de un corte del primer expediente.
                                    </p>
                                  ) : (
                                    auditSummary.firstDossierHistory.weeklySeries.map((point) => (
                                      <div key={point.bucketStart} className="rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-3">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                          <p className="text-sm font-semibold text-slate-900">Semana de {formatWeekLabel(point.bucketStart)}</p>
                                          <Badge className="rounded-full border border-slate-200 bg-white text-slate-700">{point.dominantStageLabel}</Badge>
                                        </div>
                                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                                          <span>{formatNumber(point.starts)} inicios</span>
                                          <span>{formatNumber(point.confirmations)} confirmaciones</span>
                                          <span>{formatNumber(point.uploads)} cargas</span>
                                          <span>{formatNumber(point.legalGateConflictCount)} conflictos legales</span>
                                        </div>
                                        <p className="mt-2 text-sm text-slate-600">
                                          {point.visibleDropOffRate === null
                                            ? "Sin base visible de caída para esa semana."
                                            : `${formatNumber(point.visibleDropOffRate)}% de caída visible con ${formatNumber(point.visibleDropOffCount)} expediente(s) que no completan el tramo observable.`}
                                        </p>
                                      </div>
                                    ))
                                  )}
                                </div>
                              </div>
                              <div className="rounded-2xl border border-slate-200 bg-white/90 p-3">
                                <div className="flex items-center justify-between gap-3">
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Últimos días</p>
                                  <p className="text-[11px] text-slate-500">Hasta 7 jornadas visibles</p>
                                </div>
                                <div className="mt-3 space-y-2">
                                  {auditSummary.firstDossierHistory.dailySeries.length === 0 ? (
                                    <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
                                      La serie diaria aparecerá cuando el primer expediente deje trazas visibles en días distintos.
                                    </p>
                                  ) : (
                                    auditSummary.firstDossierHistory.dailySeries.map((point) => (
                                      <div key={point.bucketStart} className="rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-3">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                          <p className="text-sm font-semibold text-slate-900">{formatDayLabel(point.bucketStart)}</p>
                                          <Badge className="rounded-full border border-slate-200 bg-white text-slate-700">{point.dominantStageLabel}</Badge>
                                        </div>
                                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                                          <span>{formatNumber(point.starts)} inicios</span>
                                          <span>{formatNumber(point.confirmations)} confirmaciones</span>
                                          <span>{formatNumber(point.uploads)} cargas</span>
                                        </div>
                                        <p className="mt-2 text-sm text-slate-600">
                                          {point.averagePreviewToConfirmationSeconds === null
                                            ? "Sin ritmo visible suficiente para medir preview → confirmación ese día."
                                            : `Preview → confirmación en ${formatDurationCompact(point.averagePreviewToConfirmationSeconds)} promedio.`}
                                        </p>
                                      </div>
                                    ))
                                  )}
                                </div>
                              </div>
                            </div>
                            <p className="mt-3 text-xs leading-5 text-slate-500">{auditSummary.firstDossierHistory.dataSourceNote}</p>
                          </div>
                        </div>
                      </div>
                      <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4 shadow-sm">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Selector Cámara / Archivo</p>
                          <Badge className="rounded-full border border-emerald-200 bg-white text-emerald-700">
                            {formatNumber(auditSummary.cameraCaptureSelections + auditSummary.fileCaptureSelections)} selecciones
                          </Badge>
                        </div>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          <div className="rounded-2xl bg-white/90 p-3">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Cámara</p>
                            <p className="mt-2 text-xl font-semibold text-slate-950">{formatNumber(auditSummary.cameraCaptureSelections)}</p>
                            <p className="mt-1 text-xs leading-5 text-slate-500">Capturas donde el preview llegó desde cámara.</p>
                            <p className="mt-2 text-[11px] leading-5 text-emerald-800/80">
                              {auditSummary.cameraPreviewToConfirmRate === null
                                ? "Sin base suficiente para medir confirmación desde cámara."
                                : `${formatNumber(auditSummary.cameraPreviewToConfirmRate)}% confirma tras preview desde cámara.`}
                            </p>
                          </div>
                          <div className="rounded-2xl bg-white/90 p-3">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Archivo</p>
                            <p className="mt-2 text-xl font-semibold text-slate-950">{formatNumber(auditSummary.fileCaptureSelections)}</p>
                            <p className="mt-1 text-xs leading-5 text-slate-500">Selecciones donde el preview llegó desde archivo.</p>
                            <p className="mt-2 text-[11px] leading-5 text-emerald-800/80">
                              {auditSummary.filePreviewToConfirmRate === null
                                ? "Sin base suficiente para medir confirmación desde archivo."
                                : `${formatNumber(auditSummary.filePreviewToConfirmRate)}% confirma tras preview desde archivo.`}
                            </p>
                          </div>
                        </div>
                        <p className="mt-3 text-sm text-emerald-900/80">
                          {auditSummary.cameraCaptureSelections + auditSummary.fileCaptureSelections === 0
                            ? "Todavía no hay previews visibles con captureMode suficiente para leer preferencia de entrada."
                            : auditSummary.dominantCaptureMode === "balanced"
                              ? "La entrada visible está equilibrada entre Cámara y Archivo; conviene priorizar el modo con menor tasa de confirmación cuando aparezca una brecha clara."
                              : auditSummary.dominantCaptureMode === "camera"
                                ? "Predomina Cámara en la entrada visible; compare su tasa de confirmación con Archivo para decidir si el siguiente ajuste debe ir a autoencuadre o a selección de archivos."
                                : "Predomina Archivo en la entrada visible; compare su tasa de confirmación con Cámara para decidir si el siguiente ajuste debe ir a selector, peso de archivo o experiencia de captura."}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-white p-4 shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Accesos auditados</p>
                        <p className="mt-2 text-xl font-semibold text-slate-950">{formatNumber(auditSummary.accessEvents)}</p>
                        <p className="mt-2 text-sm text-slate-500">Cambios de membresías y superficie de acceso trazable.</p>
                      </div>
                      <div className="rounded-2xl bg-white p-4 shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Políticas auditadas</p>
                        <p className="mt-2 text-xl font-semibold text-slate-950">{formatNumber(auditSummary.policyEvents)}</p>
                        <p className="mt-2 text-sm text-slate-500">Cambios de consentimiento o visibilidad ya persistidos.</p>
                      </div>
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-4 shadow-sm">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Causas frecuentes de guardrail</p>
                            <p className="mt-2 text-sm font-semibold text-slate-950">{auditSummary.guardrailReasonRanking.length > 0 ? "Ranking accionable" : "Sin eventos de rechazo recientes"}</p>
                          </div>
                          <Badge className="rounded-full border border-slate-200 bg-slate-100 text-slate-700">
                            {formatNumber(auditSummary.guardrailReasonRanking.length)} causas
                          </Badge>
                        </div>
                        {auditSummary.guardrailReasonRanking.length > 0 ? (
                          <>
                            <div className="mt-3 flex flex-wrap gap-2 text-xs">
                              <Badge className="rounded-full border border-emerald-200 bg-emerald-50 text-emerald-800">
                                {formatNumber(guardrailFollowUpSummary.resolvedCount)} resueltas
                              </Badge>
                              <Badge className="rounded-full border border-slate-200 bg-white text-slate-700">
                                {formatNumber(guardrailFollowUpSummary.openCount)} pendientes
                              </Badge>
                              {guardrailFollowUpSummary.trackingCount > 0 ? (
                                <Badge className="rounded-full border border-amber-200 bg-amber-50 text-amber-800">
                                  {formatNumber(guardrailFollowUpSummary.trackingCount)} en seguimiento
                                </Badge>
                              ) : null}
                            </div>
                          <div className="mt-3 space-y-2">
                            {auditSummary.guardrailReasonRanking.map((entry, index) => {
                              const followUpStatus = guardrailFollowUpByReason[entry.reason] ?? "pending";
                              const followUpMeta = getGuardrailFollowUpMeta(followUpStatus);

                              return (
                                <article key={`${entry.reason}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-3 text-sm text-slate-700">
                                  <div className="flex items-center justify-between gap-3">
                                    <p className="font-semibold text-slate-950">{index + 1}. {entry.reason}</p>
                                    <Badge className="rounded-full border border-amber-200 bg-amber-50 text-amber-800">{formatNumber(entry.count)} rechazos</Badge>
                                  </div>
                                  <p className="mt-2 text-xs leading-5 text-slate-500">
                                    {entry.latestAt ? `Último visible: ${formatDateTime(entry.latestAt)}.` : "Sin timestamp visible."} {entry.caseId ? `Caso más reciente: ${entry.caseId}.` : `Tenant: ${entry.tenantId}.`}
                                  </p>
                                  <div className="mt-3 flex flex-wrap items-center gap-2">
                                    <Badge className={`rounded-full border ${followUpMeta.badgeClassName}`}>{followUpMeta.label}</Badge>
                                    <Button type="button" variant="outline" size="sm" className="rounded-full bg-white text-slate-700" onClick={() => toggleGuardrailFollowUp(entry.reason)}>
                                      {followUpMeta.actionLabel}
                                    </Button>
                                  </div>
                                  <div className="mt-3 rounded-2xl border border-cyan-100 bg-cyan-50/80 px-3 py-3">
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-700">Acción sugerida</p>
                                    <p className="mt-2 text-sm leading-6 text-cyan-950">{entry.suggestedAction}</p>
                                  </div>
                                </article>
                              );
                            })}
                          </div>
                          </>
                        ) : (
                          <p className="mt-3 text-sm text-slate-500">Cuando un guardrail operativo bloquee una acción de Auditar, aquí aparecerán las causas más repetidas para priorizar la corrección.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
                <section className="space-y-6">
                  <div className="rounded-[1.8rem] border border-white/70 bg-white/92 p-5 shadow-[0_24px_70px_-34px_rgba(15,23,42,0.18)]">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Estado de operación</p>
                        <h3 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">Salud por tenant</h3>
                      </div>
                      <Badge className="rounded-full border border-teal-200 bg-teal-50 text-teal-700">
                        {formatNumber(snapshotData.tenantHealth.length)} organizaciones visibles
                      </Badge>
                    </div>
                    <div className="mt-5 space-y-3">
                      {snapshotData.tenantHealth.length > 0 ? (
                        snapshotData.tenantHealth.map((tenant) => (
                          <article
                            key={tenant.tenantId}
                            className="grid gap-4 rounded-[1.4rem] border border-slate-200/80 bg-slate-50/70 p-4 lg:grid-cols-[minmax(0,1fr)_auto]"
                          >
                            <div className="space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-base font-semibold text-slate-950">{tenant.tenantName}</p>
                                <Badge className={`rounded-full border ${getStatusBadgeClass(tenant.status)}`}>{tenant.status}</Badge>
                              </div>
                              <p className="text-sm text-slate-500">Actualizado: {formatDateTime(tenant.updatedAt)}</p>
                            </div>
                            <div className="grid min-w-0 grid-cols-2 gap-3 text-sm text-slate-600 sm:grid-cols-4 lg:min-w-[360px]">
                              <div className="rounded-2xl bg-white px-3 py-2">
                                <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Casos</p>
                                <strong className="text-base text-slate-950">{formatNumber(tenant.activeCases)}</strong>
                              </div>
                              <div className="rounded-2xl bg-white px-3 py-2">
                                <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Alertas</p>
                                <strong className="text-base text-slate-950">{formatNumber(tenant.openAlerts)}</strong>
                              </div>
                              <div className="rounded-2xl bg-white px-3 py-2">
                                <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Membresías</p>
                                <strong className="text-base text-slate-950">{formatNumber(tenant.activeMemberships)}</strong>
                              </div>
                              <div className="rounded-2xl bg-white px-3 py-2">
                                <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Docs pendientes</p>
                                <strong className="text-base text-slate-950">{formatNumber(tenant.pendingDocuments)}</strong>
                              </div>
                            </div>
                          </article>
                        ))
                      ) : (
                        <SectionEmptyState
                          title="No hay tenants que coincidan con el filtro actual"
                          description="Ajusta la búsqueda o amplía la ventana temporal para recuperar visibilidad de organizaciones, casos y señales operativas."
                          onClear={clearAllFilters}
                        />
                      )}
                      </div>
                    </div>

                  <div className="rounded-[1.8rem] border border-white/70 bg-white/92 p-5 shadow-[0_24px_70px_-34px_rgba(15,23,42,0.18)]">

                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Expedientes recientes</p>
                        <h3 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">Casos con actividad más reciente</h3>
                      </div>
                      <Badge className="rounded-full border border-slate-200 bg-slate-100 text-slate-700">
                        {formatNumber(snapshotData.recentCases.length)} visibles
                      </Badge>
                    </div>
                    <div className="mt-5 overflow-hidden rounded-[1.4rem] border border-slate-200">
                      {snapshotData.recentCases.length > 0 ? (
                        <>
                          <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)_auto_auto_auto] gap-3 bg-slate-100 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                            <span>Caso</span>
                            <span>Tenant</span>
                            <span>Estatus</span>
                            <span>Última actividad</span>
                            <span className="text-right">Acción segura</span>
                          </div>
                          <div className="divide-y divide-slate-200 bg-white">
                            {snapshotData.recentCases.map((item) => {
                              const actionLabel = getSafeCaseActionLabel(item.status);
                              return (
                                <div key={item.caseId} className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)_auto_auto_auto] gap-3 px-4 py-4 text-sm">
                                  <div className="min-w-0">
                                    <p className="truncate font-semibold text-slate-950">{item.title}</p>
                                    <p className="truncate text-slate-500">{item.caseId}</p>
                                  </div>
                                  <div className="min-w-0 text-slate-600">{item.tenantName}</div>
                                  <div>
                                    <Badge className={`rounded-full border ${getStatusBadgeClass(item.status)}`}>{item.status}</Badge>
                                  </div>
                                  <div className="text-right text-slate-500">{formatDateTime(item.lastActivityAt ?? item.updatedAt)}</div>
                                  <div className="flex justify-end">
                                    {actionLabel ? (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="rounded-full bg-white"
                                        disabled={executiveActionsBlocked || isCaseBusy(item.tenantId, item.caseId)}
                                        onClick={() => {
                                          requestCaseAction(item.tenantId, item.caseId, item.title, item.status);
                                        }}
                                      >
                                        {isCaseBusy(item.tenantId, item.caseId) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                        {actionLabel}
                                      </Button>
                                    ) : (
                                      <span className="text-xs text-slate-400">Sin acción segura</span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </>
                      ) : (
                        <div className="bg-white p-4">
                          <SectionEmptyState
                            title="No hay expedientes visibles para esta combinación"
                            description="Puedes quitar el filtro de caso, usuario o severidad para recuperar una vista más amplia del pipeline operativo."
                            onClear={clearAllFilters}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </section>

                <section className="space-y-6">
                  <details className="group rounded-[1.8rem] border border-white/70 bg-white/92 shadow-[0_24px_70px_-34px_rgba(15,23,42,0.18)]">
                    <summary className="flex list-none cursor-pointer flex-wrap items-start justify-between gap-4 p-5 marker:content-none">
                      <div className="max-w-3xl">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Distribución</p>
                        <h3 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">Análisis detallado del momento</h3>
                        <p className="mt-3 text-sm leading-6 text-slate-600">
                          Casos por estatus y alertas por severidad quedan disponibles bajo demanda para no competir con las prioridades del día.
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className="rounded-full border border-slate-200 bg-slate-100 text-slate-700">
                          {formatNumber((baseSnapshotQuery.data?.casesByStatus ?? []).length)} estatus visibles
                        </Badge>
                        <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-sm font-medium text-slate-700 group-open:hidden">
                          Ver análisis detallado
                        </span>
                        <span className="hidden items-center rounded-full border border-slate-200 bg-slate-900 px-3 py-1 text-sm font-medium text-white group-open:inline-flex">
                          Ocultar análisis
                        </span>
                      </div>
                    </summary>
                    <div className="border-t border-slate-100 px-5 pb-5 pt-4">
                      <div className="space-y-4">
                      <div className="rounded-[1.4rem] border border-slate-200 bg-slate-50/70 p-4">
                        <div className="flex items-center gap-2 text-slate-950">
                          <Building2 className="h-4 w-4 text-teal-700" />
                          <p className="font-semibold">Casos por estatus</p>
                        </div>
                        <div className="mt-4 space-y-3">
                          {baseSnapshotQuery.data?.casesByStatus.map((item) => (
                            <div key={item.status}>
                              <div className="mb-1 flex items-center justify-between text-sm text-slate-600">
                                <span>{item.status}</span>
                                <span>{formatNumber(item.total)}</span>
                              </div>
                              <div className="h-2.5 overflow-hidden rounded-full bg-slate-200">
                                <div
                                  className="h-full rounded-full bg-teal-500"
                                  style={{
                                    width: `${Math.max(8, (item.total / Math.max(globalSummary.activeCases || 1, 1)) * 100)}%`,
                                  }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-[1.4rem] border border-slate-200 bg-slate-50/70 p-4">
                        <div className="flex items-center gap-2 text-slate-950">
                          <ShieldCheck className="h-4 w-4 text-cyan-700" />
                          <p className="font-semibold">Alertas por severidad</p>
                        </div>
                        <div className="mt-4 space-y-3">
                          {baseSnapshotQuery.data?.alertsBySeverity.map((item) => (
                            <div key={item.severity} className="flex items-center justify-between rounded-2xl bg-white px-3 py-3 text-sm">
                              <Badge className={`rounded-full border ${getSeverityBadgeClass(item.severity)}`}>{item.severity}</Badge>
                              <strong className="text-slate-950">{formatNumber(item.total)}</strong>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                  </details>

                  <div className="rounded-[1.8rem] border border-white/70 bg-white/92 p-5 shadow-[0_24px_70px_-34px_rgba(15,23,42,0.18)]">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Pendientes del CEO</p>
                    <h3 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">Prioridades para seguimiento</h3>
                    <div className="mt-5 space-y-3 text-sm text-slate-700">
                      <div className="rounded-[1.3rem] border border-amber-200 bg-amber-50 px-4 py-3">
                        Hay <strong>{formatNumber(globalSummary.pendingConsents)}</strong> consentimientos pendientes de resolver.
                      </div>
                      <div className="rounded-[1.3rem] border border-rose-200 bg-rose-50 px-4 py-3">
                        Existen <strong>{formatNumber(globalSummary.criticalAlerts)}</strong> alertas críticas que merecen revisión ejecutiva.
                      </div>
                      <div className="rounded-[1.3rem] border border-cyan-200 bg-cyan-50 px-4 py-3">
                        Se registran <strong>{formatNumber(globalSummary.caseScopedMemberships)}</strong> accesos de alcance por caso actualmente activos.
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            </>
          ) : null}

          {currentSection === "bridge" ? (
            <div className="space-y-5">
              <section className="rounded-[1.8rem] border border-white/70 bg-white/92 p-5 shadow-[0_24px_70px_-34px_rgba(15,23,42,0.18)]">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Observabilidad bridge</p>
                    <h3 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">Snapshot operativo CompliLink ↔ AuditaPatron</h3>
                  </div>
                  <Badge className="rounded-full border border-sky-200 bg-sky-50 text-sky-700">
                    {formatNumber(bridgeOverview.rows.length)} expedientes trazados
                  </Badge>
                </div>
                <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-600">
                  Esta vista concentra el estado operativo del bridge usando el feed de auditoría ya disponible: envíos recientes, expedientes pendientes de retorno,
                  fallos permanentes y advertencias que todavía requieren seguimiento manual.
                </p>
                <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <article className="rounded-[1.4rem] border border-rose-200 bg-rose-50/80 p-4">
                    <div className="flex items-center gap-3">
                      <Siren className="h-5 w-5 text-rose-600" />
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-rose-700">Críticos</p>
                        <p className="mt-1 text-2xl font-semibold tracking-tight text-rose-950">{formatNumber(bridgeOverview.summary.critical)}</p>
                      </div>
                    </div>
                    <p className="mt-3 text-sm text-rose-900/80">Fallo permanente, guardrail activo o incidente con riesgo operativo inmediato.</p>
                  </article>
                  <article className="rounded-[1.4rem] border border-amber-200 bg-amber-50/80 p-4">
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="h-5 w-5 text-amber-600" />
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700">Advertencias</p>
                        <p className="mt-1 text-2xl font-semibold tracking-tight text-amber-950">{formatNumber(bridgeOverview.summary.warning)}</p>
                      </div>
                    </div>
                    <p className="mt-3 text-sm text-amber-900/80">Eventos con retry, inconsistencias o alertas abiertas ligadas al retorno documental.</p>
                  </article>
                  <article className="rounded-[1.4rem] border border-sky-200 bg-sky-50/80 p-4">
                    <div className="flex items-center gap-3">
                      <Clock3 className="h-5 w-5 text-sky-600" />
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-700">Pendientes</p>
                        <p className="mt-1 text-2xl font-semibold tracking-tight text-sky-950">{formatNumber(bridgeOverview.summary.pending)}</p>
                      </div>
                    </div>
                    <p className="mt-3 text-sm text-sky-900/80">Expedientes que ya salieron al bridge y siguen esperando webhook o confirmación final.</p>
                  </article>
                  <article className="rounded-[1.4rem] border border-emerald-200 bg-emerald-50/80 p-4">
                    <div className="flex items-center gap-3">
                      <ShieldCheck className="h-5 w-5 text-emerald-600" />
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">Conformes</p>
                        <p className="mt-1 text-2xl font-semibold tracking-tight text-emerald-950">{formatNumber(bridgeOverview.summary.healthy)}</p>
                      </div>
                    </div>
                    <p className="mt-3 text-sm text-emerald-900/80">Retornos procesados sin alertas abiertas en el expediente visible.</p>
                  </article>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <article className="rounded-[1.4rem] border border-slate-200 bg-slate-50/80 p-4">
                    <div className="flex items-center gap-3">
                      <GitBranch className="h-5 w-5 text-slate-600" />
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Entregas con retorno</p>
                        <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">{formatNumber(bridgeOperationalSummary.delivered)}</p>
                      </div>
                    </div>
                    <p className="mt-3 text-sm text-slate-600">Documentos del carril bridge que ya registraron webhook o confirmación final visible.</p>
                  </article>
                  <article className="rounded-[1.4rem] border border-orange-200 bg-orange-50/80 p-4">
                    <div className="flex items-center gap-3">
                      <ShieldX className="h-5 w-5 text-orange-600" />
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-orange-700">Rechazos</p>
                        <p className="mt-1 text-2xl font-semibold tracking-tight text-orange-950">{formatNumber(bridgeOperationalSummary.rejected)}</p>
                      </div>
                    </div>
                    <p className="mt-3 text-sm text-orange-900/80">Incluye rechazos de retorno, fallos definitivos y contratos que requieren intervención manual.</p>
                  </article>
                  <article className="rounded-[1.4rem] border border-violet-200 bg-violet-50/80 p-4">
                    <div className="flex items-center gap-3">
                      <RefreshCw className="h-5 w-5 text-violet-600" />
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-violet-700">Reintentos activos</p>
                        <p className="mt-1 text-2xl font-semibold tracking-tight text-violet-950">{formatNumber(bridgeOperationalSummary.retries)}</p>
                      </div>
                    </div>
                    <p className="mt-3 text-sm text-violet-900/80">Eventos marcados con retry o con nueva tentativa pendiente antes del siguiente intento de entrega.</p>
                  </article>
                  <article className="rounded-[1.4rem] border border-sky-200 bg-white/95 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Último smoke test recurrente</p>
                        <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">{bridgeOperationalSummary.smokeStatusLabel}</p>
                      </div>
                      <Badge
                        className={`rounded-full border ${
                          bridgeSmokeStatus?.availability === "ready"
                            ? bridgeSmokeStatus.contractCheck.passed && !bridgeOperationalSummary.smokeIsStale
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : bridgeSmokeStatus.contractCheck.passed
                                ? "border-amber-200 bg-amber-50 text-amber-700"
                                : "border-rose-200 bg-rose-50 text-rose-700"
                            : bridgeSmokeStatus?.availability === "error"
                              ? "border-amber-200 bg-amber-50 text-amber-700"
                              : "border-slate-200 bg-slate-50 text-slate-600"
                        }`}
                      >
                        {bridgeSmokeStatusQuery.isLoading
                          ? "Cargando"
                          : bridgeSmokeStatus?.availability === "ready"
                            ? bridgeSmokeStatus.contractCheck.passed
                              ? bridgeOperationalSummary.smokeIsStale
                                ? "desactualizado"
                                : "vigente"
                              : "falló"
                            : bridgeSmokeStatus?.availability === "error"
                              ? "lectura"
                              : "sin registro"}
                      </Badge>
                    </div>
                    <div className="mt-3 space-y-2 text-sm text-slate-600">
                      <p>
                        {bridgeSmokeStatus?.testedAt
                          ? `Última corrida: ${formatDateTime(bridgeSmokeStatus.testedAt)}${bridgeOperationalSummary.smokeAgeMinutes !== null ? ` · hace ${formatNumber(bridgeOperationalSummary.smokeAgeMinutes)} min` : ""}`
                          : "Todavía no hay una corrida persistida del smoke test bridge para esta vista."}
                      </p>
                      <p>
                        Health {bridgeSmokeStatus?.health.status ?? "—"} · Webhook {bridgeSmokeStatus?.webhook.status ?? "—"} · Contrato esperado {bridgeSmokeStatus?.contractCheck.expectedContract ?? "auditapatron.bridge.ack.v1"}
                      </p>
                      <p>
                        {bridgeSmokeStatus?.availability === "ready"
                          ? bridgeSmokeStatus.contractCheck.passed
                            ? "El último contrato de smoke confirma ack 200/202 y firma verificada del webhook."
                            : "El smoke persistido no pasó la validación contractual completa; conviene revisar el carril antes de operar."
                          : bridgeSmokeStatus?.availability === "error"
                            ? "Se detectó un problema al leer el último resultado persistido del smoke test."
                            : "Aún no existe un resultado persistido del smoke test para el carril bridge."}
                      </p>
                    </div>
                    <div
                      data-testid="bridge-smoke-alert-summary"
                      className={`mt-4 rounded-[1.2rem] border px-4 py-3 ${bridgeSmokeAlertTone.card}`}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          data-testid="bridge-smoke-alert-badge"
                          className={`rounded-full border ${bridgeSmokeAlertTone.badge}`}
                        >
                          {bridgeSmokeAlerting?.statusLabel ?? "Sin alertas activas"}
                        </Badge>
                        <Badge className="rounded-full border border-white/80 bg-white/90 text-slate-700">
                          {getBridgeSmokeAlertVisualStateLabel(bridgeSmokeAlerting?.visualState ?? "stable")}
                        </Badge>
                        <Badge
                          data-testid="bridge-smoke-threshold-badge"
                          className="rounded-full border border-white/80 bg-white/90 text-slate-700"
                        >
                          Umbral {formatNumber(bridgeSmokeAlerting?.threshold ?? 0)}
                        </Badge>
                        <Badge className="rounded-full border border-white/80 bg-white/90 text-slate-700">
                          Racha {formatNumber(bridgeSmokeAlerting?.lastObservedConsecutiveFailures ?? 0)}
                        </Badge>
                      </div>
                      <div className="mt-3 flex items-start gap-3">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                        <div className="space-y-1">
                          <p className="text-sm font-semibold">{bridgeSmokeAlerting?.detail ?? "El bridge se mantiene estable dentro del umbral operativo configurado."}</p>
                          <p className="text-xs opacity-80">{bridgeSmokeAlertTimestamp}</p>
                        </div>
                      </div>
                      <div className="mt-4 grid gap-3 rounded-[1rem] border border-white/80 bg-white/70 p-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Sensibilidad de alerting</p>
                          <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{formatNumber(bridgeSmokeAlerting?.threshold ?? 0)}</p>
                          <p className="mt-2 text-sm text-slate-600">Define cuántos fallos consecutivos necesita el smoke del bridge antes de escalar una alerta operativa.</p>
                        </div>
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-end gap-3">
                            <label className="min-w-0 flex-1 sm:min-w-[180px]">
                              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Nuevo umbral</span>
                              <input
                                data-testid="bridge-smoke-threshold-input"
                                type="number"
                                min={1}
                                max={20}
                                step={1}
                                className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-400"
                                value={bridgeSmokeThresholdDraft}
                                disabled={bridgeSmokeThresholdMutation.isPending}
                                onChange={(event) => setBridgeSmokeThresholdDraft(event.target.value)}
                              />
                            </label>
                            <Button
                              type="button"
                              className="rounded-full"
                              disabled={bridgeSmokeThresholdMutation.isPending || executiveActionsBlocked}
                              onClick={() => {
                                void handleBridgeSmokeThresholdSubmit();
                              }}
                            >
                              {bridgeSmokeThresholdMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                              Guardar umbral
                            </Button>
                          </div>
                          <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                            <span className="rounded-full border border-white bg-white px-3 py-1.5">
                              Último cambio: {bridgeSmokeAlerting?.thresholdAudit.updatedAt ? formatDateTime(bridgeSmokeAlerting.thresholdAudit.updatedAt) : "Sin cambios manuales"}
                            </span>
                            <span className="rounded-full border border-white bg-white px-3 py-1.5">
                              Responsable: {bridgeSmokeAlerting?.thresholdAudit.userName ?? bridgeSmokeAlerting?.thresholdAudit.userEmail ?? "Sistema"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </article>
                </div>
                <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-500">
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">Pendientes de ack: {formatNumber(bridgeOperationalSummary.awaitingAck)}</span>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">Con retorno visible: {formatNumber(bridgeOverview.summary.withReturn)}</span>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">Con warnings: {formatNumber(bridgeOverview.summary.withWarnings)}</span>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">Retry programado: {formatNumber(bridgeOverview.summary.retryScheduled)}</span>
                  <span data-testid="bridge-smoke-threshold-pill" className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">Umbral operativo smoke: {formatNumber(bridgeSmokeAlerting?.threshold ?? 0)}</span>
                </div>
                <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                  <article className="rounded-[1.6rem] border border-slate-200 bg-white/95 p-5 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Presets bridge</p>
                        <h3 className="mt-1 text-lg font-semibold text-slate-950">Guardar filtros, formato y destinatarios</h3>
                        <p className="mt-1 text-sm text-slate-600">El preset reutiliza los filtros visibles del bridge y el umbral operativo actual.</p>
                      </div>
                      <Badge className="rounded-full border border-slate-200 bg-slate-50 text-slate-700">{bridgePresets.length} preset{bridgePresets.length === 1 ? "" : "s"}</Badge>
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <label>
                        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Nombre del preset</span>
                        <input
                          className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-400"
                          value={bridgePresetNameDraft}
                          onChange={(event) => setBridgePresetNameDraft(event.target.value)}
                          placeholder="Cierre semanal bridge"
                        />
                      </label>
                      <label>
                        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Formato por defecto</span>
                        <select
                          className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-400"
                          value={bridgePresetExportFormatDraft}
                          onChange={(event) => setBridgePresetExportFormatDraft(event.target.value as "csv" | "pdf")}
                        >
                          <option value="pdf">PDF ejecutivo</option>
                          <option value="csv">CSV operativo</option>
                        </select>
                      </label>
                      <label className="md:col-span-2">
                        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Descripción breve</span>
                        <input
                          className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-400"
                          value={bridgePresetDescriptionDraft}
                          onChange={(event) => setBridgePresetDescriptionDraft(event.target.value)}
                          placeholder="Reporte recurrente para seguimiento ejecutivo del carril bridge"
                        />
                      </label>
                      <label className="md:col-span-2">
                        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Destinatarios sugeridos</span>
                        <input
                          className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-400"
                          value={bridgePresetEmailRecipientsDraft}
                          onChange={(event) => setBridgePresetEmailRecipientsDraft(event.target.value)}
                          placeholder="ceo@empresa.com, operaciones@empresa.com"
                        />
                      </label>
                      <label className="md:col-span-2">
                        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Mensaje opcional</span>
                        <textarea
                          className="mt-2 min-h-[88px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-400"
                          value={bridgePresetEmailMessageDraft}
                          onChange={(event) => setBridgePresetEmailMessageDraft(event.target.value)}
                          placeholder="Resumen operativo del bridge para revisión ejecutiva."
                        />
                      </label>
                    </div>
                    <div className="mt-4 rounded-[1.2rem] border border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-600">
                      <p className="font-medium text-slate-900">Filtros que se guardarán ahora</p>
                      <p className="mt-1">{formatBridgePresetSummary(bridgePresetFilters)}</p>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <Button type="button" className="rounded-full" disabled={createBridgePresetMutation.isPending} onClick={() => void handleSaveBridgePreset()}>
                        {createBridgePresetMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Files className="mr-2 h-4 w-4" />}
                        Guardar preset actual
                      </Button>
                    </div>
                    <div className="mt-5 space-y-3">
                      {bridgePresets.length === 0 ? (
                        <div className="rounded-[1.2rem] border border-dashed border-slate-300 bg-slate-50/70 px-4 py-5 text-sm text-slate-500">
                          Aún no existen presets bridge para este alcance. Guarda el estado actual para reutilizar filtros y destinatarios.
                        </div>
                      ) : (
                        bridgePresets.map((preset) => (
                          <div key={preset.id} className="rounded-[1.2rem] border border-slate-200 bg-slate-50/70 p-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-slate-950">{preset.name}</p>
                                <p className="mt-1 text-xs text-slate-500">{preset.description ?? formatBridgePresetSummary(preset.filters)}</p>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <Badge className="rounded-full border border-white bg-white text-slate-700">{preset.exportFormat.toUpperCase()}</Badge>
                                <Badge className="rounded-full border border-white bg-white text-slate-700">Umbral {preset.smokeThreshold}</Badge>
                              </div>
                            </div>
                            <p className="mt-3 text-xs text-slate-500">Filtros: {formatBridgePresetSummary(preset.filters)}</p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <Button type="button" variant="outline" className="rounded-full bg-white" onClick={() => handleApplyBridgePreset(preset)}>
                                Aplicar
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                className="rounded-full bg-white"
                                disabled={deleteBridgePresetMutation.isPending}
                                onClick={() => void handleDeleteBridgePreset(preset)}
                              >
                                Eliminar
                              </Button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </article>
                  <article className="rounded-[1.6rem] border border-slate-200 bg-white/95 p-5 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Agenda automática</p>
                        <h3 className="mt-1 text-lg font-semibold text-slate-950">Programar envío recurrente del bridge</h3>
                        <p className="mt-1 text-sm text-slate-600">Usa cron de 6 campos y zona horaria IANA para ejecutar el bridge sin intervención manual.</p>
                      </div>
                      <Badge className="rounded-full border border-slate-200 bg-slate-50 text-slate-700">{bridgeSchedules.length} agenda{bridgeSchedules.length === 1 ? "" : "s"}</Badge>
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <label className="md:col-span-2">
                        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Preset a ejecutar</span>
                        <select
                          className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-400"
                          value={bridgeSchedulePresetIdDraft}
                          onChange={(event) => setBridgeSchedulePresetIdDraft(event.target.value)}
                        >
                          <option value="">Selecciona un preset bridge</option>
                          {bridgePresets.map((preset) => (
                            <option key={preset.id} value={preset.id}>
                              {preset.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Cron (6 campos)</span>
                        <input
                          className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-400"
                          value={bridgeScheduleCronDraft}
                          onChange={(event) => setBridgeScheduleCronDraft(event.target.value)}
                          placeholder="0 0 8 * * 1"
                        />
                      </label>
                      <label>
                        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Zona horaria</span>
                        <input
                          className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-400"
                          value={bridgeScheduleTimezoneDraft}
                          onChange={(event) => setBridgeScheduleTimezoneDraft(event.target.value)}
                          placeholder="America/Mexico_City"
                        />
                      </label>
                    </div>
                    <label className="mt-4 flex items-center gap-3 rounded-[1.2rem] border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-700">
                      <input type="checkbox" checked={bridgeScheduleActiveDraft} onChange={(event) => setBridgeScheduleActiveDraft(event.target.checked)} />
                      Dejar la agenda activa desde su creación
                    </label>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <Button type="button" className="rounded-full" disabled={createBridgeScheduleMutation.isPending || bridgePresets.length === 0} onClick={() => void handleCreateBridgeSchedule()}>
                        {createBridgeScheduleMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Clock3 className="mr-2 h-4 w-4" />}
                        Programar agenda
                      </Button>
                    </div>
                    <div className="mt-5 space-y-3">
                      {bridgeSchedules.length === 0 ? (
                        <div className="rounded-[1.2rem] border border-dashed border-slate-300 bg-slate-50/70 px-4 py-5 text-sm text-slate-500">
                          No hay agendas bridge registradas todavía. Guarda al menos un preset y programa su primer cron.
                        </div>
                      ) : (
                        bridgeSchedules.map((schedule) => (
                          <div key={schedule.id} className="rounded-[1.2rem] border border-slate-200 bg-slate-50/70 p-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-slate-950">{schedule.presetName ?? `Preset ${schedule.presetId}`}</p>
                                <p className="mt-1 text-xs text-slate-500">Cron {schedule.cronExpression} · {schedule.timezone}</p>
                              </div>
                              <Badge className={`rounded-full border ${schedule.isActive ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-100 text-slate-600"}`}>
                                {schedule.isActive ? "Activa" : "Pausada"}
                              </Badge>
                            </div>
                            <div className="mt-3 grid gap-2 text-xs text-slate-500 md:grid-cols-2">
                              <span>Próxima corrida: {formatDateTime(schedule.nextRunAt)}</span>
                              <span>Última corrida: {formatDateTime(schedule.lastRunAt)}</span>
                              <span>Estatus previo: {schedule.lastRunStatus ?? "Sin historial"}</span>
                              <span>Error previo: {schedule.lastRunError ?? "Sin error registrado"}</span>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                className="rounded-full bg-white"
                                disabled={updateBridgeScheduleMutation.isPending}
                                onClick={() => void handleToggleBridgeSchedule(schedule)}
                              >
                                {schedule.isActive ? "Pausar" : "Reactivar"}
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                className="rounded-full bg-white"
                                disabled={deleteBridgeScheduleMutation.isPending}
                                onClick={() => void handleDeleteBridgeSchedule(schedule)}
                              >
                                Eliminar
                              </Button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </article>
                </div>
              </section>

              <section className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
                <article className="rounded-[1.8rem] border border-white/70 bg-white/92 p-5 shadow-[0_24px_70px_-34px_rgba(15,23,42,0.18)]">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Historial smoke test</p>
                      <h3 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">Evolución reciente del carril bridge</h3>
                    </div>
                    <Badge className="rounded-full border border-slate-200 bg-slate-50 text-slate-700">
                      {formatNumber(bridgeSmokeHistorySummary.totalRuns)} corridas visibles
                    </Badge>
                  </div>
                  <div className="mt-5 space-y-3 rounded-[1.2rem] border border-dashed border-slate-200 bg-slate-50/70 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Filtros operativos</p>
                        <p className="mt-1 text-sm text-slate-500">Cruza estado, ventana temporal y severidad para aislar rápidamente si el problema es contractual o técnico.</p>
                      </div>
                      {(bridgeSmokeHistoryFilter !== "all" || bridgeSmokeTimeWindow !== "all" || bridgeSmokeSeverityFilter !== "all") ? (
                        <Button variant="ghost" className="rounded-full text-slate-700" onClick={clearBridgeSmokeFilters}>
                          <X className="mr-2 h-4 w-4" />
                          Limpiar vista smoke
                        </Button>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(["all", "passed", "failed", "error"] as const).map((filterOption) => {
                        const count =
                          filterOption === "all"
                            ? bridgeSmokeHistorySummary.totalRuns
                            : filterOption === "passed"
                              ? bridgeSmokeHistorySummary.passedRuns
                              : filterOption === "failed"
                                ? bridgeSmokeHistorySummary.failedRuns
                                : bridgeSmokeHistorySummary.errorRuns;

                        return (
                          <Button
                            key={filterOption}
                            type="button"
                            variant={bridgeSmokeHistoryFilter === filterOption ? "default" : "outline"}
                            className="rounded-full"
                            onClick={() => setBridgeSmokeHistoryFilter(filterOption)}
                          >
                            {getBridgeSmokeHistoryFilterLabel(filterOption)} · {formatNumber(count)}
                          </Button>
                        );
                      })}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(["all", "24h", "72h", "7d"] as const).map((timeWindowOption) => (
                        <Button
                          key={timeWindowOption}
                          type="button"
                          variant={bridgeSmokeTimeWindow === timeWindowOption ? "default" : "outline"}
                          className="rounded-full"
                          onClick={() => setBridgeSmokeTimeWindow(timeWindowOption)}
                        >
                          {getBridgeSmokeHistoryTimeWindowLabel(timeWindowOption)}
                        </Button>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(["all", "success", "warning", "critical"] as const).map((severityOption) => (
                        <Button
                          key={severityOption}
                          type="button"
                          variant={bridgeSmokeSeverityFilter === severityOption ? "default" : "outline"}
                          className="rounded-full"
                          onClick={() => setBridgeSmokeSeverityFilter(severityOption)}
                        >
                          {getBridgeSmokeHistorySeverityLabel(severityOption)}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="mt-5 flex flex-wrap gap-3 text-xs text-slate-500">
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">Éxito visible: {formatNumber(filteredBridgeSmokeHistorySummary.successRate)}%</span>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">Racha visible: {formatNumber(filteredBridgeSmokeHistorySummary.consecutiveFailures)}</span>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">Corridas 24h: {formatNumber(bridgeSmokeStatus?.summary.last24Hours ?? 0)}</span>
                  </div>
                  <div className="mt-5 grid gap-3 lg:grid-cols-2">
                    {[
                      { title: "Comparativo diario", data: bridgeSmokeComparisons.daily },
                      { title: "Comparativo semanal", data: bridgeSmokeComparisons.weekly },
                    ].map((comparison) => (
                      <article key={comparison.title} className="rounded-[1.3rem] border border-slate-200 bg-slate-50/80 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{comparison.title}</p>
                            <p className="mt-2 text-sm text-slate-600">{comparison.data.label}</p>
                          </div>
                          <Badge className="rounded-full border border-slate-200 bg-white text-slate-700">
                            {formatNumber(comparison.data.totalRuns)} corridas
                          </Badge>
                        </div>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          <div className="rounded-[1rem] border border-white bg-white/90 p-3">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Éxito actual</p>
                            <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{formatNumber(comparison.data.successRate)}%</p>
                            <p className={`mt-2 text-xs font-semibold ${comparison.data.successRateDelta >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                              {comparison.data.successRateDelta >= 0 ? "+" : ""}{formatNumber(comparison.data.successRateDelta)} pts vs ventana previa
                            </p>
                          </div>
                          <div className="rounded-[1rem] border border-white bg-white/90 p-3">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Volumen actual</p>
                            <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{formatNumber(comparison.data.totalRuns)}</p>
                            <p className={`mt-2 text-xs font-semibold ${comparison.data.totalDelta >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                              {comparison.data.totalDelta >= 0 ? "+" : ""}{formatNumber(comparison.data.totalDelta)} corridas vs ventana previa
                            </p>
                          </div>
                          <div className="rounded-[1rem] border border-white bg-white/90 p-3">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Conformes / contractuales</p>
                            <p className="mt-2 text-sm font-semibold text-slate-950">{formatNumber(comparison.data.passedRuns)} / {formatNumber(comparison.data.failedRuns)}</p>
                            <p className="mt-2 text-xs text-slate-500">
                              Δ {comparison.data.passedDelta >= 0 ? "+" : ""}{formatNumber(comparison.data.passedDelta)} conformes · Δ {comparison.data.failedDelta >= 0 ? "+" : ""}{formatNumber(comparison.data.failedDelta)} contractuales
                            </p>
                          </div>
                          <div className="rounded-[1rem] border border-white bg-white/90 p-3">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Errores técnicos / racha</p>
                            <p className="mt-2 text-sm font-semibold text-slate-950">{formatNumber(comparison.data.errorRuns)} / {formatNumber(comparison.data.consecutiveFailures)}</p>
                            <p className="mt-2 text-xs text-slate-500">
                              Δ {comparison.data.errorDelta >= 0 ? "+" : ""}{formatNumber(comparison.data.errorDelta)} errores · racha actual {formatNumber(comparison.data.consecutiveFailures)}
                            </p>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                  <div className="mt-5 rounded-[1.4rem] border border-slate-200 bg-white p-4 shadow-[0_18px_45px_-32px_rgba(15,23,42,0.2)]">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Tendencia visual</p>
                        <p className="mt-2 text-sm text-slate-600">Resume la relación entre corridas conformes e incidencias visibles en las ventanas diaria y semanal que también gobiernan la exportación actual.</p>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">Diario: {formatNumber(bridgeSmokeComparisons.daily.successRate)}%</span>
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">Semanal: {formatNumber(bridgeSmokeComparisons.weekly.successRate)}%</span>
                      </div>
                    </div>
                    <ChartContainer config={bridgeSmokeTrendChartConfig} className="mt-4 h-[260px] w-full">
                      <LineChart data={bridgeSmokeTrendChartData} margin={{ left: 8, right: 8, top: 12, bottom: 0 }}>
                        <CartesianGrid vertical={false} strokeDasharray="3 3" />
                        <XAxis dataKey="period" tickLine={false} axisLine={false} tickMargin={10} />
                        <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={34} />
                        <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" />} />
                        <ChartLegend content={<ChartLegendContent />} />
                        <Line type="monotone" dataKey="passedRuns" stroke="var(--color-passedRuns)" strokeWidth={3} dot={{ r: 4, strokeWidth: 0 }} activeDot={{ r: 5 }} />
                        <Line type="monotone" dataKey="issueRuns" stroke="var(--color-issueRuns)" strokeWidth={3} dot={{ r: 4, strokeWidth: 0 }} activeDot={{ r: 5 }} />
                      </LineChart>
                    </ChartContainer>
                  </div>
                  <div className="mt-5 space-y-3">
                    {filteredBridgeSmokeHistory.length > 0 ? (
                      filteredBridgeSmokeHistory.map((entry) => (
                        <article key={`${entry.testedAt ?? "sin-fecha"}-${entry.status}-${entry.runMode ?? "na"}`} className="rounded-[1.4rem] border border-slate-200 bg-slate-50/70 p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge className={`rounded-full border ${getBridgeSmokeHistoryStatusTone(entry.status)}`}>
                                  {getBridgeSmokeHistoryStatusLabel(entry.status)}
                                </Badge>
                                <Badge className={`rounded-full border ${getSeverityBadgeClass(getBridgeSmokeHistorySeverity(entry))}`}>
                                  {getBridgeSmokeHistorySeverityLabel(getBridgeSmokeHistorySeverity(entry))}
                                </Badge>
                                {entry.runMode ? (
                                  <Badge className="rounded-full border border-slate-200 bg-white text-slate-700">{entry.runMode}</Badge>
                                ) : null}
                              </div>
                              <p className="text-sm font-semibold text-slate-950">{entry.baseUrl || bridgeSmokeStatus?.baseUrl || "Base URL no registrada"}</p>
                              <p className="text-sm text-slate-600">{getBridgeSmokeHistoryContext(entry)}</p>
                              <p className="text-xs text-slate-500">{entry.testedAt ? formatDateTime(entry.testedAt) : "Fecha no disponible"}</p>
                            </div>
                            <div className="w-full min-w-0 rounded-2xl bg-white px-4 py-3 text-sm text-slate-600 sm:min-w-[220px]">
                              <p><strong className="text-slate-950">Health:</strong> {entry.healthStatus ?? "—"}</p>
                              <p><strong className="text-slate-950">Webhook:</strong> {entry.webhookStatus ?? "—"}</p>
                              <p><strong className="text-slate-950">Verificado:</strong> {entry.verified === null ? "Sin dato" : entry.verified ? "Sí" : "No"}</p>
                            </div>
                          </div>
                        </article>
                      ))
                    ) : (
                      <div className="rounded-[1.4rem] border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-sm text-slate-500">
                        {bridgeSmokeStatusQuery.isLoading
                          ? "Cargando historial reciente del smoke test bridge..."
                          : "Todavía no hay corridas persistidas que coincidan con el filtro actual."}
                      </div>
                    )}
                  </div>
                </article>

                <article className="rounded-[1.8rem] border border-white/70 bg-white/92 p-5 shadow-[0_24px_70px_-34px_rgba(15,23,42,0.18)]">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Reporte ejecutivo bridge</p>
                      <h3 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">Lectura consolidada del smoke test</h3>
                    </div>
                    <Clock3 className="h-5 w-5 text-slate-400" />
                  </div>
                  <div className="mt-5 rounded-[1.4rem] border border-slate-200 bg-slate-50/80 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Últimas 10 corridas</p>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                      <span className="rounded-full border border-white bg-white px-3 py-1.5">Estado operativo: {bridgeSmokeAlerting?.statusLabel ?? "Sin alertas activas"}</span>
                      <span className="rounded-full border border-white bg-white px-3 py-1.5">Umbral: {formatNumber(bridgeSmokeAlerting?.threshold ?? 0)}</span>
                      <span className="rounded-full border border-white bg-white px-3 py-1.5">Racha actual: {formatNumber(bridgeSmokeAlerting?.lastObservedConsecutiveFailures ?? 0)}</span>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {bridgeSmokeTrend.length > 0 ? (
                        bridgeSmokeTrend.map((entry) => (
                          <span
                            key={`${entry.testedAt ?? "sin-fecha"}-${entry.status}-trend`}
                            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs ${getBridgeSmokeHistoryStatusTone(entry.status)}`}
                            title={entry.testedAt ? formatDateTime(entry.testedAt) : "Fecha no disponible"}
                          >
                            <span className="h-2 w-2 rounded-full bg-current" />
                            {entry.testedAt ? new Intl.DateTimeFormat("es-MX", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" }).format(new Date(entry.testedAt)) : "Sin fecha"}
                          </span>
                        ))
                      ) : (
                        <p className="text-sm text-slate-500">La tendencia aparecerá cuando el smoke test deje corridas persistidas en JSONL.</p>
                      )}
                    </div>
                  </div>
                  <div className="mt-4 space-y-3 text-sm text-slate-600">
                    <div
                      data-testid="bridge-smoke-trend-state"
                      className={`rounded-[1.4rem] border p-4 ${bridgeSmokeAlertTone.card}`}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={`rounded-full border ${bridgeSmokeAlertTone.badge}`}>{bridgeSmokeAlerting?.statusLabel ?? "Sin alertas activas"}</Badge>
                        <Badge className="rounded-full border border-white/80 bg-white/90 text-slate-700">{getBridgeSmokeAlertVisualStateLabel(bridgeSmokeAlerting?.visualState ?? "stable")}</Badge>
                      </div>
                      <p className="mt-2 text-2xl font-semibold tracking-tight">{bridgeSmokeHistorySummary.latestStatus ? getBridgeSmokeHistoryStatusLabel(bridgeSmokeHistorySummary.latestStatus) : "Sin historial"}</p>
                      <p className="mt-2">{bridgeSmokeAlerting?.detail ?? "Útil para confirmar si el carril cayó por error técnico o por incumplimiento contractual del ack."}</p>
                      <p className="mt-2 text-xs opacity-80">{bridgeSmokeAlertTimestamp}</p>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-[1.4rem] border border-slate-200 bg-slate-50/80 p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Errores técnicos</p>
                        <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{formatNumber(bridgeSmokeExecutiveSummary.technicalErrors)}</p>
                        <p className="mt-2">Aquí caen timeouts, lecturas nulas o caídas del endpoint antes de validar el contrato.</p>
                      </div>
                      <div className="rounded-[1.4rem] border border-slate-200 bg-slate-50/80 p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Fallos contractuales</p>
                        <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{formatNumber(bridgeSmokeExecutiveSummary.contractualFailures)}</p>
                        <p className="mt-2">Señal para revisar divergencias entre health, webhook y ack esperado 200/202.</p>
                      </div>
                      <div className="rounded-[1.4rem] border border-slate-200 bg-slate-50/80 p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Corridas conformes</p>
                        <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{formatNumber(bridgeSmokeExecutiveSummary.conformingRuns)}</p>
                        <p className="mt-2">Útil para medir continuidad operativa sin abrir el detalle completo del historial.</p>
                      </div>
                      <div className="rounded-[1.4rem] border border-slate-200 bg-slate-50/80 p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Última recuperación visible</p>
                        <p className="mt-2 text-lg font-semibold tracking-tight text-slate-950">
                          {bridgeSmokeExecutiveSummary.lastPassingRun?.testedAt ? formatDateTime(bridgeSmokeExecutiveSummary.lastPassingRun.testedAt) : "Sin recuperación visible"}
                        </p>
                        <p className="mt-2">Marca la última corrida conforme registrada para comunicar recuperación en comités operativos.</p>
                      </div>
                    </div>
                  </div>
                </article>
              </section>

              <section className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
                <article className="rounded-[1.8rem] border border-white/70 bg-white/92 p-5 shadow-[0_24px_70px_-34px_rgba(15,23,42,0.18)]">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Cola priorizada</p>
                      <h3 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">Expedientes que requieren revisión</h3>
                    </div>
                    <Badge className="rounded-full border border-slate-200 bg-slate-50 text-slate-700">
                      {formatNumber(bridgeOverview.issues.length)} en foco
                    </Badge>
                  </div>
                  <div className="mt-5 space-y-3">
                    {bridgeOverview.issues.length > 0 ? (
                      bridgeOverview.issues.map((item) => (
                        <article key={item.documentId} className="rounded-[1.4rem] border border-slate-200 bg-slate-50/70 p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge className={`rounded-full border ${getBridgeHealthBadgeClass(item.health)}`}>{item.health}</Badge>
                                <Badge className="rounded-full border border-slate-200 bg-white text-slate-700">{getBridgeOutcomeLabel(item.outcomeCategory)}</Badge>
                                {item.openAlertCount > 0 ? (
                                  <Badge className="rounded-full border border-amber-200 bg-amber-50 text-amber-700">
                                    {formatNumber(item.openAlertCount)} alerta{item.openAlertCount === 1 ? "" : "s"}
                                  </Badge>
                                ) : null}
                              </div>
                              <p className="text-lg font-semibold text-slate-950">{item.documentName || item.documentId}</p>
                              <p className="text-sm text-slate-600">
                                {item.tenantName} · {item.caseTitle || item.caseId || "Sin caso asociado"}
                              </p>
                              <p className="text-sm text-slate-500">
                                Último evento: {formatDateTime(item.lastActivityAt)} · Intentos {formatNumber(item.attempts)}
                              </p>
                              {item.guardrailReason || item.errorMessage ? (
                                <p className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                                  <strong>Detalle:</strong> {item.guardrailReason || item.errorMessage}
                                </p>
                              ) : null}
                              {item.warnings.length > 0 ? (
                                <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
                                  <strong className="text-slate-950">Warnings:</strong> {item.warnings.join(" · ")}
                                </div>
                              ) : null}
                            </div>
                            <div className="w-full min-w-0 rounded-2xl bg-white px-4 py-3 text-sm text-slate-600 sm:min-w-[250px]">
                              <p><strong className="text-slate-950">Trace:</strong> {item.traceId || "Sin traza"}</p>
                              <p><strong className="text-slate-950">CompliLink ID:</strong> {item.compliLinkId || "Pendiente"}</p>
                              <p><strong className="text-slate-950">Dispatch:</strong> {formatDateTime(item.dispatchedAt)}</p>
                              <p><strong className="text-slate-950">Retorno:</strong> {formatDateTime(item.returnedAt)}</p>
                              <p><strong className="text-slate-950">HTTP:</strong> {item.httpStatusCode ?? "Sin respuesta"}</p>
                            </div>
                          </div>
                        </article>
                      ))
                    ) : (
                      <div className="rounded-[1.4rem] border border-dashed border-emerald-200 bg-emerald-50/70 px-5 py-8 text-sm text-emerald-900">
                        No hay expedientes bridge con atención inmediata en la vista actual.
                      </div>
                    )}
                  </div>
                </article>

                <article className="rounded-[1.8rem] border border-white/70 bg-white/92 p-5 shadow-[0_24px_70px_-34px_rgba(15,23,42,0.18)]">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Señales operativas</p>
                      <h3 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">Lectura rápida del carril bridge</h3>
                    </div>
                    <GitBranch className="h-5 w-5 text-slate-400" />
                  </div>
                  <div className="mt-5 space-y-3 text-sm text-slate-600">
                    <div className="rounded-[1.4rem] border border-slate-200 bg-slate-50/80 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Pendientes de retorno</p>
                      <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{formatNumber(bridgeOverview.summary.pending)}</p>
                      <p className="mt-2">Útil para detectar cuellos de botella entre dispatch y webhook final.</p>
                    </div>
                    <div className="rounded-[1.4rem] border border-slate-200 bg-slate-50/80 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Reintentos o warnings</p>
                      <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{formatNumber(bridgeOverview.summary.warning)}</p>
                      <p className="mt-2">Revisa especialmente expedientes con múltiples intentos y alertas abiertas de integridad.</p>
                    </div>
                    <div className="rounded-[1.4rem] border border-slate-200 bg-slate-50/80 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Fallo permanente</p>
                      <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{formatNumber(bridgeOverview.summary.critical)}</p>
                      <p className="mt-2">Prioridad máxima para soporte operativo o corrección manual del expediente.</p>
                    </div>
                  </div>
                </article>
              </section>

              <section className="rounded-[1.8rem] border border-white/70 bg-white/92 p-5 shadow-[0_24px_70px_-34px_rgba(15,23,42,0.18)]">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Actividad reciente</p>
                    <h3 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">Timeline resumido por expediente</h3>
                  </div>
                  <Badge className="rounded-full border border-slate-200 bg-slate-50 text-slate-700">
                    Ordenado por evento más reciente
                  </Badge>
                </div>
                <div className="mt-5 overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead>
                      <tr className="text-left text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                        <th className="pb-3 pr-4">Documento</th>
                        <th className="pb-3 pr-4">Tenant / caso</th>
                        <th className="pb-3 pr-4">Estado</th>
                        <th className="pb-3 pr-4">Resultado</th>
                        <th className="pb-3 pr-4">Intentos</th>
                        <th className="pb-3 pr-4">Último evento</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {bridgeOverview.rows.length > 0 ? (
                        bridgeOverview.rows.map((item) => (
                          <tr key={item.documentId} className="align-top text-slate-600">
                            <td className="py-4 pr-4">
                              <p className="font-semibold text-slate-950">{item.documentName || item.documentId}</p>
                              <p className="mt-1 text-xs text-slate-500">{item.traceId || "Sin traza"}</p>
                            </td>
                            <td className="py-4 pr-4">
                              <p>{item.tenantName}</p>
                              <p className="mt-1 text-xs text-slate-500">{item.caseTitle || item.caseId || "Sin caso asociado"}</p>
                            </td>
                            <td className="py-4 pr-4">
                              <Badge className={`rounded-full border ${getBridgeHealthBadgeClass(item.health)}`}>{item.health}</Badge>
                            </td>
                            <td className="py-4 pr-4">{getBridgeOutcomeLabel(item.outcomeCategory)}</td>
                            <td className="py-4 pr-4">{formatNumber(item.attempts)}</td>
                            <td className="py-4 pr-4">{formatDateTime(item.lastActivityAt)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="py-10 text-center text-sm text-slate-500">
                            Aún no hay actividad del bridge disponible para los filtros seleccionados.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          ) : null}

          {currentSection === "alertas" ? (
            <section className="rounded-[1.8rem] border border-white/70 bg-white/92 p-5 shadow-[0_24px_70px_-34px_rgba(15,23,42,0.18)]">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Alertas accionables</p>
                  <h3 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">Vista ejecutiva de alertas</h3>
                </div>
                <Badge className="rounded-full border border-rose-200 bg-rose-50 text-rose-700">
                  {formatNumber(snapshotData.recentAlerts.length)} visibles
                </Badge>
              </div>
              <div className="mt-5 space-y-3">
                {snapshotData.recentAlerts.length > 0 ? (
                  snapshotData.recentAlerts.map((alert) => {
                    const actionLabel = getSafeAlertActionLabel(alert.status);
                    return (
                      <article key={alert.id} className="rounded-[1.4rem] border border-slate-200 bg-slate-50/70 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge className={`rounded-full border ${getSeverityBadgeClass(alert.severity)}`}>{alert.severity}</Badge>
                              <Badge className={`rounded-full border ${getStatusBadgeClass(alert.status)}`}>{getAlertStatusLabel(alert.status)}</Badge>
                              <span className="text-xs uppercase tracking-[0.16em] text-slate-400">{alert.category}</span>
                            </div>
                            <h4 className="text-lg font-semibold text-slate-950">{alert.title}</h4>
                            <p className="max-w-3xl text-sm leading-6 text-slate-600">{alert.description || "Sin descripción adicional."}</p>
                          </div>
                          <div className="w-full min-w-0 rounded-2xl bg-white px-4 py-3 text-sm text-slate-600 sm:min-w-[260px]">
                            <p><strong className="text-slate-950">Tenant:</strong> {alert.tenantName}</p>
                            <p><strong className="text-slate-950">Caso:</strong> {alert.caseTitle || alert.caseId || "Sin caso"}</p>
                            <p><strong className="text-slate-950">Trace ID:</strong> {alert.traceId || "Sin trace visible"}</p>
                            <p><strong className="text-slate-950">Detectada:</strong> {formatDateTime(alert.raisedAt)}</p>
                            <p><strong className="text-slate-950">Último movimiento:</strong> {formatDateTime(alert.updatedAt)}</p>
                            <p><strong className="text-slate-950">Seguimiento:</strong> {getAlertProgressLabel(alert.status, alert.updatedAt)}</p>
                            <p><strong className="text-slate-950">Resuelta:</strong> {formatDateTime(alert.resolvedAt)}</p>
                            <div className="mt-3">
                              {actionLabel ? (
                                <Button
                                  className="w-full rounded-full"
                                  size="sm"
                                  disabled={executiveActionsBlocked || isAlertBusy(alert.id)}
                                  onClick={() => {
                                    requestAlertAction(alert.id, alert.title, alert.status);
                                  }}
                                >
                                  {isAlertBusy(alert.id) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                  {actionLabel}
                                </Button>
                              ) : (
                                <p className="text-xs text-slate-400">Esta alerta ya no tiene una transición segura disponible.</p>
                              )}
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  })
                ) : (
                  <SectionEmptyState
                    title="No se encontraron alertas con estos filtros"
                    description="Puedes relajar la severidad, ampliar el rango temporal o eliminar la búsqueda actual para volver a ver incidentes abiertos o atendidos."
                    onClear={clearAllFilters}
                  />
                )}
              </div>
            </section>
          ) : null}

          {currentSection === "accesos" ? (
            <section className="rounded-[1.8rem] border border-white/70 bg-white/92 p-5 shadow-[0_24px_70px_-34px_rgba(15,23,42,0.18)]">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Membresías activas</p>
                  <h3 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">Accesos por tenant y por caso</h3>
                </div>
                <Badge className="rounded-full border border-cyan-200 bg-cyan-50 text-cyan-700">
                  {formatNumber(snapshotData.recentMemberships.length)} visibles
                </Badge>
              </div>
              <div className="mt-5 grid gap-3">
                {snapshotData.recentMemberships.length > 0 ? (
                  snapshotData.recentMemberships.map((membership) => {
                    const action = getSafeMembershipAction(membership);
                    const userLabel = membership.userName || membership.userEmail || `Usuario ${membership.userId}`;
                    return (
                      <article key={membership.id} className="grid gap-4 rounded-[1.4rem] border border-slate-200 bg-slate-50/70 p-4 lg:grid-cols-[minmax(0,1fr)_auto]">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-lg font-semibold text-slate-950">{userLabel}</p>
                            <Badge className={`rounded-full border ${getStatusBadgeClass(membership.status)}`}>{membership.status}</Badge>
                            <Badge className="rounded-full border border-slate-200 bg-white text-slate-700">{membership.role}</Badge>
                            <Badge className="rounded-full border border-slate-200 bg-white text-slate-700">{membership.accessScope}</Badge>
                          </div>
                          <p className="text-sm text-slate-600">{membership.userEmail || "Sin correo visible"}</p>
                          <p className="text-sm text-slate-600">
                            <strong className="text-slate-950">Tenant:</strong> {membership.tenantName}
                            {membership.caseTitle || membership.caseId ? (
                              <>
                                {" · "}
                                <strong className="text-slate-950">Caso:</strong> {membership.caseTitle || membership.caseId}
                              </>
                            ) : null}
                          </p>
                        </div>
                        <div className="w-full min-w-0 rounded-2xl bg-white px-4 py-3 text-sm text-slate-600 sm:min-w-[260px]">
                          <p><strong className="text-slate-950">Creado:</strong> {formatDateTime(membership.createdAt)}</p>
                          <p><strong className="text-slate-950">Actualizado:</strong> {formatDateTime(membership.updatedAt)}</p>
                          <p><strong className="text-slate-950">Usuario ID:</strong> {membership.userId}</p>
                          <div className="mt-3">
                            {action ? (
                              <Button
                                variant="outline"
                                className="w-full rounded-full bg-white"
                                size="sm"
                                disabled={executiveActionsBlocked || isMembershipBusy(membership.id)}
                                onClick={() => {
                                  requestMembershipAction(membership.id, membership, userLabel);
                                }}
                              >
                                {isMembershipBusy(membership.id) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                {action.label}
                              </Button>
                            ) : (
                              <p className="text-xs text-slate-400">Sólo los accesos acotados a un caso pueden operarse desde este bloque seguro.</p>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })
                ) : (
                  <SectionEmptyState
                    title="No se encontraron accesos con el filtro actual"
                    description="Prueba limpiar el usuario, el caso o la búsqueda transversal para volver a revisar membresías y permisos vigentes."
                    onClear={clearAllFilters}
                  />
                )}
              </div>
            </section>
          ) : null}

          {currentSection === "documentos" ? (
            <section className="rounded-[1.8rem] border border-white/70 bg-white/92 p-5 shadow-[0_24px_70px_-34px_rgba(15,23,42,0.18)]">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Trazabilidad documental</p>
                  <h3 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">Versionado y supersedencia visible</h3>
                </div>
                <Badge className="rounded-full border border-amber-200 bg-amber-50 text-amber-700">
                  {formatNumber(snapshotData.recentDocuments.length)} visibles
                </Badge>
              </div>
              <div className="mt-5 space-y-3">
                {snapshotData.recentDocuments.length > 0 ? (
                  snapshotData.recentDocuments.map((document) => (
                    <article key={document.documentId} className="rounded-[1.4rem] border border-slate-200 bg-slate-50/70 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="max-w-3xl space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge className={`rounded-full border ${getStatusBadgeClass(document.integrityStatus)}`}>{document.integrityStatus}</Badge>
                            <Badge className="rounded-full border border-slate-200 bg-white text-slate-700">{document.documentType}</Badge>
                            <Badge className="rounded-full border border-slate-200 bg-white text-slate-700">{document.visibility}</Badge>
                          </div>
                          <h4 className="text-lg font-semibold text-slate-950">{document.originalName}</h4>
                          <p className="text-sm text-slate-600">
                            <strong className="text-slate-950">Tenant:</strong> {document.tenantName}
                            {" · "}
                            <strong className="text-slate-950">Caso:</strong> {document.caseTitle || document.caseId}
                          </p>
                          <p className="text-sm text-slate-600">
                            <strong className="text-slate-950">Trace ID:</strong> {document.traceId}
                            {" · "}
                            <strong className="text-slate-950">Confianza:</strong>{" "}
                            {typeof document.classificationConfidence === "number"
                              ? `${Math.round(document.classificationConfidence * 100)}%`
                              : "N/D"}
                          </p>
                          <p className="text-sm text-slate-600">
                            <strong className="text-slate-950">Consentimiento:</strong> {document.consentStatus}
                          </p>
                        </div>
                        <div className="w-full min-w-0 rounded-2xl bg-white px-4 py-3 text-sm text-slate-600 sm:min-w-[280px]">
                          <p><strong className="text-slate-950">Creado:</strong> {formatDateTime(document.createdAt)}</p>
                          <p><strong className="text-slate-950">Actualizado:</strong> {formatDateTime(document.updatedAt)}</p>
                          <p><strong className="text-slate-950">Supersede a:</strong> {document.supersededDocument?.originalName || document.supersedesDocumentId || "No aplica"}</p>
                          <p><strong className="text-slate-950">Estado previo:</strong> {document.supersededDocument?.integrityStatus || "—"}</p>
                        </div>
                      </div>
                    </article>
                  ))
                ) : (
                  <SectionEmptyState
                    title="No hay documentos que coincidan con esta búsqueda"
                    description="Puedes quitar el filtro por caso, relajar la ventana temporal o eliminar la búsqueda para volver a explorar el versionado documental."
                    onClear={clearAllFilters}
                  />
                )}
              </div>
            </section>
          ) : null}
        </div>
      )}
      <AlertDialog
        open={Boolean(pendingHeliosConfirmationPrompt)}
        onOpenChange={(open) => {
          if (!open) setPendingHeliosConfirmationPrompt(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar consulta sensible a Helios</AlertDialogTitle>
            <AlertDialogDescription>
              Helios no ejecutará cambios desde esta respuesta. Primero devolverá una propuesta trazable, separando lo confirmado, lo inferido y lo pendiente. Si el pedido rebasa permisos o carril seguro, degradará a modo consulta.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {pendingHeliosConfirmationPrompt ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm leading-6 text-slate-700">
              <p>
                <strong className="text-slate-950">Consulta a confirmar:</strong> {pendingHeliosConfirmationPrompt}
              </p>
              <p className="mt-2 text-slate-600">La respuesta saldrá con confirmación visible antes de cualquier siguiente paso sensible.</p>
            </div>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleConfirmHeliosCeoMessage()}>
              Confirmar consulta CEO
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={Boolean(pendingExecutiveAction)}
        onOpenChange={(open) => {
          if (!open) setPendingExecutiveAction(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingExecutiveAction?.kind === "case"
                ? "Confirmar avance operativo"
                : pendingExecutiveAction?.kind === "membership"
                  ? "Confirmar cambio de acceso"
                  : "Confirmar actualización de alerta"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              La consola ejecutará esta acción sólo si el backend confirma que el estado visible sigue vigente. Si la vista cambió o perdió frescura, la operación se bloqueará.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {pendingExecutiveAction ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-700">
              <p>
                <strong className="text-slate-950">Acción:</strong> {pendingExecutiveAction.actionLabel}
              </p>
              <p>
                <strong className="text-slate-950">Estado visible:</strong> {getAlertStatusLabel(pendingExecutiveAction.currentStatus)}
              </p>
              <p>
                <strong className="text-slate-950">Contexto:</strong>{" "}
                {pendingExecutiveAction.kind === "case"
                  ? `${pendingExecutiveAction.title} · ${pendingExecutiveAction.caseId}`
                  : pendingExecutiveAction.kind === "membership"
                    ? pendingExecutiveAction.userLabel
                    : pendingExecutiveAction.title}
              </p>
              <p className="mt-2 text-xs text-slate-500">
                {executiveGuardrailDescription}
              </p>
            </div>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isConfirmingExecutiveAction}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={isConfirmingExecutiveAction || executiveActionsBlocked}
              onClick={() => {
                if (pendingExecutiveAction) {
                  void executePendingExecutiveAction(pendingExecutiveAction);
                }
              }}
            >
              {isConfirmingExecutiveAction ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Confirmar y registrar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <HeliosCopilotSheet
        open={isHeliosSheetOpen}
        onOpenChange={setIsHeliosSheetOpen}
        onSendMessage={(content) => {
          void handleSendHeliosCeoMessage(content);
        }}
        messages={heliosMessages}
        isLoading={ceoHeliosMutation.isPending}
        suggestedPrompts={ceoHeliosSuggestedPrompts}
        caseTitle="Helios · modo CEO"
        employeeName={snapshotData?.summary.activeCases ? `${formatNumber(snapshotData.summary.activeCases)} expedientes activos` : undefined}
        confidenceScore={ceoHeliosMutation.data?.confidenceScore ?? 94}
        disclaimer={ceoHeliosMutation.data?.disclaimer}
        summary={ceoHeliosMutation.data?.summary ?? ceoHeliosSummary}
        historyItems={ceoHeliosMutation.data?.historyItems}
        supportingDocuments={ceoHeliosMutation.data?.supportingDocuments}
        uiCopy={{
          eyebrow: "Helios · modo CEO activo",
          title: "Dame una instrucción y Helios te responde separando lo confirmado, lo inferido y lo pendiente.",
          description:
            "Aquí conservas la misma inteligencia laboral de Helios y, como CEO, sumas contexto ejecutivo sobre alertas, accesos, documentos y señales del sistema visibles en esta consola. Si una petición es sensible, Helios la deja primero como propuesta sujeta a confirmación.",
          documentBadge: "Basado en snapshot ejecutivo, alertas, permisos y documentos visibles",
          capabilityBadge: "Puede priorizar riesgos, explicar contexto legal, degradar por permisos y sugerir instrucciones operativas seguras",
          quickHighlights: [
            "Qué está confirmado ahora",
            "Qué riesgo patronal pesa más",
            "Qué instrucción requiere confirmación",
          ],
          promptsHeading: "Atajos ejecutivos de Helios",
          historyHeading: "Contexto ejecutivo disponible",
          supportingHeading: "Lo que Helios sí está leyendo",
          placeholder: "Pide una prioridad, una lectura jurídica o una instrucción operativa; Helios te dirá qué requiere confirmación",
          emptyStateMessage:
            "Helios ya está listo en modo CEO: conserva todo su criterio laboral, marca lo confirmado frente a lo pendiente y baja a modo consulta si algo no está autorizado o trazado.",
          closeLabel: "Volver al modo CEO",
        }}
      />
    </DashboardLayout>
  );
}

import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout, { type DashboardNavigationItem } from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { downloadCeoCsvReport, downloadCeoPdfReport } from "@/pages/ceoDashboardExports";
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  Files,
  Filter,
  LayoutDashboard,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  ShieldX,
  Siren,
  UsersRound,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast as sonnerToast } from "sonner";
import { useLocation } from "wouter";

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

function getSafeNextAlertStatus(status: string) {
  if (status === "open") return "acknowledged" as const;
  if (status === "acknowledged") return "resolved" as const;
  return null;
}

function getSafeAlertActionLabel(status: string) {
  if (status === "open") return "Acusar recibo";
  if (status === "acknowledged") return "Marcar resuelta";
  return null;
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
  if (membership.status === "revoked") {
    return { status: "active" as const, label: "Reactivar acceso" };
  }
  return null;
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

type SectionKey = "resumen" | "alertas" | "accesos" | "documentos";

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
  if (section === "alertas") return "Alertas";
  if (section === "accesos") return "Accesos";
  if (section === "documentos") return "Documentos";
  return "Resumen CEO";
}

export default function CeoDashboard() {
  const { user } = useAuth({ redirectOnUnauthenticated: true, redirectPath: "/ceo" });
  const [location, setLocation] = useLocation();
  const isAdmin = user?.role === "admin";
  const utils = trpc.useUtils();
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTER_STATE);
  const [queryDraft, setQueryDraft] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [exportKind, setExportKind] = useState<"csv" | "pdf" | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedQuery(queryDraft.trim());
    }, 300);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [queryDraft]);

  const currentSection = useMemo<SectionKey>(() => {
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
      dateWindowDays?: number;
      query?: string;
    } = {};

    if (filters.tenantId !== "all") input.tenantId = filters.tenantId;
    if (filters.severity !== "all") input.severity = filters.severity;
    if (filters.caseId !== "all") input.caseId = filters.caseId;
    if (filters.userId !== "all") input.userId = Number(filters.userId);
    if (filters.dateWindowDays !== "all") input.dateWindowDays = Number(filters.dateWindowDays);
    if (debouncedQuery.length > 0) input.query = debouncedQuery;

    return input;
  }, [debouncedQuery, filters]);

  const hasActiveFilters = Object.keys(snapshotFilters).length > 0;

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

  const snapshotData = hasActiveFilters ? filteredSnapshotQuery.data : baseSnapshotQuery.data;
  const snapshotError = hasActiveFilters ? filteredSnapshotQuery.error : baseSnapshotQuery.error;
  const isInitialLoading = !baseSnapshotQuery.data && baseSnapshotQuery.isLoading;
  const isFilterLoading = hasActiveFilters && !filteredSnapshotQuery.data && filteredSnapshotQuery.isLoading;
  const isRefreshing = baseSnapshotQuery.isFetching || filteredSnapshotQuery.isFetching;

  const alertMutation = trpc.dashboard.ceoUpdateAlertStatus.useMutation();
  const membershipMutation = trpc.dashboard.ceoUpdateMembershipStatus.useMutation();
  const caseMutation = trpc.dashboard.ceoProgressCaseStage.useMutation();

  const globalSummary = baseSnapshotQuery.data?.summary;

  const navigation = useMemo<DashboardNavigationItem[]>(
    () => [
      {
        icon: LayoutDashboard,
        label: "Resumen CEO",
        path: "/ceo",
        badge: globalSummary ? formatNumber(globalSummary.activeCases) : undefined,
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
        path: "/ceo/documentos",
        badge: globalSummary ? formatNumber(globalSummary.pendingDocuments) : undefined,
      },
    ],
    [globalSummary],
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

  const currentSectionCount = useMemo(() => getCurrentSectionCount(currentSection, snapshotData), [currentSection, snapshotData]);

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

  const isAlertBusy = (alertId: number) => alertMutation.isPending && alertMutation.variables?.alertId === alertId;
  const isMembershipBusy = (membershipId: number) =>
    membershipMutation.isPending && membershipMutation.variables?.membershipId === membershipId;
  const isCaseBusy = (tenantId: string, caseId: string) =>
    caseMutation.isPending && caseMutation.variables?.tenantId === tenantId && caseMutation.variables?.caseId === caseId;

  async function refreshSnapshotWithSuccess(title: string, description: string) {
    await utils.dashboard.ceoSnapshot.invalidate();
    sonnerToast.success(title, { description });
  }

  async function handleRefresh() {
    await utils.dashboard.ceoSnapshot.invalidate();
  }

  async function handleAlertAction(alertId: number, title: string, status: string) {
    const nextStatus = getSafeNextAlertStatus(status);
    const actionLabel = getSafeAlertActionLabel(status);
    if (!nextStatus || !actionLabel) return;

    try {
      await alertMutation.mutateAsync({ alertId, status: nextStatus });
      await refreshSnapshotWithSuccess("Alerta actualizada", `${title}: ${actionLabel.toLowerCase()} y traza registrada.`);
    } catch (error) {
      sonnerToast.error("No fue posible actualizar la alerta", {
        description: error instanceof Error ? error.message : "Intenta nuevamente en unos segundos.",
      });
    }
  }

  async function handleMembershipAction(
    membershipId: number,
    membership: { status: string; accessScope: string; caseId?: string | null },
    userLabel: string,
  ) {
    const action = getSafeMembershipAction(membership);
    if (!action) return;

    try {
      await membershipMutation.mutateAsync({ membershipId, status: action.status });
      await refreshSnapshotWithSuccess("Acceso actualizado", `${userLabel}: ${action.label.toLowerCase()} con trazabilidad ejecutiva.`);
    } catch (error) {
      sonnerToast.error("No fue posible actualizar el acceso", {
        description: error instanceof Error ? error.message : "Intenta nuevamente en unos segundos.",
      });
    }
  }

  async function handleCaseAction(tenantId: string, caseId: string, title: string, status: string) {
    const nextStatus = getSafeNextCaseStatus(status);
    const actionLabel = getSafeCaseActionLabel(status);
    if (!nextStatus || !actionLabel) return;

    try {
      await caseMutation.mutateAsync({ tenantId, caseId, status: nextStatus });
      await refreshSnapshotWithSuccess("Caso actualizado", `${title}: ${actionLabel.toLowerCase()} y bitácora registrada.`);
    } catch (error) {
      sonnerToast.error("No fue posible confirmar el avance del caso", {
        description: error instanceof Error ? error.message : "Intenta nuevamente en unos segundos.",
      });
    }
  }

  async function handleExport(kind: "csv" | "pdf") {
    if (!snapshotData) {
      sonnerToast.error("La exportación aún no está disponible", {
        description: "Espera a que el snapshot ejecutivo termine de cargar para generar el reporte.",
      });
      return;
    }

    const actorLabel = user?.name || user?.email || "Operación ejecutiva";
    const appliedFilters = activeFilterChips.map((chip) => chip.label);

    try {
      setExportKind(kind);
      const filename =
        kind === "pdf"
          ? downloadCeoPdfReport({
              section: currentSection,
              snapshot: snapshotData,
              appliedFilters,
              actorLabel,
            })
          : downloadCeoCsvReport({
              section: currentSection,
              snapshot: snapshotData,
              appliedFilters,
              actorLabel,
            });

      sonnerToast.success(kind === "pdf" ? "Reporte PDF generado" : "Reporte CSV generado", {
        description: `${filename} se descargó con la vista actual y los filtros aplicados.`,
      });
    } catch (error) {
      sonnerToast.error("No fue posible generar el reporte ejecutivo", {
        description: error instanceof Error ? error.message : "Intenta nuevamente en unos segundos.",
      });
    } finally {
      setExportKind(null);
    }
  }

  return (
    <DashboardLayout
      title="Dashboard CEO"
      subtitle="Centro de mando ejecutivo para AuditaPatron"
      navigation={navigation}
      headerActions={
        <>
          <Button
            variant="outline"
            className="rounded-full bg-white"
            disabled={!snapshotData || exportKind !== null}
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
            disabled={!snapshotData || exportKind !== null}
            onClick={() => {
              void handleExport("pdf");
            }}
          >
            {exportKind === "pdf" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
            Reporte PDF
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
      {!isAdmin ? (
        <section className="rounded-[2rem] border border-amber-200 bg-amber-50/90 p-8 shadow-[0_24px_70px_-34px_rgba(146,64,14,0.18)]">
          <div className="flex flex-wrap items-start gap-4">
            <div className="rounded-2xl bg-white p-3 text-amber-700 shadow-sm">
              <ShieldX className="h-6 w-6" />
            </div>
            <div className="max-w-3xl space-y-3">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-700">Acceso restringido</p>
              <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
                Esta consola ejecutiva sólo está disponible para perfiles administradores.
              </h2>
              <p className="text-base leading-7 text-slate-700">
                Tu sesión está autenticada, pero no tiene permisos para visualizar el tablero global del CEO. Si este
                acceso debe habilitarse, actualiza el rol del usuario a <strong>admin</strong> desde la administración
                interna.
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
          <section className="rounded-[2rem] border border-white/70 bg-[linear-gradient(135deg,rgba(15,23,42,0.98),rgba(15,118,110,0.9))] p-6 text-white shadow-[0_34px_90px_-42px_rgba(15,23,42,0.56)]">
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div className="max-w-3xl space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-teal-100/85">Consola ejecutiva</p>
                <h2 className="text-3xl font-semibold tracking-tight">Visibilidad integral para operar AuditaPatron sin fricción.</h2>
                <p className="max-w-2xl text-sm leading-7 text-slate-100/90">
                  Este tablero concentra salud operativa, alertas, accesos por caso y trazabilidad documental en una sola
                  superficie para tomar decisiones rápidas con contexto y control.
                </p>
              </div>
              <div className="min-w-[240px] rounded-[1.5rem] border border-white/15 bg-white/10 p-4 backdrop-blur">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-100/80">Última actualización</p>
                <p className="mt-2 text-lg font-semibold">{formatDateTime(snapshotData.generatedAt)}</p>
                <p className="mt-2 text-sm leading-6 text-slate-100/80">
                  Usuario actual: <strong>{user?.name || user?.email || "Administrador"}</strong>
                </p>
                <p className="mt-2 text-xs leading-5 text-slate-200/80">
                  Vista actual: <strong>{getSectionLabel(currentSection)}</strong>
                  {hasActiveFilters ? ` · ${formatNumber(currentSectionCount)} coincidencias visibles` : " · sin filtros activos"}
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-[1.8rem] border border-white/70 bg-white/92 p-5 shadow-[0_24px_70px_-34px_rgba(15,23,42,0.18)]">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-3xl space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Exploración ejecutiva</p>
                <h3 className="text-xl font-semibold tracking-tight text-slate-950">Filtros y búsqueda rápida transversal</h3>
                <p className="text-sm leading-6 text-slate-600">
                  Busca tenants, casos, alertas, accesos y documentos desde una sola superficie. Los KPIs superiores se
                  mantienen globales para conservar contexto; los listados y paneles inferiores sí reaccionan a los filtros.
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
                  className="h-12 w-full rounded-[1.2rem] border border-slate-200 bg-white px-4 text-sm text-slate-950 shadow-sm outline-none transition focus:border-teal-400"
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
                  className="h-12 w-full rounded-[1.2rem] border border-slate-200 bg-white px-4 text-sm text-slate-950 shadow-sm outline-none transition focus:border-teal-400"
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
                  className="h-12 w-full rounded-[1.2rem] border border-slate-200 bg-white px-4 text-sm text-slate-950 shadow-sm outline-none transition focus:border-teal-400"
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
                    className="h-12 w-full rounded-[1.2rem] border border-slate-200 bg-white px-4 text-sm text-slate-950 shadow-sm outline-none transition focus:border-teal-400"
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
                    className="h-12 w-full rounded-[1.2rem] border border-slate-200 bg-white px-4 text-sm text-slate-950 shadow-sm outline-none transition focus:border-teal-400"
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

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <KpiCard label="Tenants activos" value={globalSummary.totalTenants} helper="Organizaciones con operación visible" />
            <KpiCard label="Casos activos" value={globalSummary.activeCases} helper="Expedientes en intake, análisis, conciliación o litigio" />
            <KpiCard label="Alertas abiertas" value={globalSummary.openAlerts} helper={`${formatNumber(globalSummary.criticalAlerts)} críticas`} />
            <KpiCard label="Accesos vigentes" value={globalSummary.activeMemberships} helper={`${formatNumber(globalSummary.caseScopedMemberships)} por caso`} />
            <KpiCard label="Documentos pendientes" value={globalSummary.pendingDocuments} helper={`${formatNumber(globalSummary.supersededDocuments)} reemplazados`} />
          </section>

          <div className="rounded-[1.4rem] border border-cyan-100 bg-cyan-50/80 px-4 py-3 text-sm leading-6 text-cyan-950">
            Las tarjetas superiores muestran <strong>contexto global</strong>. Los listados, paneles laterales y contadores de secciones muestran la <strong>vista filtrada</strong> para evitar perder el panorama completo.
          </div>

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
                              disabled={isAlertBusy(alert.id)}
                              onClick={() => {
                                void handleAlertAction(alert.id, alert.title, alert.status);
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
                              disabled={isMembershipBusy(membership.id)}
                              onClick={() => {
                                void handleMembershipAction(
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
                              disabled={isCaseBusy(item.tenantId, item.caseId)}
                              onClick={() => {
                                void handleCaseAction(item.tenantId, item.caseId, item.title, item.status);
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
                            <div className="grid min-w-[280px] grid-cols-2 gap-3 text-sm text-slate-600 sm:grid-cols-4 lg:min-w-[360px]">
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
                                        disabled={isCaseBusy(item.tenantId, item.caseId)}
                                        onClick={() => {
                                          void handleCaseAction(item.tenantId, item.caseId, item.title, item.status);
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
                  <div className="rounded-[1.8rem] border border-white/70 bg-white/92 p-5 shadow-[0_24px_70px_-34px_rgba(15,23,42,0.18)]">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Distribución</p>
                    <h3 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">Señales operativas del momento</h3>
                    <div className="mt-5 space-y-4">
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
                              <Badge className={`rounded-full border ${getStatusBadgeClass(alert.status)}`}>{alert.status}</Badge>
                              <span className="text-xs uppercase tracking-[0.16em] text-slate-400">{alert.category}</span>
                            </div>
                            <h4 className="text-lg font-semibold text-slate-950">{alert.title}</h4>
                            <p className="max-w-3xl text-sm leading-6 text-slate-600">{alert.description || "Sin descripción adicional."}</p>
                          </div>
                          <div className="min-w-[260px] rounded-2xl bg-white px-4 py-3 text-sm text-slate-600">
                            <p><strong className="text-slate-950">Tenant:</strong> {alert.tenantName}</p>
                            <p><strong className="text-slate-950">Caso:</strong> {alert.caseTitle || alert.caseId || "Sin caso"}</p>
                            <p><strong className="text-slate-950">Detectada:</strong> {formatDateTime(alert.raisedAt)}</p>
                            <p><strong className="text-slate-950">Resuelta:</strong> {formatDateTime(alert.resolvedAt)}</p>
                            <div className="mt-3">
                              {actionLabel ? (
                                <Button
                                  className="w-full rounded-full"
                                  size="sm"
                                  disabled={isAlertBusy(alert.id)}
                                  onClick={() => {
                                    void handleAlertAction(alert.id, alert.title, alert.status);
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
                        <div className="min-w-[260px] rounded-2xl bg-white px-4 py-3 text-sm text-slate-600">
                          <p><strong className="text-slate-950">Creado:</strong> {formatDateTime(membership.createdAt)}</p>
                          <p><strong className="text-slate-950">Actualizado:</strong> {formatDateTime(membership.updatedAt)}</p>
                          <p><strong className="text-slate-950">Usuario ID:</strong> {membership.userId}</p>
                          <div className="mt-3">
                            {action ? (
                              <Button
                                variant="outline"
                                className="w-full rounded-full bg-white"
                                size="sm"
                                disabled={isMembershipBusy(membership.id)}
                                onClick={() => {
                                  void handleMembershipAction(membership.id, membership, userLabel);
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
                        <div className="min-w-[280px] rounded-2xl bg-white px-4 py-3 text-sm text-slate-600">
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
    </DashboardLayout>
  );
}

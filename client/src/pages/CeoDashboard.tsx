import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout, { type DashboardNavigationItem } from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  Files,
  LayoutDashboard,
  RefreshCw,
  ShieldCheck,
  ShieldX,
  Siren,
  UsersRound,
} from "lucide-react";
import { useMemo } from "react";
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
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "disabled":
    case "resolved":
      return "border-slate-200 bg-slate-100 text-slate-700";
    default:
      return "border-slate-200 bg-slate-100 text-slate-700";
  }
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

export default function CeoDashboard() {
  const { user } = useAuth({ redirectOnUnauthenticated: true, redirectPath: "/ceo" });
  const [location, setLocation] = useLocation();
  const isAdmin = user?.role === "admin";

  const snapshotQuery = trpc.dashboard.ceoSnapshot.useQuery(undefined, {
    enabled: isAdmin,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const summary = snapshotQuery.data?.summary;

  const navigation = useMemo<DashboardNavigationItem[]>(
    () => [
      {
        icon: LayoutDashboard,
        label: "Resumen CEO",
        path: "/ceo",
        badge: summary ? formatNumber(summary.activeCases) : undefined,
      },
      {
        icon: Siren,
        label: "Alertas",
        path: "/ceo/alertas",
        badge: summary ? formatNumber(summary.openAlerts) : undefined,
      },
      {
        icon: UsersRound,
        label: "Accesos",
        path: "/ceo/accesos",
        badge: summary ? formatNumber(summary.activeMemberships) : undefined,
      },
      {
        icon: Files,
        label: "Documentos",
        path: "/ceo/documentos",
        badge: summary ? formatNumber(summary.pendingDocuments) : undefined,
      },
    ],
    [summary],
  );

  const currentSection = useMemo(() => {
    if (location.startsWith("/ceo/alertas")) return "alertas" as const;
    if (location.startsWith("/ceo/accesos")) return "accesos" as const;
    if (location.startsWith("/ceo/documentos")) return "documentos" as const;
    return "resumen" as const;
  }, [location]);

  return (
    <DashboardLayout
      title="Dashboard CEO"
      subtitle="Centro de mando ejecutivo para AuditaPatron"
      navigation={navigation}
      headerActions={
        <>
          <Button
            variant="outline"
            className="rounded-full"
            onClick={() => {
              void snapshotQuery.refetch();
            }}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
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
      ) : snapshotQuery.isLoading ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="h-32 animate-pulse rounded-3xl border border-white/60 bg-white/75" />
          ))}
        </section>
      ) : snapshotQuery.error || !snapshotQuery.data ? (
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
                {snapshotQuery.error?.message ?? "Se produjo un error inesperado al consultar el backend ejecutivo."}
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
                <p className="mt-2 text-lg font-semibold">{formatDateTime(snapshotQuery.data.generatedAt)}</p>
                <p className="mt-2 text-sm leading-6 text-slate-100/80">
                  Usuario actual: <strong>{user?.name || user?.email || "Administrador"}</strong>
                </p>
              </div>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <KpiCard label="Tenants activos" value={snapshotQuery.data.summary.totalTenants} helper="Organizaciones con operación visible" />
            <KpiCard label="Casos activos" value={snapshotQuery.data.summary.activeCases} helper="Expedientes en intake, análisis, conciliación o litigio" />
            <KpiCard label="Alertas abiertas" value={snapshotQuery.data.summary.openAlerts} helper={`${formatNumber(snapshotQuery.data.summary.criticalAlerts)} críticas`} />
            <KpiCard label="Accesos vigentes" value={snapshotQuery.data.summary.activeMemberships} helper={`${formatNumber(snapshotQuery.data.summary.caseScopedMemberships)} por caso`} />
            <KpiCard label="Documentos pendientes" value={snapshotQuery.data.summary.pendingDocuments} helper={`${formatNumber(snapshotQuery.data.summary.supersededDocuments)} reemplazados`} />
          </section>

          {currentSection === "resumen" ? (
            <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
              <section className="space-y-6">
                <div className="rounded-[1.8rem] border border-white/70 bg-white/92 p-5 shadow-[0_24px_70px_-34px_rgba(15,23,42,0.18)]">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Estado de operación</p>
                      <h3 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">Salud por tenant</h3>
                    </div>
                    <Badge className="rounded-full border border-teal-200 bg-teal-50 text-teal-700">
                      {formatNumber(snapshotQuery.data.tenantHealth.length)} organizaciones
                    </Badge>
                  </div>
                  <div className="mt-5 space-y-3">
                    {snapshotQuery.data.tenantHealth.map((tenant) => (
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
                    ))}
                  </div>
                </div>

                <div className="rounded-[1.8rem] border border-white/70 bg-white/92 p-5 shadow-[0_24px_70px_-34px_rgba(15,23,42,0.18)]">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Expedientes recientes</p>
                      <h3 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">Casos con actividad más reciente</h3>
                    </div>
                    <Badge className="rounded-full border border-slate-200 bg-slate-100 text-slate-700">
                      {formatNumber(snapshotQuery.data.recentCases.length)} visibles
                    </Badge>
                  </div>
                  <div className="mt-5 overflow-hidden rounded-[1.4rem] border border-slate-200">
                    <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)_auto_auto] gap-3 bg-slate-100 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                      <span>Caso</span>
                      <span>Tenant</span>
                      <span>Estatus</span>
                      <span>Última actividad</span>
                    </div>
                    <div className="divide-y divide-slate-200 bg-white">
                      {snapshotQuery.data.recentCases.map((item) => (
                        <div key={item.caseId} className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)_auto_auto] gap-3 px-4 py-4 text-sm">
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-slate-950">{item.title}</p>
                            <p className="truncate text-slate-500">{item.caseId}</p>
                          </div>
                          <div className="min-w-0 text-slate-600">{item.tenantName}</div>
                          <div>
                            <Badge className={`rounded-full border ${getStatusBadgeClass(item.status)}`}>{item.status}</Badge>
                          </div>
                          <div className="text-right text-slate-500">{formatDateTime(item.lastActivityAt ?? item.updatedAt)}</div>
                        </div>
                      ))}
                    </div>
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
                        {snapshotQuery.data.casesByStatus.map((item) => (
                          <div key={item.status}>
                            <div className="mb-1 flex items-center justify-between text-sm text-slate-600">
                              <span>{item.status}</span>
                              <span>{formatNumber(item.total)}</span>
                            </div>
                            <div className="h-2.5 overflow-hidden rounded-full bg-slate-200">
                              <div
                                className="h-full rounded-full bg-teal-500"
                                style={{
                                  width: `${Math.max(
                                    8,
                                    (item.total / Math.max(snapshotQuery.data.summary.activeCases || 1, 1)) * 100,
                                  )}%`,
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
                        {snapshotQuery.data.alertsBySeverity.map((item) => (
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
                      Hay <strong>{formatNumber(snapshotQuery.data.summary.pendingConsents)}</strong> consentimientos pendientes de resolver.
                    </div>
                    <div className="rounded-[1.3rem] border border-rose-200 bg-rose-50 px-4 py-3">
                      Existen <strong>{formatNumber(snapshotQuery.data.summary.criticalAlerts)}</strong> alertas críticas que merecen revisión ejecutiva.
                    </div>
                    <div className="rounded-[1.3rem] border border-cyan-200 bg-cyan-50 px-4 py-3">
                      Se registran <strong>{formatNumber(snapshotQuery.data.summary.caseScopedMemberships)}</strong> accesos de alcance por caso actualmente activos.
                    </div>
                  </div>
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
                  {formatNumber(snapshotQuery.data.summary.openAlerts)} abiertas
                </Badge>
              </div>
              <div className="mt-5 space-y-3">
                {snapshotQuery.data.recentAlerts.map((alert) => (
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
                      <div className="min-w-[220px] rounded-2xl bg-white px-4 py-3 text-sm text-slate-600">
                        <p><strong className="text-slate-950">Tenant:</strong> {alert.tenantName}</p>
                        <p><strong className="text-slate-950">Caso:</strong> {alert.caseTitle || alert.caseId || "Sin caso"}</p>
                        <p><strong className="text-slate-950">Detectada:</strong> {formatDateTime(alert.raisedAt)}</p>
                        <p><strong className="text-slate-950">Resuelta:</strong> {formatDateTime(alert.resolvedAt)}</p>
                      </div>
                    </div>
                  </article>
                ))}
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
                  {formatNumber(snapshotQuery.data.summary.activeMemberships)} accesos activos
                </Badge>
              </div>
              <div className="mt-5 grid gap-3">
                {snapshotQuery.data.recentMemberships.map((membership) => (
                  <article key={membership.id} className="grid gap-4 rounded-[1.4rem] border border-slate-200 bg-slate-50/70 p-4 lg:grid-cols-[minmax(0,1fr)_auto]">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-lg font-semibold text-slate-950">{membership.userName || membership.userEmail || `Usuario ${membership.userId}`}</p>
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
                    <div className="min-w-[220px] rounded-2xl bg-white px-4 py-3 text-sm text-slate-600">
                      <p><strong className="text-slate-950">Creado:</strong> {formatDateTime(membership.createdAt)}</p>
                      <p><strong className="text-slate-950">Actualizado:</strong> {formatDateTime(membership.updatedAt)}</p>
                      <p><strong className="text-slate-950">Usuario ID:</strong> {membership.userId}</p>
                    </div>
                  </article>
                ))}
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
                  {formatNumber(snapshotQuery.data.summary.supersededDocuments)} reemplazados
                </Badge>
              </div>
              <div className="mt-5 space-y-3">
                {snapshotQuery.data.recentDocuments.map((document) => (
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
                          <strong className="text-slate-950">Confianza:</strong> {typeof document.classificationConfidence === "number"
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
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </DashboardLayout>
  );
}

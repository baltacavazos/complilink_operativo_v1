import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import {
  Building2,
  FileCheck2,
  Files,
  Loader2,
  ShieldCheck,
  TriangleAlert,
  UploadCloud,
} from "lucide-react";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

type CaseStatus =
  | "all"
  | "intake"
  | "analysis"
  | "conciliation"
  | "litigation"
  | "resolved"
  | "archived";

type FileDraft = {
  fileName: string;
  mimeType: string;
  base64Content: string;
};

const statusOptions: Array<{ value: CaseStatus; label: string }> = [
  { value: "all", label: "Todos los estados" },
  { value: "intake", label: "Intake" },
  { value: "analysis", label: "Análisis" },
  { value: "conciliation", label: "Conciliación" },
  { value: "litigation", label: "Litigio" },
  { value: "resolved", label: "Resuelto" },
  { value: "archived", label: "Archivado" },
];

function formatDate(value?: string | Date | null) {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function truncate(value: string, max = 18) {
  return value.length <= max ? value : `${value.slice(0, max)}…`;
}

function getStatusTone(status: string) {
  if (["litigation", "critical", "open"].includes(status)) {
    return "bg-rose-100 text-rose-700 border border-rose-200";
  }
  if (["analysis", "conciliation", "warning", "pending"].includes(status)) {
    return "bg-amber-100 text-amber-700 border border-amber-200";
  }
  if (["resolved", "verified", "granted", "active"].includes(status)) {
    return "bg-emerald-100 text-emerald-700 border border-emerald-200";
  }
  return "bg-slate-100 text-slate-700 border border-slate-200";
}

function readFileAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () =>
      reject(reader.error ?? new Error("No se pudo leer el archivo."));
    reader.readAsDataURL(file);
  });
}

function KpiCard({
  title,
  value,
  helper,
  icon,
}: {
  title: string;
  value: number;
  helper: string;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_24px_60px_-40px_rgba(15,23,42,0.45)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
            {value}
          </p>
          <p className="mt-2 text-sm text-slate-500">{helper}</p>
        </div>
        <div className="rounded-2xl bg-slate-950 p-3 text-white">{icon}</div>
      </div>
    </div>
  );
}

export default function Home() {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const utils = trpc.useUtils();
  const bootstrappedRef = useRef(false);

  const [selectedTenant, setSelectedTenant] = useState("");
  const [selectedCaseId, setSelectedCaseId] = useState("");
  const [statusFilter, setStatusFilter] = useState<CaseStatus>("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [uploadDraft, setUploadDraft] = useState<FileDraft | null>(null);
  const [createCaseForm, setCreateCaseForm] = useState({
    title: "",
    employeeName: "",
    employerEntity: "",
    summary: "",
    priority: "medium",
    status: "intake",
    dueAt: "",
  });
  const [workflowForm, setWorkflowForm] = useState({
    status: "intake",
    priority: "medium",
    dueAt: "",
  });
  const [consentForm, setConsentForm] = useState({
    subjectName: "",
    subjectRole: "",
    legalBasis: "",
    status: "pending",
    notes: "",
  });
  const [policyForm, setPolicyForm] = useState({
    documentId: "",
    policyType: "visibility",
    visibilityScope: "case_team",
    ruleText: "",
  });

  const bootstrapMutation = trpc.workspace.bootstrap.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.workspace.snapshot.invalidate(),
        utils.tenants.list.invalidate(),
        utils.dashboard.summary.invalidate(),
        utils.cases.list.invalidate(),
        utils.audit.list.invalidate(),
      ]);
    },
    onError: (error) => {
      toast.error(
        error.message || "No se pudo inicializar el workspace operativo.",
      );
    },
  });

  useEffect(() => {
    if (!isAuthenticated || bootstrappedRef.current || bootstrapMutation.isPending) {
      return;
    }
    bootstrappedRef.current = true;
    bootstrapMutation.mutate();
  }, [bootstrapMutation, isAuthenticated]);

  const tenantsQuery = trpc.tenants.list.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!selectedTenant && tenantsQuery.data?.[0]?.tenantId) {
      setSelectedTenant(tenantsQuery.data[0].tenantId);
    }
  }, [selectedTenant, tenantsQuery.data]);

  const casesInput = useMemo(
    () => ({
      tenantId: selectedTenant || undefined,
      status: statusFilter === "all" ? undefined : statusFilter,
      from: fromDate
        ? new Date(`${fromDate}T00:00:00`).toISOString()
        : undefined,
      to: toDate ? new Date(`${toDate}T23:59:59`).toISOString() : undefined,
    }),
    [fromDate, selectedTenant, statusFilter, toDate],
  );

  const casesQuery = trpc.cases.list.useQuery(casesInput, {
    enabled: isAuthenticated,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!casesQuery.data?.length) {
      setSelectedCaseId("");
      return;
    }

    const currentExists = casesQuery.data.some(
      (item) => item.caseId === selectedCaseId,
    );
    if (!currentExists) {
      setSelectedCaseId(casesQuery.data[0]!.caseId);
    }
  }, [casesQuery.data, selectedCaseId]);

  const dashboardQuery = trpc.dashboard.summary.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchOnWindowFocus: false,
  });

  const detailInput = useMemo(
    () =>
      selectedTenant && selectedCaseId
        ? {
            tenantId: selectedTenant,
            caseId: selectedCaseId,
          }
        : undefined,
    [selectedCaseId, selectedTenant],
  );

  const caseDetailQuery = trpc.cases.detail.useQuery(
    detailInput as { tenantId: string; caseId: string },
    {
      enabled: isAuthenticated && Boolean(detailInput),
      refetchOnWindowFocus: false,
    },
  );

  const auditInput = useMemo(
    () => ({
      tenantId: selectedTenant || undefined,
      caseId: selectedCaseId || undefined,
      limit: 20,
    }),
    [selectedCaseId, selectedTenant],
  );

  const auditQuery = trpc.audit.list.useQuery(auditInput, {
    enabled: isAuthenticated,
    refetchOnWindowFocus: false,
  });

  const createCaseMutation = trpc.cases.create.useMutation({
    onSuccess: async (createdCase) => {
      toast.success(`Caso ${createdCase.caseId} creado correctamente.`);
      setCreateCaseForm({
        title: "",
        employeeName: "",
        employerEntity: "",
        summary: "",
        priority: "medium",
        status: "intake",
        dueAt: "",
      });
      await Promise.all([
        utils.cases.list.invalidate(),
        utils.dashboard.summary.invalidate(),
        utils.audit.list.invalidate(),
      ]);
      setSelectedCaseId(createdCase.caseId);
    },
    onError: (error) => toast.error(error.message || "No se pudo crear el caso."),
  });

  const updateWorkflowMutation = trpc.cases.updateStatus.useMutation({
    onSuccess: async () => {
      toast.success("Workflow del expediente actualizado.");
      await Promise.all([
        utils.cases.list.invalidate(),
        utils.cases.detail.invalidate(),
        utils.dashboard.summary.invalidate(),
        utils.audit.list.invalidate(),
      ]);
    },
    onError: (error) =>
      toast.error(error.message || "No se pudo actualizar el workflow del caso."),
  });

  const uploadDocumentMutation = trpc.cases.uploadDocument.useMutation({
    onSuccess: async (result) => {
      toast.success(`Documento ${result.document.documentId} cargado con hash SHA-256.`);
      setUploadDraft(null);
      await Promise.all([
        utils.cases.detail.invalidate(),
        utils.cases.list.invalidate(),
        utils.dashboard.summary.invalidate(),
        utils.audit.list.invalidate(),
      ]);
    },
    onError: (error) => toast.error(error.message || "No se pudo cargar el documento."),
  });

  const createConsentMutation = trpc.consent.create.useMutation({
    onSuccess: async () => {
      toast.success("Consentimiento registrado.");
      setConsentForm({
        subjectName: "",
        subjectRole: "",
        legalBasis: "",
        status: "pending",
        notes: "",
      });
      await Promise.all([
        utils.cases.detail.invalidate(),
        utils.dashboard.summary.invalidate(),
        utils.audit.list.invalidate(),
      ]);
    },
    onError: (error) =>
      toast.error(error.message || "No se pudo registrar el consentimiento."),
  });

  const createPolicyMutation = trpc.policies.create.useMutation({
    onSuccess: async () => {
      toast.success("Política de visibilidad registrada.");
      setPolicyForm({
        documentId: "",
        policyType: "visibility",
        visibilityScope: "case_team",
        ruleText: "",
      });
      await Promise.all([
        utils.cases.detail.invalidate(),
        utils.audit.list.invalidate(),
      ]);
    },
    onError: (error) =>
      toast.error(error.message || "No se pudo registrar la política."),
  });

  const caseDetail = caseDetailQuery.data;

  useEffect(() => {
    if (!caseDetail?.case) return;

    const dueAt = caseDetail.case.dueAt
      ? new Date(caseDetail.case.dueAt).toISOString().slice(0, 16)
      : "";

    setWorkflowForm({
      status: caseDetail.case.status,
      priority: caseDetail.case.priority,
      dueAt,
    });
  }, [
    caseDetail?.case.caseId,
    caseDetail?.case.status,
    caseDetail?.case.priority,
    caseDetail?.case.dueAt,
  ]);

  const kpis = dashboardQuery.data?.totals ?? {
    activeCases: 0,
    totalDocuments: 0,
    openAlerts: 0,
    pendingConsents: 0,
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <div className="flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-5 py-3">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm text-slate-200">
            Preparando CompliLink Operativo...
          </span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(22,163,74,0.14),_transparent_24%),linear-gradient(135deg,_#020617_0%,_#0f172a_45%,_#172554_100%)] text-white">
        <div className="container flex min-h-screen flex-col justify-between py-8">
          <header className="flex items-center justify-between rounded-full border border-white/10 bg-white/5 px-5 py-3 backdrop-blur-xl">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-emerald-300">
                CompliLink
              </p>
              <h1 className="text-lg font-semibold">Operativo Laboral MX</h1>
            </div>
            <button
              onClick={() => {
                window.location.href = getLoginUrl();
              }}
              className="rounded-full bg-emerald-400 px-5 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300"
            >
              Ingresar con Manus OAuth
            </button>
          </header>

          <main className="grid gap-10 py-16 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
            <section>
              <p className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-200">
                <ShieldCheck className="h-4 w-4" />
                Gestión laboral multi-tenant con trazabilidad integral
              </p>
              <h2 className="mt-6 max-w-4xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                Plataforma corporativa para operar expedientes laborales mexicanos de punta a punta.
              </h2>
              <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-300">
                CompliLink centraliza autenticación, casos, intake documental, SHA-256,
                clasificación básica de CFDI, IMSS y nómina, políticas de visibilidad,
                consentimientos y auditoría con <strong>tenant_id</strong>, <strong>case_id</strong>
                y <strong>trace_id</strong> consistentes en todo el flujo.
              </p>
              <div className="mt-8 grid gap-4 sm:grid-cols-3">
                {[
                  ["Traceabilidad", "Hash SHA-256, metadata canónica y bitácora auditable"],
                  ["Acceso estricto", "Controles por tenant y por caso con Manus OAuth"],
                  ["Escalable", "Contratos preparados para integración futura con Shared Engine"],
                ].map(([title, description]) => (
                  <div
                    key={title}
                    className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl"
                  >
                    <p className="font-semibold text-white">{title}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-300">
                      {description}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[2rem] border border-white/10 bg-white/8 p-6 shadow-2xl backdrop-blur-2xl">
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  ["Casos activos", "Análisis, conciliación y litigio con timeline y prioridad"],
                  ["Documentos", "Carga segura a storage con clasificación preliminar automática"],
                  ["Consentimiento", "Base legal y visibilidad por documento y expediente"],
                  ["Auditoría", "Rastro de acciones con trace_id de punta a punta"],
                ].map(([title, description]) => (
                  <div
                    key={title}
                    className="rounded-3xl border border-white/10 bg-slate-950/35 p-5"
                  >
                    <p className="text-sm font-semibold text-emerald-200">{title}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-300">
                      {description}
                    </p>
                  </div>
                ))}
              </div>
              <div className="mt-6 rounded-3xl border border-emerald-400/20 bg-emerald-400/10 p-5 text-sm leading-7 text-emerald-100">
                Accede para inicializar tu operación, generar un caso piloto, cargar documentos y dejar CompliLink listo para trabajar hoy mismo con expedientes trazables.
              </div>
            </section>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f7fb] text-slate-900">
      <div className="grid min-h-screen lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="border-r border-slate-200 bg-[linear-gradient(180deg,_#081122_0%,_#0f1d38_100%)] px-6 py-6 text-white">
          <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
            <p className="text-xs uppercase tracking-[0.35em] text-emerald-300">
              CompliLink
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">
              Operativo Laboral
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Plataforma operativa para expedientes laborales con trazabilidad, documentos, consentimientos y auditoría en contexto corporativo mexicano.
            </p>
          </div>

          <nav className="mt-8 space-y-3 text-sm text-slate-300">
            {[
              ["Resumen ejecutivo", `${kpis.activeCases} casos activos`],
              ["Expedientes", `${casesQuery.data?.length ?? 0} casos visibles`],
              ["Documentos", `${kpis.totalDocuments} documentos procesados`],
              ["Auditoría", `${auditQuery.data?.length ?? 0} eventos recientes`],
            ].map(([title, caption]) => (
              <div
                key={title}
                className="rounded-2xl border border-white/8 bg-white/5 px-4 py-3"
              >
                <p className="font-medium text-white">{title}</p>
                <p className="mt-1 text-xs text-slate-400">{caption}</p>
              </div>
            ))}
          </nav>

          <div className="mt-8 rounded-[1.75rem] border border-emerald-400/20 bg-emerald-400/10 p-5 text-sm text-emerald-50">
            <p className="font-semibold text-emerald-200">Acceso vigente</p>
            <p className="mt-3 leading-6 text-emerald-50/90">
              Usuario autenticado: <strong>{user?.name || user?.email || "Usuario"}</strong>.
              El control se aplica por tenant y por caso desde el backend.
            </p>
            <button
              onClick={logout}
              className="mt-4 rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
            >
              Cerrar sesión
            </button>
          </div>
        </aside>

        <main className="px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
          <section className="rounded-[2rem] bg-[linear-gradient(135deg,_#0f172a_0%,_#14213d_55%,_#1d3557_100%)] px-6 py-6 text-white shadow-[0_24px_70px_-40px_rgba(15,23,42,0.65)] sm:px-8">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
              <div className="max-w-4xl">
                <p className="text-xs uppercase tracking-[0.35em] text-emerald-300">
                  CompliLink operativo
                </p>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                  Operación trazable de casos laborales con gobernanza documental y base canónica.
                </h2>
                <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300 sm:text-base">
                  Esta vista concentra expedientes activos, intake documental, consentimiento, políticas y auditoría. Cada operación preserva <strong>tenant_id</strong>, <strong>case_id</strong> y <strong>trace_id</strong> para trazabilidad integral y control operativo real desde el primer día.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:min-w-[520px]">
                <div className="rounded-3xl border border-white/10 bg-white/8 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-300">
                    Tenant
                  </p>
                  <p className="mt-2 text-lg font-semibold text-white">
                    {selectedTenant || "Inicializando"}
                  </p>
                </div>
                <div className="rounded-3xl border border-white/10 bg-white/8 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-300">
                    Caso activo
                  </p>
                  <p className="mt-2 text-lg font-semibold text-white">
                    {selectedCaseId || "Sin selección"}
                  </p>
                </div>
                <div className="rounded-3xl border border-white/10 bg-white/8 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-300">
                    Trace
                  </p>
                  <p className="mt-2 text-lg font-semibold text-white">
                    {truncate(caseDetail?.case.traceId ?? "—", 20)}
                  </p>
                </div>
                <div className="rounded-3xl border border-white/10 bg-white/8 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-300">
                    Estado de inicio
                  </p>
                  <p className="mt-2 text-lg font-semibold text-white">
                    {bootstrapMutation.isPending ? "Configurando" : "Operativo"}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="mt-6 grid gap-4 xl:grid-cols-4">
            <KpiCard
              title="Casos activos"
              value={kpis.activeCases}
              helper="Expedientes abiertos en flujo laboral"
              icon={<Building2 className="h-5 w-5" />}
            />
            <KpiCard
              title="Documentos procesados"
              value={kpis.totalDocuments}
              helper="Archivos con metadatos y huella digital"
              icon={<Files className="h-5 w-5" />}
            />
            <KpiCard
              title="Alertas operativas"
              value={kpis.openAlerts}
              helper="Riesgos abiertos de consentimiento o integridad"
              icon={<TriangleAlert className="h-5 w-5" />}
            />
            <KpiCard
              title="Consentimientos pendientes"
              value={kpis.pendingConsents}
              helper="Elementos con visibilidad o base legal por cerrar"
              icon={<ShieldCheck className="h-5 w-5" />}
            />
          </section>

          <section className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-[0_24px_60px_-40px_rgba(15,23,42,0.45)]">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">Casos activos</p>
                  <h3 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
                    Pipeline de expedientes
                  </h3>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <select
                    value={selectedTenant}
                    onChange={(event) => setSelectedTenant(event.target.value)}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm"
                  >
                    {(tenantsQuery.data ?? []).map((tenant) => (
                      <option key={tenant.tenantId} value={tenant.tenantId}>
                        {tenant.displayName}
                      </option>
                    ))}
                  </select>
                  <select
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value as CaseStatus)}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm"
                  >
                    {statusOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(event) => setFromDate(event.target.value)}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm"
                  />
                  <input
                    type="date"
                    value={toDate}
                    onChange={(event) => setToDate(event.target.value)}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm"
                  />
                </div>
              </div>

              <div className="mt-5 overflow-hidden rounded-[1.5rem] border border-slate-200">
                <div className="hidden grid-cols-[180px_1.1fr_140px_120px_180px] gap-4 bg-slate-50 px-5 py-4 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 md:grid">
                  <span>Caso</span>
                  <span>Resumen</span>
                  <span>Estatus</span>
                  <span>Prioridad</span>
                  <span>Última actividad</span>
                </div>

                <div className="max-h-[540px] overflow-auto bg-white">
                  {(casesQuery.data ?? []).map((caseItem) => {
                    const active = selectedCaseId === caseItem.caseId;
                    return (
                      <button
                        key={caseItem.caseId}
                        onClick={() => setSelectedCaseId(caseItem.caseId)}
                        className={`grid w-full gap-3 border-t border-slate-100 px-5 py-4 text-left transition first:border-t-0 md:grid-cols-[180px_1.1fr_140px_120px_180px] ${
                          active ? "bg-emerald-50/70" : "hover:bg-slate-50"
                        }`}
                      >
                        <div>
                          <p className="font-semibold text-slate-950">{caseItem.caseId}</p>
                          <p className="mt-1 text-xs text-slate-500">{caseItem.tenantName}</p>
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{caseItem.title}</p>
                          <p className="mt-1 text-sm text-slate-500">
                            {caseItem.summary || "Sin resumen adicional."}
                          </p>
                        </div>
                        <div>
                          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold capitalize ${getStatusTone(caseItem.status)}`}>
                            {caseItem.status}
                          </span>
                        </div>
                        <div>
                          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold capitalize ${getStatusTone(caseItem.priority)}`}>
                            {caseItem.priority}
                          </span>
                        </div>
                        <div className="text-sm text-slate-500">
                          {formatDate(caseItem.updatedAt)}
                        </div>
                      </button>
                    );
                  })}

                  {!casesQuery.data?.length ? (
                    <div className="px-6 py-12 text-center text-sm text-slate-500">
                      No hay casos visibles con los filtros actuales.
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-[0_24px_60px_-40px_rgba(15,23,42,0.45)]">
              <p className="text-sm font-medium text-slate-500">Detalle operativo</p>
              <h3 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
                Expediente seleccionado
              </h3>

              {caseDetailQuery.isLoading ? (
                <div className="mt-10 flex items-center justify-center text-slate-500">
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Cargando expediente...
                </div>
              ) : caseDetail?.case ? (
                <div className="mt-5 space-y-5">
                  <div className="rounded-[1.75rem] bg-slate-950 px-5 py-5 text-white">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
                          {caseDetail.case.caseId}
                        </p>
                        <h4 className="mt-2 text-2xl font-semibold">
                          {caseDetail.case.title}
                        </h4>
                        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                          {caseDetail.case.summary || "Sin resumen redactado."}
                        </p>
                      </div>
                      <div className="grid gap-2 text-right text-sm text-slate-300">
                        <span>
                          tenant_id: <strong className="text-white">{caseDetail.case.tenantId}</strong>
                        </span>
                        <span>
                          case_id: <strong className="text-white">{caseDetail.case.caseId}</strong>
                        </span>
                        <span>
                          trace_id: <strong className="text-white">{truncate(caseDetail.case.traceId, 28)}</strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {[
                      ["Colaborador", caseDetail.case.employeeName || "No especificado"],
                      ["Entidad patronal", caseDetail.case.employerEntity || "No especificada"],
                      ["Jurisdicción", caseDetail.case.jurisdiction],
                      ["Vencimiento", formatDate(caseDetail.case.dueAt)],
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4"
                      >
                        <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
                          {label}
                        </p>
                        <p className="mt-2 text-sm font-medium text-slate-950">
                          {value}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-slate-900">Control de workflow</p>
                        <p className="mt-1 text-sm text-slate-500">
                          Ajusta el estado operativo del expediente sin perder trazabilidad.
                        </p>
                      </div>
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold capitalize ${getStatusTone(workflowForm.status)}`}>
                        {workflowForm.status}
                      </span>
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      <select
                        value={workflowForm.status}
                        onChange={(event) =>
                          setWorkflowForm((prev) => ({ ...prev, status: event.target.value }))
                        }
                        className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm"
                      >
                        {statusOptions
                          .filter((option) => option.value !== "all")
                          .map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                      </select>
                      <select
                        value={workflowForm.priority}
                        onChange={(event) =>
                          setWorkflowForm((prev) => ({ ...prev, priority: event.target.value }))
                        }
                        className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm"
                      >
                        <option value="low">Baja</option>
                        <option value="medium">Media</option>
                        <option value="high">Alta</option>
                        <option value="critical">Crítica</option>
                      </select>
                      <input
                        type="datetime-local"
                        value={workflowForm.dueAt}
                        onChange={(event) =>
                          setWorkflowForm((prev) => ({ ...prev, dueAt: event.target.value }))
                        }
                        className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm"
                      />
                    </div>
                    <button
                      disabled={!selectedTenant || !selectedCaseId || updateWorkflowMutation.isPending}
                      onClick={() => {
                        updateWorkflowMutation.mutate({
                          tenantId: selectedTenant,
                          caseId: selectedCaseId,
                          status: workflowForm.status as
                            | "intake"
                            | "analysis"
                            | "conciliation"
                            | "litigation"
                            | "resolved"
                            | "archived",
                          priority: workflowForm.priority as
                            | "low"
                            | "medium"
                            | "high"
                            | "critical",
                          dueAt: workflowForm.dueAt
                            ? new Date(workflowForm.dueAt).toISOString()
                            : null,
                        });
                      }}
                      className="mt-4 inline-flex w-full items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      {updateWorkflowMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : null}
                      Actualizar workflow
                    </button>
                  </div>

                  <div className="rounded-[1.75rem] border border-slate-200 p-4">
                    <p className="text-sm font-medium text-slate-900">
                      Timeline y trazabilidad
                    </p>
                    <div className="mt-4 space-y-3">
                      {caseDetail.events.map((event) => (
                        <div
                          key={event.id}
                          className="rounded-3xl border border-slate-100 bg-slate-50 px-4 py-4"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="font-medium text-slate-950">{event.title}</p>
                            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getStatusTone(event.eventType)}`}>
                              {event.eventType}
                            </span>
                          </div>
                          <p className="mt-2 text-sm leading-6 text-slate-600">
                            {event.description || "Sin descripción adicional."}
                          </p>
                          <p className="mt-2 text-xs text-slate-500">
                            {formatDate(event.eventAt)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-4">
                      <p className="text-sm font-medium text-slate-900">Alertas operativas</p>
                      <div className="mt-3 space-y-3">
                        {caseDetail.alerts.length ? (
                          caseDetail.alerts.map((alert) => (
                            <div key={alert.id} className="rounded-3xl bg-white px-4 py-4 shadow-sm">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="font-medium text-slate-950">{alert.title}</p>
                                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusTone(alert.severity)}`}>
                                  {alert.severity}
                                </span>
                              </div>
                              <p className="mt-2 text-sm text-slate-600">
                                {alert.description || "Sin descripción adicional."}
                              </p>
                              <p className="mt-2 text-xs text-slate-500">
                                {formatDate(alert.raisedAt)} · {alert.category}
                              </p>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-slate-500">No hay alertas abiertas para este expediente.</p>
                        )}
                      </div>
                    </div>

                    <div className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-4">
                      <p className="text-sm font-medium text-slate-900">Políticas documentales</p>
                      <div className="mt-3 space-y-3">
                        {caseDetail.policies.length ? (
                          caseDetail.policies.map((policy) => (
                            <div key={policy.id} className="rounded-3xl bg-white px-4 py-4 shadow-sm">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="font-medium text-slate-950">{policy.policyType}</p>
                                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusTone(policy.status)}`}>
                                  {policy.status}
                                </span>
                              </div>
                              <p className="mt-2 text-sm text-slate-600">{policy.ruleText}</p>
                              <p className="mt-2 text-xs text-slate-500">
                                documento: {policy.documentId} · scope: {policy.visibilityScope}
                              </p>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-slate-500">No hay políticas registradas todavía para este caso.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-10 rounded-[1.75rem] border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center text-sm text-slate-500">
                  Selecciona un caso para revisar documentos, consentimientos, políticas y auditoría.
                </div>
              )}
            </div>
          </section>

          <section className="mt-6 grid gap-6 2xl:grid-cols-[1fr_1fr_1fr]">
            <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-[0_24px_60px_-40px_rgba(15,23,42,0.45)]">
              <p className="text-sm font-medium text-slate-500">Alta rápida</p>
              <h3 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">
                Crear nuevo caso
              </h3>
              <div className="mt-5 space-y-3">
                <input
                  value={createCaseForm.title}
                  onChange={(e) =>
                    setCreateCaseForm((prev) => ({ ...prev, title: e.target.value }))
                  }
                  placeholder="Ej. Reclamación por despido injustificado"
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm shadow-sm"
                />
                <input
                  value={createCaseForm.employeeName}
                  onChange={(e) =>
                    setCreateCaseForm((prev) => ({ ...prev, employeeName: e.target.value }))
                  }
                  placeholder="Nombre del colaborador"
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm shadow-sm"
                />
                <input
                  value={createCaseForm.employerEntity}
                  onChange={(e) =>
                    setCreateCaseForm((prev) => ({ ...prev, employerEntity: e.target.value }))
                  }
                  placeholder="Entidad patronal"
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm shadow-sm"
                />
                <textarea
                  value={createCaseForm.summary}
                  onChange={(e) =>
                    setCreateCaseForm((prev) => ({ ...prev, summary: e.target.value }))
                  }
                  placeholder="Resumen ejecutivo del asunto"
                  className="min-h-[104px] w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm shadow-sm"
                />
                <div className="grid gap-3 sm:grid-cols-3">
                  <select
                    value={createCaseForm.status}
                    onChange={(e) =>
                      setCreateCaseForm((prev) => ({ ...prev, status: e.target.value }))
                    }
                    className="rounded-2xl border border-slate-200 px-4 py-3 text-sm shadow-sm"
                  >
                    {statusOptions
                      .filter((option) => option.value !== "all")
                      .map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                  </select>
                  <select
                    value={createCaseForm.priority}
                    onChange={(e) =>
                      setCreateCaseForm((prev) => ({ ...prev, priority: e.target.value }))
                    }
                    className="rounded-2xl border border-slate-200 px-4 py-3 text-sm shadow-sm"
                  >
                    <option value="low">Baja</option>
                    <option value="medium">Media</option>
                    <option value="high">Alta</option>
                    <option value="critical">Crítica</option>
                  </select>
                  <input
                    type="datetime-local"
                    value={createCaseForm.dueAt}
                    onChange={(e) =>
                      setCreateCaseForm((prev) => ({ ...prev, dueAt: e.target.value }))
                    }
                    className="rounded-2xl border border-slate-200 px-4 py-3 text-sm shadow-sm"
                  />
                </div>
                <button
                  disabled={!selectedTenant || !createCaseForm.title || createCaseMutation.isPending}
                  onClick={() => {
                    createCaseMutation.mutate({
                      tenantId: selectedTenant,
                      title: createCaseForm.title,
                      employeeName: createCaseForm.employeeName || undefined,
                      employerEntity: createCaseForm.employerEntity || undefined,
                      summary: createCaseForm.summary || undefined,
                      status: createCaseForm.status as
                        | "intake"
                        | "analysis"
                        | "conciliation"
                        | "litigation"
                        | "resolved"
                        | "archived",
                      priority: createCaseForm.priority as
                        | "low"
                        | "medium"
                        | "high"
                        | "critical",
                      dueAt: createCaseForm.dueAt
                        ? new Date(createCaseForm.dueAt).toISOString()
                        : undefined,
                    });
                  }}
                  className="inline-flex w-full items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {createCaseMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Crear expediente
                </button>
              </div>
            </div>

            <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-[0_24px_60px_-40px_rgba(15,23,42,0.45)]">
              <p className="text-sm font-medium text-slate-500">Intake documental</p>
              <h3 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">
                Subir archivo a storage
              </h3>
              <div className="mt-5 space-y-4">
                <label className="flex min-h-[180px] cursor-pointer flex-col items-center justify-center rounded-[1.75rem] border border-dashed border-slate-300 bg-slate-50 px-5 py-6 text-center transition hover:border-emerald-400 hover:bg-emerald-50/60">
                  <UploadCloud className="h-8 w-8 text-slate-500" />
                  <p className="mt-4 text-sm font-medium text-slate-900">
                    Arrastra o selecciona un documento
                  </p>
                  <p className="mt-2 max-w-xs text-sm leading-6 text-slate-500">
                    Se cargará a storage con SHA-256, metadatos canónicos y clasificación preliminar.
                  </p>
                  <input
                    type="file"
                    className="hidden"
                    onChange={async (event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      try {
                        const base64Content = await readFileAsBase64(file);
                        setUploadDraft({
                          fileName: file.name,
                          mimeType: file.type || "application/octet-stream",
                          base64Content,
                        });
                      } catch (error) {
                        toast.error(
                          error instanceof Error
                            ? error.message
                            : "No se pudo preparar el archivo.",
                        );
                      }
                    }}
                  />
                </label>

                <div className="grid gap-3 sm:grid-cols-2">
                  <select
                    value={policyForm.visibilityScope}
                    onChange={(e) =>
                      setPolicyForm((prev) => ({ ...prev, visibilityScope: e.target.value }))
                    }
                    className="rounded-2xl border border-slate-200 px-4 py-3 text-sm shadow-sm"
                  >
                    <option value="case_team">Visibilidad caso</option>
                    <option value="tenant_legal">Legal tenant</option>
                    <option value="tenant_hr">RH tenant</option>
                    <option value="restricted">Restringido</option>
                  </select>
                  <select
                    value={consentForm.status}
                    onChange={(e) =>
                      setConsentForm((prev) => ({ ...prev, status: e.target.value }))
                    }
                    className="rounded-2xl border border-slate-200 px-4 py-3 text-sm shadow-sm"
                  >
                    <option value="pending">Consentimiento pendiente</option>
                    <option value="granted">Consentimiento otorgado</option>
                    <option value="revoked">Consentimiento revocado</option>
                    <option value="not_required">No requerido</option>
                  </select>
                </div>

                <div className="rounded-3xl bg-slate-50 px-4 py-4 text-sm text-slate-600">
                  <p>
                    <strong>Archivo:</strong> {uploadDraft?.fileName || "Sin archivo cargado"}
                  </p>
                  <p className="mt-2">
                    <strong>Tipo MIME:</strong> {uploadDraft?.mimeType || "—"}
                  </p>
                </div>

                <button
                  disabled={!selectedTenant || !selectedCaseId || !uploadDraft || uploadDocumentMutation.isPending}
                  onClick={() => {
                    if (!uploadDraft) return;
                    uploadDocumentMutation.mutate({
                      tenantId: selectedTenant,
                      caseId: selectedCaseId,
                      fileName: uploadDraft.fileName,
                      mimeType: uploadDraft.mimeType,
                      base64Content: uploadDraft.base64Content,
                      visibility: policyForm.visibilityScope as
                        | "case_team"
                        | "tenant_legal"
                        | "tenant_hr"
                        | "restricted",
                      consentStatus: consentForm.status as
                        | "pending"
                        | "granted"
                        | "revoked"
                        | "not_required",
                    });
                  }}
                  className="inline-flex w-full items-center justify-center rounded-full bg-emerald-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {uploadDocumentMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Registrar documento
                </button>
              </div>
            </div>

            <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-[0_24px_60px_-40px_rgba(15,23,42,0.45)]">
              <p className="text-sm font-medium text-slate-500">Cumplimiento documental</p>
              <h3 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">
                Consentimiento y política
              </h3>
              <div className="mt-5 space-y-3">
                <input
                  value={consentForm.subjectName}
                  onChange={(e) =>
                    setConsentForm((prev) => ({ ...prev, subjectName: e.target.value }))
                  }
                  placeholder="Titular o sujeto de datos"
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm shadow-sm"
                />
                <input
                  value={consentForm.subjectRole}
                  onChange={(e) =>
                    setConsentForm((prev) => ({ ...prev, subjectRole: e.target.value }))
                  }
                  placeholder="Rol del sujeto"
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm shadow-sm"
                />
                <input
                  value={consentForm.legalBasis}
                  onChange={(e) =>
                    setConsentForm((prev) => ({ ...prev, legalBasis: e.target.value }))
                  }
                  placeholder="Base legal o fundamento"
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm shadow-sm"
                />
                <textarea
                  value={consentForm.notes}
                  onChange={(e) =>
                    setConsentForm((prev) => ({ ...prev, notes: e.target.value }))
                  }
                  placeholder="Notas de consentimiento o visibilidad"
                  className="min-h-[96px] w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm shadow-sm"
                />
                <button
                  disabled={!selectedTenant || !selectedCaseId || !consentForm.subjectName || createConsentMutation.isPending}
                  onClick={() => {
                    createConsentMutation.mutate({
                      tenantId: selectedTenant,
                      caseId: selectedCaseId,
                      subjectName: consentForm.subjectName,
                      subjectRole: consentForm.subjectRole || undefined,
                      legalBasis: consentForm.legalBasis || undefined,
                      status: consentForm.status as
                        | "pending"
                        | "granted"
                        | "revoked"
                        | "expired"
                        | "not_required",
                      notes: consentForm.notes || undefined,
                    });
                  }}
                  className="inline-flex w-full items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {createConsentMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Registrar consentimiento
                </button>

                <hr className="my-2 border-slate-200" />

                <select
                  value={policyForm.documentId}
                  onChange={(e) =>
                    setPolicyForm((prev) => ({ ...prev, documentId: e.target.value }))
                  }
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm shadow-sm"
                >
                  <option value="">Selecciona un documento del caso</option>
                  {(caseDetail?.documents ?? []).map((document) => (
                    <option key={document.documentId} value={document.documentId}>
                      {document.documentId} · {document.originalName}
                    </option>
                  ))}
                </select>
                <div className="grid gap-3 sm:grid-cols-2">
                  <select
                    value={policyForm.policyType}
                    onChange={(e) =>
                      setPolicyForm((prev) => ({ ...prev, policyType: e.target.value }))
                    }
                    className="rounded-2xl border border-slate-200 px-4 py-3 text-sm shadow-sm"
                  >
                    <option value="visibility">Visibilidad</option>
                    <option value="retention">Retención</option>
                    <option value="legal_hold">Legal hold</option>
                    <option value="access_exception">Excepción de acceso</option>
                  </select>
                  <select
                    value={policyForm.visibilityScope}
                    onChange={(e) =>
                      setPolicyForm((prev) => ({ ...prev, visibilityScope: e.target.value }))
                    }
                    className="rounded-2xl border border-slate-200 px-4 py-3 text-sm shadow-sm"
                  >
                    <option value="case_team">Case team</option>
                    <option value="tenant_legal">Tenant legal</option>
                    <option value="tenant_hr">Tenant HR</option>
                    <option value="restricted">Restricted</option>
                  </select>
                </div>
                <textarea
                  value={policyForm.ruleText}
                  onChange={(e) =>
                    setPolicyForm((prev) => ({ ...prev, ruleText: e.target.value }))
                  }
                  placeholder="Describe la regla o restricción de visibilidad"
                  className="min-h-[96px] w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm shadow-sm"
                />
                <button
                  disabled={!selectedTenant || !selectedCaseId || !policyForm.documentId || !policyForm.ruleText || createPolicyMutation.isPending}
                  onClick={() => {
                    createPolicyMutation.mutate({
                      tenantId: selectedTenant,
                      caseId: selectedCaseId,
                      documentId: policyForm.documentId,
                      policyType: policyForm.policyType as
                        | "visibility"
                        | "retention"
                        | "legal_hold"
                        | "access_exception",
                      visibilityScope: policyForm.visibilityScope as
                        | "case_team"
                        | "tenant_legal"
                        | "tenant_hr"
                        | "restricted",
                      ruleText: policyForm.ruleText,
                    });
                  }}
                  className="inline-flex w-full items-center justify-center rounded-full bg-emerald-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {createPolicyMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Aplicar política
                </button>
              </div>
            </div>
          </section>

          <section className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-[0_24px_60px_-40px_rgba(15,23,42,0.45)]">
              <p className="text-sm font-medium text-slate-500">
                Document hub y cumplimiento
              </p>
              <h3 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
                Documentos y consentimientos del caso
              </h3>
              <div className="mt-5 space-y-3">
                {(caseDetail?.documents ?? []).map((document) => (
                  <div
                    key={document.documentId}
                    className="rounded-[1.5rem] border border-slate-200 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-950">
                          {document.originalName}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          {document.documentId} · {document.mimeType}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className={`rounded-full px-3 py-1 font-semibold ${getStatusTone(document.documentType)}`}>
                          {document.documentType}
                        </span>
                        <span className={`rounded-full px-3 py-1 font-semibold ${getStatusTone(document.visibility)}`}>
                          {document.visibility}
                        </span>
                        <span className={`rounded-full px-3 py-1 font-semibold ${getStatusTone(document.consentStatus)}`}>
                          {document.consentStatus}
                        </span>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                      <p>
                        <strong>SHA-256:</strong> {truncate(document.sha256, 28)}
                      </p>
                      <p>
                        <strong>Storage:</strong> {truncate(document.storageKey, 28)}
                      </p>
                      <p>
                        <strong>Confianza:</strong> {document.classificationConfidence}%
                      </p>
                      <p>
                        <strong>Procesado:</strong> {formatDate(document.processedAt)}
                      </p>
                    </div>
                  </div>
                ))}
                {!caseDetail?.documents?.length ? (
                  <div className="rounded-[1.75rem] border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center text-sm text-slate-500">
                    El caso aún no tiene documentos registrados.
                  </div>
                ) : null}

                <div className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-900">
                    Consentimientos registrados
                  </p>
                  <div className="mt-3 space-y-3">
                    {(caseDetail?.consents ?? []).map((consent) => (
                      <div key={consent.id} className="rounded-3xl bg-white px-4 py-4 shadow-sm">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-medium text-slate-950">
                            {consent.subjectName}
                          </p>
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusTone(consent.status)}`}>
                            {consent.status}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-slate-600">
                          {consent.legalBasis || "Sin base legal especificada."}
                        </p>
                      </div>
                    ))}
                    {!caseDetail?.consents?.length ? (
                      <p className="text-sm text-slate-500">
                        Todavía no se han registrado consentimientos.
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-[0_24px_60px_-40px_rgba(15,23,42,0.45)]">
              <p className="text-sm font-medium text-slate-500">Bitácora auditable</p>
              <h3 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
                Rastro reciente de auditoría
              </h3>
              <div className="mt-5 space-y-3">
                {(auditQuery.data ?? []).map((entry) => (
                  <div
                    key={entry.id}
                    className="rounded-[1.5rem] border border-slate-200 px-4 py-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-slate-950">{entry.action}</p>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusTone(entry.entityType)}`}>
                        {entry.entityType}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-slate-600">
                      entity_id: {entry.entityId}
                    </p>
                    <p className="mt-2 text-sm text-slate-600">
                      trace_id: {truncate(entry.traceId, 34)}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                      {formatDate(entry.createdAt)}
                    </p>
                  </div>
                ))}
                {!auditQuery.data?.length ? (
                  <div className="rounded-[1.75rem] border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center text-sm text-slate-500">
                    La auditoría aparecerá aquí conforme se ejecuten acciones del flujo.
                  </div>
                ) : null}
              </div>

              <div className="mt-5 rounded-[1.75rem] bg-slate-950 px-5 py-5 text-white">
                <p className="text-sm font-semibold">Preparación para Shared Engine</p>
                <p className="mt-3 text-sm leading-6 text-slate-300">
                  Cada alta de caso, documento y consentimiento genera contratos canónicos listos para consumo futuro por el motor compartido, sin perder consistencia de metadatos ni trazabilidad legal-operativa.
                </p>
                <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs uppercase tracking-[0.24em] text-emerald-200">
                  <FileCheck2 className="h-4 w-4" />
                  Canonical contracts ready
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

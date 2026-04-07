import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FileSearch,
  FileUp,
  Lock,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { ChangeEvent, useEffect, useMemo, useState } from "react";

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

function getUploadInsight(documentType: string): UploadInsight {
  switch (documentType) {
    case "payroll_receipt":
      return {
        label: "Recibo de nómina incorporado",
        contribution:
          "Este archivo ayuda a revisar percepciones, deducciones y cambios entre pagos. Ya forma parte de tu expediente para análisis posteriores.",
        nextSuggestion:
          "Si también tienes tu CFDI o contrato, súbelo para contrastar lo reportado y fortalecer mejor tu respaldo.",
      };
    case "cfdi":
      return {
        label: "CFDI incorporado",
        contribution:
          "Este documento aporta una capa fiscal muy útil para comparar lo timbrado contra lo que realmente recibiste o trabajaste.",
        nextSuggestion:
          "Si cuentas con recibos de nómina o soporte IMSS, agregarlos puede aclarar mejor diferencias o patrones.",
      };
    case "contract":
      return {
        label: "Contrato incorporado",
        contribution:
          "Este archivo ayuda a fijar el punto de partida de la relación laboral y a entender mejor las condiciones pactadas.",
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
          "Si sabes qué tipo de documento es, agrega una pista en la descripción o sube también recibos, CFDI o contrato para fortalecer el análisis.",
      };
  }
}

function getEngineStatusCopy(status?: string, reason?: string | null) {
  if (status === "sent") {
    return {
      title: "Enviado al motor de análisis",
      description: "El documento ya fue incorporado al procesamiento automatizado y a tu expediente trazable.",
      tone: "success",
    } as const;
  }

  if (status === "failed") {
    return {
      title: "Entrega automática pendiente",
      description:
        reason === "webhook_rejected"
          ? "Tu documento sí quedó guardado, pero la entrega automática al motor fue rechazada y debe revisarse."
          : "Tu documento sí quedó guardado, pero la entrega automática al motor quedó pendiente por un problema técnico temporal.",
      tone: "warning",
    } as const;
  }

  return {
    title: "Expediente guardado y trazado",
    description:
      reason === "engine_not_configured"
        ? "Tu documento ya está protegido en el expediente, pero la conexión automática al motor aún no está configurada en este entorno."
        : "Tu documento ya quedó resguardado en el expediente y listo para continuar su procesamiento.",
    tone: "neutral",
  } as const;
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
  const [lastUpload, setLastUpload] = useState<Awaited<ReturnType<typeof uploadMutation.mutateAsync>> | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

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

  const caseDetailInput = selectedTenantId && selectedCaseId
    ? { tenantId: selectedTenantId, caseId: selectedCaseId }
    : undefined;

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
  const presentTypes = useMemo(() => new Set(documents.map((item) => item.documentType)), [documents]);

  const dossierStatus = useMemo(() => {
    const completed = dossierTargets.filter((item) => presentTypes.has(item.type)).length;
    const percent = Math.max(12, Math.round((completed / dossierTargets.length) * 100));
    const nextTarget = dossierTargets.find((item) => !presentTypes.has(item.type));
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
    };
  }, [presentTypes]);

  const engineStatus = getEngineStatusCopy(lastUpload?.engineDispatch?.status, lastUpload?.engineDispatch?.reason);
  const uploadInsight = lastUpload ? getUploadInsight(lastUpload.classification.documentType) : null;

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    setSubmitError(null);
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
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-slate-950">Preparando tu flujo de auditoría...</h1>
          </div>
        </div>
      </main>
    );
  }

  if (!auth.isAuthenticated) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(20,184,166,0.12),_transparent_35%),linear-gradient(180deg,_#f8fafc_0%,_#ffffff_100%)] px-4 py-12 text-slate-950">
        <div className="container max-w-5xl">
          <a href="/" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-950">
            <ArrowLeft className="h-4 w-4" strokeWidth={1.8} />
            Volver al inicio
          </a>

          <div className="mt-6 grid gap-8 rounded-[2rem] border border-slate-200 bg-white p-8 shadow-[0_35px_100px_-60px_rgba(15,23,42,0.45)] lg:grid-cols-[1fr_0.9fr] lg:p-10">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-teal-100 bg-teal-50 px-4 py-2 text-sm font-medium text-teal-800">
                <ShieldCheck className="h-4 w-4" strokeWidth={1.8} />
                Flujo real de auditoría documental
              </div>
              <h1 className="mt-6 text-4xl font-semibold tracking-[-0.05em] text-slate-950">
                Entra para empezar tu expediente con el primer documento que ya tienes.
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
                Aquí podrás subir archivos reales, fortalecer tu expediente, ver qué tipo de respaldo ya tienes y recibir sugerencias claras sobre qué documento podría ayudarte después.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button
                  className="h-12 rounded-full bg-teal-600 px-7 text-base text-white hover:bg-teal-700"
                  onClick={() => {
                    window.location.href = getLoginUrl();
                  }}
                >
                  Iniciar sesión para auditar
                  <ArrowRight className="ml-2 h-4 w-4" strokeWidth={1.8} />
                </Button>
                <Button
                  variant="outline"
                  className="h-12 rounded-full border-slate-200 bg-white px-7 text-base text-slate-700 hover:bg-slate-50"
                  onClick={() => {
                    window.location.href = "/";
                  }}
                >
                  Seguir leyendo primero
                </Button>
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-6">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">Lo que encontrarás aquí</p>
              <div className="mt-5 space-y-4">
                {[
                  "Indicador discreto de fortaleza del expediente.",
                  "Carga documental real conectada al análisis del sistema.",
                  "Estados visibles de verificación, clasificación y procesamiento.",
                  "Sugerencias del siguiente documento útil, sin presión ni gamificación.",
                ].map((item) => (
                  <div key={item} className="flex gap-3 rounded-[1.2rem] border border-white bg-white p-4">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-teal-700" strokeWidth={1.8} />
                    <p className="text-sm leading-7 text-slate-700">{item}</p>
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
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-950">
      <div className="container max-w-6xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <a href="/" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-950">
              <ArrowLeft className="h-4 w-4" strokeWidth={1.8} />
              Volver al inicio
            </a>
            <p className="mt-4 text-sm font-semibold uppercase tracking-[0.24em] text-teal-700">/auditar</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-4xl">
              Tu flujo de auditoría y fortalecimiento del expediente
            </h1>
            <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
              Sube documentos reales, entiende qué aportan a tu caso y visualiza qué piezas pueden darte más contexto para proteger mejor tus derechos laborales.
            </p>
          </div>

          <Button
            variant="outline"
            className="rounded-full border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
            onClick={() => {
              setSubmitError(null);
              setLastUpload(null);
              void Promise.all([
                tenantsQuery.refetch(),
                casesQuery.refetch(),
                caseDetailQuery.refetch(),
              ]);
            }}
          >
            <RefreshCw className="mr-2 h-4 w-4" strokeWidth={1.8} />
            Actualizar estado
          </Button>
        </div>

        {bootstrapMutation.isPending ? (
          <div className="mt-8 rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-600">Estamos preparando tu espacio de trabajo y tu expediente inicial...</p>
          </div>
        ) : null}

        {bootstrapMutation.isError ? (
          <div className="mt-8 rounded-[1.75rem] border border-amber-200 bg-amber-50 p-6 text-amber-950">
            <p className="font-semibold">No fue posible preparar tu espacio de auditoría.</p>
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

        <div className="mt-8 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <section className="space-y-6">
            <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">Expediente actual</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950">Fortaleza del expediente: {dossierStatus.label}</h2>
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
                    Este indicador no premia cantidad. Solo te muestra si tu expediente ya reúne varios tipos de documentos que suelen dar mejor contexto para entender una situación laboral.
                  </p>
                </div>
                <div className="min-w-[220px] rounded-[1.5rem] border border-teal-100 bg-teal-50 p-4">
                  <div className="flex items-center justify-between gap-4 text-sm font-semibold text-teal-900">
                    <span>Cobertura documental útil</span>
                    <span>{dossierStatus.percent}%</span>
                  </div>
                  <div className="mt-3 h-3 overflow-hidden rounded-full bg-white">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-teal-500 to-cyan-500"
                      style={{ width: `${dossierStatus.percent}%` }}
                    />
                  </div>
                  <p className="mt-3 text-sm leading-6 text-teal-900">
                    {dossierStatus.nextTarget
                      ? `Siguiente documento especialmente útil: ${dossierStatus.nextTarget.label}.`
                      : "Ya cuentas con una base documental bastante completa para análisis más profundos."}
                  </p>
                </div>
              </div>

              <div className="mt-8 grid gap-4 md:grid-cols-2">
                {dossierTargets.map((item) => {
                  const isPresent = presentTypes.has(item.type);
                  return (
                    <article key={item.type} className="rounded-[1.4rem] border border-slate-200 bg-slate-50 p-4">
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
                          {isPresent ? "Ya aporta claridad" : "Podría fortalecerlo"}
                        </span>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-slate-700">{item.benefit}</p>
                    </article>
                  );
                })}
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">Subir documento</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950">Añade una pieza útil a tu expediente</h2>
                </div>
                <p className="max-w-lg text-sm leading-6 text-slate-600">
                  Después de cargarlo, te mostraremos qué aportó ese documento y cuál puede ser la siguiente pieza más útil para tu caso.
                </p>
              </div>

              <div className="mt-8 grid gap-4 md:grid-cols-2">
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
                  <span className="text-sm font-medium text-slate-700">Expediente o caso</span>
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
                        {item.title}
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
                    <p className="text-sm text-slate-600">PDF, imagen, XML u otro documento laboral útil.</p>
                  </div>
                </div>

                <input
                  key={pickerKey}
                  type="file"
                  onChange={handleFileChange}
                  className="mt-5 block w-full rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-4 text-sm text-slate-700 file:mr-4 file:rounded-full file:border-0 file:bg-teal-600 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white"
                />

                {selectedFile ? (
                  <div className="mt-4 rounded-[1.2rem] border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-900">
                    <p className="font-semibold">Archivo listo para enviarse</p>
                    <p className="mt-1">{selectedFile.name} · {(selectedFile.size / 1024).toFixed(1)} KB</p>
                  </div>
                ) : null}
              </div>

              <label className="mt-6 block">
                <span className="text-sm font-medium text-slate-700">Descripción opcional o pista del documento</span>
                <textarea
                  value={textHint}
                  onChange={(event) => setTextHint(event.target.value)}
                  rows={4}
                  placeholder="Ejemplo: recibo de nómina de marzo, alta IMSS, contrato inicial, captura de instrucciones por WhatsApp..."
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-teal-500"
                />
              </label>

              <div className="mt-6 flex flex-col gap-3 rounded-[1.4rem] border border-teal-100 bg-teal-50 p-4 text-sm leading-7 text-teal-950">
                <div className="flex items-start gap-3">
                  <Lock className="mt-1 h-5 w-5 shrink-0 text-teal-700" strokeWidth={1.8} />
                  <p>
                    Tu documento se guarda con trazabilidad y entra a revisión. Este flujo está diseñado para fortalecer tu expediente, no para presionarte a subir archivos innecesarios.
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

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Button
                  className="h-12 rounded-full bg-teal-600 px-7 text-white hover:bg-teal-700"
                  disabled={uploadMutation.isPending || !selectedFile || !selectedTenantId || !selectedCaseId}
                  onClick={() => {
                    void handleUpload();
                  }}
                >
                  {uploadMutation.isPending ? "Subiendo y procesando..." : "Subir y auditar documento"}
                  <ArrowRight className="ml-2 h-4 w-4" strokeWidth={1.8} />
                </Button>
                <Button
                  variant="outline"
                  className="h-12 rounded-full border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  onClick={() => {
                    setSelectedFile(null);
                    setTextHint("");
                    setSubmitError(null);
                    setPickerKey((value) => value + 1);
                  }}
                >
                  Limpiar formulario
                </Button>
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">Historial visible del expediente</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950">Documentos ya incorporados</h2>
                </div>
                <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                  {documents.length} documento{documents.length === 1 ? "" : "s"}
                </div>
              </div>

              <div className="mt-6 space-y-4">
                {documents.length === 0 ? (
                  <div className="rounded-[1.3rem] border border-slate-200 bg-slate-50 p-5 text-sm leading-7 text-slate-600">
                    Aún no hay documentos visibles en este expediente. Puedes empezar con el primer archivo que tengas más a la mano.
                  </div>
                ) : (
                  documents.map((document) => (
                    <article key={document.documentId} className="rounded-[1.4rem] border border-slate-200 bg-slate-50 p-4">
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div>
                          <p className="font-semibold text-slate-950">{document.originalName}</p>
                          <p className="mt-1 text-sm leading-6 text-slate-600">
                            Tipo detectado: {document.documentType} · Confianza {document.classificationConfidence}%
                          </p>
                          <p className="mt-1 text-sm leading-6 text-slate-500">
                            Incorporado el {formatDate(document.createdAt)}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs font-semibold">
                          <span className="rounded-full bg-white px-3 py-1 text-slate-700">Integridad: {document.integrityStatus}</span>
                          <span className="rounded-full bg-white px-3 py-1 text-slate-700">Consentimiento: {document.consentStatus}</span>
                          <span className="rounded-full bg-white px-3 py-1 text-slate-700">Visibilidad: {document.visibility}</span>
                        </div>
                      </div>
                    </article>
                  ))
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
                  {caseDetailQuery.data?.case.status ?? "Sin estado"}
                </p>
              </div>

              <div className="mt-6 rounded-[1.3rem] border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">Siguiente documento recomendado</p>
                <p className="mt-2 text-sm leading-7 text-slate-600">
                  {dossierStatus.nextTarget
                    ? `${dossierStatus.nextTarget.label}: ${dossierStatus.nextTarget.description}`
                    : "Tu expediente ya cubre varias categorías útiles. Si tienes documentación adicional específica de tu caso, también puede complementar el análisis."}
                </p>
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">Estado del último procesamiento</p>
              {!lastUpload ? (
                <div className="mt-4 rounded-[1.3rem] border border-slate-200 bg-slate-50 p-4 text-sm leading-7 text-slate-600">
                  Cuando subas un documento, aquí verás qué aportó a tu expediente y cómo avanzó su procesamiento.
                </div>
              ) : (
                <div className="mt-4 space-y-4">
                  <div className="rounded-[1.3rem] border border-emerald-100 bg-emerald-50 p-4">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-emerald-700" strokeWidth={1.8} />
                      <div>
                        <p className="font-semibold text-emerald-950">{uploadInsight?.label}</p>
                        <p className="mt-1 text-sm leading-7 text-emerald-900">{uploadInsight?.contribution}</p>
                      </div>
                    </div>
                  </div>

                  <div className={`rounded-[1.3rem] border p-4 ${
                    engineStatus.tone === "success"
                      ? "border-emerald-100 bg-emerald-50"
                      : engineStatus.tone === "warning"
                        ? "border-amber-200 bg-amber-50"
                        : "border-slate-200 bg-slate-50"
                  }`}>
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

                  <div className="grid gap-3">
                    {[
                      {
                        title: "Integridad verificada",
                        description: `SHA-256 generado y estado ${lastUpload.document.integrityStatus}.`,
                      },
                      {
                        title: "Clasificación preliminar",
                        description: `${lastUpload.classification.documentType} con confianza ${lastUpload.classification.classificationConfidence}%.`,
                      },
                      {
                        title: "Consentimiento actual",
                        description: `Estado ${lastUpload.document.consentStatus}. Puedes regularizarlo después si aplica.`,
                      },
                    ].map((item) => (
                      <div key={item.title} className="rounded-[1.2rem] border border-slate-200 bg-slate-50 p-4">
                        <p className="font-semibold text-slate-900">{item.title}</p>
                        <p className="mt-1 text-sm leading-7 text-slate-600">{item.description}</p>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-[1.3rem] border border-teal-100 bg-teal-50 p-4">
                    <div className="flex items-start gap-3">
                      <Sparkles className="mt-1 h-5 w-5 shrink-0 text-teal-700" strokeWidth={1.8} />
                      <div>
                        <p className="font-semibold text-teal-950">Siguiente paso sugerido</p>
                        <p className="mt-1 text-sm leading-7 text-teal-900">{uploadInsight?.nextSuggestion}</p>
                      </div>
                    </div>
                  </div>

                  {lastUpload.classification.reasons?.length ? (
                    <div className="rounded-[1.3rem] border border-slate-200 bg-white p-4">
                      <p className="font-semibold text-slate-900">Por qué se clasificó así</p>
                      <div className="mt-3 space-y-2 text-sm leading-7 text-slate-600">
                        {lastUpload.classification.reasons.map((reason) => (
                          <p key={reason}>• {reason}</p>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">Hallazgos que suelen aclararse mejor</p>
              <div className="mt-4 space-y-3">
                {[
                  "Diferencias entre recibos y CFDI cuando se comparan varios periodos.",
                  "Cambios repetidos en deducciones o montos a lo largo del tiempo.",
                  "Condiciones pactadas frente a la práctica cuando también existe contrato o evidencia complementaria.",
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
    </main>
  );
}

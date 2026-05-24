import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, CreditCard, ExternalLink, Loader2, ReceiptText } from "lucide-react";
import { toast as sonnerToast } from "sonner";

function formatCurrency(amountTotal: number, currency: string) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: (currency || "mxn").toUpperCase(),
    maximumFractionDigits: 2,
  }).format(amountTotal / 100);
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Sin fecha";
  }

  return date.toLocaleString("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function translatePaymentStatus(status: string) {
  switch (status) {
    case "paid":
      return "Pagado";
    case "active":
      return "Activo";
    case "trialing":
      return "En prueba";
    case "past_due":
      return "Pago pendiente";
    case "open":
      return "Abierto";
    default:
      return status;
  }
}

function translateSubscriptionStatus(status: string) {
  switch (status) {
    case "active":
      return "Suscripción activa";
    case "trialing":
      return "Suscripción en prueba";
    case "past_due":
      return "Suscripción con cobro pendiente";
    case "canceled":
      return "Suscripción cancelada";
    case "unpaid":
      return "Suscripción impagada";
    default:
      return status;
  }
}

function maskCustomerId(value: string | null) {
  if (!value) {
    return "Aún no registrado";
  }
  if (value.length <= 8) {
    return value;
  }
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

export default function Payments() {
  const auth = useAuth({ redirectOnUnauthenticated: true, redirectPath: "/pagos" });
  const historyQuery = trpc.commerce.history.useQuery(undefined, {
    enabled: auth.isAuthenticated,
    refetchOnWindowFocus: false,
  });
  const commerceStatusQuery = trpc.commerce.status.useQuery(undefined, {
    enabled: auth.isAuthenticated,
    refetchOnWindowFocus: false,
  });
  const billingPortalMutation = trpc.commerce.createBillingPortal.useMutation();

  const activeSubscription = historyQuery.data?.activeSubscription ?? null;
  const payments = historyQuery.data?.payments ?? [];
  const lastPayment = payments[0] ?? null;
  const paidCount = payments.filter(payment => payment.paymentStatus === "paid").length;

  async function handleOpenBillingPortal() {
    try {
      const portal = await billingPortalMutation.mutateAsync();
      if (!portal.url) {
        throw new Error("No se recibió un enlace válido para el portal de cobros.");
      }
      sonnerToast("Abrimos la gestión de suscripción en una pestaña nueva.");
      if (typeof window !== "undefined") {
        window.open(portal.url, "_blank", "noopener,noreferrer");
      }
    } catch (error) {
      sonnerToast(error instanceof Error ? error.message : "No fue posible abrir la gestión de cobros.");
    }
  }

  if (auth.loading) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-10 text-white sm:px-6">
        <div className="container mx-auto max-w-5xl">
          <div className="rounded-[2rem] border border-white/10 bg-white/5 p-8 shadow-[0_24px_80px_-48px_rgba(15,23,42,0.85)]">
            <div className="flex items-center gap-3 text-sm text-slate-200">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando historial comercial…
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(45,212,191,0.12),_transparent_28%),linear-gradient(180deg,#020617_0%,#0f172a_52%,#111827_100%)] px-4 py-8 text-white sm:px-6 sm:py-10">
      <div className="container mx-auto max-w-5xl space-y-6">
        <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-[0_24px_80px_-48px_rgba(15,23,42,0.85)] backdrop-blur">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-3">
              <a
                href="/auditar"
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10"
              >
                <ArrowLeft className="h-4 w-4" />
                Volver al expediente
              </a>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-teal-200/80">Cobros y suscripción</p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                  Historial comercial del expediente
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                  Aquí ves la persistencia local mínima de Stripe para tu cuenta: suscripción activa, compras detectadas y
                  referencias útiles para soporte u operación.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                className="rounded-full border-white/15 bg-white/5 text-white hover:bg-white/10"
                onClick={() => void historyQuery.refetch()}
                disabled={historyQuery.isFetching}
              >
                {historyQuery.isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ReceiptText className="mr-2 h-4 w-4" />}
                Actualizar historial
              </Button>
              {commerceStatusQuery.data?.canManageBilling ? (
                <Button
                  className="rounded-full bg-teal-400 text-slate-950 hover:bg-teal-300"
                  onClick={() => void handleOpenBillingPortal()}
                  disabled={billingPortalMutation.isPending}
                >
                  {billingPortalMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <ExternalLink className="mr-2 h-4 w-4" />
                  )}
                  Gestionar suscripción
                </Button>
              ) : null}
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <article className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5 shadow-[0_20px_70px_-50px_rgba(20,184,166,0.6)]">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-300">Plan actual</p>
            <p className="mt-3 text-2xl font-semibold text-white">
              {activeSubscription?.planName ?? commerceStatusQuery.data?.activePlan?.name ?? "Audita Gratis"}
            </p>
            <p className="mt-2 text-sm text-slate-300">
              {activeSubscription ? translateSubscriptionStatus(activeSubscription.status) : "Sin suscripción pagada persistida aún."}
            </p>
          </article>
          <article className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5 shadow-[0_20px_70px_-50px_rgba(59,130,246,0.45)]">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-300">Cliente en Stripe</p>
            <p className="mt-3 text-2xl font-semibold text-white">{maskCustomerId(historyQuery.data?.customerId ?? null)}</p>
            <p className="mt-2 text-sm text-slate-300">
              {commerceStatusQuery.data?.environment?.mode === "sandbox"
                ? "Modo prueba activo para validar el circuito completo."
                : "Referencia local lista para conciliación y soporte."}
            </p>
          </article>
          <article className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5 shadow-[0_20px_70px_-50px_rgba(168,85,247,0.45)]">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-300">Compras detectadas</p>
            <p className="mt-3 text-2xl font-semibold text-white">{paidCount}</p>
            <p className="mt-2 text-sm text-slate-300">
              {lastPayment ? `Último cobro: ${formatDate(lastPayment.paidAt)}` : "Todavía no hay cobros persistidos para esta cuenta."}
            </p>
          </article>
        </section>

        {commerceStatusQuery.data?.environment?.recommendedTestCard ? (
          <section className="rounded-[1.75rem] border border-teal-400/20 bg-teal-400/10 p-5 text-sm text-teal-50">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold">Sandbox de Stripe detectado</p>
                <p className="mt-1 text-teal-50/85">
                  Puedes validar checkout y retorno con la tarjeta {commerceStatusQuery.data.environment.recommendedTestCard}.
                </p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-teal-300/20 bg-white/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-teal-50">
                <CreditCard className="h-4 w-4" />
                {commerceStatusQuery.data.environment.mode}
              </div>
            </div>
          </section>
        ) : null}

        <section className="rounded-[2rem] border border-white/10 bg-white p-5 text-slate-950 shadow-[0_28px_80px_-48px_rgba(15,23,42,0.75)] sm:p-6">
          <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Historial persistido</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Pagos y compras registradas</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                Cada fila muestra la compra detectada por webhook y las referencias mínimas guardadas localmente para trazabilidad.
              </p>
            </div>
          </div>

          {historyQuery.isLoading ? (
            <div className="flex items-center gap-3 py-8 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Consultando historial comercial…
            </div>
          ) : payments.length === 0 ? (
            <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-sm leading-6 text-slate-600">
              Aún no hay pagos persistidos para esta cuenta. Cuando completes un checkout y Stripe envíe el webhook, aquí se
              reflejarán el producto, el importe y los identificadores mínimos guardados localmente.
            </div>
          ) : (
            <div className="mt-5 overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Producto</th>
                    <th className="px-4 py-3 font-semibold">Tipo</th>
                    <th className="px-4 py-3 font-semibold">Monto</th>
                    <th className="px-4 py-3 font-semibold">Estado</th>
                    <th className="px-4 py-3 font-semibold">Fecha</th>
                    <th className="px-4 py-3 font-semibold">Referencia</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {payments.map(payment => (
                    <tr key={payment.id} className="align-top">
                      <td className="px-4 py-4">
                        <p className="font-semibold text-slate-950">{payment.productLabel}</p>
                        <p className="mt-1 text-xs text-slate-500">Clave interna: {payment.productKey}</p>
                      </td>
                      <td className="px-4 py-4 text-slate-600">
                        {payment.productType === "subscription" ? "Suscripción" : "Pago único"}
                      </td>
                      <td className="px-4 py-4 font-medium text-slate-950">
                        {formatCurrency(payment.amountTotal, payment.currency)}
                      </td>
                      <td className="px-4 py-4 text-slate-600">{translatePaymentStatus(payment.paymentStatus)}</td>
                      <td className="px-4 py-4 text-slate-600">{formatDate(payment.paidAt)}</td>
                      <td className="px-4 py-4 text-xs leading-5 text-slate-500">
                        <p>Checkout: {payment.stripeCheckoutSessionId ?? "—"}</p>
                        <p>Invoice: {payment.stripeInvoiceId ?? "—"}</p>
                        <p>Payment Intent: {payment.stripePaymentIntentId ?? "—"}</p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

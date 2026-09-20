import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import {
  BILLING_SOFT_NOTE,
  FIRST_WIN_PROMISE,
  GUARANTEE_LINE,
  PLAN_PRIMARY_CTA,
  SOCIAL_PROOF_LINE,
  getVisiblePaidPlans,
} from "@shared/conversionCopy";
import { ArrowLeft, CheckCircle2, Loader2, ReceiptText } from "lucide-react";

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

const visiblePaidPlans = getVisiblePaidPlans();

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

  const activeSubscription = historyQuery.data?.activeSubscription ?? null;
  const payments = historyQuery.data?.payments ?? [];
  const lastPayment = payments[0] ?? null;
  const paidCount = payments.filter((payment) => payment.paymentStatus === "paid").length;
  const planName =
    activeSubscription?.planName ?? commerceStatusQuery.data?.activePlan?.name ?? "Audita Gratis";

  const goToFirstWin = (planKey: string) => {
    window.location.href = `/auditar?plan=${encodeURIComponent(planKey)}`;
  };

  if (auth.loading) {
    return (
      <main className="audita-pagos min-h-screen bg-[linear-gradient(180deg,#f8fbfc_0%,#eef4f5_100%)] px-4 py-10 text-slate-950 sm:px-6">
        <div className="container mx-auto max-w-3xl">
          <div className="rounded-[1.75rem] border border-slate-200 bg-white p-8 shadow-[0_22px_56px_-40px_rgba(15,23,42,0.2)]">
            <div className="flex items-center gap-3 text-sm text-slate-700">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando tus pagos…
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="audita-pagos min-h-screen bg-[linear-gradient(180deg,#f8fbfc_0%,#eef4f5_100%)] px-4 py-8 text-slate-950 sm:px-6 sm:py-10">
      <div className="container mx-auto max-w-3xl space-y-5">
        <section className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-[0_22px_56px_-40px_rgba(15,23,42,0.2)] sm:p-6">
          <a
            href="/auditar"
            data-testid="mobile-header-back"
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="sm:hidden">Volver</span>
            <span className="hidden sm:inline">Volver al expediente</span>
          </a>
          <p className="mt-5 text-sm font-semibold text-teal-800">Tus pagos</p>
          <h1 className="mt-2 text-[1.85rem] font-semibold leading-tight tracking-[-0.03em] text-slate-950 sm:text-4xl">
            Tu plan y lo que ya pagaste
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-700 sm:text-base">
            La primera lectura es gratis. Solo pagas si quieres más documentos o un entregable extra.
          </p>
          <p className="mt-3 text-sm leading-6 text-slate-600">{BILLING_SOFT_NOTE}</p>
        </section>

        <section
          data-testid="pagos-plan-cards"
          className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-[0_22px_56px_-40px_rgba(15,23,42,0.2)] sm:p-6"
        >
          <p className="text-sm font-semibold text-teal-800">Planes</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
            Elige cómo seguir, con precio en MXN
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-700">
            Ves qué incluye cada plan. Activaremos el cobro cuando esté listo.
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {visiblePaidPlans.map((plan) => (
              <article
                key={plan.key}
                className={`rounded-[1.35rem] border p-4 ${
                  plan.highlighted
                    ? "border-teal-300 bg-teal-50/80"
                    : "border-slate-200 bg-slate-50/80"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-base font-semibold text-slate-950">{plan.name}</p>
                  <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-teal-800">
                    {plan.badge}
                  </span>
                </div>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                  {plan.priceLabel}
                </p>
                <p className="mt-1 text-sm leading-6 text-slate-700">{plan.headline}</p>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
                  {plan.includes.map((feature) => (
                    <li key={feature} className="flex gap-2">
                      <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-teal-700" strokeWidth={1.8} />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className="mt-4 h-11 w-full rounded-full bg-slate-950 text-white hover:bg-slate-800"
                  onClick={() => goToFirstWin(plan.key)}
                >
                  {PLAN_PRIMARY_CTA}
                </Button>
              </article>
            ))}
          </div>

          <div className="mt-4 space-y-1 text-sm leading-6 text-slate-700">
            <p>{SOCIAL_PROOF_LINE}</p>
            <p>{GUARANTEE_LINE}</p>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-3">
          <article className="rounded-[1.5rem] border border-slate-200 bg-white p-5">
            <p className="text-sm font-medium text-slate-600">Plan actual</p>
            <p className="mt-2 text-2xl font-semibold leading-tight text-slate-950">{planName}</p>
            <p className="mt-2 text-sm leading-6 text-slate-700">
              {activeSubscription
                ? translateSubscriptionStatus(activeSubscription.status)
                : "Sigues en la parte gratis. No hay un plan de pago activo."}
            </p>
          </article>
          <article className="rounded-[1.5rem] border border-slate-200 bg-white p-5">
            <p className="text-sm font-medium text-slate-600">Cobro</p>
            <p className="mt-2 text-2xl font-semibold leading-tight text-slate-950">Sin cargo</p>
            <p className="mt-2 text-sm leading-6 text-slate-700">{BILLING_SOFT_NOTE}</p>
          </article>
          <article className="rounded-[1.5rem] border border-slate-200 bg-white p-5">
            <p className="text-sm font-medium text-slate-600">Pagos registrados</p>
            <p className="mt-2 text-2xl font-semibold leading-tight text-slate-950">{paidCount}</p>
            <p className="mt-2 text-sm leading-6 text-slate-700">
              {lastPayment
                ? `Último movimiento: ${formatDate(lastPayment.paidAt)}`
                : "Todavía no hay cobros en esta cuenta."}
            </p>
          </article>
        </section>

        <section className="rounded-[1.75rem] border border-slate-200 bg-white p-5 sm:p-6">
          <p className="text-sm font-medium text-slate-600">Tus cobros</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
            Pagos y compras registradas
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-700">
            Si algún día pagas de verdad, aquí verás el producto, el importe y la fecha.
          </p>

          <div className="mt-4">
            <Button
              variant="outline"
              className="h-11 w-full rounded-full border-slate-200 bg-white text-slate-800 hover:bg-slate-50 sm:w-auto"
              onClick={() => void historyQuery.refetch()}
              disabled={historyQuery.isFetching}
            >
              {historyQuery.isFetching ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ReceiptText className="mr-2 h-4 w-4" />
              )}
              Actualizar pagos
            </Button>
          </div>

          {historyQuery.isLoading ? (
            <div className="flex items-center gap-3 py-8 text-sm text-slate-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              Consultando tus pagos…
            </div>
          ) : payments.length === 0 ? (
            <div className="mt-5 rounded-[1.25rem] border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm leading-6 text-slate-700">
              Aún no hay pagos en esta cuenta. {FIRST_WIN_PROMISE}
            </div>
          ) : (
            <div className="mt-5 grid gap-3">
              {payments.map((payment) => (
                <article
                  key={payment.id}
                  className="rounded-[1.25rem] border border-slate-200 bg-slate-50/80 px-4 py-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-base font-semibold text-slate-950">{payment.productLabel}</p>
                      <p className="mt-1 text-sm text-slate-700">
                        {payment.productType === "subscription" ? "Suscripción" : "Pago único"}
                      </p>
                    </div>
                    <p className="text-base font-semibold text-slate-950">
                      {formatCurrency(payment.amountTotal, payment.currency)}
                    </p>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-700">
                    {translatePaymentStatus(payment.paymentStatus)} · {formatDate(payment.paidAt)}
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

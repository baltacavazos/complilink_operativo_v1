import { Button } from "@/components/ui/button";
import { getVisiblePaidPlans } from "@shared/conversionCopy";
import { ArrowLeft, CheckCircle2 } from "lucide-react";

const visiblePaidPlans = getVisiblePaidPlans();

export default function Plans() {
  return (
    <main className="audita-planes min-h-screen bg-[linear-gradient(180deg,#f8fbfc_0%,#eef4f5_100%)] px-4 py-8 text-slate-950 sm:px-6 sm:py-10">
      <div className="container mx-auto max-w-3xl space-y-5">
        <section className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-[0_22px_56px_-40px_rgba(15,23,42,0.2)] sm:p-6">
          <a
            href="/auditar"
            data-testid="mobile-header-back"
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="sm:hidden">Volver</span>
            <span className="hidden sm:inline">Volver a auditar</span>
          </a>
          <p className="mt-5 text-sm font-semibold text-teal-800">Planes</p>
          <h1 className="mt-2 text-[1.85rem] font-semibold leading-tight tracking-[-0.03em] text-slate-950 sm:text-4xl">
            Elige un plan, con precio en MXN al mes
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-700 sm:text-base">
            Sube tu documento y en minutos ves el resultado y qué hacer. La primera lectura es gratis. Si quieres más documentos o un entregable, aquí ves qué incluye cada plan.
          </p>
          <p className="mt-3 text-sm leading-6 text-slate-600">Activaremos el cobro cuando esté listo.</p>
        </section>

        <section data-testid="planes-plan-cards" className="grid gap-3 sm:grid-cols-2">
          {visiblePaidPlans.map((plan) => (
            <article
              key={plan.key}
              className={`rounded-[1.5rem] border p-5 ${
                plan.highlighted
                  ? "border-teal-300 bg-teal-50/80"
                  : "border-slate-200 bg-white"
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
                onClick={() => {
                  window.location.href = `/auditar?plan=${encodeURIComponent(plan.key)}`;
                }}
              >
                Elegir plan y empezar
              </Button>
            </article>
          ))}
        </section>

        <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 text-sm leading-6 text-slate-700">
          <p>Una persona subió su recibo porque no entendía el IMSS ni las retenciones: vio en palabras simples qué aparece y qué conviene revisar.</p>
          <p className="mt-2">Te garantizamos claridad del análisis. No prometemos que ganes un juicio.</p>
        </section>
      </div>
    </main>
  );
}

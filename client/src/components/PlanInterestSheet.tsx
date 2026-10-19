import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";

export type PlanInterestPlan = {
  key: string;
  name: string;
  priceLabel: string;
  includes: readonly string[];
};

export function PlanInterestSheet({
  plan,
  open,
  onOpenChange,
}: {
  plan: PlanInterestPlan | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [contact, setContact] = useState("");
  const mutation = trpc.cases.planInterest.useMutation();
  if (!plan) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white text-slate-950">
        <DialogHeader>
          <DialogTitle>{plan.name}</DialogTitle>
          <DialogDescription className="text-base text-slate-800">
            {plan.priceLabel}. Hoy no se cobra.
          </DialogDescription>
        </DialogHeader>
        <ul className="space-y-2 text-sm leading-6 text-slate-800">
          {plan.includes.map((feature) => (
            <li key={feature}>{feature}</li>
          ))}
        </ul>
        {mutation.data?.saved ? (
          <p data-testid="plan-interest-saved" className="text-sm font-semibold text-slate-950">
            Listo. Te avisamos cuando abra. Hoy no se cobra.
          </p>
        ) : (
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              const value = contact.trim();
              if (value.length < 5) return;
              mutation.mutate({ contact: value, planKey: plan.key });
            }}
          >
            <label className="block text-sm font-semibold text-slate-950" htmlFor="plan-interest-contact">
              Correo o teléfono
            </label>
            <input
              id="plan-interest-contact"
              data-testid="plan-interest-contact"
              value={contact}
              onChange={(event) => setContact(event.target.value)}
              placeholder="tu@correo.com o 55 0000 0000"
              className="h-12 w-full rounded-2xl border border-slate-300 bg-white px-3 text-base text-slate-950"
            />
            <Button
              type="submit"
              data-testid="plan-interest-submit"
              className="h-12 w-full rounded-full bg-[#111111] text-white hover:bg-[#222222]"
              disabled={mutation.isPending || contact.trim().length < 5}
            >
              Avísame cuando abra
            </Button>
            <p className="text-sm leading-6 text-slate-700">Hoy no se cobra. Guardamos el aviso y nada más.</p>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

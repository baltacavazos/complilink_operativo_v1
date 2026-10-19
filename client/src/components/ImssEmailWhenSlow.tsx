import { useState } from "react";

import { trpc } from "@/lib/trpc";
import { IMSS_EMAIL_WHEN_SLOW } from "@shared/officialWorkerDocument";

export function ImssEmailWhenSlow({ guestPreviewToken }: { guestPreviewToken?: string | null }) {
  const token = guestPreviewToken?.trim() ?? "";
  const [email, setEmail] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const mutation = trpc.cases.guestImssEmailNotify.useMutation({
    onSuccess: (result) => setNotice(result.message),
    onError: () => setNotice("No pudimos guardar ese correo. Prueba otra vez."),
  });
  if (token.length < 40) return null;

  return (
    <form
      data-testid="imss-email-when-slow"
      className="mt-3 rounded-[1.2rem] border border-slate-200 bg-white p-3 text-left"
      onSubmit={(event) => {
        event.preventDefault();
        if (!email.trim()) return;
        mutation.mutate({ guestPreviewToken: token, email: email.trim() });
      }}
    >
      <p className="text-sm font-semibold text-slate-950">{IMSS_EMAIL_WHEN_SLOW}</p>
      <p className="mt-1 text-sm leading-6 text-slate-700">Opcional. Sin cuenta. WhatsApp sigue apagado.</p>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <input
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="tu correo"
          className="min-h-12 flex-1 rounded-full border border-slate-300 bg-white px-4 text-base text-slate-950"
        />
        <button
          type="submit"
          className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#0f766e] px-4 text-base font-semibold text-white"
          disabled={mutation.isPending}
        >
          {mutation.isPending ? "Guardando…" : IMSS_EMAIL_WHEN_SLOW}
        </button>
      </div>
      {notice ? <p className="mt-2 text-sm text-slate-800">{notice}</p> : null}
    </form>
  );
}

import { useMemo, useState } from "react";

import { trackEvent } from "@/lib/analytics";
import {
  SHARE_REWARD_COPY,
  buildShareText,
  createReferralCode,
  isReferralCode,
  shareWhatsappHref,
} from "@shared/shareCopy";

const REF_STORAGE_KEY = "auditapatron_ref_code";
const INCOMING_REF_KEY = "auditapatron_incoming_ref";

export function readOrCreateReferralCode(): string {
  if (typeof window === "undefined") return createReferralCode(() => 0.5);
  const stored = window.localStorage.getItem(REF_STORAGE_KEY);
  if (isReferralCode(stored)) return stored;
  const next = createReferralCode();
  window.localStorage.setItem(REF_STORAGE_KEY, next);
  return next;
}

export function rememberIncomingReferral(search: string): string | null {
  if (typeof window === "undefined") return null;
  const raw = new URLSearchParams(search).get("ref")?.trim().toUpperCase() ?? "";
  if (!isReferralCode(raw)) return readIncomingReferralCode();
  window.localStorage.setItem(INCOMING_REF_KEY, raw);
  return raw;
}

export function readIncomingReferralCode(): string | null {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(INCOMING_REF_KEY)?.trim().toUpperCase() ?? "";
  return isReferralCode(stored) ? stored : null;
}

export function ShareWithCompaCard() {
  const code = useMemo(() => readOrCreateReferralCode(), []);
  const [copied, setCopied] = useState(false);
  const text = buildShareText(code);
  const link = `https://auditapatron.com/?ref=${code}`;

  async function share() {
    trackEvent("share_whatsapp", { ref: code });
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ text, url: link });
        return;
      } catch {
        // Si cierran la hoja nativa, queda el enlace de WhatsApp.
      }
    }
    window.open(shareWhatsappHref(code), "_blank", "noopener,noreferrer");
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section
      data-testid="share-with-compa"
      className="mt-4 rounded-[1.35rem] border border-emerald-200 bg-white px-4 py-4 text-left text-slate-950"
    >
      <h2 className="text-lg font-semibold text-slate-950">Pásaselo a un compa</h2>
      <p className="mt-2 text-sm leading-6 text-slate-800">{SHARE_REWARD_COPY}</p>
      <p className="mt-2 text-sm leading-6 text-slate-700">{text}</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          data-testid="share-whatsapp"
          className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#111111] px-4 text-base font-semibold text-white"
          onClick={() => {
            void share();
          }}
        >
          Mandar por WhatsApp
        </button>
        <button
          type="button"
          data-testid="share-copy"
          className="inline-flex min-h-12 items-center justify-center rounded-full border border-slate-300 bg-white px-4 text-base font-semibold text-slate-950"
          onClick={() => {
            void copy();
          }}
        >
          {copied ? "Link copiado" : "Copiar link"}
        </button>
      </div>
    </section>
  );
}

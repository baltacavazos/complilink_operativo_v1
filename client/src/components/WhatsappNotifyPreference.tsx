import { useEffect, useState } from "react";
import { WHATSAPP_NOTIFY_UI_COPY } from "@shared/whatsappNotify";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";

export function WhatsappNotifyPreference() {
  const preference = trpc.auth.whatsappPreference.useQuery(undefined, { retry: false });
  const utils = trpc.useUtils();
  const update = trpc.auth.updateWhatsappPreference.useMutation({
    onSuccess: async () => {
      await utils.auth.whatsappPreference.invalidate();
    },
  });
  const [optIn, setOptIn] = useState(false);
  const [phone, setPhone] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!preference.data) return;
    setOptIn(preference.data.optIn);
    setPhone(preference.data.phoneE164 ?? "");
  }, [preference.data]);

  if (preference.isLoading || preference.isError || !preference.data) return null;

  const channelLive = preference.data.channelLive;

  async function save() {
    setNotice(null);
    try {
      const saved = await update.mutateAsync({
        optIn,
        phone: phone.trim() || undefined,
      });
      setNotice(saved.optIn ? WHATSAPP_NOTIFY_UI_COPY.savedOn : WHATSAPP_NOTIFY_UI_COPY.savedOff);
    } catch (error) {
      const message = error instanceof Error ? error.message : WHATSAPP_NOTIFY_UI_COPY.invalidPhone;
      setNotice(message);
    }
  }

  return (
    <section
      data-testid="whatsapp-notify-preference"
      data-channel-live={channelLive ? "true" : "false"}
      className="mb-4 rounded-[1.5rem] border border-slate-200 bg-white px-4 py-4 text-left shadow-sm sm:px-5"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Avisos</p>
      <div className="mt-3 flex items-start justify-between gap-4">
        <label htmlFor="whatsapp-notify-opt-in" className="text-base font-semibold text-slate-950">
          {WHATSAPP_NOTIFY_UI_COPY.title}
        </label>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {channelLive ? (
            <Switch
              id="whatsapp-notify-opt-in"
              data-testid="whatsapp-notify-opt-in"
              checked={optIn}
              disabled={update.isPending}
              onCheckedChange={(next) => {
                setOptIn(next);
                setNotice(null);
              }}
            />
          ) : (
            <span
              data-testid="whatsapp-notify-unavailable"
              aria-disabled="true"
              className="ap-wa-unavailable-control"
            >
              No disponible
            </span>
          )}
          {channelLive ? null : (
            <p data-testid="whatsapp-notify-coming-soon" className="max-w-[14rem] text-right text-xs font-medium leading-4 text-slate-600">
              {WHATSAPP_NOTIFY_UI_COPY.comingSoon}
            </p>
          )}
        </div>
      </div>
      {channelLive ? (
        <>
          <p className="mt-2 text-sm leading-6 text-slate-600">{WHATSAPP_NOTIFY_UI_COPY.help}</p>
          <label htmlFor="whatsapp-notify-phone" className="mt-3 block text-sm font-medium text-slate-800">
            {WHATSAPP_NOTIFY_UI_COPY.phoneLabel}
          </label>
          <input
            id="whatsapp-notify-phone"
            data-testid="whatsapp-notify-phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder={WHATSAPP_NOTIFY_UI_COPY.phonePlaceholder}
            value={phone}
            onChange={(event) => {
              setPhone(event.target.value);
              setNotice(null);
            }}
            className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2 text-base text-slate-950 outline-none focus:border-teal-700"
          />
          <Button
            type="button"
            data-testid="whatsapp-notify-save"
            size="sm"
            className="mt-3 rounded-full bg-teal-700 text-white hover:bg-teal-800"
            disabled={update.isPending}
            onClick={() => {
              void save();
            }}
          >
            {update.isPending ? "Guardando…" : WHATSAPP_NOTIFY_UI_COPY.save}
          </Button>
        </>
      ) : null}
      {notice ? (
        <p role="status" className="mt-3 text-sm leading-6 text-slate-800">
          {notice}
        </p>
      ) : null}
    </section>
  );
}

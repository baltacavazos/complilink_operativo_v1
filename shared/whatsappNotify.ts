import { OFFICIAL_RESULT_NOTIFICATION_COPY } from "./officialResultNotification";

export const WHATSAPP_NOTIFY_UI_COPY = {
  title: "Avísame también por WhatsApp",
  comingSoon: "Pronto podrás activar avisos por WhatsApp.",
  help: "Te escribimos cuando llegue un dato oficial de tu caso. Puedes apagarlo cuando quieras.",
  phoneLabel: "Tu número de México",
  phonePlaceholder: "55 1234 5678",
  save: "Guardar",
  savedOn: "Listo. Te avisamos por WhatsApp cuando haya un dato oficial.",
  savedOff: "Apagado. No te escribimos por WhatsApp.",
  invalidPhone: "Escribe tu número de México, con 10 dígitos.",
  phoneRequired: "Para activarlo, escribe tu número.",
} as const;

/** Same moment as the inbox and the account email, in worker voice. */
export const WHATSAPP_RESULT_NOTIFICATION_COPY = {
  title: OFFICIAL_RESULT_NOTIFICATION_COPY.title,
  body: "Ya llegó un dato oficial para tu caso. Entra a AuditaPatrón para verlo con calma.",
  disclaimer: OFFICIAL_RESULT_NOTIFICATION_COPY.disclaimer,
  actionLabel: OFFICIAL_RESULT_NOTIFICATION_COPY.actionLabel,
} as const;

export const AUDITAR_RESULT_URL = "https://auditapatron.com/auditar";

export function isWhatsappNotifyEnabled(value: string | null | undefined): boolean {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

export function isWhatsappChannelLive(input: {
  enabled: boolean;
  hasCredentials: boolean;
}): boolean {
  return input.enabled && input.hasCredentials;
}

/**
 * Mexican mobiles in E.164: +52 and 10 digits.
 * Accepts 10 local digits, +52…, or the legacy 521 mobile prefix.
 */
export function normalizeMexicanPhoneE164(input: string | null | undefined): string | null {
  const trimmed = String(input ?? "").trim();
  if (!trimmed) return null;

  let digits = trimmed.replace(/[^\d]/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("521") && digits.length === 13) {
    digits = `52${digits.slice(3)}`;
  }
  if (digits.length === 10) {
    digits = `52${digits}`;
  }
  if (!/^52\d{10}$/.test(digits)) return null;
  return `+${digits}`;
}

export function buildWhatsappResultMessage(actionUrl = AUDITAR_RESULT_URL) {
  const copy = WHATSAPP_RESULT_NOTIFICATION_COPY;
  const actionLine = `${copy.actionLabel}: ${actionUrl}`;
  return {
    title: copy.title,
    body: copy.body,
    disclaimer: copy.disclaimer,
    actionLabel: copy.actionLabel,
    actionUrl,
    actionLine,
    text: [copy.title, copy.body, copy.disclaimer, actionLine].join("\n\n"),
  };
}

export function resolveWhatsappPreferenceUpdate(input: {
  channelLive: boolean;
  currentPhoneE164: string | null;
  optIn: boolean;
  phone?: string | null;
}):
  | { ok: true; optIn: boolean; phoneE164: string | null }
  | { ok: false; message: string } {
  if (!input.channelLive) {
    return { ok: false, message: WHATSAPP_NOTIFY_UI_COPY.comingSoon };
  }

  let phoneE164 = input.currentPhoneE164
    ? normalizeMexicanPhoneE164(input.currentPhoneE164)
    : null;

  const phoneProvided = input.phone !== undefined && input.phone !== null && input.phone.trim() !== "";
  if (phoneProvided) {
    phoneE164 = normalizeMexicanPhoneE164(input.phone);
    if (!phoneE164) {
      return { ok: false, message: WHATSAPP_NOTIFY_UI_COPY.invalidPhone };
    }
  }

  if (input.optIn && !phoneE164) {
    return { ok: false, message: WHATSAPP_NOTIFY_UI_COPY.phoneRequired };
  }

  return {
    ok: true,
    optIn: input.optIn,
    phoneE164,
  };
}

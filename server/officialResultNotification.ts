import {
  OFFICIAL_RESULT_NOTIFICATION_COPY,
  hasUsableOfficialFact,
  listUsableOfficialFacts,
} from "@shared/officialResultNotification";
import type { OfficialCheckSummary } from "@shared/officialCheckCopy";
import {
  buildWhatsappResultMessage,
  isWhatsappChannelLive,
  normalizeMexicanPhoneE164,
} from "@shared/whatsappNotify";
import { createHash } from "node:crypto";
import { ENV } from "./_core/env";
import { sendEmailWithResend } from "./authService";
import {
  claimWhatsappNotificationDelivery,
  getUserById,
  releaseWhatsappNotificationDelivery,
} from "./db";
import {
  createWhatsappNotifier,
  readWhatsappCloudConfig,
  type WhatsappNotifier,
} from "./whatsappNotifier";

const AUDITAR_RESULT_URL = "https://auditapatron.com/auditar";

export type OfficialResultEmailDelivery =
  | "sent"
  | "not_usable"
  | "no_user"
  | "no_email"
  | "not_configured"
  | "failed";

export async function sendOfficialResultReadyEmail(params: {
  userId: number | null | undefined;
  officialCheck: OfficialCheckSummary | null | undefined;
}): Promise<OfficialResultEmailDelivery> {
  if (!hasUsableOfficialFact(params.officialCheck)) return "not_usable";
  if (!params.userId) return "no_user";

  try {
    const user = await getUserById(params.userId);
    const email = user?.email?.trim();
    if (!email) return "no_email";

    if (
      !String(ENV.resendApiKey ?? "").trim() ||
      !String(ENV.resendFromEmail ?? "").trim()
    ) {
      console.warn("[Official result notification] Email delivery is not configured.");
      return "not_configured";
    }

    const { title, body, disclaimer, actionLabel } =
      OFFICIAL_RESULT_NOTIFICATION_COPY;

    await sendEmailWithResend({
      to: [email],
      subject: title,
      html: [
        '<div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">',
        `<h2 style="margin:0 0 12px">${title}</h2>`,
        `<p>${body}</p>`,
        `<p>${disclaimer}</p>`,
        `<p style="margin-top:20px"><a href="${AUDITAR_RESULT_URL}" style="display:inline-block;border-radius:999px;background:#0f766e;color:#ffffff;padding:12px 20px;text-decoration:none;font-weight:700">${actionLabel}</a></p>`,
        '<p style="margin-top:20px;color:#475569">También queda guardado en la bandeja de tu cuenta.</p>',
        "</div>",
      ].join(""),
      text: `${title}\n\n${body}\n\n${disclaimer}\n\n${actionLabel}: ${AUDITAR_RESULT_URL}\n\nTambién queda guardado en la bandeja de tu cuenta.`,
    });

    return "sent";
  } catch (error) {
    console.error("[Official result notification] Email delivery failed:", error);
    return "failed";
  }
}

export type OfficialResultWhatsappDelivery =
  | "sent"
  | "not_usable"
  | "flag_off"
  | "not_configured"
  | "no_user"
  | "opt_in_off"
  | "no_phone"
  | "duplicate"
  | "failed";

function optedIntoWhatsapp(value: unknown): boolean {
  return value === true || value === 1;
}

function maskPhone(phoneE164: string): string {
  if (phoneE164.length < 6) return "***";
  return `${phoneE164.slice(0, 3)}******${phoneE164.slice(-2)}`;
}

function fallbackDedupeKey(summary: OfficialCheckSummary | null | undefined): string {
  const facts = listUsableOfficialFacts(summary).join("|");
  return createHash("sha256").update(facts).digest("hex");
}

export async function sendOfficialResultWhatsapp(params: {
  userId: number | null | undefined;
  officialCheck: OfficialCheckSummary | null | undefined;
  dedupeKey?: string | null;
  notifier?: WhatsappNotifier;
}): Promise<OfficialResultWhatsappDelivery> {
  if (!hasUsableOfficialFact(params.officialCheck)) return "not_usable";

  const cloud = readWhatsappCloudConfig(ENV);
  if (!cloud.enabled) {
    console.info("[Official result notification] WhatsApp skipped: flag off.");
    return "flag_off";
  }
  if (!isWhatsappChannelLive({ enabled: cloud.enabled, hasCredentials: cloud.hasCredentials })) {
    console.warn("[Official result notification] WhatsApp skipped: credentials missing.");
    return "not_configured";
  }
  if (!params.userId) return "no_user";

  try {
    const user = await getUserById(params.userId);
    if (!user) return "no_user";
    if (!optedIntoWhatsapp(user.whatsappNotifyOptIn)) {
      console.info("[Official result notification] WhatsApp skipped: opt-in off.");
      return "opt_in_off";
    }

    const phone = normalizeMexicanPhoneE164(user.whatsappPhoneE164);
    if (!phone) {
      console.info("[Official result notification] WhatsApp skipped: no Mexican number.");
      return "no_phone";
    }

    const dedupeKey = (params.dedupeKey?.trim() || fallbackDedupeKey(params.officialCheck)).slice(0, 191);
    const claim = await claimWhatsappNotificationDelivery({
      userId: params.userId,
      dedupeKey,
      phoneE164: phone,
    });
    if (claim === "duplicate") {
      console.info("[Official result notification] WhatsApp skipped: duplicate.", {
        userId: params.userId,
        dedupeKey,
      });
      return "duplicate";
    }
    if (claim !== "claimed") {
      console.warn("[Official result notification] WhatsApp skipped: delivery ledger unavailable.");
      return "failed";
    }

    const message = buildWhatsappResultMessage();
    const notifier = params.notifier ?? createWhatsappNotifier(ENV);
    try {
      await notifier.send({ ...message, toE164: phone });
    } catch (error) {
      await releaseWhatsappNotificationDelivery({
        userId: params.userId,
        dedupeKey,
      }).catch((releaseError) => {
        console.error("[Official result notification] WhatsApp claim release failed:", releaseError);
      });
      console.error("[Official result notification] WhatsApp delivery failed:", error);
      return "failed";
    }

    console.info("[Official result notification] WhatsApp sent.", {
      userId: params.userId,
      phone: maskPhone(phone),
    });
    return "sent";
  } catch (error) {
    console.error("[Official result notification] WhatsApp delivery failed:", error);
    return "failed";
  }
}

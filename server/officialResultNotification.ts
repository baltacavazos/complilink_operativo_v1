import {
  OFFICIAL_RESULT_NOTIFICATION_COPY,
  hasUsableOfficialFact,
} from "@shared/officialResultNotification";
import type { OfficialCheckSummary } from "@shared/officialCheckCopy";
import { ENV } from "./_core/env";
import { sendEmailWithResend } from "./authService";
import { getUserById } from "./db";

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

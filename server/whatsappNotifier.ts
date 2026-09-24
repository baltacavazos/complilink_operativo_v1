import { isWhatsappNotifyEnabled } from "@shared/whatsappNotify";

export type WhatsappOutboundMessage = {
  toE164: string;
  title: string;
  body: string;
  disclaimer: string;
  actionLabel: string;
  actionUrl: string;
  actionLine: string;
  text: string;
};

export interface WhatsappNotifier {
  send(message: WhatsappOutboundMessage): Promise<void>;
}

/** Used when the product switch is off or credentials are missing. */
export class NoopWhatsappNotifier implements WhatsappNotifier {
  async send(): Promise<void> {
    return undefined;
  }
}

export type WhatsappCloudConfig = {
  accessToken: string;
  phoneNumberId: string;
  templateName: string;
  templateLanguage?: string;
  graphVersion?: string;
  fetchImpl?: typeof fetch;
};

const DEFAULT_GRAPH_VERSION = "v22.0";

/**
 * WhatsApp Cloud API template send.
 * Business-initiated notices must use an approved template.
 * Expected template body: {{1}} title, {{2}} body, {{3}} disclaimer, {{4}} CTA.
 */
export class WhatsappCloudApiNotifier implements WhatsappNotifier {
  constructor(private readonly config: WhatsappCloudConfig) {}

  async send(message: WhatsappOutboundMessage): Promise<void> {
    const version = this.config.graphVersion?.trim() || DEFAULT_GRAPH_VERSION;
    const to = message.toE164.replace(/^\+/, "");
    const fetchImpl = this.config.fetchImpl ?? fetch;
    const response = await fetchImpl(
      `https://graph.facebook.com/${version}/${this.config.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          type: "template",
          template: {
            name: this.config.templateName,
            language: { code: this.config.templateLanguage?.trim() || "es_MX" },
            components: [
              {
                type: "body",
                parameters: [
                  { type: "text", text: message.title },
                  { type: "text", text: message.body },
                  { type: "text", text: message.disclaimer },
                  { type: "text", text: message.actionLine },
                ],
              },
            ],
          },
        }),
      },
    );

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`WhatsApp Cloud API ${response.status} ${detail.slice(0, 280)}`.trim());
    }
  }
}

export function readWhatsappCloudConfig(env: {
  whatsappNotifyEnabled?: string;
  whatsappCloudAccessToken?: string;
  whatsappCloudPhoneNumberId?: string;
  whatsappTemplateName?: string;
  whatsappTemplateLanguage?: string;
  whatsappCloudGraphVersion?: string;
}): { enabled: boolean; hasCredentials: boolean; config: WhatsappCloudConfig | null } {
  const enabled = isWhatsappNotifyEnabled(env.whatsappNotifyEnabled);
  const accessToken = String(env.whatsappCloudAccessToken ?? "").trim();
  const phoneNumberId = String(env.whatsappCloudPhoneNumberId ?? "").trim();
  const templateName = String(env.whatsappTemplateName ?? "").trim();
  const hasCredentials = Boolean(accessToken && phoneNumberId && templateName);
  return {
    enabled,
    hasCredentials,
    config: hasCredentials
      ? {
          accessToken,
          phoneNumberId,
          templateName,
          templateLanguage: env.whatsappTemplateLanguage,
          graphVersion: env.whatsappCloudGraphVersion,
        }
      : null,
  };
}

export function createWhatsappNotifier(env: {
  whatsappNotifyEnabled?: string;
  whatsappCloudAccessToken?: string;
  whatsappCloudPhoneNumberId?: string;
  whatsappTemplateName?: string;
  whatsappTemplateLanguage?: string;
}): WhatsappNotifier {
  const { enabled, config } = readWhatsappCloudConfig(env);
  if (!enabled || !config) return new NoopWhatsappNotifier();
  return new WhatsappCloudApiNotifier(config);
}

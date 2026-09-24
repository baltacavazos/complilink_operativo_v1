import { describe, expect, it, vi } from "vitest";
import { buildWhatsappResultMessage } from "@shared/whatsappNotify";
import {
  NoopWhatsappNotifier,
  WhatsappCloudApiNotifier,
  createWhatsappNotifier,
} from "./whatsappNotifier";

const message = {
  ...buildWhatsappResultMessage(),
  toE164: "+525512345678",
};

describe("adaptador de WhatsApp", () => {
  it("no llama a la red cuando el interruptor está apagado o faltan credenciales", async () => {
    const fetchImpl = vi.fn();
    const off = createWhatsappNotifier({
      whatsappNotifyEnabled: "false",
      whatsappCloudAccessToken: "token",
      whatsappCloudPhoneNumberId: "123",
      whatsappTemplateName: "aviso_resultado_oficial",
    });
    const missing = createWhatsappNotifier({
      whatsappNotifyEnabled: "true",
      whatsappCloudAccessToken: "",
      whatsappCloudPhoneNumberId: "123",
      whatsappTemplateName: "aviso_resultado_oficial",
    });

    expect(off).toBeInstanceOf(NoopWhatsappNotifier);
    expect(missing).toBeInstanceOf(NoopWhatsappNotifier);
    await off.send(message);
    await missing.send(message);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("arma la plantilla de Cloud API sin inventar un envío si el fetch está inyectado", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 200 }));
    const notifier = new WhatsappCloudApiNotifier({
      accessToken: "test-token",
      phoneNumberId: "1099",
      templateName: "aviso_resultado_oficial",
      fetchImpl,
    });

    await notifier.send(message);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://graph.facebook.com/v22.0/1099/messages");
    expect(String((init.headers as Record<string, string>).Authorization)).toBe("Bearer test-token");
    const body = JSON.parse(String(init.body));
    expect(body.messaging_product).toBe("whatsapp");
    expect(body.to).toBe("525512345678");
    expect(body.type).toBe("template");
    expect(body.template.name).toBe("aviso_resultado_oficial");
    expect(body.template.language.code).toBe("es_MX");
    expect(body.template.components[0].parameters.map((item: { text: string }) => item.text)).toEqual([
      message.title,
      message.body,
      message.disclaimer,
      message.actionLine,
    ]);
    expect(JSON.stringify(body)).not.toMatch(/tu patrón (sí )?cumple|confirmamos que cumple/i);
  });
});

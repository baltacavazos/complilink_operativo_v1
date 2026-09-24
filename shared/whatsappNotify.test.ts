import { describe, expect, it } from "vitest";
import {
  WHATSAPP_NOTIFY_UI_COPY,
  WHATSAPP_RESULT_NOTIFICATION_COPY,
  buildWhatsappResultMessage,
  isWhatsappChannelLive,
  isWhatsappNotifyEnabled,
  normalizeMexicanPhoneE164,
  resolveWhatsappPreferenceUpdate,
} from "./whatsappNotify";

describe("aviso por WhatsApp", () => {
  it("el interruptor nace apagado salvo un sí explícito", () => {
    expect(isWhatsappNotifyEnabled(undefined)).toBe(false);
    expect(isWhatsappNotifyEnabled("")).toBe(false);
    expect(isWhatsappNotifyEnabled("false")).toBe(false);
    expect(isWhatsappNotifyEnabled("0")).toBe(false);
    expect(isWhatsappNotifyEnabled("off")).toBe(false);
    expect(isWhatsappNotifyEnabled("true")).toBe(true);
    expect(isWhatsappNotifyEnabled("1")).toBe(true);
    expect(isWhatsappNotifyEnabled("ON")).toBe(true);
  });

  it("el canal está live solo con interruptor y credenciales", () => {
    expect(isWhatsappChannelLive({ enabled: false, hasCredentials: true })).toBe(false);
    expect(isWhatsappChannelLive({ enabled: true, hasCredentials: false })).toBe(false);
    expect(isWhatsappChannelLive({ enabled: true, hasCredentials: true })).toBe(true);
  });

  it("guarda el celular mexicano en E.164", () => {
    expect(normalizeMexicanPhoneE164("55 1234 5678")).toBe("+525512345678");
    expect(normalizeMexicanPhoneE164("+52 55 1234 5678")).toBe("+525512345678");
    expect(normalizeMexicanPhoneE164("5215512345678")).toBe("+525512345678");
    expect(normalizeMexicanPhoneE164("+1 415 555 0100")).toBeNull();
    expect(normalizeMexicanPhoneE164("123")).toBeNull();
  });

  it("no deja activar sin número y conserva el número al apagar", () => {
    expect(
      resolveWhatsappPreferenceUpdate({
        channelLive: false,
        currentPhoneE164: null,
        optIn: true,
        phone: "5512345678",
      }),
    ).toEqual({ ok: false, message: WHATSAPP_NOTIFY_UI_COPY.comingSoon });

    expect(
      resolveWhatsappPreferenceUpdate({
        channelLive: true,
        currentPhoneE164: null,
        optIn: true,
        phone: "",
      }).ok,
    ).toBe(false);

    expect(
      resolveWhatsappPreferenceUpdate({
        channelLive: true,
        currentPhoneE164: "+525512345678",
        optIn: false,
      }),
    ).toEqual({ ok: true, optIn: false, phoneE164: "+525512345678" });
  });

  it("el mensaje usa español simple, sin proveedores ni afirmar cumplimiento", () => {
    const message = buildWhatsappResultMessage();
    const copy = [
      message.text,
      ...Object.values(WHATSAPP_RESULT_NOTIFICATION_COPY),
      ...Object.values(WHATSAPP_NOTIFY_UI_COPY),
    ].join(" ");

    expect(message.title).toBe("Ya hay un resultado de tu consulta oficial");
    expect(message.body).toContain("tu caso");
    expect(message.body).not.toContain("expediente");
    expect(message.text).toContain("Este resultado no prueba por sí solo que tu patrón cumpla.");
    expect(message.text).toContain("https://auditapatron.com/auditar");
    expect(copy).not.toMatch(
      /Resend|SendGrid|Helios|CompliLink|APIMarket|Syntage|Meta|Facebook|Cloud API|connector|provider|proveedor/i,
    );
    expect(copy).not.toMatch(/tu patrón (sí )?cumple|confirmamos que cumple/i);
  });
});

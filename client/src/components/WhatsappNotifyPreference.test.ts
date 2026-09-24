import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { WHATSAPP_NOTIFY_UI_COPY } from "@shared/whatsappNotify";

const component = readFileSync(new URL("./WhatsappNotifyPreference.tsx", import.meta.url), "utf8");
const auditar = readFileSync(new URL("../pages/Auditar.tsx", import.meta.url), "utf8");
const copy = Object.values(WHATSAPP_NOTIFY_UI_COPY).join(" ");

describe("preferencia de WhatsApp en Auditar", () => {
  it("se muestra en la cuenta y, mientras el canal no está live, no pide pasos técnicos", () => {
    expect(auditar).toContain("auth.isAuthenticated ? <WhatsappNotifyPreference />");
    expect(component).toContain('data-testid="whatsapp-notify-preference"');
    expect(component).toContain('data-testid="whatsapp-notify-coming-soon"');
    expect(component).toContain("WHATSAPP_NOTIFY_UI_COPY.comingSoon");
    expect(WHATSAPP_NOTIFY_UI_COPY.title).toBe("Avísame también por WhatsApp");
    expect(WHATSAPP_NOTIFY_UI_COPY.comingSoon).toBe("Pronto podrás activar avisos por WhatsApp.");
    expect(copy).toContain("tu caso");
    expect(`${component}\n${copy}`).not.toContain("expediente");
    expect(`${component}\n${copy}`).not.toMatch(
      /Meta|Facebook|Cloud API|Syntage|Resend|Helios|proveedor|token/i,
    );
    expect(`${component}\n${copy}`).not.toMatch(/tu patrón (sí )?cumple|confirmamos que cumple/i);
  });
});

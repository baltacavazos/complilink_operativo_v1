import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OfficialCheckSummary } from "@shared/officialCheckCopy";

const { dbMocks, envState } = vi.hoisted(() => ({
  dbMocks: {
    getUserById: vi.fn(),
    claimWhatsappNotificationDelivery: vi.fn(),
    releaseWhatsappNotificationDelivery: vi.fn(),
  },
  envState: {
    ENV: {
      whatsappNotifyEnabled: "",
      whatsappCloudAccessToken: "",
      whatsappCloudPhoneNumberId: "",
      whatsappTemplateName: "",
      whatsappTemplateLanguage: "es_MX",
      resendApiKey: "resend-test-key",
      resendFromEmail: "avisos@auditapatron.com",
    },
  },
}));

vi.mock("./db", () => dbMocks);
vi.mock("./_core/env", () => envState);

import { sendOfficialResultWhatsapp } from "./officialResultNotification";

function usableSummary(): OfficialCheckSummary {
  return {
    configured: true,
    consentGranted: true,
    overallStatus: "vivo",
    overallLabel: "vivo",
    overallDetail: "",
    checkedAt: "2026-09-24T04:00:00.000Z",
    identity: { nss: false, curp: false, rfc: true },
    checks: [
      {
        source: "sat",
        sourceLabel: "SAT",
        status: "vivo",
        label: "Contestó",
        detail: "Contestó.",
        checkedAt: "2026-09-24T04:00:00.000Z",
        used: { nss: false, curp: false, rfc: true },
        honesty: "live",
        hechos: ["RFC: UIPD9211257I0"],
      },
    ],
  };
}

function pendingSummary(): OfficialCheckSummary {
  return {
    ...usableSummary(),
    overallStatus: "pendiente",
    checks: [
      {
        source: "sat",
        sourceLabel: "SAT",
        status: "pendiente",
        label: "Pendiente",
        detail: "Seguimos intentando.",
        checkedAt: null,
        used: { nss: false, curp: false, rfc: true },
        hechos: ["Todavía no hay una respuesta oficial nueva."],
      },
    ],
  };
}

describe("envío de WhatsApp al llegar un hecho usable", () => {
  const notifier = { send: vi.fn(async () => undefined) };

  beforeEach(() => {
    vi.clearAllMocks();
    envState.ENV.whatsappNotifyEnabled = "true";
    envState.ENV.whatsappCloudAccessToken = "token";
    envState.ENV.whatsappCloudPhoneNumberId = "1099";
    envState.ENV.whatsappTemplateName = "aviso_resultado_oficial";
    dbMocks.getUserById.mockResolvedValue({
      id: 77,
      email: "persona@empresa.com",
      whatsappNotifyOptIn: true,
      whatsappPhoneE164: "+525512345678",
    });
    dbMocks.claimWhatsappNotificationDelivery.mockResolvedValue("claimed");
    dbMocks.releaseWhatsappNotificationDelivery.mockResolvedValue(undefined);
    notifier.send.mockClear();
  });

  it("no envía si el opt-in está apagado", async () => {
    dbMocks.getUserById.mockResolvedValue({
      id: 77,
      whatsappNotifyOptIn: false,
      whatsappPhoneE164: "+525512345678",
    });

    const result = await sendOfficialResultWhatsapp({
      userId: 77,
      officialCheck: usableSummary(),
      dedupeKey: "evt-1",
      notifier,
    });

    expect(result).toBe("opt_in_off");
    expect(notifier.send).not.toHaveBeenCalled();
  });

  it("no envía si el interruptor está apagado aunque el opt-in esté prendido", async () => {
    envState.ENV.whatsappNotifyEnabled = "false";

    const result = await sendOfficialResultWhatsapp({
      userId: 77,
      officialCheck: usableSummary(),
      dedupeKey: "evt-1",
      notifier,
    });

    expect(result).toBe("flag_off");
    expect(notifier.send).not.toHaveBeenCalled();
    expect(dbMocks.getUserById).not.toHaveBeenCalled();
  });

  it("no envía si el hecho no es usable", async () => {
    const result = await sendOfficialResultWhatsapp({
      userId: 77,
      officialCheck: pendingSummary(),
      dedupeKey: "evt-1",
      notifier,
    });

    expect(result).toBe("not_usable");
    expect(notifier.send).not.toHaveBeenCalled();
  });

  it("un webhook duplicado produce un solo envío", async () => {
    dbMocks.claimWhatsappNotificationDelivery
      .mockResolvedValueOnce("claimed")
      .mockResolvedValueOnce("duplicate");

    const first = await sendOfficialResultWhatsapp({
      userId: 77,
      officialCheck: usableSummary(),
      dedupeKey: "evt-1",
      notifier,
    });
    const second = await sendOfficialResultWhatsapp({
      userId: 77,
      officialCheck: usableSummary(),
      dedupeKey: "evt-1",
      notifier,
    });

    expect(first).toBe("sent");
    expect(second).toBe("duplicate");
    expect(notifier.send).toHaveBeenCalledTimes(1);
    const sent = notifier.send.mock.calls[0]?.[0];
    const visible = `${sent?.title} ${sent?.body} ${sent?.disclaimer} ${sent?.actionLine}`;
    expect(visible).not.toMatch(
      /Resend|SendGrid|Helios|CompliLink|APIMarket|Syntage|Meta|Facebook|proveedor/i,
    );
    expect(visible).not.toMatch(/tu patrón (sí )?cumple|confirmamos que cumple/i);
    expect(visible).toContain("no prueba por sí solo");
  });

  it("sin credenciales no envía y no tumba el aviso", async () => {
    envState.ENV.whatsappCloudAccessToken = "";

    const result = await sendOfficialResultWhatsapp({
      userId: 77,
      officialCheck: usableSummary(),
      dedupeKey: "evt-1",
      notifier,
    });

    expect(result).toBe("not_configured");
    expect(notifier.send).not.toHaveBeenCalled();
  });
});

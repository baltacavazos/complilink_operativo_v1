import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  OFFICIAL_CHECK_STATUS_LABEL,
  canDispatchOfficialConsult,
  resolveOfficialCheckDisplay,
} from "@shared/officialCheckCopy";
import { buildOfficialCaseBriefing } from "@shared/officialCaseBriefing";

const source = readFileSync(new URL("./Auditar.tsx", import.meta.url), "utf8");

describe("Auditar consult UI — permiso y CTA", () => {
  it("usa la máquina de permiso y no deja Falta tu permiso encima del checkbox", () => {
    expect(source).toContain("resolveOfficialCheckDisplay");
    expect(source).toContain("pickPromptOfficialCheck");
    expect(source).toContain("shouldPollOfficialCheck");
    expect(source).toContain('data-testid="save-waiting"');
    expect(source).toContain('data-testid="save-notice"');
    expect(source).toContain("Guardando…");
    expect(source).toContain('sonnerToast.success("Listo"');
    expect(source).toContain('data-testid="official-check-waiting"');
    expect(source).toContain("setReceiptAck(\"received\")");
    expect(source).toContain("setReceiptAck(\"failed\")");
    expect(source).toContain("renderReceiptArrival");
    expect(source).not.toMatch(/data-testid="save-waiting"[\s\S]{0,700}animate-pulse/);
    expect(source).not.toMatch(/data-testid="official-check-waiting"[\s\S]{0,400}animate-pulse/);
    expect(source).toContain("officialCheckConsent");
    expect(source).toContain('data-testid="official-check-card"');
    expect(source).toContain(
      "documents.length > 0 && !exampleCaseVisible && !pendingDraft && !lastUpload",
    );
    expect(source).toContain('data-testid="official-check-headline"');
    expect(source).toContain('data-testid="official-check-cta"');
    expect(source).toContain("setOfficialCheckResult(result.officialCheck)");
    expect(source).toContain("setOfficialCheckConsent(true)");
    expect(source).toContain("guestOfficialCheck.useMutation()");
    expect(source).toContain("useGuestOfficialFact");
    expect(source).toContain("GuestOfficialFactNotice");
    expect(source).toContain("handleGuestOfficialCheck");
    expect(source).toContain('data-testid="official-check-chat-cta"');
    expect(source).toContain('data-testid="official-check-hechos"');
    expect(source).toContain("openHeliosCopilot");
    expect(source).toContain("officialCaseBriefing.comparison.seenLine");
    expect(source).toContain("officialCaseBriefing.comparison.nextStepLine");
    expect(source).toContain("officialCaseBriefing.statusLines");
    expect(source).toContain('data-testid="official-check-sources"');
    expect(source).not.toContain("overallStatus !== \"sin_datos\"");
    expect(source).toContain("canDispatchOfficialConsult(officialReceiptIdentity)");
    expect(source).toContain("lastUploadFactSignal.nss");
    expect(source).toContain("lastUploadFactSignal.workerRfc");
    expect(source).toContain("receiptFacts:");
    expect(source).toContain("cardOfficialCheck");
    expect(source).toContain("resolveBriefingWorkerRfc");
    expect(source).toContain("alignVisibleChatWithBriefing");
    expect(source).toContain("officialCaseBriefing.facts.nss");
    expect(source).toContain("officialNowMs");
    expect(source).toContain("nowMs: officialNowMs");
    expect(source).toContain("pendingSinceMs");
    expect(source).toContain("officialPendingSinceRef");
    expect(source).toContain("latestOfficialInboxEvent");
    expect(source).toContain('data-testid="official-result-inbox"');
    expect(source).toContain("OFFICIAL_RESULT_NOTIFICATION_COPY.title");
    expect(source).toContain("Bandeja");
    expect(source).toContain("visibleOfficialChecks");
    expect(source).toContain("visibleOfficialChecks.map");
    expect(source).not.toMatch(/officialCheckSummary\??\.checks\.map/);
    expect(source).not.toMatch(/Helios bridge HMAC|HMAC authentication failed/);
    expect(source).not.toMatch(/APIMARKET/);
  });

  it("con permiso el CTA pasa a Vivo, Pendiente o Falló y nunca a Falta tu permiso", () => {
    const fallo = resolveOfficialCheckDisplay({
      consentGranted: true,
      summary: {
        configured: true,
        consentGranted: true,
        overallStatus: "no_se_pudo",
        overallLabel: OFFICIAL_CHECK_STATUS_LABEL.no_se_pudo,
        overallDetail: "Falló la consulta. Inténtalo más tarde.",
        checkedAt: "2026-09-21T12:00:00.000Z",
        identity: { nss: true, curp: false, rfc: false },
        checks: [],
      },
    });

    expect(fallo.buttonLabel).toBe("Probar de nuevo mañana");
    expect(fallo.headline).toBe("Hoy no se pudo comprobar. No prueba que te engañen.");
    expect(fallo.headline).not.toMatch(/Falló|Esto vimos/);
    expect(fallo.detail).toMatch(/Tu recibo sí se leyó/);
    expect(fallo.detail).not.toMatch(/no de AuditaPatrón|Falló/);
    expect(fallo.detail).not.toMatch(/respuesta usable|fallo de AuditaPatrón/i);
    expect(fallo.silence?.askLabel).toBe("¿Qué implica esto para mi pago?");
    expect(JSON.stringify(fallo)).not.toMatch(/Helios|CompliLink|HMAC|\bcumple\b/i);

    const faltan = resolveOfficialCheckDisplay({
      consentGranted: true,
      summary: {
        configured: true,
        consentGranted: true,
        overallStatus: "sin_datos",
        overallLabel: OFFICIAL_CHECK_STATUS_LABEL.sin_datos,
        overallDetail: "Falta tu NSS en el recibo para consultar.",
        checkedAt: "2026-09-21T12:00:00.000Z",
        identity: { nss: false, curp: true, rfc: false },
        checks: [],
      },
      identity: { nss: false, curp: true, rfc: false },
      missingIdentityDetail: "Falta tu NSS y RFC en el recibo para consultar.",
    });
    expect(faltan.headline).toBe("Faltan datos · 21/09/2026");
    expect(faltan.detail).toMatch(/Falta tu NSS/);
    expect(faltan.headline).not.toBe("Falta tu permiso");
  });

  it("recibo con NSS y RFC visibles nunca pinta Faltan datos mentiroso", () => {
    expect(canDispatchOfficialConsult({ nss: true, curp: false, rfc: true })).toBe(true);
    const briefing = buildOfficialCaseBriefing({
      officialCheck: {
        configured: true,
        consentGranted: true,
        overallStatus: "sin_datos",
        overallLabel: OFFICIAL_CHECK_STATUS_LABEL.sin_datos,
        overallDetail: "Falta tu NSS, CURP o RFC en el recibo para consultar.",
        checkedAt: "2026-09-21T12:00:00.000Z",
        identity: { nss: false, curp: false, rfc: false },
        checks: [],
        chatAnchor: {
          imss: {
            fuente: "imss",
            estado: "failed",
            fecha: "2026-09-21T12:00:00.000Z",
            hechos: ["Falta tu NSS, CURP o RFC en el recibo para consultar."],
            motivoFallo: "Falta tu NSS, CURP o RFC en el recibo para consultar.",
            missingFields: ["nss", "curp", "rfc"],
          },
          sat: {
            fuente: "sat",
            estado: "failed",
            fecha: "2026-09-21T12:00:00.000Z",
            hechos: ["Falta tu NSS, CURP o RFC en el recibo para consultar."],
            motivoFallo: "Falta tu NSS, CURP o RFC en el recibo para consultar.",
            missingFields: ["nss", "curp", "rfc"],
          },
          infonavit: {
            fuente: "infonavit",
            estado: "failed",
            fecha: "2026-09-21T12:00:00.000Z",
            hechos: ["Falta el CURP para consultar Infonavit."],
            motivoFallo: "Falta el CURP para consultar Infonavit.",
            missingFields: ["curp"],
          },
        },
      },
      facts: { nss: "12345678901", workerRfc: "XAXX010101000", netAmount: "$12,450" },
    });
    const display = resolveOfficialCheckDisplay({
      consentGranted: true,
      summary: briefing.officialCheck,
      identity: { nss: true, curp: false, rfc: true },
      missingIdentityDetail: briefing.missingIdentityDetail,
    });

    expect(display.headline).not.toMatch(/Faltan datos/i);
    expect(display.buttonLabel).not.toMatch(/Faltan datos/i);
    expect(display.status).not.toBe("sin_datos");
    expect(briefing.statusLines.some((line) => /IMSS: Faltan datos/.test(line))).toBe(false);
    expect(briefing.statusLines.some((line) => /IMSS y SAT: Faltan datos/.test(line))).toBe(false);
    expect(briefing.missingIdentityDetail).not.toMatch(/Falta tu NSS/);
    expect(source).toContain("canDispatchOfficialConsult");
    expect(JSON.stringify({ display, briefing })).not.toMatch(/Helios|CompliLink|HMAC|\bcumple\b/i);
  });
});

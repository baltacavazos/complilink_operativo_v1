import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  OFFICIAL_CHECK_STATUS_LABEL,
  resolveOfficialCheckDisplay,
} from "@shared/officialCheckCopy";

const source = readFileSync(new URL("./Auditar.tsx", import.meta.url), "utf8");

describe("Auditar consult UI — permiso y CTA", () => {
  it("usa la máquina de permiso y no deja Falta tu permiso encima del checkbox", () => {
    expect(source).toContain("resolveOfficialCheckDisplay");
    expect(source).toContain("pickHonestOfficialCheck");
    expect(source).toContain("officialCheckConsent");
    expect(source).toContain('data-testid="official-check-card"');
    expect(source).toContain('data-testid="official-check-headline"');
    expect(source).toContain('data-testid="official-check-cta"');
    expect(source).toContain("setOfficialCheckResult(result.officialCheck)");
    expect(source).toContain("setOfficialCheckConsent(true)");
    expect(source).toContain('data-testid="official-check-chat-cta"');
    expect(source).toContain('data-testid="official-check-hechos"');
    expect(source).toContain("openHeliosCopilot");
    expect(source).toContain("officialCaseBriefing.comparison.seenLine");
    expect(source).toContain("officialCaseBriefing.comparison.nextStepLine");
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

    expect(fallo.buttonLabel).toBe("Falló");
    expect(fallo.headline).toBe("Falló · 21/09/2026");
    expect(fallo.headline).not.toBe("Falta tu permiso");
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
        identity: { nss: false, curp: true, rfc: true },
        checks: [],
      },
      missingIdentityDetail: "Falta tu NSS en el recibo para consultar.",
    });
    expect(faltan.headline).toBe("Faltan datos · 21/09/2026");
    expect(faltan.detail).toMatch(/Falta tu NSS/);
    expect(faltan.headline).not.toBe("Falta tu permiso");
  });
});

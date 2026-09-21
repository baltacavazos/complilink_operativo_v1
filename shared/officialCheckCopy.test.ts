import { describe, expect, it } from "vitest";

import {
  OFFICIAL_CHECK_BUTTON,
  OFFICIAL_CHECK_CONSENT,
  OFFICIAL_CHECK_LOADING_LABEL,
  OFFICIAL_CHECK_READY_DETAIL,
  OFFICIAL_CHECK_READY_HEADLINE,
  OFFICIAL_CHECK_STATUS_DETAIL,
  OFFICIAL_CHECK_STATUS_LABEL,
  assertNoInternalBrands,
  pickHonestOfficialCheck,
  resolveOfficialCheckDisplay,
  type OfficialCheckSummary,
} from "./officialCheckCopy";

function summary(status: OfficialCheckSummary["overallStatus"], extra?: Partial<OfficialCheckSummary>): OfficialCheckSummary {
  return {
    configured: true,
    consentGranted: status !== "sin_permiso",
    overallStatus: status,
    overallLabel: OFFICIAL_CHECK_STATUS_LABEL[status],
    overallDetail: OFFICIAL_CHECK_STATUS_DETAIL[status],
    checkedAt: extra?.checkedAt ?? null,
    identity: { nss: true, curp: false, rfc: false },
    checks: extra?.checks ?? [],
    ...extra,
  };
}

function expectNoInternalOrVerdictInvented(value: string) {
  expect(assertNoInternalBrands(value)).toBe(true);
  expect(value).not.toMatch(/Helios|CompliLink|HMAC/i);
  expect(value).not.toMatch(/\b(sí )?cumple\b/i);
}

describe("copia de consulta IMSS/SAT según permiso", () => {
  it("sin checkbox muestra Falta tu permiso y no inventa un estado del instituto", () => {
    const display = resolveOfficialCheckDisplay({
      consentGranted: false,
      summary: summary("sin_permiso"),
    });

    expect(display.headline).toBe("Falta tu permiso");
    expect(display.detail).toBe("Falta tu permiso para consultar IMSS y SAT.");
    expect(display.buttonLabel).toBe(OFFICIAL_CHECK_BUTTON);
    expect(display.status).toBe("sin_permiso");
    expect(display.showPermissionCopy).toBe(true);
    expect(display.headline).not.toMatch(/Vivo|Pendiente|Falló/);
    expectNoInternalOrVerdictInvented(display.headline);
    expect(OFFICIAL_CHECK_CONSENT).not.toMatch(/Helios|CompliLink|HMAC/i);
    expect(OFFICIAL_CHECK_CONSENT).toMatch(/No inventamos que tu patrón cumple/);
  });

  it("con checkbox nunca muestra Falta tu permiso, aunque el servidor siga en sin_permiso", () => {
    const display = resolveOfficialCheckDisplay({
      consentGranted: true,
      summary: summary("sin_permiso"),
    });

    expect(display.headline).not.toMatch(/Falta tu permiso/i);
    expect(display.detail).not.toMatch(/Falta tu permiso/i);
    expect(display.buttonLabel).toBe(OFFICIAL_CHECK_BUTTON);
    expect(display.headline).toBe(OFFICIAL_CHECK_READY_HEADLINE);
    expect(display.detail).toBe(OFFICIAL_CHECK_READY_DETAIL);
    expect(display.status).toBe("listo");
    expect(display.showPermissionCopy).toBe(false);
    expect(display.detail).toMatch(/No inventamos que tu patrón cumple/);
    expect(assertNoInternalBrands(display.detail)).toBe(true);
    expect(display.detail).not.toMatch(/Helios|CompliLink|HMAC/i);
  });

  it("con checkbox y en curso muestra Consultando..., no Falta tu permiso", () => {
    const display = resolveOfficialCheckDisplay({
      consentGranted: true,
      isPending: true,
      summary: summary("sin_permiso"),
    });

    expect(display.headline).toBe(OFFICIAL_CHECK_LOADING_LABEL);
    expect(display.buttonLabel).toBe(OFFICIAL_CHECK_LOADING_LABEL);
    expect(display.status).toBe("consultando");
    expect(display.headline).not.toMatch(/Falta tu permiso/i);
    expect(display.detail).not.toMatch(/Falta tu permiso|Helios|HMAC|cumple/i);
  });

  it("con checkbox refleja Vivo, Pendiente y Falló del puente, nunca cumple", () => {
    const vivo = resolveOfficialCheckDisplay({
      consentGranted: true,
      summary: summary("vivo", { checkedAt: "2026-09-21T15:30:00.000Z" }),
    });
    const pendiente = resolveOfficialCheckDisplay({
      consentGranted: true,
      summary: summary("pendiente"),
    });
    const fallo = resolveOfficialCheckDisplay({
      consentGranted: true,
      summary: summary("no_se_pudo"),
    });

    expect(vivo.headline).toBe("Vivo · 21/09/2026");
    expect(vivo.buttonLabel).toBe("Vivo");
    expect(vivo.status).toBe("vivo");
    expect(pendiente.headline).toBe("Pendiente");
    expect(pendiente.buttonLabel).toBe("Pendiente");
    expect(fallo.headline).toBe("Falló");
    expect(fallo.buttonLabel).toBe("Falló");

    for (const display of [vivo, pendiente, fallo]) {
      expect(display.headline).not.toMatch(/Falta tu permiso/i);
      expect(display.buttonLabel).not.toMatch(/Falta tu permiso|Helios|HMAC/i);
      expect(display.buttonLabel).not.toMatch(/\bcumple\b/i);
      expect(display.detail).not.toMatch(/Helios|CompliLink|HMAC/i);
    }
    expect(vivo.detail).toMatch(/No significa que tu patrón cumple/);
  });

  it("con permiso elige el acuse honesto y descarta un sin_permiso viejo", () => {
    const picked = pickHonestOfficialCheck({
      consentGranted: true,
      candidates: [summary("sin_permiso"), summary("no_se_pudo"), summary("vivo")],
    });

    expect(picked?.overallStatus).toBe("no_se_pudo");
    expect(picked?.overallLabel).toBe("Falló");
    expect(pickHonestOfficialCheck({
      consentGranted: true,
      candidates: [summary("sin_permiso"), null],
    })).toBeNull();
  });
});

import { describe, expect, it } from "vitest";

import {
  AUDITAPATRON_LOGO_ASSETS,
  AuditaPatronLogo,
  AuditaPatronLogoIcon,
  AuditaPatronLogoWordmark,
} from "./AuditaPatronLogo";

describe("AuditaPatronLogo", () => {
  it("expone los activos finales esperados para logo, wordmark e icono", () => {
    expect(AUDITAPATRON_LOGO_ASSETS.full).toContain("auditapatron-logo-final_");
    expect(AUDITAPATRON_LOGO_ASSETS.wordmark).toContain("auditapatron-wordmark-final_");
    expect(AUDITAPATRON_LOGO_ASSETS.icon).toContain("auditapatron-icon-base_");
  });

  it("usa el logo completo con lema cuando la variante es full", () => {
    const element = AuditaPatronLogo({ variant: "full" });
    const image = element.props.children;

    expect(image.props.src).toBe(AUDITAPATRON_LOGO_ASSETS.full);
    expect(image.props.alt).toBe("AuditaPatron - Conoce tus derechos");
  });

  it("usa el wordmark compacto sin lema para cabeceras", () => {
    const element = AuditaPatronLogoWordmark({});
    const image = element.props.children;

    expect(image.props.src).toBe(AUDITAPATRON_LOGO_ASSETS.wordmark);
    expect(image.props.alt).toBe("AuditaPatron");
  });

  it("usa la lupa aislada para iconografía pequeña", () => {
    const element = AuditaPatronLogoIcon({});
    const image = element.props.children;

    expect(image.props.src).toBe(AUDITAPATRON_LOGO_ASSETS.icon);
    expect(image.props.alt).toBe("AuditaPatron");
  });
});

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

  it("usa una variante segura de cabecera con isotipo y wordmark tipográfico legible", () => {
    const element = AuditaPatronLogoWordmark({});
    const content = element.props.children;
    const icon = content.props.children[0];
    const label = content.props.children[1];

    expect(element.props["data-brand-variant"]).toBe("appbar");
    expect(icon.props.src).toBe(AUDITAPATRON_LOGO_ASSETS.icon);
    expect(icon.props.alt).toBe("AuditaPatron");
    expect(label.props.children).toBe("AUDITAPATRON");
  });

  it("usa la lupa aislada para iconografía pequeña", () => {
    const element = AuditaPatronLogoIcon({});
    const image = element.props.children;

    expect(element.props["data-brand-variant"]).toBe("icon");
    expect(image.props.src).toBe(AUDITAPATRON_LOGO_ASSETS.icon);
    expect(image.props.alt).toBe("AuditaPatron");
  });
});

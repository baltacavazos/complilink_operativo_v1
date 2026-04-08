import { describe, expect, it } from "vitest";

import { AUDITAPATRON_LOGO_ASSETS, AuditaPatronLogo } from "./AuditaPatronLogo";

describe("AuditaPatronLogo", () => {
  it("expone los activos finales esperados para logo, wordmark, icono y lockup dark de header", () => {
    expect(AUDITAPATRON_LOGO_ASSETS.full).toContain("auditapatron-logo-final_");
    expect(AUDITAPATRON_LOGO_ASSETS.wordmark).toContain("auditapatron-wordmark-final_");
    expect(AUDITAPATRON_LOGO_ASSETS.icon).toContain("auditapatron-icon-base_");
    expect(AUDITAPATRON_LOGO_ASSETS.headerDark).toContain("header-lockup-dark_");
  });

  it("usa el logo completo con lema cuando la variante es full", () => {
    const element = AuditaPatronLogo({ variant: "full" });
    const image = element.props.children;

    expect(element.props["data-brand-variant"]).toBe("full");
    expect(image.props.src).toBe(AUDITAPATRON_LOGO_ASSETS.full);
    expect(image.props.alt).toBe("AuditaPatron - Conoce tus derechos");
  });

  it("usa un lockup específico para fondo oscuro en la variante compacta de cabecera", () => {
    const element = AuditaPatronLogo({ variant: "compact", showTagline: false, surface: "dark" });
    const image = element.props.children;

    expect(element.props["data-brand-variant"]).toBe("appbar");
    expect(element.props["data-brand-surface"]).toBe("dark");
    expect(image.props.src).toBe(AUDITAPATRON_LOGO_ASSETS.headerDark);
    expect(image.props.className).toContain("drop-shadow");
  });

  it("resuelve la variante adaptativa con un wordmark claro y otro para dark mode", () => {
    const element = AuditaPatronLogo({ variant: "compact", showTagline: false, surface: "adaptive" });
    const images = element.props.children;

    expect(Array.isArray(images)).toBe(true);
    expect(images).toHaveLength(2);
    expect(images[0].props.src).toBe(AUDITAPATRON_LOGO_ASSETS.wordmark);
    expect(images[0].props.className).toContain("dark:hidden");
    expect(images[1].props.src).toBe(AUDITAPATRON_LOGO_ASSETS.headerDark);
    expect(images[1].props.className).toContain("dark:block");
  });

  it("usa la lupa aislada para iconografía pequeña", () => {
    const element = AuditaPatronLogo({ variant: "icon", showTagline: false });
    const image = element.props.children;

    expect(element.props["data-brand-variant"]).toBe("icon");
    expect(image.props.src).toBe(AUDITAPATRON_LOGO_ASSETS.icon);
    expect(image.props.alt).toBe("AuditaPatron");
  });
});

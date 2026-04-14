import { describe, expect, it } from "vitest";
import { getAuditapatronPricingExperience } from "./pricingExperience";

describe("getAuditapatronPricingExperience", () => {
  it("mantiene el landing sin precio visible y evita copy interno visible al usuario final", () => {
    const experience = getAuditapatronPricingExperience(0);

    expect(experience.landing.showPrice).toBe(false);
    expect(experience.landing.eyebrow).toContain("gratis");
    expect(experience.landing.title).toContain("auditoría clara y confiable");
    expect(experience.landing.description).toContain("Sube tu primer documento y entiende tu situación laboral en minutos.");
    expect(experience.landing.description).not.toContain("El landing debe");
    expect(experience.landing.description).not.toContain("vender confianza");
    expect(experience.landing.description).not.toContain("cuando realmente te sirvan");
    expect(experience.landing.description).not.toContain("opciones adicionales");
    expect(experience.landing.principles).toContain("Empieza gratis con tu primer documento.");
  });

  it("muestra el precio solo dentro de la plataforma como mejora opcional", () => {
    const experience = getAuditapatronPricingExperience(3);

    expect(experience.platform.showPrice).toBe(true);
    expect(experience.platform.priceLabel).toBe("$199 MXN pago único");
    expect(experience.platform.reassurance).toContain("sin pagar");
    expect(experience.platform.eyebrow).toContain("contexto");
    expect(experience.platform.description).not.toContain("cuando realmente te sirvan");
    expect(experience.platform.description).not.toContain("sin interrumpir");
  });
});

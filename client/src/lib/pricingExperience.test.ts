import { describe, expect, it } from "vitest";
import { getAuditapatronPricingExperience } from "./pricingExperience";

describe("getAuditapatronPricingExperience", () => {
  it("mantiene el landing sin precio visible y con narrativa gratuita dominante", () => {
    const experience = getAuditapatronPricingExperience(0);

    expect(experience.landing.showPrice).toBe(false);
    expect(experience.landing.eyebrow).toContain("gratis");
    expect(experience.landing.principles).toContain("Empieza gratis con tu primer documento.");
  });

  it("muestra el precio solo dentro de la plataforma como mejora opcional", () => {
    const experience = getAuditapatronPricingExperience(3);

    expect(experience.platform.showPrice).toBe(true);
    expect(experience.platform.priceLabel).toBe("$199 MXN pago único");
    expect(experience.platform.reassurance).toContain("sin pagar");
    expect(experience.platform.eyebrow).toContain("contexto");
  });
});

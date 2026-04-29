import { describe, expect, it } from "vitest";
import { getAuditapatronPricingExperience } from "./pricingExperience";

describe("getAuditapatronPricingExperience", () => {
  it("mantiene el landing freemium sin precio visible pero con entrada gratuita explícita", () => {
    const experience = getAuditapatronPricingExperience(0);

    expect(experience.landing.showPrice).toBe(false);
    expect(experience.landing.eyebrow).toContain("Freemium");
    expect(experience.landing.title).toContain("Empieza gratis");
    expect(experience.landing.description).toContain("sin tarjeta");
    expect(experience.landing.principles).toContain(
      "La primera lectura sigue siendo gratis."
    );
    expect(experience.landing.principles.some(item => item.includes("3 documentos"))).toBe(true);
  });

  it("expone dentro de la plataforma el ladder completo con precio desde Esencial", () => {
    const experience = getAuditapatronPricingExperience(3);

    expect(experience.platform.showPrice).toBe(true);
    expect(experience.platform.priceLabel).toContain("79");
    expect(experience.platform.primaryCtaLabel).toContain("Ver planes");
    expect(experience.platform.reassurance).toContain("parte gratuita");
    expect(experience.platform.plans).toHaveLength(3);
    expect(experience.platform.plans.map(plan => plan.key)).toEqual([
      "free",
      "essential",
      "pro",
    ]);
    expect(
      experience.platform.plans.find(plan => plan.key === "essential")?.highlighted
    ).toBe(true);
  });

  it("incluye productos one-shot para informe premium y expediente para abogado", () => {
    const experience = getAuditapatronPricingExperience(1);

    expect(experience.platform.oneShots).toHaveLength(2);
    expect(
      experience.platform.oneShots.map(product => product.key)
    ).toEqual(["informe_premium", "expediente_abogado"]);
    expect(
      experience.platform.oneShots.some(product =>
        product.description.toLowerCase().includes("expediente")
      )
    ).toBe(true);
  });
});

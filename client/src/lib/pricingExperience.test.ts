import { describe, expect, it } from "vitest";
import { getAuditapatronPricingExperience } from "./pricingExperience";

describe("getAuditapatronPricingExperience", () => {
  it("mantiene el landing freemium sin precio visible pero con entrada gratuita explícita", () => {
    const experience = getAuditapatronPricingExperience(0);

    expect(experience.landing.showPrice).toBe(false);
    expect(experience.landing.eyebrow).toContain("Gratis para revisar tu recibo");
    expect(experience.landing.title).toContain("Empieza gratis");
    expect(experience.landing.description).toContain("sin tarjeta");
    expect(experience.landing.description).toContain("un recibo");
    expect(experience.landing.principles).toContain(
      "La primera lectura sigue siendo gratis."
    );
    expect(experience.landing.principles).toContain(
      "El plan gratis incluye un documento por expediente."
    );
    expect(experience.landing.principles.some(item => /3 documentos|varios recibos/i.test(item))).toBe(false);
  });

  it("expone dentro de la plataforma el ladder completo con precio desde Esencial", () => {
    const experience = getAuditapatronPricingExperience(3);

    expect(experience.platform.showPrice).toBe(true);
    expect(experience.platform.priceLabel).toContain("79");
    expect(experience.platform.primaryCtaLabel).toContain("Ver planes");
    expect(experience.platform.reassurance).toContain("La primera lectura es gratis");
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

  it("trata un documento como el tope del plan gratis", () => {
    const belowLimit = getAuditapatronPricingExperience(0);
    const atLimit = getAuditapatronPricingExperience(1);
    const freePlan = atLimit.platform.plans.find(plan => plan.key === "free");

    expect(belowLimit.platform.description).not.toMatch(/tramo gratuito/i);
    expect(atLimit.platform.description).toMatch(/tramo gratuito/i);
    expect(freePlan?.description).not.toMatch(/3 documentos|varios recibos/i);
    expect(freePlan?.featureBullets.join(" ")).toMatch(/1 documento por expediente/i);
    expect(freePlan?.featureBullets.join(" ")).not.toMatch(/3 documentos|varios recibos/i);
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

  it("no deja Helios ni CompliLink en el copy de planes visible", () => {
    const experience = getAuditapatronPricingExperience(3);
    expect(JSON.stringify(experience)).not.toMatch(/Helios|CompliLink|complilink/i);
  });
});

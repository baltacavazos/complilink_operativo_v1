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
      "El plan gratis incluye un documento."
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

    expect(belowLimit.platform.description).not.toContain(
      "En el plan gratis ya usaste tu documento.",
    );
    expect(atLimit.platform.description).toBe(
      "En el plan gratis ya usaste tu documento. Si quieres subir otro, activa Audita Esencial.",
    );
    expect(freePlan?.description).not.toMatch(/3 documentos|varios recibos/i);
    expect(freePlan?.featureBullets.join(" ")).toMatch(/1 documento\. Primera lectura y asesor básico/i);
    expect(freePlan?.featureBullets.join(" ")).not.toMatch(/3 documentos|varios recibos/i);
  });

  it("incluye el informe y el paquete para tu abogado, sin decir expediente", () => {
    const experience = getAuditapatronPricingExperience(1);
    const informe = experience.platform.oneShots.find(product => product.key === "informe_premium");
    const lawyer = experience.platform.oneShots.find(product => product.key === "expediente_abogado");

    expect(experience.platform.oneShots).toHaveLength(2);
    expect(
      experience.platform.oneShots.map(product => product.key)
    ).toEqual(["informe_premium", "expediente_abogado"]);
    expect(lawyer?.name).toBe("Paquete para tu abogado");
    expect(lawyer?.ctaLabel).toBe("Preparar paquete");
    expect(lawyer?.featureBullets.join(" ")).not.toMatch(/expediente/i);
    expect(informe?.description).not.toMatch(/expediente/i);
    expect(informe?.deliveryLabel).not.toMatch(/expediente/i);
    const visible = [
      ...experience.platform.plans.flatMap((plan) => [
        plan.name,
        plan.headline,
        plan.description,
        plan.ctaLabel,
        plan.badge,
        ...plan.featureBullets,
      ]),
      ...experience.platform.oneShots.flatMap((product) => [
        product.name,
        product.description,
        product.deliveryLabel,
        product.ctaLabel,
        product.badge,
        ...product.featureBullets,
      ]),
      experience.platform.title,
      experience.platform.description,
      experience.platform.reassurance,
    ].join(" ");
    expect(visible).not.toMatch(/expediente|revalidacion/i);
  });

  it("no deja Helios ni CompliLink en el copy de planes visible", () => {
    const experience = getAuditapatronPricingExperience(3);
    expect(JSON.stringify(experience)).not.toMatch(/Helios|CompliLink|complilink/i);
  });
});

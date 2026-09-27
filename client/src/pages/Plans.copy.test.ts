import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  getVisibleCatalogPlans,
  HOME_HERO_ASSISTANT_PILL_SUPPORT,
  HOME_HERO_ASSISTANT_PILL_TITLE,
  PLAN_PRIMARY_CTA,
} from "../../../shared/conversionCopy";
import { getAuditapatronPricingExperience } from "../lib/pricingExperience";

const currentDir = dirname(fileURLToPath(import.meta.url));

function readPlans() {
  return readFileSync(resolve(currentDir, "Plans.tsx"), "utf8");
}

const FORBIDDEN_VISIBLE = /expediente|\bHUD\b|\bHelios\b|revalidaci/i;

function visiblePlansCopy() {
  const plans = getVisibleCatalogPlans();
  const oneShots = getAuditapatronPricingExperience(0).platform.oneShots;

  return [
    ...plans.flatMap((plan) => [
      plan.key === "free" ? "Gratis · $0 · 1 documento" : plan.name,
      plan.key === "free" ? "" : plan.badge,
      plan.key === "free" ? "" : plan.priceLabel,
      plan.headline,
      plan.key === "free" ? plan.ctaLabel : PLAN_PRIMARY_CTA,
      ...plan.includes,
    ]),
    ...oneShots.flatMap((product) => [
      product.name,
      product.badge,
      product.priceLabel,
      product.description,
      product.ctaLabel,
      ...product.featureBullets,
    ]),
    "Productos puntuales",
    "Útiles cuando no quieres una suscripción, sino un entregable concreto.",
  ].join("\n");
}

describe("Plans · título gratis y one-shots", () => {
  it("unifica el título del plan gratis y no usa Audita Gratis en la card", () => {
    const plans = readPlans();
    const freeTitle = plans.match(/plan\.key === "free" \? "([^"]+)" : plan\.name/);

    expect(freeTitle?.[1]).toBe("Gratis · $0 · 1 documento");
    expect(freeTitle?.[1]).not.toBe("Audita Gratis");
    expect(plans).toContain('plan.key === "free" ? "Gratis · $0 · 1 documento" : plan.name');
    expect(plans).toContain("{plan.key === \"free\" ? null : (");
    expect(plans).not.toContain("Audita Gratis");
    expect(visiblePlansCopy()).toContain("Gratis · $0 · 1 documento");
    expect(visiblePlansCopy()).not.toContain("Audita Gratis");
  });

  it("muestra Paquete para tu abogado y el CTA navega a /auditar", () => {
    const plans = readPlans();
    const cardsAt = plans.indexOf('data-testid="planes-plan-cards"');
    const oneShotsAt = plans.indexOf('data-testid="planes-one-shots"');
    const lawyer = getAuditapatronPricingExperience(0).platform.oneShots.find(
      (product) => product.key === "expediente_abogado",
    );
    const visible = visiblePlansCopy();

    expect(oneShotsAt).toBeGreaterThan(cardsAt);
    expect(plans).toContain("getAuditapatronPricingExperience(0).platform.oneShots");
    expect(plans).toContain("{product.name}");
    expect(plans).toContain('<a href="/auditar">{product.ctaLabel}</a>');
    expect(plans).not.toMatch(/stripe|checkout/i);
    expect(lawyer?.name).toBe("Paquete para tu abogado");
    expect(lawyer?.ctaLabel).toBe("Preparar paquete");
    expect(visible).toContain("Paquete para tu abogado");
    expect(visible).toContain("Preparar paquete");
    expect(visible).not.toMatch(FORBIDDEN_VISIBLE);
  });

  it("muestra el nombre del asistente y no la marca Asesor laboral en las cards", () => {
    const plans = readPlans();
    const header = plans.slice(0, plans.indexOf('data-testid="planes-plan-cards"'));
    const visible = visiblePlansCopy();
    const pro = getVisibleCatalogPlans().find((plan) => plan.key === "pro");

    expect(HOME_HERO_ASSISTANT_PILL_TITLE).toBe("Asistente laboral inteligente en tu bolsillo");
    expect(HOME_HERO_ASSISTANT_PILL_SUPPORT).toBe("Te explica tu caso, no un FAQ");
    expect(plans).toContain("{HOME_HERO_ASSISTANT_PILL_TITLE}");
    expect(plans).toContain("{HOME_HERO_ASSISTANT_PILL_SUPPORT}");
    expect(plans).toContain('data-testid="planes-assistant-title"');
    expect(header.indexOf('data-testid="planes-assistant-title"')).toBeGreaterThan(
      header.indexOf("Elige un plan, con precio en MXN al mes"),
    );
    expect(plans).not.toContain("sanitizeClientVisibleCopy");
    expect(pro?.monthlyPriceMx).toBe(231);
    expect(pro?.includes).toContain("Asistente laboral con el historial de tu caso.");
    expect(getVisibleCatalogPlans().find((plan) => plan.key === "free")?.ctaLabel).toBe(
      "Revisar mi recibo gratis",
    );
    expect(visible).toContain("Asistente laboral con el historial de tu caso.");
    expect(visible).toContain("1 documento. Primera lectura y asesor básico.");
    expect(visible).toContain("el asesor recuerda lo que ya vimos");
    expect(visible).not.toMatch(/Asesor laboral|copiloto/i);
    expect(plans).toContain("Hoy no se cobra.");
  });
});

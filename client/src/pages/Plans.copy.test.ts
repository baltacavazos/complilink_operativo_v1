import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { describe, expect, it } from "vitest";

import { getVisibleCatalogPlans, PLAN_PRIMARY_CTA } from "../../../shared/conversionCopy";
import { getAuditapatronPricingExperience } from "../lib/pricingExperience";
import Plans from "./Plans";

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

  it("renderiza /planes con el título gratis, el paquete y sin cobro", () => {
    const html = renderToStaticMarkup(createElement(Plans));
    const oneShotsAt = html.indexOf('data-testid="planes-one-shots"');
    const oneShotHtml = html.slice(oneShotsAt);

    expect(html).toContain("Gratis · $0 · 1 documento");
    expect(html).not.toContain("Audita Gratis");
    expect(html.split("$0").length - 1).toBe(1);
    expect(oneShotsAt).toBeGreaterThan(html.indexOf('data-testid="planes-plan-cards"'));
    expect(oneShotHtml).toContain("Paquete para tu abogado");
    expect(oneShotHtml).toMatch(/<a [^>]*href="\/auditar"[^>]*>Preparar paquete<\/a>/);
    expect(html).not.toMatch(/stripe|checkout/i);
    expect(html).not.toMatch(FORBIDDEN_VISIBLE);
  });
});

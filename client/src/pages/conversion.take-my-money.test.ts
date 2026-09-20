import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  COMMERCE_PLANS,
  formatCommerceDocumentLimitBullet,
} from "../../../shared/commerce";
import {
  BILLING_SOFT_NOTE,
  FIRST_WIN_PROMISE,
  GUARANTEE_LINE,
  PLAN_NAV_CTA,
  PLAN_PRIMARY_CTA,
  SOCIAL_PROOF_LINE,
  getVisiblePaidPlans,
} from "../../../shared/conversionCopy";

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(currentDir, "../../..");

function readPage(fileName: string) {
  return readFileSync(resolve(currentDir, `${fileName}.tsx`), "utf8");
}

function readRepo(...segments: string[]) {
  return readFileSync(resolve(repoRoot, ...segments), "utf8");
}

describe("Claridad — take my money without live charge", () => {
  it("muestra 2 planes pagos con precio MXN y un CTA Elegir plan", () => {
    const plans = getVisiblePaidPlans();
    const payments = readPage("Payments");
    const home = readPage("Home");
    const plansPage = readPage("Plans");
    const app = readRepo("client", "src", "App.tsx");
    const billing = readRepo("server", "stripeBilling.ts");

    expect(billing).toContain("export const LIVE_BILLING_ENABLED = false;");
    expect(app).toContain('<Route path={"/planes"} component={Plans} />');
    expect(app).toContain('<Route path={"/precios"} component={Plans} />');
    expect(plans).toHaveLength(2);
    expect(plans.map((plan) => plan.key)).toEqual(["essential", "pro"]);
    expect(plans.every((plan) => /MXN al mes/.test(plan.priceLabel))).toBe(true);
    expect(plans.some((plan) => plan.monthlyPriceMx === 79)).toBe(true);
    expect(plans.some((plan) => plan.monthlyPriceMx === 199)).toBe(true);
    expect(payments).toContain("pagos-plan-cards");
    expect(payments).toContain(PLAN_PRIMARY_CTA);
    expect(payments).toContain("MXN al mes");
    expect(plansPage).toContain("planes-plan-cards");
    expect(plansPage).toContain(PLAN_PRIMARY_CTA);
    expect(plansPage).toContain("MXN al mes");
    expect(home).toContain(PLAN_NAV_CTA);
    expect(home).toContain(PLAN_PRIMARY_CTA);
    expect(home).toContain("MXN al mes");
  });

  it("quita el grito de demostración frente al comprador y deja nota calma", () => {
    const payments = readPage("Payments");
    const auditar = readPage("Auditar");
    const home = readPage("Home");
    const plansPage = readPage("Plans");

    expect(payments).toContain(BILLING_SOFT_NOTE);
    expect(auditar).toContain(BILLING_SOFT_NOTE);
    expect(home).toContain(BILLING_SOFT_NOTE);
    expect(plansPage).toContain(BILLING_SOFT_NOTE);
    expect(payments).not.toContain("Esto es una demostración. No se cobra nada.");
    expect(auditar).not.toContain("Esto es una demostración. No se cobra nada.");
    expect(home).not.toContain("Esto es una demostración. No se cobra nada.");
    expect(plansPage).not.toContain("Esto es una demostración. No se cobra nada.");
  });

  it("pone prueba social y garantía junto al CTA, y conserva el primer win", () => {
    const home = readPage("Home");
    const auditar = readPage("Auditar");
    const payments = readPage("Payments");
    const plansPage = readPage("Plans");

    expect(home).toContain(SOCIAL_PROOF_LINE);
    expect(home).toContain(GUARANTEE_LINE);
    expect(auditar).toContain(SOCIAL_PROOF_LINE);
    expect(auditar).toContain(GUARANTEE_LINE);
    expect(payments).toContain(SOCIAL_PROOF_LINE);
    expect(payments).toContain(GUARANTEE_LINE);
    expect(plansPage).toContain(SOCIAL_PROOF_LINE);
    expect(plansPage).toContain(GUARANTEE_LINE);
    expect(plansPage).toContain(FIRST_WIN_PROMISE);
    expect(auditar).toContain('const UPLOAD_PRIMARY_EMPTY_LABEL = "Sube tu documento"');
    expect(auditar).toContain(FIRST_WIN_PROMISE);
    expect(home).toContain("Sube tu documento");
    expect(home).toContain("Mira el resultado");
    expect(home).toContain("Qué hacer");
    expect(auditar).toContain("formatWorkerVisibleAccountName(tenant.displayName)");
  });

  it("usa una anécdota concreta y honesta, sin logos ni «trabajadores y abogados»", () => {
    const home = readPage("Home");
    const plansPage = readPage("Plans");
    const payments = readPage("Payments");
    const auditar = readPage("Auditar");

    expect(SOCIAL_PROOF_LINE).toMatch(/recibo/i);
    expect(SOCIAL_PROOF_LINE).toMatch(/IMSS/i);
    expect(SOCIAL_PROOF_LINE).toMatch(/retenciones/i);
    expect(SOCIAL_PROOF_LINE).not.toMatch(/trabajadores y abogados/i);
    expect(SOCIAL_PROOF_LINE).not.toMatch(/S\.A\.|SA de CV|Acme|logo|abogados/i);
    expect(SOCIAL_PROOF_LINE).not.toMatch(/\d{2,}/);
    expect(GUARANTEE_LINE).toBe(
      "Te garantizamos claridad del análisis. No prometemos que ganes un juicio.",
    );

    for (const source of [home, plansPage, payments, auditar]) {
      expect(source).not.toContain("Trabajadores y abogados usan esto");
      expect(source).toContain(SOCIAL_PROOF_LINE);
      expect(source).toContain(GUARANTEE_LINE);
    }
  });

  it("unifica el tope de documentos de Esencial con el plan real", () => {
    const home = readPage("Home");
    const plansPage = readPage("Plans");
    const payments = readPage("Payments");
    const essential = COMMERCE_PLANS.find((plan) => plan.key === "essential");
    const visibleEssential = getVisiblePaidPlans().find((plan) => plan.key === "essential");
    const essentialLimit = essential?.limits.maxDocumentsPerCase;
    const essentialLimitCopy = formatCommerceDocumentLimitBullet(essentialLimit ?? 0);

    expect(essentialLimit).toBe(15);
    expect(essential?.featureBullets).toContain(essentialLimitCopy);
    expect(visibleEssential?.includes).toContain(essentialLimitCopy);
    expect(visibleEssential?.includes.some((item) => /hasta 10 documentos/i.test(item))).toBe(false);

    for (const source of [home, plansPage, payments]) {
      expect(source).toContain("getVisiblePaidPlans");
      expect(source).not.toMatch(/hasta 10 documentos/i);
      expect(source).not.toContain("Hasta 10 documentos");
    }
  });

  it("deja la anécdota de recibo/IMSS como máximo dos veces en Home", () => {
    const home = readPage("Home");
    const plansStripStart = home.indexOf("function HomePlansStrip");
    const finalCtaStart = home.indexOf("function FinalCtaSection");
    const occurrences = home.split(SOCIAL_PROOF_LINE).length - 1;

    expect(occurrences).toBeLessThanOrEqual(2);
    expect(occurrences).toBe(2);
    expect(home.slice(0, plansStripStart)).toContain(SOCIAL_PROOF_LINE);
    expect(home.slice(plansStripStart, finalCtaStart)).toContain(SOCIAL_PROOF_LINE);
    expect(home.slice(finalCtaStart)).not.toContain(SOCIAL_PROOF_LINE);
  });
});

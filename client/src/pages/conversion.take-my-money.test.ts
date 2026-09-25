import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  COMMERCE_ONE_SHOTS,
  COMMERCE_PLANS,
  COMMERCE_PRICE_FOOTER,
} from "../../../shared/commerce";
import {
  BILLING_SOFT_NOTE,
  COPILOT_SECTION_VISIBLE_LABEL,
  FIRST_WIN_PROMISE,
  GUARANTEE_LINE,
  HOME_HERO_ASSISTANT_PILL_SUPPORT,
  HOME_HERO_ASSISTANT_PILL_TITLE,
  HOME_HERO_CHECKLIST,
  HOME_HERO_CLOSING_LINE,
  HOME_HERO_CTA_MICROCOPY,
  HOME_HERO_HEADLINE,
  HOME_HERO_HONESTY_LINE,
  HOME_HERO_PRIMARY_CTA,
  HOME_HERO_SECTION_TITLE,
  HOME_HERO_SUBHEAD,
  PLAN_NAV_CTA,
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
    expect(plans.every((plan) => /· IVA incluido/.test(plan.priceLabel))).toBe(true);
    expect(plans.every((plan) => !/sin IVA/i.test(plan.priceLabel))).toBe(true);
    expect(plans.find((plan) => plan.key === "essential")?.monthlyPriceMx).toBe(92);
    expect(plans.find((plan) => plan.key === "essential")?.priceLabel).toBe("$92 · IVA incluido");
    expect(plans.find((plan) => plan.key === "pro")?.monthlyPriceMx).toBe(231);
    expect(plans.find((plan) => plan.key === "pro")?.priceLabel).toBe("$231 · IVA incluido");
    expect(COMMERCE_ONE_SHOTS.find((item) => item.key === "informe_premium")?.priceMx).toBe(347);
    expect(COMMERCE_ONE_SHOTS.find((item) => item.key === "expediente_abogado")?.priceMx).toBe(579);
    expect(payments).toContain("pagos-plan-cards");
    expect(payments).toContain("PLAN_PRIMARY_CTA");
    expect(payments).toContain("MXN al mes");
    expect(payments).toContain("{COMMERCE_PRICE_FOOTER}");
    expect(payments).not.toContain("sin IVA");
    expect(plansPage).toContain("planes-plan-cards");
    expect(plansPage).toContain("PLAN_PRIMARY_CTA");
    expect(plansPage).toContain("MXN al mes");
    expect(plansPage).toContain("{COMMERCE_PRICE_FOOTER}");
    expect(plansPage).not.toContain("sin IVA");
    expect(home).toContain(PLAN_NAV_CTA);
    expect(home).toContain("PLAN_PRIMARY_CTA");
    expect(home).toContain("MXN al mes");
    expect(home).toContain("{COMMERCE_PRICE_FOOTER}");
    expect(home).not.toContain("sin IVA");
    expect(COMMERCE_PRICE_FOOTER).toBe("Precios en MXN. IVA incluido.");
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

  it("deja el plan gratis en un documento y no promete tres ni varios recibos", () => {
    const home = readPage("Home");
    const auditar = readPage("Auditar");
    const free = COMMERCE_PLANS.find((plan) => plan.key === "free");
    const essential = COMMERCE_PLANS.find((plan) => plan.key === "essential");
    const pro = COMMERCE_PLANS.find((plan) => plan.key === "pro");

    expect(free?.limits.maxDocumentsPerCase).toBe(1);
    expect(essential?.limits.maxDocumentsPerCase).toBe(15);
    expect(pro?.limits.maxDocumentsPerCase).toBe(50);
    expect(JSON.stringify(free)).not.toMatch(/3 documentos|varios recibos/i);
    expect(free?.featureBullets.join(" ")).toMatch(/1 documento\. Primera lectura y asesor básico/i);

    for (const source of [home, auditar]) {
      expect(source).not.toMatch(/hasta 3 documentos/i);
      expect(source).not.toContain("Subir varios recibos");
      expect(source).not.toContain("Dos o tres recibos");
    }
  });

  it("unifica el tope de documentos de Esencial con el plan real", () => {
    const home = readPage("Home");
    const plansPage = readPage("Plans");
    const payments = readPage("Payments");
    const essential = COMMERCE_PLANS.find((plan) => plan.key === "essential");
    const visibleEssential = getVisiblePaidPlans().find((plan) => plan.key === "essential");
    const essentialLimit = essential?.limits.maxDocumentsPerCase;

    expect(essentialLimit).toBe(15);
    expect(essential?.featureBullets).toContain("Hasta 15 recibos en tu caso.");
    expect(visibleEssential?.includes).toContain("Hasta 15 recibos en tu caso.");
    expect(visibleEssential?.includes.some((item) => /hasta 10 documentos/i.test(item))).toBe(false);

    for (const source of [home, plansPage, payments]) {
      expect(source).toContain("getVisibleCatalogPlans");
      expect(source).not.toMatch(/hasta 10 documentos/i);
      expect(source).not.toContain("Hasta 10 documentos");
    }
  });

  it("fija el mix aprobado del hero público: titular emocional y CTA de primera lectura", () => {
    const home = readPage("Home");
    const variants = ["alert", "control", "short_paid_campaign", "direct_money_check"];

    expect(HOME_HERO_HEADLINE).toBe(
      "Que no te vean la cara: ¿tu patrón te paga bien y declara el salario que corresponde?",
    );
    expect(HOME_HERO_SUBHEAD).toContain("español normal");
    expect(HOME_HERO_SECTION_TITLE).toBe("Qué revisas con AuditaPatrón");
    expect(HOME_HERO_CHECKLIST).toHaveLength(6);
    expect(HOME_HERO_PRIMARY_CTA).toBe("Revisar mi recibo gratis");
    expect(HOME_HERO_CTA_MICROCOPY).toBe(
      "Subes el recibo, ves el resultado y solo se guarda si tú lo confirmas.",
    );
    expect(HOME_HERO_HONESTY_LINE).toContain("No demuestra por sí sola un incumplimiento");
    expect(HOME_HERO_CLOSING_LINE).toBe(
      "Cuentas claras. Primero entiende. Luego decides si hablas con RH o pides aclaración.",
    );

    expect(home).toContain("HOME_HERO_HEADLINE");
    expect(home).toContain("HOME_HERO_PRIMARY_CTA");
    expect(home).toContain(HOME_HERO_HEADLINE);
    expect(home).toContain(HOME_HERO_SUBHEAD);
    expect(home).toContain(HOME_HERO_SECTION_TITLE);
    expect(home).toContain(HOME_HERO_PRIMARY_CTA);
    expect(home).toContain(HOME_HERO_CTA_MICROCOPY);
    expect(home).toContain(HOME_HERO_HONESTY_LINE);
    expect(home).toContain(HOME_HERO_CLOSING_LINE);
    expect(home).toContain("activeHeroVariant.ctaPrimary");
    expect(home).toContain('placement: "hero_primary"');
    expect(home).toContain('window.location.href = "/auditar"');
    expect(home).toContain("min-w-0");
    expect(home).toContain("text-pretty");
    expect(home).not.toContain("CompliLink");
    expect(home).not.toMatch(/\bHelios\b/);

    expect(home).toContain("HOME_HERO_CHECKLIST");
    expect(home).toContain("activeHeroVariant.checklist.map");

    for (const variant of variants) {
      expect(home).toContain(`${variant}: approvedGuestHeroCopy`);
    }
  });

  it("opción E: la pastilla del hero y #copiloto comparten la promesa, sin mover el CTA ni el cobro", () => {
    const home = readPage("Home");
    const pill = home.indexOf('data-testid="home-hero-assistant-pill"');
    const heroCta = home.indexOf('placement: "hero_primary", source: "hero"');
    const copilotStart = home.indexOf("function CopilotPreviewSection");
    const copilot = home.slice(copilotStart, home.indexOf("function HowItWorksSection", copilotStart));

    expect(HOME_HERO_ASSISTANT_PILL_TITLE).toBe("Asistente laboral inteligente en tu bolsillo");
    expect(HOME_HERO_ASSISTANT_PILL_SUPPORT).toBe("Te explica tu caso, no un FAQ");
    expect(COPILOT_SECTION_VISIBLE_LABEL).toBe(HOME_HERO_ASSISTANT_PILL_TITLE);
    expect(HOME_HERO_PRIMARY_CTA).toBe("Revisar mi recibo gratis");
    expect(home).toContain(HOME_HERO_ASSISTANT_PILL_TITLE);
    expect(home).toContain(HOME_HERO_ASSISTANT_PILL_SUPPORT);
    expect(home.slice(pill, pill + 700)).toContain("{HOME_HERO_ASSISTANT_PILL_TITLE}");
    expect(pill).toBeGreaterThan(heroCta);
    expect(copilot).toContain("{COPILOT_SECTION_VISIBLE_LABEL}");
    expect(copilot).toContain('id="copiloto"');
    expect(copilot).not.toContain("Asesor laboral de AuditaPatron");
    expect(home).toContain(BILLING_SOFT_NOTE);
    expect(home).toContain("Hoy no se cobra.");
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

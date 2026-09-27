import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  BILLING_SOFT_NOTE,
  COPILOT_SECTION_VISIBLE_LABEL,
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
  getVisibleCatalogPlans,
} from "../../../shared/conversionCopy";

const currentDir = dirname(fileURLToPath(import.meta.url));

function readHome() {
  return readFileSync(resolve(currentDir, "Home.tsx"), "utf8");
}

describe("Home pública · mix aprobado del hero", () => {
  it("expone el titular y el CTA exactos en el hero invitado", () => {
    const home = readHome();

    expect(HOME_HERO_HEADLINE).toBe(
      "Que no te vean la cara: ¿tu patrón te paga bien y declara el salario que corresponde?",
    );
    expect(HOME_HERO_PRIMARY_CTA).toBe("Revisar mi recibo gratis");
    expect(home).toContain(HOME_HERO_HEADLINE);
    expect(home).toContain("{activeHeroVariant.headline}");
    expect(home).toContain("{activeHeroVariant.ctaPrimary}");
    expect(home).toContain("{HOME_HERO_PRIMARY_CTA}");
    expect(home).toContain(HOME_HERO_PRIMARY_CTA);
    expect(home).toContain('onClick={() => goToAuditFlow({ placement: "hero_primary", source: "hero" })}');
    expect(home).toContain('window.location.href = "/auditar"');
  });

  it("alinea subtítulo, checklist, microcopy y cierre en todas las variantes invitadas", () => {
    const home = readHome();

    expect(home).toContain(HOME_HERO_SUBHEAD);
    expect(home).toContain(HOME_HERO_SECTION_TITLE);
    expect(home).toContain(HOME_HERO_CTA_MICROCOPY);
    expect(home).toContain(HOME_HERO_HONESTY_LINE);
    expect(home).toContain(HOME_HERO_CLOSING_LINE);
    expect(HOME_HERO_CHECKLIST).toEqual([
      "Tu salario ante el IMSS (si el documento lo muestra)",
      "Descuentos: cada peso que te quitan y bajo qué concepto",
      "Recibo vs lo que declara el CFDI (si subes ambos)",
      "Pagos, total y periodo de la quincena",
      "Infonavit / aportaciones, cuando aparezcan",
      "Datos faltantes o inconsistencias que conviene aclarar",
    ]);

    expect(home).toContain("HOME_HERO_CHECKLIST");
    expect(home).toContain("activeHeroVariant.checklist.map");
    for (const item of HOME_HERO_CHECKLIST) {
      expect(item.length).toBeGreaterThan(12);
    }

    expect(home).toContain("alert: approvedGuestHeroCopy");
    expect(home).toContain("control: approvedGuestHeroCopy");
    expect(home).toContain("short_paid_campaign: approvedGuestHeroCopy");
    expect(home).toContain("direct_money_check: approvedGuestHeroCopy");
    expect(home).toContain("min-w-0 w-full max-w-full text-pretty");
    expect(home).not.toContain("CompliLink");
    expect(home).not.toMatch(/\bHelios\b/);
  });

  it("opción E: pastilla suave bajo el CTA y misma promesa en #copiloto, con cobro apagado", () => {
    const home = readHome();
    const heroCta = home.indexOf('goToAuditFlow({ placement: "hero_primary", source: "hero" })');
    const pill = home.indexOf('data-testid="home-hero-assistant-pill"');
    const plansLink = home.indexOf("href={PLANS_PATH}");
    const pillMarkup = home.slice(pill, pill + 700);
    const copilotStart = home.indexOf("function CopilotPreviewSection");
    const copilot = home.slice(copilotStart, home.indexOf("function HowItWorksSection"));

    expect(HOME_HERO_ASSISTANT_PILL_TITLE).toBe("Asistente laboral inteligente en tu bolsillo");
    expect(HOME_HERO_ASSISTANT_PILL_SUPPORT).toBe("Te explica tu caso, no un FAQ");
    expect(COPILOT_SECTION_VISIBLE_LABEL).toBe(HOME_HERO_ASSISTANT_PILL_TITLE);
    expect(HOME_HERO_PRIMARY_CTA).toBe("Revisar mi recibo gratis");

    expect(pill).toBeGreaterThan(heroCta);
    expect(plansLink).toBeGreaterThan(pill);
    expect(pillMarkup).toContain("{HOME_HERO_ASSISTANT_PILL_TITLE}");
    expect(pillMarkup).toContain("{HOME_HERO_ASSISTANT_PILL_SUPPORT}");
    expect(pillMarkup).toContain("font-medium");
    expect(pillMarkup).not.toContain("bg-teal-600");
    expect(pillMarkup).not.toMatch(/copiloto/i);
    expect(pillMarkup).not.toContain("sanitizeClientVisibleCopy");
    expect(pillMarkup).not.toContain("Tu copiloto laboral");
    expect(pillMarkup).not.toContain("(Tu copiloto laboral, paso a paso)");

    const plansStripStart = home.indexOf("function HomePlansStrip");
    const plansStrip = home.slice(plansStripStart, home.indexOf("function FinalCtaSection", plansStripStart));
    expect(plansStrip).toContain("{plan.includes.map");
    expect(plansStrip).not.toContain("sanitizeClientVisibleCopy");
    expect(plansStrip).not.toMatch(/Asesor laboral|copiloto laboral|Tu copiloto/i);

    expect(copilot).toContain('id="copiloto"');
    expect(copilot).toContain("{COPILOT_SECTION_VISIBLE_LABEL}");
    expect(copilot).toContain("{HOME_HERO_ASSISTANT_PILL_SUPPORT}");
    expect(copilot).toContain("tu asistente laboral puede ayudarte");
    expect(copilot).toContain("El asistente laboral es una guía contextual");
    expect(copilot).toContain("El asistente laboral responde");
    expect(copilot).not.toContain("Asesor laboral de AuditaPatron");
    expect(copilot).not.toContain("Vista previa del asesor laboral");
    expect(copilot).not.toContain("tu asesor laboral");
    expect(copilot).not.toContain("El asesor laboral");
    expect(copilot).not.toContain("Tu copiloto laboral");
    expect(copilot).not.toContain("Aquí te acompañamos paso a paso");
    expect(copilot).not.toMatch(/<h[12][^>]*>[^<]*[Cc]opiloto/);

    const pro = getVisibleCatalogPlans().find((plan) => plan.key === "pro");
    expect(pro?.includes).toContain("Asistente laboral con el historial de tu caso.");
    expect(pro?.includes.join(" ")).not.toMatch(/Asesor laboral|copiloto/i);
    const essential = getVisibleCatalogPlans().find((plan) => plan.key === "essential");
    expect(essential?.includes.join(" ")).toContain("el asesor recuerda lo que ya vimos");
    expect(essential?.includes.join(" ")).not.toMatch(/Asesor laboral/);

    expect(home).toContain(BILLING_SOFT_NOTE);
    expect(home).toContain("Hoy no se cobra.");
    expect(home).toContain('const PRIMARY_CTA_LABEL = "Revisar mi recibo gratis"');
  });

  it("la card Gratis del home dice el precio en una línea y bullets de trabajador", () => {
    const home = readHome();
    const bulletsStart = home.indexOf("const FREE_HOME_PLAN_BULLETS");
    const bullets = home.slice(bulletsStart, home.indexOf("] as const;", bulletsStart));

    expect(home).toContain("Gratis · $0 · 1 documento");
    expect(bullets).toContain("1 documento. Primera lectura y asesor básico.");
    expect(bullets).toContain("Tu empresa no lo ve.");
    expect(bullets).toContain("Borras tu archivo cuando quieras.");
    expect(bullets).not.toMatch(/HUD|expediente|revalidacion|\bHelios\b/i);
    expect(home).not.toMatch(/\bHUD\b/);
    expect(home).not.toMatch(/expediente/i);
  });
});

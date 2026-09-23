import { expect, test } from "@playwright/test";

const blockedPhrases = [
  "El landing debe vender confianza y utilidad inmediata.",
  "pricingExperience.landing.description",
  "copy interno filtrado",
  "cuando realmente te sirvan",
  "sin interrumpir tu primera revisión",
  "esa opción aparece dentro de tu expediente, con contexto",
];

test.describe("home pública", () => {
  test("mantiene copy comercial y bloquea frases internas o residuales", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("button", { name: "Revisar mi recibo gratis" }).first()).toBeVisible();

    const bodyText = await page.locator("body").innerText();

    for (const phrase of blockedPhrases) {
      expect(bodyText).not.toContain(phrase);
    }

    expect(bodyText).toContain("Que no te vean la cara: ¿tu patrón te paga bien y declara el salario que corresponde?");
    expect(bodyText).toContain("Subes el recibo, ves el resultado y solo se guarda si tú lo confirmas.");
    expect(bodyText).toContain("No compartimos tu archivo con tu empresa.");
    expect(bodyText).not.toContain(
      "Helios ya conectó documentos del expediente y está devolviendo una lectura preliminar",
    );
    expect(bodyText).not.toMatch(/\bHelios\b/);
  });
});

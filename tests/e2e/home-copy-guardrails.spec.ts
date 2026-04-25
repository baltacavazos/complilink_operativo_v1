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

    expect(bodyText).toContain("¿Tu recibo de nómina está bien o hay algo raro?");
    expect(bodyText).toContain("Empieza con una foto. No necesitas reunir todo.");
    expect(bodyText).toContain("Tu jefe nunca se enterará.");
  });
});

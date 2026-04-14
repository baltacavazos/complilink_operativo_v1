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

    await expect(page.getByRole("button", { name: "Auditar ahora" }).first()).toBeVisible();

    const bodyText = await page.locator("body").innerText();

    for (const phrase of blockedPhrases) {
      expect(bodyText).not.toContain(phrase);
    }

    expect(bodyText).toContain("Sube tu documento laboral y recibe una auditoría clara y confiable.");
    expect(bodyText).toContain("Sube tu primer documento y entiende tu situación laboral en minutos.");
    expect(bodyText).toContain("Si más adelante quieres avanzar, esa opción estará disponible dentro de tu expediente.");
  });
});

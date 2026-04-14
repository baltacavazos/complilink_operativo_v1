import { expect, test } from "@playwright/test";

test.describe("navegación pública del landing", () => {
  test("los enlaces del header llevan a sus secciones correctas en desktop", async ({ page }) => {
    await page.goto("/");

    const desktopHeader = page.locator("header nav").first();

    await desktopHeader.getByRole("link", { name: "Cómo funciona" }).click();
    await expect(page).toHaveURL(/#como-funciona$/);
    await expect(page.getByRole("heading", { name: "Entiende tu situación sin complicarte" })).toBeVisible();

    await desktopHeader.getByRole("link", { name: "Tu expediente" }).click();
    await expect(page).toHaveURL(/#expediente$/);
    await expect(page.getByRole("heading", { name: "Cada documento útil se convierte en orden, claridad y respaldo." })).toBeVisible();

    await desktopHeader.getByRole("link", { name: "Asistente" }).click();
    await expect(page).toHaveURL(/#copiloto$/);
    await expect(page.getByRole("heading", { name: "Una capa extra para hacer preguntas rápidas sobre tu expediente." })).toBeVisible();
  });

  test("el menú móvil lleva a destinos visibles equivalentes y se cierra tras navegar", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    const menuButton = page.getByRole("button", { name: /abrir menú/i });

    await menuButton.click();
    await page.locator("header").getByRole("link", { name: "Cómo funciona" }).click();
    await expect(page).toHaveURL(/#como-funciona$/);
    await expect(page.getByText("Sube un documento y entiende el proceso sin enredos")).toBeVisible();
    await expect(menuButton).toBeVisible();

    await menuButton.click();
    await page.locator("header").getByRole("link", { name: "Tu expediente" }).click();
    await expect(page).toHaveURL(/#expediente$/);
    await expect(page.getByText("Cada documento suma contexto y respaldo real")).toBeVisible();
    await expect(menuButton).toBeVisible();

    await menuButton.click();
    await page.locator("header").getByRole("link", { name: "Asistente" }).click();
    await expect(page).toHaveURL(/#copiloto$/);
    await expect(page.getByRole("heading", { name: "Una capa extra para hacer preguntas rápidas sobre tu expediente." })).toBeVisible();
    await expect(menuButton).toBeVisible();
  });
});

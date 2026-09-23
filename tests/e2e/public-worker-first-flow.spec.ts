import { expect, test } from "@playwright/test";

test.describe("flujo público base para trabajador", () => {
  test("mantiene visibles las tres etapas mínimas: entrar, subir y ver lectura inicial", async ({ page }) => {
    await page.goto("/acceso?returnTo=/auditar", { waitUntil: "networkidle" });

    await expect(
      page.getByRole("heading", { name: "Entra y sigue donde te quedaste" })
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Enviar código" })).toBeVisible();

    await page.goto("/", { waitUntil: "networkidle" });

    await expect(
      page.getByRole("heading", {
        name: "Que no te vean la cara: ¿tu patrón te paga bien y declara el salario que corresponde?",
      })
    ).toBeVisible();
    await expect(
      page.getByText("Subes el recibo, ves el resultado y solo se guarda si tú lo confirmas.")
    ).toBeVisible();
    await page.getByRole("button", { name: "Revisar mi recibo gratis" }).first().click();

    await expect(page).toHaveURL(/\/auditar$/);

    await page.goto("/auditar?postUploadHarness=1", { waitUntil: "networkidle" });

    await expect(page.getByTestId("post-upload-harness")).toBeHidden();
    await expect(page.getByTestId("five-second-verdict-seen")).toContainText("Esto vimos:");
    await expect(page.getByTestId("five-second-verdict-next")).toContainText("Qué hacer ahora:");
    await expect(
      page.getByRole("button", { name: "Subir CFDI del mismo periodo" })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Ver expediente completo" })
    ).toBeVisible();
  });
});

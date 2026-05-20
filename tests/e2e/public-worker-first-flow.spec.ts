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
      page.getByRole("heading", { name: "Sube tu recibo y te decimos qué revisar." })
    ).toBeVisible();
    await expect(
      page.getByText("Empieza gratis con un solo archivo. No necesitas cuenta para ver la primera lectura.")
    ).toBeVisible();
    await page.getByRole("button", { name: "Empezar auditoría gratis" }).first().click();

    await expect(page).toHaveURL(/\/auditar$/);

    await page.goto("/auditar?postUploadHarness=1", { waitUntil: "networkidle" });

    await expect(page.getByTestId("post-upload-harness")).toBeHidden();
    await expect(
      page.getByRole("heading", { name: "Recibo de nómina confirmado" })
    ).toBeVisible();
    await expect(page.getByText("Ya quedó listo para revisar.")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Subir CFDI del mismo periodo" })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Ver expediente completo" })
    ).toBeVisible();
  });
});

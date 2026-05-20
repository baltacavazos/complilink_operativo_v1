import { expect, test } from "@playwright/test";

test.describe("flujo público base para trabajador", () => {
  test("mantiene visibles las tres etapas mínimas: entrar, subir y ver lectura inicial", async ({ page }) => {
    await page.goto("/acceso?returnTo=/auditar", { waitUntil: "networkidle" });

    await expect(
      page.getByRole("heading", { name: "Entrar con correo y seguir donde te quedaste" })
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Enviar código" })).toBeVisible();

    await page.goto("/", { waitUntil: "networkidle" });

    await expect(
      page.getByRole("heading", { name: "Sube tu recibo y te decimos qué revisar." })
    ).toBeVisible();
    await expect(
      page.getByText("Empieza con una foto o PDF del documento que ya tengas. En segundos ves si hay algo importante por revisar.")
    ).toBeVisible();
    await page.getByRole("button", { name: "Revisa tu recibo gratis" }).first().click();

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

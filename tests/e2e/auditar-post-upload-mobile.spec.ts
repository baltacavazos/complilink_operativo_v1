import { expect, test } from "@playwright/test";

test.describe("Veredicto móvil post-upload en /auditar", () => {
  test.use({ viewport: { width: 393, height: 852 } });

  test("revela un veredicto compacto con CTA principal y expediente confirmado", async ({
    page,
  }) => {
    await page.goto("/auditar?postUploadHarness=1", {
      waitUntil: "networkidle",
    });

    await expect(page.getByTestId("post-upload-harness")).toBeHidden();
    await expect(page.getByTestId("auditar-result-reveal")).toBeHidden();
    await expect(
      page.getByRole("heading", { name: "Recibo de nómina confirmado" })
    ).toBeVisible();
    await expect(page.getByText("Ya está en tu expediente.")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Comparar nómina y CFDI" })
    ).toBeVisible();
  });
});

import { expect, test } from "@playwright/test";

test.describe("Veredicto móvil post-upload en /auditar", () => {
  test.use({ viewport: { width: 393, height: 852 } });

  test("revela un veredicto compacto con semáforo explícito y CTA principal", async ({
    page,
  }) => {
    await page.goto("/auditar?postUploadHarness=1", {
      waitUntil: "networkidle",
    });

    await expect(page.getByTestId("post-upload-harness")).toBeVisible();
    await expect(page.getByTestId("auditar-result-reveal")).toBeVisible();
    await expect(page.getByTestId("auditar-result-reveal")).toContainText(
      "Veredicto en pantalla"
    );

    await expect(page.getByTestId("auditar-verdict-pill")).toBeVisible();
    await expect(page.getByTestId("auditar-verdict-pill")).toHaveText(
      "Bien detectado"
    );

    await expect(page.getByText("Lo importante primero")).toBeVisible();
    await expect(page.getByText("Haz esto ahora")).toBeVisible();
    await expect(page.getByTestId("auditar-verdict-panel")).toBeVisible();
    await expect(page.getByTestId("auditar-primary-verdict-cta")).toBeVisible();
    await expect(page.getByTestId("auditar-primary-verdict-cta")).toContainText(
      "Subir CFDI del mismo periodo"
    );
  });
});

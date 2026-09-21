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
    await expect(page.getByTestId("five-second-verdict-seen")).toBeVisible();
    await expect(page.getByTestId("five-second-verdict-seen")).toContainText("Esto vimos:");
    await expect(page.getByTestId("five-second-verdict-next")).toContainText("Qué hacer ahora:");
    const compactDetail = page.locator("details[data-compact-official-detail='true']");
    await compactDetail.locator("summary").click();
    await expect(page.getByTestId("official-check-card")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Subir CFDI del mismo periodo" })
    ).toBeVisible();
  });
});

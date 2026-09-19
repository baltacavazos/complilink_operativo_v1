import { expect, test } from "@playwright/test";

async function assertSingleVolver(page: import("@playwright/test").Page, mode: "mobile" | "desktop") {
  for (const path of ["/auditar?legalGateHarness=1", "/auditar"]) {
    await page.goto(path, { waitUntil: "networkidle" });

    const header = page.getByTestId("mobile-header-back");
    const pageBack = page.getByTestId("auditar-page-back");

    await expect(header).toHaveCount(1);
    await expect(pageBack).toHaveCount(1);

    if (mode === "mobile") {
      await expect(header).toBeVisible();
      await expect(pageBack).toBeHidden();
    } else {
      await expect(header).toBeHidden();
      await expect(pageBack).toBeVisible();
    }
  }
}

test.describe("Un solo Volver en /auditar", () => {
  test("móvil deja solo el Volver de cabecera", async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 852 });
    await assertSingleVolver(page, "mobile");
  });

  test("desktop deja el Volver in-flow de la tarjeta", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await assertSingleVolver(page, "desktop");
  });
});

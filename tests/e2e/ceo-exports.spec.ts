import { expect, test } from "@playwright/test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const E2E_LOGIN_PATH = "/api/testing/login-owner";

async function loginAsOwner(page: import("@playwright/test").Page) {
  const e2eToken = process.env.JWT_SECRET;

  test.skip(!e2eToken, "JWT_SECRET no está disponible para bootstrap de sesión E2E.");

  const response = await page.request.post(E2E_LOGIN_PATH, {
    headers: {
      "x-complilink-e2e-token": e2eToken ?? "",
    },
  });

  expect(response.ok()).toBeTruthy();
  const payload = await response.json();
  expect(payload).toMatchObject({
    success: true,
    user: {
      roleHint: "admin",
    },
  });
}

async function saveDownloadToTemp(download: import("@playwright/test").Download) {
  const suggestedFilename = download.suggestedFilename();
  const outputPath = path.join(os.tmpdir(), `${Date.now()}-${suggestedFilename}`);
  await download.saveAs(outputPath);
  const content = await fs.readFile(outputPath);
  return { suggestedFilename, outputPath, content };
}

test.describe("Exportes CEO", () => {
  test("descarga CSV y PDF con contenido mínimo esperable", async ({ page }) => {
    await loginAsOwner(page);

    await page.goto("/ceo");
    await expect(page.getByText("Modo CEO maestro")).toBeVisible();

    const csvDownloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: /exportar csv/i }).click();
    const csvDownload = await csvDownloadPromise;
    const csvFile = await saveDownloadToTemp(csvDownload);

    expect(csvFile.suggestedFilename).toMatch(/^ceo-resumen-\d{8}-\d{4}\.csv$/);
    const csvContent = csvFile.content.toString("utf8");
    expect(csvContent).toContain('"Reporte ejecutivo CEO"');
    expect(csvContent).toContain('"Salud por tenant"');
    expect(csvContent.length).toBeGreaterThan(200);

    const pdfDownloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: /reporte pdf/i }).click();
    const pdfDownload = await pdfDownloadPromise;
    const pdfFile = await saveDownloadToTemp(pdfDownload);

    expect(pdfFile.suggestedFilename).toMatch(/^ceo-resumen-\d{8}-\d{4}\.pdf$/);
    expect(pdfFile.content.byteLength).toBeGreaterThan(500);
    expect(pdfFile.content.subarray(0, 4).toString("utf8")).toBe("%PDF");

    await expect(page.getByText(/reporte pdf generado/i)).toBeVisible();
    await expect(page.getByText(/reporte csv generado/i)).toBeVisible();
  });
});

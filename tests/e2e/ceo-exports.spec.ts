import { expect, test } from "@playwright/test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const E2E_LOGIN_PATH = "/api/testing/login-owner";

async function loginAsOwner(page: import("@playwright/test").Page) {
  const e2eToken = process.env.JWT_SECRET;

  test.skip(!e2eToken, "JWT_SECRET no está disponible para bootstrap de sesión E2E.");

  await page.goto("/");
  const loginUrl = new URL(E2E_LOGIN_PATH, page.url()).toString();

  const response = await page.request.post(loginUrl, {
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

  test("bloquea exportes cuando el snapshot ejecutivo ya quedó stale", async ({ page }) => {
    await loginAsOwner(page);
    await page.addInitScript(() => {
      const realNow = Date.now.bind(Date);
      Date.now = () => realNow() + 30 * 60 * 1000;
    });

    await page.goto("/ceo");
    await expect(page.getByText("Modo CEO maestro")).toBeVisible();
    await expect(page.getByRole("button", { name: /exportar csv/i })).toBeDisabled();
    await expect(page.getByRole("button", { name: /reporte pdf/i })).toBeDisabled();
    await expect(page.getByRole("button", { name: /^Actualizar$/i })).toBeEnabled();
    await expect(page.getByText(/actualizada hace/i).first()).toBeVisible();
  });

  test("permite reintentar la carga del snapshot CEO después de un fallo transitorio", async ({ page }) => {
    await loginAsOwner(page);

    let snapshotAttempts = 0;
    await page.route("**/api/trpc/**", async (route) => {
      const url = route.request().url();
      if (url.includes("dashboard.ceoSnapshot")) {
        snapshotAttempts += 1;
        if (snapshotAttempts === 1) {
          await route.fulfill({
            status: 500,
            contentType: "application/json",
            body: JSON.stringify({ error: { message: "snapshot failed" } }),
          });
          return;
        }
      }

      await route.continue();
    });

    await page.goto("/ceo");
    await expect(page.getByText(/no fue posible cargar el snapshot ejecutivo del ceo/i)).toBeVisible();

    await page.getByRole("button", { name: /actualizar/i }).click();

    await expect(page.getByText(/no fue posible cargar el snapshot ejecutivo del ceo/i)).not.toBeVisible();
    await expect(page.getByRole("button", { name: /exportar csv/i })).toBeEnabled();
    expect(snapshotAttempts).toBeGreaterThanOrEqual(2);
  });

  test("mantiene la descarga y expone warning en consola si falla la auditoría del export", async ({ page }) => {
    await loginAsOwner(page);

    const consoleWarnings: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "warning") {
        consoleWarnings.push(message.text());
      }
    });

    await page.route("**/api/trpc/**", async (route) => {
      const url = route.request().url();
      if (url.includes("dashboard.ceoRecordExportAudit")) {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: { message: "audit failed" } }),
        });
        return;
      }

      await route.continue();
    });

    await page.goto("/ceo");
    await expect(page.getByText("Modo CEO maestro")).toBeVisible();

    const csvDownloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: /exportar csv/i }).click();
    const csvDownload = await csvDownloadPromise;
    const csvFile = await saveDownloadToTemp(csvDownload);

    expect(csvFile.suggestedFilename).toMatch(/^ceo-resumen-\d{8}-\d{4}\.csv$/);
    await expect(page.getByText(/no quedó registrada/i)).toBeVisible();
    expect(consoleWarnings.some((entry) => entry.includes("No se pudo registrar la auditoría del export ejecutivo"))).toBeTruthy();
  });

  test("refresca el panel bridge smoke y mantiene visibles la alerta operativa y el umbral configurable", async ({ page }) => {
    await loginAsOwner(page);

    let bridgeSmokeAttempts = 0;
    page.on("request", (request) => {
      if (request.url().includes("dashboard.ceoBridgeSmokeStatus")) {
        bridgeSmokeAttempts += 1;
      }
    });

    await page.goto("/ceo/bridge");
    await expect(page.getByText("Modo CEO maestro")).toBeVisible();
    await expect(page.getByTestId("bridge-smoke-alert-summary")).toBeVisible();
    await expect(page.getByTestId("bridge-smoke-alert-badge")).toBeVisible();
    await expect(page.getByTestId("bridge-smoke-threshold-badge")).toContainText(/umbral/i);
    await expect(page.getByTestId("bridge-smoke-threshold-pill")).toContainText(/umbral operativo smoke/i);
    await expect(page.getByTestId("bridge-smoke-trend-state")).toBeVisible();

    const refreshResponse = page.waitForResponse(
      (response) => response.url().includes("dashboard.ceoBridgeSmokeStatus") && response.ok(),
    );
    await page.getByRole("button", { name: /^Actualizar$/i }).click();
    await refreshResponse;

    await expect(page.getByTestId("bridge-smoke-alert-summary")).toBeVisible();
    await expect(page.getByTestId("bridge-smoke-alert-badge")).toBeVisible();
    await expect(page.getByTestId("bridge-smoke-threshold-badge")).toContainText(/umbral/i);
    await expect(page.getByTestId("bridge-smoke-threshold-pill")).toContainText(/umbral operativo smoke/i);
    await expect(page.getByTestId("bridge-smoke-trend-state")).toBeVisible();
    expect(bridgeSmokeAttempts).toBeGreaterThanOrEqual(2);
  });
});

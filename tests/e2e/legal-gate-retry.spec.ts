import { expect, test } from "@playwright/test";

test.describe("Gate legal de /auditar", () => {
  test("muestra conflicto controlado, temporizador y reintento exitoso en modo harness", async ({ page }) => {
    await page.goto("/auditar?legalGateHarness=1", { waitUntil: "networkidle" });

    await expect(page.getByTestId("legal-gate-harness")).toBeVisible();
    await expect(page.getByTestId("legal-gate-lock-metrics")).toBeVisible();
    await expect(page.getByTestId("legal-gate-metric-attempts")).toHaveText("0");
    await expect(page.getByTestId("legal-gate-metric-conflicts")).toHaveText("0");
    await expect(page.getByTestId("legal-gate-metric-retries")).toHaveText("0");

    await page.getByTestId("legal-gate-harness-trigger").click();

    await expect(page.getByTestId("legal-gate-error")).toBeVisible();
    await expect(page.getByTestId("legal-gate-metric-attempts")).toHaveText("1");
    await expect(page.getByTestId("legal-gate-metric-conflicts")).toHaveText("1");
    await expect(page.getByTestId("legal-gate-metric-status")).toContainText("Conflicto de lock detectado");
    await expect(page.getByTestId("legal-gate-retry-button")).toBeDisabled();
    await expect(page.getByTestId("legal-gate-retry-countdown")).toContainText("Reintento habilitado en");
    await expect(page.getByTestId("legal-gate-metric-timer")).toContainText("Temporizador de reintento activo");

    await expect(page.getByTestId("legal-gate-retry-button")).toBeEnabled({ timeout: 8_000 });
    await expect(page.getByTestId("legal-gate-retry-button")).toContainText("Reintentar aceptación");

    await page.getByTestId("legal-gate-retry-button").click();

    await expect(page.getByTestId("legal-gate-error")).toBeHidden();
    await expect(page.getByTestId("legal-gate-metric-attempts")).toHaveText("2");
    await expect(page.getByTestId("legal-gate-metric-conflicts")).toHaveText("1");
    await expect(page.getByTestId("legal-gate-metric-retries")).toHaveText("1");
    await expect(page.getByTestId("legal-gate-metric-status")).toContainText("Aceptación registrada");
  });
});

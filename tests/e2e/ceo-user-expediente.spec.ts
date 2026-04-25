import { expect, test } from "@playwright/test";

const E2E_LOGIN_PATH = "/api/testing/login-owner";
const VIEW_MODE_SESSION_KEY = "complilink-view-mode";

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

test.describe("Flujo crítico CEO ↔ vista usuario ↔ expediente", () => {
  test("mantiene guardrails, persistencia local y retorno seguro", async ({ page }) => {
    await loginAsOwner(page);

    await page.goto("/ceo");
    await expect(page).toHaveURL(/\/ceo$/);
    await expect(page.getByText("Modo owner autorizado")).toBeVisible();

    await page.getByRole("button", { name: /ver como usuario/i }).click();

    await expect(page).toHaveURL(/\/auditar$/);
    await expect(page.getByText("Estás viendo la plataforma como usuario normal")).toBeVisible();
    await expect(page.getByText("Expediente laboral seleccionado")).toBeVisible();

    await expect
      .poll(() =>
        page.evaluate((storageKey) => window.sessionStorage.getItem(storageKey), VIEW_MODE_SESSION_KEY),
      )
      .toBe("demo-user");

    await page.goto("/ceo");
    await expect(page).toHaveURL(/\/auditar$/);
    await expect(page.getByText("Estás viendo la plataforma como usuario normal")).toBeVisible();

    await page.getByRole("button", { name: /salir de la demo y volver al (ceo|panel privado)/i }).click();

    await expect(page).toHaveURL(/\/ceo$/);
    await expect(page.getByText("Modo owner autorizado")).toBeVisible();

    await expect
      .poll(() =>
        page.evaluate((storageKey) => window.sessionStorage.getItem(storageKey), VIEW_MODE_SESSION_KEY),
      )
      .toBe("native");
  });

  test("permite volver al resumen contextual preservando filtros del gate legal", async ({ page }) => {
    await loginAsOwner(page);

    const contextualDocumentsUrl = "/ceo/documentos?legalTenantId=tenant-demo&legalScopeId=scope-7&legalCaseId=CASE-42&legalTarget=documents&legalAuditFamily=guardrail&legalAuditSeverity=high";

    await page.goto(contextualDocumentsUrl, { waitUntil: "networkidle" });

    await expect(page).toHaveURL(/\/ceo\/documentos\?legalTenantId=tenant-demo/);
    await expect(page.getByTestId("ceo-context-summary-pill")).toContainText("Tenant tenant-demo");
    await expect(page.getByTestId("ceo-context-summary-pill")).toContainText("Caso CASE-42");
    await expect(page.getByTestId("ceo-context-summary-pill")).toContainText("Familia guardrail");
    await expect(page.getByTestId("ceo-context-summary-pill")).toContainText("Severidad high");
    await expect(page.getByTestId("ceo-retry-visible-pill")).toBeVisible();
    await expect(page.getByTestId("ceo-retry-visible-pill")).toContainText("pendientes");
    await expect(page.getByTestId("ceo-contextual-return-button")).toBeVisible();

    await page.getByTestId("ceo-contextual-return-button").click();

    await expect(page).toHaveURL(/\/ceo\?legalTenantId=tenant-demo/);
    await expect(page).toHaveURL(/legalCaseId=CASE-42/);
    await expect(page).toHaveURL(/legalAuditFamily=guardrail/);
    await expect(page).toHaveURL(/legalAuditSeverity=high/);
    await expect(page.getByText("Modo owner autorizado")).toBeVisible();
    await expect(page.getByTestId("ceo-context-summary-pill")).toContainText("Tenant tenant-demo");
  });
});

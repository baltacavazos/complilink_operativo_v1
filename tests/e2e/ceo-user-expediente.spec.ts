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
    await expect(page.getByText("Modo CEO maestro")).toBeVisible();

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

    await page.getByRole("button", { name: /salir de la demo y volver al ceo/i }).click();

    await expect(page).toHaveURL(/\/ceo$/);
    await expect(page.getByText("Modo CEO maestro")).toBeVisible();

    await expect
      .poll(() =>
        page.evaluate((storageKey) => window.sessionStorage.getItem(storageKey), VIEW_MODE_SESSION_KEY),
      )
      .toBe("native");
  });
});

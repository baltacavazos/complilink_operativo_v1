import { expect, test, type Page } from "@playwright/test";

const E2E_TOKEN = process.env.JWT_SECRET;

async function loginAsOwner(page: Page) {
  test.skip(!E2E_TOKEN, "JWT_SECRET no está disponible para bootstrap de sesión E2E.");

  await page.goto("/");

  const response = await page.evaluate(async (token) => {
    const request = await fetch("/api/testing/login-owner", {
      method: "POST",
      headers: {
        "x-complilink-e2e-token": token ?? "",
      },
      credentials: "include",
    });

    return {
      ok: request.ok,
      status: request.status,
    };
  }, E2E_TOKEN ?? "");

  expect(response.ok, `Fallo el bootstrap de sesión E2E con código ${response.status}.`).toBeTruthy();
}

test.describe("CEO maestro y vista demo de usuario", () => {
  test("protege la consola CEO para usuarios no autenticados", async ({ page }) => {
    await page.goto("/ceo");

    await expect(
      page.getByRole("heading", { name: "Acceso seguro y unificado" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Iniciar sesión" })).toBeVisible();
  });

  test("muestra el contexto CEO maestro al iniciar sesión como propietario", async ({ page }) => {
    await loginAsOwner(page);
    await page.goto("/ceo");

    await expect(page.getByRole("button", { name: "Ver como usuario" })).toBeVisible();
    await expect(page.getByText("Vista activa: CEO maestro")).toBeVisible();
  });

  test("redirige fuera de la consola CEO cuando el propietario activa la vista demo de usuario", async ({ page }) => {
    await loginAsOwner(page);
    await page.goto("/ceo");
    await page.getByRole("button", { name: "Ver como usuario" }).click();
    await page.waitForURL("**/auditar");

    await expect(page.getByText("Estás viendo la plataforma como usuario normal")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Salir de la demo y volver al CEO" }),
    ).toBeVisible();
    await expect(page.getByText("Tu identidad real como CEO maestro sigue intacta.")).toBeVisible();
  });
});

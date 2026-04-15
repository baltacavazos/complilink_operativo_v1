import { expect, test, type Page } from "@playwright/test";

const E2E_TOKEN = process.env.JWT_SECRET;

type SeedOwnerEmailCodeResult = {
  success: boolean;
  email: string;
  code: string;
};

async function seedOwnerEmailCode(page: Page, email?: string) {
  test.skip(!E2E_TOKEN, "JWT_SECRET no está disponible para bootstrap del código E2E del CEO.");

  const response = await page.evaluate(
    async ({ token, email }) => {
      const request = await fetch("/api/testing/seed-owner-email-code", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-complilink-e2e-token": token ?? "",
        },
        credentials: "include",
        body: JSON.stringify(email ? { email } : {}),
      });

      let data: unknown = null;
      try {
        data = await request.json();
      } catch {
        data = null;
      }

      return {
        ok: request.ok,
        status: request.status,
        data,
      };
    },
    { token: E2E_TOKEN ?? "", email },
  );

  expect(response.ok, `Fallo al sembrar el código E2E del CEO con estado ${response.status}.`).toBeTruthy();
  return response.data as SeedOwnerEmailCodeResult;
}

test.describe("Acceso CEO por código de correo", () => {
  test("permite solicitar y validar el código mostrando el aviso del buzón de respaldo", async ({ page }) => {
    await page.goto("/acceso?returnTo=/ceo");

    const seededOwner = await seedOwnerEmailCode(page);
    const ownerEmail = seededOwner.email;

    await page.getByLabel("Correo corporativo").fill(ownerEmail);
    await page.getByLabel("Nombre visible (opcional)").fill("CEO E2E");
    await page.getByRole("button", { name: "Recibir código" }).click();

    await expect(page.getByText("buzón de respaldo registrado")).toBeVisible();
    await expect(page.getByLabel("Correo verificado")).toHaveValue(ownerEmail);

    await seedOwnerEmailCode(page, ownerEmail);

    await page.getByLabel("Código de seis dígitos").fill("111111");
    await page.getByRole("button", { name: "Validar e iniciar sesión" }).click();

    await page.waitForURL("**/ceo");
    await expect(page.getByText("Vista activa: CEO maestro")).toBeVisible();
    await expect(page.getByRole("button", { name: "Ver como usuario" })).toBeVisible();
  });
});

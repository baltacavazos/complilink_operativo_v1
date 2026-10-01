import { expect, test } from "@playwright/test";

test.describe("navegación pública del landing", () => {
  test("el header de escritorio lleva a secciones o a la ruta legal", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");

    const desktopHeader = page.locator("header nav").first();

    await desktopHeader.getByRole("link", { name: "Tu recibo" }).click();
    await expect(page).toHaveURL(/#lectura-gratis$/);
    await expect(page.getByRole("heading", { name: "Sube un archivo y mira una primera lectura antes de decidir." })).toBeVisible();

    await desktopHeader.getByRole("link", { name: "Cómo funciona" }).click();
    await expect(page).toHaveURL(/#como-funciona$/);
    await expect(page.getByRole("heading", { name: "Tres pasos. Una lectura clara." })).toBeVisible();

    await desktopHeader.getByRole("link", { name: "Privacidad" }).click();
    await expect(page).toHaveURL(/\/aviso-de-privacidad$/);
    await expect(page.getByRole("link", { name: "Aviso de Privacidad" })).toBeVisible();
  });

  test("el menú móvil conserva anclas, cierra y manda Privacidad al aviso", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    const menuButton = page.getByRole("button", { name: /abrir menú/i });

    await menuButton.click();
    await page.locator("header").getByRole("link", { name: "Tu recibo" }).click();
    await expect(page).toHaveURL(/#lectura-gratis$/);
    await expect(page.getByRole("heading", { name: "Sube un archivo y mira una primera lectura antes de decidir." })).toBeVisible();
    await expect(menuButton).toBeVisible();

    await menuButton.click();
    await page.locator("header").getByRole("link", { name: "Cómo funciona" }).click();
    await expect(page).toHaveURL(/#como-funciona$/);
    await expect(page.getByRole("heading", { name: "Tres pasos. Una lectura clara." })).toBeVisible();
    await expect(menuButton).toBeVisible();

    await menuButton.click();
    await page.getByRole("button", { name: /cerrar menú/i }).click();
    await expect(page.getByTestId("home-quick-entry")).toHaveCount(0);

    await menuButton.click();
    await page.locator("header").getByRole("link", { name: "Privacidad" }).click();
    await expect(page).toHaveURL(/\/aviso-de-privacidad$/);
  });

  test("Entrada rápida, el chip de subida y los CTA de revisión llegan a su ruta", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    await page.getByRole("button", { name: /abrir menú/i }).click();
    await page.getByTestId("home-quick-entry").click();
    await expect(page).toHaveURL(/\/acceso\?returnTo=(%2F|\/)auditar$/);

    await page.goto("/");
    await page.getByTestId("home-upload-chip").click();
    await expect(page).toHaveURL(/\/auditar$/);

    await page.goto("/");
    await page.locator(".ap-hero").getByRole("button", { name: "Revisar mi recibo gratis" }).click();
    await expect(page).toHaveURL(/\/auditar$/);

    await page.goto("/");
    await page.locator(".ap-mobile-sticky").getByRole("button", { name: "Revisar mi recibo gratis" }).click();
    await expect(page).toHaveURL(/\/auditar$/);

    await page.goto("/");
    await page.getByRole("button", { name: /abrir menú/i }).click();
    await page.locator("header").getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/acceso\?returnTo=(%2F|\/)auditar$/);
  });

  test("las demás pastillas, el plan gratis, el pie y el acceso también actúan", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    await page.getByRole("button", { name: "Recibo recibido" }).click();
    await expect(page.getByText("Primero vemos tu recibo.")).toBeVisible();

    const fileChooserPromise = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Primera lectura sin correo" }).click();
    await fileChooserPromise;

    await page.getByRole("link", { name: "Privado desde el inicio" }).click();
    await expect(page).toHaveURL(/\/aviso-de-privacidad$/);

    await page.goto("/");
    await page.getByRole("link", { name: "Primero ves valor y luego decides" }).click();
    await expect(page).toHaveURL(/\/acceso\?returnTo=(%2F|\/)auditar$/);

    await page.goto("/");
    await page.getByTestId("home-hero-assistant-pill").click();
    await expect(page).toHaveURL(/\/auditar\?chat=1$/);

    await page.goto("/");
    await page.locator("#planes").getByRole("button", { name: "Revisar mi recibo gratis" }).click();
    await expect(page).toHaveURL(/\/auditar$/);

    await page.goto("/");
    await page.locator("#planes").getByRole("button", { name: "Ver el plan" }).first().click();
    await expect(page).toHaveURL(/\/auditar\?plan=/);

    await page.goto("/");
    await page.getByRole("link", { name: "Ver planes y activar" }).first().click();
    await expect(page).toHaveURL(/\/planes$/);

    await page.goto("/");
    await page.locator("header").getByRole("link", { name: "Ir al inicio de AuditaPatron" }).click();
    await expect(page).toHaveURL(/#top$/);

    await page.locator("footer").getByRole("link", { name: "Aviso de Privacidad" }).click();
    await expect(page).toHaveURL(/\/aviso-de-privacidad$/);

    await page.goto("/acceso?returnTo=/auditar");
    await page.getByRole("button", { name: "Crear mi cuenta por primera vez" }).click();
    await expect(page.getByRole("heading", { name: "Crea tu cuenta" })).toBeVisible();
    await page.getByRole("button", { name: "Ya tengo cuenta: iniciar sesión" }).click();
    await expect(page.getByRole("heading", { name: "Entra a tu cuenta" })).toBeVisible();
    await page.getByTestId("mobile-header-back").click();
    await expect(page).toHaveURL(/\/$/);
  });
});

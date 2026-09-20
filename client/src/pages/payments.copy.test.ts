import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

function readFromPages(fileName: string) {
  return fs.readFileSync(path.resolve(import.meta.dirname, `${fileName}.tsx`), "utf8");
}

function readFromSrc(relativePath: string) {
  return fs.readFileSync(path.resolve(import.meta.dirname, "..", relativePath), "utf8");
}

describe("flujo visible de pagos", () => {
  it("registra la ruta /pagos en App y la enlaza desde Auditar", () => {
    const appSource = readFromSrc("App.tsx");
    const auditarSource = readFromPages("Auditar");

    expect(appSource).toContain('const Payments = lazy(() => import("@/pages/Payments"));');
    expect(appSource).toContain('<Route path={"/pagos"} component={Payments} />');
    expect(appSource).toContain('<Route path={"/planes"} component={Plans} />');
    expect(appSource).toContain('<Route path={"/precios"} component={Plans} />');
    expect(auditarSource).toContain('href="/pagos"');
    expect(auditarSource).toContain('href="/planes"');
    expect(auditarSource).toContain("Ver historial de pagos");
    expect(auditarSource).toContain("Ver planes y activar");
  });

  it("muestra el texto principal de la nueva vista protegida de pagos", () => {
    const paymentsSource = readFromPages("Payments");

    expect(paymentsSource).toContain("Tu plan y lo que ya pagaste");
    expect(paymentsSource).toContain("Activaremos el cobro cuando esté listo.");
    expect(paymentsSource).toContain("Elegir plan y empezar");
    expect(paymentsSource).not.toContain("Esto es una demostración. No se cobra nada.");
    expect(paymentsSource).toContain("Pagos y compras registradas");
    expect(paymentsSource).toContain("Elegir plan");
    expect(paymentsSource).toContain("MXN al mes");
    expect(paymentsSource).toContain("La primera lectura es gratis. Solo pagas si quieres más documentos o un entregable extra.");
    expect(paymentsSource).not.toContain("Gestionar suscripción");
    expect(paymentsSource).not.toContain("Modo de prueba del cobro");
    expect(paymentsSource).not.toContain("Historial comercial");
    expect(paymentsSource).not.toContain("persistencia local");
    expect(paymentsSource).not.toContain("persistencia local mínima de Stripe");
    expect(paymentsSource).not.toContain("Cliente en Stripe");
    expect(paymentsSource).not.toContain("Stripe confirme el pago");
    expect(paymentsSource).not.toContain("Stripe");
    expect(paymentsSource).not.toContain("webhook");
    expect(paymentsSource).not.toContain("Webhook");
  });
});

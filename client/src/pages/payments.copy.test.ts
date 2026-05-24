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
    expect(auditarSource).toContain('href="/pagos"');
    expect(auditarSource).toContain("Ver historial de pagos");
  });

  it("muestra el texto principal de la nueva vista protegida de pagos", () => {
    const paymentsSource = readFromPages("Payments");

    expect(paymentsSource).toContain("Historial comercial del expediente");
    expect(paymentsSource).toContain("Gestionar suscripción");
    expect(paymentsSource).toContain("Pagos y compras registradas");
    expect(paymentsSource).toContain("Sandbox de Stripe detectado");
  });
});

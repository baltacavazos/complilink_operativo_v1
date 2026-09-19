import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dbSource = readFileSync(resolve(process.cwd(), "server/db.ts"), "utf8");
const homeSource = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");

describe("límites de cuenta visibles al trabajador", () => {
  it("lanza el tope freemium de un expediente personal en español claro", () => {
    expect(dbSource).toContain('throw new Error("Esta cuenta solo puede tener un expediente personal.")');
    expect(dbSource).toContain('throw new Error("Esta cuenta aún no tiene un expediente personal.")');
    expect(dbSource).not.toContain("This account is limited to a single personal case");
    expect(dbSource).not.toContain("No personal case assigned to this account");
  });

  it("también traduce denegaciones de acceso que pueden filtrarse en la misma subida", () => {
    expect(dbSource).toContain('throw new Error("Esta consulta necesita tu expediente abierto.")');
    expect(dbSource).not.toContain('throw new Error("No tienes acceso a este espacio.")');
    expect(dbSource).toContain('throw new Error("No tienes acceso a este expediente.")');
    expect(dbSource).toContain('throw new Error("No puedes modificar este expediente.")');
    expect(dbSource).toContain('throw new Error("No tienes permiso de administración en este espacio.")');
    expect(dbSource).not.toContain("Access denied for tenant");
    expect(dbSource).not.toContain("Access denied for case");
    expect(dbSource).not.toContain("Write access denied for case");
    expect(dbSource).not.toContain("Admin access denied for tenant");
  });

  it("no deja el error crudo en inglés en la reanudación de Home", () => {
    expect(homeSource).not.toContain(
      'setGuestError(error instanceof Error ? error.message : "No pudimos guardar la vista previa dentro de tu expediente.")',
    );
    expect(homeSource).not.toContain(
      'setGuestError(error instanceof Error ? error.message : "No pudimos leer ese archivo en este momento.")',
    );
    expect(homeSource).toContain("sanitizeHomeVisibleCopy(");
  });
});

import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

function readFromPages(fileName: string) {
  return fs.readFileSync(path.resolve(import.meta.dirname, fileName), "utf8");
}

function readRepo(relativePath: string) {
  return fs.readFileSync(path.resolve(import.meta.dirname, "../../..", relativePath), "utf8");
}

describe("AuditaPatrón Apple polish tip #2 — confianza y claridad", () => {
  it("hace legible el resultado de /auditar: contraste, títulos humanos y sin true/false crudo", () => {
    const auditar = readFromPages("Auditar.tsx");

    expect(auditar).toContain("toHumanResultTitle");
    expect(auditar).toContain("formatHumanStatusWord");
    expect(auditar).toContain('return value ? "Sí" : "No"');
    expect(auditar).toContain("text-sm font-semibold tracking-tight text-slate-800");
    expect(auditar).toContain("text-sm font-semibold tracking-tight text-emerald-900");
    expect(auditar).toContain("text-sm font-semibold tracking-tight text-amber-900");
    expect(auditar).not.toContain("text-xs font-semibold uppercase tracking-[0.16em] text-slate-600\">Impuestos y retenciones");
  });

  it("deja un solo CTA primario de subida y relega foto/archivo a opción secundaria", () => {
    const auditar = readFromPages("Auditar.tsx");

    expect(auditar).toContain('uploadPrimaryActionLabel: hasSelectedFile');
    expect(auditar).toContain(': "Sube tu recibo"');
    expect(auditar).toContain("Prefiero tomar una foto u otro archivo");
    expect(auditar).toContain("onClick={openPreferredPicker}");
    expect(auditar).not.toContain(": \"Tomar foto ahora\"\n                        </Button>");
    expect(auditar).not.toContain(": \"Elegir archivo\"\n                        </Button>");
  });

  it("no preselecciona un despido en la primera visita", () => {
    const db = readRepo("server/db.ts");

    expect(db).toContain('title: "Mi revisión documental"');
    expect(db).toContain('priority: "medium"');
    expect(db).toContain("Expediente inicial para revisar tus documentos cuando los subas.");
    expect(db).not.toContain('title: "Despido y reclamación inicial"');
    expect(db).not.toContain("Despido y reclamación");
  });

  it("publica responsable y domicilio reales en las páginas legales", () => {
    const legal = readRepo("shared/legal.ts");
    const legalPage = readFromPages("LegalDocuments.tsx");

    expect(legal).toContain("${LEGAL_CONTROLLER_NAME}, con domicilio en ${LEGAL_CONTROLLER_ADDRESS}");
    expect(legalPage).toContain("LEGAL_CONTROLLER_ADDRESS");
    expect(legal).not.toContain("se publicarán antes del lanzamiento comercial definitivo.");
    expect(legalPage).not.toContain("se publicarán antes del lanzamiento comercial definitivo.");
  });

  it("suaviza el grito tipográfico restante de Home que #9 dejó", () => {
    const home = readFromPages("Home.tsx");

    expect(home).not.toContain("uppercase tracking-[0.24em]");
    expect(home).not.toContain("uppercase tracking-[0.22em]");
    expect(home).not.toContain("uppercase tracking-[0.18em]");
    expect(home).toContain("tracking-tight");
  });

  it("explica gratis frente a de pago en /pagos sin jerga de Stripe en la frase principal", () => {
    const payments = readFromPages("Payments.tsx");
    const primarySentence =
      "La primera lectura es gratis. Solo pagas si quieres guardar más documentos o profundizar en tu expediente.";

    expect(payments).toContain(primarySentence);
    expect(primarySentence).not.toMatch(/Stripe|webhook|checkout/i);
    expect(payments).toContain("Referencia de cobro");
    expect(payments).not.toContain("persistencia local mínima de Stripe");
    expect(payments).not.toContain("Cliente en Stripe");
  });
});

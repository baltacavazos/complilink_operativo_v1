import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { plainReceiptImssLine, reviewCopyWithoutIdentity } from "@/lib/reviewCopy";

describe("guest receipt copy hides identifiers", () => {
  it("does not turn “se ve el NSS” into “se ve el tu”", () => {
    const raw =
      "IMSS: se ve el NSS 12345678901. Por lo que aparece en estos papeles, parece que hay referencia a aseguramiento ante IMSS.";
    expect(reviewCopyWithoutIdentity(raw)).toBe(
      "IMSS: se ve tu número del IMSS. Por lo que aparece en estos papeles, parece que hay referencia a aseguramiento ante IMSS.",
    );
    expect(reviewCopyWithoutIdentity(raw)).not.toMatch(/se ve el tu/);
    expect(reviewCopyWithoutIdentity(raw)).not.toMatch(/\d{4,}/);
  });

  it("shows a plain IMSS line without the number", () => {
    const line = plainReceiptImssLine(
      "IMSS: se ve el NSS 12345678901 y se ve el registro patronal Y1234567890.",
    );
    expect(line).toBe(
      "En tu recibo aparece tu número del IMSS. Esto sale de tu recibo, no de una respuesta del IMSS.",
    );
    expect(line).not.toMatch(/\d{4,}/);
    expect(line).not.toMatch(/\bcumple\b/i);
  });

  it("drops CURP and RFC sentences from the open paragraph", () => {
    const raw =
      "Empresa que aparece: TALLER NORTE. CURP: OOHH900101HDFRRN09. RFC de la persona trabajadora: OOHH900101XXX. RFC del patrón: ECC190605VA1. Pago que se alcanza a leer: $5,960.00.";
    const cleaned = reviewCopyWithoutIdentity(raw);
    expect(cleaned).not.toMatch(/OOHH/);
    expect(cleaned).not.toMatch(/ECC190605/);
    expect(cleaned).toContain("TALLER NORTE");
    expect(cleaned).toContain("$5,960.00");
  });

  it("opens the guest advisor with the verdict, not the identifier dump", () => {
    const source = readFileSync(new URL("./Auditar.tsx", import.meta.url), "utf8");
    const start = source.indexOf("const guestAdvisorSheet");
    const end = source.indexOf("if (chatHarnessMode)");
    const sheet = source.slice(start, end);
    expect(sheet).toContain("guestFiveSecond.seenLine");
    expect(sheet).toContain('caseTitle={guestReview ? "Tu recibo" : "Tu pregunta"}');
    expect(sheet).not.toContain("${guestSignalWhy}");
    expect(sheet).not.toContain("Expediente activo");
  });
});

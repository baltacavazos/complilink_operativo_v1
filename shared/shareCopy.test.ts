import { describe, expect, it } from "vitest";

import { buildShareText, createReferralCode, shareTextLeaksPrivateFacts } from "./shareCopy";

describe("pásaselo a un compa", () => {
  it("el texto no lleva monto, patrón, CURP, RFC, NSS ni nombre", () => {
    const code = "K7M2QP";
    const text = buildShareText(code);
    expect(text).toContain(`ref=${code}`);
    expect(text).toContain("tu patrón no se entera");
    expect(shareTextLeaksPrivateFacts(text, code)).toBe(false);
    expect(text).not.toMatch(/EVOLUCION|HECTOR|ORTIZ|CAMREFLEX|\$|NSS|CURP/i);
    expect(text.replace(code, "")).not.toMatch(/\d{4,}/);
    expect(text).not.toMatch(/\bcumple\b/i);
  });

  it("un recibo real no cabe en el texto aunque el código tenga números", () => {
    const code = createReferralCode(() => 0.2);
    expect(code).toHaveLength(6);
    const leaked = `${buildShareText(code)} EVOLUCION CREATIVA $5960 NSS 12345678901 RFC ECC190605VA1`;
    expect(shareTextLeaksPrivateFacts(leaked, code)).toBe(true);
  });
});

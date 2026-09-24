import { describe, expect, it } from "vitest";
import { OFFICIAL_FACT_ARRIVED_NOTICE, OFFICIAL_WAIT_STILL_TRYING } from "./officialCheckCopy";

describe("espera de consulta", () => {
  it("usa el copy exacto y no inventa un cumple", () => {
    expect(OFFICIAL_WAIT_STILL_TRYING).toBe("Seguimos intentando. Te avisamos cuando haya resultado.");
    const copy = `${OFFICIAL_WAIT_STILL_TRYING} ${OFFICIAL_FACT_ARRIVED_NOTICE}`;
    expect(copy).not.toMatch(/consulta en vivo/i);
    expect(copy).not.toMatch(/al corriente/i);
    expect(copy).not.toMatch(/\bBien\b/);
    expect(copy).not.toMatch(/cumple/i);
    expect(copy).not.toMatch(/ApiMarket|Nufi/i);
  });
});
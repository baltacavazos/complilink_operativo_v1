import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const guide = readFileSync(new URL("../components/OfficialDocumentGuide.tsx", import.meta.url), "utf8");
const copy = readFileSync(new URL("../../../shared/officialWorkerDocument.ts", import.meta.url), "utf8");
const auditar = readFileSync(new URL("./Auditar.tsx", import.meta.url), "utf8");
const home = readFileSync(new URL("./Home.tsx", import.meta.url), "utf8");

describe("guía de papel oficial", () => {
  it("el papel es el plan B, en español simple y sin claves", () => {
    expect(copy).toContain("Pide tu constancia aquí (te llega en un minuto), súbela y te la reviso");
    expect(copy).toContain("Verificado con documento oficial");
    expect(copy).toContain("Ya te llegó? Súbela");
    expect(guide).toContain("OFFICIAL_DOCUMENT_FALLBACK_LEAD");
    expect(guide).toContain("OFFICIAL_UPLOAD_LABEL");
    expect(guide).toContain("OFFICIAL_VERIFIED_LABEL");
    expect(guide).toContain('data-fuente={shown.fuente}');
    expect(guide).toContain("officialSourceHealth.useQuery");
    expect(guide).not.toMatch(/type="password"|contrase[nñ]a|ApiMarket|Nufi|Syntage|captcha/i);
    expect(guide).toContain('accept="application/pdf,.pdf"');
    const openAt = guide.indexOf('data-testid="official-guide-open"');
    const uploadAt = guide.indexOf('data-testid="official-guide-upload"');
    expect(uploadAt).toBeGreaterThan(openAt);
  });

  it("la consulta instantánea va primero y el papel solo sale si esa consulta falló", () => {
    expect(auditar).toContain("shouldOfferOfficialDocumentFallback");
    expect(home).toContain("shouldOfferOfficialDocumentFallback");
    expect(auditar).not.toContain("workerCannotProvideDocument: true");
    expect(home).not.toContain("workerCannotProvideDocument: true");
    expect(auditar).toContain("officialReadingId: officialWorkerDocument?.readingId");
    expect(copy).toContain('return "consulta"');
  });
});

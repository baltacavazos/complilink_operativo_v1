import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const guide = readFileSync(new URL("../components/OfficialDocumentGuide.tsx", import.meta.url), "utf8");
const copy = readFileSync(new URL("../../../shared/officialWorkerDocument.ts", import.meta.url), "utf8");
const auditar = readFileSync(new URL("./Auditar.tsx", import.meta.url), "utf8");
const home = readFileSync(new URL("./Home.tsx", import.meta.url), "utf8");

describe("guía de papel oficial", () => {
  it("explica los tres papeles en español simple y no pide claves", () => {
    expect(copy).toContain("Pide tu constancia del IMSS");
    expect(copy).toContain("Descarga tu estado de cuenta de Mi Cuenta Infonavit");
    expect(copy).toContain("Tu constancia del SAT (CSF)");
    expect(copy).toContain("Ya te llegó? Súbela");
    expect(guide).toContain("OFFICIAL_WORKER_PAGES[item].title");
    expect(guide).toContain("OFFICIAL_UPLOAD_LABEL");
    expect(guide).toContain("OFFICIAL_FALLBACK_LABEL");
    expect(guide).toContain('data-fuente={shown.fuente}');
    expect(guide).toContain("Fuente oficial");
    expect(guide).toContain("Respaldo");
    expect(guide).toContain("officialSourceHealth.useQuery");
    expect(guide).not.toMatch(/type="password"|contrase[nñ]a|ApiMarket|captcha/i);
    expect(guide).toContain('accept="application/pdf,.pdf"');
    const openAt = guide.indexOf('data-testid="official-guide-open"');
    const uploadAt = guide.indexOf('data-testid="official-guide-upload"');
    expect(uploadAt).toBeGreaterThan(openAt);
  });

  it("la pantalla de revisión muestra la guía antes de la consulta de respaldo", () => {
    expect(auditar).toContain("<OfficialDocumentGuide");
    expect(home).toContain("<OfficialDocumentGuide");
    expect(auditar).toContain("workerCannotProvideDocument: true");
    expect(home).toContain("workerCannotProvideDocument: true");
    expect(auditar).toContain("officialReadingId: officialWorkerDocument?.readingId");
  });
});

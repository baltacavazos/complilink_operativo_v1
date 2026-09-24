import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const auditar = readFileSync(new URL("./Auditar.tsx", import.meta.url), "utf8");
const upload = readFileSync(new URL("../components/InfonavitDocumentUpload.tsx", import.meta.url), "utf8");

describe("Auditar interim PDF Infonavit", () => {
  it("monta el CTA solo con el predicado de oficina sin hecho usable", () => {
    expect(auditar).toContain("shouldOfferInfonavitDocumentUpload");
    expect(auditar).toContain("offerInfonavitDocument ? <InfonavitDocumentUpload /> : null");
    expect(auditar).not.toMatch(/<InfonavitDocumentUpload\s*\/>\s*$/m);
  });

  it("el bloque de subida habla del documento y no de una consulta en vivo", () => {
    expect(upload).toContain('data-fact-origin="document"');
    expect(upload).toContain('data-fact-source="user_upload"');
    expect(upload).toContain("INFONAVIT_DOCUMENT_CTA");
    expect(upload).toContain("INFONAVIT_MICUENTA_URL");
    expect(upload).not.toMatch(/consulta en vivo/i);
    expect(upload).not.toMatch(/ApiMarket|Nufi|stripe|contrase[nñ]a/i);
    expect(upload).toContain('accept="application/pdf,.pdf"');
  });

  it("muestra el copy de espera y el aviso cuando llega un hecho", () => {
    expect(auditar).toContain("OFFICIAL_FACT_ARRIVED_NOTICE");
    expect(auditar).toContain("<OfficialWaitLayer");
    expect(auditar).toContain('id: "official-fact-arrived"');
  });
});

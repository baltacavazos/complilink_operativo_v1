import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const auditar = readFileSync(new URL("./Auditar.tsx", import.meta.url), "utf8");
const upload = readFileSync(new URL("../components/InfonavitDocumentUpload.tsx", import.meta.url), "utf8");
const result = readFileSync(new URL("../components/WorkerOfficialResult.tsx", import.meta.url), "utf8");

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
    expect(upload).toContain("INFONAVIT_DOCUMENT_STEPS");
    expect(upload).toContain("INFONAVIT_DOCUMENT_UPLOAD_LABEL");
    expect(upload).toContain("INFONAVIT_MICUENTA_URL");
    expect(upload).toContain("ap-btn-on-dark");
    expect(upload).not.toContain('variant="outline"');
    expect(upload).not.toContain("mt-8");
    expect(upload).not.toMatch(/consulta en vivo/i);
    expect(upload).not.toMatch(/ApiMarket|Nufi|stripe|contrase[nñ]a/i);
    expect(upload).toContain('accept="application/pdf,.pdf"');
    const stepsAt = upload.indexOf("INFONAVIT_DOCUMENT_STEPS");
    const buttonAt = upload.indexOf('data-testid="infonavit-document-upload"');
    expect(stepsAt).toBeGreaterThan(0);
    expect(buttonAt).toBeGreaterThan(stepsAt);
  });

  it("deja el PDF junto al fallo de Infonavit y fuera del detalle cerrado", () => {
    const offerAt = result.indexOf("{failureOffer}");
    const detailAt = result.indexOf(">Ver detalle<");
    expect(offerAt).toBeGreaterThan(0);
    expect(detailAt).toBeGreaterThan(offerAt);
    expect(auditar).toContain("failureOffer={infonavitDocumentSlot}");
    const compactAt = auditar.indexOf('data-compact-official-detail="true"');
    const beforeCompact = auditar.slice(Math.max(0, compactAt - 80), compactAt);
    expect(beforeCompact).toContain("{infonavitDocumentSlot}");
    const compactEnd = auditar.indexOf("</details>", compactAt);
    expect(auditar.slice(compactAt, compactEnd)).not.toContain("infonavitDocumentSlot");
  });

  it("muestra el copy de espera y el aviso cuando llega un hecho", () => {
    expect(auditar).toContain("OFFICIAL_FACT_ARRIVED_NOTICE");
    expect(auditar).toContain("GuestOfficialFactNotice");
    expect(auditar).toContain("useGuestOfficialFact");
    expect(auditar).toContain("<OfficialWaitLayer");
    expect(auditar).toContain('id: "official-fact-arrived"');
  });

  it("si queda una fuente pendiente, la tarjeta usa la capa de espera y no el CTA de mañana", () => {
    expect(auditar).toContain("<WorkerOfficialResult");
    expect(result).toContain("presentation.stillWaiting");
    expect(result).toContain("<OfficialWaitLayer");
    expect(result).toContain("OFFICIAL_WAIT_STILL_TRYING");
    expect(result).toContain("INSTITUTE_SILENCE_RETRY");
    const waitAt = result.indexOf("showWaitLayer");
    const ctaAt = result.indexOf('data-testid="official-check-cta"');
    expect(waitAt).toBeGreaterThan(0);
    expect(ctaAt).toBeGreaterThan(waitAt);
  });
});
